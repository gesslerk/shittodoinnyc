import Anthropic from "@anthropic-ai/sdk";

/**
 * Thin wrapper around the Anthropic SDK that gives every stage the same behavior:
 *   - streaming so long research turns never hit an HTTP timeout
 *   - automatic pause_turn continuation for server-side web tools
 *   - server-side refusal fallbacks (beta) with a retry-without if the org lacks the beta
 *   - refusal and max_tokens surfaced as errors instead of silently empty output
 *   - usage accounting with a dollar estimate
 */

const PRICE_PER_M = {
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};
const SEARCH_PRICE_PER_1000 = 10;

let client;
export function getClient() {
  if (!client) client = new Anthropic({ timeout: 25 * 60 * 1000, maxRetries: 3 });
  return client;
}

export function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0, fetches: 0, requests: 0 };
}

function addUsage(total, u, content = []) {
  if (!u) return;
  total.requests += 1;
  total.input += u.input_tokens ?? 0;
  total.output += u.output_tokens ?? 0;
  total.cacheRead += u.cache_read_input_tokens ?? 0;
  total.cacheWrite += u.cache_creation_input_tokens ?? 0;
  const fromUsage = u.server_tool_use ?? {};
  const fromBlocks = content.filter((b) => b.type === "server_tool_use");
  total.searches += Math.max(fromUsage.web_search_requests ?? 0, fromBlocks.filter((b) => b.name === "web_search").length);
  total.fetches += Math.max(fromUsage.web_fetch_requests ?? 0, fromBlocks.filter((b) => b.name === "web_fetch").length);
}

export function mergeUsage(...usages) {
  const out = emptyUsage();
  for (const u of usages) for (const k of Object.keys(out)) out[k] += u?.[k] ?? 0;
  return out;
}

export function estimateCost(usage, model = "claude-opus-5") {
  const p = PRICE_PER_M[model] ?? PRICE_PER_M["claude-opus-5"];
  const tokens =
    (usage.input * p.input + usage.output * p.output + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.cacheWrite) / 1e6;
  return Number((tokens + (usage.searches * SEARCH_PRICE_PER_1000) / 1000).toFixed(2));
}

export function webTools({ searches, fetches }) {
  return [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: searches,
      user_location: { type: "approximate", city: "New York", region: "New York", country: "US", timezone: "America/New_York" },
    },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: fetches, max_content_tokens: 20000 },
  ];
}

/**
 * Run one Claude task to completion. Returns { text, message, usage, servedBy, continuations }.
 */
export async function runClaude({
  model,
  system,
  messages,
  tools = [],
  outputSchema = null,
  maxTokens = 32000,
  effort = "high",
  label = "claude",
  maxContinuations = 8,
  log = console,
}) {
  const c = getClient();
  const convo = [...messages];
  const usage = emptyUsage();
  let useFallbacks = true;
  let servedBy = model;
  let continuations = 0;

  while (true) {
    const params = {
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: convo,
      output_config: {
        effort,
        ...(outputSchema ? { format: { type: "json_schema", schema: outputSchema } } : {}),
      },
    };
    if (tools.length) params.tools = tools;
    if (useFallbacks) {
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }

    let msg;
    try {
      const stream = c.beta.messages.stream(params);
      msg = await stream.finalMessage();
    } catch (err) {
      if (useFallbacks && err instanceof Anthropic.BadRequestError && /fallback|beta/i.test(err.message ?? "")) {
        log.warn(`[${label}] API rejected server-side fallbacks; retrying without them`);
        useFallbacks = false;
        continue;
      }
      throw err;
    }

    addUsage(usage, msg.usage, msg.content);
    servedBy = msg.model || servedBy;
    for (const b of msg.content) {
      if (b.type === "fallback") log.warn(`[${label}] ${b.from?.model} declined; ${b.to?.model} continued`);
    }

    if (msg.stop_reason === "pause_turn") {
      continuations += 1;
      if (continuations > maxContinuations) throw new Error(`[${label}] exceeded ${maxContinuations} pause_turn continuations`);
      log.info(`[${label}] pause_turn, resuming (${continuations}/${maxContinuations})`);
      convo.push({ role: "assistant", content: msg.content });
      continue;
    }
    if (msg.stop_reason === "refusal") {
      throw new Error(`[${label}] request refused (${msg.stop_details?.category ?? "no category"})`);
    }
    if (msg.stop_reason === "max_tokens") {
      throw new Error(`[${label}] hit max_tokens=${maxTokens}; raise it`);
    }

    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return { text, message: msg, usage, servedBy, continuations };
  }
}

export function parseJSON(text, label = "json") {
  const attempts = [text, text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1], text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const t of attempts) {
    if (!t) continue;
    try {
      return JSON.parse(t);
    } catch {
      /* try the next shape */
    }
  }
  throw new Error(`[${label}] could not parse JSON from model output (${text.length} chars)`);
}

/** Retry transient failures (network, 429, 5xx). Never retries 400/401/403. */
export async function withRetry(fn, { attempts = 2, label = "task", log = console, delayMs = 8000 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastErr = err;
      const permanent =
        err instanceof Anthropic.BadRequestError ||
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError;
      if (permanent || i === attempts) break;
      log.warn(`[${label}] attempt ${i} failed: ${err.message}; retrying in ${delayMs / 1000}s`);
      await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
  throw lastErr;
}

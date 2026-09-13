import { runClaude, webTools, withRetry } from "./claude.js";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

export const VERIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          status: {
            type: "string",
            enum: ["confirmed", "corrected", "unverifiable", "contradicted"],
            description:
              "confirmed = page loads and the details match; corrected = page loads and a detail was wrong (give the fixed value); unverifiable = page would not load or does not state the details; contradicted = the event is cancelled, sold out with no resale, already happened, in another city, or the page is for something else",
          },
          when_text: { ...nullableString, description: "Corrected human-readable date and time if it differs, else null" },
          start_date: { ...nullableString, description: "Corrected YYYY-MM-DD if it differs, else null" },
          price_text: { ...nullableString, description: "Corrected price if it differs, else null" },
          venue: { ...nullableString, description: "Corrected venue if it differs, else null" },
          note: { type: "string", description: "One short sentence: what you checked and what you found" },
        },
        required: ["id", "status", "when_text", "start_date", "price_text", "venue", "note"],
      },
    },
  },
  required: ["results"],
};

const VERIFY_SYSTEM = `You are the fact-checker for a private weekly events email. You receive a short list of events that are about to be sent to the reader, each with the URL the research desk found. For each one: fetch the URL, read it, and confirm the date, time, venue and price. If the fetch fails, try one web search to find the organizer's page and check there. Report one result per id using the schema. Be strict about "contradicted": it means the reader would waste a trip or money. Be honest about "unverifiable": it means you could not check, not that it is wrong. Never mark something confirmed that you did not actually read.`;

export function buildVerifyUser(items, windows) {
  const lines = items.map((c) =>
    [
      `[${c.id}] ${c.title}`,
      `  expected: ${c.anytime ? "anytime (a place, not a dated event)" : `${c.start_date ?? "date unknown"}${c.time_text ? `, ${c.time_text}` : ""}`} | ${c.venue}, ${c.neighborhood} | price: ${c.price_text || "unknown"}`,
      `  url: ${c.url}${c.source_url && c.source_url !== c.url ? `\n  also: ${c.source_url}` : ""}`,
    ].join("\n"),
  );
  return [
    `Today is ${windows.today} (New York). The email covers ${windows.thisWindow.start} to ${windows.thisWindow.end}, with a radar section through ${windows.radar.end}.`,
    "",
    `Check these ${items.length} items:`,
    "",
    lines.join("\n\n"),
    "",
    "Return JSON matching the schema with exactly one result per id.",
  ].join("\n");
}

/** Which candidates need checking: everything the curator referenced. */
export function itemsToVerify(curated, candidates) {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ids = [
    ...curated.picks.map((p) => p.candidate_id),
    ...curated.bench.map((p) => p.candidate_id),
    ...curated.radar.map((p) => p.candidate_id),
    ...curated.anytime.map((p) => p.candidate_id),
    ...(curated.family ? [curated.family.candidate_id] : []),
  ];
  return [...new Set(ids)].map((id) => byId.get(id)).filter(Boolean);
}

export async function verify({ cfg, windows, curated, candidates, log = console }) {
  const items = itemsToVerify(curated, candidates);
  if (!items.length) return { results: new Map(), usage: null };
  const result = await withRetry(
    () =>
      runClaude({
        model: cfg.models.verify,
        system: VERIFY_SYSTEM,
        messages: [{ role: "user", content: buildVerifyUser(items, windows) }],
        tools: webTools({ searches: cfg.limits.verifySearches, fetches: Math.max(items.length + 4, cfg.limits.verifyFetches) }),
        outputSchema: VERIFY_SCHEMA,
        maxTokens: 16000,
        effort: cfg.effort.verify,
        label: "verify",
        log,
      }),
    { attempts: 2, label: "verify", log },
  );
  const parsed = JSON.parse(result.text);
  const results = new Map();
  for (const r of parsed.results ?? []) if (r && r.id) results.set(r.id, r);
  const tally = {};
  for (const r of results.values()) tally[r.status] = (tally[r.status] ?? 0) + 1;
  log.info(`[verify] ${items.length} items checked: ${JSON.stringify(tally)}`);
  return { results, usage: result.usage, servedBy: result.servedBy };
}

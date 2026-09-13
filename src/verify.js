import { runClaude, webTools, withRetry } from "./claude.js";
import { isISODate } from "./schedule.js";

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
          start_date: { ...nullableString, description: "Corrected YYYY-MM-DD if the date differs or was missing, else null" },
          time_text: { ...nullableString, description: "Corrected time of day only, e.g. 'doors 7:30pm, show 8pm', if it differs or was missing. Never include the date. Else null." },
          price_text: { ...nullableString, description: "Corrected price in whole dollars if it differs or was missing, else null" },
          venue: { ...nullableString, description: "Corrected venue name (no address) if it differs, else null" },
          reader_note: {
            ...nullableString,
            description: "One short sentence for the reader ONLY when the correction changes what he should do, e.g. 'Date corrected: it is Thursday the 17th, not Friday.' Null when the fix is cosmetic or when nothing changed.",
          },
          note: { type: "string", description: "Internal: one sentence on what you checked and what you found" },
        },
        required: ["id", "status", "start_date", "time_text", "price_text", "venue", "reader_note", "note"],
      },
    },
  },
  required: ["results"],
};

const VERIFY_SYSTEM = `You are the fact-checker for a private weekly events email. You receive a short list of events that are about to be sent to the reader, each with the URL the research desk found. For each one: fetch the URL, read it, and confirm the date, time, venue and price. If the fetch fails, try one web search to find the organizer's page and check there. Report one result per id using the schema. Be strict about "contradicted": it means the reader would waste a trip or money. Be honest about "unverifiable": it means you could not check, not that it is wrong. Never mark something confirmed that you did not actually read. If an item was listed as "anytime" but the page shows a specific date, return that date in start_date and mark it corrected.`;

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

/**
 * Fold verification results back into the candidate pool.
 * Returns the corrected pool (contradicted items removed), whether any change was
 * material enough to re-run curation, and a human summary of the changes.
 */
export function applyVerification(candidates, results) {
  const out = [];
  const changes = [];
  let material = false;
  for (const c of candidates) {
    const v = results.get(c.id);
    if (!v) {
      out.push(c);
      continue;
    }
    if (v.status === "contradicted") {
      changes.push(`[${c.id}] removed: ${v.note}`);
      material = true;
      continue;
    }
    if (v.status !== "corrected") {
      out.push(c);
      continue;
    }
    const next = { ...c };
    const bits = [];
    if (v.start_date && isISODate(v.start_date) && v.start_date !== c.start_date) {
      bits.push(`date ${c.start_date ?? "unknown"} to ${v.start_date}`);
      next.start_date = v.start_date;
      if (!next.end_date || next.end_date < v.start_date) next.end_date = null;
      material = true;
      if (next.anytime) {
        next.anytime = false;
        bits.push("was listed as anytime, is a dated event");
      }
    }
    if (v.time_text && v.time_text !== c.time_text) {
      next.time_text = v.time_text;
      bits.push("time");
    }
    if (v.price_text && v.price_text !== c.price_text) {
      next.price_text = v.price_text;
      bits.push("price");
    }
    if (v.venue && v.venue !== c.venue) {
      next.venue = v.venue;
      bits.push(`venue to ${v.venue}`);
    }
    next.confidence = "verified";
    if (bits.length) changes.push(`[${c.id}] corrected: ${bits.join(", ")}`);
    out.push(next);
  }
  return { candidates: out, material, changes };
}

export async function verify({ cfg, windows, curated, candidates, only = null, log = console }) {
  const items = only ?? itemsToVerify(curated, candidates);
  if (!items.length) return { results: new Map(), usage: null, servedBy: null };
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
        timeoutMs: cfg.timeouts.verifyMs,
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

import { LANES, CANDIDATES_SCHEMA } from "./lanes.js";
import { runClaude, webTools, withRetry, mergeUsage, emptyUsage } from "./claude.js";
import { calendarForMonths } from "./profile.js";
import { isISODate, fromISO } from "./schedule.js";
import { parseHandles, formatPostsForPrompt } from "./instagram.js";

const RESEARCH_SYSTEM_PREFIX = `You are the research desk for a private weekly email called "Shit To Do in NYC." It goes to exactly one reader. Your job in this call is to find real, current, bookable things in New York City that match him, and to report them as structured candidates with sources.

You have web_search and web_fetch. Use them aggressively:
- Fetch the trusted source pages you are given first. Then search for what they do not cover. Then fetch the organizer page for anything promising so you can read the real date, time, venue and price.
- Mark confidence honestly. "verified" only when you read the organizer's or ticketing page and the details match. Never mark a search snippet as verified.
- Only report events inside the date windows you are given, or undated "anytime" places. Anything already past is worthless.
- Never invent an event, a date, a price or a URL. If you cannot find a real page, leave the item out.
- The url field must be the specific event or ticketing page, not a homepage, whenever one exists.
- Quality over volume. Twelve real, verified, well-matched candidates beat forty maybes. But do not stop early if there is more to find; use your search and fetch budget.
- Write the "fit" field for this specific reader, referencing his profile, not generic praise.

Reader profile follows. Read it closely; it is the whole point.`;

export function buildResearchSystem(profile) {
  return [RESEARCH_SYSTEM_PREFIX, "", "# PROFILE", profile.konrad, "", "# MUSIC PROFILE", profile.music].join("\n");
}

export function buildLaneUser({ lane, sources, windows, calendarExcerpt, feedback, instagramPosts = [], instagramHandles = [] }) {
  const sourceLines = sources.length
    ? sources.map((s) => `- ${s.name}: ${s.url}${s.note ? ` (${s.note})` : ""}`).join("\n")
    : "- (no trusted sources listed for this lane; rely on search)";

  const instagramBlock =
    lane.id !== "instagram"
      ? ""
      : instagramPosts.length
        ? [
            `# INSTAGRAM POSTS FROM THE LAST TWO WEEKS (${instagramPosts.length} posts, primary evidence)`,
            formatPostsForPrompt(instagramPosts),
            "",
          ].join("\n")
        : [
            "# NO SCRAPED POSTS THIS WEEK: SEARCH THE INDEX INSTEAD",
            "Accounts to target with site:instagram.com searches:",
            instagramHandles.map((h) => `- @${h.handle}${h.note ? ` (${h.note})` : ""}`).join("\n") || "- (none listed)",
            "",
          ].join("\n");

  return [
    `# LANE: ${lane.name}`,
    "",
    lane.brief,
    "",
    "# DATES",
    `Today is ${windows.todayLabel} (${windows.today}), New York time.`,
    `THIS WINDOW (the main picks): ${windows.thisWindow.start} through ${windows.thisWindow.end}. Days: ${windows.days.join(", ")}.`,
    `RADAR WINDOW (things that need booking now): ${windows.radar.start} through ${windows.radar.end}.`,
    "Set start_date and end_date as YYYY-MM-DD. Undated places get anytime=true and null dates.",
    "",
    "# SEASON NOTES FROM HIS ANNUAL CALENDAR",
    calendarExcerpt || "(none for these months)",
    "",
    instagramBlock,
    "# TRUSTED SOURCES TO FETCH FIRST",
    sourceLines,
    "",
    "# SEARCH IDEAS (adapt the wording to the actual dates; add your own)",
    lane.hints.map((h) => `- ${h}`).join("\n"),
    "",
    feedback ? `# RECENT FEEDBACK FROM THE READER\n${feedback}\n` : "",
    "# OUTPUT",
    "Return JSON matching the schema: a candidates array plus notes. Aim for 10 to 25 candidates for this lane, across both windows, with the anytime places included when they are genuinely new or special. Put the most exciting, best-verified items first.",
  ].join("\n");
}

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Keep only candidates the curator can actually use. Returns { kept, dropped }. */
export function filterCandidates(raw, windows) {
  const kept = [];
  const dropped = [];
  const today = fromISO(windows.today);
  const radarEnd = fromISO(windows.radar.end);
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const reasons = [];
    if (!/^https?:\/\//i.test(c.url ?? "")) reasons.push("no url");
    if (!c.title || !norm(c.title)) reasons.push("no title");
    if (!c.anytime) {
      if (c.start_date && !isISODate(c.start_date)) reasons.push("bad start_date");
      if (c.end_date && !isISODate(c.end_date)) reasons.push("bad end_date");
      if (!c.start_date && !c.recurring) reasons.push("dated item without a date");
      const first = c.start_date && isISODate(c.start_date) ? fromISO(c.start_date) : null;
      const last = c.end_date && isISODate(c.end_date) ? fromISO(c.end_date) : first;
      if (last && last < today) reasons.push("already happened");
      if (first && first > radarEnd) reasons.push("beyond radar window");
    }
    if (reasons.length) dropped.push({ title: c.title, url: c.url, lane: c.lane, reasons });
    else kept.push(c);
  }
  return { kept, dropped };
}

/** Collapse duplicates across lanes: same URL, or same normalized title on the same date. */
export function dedupeCandidates(list) {
  const rank = { verified: 3, likely: 2, unverified: 1 };
  const keysOf = (c) => [`url:${String(c.url).replace(/\/+$/, "").toLowerCase()}`, `t:${norm(c.title)}|${c.start_date ?? "any"}`];
  const byKey = new Map();
  for (const c of list) {
    const members = new Set([c, ...keysOf(c).map((k) => byKey.get(k)).filter(Boolean)]);
    let winner = c;
    for (const m of members) if ((rank[m.confidence] ?? 0) > (rank[winner.confidence] ?? 0)) winner = m;
    winner.tags = [...new Set([...members].flatMap((m) => m.tags ?? []))];
    winner.lanes = [...new Set([...members].flatMap((m) => m.lanes ?? [m.lane]))];
    for (const m of members) for (const k of keysOf(m)) byKey.set(k, winner);
  }
  return [...new Set(byKey.values())];
}

export async function runLane({ lane, cfg, profile, windows, instagramPosts, log }) {
  const system = buildResearchSystem(profile);
  const user = buildLaneUser({
    lane,
    sources: profile.sources[lane.id] ?? [],
    windows,
    calendarExcerpt: calendarForMonths(profile.calendar, windows.months),
    feedback: profile.feedback,
    instagramPosts,
    instagramHandles: parseHandles(profile.instagram ?? ""),
  });
  const started = Date.now();
  const result = await withRetry(
    () =>
      runClaude({
        model: cfg.models.research,
        system,
        messages: [{ role: "user", content: user }],
        tools: webTools({
          searches: Math.min(lane.maxSearches, cfg.limits.searchesPerLane * 2),
          fetches: Math.min(lane.maxFetches, cfg.limits.fetchesPerLane * 2),
        }),
        outputSchema: CANDIDATES_SCHEMA,
        maxTokens: 24000,
        effort: cfg.effort.research,
        label: `research:${lane.id}`,
        log,
      }),
    { attempts: 2, label: `research:${lane.id}`, log },
  );
  const parsed = JSON.parse(result.text);
  const candidates = (parsed.candidates ?? []).map((c) => ({ ...c, lane: lane.id }));
  log.info(
    `[research:${lane.id}] ${candidates.length} candidates, ${result.usage.searches} searches, ${result.usage.fetches} fetches, ${Math.round((Date.now() - started) / 1000)}s`,
  );
  return { lane: lane.id, candidates, notes: parsed.notes ?? "", usage: result.usage, servedBy: result.servedBy };
}

/**
 * Run every lane in parallel. A failed lane is logged and skipped; the run continues
 * with whatever the other lanes found, and the failure is recorded for the email footer.
 */
export async function runResearch({ cfg, profile, windows, instagramPosts = [], log = console }) {
  const lanes = LANES.filter((l) => !cfg.lanes || cfg.lanes.includes(l.id));
  const settled = await Promise.allSettled(lanes.map((lane) => runLane({ lane, cfg, profile, windows, instagramPosts, log })));

  const laneReports = [];
  const raw = [];
  for (const [i, s] of settled.entries()) {
    const lane = lanes[i];
    if (s.status === "fulfilled") {
      laneReports.push({ lane: lane.id, ok: true, count: s.value.candidates.length, notes: s.value.notes, usage: s.value.usage, servedBy: s.value.servedBy });
      raw.push(...s.value.candidates);
    } else {
      log.error(`[research:${lane.id}] failed: ${s.reason?.message ?? s.reason}`);
      laneReports.push({ lane: lane.id, ok: false, count: 0, error: String(s.reason?.message ?? s.reason), usage: emptyUsage() });
    }
  }

  const { kept, dropped } = filterCandidates(raw, windows);
  const deduped = dedupeCandidates(kept).map((c, i) => ({ id: `c${i + 1}`, ...c }));
  log.info(`[research] ${raw.length} raw, ${dropped.length} dropped, ${deduped.length} usable candidates`);
  if (dropped.length) log.info(`[research] dropped: ${dropped.map((d) => `${d.title} (${d.reasons.join(", ")})`).join("; ")}`);

  return { candidates: deduped, laneReports, dropped, usage: mergeUsage(...laneReports.map((r) => r.usage)) };
}

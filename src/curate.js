import { runClaude, withRetry } from "./claude.js";
import { calendarForMonths } from "./profile.js";
import { weekdayOf, formatShort } from "./schedule.js";

const WHO = { type: "string", enum: ["guys", "wife", "either", "family"] };
const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

const pickItem = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidate_id: { type: "string" },
    headline: { type: "string", description: "Punchy, specific, eight words or fewer" },
    why: { type: "string", description: "Two to four short sentences written to him, explaining why this fits his taste" },
    heads_up: { ...nullableString, description: "Ticketing, timing, price or logistics caveat. Null if none." },
    who: WHO,
    invite_text: { type: "string", description: "A one or two sentence text message he can send to friends or his wife. Casual, specific, includes the day. No links, no hashtags, no emoji." },
    splurge: { type: "boolean", description: "True if this costs well over $150 per person" },
  },
  required: ["candidate_id", "headline", "why", "heads_up", "who", "invite_text", "splurge"],
};

const radarItem = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidate_id: { type: "string" },
    headline: { type: "string" },
    why: { type: "string", description: "One to three sentences" },
    book_by: { ...nullableString, description: "When to buy, e.g. 'tickets on sale Fri Sep 18 10am' or 'sells out within days'. Null if no urgency." },
    who: WHO,
  },
  required: ["candidate_id", "headline", "why", "book_by", "who"],
};

const anytimeItem = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidate_id: { type: "string" },
    headline: { type: "string" },
    why: { type: "string", description: "One to three sentences" },
    who: WHO,
  },
  required: ["candidate_id", "headline", "why", "who"],
};

const familyItem = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidate_id: { type: "string" },
    headline: { type: "string" },
    why: { type: "string", description: "One to three sentences, including why it works with a 1-year-old" },
    invite_text: { type: "string", description: "A text to his wife proposing it" },
  },
  required: ["candidate_id", "headline", "why", "invite_text"],
};

export const CURATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string", description: "Email subject. Format: 'Shit To Do in NYC (Sep 14): <three to six word hook naming the best picks>'. Under 80 characters." },
    opener: { type: "string", description: "One to three sentences at the top of the email, in the voice of a friend who has the plan. May reference the season or the week." },
    picks: { type: "array", items: pickItem, description: "Five to seven main picks inside THIS WINDOW, best first" },
    bench: { type: "array", items: pickItem, description: "Two or three alternates inside THIS WINDOW, used if a main pick fails verification. Must not repeat picks." },
    radar: { type: "array", items: radarItem, description: "Two to five items in the RADAR WINDOW that need booking now" },
    anytime: { type: "array", items: anytimeItem, description: "One to three undated places or offers worth knowing about" },
    family: { anyOf: [familyItem, { type: "null" }], description: "The weekend daytime pick for the family, or null if nothing real was found" },
    notes: { type: "string", description: "One or two sentences for the footer: what was thin this week, or what you left out and why. Written to him." },
  },
  required: ["subject", "opener", "picks", "bench", "radar", "anytime", "family", "notes"],
};

const CURATOR_SYSTEM_PREFIX = `You are the editor of "Shit To Do in NYC," a private weekly email for one reader. A research desk has already searched the web and handed you a pool of candidates with sources. Your job is to choose and to write. You cannot add anything that is not in the pool, and you must reference candidates by their id; the system fills in dates, venues, prices and links from the research record, so never restate a URL.

Selection rules:
- Five to seven main picks inside THIS WINDOW. Thursday through Sunday are the real slots. Monday to Wednesday only for something exceptional.
- Mix it up. At most two picks from the same category unless the week is truly lopsided. At least one pick that works as a date night with his wife. The majority should work for him and the guys.
- At least two picks should be the small-room, had-to-know-about-it register. One big spectacle is welcome when it is genuinely big.
- Prefer "verified" candidates. Use "likely" when the fit is strong. Avoid "unverified" for main picks; they can sit on the bench or the radar with a heads-up.
- Do not repeat anything that appeared as a main pick in the recent archive. Radar items may return until they happen. Anytime items should not repeat within two months.
- Places he already loves are not discoveries. Only recommend them for a specific event.
- Respect every non-negotiable in the profile. When in doubt, ask: would the Time Out crowd be there? If yes, cut it.
- The family pick is one weekend daytime thing that works with a 1-year-old and is interesting to the adults.
- Bench: two or three alternates from THIS WINDOW that are not in picks, in case a pick fails verification.
- If the pool is thin, say so in the notes rather than padding with weak picks. Five strong picks beat seven mediocre ones.

Writing rules:
- Voice: a friend who knows the city and has the plan. Direct, a little irreverent, confident. Short sentences. Second person.
- Explain why each pick fits him, not why it is popular. Reference his taste specifically (the artists, the rooms, the things he has loved) when it is true, and do not force it.
- No exclamation-point spam, no "vibes," no "hidden gem," no "must-see," no "immersive experience," no "elevated," no "curated," no emoji.
- Headlines are specific: the artist, the room, the thing. Eight words or fewer.
- invite_text is a real text message: casual, specific, names the day, one or two sentences, no links.
- heads_up is practical: on-sale times, sellout risk, what to wear, when to arrive, that it is expensive, that the date should be confirmed. Null when there is nothing to say.`;

export function buildCuratorSystem(profile, windows) {
  return [
    CURATOR_SYSTEM_PREFIX,
    "",
    "# PROFILE",
    profile.konrad,
    "",
    "# MUSIC PROFILE",
    profile.music,
    "",
    "# SEASON NOTES",
    calendarForMonths(profile.calendar, windows.months) || "(none)",
    "",
    "# FEEDBACK LOG (most recent word on taste)",
    profile.feedback || "(none)",
  ].join("\n");
}

function compactCandidate(c) {
  const dateBit = c.anytime
    ? "anytime"
    : `${c.start_date ?? "date unknown"}${c.start_date ? ` (${weekdayOf(c.start_date)})` : ""}${c.end_date && c.end_date !== c.start_date ? ` to ${c.end_date}` : ""}${c.recurring ? ", recurring" : ""}`;
  return [
    `[${c.id}] ${c.title}`,
    `  category: ${c.category} | when: ${dateBit}${c.time_text ? `, ${c.time_text}` : ""} | where: ${c.venue}, ${c.neighborhood}, ${c.borough}`,
    `  price: ${c.price_text || "unknown"} | confidence: ${c.confidence} | who: ${c.who} | lane: ${c.lanes?.join("+") ?? c.lane}${c.tags?.length ? ` | tags: ${c.tags.join(", ")}` : ""}`,
    `  summary: ${c.summary}`,
    `  fit: ${c.fit}`,
  ].join("\n");
}

export function buildCuratorUser({ candidates, windows, recent, laneReports }) {
  const inWindow = candidates.filter((c) => !c.anytime && c.start_date && c.start_date >= windows.thisWindow.start && c.start_date <= windows.thisWindow.end);
  const inRadar = candidates.filter((c) => !c.anytime && c.start_date && c.start_date > windows.thisWindow.end);
  const undatedOrRecurring = candidates.filter((c) => c.anytime || !c.start_date);
  const failed = laneReports.filter((r) => !r.ok).map((r) => r.lane);

  const recentBlock = recent.length
    ? recent
        .map((r) => `- ${r.date}: picks: ${r.picks.join("; ") || "none"} | radar: ${r.radar.join("; ") || "none"} | anytime: ${r.anytime.join("; ") || "none"}`)
        .join("\n")
    : "- (first issue, nothing to avoid)";

  return [
    "# DATES",
    `Today is ${windows.todayLabel} (${windows.today}).`,
    `THIS WINDOW: ${formatShort(windows.thisWindow.start)} through ${formatShort(windows.thisWindow.end)} (${windows.thisWindow.start} to ${windows.thisWindow.end}). Days: ${windows.days.join(", ")}.`,
    `RADAR WINDOW: ${windows.radar.start} to ${windows.radar.end}.`,
    "",
    "# RECENT ISSUES (do not repeat main picks)",
    recentBlock,
    "",
    failed.length ? `# NOTE\nThese research lanes failed this week and returned nothing: ${failed.join(", ")}. Mention it in the notes if the email feels thin because of it.\n` : "",
    `# CANDIDATES IN THIS WINDOW (${inWindow.length})`,
    inWindow.map(compactCandidate).join("\n\n") || "(none)",
    "",
    `# CANDIDATES IN THE RADAR WINDOW (${inRadar.length})`,
    inRadar.map(compactCandidate).join("\n\n") || "(none)",
    "",
    `# UNDATED, RECURRING OR ANYTIME (${undatedOrRecurring.length})`,
    undatedOrRecurring.map(compactCandidate).join("\n\n") || "(none)",
    "",
    "# OUTPUT",
    "Return JSON matching the schema. Reference candidates only by id. Best pick first.",
  ].join("\n");
}

/** Drop references to ids that do not exist and enforce list sizes. */
export function sanitizeCuration(curated, candidates) {
  const ids = new Set(candidates.map((c) => c.id));
  const keep = (arr) => (Array.isArray(arr) ? arr.filter((x) => x && ids.has(x.candidate_id)) : []);
  const picks = keep(curated.picks);
  const pickIds = new Set(picks.map((p) => p.candidate_id));
  const bench = keep(curated.bench).filter((b) => !pickIds.has(b.candidate_id));
  const family = curated.family && ids.has(curated.family.candidate_id) ? curated.family : null;
  return {
    subject: String(curated.subject ?? "Shit To Do in NYC").slice(0, 120),
    opener: String(curated.opener ?? ""),
    picks: picks.slice(0, 7),
    bench: bench.slice(0, 3),
    radar: keep(curated.radar).slice(0, 5),
    anytime: keep(curated.anytime).slice(0, 3),
    family,
    notes: String(curated.notes ?? ""),
  };
}

export async function curate({ cfg, profile, windows, candidates, recent, laneReports, log = console }) {
  const system = buildCuratorSystem(profile, windows);
  const user = buildCuratorUser({ candidates, windows, recent, laneReports });
  const result = await withRetry(
    () =>
      runClaude({
        model: cfg.models.curate,
        system,
        messages: [{ role: "user", content: user }],
        outputSchema: CURATION_SCHEMA,
        maxTokens: 16000,
        effort: cfg.effort.curate,
        label: "curate",
        log,
      }),
    { attempts: 2, label: "curate", log },
  );
  const curated = sanitizeCuration(JSON.parse(result.text), candidates);
  log.info(`[curate] ${curated.picks.length} picks, ${curated.bench.length} bench, ${curated.radar.length} radar, ${curated.anytime.length} anytime, family: ${curated.family ? "yes" : "no"}`);
  return { curated, usage: result.usage, servedBy: result.servedBy };
}

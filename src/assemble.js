import { formatShort, isISODate, weekdayOf } from "./schedule.js";

const UNVERIFIED_NOTE = "Could not re-check the listing page this morning. Confirm the date on the link before you buy.";

function whenText(c, v) {
  if (v?.when_text) return v.when_text;
  const date = v?.start_date && isISODate(v.start_date) ? v.start_date : c.start_date;
  if (c.anytime || !date) return c.time_text || (c.recurring ? "Recurring" : "Anytime");
  const dayPart = formatShort(date);
  const range = c.end_date && c.end_date !== date ? ` to ${formatShort(c.end_date)}` : "";
  return `${dayPart}${range}${c.time_text ? `, ${c.time_text}` : ""}`;
}

function hydrate(item, candidate, v, { extraHeadsUp = true } = {}) {
  if (!candidate) return null;
  if (v?.status === "contradicted") return null;
  const headsUpParts = [item.heads_up].filter(Boolean);
  if (extraHeadsUp && v?.status === "unverifiable") headsUpParts.push(UNVERIFIED_NOTE);
  if (v?.status === "corrected" && v.note) headsUpParts.push(`Corrected after checking the page: ${v.note}`);
  return {
    id: candidate.id,
    headline: item.headline || candidate.title,
    title: candidate.title,
    category: candidate.category,
    who: item.who || candidate.who,
    when: whenText(candidate, v),
    date: v?.start_date && isISODate(v.start_date) ? v.start_date : candidate.start_date ?? null,
    weekday: (v?.start_date && isISODate(v.start_date)) || candidate.start_date ? weekdayOf(v?.start_date && isISODate(v.start_date) ? v.start_date : candidate.start_date) : null,
    venue: v?.venue || candidate.venue,
    neighborhood: candidate.neighborhood,
    borough: candidate.borough,
    price: v?.price_text || candidate.price_text || "",
    url: candidate.url,
    why: item.why,
    heads_up: headsUpParts.join(" ") || null,
    invite_text: item.invite_text ?? null,
    book_by: item.book_by ?? null,
    splurge: Boolean(item.splurge),
    confidence: candidate.confidence,
    verification: v ? { status: v.status, note: v.note } : { status: "skipped", note: "verification skipped" },
  };
}

/**
 * Pure function: join curator choices to research records, apply verification,
 * backfill from the bench, and produce the final issue object the renderer consumes.
 */
export function assemble({ curated, candidates, verification = new Map(), windows, issueNumber = 1, laneReports = [], stats = {} }) {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const v = (id) => verification.get(id);
  const used = new Set();

  const picks = [];
  for (const p of curated.picks) {
    const h = hydrate(p, byId.get(p.candidate_id), v(p.candidate_id));
    if (h && !used.has(h.id)) {
      picks.push(h);
      used.add(h.id);
    }
  }
  const droppedPicks = curated.picks.length - picks.length;
  let benched = 0;
  for (const b of curated.bench) {
    if (picks.length >= 5) break;
    const h = hydrate(b, byId.get(b.candidate_id), v(b.candidate_id));
    if (h && !used.has(h.id)) {
      picks.push(h);
      used.add(h.id);
      benched += 1;
    }
  }

  const radar = [];
  for (const r of curated.radar) {
    const h = hydrate(r, byId.get(r.candidate_id), v(r.candidate_id));
    if (h && !used.has(h.id)) {
      radar.push(h);
      used.add(h.id);
    }
  }
  const anytime = [];
  for (const a of curated.anytime) {
    const h = hydrate(a, byId.get(a.candidate_id), v(a.candidate_id));
    if (h && !used.has(h.id)) {
      anytime.push(h);
      used.add(h.id);
    }
  }
  const family = curated.family ? hydrate({ ...curated.family, who: "family" }, byId.get(curated.family.candidate_id), v(curated.family.candidate_id)) : null;

  const failedLanes = laneReports.filter((r) => !r.ok).map((r) => r.lane);
  const footerNotes = [curated.notes];
  if (droppedPicks) footerNotes.push(`${droppedPicks} pick${droppedPicks > 1 ? "s" : ""} got cut after fact-checking${benched ? ` and ${benched} came off the bench` : ""}.`);
  if (failedLanes.length) footerNotes.push(`The ${failedLanes.join(" and ")} research lane${failedLanes.length > 1 ? "s" : ""} failed this week, so that side is thin.`);

  return {
    issue: issueNumber,
    generatedAt: new Date().toISOString(),
    weekOf: windows.today,
    weekOfLabel: windows.weekOfLabel,
    windows: { this: windows.thisWindow, radar: windows.radar },
    subject: curated.subject,
    opener: curated.opener,
    picks: picks.slice(0, 7),
    radar,
    anytime,
    family,
    notes: footerNotes.filter(Boolean).join(" "),
    stats: { ...stats, droppedPicks, benched, failedLanes },
  };
}

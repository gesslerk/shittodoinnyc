import { formatShort, isISODate, weekdayOf } from "./schedule.js";

const UNVERIFIED_NOTE = "Could not re-check the listing page this morning. Confirm the date on the link before you buy.";
const HAS_DATE = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\/\d{1,2}\b/i;

/** "Thu Sep 17, doors 9pm" without ever repeating a date the time text already carries. */
export function whenText(c) {
  const time = String(c.time_text ?? "").trim();
  const date = c.start_date && isISODate(c.start_date) ? c.start_date : null;
  if (c.anytime || !date) return time || (c.recurring ? "Recurring" : "Anytime");
  const range = c.end_date && isISODate(c.end_date) && c.end_date !== date ? ` to ${formatShort(c.end_date)}` : "";
  if (HAS_DATE.test(time)) return time;
  return `${formatShort(date)}${range}${time ? `, ${time}` : ""}`;
}

function hydrate(item, candidate, v) {
  if (!candidate) return null;
  if (v?.status === "contradicted") return null;
  const headsUp = [item.heads_up, v?.status === "unverifiable" ? UNVERIFIED_NOTE : null, v?.status === "corrected" ? v.reader_note : null].filter(Boolean);
  const date = candidate.start_date && isISODate(candidate.start_date) ? candidate.start_date : null;
  return {
    id: candidate.id,
    headline: item.headline || candidate.title,
    title: candidate.title,
    category: candidate.category,
    who: item.who || candidate.who,
    when: whenText(candidate),
    date,
    weekday: date ? weekdayOf(date) : null,
    venue: candidate.venue,
    address: candidate.address ?? "",
    neighborhood: candidate.neighborhood,
    borough: candidate.borough,
    price: candidate.price_text || "",
    url: candidate.url,
    why: item.why,
    heads_up: headsUp.join(" ") || null,
    invite_text: item.invite_text ?? null,
    book_by: item.book_by ?? null,
    splurge: Boolean(item.splurge),
    confidence: candidate.confidence,
    verification: v ? { status: v.status, note: v.note } : { status: "skipped", note: "not fact-checked" },
  };
}

/**
 * Pure function: join curator choices to the (already corrected) candidate pool, apply
 * verification statuses, backfill from the bench, and produce the issue the renderer consumes.
 */
export function assemble({ curated, candidates, verification = new Map(), windows, issueNumber = 1, laneReports = [], stats = {} }) {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const v = (id) => verification.get(id);
  const used = new Set();
  const take = (items, extra = {}) => {
    const out = [];
    for (const it of items) {
      const h = hydrate({ ...it, ...extra }, byId.get(it.candidate_id), v(it.candidate_id));
      if (h && !used.has(h.id)) {
        out.push(h);
        used.add(h.id);
      }
    }
    return out;
  };

  const picks = take(curated.picks);
  const droppedPicks = curated.picks.length - picks.length;
  let benched = 0;
  for (const b of curated.bench) {
    if (picks.length >= 5) break;
    const [h] = take([b]);
    if (h) {
      picks.push(h);
      benched += 1;
    }
  }
  const radar = take(curated.radar);
  const anytime = take(curated.anytime);
  const family = curated.family ? take([curated.family], { who: "family" })[0] ?? null : null;

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

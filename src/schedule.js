/**
 * All date logic lives here and is expressed in New York calendar days.
 * GitHub Actions cron runs in UTC and does not know about daylight saving,
 * so the workflow fires at both 10:00 and 11:00 UTC on Mondays and this
 * module decides which of the two is actually 6am in New York.
 */

const TZ = "America/New_York";
const DAY = 24 * 60 * 60 * 1000;

export function nyParts(date = new Date(), timeZone = TZ) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

// Calendar-date helpers. Dates are "YYYY-MM-DD" strings; arithmetic is done in UTC
// on midnight timestamps so DST never shifts a day.
export const fromISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const toISO = (d) => d.toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(d.getTime() + n * DAY);
export const diffDays = (a, b) => Math.round((b.getTime() - a.getTime()) / DAY);
export const isISODate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromISO(s).getTime());

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatShort(iso) {
  const d = fromISO(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export function formatLong(iso) {
  const d = fromISO(iso);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export function weekdayOf(iso) {
  return WEEKDAYS[fromISO(iso).getUTCDay()];
}

/**
 * The email covers "this window" (today through the coming Sunday, at least four
 * days long so a Saturday test run still has something to look at) and a
 * "radar window" (the six weeks after that, for things that need booking now).
 */
export function computeWindows(now = new Date(), timeZone = TZ) {
  const today = nyParts(now, timeZone).isoDate;
  const t = fromISO(today);
  let sunday = addDays(t, (7 - t.getUTCDay()) % 7);
  if (diffDays(t, sunday) < 4) sunday = addDays(sunday, 7);

  const thisWindow = { start: today, end: toISO(sunday) };
  const radar = { start: toISO(addDays(sunday, 1)), end: toISO(addDays(sunday, 42)) };

  const days = [];
  for (let d = t; d <= sunday; d = addDays(d, 1)) days.push(`${formatShort(toISO(d))} (${toISO(d)})`);

  const monthsInPlay = new Set();
  for (let d = t; d <= addDays(sunday, 42); d = addDays(d, 1)) monthsInPlay.add(MONTHS_LONG[d.getUTCMonth()]);

  return {
    today,
    todayLabel: formatLong(today),
    thisWindow,
    radar,
    days,
    months: [...monthsInPlay],
    weekOfLabel: `Week of ${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}, ${t.getUTCFullYear()}`,
  };
}

/** Monday-to-Sunday bounds of the New York week containing a date. */
export function weekBounds(iso) {
  const d = fromISO(iso);
  const monday = addDays(d, -((d.getUTCDay() + 6) % 7));
  return { start: toISO(monday), end: toISO(addDays(monday, 6)) };
}

/**
 * Gate for scheduled runs. GitHub's cron is best-effort and can fire hours late, so the
 * question is never "is it 6am?" but "has this week's issue gone out yet?". The workflow
 * fires at many slots on Monday morning; the first one GitHub actually runs sends the
 * email, and every later slot sees the archive and stands down. Manual runs always proceed.
 */
export function shouldRunNow({ eventName, force = false, now = new Date(), timeZone = TZ, alreadySentThisWeek = false }) {
  const p = nyParts(now, timeZone);
  const clock = `${p.weekday} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} New York time`;
  if (force) return { run: true, reason: `FORCE is set (${clock})` };
  if (eventName !== "schedule") return { run: true, reason: `manual run: ${eventName} (${clock})` };
  if (alreadySentThisWeek) return { run: false, reason: `scheduled run at ${clock}; this week's issue already went out, skipping` };
  return { run: true, reason: `scheduled run at ${clock}; nothing sent yet this week, sending` };
}

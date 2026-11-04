import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";
import { weekBounds } from "./schedule.js";

export const ARCHIVE_DIR = path.join(ROOT, "archive");

function issueDirs(dir = ARCHIVE_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && fs.existsSync(path.join(dir, d, "issue.json")))
    .sort();
}

export function nextIssueNumber() {
  return issueDirs().length + 1;
}

/** True if an issue was already archived in the Monday-to-Sunday week containing `iso`. */
export function hasIssueInWeek(iso, dir = ARCHIVE_DIR) {
  const { start, end } = weekBounds(iso);
  return issueDirs(dir).some((d) => d >= start && d <= end);
}

const slim = (x) => ({
  headline: x.headline || x.title || "",
  title: x.title || "",
  url: x.url || "",
  venue: x.venue || "",
  category: x.category || "",
});

/**
 * The last N issues, newest first: headline lists for the curator's do-not-repeat block,
 * plus the fields the repeat ledger needs (venue, category, url) under `items`.
 */
export function readRecent(n = 8, dir = ARCHIVE_DIR) {
  return issueDirs(dir)
    .slice(-n)
    .reverse()
    .map((d) => {
      try {
        const issue = JSON.parse(fs.readFileSync(path.join(dir, d, "issue.json"), "utf8"));
        const titles = (arr) => (arr ?? []).map((x) => x.headline || x.title).filter(Boolean);
        const items = (arr) => (arr ?? []).filter(Boolean).map(slim);
        return {
          date: d,
          picks: titles(issue.picks),
          radar: titles(issue.radar),
          anytime: titles(issue.anytime),
          family: issue.family?.headline ?? null,
          items: { picks: items(issue.picks), radar: items(issue.radar), anytime: items(issue.anytime), family: items(issue.family ? [issue.family] : []) },
        };
      } catch {
        return { date: d, picks: [], radar: [], anytime: [], family: null, items: { picks: [], radar: [], anytime: [], family: [] } };
      }
    });
}

/**
 * What each research lane said it could not cover in the most recent issue. Lanes keep
 * running out of budget on the same venue calendars and reporting "hip-hop nights:
 * unsearched"; feeding that back means this week's lane starts from last week's gaps.
 */
export function readLaneMemory(dir = ARCHIVE_DIR) {
  const last = issueDirs(dir).at(-1);
  if (!last) return {};
  try {
    const research = JSON.parse(fs.readFileSync(path.join(dir, last, "research.json"), "utf8"));
    const out = {};
    for (const r of research.laneReports ?? []) if (r.lane && r.notes) out[r.lane] = { date: last, notes: String(r.notes) };
    return out;
  } catch {
    return {};
  }
}

export const normVenue = (v) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/\s*\(.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const normUrl = (u) =>
  String(u ?? "")
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
export const normTitle = (t) =>
  String(t ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The repeat ledger: how often each venue and category has carried a main pick in the
 * recent issues, and how many times each radar item has already run. The researchers
 * read it to look past the usual rooms, the curator reads it to stop sending them, and
 * sanitizeCuration uses it to retire radar items that have had their two mentions.
 */
export function repeatLedger(recent = []) {
  const venues = new Map();
  const categories = new Map();
  const radar = new Map();
  for (const issue of recent) {
    const seen = new Set();
    for (const p of issue.items?.picks ?? []) {
      const key = normVenue(p.venue);
      if (key) {
        const e = venues.get(key) ?? { name: String(p.venue).replace(/\s*\(.*$/, "").trim(), picks: 0, issues: 0, last: issue.date };
        e.picks += 1;
        if (!seen.has(key)) {
          e.issues += 1;
          seen.add(key);
        }
        venues.set(key, e);
      }
      if (p.category) categories.set(p.category, (categories.get(p.category) ?? 0) + 1);
    }
    for (const r of issue.items?.radar ?? []) {
      const u = normUrl(r.url);
      const t = normTitle(r.title);
      for (const key of [u && `url:${u}`, t && `t:${t}`].filter(Boolean)) {
        const e = radar.get(key) ?? { headline: r.headline || r.title, runs: 0, last: issue.date };
        e.runs += 1;
        radar.set(key, e);
      }
    }
  }
  const byCount = (a, b) => b[1].picks - a[1].picks || b[1].issues - a[1].issues;
  return {
    issues: recent.length,
    venues: [...venues.entries()].sort(byCount).map(([key, e]) => ({ key, ...e })),
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1]).map(([category, picks]) => ({ category, picks })),
    radar,
  };
}

/** How many times a candidate has already run on the radar, matched by URL or by title. */
export function radarRuns(ledger, candidate) {
  if (!ledger || !candidate) return 0;
  const u = normUrl(candidate.url);
  const t = normTitle(candidate.title);
  return Math.max(u ? (ledger.radar.get(`url:${u}`)?.runs ?? 0) : 0, t ? (ledger.radar.get(`t:${t}`)?.runs ?? 0) : 0);
}

/** The ledger as a prompt block; empty string when there is no history yet. */
export function formatLedger(ledger, { topVenues = 12 } = {}) {
  if (!ledger || !ledger.issues) return "";
  const n = (k, w) => `${k} ${w}${k === 1 ? "" : "s"}`;
  const lines = [`Over the last ${n(ledger.issues, "issue")}:`];
  const hot = ledger.venues.filter((v) => v.issues >= 2).slice(0, topVenues);
  if (hot.length) {
    lines.push("Venues that have already carried main picks more than once (picks, issues they appeared in, most recent):");
    for (const v of hot) lines.push(`- ${v.name}: ${n(v.picks, "pick")} in ${n(v.issues, "issue")}, last ${v.last}`);
  }
  const once = ledger.venues.filter((v) => v.issues === 1).map((v) => v.name);
  if (once.length) lines.push(`Venues used once: ${once.join("; ")}.`);
  if (ledger.categories.length) lines.push(`Main picks by category: ${ledger.categories.map((c) => `${c.category} ${c.picks}`).join(", ")}.`);
  // An item is keyed twice (url and title) and may match across weeks on either; report each once, at its higher count.
  const tired = new Map();
  for (const e of ledger.radar.values()) if (e.runs >= 2) tired.set(e.headline, Math.max(tired.get(e.headline) ?? 0, e.runs));
  if (tired.size) lines.push(`Radar items that have had their two mentions and are retired: ${[...tired].map(([h, r]) => `${h} (${r}x)`).join("; ")}.`);
  return lines.join("\n");
}

export function writeIssue({ issue, html, text, research, run, dir = ARCHIVE_DIR }) {
  const target = path.join(dir, issue.weekOf);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "issue.json"), JSON.stringify(issue, null, 2));
  fs.writeFileSync(path.join(target, "email.html"), html);
  fs.writeFileSync(path.join(target, "email.txt"), text);
  fs.writeFileSync(path.join(target, "research.json"), JSON.stringify(research, null, 2));
  fs.writeFileSync(path.join(target, "run.json"), JSON.stringify(run, null, 2));
  return target;
}

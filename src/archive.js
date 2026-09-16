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

/** Titles from the last N issues, for the curator's do-not-repeat list. */
export function readRecent(n = 8) {
  return issueDirs()
    .slice(-n)
    .reverse()
    .map((d) => {
      try {
        const issue = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, d, "issue.json"), "utf8"));
        const titles = (arr) => (arr ?? []).map((x) => x.headline || x.title).filter(Boolean);
        return { date: d, picks: titles(issue.picks), radar: titles(issue.radar), anytime: titles(issue.anytime), family: issue.family?.headline ?? null };
      } catch {
        return { date: d, picks: [], radar: [], anytime: [], family: null };
      }
    });
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

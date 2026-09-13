import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";

const PROFILE_DIR = path.join(ROOT, "profile");

export function readProfileFile(name) {
  const p = path.join(PROFILE_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

export function loadProfile() {
  return {
    konrad: readProfileFile("konrad.md"),
    music: readProfileFile("music.md"),
    calendar: readProfileFile("calendar.md"),
    feedback: readProfileFile("feedback.md"),
    instagram: readProfileFile("instagram.md"),
    sources: parseSources(readProfileFile("sources.md")),
  };
}

/**
 * sources.md is grouped by lane:
 *   ## music
 *   - Name | https://url | why it matters
 */
export function parseSources(md) {
  const out = {};
  let current = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^##\s+([a-z0-9_-]+)\s*$/i);
    if (heading) {
      current = heading[1].toLowerCase();
      out[current] ??= [];
      continue;
    }
    if (!current) continue;
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (!bullet) continue;
    const [name, url, note] = bullet[1].split("|").map((s) => s.trim());
    if (name && url && /^https?:\/\//i.test(url)) out[current].push({ name, url, note: note ?? "" });
  }
  return out;
}

/** Pull only the months that matter this run out of calendar.md. */
export function calendarForMonths(calendarMd, months) {
  const wanted = new Set(months.map((m) => m.toLowerCase()));
  const sections = calendarMd.split(/^## /m).slice(1);
  const kept = sections.filter((s) => wanted.has(s.split("\n")[0].trim().toLowerCase()));
  return kept.length ? kept.map((s) => `## ${s.trim()}`).join("\n\n") : "";
}

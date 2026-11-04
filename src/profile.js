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
    checklist: parseChecklist(readProfileFile("checklist.md")),
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

/**
 * profile/checklist.md is a long list of real names he rates Netflix-style. "- [x]" is a yes,
 * "- [-]" is a hard no, and once anything at all is ticked a blank box is a soft no (he saw the
 * name and did not tick it), reported compactly, names only. The ticks are a taste profile to
 * generalize from, not a whitelist; the prompt labels say so.
 * Notes after a ticked item are kept verbatim. Returns a prompt block, or "" for an
 * untouched list.
 */
export function parseChecklist(md) {
  const yes = [];
  const no = [];
  const blank = new Map();
  let section = "";
  for (const raw of String(md ?? "").split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1].replace(/^[A-Z]\.\s+/, "");
      continue;
    }
    const m = line.match(/^[-*]\s+\[([xX -])\]\s+(.+)$/);
    if (!m) continue;
    const text = m[2].replace(/^\d+[.)]\s*/, "").trim();
    if (!text) continue;
    const label = section ? `${section}: ${text}` : text;
    if (m[1] === "-") no.push(label);
    else if (m[1] === " ") {
      if (!blank.has(section)) blank.set(section, []);
      blank.get(section).push(text.replace(/\s*\(.*$/, "").trim());
    } else yes.push(label);
  }
  if (!yes.length && !no.length) return "";
  const block = (label, items) => (items.length ? `${label}\n${items.map((x) => `- ${x}`).join("\n")}` : "");
  const unticked = [...blank.entries()].filter(([, names]) => names.length).map(([sec, names]) => `- ${sec || "Other"}: ${names.join("; ")}`);
  return [
    block("Ticked YES (taste signal: find more in this register, on and off this list):", yes),
    block("Ticked NO (do not send this):", no),
    unticked.length ? `Left blank (soft no: he saw these and did not tick them; do not lead with them, and use the ticks to find things of the same kind that are not on the list):\n${unticked.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Pull only the months that matter this run out of calendar.md. */
export function calendarForMonths(calendarMd, months) {
  const wanted = new Set(months.map((m) => m.toLowerCase()));
  const sections = calendarMd.split(/^## /m).slice(1);
  const kept = sections.filter((s) => wanted.has(s.split("\n")[0].trim().toLowerCase()));
  return kept.length ? kept.map((s) => `## ${s.trim()}`).join("\n\n") : "";
}

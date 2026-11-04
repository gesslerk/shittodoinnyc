import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSources, calendarForMonths, loadProfile, parseChecklist } from "../src/profile.js";

test("parseSources groups by lane and ignores junk", () => {
  const md = `# Sources\n\n## music\n- RA | https://ra.co/x | listings\n- broken line without url\n\n## food\n* Eater | https://ny.eater.com/ |\n`;
  const s = parseSources(md);
  assert.deepEqual(Object.keys(s), ["music", "food"]);
  assert.equal(s.music.length, 1);
  assert.equal(s.music[0].note, "listings");
  assert.equal(s.food[0].note, "");
});

test("calendarForMonths pulls the right sections", () => {
  const md = `# Cal\n\n## September\n- a\n\n## October\n- b\n\n## November\n- c\n`;
  const out = calendarForMonths(md, ["October", "November"]);
  assert.match(out, /## October/);
  assert.match(out, /## November/);
  assert.doesNotMatch(out, /## September/);
});

test("the real profile loads and has every lane's sources", () => {
  const p = loadProfile();
  assert.ok(p.konrad.length > 2000);
  assert.ok(p.music.length > 1000);
  for (const lane of ["music", "food", "culture", "names", "body", "scenes"]) assert.ok(p.sources[lane]?.length > 3, `sources for ${lane}`);
  assert.equal(p.sources.fights, undefined, "the fights lane was cut in Nov 2026");
  assert.equal(typeof p.checklist, "string");
});

test("parseChecklist reads ticks, keeps notes, strips numbering, and reports blanks as no once anything is ticked", () => {
  const md = [
    "# Taste checklist",
    "- `- [x]` = yes",
    "## A. People you would see in a 300-seat room",
    "- [ ] 1. SNL alumni",
    "- [x] 2. Big-name comedians warming up (Mulaney yes)",
    "- [X] 3. Alt comedy",
    "## L. The usual suspects",
    "- [-] 176. DJ nights at Public Records",
    "## Open questions (answer in chat)",
    "1. The guys: how many?",
  ].join("\n");
  const out = parseChecklist(md);
  assert.match(out, /Ticked YES \(taste signal[^\n]*\):\n- People you would see in a 300-seat room: Big-name comedians warming up \(Mulaney yes\)\n- People you would see in a 300-seat room: Alt comedy/);
  assert.match(out, /Ticked NO \(do not send this\):\n- The usual suspects: DJ nights at Public Records/);
  assert.match(out, /Left blank \(soft no[^\n]*\n- People you would see in a 300-seat room: SNL alumni/);
  assert.doesNotMatch(out, /The guys/);
  assert.equal(parseChecklist(""), "");
  assert.equal(parseChecklist("- [ ] nothing ticked"), "");
});

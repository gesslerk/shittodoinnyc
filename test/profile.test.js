import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSources, calendarForMonths, loadProfile } from "../src/profile.js";

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
  for (const lane of ["music", "fights", "food", "culture", "body", "scenes"]) assert.ok(p.sources[lane]?.length > 3, `sources for ${lane}`);
});

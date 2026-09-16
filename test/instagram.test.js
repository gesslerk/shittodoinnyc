import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPostsForPrompt, parseHandles } from "../src/instagram.js";
import { stripLoneSurrogates } from "../src/claude.js";

const LONE_HIGH = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;

test("captions are cut on code points, never inside an emoji", () => {
  const caption = "a".repeat(699) + "🔥 THIS SAT 9/19 doors 9";
  const out = formatPostsForPrompt([{ account: "x", url: "https://instagram.com/p/1/", timestamp: "2026-09-10T00:00:00Z", caption }], { maxCaption: 700 });
  assert.doesNotMatch(out, LONE_HIGH);
  assert.match(out, /🔥…/);
});

test("stripLoneSurrogates removes only unpaired halves", () => {
  assert.equal(stripLoneSurrogates("ok 🔥 fine"), "ok 🔥 fine");
  assert.equal(stripLoneSurrogates("cut \uD83D here"), "cut  here");
  assert.equal(stripLoneSurrogates("\uDE00 stray low"), " stray low");
});

test("parseHandles reads the profile format", () => {
  const h = parseHandles("# x\n- @DaikokuNYC | cars\n- not a handle\n* @thelotradio\n");
  assert.deepEqual(h, [{ handle: "daikokunyc", note: "cars" }, { handle: "thelotradio", note: "" }]);
});

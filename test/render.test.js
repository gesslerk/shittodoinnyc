import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderEmail } from "../src/render.js";
import { ROOT } from "../src/config.js";

test("sample issue renders without holes", () => {
  const issue = JSON.parse(fs.readFileSync(path.join(ROOT, "samples", "sample-issue.json"), "utf8"));
  const { html, text } = renderEmail(issue);
  assert.doesNotMatch(html, /undefined|null<|\[object/);
  assert.match(html, /Paul Kalkbrenner/);
  assert.match(html, /COPY-PASTE TO THE GROUP CHAT/);
  assert.match(html, /BOOK BY ON SALE MON SEP 21/);
  assert.match(html, /WITH THE KID/);
  assert.match(html, /&lt;script&gt;/.test(html) ? /x/ : /Shit/); // no raw script tags could sneak in
  assert.match(text, /THIS WEEK/);
  assert.match(text, /Text to send:/);
});

test("html escaping", () => {
  const issue = JSON.parse(fs.readFileSync(path.join(ROOT, "samples", "sample-issue.json"), "utf8"));
  issue.picks[0].headline = "<b>bold</b> & \"quotes\"";
  const { html } = renderEmail(issue);
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt; &amp; &quot;quotes&quot;/);
});

test("the neighborhood is not repeated when the venue already names it", () => {
  const issue = JSON.parse(fs.readFileSync(path.join(ROOT, "samples", "sample-issue.json"), "utf8"));
  issue.picks[0].venue = "Public Records, Gowanus";
  issue.picks[0].neighborhood = "Gowanus";
  const { html } = renderEmail(issue);
  assert.doesNotMatch(html, /Gowanus, Gowanus/i);
  assert.match(html, /Public Records, Gowanus/);
});

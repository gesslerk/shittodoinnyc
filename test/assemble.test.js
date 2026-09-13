import { test } from "node:test";
import assert from "node:assert/strict";
import { assemble } from "../src/assemble.js";
import { sanitizeCuration } from "../src/curate.js";
import { filterCandidates, dedupeCandidates } from "../src/research.js";

const windows = {
  today: "2026-09-14",
  todayLabel: "September 14, 2026",
  weekOfLabel: "Week of Sep 14, 2026",
  thisWindow: { start: "2026-09-14", end: "2026-09-20" },
  radar: { start: "2026-09-21", end: "2026-11-01" },
  days: [],
  months: ["September"],
};

const cand = (id, extra = {}) => ({
  id,
  title: `Event ${id}`,
  category: "music",
  start_date: "2026-09-18",
  end_date: null,
  time_text: "9pm",
  recurring: false,
  anytime: false,
  venue: "Venue",
  neighborhood: "Bushwick",
  borough: "Brooklyn",
  price_text: "$20",
  url: `https://example.com/${id}`,
  source_url: "",
  summary: "s",
  fit: "f",
  confidence: "verified",
  who: "guys",
  tags: [],
  ...extra,
});

const pick = (candidate_id, extra = {}) => ({ candidate_id, headline: `H ${candidate_id}`, why: "w", heads_up: null, who: "guys", invite_text: "t", splurge: false, ...extra });

test("contradicted picks are dropped and the bench fills in", () => {
  const candidates = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((id) => cand(id));
  const curated = {
    subject: "s",
    opener: "o",
    picks: [pick("c1"), pick("c2"), pick("c3"), pick("c4"), pick("c5")],
    bench: [pick("c6"), pick("c7")],
    radar: [],
    anytime: [],
    family: null,
    notes: "n",
  };
  const verification = new Map([
    ["c2", { status: "contradicted", note: "cancelled" }],
    ["c3", { status: "unverifiable", note: "page down" }],
    ["c4", { status: "corrected", start_date: "2026-09-19", when_text: "Sat Sep 19, 8pm", note: "date was wrong" }],
  ]);
  const issue = assemble({ curated, candidates, verification, windows, issueNumber: 3 });
  assert.deepEqual(issue.picks.map((p) => p.id), ["c1", "c3", "c4", "c5", "c6"]);
  assert.match(issue.picks[1].heads_up, /Could not re-check/);
  assert.equal(issue.picks[2].when, "Sat Sep 19, 8pm");
  assert.equal(issue.picks[2].date, "2026-09-19");
  assert.equal(issue.stats.droppedPicks, 1);
  assert.equal(issue.stats.benched, 1);
  assert.match(issue.notes, /1 pick got cut/);
  assert.equal(issue.issue, 3);
});

test("the same candidate is never used twice across sections", () => {
  const candidates = ["c1", "c2", "c3", "c4", "c5", "c6"].map((id) => cand(id));
  const curated = {
    subject: "s",
    opener: "o",
    picks: [pick("c1"), pick("c2"), pick("c3"), pick("c4"), pick("c5")],
    bench: [],
    radar: [{ candidate_id: "c1", headline: "dup", why: "w", book_by: null, who: "guys" }, { candidate_id: "c6", headline: "r", why: "w", book_by: "now", who: "guys" }],
    anytime: [],
    family: null,
    notes: "",
  };
  const issue = assemble({ curated, candidates, windows });
  assert.deepEqual(issue.radar.map((r) => r.id), ["c6"]);
});

test("sanitizeCuration drops unknown ids and bench duplicates", () => {
  const candidates = ["c1", "c2"].map((id) => cand(id));
  const out = sanitizeCuration({ picks: [pick("c1"), pick("zzz")], bench: [pick("c1"), pick("c2")], radar: [], anytime: [], family: { candidate_id: "nope" }, subject: "x", opener: "", notes: "" }, candidates);
  assert.deepEqual(out.picks.map((p) => p.candidate_id), ["c1"]);
  assert.deepEqual(out.bench.map((p) => p.candidate_id), ["c2"]);
  assert.equal(out.family, null);
});

test("filterCandidates enforces urls and date windows", () => {
  const raw = [
    cand("a"),
    cand("b", { url: "not a url" }),
    cand("c", { start_date: "2026-09-01" }),
    cand("d", { start_date: "2026-12-25" }),
    cand("e", { start_date: null, anytime: true }),
    cand("f", { start_date: null, recurring: true }),
    cand("g", { start_date: "2026-09-10", end_date: "2026-09-30" }),
  ];
  const { kept, dropped } = filterCandidates(raw, windows);
  assert.deepEqual(kept.map((c) => c.id), ["a", "e", "f", "g"]);
  assert.equal(dropped.length, 3);
});

test("dedupeCandidates merges by url and by title+date, keeping the best-verified", () => {
  const list = [
    { ...cand("x", { lane: "music", confidence: "likely", tags: ["a"] }) },
    { ...cand("y", { lane: "food", confidence: "verified", tags: ["b"] }) , url: "https://example.com/x/" },
    { ...cand("z", { lane: "body", title: "Event x", start_date: "2026-09-18", url: "https://other.example/z", confidence: "unverified" }) },
  ];
  const out = dedupeCandidates(list);
  assert.equal(out.length, 1);
  assert.equal(out[0].confidence, "verified");
  assert.deepEqual(out[0].tags.sort(), ["a", "b"]);
  assert.deepEqual(out[0].lanes.sort(), ["body", "food", "music"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { assemble, whenText, composeSubject } from "../src/assemble.js";
import { applyVerification } from "../src/verify.js";
import { sanitizeCuration } from "../src/curate.js";
import { filterCandidates, dedupeCandidates, flagDateConflicts } from "../src/research.js";

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

test("contradicted picks are dropped, corrections are folded in, and the bench fills in", () => {
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
  const results = new Map([
    ["c2", { status: "contradicted", note: "cancelled" }],
    ["c3", { status: "unverifiable", note: "page down" }],
    ["c4", { status: "corrected", start_date: "2026-09-19", time_text: "8pm", price_text: null, venue: null, reader_note: "Date corrected: Saturday, not Friday.", note: "date was wrong" }],
  ]);
  const applied = applyVerification(candidates, results);
  assert.equal(applied.material, true);
  assert.equal(applied.changes.length, 2);
  assert.ok(!applied.candidates.some((c) => c.id === "c2"));
  assert.equal(applied.candidates.find((c) => c.id === "c4").start_date, "2026-09-19");

  const issue = assemble({ curated, candidates: applied.candidates, verification: results, windows, issueNumber: 3 });
  assert.deepEqual(issue.picks.map((p) => p.id), ["c1", "c3", "c4", "c5", "c6"]);
  assert.match(issue.picks[1].heads_up, /Could not re-check/);
  assert.equal(issue.picks[2].when, "Sat Sep 19, 8pm");
  assert.match(issue.picks[2].heads_up, /Date corrected/);
  assert.doesNotMatch(issue.picks[2].heads_up, /date was wrong/);
  assert.equal(issue.stats.droppedPicks, 1);
  assert.equal(issue.stats.benched, 1);
  assert.match(issue.notes, /1 pick got cut/);
  assert.equal(issue.issue, 3);
});

test("a fact-checked date turns an anytime listing into a dated event", () => {
  const candidates = [cand("c1", { anytime: true, start_date: null, time_text: "" })];
  const results = new Map([["c1", { status: "corrected", start_date: "2026-09-18", time_text: "7pm", price_text: "$65 to $150", venue: null, reader_note: null, note: "page shows a date" }]]);
  const { candidates: out, material, changes } = applyVerification(candidates, results);
  assert.equal(material, true);
  assert.equal(out[0].anytime, false);
  assert.equal(out[0].start_date, "2026-09-18");
  assert.equal(out[0].price_text, "$65 to $150");
  assert.match(changes[0], /was listed as anytime/);
});

test("whenText never repeats a date the time text already carries", () => {
  assert.equal(whenText(cand("a", { time_text: "doors 9pm" })), "Fri Sep 18, doors 9pm");
  assert.equal(whenText(cand("b", { time_text: "Fri Sep 18, doors 9pm" })), "Fri Sep 18, doors 9pm");
  assert.equal(whenText(cand("c", { time_text: "Saturday September 19; doors not listed" })), "Saturday September 19; doors not listed");
  assert.equal(whenText(cand("c2", { time_text: "Kickoff Saturday: seating 4 to 7pm" })), "Fri Sep 18, Kickoff Saturday: seating 4 to 7pm");
  assert.equal(whenText(cand("d", { time_text: "", end_date: "2026-10-31" })), "Fri Sep 18 to Sat Oct 31");
  assert.equal(whenText(cand("e", { anytime: true, start_date: null, time_text: "Daily 8am to 11pm" })), "Daily 8am to 11pm");
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

test("flagDateConflicts marks the same event reported on different dates", () => {
  const list = [
    cand("a", { title: "Erol Alkan & Justin Strauss", venue: "Public Records", start_date: "2026-09-17" }),
    cand("b", { title: "Erol Alkan, Justin Strauss at Public Records", venue: "Public Records", start_date: "2026-09-18" }),
    cand("c", { title: "Erol Alkan", venue: "Knockdown Center", start_date: "2026-09-18" }),
    cand("d", { title: "Theo Parrish", venue: "Nowadays", start_date: "2026-09-13" }),
  ];
  const flagged = flagDateConflicts(list);
  assert.equal(flagged, 2);
  assert.deepEqual(list[0].date_conflict, ["2026-09-17", "2026-09-18"]);
  assert.deepEqual(list[1].date_conflict, ["2026-09-17", "2026-09-18"]);
  assert.equal(list[2].date_conflict, undefined);
  assert.equal(list[3].date_conflict, undefined);
});

test("the subject's date comes from code, the hook from the curator", () => {
  const w = { ...windows, today: "2026-09-15" };
  assert.equal(composeSubject("Shit To Do in NYC (Sep 14): Erol Alkan, Berghain in Ridgewood", w), "Shit To Do in NYC (Sep 15): Erol Alkan, Berghain in Ridgewood");
  assert.equal(composeSubject("Kalkbrenner, a fight, a banya", w), "Shit To Do in NYC (Sep 15): Kalkbrenner, a fight, a banya");
  assert.equal(composeSubject("", w), "Shit To Do in NYC (Sep 15)");
});

// --- repeat ledger, radar retirement, one pick per venue -----------------------------------

import { repeatLedger, formatLedger, radarRuns } from "../src/archive.js";
import { buildLaneUser } from "../src/research.js";

const issueFixture = (date, picks, radar) => ({
  date,
  picks: picks.map((p) => p.title),
  radar: radar.map((r) => r.title),
  anytime: [],
  family: null,
  items: { picks, radar, anytime: [], family: [] },
});
const recentFixture = [
  issueFixture(
    "2026-11-02",
    [
      { headline: "Mousse T. in the Atrium", title: "Mousse T.", url: "https://x/1", venue: "Public Records", category: "music" },
      { headline: "B3K", title: "Brutalismus 3000", url: "https://x/2", venue: "Knockdown Center", category: "music" },
    ],
    [{ headline: "UFC 334 at the Garden", title: "UFC 334", url: "https://www.ufc.com/event/ufc-334?utm=1", venue: "MSG", category: "fight" }],
  ),
  issueFixture(
    "2026-10-26",
    [{ headline: "Dope Jams", title: "Dope Jams Halloween Ball", url: "https://x/3", venue: "Public Records (Sound Room)", category: "party" }],
    [{ headline: "UFC 334, two title fights", title: "UFC 334: Gane vs Hokit", url: "https://ufc.com/event/ufc-334/", venue: "MSG", category: "fight" }],
  ),
];

test("repeatLedger counts venues across issues and radar runs by url", () => {
  const ledger = repeatLedger(recentFixture);
  const pr = ledger.venues.find((v) => v.key === "public records");
  assert.equal(pr.picks, 2);
  assert.equal(pr.issues, 2);
  assert.equal(pr.last, "2026-11-02");
  assert.equal(ledger.venues.find((v) => v.key === "knockdown center").issues, 1);
  assert.deepEqual(ledger.categories, [{ category: "music", picks: 2 }, { category: "party", picks: 1 }]);
  assert.equal(radarRuns(ledger, { url: "https://www.ufc.com/event/ufc-334", title: "UFC 334 at MSG" }), 2);
  assert.equal(radarRuns(ledger, { url: "https://other", title: "ufc 334" }), 1);
  assert.equal(radarRuns(ledger, { url: "https://other", title: "nothing" }), 0);
  const text = formatLedger(ledger);
  assert.match(text, /Public Records: 2 picks in 2 issues, last 2026-11-02/);
  assert.match(text, /Venues used once: Knockdown Center/);
  assert.match(text, /retired: UFC 334/);
  assert.equal(formatLedger(repeatLedger([])), "");
});

test("sanitizeCuration keeps one pick per venue, benches the second, and retires a radar item that ran twice", () => {
  const candidates = [
    cand("c1", { venue: "Public Records" }),
    cand("c2", { venue: "Public Records (Sound Room)" }),
    cand("c3", { venue: "Union Hall" }),
    cand("c4", { url: "https://www.ufc.com/event/ufc-334", title: "UFC 334", start_date: "2026-11-14" }),
    cand("c5", { start_date: "2026-11-20" }),
  ];
  const pick = (id) => ({ candidate_id: id, headline: "h", why: "w", heads_up: null, who: "guys", invite_text: "t", splurge: false });
  const radar = (id) => ({ candidate_id: id, headline: "h", why: "w", book_by: null, who: "guys" });
  const raw = { subject: "s", opener: "o", picks: [pick("c1"), pick("c2"), pick("c3")], bench: [pick("c2"), pick("c5")], radar: [radar("c4"), radar("c5")], anytime: [], family: null, notes: "" };
  const out = sanitizeCuration(raw, candidates, { ledger: repeatLedger(recentFixture) });
  assert.deepEqual(out.picks.map((p) => p.candidate_id), ["c1", "c3"]);
  assert.deepEqual(out.bench.map((p) => p.candidate_id), ["c2", "c5"]);
  assert.deepEqual(out.radar.map((r) => r.candidate_id), ["c5"]);
  // without a ledger the radar is left alone
  assert.deepEqual(sanitizeCuration(raw, candidates).radar.map((r) => r.candidate_id), ["c4", "c5"]);
});

test("buildLaneUser separates search-only sources, caps trusted fetches, and carries the ledger and lane memory", () => {
  const lane = { id: "music", name: "Music", brief: "Find shows.", hints: ["x"], maxSearches: 18, maxFetches: 14 };
  const sources = [
    { name: "RA", url: "https://ra.co/x", note: "listings" },
    { name: "Knockdown", url: "https://knockdown.center/", note: "warehouse; search only, page will not load" },
  ];
  const w = { ...windows, days: ["Mon Sep 14 (2026-09-14)"] };
  const text = buildLaneUser({ lane, sources, windows: w, calendarExcerpt: "", feedback: "", ledgerText: "Public Records: 7 picks", laneMemory: { date: "2026-11-02", notes: "hip-hop nights: unsearched" } });
  assert.match(text, /fetch at most 7 of these/);
  assert.match(text, /# SEARCH-ONLY SOURCES[\s\S]*Knockdown/);
  assert.doesNotMatch(text, /# TRUSTED SOURCES[^#]*Knockdown/);
  assert.match(text, /ALREADY BEEN SENT[\s\S]*Public Records: 7 picks/);
  assert.match(text, /COULD NOT COVER LAST WEEK \(2026-11-02\)[\s\S]*hip-hop nights: unsearched/);
  const bare = buildLaneUser({ lane, sources: [], windows: w, calendarExcerpt: "", feedback: "" });
  assert.doesNotMatch(bare, /ALREADY BEEN SENT|COULD NOT COVER|SEARCH-ONLY/);
});

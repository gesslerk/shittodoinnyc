import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWindows, shouldRunNow, formatShort } from "../src/schedule.js";

test("windows from a Monday run", () => {
  const w = computeWindows(new Date("2026-09-14T10:00:00Z"));
  assert.equal(w.today, "2026-09-14");
  assert.deepEqual(w.thisWindow, { start: "2026-09-14", end: "2026-09-20" });
  assert.deepEqual(w.radar, { start: "2026-09-21", end: "2026-11-01" });
  assert.equal(w.days.length, 7);
  assert.deepEqual(w.months, ["September", "October", "November"]);
  assert.equal(w.weekOfLabel, "Week of Sep 14, 2026");
});

test("a Saturday test run rolls the window to the following Sunday", () => {
  const w = computeWindows(new Date("2026-09-12T15:00:00Z"));
  assert.equal(w.today, "2026-09-12");
  assert.equal(w.thisWindow.end, "2026-09-20");
});

test("late Sunday night UTC is still Sunday in New York", () => {
  const w = computeWindows(new Date("2026-09-14T02:30:00Z"));
  assert.equal(w.today, "2026-09-13");
});

test("6am gate picks the right UTC cron in summer and winter", () => {
  const run = (iso) => shouldRunNow({ eventName: "schedule", now: new Date(iso) }).run;
  assert.equal(run("2026-09-14T10:00:00Z"), true, "EDT: 10:00 UTC is 6am");
  assert.equal(run("2026-09-14T11:00:00Z"), false, "EDT: 11:00 UTC is 7am");
  assert.equal(run("2027-01-11T11:00:00Z"), true, "EST: 11:00 UTC is 6am");
  assert.equal(run("2027-01-11T10:00:00Z"), false, "EST: 10:00 UTC is 5am");
  assert.equal(run("2026-09-14T10:25:00Z"), true, "a delayed cron inside the hour still runs");
});

test("manual and forced runs ignore the gate", () => {
  assert.equal(shouldRunNow({ eventName: "workflow_dispatch", now: new Date("2026-09-14T15:00:00Z") }).run, true);
  assert.equal(shouldRunNow({ eventName: "schedule", force: true, now: new Date("2026-09-14T15:00:00Z") }).run, true);
});

test("formatting", () => {
  assert.equal(formatShort("2026-09-17"), "Thu Sep 17");
});

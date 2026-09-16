import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWindows, shouldRunNow, formatShort, weekBounds } from "../src/schedule.js";
import { hasIssueInWeek } from "../src/archive.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

test("a scheduled run sends whenever GitHub gets around to it, once per week", () => {
  const late = new Date("2026-09-14T16:12:00Z"); // GitHub fired the 6am slot at 12:12pm New York
  assert.equal(shouldRunNow({ eventName: "schedule", now: late, alreadySentThisWeek: false }).run, true);
  assert.equal(shouldRunNow({ eventName: "schedule", now: late, alreadySentThisWeek: true }).run, false);
  assert.equal(shouldRunNow({ eventName: "schedule", now: new Date("2027-01-11T10:05:00Z"), alreadySentThisWeek: false }).run, true);
});

test("weekBounds is Monday to Sunday in New York", () => {
  assert.deepEqual(weekBounds("2026-09-14"), { start: "2026-09-14", end: "2026-09-20" });
  assert.deepEqual(weekBounds("2026-09-16"), { start: "2026-09-14", end: "2026-09-20" });
  assert.deepEqual(weekBounds("2026-09-20"), { start: "2026-09-14", end: "2026-09-20" });
  assert.deepEqual(weekBounds("2026-09-21"), { start: "2026-09-21", end: "2026-09-27" });
});

test("hasIssueInWeek reads the archive by week", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stdnyc-"));
  fs.mkdirSync(path.join(dir, "2026-09-14"));
  fs.writeFileSync(path.join(dir, "2026-09-14", "issue.json"), "{}");
  fs.mkdirSync(path.join(dir, "2026-09-21")); // no issue.json: an aborted run leaves no claim
  assert.equal(hasIssueInWeek("2026-09-14", dir), true);
  assert.equal(hasIssueInWeek("2026-09-15", dir), true, "a Tuesday retry after a Monday send is a no-op");
  assert.equal(hasIssueInWeek("2026-09-21", dir), false);
  assert.equal(hasIssueInWeek("2026-09-13", dir), false, "the previous week is a different week");
});

test("manual and forced runs ignore the gate", () => {
  assert.equal(shouldRunNow({ eventName: "workflow_dispatch", now: new Date("2026-09-14T15:00:00Z") }).run, true);
  assert.equal(shouldRunNow({ eventName: "schedule", force: true, now: new Date("2026-09-14T15:00:00Z") }).run, true);
});

test("formatting", () => {
  assert.equal(formatShort("2026-09-17"), "Thu Sep 17");
});

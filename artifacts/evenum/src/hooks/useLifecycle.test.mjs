import assert from "node:assert/strict";
import { test } from "node:test";
import { getCountdownValue, getElectionCountdown, getLifecycleState } from "./useLifecycle.ts";

const now = Date.parse("2026-10-22T12:00:00.000Z");

test("election countdown targets the opening time before an election starts", () => {
  const result = getElectionCountdown(
    "2026-10-23T12:00:00.000Z",
    "2026-10-24T12:00:00.000Z",
    now,
  );

  assert.equal(result.lifecycleState, "upcoming");
  assert.equal(result.targetDate, "2026-10-23T12:00:00.000Z");
  assert.equal(result.countdown.days, 1);
  assert.equal(result.countdown.hasTarget, true);
});

test("election countdown targets the closing time while voting is live", () => {
  const result = getElectionCountdown(
    "2026-10-21T12:00:00.000Z",
    "2026-10-23T12:00:00.000Z",
    now,
  );

  assert.equal(result.lifecycleState, "live");
  assert.equal(result.targetDate, "2026-10-23T12:00:00.000Z");
  assert.equal(result.countdown.days, 1);
});

test("ended and missing or invalid schedules do not produce a misleading countdown", () => {
  const ended = getElectionCountdown(
    "2026-10-20T12:00:00.000Z",
    "2026-10-22T11:59:59.000Z",
    now,
  );
  const missing = getElectionCountdown(null, null, now);
  const invalid = getCountdownValue("not-a-date", now);

  assert.equal(ended.lifecycleState, "ended");
  assert.equal(ended.countdown.hasTarget, false);
  assert.equal(missing.countdown.hasTarget, false);
  assert.equal(invalid.hasTarget, false);
  assert.equal(invalid.expired, true);
  assert.equal(getLifecycleState("not-a-date", "not-a-date", now), "live");
});

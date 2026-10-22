import assert from "node:assert/strict";
import { test } from "node:test";
import { getEventRegistrationBlockReason } from "./event-registration-lifecycle.ts";

test("published events accept registration before the scheduled event start", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  const event = {
    status: "published",
    startsAt: new Date("2026-11-05T12:00:00.000Z"),
    endsAt: new Date("2026-11-05T18:00:00.000Z"),
  };

  assert.equal(getEventRegistrationBlockReason(event.status, event.endsAt, now), null);
});

test("unpublished events do not accept registration", () => {
  assert.equal(
    getEventRegistrationBlockReason("draft", "2026-11-05T18:00:00.000Z", new Date("2026-10-22T12:00:00.000Z")),
    "unavailable",
  );
});

test("registration closes exactly at the event end time", () => {
  const deadline = new Date("2026-10-22T12:00:00.000Z");
  assert.equal(getEventRegistrationBlockReason("published", deadline, deadline), "closed");
});

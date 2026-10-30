import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EVENT_INVITE_VERIFICATION_TTL_MS,
  addEventInviteVerification,
  hasEventInviteVerification,
} from "./event-invite-verification.ts";

test("an event verification is scoped to one event and expires", () => {
  const now = 1_000_000;
  const verifications = addEventInviteVerification(undefined, 42, now);

  assert.equal(hasEventInviteVerification(verifications, 42, now + 1), true);
  assert.equal(hasEventInviteVerification(verifications, 43, now + 1), false);
  assert.equal(hasEventInviteVerification(verifications, 42, now + EVENT_INVITE_VERIFICATION_TTL_MS + 1), false);
});

test("adding an event verification removes expired entries without retaining invite secrets", () => {
  const now = 1_000_000;
  const verifications = addEventInviteVerification({ "1": now - EVENT_INVITE_VERIFICATION_TTL_MS - 1 }, 2, now);

  assert.deepEqual(verifications, { "2": now });
});

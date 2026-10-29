import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ELECTION_INVITE_VERIFICATION_TTL_MS,
  addElectionInviteVerification,
  hasElectionInviteVerification,
} from "./election-invite-verification.ts";

test("an election verification is scoped to one election and expires", () => {
  const now = 1_000_000;
  const verifications = addElectionInviteVerification(undefined, 42, now);

  assert.equal(hasElectionInviteVerification(verifications, 42, now + 1), true);
  assert.equal(hasElectionInviteVerification(verifications, 43, now + 1), false);
  assert.equal(hasElectionInviteVerification(verifications, 42, now + ELECTION_INVITE_VERIFICATION_TTL_MS + 1), false);
});

test("adding a verification removes expired entries without retaining invite secrets", () => {
  const now = 1_000_000;
  const verifications = addElectionInviteVerification({ "1": now - ELECTION_INVITE_VERIFICATION_TTL_MS - 1 }, 2, now);

  assert.deepEqual(verifications, { "2": now });
});

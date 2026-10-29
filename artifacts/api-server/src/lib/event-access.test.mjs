import assert from "node:assert/strict";
import { test } from "node:test";
import { canReadEvent } from "./event-access.ts";

test("a valid invite code opens only a non-draft invite-only event", () => {
  assert.equal(canReadEvent("invite_only", "published", false, true), true);
  assert.equal(canReadEvent("invite_only", "draft", false, true), false);
  assert.equal(canReadEvent("private", "published", false, true), false);
  assert.equal(canReadEvent("invite_only", "published", false, false), false);
  assert.equal(canReadEvent("private", "published", true, false), true);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { canViewElectionResults } from "./election-access.ts";

test("published public election results are visible without an organization account", () => {
  assert.equal(canViewElectionResults("public", "active", false), true);
  assert.equal(canViewElectionResults("public", "completed", false), true);
});

test("draft public results are hidden from non-members", () => {
  assert.equal(canViewElectionResults("public", "draft", false), false);
  assert.equal(canViewElectionResults("public", "draft", true), true);
});

test("private and invite-only results require organization access", () => {
  for (const visibility of ["private", "invite_only"]) {
    assert.equal(canViewElectionResults(visibility, "active", false), false);
    assert.equal(canViewElectionResults(visibility, "active", true), true);
  }
});

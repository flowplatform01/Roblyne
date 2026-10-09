import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyBootstrapCode } from "./bootstrap-code.ts";

test("accepts a matching high-entropy setup code", () => {
  const code = "a".repeat(32);
  assert.equal(verifyBootstrapCode(code, code), true);
});

test("rejects missing, short, and mismatched setup codes", () => {
  const code = "b".repeat(32);
  assert.equal(verifyBootstrapCode(undefined, code), false);
  assert.equal(verifyBootstrapCode("short", "short"), false);
  assert.equal(verifyBootstrapCode(code, "c".repeat(32)), false);
});

test("rejects non-string and oversized setup-code input", () => {
  const code = "d".repeat(32);
  assert.equal(verifyBootstrapCode(code, null), false);
  assert.equal(verifyBootstrapCode(code, "e".repeat(513)), false);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionCookieOptions } from "./session-cookie.ts";

test("production sessions use secure partitioned cross-site cookies", () => {
  assert.deepEqual(sessionCookieOptions(true), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    partitioned: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
});

test("development sessions retain same-site local behavior", () => {
  assert.deepEqual(sessionCookieOptions(false), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    partitioned: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
});

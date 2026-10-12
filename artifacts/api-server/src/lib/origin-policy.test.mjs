import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCorsOriginAllowed,
  isWriteRequestOriginAllowed,
  parseCorsAllowedOrigins,
} from "./origin-policy.ts";

test("CORS allowlist accepts exact HTTP(S) origins and normalizes a trailing slash", () => {
  const allowed = parseCorsAllowedOrigins(" https://app.example/, http://localhost:5173 ");
  assert.deepEqual([...allowed], ["https://app.example", "http://localhost:5173"]);
});

test("CORS allowlist rejects wildcards, paths, and non-web origins", () => {
  for (const value of ["*", "https://app.example/admin", "file://app.example"]) {
    assert.throws(() => parseCorsAllowedOrigins(value), /Invalid CORS_ALLOWED_ORIGINS/);
  }
});

test("CORS reflects only explicitly configured origins", () => {
  const allowed = parseCorsAllowedOrigins("https://app.example");
  assert.equal(isCorsOriginAllowed("https://app.example", allowed), true);
  assert.equal(isCorsOriginAllowed("https://attacker.example", allowed), false);
  assert.equal(isCorsOriginAllowed(undefined, allowed), false);
});

test("write requests accept same-origin and explicitly allowed origins only", () => {
  const allowed = parseCorsAllowedOrigins("https://trusted.example");
  const check = (origin, requestOrigin = "https://evenum.example") => isWriteRequestOriginAllowed({
    method: "POST",
    origin,
    requestOrigin,
    secFetchSite: "same-origin",
    allowedOrigins: allowed,
  });

  assert.equal(check("https://evenum.example"), true);
  assert.equal(check("https://trusted.example"), true);
  assert.equal(check("https://attacker.example"), false);
  assert.equal(check("null"), false);
});

test("write requests reject browser-marked cross-site requests without Origin but allow server clients", () => {
  const allowed = parseCorsAllowedOrigins("");
  const check = secFetchSite => isWriteRequestOriginAllowed({
    method: "POST",
    origin: undefined,
    requestOrigin: "https://evenum.example",
    secFetchSite,
    allowedOrigins: allowed,
  });

  assert.equal(check("cross-site"), false);
  assert.equal(check(undefined), true);
});

test("safe requests are not rejected by the write-origin guard", () => {
  assert.equal(isWriteRequestOriginAllowed({
    method: "GET",
    origin: "https://attacker.example",
    requestOrigin: "https://evenum.example",
    secFetchSite: "cross-site",
    allowedOrigins: new Set(),
  }), true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { isQueueReady } from "./queue-readiness.ts";

test("optional queue does not block readiness", () => {
  assert.equal(isQueueReady({ required: false, enabled: false, workerHealthy: null }), true);
  assert.equal(isQueueReady({ required: false, enabled: true, workerHealthy: false }), true);
});

test("required queue needs Redis-backed scheduling and a healthy worker", () => {
  assert.equal(isQueueReady({ required: true, enabled: false, workerHealthy: null }), false);
  assert.equal(isQueueReady({ required: true, enabled: true, workerHealthy: false }), false);
  assert.equal(isQueueReady({ required: true, enabled: true, workerHealthy: null }), false);
  assert.equal(isQueueReady({ required: true, enabled: true, workerHealthy: true }), true);
});

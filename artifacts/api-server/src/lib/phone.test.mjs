import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCameroonPhone, maskPhoneNumber } from "./phone.ts";

test("normalizes 9-digit local Cameroon mobile numbers to E.164", () => {
  assert.equal(normalizeCameroonPhone("0671234567"), "+237671234567");
  assert.equal(normalizeCameroonPhone("671234567"), "+237671234567");
  assert.equal(normalizeCameroonPhone("699887766"), "+237699887766");
  assert.equal(normalizeCameroonPhone("650112233"), "+237650112233");
  assert.equal(normalizeCameroonPhone("222112233"), "+237222112233");
});

test("normalizes prefixed Cameroon phone numbers with delimiters", () => {
  assert.equal(normalizeCameroonPhone("+237 671-23-45-67"), "+237671234567");
  assert.equal(normalizeCameroonPhone("237 699 88 77 66"), "+237699887766");
  assert.equal(normalizeCameroonPhone("00237 650 (11) 22-33"), "+237650112233");
  assert.equal(normalizeCameroonPhone("+237671234567"), "+237671234567");
});

test("normalizes international E.164 numbers", () => {
  assert.equal(normalizeCameroonPhone("+14155552671"), "+14155552671");
  assert.equal(normalizeCameroonPhone("+33 6 12 34 56 78"), "+33612345678");
});

test("rejects invalid, empty, or malformed phone numbers", () => {
  assert.equal(normalizeCameroonPhone(""), null);
  assert.equal(normalizeCameroonPhone("   "), null);
  assert.equal(normalizeCameroonPhone(undefined), null);
  assert.equal(normalizeCameroonPhone(null), null);
  assert.equal(normalizeCameroonPhone("12345"), null);
  assert.equal(normalizeCameroonPhone("not-a-phone"), null);
  assert.equal(normalizeCameroonPhone("67123456"), null); // 8 digits (too short)
  assert.equal(normalizeCameroonPhone("6712345678"), null); // 10 digits without +237
});

test("masks phone numbers safely for logging", () => {
  assert.equal(maskPhoneNumber("+237671234567"), "+237 6*** **67");
  assert.equal(maskPhoneNumber("+14155552671"), "+14****71");
  assert.equal(maskPhoneNumber(""), "[not-provided]");
  assert.equal(maskPhoneNumber(undefined), "[not-provided]");
});

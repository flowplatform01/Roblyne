import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgres://roblyne_test:roblyne_test@127.0.0.1:5432/roblyne_test";

const { closeDatabasePool } = await import("@workspace/db");
const {
  defaultLegalDocuments,
  legalDocumentTypes,
  missingDefaultLegalDocuments,
} = await import("./default-legal-documents.ts");

test("ships complete initial Terms and Privacy documents", () => {
  assert.deepEqual(defaultLegalDocuments.map((document) => document.documentType), [...legalDocumentTypes]);
  for (const document of defaultLegalDocuments) {
    assert.ok(document.title.length >= 12);
    assert.ok(document.content.length >= 2_000);
    assert.match(document.content, /qualified legal counsel/i);
  }
  assert.match(defaultLegalDocuments[0].content, /PAYMENTS, FEES AND WITHDRAWALS/);
  assert.match(defaultLegalDocuments[0].content, /ELECTIONS, EVENTS AND CAMPAIGNS/);
  assert.match(defaultLegalDocuments[1].content, /INFORMATION WE COLLECT/);
  assert.match(defaultLegalDocuments[1].content, /YOUR CHOICES AND RIGHTS/);
});

test("only seeds a document type that has no usable published policy", () => {
  assert.deepEqual(missingDefaultLegalDocuments([]).map((document) => document.documentType), ["terms", "privacy"]);
  assert.deepEqual(missingDefaultLegalDocuments([{ documentType: "terms" }]).map((document) => document.documentType), ["privacy"]);
  assert.deepEqual(missingDefaultLegalDocuments([{ documentType: "terms" }, { documentType: "privacy" }]), []);
});

test.after(async () => {
  await closeDatabasePool();
});

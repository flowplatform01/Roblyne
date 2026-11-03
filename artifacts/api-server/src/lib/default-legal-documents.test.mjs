import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgres://roblyne_test:roblyne_test@127.0.0.1:5432/roblyne_test";

const { closeDatabasePool } = await import("@workspace/db");
const {
  defaultLegalDocuments,
  missingDefaultLegalDocuments,
} = await import("./default-legal-documents.ts");

function key(document) {
  return `${document.documentType}:${document.language}`;
}

test("ships complete initial Terms and Privacy documents in English and French", () => {
  assert.deepEqual(defaultLegalDocuments.map(key), ["terms:en", "privacy:en", "terms:fr", "privacy:fr"]);
  for (const document of defaultLegalDocuments) {
    assert.ok(document.title.length >= 12);
    assert.ok(document.content.length >= 2_000);
  }

  const english = defaultLegalDocuments.filter((document) => document.language === "en");
  const french = defaultLegalDocuments.filter((document) => document.language === "fr");
  for (const document of english) assert.match(document.content, /qualified legal counsel/i);
  for (const document of french) assert.match(document.content, /conseil juridique qualifié/i);

  const englishTerms = english.find((document) => document.documentType === "terms");
  const englishPrivacy = english.find((document) => document.documentType === "privacy");
  assert.match(englishTerms.content, /PAYMENTS, FEES AND WITHDRAWALS/);
  assert.match(englishTerms.content, /ELECTIONS, EVENTS AND CAMPAIGNS/);
  assert.match(englishPrivacy.content, /INFORMATION WE COLLECT/);
  assert.match(englishPrivacy.content, /YOUR CHOICES AND RIGHTS/);

  const frenchTerms = french.find((document) => document.documentType === "terms");
  const frenchPrivacy = french.find((document) => document.documentType === "privacy");
  assert.match(frenchTerms.content, /PAIEMENTS, FRAIS ET RETRAITS/);
  assert.match(frenchTerms.content, /ÉLECTIONS, ÉVÉNEMENTS ET CAMPAGNES/);
  assert.match(frenchPrivacy.content, /INFORMATIONS QUE NOUS COLLECTONS/);
  assert.match(frenchPrivacy.content, /VOS CHOIX ET VOS DROITS/);
});

test("only seeds a document type and language that has no usable published policy", () => {
  assert.deepEqual(missingDefaultLegalDocuments([]).map(key), ["terms:en", "privacy:en", "terms:fr", "privacy:fr"]);
  assert.deepEqual(missingDefaultLegalDocuments([{ documentType: "terms", language: "en" }]).map(key), ["privacy:en", "terms:fr", "privacy:fr"]);
  assert.deepEqual(missingDefaultLegalDocuments([
    { documentType: "terms", language: "en" },
    { documentType: "privacy", language: "en" },
    { documentType: "terms", language: "fr" },
    { documentType: "privacy", language: "fr" },
  ]), []);
});

test.after(async () => {
  await closeDatabasePool();
});

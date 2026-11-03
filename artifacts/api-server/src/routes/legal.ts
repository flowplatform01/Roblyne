import { Router, type IRouter } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, legalAcceptancesTable, legalDocumentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { requirePlatformAdmin } from "../middlewares/platformAdmin";
import {
  defaultLegalLanguage,
  legalDocumentTypes,
  normalizeLegalLanguage,
  publishedLegalDocumentsWithDefaults,
  resolveLegalDocument,
  unacceptedDocumentTypes,
  unpublishedDocumentTypes,
  type LegalDocumentLanguage,
} from "../lib/default-legal-documents";

const router: IRouter = Router();
const legalTypes = legalDocumentTypes;
type LegalType = (typeof legalTypes)[number];

function isLegalType(value: unknown): value is LegalType {
  return typeof value === "string" && legalTypes.includes(value as LegalType);
}

function requestedLanguage(value: unknown): LegalDocumentLanguage {
  return normalizeLegalLanguage(value) ?? defaultLegalLanguage;
}

function formatDocument(document: typeof legalDocumentsTable.$inferSelect) {
  return {
    id: document.id,
    documentType: document.documentType,
    language: document.language,
    title: document.title,
    content: document.content,
    version: document.version,
    status: document.status,
    effectiveAt: document.effectiveAt,
    requiresReacceptance: document.requiresReacceptance,
    publishedAt: document.publishedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

router.get("/legal/requirements", async (req, res): Promise<void> => {
  const language = requestedLanguage(req.query.lang);
  const documents = await publishedLegalDocumentsWithDefaults();
  const resolved = legalTypes
    .map((documentType) => resolveLegalDocument(documents, documentType, language))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  res.json({
    requestedLanguage: language,
    documents: resolved.map((entry) => ({ ...formatDocument(entry.document), languageFallback: entry.languageFallback })),
    missingDocumentTypes: unpublishedDocumentTypes(documents),
  });
});

router.get("/legal/:documentType", async (req, res): Promise<void> => {
  if (!isLegalType(req.params.documentType)) {
    res.status(404).json({ error: "Legal document not found" });
    return;
  }
  const language = requestedLanguage(req.query.lang);
  const documents = await publishedLegalDocumentsWithDefaults();
  const resolved = resolveLegalDocument(documents, req.params.documentType, language);
  if (!resolved) {
    res.status(404).json({ error: "This legal document has not been published" });
    return;
  }
  res.json({
    ...formatDocument(resolved.document),
    requestedLanguage: language,
    languageFallback: resolved.languageFallback,
  });
});

router.get("/auth/legal-status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const language = requestedLanguage(req.query.lang);
  const documents = await publishedLegalDocumentsWithDefaults();
  const accepted = await db.select({
    legalDocumentId: legalAcceptancesTable.legalDocumentId,
    documentType: legalAcceptancesTable.documentType,
  })
    .from(legalAcceptancesTable)
    .where(eq(legalAcceptancesTable.userId, userId));
  const acceptedIds = accepted.map((row) => row.legalDocumentId);
  const acceptedTypes = accepted.map((row) => row.documentType);
  const outstanding = unacceptedDocumentTypes(documents, acceptedIds, acceptedTypes)
    .map((documentType) => resolveLegalDocument(documents, documentType, language))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  res.json({
    requestedLanguage: language,
    required: outstanding.length > 0,
    documents: outstanding.map((entry) => ({ ...formatDocument(entry.document), languageFallback: entry.languageFallback })),
  });
});

router.post("/auth/legal-acceptances", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const documentIds: number[] = Array.isArray(req.body?.documentIds) ? req.body.documentIds.map(Number) : [];
  if (!documentIds.length || documentIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    res.status(400).json({ error: "Select each required legal document" });
    return;
  }
  const documents = await publishedLegalDocumentsWithDefaults();
  const acceptedIds = new Set(documentIds);
  const missing = legalTypes.filter((documentType) => {
    const current = documents.filter((document) => document.documentType === documentType);
    return current.length > 0 && !current.some((document) => acceptedIds.has(document.id));
  });
  if (missing.length > 0) {
    res.status(400).json({ error: "Accept each current legal document" });
    return;
  }
  const acceptedDocuments = documents.filter((document) => acceptedIds.has(document.id));
  await db.insert(legalAcceptancesTable).values(acceptedDocuments.map((document) => ({
    userId,
    legalDocumentId: document.id,
    documentType: document.documentType,
    documentVersion: document.version,
  }))).onConflictDoNothing();
  res.status(201).json({ message: "Legal documents accepted" });
});

router.use("/admin/legal-documents", requirePlatformAdmin);

router.get("/admin/legal-documents", async (_req, res): Promise<void> => {
  const documents = await db.select().from(legalDocumentsTable)
    .orderBy(asc(legalDocumentsTable.documentType), asc(legalDocumentsTable.language), desc(legalDocumentsTable.version));
  res.json(documents.map(formatDocument));
});

router.post("/admin/legal-documents", async (req, res): Promise<void> => {
  const { documentType, title, content, requiresReacceptance = false } = req.body ?? {};
  const language = normalizeLegalLanguage(req.body?.language) ?? defaultLegalLanguage;
  if (!isLegalType(documentType) || typeof title !== "string" || title.trim().length < 3 || typeof content !== "string") {
    res.status(400).json({ error: "Provide a document type, language, title, and draft content" });
    return;
  }
  const [{ nextVersion }] = await db.select({ nextVersion: sql<number>`COALESCE(MAX(${legalDocumentsTable.version}), 0) + 1` })
    .from(legalDocumentsTable)
    .where(and(eq(legalDocumentsTable.documentType, documentType), eq(legalDocumentsTable.language, language)));
  const [created] = await db.insert(legalDocumentsTable).values({
    documentType,
    language,
    title: title.trim().slice(0, 180),
    content: content.slice(0, 100_000),
    version: Number(nextVersion),
    requiresReacceptance: requiresReacceptance === true,
    createdByUserId: req.session.userId,
  }).returning();
  res.status(201).json(formatDocument(created));
});

router.patch("/admin/legal-documents/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid legal document" });
    return;
  }
  const [existing] = await db.select().from(legalDocumentsTable).where(eq(legalDocumentsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Legal document not found" });
    return;
  }
  if (existing.status !== "draft") {
    res.status(409).json({ error: "Published documents are immutable. Create a new draft version." });
    return;
  }
  const body = req.body ?? {};
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string") updates.title = body.title.trim().slice(0, 180);
  if (typeof body.content === "string") updates.content = body.content.slice(0, 100_000);
  if (typeof body.requiresReacceptance === "boolean") updates.requiresReacceptance = body.requiresReacceptance;
  const [updated] = await db.update(legalDocumentsTable).set(updates).where(eq(legalDocumentsTable.id, id)).returning();
  res.json(formatDocument(updated));
});

router.post("/admin/legal-documents/:id/publish", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const effectiveAt = req.body?.effectiveAt ? new Date(req.body.effectiveAt) : new Date();
  if (!Number.isInteger(id) || id <= 0 || Number.isNaN(effectiveAt.getTime())) {
    res.status(400).json({ error: "Provide a valid legal document and effective date" });
    return;
  }
  if (effectiveAt.getTime() > Date.now() + 60_000) {
    res.status(400).json({ error: "Future-effective documents are not supported. Publish when the document is ready to take effect." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [draft] = await tx.select().from(legalDocumentsTable).where(eq(legalDocumentsTable.id, id)).limit(1);
    if (!draft) return { type: "missing" as const };
    if (draft.status !== "draft") return { type: "not_draft" as const };
    if (draft.content.trim().length < 20) return { type: "content" as const };
    await tx.update(legalDocumentsTable).set({ status: "archived", updatedAt: new Date() }).where(and(
      eq(legalDocumentsTable.documentType, draft.documentType),
      eq(legalDocumentsTable.language, draft.language),
      eq(legalDocumentsTable.status, "published"),
    ));
    const [published] = await tx.update(legalDocumentsTable).set({
      status: "published",
      effectiveAt,
      publishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(legalDocumentsTable.id, id)).returning();
    return { type: "published" as const, document: published };
  });
  if (result.type === "missing") { res.status(404).json({ error: "Legal document not found" }); return; }
  if (result.type === "not_draft") { res.status(409).json({ error: "Only draft documents can be published" }); return; }
  if (result.type === "content") { res.status(400).json({ error: "A legal document must contain reviewed policy content before publication" }); return; }
  res.json(formatDocument(result.document));
});

export default router;

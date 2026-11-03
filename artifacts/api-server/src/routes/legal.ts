import { Router, type IRouter } from "express";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db, legalAcceptancesTable, legalDocumentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { requirePlatformAdmin } from "../middlewares/platformAdmin";

const router: IRouter = Router();
const legalTypes = ["terms", "privacy"] as const;
type LegalType = (typeof legalTypes)[number];

function isLegalType(value: unknown): value is LegalType {
  return typeof value === "string" && legalTypes.includes(value as LegalType);
}

function formatDocument(document: typeof legalDocumentsTable.$inferSelect) {
  return {
    id: document.id,
    documentType: document.documentType,
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

async function currentDocuments() {
  return db.select().from(legalDocumentsTable).where(and(
    eq(legalDocumentsTable.status, "published"),
    lte(legalDocumentsTable.effectiveAt, new Date()),
  )).orderBy(asc(legalDocumentsTable.documentType), desc(legalDocumentsTable.version));
}

router.get("/legal/requirements", async (_req, res): Promise<void> => {
  const current = await currentDocuments();
  const latest = new Map<string, typeof current[number]>();
  for (const document of current) if (!latest.has(document.documentType)) latest.set(document.documentType, document);
  const documents = legalTypes.map((documentType) => latest.get(documentType)).filter(Boolean).map(formatDocument);
  const missingDocumentTypes = legalTypes.filter((documentType) => !latest.has(documentType));
  res.json({ documents, missingDocumentTypes });
});

router.get("/legal/:documentType", async (req, res): Promise<void> => {
  if (!isLegalType(req.params.documentType)) {
    res.status(404).json({ error: "Legal document not found" });
    return;
  }
  const [document] = await db.select().from(legalDocumentsTable).where(and(
    eq(legalDocumentsTable.documentType, req.params.documentType),
    eq(legalDocumentsTable.status, "published"),
    lte(legalDocumentsTable.effectiveAt, new Date()),
  )).orderBy(desc(legalDocumentsTable.version)).limit(1);
  if (!document) {
    res.status(404).json({ error: "This legal document has not been published" });
    return;
  }
  res.json(formatDocument(document));
});

router.get("/auth/legal-status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const current = await currentDocuments();
  const latest = new Map<string, typeof current[number]>();
  for (const document of current) if (!latest.has(document.documentType)) latest.set(document.documentType, document);
  const documents = [...latest.values()];
  if (!documents.length) {
    res.json({ required: false, documents: [] });
    return;
  }
  const accepted = await db.select({
    legalDocumentId: legalAcceptancesTable.legalDocumentId,
    documentType: legalAcceptancesTable.documentType,
  })
    .from(legalAcceptancesTable)
    .where(eq(legalAcceptancesTable.userId, userId));
  const acceptedIds = new Set(accepted.map((row) => row.legalDocumentId));
  const acceptedTypes = new Set(accepted.map((row) => row.documentType));
  const outstanding = documents.filter((document) => (
    !acceptedTypes.has(document.documentType)
    || (document.requiresReacceptance && !acceptedIds.has(document.id))
  ));
  res.json({ required: outstanding.length > 0, documents: outstanding.map(formatDocument) });
});

router.post("/auth/legal-acceptances", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const documentIds: number[] = Array.isArray(req.body?.documentIds) ? req.body.documentIds.map(Number) : [];
  if (!documentIds.length || documentIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    res.status(400).json({ error: "Select each required legal document" });
    return;
  }
  const documents = await currentDocuments();
  const latest = new Map<string, typeof documents[number]>();
  for (const document of documents) if (!latest.has(document.documentType)) latest.set(document.documentType, document);
  const required = [...latest.values()];
  if (required.some((document) => !documentIds.includes(document.id))) {
    res.status(400).json({ error: "Accept each current legal document" });
    return;
  }
  await db.insert(legalAcceptancesTable).values(required.map((document) => ({
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
    .orderBy(asc(legalDocumentsTable.documentType), desc(legalDocumentsTable.version));
  res.json(documents.map(formatDocument));
});

router.post("/admin/legal-documents", async (req, res): Promise<void> => {
  const { documentType, title, content, requiresReacceptance = false } = req.body ?? {};
  if (!isLegalType(documentType) || typeof title !== "string" || title.trim().length < 3 || typeof content !== "string") {
    res.status(400).json({ error: "Provide a document type, title, and draft content" });
    return;
  }
  const [{ nextVersion }] = await db.select({ nextVersion: sql<number>`COALESCE(MAX(${legalDocumentsTable.version}), 0) + 1` })
    .from(legalDocumentsTable).where(eq(legalDocumentsTable.documentType, documentType));
  const [created] = await db.insert(legalDocumentsTable).values({
    documentType,
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

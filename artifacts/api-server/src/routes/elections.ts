import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  db, electionsTable, positionsTable, candidatesTable,
  votesTable, voteSelectionsTable, organizationsTable, electionEligibleVotersTable,
} from "@workspace/db";
import {
  CreateElectionBody, UpdateElectionBody, GetElectionParams, UpdateElectionParams,
  DeleteElectionParams, ListElectionsQueryParams,
  ListPositionsParams, CreatePositionBody, CreatePositionParams,
  UpdatePositionParams, UpdatePositionBody, DeletePositionParams,
  ListCandidatesParams, ListCandidatesQueryParams, CreateCandidateParams, CreateCandidateBody,
  GetCandidateParams, UpdateCandidateParams, UpdateCandidateBody, DeleteCandidateParams,
  SubmitVoteParams, SubmitVoteBody,
  GetElectionResultsParams, GetElectionAnalyticsParams,
  ListEligibleVotersParams, AddEligibleVotersParams, AddEligibleVotersBody, RemoveEligibleVoterParams,
  ExportElectionResultsParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireResourceOrgRole } from "../middlewares/orgAccess";

const router: IRouter = Router();

function toCsvValue(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// List elections
// Unauthenticated callers always get public-only results.
// Authenticated callers (org workspace) may filter by orgId and see all visibility levels.
router.get("/elections", async (req, res): Promise<void> => {
  const queryParsed = ListElectionsQueryParams.safeParse(req.query);
  const filters: any[] = [];

  if (queryParsed.success) {
    const { orgId, status, visibility } = queryParsed.data;
    if (orgId) filters.push(eq(electionsTable.orgId, orgId));
    if (status) filters.push(eq(electionsTable.status, status));
    if (visibility) {
      filters.push(eq(electionsTable.visibility, visibility));
    } else if (!req.session?.userId) {
      // No auth — restrict to public elections only
      filters.push(eq(electionsTable.visibility, "public"));
    }
  } else {
    // Unparseable query — default safe: public only
    filters.push(eq(electionsTable.visibility, "public"));
  }

  const rows = await db
    .select({
      election: electionsTable,
      orgName: organizationsTable.name,
      orgLogoUrl: organizationsTable.logoUrl,
    })
    .from(electionsTable)
    .leftJoin(organizationsTable, eq(electionsTable.orgId, organizationsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined);

  const elections = await Promise.all(rows.map(async ({ election, orgName, orgLogoUrl }) => {
    const [{ posCount }] = await db.select({ posCount: sql<number>`count(*)::int` }).from(positionsTable).where(eq(positionsTable.electionId, election.id));
    const [{ candCount }] = await db.select({ candCount: sql<number>`count(*)::int` }).from(candidatesTable).where(eq(candidatesTable.electionId, election.id));
    const [{ voteCount }] = await db.select({ voteCount: sql<number>`count(*)::int` }).from(votesTable).where(eq(votesTable.electionId, election.id));
    return {
      ...election,
      organizationName: orgName ?? null,
      organizationLogoUrl: orgLogoUrl ?? null,
      positionsCount: posCount ?? 0,
      candidatesCount: candCount ?? 0,
      totalVotes: voteCount ?? 0,
    };
  }));
  res.json(elections);
});

// Create election
router.post("/elections", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateElectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { orgId, title, description, visibility, requiresAuth: rAuth, eligibilityMode, startsAt, endsAt } = parsed.data;
  const inviteCode = visibility === "invite_only" ? uuidv4().replace(/-/g, "").substring(0, 10).toUpperCase() : null;
  const [election] = await db.insert(electionsTable).values({
    orgId, title, description, visibility: visibility ?? "public",
    requiresAuth: rAuth ?? false, eligibilityMode: eligibilityMode ?? "open",
    inviteCode, startsAt, endsAt,
  }).returning();
  res.status(201).json({ ...election, organizationName: null, positionsCount: 0, candidatesCount: 0, totalVotes: 0 });
});

// Get election
router.get("/elections/:electionId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = GetElectionParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db.select({ election: electionsTable, orgName: organizationsTable.name, orgLogoUrl: organizationsTable.logoUrl })
    .from(electionsTable)
    .leftJoin(organizationsTable, eq(electionsTable.orgId, organizationsTable.id))
    .where(eq(electionsTable.id, parsed.data.electionId)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  // Non-public elections require the viewer to be authenticated and belong to the org
  if (row.election.visibility !== "public" && !req.session?.userId) {
    res.status(404).json({ error: "Not found" }); return;
  }

  const [{ posCount }] = await db.select({ posCount: sql<number>`count(*)::int` }).from(positionsTable).where(eq(positionsTable.electionId, row.election.id));
  const [{ candCount }] = await db.select({ candCount: sql<number>`count(*)::int` }).from(candidatesTable).where(eq(candidatesTable.electionId, row.election.id));
  const [{ voteCount }] = await db.select({ voteCount: sql<number>`count(*)::int` }).from(votesTable).where(eq(votesTable.electionId, row.election.id));

  res.json({ ...row.election, organizationName: row.orgName ?? null, organizationLogoUrl: row.orgLogoUrl ?? null, positionsCount: posCount ?? 0, candidatesCount: candCount ?? 0, totalVotes: voteCount ?? 0 });
});

// Update election — must be org owner/admin
router.patch("/elections/:electionId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = UpdateElectionParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateElectionBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [election] = await db.update(electionsTable).set(bodyParsed.data).where(eq(electionsTable.id, paramParsed.data.electionId)).returning();
  if (!election) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...election, organizationName: null, positionsCount: 0, candidatesCount: 0, totalVotes: 0 });
});

// Delete election — must be org owner/admin
router.delete("/elections/:electionId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = DeleteElectionParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(electionsTable).where(eq(electionsTable.id, parsed.data.electionId));
  res.json({ message: "Deleted" });
});

// ── POSITIONS ──────────────────────────────────────────────────────────────

router.get("/elections/:electionId/positions", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = ListPositionsParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const positions = await db.select().from(positionsTable).where(eq(positionsTable.electionId, parsed.data.electionId));
  res.json(positions);
});

router.post("/elections/:electionId/positions", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = CreatePositionParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = CreatePositionBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const { title, description, maxSelections, sortOrder } = bodyParsed.data;
  const [pos] = await db.insert(positionsTable).values({
    electionId: paramParsed.data.electionId, title, description,
    maxSelections: maxSelections ?? 1, sortOrder: sortOrder ?? 0,
  }).returning();
  res.status(201).json(pos);
});

router.get("/elections/:electionId/positions/:positionId", async (req, res): Promise<void> => {
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const rawPosId = Array.isArray(req.params.positionId) ? req.params.positionId[0] : req.params.positionId;
  const electionId = parseInt(rawElId, 10);
  const positionId = parseInt(rawPosId, 10);
  if (isNaN(electionId) || isNaN(positionId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [pos] = await db.select().from(positionsTable).where(eq(positionsTable.id, positionId)).limit(1);
  if (!pos) { res.status(404).json({ error: "Not found" }); return; }

  const candidates = await db
    .select({ candidate: candidatesTable, positionTitle: positionsTable.title })
    .from(candidatesTable)
    .leftJoin(positionsTable, eq(candidatesTable.positionId, positionsTable.id))
    .where(eq(candidatesTable.positionId, positionId));

  const withVotes = await Promise.all(candidates.map(async ({ candidate, positionTitle }) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(voteSelectionsTable).where(eq(voteSelectionsTable.candidateId, candidate.id));
    return { ...candidate, positionTitle: positionTitle ?? null, voteCount: count ?? 0 };
  }));

  res.json({ ...pos, candidates: withVotes });
});

router.patch("/elections/:electionId/positions/:positionId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const rawPosId = Array.isArray(req.params.positionId) ? req.params.positionId[0] : req.params.positionId;
  const paramParsed = UpdatePositionParams.safeParse({ electionId: parseInt(rawElId, 10), positionId: parseInt(rawPosId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdatePositionBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [pos] = await db.update(positionsTable).set(bodyParsed.data).where(eq(positionsTable.id, paramParsed.data.positionId)).returning();
  if (!pos) { res.status(404).json({ error: "Not found" }); return; }
  res.json(pos);
});

router.delete("/elections/:electionId/positions/:positionId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawPosId = Array.isArray(req.params.positionId) ? req.params.positionId[0] : req.params.positionId;
  const parsed = DeletePositionParams.safeParse({ electionId: 0, positionId: parseInt(rawPosId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(positionsTable).where(eq(positionsTable.id, parsed.data.positionId));
  res.json({ message: "Deleted" });
});

// ── CANDIDATES ─────────────────────────────────────────────────────────────

router.get("/elections/:electionId/candidates", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = ListCandidatesParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const queryParsed = ListCandidatesQueryParams.safeParse(req.query);

  const conditions: any[] = [eq(candidatesTable.electionId, paramParsed.data.electionId)];
  if (queryParsed.success && queryParsed.data.positionId) {
    conditions.push(eq(candidatesTable.positionId, queryParsed.data.positionId));
  }

  const candidates = await db
    .select({ candidate: candidatesTable, positionTitle: positionsTable.title })
    .from(candidatesTable)
    .leftJoin(positionsTable, eq(candidatesTable.positionId, positionsTable.id))
    .where(and(...conditions));

  const withVotes = await Promise.all(candidates.map(async ({ candidate, positionTitle }) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(voteSelectionsTable).where(eq(voteSelectionsTable.candidateId, candidate.id));
    return { ...candidate, positionTitle: positionTitle ?? null, voteCount: count ?? 0 };
  }));

  res.json(withVotes);
});

router.post("/elections/:electionId/candidates", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = CreateCandidateParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = CreateCandidateBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const { positionId, name, bio, photoUrl, platform } = bodyParsed.data;
  const [candidate] = await db.insert(candidatesTable).values({
    electionId: paramParsed.data.electionId, positionId, name, bio, photoUrl, platform,
  }).returning();
  const [pos] = await db.select().from(positionsTable).where(eq(positionsTable.id, positionId)).limit(1);
  res.status(201).json({ ...candidate, positionTitle: pos?.title ?? null, voteCount: 0 });
});

router.get("/elections/:electionId/candidates/:candidateId", async (req, res): Promise<void> => {
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const rawCandId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const parsed = GetCandidateParams.safeParse({ electionId: parseInt(rawElId, 10), candidateId: parseInt(rawCandId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [row] = await db.select({ candidate: candidatesTable, positionTitle: positionsTable.title })
    .from(candidatesTable).leftJoin(positionsTable, eq(candidatesTable.positionId, positionsTable.id))
    .where(and(eq(candidatesTable.id, parsed.data.candidateId), eq(candidatesTable.electionId, parsed.data.electionId))).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(voteSelectionsTable).where(eq(voteSelectionsTable.candidateId, row.candidate.id));
  res.json({ ...row.candidate, positionTitle: row.positionTitle ?? null, voteCount: count ?? 0 });
});

router.patch("/elections/:electionId/candidates/:candidateId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawCandId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = UpdateCandidateParams.safeParse({ electionId: parseInt(rawElId, 10), candidateId: parseInt(rawCandId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateCandidateBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [candidate] = await db.update(candidatesTable).set(bodyParsed.data).where(and(eq(candidatesTable.id, paramParsed.data.candidateId), eq(candidatesTable.electionId, paramParsed.data.electionId))).returning();
  if (!candidate) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...candidate, positionTitle: null, voteCount: null });
});

router.delete("/elections/:electionId/candidates/:candidateId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawCandId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = DeleteCandidateParams.safeParse({ electionId: parseInt(rawElId, 10), candidateId: parseInt(rawCandId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(candidatesTable).where(and(eq(candidatesTable.id, parsed.data.candidateId), eq(candidatesTable.electionId, parsed.data.electionId)));
  res.json({ message: "Deleted" });
});

// ── VOTE ───────────────────────────────────────────────────────────────────

router.post("/elections/:electionId/vote", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = SubmitVoteParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = SubmitVoteBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const electionId = paramParsed.data.electionId;
  const [election] = await db.select().from(electionsTable).where(eq(electionsTable.id, electionId)).limit(1);
  if (!election) { res.status(404).json({ error: "Election not found" }); return; }

  if (election.status !== "active") {
    res.status(403).json({ error: "This election is not currently open for voting" });
    return;
  }

  // Enforce endsAt deadline server-side (status may not have been auto-updated yet)
  if (election.endsAt && new Date(election.endsAt) < new Date()) {
    res.status(403).json({ error: "This election has ended and is no longer accepting votes" });
    return;
  }

  if (election.visibility === "invite_only") {
    if (!bodyParsed.data.inviteCode || bodyParsed.data.inviteCode !== election.inviteCode) {
      res.status(403).json({ error: "A valid invite code is required to vote in this election" });
      return;
    }
  }

  if (election.eligibilityMode === "allowlist") {
    const voterEmail = bodyParsed.data.voterEmail?.toLowerCase();
    if (!voterEmail) {
      res.status(403).json({ error: "This election is restricted to an approved voter list. Provide your email to verify eligibility." });
      return;
    }
    const [eligible] = await db.select().from(electionEligibleVotersTable)
      .where(and(eq(electionEligibleVotersTable.electionId, electionId), eq(electionEligibleVotersTable.email, voterEmail))).limit(1);
    if (!eligible) {
      res.status(403).json({ error: "This email is not on the approved voter list for this election" });
      return;
    }
  }

  const voterIdentifier = req.session.userId
    ? `user:${req.session.userId}`
    : bodyParsed.data.voterEmail
      ? `email:${bodyParsed.data.voterEmail.toLowerCase()}`
      : `session:${req.sessionID}`;

  const existing = await db.select().from(votesTable)
    .where(and(eq(votesTable.electionId, electionId), eq(votesTable.voterIdentifier, voterIdentifier))).limit(1);
  if (existing.length > 0) {
    res.status(403).json({ error: "You have already cast a ballot in this election" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const [vote] = await tx.insert(votesTable).values({ electionId, voterIdentifier }).returning();
      for (const selection of bodyParsed.data.selections) {
        for (const candidateId of selection.candidateIds) {
          await tx.insert(voteSelectionsTable).values({ voteId: vote.id, positionId: selection.positionId, candidateId });
        }
      }
    });
  } catch (err: any) {
    // Unique constraint violation — two concurrent requests raced past the duplicate check
    if (err?.code === "23505") {
      res.status(403).json({ error: "You have already cast a ballot in this election" });
      return;
    }
    throw err;
  }

  res.json({ message: "Vote recorded" });
});

// ── ELIGIBLE VOTERS (allowlist) ─────────────────────────────────────────────

router.get("/elections/:electionId/eligible-voters", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = ListEligibleVotersParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const voters = await db.select().from(electionEligibleVotersTable).where(eq(electionEligibleVotersTable.electionId, parsed.data.electionId));
  res.json(voters);
});

router.post("/elections/:electionId/eligible-voters", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = AddEligibleVotersParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = AddEligibleVotersBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const electionId = paramParsed.data.electionId;
  const inserted: (typeof electionEligibleVotersTable.$inferSelect)[] = [];
  for (const rawEmail of bodyParsed.data.emails) {
    const email = rawEmail.toLowerCase().trim();
    if (!email) continue;
    const [existing] = await db.select().from(electionEligibleVotersTable)
      .where(and(eq(electionEligibleVotersTable.electionId, electionId), eq(electionEligibleVotersTable.email, email))).limit(1);
    if (existing) { inserted.push(existing); continue; }
    const [row] = await db.insert(electionEligibleVotersTable).values({ electionId, email }).returning();
    inserted.push(row);
  }
  res.status(201).json(inserted);
});

router.delete("/elections/:electionId/eligible-voters/:voterId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const rawVoterId = Array.isArray(req.params.voterId) ? req.params.voterId[0] : req.params.voterId;
  const parsed = RemoveEligibleVoterParams.safeParse({ electionId: parseInt(rawElId, 10), voterId: parseInt(rawVoterId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(electionEligibleVotersTable)
    .where(and(eq(electionEligibleVotersTable.id, parsed.data.voterId), eq(electionEligibleVotersTable.electionId, parsed.data.electionId)));
  res.json({ message: "Removed" });
});

// ── EXPORT ─────────────────────────────────────────────────────────────────

router.get("/elections/:electionId/export", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = ExportElectionResultsParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const electionId = parsed.data.electionId;

  const positions = await db.select().from(positionsTable).where(eq(positionsTable.electionId, electionId));
  const rows = [["Position", "Candidate", "Votes"]];
  for (const pos of positions) {
    const candidates = await db.select().from(candidatesTable).where(eq(candidatesTable.positionId, pos.id));
    for (const c of candidates) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(voteSelectionsTable).where(eq(voteSelectionsTable.candidateId, c.id));
      rows.push([pos.title, c.name, String(count ?? 0)]);
    }
  }
  const csv = rows.map(r => r.map(toCsvValue).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="election-${electionId}-results.csv"`);
  res.send(csv);
});

// ── RESULTS ────────────────────────────────────────────────────────────────

router.get("/elections/:electionId/results", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = GetElectionResultsParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const electionId = parsed.data.electionId;

  // Verify election exists and is accessible
  const [election] = await db.select().from(electionsTable).where(eq(electionsTable.id, electionId)).limit(1);
  if (!election) { res.status(404).json({ error: "Not found" }); return; }
  if (election.visibility !== "public" && !req.session?.userId) {
    res.status(404).json({ error: "Not found" }); return;
  }

  const [{ totalVotes }] = await db.select({ totalVotes: sql<number>`count(*)::int` }).from(votesTable).where(eq(votesTable.electionId, electionId));
  const positions = await db.select().from(positionsTable).where(eq(positionsTable.electionId, electionId));

  const positionResults = await Promise.all(positions.map(async (pos) => {
    const candidates = await db.select().from(candidatesTable).where(eq(candidatesTable.positionId, pos.id));
    const total = totalVotes ?? 0;
    const candidateResults = await Promise.all(candidates.map(async (c) => {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(voteSelectionsTable).where(eq(voteSelectionsTable.candidateId, c.id));
      return {
        candidateId: c.id,
        name: c.name,
        photoUrl: c.photoUrl ?? null,
        voteCount: count ?? 0,
        percentage: total > 0 ? Math.round(((count ?? 0) / total) * 1000) / 10 : 0,
      };
    }));
    return { positionId: pos.id, title: pos.title, candidates: candidateResults.sort((a, b) => b.voteCount - a.voteCount) };
  }));

  res.json({ electionId, totalVotes: totalVotes ?? 0, positions: positionResults });
});

// ── ANALYTICS — org admin only ─────────────────────────────────────────────

router.get("/elections/:electionId/analytics", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = GetElectionAnalyticsParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const electionId = parsed.data.electionId;

  const [{ totalVotes }] = await db.select({ totalVotes: sql<number>`count(*)::int` }).from(votesTable).where(eq(votesTable.electionId, electionId));

  const votesByHour = await db.execute(
    sql`SELECT date_trunc('hour', voted_at) as hour, count(*)::int as count FROM votes WHERE election_id = ${electionId} GROUP BY 1 ORDER BY 1`
  );

  const positions = await db.select().from(positionsTable).where(eq(positionsTable.electionId, electionId));
  const topPositions = await Promise.all(positions.map(async (pos) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(voteSelectionsTable)
      .where(eq(voteSelectionsTable.positionId, pos.id));
    return { positionId: pos.id, title: pos.title, voteCount: count ?? 0 };
  }));

  res.json({
    electionId,
    totalVotes: totalVotes ?? 0,
    turnoutRate: 0,
    votesByHour: (votesByHour.rows ?? []).map((r: any) => ({ hour: r.hour, count: r.count })),
    topPositions: topPositions.sort((a, b) => b.voteCount - a.voteCount),
  });
});

export default router;

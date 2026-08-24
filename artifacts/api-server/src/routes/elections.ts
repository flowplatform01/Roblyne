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
import { requireBodyOrgRole, requireResourceOrgRole } from "../middlewares/orgAccess";
import { recordTransaction } from "../lib/commission-engine";

const router: IRouter = Router();

function toCsvValue(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// List elections — single query with subquery counts to avoid N+1
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
      filters.push(eq(electionsTable.visibility, "public"));
    }
  } else {
    filters.push(eq(electionsTable.visibility, "public"));
  }

  const rows = await db
    .select({
      election: electionsTable,
      orgName: organizationsTable.name,
      orgLogoUrl: organizationsTable.logoUrl,
      positionsCount: sql<number>`(SELECT COUNT(*)::int FROM positions p WHERE p.election_id = ${electionsTable.id})`,
      candidatesCount: sql<number>`(SELECT COUNT(*)::int FROM candidates c WHERE c.election_id = ${electionsTable.id})`,
      totalVotes: sql<number>`(SELECT COALESCE(SUM(v.quantity), 0)::int FROM votes v WHERE v.election_id = ${electionsTable.id})`,
    })
    .from(electionsTable)
    .leftJoin(organizationsTable, eq(electionsTable.orgId, organizationsTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined);

  res.json(rows.map(({ election, orgName, orgLogoUrl, positionsCount, candidatesCount, totalVotes }) => ({
    ...election,
    organizationName: orgName ?? null,
    organizationLogoUrl: orgLogoUrl ?? null,
    positionsCount: positionsCount ?? 0,
    candidatesCount: candidatesCount ?? 0,
    totalVotes: totalVotes ?? 0,
  })));
});

// Create election
router.post("/elections", requireAuth, requireBodyOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
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

// Get election — subquery counts
router.get("/elections/:electionId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = GetElectionParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .select({
      election: electionsTable,
      orgName: organizationsTable.name,
      orgLogoUrl: organizationsTable.logoUrl,
      positionsCount: sql<number>`(SELECT COUNT(*)::int FROM positions p WHERE p.election_id = ${electionsTable.id})`,
      candidatesCount: sql<number>`(SELECT COUNT(*)::int FROM candidates c WHERE c.election_id = ${electionsTable.id})`,
      totalVotes: sql<number>`(SELECT COALESCE(SUM(v.quantity), 0)::int FROM votes v WHERE v.election_id = ${electionsTable.id})`,
    })
    .from(electionsTable)
    .leftJoin(organizationsTable, eq(electionsTable.orgId, organizationsTable.id))
    .where(eq(electionsTable.id, parsed.data.electionId))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.election.visibility !== "public" && !req.session?.userId) {
    res.status(404).json({ error: "Not found" }); return;
  }

  res.json({
    ...row.election,
    organizationName: row.orgName ?? null,
    organizationLogoUrl: row.orgLogoUrl ?? null,
    positionsCount: row.positionsCount ?? 0,
    candidatesCount: row.candidatesCount ?? 0,
    totalVotes: row.totalVotes ?? 0,
  });
});

// Update election — must be org owner/admin
router.patch("/elections/:electionId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = UpdateElectionParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateElectionBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const updateData = {
    ...bodyParsed.data,
    paymentAmount: bodyParsed.data.paymentAmount === undefined ? undefined : (bodyParsed.data.paymentAmount === null ? null : String(bodyParsed.data.paymentAmount)),
  };
  const [election] = await db.update(electionsTable).set(updateData).where(eq(electionsTable.id, paramParsed.data.electionId)).returning();
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

// Get position with candidates — single aggregated query for vote counts
router.get("/elections/:electionId/positions/:positionId", async (req, res): Promise<void> => {
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const rawPosId = Array.isArray(req.params.positionId) ? req.params.positionId[0] : req.params.positionId;
  const electionId = parseInt(rawElId, 10);
  const positionId = parseInt(rawPosId, 10);
  if (isNaN(electionId) || isNaN(positionId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [pos] = await db.select().from(positionsTable).where(eq(positionsTable.id, positionId)).limit(1);
  if (!pos) { res.status(404).json({ error: "Not found" }); return; }

  // Aggregate vote counts in a single query — no N+1
  const candidateRows = await db.execute(sql`
    SELECT
      c.id, c.election_id AS "electionId", c.position_id AS "positionId",
      c.name, c.bio, c.photo_url AS "photoUrl", c.platform,
      p.title AS "positionTitle",
      COALESCE(SUM(v.quantity), 0)::int AS "voteCount"
    FROM candidates c
    LEFT JOIN positions p ON p.id = c.position_id
    LEFT JOIN vote_selections vs ON vs.candidate_id = c.id
    LEFT JOIN votes v ON v.id = vs.vote_id
    WHERE c.position_id = ${positionId}
    GROUP BY c.id, p.title
  `);

  res.json({ ...pos, candidates: candidateRows.rows });
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

// List candidates — aggregate vote counts in a single GROUP BY query
router.get("/elections/:electionId/candidates", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = ListCandidatesParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const queryParsed = ListCandidatesQueryParams.safeParse(req.query);

  const positionFilter = queryParsed.success && queryParsed.data.positionId
    ? sql`AND c.position_id = ${queryParsed.data.positionId}`
    : sql``;

  const rows = await db.execute(sql`
    SELECT
      c.id, c.election_id AS "electionId", c.position_id AS "positionId",
      c.name, c.bio, c.photo_url AS "photoUrl", c.platform,
      p.title AS "positionTitle",
      COALESCE(SUM(v.quantity), 0)::int AS "voteCount"
    FROM candidates c
    LEFT JOIN positions p ON p.id = c.position_id
    LEFT JOIN vote_selections vs ON vs.candidate_id = c.id
    LEFT JOIN votes v ON v.id = vs.vote_id
    WHERE c.election_id = ${paramParsed.data.electionId}
    ${positionFilter}
    GROUP BY c.id, p.title
  `);

  res.json(rows.rows);
});

router.post("/elections/:electionId/candidates", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = CreateCandidateParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = CreateCandidateBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const { positionId, name, bio, photoUrl, platform } = bodyParsed.data;
  const [[candidate], [pos]] = await Promise.all([
    db.insert(candidatesTable).values({
      electionId: paramParsed.data.electionId, positionId, name, bio, photoUrl, platform,
    }).returning(),
    db.select().from(positionsTable).where(eq(positionsTable.id, positionId)).limit(1),
  ]);
  res.status(201).json({ ...candidate, positionTitle: pos?.title ?? null, voteCount: 0 });
});

router.get("/elections/:electionId/candidates/:candidateId", async (req, res): Promise<void> => {
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const rawCandId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const parsed = GetCandidateParams.safeParse({ electionId: parseInt(rawElId, 10), candidateId: parseInt(rawCandId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const rows = await db.execute(sql`
    SELECT
      c.id, c.election_id AS "electionId", c.position_id AS "positionId",
      c.name, c.bio, c.photo_url AS "photoUrl", c.platform,
      p.title AS "positionTitle",
      COALESCE(SUM(v.quantity), 0)::int AS "voteCount"
    FROM candidates c
    LEFT JOIN positions p ON p.id = c.position_id
    LEFT JOIN vote_selections vs ON vs.candidate_id = c.id
    LEFT JOIN votes v ON v.id = vs.vote_id
    WHERE c.id = ${parsed.data.candidateId} AND c.election_id = ${parsed.data.electionId}
    GROUP BY c.id, p.title
    LIMIT 1
  `);

  if (rows.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rows.rows[0]);
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
  const voteQuantity = bodyParsed.data.voteQuantity ?? 1;
  const selectedCandidateCount = bodyParsed.data.selections.reduce((total, selection) => total + selection.candidateIds.length, 0);
  if (selectedCandidateCount === 0) {
    res.status(400).json({ error: "Select at least one candidate before submitting your ballot" });
    return;
  }
  const [election] = await db.select().from(electionsTable).where(eq(electionsTable.id, electionId)).limit(1);
  if (!election) { res.status(404).json({ error: "Election not found" }); return; }

  // Validate the complete ballot against the election's current structure.
  // The client enforces these rules for normal users, but the API must also
  // protect ballot integrity when requests are crafted or become stale.
  const submittedPositionIds = bodyParsed.data.selections.map(selection => selection.positionId);
  const uniquePositionIds = new Set(submittedPositionIds);
  if (uniquePositionIds.size !== submittedPositionIds.length) {
    res.status(400).json({ error: "Each position may only appear once on a ballot" });
    return;
  }

  const [electionPositions, electionCandidates] = await Promise.all([
    db.select({
      id: positionsTable.id,
      maxSelections: positionsTable.maxSelections,
    }).from(positionsTable).where(eq(positionsTable.electionId, electionId)),
    db.select({
      id: candidatesTable.id,
      positionId: candidatesTable.positionId,
    }).from(candidatesTable).where(eq(candidatesTable.electionId, electionId)),
  ]);
  const positionsById = new Map(electionPositions.map(position => [position.id, position]));
  const candidatesById = new Map(electionCandidates.map(candidate => [candidate.id, candidate]));

  for (const selection of bodyParsed.data.selections) {
    const position = positionsById.get(selection.positionId);
    if (!position) {
      res.status(400).json({ error: "One or more ballot positions do not belong to this election" });
      return;
    }
    const uniqueCandidateIds = new Set(selection.candidateIds);
    if (uniqueCandidateIds.size !== selection.candidateIds.length) {
      res.status(400).json({ error: "A candidate cannot be selected more than once" });
      return;
    }
    if (selection.candidateIds.length > position.maxSelections) {
      res.status(400).json({
        error: `You may select up to ${position.maxSelections} candidate${position.maxSelections === 1 ? "" : "s"} for this position`,
      });
      return;
    }
    if (selection.candidateIds.some(candidateId => candidatesById.get(candidateId)?.positionId !== selection.positionId)) {
      res.status(400).json({ error: "One or more selected candidates do not belong to their ballot position" });
      return;
    }
  }

  if (election.status !== "active") {
    res.status(403).json({ error: "This election is not currently open for voting" });
    return;
  }

  const now = new Date();
  if (election.startsAt && new Date(election.startsAt) > now) {
    res.status(403).json({ error: "This election has not opened for voting yet" });
    return;
  }

  if (election.endsAt && new Date(election.endsAt) <= now) {
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

  // Pre-check (optimistic) — the unique constraint is the DB-level guarantee
  const existing = await db.select({ id: votesTable.id }).from(votesTable)
    .where(and(eq(votesTable.electionId, electionId), eq(votesTable.voterIdentifier, voterIdentifier))).limit(1);
  if (existing.length > 0) {
    res.status(403).json({ error: "You have already participated in this election" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const [vote] = await tx.insert(votesTable).values({ electionId, voterIdentifier, quantity: voteQuantity }).returning();
      // Bulk insert all selections in one statement
      const selectionValues = bodyParsed.data.selections.flatMap(selection =>
        selection.candidateIds.map(candidateId => ({
          voteId: vote.id, positionId: selection.positionId, candidateId,
        }))
      );
      if (selectionValues.length > 0) {
        await tx.insert(voteSelectionsTable).values(selectionValues);
      }

      if (election.requiresPayment && Number(election.paymentAmount || 0) > 0) {
        await recordTransaction({
          orgId: election.orgId,
          pillar: "election",
          entityId: election.id,
          entityTitle: election.title,
          transactionType: "vote",
          grossAmount: Number(election.paymentAmount) * selectedCandidateCount * voteQuantity,
          currency: election.currency || "XAF",
          payerEmail: bodyParsed.data.voterEmail,
        }, tx);
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

// Add eligible voters — batch upsert instead of sequential loop to avoid N+1 and race conditions
router.post("/elections/:electionId/eligible-voters", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = AddEligibleVotersParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = AddEligibleVotersBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const electionId = paramParsed.data.electionId;
  const normalised = [...new Set(bodyParsed.data.emails.map(e => e.toLowerCase().trim()).filter(Boolean))];
  if (normalised.length === 0) { res.status(201).json([]); return; }

  // Batch upsert: ON CONFLICT DO NOTHING avoids duplicates atomically
  const inserted = await db
    .insert(electionEligibleVotersTable)
    .values(normalised.map(email => ({ electionId, email })))
    .onConflictDoNothing()
    .returning();

  // Return all current rows for these emails (including pre-existing ones)
  const all = await db.select().from(electionEligibleVotersTable)
    .where(and(
      eq(electionEligibleVotersTable.electionId, electionId),
      sql`email = ANY(${normalised})`
    ));

  res.status(201).json(all);
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

// Export results — single aggregated query instead of deeply nested N+1
router.get("/elections/:electionId/export", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = ExportElectionResultsParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const electionId = parsed.data.electionId;

  const rows = await db.execute(sql`
    SELECT
      p.title AS position,
      c.name  AS candidate,
      COALESCE(SUM(v.quantity), 0)::int AS votes
    FROM positions p
    LEFT JOIN candidates c ON c.position_id = p.id
    LEFT JOIN vote_selections vs ON vs.candidate_id = c.id
    LEFT JOIN votes v ON v.id = vs.vote_id
    WHERE p.election_id = ${electionId}
    GROUP BY p.id, p.title, c.id, c.name
    ORDER BY p.sort_order, p.title, votes DESC
  `);

  const csvRows = [["Position", "Candidate", "Votes"]];
  for (const row of rows.rows as any[]) {
    csvRows.push([row.position, row.candidate ?? "", String(row.votes ?? 0)]);
  }
  const csv = csvRows.map(r => r.map(toCsvValue).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="election-${electionId}-results.csv"`);
  res.send(csv);
});

// ── RESULTS ────────────────────────────────────────────────────────────────

// Results — single aggregated query for all candidate vote counts
router.get("/elections/:electionId/results", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = GetElectionResultsParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const electionId = parsed.data.electionId;

  const [election] = await db.select().from(electionsTable).where(eq(electionsTable.id, electionId)).limit(1);
  if (!election) { res.status(404).json({ error: "Not found" }); return; }
  if (election.visibility !== "public" && !req.session?.userId) {
    res.status(404).json({ error: "Not found" }); return;
  }

  // Fetch everything needed in parallel
  const [totalResult, resultsRows] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(SUM(v.quantity), 0)::int AS total_votes
      FROM votes v WHERE v.election_id = ${electionId}
    `),
    db.execute(sql`
      SELECT
        p.id   AS position_id,
        p.title AS position_title,
        p.sort_order,
        c.id   AS candidate_id,
        c.name AS candidate_name,
        c.photo_url AS candidate_photo,
        COALESCE(SUM(v.quantity), 0)::int AS vote_count
      FROM positions p
      LEFT JOIN candidates c ON c.position_id = p.id
      LEFT JOIN vote_selections vs ON vs.candidate_id = c.id
      LEFT JOIN votes v ON v.id = vs.vote_id
      WHERE p.election_id = ${electionId}
      GROUP BY p.id, p.title, p.sort_order, c.id, c.name, c.photo_url
      ORDER BY p.sort_order, p.title, vote_count DESC
    `),
  ]);

  const totalVotes = (totalResult.rows[0] as any)?.total_votes ?? 0;

  // Group rows into positions
  const posMap = new Map<number, { positionId: number; title: string; candidates: any[] }>();
  for (const row of resultsRows.rows as any[]) {
    if (!posMap.has(row.position_id)) {
      posMap.set(row.position_id, { positionId: row.position_id, title: row.position_title, candidates: [] });
    }
    if (row.candidate_id) {
      posMap.get(row.position_id)!.candidates.push({
        candidateId: row.candidate_id,
        name: row.candidate_name,
        photoUrl: row.candidate_photo ?? null,
        voteCount: row.vote_count ?? 0,
        percentage: totalVotes > 0 ? Math.round(((row.vote_count ?? 0) / totalVotes) * 1000) / 10 : 0,
      });
    }
  }

  res.json({ electionId, totalVotes, positions: Array.from(posMap.values()) });
});

// ── ANALYTICS — org admin only ─────────────────────────────────────────────

// Analytics — parallel queries, no N+1
router.get("/elections/:electionId/analytics", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = GetElectionAnalyticsParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const electionId = parsed.data.electionId;

  const [totalResult, votesByHour, positionCounts] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(SUM(v.quantity), 0)::int AS total_votes FROM votes v WHERE v.election_id = ${electionId}
    `),
    db.execute(sql`
      SELECT date_trunc('hour', v.voted_at) AS hour, COALESCE(SUM(v.quantity), 0)::int AS count
      FROM votes v
      WHERE v.election_id = ${electionId}
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT
        p.id AS position_id,
        p.title,
        COALESCE(SUM(v.quantity), 0)::int AS vote_count
      FROM positions p
      LEFT JOIN vote_selections vs ON vs.position_id = p.id
      LEFT JOIN votes v ON v.id = vs.vote_id
      WHERE p.election_id = ${electionId}
      GROUP BY p.id, p.title
      ORDER BY vote_count DESC
    `),
  ]);

  const totalVotes = (totalResult.rows[0] as any)?.total_votes ?? 0;

  res.json({
    electionId,
    totalVotes,
    turnoutRate: 0,
    votesByHour: (votesByHour.rows ?? []).map((r: any) => ({ hour: r.hour, count: r.count })),
    topPositions: (positionCounts.rows as any[]).map(r => ({
      positionId: r.position_id, title: r.title, voteCount: r.vote_count ?? 0,
    })),
  });
});

export default router;

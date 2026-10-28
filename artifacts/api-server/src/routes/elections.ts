import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  db, electionsTable, positionsTable, candidatesTable,
  votesTable, voteSelectionsTable, organizationsTable, electionEligibleVotersTable, paymentIntentsTable,
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
import { getOrgRole, requireBodyOrgRole, requireResourceOrgRole } from "../middlewares/orgAccess";
import { getPlatformCurrency, isPlatformCurrencySupported, recordTransaction } from "../lib/commission-engine";
import {
  buildPaymentInitializationResponse,
  createPaymentIntent,
  failPaymentIntent,
  initializePaymentIntent,
} from "../lib/payment-intents";
import { compactListMedia } from "../lib/compact-list-media";
import { canViewElectionResults } from "../lib/election-access";
import { invalidateDiscoverCache } from "../lib/discover-cache";
import { normalizeCameroonPhone } from "../lib/phone";

const router: IRouter = Router();

async function resumePendingElectionPayment(
  res: import("express").Response,
  electionId: number,
  voterIdentifier: string,
): Promise<boolean> {
  const [intent] = await db.select().from(paymentIntentsTable).where(and(
    eq(paymentIntentsTable.pillar, "election"),
    eq(paymentIntentsTable.entityId, electionId),
    sql`${paymentIntentsTable.status} IN ('initializing', 'pending', 'processing')`,
    sql`${paymentIntentsTable.payload}->'election'->>'voterIdentifier' = ${voterIdentifier}`,
  )).limit(1);
  if (!intent) return false;
  try {
    const payload = await buildPaymentInitializationResponse(intent);
    res.json(payload);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment initialization failed";
    await failPaymentIntent(intent.id, message);
    return false;
  }
}

function isUniqueViolation(error: unknown): boolean {
  let current: any = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current.code === "23505") return true;
    current = current.cause;
  }
  return false;
}
function hasValidTimeWindow(startsAt: Date | null | undefined, endsAt: Date | null | undefined): boolean {
  if (!startsAt || !endsAt) return true;
  return startsAt.getTime() < endsAt.getTime();
}

function isCandidateRemovalLocked(
  election: { status: string; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
): boolean {
  if (election.status === "draft") return false;
  if (election.status !== "active") return true;
  if (!election.startsAt || election.startsAt <= now) return true;
  return Boolean(election.endsAt && election.endsAt <= now);
}

async function lockElectionStructure(tx: any, electionId: number): Promise<"missing" | "locked" | "editable"> {
  const [election] = await tx.select({
    status: electionsTable.status,
    startsAt: electionsTable.startsAt,
    endsAt: electionsTable.endsAt,
  })
    .from(electionsTable)
    .where(eq(electionsTable.id, electionId))
    .for("update");
  if (!election) return "missing";
  if (isCandidateRemovalLocked(election)) return "locked";
  const [vote] = await tx.select({ id: votesTable.id })
    .from(votesTable)
    .where(eq(votesTable.electionId, electionId))
    .limit(1);
  return vote ? "locked" : "editable";
}

function toCsvValue(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// List elections — single query with subquery counts to avoid N+1
router.get("/elections", async (req, res): Promise<void> => {
  const queryParsed = ListElectionsQueryParams.safeParse(req.query);
  const filters: any[] = [];
  const requestedOrgId = queryParsed.success ? queryParsed.data.orgId : undefined;
  const orgRole = requestedOrgId && req.session?.userId
    ? await getOrgRole(requestedOrgId, req.session.userId)
    : null;
  const canSeePrivate = Boolean(orgRole);

  if (queryParsed.success) {
    const { orgId, status, visibility } = queryParsed.data;
    if (orgId) filters.push(eq(electionsTable.orgId, orgId));
    if (status) filters.push(eq(electionsTable.status, status));
    if (visibility && (visibility === "public" || canSeePrivate)) {
      filters.push(eq(electionsTable.visibility, visibility));
    } else if (!canSeePrivate) {
      filters.push(eq(electionsTable.visibility, "public"));
    }
  } else {
    filters.push(eq(electionsTable.visibility, "public"));
  }
  if (!canSeePrivate) {
    filters.push(sql`${electionsTable.status} <> 'draft'`);
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
    ...compactListMedia({
      ...election,
      organizationLogoUrl: orgLogoUrl ?? null,
    }),
    inviteCode: null,
    organizationName: orgName ?? null,
    positionsCount: positionsCount ?? 0,
    candidatesCount: candidatesCount ?? 0,
    totalVotes: totalVotes ?? 0,
  })));
});

// Create election
router.post("/elections", requireAuth, requireBodyOrgRole(["owner", "admin"]), async (req, res): Promise<void> => {
  const parsed = CreateElectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { orgId, title, description, visibility, requiresAuth: rAuth, eligibilityMode, startsAt, endsAt, requiresPayment, paymentAmount, currency } = parsed.data;
  const normalizedCurrency = (currency ?? await getPlatformCurrency()).trim().toUpperCase();
  if (!await isPlatformCurrencySupported(normalizedCurrency)) {
    res.status(400).json({ error: `Currency ${normalizedCurrency} is not enabled for this platform` });
    return;
  }
  if (!hasValidTimeWindow(startsAt, endsAt)) {
    res.status(400).json({ error: "The election closing time must be after its opening time" });
    return;
  }
  if (requiresPayment && (!paymentAmount || paymentAmount <= 0)) {
    res.status(400).json({ error: "A positive payment amount is required when paid voting is enabled" });
    return;
  }
  const inviteCode = visibility === "invite_only" ? uuidv4().replace(/-/g, "").substring(0, 10).toUpperCase() : null;
  const [election] = await db.insert(electionsTable).values({
    orgId, title, description, visibility: visibility ?? "public",
    requiresAuth: rAuth ?? false, eligibilityMode: eligibilityMode ?? "open",
    inviteCode, startsAt, endsAt,
    requiresPayment: requiresPayment ?? false,
    paymentAmount: paymentAmount === undefined || paymentAmount === null ? null : String(paymentAmount),
    currency: normalizedCurrency,
  }).returning();
  void invalidateDiscoverCache();
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
  const viewerRole = req.session?.userId ? await getOrgRole(row.election.orgId, req.session.userId) : null;
  if ((row.election.visibility !== "public" || row.election.status === "draft") && !viewerRole) {
    res.status(404).json({ error: "Not found" }); return;
  }

  res.json({
    ...row.election,
    inviteCode: viewerRole === "owner" || viewerRole === "admin" ? row.election.inviteCode : null,
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
  if (
    bodyParsed.data.currency !== undefined
    && !await isPlatformCurrencySupported(bodyParsed.data.currency.trim().toUpperCase())
  ) {
    res.status(400).json({ error: `Currency ${bodyParsed.data.currency.toUpperCase()} is not enabled for this platform` });
    return;
  }
  const updateData = {
    ...bodyParsed.data,
    currency: bodyParsed.data.currency === undefined ? undefined : bodyParsed.data.currency.trim().toUpperCase(),
    paymentAmount: bodyParsed.data.paymentAmount === undefined ? undefined : (bodyParsed.data.paymentAmount === null ? null : String(bodyParsed.data.paymentAmount)),
  };
  const outcome = await db.transaction(async (tx) => {
    const [current] = await tx.select({
      status: electionsTable.status,
      startsAt: electionsTable.startsAt,
      endsAt: electionsTable.endsAt,
      requiresPayment: electionsTable.requiresPayment,
      paymentAmount: electionsTable.paymentAmount,
    })
      .from(electionsTable)
      .where(eq(electionsTable.id, paramParsed.data.electionId))
      .for("update");
    if (!current) return { kind: "missing" as const };

    const startsAt = bodyParsed.data.startsAt === undefined ? current.startsAt : bodyParsed.data.startsAt;
    const endsAt = bodyParsed.data.endsAt === undefined ? current.endsAt : bodyParsed.data.endsAt;
    const requiresPayment = bodyParsed.data.requiresPayment === undefined ? current.requiresPayment : bodyParsed.data.requiresPayment;
    const paymentAmount = bodyParsed.data.paymentAmount === undefined ? current.paymentAmount : bodyParsed.data.paymentAmount;
    if (!hasValidTimeWindow(startsAt, endsAt)) return { kind: "invalid_window" as const };
    if (requiresPayment && (!paymentAmount || Number(paymentAmount) <= 0)) {
      return { kind: "invalid_payment" as const };
    }

    const protectedFields = [
      "requiresPayment", "paymentAmount", "currency", "requiresAuth", "eligibilityMode",
      "visibility", "startsAt", "endsAt",
    ] as const;
    const changesCriticalSettings = protectedFields.some((field) =>
      Object.prototype.hasOwnProperty.call(bodyParsed.data, field)
    );
    const statusRollback =
      (current.status === "active" && bodyParsed.data.status === "draft")
      || (current.status === "ended" && bodyParsed.data.status !== undefined && bodyParsed.data.status !== "ended");
    if (statusRollback) return { kind: "locked" as const };

    let hasPendingPayment = false;
    if (changesCriticalSettings && current.status !== "draft") {
      const [pendingPayment] = await tx.select({ id: paymentIntentsTable.id })
        .from(paymentIntentsTable)
        .where(and(
          eq(paymentIntentsTable.pillar, "election"),
          eq(paymentIntentsTable.entityId, paramParsed.data.electionId),
          sql`${paymentIntentsTable.status} IN ('initializing', 'pending', 'processing')`,
        ))
        .limit(1);
      hasPendingPayment = Boolean(pendingPayment);
    }
    const structureLock = current.status === "draft"
      ? "editable"
      : isCandidateRemovalLocked(current)
        ? "locked"
        : await (async () => {
            const [vote] = await tx.select({ id: votesTable.id })
              .from(votesTable)
              .where(eq(votesTable.electionId, paramParsed.data.electionId))
              .limit(1);
            return vote ? "locked" : "editable";
          })();
    if (changesCriticalSettings && (structureLock === "locked" || hasPendingPayment)) {
      return { kind: "locked" as const };
    }

    const [election] = await tx.update(electionsTable)
      .set(updateData)
      .where(eq(electionsTable.id, paramParsed.data.electionId))
      .returning();
    return election ? { kind: "updated" as const, election } : { kind: "missing" as const };
  });
  if (outcome.kind === "missing") { res.status(404).json({ error: "Not found" }); return; }
  if (outcome.kind === "invalid_window") {
    res.status(400).json({ error: "The election closing time must be after its opening time" });
    return;
  }
  if (outcome.kind === "invalid_payment") {
    res.status(400).json({ error: "A positive payment amount is required when paid voting is enabled" });
    return;
  }
  if (outcome.kind === "locked") {
    res.status(409).json({
      error: "Voting eligibility, schedule, visibility, and payment settings are locked once voting begins or ballots/payment attempts exist. Ended elections cannot be reopened.",
    });
    return;
  }
  void invalidateDiscoverCache();
  res.json({ ...outcome.election, organizationName: null, positionsCount: 0, candidatesCount: 0, totalVotes: 0 });
});

// Delete election — must be org owner/admin
router.delete("/elections/:electionId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = DeleteElectionParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const outcome = await db.transaction(async (tx) => {
    const [election] = await tx.select({ status: electionsTable.status })
      .from(electionsTable)
      .where(eq(electionsTable.id, parsed.data.electionId))
      .for("update");
    if (!election) return "not_found" as const;
    const [vote] = await tx.select({ id: votesTable.id })
      .from(votesTable)
      .where(eq(votesTable.electionId, parsed.data.electionId))
      .limit(1);
    const [payment] = await tx.select({ id: paymentIntentsTable.id })
      .from(paymentIntentsTable)
      .where(and(
        eq(paymentIntentsTable.pillar, "election"),
        eq(paymentIntentsTable.entityId, parsed.data.electionId),
      ))
      .limit(1);
    if (election.status !== "draft" || vote || payment) return "protected" as const;
    await tx.delete(electionsTable).where(eq(electionsTable.id, parsed.data.electionId));
    return "deleted" as const;
  });
  if (outcome === "not_found") { res.status(404).json({ error: "Not found" }); return; }
  if (outcome === "protected") {
    res.status(409).json({ error: "Only draft elections with no ballots or payment history can be permanently deleted. End the election to preserve the official record." });
    return;
  }
  void invalidateDiscoverCache();
  res.json({ message: "Deleted" });
});

// ── POSITIONS ──────────────────────────────────────────────────────────────

router.get("/elections/:electionId/positions", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = ListPositionsParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [election] = await db.select({ visibility: electionsTable.visibility, orgId: electionsTable.orgId })
    .from(electionsTable)
    .where(eq(electionsTable.id, parsed.data.electionId))
    .limit(1);
  const viewerRole = election && req.session?.userId ? await getOrgRole(election.orgId, req.session.userId) : null;
  if (!election || (election.visibility !== "public" && !viewerRole)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const positions = await db.select().from(positionsTable).where(eq(positionsTable.electionId, parsed.data.electionId));
  res.json(positions);
});

router.post("/elections/:electionId/positions", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = CreatePositionParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = CreatePositionBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const result = await db.transaction(async (tx) => {
    const guard = await lockElectionStructure(tx, paramParsed.data.electionId);
    if (guard !== "editable") return { kind: guard } as const;
    const { title, description, maxSelections, sortOrder } = bodyParsed.data;
    const [pos] = await tx.insert(positionsTable).values({
      electionId: paramParsed.data.electionId, title, description,
      maxSelections: maxSelections ?? 1, sortOrder: sortOrder ?? 0,
    }).returning();
    return { kind: "created" as const, pos };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Election not found" }); return; }
  if (result.kind === "locked") { res.status(409).json({ error: "Election positions are locked after voting starts or ballots are cast." }); return; }
  res.status(201).json(result.pos);
});

// Get position with candidates — single aggregated query for vote counts
router.get("/elections/:electionId/positions/:positionId", async (req, res): Promise<void> => {
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const rawPosId = Array.isArray(req.params.positionId) ? req.params.positionId[0] : req.params.positionId;
  const electionId = parseInt(rawElId, 10);
  const positionId = parseInt(rawPosId, 10);
  if (isNaN(electionId) || isNaN(positionId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [election] = await db.select({ visibility: electionsTable.visibility, orgId: electionsTable.orgId })
    .from(electionsTable)
    .where(eq(electionsTable.id, electionId))
    .limit(1);
  const viewerRole = election && req.session?.userId ? await getOrgRole(election.orgId, req.session.userId) : null;
  if (!election || (election.visibility !== "public" && !viewerRole)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [pos] = await db.select().from(positionsTable)
    .where(and(eq(positionsTable.id, positionId), eq(positionsTable.electionId, electionId)))
    .limit(1);
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
  const result = await db.transaction(async (tx) => {
    const guard = await lockElectionStructure(tx, paramParsed.data.electionId);
    if (guard !== "editable") return { kind: guard } as const;
    const [pos] = await tx.update(positionsTable)
      .set(bodyParsed.data)
      .where(and(
        eq(positionsTable.id, paramParsed.data.positionId),
        eq(positionsTable.electionId, paramParsed.data.electionId),
      ))
      .returning();
    return pos ? { kind: "updated" as const, pos } : { kind: "position_missing" as const };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Election not found" }); return; }
  if (result.kind === "locked") { res.status(409).json({ error: "Election positions are locked after voting starts or ballots are cast." }); return; }
  if (result.kind === "position_missing") { res.status(404).json({ error: "Not found" }); return; }
  res.json(result.pos);
});

router.delete("/elections/:electionId/positions/:positionId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const rawPosId = Array.isArray(req.params.positionId) ? req.params.positionId[0] : req.params.positionId;
  const parsed = DeletePositionParams.safeParse({ electionId: parseInt(rawElId, 10), positionId: parseInt(rawPosId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const result = await db.transaction(async (tx) => {
    const guard = await lockElectionStructure(tx, parsed.data.electionId);
    if (guard !== "editable") return { kind: guard } as const;
    const [pos] = await tx.delete(positionsTable).where(and(
      eq(positionsTable.id, parsed.data.positionId),
      eq(positionsTable.electionId, parsed.data.electionId),
    )).returning({ id: positionsTable.id });
    return pos ? { kind: "deleted" as const } : { kind: "position_missing" as const };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Election not found" }); return; }
  if (result.kind === "locked") { res.status(409).json({ error: "Election positions are locked after voting starts or ballots are cast." }); return; }
  if (result.kind === "position_missing") { res.status(404).json({ error: "Not found" }); return; }
  res.json({ message: "Deleted" });
});

// ── CANDIDATES ─────────────────────────────────────────────────────────────

// List candidates — aggregate vote counts in a single GROUP BY query
router.get("/elections/:electionId/candidates", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const paramParsed = ListCandidatesParams.safeParse({ electionId: parseInt(rawId, 10) });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [election] = await db.select({ visibility: electionsTable.visibility, orgId: electionsTable.orgId })
    .from(electionsTable)
    .where(eq(electionsTable.id, paramParsed.data.electionId))
    .limit(1);
  const viewerRole = election && req.session?.userId ? await getOrgRole(election.orgId, req.session.userId) : null;
  if (!election || (election.visibility !== "public" && !viewerRole)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
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
  const result = await db.transaction(async (tx) => {
    const guard = await lockElectionStructure(tx, paramParsed.data.electionId);
    if (guard !== "editable") return { kind: guard } as const;
    const { positionId, name, bio, photoUrl, platform } = bodyParsed.data;
    const [pos] = await tx.select().from(positionsTable)
      .where(and(
        eq(positionsTable.id, positionId),
        eq(positionsTable.electionId, paramParsed.data.electionId),
      ))
      .limit(1);
    if (!pos) return { kind: "position_missing" as const };
    const [candidate] = await tx.insert(candidatesTable).values({
      electionId: paramParsed.data.electionId, positionId, name, bio, photoUrl, platform,
    }).returning();
    return { kind: "created" as const, candidate, positionTitle: pos.title };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Election not found" }); return; }
  if (result.kind === "locked") { res.status(409).json({ error: "Candidates are locked after voting starts or ballots are cast." }); return; }
  if (result.kind === "position_missing") { res.status(400).json({ error: "Position does not belong to this election" }); return; }
  res.status(201).json({ ...result.candidate, positionTitle: result.positionTitle, voteCount: 0 });
});

router.get("/elections/:electionId/candidates/:candidateId", async (req, res): Promise<void> => {
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const rawCandId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const parsed = GetCandidateParams.safeParse({ electionId: parseInt(rawElId, 10), candidateId: parseInt(rawCandId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [election] = await db.select({ visibility: electionsTable.visibility, orgId: electionsTable.orgId })
    .from(electionsTable)
    .where(eq(electionsTable.id, parsed.data.electionId))
    .limit(1);
  const viewerRole = election && req.session?.userId ? await getOrgRole(election.orgId, req.session.userId) : null;
  if (!election || (election.visibility !== "public" && !viewerRole)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

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
  const result = await db.transaction(async (tx) => {
    const guard = await lockElectionStructure(tx, paramParsed.data.electionId);
    if (guard !== "editable") return { kind: guard } as const;
    const [candidate] = await tx.update(candidatesTable)
      .set(bodyParsed.data)
      .where(and(
        eq(candidatesTable.id, paramParsed.data.candidateId),
        eq(candidatesTable.electionId, paramParsed.data.electionId),
      ))
      .returning();
    return candidate ? { kind: "updated" as const, candidate } : { kind: "candidate_missing" as const };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Election not found" }); return; }
  if (result.kind === "locked") { res.status(409).json({ error: "Candidate details are locked after voting starts or ballots are cast." }); return; }
  if (result.kind === "candidate_missing") { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...result.candidate, positionTitle: null, voteCount: null });
});

router.delete("/elections/:electionId/candidates/:candidateId", requireAuth, requireResourceOrgRole(electionsTable, "electionId", ["owner", "admin"]), async (req, res): Promise<void> => {
  const rawCandId = Array.isArray(req.params.candidateId) ? req.params.candidateId[0] : req.params.candidateId;
  const rawElId = Array.isArray(req.params.electionId) ? req.params.electionId[0] : req.params.electionId;
  const parsed = DeleteCandidateParams.safeParse({ electionId: parseInt(rawElId, 10), candidateId: parseInt(rawCandId, 10) });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const outcome = await db.transaction(async (tx) => {
    const [election] = await tx.select({
      status: electionsTable.status,
      startsAt: electionsTable.startsAt,
      endsAt: electionsTable.endsAt,
    })
      .from(electionsTable)
      .where(eq(electionsTable.id, parsed.data.electionId))
      .for("update");

    if (!election) return "election_not_found" as const;
    if (isCandidateRemovalLocked(election)) return "locked" as const;

    const [existingVote] = await tx.select({ id: votesTable.id })
      .from(votesTable)
      .where(eq(votesTable.electionId, parsed.data.electionId))
      .limit(1);
    if (existingVote) return "locked" as const;

    const [deleted] = await tx.delete(candidatesTable)
      .where(and(
        eq(candidatesTable.id, parsed.data.candidateId),
        eq(candidatesTable.electionId, parsed.data.electionId),
      ))
      .returning({ id: candidatesTable.id });

    return deleted ? "deleted" as const : "candidate_not_found" as const;
  });

  if (outcome === "election_not_found") {
    res.status(404).json({ error: "Election not found" });
    return;
  }
  if (outcome === "candidate_not_found") {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  if (outcome === "locked") {
    res.status(409).json({
      error: "Candidates cannot be removed after voting starts, ballots have been cast, or the election has ended",
    });
    return;
  }

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
  const paymentAmount = Number(election.paymentAmount || 0);
  const isPaid = election.requiresPayment && paymentAmount > 0;
  let normalizedCustomerPhone: string | null = null;
  if (isPaid) {
    if (!bodyParsed.data.customerName?.trim() || !bodyParsed.data.customerEmail?.trim() || !bodyParsed.data.customerPhone?.trim()) {
      res.status(400).json({ error: "A customer name, email, and phone number are required for paid voting" });
      return;
    }
    normalizedCustomerPhone = normalizeCameroonPhone(bodyParsed.data.customerPhone);
    if (!normalizedCustomerPhone) {
      res.status(400).json({ error: "Please enter a valid phone number (e.g. +237 6XXXXXXXX or 6XXXXXXXX)" });
      return;
    }
  }
  const viewerRole = req.session?.userId ? await getOrgRole(election.orgId, req.session.userId) : null;
  if (election.visibility === "private" && !viewerRole) {
    res.status(403).json({ error: "This election is private and is not open to public voting" });
    return;
  }

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

  if (isPaid) {
    // Fast optimistic check only. The same condition is checked again while
    // holding the election row lock to serialize concurrent payment attempts.
    const pendingResult = await db.execute(sql`
      SELECT id
      FROM payment_intents
      WHERE pillar = 'election'
        AND entity_id = ${electionId}
        AND status IN ('initializing', 'pending', 'processing')
        AND payload->'election'->>'voterIdentifier' = ${voterIdentifier}
      LIMIT 1
    `);
    if (pendingResult.rows.length > 0) {
      if (await resumePendingElectionPayment(res, electionId, voterIdentifier)) return;
      res.status(409).json({ error: "A payment for this ballot is already in progress" });
      return;
    }
  }

  try {
    const voteOrPayment = await db.transaction(async (tx) => {
      const [lockedElection] = await tx.select().from(electionsTable)
        .where(eq(electionsTable.id, electionId))
        .for("update");
      if (!lockedElection) return { error: "election_not_found" as const };
      if (lockedElection.status !== "active") return { error: "election_closed" as const };

      const lockedNow = new Date();
      if (lockedElection.startsAt && lockedElection.startsAt > lockedNow) {
        return { error: "election_not_open" as const };
      }
      if (lockedElection.endsAt && lockedElection.endsAt <= lockedNow) {
        return { error: "election_closed" as const };
      }

      // The row lock serializes vote and payment-intent creation for this
      // election. Recheck here so a concurrent request cannot create a second
      // chargeable intent for a voter after both passed the optimistic checks.
      const [existingVote] = await tx.select({ id: votesTable.id }).from(votesTable)
        .where(and(eq(votesTable.electionId, electionId), eq(votesTable.voterIdentifier, voterIdentifier))).limit(1);
      if (existingVote) return { error: "already_voted" as const };

      if (isPaid) {
        const pendingResult = await tx.execute(sql`
          SELECT id
          FROM payment_intents
          WHERE pillar = 'election'
            AND entity_id = ${electionId}
            AND status IN ('initializing', 'pending', 'processing')
            AND payload->'election'->>'voterIdentifier' = ${voterIdentifier}
          LIMIT 1
        `);
        if (pendingResult.rows.length > 0) return { error: "payment_in_progress" as const };
      }

      // Candidate deletion uses the same election-row lock. Re-read the ballot
      // structure after acquiring it so a delete that committed first cannot
      // leave a vote referencing a candidate that no longer exists.
      const [lockedPositions, lockedCandidates] = await Promise.all([
        tx.select({
          id: positionsTable.id,
          maxSelections: positionsTable.maxSelections,
        }).from(positionsTable).where(eq(positionsTable.electionId, electionId)),
        tx.select({
          id: candidatesTable.id,
          positionId: candidatesTable.positionId,
        }).from(candidatesTable).where(eq(candidatesTable.electionId, electionId)),
      ]);
      const lockedPositionsById = new Map(lockedPositions.map(position => [position.id, position]));
      const lockedCandidatesById = new Map(lockedCandidates.map(candidate => [candidate.id, candidate]));
      for (const selection of bodyParsed.data.selections) {
        const position = lockedPositionsById.get(selection.positionId);
        if (!position || selection.candidateIds.length > position.maxSelections) {
          return { error: "ballot_structure_changed" as const };
        }
        if (selection.candidateIds.some(candidateId => lockedCandidatesById.get(candidateId)?.positionId !== selection.positionId)) {
          return { error: "ballot_structure_changed" as const };
        }
      }

      if (isPaid) {
        const { intent } = await createPaymentIntent({
          orgId: lockedElection.orgId,
          pillar: "election",
          entityId: lockedElection.id,
          entityTitle: lockedElection.title,
          transactionType: "vote",
          amount: paymentAmount * selectedCandidateCount * voteQuantity,
          currency: lockedElection.currency || "XAF",
          customerName: bodyParsed.data.customerName!,
          customerEmail: bodyParsed.data.customerEmail!,
          customerPhone: normalizedCustomerPhone!,
          payload: {
            election: {
              voterIdentifier,
              voterEmail: bodyParsed.data.voterEmail,
              voteQuantity,
              selections: bodyParsed.data.selections,
            },
          },
          database: tx,
        });
        return { paymentIntent: intent };
      }

      const [vote] = await tx.insert(votesTable).values({ electionId: lockedElection.id, voterIdentifier, quantity: voteQuantity }).returning();
      // Bulk insert all selections in one statement
      const selectionValues = bodyParsed.data.selections.flatMap(selection =>
        selection.candidateIds.map(candidateId => ({
          voteId: vote.id, positionId: selection.positionId, candidateId,
        }))
      );
      if (selectionValues.length > 0) {
        await tx.insert(voteSelectionsTable).values(selectionValues);
      }

      if (isPaid) {
        await recordTransaction({
          orgId: lockedElection.orgId,
          pillar: "election",
          entityId: lockedElection.id,
          entityTitle: lockedElection.title,
          transactionType: "vote",
          grossAmount: Number(lockedElection.paymentAmount) * selectedCandidateCount * voteQuantity,
          currency: lockedElection.currency || "XAF",
          payerEmail: bodyParsed.data.voterEmail,
        }, tx);
      }
      return { vote };
    });

    if ("error" in voteOrPayment) {
      if (voteOrPayment.error === "election_not_found") {
        res.status(404).json({ error: "Election not found" });
      } else if (voteOrPayment.error === "election_not_open") {
        res.status(403).json({ error: "This election has not opened for voting yet" });
      } else if (voteOrPayment.error === "already_voted") {
        res.status(403).json({ error: "You have already participated in this election" });
      } else if (voteOrPayment.error === "payment_in_progress") {
        if (await resumePendingElectionPayment(res, electionId, voterIdentifier)) return;
        res.status(409).json({ error: "A payment for this ballot is already in progress" });
      } else if (voteOrPayment.error === "ballot_structure_changed") {
        res.status(409).json({ error: "The ballot changed while you were submitting. Please review your selections and try again." });
      } else {
        res.status(403).json({ error: "This election is not currently open for voting" });
      }
      return;
    }

    if (voteOrPayment.paymentIntent) {
      try {
        const payload = await buildPaymentInitializationResponse(voteOrPayment.paymentIntent);
        res.json(payload);
      } catch (error: any) {
        await failPaymentIntent(voteOrPayment.paymentIntent.id, error?.message || "Payment initialization failed");
        res.status(502).json({ error: "Unable to start the payment. Please try again." });
      }
      return;
    }
  } catch (err: any) {
    // Unique constraint violation — two concurrent requests raced past the duplicate check
    if (isUniqueViolation(err)) {
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

  const needsOrganizationAccess = election.visibility !== "public" || election.status === "draft";
  const viewerRole = needsOrganizationAccess && req.session?.userId
    ? await getOrgRole(election.orgId, req.session.userId)
    : null;
  if (!canViewElectionResults(election.visibility, election.status, Boolean(viewerRole))) {
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

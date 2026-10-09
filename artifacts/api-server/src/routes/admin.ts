import { Router, type IRouter } from "express";
import { db, usersTable, platformSettingsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/platformAdmin";
import { bootstrapLimiter } from "../middlewares/rateLimit";
import { MAX_BOOTSTRAP_CODE_BYTES, MIN_BOOTSTRAP_CODE_BYTES, verifyBootstrapCode } from "../lib/bootstrap-code";
import { sql, eq } from "drizzle-orm";

const router: IRouter = Router();
const PLATFORM_ADMIN_ROLE_LOCK_KEY = 4_533_326;

/**
 * POST /api/admin/bootstrap
 * Grants the authenticated user platform-admin status only with the operator's
 * setup code and only if no platform admin currently exists.
 */
router.post("/admin/bootstrap", bootstrapLimiter, async (req, res): Promise<void> => {
  const sessionUserId = req.session.userId;
  if (!sessionUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const configuredCode = process.env.PLATFORM_ADMIN_BOOTSTRAP_SECRET;
  if (!configuredCode || Buffer.byteLength(configuredCode, "utf8") < MIN_BOOTSTRAP_CODE_BYTES) {
    res.status(503).json({ error: "First-administrator setup is not configured" });
    return;
  }

  const setupCode = typeof req.body?.setupCode === "string" ? req.body.setupCode : "";
  if (!setupCode || Buffer.byteLength(setupCode, "utf8") > MAX_BOOTSTRAP_CODE_BYTES) {
    res.status(400).json({ error: "Enter the one-time administrator setup code" });
    return;
  }
  if (!verifyBootstrapCode(configuredCode, setupCode)) {
    res.status(403).json({ error: "Invalid administrator setup code" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${PLATFORM_ADMIN_ROLE_LOCK_KEY}, 1)`);
    const [user] = await tx.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
    }).from(usersTable).where(eq(usersTable.id, sessionUserId)).limit(1);
    if (!user) return { type: "missing" as const };

    const [existing] = await tx.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.isPlatformAdmin, true))
      .limit(1);
    if (existing) return { type: "exists" as const };

    const [promoted] = await tx.update(usersTable)
      .set({ isPlatformAdmin: true })
      .where(eq(usersTable.id, user.id))
      .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });
    return { type: "created" as const, user: promoted };
  });

  if (result.type === "missing") {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (result.type === "exists") {
    res.status(409).json({ error: "A platform administrator already exists" });
    return;
  }

  res.json({ message: "You are now the platform administrator", user: result.user });
});

// Payment presentation is public because participants need it before payment.
router.get("/admin/platform-settings/public", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(platformSettingsTable).limit(1);
  if (settings) {
    res.json(settings);
    return;
  }
  res.json({
    id: null,
    paymentMode: "quantity_first",
    defaultCurrency: "XAF",
    supportedCurrencies: "XAF",
    supportEmail: null,
    supportPhone: null,
    supportWhatsapp: null,
    supportUrl: null,
    updatedAt: null,
  });
});

// All subsequent /admin routes require platform admin. Keep the path scope
// here because this router is mounted alongside public routes at /api.
router.use("/admin", requirePlatformAdmin);

router.get("/admin/platform-settings", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(platformSettingsTable).limit(1);
  if (settings) {
    res.json(settings);
    return;
  }
  const [created] = await db.insert(platformSettingsTable).values({}).returning();
  res.json(created);
});

router.patch("/admin/platform-settings", async (req, res): Promise<void> => {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const cleanOptional = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 320) : null;
  };
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (Object.prototype.hasOwnProperty.call(body, "paymentMode")) {
    if (body.paymentMode !== "amount_first" && body.paymentMode !== "quantity_first") {
      res.status(400).json({ error: "Payment mode must be amount_first or quantity_first" });
      return;
    }
    updates.paymentMode = body.paymentMode;
  }

  for (const field of ["supportEmail", "supportPhone", "supportWhatsapp", "supportUrl"]) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = cleanOptional(body[field]);
    }
  }

  const [existing] = await db.select().from(platformSettingsTable).limit(1);
  const [settings] = existing
    ? await db.update(platformSettingsTable).set(updates).where(eq(platformSettingsTable.id, existing.id)).returning()
    : await db.insert(platformSettingsTable).values({
        paymentMode: "quantity_first",
        defaultCurrency: "XAF",
        supportedCurrencies: "XAF",
        ...updates,
      }).returning();
  res.json(settings);
});

// GET /api/admin/stats — platform overview numbers
router.get("/admin/stats", async (_req, res): Promise<void> => {
  const { rows: [stats] } = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM users)::int                          AS total_users,
      (SELECT COUNT(*) FROM organizations)::int                  AS total_organizations,
      (SELECT COUNT(*) FROM elections)::int                      AS total_elections,
      (SELECT COUNT(*) FROM events)::int                         AS total_events,
      (SELECT COUNT(*) FROM campaigns)::int                      AS total_campaigns,
      (SELECT COUNT(*) FROM users
        WHERE created_at >= NOW() - INTERVAL '7 days')::int      AS new_users_7d,
      (SELECT COUNT(*) FROM organizations
        WHERE created_at >= NOW() - INTERVAL '7 days')::int      AS new_orgs_7d
  `);
  res.json(stats);
});

// GET /api/admin/users — all users
router.get("/admin/users", async (_req, res): Promise<void> => {
  const users = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.is_platform_admin,
      u.avatar_url,
      u.created_at,
      COUNT(om.org_id)::int AS org_count
    FROM users u
    LEFT JOIN organization_members om ON om.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);
  res.json(users.rows);
});

// GET /api/admin/organizations — all organizations with activity counts
router.get("/admin/organizations", async (_req, res): Promise<void> => {
  const orgs = await db.execute(sql`
    SELECT
      o.id,
      o.name,
      o.slug,
      o.created_at,
      COUNT(DISTINCT om.user_id)::int  AS member_count,
      COUNT(DISTINCT e.id)::int        AS election_count,
      COUNT(DISTINCT ev.id)::int       AS event_count,
      COUNT(DISTINCT c.id)::int        AS campaign_count
    FROM organizations o
    LEFT JOIN organization_members om ON om.org_id = o.id
    LEFT JOIN elections e  ON e.org_id = o.id
    LEFT JOIN events    ev ON ev.org_id = o.id
    LEFT JOIN campaigns c  ON c.org_id = o.id
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `);
  res.json(orgs.rows);
});

// PATCH /api/admin/users/:id/platform-admin — toggle platform admin flag
router.patch("/admin/users/:id/platform-admin", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = Number.parseInt(rawId, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  const { isPlatformAdmin } = req.body && typeof req.body === "object"
    ? req.body as { isPlatformAdmin?: unknown }
    : {};
  if (typeof isPlatformAdmin !== "boolean") {
    res.status(400).json({ error: "isPlatformAdmin must be a boolean" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${PLATFORM_ADMIN_ROLE_LOCK_KEY}, 1)`);
    const [target] = await tx.select({
      id: usersTable.id,
      name: usersTable.name,
      isPlatformAdmin: usersTable.isPlatformAdmin,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!target) return { type: "missing" as const };

    if (!isPlatformAdmin && target.isPlatformAdmin) {
      if (userId === req.session.userId) return { type: "self" as const };

      const [{ adminCount }] = await tx.select({
        adminCount: sql<number>`count(*)::int`,
      }).from(usersTable).where(eq(usersTable.isPlatformAdmin, true));
      if (adminCount <= 1) return { type: "last_admin" as const };
    }

    const [updated] = await tx.update(usersTable)
      .set({ isPlatformAdmin })
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        isPlatformAdmin: usersTable.isPlatformAdmin,
      });
    return { type: "updated" as const, user: updated };
  });

  if (result.type === "missing") {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (result.type === "self") {
    res.status(409).json({ error: "You cannot remove your own platform administrator access" });
    return;
  }
  if (result.type === "last_admin") {
    res.status(409).json({ error: "At least one platform administrator must remain" });
    return;
  }
  res.json(result.user);
});

// DELETE /api/admin/users/:id
router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = Number.parseInt(rawId, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  // prevent self-deletion
  if (userId === (req as any).session.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${PLATFORM_ADMIN_ROLE_LOCK_KEY}, 1)`);
    const [target] = await tx.select({
      isPlatformAdmin: usersTable.isPlatformAdmin,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!target) return "missing" as const;
    if (target.isPlatformAdmin) return "platform_admin" as const;
    await tx.delete(usersTable).where(eq(usersTable.id, userId));
    return "deleted" as const;
  });

  if (result === "missing") {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (result === "platform_admin") {
    res.status(409).json({ error: "Remove platform administrator access before deleting this account" });
    return;
  }
  res.json({ message: "User deleted" });
});

// DELETE /api/admin/organizations/:id
router.delete("/admin/organizations/:id", async (req, res): Promise<void> => {
  const orgId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(orgId) || orgId <= 0) {
    res.status(400).json({ error: "Invalid organization ID" });
    return;
  }

  let result: "deleted" | "missing" | "has_history";
  try {
    result = await db.transaction(async (tx) => {
      const { rows: [organization] } = await tx.execute(
        sql`SELECT id FROM organizations WHERE id = ${orgId}`,
      );
      if (!organization) return "missing" as const;

      const { rows: [history] } = await tx.execute(sql`
        SELECT (
          EXISTS (SELECT 1 FROM financial_transactions WHERE org_id = ${orgId})
          OR EXISTS (SELECT 1 FROM settlements WHERE org_id = ${orgId})
          OR EXISTS (
            SELECT 1 FROM tickets t
            INNER JOIN events e ON e.id = t.event_id
            WHERE e.org_id = ${orgId}
          )
          OR EXISTS (
            SELECT 1 FROM votes v
            INNER JOIN elections e ON e.id = v.election_id
            WHERE e.org_id = ${orgId}
          )
          OR EXISTS (
            SELECT 1 FROM campaign_responses r
            INNER JOIN campaigns c ON c.id = r.campaign_id
            WHERE c.org_id = ${orgId}
          )
        ) AS has_history
      `);
      if (history?.has_history) return "has_history" as const;

      await tx.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
      return "deleted" as const;
    }, { isolationLevel: "serializable" });
  } catch (error) {
    let current: unknown = error;
    while (current && typeof current === "object") {
      if ("code" in current && current.code === "40001") {
        res.status(409).json({ error: "Organization data changed during deletion. Please review it and try again." });
        return;
      }
      current = "cause" in current ? current.cause : undefined;
    }
    throw error;
  }

  if (result === "missing") {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  if (result === "has_history") {
    res.status(409).json({
      error: "This organization has financial, ticket, vote, or campaign-response history and cannot be deleted without an archive.",
    });
    return;
  }
  res.json({ message: "Organization deleted" });
});

export default router;

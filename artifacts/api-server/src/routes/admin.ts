import { Router, type IRouter } from "express";
import { db, usersTable, platformSettingsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/platformAdmin";
import { sql, eq } from "drizzle-orm";

const router: IRouter = Router();

/**
 * POST /api/admin/bootstrap
 * Grants the authenticated user platform-admin status — ONLY if no platform admin
 * currently exists. Self-sealing: once one admin exists this endpoint returns 409.
 */
router.post("/admin/bootstrap", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // The NOT EXISTS predicate is part of the UPDATE statement, so concurrent
  // bootstrap requests cannot both pass a separate check.
  const { rows: [user] } = await db.execute(sql`
    UPDATE users
    SET is_platform_admin = true
    WHERE id = ${req.session.userId}
      AND NOT EXISTS (SELECT 1 FROM users WHERE is_platform_admin = true)
    RETURNING id, name, email
  `);
  if (!user) {
    const { rows: [existing] } = await db.execute(
      sql`SELECT id FROM users WHERE is_platform_admin = true LIMIT 1`
    );
    res.status(existing ? 409 : 404).json({
      error: existing ? "A platform administrator already exists" : "User not found",
    });
    return;
  }

  res.json({ message: "You are now the platform administrator", user });
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
  const userId = parseInt(req.params.id);
  const { isPlatformAdmin } = req.body as { isPlatformAdmin: boolean };
  if (typeof isPlatformAdmin !== "boolean") {
    res.status(400).json({ error: "isPlatformAdmin must be a boolean" });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({ isPlatformAdmin })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id, name: usersTable.name, isPlatformAdmin: usersTable.isPlatformAdmin });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// DELETE /api/admin/users/:id
router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.id);
  // prevent self-deletion
  if (userId === (req as any).session.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
  res.json({ message: "User deleted" });
});

// DELETE /api/admin/organizations/:id
router.delete("/admin/organizations/:id", async (req, res): Promise<void> => {
  const orgId = parseInt(req.params.id);
  await db.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
  res.json({ message: "Organization deleted" });
});

export default router;

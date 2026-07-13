import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
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

  // Check whether any platform admin already exists
  const [existing] = await db.execute(
    sql`SELECT id FROM users WHERE is_platform_admin = true LIMIT 1`
  );
  if (existing) {
    res.status(409).json({ error: "A platform administrator already exists" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ isPlatformAdmin: true })
    .where(eq(usersTable.id, req.session.userId))
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

  res.json({ message: "You are now the platform administrator", user });
});

// All subsequent routes require platform admin
router.use(requirePlatformAdmin);

// GET /api/admin/stats — platform overview numbers
router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [stats] = await db.execute(sql`
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

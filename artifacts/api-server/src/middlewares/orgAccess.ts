import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db, organizationsTable, organizationMembersTable } from "@workspace/db";

export type OrgRole = "owner" | "admin" | "member";

/**
 * Resolves the current session user's role within the org identified by req.params.orgId,
 * or null if they have no relationship to it. Owner is derived from organizations.ownerId;
 * everyone else comes from organization_members.
 */
export async function getOrgRole(orgId: number, userId: number): Promise<OrgRole | null> {
  // Single JOIN query instead of two sequential round-trips
  const [row] = await db
    .select({ ownerId: organizationsTable.ownerId, memberRole: organizationMembersTable.role })
    .from(organizationsTable)
    .leftJoin(
      organizationMembersTable,
      and(
        eq(organizationMembersTable.orgId, organizationsTable.id),
        eq(organizationMembersTable.userId, userId),
      ),
    )
    .where(eq(organizationsTable.id, orgId))
    .limit(1);
  if (!row) return null;
  if (row.ownerId === userId) return "owner";
  return (row.memberRole as OrgRole) ?? null;
}

/**
 * Middleware factory: requires the session user to hold one of `roles` on the organization
 * referenced by req.params.orgId. Must run after requireAuth.
 */
export function requireOrgRole(roles: OrgRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;
    const orgId = parseInt(rawId, 10);
    if (Number.isNaN(orgId)) { res.status(400).json({ error: "Invalid organization ID" }); return; }
    const role = await getOrgRole(orgId, req.session.userId!);
    if (!role || !roles.includes(role)) { res.status(403).json({ error: "Insufficient permissions for this organization" }); return; }
    next();
  };
}

/**
 * Authorization for create endpoints where orgId is supplied in JSON.
 */
export function requireBodyOrgRole(roles: OrgRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const orgId = typeof req.body?.orgId === "number"
      ? req.body.orgId
      : parseInt(String(req.body?.orgId), 10);
    if (!Number.isInteger(orgId) || orgId <= 0) {
      res.status(400).json({ error: "Invalid organization ID" });
      return;
    }
    const role = await getOrgRole(orgId, req.session.userId!);
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: "Insufficient permissions for this organization" });
      return;
    }
    next();
  };
}

/**
 * Middleware factory: same as requireOrgRole, but resolves the org via a resource
 * (election/event/campaign) whose orgId column lives in `table`, keyed by req.params[paramName].
 */
export function requireResourceOrgRole(
  table: { id: any; orgId: any },
  paramName: string,
  roles: OrgRole[],
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawId = Array.isArray(req.params[paramName]) ? req.params[paramName][0] : req.params[paramName];
    const resourceId = parseInt(rawId, 10);
    if (Number.isNaN(resourceId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [row] = await db.select().from(table as any).where(eq(table.id, resourceId)).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const role = await getOrgRole((row as any).orgId, req.session.userId!);
    if (!role || !roles.includes(role)) { res.status(403).json({ error: "Insufficient permissions for this organization" }); return; }
    next();
  };
}

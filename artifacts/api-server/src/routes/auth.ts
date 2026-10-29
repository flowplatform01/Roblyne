import { Router, type IRouter, type Request } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, organizationsTable, usersTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

function establishSession(req: Request, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      req.session.userId = userId;
      req.session.save((saveErr: unknown) => {
        if (saveErr) {
          reject(saveErr);
          return;
        }
        resolve();
      });
    });
  });
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password, name } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await db.transaction(async (tx) => {
      const [createdUser] = await tx.insert(usersTable).values({ email, passwordHash, name }).returning();
      const workspaceName = `${name.trim().slice(0, 80) || "My"}'s workspace`;
      const slugBase = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
      await tx.insert(organizationsTable).values({
        name: workspaceName,
        slug: `${slugBase}-${randomUUID().slice(0, 8)}`,
        ownerId: createdUser.id,
      });
      return createdUser;
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    throw error;
  }

  await establishSession(req, user.id);
  res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
    isPlatformAdmin: user.isPlatformAdmin ?? false,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await establishSession(req, user.id);
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
    isPlatformAdmin: user.isPlatformAdmin ?? false,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((error) => error ? reject(error) : resolve());
  });
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
    isPlatformAdmin: user.isPlatformAdmin ?? false,
  });
});

router.patch("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { name, avatarUrl } = req.body as { name?: unknown; avatarUrl?: unknown };
  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0 || name.length > 100)) {
    res.status(400).json({ error: "Name must be between 1 and 100 characters" });
    return;
  }
  if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== "string") {
    res.status(400).json({ error: "Invalid avatarUrl" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = (name as string).trim();
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.session.userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
    isPlatformAdmin: user.isPlatformAdmin ?? false,
  });
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { currentPassword, newPassword } = req.body as { currentPassword?: unknown; newPassword?: unknown };
  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    res.status(400).json({ error: "Current password is required" });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, req.session.userId));

  res.json({ message: "Password updated successfully" });
});

export default router;

import { createHmac, randomInt } from "node:crypto";
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { db, emailOtpTokensTable, usersTable } from "@workspace/db";
import { isBrevoConfigured, sendPasswordResetOtp } from "../lib/brevo";

const router: IRouter = Router();
const PURPOSE = "password_reset";
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeEmail(value: unknown): string | null {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function otpHash(code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required");
  return createHmac("sha256", secret).update(`${PURPOSE}:${code}`).digest("hex");
}

router.post("/auth/password-reset/request", async (req, res): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  if (process.env.NODE_ENV === "production" && !isBrevoConfigured()) {
    res.status(503).json({ error: "Password reset email is not configured" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(202).json({ message: "If an account exists, a reset code has been sent." });
    return;
  }
  const [recent] = await db.select().from(emailOtpTokensTable)
    .where(and(eq(emailOtpTokensTable.userId, user.id), eq(emailOtpTokensTable.purpose, PURPOSE), isNull(emailOtpTokensTable.usedAt)))
    .orderBy(desc(emailOtpTokensTable.createdAt)).limit(1);
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: "Please wait before requesting another code" });
    return;
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const [token] = await db.insert(emailOtpTokensTable).values({ userId: user.id, purpose: PURPOSE, codeHash: otpHash(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) }).returning();
  try {
    if (process.env.NODE_ENV === "production") {
      await sendPasswordResetOtp({ email: user.email, name: user.name, code });
    }
  } catch {
    await db.delete(emailOtpTokensTable).where(eq(emailOtpTokensTable.id, token.id));
    res.status(502).json({ error: "Unable to send reset email. Please try again." });
    return;
  }
  const payload: Record<string, unknown> = { message: "If an account exists, a reset code has been sent." };
  if (process.env.NODE_ENV !== "production" && process.env.LOCAL_EMAIL_OTP_DEBUG === "true") payload.developmentCode = code;
  res.status(202).json(payload);
});

router.post("/auth/password-reset/confirm", async (req, res): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === "string" && /^\d{6}$/.test(req.body.code) ? req.body.code : null;
  const password = typeof req.body?.password === "string" && req.body.password.length >= 8 ? req.body.password : null;
  if (!email || !code || !password) {
    res.status(400).json({ error: "Enter your email, six-digit code, and a password of at least 8 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(400).json({ error: "The reset code is invalid or expired" });
    return;
  }
  const [token] = await db.select().from(emailOtpTokensTable).where(and(
    eq(emailOtpTokensTable.userId, user.id),
    eq(emailOtpTokensTable.purpose, PURPOSE),
    isNull(emailOtpTokensTable.usedAt),
    gt(emailOtpTokensTable.expiresAt, new Date()),
    lt(emailOtpTokensTable.attempts, MAX_ATTEMPTS),
  )).orderBy(desc(emailOtpTokensTable.createdAt)).limit(1);
  if (!token || token.codeHash !== otpHash(code)) {
    if (token) await db.update(emailOtpTokensTable).set({ attempts: token.attempts + 1 }).where(eq(emailOtpTokensTable.id, token.id));
    res.status(400).json({ error: "The reset code is invalid or expired" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ passwordHash: await bcrypt.hash(password, 12) }).where(eq(usersTable.id, user.id));
    await tx.update(emailOtpTokensTable).set({ usedAt: new Date() }).where(and(eq(emailOtpTokensTable.userId, user.id), eq(emailOtpTokensTable.purpose, PURPOSE), isNull(emailOtpTokensTable.usedAt)));
  });
  res.json({ message: "Password updated successfully" });
});

export default router;

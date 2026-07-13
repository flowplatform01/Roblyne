import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

// General ceiling for all API traffic — generous enough for normal browsing/polling.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

// Limit on auth endpoints (login/register) to blunt credential-stuffing / brute force.
// In development this is effectively off so testing multiple accounts is painless.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 10_000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
});

// Tighter limit specifically on state-changing requests (votes, registrations, submissions).
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isDev ? 10_000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  message: { error: "Too many submissions in a short time. Please slow down." },
});

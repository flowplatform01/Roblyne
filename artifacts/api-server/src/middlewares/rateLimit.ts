import rateLimit from "express-rate-limit";

// General ceiling for all API traffic — generous enough for normal browsing/polling.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

// Tighter limit on auth endpoints (login/register) to blunt credential-stuffing / brute force.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});

// Tighter limit specifically on state-changing requests (votes, registrations, submissions)
// to blunt scripted ballot-stuffing / ticket-hoarding / spam submissions.
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  message: { error: "Too many submissions in a short time. Please slow down." },
});

import type { CookieOptions } from "express-session";

export function sessionCookieOptions(isProduction = process.env.NODE_ENV === "production"): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    partitioned: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

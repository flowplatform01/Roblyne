import { createHash, randomBytes, verify, createPublicKey } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { and, eq, lte } from "drizzle-orm";
import { db, legalAcceptancesTable, organizationsTable, socialIdentitiesTable, usersTable } from "@workspace/db";
import {
  legalDocumentTypes,
  publishedLegalDocumentsWithDefaults,
  unpublishedDocumentTypes,
  unacceptedDocumentTypes,
  type PublishedLegalDocument,
} from "../lib/default-legal-documents";

const router: IRouter = Router();
const MAX_TRANSACTION_AGE_MS = 10 * 60 * 1000;
type Provider = "google" | "microsoft" | "linkedin" | "discord";
type Jwk = Record<string, string> & { kid?: string };
type IdTokenClaims = {
  iss: string;
  aud: string | string[];
  exp: number;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  nonce?: string;
  tid?: string;
};
type UserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};
type DiscordUserInfo = {
  id?: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
  email?: string;
  verified?: boolean;
};
type ProviderConfig = {
  clientId: () => string | null;
  clientSecret: () => string | null;
  authorizationEndpoint: () => string;
  tokenEndpoint: () => string;
  scope: string;
  jwksUri?: () => string;
  userInfoEndpoint?: string;
  prompt?: string;
  identityType: "oidc" | "discord";
  requireVerifiedEmail: boolean;
  issuerValid: (claims: IdTokenClaims) => boolean;
};

const jwksCache = new Map<string, { expiresAt: number; keys: Map<string, Jwk> }>();

function env(name: string): string | null {
  return process.env[name]?.trim() || null;
}

/**
 * OAuth client identifiers are opaque strings issued by the provider. Operators
 * sometimes paste a full console URL into the environment instead of the bare
 * identifier, which is sent verbatim as `client_id` and makes the provider
 * answer "Error 401: invalid_client". Strip any accidental scheme, host and
 * path so only the issued identifier leaves the server.
 */
function oauthClientId(name: string): string | null {
  const raw = env(name);
  if (!raw) return null;
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const segments = withoutScheme.split(/[/\\?#]/).map((segment) => segment.trim()).filter(Boolean);
  return segments.length ? segments[segments.length - 1]! : null;
}

function publicWebOrigin(): string | null {
  return parseOrigin(process.env.PUBLIC_WEB_URL);
}

function publicApiOrigin(): string | null {
  return parseOrigin(process.env.PUBLIC_API_URL);
}

function parseOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function microsoftTenant(): string | null {
  const tenant = env("MICROSOFT_OAUTH_TENANT");
  return tenant && /^[A-Za-z0-9.-]+$/.test(tenant) ? tenant : null;
}

const providerConfigs: Record<Provider, ProviderConfig> = {
  google: {
    clientId: () => oauthClientId("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: () => env("GOOGLE_OAUTH_CLIENT_SECRET"),
    authorizationEndpoint: () => "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: () => "https://oauth2.googleapis.com/token",
    jwksUri: () => "https://www.googleapis.com/oauth2/v3/certs",
    scope: "openid email profile",
    prompt: "select_account",
    requireVerifiedEmail: true,
    identityType: "oidc",
    issuerValid: (claims) => claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com",
  },
  microsoft: {
    clientId: () => oauthClientId("MICROSOFT_OAUTH_CLIENT_ID"),
    clientSecret: () => env("MICROSOFT_OAUTH_CLIENT_SECRET"),
    authorizationEndpoint: () => `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/authorize`,
    tokenEndpoint: () => `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/token`,
    jwksUri: () => `https://login.microsoftonline.com/${microsoftTenant()}/discovery/v2.0/keys`,
    scope: "openid email profile",
    userInfoEndpoint: "https://graph.microsoft.com/oidc/userinfo",
    prompt: "select_account",
    requireVerifiedEmail: false,
    identityType: "oidc",
    issuerValid: (claims) => Boolean(claims.tid && claims.iss === `https://login.microsoftonline.com/${claims.tid}/v2.0`),
  },
  linkedin: {
    clientId: () => oauthClientId("LINKEDIN_OAUTH_CLIENT_ID"),
    clientSecret: () => env("LINKEDIN_OAUTH_CLIENT_SECRET"),
    authorizationEndpoint: () => "https://www.linkedin.com/oauth/v2/authorization",
    tokenEndpoint: () => "https://www.linkedin.com/oauth/v2/accessToken",
    jwksUri: () => "https://www.linkedin.com/oauth/openid/jwks",
    scope: "openid email profile",
    userInfoEndpoint: "https://api.linkedin.com/v2/userinfo",
    requireVerifiedEmail: true,
    identityType: "oidc",
    issuerValid: (claims) => claims.iss === "https://www.linkedin.com",
  },
  discord: {
    clientId: () => oauthClientId("DISCORD_OAUTH_CLIENT_ID"),
    clientSecret: () => env("DISCORD_OAUTH_CLIENT_SECRET"),
    authorizationEndpoint: () => "https://discord.com/oauth2/authorize",
    tokenEndpoint: () => "https://discord.com/api/oauth2/token",
    scope: "identify email",
    identityType: "discord",
    requireVerifiedEmail: true,
    issuerValid: () => true,
  },
};

function isProvider(value: string): value is Provider {
  return value === "google" || value === "microsoft" || value === "linkedin" || value === "discord";
}

function configured(provider: Provider): boolean {
  const config = providerConfigs[provider];
  return Boolean(config.clientId() && config.clientSecret() && publicWebOrigin() && publicApiOrigin() && (provider !== "microsoft" || microsoftTenant()));
}

function requiredLegalDocumentsArePublished(documents: readonly PublishedLegalDocument[]): boolean {
  return unpublishedDocumentTypes(documents).length === 0;
}

function parseLegalDocumentIds(value: unknown): number[] {
  const raw = typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : [];
  const ids = raw.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry > 0);
  return [...new Set(ids)].slice(0, legalDocumentTypes.length);
}

function acceptsCurrentLegalDocuments(documentIds: number[], documents: readonly PublishedLegalDocument[]): boolean {
  return unacceptedDocumentTypes(documents, documentIds).length === 0;
}

function randomUrlSafe(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function safeReturnTo(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function redirectToWeb(res: import("express").Response, returnTo: string, error?: string): void {
  const origin = publicWebOrigin();
  if (!origin) {
    res.status(503).send("Social sign-in is unavailable until PUBLIC_WEB_URL is configured.");
    return;
  }
  const target = new URL(error ? "/login" : returnTo, origin);
  if (error) {
    target.searchParams.set("authError", error);
    if (returnTo !== "/dashboard") target.searchParams.set("returnTo", returnTo);
  }
  res.redirect(302, target.toString());
}

function establishSession(req: Request, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error: unknown) => {
      if (error) return reject(error);
      req.session.userId = userId;
      req.session.save((saveError: unknown) => saveError ? reject(saveError) : resolve());
    });
  });
}

function decodePart(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
}

async function signingKeys(jwksUri: string): Promise<Map<string, Jwk>> {
  const cached = jwksCache.get(jwksUri);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(jwksUri, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Identity-provider signing keys are unavailable");
  const data = await response.json() as { keys?: Jwk[] };
  const keys = new Map(data.keys?.filter((key) => key.kid).map((key) => [key.kid!, key]) ?? []);
  if (keys.size === 0) throw new Error("Identity-provider signing keys are unavailable");
  jwksCache.set(jwksUri, { keys, expiresAt: Date.now() + 60 * 60 * 1000 });
  return keys;
}

async function verifyIdToken(provider: Provider, idToken: string, nonce: string): Promise<IdTokenClaims> {
  const config = providerConfigs[provider];
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid identity token");
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]) as IdTokenClaims;
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Invalid identity token");
  if (!config.jwksUri) throw new Error("This identity provider does not use ID tokens");
  const key = (await signingKeys(config.jwksUri())).get(header.kid);
  if (!key || !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: key as any, format: "jwk" }), Buffer.from(parts[2], "base64url"))) {
    throw new Error("Invalid identity token");
  }
  const clientId = config.clientId();
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!clientId || !config.issuerValid(claims) || !audiences.includes(clientId) || claims.exp * 1000 <= Date.now() || claims.nonce !== nonce || !claims.sub) {
    throw new Error("Identity token validation failed");
  }
  return claims;
}

async function discordUserInfo(accessToken: string): Promise<{ subject: string; email: string; name: string; avatarUrl: string | null }> {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Unable to retrieve Discord profile");
  const profile = await response.json() as DiscordUserInfo;
  const subject = profile.id?.trim();
  const email = profile.email?.trim().toLowerCase();
  if (!subject || !email || profile.verified !== true) {
    throw new Error("Discord did not provide a verified email address");
  }
  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(subject)}/${encodeURIComponent(profile.avatar)}.png`
    : null;
  return { subject, email, name: profile.global_name?.trim() || profile.username?.trim() || email.split("@")[0], avatarUrl };
}

async function userInfo(config: ProviderConfig, accessToken: string, subject: string): Promise<UserInfo> {
  if (!config.userInfoEndpoint) return {};
  const response = await fetch(config.userInfoEndpoint, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Unable to retrieve identity-provider profile");
  const profile = await response.json() as UserInfo;
  if (profile.sub !== subject) throw new Error("Identity-provider profile mismatch");
  return profile;
}

router.get("/auth/providers", (_req, res): void => {
  res.json({
    google: configured("google"),
    microsoft: configured("microsoft"),
    linkedin: configured("linkedin"),
    discord: configured("discord"),
  });
});

router.get("/auth/oauth/:provider/start", (req, res): void => {
  const provider = req.params.provider;
  if (!isProvider(provider) || !configured(provider)) {
    res.status(503).json({ error: "That sign-in provider is not configured" });
    return;
  }
  const config = providerConfigs[provider];
  const apiOrigin = publicApiOrigin()!;
  const state = randomUrlSafe();
  const nonce = randomUrlSafe();
  const codeVerifier = randomUrlSafe(48);
  const mode = req.session.userId ? "link" : "signin";
  req.session.oauthTransaction = {
    provider,
    state,
    nonce,
    codeVerifier,
    returnTo: safeReturnTo(req.query.returnTo),
    mode,
    legalDocumentIds: parseLegalDocumentIds(req.query.legalDocumentIds),
    createdAt: Date.now(),
  };
  const params = new URLSearchParams({
    client_id: config.clientId()!,
    redirect_uri: `${apiOrigin}/api/auth/oauth/${provider}/callback`,
    response_type: "code",
    scope: config.scope,
    state,
    ...(config.identityType === "oidc" ? { nonce } : {}),
    code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"),
    code_challenge_method: "S256",
    ...(config.prompt ? { prompt: config.prompt } : {}),
  });
  req.session.save((error) => error ? res.status(500).json({ error: "Unable to start sign-in" }) : res.redirect(302, `${config.authorizationEndpoint()}?${params}`));
});

router.get("/auth/oauth/:provider/callback", async (req, res): Promise<void> => {
  const provider = req.params.provider;
  const transaction = req.session.oauthTransaction;
  delete req.session.oauthTransaction;
  if (!isProvider(provider) || !transaction || transaction.provider !== provider || transaction.state !== req.query.state || Date.now() - transaction.createdAt > MAX_TRANSACTION_AGE_MS) {
    redirectToWeb(res, "/login", "social_state_invalid");
    return;
  }
  if (typeof req.query.error === "string") {
    redirectToWeb(res, transaction.returnTo, `${provider}_cancelled`);
    return;
  }
  if (typeof req.query.code !== "string" || !configured(provider)) {
    redirectToWeb(res, transaction.returnTo, `${provider}_callback_invalid`);
    return;
  }
  try {
    const config = providerConfigs[provider];
    const apiOrigin = publicApiOrigin()!;
    const body = new URLSearchParams({
      code: req.query.code,
      client_id: config.clientId()!,
      client_secret: config.clientSecret()!,
      redirect_uri: `${apiOrigin}/api/auth/oauth/${provider}/callback`,
      grant_type: "authorization_code",
      code_verifier: transaction.codeVerifier,
    });
    const tokenResponse = await fetch(config.tokenEndpoint(), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000) });
    const token = await tokenResponse.json() as { id_token?: string; access_token?: string };
    if (!tokenResponse.ok || !token.access_token) throw new Error("Identity-provider token exchange failed");
    const identityDetails = config.identityType === "discord"
      ? await discordUserInfo(token.access_token)
      : await (async () => {
          if (!token.id_token) throw new Error("Identity-provider token exchange failed");
          const claims = await verifyIdToken(provider, token.id_token, transaction.nonce);
          const profile = await userInfo(config, token.access_token!, claims.sub);
          const rawEmail = profile.email ?? claims.email;
          const emailVerified = profile.email_verified ?? claims.email_verified;
          if (!rawEmail || (config.requireVerifiedEmail && emailVerified !== true)) {
            throw new Error("Identity provider did not provide a verified email address");
          }
          return {
            subject: claims.sub,
            email: rawEmail.trim().toLowerCase(),
            name: profile.name ?? claims.name ?? rawEmail.split("@")[0],
            avatarUrl: profile.picture ?? claims.picture ?? null,
          };
        })();
    const { subject, email, name, avatarUrl } = identityDetails;
    const [identity] = await db.select().from(socialIdentitiesTable).where(and(eq(socialIdentitiesTable.provider, provider), eq(socialIdentitiesTable.providerSubject, subject))).limit(1);
    if (transaction.mode === "link") {
      if (!req.session.userId || identity?.userId && identity.userId !== req.session.userId) return redirectToWeb(res, transaction.returnTo, `${provider}_identity_in_use`);
      const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
      if (!currentUser || currentUser.email !== email) return redirectToWeb(res, transaction.returnTo, `${provider}_email_mismatch`);
      if (!identity) await db.insert(socialIdentitiesTable).values({ userId: currentUser.id, provider, providerSubject: subject, email });
      return redirectToWeb(res, transaction.returnTo);
    }
    if (identity) {
      await establishSession(req, identity.userId);
      return redirectToWeb(res, transaction.returnTo);
    }
    const [emailUser] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (emailUser) return redirectToWeb(res, "/login", `${provider}_account_link_required`);
    const currentLegalDocumentsForSignup = await publishedLegalDocumentsWithDefaults();
    if (!requiredLegalDocumentsArePublished(currentLegalDocumentsForSignup)) {
      return redirectToWeb(res, "/login", "registration_legal_documents_unavailable");
    }
    if (!acceptsCurrentLegalDocuments(transaction.legalDocumentIds, currentLegalDocumentsForSignup)) {
      return redirectToWeb(res, "/register", "social_legal_acceptance_required");
    }
    const acceptedLegalDocuments = currentLegalDocumentsForSignup.filter((document) => transaction.legalDocumentIds.includes(document.id));
    const user = await db.transaction(async (tx) => {
      const [created] = await tx.insert(usersTable).values({ email, name: name.slice(0, 100), avatarUrl, passwordHash: null }).returning();
      const workspace = `${created.name.slice(0, 80) || "My"}'s workspace`;
      const slug = `${workspace.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace"}-${randomBytes(4).toString("hex")}`;
      await tx.insert(organizationsTable).values({ name: workspace, slug, ownerId: created.id });
      await tx.insert(socialIdentitiesTable).values({ userId: created.id, provider, providerSubject: subject, email });
      await tx.insert(legalAcceptancesTable).values(acceptedLegalDocuments.map((document) => ({
        userId: created.id,
        legalDocumentId: document.id,
        documentType: document.documentType,
        documentVersion: document.version,
      })));
      return created;
    });
    await establishSession(req, user.id);
    redirectToWeb(res, transaction.returnTo);
  } catch (error) {
    req.log.warn({ err: error, provider }, "Social OAuth callback failed");
    redirectToWeb(res, transaction.returnTo, `${provider}_signin_failed`);
  }
});

export default router;

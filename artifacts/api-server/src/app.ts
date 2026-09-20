import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import { apiLimiter, authLimiter, writeLimiter, searchLimiter } from "./middlewares/rateLimit";
import router from "./routes";
import { logger } from "./lib/logger";

const PgSession = connectPgSimple(session);

const app: Express = express();

// Trust reverse proxy headers (Replit routes traffic through a proxy)
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false, // frontend served separately behind Vite/its own CSP
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader("X-Request-Id", String(req.id));
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    (req as any).rawBody = Buffer.from(buf);
  },
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret === "evenum-dev-secret") {
  if (process.env.NODE_ENV === "production") {
    // Hard failure in production — running without a real secret is a critical security risk.
    logger.fatal("SESSION_SECRET environment variable is not set or is still the dev default. Refusing to start in production.");
    process.exit(1);
  } else {
    logger.warn("SESSION_SECRET is not set. Using insecure default. Set SESSION_SECRET before deploying to production.");
  }
}

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      pruneSessionInterval: 60 * 60, // prune expired sessions hourly
    }),
    secret: sessionSecret ?? "evenum-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);
app.use("/api", writeLimiter);
// Dedicated tighter limit on public search/discover to prevent scraping
app.use(["/api/search", "/api/discover"], searchLimiter);
app.use("/api", router);

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.status(404).json({ error: "Not found", requestId: req.id });
});

// Global error handler — must be the last middleware registered.
// Catches any error thrown (or passed to next()) by route handlers.
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  req.log.error(
    {
      err,
      method: req.method,
      route: req.route?.path,
      url: req.url?.split("?")[0],
      requestId: req.id,
      userId: req.session.userId,
    },
    "Unhandled route error",
  );
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error", requestId: req.id });
});

export default app;

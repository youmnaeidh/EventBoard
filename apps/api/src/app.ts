import path from "node:path";
import { existsSync } from "node:fs";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { pool } from "./db.js";
import { loadUser } from "./middleware/auth.js";
import { errorMiddleware } from "./middleware/errors.js";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { eventsRouter } from "./routes/events.js";
import { meRouter } from "./routes/me.js";
import { organizerRouter } from "./routes/organizer.js";
import { trackRouter } from "./routes/track.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Behind Render/Fly/Heroku-style proxies the real client IP is in X-Forwarded-For (needed for rate limits).
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": ["'self'", "data:", "https:"],
          "media-src": ["'self'"],
          "connect-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "script-src": ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    if (origin && config.PUBLIC_WEB_ORIGIN && origin === config.PUBLIC_WEB_ORIGIN) {
      res.setHeader("Access-Control-Allow-Origin", config.PUBLIC_WEB_ORIGIN);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") return res.status(204).end();
    }
    next();
  });
  app.use(express.json({ limit: "50kb" }));
  app.use(cookieParser());

  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "degraded" });
    }
  });

  app.use("/api", loadUser);
  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/organizer", organizerRouter);
  app.use("/api", trackRouter);
  app.use("/api", aiRouter);
  app.use("/api", eventsRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "المسار غير موجود" } });
  });

  // Single-origin deployment: the API also serves the built web app (history-API fallback to index.html).
  if (config.WEB_DIST && existsSync(config.WEB_DIST)) {
    const dist = path.resolve(config.WEB_DIST);
    app.use(express.static(dist, { maxAge: "7d", index: false }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.use(errorMiddleware);
  return app;
}

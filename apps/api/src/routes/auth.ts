import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { one, query } from "../db.js";
import { categories } from "../seed/data.js";
import { clearSession, issueSession, requireAuth } from "../middleware/auth.js";
import { conflict, handler, unauthorized } from "../middleware/errors.js";
import { config } from "../config.js";
import jwt from "jsonwebtoken";

function publicAccessToken(req: import("express").Request, userId: string): { accessToken: string } | object {
  // Short-lived JS-visible token is issued ONLY to the trusted GitHub Pages browser origin.
  return config.PUBLIC_WEB_ORIGIN && req.get("origin") === config.PUBLIC_WEB_ORIGIN
    ? { accessToken: jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: "8h" }) }
    : {};
}

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT ?? (process.env.NODE_ENV === "test" ? 1000 : 20)), // per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "محاولات كثيرة، حاول بعد قليل" } }
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جدًا").max(80),
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح").max(160),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(100),
  role: z.enum(["attendee", "organizer"]).default("attendee"),
  interests: z.array(z.enum(categories)).max(4).default([])
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(100)
});

const publicUser = `id, name, email, role, interests`;

authRouter.post(
  "/register",
  limiter,
  handler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const exists = await one("SELECT 1 FROM users WHERE email = $1", [body.email]);
    if (exists) throw conflict("هذا البريد مسجّل من قبل", "email_taken");
    const hash = await bcrypt.hash(body.password, 10);
    const user = await one(
      `INSERT INTO users (name, email, password_hash, role, interests) VALUES ($1,$2,$3,$4,$5) RETURNING ${publicUser}`,
      [body.name, body.email, hash, body.role, body.interests]
    );
    issueSession(res, (user as { id: string }).id);
    res.status(201).json({ user, ...publicAccessToken(req, (user as { id: string }).id) });
  })
);

authRouter.post(
  "/login",
  limiter,
  handler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const row = await one<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [body.email]
    );
    // Same response whether the email or the password is wrong (no account enumeration).
    const ok = row ? await bcrypt.compare(body.password, row.password_hash) : await bcrypt.compare(body.password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidu");
    if (!row || !ok) throw unauthorized("البريد أو كلمة المرور غير صحيحة");
    issueSession(res, row.id);
    const user = await one(`SELECT ${publicUser} FROM users WHERE id = $1`, [row.id]);
    res.json({ user, ...publicAccessToken(req, row.id) });
  })
);

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

authRouter.get("/me", (req, res) => {
  res.json({ user: req.user ?? null });
});

const interestsSchema = z.object({ interests: z.array(z.enum(categories)).max(4) });
authRouter.put(
  "/me/interests",
  requireAuth,
  handler(async (req, res) => {
    const { interests } = interestsSchema.parse(req.body);
    await query("UPDATE users SET interests = $1 WHERE id = $2", [interests, req.user!.id]);
    res.json({ interests });
  })
);

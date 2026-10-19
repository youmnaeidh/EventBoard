import type { CookieOptions, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { one } from "../db.js";
import { forbidden, unauthorized } from "./errors.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "attendee" | "organizer";
  interests: string[];
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const COOKIE = "eb_token";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const tokenPayload = z.object({ sub: z.string().uuid() });

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.COOKIE_SECURE ? config.COOKIE_SECURE === "true" : config.NODE_ENV === "production",
  maxAge: MAX_AGE_MS,
  path: "/"
};

export function issueSession(res: Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE, token, cookieOptions);
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
}

/** Loads the user for the session cookie, if any. Never rejects: anonymous requests continue. */
export const loadUser: RequestHandler = async (req, _res, next) => {
  try {
    const bearer = req.get("authorization");
    const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : (req.cookies?.[COOKIE] as string | undefined);
    if (token) {
      const payload = tokenPayload.safeParse(jwt.verify(token, config.JWT_SECRET));
      if (payload.success) {
        const user = await one<AuthUser>(
          "SELECT id, name, email, role, interests FROM users WHERE id = $1",
          [payload.data.sub]
        );
        if (user) req.user = user;
      }
    }
  } catch {
    // expired or tampered token: treat as anonymous
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

export const requireOrganizer: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "organizer") return next(forbidden("هذه الصفحة للمنظّمين فقط"));
  next();
};

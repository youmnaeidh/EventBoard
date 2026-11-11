import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { handler, notFound } from "../middleware/errors.js";
import {one} from '../db.js';
import { recordInteraction } from "../services/interactions.js";

export const trackRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 10_000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "طلبات كثيرة" } }
});

// Only whitelisted keys are stored, with bounded lengths. No free-form blobs from clients.
const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("view"),
    sessionId: z.string().min(8).max(64),
    eventId: z.number().int().positive(),
    source: z.enum(["home", "search", "list", "map", "recommendation", "assistant", "shared"]).optional()
  }),
  z.object({
    type: z.literal("share"),
    sessionId: z.string().min(8).max(64),
    eventId: z.number().int().positive()
  })
]);

trackRouter.post(
  "/track",
  limiter,
  handler(async (req, res) => {
    const body = schema.parse(req.body);
    if (!(await one("SELECT 1 FROM events WHERE id=$1 AND publication_status='published'",[body.eventId]))) throw notFound('هذي الفعالية غير موجودة');
    await recordInteraction({
      userId: req.user?.id ?? null,
      sessionId: body.sessionId,
      eventId: body.eventId,
      type: body.type,
      meta: body.type === "view" && body.source ? { source: body.source } : {}
    });
    res.status(204).end();
  })
);

import { randomUUID } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../db.js";
import { HttpError, handler } from "../middleware/errors.js";
import {
  aiEnabled,
  callAi,
  toAiEvent,
  type AssistantResponse,
  type RecommendResponse,
  type SearchResponse
} from "../services/aiClient.js";
import { listEvents, type EventDto } from "../services/events.js";
import { recordInteraction } from "../services/interactions.js";
import { fallbackSearch, searchConstraints, withinConstraints } from "../services/searchConstraints.js";

export const aiRouter = Router();

const sessionIdSchema = z.string().min(8).max(64).optional();
const location = {
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
};

const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 10_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "أسئلة كثيرة بوقت قصير، انتظر شوي" } }
});

function hasLocation(l: { lat?: number; lng?: number }): l is { lat: number; lng: number } {
  return l.lat !== undefined && l.lng !== undefined;
}

// ---- smart search -------------------------------------------------------------------------------

const searchSchema = z.object({
  q: z.string().trim().min(1).max(200),
  category: z.string().max(40).optional(),
  district: z.string().max(60).optional(),
  price: z.enum(["free", "paid"]).optional(),
  sessionId: sessionIdSchema,
  limit: z.coerce.number().int().min(1).max(50).default(24),
  ...location
});

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

/** Used only when the AI service is unreachable: plain keyword matching over the catalogue. */
function basicSearch(q: string, events: EventDto[]) {
  const tokens = normalise(q).split(/\s+/).filter((t) => t.length > 1);
  const scored = events
    .map((event) => {
      const hay = normalise([event.title, event.summary, event.category, event.eventType, event.district, event.venue, event.audience].join(" "));
      const hits = tokens.filter((t) => hay.includes(t)).length;
      return { event, score: tokens.length ? hits / tokens.length : 0, reasons: hits ? ["تطابق في الكلمات"] : [] };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored;
}

aiRouter.get(
  "/search",
  handler(async (req, res) => {
    const params = searchSchema.parse(req.query);
    const constraints = searchConstraints(params.q);
    const loc = hasLocation(params) ? { lat: params.lat, lng: params.lng } : null;
    const { events } = await listEvents({
      category: params.category,
      district: params.district,
      price: params.price,
      status: "upcoming",
      sort: "soonest",
      limit: 100,
      userId: req.user?.id ?? null,
      lat: loc?.lat,
      lng: loc?.lng
    });
    const candidates = events.filter(e => withinConstraints(e, constraints));
    const byId = new Map(candidates.map((e) => [e.id, e]));

    const ai = await callAi<SearchResponse>("/v1/search", {
      query: params.q,
      events: candidates.map(toAiEvent),
      now: new Date().toISOString(),
      location: loc,
      limit: params.limit
    });

    let results: { event: EventDto; score: number; reasons: string[] }[];
    let payload: Record<string, unknown>;
    if (ai) {
      results = ai.results.flatMap((r) => {
        const event = byId.get(r.eventId);
        return event ? [{ event, score: r.score, reasons: r.reasons }] : [];
      });
      payload = { mode: "ai", engine: ai.engine, interpretation: ai.interpretation, chips: ai.chips, relaxed: ai.relaxed };
    } else {
      results = fallbackSearch(params.q, candidates).slice(0, params.limit);
      payload = { mode: "basic", engine: "constrained-keyword", interpretation: constraints, chips: [constraints.free ? "مجانية" : "", constraints.maxPrice && !constraints.free ? `حتى ${constraints.maxPrice} ر.س` : "", constraints.when ? "الموعد المحدد في بحثك" : ""].filter(Boolean), relaxed: false };
    }

    // Logged for the organizer demand report: what people look for and whether they found it.
    await recordInteraction({
      userId: req.user?.id ?? null,
      sessionId: params.sessionId ?? `anon-${randomUUID()}`,
      type: "search",
      meta: { q: params.q.slice(0, 120), category: params.category ?? null, results: results.length,
        engine: ai ? 'ai' : 'fallback', constrainedInventory: candidates.length, period:constraints.when ?? null }
    });

    res.json({ ...payload, results });
  })
);

// ---- recommendations ----------------------------------------------------------------------------

const recSchema = z.object({
  sessionId: sessionIdSchema,
  limit: z.coerce.number().int().min(1).max(20).default(8),
  ...location
});

const WEIGHT_SQL = `CASE type WHEN 'view' THEN 1 WHEN 'share' THEN 2 WHEN 'favorite' THEN 3 WHEN 'book' THEN 5 WHEN 'unfavorite' THEN -3 ELSE 0 END`;

async function userHistory(userId: string | null, sessionId: string | undefined) {
  if (!userId && !sessionId) return [];
  const rows = await query<{ eventId: number; weight: number; at: Date }>(
    `SELECT event_id AS "eventId", LEAST(8, SUM(${WEIGHT_SQL}))::float AS weight, MAX(created_at) AS at
     FROM interactions
     WHERE event_id IS NOT NULL AND created_at > now() - interval '90 days'
       AND (${userId ? "user_id = $1" : "session_id = $1"})
     GROUP BY event_id HAVING SUM(${WEIGHT_SQL}) > 0`,
    [userId ?? sessionId]
  );
  return rows.map((r) => ({ eventId: r.eventId, weight: r.weight, at: r.at.toISOString() }));
}

/** user x event weights for collaborative filtering; users are re-indexed so no ids leave the API. */
async function interactionMatrix() {
  const rows = await query<{ u: string; e: number; w: number }>(
    `SELECT user_id::text AS u, event_id AS e, LEAST(6, SUM(${WEIGHT_SQL}))::float AS w
     FROM interactions
     WHERE user_id IS NOT NULL AND event_id IS NOT NULL AND created_at > now() - interval '90 days'
     GROUP BY user_id, event_id HAVING SUM(${WEIGHT_SQL}) > 0
     LIMIT 30000`
  );
  const index = new Map<string, number>();
  return rows.map((r) => {
    if (!index.has(r.u)) index.set(r.u, index.size);
    return [index.get(r.u) as number, r.e, r.w];
  });
}

aiRouter.get(
  "/recommendations",
  handler(async (req, res) => {
    const params = recSchema.parse(req.query);
    const loc = hasLocation(params) ? { lat: params.lat, lng: params.lng } : null;
    const userId = req.user?.id ?? null;

    const { events } = await listEvents({
      status: "upcoming",
      sort: "soonest",
      limit: 100,
      userId,
      lat: loc?.lat,
      lng: loc?.lng
    });
    const byId = new Map(events.map((e) => [e.id, e]));
    const history = await userHistory(userId, params.sessionId);

    // History may contain events that already ended; the service needs their text to compare content.
    const catalogIds = new Set(events.map((e) => e.id));
    const missing = history.map((h) => h.eventId).filter((id) => !catalogIds.has(id));
    const pastEvents = missing.length
      ? (await listEvents({ ids: missing, status: "all", limit: 100 })).events
      : [];

    const booked = userId
      ? (await query<{ event_id: number }>("SELECT event_id FROM bookings WHERE user_id = $1 AND status = 'confirmed'", [userId])).map((r) => r.event_id)
      : [];

    const ai = await callAi<RecommendResponse>("/v1/recommend", {
      events: events.map(toAiEvent),
      pastEvents: pastEvents.map(toAiEvent),
      user: { interests: req.user?.interests ?? [], history },
      excludeIds: booked,
      matrix: await interactionMatrix(),
      now: new Date().toISOString(),
      location: loc,
      limit: params.limit
    });

    if (ai) {
      const items = ai.recommendations.flatMap((r) => {
        const event = byId.get(r.eventId);
        return event ? [{ event, score: r.score, components: r.components, reasons: r.reasons }] : [];
      });
      return res.json({ mode: "ai", strategy: ai.strategy, items });
    }

    // Fallback: interests + recent popularity. Same response shape, simpler reasons.
    const interests = new Set(req.user?.interests ?? []);
    const seen = new Set(history.map((h) => h.eventId));
    const items = events
      .filter((e) => !booked.includes(e.id))
      .map((event) => ({
        event,
        score: event.popularity / 100 + (interests.has(event.category) ? 3 : 0) - (seen.has(event.id) ? 1 : 0),
        components: {},
        reasons: [interests.has(event.category) ? `من اهتماماتك: ${event.category}` : "من الأكثر إقبالًا هذا الأسبوع"]
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit);
    res.json({ mode: "basic", strategy: interests.size ? "personalized" : "cold_start", items });
  })
);

// ---- assistant ----------------------------------------------------------------------------------

const assistantSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(500) }))
    .min(1)
    .max(10),
  ...location
});

aiRouter.post(
  "/assistant",
  assistantLimiter,
  handler(async (req, res) => {
    const body = assistantSchema.parse(req.body);
    if (body.messages[body.messages.length - 1]?.role !== "user") {
      throw new HttpError(400, "bad_request", "آخر رسالة لازم تكون من المستخدم");
    }
    const loc = hasLocation(body) ? { lat: body.lat, lng: body.lng } : null;
    const { events } = await listEvents({
      status: "upcoming", sort: "soonest", limit: 100, userId: req.user?.id ?? null, lat: loc?.lat, lng: loc?.lng
    });
    const byId = new Map(events.map((e) => [e.id, e]));

    const ai = await callAi<AssistantResponse>("/v1/assistant", {
      messages: body.messages,
      events: events.map(toAiEvent),
      location: loc,
      now: new Date().toISOString()
    });
    if (!ai) {
      throw new HttpError(503, "ai_unavailable", "المساعد غير متاح الحين، جرّب البحث في صفحة الفعاليات");
    }
    res.json({
      answer: ai.answer,
      mode: ai.mode,
      chips: ai.chips ?? [],
      events: ai.eventIds.flatMap((id) => (byId.has(id) ? [byId.get(id) as EventDto] : []))
    });
  })
);

aiRouter.get("/ai/status", (_req, res) => {
  res.json({ configured: aiEnabled() });
});

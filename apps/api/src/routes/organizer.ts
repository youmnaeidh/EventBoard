import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db.js";
import { requireOrganizer } from "../middleware/auth.js";
import { badRequest, conflict, forbidden, handler, HttpError, notFound } from "../middleware/errors.js";
import { categories, districts } from "../seed/data.js";
import {
  callAi,
  toAiEvent,
  type DemandGapsResponse,
  type ForecastRequest,
  type ForecastResponse
} from "../services/aiClient.js";
import { getEventByRef, listEvents } from "../services/events.js";

export const organizerRouter = Router();
organizerRouter.use(requireOrganizer);

const DAY = 24 * 3_600_000;
const isoDate = z.string().datetime({ offset: true, message: "صيغة التاريخ غير صحيحة" });

const eventSchema = z
  .object({
    title: z.string().trim().min(3, "العنوان قصير").max(120),
    summary: z.string().trim().min(10, "الملخص قصير (10 أحرف على الأقل)").max(300),
    description: z.string().trim().min(20, "الوصف قصير (20 حرف على الأقل)").max(2000),
    category: z.enum(categories),
    eventType: z.string().trim().min(2).max(30),
    venue: z.string().trim().min(2).max(120),
    district: z.string().refine((d) => d in districts, "حي غير معروف"),
    startsAt: isoDate,
    endsAt: isoDate,
    price: z.coerce.number().min(0).max(5000).default(0),
    capacity: z.coerce.number().int().min(1).max(20000).nullable().optional(),
    audience: z.string().trim().min(2).max(80).default("الجميع"),
    highlights: z.array(z.string().trim().min(2).max(80)).max(6).default([]),
    imageUrl: z
      .string()
      .max(500)
      .refine((u) => /^https:\/\/[^\s]+$/.test(u) || /^\/assets\/events\/[a-zA-Z0-9_-]+\.(?:webp|jpg|jpeg|png)$/.test(u), "استخدم رابط https أو صورة من مكتبة الفعاليات")
      .nullable()
      .optional()
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { message: "وقت النهاية لازم يكون بعد البداية", path: ["endsAt"] })
  .refine((v) => new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime() <= 14 * DAY, {
    message: "مدة الفعالية الأقصى 14 يوم",
    path: ["endsAt"]
  });

function slugFor(): string {
  return `ev-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// ---- my events + stats --------------------------------------------------------------------------

organizerRouter.get(
  "/events",
  handler(async (req, res) => {
    const userId = req.user!.id;
    const { events } = await listEvents({ organizerId: userId, status: "all", sort: "soonest", limit: 100, userId });
    const stats = await query<{
      id: number; views: number; favorites: number; bookings: number; seats: number; revenue: number;
    }>(
      `SELECT e.id,
         (SELECT COUNT(*)::int FROM interactions i WHERE i.event_id = e.id AND i.type = 'view') AS views,
         (SELECT COUNT(*)::int FROM favorites f WHERE f.event_id = e.id) AS favorites,
         (SELECT COUNT(*)::int FROM bookings b WHERE b.event_id = e.id AND b.status = 'confirmed') AS bookings,
         (SELECT COALESCE(SUM(b.seats),0)::int FROM bookings b WHERE b.event_id = e.id AND b.status = 'confirmed') AS seats,
         (SELECT COALESCE(SUM(b.seats),0) * e.price_sar FROM bookings b WHERE b.event_id = e.id AND b.status = 'confirmed') AS revenue
       FROM events e WHERE e.organizer_id = $1`,
      [userId]
    );
    const byId = new Map(stats.map((s) => [s.id, s]));
    res.json({
      events: events.map((event) => {
        const s = byId.get(event.id);
        const seats = s?.seats ?? 0;
        return {
          event,
          stats: {
            views: s?.views ?? 0,
            favorites: s?.favorites ?? 0,
            bookings: s?.bookings ?? 0,
            seats,
            revenue: Number(s?.revenue ?? 0),
            fillRate: event.capacity ? Math.round((seats / event.capacity) * 100) : null,
            conversion: s && s.views > 0 ? Math.round((s.bookings / s.views) * 1000) / 10 : 0
          }
        };
      })
    });
  })
);

organizerRouter.post(
  "/events",
  handler(async (req, res) => {
    const body = eventSchema.parse(req.body);
    if (new Date(body.startsAt).getTime() < Date.now() - 60_000) throw badRequest("وقت البداية لازم يكون في المستقبل");
    const d = districts[body.district]!;
    const capacity = body.capacity ?? null;
    const row = await one<{ id: number }>(
      `INSERT INTO events (slug, title, summary, description, category, event_type, image_url, venue, district, lat, lng,
         starts_at, ends_at, price_sar, requires_booking, capacity, audience, highlights, organizer_id, organizer_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
      [
        slugFor(), body.title, body.summary, body.description, body.category, body.eventType, body.imageUrl ?? null,
        body.venue, body.district, d.lat, d.lng, body.startsAt, body.endsAt, body.price, capacity !== null, capacity,
        body.audience, body.highlights, req.user!.id, req.user!.name
      ]
    );
    const event = await getEventByRef(String(row!.id), { userId: req.user!.id });
    res.status(201).json({ event });
  })
);

async function ownedEvent(eventId: number, userId: string) {
  const row = await one<{ organizer_id: string | null; ends_at: Date }>(
    "SELECT organizer_id, ends_at FROM events WHERE id = $1",
    [eventId]
  );
  if (!row) throw notFound("هذي الفعالية غير موجودة");
  if (row.organizer_id !== userId) throw forbidden("هذي الفعالية مو تابعة لك");
  return row;
}

organizerRouter.put(
  "/events/:id",
  handler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const owned = await ownedEvent(id, req.user!.id);
    if (owned.ends_at.getTime() < Date.now()) throw badRequest("ما تقدر تعدّل فعالية منتهية");
    const body = eventSchema.parse(req.body);
    const capacity = body.capacity ?? null;

    const seats = await one<{ taken: number }>(
      "SELECT COALESCE(SUM(seats),0)::int AS taken FROM bookings WHERE event_id = $1 AND status = 'confirmed'",
      [id]
    );
    if (capacity !== null && capacity < (seats?.taken ?? 0)) {
      throw conflict(`فيه ${seats?.taken} مقعد محجوز، السعة ما تنزل عنها`, "capacity_below_booked");
    }
    if (capacity === null && (seats?.taken ?? 0) > 0) {
      throw conflict("فيه حجوزات حالية، ما تقدر تلغي نظام الحجز", "has_bookings");
    }
    const d = districts[body.district]!;
    await query(
      `UPDATE events SET title=$2, summary=$3, description=$4, category=$5, event_type=$6, image_url=$7, venue=$8,
         district=$9, lat=$10, lng=$11, starts_at=$12, ends_at=$13, price_sar=$14, requires_booking=$15, capacity=$16,
         audience=$17, highlights=$18 WHERE id = $1`,
      [
        id, body.title, body.summary, body.description, body.category, body.eventType, body.imageUrl ?? null, body.venue,
        body.district, d.lat, d.lng, body.startsAt, body.endsAt, body.price, capacity !== null, capacity, body.audience,
        body.highlights
      ]
    );
    const event = await getEventByRef(String(id), { userId: req.user!.id });
    res.json({ event });
  })
);

organizerRouter.delete(
  "/events/:id",
  handler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    await ownedEvent(id, req.user!.id);
    const booked = await one("SELECT 1 FROM bookings WHERE event_id = $1 AND status = 'confirmed'", [id]);
    if (booked) throw conflict("فيه حجوزات على هذي الفعالية، ما تقدر تحذفها", "has_bookings");
    await query("DELETE FROM events WHERE id = $1", [id]);
    res.status(204).end();
  })
);

// ---- per-event analytics ------------------------------------------------------------------------

organizerRouter.get(
  "/events/:id/analytics",
  handler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    await ownedEvent(id, req.user!.id);
    const event = await getEventByRef(String(id), { userId: req.user!.id });

    const [funnel] = await query<{
      views: number; visitors: number; favorites: number; shares: number; bookings: number; seats: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE i.type = 'view')::int AS views,
         COUNT(DISTINCT i.session_id) FILTER (WHERE i.type = 'view')::int AS visitors,
         (SELECT COUNT(*)::int FROM favorites f WHERE f.event_id = $1) AS favorites,
         COUNT(*) FILTER (WHERE i.type = 'share')::int AS shares,
         (SELECT COUNT(*)::int FROM bookings b WHERE b.event_id = $1 AND b.status = 'confirmed') AS bookings,
         (SELECT COALESCE(SUM(seats),0)::int FROM bookings b WHERE b.event_id = $1 AND b.status = 'confirmed') AS seats
       FROM interactions i WHERE i.event_id = $1`,
      [id]
    );

    const daily = await query<{ day: string; views: number; favorites: number; bookings: number }>(
      `WITH days AS (
         SELECT generate_series(
           (date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh') - interval '20 days')::date,
           (date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh'))::date, interval '1 day')::date AS day
       )
       SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
         COUNT(*) FILTER (WHERE i.type = 'view')::int AS views,
         COUNT(*) FILTER (WHERE i.type = 'favorite')::int AS favorites,
         COUNT(*) FILTER (WHERE i.type = 'book')::int AS bookings
       FROM days d
       LEFT JOIN interactions i ON i.event_id = $1 AND (i.created_at AT TIME ZONE 'Asia/Riyadh')::date = d.day
       GROUP BY d.day ORDER BY d.day`,
      [id]
    );

    const ratings = await query<{ rating: number; count: number }>(
      "SELECT rating::int AS rating, COUNT(*)::int AS count FROM reviews WHERE event_id = $1 GROUP BY rating ORDER BY rating",
      [id]
    );

    const sources = await query<{ source: string; count: number }>(
      `SELECT COALESCE(meta->>'source', 'unknown') AS source, COUNT(*)::int AS count
       FROM interactions WHERE event_id = $1 AND type = 'view' GROUP BY 1 ORDER BY 2 DESC`,
      [id]
    );

    const revenue = (funnel?.seats ?? 0) * (event?.price ?? 0);
    res.json({
      event,
      funnel: funnel ?? { views: 0, visitors: 0, favorites: 0, shares: 0, bookings: 0, seats: 0 },
      rates: {
        favoriteRate: funnel && funnel.views ? Math.round((funnel.favorites / funnel.views) * 1000) / 10 : 0,
        bookingRate: funnel && funnel.views ? Math.round((funnel.bookings / funnel.views) * 1000) / 10 : 0,
        fillRate: event?.capacity ? Math.round(((funnel?.seats ?? 0) / event.capacity) * 100) : null
      },
      revenue,
      daily,
      ratings,
      sources
    });
  })
);

// ---- market insights (AI: demand gaps) ----------------------------------------------------------

organizerRouter.get(
  "/insights",
  handler(async (_req, res) => {
    const [searches, upcoming, categoryStats] = await Promise.all([
      query<{ q: string; category: string | null; results: number; at: Date }>(
        `SELECT meta->>'q' AS q, meta->>'category' AS category, COALESCE((meta->>'results')::int, 0) AS results, created_at AS at
         FROM interactions WHERE type = 'search' AND meta ? 'q' AND created_at > now() - interval '28 days'
         ORDER BY created_at DESC LIMIT 5000`
      ),
      listEvents({ status: "upcoming", limit: 100 }),
      query(
        `SELECT e.category,
           COUNT(*)::int AS events,
           COALESCE(ROUND(AVG(r.avg_rating)::numeric, 2), NULL) AS "avgRating",
           COALESCE(SUM(b.seats), 0)::int AS seats
         FROM events e
         LEFT JOIN (SELECT event_id, AVG(rating) AS avg_rating FROM reviews GROUP BY event_id) r ON r.event_id = e.id
         LEFT JOIN (SELECT event_id, SUM(seats) AS seats FROM bookings WHERE status = 'confirmed' GROUP BY event_id) b ON b.event_id = e.id
         GROUP BY e.category ORDER BY seats DESC`
      )
    ]);

    const ai = await callAi<DemandGapsResponse>("/v1/demand-gaps", {
      searches: searches.map((s) => ({ q: s.q, category: s.category, results: s.results, at: s.at.toISOString() })),
      events: upcoming.events.map(toAiEvent),
      now: new Date().toISOString()
    });

    if (ai) return res.json({ mode: "ai", ...ai, categories: categoryStats });

    // Fallback: exact-query grouping, no semantic clustering and no supply estimate.
    const groups = new Map<string, { searches: number; zero: number }>();
    for (const s of searches) {
      const key = s.q.trim().toLowerCase();
      const g = groups.get(key) ?? { searches: 0, zero: 0 };
      g.searches += 1;
      if (s.results === 0) g.zero += 1;
      groups.set(key, g);
    }
    const gaps = [...groups.entries()]
      .map(([label, g]) => ({
        label, category: null, searches: g.searches, searches7d: 0, prev7d: 0, trend: null,
        zeroResultShare: Math.round((g.zero / g.searches) * 100) / 100, supply: 0,
        demandRatio: g.searches, opportunity: (g.zero / g.searches > 0.6 ? "high" : "low") as "high" | "low",
        exampleQueries: [label]
      }))
      .sort((a, b) => b.searches - a.searches)
      .slice(0, 10);
    res.json({ mode: "basic", gaps, totalSearches: searches.length, categories: categoryStats });
  })
);

// ---- attendance forecast (AI) -------------------------------------------------------------------

const forecastSchema = z.object({
  category: z.enum(categories),
  district: z.string().refine((d) => d in districts, "حي غير معروف").optional(),
  price: z.coerce.number().min(0).max(5000).default(0),
  capacity: z.coerce.number().int().min(1).max(20000).nullable().optional(),
  startsAt: isoDate,
  durationHours: z.coerce.number().min(0.5).max(72).default(3),
  leadDays: z.coerce.number().min(0).max(120).optional(),
  featured: z.boolean().optional()
});

organizerRouter.post(
  "/forecast",
  handler(async (req, res) => {
    const body = forecastSchema.parse(req.body);
    const leadDays = body.leadDays ?? Math.max(0, Math.round((new Date(body.startsAt).getTime() - Date.now()) / DAY));
    const payload: ForecastRequest = { ...body, leadDays };
    const ai = await callAi<ForecastResponse>("/v1/forecast/predict", payload);
    if (!ai) throw new HttpError(503, "ai_unavailable", "خدمة التوقع غير متاحة الحين");
    res.json(ai);
  })
);

organizerRouter.get(
  "/model",
  handler(async (_req, res) => {
    const card = await callAi<Record<string, unknown>>("/v1/model-card", undefined, "GET");
    if (!card) throw new HttpError(503, "ai_unavailable", "خدمة التوقع غير متاحة الحين");
    res.json(card);
  })
);

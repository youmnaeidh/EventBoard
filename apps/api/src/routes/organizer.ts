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
import { riyadhMidnight } from "../services/time.js";

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
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    publicationStatus: z.enum(["draft", "published"]).default("published"),
    details: z.object({
      posterUrl: z.string().url().startsWith('https://').max(500).or(z.literal('')).optional(),
      imageCredit: z.string().trim().max(180).optional(),
      imageSource: z.string().url().startsWith('https://').max(500).or(z.literal('')).optional(),
      imageLicense: z.string().trim().max(120).optional(),
      imageCaption: z.string().trim().max(300).optional(),
      imageIllustrative: z.boolean().optional(), imagePosition: z.number().min(0).max(100).optional(),
      locationAccuracy: z.enum(['exact', 'approximate', 'illustrative']).optional(),
      dailyStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal('')).optional(),
      dailyEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal('')).optional(),
      included: z.string().trim().max(500).optional(), parking: z.string().trim().max(300).optional(),
      accessibility: z.string().trim().max(300).optional(), preparation: z.string().trim().max(300).optional(),
      cancellation: z.string().trim().max(500).optional()
    }).default({}),
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
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'أدخل خط العرض والطول معًا', path: ['lat'] })
  .refine((v) => Boolean(v.details.dailyStart) === Boolean(v.details.dailyEnd), { message: 'حدد بداية ونهاية ساعات الزيارة معًا', path: ['details.dailyEnd'] })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { message: "وقت النهاية لازم يكون بعد البداية", path: ["endsAt"] })
  .refine((v) => new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime() <= 30 * DAY, {
    message: "مدة الفعالية الأقصى 30 يوم",
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
         (SELECT COALESCE(SUM(b.seats * b.unit_price_sar),0) FROM bookings b WHERE b.event_id = e.id AND b.status = 'confirmed') AS revenue
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
    await query('UPDATE events SET details=$2, publication_status=$3, lat=$4, lng=$5 WHERE id=$1',
      [row!.id, JSON.stringify({ ...body.details, locationAccuracy: body.lat === undefined ? 'approximate' : (body.details.locationAccuracy ?? 'exact') }),
        body.publicationStatus, body.lat ?? d.lat, body.lng ?? d.lng]);
    res.status(201).json({ event: await getEventByRef(String(row!.id), { userId: req.user!.id }) });
  })
);

async function ownedEvent(eventId: number, userId: string) {
  const row = await one<{ organizer_id: string | null; ends_at: Date; lat: number; lng: number; district: string }>(
    "SELECT organizer_id, ends_at, lat, lng, district FROM events WHERE id = $1",
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
        body.district, body.lat ?? (owned.district === body.district ? owned.lat : d.lat), body.lng ?? (owned.district === body.district ? owned.lng : d.lng), body.startsAt, body.endsAt, body.price, capacity !== null, capacity, body.audience,
        body.highlights
      ]
    );
    const details = { ...body.details };
    if (body.lat === undefined && owned.district !== body.district) details.locationAccuracy = 'approximate';
    await query('UPDATE events SET details=jsonb_strip_nulls(details || $2::jsonb), publication_status=$3 WHERE id=$1', [id, JSON.stringify(Object.fromEntries(Object.entries(details).map(([k,v])=>[k,v===''?null:v]))), body.publicationStatus]);
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
    const days = z.coerce.number().refine(n=>[7,14,30].includes(n)).parse(req.query.days ?? 14);
    await ownedEvent(id, req.user!.id);
    const event = await getEventByRef(String(id), {userId:req.user!.id});
    const today = riyadhMidnight(new Date());
    const to = new Date(today.getTime()+DAY), from = new Date(to.getTime()-days*DAY);
    const previousFrom = new Date(from.getTime()-days*DAY);
    const metrics = async (a:Date,b:Date) => (await one<{
      views:number;visitors:number;favorites:number;shares:number;bookings:number;seats:number;
      cancelled:number;revenue:number;unpriced:number;
    }>(`SELECT
      (SELECT COUNT(*)::int FROM interactions WHERE event_id=$1 AND type='view' AND created_at >= $2 AND created_at < $3) AS views,
      (SELECT COUNT(DISTINCT session_id)::int FROM interactions WHERE event_id=$1 AND type='view' AND created_at >= $2 AND created_at < $3) AS visitors,
      (SELECT COUNT(*)::int FROM favorites WHERE event_id=$1 AND created_at >= $2 AND created_at < $3) AS favorites,
      (SELECT COUNT(*)::int FROM interactions WHERE event_id=$1 AND type='share' AND created_at >= $2 AND created_at < $3) AS shares,
      COUNT(*) FILTER(WHERE status='confirmed')::int AS bookings,
      COALESCE(SUM(seats) FILTER(WHERE status='confirmed'),0)::int AS seats,
      COUNT(*) FILTER(WHERE status='cancelled')::int AS cancelled,
      COALESCE(SUM(seats*unit_price_sar) FILTER(WHERE status='confirmed'),0)::float8 AS revenue,
      COUNT(*) FILTER(WHERE status='confirmed' AND unit_price_sar IS NULL)::int AS unpriced
      FROM bookings WHERE event_id=$1 AND created_at >= $2 AND created_at < $3`,[id,a,b]))!;
    const [current,previous,daily,ratings,sources] = await Promise.all([
      metrics(from,to), metrics(previousFrom,from),
      query(`WITH days AS (SELECT generate_series(($2::timestamptz AT TIME ZONE 'Asia/Riyadh')::date,
          ($3::timestamptz AT TIME ZONE 'Asia/Riyadh')::date-1,interval '1 day')::date AS day)
        SELECT to_char(d.day,'YYYY-MM-DD') AS day,
          (SELECT COUNT(*)::int FROM interactions i WHERE event_id=$1 AND type='view' AND (created_at AT TIME ZONE 'Asia/Riyadh')::date=d.day) AS views,
          (SELECT COUNT(*)::int FROM favorites f WHERE event_id=$1 AND (created_at AT TIME ZONE 'Asia/Riyadh')::date=d.day) AS favorites,
          (SELECT COUNT(*)::int FROM bookings b WHERE event_id=$1 AND status='confirmed' AND (created_at AT TIME ZONE 'Asia/Riyadh')::date=d.day) AS bookings
        FROM days d ORDER BY d.day`,[id,from,to]),
      query('SELECT rating::int, COUNT(*)::int AS count FROM reviews WHERE event_id=$1 AND created_at >= $2 AND created_at < $3 GROUP BY rating ORDER BY rating',[id,from,to]),
      query(`SELECT COALESCE(meta->>'source','unknown') AS source, COUNT(*)::int AS count,
          COUNT(*) FILTER(WHERE is_sample)::int AS synthetic
        FROM interactions WHERE event_id=$1 AND type='view' AND created_at >= $2 AND created_at < $3 GROUP BY 1 ORDER BY 2 DESC`,[id,from,to])
    ]);
    res.json({
      event, period:{days,from:from.toISOString(),to:to.toISOString(),previousFrom:previousFrom.toISOString(),timezone:'Asia/Riyadh'},
      funnel:current, previous, revenue:current.revenue, unpricedBookings:current.unpriced, cancelled:current.cancelled,
      rates:{
        favoriteRate:current.views?Math.round(current.favorites/current.views*1000)/10:0,
        bookingRate:current.views?Math.round(current.bookings/current.views*1000)/10:0,
        fillRate:event?.capacity?Math.round((event.capacity-(event.seatsLeft??event.capacity))/event.capacity*100):null
      }, daily, ratings, sources
    });
  })
);

// ---- market insights (AI: demand gaps) ----------------------------------------------------------

organizerRouter.get(
  "/insights",
  handler(async (_req, res) => {
    const [searches, upcoming, categoryStats] = await Promise.all([
      query<{ q: string; category: string | null; results: number; at: Date; identity:string; engine:string|null; inventory:number|null }>(
        `SELECT * FROM (SELECT DISTINCT ON (COALESCE(user_id::text, session_id), lower(trim(meta->>'q')), (created_at AT TIME ZONE 'Asia/Riyadh')::date)
          meta->>'q' AS q, meta->>'category' AS category, COALESCE((meta->>'results')::int,0) AS results, created_at AS at,
          COALESCE(user_id::text,session_id) AS identity, meta->>'engine' AS engine,
          (meta->>'constrainedInventory')::int AS inventory
         FROM interactions WHERE type='search' AND meta ? 'q' AND created_at > now()-interval '28 days'
         ORDER BY COALESCE(user_id::text,session_id), lower(trim(meta->>'q')), (created_at AT TIME ZONE 'Asia/Riyadh')::date,created_at DESC) deduplicated ORDER BY at DESC LIMIT 5000`
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
         WHERE e.publication_status='published' GROUP BY e.category ORDER BY seats DESC`
      )
    ]);

    const sample = {periodDays:28, uniqueSearchers:new Set(searches.map(s=>s.identity)).size, deduplicatedSearches:searches.length,
      retrievalFailures:searches.filter(s=>s.results===0 && s.inventory!==null && s.inventory>0).length,
      noInventory:searches.filter(s=>s.inventory===0).length,
      engineUnavailable:searches.filter(s=>s.engine==='fallback').length};
    const ai = await callAi<DemandGapsResponse>("/v1/demand-gaps", {
      searches: searches.map((s) => ({ q: s.q, category: s.category, results: s.results, at: s.at.toISOString() })),
      events: upcoming.events.map(toAiEvent),
      now: new Date().toISOString()
    });

    if (ai) return res.json({ mode: "ai", ...ai, sample, categories: categoryStats });

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
    res.json({ mode: "basic", gaps, totalSearches: searches.length, sample, categories: categoryStats });
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
    const leadDays = body.leadDays ?? Math.max(0, Math.min(120,(new Date(body.startsAt).getTime() - Date.now()) / DAY));
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

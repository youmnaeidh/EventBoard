import { Router } from "express";
import { z } from "zod";
import { one, query, withTransaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { badRequest, conflict, forbidden, handler, notFound } from "../middleware/errors.js";
import { districts } from "../seed/data.js";
import { categories, DEFAULT_CENTER, getEventByRef, listEvents, listQuerySchema } from "../services/events.js";
import { recordInteraction } from "../services/interactions.js";

export const eventsRouter = Router();

eventsRouter.get("/meta", (_req, res) => {
  res.json({
    categories,
    districts: Object.entries(districts).map(([name, c]) => ({ name, lat: c.lat, lng: c.lng })),
    defaultCenter: DEFAULT_CENTER
  });
});

/** Latest written reviews across the platform (home page). Only first names are exposed. */
eventsRouter.get(
  "/reviews/latest",
  handler(async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(12).default(6).parse(req.query.limit);
    const rows = await query(
      `SELECT r.id, r.rating::int AS rating, r.comment, r.verified, r.created_at AS "createdAt",
              split_part(u.name, ' ', 1) AS "authorName", e.title AS "eventTitle", e.slug AS "eventSlug"
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN events e ON e.id = r.event_id
       WHERE length(r.comment) >= 20
       ORDER BY r.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ reviews: rows });
  })
);

eventsRouter.get(
  "/events",
  handler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const result = await listEvents({ ...q, userId: req.user?.id ?? null });
    res.json(result);
  })
);

const locationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
});

eventsRouter.get(
  "/events/:ref",
  handler(async (req, res) => {
    const loc = locationSchema.parse(req.query);
    const event = await getEventByRef(String(req.params.ref), { userId: req.user?.id ?? null, ...loc });
    if (!event) throw notFound("هذي الفعالية غير موجودة");

    const [distribution, similar, myBooking, myReview] = await Promise.all([
      query<{ rating: number; count: number }>(
        "SELECT rating::int AS rating, COUNT(*)::int AS count FROM reviews WHERE event_id = $1 GROUP BY rating",
        [event.id]
      ),
      listEvents({ category: event.category, status: "upcoming", sort: "popular", limit: 5, userId: req.user?.id ?? null, ...loc }),
      req.user
        ? one(
            `SELECT id, seats, ticket_code AS "ticketCode", created_at AS "createdAt"
             FROM bookings WHERE event_id = $1 AND user_id = $2 AND status = 'confirmed'`,
            [event.id, req.user.id]
          )
        : Promise.resolve(null),
      req.user
        ? one(
            `SELECT id, rating, comment, verified, created_at AS "createdAt" FROM reviews WHERE event_id = $1 AND user_id = $2`,
            [event.id, req.user.id]
          )
        : Promise.resolve(null)
    ]);

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distribution) counts[row.rating] = row.count;

    res.json({
      event,
      ratingDistribution: counts,
      similar: similar.events.filter((e) => e.id !== event.id).slice(0, 4),
      myBooking,
      myReview
    });
  })
);

// ---- reviews ------------------------------------------------------------------------------------

eventsRouter.get(
  "/events/:id/reviews",
  handler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    if (!(await getEventByRef(String(id), {userId:req.user?.id}))) throw notFound('هذي الفعالية غير موجودة');
    const rows = await query(
      `SELECT r.id, r.rating::int AS rating, r.comment, r.verified, r.created_at AS "createdAt",
              split_part(u.name, ' ', 1) AS "authorName"
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.event_id = $1
       ORDER BY r.created_at DESC LIMIT 50`,
      [id]
    );
    res.json({ reviews: rows });
  })
);

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "اختر تقييم من 1 إلى 5").max(5),
  comment: z.string().trim().max(600, "التعليق طويل (الحد 600 حرف)").default("")
});

eventsRouter.post(
  "/events/:id/reviews",
  requireAuth,
  handler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = reviewSchema.parse(req.body);
    const user = req.user!;

    const event = await one<{ starts_at: Date; organizer_id: string | null }>(
      "SELECT starts_at, organizer_id FROM events WHERE id = $1",
      [id]
    );
    if (!event) throw notFound("هذي الفعالية غير موجودة");
    if (event.organizer_id === user.id) throw forbidden("ما تقدر تقيّم فعاليتك");
    if (event.starts_at.getTime() > Date.now()) throw badRequest("تقدر تقيّم الفعالية بعد ما تبدأ");

    const booked = await one(
      "SELECT 1 FROM bookings WHERE event_id = $1 AND user_id = $2 AND status = 'confirmed'",
      [id, user.id]
    );
    const review = await one(
      `INSERT INTO reviews (event_id, user_id, rating, comment, verified)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (event_id, user_id)
       DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, verified = EXCLUDED.verified, created_at = now()
       RETURNING id, rating::int AS rating, comment, verified, created_at AS "createdAt"`,
      [id, user.id, body.rating, body.comment, Boolean(booked)]
    );
    res.status(201).json({ review });
  })
);

// ---- favourites ---------------------------------------------------------------------------------

eventsRouter.put(
  "/events/:id/favorite",
  requireAuth,
  handler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const exists = await one("SELECT 1 FROM events WHERE id = $1 AND publication_status = 'published'", [id]);
    if (!exists) throw notFound("هذي الفعالية غير موجودة");
    const inserted = await query(
      "INSERT INTO favorites (user_id, event_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING event_id",
      [req.user!.id, id]
    );
    if (inserted.length) {
      await recordInteraction({ userId: req.user!.id, sessionId: `user-${req.user!.id}`.slice(0, 64), eventId: id, type: "favorite" });
    }
    res.json({ isFavorite: true });
  })
);

eventsRouter.delete(
  "/events/:id/favorite",
  requireAuth,
  handler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const removed = await query("DELETE FROM favorites WHERE user_id = $1 AND event_id = $2 RETURNING event_id", [req.user!.id, id]);
    if (removed.length) {
      await recordInteraction({ userId: req.user!.id, sessionId: `user-${req.user!.id}`.slice(0, 64), eventId: id, type: "unfavorite" });
    }
    res.json({ isFavorite: false });
  })
);

// ---- bookings -----------------------------------------------------------------------------------

const bookingSchema = z.object({ seats: z.coerce.number().int().min(1, "اختر مقعد واحد على الأقل").max(6, "الحد الأقصى 6 مقاعد") });

function ticketCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `EB-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

eventsRouter.post(
  "/events/:id/bookings",
  requireAuth,
  handler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { seats } = bookingSchema.parse(req.body);
    const user = req.user!;

    const booking = await withTransaction(async (client) => {
      // Lock the event row so two concurrent bookings cannot oversell the last seats.
      const event = await one<{
        capacity: number | null;
        requires_booking: boolean;
        ends_at: Date;
        organizer_id: string | null;
        price_sar: number; publication_status: string;
      }>("SELECT capacity, requires_booking, ends_at, organizer_id, price_sar, publication_status FROM events WHERE id = $1 FOR UPDATE", [id], client);
      if (!event) throw notFound("هذي الفعالية غير موجودة");
      if (event.publication_status !== 'published') throw notFound('هذي الفعالية غير منشورة');
      if (!event.requires_booking || event.capacity === null) throw badRequest("هذي الفعالية ما تحتاج حجز");
      if (event.ends_at.getTime() < Date.now()) throw badRequest("انتهت الفعالية");
      if (event.organizer_id === user.id) throw forbidden("ما تقدر تحجز في فعاليتك");

      const existing = await one("SELECT 1 FROM bookings WHERE event_id = $1 AND user_id = $2 AND status = 'confirmed'", [id, user.id], client);
      if (existing) throw conflict("عندك حجز في هذي الفعالية من قبل", "already_booked");

      const taken = await one<{ taken: number }>(
        "SELECT COALESCE(SUM(seats), 0)::int AS taken FROM bookings WHERE event_id = $1 AND status = 'confirmed'",
        [id],
        client
      );
      const left = event.capacity - (taken?.taken ?? 0);
      if (left <= 0) throw conflict("اكتمل العدد", "sold_out");
      if (seats > left) throw conflict(`المتبقي ${left} مقعد فقط`, "not_enough_seats");

      const row = await one(
        `INSERT INTO bookings (event_id, user_id, seats, ticket_code, unit_price_sar) VALUES ($1,$2,$3,$4,$5)
         RETURNING id, event_id AS "eventId", seats, ticket_code AS "ticketCode", status, created_at AS "createdAt"`,
        [id, user.id, seats, ticketCode(), event.price_sar],
        client
      );
      await client.query(
        "INSERT INTO interactions (user_id, session_id, event_id, type, meta) VALUES ($1,$2,$3,'book',$4)",
        [user.id, `user-${user.id}`.slice(0, 64), id, JSON.stringify({ seats })]
      );
      return row;
    });

    res.status(201).json({ booking });
  })
);

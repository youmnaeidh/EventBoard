import { Router } from "express";
import { z } from "zod";
import { one, query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { badRequest, forbidden, handler, notFound } from "../middleware/errors.js";
import { listEvents } from "../services/events.js";

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get(
  "/bookings",
  handler(async (req, res) => {
    const rows = await query<{ id: string; seats: number; ticketCode: string; status: string; createdAt: Date; eventId: number }>(
      `SELECT id, seats, ticket_code AS "ticketCode", status, created_at AS "createdAt", event_id AS "eventId"
       FROM bookings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.user!.id]
    );
    const ids = [...new Set(rows.map((r) => r.eventId))];
    const { events } = ids.length
      ? await listEvents({ ids, status: "all", userId: req.user!.id, limit: 100 })
      : { events: [] };
    const byId = new Map(events.map((e) => [e.id, e]));
    res.json({ bookings: rows.map((r) => ({ ...r, event: byId.get(r.eventId) ?? null })) });
  })
);

meRouter.delete(
  "/bookings/:id",
  handler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const booking = await one<{ user_id: string; status: string; starts_at: Date }>(
      `SELECT b.user_id, b.status, e.starts_at FROM bookings b JOIN events e ON e.id = b.event_id WHERE b.id = $1`,
      [id]
    );
    if (!booking) throw notFound("الحجز غير موجود");
    if (booking.user_id !== req.user!.id) throw forbidden();
    if (booking.status === "cancelled") throw badRequest("الحجز ملغي من قبل");
    if (booking.starts_at.getTime() <= Date.now()) throw badRequest("ما تقدر تلغي حجز فعالية بدأت");
    await query("UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE id = $1", [id]);
    res.status(204).end();
  })
);

meRouter.get(
  "/favorites",
  handler(async (req, res) => {
    const rows = await query<{ event_id: number }>(
      "SELECT event_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user!.id]
    );
    const ids = rows.map((r) => r.event_id);
    if (!ids.length) return res.json({ events: [] });
    const { events } = await listEvents({ ids, status: "all", userId: req.user!.id, limit: 100 });
    // keep "most recently saved first"
    const order = new Map(ids.map((id, index) => [id, index]));
    events.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    res.json({ events });
  })
);

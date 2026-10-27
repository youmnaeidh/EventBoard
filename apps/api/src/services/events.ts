import { z } from "zod";
import { one, query, type Queryable } from "../db.js";
import { categories, districts } from "../seed/data.js";
import { timeWindow } from "./time.js";

export const DEFAULT_CENTER = { lat: 24.4672, lng: 39.6111, label: "المسجد النبوي" };

export type EventStatus = "upcoming" | "live" | "ended";

export interface EventDto {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  eventType: string;
  image: string | null;
  venue: string;
  district: string;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string;
  price: number;
  isFree: boolean;
  requiresBooking: boolean;
  capacity: number | null;
  seatsLeft: number | null;
  audience: string;
  format: string;
  highlights: string[];
  organizerName: string;
  featured: boolean;
  createdAt: string;
  status: EventStatus;
  avgRating: number | null;
  reviewCount: number;
  favoriteCount: number;
  popularity: number;
  distanceKm: number | null;
  isFavorite: boolean;
}

interface EventRow {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  event_type: string;
  image_url: string | null;
  venue: string;
  district: string;
  lat: number;
  lng: number;
  starts_at: Date;
  ends_at: Date;
  price_sar: number;
  requires_booking: boolean;
  capacity: number | null;
  audience: string;
  format: string;
  highlights: string[];
  organizer_name: string;
  featured: boolean;
  created_at: Date;
  seats_booked: number;
  avg_rating: number | null;
  review_count: number;
  favorite_count: number;
  popularity: number;
  distance_km: number | null;
  is_favorite: boolean;
  total_count?: number;
}

export function toEventDto(row: EventRow, now = new Date()): EventDto {
  const starts = row.starts_at.getTime();
  const ends = row.ends_at.getTime();
  const status: EventStatus = now.getTime() < starts ? "upcoming" : now.getTime() <= ends ? "live" : "ended";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    category: row.category,
    eventType: row.event_type,
    image: row.image_url,
    venue: row.venue,
    district: row.district,
    lat: row.lat,
    lng: row.lng,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    price: Number(row.price_sar),
    isFree: Number(row.price_sar) === 0,
    requiresBooking: row.requires_booking,
    capacity: row.capacity,
    seatsLeft: row.capacity === null ? null : Math.max(0, row.capacity - row.seats_booked),
    audience: row.audience,
    format: row.format,
    highlights: row.highlights,
    organizerName: row.organizer_name,
    featured: row.featured,
    createdAt: row.created_at.toISOString(),
    status,
    avgRating: row.avg_rating === null ? null : Number(row.avg_rating),
    reviewCount: row.review_count,
    favoriteCount: row.favorite_count,
    popularity: row.popularity,
    distanceKm: row.distance_km === null ? null : Math.round(row.distance_km * 10) / 10,
    isFavorite: row.is_favorite
  };
}

export const listQuerySchema = z.object({
  category: z.string().max(40).optional(),
  district: z.string().max(60).optional(),
  price: z.enum(["free", "paid"]).optional(),
  when: z.enum(["today", "tonight", "tomorrow", "weekend", "week"]).optional(),
  status: z.enum(["upcoming", "ended", "all"]).default("upcoming"),
  booking: z.enum(["true", "false"]).optional(),
  sort: z.enum(["soonest", "nearest", "popular", "newest", "rating"]).default("soonest"),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxKm: z.coerce.number().positive().max(200).optional(),
  featured: z.enum(["true"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0)
});
export type ListQuery = z.infer<typeof listQuerySchema>;

const HAVERSINE = (latParam: string, lngParam: string) => `(
  6371 * 2 * asin(sqrt(
    power(sin(radians(e.lat - ${latParam}::float8) / 2), 2) +
    cos(radians(${latParam}::float8)) * cos(radians(e.lat)) *
    power(sin(radians(e.lng - ${lngParam}::float8) / 2), 2)
  )))`;

/**
 * Popularity = recent behaviour (last 14 days) weighted by effort:
 * view 1, share 2, favourite 3, booking 5. Weights are documented in docs/ai.md.
 */
const POPULARITY_SQL = `(
  SELECT COALESCE(SUM(CASE i.type WHEN 'view' THEN 1 WHEN 'share' THEN 2 WHEN 'favorite' THEN 3 WHEN 'book' THEN 5 ELSE 0 END), 0)::int
  FROM interactions i WHERE i.event_id = e.id AND i.created_at > now() - interval '14 days')`;

export interface ListOptions extends Partial<ListQuery> {
  userId?: string | null;
  ids?: number[];
  organizerId?: string;
  now?: Date;
}

export async function listEvents(
  options: ListOptions,
  client?: Queryable
): Promise<{ events: EventDto[]; total: number }> {
  const now = options.now ?? new Date();
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const where: string[] = [];
  const status = options.status ?? "upcoming";
  if (status === "upcoming") where.push(`e.ends_at >= ${add(now)}::timestamptz`);
  if (status === "ended") where.push(`e.ends_at < ${add(now)}::timestamptz`);

  if (options.category) where.push(`e.category = ${add(options.category)}`);
  if (options.district) where.push(`e.district = ${add(options.district)}`);
  if (options.price === "free") where.push("e.price_sar = 0");
  if (options.price === "paid") where.push("e.price_sar > 0");
  if (options.booking === "true") where.push("e.requires_booking");
  if (options.booking === "false") where.push("NOT e.requires_booking");
  if (options.featured) where.push("e.featured");
  if (options.ids) where.push(`e.id = ANY(${add(options.ids)}::int[])`);
  if (options.organizerId) where.push(`e.organizer_id = ${add(options.organizerId)}`);
  if (options.when) {
    const w = timeWindow(options.when, now);
    where.push(`e.starts_at < ${add(w.to)}::timestamptz AND e.ends_at > ${add(w.from)}::timestamptz`);
  }

  // Location: explicit coordinates, or the city centre so `nearest` is always defined.
  const hasLocation = options.lat !== undefined && options.lng !== undefined;
  const latP = add(hasLocation ? options.lat : DEFAULT_CENTER.lat);
  const lngP = add(hasLocation ? options.lng : DEFAULT_CENTER.lng);
  const distance = HAVERSINE(latP, lngP);
  if (options.maxKm) where.push(`${distance} <= ${add(options.maxKm)}`);

  const userP = add(options.userId ?? null);
  const sort = options.sort ?? "soonest";
  const orderBy =
    sort === "nearest"
      ? "distance_km ASC, e.starts_at ASC"
      : sort === "popular"
        ? "popularity DESC, e.starts_at ASC"
        : sort === "newest"
          ? "e.created_at DESC"
          : sort === "rating"
            ? "avg_rating DESC NULLS LAST, review_count DESC"
            : status === "ended"
              ? "e.starts_at DESC"
              : "e.starts_at ASC";

  const limit = options.limit ?? 24;
  const offset = options.offset ?? 0;

  const sql = `
    SELECT e.*,
      (SELECT COALESCE(SUM(b.seats), 0)::int FROM bookings b WHERE b.event_id = e.id AND b.status = 'confirmed') AS seats_booked,
      (SELECT ROUND(AVG(r.rating)::numeric, 2) FROM reviews r WHERE r.event_id = e.id) AS avg_rating,
      (SELECT COUNT(*)::int FROM reviews r WHERE r.event_id = e.id) AS review_count,
      (SELECT COUNT(*)::int FROM favorites f WHERE f.event_id = e.id) AS favorite_count,
      ${POPULARITY_SQL} AS popularity,
      ${distance} AS distance_km,
      EXISTS (SELECT 1 FROM favorites f WHERE f.event_id = e.id AND f.user_id = ${userP}::uuid) AS is_favorite,
      COUNT(*) OVER() AS total_count
    FROM events e
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}`;

  const rows = await query<EventRow>(sql, params, client);
  return { events: rows.map((row) => toEventDto({ ...row, distance_km: hasLocation ? row.distance_km : null }, now)), total: Number(rows[0]?.total_count ?? 0) };
}

export async function getEventByRef(
  ref: string,
  options: { userId?: string | null; lat?: number; lng?: number } = {}
): Promise<EventDto | null> {
  const isId = /^\d+$/.test(ref);
  const found = await one<{ id: number }>(
    `SELECT id FROM events WHERE ${isId ? "id = $1::int" : "slug = $1"}`,
    [ref]
  );
  if (!found) return null;
  const { events } = await listEvents({
    ids: [found.id],
    status: "all",
    userId: options.userId,
    lat: options.lat,
    lng: options.lng,
    limit: 1
  });
  return events[0] ?? null;
}

export const districtNames = Object.keys(districts);
export { categories };

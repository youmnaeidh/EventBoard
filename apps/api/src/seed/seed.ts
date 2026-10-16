import { fileURLToPath } from "node:url";
import path from "node:path";
import bcrypt from "bcryptjs";
import { pool, query, withTransaction } from "../db.js";
import { migrate } from "../migrate.js";
import {
  districts,
  organizers,
  reviewPools,
  searchTopics,
  seedEvents,
  syntheticUserNames,
  type SeedEvent
} from "./data.js";
import { riyadhMidnight } from "../services/time.js";

export const DEMO_PASSWORD = "Demo#2026";
export const DEMO_ATTENDEE_EMAIL = "demo@eventboard.demo";
export const DEMO_ORGANIZER_EMAIL = "organizer@eventboard.demo";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Deterministic PRNG so every environment gets the same story.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRandom(seed: number) {
  const rnd = mulberry32(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)] as T;
  const between = (min: number, max: number) => min + rnd() * (max - min);
  const int = (min: number, max: number) => Math.floor(between(min, max + 1));
  const chance = (p: number) => rnd() < p;
  const normal = (mean: number, sd: number) => {
    const u = Math.max(rnd(), 1e-9);
    const v = rnd();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const weighted = <T,>(items: readonly T[], weights: readonly number[]): T => {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rnd() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i] ?? 0;
      if (r <= 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  };
  return { rnd, pick, between, int, chance, normal, weighted };
}

interface EventRow {
  id: number;
  seed: SeedEvent;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}

interface SyntheticUser {
  id: string;
  affinity: Record<string, number>;
}

interface InteractionRow {
  userId: string | null;
  sessionId: string;
  eventId: number | null;
  type: "view" | "share" | "search" | "favorite" | "book";
  meta: Record<string, unknown>;
  at: Date;
}

export async function seedDatabase(options: { reset?: boolean; log?: (m: string) => void } = {}): Promise<boolean> {
  const log = options.log ?? (() => undefined);
  await migrate(log);

  const existing = await query<{ count: number }>("SELECT count(*)::int AS count FROM events");
  if ((existing[0]?.count ?? 0) > 0 && !options.reset) {
    log("events already present - skipping seed (use --reset to rebuild)");
    return false;
  }

  const R = makeRandom(20260711);
  const now = new Date();
  const todayMidnight = riyadhMidnight(now);

  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const lockedHash = await bcrypt.hash(`locked-${Math.random()}-${Date.now()}`, 10);

  await withTransaction(async (client) => {
    await client.query(
      "TRUNCATE interactions, favorites, reviews, bookings, events, users, app_meta RESTART IDENTITY CASCADE"
    );

    // ---- users -------------------------------------------------------------------------------
    const demoAttendee = (
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, interests, is_sample)
         VALUES ('حساب تجريبي', $1, $2, 'attendee', ARRAY['فن','عائلي'], true) RETURNING id`,
        [DEMO_ATTENDEE_EMAIL, demoHash]
      )
    ).rows[0].id as string;

    const organizerIds = new Map<string, string>();
    const demoOrganizerId = (
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, is_sample)
         VALUES ('منظم تجريبي', $1, $2, 'organizer', true) RETURNING id`,
        [DEMO_ORGANIZER_EMAIL, demoHash]
      )
    ).rows[0].id as string;
    // The demo organizer owns two organizations so the dashboard has enough events to be interesting.
    organizerIds.set("استوديو الحرف", demoOrganizerId);
    organizerIds.set("مسارات المدينة", demoOrganizerId);
    let orgIndex = 0;
    for (const name of organizers) {
      if (organizerIds.has(name)) continue;
      orgIndex += 1;
      const id = (
        await client.query(
          `INSERT INTO users (name, email, password_hash, role, is_sample)
           VALUES ($1, $2, $3, 'organizer', true) RETURNING id`,
          [name, `org${orgIndex}@sample.eventboard.demo`, lockedHash]
        )
      ).rows[0].id as string;
      organizerIds.set(name, id);
    }

    const categoriesList = [...new Set(seedEvents.map((e) => e.category))];
    const users: SyntheticUser[] = [{ id: demoAttendee, affinity: { فن: 3, عائلي: 2.5 } }];
    for (let i = 0; i < 130; i++) {
      const first = R.pick(syntheticUserNames);
      const [primary, secondary] = [R.pick(categoriesList), R.pick(categoriesList)];
      const affinity: Record<string, number> = {};
      for (const c of categoriesList) affinity[c] = 0.35;
      affinity[primary] = 3;
      affinity[secondary] = Math.max(affinity[secondary] ?? 0, 1.6);
      const id = (
        await client.query(
          `INSERT INTO users (name, email, password_hash, role, interests, is_sample, created_at)
           VALUES ($1, $2, $3, 'attendee', $4, true, $5) RETURNING id`,
          [
            `${first} ${i + 1}`,
            `user${i + 1}@sample.eventboard.demo`,
            lockedHash,
            [primary, secondary],
            new Date(now.getTime() - R.between(2, 45) * DAY)
          ]
        )
      ).rows[0].id as string;
      users.push({ id, affinity });
    }

    // ---- events ------------------------------------------------------------------------------
    const events: EventRow[] = [];
    for (const e of seedEvents) {
      const startsAt = new Date(todayMidnight.getTime() + e.startDay * DAY + e.startHour * HOUR);
      const endsAt = new Date(startsAt.getTime() + e.durationHours * HOUR);
      const createdAt = new Date(now.getTime() - e.createdDaysAgo * DAY);
      const d = districts[e.district]!;
      const jitter = () => (R.rnd() - 0.5) * 0.006;
      const id = (
        await client.query(
          `INSERT INTO events (slug, title, summary, description, category, event_type, image_url, venue, district,
             lat, lng, starts_at, ends_at, price_sar, requires_booking, capacity, audience, highlights,
             organizer_id, organizer_name, featured, is_sample, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,true,$22)
           RETURNING id`,
          [
            e.slug, e.title, e.summary, e.description, e.category, e.eventType, e.image ?? null, e.venue, e.district,
            d.lat + jitter(), d.lng + jitter(), startsAt, endsAt, e.price, e.capacity !== undefined, e.capacity ?? null,
            e.audience, e.highlights, organizerIds.get(e.organizer) ?? null, e.organizer, e.featured ?? false, createdAt
          ]
        )
      ).rows[0].id as number;
      events.push({ id, seed: e, startsAt, endsAt, createdAt });
    }

    // ---- behaviour ----------------------------------------------------------------------------
    const interactions: InteractionRow[] = [];
    const favorites: { userId: string; eventId: number; at: Date }[] = [];
    const bookings: { eventId: number; userId: string; seats: number; at: Date; code: string }[] = [];
    const reviews: { eventId: number; userId: string; rating: number; comment: string; verified: boolean; at: Date }[] = [];
    const seatsBooked = new Map<number, number>();
    const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const usedCodes = new Set<string>();
    const makeCode = () => {
      for (;;) {
        const raw = Array.from({ length: 8 }, () => codeAlphabet[Math.floor(R.rnd() * codeAlphabet.length)]).join("");
        const code = `EB-${raw.slice(0, 4)}-${raw.slice(4)}`;
        if (!usedCodes.has(code)) {
          usedCodes.add(code);
          return code;
        }
      }
    };
    const sessionId = () => `s${Math.floor(R.rnd() * 1e12).toString(36).padStart(10, "0")}${Math.floor(R.rnd() * 1e6).toString(36)}`;

    const windowStart = (ev: EventRow) => Math.max(ev.createdAt.getTime(), now.getTime() - 30 * DAY);
    const windowEnd = (ev: EventRow) => Math.min(ev.endsAt.getTime(), now.getTime());

    // Logged-in users
    for (const user of users) {
      const count = R.int(10, 34);
      const weights = events.map((ev) => {
        if (windowEnd(ev) <= windowStart(ev)) return 0;
        return ev.seed.appeal * (user.affinity[ev.seed.category] ?? 0.35);
      });
      const seen = new Set<number>();
      for (let i = 0; i < count; i++) {
        const ev = R.weighted(events, weights);
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        const start = windowStart(ev);
        const end = windowEnd(ev);
        // bias to recent
        const viewAt = new Date(start + (end - start) * Math.pow(R.rnd(), 0.6));
        const aff = (user.affinity[ev.seed.category] ?? 0.35) / 3;
        interactions.push({ userId: user.id, sessionId: sessionId(), eventId: ev.id, type: "view", meta: {}, at: viewAt, });

        const favAt = new Date(viewAt.getTime() + R.between(1, 20) * 60_000);
        if (R.chance(0.1 + 0.28 * aff)) {
          favorites.push({ userId: user.id, eventId: ev.id, at: favAt });
          interactions.push({ userId: user.id, sessionId: sessionId(), eventId: ev.id, type: "favorite", meta: {}, at: favAt });
        }
        if (R.chance(0.03 + 0.05 * aff)) {
          interactions.push({ userId: user.id, sessionId: sessionId(), eventId: ev.id, type: "share", meta: {}, at: new Date(viewAt.getTime() + 120_000) });
        }

        const cap = ev.seed.capacity;
        if (cap !== undefined && viewAt.getTime() < ev.startsAt.getTime() && R.chance(0.1 + 0.4 * aff * aff)) {
          const seats = R.weighted([1, 2, 3, 4], [4, 5, 2, 1]);
          const used = seatsBooked.get(ev.id) ?? 0;
          if (used + seats <= cap) {
            seatsBooked.set(ev.id, used + seats);
            const bookAt = new Date(viewAt.getTime() + R.between(5, 90) * 60_000);
            bookings.push({ eventId: ev.id, userId: user.id, seats, at: bookAt, code: makeCode() });
            interactions.push({ userId: user.id, sessionId: sessionId(), eventId: ev.id, type: "book", meta: { seats }, at: bookAt });
            if (ev.startsAt.getTime() < now.getTime() && R.chance(0.7)) {
              reviews.push(makeReview(ev, user.id, true));
            }
          }
        } else if (cap === undefined && ev.startsAt.getTime() < now.getTime() && R.chance(0.3 * aff + 0.06)) {
          reviews.push(makeReview(ev, user.id, false));
        }
      }
    }

    function makeReview(ev: EventRow, userId: string, verified: boolean) {
      const rating = Math.max(1, Math.min(5, Math.round(R.normal(ev.seed.quality - 0.25, 0.7))));
      const pool = rating >= 4 ? reviewPools.positive : rating === 3 ? reviewPools.neutral : reviewPools.negative;
      const comment = R.chance(0.75) ? R.pick(pool) : "";
      const from = ev.startsAt.getTime() + HOUR;
      const to = Math.min(now.getTime(), ev.endsAt.getTime() + 36 * HOUR);
      const at = new Date(from + Math.max(0, to - from) * R.rnd());
      return { eventId: ev.id, userId, rating, comment, verified, at };
    }

    // Anonymous traffic: views/shares from visitors who never signed in.
    for (const ev of events) {
      const start = windowStart(ev);
      const end = windowEnd(ev);
      if (end <= start) continue;
      const views = Math.round(ev.seed.appeal * R.between(60, 220));
      for (let i = 0; i < views; i++) {
        const at = new Date(start + (end - start) * Math.pow(R.rnd(), 0.7));
        interactions.push({ userId: null, sessionId: sessionId(), eventId: ev.id, type: "view", meta: {}, at });
        if (R.chance(0.04)) {
          interactions.push({ userId: null, sessionId: sessionId(), eventId: ev.id, type: "share", meta: {}, at: new Date(at.getTime() + 60_000) });
        }
      }
    }

    // Search log (the raw material for demand-gap analysis)
    const topicWeights = searchTopics.map((t) => t.weight);
    for (let i = 0; i < 900; i++) {
      const topic = R.weighted(searchTopics, topicWeights);
      const daysAgo = R.between(0, 30);
      // Trending topics get more searches in the most recent week than in the weeks before.
      if (topic.trend && topic.trend > 1 && daysAgo > 7 && R.chance(1 - 1 / topic.trend)) continue;
      const at = new Date(now.getTime() - daysAgo * DAY);
      const known = R.chance(0.4) ? R.pick(users) : null;
      interactions.push({
        userId: known?.id ?? null,
        sessionId: sessionId(),
        eventId: null,
        type: "search",
        meta: { q: R.pick(topic.queries), category: topic.category ?? null, results: topic.results },
        at
      });
    }

    // ---- bulk inserts -------------------------------------------------------------------------
    for (const b of bookings) {
      await client.query(
        `INSERT INTO bookings (event_id, user_id, seats, ticket_code, created_at) VALUES ($1,$2,$3,$4,$5)`,
        [b.eventId, b.userId, b.seats, b.code, b.at]
      );
    }
    for (const f of favorites) {
      await client.query(
        `INSERT INTO favorites (user_id, event_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [f.userId, f.eventId, f.at]
      );
    }
    for (const r of reviews) {
      await client.query(
        `INSERT INTO reviews (event_id, user_id, rating, comment, verified, created_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [r.eventId, r.userId, r.rating, r.comment, r.verified, r.at]
      );
    }

    const chunk = 500;
    for (let i = 0; i < interactions.length; i += chunk) {
      const part = interactions.slice(i, i + chunk);
      await client.query(
        `INSERT INTO interactions (user_id, session_id, event_id, type, meta, is_sample, created_at)
         SELECT * FROM unnest($1::uuid[], $2::text[], $3::int[], $4::interaction_type[], $5::jsonb[], $6::bool[], $7::timestamptz[])`,
        [
          part.map((x) => x.userId),
          part.map((x) => x.sessionId),
          part.map((x) => x.eventId),
          part.map((x) => x.type),
          part.map((x) => JSON.stringify(x.meta)),
          part.map(() => true),
          part.map((x) => x.at)
        ]
      );
    }

    await client.query(`INSERT INTO app_meta (key, value) VALUES ('sample_anchor', $1)`, [
      todayMidnight.toISOString()
    ]);

    log(
      `seeded ${events.length} events, ${users.length + organizerIds.size} users, ${bookings.length} bookings, ` +
        `${reviews.length} reviews, ${interactions.length} interactions`
    );
  });
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const reset = process.argv.includes("--reset");
  seedDatabase({ reset, log: console.log })
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

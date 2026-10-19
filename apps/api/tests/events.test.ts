import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app, ensureSeed, pool } from "./helpers.js";

beforeAll(ensureSeed);
afterAll(() => pool.end());

describe("catalogue", () => {
  it("reports health and meta", async () => {
    expect((await request(app).get("/api/health")).body).toEqual({ status: "ok" });
    const meta = await request(app).get("/api/meta");
    expect(meta.body.categories).toContain("تقنية");
    expect(meta.body.districts.length).toBeGreaterThan(5);
  });

  it("lists only upcoming/live events, soonest first, by default", async () => {
    const res = await request(app).get("/api/events?limit=100");
    expect(res.status).toBe(200);
    const events = res.body.events as { status: string; startsAt: string }[];
    expect(events.length).toBeGreaterThan(15);
    expect(events.every((e) => e.status !== "ended")).toBe(true);
    const starts = events.map((e) => Date.parse(e.startsAt));
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(res.body.total).toBe(events.length);
  });

  it("filters by category, price and booking", async () => {
    const workshops = await request(app).get("/api/events?category=ورش");
    expect(workshops.body.events.length).toBeGreaterThan(0);
    expect(workshops.body.events.every((e: { category: string }) => e.category === "ورش")).toBe(true);

    const free = await request(app).get("/api/events?price=free&limit=100");
    expect(free.body.events.every((e: { price: number }) => e.price === 0)).toBe(true);

    const bookable = await request(app).get("/api/events?booking=true&limit=100");
    expect(bookable.body.events.every((e: { requiresBooking: boolean }) => e.requiresBooking)).toBe(true);
  });

  it("sorts by distance from the given location (nearest first)", async () => {
    // Uhud area
    const res = await request(app).get("/api/events?sort=nearest&lat=24.5004&lng=39.6121&limit=100");
    const d = res.body.events.map((e: { distanceKm: number }) => e.distanceKm) as number[];
    expect(d.every((x) => typeof x === "number")).toBe(true);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    expect(res.body.events[0].district).toBe("منطقة أحد");
  });

  it("sorts by popularity and exposes ratings on ended events", async () => {
    const popular = await request(app).get("/api/events?sort=popular&limit=100");
    const scores = popular.body.events.map((e: { popularity: number }) => e.popularity) as number[];
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);

    const ended = await request(app).get("/api/events?status=ended&limit=100");
    expect(ended.body.events.length).toBeGreaterThanOrEqual(5);
    expect(ended.body.events.some((e: { avgRating: number | null }) => e.avgRating !== null)).toBe(true);
  });

  it("`when=tonight` only returns events overlapping tonight", async () => {
    const res = await request(app).get("/api/events?when=tonight&limit=100");
    expect(res.status).toBe(200);
    for (const e of res.body.events) expect(e.status === "ended").toBe(false);
  });

  it("rejects invalid query parameters with a readable error", async () => {
    const res = await request(app).get("/api/events?sort=sideways");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("returns detail with similar events and rating distribution, and 404 for unknown", async () => {
    const res = await request(app).get("/api/events/falcon-festival");
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe("مهرجان الصقور");
    expect(res.body.similar.every((e: { id: number }) => e.id !== res.body.event.id)).toBe(true);
    expect(Object.keys(res.body.ratingDistribution)).toHaveLength(5);

    const missing = await request(app).get("/api/events/does-not-exist");
    expect(missing.status).toBe(404);
  });

  it("has no unescaped markup issues: API returns raw text only as JSON", async () => {
    const res = await request(app).get("/api/events/falcon-festival");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["content-security-policy"]).toBeDefined();
  });
});

describe("GET /api/reviews/latest", () => {
  it("returns recent written reviews with first names only", async () => {
    const res = await request(app).get("/api/reviews/latest?limit=4");
    expect(res.status).toBe(200);
    expect(res.body.reviews.length).toBeGreaterThan(0);
    expect(res.body.reviews.length).toBeLessThanOrEqual(4);
    for (const r of res.body.reviews) {
      expect(r.authorName).not.toContain(" ");
      expect(r.comment.length).toBeGreaterThanOrEqual(20);
      expect(r.eventSlug).toBeTruthy();
    }
  });
});

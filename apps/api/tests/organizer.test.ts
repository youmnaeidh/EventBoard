import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_ORGANIZER_EMAIL, DEMO_PASSWORD, app, ensureSeed, futureEventPayload, loginAgent, pool, registerAgent } from "./helpers.js";
import { refreshSampleDates } from "../src/seed/refresh.js";
import { riyadhMidnight, riyadhWeekday, timeWindow } from "../src/services/time.js";

beforeAll(ensureSeed);
afterAll(() => pool.end());

describe("organizer", () => {
  it("validates event input with readable errors", async () => {
    const { agent } = await registerAgent("organizer");
    const bad = await agent.post("/api/organizer/events").send(futureEventPayload({ title: "x", endsAt: new Date(Date.now() - 1000).toISOString() }));
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("validation_error");
    const paths = bad.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toContain("title");

    const http = await agent.post("/api/organizer/events").send(futureEventPayload({ imageUrl: "http://insecure.example/x.png" }));
    expect(http.status).toBe(400);
    const past = await agent.post("/api/organizer/events").send(
      futureEventPayload({ startsAt: new Date(Date.now() - 86_400_000).toISOString(), endsAt: new Date(Date.now() - 80_000_000).toISOString() })
    );
    expect(past.status).toBe(400);
  });

  it("lets only the owner edit or delete, and protects events with bookings", async () => {
    const owner = await registerAgent("organizer");
    const stranger = await registerAgent("organizer");
    const created = await owner.agent.post("/api/organizer/events").send(futureEventPayload({ capacity: 10 }));
    const id = created.body.event.id as number;

    expect((await stranger.agent.put(`/api/organizer/events/${id}`).send(futureEventPayload())).status).toBe(403);
    expect((await stranger.agent.delete(`/api/organizer/events/${id}`)).status).toBe(403);

    const attendee = await registerAgent("attendee");
    await attendee.agent.post(`/api/events/${id}/bookings`).send({ seats: 4 });
    const shrink = await owner.agent.put(`/api/organizer/events/${id}`).send(futureEventPayload({ capacity: 2 }));
    expect(shrink.status).toBe(409);
    expect(shrink.body.error.code).toBe("capacity_below_booked");
    expect((await owner.agent.delete(`/api/organizer/events/${id}`)).status).toBe(409);

    const ok = await owner.agent.put(`/api/organizer/events/${id}`).send(futureEventPayload({ capacity: 12, title: "عنوان معدّل" }));
    expect(ok.status).toBe(200);
    expect(ok.body.event.title).toBe("عنوان معدّل");
  });

  it("returns a funnel, daily series and revenue for the demo organizer", async () => {
    const org = await loginAgent(DEMO_ORGANIZER_EMAIL, DEMO_PASSWORD);
    const mine = await org.get("/api/organizer/events");
    expect(mine.body.events.length).toBeGreaterThanOrEqual(6);
    const first = mine.body.events.find((e: { stats: { bookings: number } }) => e.stats.bookings > 0);
    const res = await org.get(`/api/organizer/events/${first.event.id}/analytics`);
    expect(res.status).toBe(200);
    expect(res.body.daily).toHaveLength(14);
    expect(res.body.period.days).toBe(14);
    expect(res.body.funnel.views).toBeGreaterThan(0);
    expect(res.body.revenue).toBe(res.body.funnel.seats * res.body.event.price);
  });

  it("falls back gracefully when the AI service is not configured", async () => {
    const org = await loginAgent(DEMO_ORGANIZER_EMAIL, DEMO_PASSWORD);
    const insights = await org.get("/api/organizer/insights");
    expect(insights.status).toBe(200);
    expect(insights.body.mode).toBe("basic");
    expect(insights.body.gaps.length).toBeGreaterThan(0);
    const forecast = await org.post("/api/organizer/forecast").send({
      category: "ورش", price: 50, startsAt: new Date(Date.now() + 5 * 86_400_000).toISOString()
    });
    expect(forecast.status).toBe(503);
  });
});

describe("search and recommendations without the AI service", () => {
  it("falls back to keyword search and logs the query", async () => {
    const res = await request(app).get("/api/search").query({ q: "قهوة", sessionId: "session-search-1" });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("basic");
    expect(res.body.results.length).toBeGreaterThan(0);
    const logged = await pool.query("SELECT meta FROM interactions WHERE type='search' AND session_id='session-search-1'");
    expect(logged.rows[0].meta.q).toBe("قهوة");
    expect(logged.rows[0].meta.results).toBe(res.body.results.length);
  });

  it("recommends using saved interests when AI is unavailable", async () => {
    const { agent } = await registerAgent("attendee");
    await agent.put("/api/auth/me/interests").send({ interests: ["تقنية"] });
    const res = await agent.get("/api/recommendations?limit=3");
    expect(res.status).toBe(200);
    expect(res.body.items[0].event.category).toBe("تقنية");
  });

  it("assistant reports a clear 503 when AI is down", async () => {
    const res = await request(app).post("/api/assistant").send({ messages: [{ role: "user", content: "وين اروح الليلة؟" }] });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("ai_unavailable");
  });
});

describe("time helpers and sample refresh", () => {
  it("computes Riyadh midnight and the Saudi weekend", () => {
    const d = new Date("2026-10-11T06:12:00+03:00"); // Sunday
    expect(riyadhMidnight(d).toISOString()).toBe("2026-10-10T21:00:00.000Z");
    expect(riyadhWeekday(d)).toBe(0);
    const w = timeWindow("weekend", d);
    expect(riyadhWeekday(w.from)).toBe(5); // next Friday
    expect(w.to.getTime() - riyadhMidnight(w.from).getTime()).toBe(2 * 86_400_000);
  });

  it("re-anchors sample dates by whole days", async () => {
    const before = await pool.query("SELECT starts_at FROM events WHERE slug = 'falcon-festival'");
    const shifted = await refreshSampleDates(new Date(Date.now() + 3 * 86_400_000));
    expect(shifted).toBe(3);
    const after = await pool.query("SELECT starts_at FROM events WHERE slug = 'falcon-festival'");
    expect(after.rows[0].starts_at.getTime() - before.rows[0].starts_at.getTime()).toBe(3 * 86_400_000);
    expect(await refreshSampleDates(new Date(Date.now() + 3 * 86_400_000))).toBe(0);
  });
});

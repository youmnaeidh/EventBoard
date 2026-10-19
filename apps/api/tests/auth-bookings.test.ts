import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEMO_ORGANIZER_EMAIL,
  DEMO_PASSWORD,
  app,
  ensureSeed,
  futureEventPayload,
  loginAgent,
  pool,
  registerAgent,
  uniqueEmail
} from "./helpers.js";

beforeAll(ensureSeed);
afterAll(() => pool.end());

describe("auth", () => {
  it("registers, keeps the session in an httpOnly cookie, and exposes /me", async () => {
    const email = uniqueEmail();
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/register").send({ name: "نورة", email, password: "Passw0rd!x" });
    expect(res.status).toBe(201);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/HttpOnly/i);
    expect(res.body.user.role).toBe("attendee");
    expect(res.body.user.password_hash).toBeUndefined();
    const me = await agent.get("/api/auth/me");
    expect(me.body.user.email).toBe(email);
  });

  it("rejects duplicate emails, weak passwords and wrong credentials", async () => {
    const { email } = await registerAgent();
    const dup = await request(app).post("/api/auth/register").send({ name: "سارة", email, password: "Passw0rd!x" });
    expect(dup.status).toBe(409);
    const weak = await request(app).post("/api/auth/register").send({ name: "سارة", email: uniqueEmail(), password: "123" });
    expect(weak.status).toBe(400);
    const bad = await request(app).post("/api/auth/login").send({ email, password: "wrong-password" });
    expect(bad.status).toBe(401);
    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@x.com", password: "whatever1" });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(bad.body.error.message);
  });

  it("protects organizer routes by role", async () => {
    const anon = await request(app).get("/api/organizer/events");
    expect(anon.status).toBe(401);
    const { agent } = await registerAgent("attendee");
    expect((await agent.get("/api/organizer/events")).status).toBe(403);
    const org = await loginAgent(DEMO_ORGANIZER_EMAIL, DEMO_PASSWORD);
    expect((await org.get("/api/organizer/events")).status).toBe(200);
  });

  it("ignores a tampered session cookie", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", "eb_token=not-a-real-token");
    expect(res.body.user).toBeNull();
  });
});

describe("GitHub Pages cross-origin integration", () => {
  const trustedOrigin = "https://youmnaeidh.github.io";

  it("allows CORS preflight only for the configured GitHub Pages origin", async () => {
    const ok = await request(app).options("/api/auth/me")
      .set("Origin", trustedOrigin)
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "Authorization");
    expect(ok.status).toBe(204);
    expect(ok.headers["access-control-allow-origin"]).toBe(trustedOrigin);
    expect(ok.headers["access-control-allow-headers"]).toContain("Authorization");

    const bad = await request(app).options("/api/auth/me")
      .set("Origin", "https://malicious.example")
      .set("Access-Control-Request-Method", "GET");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns a short-lived bearer token only to the trusted origin, and accepts bearer requests", async () => {
    await ensureSeed();
    const login = await request(app).post("/api/auth/login")
      .set("Origin", trustedOrigin)
      .send({ email: DEMO_ORGANIZER_EMAIL, password: DEMO_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toEqual(expect.any(String));
    const me = await request(app).get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(me.body.user.email).toBe(DEMO_ORGANIZER_EMAIL);

    const other = await request(app).post("/api/auth/login")
      .set("Origin", "https://malicious.example")
      .send({ email: DEMO_ORGANIZER_EMAIL, password: DEMO_PASSWORD });
    expect(other.status).toBe(200);
    expect(other.body.accessToken).toBeUndefined();
  });
});

describe("bookings", () => {
  it("never oversells under concurrent requests and frees seats on cancel", async () => {
    const { agent: organizer } = await registerAgent("organizer", "منظم اختبار");
    const created = await organizer.post("/api/organizer/events").send(futureEventPayload({ capacity: 3 }));
    expect(created.status).toBe(201);
    const eventId = created.body.event.id as number;

    const attendees = await Promise.all(Array.from({ length: 6 }, () => registerAgent("attendee")));
    const results = await Promise.all(attendees.map(({ agent }) => agent.post(`/api/events/${eventId}/bookings`).send({ seats: 1 })));
    const ok = results.filter((r) => r.status === 201);
    const full = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(3);
    expect(full).toHaveLength(3);
    expect(full[0]?.body.error.code).toBe("sold_out");

    const detail = await request(app).get(`/api/events/${eventId}`);
    expect(detail.body.event.seatsLeft).toBe(0);

    // cancel one -> seat is available again
    const winner = attendees.find((_, i) => results[i]?.status === 201)!;
    const mine = await winner.agent.get("/api/me/bookings");
    const bookingId = mine.body.bookings[0].id as string;
    expect((await winner.agent.delete(`/api/me/bookings/${bookingId}`)).status).toBe(204);
    const after = await request(app).get(`/api/events/${eventId}`);
    expect(after.body.event.seatsLeft).toBe(1);
  });

  it("rejects double booking, overbooking in one request, and free-entry events", async () => {
    const { agent: organizer } = await registerAgent("organizer");
    const created = await organizer.post("/api/organizer/events").send(futureEventPayload({ capacity: 5 }));
    const id = created.body.event.id as number;
    const { agent } = await registerAgent("attendee");
    expect((await agent.post(`/api/events/${id}/bookings`).send({ seats: 2 })).status).toBe(201);
    const again = await agent.post(`/api/events/${id}/bookings`).send({ seats: 1 });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("already_booked");

    const other = await registerAgent("attendee");
    const tooMany = await other.agent.post(`/api/events/${id}/bookings`).send({ seats: 4 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe("not_enough_seats");

    const noBooking = await other.agent.post("/api/events/1/bookings").send({ seats: 1 });
    expect(noBooking.status).toBe(400); // book fair has no booking
    expect((await request(app).post(`/api/events/${id}/bookings`).send({ seats: 1 })).status).toBe(401);
  });

  it("does not let other users cancel someone's booking", async () => {
    const { agent: organizer } = await registerAgent("organizer");
    const id = (await organizer.post("/api/organizer/events").send(futureEventPayload())).body.event.id as number;
    const a = await registerAgent("attendee");
    const b = await registerAgent("attendee");
    await a.agent.post(`/api/events/${id}/bookings`).send({ seats: 1 });
    const bookingId = (await a.agent.get("/api/me/bookings")).body.bookings[0].id as string;
    expect((await b.agent.delete(`/api/me/bookings/${bookingId}`)).status).toBe(403);
  });
});

describe("favourites and reviews", () => {
  it("toggles favourites and lists them for the user", async () => {
    const { agent } = await registerAgent("attendee");
    expect((await agent.put("/api/events/2/favorite")).body.isFavorite).toBe(true);
    expect((await agent.put("/api/events/2/favorite")).status).toBe(200); // idempotent
    const list = await agent.get("/api/me/favorites");
    expect(list.body.events.map((e: { id: number }) => e.id)).toEqual([2]);
    expect((await agent.delete("/api/events/2/favorite")).body.isFavorite).toBe(false);
    expect((await agent.get("/api/me/favorites")).body.events).toEqual([]);
  });

  it("only allows reviews after the event started, one per user (upsert)", async () => {
    const { agent } = await registerAgent("attendee");
    const upcoming = await agent.post("/api/events/2/reviews").send({ rating: 5, comment: "قبل الوقت" });
    expect(upcoming.status).toBe(400);

    const ended = (await request(app).get("/api/events?status=ended&limit=5")).body.events[0].id as number;
    expect((await agent.post(`/api/events/${ended}/reviews`).send({ rating: 4, comment: "حلو" })).status).toBe(201);
    expect((await agent.post(`/api/events/${ended}/reviews`).send({ rating: 2, comment: "عدلت رأيي" })).status).toBe(201);
    const list = await request(app).get(`/api/events/${ended}/reviews`);
    const mine = list.body.reviews.filter((r: { comment: string }) => r.comment === "عدلت رأيي");
    expect(mine).toHaveLength(1);
    expect((await agent.post(`/api/events/${ended}/reviews`).send({ rating: 9 })).status).toBe(400);
  });
});

describe("tracking", () => {
  it("stores whitelisted interaction types only", async () => {
    const ok = await request(app).post("/api/track").send({ type: "view", sessionId: "session-abcdef12", eventId: 3, source: "home" });
    expect(ok.status).toBe(204);
    const bad = await request(app).post("/api/track").send({ type: "book", sessionId: "session-abcdef12", eventId: 3 });
    expect(bad.status).toBe(400);
    const junk = await request(app).post("/api/track").send({ type: "view", sessionId: "x", eventId: "abc" });
    expect(junk.status).toBe(400);
  });
});

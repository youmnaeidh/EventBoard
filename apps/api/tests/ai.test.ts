import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { resetAiCircuit } from "../src/services/aiClient.js";
import { DEMO_ATTENDEE_EMAIL, DEMO_ORGANIZER_EMAIL, DEMO_PASSWORD, app, ensureSeed, loginAgent, pool } from "./helpers.js";

// A stand-in for the Python service: records what the API sends and returns canned answers.
const received: { path: string; auth: string | undefined; body: any }[] = [];
let server: http.Server;

beforeAll(async () => {
  await ensureSeed();
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : {};
      received.push({ path: req.url ?? "", auth: req.headers.authorization, body });
      const first = body.events?.[0]?.id;
      const reply: Record<string, unknown> = {
        "/v1/search": {
          interpretation: { when: "tonight" }, chips: ["الليلة"], relaxed: false, engine: "stub",
          results: [{ eventId: first, score: 0.9, reasons: ["اختبار"] }, { eventId: 987654, score: 0.5, reasons: [] }]
        },
        "/v1/recommend": {
          strategy: "personalized",
          recommendations: [{ eventId: first, score: 0.7, components: { content: 0.7 }, reasons: ["سبب"] }]
        },
        "/v1/assistant": { answer: "جواب تجريبي", eventIds: [first, 987654], mode: "offline", chips: [] },
        "/v1/demand-gaps": { gaps: [{ label: "فخار", category: "ورش", searches: 50, searches7d: 30, prev7d: 10, trend: 2, zeroResultShare: 1, supply: 0, demandRatio: 50, opportunity: "high", exampleQueries: ["فخار"] }], totalSearches: 50 },
        "/v1/forecast/predict": { expectedBookings: 10, low: 5, high: 15, expectedFillRate: 0.4, drivers: [], slots: [], capacityAdvice: "ok", model: {} }
      };
      const payload = reply[req.url ?? ""];
      res.writeHead(payload ? 200 : 404, { "content-type": "application/json" });
      res.end(JSON.stringify(payload ?? {}));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  config.AI_SERVICE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  config.AI_SERVICE_TOKEN = "shared-secret";
  resetAiCircuit();
});

afterAll(async () => {
  config.AI_SERVICE_URL = "";
  config.AI_SERVICE_TOKEN = "";
  await new Promise((r) => server.close(r));
  await pool.end();
});

describe("API <-> AI service contract", () => {
  it("search: sends the filtered catalogue with the shared token and maps ids back to events", async () => {
    received.length = 0;
    const res = await request(app).get("/api/search").query({ q: "ابغى شي عائلي الليلة", price: "paid", sessionId: "session-ai-1" });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("ai");
    expect(res.body.engine).toBe("stub");
    expect(res.body.results).toHaveLength(1); // unknown id 987654 is dropped, never invented
    expect(res.body.results[0].event.title).toBeTruthy();
    const call = received.find((r) => r.path === "/v1/search")!;
    expect(call.auth).toBe("Bearer shared-secret");
    expect(call.body.query).toBe("ابغى شي عائلي الليلة");
    expect(call.body.events.every((e: { price: number }) => e.price > 0)).toBe(true); // structured filter applied first
    expect(call.body.events[0].description).toBeDefined();
    const logged = await pool.query("SELECT meta FROM interactions WHERE session_id = 'session-ai-1'");
    expect(logged.rows[0].meta.results).toBe(1);
  });

  it("recommendations: sends history, interaction matrix and past events for a signed-in user", async () => {
    received.length = 0;
    const agent = await loginAgent(DEMO_ATTENDEE_EMAIL, DEMO_PASSWORD);
    const res = await agent.get("/api/recommendations?limit=4");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("ai");
    const call = received.find((r) => r.path === "/v1/recommend")!;
    expect(call.body.user.history.length).toBeGreaterThan(0);
    expect(call.body.matrix.length).toBeGreaterThan(100);
    expect(call.body.matrix[0]).toHaveLength(3);
    expect(Array.isArray(call.body.pastEvents)).toBe(true);
    // user ids are re-indexed: no uuid leaves the API
    expect(JSON.stringify(call.body.matrix)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it("assistant, insights and forecast pass through", async () => {
    const assistant = await request(app).post("/api/assistant").send({ messages: [{ role: "user", content: "ابغى شي" }] });
    expect(assistant.body.answer).toBe("جواب تجريبي");
    expect(assistant.body.events).toHaveLength(1);

    const org = await loginAgent(DEMO_ORGANIZER_EMAIL, DEMO_PASSWORD);
    const insights = await org.get("/api/organizer/insights");
    expect(insights.body.mode).toBe("ai");
    expect(insights.body.gaps[0].label).toBe("فخار");
    const call = received.filter((r) => r.path === "/v1/demand-gaps").at(-1)!;
    expect(call.body.searches.length).toBeGreaterThan(100);

    const forecast = await org.post("/api/organizer/forecast").send({ category: "ورش", price: 50, startsAt: new Date(Date.now() + 5 * 86_400_000).toISOString() });
    expect(forecast.body.expectedBookings).toBe(10);
  });

  it("falls back when the service goes down, then recovers after the circuit closes", async () => {
    const original = config.AI_SERVICE_URL;
    config.AI_SERVICE_URL = "http://127.0.0.1:9"; // nothing listens here
    resetAiCircuit();
    const down = await request(app).get("/api/search").query({ q: "قهوة" });
    expect(down.body.mode).toBe("basic");
    config.AI_SERVICE_URL = original;
    const stillOpen = await request(app).get("/api/search").query({ q: "قهوة" });
    expect(stillOpen.body.mode).toBe("basic"); // breaker is open: no waiting on timeouts
    resetAiCircuit();
    const recovered = await request(app).get("/api/search").query({ q: "قهوة" });
    expect(recovered.body.mode).toBe("ai");
  });
});

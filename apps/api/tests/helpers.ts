import request from "supertest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db.js";
import { seedDatabase, DEMO_ATTENDEE_EMAIL, DEMO_ORGANIZER_EMAIL, DEMO_PASSWORD } from "../src/seed/seed.js";

export const app = createApp();
export { pool, DEMO_ATTENDEE_EMAIL, DEMO_ORGANIZER_EMAIL, DEMO_PASSWORD };

let seeded = false;
export async function ensureSeed() {
  if (seeded) return;
  await seedDatabase({ reset: true });
  seeded = true;
}

let counter = 0;
export function uniqueEmail(prefix = "t") {
  counter += 1;
  return `${prefix}${Date.now()}${counter}@test.local`;
}

export async function registerAgent(role: "attendee" | "organizer" = "attendee", name = "مستخدم اختبار") {
  const agent = request.agent(app);
  const email = uniqueEmail(role);
  const res = await agent.post("/api/auth/register").send({ name, email, password: "Passw0rd!x", role });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, email, user: res.body.user as { id: string } };
}

export async function loginAgent(email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return agent;
}

export function futureEventPayload(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 3 * 24 * 3_600_000);
  const end = new Date(start.getTime() + 3 * 3_600_000);
  return {
    title: "فعالية اختبار",
    summary: "ملخص قصير لفعالية اختبار تجريبية",
    description: "وصف كافي للفعالية التجريبية يتجاوز عشرين حرفًا بالتأكيد.",
    category: "ورش",
    eventType: "ورشة",
    venue: "قاعة الاختبار",
    district: "قباء",
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    price: 20,
    capacity: 3,
    audience: "الجميع",
    highlights: ["نقطة"],
    ...overrides
  };
}

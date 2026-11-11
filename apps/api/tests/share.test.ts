import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app, ensureSeed, futureEventPayload, pool, registerAgent } from "./helpers.js";
beforeAll(ensureSeed);
afterAll(() => pool.end());

describe("server-rendered share previews", () => {
  it("renders current raw HTML metadata and escapes organizer input", async () => {
    const owner = await registerAgent("organizer");
    const payload = futureEventPayload({ title: 'ورشة <script>alert(1)</script> "تجربة"', imageUrl: "https://example.org/cover.jpg?a=1&b=2" });
    const created = await owner.agent.post("/api/organizer/events").send(payload);
    const event = created.body.event;
    const result = await request(app).get("/api/share/" + event.slug).set("Host", "attacker.example");
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toMatch(/text\/html/);
    expect(result.text).toContain('property="og:title" content="ورشة &lt;script&gt;alert(1)&lt;/script&gt; &quot;تجربة&quot;"');
    expect(result.text).toContain('property="og:image" content="https://example.org/cover.jpg?a=1&amp;b=2"');
    expect(result.text).toContain("https://youmnaeidh.github.io/EventBoard/#/events/" + event.slug);
    expect(result.text).not.toContain("<script>");
    expect(result.text).not.toContain("attacker.example");
    await owner.agent.put("/api/organizer/events/" + event.id).send({ ...payload, title: "العنوان الجديد" });
    expect((await request(app).get("/api/share/" + event.slug)).text).toContain('property="og:title" content="العنوان الجديد"');
  });
  it("never renders drafts, even for their owner and after unpublishing", async () => {
    const owner = await registerAgent("organizer");
    const created = await owner.agent.post("/api/organizer/events").send(futureEventPayload());
    const { id, slug } = created.body.event;
    expect((await request(app).get("/api/share/" + slug)).status).toBe(200);
    await owner.agent.put("/api/organizer/events/" + id).send(futureEventPayload({ publicationStatus: "draft" }));
    expect((await request(app).get("/api/share/" + slug)).status).toBe(404);
    expect((await owner.agent.get("/api/share/" + slug)).status).toBe(404);
    expect((await request(app).get("/api/share/does-not-exist")).status).toBe(404);
  });
  it("resolves uploaded covers at the API and bundled covers at the Pages path", async () => {
    const owner = await registerAgent("organizer");
    const imageUrl = "/api/media/" + owner.user.id + "/11111111-1111-4111-8111-111111111111.webp";
    const created = await owner.agent.post("/api/organizer/events").send(futureEventPayload({ imageUrl }));
    const { id, slug } = created.body.event;
    expect((await request(app).get("/api/share/" + slug)).text).toContain('content="http://localhost:4000' + imageUrl + '"');
    await owner.agent.put("/api/organizer/events/" + id).send(futureEventPayload({ imageUrl: "/assets/events/workshop.webp" }));
    expect((await request(app).get("/api/share/" + slug)).text).toContain('content="https://youmnaeidh.github.io/EventBoard/assets/events/workshop.webp"');
  });
});

import request from "supertest";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app, ensureSeed, futureEventPayload, pool, registerAgent } from "./helpers.js";
import { getImage, putImage, storageEnabled } from "../src/services/imageStorage.js";

vi.mock("../src/services/imageStorage.js", async importOriginal => ({
  ...await importOriginal<typeof import("../src/services/imageStorage.js")>(),
  storageEnabled: vi.fn(() => true), putImage: vi.fn(), getImage: vi.fn()
}));
beforeAll(ensureSeed);
afterAll(() => pool.end());
const picture = () => sharp({ create: { width: 1800, height: 900, channels: 3, background: "#512f59" } }).withMetadata().jpeg().toBuffer();
describe("private event cover uploads", () => {
  it("requires an organizer before accepting image bytes", async () => {
    expect((await request(app).post("/api/organizer/media").set("Content-Type", "image/png").send(Buffer.from("x"))).status).toBe(401);
    const attendee = await registerAgent();
    expect((await attendee.agent.post("/api/organizer/media").set("Content-Type", "image/png").send(Buffer.from("x"))).status).toBe(403);
  });
  it("decodes, resizes and strips metadata before storing a WebP", async () => {
    const owner = await registerAgent("organizer");
    const input = await picture();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const result = await owner.agent.post("/api/organizer/media").set("Content-Type", "image/jpeg").send(input);
    expect(result.status).toBe(201);
    expect(result.body.imageUrl).toContain("/api/media/" + owner.user.id + "/");
    const [key, bytes] = vi.mocked(putImage).mock.calls.at(-1)!;
    expect(key).toBe(result.body.imageUrl.replace("/api/media/", "covers/"));
    const metadata = await sharp(bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1600);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
  });
  it("rejects forged, unsupported and oversized images without storing them", async () => {
    const owner = await registerAgent("organizer");
    vi.mocked(putImage).mockClear();
    for (const type of ["image/jpeg", "image/svg+xml", "text/plain"]) {
      expect((await owner.agent.post("/api/organizer/media").set("Content-Type", type).send(Buffer.from('<svg onload="alert(1)"></svg>'))).status).toBe(400);
    }
    expect((await owner.agent.post("/api/organizer/media").set("Content-Type", "image/png").send(Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
    expect(putImage).not.toHaveBeenCalled();
  });
  it("hides unattached and draft covers and revokes public access after unpublishing", async () => {
    const owner = await registerAgent("organizer"), stranger = await registerAgent("organizer");
    const uploaded = await owner.agent.post("/api/organizer/media").set("Content-Type", "image/jpeg").send(await picture());
    expect(uploaded.status).toBe(201);
    const imageUrl = uploaded.body.imageUrl as string;
    vi.mocked(getImage).mockResolvedValue(await sharp(await picture()).webp().toBuffer());
    expect((await request(app).get(imageUrl)).status).toBe(404);
    expect((await stranger.agent.get(imageUrl)).status).toBe(404);
    expect((await owner.agent.get(imageUrl)).status).toBe(200);
    const payload = futureEventPayload({ imageUrl, publicationStatus: "draft" });
    const created = await owner.agent.post("/api/organizer/events").send(payload);
    expect(created.status).toBe(201);
    expect((await request(app).get(imageUrl)).status).toBe(404);
    expect((await stranger.agent.post("/api/organizer/events").send(payload)).status).toBe(403);
    const other = await stranger.agent.post("/api/organizer/events").send(futureEventPayload());
    expect((await stranger.agent.put("/api/organizer/events/" + other.body.event.id).send(payload)).status).toBe(403);
    const route = "/api/organizer/events/" + created.body.event.id;
    expect((await owner.agent.put(route).send({ ...payload, publicationStatus: "published" })).status).toBe(200);
    const publicImage = await request(app).get(imageUrl);
    expect(publicImage.status).toBe(200);
    expect(publicImage.headers["content-type"]).toMatch(/^image\/webp/);
    expect(publicImage.headers["cache-control"]).toContain("no-store");
    await owner.agent.put(route).send(payload);
    expect((await request(app).get(imageUrl)).status).toBe(404);
  });
  it("keeps URL-based event creation available without storage", async () => {
    vi.mocked(storageEnabled).mockReturnValue(false);
    try {
      const owner = await registerAgent("organizer");
      expect((await owner.agent.get("/api/organizer/media/config")).body.enabled).toBe(false);
      expect((await owner.agent.post("/api/organizer/media").set("Content-Type", "image/jpeg").send(await picture())).status).toBe(503);
      expect((await owner.agent.post("/api/organizer/events").send(futureEventPayload({ imageUrl: "https://example.org/photo.jpg" }))).status).toBe(201);
    } finally { vi.mocked(storageEnabled).mockReturnValue(true); }
  });
  it("returns a retryable response if the object store fails", async () => {
    const owner = await registerAgent("organizer");
    vi.mocked(putImage).mockRejectedValueOnce(new Error("storage connection unavailable"));
    const result = await owner.agent.post("/api/organizer/media").set("Content-Type", "image/jpeg").send(await picture());
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe("storage_unavailable");
  });
});

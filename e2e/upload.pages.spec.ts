import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

// The pre-cutover deployment gate serves the candidate build at the Pages origin.
test.beforeEach(async ({ page, baseURL }) => {
  if (!process.env.E2E_PAGES_ARTIFACT) return;
  const root = resolve(process.env.E2E_PAGES_ARTIFACT), base = new URL(baseURL!);
  const types: Record<string, string> = {
    ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    ".woff": "font/woff", ".woff2": "font/woff2", ".mp4": "video/mp4", ".ico": "image/x-icon"
  };
  await page.route(`${base.origin}${base.pathname}**`, async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = resolve(root, pathname.slice(base.pathname.length) || "index.html");
    if (!file.startsWith(root + sep)) return route.fulfill({ status: 403 });
    try { await route.fulfill({ status: 200, contentType: types[extname(file)] ?? "application/octet-stream", body: await readFile(file) }); }
    catch { await route.fulfill({ status: 404, body: "Asset not found" }); }
  });
});

test("Pages upload keeps old cover on failure and authenticates private previews", async ({ page }, info) => {
  const apiOrigin = process.env.E2E_API_URL ?? "http://localhost:4000";
  await page.goto("#/login");
  await page.getByRole("button", { name: "جرّب كمنظّم" }).click();
  // Wait for the organizer login redirect; the avatar may appear before navigation completes.
  await expect(page).toHaveURL(/#\/organizer$/);
  await expect(page.locator(".avatar-btn")).toBeVisible();
  const token = await page.evaluate(() => sessionStorage.getItem("eventboard-demo-access-token"));
  const me = await page.request.get(`${apiOrigin}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } });
  const owner = (await me.json()).user.id;
  const imagePath = `/api/media/${owner}/11111111-1111-4111-8111-111111111111.webp`;
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const headers = { "access-control-allow-origin": new URL(page.url()).origin };
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let fail = false, authorized = false;
  await page.route("**/api/organizer/media/config", route => route.fulfill({ headers, json: { enabled: true, maxBytes: 10 * 1024 * 1024 } }));
  await page.route("**/api/organizer/media", async route => {
    if (route.request().method() === "OPTIONS") return route.continue();
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await held;
    await route.fulfill(fail ? { headers, status: 503, json: { error: { message: "تعذّر رفع الصورة" } } } : { headers, status: 201, json: { imageUrl: imagePath } });
  });
  await page.route(`**${imagePath}`, async route => {
    if (route.request().method() === "OPTIONS") return route.continue();
    authorized = route.request().headers().authorization === `Bearer ${token}`;
    await route.fulfill({ headers, contentType: "image/png", body: pixel });
  });
  await page.goto("#/organizer/events/new");
  await page.getByLabel("اسم الفعالية", { exact: true }).fill("اختبار رفع صورة");
  await page.getByLabel("اسم المكان", { exact: true }).fill("قاعة الاختبار");
  const picker = page.locator('input[type="file"]');
  await picker.setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: pixel });
  await expect(page.getByRole("button", { name: "حفظ كمسودة", exact: true })).toBeDisabled();
  release();
  await expect(page.locator(".form-cover-preview img")).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => authorized).toBe(true);
  await expect(page.getByRole("button", { name: "حفظ كمسودة", exact: true })).toBeEnabled();
  fail = true;
  await picker.setInputFiles({ name: "second.png", mimeType: "image/png", buffer: pixel });
  await expect(page.locator('.org-form [role="alert"]')).toContainText("تعذّر رفع الصورة");
  await expect(page.getByLabel("رابط الصورة (اختياري، https)")).toHaveValue(imagePath);
  await expect(page.locator(".form-cover-preview img")).toHaveAttribute("src", /^blob:/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath("upload-mobile.png"), fullPage: true });
});

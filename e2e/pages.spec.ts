import { expect, test, type Page } from "@playwright/test";

const apiOrigin = process.env.E2E_API_URL ?? "http://localhost:4000";
const tokenKey = "eventboard-demo-access-token";

async function login(page: Page, role: "attendee" | "organizer" = "attendee") {
  await page.goto("#/login");
  await page.getByRole("button", { name: role === "organizer" ? "جرّب كمنظّم" : "جرّب كحاضر" }).click();
  await expect(page.locator(".avatar-btn")).toBeVisible();
}

test("Pages base path loads images, video, fonts and hash deep links", async ({ page }, info) => {
  const failedAssets: string[] = [];
  page.on("response", r => {
    if (r.url().includes("/EventBoard/assets/") && r.status() >= 400) failedAssets.push(r.url());
  });
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("المدينة المنورة");
  await expect(page.locator(".hero video source")).toHaveAttribute("src", "/EventBoard/assets/video/madinah-intro.mp4");
  expect((await page.request.get("assets/video/madinah-intro.mp4")).ok()).toBeTruthy();
  await expect(page.locator(".row:not(.row-skel)").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath("home-desktop.png"), fullPage: true });
  await page.goto("#/events/madinah-nights");
  await expect(page.locator(".detail-title")).toBeVisible();
  await page.reload();
  await expect(page.locator(".detail-title")).toContainText("ليالي");
  expect(failedAssets).toEqual([]);
});

test("bearer login persists after reload and logout clears it without cookies", async ({ page }) => {
  const calls: { authorization?: string; cookie?: string }[] = [];
  page.on("request", r => {
    if (r.url() === `${apiOrigin}/api/auth/me`) calls.push(r.headers());
  });
  await login(page);
  await page.reload();
  await expect(page.locator(".avatar-btn")).toBeVisible();
  expect(calls.some(h => h.authorization?.startsWith("Bearer "))).toBeTruthy();
  expect(calls.every(h => !h.cookie)).toBeTruthy();
  await page.locator(".avatar-btn").click();
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  expect(await page.evaluate(k => sessionStorage.getItem(k), tokenKey)).toBeNull();
  await page.reload();
  await expect(page.locator(".avatar-btn")).toHaveCount(0);
});

test("cross-origin registration, favourites, booking, ticket and cancellation", async ({ page }) => {
  await page.goto("#/register");
  await page.getByLabel("الاسم", { exact: true }).fill("اختبار النشر");
  await page.getByLabel("البريد الإلكتروني").fill(`pages-${Date.now()}@example.test`);
  await page.getByLabel("كلمة المرور").fill("Pages-test-Password1!");
  await page.getByRole("button", { name: "إنشاء الحساب", exact: true }).click();
  await expect(page.locator(".avatar-btn")).toBeVisible();
  const token = await page.evaluate(k => sessionStorage.getItem(k), tokenKey);
  expect(token).toBeTruthy();
  const result = await page.request.get(`${apiOrigin}/api/events?booking=true&limit=100`, {
    headers: { authorization: `Bearer ${token}` }
  });
  expect(result.ok()).toBeTruthy();
  const events = (await result.json()).events as { slug: string; seatsLeft: number | null; status: string }[];
  const event = events.find(e => e.status === "upcoming" && (e.seatsLeft ?? 0) >= 2);
  expect(event, "the seeded catalogue must contain a bookable event").toBeTruthy();
  await page.goto(`#/events/${event!.slug}`);
  const fav = page.locator(".detail-actions .fav-labeled").first();
  await expect(fav).toHaveAttribute("aria-pressed", "false");
  await fav.click();
  await expect(fav).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(fav).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "احجز الآن", exact: true }).click();
  await expect(page.getByText("حجزك مؤكد")).toBeVisible();
  await expect(page.locator(".ticket-code")).toHaveText(/EB-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  await page.reload();
  await expect(page.getByText("حجزك مؤكد")).toBeVisible();
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "إلغاء الحجز" }).click();
  await expect(page.getByRole("button", { name: "احجز الآن", exact: true })).toBeVisible();
});

test("organizer dashboard and live AI forecast work across origins", async ({ page }, info) => {
  await login(page, "organizer");
  await expect(page.getByRole("heading", { name: "فعالياتي" })).toBeVisible();
  await expect(page.locator(".data-table tbody tr").first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("organizer-desktop.png"), fullPage: true });
  const forecast = page.waitForResponse(r => r.url().endsWith("/api/organizer/forecast") && r.request().method() === "POST");
  await page.goto("#/organizer/events/new");
  const response = await forecast;
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.expectedBookings).toBeGreaterThanOrEqual(0);
  await expect(page.locator(".forecast-hero > b")).toBeVisible();
  await expect(page.locator(".forecast-note")).toContainText("تجريبية");
});

test("@mobile Pages layout fits narrow screens and preserves navigation", async ({ page }, info) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["#/", "#/events", "#/events/madinah-nights", "#/login"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      if (route === "#/events") await expect(page.locator(".row:not(.row-skel)").first()).toBeVisible();
      if (route.includes("madinah-nights")) await expect(page.locator(".detail-title")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width} ${route}`).toBeLessThanOrEqual(1);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("#/");
  await page.screenshot({ path: info.outputPath("home-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "القائمة" }).click();
  await page.getByRole("navigation", { name: "التنقل", exact: true }).getByRole("link", { name: "الفعاليات", exact: true }).click();
  await expect(page).toHaveURL(/#\/events$/);
});

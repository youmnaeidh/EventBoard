import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Demo#2026";

async function login(page: Page, who: "demo" | "organizer") {
  const res = await page.request.post("/api/auth/login", { data: { email: `${who}@eventboard.demo`, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
}

test.describe("visitor", () => {
  test("home shows live data and the smart search explains what it understood", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("المدينة المنورة");
    await expect(page.getByText("الليلة في المدينة")).toBeVisible();
    await page.getByRole("searchbox", { name: /ابحث عن فعالية/ }).fill("ابغى شي عائلي الليلة");
    await page.getByRole("button", { name: "ابحث" }).click();
    await expect(page).toHaveURL(/\/events\?q=/);
    await expect(page.getByText("فهمت من كلامك:")).toBeVisible();
    await expect(page.locator(".row").first()).toBeVisible();
    await expect(page.locator(".row-reason").first()).toBeVisible();
  });

  test("the Madinah hero video is still the centrepiece of the home page", async ({ page }) => {
    await page.goto("/");
    const video = page.locator(".hero video");
    await expect(video).toHaveCount(1);
    await expect(video.locator("source")).toHaveAttribute("src", "/assets/video/madinah-intro.mp4");
    const box = await page.locator(".hero").boundingBox();
    expect(box!.height).toBeGreaterThan(600);
    expect((await page.request.get("/assets/video/madinah-intro.mp4")).ok()).toBeTruthy();
  });

  test("the vibe picker returns real, ranked events with reasons and respects the time chip", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /طلعة وهواء/ }).click();
    await expect(page.locator(".vibe .ecard").first()).toBeVisible();
    await expect(page.locator(".vibe .ecard .row-reason").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /طلعة وهواء/ })).toHaveAttribute("aria-pressed", "true");
    const first = await page.locator(".vibe .ecard-title").first().innerText();
    expect(first.length).toBeGreaterThan(2);
    await page.getByRole("button", { name: "الليلة", exact: true }).click();
    await expect(page.getByRole("button", { name: "الليلة", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: /كل النتائج/ }).click();
    await expect(page).toHaveURL(/\/events\?q=/);
  });

  test("filters narrow the list and the URL keeps them", async ({ page }) => {
    await page.goto("/events");
    await expect(page.locator(".row:not(.row-skel)").first()).toBeVisible();
    const all = await page.locator(".row:not(.row-skel)").count();
    await page.getByLabel("السعر").selectOption("free");
    await expect(page).toHaveURL(/price=free/);
    await expect.poll(async () => page.locator(".row .badge-price").count()).toBe(0);
    await expect(page.locator(".row-skel")).toHaveCount(0);
    const free = await page.locator(".row").count();
    expect(free).toBeGreaterThan(0);
    expect(free).toBeLessThanOrEqual(all);
  });

  test("map view renders pins", async ({ page }) => {
    await page.goto("/events?view=map");
    await expect(page.locator(".pin").first()).toBeVisible();
  });

  test("booking requires login and sends the visitor back after signing in", async ({ page }) => {
    await page.goto("/events/madinah-nights");
    await page.getByRole("button", { name: /سجّل دخولك واحجز/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole("button", { name: "جرّب كحاضر" }).click();
    await expect(page).toHaveURL(/\/events\/madinah-nights/);
  });

  test("unknown routes and events show friendly pages", async ({ page }) => {
    await page.goto("/events/does-not-exist");
    await expect(page.getByText("هذي الفعالية غير موجودة")).toBeVisible();
    await page.goto("/no-such-page");
    await expect(page.getByText("هذي الصفحة مو موجودة")).toBeVisible();
  });

  test("a failed login shows the server message without leaking which field was wrong", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("البريد الإلكتروني").fill("nobody@example.com");
    await page.getByLabel("كلمة المرور").fill("wrong-password");
    await page.getByRole("button", { name: "دخول", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("البريد أو كلمة المرور غير صحيحة");
  });
});

test.describe("attendee", () => {
  test("books seats, sees the ticket, then cancels", async ({ page }) => {
    await login(page, "demo");
    // Find a bookable upcoming event the demo user has not booked yet.
    const res = await page.request.get("/api/events?booking=true&limit=100");
    const events = (await res.json()).events as { slug: string; seatsLeft: number | null; myBooking?: unknown; status: string; title: string }[];
    let target: string | null = null;
    for (const e of events) {
      if (e.status !== "upcoming" || (e.seatsLeft ?? 0) < 2) continue;
      const detail = await (await page.request.get(`/api/events/${e.slug}`)).json();
      if (!detail.myBooking) { target = e.slug; break; }
    }
    expect(target, "seed must include an upcoming event with two available seats").toBeTruthy();
    await page.goto(`/events/${target}`);
    await page.getByRole("button", { name: "زد" }).click();
    await page.getByRole("button", { name: "احجز الآن" }).click();
    await expect(page.getByText("حجزك مؤكد")).toBeVisible();
    await expect(page.locator(".ticket-code")).toHaveText(/EB-[A-Z0-9]{4}-[A-Z0-9]{4}/);
    await expect(page.locator(".qr svg")).toBeVisible();

    await page.goto("/account");
    await expect(page.getByRole("link", { name: (await (await page.request.get(`/api/events/${target}`)).json()).event.title }).first()).toBeVisible();

    await page.goto(`/events/${target}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "إلغاء الحجز" }).click();
    await expect(page.getByRole("button", { name: "احجز الآن" })).toBeVisible();
  });

  test("favourite toggles and persists", async ({ page }) => {
    await login(page, "demo");
    await page.goto("/events/madinah-nights");
    const fav = page.locator(".detail-actions .fav-labeled").first();
    const before = await fav.getAttribute("aria-pressed");
    await fav.click();
    await expect(fav).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
    await page.reload();
    await expect(page.locator(".detail-actions .fav-labeled").first()).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
    await page.locator(".detail-actions .fav-labeled").first().click(); // restore
  });

  test("posts a review on an event that already started and sees it listed", async ({ page }) => {
    await login(page, "demo");
    await page.goto("/events/madinah-nights");
    const text = `تقييم آلي ${Date.now()}`;
    await page.getByRole("radio", { name: "4 من 5" }).click();
    await page.getByLabel("تعليقك").fill(text);
    await page.getByRole("button", { name: "إرسال التقييم" }).click();
    await expect(page.locator("p", { hasText: text })).toBeVisible();
  });

  test("recommendations on the home page carry a reason", async ({ page }) => {
    await login(page, "demo");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "مقترحة لك" })).toBeVisible();
    await expect(page.locator(".ecard .row-reason").first()).toBeVisible();
  });

  test("attendees cannot open the organizer area", async ({ page }) => {
    await login(page, "demo");
    await page.goto("/organizer");
    await expect(page.getByText("هذي المنطقة للمنظّمين فقط")).toBeVisible();
  });
});

test.describe("organizer", () => {
  test("dashboard lists events and surfaces demand gaps", async ({ page }) => {
    await login(page, "organizer");
    await page.goto("/organizer");
    await expect(page.getByRole("heading", { name: "فعالياتي" })).toBeVisible();
    await expect(page.locator(".data-table tbody tr").first()).toBeVisible();
    await page.getByRole("link", { name: "فجوات الطلب" }).click();
    await expect(page.locator(".gap-card").first()).toBeVisible();
    await expect(page.getByText("فرصة عالية").first()).toBeVisible();
  });

  test("the forecast updates live and a new event can be published, edited and removed", async ({ page }) => {
    await login(page, "organizer");
    await page.goto("/organizer/events/new");
    const hero = page.locator(".forecast-hero > b");
    await expect(hero).toBeVisible();
    const before = await hero.innerText();

    await page.getByLabel("السعر (ر.س)، صفر = مجاني").fill("90");
    await expect.poll(async () => hero.innerText(), { timeout: 8000 }).not.toBe(before);

    await page.getByLabel("اسم الفعالية").fill("أمسية اختبار e2e");
    await page.getByLabel("ملخص قصير").fill("ملخص تجريبي للاختبار الآلي");
    await page.getByLabel("الوصف").fill("وصف تجريبي أطول من عشرين حرفًا للاختبار.");
    await page.getByLabel("اسم المكان").fill("قاعة الاختبار");
    await page.getByRole("button", { name: "نشر الفعالية" }).click();
    await expect(page).toHaveURL(/\/organizer\/events\/\d+$/);
    const id = page.url().split("/").pop();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("أمسية اختبار e2e");

    await page.goto(`/organizer/events/${id}/edit`);
    await expect(page.getByLabel("اسم الفعالية")).toHaveValue("أمسية اختبار e2e");
    await page.getByLabel("اسم الفعالية").fill("أمسية اختبار e2e معدّلة");
    await page.getByRole("button", { name: "حفظ التعديلات" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("أمسية اختبار e2e معدّلة");

    await page.goto("/organizer");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /حذف أمسية اختبار e2e معدّلة/ }).click();
    await expect(page.getByText("أمسية اختبار e2e معدّلة")).toHaveCount(0);
  });

  test("validation errors come back in Arabic next to the field", async ({ page }) => {
    await login(page, "organizer");
    await page.goto("/organizer/events/new");
    await page.getByLabel("اسم الفعالية").fill("اختبار");
    await page.getByLabel("ملخص قصير").fill("قصير");
    await page.getByLabel("الوصف").fill("قصير");
    await page.getByLabel("اسم المكان").fill("مكان");
    await page.getByRole("button", { name: "نشر الفعالية" }).click();
    await expect(page.getByText("الملخص قصير")).toBeVisible();
  });
});

test.describe("mobile @mobile", () => {
  test("no horizontal scroll on key pages and the booking bar is reachable", async ({ page }) => {
    for (const path of ["/", "/events", "/events/madinah-nights", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
    await page.goto("/events/madinah-nights");
    await expect(page.locator(".mobile-cta")).toBeVisible();
  });
});

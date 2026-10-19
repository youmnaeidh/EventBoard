import { defineConfig } from "@playwright/test";

// Exercise the production Pages build against a separate API origin, with no proxy.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "pages.spec.ts",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_PAGES_URL ?? "http://127.0.0.1:4173/EventBoard/",
    locale: "ar-SA",
    timezoneId: "Asia/Riyadh",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "pages-desktop", use: { viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: "pages-mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true }, grep: /@mobile/ }
  ]
});

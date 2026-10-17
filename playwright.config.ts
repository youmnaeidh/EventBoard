import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against a full stack: Postgres + API (serving the built web app) + optionally the AI service.
 * `E2E_BASE_URL` points at it (default http://localhost:4000). `CHROMIUM_PATH` can point at a pre-installed browser.
 */
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "pages.spec.ts",
  timeout: 45_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4000",
    locale: "ar-SA",
    timezoneId: "Asia/Riyadh",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 860 } }, grepInvert: /@mobile/ },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } }, grep: /@mobile/ }
  ]
});

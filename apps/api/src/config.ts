import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  // Defaults to true in production. Set "false" only for plain-http local runs of a production build (e.g. docker compose).
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  // Empty string disables the AI service; the API then falls back to SQL-only behaviour.
  AI_SERVICE_URL: z.string().default(""),
  AI_SERVICE_TOKEN: z.string().default(""),
  AI_TIMEOUT_MS: z.coerce.number().int().default(8000),
  // Must be the exact browser origin; no path and no trailing slash.
  PUBLIC_WEB_ORIGIN: z.string().url().refine((s) => new URL(s).origin === s, "Expected a bare origin").optional(),
  // Directory with the built web app. When present the API serves it (single-origin deploy).
  WEB_DIST: z.string().default("")
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }
  return parsed.data;
}

export const config = loadConfig();

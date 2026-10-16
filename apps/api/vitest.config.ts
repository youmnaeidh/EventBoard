import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/eventboard_test",
      JWT_SECRET: "test-secret-test-secret-test-secret-123",
      AI_SERVICE_URL: ""
    }
  }
});

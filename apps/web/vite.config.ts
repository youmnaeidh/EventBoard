import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages is hosted at /EventBoard/, while local/Render builds are root-based.
export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? "/EventBoard/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:4000", changeOrigin: false } }
  },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 700 },
  test: { environment: "node", include: ["src/**/*.test.ts"] }
}));

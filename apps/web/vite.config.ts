/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev-Proxy: /api → laufendes Backend (services/app). Ziel via VITE_API_TARGET
// überschreibbar; Default lokaler Fastify-Server.
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": "/src" } },
  // Kein Inline-Modulepreload-Polyfill → strikte CSP (script-src 'self') ohne 'unsafe-inline'.
  build: { modulePreload: { polyfill: false } },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  // Frontend-Tests (Consultant-System u. a.): reine, DOM-freie Anzeige-Logik → node-Umgebung
  // (kein jsdom/RTL nötig). Läuft separat via `npm test` in apps/web, nicht im Root-Gate.
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

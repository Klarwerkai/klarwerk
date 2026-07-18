/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev-Proxy: /api → laufendes Backend (services/app). Ziel via VITE_API_TARGET überschreibbar.
// Default = der DEFAULT-Port des Fastify-Servers (services/app/src/server.ts: PORT ?? 3001). Vorher
// stand hier 3000 — das passte weder zum Server-Default (3001) noch zu Umgebungen, in denen 3000 schon
// belegt ist (z. B. gitea/kw-orch): dann liefen alle /api-Aufrufe ins Leere → „Etwas ist schiefgelaufen"
// auf datengetriebenen Seiten (Konflikte/Validierung/Admin). Jetzt zeigt der Default auf 3001.
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:3001";

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

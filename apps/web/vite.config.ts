/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { type Plugin, type ResolvedConfig, defineConfig } from "vite";

// AUFTRAG-mega69 Block E: der sichtbare Auslieferungsstand von Klara (public/word-addin/
// taskpane.html trägt den Platzhalter __KLARA_STAND__ und zeigt ihn unauffällig an). Der Wert
// entsteht HIER, beim Bauen — Datum/Uhrzeit (UTC) plus, wenn verfügbar, das kurze Git-Kürzel.
// Damit ändert er sich bei jeder Auslieferung von selbst; niemand pflegt eine Zahl von Hand, und
// es gibt keine zweite Wahrheit neben dem Build. Ohne .git (z. B. Docker-Kontext ohne Repo)
// bleibt ehrlich nur der Zeitstempel. public/ wird von Vite 1:1 kopiert (kein Transform-Hook für
// diese Dateien) — deshalb der Ersatz NACH dem Bündeln direkt in dist/.
function klaraStand(): Plugin {
  let cfg: ResolvedConfig | null = null;
  return {
    name: "klara-stand",
    apply: "build",
    configResolved(resolved) {
      cfg = resolved;
    },
    closeBundle() {
      if (!cfg) {
        return;
      }
      const file = resolve(cfg.root, cfg.build.outDir, "word-addin", "taskpane.html");
      let html: string;
      try {
        html = readFileSync(file, "utf8");
      } catch {
        return; // kein word-addin im Build (z. B. abgespeckter Test-Build) — nichts zu stempeln
      }
      let sha = "";
      try {
        sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
          .toString()
          .trim();
      } catch {
        // ohne Git-Kontext trägt der Stand nur den Zeitstempel — ehrlich statt erfunden
      }
      const stamp = `${new Date().toISOString().slice(0, 16).replace("T", " ")}Z${
        sha ? ` · ${sha}` : ""
      }`;
      // replaceAll: der Platzhalter steht auch in erklärenden Kommentaren der Datei — nach dem
      // Stempeln trägt die ausgelieferte Fassung überall denselben Stand (replace() erwischte nur
      // das erste Vorkommen, und das war ein Kommentar).
      writeFileSync(file, html.replaceAll("__KLARA_STAND__", stamp));
    },
  };
}

// Dev-Proxy: /api → laufendes Backend (services/app). Ziel via VITE_API_TARGET überschreibbar.
// Default = der DEFAULT-Port des Fastify-Servers (services/app/src/server.ts: PORT ?? 3001). Vorher
// stand hier 3000 — das passte weder zum Server-Default (3001) noch zu Umgebungen, in denen 3000 schon
// belegt ist (z. B. gitea/kw-orch): dann liefen alle /api-Aufrufe ins Leere → „Etwas ist schiefgelaufen"
// auf datengetriebenen Seiten (Konflikte/Validierung/Admin). Jetzt zeigt der Default auf 3001.
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), klaraStand()],
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

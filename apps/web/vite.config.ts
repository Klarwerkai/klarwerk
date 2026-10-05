/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { klaraStand } from "./src/lib/klaraStand";
import { textmodulVertrag } from "./src/texte/intern/sammeln";
import { sprachpaketeNachladen } from "./src/texte/intern/sprachpakete";

// ================================================================================================
// JOB 4367 · DER VERTRAG DER TEXTMODULE, GEPRÜFT IM PRODUKTBUILD.
// ================================================================================================
//
// WARUM DAS TOR NICHT REICHT. `apps/web/src/i18n.ts` sammelt die Textmodule aus `src/texte/` über
// `import.meta.glob` ein. Ein Sammler nimmt, was da liegt — und verschweigt jeden Fehler, den
// niemand sucht: zwei Module mit demselben Schlüssel überschreiben sich still (wer gewinnt,
// entscheidet die alphabetische Reihenfolge der Dateinamen), ein Modul ohne niederländischen Text
// fällt lautlos auf Deutsch zurück (`fallbackLng: "de"`), und ein Altname, den jemand aus `i18n.ts`
// zu entfernen vergisst, steht danach zweimal da. Vitest fängt das im Tor — aber der Docker-Build
// (`Dockerfile:15`) fährt `npx vite build` ohne jedes Tor. Genau diese Auslieferung soll ein
// verletzter Vertrag nicht überleben. `apply: "build"` ist Absicht: im Entwicklungsserver stört ein
// Abbruch beim Tippen mehr als er nützt — dort meldet die Prüfung in `i18n.ts` selbst.
//
// WARUM DIE FABRIK IN `src/texte/intern/sammeln.ts` STEHT UND NICHT HIER. Gemessen, nicht
// entschieden: `tests/i18n-textmodule/modulvertrag.test.ts` soll GENAU DIESES Plugin ausführen und
// keine nachgebaute Kopie (eine Kopie prüft sich selbst). Dafür muss eine Testdatei sie importieren
// — und damit zöge sie `apps/web/vite.config.ts` in den Root-Typcheck. Dort ist die Datei nicht
// typisierbar:
//
//     apps/web/vite.config.ts(124,3): error TS2769: No overload matches this call.
//       Object literal may only specify known properties, and 'test' does not exist in
//       type 'UserConfigExport'.
//
// Grund: `vitest/config` erweitert Vites `UserConfig` um `test`, löst sein `vite` aber aus der
// Wurzel auf, während diese Datei `vite` aus `apps/web/node_modules` nimmt. Zwei Modulidentitäten,
// also keine wirksame Erweiterung — unter `apps/web/tsconfig.json` (Zeile 1: die
// Dreifachschrägstrich-Referenz) trägt sie, im Root-Programm nicht. Die Plugin-Fabrik wohnt deshalb
// neben der Prüfung, die sie ruft; hier bleibt ihre Eintragung. Der Vite-Typ `Plugin` wird dabei
// NICHT verlangt — die Fabrik ist strukturell typisiert und hängt an keinem Vite-Import.

// AUFTRAG-mega69 Block E: das Plugin `klara-stand` stempelt beim Bauen den sichtbaren Stand ins
// Word-Panel (Programmversion `APP_VERSION`, Bauzeit, Git-Kürzel; R-1028). Die Fabrik wohnt in
// `src/lib/klaraStand.ts`, damit der Test sie statisch importieren kann (Begründung dort).

// R-0801: das Plugin `sprachpakete-nachladen` nimmt im Produktionsbau die Wörterbücher en und nl aus
// dem Eintritt und lädt sie erst, wenn die Sprache gebraucht wird (Begründung und Anker in
// `src/texte/intern/sprachpakete.ts`). Der Deckel dazu steht in `tests/erstladezeit/`.

// Dev-Proxy: /api → laufendes Backend (services/app). Ziel via VITE_API_TARGET überschreibbar.
// Default = der DEFAULT-Port des Fastify-Servers (services/app/src/server.ts: PORT ?? 3001). Vorher
// stand hier 3000 — das passte weder zum Server-Default (3001) noch zu Umgebungen, in denen 3000 schon
// belegt ist (z. B. gitea/kw-orch): dann liefen alle /api-Aufrufe ins Leere → „Etwas ist schiefgelaufen"
// auf datengetriebenen Seiten (Konflikte/Validierung/Admin). Jetzt zeigt der Default auf 3001.
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), klaraStand(), textmodulVertrag(), sprachpaketeNachladen()],
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

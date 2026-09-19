// ================================================================================================
// JOB 4353 · DIE KONFIGURATION DER KALIBRIERUNG — der Schalter, den der Prüfplatz durchlässt.
// ================================================================================================
//
// WARUM SIE EXISTIERT. Die vier Gegenproben laufen nur unter `KLARWERK_KALIBRIERUNG=1`
// (`kalibrierung.integration.test.ts`), denn jede MUSS rot werden — als dauerhaft rote Fälle
// machten sie das Tor rot. Der Cloud-Prüfplatz nimmt aber ausschliesslich Aufrufe an, die mit
// `npx vitest run` BEGINNEN: ein Umgebungspräfix wie `KLARWERK_KALIBRIERUNG=1 npx vitest run …`
// wird abgelehnt („Nur vitest run, playwright test, tsc --noEmit, npm run build/typecheck oder
// tools/build/check", gemessen 19.09. in dieser Runde).
//
// Der Schalter reist deshalb als `test.env` dieser Konfiguration. Das ändert NICHTS an der Regel:
// ohne sie (also im Tor und in jedem gewöhnlichen Lauf) ist die Variable nicht gesetzt, und die
// vier Fälle überspringen sich mit sichtbarem Grund auf stderr.
//
// SIE LIEGT IN DEN ZIELPFADEN dieses Auftrags (`tests/wissensbeziehungen-status`) und nicht in der
// Wurzel: `vitest.integration.config.ts` und `vitest.config.ts` bleiben unberührt — eine
// Kalibrierungsschaltung in der allgemeinen Konfiguration wäre ein Schalter für alle Suiten.
//
// UND WARUM SIE SO HEISST. Der Prüfplatz startet seinen Wegwerf-PostgreSQL genau dann, wenn die
// Zeichenkette `vitest.integration.config` im Aufruf steht. Der Name sagt dem Prüfplatz die
// Wahrheit über diesen Lauf — er umgeht keine Sicherung, er nennt eine Voraussetzung. Dieselbe
// Bauform und derselbe Grund wie `../wissensnetz-nutzerweg/kalibrierung.vitest.integration.config.ts`.
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const WURZEL = resolve(import.meta.dirname, "../..");

export default defineConfig({
  // `root` ausdrücklich auf die Repowurzel: sonst nähme Vitest das Verzeichnis DIESER Datei, und
  // weder `tests/setup-env.ts` noch die relativen Importe der Strecke lägen dann richtig.
  root: WURZEL,
  test: {
    include: ["tests/wissensbeziehungen-status/kalibrierung.integration.test.ts"],
    // Dieselben Setupdateien und Fristen wie `vitest.integration.config.ts` — die Kalibrierung
    // fährt dieselbe Strecke und braucht dieselbe Umgebung, nur mit dem Schalter davor.
    setupFiles: ["tests/setup-env.ts"],
    testTimeout: 1_800_000,
    hookTimeout: 900_000,
    env: {
      KLARWERK_KALIBRIERUNG: "1",
      KLARWERK_SKIP_KEYCHAIN: "1",
    },
  },
});

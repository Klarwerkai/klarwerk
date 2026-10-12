import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZIELBILD_GROESSEN_PX } from "../../apps/web/src/lib/schriftskala";
import { repoPfad } from "../support/repoPfad";

// ================================================================================================
// R-1033 · DIE NOCH FEHLENDEN VORLAGEN — je Fläche eine Datei, im Stil der freigegebenen Vorlagen.
// ================================================================================================
//
// Bibliothek, Konflikte und Duplikate liegen als freigegebene Vorlagen vor (Prüfmittel-Inventar)
// und sind gebaut (H2, H4). Für Lebenszyklus und die Mobilansicht des Panels gab es keine. Beide
// liegen jetzt als ENTWURF unter `docs/design/entwuerfe/` — Pedis Freigabe (Freigabe-Canvas) steht
// aus und wird hier NICHT behauptet. Geprüft wird nur, was ohne Freigabe prüfbar ist: die Dateien
// gibt es, sie sagen ehrlich, dass sie nicht freigegeben sind, und sie erfinden keine Schriftgröße
// neben der Skala der freigegebenen Vorlagen.

const ENTWUERFE = [
  "docs/design/entwuerfe/klarwerk/Lebenszyklus.dc.html",
  "docs/design/entwuerfe/klara/MobilPanel.dc.html",
];
// 10 px ist die Quellenmarke (Zielbild Fragen/Klara-Antwort, `text-fussnote`).
const SKALA = new Set([10, ...ZIELBILD_GROESSEN_PX]);

describe("R-1033 · Entwürfe Lebenszyklus und Mobilansicht des Panels", () => {
  for (const datei of ENTWUERFE) {
    it(`${datei} · vorhanden, als Entwurf gekennzeichnet, Schriftgrößen auf der Skala`, () => {
      expect(existsSync(repoPfad(datei)), datei).toBe(true);
      const html = readFileSync(repoPfad(datei), "utf8");
      expect(html).toContain("ENTWURF · NICHT FREIGEGEBEN");
      const treffer = [...html.matchAll(/font-size: ?(\d+(?:\.\d+)?)px/g)];
      const groessen = treffer.map((m) => Number(m[1]));
      // KALIBRIERUNG: der Entwurf trägt überhaupt Schriftgrößen.
      expect(groessen.length).toBeGreaterThan(5);
      expect(groessen.filter((px) => !SKALA.has(px))).toEqual([]);
    });
  }
});

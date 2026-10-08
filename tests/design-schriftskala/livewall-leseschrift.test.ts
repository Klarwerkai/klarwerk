import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MINDEST_LESEGROESSE_PX, ZIELBILD_GROESSEN_PX } from "../../apps/web/src/lib/schriftskala";
import { repoPfad } from "../support/repoPfad";

// ================================================================================================
// R-0918 · DIE NORMALE LIVEWALL-FLÄCHE LIEGT AUF DER SCHRIFTSKALA (Ben, Nacharbeit 12).
// ================================================================================================
//
// Befund am Kandidaten 519d1163 (`schriftskala.test.ts` S1): `LiveWallValidiert.tsx:42` setzte die
// Überschrift mit 10 px, `:111` die Zeitangabe mit 10,5 px — normale Lesetexte der Startseite
// unter der Untergrenze. Sie tragen jetzt `text-klein` (11 px).
//
// GETRENNT DAVON: der Zweig `gross` derselben Liste und `pages/LiveWallBeamer.tsx` sind die
// PROJEKTIONSANSICHT (18/22/44 px). Ob sie eine eigene, abgegrenzte Medienstufe bekommen oder auf
// die Skala gezogen werden, ist eine offene Entscheidung und wird hier NICHT getroffen. Diese Datei
// mischt die beiden Fälle deshalb nicht: L1 gilt für beide Dateien (nichts unter 11 px), L2 nur
// für den normalen Zweig.

const VALIDIERT = "apps/web/src/components/start/LiveWallValidiert.tsx";
const BEAMER = "apps/web/src/pages/LiveWallBeamer.tsx";

const lies = (rel: string): string => readFileSync(repoPfad(rel), "utf8");

function groessen(text: string): number[] {
  return [...text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => Number(m[1]));
}

describe("R-0918 · LiveWall: normale Lesetexte auf der Skala", () => {
  it("L1 · weder die Startseiten-Liste noch die Beamer-Ansicht setzt Schrift unter 11 px", () => {
    for (const datei of [VALIDIERT, BEAMER]) {
      const zuKlein = groessen(lies(datei)).filter((px) => px < MINDEST_LESEGROESSE_PX);
      expect(zuKlein, datei).toEqual([]);
    }
  });

  it("L2 · der normale Zweig (ohne `gross`) nutzt nur Größen der Skala", () => {
    const text = lies(VALIDIERT);
    // Die zwei Fundstellen des Befunds: Überschrift und Zeitangabe jetzt als `text-klein`.
    expect(text).toContain('"mb-1.5 font-mono text-klein uppercase tracking-wider text-muted-2"');
    expect(text).toContain('"shrink-0 font-mono text-klein text-muted-2"');
    // Jede Klassenkette OHNE die Projektionsgrößen gehört zum normalen Zweig.
    const normal = [...text.matchAll(/"([^"]*text-\[[^"]*)"/g)]
      .map((m) => m[1] ?? "")
      .filter((kette) => !/text-\[(18|22|28)px\]/.test(kette));
    // KALIBRIERUNG: der Leser findet die normalen Ketten (Leerzustand, Titel, Name, Zustimmung …).
    expect(normal.length).toBeGreaterThan(4);
    const skala = new Set<number>(ZIELBILD_GROESSEN_PX);
    const daneben = normal.flatMap(groessen).filter((px) => !skala.has(px));
    expect(daneben, "normaler LiveWall-Text neben der Skala").toEqual([]);
  });
});

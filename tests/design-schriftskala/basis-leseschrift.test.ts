import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { MINDEST_LESEGROESSE_PX } from "../../apps/web/src/lib/schriftskala";
import { repoPfad } from "../support/repoPfad";

// ================================================================================================
// R-0918 · DIE MIT DEM HAUPTSTAND GEKOMMENEN LESETEXTE UNTER 11 PX (Ben, Nacharbeit 15).
// ================================================================================================
//
// Ben nannte zehn Stellen aus dem integrierten Hauptstand: Duplicates.tsx:313 (9 px),
// DuplicateMerge.tsx:554/565 (10 px), pages/KlaraVorschau.tsx:33/120 (10/10,5 px) und
// components/klara-vorschau/KlaraVorschau.tsx:99/101/937/951/1232 (9–10,5 px). Dieselbe Suche fand
// zwei weitere gleicher Art: FotoInterviewStart.tsx:168 und Capture.tsx (Interview-Befund-Plakette),
// je 10 px. Alle sind normale Lesetexte (Beschriftungen, Plaketten, Zeitzeilen) und tragen jetzt
// `text-klein` (11 px, vorhandene Stufe).
//
// WARUM NEBEN `schriftskala.test.ts`: dort prüft S1 dasselbe für alle Dateien, S7 aber zusätzlich
// die Größen OBERHALB 11 px — und S7 ist bis zur offenen Entscheidung über die Projektionsgrößen
// der LiveWall-Beamer-Ansicht (18/22/44 px, Restvertrag R8) rot. G2 unten ist die Untergrenze für
// den ganzen Bestand, unabhängig von dieser Entscheidung; die Ausnahme ist dieselbe wie in S1.

const WEB_SRC = repoPfad("apps/web/src");

const STELLEN: readonly [string, number][] = [
  ["pages/Duplicates.tsx", 1],
  ["pages/DuplicateMerge.tsx", 2],
  ["pages/KlaraVorschau.tsx", 2],
  ["components/klara-vorschau/KlaraVorschau.tsx", 5],
  ["components/FotoInterviewStart.tsx", 1],
];

function quelldateien(dir: string): string[] {
  const raus: string[] = [];
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      raus.push(...quelldateien(pfad));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      raus.push(pfad);
    }
  }
  return raus;
}

function zuKlein(text: string): { zeile: number; px: number; quelle: string }[] {
  const funde: { zeile: number; px: number; quelle: string }[] = [];
  text.split("\n").forEach((quelle, i) => {
    for (const m of quelle.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      const px = Number(m[1]);
      if (px < MINDEST_LESEGROESSE_PX) {
        funde.push({ zeile: i + 1, px, quelle });
      }
    }
  });
  return funde;
}

describe("R-0918 · Lesetexte aus dem Hauptstand auf der Skala", () => {
  it("G1 · die benannten Flächen setzen nichts unter 11 px und tragen dort `text-klein`", () => {
    for (const [datei, mindestens] of STELLEN) {
      const text = readFileSync(join(WEB_SRC, datei), "utf8");
      expect(
        zuKlein(text).map((f) => `${f.zeile} ${f.px}px`),
        datei,
      ).toEqual([]);
      // KALIBRIERUNG gegen ein leeres Umstellen: die Stufe steht wirklich in der Datei.
      const klein = text.match(/\btext-klein\b/g) ?? [];
      expect(klein.length, datei).toBeGreaterThanOrEqual(mindestens);
    }
  });

  it("G2 · im ganzen Bestand steht keine frei gesetzte Größe unter 11 px (ausser SVG-Beschriftung)", () => {
    const funde = quelldateien(WEB_SRC).flatMap((pfad) =>
      zuKlein(readFileSync(pfad, "utf8")).map((f) => ({ ...f, datei: relative(WEB_SRC, pfad) })),
    );
    const ohneSvg = funde.filter((f) => !/\bfill-/.test(f.quelle));
    expect(ohneSvg.map((f) => `${f.datei}:${f.zeile} ${f.px}px`)).toEqual([]);
    // Die Ausnahme ist dieselbe, benannte wie in `schriftskala.test.ts` S1 — kein Schlupfloch.
    expect([...new Set(funde.map((f) => f.datei))]).toEqual([
      "components/KnowledgeNeighborhood.tsx",
    ]);
  });
});

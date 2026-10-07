import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BENANNTE_STUFEN,
  MINDEST_LESEGROESSE_PX,
  ZIELBILD_GROESSEN_PX,
} from "../../apps/web/src/lib/schriftskala";
import { repoPfad } from "../support/repoPfad";

// ================================================================================================
// R-0918 · DIE SCHRIFTSKALA HAT EINE UNTERGRENZE, UND KEINE FLÄCHE SETZT DARUNTER FREI.
// ================================================================================================
//
// Vorher: über 300 frei gesetzte Größen von 8,5 bis 10,5 px in 79 Dateien der Web-App (Capture,
// Ask, Stufe 2, Mobil, Bibliothek …). Nachher: Lesetext beginnt bei 11 px (`text-klein`, Brand Book
// „Label 11–13", Zielbilder ab 11 px). Unter 11 px bleiben genau die zwei Zielbildwerte, jeweils als
// benannte Stufe an ihrer einen Stelle: `text-zaehler` (Kopfband-Zahl, Main.dc.html 10,5 px) und
// `text-fussnote` (Quellenmarke, Fragen.dc.html 10 px).
//
// AUSGENOMMEN und als Ausnahme gezählt: Beschriftungen INNERHALB einer SVG-Grafik (`<text>` mit
// `fill-*`). Ihre Größe steht in viewBox-Einheiten und skaliert mit der Grafik — sie ist keine
// Bildschirmgröße, und `tests/wissensgraph-lesbarkeit/graph-treffer-chromium.test.tsx` misst die
// Lesbarkeit dort an der gerenderten Grafik.

const WEB_SRC = repoPfad("apps/web/src");
const TAILWIND = readFileSync(repoPfad("apps/web/tailwind.config.ts"), "utf8");

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

interface Fund {
  datei: string;
  zeile: number;
  px: number;
  text: string;
}

function freieGroessen(): Fund[] {
  const funde: Fund[] = [];
  for (const pfad of quelldateien(WEB_SRC)) {
    const zeilen = readFileSync(pfad, "utf8").split("\n");
    zeilen.forEach((text, i) => {
      for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        funde.push({
          datei: relative(WEB_SRC, pfad),
          zeile: i + 1,
          px: Number(m[1]),
          text: text.trim(),
        });
      }
    });
  }
  return funde;
}

function nutzer(klasse: string): string[] {
  const muster = new RegExp(`\\b${klasse}\\b`);
  return quelldateien(WEB_SRC)
    .filter((p) => muster.test(readFileSync(p, "utf8")))
    .map((p) => relative(WEB_SRC, p))
    .sort();
}

describe("R-0918 · Schriftskala der Web-App", () => {
  it("S1 · keine frei gesetzte Größe unter 11 px (ausser SVG-Beschriftung)", () => {
    const funde = freieGroessen();
    // KALIBRIERUNG: der Leser findet überhaupt frei gesetzte Größen (die ≥ 11 px bleiben erlaubt).
    expect(funde.length).toBeGreaterThan(500);
    const zuKlein = funde.filter((f) => f.px < MINDEST_LESEGROESSE_PX);
    const ohneSvg = zuKlein.filter((f) => !/\bfill-/.test(f.text));
    expect(
      ohneSvg.map((f) => `${f.datei}:${f.zeile} ${f.px}px`),
      "frei gesetzte Größe unter der Untergrenze",
    ).toEqual([]);
    // Die SVG-Ausnahme bleibt klein und benannt — sie darf kein Schlupfloch werden.
    expect(zuKlein.map((f) => f.datei).sort()).toEqual([
      "components/KnowledgeNeighborhood.tsx",
      "components/KnowledgeNeighborhood.tsx",
      "components/KnowledgeNeighborhood.tsx",
    ]);
  });

  it("S2 · die Stufen in tailwind.config.ts entsprechen lib/schriftskala.ts", () => {
    expect(TAILWIND).toContain('micro: ["11px", { lineHeight: "1.2", letterSpacing: "0.5px" }]');
    expect(TAILWIND).toContain('klein: "11px"');
    expect(TAILWIND).toContain('zaehler: "10.5px"');
    expect(TAILWIND).toContain('fussnote: "10px"');
    const px = Object.fromEntries(BENANNTE_STUFEN.map((s) => [s.klasse, s.px]));
    expect(px).toEqual({
      "text-fussnote": 10,
      "text-zaehler": 10.5,
      "text-klein": 11,
      "text-micro": 11,
    });
    expect(MINDEST_LESEGROESSE_PX).toBe(11);
    expect(Math.min(...ZIELBILD_GROESSEN_PX)).toBe(MINDEST_LESEGROESSE_PX);
  });

  it("S3 · die zwei Zielbild-Ausnahmen unter 11 px stehen nur an ihrer Stelle", () => {
    // Ausser der Fundstelle selbst nennen sie nur die Skala und der Katalog.
    const katalog = ["lib/schriftskala.ts", "pages/UiKit.tsx"];
    expect(nutzer("text-zaehler").filter((d) => !katalog.includes(d))).toEqual([
      "shell/KopfbandPunkte.tsx",
      "shell/MeldungenMenue.tsx",
    ]);
    expect(nutzer("text-fussnote").filter((d) => !katalog.includes(d))).toEqual([
      "components/start/AntwortText.tsx",
    ]);
  });

  it("S4 · Lesetext nutzt die Stufe: text-klein ist in der Fläche angekommen", () => {
    // KALIBRIERUNG gegen einen leeren Umbau: die ehemals kleinsten Flächen tragen jetzt die Stufe.
    const mitStufe = nutzer("text-klein");
    for (const datei of ["pages/Capture.tsx", "pages/Ask.tsx", "pages/Stufe2.tsx"]) {
      expect(mitStufe, datei).toContain(datei);
    }
  });
});

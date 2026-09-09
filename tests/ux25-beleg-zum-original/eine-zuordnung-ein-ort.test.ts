// ================================================================================================
// JOB 3272 · UX-25 · LIEFERUNG 7 — DER WÄCHTER GEGEN DIE ZWEITE WAHRHEIT.
// ================================================================================================
//
// Lehre JOB 3186: „Belege ‚genau eine Fundstelle' nicht per Hand, sondern als Testfall über den
// Quelltext — sonst hält die Ablösung nur bis zum nächsten Auftrag." Genau das steht hier.
//
// Zwei Ablösungen sind zu halten:
//   1. Die Zuordnung Beleg → Original wohnt an EINER Stelle (`koEvidence.ts`). Baute die Belegkarte
//      sie ein zweites Mal nach, drifteten die zwei Regeln auseinander — und der Nutzer sähe je
//      nach Fläche ein anderes Urteil über dasselbe Original.
//   2. Die rohe Kennung `object:<id>` ist als Anzeigetext ERSETZT, nicht danebengelegt. Stünde sie
//      weiter da, behaupteten Kennung und Weg dasselbe zweimal.
//
// Dazu die Ablösung im Sprungwerk: es gibt genau EIN `scrollIntoView` und genau EINEN Anker
// `data-bib-anhang` — kein zweiter Sprungweg neben dem des Kopfzugangs (UX-03/JOB 3108).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const WEB_SRC = join(WURZEL, "apps", "web", "src");

/** Alle Quelldateien der Weboberfläche — OHNE Tests: gemessen wird der Produktcode. */
function quellDateien(ordner: string): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(ordner)) {
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) {
      out.push(...quellDateien(pfad));
      continue;
    }
    if (/\.tsx?$/.test(eintrag) && !/\.test\.tsx?$/.test(eintrag)) {
      out.push(pfad);
    }
  }
  return out;
}

const DATEIEN = quellDateien(WEB_SRC);
const relativ = (p: string): string => p.slice(WURZEL.length + 1);

function trefferDateien(muster: RegExp): string[] {
  return DATEIEN.filter((p) => muster.test(readFileSync(p, "utf8"))).map(relativ);
}

function zaehle(inhalt: string, muster: RegExp): number {
  return (inhalt.match(muster) ?? []).length;
}

const MEHR = readFileSync(join(WEB_SRC, "components", "bibliothek", "MehrAbschnitte.tsx"), "utf8");

describe("JOB 3272 · UX-25 — eine Zuordnung, ein Ort", () => {
  it("KALIBRIERUNG: der Sammler sieht wirklich die Weboberfläche", () => {
    expect(DATEIEN.length).toBeGreaterThan(200);
    expect(DATEIEN.map(relativ)).toContain("apps/web/src/lib/koEvidence.ts");
    // Und keine Testdatei — sonst zählte der Wächter seine eigenen Fälle mit.
    expect(DATEIEN.filter((p) => /\.test\.tsx?$/.test(p))).toEqual([]);
  });

  it("die Zuordnungsregel ist GENAU EINMAL erklärt — und zwar in koEvidence.ts", () => {
    const orte = trefferDateien(/export function belegOriginal\b/);
    expect(orte).toEqual(["apps/web/src/lib/koEvidence.ts"]);
  });

  it("die Belegkarte fragt die Regel, statt sie nachzubauen", () => {
    // Genau ein Aufrufer im Produktcode — und er ist die Belegkarte. (Die Datei mit der Regel
    // selbst nennt den Namen naturgemäß auch; sie wird abgezogen, nicht mitgezählt.)
    const aufrufer = trefferDateien(/\bbelegOriginal\(/).filter(
      (p) => p !== "apps/web/src/lib/koEvidence.ts",
    );
    expect(aufrufer).toEqual(["apps/web/src/components/bibliothek/MehrAbschnitte.tsx"]);
    expect(zaehle(MEHR, /\bbelegOriginal\(/g)).toBe(1);
    // Und sie vergleicht die Kennungen einer Belegzeile nirgends selbst.
    expect(MEHR).not.toContain("ev.attachmentId");
    expect(MEHR).not.toContain("ev.objectId");
  });

  it("die rohe Kennung wird nirgends mehr als Anzeigetext gebaut", () => {
    expect(trefferDateien(/object:\$\{/)).toEqual([]);
    expect(trefferDateien(/["']object:/)).toEqual([]);
  });

  it("EIN Sprungwerk: ein `scrollIntoView`, ein Anker, eine Fokusregel", () => {
    // Der AUFRUF, nicht das Wort: die Existenzprüfung (`typeof … === "function"`) und die zwei
    // Kommentarstellen sind keine Sprungwege.
    expect(zaehle(MEHR, /\.scrollIntoView\(/g), "ein zweiter Sprungweg ist entstanden").toBe(1);
    expect(zaehle(MEHR, /data-bib-anhang=/g), "der Anker steht mehr als einmal").toBe(1);
    expect(zaehle(MEHR, /querySelector\("summary"\)/g), "zwei Fokusregeln").toBe(1);
  });
});

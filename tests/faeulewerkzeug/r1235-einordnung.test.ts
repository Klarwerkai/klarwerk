// ================================================================================================
// AUFNAHME 20260922 · GESAMT-FAEULEWERKZEUG (R-1235) — DIE KLÄRUNG ZEIGT AUF VORHANDENES.
// ================================================================================================
//
// `docs/entscheidungen/r1235-faeule-werkzeug.md` ordnet das Altwerkzeug `kw_faeule.py` ein und
// grenzt es gegen bestehende Produktwege ab. Diese Datei hält fest:
//   · Z   jede Datei und jedes Verzeichnis, das das Dokument nennt, liegt im Bestand;
//   · F   die tragenden Namen stehen in der genannten Datei;
//   · A   das Altwerkzeug liegt NICHT im Produkt — kein Quelltext, kein Verweis in den
//         Arbeitsregeln. Würde es (oder ein Nachbau der alten Steuerung) eingeführt, muss die
//         Einordnung neu entschieden werden, statt still zu veralten.
//
// WAS DIESE DATEI NICHT BELEGT: das Verhalten der verwandten Wege (Frische, Sicherung). Das messen
// die Tests ihrer eigenen Lieferungen.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOKUMENT = "docs/entscheidungen/r1235-faeule-werkzeug.md";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");

const PFADANGABE = /`((?:services|tests|apps|docs|scripts|tools)\/[^`\s]*)`/g;

function genanntePfade(): string[] {
  const pfade = new Set<string>();
  for (const treffer of lies(DOKUMENT).matchAll(PFADANGABE)) {
    pfade.add(treffer[1] ?? "");
  }
  return [...pfade].sort();
}

// Datei → was das Dokument dort verortet. Wörtliche Zeichenfolgen, keine Zeilennummern.
const FUNDSTELLEN: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "services/knowledge-object/src/frische.ts",
    [
      'export type FrischeStufe = "frisch" | "altert" | "faellig" | "veraltet";',
      "export function fristHinweiseFuer(",
      "export function aeltesteVorlageFuer(",
    ],
  ],
  ["services/app/src/frische-meldungen.ts", ["export function frischeMeldungen("]],
  ["apps/web/src/lib/frische.ts", ["export function aeltesteVorlage("]],
  ["scripts/backup/backup.sh", ["paar_ist_heil()", "still verfaulte"]],
  ["tools/urteilslage.ts", ["kw_pruefer.py"]],
];

// Das Altwerkzeug — zusammengesetzt, damit diese Datei selbst kein Treffer ist.
const ALTWERKZEUG = ["kw", "faeule"].join("_");
const PRODUKTBEREICHE = ["services", "apps/web/src", "tools", "scripts"];
const ARBEITSREGELN = ["CLAUDE.md", "AGENTS.md"];
const UEBERSPRUNGEN = new Set(["node_modules", "dist", ".git"]);

function dateienUnter(verzeichnis: string): string[] {
  const aus: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (UEBERSPRUNGEN.has(eintrag.name)) {
      continue;
    }
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      aus.push(...dateienUnter(pfad));
    } else if (eintrag.isFile()) {
      aus.push(pfad);
    }
  }
  return aus;
}

describe("R-1235 · Einordnung des Fäule-Werkzeugs", () => {
  it("Z: jede genannte Datei und jedes genannte Verzeichnis liegt im Bestand", () => {
    const pfade = genanntePfade();
    expect(pfade.length).toBeGreaterThan(5);
    const fehlend = pfade.filter((p) => !existsSync(p));
    expect(fehlend).toEqual([]);
  });

  it("F: die tragenden Namen stehen in der genannten Datei", () => {
    for (const [datei, namen] of FUNDSTELLEN) {
      const inhalt = lies(datei);
      for (const name of namen) {
        expect(inhalt.includes(name), `${datei}: ${name}`).toBe(true);
      }
    }
  });

  it("A: das Altwerkzeug liegt weder als Datei noch als Verweis im Produkt", () => {
    const treffer: string[] = [];
    for (const bereich of PRODUKTBEREICHE) {
      for (const datei of dateienUnter(bereich)) {
        if (datei.includes(ALTWERKZEUG) || lies(datei).includes(ALTWERKZEUG)) {
          treffer.push(datei);
        }
      }
    }
    for (const regel of ARBEITSREGELN) {
      if (existsSync(regel) && lies(regel).includes(ALTWERKZEUG)) {
        treffer.push(regel);
      }
    }
    expect(treffer).toEqual([]);
  });

  it("das Dokument behauptet keine Erfüllung und keine Pedi-Entscheidung zu R-1235", () => {
    const text = lies(DOKUMENT).replace(/\s+/g, " ");
    expect(text).toContain("eine Erfüllung von R-1235 wird hier nicht behauptet");
    expect(text).toContain("Eine Pedi-Auswahl zu R-1235 ist **nicht vorhanden**");
  });

  // Bens Befund (Nacharbeit 1): die Herkunft lässt den Gegenstand offen. Der Originalsatz bleibt
  // Anforderung; Dateinamenherleitung und Zuordnung zur alten Steuerung sind nur Lesarten.
  it("Originalsatz bleibt Anforderung; Herleitung und Steuerung bleiben Lesarten", () => {
    const text = lies(DOKUMENT).replace(/\s+/g, " ");
    expect(text).toContain("Ein Werkzeug spuert verfaulende Bestaende im Betrieb auf.");
    expect(text).toContain("**Aufgenommene Anforderung**, unverändert erhalten");
    expect(text).toContain(
      "Dass der Satz nur aus dem Dateinamen hergeleitet sei, ist eine **unbestätigte Lesart**",
    );
    expect(text).toContain(
      "Ob das Werkzeug zur damaligen Arbeitssteuerung gehörte, ist eine **unbestätigte Lesart**",
    );
    expect(text).toContain("Eine Zuordnung von `kw_faeule.py` folgt daraus nicht");
    expect(text).toContain("Angenommen, `kw_faeule.py` war ein internes Werkzeug");
    expect(text).not.toContain("Deutung des Dateinamens");
    expect(text).not.toContain("ein internes Werkzeug der damaligen Arbeitssteuerung, kein");
    for (const alternative of ["**A ·", "**B ·", "**C ·", "**D ·"]) {
      expect(text).toContain(alternative);
    }
  });
});

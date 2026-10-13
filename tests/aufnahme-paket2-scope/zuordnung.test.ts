// Auftrag aufnahme:20260922:gesamt-paket2-scope (R-1395 „Scopeanalyse Paket 2“). Er liefert eine
// Klärungsakte, keine Produktfunktion. Dieser Test hält die Akte am Bestand fest:
//   Z1 — jede Fundstelle und jeder Belegtest der Kandidatentabelle existiert und trägt
//        Programmkennung UND „Paket 2“ (sonst wäre die Zuordnung erfunden oder veraltet);
//   Z2 — „JOB 534“, „Scopeanalyse“, „F-1395“, „R-1395“ stehen in apps/, services/, docs/ nur in
//        der Akte (Grundlage der Aussage „kein Programm-Paket 2 ist R-1395“);
//   Z3 — die Akte nennt die Entscheidung als offen und ersetzt sie nicht.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "../..");
const AKTE = "docs/aufnahme/20260922-gesamt-paket2-scope.md";
const akte = readFileSync(join(WURZEL, AKTE), "utf8");

interface Kandidat {
  alternative: string;
  programm: string;
  dateien: string[];
}

function backticks(zelle: string | undefined): string[] {
  return [...(zelle ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "");
}

function kandidaten(): Kandidat[] {
  const abschnitt = akte.split("## Kandidaten im heutigen Bestand")[1]?.split("\n## ")[0] ?? "";
  return abschnitt
    .split("\n")
    .filter((zeile) => /^\| [A-E] \|/.test(zeile))
    .map((zeile) => {
      const zellen = zeile.split("|").map((z) => z.trim());
      // zellen[0] ist leer (führendes „|“): 1 Alt., 2 Programm, 5 Fundstellen, 6 Belegtests.
      return {
        alternative: zellen[1] ?? "",
        programm: backticks(zellen[2])[0] ?? "",
        dateien: [...backticks(zellen[5]), ...backticks(zellen[6])],
      };
    });
}

const AUSGELASSEN = new Set(["node_modules", "dist", "generated", ".local"]);
const TEXTDATEI = /\.(ts|tsx|js|mjs|md|json)$/;

function textdateien(verzeichnis: string): string[] {
  const funde: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (AUSGELASSEN.has(eintrag.name)) continue;
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) funde.push(...textdateien(pfad));
    else if (eintrag.isFile() && TEXTDATEI.test(eintrag.name)) funde.push(pfad);
  }
  return funde;
}

describe("Z1: Kandidatentabelle stimmt mit dem Bestand überein", () => {
  const liste = kandidaten();

  it("führt die fünf Programm-Alternativen A–E, jede mit Programm und Belegdatei", () => {
    expect(liste.map((k) => k.alternative)).toEqual(["A", "B", "C", "D", "E"]);
    for (const k of liste) {
      expect(k.programm, k.alternative).toBeTruthy();
      expect(k.dateien.length, k.alternative).toBeGreaterThan(0);
    }
  });

  it("jede genannte Datei existiert und trägt Programmkennung und „Paket 2“", () => {
    for (const k of liste) {
      for (const datei of k.dateien) {
        const pfad = join(WURZEL, datei);
        expect(existsSync(pfad), `${k.alternative}: ${datei}`).toBe(true);
        const text = readFileSync(pfad, "utf8");
        const ort = `${k.alternative}: ${datei}`;
        expect(text.includes(k.programm), `${ort} ohne ${k.programm}`).toBe(true);
        expect(/paket 2/i.test(text), `${ort} ohne „Paket 2“`).toBe(true);
      }
    }
  });
});

describe("Z2: R-1395 hat keine Fundstelle im Produktbestand", () => {
  it("JOB 534, Scopeanalyse, F-1395 und R-1395 stehen nur in der Akte", () => {
    const muster = /Scopeanalyse|\bJOB[ -]534\b|\bF-1395\b|\bR-1395\b/i;
    const treffer = ["apps", "services", "docs"]
      .flatMap((teil) => textdateien(join(WURZEL, teil)))
      .map((pfad) => relative(WURZEL, pfad))
      .filter((pfad) => pfad !== AKTE)
      .filter((pfad) => muster.test(readFileSync(join(WURZEL, pfad), "utf8")));
    expect(treffer).toEqual([]);
  });
});

describe("Z3: die Akte ersetzt keine Entscheidung", () => {
  it("nennt die offene Entscheidung, alle Wahlmöglichkeiten und den Klärungsstand", () => {
    expect(akte).toContain("## Erforderliche Entscheidung (Pedi)");
    expect(akte).toContain("Dieser Lauf trifft die Entscheidung nicht.");
    expect(akte).toContain("Bis dahin bleibt R-1395 in Klärung.");
    expect(akte).toContain("- **F — internes Arbeitspaket der damaligen Steuerung.**");
    expect(akte).toContain("- **G — nicht mehr zuordenbar.**");
  });

  it("hält den Originalwortlaut von R-1395 und den fehlenden Pedi-Entscheid fest", () => {
    expect(akte).toContain("„Abgrenzung, was zu Paket 2 gehoert und was nicht.“");
    expect(akte).toContain("`pedi_override: null`");
  });
});

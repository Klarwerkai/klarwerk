import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ==================================================================================================
// R-1137 · ERFÜLLUNGSSTAND GEGEN DAS PFLICHTENHEFT — EINE NACHWEISQUOTE, KEINE FORTSCHRITTSANZEIGE.
// ==================================================================================================
//
// `specs/ERFUELLUNGSSTAND.md` sagt je Anforderung, ob es Code UND einen Testfall gibt, der das
// Abnahmekriterium prüft. Die Tabelle ist von Hand abgeglichen — dieser Wächter rechnet nichts davon
// aus, er hält sie nur ehrlich:
//
//   · jede Anforderung des Pflichtenhefts steht genau einmal da, mit ihrer Priorität;
//   · jeder genannte Code- und Testpfad existiert, und jeder zitierte Testtitel steht in seiner Datei
//     (ein umbenannter oder gelöschter Test macht die Zeile rot, statt still weiter zu zählen);
//   · „nachgewiesen“ hat mindestens einen Code- und einen Testbeleg;
//   · die Quote und die Verteilung im Kopf sind aus den Zeilen gezählt.
//
// Ob die zitierten Tests GRÜN sind, prüft ihr eigener Lauf, nicht dieser.

const WURZEL = process.cwd();
const lies = (pfad: string): string => readFileSync(resolve(WURZEL, pfad), "utf8").normalize("NFC");

const PFLICHTENHEFT = lies("specs/reference/Pflichtenheft.md");
const STAND = lies("specs/ERFUELLUNGSSTAND.md");

const STATUS = [
  "nachgewiesen",
  "teilweise",
  "ohne Testnachweis",
  "Code fehlt",
  "Abnahme außerhalb Tests",
  "nicht zugeordnet",
] as const;
type Status = (typeof STATUS)[number];

type Zeile = {
  spalten: number;
  id: string;
  prio: string;
  status: string;
  code: string[];
  tests: { datei: string; titel: string }[];
  testZelle: string;
  anmerkung: string;
};

function anforderungenDesPflichtenhefts(): Map<string, string> {
  const ergebnis = new Map<string, string>();
  for (const z of PFLICHTENHEFT.split("\n")) {
    const fr = /^\| (FR-[A-Z0-9]+-\d{2}) \|.*?\| (MUSS|SOLL|KANN) \|/.exec(z);
    if (fr) ergebnis.set(fr[1] as string, fr[2] as string);
    const nfr = /\*\*(NFR-[A-Z]+-\d{2}) \((MUSS|SOLL|KANN)\):\*\*/.exec(z);
    if (nfr) ergebnis.set(nfr[1] as string, nfr[2] as string);
  }
  return ergebnis;
}

function zeilenDerTabelle(): Zeile[] {
  return STAND.split("\n")
    .filter((z) => /^\| N?FR-/.test(z))
    .map((z) => {
      const zellen = z.slice(2, -2).split(" | ");
      const zelle = (i: number): string => zellen[i] ?? "";
      const testZelle = zelle(4);
      return {
        spalten: zellen.length,
        id: zelle(0),
        prio: zelle(1),
        status: zelle(2),
        code: [...zelle(3).matchAll(/`([^`]+)`/g)].map((m) => m[1] as string),
        tests: [...testZelle.matchAll(/`([^`]+)` › „([^“]+)“/g)].map((m) => ({
          datei: m[1] as string,
          titel: m[2] as string,
        })),
        testZelle,
        anmerkung: zelle(5),
      };
    });
}

const SOLL = anforderungenDesPflichtenhefts();
const ZEILEN = zeilenDerTabelle();

describe("R-1137 · die Tabelle deckt das Pflichtenheft genau ab", () => {
  it("das Pflichtenheft hat 105 Anforderungen (78 FR, 27 NFR)", () => {
    expect(SOLL.size).toBe(105);
    expect([...SOLL.keys()].filter((id) => id.startsWith("FR-"))).toHaveLength(78);
    expect([...SOLL.keys()].filter((id) => id.startsWith("NFR-"))).toHaveLength(27);
  });

  it("jede Zeile hat genau sechs Spalten", () => {
    for (const z of ZEILEN) expect(z.spalten, z.id).toBe(6);
  });

  it("jede Anforderung steht genau einmal da — keine fehlt, keine ist erfunden", () => {
    const ids = ZEILEN.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...SOLL.keys()].sort());
  });

  it("die Priorität jeder Zeile ist die des Pflichtenhefts", () => {
    for (const z of ZEILEN) expect(z.prio, z.id).toBe(SOLL.get(z.id));
  });

  it("jeder Status kommt aus dem geschlossenen Vokabular", () => {
    for (const z of ZEILEN) expect(STATUS, z.id).toContain(z.status);
  });
});

describe("R-1137 · jeder Beleg steht wirklich im Bestand", () => {
  it("jeder genannte Codepfad existiert", () => {
    for (const z of ZEILEN) {
      for (const pfad of z.code) {
        expect(existsSync(resolve(WURZEL, pfad)), `${z.id}: ${pfad}`).toBe(true);
      }
    }
  });

  it("jeder Testverweis nennt einen Titel, und der Titel steht in seiner Datei", () => {
    for (const z of ZEILEN) {
      const pfade = [...z.testZelle.matchAll(/`([^`]+)`/g)].length;
      expect(z.tests, `${z.id}: Testverweis ohne Titel`).toHaveLength(pfade);
      for (const t of z.tests) {
        expect(existsSync(resolve(WURZEL, t.datei)), `${z.id}: ${t.datei}`).toBe(true);
        const gefunden = lies(t.datei).includes(t.titel.normalize("NFC"));
        expect(gefunden, `${z.id}: „${t.titel}“ in ${t.datei}`).toBe(true);
      }
    }
  });

  it("„nachgewiesen“ hat Code UND einen Testfall", () => {
    for (const z of ZEILEN.filter((z) => z.status === "nachgewiesen")) {
      expect(z.code.length, `${z.id}: Code`).toBeGreaterThan(0);
      expect(z.tests.length, `${z.id}: Testfall`).toBeGreaterThan(0);
    }
  });

  it("jede nicht nachgewiesene Zeile sagt, was fehlt", () => {
    for (const z of ZEILEN.filter((z) => z.status !== "nachgewiesen")) {
      expect(z.anmerkung.trim(), z.id).not.toBe("—");
      expect(z.anmerkung.trim().length, z.id).toBeGreaterThan(0);
    }
  });
});

describe("R-1137 · die Quote ist gezählt, nicht behauptet", () => {
  const anzahl = (s: Status): number => ZEILEN.filter((z) => z.status === s).length;

  it("die Nachweisquote im Kopf zählt nur „nachgewiesen“", () => {
    const quote = /Nachweisquote: \*\*(\d+) von (\d+)\*\*/.exec(STAND);
    expect(quote).not.toBeNull();
    expect(Number(quote?.[1])).toBe(anzahl("nachgewiesen"));
    expect(Number(quote?.[2])).toBe(SOLL.size);
  });

  it("die Verteilung im Kopf stimmt je Status mit den Zeilen überein", () => {
    for (const s of STATUS) {
      const kopf = new RegExp(`^\\| ${s} \\| (\\d+) \\|`, "m").exec(STAND);
      expect(kopf, s).not.toBeNull();
      expect(Number(kopf?.[1]), s).toBe(anzahl(s));
    }
  });
});

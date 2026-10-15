// ================================================================================================
// R-1384 · QUELLENMATRIX ZU DEN FÜNF KERNFRAGEN — MATRIX, QUELLEN UND LÜCKENVERZEICHNIS PASSEN.
// ================================================================================================
//
// Gemessen wird die Erhebung unter `docs/aufnahme/quellen-kernfragen/`. Diese Datei beantwortet keine
// Kernfrage und misst nicht den heutigen Produktzustand. Sie hält fest, dass die Erhebung nichts
// behauptet, was sie nicht belegt — und nichts auslässt, was sie belegen kann:
//   M1  genau fünf Zeilen Q1–Q5, keine doppelt
//   M2  jede Zeile trägt ihren Gegenstand und mindestens eine Fundstelle in einer verzeichneten
//       Quelle; jede Fundstelle liegt innerhalb der Zeilenzahl ihrer Quelle. Fünf Nullzeilen
//       bestehen hier NICHT mehr (Nacharbeit 1, BEN-Befund zu `quellenmatrix.json:11`).
//   M3  jede Quelle ist mit SHA-256 verzeichnet — auch wenn sie außerhalb des Produktbaums liegt
//   M4  der Stand unterscheidet historisch Belegtes vom heutigen Stand: eine historisch belegte
//       oder beantwortete Zeile nennt Produktstellen, die es im Baum gibt; was nur inspiziert ist,
//       trägt eine Lücke
//   M5  die historische Lieferung JOB 813 D2 ist an die Prüfsumme ihrer Rückgabe gebunden und hält
//       FORM ROT und CODE ROT getrennt vom GRÜN fest
//   L1  jede genannte Lücke hat genau eine Datei in `luecken/`, deren Überschrift ihre Kennung trägt
//   L2  keine Datei in `luecken/` ist verwaist; jede wird von der Matrix genannt
//   L3  die Übersicht `README.md` nennt jede Lücke
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const ORT = "docs/aufnahme/quellen-kernfragen";
const SHA256 = /^[0-9a-f]{64}$/;

interface Fundstelle {
  quelle: string;
  zeilen: string;
}

interface Zeile {
  id: string;
  gegenstand: string | null;
  fundstellen: Fundstelle[];
  historische_aussage: string | null;
  historisch_offen: string | null;
  heutiger_stand: { art: string; aussage: string; fundstellen: string[] } | null;
  stand: "beantwortet" | "historisch_belegt" | "luecke";
  luecken: string[];
}

interface Matrix {
  punkt: string;
  quellen: Record<string, { pfad: string; sha256: string; zeilen: number }>;
  kernfragen: Zeile[];
  historische_lieferung: {
    rueckgabe_sha256: string;
    fundstellen: Fundstelle[];
    urteile: { gesamt: string; produkt: string; form: string; code: string };
    offen: string;
  };
  uebergreifende_luecken: string[];
}

const matrix = JSON.parse(readFileSync(repoPfad(`${ORT}/quellenmatrix.json`), "utf8")) as Matrix;
const lueckenDateien = readdirSync(repoPfad(`${ORT}/luecken`)).filter((n) => n.endsWith(".md"));
const genannt = new Set([
  ...matrix.kernfragen.flatMap((z) => z.luecken),
  ...matrix.uebergreifende_luecken,
]);

/** `"74-85"` → `[74, 85]`; eine einzelne Zahl ist ein Bereich der Länge eins. */
function bereich(zeilen: string): [number, number] {
  const [von, bis = von] = zeilen.split("-").map(Number) as [number, number?];
  return [von, bis];
}

function pruefeFundstelle(f: Fundstelle): void {
  const quelle = matrix.quellen[f.quelle];
  expect(quelle, `Quelle ${f.quelle} ist nicht verzeichnet`).toBeDefined();
  const [von, bis] = bereich(f.zeilen);
  expect(Number.isInteger(von) && Number.isInteger(bis), `Bereich ${f.zeilen}`).toBe(true);
  expect(von).toBeGreaterThanOrEqual(1);
  expect(bis).toBeGreaterThanOrEqual(von);
  expect(bis, `${f.quelle}:${f.zeilen} hinter Dateiende`).toBeLessThanOrEqual(quelle!.zeilen);
}

/** `"services/x.ts:10-20"` → die Datei gibt es, und der Bereich liegt in ihr. */
function pruefeProduktstelle(stelle: string): void {
  const [pfad, zeilen] = stelle.split(":") as [string, string];
  expect(existsSync(repoPfad(pfad)), `${pfad} fehlt im Baum`).toBe(true);
  const laenge = readFileSync(repoPfad(pfad), "utf8").split("\n").length;
  const [von, bis] = bereich(zeilen);
  expect(von).toBeGreaterThanOrEqual(1);
  expect(bis, `${stelle} liegt hinter dem Dateiende (${laenge})`).toBeLessThanOrEqual(laenge);
}

describe("R-1384 · die Matrix", () => {
  it("M1 · genau fünf Kernfragen Q1–Q5, keine doppelt", () => {
    expect(matrix.punkt).toBe("R-1384");
    expect(matrix.kernfragen.map((z) => z.id)).toEqual(["Q1", "Q2", "Q3", "Q4", "Q5"]);
  });

  it.each(matrix.kernfragen.map((z) => [z.id, z] as const))(
    "M2 · %s trägt Gegenstand und Fundstellen in verzeichneten Quellen",
    (_id, zeile) => {
      expect(zeile.gegenstand?.trim(), "Kernfrage ohne Gegenstand").toBeTruthy();
      expect(zeile.fundstellen.length, "Kernfrage ohne Fundstelle").toBeGreaterThan(0);
      for (const f of zeile.fundstellen) {
        pruefeFundstelle(f);
      }
    },
  );

  it("M3 · jede Quelle ist mit Pfad, SHA-256 und Zeilenzahl verzeichnet", () => {
    expect(Object.keys(matrix.quellen).length).toBeGreaterThan(0);
    for (const [kuerzel, q] of Object.entries(matrix.quellen)) {
      expect(q.pfad.trim(), `${kuerzel} ohne Pfad`).toBeTruthy();
      expect(q.sha256, `${kuerzel} ohne gültige Prüfsumme`).toMatch(SHA256);
      expect(Number.isInteger(q.zeilen) && q.zeilen > 0, `${kuerzel} ohne Zeilenzahl`).toBe(true);
    }
  });

  it.each(matrix.kernfragen.map((z) => [z.id, z] as const))(
    "M4 · %s trennt historisch Belegtes vom heutigen Stand",
    (_id, zeile) => {
      expect(["beantwortet", "historisch_belegt", "luecke"]).toContain(zeile.stand);
      if (zeile.stand === "luecke") {
        expect(zeile.luecken.length).toBeGreaterThan(0);
        return;
      }
      expect(zeile.historische_aussage?.trim(), "ohne historische Aussage").toBeTruthy();
      const heute = zeile.heutiger_stand;
      expect(heute, "ohne heutigen Stand").not.toBeNull();
      expect(heute!.aussage.trim()).toBeTruthy();
      expect(heute!.fundstellen.length, "heutiger Stand ohne Produktstelle").toBeGreaterThan(0);
      for (const stelle of heute!.fundstellen) {
        pruefeProduktstelle(stelle);
      }
      if (zeile.stand === "historisch_belegt" || heute!.art === "quelleninspektion") {
        expect(zeile.luecken.length, "nur inspiziert, aber ohne Lücke").toBeGreaterThan(0);
      }
    },
  );

  it("M5 · JOB 813 D2: an die Rückgabe gebunden, Urteilsreichweiten getrennt", () => {
    const lieferung = matrix.historische_lieferung;
    expect(lieferung.rueckgabe_sha256).toMatch(SHA256);
    expect(lieferung.rueckgabe_sha256).toBe(matrix.quellen.d2?.sha256);
    for (const f of lieferung.fundstellen) {
      pruefeFundstelle(f);
    }
    expect(lieferung.urteile.gesamt).toBe("GRÜN");
    expect(lieferung.urteile.produkt).toMatch(/^GRÜN/);
    expect(lieferung.urteile.form).toMatch(/^ROT: \S/);
    expect(lieferung.urteile.code).toMatch(/^ROT: \S/);
    expect(lieferung.urteile.form).not.toBe(lieferung.urteile.code);
    expect(lieferung.offen.trim()).toBeTruthy();
  });
});

describe("R-1384 · das Lückenverzeichnis", () => {
  it.each([...genannt].map((k) => [k]))("L1 · %s hat genau eine Datei mit Kennung", (k) => {
    const treffer = lueckenDateien.filter((n) => n.startsWith(`${k}-`));
    expect(treffer).toHaveLength(1);
    const text = readFileSync(repoPfad(`${ORT}/luecken/${treffer[0]}`), "utf8");
    expect(text.split("\n")[0]).toMatch(new RegExp(`^# ${k} · `));
  });

  it("L2 · keine Lückendatei ist verwaist", () => {
    const kennungen = lueckenDateien.map((n) => n.split("-")[0]);
    expect(kennungen.filter((k) => !genannt.has(k as string))).toEqual([]);
  });

  it("L3 · die Übersicht nennt jede Lücke mit ihrer Datei", () => {
    const uebersicht = readFileSync(repoPfad(`${ORT}/README.md`), "utf8");
    for (const datei of lueckenDateien) {
      expect(uebersicht, `README.md verweist nicht auf ${datei}`).toContain(`luecken/${datei}`);
    }
  });
});

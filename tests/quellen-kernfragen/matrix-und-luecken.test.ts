// ================================================================================================
// R-1384 · QUELLENMATRIX ZU DEN FÜNF KERNFRAGEN — MATRIX UND LÜCKENVERZEICHNIS PASSEN ZUSAMMEN.
// ================================================================================================
//
// Gemessen wird die Erhebung unter `docs/aufnahme/quellen-kernfragen/`. Diese Datei beantwortet keine
// Kernfrage. Sie hält fest, dass die Erhebung nichts behauptet, was sie nicht belegt:
//   M1  genau fünf Zeilen Q1–Q5, keine doppelt
//   M2  eine Zeile mit beantwortender Quelle nennt eine Datei, die es im Baum gibt, und trägt den
//       Wortlaut ihrer Frage; jede andere Zeile steht als Lücke mit mindestens einer Lückenkennung
//   L1  jede genannte Lücke hat genau eine Datei in `luecken/`, deren Überschrift ihre Kennung trägt
//   L2  keine Datei in `luecken/` ist verwaist; jede wird von der Matrix genannt
//   L3  die Übersicht `README.md` nennt jede Lücke
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const ORT = "docs/aufnahme/quellen-kernfragen";

interface Zeile {
  id: string;
  frage: string | null;
  antwort_quelle: string | null;
  stand: "beantwortet" | "luecke";
  luecken: string[];
}

interface Matrix {
  punkt: string;
  kernfragen: Zeile[];
  uebergreifende_luecken: string[];
}

const matrix = JSON.parse(readFileSync(repoPfad(`${ORT}/quellenmatrix.json`), "utf8")) as Matrix;
const lueckenDateien = readdirSync(repoPfad(`${ORT}/luecken`)).filter((n) => n.endsWith(".md"));
const genannt = new Set([
  ...matrix.kernfragen.flatMap((z) => z.luecken),
  ...matrix.uebergreifende_luecken,
]);

describe("R-1384 · die Matrix", () => {
  it("M1 · genau fünf Kernfragen Q1–Q5, keine doppelt", () => {
    expect(matrix.punkt).toBe("R-1384");
    expect(matrix.kernfragen.map((z) => z.id)).toEqual(["Q1", "Q2", "Q3", "Q4", "Q5"]);
  });

  it.each(matrix.kernfragen.map((z) => [z.id, z] as const))(
    "M2 · %s behauptet eine Quelle nur mit Frage und vorhandener Datei, sonst steht sie als Lücke",
    (_id, zeile) => {
      if (zeile.stand === "beantwortet") {
        expect(zeile.frage, "beantwortet ohne Wortlaut der Frage").toBeTruthy();
        expect(zeile.antwort_quelle, "beantwortet ohne Quelle").toBeTruthy();
        const pfad = (zeile.antwort_quelle as string).split(":")[0] as string;
        expect(existsSync(repoPfad(pfad)), `Quelle ${pfad} fehlt im Baum`).toBe(true);
      } else {
        expect(zeile.stand).toBe("luecke");
        expect(zeile.antwort_quelle).toBeNull();
        expect(zeile.luecken.length).toBeGreaterThan(0);
      }
    },
  );
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

  it("L3 · die Übersicht nennt jede Lücke", () => {
    const uebersicht = readFileSync(repoPfad(`${ORT}/README.md`), "utf8");
    for (const k of genannt) {
      expect(uebersicht, `README.md nennt ${k} nicht`).toContain(k);
    }
  });
});

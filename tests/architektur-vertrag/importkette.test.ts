// ================================================================================================
// R-0130 / R-0686 (Aufnahme 20260922 · import-gesamtvertrag) — DER IMPORTVERTRAG STIMMT MIT DEM
// CODE ÜBEREIN.
// ================================================================================================
//
// `docs/architektur/importkette.md` beschreibt den Durchfluss vom Rohdokument zum kontrollierten
// Wissen und die eine Naht zwischen Quelladaptern und Anwendung. Eine Beschreibung neben dem Code
// veraltet still; dieser Prüfstand liest deshalb Vertrag und Code als TEXT (Muster:
// `zusammenschaltung.test.ts`) und verlangt:
//   · jede Pipeline-Stufe der Oberfläche hat ihre Zeile, in derselben Reihenfolge;
//   · jeder Verweis `pfad#stelle` steht wirklich im genannten Pfad;
//   · die Feldtabelle der Naht ist deckungsgleich mit `ImportItem` (samt Pflicht/optional) und die
//     Mitgliedertabelle mit `SourceAdapter`;
//   · die Naht liegt in Dateien unter Freeze-144, und der Vertrag nennt jede eingefrorene Datei;
//   · alle Quellwege enden an `createImportCandidates`, und die Quelladapter erreichen den Typ nur
//     über die öffentliche `index.ts`.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IMPORT_PIPELINE_STEPS } from "../../apps/web/src/lib/extConcept";
import { repoPfad } from "../support/repoPfad";

const VERTRAG = readFileSync(repoPfad("docs/architektur/importkette.md"), "utf8");
const TYPEN = readFileSync(repoPfad("services/library-analytics/src/types.ts"), "utf8");
const FREEZE = readFileSync(repoPfad("tests/library-analytics-freeze144.test.ts"), "utf8");

/** Der Text zwischen zwei Markierungen des Vertrags. */
function abschnitt(von: string, bis: string): string {
  const anfang = VERTRAG.indexOf(von);
  const ende = VERTRAG.indexOf(bis, anfang + von.length);
  if (anfang < 0 || ende < 0) {
    throw new Error(`Abschnitt nicht gefunden: ${von} … ${bis}`);
  }
  return VERTRAG.slice(anfang, ende);
}

/** Der Rumpf einer Deklaration bis zur nächsten Zeile, die nur `}` trägt. */
function rumpf(quelle: string, kopf: string): string {
  const anfang = quelle.indexOf(kopf);
  if (anfang < 0) {
    throw new Error(`Deklaration nicht gefunden: ${kopf}`);
  }
  return quelle.slice(anfang, quelle.indexOf("\n}\n", anfang));
}

/** Tabellenzeilen `| \`name\` | …` eines Abschnitts: Name → Rest der Zeile. */
function zeilen(text: string): Map<string, string> {
  return new Map(
    [...text.matchAll(/^\| `(\w+)` \|(.*)$/gm)].map((m) => [m[1] ?? "", m[2] ?? ""] as const),
  );
}

describe("Durchflussvertrag (R-0130): jede Stufe mit Eingang, Ausgang und Codestelle", () => {
  it("nennt die Stufen der Pipeline-Anzeige in derselben Reihenfolge", () => {
    const stufen = zeilen(abschnitt("## 2 Die Stufen", "## 3 Die Naht"));
    expect([...stufen.keys()]).toEqual([...IMPORT_PIPELINE_STEPS]);
    for (const [stufe, rest] of stufen) {
      const spalten = rest.split(" | ").map((s) => s.trim());
      // Eingang, Ausgang, Codestelle — keine Spalte leer, die Codestelle mit Verweis.
      expect(spalten.length, stufe).toBeGreaterThanOrEqual(3);
      const leer = spalten.slice(0, 3).filter((s) => s.replace(/\|/g, "").trim() === "");
      expect(leer, stufe).toEqual([]);
      expect(rest, stufe).toMatch(/`[^`\s]+#[^`]+`/);
    }
  });

  it("jeder Verweis `pfad#stelle` steht im genannten Pfad", () => {
    const verweise = [...VERTRAG.matchAll(/`([\w./-]+\.(?:ts|tsx|cjs))#([^`]+)`/g)];
    expect(verweise.length).toBeGreaterThan(30);
    const fehlt: string[] = [];
    for (const [, pfad = "", stelle = ""] of verweise) {
      if (!existsSync(repoPfad(pfad))) {
        fehlt.push(`${pfad}: Datei fehlt`);
        continue;
      }
      if (!readFileSync(repoPfad(pfad), "utf8").includes(stelle)) {
        fehlt.push(`${pfad}: „${stelle}" fehlt`);
      }
    }
    expect(fehlt).toEqual([]);
  });
});

describe("Naht (R-0686): benannt, beschrieben, eingefroren", () => {
  it("die Feldtabelle ist deckungsgleich mit ImportItem, Pflicht genau wie im Typ", () => {
    const typ = rumpf(TYPEN, "export interface ImportItem {");
    const felder = new Map(
      [...typ.matchAll(/^ {2}(\w+)(\??): /gm)].map((m) => [m[1] ?? "", m[2] !== "?"] as const),
    );
    const tabelle = zeilen(abschnitt("**Was übergeben wird", "**Wie ein Adapter liefert"));
    expect([...tabelle.keys()].sort()).toEqual([...felder.keys()].sort());
    for (const [feld, pflicht] of felder) {
      expect(
        tabelle
          .get(feld)
          ?.trim()
          .startsWith(pflicht ? "ja |" : "nein |"),
        feld,
      ).toBe(true);
    }
  });

  it("die Mitgliedertabelle ist deckungsgleich mit SourceAdapter", () => {
    const typ = rumpf(TYPEN, "export interface SourceAdapter {");
    const mitglieder = [...typ.matchAll(/^ {2}(?:readonly )?(\w+)\??[(:]/gm)].map((m) => m[1]);
    const tabelle = zeilen(abschnitt("**Wie ein Adapter liefert", "**Eingefroren."));
    expect([...tabelle.keys()].sort()).toEqual([...mitglieder].sort());
  });

  it("die Naht liegt unter Freeze-144, und der Vertrag nennt jede eingefrorene Datei", () => {
    const eingefroren = [...FREEZE.matchAll(/^ {4}pfad: "(services\/[^"]+)",$/gm)].map(
      (m) => m[1] ?? "",
    );
    expect(eingefroren).toContain("services/library-analytics/src/types.ts");
    expect(eingefroren).toContain("services/library-analytics/index.ts");
    const liste = abschnitt("**Eingefroren.**", "## 4 ");
    for (const pfad of eingefroren) {
      expect(liste, pfad).toContain(`- \`${pfad}\``);
    }
  });

  it("alle drei Quellwege enden an createImportCandidates", () => {
    for (const route of [
      "services/app/src/routes/confluence-import-routes.ts",
      "services/app/src/routes/sharepoint-import-routes.ts",
      "services/app/src/routes/library-routes.ts",
    ]) {
      expect(readFileSync(repoPfad(route), "utf8"), route).toContain("createImportCandidates(");
    }
  });

  it("die Quelladapter erreichen den Import-Kern nur über dessen index.ts", () => {
    const verstoesse: string[] = [];
    for (const modul of ["confluence", "sharepoint"]) {
      const ordner = `services/${modul}/src`;
      for (const datei of readdirSync(repoPfad(ordner)).filter((d) => d.endsWith(".ts"))) {
        const quelle = readFileSync(repoPfad(`${ordner}/${datei}`), "utf8");
        for (const m of quelle.matchAll(/from "([^"]*library-analytics[^"]*)"/g)) {
          if (m[1] !== "../../library-analytics") {
            verstoesse.push(`${ordner}/${datei}: ${m[1]}`);
          }
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });
});

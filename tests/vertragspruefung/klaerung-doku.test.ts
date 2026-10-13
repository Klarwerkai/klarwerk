// ================================================================================================
// aufnahme:20260922:gesamt-vertragspruefung · DIE KLÄRUNG HÄLT IHRE FUNDSTELLEN.
// ================================================================================================
//
//   V1  R-0424 steht im Originalwortlaut mit Altbestand, Herkunft und fehlender Entscheidung (K2).
//   V2  Die Geltungsfrage nennt Widersprüche, drei Alternativen und die noch nötige Entscheidung;
//       eine Umsetzung wird nicht behauptet (K1).
//   V3  Die abgegrenzten Nachbarbausteine existieren wie beschrieben; eine Vertragsprüfung gegen
//       ein Regelwerk gibt es im Code nicht (K1, K3).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const doku = readFileSync(repoPfad("docs/vertragspruefung.md"), "utf8");
const quelle = (relativ: string): string => readFileSync(repoPfad(relativ), "utf8");
const abschnitt = (von: string, bis?: string): string =>
  doku.slice(doku.indexOf(von), bis ? doku.indexOf(bis) : undefined);

function dateien(relativ: string): string[] {
  const wurzel = repoPfad(relativ);
  return readdirSync(wurzel).flatMap((name) => {
    const pfad = join(relativ, name);
    return statSync(repoPfad(pfad)).isDirectory() ? dateien(pfad) : [pfad];
  });
}

describe("V1 · R-0424 im Originalwortlaut", () => {
  const punkt = abschnitt("## 1.", "## 2.");

  it("Anforderung, Altbestand und Herkunft wörtlich", () => {
    for (const wortlaut of [
      "„Vertragstexte werden gegen ein Regelwerk geprueft und mit Aenderungsvorschlaegen versehen.“",
      "„Branchenwerkzeug, nicht Kern; Codex bestaetigt die Streichung. Marktbeleg Spellbook, Harvey.“",
      "„Landkarte v1 Zeile F11: BEWUSST NIE (Branchenwerkzeug); Landkarte v3: gestrichen.“",
      "„Altbestand: Einordnung offen. Der damalige Zustand ist kein aktueller Funktionsnachweis. Auch eine alte Pedi-Auswahl bleibt unten als historische Entscheidung erhalten.“",
    ]) {
      expect(punkt).toContain(wortlaut);
    }
  });

  it("keine gespeicherte Entscheidung", () => {
    expect(punkt).toContain("`entscheidung: null`, `entscheidungen: []`, `pedi_override: null`");
  });
});

describe("V2 · Geltungsfrage ohne ersetzte Entscheidung", () => {
  const frage = abschnitt("## 3.", "## 4.");

  it("Widersprüche und fehlende Belege sind benannt", () => {
    expect(frage).toContain("**Widerspruch der Quellen:**");
    expect(frage.match(/\*\*Beleg fehlt\.\*\*/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("drei Alternativen, jüngste Belege, offene Entscheidung", () => {
    for (const zeile of ["| A |", "| B |", "| C |"]) {
      expect(frage).toContain(zeile);
    }
    expect(frage).toContain("**Jüngste Belege:**");
    expect(frage).toContain("**Noch erforderlich:** eine Entscheidung (Pedi)");
    expect(frage).toContain("Deshalb enthält diese Lieferung keine Produktfunktion.");
  });
});

describe("V3 · Nachbarbausteine und Nicht-Bestand", () => {
  it("die abgegrenzten Fundstellen tragen, was die Klärung ihnen zuschreibt", () => {
    const detect = quelle("services/conflicts/src/detect.ts");
    expect(detect).toContain("export type GeltungsKollisionsRegel");
    expect(detect).toContain("export function vorschlagAusUrteil");
    expect(quelle("docs/klara/klara-vorschau.md")).toContain("Als Änderungsvorschlag eingereicht");
    const beispiel = quelle("services/app/src/example-packages/advisor-ict-v1.lokalisierung.json");
    expect(beispiel).toContain('"title": "Checkliste zur Vertragsprüfung"');
    expect(beispiel).toContain("draft_translation_not_business_approval");
    expect(quelle("scripts/insel/schema-vertrag.mjs")).toContain("Vertragsprüfung");
  });

  // Wird eine Vertragsprüfung später gebaut (Alternative B oder C), muss diese Klärung mitziehen.
  it("keine Route, Reasoner-Aufgabe oder Oberfläche zur Vertragsprüfung", () => {
    const orte = [
      ...dateien("services/app/src/routes"),
      ...dateien("services/reasoner/src"),
      ...dateien("apps/web/src"),
      ...dateien("apps/web/public/word-addin"),
    ];
    const treffer = orte.filter((pfad) =>
      /vertragspr(ue|ü)fung|contract[ -]?review/i.test(quelle(pfad)),
    );
    expect(treffer).toEqual([]);
  });
});

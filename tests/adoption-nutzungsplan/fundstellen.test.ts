// ================================================================================================
// aufnahme:20260922:gesamt-adoption · DER NUTZUNGSPLAN HÄLT SEINE FUNDSTELLEN.
// ================================================================================================
//
//   P1  Jeder Nutzenmoment und jedes Gegensignal in `docs/adoption/NUTZUNGSPLAN.md` nennt eine
//       Datei, die existiert, und einen Anker, der in ihr steht — „im Produkt belegt“ heißt hier:
//       am Code nachprüfbar, nicht behauptet (K1).
//   P2  Jeder Moment hat eine Messgröße und einen Lesweg; der Messplan hat Phasen mit Prüfregeln,
//       und Zielwerte werden nicht vor dem Ausgangswert erfunden (K1, K2).
//   P3  R-2193 ist je Teil getrennt bewertet, mit dem gesonderten Auftrag; die genannten
//       vorhandenen Bausteine existieren; Gamification bleibt ausgeschlossen (K3, R-1050).
//   P4  Fehlende Belege und Widersprüche sind benannt (K4).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const plan = readFileSync(repoPfad("docs/adoption/NUTZUNGSPLAN.md"), "utf8");

function abschnitt(von: string, bis: string): string {
  const anfang = plan.indexOf(von);
  const ende = plan.indexOf(bis, anfang + von.length);
  expect(anfang, `Abschnitt ${von} fehlt`).toBeGreaterThanOrEqual(0);
  expect(ende, `Abschnitt ${bis} fehlt`).toBeGreaterThan(anfang);
  return plan.slice(anfang, ende);
}

function zeilenMit(text: string, kennung: RegExp): string[] {
  return text.split("\n").filter((z) => kennung.test(z));
}

function codeStellen(zeile: string): string[] {
  return [...zeile.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "");
}

const momente = abschnitt("## 2.", "## 3.");
const momentZeilen = zeilenMit(momente, /^\| N\d+ \|/);
const gegenZeilen = zeilenMit(momente, /^\| G\d+ \|/);

describe("P1 · jede Fundstelle existiert und trägt ihren Anker", () => {
  it("zehn Nutzenmomente und drei Gegensignale stehen im Plan", () => {
    expect(momentZeilen).toHaveLength(10);
    expect(gegenZeilen).toHaveLength(3);
  });

  for (const zeile of [...momentZeilen, ...gegenZeilen]) {
    const kennung = zeile.split("|")[1]?.trim() ?? "";
    it(kennung, () => {
      const stellen = codeStellen(zeile);
      const index = stellen.findIndex((s) => /^(services|apps)\/[^ ]+\.tsx?$/.test(s));
      expect(index, `${kennung}: keine Fundstelle`).toBeGreaterThanOrEqual(0);
      const pfad = stellen[index] ?? "";
      const anker = stellen[index + 1] ?? "";
      expect(existsSync(repoPfad(pfad)), `${kennung}: ${pfad}`).toBe(true);
      expect(anker.length, `${kennung}: kein Anker`).toBeGreaterThan(0);
      const inhalt = readFileSync(repoPfad(pfad), "utf8");
      expect(inhalt, `${kennung}: ${anker} in ${pfad}`).toContain(anker);
    });
  }
});

describe("P2 · messbar: Messgröße, Lesweg, Phasen, kein erfundener Zielwert", () => {
  it("jeder Moment hat Messgröße und Lesweg", () => {
    for (const zeile of momentZeilen) {
      const spalten = zeile.split("|").map((s) => s.trim());
      expect(spalten[6]?.length ?? 0, `${spalten[1]} ohne Messgröße`).toBeGreaterThan(0);
      expect(spalten[7]?.length ?? 0, `${spalten[1]} ohne Lesweg`).toBeGreaterThan(0);
    }
  });

  it("drei Phasen mit Prüfregeln; Zielwerte erst nach dem Ausgangswert", () => {
    const messplan = abschnitt("## 3.", "## 4.");
    for (const phase of ["### Phase A", "### Phase B", "### Phase C"]) {
      expect(messplan).toContain(phase);
    }
    expect(zeilenMit(messplan, /^\| [ABC]\d /).length).toBeGreaterThanOrEqual(8);
    expect(messplan).toContain("Zielwerte werden **erst nach dem Ausgangswert** festgelegt");
  });

  it("die Messlücken L1 bis L6 sind benannt, nicht gebaut", () => {
    const luecken = abschnitt("## 4.", "## 5.");
    expect(luecken).toContain("**benannt, nicht gebaut**");
    for (const l of ["L1", "L2", "L3", "L4", "L5", "L6"]) {
      expect(luecken).toContain(`**${l} `);
    }
  });
});

describe("P3 · R-2193 getrennt bewertet, Gamification ausgeschlossen", () => {
  const teile = abschnitt("## 6.", "## 7.");

  it("jeder Teil steht in einer eigenen Zeile mit seinem gesonderten Auftrag", () => {
    const erwartet: Record<string, string[]> = {
      "Native Apps": ["aufnahme:20260922:gesamt-native-apps"],
      Drittsystemanschlüsse: [
        "aufnahme:20260922:gesamt-anlagendaten-abgleich",
        "aufnahme:20260922:gesamt-chat-import",
        "aufnahme:20260922:gesamt-email-eingang",
      ],
      "BI-Auswertungen": ["aufnahme:20260922:gesamt-bi-anbindung"],
      Selbstbedienungsbereitstellung: ["aufnahme:20260922:gesamt-instanztrennung"],
      Gamification: [],
    };
    for (const [teil, auftraege] of Object.entries(erwartet)) {
      const zeile = zeilenMit(teile, new RegExp(`^\\| ${teil} \\|`));
      expect(zeile, teil).toHaveLength(1);
      for (const auftrag of auftraege) {
        expect(zeile[0], `${teil}: ${auftrag}`).toContain(auftrag);
      }
    }
    expect(teile).toContain("keine pauschale Freigabe");
    expect(teile).toContain("an eine Firma je Instanz gebunden");
  });

  it("die genannten vorhandenen Bausteine existieren", () => {
    for (const stelle of codeStellen(teile)) {
      if (/^(desktop-app|docs|services)\//.test(stelle)) {
        expect(existsSync(repoPfad(stelle)), stelle).toBe(true);
      }
    }
  });

  it("keine Punkte, Abzeichen oder Ranglisten; die Grenze steht auch im Code", () => {
    expect(plan).toContain("**Keine Punkte, Abzeichen oder Ranglisten** (R-1050");
    const typen = readFileSync(repoPfad("services/library-analytics/src/types.ts"), "utf8");
    const update = readFileSync(repoPfad("services/output/src/wochenupdate.ts"), "utf8");
    expect(typen).toContain("anti-Gamification");
    expect(update).toContain("Leistungsrangliste, die EK-19 ausschließt");
  });
});

describe("P4 · fehlende Belege und Widersprüche benannt", () => {
  it("SCRUM-475–481, Playbook, BEN-Urteil und Zeitachse", () => {
    const offen = abschnitt("## 7.", "## Abgrenzung");
    for (const beleg of [
      "SCRUM-475–481 nicht im Repository",
      "Adoption-Playbook „Drei Akte“",
      "JOB 1043 / BEN-Urteil ROT",
      "Widerspruch zur Zeitachse",
      "Nicht erprobt",
    ]) {
      expect(offen, beleg).toContain(beleg);
    }
  });
});

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
//   P5  R-1925: SCRUM-475–481 sind einzeln gegen den Originalexport abgeglichen — Konzeptergebnis,
//       Bestand mit Fassung und Beleg, offener Rest; 475 gegen R-1050 abgegrenzt, 477 mit der
//       Konzeptantwort vom 17.07. und SCRUM-518, 481 geparkt (K2, K3, K4).
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

describe("P5 · R-1925: die sieben Konzeptvorgänge einzeln abgeglichen", () => {
  const abgleich = abschnitt("## 7.", "## 8.");
  const zeile = (vorgang: string): string => {
    const treffer = zeilenMit(abgleich, new RegExp(`^\\| ${vorgang} \\|`));
    expect(treffer, vorgang).toHaveLength(1);
    return treffer[0] ?? "";
  };

  it("je Vorgang eine Zeile mit Inhalt, Konzeptergebnis, Bestand und offenem Rest", () => {
    for (let nummer = 475; nummer <= 481; nummer += 1) {
      const vorgang = `SCRUM-${nummer}`;
      const spalten = zeile(vorgang)
        .split("|")
        .map((s) => s.trim());
      for (const index of [2, 3, 4, 5]) {
        expect(spalten[index]?.length ?? 0, `${vorgang}, Spalte ${index}`).toBeGreaterThan(0);
      }
    }
    expect(abgleich).toContain("jira-SCRUM.json");
    expect(abgleich).toContain("1.0.0-beta.1.956");
  });

  it("die genannten Fundstellen und Belege existieren", () => {
    for (const stelle of codeStellen(abgleich)) {
      if (/^(apps|services|tests|docs)\//.test(stelle)) {
        expect(existsSync(repoPfad(stelle)), stelle).toBe(true);
      }
    }
  });

  it("475 gegen R-1050; 477 mit Antwort vom 17.07. und SCRUM-518; 481 geparkt", () => {
    expect(zeile("SCRUM-475")).toContain("**Abgelehnt.**");
    expect(zeile("SCRUM-475")).toContain("R-1050");
    expect(zeile("SCRUM-475")).toContain("Keine Gamification-Freigabe");
    expect(zeile("SCRUM-477")).toContain("Kommentar vom 17.07.2026");
    expect(zeile("SCRUM-477")).toContain("**SCRUM-518**");
    expect(zeile("SCRUM-477")).toContain("Leere-Antwort-Rate");
    expect(zeile("SCRUM-481")).toContain("**geparkt als Idee**");
    expect(zeile("SCRUM-476")).toContain("Widerspruch zum heutigen Stand");
    // Beide Video-Richtungen, Kopierschutz und Informationsbewertung stehen ausdrücklich da.
    expect(zeile("SCRUM-479")).toContain("**Video → Wissen:**");
    expect(zeile("SCRUM-479")).toContain("**Wissen → Video:**");
    expect(zeile("SCRUM-478")).toContain("**Kopierschutz:**");
    expect(zeile("SCRUM-478")).toContain("**Informationsbewertung:**");
  });
});

describe("P4 · fehlende Belege und Widersprüche benannt", () => {
  it("SCRUM-475–481, Playbook, BEN-Urteil und Zeitachse", () => {
    const offen = abschnitt("## 8.", "## Abgrenzung");
    for (const beleg of [
      "SCRUM-475–481 jetzt abgeglichen",
      "Adoption-Playbook „Drei Akte“",
      "JOB 1043 / BEN-Urteil ROT",
      "Widerspruch zur Zeitachse",
      "Nicht erprobt",
    ]) {
      expect(offen, beleg).toContain(beleg);
    }
  });
});

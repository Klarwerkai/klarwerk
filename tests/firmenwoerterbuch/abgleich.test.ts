// ================================================================================================
// FIRMENWÖRTERBUCH · DER ABGLEICH SELBST (`begriffsHinweise`) — und seine Grenze zur Validation.
// ================================================================================================
//
// Der Draht steht in `begriffe-api.test.ts`. Hier stehen die Fälle, die man am Draht nur mühsam
// sieht: Wortgrenzen, Mehrwortbenennungen, Synonyme, die eine unerwünschte Benennung enthalten,
// Sprachtrennung, die Zählung gleicher Stellen für Word und die strukturelle Trennung zur
// fachlichen Prüfung (K8).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type BegriffFassung,
  begriffsHinweise,
  pruefeBegriffEingabe,
} from "../../services/app/src/firmenwoerterbuch";
import { repoPfad } from "../support/repoPfad";

function eintrag(
  teil: Partial<BegriffFassung> & Pick<BegriffFassung, "bezeichnungen">,
): BegriffFassung {
  return {
    id: "b-1",
    version: 1,
    geltungsbereich: "Vertrieb",
    verantwortlich: "Test",
    definition: { de: "Testdefinition." },
    geaendertVon: "u-1",
    geaendertAm: "2026-10-06T08:00:00.000Z",
    ...teil,
  };
}

const KONTO = eintrag({
  bezeichnungen: {
    de: {
      vorzug: "Kundenkonto",
      synonyme: ["Konto Plus"],
      unerwuenscht: ["Konto", "Kundenaccount"],
    },
    en: { vorzug: "customer account", synonyme: [], unerwuenscht: ["client account"] },
  },
});

describe("K2/K3 · Fundstellen", () => {
  it("findet ganze Wörter ohne Rücksicht auf Gross-/Kleinschreibung, nie Wortteile", () => {
    const segment = "Das konto ist neu; das Girokonto und die Kontoführung bleiben.";
    const { hinweise } = begriffsHinweise([KONTO], [segment], "Vertrieb");
    expect(hinweise).toHaveLength(1);
    expect(hinweise[0]).toMatchObject({ gefunden: "konto", vorzug: "Kundenkonto", start: 4 });
  });

  it("Mehrwortbenennungen dürfen über beliebigen Leerraum laufen", () => {
    const { hinweise } = begriffsHinweise([KONTO], ["Check the client  account now."]);
    expect(hinweise.map((h) => h.gefunden)).toEqual(["client  account"]);
    expect(hinweise[0]?.vorzug).toBe("customer account");
  });

  it("eine unerwünschte Benennung INNERHALB eines zugelassenen Synonyms ist kein Hinweis", () => {
    const { hinweise } = begriffsHinweise([KONTO], ["Das Konto Plus und das Konto."], "Vertrieb");
    expect(hinweise).toHaveLength(1);
    expect(hinweise[0]?.start).toBe("Das Konto Plus und das ".length);
  });

  it("die Sprachen bleiben getrennt: Deutsch schlägt Deutsch vor, Englisch Englisch", () => {
    const { hinweise } = begriffsHinweise([KONTO], ["Kundenaccount", "client account"]);
    expect(hinweise.map((h) => [h.segment, h.sprache, h.vorzug])).toEqual([
      [0, "de", "Kundenkonto"],
      [1, "en", "customer account"],
    ]);
  });

  it("zählt gleiche Stellen exakt — Grundlage dafür, dass Word genau die gemeinte ersetzt", () => {
    const segment = "Konto, konto und Konto.";
    const { hinweise } = begriffsHinweise([KONTO], [segment], "Vertrieb");
    expect(hinweise.map((h) => [h.gefunden, h.vorkommen, h.vorkommenGesamt])).toEqual([
      ["Konto", 0, 2],
      ["konto", 0, 1],
      ["Konto", 1, 2],
    ]);
  });

  it("ohne Kontext: dieselbe Stelle aus zwei Geltungsbereichen ergibt zwei mehrdeutige Hinweise", () => {
    const fertigung = eintrag({
      id: "b-2",
      geltungsbereich: "Fertigung",
      bezeichnungen: { de: { vorzug: "Fertigungskonto", synonyme: [], unerwuenscht: ["Konto"] } },
    });
    const ohne = begriffsHinweise([KONTO, fertigung], ["Das Konto."]);
    expect(ohne.hinweise.map((h) => [h.begriffId, h.mehrdeutig])).toEqual([
      ["b-1", true],
      ["b-2", true],
    ]);
    const mit = begriffsHinweise([KONTO, fertigung], ["Das Konto."], "fertigung");
    expect(mit.hinweise.map((h) => [h.begriffId, h.mehrdeutig])).toEqual([["b-2", false]]);
  });
});

describe("K1 · Prüfung der Pflege-Eingabe", () => {
  it("bereinigt Leerraum und Dubletten, trennt Vorzug aus den Synonymen", () => {
    const eingabe = pruefeBegriffEingabe({
      geltungsbereich: "  Vertrieb ",
      verantwortlich: "Team",
      definition: { de: " Konto  eines Kunden. " },
      bezeichnungen: {
        de: {
          vorzug: "Kundenkonto",
          synonyme: ["kundenkonto", "Debitorenkonto", "debitorenkonto", ""],
          unerwuenscht: ["Account"],
        },
      },
    });
    expect(eingabe).toEqual({
      geltungsbereich: "Vertrieb",
      verantwortlich: "Team",
      definition: { de: "Konto eines Kunden." },
      bezeichnungen: {
        de: { vorzug: "Kundenkonto", synonyme: ["Debitorenkonto"], unerwuenscht: ["Account"] },
      },
    });
  });

  it("weist eine Definition ohne Benennungen in derselben Sprache ab", () => {
    expect(() =>
      pruefeBegriffEingabe({
        geltungsbereich: "Vertrieb",
        verantwortlich: "Team",
        definition: { de: "Konto.", en: "Account." },
        bezeichnungen: { de: { vorzug: "Kundenkonto" } },
      }),
    ).toThrow(/ohne Benennungen/);
  });
});

describe("K8 · die Begriffsprüfung ist von Validation und Konflikterkennung getrennt", () => {
  function dateien(verzeichnis: string): string[] {
    return readdirSync(repoPfad(verzeichnis), { recursive: true, encoding: "utf8" })
      .filter((d) => d.endsWith(".ts") && !d.endsWith(".test.ts"))
      .map((d) => join(verzeichnis, d));
  }

  it("weder services/validation noch services/conflicts noch der Prüfweg kennt das Wörterbuch", () => {
    const quellen = [
      ...dateien("services/validation"),
      ...dateien("services/conflicts"),
      "services/app/src/check-text-detection.ts",
      "services/app/src/conflict-detection.ts",
      "services/app/src/routes/validation-routes.ts",
      "services/app/src/routes/conflicts-routes.ts",
    ];
    expect(quellen.length).toBeGreaterThan(5);
    const treffer = quellen.filter((d) =>
      /firmenwoerterbuch|begriffe-routes|begriffsHinweise/.test(readFileSync(repoPfad(d), "utf8")),
    );
    expect(treffer).toEqual([]);
  });

  it("das Ergebnis sagt in jedem Fall sachlichGeprueft: false — auch ohne Hinweis", () => {
    const satz = "Ein sachlich falscher Satz über das Kundenkonto.";
    expect(begriffsHinweise([KONTO], [satz])).toEqual({
      hinweise: [],
      begriffeGeprueft: 1,
      kontext: null,
      sachlichGeprueft: false,
    });
  });
});

// ================================================================================================
// P-WIKI-STELLENBEZUG · D5 — DIE NEUEN BESCHRIFTUNGEN IN DE/EN/NL, OHNE FREIGABEWORT
// ================================================================================================
//
// Dieselbe Prüfung wie `tests/wiki-diskussion/sprachen.test.ts` für den Namensraum des
// Stellenbezugs: jede Beschriftung liegt in allen drei Sprachen vor, keine lässt eine Variable
// offen, und keine behauptet eine fachliche Freigabe. Dazu der Satz der Anforderung wörtlich.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { sprachbestand } from "../support/i18nBestand";

const SPRACHEN = ["de", "en", "nl"] as const;

// Die Texte stehen im eigenen Textmodul `apps/web/src/texte/stellenbezug.ts` (die Grundwörterbücher
// bleiben unverändert, `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`).
const SCHLUESSEL = [
  "stellenbezug.waehlen",
  "stellenbezug.keine",
  "stellenbezug.art.absatz",
  "stellenbezug.art.tabelle",
  "stellenbezug.art.bild",
  "stellenbezug.anfang",
  "stellenbezug.stelle",
  "stellenbezug.hier",
  "stellenbezug.eindeutig",
  "stellenbezug.unklar",
  "stellenbezug.alteFassung",
  "stellenbezug.neuWaehlen",
] as const;

const VERBOTEN: Record<(typeof SPRACHEN)[number], readonly string[]> = {
  de: ["freigegeben", "freigabe", "freigeben", "geprüft", "geprueft", "validiert"],
  en: ["approved", "approval", "released", "validated", "verified", "reviewed"],
  nl: ["goedgekeurd", "goedkeuring", "vrijgegeven", "gevalideerd", "gecontroleerd", "geverifieerd"],
};

const WERTE = { art: "Absatz", abschnitt: "Ablauf", version: 3, aktuell: 5 };

describe("P-WIKI-STELLENBEZUG · D5 — Beschriftungen", () => {
  for (const lng of SPRACHEN) {
    it(`${lng} · jede Beschriftung ist da, ohne offene Variable und ohne Freigabewort`, async () => {
      await i18n.changeLanguage(lng);
      const bestand = sprachbestand(lng);
      expect(SCHLUESSEL.filter((k) => (bestand[k] ?? "").trim().length === 0)).toEqual([]);
      for (const k of SCHLUESSEL) {
        const text = i18n.t(k, WERTE);
        expect(text, `${lng}/${k}`).not.toBe(k);
        expect(text, `${lng}/${k}`).not.toContain("{{");
        for (const wort of VERBOTEN[lng]) {
          expect(text.toLowerCase(), `${lng}/${k} enthält „${wort}“`).not.toContain(wort);
        }
      }
    });
  }

  it("de · der Satz für die unklare Zuordnung steht wörtlich so da, wie die Anforderung ihn nennt", async () => {
    await i18n.changeLanguage("de");
    expect(i18n.t("stellenbezug.unklar")).toBe(
      "Bezug in der neuen Fassung nicht eindeutig — Zuordnung prüfen",
    );
  });
});

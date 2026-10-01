// AUFNAHME 20260922 · VORSCHAU-REICHWEITE — die Prüffunktion des K4-Nachweises, im Tor gemessen.
//
// Der echte Nachweis (`vorschau-reichweite-pg-im-browser.integration.test.ts`, K4 und K4-R) braucht
// PostgreSQL und Chromium und läuft auf dem Prüfserver. Hier steht nur, dass die Prüffunktion
// TRENNT: ein Befund in der Form des neuen Verhaltens ergibt keine Verstöße, einer in der Form des
// alten (Antwort ohne `coverage`, Chip „Das ist neu") ergibt die erwarteten. Die Sätze kommen aus
// dem Katalog, nicht aus dem Test.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type Befund, verstoesse } from "./nachweis";

const T = i18n.getFixedT("de");
const UMFANG = { kind: "candidates", checked: 40, limit: 40, limitReached: true };

function befund(over: Partial<Befund>): Befund {
  return {
    lauf: "pending",
    antwort: { status: "pending", similar: [], coverage: UMFANG },
    lage: { chipLage: null, chipText: null, vorschau: null, seite: "" },
    aufgeklappt: null,
    zielId: "ziel",
    deckel: 40,
    ...over,
  };
}

const umfangKurz = T("vorschau.umfangGrenze", { count: 40 });

describe("K4-Prüffunktion", () => {
  it("neues Verhalten, pending: keine Verstöße", () => {
    const vorschau = T("vorschau.ohneTreffer", { umfang: umfangKurz });
    expect(
      verstoesse(
        befund({ lage: { chipLage: null, chipText: null, vorschau, seite: vorschau } }),
        T,
      ),
    ).toEqual([]);
  });

  it("neues Verhalten, done: keine Verstöße", () => {
    const chip = `${T("vorschau.name")}${T("vorschau.keinTreffer")}· ${umfangKurz}`;
    const erklaerung = T("vorschau.erklaerungGrenze", { count: 40, limit: 40 });
    expect(
      verstoesse(
        befund({
          lauf: "done",
          antwort: { status: "done", similar: [], coverage: UMFANG },
          lage: { chipLage: "empty", chipText: chip, vorschau: null, seite: chip },
          aufgeklappt: { erklaerung, chip: `${chip}${erklaerung}` },
        }),
        T,
      ),
    ).toEqual([]);
  });

  it("altes Verhalten, pending: kein Umfang am Draht, keine Umfangszeile", () => {
    expect(verstoesse(befund({ antwort: { status: "pending", similar: [] } }), T).sort()).toEqual([
      "ANZEIGE_OHNE_UMFANG",
      "UMFANG_FEHLT",
    ]);
  });

  it("altes Verhalten, done: zusätzlich „Das ist neu“ und keine Erklärung des Umfangs", () => {
    const alt = T("erfassen.live.neu");
    expect(
      verstoesse(
        befund({
          lauf: "done",
          antwort: { status: "done", similar: [] },
          lage: { chipLage: "new", chipText: alt, vorschau: null, seite: alt },
          aufgeklappt: { erklaerung: null, chip: `${alt}${T("intake.live.new")}` },
        }),
        T,
      ).sort(),
    ).toEqual(["ANZEIGE_OHNE_UMFANG", "ERKLAERUNG", "NEUHEIT", "UMFANG_FEHLT"]);
  });

  it("ein Ziel in der Antwort ist ein eigener Verstoß (dann läge es nicht hinter der Grenze)", () => {
    const vorschau = T("vorschau.ohneTreffer", { umfang: umfangKurz });
    expect(
      verstoesse(
        befund({
          antwort: { status: "pending", similar: [{ id: "ziel" }], coverage: UMFANG },
          lage: { chipLage: null, chipText: null, vorschau, seite: vorschau },
        }),
        T,
      ),
    ).toEqual(["ZIEL_IM_UMFANG"]);
  });
});

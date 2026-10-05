// ================================================================================================
// UX-27 / N-0054 · DER PRÜFWERT VERSPRICHT IN KEINER SPRACHE WAHRHEIT.
// ================================================================================================
//
// Bestandsabgleich der Prüfstatus-Anzeige (03.10.2026): DE („Prüfstand") und EN („Review status")
// waren umgestellt, NL zeigte weiter „{{pct}} % zeker" und „Zekerheid: … van 100" — genau das
// Wahrheitsversprechen, das UX-27 abschafft. Geprüft wird der Katalog selbst, je Sprache.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

const SCHLUESSEL = ["evidence.percentSure", "evidence.confidenceLabel"] as const;
const VERSPRECHEN = /sicher|sure|certain|zeker/i;

describe("UX-27 · Kurztext des Prüfwerts in DE, EN und NL", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: Prüf-/Bewertungsstand, kein „sicher"`, () => {
      for (const schluessel of SCHLUESSEL) {
        const wert = String(i18n.getResource(sprache, "translation", schluessel) ?? "");
        expect(wert.length, `${sprache}: ${schluessel} fehlt`).toBeGreaterThan(0);
        expect(wert, `${sprache}: ${schluessel}`).not.toMatch(VERSPRECHEN);
        expect(wert, `${sprache}: ${schluessel} ohne Platzhalter`).toContain("{{pct}}");
      }
    });
  }

  it("NL benennt den Wert als Beoordelingsstand", () => {
    expect(i18n.getResource("nl", "translation", "evidence.percentSure")).toBe(
      "Beoordelingsstand: {{pct}} %",
    );
  });
});

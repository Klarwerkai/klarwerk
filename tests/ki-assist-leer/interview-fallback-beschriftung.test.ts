// ================================================================================================
// JOB 3276 (Nachführung 08.09. 08:32) — WAS AM INTERVIEW STEHT, MUSS EIN MENSCH VERSTEHEN.
// ================================================================================================
//
// CODEX' NUTZERBEFUND vom 08.09. (Beleg 123-interview-anbieter.png): Erfassen → Interview zeigte
// nach sichtbarer OpenAI-Anzeige alle drei Fragen mit der Beschriftung „Deterministischer
// Fallback". Für Pedi ist das kein Satz, sondern ein Fachwort — es sagt ihm weder, WAS er vor sich
// hat, noch dass die KI daran nicht beteiligt war. Verlangt ist Alltagssprache: dass feste
// Ersatzfragen genutzt werden, und der Grund, soweit die Fläche ihn kennt.
//
// WAS DIE FLÄCHE WEISS UND WAS NICHT: die Interview-Antwort trägt nur `demo: true` — kein
// Statuscode, kein finish_reason. Der GENAUE Grund steht deshalb serverseitig im Laufprotokoll
// (Pflicht 5 dieses Auftrags, `tests/ki-assist-leer/assist-leere-antwort.test.ts` C1/C2), nicht in
// diesem Etikett. Es sagt darum genau so viel, wie wahr ist, und nicht mehr.
//
// Der Test liest die drei Sprachfassungen aus dem zusammengesetzten Wörterbuch — dieselbe Bauform
// wie `tests/i18n/nl-completeness.test.ts`. Bis JOB 3326 R5 war das ein Textschnitt aus
// `apps/web/src/i18n.ts` „damit er ohne i18next-Laufzeit auskommt"; seit ein Teil der Schlüssel
// per Spread aus einem eigenen Modul kommt, sähe ein Textschnitt sie nicht mehr (er zerbrach
// daran sogar beim Laden). Der Bestand kommt jetzt aus `tests/support/i18nBestand.ts`.
import { describe, expect, it } from "vitest";
import { interviewSourceKey } from "../../apps/web/src/lib/interviewFlow";
import { alleSprachbestaende } from "../support/i18nBestand";

const SPRACHEN = alleSprachbestaende();

// Der Schlüssel wird NICHT abgeschrieben, sondern von der Stelle geholt, die ihn im Produkt
// auswählt: eine Umbenennung dort macht diesen Test rot, statt ihn ins Leere prüfen zu lassen.
const SCHLUESSEL = interviewSourceKey({ demo: true });

describe("JOB 3276 K · die Interview-Beschriftung sagt in Alltagssprache, was gilt", () => {
  it("K0 geprüft wird der Schlüssel, den das Produkt beim Fallback wirklich wählt", () => {
    expect(SCHLUESSEL).toBe("capture.ivFallback");
    // Gegenstück: mit Modell steht dort ein anderer Schlüssel — sonst prüfte K1 einen Text, der
    // auch im Erfolgsfall dastünde.
    expect(interviewSourceKey({ demo: false })).not.toBe(SCHLUESSEL);
  });

  for (const [sprache, tabelle] of Object.entries(SPRACHEN)) {
    it(`K1-${sprache} kein Fachwort mehr: weder „Fallback“ noch „deterministisch“`, () => {
      const text = tabelle[SCHLUESSEL] as string;
      expect(text.toLowerCase()).not.toContain("fallback");
      expect(text.toLowerCase()).not.toContain("determinist");
    });

    it(`K2-${sprache} sie nennt die festen Ersatzfragen UND den Stand der KI`, () => {
      const text = (tabelle[SCHLUESSEL] as string).toLowerCase();
      // Zwei Auskünfte, nicht eine: WAS der Mensch vor sich hat, und WARUM.
      const ersatzfragen = ["ersatzfragen", "backup questions", "reservevragen"];
      expect(
        ersatzfragen.some((w) => text.includes(w)),
        text,
      ).toBe(true);
      expect(text).toContain(sprache === "de" ? "ki" : "ai");
      // Ein Etikett bleibt ein Etikett: es steht in einer Pille neben der Frage.
      expect(text.length, text).toBeLessThanOrEqual(60);
    });
  }
});

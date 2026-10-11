// ================================================================================================
// Aufnahme 20260922 · antwort-quellenanzeige (Ben zu e6eb2409) — DER ANTEIL DIESES AUFTRAGS AM
// UMZUGSNACHWEIS W1, GETRENNT AUSGEWIESEN.
// ================================================================================================
//
// `aufteilung-unveraendert.test.ts` W1 vergleicht den zusammengefügten Wörterbuchtext Byte für Byte
// mit `i18n-vor-aufteilung.txt`. Dieser Auftrag hat danach ausdrücklich neue Produkttexte ergänzt
// (R-0326 Belegstelle, R-0310 „+N", R-0310/R-0325 zurückgehaltene Antwort). Sie stehen BENANNT in
// `tests/support/woerterbuchquelle.ts` (`ERGAENZTE_SCHLUESSEL`, `ERGAENZTE_KOMMENTARE`), und NUR der
// historische Vergleich (`woerterbuchQuelleHistorisch`, W1) nimmt genau sie heraus. Gemessen wird:
//   E1 · die Ergänzungen sind REINE Ergänzungen: keiner der Schlüssel stand vorher da, alle stehen
//        heute in de/en/nl mit Text — die Produkttexte bleiben erhalten.
//   E2 · nach dem Herausnehmen enthält der Vergleichstext keinen Schlüssel und keine Begründung
//        dieses Auftrags mehr; jede verbleibende Abweichung von W1 ist damit fremd — sie wird gezählt
//        und genannt, aber nicht diesem Auftrag zugerechnet.
//   E3 · fail-closed: fehlt ein Eintrag oder steht er doppelt, bricht das Herausnehmen ab.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { de } from "../../apps/web/src/woerterbuch/de";
import { en } from "../../apps/web/src/woerterbuch/en";
import { nl } from "../../apps/web/src/woerterbuch/nl";
import { repoPfad } from "../support/repoPfad";
import {
  ERGAENZTE_KOMMENTARE,
  ERGAENZTE_SCHLUESSEL,
  WOERTERBUCH_SPRACHEN,
  ohneErgaenzungen,
  woerterbuchBlock,
  woerterbuchQuelle,
  woerterbuchQuelleHistorisch,
  woerterbuchTeile,
} from "../support/woerterbuchquelle";

const VORHER = readFileSync(repoPfad("tests/i18n-woerterbuch/i18n-vor-aufteilung.txt"), "utf8");
const OBJEKTE: Record<string, Record<string, string>> = { de, en, nl };

describe("Aufnahme 20260922 · antwort-quellenanzeige — Wörterbuchergänzungen, vom Umzugsnachweis getrennt", () => {
  it("E1 · reine Ergänzungen: vorher keiner der Schlüssel, heute alle in de/en/nl mit Text", () => {
    for (const schluessel of ERGAENZTE_SCHLUESSEL) {
      expect(VORHER, `${schluessel} stand schon vor der Aufteilung da`).not.toContain(
        `"${schluessel}"`,
      );
      for (const sprache of WOERTERBUCH_SPRACHEN) {
        const wert = (OBJEKTE[sprache] as Record<string, string>)[schluessel] ?? "";
        expect(wert.trim().length, `${sprache}: ${schluessel} fehlt oder ist leer`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("E2 · nach dem Herausnehmen trägt der Vergleichstext nichts mehr von diesem Auftrag — der Rest von W1 ist fremd", () => {
    const text = woerterbuchQuelleHistorisch();
    for (const schluessel of ERGAENZTE_SCHLUESSEL) {
      expect(text, `${schluessel} steht noch im Vergleichstext`).not.toContain(`"${schluessel}"`);
    }
    for (const sprache of WOERTERBUCH_SPRACHEN) {
      for (const kommentar of ERGAENZTE_KOMMENTARE[sprache]) {
        expect(text.split("\n")).not.toContain(kommentar);
      }
    }
    // Getrennt ausgewiesen: was W1 danach noch unterscheidet, gehört NICHT zu diesem Auftrag.
    const vorher = new Set(VORHER.split("\n"));
    const fremd = text.split("\n").filter((z) => !vorher.has(z));
    const beispiele = fremd.length > 0 ? `, z. B.\n  ${fremd.slice(0, 8).join("\n  ")}` : "";
    console.log(
      `ANTWORT-QUELLENANZEIGE · W1-Rest ohne die Ergänzungen dieses Auftrags: ${fremd.length} fremde Zeilen${beispiele}`,
    );
  });

  it("E3 · fail-closed: ein fehlender oder doppelter Eintrag bricht das Herausnehmen ab", () => {
    const teile = woerterbuchTeile();
    const block = woerterbuchBlock("de", teile.de);
    // fehlt: der Schlüssel ist umbenannt
    expect(() =>
      ohneErgaenzungen("de", block.replace('"ask.quellen.weitere"', '"ask.quellen.andere"')),
    ).toThrow(/genau einmal/);
    // doppelt: dieselbe Zeile ein zweites Mal
    const zeile = block.split("\n").find((z) => z.startsWith('  "ask.quellen.weitere":')) ?? "";
    expect(zeile.length).toBeGreaterThan(0);
    expect(() => ohneErgaenzungen("de", `${block}\n${zeile}`)).toThrow(/genau einmal/);
  });

  it("E4 · nur der historische Vergleich nimmt heraus: der volle Text für alle übrigen Leser trägt die Ergänzungen weiter", () => {
    const voll = woerterbuchQuelle();
    for (const schluessel of ERGAENZTE_SCHLUESSEL) {
      // je Sprache einmal — de, en, nl
      expect(voll.split(`  "${schluessel}":`).length - 1, schluessel).toBe(3);
    }
  });
});

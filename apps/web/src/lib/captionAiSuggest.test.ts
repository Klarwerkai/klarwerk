import { describe, expect, it } from "vitest";
import type { DescribeImageResult } from "../api/types";
import { CAPTION_AI_TEXT, captionSuggestOutcome } from "./captionAiSuggest";

// WP-SHIP9-S2 (bens Folgeschnitt B4): co-lozierter Pure-Logic-Test (Muster duplicateCompare.i18n.test.ts).
// Der Bildbeschreibungs-Vorschlag zeigt den WAHREN Ausfallgrund — ein unbekannter Grund (u. a.
// "confidential") landete vorher im generischen Modellfehler-Text.
describe("WP-SHIP9-S2: captionSuggestOutcome — ehrlicher Ausfallgrund", () => {
  function result(over: Partial<DescribeImageResult>): DescribeImageResult {
    return { text: null, demo: true, ...over };
  }

  it("echtes Modell-Ergebnis → Vorschlag (kein Fallback)", () => {
    expect(captionSuggestOutcome(result({ demo: false, text: "Ein Ventil." }))).toEqual({
      kind: "suggestion",
      text: "Ein Ventil.",
    });
  });

  it("confidential → spezifischer Text, NICHT der generische Modellfehler", () => {
    expect(captionSuggestOutcome(result({ fallbackReason: "confidential" }))).toEqual({
      kind: "fallback",
      messageKey: CAPTION_AI_TEXT.fallbackConfidential,
    });
    // Abgrenzung: der confidential-Text ist ein ANDERER Key als der Fehler-Text.
    expect(CAPTION_AI_TEXT.fallbackConfidential).not.toBe(CAPTION_AI_TEXT.fallbackError);
  });

  it("alte Darstellungen unverändert: no-model / timeout / error", () => {
    // AUFTRAG-mega59 BLOCK G: hier stand dreimal `…).messageKey` DIREKT auf dem Rückgabewert. Der ist
    // eine unterschiedene Union (`{kind:"suggestion",text}` | `{kind:"fallback",messageKey}`), also
    // gibt es `messageKey` erst NACH der Verengung. Der Zugriff war ein echter Typfehler und lag
    // seit seiner Entstehung im blinden Fleck des Tors (apps/web lief in keinem `tsc`). Statt eines
    // `as`-Casts wird hier über `toEqual` auf die VOLLE Form geprüft — das ist typsicher UND sagt
    // zusätzlich, dass die Variante wirklich „fallback" ist und keinen Text mitschickt.
    expect(captionSuggestOutcome(result({ fallbackReason: "no-model" }))).toEqual({
      kind: "fallback",
      messageKey: CAPTION_AI_TEXT.fallbackNoModel,
    });
    expect(captionSuggestOutcome(result({ fallbackReason: "model-timeout" }))).toEqual({
      kind: "fallback",
      messageKey: CAPTION_AI_TEXT.fallbackTimeout,
    });
    expect(captionSuggestOutcome(result({ fallbackReason: "model-error" }))).toEqual({
      kind: "fallback",
      messageKey: CAPTION_AI_TEXT.fallbackError,
    });
  });
});

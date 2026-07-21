// WP-BILD-1c: UI-Logik des KI-Beschreibungs-Vorschlags an der Bild-Fußnote — PUR (DOM-frei):
// Knopf NUR im Editier-Modus mit fokussierter Fußnote und verdrahtetem Aufruf; Übernahme setzt
// den Text über die normale Editier-Mechanik (textContent); Größendeckel client-seitig gespiegelt;
// jeder KI-Fallback wird mit ehrlicher Ursache erklärt (DE/EN/NL).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPTION_AI_TEXT,
  MAX_CAPTION_IMAGE_DATAURL_CHARS,
  applyCaptionSuggestion,
  captionResponseApplicable,
  captionSuggestOutcome,
  captionSuggestVisible,
  checkCaptionImageDataUrl,
} from "../../apps/web/src/lib/captionAiSuggest";
import { MAX_DESCRIBE_IMAGE_DATAURL_CHARS } from "../../services/reasoner";

describe("WP-BILD-1c: Fußnoten-KI-Vorschlag (pure UI-Logik)", () => {
  it("der Knopf erscheint NUR im Editier-Modus, mit Fußnote und verdrahtetem Aufruf", () => {
    expect(captionSuggestVisible("edit", true, true)).toBe(true);
    // Leseansicht/Vorschau: NIE (Pedis Präzisierung — Vorschlag nur beim Bearbeiten).
    expect(captionSuggestVisible("preview", true, true)).toBe(false);
    // Ohne fokussierte Fußnote oder ohne Handler: kein toter Klick.
    expect(captionSuggestVisible("edit", false, true)).toBe(false);
    expect(captionSuggestVisible("edit", true, false)).toBe(false);
  });

  it("Übernehmen setzt den Vorschlag als Fußnoten-TEXT (normale Editier-Mechanik, kein HTML)", () => {
    const caption = { textContent: "alter Text" };
    applyCaptionSuggestion(caption, "Eine Kreiselpumpe auf dem Prüfstand.");
    expect(caption.textContent).toBe("Eine Kreiselpumpe auf dem Prüfstand.");
  });

  it("Modell-Text wird zum Vorschlag; jeder Fallback bekommt seine ehrliche Ursachen-Meldung", () => {
    expect(captionSuggestOutcome({ text: "Eine Pumpe.", demo: false })).toEqual({
      kind: "suggestion",
      text: "Eine Pumpe.",
    });
    expect(captionSuggestOutcome({ text: null, demo: true, fallbackReason: "no-model" })).toEqual({
      kind: "fallback",
      messageKey: CAPTION_AI_TEXT.fallbackNoModel,
    });
    expect(
      captionSuggestOutcome({ text: null, demo: true, fallbackReason: "model-timeout" }),
    ).toEqual({ kind: "fallback", messageKey: CAPTION_AI_TEXT.fallbackTimeout });
    expect(
      captionSuggestOutcome({ text: null, demo: true, fallbackReason: "model-error" }),
    ).toEqual({ kind: "fallback", messageKey: CAPTION_AI_TEXT.fallbackError });
    // Leere/Demo-Antworten werden NIE als Vorschlag angezeigt (kein Pseudo-Text).
    expect(captionSuggestOutcome({ text: null, demo: false }).kind).toBe("fallback");
    expect(captionSuggestOutcome({ text: "   ", demo: false }).kind).toBe("fallback");
  });

  it("Größendeckel: Client-Spiegel = Server-Deckel; zu groß/unlesbar → ehrliche Meldung, kein Upload", () => {
    expect(MAX_CAPTION_IMAGE_DATAURL_CHARS).toBe(MAX_DESCRIBE_IMAGE_DATAURL_CHARS);
    const ok = checkCaptionImageDataUrl("data:image/png;base64,AAAA");
    expect(ok.ok).toBe(true);
    const wrong = checkCaptionImageDataUrl("https://example.com/bild.png");
    expect(wrong).toEqual({ ok: false, messageKey: CAPTION_AI_TEXT.imageUnreadable });
    const huge = checkCaptionImageDataUrl(
      `data:image/png;base64,${"A".repeat(MAX_CAPTION_IMAGE_DATAURL_CHARS)}`,
    );
    expect(huge).toEqual({ ok: false, messageKey: CAPTION_AI_TEXT.tooLarge });
  });

  it("WP-BILD-1f (bens P1): eine Antwort ist NUR auf ihre unveränderte Ausgangs-Fußnote anwendbar", () => {
    const binding = { imageId: "kw-a", generation: 3 };
    // Ziel unverändert → anwendbar.
    expect(captionResponseApplicable(binding, { imageId: "kw-a", generation: 3 })).toBe(true);
    // Fußnoten-Wechsel (neue Generation) ODER andere data-image-id → still verwerfen.
    expect(captionResponseApplicable(binding, { imageId: "kw-a", generation: 4 })).toBe(false);
    expect(captionResponseApplicable(binding, { imageId: "kw-b", generation: 3 })).toBe(false);
    // Altbestand ohne data-image-id: Bindung läuft über die Generation.
    expect(
      captionResponseApplicable({ imageId: null, generation: 1 }, { imageId: null, generation: 1 }),
    ).toBe(true);
    expect(
      captionResponseApplicable({ imageId: null, generation: 1 }, { imageId: null, generation: 2 }),
    ).toBe(false);
  });

  it("alle Copy-Schlüssel existieren in DE, EN und NL (inkl. Cloud-KI-Kennzeichnung)", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of Object.values(CAPTION_AI_TEXT)) {
      const occurrences = i18n.split(`"${key}":`).length - 1;
      expect(`${key}:${occurrences}`).toBe(`${key}:3`);
    }
  });

  it("Editor-Verdrahtung: Sichtbarkeit läuft über captionSuggestVisible, Übernahme über applyCaptionSuggestion", () => {
    const editorSrc = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );
    // Der Knopf ist an die pure Sichtbarkeitsregel gebunden (kein eigener Zweitpfad im JSX) …
    expect(editorSrc).toContain(
      "captionSuggestVisible(mode, selectedCaption !== null, onDescribeImage !== undefined)",
    );
    // … die Übernahme nutzt die normale Editier-Mechanik (textContent + emit, kein innerHTML).
    expect(editorSrc).toContain("applyCaptionSuggestion(selectedCaption, captionAi.text)");
    expect(editorSrc).toContain("checkCaptionImageDataUrl(dataUrl)");
  });
});

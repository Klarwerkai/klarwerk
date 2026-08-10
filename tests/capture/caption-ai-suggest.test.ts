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
  applyCaptionHtml,
  captionResponseApplicable,
  captionSuggestOutcome,
  checkCaptionImageDataUrl,
} from "../../apps/web/src/lib/captionAiSuggest";
import { MAX_DESCRIBE_IMAGE_DATAURL_CHARS } from "../../services/reasoner";

describe("WP-BILD-1c: Fußnoten-KI-Vorschlag (pure UI-Logik)", () => {
  // AUFTRAG-mega84 Block A: Hier stand der Fall zu `captionSuggestVisible` — der Sichtbarkeitsregel
  // des INLINE-Vorschlagsknopfes an der fokussierten Fußnote. Diese Fläche gibt es nicht mehr (die
  // Fußnote ist der Einstieg ins Formular, nicht selbst ein Tippfeld), die Funktion damit auch nicht.
  // Ihre eine echte Zusage — „nie in der Leseansicht" — hält jetzt der Editor baulich: die
  // Verankerung, die die Fußnote überhaupt erst bedienbar macht, läuft ausschließlich im
  // Bearbeiten-Modus (gepinnt in editor-figure-caption-mounted).

  it("Übernehmen schreibt den Vorschlag als sanitisiertes Fußnoten-HTML (Formatierung bleibt erhalten)", () => {
    // AUFTRAG-mega84 Block B: die Fußnote trägt seit heute fett/kursiv/Umbruch — geschrieben wird
    // deshalb innerHTML statt textContent. Was hier ankommt, ist immer schon durch
    // `sanitizeCaptionHtml` gelaufen (siehe richText-Fälle).
    const caption = { innerHTML: "<em>alter</em> Text" };
    applyCaptionHtml(caption, "Eine <strong>Kreiselpumpe</strong> auf dem Prüfstand.");
    expect(caption.innerHTML).toBe("Eine <strong>Kreiselpumpe</strong> auf dem Prüfstand.");
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
    // WP-SHIP9-S2 (bens Folgeschnitt B4): vertraulichkeitsbedingter Cloud-Ausschluss bekommt seinen
    // EIGENEN, wahren Text — nicht mehr den generischen Modellfehler.
    expect(
      captionSuggestOutcome({ text: null, demo: true, fallbackReason: "confidential" }),
    ).toEqual({ kind: "fallback", messageKey: CAPTION_AI_TEXT.fallbackConfidential });
    expect(CAPTION_AI_TEXT.fallbackConfidential).not.toBe(CAPTION_AI_TEXT.fallbackError);
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

  it("Editor-Verdrahtung: EIN Weg in das Formular, EIN describe-Aufruf, Übernahme über applyCaptionHtml", () => {
    const editorSrc = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );
    // AUFTRAG-mega84 Block A: hier stand der Pin auf `captionSuggestVisible(mode, selectedCaption
    // !== null, true)` — die Sichtbarkeitsregel der INLINE-Vorschlagsleiste an der fokussierten
    // Fußnote. Diese Leiste gibt es nicht mehr: die Fußnote ist kein Editing-Host, sie hat keinen
    // Cursor, und ihr Klick öffnet das Formular. Ein Pin auf eine Bedingung, die nie mehr wahr
    // werden kann, wäre ein grüner Test über eine tote Fläche.
    expect(editorSrc).not.toContain("captionSuggestVisible");
    // Der Zustand dahinter ist ebenfalls weg — geprüft am Quelltext OHNE Kommentare, sonst schlüge
    // die Erklärung des Umbaus als Fundstelle durch (Muster aus dem mega50-Sammler).
    const ohneKommentare = editorSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(ohneKommentare).not.toContain("selectedCaption");

    // Was an ihre Stelle tritt: ALLE Wege ins Formular laufen durch EINE Funktion. Das ist der
    // bauliche Grund, warum es weiterhin nur ein Formular gibt — Klick auf die Beschreibung,
    // Tastatur, der Knopf der Bild-Werkzeugleiste und die Galerie-Bitte (mega69).
    expect(editorSrc).toContain(
      "const openCaptionFormForCaption = (caption: HTMLElement): void =>",
    );
    expect((editorSrc.match(/openCaptionFormForCaption\(/g) ?? []).length).toBeGreaterThanOrEqual(
      3,
    );

    // AUFTRAG-mega84 Block B: geschrieben wird HTML (fett/kursiv/Umbruch), aber ausschließlich
    // sanitisiertes — und die Grenze zählt Klartext, nicht Markup.
    expect(editorSrc).toContain("applyCaptionHtml(");
    expect(editorSrc).toContain("sanitizeCaptionHtml(");
    expect(editorSrc).toContain("capCaptionHtml(");

    // Unverändert: EIN describe-Aufruf mit EINER Deckelprüfung davor.
    expect(editorSrc).toContain("checkCaptionImageDataUrl(dataUrl)");
    expect((editorSrc.match(/imageDescribe\.describe\(/g) ?? []).length).toBe(1);
  });
});

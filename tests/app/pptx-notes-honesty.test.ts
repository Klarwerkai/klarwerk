// WP-D5b (bens ROT-Fix 2): Ehrlichkeit der PPTX-Meldungen. Zur LESEZEIT (importNote.pptx) und im
// LEERFALL (emptyPptx) ist noch NICHTS hochgeladen — die Meldung darf also KEINEN „Original im Anhang"
// behaupten. Die Anhangs-Aussage fällt nur dort, wo originalAttached === true wirklich feststeht
// (post-save, D1d/D1e-Notice-Mechanik). Diese Tests pinnen die Texte DE/EN/NL mit Negativ-Regex.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";

const LANGS = ["de", "en", "nl"] as const;
// Positive Anhangs-Behauptungen, die in Lese-/Leerfall-Meldungen NICHT vorkommen dürfen.
const ATTACHMENT_CLAIM = /liegt im Anhang|im Anhang|in the attachment|zit in de bijlage/i;

function resource(lng: string, key: string): string {
  return String(i18n.getResource(lng, "translation", key));
}

describe("WP-D5b: importNote.pptx behauptet zur Lesezeit KEINEN Anhang", () => {
  it("nennt nur den Formatverlust, keine Anhangs-Zusage (DE/EN/NL)", () => {
    for (const lng of LANGS) {
      const note = resource(lng, CAPTURE_FILE_TEXT.importNotePptx);
      expect(note.length, `${lng}`).toBeGreaterThan(0);
      expect(note, `${lng}`).not.toMatch(ATTACHMENT_CLAIM);
    }
    // DE nennt weiterhin ehrlich den Verlust (Layout/Bilder).
    const de = resource("de", CAPTURE_FILE_TEXT.importNotePptx);
    expect(de).toMatch(/gehen verloren/);
  });
});

describe("WP-D5b: emptyPptx behauptet KEINEN Anhang (im Leerfall wird nichts gespeichert)", () => {
  it("keine Anhangs-Zusage; sagt ehrlich, dass nichts gespeichert wurde (DE/EN/NL)", () => {
    for (const lng of LANGS) {
      const note = resource(lng, CAPTURE_FILE_TEXT.emptyPptx);
      expect(note.length, `${lng}`).toBeGreaterThan(0);
      expect(note, `${lng}`).not.toMatch(ATTACHMENT_CLAIM);
    }
    // DE macht die Nicht-Speicherung explizit.
    const de = resource("de", CAPTURE_FILE_TEXT.emptyPptx);
    expect(de).toMatch(/nichts gespeichert/i);
  });
});

describe("WP-D5b: pptxTooLarge ist ein ehrlicher, spezifischer Fehler (DE/EN/NL)", () => {
  it("existiert in allen Sprachen und sagt klar, dass NICHT gelesen wurde", () => {
    for (const lng of LANGS) {
      const msg = resource(lng, CAPTURE_FILE_TEXT.pptxTooLarge);
      expect(msg.length, `${lng}`).toBeGreaterThan(0);
    }
    expect(resource("de", CAPTURE_FILE_TEXT.pptxTooLarge)).toMatch(/NICHT gelesen/);
    expect(resource("en", CAPTURE_FILE_TEXT.pptxTooLarge)).toMatch(/NOT read/);
    expect(resource("nl", CAPTURE_FILE_TEXT.pptxTooLarge)).toMatch(/NIET gelezen/);
  });
});

// WP-D9: PPTX-Bild-Import — Ehrlichkeit der neuen Meldungen + Capture-Verdrahtung.
describe("WP-D9: Bild-Import-Ehrlichkeit (Meldungen + Verdrahtung)", () => {
  it("importNote.pptx nennt Bilder jetzt als ÜBERNOMMEN, weiter ehrlichen Restverlust, keinen Anhang", () => {
    for (const lng of LANGS) {
      const note = resource(lng, CAPTURE_FILE_TEXT.importNotePptx);
      expect(note, lng).not.toMatch(ATTACHMENT_CLAIM);
    }
    const de = resource("de", CAPTURE_FILE_TEXT.importNotePptx);
    expect(de).toMatch(/Bilder je Folie übernommen/);
    expect(de).toMatch(/gehen verloren/); // Layout/Animationen/Notizen bleiben ehrlich benannt
    expect(de).not.toMatch(/Bilder und Sprechernotizen gehen verloren/);
  });

  it("Teilverlust-Hinweise (Format/Budget) existieren DE/EN/NL mit Anzahl", () => {
    for (const lng of LANGS) {
      for (const key of [CAPTURE_FILE_TEXT.pptxImagesFormat, CAPTURE_FILE_TEXT.pptxImagesBudget]) {
        const msg = resource(lng, key);
        expect(msg.length, `${lng}:${key}`).toBeGreaterThan(0);
        expect(msg, `${lng}:${key}`).toContain("{{count}}");
      }
    }
  });

  it("Capture reicht den DOCX-Platzhalter-Key an readPptxRich durch (kein Key-Duplikat)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    expect(src).toContain("readPptxRich(f, t(CAPTURE_FILE_TEXT.imageCaptionPlaceholder))");
    expect(src).toContain("CAPTURE_FILE_TEXT.pptxImagesFormat");
    expect(src).toContain("CAPTURE_FILE_TEXT.pptxImagesBudget");
  });
});

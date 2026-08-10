// WP-D5b (bens ROT-Fix 2): Ehrlichkeit der PPTX-Meldungen. Zur LESEZEIT (importNote.pptx) und im
// LEERFALL (emptyPptx) ist noch NICHTS hochgeladen — die Meldung darf also KEINEN „Original im Anhang"
// behaupten. Die Anhangs-Aussage fällt nur dort, wo originalAttached === true wirklich feststeht
// (post-save, D1d/D1e-Notice-Mechanik). Diese Tests pinnen die Texte DE/EN/NL mit Negativ-Regex.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_FILE_TEXT,
  imageTransferCauseNotices,
  imageTransferSummary,
} from "../../apps/web/src/lib/captureFromFile";
import { imageTransferContract } from "../../apps/web/src/lib/docx";

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
  });

  // ============================================================================================
  // JOB 513/D3C — DIE TEILVERLUST-VERDRAHTUNG WIRD DORT GEPRÜFT, WO SIE JETZT LEBT.
  // ============================================================================================
  // Bis D3B stand hier ein Quelltext-Pin auf `CAPTURE_FILE_TEXT.pptxImagesFormat`/`.pptxImagesBudget`
  // in `Capture.tsx`. Er hat genau so lange getragen, wie die Oberfläche die Verlustsätze von Hand
  // zusammenbaute — und dabei nur zwei der fünf realen Gründe kannte und die wirkende Grenze nie nannte.
  // Die Ownerentscheidung (Option b) löst diesen Pfad ab: die Gründe kommen aus dem Bildtransfer-VERTRAG.
  //
  // Der Pin wird deshalb nicht gelockert, sondern VERSCHÄRFT: statt zu prüfen, ob zwei Zeichenketten
  // irgendwo im Consumer stehen, wird jetzt am realen Vertrag gemessen, dass die Sätze bei den
  // zutreffenden Zählern WIRKLICH entstehen — und dass der alte Handbau nicht zurückkehrt.
  it("die Teilverlust-Gründe entstehen aus dem Vertrag, mit den realen Zahlen", () => {
    const c = imageTransferContract({
      attempted: true,
      totalImages: 4,
      embeddedImages: 1,
      droppedImageBudget: 1,
      droppedImageFormat: 2,
      bodyBytes: 500,
      bodyBudgetBytes: 3_500_000,
      bodyOverflow: false,
      budgetDrops: [
        { kind: "pptx-single-image", limitBytes: 5_242_880, actualBytes: 6_000_000, count: 1 },
      ],
    });
    const keys = imageTransferCauseNotices(c).map((n) => n.key);
    // Beide historisch gepinnten Schlüssel MÜSSEN weiterhin real erzeugt werden.
    expect(keys).toContain(CAPTURE_FILE_TEXT.pptxImagesBudget);
    expect(keys).toContain(CAPTURE_FILE_TEXT.pptxImagesFormat);
    // …mit den echten Zählern, nicht bloß vorhanden.
    const budget = imageTransferCauseNotices(c).find(
      (n) => n.key === CAPTURE_FILE_TEXT.pptxImagesBudget,
    );
    const format = imageTransferCauseNotices(c).find(
      (n) => n.key === CAPTURE_FILE_TEXT.pptxImagesFormat,
    );
    expect(budget?.params.count).toBe(1);
    expect(format?.params.count).toBe(2);
    // Und zusätzlich die Grenzart mit ihrem REALEN Wert — das konnte der alte Handbau nie.
    const limit = imageTransferCauseNotices(c).find(
      (n) => n.key === CAPTURE_FILE_TEXT.imagesBudgetSingleImage,
    );
    expect(limit?.params.limitBytes).toBe(5_242_880);
    expect(limit?.params.actualBytes).toBe(6_000_000);
  });

  it("die Lib ist die Quelle der Verlustsätze — der Consumer baut sie nicht mehr von Hand", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const lib = readFileSync(resolve(process.cwd(), "apps/web/src/lib/captureFromFile.ts"), "utf8");
    expect(lib).toContain("CAPTURE_FILE_TEXT.pptxImagesFormat");
    expect(lib).toContain("CAPTURE_FILE_TEXT.pptxImagesBudget");
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    // Der Consumer rendert die Gründe des Vertrags …
    expect(src).toContain("imageTransferCauseNotices(imageTransfer)");
    expect(src).toContain("imageTransferSummary(imageTransfer, { originalAttached })");
    // … und die abgelöste Bilanz-/Noticemechanik darf NICHT zurückkehren.
    expect(src).not.toContain("importImageNotice(");
    expect(src).not.toContain("imagesOnlyNoticeKey(");
  });

  // WP-D5b-Kernversprechen dieser Datei, jetzt auch für die neuen Sätze: zur Lesezeit ist NICHTS
  // hochgeladen, und ohne gesichertes Original darf kein Satz einen Anhang behaupten.
  it("kein Verlustgrund behauptet einen Anhang (DE/EN/NL)", () => {
    const causeKeys = [
      CAPTURE_FILE_TEXT.pptxImagesFormat,
      CAPTURE_FILE_TEXT.pptxImagesBudget,
      CAPTURE_FILE_TEXT.imagesDefect,
      CAPTURE_FILE_TEXT.imagesOutsidePath,
      CAPTURE_FILE_TEXT.imagesBudgetBodyHtml,
      CAPTURE_FILE_TEXT.imagesBudgetSingleImage,
      CAPTURE_FILE_TEXT.imagesBudgetTotalImages,
    ];
    for (const lng of LANGS) {
      for (const key of causeKeys) {
        const msg = resource(lng, key);
        expect(msg.length, `${lng}:${key}`).toBeGreaterThan(0);
        expect(msg, `${lng}:${key}`).not.toMatch(ATTACHMENT_CLAIM);
      }
    }
  });

  it("ohne gesichertes Original behauptet auch der All-dropped-Satz keinen Anhang", () => {
    const c = imageTransferContract({
      attempted: true,
      totalImages: 1,
      embeddedImages: 0,
      droppedImageBudget: 1,
      bodyBytes: 100,
      bodyBudgetBytes: 3_500_000,
      bodyOverflow: false,
    });
    const keys = imageTransferSummary(c, { originalAttached: false }).notices.map((n) => n.key);
    expect(keys).toContain(CAPTURE_FILE_TEXT.imagesAllDroppedNoOriginal);
    expect(keys).not.toContain(CAPTURE_FILE_TEXT.imagesAllDropped);
    for (const lng of LANGS) {
      expect(resource(lng, CAPTURE_FILE_TEXT.imagesAllDroppedNoOriginal), lng).not.toMatch(
        ATTACHMENT_CLAIM,
      );
    }
    // Gegenprobe: MIT gesichertem Original darf die Anhangs-Zusage stehen — sie ist dann gedeckt.
    const withOriginal = imageTransferSummary(c, { originalAttached: true }).notices.map(
      (n) => n.key,
    );
    expect(withOriginal).toContain(CAPTURE_FILE_TEXT.imagesAllDropped);
  });
});

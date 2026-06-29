import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ATTACH_FILES_KEY,
  ATTACH_FILE_HINT_KEY,
  ATTACH_IMAGES_KEY,
  ATTACH_IMAGE_HINT_KEY,
  ATTACH_TITLE_KEY,
  attachmentContext,
  isImageAttachment,
} from "../../apps/web/src/lib/editorAttachmentContext";

// SCRUM-323: DOM-freie Klassifikation der Anhänge (Bilder einfügbar vs. Dateien Anhang/Evidence).
describe("SCRUM-323: editorAttachmentContext", () => {
  it("keine Anhänge → leerer Zustand", () => {
    expect(attachmentContext([])).toEqual({
      imageCount: 0,
      fileCount: 0,
      total: 0,
      hasAny: false,
    });
  });

  it("nur Bilder → image count, keine Dateien", () => {
    const ctx = attachmentContext([{ mime: "image/png" }, { mime: "image/jpeg" }]);
    expect(ctx).toEqual({ imageCount: 2, fileCount: 0, total: 2, hasAny: true });
  });

  it("nur Dateien → file count, keine Bilder (keine Inline-Behauptung)", () => {
    const ctx = attachmentContext([{ mime: "application/pdf" }, { mime: "text/plain" }]);
    expect(ctx).toEqual({ imageCount: 0, fileCount: 2, total: 2, hasAny: true });
  });

  it("gemischt → beide Counts", () => {
    const ctx = attachmentContext([
      { mime: "image/webp" },
      { mime: "application/pdf" },
      { mime: "image/gif" },
    ]);
    expect(ctx).toEqual({ imageCount: 2, fileCount: 1, total: 3, hasAny: true });
  });

  it("defensiv: fehlende/leere/ungültige mime gelten als Datei (nicht Bild)", () => {
    expect(isImageAttachment({ mime: null })).toBe(false);
    expect(isImageAttachment({ mime: undefined })).toBe(false);
    expect(isImageAttachment({ mime: "" })).toBe(false);
    expect(isImageAttachment({})).toBe(false);
    expect(isImageAttachment({ mime: "IMAGE/PNG" })).toBe(true); // case-insensitiv
    const ctx = attachmentContext([{ mime: null }, {}, { mime: "image/png" }]);
    expect(ctx).toEqual({ imageCount: 1, fileCount: 2, total: 3, hasAny: true });
  });

  it("liefert stabile i18n-Keys, alle DE+EN vorhanden", () => {
    const keys = [
      ATTACH_TITLE_KEY,
      ATTACH_IMAGES_KEY,
      ATTACH_FILES_KEY,
      ATTACH_IMAGE_HINT_KEY,
      ATTACH_FILE_HINT_KEY,
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: Datei-Hinweis behauptet kein Inline-Einbetten (DE)", () => {
    const fileHint = String(i18n.getResource("de", "translation", ATTACH_FILE_HINT_KEY) ?? "");
    expect(fileHint).toMatch(/nicht inline/i);
  });
});

import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  MEDIA_EVIDENCE_HINT_KEY,
  MEDIA_EVIDENCE_KEY,
  MEDIA_IMAGES_KEY,
  MEDIA_IMAGE_HINT_KEY,
  MEDIA_LINKABLE_HINT_KEY,
  MEDIA_LINKABLE_KEY,
  MEDIA_NOTE_KEY,
  MEDIA_TITLE_KEY,
  editorMediaGuide,
} from "../../apps/web/src/lib/editorAttachmentContext";

// SCRUM-371 / AG-02-SESSION / AG-12/13: object-store-bewusste Media-/Evidence-Führung. Bilder (inline)
// vs. verlinkbare Dateien (objectId) vs. Session-Dateien (Evidence, kein Fake-Link). DOM-frei/testbar.
describe("SCRUM-371: editorMediaGuide", () => {
  it("keine Anhänge → leerer Zustand", () => {
    expect(editorMediaGuide([])).toEqual({
      inlineImages: 0,
      linkableFiles: 0,
      evidenceFiles: 0,
      total: 0,
      hasAny: false,
      hasImages: false,
      hasLinkableFiles: false,
      hasEvidenceFiles: false,
    });
  });

  it("Bilder zählen als inline — unabhängig von objectId (Object-Store ODER data:image)", () => {
    const g = editorMediaGuide([
      { mime: "image/png", objectId: "obj-1" },
      { mime: "image/jpeg" }, // Session-Bild ohne objectId — trotzdem einbettbar (data:image)
    ]);
    expect(g.inlineImages).toBe(2);
    expect(g.linkableFiles).toBe(0);
    expect(g.evidenceFiles).toBe(0);
  });

  it("Nicht-Bild MIT objectId → verlinkbar; OHNE objectId → Evidence (kein Fake-Link)", () => {
    const g = editorMediaGuide([
      { mime: "application/pdf", objectId: "obj-2" }, // gespeichert → verlinkbar
      { mime: "text/plain" }, // Session-Datei ohne objectId → Evidence
      { mime: null }, // defensiv: keine mime, keine objectId → Evidence
    ]);
    expect(g.linkableFiles).toBe(1);
    expect(g.evidenceFiles).toBe(2);
    expect(g.inlineImages).toBe(0);
  });

  it("leere/whitespace objectId gilt als NICHT verlinkbar (Evidence)", () => {
    const g = editorMediaGuide([
      { mime: "application/pdf", objectId: "   " },
      { mime: "application/pdf", objectId: "" },
      { mime: "application/pdf", objectId: null },
    ]);
    expect(g.linkableFiles).toBe(0);
    expect(g.evidenceFiles).toBe(3);
  });

  it("gemischt → alle drei Kategorien korrekt + Flags", () => {
    const g = editorMediaGuide([
      { mime: "image/webp" },
      { mime: "application/pdf", objectId: "obj-3" },
      { mime: "application/zip" },
    ]);
    expect(g).toEqual({
      inlineImages: 1,
      linkableFiles: 1,
      evidenceFiles: 1,
      total: 3,
      hasAny: true,
      hasImages: true,
      hasLinkableFiles: true,
      hasEvidenceFiles: true,
    });
  });

  it("alle Media-/Evidence-Texte sind DE und EN vorhanden (keine leeren Keys)", () => {
    const keys = [
      MEDIA_TITLE_KEY,
      MEDIA_IMAGES_KEY,
      MEDIA_IMAGE_HINT_KEY,
      MEDIA_LINKABLE_KEY,
      MEDIA_LINKABLE_HINT_KEY,
      MEDIA_EVIDENCE_KEY,
      MEDIA_EVIDENCE_HINT_KEY,
      MEDIA_NOTE_KEY,
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: Evidence ist keine Freigabe — Validierung entscheidet (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", MEDIA_NOTE_KEY) ?? "")).toMatch(
      /keine Freigabe|Validierung entscheidet/i,
    );
    expect(String(i18n.getResource("en", "translation", MEDIA_NOTE_KEY) ?? "")).toMatch(
      /not approval|review decides/i,
    );
  });

  it("ehrlich: Session-Datei wird erst nach dem Speichern verlinkbar — kein Behelfs-Link (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", MEDIA_EVIDENCE_HINT_KEY) ?? "")).toMatch(
      /nach dem Speichern|kein Behelfs/i,
    );
    expect(String(i18n.getResource("en", "translation", MEDIA_EVIDENCE_HINT_KEY) ?? "")).toMatch(
      /after saving|no makeshift|fake link/i,
    );
  });
});

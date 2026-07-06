import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  EDITOR_DROP_KEYS,
  isInsertableImageMime,
  partitionDropMedia,
} from "../../apps/web/src/lib/editorDropPaste";

// SCRUM-372 / AG-P2-1 / FR-STR-03: DOM-freie Drop/Paste-Klassifikation. Nur sichere Rasterbilder werden
// inline eingebettet; alles andere (inkl. SVG) bleibt Evidence — kein Fake-Link. Testbar ohne Browser.
describe("SCRUM-372: editorDropPaste", () => {
  it("nur Rasterbilder gelten als einbettbar (case-insensitiv)", () => {
    for (const mime of ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]) {
      expect(isInsertableImageMime(mime)).toBe(true);
    }
    expect(isInsertableImageMime("IMAGE/PNG")).toBe(true);
    expect(isInsertableImageMime(" image/webp ")).toBe(true);
  });

  it("SVG ist bewusst NICHT einbettbar (XSS-Schutz, deckt sich mit Sanitizer)", () => {
    expect(isInsertableImageMime("image/svg+xml")).toBe(false);
  });

  it("Nicht-Bilder / leer / null sind nicht einbettbar", () => {
    for (const mime of ["application/pdf", "text/plain", "application/zip", "", "   "]) {
      expect(isInsertableImageMime(mime)).toBe(false);
    }
    expect(isInsertableImageMime(null)).toBe(false);
    expect(isInsertableImageMime(undefined)).toBe(false);
  });

  it("partitionDropMedia trennt einbettbare Bilder von Evidence-Dateien (SVG → Datei)", () => {
    const part = partitionDropMedia([
      { mime: "image/png" },
      { mime: "image/svg+xml" }, // Sicherheit: NICHT als Bild einbetten
      { mime: "application/pdf" },
      { mime: "image/webp" },
    ]);
    expect(part.imageCount).toBe(2);
    expect(part.fileCount).toBe(2);
    expect(part.hasImages).toBe(true);
    expect(part.hasFiles).toBe(true);
    expect(part.hasAny).toBe(true);
  });

  it("leere Liste → nichts einbettbar, keine Datei-Notiz", () => {
    const part = partitionDropMedia([]);
    expect(part).toMatchObject({
      imageCount: 0,
      fileCount: 0,
      hasImages: false,
      hasFiles: false,
      hasAny: false,
    });
  });

  it("erhält Zusatzfelder generisch (z. B. das echte File-Objekt für den Insert)", () => {
    const marker = { mime: "image/png", tag: "x" as const };
    const part = partitionDropMedia([marker]);
    expect(part.images[0]).toBe(marker);
  });

  it("alle Drop/Paste-Führungstexte sind DE und EN vorhanden (keine leeren Keys)", () => {
    for (const key of Object.values(EDITOR_DROP_KEYS)) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: Datei-Hinweis verspricht keinen Body-Link — Evidence, kein Fake-Link, Prüfung entscheidet (DE/EN)", () => {
    expect(
      String(i18n.getResource("de", "translation", EDITOR_DROP_KEYS.fileNotice) ?? ""),
    ).toMatch(/Evidence|kein Fake-Link|Validierung entscheidet/i);
    expect(
      String(i18n.getResource("en", "translation", EDITOR_DROP_KEYS.fileNotice) ?? ""),
    ).toMatch(/evidence|no fake link|review decides/i);
  });
});

// SCRUM-456 (Pedi/VIP 06.07.): Der „Bild"-Knopf kann jetzt auch ein NEUES Bild vom Rechner
// einfügen — über exakt dieselbe sichere Klassifikation wie Drop/Einfügen. Hier abgesichert:
// die Auswahl akzeptiert Rasterbilder und weist SVG/Nicht-Bilder ab; die Menü-Texte lösen auf.
describe("SCRUM-456: Bild vom Rechner (Finder) nutzt dieselbe sichere Klassifikation", () => {
  it("aus dem Finder gewählte Rasterbilder sind einbettbar, SVG/Nicht-Bild bleiben Evidence", () => {
    const picked = partitionDropMedia([
      { mime: "image/png" },
      { mime: "image/jpeg" },
      { mime: "image/svg+xml" }, // Finder-Auswahl darf SVG NICHT einbetten (XSS-Schutz)
      { mime: "application/pdf" },
    ]);
    expect(picked.imageCount).toBe(2);
    expect(picked.fileCount).toBe(2);
    expect(picked.hasFiles).toBe(true);
  });

  it("Menü-Texte für Finder + Anhänge lösen in DE und EN auf", () => {
    for (const key of ["editor.imageFromDisk", "editor.imageFromAttachment"]) {
      for (const lng of ["de", "en"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

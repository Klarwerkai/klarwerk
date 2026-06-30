import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  STUDIO_EDITOR_VIEWS,
  type StudioEditorView,
  studioEditorViewLabelKey,
  studioPreviewState,
} from "../../apps/web/src/lib/knowledgeStudioPreview";

// SCRUM-346: DOM-freie Live-Vorschau / Apply-Review-Beschreibung des Knowledge Input Studio.
describe("SCRUM-346: knowledgeStudioPreview", () => {
  it("liefert die beiden Views in fester Reihenfolge (erst Bearbeiten, dann Vorschau)", () => {
    expect(STUDIO_EDITOR_VIEWS).toEqual<StudioEditorView[]>(["edit", "preview"]);
  });

  it("labelKey folgt dem stabilen Schema studio.view.<view>", () => {
    for (const v of STUDIO_EDITOR_VIEWS) {
      expect(studioEditorViewLabelKey(v)).toBe(`studio.view.${v}`);
    }
  });

  it("leerer Entwurf → kein Body, kein Block, ehrlicher Leer-Hinweis-Key", () => {
    for (const draft of ["", "   ", "<p></p>", null, undefined]) {
      const state = studioPreviewState(draft);
      expect(state.hasBody).toBe(false);
      expect(state.hasBlocks).toBe(false);
      expect(state.emptyHintKey).toBe("studio.preview.empty");
    }
  });

  it("Body mit Text → hasBody, kein Leer-Hinweis; Body mit Panel → hasBlocks", () => {
    const plain = studioPreviewState("<p>Inhalt</p>");
    expect(plain.hasBody).toBe(true);
    expect(plain.hasBlocks).toBe(false);
    expect(plain.emptyHintKey).toBeNull();

    const withBlock = studioPreviewState('<div class="panel panel-info"><p>Hinweis</p></div>');
    expect(withBlock.hasBody).toBe(true);
    expect(withBlock.hasBlocks).toBe(true);
    expect(withBlock.emptyHintKey).toBeNull();
  });

  it("View-Labels + Preview-Texte sind DE und EN vorhanden (keine leeren Keys)", () => {
    const keys = [
      ...STUDIO_EDITOR_VIEWS.map((v) => studioEditorViewLabelKey(v)),
      "studio.preview.empty",
      "studio.preview.note",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("bleibt ehrlich: Vorschau-Hinweis verspricht keine Validierung/Freigabe (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", "studio.preview.note") ?? "")).toMatch(
      /kein validiertes Wissen/i,
    );
    expect(String(i18n.getResource("en", "translation", "studio.preview.note") ?? "")).toMatch(
      /not validated knowledge/i,
    );
  });
});

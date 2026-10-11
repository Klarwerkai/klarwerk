import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type KnowledgeStudioSectionId,
  knowledgeStudioSectionLabelKey,
} from "../../apps/web/src/lib/knowledgeStudioLayout";

// SCRUM-341: Workspace-Layout des Knowledge Input Studio — drei stabile Bereiche (DOM-frei).
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Die Tabelle `KNOWLEDGE_STUDIO_SECTIONS` und ihr Zugriff
// `knowledgeStudioSections()` hatten keinen Produktleser und sind entfernt. Gemessen bleibt der
// Schlüsselbau, den das Studio ruft; die drei Bereiche stehen hier als Prüfliste.
const BEREICHE: readonly KnowledgeStudioSectionId[] = ["context", "editor", "assist"];

describe("SCRUM-341: knowledgeStudioLayout", () => {
  it("baut stabile labelKeys je Bereich", () => {
    expect(knowledgeStudioSectionLabelKey("context")).toBe("studio.section.context");
    expect(knowledgeStudioSectionLabelKey("editor")).toBe("studio.section.editor");
    expect(knowledgeStudioSectionLabelKey("assist")).toBe("studio.section.assist");
  });

  it("Bereichs-i18n (studio.section.*) DE+EN vorhanden", () => {
    for (const id of BEREICHE) {
      for (const lng of ["de", "en"]) {
        expect(
          String(i18n.getResource(lng, "translation", knowledgeStudioSectionLabelKey(id)) ?? "")
            .length,
        ).toBeGreaterThan(0);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  hasEditableContent,
  knowledgeStudioState,
  shouldWarnBeforeReplace,
  studioSaveConfidence,
  templateApplyMode,
  templateApplyModeHintKey,
} from "../../apps/web/src/lib/editorApplySafety";

describe("SCRUM-320: editor apply safety", () => {
  it("detects editable content for replace warnings", () => {
    expect(hasEditableContent("")).toBe(false);
    expect(hasEditableContent("   ")).toBe(false);
    expect(hasEditableContent("Schon Inhalt")).toBe(true);
    expect(shouldWarnBeforeReplace("Schon Inhalt")).toBe(true);
  });

  it("distinguishes setting a template from appending it", () => {
    expect(templateApplyMode("")).toBe("set");
    expect(templateApplyMode("<p></p>")).toBe("set");
    expect(templateApplyMode("<p>Bestand</p>")).toBe("append");
  });

  it("maps template modes to stable i18n keys", () => {
    expect(templateApplyModeHintKey("set")).toBe("editor.template.mode.set");
    expect(templateApplyModeHintKey("append")).toBe("editor.template.mode.append");
  });

  it("has German and English safety copy", () => {
    const keys = [
      "editor.template.mode.set",
      "editor.template.mode.append",
      "editor.applySafety.replaceWarning",
    ];
    for (const lng of ["de", "en"]) {
      for (const key of keys) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "")).not.toBe("");
      }
    }
  });
});

// SCRUM-339: Knowledge-Studio Dirty-State + Discard-Schutz + Apply-Feedback (DOM-frei).
describe("SCRUM-339: knowledgeStudioState", () => {
  it("dirty, wenn der Studio-Entwurf vom übernommenen Body abweicht", () => {
    const s = knowledgeStudioState("<p>neu</p>", "<p>alt</p>");
    expect(s.dirty).toBe(true);
    expect(s.statusKey).toBe("studio.state.dirty");
    expect(s.tone).toBe("warn");
  });

  it("clean, wenn Entwurf und übernommener Body identisch sind (auch leer)", () => {
    expect(knowledgeStudioState("<p>x</p>", "<p>x</p>")).toMatchObject({
      dirty: false,
      statusKey: "studio.state.clean",
      tone: "neutral",
    });
    expect(knowledgeStudioState("", "").dirty).toBe(false);
  });

  it("Studio-Safety-i18n (state/confirmDiscard/applied) DE+EN vorhanden", () => {
    const keys = [
      "studio.state.dirty",
      "studio.state.clean",
      "studio.confirmDiscard.q",
      "studio.confirmDiscard.keep",
      "studio.confirmDiscard.discard",
      "studio.applied",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: studio.applied behauptet kein Auto-Speichern (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", "studio.applied") ?? "")).toMatch(
      /kein|nichts wird automatisch/i,
    );
    expect(String(i18n.getResource("en", "translation", "studio.applied") ?? "")).toMatch(
      /nothing is saved or validated automatically/i,
    );
  });
});

// SCRUM-344: Save-Confidence-Hinweis nach Studio-Apply vor dem finalen Speichern/Revidieren.
describe("SCRUM-344: studioSaveConfidence", () => {
  it("liefert kontextbezogene title/hint/nextStep-Keys + Tönung", () => {
    const cap = studioSaveConfidence("capture");
    expect(cap).toMatchObject({
      titleKey: "studio.save.capture.title",
      hintKey: "studio.save.capture.hint",
      nextStepKey: "studio.save.capture.next",
      tone: "warn",
    });
    const rev = studioSaveConfidence("revision");
    expect(rev).toMatchObject({
      titleKey: "studio.save.revision.title",
      hintKey: "studio.save.revision.hint",
      nextStepKey: "studio.save.revision.next",
      tone: "warn",
    });
  });

  it("Save-Confidence-i18n (capture + revision: title/hint/next) DE+EN vorhanden", () => {
    const keys = [
      "studio.save.capture.title",
      "studio.save.capture.hint",
      "studio.save.capture.next",
      "studio.save.revision.title",
      "studio.save.revision.hint",
      "studio.save.revision.next",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: Copy behauptet kein Auto-Speichern/-Validieren bzw. keine Auto-Freigabe (DE/EN)", () => {
    // Capture: nächster Schritt führt zu Review/Validierung, keine Auto-Validierung.
    expect(String(i18n.getResource("de", "translation", "studio.save.capture.next") ?? "")).toMatch(
      /automatisch validiert wird nichts|review|validierung/i,
    );
    expect(String(i18n.getResource("en", "translation", "studio.save.capture.next") ?? "")).toMatch(
      /nothing is validated automatically/i,
    );
    // Revision: neue Version + erneute Prüfung, keine automatische Freigabe.
    expect(
      String(i18n.getResource("de", "translation", "studio.save.revision.next") ?? ""),
    ).toMatch(/neue Version/i);
    expect(
      String(i18n.getResource("de", "translation", "studio.save.revision.next") ?? ""),
    ).toMatch(/keine automatische Freigabe/i);
    expect(
      String(i18n.getResource("en", "translation", "studio.save.revision.next") ?? ""),
    ).toMatch(/new version/i);
  });
});

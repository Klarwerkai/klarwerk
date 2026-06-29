import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  hasEditableContent,
  shouldWarnBeforeReplace,
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

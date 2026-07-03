import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ASSIST_ACTIONS,
  type AssistAction,
  applyAssist,
  assistActionHelpKey,
  assistActionInstructionKey,
  assistActionLabelKey,
} from "../../apps/web/src/lib/captureAiAssist";

// SCRUM-312: geführte KI-Nachbearbeitung — Aktionen + Übernahme-Logik (Ersetzen/Anhängen). Reine,
// DOM-freie Logik; KI macht einen Vorschlag, Mensch übernimmt bewusst.
describe("SCRUM-312: captureAiAssist", () => {
  it("kennt die fünf geführten Aktionen in fester Reihenfolge (SCRUM-404: + Formatieren)", () => {
    expect(ASSIST_ACTIONS).toEqual<AssistAction[]>([
      "clarify",
      "structure",
      "expand",
      "spelling",
      "format",
    ]);
  });

  it("bildet Label- und Instruction-Keys stabil je Aktion ab", () => {
    expect(assistActionLabelKey("clarify")).toBe("capture.ai.action.clarify");
    expect(assistActionInstructionKey("expand")).toBe("capture.ai.instr.expand");
  });

  it("applyAssist: 'replace' ersetzt, 'append' hängt mit Leerzeile an, trimmt den Vorschlag", () => {
    expect(applyAssist("replace", "alt", "  neu  ")).toBe("neu");
    expect(applyAssist("append", "alt", "neu")).toBe("alt\n\nneu");
    // leerer Ausgangstext → nur der Vorschlag (kein führender Umbruch).
    expect(applyAssist("append", "   ", "neu")).toBe("neu");
  });

  it("alle Aktions-Label, Instruktionen und Box-Texte sind DE und EN vorhanden", () => {
    const keys = [
      "capture.ai.title",
      "capture.ai.hint",
      "capture.ai.freeLabel",
      "capture.ai.freePlaceholder",
      "capture.ai.run",
      "capture.ai.previewTitle",
      "capture.ai.replace",
      "capture.ai.append",
      "capture.ai.discard",
      // SCRUM-404: jede Aktion hat zusätzlich einen ?-Hilfe-Text (assistActionHelpKey).
      ...ASSIST_ACTIONS.flatMap((a) => [
        assistActionLabelKey(a),
        assistActionInstructionKey(a),
        assistActionHelpKey(a),
      ]),
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("Instruktionen bleiben ehrlich: keine Inhalte/Fakten erfinden (Erweitern)", () => {
    expect(String(i18n.getResource("de", "translation", "capture.ai.instr.expand"))).toMatch(
      /ohne neue Fakten/i,
    );
  });

  it("SCRUM-404: „Formatieren“ verändert nur die Gliederung, nicht den Inhalt", () => {
    expect(String(i18n.getResource("de", "translation", "capture.ai.instr.format"))).toMatch(
      /Inhalt und Wortlaut unverändert/i,
    );
  });
});

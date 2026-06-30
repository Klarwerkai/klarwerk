import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { isReviewReworkContext, reworkHref } from "../../apps/web/src/lib/reviewReworkContext";
import { knowledgeOsPhase, phaseLabelKey, taskAction } from "../../apps/web/src/lib/taskAction";

// SCRUM-351: Persönliche Work-Queue — die „zurückgegeben/Nacharbeit"-Karte (task.returned) muss den
// Autor in den FOKUSSIERTEN Rework-Kontext führen (Feedback + geordnete Schritte), nicht auf die
// nackte KO-Detailseite. MyTasks routet die Returned-Karte daher auf reworkHref(koId). Dieser Test
// sichert die Work-Queue-Semantik der Returned-Arbeit auf Helfer-Ebene (DOM-frei, kein Render-Harness).
describe("SCRUM-351: persönliche Returned-Arbeit führt in den Rework-Kontext", () => {
  it("reworkHref trägt den Rework-Fokus und wird als Rework-Kontext erkannt", () => {
    const href = reworkHref("ko-42");
    expect(href).toBe("/wissen/ko-42?rework=review");
    const params = new URLSearchParams(href.split("?")[1] ?? "");
    expect(isReviewReworkContext(params)).toBe(true);
  });

  it("nackte KO-Detailseite (ohne Fokus) gilt NICHT als Rework-Kontext", () => {
    expect(isReviewReworkContext(new URLSearchParams(""))).toBe(false);
  });

  it("task.returned ist kritische Nacharbeit in der Erfassen-Phase (eine Kreis-Sprache)", () => {
    const action = taskAction("task.returned");
    expect(action).toMatchObject({ actionLabelKey: "task.action.returned", tone: "crit" });
    // Nacharbeit gehört in die „Erfassen/Capture"-Phase des Knowledge-OS-Kreises.
    expect(knowledgeOsPhase("task.returned")).toBe("capture");
    expect(phaseLabelKey("capture")).toBe("cycle.capture.label");
  });

  it("i18n: Returned-Aktionslabel + Aufgaben-Typ-Label sind DE und EN vorhanden", () => {
    for (const key of ["task.action.returned", "task.returned", "cycle.capture.label"]) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type KnowledgeOsPhase,
  knowledgeOsPhase,
  phaseLabelKey,
  taskAction,
} from "../../apps/web/src/lib/taskAction";

// SCRUM-260: Jede Aufgabe zeigt zusätzlich zu Typ und Titel eine klare nächste Handlung.
describe("SCRUM-260: taskAction", () => {
  it("bildet jeden bekannten Aufgaben-Typ auf eine handlungsnahe nächste Handlung ab", () => {
    expect(taskAction("task.returned")).toEqual({
      actionLabelKey: "task.action.returned",
      tone: "crit",
      explainKey: "task.explain.returned",
    });
    expect(taskAction("task.conflict")).toEqual({
      actionLabelKey: "task.action.conflict",
      tone: "crit",
      explainKey: "task.explain.conflict",
    });
    expect(taskAction("task.validation")).toEqual({
      actionLabelKey: "task.action.validation",
      tone: "warn",
      explainKey: "task.explain.validation",
    });
    expect(taskAction("task.revalidation")).toEqual({
      actionLabelKey: "task.action.revalidation",
      tone: "warn",
      explainKey: "task.explain.revalidation",
    });
    expect(taskAction("task.gap")).toEqual({
      actionLabelKey: "task.action.gap",
      tone: "neutral",
      explainKey: "task.explain.gap",
    });
  });

  it("fällt für unbekannte Typen sicher auf neutrales Öffnen zurück", () => {
    expect(taskAction("task.unknown")).toEqual({
      actionLabelKey: "task.action.open",
      tone: "neutral",
      explainKey: "task.explain.open",
    });
  });

  // Pedi 05.07.: die Klartext-Erklärung je Aufgabe muss in DE und EN vorhanden sein (nicht leer).
  it("hat für jede Aufgabe eine aufgelöste Klartext-Erklärung (DE+EN)", () => {
    for (const typeKey of [
      "task.returned",
      "task.conflict",
      "task.validation",
      "task.revalidation",
      "task.gap",
      "task.unknown",
    ]) {
      const { explainKey } = taskAction(typeKey);
      for (const lng of ["de", "en"]) {
        expect(
          String(i18n.getResource(lng, "translation", explainKey) ?? "").length,
          `${lng}:${explainKey}`,
        ).toBeGreaterThan(20);
      }
    }
  });
});

// SCRUM-297: Start UND MyTasks zeigen dieselbe Knowledge-OS-Phase (Erfassen/Validieren/Aktuell halten).
describe("SCRUM-297: knowledgeOsPhase", () => {
  it("mappt MyTasks-typeKeys auf die richtige Kreis-Phase", () => {
    expect(knowledgeOsPhase("task.gap")).toBe("capture");
    expect(knowledgeOsPhase("task.returned")).toBe("capture");
    expect(knowledgeOsPhase("task.validation")).toBe("validate");
    expect(knowledgeOsPhase("task.conflict")).toBe("validate");
    expect(knowledgeOsPhase("task.revalidation")).toBe("maintain");
  });

  it("mappt Start-Work-Overview-Keys konsistent auf dieselben Phasen", () => {
    expect(knowledgeOsPhase("criticalGaps")).toBe("capture");
    expect(knowledgeOsPhase("validation")).toBe("validate");
    expect(knowledgeOsPhase("conflicts")).toBe("validate");
    expect(knowledgeOsPhase("revalidation")).toBe("maintain");
    expect(knowledgeOsPhase("learning")).toBe("maintain");
  });

  it("Konsistenz: gleiche Phase für Task- und Start-Quelle desselben Themas", () => {
    expect(knowledgeOsPhase("task.gap")).toBe(knowledgeOsPhase("criticalGaps"));
    expect(knowledgeOsPhase("task.validation")).toBe(knowledgeOsPhase("validation"));
    expect(knowledgeOsPhase("task.conflict")).toBe(knowledgeOsPhase("conflicts"));
    expect(knowledgeOsPhase("task.revalidation")).toBe(knowledgeOsPhase("revalidation"));
  });

  it("unbekannter Schlüssel → sichere Default-Phase 'validate'", () => {
    expect(knowledgeOsPhase("whatever")).toBe("validate");
  });

  it("phaseLabelKey nutzt die vorhandene Kreis-Sprache (cycle.*.label) und ist DE/EN vorhanden", () => {
    const phases: KnowledgeOsPhase[] = ["capture", "validate", "use", "maintain"];
    for (const p of phases) {
      expect(phaseLabelKey(p)).toBe(`cycle.${p}.label`);
      for (const lng of ["de", "en"]) {
        expect(
          String(i18n.getResource(lng, "translation", phaseLabelKey(p)) ?? "").length,
        ).toBeGreaterThan(0);
      }
    }
    expect(
      String(i18n.getResource("de", "translation", "task.phaseLabel") ?? "").length,
    ).toBeGreaterThan(0);
    expect(
      String(i18n.getResource("en", "translation", "task.phaseLabel") ?? "").length,
    ).toBeGreaterThan(0);
  });
});

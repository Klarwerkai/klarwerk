import { describe, expect, it } from "vitest";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import { AI_TASK_INFO_TEXT, aiTaskInfo } from "../../apps/web/src/lib/reasonerTaskInfo";

function config(overrides: Partial<ReasonerConfigStatus> = {}): ReasonerConfigStatus {
  return {
    provider: "anthropic:claude-sonnet-4-6",
    model: "anthropic:claude-sonnet-4-6",
    configured: true,
    mode: "model",
    fallbackAvailable: true,
    taskConfig: { global: "auto", perTask: {} },
    effective: {
      structure: "model",
      assist: "model",
      interview: "model",
      answer: "model",
      select: "model",
      extract: "model",
    },
    persisted: false,
    localConfigured: false,
    effectiveProvider: {
      structure: "cloud",
      assist: "local",
      interview: "cloud",
      answer: "cloud",
      select: "deterministic",
      extract: "cloud",
    },
    supportsLocales: ["de", "en"],
    tasks: ["structure", "assist", "interview", "answer", "select", "extract"],
    // localProvider bewusst NICHT im Default (exactOptionalPropertyTypes: kein explizites undefined);
    // Tests, die den lokalen Namen brauchen, setzen ihn per override.
    ...overrides,
  };
}

describe("Pedi 04.07.: aiTaskInfo — welche KI je Aufgabe (Modus + Modellname)", () => {
  it("Cloud-Aufgabe zeigt Cloud-Modus + Modellnamen", () => {
    const info = aiTaskInfo(config(), "structure");
    expect(info.mode).toBe("cloud");
    expect(info.modeLabelKey).toBe(AI_TASK_INFO_TEXT.cloud);
    expect(info.modelName).toBe("anthropic:claude-sonnet-4-6");
    expect(info.dsgvo).toBe("external");
  });

  it("Lokale Aufgabe zeigt Lokal-Modus + lokalen Modellnamen (nicht das Cloud-Modell)", () => {
    const info = aiTaskInfo(config({ localProvider: "ollama:qwen3-32b" }), "assist");
    expect(info.mode).toBe("local");
    expect(info.modeLabelKey).toBe(AI_TASK_INFO_TEXT.local);
    expect(info.modelName).toBe("ollama:qwen3-32b");
    expect(info.dsgvo).toBe("inhouse");
  });

  it("Regelbasierte Aufgabe zeigt Regel-Modus OHNE Modellnamen (nichts erfinden)", () => {
    const info = aiTaskInfo(config(), "select");
    expect(info.mode).toBe("rule");
    expect(info.modeLabelKey).toBe(AI_TASK_INFO_TEXT.rule);
    expect(info.modelName).toBeUndefined();
    expect(info.dsgvo).toBe("inhouse");
  });

  it("Ohne geladene Konfiguration ehrlich unbekannt (kein Fake-Modell)", () => {
    const info = aiTaskInfo(undefined, "structure");
    expect(info.mode).toBe("unknown");
    expect(info.bodyKey).toBe(AI_TASK_INFO_TEXT.bodyUnknown);
    expect(info.dsgvo).toBe("unknown");
  });

  it("Nicht zugeordnete Aufgabe ist unbekannt statt Fake-Modell", () => {
    const info = aiTaskInfo(config(), "gibtsnicht");
    expect(info.mode).toBe("unknown");
    expect(info.modelName).toBeUndefined();
    expect(info.dsgvo).toBe("unknown");
  });

  it("Lokal ohne localProvider fällt ehrlich auf das konfigurierte Modell zurück", () => {
    // config() ohne localProvider → Rückfall auf config.model (kein Fake-Name).
    const info = aiTaskInfo(config(), "assist");
    expect(info.mode).toBe("local");
    expect(info.modelName).toBe("anthropic:claude-sonnet-4-6");
  });
});

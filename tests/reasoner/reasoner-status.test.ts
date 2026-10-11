import { describe, expect, it } from "vitest";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import { isModelConfigured, reasonerModeTone } from "../../apps/web/src/lib/reasonerStatus";

const configured: ReasonerConfigStatus = {
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
  },
  persisted: false,
  cloudConfigured: true,
  localConfigured: false,
  effectiveProvider: {
    structure: "cloud",
    assist: "cloud",
    interview: "cloud",
    answer: "cloud",
    select: "cloud",
  },
  supportsLocales: ["de", "en"],
  tasks: ["structure", "assist", "interview", "answer", "select"],
};

const demo: ReasonerConfigStatus = {
  provider: "deterministic",
  configured: false,
  mode: "demo",
  fallbackAvailable: true,
  taskConfig: { global: "auto", perTask: {} },
  effective: {
    structure: "model",
    assist: "model",
    interview: "model",
    answer: "model",
    select: "model",
  },
  persisted: false,
  cloudConfigured: false,
  localConfigured: false,
  effectiveProvider: {
    structure: "cloud",
    assist: "cloud",
    interview: "cloud",
    answer: "cloud",
    select: "cloud",
  },
  supportsLocales: ["de", "en"],
  tasks: ["structure", "assist", "interview", "answer", "select"],
};

describe("SCRUM-166: reasonerStatus helpers", () => {
  it("isModelConfigured", () => {
    expect(isModelConfigured(configured)).toBe(true);
    expect(isModelConfigured(demo)).toBe(false);
  });

  it("reasonerModeTone: model → pos, demo/fallback → warn", () => {
    expect(reasonerModeTone({ mode: "model" })).toBe("pos");
    expect(reasonerModeTone({ mode: "demo" })).toBe("warn");
    expect(reasonerModeTone({ mode: "fallback" })).toBe("warn");
  });

  // R-1349 (Aufnahme gesamt-aufruferwaechter): Der Fall zu `reasonerStatusSummary` ist mit der
  // Zusammenfassung entfallen — sie hatte keinen Produktleser; die Karte zeigt die Felder einzeln.
});

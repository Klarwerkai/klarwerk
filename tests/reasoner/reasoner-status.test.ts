import { describe, expect, it } from "vitest";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import {
  isModelConfigured,
  reasonerModeTone,
  reasonerStatusSummary,
} from "../../apps/web/src/lib/reasonerStatus";

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

  it("reasonerStatusSummary leitet ehrlich ab (model null bei Demo)", () => {
    expect(reasonerStatusSummary(configured)).toEqual({
      configured: true,
      mode: "model",
      provider: "anthropic:claude-sonnet-4-6",
      model: "anthropic:claude-sonnet-4-6",
      fallbackAvailable: true,
      localeCount: 2,
      taskCount: 5,
    });
    const s = reasonerStatusSummary(demo);
    expect(s.configured).toBe(false);
    expect(s.model).toBeNull();
    expect(s.provider).toBe("deterministic");
  });
});

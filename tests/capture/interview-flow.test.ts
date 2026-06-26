import { describe, expect, it } from "vitest";
import {
  answeredTurns,
  appendAnswer,
  interviewSourceKey,
  isInterviewDone,
} from "../../apps/web/src/lib/interviewFlow";

describe("SCRUM-132: Interview-Flow (FE-Helfer)", () => {
  it("appendAnswer hängt getrimmt an", () => {
    expect(appendAnswer([], "  Kernaussage  ")).toEqual(["Kernaussage"]);
    expect(appendAnswer(["a"], "b")).toEqual(["a", "b"]);
  });

  it("isInterviewDone: done ODER keine Frage mehr", () => {
    expect(isInterviewDone({ done: true, question: "noch was?" })).toBe(true);
    expect(isInterviewDone({ done: false, question: null })).toBe(true);
    expect(isInterviewDone({ done: false, question: "weiter?" })).toBe(false);
  });

  it("interviewSourceKey markiert Fallback vs. Modell", () => {
    expect(interviewSourceKey({ demo: true })).toBe("capture.ivFallback");
    expect(interviewSourceKey({ demo: false })).toBe("capture.ivModel");
  });

  it("answeredTurns zählt Antworten", () => {
    expect(answeredTurns([])).toBe(0);
    expect(answeredTurns(["a", "b"])).toBe(2);
  });
});

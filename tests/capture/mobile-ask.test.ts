import { describe, expect, it } from "vitest";
import type { AnswerResult } from "../../apps/web/src/api/types";
import { summarizeAnswer } from "../../apps/web/src/lib/mobileAsk";

const answer = (p: Partial<AnswerResult>): AnswerResult =>
  ({
    answered: true,
    answer: "Ventil X schließen.",
    knowledgeClass: "gesichert",
    trust: 80,
    sources: ["ko1", "ko2"],
    steps: [{ description: "Quelle: K1", sourceId: "ko1", snippet: "…" }],
    demo: false,
    ...p,
  }) as AnswerResult;

describe("SCRUM-113 / FE-MOB-03: summarizeAnswer", () => {
  it("verdichtet eine beantwortete Frage inkl. Evidenz/Trust/Quellen", () => {
    const s = summarizeAnswer(answer({}));
    expect(s.answered).toBe(true);
    expect(s.text).toBe("Ventil X schließen.");
    expect(s.trust).toBe(80);
    expect(s.evidence.tone).toBe("pos"); // gesichert → positiv
    expect(s.evidence.labelKey).toBe("ask.knowledgeClass.gesichert");
    expect(s.sources).toEqual(["ko1", "ko2"]);
    expect(s.stepCount).toBe(1);
  });

  it("No-Basis: answered=false, kein Text, Evidenz unbekannt → kritisch", () => {
    const s = summarizeAnswer(
      answer({
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        steps: [],
      }),
    );
    expect(s.answered).toBe(false);
    expect(s.text).toBeNull();
    expect(s.evidence.tone).toBe("crit");
    expect(s.sources).toEqual([]);
    expect(s.stepCount).toBe(0);
  });
});

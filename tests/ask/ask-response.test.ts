import { describe, expect, it } from "vitest";
import type { AnswerResult, AskResponse, Gap } from "../../apps/web/src/api/types";
import { selectAnswer, selectGap } from "../../apps/web/src/lib/askResponse";

// SCRUM-138: Backend POST /api/ask liefert { result, gap }. Der Adapter muss
// die Antwort sauber entpacken, damit die Ask-UI beantwortete Fragen anzeigt.
const answered: AnswerResult = {
  answered: true,
  answer: "Ventil V4 prüfen.",
  knowledgeClass: "gesichert",
  trust: 80,
  sources: ["ko-1"],
  steps: [{ description: "Quelle ko-1", sourceId: "ko-1", snippet: "…" }],
  demo: false,
};

const unanswered: AnswerResult = {
  answered: false,
  answer: null,
  knowledgeClass: "unbekannt",
  trust: 0,
  sources: [],
  steps: [],
  demo: false,
};

const gap: Gap = {
  id: "gap-1",
  question: "Wie hoch ist der Wechselkurs?",
  status: "offen",
  assignee: null,
  priority: "mittel",
  createdAt: "2026-01-01",
};

describe("SCRUM-138: Ask-Response-Adapter", () => {
  it("beantwortete Frage → Antwort-Anzeigedaten, keine Lücke", () => {
    const response: AskResponse = { result: answered, gap: null };
    const a = selectAnswer(response);
    expect(a.answered).toBe(true);
    expect(a.answer).toBe("Ventil V4 prüfen.");
    expect(a.trust).toBe(80);
    expect(a.sources).toEqual(["ko-1"]);
    expect(a.steps).toHaveLength(1);
    expect(selectGap(response)).toBeNull();
  });

  it("unbeantwortbare Frage → No-Basis-Daten + Lücke", () => {
    const response: AskResponse = { result: unanswered, gap };
    const a = selectAnswer(response);
    expect(a.answered).toBe(false);
    expect(a.answer).toBeNull();
    expect(selectGap(response)?.id).toBe("gap-1");
  });
});

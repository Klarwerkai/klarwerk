import { describe, expect, it } from "vitest";
import type { AnswerResult, AskResponse, Gap } from "../../apps/web/src/api/types";
import { selectAnswer, selectGap } from "../../apps/web/src/lib/askResponse";

// SCRUM-138: Backend POST /api/ask liefert { result, gap, receipt }. Der Adapter muss
// die Antwort sauber entpacken, damit die Ask-UI beantwortete Fragen anzeigt.
// FUNKE-FIX P0 (bens ROT-1): der Answer-Receipt reist als drittes Feld mit (Beleg fürs „Danke").
const RECEIPT = "receipt.stub";
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
    const response: AskResponse = { result: answered, gap: null, receipt: RECEIPT };
    const a = selectAnswer(response);
    expect(a.answered).toBe(true);
    expect(a.answer).toBe("Ventil V4 prüfen.");
    expect(a.trust).toBe(80);
    expect(a.sources).toEqual(["ko-1"]);
    expect(a.steps).toHaveLength(1);
    expect(selectGap(response)).toBeNull();
  });

  it("unbeantwortbare Frage → No-Basis-Daten + Lücke", () => {
    const response: AskResponse = { result: unanswered, gap, receipt: RECEIPT };
    const a = selectAnswer(response);
    expect(a.answered).toBe(false);
    expect(a.answer).toBeNull();
    expect(selectGap(response)?.id).toBe("gap-1");
  });
});

// Aufnahme 20260922 · R-0310 (Ben zu 6cc581b4): `selectAnswer` wendet die Absatz-Beleg-Zuordnung
// des Servers an — Fragenseite und Mobilseite lesen damit denselben gefilterten Antwortstand.
describe("R-0310 · selectAnswer gibt nur belegte Absätze aus", () => {
  const mehrere: AnswerResult = {
    ...answered,
    answer: "A gilt [1].\n\nFrei erfunden.\n\nB gilt.\n\nC gilt.",
    sources: ["ko-1", "ko-2", "ko-3"],
    citedSources: ["ko-1", "ko-2"],
  };

  it("S1 · unbelegter Absatz fällt weg; jeder belegte trägt die Marke seiner tragenden Quelle(n)", () => {
    const a = selectAnswer({
      result: mehrere,
      gap: null,
      receipt: RECEIPT,
      absaetze: [
        { text: "A gilt [1].", quellen: ["ko-1"] },
        { text: "Frei erfunden.", quellen: [] },
        { text: "B gilt.", quellen: ["ko-2", "ko-1"] },
        // ko-3 ist nur herangezogen — es belegt nichts.
        { text: "C gilt.", quellen: ["ko-3"] },
      ],
    });
    expect(a.answered).toBe(true);
    expect(a.answer).toBe("A gilt [1].\n\nB gilt. [2, 1]");
  });

  it("S2 · ein einzelner belegter Absatz bleibt wörtlich (die Fläche setzt seine Marke ans Ende)", () => {
    const a = selectAnswer({
      result: { ...mehrere, answer: "B gilt.\n\nFrei erfunden." },
      gap: null,
      receipt: RECEIPT,
      absaetze: [
        { text: "B gilt.", quellen: ["ko-2"] },
        { text: "Frei erfunden.", quellen: [] },
      ],
    });
    expect(a.answer).toBe("B gilt.");
  });

  it("S3 · kein Absatz belegt: keine Antwort, sondern die Wissenslücke", () => {
    const a = selectAnswer({
      result: mehrere,
      gap: null,
      receipt: RECEIPT,
      absaetze: [
        { text: "Frei erfunden.", quellen: [] },
        { text: "C gilt.", quellen: ["ko-3"] },
      ],
    });
    expect(a.answered).toBe(false);
    expect(a.answer).toBeNull();
    expect(a.knowledgeClass).toBe("unbekannt");
  });

  it("S4 · ohne das Feld (älterer Server) und bei einer Lücke bleibt alles unverändert", () => {
    expect(selectAnswer({ result: mehrere, gap: null, receipt: RECEIPT })).toBe(mehrere);
    expect(selectAnswer({ result: unanswered, gap, receipt: RECEIPT, absaetze: [] })).toBe(
      unanswered,
    );
  });
});

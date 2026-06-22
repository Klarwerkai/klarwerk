import type { AnswerResult, KnowledgeRef, StructureResult } from "./types";

// FR-RSN-02: anbieteragnostisch — jede Implementierung (lokales Modell, Cloud, Mock)
// erfüllt diese Schnittstelle und ist ohne Änderung der Fachlogik austauschbar.
export interface ReasonerProvider {
  readonly name: string;
  isAvailable(): boolean;
  structure(rawText: string): StructureResult;
  answer(question: string, context: readonly KnowledgeRef[]): AnswerResult;
  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter((w) => w.length > 2);
}

function overlap(a: readonly string[], b: readonly string[]): number {
  const set = new Set(b);
  let count = 0;
  for (const word of a) {
    if (set.has(word)) {
      count += 1;
    }
  }
  return count;
}

// FR-RSN-04: deterministischer Fallback ohne Modell. Immer verfügbar, Ergebnisse
// klar als Demo markiert; semantische Auswahl über Keyword-Überschneidung.
export class DeterministicProvider implements ReasonerProvider {
  readonly name = "deterministic";

  isAvailable(): boolean {
    return true;
  }

  structure(rawText: string): StructureResult {
    const firstSentence = rawText.split(/[.!?]/)[0]?.trim() ?? rawText.trim();
    return {
      title: firstSentence,
      statement: rawText.trim(),
      conditions: [],
      measures: [],
      tags: [],
      confidence: 0,
      demo: true,
    };
  }

  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    const words = tokenize(question);
    return candidates
      .map((c) => ({ c, score: overlap(words, tokenize(`${c.title} ${c.statement}`)) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }

  answer(question: string, context: readonly KnowledgeRef[]): AnswerResult {
    const relevant = this.select(question, context);
    // FR-RSN-03: keine Rateantwort ohne belastbares Wissen.
    if (relevant.length === 0) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        steps: [],
        demo: true,
      };
    }
    const best = relevant[0];
    if (!best) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        steps: [],
        demo: true,
      };
    }
    return {
      answered: true,
      answer: best.statement,
      knowledgeClass: best.status === "validiert" ? "gesichert" : "ungeprueft",
      trust: best.trust,
      sources: relevant.map((r) => r.id),
      steps: [{ description: `Quelle: ${best.title}`, sourceId: best.id }],
      demo: true,
    };
  }
}

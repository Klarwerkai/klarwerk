import { type ReasonerProvider, keywordSelect } from "./provider";
import type { AnswerResult, KnowledgeRef, StructureResult } from "./types";

// Abstrakter Modell-Client: kapselt den eigentlichen (anbieterspezifischen) Aufruf.
// FR-RSN-02/06: anbieteragnostisch; der Schlüssel lebt nur im Client (serverseitig).
export interface ModelClient {
  readonly name: string;
  complete(system: string, user: string): Promise<string>;
}

const STRUCTURE_SYSTEM =
  "Du strukturierst industrielles Erfahrungswissen. Antworte AUSSCHLIESSLICH mit JSON: " +
  '{"title": string, "statement": string, "conditions": string[], "measures": string[], ' +
  '"tags": string[], "confidence": number (0..1)}. Erfinde nichts dazu.';

const ANSWER_SYSTEM =
  "Beantworte die Frage NUR auf Basis der nummerierten Quellen. Reichen die Quellen nicht, " +
  "sage das ehrlich. Erfinde keine Fakten und keine Zahlen.";

function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

// Echter Provider: nutzt ein Modell über den injizierten Client, bleibt aber in den
// vorhandenen KOs verankert (Anti-Halluzination: Quellen/Trust kommen aus den Daten,
// das Modell formuliert nur). Ohne Client → nicht verfügbar → Reasoner nimmt den Fallback.
export class ModelProvider implements ReasonerProvider {
  readonly name: string;
  private readonly client: ModelClient | undefined;

  constructor(client?: ModelClient) {
    this.client = client;
    this.name = client?.name ?? "model";
  }

  isAvailable(): boolean {
    return this.client !== undefined;
  }

  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    return keywordSelect(question, candidates);
  }

  async structure(rawText: string): Promise<StructureResult> {
    const client = this.requireClient();
    const raw = await client.complete(STRUCTURE_SYSTEM, rawText);
    const parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
    const firstSentence = rawText.split(/[.!?]/)[0]?.trim() ?? rawText.trim();
    return {
      title: String(parsed.title ?? firstSentence).trim(),
      statement: String(parsed.statement ?? rawText).trim(),
      conditions: asStringArray(parsed.conditions),
      measures: asStringArray(parsed.measures),
      tags: asStringArray(parsed.tags),
      confidence: clamp01(Number(parsed.confidence ?? 0)),
      demo: false,
    };
  }

  async answer(question: string, context: readonly KnowledgeRef[]): Promise<AnswerResult> {
    const relevant = keywordSelect(question, context);
    // FR-RSN-03: ohne belastbares Wissen keine Rateantwort — Modell wird gar nicht erst befragt.
    const best = relevant[0];
    if (!best) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        steps: [],
        demo: false,
      };
    }
    const client = this.requireClient();
    const grounding = relevant.map((r, i) => `[${i + 1}] ${r.title}: ${r.statement}`).join("\n");
    const answerText = (
      await client.complete(ANSWER_SYSTEM, `Frage: ${question}\n\nQuellen:\n${grounding}`)
    ).trim();
    return {
      answered: true,
      answer: answerText,
      knowledgeClass: best.status === "validiert" ? "gesichert" : "ungeprueft",
      trust: best.trust,
      sources: relevant.map((r) => r.id),
      steps: relevant.map((r) => ({
        description: `Quelle: ${r.title}`,
        sourceId: r.id,
        snippet: r.statement,
      })),
      demo: false,
    };
  }

  private requireClient(): ModelClient {
    if (!this.client) {
      throw new Error("Kein Modell-Client konfiguriert.");
    }
    return this.client;
  }
}

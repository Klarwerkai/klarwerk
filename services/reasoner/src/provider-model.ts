import {
  type ReasonerProvider,
  deterministicInterview,
  selectCandidates,
  sourceLabel,
} from "./provider";
import type {
  AnswerResult,
  AssistResult,
  InterviewResult,
  KnowledgeRef,
  ReasonerLocale,
  StructureResult,
} from "./types";

// Abstrakter Modell-Client: kapselt den eigentlichen (anbieterspezifischen) Aufruf.
// FR-RSN-02/06: anbieteragnostisch; der Schlüssel lebt nur im Client (serverseitig).
export interface ModelClient {
  readonly name: string;
  complete(system: string, user: string): Promise<string>;
}

// FR-I18N-01: Systemprompts sprachbewusst. JSON-Contract der structure-Aufgabe bleibt
// in beiden Sprachen identisch — nur die Anweisung ist lokalisiert.
function structureSystem(locale: ReasonerLocale): string {
  const contract =
    '{"title": string, "statement": string, "conditions": string[], "measures": string[], ' +
    '"tags": string[], "confidence": number (0..1)}';
  return locale === "en"
    ? `You structure industrial experiential knowledge. Respond ONLY with JSON: ${contract}. Do not invent anything.`
    : `Du strukturierst industrielles Erfahrungswissen. Antworte AUSSCHLIESSLICH mit JSON: ${contract}. Erfinde nichts dazu.`;
}

function answerSystem(locale: ReasonerLocale): string {
  return locale === "en"
    ? "Answer ONLY based on the numbered sources. If the sources are not enough, say so honestly. Do not invent facts or numbers."
    : "Beantworte die Frage NUR auf Basis der nummerierten Quellen. Reichen die Quellen nicht, sage das ehrlich. Erfinde keine Fakten und keine Zahlen.";
}

function assistSystem(locale: ReasonerLocale): string {
  return locale === "en"
    ? "Improve wording without changing content. Do NOT alter or invent any content, numbers or facts. Return ONLY the revised text, without preamble or quotation marks."
    : "Du präzisierst und glättest industrielles Erfahrungswissen sprachlich. Verändere oder erfinde KEINE Inhalte, Zahlen oder Fakten. Gib AUSSCHLIESSLICH den überarbeiteten Text zurück, ohne Vorbemerkung oder Anführungszeichen.";
}

// SCRUM-312: leitet die optionale Nutzer-/Aktionsanweisung an das Modell weiter — als
// Stil-/Form-Wunsch, NICHT als Erlaubnis, Inhalte zu erfinden.
function assistGuidance(locale: ReasonerLocale, instruction: string): string {
  return locale === "en"
    ? `Apply this editing instruction to the wording only (no new facts): ${instruction}`
    : `Wende diese Bearbeitungs-Anweisung nur auf die Formulierung an (keine neuen Fakten): ${instruction}`;
}

function interviewSystem(locale: ReasonerLocale): string {
  return locale === "en"
    ? "You run a short editorial interview to capture industrial experiential knowledge. Ask exactly ONE next, concrete question that builds on the previous answers. Do NOT invent any technical content or facts. Return ONLY the question."
    : "Du führst ein kurzes Redakteur-Interview, um industrielles Erfahrungswissen zu erfassen. Formuliere genau EINE nächste, konkrete Frage, die auf den bisherigen Antworten aufbaut. Erfinde KEINE fachlichen Inhalte oder Fakten. Gib AUSSCHLIESSLICH die Frage zurück.";
}

// Sprachbewusste User-Prompt-Labels (kein Quelleninhalt wird übersetzt).
const LABELS: Record<ReasonerLocale, Record<string, string>> = {
  de: {
    question: "Frage",
    sources: "Quellen",
    priorAnswers: "Bisherige Antworten",
    guiding: "Leitfrage",
    none: "(noch keine)",
  },
  en: {
    question: "Question",
    sources: "Sources",
    priorAnswers: "Previous answers",
    guiding: "Guiding question",
    none: "(none yet)",
  },
};

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

  // SCRUM-360: begrenzte, status-/trust-bewusste Kandidatenauswahl (siehe selectCandidates) — das
  // Modell bekommt nur eine gedeckelte, relevant gerankte Quellenmenge statt aller KOs.
  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    return selectCandidates(question, candidates);
  }

  async structure(rawText: string, locale: ReasonerLocale = "de"): Promise<StructureResult> {
    const client = this.requireClient();
    const raw = await client.complete(structureSystem(locale), rawText);
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

  async assistText(
    text: string,
    locale: ReasonerLocale = "de",
    instruction?: string,
  ): Promise<AssistResult> {
    const client = this.requireClient();
    // SCRUM-312: optionale Anweisung als zusätzliche Leitplanke an das System-Prompt hängen —
    // der „keine Inhalte/Fakten erfinden"-Schutz aus assistSystem bleibt vollständig erhalten.
    const guidance = instruction?.trim();
    const system = guidance
      ? `${assistSystem(locale)}\n${assistGuidance(locale, guidance)}`
      : assistSystem(locale);
    const improved = (await client.complete(system, text)).trim();
    return { text: improved || text.trim(), demo: false };
  }

  // SCRUM-132: Modell formuliert nur die nächste Frage; Abschluss + Draft-Verdichtung
  // bleiben deterministisch (kein Erfinden von Inhalt). demo=false, da Modell genutzt.
  async interview(
    answers: readonly string[],
    locale: ReasonerLocale = "de",
  ): Promise<InterviewResult> {
    const base = deterministicInterview(answers, false, locale);
    if (base.done || base.question === null) {
      return base;
    }
    const client = this.requireClient();
    const labels = LABELS[locale];
    const prior = answers.map((a, i) => `A${i + 1}: ${a}`).join("\n");
    const phrased = (
      await client.complete(
        interviewSystem(locale),
        `${labels.priorAnswers}:\n${prior || labels.none}\n\n${labels.guiding}: ${base.question}`,
      )
    ).trim();
    return { ...base, question: phrased || base.question };
  }

  async answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    // SCRUM-360: begrenzte, status-/trust-bewusste Top-K-Auswahl → das Modell bekommt nur eine
    // gedeckelte, relevant gerankte Quellenmenge (kein blindes Durchreichen aller KOs).
    const relevant = selectCandidates(question, context);
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
    const labels = LABELS[locale];
    const grounding = relevant.map((r, i) => `[${i + 1}] ${r.title}: ${r.statement}`).join("\n");
    const answerText = (
      await client.complete(
        answerSystem(locale),
        `${labels.question}: ${question}\n\n${labels.sources}:\n${grounding}`,
      )
    ).trim();
    return {
      answered: true,
      answer: answerText,
      knowledgeClass: best.status === "validiert" ? "gesichert" : "ungeprueft",
      trust: best.trust,
      sources: relevant.map((r) => r.id),
      steps: relevant.map((r) => ({
        description: sourceLabel(r.title, locale),
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

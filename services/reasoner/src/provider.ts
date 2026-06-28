import type {
  AnswerResult,
  AssistResult,
  InterviewResult,
  KnowledgeRef,
  ReasonerLocale,
  StructureResult,
} from "./types";

// FR-RSN-02: anbieteragnostisch — jede Implementierung (lokales Modell, Cloud, Mock)
// erfüllt diese Schnittstelle und ist ohne Änderung der Fachlogik austauschbar.
// FR-I18N-01: optionale locale steuert Sprache von Prompt/Frage/Label (Default "de").
export interface ReasonerProvider {
  readonly name: string;
  isAvailable(): boolean;
  // structure/answer sind async — ein echtes Modell ruft über das Netz.
  structure(rawText: string, locale?: ReasonerLocale): Promise<StructureResult>;
  answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale?: ReasonerLocale,
  ): Promise<AnswerResult>;
  // FR-RSN-03: Text sprachlich präzisieren (ohne Inhalt zu erfinden).
  assistText(text: string, locale?: ReasonerLocale): Promise<AssistResult>;
  // SCRUM-132: nächste Interview-Frage + aus den Antworten verdichteter Entwurf.
  interview(answers: readonly string[], locale?: ReasonerLocale): Promise<InterviewResult>;
  // select ist reines Ranking (synchron, kein Netzaufruf).
  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[];
}

// SCRUM-132 / FR-I18N-01: feste Fragenfolge je Sprache (eine Frage pro Turn) — vom Modell
// nur umformulierbar, nie inhaltlich erfunden. Index = Anzahl bisher gegebener Antworten.
export const INTERVIEW_QUESTIONS: Record<ReasonerLocale, readonly string[]> = {
  de: [
    "Worum geht es? Formuliere die Kernaussage in einem Satz.",
    "Unter welchen Bedingungen oder ab wann gilt das?",
    "Welche Maßnahme oder Konsequenz folgt daraus?",
    "Welche Stichworte/Tags helfen beim Wiederfinden? (kommagetrennt)",
  ],
  en: [
    "What is this about? State the core message in one sentence.",
    "Under what conditions or from when does this apply?",
    "What action or consequence follows from it?",
    "Which keywords/tags help to find it again? (comma-separated)",
  ],
};

// FR-I18N-01: sprachbewusstes Label für eine Beleg-/Quellenangabe (kein Quelleninhalt).
export function sourceLabel(title: string, locale: ReasonerLocale = "de"): string {
  return locale === "en" ? `Source: ${title}` : `Quelle: ${title}`;
}

// Verdichtet die bisherigen Antworten nachvollziehbar zu einem KO-Entwurf.
// Rein deterministisch — erfindet keinen Inhalt, mappt nur Antwort → Feld.
export function condenseInterview(answers: readonly string[], demo: boolean): StructureResult {
  const a = answers.map((s) => s.trim());
  const tags = a[3]
    ? a[3]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  return {
    title: a[0] ?? "",
    statement: a[0] ?? "",
    conditions: a[1] ? [a[1]] : [],
    measures: a[2] ? [a[2]] : [],
    tags,
    confidence: 0,
    demo,
  };
}

// SCRUM-132 / FR-I18N-01: deterministischer Interview-Turn — nächste Standardfrage (in der
// gewählten Sprache) + Abschluss bei ausreichendem Inhalt (Kernaussage + Bedingung + Maßnahme).
export function deterministicInterview(
  answers: readonly string[],
  demo: boolean,
  locale: ReasonerLocale = "de",
): InterviewResult {
  const questions = INTERVIEW_QUESTIONS[locale];
  const core = (answers[0]?.trim().length ?? 0) > 0;
  const hasCond = (answers[1]?.trim().length ?? 0) > 0;
  const hasMeas = (answers[2]?.trim().length ?? 0) > 0;
  const sufficient = core && hasCond && hasMeas;
  const done = answers.length >= questions.length || sufficient;
  return {
    question: done ? null : (questions[answers.length] ?? null),
    done,
    draft: condenseInterview(answers, demo),
    demo,
  };
}

// SCRUM-282: Funktions-/Stoppwörter (DE/EN) aus dem Matching ausschließen. Sonst erscheinen
// lange/offtopic Fragen über zufällige Überschneidung gängiger Wörter (z. B. „ist", „die", „von")
// als belegte Antwort. Nur Inhaltstoken zählen → ehrliche Wissenslücke statt Scheinquelle.
// Bewusst nur generische Funktionswörter (keine Fach-/Domänenbegriffe), damit seed-sichere
// Treffer (Ventil/Überdruck, Filter F3 …) unverändert bleiben.
const STOPWORDS = new Set<string>([
  // Deutsch — Artikel, Pronomen, Präpositionen, Konjunktionen, Hilfs-/Frageworte
  "aber",
  "alle",
  "allem",
  "allen",
  "aller",
  "alles",
  "als",
  "also",
  "auch",
  "auf",
  "aus",
  "bei",
  "bin",
  "bis",
  "bist",
  "das",
  "dass",
  "dein",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "dir",
  "doch",
  "dort",
  "durch",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "eines",
  "er",
  "es",
  "etwas",
  "euer",
  "für",
  "gegen",
  "hat",
  "hatte",
  "hier",
  "ich",
  "ihm",
  "ihr",
  "ihre",
  "ist",
  "kann",
  "man",
  "mein",
  "mit",
  "muss",
  "nach",
  "nicht",
  "noch",
  "nur",
  "ob",
  "oder",
  "ohne",
  "sehr",
  "sein",
  "sich",
  "sie",
  "sind",
  "soll",
  "über",
  "uns",
  "und",
  "unter",
  "viel",
  "vom",
  "von",
  "vor",
  "war",
  "was",
  "weil",
  "welche",
  "welchem",
  "welchen",
  "welcher",
  "welches",
  "wenn",
  "wer",
  "werde",
  "werden",
  "wie",
  "wird",
  "wo",
  "wann",
  "warum",
  "zum",
  "zur",
  "zwischen",
  // Englisch — häufige Funktionswörter (locale kann en sein)
  "the",
  "and",
  "for",
  "are",
  "you",
  "your",
  "what",
  "when",
  "how",
  "why",
  "with",
  "this",
  "that",
  "not",
  "from",
  "into",
  "does",
  "did",
  "can",
  "has",
  "have",
  "their",
  "them",
  "they",
  "there",
  "here",
  "about",
  "over",
  "please",
  "note",
  "context",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
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

// Semantische Vorauswahl über Keyword-Überschneidung — synchron, modellunabhängig.
// Von beiden Providern genutzt, damit Antworten immer in echten KOs verankert bleiben.
export function keywordSelect(
  question: string,
  candidates: readonly KnowledgeRef[],
): KnowledgeRef[] {
  const words = tokenize(question);
  return candidates
    .map((c) => ({ c, score: overlap(words, tokenize(`${c.title} ${c.statement}`)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

// FR-RSN-04: deterministischer Fallback ohne Modell. Immer verfügbar, Ergebnisse
// klar als Demo markiert; semantische Auswahl über Keyword-Überschneidung.
export class DeterministicProvider implements ReasonerProvider {
  readonly name = "deterministic";

  isAvailable(): boolean {
    return true;
  }

  async structure(rawText: string): Promise<StructureResult> {
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

  // Ohne Modell: deterministische Glättung (Whitespace, Großschreibung, Satzabschluss).
  // Verändert keinen Inhalt — markiert als Demo.
  async assistText(text: string): Promise<AssistResult> {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return { text: "", demo: true };
    }
    const cased = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    const ended = /[.!?]$/.test(cased) ? cased : `${cased}.`;
    return { text: ended, demo: true };
  }

  // SCRUM-132 / FR-I18N-01: deterministischer Fallback, klar als Demo markiert.
  async interview(
    answers: readonly string[],
    locale: ReasonerLocale = "de",
  ): Promise<InterviewResult> {
    return deterministicInterview(answers, true, locale);
  }

  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    return keywordSelect(question, candidates);
  }

  async answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
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
      // SCRUM-256: Die deterministische Antwort (answer/trust/knowledgeClass/steps) wird
      // AUSSCHLIESSLICH aus `best` abgeleitet. Daher nur die tatsächlich genutzte Quelle melden —
      // lose gematchte Kandidaten erscheinen nicht als gleichwertige Antwortquellen (Quellen-
      // ehrlichkeit, Abgrenzung gegen Chatbot-Wahrnehmung). Kein Ranking-/Retrieval-Umbau.
      sources: [best.id],
      steps: [
        {
          description: sourceLabel(best.title, locale),
          sourceId: best.id,
          snippet: best.statement,
        },
      ],
      demo: true,
    };
  }
}

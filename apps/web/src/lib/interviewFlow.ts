// Reine, DOM-freie Helfer für das reasoner-getriebene Interview (SCRUM-132).
// Die eigentliche Fragenerzeugung/Verdichtung liegt im Reasoner-Service; hier nur
// FE-seitige Akkumulation, Abschluss- und Statuslogik.
import type { InterviewNodeId, InterviewResult } from "../api/types";

// Antwort an die bisherige Antwortliste anhängen (getrimmt).
export function appendAnswer(answers: readonly string[], text: string): string[] {
  return [...answers, text.trim()];
}

// Interview abgeschlossen, wenn der Server done meldet oder keine Frage mehr liefert.
export function isInterviewDone(result: Pick<InterviewResult, "done" | "question">): boolean {
  return result.done || result.question === null;
}

// i18n-Key für die Quelle der Fragen: deterministischer Fallback vs. echtes Modell.
export function interviewSourceKey(result: Pick<InterviewResult, "demo">): string {
  return result.demo ? "capture.ivFallback" : "capture.ivModel";
}

// Anzahl bisher beantworteter Turns (für Fortschrittsanzeige).
export function answeredTurns(answers: readonly string[]): number {
  return answers.length;
}

// AUFTRAG-mega5 Block A (bens Verlustpfade 1+2): der Interviewfortschritt reist als reine
// Textstruktur im Entwurf mit — gegebene Antworten, die gerade getippte (noch nicht gesendete)
// Antwort und die aktuelle Frage samt Abschluss-/Quellen-Flag. KEINE Modell-Nutzlast, kein
// Anbietername; nur das, was der Nutzer sieht bzw. eingegeben hat.
export interface DraftInterviewState {
  started: boolean;
  answers: string[];
  answer?: string;
  question?: string;
  done?: boolean;
  demo?: boolean;
  // R-1624: der bestätigte Bildbefund eines Foto-Interviews. Ohne ihn liefe ein fortgesetztes
  // Foto-Interview als normales Interview weiter (andere Fragen, keine Foto-Wissensseite).
  imageContext?: string;
  // AUFNAHME 20260922 · WISSEN-INTERVIEW: Fragebaum, Lücken-Thema und die ausdrückliche
  // Abschlussbestätigung des Menschen (R-0113).
  tree?: boolean;
  topic?: string;
  confirmed?: boolean;
}

// ================================================================================================
// AUFNAHME 20260922 · WISSEN-INTERVIEW — FRAGEBAUM, LÜCKENWERT, ABSCHLUSS DURCH DEN MENSCHEN.
// ================================================================================================
//
// Der Server führt den Baum (services/reasoner/src/interview-tree.ts). Hier steht nur, was die
// Oberfläche daraus macht: wann sie den Abschluss ANBIETET, wie eine übersprungene Frage aussieht
// und wie die vertiefenden Antworten in die Wissensseite kommen. Abgeschlossen wird nie von selbst.

/** Eine übersprungene Frage ist eine leere Antwort — der Knoten bleibt eine Lücke. */
export const SKIPPED_ANSWER = "";

/**
 * Darf der Mensch jetzt abschließen? Ja, sobald der Server genug Inhalt meldet oder der Baum durch
 * ist. Im alten Ablauf (ohne Baum) gibt es keine Bestätigung — dort bleibt alles wie bisher.
 */
export function interviewCanConfirm(
  tree: boolean,
  result: Pick<InterviewResult, "done" | "question" | "sufficient"> | null,
): boolean {
  if (!tree || !result) {
    return false;
  }
  return result.sufficient === true || isInterviewDone(result);
}

/** Der Knoten-Schlüssel für die Beschriftung (Textmodul `texte/interview.ts`). */
export function interviewNodeKey(node: InterviewNodeId): string {
  return `interview.knoten.${node}`;
}

/**
 * Die vertiefenden Antworten als Abschnitte der Wissensseite — wörtlich, je Knoten eine Überschrift.
 * Die Herkunft (Erfahrung, Zeitpunkt, Rolle) steht als eigener Abschnitt und wird so von der
 * allgemeinen Aussage getrennt (Argus-Recherche).
 */
export function interviewDepthSections(
  depth: InterviewResult["depth"],
  label: (node: InterviewNodeId) => string,
): { heading: string; items: string[] }[] {
  const sections: { heading: string; items: string[] }[] = [];
  for (const ref of depth ?? []) {
    const text = ref.text.trim();
    if (!text) {
      continue;
    }
    const heading = label(ref.node);
    const existing = sections.find((s) => s.heading === heading);
    if (existing) {
      existing.items.push(text);
    } else {
      sections.push({ heading, items: [text] });
    }
  }
  return sections;
}

// AUFTRAG-mega6 Block B (bens ROT 2, Weg zwei): der ausdrückliche LÖSCHMARKER für einen zuvor
// gesicherten Interviewfortschritt. Beim Aktualisieren eines bestehenden Entwurfs reicht es NICHT,
// das Feld wegzulassen — der Server merged dann den Altwert zurück. Diese substanzlose Hülle
// überlebt normalizeInterview() bewusst nicht und entfernt den Altwert damit wirklich.
export const CLEARED_DRAFT_INTERVIEW: DraftInterviewState = { started: false, answers: [] };

// Beim Speichern: aus dem Laufzeitzustand die Entwurfs-Struktur bilden. null = kein Interview
// begonnen → das Feld bleibt komplett aus der Payload (exactOptionalPropertyTypes-freundlich).
export function interviewForDraft(input: {
  started: boolean;
  answers: readonly string[];
  answer: string;
  result: InterviewResult | null;
  imageContext?: string | null;
  tree?: boolean;
  topic?: string | null;
  confirmed?: boolean;
}): DraftInterviewState | null {
  const { started, answers, answer, result, tree, topic, confirmed } = input;
  if (!started && answers.length === 0 && answer.trim().length === 0 && !result) {
    return null;
  }
  const imageContext = input.imageContext?.trim() ?? "";
  return {
    started: true,
    answers: [...answers],
    ...(answer.trim().length > 0 ? { answer } : {}),
    ...(result?.question ? { question: result.question } : {}),
    ...(result ? { done: isInterviewDone(result), demo: result.demo } : {}),
    ...(imageContext.length > 0 ? { imageContext } : {}),
    ...(tree ? { tree: true } : {}),
    ...(topic?.trim() ? { topic: topic.trim() } : {}),
    ...(confirmed ? { confirmed: true } : {}),
  };
}

// Beim Fortsetzen: Entwurfs-Struktur → Laufzeitzustand. WICHTIG: hier wird NIE ein Modelllauf
// ausgelöst — liegt keine Frage vor (Speichern passierte, bevor die erste/nächste Frage ankam),
// bleibt result null; die Oberfläche bietet dann einen bewussten „Frage laden"-Klick an.
export function interviewFromDraft(
  state: DraftInterviewState,
  emptyDraft: InterviewResult["draft"],
): {
  started: boolean;
  answers: string[];
  answer: string;
  result: InterviewResult | null;
  imageContext: string | null;
  tree: boolean;
  topic: string | null;
  confirmed: boolean;
} {
  const answers = (state.answers ?? []).filter((a) => typeof a === "string");
  const tree = state.tree === true;
  const confirmed = state.confirmed === true;
  // AUFNAHME 20260922 · WISSEN-INTERVIEW: ein durchlaufener, aber NICHT bestätigter Fragebaum kommt
  // ohne Ergebnis zurück. Sein Entwurf samt Vertiefung steht nicht im Entwurf; der bewusste
  // „Frage laden"-Klick holt ihn wieder (der Baum ist durch — das Modell wird dabei nicht befragt).
  const hasResult =
    (typeof state.question === "string" || state.done === true) &&
    !(tree && !confirmed && state.done === true);
  const imageContext =
    typeof state.imageContext === "string" && state.imageContext.trim().length > 0
      ? state.imageContext.trim()
      : null;
  return {
    started: true,
    answers,
    answer: typeof state.answer === "string" ? state.answer : "",
    imageContext,
    tree,
    topic: typeof state.topic === "string" && state.topic.trim() ? state.topic.trim() : null,
    confirmed,
    result: hasResult
      ? {
          question: typeof state.question === "string" ? state.question : null,
          done: state.done ?? false,
          // Quelle der Fragen ehrlich wiederherstellen; fehlt das Flag (Alt-/fremde Payload),
          // lieber „Fallback" behaupten als fälschlich „echtes Modell".
          demo: state.demo ?? true,
          draft: emptyDraft,
        }
      : null,
  };
}

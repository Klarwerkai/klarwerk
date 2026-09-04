import type { KnowledgeObject, KoStatus } from "../api/types";

// SCRUM-527 (WP2-Design): die Live-Reaktion braucht eine ehrliche Einschätzung „neu vs. ähnlich" schon
// WÄHREND des Tippens. Es gibt (Stand 0b-Kartierung) KEINEN dedizierten Pro-Text-Ähnlichkeits-/
// Widerspruchs-Endpoint → diese reine, DOM-freie Heuristik vergleicht den Entwurfstext token-basiert
// gegen den geladenen Bestand. Der WIDERSPRUCH-Fall wird hier BEWUSST NICHT erfunden (kein Fake-Alarm):
// er ist im Typ vorgesehen und andockbereit an einen künftigen serverseitigen Widerspruchs-Check.

export type LiveVerdict =
  | { status: "idle" }
  | { status: "checking" }
  // "new" = ehrlich geprüft (status "done") UND nichts Ähnliches/Widersprüchliches gefunden.
  | { status: "new" }
  // G-2-EHRLICHKEIT (SCRUM-527): der Server hat NICHT auf Widerspruch geprüft (kein Modell/Cloud, weil
  // der Freitext unklassifiziert/vertraulich ist). Das ist NICHT „neu" — es ist „noch nicht geprüft".
  | { status: "pending" }
  // Die Prüfung ist fehlgeschlagen/nicht erreichbar — ehrlich sichtbar, nie als „neu" getarnt.
  | { status: "unavailable" }
  // JOB 3045: der Treffer trägt seinen FUNDORT mit — Kategorie und Zustand des getroffenen Objekts,
  // wörtlich in Name, Bedeutung und Nullbarkeit wie am Draht (api/types.ts KnowledgeCheckResult).
  // `null` heißt „dazu liegt keine Aussage vor"; die Fläche schweigt dann, statt zu raten.
  | {
      status: "similar";
      match: {
        koId: string;
        title: string;
        score: number;
        koStatus: KoStatus | null;
        koCategory: string | null;
      };
    }
  | {
      status: "conflict";
      match: {
        koId: string;
        title: string;
        score: number;
        koStatus: KoStatus | null;
        koCategory: string | null;
      };
    };

// Ab hier lohnt die Prüfung (zu kurzer Text → idle, kein Rauschen).
export const INTAKE_MIN_LENGTH = 15;
// Ab dieser Token-Überdeckung gilt ein Bestand-KO als „ähnlich".
export const INTAKE_SIMILAR_THRESHOLD = 0.34;

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9äöüß]+/i)
      .filter((part) => part.length > 2),
  );
}

// Jaccard-Tokenüberdeckung 0..1 (wie in der Duplikat-Heuristik) — reproduzierbar, ohne Modell.
export function textSimilarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

// Klassifiziert den Entwurfstext gegen den Bestand: idle (zu kurz) · similar (bester Treffer über
// Schwelle) · new. „checking"/„conflict" werden hier NICHT erzeugt (der Hook setzt checking; conflict
// bleibt dem serverseitigen Check vorbehalten).
export function classifyIntake(
  text: string,
  kos: readonly KnowledgeObject[] | undefined,
): LiveVerdict {
  if (text.trim().length < INTAKE_MIN_LENGTH) {
    return { status: "idle" };
  }
  let best: {
    koId: string;
    title: string;
    score: number;
    koStatus: KoStatus | null;
    koCategory: string | null;
  } | null = null;
  for (const ko of kos ?? []) {
    const score = textSimilarity(text, `${ko.title} ${ko.statement}`);
    if (!best || score > best.score) {
      // JOB 3045: dieser lokale Heuristikweg macht KEINE Fundortaussage. Der Fundort hat genau eine
      // Herkunft — den Serververtrag aus /api/knowledge/check; hier daneben eine zweite aus dem
      // geladenen Bestand abzuleiten, wäre exakt die zweite Wahrheit, die der Vertrag verbietet.
      // `null` heißt deshalb hier: „dieser Weg sagt zum Fundort nichts" — und die Fläche schweigt.
      best = { koId: ko.id, title: ko.title, score, koStatus: null, koCategory: null };
    }
  }
  if (best && best.score >= INTAKE_SIMILAR_THRESHOLD) {
    return { status: "similar", match: best };
  }
  return { status: "new" };
}

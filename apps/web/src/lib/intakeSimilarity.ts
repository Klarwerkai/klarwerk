import type { KnowledgeCheckCoverage, KoStatus } from "../api/types";

// SCRUM-527 (WP2-Design): die Live-Reaktion braucht eine ehrliche Einschätzung „neu vs. ähnlich" schon
// WÄHREND des Tippens. Damals gab es (Stand 0b-Kartierung) KEINEN dedizierten Pro-Text-Ähnlichkeits-/
// Widerspruchs-Endpoint; inzwischen urteilt der Server (`/api/knowledge/check`), und dieser Typ ist
// sein Urteil auf der Fläche. Der WIDERSPRUCH-Fall wird BEWUSST NICHT erfunden (kein Fake-Alarm).

export type LiveVerdict =
  | { status: "idle" }
  | { status: "checking" }
  // AUFNAHME 20260922 · VORSCHAU-REICHWEITE: hier stand `"new"` — „ehrlich geprüft UND nichts
  // gefunden". Das war es nie: die Vorschau vergleicht nur eine begrenzte Vorauswahl des Bestands.
  // "empty" heisst deshalb nur „in DIESEM Umfang kein Treffer", und der Umfang reist mit — die
  // Fläche nennt genau ihn und nichts darüber hinaus. `unknown` ist ausdrücklich keine Vollprüfung.
  | { status: "empty"; coverage: KnowledgeCheckCoverage }
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

// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier stand die lokale Heuristik `classifyIntake` samt
// `textSimilarity`, Tokenzerlegung und Schwelle `INTAKE_SIMILAR_THRESHOLD` — ein Vergleich des
// Entwurfstexts gegen den geladenen Bestand. Kein Produktweg rief sie: der Live-Check fragt den
// Server (`hooks/useLiveKnowledgeCheck.ts`, `endpoints.knowledge.check`; R-0991 Nr. 31), und der
// Fundort hat dort genau eine Herkunft (JOB 3045). Sie ist mit ihrem Komponententest entfernt.
// Geblieben sind der Urteilstyp oben und die Mindestlänge, die der Hook liest.

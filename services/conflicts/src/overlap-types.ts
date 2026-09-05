// Berater-Konzept Duplikate 04.07. (Stufe D3): Überschneidungs-Eintrag als eigene Entität im
// conflicts-Modul (teilt Ledger/Worker/Integritäts-Routine mit Konflikten, produktseitig getrennt).
// Bewusst schlanker Lebenszyklus als Konflikte: kein Eskalieren/Zweitmeinung — es geht um Redaktion,
// nicht um Wahrheit. Additiv/JSON-persistiert (Muster ConflictDetector).
import type { OverlapAspect, OverlapRecommendation, OverlapRelation } from "./duplicate-detect";

export type OverlapStatus = "offen" | "in_bearbeitung" | "geschlossen";
export type OverlapOrigin = "auto" | "manual";

export type OverlapResolutionReason =
  | "merged" // zusammengeführt (Assistent, Stufe D5)
  | "kept_separate" // Mensch: bewusst getrennt gelassen
  | "linked_related" // Mensch: als verwandt markiert
  | "dismissed" // Fehlalarm — keine echte Überschneidung
  | "participant_deleted" // Beteiligter gelöscht (Integritäts-Routine)
  // JOB 3071: der Autor hat seinen EIGENEN Beitrag zurückgezogen (menschliche Entscheidung über
  // eigenes Wissen; `by` trägt seine Kennung). Bewusst getrennt von `participant_deleted`: dort
  // hat eine Routine aufgeräumt, hier hat ein Mensch entschieden — und über niemandes Wissen ausser
  // seinem eigenen. Stünde weiter `participant_deleted` mit `by: null`, behaupteten Befund, Audit
  // und jede spätere Auskunft, es sei niemand gewesen.
  | "withdrawn_own"
  | "superseded"; // durch anderen Vorgang gegenstandslos

// Metadaten der automatischen Erkennung (Herkunfts-Badge + Reproduzierbarkeit). Keine Secrets.
export interface OverlapDetector {
  trigger: "validation" | "background" | "capture_hint" | "manual";
  method: "model" | "deterministic";
  modelLabel?: string;
  promptVersion?: string;
  lexicalScore: number; // 0..1 deterministische Textdeckung (immer gesetzt, reproduzierbar)
  // Modell-Sicherheit/-Begründung. Bei method="model" trägt sie das anlegende Urteil; bei
  // method="deterministic" ist sie die ADDITIV notierte KI-Zweiteinordnung desselben Kandidaten
  // (D-AISTATE PAKET 2, bens V2: die KI beurteilt JEDEN hervorgeholten Kandidaten zusätzlich —
  // ein deterministischer Treffer wird dadurch nie verworfen, die Einordnung bleibt sichtbar).
  confidence?: number;
  rationale?: string;
}

export interface OverlapResolution {
  reason: OverlapResolutionReason;
  // JOB 3071: `null` NUR NOCH bei den beiden systemischen Abschlüssen (participant_deleted/
  // superseded). `withdrawn_own` ist trotz seiner automatischen Auslösung KEIN systemischer
  // Abschluss — er trägt die Kennung der Autorin, die ihren Beitrag zurückgezogen hat.
  by: string | null;
  note: string | null;
  at: string;
}

export interface OverlapEntry {
  id: string;
  koA: string;
  koB: string;
  relation: OverlapRelation;
  aspects: OverlapAspect[]; // belegte gemeinsame Aussagen (wörtliche Zitate)
  eigenanteilA: string; // was nur in A steht (zentral für die Merge-Entscheidung)
  eigenanteilB: string;
  recommendation: OverlapRecommendation;
  status: OverlapStatus;
  pairKey: string; // "dup|" + sortierte KO-IDs (EIN offener Eintrag je Paar)
  origin: OverlapOrigin;
  detector?: OverlapDetector;
  resolution?: OverlapResolution;
  // D-AISTATE PAKET 4 (bens V5, 23.07.): geprüfte KO-Versionen beider Seiten (additiv/optional —
  // Altbestand ohne Felder blockt konservativ wie bisher). Trägt die Stale-Erkennung der Paar-Dedupe.
  koAVersion?: number;
  koBVersion?: number;
  createdAt: string;
  closedAt?: string;
}

export interface OverlapInput {
  koA: string;
  koB: string;
  relation: OverlapRelation;
  aspects: OverlapAspect[];
  eigenanteilA: string;
  eigenanteilB: string;
  recommendation: OverlapRecommendation;
  // D-AISTATE PAKET 4 (bens V5): geprüfte KO-Versionen (additiv, optional).
  koAVersion?: number;
  koBVersion?: number;
}

// JOB 3061 · H2 (bens Korrekturpflicht 1 aus Runde 5): die Abschlussgründe, die ein MENSCH wählen
// darf. Bewusst eine ECHTE Teilmenge von `OverlapResolutionReason` — `merged` gehört dem Assistenten
// (Stufe D5), `participant_deleted` und `superseded` den Integritäts-Routinen. Stünden sie zur Wahl,
// schriebe die Fläche einen Vorgang ins Protokoll, der nie stattgefunden hat; das wäre genau die
// Sorte Scheinaussage, die dieses Produkt nicht macht. Der Wächter dafür ist das `satisfies` — wer
// hier einen systemischen Grund einträgt, bekommt keinen Kommentar, sondern einen Compilerfehler.
//
// JOB 3071: `withdrawn_own` gehört AUSDRÜCKLICH NICHT hierher, obwohl ein Mensch dahintersteht.
// Diese Liste ist die Auswahl an der Prüfen-Fläche — was ein Kurator über ein PAAR entscheidet.
// Der Rückzug ist keine Entscheidung über das Paar, sondern die WIRKUNG einer anderen Handlung
// (der Autor löscht seinen Beitrag). Stünde er zur Wahl, könnte ein Kurator eine Rücknahme
// behaupten, die nie stattgefunden hat — dieselbe Sorte Scheinaussage, gegen die diese Liste steht.
export const HUMAN_OVERLAP_CLOSE_REASONS = [
  "kept_separate",
  "linked_related",
  "dismissed",
] as const satisfies readonly OverlapResolutionReason[];

export type HumanOverlapCloseReason = (typeof HUMAN_OVERLAP_CLOSE_REASONS)[number];

/** Trägt ein beliebiger Wert (Drahtfeld, Formularwert) einen menschlich wählbaren Abschlussgrund? */
export function isHumanOverlapCloseReason(value: unknown): value is HumanOverlapCloseReason {
  return (HUMAN_OVERLAP_CLOSE_REASONS as readonly string[]).includes(value as string);
}

export type OverlapErrorCode =
  | "NOT_FOUND"
  | "ALREADY_CLOSED"
  | "INVALID_SETTINGS"
  // JOB 3061 · H2: Zielzustand nicht setzbar bzw. Abschlussgrund fehlt/nicht wählbar. Ohne Eintrag
  // in `STATUS_BY_CODE` (services/app/src/http.ts) fällt der Code auf 400 — und 400 ist hier die
  // Wahrheit: die Anfrage selbst ist mangelhaft, nicht der Zustand des Eintrags.
  | "INVALID_STATUS";

export class OverlapError extends Error {
  readonly code: OverlapErrorCode;

  constructor(code: OverlapErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "OverlapError";
  }
}

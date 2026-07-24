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
  by: string | null; // null bei systemischen Abschlüssen (participant_deleted/superseded)
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

export type OverlapErrorCode = "NOT_FOUND" | "ALREADY_CLOSED" | "INVALID_SETTINGS";

export class OverlapError extends Error {
  readonly code: OverlapErrorCode;

  constructor(code: OverlapErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "OverlapError";
  }
}

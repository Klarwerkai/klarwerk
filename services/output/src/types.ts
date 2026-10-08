// FR-EXT-03 / FE-OUT: Output Factory. Erzeugt strukturierte Dokumente AUSSCHLIESSLICH
// aus validierten Wissensobjekten — kein roher Library-Export, kein Fake.
import type { KnowledgeObject } from "../../knowledge-object";

export type OutputKind =
  | "instruction" // Arbeitsanweisung / SOP (FE-OUT-01)
  | "checklist"
  | "troubleshooting"
  | "training"
  | "management_summary";

export const OUTPUT_KINDS: readonly OutputKind[] = [
  "instruction",
  "checklist",
  "troubleshooting",
  "training",
  "management_summary",
];

// Trust unter diesem Wert wird je Quelle als Unsicherheit markiert (FE-OUT-03).
export const UNCERTAIN_TRUST_BELOW = 60;

// Auswahl-Deskriptor für die Quellenliste (nur validierte KOs).
export interface OutputSource {
  id: string;
  title: string;
  status: string;
  trust: number;
  version: number;
  category: string;
  type: string;
}

// Herkunftsnachweis je Quelle (FE-OUT-03).
export interface OutputProvenance {
  koId: string;
  title: string;
  status: string; // immer "validiert"
  trust: number;
  version: number;
  author: string;
  originalAuthor: string;
  category: string;
  type: string;
  validity: string; // abgeleitet: "validiert · v{version} · Stand {createdAt}" — kein Ablaufdatum
  uncertain: boolean; // Trust < UNCERTAIN_TRUST_BELOW
}

export interface OutputDocument {
  kind: OutputKind;
  title: string;
  audienceRole: string | null;
  generatedAt: string;
  markdown: string;
  provenance: OutputProvenance[];
}

export interface GenerateOutputInput {
  kind: OutputKind;
  koIds: readonly string[];
  audienceRole?: string | null;
}

// aufnahme:20260922:gesamt-leserechte — DIE LESEPOLICY DES BETRACHTERS, als Datum hereingereicht.
//
// Die Ausgabewege prüften bis hierher nur die Stufe am Objekt (`isConfidential`), nicht den
// Menschen davor: der führende Space (produkt:20261007:spaces) galt hier nicht, und eine unbekannte
// Kennung, eine nicht validierte und eine vertrauliche antworteten verschieden — eine
// Existenzauskunft über Objekte, die der Fragende nicht sehen darf (die SCORM-Prüfung nannte dabei
// sogar den Titel). Die Regel selbst wohnt in services/app/src/sichtbarkeit.ts (`darfSehen`); die
// Route reicht sie als `sichtbarkeitsfilterFuer(user)` herein. Ein eigenes Prädikat steht hier
// bewusst nicht — das wäre die zweite Auslegung derselben Regel.
//
// PFLICHT, nicht optional (dieselbe Lehre wie mega76 Block A): fehlt sie oder ist sie keine
// Funktion, ist NICHTS sichtbar.
export type OutputSichtbarkeit = (ko: KnowledgeObject) => boolean;

/** Fail-closed: ein Objekt ist nur sichtbar, wenn ein tauglicher Filter es ausdrücklich zulässt. */
export function fuerBetrachterSichtbar(
  sichtbar: OutputSichtbarkeit | undefined,
  ko: KnowledgeObject,
): boolean {
  return typeof sichtbar === "function" && sichtbar(ko) === true;
}

export type OutputErrorCode =
  | "NO_SOURCES"
  | "NOT_VALIDATED"
  | "UNKNOWN_KO"
  | "UNKNOWN_KIND"
  // SCRUM-415: vertrauliche KOs dürfen nicht in einen (teilbaren) Output — externe Kontexte tabu.
  | "CONFIDENTIAL";

export class OutputError extends Error {
  readonly code: OutputErrorCode;
  constructor(code: OutputErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "OutputError";
  }
}

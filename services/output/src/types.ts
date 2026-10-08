// FR-EXT-03 / FE-OUT: Output Factory. Erzeugt strukturierte Dokumente AUSSCHLIESSLICH
// aus validierten Wissensobjekten — kein roher Library-Export, kein Fake.

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
  // Aufnahme gesamt-wissen-herkunft (R-0298 / FR-LIF-04): die angezeigten Autorentexte. Nur gesetzt,
  // wenn der Dienst eine Namensauflösung bekommen hat; die Kennungen darüber bleiben unverändert.
  authorName?: string;
  originalAuthorName?: string;
  category: string;
  type: string;
  validity: string; // abgeleitet: "validiert · v{version} · Stand {createdAt}" — kein Ablaufdatum
  uncertain: boolean; // Trust < UNCERTAIN_TRUST_BELOW
}

/**
 * Aufnahme gesamt-wissen-herkunft: Kennung → angezeigter Autorentext (Name, „Gelöschtes Konto",
 * „Unbekannte Person" oder „nicht abrufbar"). Die Kompositionswurzel liefert sie; dieser Dienst
 * kennt den Kontodienst nicht. Fehlt eine Kennung in der Antwort, bleibt es bei der Kennung.
 */
export type AutorenNamen = (ids: readonly string[]) => Promise<ReadonlyMap<string, string>>;

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

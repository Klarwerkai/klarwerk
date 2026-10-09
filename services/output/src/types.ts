// FR-EXT-03 / FE-OUT: Output Factory. Erzeugt strukturierte Dokumente AUSSCHLIESSLICH
// aus validierten Wissensobjekten — kein roher Library-Export, kein Fake.

export type OutputKind =
  | "instruction" // Arbeitsanweisung / SOP (FE-OUT-01)
  | "checklist"
  | "troubleshooting"
  | "training"
  | "management_summary"
  // aufnahme:20260922:gesamt-dokumenterzeugung (R-0732, SOLL:FR-EXT-03): die FAQ war als
  // Dokumentart beauftragt, im Dienst aber nicht vorhanden.
  | "faq"
  // R-0350 / R-0349: die Betriebsmitteilung — Anrede, Sie-Form, Betreff, geltende Punkte, was zu
  // tun ist, Ansprechpartner, Gruß. Ein ENTWURF, regelbasiert aus geprüftem Wissen (kein Modell).
  | "betriebsmitteilung";

export const OUTPUT_KINDS: readonly OutputKind[] = [
  "instruction",
  "checklist",
  "troubleshooting",
  "training",
  "management_summary",
  "faq",
  "betriebsmitteilung",
];

/**
 * R-0337: was der Validierungsnachweis einer Quelle belegt. `OK` trägt das Datum der Entscheidung
 * aus dem Auditeintrag (über `validationDecisionRef` adressiert und gegen die Kette geprüft); jeder
 * andere Zustand heißt: für DIESE Fassung ist kein Prüfdatum belegt.
 */
export type OutputPruefnachweis =
  | { zustand: "OK"; am: string; ereignis: string }
  | { zustand: "MISSING" | "HASH_MISMATCH" | "WRONG_EVENT_TYPE" | "WRONG_SUBJECT" };

/**
 * R-0337 / R-1739: was an einer Quelle NICHT vollständig belegt ist. Codes statt Sätzen, damit jede
 * Oberfläche (Markdown hier, Word-Panel in drei Sprachen) denselben Befund in ihrer Sprache sagt.
 */
export type OutputUnsicherheit =
  /** Trust unter UNCERTAIN_TRUST_BELOW. */
  | "niedriger_trust"
  /** `geltung` fehlt am Objekt — der Gültigkeitsbereich ist unbekannt, nicht „überall". */
  | "geltung_fehlt"
  /** `ownership.owner` fehlt — Verantwortung nicht benannt (kein Rückfall auf den Autor). */
  | "verantwortung_fehlt"
  /** `ownership.ownerRole` fehlt — die verantwortliche Rolle ist nicht benannt. */
  | "rolle_fehlt"
  /** Kein Validierungsnachweis am Objekt bzw. im Audit nicht auffindbar — kein Prüfdatum belegt. */
  | "pruefdatum_fehlt"
  /** Der Validierungsnachweis gilt einer FRÜHEREN Fassung (WRONG_SUBJECT). */
  | "pruefnachweis_fremde_fassung"
  /** Der Validierungsnachweis hält der Auditprüfung nicht stand (Hash/Kette/Ereignis). */
  | "pruefnachweis_ungueltig";

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
  // ---- R-0337 / R-1739 (aufnahme:20260922:gesamt-dokumenterzeugung): die Pflichtangaben je Quelle,
  // aus den Feldern des Wissensobjekts übernommen. `null` heißt: am Objekt NICHT festgehalten —
  // es wird nichts abgeleitet oder geraten; `unsicherheiten` nennt jede solche Lücke.
  /** Gültigkeitsbereich aus `geltung` (Konzern/Werk/Schicht, ggf. Rolle) — null: nicht angegeben. */
  geltungsbereich: string | null;
  /** Verantwortung aus `ownership.owner` — null: nicht benannt (bewusst kein Rückfall auf `author`). */
  verantwortlich: string | null;
  /** Verantwortliche Rolle aus `ownership.ownerRole` — null: nicht benannt. */
  verantwortlicheRolle: string | null;
  /**
   * R-0349 / R-0414: die Marke dieser Quelle im Dokument („Q1", „Q2" …). Jede tragende Passage im
   * Rumpf trägt `[Qn: koId · vVersion]`; der Herkunftsblock beginnt je Quelle mit `[Qn]`.
   */
  marke: string;
  /** Wer die Validierung getragen hat (`ownership.validators`) — leer: nicht festgehalten. */
  validiertVon: string[];
  /** Datum der aktuellen Fassung (History-Eintrag dieser Version; v1 ohne Eintrag: `createdAt`). */
  fassungVom: string | null;
  /**
   * Datum der letzten fachlichen Prüfung — aus dem Auditeintrag, auf den `validationDecisionRef`
   * zeigt, wenn er geprüft für DIESE Fassung gilt (`pruefeValidationDecisionRef` = OK). Sonst null,
   * und `unsicherheiten` sagt, warum (fehlt / frühere Fassung / ungültig).
   */
  letztePruefungAm: string | null;
  /** Jede offene Unsicherheit dieser Quelle — leer heißt: alle Pflichtangaben belegt. */
  unsicherheiten: OutputUnsicherheit[];
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
  /** R-0349: das Vorhaben in Alltagssprache (Betreff/Anlass einer Betriebsmitteilung). Optional. */
  anlass?: string | null;
}

export type OutputErrorCode =
  | "NO_SOURCES"
  | "NOT_VALIDATED"
  | "UNKNOWN_KO"
  | "UNKNOWN_KIND"
  // RECHERCHE:pmo-fea-0004: ungültiger Zeitraum des Wissensupdates (`bis` kein JJJJ-MM-TT).
  | "BAD_REQUEST"
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

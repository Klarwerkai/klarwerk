// ================================================================================================
// AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — DER REIN DARSTELLENDE KERN DES IMPORTRESULTATS.
// ================================================================================================
//
// WAS DIESE DATEI IST: eine Übersetzung. Sie bildet ein serverseitig geliefertes Importresultat
// (`KW-W2-17`) auf Anzeige-Schlüssel ab. Sie holt nichts, sie rechnet nichts aus, sie entscheidet
// nichts fachlich.
//
// WAS SIE AUSDRÜCKLICH NICHT TUT (Auftrag §7, `KW-W2-17` No-Gos):
//   · keine Extraktion — die Aussagen kommen fertig aus dem Vertrag;
//   · keine Validierung — der Status wird GELESEN, nie hergeleitet;
//   · keine Konflikt- oder Gap-Berechnung — es werden ausschließlich gelieferte IDs gezählt;
//   · keine Statusableitung — `COMPLETED` sagt der Server, nicht diese Datei;
//   · keine Sortierung — die gelieferte Reihenfolge IST die Reihenfolge (`extractionOrder` ist
//     serverseitig bereits angewandt; hier nachzusortieren hieße, eine zweite Wahrheit zu bilden).
//
// DIE GRUNDREGEL IN EINE RICHTUNG: was der Server nicht gesagt hat, wird nicht behauptet. Ein
// fehlender Pflichtwert wird SICHTBAR als fehlend benannt — nie weggelassen, nie ersetzt, nie
// stillschweigend zu einem Erfolg gerundet.

// ------------------------------------------------------------------------------------------------
// Der Vertrag, so wie KW-W2-17 ihn festlegt
// ------------------------------------------------------------------------------------------------

/** Die neun Laufzustände aus `KW-W2-17`, Abschnitt „Persistenter Importvertrag". */
export const IMPORT_RUN_STATUS = [
  "QUEUED",
  "FETCHING",
  "PERSISTING_SOURCE",
  "EXTRACTING",
  "CREATING_KNOWLEDGE",
  "ANALYZING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
] as const;

export type ImportRunStatus = (typeof IMPORT_RUN_STATUS)[number];

// R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 10): hier standen außerdem die Ableitungen
// der alten W2-Resultatfläche — `importResultView`, `sourceBlockView`, `knowledgeBlockView` samt
// ihren Ein- und Ausgabetypen. Die Fläche selbst (`components/confluence-import/ImportResultView.tsx`
// mit `SourceRecordCard` und `KnowledgeItemList`) wurde nie montiert. Den beauftragten Weg „Original
// und abgeleitete Wissenseinheiten auf einer Fläche“ (R-0142) hat der Auftrag gesamt-confluence-import
// mit 1.0.0-beta.1.723 als `components/bibliothek/ImportErgebnis.tsx` geliefert; er liest seine
// Daten selbst (`endpoints.admin.import.knowledgeResult`) und ist in `MehrAbschnitte.tsx` montiert.
// Altfläche und ihre Ableitungen sind deshalb entfernt. Was beide Wege teilen, bleibt: die
// Laufzustände und ihre Anzeige (`importRunStateView`, `RunStateBanner`).

// ------------------------------------------------------------------------------------------------
// Der Laufzustand
// ------------------------------------------------------------------------------------------------

/**
 * Der Ton ist die ZWEITE Spur, nie die einzige (Auftrag §6). Jeder Zustand trägt deshalb immer
 * auch einen eigenen Text- und einen eigenen Zeichen-Schlüssel; die Farbe kommt obendrauf.
 */
export type ImportRunTone = "neutral" | "running" | "ok" | "warn" | "error";

export interface ImportRunStateView {
  /** i18n-Schlüssel des Zustandsnamens. */
  readonly labelKey: string;
  /** i18n-Schlüssel der Erklärung — was dieser Zustand für das Gezeigte bedeutet. */
  readonly hintKey: string;
  readonly tone: ImportRunTone;
  /** Der Lauf ist noch unterwegs; das Gezeigte ist ein Zwischenstand, kein Ergebnis. */
  readonly running: boolean;
  /**
   * NUR `COMPLETED` ist ein Erfolg. `PARTIAL` und `FAILED` sind es nie (Auftrag §5), ein
   * unbekannter Wert ebenso wenig — Nichtwissen ist kein Erfolg.
   */
  readonly success: boolean;
  /** Der Zustand konnte nicht zugeordnet werden — benannt statt verschwiegen. */
  readonly unknown: boolean;
}

const LAUFEND: readonly ImportRunStatus[] = [
  "QUEUED",
  "FETCHING",
  "PERSISTING_SOURCE",
  "EXTRACTING",
  "CREATING_KNOWLEDGE",
  "ANALYZING",
];

export function isImportRunStatus(wert: unknown): wert is ImportRunStatus {
  return typeof wert === "string" && (IMPORT_RUN_STATUS as readonly string[]).includes(wert);
}

export function importRunStateView(status: unknown): ImportRunStateView {
  if (!isImportRunStatus(status)) {
    // Fail-safe: ein Zustand, den diese Fassung nicht kennt, wird BENANNT. Er gilt weder als
    // Erfolg noch als laufend — beides wäre eine Behauptung über etwas Ungelesenes.
    return {
      labelKey: "w2.run.status.unknown",
      hintKey: "w2.run.hint.unknown",
      tone: "warn",
      running: false,
      success: false,
      unknown: true,
    };
  }
  const laufend = LAUFEND.includes(status);
  const tone: ImportRunTone = laufend
    ? "running"
    : status === "COMPLETED"
      ? "ok"
      : status === "PARTIAL"
        ? "warn"
        : "error";
  return {
    labelKey: `w2.run.status.${status}`,
    hintKey: `w2.run.hint.${status}`,
    tone,
    running: laufend,
    success: status === "COMPLETED",
    unknown: false,
  };
}

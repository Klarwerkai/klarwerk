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

/**
 * Die Sicht auf den `ExternalSourceRecord`. Jedes Feld ist optional, weil der View-Kern auch eine
 * unvollständige Antwort ehrlich darstellen können muss — die Optionalität ist hier kein
 * Bequemlichkeitsdefault, sondern die Voraussetzung dafür, Fehlendes benennen zu können.
 */
export interface ExternalSourceView {
  readonly sourceRecordId?: string | null;
  readonly sourceSystem?: string | null;
  readonly externalId?: string | null;
  readonly sourceVersion?: string | null;
  readonly url?: string | null;
  readonly title?: string | null;
  readonly importedAt?: string | null;
}

/** Die Sicht auf ein `ImportCandidateItem` samt der dazu gelesenen Domänenreferenzen. */
export interface KnowledgeItemView {
  readonly candidateItemId?: string | null;
  readonly knowledgeObjectId?: string | null;
  readonly extractedStatement?: string | null;
  readonly locator?: string | null;
  /** GELESEN, nicht hergeleitet — der Wert kommt aus dem Ergebnisvertrag. */
  readonly validationStatus?: string | null;
  readonly conflictIds?: readonly string[] | null;
  readonly knowledgeGapIds?: readonly string[] | null;
}

export interface ImportRunView {
  readonly importId?: string | null;
  readonly status?: string | null;
  readonly failureCode?: string | null;
  readonly failureReason?: string | null;
}

export interface ImportResultViewInput {
  readonly run?: ImportRunView | null;
  readonly source?: ExternalSourceView | null;
  readonly items?: readonly KnowledgeItemView[] | null;
}

// ------------------------------------------------------------------------------------------------
// Werkzeug
// ------------------------------------------------------------------------------------------------

/** Ein Wert zählt nur als geliefert, wenn er eine nicht-leere Zeichenkette ist. */
function geliefert(wert: unknown): wert is string {
  return typeof wert === "string" && wert.trim().length > 0;
}

function anzahl(ids: readonly string[] | null | undefined): number {
  return Array.isArray(ids) ? ids.filter(geliefert).length : 0;
}

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

// ------------------------------------------------------------------------------------------------
// Das Original
// ------------------------------------------------------------------------------------------------

/** Ein einzelnes Feld des Originals — geliefert oder ausdrücklich als fehlend benannt. */
export interface SourceFieldView {
  readonly labelKey: string;
  /** Der gelieferte Wert, WÖRTLICH. `null`, wenn nichts geliefert wurde. */
  readonly value: string | null;
  /** Nur gesetzt, wenn nichts geliefert wurde — der sichtbare Text an der Leerstelle. */
  readonly missingKey: string | null;
  /** Pflichtangaben nach `KW-W2-17`; ihr Fehlen ist ein sichtbarer Mangel, kein Detail. */
  readonly required: boolean;
  /**
   * Wie das Feld darzustellen ist. `"url"` geht durch die vorhandene gehärtete Anzeige
   * (`ExternalUrlText`), die unsichere Schemata neutralisiert — die Entscheidung steht hier in der
   * reinen Schicht, damit die Komponente sie nicht selbst treffen muss.
   */
  readonly kind: "text" | "url";
}

export interface SourceBlockView {
  /** Der Server hat überhaupt eine Quelle geliefert. */
  readonly present: boolean;
  /** Nur gesetzt, wenn keine Quelle geliefert wurde. */
  readonly missingKey: string | null;
  readonly fields: readonly SourceFieldView[];
  /** Wie viele Pflichtangaben fehlen — für einen ehrlichen Sammelhinweis. */
  readonly missingRequiredCount: number;
}

/**
 * Titel, System, Version, URL und Importzeit (Auftrag §3). Alle fünf sind Pflicht: sie sind genau
 * die Angaben, an denen ein Mensch erkennt, WELCHE Revision er vor sich hat. Fehlt eine, steht das
 * da — ein stillschweigend weggelassenes Feld sähe aus wie ein vollständiges Original.
 */
export function sourceBlockView(source: ExternalSourceView | null | undefined): SourceBlockView {
  if (!source) {
    return {
      present: false,
      missingKey: "w2.source.missing",
      fields: [],
      missingRequiredCount: 0,
    };
  }
  const roh: ReadonlyArray<{
    labelKey: string;
    wert: unknown;
    required: boolean;
    kind: "text" | "url";
  }> = [
    { labelKey: "w2.source.title", wert: source.title, required: true, kind: "text" },
    { labelKey: "w2.source.system", wert: source.sourceSystem, required: true, kind: "text" },
    { labelKey: "w2.source.version", wert: source.sourceVersion, required: true, kind: "text" },
    { labelKey: "w2.source.url", wert: source.url, required: true, kind: "url" },
    { labelKey: "w2.source.importedAt", wert: source.importedAt, required: true, kind: "text" },
    { labelKey: "w2.source.externalId", wert: source.externalId, required: false, kind: "text" },
  ];
  const fields = roh.map((f) => ({
    labelKey: f.labelKey,
    value: geliefert(f.wert) ? f.wert : null,
    missingKey: geliefert(f.wert) ? null : f.required ? "w2.value.missing" : "w2.value.none",
    required: f.required,
    kind: f.kind,
  }));
  return {
    present: true,
    missingKey: null,
    fields,
    missingRequiredCount: fields.filter((f) => f.required && f.value === null).length,
  };
}

// ------------------------------------------------------------------------------------------------
// Die Wissenseinheiten
// ------------------------------------------------------------------------------------------------

export interface KnowledgeItemBlockView {
  /**
   * Der Listenschlüssel der Darstellung — NICHT die fachliche Id (die steht in `candidateItemId`).
   *
   * Er trägt die Position voran und ist damit auch dann eindeutig, wenn der Server zwei Einheiten
   * mit derselben `candidateItemId` liefert. Ohne diese Voranstellung würde React zwei gleich
   * beschlüsselte Zeilen zusammenziehen — aus `n` gelieferten Einheiten würden sichtbar weniger,
   * und genau das ist die Zusage, um die es in dieser Welle geht (Auftrag §2). Eine Umsortierung
   * gibt es hier nicht, deshalb kostet die positionsgebundene Bildung nichts.
   */
  readonly key: string;
  /** Die gelieferte fachliche Id, WÖRTLICH. `null`, wenn keine geliefert wurde. */
  readonly candidateItemId: string | null;
  /** Die laufende Nummer der GELIEFERTEN Reihenfolge, 1-basiert. Keine Sortierung. */
  readonly position: number;
  readonly statement: string | null;
  readonly statementMissingKey: string | null;
  readonly locator: string | null;
  /** Gesetzt, wenn keine Fundstelle geliefert wurde — ausdrücklich benannt (Auftrag §4). */
  readonly locatorMissingKey: string | null;
  /** GELESEN. `null`, wenn der Vertrag nichts sagt — dann wird kein Status behauptet. */
  readonly validationStatus: string | null;
  readonly validationMissingKey: string | null;
  readonly conflictCount: number;
  readonly gapCount: number;
}

export interface KnowledgeBlockView {
  readonly items: readonly KnowledgeItemBlockView[];
  /** Kein Element — das ist NICHT dasselbe wie Erfolg (Auftrag §5). */
  readonly empty: boolean;
  readonly emptyKey: string | null;
  readonly count: number;
}

export function knowledgeBlockView(
  items: readonly KnowledgeItemView[] | null | undefined,
): KnowledgeBlockView {
  // Bewusst KEIN `.sort()`: die gelieferte Reihenfolge bleibt erhalten (Auftrag §2). Der Server
  // hat `extractionOrder` bereits angewandt; hier nachzusortieren hieße, ihm zu widersprechen.
  const liste = Array.isArray(items) ? items : [];
  const gebaut = liste.map((item, index) => ({
    key: geliefert(item.candidateItemId)
      ? `${index + 1}-${item.candidateItemId}`
      : `${index + 1}-ohne-id`,
    candidateItemId: geliefert(item.candidateItemId) ? item.candidateItemId : null,
    position: index + 1,
    statement: geliefert(item.extractedStatement) ? item.extractedStatement : null,
    statementMissingKey: geliefert(item.extractedStatement) ? null : "w2.item.statementMissing",
    locator: geliefert(item.locator) ? item.locator : null,
    locatorMissingKey: geliefert(item.locator) ? null : "w2.item.locatorMissing",
    validationStatus: geliefert(item.validationStatus) ? item.validationStatus : null,
    validationMissingKey: geliefert(item.validationStatus) ? null : "w2.item.statusMissing",
    conflictCount: anzahl(item.conflictIds),
    gapCount: anzahl(item.knowledgeGapIds),
  }));
  return {
    items: gebaut,
    empty: gebaut.length === 0,
    emptyKey: gebaut.length === 0 ? "w2.knowledge.empty" : null,
    count: gebaut.length,
  };
}

// ------------------------------------------------------------------------------------------------
// Das Ganze
// ------------------------------------------------------------------------------------------------

export interface ImportResultView {
  readonly runState: ImportRunStateView;
  readonly failureCode: string | null;
  readonly failureReason: string | null;
  readonly source: SourceBlockView;
  readonly knowledge: KnowledgeBlockView;
}

export function importResultView(
  input: ImportResultViewInput | null | undefined,
): ImportResultView {
  const run = input?.run ?? null;
  return {
    runState: importRunStateView(run?.status),
    // Grund und Code werden WÖRTLICH durchgereicht. Kein Ersatztext: ein erfundener Grund wäre
    // schlimmer als ein fehlender, weil er wie eine Erklärung aussähe.
    failureCode: geliefert(run?.failureCode) ? run.failureCode : null,
    failureReason: geliefert(run?.failureReason) ? run.failureReason : null,
    source: sourceBlockView(input?.source),
    knowledge: knowledgeBlockView(input?.items),
  };
}

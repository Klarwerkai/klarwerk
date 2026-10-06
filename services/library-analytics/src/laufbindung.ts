// ================================================================================================
// R-0142 (Lauf 5, Bens B7) — DER IMPORTLAUF KENNT, WAS AUS SEINEN SEITEN GEWORDEN IST.
// ================================================================================================
//
// Bis hierher legte der Confluence-Lauf Kandidaten an und schrieb weder eine Quellrevision
// (`ExternalSourceRecord`) noch eine Elementreferenz (`ImportRunItemRef`). Die Ergebnisroute lieferte
// deshalb auch nach Annahme `items: []` — der Lauf wusste nicht, welches Wissensobjekt aus ihm
// entstanden war.
//
// DIE REGEL, ohne den eingefrorenen Vertrag (FREEZE-144) zu ändern:
//   · Beim Einreihen hält der Lauf je Seite die Quellrevision fest (unveränderlich, idempotent über
//     die Revisionsidentität) und bindet den Kandidaten an `importId` + `ordinal` + Revision.
//   · Erst die menschliche ENTSCHEIDUNG erzeugt die Elementreferenz — mit dem Ausgang, der dann
//     tatsächlich feststeht: `CREATED` (dieser Kandidat hat das Objekt angelegt), `BOUND` (ein
//     vorhandenes Objekt wurde fortgeschrieben bzw. adoptiert), `SKIPPED` (abgelehnt oder als
//     Dublette nicht angelegt). Ein noch offener Kandidat hat KEINEN Ausgang; `IMPORT_ITEM_OUTCOMES`
//     kennt dafür bewusst keinen Wert, und hier wird keiner erfunden.
//
// Die Bindung ist eine INTERNE Angabe des Servers. Am JSON-Eingang wäre sie die Behauptung eines
// Clients über einen fremden Lauf; `saeubereQuellangaben` entfernt sie deshalb immer, und nur
// `createImportCandidates` setzt sie — nach der Säuberung.
//
// Die Quellrevision schreibt seit der Zusammenführung mit R-0169 GENAU EIN Weg:
// `LibraryService.quellrevisionFestschreiben` (Schlüssel `importProviderKey`, Inhaltsabdruck
// `quellinhaltAbdruck`) — beim Einreihen (`bindeAnLauf`) wie bei der Annahme.
import type { ImportItemOutcome } from "./types";

/** Die Bindung eines Kandidaten an seinen Lauf. */
export interface ImportLaufBindung {
  importId: string;
  ordinal: number;
  sourceRecordId: string | null;
}

/** Der Lauf, in dessen Namen `createImportCandidates` einreiht; `ordinal` ist der Startwert. */
export interface ImportLaufAuftrag {
  importId: string;
  ordinal?: number;
}

/** Fail-closed gelesen: nur eine vollständige, typrichtige Bindung zählt. */
export function leseLaufBindung(item: unknown): ImportLaufBindung | undefined {
  const b = (item as { importRun?: unknown } | null)?.importRun as
    | Partial<ImportLaufBindung>
    | undefined;
  if (
    !b ||
    typeof b.importId !== "string" ||
    b.importId.length === 0 ||
    typeof b.ordinal !== "number" ||
    !Number.isInteger(b.ordinal) ||
    b.ordinal < 0
  ) {
    return undefined;
  }
  return {
    importId: b.importId,
    ordinal: b.ordinal,
    sourceRecordId: typeof b.sourceRecordId === "string" ? b.sourceRecordId : null,
  };
}

/**
 * Der Ausgang einer Entscheidung. `createdByCandidate`: das Objekt trägt den Stempel GENAU dieses
 * Kandidaten (`importCandidateId`), ist also durch ihn entstanden.
 */
export function ausgangDerEntscheidung(
  koId: string | null,
  createdByCandidate: boolean,
): ImportItemOutcome {
  if (!koId) {
    return "SKIPPED";
  }
  return createdByCandidate ? "CREATED" : "BOUND";
}

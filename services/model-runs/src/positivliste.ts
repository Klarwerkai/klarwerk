import type {
  ModelRunErzeugnis,
  ModelRunKosten,
  ModelRunRecord,
  ModelRunSubject,
  ModelRunTrace,
  ModelRunVerbrauch,
  ModelRunVersuch,
} from "./types";

// ================================================================================================
// Aufnahme gesamt-telemetrie (R-0623) — BETRIEBSDATEN NUR AUS EINER AUSDRÜCKLICHEN POSITIVLISTE.
// ================================================================================================
//
// Der Wortlaut: „Wenn ueberhaupt Betriebsdaten gesammelt werden, dann nur Felder von einer
// ausdruecklichen Liste — Kundeninhalte gelangen nie in eine zentrale Auswertung. Was nicht auf der
// Liste steht, wird gar nicht erst erhoben."
//
// DAS KI-LAUFPROTOKOLL IST DIE BETRIEBSDATENSAMMLUNG DER APP: es wird gespeichert (`model_runs`),
// über die KI-Übersicht ausgewertet (`werteLaeufeAus`) und je Lauf als Logzeile `ki_lauf` an die
// Logsenke gegeben, die der Betreiber zentral einsammelt. Die Logzeile war schon eine feste
// Feldauswahl (`kiLaufLogzeile`); der gespeicherte Datensatz dagegen war bis hierher, was der
// Schreiber übergab — `repo-pg.ts` legt ihn vollständig als JSON ab. Ein Feld, das ein Schreiber
// zusätzlich mitgab, wäre damit erhoben worden, ohne auf einer Liste zu stehen.
//
// AB HIER GILT DIE LISTE UNTEN, auf jeder Ebene des Datensatzes: der Schreibweg
// (`ProtokollModelRunRepo.append`) übernimmt NUR die hier genannten Felder. Alles andere fällt weg,
// bevor gespeichert, ausgewertet oder geloggt wird. Vergessen führt zu weniger, nicht zu mehr.
//
// EINE NEUE ANGABE KOMMT NUR ÜBER DIESE LISTE HINEIN. Die Typprüfung am Ende verlangt, dass jedes
// Feld der Datensatztypen hier steht — wer `ModelRunRecord` erweitert, muss das Feld bewusst hier
// aufnehmen und damit begründen, dass es keine Kundeninhalte trägt.

export const MODEL_RUN_FELDER = [
  "id",
  "task",
  "provider",
  "demo",
  "fallback",
  "locale",
  "startedAt",
  "finishedAt",
  "status",
  // Generischer Fehlertext aus festen Meldungen (`protokollMeldung` im Reasoner), nie Prompt- oder
  // Antwortinhalt.
  "error",
  "model",
  "verbrauch",
  "kosten",
  "erzeugt",
  "versuche",
  "trace",
  // Kennungen, kein Inhalt (`sanitizeModelRunContext`).
  "actor",
  "subject",
] as const satisfies readonly (keyof ModelRunRecord)[];

export const MODEL_RUN_VERBRAUCH_FELDER = [
  "eingabeToken",
  "ausgabeToken",
  "gemeldeteAufrufe",
] as const satisfies readonly (keyof ModelRunVerbrauch)[];

export const MODEL_RUN_KOSTEN_FELDER = [
  "betrag",
  "waehrung",
  "preisstand",
] as const satisfies readonly (keyof ModelRunKosten)[];

export const MODEL_RUN_ERZEUGNIS_FELDER = [
  "art",
  "anzahl",
] as const satisfies readonly (keyof ModelRunErzeugnis)[];

export const MODEL_RUN_VERSUCH_FELDER = [
  "provider",
  "model",
  "startedAt",
  "dauerMs",
  "ausgang",
  "verbrauch",
  "aufrufe",
  "spanId",
] as const satisfies readonly (keyof ModelRunVersuch)[];

export const MODEL_RUN_TRACE_FELDER = [
  "traceId",
  "spanId",
  "parentSpanId",
  "requestId",
] as const satisfies readonly (keyof ModelRunTrace)[];

export const MODEL_RUN_SUBJECT_FELDER = [
  "kind",
  "id",
] as const satisfies readonly (keyof ModelRunSubject)[];

// Nur eigene Felder der Liste; ein Wert, der kein einfaches Objekt ist, ergibt ein leeres Objekt.
function waehle<T>(quelle: unknown, felder: readonly string[]): T {
  const ziel: Record<string, unknown> = {};
  if (quelle === null || typeof quelle !== "object" || Array.isArray(quelle)) {
    return ziel as T;
  }
  for (const feld of felder) {
    if (Object.hasOwn(quelle, feld)) {
      ziel[feld] = (quelle as Record<string, unknown>)[feld];
    }
  }
  return ziel as T;
}

function versuchNachListe(versuch: unknown): ModelRunVersuch {
  const v = waehle<ModelRunVersuch>(versuch, MODEL_RUN_VERSUCH_FELDER);
  if (v.verbrauch !== undefined) {
    v.verbrauch = waehle<ModelRunVerbrauch>(v.verbrauch, MODEL_RUN_VERBRAUCH_FELDER);
  }
  return v;
}

/**
 * Der Lauf, reduziert auf die Felder der Positivliste — auf jeder Ebene. Ein vollständig gelisteter
 * Lauf kommt feldgleich heraus; jedes nicht gelistete Feld fehlt.
 */
export function nurGelisteteLauffelder(lauf: ModelRunRecord): ModelRunRecord {
  const r = waehle<ModelRunRecord>(lauf, MODEL_RUN_FELDER);
  if (r.verbrauch !== undefined) {
    r.verbrauch = waehle<ModelRunVerbrauch>(r.verbrauch, MODEL_RUN_VERBRAUCH_FELDER);
  }
  if (r.kosten !== undefined) {
    r.kosten = waehle<ModelRunKosten>(r.kosten, MODEL_RUN_KOSTEN_FELDER);
  }
  if (r.erzeugt !== undefined) {
    r.erzeugt = waehle<ModelRunErzeugnis>(r.erzeugt, MODEL_RUN_ERZEUGNIS_FELDER);
  }
  if (r.versuche !== undefined) {
    r.versuche = Array.isArray(r.versuche) ? r.versuche.map(versuchNachListe) : [];
  }
  if (r.trace !== undefined) {
    r.trace = waehle<ModelRunTrace>(r.trace, MODEL_RUN_TRACE_FELDER);
  }
  if (r.subject !== undefined) {
    r.subject = waehle<ModelRunSubject>(r.subject, MODEL_RUN_SUBJECT_FELDER);
  }
  return r;
}

// Liste und Typen sind EINE Wahrheit: fehlt ein Feld eines Datensatztyps in seiner Liste, scheitert
// die Typprüfung hier (nicht erst ein Test).
type Fehlt<T, L extends readonly PropertyKey[]> = Exclude<keyof T, L[number]>;
type Vollstaendig<F> = [F] extends [never] ? true : { fehltAufDerPositivliste: F };
const _listenVollstaendig: [
  Vollstaendig<Fehlt<ModelRunRecord, typeof MODEL_RUN_FELDER>>,
  Vollstaendig<Fehlt<ModelRunVerbrauch, typeof MODEL_RUN_VERBRAUCH_FELDER>>,
  Vollstaendig<Fehlt<ModelRunKosten, typeof MODEL_RUN_KOSTEN_FELDER>>,
  Vollstaendig<Fehlt<ModelRunErzeugnis, typeof MODEL_RUN_ERZEUGNIS_FELDER>>,
  Vollstaendig<Fehlt<ModelRunVersuch, typeof MODEL_RUN_VERSUCH_FELDER>>,
  Vollstaendig<Fehlt<ModelRunTrace, typeof MODEL_RUN_TRACE_FELDER>>,
  Vollstaendig<Fehlt<ModelRunSubject, typeof MODEL_RUN_SUBJECT_FELDER>>,
] = [true, true, true, true, true, true, true];
void _listenVollstaendig;

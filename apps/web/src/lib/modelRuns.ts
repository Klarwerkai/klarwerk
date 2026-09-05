import { REASONER_TASKS } from "../api/types";
import type { ModelRunRecord, ModelRunTask, ModelRunVerbrauch } from "../api/types";

// SCRUM-165: DOM-freie Auswertung der ModelRun-Records (nur Metadaten). Keine Prompt-/
// Antworttexte; rein abgeleitete Zähler/Tones für die kompakte Stufe-2-Sicht.
export interface ModelRunSummary {
  total: number;
  success: number;
  errors: number;
  fallbacks: number;
  demo: number;
  byTask: Record<ModelRunTask, number>;
  // JOB 3069: Läufe, deren Aufgabenart die Oberfläche NICHT kennt (älterer Bestand, neuerer
  // Server). Sie stehen hier und in KEINEM Zähler von `byTask` — s. `summarizeModelRuns`.
  // Ohne dieses Feld wäre `byTask` eine stille Teilmenge von `total`, und niemand könnte der
  // Zusammenfassung ansehen, dass etwas fehlt.
  unbekannteArten: number;
  // JOB 3044: Laufzeit über die GELADENEN Läufe. `dauerGezaehlt` ist die Grundmenge der Summe —
  // ohne sie wäre `dauerSummeMs` eine Zahl ohne Bezug, denn Läufe mit unbrauchbaren Zeitstempeln
  // tragen bewusst nichts bei. Beide Werte werden immer zusammen angezeigt.
  dauerSummeMs: number;
  dauerGezaehlt: number;
  // JOB 3074: der Tokenverbrauch über die GELADENEN Läufe, nach demselben Muster wie die Laufzeit
  // darüber. `verbrauchGezaehlt` ist die Grundmenge — die Zahl der Läufe, die überhaupt einen
  // gemeldeten Verbrauch tragen. Eine Summe ohne ihre Grundmenge wäre hier sogar irreführender als
  // bei der Dauer: Läufe ohne Modellaufruf sind der Normalfall, nicht die Ausnahme, und niemand
  // könnte einer nackten Zahl ansehen, über wie wenige Läufe sie geht.
  verbrauchEingabeToken: number;
  verbrauchAusgabeToken: number;
  verbrauchGezaehlt: number;
}

// JOB 3074: DIE EINZIGE STELLE, DIE ENTSCHEIDET, OB EIN LAUF EINEN BRAUCHBAREN VERBRAUCH TRÄGT.
//
// Der Draht liefert JSON. `ModelRunRecord.verbrauch` ist zwar typisiert, aber TypeScript prüft keine
// Serverantwort — ein Altdatensatz oder ein fremd befüllter Datensatz kann hier alles einliefern.
// Die Wache trennt den echten Messwert von allem anderen, und die Zählung wie die Fläche fragen SIE,
// nicht jeweils sich selbst (dieselbe Bauform wie `istBekannteAufgabenart` unten).
//
// `null` heißt „über diesen Lauf ist kein Verbrauch bekannt" und ist streng von `0` unterschieden:
// eine 0 kann ein echter Messwert sein (Antwort ohne Ausgabetoken), ein fehlender Wert nie.
export function modelRunVerbrauch(
  record: Pick<ModelRunRecord, "verbrauch">,
): ModelRunVerbrauch | null {
  const v = record.verbrauch;
  if (!v || typeof v !== "object") {
    return null;
  }
  const brauchbar = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
  return brauchbar(v.eingabeToken) && brauchbar(v.ausgabeToken) && brauchbar(v.gemeldeteAufrufe)
    ? v
    : null;
}

// JOB 3074: DIE EINZIGE DARSTELLUNG EINER TOKENZAHL — bewusst OHNE `toLocaleString`, aus demselben
// Grund wie `formatiereDauer`: die Zahl steht in drei Sprachen in derselben Form in einem
// übersetzten Satz, und ein Test darf sie wörtlich erwarten können. Es wird nicht gerundet und nicht
// abgekürzt („1,2k" wäre eine Glättung einer exakt gemeldeten Zahl).
export function formatiereTokenzahl(anzahl: number): string {
  return String(anzahl);
}

// JOB 3044: DIE EINZIGE STELLE, DIE AUS DEN ZWEI ZEITSTEMPELN EINE DAUER MACHT.
//
// `null` heißt „aus diesem Paar lässt sich keine Dauer ableiten" und ist streng von `0`
// unterschieden: `0` ist der echte Messwert eines Laufs, dessen Start und Ende auf dieselbe
// Millisekunde fallen. Ein Ende VOR dem Start wird NICHT über den Betrag geglättet — ein solches
// Paar ist kaputt, und eine geglättete Zahl wäre eine erfundene Auskunft. Die Fläche schreibt bei
// `null` nichts hin.
export function modelRunDauerMs(
  record: Pick<ModelRunRecord, "startedAt" | "finishedAt">,
): number | null {
  const start = Date.parse(record.startedAt);
  const ende = Date.parse(record.finishedAt);
  if (Number.isNaN(start) || Number.isNaN(ende) || ende < start) {
    return null;
  }
  return ende - start;
}

// JOB 3044: DIE EINZIGE DARSTELLUNG DER DAUER — bewusst OHNE `toLocaleString`.
// Die Zahl darf nicht an der Sprache der Umgebung hängen: sie steht in drei Sprachen in derselben
// Form in einem übersetzten Satz, und ein Test darf sie wörtlich erwarten können.
export function formatiereDauer(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

// JOB 3069: DIE EINZIGE STELLE, DIE ENTSCHEIDET, OB EINE AUFGABENART BEKANNT IST.
//
// Der Draht liefert eine Zeichenkette. `ModelRunRecord.task` ist zwar als `ModelRunTask` deklariert,
// aber TypeScript prüft keine Serverantwort — ein neuerer Server (oder ein Altdatensatz) kann hier
// ein Wort einliefern, das die Oberfläche nicht führt. Diese Wache trennt die acht von allem
// anderen, und die Zählung wie die Fläche fragen SIE, nicht jeweils sich selbst.
const BEKANNTE_AUFGABENARTEN: ReadonlySet<string> = new Set<string>(REASONER_TASKS);

export function istBekannteAufgabenart(task: string): task is ModelRunTask {
  return BEKANNTE_AUFGABENARTEN.has(task);
}

/**
 * Ein Zähler je Aufgabenart, auf 0. ERZEUGT, nicht abgeschrieben: eine neunte Art am Server kann
 * so keine stille Lücke mehr hinterlassen — bis JOB 3069 stand hier ein festes Objektliteral mit
 * fünf Schlüsseln, und `byTask[r.task] += 1` ergab für `extract`/`describe`/`group` `NaN`.
 */
function leereAufgabenzaehlung(): Record<ModelRunTask, number> {
  return Object.fromEntries(REASONER_TASKS.map((task) => [task, 0])) as Record<
    ModelRunTask,
    number
  >;
}

export function summarizeModelRuns(records: readonly ModelRunRecord[]): ModelRunSummary {
  const byTask = leereAufgabenzaehlung();
  let unbekannteArten = 0;
  let dauerSummeMs = 0;
  let dauerGezaehlt = 0;
  let verbrauchEingabeToken = 0;
  let verbrauchAusgabeToken = 0;
  let verbrauchGezaehlt = 0;
  for (const r of records) {
    // JOB 3069, ENTSCHEIDUNG ZUR UNBEKANNTEN ART: Sie wird GEZÄHLT, aber keiner der acht Arten
    // zugeschlagen. Ein Zuschlag wäre eine erfundene Auskunft („dies war eine Extraktion"), ein
    // stilles Verschwinden wäre eine verschwiegene Lücke. So gilt immer:
    // Summe(byTask) + unbekannteArten === total.
    if (istBekannteAufgabenart(r.task)) {
      byTask[r.task] += 1;
    } else {
      unbekannteArten += 1;
    }
    const ms = modelRunDauerMs(r);
    if (ms !== null) {
      dauerSummeMs += ms;
      dauerGezaehlt += 1;
    }
    // JOB 3074: gezählt wird der LAUF, nicht der Modellaufruf — die Summenzeile spricht über
    // geladene Läufe, so wie die Laufzeit darüber. Wie viele Modellaufrufe darin steckten, steht im
    // Datensatz (`gemeldeteAufrufe`) und wird hier bewusst nicht zu einer zweiten Grundmenge.
    const verbrauch = modelRunVerbrauch(r);
    if (verbrauch !== null) {
      verbrauchEingabeToken += verbrauch.eingabeToken;
      verbrauchAusgabeToken += verbrauch.ausgabeToken;
      verbrauchGezaehlt += 1;
    }
  }
  return {
    total: records.length,
    success: records.filter((r) => r.status === "success").length,
    errors: records.filter((r) => r.status === "error").length,
    fallbacks: records.filter((r) => r.fallback).length,
    demo: records.filter((r) => r.demo).length,
    byTask,
    unbekannteArten,
    dauerSummeMs,
    dauerGezaehlt,
    verbrauchEingabeToken,
    verbrauchAusgabeToken,
    verbrauchGezaehlt,
  };
}

export type ModelRunTone = "pos" | "crit";

// Status bestimmt den Ton: Fehler kritisch, Erfolg positiv (Fallback/Demo werden separat
// als eigene Marker angezeigt, nicht als Fehler).
export function modelRunStatusTone(record: Pick<ModelRunRecord, "status">): ModelRunTone {
  return record.status === "error" ? "crit" : "pos";
}

// Defensive Anzeige-Begrenzung (Server begrenzt bereits; FE kappt zusätzlich für die Card).
export function limitModelRuns(
  records: readonly ModelRunRecord[],
  limit: number,
): ModelRunRecord[] {
  return records.slice(0, Math.max(0, Math.floor(limit)));
}

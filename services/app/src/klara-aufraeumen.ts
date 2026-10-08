// ================================================================================================
// R-0609 · Bens B13 — DER AUFRÄUMLAUF DER KLARA-SITZUNGEN HAT EINEN PRODUKTIVEN AUSLÖSER.
// ================================================================================================
//
// `KlaraSessionService.raeumeAbgelaufeneAuf` trägt vor dem Löschen abgelaufener Sitzungen jeden
// fehlenden Endeintrag des Prüfprotokolls nach — auch den `nicht_wirksam` einer Erteilung, deren
// Zustimmung nie gespeichert wurde (Bens B12). Bis hierher rief ihn nur ein Test; im Betrieb blieb
// die Lücke offen. Dieser Baustein startet ihn in `server.ts`: einmal beim Start (Neustart-Fall)
// und danach periodisch, über denselben einspritzbaren Zeitgeber wie den Papierkorb-Sweep.
//
// Der Lauf gehört der EINEN Dienstinstanz aus `buildApp` (Option `klaraAufraeumen`); eine zweite
// Instanz wäre eine zweite Wahrheit über denselben Sitzungsbestand. Ein Fehler (etwa ein nicht
// erreichbares Prüfprotokoll) bricht nichts ab: der Lauf löscht dann nichts, und der nächste Tick
// versucht es erneut.

import {
  DEFAULT_TRASH_SWEEP_INTERVAL_MS,
  type IntervalHandle,
  type TrashSweepSchedulerHandle,
  resolveTrashSweepIntervalMs,
  startTrashSweepScheduler,
} from "./trash-sweep-scheduler";

export interface KlaraAufraeumenDeps {
  /** Ein Aufräumlauf; liefert die Zahl gelöschter Sitzungen. */
  readonly lauf: () => Promise<number>;
  readonly intervalMs: number;
  // R-0623 (Ben, Nacharbeit 3): eine Warnung trägt den Fehler STRUKTURIERT als `err` und einen
  // festen Ereignistext — nie `String(error)` im Text, der Kundeninhalte enthalten kann. In
  // `server.ts` geht beides an den App-Logger und damit über den Erlaubnislisten-Serializer.
  readonly log: {
    info: (text: string) => void;
    warn: (felder: { err: unknown }, text: string) => void;
  };
  readonly setIntervalFn?: (callback: () => void, ms: number) => IntervalHandle;
  readonly clearIntervalFn?: (handle: IntervalHandle) => void;
}

/** Intervall aus `KLARWERK_KLARA_AUFRAEUM_INTERVAL_MS`; Vorgabe und Untergrenze wie beim Sweep. */
export function resolveKlaraAufraeumIntervalMs(raw: string | undefined): number {
  return resolveTrashSweepIntervalMs(raw, DEFAULT_TRASH_SWEEP_INTERVAL_MS);
}

/** Startet den Aufräumlauf sofort und danach periodisch; gibt das Stop-Handle zurück. */
export function starteKlaraAufraeumen(deps: KlaraAufraeumenDeps): TrashSweepSchedulerHandle {
  const gemeldet = (anlass: string) => (geloescht: number) => {
    if (geloescht > 0) {
      deps.log.info(`Klara-Sitzungen aufgeräumt (${anlass}): ${geloescht} entfernt.`);
    }
  };
  const fehler = (anlass: string) => (error: unknown) => {
    deps.log.warn({ err: error }, `Klara-Aufräumlauf (${anlass}) übersprungen`);
  };
  deps.lauf().then(gemeldet("Start"), fehler("Start"));
  return startTrashSweepScheduler({
    intervalMs: deps.intervalMs,
    runSweep: deps.lauf,
    onSwept: gemeldet("periodisch"),
    onError: fehler("periodisch"),
    ...(deps.setIntervalFn ? { setIntervalFn: deps.setIntervalFn } : {}),
    ...(deps.clearIntervalFn ? { clearIntervalFn: deps.clearIntervalFn } : {}),
  });
}

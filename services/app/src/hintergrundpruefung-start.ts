// AUFNAHME 20260922 · gesamt-pruefung-hintergrund — der Zeitgeber des Hintergrundlaufs.
//
// Getrennt von hintergrundpruefung.ts, weil build-app.ts jenes Modul lädt und damit auch die
// gemounteten .tsx-Tests (DOM-Typen). Der Zeitgeber gehört nur in den Prozessstart (server.ts) —
// wie der Papierkorb-Sweep, dessen einspritzbaren Scheduler er wiederverwendet.
import type { HintergrundlaufBericht } from "./hintergrundpruefung";
import {
  type IntervalHandle,
  type TrashSweepSchedulerHandle,
  startTrashSweepScheduler,
} from "./trash-sweep-scheduler";

export interface HintergrundpruefungStartDeps {
  readonly lauf: () => Promise<HintergrundlaufBericht | null>;
  readonly intervalMs: number;
  readonly log: { info: (text: string) => void; warn: (text: string) => void };
  readonly setIntervalFn?: (callback: () => void, ms: number) => IntervalHandle;
  readonly clearIntervalFn?: (handle: IntervalHandle) => void;
}

/** Startet den Lauf sofort (Neustart-Fall: verlorene Warteschlange) und danach periodisch. */
export function starteHintergrundpruefung(
  deps: HintergrundpruefungStartDeps,
): TrashSweepSchedulerHandle {
  const melde = (bericht: HintergrundlaufBericht | null): number => {
    if (bericht && bericht.nachgeholt + bericht.abgeglichen + bericht.fehlgeschlagen > 0) {
      deps.log.info(
        `Hintergrundprüfung: ${bericht.nachgeholt} nachgeholt, ${bericht.abgeglichen} abgeglichen, ${bericht.fehlgeschlagen} fehlgeschlagen, ${bericht.offen} offen, ${bericht.vergleicheHeute}/${bericht.tagesbudget} Vergleiche heute${bericht.abbruch ? ` (Ende: ${bericht.abbruch})` : ""}.`,
      );
    }
    return 0;
  };
  const fehler = (error: unknown): void => {
    deps.log.warn(`Hintergrundprüfung übersprungen: ${String(error)}`);
  };
  deps.lauf().then(melde, fehler);
  return startTrashSweepScheduler({
    intervalMs: deps.intervalMs,
    runSweep: () => deps.lauf().then(melde),
    onError: fehler,
    ...(deps.setIntervalFn ? { setIntervalFn: deps.setIntervalFn } : {}),
    ...(deps.clearIntervalFn ? { clearIntervalFn: deps.clearIntervalFn } : {}),
  });
}

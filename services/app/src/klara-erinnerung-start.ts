// ================================================================================================
// produkt:20261007:klara-erinnerungen-kalender (Klara 10 · AW18-K11/K12) — DER TAKT DER
// ERINNERUNGSSTEUERUNG.
// ================================================================================================
//
// Die Steuerung (`KlaraErinnerungSteuerung` in `klara-erinnerung.ts`) gehört der EINEN Dienstinstanz
// aus `buildApp` (Option `klaraErinnerungen`). Dieser Baustein startet sie in `server.ts`: einmal
// sofort (Neustart-Fall: was in der Pause fällig wurde, folgt der Verpasst-Regel) und danach im
// Takt — über denselben einspritzbaren Zeitgeber wie Papierkorb-Sweep und Klara-Aufräumlauf. Kein
// Chat-Wecker, keine Codex-Automation: laufen mehrere Prozesse, verhindert die atomare
// Laufübernahme in der Datenbank jede doppelte Wirkung.
//
// Ein Fehler bricht nichts ab: der Takt meldet ihn strukturiert (`err`, fester Ereignistext — nie
// Inhalte) und versucht es beim nächsten Mal erneut.
import type { KlaraErinnerungLaufbericht } from "./klara-erinnerung";
import {
  type IntervalHandle,
  type TrashSweepSchedulerHandle,
  resolveTrashSweepIntervalMs,
  startTrashSweepScheduler,
} from "./trash-sweep-scheduler";

/** Vorgabe: jede Minute — eine Erinnerung kommt höchstens etwa eine Minute nach ihrem Termin. */
export const KLARA_ERINNERUNG_TAKT_MS = 60_000;
export const KLARA_ERINNERUNG_TAKT_ENV = "KLARWERK_KLARA_ERINNERUNG_TAKT_MS";

/** Takt aus der Umgebung; Untergrenze wie beim Sweep (1 min). */
export function resolveKlaraErinnerungTaktMs(raw: string | undefined): number {
  return resolveTrashSweepIntervalMs(raw, KLARA_ERINNERUNG_TAKT_MS);
}

export interface KlaraErinnerungStartDeps {
  readonly lauf: () => Promise<KlaraErinnerungLaufbericht>;
  readonly intervalMs: number;
  readonly log: {
    info: (text: string) => void;
    warn: (felder: { err: unknown }, text: string) => void;
  };
  readonly setIntervalFn?: (callback: () => void, ms: number) => IntervalHandle;
  readonly clearIntervalFn?: (handle: IntervalHandle) => void;
}

function wirkungen(b: KlaraErinnerungLaufbericht): number {
  return (
    b.zugestellt +
    b.nachgeholt +
    b.verpasstGemeldet +
    b.zusammengefasst +
    b.uebersprungen +
    b.dedupliziert +
    b.teilweise +
    b.fehlgeschlagen +
    b.unklar +
    b.gestoppt +
    b.abgebrochen +
    b.fehler
  );
}

/** Startet die Steuerung sofort und danach im Takt; gibt das Stop-Handle zurück. */
export function starteKlaraErinnerungen(deps: KlaraErinnerungStartDeps): TrashSweepSchedulerHandle {
  const melde = (anlass: string) => (b: KlaraErinnerungLaufbericht) => {
    if (wirkungen(b) > 0) {
      // Nur Zahlen — keine Titel, keine Konten.
      deps.log.info(
        `Erinnerungen (${anlass}): ${b.zugestellt} zugestellt, ${b.nachgeholt} nachgeholt, ${b.verpasstGemeldet} verpasst gemeldet, ${b.zusammengefasst} zusammengefasst, ${b.uebersprungen} übersprungen, ${b.dedupliziert} per Readback bestätigt, ${b.teilweise} teilweise, ${b.fehlgeschlagen} fehlgeschlagen, ${b.unklar} unklar, ${b.gestoppt} gestoppt, ${b.abgebrochen} vor der Wirkung abgebrochen, ${b.fehler} Fehler.`,
      );
    }
    return 0;
  };
  const fehler = (anlass: string) => (error: unknown) => {
    deps.log.warn({ err: error }, `Erinnerungssteuerung (${anlass}) übersprungen`);
  };
  deps.lauf().then(melde("Start"), fehler("Start"));
  return startTrashSweepScheduler({
    intervalMs: deps.intervalMs,
    runSweep: () => deps.lauf().then(melde("Takt")),
    onError: fehler("Takt"),
    ...(deps.setIntervalFn ? { setIntervalFn: deps.setIntervalFn } : {}),
    ...(deps.clearIntervalFn ? { clearIntervalFn: deps.clearIntervalFn } : {}),
  });
}

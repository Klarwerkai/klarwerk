// SCRUM-523 P.3 (WP1-Batch3): der Papierkorb-Sweep (Endlöschung abgelaufener Einträge) läuft nicht mehr
// NUR einmal beim Serverstart, sondern zusätzlich PERIODISCH. Der Scheduler ist bewusst als schmale,
// injizierbare Abstraktion gebaut (setInterval/clearInterval einspritzbar) → deterministisch testbar,
// ohne echte Zeit. Reine Leseoperationen bleiben davon unberührt (schreibfrei); der Sweep selbst ist
// idempotent und rührt nur wirklich abgelaufene Trash-Einträge an.

// Node-typkompatibel gehalten, ohne @types/node-Spezifika zu erzwingen.
export type IntervalHandle = ReturnType<typeof setInterval>;

export interface TrashSweepSchedulerDeps {
  // Führt EINEN Sweep aus und liefert die Zahl endgültig gelöschter KOs.
  runSweep: () => Promise<number>;
  // Intervall in Millisekunden (aus der Umgebung abgeleitet; siehe resolveTrashSweepIntervalMs).
  intervalMs: number;
  // Einspritzbar für Tests (Default = globales setInterval/clearInterval).
  setIntervalFn?: (callback: () => void, ms: number) => IntervalHandle;
  clearIntervalFn?: (handle: IntervalHandle) => void;
  // Beobachtbarkeit: erfolgte Löschungen (>0) bzw. ein Sweep-Fehler — ehrlich loggen statt still.
  onSwept?: (purged: number) => void;
  onError?: (error: unknown) => void;
}

export interface TrashSweepSchedulerHandle {
  stop: () => void;
}

// Default: alle 6 Stunden. Bewusst grob — die 28-Tage-Frist braucht keine engmaschige Prüfung; der
// Start-Sweep deckt den Neustart-Fall ohnehin ab.
export const DEFAULT_TRASH_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Untergrenze gegen versehentliche Dauerläufe (z. B. Fehlkonfiguration „100").
export const MIN_TRASH_SWEEP_INTERVAL_MS = 60_000;

// Liest das Intervall aus der Umgebung (KLARWERK_TRASH_SWEEP_INTERVAL_MS). Ungültig/fehlend → Default;
// zu klein → auf die Untergrenze angehoben. Rein & testbar (kein Zugriff auf process im Aufrufer nötig).
export function resolveTrashSweepIntervalMs(
  raw: string | undefined,
  fallback = DEFAULT_TRASH_SWEEP_INTERVAL_MS,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.max(Math.floor(n), MIN_TRASH_SWEEP_INTERVAL_MS);
}

// Startet den periodischen Sweep. Gibt ein Stop-Handle zurück (Timer beenden). Der Timer wird — falls die
// Laufzeit es unterstützt — ge-unref-t, damit er den Prozess nicht am Beenden hindert.
export function startTrashSweepScheduler(deps: TrashSweepSchedulerDeps): TrashSweepSchedulerHandle {
  const setI = deps.setIntervalFn ?? setInterval;
  const clearI = deps.clearIntervalFn ?? clearInterval;
  const handle = setI(() => {
    // Ein Tick darf nie unbehandelt rejecten (kein Prozess-Crash); Fehler gehen an onError.
    deps
      .runSweep()
      .then((purged) => {
        if (purged > 0) {
          deps.onSwept?.(purged);
        }
      })
      .catch((error) => {
        deps.onError?.(error);
      });
  }, deps.intervalMs);
  // Best effort: Timer nicht als Grund fürs Offenhalten des Event-Loops zählen (Node).
  (handle as { unref?: () => void })?.unref?.();
  return { stop: () => clearI(handle) };
}

import type { OverlapService, OverlapSettingsRepo } from "../../conflicts";
import type { ConflictService } from "../../conflicts";
// WP-SUBMIT-ASYNC (Pedis Architektur-Entscheid R3, 21.07.): "Prüfen & Einreichen" blockiert die
// Arbeit nicht mehr (Messung: 1:28 min synchrone KI-Prüfung im Submit-Pfad). Der Submit vermerkt
// nur noch einen Prüf-Job (aiCheck pending am KO); DIESER leichte In-Process-Worker arbeitet die
// Jobs NACH der Antwort ab — über die BESTEHENDEN Erkennungs-Pfade (detectConflictsForKo/
// detectDuplicatesForKo, unverändert inkl. Vertraulichkeits-/Demo-Ausschluss und ModelRun-
// Protokoll im Reasoner). Ergebnis-Signale (Konflikte/Überschneidungen) entstehen exakt wie
// vorher — nur später; aiCheck trägt den ehrlichen Job-Status für die Validierungs-Anzeige.
//
// NEUSTART-GRENZE (pragmatisch + ehrlich, bewusst dokumentiert): die Queue lebt NUR im Speicher.
// Stirbt der Prozess zwischen pending-Vermerk und Abschluss, bleibt das KO auf pending stehen —
// es gibt KEINEN Cron und KEINE neue Infrastruktur. Der Ausgleich ist lazy: beim Laden der
// Validierungs-Liste werden pending-KOs, deren requestedAt älter als AI_CHECK_STALE_PENDING_MS
// ist, neu eingereiht (shouldReEnqueueAiCheck; requestedAt wird dabei aufgefrischt, damit kein
// Wiedereinreih-Sturm je Load entsteht). Wird das Board nie geladen, bleibt ein verwaister Job
// ehrlich als pending sichtbar liegen — das ist die akzeptierte Grenze dieser Ausbaustufe.
import type { AiCheck, KoService } from "../../knowledge-object";
import type { Reasoner } from "../../reasoner";
import { detectConflictsForKo } from "./conflict-detection";
import { type SemanticPrefilter, detectDuplicatesForKo } from "./duplicate-detection";

// GENAU EIN Prüf-Job gleichzeitig (Konstante, gepinnt): die Erkennung feuert je Lauf viele
// Modell-Urteile — mehr Parallelität würde nur das Modell-Kontingent gegen sich selbst stauen.
export const AI_CHECK_CONCURRENCY = 1;

// Ab diesem Alter gilt ein pending-Job als festhängend (Prozess-Neustart, verlorene Queue) und
// wird beim Board-Load lazy neu eingereiht.
export const AI_CHECK_STALE_PENDING_MS = 10 * 60_000;

export interface AiCheckRunOutcome {
  ok: boolean;
  fallbackReason?: "no-model" | "model-error";
}

export type AiCheckRunner = (koId: string) => Promise<AiCheckRunOutcome>;

export interface AiCheckWorker {
  // Reiht einen Prüf-Job ein (dedupliziert gegen Queue UND laufenden Job) und startet die
  // Abarbeitung — feuert-und-vergisst, der Aufrufer wartet nie.
  enqueue(koId: string): void;
  has(koId: string): boolean;
  queuedCount(): number;
  // Für Tests: aufgelöst, sobald Queue leer und kein Job mehr läuft.
  idle(): Promise<void>;
}

export interface AiCheckWorkerDeps {
  ko: KoService;
  run: AiCheckRunner;
  now?: () => number;
  // PII-freies Log (KO-Id, Dauer, Status) — Default stderr, injizierbar für stille Tests.
  log?: (line: string) => void;
}

// Lazy-Re-Enqueue-Entscheidung (pure): nur pending zählt; ein unlesbares requestedAt (defensiv)
// gilt als festhängend — lieber einmal zu viel neu einreihen als still liegen lassen.
export function shouldReEnqueueAiCheck(aiCheck: AiCheck | undefined, nowMs: number): boolean {
  if (!aiCheck || aiCheck.status !== "pending") {
    return false;
  }
  const requested = Date.parse(aiCheck.requestedAt);
  return !Number.isFinite(requested) || nowMs - requested > AI_CHECK_STALE_PENDING_MS;
}

export function createAiCheckWorker(deps: AiCheckWorkerDeps): AiCheckWorker {
  const now = deps.now ?? (() => Date.now());
  const log =
    deps.log ??
    ((line: string): void => {
      process.stderr.write(`${line}\n`);
    });
  const queue: string[] = [];
  const queuedIds = new Set<string>();
  const runningIds = new Set<string>();
  let active = 0;
  let idleResolvers: (() => void)[] = [];

  const flushIdle = (): void => {
    if (active === 0 && queue.length === 0) {
      const resolvers = idleResolvers;
      idleResolvers = [];
      for (const resolve of resolvers) {
        resolve();
      }
    }
  };

  const runOne = async (koId: string): Promise<void> => {
    const startedMs = now();
    let outcome: AiCheckRunOutcome;
    try {
      outcome = await deps.run(koId);
    } catch {
      // Der Runner ist selbst best-effort — ein Wurf hier ist trotzdem ein ehrlicher Modellfehler.
      outcome = { ok: false, fallbackReason: "model-error" };
    }
    let resolved = false;
    try {
      resolved = await deps.ko.resolveAiCheck(koId, {
        ok: outcome.ok,
        ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
      });
    } catch {
      resolved = false; // Status-Write scheiterte — der Lazy-Re-Enqueue holt den Job später nach.
    }
    // PII-frei: nur Id, Status, Dauer — nie Inhalte.
    log(
      `[KLARWERK] KI-Pruefung ko=${koId} status=${outcome.ok ? "done" : "failed"}${
        outcome.fallbackReason ? ` grund=${outcome.fallbackReason}` : ""
      } dauer=${now() - startedMs}ms geschrieben=${resolved}`,
    );
  };

  const pump = (): void => {
    while (active < AI_CHECK_CONCURRENCY && queue.length > 0) {
      const koId = queue.shift() as string;
      queuedIds.delete(koId);
      runningIds.add(koId);
      active += 1;
      void runOne(koId).finally(() => {
        runningIds.delete(koId);
        active -= 1;
        pump();
      });
    }
    flushIdle();
  };

  return {
    enqueue(koId: string): void {
      if (queuedIds.has(koId) || runningIds.has(koId)) {
        return; // dedupliziert — derselbe Job steht nie doppelt an
      }
      queue.push(koId);
      queuedIds.add(koId);
      pump();
    },
    has(koId: string): boolean {
      return queuedIds.has(koId) || runningIds.has(koId);
    },
    queuedCount(): number {
      return queue.length + active;
    },
    idle(): Promise<void> {
      if (active === 0 && queue.length === 0) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        idleResolvers.push(resolve);
      });
    },
  };
}

export interface AiCheckRunnerDeps {
  ko: KoService;
  conflicts: ConflictService;
  overlaps: OverlapService;
  overlapSettings: OverlapSettingsRepo;
  reasoner: Reasoner;
  semanticPrefilter?: SemanticPrefilter | undefined;
}

// Der eine Prüf-Lauf: DIESELBEN Erkennungs-Funktionen, die vorher synchron im Submit-Pfad liefen
// (Chokepoint/Vertraulichkeits-Routing/ModelRun-Protokoll unverändert — nur NUTZEN, kein Umbau).
// Die Erkennung läuft IMMER — auch ohne Modell: der deterministische Duplikat-Anteil (sehr hohe
// Textdeckung) braucht kein Modell und lief auch im alten synchronen Pfad ohne eines; die
// Modell-Urteile sind dann stille No-ops (judge → null). EHRLICHKEIT nur im STATUS: ohne aktives
// Modell wurde die inhaltliche KI-Prüfung nicht wirklich ausgeführt → failed/no-model (kein
// Fake-done); ein Erkennungsfehler (die detect*-Funktionen schlucken ihn best-effort, melden ihn
// aber über den Log-Haken) → failed/model-error. Nie stiller Verlust, nie erfundenes Ergebnis.
export function createAiCheckRunner(deps: AiCheckRunnerDeps): AiCheckRunner {
  return async (koId: string): Promise<AiCheckRunOutcome> => {
    let failure: unknown = null;
    const captureFailure = (msg: string, err: unknown): void => {
      failure = err ?? new Error(msg);
    };
    await detectConflictsForKo(
      koId,
      { ko: deps.ko, conflicts: deps.conflicts, reasoner: deps.reasoner },
      captureFailure,
    );
    await detectDuplicatesForKo(
      koId,
      {
        ko: deps.ko,
        overlaps: deps.overlaps,
        reasoner: deps.reasoner,
        settings: deps.overlapSettings,
        semanticPrefilter: deps.semanticPrefilter,
      },
      captureFailure,
    );
    if (failure !== null) {
      return { ok: false, fallbackReason: "model-error" };
    }
    if (!deps.reasoner.status().active) {
      return { ok: false, fallbackReason: "no-model" };
    }
    return { ok: true };
  };
}

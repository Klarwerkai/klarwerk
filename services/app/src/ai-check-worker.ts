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
//
// WP-SHIP8-FINAL (bens sammel23, Bedingung 2) — HARTE BINDUNG + HARTE GRENZEN:
//  - VERSION: der Job ist an die Inhaltsversion des pending-Vermerks gebunden (aiCheck.koVersion);
//    der Abschluss schreibt bedingt (resolveAiCheck mit expectedKoVersion). Ein zwischenzeitlicher
//    revise macht den alten Lauf zum No-op — der Worker reiht dann (gedeckelt) einen frischen Job
//    für die NEUE Version ein. Stale-done ist unmöglich.
//  - TIMEOUT: jeder Job hat eine harte Frist (AI_CHECK_JOB_TIMEOUT_MS) → failed/timeout. Der
//    innere Erkennungs-Lauf ist nicht abbrechbar (best-effort-Kette) und läuft ggf. leer weiter —
//    sein später Abschluss schreibt dank der pending-Bedingung nichts mehr.
//  - QUEUE-KAPPE: MAX_AI_CHECK_QUEUE — darüber wird der ÄLTESTE wartende Job ehrlich als
//    failed/queue-overflow markiert statt still zu wachsen.
//  - RETRY-DECKEL: max MAX_AI_CHECK_AUTO_RETRIES automatische Re-Enqueues je KO-Version (Schutz
//    gegen revise-Loops); danach hilft nur der manuelle Retry-Knopf (bzw. der Lazy-Re-Enqueue
//    nach der Stale-Frist, der einen FRISCHEN Vermerk mit neuer Version setzt).
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

// WP-SHIP8-FINAL (bens Bedingung 2): harte Grenzen als Konstanten.
export const MAX_AI_CHECK_QUEUE = 200;
export const AI_CHECK_JOB_TIMEOUT_MS = 120_000;
export const MAX_AI_CHECK_AUTO_RETRIES = 2;

export interface AiCheckRunOutcome {
  ok: boolean;
  fallbackReason?: "no-model" | "model-error" | "timeout" | "queue-overflow";
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
  // WP-SHIP8-FINAL: Job-Frist injizierbar (Tests) — Default die Konstante.
  jobTimeoutMs?: number;
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

// WP-SHIP8-FINAL: Lauf mit harter Frist. Der Erkennungs-Lauf selbst ist nicht abbrechbar — bei
// Frist-Ablauf gewinnt das timeout-Ergebnis; der späte echte Ausgang wird verworfen (sein
// resolve wäre ohnehin ein No-op, weil der Status dann nicht mehr pending ist).
function runWithTimeout(
  run: Promise<AiCheckRunOutcome>,
  timeoutMs: number,
): Promise<AiCheckRunOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, fallbackReason: "timeout" });
      }
    }, timeoutMs);
    run
      .then((outcome) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(outcome);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ ok: false, fallbackReason: "model-error" });
        }
      });
  });
}

export function createAiCheckWorker(deps: AiCheckWorkerDeps): AiCheckWorker {
  const now = deps.now ?? (() => Date.now());
  const jobTimeoutMs = deps.jobTimeoutMs ?? AI_CHECK_JOB_TIMEOUT_MS;
  const log =
    deps.log ??
    ((line: string): void => {
      process.stderr.write(`${line}\n`);
    });
  const queue: string[] = [];
  const queuedIds = new Set<string>();
  const runningIds = new Set<string>();
  // WP-SHIP8-FINAL: Auto-Retry-Zähler je KO — zählt Re-Enqueues für GENAU EINE Zielversion;
  // eine neue Version setzt den Zähler zurück (der Deckel begrenzt den revise-Loop, nicht den
  // normalen Fluss). Nur im Speicher — wie die Queue selbst (Neustart-Grenze oben).
  const autoRetries = new Map<string, { version: number; count: number }>();
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

  const enqueueInternal = (koId: string): void => {
    if (queuedIds.has(koId) || runningIds.has(koId)) {
      return; // dedupliziert — derselbe Job steht nie doppelt an
    }
    // WP-SHIP8-FINAL: Queue-Kappe — der ÄLTESTE wartende Job wird ehrlich als failed/
    // queue-overflow abgeschlossen (bedingter Write: nur solange er noch pending ist) statt
    // die Queue still wachsen zu lassen.
    if (queue.length >= MAX_AI_CHECK_QUEUE) {
      const evicted = queue.shift();
      if (evicted !== undefined) {
        queuedIds.delete(evicted);
        void deps.ko
          .resolveAiCheck(evicted, { ok: false, fallbackReason: "queue-overflow" })
          .catch(() => false);
        log(
          `[KLARWERK] KI-Pruefung ko=${evicted} status=failed grund=queue-overflow (Kappe ${MAX_AI_CHECK_QUEUE})`,
        );
      }
    }
    queue.push(koId);
    queuedIds.add(koId);
  };

  // true = Auto-Re-Enqueue für diese Zielversion ist noch im Deckel (und wird gezählt).
  const consumeAutoRetry = (koId: string, targetVersion: number): boolean => {
    const entry = autoRetries.get(koId);
    if (!entry || entry.version !== targetVersion) {
      autoRetries.set(koId, { version: targetVersion, count: 1 });
      return true;
    }
    if (entry.count >= MAX_AI_CHECK_AUTO_RETRIES) {
      return false;
    }
    entry.count += 1;
    return true;
  };

  // Liefert true, wenn der Job für eine NEUE Version erneut eingereiht werden soll.
  const runOne = async (koId: string): Promise<boolean> => {
    const startedMs = now();
    // WP-SHIP8-FINAL: Versions-Bindung — der Job gilt für GENAU die Version des pending-Vermerks
    // (dort beim Einreihen gespeichert). Altbestand ohne Feld läuft versionsungebunden weiter.
    let expectedVersion: number | undefined;
    try {
      expectedVersion = (await deps.ko.get(koId))?.aiCheck?.koVersion;
    } catch {
      expectedVersion = undefined;
    }
    const outcome = await runWithTimeout(deps.run(koId), jobTimeoutMs);
    let resolved = false;
    try {
      resolved = await deps.ko.resolveAiCheck(
        koId,
        {
          ok: outcome.ok,
          ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
        },
        expectedVersion,
      );
    } catch {
      resolved = false; // Status-Write scheiterte — der Lazy-Re-Enqueue holt den Job später nach.
    }
    // PII-frei: nur Id, Status, Dauer — nie Inhalte.
    log(
      `[KLARWERK] KI-Pruefung ko=${koId} status=${outcome.ok ? "done" : "failed"}${
        outcome.fallbackReason ? ` grund=${outcome.fallbackReason}` : ""
      } dauer=${now() - startedMs}ms geschrieben=${resolved}`,
    );
    if (resolved || expectedVersion === undefined) {
      return false;
    }
    // Bedingter Write griff nicht: prüfen, ob die INHALTSVERSION gewandert ist (revise während
    // des Laufs). Dann war dieser Lauf ein ehrlicher No-op — einmalig (gedeckelt) einen frischen
    // Job für die NEUE Version vermerken und einreihen.
    try {
      const current = await deps.ko.get(koId);
      const versionMoved =
        current?.aiCheck?.status === "pending" && current.version !== expectedVersion;
      if (versionMoved && consumeAutoRetry(koId, current.version)) {
        const marked = await deps.ko.markAiCheckPending(koId);
        if (marked) {
          log(
            `[KLARWERK] KI-Pruefung ko=${koId} version=${expectedVersion}->${current.version} — alter Lauf No-op, frischer Job eingereiht`,
          );
          return true;
        }
      }
    } catch {
      // Nachlesen scheiterte — kein Auto-Retry; der Lazy-Re-Enqueue greift später.
    }
    return false;
  };

  const pump = (): void => {
    while (active < AI_CHECK_CONCURRENCY && queue.length > 0) {
      const koId = queue.shift() as string;
      queuedIds.delete(koId);
      runningIds.add(koId);
      active += 1;
      void runOne(koId)
        .catch(() => false)
        .then((requeue) => {
          runningIds.delete(koId);
          active -= 1;
          if (requeue) {
            // NACH der runningIds-Freigabe — sonst würde die Dedupe den frischen Job schlucken.
            enqueueInternal(koId);
          }
          pump();
        });
    }
    flushIdle();
  };

  return {
    enqueue(koId: string): void {
      enqueueInternal(koId);
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
// Textdeckung) braucht kein Modell und lief auch im alten synchronen Pfad ohne eines.
//
// WP-SHIP8-FINAL (bens Bedingung 2, Befund "Modellfehler als done"): der Status kommt aus dem
// TATSÄCHLICHEN Ausgang der Läufe, nie aus status().active allein. Die detect*-Kerne schlucken
// Judge-Fehler intern (conflicts: jeden; overlaps: alle außer ModelCapacityError) — deshalb
// beobachtet der Runner die Modell-Urteile DIREKT am Judge (schmaler Wrapper, Fehler werden
// unverändert weitergeworfen, das Kern-Verhalten bleibt exakt gleich): irgendein geworfener
// Judge-Fehler ODER ein über den Log-Haken gemeldeter Erkennungsfehler → failed/model-error.
// Ohne aktives Modell lief nur der deterministische Anteil → ehrlich failed/no-model. Nur ein
// Lauf ohne jeden Fehler ist done.
export function createAiCheckRunner(deps: AiCheckRunnerDeps): AiCheckRunner {
  return async (koId: string): Promise<AiCheckRunOutcome> => {
    let failure: unknown = null;
    const captureFailure = (msg: string, err: unknown): void => {
      failure = failure ?? err ?? new Error(msg);
    };
    // Schmaler Beobachtungs-Wrapper NUR über die zwei Judge-Flächen, die die detect*-Pfade
    // nutzen — kein Reasoner-Umbau, kein verändertes Routing (der echte Reasoner urteilt).
    // Der Struktur-Cast ist bewusst: die detect*-Deps tippen `Reasoner`, brauchen aber genau
    // diese zwei Methoden.
    const observedReasoner = {
      judgeConflict: async (a: string, b: string) => {
        try {
          return await deps.reasoner.judgeConflict(a, b);
        } catch (err) {
          failure = failure ?? err;
          throw err;
        }
      },
      judgeDuplicate: async (a: string, b: string) => {
        try {
          return await deps.reasoner.judgeDuplicate(a, b);
        } catch (err) {
          failure = failure ?? err;
          throw err;
        }
      },
    } as unknown as Reasoner;
    await detectConflictsForKo(
      koId,
      { ko: deps.ko, conflicts: deps.conflicts, reasoner: observedReasoner },
      captureFailure,
    );
    await detectDuplicatesForKo(
      koId,
      {
        ko: deps.ko,
        overlaps: deps.overlaps,
        reasoner: observedReasoner,
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

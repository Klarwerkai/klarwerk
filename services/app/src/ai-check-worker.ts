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
import { mergeCoverage } from "../../conflicts";
import type { AiCheck, AiCheckCoverage, KoService } from "../../knowledge-object";
import type { ModelFailureInfo, Reasoner } from "../../reasoner";
import type { ConflictJudgeOutcome, DuplicateJudgeOutcome } from "../../reasoner";
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

// RT-001 (Pedi, Live-Befund): „Prüfung fehlgeschlagen" nannte pauschal „model-error", obwohl sich
// die Fehlerklasse eines gefangenen Providerfehlers ZUVERLÄSSIG aus Status/Meldung ableiten lässt.
// Diese ehrlichen Ursachen sind der Nutzer-Klasse zugeordnet (was ist passiert + was tun):
//  - "auth"         → Zugangsdaten fehlen/abgelehnt (401/403/invalid api key)
//  - "rate-limit"   → Anbieter-Ratenbegrenzung (429/quota)
//  - "unreachable"  → Anbieter nicht erreichbar (Netzwerk/DNS/ECONNREFUSED/fetch failed/5xx)
//  - "bad-response" → unverständliche/unparsebare Modellantwort (JSON-Parse/Schema)
// „model-error" bleibt der Rückfall NUR, wenn wirklich keine Ursache erkennbar ist.
export type AiCheckFailureReason =
  | "no-model"
  | "model-error"
  | "model-timeout"
  | "timeout"
  | "queue-overflow"
  | "confidential"
  | "auth"
  | "rate-limit"
  | "unreachable"
  | "bad-response";

export interface AiCheckRunOutcome {
  ok: boolean;
  // AUFTRAG-mega28 A2/A3: wie weit der Lauf TATSÄCHLICH reichte (geprüft/verfügbar, gedeckelt,
  // übersprungen, abgebrochen). Ohne diese Zahlen wäre „done" nach dem Deckel eine Lüge: ein leeres
  // Ergebnis hieße „gegen 20 von 12.479 nichts gefunden" und läse sich als „konfliktfrei".
  coverage?: AiCheckCoverage;
  // WP-SHIP8-CLOSE (bens F1): "model-timeout" ist eine eigene, ehrliche Ursache (Zeitlimit eines
  // Modellaufrufs — unterschieden vom Job-"timeout", der harten Frist des GANZEN Prüf-Laufs).
  // D-AISTATE PAKET 1 (bens V1): "confidential" = die KI-Ebene war für ein vertrauliches Paar blockiert
  // (Cloud ausgeschlossen, kein lokales Modell) — geprüft wurde nur deterministisch, ehrlich kein "done".
  // RT-001: auth/rate-limit/unreachable/bad-response = ehrliche Feinunterscheidung echter Providerfehler.
  fallbackReason?: AiCheckFailureReason;
}

// RT-001 (bens Sammel-Review 3): die STRUKTURIERTE, anbieterneutrale Reasoner-Fehlerklasse
// (ModelFailureInfo: {failureClass, status?}) → ehrliche, nutzerverständliche Ursache. Das ist der
// PRIMÄRE Weg im normalen Providerpfad (der Reasoner-Ausgang trägt providerFailure); die Regex unten
// ist nur noch ENG BEGRENZTER Fallback für geworfene, uneingeordnete Fehler. Es wird nie Rohtext/
// Anbietername/Status in die Anzeige geführt — nur die Klasse entscheidet den reason-Key.
export function reasonFromModelFailure(info: ModelFailureInfo): AiCheckFailureReason {
  switch (info.failureClass) {
    case "timeout":
      return "model-timeout";
    case "parse":
      return "bad-response";
    case "network":
      return "unreachable";
    case "http": {
      const s = info.status;
      if (s === 401 || s === 403) {
        return "auth";
      }
      if (s === 429) {
        return "rate-limit";
      }
      if (typeof s === "number" && s >= 500 && s <= 599) {
        return "unreachable";
      }
      // Sonstiger HTTP-Status (z. B. 4xx ohne bekannte Bedeutung) → ehrlich generisch.
      return "model-error";
    }
    default:
      return "model-error";
  }
}

// RT-001: reine, anbieter-AGNOSTISCHE Klassifizierung eines gefangenen Providerfehlers → ehrliche
// Ursache. ENG BEGRENZTER Fallback (bens Sammel-Review 3): Wo der strukturierte Reasoner-Weg greift
// (providerFailure, s. createAiCheckRunner), wird diese Regex GAR NICHT befragt. Deshalb sind die
// Muster bewusst eng gezogen — eine beiläufig im Text vorkommende Zahl (z. B. „500"), das bloße Wort
// „JSON"/„network" oder ein isoliertes „api key" lösen KEINE Klasse mehr aus. Ein HTTP-Status wird
// nur aus einer typisierten Eigenschaft ODER einem EINDEUTIG präfixierten Muster gelesen. Die Meldung
// wird NUR zum Erkennen der Klasse gelesen — sie wandert NIE in die Anzeige (die Karte nimmt allein
// den reason-Key, s. aiCheckStatusCard.ts). Bekannte Ursache → eigener Key; sonst Rückfall „model-error".
export function classifyAiCheckFailure(err: unknown): AiCheckFailureReason {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err ?? "");
  // ModelCapacityError ist die INTERNE Rückstau-/Kapazitätsbremse (SCRUM-498 B2), KEIN Provider-
  // Fehler mit Auth/Rate/Netz/Parse-Signal — sie bleibt ehrlich der Sammelfall „model-error".
  if (err && typeof err === "object" && (err as { name?: unknown }).name === "ModelCapacityError") {
    return "model-error";
  }
  // Status-Code NUR aus einer typisierten Eigenschaft (ModelHttpError u. Ä. tragen `status`) oder aus
  // einem EINDEUTIG präfixierten Muster („… antwortete mit 401" / „status: 401" / „HTTP 401") — nie aus
  // einer beliebigen freistehenden Zahl im Text.
  let status: number | undefined;
  if (err && typeof err === "object") {
    const raw =
      (err as { status?: unknown; statusCode?: unknown }).status ??
      (err as { statusCode?: unknown }).statusCode;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      status = raw;
    }
  }
  if (status === undefined) {
    const httpMatch = /(?:antwortete mit|status[^0-9]{0,4}|HTTP[^0-9]{0,4})(\d{3})\b/i.exec(
      message,
    );
    if (httpMatch?.[1]) {
      status = Number(httpMatch[1]);
    }
  }

  // 1) Zugangsdaten fehlen/abgelehnt — Status ODER SPEZIFISCHE Zugangs-Formulierungen (kein bloßes
  //    „api key", keine freistehende 401/403-Zahl).
  if (
    status === 401 ||
    status === 403 ||
    /unauthori[sz]ed|forbidden|invalid[\s_-]*api[\s_-]*key|invalid[\s_-]*key|authenticat|credential|nicht[\s_-]*autorisiert|zugangsdaten/i.test(
      message,
    )
  ) {
    return "auth";
  }
  // 2) Ratenbegrenzung / Kontingent — Status ODER spezifische Formulierung (keine freistehende 429).
  if (
    status === 429 ||
    /rate[\s_-]*limit|too[\s_-]*many[\s_-]*requests|quota|ratenbegrenz/i.test(message)
  ) {
    return "rate-limit";
  }
  // 3) Anbieter nicht erreichbar — Status 5xx ODER KONKRETE Netz-/DNS-Fehlertoken (kein bloßes
  //    „network"/„dns", keine freistehende 5xx-Zahl).
  if (
    (typeof status === "number" && status >= 500 && status <= 599) ||
    /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|EPIPE|getaddrinfo|fetch[\s_-]*failed|socket[\s_-]*hang[\s_-]*up|connection[\s_-]*(refused|reset)|unreachable|nicht[\s_-]*erreichbar|netzwerk/i.test(
      message,
    )
  ) {
    return "unreachable";
  }
  // 4) Unverständliche/unparsebare Antwort — SyntaxError ODER SPEZIFISCHE Parse-Formulierungen (kein
  //    bloßes „JSON"/„parse"/„schema", das auch in gültigem Text vorkommt).
  if (
    err instanceof SyntaxError ||
    /unexpected[\s_-]*(end|token)|kein[\s_-]*(gültiges|gueltiges)[\s_-]*JSON|nicht[\s_-]*verwertbar|ungültige[\s_-]*antwort/i.test(
      message,
    )
  ) {
    return "bad-response";
  }
  // 5) Keine Ursache erkennbar → ehrlicher Rückfall.
  return "model-error";
}

export type AiCheckRunner = (koId: string) => Promise<AiCheckRunOutcome>;

export interface AiCheckWorker {
  // Reiht einen Prüf-Job ein (dedupliziert gegen Queue UND laufenden Job) und startet die
  // Abarbeitung — feuert-und-vergisst, der Aufrufer wartet nie.
  // WP-SHIP8-CLOSE-2 (bens F3): der Aufrufer übergibt die Zielversion des pending-Vermerks
  // SYNCHRON mit (der Submit-/Retry-/Re-Enqueue-Pfad kennt sie — er hat den Vermerk gerade
  // gesetzt/gelesen). Kein asynchrones Nachlesen mehr: ein Lesefehler konnte die Overflow-
  // Eviction sonst auf den UNVERSIONIERTEN Altpfad kippen und den NEUEN pending-Vermerk einer
  // Revision fälschlich als failed/queue-overflow markieren. Fehlt die Version wider Erwarten,
  // ist die Eviction FAIL-CLOSED (kein Status-Write, s. enqueueInternal).
  enqueue(koId: string, expectedKoVersion?: number): void;
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
// AUFTRAG-mega31 BLOCK D (bens GELB-1): exportiert, damit die IMPORT-ACCEPT-KANTE DIESELBE Frist
// benutzt statt einer zweiten. Sie rief den Runner bisher synchron und ungekapselt auf — ein
// Provider, der nie antwortet, hielt die Route fest, ohne dass je ein Abschlussstatus entstand.
// Das ist kein zweiter Regelausleger, sondern derselbe Rahmen an einer zweiten Kante.
export function runWithTimeout(
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
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          // RT-001: ein geworfener Providerfehler bekommt seine ehrliche Ursache statt pauschal
          // „model-error" (Rückfall nur, wenn nichts erkennbar ist).
          resolve({ ok: false, fallbackReason: classifyAiCheckFailure(err) });
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
  // WP-SHIP8-CLOSE (bens F3) + WP-SHIP8-CLOSE-2: die beim EINREIHEN erwartete Vermerk-Version je
  // wartendem Job — jetzt SYNCHRON vom Aufrufer übergeben (er hat den pending-Vermerk gerade
  // gesetzt/gelesen). Der frühere asynchrone Nachlese-Pfad ist weg: sein Lesefehler-Fallback auf
  // undefined bedeutete einen UNVERSIONIERTEN Abschluss, der den neuen Vermerk einer Revision
  // fälschlich überschreiben konnte. undefined heißt jetzt: Eviction FAIL-CLOSED (kein Write).
  const queuedVersions = new Map<string, number | undefined>();
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

  const enqueueInternal = (koId: string, expectedKoVersion?: number): void => {
    if (queuedIds.has(koId) || runningIds.has(koId)) {
      return; // dedupliziert — derselbe Job steht nie doppelt an
    }
    // WP-SHIP8-FINAL: Queue-Kappe — der ÄLTESTE wartende Job wird ehrlich als failed/
    // queue-overflow abgeschlossen statt die Queue still wachsen zu lassen.
    // WP-SHIP8-CLOSE (bens F3) + WP-SHIP8-CLOSE-2: der Abschluss ist HART versionsgebunden — er
    // trägt die beim Einreihen SYNCHRON übergebene Vermerk-Version (dieselbe bedingte Mechanik
    // wie der normale Abschluss in runOne). Ist das KO inzwischen revidiert (neuer pending-
    // Vermerk mit neuer Version), ist der bedingte Write ein No-op und der NEUE Vermerk bleibt
    // unangetastet. OHNE bekannte Version ist die Eviction FAIL-CLOSED: KEIN unversionierter
    // Status-Write (er könnte den falschen Vermerk treffen) — der Job wird nur verworfen und
    // geloggt; der pending-Vermerk bleibt ehrlich stehen, der Lazy-Re-Enqueue holt ihn später.
    if (queue.length >= MAX_AI_CHECK_QUEUE) {
      const evicted = queue.shift();
      if (evicted !== undefined) {
        queuedIds.delete(evicted);
        const expectedVersion = queuedVersions.get(evicted);
        queuedVersions.delete(evicted);
        if (expectedVersion === undefined) {
          log(
            `[KLARWERK] KI-Pruefung ko=${evicted} verdraengt (Kappe ${MAX_AI_CHECK_QUEUE}) — keine Zielversion bekannt, FAIL-CLOSED: kein Status-Write, Lazy-Re-Enqueue holt den Job nach`,
          );
        } else {
          void (async () => {
            const written = await deps.ko
              .resolveAiCheck(
                evicted,
                { ok: false, fallbackReason: "queue-overflow" },
                expectedVersion,
              )
              .catch(() => false);
            log(
              `[KLARWERK] KI-Pruefung ko=${evicted} status=failed grund=queue-overflow (Kappe ${MAX_AI_CHECK_QUEUE}) geschrieben=${written}`,
            );
          })();
        }
      }
    }
    queue.push(koId);
    queuedIds.add(koId);
    queuedVersions.set(koId, expectedKoVersion);
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

  // Liefert die Zielversion, wenn der Job für eine NEUE Version erneut eingereiht werden soll
  // (WP-SHIP8-CLOSE-2, bens F3: der Re-Enqueue trägt sie synchron mit), sonst null.
  const runOne = async (koId: string): Promise<number | null> => {
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
          // AUFTRAG-mega28 A2: die Abdeckung reist mit dem Abschluss ans KO — DORT liest sie die
          // Oberfläche (Badge/Bestätigungs-Karte), nicht nur ein internes Feld.
          ...(outcome.coverage ? { coverage: outcome.coverage } : {}),
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
      return null;
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
          return current.version;
        }
      }
    } catch {
      // Nachlesen scheiterte — kein Auto-Retry; der Lazy-Re-Enqueue greift später.
    }
    return null;
  };

  const pump = (): void => {
    while (active < AI_CHECK_CONCURRENCY && queue.length > 0) {
      const koId = queue.shift() as string;
      queuedIds.delete(koId);
      queuedVersions.delete(koId); // der Lauf (runOne) liest seine Erwartung selbst frisch
      runningIds.add(koId);
      active += 1;
      void runOne(koId)
        .catch(() => null)
        .then((requeueVersion) => {
          runningIds.delete(koId);
          active -= 1;
          if (requeueVersion !== null) {
            // NACH der runningIds-Freigabe — sonst würde die Dedupe den frischen Job schlucken.
            // WP-SHIP8-CLOSE-2 (bens F3): die Zielversion des frischen Vermerks reist synchron mit.
            enqueueInternal(koId, requeueVersion);
          }
          pump();
        });
    }
    flushIdle();
  };

  return {
    enqueue(koId: string, expectedKoVersion?: number): void {
      enqueueInternal(koId, expectedKoVersion);
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
// WP-SHIP8-FINAL (bens Bedingung 2) + WP-SHIP8-CLOSE (bens F1): der Status kommt aus dem
// TATSÄCHLICHEN Ausgang der Läufe, nie aus status().active allein. Die detect*-Kerne schlucken
// Judge-Fehler intern — und der Reasoner selbst verschluckte VOR F1 normale Provider-/HTTP-/
// Netz-/Parsefehler zu null (nur werfende Fehler waren beobachtbar; genau bens Befund). Deshalb
// befragt der Runner jetzt den ERGEBNIS-VERTRAG der Judge-Flächen (judge*Outcome: verdict ODER
// failure-Ursache): irgendein failure in irgendeinem Lauf → aiCheck failed/<Ursache>
// (model-error bzw. model-timeout; der deterministische Anteil läuft weiter, Teilergebnisse
// bleiben stehen — nur der Status ist ehrlich failed). Ein GEWORFENER Fehler (ModelCapacityError-
// Backpressure, Erkennungsfehler über den Log-Haken) zählt weiter als model-error. Ohne aktives
// Modell lief nur der deterministische Anteil → ehrlich failed/no-model. Nur ein Lauf ohne
// jeden Fehler ist done. Die detect*-Kerne sehen unverändert die alte judge-Fläche
// (verdict | null) — keine Kernlogik-Änderung, nur Beobachtung.
export function createAiCheckRunner(deps: AiCheckRunnerDeps): AiCheckRunner {
  return async (koId: string): Promise<AiCheckRunOutcome> => {
    let failure: unknown = null;
    // RT-001 (bens Sammel-Review 3): die FEINE, strukturierte Providerfehler-Klasse (aus dem
    // Reasoner-Ausgang providerFailure → reasonFromModelFailure) — auth/rate-limit/unreachable/
    // bad-response/model-timeout. Sie GEWINNT vor der groben Judge-Ursache und wird NICHT wieder auf
    // „model-error" reduziert. Der grobe Rückfall greift nur, wenn nichts Feineres vorliegt.
    let structuredReason: AiCheckFailureReason | null = null;
    let coarseJudge: "model-error" | "model-timeout" | null = null;
    // D-AISTATE PAKET 1 (bens V1): war die KI-Ebene für IRGENDEIN Paar wegen Vertraulichkeit blockiert
    // (Cloud raus, kein lokales Modell)? Dann schließt der Lauf ehrlich mit fallbackReason "confidential"
    // ab — NICHT als schlichtes "done". Ein echter Modellfehler wiegt schwerer und gewinnt (s. unten).
    let confidentialBlocked = false;
    const captureFailure = (msg: string, err: unknown): void => {
      failure = failure ?? err ?? new Error(msg);
    };
    // RT-001: den GANZEN Judge-Ausgang lesen — die strukturierte providerFailure hat Vorrang, die grobe
    // failure ist nur Rückfall. So bleibt die feine Ursache des normalen Providerpfads erhalten.
    const noteJudgeOutcome = (outcome: ConflictJudgeOutcome | DuplicateJudgeOutcome): void => {
      if (outcome.providerFailure) {
        structuredReason = structuredReason ?? reasonFromModelFailure(outcome.providerFailure);
      }
      const reported = outcome.failure;
      if (reported === "model-error" || reported === "model-timeout") {
        coarseJudge = coarseJudge ?? reported;
      } else if (reported === "confidential") {
        confidentialBlocked = true;
      }
      // "no-model" trägt der status().active-Check unten — kein Fehler eines Modells.
    };
    // Schmaler Beobachtungs-Wrapper NUR über die zwei Judge-Flächen, die die detect*-Pfade
    // nutzen — kein Reasoner-Umbau, kein verändertes Routing (der echte Reasoner urteilt über
    // den F1-Ergebnis-Vertrag; die Kerne bekommen weiter verdict | null).
    // Der Struktur-Cast ist bewusst: die detect*-Deps tippen `Reasoner`, brauchen aber genau
    // diese zwei Methoden.
    // D-AISTATE PAKET 1 (bens V1): die Paar-Vertraulichkeit (vom Detection-Kern gesetzt) reicht bis in
    // den Reasoner durch — er nimmt bei `confidential` die Cloud aus der Judge-Kette (kein Egress). Die
    // Signatur spiegelt EXAKT die echte Facade (coreA, coreB, locale, confidential): der App-Root-
    // Callback ruft judgeConflict(a, b, "de", confidential) — locale ist das dritte Argument.
    const observedReasoner = {
      judgeConflict: async (
        a: string,
        b: string,
        locale: "de" | "en" = "de",
        confidential = false,
      ) => {
        try {
          const outcome = await deps.reasoner.judgeConflictOutcome(a, b, locale, confidential);
          noteJudgeOutcome(outcome);
          return outcome.verdict;
        } catch (err) {
          failure = failure ?? err;
          throw err;
        }
      },
      judgeDuplicate: async (
        a: string,
        b: string,
        locale: "de" | "en" = "de",
        confidential = false,
      ) => {
        try {
          const outcome = await deps.reasoner.judgeDuplicateOutcome(a, b, locale, confidential);
          noteJudgeOutcome(outcome);
          return outcome.verdict;
        } catch (err) {
          failure = failure ?? err;
          throw err;
        }
      },
    } as unknown as Reasoner;
    // AUFTRAG-mega28 A2/A3: beide Läufe melden ihre Abdeckung; die ZUSAMMENFASSUNG nimmt die
    // schwächere (mergeCoverage) — sie darf nie mehr behaupten, als der schlechtere Lauf trägt.
    const conflictCoverage = await detectConflictsForKo(
      koId,
      { ko: deps.ko, conflicts: deps.conflicts, reasoner: observedReasoner },
      captureFailure,
    );
    const duplicateCoverage = await detectDuplicatesForKo(
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
    const coverage: AiCheckCoverage = mergeCoverage(conflictCoverage, duplicateCoverage);
    // RT-001: die feinere strukturierte Klasse gewinnt vor der groben Judge-Ursache; die grobe greift
    // nur, wenn nichts Feineres vorliegt. So bleibt der normale Providerpfad (401/429/5xx/Parse) ehrlich
    // fein statt pauschal „model-error".
    const judgeReason = structuredReason ?? coarseJudge;
    if (judgeReason !== null) {
      return { ok: false, fallbackReason: judgeReason, coverage };
    }
    if (failure !== null) {
      // RT-001: ENG BEGRENZTER Regex-Fallback NUR für geworfene, uneingeordnete Fehler (z. B.
      // ModelCapacityError → model-error; Detection-/Backpressurefehler über den Log-Haken). Der
      // strukturierte Weg oben hat hier bereits Vorrang gehabt.
      return { ok: false, fallbackReason: classifyAiCheckFailure(failure), coverage };
    }
    // bens V1: eine vertraulichkeitsbedingte KI-Blockade ist ehrlich "confidential" (Cloud-only), NICHT
    // "done" — geprüft wurde nur die (lokale) deterministische Ebene, nicht per zulässigem Modell.
    if (confidentialBlocked) {
      return { ok: false, fallbackReason: "confidential", coverage };
    }
    if (!deps.reasoner.status().active) {
      return { ok: false, fallbackReason: "no-model", coverage };
    }
    return { ok: true, coverage };
  };
}

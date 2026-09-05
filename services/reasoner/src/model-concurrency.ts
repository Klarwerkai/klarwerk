// SCRUM-498 B2: prozess-globaler In-Flight-Cap für ALLE Modellaufrufe. Jeder Modell-/Provider-Aufruf
// geht durch den EINEN Chokepoint ModelClient.complete() — answer, judgeDuplicate, judgeConflict,
// extract, enrichPublic, probe. Der Cap umschließt genau diesen Aufruf (cappedModelClient), sodass die
// GESAMT-Gleichzeitigkeit über alle Requests hinweg begrenzt ist (Session UND addon, ask UND
// check-text-deep). Bei Normallast (< N in flight) ein NO-OP ohne Delay. Ist die Warteschlange voll oder
// läuft das Acquire in einen Timeout, wird ein ModelCapacityError geworfen (Backpressure) — kein Crash,
// kein unbounded Warten. Nicht zu verwechseln mit dem Slice-1-Rate-Limit (Request-Rate, addon-only).

import { AsyncLocalStorage } from "node:async_hooks";
import type { ModelClient } from "./provider-model";

// Backpressure-Signal: KEIN Provider-Fehler (nicht auf den nächsten Provider ausweichen / nicht still
// schlucken) — die Reasoner-Kette reicht ihn durch, die HTTP-Schicht macht daraus 503 + Retry-After.
export class ModelCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelCapacityError";
  }
}

// SCRUM-502 Schicht 2 (Sicherheitsnetz): der Cloud-Modell-Client verweigert vertrauliche Inhalte
// per Konstruktion. Das eigentliche Egress-Routing liegt im Reasoner (vertraulich → Cloud aus der
// Kette); dieser Wächter am Chokepoint stellt sicher, dass selbst ein künftiger, das Routing
// umgehender Aufrufer vertraulichen Text NIE an die Cloud gibt — er wirft, BEVOR inner.complete
// (der echte HTTP-Aufruf) läuft. Fällt in der Reasoner-Kette still auf den nächsten Provider
// (lokal/deterministisch) zurück — kein Egress, aber die Anfrage bleibt bedient.
export class ConfidentialEgressError extends Error {
  constructor() {
    super("Vertrauliche Inhalte dürfen die Cloud-KI nicht nutzen.");
    this.name = "ConfidentialEgressError";
  }
}

export interface ModelCapConfig {
  max: number; // max. gleichzeitige Modellaufrufe
  queueMax: number; // max. Wartende, bevor sofort abgelehnt wird
  acquireTimeoutMs: number; // max. Wartezeit auf einen Slot
}

const DEFAULT_MAX = 6;
const DEFAULT_QUEUE_MAX = 20;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10_000;

function posInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// env-tunable: KLARWERK_MODEL_MAX_INFLIGHT / _QUEUE_MAX / _ACQUIRE_TIMEOUT_MS. Ungültig/fehlend → Default.
export function modelCapConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): ModelCapConfig {
  return {
    max: posInt(env.KLARWERK_MODEL_MAX_INFLIGHT, DEFAULT_MAX),
    queueMax: posInt(env.KLARWERK_MODEL_QUEUE_MAX, DEFAULT_QUEUE_MAX),
    acquireTimeoutMs: posInt(env.KLARWERK_MODEL_ACQUIRE_TIMEOUT_MS, DEFAULT_ACQUIRE_TIMEOUT_MS),
  };
}

interface Waiter {
  resolve: (release: () => void) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// Fairer FIFO-Semaphore mit begrenzter Warteschlange + Acquire-Timeout.
export class ModelSemaphore {
  private inFlight = 0;
  private readonly waiters: Waiter[] = [];

  constructor(private readonly config: ModelCapConfig) {}

  get activeCount(): number {
    return this.inFlight;
  }
  get queuedCount(): number {
    return this.waiters.length;
  }

  // Löst mit einer idempotenten release()-Funktion auf. Wirft ModelCapacityError, wenn die Warteschlange
  // voll ist oder der Slot nicht rechtzeitig frei wird.
  acquire(): Promise<() => void> {
    if (this.inFlight < this.config.max) {
      this.inFlight += 1;
      return Promise.resolve(this.makeRelease());
    }
    if (this.waiters.length >= this.config.queueMax) {
      return Promise.reject(
        new ModelCapacityError(
          `Modell ausgelastet: ${this.inFlight} gleichzeitig aktiv, Warteschlange voll (${this.config.queueMax}).`,
        ),
      );
    }
    return new Promise<() => void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) {
          this.waiters.splice(idx, 1);
        }
        reject(
          new ModelCapacityError(
            `Modell ausgelastet: kein Slot innerhalb ${this.config.acquireTimeoutMs} ms frei.`,
          ),
        );
      }, this.config.acquireTimeoutMs);
      // Der Timer darf den Prozess nicht am Leben halten (Node).
      if (typeof (timer as { unref?: () => void }).unref === "function") {
        (timer as { unref: () => void }).unref();
      }
      this.waiters.push({ resolve, reject, timer });
    });
  }

  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const next = this.waiters.shift();
      if (next) {
        clearTimeout(next.timer);
        // Slot direkt an den nächsten Wartenden weiterreichen — inFlight bleibt konstant.
        next.resolve(this.makeRelease());
      } else {
        this.inFlight -= 1;
      }
    };
  }
}

let singleton: ModelSemaphore | undefined;

function semaphore(): ModelSemaphore {
  if (!singleton) {
    singleton = new ModelSemaphore(modelCapConfigFromEnv());
  }
  return singleton;
}

// Nur für Tests: erzwingt Neu-Einlesen der Env beim nächsten Zugriff.
export function resetModelSemaphoreForTests(): void {
  singleton = undefined;
}

// Führt fn genau dann aus, wenn ein Slot frei ist; gibt ihn IMMER frei (auch im Fehlerfall → finally).
export async function withModelSlot<T>(fn: () => Promise<T>): Promise<T> {
  const release = await semaphore().acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

// ================================================================================================
// JOB 3036 RUNDE 2 — DIE PROVIDER-AUSWAHL IST KEIN BELEG FÜR EINEN MODELLAUFRUF.
// ================================================================================================
//
// DER BEFUND (ben, Runde 1): Runde 1 schrieb den Modellnamen, sobald ein Modell-Provider den Lauf
// erfolgreich beendet hatte. Der `ModelProvider` hat aber vier Wege, die VOR jedem Client-Aufruf
// zurückkehren — `answer` ohne tragende Quelle (`provider-model.ts:1442`), das bereits
// abgeschlossene `interview` (`:1323`), `extract` auf leerem Dokument (`:1351`) und `helpAnswer`
// ohne Wissensbasis (`:1203`) —, und `select` ruft überhaupt nie ein Modell. In all diesen Fällen
// nannte das Protokoll ein Modell, das nichts getan hat. Das ist genau die Sorte Behauptung, gegen
// die dieser Auftrag angetreten ist.
//
// DIE ANTWORT IST EINE LAUF-SPUR, KEIN MERKER AM OBJEKT. Ein Feld am Provider oder am Client wäre
// falsch: `model-concurrency` bedient GLEICHZEITIGE Läufe auf DERSELBEN Instanz (das ist der ganze
// Zweck dieser Datei), ein solcher Merker liefe zwischen parallelen Läufen über. `AsyncLocalStorage`
// trägt den Zustand entlang der ASYNCHRONEN AUFRUFKETTE genau eines Laufs — zwei parallele Läufe
// sehen zwei verschiedene Spuren, auch wenn sie durch dieselbe Client-Instanz gehen.
//
// GESETZT WIRD SIE AM EINZIGEN ORT, AN DEM DER AUFRUF WIRKLICH GESCHIEHT: innerhalb des
// Slot-Rahmens, nach dem Egress-Wächter. Ein am Wächter abgewiesener (ConfidentialEgressError) und
// ein an der Auslastung gescheiterter Aufruf (ModelCapacityError, der Slot wird nie erteilt) haben
// das Modell NICHT befragt und hinterlassen deshalb auch keine Spur.
const modellAufrufSpur = new AsyncLocalStorage<ModellAufrufSpur>();

// ================================================================================================
// JOB 3074 — DER VERBRAUCH REIST AUF DERSELBEN SPUR, AUS DEMSELBEN GRUND.
// ================================================================================================
//
// Der Tokenverbrauch braucht die Spur aus genau demselben Grund wie `gerufen` (s. o.): zwei
// gleichzeitige Läufe gehen durch DIESELBE Client-Instanz, und ein Merker am Modul oder am Objekt
// liefe zwischen ihnen über — ein billiger Lauf trüge dann den Verbrauch eines teuren.
//
// UND ER BRAUCHT SIE ZUSÄTZLICH FÜR EINEN ZWEITEN FALL, den `gerufen` nicht kennt: Aufgaben mit
// MEHREREN Modellaufrufen je Lauf. `extract` schickt ein langes Dokument abschnittsweise durch das
// Modell (`provider-model.ts:1378-1387`); für `gerufen` ist das einerlei (einmal true bleibt true),
// für den Verbrauch nicht — er wird ADDIERT, sonst meldete ausgerechnet die teuerste Aufgabe den
// Verbrauch ihres letzten und kürzesten Abschnitts.
//
// WARUM DER TYP HIER STEHT UND NICHT AUS `model-runs` IMPORTIERT WIRD: das wären zwei Schichten mit
// einer Abhängigkeit in die falsche Richtung — der In-Flight-Sammler ist reasoner-intern, das
// Protokollfeld gehört dem Modul `model-runs`. Dass beide Formen deckungsgleich BLEIBEN, prüft der
// Compiler in `tests/ki-lauf-verbrauch/eine-wahrheit.test.ts`; dieselbe Bauform sichert schon die
// Spiegelung des Client-Typs (`tests/ki-aufgabenarten/aufgabenarten-eine-wahrheit.test.ts`).

/** Der von einer Modell-API SELBST gemeldete Verbrauch, addiert über die Aufrufe EINES Laufs. */
export interface ModellVerbrauch {
  eingabeToken: number;
  ausgabeToken: number;
  /** Zahl der Aufrufe dieses Laufs, die einen brauchbaren Verbrauch gemeldet haben (≥ 1). */
  gemeldeteAufrufe: number;
}

/** Die Spur EINES Laufs: hat in ihm wirklich ein Modellaufruf stattgefunden — und was kostete er? */
export interface ModellAufrufSpur {
  gerufen: boolean;
  /**
   * FEHLT, solange kein Aufruf dieses Laufs einen brauchbaren Verbrauch genannt hat. Das ist nicht
   * dasselbe wie `0`: `undefined` heißt „unbekannt", `0` wäre ein Messwert (s. `ModelRunVerbrauch`
   * in `services/model-runs/src/types.ts`).
   */
  verbrauch?: ModellVerbrauch;
}

// DIE EINZIGE STELLE, DIE ZWEI VERBRÄUCHE ZU EINEM ADDIERT. `runTask` braucht sie über die
// Provider-VERSUCHE eines Laufs hinweg (eine gescheiterte Cloud-Anfrage ist bezahlt, auch wenn
// danach das lokale Modell antwortet), `meldeModellVerbrauch` innerhalb eines Versuchs. Zwei
// Additionswege wären zwei Zählungen desselben Vorgangs.
//
// Kommt ein ECHTER Verbrauch hinzu, ist das Ergebnis immer einer — nur die Summe aus zweimal
// „nichts" ist wieder nichts. Die zwei Signaturen sagen genau das, damit der Meldeweg unten kein
// `undefined` behandeln muss, das dort nicht entstehen kann (`exactOptionalPropertyTypes`).
export function verbrauchSumme(
  bisher: ModellVerbrauch | undefined,
  weiterer: ModellVerbrauch,
): ModellVerbrauch;
export function verbrauchSumme(
  bisher: ModellVerbrauch | undefined,
  weiterer: ModellVerbrauch | undefined,
): ModellVerbrauch | undefined;
export function verbrauchSumme(
  bisher: ModellVerbrauch | undefined,
  weiterer: ModellVerbrauch | undefined,
): ModellVerbrauch | undefined {
  if (!bisher) {
    return weiterer;
  }
  if (!weiterer) {
    return bisher;
  }
  return {
    eingabeToken: bisher.eingabeToken + weiterer.eingabeToken,
    ausgabeToken: bisher.ausgabeToken + weiterer.ausgabeToken,
    gemeldeteAufrufe: bisher.gemeldeteAufrufe + weiterer.gemeldeteAufrufe,
  };
}

// Was als Tokenzahl durchgeht: eine ganze, nicht-negative, sichere Zahl. Alles andere — Text,
// negative Werte, gebrochene Werte, `null`, fehlend — ist KEINE Auskunft und wird verworfen, statt
// auf 0 abgerundet zu werden. `0` selbst geht durch: eine Antwort ohne Ausgabetoken ist ein echter
// Messwert (Denkphase ohne Antwortinhalt).
function tokenzahl(roh: unknown): number | null {
  return Number.isSafeInteger(roh) && (roh as number) >= 0 ? (roh as number) : null;
}

// DER MELDEWEG. Ein Client ruft ihn, wenn die API ihm einen Verbrauch GENANNT hat; er entscheidet
// als einzige Stelle, ob die genannten Werte brauchbar sind, und addiert sie in die Spur des
// laufenden Laufs. Ohne laufenden Kontext (Probe, completeRaw, direkte Client-Nutzung) ein No-op —
// dort entsteht ohnehin kein Protokolleintrag.
//
// BEIDE WERTE ODER KEINER: fehlt eine der zwei Zahlen, wird nichts gemeldet. Die andere allein
// aufzunehmen hieße, die fehlende Hälfte mit einer 0 zu füllen — genau die erfundene Zahl, gegen
// die dieser Weg gebaut ist.
export function meldeModellVerbrauch(eingabeRoh: unknown, ausgabeRoh: unknown): void {
  const spur = modellAufrufSpur.getStore();
  if (!spur) {
    return;
  }
  const eingabeToken = tokenzahl(eingabeRoh);
  const ausgabeToken = tokenzahl(ausgabeRoh);
  if (eingabeToken === null || ausgabeToken === null) {
    return;
  }
  spur.verbrauch = verbrauchSumme(spur.verbrauch, {
    eingabeToken,
    ausgabeToken,
    gemeldeteAufrufe: 1,
  });
}

// Führt fn im Lauf-Kontext von `spur` aus. Alles, was innerhalb von fn (auch über beliebig viele
// awaits hinweg) durch den Chokepoint geht, trägt sich in GENAU diese Spur ein.
export function mitModellAufrufSpur<T>(spur: ModellAufrufSpur, fn: () => Promise<T>): Promise<T> {
  return modellAufrufSpur.run(spur, fn);
}

// Der Vermerk am Chokepoint. Ohne laufenden Kontext (Probe, completeRaw, direkte Client-Nutzung)
// ein No-op — dort entsteht ohnehin kein Protokolleintrag.
function vermerkeModellAufruf(): void {
  const spur = modellAufrufSpur.getStore();
  if (spur) {
    spur.gerufen = true;
  }
}

// Umschließt einen ModelClient, sodass JEDER complete()-Aufruf durch den globalen Semaphore geht.
// Der einzige Ort, an dem der Cap greift — kein Bypass, weil alle Provider-Methoden hierüber laufen.
// SCRUM-502 Schicht 2/R8: `rejectsConfidential` ist PFLICHT (kein Default) — der Aufrufer MUSS die
// Egress-Politik explizit setzen und kann den Wächter nicht durch Weglassen umgehen. `true` (Cloud):
// vertraulicher Text (confidential=true) → ConfidentialEgressError, BEVOR der echte Aufruf läuft.
// `false` (lokal/on-prem, kein externer Egress): bedient vertrauliche Inhalte weiter. Beide Wege gehen
// weiter durch den globalen In-Flight-Cap.
export function cappedModelClient(
  inner: ModelClient,
  opts: { rejectsConfidential: boolean },
): ModelClient {
  const innerVision = inner.completeVision?.bind(inner);
  return {
    name: inner.name,
    // D-AISTATE PAKET 1 (bens V1, aistate-fix3): die Egress-Politik ist am gewrappten Client SICHTBAR —
    // der Reasoner schließt darüber einen vertraulichkeits-untauglichen Provider (Cloud bzw. „lokal"
    // ohne bestätigte On-Prem-Origin) bei vertraulichen Paaren VOR jedem Aufruf aus der Kette aus.
    rejectsConfidential: opts.rejectsConfidential,
    // JOB 3036: der Modellbezeichner des inneren Clients reist mit. Dieser Wrapper ist der EINZIGE
    // Weg nach draußen (model-client.ts:411-425 und :465-482) — was er nicht kopiert, existiert für
    // das Produkt nicht. Nur setzen, wenn der innere Client wirklich einen nennt: ein
    // `model: undefined`-Feld wäre eine Angabe, die keine ist.
    ...(inner.model ? { model: inner.model } : {}),
    complete: (system: string, user: string, confidential: boolean, maxTokens?: number) => {
      if (opts.rejectsConfidential && confidential) {
        return Promise.reject(new ConfidentialEgressError());
      }
      return withModelSlot(() => {
        // JOB 3036 R2: HIER geschieht der Aufruf wirklich — Wächter passiert, Slot erteilt.
        vermerkeModellAufruf();
        return inner.complete(system, user, confidential, maxTokens);
      });
    },
    // WP-BILD-1c: der Vision-Pfad läuft durch DENSELBEN Chokepoint (Egress-Wächter + In-Flight-Cap)
    // wie complete — kein Bypass über Bilder. Nur vorhanden, wenn der innere Client Vision kann.
    ...(innerVision
      ? {
          completeVision: (
            system: string,
            imageDataUrl: string,
            user: string,
            confidential: boolean,
            maxTokens?: number,
          ) => {
            if (opts.rejectsConfidential && confidential) {
              return Promise.reject(new ConfidentialEgressError());
            }
            return withModelSlot(() => {
              // JOB 3036 R2: der Bildweg zählt genauso als Modellaufruf wie der Textweg.
              vermerkeModellAufruf();
              return innerVision(system, imageDataUrl, user, confidential, maxTokens);
            });
          },
        }
      : {}),
  };
}

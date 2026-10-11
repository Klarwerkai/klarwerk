// ================================================================================================
// AUFNAHME 20260922 · gesamt-pruefung-hintergrund — NACHHOLEN UND LAUFENDER ABGLEICH.
// ================================================================================================
//
// R-1102 ist seit WP-SUBMIT-ASYNC geliefert (ai-check-worker.ts): das Einreichen wartet nicht auf
// die KI, die Prüfung meldet sich über den Prüfvermerk nach. Offen waren zwei Dinge, die dieser EINE
// periodische Lauf schließt — beide über den BESTEHENDEN Wiederholweg (markAiCheckPending + Worker,
// derselbe wie der Knopf „Prüfung erneut"), keine zweite Erkennungskette:
//
//  R-1125 / N-0073 — NACHHOLEN. Ein gescheiterter oder unvollständiger Lauf (`failed`, auch der
//    Teilausfall „8 von 9 Nachbarn, 1 wegen Fehlern ausgelassen") blieb liegen, bis jemand den Knopf
//    drückte; ein festhängender `pending`-Vermerk wurde nur nachgeholt, wenn jemand das Prüfbrett lud.
//    Jetzt reiht der Lauf beides neu ein, sobald ein Modell aktiv ist. Die Teilprüfungskennzeichnung
//    bleibt unverändert: der Worker schreibt erst nach dem Lauf wieder `done` oder `failed` samt
//    Abdeckung — ein erneuter Teilausfall bleibt sichtbar teilgeprüft.
//
//  R-1111 — LAUFENDER ABGLEICH. Ein Nachweis ist an seine Prüfbasis samt Vergleichsbestand gebunden
//    (knowledge-object/src/pruefbasis.ts). Ändert sich später ein Nachbar, ist er überholt — ein
//    Widerspruch kann erst danach entstanden sein. Diese Objekte holt der Lauf nach, ältester Nachweis
//    zuerst, innerhalb des Tagesbudgets. Entschiedene Paare (Fehlalarm, getrennt, verknüpft) mit
//    unveränderten Fassungen legt die Erkennung dabei nicht neu an (conflicts: hasOpenPair).
//
// BUDGET (bens Befunde zu R-1111):
//  · GEZÄHLT wird jeder einzelne Modellvergleich, getrennt nach Konflikt- und Duplikatweg — über den
//    Haken `vorVergleich` des Runners, der VOR jedem Urteil gerufen wird. `coverage.attempted` ist
//    dafür ungeeignet: es ist die konservative MINDESTabdeckung beider Wege (mergeCoverage), keine
//    Verbrauchszahl. Ein Vergleich zählt, sobald er freigegeben ist — auch wenn er scheitert.
//  · DURCHGESETZT wird das Restbudget in zwei Stufen: vor jedem Objekt wird sein Höchstverbrauch
//    (beide Wege je Kandidatendeckel) reserviert — reicht der Rest nicht, beginnt das Objekt nicht und
//    bleibt für einen späteren Lauf liegen. Innerhalb des Objekts verweigert der Haken jeden Vergleich
//    jenseits der Reservierung (ModelCapacityError → der Lauf endet ehrlich teilgeprüft). Das Budget
//    wird damit nie überschritten.
//  · DAUERHAFT: VOR dem ersten Vergleich eines Objekts steht eine RESERVIERUNG des Höchstverbrauchs
//    als Beleg `pruefung.hintergrundlauf.verbrauch` im append-only Protokoll; danach ersetzt eine
//    ABRECHNUNG (gleiche Kennung, Zähler je Weg) sie durch den tatsächlichen Verbrauch. Beim ersten
//    Lauf eines Tages — auch nach einem Neustart — wird der Tagesverbrauch daraus wiederhergestellt;
//    eine Reservierung ohne Abrechnung (Schreibfehler, Prozessende dazwischen) zählt voll. Scheitert
//    die Reservierung, startet kein Vergleich; ist das Protokoll nicht lesbar, läuft nichts
//    (fail-closed: unbelegter Verbrauch gewährt kein neues Budget).
//
// EIGENER WORKER: der Lauf arbeitet über eine eigene Worker-Instanz mit demselben Runner plus Haken.
// So zählen Einreichungen der Nutzer (Haupt-Worker) nicht gegen das Hintergrundbudget. Vor jedem
// Objekt wartet der Lauf, bis der Haupt-Worker leer ist — Einreichungen haben Vorrang, und beide
// fragen das Modell nicht gleichzeitig an (bis auf eine Einreichung, die genau während eines
// Hintergrund-Objekts eintrifft).
//
// PROTOKOLL: jeder Lauf, der etwas getan hat (ohne Modell: einmal je Tag), schreibt EINEN Eintrag
// `pruefung.hintergrundlauf` — nur Zähler, keine Inhalte, keine Kennungen. Einzelne Funde stehen wie
// bisher als `conflict.auto-created` / `overlap.auto-created` im Protokoll.
//
// GRENZEN: Ob ein Anbieter erreichbar ist, zeigt erst der Versuch: scheitert ein Lauf an einer
// Erreichbarkeitsursache, endet dieser Takt, der nächste versucht es erneut. Unberührt bleiben Objekte
// ohne Prüfvermerk (Import ohne angeforderte Prüfung, R-0145), Objekte in Schutzdaten-Quarantäne
// (R-0658), vertraulich gesperrte Läufe (`confidential` — dort hilft nur eine andere Modellwahl) und
// im Abgleich die Vorführdaten (K0-3).
import { randomUUID } from "node:crypto";
import type { AuditEntry, AuditFilter, AuditInput } from "../../audit";
import { type KnowledgeObject, inSchutzdatenQuarantaene } from "../../knowledge-object";
import { ModelCapacityError } from "../../reasoner";
import {
  type AiCheckFailureReason,
  type AiCheckWorker,
  shouldReEnqueueAiCheck,
} from "./ai-check-worker";
import { DETECTION_CANDIDATE_CAP } from "./detection-cap";
// Der Zeitgeber (`starteHintergrundpruefung`) wohnt in hintergrundpruefung-start.ts: dieses Modul
// lädt build-app.ts, und der Zeitgeber gehört nur in den Prozessstart (server.ts).

export const HINTERGRUNDLAUF_AUDIT = "pruefung.hintergrundlauf";
export const HINTERGRUNDLAUF_VERBRAUCH_AUDIT = "pruefung.hintergrundlauf.verbrauch";

// Vorgaben aus dem Fachkonzept (docs/qm/BERATER_KONZEPT_KONFLIKTERKENNUNG_2026-07-04.md §3.3):
// stündlich, 50 Modellvergleiche je Lauf, 500 je Tag. Bewusst Konstanten, keine Umgebungswerte —
// ein Stellwert im Startvertrag folgt, wenn der Betrieb ihn braucht.
export const HINTERGRUNDLAUF_INTERVAL_MS = 60 * 60_000;
export const HINTERGRUNDLAUF_LAUFBUDGET = 50;
export const HINTERGRUNDLAUF_TAGESBUDGET = 500;
// Höchstverbrauch EINES Objektlaufs: beide Wege (Konflikt, Duplikat) je Kandidatendeckel.
export const HINTERGRUNDLAUF_MAX_JE_OBJEKT = 2 * DETECTION_CANDIDATE_CAP;

// Ursachen, die auf einen nicht nutzbaren Modellweg zeigen: ein weiterer Versuch im selben Takt
// scheiterte ebenso. Andere Fehlschläge (unverständliche Antwort, Sammelfehler) betreffen das eine
// Objekt — der Lauf geht weiter.
const NICHT_ERREICHBAR: ReadonlySet<string> = new Set<AiCheckFailureReason>([
  "no-model",
  "unreachable",
  "rate-limit",
  "auth",
  "model-timeout",
  "timeout",
]);

export type Vergleichsweg = "konflikt" | "dublette";

export interface HintergrundlaufBericht {
  nachgeholt: number;
  abgeglichen: number;
  fehlgeschlagen: number;
  /** Objekte, die nach diesem Lauf weiter anstehen. */
  offen: number;
  /** Tatsächliche Modellvergleiche dieses Laufs, gesamt und je Weg. */
  vergleiche: number;
  vergleicheKonflikt: number;
  vergleicheDublette: number;
  vergleicheHeute: number;
  tagesbudget: number;
  abbruch?: "kein-modell" | "modell-nicht-erreichbar" | "budget" | "verbrauch-unbelegt";
}

type PruefWorker = Pick<AiCheckWorker, "enqueue" | "has" | "idle">;

export interface HintergrundpruefungDeps {
  ko: {
    list(): Promise<KnowledgeObject[]>;
    get(id: string): Promise<KnowledgeObject | undefined>;
    markAiCheckPending(id: string): Promise<boolean>;
  };
  /** Der Worker der Einreichungen: Vorrang und Doppelauftrags-Schutz. */
  hauptWorker: Pick<AiCheckWorker, "has" | "idle">;
  /** Baut den eigenen Worker; `vorVergleich` geht an den Runner (AiCheckRunnerDeps.vorVergleich). */
  baueWorker: (vorVergleich: (weg: Vergleichsweg) => void) => PruefWorker;
  modellAktiv: () => boolean;
  audit: {
    record(input: AuditInput): Promise<unknown>;
    list(filter?: AuditFilter): Promise<AuditEntry[]>;
  };
  now?: () => number;
  laufbudget?: number;
  tagesbudget?: number;
  maxJeObjekt?: number;
}

type Art = "nachholen" | "abgleich";

const rang = (art: Art): number => (art === "nachholen" ? 0 : 1);

function zeitpunkt(ko: KnowledgeObject): number {
  const wert = Date.parse(ko.aiCheck?.finishedAt ?? ko.aiCheck?.requestedAt ?? "");
  return Number.isFinite(wert) ? wert : 0;
}

/** Welche Arbeit steht für dieses Objekt an? `null` = keine. Rein. */
export function hintergrundArt(ko: KnowledgeObject, nowMs: number): Art | null {
  const vermerk = ko.aiCheck;
  if (!vermerk || inSchutzdatenQuarantaene(ko)) {
    return null;
  }
  if (vermerk.status === "failed") {
    return vermerk.fallbackReason === "confidential" ? null : "nachholen";
  }
  if (vermerk.status === "pending") {
    return shouldReEnqueueAiCheck(vermerk, nowMs) ? "nachholen" : null;
  }
  return vermerk.ueberholt && !ko.demoSeed ? "abgleich" : null;
}

/**
 * Tagesverbrauch aus den Verbrauchsbelegen des Protokolls (Tag im Beleg, nicht die Schreibzeit).
 * Je Objektlauf gibt es eine RESERVIERUNG (vor dem ersten Vergleich geschrieben, Höchstverbrauch)
 * und eine ABRECHNUNG (tatsächlicher Verbrauch) mit derselben Kennung. Eine Reservierung ohne
 * Abrechnung — Schreibfehler oder Prozessende dazwischen — zählt in voller Höhe. Belege ohne
 * Reservierungskennung zählen mit ihrem Wert.
 */
export function verbrauchAusBelegen(belege: readonly AuditEntry[], tag: string): number {
  const reserviert = new Map<string, number>();
  const abgerechnet = new Map<string, number>();
  let summe = 0;
  for (const beleg of belege) {
    const { tag: belegTag, vergleiche, reservierung, art } = beleg.payload;
    if (belegTag !== tag || typeof vergleiche !== "number" || vergleiche < 0) {
      continue;
    }
    if (typeof reservierung !== "string") {
      summe += vergleiche;
    } else if (art === "reservierung") {
      reserviert.set(reservierung, vergleiche);
    } else {
      abgerechnet.set(reservierung, vergleiche);
    }
  }
  for (const [kennung, hoechstens] of reserviert) {
    summe += abgerechnet.get(kennung) ?? hoechstens;
  }
  for (const [kennung, vergleiche] of abgerechnet) {
    if (!reserviert.has(kennung)) {
      summe += vergleiche;
    }
  }
  return summe;
}

function verbrauchsbeleg(
  tag: string,
  art: "reservierung" | "abrechnung",
  reservierung: string,
  vergleiche: number,
  zusatz: Record<string, number> = {},
): AuditInput {
  return {
    actor: "system",
    action: HINTERGRUNDLAUF_VERBRAUCH_AUDIT,
    target: "bestand",
    payload: { tag, art, reservierung, vergleiche, ...zusatz },
  };
}

export function createHintergrundpruefung(
  deps: HintergrundpruefungDeps,
): () => Promise<HintergrundlaufBericht | null> {
  const now = deps.now ?? (() => Date.now());
  const laufbudget = deps.laufbudget ?? HINTERGRUNDLAUF_LAUFBUDGET;
  const tagesbudget = deps.tagesbudget ?? HINTERGRUNDLAUF_TAGESBUDGET;
  const maxJeObjekt = deps.maxJeObjekt ?? HINTERGRUNDLAUF_MAX_JE_OBJEKT;
  // `tag` ist erst gesetzt, wenn der Verbrauch dieses Tages aus den Belegen wiederhergestellt ist.
  let tag = "";
  let heute = 0;
  let keinModellGemeldet = "";
  let laeuft = false;

  // Freigabe je Objekt: außerhalb eines Objektlaufs 0 — auch ein verspäteter Vergleich eines
  // abgelaufenen Jobs bekommt dann keinen Platz.
  let freigegeben = 0;
  const verbraucht: Record<Vergleichsweg, number> = { konflikt: 0, dublette: 0 };
  const worker = deps.baueWorker((weg) => {
    if (verbraucht.konflikt + verbraucht.dublette >= freigegeben) {
      throw new ModelCapacityError("Budget der Hintergrundprüfung erschöpft");
    }
    verbraucht[weg] += 1;
  });

  // Abrechnung einer Reservierung mit dem tatsächlichen Verbrauch. false = nicht geschrieben.
  const rechneAb = async (
    reservierung: string,
    konflikt: number,
    dublette: number,
  ): Promise<boolean> => {
    try {
      await deps.audit.record(
        verbrauchsbeleg(tag, "abrechnung", reservierung, konflikt + dublette, {
          konflikt,
          dublette,
        }),
      );
      return true;
    } catch {
      return false;
    }
  };

  const protokolliere = async (bericht: HintergrundlaufBericht): Promise<void> => {
    await deps.audit
      .record({
        actor: "system",
        action: HINTERGRUNDLAUF_AUDIT,
        target: "bestand",
        payload: { ...bericht },
      })
      .catch(() => undefined);
  };

  const lauf = async (): Promise<HintergrundlaufBericht> => {
    const nowMs = now();
    const heuteTag = new Date(nowMs).toISOString().slice(0, 10);
    const bericht: HintergrundlaufBericht = {
      nachgeholt: 0,
      abgeglichen: 0,
      fehlgeschlagen: 0,
      offen: 0,
      vergleiche: 0,
      vergleicheKonflikt: 0,
      vergleicheDublette: 0,
      vergleicheHeute: heute,
      tagesbudget,
    };
    if (heuteTag !== tag) {
      try {
        heute = verbrauchAusBelegen(
          await deps.audit.list({ action: HINTERGRUNDLAUF_VERBRAUCH_AUDIT }),
          heuteTag,
        );
        tag = heuteTag;
      } catch {
        // Unbelegter Verbrauch gewährt kein Budget: ohne lesbare Belege läuft nichts.
        bericht.abbruch = "verbrauch-unbelegt";
        return bericht;
      }
      bericht.vergleicheHeute = heute;
    }
    const arbeit = (await deps.ko.list())
      .map((ko) => ({ ko, art: hintergrundArt(ko, nowMs) }))
      .filter((e): e is { ko: KnowledgeObject; art: Art } => e.art !== null)
      .filter((e) => !deps.hauptWorker.has(e.ko.id) && !worker.has(e.ko.id))
      // Nachholen vor Abgleich, innerhalb jeweils der älteste Vermerk zuerst.
      .sort((a, b) => rang(a.art) - rang(b.art) || zeitpunkt(a.ko) - zeitpunkt(b.ko));
    bericht.offen = arbeit.length;
    if (arbeit.length === 0) {
      return bericht;
    }
    if (!deps.modellAktiv()) {
      bericht.abbruch = "kein-modell";
      // Einmal je Tag ins Protokoll — der Rückstand bleibt sichtbar, ohne es stündlich zu füllen.
      if (keinModellGemeldet !== tag) {
        keinModellGemeldet = tag;
        await protokolliere(bericht);
      }
      return bericht;
    }
    for (const { ko, art } of arbeit) {
      // Reservierung: beginnt nur, wenn der Höchstverbrauch des Objekts in beide Budgets passt.
      const rest = Math.min(tagesbudget - heute, laufbudget - bericht.vergleiche);
      if (rest < maxJeObjekt) {
        bericht.abbruch = "budget";
        break;
      }
      // Einreichungen haben Vorrang.
      await deps.hauptWorker.idle();
      if (deps.hauptWorker.has(ko.id)) {
        continue; // inzwischen von einer Einreichung erfasst — bleibt dort
      }
      // DAUERHAFTE RESERVIERUNG VOR JEDEM VERGLEICH (bens Befund, nacharbeit-4): erst wenn der
      // Höchstverbrauch im Protokoll steht, wird irgendetwas freigegeben. Endet der Prozess danach,
      // zählt die Reservierung beim Neustart voll (verbrauchAusBelegen). Scheitert sie, läuft nichts.
      const reservierung = randomUUID();
      try {
        await deps.audit.record(verbrauchsbeleg(tag, "reservierung", reservierung, maxJeObjekt));
      } catch {
        bericht.abbruch = "verbrauch-unbelegt";
        break;
      }
      // Ab hier gilt die Reservierung, bis eine Abrechnung sie ersetzt.
      heute += maxJeObjekt;
      if (!(await deps.ko.markAiCheckPending(ko.id))) {
        bericht.offen -= 1; // gelöscht oder verschwunden — nichts mehr nachzuholen
        if (await rechneAb(reservierung, 0, 0)) {
          heute -= maxJeObjekt;
        }
        continue;
      }
      const vermerkt = await deps.ko.get(ko.id);
      verbraucht.konflikt = 0;
      verbraucht.dublette = 0;
      freigegeben = maxJeObjekt;
      try {
        worker.enqueue(ko.id, vermerkt?.aiCheck?.koVersion);
        await worker.idle();
      } finally {
        freigegeben = 0;
      }
      const objekt = verbraucht.konflikt + verbraucht.dublette;
      bericht.vergleicheKonflikt += verbraucht.konflikt;
      bericht.vergleicheDublette += verbraucht.dublette;
      bericht.vergleiche += objekt;
      bericht.offen -= 1;
      if (await rechneAb(reservierung, verbraucht.konflikt, verbraucht.dublette)) {
        heute += objekt - maxJeObjekt;
      } else {
        // Die Reservierung bleibt unabgerechnet und zählt — hier wie nach einem Neustart — voll.
        // Der Lauf endet, statt mit einem unsicheren Protokoll weiterzuarbeiten.
        bericht.abbruch = "verbrauch-unbelegt";
      }
      const nachher = (await deps.ko.get(ko.id))?.aiCheck;
      if (nachher?.status === "done") {
        bericht[art === "nachholen" ? "nachgeholt" : "abgeglichen"] += 1;
      } else {
        bericht.fehlgeschlagen += 1;
        if (
          !bericht.abbruch &&
          nachher?.fallbackReason &&
          NICHT_ERREICHBAR.has(nachher.fallbackReason)
        ) {
          bericht.abbruch = "modell-nicht-erreichbar";
        }
      }
      if (bericht.abbruch) {
        break;
      }
    }
    bericht.vergleicheHeute = heute;
    // Ein Takt, der wegen erschöpften Tagesbudgets nichts angefasst hat, schreibt nichts — den
    // Budgetstand hat der letzte arbeitende Lauf schon protokolliert.
    if (bericht.nachgeholt + bericht.abgeglichen + bericht.fehlgeschlagen > 0) {
      await protokolliere(bericht);
    }
    return bericht;
  };

  // Überlappende Takte (ein langer Lauf, ein neuer Tick) laufen nicht doppelt.
  return async () => {
    if (laeuft) {
      return null;
    }
    laeuft = true;
    try {
      return await lauf();
    } finally {
      laeuft = false;
    }
  };
}

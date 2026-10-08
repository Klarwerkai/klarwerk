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
// BUDGET: gezählt werden Modellvergleiche laut Abdeckungsprotokoll (`coverage.attempted`) — die Zahl,
// die Kosten erzeugt. Geprüft wird VOR jedem Objekt, je Lauf und je Kalendertag (UTC); ein einzelner
// Objektlauf ist durch den Kandidatendeckel der Erkennung begrenzt. Der Rest wartet auf den nächsten Takt.
//
// PROTOKOLL: jeder Lauf, der etwas getan hat (ohne Modell: einmal je Tag), schreibt EINEN Eintrag
// `pruefung.hintergrundlauf` — nur Zähler, keine Inhalte, keine Kennungen. Einzelne Funde stehen wie
// bisher als `conflict.auto-created` / `overlap.auto-created` im Protokoll.
//
// GRENZEN: Ein-Prozess-Betrieb (K0-6) — der Tageszähler lebt im Speicher und beginnt nach einem
// Neustart neu. Ob ein Anbieter erreichbar ist, zeigt erst der Versuch: scheitert ein Lauf an einer
// Erreichbarkeitsursache, endet dieser Takt, der nächste versucht es erneut. Unberührt bleiben Objekte
// ohne Prüfvermerk (Import ohne angeforderte Prüfung, R-0145), Objekte in Schutzdaten-Quarantäne
// (R-0658), vertraulich gesperrte Läufe (`confidential` — dort hilft nur eine andere Modellwahl) und
// im Abgleich die Vorführdaten (K0-3).
import type { AuditInput } from "../../audit";
import { type KnowledgeObject, inSchutzdatenQuarantaene } from "../../knowledge-object";
import {
  type AiCheckFailureReason,
  type AiCheckWorker,
  shouldReEnqueueAiCheck,
} from "./ai-check-worker";
// Der Zeitgeber (`starteHintergrundpruefung`) wohnt in hintergrundpruefung-start.ts: dieses Modul
// lädt build-app.ts, und der Zeitgeber gehört nur in den Prozessstart (server.ts).

export const HINTERGRUNDLAUF_AUDIT = "pruefung.hintergrundlauf";

// Vorgaben aus dem Fachkonzept (docs/qm/BERATER_KONZEPT_KONFLIKTERKENNUNG_2026-07-04.md §3.3):
// stündlich, 50 Modellvergleiche je Lauf, 500 je Tag. Bewusst Konstanten, keine Umgebungswerte —
// ein Stellwert im Startvertrag folgt, wenn der Betrieb ihn braucht.
export const HINTERGRUNDLAUF_INTERVAL_MS = 60 * 60_000;
export const HINTERGRUNDLAUF_LAUFBUDGET = 50;
export const HINTERGRUNDLAUF_TAGESBUDGET = 500;

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

export interface HintergrundlaufBericht {
  nachgeholt: number;
  abgeglichen: number;
  fehlgeschlagen: number;
  /** Objekte, die nach diesem Lauf weiter anstehen. */
  offen: number;
  vergleiche: number;
  vergleicheHeute: number;
  tagesbudget: number;
  abbruch?: "kein-modell" | "modell-nicht-erreichbar" | "budget";
}

export interface HintergrundpruefungDeps {
  ko: {
    list(): Promise<KnowledgeObject[]>;
    get(id: string): Promise<KnowledgeObject | undefined>;
    markAiCheckPending(id: string): Promise<boolean>;
  };
  worker: Pick<AiCheckWorker, "enqueue" | "has" | "idle">;
  modellAktiv: () => boolean;
  audit?: { record(input: AuditInput): Promise<unknown> };
  now?: () => number;
  laufbudget?: number;
  tagesbudget?: number;
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

export function createHintergrundpruefung(
  deps: HintergrundpruefungDeps,
): () => Promise<HintergrundlaufBericht | null> {
  const now = deps.now ?? (() => Date.now());
  const laufbudget = deps.laufbudget ?? HINTERGRUNDLAUF_LAUFBUDGET;
  const tagesbudget = deps.tagesbudget ?? HINTERGRUNDLAUF_TAGESBUDGET;
  let tag = "";
  let heute = 0;
  let keinModellGemeldet = "";
  let laeuft = false;

  const protokolliere = async (bericht: HintergrundlaufBericht): Promise<void> => {
    await deps.audit
      ?.record({
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
    if (heuteTag !== tag) {
      tag = heuteTag;
      heute = 0;
    }
    const arbeit = (await deps.ko.list())
      .map((ko) => ({ ko, art: hintergrundArt(ko, nowMs) }))
      .filter((e): e is { ko: KnowledgeObject; art: Art } => e.art !== null)
      .filter((e) => !deps.worker.has(e.ko.id))
      // Nachholen vor Abgleich, innerhalb jeweils der älteste Vermerk zuerst.
      .sort((a, b) => rang(a.art) - rang(b.art) || zeitpunkt(a.ko) - zeitpunkt(b.ko));
    const bericht: HintergrundlaufBericht = {
      nachgeholt: 0,
      abgeglichen: 0,
      fehlgeschlagen: 0,
      offen: arbeit.length,
      vergleiche: 0,
      vergleicheHeute: heute,
      tagesbudget,
    };
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
      if (heute >= tagesbudget || bericht.vergleiche >= laufbudget) {
        bericht.abbruch = "budget";
        break;
      }
      if (!(await deps.ko.markAiCheckPending(ko.id))) {
        bericht.offen -= 1; // gelöscht oder verschwunden — nichts mehr nachzuholen
        continue;
      }
      const vermerkt = await deps.ko.get(ko.id);
      deps.worker.enqueue(ko.id, vermerkt?.aiCheck?.koVersion);
      await deps.worker.idle();
      const nachher = (await deps.ko.get(ko.id))?.aiCheck;
      const verbraucht = nachher?.coverage?.attempted ?? 0;
      bericht.vergleiche += verbraucht;
      heute += verbraucht;
      bericht.offen -= 1;
      if (nachher?.status === "done") {
        bericht[art === "nachholen" ? "nachgeholt" : "abgeglichen"] += 1;
        continue;
      }
      bericht.fehlgeschlagen += 1;
      if (nachher?.fallbackReason && NICHT_ERREICHBAR.has(nachher.fallbackReason)) {
        bericht.abbruch = "modell-nicht-erreichbar";
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

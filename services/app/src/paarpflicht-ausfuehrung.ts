// ================================================================================================
// AUFNAHME 20260922 · PAARPFLICHTEN-DAUERHAFT (G2) — DER AUSFÜHRUNGSWEG.
// ================================================================================================
//
// Nacharbeit 1 (bens Befund zu cfc43d4a): der Pflichtendienst hatte keinen produktiven Aufrufer.
// Hier — in der App-Wurzel, wo knowledge-object, reasoner und conflicts sich treffen dürfen —
// entstehen der fassungsgebundene Prüfer und die Hintergrundausführung:
//
//   Prüfer        — lädt beide Aussagen, prüft, dass sie noch GENAU in der gespeicherten Fassung
//                   (Version, Quellrevision, Quellen, Kontext) vorliegen, und legt erst dann die
//                   Kerntexte der Konfliktprüfung des Reasoners vor. Eine geänderte oder entfernte
//                   Aussage wird nicht unter dem alten Stand beurteilt: `fehler` mit Grund.
//                   Vertraulichkeit reist als Paarmarke; welches Modell sie sehen darf, entscheidet
//                   unverändert der Reasoner (`oeffentlicheKiErlaubt`).
//   Ausführung    — In-Process, eine Warteschlange, ein Lauf zur Zeit (wie der KI-Prüf-Worker).
//                   `anstossen` reiht einen Lauf ein; `wiederaufnehmen` liest beim Start alle
//                   gespeicherten Läufe mit offener Arbeit aus der Ablage und reiht sie ein.
//
// Es startet NICHTS von selbst über den Bestand: Läufe entstehen nur über die ausdrückliche Wahl
// eines Menschen (paarpflichten-routes.ts). Die Wiederaufnahme setzt nur fort, was so begonnen
// wurde.
import {
  type DetectSubject,
  PAARPFLICHT_FRIST_MS,
  type PaarpflichtAussage,
  type PaarpflichtPruefer,
  type PaarpflichtService,
  coreText,
  ergebnisAusKonfliktUrteil,
} from "../../conflicts";
import { type KnowledgeObject, type KoService, isConfidential } from "../../knowledge-object";
import type { Reasoner } from "../../reasoner";
import { paarpflichtAussageVon } from "./paarpflicht-aussagen";

// Fassung der Prüfanweisung dieses Wegs (Teil des Laufkontexts) und der Modellweg als Beleg. Der
// Reasoner nennt im Ausgang keine Modellkennung; belegt ist, dass der Weg ein Urteil geliefert hat.
export const PAARPFLICHT_PRUEFFASSUNG = "konflikt-paar-v1";
export const PAARPFLICHT_MODELLWEG = "reasoner:konfliktpruefung";

function kern(ko: KnowledgeObject): string {
  const subjekt: DetectSubject = {
    refId: ko.id,
    title: ko.title,
    statement: ko.statement,
    conditions: ko.conditions,
    measures: ko.measures,
    tags: ko.tags,
  };
  return coreText(subjekt);
}

function gleicheFassung(ko: KnowledgeObject, gespeichert: PaarpflichtAussage): boolean {
  // Quelle und Kontext hängen nicht vom Bestandsstempel ab (pruefbasis.ts); er bleibt leer.
  const jetzt = paarpflichtAussageVon(ko, "");
  return (
    jetzt.version === gespeichert.version &&
    jetzt.quelle === gespeichert.quelle &&
    jetzt.kontext === gespeichert.kontext &&
    jetzt.quellen.join("\n") === [...gespeichert.quellen].sort().join("\n")
  );
}

/** Der fassungsgebundene Prüfer über die Konfliktprüfung des Reasoners. */
export function paarpflichtPrueferFuer(deps: {
  ko: Pick<KoService, "get">;
  reasoner: Pick<Reasoner, "judgeConflictOutcome">;
}): PaarpflichtPruefer {
  return async (a, b) => {
    const [koA, koB] = await Promise.all([deps.ko.get(a.refId), deps.ko.get(b.refId)]);
    if (!koA || !koB) {
      return { art: "fehler", grund: "aussage_fehlt" };
    }
    if (!gleicheFassung(koA, a) || !gleicheFassung(koB, b)) {
      return { art: "fehler", grund: "fassung_ueberholt" };
    }
    const vertraulich = isConfidential(koA.confidentiality) || isConfidential(koB.confidentiality);
    const [kernA, kernB] = [kern(koA), kern(koB)];
    const ausgang = await deps.reasoner.judgeConflictOutcome(kernA, kernB, "de", vertraulich);
    return ergebnisAusKonfliktUrteil(ausgang, PAARPFLICHT_MODELLWEG);
  };
}

export interface PaarpflichtAusfuehrung {
  // Reiht einen Lauf ein; ein schon wartender Lauf wird nicht doppelt eingereiht.
  anstossen(laufId: string): void;
  // Liest die gespeicherten Läufe mit offener Arbeit und reiht sie ein (nach dem Start).
  wiederaufnehmen(): Promise<string[]>;
  // Erfüllt sich, wenn nichts mehr wartet oder läuft.
  leerlauf(): Promise<void>;
}

export interface PaarpflichtAusfuehrungDeps {
  service: Pick<PaarpflichtService, "abarbeiten" | "offeneLaeufe">;
  pruefer: PaarpflichtPruefer;
  // Frist der Beanspruchung; danach ist eine fremd beanspruchte Pflicht wieder frei.
  fristMs?: number;
  // Zeitgeber für den Wiederanstoß nach Fristablauf (injizierbar).
  spaeter?: (fn: () => void, ms: number) => void;
  // Nur Laufkennung und Fehlerklasse — kein Inhalt.
  log?: (meldung: string) => void;
}

function standardSpaeter(fn: () => void, ms: number): void {
  const zeitgeber = setTimeout(fn, ms);
  // Ein wartender Wiederanstoß hält den Prozess nicht am Leben.
  if (typeof zeitgeber === "object" && typeof zeitgeber.unref === "function") {
    zeitgeber.unref();
  }
}

function standardLog(meldung: string): void {
  process.stderr.write(`[paarpflichten] ${meldung}\n`);
}

function fehlerklasse(fehler: unknown): string {
  return fehler instanceof Error ? fehler.name : "unbekannt";
}

export function createPaarpflichtAusfuehrung(
  deps: PaarpflichtAusfuehrungDeps,
): PaarpflichtAusfuehrung {
  const wartend = new Set<string>();
  let kette: Promise<void> = Promise.resolve();
  // Eine laufende Wiederaufnahme liest erst die Ablage, bevor sie einreiht — `leerlauf` wartet mit.
  let aufnahme: Promise<unknown> = Promise.resolve();
  const fristMs = deps.fristMs ?? PAARPFLICHT_FRIST_MS;
  const spaeter = deps.spaeter ?? standardSpaeter;
  const log = deps.log ?? standardLog;

  // Runden: jede beanspruchbare Pflicht höchstens einmal je Runde. Weiter, solange eine Runde etwas
  // entschieden hat (Urteil, unbestimmt, Fehler). Eine Runde, in der nur „kein Modell" kam oder
  // nichts mehr beanspruchbar war, beendet den Durchgang — die Pflichten bleiben offen gespeichert.
  async function durchgang(laufId: string): Promise<void> {
    for (;;) {
      const schritt = await deps.service.abarbeiten(laufId, deps.pruefer);
      if (schritt.geurteilt + schritt.unbestimmt + schritt.fehler === 0) {
        if (schritt.bilanz.inArbeit > 0) {
          // Von einem beendeten Prozess beansprucht: nach Fristablauf erneut versuchen.
          spaeter(() => anstossen(laufId), fristMs + 1_000);
        }
        return;
      }
      if (schritt.bilanz.rest === 0 && schritt.bilanz.fehler === 0) {
        return;
      }
    }
  }

  function anstossen(laufId: string): void {
    if (wartend.has(laufId)) {
      return;
    }
    wartend.add(laufId);
    kette = kette.then(async () => {
      wartend.delete(laufId);
      try {
        await durchgang(laufId);
      } catch (fehler) {
        log(`Lauf ${laufId} unterbrochen (${fehlerklasse(fehler)}); er bleibt gespeichert.`);
      }
    });
  }

  return {
    anstossen,
    wiederaufnehmen() {
      const lauf = (async () => {
        try {
          const laeufe = await deps.service.offeneLaeufe();
          for (const laufId of laeufe) {
            anstossen(laufId);
          }
          return laeufe;
        } catch (fehler) {
          log(`Wiederaufnahme nicht möglich (${fehlerklasse(fehler)}).`);
          return [];
        }
      })();
      aufnahme = lauf;
      return lauf;
    },
    async leerlauf() {
      await aufnahme;
      for (;;) {
        const jetzt = kette;
        await jetzt;
        if (jetzt === kette) {
          return;
        }
      }
    },
  };
}

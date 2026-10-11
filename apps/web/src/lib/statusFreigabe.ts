// ================================================================================================
// STATUS-FREIGABE (produkt:20261007) · WAS NACH DEM SPEICHERN WIRKLICH GILT.
// ================================================================================================
//
// Drei Vorgänge an einem Wissenseintrag sehen sich ähnlich und sind fachlich verschieden:
//
//   · ÄNDERUNGSVORSCHLAG — eingereicht, der Eintrag trägt weiter seinen bisherigen Stand
//     (`ko.propose.done`, unverändert).
//   · DIREKT GESPEICHERTE ÄNDERUNG — der Eintrag trägt die Änderung als neue Fassung. Bei einem
//     offenen Eintrag (und nach jeder Textänderung: `KoService.revise` setzt auf „offen") ist sie
//     damit GESPEICHERT, nicht freigegeben.
//   · TATSÄCHLICH FREIGEGEBENE FASSUNG — nur, wenn der Server `status: "validiert"` meldet (etwa nach
//     „Übernehmen und freigeben" eines Vorschlags).
//
// Die Sätze entstehen hier aus der EIGENEN Serverantwort, DOM-frei und einzeln prüfbar. Kennt die
// Antwort keinen Stand, entsteht KEIN Satz — eine Freigabeaussage ohne Beleg wäre genau der Fehler,
// den der Auftrag beschreibt („eine gespeicherte Änderung an einem offenen Artikel darf keinen
// freigegebenen Stand behaupten").

export interface SpeicherAntwort {
  /** Der Status, den der Server nach dem Schreiben meldet (`offen`, `validiert`, …). */
  readonly status: string;
  /** Die Fassung nach dem Schreiben — `null`, wenn die Antwort keine trägt. */
  readonly version: number | null;
}

/** Den Stand aus einer Schreibantwort lesen — `null`, wenn sie keinen Status trägt. */
export function speicherAntwortAus(antwort: unknown): SpeicherAntwort | null {
  if (typeof antwort !== "object" || antwort === null) {
    return null;
  }
  const roh = antwort as Record<string, unknown>;
  if (typeof roh.status !== "string" || roh.status.length === 0) {
    return null;
  }
  const version =
    typeof roh.version === "number" && Number.isInteger(roh.version) && roh.version >= 1
      ? roh.version
      : null;
  return { status: roh.status, version };
}

export interface FolgeSatz {
  readonly schluessel: string;
  readonly werte: Record<string, number>;
}

/**
 * Der zweite Satz nach „Gespeichert." — freigegeben NUR bei `validiert`, sonst ausdrücklich nicht.
 * `null`, wenn kein Stand bekannt ist.
 */
export function speicherFolgeSatz(stand: SpeicherAntwort | null): FolgeSatz | null {
  if (!stand) {
    return null;
  }
  if (stand.status === "validiert") {
    return stand.version === null
      ? { schluessel: "statusfreigabe.speichern.freigegeben", werte: {} }
      : {
          schluessel: "statusfreigabe.speichern.freigegebenFassung",
          werte: { version: stand.version },
        };
  }
  return stand.version === null
    ? { schluessel: "statusfreigabe.speichern.nichtFreigegeben", werte: {} }
    : {
        schluessel: "statusfreigabe.speichern.nichtFreigegebenFassung",
        werte: { version: stand.version },
      };
}

// ================================================================================================
// KLARA · DERSELBE STATUS, DEN DIE FLÄCHE ZEIGT — GELESEN, NICHT NEU ABGELEITET.
// ================================================================================================
//
// Zeigt jemand im Zeige-Modus auf etwas innerhalb eines Objekts (`data-objekt`: Wissenseintrag,
// Arbeitsanleitung), nennt Klara den Status dieses Objekts — und zwar den TEXT des gezeichneten
// Statusblocks (`data-objektstatus`), Wort für Wort. Klara rechnet keinen Status selbst aus; eine
// zweite Ableitung könnte vom Bildschirm abweichen, und genau das verbietet der Auftrag
// („Klara verwendet dieselben objektbezogenen Statusinformationen").
//
// Gibt es keinen Statusblock im Objekt, sagt Klara nichts über einen Status (`null`).

/** Höchstlänge des übernommenen Statustexts — ein Statusblock, kein Dokument. */
const OBJEKTSTATUS_MAX = 600;

export interface Objektstatus {
  /** `wissen` oder `anleitung` — die Art des Objekts, aus `data-objekt`. */
  readonly art: string;
  readonly text: string;
}

export function objektstatusAus(ziel: Element | null): Objektstatus | null {
  const objekt = ziel?.closest?.("[data-objekt]") ?? null;
  if (!objekt) {
    return null;
  }
  const block = objekt.matches("[data-objektstatus]")
    ? objekt
    : objekt.querySelector("[data-objektstatus]");
  const roh = block?.textContent ?? "";
  const text = roh.replace(/\s+/g, " ").trim().slice(0, OBJEKTSTATUS_MAX);
  if (!block || text.length === 0) {
    return null;
  }
  return { art: objekt.getAttribute("data-objekt") ?? "", text };
}

/**
 * Der Satz nach dem EINREICHEN eines Vorschlags — aus dem Status, den die Antwort trägt.
 *
 * Der freiwillige Prüfweg steht Freigabeberechtigten auch an OFFENEN Einträgen offen, und der
 * Server lässt den Status beim Einreichen unverändert (`KoService.addProposal`). „Trägt weiter den
 * freigegebenen Stand" (`ko.propose.done`) gilt deshalb NUR bei `validiert`; bei jedem anderen
 * Status bleibt die bisherige Fassung offen bzw. nicht freigegeben, ohne Status wird keiner genannt.
 */
export function einreichSchluessel(status: string | null): string {
  if (status === "validiert") {
    return "ko.propose.done";
  }
  return status === null
    ? "statusfreigabe.vorschlag.eingereicht"
    : "statusfreigabe.vorschlag.eingereichtOffen";
}

/**
 * Der Satz nach einer Entscheidung über einen Änderungsvorschlag. „Freigegeben" nur, wenn die
 * Antwort es trägt — die Übernahme gibt am Server frei (`decideProposal`), die Fläche liest es ab.
 */
export function vorschlagFolgeSatz(
  entscheidung: "uebernehmen" | "ablehnen",
  stand: SpeicherAntwort | null,
): FolgeSatz {
  if (entscheidung === "ablehnen") {
    return { schluessel: "statusfreigabe.vorschlag.abgelehnt", werte: {} };
  }
  if (stand?.status === "validiert") {
    return stand.version === null
      ? { schluessel: "statusfreigabe.vorschlag.uebernommenFreigegeben", werte: {} }
      : {
          schluessel: "statusfreigabe.vorschlag.uebernommenFreigegebenFassung",
          werte: { version: stand.version },
        };
  }
  return { schluessel: "statusfreigabe.vorschlag.uebernommenOffen", werte: {} };
}

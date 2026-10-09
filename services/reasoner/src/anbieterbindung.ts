import { AsyncLocalStorage } from "node:async_hooks";

// ================================================================================================
// AUFTRAG gesamt-ki-einwilligung · BENS B3 (Runde 2) — DIE BINDUNG GILT IM AUGENBLICK DES AUFRUFS.
// ================================================================================================
//
// Das Klara-Ausführungstor prüft, ob eine Aufgabe an den Anbieter geht, dem die Dokumentzustimmung
// gilt. Der Reasoner wählt den Anbieter aber ERST BEIM LAUF (`chainForChoice`), und zwischen Tor
// und Lauf liegen Wartepunkte — Ben hat einen Anbieterwechsel genau in dieses Fenster gelegt, und
// der Text ging an den neuen Anbieter.
//
// Deshalb trägt die ANFRAGE ihre Bindung mit:
//   1. Jede Route, die das Tor befragt, öffnet je Anfrage einen RAHMEN (`imBindungsrahmen`, im
//      `onRequest`-Hook — das Muster von `@fastify/request-context`: `run(…, done)`).
//   2. Das Tor-Ergebnis wird darin festgehalten (`bindeAnbieter`): bei Freigabe der Anbieter, dem
//      die Zustimmung gilt; bei Absage `null` — dann darf in dieser Anfrage GAR KEIN externer
//      Anbieter Text erhalten.
//   3. Der Reasoner lässt beim Bilden JEDER Kette nur den gebundenen Anbieter zu
//      (`anbieterZugelassen`). Was nach dem Tor umgestellt wurde, fällt aus der Kette.
//
// Lokale und deterministische Glieder sind nicht betroffen — sie verlassen das Haus nicht. Ohne
// Bindung (Konsole, Anfragen ohne Klara-Sitzung) bleibt alles wie bisher.
//
// LAUF 2 · BENS B5 — EIN ABGESCHLOSSENER WIDERRUF GILT AUCH FÜR DIE ANFRAGE, DIE SCHON AM TOR STEHT.
// Das Tor entscheidet an der Zustimmungszeile, die es gelesen hat; ein Widerruf kann danach
// abschliessen. Deshalb bindet die Anfrage auch die ZUSTIMMUNG — als Prüfung `giltNoch`, die das Tor
// mitliefert (`bindeZustimmung`). Der Sitzungsdienst vermerkt jedes Beenden einer Zustimmung
// (Widerruf, Entwertung, Ablauf) nach dem Festschreiben und VOR der Antwort; ab da meldet die Prüfung
// `false`; Bens B6: ebenso nach Ablauf von Sitzung oder Zustimmung. Ausgewertet wird beim Kettenbau
// UND unmittelbar vor der Übertragung — im Reasoner-Lauf (`ModellAufrufSpur.vorUebertragung`) und
// für JEDEN externen Client am Chokepoint (`cappedModelClient`, Bens B7: der Zuruf-Weg).
// Grenze: der Vermerk lebt im Prozess — ein Widerruf, den eine ANDERE Instanz abschliesst,
// erreicht ihn nicht.

interface Anbieterbindung {
  gebunden: boolean;
  /** Der einzige externe Anbieter, der Text erhalten darf — `null`: keiner. */
  anbieter: string | null;
  /** Je Freigabe dieser Anfrage: gilt die Zustimmung, auf die sie sich stützt, noch? */
  zustimmungen: Array<() => boolean>;
  /** gesamt-ki-freigaberegeln (Ben Nacharbeit 3): die HERKUNFT des Texts sperrt jede Ausleitung. */
  ausleitungGesperrt: boolean;
}

const speicher = new AsyncLocalStorage<Anbieterbindung>();

/** Öffnet den Rahmen einer Anfrage; darin ist zunächst NICHTS gebunden. */
export function imBindungsrahmen<T>(lauf: () => T): T {
  return speicher.run(
    { gebunden: false, anbieter: null, zustimmungen: [], ausleitungGesperrt: false },
    lauf,
  );
}

// ================================================================================================
// Auftrag gesamt-ki-freigaberegeln · BEN NACHARBEIT 3 — HERKUNFTSSPERRE GETRENNT VON DER KLASSE.
// ================================================================================================
//
// Die zentrale Adminfreigabe für vertrauliche Inhalte hebt die KLASSENSPERRE auf („dieser Text ist
// vertraulich"). Sie hebt NICHT auf, was aus der HERKUNFT folgt: ein Entwurfstext ohne auflösbaren
// Anker oder ein Text, der sich als Wissensobjekt ausgibt, ohne dass der Server es belegen kann.
// Solche Anfragen stuften die Routen bisher nur als `confidential` ein — mit beiden Freigaben wäre
// das eine Öffnung gewesen. Die Route vermerkt die Herkunftssperre deshalb HIER, im Rahmen der
// Anfrage; `anbieterZugelassen` lässt danach keinen externen Anbieter mehr zu, im Kettenbau wie
// unmittelbar vor der Übertragung, unabhängig von jeder Freigabe.
/**
 * Sperrt in der laufenden Anfrage jede externe Ausleitung. Gibt `false` zurück, wenn es keinen
 * Rahmen gibt — der Aufrufer muss dann selbst sperren (fail-closed).
 */
export function sperreAusleitung(): boolean {
  const bindung = speicher.getStore();
  if (!bindung) {
    return false;
  }
  bindung.ausleitungGesperrt = true;
  return true;
}

/**
 * Hält die Zustimmung fest, auf die sich eine Freigabe dieser Anfrage stützt — unabhängig davon,
 * ob ein Anbieter gebunden wird. Gibt `false` zurück, wenn es keinen Rahmen gibt (fail-closed).
 */
export function bindeZustimmung(giltNoch: () => boolean): boolean {
  const bindung = speicher.getStore();
  if (!bindung) {
    return false;
  }
  bindung.zustimmungen.push(giltNoch);
  return true;
}

/**
 * Hält das Tor-Ergebnis im laufenden Rahmen fest. Bindungen werden nur ENGER: wer schon an einen
 * Anbieter gebunden ist und eine andere Bindung bekommt, darf danach keinen mehr benutzen.
 * Gibt `false` zurück, wenn es keinen Rahmen gibt — der Aufrufer muss dann sperren (fail-closed).
 */
export function bindeAnbieter(anbieter: string | null): boolean {
  const bindung = speicher.getStore();
  if (!bindung) {
    return false;
  }
  bindung.anbieter = bindung.gebunden && bindung.anbieter !== anbieter ? null : anbieter;
  bindung.gebunden = true;
  return true;
}

/**
 * Lauf 2 · Bens B7: tragen alle Zustimmungen, auf die sich die laufende Anfrage stützt, noch? Ohne
 * Rahmen oder ohne gebundene Zustimmung `true`. Gefragt vom Chokepoint (`cappedModelClient`) —
 * nach jedem Warten auf einen Modellplatz, unmittelbar vor der Übertragung, auf JEDEM Weg.
 */
export function zustimmungenTragen(): boolean {
  const bindung = speicher.getStore();
  return !bindung || bindung.zustimmungen.every((giltNoch) => giltNoch());
}

/**
 * R-0590 · Ben nacharbeit-1: der externe Anbieter, dem die Zustimmung dieser Anfrage gilt — gesetzt
 * nur, wenn das Tor freigegeben UND einen Anbieter gebunden hat. Ohne Rahmen, ohne Bindung oder bei
 * Absage (`null`) `undefined`: dann gibt es keinen zugestimmten Weg, von dem abgewichen werden könnte.
 */
export function gebundenerAnbieter(): string | undefined {
  const bindung = speicher.getStore();
  return bindung?.gebunden === true && bindung.anbieter !== null ? bindung.anbieter : undefined;
}

// ================================================================================================
// R-0590 · BEN NACHARBEIT-1 — KEIN NICHT GLEICHWERTIGER AUSWEICHWEG HINTER EINER ZUSTIMMUNG.
// ================================================================================================
//
// Originalpunkt: „Bei einem nicht gleichwertigen Ausweichweg wird bis zur Produktentscheidung
// sicherheitshalber blockiert und der Grund angezeigt."
//
// Die Zustimmung gilt GENAU EINEM Anbieter. Scheitert er in einem gebundenen Lauf (jede Aufgabe, nicht
// nur die Antwort — Ben nacharbeit-3) oder fällt er aus der Kette (Wechsel nach dem Tor, beendete
// Zustimmung), lief der Reasoner bisher still am nächsten Glied
// weiter — lokales Modell oder deterministischer Ersatz. Ob ein solcher Ersatz der zugestimmten
// Antwort GLEICHWERTIG ist, hat niemand entschieden; bis zu dieser Produktentscheidung gilt keiner
// als gleichwertig. Der Lauf endet deshalb mit diesem Fehler, und sein Grund geht an die Fläche
// (`services/app/src/build-app.ts`, `modelBusyErrorHandler`: 409 `KLARA_AUSWEICHWEG_GESPERRT`).
//
// Die Meldung trägt nur den Anbieternamen aus geschlossener Menge — nie Frage, Kontext oder Antwort.

/** Warum der Ausweichweg gesperrt ist — ein benannter Grund, kein Freitext. */
export type KlaraAusweichwegGrund =
  /** Der zugestimmte Anbieter hat nicht geantwortet oder steht nicht (mehr) in der Kette. */
  | "fallback_not_equivalent"
  /** Die Zustimmung, auf die sich die Anfrage stützt, ist inzwischen beendet. */
  | "consent_ended";

export class KlaraAusweichwegGesperrtFehler extends Error {
  readonly grund: KlaraAusweichwegGrund;
  readonly anbieter: string;
  constructor(grund: KlaraAusweichwegGrund, anbieter: string) {
    super(
      grund === "consent_ended"
        ? `Die Zustimmung für ${anbieter} ist beendet — ein anderer Antwortweg wird nicht ersatzweise benutzt.`
        : `${anbieter} hat nicht geantwortet oder steht für diesen Lauf nicht bereit — ein anderer, nicht als gleichwertig freigegebener Weg wird nicht ersatzweise benutzt.`,
    );
    this.name = "KlaraAusweichwegGesperrtFehler";
    this.grund = grund;
    this.anbieter = anbieter;
  }
}

/**
 * Darf ein externer Anbieter im laufenden Aufruf Text erhalten? Stützt sich die Anfrage auf eine
 * inzwischen beendete Zustimmung, keiner. Sonst ohne Bindung immer; mit Bindung nur der gebundene.
 */
export function anbieterZugelassen(anbieter: string | undefined): boolean {
  const bindung = speicher.getStore();
  if (!zustimmungenTragen()) {
    return false;
  }
  // Ben Nacharbeit 3: eine Herkunftssperre der Anfrage hebt keine Freigabe auf.
  if (bindung?.ausleitungGesperrt === true) {
    return false;
  }
  if (!bindung?.gebunden) {
    return true;
  }
  return bindung.anbieter !== null && anbieter === bindung.anbieter;
}

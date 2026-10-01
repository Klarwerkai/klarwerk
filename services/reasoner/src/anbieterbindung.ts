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
}

const speicher = new AsyncLocalStorage<Anbieterbindung>();

/** Öffnet den Rahmen einer Anfrage; darin ist zunächst NICHTS gebunden. */
export function imBindungsrahmen<T>(lauf: () => T): T {
  return speicher.run({ gebunden: false, anbieter: null, zustimmungen: [] }, lauf);
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
 * Darf ein externer Anbieter im laufenden Aufruf Text erhalten? Stützt sich die Anfrage auf eine
 * inzwischen beendete Zustimmung, keiner. Sonst ohne Bindung immer; mit Bindung nur der gebundene.
 */
export function anbieterZugelassen(anbieter: string | undefined): boolean {
  const bindung = speicher.getStore();
  if (!zustimmungenTragen()) {
    return false;
  }
  if (!bindung?.gebunden) {
    return true;
  }
  return bindung.anbieter !== null && anbieter === bindung.anbieter;
}

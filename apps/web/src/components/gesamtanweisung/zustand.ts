// ==================================================================================================
// JOB 4154 · DAS ZUSTANDSMODELL DER ANWEISUNGSFLÄCHE — EINE QUELLE, DREI ANSICHTEN.
// ==================================================================================================
//
// Lesestand, Vergleich und Entscheidungsvorlage beantworten dieselbe Frage: „Was darf ich gerade
// behaupten?" Sie beantworten sie hier EINMAL, DOM-frei und einzeln prüfbar — nicht dreimal in drei
// Komponenten, die auseinanderlaufen.
//
// DIE SIEBEN LAGEN UND IHRE ZUSAGEN (Auftrag Abschnitt 9, wörtlich umgesetzt):
//
//   laden                  „Lädt …" — und KEINE Aussage über Vollständigkeit, Menge oder Gleichheit.
//   erfolgreich leer       „Diese Anweisung hat noch keine Bausteine." Nie „vollständig",
//                          „unverändert" oder „geprüft".
//   Fehler                 Fehlersatz und GAR KEINE Aussage über Vollständigkeit, Gleichheit oder
//                          Freigabe. Insbesondere erscheint nie „unverändert".
//   Cache + Auffrischung   Der zwischengespeicherte Stand wird ALS STAND gekennzeichnet gezeigt;
//                          nichts wird leer geräumt.
//   Cache + gescheitert    Der alte Stand bleibt stehen UND der Fehler ist sichtbar. Vorlegen und
//                          Entscheiden sind gesperrt, mit sichtbarem Grund — ein Entscheid auf
//                          einem ungewissen Stand wäre genau der Fall, den F4 verbietet.
//   offline                wie Fehler; Eingaben bleiben erhalten, nichts gilt als gespeichert.
//   unvollständige Rechte  sichtbarer Satz ohne Titel und Kennung; nie als vollständig dargestellt.
//
// DIE REGEL, DIE DIESE DATEI TRÄGT UND DIE SONST VERLOREN GEHT: ein vorhandener Cache wird NIEMALS
// geleert, nur weil eine Auffrischung scheitert (Lehre 03.09., JOB 3027/3025/3037). Deshalb kennt
// `anzeigelage` den Fall „Daten UND Fehler" ausdrücklich und macht daraus keinen Fehlerzustand
// ohne Inhalt.

import type { AnweisungLesestand } from "../../api/types";

export type Anzeigelage =
  | { readonly art: "laden" }
  | { readonly art: "fehler"; readonly offline: boolean }
  | { readonly art: "leer" }
  | {
      readonly art: "stand";
      /** Wahr nur, wenn dieser Stand gerade frisch bestätigt ist. */
      readonly frisch: boolean;
      /** Ein vorhandener Stand, dessen Auffrischung gescheitert ist. Er bleibt stehen. */
      readonly auffrischungGescheitert: boolean;
      readonly offline: boolean;
    };

export interface Lageeingabe<T> {
  readonly daten: T | undefined;
  readonly laedt: boolean;
  /** Irgendein Fehlerobjekt der Abfrage. Der Typ ist gleichgültig; das Vorhandensein zählt. */
  readonly fehler: unknown;
  /** Eine laufende Auffrischung über vorhandenen Daten. */
  readonly aktualisiert: boolean;
  readonly offline: boolean;
}

/** Ist diese Liste leer? Getrennt, weil „leer" je Ansicht etwas anderes heissen kann. */
export type Leerpruefung<T> = (daten: T) => boolean;

/**
 * Die Lage aus dem Zustand einer Abfrage.
 *
 * DIE REIHENFOLGE DER ZWEIGE IST DIE AUSSAGE, bitte nicht umsortieren:
 *   1. Daten da? Dann gibt es einen Stand — auch bei Fehler, auch offline. Er wird gekennzeichnet,
 *      nicht weggeworfen.
 *   2. Keine Daten und ein Fehler? Dann Fehler — und zwar bevor „lädt" geprüft wird, denn eine
 *      Abfrage kann nach einem Fehler erneut laden, und „Lädt …" verschwiege den Fehler.
 *   3. Sonst: lädt.
 *
 * OFFLINE IST WIE FEHLER und zusätzlich ausgewiesen: es ist derselbe Zustand („ich weiss es nicht"),
 * aber der Mensch soll den Grund sehen, damit er nicht auf Speichern wartet, das nie kommt.
 */
export function anzeigelage<T>(eingabe: Lageeingabe<T>, leer: Leerpruefung<T>): Anzeigelage {
  const fehlerhaft = eingabe.fehler != null || eingabe.offline;
  if (eingabe.daten !== undefined) {
    if (!fehlerhaft && leer(eingabe.daten)) {
      return { art: "leer" };
    }
    return {
      art: "stand",
      frisch: !fehlerhaft && !eingabe.aktualisiert,
      auffrischungGescheitert: eingabe.fehler != null,
      offline: eingabe.offline,
    };
  }
  if (fehlerhaft) {
    return { art: "fehler", offline: eingabe.offline };
  }
  return { art: "laden" };
}

/** Die Standard-Leerprüfung des Lesestands: keine zugänglichen Bausteine. */
export const lesestandLeer: Leerpruefung<AnweisungLesestand> = (stand) =>
  stand.bausteine.length === 0 && !stand.unvollstaendig;

/**
 * Darf an dieser Stelle überhaupt eine Aussage über Gleichheit oder Vollständigkeit stehen?
 *
 * Nur auf einem Stand, dessen Auffrischung NICHT gescheitert ist und der nicht offline entstanden
 * ist. Ein „unverändert" neben einem Fehlersatz wäre die Aussage, die der Auftrag ausdrücklich
 * verbietet: bei einem Fehler erscheint nie „unverändert".
 */
export function gleichheitsaussageErlaubt(lage: Anzeigelage): boolean {
  return lage.art === "stand" && !lage.auffrischungGescheitert && !lage.offline;
}

export interface Sperre {
  readonly gesperrt: boolean;
  /** Der i18n-Schlüssel des GRUNDES. `null`, wenn nichts gesperrt ist. */
  readonly grund: string | null;
}

/**
 * BEARBEITEN — aufnehmen, ordnen, Voraussetzungen setzen.
 *
 * Gesperrt bei Laden, Fehler, offline und auf einem Stand mit gescheiterter Auffrischung: wer den
 * geltenden Stand nicht kennt, kann nicht bedingt auf ihm schreiben, und ein Schreibversuch liefe
 * am Server in einen Konflikt.
 *
 * AUSDRÜCKLICH NICHT GESPERRT ist die LEERE Anweisung — dort fängt die Arbeit an. Eine Sperre in
 * diesem Zustand wäre eine Sackgasse: der erste Baustein liesse sich nie aufnehmen. (Das ist kein
 * theoretischer Fall; genau diese Kopplung lag hier zuerst und ist an der Fläche aufgefallen.)
 */
export function schreibSperre(lage: Anzeigelage): Sperre {
  if (lage.art === "laden") {
    return { gesperrt: true, grund: "ga.laedt" };
  }
  if (lage.art === "fehler") {
    return { gesperrt: true, grund: lage.offline ? "ga.offline" : "ga.fehler" };
  }
  if (lage.art === "leer") {
    return { gesperrt: false, grund: null };
  }
  if (lage.offline) {
    return { gesperrt: true, grund: "ga.offline" };
  }
  if (lage.auffrischungGescheitert) {
    return { gesperrt: true, grund: "ga.gesperrt" };
  }
  return { gesperrt: false, grund: null };
}

/**
 * VORLEGEN UND ENTSCHEIDEN — dieselbe Sperre, plus eine eigene.
 *
 * Zusätzlich gesperrt auf der LEEREN Anweisung: es gäbe nichts zu entscheiden, und eine
 * „vorgelegte" leere Anweisung wäre genau die Scheinfunktion, die der Auftrag verbietet.
 *
 * Der Grund ist nie leer, wenn gesperrt wird: eine Sperre ohne sichtbaren Grund ist ein toter
 * Knopf, und ein toter Knopf ist eine Scheinfunktion.
 */
export function entscheidungSperre(lage: Anzeigelage): Sperre {
  if (lage.art === "leer") {
    return { gesperrt: true, grund: "ga.leer" };
  }
  return schreibSperre(lage);
}

/** Der i18n-Schlüssel der Standzeile — „Stand von …", „… wird aufgefrischt", „… fehlgeschlagen". */
export function standSchluessel(lage: Anzeigelage): string | null {
  if (lage.art !== "stand") {
    return null;
  }
  if (lage.auffrischungGescheitert) {
    return "ga.auffrischungGescheitert";
  }
  return lage.frisch ? "ga.standVon" : "ga.auffrischungLaeuft";
}

/**
 * Die Beschriftung einer Menge, die auch unbekannt sein kann.
 *
 * `null` → „nicht bestimmbar", `[]` → „keine", sonst die Aufzählung. Drei Fälle, drei Sätze — wer
 * `null` und `[]` zusammenzieht, verkauft Unwissen als Tatsache.
 */
export function mengenSchluessel(werte: readonly string[] | null): {
  readonly schluessel: string;
  readonly werte: string | null;
} {
  if (werte === null) {
    return { schluessel: "ga.baustein.unbekannt", werte: null };
  }
  if (werte.length === 0) {
    return { schluessel: "ga.baustein.keine", werte: null };
  }
  return { schluessel: "", werte: werte.join(", ") };
}

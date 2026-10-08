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

import type { AnweisungEntscheidung, AnweisungLesestand, AnweisungStand } from "../../api/types";

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

// ==================================================================================================
// PRÜFSTATUS-ANZEIGE (Pedi 28.09.2026, Ergänzung 3) · WAS BEDEUTET DER STAND, UND WAS KANN ICH TUN?
// ==================================================================================================
//
// Übersicht und Detailansicht zeigen DENSELBEN Status derselben Fassung — deshalb entsteht er hier
// EINMAL aus denselben Feldern (Stand, Version, Abschnittszahl, Rechte) und nicht zweimal in zwei
// Bauteilen. Es gibt keine neue Freigaberegel: die Sätze lesen nur ab, was der Server schon erzwingt
// (`alsVorgelegt`, `alsEntschieden`, `nurAenderbar`; Rechte `ko.create` und `ko.validate`). Eine
// zweite Person wird nirgends verlangt, weil keine Kontoregel sie vorsieht.
//
// WAS NICHT FESTGEHALTEN IST, WIRD NICHT ERFUNDEN: Entscheidungen VOR dem Auftrag STATUS-FREIGABE
// (produkt:20261007) tragen keine Person. Die Prüfangaben sagen das dann ausdrücklich. Zeitpunkt und
// Fassung einer solchen FREIGABE sind trotzdem belegt: eine freigegebene Anleitung nimmt keinen
// Schreibzugriff mehr an (`nurAenderbar`), also ist ihr `geaendertAm` der Augenblick der Freigabe und
// ihre `version` die freigegebene Fassung. Nach einer Ablehnung darf weiter geändert werden — dort
// ist `geaendertAm` nicht mehr der Zeitpunkt der Ablehnung und wird deshalb nicht als solcher gezeigt.
//
// STATUS-FREIGABE · seit diesem Auftrag hält der Server die Entscheidung fest (`entscheidung`: wer,
// wann, welche Fassung). Gezeigt wird sie NUR, wenn sie zum Stand passt (angenommen ↔ entschieden,
// abgelehnt ↔ abgelehnt) — sonst gilt sie als nicht festgehalten, und es greift der Satz oben.

export interface Freigaberechte {
  /** `ko.create` — vorlegen und überarbeiten. */
  readonly darfVorlegen: boolean;
  /** `ko.validate` — annehmen oder ablehnen. */
  readonly darfEntscheiden: boolean;
}

export interface Freigabeeingabe {
  readonly stand: AnweisungStand;
  readonly version: number;
  readonly geaendertAm: string;
  /** Alle Abschnitte, sichtbare UND verborgene — eine leere Anleitung kann nicht vorgelegt werden. */
  readonly abschnitte: number;
  /** Sieht der Betrachter nicht alle Abschnitte, kann er weder vorlegen noch entscheiden. */
  readonly unvollstaendig: boolean;
  /** Die vom Server festgehaltene letzte Entscheidung; fehlt sie, ist keine festgehalten. */
  readonly entscheidung?: AnweisungEntscheidung | undefined;
}

export interface Freigabeanzeige {
  /** Das kurze Standwort (`ga.stand.*`). */
  readonly wort: string;
  /** Was der Stand bedeutet — insbesondere: freigegeben oder nicht. */
  readonly bedeutung: string;
  /** Der nächste Schritt DIESES Betrachters, nach seinen Rechten. */
  readonly naechsterSchritt: string;
  /** Nur bei einer dokumentierten Entscheidung; sonst `null`. */
  readonly pruefung: {
    readonly schluessel: string;
    /** `null` = nicht festgehalten — die Anzeige sagt das, statt eine Zeit zu zeigen. */
    readonly am: string | null;
    /** Nur bei festgehaltener Entscheidung: die Kontokennung der entscheidenden Person. */
    readonly von?: string;
    /** Nur bei festgehaltener Entscheidung: die Fassung, über die entschieden wurde. */
    readonly nummer?: number;
  } | null;
}

/** Passt die festgehaltene Entscheidung zum Stand? Sonst ist sie für diese Anzeige nicht festgehalten. */
function passendeEntscheidung(eingabe: Freigabeeingabe): AnweisungEntscheidung | null {
  const e = eingabe.entscheidung;
  if (!e || e.von.trim().length === 0) {
    return null;
  }
  if (eingabe.stand === "entschieden" && e.ergebnis === "angenommen") {
    // Eine freigegebene Anleitung ändert sich nicht mehr: die Fassung MUSS die jetzige sein.
    return e.version === eingabe.version ? e : null;
  }
  if (eingabe.stand === "abgelehnt" && e.ergebnis === "abgelehnt") {
    return e;
  }
  return null;
}

function naechsterSchritt(eingabe: Freigabeeingabe, rechte: Freigaberechte): string {
  switch (eingabe.stand) {
    case "entschieden":
      return "fe001.status.schritt.gilt";
    case "vorgelegt":
      if (!rechte.darfEntscheiden) {
        return "fe001.status.schritt.warten";
      }
      return eingabe.unvollstaendig
        ? "fe001.status.schritt.unvollstaendigEntscheiden"
        : "fe001.status.schritt.entscheiden";
    default:
      if (!rechte.darfVorlegen) {
        return "fe001.status.schritt.nurLesen";
      }
      if (eingabe.unvollstaendig) {
        return "fe001.status.schritt.unvollstaendigVorlegen";
      }
      if (eingabe.abschnitte === 0) {
        return "fe001.status.schritt.abschnitteFehlen";
      }
      return eingabe.stand === "abgelehnt"
        ? "fe001.status.schritt.ueberarbeiten"
        : "fe001.status.schritt.vorlegen";
  }
}

/** Status, Bedeutung, nächster Schritt und Prüfangaben — für Übersicht UND Detail. */
export function freigabeanzeige(eingabe: Freigabeeingabe, rechte: Freigaberechte): Freigabeanzeige {
  const festgehalten = passendeEntscheidung(eingabe);
  const pruefung = festgehalten
    ? {
        schluessel:
          festgehalten.ergebnis === "angenommen"
            ? "statusfreigabe.anleitung.freigegebenVon"
            : "statusfreigabe.anleitung.abgelehntVon",
        am: festgehalten.am,
        von: festgehalten.von,
        nummer: festgehalten.version,
      }
    : eingabe.stand === "entschieden"
      ? { schluessel: "fe001.status.pruefung.freigegeben", am: eingabe.geaendertAm }
      : eingabe.stand === "abgelehnt"
        ? { schluessel: "fe001.status.pruefung.abgelehnt", am: null }
        : null;
  return {
    wort: `ga.stand.${eingabe.stand}`,
    bedeutung: `fe001.status.bedeutung.${eingabe.stand}`,
    naechsterSchritt: naechsterSchritt(eingabe, rechte),
    pruefung,
  };
}

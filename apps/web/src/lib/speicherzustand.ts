// ================================================================================================
// SPEICHERN-ERHOLUNG (Ausbauliste Punkt 6) — DIE VIER LAGEN EINES EXPLIZITEN SPEICHERNS.
// ================================================================================================
//
// Ein Mensch, der „Speichern" gedrückt hat, will genau eine Frage beantwortet haben: ist mein Text
// beim Server? Vier Antworten sind wahr, und sie dürfen nicht ineinanderfallen:
//
//   laeuft          die Anfrage ist unterwegs — noch keine Aussage über das Ergebnis.
//   wartet          es gibt keine Verbindung; react-query hält die Anfrage ANGEHALTEN (`isPaused`)
//                   und schickt sie von selbst, sobald das Netz zurück ist. Nichts ist gespeichert.
//   fehlgeschlagen  die Anfrage ist mit einem Fehler zurückgekommen; die Fläche zeigt ihren Satz.
//   gespeichert     der Server hat quittiert — und nur dann.
//
// DIE REIHENFOLGE DER ZWEIGE IST DIE AUSSAGE: eine laufende oder wartende Anfrage schlägt jedes
// Ergebnis eines VORIGEN Versuchs. „Gespeichert" über einer wartenden Anfrage wäre die Unwahrheit,
// gegen die dieser Auftrag geschrieben ist.
//
// DOM-frei und ohne React, damit die Ableitung für sich prüfbar ist.

export type Speicherzustand = "laeuft" | "wartet" | "fehlgeschlagen" | "gespeichert";

export interface Speicherlage {
  /** Eine Anfrage ist angestossen und noch nicht zurück (react-query `isPending`). */
  readonly unterwegs: boolean;
  /** Die Anfrage ist mangels Verbindung angehalten (react-query `isPaused`). */
  readonly angehalten: boolean;
  /** Der letzte Versuch ist gescheitert, und sein Satz steht auf der Fläche. */
  readonly fehlgeschlagen: boolean;
  /** Der Server hat den Stand quittiert, der jetzt auf der Fläche steht. */
  readonly gespeichert: boolean;
}

export function speicherzustand(lage: Speicherlage): Speicherzustand | null {
  if (lage.unterwegs) {
    return lage.angehalten ? "wartet" : "laeuft";
  }
  if (lage.fehlgeschlagen) {
    return "fehlgeschlagen";
  }
  if (lage.gespeichert) {
    return "gespeichert";
  }
  return null;
}

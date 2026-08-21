// ================================================================================================
// JOB 1495 · D3 · H3 — DAS AGGREGAT, OHNE DIENST DRUMHERUM.
// ================================================================================================
//
// WARUM DIESE DATEI ENTSTEHT. Bis D3 standen Aggregat und Lesedienst in derselben Datei. Das trug,
// solange nur der Dienst die Typen brauchte. Mit `kanten-paar.ts` (der Kanonisierungsregel) gibt es
// einen zweiten Träger derselben Typen — und ein Import in beide Richtungen wäre ein Zyklus:
// `dependency-cruiser` hat ihn beim ersten Versuch sofort gemeldet
// (`no-circular: kanten-paar.ts → kanten-service.ts → kanten-paar.ts`).
//
// Der Feldbestand ist UNVERÄNDERT aus `kanten-service.ts` hierher gezogen — kein Feld kommt hinzu,
// keines fällt weg, keine Bedeutung verschiebt sich. Er stammt aus dem geschlossenen Vertrag der
// Kette JOB 1045 (D2 §2.3) und ist dort nicht neu erfunden worden, damit die Persistenzscheibe
// denselben Satz vorfindet.
//
// `kanten-service.ts` exportiert alles hier Stehende weiterhin — jeder bestehende Importpfad bleibt
// gültig, insbesondere der des Vertragstests
// (`tests/ko/kanten-lesekette-sichtbarkeit.test.ts:25-29`).

/** Die fachliche Beziehungsart. Bewusst geschlossen: eine freie Zeichenkette wäre kein Vertrag. */
export type KantenArt = "gehoert_zu" | "ergaenzt" | "ersetzt" | "widerspricht" | "beispiel_fuer";

/**
 * `gerichtet` behält die Reihenfolge der Endpunkte (A ersetzt B ist nicht B ersetzt A).
 * `ungerichtet` und `symmetrisch` tragen keine Richtungsaussage; ihr Endpunktpaar wird kanonisch
 * abgelegt — die Regel dafür steht in `kanten-paar.ts` und wird seit JOB 1495 D3 auch angewandt.
 */
export type KantenRichtung = "gerichtet" | "ungerichtet" | "symmetrisch";

/**
 * `widerrufen` ist eine URHEBERAUSSAGE: ein Mensch hat die Beziehung zurückgenommen. Deshalb setzt
 * ein Papierkorbvorgang am Endpunkt diesen Wert NICHT (D3 §3.3) — sonst wäre nach der
 * Wiederherstellung nicht mehr unterscheidbar, ob jemand widerrufen hat oder ob die Kante nur ein
 * Papierkorbereignis überlebt hat. Die Sichtbarkeit trägt das allein.
 */
export type KantenStatus = "aktiv" | "widerrufen";

export interface KuratierteKante {
  /** Eigene Identität, nicht aus den Endpunkten abgeleitet. */
  id: string;
  quelleId: string;
  zielId: string;
  art: KantenArt;
  richtung: KantenRichtung;
  /** Der Mensch, der sie gesetzt hat. Nie ein Automat (D2 §2.6). */
  urheber: string;
  gesetztAm: string;
  geaendertAm: string;
  status: KantenStatus;
  version: number;
}

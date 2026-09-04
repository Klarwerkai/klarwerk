// Bewusst aus der Typdatei und NICHT aus dem Barrel `../trust`: diese Datei ist DOM- und JSX-frei
// und wird von einem Node-reinen Test gelesen. Über das Barrel käme die halbe Oberfläche mit, und
// der Wurzel-Typprüfer (ohne `--jsx`) fiele darüber.
import type { DisplayStatus } from "../trust/types";

// ==================================================================================================
// JOB 3063 · H4 — DER ZUSTAND EINES EINTRAGS ALS PUNKT, ALS WORT UND ALS SEGMENT.
// ==================================================================================================
//
// DOM-frei und einzeln geprüft (tests/design/h4-zustand.test.ts). Drei Fragen, eine Quelle:
//   · welchen Ton trägt der Punkt links in der Liste (grün/gelb/rot)?
//   · in welches Segment des Umschalters fällt der Eintrag?
//   · wann ist das Listenende erreicht (Nachladen beim Scrollen)?
//
// KEINE ZWEITE BENENNUNG: das WORT zum Zustand kommt unverändert aus `status.*` (`deriveStatus`),
// dieselbe Vokabel wie StatusPill, Filter und Validierung sie seit jeher benutzen. Diese Datei
// liefert nur den TON und die Zugehörigkeit, nie einen neuen Namen für dieselbe Sache.

export type ZustandsTon = "pos" | "warn" | "crit";

/**
 * Der Ton des Zustandspunkts. Ein offener Konflikt schlägt jeden anderen Zustand — er ist die
 * Auskunft, die den Leser am meisten angeht (dieselbe Regel wie `conflictLimitedUsability`).
 */
export function zustandsTon(status: DisplayStatus, konflikt = false): ZustandsTon {
  if (konflikt || status === "konflikt" || status === "abgelehnt") {
    return "crit";
  }
  if (status === "validiert") {
    return "pos";
  }
  return "warn";
}

export const BIB_SEGMENTE = ["alle", "validiert", "offen"] as const;
export type BibSegment = (typeof BIB_SEGMENTE)[number];
export const BIB_SEGMENT_STANDARD: BibSegment = "alle";

/**
 * Fällt ein Eintrag in das gewählte Segment?
 *
 * „validiert" ist genau der freigegebene Zustand; „offen" ist alles, was noch NICHT freigegeben ist
 * (Entwurf, offen, in Prüfung, Re-Validierung) sowie das abgelehnte/kollidierende Wissen — es ist
 * ebenso wenig freigegeben. Wer „Offen" wählt, will sehen, was noch Arbeit ist; ein abgelehnter
 * Eintrag unter „Freigegeben" wäre die Unwahrheit.
 */
export function passtZuSegment(status: DisplayStatus, segment: BibSegment): boolean {
  if (segment === "alle") {
    return true;
  }
  if (segment === "validiert") {
    return status === "validiert";
  }
  return status !== "validiert";
}

/**
 * Der Umschalter lebt in der ADRESSE (`?zustand=…`) — dieselbe Entscheidung wie beim
 * Geltungsbereich (JOB 381): ein geteilter Link zeigt dieselbe Treffermenge, und ein Neuladen
 * stellt sie wieder her. Ein unbekannter oder fehlender Wert fällt still auf „Alle" zurück; das
 * ist die schwächere und damit die richtige Aussage.
 */
export function bibSegmentAus(wert: string | null): BibSegment {
  return wert !== null && (BIB_SEGMENTE as readonly string[]).includes(wert)
    ? (wert as BibSegment)
    : BIB_SEGMENT_STANDARD;
}

/**
 * Ist der Scrollbereich nah genug am Ende, um die nächste Seite zu holen? Reine Rechnung, damit der
 * Auslöser prüfbar ist, ohne einen Browser zu fahren. `rand` ist der Vorlauf in Pixeln.
 */
export function amListenende(
  s: { scrollTop: number; clientHeight: number; scrollHeight: number },
  rand = 240,
): boolean {
  return s.scrollTop + s.clientHeight + rand >= s.scrollHeight;
}

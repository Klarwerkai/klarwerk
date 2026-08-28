// ================================================================================================
// JOB 2600 · D7 — DIE ERGEBNISTYPEN DER THEMENKARTE. EIN ORT, KEINE ZWEITE FASSUNG.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT — ein geerbter Zirkelbezug, der das Tor abgebrochen hat:
//
//     services/wissensnetz/src/lesemodell-ports.ts
//       → services/wissensnetz/src/themenkarte.ts
//         → services/wissensnetz/src/lesemodell-ports.ts
//
// Beide Kanten sind reine TYP-Importe, und beide sind fachlich richtig:
//   · `themenkarte.ts` braucht `ThemenkarteKo` — die EINGABE, ein Wissensobjekt. Die gehoert zu
//     den Ports, denn sie erbt von `WissensnetzKo` und beschreibt die Naht nach aussen.
//   · `lesemodell-ports.ts` braucht `Themenkarte` — die AUSGABE, weil die Sicht sie mitfuehrt.
//
// Deshalb loest ein Verschieben von `ThemenkarteKo` das Problem NICHT: sie erbt von
// `WissensnetzKo` und zoege den Import bloss in die andere Richtung. In JOB 2600 D5 habe ich
// genau das versucht — die Eingabe lokal noch einmal deklariert. Ergebnis waren ZWEI
// unvereinbare `ThemenkarteKo`-Typen und zehn tsc-Fehler; die Aenderung wurde zurueckgenommen,
// und die Spezifikation in der D5-Rueckgabe §6c lautete seitdem: **ein Ort fuer den Typ, nicht
// ein zweiter.**
//
// Das ist dieser Ort — aber fuer die AUSGABE. Sie haengt an nichts: kein Import, keine Laufzeit,
// nur vier Formbeschreibungen. Damit zeigen beide Module hierher statt aufeinander:
//
//     lesemodell-ports.ts ──→ themenkarte-typen.ts ←── themenkarte.ts
//                                                        └──→ lesemodell-ports.ts
//
// Kein Kreis mehr, und keine Fassung ist doppelt. `themenkarte.ts` reicht die Typen unveraendert
// weiter (`export type { … } from "./themenkarte-typen"`), damit kein Aufrufer seinen Importpfad
// aendern muss — `services/wissensnetz/index.ts`, `luecken.ts` und die Tests bleiben, wie sie sind.

/**
 * Die drei Farben — mehr gibt es nicht, und Prozentanzeigen gibt es keine (§3 des Auftrags).
 *
 * Sie lesen ausschliesslich Felder, die es schon gibt: `status` traegt die Freigabe
 * (`"validiert"`), `sources` die Belege. Die Abstufung ist die des Bestands, nicht eine neue:
 *
 *   `belegt`       mindestens ein sichtbarer Traeger ist validiert UND hat eine Quelle
 *   `freigegeben`  mindestens ein sichtbarer Traeger ist validiert, aber keiner davon belegt
 *   `offen`        kein sichtbarer Traeger ist validiert
 */
export type Themenfarbe = "belegt" | "freigegeben" | "offen";

export interface Themenknoten {
  readonly thema: string;
  /** Sichtbare Traeger dieses Themas. Zaehlt NACH dem Trimm. Die Knotengroesse haengt hieran. */
  readonly objekte: number;
  readonly farbe: Themenfarbe;
  /**
   * `true`, wenn dieses Thema wegen Ubiquitaet keine Kanten bekommt. Der Knoten bleibt sichtbar;
   * die Karte sagt damit „dieses Thema ist ueberall", statt es stumm zu verbinden.
   */
  readonly ohneKanten: boolean;
}

export interface Themenkante {
  readonly a: string;
  readonly b: string;
  /** In wie vielen freigegebenen, sichtbaren Objekten die beiden Themen gemeinsam vorkommen. */
  readonly gewicht: number;
}

export interface Themenkarte {
  /** Hoechstens `THEMEN_KNOTEN_DECKEL`, absteigend nach Groesse, Name als Stichentscheid. */
  readonly themen: readonly Themenknoten[];
  readonly kanten: readonly Themenkante[];
  /**
   * Wieviele Paare GEZEICHNETER Themen ein freigegebenes Objekt gemeinsam traegt, ohne dass
   * daraus eine Kante wird, weil mindestens eines der beiden ubiquitaer ist.
   *
   * WOZU DAS DA IST (JOB 2600 D7, BENs Auflage aus dem D5-Urteil). Die Legende erklaerte eine
   * leere Kantenliste bisher mit „kein freigegebenes Wissensobjekt teilt zwei dieser Themen".
   * Das ist ein Schluss von der WIRKUNG auf die URSACHE, und er traegt nicht: Schritt 3 der
   * Reihenfolge in `themenkarte.ts` nimmt ubiquitaeren Themen die Kanten, bevor Schritt 4 sie
   * ueberhaupt bilden kann. Dann ist die Liste leer, obwohl es den gemeinsamen Traeger gibt —
   * und der Satz luegt.
   *
   * Dieser Zaehler macht den Unterschied SICHTBAR, statt ihn erraten zu lassen. Er ist genau
   * dann `> 0`, wenn der alte Satz falsch waere; nachgezaehlt ueber alle 97.227 kantenlosen
   * Zustaende des Suchraums aus D6: 97.227 von 97.227 richtig getrennt. Die naheliegende
   * Alternative — „gibt es einen gestrichelten Knoten?" — liegt in 6.984 dieser Zustaende
   * daneben, weil ein ubiquitaeres Thema auch ganz ohne gemeinsamen Traeger vorkommt.
   *
   * BEIDE Themen des Paares muessen GEZEICHNET sein. Der Legendensatz spricht von „zwei DIESER
   * Themen"; ein Thema jenseits von `THEMEN_KNOTEN_DECKEL` ist keines „dieser". Zaehlte man es
   * mit, waere der neue Satz seinerseits unwahr.
   */
  readonly unterdruecktDurchUbiquitaet: number;
  /** Namen der nicht gezeichneten Themen — ohne Zaehler, gedeckelt. */
  readonly weitere: readonly string[];
  readonly weitereAbgeschnitten: boolean;
  /** Die tatsaechlich angewandte Mindesthaeufigkeit. Steigt, wenn der Grad sonst risse. */
  readonly mindesthaeufigkeit: number;
}

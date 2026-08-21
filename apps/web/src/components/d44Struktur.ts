// ================================================================================================
// JOB 1612 · D1 (M-6, Anker D44) — DIE GLIEDERUNG EINES LANGEN ENTWURFS.
// ================================================================================================
//
// D44, gemessen vom Design-Lead: Der importierte Entwurf rendert als EIN durchgehender Block ueber
// **13.288 Pixel** — keine Gliederung, keine Sprungmarken, kein Einklappen. Wer ihn pruefen soll,
// scrollt.
//
// Die Struktur muss nicht erfunden werden. `mapDocxHeadings` (lib/docx.ts:55) bildet beim Import
// h1 → h2 und h4–h6 → h3 ab, passend zum Sanitizer-Subset, und `extractDocxRich` faehrt sie
// (docx.ts:635). **Im Body stehen also genau h2 und h3.**
//
// ================================================================================================
// KEINE MINDESTZAHL VON UEBERSCHRIFTEN — und das ist ein bezahlter Befund.
// ================================================================================================
//
// Ein frueherer Anlauf (JOB 1521 D1) hat die Leiste erst ab DREI Ueberschriften gezeigt, mit der
// Begruendung, darunter sei sie „Zierrat". **BEN hat das mit ROT zurueckgewiesen, und zu Recht:**
//
//   „die Gliederungsleiste ist echter Teilfortschritt, wird aber durch die unbeauftragte
//    Mindestschwelle von drei Ueberschriften gerade bei einem sehr langen Dokument mit nur zwei
//    Abschnitten vollstaendig unterdrueckt."  (BEN-PRUEFUNG-JOB-1521-D1.md:3)
//
// **Das Kriterium von D44 ist der SCROLLBEDARF, nicht die Zahl der Ueberschriften.** Ein Dokument
// aus zwei Abschnitten zu je 6.000 Pixeln ist genau der Anlass. Deshalb gibt es hier keine
// Schwelle: **eine Ueberschrift mit Text genuegt.** Wer wieder eine Zahl einfuehren will, braucht
// eine Messung — nicht ein Gefuehl.
//
// ================================================================================================
// WARUM MIT EINEM REGULAEREN AUSDRUCK GELESEN WIRD, NICHT MIT EINEM DOM.
// ================================================================================================
//
// `DOMParser` gaebe es im Browser, aber diese Funktion soll ohne DOM pruefbar sein — das
// Testmuster ist `tests/web/d44-*.test.ts`, also `.ts` und kein Renderlauf. Es ist dasselbe
// Vorgehen, mit dem `mapDocxHeadings` arbeitet: eine eng begrenzte Auswertung auf sanitisiertem
// HTML, kein allgemeiner Parser.
//
// DER PUNKT, AN DEM DIESE DATEI KIPPEN WUERDE — bitte nicht wegoptimieren:
// Die Leiste springt nicht ueber eine Kennung, sondern ueber die POSITION: der n-te Eintrag zeigt
// auf die n-te Ueberschrift im Editor (`querySelectorAll("h2, h3")`). Das erspart es, IDs in
// fremdes contentEditable-HTML zu schreiben — kostet aber die Zusage, dass **beide Zaehlungen
// dieselbe sind**. Deshalb wird JEDE h2/h3 gezaehlt, auch eine mit leerem Text: Wer die leeren
// ueberspringt, verschiebt alle folgenden Sprungziele um eins, und zwar STILL — es sieht aus, als
// haette die Leiste funktioniert.

import { htmlToPlainText } from "../lib/richText";

/** Ein Eintrag der Gliederung. `position` ist der Index unter ALLEN h2/h3 des Bodys. */
export interface D44Eintrag {
  readonly ebene: 2 | 3;
  readonly text: string;
  readonly position: number;
}

/** Nur h2 und h3 — mehr laesst der Sanitizer nicht zu (services/structure, TAG_MAP). */
const D44_UEBERSCHRIFT = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;

/**
 * Liest die Gliederung eines Body-HTML.
 *
 * Die Beschriftung kommt aus `htmlToPlainText` (lib/richText.ts:433) — der kanonischen
 * HTML-zu-Text-Reduktion des Hauses, gefuehrt von `mega85-suchtext-formatierung` als solche.
 * Eine eigene Wandlung waere eine zweite Wahrheit; ein frueherer Anlauf hat das versucht und
 * wurde von jenem Sammler zu Recht rot gemacht.
 *
 * @returns Alle h2/h3 in Dokumentreihenfolge. Eine Ueberschrift ohne Text bleibt als Eintrag mit
 *          leerem `text` erhalten — sie zaehlt im DOM mit, also muss sie hier mitzaehlen.
 */
export function d44Gliederung(bodyHtml: string): D44Eintrag[] {
  if (typeof bodyHtml !== "string" || bodyHtml.length === 0) {
    return [];
  }
  const eintraege: D44Eintrag[] = [];
  // `matchAll` statt einer `exec`-Schleife: kein geteilter `lastIndex`, den ein zweiter Aufruf erbt.
  for (const treffer of bodyHtml.matchAll(D44_UEBERSCHRIFT)) {
    eintraege.push({
      ebene: treffer[1] === "2" ? 2 : 3,
      text: htmlToPlainText(treffer[2] ?? ""),
      position: eintraege.length,
    });
  }
  return eintraege;
}

/**
 * Die Eintraege, die die Leiste anzeigt.
 *
 * Getrennt von `d44Gliederung`, weil die beiden Mengen verschieden sind und verschieden bleiben
 * muessen: **gezaehlt wird alles** (fuer die Position), **gezeigt wird, was Text hat**. Eine leere
 * Ueberschrift ist kein Gliederungspunkt — aber sie verschiebt die Zaehlung.
 */
export function d44SichtbareEintraege(eintraege: readonly D44Eintrag[]): D44Eintrag[] {
  return eintraege.filter((eintrag) => eintrag.text.length > 0);
}

/**
 * Zeigt die Leiste sich ueberhaupt?
 *
 * **Ohne Mindestzahl** — siehe den Kopf dieser Datei. Genau eine Ueberschrift mit Text genuegt;
 * null Ueberschriften ergeben keine Leiste, weil es dann nichts anzuspringen gibt.
 */
export function d44LeisteZeigen(eintraege: readonly D44Eintrag[]): boolean {
  return d44SichtbareEintraege(eintraege).length > 0;
}

/** Was diese Gliederung zusichert — als Datum, damit ein Test es lesen kann. */
export const D44_GLIEDERUNG_GRENZE = {
  /** Keine Mindestzahl von Ueberschriften (BEN-PRUEFUNG-JOB-1521-D1). */
  mindestzahl: 0,
  /** Leere Ueberschriften zaehlen fuer die Position mit. */
  leereZaehlenMit: true,
  /** Aus dem Body wird nie Markup ausgegeben, nur Text. */
  gibtMarkupAus: false,
} as const;

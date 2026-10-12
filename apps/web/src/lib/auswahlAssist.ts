// ================================================================================================
// R-0300 — DIE KI-SCHREIBHILFE ARBEITET AUF DEM MARKIERTEN TEXT.
// ================================================================================================
//
// „Auf Knopfdruck formuliert die KI den MARKIERTEN Text klarer …" — bis hierher schickte der
// Standardeditor immer den ganzen Rumpf und ersetzte bei der Übernahme wieder den ganzen Rumpf.
//
// DIE BAUFORM: Die Markierung wird als ZEICHENVERSATZ über die Textknoten des Editors gemerkt
// (`start`/`ende`, dieselbe Zählung wie `Range.toString()`), dazu der Text, der an die KI ging. Der
// Editor ist unkontrolliert und lebt in `bodyHtml` weiter; übernommen wird deshalb nicht im
// lebenden DOM, sondern auf einer Abschrift von `bodyHtml` — dieselbe Fassung, die der Editor
// selbst aus seinem Baum gebildet hat (`RichTextEditor.tsx`, `emit`: `sanitizeHtml(innerHTML)`).
//
// GEGENPROBE STATT VERTRAUEN: Vor jeder Übernahme wird die Stelle an denselben Versätzen in der
// aktuellen Fassung neu gelesen. Weicht ihr Text von dem ab, der an die KI ging (der Mensch hat
// inzwischen weitergeschrieben), wird NICHTS geändert — `null`, und die Fläche sagt das.
//
// WAS AUSSERHALB DER MARKIERUNG STEHT, BLEIBT UNBERÜHRT — Text wie Formatierung. Innerhalb gilt:
//   · „Rechtschreibung" verteilt die Wörter des Vorschlags auf die vorhandenen Textstücke (dieselbe
//     Regel wie `applySpellingAssistPreservingHtml`): Fett, Listen, Absätze in der Markierung bleiben.
//   · Jede andere Aktion ersetzt die Markierung wie getippter Text (Zeilenumbrüche als `<br>`) bzw.
//     fügt den Vorschlag unmittelbar HINTER ihr ein.

import { sanitizeHtml } from "./richText";

export interface TextAuswahl {
  /** Zeichenversatz des Anfangs über alle Textknoten des Editors. */
  readonly start: number;
  /** Zeichenversatz des Endes (exklusiv). */
  readonly ende: number;
  /** Der Text der Markierung, wie er an die KI ging (Blockgrenzen als Zeilenumbruch). */
  readonly text: string;
}

export type AuswahlModus = "ersetzen" | "einfuegen";

const BLOCK = new Set([
  "P",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "DIV",
  "BLOCKQUOTE",
  "PRE",
  "TD",
  "TH",
  "TR",
  "FIGCAPTION",
]);

interface Stueck {
  readonly knoten: Text;
  /** Anfang und Ende des markierten Teils INNERHALB des Knotens. */
  readonly von: number;
  readonly bis: number;
}

function textknoten(wurzel: Node): Text[] {
  const doc = wurzel.ownerDocument ?? document;
  const gaenger = doc.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  const liste: Text[] = [];
  let k = gaenger.nextNode();
  while (k !== null) {
    liste.push(k as Text);
    k = gaenger.nextNode();
  }
  return liste;
}

function blockVon(knoten: Node, wurzel: Node): Node {
  let n: Node | null = knoten.parentNode;
  while (n !== null && n !== wurzel) {
    if (BLOCK.has(n.nodeName)) {
      return n;
    }
    n = n.parentNode;
  }
  return wurzel;
}

/** Die Textstücke zwischen den Versätzen `start` und `ende`. */
function stueckeIm(wurzel: Node, start: number, ende: number): Stueck[] {
  const stuecke: Stueck[] = [];
  let pos = 0;
  for (const knoten of textknoten(wurzel)) {
    const laenge = knoten.data.length;
    const von = Math.max(start - pos, 0);
    const bis = Math.min(ende - pos, laenge);
    if (bis > von) {
      stuecke.push({ knoten, von, bis });
    }
    pos += laenge;
  }
  return stuecke;
}

/**
 * Steht zwischen zwei Textknoten ein `<br>`? Ben, Nacharbeit 4: `<p>Ventil<br>prüfen</p>` kam als
 * „Ventilprüfen" bei der KI an — der Umbruch IM Absatz trägt keinen Text und fiel durch.
 * Die Zeichenversätze bleiben davon unberührt: ein `<br>` zählt dort (wie in `Range.toString()`)
 * null Zeichen; es wirkt nur auf den Text, der an die KI geht und gegen den geprüft wird.
 */
function umbruchZwischen(vorher: Node, nachher: Node, wurzel: Node): boolean {
  const doc = wurzel.ownerDocument ?? document;
  const gaenger = doc.createTreeWalker(wurzel, NodeFilter.SHOW_ELEMENT);
  const folgt = (a: Node, b: Node): boolean =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  for (let n = gaenger.nextNode(); n !== null; n = gaenger.nextNode()) {
    if (n.nodeName === "BR" && folgt(vorher, n) && folgt(n, nachher)) {
      return true;
    }
  }
  return false;
}

/**
 * Der Text der Stücke — innerhalb eines Blocks angehängt, über Blockgrenzen und über ein `<br>`
 * im selben Block mit Zeilenumbruch.
 */
function textDer(stuecke: readonly Stueck[], wurzel: Node): string {
  let text = "";
  let vorher: Stueck | null = null;
  let vorherBlock: Node | null = null;
  for (const s of stuecke) {
    const block = blockVon(s.knoten, wurzel);
    if (
      vorher !== null &&
      (block !== vorherBlock || umbruchZwischen(vorher.knoten, s.knoten, wurzel))
    ) {
      text += "\n";
    }
    text += s.knoten.data.slice(s.von, s.bis);
    vorher = s;
    vorherBlock = block;
  }
  return text;
}

function versatz(wurzel: Node, container: Node, offset: number): number {
  const doc = wurzel.ownerDocument ?? document;
  const r = doc.createRange();
  r.setStart(wurzel, 0);
  r.setEnd(container, offset);
  return r.toString().length;
}

/**
 * Die aktuelle Markierung INNERHALB von `feld`, oder `null` (keine, leer, oder ausserhalb).
 */
export function auswahlImFeld(feld: HTMLElement, auswahl: Selection | null): TextAuswahl | null {
  if (auswahl === null || auswahl.rangeCount === 0 || auswahl.isCollapsed) {
    return null;
  }
  const bereich = auswahl.getRangeAt(0);
  if (!feld.contains(bereich.startContainer) || !feld.contains(bereich.endContainer)) {
    return null;
  }
  const start = versatz(feld, bereich.startContainer, bereich.startOffset);
  const ende = versatz(feld, bereich.endContainer, bereich.endOffset);
  if (ende <= start) {
    return null;
  }
  const text = textDer(stueckeIm(feld, start, ende), feld);
  return text.trim().length > 0 ? { start, ende, text } : null;
}

function woerter(text: string): string[] {
  return text.trim().length > 0 ? text.trim().split(/\s+/) : [];
}

/** Rechtschreibung: Wörter des Vorschlags auf die Stücke verteilen. `false` = passt nicht. */
function woerterVerteilen(stuecke: readonly Stueck[], vorschlag: string): boolean {
  const neu = woerter(vorschlag);
  const anzahl = stuecke.map((s) => woerter(s.knoten.data.slice(s.von, s.bis)).length);
  if (neu.length === 0 || anzahl.reduce((a, b) => a + b, 0) !== neu.length) {
    return false;
  }
  let i = 0;
  // Rückwärts, damit die Versätze früherer Stücke im selben Knoten gültig bleiben.
  const auftraege = stuecke.map((s, idx) => {
    const teil = neu.slice(i, i + (anzahl[idx] ?? 0));
    i += anzahl[idx] ?? 0;
    return { s, teil };
  });
  for (const { s, teil } of auftraege.reverse()) {
    if (teil.length === 0) {
      continue;
    }
    const alt = s.knoten.data.slice(s.von, s.bis);
    const vorne = alt.match(/^\s*/)?.[0] ?? "";
    const hinten = alt.match(/\s*$/)?.[0] ?? "";
    s.knoten.replaceData(s.von, s.bis - s.von, `${vorne}${teil.join(" ")}${hinten}`);
  }
  return true;
}

/** Der Vorschlag als Knotenfolge: Text, Zeilenumbrüche als `<br>`. */
function vorschlagKnoten(doc: Document, vorschlag: string): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  const zeilen = vorschlag.replace(/\r\n?/g, "\n").split("\n");
  for (let idx = 0; idx < zeilen.length; idx += 1) {
    if (idx > 0) {
      fragment.appendChild(doc.createElement("br"));
    }
    fragment.appendChild(doc.createTextNode(zeilen[idx] ?? ""));
  }
  return fragment;
}

/** Trägt `bodyHtml` an den gemerkten Versätzen noch genau den markierten Text? */
export function auswahlNochGueltig(bodyHtml: string, auswahl: TextAuswahl): boolean {
  const doc = document.implementation.createHTMLDocument("");
  const wurzel = doc.createElement("div");
  wurzel.innerHTML = sanitizeHtml(bodyHtml);
  const stuecke = stueckeIm(wurzel, auswahl.start, auswahl.ende);
  return stuecke.length > 0 && textDer(stuecke, wurzel) === auswahl.text;
}

/**
 * Den Vorschlag an der gemerkten Markierung in `bodyHtml` übernehmen.
 *
 * `null` heisst: nichts geändert — die Stelle trägt nicht mehr den Text, der an die KI ging, der
 * Vorschlag ist leer, oder (Rechtschreibung) seine Wörter lassen sich nicht sicher verteilen.
 */
export function auswahlUebernehmen(
  bodyHtml: string,
  auswahl: TextAuswahl,
  vorschlag: string,
  optionen: { modus: AuswahlModus; rechtschreibung: boolean },
): string | null {
  if (vorschlag.trim().length === 0) {
    return null;
  }
  const doc = document.implementation.createHTMLDocument("");
  const wurzel = doc.createElement("div");
  wurzel.innerHTML = sanitizeHtml(bodyHtml);
  const stuecke = stueckeIm(wurzel, auswahl.start, auswahl.ende);
  const erstes = stuecke[0];
  const letztes = stuecke[stuecke.length - 1];
  if (!erstes || !letztes || textDer(stuecke, wurzel) !== auswahl.text) {
    return null;
  }

  if (optionen.modus === "ersetzen" && optionen.rechtschreibung) {
    if (!woerterVerteilen(stuecke, vorschlag)) {
      return null;
    }
    return sanitizeHtml(wurzel.innerHTML);
  }

  const bereich = doc.createRange();
  bereich.setStart(erstes.knoten, erstes.von);
  bereich.setEnd(letztes.knoten, letztes.bis);
  if (optionen.modus === "einfuegen") {
    bereich.collapse(false);
    bereich.insertNode(vorschlagKnoten(doc, ` ${vorschlag.trim()}`));
  } else {
    // Leerraum am Rand der Markierung (Doppelklick nimmt oft das Folgeleerzeichen mit) bleibt stehen.
    const vorne = /^\s/.test(auswahl.text) ? " " : "";
    const hinten = /\s$/.test(auswahl.text) ? " " : "";
    bereich.deleteContents();
    bereich.insertNode(vorschlagKnoten(doc, `${vorne}${vorschlag.trim()}${hinten}`));
  }
  return sanitizeHtml(wurzel.innerHTML);
}

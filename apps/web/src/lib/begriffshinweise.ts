// Firmenwörterbuch im Editor — wie ein Text geprüft und ein Hinweis GENAU an seiner Stelle
// übernommen wird.
//
// SEGMENTE SIND ZUSAMMENHÄNGENDE TEXTLÄUFE. Ein Segment ist der Text, den ein Mensch als EINEN
// Lauf liest: alle Textknoten eines Blocks (Absatz, Überschrift, Listenpunkt, Bildunterschrift …)
// über Inline-Formatierungen hinweg (fett, kursiv, Links). Getrennt wird an Blockgrenzen, an
// Zeilenumbrüchen (`<br>`) und an Bildern. So bleibt „Konto <b>Plus</b>" das zugelassene Synonym
// „Konto Plus", und „Kunden<b>account</b>" wird als „Kundenaccount" erkannt.
//
// JEDES SEGMENT KENNT SEINE TEXTKNOTEN. Eine Fundstelle wird auf die ursprünglichen Knoten
// abgebildet; übernommen wird, indem nur diese Knoten an genau diesen Stellen ihren Text ändern.
// Liegt der Fund in EINEM Knoten, bleibt dessen Formatierung vollständig. Läuft er über eine
// Formatierungsgrenze, steht die Vorzugsbezeichnung im Knoten, in dem der Fund beginnt; aus den
// übrigen Knoten wird nur der Rest der Fundstelle entfernt, und ein dadurch leeres Inline-Element
// fällt weg. Elemente, Attribute, Bilder und alle anderen Textteile bleiben, wie sie sind.
//
// NIE AUF VERDACHT: Passt der Knoten nicht mehr zu dem Stand, gegen den geprüft wurde (der Text
// wurde inzwischen geändert), wird NICHTS ersetzt — der Aufrufer bekommt `veraltet` und prüft neu.

export interface SegmentHinweis {
  segment: number;
  start: number;
  ende: number;
  gefunden: string;
  vorzug: string;
}

export type Uebernahme = { lage: "uebernommen"; html: string } | { lage: "veraltet" };

function koerper(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  doc.body.normalize();
  return doc.body;
}

/** Elemente, die einen eigenen Textlauf beginnen bzw. beenden. Alles andere gilt als Inline. */
const BLOCK = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "BODY",
  "CAPTION",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "LI",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);
/** Leere Elemente, die einen Lauf trennen: an ihnen liest niemand ein Wort weiter. */
const TRENNER = new Set(["BR", "HR", "IMG", "VIDEO", "AUDIO", "IFRAME", "INPUT", "SVG"]);

interface Teil {
  knoten: Text;
  /** Position des Knotenanfangs im Segmenttext. */
  von: number;
}

interface Segment {
  text: string;
  teile: Teil[];
}

function blockVon(knoten: Node): Element | null {
  let e = knoten.parentElement;
  while (e && !BLOCK.has(e.tagName.toUpperCase())) {
    e = e.parentElement;
  }
  return e;
}

function segmentiere(wurzel: HTMLElement): Segment[] {
  const raus: Segment[] = [];
  let aktuell: Segment | null = null;
  let aktuellerBlock: Element | null = null;
  const gang = wurzel.ownerDocument.createTreeWalker(
    wurzel,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let knoten = gang.nextNode();
  while (knoten) {
    if (knoten.nodeType === Node.TEXT_NODE) {
      const text = knoten as Text;
      const block = blockVon(text);
      if (!aktuell || block !== aktuellerBlock) {
        aktuell = { text: "", teile: [] };
        aktuellerBlock = block;
        raus.push(aktuell);
      }
      aktuell.teile.push({ knoten: text, von: aktuell.text.length });
      aktuell.text += text.data;
    } else {
      const name = (knoten as Element).tagName.toUpperCase();
      if (BLOCK.has(name) || TRENNER.has(name)) {
        // Ein neuer Block oder ein Trenner beendet den laufenden Text — auch innerhalb desselben
        // äusseren Blocks („a<br>b", „<div>a<p>b</p>c</div>").
        aktuell = null;
      }
    }
    knoten = gang.nextNode();
  }
  // Ein Block-Ende ohne nachfolgendes Element (Text nach einem inneren Block) trennt ebenfalls:
  // das deckt `blockVon` ab, denn der Text danach gehört wieder zum äusseren Block.
  return raus;
}

/** Die zusammenhängenden Textläufe in Dokumentreihenfolge — das, was an den Server geht. */
export function segmenteAusHtml(html: string): string[] {
  return segmentiere(koerper(html)).map((s) => s.text);
}

/** Entfernt ein leer gewordenes Inline-Element samt leerer Inline-Eltern — nie einen Block. */
function leereInlineEntfernen(knoten: Text): void {
  let rest: Node | null = knoten;
  while (rest?.parentNode) {
    const eltern: Node = rest.parentNode;
    eltern.removeChild(rest);
    if (
      eltern.nodeType !== Node.ELEMENT_NODE ||
      BLOCK.has((eltern as Element).tagName.toUpperCase()) ||
      eltern.childNodes.length > 0
    ) {
      return;
    }
    rest = eltern;
  }
}

/** Hat der Text überhaupt etwas, das sich zu prüfen lohnt? */
export function hatPruefbarenText(segmente: readonly string[]): boolean {
  return segmente.some((s) => /[\p{L}\p{N}]/u.test(s));
}

/**
 * Ersetzt die Fundstelle eines Hinweises durch die Vorzugsbezeichnung — nur, wenn der Knoten
 * noch genau der geprüfte ist. `geprueft` sind die Segmente, gegen die der Hinweis entstand.
 */
export function hinweisUebernehmen(
  html: string,
  hinweis: SegmentHinweis,
  geprueft: readonly string[],
): Uebernahme {
  const body = koerper(html);
  const segmente = segmentiere(body);
  const ziel = segmente[hinweis.segment];
  if (
    segmente.length !== geprueft.length ||
    !ziel ||
    ziel.text !== geprueft[hinweis.segment] ||
    hinweis.start >= hinweis.ende ||
    ziel.text.slice(hinweis.start, hinweis.ende) !== hinweis.gefunden
  ) {
    return { lage: "veraltet" };
  }
  // Die Fundstelle auf die ursprünglichen Knoten abbilden. Die Längen werden VOR jeder Änderung
  // festgehalten — die Positionen beziehen sich auf den geprüften Text.
  const betroffen = ziel.teile
    .map((t) => ({ ...t, bis: t.von + t.knoten.data.length }))
    .filter((t) => t.von < hinweis.ende && hinweis.start < t.bis);
  betroffen.forEach((t, i) => {
    const anfang = Math.max(hinweis.start, t.von) - t.von;
    const schluss = Math.min(hinweis.ende, t.bis) - t.von;
    const einsatz = i === 0 ? hinweis.vorzug : "";
    t.knoten.data = t.knoten.data.slice(0, anfang) + einsatz + t.knoten.data.slice(schluss);
    if (t.knoten.data === "") {
      leereInlineEntfernen(t.knoten);
    }
  });
  return { lage: "uebernommen", html: body.innerHTML };
}

/** Ein kurzer Ausschnitt um die Fundstelle, damit sichtbar ist, WELCHE Stelle gemeint ist. */
export function fundumgebung(
  segment: string,
  start: number,
  ende: number,
  rand = 32,
): { vor: string; fund: string; nach: string } {
  const von = Math.max(0, start - rand);
  const bis = Math.min(segment.length, ende + rand);
  return {
    vor: (von > 0 ? "…" : "") + segment.slice(von, start),
    fund: segment.slice(start, ende),
    nach: segment.slice(ende, bis) + (bis < segment.length ? "…" : ""),
  };
}

/**
 * Kennung eines verworfenen Hinweises — die KONKRETE Fundstelle: Segment, Position, Text und der
 * Wortlaut des Segments. Ohne die Segmentnummer bekämen zwei gleichlautende Absätze dieselbe
 * Kennung, und ein Verwerfen blendete beide aus. Ändert sich der Text oder die Knotenfolge, gilt
 * die Kennung nicht mehr — dann erscheint der Hinweis lieber wieder, als einen fremden zu verbergen.
 */
export function verwerfKennung(
  hinweis: SegmentHinweis & { begriffId: string },
  segment: string,
): string {
  return `${hinweis.begriffId}|${hinweis.segment}|${hinweis.start}|${hinweis.gefunden}|${segment}`;
}

/** Die Hinweise, die nach dem Verwerfen noch stehen — derselbe Filter für jede neue Prüfung. */
export function sichtbareHinweise<H extends SegmentHinweis & { begriffId: string }>(
  hinweise: readonly H[],
  segmente: readonly string[],
  verworfen: ReadonlySet<string>,
): H[] {
  return hinweise.filter((h) => !verworfen.has(verwerfKennung(h, segmente[h.segment] ?? "")));
}

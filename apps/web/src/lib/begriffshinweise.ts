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
// Ersetzt wird nur der Teil, in dem sich Fund und Vorzugsbezeichnung unterscheiden; gleicher
// Anfang und gleiches Ende bleiben in ihren Knoten und damit in ihrer Formatierung
// („Kunden<b>account</b>" → „Kunden<b>konto</b>"). Lief der alte Mittelteil über mehrere Knoten,
// wird der neue mechanisch auf dieselben Knoten verteilt (`verteile`), sodass keiner samt
// Auszeichnung verschwindet. Elemente, Attribute, Links, Bilder und alle anderen Textteile bleiben.
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
 * Der Bereich der Fundstelle, der sich wirklich ändert, und sein neuer Text: gemeinsamer Anfang
 * und gemeinsames Ende (gleiche Schreibweise) von Fund und Vorzugsbezeichnung fallen heraus.
 */
function geaenderterBereich(h: SegmentHinweis): { start: number; ende: number; neu: string } {
  const alt = h.gefunden;
  const neu = h.vorzug;
  const max = Math.min(alt.length, neu.length);
  let vorn = 0;
  while (vorn < max && alt[vorn] === neu[vorn]) {
    vorn += 1;
  }
  let hinten = 0;
  while (hinten < max - vorn && alt[alt.length - 1 - hinten] === neu[neu.length - 1 - hinten]) {
    hinten += 1;
  }
  return {
    start: h.start + vorn,
    ende: h.ende - hinten,
    neu: neu.slice(vorn, neu.length - hinten),
  };
}

/**
 * Teilt den neuen Text in der Reihenfolge der betroffenen Läufe auf. Rein mechanisch, ohne
 * sprachliche Silbenregel: jeder Lauf bekommt zuerst ein Zeichen (damit keiner samt Auszeichnung
 * verschwindet), der Rest folgt dem Anteil, den der Lauf am alten Text hatte. Hat der neue Text
 * weniger Zeichen als Läufe, bleiben die hinteren leer. Ein einziger Lauf erhält alles.
 */
function verteile(neu: string, alteLaengen: readonly number[]): string[] {
  const k = alteLaengen.length;
  if (k <= 1) {
    return [neu];
  }
  const sockel = neu.length >= k ? 1 : 0;
  const rest = neu.length - sockel * k;
  const summe = alteLaengen.reduce((a, b) => a + b, 0);
  const raus: string[] = [];
  let pos = 0;
  let kumuliert = 0;
  let restVergeben = 0;
  alteLaengen.forEach((laenge, i) => {
    kumuliert += laenge;
    const restBisHier = i === k - 1 || summe === 0 ? rest : Math.round((rest * kumuliert) / summe);
    const anzahl = sockel + restBisHier - restVergeben;
    restVergeben = restBisHier;
    raus.push(neu.slice(pos, pos + anzahl));
    pos += anzahl;
  });
  return raus;
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
  // NUR DER UNTERSCHIED WIRD ERSETZT. Gemeinsamer Anfang und gemeinsames Ende von Fund und
  // Vorzugsbezeichnung bleiben als Zeichen in ihren Knoten stehen — und damit in ihrer
  // Formatierung. Aus „Kunden<b>account</b>" wird „Kunden<b>konto</b>", aus „<b>Kunden</b>account"
  // wird „<b>Kunden</b>konto": keine Auszeichnung geht verloren, keine wird ausgeweitet.
  const { start: aStart, ende: aEnde, neu } = geaenderterBereich(hinweis);
  // Die Positionen beziehen sich auf den geprüften Text; die Knotenlängen werden VOR jeder
  // Änderung festgehalten.
  const teile = ziel.teile.map((t) => ({ ...t, bis: t.von + t.knoten.data.length }));
  if (aStart === aEnde) {
    // Reines Einfügen: an das Ende des Knotens mit dem letzten gleichen Zeichen davor — fehlt ein
    // gemeinsamer Anfang, an den Anfang des Knotens, in dem der Fund beginnt.
    const ort =
      aStart > hinweis.start
        ? teile.find((t) => t.von < aStart && aStart <= t.bis)
        : teile.find((t) => t.von <= aStart && aStart < t.bis);
    if (ort && neu) {
      const i = aStart - ort.von;
      ort.knoten.data = ort.knoten.data.slice(0, i) + neu + ort.knoten.data.slice(i);
    }
    return { lage: "uebernommen", html: body.innerHTML };
  }
  // Ersetzen: der neue Mittelteil wird auf ALLE Knoten verteilt, über die der alte lief
  // (`verteile`). Kein betroffener Lauf wird geleert, solange der neue Text genug Zeichen hat —
  // sonst verschwände mit ihm seine Auszeichnung (<b>, <a>). Nacharbeit 5, BAHN17-G4-K4.
  const betroffen = teile
    .filter((t) => t.von < aEnde && aStart < t.bis)
    .map((t) => ({
      ...t,
      anfang: Math.max(aStart, t.von) - t.von,
      schluss: Math.min(aEnde, t.bis) - t.von,
    }));
  const anteile = verteile(
    neu,
    betroffen.map((t) => t.schluss - t.anfang),
  );
  betroffen.forEach((t, i) => {
    const einsatz = anteile[i] ?? "";
    t.knoten.data = t.knoten.data.slice(0, t.anfang) + einsatz + t.knoten.data.slice(t.schluss);
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

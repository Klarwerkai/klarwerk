// Firmenwörterbuch im Editor — wie ein Text geprüft und ein Hinweis GENAU an seiner Stelle
// übernommen wird.
//
// SEGMENTE SIND TEXTKNOTEN. Geprüft wird nicht der flache Text, sondern jeder Textknoten des
// Editor-HTML für sich. Ein Fund liegt damit immer in genau einem Knoten, und übernommen wird,
// indem GENAU DIESER Knoten an GENAU DIESER Stelle seinen Text ändert. Elemente, Attribute,
// Formatierung (fett, kursiv, Links, Listen, Bilder) und alle anderen Knoten bleiben, wie sie sind.
// Die Kehrseite ist benannt: eine Benennung, die mitten in einer Formatierung geteilt ist
// („Kunden<b>konto</b>"), wird nicht gefunden.
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

function textknoten(wurzel: HTMLElement): Text[] {
  const raus: Text[] = [];
  const gang = wurzel.ownerDocument.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  let knoten = gang.nextNode();
  while (knoten) {
    raus.push(knoten as Text);
    knoten = gang.nextNode();
  }
  return raus;
}

/** Die Texte aller Textknoten in Dokumentreihenfolge — das, was an den Server geht. */
export function segmenteAusHtml(html: string): string[] {
  return textknoten(koerper(html)).map((t) => t.data);
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
  const knoten = textknoten(body);
  const ziel = knoten[hinweis.segment];
  if (
    knoten.length !== geprueft.length ||
    !ziel ||
    ziel.data !== geprueft[hinweis.segment] ||
    ziel.data.slice(hinweis.start, hinweis.ende) !== hinweis.gefunden
  ) {
    return { lage: "veraltet" };
  }
  ziel.data = ziel.data.slice(0, hinweis.start) + hinweis.vorzug + ziel.data.slice(hinweis.ende);
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

/** Kennung eines verworfenen Hinweises — gilt, solange die Stelle denselben Text trägt. */
export function verwerfKennung(
  hinweis: SegmentHinweis & { begriffId: string },
  segment: string,
): string {
  return `${hinweis.begriffId}|${hinweis.start}|${hinweis.gefunden}|${segment}`;
}

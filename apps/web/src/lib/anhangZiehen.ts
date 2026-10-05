// ANHÄNGE ZIEHEN (03.10.2026): ein Eintrag aus der Bild- bzw. Dateiliste des Editors wird mit der Maus
// an eine Textstelle gezogen statt per Klick an den Cursor gesetzt.
//
// WAS ÜBER DIE ZIEHDATEN REIST, IST NUR EIN SCHLÜSSEL, NIE MARKUP. Der Editor schreibt beim Ziehen
// `{ art, schluessel }` unter einem eigenen Typ in den DataTransfer und schlägt beim Ablegen den
// Schlüssel in SEINEN aktuellen Listen nach. Was dort nicht steht, wird nicht eingefügt. Eine fremde
// Quelle, die denselben Typ setzt, kann damit höchstens einen Anhang einfügen lassen, den die Liste
// ohnehin anbietet — fremdes HTML, fremde URLs und `text/html`-Drops bleiben draußen wie bisher.
// Das eingefügte Markup baut ausschließlich der vorhandene Weg (`insertImageHtml` /
// `insertImageSrcHtml` / `fileLinkHtml`), derselbe wie beim Klick.

import type { EditorFile } from "./bodyFileLink";

export const ANHANG_ZIEH_TYP = "application/x-klarwerk-anhang";

export type AnhangArt = "bild" | "datei";

export interface GezogenerAnhang {
  art: AnhangArt;
  schluessel: string;
}

interface BildEintrag {
  objectId?: string;
  src?: string;
  name: string;
}

// Derselbe Schlüssel, unter dem die Liste ihre Einträge führt (React-`key` der Knöpfe).
export function bildSchluessel(img: BildEintrag): string {
  return img.objectId ?? img.src ?? img.name;
}

export function anhangZiehwert(anhang: GezogenerAnhang): string {
  return JSON.stringify({ art: anhang.art, schluessel: anhang.schluessel });
}

// Streng gelesen: alles, was nicht genau die eigene Form hat, ist kein gezogener Anhang.
export function liesGezogenenAnhang(roh: string | null | undefined): GezogenerAnhang | null {
  if (!roh) {
    return null;
  }
  let wert: unknown;
  try {
    wert = JSON.parse(roh);
  } catch {
    return null;
  }
  if (typeof wert !== "object" || wert === null) {
    return null;
  }
  const { art, schluessel } = wert as { art?: unknown; schluessel?: unknown };
  if ((art !== "bild" && art !== "datei") || typeof schluessel !== "string" || !schluessel) {
    return null;
  }
  return { art, schluessel };
}

export type AufgeloesterAnhang<B extends BildEintrag> =
  | { art: "bild"; bild: B }
  | { art: "datei"; datei: EditorFile };

// Nur bekannte Einträge: der Schlüssel wird in den Listen gesucht, die der Editor gerade anbietet.
export function loeseGezogenenAnhangAuf<B extends BildEintrag>(
  anhang: GezogenerAnhang | null,
  bilder: readonly B[],
  dateien: readonly EditorFile[],
): AufgeloesterAnhang<B> | null {
  if (!anhang) {
    return null;
  }
  if (anhang.art === "bild") {
    const bild = bilder.find((b) => bildSchluessel(b) === anhang.schluessel);
    return bild ? { art: "bild", bild } : null;
  }
  const datei = dateien.find((d) => d.objectId === anhang.schluessel);
  return datei ? { art: "datei", datei } : null;
}

interface PunktDokument {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

// Die Textstelle unter dem Mauspunkt des Ablegens — oder `null`, wenn der Browser keine liefert oder
// sie nicht im Feld liegt (dann gilt der bisherige Weg: Cursor, sonst Ende).
//
// Landet der Punkt in einer Bildhülle (Bild oder Unterschrift), kommt der Anhang HINTER die Hülle:
// die Unterschrift ist ein eigener Schreibbereich, und ein Bild in einer fremden Hülle risse deren
// Paarung Bild↔Unterschrift auseinander.
export function einfuegestelleAmPunkt(feld: HTMLElement, x: number, y: number): Range | null {
  const doc = feld.ownerDocument;
  // Nicht jede Engine kennt beide Abfragen (jsdom keine) — deshalb vorher gefragt, nie vorausgesetzt.
  const punkt = doc as unknown as PunktDokument;
  let bereich: Range | null = null;
  if (typeof punkt.caretPositionFromPoint === "function") {
    const pos = punkt.caretPositionFromPoint.call(doc, x, y);
    if (pos) {
      bereich = doc.createRange();
      bereich.setStart(pos.offsetNode, pos.offset);
      bereich.collapse(true);
    }
  } else if (typeof punkt.caretRangeFromPoint === "function") {
    bereich = punkt.caretRangeFromPoint.call(doc, x, y);
  }
  if (!bereich || !feld.contains(bereich.startContainer)) {
    return null;
  }
  const start = bereich.startContainer;
  const element = start.nodeType === 1 ? (start as Element) : start.parentElement;
  const huelle = element?.closest("figure");
  if (huelle && feld.contains(huelle)) {
    bereich.setStartAfter(huelle);
    bereich.collapse(true);
  }
  return bereich;
}

/** Höchstzahl der `p:sldId`-Einträge; mehrfach genannte Folienteile werden nur einmal gelesen. */
export const MAX_FOLIEN = 2000;
/** Höchstgröße EINES Folienteils (Zeichen) — ein echter Folienteil liegt weit darunter. */
export const MAX_FOLIENTEIL_ZEICHEN = 16 * 1024 * 1024;

export interface XmlTag {
  readonly von: number;
  readonly bis: number;
  readonly name: string;
  readonly art: "auf" | "zu" | "leer";
  /** Der Tag von „<“ bis „>“ — für `attribut`. */
  readonly roh: string;
}

/**
 * Geht einen XML-Teil genau einmal durch: `tag` je Start-, End- oder leerem Tag, `text` je Rohtext
 * dazwischen (als Bereich, CDATA als Text). Linear in der Länge; endet am ersten offenen Konstrukt.
 */
export function tastAb(
  xml: string,
  tag: (t: XmlTag) => void,
  text: (von: number, bis: number) => void = () => {},
): void {
  const n = xml.length;
  let pos = 0;
  while (pos < n) {
    const lt = xml.indexOf("<", pos);
    if (lt < 0) {
      text(pos, n);
      return;
    }
    if (lt > pos) {
      text(pos, lt);
    }
    if (xml.startsWith("<!--", lt)) {
      const ende = xml.indexOf("-->", lt + 4);
      if (ende < 0) {
        return;
      }
      pos = ende + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const ende = xml.indexOf("]]>", lt + 9);
      if (ende < 0) {
        return;
      }
      text(lt + 9, ende);
      pos = ende + 3;
      continue;
    }
    if (xml.startsWith("<?", lt)) {
      const ende = xml.indexOf("?>", lt + 2);
      if (ende < 0) {
        return;
      }
      pos = ende + 2;
      continue;
    }
    if (xml.startsWith("<!", lt)) {
      return; // DOCTYPE u. Ä. — in OOXML nicht vorgesehen; nicht gedeutet, hier endet das Lesen.
    }
    let i = lt + 1;
    const zu = xml.charCodeAt(i) === 47; // „/“
    if (zu) {
      i += 1;
    }
    const nameStart = i;
    while (i < n) {
      const c = xml.charCodeAt(i);
      if (c === 62 || c === 47 || c <= 32) {
        break;
      }
      i += 1;
    }
    const name = xml.slice(nameStart, i);
    let ende = -1;
    while (i < n) {
      const c = xml.charCodeAt(i);
      if (c === 62) {
        ende = i;
        break;
      }
      if (c === 34 || c === 39) {
        const q = xml.indexOf(c === 34 ? '"' : "'", i + 1);
        if (q < 0) {
          return;
        }
        i = q + 1;
        continue;
      }
      i += 1;
    }
    if (ende < 0) {
      return;
    }
    tag({
      name,
      von: lt,
      bis: ende + 1,
      art: zu ? "zu" : xml.charCodeAt(ende - 1) === 47 ? "leer" : "auf",
      roh: xml.slice(lt, ende + 1),
    });
    pos = ende + 1;
  }
}

export interface XmlAbschnitt {
  readonly von: number;
  readonly bis: number;
  readonly inhaltVon: number;
  readonly inhaltBis: number;
}

/** Vollständige, nicht überlappende Elemente; offene Tags werden nie erneut durchsucht. */
export function xmlAbschnitte(xml: string, name: string, attributeErlaubt = true): XmlAbschnitt[] {
  const abschnitte: XmlAbschnitt[] = [];
  let tiefe = 0;
  let von = 0;
  let inhaltVon = 0;
  tastAb(xml, (t) => {
    if (t.name !== name) return;
    if (t.art === "auf") {
      if (tiefe === 0) {
        if (!attributeErlaubt && t.roh !== `<${name}>`) return;
        von = t.von;
        inhaltVon = t.bis;
      }
      tiefe++;
    } else if (t.art === "zu" && tiefe > 0) {
      tiefe--;
      if (tiefe === 0) abschnitte.push({ von, bis: t.bis, inhaltVon, inhaltBis: t.von });
    }
  });
  return abschnitte;
}

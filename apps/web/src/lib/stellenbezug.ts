// ================================================================================================
// P-WIKI-STELLENBEZUG — WORAN IM TEXT EINE RÜCKFRAGE HÄNGT, UND OB SIE ES NACH EINER ÄNDERUNG NOCH TUT.
// ================================================================================================
//
// ZWEI AUFGABEN, EINE NORMALFORM:
//
//  1. `stellenbloecke` zerlegt den Inhalt einer Fassung in die Stellen, an die eine Rückfrage gehängt
//     werden kann: Absätze (auch Listenpunkte und vorformatierter Text), Tabellen und Bilder mit
//     Anker (`data-image-id`). Jede Stelle trägt ihren ABSCHNITT — den Text der vorangehenden
//     Überschrift, Gleichnamige mit Zähler („Ablauf (2)"), leer vor der ersten Überschrift.
//
//  2. `stelleZuordnen` beantwortet für eine gespeicherte Stelle: wo steht sie in DIESER Fassung?
//     NUR ÜBER GLEICHHEIT von Art, Abschnitt und Textstelle. Gibt es genau einen Treffer, ist die
//     Zuordnung eindeutig; gibt es keinen oder mehrere, sagt die Fläche das — sie hängt die Frage
//     NIE still an einen ähnlichen Text. Eine Ähnlichkeitssuche ist hier ausdrücklich ausgeschlossen.
//
// DIE TEXTNORMALFORM IST DIESELBE WIE IM DIENST (`services/knowledge-object/src/stellen-anker.ts`):
// Inline-Auszeichnungen trennen keine Wörter, jede andere Elementgrenze ist ein Leerzeichen,
// Leerraum wird zusammengezogen. Sonst nähme der Dienst eine Stelle nicht an, die diese Fläche
// anbietet. Über die Modulgrenze ist sie nicht teilbar; `tests/wiki-stellenbezug` hält beide gegeneinander.
import type { KoDiskussionsStelle } from "../api/endpoints";
import { stellenFingerabdruck } from "./stellenabdruck";

/** Höchstlänge der gespeicherten Textstelle — dieselbe Zahl wie `STELLE_TEXT_MAX` im Dienst. */
export const STELLE_TEXT_MAX = 300;

// Dieselbe Menge wie `INLINE_ELEMENTE` in `services/knowledge-object/src/stellen-anker.ts`.
const INLINE_ELEMENTE = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "ins",
  "kbd",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
]);

/** Eine Stelle im Text einer Fassung. `anzeige` ist das, was ein Mensch zur Auswahl liest. */
export interface Stellenblock extends Omit<KoDiskussionsStelle, "koVersion"> {
  anzeige: string;
}

export type Stellenlage =
  /** Die Stelle stammt aus der angezeigten Fassung und steht dort. */
  | { lage: "dieseFassung"; block: Stellenblock }
  /** Die Stelle stammt aus einer anderen Fassung und steht in der angezeigten genau einmal. */
  | { lage: "eindeutig"; block: Stellenblock }
  /** Kein oder mehr als ein Treffer — die Zuordnung muss ein Mensch prüfen. */
  | { lage: "unklar" };

function normalisiere(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Der normalisierte Text eines Elements, in der Normalform der Stellen. */
function stellentextVon(el: Node): string {
  let aus = "";
  const lauf = (n: Node): void => {
    if (n.nodeType === Node.TEXT_NODE) {
      aus += n.nodeValue ?? "";
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const inline = INLINE_ELEMENTE.has((n as Element).tagName.toLowerCase());
    if (!inline) {
      aus += " ";
    }
    for (const kind of Array.from(n.childNodes)) {
      lauf(kind);
    }
    if (!inline) {
      aus += " ";
    }
  };
  lauf(el);
  return normalisiere(aus);
}

/** Die gespeicherte Textstelle: gekürzt auf die Höchstlänge, ohne halbes Zeichen am Ende. */
function textstelle(text: string): string {
  let kurz = text.slice(0, STELLE_TEXT_MAX);
  const letztes = kurz.charCodeAt(kurz.length - 1);
  if (letztes >= 0xd800 && letztes <= 0xdbff) {
    kurz = kurz.slice(0, -1);
  }
  return normalisiere(kurz);
}

const BLOCK_IN_LISTENPUNKT = "p, ul, ol, table, pre, blockquote, div, figure";

/** Die Stellen einer Fassung, in Lesereihenfolge. */
export function stellenbloecke(bodyHtml: string | null | undefined): Stellenblock[] {
  const html = bodyHtml ?? "";
  if (html.trim().length === 0 || typeof DOMParser === "undefined") {
    return [];
  }
  // DOMParser führt nichts aus und lädt nichts nach — der Inhalt wird hier nur gelesen.
  const dokument = new DOMParser().parseFromString(html, "text/html");
  const bloecke: Stellenblock[] = [];
  const ueberschriften = new Map<string, number>();
  let abschnitt = "";

  // `abschnittVoll` ist die vollständige Kennung (Identität), `abschnitt` ihre gekürzte Anzeige.
  let abschnittVoll = "";

  const block = (
    art: Stellenblock["art"],
    inhaltVoll: string,
    text: string,
    anzeige: string,
  ): void => {
    bloecke.push({
      art,
      abschnitt,
      text,
      fingerabdruck: stellenFingerabdruck(art, abschnittVoll, inhaltVoll),
      anzeige,
    });
  };

  const bild = (img: Element, umgebung: Element): void => {
    const kennung = img.getAttribute("data-image-id") ?? "";
    if (kennung.length === 0) {
      // Ohne Anker lässt sich ein Bild nach einer Änderung nicht wiedererkennen — es wird nicht
      // angeboten, statt eine Zuordnung zu versprechen, die es nicht gibt.
      return;
    }
    const unterschrift = umgebung.querySelector("figcaption");
    const anzeige =
      normalisiere(unterschrift ? stellentextVon(unterschrift) : "") ||
      normalisiere(img.getAttribute("alt") ?? "") ||
      kennung;
    block("bild", kennung, kennung, anzeige);
  };

  const absatz = (el: Element): void => {
    for (const img of Array.from(el.querySelectorAll("img"))) {
      bild(img, el);
    }
    const voll = stellentextVon(el);
    if (voll.length > 0) {
      block("absatz", voll, textstelle(voll), voll);
    }
  };

  const besuche = (el: Element): void => {
    for (const kind of Array.from(el.children)) {
      const name = kind.tagName.toLowerCase();
      if (/^h[1-6]$/.test(name)) {
        const titel = stellentextVon(kind);
        const n = (ueberschriften.get(titel) ?? 0) + 1;
        ueberschriften.set(titel, n);
        abschnittVoll = n === 1 ? titel : `${titel} (${n})`;
        abschnitt = textstelle(abschnittVoll);
        continue;
      }
      if (name === "table") {
        const voll = stellentextVon(kind);
        if (voll.length > 0) {
          block("tabelle", voll, textstelle(voll), voll);
        }
        continue;
      }
      if (name === "img") {
        bild(kind, el);
        continue;
      }
      if (name === "figure") {
        const img = kind.querySelector("img");
        if (img) {
          bild(img, kind);
        }
        continue;
      }
      if (name === "p" || name === "pre") {
        absatz(kind);
        continue;
      }
      if (name === "li" && !kind.querySelector(BLOCK_IN_LISTENPUNKT)) {
        absatz(kind);
        continue;
      }
      besuche(kind);
    }
  };
  besuche(dokument.body);
  return bloecke;
}

/** Die Stelle eines Blocks, gebunden an die Fassung, in der sie gewählt wurde. */
export function stelleAus(block: Stellenblock, koVersion: number): KoDiskussionsStelle {
  return {
    koVersion,
    art: block.art,
    abschnitt: block.abschnitt,
    text: block.text,
    fingerabdruck: block.fingerabdruck,
  };
}

/**
 * Wo steht die gespeicherte Stelle in der angezeigten Fassung? Nur Gleichheit, nie Ähnlichkeit.
 *
 * DIE IDENTITÄT IST DER FINGERABDRUCK über den VOLLSTÄNDIGEN Inhalt (BEN, Nacharbeit 3): ein
 * Vergleich nur der gekürzten Textstelle erklärte einen anderen Absatz mit demselben Anfang für
 * „eindeutig". Fehlt der Abdruck, ist die Identität nicht belegbar — dann „Zuordnung prüfen".
 */
export function stelleZuordnen(
  stelle: KoDiskussionsStelle,
  bloecke: readonly Stellenblock[],
  angezeigteVersion: number,
): Stellenlage {
  if (typeof stelle.fingerabdruck !== "string" || stelle.fingerabdruck.length === 0) {
    return { lage: "unklar" };
  }
  const treffer = bloecke.filter(
    (b) =>
      b.art === stelle.art &&
      b.abschnitt === stelle.abschnitt &&
      b.fingerabdruck === stelle.fingerabdruck,
  );
  const [einziger] = treffer;
  if (treffer.length !== 1 || !einziger) {
    return { lage: "unklar" };
  }
  return stelle.koVersion === angezeigteVersion
    ? { lage: "dieseFassung", block: einziger }
    : { lage: "eindeutig", block: einziger };
}

// P-WIKI-STELLENBEZUG — DER ANKER EINER RÜCKFRAGE AN ABSATZ, TABELLE ODER BILD.
//
// EIGENES MODUL und kein Umbau von `source-anchor.ts`: dort hängt ein Anker an der ANHANGSLISTE,
// hier an einer Stelle im TEXT einer bestimmten Fassung. Zwei verschiedene Fragen.
//
// DER DIENST PRÜFT ZWEI DINGE:
//   1. die FORM (`leseStelle`) — sonst stünde später ein Anker im Bestand, den keine Fläche lesen kann;
//   2. dass der Anker in der Fassung, an die er gebunden wird, GENAU EINEN VORHANDENEN BLOCK bestimmt
//      (`stelleImInhalt`): Art, Abschnitt, Anzeigezitat und Fingerabdruck des vollständigen Inhalts
//      ZUSAMMEN. Bis Nacharbeit 3 genügte, dass das Zitat irgendwo im Klartext stand — damit nahm der
//      Dienst etwa einen Tabellenanker im Abschnitt „B" an, obwohl es weder Tabelle noch Abschnitt B
//      gab (BEN). Eine solche Stelle wäre schon in ihrer Ursprungsfassung nicht erreichbar.
//
// WAS ER NICHT TUT: die Stelle in einer SPÄTEREN Fassung wiederfinden. Das rechnet die Fläche
// (`apps/web/src/lib/stellenbezug.ts`) am gezeichneten Text, über Gleichheit und nie über Ähnlichkeit.
// Gespeichert bleibt immer der ursprüngliche Anker — er wird nie umgehängt.
//
// DIE BLOCKREGELN UND DIE TEXTNORMALFORM SIND DIESELBEN WIE IN DER FLÄCHE: Überschriften setzen den
// Abschnitt (Gleichnamige mit Zähler), Absatz = p/pre/Listenpunkt ohne Blockinhalt, Tabelle = table,
// Bild = img mit `data-image-id`; Inline-Auszeichnungen trennen keine Wörter, jede andere
// Elementgrenze ist ein Leerzeichen. Die Fläche liest über den Browser-Parser, der Dienst über den
// kleinen Baum unten; `tests/wiki-stellenbezug/zuordnung.test.tsx` hält beide Zerlegungen gleich.
import { decodeHtmlEntities } from "../../structure";
import { stellenFingerabdruck } from "./stellen-fingerabdruck";
import type { KoCommentStelle, KoStellenPunkt } from "./types";

/** Höchstlänge der gespeicherten Textstelle und der Abschnittskennung (Zeichen). */
export const STELLE_TEXT_MAX = 300;

const STELLEN_ARTEN: readonly KoCommentStelle["art"][] = ["absatz", "tabelle", "bild", "anhang"];

/** PLAN-SPRACHANMERKUNG — höchste annehmbare Seitenzahl eines Anhangs (Formgrenze, kein Seitenzähler). */
export const STELLE_SEITE_MAX = 10_000;

const FINGERABDRUCK_FORM = /^sha256:[0-9a-f]{64}$/;

// Dieselbe Menge wie `INLINE_ELEMENTE` in `apps/web/src/lib/stellenbezug.ts`.
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

// Elemente ohne Inhalt und ohne schliessendes Tag (HTML „void elements").
const LEERE_ELEMENTE = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

// Dieselbe Menge wie `BLOCK_IN_LISTENPUNKT` in der Fläche: ein Listenpunkt mit einem dieser
// Nachfahren ist kein Absatz, sondern ein Behälter.
const BLOCK_IN_LISTENPUNKT = new Set([
  "p",
  "ul",
  "ol",
  "table",
  "pre",
  "blockquote",
  "div",
  "figure",
]);

/** Leerraum zusammenziehen und Ränder abschneiden — die eine Normalform für Text und Abschnitt. */
export function normalisiereStellentext(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Die gespeicherte Textstelle: gekürzt auf die Höchstlänge, ohne halbes Zeichen am Ende. */
function textstelle(text: string): string {
  let kurz = text.slice(0, STELLE_TEXT_MAX);
  const letztes = kurz.charCodeAt(kurz.length - 1);
  if (letztes >= 0xd800 && letztes <= 0xdbff) {
    kurz = kurz.slice(0, -1);
  }
  return normalisiereStellentext(kurz);
}

interface Knoten {
  name: string;
  attrs: string;
  kinder: (Knoten | string)[];
}

/**
 * Ein kleiner Elementbaum aus dem gespeicherten (serverseitig sanitisierten) Inhalt. Kein
 * vollständiger HTML-Parser: er kennt leere Elemente, schliesst beim End-Tag bis zum passenden
 * offenen Element und überspringt Kommentare — genug für die wohlgeformte Ausgabe des Sanitizers.
 */
function baum(html: string): Knoten {
  const wurzel: Knoten = { name: "#wurzel", attrs: "", kinder: [] };
  const stapel: Knoten[] = [wurzel];
  const muster =
    /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
  for (const treffer of html.matchAll(muster)) {
    const ganz = treffer[0];
    const zu = treffer[1];
    const name = treffer[2];
    const attrs = treffer[3] ?? "";
    const oben = stapel[stapel.length - 1] ?? wurzel;
    if (ganz.startsWith("<!--")) {
      continue;
    }
    if (name === undefined) {
      oben.kinder.push(decodeHtmlEntities(ganz));
      continue;
    }
    const klein = name.toLowerCase();
    if (zu === "/") {
      const tiefe = stapel.map((k) => k.name).lastIndexOf(klein);
      if (tiefe > 0) {
        stapel.length = tiefe;
      }
      continue;
    }
    const knoten: Knoten = { name: klein, attrs, kinder: [] };
    oben.kinder.push(knoten);
    if (!LEERE_ELEMENTE.has(klein) && !attrs.trimEnd().endsWith("/")) {
      stapel.push(knoten);
    }
  }
  return wurzel;
}

function elemente(k: Knoten): Knoten[] {
  return k.kinder.filter((x): x is Knoten => typeof x !== "string");
}

/** Alle Nachfahren in Dokumentreihenfolge. */
function nachfahren(k: Knoten): Knoten[] {
  const aus: Knoten[] = [];
  for (const kind of elemente(k)) {
    aus.push(kind, ...nachfahren(kind));
  }
  return aus;
}

function stellentextVon(k: Knoten): string {
  let aus = "";
  const lauf = (n: Knoten | string): void => {
    if (typeof n === "string") {
      aus += n;
      return;
    }
    const inline = INLINE_ELEMENTE.has(n.name);
    if (!inline) {
      aus += " ";
    }
    for (const kind of n.kinder) {
      lauf(kind);
    }
    if (!inline) {
      aus += " ";
    }
  };
  lauf(k);
  return normalisiereStellentext(aus);
}

const BILD_KENNUNG = /(?:^|\s)data-image-id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

function bildKennung(img: Knoten): string {
  const wert = BILD_KENNUNG.exec(img.attrs);
  return decodeHtmlEntities(wert?.[1] ?? wert?.[2] ?? wert?.[3] ?? "");
}

/** Eine Stelle einer Fassung, wie der Dienst sie sieht (ohne Anzeigetext). */
export interface DienstStellenblock {
  art: KoCommentStelle["art"];
  abschnitt: string;
  text: string;
  fingerabdruck: string;
}

/** Die Stellen einer Fassung, in Lesereihenfolge — dieselben Regeln wie `stellenbloecke` der Fläche. */
export function stellenbloeckeAusHtml(bodyHtml: string | null | undefined): DienstStellenblock[] {
  const html = bodyHtml ?? "";
  if (html.trim().length === 0) {
    return [];
  }
  const bloecke: DienstStellenblock[] = [];
  const ueberschriften = new Map<string, number>();
  let abschnitt = "";
  let abschnittVoll = "";

  const block = (art: KoCommentStelle["art"], inhaltVoll: string, text: string): void => {
    bloecke.push({
      art,
      abschnitt,
      text,
      fingerabdruck: stellenFingerabdruck(art, abschnittVoll, inhaltVoll),
    });
  };

  const bild = (img: Knoten): void => {
    const kennung = bildKennung(img);
    if (kennung.length > 0) {
      block("bild", kennung, kennung);
    }
  };

  const absatz = (k: Knoten): void => {
    for (const img of nachfahren(k).filter((n) => n.name === "img")) {
      bild(img);
    }
    const voll = stellentextVon(k);
    if (voll.length > 0) {
      block("absatz", voll, textstelle(voll));
    }
  };

  const besuche = (k: Knoten): void => {
    for (const kind of elemente(k)) {
      const name = kind.name;
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
          block("tabelle", voll, textstelle(voll));
        }
        continue;
      }
      if (name === "img") {
        bild(kind);
        continue;
      }
      if (name === "figure") {
        const img = nachfahren(kind).find((n) => n.name === "img");
        if (img) {
          bild(img);
        }
        continue;
      }
      if (name === "p" || name === "pre") {
        absatz(kind);
        continue;
      }
      if (name === "li" && !nachfahren(kind).some((n) => BLOCK_IN_LISTENPUNKT.has(n.name))) {
        absatz(kind);
        continue;
      }
      besuche(kind);
    }
  };
  besuche(baum(html));
  return bloecke;
}

/**
 * Die Form einer mitgeschickten Stelle. `undefined` = keine Stelle mitgeschickt;
 * `"unlesbar"` = etwas mitgeschickt, das keine Stelle ist (die Route antwortet 400, statt es still
 * fallen zu lassen — sonst würde aus einer Rückfrage an einen Absatz lautlos eine an das Dokument).
 */
export function leseStelle(roh: unknown): KoCommentStelle | "unlesbar" | undefined {
  if (roh === undefined) {
    return undefined;
  }
  if (!roh || typeof roh !== "object") {
    return "unlesbar";
  }
  const felder = roh as Record<string, unknown>;
  const { koVersion, art, abschnitt, text, fingerabdruck, punkt, seite } = felder;
  if (typeof koVersion !== "number" || !Number.isInteger(koVersion) || koVersion < 1) {
    return "unlesbar";
  }
  if (typeof art !== "string" || !STELLEN_ARTEN.includes(art as KoCommentStelle["art"])) {
    return "unlesbar";
  }
  if (typeof abschnitt !== "string" || typeof text !== "string") {
    return "unlesbar";
  }
  if (typeof fingerabdruck !== "string" || !FINGERABDRUCK_FORM.test(fingerabdruck)) {
    return "unlesbar";
  }
  const abschnittNorm = normalisiereStellentext(abschnitt);
  const textNorm = normalisiereStellentext(text);
  if (
    textNorm.length === 0 ||
    textNorm.length > STELLE_TEXT_MAX ||
    abschnittNorm.length > STELLE_TEXT_MAX
  ) {
    return "unlesbar";
  }
  const punktForm = lesePunkt(punkt);
  // Eine Position gibt es nur in einer Zeichnung (Bild im Text oder Anhang); an Absatz oder Tabelle
  // wäre sie eine Angabe ohne Ort.
  const zeichnung = art === "bild" || art === "anhang";
  if (punktForm === "unlesbar" || (punktForm !== undefined && !zeichnung)) {
    return "unlesbar";
  }
  // PLAN-SPRACHANMERKUNG: eine Seite nur an einem Anhang, ganzzahlig ab 1. Ein Anhang hat keinen
  // Abschnitt — ein mitgeschickter wäre eine Ortsangabe, die niemand prüfen kann.
  if (
    seite !== undefined &&
    (art !== "anhang" ||
      typeof seite !== "number" ||
      !Number.isInteger(seite) ||
      seite < 1 ||
      seite > STELLE_SEITE_MAX)
  ) {
    return "unlesbar";
  }
  if (art === "anhang" && abschnittNorm.length > 0) {
    return "unlesbar";
  }
  // Feste Schlüsselreihenfolge: der Dienst vergleicht Stellen beim Wiederholungsschutz.
  return {
    koVersion,
    art: art as KoCommentStelle["art"],
    abschnitt: abschnittNorm,
    text: textNorm,
    fingerabdruck,
    ...(typeof seite === "number" ? { seite } : {}),
    ...(punktForm ? { punkt: punktForm } : {}),
  };
}

/**
 * PLAN-SPRACHANMERKUNG — trägt das Objekt GENAU EINEN Anhang mit dieser Kennung, und passt der
 * Abdruck? Dieselbe Strenge wie `stelleImInhalt`: kein Treffer (erfunden, entfernt) und mehrere
 * Treffer sind keine gültige Stelle. Die Seitenzahl prüft der Dienst nur der Form nach — er öffnet
 * das Dokument nicht; die Fläche bietet nur Seiten an, die das Dokument hat.
 */
export function stelleAmAnhang(
  anhaenge: readonly { objectId?: string }[] | undefined,
  stelle: KoCommentStelle,
): boolean {
  if (stelle.art !== "anhang" || stelle.abschnitt.length > 0) {
    return false;
  }
  if (stelle.fingerabdruck !== stellenFingerabdruck("anhang", "", stelle.text)) {
    return false;
  }
  return (anhaenge ?? []).filter((a) => a.objectId === stelle.text).length === 1;
}

/** Nachkommastellen der gespeicherten Position — ein Zehntausendstel der Bildkante genügt. */
const PUNKT_STELLEN = 10_000;

/**
 * PLAN-SPRACHANMERKUNG — die Form einer mitgeschickten Position in einer Zeichnung. Beide Werte
 * relativ zum Bild, je 0..1 (Ränder eingeschlossen). Alles andere ist kein Ort im Bild und wird
 * abgelehnt, statt es still auf den Rand zu ziehen. Gespeichert wird auf vier Nachkommastellen.
 */
function lesePunkt(roh: unknown): KoStellenPunkt | "unlesbar" | undefined {
  if (roh === undefined) {
    return undefined;
  }
  if (!roh || typeof roh !== "object") {
    return "unlesbar";
  }
  const { x, y } = roh as Record<string, unknown>;
  const imBild = (w: unknown): w is number =>
    typeof w === "number" && Number.isFinite(w) && w >= 0 && w <= 1;
  if (!imBild(x) || !imBild(y)) {
    return "unlesbar";
  }
  return {
    x: Math.round(x * PUNKT_STELLEN) / PUNKT_STELLEN,
    y: Math.round(y * PUNKT_STELLEN) / PUNKT_STELLEN,
  };
}

/**
 * Bestimmt diese Stelle in diesem Inhalt GENAU EINEN vorhandenen Block? Art, Abschnitt,
 * Anzeigezitat und Fingerabdruck müssen zusammen passen. Kein Treffer (erfunden, falsche Art,
 * falscher Abschnitt) und mehr als ein Treffer (wortgleiche Blöcke) sind beide keine gültige Stelle.
 */
export function stelleImInhalt(
  bodyHtml: string | null | undefined,
  stelle: KoCommentStelle,
): boolean {
  const treffer = stellenbloeckeAusHtml(bodyHtml).filter(
    (b) =>
      b.art === stelle.art &&
      b.abschnitt === stelle.abschnitt &&
      b.text === stelle.text &&
      b.fingerabdruck === stelle.fingerabdruck,
  );
  return treffer.length === 1;
}

/** Sind zwei (fehlende oder vorhandene) Stellen dieselbe? */
export function gleicheStelle(
  a: KoCommentStelle | undefined,
  b: KoCommentStelle | undefined,
): boolean {
  if (!a || !b) {
    return !a && !b;
  }
  return (
    a.koVersion === b.koVersion &&
    a.art === b.art &&
    a.abschnitt === b.abschnitt &&
    a.text === b.text &&
    a.fingerabdruck === b.fingerabdruck &&
    a.seite === b.seite &&
    a.punkt?.x === b.punkt?.x &&
    a.punkt?.y === b.punkt?.y
  );
}

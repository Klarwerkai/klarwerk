// ================================================================================================
// JOB 3014 — DER SCHNITTPLAN FÜR `taskpane.html`: DIE MESSGERÄTE.
// ================================================================================================
//
// P11 verlangt, das Word-Add-in in lesbare Teile zu zerlegen, OHNE Verhalten zu ändern. Solange
// niemand gemessen hat, woran „ohne Verhalten zu ändern" erkannt wird, ist jede Zerlegung ein
// Blindflug. Diese Datei enthält keine Zusicherung — sie enthält die Werkzeuge, mit denen die vier
// Testdateien daneben messen:
//
//   · `bloeckeVon`      — wo die Seite ihre Inline-Flächen hat (Stil, Skript) und was extern kommt.
//   · `markenVon`       — das vorhandene `KW-…-START/-END`-Skelett, als Daten statt als Absicht.
//   · `markenBaum`      — dasselbe Skelett auf Wohlgeformtheit geprüft (Stapel, kein Überkreuzen).
//   · `schneideDrei`    — der MECHANISCHE Probeschnitt: eine reine Textoperation, keine Handarbeit.
//
// BEWUSST OHNE ZEILENNUMMERN: an derselben Datei arbeiten JOB 3004/3010/3012/3013. Gemessen wird
// strukturell (Zahlen, Anteile, Namen), nie „Zeile 724".
//
// BEWUSST OHNE DOM-LIB: der Gate-tsc läuft Node-rein (`tsconfig.json`, `"lib": ["ES2022"]`).
// Alles hier ist reine Textarbeit; die DOM-Seite steht mit schmalen Struktur-Typen in
// `probeschnitt.test.ts` — dieselbe Bauform wie `tests/app/klara-panel-fixture.ts`.
import { readFileSync } from "node:fs";
import { repoPfad } from "../support/repoPfad";

/** Die eine Datei, um die es geht. In diesem Auftrag wird sie mit keinem Zeichen verändert. */
export const TASKPANE_RELATIV = "apps/web/public/word-addin/taskpane.html";

export function taskpaneQuelle(): string {
  return readFileSync(repoPfad(TASKPANE_RELATIV), "utf8");
}

// ------------------------------------------------------------------------------------------------
// 1. Die Blöcke: Inline-Stil, Inline-Skript, externe Quellen
// ------------------------------------------------------------------------------------------------

export interface Block {
  art: "style" | "script";
  /** Die externe Quelle (`src`), oder `null` für einen Inline-Block. */
  extern: string | null;
  /** Erstes Zeichen von `<style`/`<script`. */
  tagVon: number;
  /** Erstes Zeichen NACH dem Schlusstag. */
  tagBis: number;
  /** Erstes Zeichen des Inhalts (nach `>`). */
  inhaltVon: number;
  /** Erstes Zeichen des Schlusstags. */
  inhaltBis: number;
}

const OEFFNER = /<(style|script)\b([^>]*)>/gi;

/**
 * Alle `<style>`- und `<script>`-Blöcke der Seite, in Dokumentreihenfolge.
 *
 * Die Suche nach dem Schlusstag ist eine reine Textsuche — zulässig, weil der Inhalt eines
 * HTML-Skript- oder Stilelements per Spezifikation kein `</script>`/`</style>` enthalten DARF
 * (er würde das Element sonst beenden). Was ein Browser hier sieht, sieht diese Funktion auch.
 */
export function bloeckeVon(html: string): Block[] {
  const raus: Block[] = [];
  OEFFNER.lastIndex = 0;
  let treffer = OEFFNER.exec(html);
  while (treffer !== null) {
    const art = (treffer[1] ?? "").toLowerCase() === "style" ? "style" : "script";
    const attribute = treffer[2] ?? "";
    const inhaltVon = treffer.index + treffer[0].length;
    const schluss = `</${art}>`;
    const inhaltBis = html.indexOf(schluss, inhaltVon);
    if (inhaltBis < 0) {
      throw new Error(`${TASKPANE_RELATIV}: ${schluss} fehlt`);
    }
    const src = /\bsrc\s*=\s*"([^"]*)"/i.exec(attribute);
    raus.push({
      art,
      extern: src ? (src[1] ?? "") : null,
      tagVon: treffer.index,
      tagBis: inhaltBis + schluss.length,
      inhaltVon,
      inhaltBis,
    });
    OEFFNER.lastIndex = inhaltBis + schluss.length;
    treffer = OEFFNER.exec(html);
  }
  return raus;
}

export function inhaltVon(html: string, block: Block): string {
  return html.slice(block.inhaltVon, block.inhaltBis);
}

/** Genau die Blöcke, die ihren Code IN der Seite tragen (die Kandidaten für einen Schnitt). */
export function inline(bloecke: readonly Block[], art: Block["art"]): Block[] {
  return bloecke.filter((b) => b.art === art && b.extern === null);
}

export function bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

export function zeilen(text: string): number {
  return text.split("\n").length;
}

// ------------------------------------------------------------------------------------------------
// 2. Das Marken-Skelett
// ------------------------------------------------------------------------------------------------

export type Bereich = "markup" | "stil" | "skript";

export interface Marke {
  /** Ohne `-START`/`-END`, z. B. `KW-KA1-TERMS`. */
  name: string;
  art: "START" | "END";
  /** Zeichenposition in der Seite. */
  index: number;
  /** 1-basiert, NUR für die gedruckte Tabelle — nie Gegenstand einer Zusicherung. */
  zeile: number;
  bereich: Bereich;
}

/**
 * Eine Marke ist das ERSTE, was auf einer Zeile steht (nach Einrückung und einem optionalen
 * Kommentaröffner). Genau daran unterscheidet sich eine Marke von der ERWÄHNUNG einer Marke im
 * Fließtext eines Kommentars — die Datei enthält beides, und ein Sammler, der sie verwechselt,
 * meldet ein Überkreuzen, das es nicht gibt.
 */
const MARKENZEILE =
  /^[ \t]*(?:<!--[ \t]*)?(?:\/\/[ \t]*)?(KW-[A-Z0-9]+(?:-[A-Z0-9]+)*)-(START|END)\b/;

export function markenVon(html: string, bloecke: readonly Block[] = bloeckeVon(html)): Marke[] {
  const raus: Marke[] = [];
  let index = 0;
  let nummer = 1;
  for (const zeile of html.split("\n")) {
    const treffer = MARKENZEILE.exec(zeile);
    if (treffer !== null) {
      const start = index + zeile.indexOf("KW-");
      raus.push({
        name: treffer[1] ?? "",
        art: treffer[2] === "END" ? "END" : "START",
        index: start,
        zeile: nummer,
        bereich: bereichVon(start, bloecke),
      });
    }
    index += zeile.length + 1;
    nummer += 1;
  }
  return raus;
}

export function bereichVon(index: number, bloecke: readonly Block[]): Bereich {
  for (const b of bloecke) {
    if (b.extern === null && index >= b.inhaltVon && index < b.inhaltBis) {
      return b.art === "style" ? "stil" : "skript";
    }
  }
  return "markup";
}

/** Ein geschlossenes Markenpaar — ein Kandidat für ein herauslösbares Stück. */
export interface Spanne {
  name: string;
  bereich: Bereich;
  von: number;
  bis: number;
  zeileVon: number;
  zeileBis: number;
  /** Die Marke, in der diese Spanne liegt — oder `null`, wenn sie ganz oben steht. */
  eltern: string | null;
  /** Schachtelungstiefe, 0 = keine Elternmarke. */
  tiefe: number;
}

export interface Skelett {
  spannen: Spanne[];
  /** Wohlgeformtheitsverstöße im Klartext. Leer heißt: der Stapel geht sauber auf. */
  fehler: string[];
  /** Name → Zahl der Orte, an denen dieselbe Marke ein eigenes Paar aufmacht. */
  vorkommen: Map<string, number>;
}

/**
 * Prüft das Skelett per Stapel: jede geöffnete Marke wird geschlossen, in der richtigen Reihenfolge,
 * ohne Überkreuzen. Eine Marke, die an mehreren Orten je ein eigenes Paar aufmacht, ist KEIN
 * Verstoß — sie ist der tragende Befund für P11 und wird in `vorkommen` gezählt.
 */
export function markenBaum(marken: readonly Marke[]): Skelett {
  const stapel: Marke[] = [];
  const spannen: Spanne[] = [];
  const fehler: string[] = [];
  const vorkommen = new Map<string, number>();
  for (const marke of marken) {
    if (marke.art === "START") {
      stapel.push(marke);
      vorkommen.set(marke.name, (vorkommen.get(marke.name) ?? 0) + 1);
      continue;
    }
    const offen = stapel[stapel.length - 1];
    if (offen === undefined) {
      fehler.push(`${marke.name}-END (Zeile ${marke.zeile}) schließt eine nie geöffnete Marke`);
      continue;
    }
    if (offen.name !== marke.name) {
      fehler.push(
        `${marke.name}-END (Zeile ${marke.zeile}) überkreuzt die offene Marke ${offen.name} (seit Zeile ${offen.zeile})`,
      );
      continue;
    }
    stapel.pop();
    const eltern = stapel[stapel.length - 1];
    spannen.push({
      name: marke.name,
      bereich: offen.bereich,
      von: offen.index,
      bis: marke.index,
      zeileVon: offen.zeile,
      zeileBis: marke.zeile,
      eltern: eltern?.name ?? null,
      tiefe: stapel.length,
    });
  }
  for (const offen of stapel) {
    fehler.push(`${offen.name}-START (Zeile ${offen.zeile}) wird nie geschlossen`);
  }
  return { spannen, fehler, vorkommen };
}

// ------------------------------------------------------------------------------------------------
// 3. Der mechanische Probeschnitt
// ------------------------------------------------------------------------------------------------

export const CSS_DATEI = "taskpane.css";
export const JS_DATEI = "taskpane.js";

export interface Probeschnitt {
  /** Der Rest der Seite — mit `<link>` und `<script src>` an denselben Stellen. */
  html: string;
  css: string;
  js: string;
}

/**
 * Die Drei-Datei-Fassung, erzeugt als REINE TEXTOPERATION.
 *
 * Kein Zeichen des Stils und kein Zeichen des Skripts wird angefasst; die beiden Blöcke wandern
 * unverändert in eigene Dateien, und an ihrer Stelle bleibt genau der Verweis stehen, den ein
 * Browser an derselben Position gleich behandelt (klassische Skripte laufen in Dokumentreihenfolge).
 * Wäre hier Handarbeit nötig, wäre der Beweis wertlos — dann prüfte der Test die Handarbeit.
 */
export function schneideDrei(html: string): Probeschnitt {
  const bloecke = bloeckeVon(html);
  const stile = inline(bloecke, "style");
  const skripte = inline(bloecke, "script");
  if (stile.length !== 1 || skripte.length !== 1) {
    throw new Error(
      `${TASKPANE_RELATIV}: Der Probeschnitt setzt genau EINEN Inline-Stil und EIN Inline-Skript ` +
        `voraus; gefunden: ${stile.length} Stil-, ${skripte.length} Skriptblöcke.`,
    );
  }
  const stil = stile[0] as Block;
  const skript = skripte[0] as Block;
  const ersatz: Array<{ block: Block; text: string }> = [
    { block: stil, text: `<link rel="stylesheet" href="${CSS_DATEI}" />` },
    { block: skript, text: `<script src="${JS_DATEI}"></script>` },
  ].sort((a, b) => a.block.tagVon - b.block.tagVon);
  let rest = "";
  let gelesen = 0;
  for (const e of ersatz) {
    rest += html.slice(gelesen, e.block.tagVon) + e.text;
    gelesen = e.block.tagBis;
  }
  rest += html.slice(gelesen);
  return { html: rest, css: inhaltVon(html, stil), js: inhaltVon(html, skript) };
}

// ------------------------------------------------------------------------------------------------
// 4. Druckhilfe — die Befunde sind Testausgabe, kein Dokument (Auftrag §5.7).
// ------------------------------------------------------------------------------------------------

export function tabelle(
  kopf: readonly string[],
  zeilenDaten: ReadonlyArray<readonly string[]>,
): string {
  const alle = [kopf, ...zeilenDaten];
  const breiten = kopf.map((_, i) => Math.max(...alle.map((z) => (z[i] ?? "").length)));
  const linie = breiten.map((b) => "-".repeat(b)).join("-+-");
  const formatiert = alle.map((z) =>
    z.map((w, i) => (w ?? "").padEnd(breiten[i] ?? 0)).join(" | "),
  );
  const erste = formatiert[0] ?? "";
  return [erste, linie, ...formatiert.slice(1)].join("\n");
}

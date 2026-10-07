// P-WIKI-STELLENBEZUG — DER ANKER EINER RÜCKFRAGE AN ABSATZ, TABELLE ODER BILD.
//
// EIGENES MODUL und kein Umbau von `source-anchor.ts`: dort hängt ein Anker an der ANHANGSLISTE,
// hier an einer Stelle im TEXT einer bestimmten Fassung. Zwei verschiedene Fragen.
//
// DER DIENST PRÜFT ZWEI DINGE, UND NUR ZWEI:
//   1. die FORM (`leseStelle`) — sonst stünde später ein Anker im Bestand, den keine Fläche lesen kann;
//   2. dass die Textstelle in der Fassung, an die sie gebunden wird, WIRKLICH STEHT (`stelleImInhalt`).
//      Ein erfundenes Zitat würde sonst als Stelle des Dokuments ausgegeben.
//
// WAS ER NICHT TUT: die Stelle in einer SPÄTEREN Fassung wiederfinden. Das rechnet die Fläche
// (`apps/web/src/lib/stellenbezug.ts`) am gezeichneten Text, über Gleichheit und nie über Ähnlichkeit.
// Gespeichert bleibt immer der ursprüngliche Anker — er wird nie umgehängt.
//
// DIE TEXTNORMALFORM MUSS MIT DER FLÄCHE ÜBEREINSTIMMEN: Inline-Auszeichnungen (fett, kursiv,
// Verweis, …) trennen keine Wörter, jede andere Elementgrenze ist ein Leerzeichen, Leerraum wird
// zusammengezogen. `tests/wiki-stellenbezug/zuordnung.test.ts` (Z8) hält beide Seiten gegeneinander.
import { decodeHtmlEntities } from "../../structure";
import type { KoCommentStelle } from "./types";

/** Höchstlänge der gespeicherten Textstelle und der Abschnittskennung (Zeichen). */
export const STELLE_TEXT_MAX = 300;

const STELLEN_ARTEN: readonly KoCommentStelle["art"][] = ["absatz", "tabelle", "bild"];

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

/** Leerraum zusammenziehen und Ränder abschneiden — die eine Normalform für Text und Abschnitt. */
export function normalisiereStellentext(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Der Klartext des ganzen Inhalts in der Normalform der Stellen. Die Entitäten löst dieselbe
 * vollständige, einmalige Dekodierung auf, die der Import benutzt (`decodeHtmlEntities`) — so liest
 * der Dienst `&uuml;` als „ü", wie der Browser der Fläche es tut.
 */
export function stellenKlartext(bodyHtml: string): string {
  const ohneTags = bodyHtml.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g, (_tag, name: string) =>
    INLINE_ELEMENTE.has(name.toLowerCase()) ? "" : " ",
  );
  return normalisiereStellentext(decodeHtmlEntities(ohneTags));
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
  const { koVersion, art, abschnitt, text } = roh as Record<string, unknown>;
  if (typeof koVersion !== "number" || !Number.isInteger(koVersion) || koVersion < 1) {
    return "unlesbar";
  }
  if (typeof art !== "string" || !STELLEN_ARTEN.includes(art as KoCommentStelle["art"])) {
    return "unlesbar";
  }
  if (typeof abschnitt !== "string" || typeof text !== "string") {
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
  // Feste Schlüsselreihenfolge: der Dienst vergleicht Stellen beim Wiederholungsschutz.
  return {
    koVersion,
    art: art as KoCommentStelle["art"],
    abschnitt: abschnittNorm,
    text: textNorm,
  };
}

/** Steht diese Stelle in diesem Inhalt? Bild: über seine `data-image-id`; sonst über den Klartext. */
export function stelleImInhalt(
  bodyHtml: string | null | undefined,
  stelle: KoCommentStelle,
): boolean {
  const html = bodyHtml ?? "";
  if (stelle.art === "bild") {
    return (
      html.includes(`data-image-id="${stelle.text}"`) ||
      html.includes(`data-image-id='${stelle.text}'`)
    );
  }
  return stellenKlartext(html).includes(stelle.text);
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
    a.text === b.text
  );
}

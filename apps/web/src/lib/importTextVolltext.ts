// ================================================================================================
// JOB 3288 · IMPORT-VOLLTEXT — WAS DIE PRUEFKARTE VOM KANDIDATEN WIRKLICH WEISS.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI AUSGELOEST HAT (Codex-Livebefund df052186 auf 1.188): Die Prüfkarte
// des Confluence-Imports zeigte je Beitrag NUR `statement` — nach JOB 2703 der erste Absatz der
// Seite, höchstens 500 Zeichen. Bei den Advisor-Seiten ist der erste Absatz ein DEMO-Hinweis; Pedi
// sah also 36 Karten mit demselben Satz und musste blind annehmen. Der Volltext lag die ganze Zeit
// im Kandidaten (`bodyHtml`, Mapper `services/confluence/src/mapper.ts:155-160`) und wurde nie
// gezeigt, ebensowenig die Quelladresse.
//
// WARUM DIESE FELDER HIER LAUFZEIT-GEPRUEFT WERDEN UND NICHT EINFACH GETIPPT SIND. Der Draht trägt
// sie (`toImportCandidateDto` reicht `candidate.item` unverändert durch,
// `services/app/src/routes/library-routes.ts:92`), der Client-TYP `ImportItemInput`
// (`apps/web/src/api/types.ts:988`) kennt aber nur sechs Felder — `bodyHtml`, `url`, `sourceScope`
// und `provider` stehen dort nicht. Diese Datei liest sie deshalb defensiv aus dem gelieferten
// Objekt, statt einen zweiten, hoffnungsvollen Typ danebenzustellen: was nicht als nicht-leerer
// String ankommt, gilt als NICHT VORHANDEN und wird als solches gemeldet — nie als leerer Wert
// geglättet. Den Typ zu erweitern wäre der sauberere Weg und ist der benannte Folgeauftrag
// (`api/types.ts` liegt ausserhalb der Zielpfade dieses Auftrags).
//
// KEINE ENTITY-DEKODIERUNG AM `bodyHtml`. `displayImportText` (WP-IC-PAKET-1) heilt Altbestand in
// TEXT-Feldern, die als React-Textknoten landen. `bodyHtml` ist HTML und wird als HTML gerendert —
// dort sind `&uuml;` & Co. die korrekte Schreibweise, und ein zusätzlicher Decode-Lauf würde ein
// echtes Literal fälschlich in ein Zeichen verwandeln. Titel und Raum sind Textfelder und laufen
// deshalb sehr wohl durch `displayImportText`.
import { displayImportText } from "./htmlEntities";
import { htmlToPlainText } from "./richText";
import { safeHttpUrl } from "./safeUrl";

/** Ein nicht-leeres Textfeld des gelieferten Kandidaten-Items — oder `undefined`. */
function textfeld(quelle: unknown, name: string): string | undefined {
  if (typeof quelle !== "object" || quelle === null) {
    return undefined;
  }
  const wert = (quelle as Record<string, unknown>)[name];
  return typeof wert === "string" && wert.trim().length > 0 ? wert : undefined;
}

/** Der Decode-Marker des Kandidaten — nur der kanonische Wert zählt, alles andere ist Altbestand. */
function codec(quelle: unknown): "decoded" | undefined {
  return textfeld(quelle, "textCodec") === "decoded" ? "decoded" : undefined;
}

/**
 * Ab wann ein Volltext auf der Karte GEDECKELT angezeigt wird (Klartextzeichen, ohne Tags).
 *
 * Der Deckel ist eine Anzeigeentscheidung, keine Datenentscheidung: gekürzt wird NIE ohne
 * sichtbaren Hinweis und nie ohne den Weg zum ganzen Text („Mehr anzeigen"). 1200 Zeichen sind rund
 * eine Bildschirmseite — genug, um zu erkennen, worum es geht, ohne dass 36 Karten die Seite
 * unlesbar machen.
 */
export const VOLLTEXT_DECKEL_ZEICHEN = 1200;

export type ImportVolltextBefund =
  | { readonly art: "volltext"; readonly html: string; readonly lang: boolean }
  // „Dieser Kandidat trägt keinen Volltext" — eine Aussage, kein leerer Kasten. Tritt echt auf:
  // ein Apply-Lauf ohne `fetchItem`-fähigen Adapter reiht den Snapshot-Stand ohne `bodyHtml` ein
  // (`confluence-import-routes.ts`, `ohneBildauszug`).
  | { readonly art: "ohne-volltext" };

/**
 * Klartextlänge eines HTML-Rumpfs — gemessen an dem, was ein Mensch WIRKLICH liest.
 *
 * KEIN EIGENER REDUZIERER (mega84/mega85). Diese Zahl entsteht über `richText.htmlToPlainText`,
 * den kanonischen Klartext-Leser des Produkts: Block-ENDEN werden zum Leerzeichen, Inline-Tags
 * verschwinden spurlos, Entities werden zu genau einem Zeichen, Leerraum wird normalisiert. Eine
 * eigene „alle Tags → Leerzeichen"-Reduktion stand hier in der ersten Fassung; sie hätte für
 * `<strong>Ventil</strong>` drei Zeichen mehr gezählt als für `Ventil` und wäre ein sechster
 * Leser derselben Klasse gewesen — genau der Fehler, den mega85 erhoben hat.
 */
export function volltextKlartextLaenge(html: string): number {
  return htmlToPlainText(html).length;
}

export function importVolltextBefund(item: unknown): ImportVolltextBefund {
  const html = textfeld(item, "bodyHtml");
  if (html === undefined) {
    return { art: "ohne-volltext" };
  }
  return { art: "volltext", html, lang: volltextKlartextLaenge(html) > VOLLTEXT_DECKEL_ZEICHEN };
}

export interface ImportQuellangabe {
  /** Die klickbare Adresse — NUR eine absolute http/https-URL (`safeHttpUrl`), sonst `null`. */
  readonly href: string | null;
  /** Die gespeicherte Adresse, wie sie da steht — auch wenn sie nicht klickbar ist. */
  readonly rohUrl: string | null;
  readonly titel: string | null;
  /** Der Quellcontainer (Confluence: der Space) — quellneutral `sourceScope`/`category`. */
  readonly raum: string | null;
}

/**
 * Titel, Raum und Adresse der Quelle dieses Kandidaten.
 *
 * DREI ZUSTAENDE, NICHT ZWEI: eine sichere Adresse (klickbar), eine gespeicherte, aber unsichere
 * Adresse (sichtbar als Text, NIE klickbar — Altdaten mit `javascript:`/`data:`/relativ), und gar
 * keine Adresse. Die Fläche formuliert für alle drei einen eigenen Satz; „kein Link" und „Link
 * unterdrückt" sind für den Prüfenden nicht dasselbe.
 *
 * Der Raum kommt aus `sourceScope` und fällt auf `category` zurück — beim Confluence-Import trägt
 * `category` denselben Space (Mapper), bei Altbestand ist es das einzige Feld, das ihn kennt.
 */
export function importQuellangabe(item: unknown): ImportQuellangabe {
  const marke = codec(item);
  const rohUrl = textfeld(item, "url") ?? null;
  const titelRoh = textfeld(item, "title");
  const raumRoh = textfeld(item, "sourceScope") ?? textfeld(item, "category");
  return {
    href: safeHttpUrl(rohUrl),
    rohUrl,
    titel: titelRoh === undefined ? null : displayImportText(titelRoh, marke),
    raum: raumRoh === undefined ? null : displayImportText(raumRoh, marke),
  };
}

// ================================================================================================
// R-0098 (inhaltskennung-zweitbegriff) — DIE INHALTSKENNUNG IST EIN ZWEITER BEGRIFF, KEIN ANKER.
// ================================================================================================
//
// Die Entscheidung vom 13.08. („Server vergibt, abgeleitet aus dem Bildinhalt: dasselbe Bild trägt
// überall dieselbe Kennung") stand gegen R-0089, R-1620/V8 und R-0053: zwei Vorkommen desselben
// Bildes brauchen zwei verschiedene Anker, sonst trifft der Klick oder die Fußnote das falsche.
// Aufgelöst durch entscheidung:1019d7a6-dd79-4a60-b86f-8ca96d3da925: Die Inhaltskennung wird
// NEBEN dem Vorkommensanker geführt (etwa für die Dublettenerkennung) und ersetzt ihn nicht.
//
// DARAUS FOLGT DIE BAUFORM:
//   · Die Inhaltskennung steht NICHT im Rumpf. `data-image-id` (Browser: `newImageRunToken`,
//     Server: `kw-fig-N`) bleibt der einzige Anker am Bild; Sanitizer, Editor, Galerie und
//     Bildsuche paaren und klicken weiter ausschließlich über ihn.
//   · Gespeichert wird sie als eigenes, abgeleitetes Feld am Wissensobjekt (`bildInhalte`), je
//     Bild ein Eintrag: welcher Vorkommensanker, welcher Inhalt. Zwei Vorkommen desselben Bildes
//     sind damit zwei Einträge mit verschiedenem `imageId` und gleicher `inhaltskennung`.
//   · Ihre Form `sha256:<64 hex>` enthält einen Doppelpunkt und ist damit KEIN gültiges
//     Anker-Token (`isImageAnchorId`, `[\w-]{1,64}`). Wer sie als `data-image-id` einsetzt, dem
//     verwirft der Sanitizer sie mit der Spur „ungueltig". Sie kann den Anker also nicht einmal
//     versehentlich vertreten.
//
// ABGELEITET WIRD AUS DEN BYTES, nicht aus der Zeichenkette: dieselben Bytes in anderer
// base64-Umbrechung sind derselbe Inhalt. Byte-Gleichheit ist die ganze Zusage — ein neu
// kodiertes oder verkleinertes Bild ist ein anderer Inhalt; eine Ähnlichkeitsprüfung ist das nicht.

import { createHash } from "node:crypto";
import { attributWert } from "./captions";
import { IMAGE_ANCHOR_ATTR, isImageAnchorId } from "./sanitize";

export const INHALTSKENNUNG_PRAEFIX = "sha256:";

/** Ein Bild des Rumpfes: sein Vorkommensanker und die Kennung seines Inhalts. */
export interface BildInhalt {
  /** Der Vorkommensanker (`data-image-id`); `null`, solange das Bild noch keinen trägt. */
  imageId: string | null;
  /**
   * Die Kennung des Bildinhalts (`sha256:<hex>`); `null`, wenn der Inhalt nicht lesbar war — ein
   * Objekt-Store-Bild, dessen Objekt fehlt oder nicht dekodierbar ist.
   */
  inhaltskennung: string | null;
}

/** Löst ein Objekt-Store-Bild (`/api/objects/<id>/raw`) in seine gespeicherte data-URL auf. */
export type BildObjektDaten = (objectId: string) => Promise<string | undefined>;

const DATA_URL_RE = /^data:[^;,]+;base64,([\s\S]*)$/;
const OBJEKT_QUELLE_RE = /^\/api\/objects\/([\w-]+)\/raw$/;

export function inhaltskennungAusBytes(bytes: Uint8Array): string {
  return `${INHALTSKENNUNG_PRAEFIX}${createHash("sha256").update(bytes).digest("hex")}`;
}

/** Die Inhaltskennung einer base64-data-URL — `null` für alles andere. */
export function inhaltskennungAusDatenUrl(dataUrl: string): string | null {
  const m = DATA_URL_RE.exec(dataUrl.trim());
  if (!m) {
    return null;
  }
  return inhaltskennungAusBytes(Buffer.from(m[1] ?? "", "base64"));
}

/**
 * Die Bildinhalte eines (sanitisierten) Rumpfes in Dokumentreihenfolge — das persistierte Feld
 * `bildInhalte`.
 *
 * Jedes Bild ergibt genau einen Eintrag, auch ein mehrfach vorkommendes: die Zuordnung „welcher
 * Anker trägt welchen Inhalt" ist genau die Auskunft, die eine Dublettenerkennung braucht. Ein
 * eingebettetes Bild wird aus seiner data-URL abgeleitet, ein Objekt-Store-Bild aus den Bytes des
 * Objekts (`objektDaten`, je Objekt einmal gelesen). Fehlt der Leser oder das Objekt, ist die
 * Inhaltskennung `null` — nicht geraten.
 *
 * Wie `searchImageNames` (captions.ts) sucht der Lauf nur die Marke und liest die Attribute über
 * die Tag-Grenzen; ein eingebettetes base64-Bild wird nicht kopiert, bevor es gehasht wird.
 */
export async function bildInhalteAusRumpf(
  bodyHtml: string | null | undefined,
  objektDaten?: BildObjektDaten,
): Promise<BildInhalt[]> {
  if (!bodyHtml) {
    return [];
  }
  const aus: BildInhalt[] = [];
  const objekte = new Map<string, Promise<string | null>>();
  const marke = /<img\b/gi;
  while (marke.exec(bodyHtml) !== null) {
    const nachMarke = marke.lastIndex;
    const ende = bodyHtml.indexOf(">", nachMarke);
    if (ende < 0) {
      break;
    }
    marke.lastIndex = ende + 1;
    const src = attributWert(bodyHtml, "src", nachMarke, ende);
    if (src === null) {
      continue;
    }
    const anker = attributWert(bodyHtml, IMAGE_ANCHOR_ATTR, nachMarke, ende);
    const imageId = anker !== null && isImageAnchorId(anker) ? anker : null;
    const objekt = OBJEKT_QUELLE_RE.exec(src.trim());
    if (objekt) {
      const objectId = objekt[1] as string;
      let kennung = objekte.get(objectId);
      if (kennung === undefined) {
        kennung = objektDaten
          ? objektDaten(objectId).then(
              (daten) => (daten ? inhaltskennungAusDatenUrl(daten) : null),
              () => null,
            )
          : Promise.resolve(null);
        objekte.set(objectId, kennung);
      }
      aus.push({ imageId, inhaltskennung: await kennung });
      continue;
    }
    aus.push({ imageId, inhaltskennung: inhaltskennungAusDatenUrl(src) });
  }
  return aus;
}

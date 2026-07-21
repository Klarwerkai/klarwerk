// WP-BILD-1d (Pedis Galerie-Feature): Bilder des Beitrags aus dem SANITISIERTEN bodyHtml ableiten —
// KEINE neue Persistenz, keine Kopie: Quelle sind die figures, die DOCX- (BILD-1a/1b) und PPTX-Import
// (WP-D9) einheitlich liefern (<figure><img data-image-id=… src=…><figcaption data-image-id=…>…</figcaption>
// </figure>). Die Fußnote in der Galerie ist damit IMMER die aktuelle figcaption des Bodys. DOM-frei
// (Regex auf dem bereits sanitisierten Allowlist-HTML) → im Node-Gate testbar.

// WP-D10: Altlast-Platzhaltertexte gelten als „ohne Beschreibung" — zentrale Liste aus editorFigures.
import { LEGACY_IMAGE_CAPTION_PLACEHOLDERS } from "./editorFigures";
// WP-D9c (Galerie-Auflage 3): defensive src-Grenze — dieselbe ZENTRALE Policy wie der Sanitizer
// (Object-Store-raw oder sichere Raster-data-URLs; kein javascript:, kein SVG, kein Remote-http).
import { isSafeImgSrc } from "./richText";

export interface BodyImage {
  id: string;
  src: string;
  caption: string; // Klartext der aktuellen figcaption (leer, wenn keine vorhanden)
}

// Spiegel des Sanitizer-Token-Vertrags (richText/services-structure: [\w-]{1,64}) — hier nur GELESEN,
// der Vertrag selbst bleibt unangetastet. Nur Bilder MIT gültiger data-image-id gehören in die Galerie.
const IMAGE_ID_TOKEN_RE = /^[\w-]{1,64}$/;

// Attributwert im Tag — Whitespace VOR dem Namen ist Pflicht: \b allein würde in „data-src" das innere
// „src" treffen (Bindestrich ist Wortgrenze) und ein data-src-Attribut fälschlich als Quelle lesen.
// Teil C2 (bens P2-Nacharbeit, Parser-Härtung — Verhalten unverändert, nur robuster):
//  - Attribut-Reihenfolge war schon immer egal (Suche im ganzen Tag), jetzt zusätzlich:
//  - beliebiger Whitespace inkl. Zeilenumbrüche um `=` (\s deckt \n/\t ab — explizit getestet),
//  - UNQUOTED-Werte (src=/api/…) als dritte Alternative — HTML erlaubt sie, der Wert endet am
//    nächsten Whitespace/`>`,
//  - der Name selbst wird escaped-frei nur mit [\w-]-Namen aufgerufen (image-id/src) und muss
//    VOLLSTÄNDIG stehen: nach dem Namen folgt direkt `=` (ggf. mit Whitespace) — ein Attribut
//    `srcset` kann `src` daher nicht fälschlich bedienen.
function attrOf(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

// figcaption-Inhalt → Klartext: Tags raus, die Sanitizer-Entities zurückübersetzen, Whitespace glätten.
// WP-D10: exakt einer der drei Alt-Platzhaltertexte ist KEINE Beschreibung → leerer String (die Galerie
// behandelt das Bild dann ehrlich als „ohne Beschreibung", identisch zu einer leeren Fußnote).
function captionText(figureInner: string): string {
  const m = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(figureInner);
  const raw = m?.[1] ?? "";
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return LEGACY_IMAGE_CAPTION_PLACEHOLDERS.includes(text) ? "" : text;
}

export function extractBodyImages(bodyHtml: string | null | undefined): BodyImage[] {
  const out: BodyImage[] = [];
  if (!bodyHtml) {
    return out;
  }
  // Frische Regex je Aufruf (kein geteilter lastIndex-Zustand über Aufrufe hinweg).
  const figureRe = /<figure\b[^>]*>([\s\S]*?)<\/figure>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = figureRe.exec(bodyHtml)) !== null) {
    const inner = m[1] ?? "";
    const imgTag = /<img\b[^>]*>/i.exec(inner)?.[0];
    if (!imgTag) {
      continue;
    }
    const id = attrOf(imgTag, "data-image-id");
    const src = attrOf(imgTag, "src");
    // Ohne gültige data-image-id (oder ohne src) kein Galerie-Eintrag — die Galerie zeigt nur die
    // verankerten Import-Bilder (Fußnoten-Vertrag), keine losen Alt-Bilder. WP-D9c: die src läuft
    // zusätzlich durch die zentrale isSafeImgSrc-Policy (Legacy-Daten/Repo-Importe fail-closed).
    if (!id || !IMAGE_ID_TOKEN_RE.test(id) || !src || !isSafeImgSrc(src)) {
      continue;
    }
    out.push({ id, src, caption: captionText(inner) });
  }
  return out;
}

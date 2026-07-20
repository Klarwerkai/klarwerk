// WP-BILD-1d (Pedis Galerie-Feature): Bilder des Beitrags aus dem SANITISIERTEN bodyHtml ableiten —
// KEINE neue Persistenz, keine Kopie: Quelle sind die figures, die DOCX- (BILD-1a/1b) und PPTX-Import
// (WP-D9) einheitlich liefern (<figure><img data-image-id=… src=…><figcaption data-image-id=…>…</figcaption>
// </figure>). Die Fußnote in der Galerie ist damit IMMER die aktuelle figcaption des Bodys. DOM-frei
// (Regex auf dem bereits sanitisierten Allowlist-HTML) → im Node-Gate testbar.

export interface BodyImage {
  id: string;
  src: string;
  caption: string; // Klartext der aktuellen figcaption (leer, wenn keine vorhanden)
}

// Spiegel des Sanitizer-Token-Vertrags (richText/services-structure: [\w-]{1,64}) — hier nur GELESEN,
// der Vertrag selbst bleibt unangetastet. Nur Bilder MIT gültiger data-image-id gehören in die Galerie.
const IMAGE_ID_TOKEN_RE = /^[\w-]{1,64}$/;

function attrOf(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

// figcaption-Inhalt → Klartext: Tags raus, die Sanitizer-Entities zurückübersetzen, Whitespace glätten.
function captionText(figureInner: string): string {
  const m = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(figureInner);
  const raw = m?.[1] ?? "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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
    // verankerten Import-Bilder (Fußnoten-Vertrag), keine losen Alt-Bilder.
    if (!id || !IMAGE_ID_TOKEN_RE.test(id) || !src) {
      continue;
    }
    out.push({ id, src, caption: captionText(inner) });
  }
  return out;
}

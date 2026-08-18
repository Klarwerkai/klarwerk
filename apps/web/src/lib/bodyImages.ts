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
// AUFTRAG-mega89 Block B: bekommt jetzt den Fußnoten-INHALT direkt (der Zerleger unten liefert ihn),
// statt ihn ein zweites Mal aus einem figure-Abschnitt herauszusuchen.
function captionText(raw: string): string {
  const text = raw
    // AUFTRAG-mega84 Block B: siehe librarySearch.ts — ein Umbruch ist eine Wortgrenze und bleibt
    // ein Leerzeichen, Auszeichnung ist keine und verschwindet spurlos. Sonst läse die Galerie
    // dieselbe Beschreibung je nach Formatierung anders („Ventil V2 ," statt „Ventil V2,").
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return LEGACY_IMAGE_CAPTION_PLACEHOLDERS.includes(text) ? "" : text;
}

// AUFTRAG-mega89 Block B — DIE GALERIE VERLOR BEI VERSCHACHTELUNG EIN BILD.
//
// DER BEFUND (ben in sammel88, am Quelltext nachgemessen): hier stand
// `/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi` — NICHT-GIERIG. Lag eine figure IN einer figure, endete
// der Abschnitt der ÄUSSEREN am INNEREN `</figure>`. Das erste Bild wurde mit der ersten INNEREN
// Fußnote kombiniert (falsche Beschreibung), und der zweite Eintrag ging ganz verloren. Zusätzlich
// nahm der Zerleger je figure nur DAS ERSTE Bild — eine eingehende Word-figure mit zwei Bildern
// lieferte also auch ohne Verschachtelung nur einen Eintrag.
//
// DIE ANTWORT: ein Durchgang über die vier Marken `<figure>`, `</figure>`, `<img>` und die ganze
// `<figcaption>…</figcaption>`, mit einem TIEFENZÄHLER. Ein Bild zählt, wenn es INNERHALB einer
// figure steht (der Vertrag „nur verankerte Bilder", unverändert); gepaart wird je ÄUSSERSTER figure
// über die stabile gemeinsame `data-image-id` — nie über die Verschachtelung.
//
// DER RÜCKFALL IST BEWUSST ENG, damit kein Text an ein falsches Bild wandert:
//   · Eine Fußnote OHNE Kennung geht der Reihe nach an das nächste noch unversorgte Bild. Das trägt
//     den Altbestand aus der Zeit vor WP-BILD-1b und ist genau die mega89-Regel „die vorhandene
//     Fußnote gehört dem ersten Bild".
//   · Eine fremd gekennzeichnete Fußnote wird NICHT geraten: das Bild bleibt ohne Beschreibung.
//     Eine geratene Zuordnung ist genau der Schaden, den dieser Auftrag abstellt.
//
// JOB 916 — HIER STAND EINE AUSNAHME FÜR DIE EINZELZAHL, UND SIE IST ABGELÖST. Sie lautete: steht
// in der Gruppe GENAU EIN Bild, bekommt es die verbleibende Fußnote auch bei ABWEICHENDER Kennung
// (`|| bilder.length === 1`), weil „die Fußnote dieser figure" dort eindeutig sei. Eindeutig war
// aber nur die STELLE, nicht die ZUGEHÖRIGKEIT: eine Fußnote, die eine fremde `data-image-id`
// trägt, sagt ausdrücklich, zu welchem Bild sie gehört — und das ist ein anderes. Die Galerie zeigte
// unter dem Bild eine Beschreibung, die nachweislich nicht seine war.
//
// Damit gilt die Regel jetzt unabhängig von der Anzahl, und Editor und Galerie sprechen weiterhin
// dieselbe: der Zwilling im Editor ist die ebenfalls abgelöste Stufe 2b (`editorFigures.ts`).
const MARKEN_QUELLE =
  "<figure\\b[^>]*>|</figure\\s*>|<img\\b[^>]*>|(<figcaption\\b[^>]*>)([\\s\\S]*?)</figcaption>";

interface GalerieBild {
  id: string;
  src: string;
}
interface GalerieFussnote {
  id: string | null;
  text: string;
}

export function extractBodyImages(bodyHtml: string | null | undefined): BodyImage[] {
  const out: BodyImage[] = [];
  if (!bodyHtml) {
    return out;
  }
  let bilder: GalerieBild[] = [];
  let fussnoten: GalerieFussnote[] = [];

  /** Eine äußerste figure ist zu Ende: ihre Bilder mit ihren Fußnoten paaren. */
  const gruppeAbschliessen = (): void => {
    const belegt = fussnoten.map(() => false);
    const texte: (string | null)[] = bilder.map(() => null);
    bilder.forEach((bild, i) => {
      const k = fussnoten.findIndex((f, j) => !belegt[j] && f.id === bild.id);
      if (k >= 0) {
        belegt[k] = true;
        texte[i] = fussnoten[k]?.text ?? "";
      }
    });
    bilder.forEach((_bild, i) => {
      if (texte[i] !== null) {
        return;
      }
      // JOB 916: hier stand zusätzlich `|| bilder.length === 1`. Die Bedingung ist ENTFERNT — sie
      // gab dem einzigen Bild einer figure die verbleibende Fußnote auch dann, wenn deren Kennung
      // auf ein ANDERES Bild zeigte. Was bleibt, ist die zulässige Altfallzuordnung: eine Fußnote
      // ohne Kennung geht der Reihe nach an das nächste unversorgte Bild.
      const k = fussnoten.findIndex((f, j) => !belegt[j] && (f.id === null || f.id === ""));
      if (k >= 0) {
        belegt[k] = true;
        texte[i] = fussnoten[k]?.text ?? "";
      }
    });
    bilder.forEach((bild, i) => {
      out.push({ id: bild.id, src: bild.src, caption: texte[i] ?? "" });
    });
    bilder = [];
    fussnoten = [];
  };

  // Frische Regex je Aufruf (kein geteilter lastIndex-Zustand über Aufrufe hinweg).
  const marken = new RegExp(MARKEN_QUELLE, "gi");
  let tiefe = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = marken.exec(bodyHtml)) !== null) {
    const marke = m[0];
    if (/^<figure/i.test(marke)) {
      tiefe += 1;
      continue;
    }
    if (/^<\/figure/i.test(marke)) {
      tiefe -= 1;
      if (tiefe <= 0) {
        tiefe = 0;
        gruppeAbschliessen();
      }
      continue;
    }
    if (tiefe === 0) {
      // Außerhalb jeder figure: kein Galerie-Eintrag. Der Vertrag ist unverändert.
      continue;
    }
    const offenerTag = m[1];
    if (offenerTag !== undefined) {
      // Die Kennung wird aus dem ÖFFNENDEN Tag gelesen, nie aus dem Fußnotentext.
      fussnoten.push({ id: attrOf(offenerTag, "data-image-id"), text: captionText(m[2] ?? "") });
      continue;
    }
    const id = attrOf(marke, "data-image-id");
    const src = attrOf(marke, "src");
    // Ohne gültige data-image-id (oder ohne src) kein Galerie-Eintrag — die Galerie zeigt nur die
    // verankerten Import-Bilder (Fußnoten-Vertrag), keine losen Alt-Bilder. WP-D9c: die src läuft
    // zusätzlich durch die zentrale isSafeImgSrc-Policy (Legacy-Daten/Repo-Importe fail-closed).
    if (!id || !IMAGE_ID_TOKEN_RE.test(id) || !src || !isSafeImgSrc(src)) {
      continue;
    }
    bilder.push({ id, src });
  }
  // Unbalanciertes Markup (ein `</figure>` fehlt): was noch offen ist, wird trotzdem ausgeliefert
  // statt still verworfen.
  gruppeAbschliessen();
  return out;
}

// ================================================================================================
// JOB 3210 · M5c — SYNTHETISCHE .docx AUS ECHTEM OOXML, IM TEST ERZEUGT
// ================================================================================================
//
// WARUM EIN BAUER UND KEINE EINGEBETTETE BASE64-KONSTANTE (wie in
// `tests/app/job2613-docx-bilder-uebergabe.test.ts`): Dieser Auftrag prüft SECHS verschiedene
// Absatz-Anordnungen um dasselbe Bild herum (Beschriftung danach, davor, mit Leerabsatz dazwischen,
// zwei Bilder auf eine Legende, Bild ohne Beschriftung). Sechs vorgefertigte Base64-Blöcke wären
// unlesbar und beim kleinsten Zusatzfall wertlos. Der Kommentar dort nennt als Grund, `jszip` liege
// nur bei `apps/web` — das gilt nicht mehr: `jszip` steht in `package.json` der Wurzel (Zeile 46)
// und `tests/capture/job2671-d2-jszip-vorpruefung.test.ts:28` importiert es aus dem Wurzelpaket.
//
// ECHTE DATEIEN, KEINE ATTRAPPEN: Was hier herauskommt, geht durch das ECHTE mammoth (kein
// injizierter `DocxEngine`) und durch die echte Importroute. Die Word-Beschriftungs-Formatvorlage
// steht als das da, was Word wirklich schreibt — ein `w:pStyle` auf einen Stil, dessen `w:name`
// `caption` ist (der kanonische OOXML-Name der eingebauten Beschriftungsvorlage; Word schreibt ihn
// auch in lokalisierten Fassungen englisch, die Anzeige „Beschriftung" ist Oberfläche).
//
// KEINE ECHTDATEN: alle Texte und Bilder sind erfunden. Die freigegebene BAADER-Arbeitskopie
// (Paket M5-DOCX-BILDUNTERSCHRIFTEN-20260907) kommt ausdrücklich NICHT ins Testrepository.

/** 1×1-PNG, rot. */
export const PNG_ROT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
/** 1×1-PNG, blau — bewusst ANDERE Bytes, damit „zwei Bilder" nicht „zweimal dasselbe" heissen kann. */
export const PNG_BLAU =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Ein Textlauf innerhalb eines Absatzes — `fett` erzeugt `<w:b/>`, also `<strong>` im HTML. */
export interface Lauf {
  readonly text: string;
  readonly fett?: boolean;
}

/** Ein Absatz des Prüfdokuments. Genau die Formen, die §5.2 des Auftrags unterscheidet. */
export type Absatz =
  /** Fliesstext. */
  | { readonly art: "text"; readonly text: string }
  /** Leerabsatz — in Word das, was zwischen Bild und Legende steht. */
  | { readonly art: "leer" }
  /**
   * Ein Absatz mit der Word-Beschriftungs-Formatvorlage (`w:pStyle` → Stil mit `w:name=caption`).
   * `laeufe` ersetzt `text`, wenn die Beschriftung Auszeichnung tragen soll.
   */
  | {
      readonly art: "beschriftung";
      readonly text: string;
      readonly stil?: string;
      readonly laeufe?: readonly Lauf[];
    }
  /** Eine Word-Überschrift (Formatvorlage `Heading 1`) — der Beleg, dass die Standardkarte bleibt. */
  | { readonly art: "ueberschrift"; readonly text: string }
  /** Ein eingebettetes Bild (eigener Absatz, wie Word es bei Blockbildern schreibt). */
  | { readonly art: "bild"; readonly png: string; readonly alt?: string };

const XML_KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";

function xmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Ein Absatz mit einer Formatvorlage — `w:pStyle` trägt die Stil-KENNUNG (`w:styleId`). */
function mitVorlage(styleId: string, laeufe: readonly Lauf[]): string {
  const inhalt = laeufe
    .map(
      (l) =>
        `<w:r>${l.fett ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${xmlText(l.text)}</w:t></w:r>`,
    )
    .join("");
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>${inhalt}</w:p>`;
}

/** Ein Blockbild, so wie Word es schreibt: `w:drawing` → `wp:inline` → `pic:pic` → `a:blip`. */
function bildAbsatz(relId: string, nr: number, alt: string): string {
  return [
    "<w:p><w:r><w:drawing>",
    '<wp:inline distT="0" distB="0" distL="0" distR="0">',
    '<wp:extent cx="914400" cy="914400"/>',
    `<wp:docPr id="${nr}" name="Grafik ${nr}" descr="${xmlText(alt)}"/>`,
    `<a:graphic><a:graphicData uri="${NS_PIC}"><pic:pic>`,
    `<pic:nvPicPr><pic:cNvPr id="${nr}" name="${xmlText(alt)}"/><pic:cNvPicPr/></pic:nvPicPr>`,
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`,
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm>',
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>',
    "</pic:pic></a:graphicData></a:graphic>",
    "</wp:inline></w:drawing></w:r></w:p>",
  ].join("");
}

export interface GebauteDocx {
  readonly bytes: Buffer;
  /** Die Bild-Base64-Rümpfe in Dokumentreihenfolge — für Zusicherungen „welches Bild". */
  readonly bilder: readonly string[];
}

/**
 * Baut eine echte `.docx` aus der Absatzfolge. Deterministisch (feste Zeitstempel, keine
 * Kompression) — zweimal derselbe Aufruf liefert dieselben Bytes.
 */
export async function baueDocx(absaetze: readonly Absatz[]): Promise<GebauteDocx> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  // Fester Zeitstempel je Eintrag: die erzeugten Bytes sollen von der Uhr unabhängig sein
  // (`generateAsync` kennt keine Datumsoption — der Stempel gehört an den Eintrag).
  const STEMPEL = new Date(Date.UTC(2026, 8, 7, 0, 0, 0));
  const lege = (name: string, inhalt: string | Buffer): void => {
    zip.file(name, inhalt, { date: STEMPEL });
  };

  const bilder: string[] = [];
  const rels: string[] = [
    `<Relationship Id="rIdStyles" Type="${NS_R}/styles" Target="styles.xml"/>`,
  ];
  // Die verwendeten Beschriftungs-Stile sammeln, damit `styles.xml` sie wirklich führt.
  const stile = new Map<string, string>();

  const koerper = absaetze
    .map((a) => {
      switch (a.art) {
        case "text":
          return `<w:p><w:r><w:t xml:space="preserve">${xmlText(a.text)}</w:t></w:r></w:p>`;
        case "leer":
          // GEMESSEN, nicht angenommen (Sondenlauf 07.09.): mammoth wirft einen WIRKLICH leeren
          // Word-Absatz spurlos weg (`ignoreEmptyParagraphs`, Standard an) — weder `<w:p/>` noch
          // ein Absatz mit leerem Lauf erzeugt ein `<p>`. Ein Leerabsatz, der im gemessenen
          // BAADER-Import zwischen Bild und „Figure 1: Profiles" ANKAM, trägt also Zeichen; genau
          // so steht er hier. Ein `<w:p/>` hätte Fall (c) zu einem Fall ohne Trenner gemacht.
          return '<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>';
        case "ueberschrift":
          stile.set("Heading1", "heading 1");
          return mitVorlage("Heading1", [{ text: a.text }]);
        case "beschriftung": {
          // `stil` ist die Stil-KENNUNG (`w:styleId`); der `w:name` dazu wird unten gesetzt.
          const id = a.stil ?? "Caption";
          stile.set(id, id === "Caption" ? "caption" : id);
          return mitVorlage(id, a.laeufe ?? [{ text: a.text }]);
        }
        case "bild": {
          const nr = bilder.length + 1;
          bilder.push(a.png);
          const relId = `rIdBild${nr}`;
          rels.push(
            `<Relationship Id="${relId}" Type="${NS_R}/image" Target="media/bild${nr}.png"/>`,
          );
          lege(`word/media/bild${nr}.png`, Buffer.from(a.png, "base64"));
          return bildAbsatz(relId, nr, a.alt ?? `bild${nr}.png`);
        }
      }
    })
    .join("");

  const stilXml = [...stile.entries()]
    .map(
      ([id, name]) =>
        `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${xmlText(name)}"/></w:style>`,
    )
    .join("");

  const NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types";
  const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
  const CT_DOC = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
  const CT_STYLES = "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml";

  lege(
    "[Content_Types].xml",
    [
      `${XML_KOPF}<Types xmlns="${NS_CT}">`,
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Default Extension="png" ContentType="image/png"/>',
      `<Override PartName="/word/document.xml" ContentType="${CT_DOC}"/>`,
      `<Override PartName="/word/styles.xml" ContentType="${CT_STYLES}"/>`,
      "</Types>",
    ].join(""),
  );
  lege(
    "_rels/.rels",
    `${XML_KOPF}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  lege(
    "word/_rels/document.xml.rels",
    `${XML_KOPF}<Relationships xmlns="${NS_PKG_REL}">${rels.join("")}</Relationships>`,
  );
  lege("word/styles.xml", `${XML_KOPF}<w:styles xmlns:w="${NS_W}">${stilXml}</w:styles>`);
  lege(
    "word/document.xml",
    [
      `${XML_KOPF}<w:document xmlns:w="${NS_W}" xmlns:r="${NS_R}"`,
      ` xmlns:wp="${NS_WP}" xmlns:a="${NS_A}" xmlns:pic="${NS_PIC}">`,
      `<w:body>${koerper}</w:body></w:document>`,
    ].join(""),
  );

  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  return { bytes, bilder };
}

/** Buffer → echtes `ArrayBuffer` (nicht SharedArrayBuffer) für `extractDocxRich`. */
export function alsPuffer(b: Buffer): ArrayBuffer {
  const kopie = new Uint8Array(b.byteLength);
  kopie.set(b);
  return kopie.buffer;
}

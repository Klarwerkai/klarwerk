// ================================================================================================
// BPA-16 · DIE GEMEINSAME VORRICHTUNG (nur synthetische Daten, BPA-S17).
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie baut die Präsentationsdateien (OOXML-PresentationML) und die
// WebVTT-Mitschrift, die `folienbezug.test.ts` (Bindungsmodul) und `bedienweg.test.ts` (echte App:
// Objektspeicher, Rechte, Ablage, Routen) gemeinsam verwenden — eine Quelle, kein zweiter Bauer.
import JSZip from "jszip";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

export interface Folie {
  sldId: number;
  titel: string;
  inhalt: string;
  versteckt?: boolean;
  notiz?: string;
  /** Inhalt eines eingebundenen Bildes (`ppt/media/bild<sldId>.png`). */
  bild?: string;
  /** Adresse eines extern verknüpften Bildes (TargetMode="External"). */
  externesBild?: string;
  /**
   * Mehrere eingebundene Bilder: Bild i hängt an `rId(10+i)` und liegt in
   * `ppt/media/bild<sldId>-<i>.png`. Vertauschte Inhalte bei gleichem Folien-XML = vertauschte Ziele.
   */
  bilder?: string[];
}

function form(typ: string, text: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="2" name="${typ}"/><p:cNvSpPr/><p:nvPr><p:ph type="${typ}"/></p:nvPr></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

/**
 * Baut eine .pptx. Der Teilname einer Folie hängt an ihrer sldId, nicht an der Reihenfolge.
 * `kennzeichen` legt eine zusätzliche Paketdatei ab — eine gespeicherte Kopie mit gleichen Folien,
 * aber anderen Dateibytes (andere Fassung).
 */
export async function pptx(folien: Folie[], kennzeichen?: string): Promise<Uint8Array> {
  const zip = new JSZip();
  const datum = new Date("2026-10-11T00:00:00Z");
  const ablegen = (pfad: string, xml: string): void => {
    zip.file(pfad, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xml}`, {
      date: datum,
    });
  };
  if (kennzeichen !== undefined) {
    zip.file("docProps/kennzeichen.txt", kennzeichen, { date: datum });
  }
  ablegen(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
  );
  const ids = folien.map((f) => `<p:sldId id="${f.sldId}" r:id="rId${f.sldId}"/>`).join("");
  ablegen(
    "ppt/presentation.xml",
    `<p:presentation ${NS}><p:sldIdLst>${ids}</p:sldIdLst></p:presentation>`,
  );
  const rels = folien
    .map(
      (f) =>
        `<Relationship Id="rId${f.sldId}" Type="${REL}/slide" Target="slides/slide${f.sldId}.xml"/>`,
    )
    .join("");
  ablegen(
    "ppt/_rels/presentation.xml.rels",
    `<Relationships xmlns="${PKG}">${rels}</Relationships>`,
  );
  for (const f of folien) {
    const show = f.versteckt ? ' show="0"' : "";
    ablegen(
      `ppt/slides/slide${f.sldId}.xml`,
      `<p:sld ${NS}${show}><p:cSld><p:spTree>${form("title", f.titel)}${form("body", f.inhalt)}</p:spTree></p:cSld></p:sld>`,
    );
    const beziehungen: string[] = [];
    if (f.notiz) {
      beziehungen.push(
        `<Relationship Id="rId1" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${f.sldId}.xml"/>`,
      );
      ablegen(
        `ppt/notesSlides/notesSlide${f.sldId}.xml`,
        `<p:notes ${NS}><p:cSld><p:spTree>${form("sldImg", "")}${form("body", f.notiz)}</p:spTree></p:cSld></p:notes>`,
      );
    }
    if (f.bild !== undefined) {
      beziehungen.push(
        `<Relationship Id="rId2" Type="${REL}/image" Target="../media/bild${f.sldId}.png"/>`,
      );
      zip.file(`ppt/media/bild${f.sldId}.png`, f.bild, { date: datum });
    }
    for (const [i, inhalt] of (f.bilder ?? []).entries()) {
      beziehungen.push(
        `<Relationship Id="rId${10 + i}" Type="${REL}/image" Target="../media/bild${f.sldId}-${i}.png"/>`,
      );
      zip.file(`ppt/media/bild${f.sldId}-${i}.png`, inhalt, { date: datum });
    }
    if (f.externesBild !== undefined) {
      beziehungen.push(
        `<Relationship Id="rId3" Type="${REL}/image" Target="${f.externesBild}" TargetMode="External"/>`,
      );
    }
    if (beziehungen.length > 0) {
      ablegen(
        `ppt/slides/_rels/slide${f.sldId}.xml.rels`,
        `<Relationships xmlns="${PKG}">${beziehungen.join("")}</Relationships>`,
      );
    }
  }
  return zip.generateAsync({ type: "uint8array" });
}

export const NORD: Folie[] = [
  { sldId: 256, titel: "Quartal Nord", inhalt: "Überblick" },
  { sldId: 257, titel: "Umsatzentwicklung", inhalt: "Grafik Nord 2025", bild: "BALKEN-NORD-V1" },
  {
    sldId: 258,
    titel: "Margenreserve",
    inhalt: "Nur intern",
    versteckt: true,
    notiz: "MARGE-GEHEIM-4711 nicht vortragen",
  },
];
export const SUED: Folie[] = [
  { sldId: 256, titel: "Quartal Süd", inhalt: "Überblick", notiz: "NOTIZ-SUED-0815" },
  { sldId: 257, titel: "Umsatzentwicklung", inhalt: "Grafik Süd 2025", bild: "BALKEN-SUED-V1" },
];

/** Jede Stelle ist eine Gesprächsstelle derselben Mitschrift. */
export const STELLEN: [string, string, string, string][] = [
  ["r1", "00:01:05.000", "00:01:09.000", "Bei dieser Grafik fehlt die Berechnungsgrundlage."],
  ["r2", "00:02:05.000", "00:02:09.500", "Hier fehlt die Quelle der Zahlen."],
  ["r3", "00:02:15.000", "00:02:18.000", "Den Überblick bitte kürzen."],
  ["r9", "00:03:25.000", "00:03:27.000", "Noch einmal."],
  ["r10", "00:05:01.000", "00:05:02.000", "Folie zwei."],
  ["r11", "00:06:41.000", "00:06:44.000", "Diese Grafik."],
  ["r12", "00:08:21.000", "00:08:23.000", "Die Marge."],
  ["r13", "00:10:01.000", "00:10:03.000", "Süd."],
  ["r14", "00:11:41.000", "00:11:42.000", "Reserve."],
  ["r15", "00:08:24.000", "00:08:25.000", "Reserve streichen."],
];

function vtt(): string {
  const bloecke = STELLEN.map(([id, von, bis, satz], i) => {
    const stimme = i % 2 === 0 ? "Sprecherin A" : "Sprecher B";
    return `${id}\n${von} --> ${bis}\n<v ${stimme}>${satz}</v>`;
  });
  return `WEBVTT\n\n${bloecke.join("\n\n")}\n`;
}

/** Die WebVTT-Mitschrift aller Stellen (Zeitbasis: Aufnahmebeginn). */
export const VTT = vtt();

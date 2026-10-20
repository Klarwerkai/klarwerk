// ================================================================================================
// produkt:20261015:klara-powerpoint-validierung (PP-03) · DAS KONTROLLIERTE PRÜFDECK.
// ================================================================================================
//
// Eine echte, kleine `.pptx` mit bekannten Werten für die Anschlusstests (Server und Fläche). Fiktiv:
//   Tabelle „Umsatz nach Region“: Nord 400 T€, Süd 600 T€, Summe 1.100 T€ (FALSCH, richtig 1.000).
//   Tabelle „Kosten nach Region“: Nord 300 T€, Süd 200 T€, Summe 500 T€ (richtig).
//   Texte „Umsatz Q4 2025: 1.000 T€“, „Umsatz 2024: 900 T€“, „Marktanteil: 12 %“; ein Bild, dessen
//   OCR-Text „Mitarbeitende 2025: 85“ lautet (erkannt wird hier nichts).
import { createHash } from "node:crypto";
import JSZip from "jszip";

export const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const BILD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 3, 0, 3]);
export const BILD_KENNUNG = `sha256:${createHash("sha256").update(BILD).digest("hex")}`;
export const OCR_TEXT = "Belegschaft\nMitarbeitende 2025: 85";

const absatz = (t: string) => `<a:p><a:r><a:rPr lang="de-DE"/><a:t>${t}</a:t></a:r></a:p>`;
const form = (id: number, name: string, zeilen: string[], titel = false) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr>${titel ? '<p:ph type="title"/>' : ""}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${zeilen.map(absatz).join("")}</p:txBody></p:sp>`;
const zelle = (t: string) => `<a:tc><a:txBody><a:bodyPr/>${absatz(t)}</a:txBody><a:tcPr/></a:tc>`;
const tabelle = (id: number, name: string, zeilen: string[][]) =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${name}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid/>${zeilen.map((z) => `<a:tr h="370840">${z.map(zelle).join("")}</a:tr>`).join("")}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
const bild = (id: number, name: string, rId: string) =>
  `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}"/></p:blipFill><p:spPr/></p:pic>`;
const folie = (inhalt: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${inhalt}</p:spTree></p:cSld></p:sld>`;

/** Das kontrollierte Deck. `nord` ändert einen Teilwert für eine zweite Dateifassung. */
export async function pruefdeck(nord = "400 T€"): Promise<Buffer> {
  const roh = new JSZip();
  const datum = new Date("2026-10-01T08:00:00Z");
  const datei = (name: string, inhalt: string | Buffer) => roh.file(name, inhalt, { date: datum });
  datei(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?><p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`,
  );
  datei(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="${REL}/slide" Target="slides/slide1.xml"/></Relationships>`,
  );
  datei(
    "ppt/slides/slide1.xml",
    folie(
      [
        form(2, "Titel 1", ["Kennzahlen Q4 2025"], true),
        tabelle(4, "Umsatz nach Region", [
          ["Region", "Q4 2025"],
          ["Nord", nord],
          ["Süd", "600 T€"],
          ["Summe", "1.100 T€"],
        ]),
        tabelle(5, "Kosten nach Region", [
          ["Region", "Q4 2025"],
          ["Nord", "300 T€"],
          ["Süd", "200 T€"],
          ["Summe", "500 T€"],
        ]),
        form(6, "Umsatz", ["Umsatz Q4 2025: 1.000 T€"]),
        form(7, "Vorjahr", ["Umsatz 2024: 900 T€"]),
        form(8, "Marktanteil", ["Marktanteil: 12 %"]),
        bild(9, "Grafik Belegschaft", "rId5"),
      ].join(""),
    ),
  );
  datei(
    "ppt/slides/_rels/slide1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="${REL}/image" Target="../media/image1.png"/></Relationships>`,
  );
  datei("ppt/media/image1.png", BILD);
  return roh.generateAsync({ type: "nodebuffer" });
}

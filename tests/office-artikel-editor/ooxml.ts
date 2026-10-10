// ================================================================================================
// OFFICE IM ARTIKEL · KLEINE, GÜLTIGE OOXML-DATEIEN MIT FIKTIVEM INHALT (Nacharbeit 2).
// ================================================================================================
//
// Für die CODE-Probe des Artikelwegs (`code-artikelweg.integration.test.ts`) braucht es echte
// Tabellen- und Präsentationsdateien statt ZIP-Platzhaltern: Collabora muss sie öffnen, bearbeiten
// und speichern können. `fiktivesDocx` steht schon in `../office-wopi-code/werkzeug.ts`.
//
// `ooxmlText` liest den sichtbaren Text ALLER XML-Teile einer Datei (Tags entfernt) — damit lässt
// sich nach dem Speichern prüfen, ob eine Änderung im Dokument steht, gleich welches Format.

import JSZip from "jszip";

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT = "http://schemas.openxmlformats.org/package/2006/content-types";

function rels(eintraege: [id: string, typ: string, ziel: string][]): string {
  return `${XML}<Relationships xmlns="${PKG_REL}">${eintraege
    .map(([id, typ, ziel]) => `<Relationship Id="${id}" Type="${REL}/${typ}" Target="${ziel}"/>`)
    .join("")}</Relationships>`;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Eine Tabelle mit einem Blatt; A1 trägt den Text, B1 eine Zahl, C1 eine Formel. */
export async function fiktivesXlsx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  const ss = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  zip.file(
    "[Content_Types].xml",
    `${XML}<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  );
  zip.file("_rels/.rels", rels([["rId1", "officeDocument", "xl/workbook.xml"]]));
  zip.file(
    "xl/workbook.xml",
    `${XML}<workbook xmlns="${ss}" xmlns:r="${REL}"><sheets><sheet name="Probe" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file("xl/_rels/workbook.xml.rels", rels([["rId1", "worksheet", "worksheets/sheet1.xml"]]));
  zip.file(
    "xl/worksheets/sheet1.xml",
    `${XML}<worksheet xmlns="${ss}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c><c r="B1"><v>21</v></c><c r="C1"><f>B1*2</f><v>42</v></c></row></sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS = `xmlns:a="${A}" xmlns:r="${REL}" xmlns:p="${P}"`;
const LEERER_BAUM =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function thema(): string {
  const farbe = (name: string, wert: string) => `<a:${name}><a:srgbClr val="${wert}"/></a:${name}>`;
  const fuellung = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const linie = `<a:ln w="9525">${fuellung}</a:ln>`;
  return `${XML}<a:theme xmlns:a="${A}" name="Probe"><a:themeElements><a:clrScheme name="Probe"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>${farbe("dk2", "1F497D")}${farbe("lt2", "EEECE1")}${farbe("accent1", "4F81BD")}${farbe("accent2", "C0504D")}${farbe("accent3", "9BBB59")}${farbe("accent4", "8064A2")}${farbe("accent5", "4BACC6")}${farbe("accent6", "F79646")}${farbe("hlink", "0000FF")}${farbe("folHlink", "800080")}</a:clrScheme><a:fontScheme name="Probe"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Probe"><a:fillStyleLst>${fuellung}${fuellung}${fuellung}</a:fillStyleLst><a:lnStyleLst>${linie}${linie}${linie}</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${fuellung}${fuellung}${fuellung}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
}

/**
 * Eine Präsentation mit einer Folie; ein Textfeld bedeckt fast die ganze Folie und trägt den Text —
 * so trifft ein Klick in die Folienmitte das Textfeld.
 */
export async function fiktivesPptx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  const typ = (teil: string, art: string) =>
    `<Override PartName="${teil}" ContentType="application/vnd.openxmlformats-officedocument.${art}"/>`;
  zip.file(
    "[Content_Types].xml",
    `${XML}<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${typ("/ppt/presentation.xml", "presentationml.presentation.main+xml")}${typ("/ppt/slideMasters/slideMaster1.xml", "presentationml.slideMaster+xml")}${typ("/ppt/slideLayouts/slideLayout1.xml", "presentationml.slideLayout+xml")}${typ("/ppt/slides/slide1.xml", "presentationml.slide+xml")}${typ("/ppt/theme/theme1.xml", "theme+xml")}</Types>`,
  );
  zip.file("_rels/.rels", rels([["rId1", "officeDocument", "ppt/presentation.xml"]]));
  zip.file(
    "ppt/presentation.xml",
    `${XML}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    rels([
      ["rId1", "slideMaster", "slideMasters/slideMaster1.xml"],
      ["rId2", "slide", "slides/slide1.xml"],
      ["rId3", "theme", "theme/theme1.xml"],
    ]),
  );
  zip.file(
    "ppt/slideMasters/slideMaster1.xml",
    `${XML}<p:sldMaster ${NS}><p:cSld><p:spTree>${LEERER_BAUM}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
  );
  zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rId2", "theme", "../theme/theme1.xml"],
    ]),
  );
  zip.file(
    "ppt/slideLayouts/slideLayout1.xml",
    `${XML}<p:sldLayout ${NS} type="blank"><p:cSld name="Leer"><p:spTree>${LEERER_BAUM}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  );
  zip.file(
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]),
  );
  zip.file(
    "ppt/slides/slide1.xml",
    `${XML}<p:sld ${NS}><p:cSld><p:spTree>${LEERER_BAUM}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="8229600" cy="5943600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="de-DE" sz="4000"/><a:t>${escapeXml(text)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
  );
  zip.file(
    "ppt/slides/_rels/slide1.xml.rels",
    rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]]),
  );
  zip.file("ppt/theme/theme1.xml", thema());
  return zip.generateAsync({ type: "nodebuffer" });
}

/**
 * Der Text aller XML-Teile: Tags ersatzlos entfernt (ein Wort, das der Editor auf mehrere Läufe
 * verteilt, bleibt so zusammenhängend), Entitäten aufgelöst, Teile durch Leerzeichen getrennt.
 */
export async function ooxmlText(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const teile: string[] = [];
  for (const name of Object.keys(zip.files).sort()) {
    if (name.endsWith(".xml")) {
      const xml = (await zip.file(name)?.async("string")) ?? "";
      teile.push(
        xml
          .replace(/<[^>]+>/g, "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&"),
      );
    }
  }
  return teile.join(" ");
}

// ================================================================================================
// BPA-17 · EINE SYNTHETISCHE POWERPOINT-DATEI MIT FIKTIVEM INHALT (Szenario BPA-S18).
// ================================================================================================
//
// Drei Folien mit stabilen Kennungen (`p:sldId`):
//   256  „Pumpenwartung P1 (fiktiv)" — Titel- und Inhaltsplatzhalter, MIT Notizseite, deren Notiz
//        privat ist („Privat: …"). Hier landet der belegte Korrekturauftrag.
//   257  „Kennzahlen 2025" — Zahlen ohne Notizseite; ein Absatz ist über drei Formatierungsläufe
//        verteilt.
//   258  „Interne Kalkulation" — AUSGEBLENDET (`show="0"`), also kein freigegebener Teil fürs Handout.
//
// Dazu Master, Layout, Thema und Notizmaster wie in einer echten Datei; die Vorlage soll nach der
// Nachbearbeitung byte-gleich bleiben. `folienText`/`teilText` lesen die Datei UNABHÄNGIG von
// `office-nachbearbeitung.ts` (nur Tags entfernt), damit das Wiederöffnen nicht sich selbst prüft.

import JSZip from "jszip";

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS = `xmlns:a="${A}" xmlns:r="${REL}" xmlns:p="${P}"`;

export const PRIVATE_NOTIZ = "Privat: Zahlen vorher mit Controlling abstimmen";
export const VERBORGEN = "Marge intern: 37 %";

function rels(eintraege: [id: string, typ: string, ziel: string][]): string {
  return `${XML}<Relationships xmlns="${PKG_REL}">${eintraege
    .map(([id, typ, ziel]) => `<Relationship Id="${id}" Type="${REL}/${typ}" Target="${ziel}"/>`)
    .join("")}</Relationships>`;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const BAUM =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function lauf(text: string, fett = false): string {
  return `<a:r><a:rPr lang="de-DE"${fett ? ' b="1"' : ""} dirty="0"/><a:t>${esc(text)}</a:t></a:r>`;
}

function platzhalter(id: number, ph: string, absaetze: string[]): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${ph} ${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${absaetze.join("")}</p:txBody></p:sp>`;
}

const titel = (t: string) => platzhalter(2, '<p:ph type="title"/>', [`<a:p>${lauf(t)}</a:p>`]);
const inhalt = (absaetze: string[]) => platzhalter(3, '<p:ph idx="1"/>', absaetze);

function folie(innen: string, ausgeblendet = false): string {
  return `${XML}<p:sld ${NS}${ausgeblendet ? ' show="0"' : ""}><p:cSld><p:spTree>${BAUM}${innen}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function thema(name: string): string {
  const farbe = (n: string, w: string) => `<a:${n}><a:srgbClr val="${w}"/></a:${n}>`;
  const fuellung = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const linie = `<a:ln w="9525">${fuellung}</a:ln>`;
  return `${XML}<a:theme xmlns:a="${A}" name="${name}"><a:themeElements><a:clrScheme name="${name}"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>${farbe("dk2", "1F497D")}${farbe("lt2", "EEECE1")}${farbe("accent1", "4F81BD")}${farbe("accent2", "C0504D")}${farbe("accent3", "9BBB59")}${farbe("accent4", "8064A2")}${farbe("accent5", "4BACC6")}${farbe("accent6", "F79646")}${farbe("hlink", "0000FF")}${farbe("folHlink", "800080")}</a:clrScheme><a:fontScheme name="${name}"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="${name}"><a:fillStyleLst>${fuellung}${fuellung}${fuellung}</a:fillStyleLst><a:lnStyleLst>${linie}${linie}${linie}</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${fuellung}${fuellung}${fuellung}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
}

const CLRMAP =
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

/** Die Präsentation; `abweichung` ersetzt den Inhalt von Folie 257 (für die Paralleländerung). */
export async function synthetischePraesentation(abweichung?: {
  kennzahl: string;
}): Promise<Buffer> {
  const zip = new JSZip();
  const typ = (teil: string, art: string) =>
    `<Override PartName="${teil}" ContentType="application/vnd.openxmlformats-officedocument.${art}"/>`;
  zip.file(
    "[Content_Types].xml",
    `${XML}<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${typ("/ppt/presentation.xml", "presentationml.presentation.main+xml")}${typ("/ppt/slideMasters/slideMaster1.xml", "presentationml.slideMaster+xml")}${typ("/ppt/slideLayouts/slideLayout1.xml", "presentationml.slideLayout+xml")}${typ("/ppt/slides/slide1.xml", "presentationml.slide+xml")}${typ("/ppt/slides/slide2.xml", "presentationml.slide+xml")}${typ("/ppt/slides/slide3.xml", "presentationml.slide+xml")}${typ("/ppt/notesMasters/notesMaster1.xml", "presentationml.notesMaster+xml")}${typ("/ppt/notesSlides/notesSlide1.xml", "presentationml.notesSlide+xml")}${typ("/ppt/theme/theme1.xml", "theme+xml")}${typ("/ppt/theme/theme2.xml", "theme+xml")}</Types>`,
  );
  zip.file("_rels/.rels", rels([["rId1", "officeDocument", "ppt/presentation.xml"]]));
  zip.file(
    "ppt/presentation.xml",
    `${XML}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId6"/></p:notesMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    rels([
      ["rId1", "slideMaster", "slideMasters/slideMaster1.xml"],
      ["rId2", "slide", "slides/slide1.xml"],
      ["rId3", "slide", "slides/slide2.xml"],
      ["rId4", "slide", "slides/slide3.xml"],
      ["rId5", "theme", "theme/theme1.xml"],
      ["rId6", "notesMaster", "notesMasters/notesMaster1.xml"],
    ]),
  );
  zip.file(
    "ppt/slideMasters/slideMaster1.xml",
    `${XML}<p:sldMaster ${NS}><p:cSld><p:spTree>${BAUM}${titel("Mastertitel")}${inhalt([`<a:p>${lauf("Mastertext")}</a:p>`])}</p:spTree></p:cSld>${CLRMAP}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
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
    `${XML}<p:sldLayout ${NS} type="obj"><p:cSld name="Titel und Inhalt"><p:spTree>${BAUM}${titel("Layouttitel")}${inhalt([`<a:p>${lauf("Layouttext")}</a:p>`])}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  );
  zip.file(
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]),
  );
  zip.file(
    "ppt/slides/slide1.xml",
    folie(
      `${titel("Pumpenwartung P1 (fiktiv)")}${inhalt([
        `<a:p>${lauf("Wartungsintervall: monatlich")}</a:p>`,
        `<a:p>${lauf("Verantwortlich: Team Instandhaltung")}</a:p>`,
      ])}`,
    ),
  );
  zip.file(
    "ppt/slides/_rels/slide1.xml.rels",
    rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rId2", "notesSlide", "../notesSlides/notesSlide1.xml"],
    ]),
  );
  zip.file(
    "ppt/slides/slide2.xml",
    folie(
      `${titel("Kennzahlen 2025")}${inhalt([
        `<a:p>${lauf(abweichung?.kennzahl ?? "Ausfallquote 2025: 4,2 %")}</a:p>`,
        `<a:p>${lauf("Kosten je Einsatz: 310 EUR")}</a:p>`,
        `<a:p>${lauf("Ziel: ")}${lauf("null", true)}${lauf(" Ausfälle")}</a:p>`,
      ])}`,
    ),
  );
  zip.file(
    "ppt/slides/_rels/slide2.xml.rels",
    rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]]),
  );
  zip.file(
    "ppt/slides/slide3.xml",
    folie(`${titel("Interne Kalkulation")}${inhalt([`<a:p>${lauf(VERBORGEN)}</a:p>`])}`, true),
  );
  zip.file(
    "ppt/slides/_rels/slide3.xml.rels",
    rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]]),
  );
  const bild = platzhalter(2, '<p:ph type="sldImg"/>', []).replace(
    "<p:txBody><a:bodyPr/><a:lstStyle/></p:txBody>",
    "",
  );
  zip.file(
    "ppt/notesMasters/notesMaster1.xml",
    `${XML}<p:notesMaster ${NS}><p:cSld><p:spTree>${BAUM}${bild}${platzhalter(3, '<p:ph type="body" idx="1"/>', [`<a:p>${lauf("Notiztext")}</a:p>`])}</p:spTree></p:cSld>${CLRMAP}</p:notesMaster>`,
  );
  zip.file(
    "ppt/notesMasters/_rels/notesMaster1.xml.rels",
    rels([["rId1", "theme", "../theme/theme2.xml"]]),
  );
  zip.file(
    "ppt/notesSlides/notesSlide1.xml",
    `${XML}<p:notes ${NS}><p:cSld><p:spTree>${BAUM}${bild}${platzhalter(3, '<p:ph type="body" idx="1"/>', [`<a:p>${lauf(PRIVATE_NOTIZ)}</a:p>`])}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`,
  );
  zip.file(
    "ppt/notesSlides/_rels/notesSlide1.xml.rels",
    rels([
      ["rId1", "notesMaster", "../notesMasters/notesMaster1.xml"],
      ["rId2", "slide", "../slides/slide1.xml"],
    ]),
  );
  zip.file("ppt/theme/theme1.xml", thema("Vorlage"));
  zip.file("ppt/theme/theme2.xml", thema("Notizen"));
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Der sichtbare Text eines Teils: Tags ersatzlos entfernt, Entitäten aufgelöst. */
export async function teilText(bytes: Buffer, teil: string): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = (await zip.file(teil)?.async("string")) ?? "";
  return xml
    .replace(/<\/a:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export const folienText = (bytes: Buffer, nummer: number) =>
  teilText(bytes, `ppt/slides/slide${nummer}.xml`);

/** Alle Teile als base64 — für den Vergleich „Vorlage unverändert". */
export async function teile(bytes: Buffer): Promise<Map<string, string>> {
  const zip = await JSZip.loadAsync(bytes);
  const ergebnis = new Map<string, string>();
  for (const name of Object.keys(zip.files).sort()) {
    const datei = zip.file(name);
    if (datei) {
      ergebnis.set(name, await datei.async("base64"));
    }
  }
  return ergebnis;
}

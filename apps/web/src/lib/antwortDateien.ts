// ================================================================================================
// R-0703 — DIE KI-KENNZEICHNUNG WANDERT IN DIE EIGENSCHAFTEN DER AUSGABEDATEI.
// ================================================================================================
//
// „Wird ein Ergebnis als Word-, PowerPoint-, Markdown- oder PDF-Datei weitergegeben, trägt die
// Datei die Kennzeichnung als KI-Erzeugnis in ihren Eigenschaften mit." Markdown trägt sie seit
// mega62 E im Kopfblock (answerExport.ts). Für Word, PowerPoint und PDF gab es bis hierher KEINEN
// Erzeuger (Befund F29) — der Druckweg erzeugt zwar ein PDF, aber dessen Eigenschaften setzt der
// Browser, nicht das Produkt. Diese Datei ist der Erzeuger, und zwar ohne neue Abhängigkeit:
//
//   · .docx / .pptx — Office-Open-XML-Pakete (ZIP, unkomprimiert gespeichert). Die Kennzeichnung
//     steht in den DATEIEIGENSCHAFTEN: `docProps/core.xml` (Beschreibung, Stichwörter) und
//     `docProps/custom.xml` (benutzerdefinierte Eigenschaften `ai-generated`, `ai-system`,
//     `ai-task`, `ai-date`, `ai-notice`) — die Felder, die Word/PowerPoint unter „Eigenschaften"
//     zeigen.
//   · .pdf — das Dokumentinformations-Verzeichnis (`/Info`): `/Subject`, `/Keywords` und die
//     eigenen Schlüssel `/AIGenerated`, `/AISystem`, `/AITask`, `/AIDate`.
//
// DIESELBE ENTSCHEIDUNG WIE MARKDOWN: `exportKennzeichnen` (answerExport.ts). Nur der belegte
// modellfreie Rückfall lässt die Kennzeichnung weg; „unbekannt" behält sie (R-0625).
//
// Sichtbar steht der Satz zusätzlich im Dokument selbst (Artikel 50 Absatz 5: nicht versteckt).
import {
  type AnswerExportInput,
  type AnswerExportSource,
  decisionArguments,
  decisionProtocolRows,
  exportKennzeichnen,
} from "./answerExport";
import { stripAskAnswerMarkdown } from "./wordAddin";

export type AntwortDateiformat = "docx" | "pptx" | "pdf";

export const ANTWORT_DATEI_TYP: Readonly<Record<AntwortDateiformat, string>> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
};

export function antwortDateiname(generatedAt: string, format: AntwortDateiformat): string {
  const date = generatedAt.slice(0, 10) || "antwort";
  return `klarwerk-antwort-${date}.${format}`;
}

// ------------------------------------------------------------------------------------------------
// Der gemeinsame Inhalt — dieselben Abschnitte wie im Markdown, ohne Markdown-Zeichen.
// ------------------------------------------------------------------------------------------------
export type AbsatzArt = "titel" | "ueberschrift" | "hinweis" | "text";

export interface AntwortAbsatz {
  art: AbsatzArt;
  text: string;
}

/** Die maschinenlesbare Kennzeichnung — `null`, wenn die Datei keine tragen darf. */
export interface KiEigenschaften {
  system: "KLARWERK";
  task: "answer";
  date: string;
  notice: string;
}

export function kiEigenschaften(input: AnswerExportInput): KiEigenschaften | null {
  if (!exportKennzeichnen(input)) {
    return null;
  }
  return {
    system: "KLARWERK",
    task: "answer",
    date: input.generatedAt.slice(0, 10),
    notice: input.labels.aiNotice.trim(),
  };
}

function quellenZeile(source: AnswerExportSource, trustLabel: string): string {
  const teile = [
    source.attributionLabel,
    source.statusLabel,
    source.trust !== undefined ? `${trustLabel} ${source.trust}` : undefined,
    source.usabilityLabel,
    source.sourceId.trim() || undefined,
  ].filter((p): p is string => Boolean(p?.trim()));
  const titel = source.title.trim();
  return teile.length > 0 ? `${titel} — ${teile.join(" · ")}` : titel;
}

export function antwortAbsaetze(input: AnswerExportInput): AntwortAbsatz[] {
  const L = input.labels;
  const out: AntwortAbsatz[] = [{ art: "titel", text: input.question.trim() || "—" }];
  const ki = kiEigenschaften(input);
  if (ki) {
    out.push({ art: "hinweis", text: ki.notice });
  }
  const meta = [
    input.statusLabel,
    `${L.evidence}: ${input.evidenceLabel}`,
    `${L.trust} ${input.trust}`,
  ].filter((p) => Boolean(p?.trim()));
  out.push({ art: "text", text: `${L.answer} · ${meta.join(" · ")}` });
  for (const zeile of stripAskAnswerMarkdown(input.answer).split("\n")) {
    if (zeile.trim()) {
      out.push({ art: "text", text: zeile.trim() });
    }
  }
  if (input.steps.length > 0) {
    out.push({ art: "ueberschrift", text: L.steps });
    for (const step of input.steps) {
      out.push({ art: "text", text: step.description.trim() });
      if (step.snippet?.trim()) {
        out.push({ art: "text", text: `„${step.snippet.trim()}“` });
      }
    }
  }
  if (input.sources.length > 0) {
    out.push({ art: "ueberschrift", text: L.sources });
    const ohneKennzeichen = input.sources.every((s) => !s.attributionLabel?.trim());
    if (ohneKennzeichen && L.attributionUnknown?.trim()) {
      out.push({ art: "hinweis", text: L.attributionUnknown.trim() });
    }
    for (const source of input.sources) {
      out.push({ art: "text", text: quellenZeile(source, L.trust) });
    }
  }
  // R-1643 (Entscheidungs-Protokoll): Zeitpunkt, Nutzer-ID und Argumentationskette — dieselben
  // Hilfen wie Markdown und Druck, damit Word, PowerPoint und PDF dasselbe Protokoll tragen.
  if (input.protocol) {
    const PL = input.protocol.labels;
    out.push({ art: "ueberschrift", text: PL.heading });
    for (const zeile of decisionProtocolRows(input, input.protocol)) {
      out.push({ art: "text", text: `${zeile.label}: ${zeile.value}` });
    }
    out.push({ art: "ueberschrift", text: PL.argumentation });
    const kette = decisionArguments(input, input.protocol);
    if (kette) {
      for (const [i, glied] of kette.entries()) {
        const quelle = glied.quelleTitel
          ? `${glied.quelleTitel} (${glied.quelleId})`
          : glied.quelleId;
        out.push({
          art: "text",
          text: `${i + 1}. „${glied.aussage}“ — ${PL.supportedBy}: ${quelle}`,
        });
      }
    } else {
      out.push({ art: "hinweis", text: PL.argumentationMissing });
    }
  }
  const datum = input.generatedAt.slice(0, 10);
  out.push({ art: "hinweis", text: L.footer.replace("{{date}}", datum) });
  return out;
}

// ------------------------------------------------------------------------------------------------
// ZIP (Methode 0 „gespeichert") — genug für Office-Open-XML, ohne Bibliothek.
// ------------------------------------------------------------------------------------------------
const CRC_TABELLE: Uint32Array = (() => {
  const tabelle = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabelle[n] = c >>> 0;
  }
  return tabelle;
})();

export function crc32(daten: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of daten) {
    c = (CRC_TABELLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEintrag {
  name: string;
  text: string;
}

export function zipGespeichert(dateien: readonly ZipEintrag[]): Uint8Array {
  const kodierer = new TextEncoder();
  const teile: Uint8Array[] = [];
  const verzeichnis: Uint8Array[] = [];
  let versatz = 0;
  for (const datei of dateien) {
    const name = kodierer.encode(datei.name);
    const inhalt = kodierer.encode(datei.text);
    const pruef = crc32(inhalt);
    const kopf = new Uint8Array(30 + name.length);
    const k = new DataView(kopf.buffer);
    k.setUint32(0, 0x04034b50, true);
    k.setUint16(4, 20, true);
    k.setUint16(6, 0x0800, true); // Namen in UTF-8
    k.setUint16(8, 0, true); // gespeichert, nicht komprimiert
    k.setUint16(10, 0, true);
    k.setUint16(12, 0x0021, true); // 1980-01-01
    k.setUint32(14, pruef, true);
    k.setUint32(18, inhalt.length, true);
    k.setUint32(22, inhalt.length, true);
    k.setUint16(26, name.length, true);
    k.setUint16(28, 0, true);
    kopf.set(name, 30);
    const eintrag = new Uint8Array(46 + name.length);
    const e = new DataView(eintrag.buffer);
    e.setUint32(0, 0x02014b50, true);
    e.setUint16(4, 20, true);
    e.setUint16(6, 20, true);
    e.setUint16(8, 0x0800, true);
    e.setUint16(10, 0, true);
    e.setUint16(12, 0, true);
    e.setUint16(14, 0x0021, true);
    e.setUint32(16, pruef, true);
    e.setUint32(20, inhalt.length, true);
    e.setUint32(24, inhalt.length, true);
    e.setUint16(28, name.length, true);
    e.setUint32(42, versatz, true);
    eintrag.set(name, 46);
    teile.push(kopf, inhalt);
    verzeichnis.push(eintrag);
    versatz += kopf.length + inhalt.length;
  }
  const verzeichnisLaenge = verzeichnis.reduce((s, v) => s + v.length, 0);
  const ende = new Uint8Array(22);
  const z = new DataView(ende.buffer);
  z.setUint32(0, 0x06054b50, true);
  z.setUint16(8, dateien.length, true);
  z.setUint16(10, dateien.length, true);
  z.setUint32(12, verzeichnisLaenge, true);
  z.setUint32(16, versatz, true);
  const alles = [...teile, ...verzeichnis, ende];
  const ergebnis = new Uint8Array(alles.reduce((s, t) => s + t.length, 0));
  let pos = 0;
  for (const t of alles) {
    ergebnis.set(t, pos);
    pos += t.length;
  }
  return ergebnis;
}

// ------------------------------------------------------------------------------------------------
// Office Open XML — die gemeinsamen Eigenschaftsteile.
// ------------------------------------------------------------------------------------------------

/** Zeichen, die XML 1.0 nicht erlaubt (Steuerzeichen ausser Tab, Zeilenvorschub, Wagenrücklauf). */
function xmlErlaubt(zeichen: string): boolean {
  const code = zeichen.codePointAt(0) ?? 0;
  return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

export function xmlText(wert: string): string {
  return Array.from(wert)
    .filter(xmlErlaubt)
    .join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const XML_KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_PAKET = "http://schemas.openxmlformats.org/package/2006";
const NS_REL = `${NS_PAKET}/relationships`;
const NS_OFFDOC = "http://schemas.openxmlformats.org/officeDocument/2006";
const NS_OFFDOC_REL = `${NS_OFFDOC}/relationships`;
const FMTID = "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}";
const TYP_OOXML = "application/vnd.openxmlformats-officedocument";

function coreXml(input: AnswerExportInput, ki: KiEigenschaften | null): string {
  const titel = xmlText(input.question.trim() || "—");
  const kiTeil = ki
    ? [
        `<dc:description>${xmlText(ki.notice)}</dc:description>`,
        `<cp:keywords>KI-erzeugt; ai-generated; ${ki.system}</cp:keywords>`,
      ].join("")
    : "";
  return [
    XML_KOPF,
    `<cp:coreProperties xmlns:cp="${NS_PAKET}/metadata/core-properties"`,
    ' xmlns:dc="http://purl.org/dc/elements/1.1/"',
    ' xmlns:dcterms="http://purl.org/dc/terms/"',
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    `<dc:title>${titel}</dc:title><dc:creator>KLARWERK</dc:creator>`,
    kiTeil,
    `<dcterms:created xsi:type="dcterms:W3CDTF">${xmlText(input.generatedAt)}</dcterms:created>`,
    "</cp:coreProperties>",
  ].join("");
}

function customXml(ki: KiEigenschaften): string {
  const eigenschaften: ReadonlyArray<readonly [string, string]> = [
    ["ai-generated", "<vt:bool>true</vt:bool>"],
    ["ai-system", `<vt:lpwstr>${ki.system}</vt:lpwstr>`],
    ["ai-task", `<vt:lpwstr>${ki.task}</vt:lpwstr>`],
    ["ai-date", `<vt:lpwstr>${xmlText(ki.date)}</vt:lpwstr>`],
    ["ai-notice", `<vt:lpwstr>${xmlText(ki.notice)}</vt:lpwstr>`],
  ];
  const zeilen = eigenschaften.map(
    ([name, wert], i) =>
      `<property fmtid="${FMTID}" pid="${i + 2}" name="${name}">${wert}</property>`,
  );
  return [
    XML_KOPF,
    `<Properties xmlns="${NS_OFFDOC}/custom-properties"`,
    ` xmlns:vt="${NS_OFFDOC}/docPropsVTypes">`,
    ...zeilen,
    "</Properties>",
  ].join("");
}

type Teiltyp = readonly [teil: string, typ: string];

function contentTypes(hauptteile: readonly Teiltyp[], ki: boolean): string {
  const teile: Teiltyp[] = [
    ...hauptteile,
    ["/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"],
  ];
  if (ki) {
    teile.push(["/docProps/custom.xml", `${TYP_OOXML}.custom-properties+xml`]);
  }
  return [
    XML_KOPF,
    `<Types xmlns="${NS_PAKET}/content-types">`,
    '<Default Extension="rels"',
    ' ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    ...teile.map(([teil, typ]) => `<Override PartName="${teil}" ContentType="${typ}"/>`),
    "</Types>",
  ].join("");
}

function beziehungen(eintraege: ReadonlyArray<readonly [string, string, string]>): string {
  const zeilen = eintraege.map(
    ([id, typ, ziel]) => `<Relationship Id="${id}" Type="${typ}" Target="${ziel}"/>`,
  );
  return [XML_KOPF, `<Relationships xmlns="${NS_REL}">`, ...zeilen, "</Relationships>"].join("");
}

function paketRels(hauptdokument: string, ki: boolean): string {
  const eintraege: Array<readonly [string, string, string]> = [
    ["rId1", `${NS_OFFDOC_REL}/officeDocument`, hauptdokument],
    ["rId2", `${NS_REL}/metadata/core-properties`, "docProps/core.xml"],
  ];
  if (ki) {
    eintraege.push(["rId3", `${NS_OFFDOC_REL}/custom-properties`, "docProps/custom.xml"]);
  }
  return beziehungen(eintraege);
}

function eigenschaftsTeile(input: AnswerExportInput, ki: KiEigenschaften | null): ZipEintrag[] {
  const teile: ZipEintrag[] = [{ name: "docProps/core.xml", text: coreXml(input, ki) }];
  if (ki) {
    teile.push({ name: "docProps/custom.xml", text: customXml(ki) });
  }
  return teile;
}

// ------------------------------------------------------------------------------------------------
// .docx
// ------------------------------------------------------------------------------------------------
const DOCX_LAUF: Readonly<Record<AbsatzArt, string>> = {
  titel: '<w:rPr><w:b/><w:sz w:val="32"/></w:rPr>',
  ueberschrift: '<w:rPr><w:b/><w:sz w:val="26"/></w:rPr>',
  hinweis: "<w:rPr><w:i/></w:rPr>",
  text: "",
};

function docxAbsatz(a: AntwortAbsatz): string {
  const lauf = `${DOCX_LAUF[a.art]}<w:t xml:space="preserve">${xmlText(a.text)}</w:t>`;
  return `<w:p><w:r>${lauf}</w:r></w:p>`;
}

export function buildAnswerDocx(input: AnswerExportInput): Uint8Array {
  const ki = kiEigenschaften(input);
  const dokument = [
    XML_KOPF,
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    "<w:body>",
    ...antwortAbsaetze(input).map(docxAbsatz),
    "<w:sectPr/></w:body></w:document>",
  ].join("");
  const hauptteil: Teiltyp = [
    "/word/document.xml",
    `${TYP_OOXML}.wordprocessingml.document.main+xml`,
  ];
  return zipGespeichert([
    { name: "[Content_Types].xml", text: contentTypes([hauptteil], ki !== null) },
    { name: "_rels/.rels", text: paketRels("word/document.xml", ki !== null) },
    { name: "word/document.xml", text: dokument },
    ...eigenschaftsTeile(input, ki),
  ]);
}

// ------------------------------------------------------------------------------------------------
// .pptx — eine Folie, Titel und Text; Master, Layout und Thema in kleinster gültiger Form.
// ------------------------------------------------------------------------------------------------
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const PPTX_NS = `xmlns:a="${NS_A}" xmlns:r="${NS_OFFDOC_REL}" xmlns:p="${NS_P}"`;
const LEERER_BAUM =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>';
const TYP_PML = `${TYP_OOXML}.presentationml`;

function pptxThema(): string {
  const farben: ReadonlyArray<readonly [string, string]> = [
    ["dk1", "000000"],
    ["lt1", "FFFFFF"],
    ["dk2", "1F2937"],
    ["lt2", "F3F4F6"],
    ["accent1", "6D5BD0"],
    ["accent2", "2563EB"],
    ["accent3", "059669"],
    ["accent4", "D97706"],
    ["accent5", "DC2626"],
    ["accent6", "4B5563"],
    ["hlink", "2563EB"],
    ["folHlink", "6D5BD0"],
  ];
  const fuellung = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const linie = `<a:ln w="6350">${fuellung}</a:ln>`;
  const effekt = "<a:effectStyle><a:effectLst/></a:effectStyle>";
  const schrift = '<a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/>';
  return [
    XML_KOPF,
    `<a:theme xmlns:a="${NS_A}" name="KLARWERK"><a:themeElements>`,
    '<a:clrScheme name="KLARWERK">',
    ...farben.map(([name, wert]) => `<a:${name}><a:srgbClr val="${wert}"/></a:${name}>`),
    "</a:clrScheme>",
    '<a:fontScheme name="KLARWERK">',
    `<a:majorFont>${schrift}</a:majorFont><a:minorFont>${schrift}</a:minorFont>`,
    "</a:fontScheme>",
    '<a:fmtScheme name="KLARWERK">',
    `<a:fillStyleLst>${fuellung.repeat(3)}</a:fillStyleLst>`,
    `<a:lnStyleLst>${linie.repeat(3)}</a:lnStyleLst>`,
    `<a:effectStyleLst>${effekt.repeat(3)}</a:effectStyleLst>`,
    `<a:bgFillStyleLst>${fuellung.repeat(3)}</a:bgFillStyleLst>`,
    "</a:fmtScheme></a:themeElements></a:theme>",
  ].join("");
}

const PPTX_SCHRIFT: Readonly<Record<AbsatzArt, string>> = {
  titel: 'sz="2400" b="1"',
  ueberschrift: 'sz="1400" b="1"',
  hinweis: 'sz="1100" i="1"',
  text: 'sz="1200"',
};

interface Lage {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

function pptxTextfeld(
  id: number,
  name: string,
  lage: Lage,
  absaetze: readonly AntwortAbsatz[],
): string {
  const text = absaetze.map((a) => {
    const lauf = `<a:rPr lang="de-DE" ${PPTX_SCHRIFT[a.art]} dirty="0"/>`;
    return `<a:p><a:r>${lauf}<a:t>${xmlText(a.text)}</a:t></a:r></a:p>`;
  });
  return [
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/>`,
    '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>',
    `<p:spPr><a:xfrm><a:off x="${lage.x}" y="${lage.y}"/>`,
    `<a:ext cx="${lage.cx}" cy="${lage.cy}"/></a:xfrm>`,
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>',
    '<p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>',
    ...text,
    "</p:txBody></p:sp>",
  ].join("");
}

function pptxFolie(input: AnswerExportInput): string {
  const [titel, ...rest] = antwortAbsaetze(input);
  const kopf = { x: 457200, y: 304800, cx: 11277600, cy: 914400 };
  const rumpf = { x: 457200, y: 1371600, cx: 11277600, cy: 5181600 };
  return [
    XML_KOPF,
    `<p:sld ${PPTX_NS}><p:cSld><p:spTree>${LEERER_BAUM}`,
    pptxTextfeld(2, "Titel", kopf, titel ? [titel] : []),
    pptxTextfeld(3, "Inhalt", rumpf, rest),
    "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>",
  ].join("");
}

const PPTX_PRAESENTATION = [
  XML_KOPF,
  `<p:presentation ${PPTX_NS}>`,
  '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>',
  '<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>',
  '<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>',
  "</p:presentation>",
].join("");

const PPTX_MASTER = [
  XML_KOPF,
  `<p:sldMaster ${PPTX_NS}><p:cSld><p:spTree>${LEERER_BAUM}</p:spTree></p:cSld>`,
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2"',
  ' accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink"',
  ' folHlink="folHlink"/>',
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>',
  "</p:sldMaster>",
].join("");

const PPTX_LAYOUT = [
  XML_KOPF,
  `<p:sldLayout ${PPTX_NS} type="blank" preserve="1">`,
  `<p:cSld name="Leer"><p:spTree>${LEERER_BAUM}</p:spTree></p:cSld>`,
  "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>",
].join("");

export function buildAnswerPptx(input: AnswerExportInput): Uint8Array {
  const ki = kiEigenschaften(input);
  const R = NS_OFFDOC_REL;
  const hauptteile: Teiltyp[] = [
    ["/ppt/presentation.xml", `${TYP_PML}.presentation.main+xml`],
    ["/ppt/slides/slide1.xml", `${TYP_PML}.slide+xml`],
    ["/ppt/slideLayouts/slideLayout1.xml", `${TYP_PML}.slideLayout+xml`],
    ["/ppt/slideMasters/slideMaster1.xml", `${TYP_PML}.slideMaster+xml`],
    ["/ppt/theme/theme1.xml", `${TYP_OOXML}.theme+xml`],
  ];
  return zipGespeichert([
    { name: "[Content_Types].xml", text: contentTypes(hauptteile, ki !== null) },
    { name: "_rels/.rels", text: paketRels("ppt/presentation.xml", ki !== null) },
    { name: "ppt/presentation.xml", text: PPTX_PRAESENTATION },
    {
      name: "ppt/_rels/presentation.xml.rels",
      text: beziehungen([
        ["rId1", `${R}/slideMaster`, "slideMasters/slideMaster1.xml"],
        ["rId2", `${R}/slide`, "slides/slide1.xml"],
        ["rId3", `${R}/theme`, "theme/theme1.xml"],
      ]),
    },
    { name: "ppt/slides/slide1.xml", text: pptxFolie(input) },
    {
      name: "ppt/slides/_rels/slide1.xml.rels",
      text: beziehungen([["rId1", `${R}/slideLayout`, "../slideLayouts/slideLayout1.xml"]]),
    },
    { name: "ppt/slideLayouts/slideLayout1.xml", text: PPTX_LAYOUT },
    {
      name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      text: beziehungen([["rId1", `${R}/slideMaster`, "../slideMasters/slideMaster1.xml"]]),
    },
    { name: "ppt/slideMasters/slideMaster1.xml", text: PPTX_MASTER },
    {
      name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      text: beziehungen([
        ["rId1", `${R}/slideLayout`, "../slideLayouts/slideLayout1.xml"],
        ["rId2", `${R}/theme`, "../theme/theme1.xml"],
      ]),
    },
    { name: "ppt/theme/theme1.xml", text: pptxThema() },
    ...eigenschaftsTeile(input, ki),
  ]);
}

// ------------------------------------------------------------------------------------------------
// .pdf — Text in Helvetica (WinAnsi) und Symbol, Seitenumbruch, Kennzeichnung im /Info-Verzeichnis.
// ------------------------------------------------------------------------------------------------
//
// BEN NACHARBEIT 4 — KEIN STILLER INHALTSVERLUST. Bis hierher wurde jedes Zeichen ausserhalb einer
// kleinen WinAnsi-Tabelle zu „?" — „Δp" kam als „?p" in der Datei an. Jetzt gilt:
//   · WinAnsi vollständig (Latin-1 plus die Sonderplätze 0x80–0x9F).
//   · Griechisch und mathematische Zeichen über die eingebaute PDF-Schrift „Symbol" — mit eigener
//     /ToUnicode-Tabelle, damit Kopieren und Suchen den Originaltext liefern.
//   · Was keine der beiden Schriften darstellen kann, wird NICHT ersetzt: der Erzeuger bricht mit
//     `PdfZeichenNichtDarstellbar` ab und nennt die Zeichen. Eine Datei mit verändertem Inhalt
//     entsteht nicht.
// BENANNTE GRENZE: eine eingebettete Unicode-Schrift (z. B. für Kyrillisch, CJK, Arabisch) braucht
// eine Schriftdatei; im Repository gibt es keine, und dieser Auftrag installiert nichts.
// Codepunkt → WinAnsi-Byte für die Sonderplätze 0x80–0x9F (der Rest ist Latin-1 = Codepunkt).
const WIN_ANSI: ReadonlyMap<number, number> = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x2c6, 0x88],
  [0x2030, 0x89],
  [0x160, 0x8a],
  [0x2039, 0x8b],
  [0x152, 0x8c],
  [0x17d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x2dc, 0x98],
  [0x2122, 0x99],
  [0x161, 0x9a],
  [0x203a, 0x9b],
  [0x153, 0x9c],
  [0x17e, 0x9e],
  [0x178, 0x9f],
]);

/** Adobe-Symbol-Kodierung für Zeichen, die WinAnsi nicht hat (Griechisch, Mathematik, Pfeile). */
export const PDF_SYMBOL: ReadonlyMap<number, number> = new Map([
  // Griechisch, gross
  [0x391, 0x41],
  [0x392, 0x42],
  [0x3a7, 0x43],
  [0x394, 0x44],
  [0x395, 0x45],
  [0x3a6, 0x46],
  [0x393, 0x47],
  [0x397, 0x48],
  [0x399, 0x49],
  [0x3d1, 0x4a],
  [0x39a, 0x4b],
  [0x39b, 0x4c],
  [0x39c, 0x4d],
  [0x39d, 0x4e],
  [0x39f, 0x4f],
  [0x3a0, 0x50],
  [0x398, 0x51],
  [0x3a1, 0x52],
  [0x3a3, 0x53],
  [0x3a4, 0x54],
  [0x3a5, 0x55],
  [0x3c2, 0x56],
  [0x3a9, 0x57],
  [0x39e, 0x58],
  [0x3a8, 0x59],
  [0x396, 0x5a],
  // Griechisch, klein
  [0x3b1, 0x61],
  [0x3b2, 0x62],
  [0x3c7, 0x63],
  [0x3b4, 0x64],
  [0x3b5, 0x65],
  [0x3c6, 0x66],
  [0x3b3, 0x67],
  [0x3b7, 0x68],
  [0x3b9, 0x69],
  [0x3d5, 0x6a],
  [0x3ba, 0x6b],
  [0x3bb, 0x6c],
  [0x3bc, 0x6d],
  [0x3bd, 0x6e],
  [0x3bf, 0x6f],
  [0x3c0, 0x70],
  [0x3b8, 0x71],
  [0x3c1, 0x72],
  [0x3c3, 0x73],
  [0x3c4, 0x74],
  [0x3c5, 0x75],
  [0x3d6, 0x76],
  [0x3c9, 0x77],
  [0x3be, 0x78],
  [0x3c8, 0x79],
  [0x3b6, 0x7a],
  [0x3d2, 0xa1],
  // Mathematik, Pfeile, Zeichen
  [0x2200, 0x22],
  [0x2203, 0x24],
  [0x220b, 0x27],
  [0x2212, 0x2d],
  [0x2245, 0x40],
  [0x2234, 0x5c],
  [0x22a5, 0x5e],
  [0x223c, 0x7e],
  [0x2032, 0xa2],
  [0x2264, 0xa3],
  [0x2044, 0xa4],
  [0x221e, 0xa5],
  [0x2663, 0xa7],
  [0x2666, 0xa8],
  [0x2665, 0xa9],
  [0x2660, 0xaa],
  [0x2194, 0xab],
  [0x2190, 0xac],
  [0x2191, 0xad],
  [0x2192, 0xae],
  [0x2193, 0xaf],
  [0x2033, 0xb2],
  [0x2265, 0xb3],
  [0x221d, 0xb5],
  [0x2202, 0xb6],
  [0x2260, 0xb9],
  [0x2261, 0xba],
  [0x2248, 0xbb],
  [0x21b5, 0xbf],
  [0x2135, 0xc0],
  [0x2111, 0xc1],
  [0x211c, 0xc2],
  [0x2118, 0xc3],
  [0x2297, 0xc4],
  [0x2295, 0xc5],
  [0x2205, 0xc6],
  [0x2229, 0xc7],
  [0x222a, 0xc8],
  [0x2283, 0xc9],
  [0x2287, 0xca],
  [0x2284, 0xcb],
  [0x2282, 0xcc],
  [0x2286, 0xcd],
  [0x2208, 0xce],
  [0x2209, 0xcf],
  [0x2220, 0xd0],
  [0x2207, 0xd1],
  [0x220f, 0xd5],
  [0x221a, 0xd6],
  [0x22c5, 0xd7],
  [0x2227, 0xd9],
  [0x2228, 0xda],
  [0x21d4, 0xdb],
  [0x21d0, 0xdc],
  [0x21d1, 0xdd],
  [0x21d2, 0xde],
  [0x21d3, 0xdf],
  [0x25ca, 0xe0],
  [0x2329, 0xe1],
  [0x2211, 0xe5],
  [0x232a, 0xf1],
  [0x222b, 0xf2],
]);

/** Die PDF-Datei kann diese Zeichen nicht unverändert darstellen — es entsteht keine Datei. */
export class PdfZeichenNichtDarstellbar extends Error {
  readonly zeichen: readonly string[];

  constructor(zeichen: readonly string[]) {
    super(`PDF: nicht darstellbare Zeichen ${zeichen.join(" ")}`);
    this.name = "PdfZeichenNichtDarstellbar";
    this.zeichen = zeichen;
  }
}

type PdfSchriftArt = "text" | "symbol";

/** Ein Zeichen → Schrift und Byte; `null`, wenn keine eingebaute Schrift es darstellen kann. */
function pdfGlyphe(zeichen: string): { art: PdfSchriftArt; code: number } | null {
  const code = zeichen.codePointAt(0) ?? 0;
  const sonder = WIN_ANSI.get(code);
  if (sonder !== undefined) {
    return { art: "text", code: sonder };
  }
  if ((code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code <= 0xff)) {
    return { art: "text", code };
  }
  // Kanonisch gleichwertige Schreibweisen (z. B. das Ohm-Zeichen U+2126 → Ω) sind derselbe Text.
  const kanonisch = zeichen.normalize("NFC").codePointAt(0) ?? 0;
  const symbol = PDF_SYMBOL.get(code) ?? PDF_SYMBOL.get(kanonisch);
  return symbol === undefined ? null : { art: "symbol", code: symbol };
}

function pdfZeichenkette(bytes: readonly number[]): string {
  const roh = bytes.map((b) => String.fromCharCode(b)).join("");
  return `(${roh.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

/** Eine Zeile als Folge von Schriftwechseln und Textstücken — Tj rückt selbst weiter. */
function pdfZeile(zeile: string, schrift: string, groesse: number): string {
  const stuecke: string[] = [];
  let art: PdfSchriftArt | null = null;
  let bytes: number[] = [];
  const abschliessen = (): void => {
    if (art !== null && bytes.length > 0) {
      const font = art === "symbol" ? "F4" : schrift;
      stuecke.push(`/${font} ${groesse} Tf ${pdfZeichenkette(bytes)} Tj`);
    }
    bytes = [];
  };
  for (const zeichen of Array.from(zeile)) {
    const glyphe = pdfGlyphe(zeichen);
    if (glyphe === null) {
      // Wird vorab von `pdfFehlendeZeichen` ausgeschlossen — hier nur zur Sicherheit.
      throw new PdfZeichenNichtDarstellbar([zeichen]);
    }
    if (glyphe.art !== art) {
      abschliessen();
      art = glyphe.art;
    }
    bytes.push(glyphe.code);
  }
  abschliessen();
  return stuecke.join(" ");
}

/** Alle Zeichen der Datei, die keine eingebaute Schrift darstellen kann — sortiert, je einmal. */
export function pdfFehlendeZeichen(input: AnswerExportInput): string[] {
  const fehlend = new Set<string>();
  for (const absatz of antwortAbsaetze(input)) {
    for (const wort of absatz.text.split(/\s+/)) {
      for (const zeichen of Array.from(wort)) {
        if (pdfGlyphe(zeichen) === null) {
          fehlend.add(zeichen);
        }
      }
    }
  }
  return [...fehlend].sort();
}

/** Die /ToUnicode-Tabelle der Symbol-Schrift: Byte → Originalzeichen (Kopieren, Suchen). */
function symbolToUnicode(): string {
  const eintraege = [...PDF_SYMBOL].map(([zeichen, code]) => {
    const quelle = code.toString(16).toUpperCase().padStart(2, "0");
    const ziel = zeichen.toString(16).toUpperCase().padStart(4, "0");
    return `<${quelle}> <${ziel}>`;
  });
  const bloecke: string[] = [];
  for (let i = 0; i < eintraege.length; i += 100) {
    const teil = eintraege.slice(i, i + 100);
    bloecke.push(`${teil.length} beginbfchar\n${teil.join("\n")}\nendbfchar`);
  }
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /KLARWERK-Symbol-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<00> <FF>",
    "endcodespacerange",
    ...bloecke,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

/** Unicode-Text für das /Info-Verzeichnis: UTF-16BE mit Byte-Order-Mark, als Hex-Zeichenkette. */
export function pdfUnicodeHex(text: string): string {
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) {
    hex += text.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0");
  }
  return `<${hex}>`;
}

function umbrechen(text: string, breite: number): string[] {
  const zeilen: string[] = [];
  let zeile = "";
  for (const wort of text.split(/\s+/).filter(Boolean)) {
    if (zeile && zeile.length + 1 + wort.length > breite) {
      zeilen.push(zeile);
      zeile = "";
    }
    let rest = wort;
    while (rest.length > breite) {
      zeilen.push(rest.slice(0, breite));
      rest = rest.slice(breite);
    }
    zeile = zeile ? `${zeile} ${rest}` : rest;
  }
  if (zeile) {
    zeilen.push(zeile);
  }
  return zeilen.length > 0 ? zeilen : [""];
}

interface PdfSchrift {
  font: string;
  groesse: number;
  breite: number;
}

const PDF_SCHRIFT: Readonly<Record<AbsatzArt, PdfSchrift>> = {
  titel: { font: "F2", groesse: 15, breite: 60 },
  ueberschrift: { font: "F2", groesse: 12, breite: 75 },
  hinweis: { font: "F3", groesse: 10, breite: 92 },
  text: { font: "F1", groesse: 10, breite: 92 },
};

function pdfSchriftObjekt(name: string): string {
  return `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
}

/** Die Seiten als Folge von Textbefehlen — A4, Rand 50 pt, Umbruch auf neue Seiten. */
function pdfSeiten(input: AnswerExportInput): string[][] {
  const seiten: string[][] = [[]];
  let y = 792;
  for (const absatz of antwortAbsaetze(input)) {
    const s = PDF_SCHRIFT[absatz.art];
    const abstand = s.groesse + 4;
    for (const zeile of umbrechen(absatz.text, s.breite)) {
      if (y - abstand < 50) {
        seiten.push([]);
        y = 792;
      }
      y -= abstand;
      const befehl = `BT 50 ${y} Td ${pdfZeile(zeile, s.font, s.groesse)} ET`;
      seiten[seiten.length - 1]?.push(befehl);
    }
    y -= 6;
  }
  return seiten;
}

function pdfInfo(input: AnswerExportInput, ki: KiEigenschaften | null): string {
  const datum = input.generatedAt.replace(/[-:T]/g, "").slice(0, 14);
  const eintraege = [
    `/Title ${pdfUnicodeHex(input.question.trim() || "—")}`,
    "/Author (KLARWERK)",
    "/Creator (KLARWERK)",
    "/Producer (KLARWERK)",
    `/CreationDate (D:${datum}Z)`,
  ];
  if (ki) {
    eintraege.push(
      `/Subject ${pdfUnicodeHex(ki.notice)}`,
      `/Keywords ${pdfUnicodeHex(`KI-erzeugt; ai-generated; ${ki.system}`)}`,
      "/AIGenerated true",
      `/AISystem (${ki.system})`,
      `/AITask (${ki.task})`,
      `/AIDate (${ki.date})`,
    );
  }
  return `<< ${eintraege.join(" ")} >>`;
}

export function buildAnswerPdf(input: AnswerExportInput): Uint8Array {
  // Erst prüfen, dann erzeugen: enthält die Antwort ein Zeichen, das keine eingebaute Schrift
  // darstellen kann, entsteht KEINE Datei — statt einer, deren Inhalt verändert wäre.
  const fehlend = pdfFehlendeZeichen(input);
  if (fehlend.length > 0) {
    throw new PdfZeichenNichtDarstellbar(fehlend);
  }
  const ki = kiEigenschaften(input);
  const seiten = pdfSeiten(input);
  const objekte = new Map<number, string>();
  objekte.set(3, pdfSchriftObjekt("Helvetica"));
  objekte.set(4, pdfSchriftObjekt("Helvetica-Bold"));
  objekte.set(5, pdfSchriftObjekt("Helvetica-Oblique"));
  objekte.set(6, pdfInfo(input, ki));
  // Die Symbol-Schrift trägt ihre eigene Kodierung; /ToUnicode macht Kopieren und Suchen treu.
  objekte.set(7, "<< /Type /Font /Subtype /Type1 /BaseFont /Symbol /ToUnicode 8 0 R >>");
  const cmap = symbolToUnicode();
  objekte.set(8, `<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`);
  const ressourcen = "/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 7 0 R >> >>";
  const kinder: string[] = [];
  for (const [i, befehle] of seiten.entries()) {
    const seite = 9 + i * 2;
    const inhalt = seite + 1;
    const strom = befehle.join("\n");
    const rahmen = "/Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]";
    objekte.set(seite, `<< ${rahmen} ${ressourcen} /Contents ${inhalt} 0 R >>`);
    objekte.set(inhalt, `<< /Length ${strom.length} >>\nstream\n${strom}\nendstream`);
    kinder.push(`${seite} 0 R`);
  }
  objekte.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objekte.set(2, `<< /Type /Pages /Kids [${kinder.join(" ")}] /Count ${kinder.length} >>`);
  const anzahl = 9 + seiten.length * 2;
  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const versaetze: number[] = [];
  for (let n = 1; n < anzahl; n++) {
    versaetze[n] = pdf.length;
    pdf += `${n} 0 obj\n${objekte.get(n) ?? "null"}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${anzahl}\n0000000000 65535 f \n`;
  for (let n = 1; n < anzahl; n++) {
    pdf += `${String(versaetze[n] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${anzahl} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function buildAnswerDatei(input: AnswerExportInput, format: AntwortDateiformat): Uint8Array {
  if (format === "docx") {
    return buildAnswerDocx(input);
  }
  return format === "pptx" ? buildAnswerPptx(input) : buildAnswerPdf(input);
}

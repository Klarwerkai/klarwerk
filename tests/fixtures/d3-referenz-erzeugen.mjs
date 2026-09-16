// ================================================================================================
// JOB 4203 · D3 — DER ERZEUGER DER DREI REFERENZDATEIEN (PDF, PPTX, Markdown).
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. `tests/fixtures/` trug bis hierher ausschliesslich DOCX
// (`sample.docx`, `job2912-*.docx`). Fuer PDF, PPTX und Markdown gab es keine einzige
// Referenzdatei — und damit auch keinen Bedienwegnachweis, der eine ECHTE Datei durch die
// sichtbare Dateiauswahl schickt. Die drei Dateien entstehen hier, nicht von Hand: wer sie
// nachbauen oder veraendern will, aendert diesen Erzeuger und faehrt ihn erneut.
//
//     node tests/fixtures/d3-referenz-erzeugen.mjs
//
// KEINE FREMDEN ABHAENGIGKEITEN, und das ist Absicht. Das PDF wird als gueltiges PDF 1.4 mit
// eigener Querverweistabelle geschrieben, die PPTX als ZIP mit unkomprimierten Eintraegen
// (Methode 0) — fflate registriert `UnzipPassThrough` (`apps/web/src/lib/pptx.ts:896`) und liest
// sie deshalb genauso wie deflate-komprimierte. So haengt der Erzeuger an keiner Paketversion.
//
// DER ERWARTETE INHALT STEHT NICHT HIER, SONDERN IM TEST
// (`tests/d3-dateien-durchgaengig/referenzinhalt.ts`). Diese Datei schreibt die Dateien; was in
// ihnen stehen MUSS, sagt der Test — und er sagt es vorher, nicht aus dem Ergebnis abgeleitet.
import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------------------------------------
// 1 · MARKDOWN
// ------------------------------------------------------------------------------------------------
//
// Titel (`#`), zwei Abschnitte (`##`), eine Aufzaehlung UND eine Pipe-Tabelle.
// Bewusst ohne Umlaute: derselbe Zeichenvorrat wie im PDF, damit kein Vergleich an einer Kodierung
// haengt statt an der Sache.
//
// ZWEI KANTEN STEHEN SEIT RUNDE 2 AUSDRUECKLICH DRIN, weil BEN an genau ihnen zwei echte Fehler
// belegt hat (Urteil zu Runde 1, Korrekturpflichten 1 und 2):
//   · EIN GESCHUETZTER STRICH in einer Zelle (`Ventil A\|B`). Ohne ihn hat der Zellsplitter drei
//     Zellen gebildet — unter der Ueberschrift „Ergebnis" stand dann „B" statt „geprueft". Eine
//     Tabelle, die Werte in die falsche Spalte schiebt, ist schlimmer als gar keine Tabelle.
//   · KEINE LEERZEILE vor dem Folgeabsatz. Ohne sie verlangte die alte Erkennung Pipes in JEDER
//     Zeile des Blocks, fand keine und legte die ganze Tabelle samt Absatz als Pipe-Rohtext ab.
// RUNDE 3 bringt die dritte Kante dazu, und wieder aus einem belegten Fehler (BEN zu Runde 2):
//   · EINE UEBERSCHRIFT MIT PIPE unmittelbar nach der letzten Datenzeile. Die Erkennung der Runde 2
//     setzte die Tabelle bei JEDER weiteren Zeile mit ungeschuetztem Strich fort — aus
//     `## Abschnitt Drei | Grenzfaelle` wurde damit eine Datenzeile, und unter „Ergebnis" stand
//     „Grenzfaelle". Ein neuer Block muss die Tabelle beenden (so auch die GFM-Spezifikation).
// Alle drei Kanten sind damit nicht mehr Theorie, sondern Teil des Bedienwegnachweises.
const MARKDOWN = [
  "# D3 Referenz Markdown",
  "",
  "## Abschnitt Eins Wartung",
  "",
  "Vor der Wartung wird der Hauptschalter ausgeschaltet und",
  "gegen Wiedereinschalten gesichert.",
  "",
  "- Erster Aufzaehlungspunkt der Referenz",
  "- Zweiter Aufzaehlungspunkt der Referenz",
  "",
  "## Abschnitt Zwei Pruefung",
  "",
  "| Pruefschritt | Ergebnis |",
  "| --- | --- |",
  "| Ventilprobe | bestanden |",
  "| Dichtheit | offen |",
  "| Ventil A\\|B | geprueft |",
  "## Abschnitt Drei | Grenzfaelle",
  "Direkt nach der Tabelle folgt dieser Absatz ohne Leerzeile.",
  "",
  "Der Suchbegriff MARKDOWNBELEG4203 kommt in dieser Datei genau einmal vor.",
  "",
].join("\n");

// ------------------------------------------------------------------------------------------------
// 2 · PDF
// ------------------------------------------------------------------------------------------------
//
// Jede Zeile bekommt eine EIGENE Textmatrix. Das ist der Punkt: `reconstructPageLines`
// (`apps/web/src/lib/extract.ts:71`) baut Zeilen und Absaetze aus den Y-Koordinaten der Fragmente.
// Der Zeilenabstand innerhalb eines Absatzes betraegt 18 pt (= 1,5 x Schriftgroesse, also GENAU auf
// der Absatzschwelle und damit KEIN Absatzumbruch), zwischen Absaetzen 42 pt (deutlich darueber).
// Ein PDF mit allen Fragmenten auf einer Hoehe wuerde dieselbe Pruefung bestehen, ohne je etwas
// ueber die Absatzrekonstruktion zu sagen — deshalb steht der Abstand hier und nicht zufaellig.
const PDF_SCHRIFT_PT = 12;
const PDF_ZEILEN = [
  { y: 780, text: "D3 Referenz PDF" },
  { y: 738, text: "Abschnitt Eins Wartung" },
  { y: 696, text: "Vor der Wartung wird der Hauptschalter ausgeschaltet und" },
  { y: 678, text: "gegen Wiedereinschalten gesichert." },
  { y: 636, text: "Abschnitt Zwei Pruefung" },
  { y: 594, text: "Der Suchbegriff PDFBELEG4203 kommt in dieser Datei genau einmal vor." },
];

function pdfStrom() {
  const teile = ["BT", `/F1 ${PDF_SCHRIFT_PT} Tf`];
  for (const zeile of PDF_ZEILEN) {
    teile.push(`1 0 0 1 72 ${zeile.y} Tm`, `(${zeile.text}) Tj`);
  }
  teile.push("ET");
  return `${teile.join("\n")}\n`;
}

function erzeugePdf() {
  const strom = pdfStrom();
  const objekte = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(strom, "latin1")} >>\nstream\n${strom}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const versatz = [];
  for (let i = 0; i < objekte.length; i += 1) {
    versatz.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${objekte[i]}\nendobj\n`;
  }
  const xrefAb = Buffer.byteLength(pdf, "latin1");
  // Jeder Eintrag ist exakt 20 Byte: 10 Ziffern, Leerzeichen, 5 Ziffern, Leerzeichen, Typ, " \n".
  let xref = `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (const ab of versatz) {
    xref += `${String(ab).padStart(10, "0")} 00000 n \n`;
  }
  pdf += xref;
  pdf += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAb}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// ------------------------------------------------------------------------------------------------
// 3 · PPTX
// ------------------------------------------------------------------------------------------------
//
// Drei Folien mit Titel und Aufzaehlung — und EINE Sprechernotiz. Die Notiz ist kein Beiwerk: sie
// ist der Nachweis fuer „nicht uebernommen und trotzdem sichtbar benannt". `PPTX_NEEDED_ENTRY_RE`
// (`apps/web/src/lib/pptx.ts:78`) laesst `ppt/notesSlides/**` gar nicht erst ins Entpacken; der
// Verlust ist damit strukturell und wird vom Satz `importNote.pptx` benannt, nicht verschwiegen.
const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const URI_PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships";

const PPTX_FOLIEN = [
  {
    titel: "D3 Referenz Folie Eins",
    punkte: ["Ventil pruefen", "Dichtung tauschen"],
  },
  {
    titel: "D3 Referenz Folie Zwei",
    punkte: ["Protokoll fuehren", "Abweichung melden"],
  },
  {
    titel: "D3 Referenz Folie Drei",
    punkte: ["Suchbegriff PPTXBELEG4203", "Freigabe einholen"],
  },
];

const PPTX_SPRECHERNOTIZ =
  "SPRECHERNOTIZ4203 — diese Notiz gehoert zur ersten Folie und wird nicht uebernommen.";

function folienXml(folie) {
  const titel = `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${folie.titel}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const punkte = folie.punkte
    .map((p) => `<a:p><a:pPr><a:buChar char="&#8226;"/></a:pPr><a:r><a:t>${p}</a:t></a:r></a:p>`)
    .join("");
  const rumpf = `<p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody>${punkte}</p:txBody></p:sp>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${titel}${rumpf}</p:spTree></p:cSld></p:sld>`;
}

function pptxEintraege() {
  const eintraege = new Map();
  eintraege.set(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
      "</Types>",
  );
  eintraege.set(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
  );
  const sldIds = PPTX_FOLIEN.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join(
    "",
  );
  eintraege.set(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:sldIdLst>${sldIds}</p:sldIdLst></p:presentation>`,
  );
  const praesRels = PPTX_FOLIEN.map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="${URI_R}/slide" Target="slides/slide${i + 1}.xml"/>`,
  ).join("");
  eintraege.set(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${URI_PKG_R}">${praesRels}</Relationships>`,
  );
  PPTX_FOLIEN.forEach((folie, i) => {
    eintraege.set(`ppt/slides/slide${i + 1}.xml`, folienXml(folie));
  });
  // Nur die erste Folie traegt die Notiz — genau eine Sprechernotiz im ganzen Deck.
  eintraege.set(
    "ppt/slides/_rels/slide1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`,
  );
  eintraege.set(
    "ppt/notesSlides/notesSlide1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes xmlns:p="${URI_P}" xmlns:a="${URI_A}"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${PPTX_SPRECHERNOTIZ}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`,
  );
  return eintraege;
}

// ---- Ein ZIP ohne Fremdpaket: unkomprimierte Eintraege (Methode 0) -------------------------------

const CRC_TABELLE = (() => {
  const tabelle = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabelle[n] = c >>> 0;
  }
  return tabelle;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABELLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function erzeugeZip(eintraege) {
  const stuecke = [];
  const verzeichnis = [];
  let versatz = 0;
  for (const [name, inhalt] of eintraege) {
    const namensBytes = Buffer.from(name, "utf8");
    const datenBytes = Buffer.from(inhalt, "utf8");
    const pruefsumme = crc32(datenBytes);
    const kopf = Buffer.alloc(30);
    kopf.writeUInt32LE(0x04034b50, 0);
    kopf.writeUInt16LE(20, 4); // benoetigte Version
    kopf.writeUInt16LE(0, 6); // Flags
    kopf.writeUInt16LE(0, 8); // Methode 0 = gespeichert
    kopf.writeUInt16LE(0, 10); // Zeit
    kopf.writeUInt16LE(33, 12); // Datum (1980-01-01)
    kopf.writeUInt32LE(pruefsumme, 14);
    kopf.writeUInt32LE(datenBytes.length, 18);
    kopf.writeUInt32LE(datenBytes.length, 22);
    kopf.writeUInt16LE(namensBytes.length, 26);
    kopf.writeUInt16LE(0, 28);
    stuecke.push(kopf, namensBytes, datenBytes);

    const eintrag = Buffer.alloc(46);
    eintrag.writeUInt32LE(0x02014b50, 0);
    eintrag.writeUInt16LE(20, 4); // erzeugende Version
    eintrag.writeUInt16LE(20, 6); // benoetigte Version
    eintrag.writeUInt16LE(0, 8);
    eintrag.writeUInt16LE(0, 10);
    eintrag.writeUInt16LE(0, 12);
    eintrag.writeUInt16LE(33, 14);
    eintrag.writeUInt32LE(pruefsumme, 16);
    eintrag.writeUInt32LE(datenBytes.length, 20);
    eintrag.writeUInt32LE(datenBytes.length, 24);
    eintrag.writeUInt16LE(namensBytes.length, 28);
    eintrag.writeUInt16LE(0, 30);
    eintrag.writeUInt16LE(0, 32);
    eintrag.writeUInt16LE(0, 34);
    eintrag.writeUInt16LE(0, 36);
    eintrag.writeUInt32LE(0, 38);
    eintrag.writeUInt32LE(versatz, 42);
    verzeichnis.push(eintrag, namensBytes);

    versatz += kopf.length + namensBytes.length + datenBytes.length;
  }
  const verzeichnisBytes = Buffer.concat(verzeichnis);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(0, 4);
  ende.writeUInt16LE(0, 6);
  ende.writeUInt16LE(eintraege.size, 8);
  ende.writeUInt16LE(eintraege.size, 10);
  ende.writeUInt32LE(verzeichnisBytes.length, 12);
  ende.writeUInt32LE(versatz, 16);
  ende.writeUInt16LE(0, 20);
  return Buffer.concat([...stuecke, verzeichnisBytes, ende]);
}

// ------------------------------------------------------------------------------------------------
// Schreiben
// ------------------------------------------------------------------------------------------------

writeFileSync(join(HIER, "d3-referenz.md"), Buffer.from(MARKDOWN, "utf8"));
writeFileSync(join(HIER, "d3-referenz.pdf"), erzeugePdf());
writeFileSync(join(HIER, "d3-referenz.pptx"), erzeugeZip(pptxEintraege()));
process.stdout.write("d3-referenz.md · d3-referenz.pdf · d3-referenz.pptx geschrieben\n");

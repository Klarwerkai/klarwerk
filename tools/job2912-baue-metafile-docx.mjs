// JOB 2912 D3 — REPROFALL MIT ECHTEN METAFILE-BILDBYTES.
//
// BENs Korrekturpflicht 1 zu D1: „Den künstlich umdeklarierten PNG-Repro durch ein echtes […]
// EMF/WMF-Dokument ersetzen oder ergänzen." D1 hat eine PNG-Mediendatei nur in `.emf` umbenannt
// und den Content-Type umdeklariert — damit belegte der Test nur „nicht erlaubter MIME-Typ wird
// entfernt", nicht „ein echtes Word-Metafile geht verloren". BEN hat damit recht.
//
// HIER ENTSTEHEN ECHTE BYTES, keine Umdeklaration:
//
//   EMF — ein wohlgeformter `EMR_HEADER` (Satztyp 1) gefolgt von `EMR_EOF` (Satztyp 14), wie in
//         MS-EMF §2.3.4.2 beschrieben: Byte 0-3 iType=1, Byte 4-7 nSize, Byte 40-43 die
//         Signatur " EMF" (0x464D4520 little-endian), Byte 48-51 nBytes, Byte 52-55 nRecords.
//         Die Bildbytes-Signatur, die der Auftrag nennt (`\x01\x00\x00\x00`), ist genau dieses
//         iType=1 in Byte 0-3.
//   WMF — ein „placeable" Metafile nach der Aldus-Kopfstruktur: Byte 0-3 der Schlüssel
//         0x9AC6CDD7 (der Auftrag nennt ihn als `\xd7\xcd\xc6\x9a`, das ist derselbe Wert in
//         Byte-Reihenfolge), danach der Standard-WMF-Kopf und ein leerer Datensatz.
//
// WARUM DAS OHNE WORD GENÜGT, und der Auftrag sagt es ausdrücklich: Für die Frage, wo die Kette
// ein Metafile verliert, zählt, was in `word/media/` liegt und wie `[Content_Types].xml` es
// deklariert — nicht, welches Programm die Datei geschrieben hat. Was hier NICHT behauptet wird:
// dass Word bei „Grafik einfügen" byte-genau diese Datei erzeugt. Es wird behauptet, dass es ein
// gültiges EMF bzw. WMF ist, und genau das prüft die Testkette an der Signatur nach.
import { readFileSync, writeFileSync } from "node:fs";

const JSZIP = new URL("../apps/web/node_modules/jszip/lib/index.js", import.meta.url);
const JSZipMod = await import(JSZIP.href);
const JSZip = JSZipMod.default ?? JSZipMod;

/** Ein gültiges, minimales EMF: EMR_HEADER (88 B) + EMR_EOF (20 B). */
function emfBytes() {
  const kopf = Buffer.alloc(88);
  kopf.writeUInt32LE(1, 0); // iType   = EMR_HEADER  → die Signatur \x01\x00\x00\x00
  kopf.writeUInt32LE(88, 4); // nSize
  // rclBounds (16 B) und rclFrame (16 B) ab Byte 8: ein 1×1-Rahmen, damit die Angaben stimmig sind.
  kopf.writeInt32LE(0, 8);
  kopf.writeInt32LE(0, 12);
  kopf.writeInt32LE(1, 16);
  kopf.writeInt32LE(1, 20);
  kopf.writeInt32LE(0, 24);
  kopf.writeInt32LE(0, 28);
  kopf.writeInt32LE(1000, 32);
  kopf.writeInt32LE(1000, 36);
  kopf.write(" EMF", 40, "latin1"); // dSignature — die Kennung, an der ein EMF erkannt wird
  kopf.writeUInt32LE(0x00010000, 44); // nVersion
  kopf.writeUInt32LE(108, 48); // nBytes  = Kopf + EOF
  kopf.writeUInt32LE(2, 52); // nRecords
  kopf.writeUInt16LE(0, 56); // nHandles
  const eof = Buffer.alloc(20);
  eof.writeUInt32LE(14, 0); // iType = EMR_EOF
  eof.writeUInt32LE(20, 4); // nSize
  eof.writeUInt32LE(20, 16); // nSizeLast
  return Buffer.concat([kopf, eof]);
}

/** Ein gültiges, minimales „placeable" WMF: Aldus-Kopf + WMF-Kopf + EOF-Record. */
function wmfBytes() {
  const aldus = Buffer.alloc(22);
  aldus.writeUInt32LE(0x9ac6cdd7, 0); // key — Bytes d7 cd c6 9a, die Kennung des placeable WMF
  aldus.writeUInt16LE(0, 4); // hmf
  aldus.writeInt16LE(0, 6); // bounding box
  aldus.writeInt16LE(0, 8);
  aldus.writeInt16LE(1000, 10);
  aldus.writeInt16LE(1000, 12);
  aldus.writeUInt16LE(1440, 14); // inch
  aldus.writeUInt32LE(0, 16); // reserved
  aldus.writeUInt16LE(0, 20); // checksum (für diesen Zweck nicht ausgerechnet)
  const kopf = Buffer.alloc(18);
  kopf.writeUInt16LE(1, 0); // type = memory metafile
  kopf.writeUInt16LE(9, 2); // headerSize in Wörtern
  kopf.writeUInt16LE(0x0300, 4); // version
  kopf.writeUInt32LE(15, 6); // size in Wörtern
  kopf.writeUInt16LE(0, 10); // numberOfObjects
  kopf.writeUInt32LE(3, 12); // maxRecord
  const eof = Buffer.alloc(6);
  eof.writeUInt32LE(3, 0); // recordSize in Wörtern
  eof.writeUInt16LE(0, 4); // recordFunction = META_EOF
  return Buffer.concat([aldus, kopf, eof]);
}

const quelle = readFileSync("tests/fixtures/job2912-zwei-bilder.docx");
const zip = await JSZip.loadAsync(quelle);
const contentTypes = await zip.file("[Content_Types].xml").async("string");
const rels = await zip.file("word/_rels/document.xml.rels").async("string");

// Bild 1 wird ein ECHTES EMF, Bild 2 ein ECHTES WMF. Das PNG weicht damit ganz aus dieser
// Fixture — die Gegenprobe mit PNG steht weiterhin in `job2912-zwei-bilder.docx`.
zip.remove("word/media/bild1.png");
zip.remove("word/media/bild2.png");
zip.file("word/media/bild1.emf", emfBytes());
zip.file("word/media/bild2.wmf", wmfBytes());

const neueCT = contentTypes.replace(
  '<Default Extension="png" ContentType="image/png"/>',
  '<Default Extension="emf" ContentType="image/x-emf"/><Default Extension="wmf" ContentType="image/x-wmf"/>',
);
if (neueCT === contentTypes) throw new Error("png-Default nicht gefunden — Fixture anders gebaut");
zip.file("[Content_Types].xml", neueCT);

const neueRels = rels
  .replace("media/bild1.png", "media/bild1.emf")
  .replace("media/bild2.png", "media/bild2.wmf");
if (neueRels === rels) throw new Error("Rels auf die Bildteile nicht gefunden");
zip.file("word/_rels/document.xml.rels", neueRels);

const bytes = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("tests/fixtures/job2912-echtes-metafile.docx", bytes);

console.log(
  "EMF-Bytes:",
  emfBytes().length,
  "Signatur Byte0-3:",
  emfBytes().subarray(0, 4).toString("hex"),
  "Byte40-43:",
  emfBytes().subarray(40, 44).toString("latin1"),
);
console.log(
  "WMF-Bytes:",
  wmfBytes().length,
  "Signatur Byte0-3:",
  wmfBytes().subarray(0, 4).toString("hex"),
);
console.log("geschrieben: tests/fixtures/job2912-echtes-metafile.docx —", bytes.length, "Bytes");

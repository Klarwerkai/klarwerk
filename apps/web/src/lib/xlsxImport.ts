// ================================================================================================
// R-0179 / FR-EXT-01 (Nacharbeit 3, Bens Befund) — EXCEL ALS IMPORTQUELLE.
// ================================================================================================
//
// Eine Excel-Tabelle (.xlsx) wird zu denselben Einträgen wie eine JSON-Datei und geht danach über
// genau denselben Weg: `parseImportItems` (strenge Prüfung, dieselben Meldungen) → Prüfliste →
// Annahme durch einen Menschen. Kein zweiter Importkern, kein neuer Server-Endpunkt.
//
// DAS FORMAT: das ERSTE Arbeitsblatt. Seine erste Zeile trägt die Feldnamen des JSON-Formats
// (`title`, `statement`, `type`, `category`; optional `author`, `tags`, `provider`, `externalId`,
// `sourceVersion`, `url`, `updatedAt`, `bodyHtml`, …). Jede weitere nicht leere Zeile ist ein
// Eintrag. `tags` darf mehrere Werte durch Komma oder Semikolon getrennt tragen; `updatedAt` darf
// eine Excel-Datumszelle sein. Weitere Blätter werden nicht gelesen, sondern gezählt gemeldet.
//
// SICHERHEIT: entpackt wird über den budgetierten Streaming-Entpacker des PPTX-Imports
// (`budgetedPptxUnzip`, Ist-Byte-Zählung, Zip-Bomben-Grenzen) — nur die benötigten Einträge.
// Gelesen wird ohne XML-Parser über schmale Muster; Formeln werden nicht ausgewertet, es zählt der
// gespeicherte Wert.
import type { ImportItemInput } from "../api/types";
import { parseImportItems } from "./importReview";
import {
  type FflateStreaming,
  PptxTooLargeError,
  type PptxUnzip,
  assertArchiveWithinBudget,
  budgetedPptxUnzip,
} from "./pptx";

/** Die einzigen Einträge eines .xlsx-Archivs, die entpackt werden. */
export const XLSX_NEEDED_ENTRY_RE =
  /^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/;
export const XLSX_SHEET_ENTRY_RE = /^xl\/worksheets\/sheet\d+\.xml$/;
/** Komprimierte Datei-Obergrenze vor dem Entpacken — dieselbe wie beim PPTX-Import. */
export const XLSX_MAX_COMPRESSED_BYTES = 50 * 1024 * 1024;

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Der budgetierte Entpacker des PPTX-Imports, auf die Excel-Einträge beschränkt. */
export function budgetedXlsxUnzip(fflate: FflateStreaming): PptxUnzip {
  return budgetedPptxUnzip(fflate, {
    neededEntry: XLSX_NEEDED_ENTRY_RE,
    countedEntry: XLSX_SHEET_ENTRY_RE,
  });
}

export function istXlsxDatei(file: { name: string; type?: string }): boolean {
  return file.name.toLowerCase().endsWith(".xlsx") || file.type === XLSX_MIME;
}

export type XlsxImportFehler = "unreadable" | "too-large" | "empty";

export class XlsxImportError extends Error {
  constructor(readonly kind: XlsxImportFehler) {
    super(`xlsx-${kind}`);
    this.name = "XlsxImportError";
  }
}

export interface XlsxImportErgebnis {
  items: ImportItemInput[];
  /** Arbeitsblätter hinter dem ersten — sie wurden nicht gelesen. */
  weitereBlaetter: number;
}

// Die Muster. Ein Namensraum-Präfix (`x:row`) ist überall erlaubt.
const LAUTSCHRIFT = /<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g;
const TEXTLAUF = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g;
const GEMEINSAMER_TEXT = /<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/g;
const BEZIEHUNG = /<(?:\w+:)?Relationship\b([^>]*)>/g;
const BLATT = /<(?:\w+:)?sheet\b([^>]*)>/g;
// Eine leere Zeile ist selbstschließend (`<row r="2"/>`) und wird übergangen — sie darf die nächste
// Zeile nicht verschlucken.
const ZEILE = /<(?:\w+:)?row\b[^>]*?(?<!\/)>([\s\S]*?)<\/(?:\w+:)?row>/g;
const ZELLE = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
const WERT = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/;
const ENTITAET = /&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g;

const ENTITAETEN: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function entschluesseln(text: string): string {
  return text.replace(ENTITAET, (_, e: string) => {
    if (e.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(e.slice(2), 16));
    }
    if (e.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(e.slice(1), 10));
    }
    return ENTITAETEN[e] ?? "";
  });
}

const dekoder = new TextDecoder("utf-8");

function text(bytes: Uint8Array | undefined): string {
  return bytes ? dekoder.decode(bytes) : "";
}

/** Alle Textläufe eines Ausschnitts, verbunden (Rich-Text einer Zelle), ohne Lautschrift. */
function textLaeufe(xml: string): string {
  let aus = "";
  for (const m of xml.replace(LAUTSCHRIFT, "").matchAll(TEXTLAUF)) {
    aus += entschluesseln(m[1] ?? "");
  }
  return aus;
}

function gemeinsameTexte(xml: string): string[] {
  return [...xml.matchAll(GEMEINSAMER_TEXT)].map((m) => textLaeufe(m[1] ?? ""));
}

/** Die Pfade der Arbeitsblätter in Arbeitsmappen-Reihenfolge. */
function blaetter(workbook: string, rels: string): string[] {
  const ziele = new Map<string, string>();
  for (const m of rels.matchAll(BEZIEHUNG)) {
    const attr = m[1] ?? "";
    const id = /\bId="([^"]+)"/.exec(attr)?.[1];
    const ziel = /\bTarget="([^"]+)"/.exec(attr)?.[1];
    if (id && ziel) {
      ziele.set(id, ziel.startsWith("/") ? ziel.slice(1) : `xl/${ziel}`);
    }
  }
  const aus: string[] = [];
  for (const m of workbook.matchAll(BLATT)) {
    const id = /\b\w+:id="([^"]+)"/.exec(m[1] ?? "")?.[1];
    const pfad = id === undefined ? undefined : ziele.get(id);
    if (pfad) {
      aus.push(pfad);
    }
  }
  return aus;
}

/** Spaltenbuchstaben → Index ab 0 („A" → 0, „AA" → 26). */
export function spaltenIndex(zelle: string): number {
  const buchstaben = /^([A-Z]+)/.exec(zelle)?.[1] ?? "";
  let n = 0;
  for (const b of buchstaben) {
    n = n * 26 + (b.charCodeAt(0) - 64);
  }
  return n - 1;
}

type Zelle = { art: "text"; wert: string } | { art: "zahl"; wert: number };

function zellwert(attr: string, inhalt: string, texte: readonly string[]): Zelle | null {
  const typ = /\bt="([^"]+)"/.exec(attr)?.[1] ?? "n";
  const v = WERT.exec(inhalt)?.[1];
  if (typ === "inlineStr") {
    return { art: "text", wert: textLaeufe(inhalt) };
  }
  if (v === undefined) {
    return null;
  }
  if (typ === "s") {
    return { art: "text", wert: texte[Number(v)] ?? "" };
  }
  if (typ === "str" || typ === "e") {
    return { art: "text", wert: entschluesseln(v) };
  }
  if (typ === "b") {
    return { art: "text", wert: v === "1" ? "true" : "false" };
  }
  return v.trim() !== "" && Number.isFinite(Number(v)) ? { art: "zahl", wert: Number(v) } : null;
}

/** Die Zeilen eines Arbeitsblatts als Zellen je Spalte. Leere Zellen fehlen. */
function zeilen(xml: string, texte: readonly string[]): Map<number, Zelle>[] {
  const aus: Map<number, Zelle>[] = [];
  for (const zeile of xml.matchAll(ZEILE)) {
    const zellen = new Map<number, Zelle>();
    let naechste = 0;
    for (const c of (zeile[1] ?? "").matchAll(ZELLE)) {
      const attr = c[1] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attr)?.[1];
      const spalte = ref ? spaltenIndex(ref) : naechste;
      naechste = spalte + 1;
      const wert = zellwert(attr, c[2] ?? "", texte);
      if (wert) {
        zellen.set(spalte, wert);
      }
    }
    aus.push(zellen);
  }
  return aus;
}

const TAG_MS = 24 * 60 * 60 * 1000;

/** Excel-Seriennummer (1900er System) → ISO. Tag 0 ist der 30.12.1899. */
export function excelDatumZuIso(serie: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serie * TAG_MS)).toISOString();
}

function feldwert(feld: string, zelle: Zelle): unknown {
  if (feld === "tags") {
    return String(zelle.wert)
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  if (feld === "sourceVersion") {
    if (zelle.art === "zahl") {
      return zelle.wert;
    }
    const roh = zelle.wert.trim();
    return roh === "" ? undefined : /^\d+$/.test(roh) ? Number(roh) : roh;
  }
  if (feld === "updatedAt" && zelle.art === "zahl") {
    return excelDatumZuIso(zelle.wert);
  }
  return String(zelle.wert);
}

function istLeer(eintrag: Record<string, unknown>): boolean {
  return Object.values(eintrag).every(
    (w) => (typeof w === "string" && w.trim() === "") || (Array.isArray(w) && w.length === 0),
  );
}

/**
 * Die Einträge des ersten Arbeitsblatts — geprüft von `parseImportItems`. Wirft
 * `XlsxImportError` (Archiv oder Blatt unlesbar, zu groß, keine Datenzeile) oder `ImportParseError`
 * (ein Eintrag verletzt das Format; gezählt werden die Datenzeilen ab 1).
 */
export function leseXlsxEintraege(daten: Uint8Array, unzip: PptxUnzip): XlsxImportErgebnis {
  if (daten.byteLength > XLSX_MAX_COMPRESSED_BYTES) {
    throw new XlsxImportError("too-large");
  }
  let dateien: Record<string, Uint8Array>;
  try {
    dateien = unzip(daten);
    assertArchiveWithinBudget(dateien);
  } catch (e) {
    throw new XlsxImportError(e instanceof PptxTooLargeError ? "too-large" : "unreadable");
  }
  const reihenfolge = blaetter(
    text(dateien["xl/workbook.xml"]),
    text(dateien["xl/_rels/workbook.xml.rels"]),
  );
  const erstes = reihenfolge[0];
  const blatt = erstes === undefined ? undefined : dateien[erstes];
  if (blatt === undefined) {
    throw new XlsxImportError("unreadable");
  }
  const texte = gemeinsameTexte(text(dateien["xl/sharedStrings.xml"]));
  const [kopf, ...datenzeilen] = zeilen(text(blatt), texte);
  if (!kopf) {
    throw new XlsxImportError("empty");
  }
  const felder = new Map<number, string>();
  for (const [spalte, zelle] of kopf) {
    const name = String(zelle.wert).trim();
    if (name !== "") {
      felder.set(spalte, name);
    }
  }
  const eintraege: Record<string, unknown>[] = [];
  for (const zeile of datenzeilen) {
    const eintrag: Record<string, unknown> = {};
    for (const [spalte, zelle] of zeile) {
      const feld = felder.get(spalte);
      const wert = feld === undefined ? undefined : feldwert(feld, zelle);
      if (feld !== undefined && wert !== undefined) {
        eintrag[feld] = wert;
      }
    }
    if (!istLeer(eintrag)) {
      eintraege.push(eintrag);
    }
  }
  if (eintraege.length === 0) {
    throw new XlsxImportError("empty");
  }
  return {
    items: parseImportItems(JSON.stringify(eintraege)),
    weitereBlaetter: reihenfolge.length - 1,
  };
}

let xlsxUnzipPromise: Promise<PptxUnzip> | null = null;

/** Die Datei aus dem Browser lesen — fflate wird erst hier geladen (Muster `files.ts`). */
export async function leseXlsxDatei(file: File): Promise<XlsxImportErgebnis> {
  if (file.size > XLSX_MAX_COMPRESSED_BYTES) {
    throw new XlsxImportError("too-large");
  }
  if (!xlsxUnzipPromise) {
    xlsxUnzipPromise = (async () => {
      const mod = (await import("fflate")) as unknown as FflateStreaming & {
        default?: FflateStreaming;
      };
      return budgetedXlsxUnzip(mod.default ?? mod);
    })();
  }
  const unzip = await xlsxUnzipPromise;
  return leseXlsxEintraege(new Uint8Array(await file.arrayBuffer()), unzip);
}

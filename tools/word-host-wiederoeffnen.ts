// ================================================================================================
// WORD-HOST-GESAMTWEG · SPEICHERN, SCHLIESSEN, WIEDERÖFFNEN — GEGEN VORHER FESTGELEGTE SOLLWERTE.
// ================================================================================================
//
// Kriterium 3 des Auftrags `aufnahme:20260922:word-echter-arbeitsweg`: „Speichern, Schließen und
// Wiederöffnen erhalten Inhalt, Bilder, Zuordnung und Quelle; unabhängige Sollinhalte und
// Prüfsummen werden verglichen." Ein Bildschirmfoto des wieder geöffneten Dokuments zeigt nicht,
// ob ein Bild still ausgetauscht, eine Tabellenzelle verloren oder eine Unterschrift dem falschen
// Bild zugeordnet wurde. Dieses Werkzeug vergleicht deshalb gegen Werte, die VOR dem Lauf feststehen
// und nicht aus dem geprüften System stammen:
//
//   · das Prüfdokument entsteht aus den Prüfbildern von `tests/rueckweg-bilder-nutzerweg/
//     pruefbilder.ts` (Bildpunkte als Rechenregel, zwei verschiedene Maße) und dem DOCX-Baukasten
//     `tests/m5-docx-bildunterschriften/docx-bauen.ts`;
//   · das Sollpaket nennt Überschrift, Absätze, fetten Text, Tabelle, Bildprüfsummen (Bytes und
//     Bildpunkte), die Unterschrift je Bild und einen je Host verschiedenen Änderungssatz;
//   · verglichen wird (a) die nach dem Wiederöffnen heruntergeladene DOCX und (b) der Eintrag in
//     KLARWERK (Entwurf oder Wissensobjekt als JSON), einschließlich Herkunft `word_addin` und
//     Dokumentkennung.
//
// Word Web und Word für Mac sind getrennte Läufe mit getrennten Sollpaketen: der Änderungssatz
// nennt den Host, ein Mac-Ergebnis besteht den Web-Vergleich also nicht.
//
// DIESES WERKZEUG BEDIENT WORD NICHT und ersetzt keinen Menschen im Host. Kein Netz, keine Anmeldung.
// Die beiden Bausteine aus `tests/` lädt nur der Befehl `sollpaket` zur Laufzeit; das Modul selbst
// hängt nicht an ihnen. Ablauf: `docs/operations/word-host-gesamtweg.md`, Abschnitte 1 und 2.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { inflateSync } from "node:zlib";
import JSZip from "jszip";

export const SOLL_KENNUNG = "word-host-wiederoeffnen-v1";

export type Host = "Word Web" | "Word Mac";

export const PRUEF_UEBERSCHRIFT = "Prüfdokument Ventilwartung";
export const PRUEF_FETT_VOR = "Vor der Wartung die Anlage ";
export const PRUEF_FETT = "drucklos schalten";
export const PRUEF_FETT_NACH = " und gegen Wiedereinschalten sichern.";
export const PRUEF_TABELLE: readonly (readonly string[])[] = [
  ["Schritt", "Prüfwert"],
  ["Druck", "0 bar"],
  ["Dichtung", "getauscht"],
];
export const PRUEF_UNTERSCHRIFTEN: readonly string[] = [
  "Abbildung 1: Ventil vor dem Tausch",
  "Abbildung 2: Ventil nach dem Tausch",
];

/** Der Satz, den die Person im Host ans Ende schreibt — je Host verschieden. */
export function aenderungssatz(host: Host): string {
  return `Geändert in ${host}: Schritt 3 entfällt, die Dichtung wird bei jeder Sichtprüfung getauscht.`;
}

/** Die Absatzformen, die das Prüfdokument braucht — eine Teilmenge von `docx-bauen.ts` `Absatz`. */
export type PruefAbsatz =
  | { readonly art: "ueberschrift"; readonly text: string }
  | { readonly art: "beschriftung"; readonly text: string }
  | {
      readonly art: "absatz";
      readonly laeufe: readonly { readonly text: string; readonly fett?: boolean }[];
    }
  | { readonly art: "tabelle"; readonly zeilen: readonly (readonly string[])[] }
  | { readonly art: "bild"; readonly png: string; readonly alt?: string };

export interface Sollbild {
  readonly nr: number;
  readonly sha256Png: string;
  /** Prüfsumme der Bildpunkte (RGB, zeilenweise) — trägt, wenn Word das PNG neu verpackt. */
  readonly sha256Rgb: string;
  readonly unterschrift: string;
}

export interface Sollpaket {
  readonly kennung: typeof SOLL_KENNUNG;
  readonly host: Host;
  /** Die Textabsätze außerhalb der Tabelle, in Dokumentreihenfolge. */
  readonly absaetze: readonly string[];
  readonly fett: readonly string[];
  readonly tabelle: readonly (readonly string[])[];
  readonly bilder: readonly Sollbild[];
  readonly aenderung: string;
}

export interface Vergleichsbefund {
  readonly feld: string;
  /** abweichung = verloren/verändert · offen = mit diesem Material nicht prüfbar */
  readonly lage: "abweichung" | "offen";
  readonly text: string;
}

export interface Vergleichsurteil {
  readonly host: Host;
  readonly gleich: boolean;
  readonly befunde: Vergleichsbefund[];
}

export function sha256(wert: string | Buffer): string {
  return createHash("sha256").update(wert).digest("hex");
}

function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ------------------------------------------------------------------------------------------------
// BILDPUNKTE EINES PNG — damit ein neu verpacktes, aber bildpunktgleiches Bild nicht als Verlust
// gilt und ein still verändertes nicht als gleich. Nur 8 Bit RGB/RGBA ohne Zeilensprung; alles
// andere ergibt `null` (dann zählt allein die Byteprüfsumme).
// ------------------------------------------------------------------------------------------------

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  return pb <= pc ? b : c;
}

function entfiltern(filter: number, x: number, a: number, b: number, c: number): number | null {
  if (filter === 0) {
    return x;
  }
  if (filter === 1) {
    return x + a;
  }
  if (filter === 2) {
    return x + b;
  }
  if (filter === 3) {
    return x + Math.floor((a + b) / 2);
  }
  if (filter === 4) {
    return x + paeth(a, b, c);
  }
  return null;
}

export function bildpunktSha256(png: Buffer): string | null {
  const SIGNATUR = "89504e470d0a1a0a";
  if (png.length < 33 || png.subarray(0, 8).toString("hex") !== SIGNATUR) {
    return null;
  }
  let breite = 0;
  let hoehe = 0;
  let farbtyp = -1;
  const idat: Buffer[] = [];
  let pos = 8;
  while (pos + 8 <= png.length) {
    const laenge = png.readUInt32BE(pos);
    const typ = png.subarray(pos + 4, pos + 8).toString("latin1");
    const daten = png.subarray(pos + 8, pos + 8 + laenge);
    if (typ === "IHDR") {
      if (daten.length < 13 || daten.readUInt8(8) !== 8 || daten.readUInt8(12) !== 0) {
        return null;
      }
      breite = daten.readUInt32BE(0);
      hoehe = daten.readUInt32BE(4);
      farbtyp = daten.readUInt8(9);
    } else if (typ === "IDAT") {
      idat.push(daten);
    } else if (typ === "IEND") {
      break;
    }
    pos += 12 + laenge;
  }
  const kanaele = farbtyp === 2 ? 3 : farbtyp === 6 ? 4 : 0;
  if (kanaele === 0 || breite === 0 || hoehe === 0) {
    return null;
  }
  let roh: Buffer;
  try {
    roh = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const zeile = breite * kanaele;
  if (roh.length < hoehe * (zeile + 1)) {
    return null;
  }
  const rgb = Buffer.alloc(breite * hoehe * 3);
  let vorher = Buffer.alloc(zeile);
  for (let y = 0; y < hoehe; y += 1) {
    const start = y * (zeile + 1);
    const filter = roh.readUInt8(start);
    const aus = Buffer.alloc(zeile);
    for (let i = 0; i < zeile; i += 1) {
      const links = i >= kanaele ? aus.readUInt8(i - kanaele) : 0;
      const oben = vorher.readUInt8(i);
      const obenLinks = i >= kanaele ? vorher.readUInt8(i - kanaele) : 0;
      const wert = entfiltern(filter, roh.readUInt8(start + 1 + i), links, oben, obenLinks);
      if (wert === null) {
        return null;
      }
      aus.writeUInt8(wert & 0xff, i);
    }
    for (let px = 0; px < breite; px += 1) {
      if (kanaele === 4 && aus.readUInt8(px * 4 + 3) !== 255) {
        return null;
      }
      aus.copy(rgb, (y * breite + px) * 3, px * kanaele, px * kanaele + 3);
    }
    vorher = aus;
  }
  return sha256(rgb);
}

// ------------------------------------------------------------------------------------------------
// DAS SOLLPAKET UND DAS PRÜFDOKUMENT
// ------------------------------------------------------------------------------------------------

/** Die Absätze des Prüfdokuments für `baueDocx` — vor jeder Bearbeitung im Host. */
export function pruefdokumentAbsaetze(bilder: readonly Buffer[]): PruefAbsatz[] {
  const absaetze: PruefAbsatz[] = [
    { art: "ueberschrift", text: PRUEF_UEBERSCHRIFT },
    {
      art: "absatz",
      laeufe: [
        { text: PRUEF_FETT_VOR },
        { text: PRUEF_FETT, fett: true },
        { text: PRUEF_FETT_NACH },
      ],
    },
    { art: "tabelle", zeilen: PRUEF_TABELLE },
  ];
  bilder.forEach((png, i) => {
    const unterschrift = PRUEF_UNTERSCHRIFTEN[i] ?? `Abbildung ${i + 1}`;
    absaetze.push({ art: "bild", png: png.toString("base64"), alt: `Prüfbild ${i + 1}` });
    absaetze.push({ art: "beschriftung", text: unterschrift });
  });
  return absaetze;
}

export function sollpaket(host: Host, bilder: readonly Buffer[]): Sollpaket {
  const sollbilder: Sollbild[] = [];
  bilder.forEach((png, i) => {
    const rgb = bildpunktSha256(png);
    if (rgb === null) {
      throw new Error(`Prüfbild ${i + 1} ist kein lesbares 8-Bit-PNG`);
    }
    sollbilder.push({
      nr: i + 1,
      sha256Png: sha256(png),
      sha256Rgb: rgb,
      unterschrift: PRUEF_UNTERSCHRIFTEN[i] ?? `Abbildung ${i + 1}`,
    });
  });
  const aenderung = aenderungssatz(host);
  return {
    kennung: SOLL_KENNUNG,
    host,
    absaetze: [
      PRUEF_UEBERSCHRIFT,
      `${PRUEF_FETT_VOR}${PRUEF_FETT}${PRUEF_FETT_NACH}`,
      ...sollbilder.map((b) => b.unterschrift),
      aenderung,
    ],
    fett: [PRUEF_FETT],
    tabelle: PRUEF_TABELLE,
    bilder: sollbilder,
    aenderung,
  };
}

// ------------------------------------------------------------------------------------------------
// DIE WIEDER GEÖFFNETE DOCX LESEN
// ------------------------------------------------------------------------------------------------

export type Folgeglied = { art: "text"; text: string } | { art: "bild"; index: number };

export interface IstBild {
  readonly datei: string;
  readonly sha256Png: string;
  readonly sha256Rgb: string | null;
}

export interface DocxInhalt {
  readonly absaetze: string[];
  readonly fett: string[];
  readonly tabellen: string[][][];
  readonly bilder: IstBild[];
  readonly folge: Folgeglied[];
}

function entitaeten(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function absatzText(xml: string): string {
  let text = "";
  for (const treffer of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>/g)) {
    text += treffer[1] === undefined ? "\t" : entitaeten(treffer[1]);
  }
  return normal(text);
}

function fetterText(xml: string): string {
  let text = "";
  for (const [lauf] of xml.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)) {
    const rpr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(lauf)?.[1] ?? "";
    const b = /<w:b(?:\s+w:val="([^"]*)")?\s*\/>/.exec(rpr);
    if (b && !["0", "false", "off"].includes((b[1] ?? "").toLowerCase())) {
      text += absatzText(lauf);
    }
  }
  return normal(text);
}

/** Die Bildbeziehungen des Dokuments: Kennung → Pfad im Paket. */
function bildBeziehungen(xml: string): Map<string, string> {
  const ziele = new Map<string, string>();
  for (const [, attribute = ""] of xml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const werte = new Map<string, string>();
    for (const [, name = "", wert = ""] of attribute.matchAll(/(\w+)="([^"]*)"/g)) {
      werte.set(name, wert);
    }
    const id = werte.get("Id");
    const ziel = werte.get("Target");
    const istBild = (werte.get("Type") ?? "").endsWith("/image");
    if (id && ziel && istBild && werte.get("TargetMode") !== "External") {
      ziele.set(id, ziel.startsWith("/") ? ziel.slice(1) : posix.normalize(`word/${ziel}`));
    }
  }
  return ziele;
}

export async function liesDocx(bytes: Buffer): Promise<DocxInhalt> {
  const zip = await JSZip.loadAsync(bytes);
  const dokument = await zip.file("word/document.xml")?.async("string");
  if (dokument === undefined) {
    throw new Error("keine Word-Datei: word/document.xml fehlt");
  }
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
  const rels = bildBeziehungen(relsXml ?? "");
  const rumpf = /<w:body>([\s\S]*)<\/w:body>/.exec(dokument)?.[1] ?? "";
  const inhalt: DocxInhalt = { absaetze: [], fett: [], tabellen: [], bilder: [], folge: [] };
  const glieder = rumpf.matchAll(
    /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,
  );
  for (const [glied] of glieder) {
    if (glied.startsWith("<w:tbl>")) {
      const tabelle: string[][] = [];
      for (const [reihe] of glied.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)) {
        const zellen: string[] = [];
        for (const [zelle] of reihe.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)) {
          zellen.push(absatzText(zelle));
        }
        tabelle.push(zellen);
      }
      inhalt.tabellen.push(tabelle);
      continue;
    }
    for (const [, kennung = ""] of glied.matchAll(/(?:r:embed|r:id)="([^"]+)"/g)) {
      const datei = rels.get(kennung);
      const daten = datei === undefined ? undefined : await zip.file(datei)?.async("nodebuffer");
      if (datei === undefined || daten === undefined) {
        continue;
      }
      inhalt.bilder.push({
        datei,
        sha256Png: sha256(daten),
        sha256Rgb: bildpunktSha256(daten),
      });
      inhalt.folge.push({ art: "bild", index: inhalt.bilder.length - 1 });
    }
    const text = absatzText(glied);
    if (text.length > 0) {
      inhalt.absaetze.push(text);
      inhalt.folge.push({ art: "text", text });
      const fett = fetterText(glied);
      if (fett.length > 0) {
        inhalt.fett.push(fett);
      }
    }
  }
  return inhalt;
}

// ------------------------------------------------------------------------------------------------
// DIE VERGLEICHE
// ------------------------------------------------------------------------------------------------

interface Bildsumme {
  readonly sha256Png: string;
  readonly sha256Rgb: string | null;
}

function bildVergleichen(soll: Sollbild, ist: Bildsumme, feld: string): Vergleichsbefund | null {
  const bytegleich = ist.sha256Png === soll.sha256Png;
  const punktgleich = ist.sha256Rgb !== null && ist.sha256Rgb === soll.sha256Rgb;
  if (bytegleich || punktgleich) {
    return null;
  }
  return {
    feld,
    lage: "abweichung",
    text: `Bild ${soll.nr} weicht ab — weder die Bytes noch die Bildpunkte stimmen mit dem Soll überein`,
  };
}

function bilderVergleichen(
  soll: Sollpaket,
  ist: readonly Bildsumme[],
  befunde: Vergleichsbefund[],
): void {
  if (ist.length !== soll.bilder.length) {
    const art = ist.length > soll.bilder.length ? "doppelt oder fremd übertragen" : "Bild verloren";
    befunde.push({
      feld: "bilder",
      lage: "abweichung",
      text: `${ist.length} Bilder statt ${soll.bilder.length} — ${art}`,
    });
  }
  soll.bilder.forEach((sollbild, i) => {
    const istbild = ist[i];
    const befund = istbild === undefined ? null : bildVergleichen(sollbild, istbild, `bild[${i}]`);
    if (befund) {
      befunde.push(befund);
    }
  });
}

function texteVergleichen(
  soll: Sollpaket,
  absaetze: readonly string[],
  befunde: Vergleichsbefund[],
): void {
  let ab = 0;
  soll.absaetze.forEach((erwartet, i) => {
    const gefunden = absaetze.findIndex((a, j) => j >= ab && a === normal(erwartet));
    if (gefunden === -1) {
      befunde.push({
        feld: `absatz[${i}]`,
        lage: "abweichung",
        text: `fehlt oder steht an falscher Stelle: „${erwartet}“`,
      });
    } else {
      ab = gefunden + 1;
    }
  });
  const aenderungen = absaetze.filter((a) => a === normal(soll.aenderung)).length;
  if (aenderungen > 1) {
    befunde.push({
      feld: "aenderung",
      lage: "abweichung",
      text: `der Änderungssatz steht ${aenderungen}-mal da — doppelt übertragen`,
    });
  }
}

/** Die nach dem Wiederöffnen heruntergeladene DOCX gegen das Sollpaket. */
export function vergleicheDocx(soll: Sollpaket, ist: DocxInhalt): Vergleichsurteil {
  const befunde: Vergleichsbefund[] = [];
  texteVergleichen(soll, ist.absaetze, befunde);
  for (const fett of soll.fett) {
    if (!ist.fett.some((f) => f.includes(normal(fett)))) {
      befunde.push({ feld: "fett", lage: "abweichung", text: `„${fett}“ ist nicht mehr fett` });
    }
  }
  const sollTabelle = JSON.stringify(soll.tabelle.map((z) => z.map(normal)));
  if (!ist.tabellen.some((t) => JSON.stringify(t) === sollTabelle)) {
    befunde.push({
      feld: "tabelle",
      lage: "abweichung",
      text: "die Tabelle fehlt oder ist verändert",
    });
  }
  bilderVergleichen(soll, ist.bilder, befunde);
  // ZUORDNUNG: auf Bild k folgt als nächster Text genau seine Unterschrift.
  ist.folge.forEach((glied, pos) => {
    if (glied.art !== "bild") {
      return;
    }
    const sollbild = soll.bilder[glied.index];
    if (sollbild === undefined) {
      return;
    }
    const naechster = ist.folge.slice(pos + 1).find((g) => g.art === "text");
    const text = naechster?.art === "text" ? naechster.text : "";
    if (text !== normal(sollbild.unterschrift)) {
      befunde.push({
        feld: `zuordnung[${glied.index}]`,
        lage: "abweichung",
        text: `auf Bild ${glied.index + 1} folgt nicht „${sollbild.unterschrift}“`,
      });
    }
  });
  return { host: soll.host, gleich: befunde.length === 0, befunde };
}

function htmlText(html: string): string {
  return normal(entitaeten(html.replace(/<[^>]+>/g, " ")));
}

function bildunterschriftenAus(objekt: Record<string, unknown>, html: string): string[] {
  const ausHtml = [...html.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g)];
  if (ausHtml.length > 0) {
    return ausHtml.map(([, c = ""]) => htmlText(c));
  }
  if (Array.isArray(objekt.captionTexts)) {
    return objekt.captionTexts.map((c) => normal(String(c)));
  }
  return [];
}

export interface Objekterwartung {
  readonly objektId?: string;
  readonly dokumentId?: string;
}

/**
 * Der Eintrag in KLARWERK (Entwurf `GET /api/drafts/<id>` oder Wissensobjekt `GET /api/kos/<id>`,
 * als JSON gespeichert) gegen dasselbe Sollpaket: Inhalt, Bilder, Zuordnung und Quelle.
 */
export function vergleicheObjekt(
  soll: Sollpaket,
  objekt: unknown,
  erwartung: Objekterwartung = {},
): Vergleichsurteil {
  const befunde: Vergleichsbefund[] = [];
  const basis = objekt !== null && typeof objekt === "object" ? objekt : {};
  const o = basis as Record<string, unknown>;
  const roh = o.payload !== null && typeof o.payload === "object" ? o.payload : o;
  const nutzlast = roh as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (id === "") {
    befunde.push({ feld: "id", lage: "abweichung", text: "der Eintrag trägt keine Kennung" });
  } else if (erwartung.objektId !== undefined && id !== erwartung.objektId) {
    befunde.push({
      feld: "id",
      lage: "abweichung",
      text: `Kennung ${id} statt ${erwartung.objektId} — ein anderer Eintrag`,
    });
  }
  if (nutzlast.origin !== "word_addin") {
    befunde.push({
      feld: "quelle.origin",
      lage: "abweichung",
      text: `Herkunft „${String(nutzlast.origin)}“ statt „word_addin“`,
    });
  }
  const herkunftRoh = o.dokumentHerkunft ?? nutzlast.dokumentHerkunft;
  const herkunft = herkunftRoh as Record<string, unknown> | undefined;
  const kennungRoh = herkunft?.dokumentId;
  const dokumentId = typeof kennungRoh === "string" ? kennungRoh : "";
  if (dokumentId === "") {
    befunde.push({
      feld: "quelle.dokumentHerkunft",
      lage: "abweichung",
      text: "keine Dokumentkennung — die Bindung an die Word-Datei fehlt",
    });
  } else if (erwartung.dokumentId !== undefined && dokumentId !== erwartung.dokumentId) {
    befunde.push({
      feld: "quelle.dokumentHerkunft",
      lage: "abweichung",
      text: `Dokumentkennung ${dokumentId} statt ${erwartung.dokumentId}`,
    });
  }
  const html = typeof nutzlast.bodyHtml === "string" ? nutzlast.bodyHtml : "";
  const text = htmlText(html);
  soll.absaetze.forEach((absatz, i) => {
    if (!text.includes(normal(absatz))) {
      befunde.push({ feld: `absatz[${i}]`, lage: "abweichung", text: `fehlt: „${absatz}“` });
    }
  });
  for (const zelle of soll.tabelle.flat()) {
    if (!text.includes(normal(zelle))) {
      befunde.push({
        feld: "tabelle",
        lage: "abweichung",
        text: `Tabellenzelle fehlt: „${zelle}“`,
      });
    }
  }
  const quellen = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map(([, src = ""]) => src);
  const lesbar: Bildsumme[] = [];
  quellen.forEach((src, i) => {
    const daten = /^data:image\/[\w+.-]+;base64,(.*)$/.exec(src)?.[1];
    if (daten === undefined) {
      befunde.push({
        feld: `bild[${i}]`,
        lage: "offen",
        text: "Bild liegt nur als Adresse vor — herunterladen und mit `vergleiche-bild` prüfen",
      });
      return;
    }
    const bytes = Buffer.from(daten, "base64");
    lesbar.push({ sha256Png: sha256(bytes), sha256Rgb: bildpunktSha256(bytes) });
  });
  if (lesbar.length === quellen.length) {
    bilderVergleichen(soll, lesbar, befunde);
  } else if (quellen.length !== soll.bilder.length) {
    befunde.push({
      feld: "bilder",
      lage: "abweichung",
      text: `${quellen.length} Bilder statt ${soll.bilder.length}`,
    });
  }
  const unterschriften = bildunterschriftenAus(o, html);
  const sollUnterschriften = soll.bilder.map((b) => normal(b.unterschrift));
  if (JSON.stringify(unterschriften) !== JSON.stringify(sollUnterschriften)) {
    befunde.push({
      feld: "zuordnung",
      lage: "abweichung",
      text: `Bildunterschriften ${JSON.stringify(unterschriften)} statt ${JSON.stringify(sollUnterschriften)}`,
    });
  }
  return { host: soll.host, gleich: befunde.length === 0, befunde };
}

export interface Anleitungserwartung {
  readonly objektId: string;
  readonly fassung: number;
}

/**
 * Ergänzung 4 (nur Word Web, Rolle admin): die zurückgegebene Anleitung nach dem Wiederöffnen
 * (`GET /api/kos/<id>` als JSON) gegen einen VOR dem Lauf geschriebenen Solltext — jede nicht leere
 * Zeile muss in dieser Reihenfolge im Eintrag stehen. Dazu dieselbe Kennung, die neue Fassung und
 * der Status der Direktfreigabe.
 */
export function vergleicheAnleitung(
  sollText: string,
  objekt: unknown,
  erwartung: Anleitungserwartung,
): Vergleichsurteil {
  const befunde: Vergleichsbefund[] = [];
  const basis = objekt !== null && typeof objekt === "object" ? objekt : {};
  const o = basis as Record<string, unknown>;
  if (o.id !== erwartung.objektId) {
    befunde.push({
      feld: "id",
      lage: "abweichung",
      text: `Kennung ${String(o.id)} statt ${erwartung.objektId} — nicht dasselbe Wissensobjekt`,
    });
  }
  if (o.version !== erwartung.fassung) {
    befunde.push({
      feld: "version",
      lage: "abweichung",
      text: `Fassung ${String(o.version)} statt ${erwartung.fassung}`,
    });
  }
  if (o.status !== "validiert") {
    befunde.push({
      feld: "status",
      lage: "abweichung",
      text: `Status „${String(o.status)}“ statt „validiert“`,
    });
  }
  const html = typeof o.bodyHtml === "string" ? o.bodyHtml : "";
  const statement = typeof o.statement === "string" ? o.statement : "";
  const text = htmlText(`${html} ${statement}`);
  const alleZeilen = sollText.split("\n").map(normal);
  const zeilen = alleZeilen.filter((z) => z.length > 0);
  if (zeilen.length === 0) {
    befunde.push({ feld: "soll", lage: "offen", text: "der Solltext ist leer" });
  }
  let ab = 0;
  zeilen.forEach((zeile, i) => {
    const stelle = text.indexOf(zeile, ab);
    if (stelle === -1) {
      befunde.push({
        feld: `zeile[${i}]`,
        lage: "abweichung",
        text: `fehlt oder steht an falscher Stelle: „${zeile}“`,
      });
    } else {
      ab = stelle + zeile.length;
    }
  });
  return { host: "Word Web", gleich: befunde.length === 0, befunde };
}

/** Ein einzeln heruntergeladenes Bild gegen Bild `nr` des Sollpakets. */
export function vergleicheBild(soll: Sollpaket, nr: number, png: Buffer): Vergleichsurteil {
  const sollbild = soll.bilder.find((b) => b.nr === nr);
  const befunde: Vergleichsbefund[] = [];
  if (sollbild === undefined) {
    befunde.push({
      feld: `bild[${nr - 1}]`,
      lage: "abweichung",
      text: `das Sollpaket kennt Bild ${nr} nicht`,
    });
  } else {
    const ist = { sha256Png: sha256(png), sha256Rgb: bildpunktSha256(png) };
    const befund = bildVergleichen(sollbild, ist, `bild[${nr - 1}]`);
    if (befund) {
      befunde.push(befund);
    }
  }
  return { host: soll.host, gleich: befunde.length === 0, befunde };
}

// ================================================================================================
// DER AUFRUF — `node tools/word-host-wiederoeffnen.ts <befehl> …`
// ================================================================================================

/** Was der Befehl `sollpaket` aus den zwei Bausteinen braucht — nicht mehr. */
interface PruefbilderModul {
  readonly FIXTUREN: readonly { readonly png: Buffer }[];
}
interface BaukastenModul {
  baueDocx(absaetze: readonly PruefAbsatz[]): Promise<{ readonly bytes: Buffer }>;
}

const PRUEFBILDER_QUELLE = "../tests/rueckweg-bilder-nutzerweg/pruefbilder.ts";
const BAUKASTEN_QUELLE = "../tests/m5-docx-bildunterschriften/docx-bauen.ts";

function ausgeben(urteil: Vergleichsurteil): void {
  console.log(`Host: ${urteil.host}`);
  if (urteil.gleich) {
    console.log("✓ gleich dem Soll");
    return;
  }
  console.error(`✖ ${urteil.befunde.length} Befund(e):`);
  for (const b of urteil.befunde) {
    console.error(`   [${b.lage}] ${b.feld}: ${b.text}`);
  }
  process.exitCode = 1;
}

function liesSoll(datei: string): Sollpaket {
  const soll = JSON.parse(readFileSync(datei, "utf8")) as Sollpaket;
  if (soll.kennung !== SOLL_KENNUNG) {
    throw new Error(`${datei} ist kein Sollpaket (${SOLL_KENNUNG})`);
  }
  return soll;
}

async function sollpaketAblegen(kurz: "web" | "mac", ordner: string): Promise<void> {
  const host: Host = kurz === "web" ? "Word Web" : "Word Mac";
  // Die vorhandenen Bausteine, als Quelltext geladen (Node führt TypeScript direkt aus).
  const bilderAdresse = new URL(PRUEFBILDER_QUELLE, import.meta.url).href;
  const baukastenAdresse = new URL(BAUKASTEN_QUELLE, import.meta.url).href;
  const pruefbilder = (await import(bilderAdresse)) as PruefbilderModul;
  const baukasten = (await import(baukastenAdresse)) as BaukastenModul;
  const pngs = pruefbilder.FIXTUREN.map((f) => f.png);
  const docx = await baukasten.baueDocx(pruefdokumentAbsaetze(pngs));
  const dokumentDatei = join(ordner, `pruefdokument-${kurz}.docx`);
  const sollDatei = join(ordner, `soll-${kurz}.json`);
  const sollText = `${JSON.stringify(sollpaket(host, pngs), null, 2)}\n`;
  mkdirSync(ordner, { recursive: true });
  writeFileSync(dokumentDatei, docx.bytes);
  writeFileSync(sollDatei, sollText);
  console.log(`✓ ${dokumentDatei} und ${sollDatei} für ${host}`);
}

async function aufruf(argumente: readonly string[]): Promise<void> {
  const [befehl, a, b, c] = argumente;
  if (befehl === "sollpaket" && (a === "web" || a === "mac") && b) {
    await sollpaketAblegen(a, b);
    return;
  }
  if (befehl === "vergleiche-docx" && a && b) {
    ausgeben(vergleicheDocx(liesSoll(a), await liesDocx(readFileSync(b))));
    return;
  }
  if (befehl === "vergleiche-objekt" && a && b) {
    const erwartung: Objekterwartung = c ? { objektId: c } : {};
    ausgeben(vergleicheObjekt(liesSoll(a), JSON.parse(readFileSync(b, "utf8")), erwartung));
    return;
  }
  if (befehl === "vergleiche-bild" && a && b && c) {
    ausgeben(vergleicheBild(liesSoll(a), Number(b), readFileSync(c)));
    return;
  }
  const [, , , , fassung] = argumente;
  if (befehl === "vergleiche-anleitung" && a && b && c && fassung) {
    const objekt = JSON.parse(readFileSync(b, "utf8"));
    const erwartung = { objektId: c, fassung: Number(fassung) };
    ausgeben(vergleicheAnleitung(readFileSync(a, "utf8"), objekt, erwartung));
    return;
  }
  console.error(
    [
      "Aufruf:",
      "  node tools/word-host-wiederoeffnen.ts sollpaket <web|mac> <ordner>",
      "  node tools/word-host-wiederoeffnen.ts vergleiche-docx <soll.json> <datei.docx>",
      "  node tools/word-host-wiederoeffnen.ts vergleiche-objekt <soll.json> <eintrag.json> [id]",
      "  node tools/word-host-wiederoeffnen.ts vergleiche-bild <soll.json> <nr> <bild.png>",
      "  node tools/word-host-wiederoeffnen.ts vergleiche-anleitung <soll.txt> <ko.json> <id> <n>",
    ].join("\n"),
  );
  process.exitCode = 2;
}

// Direktaufruf — beim Import aus dem Test passiert hier nichts.
if (process.argv[1]?.endsWith("word-host-wiederoeffnen.ts")) {
  aufruf(process.argv.slice(2)).catch((fehler: unknown) => {
    console.error(`✖ ${fehler instanceof Error ? fehler.message : String(fehler)}`);
    process.exitCode = 2;
  });
}

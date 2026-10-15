// ================================================================================================
// KLARA POWERPOINT · PP-02 — DATENHERKUNFT UND BINDUNG AN FOLIEN
// (Auftrag produkt:20261015:klara-powerpoint-datenherkunft, Integrationsplan Abschnitt 2).
// ================================================================================================
//
// WAS DAS IST. Ein gemeinsames Daten-/Aussagenobjekt („Datenpunkt“) für eine Zahl oder Aussage auf
// einer Folie: Wert, Einheit/Währung, Bezugszeitraum, Bezugsgröße, Quelle mit der verwendeten
// Fassung, Fundstelle, Erfassungsart (direkt, OCR, manuell, berechnet, prognostiziert), Rechenweg
// mit den tatsächlich verwendeten Eingaben, Annahmen, Prüfungen, Korrekturen — und die Bindung an
// Folie und Element. Es schließt L04 und L17 aus `docs/klara-powerpoint/BESTAND.md`.
//
// WAS WIEDERVERWENDET WIRD, statt es ein zweites Mal zu bauen:
//   · Folien lesen: `lesePraesentation` (W06) — `p:sldId`, Folienteil, Titel.
//   · Folienidentität: `p:sldId` + Dateifassung (SHA-256 der Bytes), wie W10 sie führt; nie die
//     Foliennummer. Das Element dazu ist die Shape-Kennung (`p:cNvPr/@id`).
//   · Rechenweg: die Arten und die Rechnung von V06 (`rechne`, `BERECHNUNGSARTEN`).
//   · Rechte: der Aufrufer liefert Artikel nur, wenn `ko.read` und `darfSehen` gelten (Umgebung).
//   · OCR: die Erkennung läuft unverändert im vorhandenen Weg (W03/W01). Hier wird nur ihr Ergebnis
//     an das Bild gebunden — über die Inhaltskennung der Bildbytes, die der Server selbst nachrechnet.
//
// VALIDIERUNG (Abschnitt 5 des Pakets). Die Prüfdimensionen Erkennung, Struktur, Berechnung,
// Konsistenz, Aktualität und fachliche Freigabe stehen getrennt. Jede Prüfung ist an den
// FINGERABDRUCK der Datenfassung gebunden (Wert, Einheit, Zeitraum, Bezugsgröße, Quelle samt
// Fassung, Fundstelle, Rechenweg samt Eingabefassungen, Annahmen). Ändert sich einer davon, gilt die
// alte Prüfung als überholt — sie bleibt sichtbar, trägt aber keinen Status mehr. Eine neue
// Quellfassung oder eine geänderte Eingabe macht den Datenpunkt „Überprüfung nötig“. OCR allein,
// eine verlässliche Quelle oder ein grüner Teiltest validieren nie: „validiert“ heißt nur, dass alle
// für DIESE Fassung erforderlichen Dimensionen bestanden sind, die fachliche Freigabe eingeschlossen.
//
// KEIN MODELL läuft hier. Kein Schreiben in die Präsentation: Bindungen sind Verweise auf Elemente.

import { createHash } from "node:crypto";
import type { KnowledgeObject } from "../../knowledge-object";
import { BERECHNUNGSARTEN, lesePraesentation, rechne } from "./office-nachbearbeitung";

// ------------------------------------------------------------------------------------------------
// FEHLER
// ------------------------------------------------------------------------------------------------

/** `kein_zugriff` wird an der Route zu 404 (keine Existenzauskunft), `ungueltig` zu 400. */
export class DatenFehler extends Error {
  constructor(
    readonly art: "kein_zugriff" | "ungueltig",
    message: string,
  ) {
    super(message);
    this.name = "DatenFehler";
  }
}

// ------------------------------------------------------------------------------------------------
// FOLIEN UND ELEMENTE EINER PPTX-FASSUNG
// ------------------------------------------------------------------------------------------------

export interface Tabellenzelle {
  /** Ab 1. */
  readonly zeile: number;
  /** Ab 1. */
  readonly spalte: number;
  readonly text: string;
}

export interface FolienElement {
  /** `p:cNvPr/@id` — die Kennung des Elements auf seiner Folie. */
  readonly shapeId: string;
  readonly name: string;
  readonly art: "text" | "tabelle" | "bild";
  /** Absätze durch Zeilenumbruch getrennt; bei Tabellen die Zeilen als „Zelle | Zelle“. */
  readonly text: string;
  readonly zellen?: readonly Tabellenzelle[];
  /** Bei Bildern: `sha256:<hex>` der Bildbytes (dieselbe Form wie die OCR-Inhaltskennung). */
  readonly bild?: { readonly kennung: string; readonly bildAufFolie: number };
}

export interface FolieMitElementen {
  readonly sldId: string;
  readonly position: number;
  readonly titel: string;
  readonly ausgeblendet: boolean;
  readonly elemente: readonly FolienElement[];
}

export interface FoliensatzDaten {
  /** SHA-256 der Dateibytes — dieselbe Fassungskennung wie W10. */
  readonly fassung: string;
  readonly folien: readonly FolieMitElementen[];
}

function sha256(daten: Uint8Array | string): string {
  return createHash("sha256").update(daten).digest("hex");
}

function xmlText(roh: string): string {
  return roh
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function attribut(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** Der Text eines Ausschnitts: Absätze (`a:p`) aus Läufen (`a:t`), je Absatz eine Zeile. */
function absatzText(xml: string): string {
  return [...xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)]
    .map((p) =>
      [...(p[1] ?? "").matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
        .map((t) => xmlText(t[1] ?? ""))
        .join(""),
    )
    .filter((z) => z.trim().length > 0)
    .join("\n");
}

function zellenAus(xml: string): Tabellenzelle[] {
  const zellen: Tabellenzelle[] = [];
  let zeile = 0;
  for (const tr of xml.matchAll(/<a:tr(?:\s[^>]*)?>([\s\S]*?)<\/a:tr>/g)) {
    zeile += 1;
    let spalte = 0;
    for (const tc of (tr[1] ?? "").matchAll(/<a:tc(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/a:tc>)/g)) {
      spalte += 1;
      zellen.push({ zeile, spalte, text: absatzText(tc[1] ?? "").replace(/\n/g, " ") });
    }
  }
  return zellen;
}

function aufloesen(verzeichnis: string, ziel: string): string {
  const teile = ziel.startsWith("/") ? [] : verzeichnis.split("/").filter(Boolean);
  for (const t of ziel.replace(/^\//, "").split("/")) {
    if (t === "..") {
      teile.pop();
    } else if (t !== "." && t !== "") {
      teile.push(t);
    }
  }
  return teile.join("/");
}

/** Ein Element einer Folie: Form, Grafikrahmen (Tabelle) oder Bild — in Dokumentreihenfolge. */
const ELEMENT = /<p:(sp|graphicFrame|pic)(?=[\s>])[^>]*>([\s\S]*?)<\/p:\1>/g;

/**
 * Liest Folien und Elemente einer `.pptx`. Gelesen wird nur; Tabellen kommen mit Zeile und Spalte,
 * Bilder mit der Inhaltskennung ihrer Bytes. Diagramme, SmartArt und Notizen liest dieser Weg nicht
 * (L03) — sie erscheinen nicht als Element und lassen sich daher auch nicht binden.
 */
export async function leseFolienDaten(bytes: Buffer): Promise<FoliensatzDaten> {
  const praes = await lesePraesentation(bytes);
  const folien: FolieMitElementen[] = [];
  for (const f of praes.folien) {
    const xml = (await praes.zip.file(f.pfad)?.async("string")) ?? "";
    const verzeichnis = f.pfad.slice(0, f.pfad.lastIndexOf("/"));
    const relsPfad = `${verzeichnis}/_rels/${f.pfad.slice(verzeichnis.length + 1)}.rels`;
    const rels = (await praes.zip.file(relsPfad)?.async("string")) ?? "";
    const ziele = new Map(
      [...rels.matchAll(/<Relationship\s[^>]*>/g)].map(
        (r) => [attribut(r[0], "Id") ?? "", attribut(r[0], "Target") ?? ""] as const,
      ),
    );
    const elemente: FolienElement[] = [];
    let bilder = 0;
    for (const m of xml.matchAll(ELEMENT)) {
      const art = m[1];
      const inhalt = m[2] ?? "";
      const cNvPr = /<p:cNvPr\s[^>]*>/.exec(inhalt)?.[0] ?? "";
      const shapeId = attribut(cNvPr, "id");
      if (!shapeId) {
        continue;
      }
      const name = xmlText(attribut(cNvPr, "name") ?? "");
      if (art === "pic") {
        bilder += 1;
        const rId = /<a:blip\s[^>]*r:embed="([^"]+)"/.exec(inhalt)?.[1];
        const ziel = rId ? ziele.get(rId) : undefined;
        const daten = ziel
          ? await praes.zip.file(aufloesen(verzeichnis, ziel))?.async("uint8array")
          : undefined;
        if (daten) {
          elemente.push({
            shapeId,
            name,
            art: "bild",
            text: "",
            bild: { kennung: `sha256:${sha256(daten)}`, bildAufFolie: bilder },
          });
        }
        continue;
      }
      if (art === "graphicFrame") {
        if (!inhalt.includes("<a:tbl")) {
          continue; // Diagramm, SmartArt, OLE: nicht gelesen (L03).
        }
        const zellen = zellenAus(inhalt);
        const zeilen = new Map<number, string[]>();
        for (const z of zellen) {
          zeilen.set(z.zeile, [...(zeilen.get(z.zeile) ?? []), z.text]);
        }
        elemente.push({
          shapeId,
          name,
          art: "tabelle",
          text: [...zeilen.values()].map((z) => z.join(" | ")).join("\n"),
          zellen,
        });
        continue;
      }
      const text = absatzText(inhalt);
      if (text.trim()) {
        elemente.push({ shapeId, name, art: "text", text });
      }
    }
    folien.push({
      sldId: String(f.folieId),
      position: f.nummer,
      titel: f.titel,
      ausgeblendet: f.ausgeblendet,
      elemente,
    });
  }
  return { fassung: sha256(bytes), folien };
}

// ------------------------------------------------------------------------------------------------
// ZAHLEN
// ------------------------------------------------------------------------------------------------

const ZAHLTOKEN = /(?:(?<![\p{L}\p{N}])[-+−])?\d+(?:[.,]\d+)*/gu;

/**
 * Liest eine Zahl in deutscher Schreibweise: „1.500“ = 1500, „1,5“ = 1,5, „1.234,5“ = 1234,5.
 * Mehrere Kommas („1,234,567“) lesen sich als Tausendertrennung, ein einzelner Punkt mit weniger
 * oder mehr als drei Nachkommastellen als Dezimalpunkt („1.5“).
 */
function zahlAusToken(token: string): number {
  let s = token.replace(/−/g, "-").replace(/^\+/, "");
  const punkte = (s.match(/\./g) ?? []).length;
  const kommas = (s.match(/,/g) ?? []).length;
  if (punkte > 0 && kommas > 0) {
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (kommas > 1) {
    s = s.replace(/,/g, "");
  } else if (kommas === 1) {
    s = s.replace(",", ".");
  } else if (punkte > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  return Number(s);
}

/** Die EINE Zahl eines Werts („1.500 T€“ → 1500); `undefined`, wenn keine oder mehrere drinstehen. */
export function zahlAusWert(wert: string): number | undefined {
  const token = [...wert.matchAll(ZAHLTOKEN)].map((m) => m[0]);
  if (token.length !== 1 || token[0] === undefined) {
    return undefined;
  }
  const zahl = zahlAusToken(token[0]);
  return Number.isFinite(zahl) ? zahl : undefined;
}

function normal(text: string): string {
  return text.replace(/[\s\u00a0\u202f]+/g, " ").trim();
}

/** Steht der Wert (so wie geschrieben) im Text? Leerraum zählt nicht. */
export function stehtIn(text: string, wert: string): boolean {
  const w = normal(wert);
  return w.length > 0 && normal(text).includes(w);
}

/** Ersetzt die Zahl in einer Vorlage („29,4 %“) durch eine neue, mit `stellen` Nachkommastellen. */
export function formatiere(zahl: number, stellen: number, vorlage: string): string {
  const neu = zahl.toLocaleString("de-DE", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
  const token = [...vorlage.matchAll(ZAHLTOKEN)][0];
  if (!token || token.index === undefined) {
    return neu;
  }
  return `${vorlage.slice(0, token.index)}${neu}${vorlage.slice(token.index + token[0].length)}`;
}

function runde(zahl: number, stellen: number): number {
  const f = 10 ** stellen;
  return Math.round(zahl * f) / f;
}

// ------------------------------------------------------------------------------------------------
// DAS DATENOBJEKT
// ------------------------------------------------------------------------------------------------

/** Wie der Wert in Klarwerk gekommen ist (Abschnitt 4: Kennzeichnung). */
export type Erfassung = "direkt" | "ocr" | "manuell" | "berechnet" | "prognose";
export const ERFASSUNGEN: readonly Erfassung[] = [
  "direkt",
  "ocr",
  "manuell",
  "berechnet",
  "prognose",
];

/** Die Prüfdimensionen aus Abschnitt 5 — getrennt geführt. */
export type Dimension =
  | "erkennung"
  | "struktur"
  | "berechnung"
  | "konsistenz"
  | "aktualitaet"
  | "fachliche_freigabe";
export const DIMENSIONEN: readonly Dimension[] = [
  "erkennung",
  "struktur",
  "berechnung",
  "konsistenz",
  "aktualitaet",
  "fachliche_freigabe",
];

export type Berechnungsart = (typeof BERECHNUNGSARTEN)[number];

/** Die Quelle mit der tatsächlich verwendeten Fassung. */
export interface Quellbezug {
  readonly koId: string;
  /** Die Artikelfassung beim Erfassen. */
  readonly koFassung: number;
  /** Bei einer Datei: der Anhang, sein Objekt und die Dateifassung (SHA-256). */
  readonly anhangId?: string;
  readonly objectId?: string;
  readonly dateiFassung?: string;
}

/** Wo der Wert in der Quelle steht. Folie und Element über ihre stabilen Kennungen. */
export type Fundstelle =
  | {
      readonly art: "folienelement";
      readonly sldId: string;
      readonly shapeId: string;
      readonly folienPosition: number;
      readonly folienTitel: string;
      readonly elementName: string;
      readonly zitat: string;
    }
  | {
      readonly art: "tabellenzelle";
      readonly sldId: string;
      readonly shapeId: string;
      readonly folienPosition: number;
      readonly folienTitel: string;
      readonly elementName: string;
      readonly zeile: number;
      readonly spalte: number;
      readonly zeilenkopf: string;
      readonly spaltenkopf: string;
      readonly zitat: string;
    }
  | {
      readonly art: "bild";
      readonly sldId: string;
      readonly shapeId: string;
      readonly folienPosition: number;
      readonly folienTitel: string;
      readonly elementName: string;
      readonly bildKennung: string;
      /** Der erkannte Text, wie die Texterkennung ihn geliefert hat. */
      readonly ocrText: string;
      /** Die Erkennung meldete unsichere Stellen. */
      readonly unsicher: boolean;
    }
  | { readonly art: "artikel"; readonly zitat: string }
  | { readonly art: "eingabe"; readonly beleg?: string }
  | { readonly art: "rechenweg" };

export interface RechenwegEingabe {
  readonly datenpunktId: string;
  /** Die Fassung der Eingabe, mit der gerechnet wurde. */
  readonly fassung: number;
  readonly wert: string;
  readonly zahl: number;
}

export interface Rechenweg {
  readonly art: Berechnungsart;
  readonly eingaben: readonly RechenwegEingabe[];
  /** Lesbar, mit den eingesetzten Werten. */
  readonly formel: string;
  /** Nachkommastellen der Rundung. */
  readonly stellen: number;
  /** Das ungerundete Ergebnis. */
  readonly roh: number;
  readonly ergebnis: number;
}

export interface Pruefung {
  readonly id: string;
  readonly dimension: Dimension;
  readonly ergebnis: "bestanden" | "klaerung";
  readonly grund: string;
  /** Konto-Kennung; maschinelle Prüfungen tragen `klarwerk:<weg>`. */
  readonly von: string;
  readonly am: string;
  /** Die Datenfassung, für die die Prüfung gilt. */
  readonly datenFassung: number;
  readonly fingerabdruck: string;
}

export interface Bindung {
  readonly id: string;
  readonly koId: string;
  readonly anhangId: string;
  /** Objekt und Dateifassung, an denen gebunden wurde. */
  readonly objectId: string;
  readonly dateiFassung: string;
  readonly artikelFassung: number;
  readonly sldId: string;
  readonly shapeId: string;
  readonly zeile?: number;
  readonly spalte?: number;
  readonly folienPosition: number;
  readonly folienTitel: string;
  readonly elementName: string;
  /** Die Datenfassung beim Binden. */
  readonly datenFassung: number;
  readonly von: string;
  readonly am: string;
}

export interface Inhalt {
  readonly art: "zahl" | "aussage";
  /** Wie auf der Folie bzw. in der Quelle geschrieben („1.500 T€“). */
  readonly wert: string;
  readonly zahl?: number;
  readonly einheit?: string;
  readonly waehrung?: string;
  readonly zeitraum?: string;
  readonly bezugsgroesse?: string;
  readonly erfassung: Erfassung;
  readonly quelle?: Quellbezug;
  readonly fundstelle: Fundstelle;
  readonly rechenweg?: Rechenweg;
  readonly annahmen?: readonly string[];
  readonly modellbezug?: string;
}

export interface Korrektur {
  /** Die Datenfassung, die durch die Korrektur entstand. */
  readonly fassung: number;
  readonly felder: readonly string[];
  readonly vorher: Readonly<Record<string, unknown>>;
  readonly grund: string;
  readonly von: string;
  readonly am: string;
}

export interface Datenpunkt extends Inhalt {
  readonly id: string;
  /** Der Artikel, dem der Datenpunkt gehört; Leserecht an ihm ist Voraussetzung jeder Sicht. */
  readonly heimatKoId: string;
  /** Die Datenfassung: steigt mit jeder inhaltlichen Änderung. */
  readonly fassung: number;
  /** Speicherstand: steigt mit jedem Schreiben (Grundlage des bedingten Schreibens). */
  readonly stand: number;
  readonly erfasstVon: string;
  readonly erfasstAm: string;
  readonly pruefungen: readonly Pruefung[];
  readonly bindungen: readonly Bindung[];
  readonly korrekturen: readonly Korrektur[];
}

/** Der Fingerabdruck der Datenfassung: alles, woran eine Prüfung hängt. */
export function fingerabdruck(d: Inhalt): string {
  return sha256(
    JSON.stringify({
      art: d.art,
      wert: normal(d.wert),
      zahl: d.zahl ?? null,
      einheit: d.einheit ?? null,
      waehrung: d.waehrung ?? null,
      zeitraum: d.zeitraum ?? null,
      bezugsgroesse: d.bezugsgroesse ?? null,
      erfassung: d.erfassung,
      quelle: d.quelle ?? null,
      fundstelle: d.fundstelle,
      rechenweg: d.rechenweg
        ? {
            art: d.rechenweg.art,
            stellen: d.rechenweg.stellen,
            eingaben: d.rechenweg.eingaben.map((e) => [e.datenpunktId, e.fassung, e.zahl]),
          }
        : null,
      annahmen: d.annahmen ?? null,
      modellbezug: d.modellbezug ?? null,
    }),
  );
}

// ------------------------------------------------------------------------------------------------
// UMGEBUNG — Rechte und Bestand kommen vom Aufrufer
// ------------------------------------------------------------------------------------------------

/** Was ohne Inhalt über einen Artikel bekannt sein darf (für Status und Schutzstufe). */
export interface ArtikelMeta {
  readonly version: number;
  readonly confidentiality?: KnowledgeObject["confidentiality"];
  readonly anhaenge: readonly { readonly id: string; readonly objectId?: string }[];
}

export interface DatenUmgebung {
  /** Der Artikel, wenn der handelnde Nutzer ihn lesen darf (`ko.read` + `darfSehen`); sonst nichts. */
  artikel(koId: string): Promise<KnowledgeObject | undefined>;
  /** Fassung, Schutzstufe und Anhangsobjekte ohne Inhalt — nur für Status und Schutzstufe. */
  meta(koId: string): Promise<ArtikelMeta | undefined>;
  /** Folien der AKTUELLEN Fassung eines PPTX-Anhangs eines lesbaren Artikels. */
  folien(
    koId: string,
    anhangId: string,
  ): Promise<{ objectId: string; name: string; satz: FoliensatzDaten } | undefined>;
  /** Ein gespeicherter Datenpunkt — ohne Rechteprüfung; die Sicht prüft selbst. */
  datenpunkt(id: string): Promise<Datenpunkt | undefined>;
  /** Anzeigename eines Kontos. */
  name(nutzerId: string): Promise<string | undefined>;
}

async function lesbar(dp: Datenpunkt, u: DatenUmgebung): Promise<boolean> {
  return vollLesbar(dp, u);
}

/** Die Tiefe, bis zu der Eingabeketten verfolgt werden (Rechte, Sicht, Schutzstufe). */
const KETTENTIEFE = 8;

/**
 * Nacharbeit 2 (Bens Befund 1) — LESEN HEISST: DIE GANZE HERKUNFT LESEN DÜRFEN.
 *
 * Ein Datenpunkt trägt Inhalte seiner Quelle (Wert, Fundstelle mit Zitat, OCR-Text) und seiner
 * Eingaben (Formel mit deren Werten, Prüfgründe, Korrekturen). Wer die Quelle oder eine Eingabe
 * nicht lesen darf, erhielte sie sonst über den Datenpunkt. Deshalb ist ein Datenpunkt nur lesbar,
 * wenn der Handelnde den Heimatartikel UND jede Quelle UND — rekursiv — jede Eingabe lesen darf,
 * jeweils auch die, die in der Korrekturhistorie stehen (frühere Quellfassung, früherer Rechenweg).
 * Sonst gibt es ihn für diesen Nutzer nicht: weder einzeln noch in Listen noch als Eingabe noch als
 * Ziel einer Wirkung. Damit ist auch die berechnete Schutzstufe durchgesetzt, nicht nur angezeigt.
 */
export async function vollLesbar(
  dp: Datenpunkt,
  u: DatenUmgebung,
  tiefe = KETTENTIEFE,
): Promise<boolean> {
  if (!(await u.artikel(dp.heimatKoId))) {
    return false;
  }
  const quellen = new Set<string>();
  const eingaben = new Set<string>();
  const quelleVon = (q: unknown) => {
    if (istObjekt(q) && typeof q.koId === "string") {
      quellen.add(q.koId);
    }
  };
  const eingabenVon = (r: unknown) => {
    if (istObjekt(r) && Array.isArray(r.eingaben)) {
      for (const e of r.eingaben) {
        if (istObjekt(e) && typeof e.datenpunktId === "string") {
          eingaben.add(e.datenpunktId);
        }
      }
    }
  };
  quelleVon(dp.quelle);
  eingabenVon(dp.rechenweg);
  for (const k of dp.korrekturen) {
    quelleVon(k.vorher.quelle);
    eingabenVon(k.vorher.rechenweg);
  }
  for (const koId of quellen) {
    if (!(await u.artikel(koId))) {
      return false;
    }
  }
  if (eingaben.size > 0 && tiefe <= 0) {
    return false; // Nicht bis zum Ende prüfbar: fail-closed.
  }
  for (const id of eingaben) {
    const ein = await u.datenpunkt(id);
    if (ein && !(await vollLesbar(ein, u, tiefe - 1))) {
      return false;
    }
  }
  return true;
}

/**
 * Nacharbeit 2 (Bens Befund 2) — EINE FRÜHERE DATENFASSUNG, aus der Korrekturhistorie zurückgerechnet.
 * Jede Korrektur hält den Stand VOR ihr fest (`vorher`, `null` = Angabe fehlte); rückwärts angewandt
 * ergibt das den Inhalt der Fassung, mit der z. B. eine Berechnung tatsächlich gerechnet hat —
 * samt ihrer damaligen Quelle (Fassung, Fundstelle) und ihrem damaligen Rechenweg. Prüfungen,
 * Korrekturen und Bindungen dieser Fassung bleiben, spätere nicht. `undefined` für eine Fassung, die
 * es nicht gibt.
 */
export function inFassung(dp: Datenpunkt, fassung: number): Datenpunkt | undefined {
  if (!Number.isInteger(fassung) || fassung < 1 || fassung > dp.fassung) {
    return undefined;
  }
  if (fassung === dp.fassung) {
    return dp;
  }
  const stand = new Map<string, unknown>(Object.entries(dp));
  for (const k of [...dp.korrekturen].sort((a, b) => b.fassung - a.fassung)) {
    if (k.fassung <= fassung) {
      break;
    }
    for (const [feld, wert] of Object.entries(k.vorher)) {
      if (wert === null || wert === undefined) {
        stand.delete(feld);
      } else {
        stand.set(feld, wert);
      }
    }
  }
  const alt = Object.fromEntries(stand) as unknown as Datenpunkt;
  return {
    ...alt,
    fassung,
    korrekturen: dp.korrekturen.filter((k) => k.fassung <= fassung),
    pruefungen: dp.pruefungen.filter((p) => p.datenFassung <= fassung),
    bindungen: dp.bindungen.filter((b) => b.datenFassung <= fassung),
  };
}

// ------------------------------------------------------------------------------------------------
// ERFASSEN — der Auftrag aus der Anfrage
// ------------------------------------------------------------------------------------------------

export interface Ort {
  readonly anhangId: string;
  readonly sldId: string;
  readonly shapeId: string;
  readonly zeile?: number;
  readonly spalte?: number;
}

export interface Erfassungsauftrag {
  readonly art: "zahl" | "aussage";
  readonly wert: string;
  readonly einheit?: string;
  readonly waehrung?: string;
  readonly zeitraum?: string;
  readonly bezugsgroesse?: string;
  readonly erfassung: Erfassung;
  /** Wo der Wert auf einer Folie steht. Bei `direkt`/`ocr` zugleich die Fundstelle. */
  readonly ort?: Ort;
  /** `direkt` aus einem anderen Artikel: dessen Kennung und die wörtliche Stelle. */
  readonly quelleKoId?: string;
  readonly zitat?: string;
  /** `ocr`: das Ergebnis der vorhandenen Texterkennung für das Bild am Ort. */
  readonly ocr?: {
    readonly text: string;
    readonly bildKennung: string;
    readonly unsicher: boolean;
  };
  /** `manuell`: worauf sich die Eingabe stützt (frei, optional). */
  readonly beleg?: string;
  /** `berechnet` (und optional `prognose`): Art, Eingaben in Reihenfolge, Nachkommastellen. */
  readonly rechenweg?: {
    readonly art: Berechnungsart;
    readonly eingaben: readonly string[];
    readonly stellen: number;
  };
  readonly annahmen?: readonly string[];
  readonly modellbezug?: string;
}

function istObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function text(x: unknown, max: number, feld: string, pflicht = false): string | undefined {
  if (x === undefined || x === null || x === "") {
    if (pflicht) {
      throw new DatenFehler("ungueltig", `${feld} fehlt.`);
    }
    return undefined;
  }
  if (typeof x !== "string" || x.length > max) {
    throw new DatenFehler("ungueltig", `${feld} ist kein Text bis ${max} Zeichen.`);
  }
  const t = x.trim();
  if (!t && pflicht) {
    throw new DatenFehler("ungueltig", `${feld} fehlt.`);
  }
  return t || undefined;
}

function ganzzahl(x: unknown, feld: string, min: number, max: number): number {
  if (!Number.isInteger(x) || (x as number) < min || (x as number) > max) {
    throw new DatenFehler("ungueltig", `${feld} muss eine Ganzzahl von ${min} bis ${max} sein.`);
  }
  return x as number;
}

export function leseOrt(roh: unknown): Ort | undefined {
  if (roh === undefined || roh === null) {
    return undefined;
  }
  if (!istObjekt(roh)) {
    throw new DatenFehler("ungueltig", "ort ist kein Objekt.");
  }
  const anhangId = text(roh.anhangId, 200, "ort.anhangId", true) as string;
  const sldId = text(roh.sldId, 20, "ort.sldId", true) as string;
  const shapeId = text(roh.shapeId, 20, "ort.shapeId", true) as string;
  const zelle = roh.zeile !== undefined || roh.spalte !== undefined;
  return {
    anhangId,
    sldId,
    shapeId,
    ...(zelle
      ? {
          zeile: ganzzahl(roh.zeile, "ort.zeile", 1, 1000),
          spalte: ganzzahl(roh.spalte, "ort.spalte", 1, 1000),
        }
      : {}),
  };
}

/** Prüft den Rumpf einer Erfassung. Wirft `DatenFehler("ungueltig")` mit einem lesbaren Satz. */
export function leseErfassung(roh: unknown): Erfassungsauftrag {
  if (!istObjekt(roh)) {
    throw new DatenFehler("ungueltig", "Die Erfassung fehlt.");
  }
  const art = roh.art;
  if (art !== "zahl" && art !== "aussage") {
    throw new DatenFehler("ungueltig", "art muss zahl oder aussage sein.");
  }
  const erfassung = roh.erfassung as Erfassung;
  if (!ERFASSUNGEN.includes(erfassung)) {
    throw new DatenFehler(
      "ungueltig",
      "erfassung muss direkt, ocr, manuell, berechnet oder prognose sein.",
    );
  }
  const wert = text(roh.wert, art === "zahl" ? 100 : 1000, "wert", true) as string;
  if (art === "zahl" && zahlAusWert(wert) === undefined) {
    throw new DatenFehler(
      "ungueltig",
      `„${wert}“ enthält nicht genau eine Zahl. Bezugsjahr oder Zeitraum gehören in „zeitraum“.`,
    );
  }
  const ort = leseOrt(roh.ort);
  let ocr: Erfassungsauftrag["ocr"];
  if (roh.ocr !== undefined) {
    if (!istObjekt(roh.ocr)) {
      throw new DatenFehler("ungueltig", "ocr ist kein Objekt.");
    }
    const bildKennung = text(roh.ocr.bildKennung, 80, "ocr.bildKennung", true) as string;
    if (!/^sha256:[0-9a-f]{64}$/.test(bildKennung)) {
      throw new DatenFehler("ungueltig", "ocr.bildKennung ist keine Inhaltskennung (sha256:…).");
    }
    ocr = {
      text: text(roh.ocr.text, 20_000, "ocr.text", true) as string,
      bildKennung,
      unsicher: roh.ocr.unsicher === true,
    };
  }
  let rechenweg: Erfassungsauftrag["rechenweg"];
  if (roh.rechenweg !== undefined) {
    const r = roh.rechenweg;
    if (
      !istObjekt(r) ||
      !BERECHNUNGSARTEN.includes(r.art as Berechnungsart) ||
      !Array.isArray(r.eingaben) ||
      r.eingaben.length < 2 ||
      r.eingaben.length > 50 ||
      !r.eingaben.every((e) => typeof e === "string" && e.length > 0 && e.length <= 100)
    ) {
      throw new DatenFehler(
        "ungueltig",
        "rechenweg braucht art (summe, differenz, anteil_prozent) und mindestens zwei Eingaben.",
      );
    }
    if (r.art === "anteil_prozent" && r.eingaben.length !== 2) {
      throw new DatenFehler("ungueltig", "Ein Anteil in Prozent braucht genau Anteil und Basis.");
    }
    rechenweg = {
      art: r.art as Berechnungsart,
      eingaben: r.eingaben as string[],
      stellen: r.stellen === undefined ? 0 : ganzzahl(r.stellen, "rechenweg.stellen", 0, 6),
    };
  }
  const annahmen =
    roh.annahmen === undefined
      ? undefined
      : Array.isArray(roh.annahmen) && roh.annahmen.length <= 20
        ? roh.annahmen.map((a, i) => text(a, 500, `annahmen[${i + 1}]`, true) as string)
        : (() => {
            throw new DatenFehler("ungueltig", "annahmen ist eine Liste (höchstens 20).");
          })();
  const auftrag: Erfassungsauftrag = {
    art,
    wert,
    erfassung,
    ...opt("einheit", text(roh.einheit, 100, "einheit")),
    ...opt("waehrung", text(roh.waehrung, 20, "waehrung")),
    ...opt("zeitraum", text(roh.zeitraum, 100, "zeitraum")),
    ...opt("bezugsgroesse", text(roh.bezugsgroesse, 200, "bezugsgroesse")),
    ...(ort ? { ort } : {}),
    ...opt("quelleKoId", text(roh.quelleKoId, 200, "quelleKoId")),
    ...opt("zitat", text(roh.zitat, 2000, "zitat")),
    ...(ocr ? { ocr } : {}),
    ...opt("beleg", text(roh.beleg, 1000, "beleg")),
    ...(rechenweg ? { rechenweg } : {}),
    ...(annahmen && annahmen.length > 0 ? { annahmen } : {}),
    ...opt("modellbezug", text(roh.modellbezug, 500, "modellbezug")),
  };
  // Je Erfassungsart die Pflichtangaben — die Kennzeichnung muss stimmen, nicht nur dastehen.
  switch (erfassung) {
    case "direkt":
      if (!ort && !(auftrag.quelleKoId && auftrag.zitat)) {
        throw new DatenFehler(
          "ungueltig",
          "Direkt übernommen braucht eine Fundstelle: ein Folienelement (ort) oder einen Artikel mit wörtlicher Stelle (quelleKoId, zitat).",
        );
      }
      break;
    case "ocr":
      if (!ort || !ocr) {
        throw new DatenFehler(
          "ungueltig",
          "OCR-erkannt braucht das Bild (ort) und das Ergebnis der Texterkennung (ocr).",
        );
      }
      break;
    case "berechnet":
      if (!rechenweg || art !== "zahl") {
        throw new DatenFehler(
          "ungueltig",
          "Ein berechneter Wert ist eine Zahl mit Rechenweg (Art und Eingaben).",
        );
      }
      break;
    case "prognose":
      if (!auftrag.annahmen) {
        throw new DatenFehler(
          "ungueltig",
          "Eine Prognose braucht mindestens eine ausdrücklich genannte Annahme.",
        );
      }
      break;
    case "manuell":
      break;
  }
  if (rechenweg && erfassung !== "berechnet" && erfassung !== "prognose") {
    throw new DatenFehler(
      "ungueltig",
      "Einen Rechenweg tragen nur berechnete Werte und Prognosen.",
    );
  }
  if (ocr && erfassung !== "ocr") {
    throw new DatenFehler("ungueltig", "Ein OCR-Ergebnis gehört nur zu einem OCR-erkannten Wert.");
  }
  return auftrag;
}

function opt<K extends string, V>(schluessel: K, wert: V | undefined): { [P in K]?: V } {
  return (wert === undefined ? {} : { [schluessel]: wert }) as { [P in K]?: V };
}

// ------------------------------------------------------------------------------------------------
// ORT, QUELLE, RECHENWEG
// ------------------------------------------------------------------------------------------------

interface OrtsLage {
  readonly koId: string;
  readonly anhangId: string;
  readonly objectId: string;
  readonly satz: FoliensatzDaten;
  readonly folie: FolieMitElementen;
  readonly element: FolienElement;
  readonly zelle?: Tabellenzelle;
}

async function ortLesen(u: DatenUmgebung, koId: string, ort: Ort): Promise<OrtsLage> {
  const datei = await u.folien(koId, ort.anhangId);
  if (!datei) {
    throw new DatenFehler(
      "ungueltig",
      "Diese Präsentation ist nicht lesbar (kein PowerPoint-Anhang dieses Artikels).",
    );
  }
  const folie = datei.satz.folien.find((f) => f.sldId === ort.sldId);
  const element = folie?.elemente.find((e) => e.shapeId === ort.shapeId);
  if (!folie || !element) {
    throw new DatenFehler(
      "ungueltig",
      "Diese Folie oder dieses Element gibt es in der aktuellen Fassung nicht.",
    );
  }
  let zelle: Tabellenzelle | undefined;
  if (ort.zeile !== undefined) {
    zelle = element.zellen?.find((z) => z.zeile === ort.zeile && z.spalte === ort.spalte);
    if (!zelle) {
      throw new DatenFehler("ungueltig", "Diese Tabellenzelle gibt es nicht.");
    }
  }
  return {
    koId,
    anhangId: ort.anhangId,
    objectId: datei.objectId,
    satz: datei.satz,
    folie,
    element,
    ...(zelle ? { zelle } : {}),
  };
}

function ortText(l: OrtsLage): string {
  return l.zelle ? l.zelle.text : l.element.text;
}

function ortName(l: OrtsLage): string {
  return l.element.name || (l.element.art === "bild" ? "Bild" : "Element");
}

function fundstelleAusOrt(l: OrtsLage): Fundstelle {
  const kopf = {
    sldId: l.folie.sldId,
    shapeId: l.element.shapeId,
    folienPosition: l.folie.position,
    folienTitel: l.folie.titel,
    elementName: ortName(l),
  };
  if (l.zelle) {
    const zellen = l.element.zellen ?? [];
    return {
      art: "tabellenzelle",
      ...kopf,
      zeile: l.zelle.zeile,
      spalte: l.zelle.spalte,
      zeilenkopf: zellen.find((z) => z.zeile === l.zelle?.zeile && z.spalte === 1)?.text ?? "",
      spaltenkopf: zellen.find((z) => z.zeile === 1 && z.spalte === l.zelle?.spalte)?.text ?? "",
      zitat: l.zelle.text,
    };
  }
  return { art: "folienelement", ...kopf, zitat: l.element.text };
}

function quelleAusOrt(l: OrtsLage, artikel: KnowledgeObject): Quellbezug {
  return {
    koId: artikel.id,
    koFassung: artikel.version,
    anhangId: l.anhangId,
    objectId: l.objectId,
    dateiFassung: l.satz.fassung,
  };
}

/** Wie der Wert am Ort zu erkennen ist: Text bzw. Zelle enthält ihn, ein Bild ist dasselbe Bild. */
function passtAmOrt(l: OrtsLage, wert: string, bildKennung?: string): string | undefined {
  if (l.element.art === "bild") {
    if (bildKennung === undefined) {
      return "Ein Bild trägt nur einen OCR-erkannten Wert desselben Bildes; nichts gebunden.";
    }
    return l.element.bild?.kennung === bildKennung
      ? undefined
      : "An dieser Stelle steht ein anderes Bild als das erkannte; nichts gebunden.";
  }
  return stehtIn(ortText(l), wert)
    ? undefined
    : `„${wert}“ steht nicht in diesem Element (Folie ${l.folie.position}${l.zelle ? `, Zeile ${l.zelle.zeile}, Spalte ${l.zelle.spalte}` : ""}).`;
}

function artikelText(ko: KnowledgeObject): string {
  const body = (ko.bodyHtml ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  return `${ko.title}\n${ko.statement}\n${body}`;
}

const ZEICHEN: Record<Berechnungsart, string> = {
  summe: " + ",
  differenz: " − ",
  anteil_prozent: " ÷ ",
};

async function rechenwegBauen(
  r: NonNullable<Erfassungsauftrag["rechenweg"]>,
  u: DatenUmgebung,
): Promise<Rechenweg> {
  const eingaben: RechenwegEingabe[] = [];
  for (const id of r.eingaben) {
    const dp = await u.datenpunkt(id);
    if (!dp || !(await lesbar(dp, u))) {
      throw new DatenFehler("kein_zugriff", "Eine Eingabe des Rechenwegs gibt es nicht.");
    }
    if (dp.art !== "zahl" || dp.zahl === undefined) {
      throw new DatenFehler("ungueltig", `Die Eingabe „${dp.wert}“ ist keine Zahl.`);
    }
    eingaben.push({ datenpunktId: dp.id, fassung: dp.fassung, wert: dp.wert, zahl: dp.zahl });
  }
  // V06 unverändert: `ergebnis` wertet `rechne` nicht aus, es gehört nur zur Form des Zahlenbelegs.
  const roh = rechne({ art: r.art, eingaben: eingaben.map((e) => e.zahl), ergebnis: "" });
  if (!Number.isFinite(roh)) {
    throw new DatenFehler("ungueltig", "Der Rechenweg ergibt keinen Wert (Basis 0?).");
  }
  const formel = `${eingaben.map((e) => e.wert).join(ZEICHEN[r.art])}${r.art === "anteil_prozent" ? " × 100" : ""}`;
  return {
    art: r.art,
    eingaben,
    formel,
    stellen: r.stellen,
    roh,
    ergebnis: runde(roh, r.stellen),
  };
}

function rechnungPasst(wert: string, rw: Rechenweg): string | undefined {
  const zahl = zahlAusWert(wert);
  if (zahl === undefined || Math.abs(zahl - rw.ergebnis) > 0.5 * 10 ** -rw.stellen) {
    return `Der Rechenweg ergibt ${rw.ergebnis.toLocaleString("de-DE", { maximumFractionDigits: rw.stellen, minimumFractionDigits: rw.stellen })}, nicht „${wert}“.`;
  }
  return undefined;
}

// ------------------------------------------------------------------------------------------------
// ERFASSEN, BINDEN, PRÜFEN, KORRIGIEREN — reine Übergänge; Speichern macht der Aufrufer
// ------------------------------------------------------------------------------------------------

export interface Handelnder {
  readonly nutzerId: string;
  readonly jetzt: string;
  readonly kennung: () => string;
}

function bindungAus(
  l: OrtsLage,
  artikel: KnowledgeObject,
  fassung: number,
  h: Handelnder,
): Bindung {
  return {
    id: h.kennung(),
    koId: l.koId,
    anhangId: l.anhangId,
    objectId: l.objectId,
    dateiFassung: l.satz.fassung,
    artikelFassung: artikel.version,
    sldId: l.folie.sldId,
    shapeId: l.element.shapeId,
    ...(l.zelle ? { zeile: l.zelle.zeile, spalte: l.zelle.spalte } : {}),
    folienPosition: l.folie.position,
    folienTitel: l.folie.titel,
    elementName: ortName(l),
    datenFassung: fassung,
    von: h.nutzerId,
    am: h.jetzt,
  };
}

function maschinell(
  dimension: Dimension,
  grund: string,
  weg: string,
  inhalt: Inhalt,
  fassung: number,
  h: Handelnder,
): Pruefung {
  return {
    id: h.kennung(),
    dimension,
    ergebnis: "bestanden",
    grund,
    von: `klarwerk:${weg}`,
    am: h.jetzt,
    datenFassung: fassung,
    fingerabdruck: fingerabdruck(inhalt),
  };
}

/**
 * Legt einen Datenpunkt am Heimatartikel an. Alle Quellen, Orte und Eingaben werden aus dem Bestand
 * gelesen — mit den Rechten des Handelnden —, nie aus dem Rumpf übernommen.
 */
export async function erfasse(
  auftrag: Erfassungsauftrag,
  heimat: KnowledgeObject,
  u: DatenUmgebung,
  h: Handelnder,
): Promise<Datenpunkt> {
  const ortLage = auftrag.ort ? await ortLesen(u, heimat.id, auftrag.ort) : undefined;
  let quelle: Quellbezug | undefined;
  let fundstelle: Fundstelle;
  let rechenweg: Rechenweg | undefined;
  const maschinelle: { dimension: Dimension; grund: string; weg: string }[] = [];

  switch (auftrag.erfassung) {
    case "direkt": {
      if (ortLage) {
        if (ortLage.element.art === "bild") {
          throw new DatenFehler(
            "ungueltig",
            "Ein Wert aus einem Bild ist OCR-erkannt, nicht direkt übernommen.",
          );
        }
        const fehler = passtAmOrt(ortLage, auftrag.wert);
        if (fehler) {
          throw new DatenFehler("ungueltig", fehler);
        }
        quelle = quelleAusOrt(ortLage, heimat);
        fundstelle = fundstelleAusOrt(ortLage);
        maschinelle.push({
          dimension: "erkennung",
          grund:
            "Der Wert steht wörtlich an der Fundstelle der verwendeten Dateifassung (vom Server gelesen).",
          weg: "pptx-leser",
        });
      } else {
        const ko = await u.artikel(auftrag.quelleKoId ?? "");
        if (!ko) {
          throw new DatenFehler("kein_zugriff", "Die Quelle gibt es nicht.");
        }
        const zitat = auftrag.zitat ?? "";
        if (!stehtIn(artikelText(ko), zitat) || !stehtIn(zitat, auftrag.wert)) {
          throw new DatenFehler(
            "ungueltig",
            "Die Stelle steht nicht wörtlich in der Quelle oder enthält den Wert nicht.",
          );
        }
        quelle = { koId: ko.id, koFassung: ko.version };
        fundstelle = { art: "artikel", zitat };
        maschinelle.push({
          dimension: "erkennung",
          grund: "Der Wert steht wörtlich an der genannten Stelle der verwendeten Artikelfassung.",
          weg: "artikeltext",
        });
      }
      break;
    }
    case "ocr": {
      if (!ortLage || !auftrag.ocr || ortLage.element.art !== "bild") {
        throw new DatenFehler("ungueltig", "OCR-erkannt braucht ein Bild auf der Folie.");
      }
      const fehler = passtAmOrt(ortLage, auftrag.wert, auftrag.ocr.bildKennung);
      if (fehler) {
        throw new DatenFehler("ungueltig", fehler);
      }
      if (!stehtIn(auftrag.ocr.text, auftrag.wert)) {
        throw new DatenFehler(
          "ungueltig",
          `„${auftrag.wert}“ steht nicht im erkannten Bildtext; nichts erfasst.`,
        );
      }
      quelle = quelleAusOrt(ortLage, heimat);
      fundstelle = {
        art: "bild",
        sldId: ortLage.folie.sldId,
        shapeId: ortLage.element.shapeId,
        folienPosition: ortLage.folie.position,
        folienTitel: ortLage.folie.titel,
        elementName: ortName(ortLage),
        bildKennung: auftrag.ocr.bildKennung,
        ocrText: auftrag.ocr.text,
        unsicher: auftrag.ocr.unsicher,
      };
      // Keine maschinelle Erkennungsprüfung: OCR allein bestätigt nichts.
      break;
    }
    case "manuell":
      fundstelle = { art: "eingabe", ...(auftrag.beleg ? { beleg: auftrag.beleg } : {}) };
      break;
    case "berechnet":
    case "prognose": {
      if (auftrag.rechenweg) {
        rechenweg = await rechenwegBauen(auftrag.rechenweg, u);
        const fehler = rechnungPasst(auftrag.wert, rechenweg);
        if (fehler) {
          throw new DatenFehler("ungueltig", fehler);
        }
        maschinelle.push({
          dimension: "berechnung",
          grund: `Nachgerechnet mit den gebundenen Eingaben: ${rechenweg.formel} = ${rechenweg.roh}, gerundet auf ${rechenweg.stellen} Nachkommastellen.`,
          weg: "rechenweg",
        });
        fundstelle = { art: "rechenweg" };
      } else {
        fundstelle = { art: "eingabe", ...(auftrag.beleg ? { beleg: auftrag.beleg } : {}) };
      }
      break;
    }
  }

  // Wo der Wert angezeigt wird (manuell/berechnet/prognose): er muss dort stehen.
  if (ortLage && auftrag.erfassung !== "direkt" && auftrag.erfassung !== "ocr") {
    const fehler = passtAmOrt(ortLage, auftrag.wert);
    if (fehler) {
      throw new DatenFehler("ungueltig", fehler);
    }
  }

  const inhalt: Inhalt = {
    art: auftrag.art,
    wert: auftrag.wert,
    ...opt("zahl", auftrag.art === "zahl" ? zahlAusWert(auftrag.wert) : undefined),
    ...opt("einheit", auftrag.einheit),
    ...opt("waehrung", auftrag.waehrung),
    ...opt("zeitraum", auftrag.zeitraum),
    ...opt("bezugsgroesse", auftrag.bezugsgroesse),
    erfassung: auftrag.erfassung,
    ...opt("quelle", quelle),
    fundstelle,
    ...opt("rechenweg", rechenweg),
    ...opt("annahmen", auftrag.annahmen),
    ...opt("modellbezug", auftrag.modellbezug),
  };
  return {
    ...inhalt,
    id: h.kennung(),
    heimatKoId: heimat.id,
    fassung: 1,
    stand: 1,
    erfasstVon: h.nutzerId,
    erfasstAm: h.jetzt,
    pruefungen: maschinelle.map((m) => maschinell(m.dimension, m.grund, m.weg, inhalt, 1, h)),
    bindungen: ortLage ? [bindungAus(ortLage, heimat, 1, h)] : [],
    korrekturen: [],
  };
}

/**
 * Bindet einen Datenpunkt an ein Element einer Präsentation — auch an eine andere als die, aus der
 * er stammt (gemeinsam nutzbar). Der Wert muss dort stehen; ein Bild muss dasselbe Bild sein.
 */
export async function binde(
  dp: Datenpunkt,
  ziel: KnowledgeObject,
  ort: Ort,
  u: DatenUmgebung,
  h: Handelnder,
): Promise<Datenpunkt> {
  const l = await ortLesen(u, ziel.id, ort);
  const fehler = passtAmOrt(
    l,
    dp.wert,
    dp.fundstelle.art === "bild" ? dp.fundstelle.bildKennung : undefined,
  );
  if (fehler) {
    throw new DatenFehler("ungueltig", fehler);
  }
  const doppelt = dp.bindungen.some(
    (b) =>
      b.koId === ziel.id &&
      b.anhangId === ort.anhangId &&
      b.objectId === l.objectId &&
      b.sldId === ort.sldId &&
      b.shapeId === ort.shapeId &&
      b.zeile === ort.zeile &&
      b.spalte === ort.spalte,
  );
  if (doppelt) {
    return dp;
  }
  return { ...dp, bindungen: [...dp.bindungen, bindungAus(l, ziel, dp.fassung, h)] };
}

/** Hält eine Prüfung fest — gebunden an die AKTUELLE Datenfassung und ihren Fingerabdruck. */
export function pruefe(
  dp: Datenpunkt,
  eingabe: { dimension: Dimension; ergebnis: "bestanden" | "klaerung"; grund?: string },
  h: Handelnder,
): Datenpunkt {
  if (!DIMENSIONEN.includes(eingabe.dimension)) {
    throw new DatenFehler("ungueltig", "Unbekannte Prüfdimension.");
  }
  if (!erforderlich(dp).includes(eingabe.dimension)) {
    throw new DatenFehler(
      "ungueltig",
      `Die Dimension ${eingabe.dimension} trifft auf diesen Datenpunkt nicht zu.`,
    );
  }
  const grund = eingabe.grund?.trim() ?? "";
  if (eingabe.ergebnis === "klaerung" && !grund) {
    throw new DatenFehler("ungueltig", "Ein Klärungsbedarf braucht einen Grund.");
  }
  return {
    ...dp,
    pruefungen: [
      ...dp.pruefungen,
      {
        id: h.kennung(),
        dimension: eingabe.dimension,
        ergebnis: eingabe.ergebnis,
        grund: grund || "Geprüft.",
        von: h.nutzerId,
        am: h.jetzt,
        datenFassung: dp.fassung,
        fingerabdruck: fingerabdruck(dp),
      },
    ],
  };
}

export interface Korrekturauftrag {
  readonly wert?: string;
  readonly einheit?: string | null;
  readonly waehrung?: string | null;
  readonly zeitraum?: string | null;
  readonly bezugsgroesse?: string | null;
  /** Den Rechenweg mit den AKTUELLEN Fassungen der Eingaben neu rechnen. */
  readonly neuBerechnen?: boolean;
  /** Den Wert an seiner Fundstelle in der AKTUELLEN Quellfassung neu lesen. */
  readonly quelleAktualisieren?: boolean;
  readonly grund: string;
}

export function leseKorrektur(roh: unknown): Korrekturauftrag {
  if (!istObjekt(roh)) {
    throw new DatenFehler("ungueltig", "Die Korrektur fehlt.");
  }
  const leer = (x: unknown, max: number, feld: string) =>
    x === null || x === "" ? null : text(x, max, feld);
  const k: Korrekturauftrag = {
    grund: text(roh.grund, 1000, "grund", true) as string,
    ...opt("wert", text(roh.wert, 1000, "wert")),
    ...(roh.einheit !== undefined ? { einheit: leer(roh.einheit, 100, "einheit") ?? null } : {}),
    ...(roh.waehrung !== undefined ? { waehrung: leer(roh.waehrung, 20, "waehrung") ?? null } : {}),
    ...(roh.zeitraum !== undefined
      ? { zeitraum: leer(roh.zeitraum, 100, "zeitraum") ?? null }
      : {}),
    ...(roh.bezugsgroesse !== undefined
      ? { bezugsgroesse: leer(roh.bezugsgroesse, 200, "bezugsgroesse") ?? null }
      : {}),
    ...(roh.neuBerechnen === true ? { neuBerechnen: true } : {}),
    ...(roh.quelleAktualisieren === true ? { quelleAktualisieren: true } : {}),
  };
  return k;
}

/**
 * Ändert Wert, Bezugsrahmen, Rechenweg oder Quellfassung. Es entsteht eine neue Datenfassung; die
 * Korrektur steht mit Grund, Person und dem vorherigen Stand fest. Frühere Prüfungen bleiben
 * sichtbar, gelten aber nicht für die neue Fassung (anderer Fingerabdruck).
 */
export async function korrigiere(
  dp: Datenpunkt,
  k: Korrekturauftrag,
  u: DatenUmgebung,
  h: Handelnder,
): Promise<Datenpunkt> {
  let neu: Inhalt = { ...dp };
  const vorher: Record<string, unknown> = {};
  const merke = (feld: keyof Inhalt) => {
    if (!(feld in vorher)) {
      vorher[feld] = dp[feld] ?? null;
    }
  };
  for (const feld of ["einheit", "waehrung", "zeitraum", "bezugsgroesse"] as const) {
    const w = k[feld];
    if (w !== undefined && w !== (dp[feld] ?? null)) {
      merke(feld);
      const ohne = Object.fromEntries(
        Object.entries(neu).filter(([schluessel]) => schluessel !== feld),
      );
      neu = (w === null ? ohne : { ...ohne, [feld]: w }) as unknown as Inhalt;
    }
  }
  if (k.neuBerechnen) {
    if (!dp.rechenweg) {
      throw new DatenFehler("ungueltig", "Dieser Datenpunkt hat keinen Rechenweg.");
    }
    const rw = await rechenwegBauen(
      {
        art: dp.rechenweg.art,
        eingaben: dp.rechenweg.eingaben.map((e) => e.datenpunktId),
        stellen: dp.rechenweg.stellen,
      },
      u,
    );
    merke("rechenweg");
    merke("wert");
    merke("zahl");
    const wert = k.wert ?? formatiere(rw.ergebnis, rw.stellen, dp.wert);
    const fehler = rechnungPasst(wert, rw);
    if (fehler) {
      throw new DatenFehler("ungueltig", fehler);
    }
    neu = { ...neu, rechenweg: rw, wert, zahl: zahlAusWert(wert) as number };
  } else if (k.quelleAktualisieren) {
    const f = dp.fundstelle;
    if (dp.erfassung !== "direkt" || !dp.quelle) {
      throw new DatenFehler("ungueltig", "Nur direkt übernommene Werte lassen sich neu lesen.");
    }
    const ko = await u.artikel(dp.quelle.koId);
    if (!ko) {
      throw new DatenFehler("kein_zugriff", "Die Quelle gibt es nicht.");
    }
    const wert = k.wert ?? dp.wert;
    merke("quelle");
    merke("fundstelle");
    if (f.art === "folienelement" || f.art === "tabellenzelle") {
      const l = await ortLesen(u, ko.id, {
        anhangId: dp.quelle.anhangId ?? "",
        sldId: f.sldId,
        shapeId: f.shapeId,
        ...(f.art === "tabellenzelle" ? { zeile: f.zeile, spalte: f.spalte } : {}),
      });
      const fehler = passtAmOrt(l, wert);
      if (fehler) {
        throw new DatenFehler(
          "ungueltig",
          `${fehler} In der aktuellen Fassung steht dort: „${ortText(l)}“. Bitte den Wert ausdrücklich korrigieren.`,
        );
      }
      neu = { ...neu, quelle: quelleAusOrt(l, ko), fundstelle: fundstelleAusOrt(l) };
    } else if (f.art === "artikel") {
      if (!stehtIn(artikelText(ko), f.zitat) || !stehtIn(f.zitat, wert)) {
        throw new DatenFehler(
          "ungueltig",
          "Die Stelle steht in der aktuellen Fassung der Quelle nicht mehr; bitte neu erfassen.",
        );
      }
      neu = { ...neu, quelle: { koId: ko.id, koFassung: ko.version } };
    }
    if (k.wert !== undefined && k.wert !== dp.wert) {
      merke("wert");
      merke("zahl");
      neu = { ...neu, wert, ...opt("zahl", dp.art === "zahl" ? zahlAusWert(wert) : undefined) };
    }
  } else if (k.wert !== undefined && k.wert !== dp.wert) {
    if (dp.art === "zahl" && zahlAusWert(k.wert) === undefined) {
      throw new DatenFehler("ungueltig", `„${k.wert}“ enthält nicht genau eine Zahl.`);
    }
    if (dp.rechenweg) {
      const fehler = rechnungPasst(k.wert, dp.rechenweg);
      if (fehler) {
        throw new DatenFehler(
          "ungueltig",
          `${fehler} Ein berechneter Wert wird über „neu berechnen“ geändert.`,
        );
      }
    }
    merke("wert");
    merke("zahl");
    neu = {
      ...neu,
      wert: k.wert,
      ...opt("zahl", dp.art === "zahl" ? zahlAusWert(k.wert) : undefined),
    };
  }
  const felder = Object.keys(vorher);
  if (felder.length === 0 && fingerabdruck(neu) === fingerabdruck(dp)) {
    return dp;
  }
  const fassung = dp.fassung + 1;
  // `neu` begann als vollständige Kopie von `dp`; entfernte Angaben fehlen darin und bleiben weg.
  const ergebnis: Datenpunkt = {
    ...(neu as Datenpunkt),
    fassung,
    korrekturen: [
      ...dp.korrekturen,
      { fassung, felder, vorher, grund: k.grund, von: h.nutzerId, am: h.jetzt },
    ],
  };
  // Neu gelesen bzw. neu gerechnet ist wieder maschinell geprüft — für die NEUE Fassung.
  const maschinelleNeu: Pruefung[] = [];
  if (k.neuBerechnen && ergebnis.rechenweg) {
    maschinelleNeu.push(
      maschinell(
        "berechnung",
        `Neu gerechnet mit den aktuellen Eingaben: ${ergebnis.rechenweg.formel} = ${ergebnis.rechenweg.roh}.`,
        "rechenweg",
        ergebnis,
        fassung,
        h,
      ),
    );
  }
  if (k.quelleAktualisieren) {
    maschinelleNeu.push(
      maschinell(
        "erkennung",
        "Der Wert steht wörtlich an der Fundstelle der aktuellen Quellfassung (vom Server gelesen).",
        dp.fundstelle.art === "artikel" ? "artikeltext" : "pptx-leser",
        ergebnis,
        fassung,
        h,
      ),
    );
  }
  return { ...ergebnis, pruefungen: [...dp.pruefungen, ...maschinelleNeu] };
}

// ------------------------------------------------------------------------------------------------
// PRÜFSTAND — Abschnitt 5, je Dimension und für die konkrete Datenfassung
// ------------------------------------------------------------------------------------------------

export type DimensionsStand = "bestanden" | "klaerung" | "offen" | "ueberholt" | "nicht_zutreffend";

export type Zustand = "erfasst" | "in_pruefung" | "klaerung" | "validiert" | "ueberpruefung_noetig";

export interface DimensionsBefund {
  readonly dimension: Dimension;
  readonly stand: DimensionsStand;
  /** Warum dieser Stand — ein Satz, den der Nutzer versteht. */
  readonly grund: string;
  /** Die Prüfung, auf der der Stand beruht (auch eine überholte). */
  readonly pruefung?: Pruefung;
}

export interface Pruefstand {
  readonly zustand: Zustand;
  readonly grund: string;
  /** Welche konkrete Arbeit den Zustand ändert. */
  readonly naechsteArbeit: readonly string[];
  readonly datenFassung: number;
  readonly erforderlich: readonly Dimension[];
  readonly dimensionen: readonly DimensionsBefund[];
  /** Eine Prognose ist nie ein beobachteter Wert — auch nicht validiert. */
  readonly prognose: boolean;
}

/** Welche Dimensionen für diesen Datenpunkt gelten. */
export function erforderlich(d: Inhalt): Dimension[] {
  return DIMENSIONEN.filter((dim) => {
    switch (dim) {
      case "erkennung":
        return d.erfassung === "direkt" || d.erfassung === "ocr";
      case "berechnung":
        return d.rechenweg !== undefined;
      case "aktualitaet":
        return d.quelle !== undefined;
      default:
        return true;
    }
  });
}

const NICHT_ZUTREFFEND: Record<Dimension, (d: Inhalt) => string> = {
  erkennung: (d) =>
    d.erfassung === "manuell"
      ? "Manuell eingegeben: nicht aus einer Quelle übernommen."
      : "Berechnet bzw. prognostiziert: die Eingaben tragen ihre eigene Erkennung.",
  struktur: () => "",
  berechnung: () => "Kein Rechenweg.",
  konsistenz: () => "",
  aktualitaet: () => "Keine Quelle mit Fassung (Eingabe bzw. Rechenweg).",
  fachliche_freigabe: () => "",
};

function offenGrund(dim: Dimension, d: Inhalt): string {
  switch (dim) {
    case "erkennung":
      return d.erfassung === "ocr"
        ? `OCR-erkannt${d.fundstelle.art === "bild" && d.fundstelle.unsicher ? " (mit unsicheren Stellen)" : ""}: noch nicht am Bild bestätigt. OCR allein validiert nicht.`
        : "Die Übernahme aus der Quelle ist noch nicht geprüft.";
    case "struktur": {
      const fehlt = [
        d.art === "zahl" && !d.einheit && !d.waehrung ? "Einheit/Währung" : "",
        d.art === "zahl" && !d.zeitraum ? "Bezugszeitraum" : "",
      ].filter(Boolean);
      return fehlt.length > 0
        ? `Offen. Es fehlt: ${fehlt.join(", ")}.`
        : "Format, Einheit, Zeitraum und Zuordnung sind noch nicht geprüft.";
    }
    case "berechnung":
      return "Der Rechenweg ist noch nicht geprüft.";
    case "konsistenz":
      return "Noch nicht mit anderen Angaben zum selben Sachverhalt abgeglichen.";
    case "aktualitaet":
      return "Ob die Quellfassung zum Verwendungszeitpunkt passt, ist noch nicht geprüft.";
    case "fachliche_freigabe":
      return "Keine fachliche Freigabe für diese Datenfassung.";
  }
}

/** Was sich seit einer Prüfung geändert hat — für den Grund einer überholten Prüfung. */
function seitPruefung(dp: Datenpunkt, p: Pruefung): string[] {
  return [
    ...new Set(dp.korrekturen.filter((k) => k.fassung > p.datenFassung).flatMap((k) => k.felder)),
  ];
}

const FELDNAME: Record<string, string> = {
  wert: "Wert",
  zahl: "Wert",
  einheit: "Einheit",
  waehrung: "Währung",
  zeitraum: "Bezugszeitraum",
  bezugsgroesse: "Bezugsgröße",
  rechenweg: "Rechenweg",
  quelle: "Quelle",
  fundstelle: "Fundstelle",
};

/** Lebendige Gründe, aus denen eine Dimension überholt ist, obwohl der Datenpunkt gleich blieb. */
async function lebendigUeberholt(
  dp: Datenpunkt,
  u: DatenUmgebung,
): Promise<Partial<Record<Dimension, string>>> {
  const gruende: Partial<Record<Dimension, string>> = {};
  if (dp.quelle) {
    const meta = await u.meta(dp.quelle.koId);
    if (!meta) {
      gruende.aktualitaet = "Die Quelle gibt es nicht mehr.";
    } else if (meta.version !== dp.quelle.koFassung) {
      gruende.aktualitaet = `Verwendet wurde Quellfassung ${dp.quelle.koFassung}; die Quelle steht jetzt bei Fassung ${meta.version}.`;
    }
    if (meta && dp.quelle.anhangId) {
      const jetzt = meta.anhaenge.find((a) => a.id === dp.quelle?.anhangId)?.objectId;
      if (jetzt !== dp.quelle.objectId) {
        gruende.aktualitaet = jetzt
          ? "Das Quelldokument hat inzwischen eine neue Fassung."
          : "Das Quelldokument hängt nicht mehr am Artikel.";
      }
    }
  }
  if (dp.rechenweg) {
    const geaendert: string[] = [];
    for (const e of dp.rechenweg.eingaben) {
      const jetzt = await u.datenpunkt(e.datenpunktId);
      if (!jetzt) {
        geaendert.push(`„${e.wert}“ gibt es nicht mehr`);
      } else if (jetzt.fassung !== e.fassung) {
        geaendert.push(
          `„${e.wert}“ hat jetzt Fassung ${jetzt.fassung} (gerechnet mit ${e.fassung})`,
        );
      }
    }
    if (geaendert.length > 0) {
      gruende.berechnung = `Eine Eingabe wurde geändert: ${geaendert.join("; ")}. Bitte neu berechnen.`;
    }
  }
  return gruende;
}

export async function pruefstand(dp: Datenpunkt, u: DatenUmgebung): Promise<Pruefstand> {
  const fp = fingerabdruck(dp);
  const noetig = erforderlich(dp);
  const lebendig = await lebendigUeberholt(dp, u);
  const dimensionen = DIMENSIONEN.map((dim): DimensionsBefund => {
    if (!noetig.includes(dim)) {
      return { dimension: dim, stand: "nicht_zutreffend", grund: NICHT_ZUTREFFEND[dim](dp) };
    }
    const letzte = dp.pruefungen.filter((p) => p.dimension === dim).at(-1);
    const live = lebendig[dim];
    if (live) {
      return {
        dimension: dim,
        stand: "ueberholt",
        grund: live,
        ...(letzte ? { pruefung: letzte } : {}),
      };
    }
    if (letzte && letzte.fingerabdruck !== fp) {
      const felder = [...new Set(seitPruefung(dp, letzte).map((f) => FELDNAME[f] ?? f))];
      return {
        dimension: dim,
        stand: "ueberholt",
        grund: `Geprüft für Datenfassung ${letzte.datenFassung}; seitdem geändert${felder.length > 0 ? `: ${felder.join(", ")}` : ""}. Die alte Prüfung gilt nicht für Fassung ${dp.fassung}.`,
        pruefung: letzte,
      };
    }
    if (letzte) {
      return { dimension: dim, stand: letzte.ergebnis, grund: letzte.grund, pruefung: letzte };
    }
    return { dimension: dim, stand: "offen", grund: offenGrund(dim, dp) };
  });
  const relevant = dimensionen.filter((d) => d.stand !== "nicht_zutreffend");
  const ueberholt = relevant.filter((d) => d.stand === "ueberholt");
  const klaerung = relevant.filter((d) => d.stand === "klaerung");
  const offen = relevant.filter((d) => d.stand === "offen");
  const bestanden = relevant.filter((d) => d.stand === "bestanden");
  const prognose = dp.erfassung === "prognose";
  const namen = (liste: DimensionsBefund[]) =>
    liste.map((d) => DIMENSIONSNAME[d.dimension]).join(", ");
  let zustand: Zustand;
  let grund: string;
  if (ueberholt.length > 0) {
    zustand = "ueberpruefung_noetig";
    grund = `Überprüfung nötig (${namen(ueberholt)}): ${ueberholt.map((d) => d.grund).join(" ")}`;
  } else if (klaerung.length > 0) {
    zustand = "klaerung";
    grund = `Klärungsbedarf (${namen(klaerung)}): ${klaerung.map((d) => d.grund).join(" ")}`;
  } else if (offen.length === 0) {
    zustand = "validiert";
    grund = `Validiert für Datenfassung ${dp.fassung} im Prüfrahmen ${namen(relevant)}.${prognose ? " Es bleibt eine Prognose mit Annahmen, kein beobachteter Wert." : ""}`;
  } else if (bestanden.length > 0) {
    zustand = "in_pruefung";
    grund = `In Prüfung: bestanden ${namen(bestanden)}; offen ${namen(offen)}.`;
  } else {
    zustand = "erfasst";
    grund = `Erfasst, noch nicht geprüft. Offen: ${namen(offen)}.`;
  }
  const naechsteArbeit = [
    ...ueberholt.map((d) =>
      d.dimension === "berechnung" && lebendig.berechnung
        ? "Neu berechnen und den Rechenweg erneut prüfen."
        : d.dimension === "aktualitaet" && lebendig.aktualitaet
          ? "Wert an der aktuellen Quellfassung neu lesen bzw. bestätigen."
          : `${DIMENSIONSNAME[d.dimension]} für Fassung ${dp.fassung} erneut prüfen.`,
    ),
    ...klaerung.map((d) => `Klärung zu ${DIMENSIONSNAME[d.dimension]}: ${d.grund}`),
    ...offen.map((d) => `${DIMENSIONSNAME[d.dimension]} prüfen.`),
  ];
  return {
    zustand,
    grund,
    naechsteArbeit,
    datenFassung: dp.fassung,
    erforderlich: noetig,
    dimensionen,
    prognose,
  };
}

export const DIMENSIONSNAME: Record<Dimension, string> = {
  erkennung: "Erkennung",
  struktur: "Struktur",
  berechnung: "Berechnung",
  konsistenz: "Konsistenz",
  aktualitaet: "Aktualität",
  fachliche_freigabe: "Fachliche Freigabe",
};

// ------------------------------------------------------------------------------------------------
// BINDUNGSSTAND — passt die Folie noch zum Datenpunkt?
// ------------------------------------------------------------------------------------------------

export type Bindungslage =
  /** Gebundene Dateifassung ist aktuell und zeigt den Wert. */
  | "aktuell"
  /** Neue Dateifassung; das Element zeigt den Wert weiterhin. */
  | "bestaetigt_in_neuer_fassung"
  /** Das Element zeigt einen anderen Wert als die Datenfassung (manuell geändert oder Wert korrigiert). */
  | "abweichung"
  | "element_fehlt"
  | "anhang_fehlt";

export interface BindungsSicht extends Bindung {
  readonly lage: Bindungslage;
  readonly anhangName?: string;
  /** Was heute am Element steht, wenn es abweicht. */
  readonly heute?: string;
}

async function bindungsSicht(
  dp: Datenpunkt,
  b: Bindung,
  u: DatenUmgebung,
): Promise<BindungsSicht | undefined> {
  if (!(await u.artikel(b.koId))) {
    return undefined; // Ohne Leserecht an der Zielpräsentation keine Auskunft über die Bindung.
  }
  const datei = await u.folien(b.koId, b.anhangId);
  if (!datei) {
    return { ...b, lage: "anhang_fehlt" };
  }
  const element = datei.satz.folien
    .find((f) => f.sldId === b.sldId)
    ?.elemente.find((e) => e.shapeId === b.shapeId);
  if (!element) {
    return { ...b, lage: "element_fehlt", anhangName: datei.name };
  }
  const zelle =
    b.zeile !== undefined
      ? element.zellen?.find((z) => z.zeile === b.zeile && z.spalte === b.spalte)
      : undefined;
  if (b.zeile !== undefined && !zelle) {
    return { ...b, lage: "element_fehlt", anhangName: datei.name };
  }
  const heute = zelle ? zelle.text : element.text;
  const passt =
    element.art === "bild"
      ? dp.fundstelle.art === "bild" && element.bild?.kennung === dp.fundstelle.bildKennung
      : stehtIn(heute, dp.wert);
  if (!passt) {
    return { ...b, lage: "abweichung", anhangName: datei.name, heute };
  }
  return {
    ...b,
    lage: datei.objectId === b.objectId ? "aktuell" : "bestaetigt_in_neuer_fassung",
    anhangName: datei.name,
  };
}

// ------------------------------------------------------------------------------------------------
// DIE SICHT — die Herkunft, wie der handelnde Nutzer sie sehen darf
// ------------------------------------------------------------------------------------------------

export type Schutzstufe = NonNullable<KnowledgeObject["confidentiality"]>;
const STUFEN: readonly Schutzstufe[] = ["intern", "vertraulich", "streng_vertraulich"];

export type QuellenSicht =
  | { readonly lesbar: false }
  | {
      readonly lesbar: true;
      readonly koId: string;
      readonly titel: string;
      readonly koFassung: number;
      readonly aktuelleFassung: number;
      readonly anhangId?: string;
      readonly anhangName?: string;
      readonly objectId?: string;
      readonly dateiFassung?: string;
    };

export type EingabeSicht =
  | { readonly lesbar: false; readonly verwendet: { readonly fassung: number } }
  | {
      readonly lesbar: true;
      /** Mit genau diesen Werten wurde gerechnet. */
      readonly verwendet: RechenwegEingabe;
      /**
       * Der Datenpunkt IN DER VERWENDETEN FASSUNG — mit der damaligen Quelle, Fundstelle und den
       * damals verwendeten Eingaben (Nacharbeit 2, Bens Befund 2).
       */
      readonly datenpunkt: DatenpunktSicht;
      /** Der heutige Stand der Eingabe, wenn sie sich seitdem geändert hat, sonst dieselbe Fassung. */
      readonly aktuell: { readonly fassung: number; readonly wert: string };
    };

export interface DatenpunktSicht {
  readonly id: string;
  readonly heimatKoId: string;
  readonly fassung: number;
  readonly art: Inhalt["art"];
  readonly wert: string;
  readonly zahl?: number;
  readonly einheit?: string;
  readonly waehrung?: string;
  readonly zeitraum?: string;
  readonly bezugsgroesse?: string;
  readonly erfassung: Erfassung;
  readonly quelle: QuellenSicht | null;
  readonly fundstelle: Fundstelle;
  readonly rechenweg: (Omit<Rechenweg, "eingaben"> & { readonly eingaben: EingabeSicht[] }) | null;
  readonly annahmen: readonly string[];
  readonly modellbezug?: string;
  readonly erfasstVon: { readonly id: string; readonly name?: string };
  readonly erfasstAm: string;
  readonly korrekturen: readonly (Korrektur & { readonly name?: string })[];
  readonly pruefungen: readonly (Pruefung & { readonly name?: string })[];
  readonly pruefstand: Pruefstand;
  readonly bindungen: readonly BindungsSicht[];
  /** Die strengste Schutzstufe aus Heimat, Quelle und allen Eingaben (V07). */
  readonly schutzstufe: Schutzstufe;
  /** Gesetzt, wenn diese Sicht eine frühere Datenfassung zeigt; Wirkungen gelten nur der aktuellen. */
  readonly historisch?: { readonly aktuelleFassung: number };
}

function strenger(a: Schutzstufe, b: Schutzstufe | undefined): Schutzstufe {
  return b && STUFEN.indexOf(b) > STUFEN.indexOf(a) ? b : a;
}

async function schutzstufeVon(
  dp: Datenpunkt,
  u: DatenUmgebung,
  tiefe: number,
): Promise<Schutzstufe> {
  let stufe = strenger("intern", (await u.meta(dp.heimatKoId))?.confidentiality);
  if (dp.quelle) {
    stufe = strenger(stufe, (await u.meta(dp.quelle.koId))?.confidentiality);
  }
  if (dp.rechenweg && tiefe > 0) {
    for (const e of dp.rechenweg.eingaben) {
      const ein = await u.datenpunkt(e.datenpunktId);
      if (ein) {
        stufe = strenger(stufe, await schutzstufeVon(ein, u, tiefe - 1));
      }
    }
  }
  return stufe;
}

const MAX_TIEFE = KETTENTIEFE;

async function mitNamen<T extends { von: string }>(
  liste: readonly T[],
  u: DatenUmgebung,
): Promise<(T & { name?: string })[]> {
  const ergebnis: (T & { name?: string })[] = [];
  for (const x of liste) {
    const name = x.von.startsWith("klarwerk:") ? undefined : await u.name(x.von);
    ergebnis.push(name ? { ...x, name } : x);
  }
  return ergebnis;
}

/**
 * Die Herkunft eines Datenpunkts für den handelnden Nutzer. `undefined`, wenn er nicht die ganze
 * Herkunft lesen darf (`vollLesbar`: Heimat, Quellen, Eingaben, Historie) — an der Route 404, in
 * Listen fehlt der Datenpunkt. Es gibt keine teilweise geschwärzte Sicht: Formel, Fundstelle,
 * Prüfgründe und Korrekturen tragen Werte der Quellen und Eingaben.
 *
 * `aktuelleFassung` ist gesetzt, wenn `dp` eine frühere Fassung ist (`inFassung`); Eingaben
 * erscheinen immer in der Fassung, mit der gerechnet wurde.
 */
export async function sicht(
  dp: Datenpunkt,
  u: DatenUmgebung,
  tiefe = MAX_TIEFE,
  aktuelleFassung: number = dp.fassung,
): Promise<DatenpunktSicht | undefined> {
  if (!(await lesbar(dp, u))) {
    return undefined;
  }
  let quelle: QuellenSicht | null = null;
  if (dp.quelle) {
    const ko = await u.artikel(dp.quelle.koId);
    if (!ko) {
      quelle = { lesbar: false };
    } else {
      const anhangName = dp.quelle.anhangId
        ? ko.attachments?.find((a) => a.id === dp.quelle?.anhangId)?.name
        : undefined;
      quelle = {
        lesbar: true,
        koId: ko.id,
        titel: ko.title,
        koFassung: dp.quelle.koFassung,
        aktuelleFassung: ko.version,
        ...opt("anhangId", dp.quelle.anhangId),
        ...opt("anhangName", anhangName),
        ...opt("objectId", dp.quelle.objectId),
        ...opt("dateiFassung", dp.quelle.dateiFassung),
      };
    }
  }
  let rechenweg: DatenpunktSicht["rechenweg"] = null;
  if (dp.rechenweg) {
    const eingaben: EingabeSicht[] = [];
    for (const e of dp.rechenweg.eingaben) {
      const ein = await u.datenpunkt(e.datenpunktId);
      // Die Eingabe in der Fassung, mit der gerechnet wurde — nicht ihr heutiger Stand.
      const damals = ein ? inFassung(ein, e.fassung) : undefined;
      const s =
        ein && damals && tiefe > 0 ? await sicht(damals, u, tiefe - 1, ein.fassung) : undefined;
      eingaben.push(
        ein && s
          ? {
              lesbar: true,
              verwendet: e,
              datenpunkt: s,
              aktuell: { fassung: ein.fassung, wert: ein.wert },
            }
          : { lesbar: false, verwendet: { fassung: e.fassung } },
      );
    }
    rechenweg = { ...dp.rechenweg, eingaben };
  }
  const bindungen: BindungsSicht[] = [];
  for (const b of dp.bindungen) {
    const s = await bindungsSicht(dp, b, u);
    if (s) {
      bindungen.push(s);
    }
  }
  const name = await u.name(dp.erfasstVon);
  const pruefungen = await mitNamen(dp.pruefungen, u);
  const stand = await pruefstand(dp, u);
  return {
    id: dp.id,
    heimatKoId: dp.heimatKoId,
    fassung: dp.fassung,
    art: dp.art,
    wert: dp.wert,
    ...opt("zahl", dp.zahl),
    ...opt("einheit", dp.einheit),
    ...opt("waehrung", dp.waehrung),
    ...opt("zeitraum", dp.zeitraum),
    ...opt("bezugsgroesse", dp.bezugsgroesse),
    erfassung: dp.erfassung,
    quelle,
    fundstelle: dp.fundstelle,
    rechenweg,
    annahmen: dp.annahmen ?? [],
    ...opt("modellbezug", dp.modellbezug),
    erfasstVon: { id: dp.erfasstVon, ...(name ? { name } : {}) },
    erfasstAm: dp.erfasstAm,
    korrekturen: await mitNamen(dp.korrekturen, u),
    pruefungen,
    pruefstand: {
      ...stand,
      dimensionen: stand.dimensionen.map((d) =>
        d.pruefung
          ? { ...d, pruefung: pruefungen.find((p) => p.id === d.pruefung?.id) ?? d.pruefung }
          : d,
      ),
    },
    bindungen,
    schutzstufe: await schutzstufeVon(dp, u, MAX_TIEFE),
    ...(aktuelleFassung !== dp.fassung ? { historisch: { aktuelleFassung } } : {}),
  };
}

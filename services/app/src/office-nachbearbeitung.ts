// ================================================================================================
// PRÄSENTATION NACH DER BESPRECHUNG NACHBEARBEITEN (Auftrag produkt:20261011:assistenz-dokumentnachbearbeitung,
// BPA-17). EIN BEGRENZTER, BELEGTER ÄNDERUNGSAUFTRAG AN EINER PPTX-ANLAGE — ÜBER DEN BESTEHENDEN
// OFFICE-FASSUNGSWEG, NICHT ÜBER EINEN ZWEITEN KERN.
// ================================================================================================
//
// WAS HIER GEBAUT IST, und was ausdrücklich nicht:
//
//   · Der Auftrag nennt je Schritt Folie (stabile `p:sldId`-Kennung), alten und neuen Text und die
//     HERKUNFT: ausdrücklicher Meetingbeschluss (mit Gesprächsstelle), Nutzerauftrag oder eigene
//     KI-Empfehlung. Eine KI-Empfehlung wird NIE eingearbeitet — sie bleibt Vorschlag (die alten
//     Nur-Vorschlag-Regeln gelten weiter, O10). Ein Beschluss ohne belegte Stelle wird Klärung.
//   · Eine NEUE Zahl braucht einen Zahlenbeleg (Datenquelle mit dem Wert oder eine nachgerechnete
//     Berechnung). Fehlt er oder stimmt die Rechnung nicht, entsteht eine Klärung — keine Zahl wird
//     erfunden. Diagramme/Datenreihen ändert dieser Weg nicht; ein solcher Schritt wird Klärung.
//   · Geändert wird nur der Text eines einzelnen Formatierungslaufs (`a:t`) der Folie. Vorlage,
//     Layouts, Master, Thema und alle anderen Teile bleiben byte-gleich (geprüft beim Wiederöffnen).
//   · Gespeichert wird über `uebernimmOfficeFassung` mit `expectedVersion` = Basisfassung: dieselbe
//     neue Fassung, derselbe Status `offen`, dieselbe Rücknahme (`zurueckholen`) wie im Editorweg.
//     Eine zwischenzeitliche Änderung überschreibt nichts; der Bericht zeigt je Schritt, ob er auf
//     den heutigen Stand passt, und der eigene Stand bleibt als privater Entwurf erhalten.
//   · Nach dem Speichern wird die gespeicherte Datei aus dem Objektspeicher WIEDER GEÖFFNET und
//     jede Änderung dort nachgeprüft. Scheitert das, steht es im Ergebnis — nie „gespeichert" ohne
//     Prüfung.
//   · Sprechernotizen: hat die Folie eine Notizseite, wird die Notiz dort als zusätzlicher Absatz
//     angefügt (echte PowerPoint-Notiz, bestehende Notizen bleiben unverändert). Fehlt die Notizseite,
//     wird KEINE erfunden: die Notiz kommt in eine eigene Notizdatei, mit Grund.
//   · Handout, Notizdatei, Änderungsübersicht und Konfliktentwurf sind PRIVATE Objekte des Auftrag-
//     gebers: an keinen Artikel gebunden, nicht versandt, nicht geteilt. Das Handout enthält nur
//     sichtbare Folien und nie Inhalte von Notizseiten.
//
// KEIN MODELL LÄUFT HIER. Die Texte (neue Folientexte, Notizen) kommen aus dem Auftrag; ob sie von
// einem Menschen oder vorher von Klara formuliert wurden, sagt die Herkunft des Schritts.

import JSZip from "jszip";
import type { KnowledgeObject } from "../../knowledge-object";
import { type ObjectStore, decodeDataUrl } from "../../object-store";
import { type AnhangFassung, type OfficeKoDienst, fehlerCode } from "./office-artikel";

// ------------------------------------------------------------------------------------------------
// FEHLER
// ------------------------------------------------------------------------------------------------

export class NachbearbeitungsFehler extends Error {
  readonly code: "INVALID" | "KEINE_PRAESENTATION";

  constructor(code: "INVALID" | "KEINE_PRAESENTATION", message: string) {
    super(message);
    this.code = code;
    this.name = "NachbearbeitungsFehler";
  }
}

// ------------------------------------------------------------------------------------------------
// XML
// ------------------------------------------------------------------------------------------------

/** Ein Textlauf: `<a:t>` mit Inhalt. `<a:tab>`, `<a:tbl>` usw. trifft das Muster nicht. */
const TEXTLAUF = /<a:t(\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
/** Ein Absatz `<a:p>…</a:p>`; `<a:pPr>` trifft das Muster nicht. */
const ABSATZ = /<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g;
/** Eine Form `<p:sp>…</p:sp>`; Formen schachteln keine Formen. */
const FORM = /<p:sp>([\s\S]*?)<\/p:sp>/g;

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

function xmlEsc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function laeufe(xml: string): string[] {
  return [...xml.matchAll(TEXTLAUF)].map((t) => xmlText(t[2] ?? ""));
}

function absaetze(xml: string): string[] {
  return [...xml.matchAll(ABSATZ)]
    .map((p) => laeufe(p[1] ?? "").join(""))
    .filter((t) => t.trim().length > 0);
}

function vorkommen(text: string, teil: string): number {
  return teil.length === 0 ? 0 : text.split(teil).length - 1;
}

function attribut(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** Löst ein Beziehungsziel relativ zum Verzeichnis des Quellteils auf (`../x` und `/ppt/x`). */
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

function relsPfad(teil: string): string {
  const schnitt = teil.lastIndexOf("/");
  return `${teil.slice(0, schnitt)}/_rels/${teil.slice(schnitt + 1)}.rels`;
}

function beziehungen(relsXml: string): { id: string; typ: string; ziel: string }[] {
  return [...relsXml.matchAll(/<Relationship\s[^>]*>/g)].map((r) => ({
    id: attribut(r[0], "Id") ?? "",
    typ: attribut(r[0], "Type") ?? "",
    ziel: attribut(r[0], "Target") ?? "",
  }));
}

// ------------------------------------------------------------------------------------------------
// PRÄSENTATION LESEN
// ------------------------------------------------------------------------------------------------

export interface Folie {
  /** `p:sldId/@id` — bleibt beim Umordnen der Folien gleich. */
  readonly folieId: number;
  /** Position in der Präsentation, ab 1. */
  readonly nummer: number;
  readonly pfad: string;
  readonly ausgeblendet: boolean;
  readonly titel: string;
  readonly absaetze: readonly string[];
  /** Die Notizseite der Folie, falls die Datei eine hat. */
  readonly notizPfad?: string;
}

export interface Praesentation {
  readonly zip: JSZip;
  readonly folien: readonly Folie[];
}

async function teil(zip: JSZip, pfad: string): Promise<string | undefined> {
  return zip.file(pfad)?.async("string");
}

function folientitel(xml: string, texte: readonly string[]): string {
  for (const form of xml.matchAll(FORM)) {
    const inhalt = form[1] ?? "";
    if (/<p:ph\s[^>]*type="(title|ctrTitle)"/.test(inhalt)) {
      const titel = absaetze(inhalt).join(" ").trim();
      if (titel) {
        return titel;
      }
    }
  }
  return texte[0] ?? "";
}

export async function lesePraesentation(bytes: Buffer): Promise<Praesentation> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new NachbearbeitungsFehler("KEINE_PRAESENTATION", "Die Datei ist kein lesbares PPTX.");
  }
  const praes = await teil(zip, "ppt/presentation.xml");
  const praesRels = await teil(zip, "ppt/_rels/presentation.xml.rels");
  if (!praes || !praesRels) {
    throw new NachbearbeitungsFehler(
      "KEINE_PRAESENTATION",
      "Die Datei enthält keine PowerPoint-Präsentation.",
    );
  }
  const ziele = new Map(beziehungen(praesRels).map((b) => [b.id, b.ziel] as const));
  const folien: Folie[] = [];
  for (const eintrag of praes.matchAll(/<p:sldId\s[^>]*>/g)) {
    const folieId = Number(attribut(eintrag[0], "id"));
    const ziel = ziele.get(attribut(eintrag[0], "r:id") ?? "");
    if (!Number.isInteger(folieId) || !ziel) {
      continue;
    }
    const pfad = aufloesen("ppt", ziel);
    const xml = (await teil(zip, pfad)) ?? "";
    const verzeichnis = pfad.slice(0, pfad.lastIndexOf("/"));
    const notiz = beziehungen((await teil(zip, relsPfad(pfad))) ?? "").find((b) =>
      b.typ.endsWith("/notesSlide"),
    );
    const texte = absaetze(xml);
    folien.push({
      folieId,
      nummer: folien.length + 1,
      pfad,
      ausgeblendet: /<p:sld\s[^>]*\sshow="(0|false)"/.test(xml),
      titel: folientitel(xml, texte),
      absaetze: texte,
      ...(notiz ? { notizPfad: aufloesen(verzeichnis, notiz.ziel) } : {}),
    });
  }
  return { zip, folien };
}

/** Die Absätze im Textkörper der Notizseite (Platzhalter `body`). */
export function notizAbsaetze(notizXml: string): string[] {
  for (const form of notizXml.matchAll(FORM)) {
    const inhalt = form[1] ?? "";
    if (/<p:ph\s[^>]*type="body"/.test(inhalt)) {
      return absaetze(inhalt);
    }
  }
  return [];
}

/**
 * Hängt Absätze an den Textkörper der Notizseite an. Bestehende Notizen bleiben unverändert.
 * `undefined`, wenn die Notizseite keinen Textkörper hat — dann wird nichts erfunden.
 */
function fuegeNotizAn(notizXml: string, zeilen: readonly string[]): string | undefined {
  for (const form of notizXml.matchAll(FORM)) {
    const inhalt = form[1] ?? "";
    const ende = inhalt.lastIndexOf("</p:txBody>");
    if (!/<p:ph\s[^>]*type="body"/.test(inhalt) || ende < 0) {
      continue;
    }
    const neu = zeilen
      .map((z) => `<a:p><a:r><a:rPr lang="de-DE" dirty="0"/><a:t>${xmlEsc(z)}</a:t></a:r></a:p>`)
      .join("");
    const ersetzt = `${inhalt.slice(0, ende)}${neu}${inhalt.slice(ende)}`;
    const start = (form.index ?? 0) + "<p:sp>".length;
    return `${notizXml.slice(0, start)}${ersetzt}${notizXml.slice(start + inhalt.length)}`;
  }
  return undefined;
}

// ------------------------------------------------------------------------------------------------
// AUFTRAG
// ------------------------------------------------------------------------------------------------

export type HerkunftArt = "meetingbeschluss" | "nutzerauftrag" | "ki_empfehlung";

export interface Herkunft {
  readonly art: HerkunftArt;
  /** Woher: Besprechungsnotiz/Protokoll, Auftrag, Quelle. */
  readonly quelle?: string;
  /** Die belegte Stelle darin (Zeitmarke, Absatz, Folie). */
  readonly stelle?: string;
  /** Bei einer KI-Empfehlung: warum. */
  readonly grund?: string;
}

export interface Zahlenbeleg {
  readonly quelle: string;
  readonly stelle?: string;
  /** Die Werte, wie sie in der Quelle stehen. */
  readonly werte: readonly string[];
  /** Eine nachrechenbare Berechnung; der Server rechnet sie nach. */
  readonly berechnung?: {
    readonly art: "summe" | "differenz" | "anteil_prozent";
    readonly eingaben: readonly number[];
    readonly ergebnis: string;
  };
}

export interface Schritt {
  readonly id: string;
  readonly art: "text" | "diagramm";
  readonly folieId: number;
  readonly alt?: string;
  readonly neu?: string;
  readonly herkunft: Herkunft;
  readonly zahlenbeleg?: Zahlenbeleg;
}

export interface Notizauftrag {
  readonly folieId: number;
  readonly text: string;
  readonly herkunft: Herkunft;
}

export interface Nachbearbeitungsauftrag {
  /** Vom Aufrufer vergebene Kennung: derselbe Lauf wird nie zweimal ausgeführt. */
  readonly laufId: string;
  /** Die Artikelfassung, auf die sich der Auftrag bezieht (die in der Besprechung gezeigte). */
  readonly basisFassung: number;
  readonly schritte: readonly Schritt[];
  readonly sprechernotizen: readonly Notizauftrag[];
  readonly folgeprodukte: { readonly handout: boolean; readonly sprechernotizen: boolean };
}

const HERKUNFTSARTEN: readonly HerkunftArt[] = [
  "meetingbeschluss",
  "nutzerauftrag",
  "ki_empfehlung",
];
/** Auch der Rechenweg der Datenobjekte (PP-02, `praesentation-daten.ts`) kennt nur diese Arten. */
export const BERECHNUNGSARTEN = ["summe", "differenz", "anteil_prozent"] as const;

function istObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function text(x: unknown, max: number): string | undefined {
  return typeof x === "string" && x.length <= max ? x : undefined;
}

function optText(x: unknown, max: number, feld: string): string | undefined {
  if (x === undefined) {
    return undefined;
  }
  const t = text(x, max);
  if (t === undefined) {
    throw new NachbearbeitungsFehler("INVALID", `${feld} ist kein Text bis ${max} Zeichen.`);
  }
  return t.trim() || undefined;
}

function leseHerkunft(roh: unknown, wo: string): Herkunft {
  if (!istObjekt(roh) || !HERKUNFTSARTEN.includes(roh.art as HerkunftArt)) {
    throw new NachbearbeitungsFehler(
      "INVALID",
      `${wo}: herkunft.art muss meetingbeschluss, nutzerauftrag oder ki_empfehlung sein.`,
    );
  }
  const quelle = optText(roh.quelle, 500, `${wo}: herkunft.quelle`);
  const stelle = optText(roh.stelle, 500, `${wo}: herkunft.stelle`);
  const grund = optText(roh.grund, 1000, `${wo}: herkunft.grund`);
  return {
    art: roh.art as HerkunftArt,
    ...(quelle ? { quelle } : {}),
    ...(stelle ? { stelle } : {}),
    ...(grund ? { grund } : {}),
  };
}

function leseZahlenbeleg(roh: unknown, wo: string): Zahlenbeleg | undefined {
  if (roh === undefined) {
    return undefined;
  }
  if (!istObjekt(roh) || !text(roh.quelle, 500)?.trim() || !Array.isArray(roh.werte)) {
    throw new NachbearbeitungsFehler("INVALID", `${wo}: zahlenbeleg braucht quelle und werte.`);
  }
  const werte = roh.werte.filter((w): w is string => typeof w === "string" && w.length <= 100);
  if (werte.length !== roh.werte.length || werte.length > 50) {
    throw new NachbearbeitungsFehler("INVALID", `${wo}: zahlenbeleg.werte sind Texte.`);
  }
  const stelle = optText(roh.stelle, 500, `${wo}: zahlenbeleg.stelle`);
  let berechnung: Zahlenbeleg["berechnung"];
  if (roh.berechnung !== undefined) {
    const b = roh.berechnung;
    if (
      !istObjekt(b) ||
      !BERECHNUNGSARTEN.includes(b.art as (typeof BERECHNUNGSARTEN)[number]) ||
      !Array.isArray(b.eingaben) ||
      b.eingaben.length < 2 ||
      b.eingaben.length > 50 ||
      !b.eingaben.every((e) => typeof e === "number" && Number.isFinite(e)) ||
      !text(b.ergebnis, 50)
    ) {
      throw new NachbearbeitungsFehler(
        "INVALID",
        `${wo}: zahlenbeleg.berechnung braucht art, mindestens zwei Zahlen und ein Ergebnis.`,
      );
    }
    berechnung = {
      art: b.art as (typeof BERECHNUNGSARTEN)[number],
      eingaben: b.eingaben as number[],
      ergebnis: b.ergebnis as string,
    };
  }
  return {
    quelle: (roh.quelle as string).trim(),
    ...(stelle ? { stelle } : {}),
    werte,
    ...(berechnung ? { berechnung } : {}),
  };
}

/** Prüft den Rumpf. Wirft `NachbearbeitungsFehler("INVALID")` mit einem lesbaren Satz. */
export function leseAuftrag(roh: unknown): Nachbearbeitungsauftrag {
  if (!istObjekt(roh)) {
    throw new NachbearbeitungsFehler("INVALID", "Der Auftrag fehlt.");
  }
  const laufId = text(roh.laufId, 100);
  if (!laufId || !/^[A-Za-z0-9._:-]+$/.test(laufId)) {
    throw new NachbearbeitungsFehler("INVALID", "laufId fehlt oder enthält unzulässige Zeichen.");
  }
  const basisFassung = roh.basisFassung;
  if (!Number.isInteger(basisFassung) || (basisFassung as number) < 1) {
    throw new NachbearbeitungsFehler("INVALID", "basisFassung muss eine Ganzzahl ab 1 sein.");
  }
  if (!Array.isArray(roh.schritte) || roh.schritte.length > 50) {
    throw new NachbearbeitungsFehler(
      "INVALID",
      "schritte ist eine Liste mit höchstens 50 Schritten.",
    );
  }
  const ids = new Set<string>();
  const schritte: Schritt[] = roh.schritte.map((s, i) => {
    const wo = `Schritt ${i + 1}`;
    if (!istObjekt(s)) {
      throw new NachbearbeitungsFehler("INVALID", `${wo} ist kein Objekt.`);
    }
    const id = text(s.id, 100)?.trim();
    if (!id || ids.has(id)) {
      throw new NachbearbeitungsFehler("INVALID", `${wo}: id fehlt oder ist doppelt.`);
    }
    ids.add(id);
    if (s.art !== "text" && s.art !== "diagramm") {
      throw new NachbearbeitungsFehler("INVALID", `${wo}: art muss text oder diagramm sein.`);
    }
    if (!Number.isInteger(s.folieId)) {
      throw new NachbearbeitungsFehler("INVALID", `${wo}: folieId fehlt.`);
    }
    const alt = s.alt === undefined ? undefined : text(s.alt, 2000);
    const neu = s.neu === undefined ? undefined : text(s.neu, 2000);
    if (s.art === "text" && (!alt || neu === undefined)) {
      throw new NachbearbeitungsFehler("INVALID", `${wo}: ein Textschritt braucht alt und neu.`);
    }
    const zahlenbeleg = leseZahlenbeleg(s.zahlenbeleg, wo);
    return {
      id,
      art: s.art as Schritt["art"],
      folieId: s.folieId as number,
      ...(alt === undefined ? {} : { alt }),
      ...(neu === undefined ? {} : { neu }),
      herkunft: leseHerkunft(s.herkunft, wo),
      ...(zahlenbeleg ? { zahlenbeleg } : {}),
    };
  });
  const notizenRoh = roh.sprechernotizen ?? [];
  if (!Array.isArray(notizenRoh) || notizenRoh.length > 50) {
    throw new NachbearbeitungsFehler("INVALID", "sprechernotizen ist eine Liste (höchstens 50).");
  }
  const sprechernotizen: Notizauftrag[] = notizenRoh.map((n, i) => {
    const wo = `Sprechernotiz ${i + 1}`;
    if (!istObjekt(n) || !Number.isInteger(n.folieId) || !text(n.text, 4000)?.trim()) {
      throw new NachbearbeitungsFehler("INVALID", `${wo}: folieId und text fehlen.`);
    }
    return {
      folieId: n.folieId as number,
      text: (n.text as string).trim(),
      herkunft: leseHerkunft(n.herkunft, wo),
    };
  });
  const f = istObjekt(roh.folgeprodukte) ? roh.folgeprodukte : {};
  return {
    laufId,
    basisFassung: basisFassung as number,
    schritte,
    sprechernotizen,
    folgeprodukte: { handout: f.handout === true, sprechernotizen: f.sprechernotizen === true },
  };
}

// ------------------------------------------------------------------------------------------------
// PRÜFEN UND ANWENDEN — ohne Wirkung, nur im Arbeitsspeicher
// ------------------------------------------------------------------------------------------------

export type SchrittStatus = "eingearbeitet" | "vorgeschlagen" | "klaerung" | "nicht_ausgefuehrt";

export interface SchrittErgebnis {
  readonly id: string;
  readonly art: Schritt["art"];
  readonly folieId: number;
  readonly folieNummer?: number;
  readonly folienTitel?: string;
  readonly herkunft: Herkunft;
  readonly alt?: string;
  readonly neu?: string;
  readonly zahlenbeleg?: Zahlenbeleg;
  readonly status: SchrittStatus;
  /** Warum dieser Status — ein Satz, den der Nutzer versteht. */
  readonly grund: string;
}

// Ben-Befund AC03: das VORZEICHEN gehört zur Zahl („-10" → „10" ist eine Zahlenänderung). Ein
// Minus/Plus zählt, wenn davor kein Buchstabe und keine Ziffer steht — „P1-2" bleibt Bezeichnung.
// Auch das typografische Minus (U+2212) wird erkannt; „+10" und „10" sind derselbe Wert.
const ZAHL = /(?:(?<![\p{L}\p{N}])[-+−])?\d+(?:[.,]\d+)*/gu;

function zahlen(t: string): string[] {
  return [...t.matchAll(ZAHL)].map((z) =>
    z[0].replace(/−/g, "-").replace(/^\+/, "").replace(/,/g, "."),
  );
}

/** Die Rechenprüfung V06 — dieselbe Rechnung für Nachbearbeitung und Datenobjekte (PP-02). */
export function rechne(
  b: Pick<NonNullable<Zahlenbeleg["berechnung"]>, "art" | "eingaben">,
): number {
  const [erste = 0, ...rest] = b.eingaben;
  switch (b.art) {
    case "summe":
      return b.eingaben.reduce((s, x) => s + x, 0);
    case "differenz":
      return rest.reduce((s, x) => s - x, erste);
    case "anteil_prozent":
      return (erste / (rest[0] ?? Number.NaN)) * 100;
  }
}

/**
 * Geänderte Zahlen ohne tragfähigen Beleg. Verglichen wird die ZAHLENFOLGE Stelle für Stelle, nicht
 * eine Menge: ein anderes Vorzeichen, ein Tausch zweier Werte und ein entfernter Wert sind Änderungen.
 * `geaendert` sagt, ob sich die Folge überhaupt geändert hat; `offen` nennt die neuen Werte, die kein
 * Beleg trägt. Ohne Zahlenbeleg ist jede Änderung der Folge offen.
 */
function unbelegteZahlen(s: Schritt): {
  geaendert: boolean;
  offen: string[];
  rechenfehler?: string;
} {
  const vorher = zahlen(s.alt ?? "");
  const nachher = zahlen(s.neu ?? "");
  const neu = nachher.filter((z, i) => vorher[i] !== z);
  const geaendert = neu.length > 0 || vorher.length !== nachher.length;
  if (!geaendert) {
    return { geaendert, offen: [] };
  }
  const beleg = s.zahlenbeleg;
  if (!beleg) {
    return { geaendert, offen: neu };
  }
  const belegt = new Set(beleg.werte.flatMap(zahlen));
  let rechenfehler: string | undefined;
  if (beleg.berechnung) {
    const ergebnis = zahlen(beleg.berechnung.ergebnis)[0];
    const wert = rechne(beleg.berechnung);
    const stellen = ergebnis?.split(".")[1]?.length ?? 0;
    if (ergebnis === undefined || !(Math.abs(wert - Number(ergebnis)) <= 0.5 * 10 ** -stellen)) {
      rechenfehler = `Die angegebene Berechnung ergibt ${Number.isFinite(wert) ? wert.toFixed(stellen) : "keinen Wert"}, nicht ${beleg.berechnung.ergebnis}.`;
    } else {
      belegt.add(ergebnis);
    }
  }
  return {
    geaendert,
    offen: neu.filter((z) => !belegt.has(z)),
    ...(rechenfehler ? { rechenfehler } : {}),
  };
}

type Pruefung = { anwendbar: true } | { anwendbar: false; status: SchrittStatus; grund: string };

function pruefeSchritt(s: Schritt, folie: Folie | undefined, folienXml: string): Pruefung {
  if (!folie) {
    return {
      anwendbar: false,
      status: "klaerung",
      grund: `Folie ${s.folieId} gibt es in dieser Fassung nicht; nichts geändert.`,
    };
  }
  if (s.herkunft.art === "ki_empfehlung") {
    return {
      anwendbar: false,
      status: "vorgeschlagen",
      grund: `Eigene KI-Empfehlung, nicht eingearbeitet: sie bleibt ein Vorschlag, bis ein Mensch sie beauftragt.${s.herkunft.grund ? ` Grund: ${s.herkunft.grund}` : " Ein Grund wurde nicht angegeben."}`,
    };
  }
  if (s.art === "diagramm") {
    return {
      anwendbar: false,
      status: "klaerung",
      grund:
        "Diagramm- und Datenreihenänderungen sind über diesen Weg nicht unterstützt; nichts geändert. Bitte im Editor mit der Datenquelle ändern.",
    };
  }
  if (s.herkunft.art === "meetingbeschluss" && (!s.herkunft.quelle || !s.herkunft.stelle)) {
    return {
      anwendbar: false,
      status: "klaerung",
      grund:
        "Als Meetingbeschluss angegeben, aber ohne belegte Gesprächsstelle (Quelle und Stelle). Bitte die Stelle nennen oder als eigenen Auftrag erteilen.",
    };
  }
  const zahlenpruefung = unbelegteZahlen(s);
  if (zahlenpruefung.rechenfehler) {
    return { anwendbar: false, status: "klaerung", grund: zahlenpruefung.rechenfehler };
  }
  if (zahlenpruefung.offen.length > 0) {
    return {
      anwendbar: false,
      status: "klaerung",
      grund: `Neue oder geänderte Zahl ${zahlenpruefung.offen.join(", ")} ohne belegte Daten- oder Berechnungsquelle. Keine Zahl wurde erfunden; bitte die Quelle nennen.`,
    };
  }
  if (zahlenpruefung.geaendert && !s.zahlenbeleg) {
    return {
      anwendbar: false,
      status: "klaerung",
      grund:
        "Zahlen werden entfernt oder umgestellt, ohne belegte Daten- oder Berechnungsquelle. Nichts geändert; bitte die Quelle nennen.",
    };
  }
  const alt = s.alt ?? "";
  const imLauf = laeufe(folienXml).reduce((n, t) => n + vorkommen(t, alt), 0);
  if (imLauf === 1) {
    return { anwendbar: true };
  }
  if (imLauf > 1) {
    return {
      anwendbar: false,
      status: "klaerung",
      grund: `„${alt}" steht ${imLauf}-mal auf der Folie; welche Stelle gemeint ist, ist nicht eindeutig.`,
    };
  }
  const imAbsatz = absaetze(folienXml).some((t) => t.includes(alt));
  return {
    anwendbar: false,
    status: "klaerung",
    grund: imAbsatz
      ? `„${alt}" ist auf der Folie über mehrere Formatierungen verteilt; es wird nicht automatisch geändert, damit keine Formatierung verloren geht.`
      : `„${alt}" steht nicht auf dieser Folie (Folie ${folie.nummer}); nichts geändert.`,
  };
}

function ersetzeImLauf(folienXml: string, alt: string, neu: string): string {
  return folienXml.replace(TEXTLAUF, (ganz, attr: string | undefined, roh: string) => {
    const t = xmlText(roh);
    return vorkommen(t, alt) === 1
      ? `<a:t${attr ?? ""}>${xmlEsc(t.split(alt).join(neu))}</a:t>`
      : ganz;
  });
}

/** Ohne gespeicherte Fassung heißt kein Schritt „eingearbeitet" — er ist nur vorbereitet. */
function nichtImDokument(ergebnisse: readonly SchrittErgebnis[], grund: string): SchrittErgebnis[] {
  return ergebnisse.map((e) =>
    e.status === "eingearbeitet" ? { ...e, status: "nicht_ausgefuehrt", grund } : e,
  );
}

function herkunftSatz(h: Herkunft): string {
  const art =
    h.art === "meetingbeschluss"
      ? "Meetingbeschluss"
      : h.art === "nutzerauftrag"
        ? "Nutzerauftrag"
        : "KI-Empfehlung";
  const wo = [h.quelle, h.stelle].filter(Boolean).join(", ");
  return `${art}${wo ? ` (${wo})` : ""}${h.grund ? ` — ${h.grund}` : ""}`;
}

// ------------------------------------------------------------------------------------------------
// ERGEBNIS
// ------------------------------------------------------------------------------------------------

export type Schutzklasse = NonNullable<KnowledgeObject["confidentiality"]>;

export interface Folgeprodukt {
  readonly art: "handout" | "sprechernotizen" | "aenderungsuebersicht" | "entwurf";
  readonly objectId: string;
  readonly name: string;
  readonly mime: string;
  readonly eigentuemer: string;
  /** Wohin es geht: nirgendwohin. Es ist ein privates Objekt des Auftraggebers. */
  readonly ziel: "privat";
  readonly schutzklasse: Schutzklasse;
  readonly versandt: false;
  readonly gemeinsamFreigegeben: false;
  readonly herkunft: {
    readonly koId: string;
    readonly anhangId: string;
    readonly fassung: number;
    readonly objectId: string;
  };
}

export interface Konfliktschritt {
  readonly id: string;
  readonly folieId: number;
  readonly lage: "passt_auf_heutigen_stand" | "konflikt";
  readonly grund: string;
  /** Der heutige Text der Folie, wenn sie inzwischen geändert wurde. */
  readonly heutigerText?: readonly string[];
}

export interface Konfliktbericht {
  readonly basisFassung: number;
  readonly heutigeFassung: number;
  readonly schritte: readonly Konfliktschritt[];
  /** Wahr, wenn jeder eingearbeitete Schritt auf den heutigen Stand passt. */
  readonly zusammenfuehrbar: boolean;
  readonly angebot: string;
}

export interface Wiederoeffnungspruefung {
  readonly wiedergeoeffnet: boolean;
  readonly fassung: number;
  readonly objectId: string;
  readonly bestaetigt: readonly string[];
  readonly nichtBestaetigt: readonly string[];
  readonly notizenBestaetigt: readonly number[];
  readonly folienUnveraendert: boolean;
  readonly vorlageUnveraendert: boolean;
  readonly geaenderteTeile: readonly string[];
  readonly ok: boolean;
}

export type Laufzustand = "gespeichert" | "nichts_gespeichert" | "konflikt" | "gestoppt";

export interface NachbearbeitungsErgebnis {
  readonly laufId: string;
  readonly koId: string;
  readonly anhangId: string;
  readonly anhangName: string;
  readonly zustand: Laufzustand;
  readonly basisFassung: number;
  readonly basisObjectId: string;
  readonly neueFassung?: number;
  readonly objectId?: string;
  readonly aenderungsuebersicht: readonly SchrittErgebnis[];
  readonly sprechernotizen?: {
    readonly nativ: readonly number[];
    readonly alsDatei: readonly { readonly folieId: number; readonly grund: string }[];
  };
  readonly folgeprodukte: readonly Folgeprodukt[];
  readonly pruefung?: Wiederoeffnungspruefung;
  readonly konflikt?: Konfliktbericht;
  /** Vor welchem Schritt angehalten wurde. */
  readonly gestopptVor?: string;
  readonly ruecknahme?: {
    readonly moeglich: boolean;
    readonly ausFassung: number;
    readonly hinweis: string;
  };
  readonly fachstatus: {
    readonly vorher: string;
    readonly nachher: string;
    readonly hinweis: string;
  };
  /**
   * Ben-Befund AC07: Stopp NACH dem Hochladen, VOR der Übernahme. Die Datei liegt im Speicher, ist
   * aber nicht am Artikel — eine PRIVATE Ableitung (`privatQuelle`): nur ihr Eigentümer liest sie,
   * solange er die Quelle sehen darf. Sie wird ausgewiesen, nicht verschwiegen.
   */
  readonly nichtUebernommen?: { readonly objectId: string; readonly hinweis: string };
  readonly grenzen: readonly string[];
}

/**
 * Eine bereits EINGETRETENE Wirkung eines Laufs. Der Kern meldet sie sofort (`Laufkontext.melde`),
 * damit ein späterer Fehler sie nicht unsichtbar macht (Ben-Befund AC07/G12).
 */
export type Wirkung =
  | { readonly art: "hochgeladen"; readonly objectId: string }
  | { readonly art: "fassung"; readonly fassung: number; readonly objectId: string }
  | { readonly art: "folgeprodukt"; readonly folgeprodukt: Folgeprodukt };

/** Ein Lauf, der nach mindestens einer Wirkung an einem Fehler endete. */
export interface Teilfehler {
  readonly laufId: string;
  readonly koId: string;
  readonly anhangId: string;
  readonly zustand: "teilfehler";
  /** Was tatsächlich geschehen ist, in Reihenfolge — mit Ergebniskennungen. */
  readonly wirkungen: readonly Wirkung[];
  readonly fehler: { readonly code: string; readonly meldung: string };
  readonly ruecknahme?: {
    readonly moeglich: true;
    readonly ausFassung: number;
    readonly hinweis: string;
  };
}

/** Baut aus den gemeldeten Wirkungen den sichtbaren Teilfehlerstand. */
export function teilfehler(
  auftrag: { readonly laufId: string; readonly basisFassung: number },
  ort: { readonly koId: string; readonly anhangId: string },
  wirkungen: readonly Wirkung[],
  fehler: unknown,
): Teilfehler {
  const gespeichert = wirkungen.some((w) => w.art === "fassung");
  return {
    laufId: auftrag.laufId,
    koId: ort.koId,
    anhangId: ort.anhangId,
    zustand: "teilfehler",
    wirkungen: [...wirkungen],
    fehler: {
      code: fehlerCode(fehler) || "FEHLER",
      meldung: gespeichert
        ? "Die neue Fassung ist gespeichert; ein späterer Schritt ist gescheitert. Die erfolgten Wirkungen stehen in `wirkungen`; eine Wiederholung dieses Laufs erzeugt keine weiteren Kopien."
        : "Der Lauf ist nach dem Hochladen gescheitert; der Artikel ist unverändert. Die erfolgten Wirkungen stehen in `wirkungen`.",
    },
    ...(gespeichert
      ? {
          ruecknahme: {
            moeglich: true as const,
            ausFassung: auftrag.basisFassung,
            hinweis: `„Zurückholen" aus Fassung ${auftrag.basisFassung} stellt den vorherigen Dokumentstand als neue Fassung wieder her.`,
          },
        }
      : {}),
  };
}

// ------------------------------------------------------------------------------------------------
// AUSFÜHREN
// ------------------------------------------------------------------------------------------------

export interface NachbearbeitungsDeps {
  readonly ko: OfficeKoDienst;
  readonly objekte: ObjectStore;
  /** Der Verlauf des Anhangs (`anhangVerlauf`), für den Stand der Basisfassung. */
  readonly verlauf: (artikel: KnowledgeObject, anhangId: string) => Promise<AnhangFassung[]>;
  readonly jetzt: () => number;
}

export interface Laufkontext {
  readonly artikel: KnowledgeObject;
  readonly anhang: { readonly id: string; readonly name: string; readonly mime: string };
  readonly nutzerId: string;
  /** Wird vor JEDER Wirkung gefragt; `true` hält an, bereits Geschehenes bleibt. */
  readonly gestoppt: () => boolean;
  /** Erhält jede eingetretene Wirkung SOFORT — nicht erst mit dem Ergebnis am Ende. */
  readonly melde?: (wirkung: Wirkung) => void;
}

const GRENZEN = [
  "Geändert wird nur Folientext in einzelnen Formatierungsläufen; Diagramme, Datenreihen, Bilder, Layout und Vorlage ändert dieser Weg nicht.",
  "Handout, Notizdatei, Änderungsübersicht und Entwurf sind private Markdown-/PPTX-Objekte des Auftraggebers: nicht versandt, nicht geteilt, an keinen Artikel gebunden; lesbar nur für ihn, solange er die Quelle sehen darf.",
  "Kein Modell läuft in diesem Schritt; die Texte stammen aus dem Auftrag und tragen ihre Herkunft.",
  "Geprüft ist die Datei; die Darstellung in Microsoft PowerPoint ist nicht belegt.",
];

function hoehereKlasse(k: KnowledgeObject["confidentiality"]): Schutzklasse {
  // Private Folgeprodukte sind mindestens vertraulich (Zwischenspeicher: `no-store`). Wer sie lesen
  // darf, entscheidet NICHT die Stufe, sondern `privatQuelle`: nur der Eigentümer, solange er die
  // Quelle sieht (`privatesFolgeprodukt`, sichtbarkeit.ts) — auch `ko.validate` öffnet sie nicht.
  return k === "streng_vertraulich" ? "streng_vertraulich" : "vertraulich";
}

async function bytesVon(objekte: ObjectStore, objectId: string): Promise<Buffer> {
  const gespeichert = await objekte.read(objectId);
  const bytes = gespeichert ? decodeDataUrl(gespeichert.data)?.bytes : undefined;
  if (!bytes) {
    throw new NachbearbeitungsFehler("KEINE_PRAESENTATION", "Der Dokumentstand ist nicht lesbar.");
  }
  return bytes;
}

async function basisObjekt(
  deps: NachbearbeitungsDeps,
  ctx: Laufkontext,
  basisFassung: number,
): Promise<string> {
  const aktuell = ctx.artikel.attachments?.find((a) => a.id === ctx.anhang.id)?.objectId;
  if (basisFassung > ctx.artikel.version) {
    throw new NachbearbeitungsFehler(
      "INVALID",
      `Fassung ${basisFassung} gibt es nicht; der Artikel steht bei Fassung ${ctx.artikel.version}.`,
    );
  }
  if (basisFassung === ctx.artikel.version && aktuell) {
    return aktuell;
  }
  const zeile = (await deps.verlauf(ctx.artikel, ctx.anhang.id))
    .filter((z) => z.version <= basisFassung)
    .at(-1);
  if (!zeile) {
    throw new NachbearbeitungsFehler(
      "INVALID",
      `Zu Fassung ${basisFassung} ist kein Stand dieses Dokuments bekannt.`,
    );
  }
  return zeile.objectId;
}

async function alleTeile(zip: JSZip): Promise<Map<string, string>> {
  const teile = new Map<string, string>();
  for (const name of Object.keys(zip.files).sort()) {
    const datei = zip.file(name);
    if (datei) {
      teile.set(name, await datei.async("base64"));
    }
  }
  return teile;
}

function markdown(zeilen: readonly (string | false | undefined)[]): string {
  return `${zeilen.filter((z): z is string => typeof z === "string").join("\n")}\n`;
}

function uebersichtZeilen(schritte: readonly SchrittErgebnis[]): string[] {
  const gruppe = (titel: string, auswahl: SchrittErgebnis[]) =>
    auswahl.length === 0
      ? []
      : [
          "",
          `### ${titel}`,
          ...auswahl.map(
            (s) =>
              `- Folie ${s.folieNummer ?? s.folieId}${s.folienTitel ? ` „${s.folienTitel}"` : ""}: ${s.alt ? `„${s.alt}" → „${s.neu ?? ""}"` : s.art} — ${herkunftSatz(s.herkunft)}${s.zahlenbeleg ? ` · Zahlenquelle: ${s.zahlenbeleg.quelle}${s.zahlenbeleg.stelle ? `, ${s.zahlenbeleg.stelle}` : ""}` : ""} · ${s.status}: ${s.grund}`,
          ),
        ];
  return [
    ...gruppe(
      "Ausdrückliche Meetingbeschlüsse",
      schritte.filter((s) => s.herkunft.art === "meetingbeschluss"),
    ),
    ...gruppe(
      "Nutzeraufträge",
      schritte.filter((s) => s.herkunft.art === "nutzerauftrag"),
    ),
    ...gruppe(
      "Eigene KI-Empfehlungen (nicht eingearbeitet)",
      schritte.filter((s) => s.herkunft.art === "ki_empfehlung"),
    ),
  ];
}

/**
 * Führt einen geprüften Auftrag aus. Wirkungen in dieser Reihenfolge, jede nach einer Stopp-Abfrage:
 * Fassung speichern → wiederöffnen und prüfen → Handout → Notizdatei → Änderungsübersicht.
 */
export async function fuehreNachbearbeitungAus(
  deps: NachbearbeitungsDeps,
  ctx: Laufkontext,
  auftrag: Nachbearbeitungsauftrag,
): Promise<NachbearbeitungsErgebnis> {
  const basisObjectId = await basisObjekt(deps, ctx, auftrag.basisFassung);
  const basisBytes = await bytesVon(deps.objekte, basisObjectId);
  const basis = await lesePraesentation(basisBytes);
  const arbeit = await JSZip.loadAsync(basisBytes);
  const folieZu = new Map(basis.folien.map((f) => [f.folieId, f] as const));
  const schutzklasse = hoehereKlasse(ctx.artikel.confidentiality);
  const grundlage = {
    laufId: auftrag.laufId,
    koId: ctx.artikel.id,
    anhangId: ctx.anhang.id,
    anhangName: ctx.anhang.name,
    basisFassung: auftrag.basisFassung,
    basisObjectId,
    grenzen: GRENZEN,
  };
  const fachstatus = (nachher: string) => ({
    vorher: ctx.artikel.status,
    nachher,
    hinweis:
      "Die Nachbearbeitung erhöht den fachlichen Freigabestatus nie; eine neue Fassung ist offen, bis der Eigentümer sie fachlich prüft.",
  });

  // 1 · SCHRITTE PRÜFEN UND IM ARBEITSSPEICHER ANWENDEN.
  const ergebnisse: SchrittErgebnis[] = [];
  const geaendert = new Set<string>();
  let gestopptVor: string | undefined;
  for (const s of auftrag.schritte) {
    const folie = folieZu.get(s.folieId);
    const kopf = {
      id: s.id,
      art: s.art,
      folieId: s.folieId,
      ...(folie ? { folieNummer: folie.nummer, folienTitel: folie.titel } : {}),
      herkunft: s.herkunft,
      ...(s.alt === undefined ? {} : { alt: s.alt }),
      ...(s.neu === undefined ? {} : { neu: s.neu }),
      ...(s.zahlenbeleg ? { zahlenbeleg: s.zahlenbeleg } : {}),
    };
    if (gestopptVor === undefined && ctx.gestoppt()) {
      gestopptVor = `schritt:${s.id}`;
    }
    if (gestopptVor !== undefined) {
      ergebnisse.push({
        ...kopf,
        status: "nicht_ausgefuehrt",
        grund: "Angehalten, bevor dieser Schritt an der Reihe war.",
      });
      continue;
    }
    const xml = folie ? ((await arbeit.file(folie.pfad)?.async("string")) ?? "") : "";
    const p = pruefeSchritt(s, folie, xml);
    if (!p.anwendbar) {
      ergebnisse.push({ ...kopf, status: p.status, grund: p.grund });
      continue;
    }
    if (!folie) {
      continue;
    }
    arbeit.file(folie.pfad, ersetzeImLauf(xml, s.alt ?? "", s.neu ?? ""));
    geaendert.add(folie.pfad);
    ergebnisse.push({
      ...kopf,
      status: "eingearbeitet",
      grund:
        s.herkunft.art === "meetingbeschluss"
          ? "Eingearbeitet: ausdrücklicher Beschluss mit belegter Gesprächsstelle."
          : "Eingearbeitet: ausdrücklicher Auftrag des Nutzers.",
    });
  }
  if (gestopptVor !== undefined) {
    return {
      ...grundlage,
      zustand: "gestoppt",
      gestopptVor,
      aenderungsuebersicht: nichtImDokument(
        ergebnisse,
        "Vorbereitet, aber angehalten, bevor gespeichert wurde; nicht im Dokument.",
      ),
      folgeprodukte: [],
      fachstatus: fachstatus(ctx.artikel.status),
    };
  }

  // 2 · SPRECHERNOTIZEN: an die echte Notizseite anfügen, sonst in die Notizdatei.
  const notizenNativ: number[] = [];
  const notizenDatei: { folieId: number; grund: string; zeilen: string[] }[] = [];
  const notizText = new Map<number, string[]>();
  if (auftrag.folgeprodukte.sprechernotizen) {
    for (const n of auftrag.sprechernotizen) {
      notizText.set(n.folieId, [
        ...(notizText.get(n.folieId) ?? []),
        `${n.text} [${herkunftSatz(n.herkunft)}]`,
      ]);
    }
    for (const e of ergebnisse.filter((x) => x.status === "eingearbeitet")) {
      notizText.set(e.folieId, [
        ...(notizText.get(e.folieId) ?? []),
        `Geändert: „${e.alt}" → „${e.neu}" — ${herkunftSatz(e.herkunft)}`,
      ]);
    }
    for (const [folieId, zeilen] of notizText) {
      const folie = folieZu.get(folieId);
      if (!folie) {
        notizenDatei.push({ folieId, grund: `Folie ${folieId} gibt es nicht.`, zeilen });
        continue;
      }
      const notizXml = folie.notizPfad
        ? await arbeit.file(folie.notizPfad)?.async("string")
        : undefined;
      const neu = notizXml ? fuegeNotizAn(notizXml, zeilen) : undefined;
      if (folie.notizPfad && neu) {
        arbeit.file(folie.notizPfad, neu);
        geaendert.add(folie.notizPfad);
        notizenNativ.push(folieId);
      } else {
        notizenDatei.push({
          folieId,
          grund: folie.notizPfad
            ? "Die Notizseite dieser Folie hat keinen Textbereich; es wurde keiner erfunden."
            : "Diese Präsentation hat für die Folie keine Notizseite; eine echte PowerPoint-Notiz wird hier nicht neu angelegt. Die Notiz steht in der Notizdatei.",
          zeilen,
        });
      }
    }
  }
  const sprechernotizen = auftrag.folgeprodukte.sprechernotizen
    ? {
        nativ: notizenNativ,
        alsDatei: notizenDatei.map(({ folieId, grund }) => ({ folieId, grund })),
      }
    : undefined;

  const privat = async (
    art: Folgeprodukt["art"],
    name: string,
    mime: string,
    bytes: Buffer,
    fassung: number,
    objectId: string,
  ): Promise<Folgeprodukt> => {
    const ref = await deps.objekte.put({
      name,
      mime,
      data: `data:${mime};base64,${bytes.toString("base64")}`,
      purpose: "attachment",
      owner: ctx.nutzerId,
      confidentiality: schutzklasse,
      // Ben-Befund AC08/AC09: die Zugriffsregel am Objekt — nur der Eigentümer, und nur solange er
      // die Quelle sehen darf (`privatesFolgeprodukt`, sichtbarkeit.ts). Keine Rolle öffnet es.
      privatQuelle: ctx.artikel.id,
    });
    const produkt: Folgeprodukt = {
      art,
      objectId: ref.id,
      name,
      mime,
      eigentuemer: ctx.nutzerId,
      ziel: "privat",
      schutzklasse,
      versandt: false,
      gemeinsamFreigegeben: false,
      herkunft: { koId: ctx.artikel.id, anhangId: ctx.anhang.id, fassung, objectId },
    };
    ctx.melde?.({ art: "folgeprodukt", folgeprodukt: produkt });
    return produkt;
  };

  // 3 · VOR DEM SPEICHERN: HEUTIGEN STAND ABGLEICHEN. Nichts wird überschrieben.
  const neueBytes =
    geaendert.size > 0
      ? await arbeit.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
      : undefined;
  const konfliktbericht = async (heute: KnowledgeObject): Promise<NachbearbeitungsErgebnis> => {
    const heuteObjekt = heute.attachments?.find((a) => a.id === ctx.anhang.id)?.objectId;
    const heutige = heuteObjekt
      ? await lesePraesentation(await bytesVon(deps.objekte, heuteObjekt))
      : undefined;
    const schritte: Konfliktschritt[] = [];
    for (const e of ergebnisse.filter((x) => x.status === "eingearbeitet")) {
      const vorher = folieZu.get(e.folieId);
      const jetzt = heutige?.folien.find((f) => f.folieId === e.folieId);
      const xmlVorher = vorher ? await basis.zip.file(vorher.pfad)?.async("string") : undefined;
      const xmlJetzt = jetzt ? await heutige?.zip.file(jetzt.pfad)?.async("string") : undefined;
      if (!jetzt) {
        schritte.push({
          id: e.id,
          folieId: e.folieId,
          lage: "konflikt",
          grund: "Die Folie gibt es im heutigen Stand nicht mehr.",
        });
      } else if (xmlVorher !== undefined && xmlVorher === xmlJetzt) {
        schritte.push({
          id: e.id,
          folieId: e.folieId,
          lage: "passt_auf_heutigen_stand",
          grund:
            "Die Folie ist seit der Basisfassung unverändert; der Schritt lässt sich übertragen.",
        });
      } else {
        schritte.push({
          id: e.id,
          folieId: e.folieId,
          lage: "konflikt",
          grund:
            "Die Folie wurde inzwischen von anderer Seite geändert; die Änderung wird nicht darübergeschrieben.",
          heutigerText: jetzt.absaetze,
        });
      }
    }
    const zusammenfuehrbar = schritte.every((s) => s.lage === "passt_auf_heutigen_stand");
    const entwurf =
      neueBytes && !ctx.gestoppt()
        ? [
            await privat(
              "entwurf",
              `Entwurf – ${ctx.anhang.name}`,
              ctx.anhang.mime,
              neueBytes,
              auftrag.basisFassung,
              basisObjectId,
            ),
          ]
        : [];
    return {
      ...grundlage,
      zustand: "konflikt",
      aenderungsuebersicht: nichtImDokument(
        ergebnisse,
        `Nicht im Dokument: es wurde seit Fassung ${auftrag.basisFassung} geändert.${entwurf.length > 0 ? " Der Schritt steht im privaten Entwurf." : ""}`,
      ),
      folgeprodukte: entwurf,
      konflikt: {
        basisFassung: auftrag.basisFassung,
        heutigeFassung: heute.version,
        schritte,
        zusammenfuehrbar,
        angebot: zusammenfuehrbar
          ? `Alle Änderungen passen auf den heutigen Stand. Denselben Auftrag mit basisFassung ${heute.version} erneut erteilen, um sie dort einzuarbeiten.`
          : "Mindestens eine Folie wurde inzwischen geändert. Der eigene Stand liegt als privater Entwurf vor; die betroffenen Folien bitte abstimmen und den Auftrag für den heutigen Stand neu erteilen.",
      },
      fachstatus: fachstatus(heute.status),
    };
  };

  let gespeichert: { ko: KnowledgeObject; objectId: string } | undefined;
  if (neueBytes) {
    const heute = await deps.ko.get(ctx.artikel.id);
    const heuteObjekt = heute?.attachments?.find((a) => a.id === ctx.anhang.id)?.objectId;
    if (!heute || !heuteObjekt) {
      throw new NachbearbeitungsFehler("INVALID", "Der Anhang ist nicht mehr vorhanden.");
    }
    if (heute.version !== auftrag.basisFassung || heuteObjekt !== basisObjectId) {
      return konfliktbericht(heute);
    }
    if (ctx.gestoppt()) {
      // Vorbereitet ist nicht gespeichert: kein Schritt darf hier „eingearbeitet" heißen.
      return {
        ...grundlage,
        zustand: "gestoppt",
        gestopptVor: "speichern",
        aenderungsuebersicht: nichtImDokument(
          ergebnisse,
          "Vorbereitet, aber vor dem Speichern angehalten; nicht im Dokument.",
        ),
        folgeprodukte: [],
        fachstatus: fachstatus(ctx.artikel.status),
      };
    }
    const ref = await deps.objekte.put({
      name: ctx.anhang.name,
      mime: ctx.anhang.mime,
      data: `data:${ctx.anhang.mime};base64,${neueBytes.toString("base64")}`,
      purpose: "attachment",
      owner: ctx.nutzerId,
      // Ben-Befund AC08 (Nacharbeit 6): schon der hochgeladene Stand ist eine private Ableitung der
      // Quelle — bei Stopp oder gescheiterter Übernahme liest ihn nur sein Eigentümer, solange er
      // die Quelle sehen darf. Nach der Übernahme hängt er an der Quelle bzw. steht in ihrer
      // Belegkette; dann gilt die gewöhnliche Anhangsregel (`privatesFolgeprodukt`).
      privatQuelle: ctx.artikel.id,
    });
    ctx.melde?.({ art: "hochgeladen", objectId: ref.id });
    // Ben-Befund AC07: ein Stopp, der WÄHREND des Hochladens bestätigt wurde, verhindert die
    // Übernahme. Die hochgeladene Datei ist ein reales Teilergebnis und wird ausgewiesen.
    if (ctx.gestoppt()) {
      return {
        ...grundlage,
        zustand: "gestoppt",
        gestopptVor: "uebernahme",
        aenderungsuebersicht: nichtImDokument(
          ergebnisse,
          "Hochgeladen, aber vor der Übernahme angehalten; nicht im Dokument.",
        ),
        folgeprodukte: [],
        nichtUebernommen: {
          objectId: ref.id,
          hinweis:
            "Die bearbeitete Datei liegt im Speicher, ist aber NICHT am Artikel; der Artikel ist unverändert. Sie ist privat: nur der Auftraggeber liest sie, solange er den Artikel sehen darf.",
        },
        fachstatus: fachstatus(ctx.artikel.status),
      };
    }
    try {
      const { ko } = await deps.ko.uebernimmOfficeFassung(
        ctx.artikel.id,
        {
          anhangId: ctx.anhang.id,
          objectId: ref.id,
          size: ref.size,
          expectedVersion: auftrag.basisFassung,
        },
        ctx.nutzerId,
      );
      gespeichert = { ko, objectId: ref.id };
      ctx.melde?.({ art: "fassung", fassung: ko.version, objectId: ref.id });
    } catch (fehler) {
      const code = fehlerCode(fehler);
      if (code === "KO_STALE" || code === "STALE_WRITE") {
        const heuteNeu = await deps.ko.get(ctx.artikel.id);
        if (heuteNeu) {
          return konfliktbericht(heuteNeu);
        }
      }
      throw fehler;
    }
  }

  // 4 · WIEDERÖFFNEN: die gespeicherte Datei aus dem Speicher lesen und jede Änderung nachprüfen.
  let pruefung: Wiederoeffnungspruefung | undefined;
  let stand = basis;
  if (gespeichert) {
    const objectId =
      gespeichert.ko.attachments?.find((a) => a.id === ctx.anhang.id)?.objectId ??
      gespeichert.objectId;
    const wieder = await lesePraesentation(await bytesVon(deps.objekte, objectId));
    stand = wieder;
    const bestaetigt: string[] = [];
    const nichtBestaetigt: string[] = [];
    for (const e of ergebnisse.filter((x) => x.status === "eingearbeitet")) {
      const vorher = folieZu.get(e.folieId);
      const folie = wieder.folien.find((f) => f.folieId === e.folieId);
      const textVorher = vorher?.absaetze.join("\n") ?? "";
      const textJetzt = folie?.absaetze.join("\n") ?? "";
      const altWeniger =
        vorkommen(textJetzt, e.alt ?? "") < vorkommen(textVorher, e.alt ?? "") ||
        (e.neu ?? "").includes(e.alt ?? "");
      if (folie && textJetzt.includes(e.neu ?? "") && altWeniger) {
        bestaetigt.push(e.id);
      } else {
        nichtBestaetigt.push(e.id);
      }
    }
    const notizenBestaetigt: number[] = [];
    for (const folieId of notizenNativ) {
      const folie = wieder.folien.find((f) => f.folieId === folieId);
      const xml = folie?.notizPfad ? await wieder.zip.file(folie.notizPfad)?.async("string") : "";
      const erwartet = notizText.get(folieId) ?? [];
      const gelesen = notizAbsaetze(xml ?? "");
      if (erwartet.every((z) => gelesen.includes(z))) {
        notizenBestaetigt.push(folieId);
      }
    }
    const teileVorher = await alleTeile(basis.zip);
    const teileJetzt = await alleTeile(wieder.zip);
    const geaenderteTeile = [...new Set([...teileVorher.keys(), ...teileJetzt.keys()])]
      .filter((n) => teileVorher.get(n) !== teileJetzt.get(n))
      .sort();
    const vorlageUnveraendert = geaenderteTeile.every((n) => geaendert.has(n));
    const folienUnveraendert =
      wieder.folien.map((f) => `${f.folieId}:${f.pfad}:${f.ausgeblendet}`).join("|") ===
      basis.folien.map((f) => `${f.folieId}:${f.pfad}:${f.ausgeblendet}`).join("|");
    pruefung = {
      wiedergeoeffnet: true,
      fassung: gespeichert.ko.version,
      objectId,
      bestaetigt,
      nichtBestaetigt,
      notizenBestaetigt,
      folienUnveraendert,
      vorlageUnveraendert,
      geaenderteTeile,
      ok:
        nichtBestaetigt.length === 0 &&
        notizenBestaetigt.length === notizenNativ.length &&
        vorlageUnveraendert &&
        folienUnveraendert,
    };
  }

  const fassung = gespeichert?.ko.version ?? auftrag.basisFassung;
  const standObjekt = pruefung?.objectId ?? basisObjectId;
  const abschluss = (folgeprodukte: Folgeprodukt[], vor?: string): NachbearbeitungsErgebnis => ({
    ...grundlage,
    zustand: vor ? "gestoppt" : gespeichert ? "gespeichert" : "nichts_gespeichert",
    ...(vor ? { gestopptVor: vor } : {}),
    ...(gespeichert ? { neueFassung: gespeichert.ko.version, objectId: standObjekt } : {}),
    aenderungsuebersicht: ergebnisse,
    ...(sprechernotizen ? { sprechernotizen } : {}),
    folgeprodukte,
    ...(pruefung ? { pruefung } : {}),
    ...(gespeichert
      ? {
          ruecknahme: {
            moeglich: true,
            ausFassung: auftrag.basisFassung,
            hinweis: `„Zurückholen" aus Fassung ${auftrag.basisFassung} stellt den vorherigen Dokumentstand als neue Fassung wieder her. Die privaten Folgeprodukte wurden nicht versandt.`,
          },
        }
      : {}),
    fachstatus: fachstatus(gespeichert?.ko.status ?? ctx.artikel.status),
  });

  // 5 · FOLGEPRODUKTE — privat, aus dem WIEDERGEÖFFNETEN Stand, nur sichtbare Folien, keine Notizseiten.
  const folgeprodukte: Folgeprodukt[] = [];
  const kopfzeilen = [
    `Erstellt aus „${ctx.anhang.name}", Fassung ${fassung}, am ${new Date(deps.jetzt()).toISOString()}.`,
    `Eigentümer: ${ctx.nutzerId} · Ziel: privat · Schutzklasse: ${schutzklasse} · nicht versandt, nicht geteilt.`,
  ];
  if (auftrag.folgeprodukte.handout) {
    if (ctx.gestoppt()) {
      return abschluss(folgeprodukte, "handout");
    }
    const sichtbar = stand.folien.filter((f) => !f.ausgeblendet);
    const inhalt = markdown([
      `# Handout · ${ctx.artikel.title}`,
      "",
      ...kopfzeilen,
      ...sichtbar.flatMap((f) => [
        "",
        `## Folie ${f.nummer} · ${f.titel}`,
        ...f.absaetze.filter((a) => a !== f.titel).map((a) => `- ${a}`),
      ]),
      "",
      "## Änderungen gegenüber der besprochenen Fassung",
      ...uebersichtZeilen(ergebnisse),
      ergebnisse.length === 0 && "- Keine.",
      "",
      `Ausgeblendete Folien (${stand.folien.length - sichtbar.length}) und Sprechernotizen sind nicht enthalten.`,
    ]);
    folgeprodukte.push(
      await privat(
        "handout",
        `Handout – ${ctx.anhang.name}.md`,
        "text/markdown",
        Buffer.from(inhalt, "utf8"),
        fassung,
        standObjekt,
      ),
    );
  }
  if (notizenDatei.length > 0) {
    if (ctx.gestoppt()) {
      return abschluss(folgeprodukte, "sprechernotizen");
    }
    const inhalt = markdown([
      `# Sprechernotizen · ${ctx.anhang.name}`,
      "",
      ...kopfzeilen,
      "Diese Notizen stehen NICHT in der PowerPoint-Datei; die betroffenen Folien haben dort keine Notizseite.",
      ...notizenDatei.flatMap((n) => {
        const f = stand.folien.find((x) => x.folieId === n.folieId);
        return [
          "",
          `## Folie ${f ? `${f.nummer} · ${f.titel}` : n.folieId}`,
          ...n.zeilen.map((z) => `- ${z}`),
        ];
      }),
    ]);
    folgeprodukte.push(
      await privat(
        "sprechernotizen",
        `Sprechernotizen – ${ctx.anhang.name}.md`,
        "text/markdown",
        Buffer.from(inhalt, "utf8"),
        fassung,
        standObjekt,
      ),
    );
  }
  if (ctx.gestoppt()) {
    return abschluss(folgeprodukte, "aenderungsuebersicht");
  }
  const uebersicht = markdown([
    `# Änderungsübersicht · ${ctx.anhang.name}`,
    "",
    ...kopfzeilen,
    `Basis: Fassung ${auftrag.basisFassung}${gespeichert ? ` · neue Fassung ${gespeichert.ko.version}` : " · keine neue Fassung"}.`,
    pruefung &&
      `Wiederöffnet und geprüft: ${pruefung.bestaetigt.length} bestätigt, ${pruefung.nichtBestaetigt.length} nicht bestätigt; Vorlage ${pruefung.vorlageUnveraendert ? "unverändert" : "VERÄNDERT"}.`,
    ...uebersichtZeilen(ergebnisse),
  ]);
  folgeprodukte.push(
    await privat(
      "aenderungsuebersicht",
      `Änderungsübersicht – ${ctx.anhang.name}.md`,
      "text/markdown",
      Buffer.from(uebersicht, "utf8"),
      fassung,
      standObjekt,
    ),
  );
  return abschluss(folgeprodukte);
}

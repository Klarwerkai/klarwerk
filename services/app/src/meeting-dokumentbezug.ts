import { createHash } from "node:crypto";
import JSZip from "jszip";

// ================================================================================================
// BPA-16 · GESPRÄCHSAUSSAGEN MIT FOLIEN UND DOKUMENTSTELLEN VERBINDEN.
// ================================================================================================
//
// WAS DAS IST. Eine Rückmeldung aus einem Meeting („Bei dieser Grafik fehlt die
// Berechnungsgrundlage") wird an Datei, Fassung, Folie UND Gesprächszeitstelle gebunden — oder
// ehrlich als ungeklärt geführt. Es ist die Bindungsschicht zwischen einem berechtigten
// Foliensatz und einer zeitgebundenen Transkriptstelle; kein zweiter Assistenz-, Meeting- oder
// Änderungsdienst.
//
// DIE IDENTITÄT EINER FOLIE ist `p:sldId/@id` aus `ppt/presentation.xml` zusammen mit der
// Dateikennung und der Fassung (SHA-256 der Dateibytes). PowerPoint behält diese Kennung beim
// Umsortieren bei; die Position („Folie 3") ist reine Anzeige und wird nie als Identität
// gespeichert. Ein Folienwechsel, der nur eine Nummer meldet, bleibt deshalb in Klärung.
//
// WAS DIESE SCHICHT AUSDRÜCKLICH NICHT TUT:
//   · keine Schreibwirkung an der Originaldatei — sie erzeugt Änderungsobjekte mit Ziel, mehr nicht;
//   · keine OCR und keine Modellstufe — ein Bildschirmtext kommt von außen, bleibt unsicher und
//     adressiert nie selbst eine Änderung; bei „Keine KI" wird er gar nicht angenommen;
//   · kein Rückschluss aus Meetingmitgliedschaft auf Dokumentrechte: versteckte Folien und
//     Sprechernotizen erscheinen nur mit eigenem Leserecht, geprüft bei JEDEM Lesen.
//
// ZEITBASIS. Folienwechsel und Transkriptstellen tragen die Kennung ihrer Zeitbasis
// (Millisekunden ab Aufnahmebeginn). Passt sie nicht zur Zeitbasis des Meetings, wird nicht
// verschoben oder geraten, sondern geklärt.

/** Eine Folie, wie sie in genau einer Fassung einer Datei steht. */
export interface FolienAnker {
  /** `p:sldId/@id` — über Umsortieren stabil, die eigentliche Folienkennung. */
  sldId: string;
  /** 1-basierte Position in dieser Fassung — nur Anzeige. */
  position: number;
  titel: string;
  /** SHA-256 des Folien-XML: erkennt eine inhaltliche Änderung derselben Folie. */
  inhaltHash: string;
  /** `p:sld/@show="0"` — in der Bildschirmpräsentation ausgeblendet. */
  versteckt: boolean;
  /** Text der Sprechernotiz, falls vorhanden. Nie ungeprüft nach außen geben. */
  notizen: string | null;
}

/** Eine bestimmte Fassung einer Präsentationsdatei. */
export interface Foliensatz {
  dateiId: string;
  /** SHA-256 der Dateibytes. */
  fassung: string;
  folien: FolienAnker[];
}

export class FoliensatzFehler extends Error {}

function sha256(daten: Uint8Array | string): string {
  return createHash("sha256").update(daten).digest("hex");
}

function entities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Alle `<a:t>`-Texte eines XML-Ausschnitts, durch Leerzeichen verbunden. */
function texte(xml: string): string {
  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)]
    .map((m) => entities(m[1] ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function formen(xml: string): string[] {
  return [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => m[0]);
}

function hatPlatzhalter(sp: string, typen: string[]): boolean {
  return typen.some((typ) => sp.includes(`<p:ph type="${typ}"`));
}

/** Text der Formen mit einem Platzhalter der genannten Typen. */
function platzhalterText(xml: string, typen: string[]): string {
  return formen(xml)
    .filter((sp) => hatPlatzhalter(sp, typen))
    .map(texte)
    .join(" ")
    .trim();
}

/** Notiztext: alles außer Folienbild, Kopf-/Fußzeile, Datum und Foliennummer der Notizseite. */
function notizText(xml: string): string {
  return formen(xml)
    .filter((sp) => !hatPlatzhalter(sp, ["sldImg", "hdr", "ftr", "dt", "sldNum"]))
    .map(texte)
    .join(" ")
    .trim();
}

function beziehungen(rels: string): Map<string, { ziel: string; typ: string }> {
  const karte = new Map<string, { ziel: string; typ: string }>();
  for (const m of rels.matchAll(/<Relationship\s[^>]*>/g)) {
    const tag = m[0];
    const id = /\sId="([^"]*)"/.exec(tag)?.[1];
    const ziel = /\sTarget="([^"]*)"/.exec(tag)?.[1];
    const typ = /\sType="([^"]*)"/.exec(tag)?.[1];
    if (id && ziel && typ) {
      karte.set(id, { ziel, typ });
    }
  }
  return karte;
}

function teilPfad(basis: string, ziel: string): string {
  if (ziel.startsWith("/")) {
    return ziel.slice(1);
  }
  const teile = basis.split("/").slice(0, -1);
  for (const stueck of ziel.split("/")) {
    if (stueck === "..") {
      teile.pop();
    } else if (stueck !== ".") {
      teile.push(stueck);
    }
  }
  return teile.join("/");
}

/**
 * Liest die Folienanker einer echten `.pptx` (OOXML PresentationML). Gelesen werden
 * `ppt/presentation.xml` (Reihenfolge und `p:sldId`), die Beziehungen zu den Folienteilen, das
 * `show`-Attribut und die verknüpfte Notizfolie. Es wird nichts geschrieben.
 */
export async function foliensatzLesen(dateiId: string, bytes: Uint8Array): Promise<Foliensatz> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new FoliensatzFehler("Keine lesbare PPTX-Datei.");
  }
  const lies = async (pfad: string): Promise<string | null> =>
    (await zip.file(pfad)?.async("string")) ?? null;
  const praesentation = await lies("ppt/presentation.xml");
  const praesRels = await lies("ppt/_rels/presentation.xml.rels");
  if (!praesentation || !praesRels) {
    throw new FoliensatzFehler("ppt/presentation.xml oder ihre Beziehungen fehlen.");
  }
  const rels = beziehungen(praesRels);
  const folien: FolienAnker[] = [];
  for (const m of praesentation.matchAll(/<p:sldId\s[^>]*\/?>/g)) {
    const tag = m[0];
    const sldId = /\sid="(\d+)"/.exec(tag)?.[1];
    const rId = /\sr:id="([^"]*)"/.exec(tag)?.[1];
    const ziel = rId ? rels.get(rId) : undefined;
    if (!sldId || !ziel) {
      throw new FoliensatzFehler("Folie ohne auflösbare Kennung in ppt/presentation.xml.");
    }
    const pfad = teilPfad("ppt/presentation.xml", ziel.ziel);
    const xml = await lies(pfad);
    if (xml === null) {
      throw new FoliensatzFehler(`Folienteil fehlt: ${pfad}`);
    }
    const kopf = /<p:sld\s[^>]*>/.exec(xml)?.[0] ?? "";
    const folienRels = await lies(pfad.replace(/([^/]+)$/, "_rels/$1.rels"));
    let notizen: string | null = null;
    if (folienRels) {
      for (const rel of beziehungen(folienRels).values()) {
        if (rel.typ.endsWith("/notesSlide")) {
          const notizXml = await lies(teilPfad(pfad, rel.ziel));
          notizen = notizXml ? notizText(notizXml) || null : null;
        }
      }
    }
    folien.push({
      sldId,
      position: folien.length + 1,
      titel: platzhalterText(xml, ["title", "ctrTitle"]),
      inhaltHash: sha256(xml),
      versteckt: /\sshow="(0|false)"/.test(kopf),
      notizen,
    });
  }
  return { dateiId, fassung: sha256(bytes), folien };
}

// ------------------------------------------------------------------------------------------------
// Transkriptformat: WebVTT (so exportieren u. a. Teams und Zoom ihre Mitschriften).
// ------------------------------------------------------------------------------------------------

export interface Gespraechsstelle {
  id: string;
  /** Millisekunden ab Beginn der Zeitbasis. */
  startMs: number;
  endMs: number;
  sprecher: string | null;
  text: string;
}

function zeitMs(stempel: string): number {
  const teile = stempel.trim().split(":");
  const sekunden = Number(teile.pop());
  const minuten = Number(teile.pop() ?? 0);
  const stunden = Number(teile.pop() ?? 0);
  return Math.round(((stunden * 60 + minuten) * 60 + sekunden) * 1000);
}

/** Liest die Abschnitte einer WebVTT-Mitschrift. Abschnitte ohne Kennung erhalten `cue-N`. */
export function webvttLesen(vtt: string): Gespraechsstelle[] {
  const bloecke = vtt.replace(/\r\n/g, "\n").split(/\n\n+/);
  if (!bloecke[0]?.startsWith("WEBVTT")) {
    throw new FoliensatzFehler("Keine WebVTT-Mitschrift.");
  }
  const stellen: Gespraechsstelle[] = [];
  for (const block of bloecke.slice(1)) {
    const zeilen = block.split("\n").filter((z) => z.trim() !== "");
    const zeitIndex = zeilen.findIndex((z) => z.includes("-->"));
    if (zeitIndex < 0) {
      continue;
    }
    const [von, bis] = (zeilen[zeitIndex] ?? "").split("-->");
    const roh = zeilen.slice(zeitIndex + 1).join(" ");
    const stimme = /<v\s+([^>]+)>/.exec(roh)?.[1] ?? null;
    stellen.push({
      id: zeitIndex > 0 ? (zeilen[0] ?? "").trim() : `cue-${stellen.length + 1}`,
      startMs: zeitMs(von ?? ""),
      endMs: zeitMs((bis ?? "").trim().split(/\s/)[0] ?? ""),
      sprecher: stimme?.trim() ?? null,
      text: entities(roh.replace(/<[^>]+>/g, "")).trim(),
    });
  }
  return stellen;
}

// ------------------------------------------------------------------------------------------------
// Die Bindung.
// ------------------------------------------------------------------------------------------------

/** Rechte werden bei JEDEM Lesen erfragt — es gilt immer der aktuelle Stand. */
export interface Rechtepruefung {
  meetingLesen(nutzerId: string, meetingId: string): boolean;
  dokumentLesen(nutzerId: string, dateiId: string): boolean;
  versteckteFolienLesen(nutzerId: string, dateiId: string): boolean;
  notizenLesen(nutzerId: string, dateiId: string): boolean;
}

/** Ein Meeting mit seinen berechtigt verbundenen Foliensätzen. */
export interface MeetingVerbindung {
  meetingId: string;
  zeitbasis: string;
  /** Entspricht der Schutzstufenregel: false bei „Keine KI" (auch OCR ist eine Modellstufe). */
  ocrErlaubt: boolean;
}

export type Folienwechsel =
  | {
      quelle: "host";
      zeitMs: number;
      zeitbasis: string;
      dateiId: string;
      fassung: string;
      sldId: string;
    }
  | { quelle: "nummer"; zeitMs: number; zeitbasis: string; position: number }
  | { quelle: "ocr"; zeitMs: number; zeitbasis: string; bildschirmtext: string };

export type RueckmeldungsArt =
  | "beschlossene_korrektur"
  | "vorschlag"
  | "verworfener_vorschlag"
  | "offene_frage"
  | "ki_empfehlung";

/** Exakt eine Folie in exakt einer Fassung. */
export interface Folienziel {
  dateiId: string;
  fassung: string;
  sldId: string;
}

export type Klaerungsgrund =
  | "kein_folienwechsel"
  | "zeitbasis_abweichend"
  | "nur_foliennummer"
  | "bildschirmtext_unsicher";

export interface Bindung {
  /** Stand dieser Zuordnung; eine Klärung erzeugt eine neue Version, die alte bleibt erhalten. */
  version: number;
  status: "gebunden" | "klaerung_noetig";
  ziel: Folienziel | null;
  /** Abbild der Folie in der präsentierten Fassung — erbt nie späteren Inhalt. */
  praesentiert: { titel: string; inhaltHash: string; position: number } | null;
  grund: Klaerungsgrund | null;
  /** Kandidaten einer offenen Klärung (nur Kennungen; Titel erst in der Sicht, rechtegeprüft). */
  kandidaten: Folienziel[];
  geklaertVon: string | null;
}

export interface Rueckmeldung {
  id: string;
  meetingId: string;
  stelle: Gespraechsstelle;
  art: RueckmeldungsArt;
  herkunft: "gespraech" | "ki";
  text: string;
  bindung: Bindung;
  historie: Bindung[];
}

export interface Aenderungsobjekt {
  id: string;
  rueckmeldungId: string;
  art: "beschlossene_korrektur" | "vorschlag" | "ki_empfehlung";
  status: "offen" | "wartet_auf_klaerung" | "fassung_pruefen" | "ausgefuehrt" | "verworfen";
  /** Adressiertes Objekt. Null, solange die Zuordnung oder das Original ungeklärt ist. */
  ziel: Folienziel | null;
  bindungVersion: number;
}

export type KopieAbgleich =
  | { status: "identisch" | "inhaltsgleich"; originalZugriff: true; original: Foliensatz }
  | {
      status: "abweichend";
      originalZugriff: true;
      original: Foliensatz;
      abweichendeFolien: string[];
    }
  | { status: "ungeklaert"; originalZugriff: false };

export interface FassungsAbgleichEintrag {
  rueckmeldungId: string;
  sldId: string;
  stand: "unveraendert" | "geaendert" | "entfernt";
}

/** Was ein Nutzer von einer Rückmeldung sehen darf — zum Zeitpunkt des Lesens. */
export interface RueckmeldungsSicht {
  id: string;
  art: RueckmeldungsArt;
  herkunft: "gespraech" | "ki";
  text: string;
  stelle: { id: string; startMs: number; sprecher: string | null; text: string };
  status: Bindung["status"];
  grund: Klaerungsgrund | null;
  folie:
    | {
        lesbar: true;
        dateiId: string;
        fassung: string;
        sldId: string;
        titel: string;
        position: number;
        notizen: string | null;
      }
    | { lesbar: false }
    | null;
  kandidaten: { dateiId: string; sldId: string; titel: string }[];
}

export class BindungsFehler extends Error {}

function normal(text: string): string {
  return text.toLocaleLowerCase("de").replace(/\s+/g, " ").trim();
}

/** Noch nicht ausgeführt und nicht verworfen — nur solche Änderungsobjekte werden neu gebunden. */
function nochOffen(aenderung: Aenderungsobjekt | undefined): aenderung is Aenderungsobjekt {
  return (
    aenderung !== undefined &&
    aenderung.status !== "ausgefuehrt" &&
    aenderung.status !== "verworfen"
  );
}

export class MeetingDokumentbezug {
  private readonly saetze = new Map<string, Foliensatz>();
  private readonly originale = new Map<string, Foliensatz>();
  private readonly wechsel: Folienwechsel[] = [];
  private readonly meldungen = new Map<string, Rueckmeldung>();
  private readonly aenderungen = new Map<string, Aenderungsobjekt>();

  constructor(
    readonly meeting: MeetingVerbindung,
    private readonly rechte: Rechtepruefung,
  ) {}

  private schluessel(dateiId: string, fassung: string): string {
    return `${dateiId}@${fassung}`;
  }

  /**
   * Verbindet die tatsächlich präsentierte Fassung. `original` ist die berechtigt zugängliche
   * Originalfassung derselben Datei — oder null, wenn sie nicht zugänglich ist.
   */
  verbinden(praesentiert: Foliensatz, original: Foliensatz | null = null): KopieAbgleich {
    this.saetze.set(this.schluessel(praesentiert.dateiId, praesentiert.fassung), praesentiert);
    if (original) {
      this.originale.set(praesentiert.dateiId, original);
    }
    return this.kopieAbgleich(praesentiert.dateiId, praesentiert.fassung);
  }

  /** Gleicht eine präsentierte Fassung mit dem zugänglichen Original ab, ohne etwas zu behaupten. */
  kopieAbgleich(dateiId: string, fassung: string): KopieAbgleich {
    const kopie = this.saetze.get(this.schluessel(dateiId, fassung));
    const original = this.originale.get(dateiId);
    if (!kopie) {
      throw new BindungsFehler("Diese Fassung ist mit dem Meeting nicht verbunden.");
    }
    if (!original) {
      return { status: "ungeklaert", originalZugriff: false };
    }
    if (original.fassung === kopie.fassung) {
      return { status: "identisch", originalZugriff: true, original };
    }
    const abweichend = kopie.folien
      .filter((f) => original.folien.find((o) => o.sldId === f.sldId)?.inhaltHash !== f.inhaltHash)
      .map((f) => f.sldId);
    return abweichend.length === 0
      ? { status: "inhaltsgleich", originalZugriff: true, original }
      : { status: "abweichend", originalZugriff: true, original, abweichendeFolien: abweichend };
  }

  folienwechsel(ereignis: Folienwechsel): void {
    if (ereignis.quelle === "ocr" && !this.meeting.ocrErlaubt) {
      throw new BindungsFehler(
        "Bildschirmtext ist für dieses Meeting nicht zugelassen (Keine KI).",
      );
    }
    if (ereignis.quelle === "host") {
      const satz = this.saetze.get(this.schluessel(ereignis.dateiId, ereignis.fassung));
      if (!satz?.folien.some((f) => f.sldId === ereignis.sldId)) {
        throw new BindungsFehler("Folienwechsel auf eine nicht verbundene Fassung oder Folie.");
      }
    }
    this.wechsel.push(ereignis);
    this.wechsel.sort((a, b) => a.zeitMs - b.zeitMs);
  }

  private anker(ziel: Folienziel): FolienAnker | undefined {
    return this.saetze
      .get(this.schluessel(ziel.dateiId, ziel.fassung))
      ?.folien.find((f) => f.sldId === ziel.sldId);
  }

  /** Alle Folien der verbundenen Fassungen, deren Titel im Bildschirmtext vorkommt. */
  private ocrKandidaten(bildschirmtext: string): Folienziel[] {
    const gesehen = normal(bildschirmtext);
    const treffer: Folienziel[] = [];
    for (const satz of this.saetze.values()) {
      for (const f of satz.folien) {
        if (f.titel !== "" && gesehen.includes(normal(f.titel))) {
          treffer.push({ dateiId: satz.dateiId, fassung: satz.fassung, sldId: f.sldId });
        }
      }
    }
    return treffer;
  }

  private binden(stelle: Gespraechsstelle, zeitbasis: string, version: number): Bindung {
    const klaerung = (grund: Klaerungsgrund, kandidaten: Folienziel[] = []): Bindung => ({
      version,
      status: "klaerung_noetig",
      ziel: null,
      praesentiert: null,
      grund,
      kandidaten,
      geklaertVon: null,
    });
    if (zeitbasis !== this.meeting.zeitbasis) {
      return klaerung("zeitbasis_abweichend");
    }
    const aktuell = this.wechsel.filter((w) => w.zeitMs <= stelle.startMs).at(-1);
    if (!aktuell) {
      return klaerung("kein_folienwechsel");
    }
    if (aktuell.zeitbasis !== this.meeting.zeitbasis) {
      return klaerung("zeitbasis_abweichend");
    }
    if (aktuell.quelle === "nummer") {
      return klaerung("nur_foliennummer");
    }
    if (aktuell.quelle === "ocr") {
      return klaerung("bildschirmtext_unsicher", this.ocrKandidaten(aktuell.bildschirmtext));
    }
    const ziel = { dateiId: aktuell.dateiId, fassung: aktuell.fassung, sldId: aktuell.sldId };
    const anker = this.anker(ziel);
    return {
      version,
      status: "gebunden",
      ziel,
      praesentiert: anker
        ? { titel: anker.titel, inhaltHash: anker.inhaltHash, position: anker.position }
        : null,
      grund: null,
      kandidaten: [],
      geklaertVon: null,
    };
  }

  /**
   * Das Änderungsziel einer Bindung: die Originalfolie, wenn die präsentierte Folie dort
   * inhaltsgleich zugänglich ist; sonst null (keine automatische Adressierung).
   */
  private aenderungsziel(bindung: Bindung): Folienziel | null {
    if (bindung.status !== "gebunden" || !bindung.ziel || !bindung.praesentiert) {
      return null;
    }
    const { sldId } = bindung.ziel;
    const original = this.originale.get(bindung.ziel.dateiId);
    const folie = original?.folien.find((f) => f.sldId === sldId);
    if (!original || !folie || folie.inhaltHash !== bindung.praesentiert.inhaltHash) {
      return null;
    }
    return { dateiId: original.dateiId, fassung: original.fassung, sldId: folie.sldId };
  }

  /**
   * Nimmt eine ausdrücklich geäußerte Rückmeldung auf. Idempotent: dieselbe Stelle mit
   * derselben Art und demselben Text ergibt dieselbe Rückmeldung, kein zweites Objekt.
   */
  rueckmeldung(eingabe: {
    stelle: Gespraechsstelle;
    zeitbasis: string;
    art: RueckmeldungsArt;
    text: string;
  }): Rueckmeldung {
    const merkmal = [this.meeting.meetingId, eingabe.stelle.id, eingabe.art, normal(eingabe.text)];
    const id = `rm-${sha256(merkmal.join("\u0000")).slice(0, 16)}`;
    const vorhanden = this.meldungen.get(id);
    if (vorhanden) {
      return vorhanden;
    }
    const meldung: Rueckmeldung = {
      id,
      meetingId: this.meeting.meetingId,
      stelle: eingabe.stelle,
      art: eingabe.art,
      herkunft: eingabe.art === "ki_empfehlung" ? "ki" : "gespraech",
      text: eingabe.text,
      bindung: this.binden(eingabe.stelle, eingabe.zeitbasis, 1),
      historie: [],
    };
    this.meldungen.set(id, meldung);
    if (meldung.art !== "offene_frage") {
      this.aenderungAnlegen(meldung);
    }
    return meldung;
  }

  private aenderungAnlegen(meldung: Rueckmeldung): void {
    if (meldung.art === "offene_frage") {
      return;
    }
    const verworfen = meldung.art === "verworfener_vorschlag";
    const art: Aenderungsobjekt["art"] =
      meldung.art === "verworfener_vorschlag" ? "vorschlag" : meldung.art;
    const ziel = verworfen ? null : this.aenderungsziel(meldung.bindung);
    this.aenderungen.set(`ae-${meldung.id}`, {
      id: `ae-${meldung.id}`,
      rueckmeldungId: meldung.id,
      art,
      status: verworfen ? "verworfen" : ziel ? "offen" : "wartet_auf_klaerung",
      ziel,
      bindungVersion: meldung.bindung.version,
    });
  }

  /** Ein bisher offener Vorschlag wird verworfen; er bleibt als verworfener Vorschlag sichtbar. */
  verwerfen(rueckmeldungId: string): void {
    const meldung = this.meldungen.get(rueckmeldungId);
    if (!meldung || meldung.art !== "vorschlag") {
      throw new BindungsFehler("Nur ein Vorschlag kann verworfen werden.");
    }
    meldung.art = "verworfener_vorschlag";
    const aenderung = this.aenderungen.get(`ae-${meldung.id}`);
    if (aenderung && aenderung.status !== "ausgefuehrt") {
      aenderung.status = "verworfen";
      aenderung.ziel = null;
    }
  }

  /** Markiert ein Änderungsobjekt als ausgeführt (die Wirkung selbst liegt beim Office-Adapter). */
  ausgefuehrt(aenderungId: string): void {
    const aenderung = this.aenderungen.get(aenderungId);
    if (!aenderung || aenderung.status !== "offen") {
      throw new BindungsFehler("Nur ein offenes, adressiertes Änderungsobjekt ist ausführbar.");
    }
    aenderung.status = "ausgefuehrt";
  }

  /**
   * Klärt oder korrigiert die Zuordnung einer Rückmeldung. Die bisherige Bindung bleibt in der
   * Historie; neu gebunden werden nur noch nicht ausgeführte, nicht verworfene Änderungsobjekte.
   * Dieselbe Klärung zweimal ist wirkungslos.
   */
  klaeren(rueckmeldungId: string, ziel: Folienziel, nutzerId: string): Rueckmeldung {
    const meldung = this.meldungen.get(rueckmeldungId);
    if (!meldung) {
      throw new BindungsFehler("Unbekannte Rückmeldung.");
    }
    const anker = this.anker(ziel);
    if (!anker) {
      throw new BindungsFehler("Ziel ist keine Folie einer verbundenen Fassung.");
    }
    if (!this.rechte.dokumentLesen(nutzerId, ziel.dateiId)) {
      throw new BindungsFehler("Keine Leseberechtigung für das Dokument.");
    }
    if (anker.versteckt && !this.rechte.versteckteFolienLesen(nutzerId, ziel.dateiId)) {
      throw new BindungsFehler("Keine Leseberechtigung für das Dokument.");
    }
    const alt = meldung.bindung;
    if (
      alt.status === "gebunden" &&
      alt.ziel?.dateiId === ziel.dateiId &&
      alt.ziel.fassung === ziel.fassung &&
      alt.ziel.sldId === ziel.sldId
    ) {
      return meldung;
    }
    meldung.historie.push(alt);
    meldung.bindung = {
      version: alt.version + 1,
      status: "gebunden",
      ziel: { ...ziel },
      praesentiert: { titel: anker.titel, inhaltHash: anker.inhaltHash, position: anker.position },
      grund: null,
      kandidaten: [],
      geklaertVon: nutzerId,
    };
    const aenderung = this.aenderungen.get(`ae-${meldung.id}`);
    if (nochOffen(aenderung)) {
      const neuesZiel = this.aenderungsziel(meldung.bindung);
      aenderung.ziel = neuesZiel;
      aenderung.status = neuesZiel ? "offen" : "wartet_auf_klaerung";
      aenderung.bindungVersion = meldung.bindung.version;
    }
    return meldung;
  }

  /**
   * Das Original hat sich nach dem Meeting geändert. Jede gebundene Rückmeldung wird gegen die
   * neue Fassung abgeglichen; ihre Bindung bleibt an der präsentierten Fassung. Offene
   * Änderungsobjekte an geänderten oder entfernten Folien werden zur Prüfung gestellt, nicht still
   * auf den neuen Inhalt übertragen.
   */
  fassungsabgleich(neu: Foliensatz): FassungsAbgleichEintrag[] {
    this.originale.set(neu.dateiId, neu);
    const ergebnis: FassungsAbgleichEintrag[] = [];
    for (const meldung of this.meldungen.values()) {
      const { ziel, praesentiert } = meldung.bindung;
      if (!ziel || !praesentiert || ziel.dateiId !== neu.dateiId) {
        continue;
      }
      const folie = neu.folien.find((f) => f.sldId === ziel.sldId);
      const stand = !folie
        ? "entfernt"
        : folie.inhaltHash === praesentiert.inhaltHash
          ? "unveraendert"
          : "geaendert";
      ergebnis.push({ rueckmeldungId: meldung.id, sldId: ziel.sldId, stand });
      const aenderung = this.aenderungen.get(`ae-${meldung.id}`);
      if (nochOffen(aenderung)) {
        if (stand === "unveraendert") {
          aenderung.ziel = { dateiId: neu.dateiId, fassung: neu.fassung, sldId: ziel.sldId };
          aenderung.status = "offen";
        } else {
          aenderung.ziel = null;
          aenderung.status = "fassung_pruefen";
        }
      }
    }
    return ergebnis;
  }

  aenderung(rueckmeldungId: string): Aenderungsobjekt | undefined {
    const a = this.aenderungen.get(`ae-${rueckmeldungId}`);
    return a ? { ...a, ziel: a.ziel ? { ...a.ziel } : null } : undefined;
  }

  aenderungenAnzahl(): number {
    return this.aenderungen.size;
  }

  private folieSichtbar(nutzerId: string, ziel: Folienziel): FolienAnker | null {
    const anker = this.anker(ziel);
    if (!anker || !this.rechte.dokumentLesen(nutzerId, ziel.dateiId)) {
      return null;
    }
    if (anker.versteckt && !this.rechte.versteckteFolienLesen(nutzerId, ziel.dateiId)) {
      return null;
    }
    return anker;
  }

  /**
   * Die Sicht eines Nutzers auf eine Rückmeldung. Ohne Meetingrecht gibt es sie nicht (null —
   * auch keine Existenzauskunft). Die Folie erscheint nur mit eigenem Dokumentrecht; versteckte
   * Folien und Sprechernotizen nur mit eigenem Recht darauf.
   */
  sicht(nutzerId: string, rueckmeldungId: string): RueckmeldungsSicht | null {
    const m = this.meldungen.get(rueckmeldungId);
    if (!m || !this.rechte.meetingLesen(nutzerId, m.meetingId)) {
      return null;
    }
    const { ziel } = m.bindung;
    let folie: RueckmeldungsSicht["folie"] = null;
    if (ziel) {
      const anker = this.folieSichtbar(nutzerId, ziel);
      folie = anker
        ? {
            lesbar: true,
            ...ziel,
            titel: m.bindung.praesentiert?.titel ?? anker.titel,
            position: m.bindung.praesentiert?.position ?? anker.position,
            notizen: this.rechte.notizenLesen(nutzerId, ziel.dateiId) ? anker.notizen : null,
          }
        : { lesbar: false };
    }
    const kandidaten = m.bindung.kandidaten.flatMap((k) => {
      const anker = this.folieSichtbar(nutzerId, k);
      return anker ? [{ dateiId: k.dateiId, sldId: k.sldId, titel: anker.titel }] : [];
    });
    return {
      id: m.id,
      art: m.art,
      herkunft: m.herkunft,
      text: m.text,
      stelle: {
        id: m.stelle.id,
        startMs: m.stelle.startMs,
        sprecher: m.stelle.sprecher,
        text: m.stelle.text,
      },
      status: m.bindung.status,
      grund: m.bindung.grund,
      folie,
      kandidaten,
    };
  }

  /** Rückmeldungen zu einer Folie (über ihre stabile Kennung, gleich welche Fassung). */
  ausFolie(nutzerId: string, dateiId: string, sldId: string): RueckmeldungsSicht[] {
    if (!this.rechte.dokumentLesen(nutzerId, dateiId)) {
      return [];
    }
    return [...this.meldungen.values()]
      .filter((m) => m.bindung.ziel?.dateiId === dateiId && m.bindung.ziel.sldId === sldId)
      .flatMap((m) => {
        const s = this.sicht(nutzerId, m.id);
        return s?.folie?.lesbar ? [s] : [];
      });
  }

  /** Rückmeldungen, deren Gesprächsstelle den Zeitpunkt enthält. */
  ausZeitstelle(nutzerId: string, zeitMs: number): RueckmeldungsSicht[] {
    return [...this.meldungen.values()]
      .filter((m) => m.stelle.startMs <= zeitMs && zeitMs <= m.stelle.endMs)
      .flatMap((m) => {
        const s = this.sicht(nutzerId, m.id);
        return s ? [s] : [];
      });
  }

  historie(rueckmeldungId: string): Bindung[] {
    return [...(this.meldungen.get(rueckmeldungId)?.historie ?? [])];
  }
}

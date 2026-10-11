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
// Änderungsdienst. Gespeichert und ausgeliefert wird sie über `meeting-dokumentbezug-ablage.ts`
// und `routes/meeting-dokumentbezug-routes.ts`.
//
// DIE IDENTITÄT EINER FOLIE ist `p:sldId/@id` aus `ppt/presentation.xml` zusammen mit der
// Dateikennung und der Fassung (SHA-256 der Dateibytes). PowerPoint behält diese Kennung beim
// Umsortieren bei; die Position („Folie 3") ist reine Anzeige und wird nie als Identität
// gespeichert. Ein Folienwechsel, der nur eine Nummer meldet, bleibt deshalb in Klärung.
//
// DER FOLIENINHALT (Nacharbeit 2, Bens Befund 2) ist das Folien-XML ZUSAMMEN mit allem, was die
// Folie über ihre Beziehungen einbindet: Bilder, Diagramme samt eingebetteter Daten, SmartArt,
// Medien, Layout, Master und Design — rekursiv, ohne Notizfolie. Verglichen wird über den Inhalt
// der Teile, nicht über ihre Pfade. Ein externer oder fehlender Bestandteil (verknüpftes Bild,
// verknüpfte Diagrammdaten) ist nicht vergleichbar; eine solche Folie wird nie als „gleich"
// eingestuft, sondern zur Prüfung gestellt.
//
// RECHTE (Nacharbeit 2, Bens Befund 3). Jede Auskunft und jede Wirkung fragt die aktuellen Rechte
// des handelnden Nutzers: ohne Meetingrecht gibt es nichts (auch keine Existenzauskunft), ohne
// Dokumentrecht keine Folie, kein Original und kein Änderungsziel; versteckte Folien und
// Sprechernotizen nur mit eigenem Recht. Nach außen gehen nur gefilterte Sichten, nie die
// gespeicherten Objekte.
//
// KOPIE UND ORIGINAL (Nacharbeit 2, Bens Befund 4). Die präsentierte Kopie und das Original
// dürfen verschiedene Dateikennungen tragen. Die Beziehung Kopie → Original wird ausdrücklich
// gespeichert; Änderungsziel und Fassungsabgleich gehen über sie.
//
// WAS DIESE SCHICHT AUSDRÜCKLICH NICHT TUT:
//   · keine Schreibwirkung an der Originaldatei — sie erzeugt Änderungsobjekte mit Ziel, mehr nicht;
//   · keine OCR und keine Modellstufe — ein Bildschirmtext kommt von außen, bleibt unsicher und
//     adressiert nie selbst eine Änderung; bei „Keine KI" wird er gar nicht angenommen.
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
  /** SHA-256 über Folien-XML und alle eingebundenen Bestandteile (ohne Notizfolie). */
  inhaltHash: string;
  /** false, wenn ein eingebundener Bestandteil extern verknüpft ist oder im Paket fehlt. */
  vergleichbar: boolean;
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

interface Beziehung {
  ziel: string;
  typ: string;
  extern: boolean;
}

function beziehungen(rels: string): Map<string, Beziehung> {
  const karte = new Map<string, Beziehung>();
  for (const m of rels.matchAll(/<Relationship\s[^>]*>/g)) {
    const tag = m[0];
    const id = /\sId="([^"]*)"/.exec(tag)?.[1];
    const ziel = /\sTarget="([^"]*)"/.exec(tag)?.[1];
    const typ = /\sType="([^"]*)"/.exec(tag)?.[1];
    if (id && ziel && typ) {
      karte.set(id, { ziel, typ, extern: /\sTargetMode="External"/.test(tag) });
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

function relsPfad(teil: string): string {
  return teil.replace(/([^/]+)$/, "_rels/$1.rels");
}

/** Beziehungen, die nicht zum sichtbaren Inhalt DIESER Folie gehören. */
const NICHT_INHALT = ["/notesSlide", "/slide"];

/**
 * Inhalt einer Folie: ihr XML und — rekursiv über die Beziehungen — jeder eingebundene Teil.
 * Gehasht wird der Inhalt der Teile mit ihrer Beziehungsart, sortiert; Teilpfade zählen nicht
 * (eine Kopie darf `image1.png` als `image3.png` ablegen). Externe Verweise gehen als Zieladresse
 * in den Hash ein; außer bei Hyperlinks machen sie die Folie nicht vergleichbar, ebenso ein im
 * Paket fehlender Teil.
 */
async function folienInhalt(
  zip: JSZip,
  pfad: string,
  xml: string,
): Promise<{ inhaltHash: string; vergleichbar: boolean }> {
  const merkmale: string[] = [];
  let vergleichbar = true;
  const besucht = new Set<string>([pfad]);
  const offen = [pfad];
  while (offen.length > 0) {
    const teil = offen.pop() as string;
    const rels = await zip.file(relsPfad(teil))?.async("string");
    if (!rels) {
      continue;
    }
    for (const rel of beziehungen(rels).values()) {
      const art = rel.typ.slice(rel.typ.lastIndexOf("/"));
      if (NICHT_INHALT.includes(art)) {
        continue;
      }
      if (rel.extern) {
        merkmale.push(`extern${art}:${rel.ziel}`);
        if (art !== "/hyperlink") {
          vergleichbar = false;
        }
        continue;
      }
      const ziel = teilPfad(teil, rel.ziel);
      if (besucht.has(ziel)) {
        continue;
      }
      besucht.add(ziel);
      const bytes = await zip.file(ziel)?.async("uint8array");
      if (!bytes) {
        merkmale.push(`fehlt${art}`);
        vergleichbar = false;
        continue;
      }
      merkmale.push(`${art}:${sha256(bytes)}`);
      offen.push(ziel);
    }
  }
  return {
    inhaltHash: sha256([sha256(xml), ...merkmale.sort()].join("\n")),
    vergleichbar,
  };
}

/**
 * Liest die Folienanker einer echten `.pptx` (OOXML PresentationML). Gelesen werden
 * `ppt/presentation.xml` (Reihenfolge und `p:sldId`), die Beziehungen zu den Folienteilen und
 * allen eingebundenen Bestandteilen, das `show`-Attribut und die verknüpfte Notizfolie. Es wird
 * nichts geschrieben.
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
    const folienRels = await lies(relsPfad(pfad));
    let notizen: string | null = null;
    if (folienRels) {
      for (const rel of beziehungen(folienRels).values()) {
        if (rel.typ.endsWith("/notesSlide") && !rel.extern) {
          const notizXml = await lies(teilPfad(pfad, rel.ziel));
          notizen = notizXml ? notizText(notizXml) || null : null;
        }
      }
    }
    folien.push({
      sldId,
      position: folien.length + 1,
      titel: platzhalterText(xml, ["title", "ctrTitle"]),
      ...(await folienInhalt(zip, pfad, xml)),
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

/** Rechte werden bei JEDEM Zugriff erfragt — es gilt immer der aktuelle Stand. */
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
  praesentiert: {
    titel: string;
    inhaltHash: string;
    vergleichbar: boolean;
    position: number;
  } | null;
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

/** Eine mit dem Meeting verbundene Mitschrift. */
export interface Mitschrift {
  id: string;
  zeitbasis: string;
  stellen: Gespraechsstelle[];
}

/** Der vollständige, speicherbare Zustand eines Meetingbezugs (reines JSON). */
export interface MeetingZustand {
  meeting: MeetingVerbindung;
  saetze: Foliensatz[];
  originale: Foliensatz[];
  /** Kopie-Dateikennung → Original-Dateikennung. */
  originalVon: [string, string][];
  wechsel: Folienwechsel[];
  mitschriften: Mitschrift[];
  meldungen: Rueckmeldung[];
  aenderungen: Aenderungsobjekt[];
}

/** Abgleich präsentierte Kopie ↔ Original, wie ihn der handelnde Nutzer sehen darf. */
export type KopieAbgleich =
  | { status: "ungeklaert"; originalZugriff: false }
  | {
      status: "identisch" | "inhaltsgleich" | "abweichend" | "nicht_vollstaendig_vergleichbar";
      originalZugriff: true;
      originalDateiId: string;
      originalFassung: string;
      abweichendeFolien: string[];
      unvergleichbareFolien: string[];
    };

export interface FassungsAbgleichEintrag {
  rueckmeldungId: string;
  sldId: string;
  stand: "unveraendert" | "geaendert" | "entfernt" | "nicht_vergleichbar";
}

export type FolienSicht =
  | {
      lesbar: true;
      dateiId: string;
      fassung: string;
      sldId: string;
      titel: string;
      position: number;
      notizen: string | null;
    }
  | { lesbar: false };

/** Ein Änderungsobjekt, wie es der handelnde Nutzer sehen darf. */
export interface AenderungsSicht {
  id: string;
  art: Aenderungsobjekt["art"];
  status: Aenderungsobjekt["status"];
  bindungVersion: number;
  /** Nur mit Leserecht am Zieldokument; sonst null und `zielVerborgen`. */
  ziel: Folienziel | null;
  zielVerborgen: boolean;
}

/** Eine (historische) Bindung, wie sie der handelnde Nutzer sehen darf. */
export interface BindungsSicht {
  version: number;
  status: Bindung["status"];
  grund: Klaerungsgrund | null;
  geklaertVon: string | null;
  folie: FolienSicht | null;
  kandidaten: { dateiId: string; sldId: string; titel: string }[];
}

/** Was ein Nutzer von einer Rückmeldung sehen darf — zum Zeitpunkt des Lesens. */
export interface RueckmeldungsSicht extends BindungsSicht {
  id: string;
  art: RueckmeldungsArt;
  herkunft: "gespraech" | "ki";
  text: string;
  stelle: { id: string; startMs: number; endMs: number; sprecher: string | null; text: string };
  aenderung: AenderungsSicht | null;
}

/** `kein_zugriff` wird an der Route zu 404 (keine Existenzauskunft), `ungueltig` zu 400. */
export class BindungsFehler extends Error {
  constructor(
    readonly art: "kein_zugriff" | "ungueltig",
    message: string,
  ) {
    super(message);
  }
}

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

type Vergleich = "gleich" | "anders" | "unvergleichbar";

function vergleiche(
  a: { inhaltHash: string; vergleichbar: boolean },
  b: { inhaltHash: string; vergleichbar: boolean },
): Vergleich {
  if (!a.vergleichbar || !b.vergleichbar) {
    return "unvergleichbar";
  }
  return a.inhaltHash === b.inhaltHash ? "gleich" : "anders";
}

function kopie<T>(wert: T): T {
  return JSON.parse(JSON.stringify(wert)) as T;
}

export class MeetingDokumentbezug {
  private readonly saetze = new Map<string, Foliensatz>();
  private readonly originale = new Map<string, Foliensatz>();
  private readonly originalVon = new Map<string, string>();
  private readonly wechsel: Folienwechsel[] = [];
  private readonly mitschriften = new Map<string, Mitschrift>();
  private readonly meldungen = new Map<string, Rueckmeldung>();
  private readonly aenderungen = new Map<string, Aenderungsobjekt>();

  constructor(
    readonly meeting: MeetingVerbindung,
    private readonly rechte: Rechtepruefung,
  ) {}

  /** Baut den Bezug aus einem gespeicherten Zustand — mit den Rechten des aktuellen Zugriffs. */
  static ausZustand(zustand: MeetingZustand, rechte: Rechtepruefung): MeetingDokumentbezug {
    const z = kopie(zustand);
    const bezug = new MeetingDokumentbezug(z.meeting, rechte);
    for (const satz of z.saetze) {
      bezug.saetze.set(bezug.schluessel(satz.dateiId, satz.fassung), satz);
    }
    for (const satz of z.originale) {
      bezug.originale.set(satz.dateiId, satz);
    }
    for (const [von, nach] of z.originalVon) {
      bezug.originalVon.set(von, nach);
    }
    bezug.wechsel.push(...z.wechsel);
    for (const m of z.mitschriften) {
      bezug.mitschriften.set(m.id, m);
    }
    for (const m of z.meldungen) {
      bezug.meldungen.set(m.id, m);
    }
    for (const a of z.aenderungen) {
      bezug.aenderungen.set(a.id, a);
    }
    return bezug;
  }

  /** Der speicherbare Zustand — eine tiefe Kopie, kein Verweis auf den Innenstand. */
  zustand(): MeetingZustand {
    return kopie({
      meeting: this.meeting,
      saetze: [...this.saetze.values()],
      originale: [...this.originale.values()],
      originalVon: [...this.originalVon.entries()],
      wechsel: this.wechsel,
      mitschriften: [...this.mitschriften.values()],
      meldungen: [...this.meldungen.values()],
      aenderungen: [...this.aenderungen.values()],
    });
  }

  /** Alle Dateikennungen, über die dieser Bezug etwas weiß (für die Rechteerhebung am Zugriff). */
  dateiKennungen(): string[] {
    return [
      ...new Set([
        ...[...this.saetze.values()].map((s) => s.dateiId),
        ...this.originale.keys(),
        ...this.originalVon.values(),
      ]),
    ];
  }

  private schluessel(dateiId: string, fassung: string): string {
    return `${dateiId}@${fassung}`;
  }

  private meetingRecht(nutzerId: string): void {
    if (!this.rechte.meetingLesen(nutzerId, this.meeting.meetingId)) {
      throw new BindungsFehler("kein_zugriff", "Meeting nicht gefunden.");
    }
  }

  private dokumentRecht(nutzerId: string, dateiId: string): void {
    if (!this.rechte.dokumentLesen(nutzerId, dateiId)) {
      throw new BindungsFehler("kein_zugriff", "Dokument nicht gefunden.");
    }
  }

  private originalKennung(dateiId: string): string {
    return this.originalVon.get(dateiId) ?? dateiId;
  }

  /**
   * Verbindet die tatsächlich präsentierte Fassung. `original` ist die berechtigt zugängliche
   * Originalfassung — gleiche oder eigene Dateikennung — oder null, wenn sie nicht zugänglich ist.
   */
  verbinden(
    nutzerId: string,
    praesentiert: Foliensatz,
    original: Foliensatz | null = null,
  ): KopieAbgleich {
    this.meetingRecht(nutzerId);
    this.dokumentRecht(nutzerId, praesentiert.dateiId);
    if (original) {
      this.dokumentRecht(nutzerId, original.dateiId);
    }
    const bekannt = this.originalVon.get(praesentiert.dateiId);
    if (original && bekannt !== undefined && bekannt !== original.dateiId) {
      throw new BindungsFehler(
        "ungueltig",
        "Diese Kopie ist bereits einem anderen Original zugeordnet.",
      );
    }
    const schluessel = this.schluessel(praesentiert.dateiId, praesentiert.fassung);
    this.saetze.set(schluessel, kopie(praesentiert));
    if (original) {
      this.originalVon.set(praesentiert.dateiId, original.dateiId);
      this.originale.set(original.dateiId, kopie(original));
    }
    return this.kopieAbgleich(nutzerId, praesentiert.dateiId, praesentiert.fassung);
  }

  /**
   * Gleicht eine präsentierte Fassung mit dem zugänglichen Original ab, ohne etwas zu behaupten.
   * Ohne Leserecht am Original lautet die Antwort für diesen Nutzer „ungeklärt".
   */
  kopieAbgleich(nutzerId: string, dateiId: string, fassung: string): KopieAbgleich {
    this.meetingRecht(nutzerId);
    this.dokumentRecht(nutzerId, dateiId);
    const kopieSatz = this.saetze.get(this.schluessel(dateiId, fassung));
    if (!kopieSatz) {
      throw new BindungsFehler("kein_zugriff", "Fassung ist mit dem Meeting nicht verbunden.");
    }
    const original = this.originale.get(this.originalKennung(dateiId));
    if (!original || !this.rechte.dokumentLesen(nutzerId, original.dateiId)) {
      return { status: "ungeklaert", originalZugriff: false };
    }
    const sichtbar = kopieSatz.folien.filter(
      (f) => !f.versteckt || this.rechte.versteckteFolienLesen(nutzerId, dateiId),
    );
    const basis = {
      originalZugriff: true as const,
      originalDateiId: original.dateiId,
      originalFassung: original.fassung,
    };
    if (original.fassung === kopieSatz.fassung) {
      return { status: "identisch", ...basis, abweichendeFolien: [], unvergleichbareFolien: [] };
    }
    const abweichend: string[] = [];
    const unvergleichbar: string[] = [];
    for (const f of sichtbar) {
      const o = original.folien.find((x) => x.sldId === f.sldId);
      const v = o ? vergleiche(f, o) : "anders";
      if (v === "anders") {
        abweichend.push(f.sldId);
      } else if (v === "unvergleichbar") {
        unvergleichbar.push(f.sldId);
      }
    }
    const status =
      abweichend.length > 0
        ? "abweichend"
        : unvergleichbar.length > 0
          ? "nicht_vollstaendig_vergleichbar"
          : "inhaltsgleich";
    return {
      status,
      ...basis,
      abweichendeFolien: abweichend,
      unvergleichbareFolien: unvergleichbar,
    };
  }

  /** Verbindet eine Mitschrift. Dieselbe Kennung mit demselben Inhalt ist wirkungslos. */
  mitschriftVerbinden(nutzerId: string, mitschrift: Mitschrift): void {
    this.meetingRecht(nutzerId);
    const vorhanden = this.mitschriften.get(mitschrift.id);
    if (vorhanden && JSON.stringify(vorhanden) !== JSON.stringify(mitschrift)) {
      throw new BindungsFehler("ungueltig", "Diese Mitschrift ist bereits anders verbunden.");
    }
    this.mitschriften.set(mitschrift.id, kopie(mitschrift));
  }

  folienwechsel(nutzerId: string, ereignis: Folienwechsel): void {
    this.meetingRecht(nutzerId);
    if (ereignis.quelle === "ocr" && !this.meeting.ocrErlaubt) {
      throw new BindungsFehler(
        "ungueltig",
        "Bildschirmtext ist für dieses Meeting nicht zugelassen (Keine KI).",
      );
    }
    if (ereignis.quelle === "host") {
      this.dokumentRecht(nutzerId, ereignis.dateiId);
      const satz = this.saetze.get(this.schluessel(ereignis.dateiId, ereignis.fassung));
      if (!satz?.folien.some((f) => f.sldId === ereignis.sldId)) {
        throw new BindungsFehler(
          "ungueltig",
          "Folienwechsel auf eine nicht verbundene Fassung oder Folie.",
        );
      }
    }
    this.wechsel.push(kopie(ereignis));
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

  private abbild(anker: FolienAnker): NonNullable<Bindung["praesentiert"]> {
    return {
      titel: anker.titel,
      inhaltHash: anker.inhaltHash,
      vergleichbar: anker.vergleichbar,
      position: anker.position,
    };
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
      praesentiert: anker ? this.abbild(anker) : null,
      grund: null,
      kandidaten: [],
      geklaertVon: null,
    };
  }

  /**
   * Das Änderungsziel einer Bindung: die Originalfolie (über die gespeicherte Beziehung
   * Kopie → Original), wenn die präsentierte Folie dort nachweislich gleich ist — dieselbe
   * Fassung oder vollständig vergleichbarer, gleicher Inhalt. Sonst null: keine automatische
   * Adressierung.
   */
  private aenderungsziel(bindung: Bindung): Folienziel | null {
    if (bindung.status !== "gebunden" || !bindung.ziel || !bindung.praesentiert) {
      return null;
    }
    const { sldId, dateiId, fassung } = bindung.ziel;
    const original = this.originale.get(this.originalKennung(dateiId));
    const folie = original?.folien.find((f) => f.sldId === sldId);
    if (!original || !folie) {
      return null;
    }
    const gleich =
      original.fassung === fassung || vergleiche(bindung.praesentiert, folie) === "gleich";
    return gleich ? { dateiId: original.dateiId, fassung: original.fassung, sldId } : null;
  }

  private stelleAus(mitschriftId: string, stelleId: string): Mitschrift["stellen"][number] {
    const stelle = this.mitschriften.get(mitschriftId)?.stellen.find((s) => s.id === stelleId);
    if (!stelle) {
      throw new BindungsFehler("ungueltig", "Unbekannte Gesprächsstelle.");
    }
    return stelle;
  }

  /**
   * Nimmt eine ausdrücklich geäußerte Rückmeldung zu einer Stelle einer verbundenen Mitschrift
   * auf. Idempotent: dieselbe Stelle mit derselben Art und demselben Text ergibt dieselbe
   * Rückmeldung, kein zweites Objekt.
   */
  rueckmeldung(
    nutzerId: string,
    eingabe: {
      mitschriftId: string;
      stelleId: string;
      art: RueckmeldungsArt;
      text: string;
    },
  ): RueckmeldungsSicht {
    this.meetingRecht(nutzerId);
    const mitschrift = this.mitschriften.get(eingabe.mitschriftId);
    const stelle = this.stelleAus(eingabe.mitschriftId, eingabe.stelleId);
    const merkmal = [
      this.meeting.meetingId,
      eingabe.mitschriftId,
      stelle.id,
      eingabe.art,
      normal(eingabe.text),
    ];
    const id = `rm-${sha256(merkmal.join("\u0000")).slice(0, 16)}`;
    if (!this.meldungen.has(id)) {
      const meldung: Rueckmeldung = {
        id,
        meetingId: this.meeting.meetingId,
        stelle: kopie(stelle),
        art: eingabe.art,
        herkunft: eingabe.art === "ki_empfehlung" ? "ki" : "gespraech",
        text: eingabe.text,
        bindung: this.binden(stelle, mitschrift?.zeitbasis ?? "", 1),
        historie: [],
      };
      this.meldungen.set(id, meldung);
      this.aenderungAnlegen(meldung);
    }
    return this.sicht(nutzerId, id) as RueckmeldungsSicht;
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

  private meldung(nutzerId: string, rueckmeldungId: string): Rueckmeldung {
    this.meetingRecht(nutzerId);
    const meldung = this.meldungen.get(rueckmeldungId);
    if (!meldung) {
      throw new BindungsFehler("kein_zugriff", "Rückmeldung nicht gefunden.");
    }
    return meldung;
  }

  /** Ein bisher offener Vorschlag wird verworfen; er bleibt als verworfener Vorschlag sichtbar. */
  verwerfen(nutzerId: string, rueckmeldungId: string): RueckmeldungsSicht {
    const meldung = this.meldung(nutzerId, rueckmeldungId);
    if (meldung.art !== "vorschlag") {
      throw new BindungsFehler("ungueltig", "Nur ein Vorschlag kann verworfen werden.");
    }
    meldung.art = "verworfener_vorschlag";
    const aenderung = this.aenderungen.get(`ae-${meldung.id}`);
    if (aenderung && aenderung.status !== "ausgefuehrt") {
      aenderung.status = "verworfen";
      aenderung.ziel = null;
    }
    return this.sicht(nutzerId, rueckmeldungId) as RueckmeldungsSicht;
  }

  /**
   * Markiert ein Änderungsobjekt als ausgeführt. Die Wirkung selbst liegt beim Office-Adapter
   * (BPA-17); hier wird nur der Stand geführt — mit Meeting- und Dokumentrecht des Handelnden.
   */
  ausgefuehrt(nutzerId: string, aenderungId: string): void {
    this.meetingRecht(nutzerId);
    const aenderung = this.aenderungen.get(aenderungId);
    if (!aenderung || aenderung.status !== "offen" || !aenderung.ziel) {
      throw new BindungsFehler("ungueltig", "Nur ein offenes Objekt mit Ziel ist ausführbar.");
    }
    this.dokumentRecht(nutzerId, aenderung.ziel.dateiId);
    aenderung.status = "ausgefuehrt";
  }

  /**
   * Klärt oder korrigiert die Zuordnung einer Rückmeldung — nur mit Meetingrecht UND Leserecht am
   * Zieldokument (bei versteckter Folie auch dafür). Die bisherige Bindung bleibt in der Historie;
   * neu gebunden werden nur noch nicht ausgeführte, nicht verworfene Änderungsobjekte. Dieselbe
   * Klärung zweimal ist wirkungslos. Zurück kommt die gefilterte Sicht des Handelnden.
   */
  klaeren(nutzerId: string, rueckmeldungId: string, ziel: Folienziel): RueckmeldungsSicht {
    const meldung = this.meldung(nutzerId, rueckmeldungId);
    const anker = this.anker(ziel);
    if (!anker) {
      throw new BindungsFehler("ungueltig", "Ziel ist keine Folie einer verbundenen Fassung.");
    }
    this.dokumentRecht(nutzerId, ziel.dateiId);
    if (anker.versteckt && !this.rechte.versteckteFolienLesen(nutzerId, ziel.dateiId)) {
      throw new BindungsFehler("kein_zugriff", "Dokument nicht gefunden.");
    }
    const alt = meldung.bindung;
    const gleich =
      alt.status === "gebunden" &&
      alt.ziel?.dateiId === ziel.dateiId &&
      alt.ziel.fassung === ziel.fassung &&
      alt.ziel.sldId === ziel.sldId;
    if (!gleich) {
      meldung.historie.push(alt);
      meldung.bindung = {
        version: alt.version + 1,
        status: "gebunden",
        ziel: { dateiId: ziel.dateiId, fassung: ziel.fassung, sldId: ziel.sldId },
        praesentiert: this.abbild(anker),
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
    }
    return this.sicht(nutzerId, rueckmeldungId) as RueckmeldungsSicht;
  }

  /**
   * Das Original hat sich nach dem Meeting geändert. Betroffen sind alle Bindungen an diese Datei
   * UND an jede präsentierte Kopie, deren gespeichertes Original sie ist. Die Bindung bleibt an
   * der präsentierten Fassung. Offene Änderungsobjekte an geänderten, entfernten oder nicht
   * vergleichbaren Folien werden zur Prüfung gestellt, nicht still auf den neuen Inhalt übertragen.
   */
  fassungsabgleich(nutzerId: string, neu: Foliensatz): FassungsAbgleichEintrag[] {
    this.meetingRecht(nutzerId);
    this.dokumentRecht(nutzerId, neu.dateiId);
    const bekannt =
      this.originale.has(neu.dateiId) ||
      [...this.saetze.values()].some((s) => s.dateiId === neu.dateiId);
    if (!bekannt) {
      throw new BindungsFehler("ungueltig", "Diese Datei ist mit dem Meeting nicht verbunden.");
    }
    this.originale.set(neu.dateiId, kopie(neu));
    const ergebnis: FassungsAbgleichEintrag[] = [];
    for (const meldung of this.meldungen.values()) {
      const { ziel, praesentiert } = meldung.bindung;
      if (!ziel || !praesentiert || this.originalKennung(ziel.dateiId) !== neu.dateiId) {
        continue;
      }
      const folie = neu.folien.find((f) => f.sldId === ziel.sldId);
      let stand: FassungsAbgleichEintrag["stand"];
      if (!folie) {
        stand = "entfernt";
      } else if (neu.fassung === ziel.fassung) {
        stand = "unveraendert";
      } else {
        const v = vergleiche(praesentiert, folie);
        stand =
          v === "gleich" ? "unveraendert" : v === "anders" ? "geaendert" : "nicht_vergleichbar";
      }
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

  /** Anzahl der Änderungsobjekte (ohne Inhalt) — für Dublettenprüfungen. */
  aenderungenAnzahl(): number {
    return this.aenderungen.size;
  }

  private folieSichtbar(nutzerId: string, ziel: Folienziel): FolienAnker | null {
    const anker = this.anker(ziel) ?? this.originalAnker(ziel);
    if (!anker || !this.rechte.dokumentLesen(nutzerId, ziel.dateiId)) {
      return null;
    }
    if (anker.versteckt && !this.rechte.versteckteFolienLesen(nutzerId, ziel.dateiId)) {
      return null;
    }
    return anker;
  }

  private originalAnker(ziel: Folienziel): FolienAnker | undefined {
    const original = this.originale.get(ziel.dateiId);
    return original?.fassung === ziel.fassung
      ? original.folien.find((f) => f.sldId === ziel.sldId)
      : undefined;
  }

  private aenderungSicht(nutzerId: string, rueckmeldungId: string): AenderungsSicht | null {
    const a = this.aenderungen.get(`ae-${rueckmeldungId}`);
    if (!a) {
      return null;
    }
    const zielLesbar = a.ziel !== null && this.folieSichtbar(nutzerId, a.ziel) !== null;
    return {
      id: a.id,
      art: a.art,
      status: a.status,
      bindungVersion: a.bindungVersion,
      ziel: zielLesbar && a.ziel ? { ...a.ziel } : null,
      zielVerborgen: a.ziel !== null && !zielLesbar,
    };
  }

  private bindungSicht(nutzerId: string, b: Bindung): BindungsSicht {
    let folie: FolienSicht | null = null;
    if (b.ziel) {
      const anker = this.folieSichtbar(nutzerId, b.ziel);
      folie = anker
        ? {
            lesbar: true,
            ...b.ziel,
            titel: b.praesentiert?.titel ?? anker.titel,
            position: b.praesentiert?.position ?? anker.position,
            notizen: this.rechte.notizenLesen(nutzerId, b.ziel.dateiId) ? anker.notizen : null,
          }
        : { lesbar: false };
    }
    const kandidaten = b.kandidaten.flatMap((k) => {
      const anker = this.folieSichtbar(nutzerId, k);
      return anker ? [{ dateiId: k.dateiId, sldId: k.sldId, titel: anker.titel }] : [];
    });
    return {
      version: b.version,
      status: b.status,
      grund: b.grund,
      geklaertVon: b.geklaertVon,
      folie,
      kandidaten,
    };
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
    return {
      id: m.id,
      art: m.art,
      herkunft: m.herkunft,
      text: m.text,
      stelle: {
        id: m.stelle.id,
        startMs: m.stelle.startMs,
        endMs: m.stelle.endMs,
        sprecher: m.stelle.sprecher,
        text: m.stelle.text,
      },
      ...this.bindungSicht(nutzerId, m.bindung),
      aenderung: this.aenderungSicht(nutzerId, m.id),
    };
  }

  /** Das Änderungsobjekt einer Rückmeldung, wie der Nutzer es sehen darf. */
  aenderung(nutzerId: string, rueckmeldungId: string): AenderungsSicht | null {
    if (!this.rechte.meetingLesen(nutzerId, this.meeting.meetingId)) {
      return null;
    }
    return this.aenderungSicht(nutzerId, rueckmeldungId);
  }

  /** Frühere Bindungen einer Rückmeldung — nur mit Meetingrecht, Folien nur mit Dokumentrecht. */
  historie(nutzerId: string, rueckmeldungId: string): BindungsSicht[] {
    if (!this.rechte.meetingLesen(nutzerId, this.meeting.meetingId)) {
      return [];
    }
    return (this.meldungen.get(rueckmeldungId)?.historie ?? []).map((b) =>
      this.bindungSicht(nutzerId, b),
    );
  }

  /** Alle Rückmeldungen dieses Meetings in der Sicht des Nutzers. */
  alle(nutzerId: string): RueckmeldungsSicht[] {
    return [...this.meldungen.keys()].flatMap((id) => {
      const s = this.sicht(nutzerId, id);
      return s ? [s] : [];
    });
  }

  /**
   * Rückmeldungen zu einer Folie (über ihre stabile Kennung, gleich welche Fassung) — angefragt
   * über die präsentierte Datei oder ihr Original.
   */
  ausFolie(nutzerId: string, dateiId: string, sldId: string): RueckmeldungsSicht[] {
    if (!this.rechte.dokumentLesen(nutzerId, dateiId)) {
      return [];
    }
    return [...this.meldungen.values()]
      .filter(
        (m) =>
          m.bindung.ziel?.sldId === sldId &&
          (m.bindung.ziel.dateiId === dateiId ||
            this.originalKennung(m.bindung.ziel.dateiId) === dateiId),
      )
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

  /**
   * Die verbundenen Präsentationen in der Sicht des Nutzers: ohne Dokumentrecht keine; versteckte
   * Folien nur mit Recht darauf; Notizen nie (die stehen an der einzelnen Rückmeldung).
   */
  praesentationen(nutzerId: string): {
    dateiId: string;
    fassung: string;
    abgleich: KopieAbgleich;
    folien: { sldId: string; position: number; titel: string; versteckt: boolean }[];
  }[] {
    this.meetingRecht(nutzerId);
    return [...this.saetze.values()]
      .filter((s) => this.rechte.dokumentLesen(nutzerId, s.dateiId))
      .map((s) => ({
        dateiId: s.dateiId,
        fassung: s.fassung,
        abgleich: this.kopieAbgleich(nutzerId, s.dateiId, s.fassung),
        folien: s.folien
          .filter((f) => !f.versteckt || this.rechte.versteckteFolienLesen(nutzerId, s.dateiId))
          .map((f) => ({
            sldId: f.sldId,
            position: f.position,
            titel: f.titel,
            versteckt: f.versteckt,
          })),
      }));
  }

  /** Die verbundenen Mitschriften (Kennung, Zeitbasis, Stellen) — nur mit Meetingrecht. */
  mitschriftenSicht(nutzerId: string): Mitschrift[] {
    this.meetingRecht(nutzerId);
    return kopie([...this.mitschriften.values()]);
  }
}

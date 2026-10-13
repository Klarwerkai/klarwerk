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
  /** Logische Identität der Datei (bei einer neuen Originalfassung: die des Originals). */
  dateiId: string;
  /**
   * Das tatsächliche Quellobjekt DIESER Fassung (Nacharbeit 4, Bens Befund 2). Öffnen und
   * Rechteprüfung gehen immer hierüber — nie über die logische Kennung einer anderen Fassung.
   */
  quelleId: string;
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
 * Inhalt eines Teils als Baum (Nacharbeit 4, Bens Befund 3): der Hash eines Teils umfasst seine
 * Bytes UND je Beziehung die Zuordnung Relationship-ID → Beziehungsart → Inhaltshash des Ziels,
 * rekursiv. Das referenzierende Element nennt im XML die Relationship-ID (`r:embed="rId2"`); damit
 * ist die ganze Kette Element → ID → Zielinhalt gebunden. Vertauschte Bildziele ändern den Hash,
 * obwohl Folien-XML und die Menge der Bildinhalte gleich bleiben. Teilpfade zählen nicht (eine
 * Kopie darf `image1.png` als `image3.png` ablegen). Externe Verweise gehen als Zieladresse ein;
 * außer bei Hyperlinks machen sie den Teil nicht vergleichbar, ebenso ein fehlender Teil. Ein
 * Rückverweis auf einen Teil, der gerade berechnet wird (Layout ↔ Master), steht als Zyklusmarke.
 */
async function teilInhalt(
  zip: JSZip,
  pfad: string,
  bytes: Uint8Array | string,
  stapel: Set<string>,
): Promise<{ inhaltHash: string; vergleichbar: boolean }> {
  let vergleichbar = true;
  const zeilen: string[] = [];
  const rels = await zip.file(relsPfad(pfad))?.async("string");
  const liste = rels ? [...beziehungen(rels).entries()] : [];
  liste.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  stapel.add(pfad);
  for (const [rId, rel] of liste) {
    const art = rel.typ.slice(rel.typ.lastIndexOf("/"));
    if (NICHT_INHALT.includes(art)) {
      continue;
    }
    if (rel.extern) {
      zeilen.push(`${rId}|${art}|extern:${rel.ziel}`);
      if (art !== "/hyperlink") {
        vergleichbar = false;
      }
      continue;
    }
    const ziel = teilPfad(pfad, rel.ziel);
    if (stapel.has(ziel)) {
      zeilen.push(`${rId}|${art}|zyklus`);
      continue;
    }
    const zielBytes = await zip.file(ziel)?.async("uint8array");
    if (!zielBytes) {
      zeilen.push(`${rId}|${art}|fehlt`);
      vergleichbar = false;
      continue;
    }
    const unter = await teilInhalt(zip, ziel, zielBytes, stapel);
    vergleichbar = vergleichbar && unter.vergleichbar;
    zeilen.push(`${rId}|${art}|${unter.inhaltHash}`);
  }
  stapel.delete(pfad);
  return { inhaltHash: sha256([sha256(bytes), ...zeilen].join("\n")), vergleichbar };
}

/** Inhalt einer Folie: ihr XML und — rekursiv über die Beziehungen — jeder eingebundene Teil. */
function folienInhalt(
  zip: JSZip,
  pfad: string,
  xml: string,
): Promise<{ inhaltHash: string; vergleichbar: boolean }> {
  return teilInhalt(zip, pfad, xml, new Set<string>());
}

/**
 * Liest die Folienanker einer echten `.pptx` (OOXML PresentationML). Gelesen werden
 * `ppt/presentation.xml` (Reihenfolge und `p:sldId`), die Beziehungen zu den Folienteilen und
 * allen eingebundenen Bestandteilen, das `show`-Attribut und die verknüpfte Notizfolie. Es wird
 * nichts geschrieben. `quelleId` ist das Objekt, aus dem die Bytes stammen; ohne Angabe ist es
 * die Datei selbst.
 */
export async function foliensatzLesen(
  dateiId: string,
  bytes: Uint8Array,
  quelleId: string = dateiId,
): Promise<Foliensatz> {
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
  return { dateiId, quelleId, fassung: sha256(bytes), folien };
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
  /**
   * Die Mitschrift (Objektkennung), aus der die Stelle stammt — dauerhaft gebunden (Nacharbeit 4,
   * Bens Befund 1). Ohne aktuelles Leserecht an ihr ist die Rückmeldung samt kopierter Stelle
   * und aller Ableitungen gesperrt.
   */
  mitschriftId: string;
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
  /** Die jeweils aktuelle Fassung je Original (logische Kennung). */
  originale: Foliensatz[];
  /** Jede je bekannte Originalfassung mit ihrem Quellobjekt — auch die abgelösten. */
  fassungen: Foliensatz[];
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
      /** Das Objekt, das diese Originalfassung tatsächlich trägt — dorthin führt das Öffnen. */
      originalQuelleId: string;
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
      /** Das Objekt dieser Fassung — dorthin führt das Öffnen. */
      quelleId: string;
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
  /** Das Quellobjekt der Zielfassung (nur mit Leserecht daran). */
  zielQuelleId: string | null;
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
  private readonly fassungen = new Map<string, Foliensatz>();
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
    // Stände ohne Quellobjekt (vor Nacharbeit 4) tragen die Datei selbst als Quelle; Rückmeldungen
    // ohne Mitschriftkennung bleiben gesperrt (leere Kennung — kein Leserecht, fail-closed).
    const mitQuelle = (s: Foliensatz): Foliensatz => ({ ...s, quelleId: s.quelleId ?? s.dateiId });
    for (const satz of z.saetze.map(mitQuelle)) {
      bezug.saetze.set(bezug.schluessel(satz.dateiId, satz.fassung), satz);
    }
    for (const satz of z.originale.map(mitQuelle)) {
      bezug.originale.set(satz.dateiId, satz);
      bezug.fassungen.set(bezug.schluessel(satz.dateiId, satz.fassung), satz);
    }
    for (const satz of (z.fassungen ?? []).map(mitQuelle)) {
      bezug.fassungen.set(bezug.schluessel(satz.dateiId, satz.fassung), satz);
    }
    for (const [von, nach] of z.originalVon) {
      bezug.originalVon.set(von, nach);
    }
    bezug.wechsel.push(...z.wechsel);
    for (const m of z.mitschriften) {
      bezug.mitschriften.set(m.id, m);
    }
    for (const m of z.meldungen) {
      bezug.meldungen.set(m.id, { ...m, mitschriftId: m.mitschriftId ?? "" });
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
      fassungen: [...this.fassungen.values()],
      originalVon: [...this.originalVon.entries()],
      wechsel: this.wechsel,
      mitschriften: [...this.mitschriften.values()],
      meldungen: [...this.meldungen.values()],
      aenderungen: [...this.aenderungen.values()],
    });
  }

  /**
   * Alle Objektkennungen, an denen dieser Bezug Rechte braucht (für die Rechteerhebung am Zugriff):
   * Quellobjekte jeder Fassung, logische Dateikennungen und — Befund 1 — jede Mitschrift.
   */
  dateiKennungen(): string[] {
    const saetze = [...this.saetze.values(), ...this.fassungen.values()];
    return [
      ...new Set([
        ...saetze.flatMap((s) => [s.dateiId, s.quelleId]),
        ...this.originale.keys(),
        ...this.originalVon.values(),
        ...this.mitschriften.keys(),
      ]),
    ];
  }

  private schluessel(dateiId: string, fassung: string): string {
    return `${dateiId}@${fassung}`;
  }

  /** Eine bekannte Fassung — präsentiert oder Original, aktuell oder abgelöst. */
  private satzVon(dateiId: string, fassung: string): Foliensatz | undefined {
    const schluessel = this.schluessel(dateiId, fassung);
    return this.saetze.get(schluessel) ?? this.fassungen.get(schluessel);
  }

  /** Das Quellobjekt einer bestimmten Fassung — Rechte und Öffnen hängen daran. */
  private quelleVon(dateiId: string, fassung: string): string {
    return this.satzVon(dateiId, fassung)?.quelleId ?? dateiId;
  }

  /** Das Quellobjekt der aktuellen Fassung einer logischen Datei. */
  private aktuelleQuelle(dateiId: string): string {
    const original = this.originale.get(dateiId);
    if (original) {
      return original.quelleId;
    }
    return [...this.saetze.values()].find((s) => s.dateiId === dateiId)?.quelleId ?? dateiId;
  }

  /** Befund 1: die Mitschrift ist Quelle jeder Rückmeldung — ohne Leserecht an ihr nichts. */
  private mitschriftLesbar(nutzerId: string, mitschriftId: string): boolean {
    return mitschriftId !== "" && this.rechte.dokumentLesen(nutzerId, mitschriftId);
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
   *
   * Nacharbeit 5 (Bens Befund 1) — WIEDERIMPORT IST IDEMPOTENT. Ist für das Original schon ein
   * Stand geführt, setzt ein erneutes Verbinden ihn nie zurück:
   *   · dieselbe Fassung wie aktuell, oder eine bereits bekannte (abgelöste) Fassung → der
   *     abgeglichene Stand bleibt, offene Vorschläge bleiben an ihm;
   *   · eine noch unbekannte Fassung → ein echter Fassungswechsel; er läuft über DENSELBEN
   *     Abgleich wie `fassungsabgleich`, samt Neubindung oder Prüfstellung offener Vorschläge.
   */
  verbinden(
    nutzerId: string,
    praesentiert: Foliensatz,
    original: Foliensatz | null = null,
  ): KopieAbgleich {
    this.meetingRecht(nutzerId);
    this.dokumentRecht(nutzerId, praesentiert.quelleId);
    if (original) {
      this.dokumentRecht(nutzerId, original.quelleId);
    }
    const bekannt = this.originalVon.get(praesentiert.dateiId);
    if (original && bekannt !== undefined && bekannt !== original.dateiId) {
      throw new BindungsFehler(
        "ungueltig",
        "Diese Kopie ist bereits einem anderen Original zugeordnet.",
      );
    }
    const aktuell = original ? this.originale.get(original.dateiId) : undefined;
    const wechsel =
      original !== null &&
      aktuell !== undefined &&
      !this.fassungen.has(this.schluessel(original.dateiId, original.fassung));
    if (wechsel && aktuell) {
      // Ein Fassungswechsel verlangt — wie `fassungsabgleich` — Recht am aktuellen Quellobjekt.
      this.dokumentRecht(nutzerId, aktuell.quelleId);
    }
    const schluessel = this.schluessel(praesentiert.dateiId, praesentiert.fassung);
    this.saetze.set(schluessel, kopie(praesentiert));
    if (original) {
      this.originalVon.set(praesentiert.dateiId, original.dateiId);
      if (!aktuell) {
        this.originale.set(original.dateiId, kopie(original));
        this.fassungen.set(this.schluessel(original.dateiId, original.fassung), kopie(original));
      } else if (wechsel) {
        this.abgleichAnwenden(nutzerId, original);
      }
    }
    return this.kopieAbgleich(nutzerId, praesentiert.dateiId, praesentiert.fassung);
  }

  /**
   * Gleicht eine präsentierte Fassung mit dem zugänglichen Original ab, ohne etwas zu behaupten.
   * Ohne Leserecht am Original lautet die Antwort für diesen Nutzer „ungeklärt".
   */
  kopieAbgleich(nutzerId: string, dateiId: string, fassung: string): KopieAbgleich {
    this.meetingRecht(nutzerId);
    const kopieSatz = this.saetze.get(this.schluessel(dateiId, fassung));
    if (!kopieSatz) {
      throw new BindungsFehler("kein_zugriff", "Fassung ist mit dem Meeting nicht verbunden.");
    }
    this.dokumentRecht(nutzerId, kopieSatz.quelleId);
    const original = this.originale.get(this.originalKennung(dateiId));
    if (!original || !this.rechte.dokumentLesen(nutzerId, original.quelleId)) {
      return { status: "ungeklaert", originalZugriff: false };
    }
    const sichtbar = kopieSatz.folien.filter(
      (f) => !f.versteckt || this.rechte.versteckteFolienLesen(nutzerId, kopieSatz.quelleId),
    );
    const basis = {
      originalZugriff: true as const,
      originalDateiId: original.dateiId,
      originalFassung: original.fassung,
      originalQuelleId: original.quelleId,
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

  /**
   * Verbindet eine Mitschrift (Kennung = Objektkennung ihrer Datei) — nur mit Leserecht an ihr.
   * Dieselbe Kennung mit demselben Inhalt ist wirkungslos.
   */
  mitschriftVerbinden(nutzerId: string, mitschrift: Mitschrift): void {
    this.meetingRecht(nutzerId);
    this.dokumentRecht(nutzerId, mitschrift.id);
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
      const satz = this.saetze.get(this.schluessel(ereignis.dateiId, ereignis.fassung));
      this.dokumentRecht(nutzerId, satz?.quelleId ?? ereignis.dateiId);
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
    this.dokumentRecht(nutzerId, eingabe.mitschriftId);
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
        mitschriftId: eingabe.mitschriftId,
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
    if (!meldung || !this.mitschriftLesbar(nutzerId, meldung.mitschriftId)) {
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
    this.meldung(nutzerId, aenderung.rueckmeldungId);
    this.dokumentRecht(nutzerId, this.quelleVon(aenderung.ziel.dateiId, aenderung.ziel.fassung));
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
    const quelle = this.quelleVon(ziel.dateiId, ziel.fassung);
    this.dokumentRecht(nutzerId, quelle);
    if (anker.versteckt && !this.rechte.versteckteFolienLesen(nutzerId, quelle)) {
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
   *
   * Befund 2: `neu.dateiId` ist die logische Identität (das Original), `neu.quelleId` das Objekt,
   * das die neue Fassung tatsächlich trägt. Verlangt wird Leserecht an BEIDEN; gespeichert wird die
   * Fassung mit ihrem Quellobjekt — Öffnen und spätere Rechteprüfung gehen dorthin. Die
   * Rückgabe nennt nur Rückmeldungen, deren Mitschrift der Handelnde lesen darf.
   */
  fassungsabgleich(nutzerId: string, neu: Foliensatz): FassungsAbgleichEintrag[] {
    this.meetingRecht(nutzerId);
    const bekannt =
      this.originale.has(neu.dateiId) ||
      [...this.saetze.values()].some((s) => s.dateiId === neu.dateiId);
    if (!bekannt) {
      throw new BindungsFehler("ungueltig", "Diese Datei ist mit dem Meeting nicht verbunden.");
    }
    this.dokumentRecht(nutzerId, this.aktuelleQuelle(neu.dateiId));
    this.dokumentRecht(nutzerId, neu.quelleId);
    return this.abgleichAnwenden(nutzerId, neu);
  }

  /**
   * Der gemeinsame Kern jedes Fassungswechsels (`fassungsabgleich` und Wiederimport mit neuer
   * Originalfassung). Rechte sind vorher geprüft.
   */
  private abgleichAnwenden(nutzerId: string, neu: Foliensatz): FassungsAbgleichEintrag[] {
    this.originale.set(neu.dateiId, kopie(neu));
    this.fassungen.set(this.schluessel(neu.dateiId, neu.fassung), kopie(neu));
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
      if (this.mitschriftLesbar(nutzerId, meldung.mitschriftId)) {
        ergebnis.push({ rueckmeldungId: meldung.id, sldId: ziel.sldId, stand });
      }
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

  /** Die Folie einer Fassung — nur mit Leserecht am Quellobjekt GENAU DIESER Fassung. */
  private folieSichtbar(nutzerId: string, ziel: Folienziel): FolienAnker | null {
    const anker = this.anker(ziel) ?? this.originalAnker(ziel);
    const quelle = this.quelleVon(ziel.dateiId, ziel.fassung);
    if (!anker || !this.rechte.dokumentLesen(nutzerId, quelle)) {
      return null;
    }
    if (anker.versteckt && !this.rechte.versteckteFolienLesen(nutzerId, quelle)) {
      return null;
    }
    return anker;
  }

  private originalAnker(ziel: Folienziel): FolienAnker | undefined {
    return this.fassungen
      .get(this.schluessel(ziel.dateiId, ziel.fassung))
      ?.folien.find((f) => f.sldId === ziel.sldId);
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
      zielQuelleId: zielLesbar && a.ziel ? this.quelleVon(a.ziel.dateiId, a.ziel.fassung) : null,
      zielVerborgen: a.ziel !== null && !zielLesbar,
    };
  }

  private bindungSicht(nutzerId: string, b: Bindung): BindungsSicht {
    let folie: FolienSicht | null = null;
    if (b.ziel) {
      const anker = this.folieSichtbar(nutzerId, b.ziel);
      const quelleId = this.quelleVon(b.ziel.dateiId, b.ziel.fassung);
      folie = anker
        ? {
            lesbar: true,
            ...b.ziel,
            quelleId,
            titel: b.praesentiert?.titel ?? anker.titel,
            position: b.praesentiert?.position ?? anker.position,
            notizen: this.rechte.notizenLesen(nutzerId, quelleId) ? anker.notizen : null,
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
   * auch keine Existenzauskunft), ebenso ohne aktuelles Leserecht an ihrer Mitschrift: Stelle,
   * Text und alle Ableitungen stammen aus ihr (Befund 1). Die Folie erscheint nur mit eigenem
   * Dokumentrecht; versteckte Folien und Sprechernotizen nur mit eigenem Recht darauf.
   */
  sicht(nutzerId: string, rueckmeldungId: string): RueckmeldungsSicht | null {
    const m = this.meldungen.get(rueckmeldungId);
    if (
      !m ||
      !this.rechte.meetingLesen(nutzerId, m.meetingId) ||
      !this.mitschriftLesbar(nutzerId, m.mitschriftId)
    ) {
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

  /** Das Änderungsobjekt einer Rückmeldung, wie der Nutzer es sehen darf (Rechte wie `sicht`). */
  aenderung(nutzerId: string, rueckmeldungId: string): AenderungsSicht | null {
    if (!this.sicht(nutzerId, rueckmeldungId)) {
      return null;
    }
    return this.aenderungSicht(nutzerId, rueckmeldungId);
  }

  /** Frühere Bindungen — Rechte wie `sicht`, Folien nur mit Dokumentrecht. */
  historie(nutzerId: string, rueckmeldungId: string): BindungsSicht[] {
    if (!this.sicht(nutzerId, rueckmeldungId)) {
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
    if (!this.rechte.dokumentLesen(nutzerId, this.aktuelleQuelle(dateiId))) {
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
    quelleId: string;
    fassung: string;
    abgleich: KopieAbgleich;
    folien: { sldId: string; position: number; titel: string; versteckt: boolean }[];
  }[] {
    this.meetingRecht(nutzerId);
    return [...this.saetze.values()]
      .filter((s) => this.rechte.dokumentLesen(nutzerId, s.quelleId))
      .map((s) => ({
        dateiId: s.dateiId,
        quelleId: s.quelleId,
        fassung: s.fassung,
        abgleich: this.kopieAbgleich(nutzerId, s.dateiId, s.fassung),
        folien: s.folien
          .filter((f) => !f.versteckt || this.rechte.versteckteFolienLesen(nutzerId, s.quelleId))
          .map((f) => ({
            sldId: f.sldId,
            position: f.position,
            titel: f.titel,
            versteckt: f.versteckt,
          })),
      }));
  }

  /**
   * Die verbundenen Mitschriften (Kennung, Zeitbasis, Stellen) — mit Meetingrecht und nur die,
   * deren Datei der Nutzer aktuell lesen darf (Befund 1).
   */
  mitschriftenSicht(nutzerId: string): Mitschrift[] {
    this.meetingRecht(nutzerId);
    return kopie(
      [...this.mitschriften.values()].filter((m) => this.mitschriftLesbar(nutzerId, m.id)),
    );
  }
}

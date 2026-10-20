import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";

// ================================================================================================
// produkt:20261008:klara-kalender (Klara 11, AW-17, P07) — DEN VORHANDENEN KALENDER BEWUSST BEDIENEN.
// ================================================================================================
//
// „Konto/Kalender und Lese-/Schreibumfang wählen, führendes System und Synchronisationsrichtung je
// Anbindung festlegen. … Interner Auftrag/event_id ↔ gesonderte externe event_id mit
// Provider/Kalenderkonto/Version; Sync übernimmt nur erlaubte Felder/Richtung. Interner Scheduler
// bleibt unabhängig." (AW-17.) Diese Datei ist genau diese Regel — ohne Netz und ohne Ablage. Der
// Anbieter steht hinter einer Schnittstelle (`KalenderAnbieter`); der erste ist Microsoft 365
// (`klara-kalender-m365.ts`), geprüft wird hier gegen ein Vertragsdouble.
//
// WAS HIER ENTSCHIEDEN WIRD:
//   · ANBINDUNG: Konto und Zielkalender stammen vom ANBIETER, nie vom Browser. Die vier Rechte
//     (lesen, eigene Termine schreiben, geteilten Kalender bearbeiten, Personen einladen) sind
//     getrennt; der gewählte Umfang ist höchstens, was der Anbieter gewährt.
//   · FELDWEISE FÜHRUNG (P07-AC04): je Feld `klara` (Klara schreibt, Kalenderänderung ist Konflikt),
//     `kalender` (Kalender führt, Klara übernimmt nur in die Projektion) oder `nur_klara` (Feld geht
//     nicht hinaus). Zusätzlich je Feld die Konfliktstrategie `nachfragen` oder
//     `fuehrend_mit_hinweis`. Eine Absage und eine externe Löschung fragen IMMER nach.
//   · ZUORDNUNG: ein stabiler Schlüssel (Konto, Anbindung, Auftrag, Ereignis) ↔ externe Kennung samt
//     Anbieter, Kalenderkonto, Kalender und Anbieterfassung. Er ist zugleich der Vorgangsschlüssel
//     beim Anlegen — eine verlorene Antwort führt zu KEINER Dublette.
//   · KEIN STILLES LAST-WRITE-WINS (AW17-K04): Haben beide Seiten dasselbe Feld seit dem letzten
//     Abgleich geändert, entsteht ein sichtbarer Konflikt — oder, wenn ausdrücklich so eingestellt,
//     gewinnt die führende Seite MIT Hinweis im Verlauf.
//   · SPERRMARKE (AW17-K05): Ein abgesagter Lauf, ein gelöschtes Ereignis und eine pausierte Serie
//     tragen eine Sperrmarke. Ein verspäteter Abgleich oder Webhook (jede Fassung) stellt nichts
//     wieder her; nur eine ausdrückliche Entscheidung hebt sie auf.
//   · EXTERNE LÖSCHUNG (P07-AC05/06): pausiert NUR den betroffenen Lauf, bis die Person ausdrücklich
//     fortführt oder beendet. Dialogschließen ist keine Zustimmung. Einzeltermin und Serie werden in
//     der Entscheidung ausdrücklich unterschieden.
//   · KEIN FALSCHER ERFOLG (K3, AW17-K06): Fehlendes Recht, abgelaufene Verbindung, ausgefallener
//     Anbieter und ausgefallene Ablage enden als `fehlgeschlagen` bzw. `ausstehend`. „Projiziert" gilt
//     erst, wenn das Ereignis beim Anbieter NACHGELESEN wurde UND die Zuordnung gespeichert ist.
//
// BEWUSST NICHT HIER: der interne Kalender und der interne Scheduler (Elternaufträge
// `produkt:20261010:klara-eigener-kalender`, `produkt:20261007:klara-erinnerungen-kalender`). Diese
// Datei LIEST nur einen internen Termin und gibt eine `laufWirkung` zurück; sie ändert weder
// Erinnerung noch Notiz noch Aufgabe (K4) und hält den internen Lauf nie selbst an. Die Wirkung auf
// den TATSÄCHLICHEN Lauf geht über zwei Türen der EINEN Erinnerungssteuerung (Anschluss in
// `klara-kalender-lauf.ts`): `vorkommenSperre` fragt die Steuerung unmittelbar vor jeder Wirkung ab,
// `KalenderLaufSteuerung.melde` gibt nach einer ausdrücklichen Entscheidung den wartenden Lauf frei
// bzw. beendet ihn im gewählten Umfang.

export const KALENDER_FELDER = ["titel", "zeit", "ort", "beschreibung", "teilnehmer"] as const;
export type KalenderFeld = (typeof KALENDER_FELDER)[number];

export const FELD_RICHTUNGEN = ["klara", "kalender", "nur_klara"] as const;
export type FeldRichtung = (typeof FELD_RICHTUNGEN)[number];

export const KONFLIKTSTRATEGIEN = ["nachfragen", "fuehrend_mit_hinweis"] as const;
export type Konfliktstrategie = (typeof KONFLIKTSTRATEGIEN)[number];

export interface FeldRegel {
  readonly richtung: FeldRichtung;
  readonly konflikt: Konfliktstrategie;
}

/** Was in einem GETEILTEN Kalender von einem privaten Termin sichtbar wird — nur ausdrücklich mehr. */
export const PRIVAT_PROJEKTIONEN = ["nur_belegt", "titel", "voll"] as const;
export type PrivatProjektion = (typeof PRIVAT_PROJEKTIONEN)[number];

export const ANBINDUNG_UMFAENGE = ["nur_lesen", "lesen_schreiben"] as const;
export type AnbindungUmfang = (typeof ANBINDUNG_UMFAENGE)[number];

/**
 * AW17-K08: die EINE festgelegte, sichtbare Regel für eine im Kalender entfernte Anzeige. Sie beendet
 * den verknüpften Auftrag nie selbst, sondern pausiert ihn bis zur ausdrücklichen Entscheidung.
 */
export const ENTFERNTE_ANZEIGE_REGEL = "pausieren_bis_entscheidung" as const;

/** Die Standardregeln: Klara führt Inhalt und Zeit, Teilnehmer gehen nicht hinaus. */
export const STANDARD_FELDREGELN: Readonly<Record<KalenderFeld, FeldRegel>> = {
  titel: { richtung: "klara", konflikt: "nachfragen" },
  zeit: { richtung: "klara", konflikt: "nachfragen" },
  ort: { richtung: "klara", konflikt: "nachfragen" },
  beschreibung: { richtung: "klara", konflikt: "nachfragen" },
  teilnehmer: { richtung: "nur_klara", konflikt: "nachfragen" },
};

// ------------------------------------------------------------------------------------------------
// DER ANBIETER — die Schnittstelle, hinter der Microsoft 365 (und später andere) steht.
// ------------------------------------------------------------------------------------------------

export type AnbieterArt = "microsoft365";

/**
 * Die Fehlerlagen eines Anbieters. `speicher_ausgefallen` gehört nicht dazu — die eigene Ablage
 * meldet sich als gewöhnliche Ausnahme und wird im Dienst gesondert benannt.
 */
export type AnbieterFehlerlage =
  | "recht_fehlt"
  | "verbindung_abgelaufen"
  | "anbieter_ausgefallen"
  | "nicht_gefunden"
  | "version_geaendert";

const LAGE_MELDUNG: Record<AnbieterFehlerlage, string> = {
  recht_fehlt: "Kalender: Für diese Handlung fehlt das Recht im verbundenen Kalender.",
  verbindung_abgelaufen: "Kalender: Die Verbindung ist abgelaufen und muss erneuert werden.",
  anbieter_ausgefallen: "Kalender: Der verbundene Kalender hat nicht brauchbar geantwortet.",
  nicht_gefunden: "Kalender: Das Ereignis ist im verbundenen Kalender nicht (mehr) vorhanden.",
  version_geaendert: "Kalender: Das Ereignis wurde inzwischen im Kalender geändert.",
};

/** Der eine Fehlertyp der Anbieter. Die Meldung ist ein fester Satz — kein fremder Text, kein Host. */
export class KalenderAnbieterFehler extends Error {
  readonly lage: AnbieterFehlerlage;

  constructor(lage: AnbieterFehlerlage) {
    super(LAGE_MELDUNG[lage]);
    this.name = "KalenderAnbieterFehler";
    this.lage = lage;
  }
}

export function anbieterFehlerlage(err: unknown): AnbieterFehlerlage | null {
  if (!err || typeof err !== "object" || !("lage" in err)) {
    return null;
  }
  const lage = (err as { lage: unknown }).lage;
  return typeof lage === "string" && lage in LAGE_MELDUNG ? (lage as AnbieterFehlerlage) : null;
}

export interface AnbieterKonto {
  /** Die Kennung des Kalenderkontos beim Anbieter (z. B. Objekt-ID). */
  readonly kennung: string;
  /** Was die Person sieht: Name und Anmeldename. */
  readonly anzeige: string;
  readonly adresse: string;
}

export interface KalenderRechte {
  readonly lesen: boolean;
  readonly eigeneSchreiben: boolean;
  readonly geteiltBearbeiten: boolean;
  readonly einladen: boolean;
}

export interface AnbieterKalender {
  readonly id: string;
  readonly name: string;
  /** `eigen`: gehört dem verbundenen Konto. `geteilt`: gehört jemand anderem oder einer Gruppe. */
  readonly art: "eigen" | "geteilt";
  readonly besitzer: string;
  readonly rechte: KalenderRechte;
}

export interface Teilnehmer {
  readonly adresse: string;
  readonly name: string;
  /** Antwort beim Anbieter: `offen`, `zugesagt`, `abgesagt`, `vorbehalt`. */
  readonly antwort: "offen" | "zugesagt" | "abgesagt" | "vorbehalt";
}

export type Serienart = "einzel" | "serie" | "vorkommen";

/** Die Felder, die hinausgehen bzw. hereinkommen — nur diese, nie mehr. */
export interface KalenderInhalt {
  readonly titel: string;
  readonly beginn: string;
  readonly ende: string;
  readonly zeitzone: string;
  readonly ort: string;
  readonly beschreibung: string;
  readonly teilnehmer: readonly Teilnehmer[];
}

export interface AnbieterTermin extends KalenderInhalt {
  readonly id: string;
  readonly kalenderId: string;
  /** Die Fassung beim Anbieter (Graph: `@odata.etag`/`changeKey`). */
  readonly version: string;
  readonly serienart: Serienart;
  readonly serienId: string | null;
  readonly abgesagt: boolean;
  /** Wer den Termin führt (Organisator). */
  readonly organisator: string;
  /** Der Vorgangsschlüssel, mit dem Klara ihn angelegt hat — sonst `null`. */
  readonly vorgang: string | null;
}

export interface KalenderAnbieter {
  readonly art: AnbieterArt;
  konto(): Promise<AnbieterKonto>;
  kalender(): Promise<AnbieterKalender[]>;
  liesZeitraum(kalenderId: string, von: string, bis: string): Promise<AnbieterTermin[]>;
  /** Liest genau ein Ereignis; `null`, wenn es dort nicht (mehr) existiert. */
  hole(kalenderId: string, id: string): Promise<AnbieterTermin | null>;
  /** Sucht ein Ereignis über den Vorgangsschlüssel — die Bremse gegen Dubletten. */
  sucheVorgang(kalenderId: string, vorgang: string): Promise<AnbieterTermin | null>;
  lege(
    kalenderId: string,
    inhalt: Partial<KalenderInhalt>,
    vorgang: string,
  ): Promise<AnbieterTermin>;
  aendere(
    kalenderId: string,
    id: string,
    inhalt: Partial<KalenderInhalt>,
    version: string,
  ): Promise<AnbieterTermin>;
  loesche(kalenderId: string, id: string, version: string): Promise<void>;
}

// ------------------------------------------------------------------------------------------------
// ANBINDUNG, INTERNER TERMIN, ZUORDNUNG
// ------------------------------------------------------------------------------------------------

export interface KalenderAnbindung {
  readonly id: string;
  readonly kontoId: string;
  readonly anbieter: AnbieterArt;
  /** Vom Anbieter gelesen — nie vom Browser behauptet. */
  readonly konto: AnbieterKonto;
  readonly kalender: AnbieterKalender;
  readonly umfang: AnbindungUmfang;
  /** Die wirksamen Rechte: gewählter Umfang geschnitten mit dem, was der Anbieter gewährt. */
  readonly rechte: KalenderRechte;
  readonly felder: Readonly<Record<KalenderFeld, FeldRegel>>;
  readonly privatProjektion: PrivatProjektion;
  readonly entfernteAnzeige: typeof ENTFERNTE_ANZEIGE_REGEL;
  readonly angelegtAm: string;
}

/**
 * Ein Termin aus dem INTERNEN Kalender bzw. ein Klara-Lauf mit Zeit. Die Datei liest ihn nur — sie
 * schreibt nie zurück. `privat`: Inhalte nur in den eigenen Kalender, im geteilten höchstens im
 * ausdrücklich eingestellten Umfang.
 */
export interface InternerTermin {
  readonly auftragId: string;
  readonly ereignisId: string;
  readonly fassung: number;
  readonly inhalt: KalenderInhalt;
  readonly privat: boolean;
  readonly serienart: Serienart;
  readonly abgesagt: boolean;
}

export type ProjektionsStand =
  | "ausstehend"
  | "projiziert"
  | "fehlgeschlagen"
  | "konflikt"
  | "pausiert"
  | "gesperrt";

export type SperrGrund =
  | "abgesagt"
  | "geloescht"
  | "serie_pausiert"
  | "extern_geloescht"
  | "beendet";

export interface Sperrmarke {
  readonly grund: SperrGrund;
  readonly am: string;
  /** Die letzte bekannte Anbieterfassung beim Sperren — jede spätere Meldung bleibt wirkungslos. */
  readonly version: string | null;
  readonly umfang: "einzeltermin" | "serie";
}

export interface Feldkonflikt {
  readonly feld: KalenderFeld;
  readonly klara: string;
  readonly kalender: string;
  readonly basis: string;
}

/** Eine offene Entscheidung zum betroffenen Lauf — bis sie fällt, ist der Lauf pausiert. */
export interface OffeneEntscheidung {
  /**
   * `loeschen_veraltet`: eine Löschentscheidung war an eine Fassung gebunden, die der Kalender
   * inzwischen nicht mehr trägt — es wurde nichts gelöscht.
   */
  readonly anlass: "extern_geloescht" | "extern_abgesagt" | "konflikt" | "loeschen_veraltet";
  readonly seit: string;
  readonly serienart: Serienart;
  /** Wählbare Umfänge: bei einer Serie ausdrücklich Einzeltermin ODER Serie. */
  readonly umfaenge: readonly ("einzeltermin" | "serie")[];
  readonly konflikte: readonly Feldkonflikt[];
  /** Die beim Konflikt gelesene Anbieterfassung — Grundlage, wenn die Person Klaras Stand einträgt. */
  readonly externVersion: string | null;
}

/**
 * Was beim letzten erfolgreichen Abgleich galt — je SEITE getrennt: Klaras interner Wert und der im
 * Kalender nachgelesene Wert. Sie dürfen verschieden sein (privater Termin als „Beschäftigt“,
 * Teilnehmer ohne Auftrag nicht hinaus) — eine Änderung erkennt nur der Vergleich mit der eigenen Seite.
 */
export interface Abgleichsbasis {
  readonly klara: Partial<Record<KalenderFeld, string>>;
  readonly kalender: Partial<Record<KalenderFeld, string>>;
}

export type ZuordnungsEreignis =
  | "angelegt"
  | "geaendert"
  | "nachgelesen"
  | "uebernommen"
  | "fuehrend_uebernommen"
  | "konflikt"
  | "pausiert"
  | "dialog_geschlossen"
  | "fortgefuehrt"
  | "beendet"
  | "geloescht"
  | "gesperrt"
  | "verspaetet_ignoriert"
  | "fehlgeschlagen";

export interface ZuordnungsVerlauf {
  readonly ereignis: ZuordnungsEreignis;
  readonly am: string;
  readonly hinweis: string | null;
}

export interface KalenderZuordnung {
  /** Stabiler Mapping-Schlüssel (AW17-K03) — zugleich der Vorgangsschlüssel beim Anbieter. */
  readonly schluessel: string;
  readonly kontoId: string;
  readonly anbindungId: string;
  readonly auftragId: string;
  readonly ereignisId: string;
  /**
   * Der zuletzt projizierte bzw. abgeglichene INTERNE Termin. Mit ihm verarbeitet der Abgleich
   * externe Änderungen auch dann, wenn gerade niemand einen internen Termin übergibt.
   */
  readonly intern: InternerTermin;
  readonly anbieter: AnbieterArt;
  readonly kalenderkonto: string;
  readonly kalenderId: string;
  readonly externeId: string | null;
  readonly anbieterVersion: string | null;
  /**
   * Wie oft dieser Termin nach einer ausdrücklichen Entscheidung NEU eingetragen wurde. Jede Generation
   * hat ihren eigenen Vorgangsschlüssel (`vorgangsschluessel`) — sonst verwürfe der Anbieter die
   * gewollte Neuanlage als Wiederholung der gelöschten.
   */
  readonly generation: number;
  readonly interneFassung: number;
  readonly serienart: Serienart;
  /** Bei einem Vorkommen: die Kennung der Serie beim Anbieter. */
  readonly serienId: string | null;
  readonly stand: ProjektionsStand;
  readonly basis: Abgleichsbasis;
  readonly sperrmarke: Sperrmarke | null;
  readonly entscheidung: OffeneEntscheidung | null;
  readonly fehler: AnbieterFehlerlage | "speicher_ausgefallen" | "nicht_verbunden" | null;
  readonly verlauf: readonly ZuordnungsVerlauf[];
  readonly geaendertAm: string;
}

const MAX_VERLAUF = 100;

/**
 * Der stabile Schlüssel. Er enthält keine Klartexte (Hash), ist für dieselbe Kombination immer
 * gleich und für den Anbieter als Vorgangsschlüssel brauchbar (Graph: `transactionId`).
 */
export function zuordnungsSchluessel(
  kontoId: string,
  anbindungId: string,
  auftragId: string,
  ereignisId: string,
): string {
  const h = createHash("sha256")
    .update(["klara-kalender", kontoId, anbindungId, auftragId, ereignisId].join("\u0000"))
    .digest("hex");
  return `kk-${h.slice(0, 40)}`;
}

/** Der Vorgangsschlüssel beim Anbieter: der Mapping-Schlüssel, ab der 2. Generation mit Zusatz. */
export function vorgangsschluessel(
  z: Pick<KalenderZuordnung, "schluessel" | "generation">,
): string {
  return z.generation === 0 ? z.schluessel : `${z.schluessel}-g${z.generation}`;
}

// ------------------------------------------------------------------------------------------------
// FELDREGELN UND RECHTE
// ------------------------------------------------------------------------------------------------

export class KalenderAnbindungFehler extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    readonly grund:
      | "eingabe"
      | "recht_fehlt"
      | "auftrag_fehlt"
      | "gesperrt"
      | "pausiert"
      | "umfang_fehlt"
      | "fassung_fehlt"
      | "keine_entscheidung",
    message: string,
  ) {
    super(message);
    this.name = "KalenderAnbindungFehler";
  }
}

function eingabeFehler(message: string): KalenderAnbindungFehler {
  return new KalenderAnbindungFehler(400, "eingabe", message);
}

function wahl<T extends string>(wert: unknown, erlaubt: readonly T[], feld: string): T {
  if (typeof wert !== "string" || !(erlaubt as readonly string[]).includes(wert)) {
    throw eingabeFehler(`${feld} muss einer der Werte ${erlaubt.join(", ")} sein.`);
  }
  return wert as T;
}

/**
 * Prüft die feldweisen Regeln. Fehlt ein Feld, gilt die Standardregel. Teilnehmer dürfen NICHT vom
 * Kalender geführt werden: eine Teilnehmeränderung im Kalender erweitert keinen Klara-Auftrag
 * (AW17-K07/K08) — sie wird höchstens angezeigt.
 */
export function pruefeFeldregeln(roh: unknown): Record<KalenderFeld, FeldRegel> {
  const aus: Record<KalenderFeld, FeldRegel> = { ...STANDARD_FELDREGELN };
  if (roh === undefined || roh === null) {
    return aus;
  }
  if (typeof roh !== "object" || Array.isArray(roh)) {
    throw eingabeFehler("felder muss ein Objekt je Feld sein.");
  }
  for (const [feld, regel] of Object.entries(roh as Record<string, unknown>)) {
    const f = wahl(feld, KALENDER_FELDER, "felder");
    if (typeof regel !== "object" || regel === null || Array.isArray(regel)) {
      throw eingabeFehler(`felder.${f} braucht richtung und konflikt.`);
    }
    const r = regel as Record<string, unknown>;
    const richtung = wahl(r.richtung, FELD_RICHTUNGEN, `felder.${f}.richtung`);
    const konflikt = wahl(r.konflikt ?? "nachfragen", KONFLIKTSTRATEGIEN, `felder.${f}.konflikt`);
    if (f === "teilnehmer" && richtung === "kalender") {
      throw eingabeFehler(
        "Teilnehmer führt Klara oder niemand – eine Teilnehmeränderung im Kalender ist kein Auftrag.",
      );
    }
    aus[f] = { richtung, konflikt };
  }
  return aus;
}

// `@` trennt in der Vorkommenskennung der Erinnerungen Auftrag und nominale Zeit (`<id>@<Termin>`).
const KENNUNG_RE = /^[A-Za-z0-9_.:@-]{1,200}$/;
const ORTSZEIT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const ADRESSE_RE = /^[^\s@,;<>"]{1,100}@[^\s@,;<>"]{1,200}$/;
const MAX_TEILNEHMER = 50;

function kennung(wert: unknown, feld: string): string {
  if (typeof wert !== "string" || !KENNUNG_RE.test(wert)) {
    throw eingabeFehler(`${feld} ist Pflicht (1–200 Zeichen aus Buchstaben, Ziffern, _ . : @ -).`);
  }
  return wert;
}

function textfeld(wert: unknown, max: number, feld: string, pflicht = false): string {
  if (wert === undefined || wert === null) {
    if (pflicht) {
      throw eingabeFehler(`${feld} ist Pflicht.`);
    }
    return "";
  }
  if (typeof wert !== "string" || wert.length > max || (pflicht && wert.trim().length === 0)) {
    throw eingabeFehler(`${feld} ist ein Text mit höchstens ${max} Zeichen.`);
  }
  return wert;
}

/** Eine IANA-Zeitzone, die die Laufzeit kennt (z. B. `Europe/Berlin`). */
export function istZeitzone(wert: unknown): wert is string {
  if (typeof wert !== "string" || wert.length === 0 || wert.length > 64) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("de-DE", { timeZone: wert });
    return true;
  } catch {
    return false;
  }
}

/**
 * Prüft einen internen Termin, wie er über die Anwendungstür hereinkommt: nur bekannte Felder,
 * jedes begrenzt; Ortszeit mit IANA-Zeitzone (über den Sommerzeitwechsel bleibt die Ortszeit stehen).
 */
export function pruefeInternenTermin(roh: unknown): InternerTermin {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    throw eingabeFehler("termin fehlt.");
  }
  const o = roh as Record<string, unknown>;
  const i = (
    typeof o.inhalt === "object" && o.inhalt !== null && !Array.isArray(o.inhalt) ? o.inhalt : {}
  ) as Record<string, unknown>;
  const beginn = i.beginn;
  const ende = i.ende;
  if (typeof beginn !== "string" || !ORTSZEIT_RE.test(beginn)) {
    throw eingabeFehler("inhalt.beginn ist eine Ortszeit JJJJ-MM-TTThh:mm[:ss].");
  }
  if (typeof ende !== "string" || !ORTSZEIT_RE.test(ende) || ende <= beginn) {
    throw eingabeFehler("inhalt.ende ist eine Ortszeit nach dem Beginn.");
  }
  const zeitzone = i.zeitzone;
  if (!istZeitzone(zeitzone)) {
    throw eingabeFehler("inhalt.zeitzone ist eine bekannte Zeitzone (z. B. Europe/Berlin).");
  }
  const rohTeilnehmer = i.teilnehmer ?? [];
  if (!Array.isArray(rohTeilnehmer) || rohTeilnehmer.length > MAX_TEILNEHMER) {
    throw eingabeFehler(`inhalt.teilnehmer: höchstens ${MAX_TEILNEHMER} Einträge.`);
  }
  const teilnehmer = rohTeilnehmer.map((x, n): Teilnehmer => {
    const t = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
    if (typeof t.adresse !== "string" || !ADRESSE_RE.test(t.adresse)) {
      throw eingabeFehler(`inhalt.teilnehmer[${n}].adresse ist eine E-Mail-Adresse.`);
    }
    return {
      adresse: t.adresse,
      name: textfeld(t.name, 200, `inhalt.teilnehmer[${n}].name`),
      antwort: "offen",
    };
  });
  const fassung = o.fassung;
  if (typeof fassung !== "number" || !Number.isSafeInteger(fassung) || fassung < 1) {
    throw eingabeFehler("fassung ist eine ganze Zahl ab 1.");
  }
  return {
    auftragId: kennung(o.auftragId, "auftragId"),
    ereignisId: kennung(o.ereignisId, "ereignisId"),
    fassung,
    privat: o.privat === true,
    serienart: wahl(
      o.serienart ?? "einzel",
      ["einzel", "serie", "vorkommen"] as const,
      "serienart",
    ),
    abgesagt: o.abgesagt === true,
    inhalt: {
      titel: textfeld(i.titel, 300, "inhalt.titel", true),
      beginn,
      ende,
      zeitzone,
      ort: textfeld(i.ort, 300, "inhalt.ort"),
      beschreibung: textfeld(i.beschreibung, 5_000, "inhalt.beschreibung"),
      teilnehmer,
    },
  };
}

/** Der Teilnehmerauftrag aus dem Netz — nur Adressen, ausdrücklich je Termin. */
export function pruefeTeilnehmerAuftragEingabe(roh: unknown): ProjektionsAuftrag {
  if (roh === undefined || roh === null) {
    return {};
  }
  const o = (typeof roh === "object" && !Array.isArray(roh) ? roh : {}) as Record<string, unknown>;
  if (!Array.isArray(o.adressen) || o.adressen.length > MAX_TEILNEHMER) {
    throw eingabeFehler("teilnehmerAuftrag.adressen ist eine Liste von E-Mail-Adressen.");
  }
  const adressen = o.adressen.map((x, n) => {
    if (typeof x !== "string" || !ADRESSE_RE.test(x)) {
      throw eingabeFehler(`teilnehmerAuftrag.adressen[${n}] ist eine E-Mail-Adresse.`);
    }
    return x;
  });
  return { teilnehmerAuftrag: { adressen } };
}

/** Die wirksamen Rechte: was der Anbieter gewährt UND der gewählte Umfang zulässt. */
export function wirksameRechte(
  kalender: AnbieterKalender,
  umfang: AnbindungUmfang,
): KalenderRechte {
  const schreiben = umfang === "lesen_schreiben";
  return {
    lesen: kalender.rechte.lesen,
    eigeneSchreiben: schreiben && kalender.art === "eigen" && kalender.rechte.eigeneSchreiben,
    geteiltBearbeiten: schreiben && kalender.art === "geteilt" && kalender.rechte.geteiltBearbeiten,
    einladen: schreiben && kalender.rechte.einladen,
  };
}

function darfSchreiben(a: KalenderAnbindung): boolean {
  return a.kalender.art === "eigen" ? a.rechte.eigeneSchreiben : a.rechte.geteiltBearbeiten;
}

export type TerminArt = "persoenlich" | "gemeinsam" | "einladung";

/**
 * Die Art eines gelesenen Termins für die Anzeige: `persoenlich` (ohne Teilnehmer, eigener
 * Organisator), `gemeinsam` (mit Teilnehmern, eigener Organisator) oder `einladung` (fremder
 * Organisator). So unterscheidet die Fläche persönliche, gemeinsame Termine und Einladungen.
 */
export function terminArt(t: AnbieterTermin, konto: AnbieterKonto): TerminArt {
  if (t.organisator && t.organisator.toLowerCase() !== konto.adresse.toLowerCase()) {
    return "einladung";
  }
  return t.teilnehmer.length > 0 ? "gemeinsam" : "persoenlich";
}

// ------------------------------------------------------------------------------------------------
// PROJEKTION: welche Felder hinausgehen
// ------------------------------------------------------------------------------------------------

export interface ProjektionsAuftrag {
  /**
   * AW17-K07/K2: Teilnehmer und Einladung gehen nur hinaus, wenn die Person es für GENAU diesen
   * Termin ausdrücklich beauftragt hat. Die Liste muss der internen Teilnehmerliste entsprechen.
   */
  readonly teilnehmerAuftrag?: { readonly adressen: readonly string[] } | null;
}

function feldwert(i: KalenderInhalt, f: KalenderFeld): string {
  switch (f) {
    case "titel":
      return i.titel;
    case "zeit":
      return `${i.beginn}|${i.ende}|${i.zeitzone}`;
    case "ort":
      return i.ort;
    case "beschreibung":
      return i.beschreibung;
    case "teilnehmer":
      return [...i.teilnehmer]
        .map((t) => t.adresse.toLowerCase())
        .sort()
        .join(",");
  }
}

function feldInhalt(i: KalenderInhalt, f: KalenderFeld): Partial<KalenderInhalt> {
  switch (f) {
    case "titel":
      return { titel: i.titel };
    case "zeit":
      return { beginn: i.beginn, ende: i.ende, zeitzone: i.zeitzone };
    case "ort":
      return { ort: i.ort };
    case "beschreibung":
      return { beschreibung: i.beschreibung };
    case "teilnehmer":
      return { teilnehmer: i.teilnehmer };
  }
}

export const PRIVAT_PLATZHALTER = "Beschäftigt";

/**
 * Was von einem internen Termin hinausgeht. Beim ANLEGEN jedes Feld außer `nur_klara` (der Kalender
 * braucht einen Anfangswert, auch für Felder, die er danach führt); beim ÄNDERN nur Felder mit
 * Richtung `klara` — was der Kalender führt, überschreibt Klara nicht. Teilnehmer nur mit Auftrag;
 * ein privater Termin im GETEILTEN Kalender nur im eingestellten Umfang.
 */
export function projektion(
  a: KalenderAnbindung,
  t: InternerTermin,
  auftrag: ProjektionsAuftrag,
  anlegen: boolean,
): Partial<KalenderInhalt> {
  let aus: Partial<KalenderInhalt> = {};
  for (const f of KALENDER_FELDER) {
    const richtung = a.felder[f].richtung;
    if (richtung === "nur_klara" || (!anlegen && richtung === "kalender")) {
      continue;
    }
    if (f === "teilnehmer" && !auftrag.teilnehmerAuftrag) {
      continue;
    }
    aus = { ...aus, ...feldInhalt(t.inhalt, f) };
  }
  if (anlegen && aus.beginn === undefined) {
    // Ohne Zeit gibt es keinen Termin — beim Anlegen geht sie immer hinaus.
    aus = { ...aus, ...feldInhalt(t.inhalt, "zeit") };
  }
  if (t.privat && a.kalender.art === "geteilt" && a.privatProjektion !== "voll") {
    // Nur Zeit und — bei `titel` — der Titel; Ort und Beschreibung bleiben leer. `voll` muss
    // ausdrücklich eingestellt sein; dann geht hinaus, was die Feldregeln erlauben.
    const titel = a.privatProjektion === "titel" ? t.inhalt.titel : PRIVAT_PLATZHALTER;
    const zeit: Partial<KalenderInhalt> =
      aus.beginn === undefined ? {} : feldInhalt(t.inhalt, "zeit");
    aus = { ...zeit, titel, ort: "", beschreibung: "" };
  }
  return aus;
}

/** Prüft den Teilnehmerauftrag gegen Rechte und interne Liste — ohne Auftrag keine Einladung. */
export function pruefeTeilnehmerAuftrag(
  a: KalenderAnbindung,
  t: InternerTermin,
  auftrag: ProjektionsAuftrag,
): void {
  const intern = feldwert(t.inhalt, "teilnehmer");
  if (!auftrag.teilnehmerAuftrag) {
    return;
  }
  if (a.felder.teilnehmer.richtung !== "klara") {
    throw new KalenderAnbindungFehler(
      409,
      "auftrag_fehlt",
      "Teilnehmer gehen in dieser Anbindung nicht hinaus (Feldregel). Erst die Regel ändern.",
    );
  }
  if (t.privat && a.kalender.art === "geteilt" && a.privatProjektion !== "voll") {
    throw new KalenderAnbindungFehler(
      409,
      "auftrag_fehlt",
      "Ein privater Termin erscheint in diesem geteilten Kalender nur eingeschränkt – ohne Einladung.",
    );
  }
  if (!a.rechte.einladen) {
    throw new KalenderAnbindungFehler(
      403,
      "recht_fehlt",
      "Für diesen Kalender fehlt das Recht, Personen einzuladen.",
    );
  }
  const beauftragt = [...auftrag.teilnehmerAuftrag.adressen]
    .map((x) => x.toLowerCase())
    .sort()
    .join(",");
  if (beauftragt.length === 0 || beauftragt !== intern) {
    throw new KalenderAnbindungFehler(
      409,
      "auftrag_fehlt",
      "Die Einladung entspricht nicht genau den beauftragten Teilnehmern – es wird niemand eingeladen.",
    );
  }
}

// ------------------------------------------------------------------------------------------------
// EINGEHEND: Feldvergleich, Konflikt, Sperrmarke
// ------------------------------------------------------------------------------------------------

function mitVerlauf(
  z: KalenderZuordnung,
  ereignis: ZuordnungsEreignis,
  am: string,
  hinweis: string | null = null,
): KalenderZuordnung {
  return {
    ...z,
    verlauf: [...z.verlauf, { ereignis, am, hinweis }].slice(-MAX_VERLAUF),
    geaendertAm: am,
  };
}

/** Die Wirkung auf den INTERNEN Lauf — nur Anzeige und Pause, nie Erweiterung. */
export type LaufWirkung = "keine" | "pausiert" | "beendet";

export interface AbgleichErgebnis {
  readonly zuordnung: KalenderZuordnung;
  readonly laufWirkung: LaufWirkung;
  /**
   * Werte aus dem Kalender, die nach Feldregel in den internen Termin dürfen (`kalender` führt).
   * Titel/Beschreibung erscheinen hier nur als Anzeigewert eines Termins — nie als Auftragsgrenze.
   */
  readonly uebernahme: Partial<KalenderInhalt>;
  /** Was nach `fuehrend_mit_hinweis` die führende Seite überschrieben hat — sichtbar, nicht still. */
  readonly hinweise: readonly Feldkonflikt[];
}

function basisAus(i: KalenderInhalt): Partial<Record<KalenderFeld, string>> {
  const b: Partial<Record<KalenderFeld, string>> = {};
  for (const f of KALENDER_FELDER) {
    b[f] = feldwert(i, f);
  }
  return b;
}

/**
 * P07-AC06: Ein Vorkommen einer Serie verlangt die ausdrückliche Wahl zwischen Einzeltermin und
 * Serie; ein Einzeltermin kennt nur sich selbst; eine ganze Serie nur die Serie.
 */
export function waehlbareUmfaenge(serienart: Serienart): readonly ("einzeltermin" | "serie")[] {
  if (serienart === "vorkommen") {
    return ["einzeltermin", "serie"];
  }
  return serienart === "serie" ? ["serie"] : ["einzeltermin"];
}

/**
 * Die Serienart, aus der die Entscheidung ihre Umfänge nimmt. Ein Vorkommen einer INTERNEN Serie,
 * das im Kalender als eigenes Einzelereignis steht, gehört trotzdem zu seiner Serie: die Person
 * wählt ausdrücklich zwischen diesem Termin und der ganzen Serie (P07-AC06). Die gespeicherte
 * Serienart der Zuordnung bleibt die des Kalenders (sie steuert das Löschen am Serienmaster).
 */
function entscheidungsArt(extern: Serienart, intern: Serienart): Serienart {
  return extern === "einzel" && intern === "vorkommen" ? "vorkommen" : extern;
}

function entscheidungFuer(
  anlass: OffeneEntscheidung["anlass"],
  serienart: Serienart,
  am: string,
  externVersion: string | null,
  konflikte: readonly Feldkonflikt[] = [],
): OffeneEntscheidung {
  return {
    anlass,
    seit: am,
    serienart,
    umfaenge: waehlbareUmfaenge(serienart),
    konflikte,
    externVersion,
  };
}

/**
 * Verarbeitet, was der Kalender zu einem zugeordneten Ereignis meldet (Abgleich oder Webhook).
 * `extern === null` heißt: dort gelöscht. Rein — Ablage und Netz liegen beim Dienst.
 */
export function abgleich(
  a: KalenderAnbindung,
  z: KalenderZuordnung,
  intern: InternerTermin,
  extern: AnbieterTermin | null,
  jetzt: string,
): AbgleichErgebnis {
  const ohne = { uebernahme: {}, hinweise: [] as Feldkonflikt[] };
  // AW17-K05: Eine Sperrmarke bleibt. Weder eine ältere noch eine neuere Meldung stellt her.
  if (z.sperrmarke) {
    return {
      zuordnung: mitVerlauf(z, "verspaetet_ignoriert", jetzt, z.sperrmarke.grund),
      laufWirkung: z.sperrmarke.grund === "beendet" ? "beendet" : "pausiert",
      ...ohne,
    };
  }
  // Eine schon offene Entscheidung wird durch weitere Meldungen nicht still aufgelöst.
  if (z.entscheidung) {
    return { zuordnung: z, laufWirkung: "pausiert", ...ohne };
  }
  if (extern === null || extern.abgesagt) {
    // P07-AC05 / AW17-K08: entfernte Anzeige beendet nichts — sie pausiert NUR diesen Lauf.
    const anlass = extern === null ? "extern_geloescht" : "extern_abgesagt";
    const serienart = extern?.serienart ?? z.serienart;
    const art = entscheidungsArt(serienart, intern.serienart);
    const neu: KalenderZuordnung = {
      ...z,
      serienart,
      stand: "pausiert",
      entscheidung: entscheidungFuer(anlass, art, jetzt, extern?.version ?? null),
    };
    return {
      zuordnung: mitVerlauf(neu, "pausiert", jetzt, anlass),
      laufWirkung: "pausiert",
      ...ohne,
    };
  }
  if (extern.version === z.anbieterVersion) {
    return { zuordnung: z, laufWirkung: "keine", ...ohne };
  }

  const konflikte: Feldkonflikt[] = [];
  const hinweise: Feldkonflikt[] = [];
  let uebernahme: Partial<KalenderInhalt> = {};
  const basisKalender = { ...z.basis.kalender };
  const basisKlara = { ...z.basis.klara };
  let klaraZurueckschreiben = false;
  for (const f of KALENDER_FELDER) {
    const regel = a.felder[f];
    const bKlara = z.basis.klara[f] ?? "";
    const bKalender = z.basis.kalender[f] ?? "";
    const k = feldwert(intern.inhalt, f);
    const e = feldwert(extern, f);
    const klaraGeaendert = k !== bKlara;
    const kalenderGeaendert = e !== bKalender;
    if (!kalenderGeaendert || regel.richtung === "nur_klara") {
      continue;
    }
    const fall: Feldkonflikt = { feld: f, klara: k, kalender: e, basis: bKalender };
    if (f === "teilnehmer") {
      // Eine Teilnehmeränderung im Kalender ändert nie die interne Liste und lädt niemanden ein.
      konflikte.push(fall);
      continue;
    }
    if (regel.richtung === "kalender" && !klaraGeaendert) {
      uebernahme = { ...uebernahme, ...feldInhalt(extern, f) };
      basisKalender[f] = e;
      basisKlara[f] = e;
      continue;
    }
    if (regel.konflikt === "fuehrend_mit_hinweis") {
      hinweise.push(fall);
      if (regel.richtung === "kalender") {
        uebernahme = { ...uebernahme, ...feldInhalt(extern, f) };
        basisKalender[f] = e;
        basisKlara[f] = e;
      } else {
        // Führt Klara, bleibt der Klara-Wert; die Projektion ist bis zum Zurückschreiben ausstehend.
        klaraZurueckschreiben = true;
      }
      continue;
    }
    konflikte.push(fall);
  }

  // Serienart und Serienkennung führt immer der Kalender — sie bestimmen die wählbaren Umfänge.
  let neu: KalenderZuordnung = { ...z, serienart: extern.serienart, serienId: extern.serienId };
  for (const h of hinweise) {
    neu = mitVerlauf(neu, "fuehrend_uebernommen", jetzt, `${h.feld}:${a.felder[h.feld].richtung}`);
  }
  if (konflikte.length > 0) {
    neu = {
      ...neu,
      stand: "konflikt",
      entscheidung: entscheidungFuer(
        "konflikt",
        entscheidungsArt(extern.serienart, intern.serienart),
        jetzt,
        extern.version,
        konflikte,
      ),
    };
    return {
      zuordnung: mitVerlauf(neu, "konflikt", jetzt, konflikte.map((c) => c.feld).join(",")),
      laufWirkung: "pausiert",
      uebernahme: {},
      hinweise,
    };
  }
  neu = {
    ...neu,
    basis: { klara: basisKlara, kalender: basisKalender },
    anbieterVersion: extern.version,
    stand: klaraZurueckschreiben ? "ausstehend" : "projiziert",
  };
  return {
    zuordnung: mitVerlauf(
      neu,
      Object.keys(uebernahme).length > 0 ? "uebernommen" : "nachgelesen",
      jetzt,
    ),
    laufWirkung: "keine",
    uebernahme,
    hinweise,
  };
}

// ------------------------------------------------------------------------------------------------
// ENTSCHEIDUNG: nur ausdrücklich — Dialogschließen ist keine
// ------------------------------------------------------------------------------------------------

export const ENTSCHEIDUNGEN = [
  "fortfuehren_neu_eintragen",
  "fortfuehren_ohne_kalender",
  "beenden",
  "dialog_geschlossen",
] as const;
export type Entscheidung = (typeof ENTSCHEIDUNGEN)[number];

export interface EntscheidungsEingabe {
  wahl?: unknown;
  umfang?: unknown;
}

export interface EntscheidungsErgebnis {
  readonly zuordnung: KalenderZuordnung;
  readonly laufWirkung: LaufWirkung;
  /** `true`: der Dienst soll das Ereignis NEU anlegen (neue Kennung, alte Sperre bleibt Geschichte). */
  readonly neuEintragen: boolean;
}

export function entscheide(
  z: KalenderZuordnung,
  eingabe: EntscheidungsEingabe,
  jetzt: string,
): EntscheidungsErgebnis {
  const wahlWert = wahl(eingabe.wahl, ENTSCHEIDUNGEN, "wahl");
  if (!z.entscheidung) {
    throw new KalenderAnbindungFehler(
      409,
      "keine_entscheidung",
      "Zu diesem Termin ist nichts offen.",
    );
  }
  // P07-AC05: Dialogschließen ist KEINE Zustimmung — der Lauf bleibt pausiert, nichts ändert sich.
  if (wahlWert === "dialog_geschlossen") {
    return {
      zuordnung: mitVerlauf(z, "dialog_geschlossen", jetzt),
      laufWirkung: "pausiert",
      neuEintragen: false,
    };
  }
  // P07-AC06: Bei einem Vorkommen einer Serie MUSS der Umfang genannt werden.
  if (eingabe.umfang === undefined || eingabe.umfang === null) {
    throw new KalenderAnbindungFehler(
      400,
      "umfang_fehlt",
      z.entscheidung.umfaenge.length > 1
        ? "Bitte ausdrücklich wählen: nur dieser Termin oder die ganze Serie."
        : "Bitte den Umfang der Entscheidung angeben.",
    );
  }
  const umfang = wahl(eingabe.umfang, z.entscheidung.umfaenge, "umfang");
  if (wahlWert === "beenden") {
    const neu: KalenderZuordnung = {
      ...z,
      stand: "gesperrt",
      entscheidung: null,
      sperrmarke: { grund: "beendet", am: jetzt, version: z.anbieterVersion, umfang },
    };
    return {
      zuordnung: mitVerlauf(neu, "beendet", jetzt, umfang),
      laufWirkung: "beendet",
      neuEintragen: false,
    };
  }
  if (wahlWert === "fortfuehren_ohne_kalender") {
    // Der interne Lauf geht weiter; die externe Projektion bleibt gesperrt (keine stille Wiederkehr).
    const neu: KalenderZuordnung = {
      ...z,
      stand: "gesperrt",
      entscheidung: null,
      sperrmarke: { grund: "extern_geloescht", am: jetzt, version: z.anbieterVersion, umfang },
    };
    return {
      zuordnung: mitVerlauf(neu, "fortgefuehrt", jetzt, `${umfang}:ohne_kalender`),
      laufWirkung: "keine",
      neuEintragen: false,
    };
  }
  // Beim Konflikt trägt „fortführen" ausdrücklich Klaras Stand in DASSELBE Ereignis ein (gegen die beim
  // Konflikt gelesene Fassung); nach Löschung/Absage entsteht ein NEUES Ereignis.
  // Beim Löschkonflikt heißt „fortführen“: das Ereignis bleibt, wie es jetzt im Kalender steht.
  const konflikt =
    z.entscheidung.anlass === "konflikt" || z.entscheidung.anlass === "loeschen_veraltet";
  const neu: KalenderZuordnung = {
    ...z,
    stand: "ausstehend",
    entscheidung: null,
    externeId: konflikt ? z.externeId : null,
    // Beim Löschkonflikt kann die gelesene Fassung die der SERIE sein — die eigene bleibt dann.
    anbieterVersion:
      z.entscheidung.anlass === "konflikt"
        ? z.entscheidung.externVersion
        : z.entscheidung.anlass === "loeschen_veraltet"
          ? z.anbieterVersion
          : null,
    generation: konflikt ? z.generation : z.generation + 1,
  };
  return {
    zuordnung: mitVerlauf(neu, "fortgefuehrt", jetzt, `${umfang}:neu_eintragen`),
    laufWirkung: "keine",
    neuEintragen: true,
  };
}

/** Sperrt eine Zuordnung, weil INTERN abgesagt, gelöscht oder eine Serie pausiert wurde. */
export function sperre(
  z: KalenderZuordnung,
  grund: Exclude<SperrGrund, "extern_geloescht" | "beendet">,
  umfang: "einzeltermin" | "serie",
  jetzt: string,
): KalenderZuordnung {
  if (z.sperrmarke) {
    return z;
  }
  const sperrmarke: Sperrmarke = { grund, am: jetzt, version: z.anbieterVersion, umfang };
  return mitVerlauf({ ...z, stand: "gesperrt", sperrmarke }, "gesperrt", jetzt, grund);
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE DER ANBINDUNGEN UND ZUORDNUNGEN
// ------------------------------------------------------------------------------------------------

export const KALENDER_ZUORDNUNGEN_JE_ANBINDUNG_MAX = 2_000;

export interface KalenderZuordnungRepo {
  anbindung(kontoId: string, id: string): Promise<KalenderAnbindung | null>;
  anbindungen(kontoId: string): Promise<KalenderAnbindung[]>;
  legeAnbindung(a: KalenderAnbindung): Promise<void>;
  zuordnung(kontoId: string, schluessel: string): Promise<KalenderZuordnung | null>;
  /** Die Zuordnungen EINER eigenen Anbindung, zuletzt geänderte zuerst. */
  zuordnungen(kontoId: string, anbindungId: string, limit: number): Promise<KalenderZuordnung[]>;
  /** Alle eigenen Zuordnungen zu EINEM internen Lauf (Auftrag + Ereignis), über alle Anbindungen. */
  zuLauf(kontoId: string, auftragId: string, ereignisId: string): Promise<KalenderZuordnung[]>;
  /** Alle eigenen Zuordnungen EINES internen Auftrags (jedes Vorkommen), über alle Anbindungen. */
  zuAuftrag(kontoId: string, auftragId: string): Promise<KalenderZuordnung[]>;
  /** Schreibt die Zuordnung; wirft, wenn die Ablage ausfällt. */
  speichere(z: KalenderZuordnung): Promise<void>;
}

export class InMemoryKalenderZuordnungRepo implements KalenderZuordnungRepo {
  private readonly anbindungenMap = new Map<string, KalenderAnbindung>();
  private readonly zuordnungenMap = new Map<string, KalenderZuordnung>();

  anbindung(kontoId: string, id: string): Promise<KalenderAnbindung | null> {
    const a = this.anbindungenMap.get(id);
    return Promise.resolve(a?.kontoId === kontoId ? a : null);
  }

  anbindungen(kontoId: string): Promise<KalenderAnbindung[]> {
    return Promise.resolve([...this.anbindungenMap.values()].filter((a) => a.kontoId === kontoId));
  }

  legeAnbindung(a: KalenderAnbindung): Promise<void> {
    this.anbindungenMap.set(a.id, a);
    return Promise.resolve();
  }

  zuordnung(kontoId: string, schluessel: string): Promise<KalenderZuordnung | null> {
    const z = this.zuordnungenMap.get(schluessel);
    return Promise.resolve(z?.kontoId === kontoId ? z : null);
  }

  zuordnungen(kontoId: string, anbindungId: string, limit: number): Promise<KalenderZuordnung[]> {
    const treffer = [...this.zuordnungenMap.values()]
      .filter((z) => z.kontoId === kontoId && z.anbindungId === anbindungId)
      .sort((x, y) => y.geaendertAm.localeCompare(x.geaendertAm));
    return Promise.resolve(treffer.slice(0, limit));
  }

  zuLauf(kontoId: string, auftragId: string, ereignisId: string): Promise<KalenderZuordnung[]> {
    return Promise.resolve(
      [...this.zuordnungenMap.values()].filter(
        (z) => z.kontoId === kontoId && z.auftragId === auftragId && z.ereignisId === ereignisId,
      ),
    );
  }

  zuAuftrag(kontoId: string, auftragId: string): Promise<KalenderZuordnung[]> {
    return Promise.resolve(
      [...this.zuordnungenMap.values()].filter(
        (z) => z.kontoId === kontoId && z.auftragId === auftragId,
      ),
    );
  }

  speichere(z: KalenderZuordnung): Promise<void> {
    this.zuordnungenMap.set(z.schluessel, z);
    return Promise.resolve();
  }
}

/**
 * Anbindungen und Zuordnungen samt Anbieterfassung, Sperrmarke, offener Entscheidung und Verlauf als
 * JSON — je eine Zeile. REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS` und
 * `CREATE INDEX IF NOT EXISTS`; kein DROP, kein Fremdschlüssel, keine Extension, kein Seed. Kein
 * Zugangsmerkmal wird gespeichert — der Zugang kommt nur aus der Betreiber-Einspeisung.
 */
export const KLARA_KALENDER_SCHEMA = `
CREATE TABLE IF NOT EXISTS klara_kalender_anbindungen (
  id text PRIMARY KEY,
  konto_id text NOT NULL,
  angelegt_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_klara_kalender_anbindungen_konto
  ON klara_kalender_anbindungen (konto_id);
CREATE TABLE IF NOT EXISTS klara_kalender_zuordnungen (
  schluessel text PRIMARY KEY,
  konto_id text NOT NULL,
  anbindung_id text NOT NULL,
  auftrag_id text NOT NULL,
  ereignis_id text NOT NULL,
  geaendert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_klara_kalender_zuordnungen_anbindung
  ON klara_kalender_zuordnungen (konto_id, anbindung_id, geaendert_am DESC);
CREATE INDEX IF NOT EXISTS idx_klara_kalender_zuordnungen_lauf
  ON klara_kalender_zuordnungen (konto_id, auftrag_id, ereignis_id);
`;

export class PgKalenderZuordnungRepo implements KalenderZuordnungRepo {
  constructor(private readonly pool: Pool) {}

  async anbindung(kontoId: string, id: string): Promise<KalenderAnbindung | null> {
    const res = await this.pool.query<{ data: KalenderAnbindung }>(
      "SELECT data FROM klara_kalender_anbindungen WHERE id = $1 AND konto_id = $2",
      [id, kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async anbindungen(kontoId: string): Promise<KalenderAnbindung[]> {
    const res = await this.pool.query<{ data: KalenderAnbindung }>(
      "SELECT data FROM klara_kalender_anbindungen WHERE konto_id = $1 ORDER BY angelegt_am, id",
      [kontoId],
    );
    return res.rows.map((r) => r.data);
  }

  async legeAnbindung(a: KalenderAnbindung): Promise<void> {
    await this.pool.query(
      `INSERT INTO klara_kalender_anbindungen (id, konto_id, angelegt_am, data)
       VALUES ($1, $2, $3, $4)`,
      [a.id, a.kontoId, a.angelegtAm, JSON.stringify(a)],
    );
  }

  async zuordnung(kontoId: string, schluessel: string): Promise<KalenderZuordnung | null> {
    const res = await this.pool.query<{ data: KalenderZuordnung }>(
      "SELECT data FROM klara_kalender_zuordnungen WHERE schluessel = $1 AND konto_id = $2",
      [schluessel, kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async zuordnungen(
    kontoId: string,
    anbindungId: string,
    limit: number,
  ): Promise<KalenderZuordnung[]> {
    const res = await this.pool.query<{ data: KalenderZuordnung }>(
      `SELECT data FROM klara_kalender_zuordnungen
        WHERE konto_id = $1 AND anbindung_id = $2
        ORDER BY geaendert_am DESC, schluessel
        LIMIT $3`,
      [kontoId, anbindungId, limit],
    );
    return res.rows.map((r) => r.data);
  }

  async zuLauf(
    kontoId: string,
    auftragId: string,
    ereignisId: string,
  ): Promise<KalenderZuordnung[]> {
    const res = await this.pool.query<{ data: KalenderZuordnung }>(
      `SELECT data FROM klara_kalender_zuordnungen
        WHERE konto_id = $1 AND auftrag_id = $2 AND ereignis_id = $3`,
      [kontoId, auftragId, ereignisId],
    );
    return res.rows.map((r) => r.data);
  }

  async zuAuftrag(kontoId: string, auftragId: string): Promise<KalenderZuordnung[]> {
    const res = await this.pool.query<{ data: KalenderZuordnung }>(
      `SELECT data FROM klara_kalender_zuordnungen
        WHERE konto_id = $1 AND auftrag_id = $2`,
      [kontoId, auftragId],
    );
    return res.rows.map((r) => r.data);
  }

  async speichere(z: KalenderZuordnung): Promise<void> {
    await this.pool.query(
      `INSERT INTO klara_kalender_zuordnungen
         (schluessel, konto_id, anbindung_id, auftrag_id, ereignis_id, geaendert_am, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (schluessel) DO UPDATE
         SET geaendert_am = EXCLUDED.geaendert_am, data = EXCLUDED.data
         WHERE klara_kalender_zuordnungen.konto_id = EXCLUDED.konto_id`,
      [
        z.schluessel,
        z.kontoId,
        z.anbindungId,
        z.auftragId,
        z.ereignisId,
        z.geaendertAm,
        JSON.stringify(z),
      ],
    );
  }
}

// ------------------------------------------------------------------------------------------------
// DER INTERNE LAUF — Anschluss an den vorhandenen Scheduler, ohne einen zweiten zu bauen
// ------------------------------------------------------------------------------------------------

/** Der Stand eines internen Laufs aus Sicht der Kalenderanbindung. */
export type LaufStand = "laeuft" | "pausiert" | "beendet";

/**
 * Die Tür zum internen Scheduler (Erinnerungen, `produkt:20261007:klara-erinnerungen-kalender`).
 * Der Dienst meldet NACH dem Speichern jede Laufwirkung genau für den betroffenen Lauf — samt dem
 * ausdrücklich gewählten Umfang (P07-AC06). Der Scheduler selbst bleibt Eigentum seines Auftrags
 * (AW18-K11: keine zweite Instanz); er fragt vor jeder Wirkung `vorkommenSperre` ab. In `buildApp`
 * schließt `erinnerungsLaufAnschluss` (`klara-kalender-lauf.ts`) beides an DIESELBE Steuerung an.
 */
export interface KalenderLaufSteuerung {
  melde(
    kontoId: string,
    auftragId: string,
    ereignisId: string,
    stand: LaufStand,
    umfang?: "einzeltermin" | "serie",
  ): Promise<void>;
}

/** Was die Erinnerungssteuerung vor einer Wirkung zu genau diesem Vorkommen erfährt. */
export type VorkommenSperre = "frei" | "pausiert" | "beendet";

/** Der Laufstand aus den gespeicherten Zuordnungen: beendet vor pausiert vor läuft. */
export function laufStandAus(zuordnungen: readonly KalenderZuordnung[]): LaufStand {
  if (zuordnungen.some((z) => z.sperrmarke?.grund === "beendet")) {
    return "beendet";
  }
  if (zuordnungen.some((z) => z.entscheidung !== null)) {
    return "pausiert";
  }
  return "laeuft";
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export interface KalenderDienstDeps {
  readonly repo: KalenderZuordnungRepo;
  /** Der Anbieter des Kontos — `null`, wenn keine Verbindung besteht (betrifft nur diese Anbindung). */
  readonly anbieterFuer: (kontoId: string) => Promise<KalenderAnbieter | null>;
  /** Der Anschluss an den internen Scheduler — fehlt er, bleibt `laufStand` die Auskunft. */
  readonly laufSteuerung?: KalenderLaufSteuerung;
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
}

export interface VerbindenEingabe {
  kalenderId?: unknown;
  umfang?: unknown;
  felder?: unknown;
  privatProjektion?: unknown;
}

/** Das Ergebnis einer Kalenderhandlung — `ok: true` NUR nach Nachlesen und gespeicherter Zuordnung. */
export type KalenderErgebnis =
  | {
      readonly ok: true;
      readonly zuordnung: KalenderZuordnung;
      readonly termin: AnbieterTermin | null;
    }
  | {
      readonly ok: false;
      readonly stand: "fehlgeschlagen" | "ausstehend";
      readonly grund: AnbieterFehlerlage | "speicher_ausgefallen" | "nicht_verbunden";
      readonly meldung: string;
      readonly zuordnung: KalenderZuordnung | null;
    };

export type KalenderAuswahl =
  | { readonly verbunden: false }
  | {
      readonly verbunden: true;
      readonly konto: AnbieterKonto;
      readonly kalender: AnbieterKalender[];
    };

export const NICHT_VERBUNDEN =
  "Kalender: Es besteht keine Verbindung. Persönliche Erinnerungen und Klaras eigener Kalender laufen unverändert weiter.";
const SPEICHER_AUSGEFALLEN =
  "Kalender: Die Zuordnung konnte nicht gespeichert werden. Der Termin gilt nicht als übertragen.";

export class KalenderAnbindungDienst {
  private readonly repo: KalenderZuordnungRepo;
  private readonly anbieterFuer: KalenderDienstDeps["anbieterFuer"];
  private readonly laufSteuerung: KalenderLaufSteuerung | undefined;
  private readonly jetzt: () => number;
  private readonly neueId: () => string;

  constructor(deps: KalenderDienstDeps) {
    this.repo = deps.repo;
    this.anbieterFuer = deps.anbieterFuer;
    this.laufSteuerung = deps.laufSteuerung;
    this.jetzt = deps.jetzt ?? Date.now;
    this.neueId = deps.neueId ?? randomUUID;
  }

  private jetztIso(): string {
    return new Date(this.jetzt()).toISOString();
  }

  /** K1: Konto und wählbare Kalender samt Rechten — vom Anbieter gelesen. */
  async auswahl(kontoId: string): Promise<KalenderAuswahl> {
    const anbieter = await this.anbieterFuer(kontoId);
    if (!anbieter) {
      return { verbunden: false };
    }
    return { verbunden: true, konto: await anbieter.konto(), kalender: await anbieter.kalender() };
  }

  async verbinde(kontoId: string, eingabe: VerbindenEingabe): Promise<KalenderAnbindung> {
    const anbieter = await this.anbieterFuer(kontoId);
    if (!anbieter) {
      throw new KalenderAnbindungFehler(409, "recht_fehlt", NICHT_VERBUNDEN);
    }
    if (typeof eingabe.kalenderId !== "string" || eingabe.kalenderId.length === 0) {
      throw eingabeFehler("kalenderId ist Pflicht.");
    }
    const umfang = wahl(eingabe.umfang, ANBINDUNG_UMFAENGE, "umfang");
    const felder = pruefeFeldregeln(eingabe.felder);
    const privatProjektion = wahl(
      eingabe.privatProjektion ?? "nur_belegt",
      PRIVAT_PROJEKTIONEN,
      "privatProjektion",
    );
    const konto = await anbieter.konto();
    const kalender = (await anbieter.kalender()).find((k) => k.id === eingabe.kalenderId);
    if (!kalender) {
      throw new KalenderAnbindungFehler(
        404,
        "eingabe",
        "Dieser Kalender ist im Konto nicht sichtbar.",
      );
    }
    if (!kalender.rechte.lesen) {
      throw new KalenderAnbindungFehler(
        403,
        "recht_fehlt",
        "Dieser Kalender darf nicht gelesen werden.",
      );
    }
    const rechte = wirksameRechte(kalender, umfang);
    const schreibrecht =
      kalender.art === "eigen" ? rechte.eigeneSchreiben : rechte.geteiltBearbeiten;
    if (umfang === "lesen_schreiben" && !schreibrecht) {
      throw new KalenderAnbindungFehler(
        403,
        "recht_fehlt",
        "In diesen Kalender darf nicht geschrieben werden. Bitte „nur lesen“ wählen.",
      );
    }
    const a: KalenderAnbindung = {
      id: this.neueId(),
      kontoId,
      anbieter: anbieter.art,
      konto,
      kalender,
      umfang,
      rechte,
      felder,
      privatProjektion,
      entfernteAnzeige: ENTFERNTE_ANZEIGE_REGEL,
      angelegtAm: this.jetztIso(),
    };
    await this.repo.legeAnbindung(a);
    return a;
  }

  private async anbindungUndAnbieter(
    kontoId: string,
    anbindungId: string,
  ): Promise<{ a: KalenderAnbindung; anbieter: KalenderAnbieter | null }> {
    const a = await this.repo.anbindung(kontoId, anbindungId);
    if (!a) {
      throw new KalenderAnbindungFehler(404, "eingabe", "Kalenderanbindung nicht gefunden.");
    }
    return { a, anbieter: await this.anbieterFuer(kontoId) };
  }

  /** Lesen: Termine des Zielkalenders mit Art und Teilnehmern — nichts Internes ändert sich. */
  async lese(
    kontoId: string,
    anbindungId: string,
    von: string,
    bis: string,
  ): Promise<
    | { ok: true; termine: (AnbieterTermin & { art: ReturnType<typeof terminArt> })[] }
    | { ok: false; grund: AnbieterFehlerlage | "nicht_verbunden"; meldung: string }
  > {
    const { a, anbieter } = await this.anbindungUndAnbieter(kontoId, anbindungId);
    if (!anbieter) {
      return { ok: false, grund: "nicht_verbunden", meldung: NICHT_VERBUNDEN };
    }
    try {
      const termine = await anbieter.liesZeitraum(a.kalender.id, von, bis);
      return { ok: true, termine: termine.map((t) => ({ ...t, art: terminArt(t, a.konto) })) };
    } catch (err) {
      const lage = anbieterFehlerlage(err);
      if (!lage) {
        throw err;
      }
      return { ok: false, grund: lage, meldung: LAGE_MELDUNG[lage] };
    }
  }

  private leereZuordnung(
    a: KalenderAnbindung,
    t: InternerTermin,
    jetzt: string,
  ): KalenderZuordnung {
    return {
      schluessel: zuordnungsSchluessel(a.kontoId, a.id, t.auftragId, t.ereignisId),
      kontoId: a.kontoId,
      anbindungId: a.id,
      auftragId: t.auftragId,
      ereignisId: t.ereignisId,
      intern: t,
      anbieter: a.anbieter,
      kalenderkonto: a.konto.kennung,
      kalenderId: a.kalender.id,
      externeId: null,
      anbieterVersion: null,
      generation: 0,
      interneFassung: t.fassung,
      serienart: t.serienart,
      serienId: null,
      stand: "ausstehend",
      basis: { klara: {}, kalender: {} },
      sperrmarke: null,
      entscheidung: null,
      fehler: null,
      verlauf: [],
      geaendertAm: jetzt,
    };
  }

  /** Hält den Fehler an der Zuordnung fest — best effort; ein Ablagefehler hier ändert nichts am Ergebnis. */
  private async scheitere(
    z: KalenderZuordnung,
    grund: AnbieterFehlerlage | "speicher_ausgefallen" | "nicht_verbunden",
    jetzt: string,
  ): Promise<KalenderErgebnis> {
    // AW17-K06: bei abgelaufenem Zugang und Ausfall bleibt die Projektion AUSSTEHEND (erneut
    // versuchbar), bei fehlendem Recht FEHLGESCHLAGEN. Nie „projiziert".
    const stand: "fehlgeschlagen" | "ausstehend" =
      grund === "recht_fehlt" ? "fehlgeschlagen" : "ausstehend";
    const neu = mitVerlauf({ ...z, stand, fehler: grund }, "fehlgeschlagen", jetzt, grund);
    try {
      await this.repo.speichere(neu);
    } catch {
      // Die Ablage ist selbst ausgefallen — das Ergebnis bleibt der ursprüngliche Fehlschlag.
    }
    const meldung =
      grund === "speicher_ausgefallen"
        ? SPEICHER_AUSGEFALLEN
        : grund === "nicht_verbunden"
          ? NICHT_VERBUNDEN
          : LAGE_MELDUNG[grund];
    return { ok: false, stand, grund, meldung, zuordnung: neu };
  }

  /**
   * Anlegen oder Ändern im Zielkalender. Gelingt NUR, wenn das Ereignis danach nachgelesen ist und
   * die Zuordnung gespeichert wurde. Ein erneuter Aufruf mit demselben internen Termin legt dank
   * Vorgangsschlüssel kein zweites Ereignis an (AW17-K01).
   */
  projiziere(
    kontoId: string,
    anbindungId: string,
    t: InternerTermin,
    auftrag: ProjektionsAuftrag = {},
  ): Promise<KalenderErgebnis> {
    return this.schreibe(kontoId, anbindungId, t, auftrag, false);
  }

  private async schreibe(
    kontoId: string,
    anbindungId: string,
    t: InternerTermin,
    auftrag: ProjektionsAuftrag,
    erneut: boolean,
  ): Promise<KalenderErgebnis> {
    const jetzt = this.jetztIso();
    const { a, anbieter } = await this.anbindungUndAnbieter(kontoId, anbindungId);
    const schluessel = zuordnungsSchluessel(kontoId, a.id, t.auftragId, t.ereignisId);
    const vorhanden = await this.repo.zuordnung(kontoId, schluessel);
    const z = vorhanden ?? this.leereZuordnung(a, t, jetzt);
    if (z.sperrmarke) {
      throw new KalenderAnbindungFehler(
        409,
        "gesperrt",
        "Dieser Termin ist gesperrt (abgesagt, gelöscht oder beendet) und wird nicht still wiederhergestellt.",
      );
    }
    if (z.entscheidung) {
      throw new KalenderAnbindungFehler(
        409,
        "pausiert",
        "Zu diesem Termin ist eine Entscheidung offen. Bis dahin wird nichts übertragen.",
      );
    }
    if (!darfSchreiben(a)) {
      throw new KalenderAnbindungFehler(
        403,
        "recht_fehlt",
        "Diese Anbindung darf nicht schreiben (nur lesen oder fehlendes Recht).",
      );
    }
    pruefeTeilnehmerAuftrag(a, t, auftrag);
    if (!anbieter) {
      return this.scheitere(z, "nicht_verbunden", jetzt);
    }
    const inhalt = projektion(a, t, auftrag, z.externeId === null);

    let geschrieben: AnbieterTermin;
    try {
      if (z.externeId) {
        geschrieben = await anbieter.aendere(
          a.kalender.id,
          z.externeId,
          inhalt,
          z.anbieterVersion ?? "",
        );
      } else {
        // Eine frühere Antwort ging vielleicht verloren: erst suchen, dann anlegen. Ein gefundenes
        // Ereignis bekommt den aktuellen Stand — es entsteht kein zweites.
        const vorgang = vorgangsschluessel(z);
        const gefunden = await anbieter.sucheVorgang(a.kalender.id, vorgang);
        geschrieben = gefunden
          ? await anbieter.aendere(a.kalender.id, gefunden.id, inhalt, gefunden.version)
          : await anbieter.lege(a.kalender.id, inhalt, vorgang);
      }
    } catch (err) {
      const lage = anbieterFehlerlage(err);
      if (!lage) {
        throw err;
      }
      if (z.externeId && (lage === "version_geaendert" || lage === "nicht_gefunden")) {
        // Der Kalender hat inzwischen geändert oder gelöscht: kein Erfolg und kein Überschreiben.
        // Ergibt der Abgleich einen Konflikt oder eine Löschung, wird der Lauf sichtbar pausiert.
        let extern: AnbieterTermin | null = null;
        if (lage === "version_geaendert") {
          try {
            extern = await anbieter.hole(a.kalender.id, z.externeId);
          } catch (fehler) {
            const l2 = anbieterFehlerlage(fehler);
            if (!l2) {
              throw fehler;
            }
            return this.scheitere(z, l2, jetzt);
          }
        }
        const r = abgleich(a, z, t, extern, jetzt);
        if (r.laufWirkung !== "pausiert") {
          // Die neue Fassung weicht in keinem Feld ab (z. B. nur Serienangaben): EIN erneuter
          // Versuch gegen die gelesene Fassung. Bringt sie zu übernehmende Werte mit, bleibt das dem
          // Abgleich überlassen — sie dürfen nicht unbemerkt verloren gehen.
          if (erneut || Object.keys(r.uebernahme).length > 0 || r.hinweise.length > 0) {
            return this.scheitere(z, lage, jetzt);
          }
          try {
            await this.repo.speichere(r.zuordnung);
          } catch {
            return this.scheitere(z, "speicher_ausgefallen", jetzt);
          }
          return this.schreibe(kontoId, anbindungId, t, auftrag, true);
        }
        try {
          await this.repo.speichere(r.zuordnung);
        } catch {
          return this.scheitere(r.zuordnung, "speicher_ausgefallen", jetzt);
        }
        await this.meldeLauf(r.zuordnung);
        return {
          ok: false,
          stand: "fehlgeschlagen",
          grund: lage,
          meldung: LAGE_MELDUNG[lage],
          zuordnung: r.zuordnung,
        };
      }
      return this.scheitere(z, lage, jetzt);
    }

    let nachgelesen: AnbieterTermin | null;
    try {
      nachgelesen = await anbieter.hole(a.kalender.id, geschrieben.id);
    } catch (err) {
      const lage = anbieterFehlerlage(err);
      if (!lage) {
        throw err;
      }
      // Die Kennung wird nicht ohne gelesene Fassung gemerkt: der nächste Versuch findet das
      // Ereignis über den Vorgangsschlüssel samt Fassung wieder (kein ungeprüftes Überschreiben).
      return this.scheitere(z, lage, jetzt);
    }
    if (!nachgelesen) {
      return this.scheitere(z, "nicht_gefunden", jetzt);
    }
    // Eine beauftragte Einladung gilt nur, wenn der Kalender genau diese Teilnehmer nachweist.
    if (
      inhalt.teilnehmer !== undefined &&
      feldwert(nachgelesen, "teilnehmer") !== feldwert(t.inhalt, "teilnehmer")
    ) {
      return this.scheitere(z, "anbieter_ausgefallen", jetzt);
    }
    const neu = mitVerlauf(
      {
        ...z,
        externeId: nachgelesen.id,
        anbieterVersion: nachgelesen.version,
        intern: t,
        interneFassung: t.fassung,
        serienart: nachgelesen.serienart,
        serienId: nachgelesen.serienId,
        stand: "projiziert",
        fehler: null,
        basis: { klara: basisAus(t.inhalt), kalender: basisAus(nachgelesen) },
      },
      z.externeId ? "geaendert" : "angelegt",
      jetzt,
    );
    try {
      await this.repo.speichere(neu);
    } catch {
      return this.scheitere(neu, "speicher_ausgefallen", jetzt);
    }
    return { ok: true, zuordnung: neu, termin: nachgelesen };
  }

  /** Prüft die Voraussetzungen jeder Löschung und nennt das Ziel (Ereignis bzw. Serie). */
  private async loeschZiel(
    kontoId: string,
    anbindungId: string,
    t: InternerTermin,
    umfang: unknown,
  ): Promise<{
    a: KalenderAnbindung;
    anbieter: KalenderAnbieter | null;
    z: KalenderZuordnung;
    u: "einzeltermin" | "serie";
    ziel: string;
  }> {
    const { a, anbieter } = await this.anbindungUndAnbieter(kontoId, anbindungId);
    const z = await this.repo.zuordnung(
      kontoId,
      zuordnungsSchluessel(kontoId, a.id, t.auftragId, t.ereignisId),
    );
    if (!z || !z.externeId) {
      throw new KalenderAnbindungFehler(
        404,
        "eingabe",
        "Dieser Termin steht nicht im verbundenen Kalender.",
      );
    }
    if (z.sperrmarke) {
      throw new KalenderAnbindungFehler(409, "gesperrt", "Dieser Termin ist bereits gesperrt.");
    }
    // Eine offene Entscheidung hält die Löschung an — außer der Löschkonflikt selbst: ihn löst
    // gerade eine NEUE, an die neu gelesene Fassung gebundene Löschentscheidung.
    if (z.entscheidung && z.entscheidung.anlass !== "loeschen_veraltet") {
      throw new KalenderAnbindungFehler(
        409,
        "pausiert",
        "Zu diesem Termin ist eine Entscheidung offen. Bis dahin wird nichts gelöscht.",
      );
    }
    if (umfang === undefined || umfang === null) {
      throw new KalenderAnbindungFehler(
        400,
        "umfang_fehlt",
        "Bitte wählen: nur dieser Termin oder die ganze Serie.",
      );
    }
    const u = wahl(umfang, waehlbareUmfaenge(z.serienart), "umfang");
    if (!darfSchreiben(a)) {
      throw new KalenderAnbindungFehler(403, "recht_fehlt", "Diese Anbindung darf nicht löschen.");
    }
    // Die ganze Serie eines Vorkommens löscht die Serie selbst (den Serienmaster).
    const serieStattVorkommen = u === "serie" && z.serienart === "vorkommen";
    if (serieStattVorkommen && !z.serienId) {
      throw new KalenderAnbindungFehler(
        409,
        "eingabe",
        "Die Serie dieses Termins ist nicht bekannt. Bitte zuerst abgleichen.",
      );
    }
    const ziel = serieStattVorkommen ? (z.serienId as string) : z.externeId;
    return { a, anbieter, z, u, ziel };
  }

  /**
   * AW17-K04 / P07-AC06: Vor jeder Löschung liest der Dienst das ZIEL beim Anbieter — bei „ganze
   * Serie“ aus einem Vorkommen den Serienmaster — samt Fassung. Diese Fassung zeigt die Oberfläche
   * an; die Löschentscheidung trägt sie mit (`loesche`). Nichts wird geschrieben.
   */
  async loeschVorschau(
    kontoId: string,
    anbindungId: string,
    t: InternerTermin,
    umfang: unknown,
  ): Promise<
    | {
        readonly ok: true;
        readonly umfang: "einzeltermin" | "serie";
        readonly ziel: AnbieterTermin;
        readonly fassung: string;
      }
    | {
        readonly ok: false;
        readonly grund: AnbieterFehlerlage | "nicht_verbunden";
        readonly meldung: string;
      }
  > {
    const { a, anbieter, u, ziel } = await this.loeschZiel(kontoId, anbindungId, t, umfang);
    if (!anbieter) {
      return { ok: false, grund: "nicht_verbunden", meldung: NICHT_VERBUNDEN };
    }
    try {
      const gelesen = await anbieter.hole(a.kalender.id, ziel);
      if (!gelesen || !gelesen.version) {
        return { ok: false, grund: "nicht_gefunden", meldung: LAGE_MELDUNG.nicht_gefunden };
      }
      return { ok: true, umfang: u, ziel: gelesen, fassung: gelesen.version };
    } catch (err) {
      const lage = anbieterFehlerlage(err);
      if (!lage) {
        throw err;
      }
      return { ok: false, grund: lage, meldung: LAGE_MELDUNG[lage] };
    }
  }

  /** Ein Löschkonflikt: das Ziel hat inzwischen eine andere Fassung. Sichtbar, nichts gelöscht. */
  private async loeschKonflikt(
    z: KalenderZuordnung,
    gesehen: string,
    aktuell: AnbieterTermin | null,
    jetzt: string,
  ): Promise<KalenderErgebnis> {
    const neu = mitVerlauf(
      {
        ...z,
        stand: "konflikt",
        entscheidung: entscheidungFuer(
          "loeschen_veraltet",
          z.serienart,
          jetzt,
          aktuell?.version ?? null,
        ),
      },
      "konflikt",
      jetzt,
      `loeschen:${gesehen}->${aktuell?.version ?? "?"}`,
    );
    try {
      await this.repo.speichere(neu);
    } catch {
      return this.scheitere(z, "speicher_ausgefallen", jetzt);
    }
    await this.meldeLauf(neu);
    return {
      ok: false,
      stand: "fehlgeschlagen",
      grund: "version_geaendert",
      meldung: LAGE_MELDUNG.version_geaendert,
      zuordnung: neu,
    };
  }

  /**
   * Löschen im Zielkalender — NUR mit der Fassung, die die Person in der Löschvorschau gesehen hat.
   * Ohne Fassung keine Löschung (kein unbedingtes DELETE). Weicht die aktuelle Fassung ab — vor
   * dem Löschen gelesen oder vom Anbieter beim DELETE gemeldet —, entsteht ein sichtbarer Konflikt,
   * und es wird nichts gelöscht. Danach trägt die Zuordnung eine Sperrmarke.
   */
  async loesche(
    kontoId: string,
    anbindungId: string,
    t: InternerTermin,
    eingabe: { umfang?: unknown; fassung?: unknown },
  ): Promise<KalenderErgebnis> {
    const jetzt = this.jetztIso();
    const { a, anbieter, z, u, ziel } = await this.loeschZiel(
      kontoId,
      anbindungId,
      t,
      eingabe.umfang,
    );
    const gesehen = eingabe.fassung;
    if (typeof gesehen !== "string" || gesehen.length === 0 || gesehen.length > 500) {
      throw new KalenderAnbindungFehler(
        400,
        "fassung_fehlt",
        "Die Löschung braucht die angezeigte Fassung des Termins bzw. der Serie. Bitte erneut ansehen.",
      );
    }
    if (!anbieter) {
      return this.scheitere(z, "nicht_verbunden", jetzt);
    }
    let aktuell: AnbieterTermin | null;
    try {
      aktuell = await anbieter.hole(a.kalender.id, ziel);
    } catch (err) {
      const lage = anbieterFehlerlage(err);
      if (!lage) {
        throw err;
      }
      return this.scheitere(z, lage, jetzt);
    }
    if (!aktuell || aktuell.version !== gesehen) {
      return this.loeschKonflikt(z, gesehen, aktuell, jetzt);
    }
    try {
      // `If-Match` mit der gesehenen Fassung: eine Änderung zwischen Lesen und Löschen meldet der
      // Anbieter als `version_geaendert` — dann bleibt alles stehen.
      await anbieter.loesche(a.kalender.id, ziel, gesehen);
    } catch (err) {
      const lage = anbieterFehlerlage(err);
      if (!lage) {
        throw err;
      }
      if (lage === "version_geaendert") {
        let jetztGelesen: AnbieterTermin | null = null;
        try {
          jetztGelesen = await anbieter.hole(a.kalender.id, ziel);
        } catch {
          // Die neue Fassung bleibt dann unbekannt; der Konflikt gilt trotzdem.
        }
        return this.loeschKonflikt(z, gesehen, jetztGelesen, jetzt);
      }
      if (lage !== "nicht_gefunden") {
        return this.scheitere(z, lage, jetzt);
      }
    }
    // Nachlesen: erst wenn das Ereignis wirklich fehlt, gilt es als gelöscht.
    try {
      if (await anbieter.hole(a.kalender.id, ziel)) {
        return this.scheitere(z, "anbieter_ausgefallen", jetzt);
      }
    } catch (err) {
      const lage = anbieterFehlerlage(err);
      if (!lage) {
        throw err;
      }
      return this.scheitere(z, lage, jetzt);
    }
    const neu = mitVerlauf(
      sperre(
        { ...z, entscheidung: null },
        u === "serie" ? "serie_pausiert" : "geloescht",
        u,
        jetzt,
      ),
      "geloescht",
      jetzt,
      `${u}:${gesehen}`,
    );
    try {
      await this.repo.speichere(neu);
    } catch {
      return this.scheitere(neu, "speicher_ausgefallen", jetzt);
    }
    return { ok: true, zuordnung: neu, termin: null };
  }

  /** Abgleich bzw. Webhook für einen zugeordneten Termin. */
  async gleicheAb(
    kontoId: string,
    anbindungId: string,
    t: InternerTermin,
  ): Promise<
    KalenderErgebnis & { laufWirkung?: LaufWirkung; uebernahme?: Partial<KalenderInhalt> }
  > {
    const jetzt = this.jetztIso();
    const { a, anbieter } = await this.anbindungUndAnbieter(kontoId, anbindungId);
    const z = await this.repo.zuordnung(
      kontoId,
      zuordnungsSchluessel(kontoId, a.id, t.auftragId, t.ereignisId),
    );
    if (!z) {
      throw new KalenderAnbindungFehler(404, "eingabe", "Keine Zuordnung zu diesem Termin.");
    }
    if (!anbieter) {
      return this.scheitere(z, "nicht_verbunden", jetzt);
    }
    let extern: AnbieterTermin | null = null;
    if (!z.sperrmarke && z.externeId) {
      try {
        extern = await anbieter.hole(a.kalender.id, z.externeId);
      } catch (err) {
        const lage = anbieterFehlerlage(err);
        if (!lage) {
          throw err;
        }
        return this.scheitere(z, lage, jetzt);
      }
    }
    const r = abgleich(a, z, t, extern, jetzt);
    // Der gespeicherte interne Stand übernimmt, was der Kalender nach Feldregel führt — nie mehr.
    const gespeichert: KalenderZuordnung = {
      ...r.zuordnung,
      intern: { ...t, inhalt: { ...t.inhalt, ...r.uebernahme } },
    };
    try {
      await this.repo.speichere(gespeichert);
    } catch {
      return this.scheitere(z, "speicher_ausgefallen", jetzt);
    }
    if (r.laufWirkung !== "keine" || z.entscheidung !== gespeichert.entscheidung) {
      await this.meldeLauf(gespeichert);
    }
    return {
      ok: true,
      zuordnung: gespeichert,
      termin: extern,
      laufWirkung: r.laufWirkung,
      uebernahme: r.uebernahme,
    };
  }

  /**
   * AW17-K06/K08: verarbeitet externe Änderungen aller Zuordnungen EINER Anbindung — mit dem
   * zuletzt gespeicherten internen Stand. Ein Fehler betrifft nur seine Zuordnung.
   */
  async gleicheAlleAb(
    kontoId: string,
    anbindungId: string,
  ): Promise<
    { schluessel: string; ergebnis: Awaited<ReturnType<KalenderAnbindungDienst["gleicheAb"]>> }[]
  > {
    await this.anbindungUndAnbieter(kontoId, anbindungId);
    const alle = await this.repo.zuordnungen(
      kontoId,
      anbindungId,
      KALENDER_ZUORDNUNGEN_JE_ANBINDUNG_MAX,
    );
    const aus: {
      schluessel: string;
      ergebnis: Awaited<ReturnType<KalenderAnbindungDienst["gleicheAb"]>>;
    }[] = [];
    for (const z of alle) {
      if (!z.externeId && !z.sperrmarke) {
        continue;
      }
      const ergebnis = await this.gleicheAb(kontoId, anbindungId, z.intern);
      aus.push({ schluessel: z.schluessel, ergebnis });
    }
    return aus;
  }

  /** Die eigenen Anbindungen (Konto, Kalender, Umfang, Rechte, Feldregeln). */
  anbindungen(kontoId: string): Promise<KalenderAnbindung[]> {
    return this.repo.anbindungen(kontoId);
  }

  /** Die Zuordnungen einer eigenen Anbindung — für Anzeige von Stand, Sperre und Entscheidung. */
  async zuordnungen(kontoId: string, anbindungId: string): Promise<KalenderZuordnung[]> {
    await this.anbindungUndAnbieter(kontoId, anbindungId);
    return this.repo.zuordnungen(kontoId, anbindungId, KALENDER_ZUORDNUNGEN_JE_ANBINDUNG_MAX);
  }

  /** Eine eigene Zuordnung über ihren Schlüssel — samt dem gespeicherten internen Termin. */
  async zuordnung(kontoId: string, schluessel: string): Promise<KalenderZuordnung> {
    const z = await this.repo.zuordnung(kontoId, schluessel);
    if (!z) {
      // Fremd und unbekannt antworten gleich.
      throw new KalenderAnbindungFehler(404, "eingabe", "Keine Zuordnung zu diesem Termin.");
    }
    return z;
  }

  /**
   * Die dauerhafte Auskunft für den internen Scheduler: darf DIESER Lauf (Auftrag + Ereignis)
   * ausgeführt werden? Nur der betroffene Lauf ist pausiert bzw. beendet; alle anderen laufen.
   */
  async laufStand(kontoId: string, auftragId: string, ereignisId: string): Promise<LaufStand> {
    return laufStandAus(await this.repo.zuLauf(kontoId, auftragId, ereignisId));
  }

  /**
   * P07-AC05 · Die dauerhafte Sperre GENAU EINES Vorkommens (Auftrag + Ereignis bzw. Lauf), wie die
   * Erinnerungssteuerung sie unmittelbar vor jeder Wirkung abfragt. Sie steht in der Ablage — sie
   * gilt also über Neustart, Fälligkeit und verspäteten Abgleich hinweg, bis die Person ausdrücklich
   * entscheidet. Andere Vorkommen desselben Auftrags berührt eine Pause nicht. Nur eine ausdrücklich
   * für die SERIE gewählte Beendigung (P07-AC06, `sperrmarke.umfang = serie`) gilt für jedes Vorkommen
   * dieses Auftrags. Ist die Ablage nicht lesbar, wirft die Abfrage — die Steuerung wirkt dann nicht
   * (kein stilles „frei“).
   */
  async vorkommenSperre(
    kontoId: string,
    auftragId: string,
    ereignisId: string,
  ): Promise<VorkommenSperre> {
    const stand = await this.laufStand(kontoId, auftragId, ereignisId);
    if (stand !== "laeuft") {
      return stand;
    }
    const serieBeendet = (await this.repo.zuAuftrag(kontoId, auftragId)).some(
      (z) => z.sperrmarke?.grund === "beendet" && z.sperrmarke.umfang === "serie",
    );
    return serieBeendet ? "beendet" : "frei";
  }

  /** Meldet den gespeicherten Laufstand an den Scheduler-Anschluss, falls einer besteht. */
  private async meldeLauf(z: KalenderZuordnung): Promise<void> {
    if (!this.laufSteuerung) {
      return;
    }
    const stand = await this.laufStand(z.kontoId, z.auftragId, z.ereignisId);
    try {
      await this.laufSteuerung.melde(
        z.kontoId,
        z.auftragId,
        z.ereignisId,
        stand,
        z.sperrmarke?.umfang ?? "einzeltermin",
      );
    } catch {
      // Die Wirkung ist gespeichert; `vorkommenSperre` bleibt die verbindliche Auskunft, die die
      // Steuerung vor jeder Wirkung liest — ein verlorener Hinweis gibt nichts frei.
    }
  }

  /** Die ausdrückliche Entscheidung zu einem pausierten Termin. */
  async entscheide(
    kontoId: string,
    anbindungId: string,
    t: InternerTermin,
    eingabe: EntscheidungsEingabe,
    auftrag: ProjektionsAuftrag = {},
  ): Promise<{ laufWirkung: LaufWirkung; ergebnis: KalenderErgebnis }> {
    const jetzt = this.jetztIso();
    const { a } = await this.anbindungUndAnbieter(kontoId, anbindungId);
    const z = await this.repo.zuordnung(
      kontoId,
      zuordnungsSchluessel(kontoId, a.id, t.auftragId, t.ereignisId),
    );
    if (!z) {
      throw new KalenderAnbindungFehler(404, "eingabe", "Keine Zuordnung zu diesem Termin.");
    }
    const r = entscheide(z, eingabe, jetzt);
    try {
      await this.repo.speichere(r.zuordnung);
    } catch {
      // Die Entscheidung ist nicht gespeichert: der Lauf bleibt pausiert, nichts gilt als entschieden.
      const ergebnis = await this.scheitere(z, "speicher_ausgefallen", jetzt);
      return { laufWirkung: "pausiert", ergebnis };
    }
    await this.meldeLauf(r.zuordnung);
    if (!r.neuEintragen) {
      const ergebnis: KalenderErgebnis = { ok: true, zuordnung: r.zuordnung, termin: null };
      return { laufWirkung: r.laufWirkung, ergebnis };
    }
    const ergebnis = await this.projiziere(kontoId, anbindungId, t, auftrag);
    return { laufWirkung: r.laufWirkung, ergebnis };
  }
}

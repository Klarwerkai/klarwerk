import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import sharp from "sharp";
import type { Role } from "../../auth";

// ================================================================================================
// ADMIN-15 · UNTERNEHMENSPROFIL UND INTERNE RICHTLINIEN (produkt:20261009:admin-unternehmensprofil).
// ================================================================================================
//
// WAS DAS IST. Zwei getrennte, versionierte Bestände dieser Kundeninstanz:
//   · das UNTERNEHMENSPROFIL — Name, optionales Logo und EINE Akzentfarbe aus einer festen Auswahl.
//     Jede Änderung ist eine neue, unveränderliche Fassung; eine Korrektur übernimmt eine frühere
//     Fassung als neue Fassung (`uebernommenAus`), nichts wird überschrieben.
//   · die INTERNEN RICHTLINIEN — kundeneigene Texte mit Fassung, Datum, Verantwortlichkeit und
//     Geltung. Je Fassung steht fest, ob sie nur ANGEZEIGT wird, eine KENNTNISNAHME oder eine
//     ZUSTIMMUNG verlangt. Das Protokoll hält je Person die tatsächliche Handlung an genau der
//     Fassung fest, auf die sie sich bezog.
//
// WAS DAS AUSDRÜCKLICH NICHT IST:
//   · kein Theme-Editor. Die Akzentfarben sind eine feste, auf Kontrast geprüfte Liste
//     (`AKZENTE`); das Kopfband und die feste Markenwahl (`branding-settings.ts`) bleiben unberührt.
//   · kein Ersatz der rechtlichen Dokumente. Impressum und Datenschutzerklärung stehen weiter als
//     feste Texte in der Web-App (`apps/web/src/legal/LegalPages.tsx`); diese Datei kennt sie nicht.
//   · keine persönliche Einstellung. Sprache, Darstellung und Konto bleiben, wo sie sind.
//   · keine Löschfunktion für Handlungen. Die Ablage kennt für das Protokoll genau EINEN
//     Schreibweg (`handle`) und keinen Lösch- oder Überschreibweg.
//
// ANZEIGEN IST KEINE HANDLUNG. Der Leseweg der Richtlinien schreibt nichts. Eine Kenntnisnahme oder
// Zustimmung entsteht ausschliesslich über die ausdrückliche Aktion der Person selbst.
//
// ORGANISATION. Eine Kundeninstanz ist ein Datenraum (eigene Datenbank, eigene Sitzungen — dieselbe
// Regel wie im Firmenwörterbuch, `routes/begriffe-routes.ts`). Keine Route nimmt eine
// Organisationskennung vom Aufrufer entgegen; geschrieben wird ausschliesslich in die Ablage der
// eigenen App und nur mit `users.manage`.

// ================================================================================================
// FEHLER
// ================================================================================================

export class UnternehmenFehler extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "UnternehmenFehler";
  }
}

// ================================================================================================
// AKZENTFARBEN — EINE FESTE AUSWAHL, JEDE MIT GEPRÜFTEM KONTRAST
// ================================================================================================
//
// Jede Akzentfarbe ist ein Paar aus Fläche und Schrift. Mindestens 7:1 (WCAG AAA für normalen Text)
// wird nicht behauptet, sondern von `kontrastVerhaeltnis` gerechnet und im Test gegen jede Zeile
// gehalten. Eine neue Farbe kommt nur mit bestandenem Kontrast in diese Liste.
export const AKZENTE = {
  neutral: { flaeche: "#ffffff", schrift: "#1c1c1e" },
  nachtblau: { flaeche: "#1f3a5f", schrift: "#ffffff" },
  tannengruen: { flaeche: "#1e5631", schrift: "#ffffff" },
  aubergine: { flaeche: "#5b2a5e", schrift: "#ffffff" },
  anthrazit: { flaeche: "#33393f", schrift: "#ffffff" },
} as const satisfies Record<string, { flaeche: string; schrift: string }>;

export type AkzentId = keyof typeof AKZENTE;

export const MIN_KONTRAST = 7;

function istAkzent(wert: unknown): wert is AkzentId {
  return typeof wert === "string" && Object.hasOwn(AKZENTE, wert);
}

function relativeLeuchtdichte(hex: string): number {
  const kanal = (i: number): number => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(0) + 0.7152 * kanal(1) + 0.0722 * kanal(2);
}

/** Kontrastverhältnis nach WCAG 2.x, auf zwei Nachkommastellen gerundet. */
export function kontrastVerhaeltnis(a: string, b: string): number {
  const [hell, dunkel] = [relativeLeuchtdichte(a), relativeLeuchtdichte(b)].sort((x, y) => y - x);
  return Math.round((((hell ?? 0) + 0.05) / ((dunkel ?? 0) + 0.05)) * 100) / 100;
}

export interface AkzentAuskunft {
  id: AkzentId;
  flaeche: string;
  schrift: string;
  kontrast: number;
}

export function akzentListe(): AkzentAuskunft[] {
  return (Object.keys(AKZENTE) as AkzentId[]).map((id) => ({
    id,
    ...AKZENTE[id],
    kontrast: kontrastVerhaeltnis(AKZENTE[id].flaeche, AKZENTE[id].schrift),
  }));
}

// ================================================================================================
// LOGO — NUR PNG UND JPEG, GEPRÜFT AM INHALT UND NICHT AM DATEINAMEN
// ================================================================================================
//
// SVG wird abgewiesen: eine SVG-Datei kann Skripte und externe Verweise tragen, und das Logo wird
// jeder angemeldeten Person ausgeliefert. Der angegebene Typ muss zu den ersten Bytes passen; Masse
// und Seitenverhältnis kommen aus dem Dateikopf, damit ein winziges oder extrem schmales Bild nicht
// als „Logo" durchgeht, das im Kopf der Unternehmensseite unlesbar wäre.
export const LOGO_GRENZEN = {
  bytes: 200 * 1024,
  minKante: 32,
  maxKante: 4000,
  maxSeitenverhaeltnis: 8,
} as const;

export type LogoTyp = "image/png" | "image/jpeg";

export interface Logo {
  typ: LogoTyp;
  /** Base64 ohne `data:`-Vorsatz. */
  daten: string;
  breite: number;
  hoehe: number;
  bytes: number;
}

function pngMasse(b: Buffer): { breite: number; hoehe: number } | null {
  const signatur = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || signatur.some((x, i) => b[i] !== x)) {
    return null;
  }
  if (b.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }
  return { breite: b.readUInt32BE(16), hoehe: b.readUInt32BE(20) };
}

const JPEG_SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegMasse(b: Buffer): { breite: number; hoehe: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) {
    return null;
  }
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) {
      return null;
    }
    const marker = b[i + 1] ?? 0;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const laenge = b.readUInt16BE(i + 2);
    if (JPEG_SOF.has(marker)) {
      if (i + 8 >= b.length) {
        return null;
      }
      return { hoehe: b.readUInt16BE(i + 5), breite: b.readUInt16BE(i + 7) };
    }
    if (laenge < 2) {
      return null;
    }
    i += 2 + laenge;
  }
  return null;
}

/** Prüft ein eingehendes Logo `{ typ, daten }`; `null` heisst „kein Logo". */
export function pruefeLogo(roh: unknown): Logo | null {
  if (roh === null || roh === undefined) {
    return null;
  }
  if (typeof roh !== "object") {
    throw new UnternehmenFehler(400, "LOGO_UNGUELTIG", "Das Logo fehlt oder ist unvollständig.");
  }
  const { typ, daten } = roh as { typ?: unknown; daten?: unknown };
  if (typ !== "image/png" && typ !== "image/jpeg") {
    throw new UnternehmenFehler(
      400,
      "LOGO_TYP",
      "Als Logo sind nur PNG- oder JPEG-Dateien erlaubt. SVG und andere Formate werden abgewiesen, weil sie Skripte oder fremde Verweise enthalten können.",
      { erlaubt: ["image/png", "image/jpeg"] },
    );
  }
  if (typeof daten !== "string" || daten.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(daten)) {
    throw new UnternehmenFehler(400, "LOGO_INHALT", "Die Logodatei ist nicht lesbar.");
  }
  if (daten.length > Math.ceil((LOGO_GRENZEN.bytes * 4) / 3) + 4) {
    throw new UnternehmenFehler(
      400,
      "LOGO_ZU_GROSS",
      `Die Logodatei ist zu gross. Erlaubt sind höchstens ${LOGO_GRENZEN.bytes / 1024} KB.`,
      { maxBytes: LOGO_GRENZEN.bytes },
    );
  }
  const puffer = Buffer.from(daten, "base64");
  if (puffer.toString("base64") !== daten) {
    throw new UnternehmenFehler(400, "LOGO_INHALT", "Die Logodatei ist nicht lesbar.");
  }
  if (puffer.length > LOGO_GRENZEN.bytes) {
    throw new UnternehmenFehler(
      400,
      "LOGO_ZU_GROSS",
      `Die Logodatei ist zu gross. Erlaubt sind höchstens ${LOGO_GRENZEN.bytes / 1024} KB.`,
      { maxBytes: LOGO_GRENZEN.bytes },
    );
  }
  const masse = typ === "image/png" ? pngMasse(puffer) : jpegMasse(puffer);
  if (!masse) {
    throw new UnternehmenFehler(
      400,
      "LOGO_INHALT",
      "Der Inhalt der Datei passt nicht zum angegebenen Bildformat oder ist beschädigt.",
    );
  }
  const { breite, hoehe } = masse;
  if (
    breite < LOGO_GRENZEN.minKante ||
    hoehe < LOGO_GRENZEN.minKante ||
    breite > LOGO_GRENZEN.maxKante ||
    hoehe > LOGO_GRENZEN.maxKante
  ) {
    throw new UnternehmenFehler(
      400,
      "LOGO_MASSE",
      `Das Logo muss zwischen ${LOGO_GRENZEN.minKante} und ${LOGO_GRENZEN.maxKante} Pixel breit und hoch sein, sonst ist es nicht lesbar.`,
      { breite, hoehe },
    );
  }
  const verhaeltnis = Math.max(breite / hoehe, hoehe / breite);
  if (verhaeltnis > LOGO_GRENZEN.maxSeitenverhaeltnis) {
    throw new UnternehmenFehler(
      400,
      "LOGO_FORMAT",
      `Das Logo ist zu schmal oder zu lang (höchstens ${LOGO_GRENZEN.maxSeitenverhaeltnis}:1). In der Kopfzeile wäre es nicht lesbar.`,
      { breite, hoehe },
    );
  }
  return { typ, daten, breite, hoehe, bytes: puffer.length };
}

// ================================================================================================
// EIN HEILER DATEIKOPF IST KEIN DARSTELLBARES BILD (BEN, Nacharbeit 5).
// ================================================================================================
//
// `pruefeLogo` liest nur den Kopf: ein PNG aus Signatur und IHDR (24 Bytes) oder ein JPEG aus
// SOI, SOF und EOI nennt dort brav seine Masse — und wäre gespeichert worden, obwohl kein Browser
// es zeichnen kann. Deshalb wird das Logo vor dem Speichern WIRKLICH dekodiert, mit derselben
// Bibliothek und derselben strengen Einstellung wie die Bildableitung des Imports
// (`import/bildverkleinerung.ts`): `failOn: "warning"` lässt auch ein abgeschnittenes Bild
// scheitern. Der Speicher ist gedeckelt: höchstens 4000 × 4000 Pixel, die Datei höchstens 200 KB.
const DEKODIERUNG = {
  limitInputPixels: LOGO_GRENZEN.maxKante * LOGO_GRENZEN.maxKante,
  failOn: "warning",
} as const;

const LOGO_BESCHAEDIGT =
  "Die Logodatei ist unvollständig oder beschädigt und lässt sich nicht als Bild darstellen.";

/** Dekodiert ein von `pruefeLogo` angenommenes Logo vollständig; sonst `LOGO_INHALT`. */
export async function pruefeLogoDekodierbar(logo: Logo): Promise<void> {
  let breite = 0;
  let hoehe = 0;
  try {
    const { info } = await sharp(Buffer.from(logo.daten, "base64"), DEKODIERUNG)
      .raw()
      .toBuffer({ resolveWithObject: true });
    breite = info.width;
    hoehe = info.height;
  } catch {
    // Absichtlich ohne den Fehlertext der Bibliothek: er wäre englisch und technisch, und die
    // Unterscheidung, die hier zählt, ist getroffen — dieses Bild ist nicht darstellbar.
    throw new UnternehmenFehler(400, "LOGO_INHALT", LOGO_BESCHAEDIGT);
  }
  if (breite !== logo.breite || hoehe !== logo.hoehe) {
    throw new UnternehmenFehler(400, "LOGO_INHALT", LOGO_BESCHAEDIGT);
  }
}

// ================================================================================================
// DAS UNTERNEHMENSPROFIL
// ================================================================================================

export const NAME_GRENZEN = { min: 2, max: 80 } as const;
export const GRUND_MAX = 500;

export interface ProfilEingabe {
  name: string;
  logo: Logo | null;
  akzent: AkzentId;
}

export interface ProfilFassung extends ProfilEingabe {
  version: number;
  geaendertVon: string;
  geaendertAm: string;
  /** Begründung der Änderung — Pflicht, wenn eine frühere Fassung übernommen wird. */
  grund: string | null;
  /** Die Fassung, die als Vorlage dieser Korrektur übernommen wurde — sonst `null`. */
  uebernommenAus: number | null;
}

// Steuerzeichen ausser Zeilenumbruch, Wagenrücklauf und Tabulator — sie gehören weder in einen
// Namen noch in einen Richtlinientext und würden in der Anzeige unsichtbar werden.
function enthaeltSteuerzeichen(wert: string): boolean {
  for (const zeichen of wert) {
    const c = zeichen.codePointAt(0) ?? 0;
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) {
      return true;
    }
  }
  return false;
}

function text(
  roh: unknown,
  feld: string,
  code: string,
  grenzen: { min: number; max: number },
  einzeilig = true,
): string {
  if (typeof roh !== "string") {
    throw new UnternehmenFehler(400, code, `Das Feld „${feld}" fehlt.`, { feld });
  }
  const wert = roh.trim();
  if (wert.length < grenzen.min || wert.length > grenzen.max) {
    throw new UnternehmenFehler(
      400,
      code,
      `Das Feld „${feld}" muss zwischen ${grenzen.min} und ${grenzen.max} Zeichen lang sein.`,
      { feld, min: grenzen.min, max: grenzen.max },
    );
  }
  if (enthaeltSteuerzeichen(wert) || (einzeilig && /[\r\n]/.test(wert))) {
    throw new UnternehmenFehler(400, code, `Das Feld „${feld}" enthält unzulässige Zeichen.`, {
      feld,
    });
  }
  return wert;
}

export function pruefeProfilEingabe(roh: unknown): ProfilEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw new UnternehmenFehler(400, "PROFIL_UNGUELTIG", "Erwartet wird { name, logo, akzent }.");
  }
  const r = roh as Record<string, unknown>;
  const name = text(r.name, "Name", "NAME_UNGUELTIG", NAME_GRENZEN);
  if (!istAkzent(r.akzent)) {
    throw new UnternehmenFehler(
      400,
      "AKZENT_UNBEKANNT",
      "Diese Akzentfarbe gibt es nicht. Erlaubt ist nur eine der angebotenen, kontrastgeprüften Farben.",
      { erlaubt: Object.keys(AKZENTE) },
    );
  }
  return { name, logo: pruefeLogo(r.logo), akzent: r.akzent };
}

/** Was jede angemeldete Person über das Profil erfährt — ohne Bearbeiter und ohne Verlauf. */
export function profilAuskunft(f: ProfilFassung | undefined): {
  version: number;
  profil: {
    name: string;
    logo: { typ: LogoTyp; daten: string; breite: number; hoehe: number } | null;
    akzent: { id: AkzentId; flaeche: string; schrift: string };
  } | null;
} {
  if (!f) {
    return { version: 0, profil: null };
  }
  return {
    version: f.version,
    profil: {
      name: f.name,
      logo: f.logo
        ? { typ: f.logo.typ, daten: f.logo.daten, breite: f.logo.breite, hoehe: f.logo.hoehe }
        : null,
      akzent: { id: f.akzent, ...AKZENTE[f.akzent] },
    },
  };
}

// ================================================================================================
// INTERNE RICHTLINIEN
// ================================================================================================

export const ANFORDERUNGEN = ["anzeige", "kenntnisnahme", "zustimmung"] as const;
export type Anforderung = (typeof ANFORDERUNGEN)[number];
export type Handlungsart = Exclude<Anforderung, "anzeige">;

const ROLLEN: readonly Role[] = ["viewer", "experte", "controller", "admin"];

export const RICHTLINIE_GRENZEN = {
  titel: { min: 3, max: 120 },
  text: { min: 1, max: 20000 },
  verantwortlich: { min: 2, max: 120 },
  grund: { min: 3, max: GRUND_MAX },
} as const;

export interface RichtlinieEingabe {
  titel: string;
  text: string;
  /** Stelle oder Person, die für diese Fassung inhaltlich verantwortlich ist. */
  verantwortlich: string;
  /** Kalendertag `JJJJ-MM-TT`, ab dem die Fassung gilt. */
  gueltigAb: string;
  /** Für welche Rollen die Richtlinie gilt — leer heisst: für alle Konten. */
  rollen: Role[];
  anforderung: Anforderung;
}

export interface RichtlinienFassung extends RichtlinieEingabe {
  id: string;
  fassung: number;
  veroeffentlichtVon: string;
  veroeffentlichtAm: string;
  /** Warum es eine neue Fassung gibt — Pflicht ab Fassung 2. */
  aenderungsgrund: string | null;
}

export interface Handlung {
  richtlinieId: string;
  fassung: number;
  personId: string;
  handlung: Handlungsart;
  am: string;
}

function gueltigerTag(wert: unknown): string {
  if (typeof wert !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) {
    throw new UnternehmenFehler(
      400,
      "GELTUNG_UNGUELTIG",
      "Das Datum „Gültig ab“ fehlt oder ist kein Kalendertag.",
    );
  }
  const d = new Date(`${wert}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== wert) {
    throw new UnternehmenFehler(
      400,
      "GELTUNG_UNGUELTIG",
      "Das Datum „Gültig ab“ ist kein Kalendertag.",
    );
  }
  return wert;
}

export function pruefeAnforderung(roh: unknown): Anforderung {
  if (!(ANFORDERUNGEN as readonly unknown[]).includes(roh)) {
    throw new UnternehmenFehler(
      400,
      "ANFORDERUNG_UNGUELTIG",
      "Bitte festlegen, ob die Fassung nur angezeigt wird, eine Kenntnisnahme oder eine Zustimmung verlangt.",
      { erlaubt: ANFORDERUNGEN },
    );
  }
  return roh as Anforderung;
}

export function pruefeRollen(roh: unknown): Role[] {
  if (!Array.isArray(roh) || roh.some((r) => !(ROLLEN as readonly unknown[]).includes(r))) {
    throw new UnternehmenFehler(
      400,
      "GELTUNG_UNGUELTIG",
      "Die Geltung nennt eine unbekannte Rolle.",
      { erlaubt: ROLLEN },
    );
  }
  return ROLLEN.filter((r) => roh.includes(r));
}

export function pruefeRichtlinieEingabe(roh: unknown): RichtlinieEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw new UnternehmenFehler(400, "RICHTLINIE_UNGUELTIG", "Die Angaben zur Richtlinie fehlen.");
  }
  const r = roh as Record<string, unknown>;
  return {
    titel: text(r.titel, "Titel", "TITEL_UNGUELTIG", RICHTLINIE_GRENZEN.titel),
    text: text(r.text, "Text", "TEXT_UNGUELTIG", RICHTLINIE_GRENZEN.text, false),
    verantwortlich: text(
      r.verantwortlich,
      "Verantwortlich",
      "VERANTWORTLICH_UNGUELTIG",
      RICHTLINIE_GRENZEN.verantwortlich,
    ),
    gueltigAb: gueltigerTag(r.gueltigAb),
    rollen: pruefeRollen(r.rollen ?? []),
    anforderung: pruefeAnforderung(r.anforderung),
  };
}

export function pruefeGrund(roh: unknown): string {
  return text(roh, "Änderungsgrund", "GRUND_FEHLT", RICHTLINIE_GRENZEN.grund, false);
}

/** Gilt diese Fassung für ein Konto mit dieser Rolle? */
export function giltFuer(f: Pick<RichtlinieEingabe, "rollen">, rolle: Role): boolean {
  return f.rollen.length === 0 || f.rollen.includes(rolle);
}

export interface Konto {
  id: string;
  name: string;
  role: Role;
  approved: boolean;
}

/**
 * Die Wirkung einer neuen Fassung, BEVOR sie veröffentlicht wird.
 *
 * `verlangt` ist die Handlung, die die neue Fassung verlangt. Ist das Kenntnisnahme oder
 * Zustimmung, muss JEDE betroffene Person sie erneut leisten — eine Handlung gilt immer nur für die
 * Fassung, auf die sie sich bezog. `bisherigeHandlungen` zählt, was zur bisherigen Fassung
 * festgehalten ist: es bleibt im Protokoll, zählt für die neue Fassung aber nicht.
 */
export interface Wirkung {
  verlangt: Anforderung;
  erneut: boolean;
  betroffen: number;
  bisherigeFassung: number | null;
  bisherigeHandlungen: number;
}

export function berechneWirkung(eingabe: {
  bisher: RichtlinienFassung | undefined;
  anforderung: Anforderung;
  rollen: Role[];
  konten: readonly Konto[];
  handlungenBisher: readonly Handlung[];
}): Wirkung {
  const betroffen = eingabe.konten.filter(
    (k) => k.approved && giltFuer({ rollen: eingabe.rollen }, k.role),
  ).length;
  return {
    verlangt: eingabe.anforderung,
    erneut: eingabe.bisher !== undefined && eingabe.anforderung !== "anzeige",
    betroffen,
    bisherigeFassung: eingabe.bisher?.fassung ?? null,
    bisherigeHandlungen: eingabe.bisher
      ? eingabe.handlungenBisher.filter((h) => h.fassung === eingabe.bisher?.fassung).length
      : 0,
  };
}

// ================================================================================================
// DIE ABLAGE — FASSUNGEN UND HANDLUNGEN SIND UNVERÄNDERLICH
// ================================================================================================

export interface UnternehmenRepo {
  profilFassungen(): Promise<ProfilFassung[]>;
  /** `false`, wenn es diese Version schon gibt — dann hat jemand anders dazwischen geschrieben. */
  legeProfil(f: ProfilFassung): Promise<boolean>;
  /** Je Richtlinie alle Fassungen, aufsteigend. */
  richtlinien(): Promise<RichtlinienFassung[][]>;
  fassungen(id: string): Promise<RichtlinienFassung[]>;
  legeRichtlinie(f: RichtlinienFassung): Promise<boolean>;
  handlungen(richtlinieId: string): Promise<Handlung[]>;
  handlungenVon(personId: string): Promise<Handlung[]>;
  /**
   * Hält eine Handlung GENAU EINMAL fest. Eine Wiederholung ändert nichts und liefert den
   * gespeicherten Eintrag mit `neu: false`.
   */
  handle(h: Handlung): Promise<{ neu: boolean; eintrag: Handlung }>;
}

export class InMemoryUnternehmenRepo implements UnternehmenRepo {
  private readonly profil: ProfilFassung[] = [];
  private readonly richtlinienMap = new Map<string, RichtlinienFassung[]>();
  private readonly handlungsListe: Handlung[] = [];

  /**
   * `haltbarkeitZugesagt`: der Betrieb sagt Haltbarkeit zu (Desktop-Journal), diese Ablage kann sie
   * nicht halten — dann lehnt sie Schreibvorgänge ab, statt sie beim Neustart zu verlieren. Dieselbe
   * Regel wie `InMemoryKenntnisnahmeRepo`.
   */
  constructor(private readonly haltbarkeitZugesagt = false) {}

  private pruefeHaltbarkeit(): void {
    if (this.haltbarkeitZugesagt) {
      throw new UnternehmenFehler(
        503,
        "NICHT_HALTBAR",
        "Diese Instanz kann Profil und Richtlinien nicht dauerhaft ablegen.",
      );
    }
  }

  profilFassungen(): Promise<ProfilFassung[]> {
    return Promise.resolve(this.profil.map((f) => structuredClone(f)));
  }

  legeProfil(f: ProfilFassung): Promise<boolean> {
    this.pruefeHaltbarkeit();
    if (this.profil.some((x) => x.version === f.version)) {
      return Promise.resolve(false);
    }
    this.profil.push(structuredClone(f));
    this.profil.sort((a, b) => a.version - b.version);
    return Promise.resolve(true);
  }

  richtlinien(): Promise<RichtlinienFassung[][]> {
    return Promise.resolve(
      [...this.richtlinienMap.values()].map((liste) => liste.map((f) => structuredClone(f))),
    );
  }

  fassungen(id: string): Promise<RichtlinienFassung[]> {
    return Promise.resolve((this.richtlinienMap.get(id) ?? []).map((f) => structuredClone(f)));
  }

  legeRichtlinie(f: RichtlinienFassung): Promise<boolean> {
    this.pruefeHaltbarkeit();
    const liste = this.richtlinienMap.get(f.id) ?? [];
    if (liste.some((x) => x.fassung === f.fassung)) {
      return Promise.resolve(false);
    }
    liste.push(structuredClone(f));
    liste.sort((a, b) => a.fassung - b.fassung);
    this.richtlinienMap.set(f.id, liste);
    return Promise.resolve(true);
  }

  handlungen(richtlinieId: string): Promise<Handlung[]> {
    return Promise.resolve(
      this.handlungsListe.filter((h) => h.richtlinieId === richtlinieId).map((h) => ({ ...h })),
    );
  }

  handlungenVon(personId: string): Promise<Handlung[]> {
    return Promise.resolve(
      this.handlungsListe.filter((h) => h.personId === personId).map((h) => ({ ...h })),
    );
  }

  handle(h: Handlung): Promise<{ neu: boolean; eintrag: Handlung }> {
    this.pruefeHaltbarkeit();
    const vorhanden = this.handlungsListe.find(
      (x) =>
        x.richtlinieId === h.richtlinieId &&
        x.fassung === h.fassung &&
        x.personId === h.personId &&
        x.handlung === h.handlung,
    );
    if (vorhanden) {
      return Promise.resolve({ neu: false, eintrag: { ...vorhanden } });
    }
    this.handlungsListe.push({ ...h });
    return Promise.resolve({ neu: true, eintrag: { ...h } });
  }
}

/**
 * Drei Tabellen, REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE/INDEX IF NOT EXISTS`, kein DROP, kein
 * DELETE, kein UPDATE, kein Fremdschlüssel, keine Extension, kein Seed. Die zusammengesetzten
 * Primärschlüssel sind die Nebenläufigkeitsregel: zwei Schreiber derselben Fassung — einer gewinnt,
 * der andere bekommt `false` und damit 409; eine doppelte Handlung bleibt eine Zeile.
 */
export const UNTERNEHMEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS unternehmensprofil_fassungen (
  version integer PRIMARY KEY,
  data jsonb NOT NULL,
  geaendert_von text NOT NULL,
  geaendert_am timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS richtlinien_fassungen (
  richtlinie_id text NOT NULL,
  fassung integer NOT NULL,
  data jsonb NOT NULL,
  veroeffentlicht_von text NOT NULL,
  veroeffentlicht_am timestamptz NOT NULL,
  PRIMARY KEY (richtlinie_id, fassung)
);
CREATE TABLE IF NOT EXISTS richtlinien_handlungen (
  richtlinie_id text NOT NULL,
  fassung integer NOT NULL,
  person_id text NOT NULL,
  handlung text NOT NULL,
  am timestamptz NOT NULL,
  PRIMARY KEY (richtlinie_id, fassung, person_id, handlung)
);
CREATE INDEX IF NOT EXISTS richtlinien_handlungen_person ON richtlinien_handlungen (person_id);
`;

interface HandlungsZeile {
  richtlinie_id: string;
  fassung: number;
  person_id: string;
  handlung: Handlungsart;
  am: Date | string;
}

function handlungAus(z: HandlungsZeile): Handlung {
  return {
    richtlinieId: z.richtlinie_id,
    fassung: z.fassung,
    personId: z.person_id,
    handlung: z.handlung,
    am: z.am instanceof Date ? z.am.toISOString() : new Date(z.am).toISOString(),
  };
}

export class PgUnternehmenRepo implements UnternehmenRepo {
  constructor(private readonly pool: Pool) {}

  async profilFassungen(): Promise<ProfilFassung[]> {
    const res = await this.pool.query<{ data: ProfilFassung }>(
      "SELECT data FROM unternehmensprofil_fassungen ORDER BY version ASC",
    );
    return res.rows.map((z) => z.data);
  }

  async legeProfil(f: ProfilFassung): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO unternehmensprofil_fassungen(version, data, geaendert_von, geaendert_am)
       VALUES($1,$2,$3,$4)
       ON CONFLICT (version) DO NOTHING`,
      [f.version, JSON.stringify(f), f.geaendertVon, f.geaendertAm],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async richtlinien(): Promise<RichtlinienFassung[][]> {
    const res = await this.pool.query<{ data: RichtlinienFassung }>(
      "SELECT data FROM richtlinien_fassungen ORDER BY richtlinie_id, fassung ASC",
    );
    const nachId = new Map<string, RichtlinienFassung[]>();
    for (const { data } of res.rows) {
      nachId.set(data.id, [...(nachId.get(data.id) ?? []), data]);
    }
    return [...nachId.values()];
  }

  async fassungen(id: string): Promise<RichtlinienFassung[]> {
    const res = await this.pool.query<{ data: RichtlinienFassung }>(
      "SELECT data FROM richtlinien_fassungen WHERE richtlinie_id=$1 ORDER BY fassung ASC",
      [id],
    );
    return res.rows.map((z) => z.data);
  }

  async legeRichtlinie(f: RichtlinienFassung): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO richtlinien_fassungen(richtlinie_id, fassung, data, veroeffentlicht_von, veroeffentlicht_am)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (richtlinie_id, fassung) DO NOTHING`,
      [f.id, f.fassung, JSON.stringify(f), f.veroeffentlichtVon, f.veroeffentlichtAm],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async handlungen(richtlinieId: string): Promise<Handlung[]> {
    const res = await this.pool.query<HandlungsZeile>(
      `SELECT richtlinie_id, fassung, person_id, handlung, am FROM richtlinien_handlungen
        WHERE richtlinie_id=$1 ORDER BY am ASC, person_id ASC`,
      [richtlinieId],
    );
    return res.rows.map(handlungAus);
  }

  async handlungenVon(personId: string): Promise<Handlung[]> {
    const res = await this.pool.query<HandlungsZeile>(
      `SELECT richtlinie_id, fassung, person_id, handlung, am FROM richtlinien_handlungen
        WHERE person_id=$1 ORDER BY am ASC`,
      [personId],
    );
    return res.rows.map(handlungAus);
  }

  async handle(h: Handlung): Promise<{ neu: boolean; eintrag: Handlung }> {
    const res = await this.pool.query<HandlungsZeile>(
      `INSERT INTO richtlinien_handlungen(richtlinie_id, fassung, person_id, handlung, am)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (richtlinie_id, fassung, person_id, handlung) DO NOTHING
       RETURNING richtlinie_id, fassung, person_id, handlung, am`,
      [h.richtlinieId, h.fassung, h.personId, h.handlung, h.am],
    );
    const neu = res.rows[0];
    if (neu) {
      return { neu: true, eintrag: handlungAus(neu) };
    }
    const vorhanden = await this.pool.query<HandlungsZeile>(
      `SELECT richtlinie_id, fassung, person_id, handlung, am FROM richtlinien_handlungen
        WHERE richtlinie_id=$1 AND fassung=$2 AND person_id=$3 AND handlung=$4`,
      [h.richtlinieId, h.fassung, h.personId, h.handlung],
    );
    const zeile = vorhanden.rows[0];
    if (!zeile) {
      throw new Error("richtlinien_handlungen: Konflikt ohne vorhandene Zeile");
    }
    return { neu: false, eintrag: handlungAus(zeile) };
  }
}

// ================================================================================================
// DER DIENST — die fachlichen Regeln, die die Routen nur noch aufrufen
// ================================================================================================

export interface RichtlinieImUeberblick {
  aktuell: RichtlinienFassung;
  fassungen: RichtlinienFassung[];
  /** Zur AKTUELLEN Fassung: wie viele freigegebene Konten betroffen sind und wie viele gehandelt haben. */
  stand: { betroffen: number; erledigt: number };
}

export interface UnternehmenDienstDeps {
  repo: UnternehmenRepo;
  konten: () => Promise<readonly Konto[]>;
  jetzt?: () => Date;
}

export class UnternehmenDienst {
  private readonly jetzt: () => Date;

  constructor(private readonly deps: UnternehmenDienstDeps) {
    this.jetzt = deps.jetzt ?? (() => new Date());
  }

  /** Alle Profilfassungen, aufsteigend — frühere Fassungen bleiben vollständig lesbar. */
  profilFassungen(): Promise<ProfilFassung[]> {
    return this.deps.repo.profilFassungen();
  }

  async aktuellesProfil(): Promise<ProfilFassung | undefined> {
    const alle = await this.deps.repo.profilFassungen();
    return alle[alle.length - 1];
  }

  /**
   * Legt eine neue Profilfassung ab. `gesehen` ist die Version, die der Bearbeiter gesehen hat
   * (`0`: noch keine). Ist sie nicht mehr die jüngste, wird nichts geschrieben (409).
   */
  async speichereProfil(
    roh: unknown,
    von: string,
  ): Promise<{ vorher: ProfilFassung | undefined; nachher: ProfilFassung }> {
    const r = (typeof roh === "object" && roh !== null ? roh : {}) as Record<string, unknown>;
    const gesehen = r.version;
    if (typeof gesehen !== "number" || !Number.isInteger(gesehen) || gesehen < 0) {
      throw new UnternehmenFehler(
        400,
        "VERSION_FEHLT",
        "Die zuletzt gesehene Fassung des Profils fehlt.",
      );
    }
    const eingabe = pruefeProfilEingabe(roh);
    if (eingabe.logo) {
      await pruefeLogoDekodierbar(eingabe.logo);
    }
    const alle = await this.deps.repo.profilFassungen();
    const vorher = alle[alle.length - 1];
    let uebernommenAus: number | null = null;
    if (r.uebernommenAus !== undefined && r.uebernommenAus !== null) {
      if (!alle.some((f) => f.version === r.uebernommenAus)) {
        throw new UnternehmenFehler(
          404,
          "FASSUNG_UNBEKANNT",
          "Diese frühere Fassung gibt es nicht.",
        );
      }
      uebernommenAus = r.uebernommenAus as number;
    }
    const grund =
      uebernommenAus !== null
        ? pruefeGrund(r.grund)
        : typeof r.grund === "string" && r.grund.trim()
          ? pruefeGrund(r.grund)
          : null;
    const nachher: ProfilFassung = {
      ...eingabe,
      version: gesehen + 1,
      geaendertVon: von,
      geaendertAm: this.jetzt().toISOString(),
      grund,
      uebernommenAus,
    };
    const gelegt = gesehen === (vorher?.version ?? 0) && (await this.deps.repo.legeProfil(nachher));
    if (!gelegt) {
      throw new UnternehmenFehler(
        409,
        "VERSION_VERALTET",
        "Das Profil wurde inzwischen geändert. Bitte neu laden und die Änderung erneut vornehmen.",
        { aktuelleVersion: (await this.aktuellesProfil())?.version ?? 0 },
      );
    }
    return { vorher, nachher };
  }

  private async aktuelleRichtlinie(id: string): Promise<RichtlinienFassung | undefined> {
    const f = await this.deps.repo.fassungen(id);
    return f[f.length - 1];
  }

  async wirkung(roh: unknown): Promise<Wirkung> {
    const r = (typeof roh === "object" && roh !== null ? roh : {}) as Record<string, unknown>;
    const anforderung = pruefeAnforderung(r.anforderung);
    const rollen = pruefeRollen(r.rollen ?? []);
    let bisher: RichtlinienFassung | undefined;
    if (r.id !== undefined && r.id !== null) {
      bisher = typeof r.id === "string" ? await this.aktuelleRichtlinie(r.id) : undefined;
      if (!bisher) {
        throw new UnternehmenFehler(404, "NOT_FOUND", "Richtlinie nicht gefunden.");
      }
    }
    return berechneWirkung({
      bisher,
      anforderung,
      rollen,
      konten: await this.deps.konten(),
      handlungenBisher: bisher ? await this.deps.repo.handlungen(bisher.id) : [],
    });
  }

  /**
   * Veröffentlicht eine neue Richtlinie (`id` fehlt) oder eine neue Fassung. Die mitgesendete
   * `wirkung` ist die, die der Administrator VORHER gesehen hat; weicht die frisch berechnete in
   * `verlangt` oder `betroffen` ab, wird nichts veröffentlicht (409) — niemand veröffentlicht eine
   * Fassung mit einer Wirkung, die er nicht gesehen hat.
   */
  async veroeffentliche(
    id: string | null,
    roh: unknown,
    von: string,
  ): Promise<{ fassung: RichtlinienFassung; wirkung: Wirkung }> {
    const r = (typeof roh === "object" && roh !== null ? roh : {}) as Record<string, unknown>;
    const eingabe = pruefeRichtlinieEingabe(roh);
    const bisher = id === null ? undefined : await this.aktuelleRichtlinie(id);
    if (id !== null && !bisher) {
      throw new UnternehmenFehler(404, "NOT_FOUND", "Richtlinie nicht gefunden.");
    }
    let aenderungsgrund: string | null = null;
    if (bisher) {
      if (r.gesehen !== bisher.fassung) {
        throw new UnternehmenFehler(
          409,
          "VERSION_VERALTET",
          "Die Richtlinie wurde inzwischen geändert. Bitte neu laden.",
          { aktuelleFassung: bisher.fassung },
        );
      }
      aenderungsgrund = pruefeGrund(r.aenderungsgrund);
    }
    const wirkung = await this.wirkung({
      id,
      anforderung: eingabe.anforderung,
      rollen: eingabe.rollen,
    });
    const gesehen = r.wirkung as { verlangt?: unknown; betroffen?: unknown } | undefined;
    if (
      !gesehen ||
      gesehen.verlangt !== wirkung.verlangt ||
      gesehen.betroffen !== wirkung.betroffen
    ) {
      throw new UnternehmenFehler(
        409,
        "WIRKUNG_NICHT_BESTAETIGT",
        "Vor der Veröffentlichung muss die aktuelle Wirkung der Fassung angezeigt und bestätigt werden.",
        { wirkung },
      );
    }
    const fassung: RichtlinienFassung = {
      ...eingabe,
      id: bisher?.id ?? randomUUID(),
      fassung: (bisher?.fassung ?? 0) + 1,
      veroeffentlichtVon: von,
      veroeffentlichtAm: this.jetzt().toISOString(),
      aenderungsgrund,
    };
    if (!(await this.deps.repo.legeRichtlinie(fassung))) {
      throw new UnternehmenFehler(
        409,
        "VERSION_VERALTET",
        "Die Richtlinie wurde inzwischen geändert. Bitte neu laden.",
      );
    }
    return { fassung, wirkung };
  }

  /** Die Richtlinien, die für dieses Konto gelten, mit seiner eigenen Handlung zur aktuellen Fassung. */
  async fuerKonto(konto: { id: string; role: Role }): Promise<
    (RichtlinienFassung & { meineHandlung: Handlung | null })[]
  > {
    const eigene = await this.deps.repo.handlungenVon(konto.id);
    return (await this.deps.repo.richtlinien())
      .map((liste) => liste[liste.length - 1])
      .filter((f): f is RichtlinienFassung => f !== undefined && giltFuer(f, konto.role))
      .map((f) => ({
        ...f,
        meineHandlung:
          eigene.find((h) => h.richtlinieId === f.id && h.fassung === f.fassung) ?? null,
      }))
      .sort((a, b) => a.titel.localeCompare(b.titel) || a.id.localeCompare(b.id));
  }

  /**
   * Die ausdrückliche Handlung einer Person. Sie gilt GENAU der genannten Fassung; ist die nicht
   * mehr aktuell, wird nichts festgehalten (409). Die Handlung muss zu dem passen, was die Fassung
   * verlangt — eine reine Anzeigefassung nimmt keine Handlung an.
   */
  async handle(
    konto: { id: string; role: Role },
    richtlinieId: string,
    roh: unknown,
  ): Promise<{ neu: boolean; eintrag: Handlung }> {
    const aktuell = await this.aktuelleRichtlinie(richtlinieId);
    if (!aktuell || !giltFuer(aktuell, konto.role)) {
      throw new UnternehmenFehler(404, "NOT_FOUND", "Richtlinie nicht gefunden.");
    }
    const r = (typeof roh === "object" && roh !== null ? roh : {}) as Record<string, unknown>;
    if (r.fassung !== aktuell.fassung) {
      throw new UnternehmenFehler(
        409,
        "FASSUNG_VERALTET",
        "Diese Fassung ist nicht mehr aktuell. Bitte die aktuelle Fassung lesen.",
        { aktuelleFassung: aktuell.fassung },
      );
    }
    if (aktuell.anforderung === "anzeige" || r.handlung !== aktuell.anforderung) {
      throw new UnternehmenFehler(
        400,
        "HANDLUNG_UNPASSEND",
        "Diese Fassung verlangt keine solche Handlung.",
        { verlangt: aktuell.anforderung },
      );
    }
    return this.deps.repo.handle({
      richtlinieId,
      fassung: aktuell.fassung,
      personId: konto.id,
      handlung: aktuell.anforderung,
      am: this.jetzt().toISOString(),
    });
  }

  /** Verwaltung: jede Richtlinie mit allen Fassungen und dem Stand zur aktuellen Fassung. */
  async verwaltung(): Promise<RichtlinieImUeberblick[]> {
    const konten = await this.deps.konten();
    const raus: RichtlinieImUeberblick[] = [];
    for (const liste of await this.deps.repo.richtlinien()) {
      const aktuell = liste[liste.length - 1];
      if (!aktuell) {
        continue;
      }
      const geltend = konten.filter((k) => k.approved && giltFuer(aktuell, k.role));
      const handlungen = await this.deps.repo.handlungen(aktuell.id);
      const erledigt = new Set(
        handlungen
          .filter(
            (h) =>
              h.fassung === aktuell.fassung &&
              h.handlung === aktuell.anforderung &&
              geltend.some((k) => k.id === h.personId),
          )
          .map((h) => h.personId),
      ).size;
      raus.push({
        aktuell,
        fassungen: liste,
        stand: {
          betroffen: geltend.length,
          erledigt: aktuell.anforderung === "anzeige" ? 0 : erledigt,
        },
      });
    }
    return raus.sort((a, b) => a.aktuell.titel.localeCompare(b.aktuell.titel));
  }

  /** Das Protokoll einer Richtlinie über ALLE Fassungen — jede Zeile mit Person und Fassung. */
  async protokoll(richtlinieId: string): Promise<{
    fassungen: RichtlinienFassung[];
    eintraege: (Handlung & { personName: string })[];
  }> {
    const fassungen = await this.deps.repo.fassungen(richtlinieId);
    if (fassungen.length === 0) {
      throw new UnternehmenFehler(404, "NOT_FOUND", "Richtlinie nicht gefunden.");
    }
    const namen = new Map((await this.deps.konten()).map((k) => [k.id, k.name]));
    const eintraege = (await this.deps.repo.handlungen(richtlinieId))
      .map((h) => ({ ...h, personName: namen.get(h.personId) ?? h.personId }))
      .sort((a, b) => a.am.localeCompare(b.am) || a.personId.localeCompare(b.personId));
    return { fassungen, eintraege };
  }
}

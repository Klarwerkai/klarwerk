// ================================================================================================
// produkt:20261007:klara-erinnerungen-kalender (Klara 10 · AW-18) — DIE ZEITREGELN DER ERINNERUNGEN.
// ================================================================================================
//
// Reine Funktionen, keine Ablage, keine Uhr: was eine lokale Zeitangabe in einer IANA-Zeitzone als
// Zeitpunkt bedeutet, welche Vorkommen ein Zeitplan hat und wie eine relative Angabe („morgen um
// neun") gedeutet wird. Der Dienst (`klara-erinnerung.ts`) und die Steuerung rechnen ausschließlich
// hiermit — eine zweite Auslegung derselben Zeit gibt es nicht.
//
// SOMMERZEIT (AW18-K03, S09): Eine lokale Zeit kann in einer Zone FEHLEN (Europe/Berlin, 29.03.2026,
// 02:00–03:00) oder DOPPELT vorkommen (25.10.2026, 02:00–03:00). Beides wird nie still aufgelöst:
// `loeseLokal` meldet die Lage, und die an der Erinnerung gespeicherte Regel entscheidet sichtbar —
//   · Lücke:    `verschieben` (um die Länge der Lücke nach vorn: 02:30 → 03:30 MESZ) oder `auslassen`.
//   · Doppelt:  `erste` (früherer Zeitpunkt, Sommerzeit) oder `zweite` (späterer, Normalzeit).
// Es entsteht immer höchstens EIN Zeitpunkt je Vorkommen — kein stiller Doppeltermin.
//
// GANZTÄGIGE FRIST (AW18-K02): Eine Frist ist ein DATUM („YYYY-MM-DD") im Geltungsbereich der
// Zeitzone, keine UTC-Uhrzeit. Sie wird nie in einen Zeitpunkt umgerechnet und kann sich deshalb
// nicht um einen Tag verschieben. Nur der VORLAUF (Erinnerung n Tage vorher um hh:mm) wird zu einem
// Zeitpunkt; die Frist selbst bleibt unverändert (keine Fristverlängerung).

export type Wochentag = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LokaleZeit {
  /** Kalenderdatum in der Zone, `YYYY-MM-DD`. */
  readonly datum: string;
  /** Uhrzeit in der Zone, `HH:MM` (24 Stunden). */
  readonly uhrzeit: string;
}

export type LueckenRegel = "verschieben" | "auslassen";
export type DoppeltRegel = "erste" | "zweite";

export interface SommerzeitRegel {
  readonly luecke: LueckenRegel;
  readonly doppelt: DoppeltRegel;
}

export const SOMMERZEIT_VORGABE: SommerzeitRegel = { luecke: "verschieben", doppelt: "erste" };

export interface Wiederholung {
  readonly takt: "taeglich" | "woechentlich" | "monatlich";
  /** Jeder n-te Tag/Woche/Monat (1–52). */
  readonly intervall: number;
  /** Nur wöchentlich: die Wochentage (1 = Montag … 7 = Sonntag); leer = Wochentag des Beginns. */
  readonly wochentage: readonly Wochentag[];
  /** Serienende: letztes zulässiges Datum (einschließlich) — oder `null`. */
  readonly bis: string | null;
  /** Serienende: höchstens so viele Vorkommen — oder `null`. */
  readonly anzahl: number | null;
}

export type Zeitplan =
  | { readonly art: "einmalig"; readonly datum: string; readonly uhrzeit: string }
  | {
      readonly art: "serie";
      readonly datum: string;
      readonly uhrzeit: string;
      readonly wiederholung: Wiederholung;
    }
  | {
      readonly art: "frist";
      /** Die ganztägige Frist — ein Datum, nie ein Zeitpunkt. */
      readonly fristDatum: string;
      /** Erinnerung so viele Kalendertage vor der Frist (0 = am Fristtag). */
      readonly vorlaufTage: number;
      readonly uhrzeit: string;
    };

const DATUM_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UHRZEIT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TAG_MS = 86_400_000;

export function istDatum(wert: unknown): wert is string {
  if (typeof wert !== "string") {
    return false;
  }
  const m = DATUM_RE.exec(wert);
  if (!m) {
    return false;
  }
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === wert;
}

export function istUhrzeit(wert: unknown): wert is string {
  return typeof wert === "string" && UHRZEIT_RE.test(wert);
}

const formate = new Map<string, Intl.DateTimeFormat>();

function format(zone: string): Intl.DateTimeFormat {
  let f = formate.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formate.set(zone, f);
  }
  return f;
}

/** Eine IANA-Zeitzone, die die Laufzeit kennt (`Europe/Berlin`, `UTC`) — keine Abkürzung wie „MEZ". */
export function istZeitzone(wert: unknown): wert is string {
  if (typeof wert !== "string" || wert.length === 0 || wert.length > 64) {
    return false;
  }
  if (wert !== "UTC" && !wert.includes("/")) {
    return false;
  }
  try {
    format(wert);
    return true;
  } catch {
    return false;
  }
}

function teile(ms: number, zone: string): number[] {
  const werte: Record<string, number> = {};
  for (const t of format(zone).formatToParts(new Date(ms))) {
    if (t.type !== "literal") {
      werte[t.type] = Number(t.value);
    }
  }
  return [
    werte.year ?? 0,
    werte.month ?? 1,
    werte.day ?? 1,
    werte.hour ?? 0,
    werte.minute ?? 0,
    werte.second ?? 0,
  ];
}

/** Der Versatz der Zone gegen UTC zu diesem Zeitpunkt, in Minuten (Berlin im Sommer: 120). */
export function versatzMinuten(ms: number, zone: string): number {
  const [j, mo, t, h, mi, s] = teile(ms, zone) as [number, number, number, number, number, number];
  const alsUtc = Date.UTC(j, mo - 1, t, h, mi, s);
  return Math.round((alsUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

function zweistellig(n: number): string {
  return String(n).padStart(2, "0");
}

/** `+02:00` / `-05:00`. */
export function versatzText(minuten: number): string {
  const v = minuten < 0 ? "-" : "+";
  const a = Math.abs(minuten);
  return `${v}${zweistellig(Math.floor(a / 60))}:${zweistellig(a % 60)}`;
}

/** Datum und Uhrzeit eines Zeitpunkts in der Zone. */
export function lokalVon(ms: number, zone: string): LokaleZeit & { versatz: string } {
  const [j, mo, t, h, mi] = teile(ms, zone) as [number, number, number, number, number];
  return {
    datum: `${String(j).padStart(4, "0")}-${zweistellig(mo)}-${zweistellig(t)}`,
    uhrzeit: `${zweistellig(h)}:${zweistellig(mi)}`,
    versatz: versatzText(versatzMinuten(ms, zone)),
  };
}

function naivUtc(l: LokaleZeit): number {
  const [j, mo, t] = l.datum.split("-").map(Number) as [number, number, number];
  const [h, mi] = l.uhrzeit.split(":").map(Number) as [number, number];
  return Date.UTC(j, mo - 1, t, h, mi);
}

export type LokalLage =
  | { readonly art: "eindeutig"; readonly ms: number }
  /** Die lokale Zeit gibt es an diesem Tag nicht; `verschoben` = um die Lückenlänge nach vorn. */
  | { readonly art: "luecke"; readonly verschoben: number; readonly lueckeMinuten: number }
  /** Die lokale Zeit gibt es zweimal; `erste` < `zweite`. */
  | { readonly art: "doppelt"; readonly erste: number; readonly zweite: number };

/** Was eine lokale Zeit in der Zone bedeutet — ohne Regel, mit ehrlicher Lage. */
export function loeseLokal(l: LokaleZeit, zone: string): LokalLage {
  const naiv = naivUtc(l);
  const kandidaten = new Set<number>([
    versatzMinuten(naiv - TAG_MS, zone),
    versatzMinuten(naiv, zone),
    versatzMinuten(naiv + TAG_MS, zone),
  ]);
  const gueltig = [...kandidaten]
    .map((v) => naiv - v * 60_000)
    .filter((ms) => naivUtc(lokalVon(ms, zone)) === naiv)
    .sort((a, b) => a - b);
  const uniq = [...new Set(gueltig)];
  if (uniq.length >= 2) {
    return { art: "doppelt", erste: uniq[0] as number, zweite: uniq[uniq.length - 1] as number };
  }
  if (uniq.length === 1) {
    return { art: "eindeutig", ms: uniq[0] as number };
  }
  // Lücke: mit dem Versatz VOR dem Wechsel gelesen liegt der Zeitpunkt hinter der Lücke.
  const vorher = versatzMinuten(naiv - TAG_MS, zone);
  const nachher = versatzMinuten(naiv + TAG_MS, zone);
  return {
    art: "luecke",
    verschoben: naiv - vorher * 60_000,
    lueckeMinuten: Math.abs(nachher - vorher),
  };
}

export type ZeitHinweis =
  | "luecke_verschoben"
  | "luecke_ausgelassen"
  | "doppelt_erste"
  | "doppelt_zweite";

export interface Aufloesung {
  /** Der Zeitpunkt — oder `null`, wenn das Vorkommen nach der Regel ausgelassen wird. */
  readonly ms: number | null;
  readonly hinweis: ZeitHinweis | null;
}

/** Die lokale Zeit nach der gespeicherten Sommerzeitregel — höchstens EIN Zeitpunkt. */
export function loeseMitRegel(l: LokaleZeit, zone: string, regel: SommerzeitRegel): Aufloesung {
  const lage = loeseLokal(l, zone);
  if (lage.art === "eindeutig") {
    return { ms: lage.ms, hinweis: null };
  }
  if (lage.art === "luecke") {
    return regel.luecke === "verschieben"
      ? { ms: lage.verschoben, hinweis: "luecke_verschoben" }
      : { ms: null, hinweis: "luecke_ausgelassen" };
  }
  return regel.doppelt === "erste"
    ? { ms: lage.erste, hinweis: "doppelt_erste" }
    : { ms: lage.zweite, hinweis: "doppelt_zweite" };
}

// ------------------------------------------------------------------------------------------------
// Kalenderrechnung auf Datumszeichenketten (zonenfrei — ein Datum ist ein Datum).
// ------------------------------------------------------------------------------------------------

function tagZahl(datum: string): number {
  const [j, mo, t] = datum.split("-").map(Number) as [number, number, number];
  return Math.round(Date.UTC(j, mo - 1, t) / TAG_MS);
}

function datumAus(tag: number): string {
  return new Date(tag * TAG_MS).toISOString().slice(0, 10);
}

export function plusTage(datum: string, tage: number): string {
  return datumAus(tagZahl(datum) + tage);
}

/** 1 = Montag … 7 = Sonntag. */
export function wochentagVon(datum: string): Wochentag {
  const w = new Date(tagZahl(datum) * TAG_MS).getUTCDay();
  return (w === 0 ? 7 : w) as Wochentag;
}

function plusMonate(datum: string, monate: number, tagImMonat: number): string {
  const [j, mo] = datum.split("-").map(Number) as [number, number];
  const ziel = new Date(Date.UTC(j, mo - 1 + monate, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  // Monate ohne diesen Tag (31., 30., 29.): der letzte Tag des Monats — sichtbar im Zeitplan.
  ziel.setUTCDate(Math.min(tagImMonat, letzter));
  return ziel.toISOString().slice(0, 10);
}

/** Das Datum, an dem eine Frist-Erinnerung fällig ist: Frist minus Vorlauf. */
export function vorlaufDatum(fristDatum: string, vorlaufTage: number): string {
  return plusTage(fristDatum, -vorlaufTage);
}

export const VORKOMMEN_HOECHSTENS = 2_000;

/**
 * Die NOMINALEN Vorkommen eines Zeitplans in Reihenfolge (lokales Datum + Uhrzeit), höchstens
 * `grenze` Stück und höchstens `VORKOMMEN_HOECHSTENS`. Ein Vorkommen behält diese nominale Angabe
 * als Kennung, auch wenn es einzeln verschoben oder nach Sommerzeitregel umgelegt wird.
 */
export function* nominaleVorkommen(
  plan: Zeitplan,
  grenze = VORKOMMEN_HOECHSTENS,
): Generator<LokaleZeit> {
  const max = Math.min(grenze, VORKOMMEN_HOECHSTENS);
  if (plan.art === "einmalig") {
    if (max > 0) {
      yield { datum: plan.datum, uhrzeit: plan.uhrzeit };
    }
    return;
  }
  if (plan.art === "frist") {
    if (max > 0) {
      yield { datum: vorlaufDatum(plan.fristDatum, plan.vorlaufTage), uhrzeit: plan.uhrzeit };
    }
    return;
  }
  const w = plan.wiederholung;
  const anzahl = Math.min(max, w.anzahl ?? max);
  let erzeugt = 0;
  const imRahmen = (datum: string): boolean => w.bis === null || datum <= w.bis;
  if (w.takt === "taeglich") {
    for (let k = 0; erzeugt < anzahl; k += 1) {
      const datum = plusTage(plan.datum, k * w.intervall);
      if (!imRahmen(datum)) {
        return;
      }
      erzeugt += 1;
      yield { datum, uhrzeit: plan.uhrzeit };
    }
    return;
  }
  if (w.takt === "monatlich") {
    const tag = Number(plan.datum.slice(8, 10));
    for (let k = 0; erzeugt < anzahl; k += 1) {
      const datum = k === 0 ? plan.datum : plusMonate(plan.datum, k * w.intervall, tag);
      if (!imRahmen(datum)) {
        return;
      }
      erzeugt += 1;
      yield { datum, uhrzeit: plan.uhrzeit };
    }
    return;
  }
  // Wöchentlich: Wochen ab dem Montag der Startwoche, jede `intervall`-te; je Woche die Tage.
  const tage = (w.wochentage.length > 0 ? [...w.wochentage] : [wochentagVon(plan.datum)]).sort();
  const montag = plusTage(plan.datum, 1 - wochentagVon(plan.datum));
  for (let woche = 0; erzeugt < anzahl; woche += w.intervall) {
    for (const t of tage) {
      const datum = plusTage(montag, woche * 7 + (t - 1));
      if (datum < plan.datum) {
        continue;
      }
      if (!imRahmen(datum) || erzeugt >= anzahl) {
        return;
      }
      erzeugt += 1;
      yield { datum, uhrzeit: plan.uhrzeit };
    }
    if (woche > 52 * 50) {
      return;
    }
  }
}

/** Die Kennung eines Vorkommens: Erinnerung und NOMINALE lokale Zeit — stabil über Verschiebungen. */
export function vorkommenId(erinnerungId: string, l: LokaleZeit): string {
  return `${erinnerungId}@${l.datum}T${l.uhrzeit}`;
}

// ------------------------------------------------------------------------------------------------
// Relative und mehrdeutige Angaben (AW18-K02, „Morgen um neun erinnern").
// ------------------------------------------------------------------------------------------------

export type DeutungsGrund =
  | "nicht_erkannt"
  | "datum_fehlt"
  | "uhrzeit_fehlt"
  | "tageszeit_mehrdeutig"
  | "morgen_mehrdeutig"
  | "vergangen";

export type Deutung =
  | { readonly art: "eindeutig"; readonly datum: string; readonly uhrzeit: string }
  | {
      readonly art: "klaerung";
      readonly grund: DeutungsGrund;
      /** Die zur Wahl stehenden eindeutigen Angaben — leer, wenn ein Feld frei zu wählen ist. */
      readonly optionen: readonly LokaleZeit[];
    };

const ZAHLWOERTER: Record<string, number> = {
  null: 0,
  ein: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwoelf: 12,
};

const WOCHENTAGE: Record<string, Wochentag> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonntag: 7,
};

function normal(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function datumAusText(t: string, heute: string): { datum: string; morgenWort: boolean } | null {
  if (/\buebermorgen\b/.test(t)) {
    return { datum: plusTage(heute, 2), morgenWort: false };
  }
  // „morgen" als Tag — nicht „morgens" (Tageszeit) und nicht „übermorgen" (oben).
  if (/\bmorgen\b/.test(t) && !/\bheute morgen\b/.test(t)) {
    return { datum: plusTage(heute, 1), morgenWort: true };
  }
  if (/\bheute\b/.test(t)) {
    return { datum: heute, morgenWort: false };
  }
  const inTagen = /\bin (\d{1,3}) tagen?\b/.exec(t);
  if (inTagen) {
    return { datum: plusTage(heute, Number(inTagen[1])), morgenWort: false };
  }
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(t);
  if (iso && istDatum(iso[1])) {
    return { datum: iso[1] as string, morgenWort: false };
  }
  const de = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})?/.exec(t);
  if (de) {
    const jahr = de[3] ? Number(de[3]) : Number(heute.slice(0, 4));
    let datum = `${jahr}-${zweistellig(Number(de[2]))}-${zweistellig(Number(de[1]))}`;
    if (!istDatum(datum)) {
      return null;
    }
    if (!de[3] && datum < heute) {
      datum = `${jahr + 1}${datum.slice(4)}`;
    }
    return istDatum(datum) ? { datum, morgenWort: false } : null;
  }
  for (const [name, tag] of Object.entries(WOCHENTAGE)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      let abstand = (tag - wochentagVon(heute) + 7) % 7;
      if (abstand === 0) {
        abstand = 7;
      }
      return { datum: plusTage(heute, abstand), morgenWort: false };
    }
  }
  return null;
}

type Tageszeit = "vor" | "nach" | null;

function tageszeitAus(t: string): Tageszeit {
  if (/\b(morgens|frueh|vormittags|in der frueh)\b/.test(t)) {
    return "vor";
  }
  if (/\b(nachmittags|abends|am abend|am nachmittag|heute abend|nachts)\b/.test(t)) {
    return "nach";
  }
  return null;
}

function uhrzeitAus(t: string): { h: number; m: number; eindeutig: boolean } | null {
  // Sekunden und Bruchteile sind kein HH:MM; auch Fallbacks dürfen sie nicht abschneiden.
  if (/\d{1,2}:\d{2}(?::\d|[.,]\d)/u.test(t)) {
    return null;
  }
  // „9:30", „09:30 Uhr" — mit Punkt nur vor „Uhr", damit ein Datum („14.10.") keine Uhrzeit wird.
  const hhmm = /\b(\d{1,2}):(\d{2})(?:\s*uhr)?\b/.exec(t) ?? /\b(\d{1,2})\.(\d{2})\s*uhr\b/.exec(t);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    if (h <= 23 && m <= 59) {
      // „09:00" mit führender Null oder ab 13 Uhr ist eindeutig; „9:30" nicht.
      return { h, m, eindeutig: h >= 13 || h === 0 || (hhmm[1] as string).length === 2 };
    }
  }
  const ziffer = /\b(?:um\s+(\d{1,2})(?:\s*uhr)?|(\d{1,2})\s*uhr)\b/.exec(t);
  if (ziffer) {
    const h = Number(ziffer[1] ?? ziffer[2]);
    if (h <= 23) {
      return { h, m: 0, eindeutig: h >= 13 || h === 0 };
    }
  }
  const wort = /\bum\s+([a-z]+)(?:\s*uhr)?\b/.exec(t);
  if (wort && wort[1] !== undefined && ZAHLWOERTER[wort[1]] !== undefined) {
    const h = ZAHLWOERTER[wort[1]] as number;
    return { h, m: 0, eindeutig: h === 0 };
  }
  if (/\bmittags\b/.test(t)) {
    return { h: 12, m: 0, eindeutig: true };
  }
  return null;
}

function zeit(h: number, m: number): string {
  return `${zweistellig(h)}:${zweistellig(m)}`;
}

/**
 * Deutet eine gesprochene oder getippte Zeitangabe RELATIV zu `jetzt` in der Zone. Ergebnis ist
 * entweder eine eindeutige lokale Zeit oder eine Klärung mit den Möglichkeiten — eine Erinnerung
 * wird nie aus einer mehrdeutigen Angabe angelegt (die Anlage verlangt immer Datum UND Uhrzeit).
 */
export function deuteZeitangabe(text: string, jetzt: number, zone: string): Deutung {
  const t = normal(text);
  const jetztLokal = lokalVon(jetzt, zone);
  const heute = jetztLokal.datum;
  const d = datumAusText(t, heute);
  const u = uhrzeitAus(t);
  const tz = tageszeitAus(t);
  if (!d && !u) {
    return { art: "klaerung", grund: "nicht_erkannt", optionen: [] };
  }
  if (!d) {
    return { art: "klaerung", grund: "datum_fehlt", optionen: [] };
  }
  if (!u) {
    return { art: "klaerung", grund: "uhrzeit_fehlt", optionen: [] };
  }
  // Kurz nach Mitternacht kann „morgen" auch den heutigen Tag meinen.
  if (d.morgenWort && Number(jetztLokal.uhrzeit.slice(0, 2)) < 4) {
    const stunde = u.eindeutig || tz !== "nach" ? u.h : u.h + 12;
    return {
      art: "klaerung",
      grund: "morgen_mehrdeutig",
      optionen: [
        { datum: heute, uhrzeit: zeit(stunde, u.m) },
        { datum: d.datum, uhrzeit: zeit(stunde, u.m) },
      ],
    };
  }
  let stunde = u.h;
  if (!u.eindeutig) {
    if (tz === "vor") {
      stunde = u.h === 12 ? 0 : u.h;
    } else if (tz === "nach") {
      stunde = u.h < 12 ? u.h + 12 : u.h;
    } else if (u.h >= 1 && u.h <= 12) {
      const frueh = u.h === 12 ? 12 : u.h;
      const spaet = u.h === 12 ? 0 : u.h + 12;
      return {
        art: "klaerung",
        grund: "tageszeit_mehrdeutig",
        optionen: [
          { datum: d.datum, uhrzeit: zeit(frueh, u.m) },
          { datum: d.datum, uhrzeit: zeit(spaet, u.m) },
        ],
      };
    }
  }
  const ergebnis = { datum: d.datum, uhrzeit: zeit(stunde, u.m) };
  const ms = loeseMitRegel(ergebnis, zone, SOMMERZEIT_VORGABE).ms;
  if (ms !== null && ms <= jetzt) {
    return {
      art: "klaerung",
      grund: "vergangen",
      optionen: [{ datum: plusTage(ergebnis.datum, 1), uhrzeit: ergebnis.uhrzeit }],
    };
  }
  return { art: "eindeutig", ...ergebnis };
}

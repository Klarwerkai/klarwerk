// ================================================================================================
// R-1646 · AUSGANGSPRÜFUNG — DER TEXT, DER DAS WERK VERLASSEN WÜRDE, VOR DER FREIGABE SICHTBAR.
// ================================================================================================
//
// Herkunft (Roadmap 6.4, „Anonymisierungs-Vorschau"): „Vor jedem ausgehenden Aufruf zeigt KLARWERK
// exakt, welcher Text das Werk verlassen würde — mit hervorgehobenen Anonymisierungen. Der
// Controller gibt frei oder lehnt ab."
//
// WAS DIESE DATEI TUT:
//   1. `anonymisiereNachricht` ersetzt deterministisch E-Mail-Adressen, IBANs, Telefonnummern und
//      die Namen der Konten dieser Installation durch Platzhalter („[Person 1]"). Kein Modell, keine
//      Heuristik über Sprache — nur Muster und die bekannte Namensliste.
//   2. `Ausgangspruefung` hält jeden ausgehenden Aufruf an, bis ein Controller ihn freigibt oder
//      ablehnt. Gesendet wird danach GENAU der angezeigte, anonymisierte Text.
//   3. Die Antwort kommt zurück ins Haus; dort werden die Platzhalter wieder durch die Originale
//      ersetzt (`entanonymisiere`), damit Ergebnisse und Belegzitate zum eigenen Bestand passen.
//
// WO SIE WIRKT: ausschliesslich am Chokepoint `cappedModelClient` (`model-concurrency.ts`), und dort
// nur für Clients, die das Haus verlassen können (`rejectsConfidential`). Ein bestätigt lokaler
// Endpunkt überträgt nichts nach aussen und wird nicht angehalten.
//
// FAIL-CLOSED: Ablehnung, Ablauf der Wartezeit, volle Warteschlange und eine nicht lesbare
// Namensliste enden in `AusgangAbgelehntFehler` — es geht nichts hinaus. Die Reasoner-Kette fällt
// dann wie bei jedem anderen Modellfehler auf den nächsten Anbieter zurück (lokal/deterministisch).
//
// AUSGESCHALTET, bis der Betreiber sie einschaltet (`KLARWERK_AUSGANGSPRUEFUNG=an`). Ohne Schalter
// verhält sich der Chokepoint Zeichen für Zeichen wie zuvor.
//
// GRENZEN, BENANNT STATT VERSCHWIEGEN:
//   · Namen werden nur erkannt, wenn sie als Kontoname dieser Installation vorliegen und VOLL im Text
//     stehen. Fremde Namen, Nachnamen allein, Kundennamen und Firmennamen erkennt diese Fassung
//     nicht — die Vorschau ist genau dafür da, dass der Controller solche Reste sieht und ablehnt.
//   · Ein mitgesendetes Bild wird nicht anonymisiert. Die Vorschau sagt das ausdrücklich
//     (`bildUnveraendert`).
//   · Die Originale der ersetzten Stellen stehen NICHT in der Vorschau — sie bleiben im Prozess und
//     werden nur für die Rückübersetzung der Antwort benutzt.
import { randomUUID } from "node:crypto";

export type AnonymisierungsArt = "email" | "iban" | "telefon" | "person";

const PLATZHALTER_NAME: Readonly<Record<AnonymisierungsArt, string>> = {
  email: "E-Mail",
  iban: "IBAN",
  telefon: "Telefon",
  person: "Person",
};

/** Ein Stück des ausgehenden Textes. `ersetzt` gesetzt heisst: hier stand etwas anderes. */
export interface AusgangsAbschnitt {
  readonly text: string;
  readonly ersetzt: AnonymisierungsArt | null;
}

interface Fund {
  start: number;
  ende: number;
  art: AnonymisierungsArt;
}

// Grenzen über Buchstaben UND Ziffern aller Schriften — `\b` kennt nur ASCII.
const VOR = "(?<![\\p{L}\\p{N}])";
const NACH = "(?![\\p{L}\\p{N}])";

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
const IBAN = new RegExp(
  `${VOR}[A-Z]{2}\\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?${NACH}`,
  "gu",
);
const TELEFON = new RegExp(
  `${VOR}(?:(?:\\+|00)\\d{1,3}[ /.-]?(?:\\(0\\) ?)?|0)\\d{2,5}(?:[ /.-]?\\d{2,}){1,4}${NACH}`,
  "gu",
);
const MIN_TELEFON_ZIFFERN = 7;
const MIN_NAMENSLAENGE = 3;

function alleFunde(text: string, muster: RegExp, art: AnonymisierungsArt): Fund[] {
  const funde: Fund[] = [];
  for (const m of text.matchAll(new RegExp(muster.source, muster.flags))) {
    const wert = m[0];
    if (art === "iban") {
      const kompakt = wert.replace(/ /g, "").length;
      if (kompakt < 15 || kompakt > 34) {
        continue;
      }
    }
    if (art === "telefon" && (wert.match(/\d/g)?.length ?? 0) < MIN_TELEFON_ZIFFERN) {
      continue;
    }
    const start = m.index ?? 0;
    funde.push({ start, ende: start + wert.length, art });
  }
  return funde;
}

function maskiereRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function namensFunde(text: string, namen: readonly string[]): Fund[] {
  const funde: Fund[] = [];
  for (const roh of namen) {
    const name = roh.trim().replace(/\s+/g, " ");
    if (name.length < MIN_NAMENSLAENGE || !/\p{L}/u.test(name)) {
      continue;
    }
    // Leerraum im Namen trägt auch einen Zeilenumbruch oder ein doppeltes Leerzeichen im Text.
    const muster = maskiereRegex(name).replace(/ /g, "\\s+");
    funde.push(...alleFunde(text, new RegExp(`${VOR}${muster}${NACH}`, "giu"), "person"));
  }
  return funde;
}

/** Überlappungen auflösen: der früher beginnende, bei Gleichstand der längere Fund gewinnt. */
function ohneUeberlappung(funde: Fund[]): Fund[] {
  const sortiert = [...funde].sort((a, b) => a.start - b.start || b.ende - a.ende);
  const ergebnis: Fund[] = [];
  let bis = -1;
  for (const f of sortiert) {
    if (f.start >= bis) {
      ergebnis.push(f);
      bis = f.ende;
    }
  }
  return ergebnis;
}

/**
 * Die Ersetzungen EINES ausgehenden Aufrufs. Dasselbe Original bekommt in System- und Nutzerteil
 * denselben Platzhalter, damit der Empfänger Bezüge noch erkennen kann.
 */
class Zuordnung {
  private readonly nachOriginal = new Map<string, string>();
  private readonly zaehler: Record<AnonymisierungsArt, number> = {
    email: 0,
    iban: 0,
    telefon: 0,
    person: 0,
  };
  readonly nachPlatzhalter = new Map<string, string>();

  platzhalter(art: AnonymisierungsArt, original: string): string {
    const schluessel = `${art}\u0000${original.toLocaleLowerCase()}`;
    const vorhanden = this.nachOriginal.get(schluessel);
    if (vorhanden) {
      return vorhanden;
    }
    this.zaehler[art] += 1;
    const neu = `[${PLATZHALTER_NAME[art]} ${this.zaehler[art]}]`;
    this.nachOriginal.set(schluessel, neu);
    this.nachPlatzhalter.set(neu, original);
    return neu;
  }
}

function anonymisiereText(
  text: string,
  namen: readonly string[],
  zuordnung: Zuordnung,
): AusgangsAbschnitt[] {
  const funde = ohneUeberlappung([
    ...alleFunde(text, EMAIL, "email"),
    ...alleFunde(text, IBAN, "iban"),
    ...alleFunde(text, TELEFON, "telefon"),
    ...namensFunde(text, namen),
  ]);
  const abschnitte: AusgangsAbschnitt[] = [];
  let pos = 0;
  for (const f of funde) {
    if (f.start > pos) {
      abschnitte.push({ text: text.slice(pos, f.start), ersetzt: null });
    }
    abschnitte.push({
      text: zuordnung.platzhalter(f.art, text.slice(f.start, f.ende)),
      ersetzt: f.art,
    });
    pos = f.ende;
  }
  if (pos < text.length) {
    abschnitte.push({ text: text.slice(pos), ersetzt: null });
  }
  return abschnitte;
}

export function abschnitteAlsText(abschnitte: readonly AusgangsAbschnitt[]): string {
  return abschnitte.map((a) => a.text).join("");
}

export interface AnonymisierteNachricht {
  readonly system: readonly AusgangsAbschnitt[];
  readonly nutzer: readonly AusgangsAbschnitt[];
  /** Platzhalter → Original. Bleibt im Prozess; nie Teil einer Auskunft. */
  readonly zuordnung: ReadonlyMap<string, string>;
}

/** Anonymisiert System- und Nutzerteil eines Aufrufs mit EINER gemeinsamen Zuordnung. */
export function anonymisiereNachricht(
  nachricht: { system: string; user: string },
  namen: readonly string[] = [],
): AnonymisierteNachricht {
  const zuordnung = new Zuordnung();
  return {
    system: anonymisiereText(nachricht.system, namen, zuordnung),
    nutzer: anonymisiereText(nachricht.user, namen, zuordnung),
    zuordnung: zuordnung.nachPlatzhalter,
  };
}

/**
 * Setzt in der Antwort die Originale wieder ein. Ein Original mit `"` oder `\` bleibt Platzhalter:
 * die Antwort kann JSON sein, und ein ungeschütztes Anführungszeichen zerbräche sie.
 */
export function entanonymisiere(antwort: string, zuordnung: ReadonlyMap<string, string>): string {
  let ergebnis = antwort;
  for (const [platzhalter, original] of zuordnung) {
    if (/["\\]/.test(original)) {
      continue;
    }
    ergebnis = ergebnis.split(platzhalter).join(original);
  }
  return ergebnis;
}

// ------------------------------------------------------------------------------------------------
// DIE FREIGABE
// ------------------------------------------------------------------------------------------------

export type AusgangsAblehnungsgrund =
  | "abgelehnt"
  | "zeitlimit"
  | "warteschlange_voll"
  | "namen_nicht_verfuegbar";

const ABLEHNUNGS_SATZ: Readonly<Record<AusgangsAblehnungsgrund, string>> = {
  abgelehnt: "Der ausgehende Aufruf wurde in der Ausgangsprüfung abgelehnt.",
  zeitlimit: "Der ausgehende Aufruf wurde nicht rechtzeitig freigegeben und nicht gesendet.",
  warteschlange_voll:
    "Zu viele ausgehende Aufrufe warten auf Freigabe — dieser wurde nicht gesendet.",
  namen_nicht_verfuegbar:
    "Die Namensliste für die Anonymisierung war nicht lesbar — der Aufruf wurde nicht gesendet.",
};

/** Es geht nichts hinaus. KEIN Kapazitätssignal: die Kette darf auf den nächsten Anbieter gehen. */
export class AusgangAbgelehntFehler extends Error {
  readonly grund: AusgangsAblehnungsgrund;
  constructor(grund: AusgangsAblehnungsgrund) {
    super(ABLEHNUNGS_SATZ[grund]);
    this.name = "AusgangAbgelehntFehler";
    this.grund = grund;
  }
}

/** Was ein Controller zu einem wartenden Aufruf sieht — ohne die ersetzten Originale. */
export interface OffeneAusgangspruefung {
  readonly id: string;
  /** Der Client-Name des Empfängers, z. B. `cloud:openai:gpt-4o-mini` oder `anthropic:…`. */
  readonly anbieter: string;
  readonly erstelltAm: string;
  readonly laeuftAbAm: string;
  readonly system: readonly AusgangsAbschnitt[];
  readonly nutzer: readonly AusgangsAbschnitt[];
  /** Ein Bild geht unverändert mit — es wird nicht anonymisiert. */
  readonly bildUnveraendert: boolean;
  readonly ersetzungen: Readonly<Record<AnonymisierungsArt, number>>;
}

export type AusgangsEntscheidung = "freigegeben" | "abgelehnt";

export interface AusgangspruefungEinstellung {
  /** So lange wartet ein Aufruf auf die Entscheidung; danach wird er nicht gesendet. */
  readonly wartezeitMs: number;
  /** Höchstzahl gleichzeitig wartender Aufrufe; darüber wird sofort abgelehnt. */
  readonly maxOffen: number;
}

export interface AusgangspruefungOptionen extends AusgangspruefungEinstellung {
  /** Die Namen, die als Person ersetzt werden (Konten dieser Installation). */
  readonly namenQuelle?: () => Promise<readonly string[]> | readonly string[];
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
}

export interface FreigegebenerAusgang {
  readonly system: string;
  readonly user: string;
  readonly zuordnung: ReadonlyMap<string, string>;
}

interface Wartend {
  readonly auskunft: OffeneAusgangspruefung;
  readonly beende: (entscheidung: AusgangsEntscheidung) => void;
}

function zaehle(
  ...teile: ReadonlyArray<readonly AusgangsAbschnitt[]>
): Record<AnonymisierungsArt, number> {
  const anzahl: Record<AnonymisierungsArt, number> = { email: 0, iban: 0, telefon: 0, person: 0 };
  for (const teil of teile) {
    for (const a of teil) {
      if (a.ersetzt) {
        anzahl[a.ersetzt] += 1;
      }
    }
  }
  return anzahl;
}

export class Ausgangspruefung {
  readonly wartezeitMs: number;
  readonly maxOffen: number;
  private readonly namenQuelle: AusgangspruefungOptionen["namenQuelle"];
  private readonly jetzt: () => number;
  private readonly neueId: () => string;
  private readonly wartend = new Map<string, Wartend>();

  constructor(optionen: AusgangspruefungOptionen) {
    this.wartezeitMs = optionen.wartezeitMs;
    this.maxOffen = optionen.maxOffen;
    this.namenQuelle = optionen.namenQuelle;
    this.jetzt = optionen.jetzt ?? Date.now;
    this.neueId = optionen.neueId ?? randomUUID;
  }

  private async namen(): Promise<readonly string[]> {
    if (!this.namenQuelle) {
      return [];
    }
    try {
      return await this.namenQuelle();
    } catch {
      throw new AusgangAbgelehntFehler("namen_nicht_verfuegbar");
    }
  }

  /**
   * Hält einen ausgehenden Aufruf an, bis entschieden ist. Löst mit dem anonymisierten Text auf —
   * genau dem, der angezeigt wurde — oder wirft `AusgangAbgelehntFehler`.
   */
  async freigabeEinholen(eingang: {
    anbieter: string;
    system: string;
    user: string;
    bild: boolean;
  }): Promise<FreigegebenerAusgang> {
    if (this.wartend.size >= this.maxOffen) {
      throw new AusgangAbgelehntFehler("warteschlange_voll");
    }
    const namen = await this.namen();
    // Zweite Prüfung nach dem Warten auf die Namen: inzwischen kann die Schlange voll sein.
    if (this.wartend.size >= this.maxOffen) {
      throw new AusgangAbgelehntFehler("warteschlange_voll");
    }
    const anonym = anonymisiereNachricht({ system: eingang.system, user: eingang.user }, namen);
    const id = this.neueId();
    const start = this.jetzt();
    const auskunft: OffeneAusgangspruefung = {
      id,
      anbieter: eingang.anbieter,
      erstelltAm: new Date(start).toISOString(),
      laeuftAbAm: new Date(start + this.wartezeitMs).toISOString(),
      system: anonym.system,
      nutzer: anonym.nutzer,
      bildUnveraendert: eingang.bild,
      ersetzungen: zaehle(anonym.system, anonym.nutzer),
    };
    return new Promise<FreigegebenerAusgang>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.wartend.delete(id);
        reject(new AusgangAbgelehntFehler("zeitlimit"));
      }, this.wartezeitMs);
      // Der Timer darf den Prozess nicht am Leben halten (Node) — wie im Slot-Semaphor.
      if (typeof (timer as { unref?: () => void }).unref === "function") {
        (timer as { unref: () => void }).unref();
      }
      this.wartend.set(id, {
        auskunft,
        beende: (entscheidung) => {
          clearTimeout(timer);
          this.wartend.delete(id);
          if (entscheidung === "freigegeben") {
            resolve({
              system: abschnitteAlsText(anonym.system),
              user: abschnitteAlsText(anonym.nutzer),
              zuordnung: anonym.zuordnung,
            });
          } else {
            reject(new AusgangAbgelehntFehler("abgelehnt"));
          }
        },
      });
    });
  }

  /** Die wartenden Aufrufe, älteste zuerst. */
  offene(): OffeneAusgangspruefung[] {
    return [...this.wartend.values()]
      .map((w) => w.auskunft)
      .sort((a, b) => a.erstelltAm.localeCompare(b.erstelltAm));
  }

  /**
   * Entscheidet einen wartenden Aufruf. `null`: kein solcher Aufruf (schon entschieden oder
   * abgelaufen) — dann ändert sich nichts.
   */
  entscheide(id: string, entscheidung: AusgangsEntscheidung): OffeneAusgangspruefung | null {
    const w = this.wartend.get(id);
    if (!w) {
      return null;
    }
    w.beende(entscheidung);
    return w.auskunft;
  }
}

// ------------------------------------------------------------------------------------------------
// DER EINE AKTIVE PRÜFER DES PROZESSES — gelesen ausschliesslich am Chokepoint.
// ------------------------------------------------------------------------------------------------

let aktiv: Ausgangspruefung | null = null;

export function setzeAusgangspruefung(pruefung: Ausgangspruefung | null): void {
  aktiv = pruefung;
}

export function aktiveAusgangspruefung(): Ausgangspruefung | null {
  return aktiv;
}

export const AUSGANGSPRUEFUNG_ENV = "KLARWERK_AUSGANGSPRUEFUNG";
const WARTEZEIT_ENV = "KLARWERK_AUSGANGSPRUEFUNG_WARTEZEIT_MS";
const MAX_OFFEN_ENV = "KLARWERK_AUSGANGSPRUEFUNG_MAX_OFFEN";
const WARTEZEIT_VORGABE_MS = 5 * 60 * 1000;
const MAX_OFFEN_VORGABE = 20;

function positiv(roh: string | undefined, vorgabe: number): number {
  const n = Number(roh);
  return Number.isInteger(n) && n > 0 ? n : vorgabe;
}

/** `an`, `1`, `true` schalten ein; alles andere (auch „fehlt") lässt die Prüfung aus. */
export function ausgangspruefungAusEnv(
  env: Record<string, string | undefined> = process.env,
): AusgangspruefungEinstellung | null {
  const schalter = env[AUSGANGSPRUEFUNG_ENV]?.trim().toLowerCase();
  if (schalter !== "an" && schalter !== "1" && schalter !== "true") {
    return null;
  }
  return {
    wartezeitMs: positiv(env[WARTEZEIT_ENV], WARTEZEIT_VORGABE_MS),
    maxOffen: positiv(env[MAX_OFFEN_ENV], MAX_OFFEN_VORGABE),
  };
}

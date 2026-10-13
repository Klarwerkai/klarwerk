import type { Pool } from "pg";
import type { KostenReservierung, Kostenbuch } from "./assistenz-faehigkeiten";

// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin — DIE PRODUKTBUDGETS FÜR CLAUDE, CHATGPT UND
// PERPLEXITY, EINSTELLBAR IM VORHANDENEN PRODUKT.
// ================================================================================================
//
// KEINE ZWEITE KOSTENVERWALTUNG (PBE-01). Diese Datei ist die persistente Fassung des Kostenbuchs,
// das die Fähigkeitsausführung seit BPA-11 als Schnittstelle kennt (`Kostenbuch`, G18) — bis hierher
// gab es dafür keine Ablage, und jede kostenpflichtige Fähigkeit blieb mangels Budget gesperrt. Hier
// liegen je Budgetbereich die Einstellung (Betrag, Währung, Zeitraum), die Buchungen und die
// Änderungsprovenienz. Anbieterzugang, Anbieterfreigabe und Modellwahl bleiben, wo sie sind.
//
// DIE BEREICHE SIND FEST, NICHT FREI ANLEGBAR. Peters Vorgaben vom 13.10.2026:
//   · `perplexity-poc` — 20 EUR für Perplexity im PoC. Ersetzt die frühere Produktbudgetempfehlung
//     30 USD/Monat für diesen PoC (PBE-03). Einmalig, ohne Erneuerung.
//   · `nr32-claude`, `nr32-chatgpt` — je 20 EUR für Claude und ChatGPT (PBE-04). Peter hat am
//     13.10.2026 die Aufteilung bestätigt (PBE-12): je 20 EUR als EINMALIGES PoC-Gesamtbudget, ohne
//     Erneuerung durch Monatswechsel, Neustart oder einen anderen Prozess. Gespeicherte Stände, die
//     diese Bereiche noch mit Zeitraum `offen` führen, werden einmal nachvollziehbar übernommen
//     (`uebernehmeGesamtperiode`) — Betrag, Buchungen und Provenienz bleiben.
//
// ANWENDER-UNTERLIMITS (PBE-12): Die Verwaltung kann je Bereich und Konto eine Zuweisung setzen;
// ohne sie gilt für das Konto der Gesamtdeckel. Innerhalb dieser Zuweisung setzt jedes Konto sein
// eigenes Unterlimit. Die Kostenprüfung (`reserviere`) hält Unterlimit, Zuweisung und Gesamtdeckel
// GEMEINSAM ein. Den Gesamtbetrag und die Zuweisungen ändert nur die Verwaltung (`users.manage`).
//
// WAS EINE ÄNDERUNG NICHT IST (PBE-02): keine Anbieteraufladung, keine Kontoumstellung, keine neue
// Tokenfreigabe. Sie ändert Betrag, Währung oder Zeitraum DIESES Bereichs — sonst nichts. Buchungen
// bleiben bei jeder Änderung unverändert stehen (PBE-06); es gibt keinen Weg, sie zu löschen oder
// zurückzusetzen.
//
// GELD IST GANZZAHLIG (PBE-07): Beträge in Cent, nie als Gleitkommazahl gerechnet. Eingaben kommen als
// Text („20", „20,50", „20.5") und werden zeichenweise in Cent übersetzt.

/** Die Kennung des Budgetbereichs — zugleich die `kostenzuordnung` eines Fähigkeitsvertrags. */
export type BudgetBereichId = "perplexity-poc" | "nr32-claude" | "nr32-chatgpt";

/** Die Anbieterkennung — dieselbe wie `Datenempfaenger.anbieter` bzw. die Reasoner-Wahl. */
export type BudgetAnbieter = "perplexity" | "anthropic" | "openai";

export const BUDGET_WAEHRUNGEN = ["EUR", "USD"] as const;
export type BudgetWaehrung = (typeof BUDGET_WAEHRUNGEN)[number];

/**
 * `einmalig`: der Betrag gilt einmal für den ganzen Geltungsbereich, ohne Erneuerung und ohne
 * Zählerrücksetzung. `offen`: Aufteilung/Zeitraum sind nicht geklärt — dann gibt es keinen
 * Kostenweg. Einen monatlichen Zeitraum gibt es bewusst nicht: das Produkt hat keine Erneuerung,
 * und ein Wort „monatlich" ohne Erneuerung wäre eine falsche Zusage.
 */
export const BUDGET_ZEITRAEUME = ["einmalig", "offen"] as const;
export type BudgetZeitraum = (typeof BUDGET_ZEITRAEUME)[number];

export interface BudgetVorgabe {
  readonly id: BudgetBereichId;
  readonly anbieter: BudgetAnbieter;
  /** Das ursprüngliche Original, an das dieser Bereich anschließt (PBE-09). */
  readonly original: string;
  readonly betragCent: number;
  readonly waehrung: BudgetWaehrung;
  readonly zeitraum: BudgetZeitraum;
  /** Die durch diese Vorgabe abgelöste frühere Empfehlung — nur zur Anzeige, nie wirksam. */
  readonly abgeloest: { readonly betragCent: number; readonly waehrung: BudgetWaehrung } | null;
}

export const BUDGET_VORGABEN: readonly BudgetVorgabe[] = [
  {
    id: "perplexity-poc",
    anbieter: "perplexity",
    original: "produkt:20261011:assistenz-recherche-perplexity",
    betragCent: 2000,
    waehrung: "EUR",
    zeitraum: "einmalig",
    abgeloest: { betragCent: 3000, waehrung: "USD" },
  },
  {
    id: "nr32-claude",
    anbieter: "anthropic",
    original: "produkt:20261011:peter-p03",
    betragCent: 2000,
    waehrung: "EUR",
    zeitraum: "einmalig",
    abgeloest: null,
  },
  {
    id: "nr32-chatgpt",
    anbieter: "openai",
    original: "produkt:20261011:peter-p03",
    betragCent: 2000,
    waehrung: "EUR",
    zeitraum: "einmalig",
    abgeloest: null,
  },
];

/** Kennung der Übernahme von Peters bestätigter Gesamtperiode (PBE-12) — einmal je Stand. */
export const UEBERNAHME_GESAMTPERIODE = "pbe12-gesamtperiode-20261013";
/** Wer die Übernahme im Änderungsvermerk trägt — eine Vorgabe, kein Konto. */
export const VORGABE_PETER_20261013 = "vorgabe:peter-20261013";
const GRUND_GESAMTPERIODE =
  "Peter, 13.10.2026: je 20 EUR für Claude, ChatGPT und Perplexity als einmaliges PoC-Gesamtbudget bestätigt.";

/** Höchster einstellbarer Betrag je Bereich: 10 000,00 in der Währung des Bereichs. */
export const BUDGET_MAX_CENT = 1_000_000;

// ------------------------------------------------------------------------------------------------
// DER GESPEICHERTE STAND
// ------------------------------------------------------------------------------------------------

export interface BudgetEinstellung {
  readonly bereich: BudgetBereichId;
  readonly betragCent: number;
  readonly waehrung: BudgetWaehrung;
  readonly zeitraum: BudgetZeitraum;
  /** Fassung DIESER Einstellung; 0 = die Originalvorgabe, noch nie geändert. */
  readonly fassung: number;
  readonly geaendertAm: string | null;
  /** Kontokennung der ändernden Person — nie ein Name, Schlüssel oder Token. */
  readonly geaendertVon: string | null;
}

/**
 * Eine Buchung gegen einen Bereich. `reserviert`: vor einem kostenpflichtigen Aufruf gegen den
 * Deckel gesperrt; `verbucht`: tatsächlich angefallen. Beide zählen gegen den Deckel. Je
 * AUSFÜHRUNG (Konto, Auftragskennung, Versuch) höchstens eine Buchung — dieselbe Ausführung bucht
 * nicht doppelt, jeder weitere kostenwirksame Versuch und jedes andere Konto zählt eigens.
 */
export interface BudgetBuchung {
  /** Konto der Ausführung; `null` bei einer Buchung ohne Fähigkeitsauftrag (z. B. direkter Weg). */
  readonly nutzer?: string | null;
  readonly auftragId: string;
  /** Versuch der Ausführung; `null` wie bei `nutzer`. */
  readonly versuch?: number | null;
  readonly art: "reserviert" | "verbucht";
  readonly cent: number;
  readonly waehrung: BudgetWaehrung;
  readonly am: string;
}

export interface BudgetWerte {
  readonly betragCent: number;
  readonly waehrung: BudgetWaehrung;
  readonly zeitraum: BudgetZeitraum;
}

/** Ein Eintrag der Änderungsprovenienz — Kennungen und Werte, keine Geheimnisse. */
export interface BudgetAenderung {
  readonly aenderungId: string;
  readonly bereich: BudgetBereichId;
  readonly am: string;
  readonly von: string;
  readonly vorher: BudgetWerte;
  readonly nachher: BudgetWerte;
  readonly grund: string | null;
  /** Die Fassung, auf die sich die Änderung bezog — Teil der Wiederholungsprüfung. */
  readonly basisFassung?: number;
}

/**
 * Die Grenzen EINES Kontos in einem Bereich (PBE-12). `zuweisungCent` setzt die Verwaltung —
 * `null`: keine eigene Zuweisung, es gilt der Gesamtdeckel. `unterlimitCent` setzt das Konto selbst,
 * höchstens bis zur Zuweisung — `null`: kein eigenes Unterlimit.
 */
export interface KontoGrenze {
  readonly zuweisungCent: number | null;
  readonly unterlimitCent: number | null;
  /** Fassung dieser Kontogrenze; schützt vor stillem Überschreiben. */
  readonly fassung: number;
  readonly geaendertAm: string | null;
  readonly geaendertVon: string | null;
}

/** Vermerk einer Zuweisungs- oder Unterlimitänderung — Kennungen und Beträge, keine Geheimnisse. */
export interface GrenzAenderung {
  readonly art: "zuweisung" | "unterlimit";
  readonly bereich: BudgetBereichId;
  readonly konto: string;
  readonly am: string;
  readonly von: string;
  readonly vorherCent: number | null;
  readonly nachherCent: number | null;
}

export interface ProduktbudgetStand {
  readonly einstellungen: readonly BudgetEinstellung[];
  readonly buchungen: Readonly<Record<string, readonly BudgetBuchung[]>>;
  readonly aenderungen: readonly BudgetAenderung[];
  /** Je Bereich, je Konto: Zuweisung und Unterlimit (PBE-12). Fehlt bei älteren Ständen. */
  readonly konten?: Readonly<Record<string, Readonly<Record<string, KontoGrenze>>>>;
  readonly grenzAenderungen?: readonly GrenzAenderung[];
  /** Bereits angewandte Übernahmen bestätigter Vorgaben (z. B. `UEBERNAHME_GESAMTPERIODE`). */
  readonly uebernahmen?: readonly string[];
}

/** Höchstzahl gespeicherter Provenienzeinträge; ältere fallen weg, Buchungen nie. */
const MAX_AENDERUNGEN = 200;

/** Die Grenze eines Kontos — nur eigene Einträge, nie ein geerbter Objektschlüssel. */
function kontoGrenze(
  stand: ProduktbudgetStand,
  bereich: string,
  konto: string,
): KontoGrenze | null {
  const konten = stand.konten;
  const jeBereich = konten && Object.hasOwn(konten, bereich) ? konten[bereich] : null;
  return jeBereich && Object.hasOwn(jeBereich, konto) ? (jeBereich[konto] ?? null) : null;
}

/** Was ein Konto in einem Bereich schon belegt (verbucht + reserviert). */
function belegtVonKonto(stand: ProduktbudgetStand, bereich: string, konto: string): number {
  return (stand.buchungen[bereich] ?? [])
    .filter((b) => b.nutzer === konto)
    .reduce((s, b) => s + b.cent, 0);
}

/**
 * Die wirksame Kontogrenze: das kleinere aus Zuweisung und Unterlimit — `null`, wenn keins gesetzt
 * ist (dann gilt nur der Gesamtdeckel).
 */
function wirksameKontogrenze(g: KontoGrenze | null): number | null {
  const werte = [g?.zuweisungCent ?? null, g?.unterlimitCent ?? null].filter(
    (w): w is number => w !== null,
  );
  return werte.length === 0 ? null : Math.min(...werte);
}

/**
 * PBE-12: Peters bestätigte einmalige Gesamtperiode für einen gespeicherten Stand übernehmen —
 * GENAU EINMAL (Kennung in `uebernahmen`). Claude/ChatGPT-Bereiche mit Zeitraum `offen` werden
 * `einmalig`; Betrag, Währung, Buchungen und Provenienz bleiben, die Übernahme steht als eigener
 * Änderungsvermerk da. Eine spätere bewusste Änderung durch die Verwaltung (auch zurück auf `offen`)
 * wird danach nie wieder überschrieben. `null`: nichts zu tun.
 */
export function uebernehmeGesamtperiode(
  stand: ProduktbudgetStand,
  am: string,
): ProduktbudgetStand | null {
  if (stand.uebernahmen?.includes(UEBERNAHME_GESAMTPERIODE)) {
    return null;
  }
  const neu: BudgetAenderung[] = [];
  const einstellungen = stand.einstellungen.map((e) => {
    if ((e.bereich !== "nr32-claude" && e.bereich !== "nr32-chatgpt") || e.zeitraum !== "offen") {
      return e;
    }
    neu.push({
      aenderungId: `${UEBERNAHME_GESAMTPERIODE}:${e.bereich}`,
      bereich: e.bereich,
      am,
      von: VORGABE_PETER_20261013,
      vorher: { betragCent: e.betragCent, waehrung: e.waehrung, zeitraum: e.zeitraum },
      nachher: { betragCent: e.betragCent, waehrung: e.waehrung, zeitraum: "einmalig" },
      grund: GRUND_GESAMTPERIODE,
      basisFassung: e.fassung,
    });
    return {
      ...e,
      zeitraum: "einmalig" as const,
      fassung: e.fassung + 1,
      geaendertAm: am,
      geaendertVon: VORGABE_PETER_20261013,
    };
  });
  return {
    ...stand,
    einstellungen,
    // Buchungen und Reservierungen unverändert — die Übernahme bucht, löscht und erneuert nichts.
    buchungen: stand.buchungen,
    aenderungen: [...stand.aenderungen, ...neu].slice(-MAX_AENDERUNGEN),
    uebernahmen: [...(stand.uebernahmen ?? []), UEBERNAHME_GESAMTPERIODE],
  };
}

function vorgabeStand(): ProduktbudgetStand {
  return {
    einstellungen: BUDGET_VORGABEN.map((v) => ({
      bereich: v.id,
      betragCent: v.betragCent,
      waehrung: v.waehrung,
      zeitraum: v.zeitraum,
      fassung: 0,
      geaendertAm: null,
      geaendertVon: null,
    })),
    buchungen: {},
    aenderungen: [],
    // Die Vorgaben tragen Peters bestätigte Gesamtperiode bereits — es gibt nichts zu übernehmen.
    uebernahmen: [UEBERNAHME_GESAMTPERIODE],
  };
}

/** Ergänzt einen gespeicherten Stand um Bereiche, die nach seiner Speicherung hinzukamen. */
function vervollstaendige(stand: ProduktbudgetStand): ProduktbudgetStand {
  const vorgabe = vorgabeStand();
  return {
    ...stand,
    einstellungen: vorgabe.einstellungen.map(
      (v) => stand.einstellungen.find((e) => e.bereich === v.bereich) ?? v,
    ),
  };
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE — eine Zeile je Mandant, geschrieben nur als Vergleich-und-Tausch.
// ------------------------------------------------------------------------------------------------

export interface ProduktbudgetRepo {
  /** Der gespeicherte Stand samt Zeilenfassung — `null`, solange nie geschrieben wurde. */
  hole(mandant: string): Promise<{ stand: ProduktbudgetStand; version: number } | null>;
  /**
   * Schreibt `neu`, wenn die Zeile noch `alteVersion` trägt (0: es gibt noch keine Zeile); sonst
   * `false`. Zwei Prozesse oder zwei Anfragen können so nichts gegenseitig überschreiben.
   */
  ersetze(mandant: string, alteVersion: number, neu: ProduktbudgetStand): Promise<boolean>;
}

export class InMemoryProduktbudgetRepo implements ProduktbudgetRepo {
  private readonly zeilen = new Map<string, { stand: ProduktbudgetStand; version: number }>();

  hole(mandant: string): Promise<{ stand: ProduktbudgetStand; version: number } | null> {
    const z = this.zeilen.get(mandant);
    return Promise.resolve(z ? structuredClone(z) : null);
  }

  ersetze(mandant: string, alteVersion: number, neu: ProduktbudgetStand): Promise<boolean> {
    const alt = this.zeilen.get(mandant);
    if ((alt?.version ?? 0) !== alteVersion) {
      return Promise.resolve(false);
    }
    this.zeilen.set(mandant, { stand: structuredClone(neu), version: alteVersion + 1 });
    return Promise.resolve(true);
  }
}

/**
 * Eine Zeile je Mandant, der Stand als JSON. REIN ADDITIV UND WIEDERHOLBAR: ein
 * `CREATE TABLE IF NOT EXISTS`, kein DROP, kein Fremdschlüssel, keine Extension, kein Seed.
 */
export const PRODUKTBUDGET_SCHEMA = `
CREATE TABLE IF NOT EXISTS produktbudget (
  mandant text PRIMARY KEY,
  version integer NOT NULL,
  geaendert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
`;

export class PgProduktbudgetRepo implements ProduktbudgetRepo {
  constructor(private readonly pool: Pool) {}

  async hole(mandant: string): Promise<{ stand: ProduktbudgetStand; version: number } | null> {
    const res = await this.pool.query<{ data: ProduktbudgetStand; version: number }>(
      "SELECT data, version FROM produktbudget WHERE mandant = $1",
      [mandant],
    );
    const z = res.rows[0];
    return z ? { stand: z.data, version: z.version } : null;
  }

  async ersetze(mandant: string, alteVersion: number, neu: ProduktbudgetStand): Promise<boolean> {
    const daten = JSON.stringify(neu);
    const stempel = new Date().toISOString();
    if (alteVersion === 0) {
      const res = await this.pool.query(
        `INSERT INTO produktbudget (mandant, version, geaendert_am, data)
         VALUES ($1, 1, $2, $3) ON CONFLICT (mandant) DO NOTHING`,
        [mandant, stempel, daten],
      );
      return (res.rowCount ?? 0) > 0;
    }
    const res = await this.pool.query(
      `UPDATE produktbudget SET version = version + 1, geaendert_am = $2, data = $3::jsonb
        WHERE mandant = $1 AND version = $4`,
      [mandant, stempel, daten, alteVersion],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

// ------------------------------------------------------------------------------------------------
// GELD
// ------------------------------------------------------------------------------------------------

const BETRAG = /^(\d{1,7})(?:[.,](\d{1,2}))?$/;

/**
 * Übersetzt einen Betragstext in Cent — oder `null`, wenn er keiner ist. Nur Ziffern mit höchstens
 * zwei Nachkommastellen; kein Vorzeichen, keine Tausendertrennung, keine Exponentschreibweise. Eine
 * Zahl statt eines Textes wird nur als ganze Zahl angenommen (kein Gleitkomma-Geld).
 */
export function betragInCent(roh: unknown): number | null {
  let text: string;
  if (typeof roh === "number") {
    if (!Number.isSafeInteger(roh) || roh < 0) {
      return null;
    }
    text = String(roh);
  } else if (typeof roh === "string") {
    text = roh.trim();
  } else {
    return null;
  }
  const m = BETRAG.exec(text);
  if (!m?.[1]) {
    return null;
  }
  const nachkomma = (m[2] ?? "").padEnd(2, "0");
  return Number(m[1]) * 100 + Number(nachkomma);
}

// ------------------------------------------------------------------------------------------------
// DIE SICHT
// ------------------------------------------------------------------------------------------------

/** Warum der Kostenweg eines Bereichs gerade zu ist — oder `null`, wenn er offen ist. */
export type BudgetSperre = "zeitraum_offen" | "null_budget" | "ausgeschoepft";

export interface BudgetBereichSicht extends BudgetEinstellung {
  readonly anbieter: BudgetAnbieter;
  readonly original: string;
  readonly abgeloest: BudgetVorgabe["abgeloest"];
  readonly verbrauchtCent: number;
  readonly reserviertCent: number;
  /** `betrag − verbraucht − reserviert`, nie unter 0. */
  readonly verbleibendCent: number;
  /** Um so viel liegen Verbrauch und Reservierung über dem Betrag (nach einer Senkung). */
  readonly ueberschrittenCent: number;
  readonly buchungen: number;
  readonly sperre: BudgetSperre | null;
  readonly letzteAenderungen: readonly BudgetAenderung[];
  /** PBE-12: Konten mit Zuweisung, Unterlimit oder Buchungen in diesem Bereich (Verwaltungssicht). */
  readonly konten: readonly KontoSicht[];
}

export interface KontoSicht extends KontoGrenze {
  readonly konto: string;
  /** Verbucht + reserviert durch dieses Konto. */
  readonly belegtCent: number;
  /** Das kleinere aus Zuweisung und Unterlimit; `null`: es gilt nur der Gesamtdeckel. */
  readonly grenzeCent: number | null;
}

/** Die Sicht EINES Kontos auf einen Bereich — eigene Grenzen und eigene Belegung, nichts Fremdes. */
export interface EigeneBudgetSicht {
  readonly bereich: BudgetBereichId;
  readonly anbieter: BudgetAnbieter;
  readonly betragCent: number;
  readonly waehrung: BudgetWaehrung;
  readonly zeitraum: BudgetZeitraum;
  readonly sperre: BudgetSperre | null;
  /** Rest des Gesamtdeckels. */
  readonly gesamtVerbleibendCent: number;
  /** Die erlaubte Zuweisung: von der Verwaltung gesetzt, sonst der Gesamtbetrag. */
  readonly zuweisungCent: number;
  readonly zuweisungGesetzt: boolean;
  readonly unterlimitCent: number | null;
  readonly belegtCent: number;
  /** Was dieses Konto noch auslösen darf — Unterlimit, Zuweisung UND Gesamtdeckel zusammen. */
  readonly eigenVerbleibendCent: number;
  readonly fassung: number;
}

export interface ProduktbudgetSicht {
  readonly bereiche: readonly BudgetBereichSicht[];
  /** Zeitpunkt dieser Lesung. */
  readonly gelesenAm: string;
}

/**
 * Gehört die Buchung zu GENAU dieser Ausführung? Konto und Versuch zählen mit; eine Buchung ohne
 * Herkunft (direkter Weg, ältere Zeile) passt nur zu einer Anfrage ohne Herkunft.
 */
function dieselbeAusfuehrung(
  b: BudgetBuchung,
  auftragId: string,
  herkunft: { readonly nutzer: string; readonly versuch: number } | undefined,
): boolean {
  return (
    b.auftragId === auftragId &&
    (b.nutzer ?? null) === (herkunft?.nutzer ?? null) &&
    (b.versuch ?? null) === (herkunft?.versuch ?? null)
  );
}

function summe(buchungen: readonly BudgetBuchung[], art: BudgetBuchung["art"]): number {
  return buchungen.filter((b) => b.art === art).reduce((s, b) => s + b.cent, 0);
}

function rechne(stand: ProduktbudgetStand, e: BudgetEinstellung) {
  const buchungen = stand.buchungen[e.bereich] ?? [];
  const verbraucht = summe(buchungen, "verbucht");
  const reserviert = summe(buchungen, "reserviert");
  const belegt = verbraucht + reserviert;
  const verbleibend = Math.max(0, e.betragCent - belegt);
  const sperre: BudgetSperre | null =
    e.zeitraum === "offen"
      ? "zeitraum_offen"
      : e.betragCent === 0
        ? "null_budget"
        : verbleibend === 0
          ? "ausgeschoepft"
          : null;
  return {
    buchungen,
    verbraucht,
    reserviert,
    verbleibend,
    ueberschritten: Math.max(0, belegt - e.betragCent),
    sperre,
  };
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export type ProduktbudgetGrund =
  | "bereich"
  | "betrag"
  | "waehrung"
  | "waehrung_gebunden"
  | "zeitraum"
  | "grund"
  | "aenderung"
  | "konflikt"
  | "konto"
  | "zuweisung"
  | "unterlimit";

export class ProduktbudgetFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: ProduktbudgetGrund,
    message: string,
    /** Bei einem Konflikt der aktuelle Stand — die Oberfläche behält die Eingabe daneben. */
    readonly stand?: ProduktbudgetSicht,
  ) {
    super(message);
    this.name = "ProduktbudgetFehler";
  }
}

export interface BudgetEingabe {
  betrag?: unknown;
  waehrung?: unknown;
  zeitraum?: unknown;
  /** Die Einstellungsfassung, die die Oberfläche zuletzt gesehen hat. */
  fassung?: unknown;
  /** Kennung DIESES Änderungsvorgangs — eine Wiederholung nach unklarem Ausgang wirkt nicht doppelt. */
  aenderungId?: unknown;
  grund?: unknown;
}

const AENDERUNG_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/;
/** Eine Kontokennung — beginnt nie mit `_` (kein `__proto__`), nie leer. */
const KONTO_KENNUNG = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const GRUND_MAX = 200;

function istBereich(id: string): id is BudgetBereichId {
  return BUDGET_VORGABEN.some((v) => v.id === id);
}

function vorgabe(id: BudgetBereichId): BudgetVorgabe {
  return BUDGET_VORGABEN.find((v) => v.id === id) as BudgetVorgabe;
}

function hatSteuerzeichen(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) {
      return true;
    }
  }
  return false;
}

export interface ProduktbudgetDeps {
  readonly repo: ProduktbudgetRepo;
  /** Der Mandant dieser Instanz — Klarwerk läuft je Instanz für genau einen. */
  readonly mandant: string;
  readonly jetzt?: () => number;
}

export class Produktbudget {
  private readonly jetzt: () => number;

  constructor(private readonly deps: ProduktbudgetDeps) {
    this.jetzt = deps.jetzt ?? Date.now;
  }

  private stempel(): string {
    return new Date(this.jetzt()).toISOString();
  }

  /**
   * Liest den Stand. Trägt ein GESPEICHERTER Stand Peters bestätigte Gesamtperiode noch nicht
   * (PBE-12), wird sie hier übernommen und SOFORT gespeichert (Vergleich-und-Tausch, im Journal als
   * eigene Zeile) — erst danach gilt der Stand. Scheitert das Speichern, scheitert das Lesen; ein
   * nur im Speicher übernommener Zeitraum gäbe keine Kosten frei. Ohne gespeicherte Zeile gelten
   * die Vorgaben, die die Gesamtperiode schon tragen — dann wird nichts geschrieben.
   */
  private async lade(): Promise<{ stand: ProduktbudgetStand; version: number }> {
    for (let versuch = 0; versuch < 32; versuch++) {
      const z = await this.deps.repo.hole(this.deps.mandant);
      if (!z) {
        return { stand: vorgabeStand(), version: 0 };
      }
      const stand = vervollstaendige(z.stand);
      const uebernommen = uebernehmeGesamtperiode(stand, this.stempel());
      if (uebernommen === null) {
        return { stand, version: z.version };
      }
      if (await this.deps.repo.ersetze(this.deps.mandant, z.version, uebernommen)) {
        return { stand: uebernommen, version: z.version + 1 };
      }
    }
    throw new ProduktbudgetFehler(
      409,
      "konflikt",
      "Das Produktbudget wird gerade an anderer Stelle geändert. Bitte erneut versuchen.",
    );
  }

  /**
   * Vergleich-und-Tausch mit begrenzter Wiederholung. `f` sieht jedes Mal den FRISCH gelesenen
   * Stand — eine Prüfung gegen einen veralteten Stand gibt es nicht. Jede Runde gewinnt mindestens
   * ein Schreiber; die Grenze liegt deshalb über der Zahl gleichzeitiger Aufrufe, die ein Bereich
   * realistisch sieht.
   */
  private async aendereStand<T>(
    f: (stand: ProduktbudgetStand) => { neu: ProduktbudgetStand | null; wert: T },
  ): Promise<T> {
    for (let versuch = 0; versuch < 32; versuch++) {
      const { stand, version } = await this.lade();
      const { neu, wert } = f(stand);
      if (neu === null || (await this.deps.repo.ersetze(this.deps.mandant, version, neu))) {
        return wert;
      }
    }
    throw new ProduktbudgetFehler(
      409,
      "konflikt",
      "Das Produktbudget wird gerade an anderer Stelle geändert. Bitte erneut versuchen.",
    );
  }

  private sicht(stand: ProduktbudgetStand): ProduktbudgetSicht {
    return {
      gelesenAm: this.stempel(),
      bereiche: stand.einstellungen.map((e) => {
        const v = vorgabe(e.bereich);
        const r = rechne(stand, e);
        return {
          ...e,
          anbieter: v.anbieter,
          original: v.original,
          abgeloest: v.abgeloest,
          verbrauchtCent: r.verbraucht,
          reserviertCent: r.reserviert,
          verbleibendCent: r.verbleibend,
          ueberschrittenCent: r.ueberschritten,
          buchungen: r.buchungen.length,
          sperre: r.sperre,
          letzteAenderungen: stand.aenderungen
            .filter((a) => a.bereich === e.bereich)
            .slice(-10)
            .reverse(),
          konten: this.kontoSichten(stand, e.bereich),
        };
      }),
    };
  }

  private kontoSichten(stand: ProduktbudgetStand, bereich: BudgetBereichId): KontoSicht[] {
    const jeBereich =
      stand.konten && Object.hasOwn(stand.konten, bereich) ? (stand.konten[bereich] ?? {}) : {};
    const namen = new Set<string>(Object.keys(jeBereich));
    for (const b of stand.buchungen[bereich] ?? []) {
      if (typeof b.nutzer === "string") {
        namen.add(b.nutzer);
      }
    }
    return [...namen].sort().map((konto) => {
      const g = kontoGrenze(stand, bereich, konto);
      return {
        konto,
        zuweisungCent: g?.zuweisungCent ?? null,
        unterlimitCent: g?.unterlimitCent ?? null,
        fassung: g?.fassung ?? 0,
        geaendertAm: g?.geaendertAm ?? null,
        geaendertVon: g?.geaendertVon ?? null,
        belegtCent: belegtVonKonto(stand, bereich, konto),
        grenzeCent: wirksameKontogrenze(g),
      };
    });
  }

  async lies(): Promise<ProduktbudgetSicht> {
    return this.sicht((await this.lade()).stand);
  }

  /** PBE-12: die Sicht EINES Kontos — eigene Zuweisung, eigenes Unterlimit, eigene Belegung. */
  async eigene(konto: string): Promise<{ bereiche: EigeneBudgetSicht[]; gelesenAm: string }> {
    const { stand } = await this.lade();
    return { gelesenAm: this.stempel(), bereiche: this.eigeneSichten(stand, konto) };
  }

  private eigeneSichten(stand: ProduktbudgetStand, konto: string): EigeneBudgetSicht[] {
    return stand.einstellungen.map((e) => {
      const r = rechne(stand, e);
      const g = kontoGrenze(stand, e.bereich, konto);
      const zuweisung = g?.zuweisungCent ?? null;
      const zuweisungCent = zuweisung ?? e.betragCent;
      const belegt = belegtVonKonto(stand, e.bereich, konto);
      const eigeneGrenze = Math.min(zuweisungCent, g?.unterlimitCent ?? zuweisungCent);
      return {
        bereich: e.bereich,
        anbieter: vorgabe(e.bereich).anbieter,
        betragCent: e.betragCent,
        waehrung: e.waehrung,
        zeitraum: e.zeitraum,
        sperre: r.sperre,
        gesamtVerbleibendCent: r.verbleibend,
        zuweisungCent,
        zuweisungGesetzt: zuweisung !== null,
        unterlimitCent: g?.unterlimitCent ?? null,
        belegtCent: belegt,
        eigenVerbleibendCent: Math.max(0, Math.min(eigeneGrenze - belegt, r.verbleibend)),
        fassung: g?.fassung ?? 0,
      };
    });
  }

  /**
   * PBE-12: eine Kontogrenze setzen — `art: "zuweisung"` NUR durch die Verwaltung (die Route prüft
   * `users.manage`), `art: "unterlimit"` nur für das EIGENE Konto (die Route nimmt das Konto aus der
   * Sitzung). Eine Zuweisung liegt höchstens beim Gesamtbetrag, ein Unterlimit höchstens bei der
   * wirksamen Zuweisung. `null` hebt die Grenze auf. Buchungen bleiben unberührt.
   */
  async setzeKontogrenze(
    von: string,
    eingabe: {
      art: "zuweisung" | "unterlimit";
      bereich: string;
      konto: string;
      betrag: unknown;
      fassung: unknown;
    },
  ): Promise<{ grenze: KontoGrenze; unveraendert: boolean }> {
    if (!istBereich(eingabe.bereich)) {
      throw new ProduktbudgetFehler(404, "bereich", "Diesen Budgetbereich gibt es nicht.");
    }
    const bereich = eingabe.bereich;
    const konto = eingabe.konto;
    if (!KONTO_KENNUNG.test(konto)) {
      throw new ProduktbudgetFehler(400, "konto", "Die Kontokennung ist ungültig.");
    }
    const cent = eingabe.betrag === null ? null : betragInCent(eingabe.betrag);
    if (eingabe.betrag !== null && cent === null) {
      throw new ProduktbudgetFehler(
        400,
        eingabe.art,
        "Der Betrag muss eine Zahl ab 0 mit höchstens zwei Nachkommastellen sein.",
      );
    }
    const fassung = eingabe.fassung;
    if (typeof fassung !== "number" || !Number.isSafeInteger(fassung) || fassung < 0) {
      throw new ProduktbudgetFehler(400, "konflikt", "fassung muss eine ganze Zahl sein.");
    }
    type Ausgang =
      | { art: "ok"; grenze: KontoGrenze; unveraendert: boolean }
      | { art: "fehler"; f: ProduktbudgetFehler };
    const ergebnis = await this.aendereStand<Ausgang>((stand) => {
      const e = stand.einstellungen.find((x) => x.bereich === bereich) as BudgetEinstellung;
      const alt = kontoGrenze(stand, bereich, konto);
      const fehler = (status: 400 | 409, grund: ProduktbudgetGrund, text: string) => ({
        neu: null,
        wert: { art: "fehler" as const, f: new ProduktbudgetFehler(status, grund, text) },
      });
      if ((alt?.fassung ?? 0) !== fassung) {
        return fehler(409, "konflikt", "Diese Grenze wurde inzwischen geändert. Bitte neu laden.");
      }
      if (cent !== null && eingabe.art === "zuweisung" && cent > e.betragCent) {
        return fehler(400, "zuweisung", "Die Zuweisung liegt über dem Gesamtbetrag des Bereichs.");
      }
      const erlaubt = alt?.zuweisungCent ?? e.betragCent;
      if (cent !== null && eingabe.art === "unterlimit" && cent > erlaubt) {
        return fehler(400, "unterlimit", "Das Unterlimit liegt über der erlaubten Zuweisung.");
      }
      const vorher =
        eingabe.art === "zuweisung" ? (alt?.zuweisungCent ?? null) : (alt?.unterlimitCent ?? null);
      const basis: KontoGrenze = alt ?? {
        zuweisungCent: null,
        unterlimitCent: null,
        fassung: 0,
        geaendertAm: null,
        geaendertVon: null,
      };
      if (vorher === cent) {
        return { neu: null, wert: { art: "ok", grenze: basis, unveraendert: true } };
      }
      const am = this.stempel();
      const neu: KontoGrenze = {
        ...basis,
        ...(eingabe.art === "zuweisung" ? { zuweisungCent: cent } : { unterlimitCent: cent }),
        fassung: basis.fassung + 1,
        geaendertAm: am,
        geaendertVon: von,
      };
      const jeBereich =
        stand.konten && Object.hasOwn(stand.konten, bereich) ? (stand.konten[bereich] ?? {}) : {};
      return {
        neu: {
          ...stand,
          konten: { ...(stand.konten ?? {}), [bereich]: { ...jeBereich, [konto]: neu } },
          grenzAenderungen: [
            ...(stand.grenzAenderungen ?? []),
            { art: eingabe.art, bereich, konto, am, von, vorherCent: vorher, nachherCent: cent },
          ].slice(-MAX_AENDERUNGEN),
        },
        wert: { art: "ok", grenze: neu, unveraendert: false },
      };
    });
    if (ergebnis.art === "fehler") {
      throw ergebnis.f;
    }
    return { grenze: ergebnis.grenze, unveraendert: ergebnis.unveraendert };
  }

  /**
   * Ändert die Einstellung EINES Bereichs. Rechte prüft die Route (`users.manage`); die Kennung der
   * Person kommt aus der Sitzung. Prüft Betrag, Währung, Zeitraum, gesehene Fassung und Wiederholung
   * GEGEN DEN FRISCH GELESENEN STAND. Buchungen bleiben unverändert.
   */
  async aendere(
    von: string,
    bereichRoh: string,
    eingabe: BudgetEingabe,
  ): Promise<{
    sicht: ProduktbudgetSicht;
    wiederholt: boolean;
    geaendert: boolean;
    /** Die von GENAU dieser Änderung hergestellte Fassung; `null` nur bei Altvermerken. */
    bestaetigteFassung: number | null;
  }> {
    if (!istBereich(bereichRoh)) {
      throw new ProduktbudgetFehler(404, "bereich", "Diesen Budgetbereich gibt es nicht.");
    }
    const bereich = bereichRoh;
    const aenderungId = eingabe.aenderungId;
    if (typeof aenderungId !== "string" || !AENDERUNG_ID.test(aenderungId)) {
      throw new ProduktbudgetFehler(400, "aenderung", "aenderungId fehlt oder ist ungültig.");
    }
    const betragCent = betragInCent(eingabe.betrag);
    if (betragCent === null) {
      throw new ProduktbudgetFehler(
        400,
        "betrag",
        "Der Betrag muss eine Zahl ab 0 mit höchstens zwei Nachkommastellen sein.",
      );
    }
    if (betragCent > BUDGET_MAX_CENT) {
      throw new ProduktbudgetFehler(400, "betrag", "Der Betrag liegt über der Höchstgrenze.");
    }
    const waehrung = eingabe.waehrung;
    if (
      typeof waehrung !== "string" ||
      !(BUDGET_WAEHRUNGEN as readonly string[]).includes(waehrung)
    ) {
      throw new ProduktbudgetFehler(400, "waehrung", "Die Währung muss EUR oder USD sein.");
    }
    const zeitraum = eingabe.zeitraum;
    if (
      typeof zeitraum !== "string" ||
      !(BUDGET_ZEITRAEUME as readonly string[]).includes(zeitraum)
    ) {
      throw new ProduktbudgetFehler(400, "zeitraum", "Der Zeitraum muss einmalig oder offen sein.");
    }
    const fassung = eingabe.fassung;
    if (typeof fassung !== "number" || !Number.isSafeInteger(fassung) || fassung < 0) {
      throw new ProduktbudgetFehler(400, "konflikt", "fassung muss eine ganze Zahl sein.");
    }
    let grund: string | null = null;
    if (eingabe.grund !== undefined && eingabe.grund !== null) {
      if (typeof eingabe.grund !== "string") {
        throw new ProduktbudgetFehler(400, "grund", "Der Grund muss Text sein.");
      }
      const t = eingabe.grund.normalize("NFC").trim();
      if ([...t].length > GRUND_MAX || hatSteuerzeichen(t)) {
        throw new ProduktbudgetFehler(
          400,
          "grund",
          `Der Grund ist eine Zeile Text mit höchstens ${GRUND_MAX} Zeichen.`,
        );
      }
      grund = t.length > 0 ? t : null;
    }
    const nachher: BudgetWerte = {
      betragCent,
      waehrung: waehrung as BudgetWaehrung,
      zeitraum: zeitraum as BudgetZeitraum,
    };

    // `fassung`: die Fassung, die GENAU DIESE Änderung im atomaren Vorgang hergestellt (bzw. bei
    // „unverändert" vorgefunden) hat — nicht die eines später gelesenen Stands, der schon eine
    // fremde Änderung enthalten kann (Ben nacharbeit-3).
    type Ausgang =
      | { art: "wiederholt" | "unveraendert" | "geaendert"; fassung: number | null }
      | { art: "fehler"; f: ProduktbudgetFehler };
    const ergebnis = await this.aendereStand<Ausgang>((stand) => {
      // Dieselbe Änderung kam schon an (unklarer Ausgang, erneutes Senden): kein zweiter Eintrag.
      // „Dieselbe" heisst: dieselbe Person, derselbe Bereich, dieselbe Grundfassung und dieselbe
      // Nutzlast. Eine bekannte Kennung mit ANDERER Eingabe bestätigt nichts — sonst verschwände
      // eine neue, nie gespeicherte Eingabe hinter einer alten Bestätigung.
      const frueher = stand.aenderungen.find((a) => a.aenderungId === aenderungId);
      if (frueher) {
        const gleich =
          frueher.von === von &&
          frueher.bereich === bereich &&
          (frueher.basisFassung === undefined || frueher.basisFassung === fassung) &&
          frueher.nachher.betragCent === nachher.betragCent &&
          frueher.nachher.waehrung === nachher.waehrung &&
          frueher.nachher.zeitraum === nachher.zeitraum &&
          frueher.grund === grund;
        if (gleich) {
          const bestaetigt = frueher.basisFassung === undefined ? null : frueher.basisFassung + 1;
          return { neu: null, wert: { art: "wiederholt", fassung: bestaetigt } };
        }
        return {
          neu: null,
          wert: {
            art: "fehler",
            f: new ProduktbudgetFehler(
              409,
              "aenderung",
              "Diese Änderungskennung gehört zu einer anderen Änderung; nichts wurde gespeichert.",
              this.sicht(stand),
            ),
          },
        };
      }
      const alt = stand.einstellungen.find((e) => e.bereich === bereich) as BudgetEinstellung;
      if (alt.fassung !== fassung) {
        return {
          neu: null,
          wert: {
            art: "fehler",
            f: new ProduktbudgetFehler(
              409,
              "konflikt",
              "Dieses Budget wurde inzwischen an anderer Stelle geändert. Deine Eingabe ist erhalten; bitte den neuen Stand prüfen und erneut speichern.",
              this.sicht(stand),
            ),
          },
        };
      }
      const buchungen = stand.buchungen[bereich] ?? [];
      if (nachher.waehrung !== alt.waehrung && buchungen.length > 0) {
        return {
          neu: null,
          wert: {
            art: "fehler",
            f: new ProduktbudgetFehler(
              409,
              "waehrung_gebunden",
              "Für dieses Budget sind schon Kosten gebucht; die Währung bleibt an diese Buchungen gebunden und wird nicht umetikettiert.",
              this.sicht(stand),
            ),
          },
        };
      }
      if (alt.zeitraum === "offen" && nachher.zeitraum === "einmalig" && grund === null) {
        return {
          neu: null,
          wert: {
            art: "fehler",
            f: new ProduktbudgetFehler(
              400,
              "grund",
              "Wer einen offenen Zeitraum festlegt, nennt den Beleg dafür (z. B. die Entscheidung zum Zeitraum).",
            ),
          },
        };
      }
      if (
        alt.betragCent === nachher.betragCent &&
        alt.waehrung === nachher.waehrung &&
        alt.zeitraum === nachher.zeitraum
      ) {
        return { neu: null, wert: { art: "unveraendert", fassung: alt.fassung } };
      }
      const am = this.stempel();
      const neuE: BudgetEinstellung = {
        ...alt,
        ...nachher,
        fassung: alt.fassung + 1,
        geaendertAm: am,
        geaendertVon: von,
      };
      return {
        neu: {
          // Kontogrenzen und Übernahmen reisen unverändert mit.
          ...stand,
          einstellungen: stand.einstellungen.map((e) => (e.bereich === bereich ? neuE : e)),
          // Buchungen unverändert — eine Budgetänderung bucht, löscht und setzt nichts zurück.
          buchungen: stand.buchungen,
          aenderungen: [
            ...stand.aenderungen,
            {
              aenderungId,
              bereich,
              am,
              von,
              vorher: {
                betragCent: alt.betragCent,
                waehrung: alt.waehrung,
                zeitraum: alt.zeitraum,
              },
              nachher,
              grund,
              basisFassung: fassung,
            },
          ].slice(-MAX_AENDERUNGEN),
        },
        wert: { art: "geaendert", fassung: neuE.fassung },
      };
    });
    if (ergebnis.art === "fehler") {
      throw ergebnis.f;
    }
    return {
      // Die Sicht wird danach gelesen und kann schon fremde Änderungen enthalten; als Grundlage
      // einer Folgeeingabe gilt allein `bestaetigteFassung`.
      sicht: await this.lies(),
      wiederholt: ergebnis.art === "wiederholt",
      geaendert: ergebnis.art === "geaendert",
      bestaetigteFassung: ergebnis.fassung,
    };
  }

  /**
   * Das Kostenbuch der Fähigkeitsausführung (G18) über GENAU diese Bereiche (PBE-09). Ein
   * Fähigkeitsvertrag schließt an, indem er `kostenzuordnung` auf eine Bereichskennung setzt.
   */
  kostenbuch(): Kostenbuch {
    return {
      rest: async (zuordnung) => {
        if (!istBereich(zuordnung)) {
          return null;
        }
        const { stand } = await this.lade();
        const e = stand.einstellungen.find((x) => x.bereich === zuordnung) as BudgetEinstellung;
        const r = rechne(stand, e);
        // Offener Zeitraum: KEIN Rest, auch nicht 0 — die Frage ist nicht beantwortet.
        return e.zeitraum === "offen" ? null : r.verbleibend;
      },
      reserviere: (r) => this.reserviere(r),
      verbuche: (zuordnung, cent, auftragId, herkunft) =>
        this.verbuche(zuordnung, cent, auftragId, herkunft),
    };
  }

  /**
   * Sperrt `cent` gegen den Deckel — atomar mit der Prüfung (Vergleich-und-Tausch auf die ganze
   * Zeile), daher können zwei parallele Aufrufe den Rest nicht beide verbrauchen. Nur bei passendem
   * Anbieter, passender Währung, festgelegtem Zeitraum und ausreichendem Rest.
   *
   * Die Identität ist die AUSFÜHRUNG — Konto, Auftragskennung, Versuch. Dieselbe Ausführung
   * reserviert kein zweites Mal; ihre Wiederholung wird nur mit gleichem Betrag, gleicher Währung
   * und noch offener Reservierung bestätigt. Ein anderes Konto mit derselben Auftragskennung und
   * jeder weitere Versuch sind eigene kostenwirksame Aufrufe und zählen eigens gegen den Deckel.
   */
  async reserviere(r: KostenReservierung): Promise<boolean> {
    const zuordnung = r.zuordnung;
    if (!istBereich(zuordnung) || !Number.isSafeInteger(r.cent) || r.cent <= 0) {
      return false;
    }
    if (r.anbieter !== vorgabe(zuordnung).anbieter) {
      return false;
    }
    if (typeof r.nutzer !== "string" || r.nutzer === "" || !Number.isSafeInteger(r.versuch)) {
      return false;
    }
    return this.aendereStand<boolean>((stand) => {
      const e = stand.einstellungen.find((x) => x.bereich === zuordnung) as BudgetEinstellung;
      const buchungen = stand.buchungen[zuordnung] ?? [];
      const vorhanden = buchungen.find((b) =>
        dieselbeAusfuehrung(b, r.auftragId, { nutzer: r.nutzer, versuch: r.versuch }),
      );
      if (vorhanden) {
        return {
          neu: null,
          wert:
            vorhanden.art === "reserviert" &&
            vorhanden.cent === r.cent &&
            vorhanden.waehrung === r.waehrung &&
            e.waehrung === r.waehrung,
        };
      }
      if (e.zeitraum !== "einmalig" || r.waehrung !== e.waehrung) {
        return { neu: null, wert: false };
      }
      if (rechne(stand, e).verbleibend < r.cent) {
        return { neu: null, wert: false };
      }
      // PBE-12: Unterlimit und Zuweisung des Kontos — GEMEINSAM mit dem Gesamtdeckel oben, im
      // selben atomaren Schritt.
      const kontogrenze = wirksameKontogrenze(kontoGrenze(stand, zuordnung, r.nutzer));
      const vomKonto = belegtVonKonto(stand, zuordnung, r.nutzer);
      if (kontogrenze !== null && vomKonto + r.cent > kontogrenze) {
        return { neu: null, wert: false };
      }
      const b: BudgetBuchung = {
        nutzer: r.nutzer,
        auftragId: r.auftragId,
        versuch: r.versuch,
        art: "reserviert",
        cent: r.cent,
        waehrung: e.waehrung,
        am: this.stempel(),
      };
      return {
        neu: { ...stand, buchungen: { ...stand.buchungen, [zuordnung]: [...buchungen, b] } },
        wert: true,
      };
    });
  }

  /**
   * Verbucht tatsächlich angefallene Kosten. Die Reservierung DERSELBEN Ausführung (Konto,
   * Auftragskennung, Versuch) wird zur Buchung; ohne Reservierung entsteht eine neue — angefallene
   * Kosten werden immer sichtbar, auch über dem Deckel. Dieselbe Ausführung wird nie zweimal
   * verbucht.
   */
  async verbuche(
    zuordnung: string,
    cent: number,
    auftragId: string,
    herkunft?: { readonly nutzer: string; readonly versuch: number },
  ): Promise<void> {
    if (!istBereich(zuordnung) || !Number.isSafeInteger(cent) || cent < 0) {
      return;
    }
    await this.aendereStand<undefined>((stand) => {
      const e = stand.einstellungen.find((x) => x.bereich === zuordnung) as BudgetEinstellung;
      const buchungen = stand.buchungen[zuordnung] ?? [];
      const vorhanden = buchungen.find((b) => dieselbeAusfuehrung(b, auftragId, herkunft));
      if (vorhanden?.art === "verbucht") {
        return { neu: null, wert: undefined };
      }
      const b: BudgetBuchung = {
        nutzer: herkunft?.nutzer ?? null,
        auftragId,
        versuch: herkunft?.versuch ?? null,
        art: "verbucht",
        cent,
        waehrung: vorhanden?.waehrung ?? e.waehrung,
        am: this.stempel(),
      };
      const neu = vorhanden ? buchungen.map((x) => (x === vorhanden ? b : x)) : [...buchungen, b];
      return {
        neu: { ...stand, buchungen: { ...stand.buchungen, [zuordnung]: neu } },
        wert: undefined,
      };
    });
  }
}

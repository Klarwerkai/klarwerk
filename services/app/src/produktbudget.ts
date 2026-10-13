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
//   · `nr32-claude`, `nr32-chatgpt` — je 20 EUR für die Claude-/ChatGPT-Proben zu Nr. 32 (PBE-04).
//     Aufteilung und Zeitraum sind dort gefragt und unbeantwortet: Zeitraum `offen`, also KEIN
//     Kostenweg, bis eine berechtigte Person den Zeitraum mit Beleg bestätigt.
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
    zeitraum: "offen",
    abgeloest: null,
  },
  {
    id: "nr32-chatgpt",
    anbieter: "openai",
    original: "produkt:20261011:peter-p03",
    betragCent: 2000,
    waehrung: "EUR",
    zeitraum: "offen",
    abgeloest: null,
  },
];

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
 * Auftragskennung höchstens eine Buchung — Wiederholung und Neustart buchen nicht doppelt.
 */
export interface BudgetBuchung {
  readonly auftragId: string;
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
}

export interface ProduktbudgetStand {
  readonly einstellungen: readonly BudgetEinstellung[];
  readonly buchungen: Readonly<Record<string, readonly BudgetBuchung[]>>;
  readonly aenderungen: readonly BudgetAenderung[];
}

/** Höchstzahl gespeicherter Provenienzeinträge; ältere fallen weg, Buchungen nie. */
const MAX_AENDERUNGEN = 200;

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
}

export interface ProduktbudgetSicht {
  readonly bereiche: readonly BudgetBereichSicht[];
  /** Zeitpunkt dieser Lesung. */
  readonly gelesenAm: string;
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
  | "konflikt";

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

  private async lade(): Promise<{ stand: ProduktbudgetStand; version: number }> {
    const z = await this.deps.repo.hole(this.deps.mandant);
    return z
      ? { stand: vervollstaendige(z.stand), version: z.version }
      : { stand: vorgabeStand(), version: 0 };
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
        };
      }),
    };
  }

  async lies(): Promise<ProduktbudgetSicht> {
    return this.sicht((await this.lade()).stand);
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
  ): Promise<{ sicht: ProduktbudgetSicht; wiederholt: boolean; geaendert: boolean }> {
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

    type Ausgang =
      | { art: "wiederholt" | "unveraendert" | "geaendert" }
      | { art: "fehler"; f: ProduktbudgetFehler };
    const ergebnis = await this.aendereStand<Ausgang>((stand) => {
      // Dieselbe Änderung kam schon an (unklarer Ausgang, erneutes Senden): kein zweiter Eintrag.
      if (stand.aenderungen.some((a) => a.aenderungId === aenderungId)) {
        return { neu: null, wert: { art: "wiederholt" } };
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
              "Wer einen offenen Zeitraum festlegt, nennt den Beleg dafür (z. B. die Antwort zur Aufteilung).",
            ),
          },
        };
      }
      if (
        alt.betragCent === nachher.betragCent &&
        alt.waehrung === nachher.waehrung &&
        alt.zeitraum === nachher.zeitraum
      ) {
        return { neu: null, wert: { art: "unveraendert" } };
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
            },
          ].slice(-MAX_AENDERUNGEN),
        },
        wert: { art: "geaendert" },
      };
    });
    if (ergebnis.art === "fehler") {
      throw ergebnis.f;
    }
    return {
      sicht: await this.lies(),
      wiederholt: ergebnis.art === "wiederholt",
      geaendert: ergebnis.art === "geaendert",
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
      verbuche: (zuordnung, cent, auftragId) => this.verbuche(zuordnung, cent, auftragId),
    };
  }

  /**
   * Sperrt `cent` gegen den Deckel — atomar mit der Prüfung (Vergleich-und-Tausch auf die ganze
   * Zeile), daher können zwei parallele Aufrufe den Rest nicht beide verbrauchen. Nur bei passendem
   * Anbieter, passender Währung, festgelegtem Zeitraum und ausreichendem Rest. Dieselbe
   * Auftragskennung reserviert kein zweites Mal (Wiederholung, Wiederanlauf nach Neustart).
   */
  async reserviere(r: KostenReservierung): Promise<boolean> {
    const zuordnung = r.zuordnung;
    if (!istBereich(zuordnung) || !Number.isSafeInteger(r.cent) || r.cent <= 0) {
      return false;
    }
    if (r.anbieter !== vorgabe(zuordnung).anbieter) {
      return false;
    }
    return this.aendereStand<boolean>((stand) => {
      const e = stand.einstellungen.find((x) => x.bereich === zuordnung) as BudgetEinstellung;
      const buchungen = stand.buchungen[zuordnung] ?? [];
      if (buchungen.some((b) => b.auftragId === r.auftragId)) {
        return { neu: null, wert: true };
      }
      if (e.zeitraum !== "einmalig" || r.waehrung !== e.waehrung) {
        return { neu: null, wert: false };
      }
      if (rechne(stand, e).verbleibend < r.cent) {
        return { neu: null, wert: false };
      }
      const b: BudgetBuchung = {
        auftragId: r.auftragId,
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
   * Verbucht tatsächlich angefallene Kosten. Eine Reservierung derselben Auftragskennung wird zur
   * Buchung; ohne Reservierung entsteht eine neue — angefallene Kosten werden immer sichtbar, auch
   * über dem Deckel. Dieselbe Kennung wird nie zweimal verbucht.
   */
  async verbuche(zuordnung: string, cent: number, auftragId: string): Promise<void> {
    if (!istBereich(zuordnung) || !Number.isSafeInteger(cent) || cent < 0) {
      return;
    }
    await this.aendereStand<undefined>((stand) => {
      const e = stand.einstellungen.find((x) => x.bereich === zuordnung) as BudgetEinstellung;
      const buchungen = stand.buchungen[zuordnung] ?? [];
      const vorhanden = buchungen.find((b) => b.auftragId === auftragId);
      if (vorhanden?.art === "verbucht") {
        return { neu: null, wert: undefined };
      }
      const b: BudgetBuchung = {
        auftragId,
        art: "verbucht",
        cent,
        waehrung: vorhanden?.waehrung ?? e.waehrung,
        am: this.stempel(),
      };
      const neu = vorhanden
        ? buchungen.map((x) => (x.auftragId === auftragId ? b : x))
        : [...buchungen, b];
      return {
        neu: { ...stand, buchungen: { ...stand.buchungen, [zuordnung]: neu } },
        wert: undefined,
      };
    });
  }
}

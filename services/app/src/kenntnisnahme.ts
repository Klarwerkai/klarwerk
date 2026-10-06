import type { Pool } from "pg";
import type { Role } from "../../auth";
import type { KnowledgeObject } from "../../knowledge-object";
import { can } from "../../rbac";
import { darfSehen } from "./sichtbarkeit";

// ================================================================================================
// KENNTNISNAHME EINER GÜLTIGEN FASSUNG (produkt:wettbewerb:20261003:kenntnisnahme).
// ================================================================================================
//
// WAS DAS IST. Eine berechtigte Person (`ko.assign`) fordert für die GÜLTIGE Fassung eines
// Wissenseintrags (Status `validiert`, genau diese Versionsnummer) die Kenntnisnahme durch
// ausgewählte Konten an. Jeder Empfänger bestätigt SELBST und ausdrücklich, dass er diese Fassung
// gelesen hat. Festgehalten werden Eintrag, Fassung, Empfängerkreis, Anfordernder, Zeitpunkt,
// optionale Frist, letzte Erinnerung und je Empfänger der Zeitpunkt seiner Bestätigung.
//
// WAS DAS AUSDRÜCKLICH NICHT IST: keine Freigabe des Inhalts, kein Wissenstest, keine
// elektronische Signatur und kein Nachweis von Verständnis oder Ausführung. Öffnen, Scrollen,
// Herunterladen oder Freigeben erzeugen keine Bestätigung — dieser Dienst kennt genau EINEN
// Schreibweg für sie (`bestaetigen`), und den ruft nur die ausdrückliche Aktion des Empfängers.
//
// BERECHTIGUNG UND REICHWEITE BLEIBEN GETRENNT. Wer einen Eintrag sehen darf, entscheidet weiter
// allein `darfSehen` (+ `ko.read`); der Empfängerkreis ist nur die REICHWEITE einer Anforderung.
// Eine Anforderung gibt niemandem Zugriff: Empfänger ohne Zugriff werden abgewiesen, und wem der
// Zugriff später entzogen wird, der sieht seine Anforderung nicht mehr und kann nicht bestätigen.
//
// EINDEUTIGKEIT. Je (Eintrag, Fassung, Empfänger) gibt es höchstens EINEN Eintrag. Ein doppelter
// Klick oder ein wiederholter Request legt deshalb keine zweite Aufforderung an, und eine zweite
// Bestätigung überschreibt die erste nicht. Eine neue Fassung (V3) ist ein eigener Schlüssel: eine
// Bestätigung zu V2 zählt dort nicht, und die zu V2 bleibt an V2 gebunden.

/** Höchstzahl der Empfänger einer Anforderung — Schutz gegen unbegrenzte Rümpfe. */
export const KENNTNISNAHME_MAX_EMPFAENGER = 500;

export interface Kenntnisnahmeanforderung {
  id: string;
  koId: string;
  /** Die angeforderte Fassung (Versionsnummer des Eintrags). */
  fassung: number;
  angefordertVon: string;
  /** ISO-Zeitpunkt der Anforderung. */
  angefordertAm: string;
  /** ISO-Zeitpunkt der Frist — `null`: ohne Frist, dann gibt es kein „überfällig". */
  frist: string | null;
  /** ISO-Zeitpunkt der letzten Erinnerung — `null`: nie erinnert. */
  erinnertAm: string | null;
}

export interface Kenntnisnahmeeintrag {
  anforderungId: string;
  koId: string;
  fassung: number;
  empfaengerId: string;
  /** ISO-Zeitpunkt der ausdrücklichen Bestätigung — `null`: noch nicht bestätigt. */
  bestaetigtAm: string | null;
}

export type KenntnisnahmeStatus = "ausstehend" | "bestaetigt" | "ueberfaellig" | "ueberholt";

export interface KenntnisnahmeRepo {
  /**
   * Legt die Anforderung an — mit genau den Empfängern, die für (Eintrag, Fassung) noch KEINEN
   * Eintrag haben. Ist keiner neu, entsteht keine Anforderung (`angelegt: false`).
   */
  anlegen(
    anforderung: Kenntnisnahmeanforderung,
    empfaenger: readonly string[],
  ): Promise<{ angelegt: boolean; neu: string[] }>;
  anforderung(id: string): Promise<Kenntnisnahmeanforderung | undefined>;
  anforderungenZu(koId: string): Promise<Kenntnisnahmeanforderung[]>;
  eintraegeZu(anforderungId: string): Promise<Kenntnisnahmeeintrag[]>;
  eintraegeFuer(empfaengerId: string): Promise<Kenntnisnahmeeintrag[]>;
  /**
   * Setzt die Bestätigung GENAU EINMAL. Eine weitere Bestätigung ändert nichts und liefert den
   * gespeicherten Eintrag mit `neu: false` zurück. `undefined`: diesen Eintrag gibt es nicht.
   */
  bestaetigen(
    anforderungId: string,
    empfaengerId: string,
    am: string,
  ): Promise<{ eintrag: Kenntnisnahmeeintrag; neu: boolean } | undefined>;
  erinnern(anforderungId: string, am: string): Promise<void>;
}

/**
 * Der Status eines Empfängers, gerechnet zum Zeitpunkt `jetzt`. Die Reihenfolge ist die Regel:
 * bestätigt vor überholt (eine Bestätigung bleibt an ihre Fassung gebunden), überholt vor
 * überfällig (eine Frist auf eine ersetzte Fassung mahnt nichts mehr an), und ohne Frist gibt es
 * kein „überfällig".
 */
export function kenntnisnahmeStatus(
  anforderung: Pick<Kenntnisnahmeanforderung, "fassung" | "frist">,
  eintrag: Pick<Kenntnisnahmeeintrag, "bestaetigtAm">,
  aktuelleFassung: number,
  jetzt: number,
): KenntnisnahmeStatus {
  if (eintrag.bestaetigtAm !== null) {
    return "bestaetigt";
  }
  if (aktuelleFassung > anforderung.fassung) {
    return "ueberholt";
  }
  if (anforderung.frist !== null && jetzt > Date.parse(anforderung.frist)) {
    return "ueberfaellig";
  }
  return "ausstehend";
}

// ================================================================================================
// DIE SPEICHERFASSUNG (Tests, Dev ohne Datenbank).
// ================================================================================================

export class InMemoryKenntnisnahmeRepo implements KenntnisnahmeRepo {
  private readonly anforderungen = new Map<string, Kenntnisnahmeanforderung>();
  private readonly eintraege = new Map<string, Kenntnisnahmeeintrag>();

  /**
   * `haltbarkeitZugesagt`: der Betrieb sagt Haltbarkeit zu (Desktop-Journal), diese Ablage kann sie
   * aber nicht halten. Dann lehnt sie jeden Schreibvorgang ab, statt eine Bestätigung anzunehmen
   * und beim Neustart zu verlieren — dieselbe Regel wie bei der flüchtigen Anweisungsablage.
   */
  constructor(private readonly haltbarkeitZugesagt = false) {}

  private static schluessel(koId: string, fassung: number, empfaengerId: string): string {
    return JSON.stringify([koId, fassung, empfaengerId]);
  }

  private pruefeHaltbarkeit(): void {
    if (this.haltbarkeitZugesagt) {
      throw new KenntnisnahmeFehler(
        503,
        "nicht_haltbar",
        "Diese Instanz kann Kenntnisnahmen nicht dauerhaft ablegen.",
      );
    }
  }

  async anlegen(
    anforderung: Kenntnisnahmeanforderung,
    empfaenger: readonly string[],
  ): Promise<{ angelegt: boolean; neu: string[] }> {
    this.pruefeHaltbarkeit();
    const neu = [...new Set(empfaenger)].filter(
      (id) =>
        !this.eintraege.has(
          InMemoryKenntnisnahmeRepo.schluessel(anforderung.koId, anforderung.fassung, id),
        ),
    );
    if (neu.length === 0) {
      return { angelegt: false, neu: [] };
    }
    this.anforderungen.set(anforderung.id, { ...anforderung });
    for (const id of neu) {
      this.eintraege.set(
        InMemoryKenntnisnahmeRepo.schluessel(anforderung.koId, anforderung.fassung, id),
        {
          anforderungId: anforderung.id,
          koId: anforderung.koId,
          fassung: anforderung.fassung,
          empfaengerId: id,
          bestaetigtAm: null,
        },
      );
    }
    return { angelegt: true, neu };
  }

  async anforderung(id: string): Promise<Kenntnisnahmeanforderung | undefined> {
    const treffer = this.anforderungen.get(id);
    return treffer ? { ...treffer } : undefined;
  }

  async anforderungenZu(koId: string): Promise<Kenntnisnahmeanforderung[]> {
    return [...this.anforderungen.values()].filter((a) => a.koId === koId).map((a) => ({ ...a }));
  }

  async eintraegeZu(anforderungId: string): Promise<Kenntnisnahmeeintrag[]> {
    return [...this.eintraege.values()]
      .filter((e) => e.anforderungId === anforderungId)
      .map((e) => ({ ...e }));
  }

  async eintraegeFuer(empfaengerId: string): Promise<Kenntnisnahmeeintrag[]> {
    return [...this.eintraege.values()]
      .filter((e) => e.empfaengerId === empfaengerId)
      .map((e) => ({ ...e }));
  }

  async bestaetigen(
    anforderungId: string,
    empfaengerId: string,
    am: string,
  ): Promise<{ eintrag: Kenntnisnahmeeintrag; neu: boolean } | undefined> {
    this.pruefeHaltbarkeit();
    const eintrag = [...this.eintraege.values()].find(
      (e) => e.anforderungId === anforderungId && e.empfaengerId === empfaengerId,
    );
    if (!eintrag) {
      return undefined;
    }
    const neu = eintrag.bestaetigtAm === null;
    if (neu) {
      eintrag.bestaetigtAm = am;
    }
    return { eintrag: { ...eintrag }, neu };
  }

  async erinnern(anforderungId: string, am: string): Promise<void> {
    this.pruefeHaltbarkeit();
    const anforderung = this.anforderungen.get(anforderungId);
    if (anforderung) {
      anforderung.erinnertAm = am;
    }
  }
}

// ================================================================================================
// DIE POSTGRESQL-FASSUNG.
// ================================================================================================

/**
 * Zwei Tabellen: der Kopf der Anforderung und je Empfänger eine Zeile. Der eindeutige Schlüssel
 * (Eintrag, Fassung, Empfänger) ist die Sperre gegen doppelte Aufforderungen — auch zwischen zwei
 * gleichzeitigen Requests mehrerer App-Prozesse. Rein additiv und wiederholbar.
 */
export const KENNTNISNAHME_SCHEMA = `
CREATE TABLE IF NOT EXISTS kenntnisnahme_anforderungen (
  id text PRIMARY KEY,
  ko_id text NOT NULL,
  fassung integer NOT NULL,
  angefordert_von text NOT NULL,
  angefordert_am timestamptz NOT NULL,
  frist timestamptz,
  erinnert_am timestamptz
);
CREATE INDEX IF NOT EXISTS idx_kenntnisnahme_anforderungen_ko ON kenntnisnahme_anforderungen(ko_id);
CREATE TABLE IF NOT EXISTS kenntnisnahme_empfaenger (
  anforderung_id text NOT NULL REFERENCES kenntnisnahme_anforderungen(id),
  ko_id text NOT NULL,
  fassung integer NOT NULL,
  empfaenger_id text NOT NULL,
  bestaetigt_am timestamptz,
  PRIMARY KEY (anforderung_id, empfaenger_id),
  UNIQUE (ko_id, fassung, empfaenger_id)
);
CREATE INDEX IF NOT EXISTS idx_kenntnisnahme_empfaenger_person ON kenntnisnahme_empfaenger(empfaenger_id);
`;

interface AnforderungsZeile {
  id: string;
  ko_id: string;
  fassung: number;
  angefordert_von: string;
  angefordert_am: Date;
  frist: Date | null;
  erinnert_am: Date | null;
}

interface EintragsZeile {
  anforderung_id: string;
  ko_id: string;
  fassung: number;
  empfaenger_id: string;
  bestaetigt_am: Date | null;
}

const iso = (wert: Date | null): string | null => (wert ? new Date(wert).toISOString() : null);

function anforderungAus(zeile: AnforderungsZeile): Kenntnisnahmeanforderung {
  return {
    id: zeile.id,
    koId: zeile.ko_id,
    fassung: Number(zeile.fassung),
    angefordertVon: zeile.angefordert_von,
    angefordertAm: new Date(zeile.angefordert_am).toISOString(),
    frist: iso(zeile.frist),
    erinnertAm: iso(zeile.erinnert_am),
  };
}

function eintragAus(zeile: EintragsZeile): Kenntnisnahmeeintrag {
  return {
    anforderungId: zeile.anforderung_id,
    koId: zeile.ko_id,
    fassung: Number(zeile.fassung),
    empfaengerId: zeile.empfaenger_id,
    bestaetigtAm: iso(zeile.bestaetigt_am),
  };
}

const ANFORDERUNG_SPALTEN =
  "id, ko_id, fassung, angefordert_von, angefordert_am, frist, erinnert_am";
const EINTRAG_SPALTEN = "anforderung_id, ko_id, fassung, empfaenger_id, bestaetigt_am";

export class PgKenntnisnahmeRepo implements KenntnisnahmeRepo {
  constructor(private readonly pool: Pool) {}

  async anlegen(
    anforderung: Kenntnisnahmeanforderung,
    empfaenger: readonly string[],
  ): Promise<{ angelegt: boolean; neu: string[] }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO kenntnisnahme_anforderungen (${ANFORDERUNG_SPALTEN})
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          anforderung.id,
          anforderung.koId,
          anforderung.fassung,
          anforderung.angefordertVon,
          anforderung.angefordertAm,
          anforderung.frist,
          anforderung.erinnertAm,
        ],
      );
      // Ein gleichzeitiger zweiter Request wartet am eindeutigen Schlüssel, bis der erste
      // festgeschrieben ist, und trägt dann keinen dieser Empfänger ein zweites Mal ein. Sortiert,
      // damit zwei Requests mit überlappenden Empfängern in derselben Reihenfolge sperren.
      const res = await client.query<{ empfaenger_id: string }>(
        `INSERT INTO kenntnisnahme_empfaenger (anforderung_id, ko_id, fassung, empfaenger_id)
         SELECT $1, $2, $3, e FROM unnest($4::text[]) AS e
         ON CONFLICT (ko_id, fassung, empfaenger_id) DO NOTHING
         RETURNING empfaenger_id`,
        [anforderung.id, anforderung.koId, anforderung.fassung, [...new Set(empfaenger)].sort()],
      );
      if (res.rows.length === 0) {
        await client.query("ROLLBACK");
        return { angelegt: false, neu: [] };
      }
      await client.query("COMMIT");
      return { angelegt: true, neu: res.rows.map((z) => z.empfaenger_id) };
    } catch (fehler) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw fehler;
    } finally {
      client.release();
    }
  }

  async anforderung(id: string): Promise<Kenntnisnahmeanforderung | undefined> {
    const res = await this.pool.query<AnforderungsZeile>(
      `SELECT ${ANFORDERUNG_SPALTEN} FROM kenntnisnahme_anforderungen WHERE id=$1`,
      [id],
    );
    const zeile = res.rows[0];
    return zeile ? anforderungAus(zeile) : undefined;
  }

  async anforderungenZu(koId: string): Promise<Kenntnisnahmeanforderung[]> {
    const res = await this.pool.query<AnforderungsZeile>(
      `SELECT ${ANFORDERUNG_SPALTEN} FROM kenntnisnahme_anforderungen WHERE ko_id=$1`,
      [koId],
    );
    return res.rows.map(anforderungAus);
  }

  async eintraegeZu(anforderungId: string): Promise<Kenntnisnahmeeintrag[]> {
    const res = await this.pool.query<EintragsZeile>(
      `SELECT ${EINTRAG_SPALTEN} FROM kenntnisnahme_empfaenger WHERE anforderung_id=$1`,
      [anforderungId],
    );
    return res.rows.map(eintragAus);
  }

  async eintraegeFuer(empfaengerId: string): Promise<Kenntnisnahmeeintrag[]> {
    const res = await this.pool.query<EintragsZeile>(
      `SELECT ${EINTRAG_SPALTEN} FROM kenntnisnahme_empfaenger WHERE empfaenger_id=$1`,
      [empfaengerId],
    );
    return res.rows.map(eintragAus);
  }

  async bestaetigen(
    anforderungId: string,
    empfaengerId: string,
    am: string,
  ): Promise<{ eintrag: Kenntnisnahmeeintrag; neu: boolean } | undefined> {
    // Nur eine noch offene Zeile wird geschrieben; die Zeilensperre lässt einen gleichzeitigen
    // zweiten Request danach nichts mehr finden. Er liest dann die ERSTE Bestätigung nach.
    const res = await this.pool.query<EintragsZeile>(
      `UPDATE kenntnisnahme_empfaenger SET bestaetigt_am = $3
       WHERE anforderung_id=$1 AND empfaenger_id=$2 AND bestaetigt_am IS NULL
       RETURNING ${EINTRAG_SPALTEN}`,
      [anforderungId, empfaengerId, am],
    );
    const geschrieben = res.rows[0];
    if (geschrieben) {
      return { eintrag: eintragAus(geschrieben), neu: true };
    }
    const vorhanden = await this.pool.query<EintragsZeile>(
      `SELECT ${EINTRAG_SPALTEN} FROM kenntnisnahme_empfaenger
       WHERE anforderung_id=$1 AND empfaenger_id=$2`,
      [anforderungId, empfaengerId],
    );
    const zeile = vorhanden.rows[0];
    return zeile ? { eintrag: eintragAus(zeile), neu: false } : undefined;
  }

  async erinnern(anforderungId: string, am: string): Promise<void> {
    await this.pool.query("UPDATE kenntnisnahme_anforderungen SET erinnert_am=$2 WHERE id=$1", [
      anforderungId,
      am,
    ]);
  }
}

// ================================================================================================
// DER DIENST.
// ================================================================================================

/** Ein fachlicher Fehler dieses Vorgangs — `grund` ist die maschinenlesbare Ursache. */
export class KenntnisnahmeFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 503,
    readonly grund: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "KenntnisnahmeFehler";
  }
}

/** Was der Dienst von einem Konto braucht — strukturgleich zu `PublicUser`. */
export interface KenntnisnahmeKonto {
  id: string;
  name: string;
  role: Role;
  approved: boolean;
  accessExpiresAt?: string;
}

/** Was der Dienst vom Eintragsbestand braucht — genau `get`, verdrahtet mit `services.ko`. */
export interface KenntnisnahmeKoLeser {
  get(id: string): Promise<KnowledgeObject | undefined>;
}

export interface KenntnisnahmeDienstDeps {
  repo: KenntnisnahmeRepo;
  ko: KenntnisnahmeKoLeser;
  konten: () => Promise<readonly KenntnisnahmeKonto[]>;
  /** Die Uhr in Millisekunden — injiziert, damit Frist und Überfälligkeit stellbar sind. */
  jetzt: () => number;
  kennung: () => string;
}

export interface AnforderungsEingabe {
  fassung: number;
  empfaenger: readonly string[];
  frist: string | null;
}

export interface AnforderungsErgebnis {
  angelegt: boolean;
  /** Kennung der neuen Anforderung — `null`, wenn alle Empfänger schon angefordert waren. */
  anforderungId: string | null;
  /** Neu eingetragene Empfänger. */
  neu: string[];
  /** Empfänger, die diese Fassung schon angefordert bekommen hatten — kein zweites Mal. */
  bereits: string[];
}

export interface EmpfaengerStand {
  id: string;
  name: string;
  status: KenntnisnahmeStatus;
  bestaetigtAm: string | null;
  /** Bestätigt, aber nach Ablauf der Frist. */
  nachFrist: boolean;
  /** Darf der Empfänger den Eintrag JETZT noch sehen? `false`: Zugriff inzwischen entzogen. */
  zugriff: boolean;
}

export interface AnforderungsStand {
  id: string;
  fassung: number;
  angefordertVon: { id: string; name: string };
  angefordertAm: string;
  frist: string | null;
  erinnertAm: string | null;
  zaehlung: Record<KenntnisnahmeStatus, number>;
  empfaenger: EmpfaengerStand[];
}

/** Die eigene Anforderung eines Empfängers, samt des Eintrags, an dem die Sichtbarkeit hängt. */
export interface EigeneKenntnisnahme {
  anforderung: Kenntnisnahmeanforderung;
  eintrag: Kenntnisnahmeeintrag;
  ko: KnowledgeObject;
}

/** Ein offener Hinweis für die Glocke — der Feed filtert ihn noch über die Sichtbarkeit. */
export interface KenntnisnahmeMeldung {
  anforderungId: string;
  koId: string;
  title: string;
  fassung: number;
  at: string;
  erinnerung: boolean;
  ueberfaellig: boolean;
}

function zugangAbgelaufen(konto: KenntnisnahmeKonto, jetzt: number): boolean {
  if (konto.accessExpiresAt === undefined) {
    return false;
  }
  const ende = Date.parse(konto.accessExpiresAt);
  return Number.isFinite(ende) && ende <= jetzt;
}

export class KenntnisnahmeDienst {
  constructor(private readonly deps: KenntnisnahmeDienstDeps) {}

  /**
   * Darf dieses Konto den Eintrag JETZT sehen? Dieselbe Entscheidung wie an jeder Leseroute:
   * freigegebenes, nicht abgelaufenes Konto mit `ko.read` und `darfSehen`.
   */
  zugriffsberechtigt(konto: KenntnisnahmeKonto, ko: KnowledgeObject): boolean {
    return (
      konto.approved &&
      !zugangAbgelaufen(konto, this.deps.jetzt()) &&
      can(konto.role, "ko.read") &&
      darfSehen({ id: konto.id, role: konto.role }, ko)
    );
  }

  /** Die sichtbaren Kontonamen — keine E-Mail, kein Kontakt. */
  async kontoNamen(): Promise<Map<string, string>> {
    return new Map((await this.deps.konten()).map((k) => [k.id, k.name]));
  }

  async moeglicheEmpfaenger(ko: KnowledgeObject): Promise<Array<{ id: string; name: string }>> {
    return (await this.deps.konten())
      .filter((k) => this.zugriffsberechtigt(k, ko))
      .map((k) => ({ id: k.id, name: k.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Fordert die Kenntnisnahme der gültigen Fassung an. Ein Entwurf (Status nicht `validiert`) wird
   * nicht als Pflichtlektüre verteilt, und die Fassung muss die sein, die der Anfordernde gesehen
   * hat — sonst würde eine inzwischen geänderte Fassung angefordert.
   */
  async anfordern(
    ko: KnowledgeObject,
    eingabe: AnforderungsEingabe,
    anfordernder: string,
  ): Promise<AnforderungsErgebnis> {
    if (ko.status !== "validiert") {
      throw new KenntnisnahmeFehler(
        409,
        "keine_gueltige_fassung",
        "Dieser Eintrag hat keine gültige Fassung; ein Entwurf wird nicht zur Kenntnisnahme verteilt.",
      );
    }
    if (eingabe.fassung !== ko.version) {
      throw new KenntnisnahmeFehler(
        409,
        "fassung_veraltet",
        "Die angeforderte Fassung ist nicht mehr die aktuelle gültige Fassung.",
        { aktuelleFassung: ko.version },
      );
    }
    const jetzt = this.deps.jetzt();
    const frist = eingabe.frist === null ? null : Date.parse(eingabe.frist);
    if (frist !== null && !(Number.isFinite(frist) && frist > jetzt)) {
      throw new KenntnisnahmeFehler(
        400,
        "frist_ungueltig",
        "Die Frist liegt nicht in der Zukunft.",
      );
    }
    const empfaenger = [...new Set(eingabe.empfaenger)];
    if (empfaenger.length === 0) {
      throw new KenntnisnahmeFehler(400, "keine_empfaenger", "Es ist kein Empfänger ausgewählt.");
    }
    const konten = new Map((await this.deps.konten()).map((k) => [k.id, k]));
    const ohneZugriff = empfaenger.filter((id) => {
      const konto = konten.get(id);
      return !konto || !this.zugriffsberechtigt(konto, ko);
    });
    if (ohneZugriff.length > 0) {
      throw new KenntnisnahmeFehler(
        400,
        "empfaenger_ohne_zugriff",
        "Mindestens ein Empfänger darf diesen Eintrag nicht lesen; die Anforderung gibt keinen Zugriff.",
        { empfaenger: ohneZugriff },
      );
    }
    const anforderungId = this.deps.kennung();
    const ergebnis = await this.deps.repo.anlegen(
      {
        id: anforderungId,
        koId: ko.id,
        fassung: ko.version,
        angefordertVon: anfordernder,
        angefordertAm: new Date(jetzt).toISOString(),
        frist: frist === null ? null : new Date(frist).toISOString(),
        erinnertAm: null,
      },
      empfaenger,
    );
    const neu = new Set(ergebnis.neu);
    return {
      angelegt: ergebnis.angelegt,
      anforderungId: ergebnis.angelegt ? anforderungId : null,
      neu: ergebnis.neu,
      bereits: empfaenger.filter((id) => !neu.has(id)),
    };
  }

  /** Alle Anforderungen zu diesem Eintrag, neueste zuerst — für die zuständige Übersicht. */
  async uebersicht(ko: KnowledgeObject): Promise<AnforderungsStand[]> {
    const jetzt = this.deps.jetzt();
    const konten = new Map((await this.deps.konten()).map((k) => [k.id, k]));
    const name = (id: string): string => konten.get(id)?.name ?? "";
    const anforderungen = await this.deps.repo.anforderungenZu(ko.id);
    anforderungen.sort((a, b) => b.angefordertAm.localeCompare(a.angefordertAm));
    const staende: AnforderungsStand[] = [];
    for (const anforderung of anforderungen) {
      const zaehlung: Record<KenntnisnahmeStatus, number> = {
        ausstehend: 0,
        bestaetigt: 0,
        ueberfaellig: 0,
        ueberholt: 0,
      };
      const empfaenger = (await this.deps.repo.eintraegeZu(anforderung.id))
        .map((eintrag): EmpfaengerStand => {
          const status = kenntnisnahmeStatus(anforderung, eintrag, ko.version, jetzt);
          zaehlung[status] += 1;
          const konto = konten.get(eintrag.empfaengerId);
          return {
            id: eintrag.empfaengerId,
            name: name(eintrag.empfaengerId),
            status,
            bestaetigtAm: eintrag.bestaetigtAm,
            nachFrist:
              eintrag.bestaetigtAm !== null &&
              anforderung.frist !== null &&
              Date.parse(eintrag.bestaetigtAm) > Date.parse(anforderung.frist),
            zugriff: konto !== undefined && this.zugriffsberechtigt(konto, ko),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      staende.push({
        id: anforderung.id,
        fassung: anforderung.fassung,
        angefordertVon: { id: anforderung.angefordertVon, name: name(anforderung.angefordertVon) },
        angefordertAm: anforderung.angefordertAm,
        frist: anforderung.frist,
        erinnertAm: anforderung.erinnertAm,
        zaehlung,
        empfaenger,
      });
    }
    return staende;
  }

  /** Die Anforderungen an dieses Konto — ohne Sichtbarkeitsfilter (den fährt die Route). */
  async eigene(nutzerId: string): Promise<EigeneKenntnisnahme[]> {
    const ergebnis: EigeneKenntnisnahme[] = [];
    for (const eintrag of await this.deps.repo.eintraegeFuer(nutzerId)) {
      const [anforderung, ko] = await Promise.all([
        this.deps.repo.anforderung(eintrag.anforderungId),
        this.deps.ko.get(eintrag.koId),
      ]);
      if (anforderung && ko) {
        ergebnis.push({ anforderung, eintrag, ko });
      }
    }
    ergebnis.sort((a, b) => b.anforderung.angefordertAm.localeCompare(a.anforderung.angefordertAm));
    return ergebnis;
  }

  /** Die eigene Anforderung `anforderungId` — `undefined`, wenn sie nicht an dieses Konto geht. */
  async eigeneZu(
    anforderungId: string,
    nutzerId: string,
  ): Promise<EigeneKenntnisnahme | undefined> {
    const anforderung = await this.deps.repo.anforderung(anforderungId);
    if (!anforderung) {
      return undefined;
    }
    const eintrag = (await this.deps.repo.eintraegeZu(anforderungId)).find(
      (e) => e.empfaengerId === nutzerId,
    );
    const ko = await this.deps.ko.get(anforderung.koId);
    return eintrag && ko ? { anforderung, eintrag, ko } : undefined;
  }

  /** Die Anforderung samt Eintrag — für die Wege des Anfordernden (Erinnern). */
  async anforderungMitKo(
    anforderungId: string,
  ): Promise<{ anforderung: Kenntnisnahmeanforderung; ko: KnowledgeObject } | undefined> {
    const anforderung = await this.deps.repo.anforderung(anforderungId);
    const ko = anforderung ? await this.deps.ko.get(anforderung.koId) : undefined;
    return anforderung && ko ? { anforderung, ko } : undefined;
  }

  /** Der Status eines eigenen Eintrags, gerechnet jetzt. */
  statusVon(eigene: EigeneKenntnisnahme): KenntnisnahmeStatus {
    return kenntnisnahmeStatus(
      eigene.anforderung,
      eigene.eintrag,
      eigene.ko.version,
      this.deps.jetzt(),
    );
  }

  /**
   * Die ausdrückliche Bestätigung des Empfängers — der EINZIGE Weg, auf dem sie entsteht.
   * `fassung` ist die Fassung, die der Empfänger vor sich hatte; sie muss die angeforderte sein.
   * Eine zweite Bestätigung ändert nichts (`bereits: true`).
   */
  async bestaetigen(
    eigene: EigeneKenntnisnahme,
    fassung: number,
  ): Promise<{ eintrag: Kenntnisnahmeeintrag; bereits: boolean }> {
    if (fassung !== eigene.anforderung.fassung) {
      throw new KenntnisnahmeFehler(
        409,
        "fassung_abweichend",
        "Die bestätigte Fassung ist nicht die angeforderte.",
        { angeforderteFassung: eigene.anforderung.fassung },
      );
    }
    if (eigene.eintrag.bestaetigtAm !== null) {
      return { eintrag: eigene.eintrag, bereits: true };
    }
    if (eigene.ko.version > eigene.anforderung.fassung) {
      throw new KenntnisnahmeFehler(
        409,
        "ueberholt",
        "Diese Fassung ist durch eine neuere ersetzt; eine Bestätigung ist nicht mehr möglich.",
        { aktuelleFassung: eigene.ko.version },
      );
    }
    const ergebnis = await this.deps.repo.bestaetigen(
      eigene.anforderung.id,
      eigene.eintrag.empfaengerId,
      new Date(this.deps.jetzt()).toISOString(),
    );
    if (!ergebnis) {
      throw new KenntnisnahmeFehler(404, "nicht_gefunden", "Anforderung nicht gefunden.");
    }
    // Lief ein gleichzeitiger Request vor diesem durch, steht dessen Zeitpunkt fest.
    return { eintrag: ergebnis.eintrag, bereits: !ergebnis.neu };
  }

  /**
   * Erinnert alle noch offenen Empfänger (ausstehend oder überfällig) über die Glocke. Ein
   * überholter oder bestätigter Eintrag wird nicht erinnert. Liefert die Zahl der Erinnerten.
   */
  async erinnern(anforderung: Kenntnisnahmeanforderung, ko: KnowledgeObject): Promise<number> {
    const jetzt = this.deps.jetzt();
    const offen = (await this.deps.repo.eintraegeZu(anforderung.id)).filter((e) => {
      const status = kenntnisnahmeStatus(anforderung, e, ko.version, jetzt);
      return status === "ausstehend" || status === "ueberfaellig";
    });
    if (offen.length > 0) {
      await this.deps.repo.erinnern(anforderung.id, new Date(jetzt).toISOString());
    }
    return offen.length;
  }

  /**
   * Die offenen Kenntnisnahmen dieses Kontos als Hinweise für die vorhandene Glocke. Je
   * Anforderung EIN Hinweis — eine Erinnerung ersetzt ihn durch einen neuen, statt einen zweiten
   * daneben zu stellen.
   */
  async meldungenFuer(nutzerId: string): Promise<KenntnisnahmeMeldung[]> {
    const jetzt = this.deps.jetzt();
    const meldungen: KenntnisnahmeMeldung[] = [];
    for (const eigene of await this.eigene(nutzerId)) {
      const status = kenntnisnahmeStatus(
        eigene.anforderung,
        eigene.eintrag,
        eigene.ko.version,
        jetzt,
      );
      if (status !== "ausstehend" && status !== "ueberfaellig") {
        continue;
      }
      meldungen.push({
        anforderungId: eigene.anforderung.id,
        koId: eigene.ko.id,
        title: eigene.ko.title,
        fassung: eigene.anforderung.fassung,
        at: eigene.anforderung.erinnertAm ?? eigene.anforderung.angefordertAm,
        erinnerung: eigene.anforderung.erinnertAm !== null,
        ueberfaellig: status === "ueberfaellig",
      });
    }
    return meldungen;
  }
}

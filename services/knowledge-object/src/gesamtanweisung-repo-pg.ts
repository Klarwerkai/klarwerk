// ================================================================================================
// JOB 4154 · WIKI-GESAMTANWEISUNG — DER DAUERHAFTE BESTAND.
// ================================================================================================
//
// Der Postgres-Adapter der Anweisung, im Muster von `repo-pg.ts:786-900` (`PgKoVersionRepo`,
// `PgEvidenceRepo`): ein `Pool` im Konstruktor, jede schreibende Operation in EINER Transaktion,
// der bedingte UPDATE über die Version als Compare-and-Set (`repo-pg.ts:412-437`).
//
// ================================================================================================
// JOB 4309 · DIE DDL HEISST JETZT `GESAMTANWEISUNG_SCHEMA` UND WIRD WIRKLICH MIGRIERT.
// ================================================================================================
//
// `services/app/src/db.migrate.test.ts:47-60` durchsucht ALLE `.ts`-Quellen unter `services/` mit
//
//     /export const (\w+_SCHEMA)\s*=\s*`([\s\S]*?)`/g
//
// und verlangt für jede so gefundene DDL-Stufe einen Eintrag in der `schemas`-Liste von
// `services/app/src/db.ts`. Das ist die Lehre SCRUM-496 und sie ist richtig: eine Tabelle, die
// niemand migriert, fehlt auf Postgres.
//
// BIS JOB 4309 stand die DDL hier als MODULINTERNE Konstante `GESAMTANWEISUNG_TABELLEN_DDL`, weil
// `db.ts` in den Durchgängen 4154/4156 anderen Bahnen gehörte und eine exportierte `*_SCHEMA`-
// Konstante den Wächter rot gemacht hätte, ohne dass ihn jemand beheben durfte. Der Preis dafür
// stand ausgeschrieben da: auf einer frisch migrierten Datenbank fehlten die drei Tabellen, bis
// jemand `migriere()` von Hand rief.
//
// JOB 4309 löst genau das ein — und zwar so, wie es der Kopf dieser Datei selbst verlangt hat
// („Wer diese Konstante exportiert, MUSS sie im selben Zug in `db.ts` eintragen"):
//   · sie heisst `GESAMTANWEISUNG_SCHEMA` und ist exportiert (der Wächter sieht sie),
//   · `services/knowledge-object/index.ts` reicht sie über die Modulgrenze weiter,
//   · `services/app/src/db.ts` führt sie in `schemas`, also legt `migrate()` die drei Tabellen an.
//
// ES BLEIBT BEI EINER WAHRHEIT. `migriere()` unten führt DIESELBE Konstante aus, die auch
// `migrate()` fährt — die Methode ist damit kein zweiter Migrationsweg mehr, sondern nur noch der
// Handgriff, den Prüfstände brauchen, die ohne die Kompositionswurzel arbeiten.
import type { Pool } from "pg";
import { type Queryable, pgQueryable, withPgTx } from "../../db-tx";
import type {
  Anweisung,
  AnweisungRepo,
  AnweisungStand,
  AnweisungStandAufnahme,
  Baustein,
} from "./gesamtanweisung-types";
import { anweisungFehler } from "./gesamtanweisung-types";

// ================================================================================================
// DIE DDL
// ================================================================================================
//
// Drei Tabellen, und jede trägt eine eigene Aussage:
//   `gesamtanweisungen`            — der Kopf samt CAS-Version und Stand.
//   `gesamtanweisung_bausteine`    — die geordnete Folge der GEBUNDENEN Fassungen.
//   `gesamtanweisung_staende`      — die festgehaltenen Prüfstände, append-only.
//
// Die dritte Tabelle ist eine begründete Ergänzung zum Wortlaut des Auftrags („Tabellen für
// Anweisung und Bausteine"): „zwei Stände vergleichen" braucht einen zweiten Stand, und der
// Startvertrag verlangt ihn ausdrücklich („Festgehaltener Prüfstand"). Ohne sie gäbe es nur
// „jetzt gegen jetzt", und der Vergleich wäre eine Scheinfunktion.
//
// DIE SPALTE HEISST `pos` UND NICHT `position`: `POSITION` ist in PostgreSQL ein Schlüsselwort
// (SQL-Funktion `position(… in …)`) und müsste sonst überall gequotet werden. Ein Quotingfehler
// in einem späteren Zusatz wäre ein Laufzeitfehler, kein Compilerfehler.
//
// ADDITIV: kein DROP, kein TRUNCATE, kein UPDATE auf Bestandsdaten. `IF NOT EXISTS` durchgehend,
// damit die Stufe beliebig oft laufen darf.
export const GESAMTANWEISUNG_SCHEMA = `
CREATE TABLE IF NOT EXISTS gesamtanweisungen (
  id text PRIMARY KEY,
  version int NOT NULL,
  stand text NOT NULL,
  titel text NOT NULL,
  zweck text NOT NULL,
  geltungsbereich text NOT NULL,
  voraussetzungen text NOT NULL,
  urheber text NOT NULL,
  erstellt_am text NOT NULL,
  geaendert_am text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gesamtanweisungen_stand ON gesamtanweisungen(stand);

CREATE TABLE IF NOT EXISTS gesamtanweisung_bausteine (
  anweisung_id text NOT NULL REFERENCES gesamtanweisungen(id) ON DELETE CASCADE,
  id text NOT NULL,
  pos int NOT NULL,
  ko_id text NOT NULL,
  ko_version int NOT NULL,
  nachweis_hash text,
  voraussetzung text,
  PRIMARY KEY (anweisung_id, id)
);
CREATE INDEX IF NOT EXISTS idx_gesamtanweisung_bausteine_folge ON gesamtanweisung_bausteine(anweisung_id, pos);
CREATE INDEX IF NOT EXISTS idx_gesamtanweisung_bausteine_fassung ON gesamtanweisung_bausteine(ko_id, ko_version);

CREATE TABLE IF NOT EXISTS gesamtanweisung_staende (
  anweisung_id text NOT NULL REFERENCES gesamtanweisungen(id) ON DELETE CASCADE,
  version int NOT NULL,
  aufnahme jsonb NOT NULL,
  aufgenommen_am text NOT NULL,
  PRIMARY KEY (anweisung_id, version)
);
`;

interface KopfZeile {
  id: string;
  version: number;
  stand: string;
  titel: string;
  zweck: string;
  geltungsbereich: string;
  voraussetzungen: string;
  urheber: string;
  erstellt_am: string;
  geaendert_am: string;
}

interface BausteinZeile {
  id: string;
  pos: number;
  ko_id: string;
  ko_version: number;
  nachweis_hash: string | null;
  voraussetzung: string | null;
}

interface AufnahmeZeile {
  aufnahme: AnweisungStandAufnahme;
}

interface VersionZeile {
  version: number;
}

const STAENDE: readonly AnweisungStand[] = ["entwurf", "vorgelegt", "entschieden", "abgelehnt"];

/**
 * Ein fremder Wert in der Standspalte wird NICHT stillschweigend zu „entwurf".
 *
 * Ein unbekannter Stand hiesse: diese Zeile stammt aus einer Fassung, die dieses Programm nicht
 * kennt. Sie als Entwurf zu lesen würde eine entschiedene Anweisung wieder bearbeitbar machen —
 * die teuerste denkbare Auslegung. Fail-closed heisst hier: abbrechen.
 */
function alsStand(wert: string): AnweisungStand {
  const treffer = STAENDE.find((s) => s === wert);
  if (!treffer) {
    throw anweisungFehler("INVALID", "Unbekannter Stand im Bestand.");
  }
  return treffer;
}

export class PgAnweisungRepo implements AnweisungRepo {
  constructor(private readonly pool: Pool) {}

  /**
   * Die Tabellen anlegen.
   *
   * SEIT JOB 4309 IST SIE KEIN PRODUKTWEG MEHR: die Anwendung legt die drei Tabellen über
   * `migrate()` an (`services/app/src/db.ts`, `GESAMTANWEISUNG_SCHEMA`). Diese Methode bleibt als
   * idempotenter Selbststart für Prüfstände, die ohne die Kompositionswurzel arbeiten — sie führt
   * DIESELBE Konstante aus, es gibt also keine zweite DDL-Wahrheit, und `IF NOT EXISTS` macht den
   * doppelten Lauf folgenlos.
   */
  async migriere(): Promise<void> {
    await this.pool.query(GESAMTANWEISUNG_SCHEMA);
  }

  async get(id: string): Promise<Anweisung | undefined> {
    const kopf = await this.pool.query<KopfZeile>(
      `SELECT id,version,stand,titel,zweck,geltungsbereich,voraussetzungen,urheber,erstellt_am,geaendert_am
         FROM gesamtanweisungen WHERE id=$1`,
      [id],
    );
    const zeile = kopf.rows[0];
    if (!zeile) {
      return undefined;
    }
    const bausteine = await this.pool.query<BausteinZeile>(
      `SELECT id,pos,ko_id,ko_version,nachweis_hash,voraussetzung
         FROM gesamtanweisung_bausteine WHERE anweisung_id=$1 ORDER BY pos`,
      [id],
    );
    return {
      id: zeile.id,
      titel: zeile.titel,
      zweck: zeile.zweck,
      geltungsbereich: zeile.geltungsbereich,
      voraussetzungen: zeile.voraussetzungen,
      bausteine: bausteine.rows.map(alsBaustein),
      stand: alsStand(zeile.stand),
      version: zeile.version,
      urheber: zeile.urheber,
      erstelltAm: zeile.erstellt_am,
      geaendertAm: zeile.geaendert_am,
    };
  }

  /**
   * Anlegen — Kopf, Bausteinfolge und der ERSTE Prüfstand in EINER Transaktion.
   *
   * Auch hier gilt der Grund aus `schreiben` unten: eine Anweisung, deren Anlage gelungen ist und
   * deren erster Prüfstand fehlt, hat eine Historie mit einem Loch am Anfang.
   */
  async anlegen(anweisung: Anweisung, aufnahme: AnweisungStandAufnahme): Promise<void> {
    await withPgTx(this.pool, async (tx) => {
      const q = pgQueryable(tx);
      const res = await q.query(
        `INSERT INTO gesamtanweisungen(id,version,stand,titel,zweck,geltungsbereich,voraussetzungen,urheber,erstellt_am,geaendert_am)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [
          anweisung.id,
          anweisung.version,
          anweisung.stand,
          anweisung.titel,
          anweisung.zweck,
          anweisung.geltungsbereich,
          anweisung.voraussetzungen,
          anweisung.urheber,
          anweisung.erstelltAm,
          anweisung.geaendertAm,
        ],
      );
      if (res.rowCount === 0) {
        throw anweisungFehler("CONFLICT", "Diese Anweisung gibt es bereits.");
      }
      await schreibeBausteine(q, anweisung);
      await haltePruefstandFest(q, aufnahme);
    });
  }

  /**
   * Compare-and-Set, wörtlich im Muster von `PgKoRepo.update` (`repo-pg.ts:419-437`): der UPDATE
   * trägt die erwartete Version in der WHERE-Klausel; `rowCount === 0` heisst „jemand war
   * schneller" und nicht „Fehler". Die Bausteine werden in DERSELBEN Transaktion ersetzt — ein
   * Kopf ohne passende Folge wäre ein halber Schreibvorgang.
   *
   * ===========================================================================================
   * UND DER PRÜFSTAND GEHÖRT IN DIESELBE KLAMMER — der Befund aus Runde 2, hier behoben.
   * ===========================================================================================
   *
   * BENs Messung: bis hierher stand der Historien-INSERT als eigener Aufruf `standFesthalten`
   * NEBEN dieser Transaktion, und der Dienst rief ihn danach. `withPgTx` committet aber bereits
   * am Ende dieses Rumpfes. Scheiterte der zweite Aufruf, war der Bestand geschrieben und die
   * Historie nicht — gemessen an seiner Gegenprobe: Titel „Nachher", Version 2, historische
   * Versionen `[1]`.
   *
   * Das ist kein Schönheitsfehler. Der Auftrag verspricht, dass der Server „nur genau den
   * vorgelegten unveränderten Prüfstand" bestätigt, und der Vergleich zweier Stände liest genau
   * diese Historie. Ein Loch darin merkt niemand beim Schreiben — erst beim Vergleichen, und dann
   * ist der ausgelassene Zwischenstand für immer weg.
   *
   * `haltePruefstandFest` läuft deshalb auf DEMSELBEN Transaktionsclient wie der UPDATE und das
   * Ersetzen der Bausteine. Scheitert er, rollt `withPgTx` alles zurück — Kopf, Version, Stand,
   * Bausteinfolge. Der Aufrufer sieht dann einen Fehler UND den unveränderten Vorherbestand, und
   * ein Wiederholversuch hinterlässt genau einen vollständigen Stand.
   */
  async schreiben(
    anweisung: Anweisung,
    erwartet: number,
    aufnahme: AnweisungStandAufnahme,
  ): Promise<void> {
    await withPgTx(this.pool, async (tx) => {
      const q = pgQueryable(tx);
      const res = await q.query(
        `UPDATE gesamtanweisungen
            SET version=$2,stand=$3,titel=$4,zweck=$5,geltungsbereich=$6,voraussetzungen=$7,geaendert_am=$8
          WHERE id=$1 AND version=$9`,
        [
          anweisung.id,
          anweisung.version,
          anweisung.stand,
          anweisung.titel,
          anweisung.zweck,
          anweisung.geltungsbereich,
          anweisung.voraussetzungen,
          anweisung.geaendertAm,
          erwartet,
        ],
      );
      if (res.rowCount === 0) {
        const aktuell = await q.query<{ version: number; stand: string }>(
          "SELECT version,stand FROM gesamtanweisungen WHERE id=$1",
          [anweisung.id],
        );
        const zeile = aktuell.rows[0];
        if (!zeile) {
          throw anweisungFehler("NOT_FOUND", "Diese Anweisung gibt es nicht.");
        }
        throw anweisungFehler(
          "CONFLICT",
          "Die Anweisung wurde zwischenzeitlich geändert — bitte erneut lesen.",
          { stand: alsStand(zeile.stand), version: zeile.version },
        );
      }
      await q.query("DELETE FROM gesamtanweisung_bausteine WHERE anweisung_id=$1", [anweisung.id]);
      await schreibeBausteine(q, anweisung);
      await haltePruefstandFest(q, aufnahme);
    });
  }

  async standLesen(
    anweisungId: string,
    version: number,
  ): Promise<AnweisungStandAufnahme | undefined> {
    const res = await this.pool.query<AufnahmeZeile>(
      "SELECT aufnahme FROM gesamtanweisung_staende WHERE anweisung_id=$1 AND version=$2",
      [anweisungId, version],
    );
    return res.rows[0]?.aufnahme;
  }

  async staende(anweisungId: string): Promise<readonly number[]> {
    const res = await this.pool.query<VersionZeile>(
      "SELECT version FROM gesamtanweisung_staende WHERE anweisung_id=$1 ORDER BY version",
      [anweisungId],
    );
    return res.rows.map((row) => row.version);
  }

  /**
   * ==============================================================================================
   * JOB 4357 · DER GANZE BESTAND — ZWEI ABFRAGEN, NICHT EINE JE ANWEISUNG.
   * ==============================================================================================
   *
   * ZWEI ABFRAGEN UND KEIN N+1: der Kopfsatz aller Anweisungen, dann ALLE Bausteinzeilen in einem
   * Zug, danach im Speicher zugeordnet. `get()` oben fährt zwei Abfragen für EINE Anweisung; dieselbe
   * Form je Zeile wäre bei fünfzig Anweisungen einhunderteine Abfrage für eine Menüansicht.
   *
   * KEIN `JOIN`, und das ist eine Entscheidung mit Grund: ein Join über die Bausteine vervielfacht
   * den Kopf je Baustein, und die Zusammenfassung müsste dann im Anwendungsspeicher dieselbe
   * Gruppierung leisten wie hier — bei mehr übertragenen Bytes. Zwei schlanke Abfragen sind hier
   * ehrlicher und billiger.
   *
   * KEIN TRIMM UND KEINE SORTIERUNG (Begründung am Port, `AnweisungRepo.liste`). Die `ORDER BY`
   * unten ist deshalb KEINE Zusage an den Aufrufer, sondern nur eine feste Zeilenfolge: `pos`
   * ordnet die Bausteine einer Anweisung — die Reihenfolge IST Teil der Gesamtfassung
   * (`gesamtanweisung-types.ts`, `Baustein.position`) — und `id` macht den Lauf über die Köpfe
   * wiederholbar, was jede Fehlersuche billiger macht. Wer sich auf sie verlässt, steht in
   * `GesamtanweisungDienst.auflisten` und sortiert selbst.
   *
   * KEIN `LIMIT`: eine stillschweigend abgeschnittene Liste wäre die gefährlichste Antwort dieses
   * Endpunkts — sie sähe vollständig aus. Eine echte Seitenteilung braucht einen Cursor, eine
   * Zählauskunft und die Sichtbarkeitsentscheidung VOR dem `LIMIT`
   * (`services/app/src/sichtbarkeit.ts:113-128`, wörtlich); nichts davon ist Gegenstand dieses
   * Auftrags, und ein halbes davon wäre schlechter als keins. Die Grenze ist damit benannt und nicht
   * überspielt: die Liste trägt den ganzen Bestand.
   */
  async liste(): Promise<readonly Anweisung[]> {
    const koepfe = await this.pool.query<KopfZeile>(
      `SELECT id,version,stand,titel,zweck,geltungsbereich,voraussetzungen,urheber,erstellt_am,geaendert_am
         FROM gesamtanweisungen ORDER BY id`,
    );
    if (koepfe.rows.length === 0) {
      return [];
    }
    const bausteine = await this.pool.query<BausteinZeile & { anweisung_id: string }>(
      `SELECT anweisung_id,id,pos,ko_id,ko_version,nachweis_hash,voraussetzung
         FROM gesamtanweisung_bausteine ORDER BY anweisung_id, pos`,
    );
    const jeAnweisung = new Map<string, Baustein[]>();
    for (const zeile of bausteine.rows) {
      const folge = jeAnweisung.get(zeile.anweisung_id);
      if (folge) {
        folge.push(alsBaustein(zeile));
      } else {
        jeAnweisung.set(zeile.anweisung_id, [alsBaustein(zeile)]);
      }
    }
    return koepfe.rows.map((zeile) => ({
      id: zeile.id,
      titel: zeile.titel,
      zweck: zeile.zweck,
      geltungsbereich: zeile.geltungsbereich,
      voraussetzungen: zeile.voraussetzungen,
      bausteine: jeAnweisung.get(zeile.id) ?? [],
      // Dasselbe fail-closed wie in `get()`: ein fremder Stand bricht ab, statt zu „entwurf" zu
      // werden. Eine LISTE darf das nicht milder auslegen als der Einzelabruf — sonst hinge die
      // Bewertung derselben Zeile davon ab, über welchen Weg sie gelesen wird.
      stand: alsStand(zeile.stand),
      version: zeile.version,
      urheber: zeile.urheber,
      erstelltAm: zeile.erstellt_am,
      geaendertAm: zeile.geaendert_am,
    }));
  }
}

function alsBaustein(zeile: BausteinZeile): Baustein {
  const kern = {
    id: zeile.id,
    position: zeile.pos,
    koId: zeile.ko_id,
    koVersion: zeile.ko_version,
    nachweisHash: zeile.nachweis_hash,
  };
  // `exactOptionalPropertyTypes`: ein leeres Feld wird WEGGELASSEN, nicht als `undefined` gesetzt.
  return zeile.voraussetzung ? { ...kern, voraussetzung: zeile.voraussetzung } : kern;
}

/**
 * Den Prüfstand festhalten — auf dem ÜBERGEBENEN Queryable, nie auf dem Pool.
 *
 * Genau das ist der Unterschied zum Stand vor Runde 3: die Funktion nimmt `q` entgegen und kann
 * deshalb gar nicht mehr an der Transaktion ihres Aufrufers vorbeischreiben. Wer sie künftig mit
 * `poolQueryable(pool)` ruft, öffnet die Lücke wieder — dann steht sie wenigstens in der Zeile.
 *
 * `ON CONFLICT DO NOTHING`: ein festgehaltener Stand ist unveränderlich (Muster `ko_versions`,
 * `repo-pg.ts:786`). Ein Wiederholversuch nach einem zurückgerollten Schreibvorgang legt ihn
 * deshalb genau einmal an.
 */
async function haltePruefstandFest(q: Queryable, aufnahme: AnweisungStandAufnahme): Promise<void> {
  await q.query(
    `INSERT INTO gesamtanweisung_staende(anweisung_id,version,aufnahme,aufgenommen_am)
       VALUES($1,$2,$3,$4) ON CONFLICT (anweisung_id, version) DO NOTHING`,
    [aufnahme.anweisungId, aufnahme.version, JSON.stringify(aufnahme), aufnahme.aufgenommenAm],
  );
}

async function schreibeBausteine(q: Queryable, anweisung: Anweisung): Promise<void> {
  for (const baustein of anweisung.bausteine) {
    await q.query(
      `INSERT INTO gesamtanweisung_bausteine(anweisung_id,id,pos,ko_id,ko_version,nachweis_hash,voraussetzung)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        anweisung.id,
        baustein.id,
        baustein.position,
        baustein.koId,
        baustein.koVersion,
        baustein.nachweisHash,
        baustein.voraussetzung ?? null,
      ],
    );
  }
}

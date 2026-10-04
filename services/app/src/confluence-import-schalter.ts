import type { Pool } from "pg";

// ================================================================================================
// R-0134 / R-1005 — DER BETREIBERSCHALTER DES CONFLUENCE-IMPORTS, UMLEGBAR ÜBER DIE OBERFLÄCHE.
// ================================================================================================
//
// WOZU DAS DA IST: Ein Betreiber soll den Confluence-Import über die Oberfläche WIRKLICH ein- und
// ausschalten können (R-0134: „Ein Betreiber soll den Import damit wirklich ein- und ausschalten
// koennen"; R-1005: „ohne Fachwissen über die Oberfläche starten und einstellen"). Bis hierher
// ging das nur über die Umgebungsvariable `KLARWERK_CONFLUENCE_IMPORT` und einen Neustart.
//
// ZWEI EBENEN, UND WARUM ES ZWEI SIND — NICHT EINE:
//
//   1. DIE FREIGABE DER INSTALLATION bleibt `KLARWERK_CONFLUENCE_IMPORT` (feature-flags.ts). Sie
//      entscheidet beim Aufbau mehr als die Anwesenheit der Routen: u. a. ob der Annahmeweg den
//      Herkunftsanker schreibt (`externalUpsert`, build-app.ts). Das lässt sich nicht zur Laufzeit
//      nachholen, ohne den Importkern umzubauen — und die Zugangsdaten stehen nach Pedis
//      Entscheidung vom 30.07. ohnehin ausschließlich in der Umgebung.
//   2. DER BETREIBERSCHALTER (diese Datei) legt den Import INNERHALB einer freigegebenen
//      Installation an oder aus — gespeichert, ohne Neustart, mit `users.manage`, im Prüfprotokoll.
//      Jede Confluence-Importroute fragt ihn je Anfrage (confluence-import-routes.ts,
//      `betreiberSperre`) — er ist eine durchgesetzte Sperre, keine Anzeige.
//
// DIE VORGABE IST „AN": Eine Instanz, an der niemand den Schalter umgelegt hat, verhält sich
// GENAU wie vor diesem Auftrag — freigegeben heißt dann eingeschaltet. `version: 0` heißt „nie
// gesetzt" und ist von der ersten echten Änderung (`1`) unterscheidbar.
//
// KEIN GEHEIMNIS: Der Stand trägt genau einen Ja/Nein-Wert und eine Änderungszahl. Es gibt keinen
// Platz, in den ein Zugangswert passen würde.
//
// DREI DINGE GEHÖREN ZUSAMMEN (dieselbe Regel wie bei der Markenwahl, branding-settings.ts): die
// DDL unten, ihr Eintrag in der ausgeführten `schemas`-Liste (`db.ts`), ihr Eintrag in der
// Migrations-Sollliste (`migrationsbeleg.ts`) — und als vierte der Pflichtsatz des Restore-Drills
// (`scripts/backup/restore-drill.sh`, gehalten von `tests/backup-drill/tabellensatz.test.ts`).

/** Der gespeicherte Stand: eingeschaltet ja/nein, und wie oft er geändert wurde. */
export interface ConfluenceImportSchalterStand {
  an: boolean;
  version: number;
}

/** Nie gesetzt: an — das Verhalten vor diesem Auftrag. */
export const CONFLUENCE_IMPORT_SCHALTER_VORGABE: ConfluenceImportSchalterStand = Object.freeze({
  an: true,
  version: 0,
});

/** Alter und neuer Stand eines Umlegens — das Prüfprotokoll braucht beide. */
export interface ConfluenceImportSchalterWechsel {
  vorher: ConfluenceImportSchalterStand;
  nachher: ConfluenceImportSchalterStand;
}

export interface ConfluenceImportSchalterRepo {
  /** Der aktuelle Stand — nie gesetzt heißt Vorgabe, nicht `null`. */
  lies(): Promise<ConfluenceImportSchalterStand>;
  /** Setzt den Schalter und erhöht die Version um 1. */
  setze(an: boolean): Promise<ConfluenceImportSchalterWechsel>;
}

export class InMemoryConfluenceImportSchalterRepo implements ConfluenceImportSchalterRepo {
  private stand: ConfluenceImportSchalterStand = { ...CONFLUENCE_IMPORT_SCHALTER_VORGABE };

  lies(): Promise<ConfluenceImportSchalterStand> {
    return Promise.resolve({ ...this.stand });
  }

  setze(an: boolean): Promise<ConfluenceImportSchalterWechsel> {
    const vorher = this.stand;
    const nachher: ConfluenceImportSchalterStand = { an, version: vorher.version + 1 };
    this.stand = nachher;
    return Promise.resolve({ vorher: { ...vorher }, nachher: { ...nachher } });
  }
}

/**
 * Die eine Zeile des Schalters. Rein additiv und wiederholbar: `CREATE TABLE IF NOT EXISTS`, kein
 * `DROP`, kein `DELETE FROM`, kein `TRUNCATE`, kein `UPDATE … SET`, kein Fremdschlüssel, kein Seed
 * (eine vorbelegte Zeile verbrauchte `version: 0` = „nie gesetzt").
 */
export const CONFLUENCE_IMPORT_SCHALTER_SCHEMA = `
CREATE TABLE IF NOT EXISTS confluence_import_schalter (
  key text PRIMARY KEY,
  an boolean NOT NULL,
  version integer NOT NULL
);
`;

const SCHALTER_SCHLUESSEL = "confluence_import";

interface SchalterZeile {
  vorher_an: boolean | null;
  vorher_version: number | null;
  nachher_an: boolean;
  nachher_version: number;
}

/**
 * Die haltbare Ablage des Postgres-Betriebs — dieselbe Bauform wie `PgBrandingSettingsRepo`:
 * `setze()` ist EINE Anweisung, die Version steigt aus dem GESPEICHERTEN Wert, ein Datenbankfehler
 * wird durchgereicht (eine still gelieferte Vorgabe „an" wäre eine Behauptung ohne Grundlage).
 */
export class PgConfluenceImportSchalterRepo implements ConfluenceImportSchalterRepo {
  constructor(private readonly pool: Pool) {}

  async lies(): Promise<ConfluenceImportSchalterStand> {
    const res = await this.pool.query<{ an: boolean; version: number }>(
      "SELECT an, version FROM confluence_import_schalter WHERE key=$1",
      [SCHALTER_SCHLUESSEL],
    );
    const zeile = res.rows[0];
    if (!zeile) {
      return { ...CONFLUENCE_IMPORT_SCHALTER_VORGABE };
    }
    return { an: zeile.an, version: zeile.version };
  }

  async setze(an: boolean): Promise<ConfluenceImportSchalterWechsel> {
    const res = await this.pool.query<SchalterZeile>(
      `WITH vorher AS (
         SELECT an, version FROM confluence_import_schalter WHERE key=$1
       ), nachher AS (
         INSERT INTO confluence_import_schalter(key, an, version)
         VALUES($1,$2,1)
         ON CONFLICT (key) DO UPDATE SET
           an = EXCLUDED.an,
           version = confluence_import_schalter.version + 1
         RETURNING an, version
       )
       SELECT
         (SELECT an FROM vorher) AS vorher_an,
         (SELECT version FROM vorher) AS vorher_version,
         nachher.an AS nachher_an,
         nachher.version AS nachher_version
       FROM nachher`,
      [SCHALTER_SCHLUESSEL, an],
    );
    const zeile = res.rows[0];
    if (!zeile) {
      throw new Error(
        "confluence_import_schalter: die Schreibanweisung lieferte keine Zeile zurück",
      );
    }
    const vorher: ConfluenceImportSchalterStand =
      zeile.vorher_version === null
        ? { ...CONFLUENCE_IMPORT_SCHALTER_VORGABE }
        : { an: zeile.vorher_an === true, version: zeile.vorher_version };
    return { vorher, nachher: { an: zeile.nachher_an, version: zeile.nachher_version } };
  }
}

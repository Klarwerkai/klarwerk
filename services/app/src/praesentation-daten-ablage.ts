import type { Pool } from "pg";
import type { Datenpunkt } from "./praesentation-daten";

// ================================================================================================
// KLARA POWERPOINT · PP-02 — DIE ABLAGE DER DATENPUNKTE.
// ================================================================================================
//
// Je Datenpunkt EINE Zeile mit seinem vollständigen Stand (Inhalt, Prüfungen, Bindungen,
// Korrekturen). Geschrieben wird BEDINGT gegen den gelesenen Speicherstand (`stand`) — zwei
// gleichzeitige Wirkungen überschreiben einander nicht still; die zweite bekommt an der Route 409.
//
// WAS HIER NICHT STEHT: Rechte. Wer was sehen darf, entscheidet bei jedem Zugriff die Route über
// den Heimatartikel, die Quellen und die Zielpräsentationen (`praesentation-daten.ts`, `sicht`).

export interface DatenpunktAblage {
  lesen(id: string): Promise<Datenpunkt | undefined>;
  /** Legt an. `false`, wenn die Kennung schon vergeben ist. */
  anlegen(dp: Datenpunkt): Promise<boolean>;
  /** Ersetzt nur, wenn der gespeicherte Stand noch `erwartet` ist. */
  ersetzen(dp: Datenpunkt, erwartet: number): Promise<boolean>;
  /** Die Datenpunkte eines Heimatartikels, älteste zuerst. */
  vonArtikel(koId: string): Promise<Datenpunkt[]>;
  /** Die Datenpunkte mit mindestens einer Bindung an diesen Anhang dieses Artikels. */
  gebundenAn(koId: string, anhangId: string): Promise<Datenpunkt[]>;
}

function kopie<T>(wert: T): T {
  return JSON.parse(JSON.stringify(wert)) as T;
}

/** Die Speicherfassung (Tests, Dev ohne Datenbank) — übersteht keinen Neustart. */
export class SpeicherDatenpunktAblage implements DatenpunktAblage {
  private readonly zeilen = new Map<string, Datenpunkt>();

  lesen(id: string): Promise<Datenpunkt | undefined> {
    const zeile = this.zeilen.get(id);
    return Promise.resolve(zeile ? kopie(zeile) : undefined);
  }

  anlegen(dp: Datenpunkt): Promise<boolean> {
    if (this.zeilen.has(dp.id)) {
      return Promise.resolve(false);
    }
    this.zeilen.set(dp.id, kopie(dp));
    return Promise.resolve(true);
  }

  ersetzen(dp: Datenpunkt, erwartet: number): Promise<boolean> {
    const vorher = this.zeilen.get(dp.id);
    if (!vorher || vorher.stand !== erwartet) {
      return Promise.resolve(false);
    }
    this.zeilen.set(dp.id, kopie(dp));
    return Promise.resolve(true);
  }

  vonArtikel(koId: string): Promise<Datenpunkt[]> {
    return Promise.resolve(
      [...this.zeilen.values()].filter((d) => d.heimatKoId === koId).map(kopie),
    );
  }

  gebundenAn(koId: string, anhangId: string): Promise<Datenpunkt[]> {
    return Promise.resolve(
      [...this.zeilen.values()]
        .filter((d) => d.bindungen.some((b) => b.koId === koId && b.anhangId === anhangId))
        .map(kopie),
    );
  }
}

/**
 * Die Tabelle der Datenpunkte. Rein additiv und wiederholbar (`CREATE … IF NOT EXISTS`), ohne
 * Fremdschlüssel: Artikel, Anhänge und Konten werden über ihre Kennungen genannt; ein gelöschter
 * Artikel macht den Datenpunkt bei der nächsten Rechteprüfung unlesbar.
 */
export const PRAESENTATION_DATEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS praesentation_datenpunkte (
  id text PRIMARY KEY,
  heimat_ko text NOT NULL,
  stand integer NOT NULL,
  eintrag jsonb NOT NULL,
  angelegt_am timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_praesentation_datenpunkte_heimat ON praesentation_datenpunkte(heimat_ko);
`;

export class PgDatenpunktAblage implements DatenpunktAblage {
  constructor(private readonly pool: Pool) {}

  async lesen(id: string): Promise<Datenpunkt | undefined> {
    const res = await this.pool.query<{ eintrag: Datenpunkt }>(
      "SELECT eintrag FROM praesentation_datenpunkte WHERE id=$1",
      [id],
    );
    return res.rows[0]?.eintrag;
  }

  async anlegen(dp: Datenpunkt): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO praesentation_datenpunkte (id, heimat_ko, stand, eintrag)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [dp.id, dp.heimatKoId, dp.stand, JSON.stringify(dp)],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async ersetzen(dp: Datenpunkt, erwartet: number): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE praesentation_datenpunkte SET stand=$2, eintrag=$3::jsonb
        WHERE id=$1 AND stand=$4`,
      [dp.id, dp.stand, JSON.stringify(dp), erwartet],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async vonArtikel(koId: string): Promise<Datenpunkt[]> {
    const res = await this.pool.query<{ eintrag: Datenpunkt }>(
      `SELECT eintrag FROM praesentation_datenpunkte WHERE heimat_ko=$1
        ORDER BY angelegt_am, id`,
      [koId],
    );
    return res.rows.map((z) => z.eintrag);
  }

  async gebundenAn(koId: string, anhangId: string): Promise<Datenpunkt[]> {
    const res = await this.pool.query<{ eintrag: Datenpunkt }>(
      `SELECT eintrag FROM praesentation_datenpunkte
        WHERE eintrag->'bindungen' @> jsonb_build_array(jsonb_build_object('koId', $1::text, 'anhangId', $2::text))
        ORDER BY angelegt_am, id`,
      [koId, anhangId],
    );
    return res.rows.map((z) => z.eintrag);
  }
}

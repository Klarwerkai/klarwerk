// ================================================================================================
// OFFICE IM ARTIKEL · DIE ABLAGE DER EDITOR-SITZUNGEN UND GESICHERTEN KONFLIKTSTÄNDE.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-artikel-editor`, Nacharbeit 2 (bens Befund): Was die Fläche als
// „gesichert" anzeigt, muss einen Neustart der App überleben — sonst ist die Zusage „nichts geht
// verloren" eine Behauptung über den Arbeitsspeicher eines Prozesses. Ebenso die laufenden
// Editor-Sitzungen (Sperre, Sitzungsbasis, Arbeitsstand): ein neu gestarteter App-Prozess muss die
// Sitzung, die der Editor weiterführt, wiedererkennen, damit sein Entsperren den Arbeitsstand
// übernimmt oder sichert statt ihn zu vergessen.
//
// ZWEI FASSUNGEN, dieselbe Schnittstelle:
//   · `SpeicherOfficeAblage` — ohne Datenbank (Entwicklung, Tests). Ein Neustart verliert sie; das
//     ist dort die bekannte Grenze jeder Speicherfassung.
//   · `PgOfficeAblage` — im Postgres-Betrieb (`buildPgServices`). Zwei additive Tabellen
//     (`OFFICE_ABLAGE_SCHEMA`), ohne Fremdschlüssel. Die Objektkennungen stehen als Text in den
//     Tabellen; der Waisenlauf (`datenintegritaet.ts`, Scan über alle Textspalten) hält damit jeden
//     gesicherten Stand und jeden Arbeitsstand von selbst vom Aufräumen fern.

import type { Pool } from "pg";
import type { EditorSitzung, WopiSitzungsablage } from "./office-wopi-host";

/** Ein Arbeitsstand, der beim Schließen wegen einer fremden Änderung NICHT übernommen wurde. */
export interface GesicherterOfficeStand {
  readonly koId: string;
  readonly anhangId: string;
  readonly objectId: string;
  /** Wer zuletzt in dieser Sitzung gespeichert hat; leer, wenn unbekannt. */
  readonly nutzerId: string;
  readonly at: string;
}

export interface OfficeAblage extends WopiSitzungsablage {
  /** Vermerkt, wer in der laufenden Sitzung zuletzt gespeichert hat. */
  merkeSchreiber(anhangId: string, nutzerId: string): Promise<void>;
  schreiber(anhangId: string): Promise<string | undefined>;
  /** Idempotent je (Anhang, Objekt). */
  sichere(stand: GesicherterOfficeStand): Promise<void>;
  gesicherte(anhangId: string): Promise<GesicherterOfficeStand[]>;
  entferneGesichert(anhangId: string, objectId: string): Promise<void>;
}

export class SpeicherOfficeAblage implements OfficeAblage {
  private readonly sitzungen = new Map<string, EditorSitzung>();
  private readonly schreiberJe = new Map<string, string>();
  private readonly gesichert = new Map<string, GesicherterOfficeStand[]>();

  async lies(anhangId: string): Promise<EditorSitzung | undefined> {
    return this.sitzungen.get(anhangId);
  }

  async schreibe(anhangId: string, sitzung: EditorSitzung | undefined): Promise<void> {
    if (sitzung === undefined) {
      this.sitzungen.delete(anhangId);
      this.schreiberJe.delete(anhangId);
    } else {
      this.sitzungen.set(anhangId, sitzung);
    }
  }

  async merkeSchreiber(anhangId: string, nutzerId: string): Promise<void> {
    this.schreiberJe.set(anhangId, nutzerId);
  }

  async schreiber(anhangId: string): Promise<string | undefined> {
    return this.schreiberJe.get(anhangId);
  }

  async sichere(stand: GesicherterOfficeStand): Promise<void> {
    const liste = this.gesichert.get(stand.anhangId) ?? [];
    if (!liste.some((s) => s.objectId === stand.objectId)) {
      this.gesichert.set(stand.anhangId, [...liste, stand]);
    }
  }

  async gesicherte(anhangId: string): Promise<GesicherterOfficeStand[]> {
    return [...(this.gesichert.get(anhangId) ?? [])];
  }

  async entferneGesichert(anhangId: string, objectId: string): Promise<void> {
    this.gesichert.set(
      anhangId,
      (this.gesichert.get(anhangId) ?? []).filter((s) => s.objectId !== objectId),
    );
  }
}

/**
 * Additiv und wiederholbar (CREATE TABLE/INDEX IF NOT EXISTS), ohne Fremdschlüssel und ohne
 * Extension. Eine Zeile zu einem gelöschten Artikel ist verwaist, aber harmlos: gelesen wird nur über
 * einen sichtbaren Artikel und dessen Anhang.
 */
export const OFFICE_ABLAGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS office_sitzungen (
  anhang_id text PRIMARY KEY,
  sitzung jsonb NOT NULL,
  schreiber text
);
CREATE TABLE IF NOT EXISTS office_gesichert (
  anhang_id text NOT NULL,
  object_id text NOT NULL,
  ko_id text NOT NULL,
  nutzer_id text NOT NULL,
  at timestamptz NOT NULL,
  PRIMARY KEY (anhang_id, object_id)
);
CREATE INDEX IF NOT EXISTS idx_office_gesichert_ko ON office_gesichert(ko_id);
`;

export class PgOfficeAblage implements OfficeAblage {
  constructor(private readonly pool: Pool) {}

  async lies(anhangId: string): Promise<EditorSitzung | undefined> {
    const res = await this.pool.query<{ sitzung: EditorSitzung }>(
      "SELECT sitzung FROM office_sitzungen WHERE anhang_id=$1",
      [anhangId],
    );
    return res.rows[0]?.sitzung;
  }

  async schreibe(anhangId: string, sitzung: EditorSitzung | undefined): Promise<void> {
    if (sitzung === undefined) {
      await this.pool.query("DELETE FROM office_sitzungen WHERE anhang_id=$1", [anhangId]);
      return;
    }
    // Der Schreiber bleibt beim Fortschreiben derselben Sitzung stehen (eigene Spalte).
    await this.pool.query(
      `INSERT INTO office_sitzungen (anhang_id, sitzung) VALUES ($1, $2::jsonb)
       ON CONFLICT (anhang_id) DO UPDATE SET sitzung = EXCLUDED.sitzung`,
      [anhangId, JSON.stringify(sitzung)],
    );
  }

  async merkeSchreiber(anhangId: string, nutzerId: string): Promise<void> {
    await this.pool.query("UPDATE office_sitzungen SET schreiber=$2 WHERE anhang_id=$1", [
      anhangId,
      nutzerId,
    ]);
  }

  async schreiber(anhangId: string): Promise<string | undefined> {
    const res = await this.pool.query<{ schreiber: string | null }>(
      "SELECT schreiber FROM office_sitzungen WHERE anhang_id=$1",
      [anhangId],
    );
    return res.rows[0]?.schreiber ?? undefined;
  }

  async sichere(stand: GesicherterOfficeStand): Promise<void> {
    await this.pool.query(
      `INSERT INTO office_gesichert (anhang_id, object_id, ko_id, nutzer_id, at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (anhang_id, object_id) DO NOTHING`,
      [stand.anhangId, stand.objectId, stand.koId, stand.nutzerId, stand.at],
    );
  }

  async gesicherte(anhangId: string): Promise<GesicherterOfficeStand[]> {
    const res = await this.pool.query<{
      anhang_id: string;
      object_id: string;
      ko_id: string;
      nutzer_id: string;
      at: Date;
    }>(
      `SELECT anhang_id, object_id, ko_id, nutzer_id, at FROM office_gesichert
       WHERE anhang_id=$1 ORDER BY at, object_id`,
      [anhangId],
    );
    return res.rows.map((z) => ({
      koId: z.ko_id,
      anhangId: z.anhang_id,
      objectId: z.object_id,
      nutzerId: z.nutzer_id,
      at: new Date(z.at).toISOString(),
    }));
  }

  async entferneGesichert(anhangId: string, objectId: string): Promise<void> {
    await this.pool.query("DELETE FROM office_gesichert WHERE anhang_id=$1 AND object_id=$2", [
      anhangId,
      objectId,
    ]);
  }
}

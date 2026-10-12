import type { Pool } from "pg";
import type { MeetingZustand } from "./meeting-dokumentbezug";

// ================================================================================================
// BPA-16 · DIE ABLAGE DER MEETINGBEZÜGE (Nacharbeit 2, Bens Befund 1).
// ================================================================================================
//
// Je Meetingbezug EINE Zeile: wer ihn angelegt hat, wer teilnimmt, und der vollständige Zustand
// der Bindungsschicht (`MeetingZustand`: verbundene Fassungen, Kopie → Original, Folienwechsel,
// Mitschriften, Rückmeldungen samt Historie, Änderungsobjekte). Geschrieben wird BEDINGT gegen die
// gelesene Version — zwei gleichzeitige Wirkungen überschreiben einander nicht still; die zweite
// bekommt an der Route 409 und liest neu.
//
// WAS HIER NICHT STEHT: Rechte. Die Ablage weiss nicht, wer was sehen darf; das entscheidet bei
// jedem Zugriff die Route (Meetingmitgliedschaft) zusammen mit dem Sichtbarkeitsurteil der
// Dateiobjekte (`beurteileAnhang`). Kein eigener Meetingkalender, keine zweite Assistenz.

export interface MeetingBezugEintrag {
  meetingId: string;
  titel: string;
  /** Wer den Bezug angelegt hat — Konto-Kennung aus der Anmeldung. */
  eigner: string;
  /** Konto-Kennungen mit Meetingrecht (neben dem Eigner). */
  teilnehmer: string[];
  /** Steigt mit jedem Schreiben; Grundlage des bedingten Schreibens. */
  version: number;
  angelegtAm: string;
  zustand: MeetingZustand;
}

export interface MeetingBezugAblage {
  lesen(meetingId: string): Promise<MeetingBezugEintrag | undefined>;
  /** Legt an. `false`, wenn die Kennung schon vergeben ist. */
  anlegen(eintrag: MeetingBezugEintrag): Promise<boolean>;
  /** Ersetzt nur, wenn die gespeicherte Version noch `erwartet` ist. */
  ersetzen(eintrag: MeetingBezugEintrag, erwartet: number): Promise<boolean>;
  /** Die Bezüge, an denen das Konto als Eigner oder Teilnehmer beteiligt ist. */
  fuerKonto(nutzerId: string): Promise<{ meetingId: string; titel: string; version: number }[]>;
}

function kopie<T>(wert: T): T {
  return JSON.parse(JSON.stringify(wert)) as T;
}

/** Die Speicherfassung (Tests, Dev ohne Datenbank) — übersteht keinen Neustart. */
export class SpeicherMeetingBezugAblage implements MeetingBezugAblage {
  private readonly zeilen = new Map<string, MeetingBezugEintrag>();

  lesen(meetingId: string): Promise<MeetingBezugEintrag | undefined> {
    const zeile = this.zeilen.get(meetingId);
    return Promise.resolve(zeile ? kopie(zeile) : undefined);
  }

  anlegen(eintrag: MeetingBezugEintrag): Promise<boolean> {
    if (this.zeilen.has(eintrag.meetingId)) {
      return Promise.resolve(false);
    }
    this.zeilen.set(eintrag.meetingId, kopie(eintrag));
    return Promise.resolve(true);
  }

  ersetzen(eintrag: MeetingBezugEintrag, erwartet: number): Promise<boolean> {
    const vorher = this.zeilen.get(eintrag.meetingId);
    if (!vorher || vorher.version !== erwartet) {
      return Promise.resolve(false);
    }
    this.zeilen.set(eintrag.meetingId, kopie(eintrag));
    return Promise.resolve(true);
  }

  fuerKonto(nutzerId: string): Promise<{ meetingId: string; titel: string; version: number }[]> {
    return Promise.resolve(
      [...this.zeilen.values()]
        .filter((z) => z.eigner === nutzerId || z.teilnehmer.includes(nutzerId))
        .map((z) => ({ meetingId: z.meetingId, titel: z.titel, version: z.version })),
    );
  }
}

/**
 * Die Tabelle der Meetingbezüge. Rein additiv und wiederholbar (`CREATE … IF NOT EXISTS`), ohne
 * Fremdschlüssel: Dateien und Konten werden über ihre Kennungen genannt; ein gelöschtes Dateiobjekt
 * macht die Folie bei der nächsten Rechteprüfung unlesbar, statt eine Migration scheitern zu lassen.
 */
export const MEETING_DOKUMENTBEZUG_SCHEMA = `
CREATE TABLE IF NOT EXISTS meeting_dokumentbezuege (
  meeting_id text PRIMARY KEY,
  eigner text NOT NULL,
  teilnehmer jsonb NOT NULL,
  version integer NOT NULL,
  eintrag jsonb NOT NULL,
  angelegt_am timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_dokumentbezuege_eigner ON meeting_dokumentbezuege(eigner);
`;

export class PgMeetingBezugAblage implements MeetingBezugAblage {
  constructor(private readonly pool: Pool) {}

  async lesen(meetingId: string): Promise<MeetingBezugEintrag | undefined> {
    const res = await this.pool.query<{ eintrag: MeetingBezugEintrag }>(
      "SELECT eintrag FROM meeting_dokumentbezuege WHERE meeting_id=$1",
      [meetingId],
    );
    return res.rows[0]?.eintrag;
  }

  async anlegen(eintrag: MeetingBezugEintrag): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO meeting_dokumentbezuege (meeting_id, eigner, teilnehmer, version, eintrag)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb)
       ON CONFLICT (meeting_id) DO NOTHING`,
      [
        eintrag.meetingId,
        eintrag.eigner,
        JSON.stringify(eintrag.teilnehmer),
        eintrag.version,
        JSON.stringify(eintrag),
      ],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async ersetzen(eintrag: MeetingBezugEintrag, erwartet: number): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE meeting_dokumentbezuege
          SET teilnehmer=$2::jsonb, version=$3, eintrag=$4::jsonb
        WHERE meeting_id=$1 AND version=$5`,
      [
        eintrag.meetingId,
        JSON.stringify(eintrag.teilnehmer),
        eintrag.version,
        JSON.stringify(eintrag),
        erwartet,
      ],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async fuerKonto(
    nutzerId: string,
  ): Promise<{ meetingId: string; titel: string; version: number }[]> {
    const res = await this.pool.query<{ meeting_id: string; titel: string; version: number }>(
      `SELECT meeting_id, eintrag->>'titel' AS titel, version FROM meeting_dokumentbezuege
        WHERE eigner=$1 OR teilnehmer @> jsonb_build_array($1::text)
        ORDER BY angelegt_am, meeting_id`,
      [nutzerId],
    );
    return res.rows.map((z) => ({ meetingId: z.meeting_id, titel: z.titel, version: z.version }));
  }
}

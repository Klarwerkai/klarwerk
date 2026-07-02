import type { Pool } from "pg";

// Audit-P3 (SCRUM-397): Gelesen-Status der Glocke. Die Benachrichtigungen selbst
// bleiben abgeleitet (keine eigene Persistenz) — gespeichert wird NUR, welche
// Benachrichtigungs-IDs eine Person bewusst als gesehen markiert hat. Datenhoheit
// liegt beim notifications-Modul (eigene Tabelle, kein Fremdzugriff).
export interface NotificationSeenRepo {
  markSeen(userId: string, ids: string[]): Promise<void>;
  seenFor(userId: string): Promise<string[]>;
}

// In-Memory-Variante (Tests/Dev). Idempotent: doppeltes Markieren ist kein Fehler.
export class InMemoryNotificationSeenRepo implements NotificationSeenRepo {
  private readonly byUser = new Map<string, Set<string>>();

  async markSeen(userId: string, ids: string[]): Promise<void> {
    const set = this.byUser.get(userId) ?? new Set<string>();
    for (const id of ids) {
      set.add(id);
    }
    this.byUser.set(userId, set);
  }

  async seenFor(userId: string): Promise<string[]> {
    return [...(this.byUser.get(userId) ?? new Set<string>())];
  }
}

export const NOTIFICATION_SEEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS notification_seen (
  user_id text NOT NULL,
  notif_id text NOT NULL,
  PRIMARY KEY (user_id, notif_id)
);
`;

interface SeenRow {
  notif_id: string;
}

// Postgres-Variante: gleiche Schnittstelle, ON CONFLICT macht Markieren idempotent.
export class PgNotificationSeenRepo implements NotificationSeenRepo {
  constructor(private readonly pool: Pool) {}

  async markSeen(userId: string, ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.pool.query(
        "INSERT INTO notification_seen(user_id,notif_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [userId, id],
      );
    }
  }

  async seenFor(userId: string): Promise<string[]> {
    const res = await this.pool.query<SeenRow>(
      "SELECT notif_id FROM notification_seen WHERE user_id=$1",
      [userId],
    );
    return res.rows.map((row) => row.notif_id);
  }
}

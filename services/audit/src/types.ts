// FR-AUD-01/02: lückenloses, append-only Audit-Log mit Hash-Kette.
export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
  // WP-SHIP8-CLOSE-6 (bens ROT-1): optionale, STABILE Event-Id für exactly-once-Belege
  // (recordOnce; z. B. "ko.created:<koId>"). Reiner Idempotenzschlüssel — geht NICHT in den
  // Ketten-Hash ein (hashEntry hasht die Inhaltsfelder; Altbestand ohne Feld bleibt verifizierbar).
  eventId?: string | undefined;
}

export interface AuditInput {
  actor: string;
  action: string;
  target: string;
  payload?: Record<string, unknown>;
}

export interface AuditFilter {
  actor?: string;
  action?: string;
  target?: string;
}

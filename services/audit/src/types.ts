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

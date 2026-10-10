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
  // JOB 498 D8: WELCHES HASHMATERIAL GILT FÜR DIESEN EINTRAG.
  //
  // Fehlend oder `1` bedeutet V1 — der Altbestand trägt das Feld nicht und bleibt damit ohne
  // jede Umrechnung bitgenau verifizierbar. `2` bedeutet V2 (domänengetrennt, längenpräfigiert,
  // kanonisierte Payload). JEDER ANDERE WERT ist ungültig und fällt fail-closed auf.
  //
  // ANDERS ALS `eventId` GEHT DIESES FELD IN DEN HASH EIN, und zwar als letztes Feld des
  // V2-Materials. Ohne diese Bindung wäre ein Downgrade auf `1` ein stiller Angriff: die Version
  // stünde neben dem Hash statt in ihm, und wer sie senkt, bekäme eine gültige V1-Prüfung
  // geschenkt. Deshalb ist sie Teil des Materials und nicht bloß ein Begleitwert.
  hashVersion?: number | undefined;
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

// produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DER SEITENWEISE LESEWEG DER VERWALTERSICHT.
//
// Bis hierher lud die Verwalteransicht das ganze Protokoll (`GET /api/audit`) und zeigte davon die
// letzten zwölf. Der Seitenweg liest stattdessen höchstens `limit` Einträge, jüngste zuerst, und
// nennt die Sequenz, ab der die nächste (ältere) Seite beginnt. Er ist ein ZUSÄTZLICHER Leseweg auf
// dieselbe Kette — `AuditFilter`, `list()` und alle bisherigen Aufrufer bleiben, wie sie sind.
export interface AuditSeitenFilter extends AuditFilter {
  /** Mehrere Aktionen zugleich (ODER) — etwa alle Konto- und Anmeldeereignisse der Auth-Ansicht. */
  actions?: readonly string[];
  /** Zeitraum über `at` (ISO-Zeitpunkt in UTC): `from` einschließlich, `to` ausschließlich. */
  from?: string;
  to?: string;
}

export interface AuditSeitenAnfrage extends AuditSeitenFilter {
  /** Nur Einträge mit `seq < before` — der Zeiger auf die nächste ältere Seite. */
  before?: number;
  limit?: number;
}

export interface AuditSeite {
  /** Höchstens `limit` Einträge, absteigend nach `seq` (jüngster zuerst). */
  entries: AuditEntry[];
  /** `before` der nächsten älteren Seite — `null`, wenn es keine ältere gibt. */
  nextBefore: number | null;
  /** Die tatsächlich angewandte Seitengröße (nach Begrenzung). */
  limit: number;
}

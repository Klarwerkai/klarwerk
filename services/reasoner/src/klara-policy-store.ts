import type { Pool, PoolClient } from "pg";

// ================================================================================================
// W1 S4 — PERSISTENZ VON KLARA-SITZUNG UND ZUSTIMMUNG (KW-S4-03 §1.1, §2.1)
// ================================================================================================
//
// WARUM DIE ABLAGE HIER LIEGT UND NICHT IM APP-MODUL. Alle vierzehn DDL-Konstanten des Repositories
// liegen in DOMÄNENMODULEN; `services/app/src` besitzt keine einzige — es komponiert sie nur in
// `db.ts`. Diese Datei folgt diesem Muster. Die SITZUNGS-ORCHESTRIERUNG (Guards, Bindungsprüfung,
// Invalidierung) liegt davon getrennt im App-Layer, genau wie KW-S4-04 §122 es verlangt:
// „HTTP- und Sitzungslogik im App-Layer ohne Policyduplikation".
//
// KEINE NEUE DOMÄNE. Das ist ausdrücklich kein eigenständiges Klara-Modul (No-Go KW-S4-04 §126),
// sondern die vorhandene Reasoner-Struktur, in der auch `reasoner_policy` und `assist_presets`
// wohnen.
//
// ADDITIV UND WIEDERHOLBAR wie überall: `CREATE TABLE IF NOT EXISTS`, kein DROP, kein TRUNCATE.

/**
 * DIE SITZUNG (KW-S4-03 §1.1). Sie ist an genau einen Actor, Tenant, eine Add-in-Instanz und einen
 * Dokumentkontext gebunden und nicht übertragbar.
 */
export const KLARA_SESSION_SCHEMA = `
CREATE TABLE IF NOT EXISTS klara_sessions (
  session_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  actor_id text NOT NULL,
  addin_instance_id text NOT NULL,
  document_context_id text NOT NULL,
  created_at text NOT NULL,
  last_activity_at text NOT NULL,
  expires_at text NOT NULL,
  policy_version text NOT NULL,
  configuration_version text NOT NULL,
  consent_state text NOT NULL,
  closed_at text,
  -- W1 S4 R2 (BEN ROT-2): die kanonische Identitaet der Auflösung, an die diese Sitzung gebunden
  -- ist. Ohne sie konnten Status, Sitzung und Consent unmöglich dieselbe Resolution referenzieren.
  resolution_id text,
  -- W1 S4 R4 (KW-S4-21 §2): das EINZIGE primäre CAS-Kriterium der Sitzung.
  session_revision bigint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_klara_sessions_actor
  ON klara_sessions(actor_id, addin_instance_id);
-- Additiv und wiederholbar, damit eine Bestandsinstanz aus R1 migriert statt zu brechen.
ALTER TABLE klara_sessions
  ADD COLUMN IF NOT EXISTS resolution_id text;
-- W1 S4 R4: dieselbe additive Form. \`NOT NULL DEFAULT 0\` macht jede Bestandszeile sofort
-- teilnahmefähig — kein Backfill, kein Sonderfall, kein NULL-Vergleich im CAS-Prädikat.
ALTER TABLE klara_sessions
  ADD COLUMN IF NOT EXISTS session_revision bigint NOT NULL DEFAULT 0;
`;

/**
 * DIE ZUSTIMMUNG (KW-S4-03 §2.1). Sie bindet den konkreten Anbieter-/Modell-/Payload-Umfang der
 * Sitzung — eine Zustimmung „für Klara allgemein" gibt es nicht.
 *
 * `allowed_payload_classes` steht als sortierte, kommagetrennte Liste. Der Vergleich beim Einlösen
 * ist damit eine Gleichheitsprüfung: eine zusätzlich verlangte Klasse fällt sofort auf, statt in
 * einer Teilmengenlogik unterzugehen.
 */
export const KLARA_CONSENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS klara_session_consents (
  consent_id text PRIMARY KEY,
  session_id text NOT NULL,
  tenant_id text NOT NULL,
  actor_id text NOT NULL,
  document_context_id text NOT NULL,
  consent_scope text NOT NULL,
  allowed_payload_classes text NOT NULL,
  provider_class text NOT NULL,
  provider_binding_id text NOT NULL,
  model_reference text NOT NULL,
  -- W1 S4 R6B (KW-S4-23 §1): der TATSÄCHLICHE Anbieter der gebundenen Auflösung.
  -- provider_class trägt nur die KLASSE (external/internal/deterministic), nicht den Anbieter
  -- selbst; ohne diese Spalte war die von §1 verlangte Bindung unvollständig.
  provider_reference text,
  policy_version text NOT NULL,
  configuration_version text NOT NULL,
  granted_at text NOT NULL,
  expires_at text NOT NULL,
  revoked_at text,
  status text NOT NULL,
  -- W1 S4 R2 (BEN ROT-2): dieselbe Resolution, an die auch Sitzung und Status gebunden sind.
  resolution_id text
);
CREATE INDEX IF NOT EXISTS idx_klara_consents_session
  ON klara_session_consents(session_id);
ALTER TABLE klara_session_consents
  ADD COLUMN IF NOT EXISTS resolution_id text;
-- W1 S4 R6B: additiv und wiederholbar wie resolution_id. BEWUSST NULLABLE: eine Bestandszeile aus
-- R2..R6A hat diese Bindung nie getragen, und ein erfundener Vorgabewert wäre genau die falsche
-- Auskunft. NULL heisst „Bindung unvollständig" — die Deckungsprüfung wertet das fail-safe als
-- NICHT gedeckt (KW-S4-23 §4), statt eine Zustimmung zu unterstellen, die niemand gegeben hat.
ALTER TABLE klara_session_consents
  ADD COLUMN IF NOT EXISTS provider_reference text;
-- W1 S4 R2 (BEN ROT-3): HÖCHSTENS EIN WIRKSAMER CONSENT JE SITZUNG — datenbankseitig erzwungen.
-- Der partielle Unique-Index greift nur auf 'granted'; entwertete Zeilen bleiben als Historie
-- liegen. Bis R2 erlaubte der Vertrag zwei gleichzeitig erteilte Zustimmungen derselben Sitzung,
-- und BEN hat mit grantedRows=2 genau das reproduziert. Eine Anwendungsregel allein haette
-- das nicht verhindert: zwei parallele Grants sehen einander nicht.
CREATE UNIQUE INDEX IF NOT EXISTS uq_klara_consent_granted_per_session
  ON klara_session_consents(session_id) WHERE status = 'granted';
`;

/** Die Zustandswerte der Zustimmung (KW-S4-03 §2.1, abschliessend). */
export type KlaraConsentStatus = "pending" | "granted" | "expired" | "revoked" | "invalidated";

export interface KlaraSession {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly addinInstanceId: string;
  readonly documentContextId: string;
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly expiresAt: string;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly consentState: KlaraConsentStatus | "none";
  readonly closedAt: string | null;
  /** W1 S4 R2: die gebundene Resolution — `null` nur bei Altbestand aus R1. */
  readonly resolutionId: string | null;
  /**
   * W1 S4 R4 (KW-S4-21 §2) — DIE MONOTONE SITZUNGSREVISION.
   *
   * Sie ist das einzige primäre CAS-Kriterium: jeder zustandsändernde Write nennt die Revision,
   * die er GELESEN hat, und die Datenbank erhöht sie bei Erfolg um eins. Ein Schreiber mit
   * veralteter Revision trifft null Zeilen und kann deshalb keine neuere Dokument-, Resolution-
   * oder Consent-Bindung mehr zurückrollen (BEN ROT-1 zu R3).
   *
   * Sie ist INTERN: die `KlaraSessionView` trägt sie nicht. Ein Client soll den Zustand nicht
   * mitverwalten müssen — er hat keinen ehrlichen Weg, eine Revision zu kennen, ohne sie sich
   * vorher geben zu lassen, und ein solcher Vertrag wäre bloss eine zweite Fehlerquelle.
   */
  readonly revision: number;
}

export interface KlaraConsent {
  readonly consentId: string;
  readonly sessionId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly documentContextId: string;
  readonly consentScope: string;
  readonly allowedPayloadClasses: readonly string[];
  readonly providerClass: string;
  readonly providerBindingId: string;
  readonly modelReference: string;
  /**
   * W1 S4 R6B (KW-S4-23 §1): der TATSAECHLICHE Anbieter der gebundenen Aufloesung.
   *
   * `providerClass` traegt nur die Klasse (`external`/`internal`/`deterministic`). §1 verlangt
   * ausdruecklich `provider` UND `model` als eigene Bindungen; ohne dieses Feld war die Bindung
   * unvollstaendig. `null` nur bei Altbestand aus R2..R6A — und gilt der Deckungspruefung als
   * UNVOLLSTAENDIG, nie als erfuellt.
   */
  readonly providerReference: string | null;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly grantedAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly status: KlaraConsentStatus;
  /** W1 S4 R2: dieselbe Resolution wie an Sitzung und Status. */
  readonly resolutionId: string | null;
}

/** Die Werte, die der atomare Rebind setzt (KW-S4-21 §6). */
export interface KlaraRebindWerte {
  readonly documentContextId: string;
  readonly resolutionId: string;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly lastActivityAt: string;
  readonly expiresAt: string;
  /** `invalidated`, wenn eine Zustimmung bestand; sonst `none`. */
  readonly consentState: KlaraSession["consentState"];
  /** Entwertungszeitpunkt für die bisherige `granted`-Zeile. */
  readonly revokedAt: string;
}

// ================================================================================================
// W1 S4 R4 (KW-S4-21 §1) — SIEBEN SCHMALE ÜBERGÄNGE STATT EINES GENERISCHEN SCHREIBERS.
// ================================================================================================
//
// DER GRUND, IN EINEM SATZ: ein `updateSession(snapshot)` schreibt IMMER alles, auch das, was der
// Aufrufer gar nicht ändern wollte — und genau darüber hat in R3 ein blosser Aktivitäts-Write
// einen abgeschlossenen Rebind zurückgerollt (BEN-Bericht 19, ROT-1).
//
// Jede Operation hier
//   · nennt die GELESENE Revision (`expectedRevision`) und gewinnt nur, wenn sie noch gilt,
//   · verändert AUSSCHLIESSLICH die Felder ihres eigenen Zustandsübergangs,
//   · erhöht `session_revision` atomar um eins,
//   · liefert `false` statt zu werfen, wenn sie das Rennen verliert (0 Zeilen).
//
// `false` ist bewusst kein Fehler: WAS ein verlorenes Rennen fachlich bedeutet, entscheidet der
// Dienst je Übergang (KW-S4-21 §3 und §5) — die Ablage kennt diese Unterscheidung nicht und darf
// sie deshalb auch nicht treffen.
export interface KlaraSessionRepo {
  insertSession(session: KlaraSession): Promise<void>;
  findSession(sessionId: string): Promise<KlaraSession | undefined>;

  /**
   * TOUCH (KW-S4-21 §5) — der einzige Schreiber ohne fachliche Autorität. Er darf `last_activity_at`
   * und `expires_at` fortschreiben, sonst nichts. Genau diese Enge ist die Korrektur: der Touch
   * kann keine Dokumentbindung, keine Resolution und keinen Zustimmungszustand mehr berühren,
   * auch nicht versehentlich.
   */
  touchSession(
    sessionId: string,
    expectedRevision: number,
    lastActivityAt: string,
    expiresAt: string,
  ): Promise<boolean>;

  /**
   * REBIND (KW-S4-21 §6) — EINE Operation, EINE Transaktion. Neue Dokumentbindung, entwertete
   * Zustimmung, neue Resolution samt Versionen und fortgeschriebene Fristen entstehen gemeinsam
   * oder gar nicht. Der Zweischritt aus R3 (`resolution_id = null`, danach die neue) ist damit
   * fort: es gibt keinen Augenblick, in dem eine aktive Sitzung ohne Resolution im Bestand steht.
   */
  rebindSession(
    sessionId: string,
    expectedRevision: number,
    werte: KlaraRebindWerte,
  ): Promise<boolean>;

  /**
   * GRANT (KW-S4-21 §4) — Sitzungszustand und Zustimmungszeile in DERSELBEN Transaktion. Die
   * Zusage „höchstens eine wirksame Zustimmung" aus R2 bleibt vollständig erhalten: vorhandene
   * `granted`-Zeilen werden im selben Schritt entwertet, der partielle Unique-Index
   * `uq_klara_consent_granted_per_session` ist weiterhin die zweite, unabhängige Sicherung.
   */
  grantConsent(
    sessionId: string,
    expectedRevision: number,
    consent: KlaraConsent,
  ): Promise<boolean>;

  /** WIDERRUF — Sitzungszustand `revoked`, Fristen fortgeschrieben, wirksame Zustimmung entwertet. */
  revokeConsent(
    sessionId: string,
    expectedRevision: number,
    werte: { lastActivityAt: string; expiresAt: string; revokedAt: string },
  ): Promise<boolean>;

  /** SCHLIESSEN — `closed_at` gesetzt, Zustand `invalidated`, wirksame Zustimmung entwertet. */
  closeSession(
    sessionId: string,
    expectedRevision: number,
    werte: { closedAt: string; lastActivityAt: string },
  ): Promise<boolean>;

  /**
   * ABLAUF/INVALIDIERUNG — die Entwertung, die `laden()` vornimmt, BEVOR es einen Aufruf abweist.
   * Sie ändert nur den Zustimmungszustand (Sitzung und, falls vorhanden, die wirksame Zeile).
   */
  invalidateSession(
    sessionId: string,
    expectedRevision: number,
    werte: { consentState: KlaraConsentStatus; revokedAt: string },
  ): Promise<boolean>;

  /**
   * POLICY-/KONFIGURATIONS-REFRESH — die kontrollierte Erneuerung der Resolution bei einem
   * Versionswechsel. Sie fasst genau die drei zusammengehörenden Felder an; Dokumentbindung und
   * Zustimmungszustand bleiben unberührt.
   */
  refreshResolution(
    sessionId: string,
    expectedRevision: number,
    werte: { resolutionId: string; policyVersion: string; configurationVersion: string },
  ): Promise<boolean>;

  /**
   * Die WIRKSAME Zustimmung dieser Sitzung — höchstens eine.
   *
   * DETERMINISTISCH (BEN ROT-3): bei gleichem `granted_at` entschied bis R2 der Zufall der
   * Zeilenreihenfolge. Jetzt bricht `consent_id` den Gleichstand, und `granted` geht immer vor
   * einer entwerteten Zeile.
   */
  findConsent(sessionId: string): Promise<KlaraConsent | undefined>;
  /**
   * ALLE Zustimmungszeilen dieser Sitzung — Historie eingeschlossen.
   *
   * Sie ist der einzige Weg, „höchstens eine wirksame" zu BELEGEN statt zu behaupten: nur wer die
   * entwerteten Zeilen mitsieht, kann zeigen, dass genau eine `granted` ist und die anderen
   * nicht verschwunden, sondern entwertet sind.
   */
  alleConsents(sessionId: string): Promise<readonly KlaraConsent[]>;
}

export class InMemoryKlaraSessionRepo implements KlaraSessionRepo {
  private readonly sessions = new Map<string, KlaraSession>();

  private readonly consents = new Map<string, KlaraConsent>();

  insertSession(session: KlaraSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
    return Promise.resolve();
  }

  findSession(sessionId: string): Promise<KlaraSession | undefined> {
    return Promise.resolve(this.sessions.get(sessionId));
  }

  // ----------------------------------------------------------------------------------------------
  // W1 S4 R4 — DIESELBE ZUSAGE WIE POSTGRESQL, NICHT NUR EIN ÄHNLICHES VERHALTEN.
  // ----------------------------------------------------------------------------------------------
  //
  // Die In-Memory-Ablage war in R3 der Grund, warum der Fehler durch alle Tests kam: ihr
  // `updateSession` ersetzte die vollständige Struktur und KONNTE einen Lost Update gar nicht
  // zeigen. Deshalb trägt sie jetzt dieselbe Revisionsprüfung. Das Muster ist im Repository
  // erprobt — `InMemoryKoRepo.update` spiegelt seit SCRUM-509 R3 den `rowVersion`-CAS des
  // Pg-Adapters aus genau diesem Grund.
  //
  // JavaScript ist hier einfädig: zwischen Prüfung und Setzen liegt kein `await`, der Vergleich
  // und der Write sind damit unteilbar. Was in PostgreSQL die Bedingung im `WHERE` leistet,
  // leistet hier die Abwesenheit eines Unterbrechungspunkts.
  private cas(
    sessionId: string,
    expectedRevision: number,
    aenderung: (s: KlaraSession) => KlaraSession,
  ): boolean {
    const vorhanden = this.sessions.get(sessionId);
    if (!vorhanden || vorhanden.revision !== expectedRevision) {
      return false;
    }
    this.sessions.set(sessionId, { ...aenderung(vorhanden), revision: vorhanden.revision + 1 });
    return true;
  }

  /** Entwertet die wirksame Zustimmung — dieselbe Bedingung wie das `WHERE status='granted'` im SQL. */
  private entwerte(sessionId: string, status: KlaraConsentStatus, revokedAt: string): void {
    for (const [id, vorhanden] of this.consents) {
      if (vorhanden.sessionId === sessionId && vorhanden.status === "granted") {
        this.consents.set(id, { ...vorhanden, status, revokedAt });
      }
    }
  }

  touchSession(
    sessionId: string,
    expectedRevision: number,
    lastActivityAt: string,
    expiresAt: string,
  ): Promise<boolean> {
    return Promise.resolve(
      this.cas(sessionId, expectedRevision, (s) => ({ ...s, lastActivityAt, expiresAt })),
    );
  }

  rebindSession(
    sessionId: string,
    expectedRevision: number,
    werte: KlaraRebindWerte,
  ): Promise<boolean> {
    const gewonnen = this.cas(sessionId, expectedRevision, (s) => ({
      ...s,
      documentContextId: werte.documentContextId,
      resolutionId: werte.resolutionId,
      policyVersion: werte.policyVersion,
      configurationVersion: werte.configurationVersion,
      lastActivityAt: werte.lastActivityAt,
      expiresAt: werte.expiresAt,
      consentState: werte.consentState,
    }));
    if (gewonnen) {
      this.entwerte(sessionId, "invalidated", werte.revokedAt);
    }
    return Promise.resolve(gewonnen);
  }

  grantConsent(
    sessionId: string,
    expectedRevision: number,
    consent: KlaraConsent,
  ): Promise<boolean> {
    const gewonnen = this.cas(sessionId, expectedRevision, (s) => ({
      ...s,
      consentState: "granted",
    }));
    if (gewonnen) {
      // Dieselbe Zusage wie der partielle Unique-Index: erst entwerten, dann anlegen.
      this.entwerte(sessionId, "invalidated", consent.grantedAt);
      this.consents.set(consent.consentId, consent);
    }
    return Promise.resolve(gewonnen);
  }

  revokeConsent(
    sessionId: string,
    expectedRevision: number,
    werte: { lastActivityAt: string; expiresAt: string; revokedAt: string },
  ): Promise<boolean> {
    const gewonnen = this.cas(sessionId, expectedRevision, (s) => ({
      ...s,
      consentState: "revoked",
      lastActivityAt: werte.lastActivityAt,
      expiresAt: werte.expiresAt,
    }));
    if (gewonnen) {
      this.entwerte(sessionId, "revoked", werte.revokedAt);
    }
    return Promise.resolve(gewonnen);
  }

  closeSession(
    sessionId: string,
    expectedRevision: number,
    werte: { closedAt: string; lastActivityAt: string },
  ): Promise<boolean> {
    const gewonnen = this.cas(sessionId, expectedRevision, (s) => ({
      ...s,
      consentState: "invalidated",
      closedAt: werte.closedAt,
      lastActivityAt: werte.lastActivityAt,
    }));
    if (gewonnen) {
      this.entwerte(sessionId, "invalidated", werte.closedAt);
    }
    return Promise.resolve(gewonnen);
  }

  invalidateSession(
    sessionId: string,
    expectedRevision: number,
    werte: { consentState: KlaraConsentStatus; revokedAt: string },
  ): Promise<boolean> {
    const gewonnen = this.cas(sessionId, expectedRevision, (s) => ({
      ...s,
      consentState: werte.consentState,
    }));
    if (gewonnen) {
      this.entwerte(sessionId, werte.consentState, werte.revokedAt);
    }
    return Promise.resolve(gewonnen);
  }

  refreshResolution(
    sessionId: string,
    expectedRevision: number,
    werte: { resolutionId: string; policyVersion: string; configurationVersion: string },
  ): Promise<boolean> {
    return Promise.resolve(
      this.cas(sessionId, expectedRevision, (s) => ({
        ...s,
        resolutionId: werte.resolutionId,
        policyVersion: werte.policyVersion,
        configurationVersion: werte.configurationVersion,
      })),
    );
  }

  findConsent(sessionId: string): Promise<KlaraConsent | undefined> {
    // ABSTEIGEND sortiert und den ERSTEN nehmen — dieselbe Ordnung wie das SQL in
    // `PgKlaraSessionRepo.findConsent`: `granted` zuerst, dann der jüngste Zeitpunkt, dann die
    // Kennung als Gleichstandsbrecher. Nie die Einfügereihenfolge.
    const treffer = [...this.consents.values()]
      .filter((c) => c.sessionId === sessionId)
      .sort(
        (a, b) =>
          Number(b.status === "granted") - Number(a.status === "granted") ||
          b.grantedAt.localeCompare(a.grantedAt) ||
          b.consentId.localeCompare(a.consentId),
      );
    return Promise.resolve(treffer[0]);
  }

  alleConsents(sessionId: string): Promise<readonly KlaraConsent[]> {
    return Promise.resolve(
      [...this.consents.values()]
        .filter((c) => c.sessionId === sessionId)
        .sort((a, b) => a.consentId.localeCompare(b.consentId)),
    );
  }
}

interface SessionRow {
  session_id: string;
  tenant_id: string;
  actor_id: string;
  addin_instance_id: string;
  document_context_id: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  policy_version: string;
  configuration_version: string;
  consent_state: string;
  closed_at: string | null;
  resolution_id: string | null;
  // W1 S4 R4: `bigint` liefert der Treiber als STRING aus (node-postgres parst int8 bewusst nicht
  // in eine Number, weil sie nicht jeden Wert verlustfrei trägt). Die Umwandlung steht deshalb
  // genau einmal, in `ausSessionZeile` — ein `row.session_revision === 3` wäre hier still falsch.
  session_revision: string | number;
}

interface ConsentRow {
  consent_id: string;
  session_id: string;
  tenant_id: string;
  actor_id: string;
  document_context_id: string;
  consent_scope: string;
  allowed_payload_classes: string;
  provider_class: string;
  provider_binding_id: string;
  model_reference: string;
  provider_reference: string | null;
  policy_version: string;
  configuration_version: string;
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
  status: string;
  resolution_id: string | null;
}

function ausSessionZeile(row: SessionRow): KlaraSession {
  return {
    sessionId: row.session_id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    addinInstanceId: row.addin_instance_id,
    documentContextId: row.document_context_id,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    expiresAt: row.expires_at,
    policyVersion: row.policy_version,
    configurationVersion: row.configuration_version,
    consentState: row.consent_state as KlaraSession["consentState"],
    closedAt: row.closed_at,
    resolutionId: row.resolution_id ?? null,
    revision: Number(row.session_revision ?? 0),
  };
}

function ausConsentZeile(row: ConsentRow): KlaraConsent {
  return {
    consentId: row.consent_id,
    sessionId: row.session_id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    documentContextId: row.document_context_id,
    consentScope: row.consent_scope,
    allowedPayloadClasses: row.allowed_payload_classes
      ? row.allowed_payload_classes.split(",")
      : [],
    providerClass: row.provider_class,
    providerBindingId: row.provider_binding_id,
    modelReference: row.model_reference,
    providerReference: row.provider_reference ?? null,
    policyVersion: row.policy_version,
    configurationVersion: row.configuration_version,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    status: row.status as KlaraConsentStatus,
    resolutionId: row.resolution_id ?? null,
  };
}

export class PgKlaraSessionRepo implements KlaraSessionRepo {
  constructor(private readonly pool: Pool) {}

  async insertSession(s: KlaraSession): Promise<void> {
    await this.pool.query(
      `INSERT INTO klara_sessions(session_id,tenant_id,actor_id,addin_instance_id,document_context_id,
         created_at,last_activity_at,expires_at,policy_version,configuration_version,consent_state,closed_at,
         resolution_id,session_revision)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        s.sessionId,
        s.tenantId,
        s.actorId,
        s.addinInstanceId,
        s.documentContextId,
        s.createdAt,
        s.lastActivityAt,
        s.expiresAt,
        s.policyVersion,
        s.configurationVersion,
        s.consentState,
        s.closedAt,
        s.resolutionId,
        s.revision,
      ],
    );
  }

  async findSession(sessionId: string): Promise<KlaraSession | undefined> {
    const res = await this.pool.query<SessionRow>(
      "SELECT * FROM klara_sessions WHERE session_id=$1",
      [sessionId],
    );
    const row = res.rows[0];
    return row ? ausSessionZeile(row) : undefined;
  }

  // ==============================================================================================
  // W1 S4 R4 (KW-S4-21) — DIE SIEBEN ÜBERGÄNGE. JEDER MIT CAS, JEDER NUR AUF SEINEN FELDERN.
  // ==============================================================================================
  //
  // WAS HIER STAND UND WARUM ES FORT IST. Bis R3 gab es genau einen Schreiber, `updateSession(s)`,
  // mit `WHERE session_id=$1` und acht Spalten in der SET-Liste. Er tat immer alles — auch für
  // einen Aufrufer, der nur den Aktivitätszeitpunkt fortschreiben wollte. BEN hat daraus die
  // Rückrollung eines abgeschlossenen Rebinds gebaut (Bericht 19, Abschnitt 4): ein bereits
  // geladener Statusabruf schrieb seinen alten Snapshot über die neue Bindung.
  //
  // Die Methode ist deshalb nicht repariert, sondern ENTFERNT. Ein generischer Voll-Schreiber ist
  // die Falle selbst; wäre er geblieben, liefe der nächste Aufrufer wieder hinein.
  //
  // GEMEINSAME FORM ALLER SIEBEN:
  //   WHERE session_id=$1 AND session_revision=$2   ← das Compare
  //   SET   <nur eigene Felder>, session_revision = session_revision + 1   ← das Set
  //   rowCount 0 ⇒ false (verloren) · rowCount 1 ⇒ true (gewonnen)
  // Ein bedingter UPDATE ist in PostgreSQL selbst atomar; ein Row-Lock ist dafür nicht nötig.
  //
  // BEWUSST IN KEINER SET-LISTE: `tenant_id`, `actor_id`, `addin_instance_id`, `created_at`. Sie
  // sind die unveränderliche Identität der Sitzung; kein Dienstweg schreibt sie nach der Anlage
  // fort, und eine Änderbarkeit anzubieten, die es fachlich nicht gibt, wäre eine Einladung.

  /** Der bedingte Ein-Statement-Übergang (ohne Consent-Seite). */
  private async cas(sql: string, params: readonly unknown[]): Promise<boolean> {
    const res = await this.pool.query(sql, [...params]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Der bedingte Übergang MIT Consent-Seite: beide Tabellen in EINER Transaktion. Das
   * Sitzungs-CAS ist das Tor — greift es nicht, wird zurückgerollt und nichts ist geschehen.
   */
  private async casMitConsent(
    sql: string,
    params: readonly unknown[],
    consentSchritt: (client: PoolClient) => Promise<void>,
  ): Promise<boolean> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(sql, [...params]);
      if ((res.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      await consentSchritt(client);
      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  /** Entwertet die wirksame Zustimmung — das Prädikat `status='granted'` ist der Compare. */
  private static readonly ENTWERTE_WIRKSAME = `
    UPDATE klara_session_consents SET status=$2, revoked_at=$3
     WHERE session_id=$1 AND status='granted'`;

  touchSession(
    sessionId: string,
    expectedRevision: number,
    lastActivityAt: string,
    expiresAt: string,
  ): Promise<boolean> {
    return this.cas(
      `UPDATE klara_sessions
          SET last_activity_at=$3, expires_at=$4, session_revision = session_revision + 1
        WHERE session_id=$1 AND session_revision=$2`,
      [sessionId, expectedRevision, lastActivityAt, expiresAt],
    );
  }

  /**
   * DER ATOMARE REBIND (KW-S4-21 §6). Neue Dokumentbindung, neue Resolution samt Versionen,
   * fortgeschriebene Fristen, entwerteter Zustimmungszustand und die entwertete Zustimmungszeile
   * entstehen in EINER Transaktion. Der Zweischritt aus R3 — erst `resolution_id = null`, danach
   * die neue — ist damit fort; ein Leser sieht nie eine aktive Sitzung ohne Resolution.
   */
  rebindSession(
    sessionId: string,
    expectedRevision: number,
    werte: KlaraRebindWerte,
  ): Promise<boolean> {
    return this.casMitConsent(
      `UPDATE klara_sessions
          SET document_context_id=$3, resolution_id=$4, policy_version=$5, configuration_version=$6,
              last_activity_at=$7, expires_at=$8, consent_state=$9,
              session_revision = session_revision + 1
        WHERE session_id=$1 AND session_revision=$2`,
      [
        sessionId,
        expectedRevision,
        werte.documentContextId,
        werte.resolutionId,
        werte.policyVersion,
        werte.configurationVersion,
        werte.lastActivityAt,
        werte.expiresAt,
        werte.consentState,
      ],
      async (client) => {
        await client.query(PgKlaraSessionRepo.ENTWERTE_WIRKSAME, [
          sessionId,
          "invalidated",
          werte.revokedAt,
        ]);
      },
    );
  }

  /**
   * GRANT — Sitzungszustand und Zustimmungszeile gemeinsam. Die R2-Zusage bleibt vollständig:
   * vorhandene `granted`-Zeilen werden im selben Schritt entwertet, und der partielle Unique-Index
   * `uq_klara_consent_granted_per_session` bleibt die zweite, unabhängige Sicherung. Neu ist, dass
   * ein Grant auf veralteter Revision gar nicht erst bis zum Insert kommt.
   */
  grantConsent(sessionId: string, expectedRevision: number, c: KlaraConsent): Promise<boolean> {
    return this.casMitConsent(
      `UPDATE klara_sessions
          SET consent_state='granted', session_revision = session_revision + 1
        WHERE session_id=$1 AND session_revision=$2`,
      [sessionId, expectedRevision],
      async (client) => {
        await client.query(PgKlaraSessionRepo.ENTWERTE_WIRKSAME, [
          sessionId,
          "invalidated",
          c.grantedAt,
        ]);
        await client.query(
          `INSERT INTO klara_session_consents(consent_id,session_id,tenant_id,actor_id,document_context_id,
             consent_scope,allowed_payload_classes,provider_class,provider_binding_id,model_reference,
             policy_version,configuration_version,granted_at,expires_at,revoked_at,status,resolution_id,
             provider_reference)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            c.consentId,
            c.sessionId,
            c.tenantId,
            c.actorId,
            c.documentContextId,
            c.consentScope,
            [...c.allowedPayloadClasses].sort().join(","),
            c.providerClass,
            c.providerBindingId,
            c.modelReference,
            c.policyVersion,
            c.configurationVersion,
            c.grantedAt,
            c.expiresAt,
            c.revokedAt,
            c.status,
            c.resolutionId,
            c.providerReference,
          ],
        );
      },
    );
  }

  revokeConsent(
    sessionId: string,
    expectedRevision: number,
    werte: { lastActivityAt: string; expiresAt: string; revokedAt: string },
  ): Promise<boolean> {
    return this.casMitConsent(
      `UPDATE klara_sessions
          SET consent_state='revoked', last_activity_at=$3, expires_at=$4,
              session_revision = session_revision + 1
        WHERE session_id=$1 AND session_revision=$2`,
      [sessionId, expectedRevision, werte.lastActivityAt, werte.expiresAt],
      async (client) => {
        await client.query(PgKlaraSessionRepo.ENTWERTE_WIRKSAME, [
          sessionId,
          "revoked",
          werte.revokedAt,
        ]);
      },
    );
  }

  closeSession(
    sessionId: string,
    expectedRevision: number,
    werte: { closedAt: string; lastActivityAt: string },
  ): Promise<boolean> {
    return this.casMitConsent(
      `UPDATE klara_sessions
          SET consent_state='invalidated', closed_at=$3, last_activity_at=$4,
              session_revision = session_revision + 1
        WHERE session_id=$1 AND session_revision=$2`,
      [sessionId, expectedRevision, werte.closedAt, werte.lastActivityAt],
      async (client) => {
        await client.query(PgKlaraSessionRepo.ENTWERTE_WIRKSAME, [
          sessionId,
          "invalidated",
          werte.closedAt,
        ]);
      },
    );
  }

  invalidateSession(
    sessionId: string,
    expectedRevision: number,
    werte: { consentState: KlaraConsentStatus; revokedAt: string },
  ): Promise<boolean> {
    return this.casMitConsent(
      `UPDATE klara_sessions
          SET consent_state=$3, session_revision = session_revision + 1
        WHERE session_id=$1 AND session_revision=$2`,
      [sessionId, expectedRevision, werte.consentState],
      async (client) => {
        await client.query(PgKlaraSessionRepo.ENTWERTE_WIRKSAME, [
          sessionId,
          werte.consentState,
          werte.revokedAt,
        ]);
      },
    );
  }

  refreshResolution(
    sessionId: string,
    expectedRevision: number,
    werte: { resolutionId: string; policyVersion: string; configurationVersion: string },
  ): Promise<boolean> {
    return this.cas(
      `UPDATE klara_sessions
          SET resolution_id=$3, policy_version=$4, configuration_version=$5,
              session_revision = session_revision + 1
        WHERE session_id=$1 AND session_revision=$2`,
      [
        sessionId,
        expectedRevision,
        werte.resolutionId,
        werte.policyVersion,
        werte.configurationVersion,
      ],
    );
  }

  async findConsent(sessionId: string): Promise<KlaraConsent | undefined> {
    // DETERMINISTISCH: `granted` zuerst, dann der jüngste Zeitpunkt, dann die Kennung als
    // Gleichstandsbrecher. Bis R2 stand hier nur `ORDER BY granted_at DESC LIMIT 1` — bei gleichem
    // Zeitstempel entschied die Zeilenreihenfolge, also der Zufall.
    const res = await this.pool.query<ConsentRow>(
      `SELECT * FROM klara_session_consents WHERE session_id=$1
        ORDER BY (status = 'granted') DESC, granted_at DESC, consent_id DESC
        LIMIT 1`,
      [sessionId],
    );
    const row = res.rows[0];
    return row ? ausConsentZeile(row) : undefined;
  }

  // W1 S4 R4: `updateConsent(consent)` ist fort. Es war der zweite ungebundene Schreiber — es
  // entwertete eine Zeile, die der Aufrufer irgendwann einmal gelesen hatte, ohne Bezug zum
  // Sitzungszustand. Jede Entwertung läuft jetzt IN der Transaktion ihres Übergangs und trifft die
  // Zeile über das Prädikat `status='granted'` statt über eine mitgeschleppte Kennung.

  async alleConsents(sessionId: string): Promise<readonly KlaraConsent[]> {
    const res = await this.pool.query<ConsentRow>(
      "SELECT * FROM klara_session_consents WHERE session_id=$1 ORDER BY consent_id",
      [sessionId],
    );
    return res.rows.map(ausConsentZeile);
  }
}

import { Pool } from "pg";
import { ANSWER_SNAPSHOT_SCHEMA, ASK_SCHEMA } from "../../ask";
import { AUDIT_EVENT_ID_SCHEMA, AUDIT_HASH_VERSION_SCHEMA, AUDIT_SCHEMA } from "../../audit";
import { AUTH_SCHEMA } from "../../auth";
import { CAPTURE_SCHEMA } from "../../capture";
import { CONFLICTS_SCHEMA, OVERLAP_SCHEMA, OVERLAP_SETTINGS_SCHEMA } from "../../conflicts";
import { EXTERNAL_KNOWLEDGE_SCHEMA } from "../../external-search";
import {
  KO_CREATE_OPERATION_SCHEMA,
  KO_EVIDENCE_SCHEMA,
  KO_IMPORT_ANCHOR_SCHEMA,
  KO_METADATA_PROJECTION_SCHEMA,
  KO_PROJECTION_CONTROL_SCHEMA,
  KO_SCHEMA,
  KO_SEARCH_PROJECTION_SCHEMA,
  KO_SICHTBARKEIT_SCHEMA,
  KO_VERSIONS_SCHEMA,
  UPLOAD_LIMITS_SCHEMA,
} from "../../knowledge-object";
import {
  EXTERNAL_SOURCE_SCHEMA,
  IMPORT_CANDIDATES_SCHEMA,
  IMPORT_RUN_SCHEMA,
} from "../../library-analytics";
import { LIFECYCLE_SCHEMA } from "../../lifecycle";
import { MODEL_RUNS_SCHEMA } from "../../model-runs";
import { NOTIFICATION_SEEN_SCHEMA } from "../../notifications";
import { OBJECTSTORE_SCHEMA } from "../../object-store";
// SCRUM-386: kundeneigene KI-Assist-Presets (eigene Tabelle, Datenhoheit beim reasoner-Modul).
// SCRUM-525 P.5 (WP6): persistente KI-Zuordnung (Policy) — eigene Tabelle im reasoner-Modul.
import {
  ASSIST_PRESETS_SCHEMA,
  KLARA_CONSENT_SCHEMA,
  KLARA_SESSION_SCHEMA,
  REASONER_POLICY_SCHEMA,
} from "../../reasoner";
import { VALIDATION_SCHEMA, VALIDATION_SETTINGS_SCHEMA } from "../../validation";

// Querschnitt-Infrastruktur: ein Pool, geteilt von allen Modul-Adaptern.
export function createPool(connectionString?: string): Pool {
  return new Pool(connectionString ? { connectionString } : {});
}

// Führt die DDL aller Module aus. Jedes Modul liefert seine eigenen Tabellen (Datenhoheit).
export async function migrate(pool: Pool): Promise<void> {
  const schemas = [
    AUTH_SCHEMA,
    KO_SCHEMA,
    // WP-SHIP8-CLOSE-4 (bens ROT-1B): additive Anker-Migration DIREKT nach KO_SCHEMA —
    // Generated-Spalte + partieller Unique-Index (hoechstens EIN KO je Import-Kandidat).
    KO_IMPORT_ANCHOR_SCHEMA,
    // AUFTRAG-mega20 Block A: additive Anker-Migration der ERSTANLAGE aus Dokumenten —
    // Generated-Spalte + partieller Unique-Index (hoechstens EIN KO je Erzeugungs-Vorgang).
    KO_CREATE_OPERATION_SCHEMA,
    // AUFTRAG-BASIC-380: die drei Sichtbarkeits-Schluesselspalten (confidentiality_key, author_key,
    // deleted_at_key) plus idx_kos_sichtbarkeit. Ebenfalls DIREKT nach KO_SCHEMA, weil sie an `kos`
    // ALTERn. Rein additiv und generiert — kein Write auf kos.data, kein DROP, kein TRUNCATE.
    // Ohne diese Stufe laeuft der SQL-Trim (sichtbarkeit.ts, sqlSichtbarkeitFuer) in einen
    // Datenbankfehler statt in eine getrimmte Menge; T-M-3 pinnt deshalb ihre Anwesenheit.
    KO_SICHTBARKEIT_SCHEMA,
    KO_VERSIONS_SCHEMA,
    // G27: additive Tabelle der revisionsgebundenen Suchprojektion — NACH KO_SCHEMA, weil sie auf
    // `kos` joint und die dort angelegte pg_trgm-Extension für ihren GIN-Trigramm-Index braucht.
    // Rein additiv und wiederholbar: CREATE TABLE/INDEX IF NOT EXISTS PLUS die V1→V2-Stufe
    // (ALTER TABLE ADD COLUMN IF NOT EXISTS für `body_text`/`classification_snapshot`,
    // Detailentscheidung J) — kein DROP, kein TRUNCATE, nichts wird entfernt. Die Stufe steht IM
    // Schema-String und damit garantiert vor jedem V2-Insert.
    KO_SEARCH_PROJECTION_SCHEMA,
    // G27 Welle 1 / S2: die VERÄNDERLICHE Metadatenprojektion (Kategorie/Schlagwörter je ko_id mit
    // eigener metadata_revision). Ebenfalls nach KO_SCHEMA (pg_trgm für ihre beiden GIN-Indizes)
    // und direkt neben der Inhaltsprojektion — beide Hälften des Suchdokuments, ein Datenraum.
    KO_METADATA_PROJECTION_SCHEMA,
    // G27 R1: die instanzweite Steuerzeile der Suchprojektion (aktive Fassung + Readiness). Sie
    // steht NACH den beiden Projektionstabellen, weil sie über deren Zustand entscheidet — und sie
    // ist additiv und wiederholbar: CREATE TABLE IF NOT EXISTS plus ein INSERT ... ON CONFLICT DO
    // NOTHING. Der Seed ist `UNINITIALIZED` und leitet NICHTS aus dem Bestand ab; eine bereits
    // vorhandene Steuerzeile bleibt unangetastet (eine Migration setzt keinen laufenden Betrieb
    // zurück).
    KO_PROJECTION_CONTROL_SCHEMA,
    KO_EVIDENCE_SCHEMA,
    AUDIT_SCHEMA,
    // WP-SHIP8-CLOSE-6 (bens ROT-1): additive Event-Id-Stufe DIREKT nach AUDIT_SCHEMA
    // (exactly-once-Belege via partiellem Unique-Index auf event_id).
    AUDIT_EVENT_ID_SCHEMA,
    // JOB 498 D8: die Hashversion je Eintrag, additiv und DIREKT nach der Event-Id-Stufe. Sie
    // ALTERt dieselbe Tabelle `audit` und muss deshalb nach AUDIT_SCHEMA laufen; die Nähe zu
    // AUDIT_EVENT_ID_SCHEMA ist Ordnung, der Vorrang von AUDIT_SCHEMA ist Zwang.
    AUDIT_HASH_VERSION_SCHEMA,
    CAPTURE_SCHEMA,
    ASK_SCHEMA,
    // W3-A (KW-W3-18): Antwortidentitaet und unveraenderliche Belegrevisionen. Sie stehen DIREKT
    // nach ASK_SCHEMA, weil sie demselben Modul gehoeren; auch hier gibt es keinen technischen
    // Zwang, nur eine lesbare Ordnung. Die DDL wird NICHT kopiert — sie kommt als Konstante aus
    // dem Modul, das sie besitzt.
    ANSWER_SNAPSHOT_SCHEMA,
    VALIDATION_SCHEMA,
    CONFLICTS_SCHEMA,
    // SCRUM-496: Duplikat-Board (overlaps) + Anzeige-Schwelle (overlap_settings) — beide gehören zum
    // conflicts-Modul, wurden aber nie migriert → auf Postgres fehlten die Tabellen, /duplikate brach
    // ab (nur PG; In-Memory braucht kein Schema). CREATE TABLE IF NOT EXISTS → idempotent.
    OVERLAP_SCHEMA,
    OVERLAP_SETTINGS_SCHEMA,
    LIFECYCLE_SCHEMA,
    OBJECTSTORE_SCHEMA,
    IMPORT_CANDIDATES_SCHEMA,
    // W2-A (KW-W2-17): die unveraenderliche Quellrevision. Sie steht DIREKT nach der
    // Kandidatentabelle, weil beide demselben Modul gehoeren und denselben Datenraum bilden.
    // Eine Reihenfolgebedingung im technischen Sinn gibt es nicht — kein Fremdschluessel, keine
    // Extension, keine andere Tabelle (Preflight 39 §5); die Naehe ist Ordnung, nicht Zwang.
    EXTERNAL_SOURCE_SCHEMA,
    IMPORT_RUN_SCHEMA,
    MODEL_RUNS_SCHEMA,
    NOTIFICATION_SEEN_SCHEMA,
    ASSIST_PRESETS_SCHEMA,
    // SCRUM-525 P.5 (WP6): KI-Zuordnung (Policy) persistent.
    REASONER_POLICY_SCHEMA,
    // W1 S4 (KW-S4-03 §1.1/§2.1): Klara-Sitzung und die daran gebundene Zustimmung zur externen
    // KI-Nutzung. Sie stehen NACH der Reasoner-Policy, weil sie deren Policy-/Konfigurationsversion
    // referenzieren. Additiv und wiederholbar (CREATE TABLE IF NOT EXISTS) wie alles hier; ohne
    // diese zwei Zeilen faengt `db.migrate.test.ts` die fehlende Migration statisch ab.
    KLARA_SESSION_SCHEMA,
    KLARA_CONSENT_SCHEMA,
    // SCRUM-395: Standard-Prüferanzahl (Validierungs-Einstellungen).
    VALIDATION_SETTINGS_SCHEMA,
    // SCRUM-414: Regler „externe Wissensabfrage".
    EXTERNAL_KNOWLEDGE_SCHEMA,
    // SCRUM-421: einstellbare Upload-Grenzen.
    UPLOAD_LIMITS_SCHEMA,
  ];
  for (const ddl of schemas) {
    await pool.query(ddl);
  }
}

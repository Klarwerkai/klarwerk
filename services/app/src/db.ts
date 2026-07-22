import { Pool } from "pg";
import { ASK_SCHEMA } from "../../ask";
import { AUDIT_EVENT_ID_SCHEMA, AUDIT_SCHEMA } from "../../audit";
import { AUTH_SCHEMA } from "../../auth";
import { CAPTURE_SCHEMA } from "../../capture";
import { CONFLICTS_SCHEMA, OVERLAP_SCHEMA, OVERLAP_SETTINGS_SCHEMA } from "../../conflicts";
import { EXTERNAL_KNOWLEDGE_SCHEMA } from "../../external-search";
import {
  KO_EVIDENCE_SCHEMA,
  KO_IMPORT_ANCHOR_SCHEMA,
  KO_SCHEMA,
  KO_VERSIONS_SCHEMA,
  UPLOAD_LIMITS_SCHEMA,
} from "../../knowledge-object";
import { IMPORT_CANDIDATES_SCHEMA } from "../../library-analytics";
import { LIFECYCLE_SCHEMA } from "../../lifecycle";
import { MODEL_RUNS_SCHEMA } from "../../model-runs";
import { NOTIFICATION_SEEN_SCHEMA } from "../../notifications";
import { OBJECTSTORE_SCHEMA } from "../../object-store";
// SCRUM-386: kundeneigene KI-Assist-Presets (eigene Tabelle, Datenhoheit beim reasoner-Modul).
// SCRUM-525 P.5 (WP6): persistente KI-Zuordnung (Policy) — eigene Tabelle im reasoner-Modul.
import { ASSIST_PRESETS_SCHEMA, REASONER_POLICY_SCHEMA } from "../../reasoner";
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
    KO_VERSIONS_SCHEMA,
    KO_EVIDENCE_SCHEMA,
    AUDIT_SCHEMA,
    // WP-SHIP8-CLOSE-6 (bens ROT-1): additive Event-Id-Stufe DIREKT nach AUDIT_SCHEMA
    // (exactly-once-Belege via partiellem Unique-Index auf event_id).
    AUDIT_EVENT_ID_SCHEMA,
    CAPTURE_SCHEMA,
    ASK_SCHEMA,
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
    MODEL_RUNS_SCHEMA,
    NOTIFICATION_SEEN_SCHEMA,
    ASSIST_PRESETS_SCHEMA,
    // SCRUM-525 P.5 (WP6): KI-Zuordnung (Policy) persistent.
    REASONER_POLICY_SCHEMA,
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

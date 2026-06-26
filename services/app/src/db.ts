import { Pool } from "pg";
import { ASK_SCHEMA } from "../../ask";
import { AUDIT_SCHEMA } from "../../audit";
import { AUTH_SCHEMA } from "../../auth";
import { CAPTURE_SCHEMA } from "../../capture";
import { CONFLICTS_SCHEMA } from "../../conflicts";
import { KO_EVIDENCE_SCHEMA, KO_SCHEMA, KO_VERSIONS_SCHEMA } from "../../knowledge-object";
import { IMPORT_CANDIDATES_SCHEMA } from "../../library-analytics";
import { LIFECYCLE_SCHEMA } from "../../lifecycle";
import { MODEL_RUNS_SCHEMA } from "../../model-runs";
import { OBJECTSTORE_SCHEMA } from "../../object-store";
import { VALIDATION_SCHEMA } from "../../validation";

// Querschnitt-Infrastruktur: ein Pool, geteilt von allen Modul-Adaptern.
export function createPool(connectionString?: string): Pool {
  return new Pool(connectionString ? { connectionString } : {});
}

// Führt die DDL aller Module aus. Jedes Modul liefert seine eigenen Tabellen (Datenhoheit).
export async function migrate(pool: Pool): Promise<void> {
  const schemas = [
    AUTH_SCHEMA,
    KO_SCHEMA,
    KO_VERSIONS_SCHEMA,
    KO_EVIDENCE_SCHEMA,
    AUDIT_SCHEMA,
    CAPTURE_SCHEMA,
    ASK_SCHEMA,
    VALIDATION_SCHEMA,
    CONFLICTS_SCHEMA,
    LIFECYCLE_SCHEMA,
    OBJECTSTORE_SCHEMA,
    IMPORT_CANDIDATES_SCHEMA,
    MODEL_RUNS_SCHEMA,
  ];
  for (const ddl of schemas) {
    await pool.query(ddl);
  }
}

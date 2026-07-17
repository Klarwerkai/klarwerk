import type { Pool } from "pg";
import type { ReasonerTaskConfig } from "./types";

// SCRUM-525 P.5 (WP6): Die KI-Zuordnung (global + je Aufgabe) war rein IN-MEMORY — nach jedem
// Neustart/Deploy fiel sie still auf "auto" zurück, die Admin-Entscheidung war weg. Dieses Repo macht die
// Policy PERSISTENT (eine Zeile). `get()` liefert null, wenn NIE konfiguriert wurde — der Reasoner setzt
// dann einen DEFINIERTEN Default und loggt einen Hinweis (kein stiller Auto-Fallback).
export interface ReasonerPolicyRepo {
  get(): Promise<ReasonerTaskConfig | null>;
  set(config: ReasonerTaskConfig): Promise<void>;
}

function clone(config: ReasonerTaskConfig): ReasonerTaskConfig {
  return { global: config.global, perTask: { ...config.perTask } };
}

// In-Memory-Variante (Tests/Dev/Dev-Journal-Replay). Ohne set() bleibt get() null (= nie konfiguriert).
export class InMemoryReasonerPolicyRepo implements ReasonerPolicyRepo {
  private config: ReasonerTaskConfig | null = null;

  async get(): Promise<ReasonerTaskConfig | null> {
    return this.config ? clone(this.config) : null;
  }

  async set(config: ReasonerTaskConfig): Promise<void> {
    this.config = clone(config);
  }
}

// Eine Singleton-Zeile (id=1). Additive Tabelle, CREATE TABLE IF NOT EXISTS → idempotent migrierbar.
export const REASONER_POLICY_SCHEMA = `
CREATE TABLE IF NOT EXISTS reasoner_policy (
  id integer PRIMARY KEY,
  data jsonb NOT NULL,
  CONSTRAINT reasoner_policy_singleton CHECK (id = 1)
);
`;

interface PolicyRow {
  data: ReasonerTaskConfig;
}

// Postgres-Variante: dieselbe Schnittstelle; eine Zeile (id=1), Upsert per ON CONFLICT.
export class PgReasonerPolicyRepo implements ReasonerPolicyRepo {
  constructor(private readonly pool: Pool) {}

  async get(): Promise<ReasonerTaskConfig | null> {
    const res = await this.pool.query<PolicyRow>("SELECT data FROM reasoner_policy WHERE id=1");
    return res.rows[0]?.data ?? null;
  }

  async set(config: ReasonerTaskConfig): Promise<void> {
    await this.pool.query(
      "INSERT INTO reasoner_policy(id,data) VALUES(1,$1) ON CONFLICT (id) DO UPDATE SET data=$1",
      [JSON.stringify(clone(config))],
    );
  }
}

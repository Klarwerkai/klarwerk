import type { Pool } from "pg";
import { ExternalSearchError } from "./types";

// SCRUM-414 (Pedi 03.07.): Admin-Regler „externe Wissensabfrage" — von komplett blockiert
// bis offen. Steuert die externe Quellensuche im Erfassen/Prüfbereich UND ist die Freigabe
// für die Public-KI-Anreicherung (SCRUM-426). Persistiert wie SCRUM-395 (InMemory + Pg +
// Dev-Journal). Standard bewusst restriktiv: „nur Suche auf Klick".
//  - blocked          externe Wissensabfrage komplett gesperrt (nichts sichtbar/aufrufbar)
//  - search_on_click  Suche nur auf ausdrücklichen Klick (Standard)
//  - search_attach    Suche + Ergebnisse als Quelle anhängen erlaubt
//  - open             offen (Suche + Anhängen + Public-KI-Anreicherung)
export type ExternalKnowledgeStage = "blocked" | "search_on_click" | "search_attach" | "open";

export const EXTERNAL_KNOWLEDGE_STAGES: readonly ExternalKnowledgeStage[] = [
  "blocked",
  "search_on_click",
  "search_attach",
  "open",
];

export const DEFAULT_EXTERNAL_KNOWLEDGE_STAGE: ExternalKnowledgeStage = "search_on_click";

// Ehrliche Normalisierung: nur die vier bekannten Stufen — alles andere ist ein Bedienfehler.
export function normalizeExternalKnowledgeStage(value: unknown): ExternalKnowledgeStage {
  if (
    typeof value === "string" &&
    (EXTERNAL_KNOWLEDGE_STAGES as readonly string[]).includes(value)
  ) {
    return value as ExternalKnowledgeStage;
  }
  throw new ExternalSearchError(
    "Ungültige Stufe für die externe Wissensabfrage (erlaubt: blocked, search_on_click, search_attach, open).",
  );
}

// Praktische Ableitungen für UI und Server-Gate.
export function externalSearchAllowed(stage: ExternalKnowledgeStage): boolean {
  return stage !== "blocked";
}
export function externalAttachAllowed(stage: ExternalKnowledgeStage): boolean {
  return stage === "search_attach" || stage === "open";
}
export function publicAiEnrichmentAllowed(stage: ExternalKnowledgeStage): boolean {
  return stage === "open";
}

export interface ExternalKnowledgePolicyRepo {
  // null = noch nie gesetzt → Aufrufer nimmt DEFAULT_EXTERNAL_KNOWLEDGE_STAGE.
  getStage(): Promise<ExternalKnowledgeStage | null>;
  setStage(stage: ExternalKnowledgeStage): Promise<void>;
}

export class InMemoryExternalKnowledgePolicyRepo implements ExternalKnowledgePolicyRepo {
  private stage: ExternalKnowledgeStage | null = null;

  getStage(): Promise<ExternalKnowledgeStage | null> {
    return Promise.resolve(this.stage);
  }

  setStage(stage: ExternalKnowledgeStage): Promise<void> {
    this.stage = stage;
    return Promise.resolve();
  }
}

export const EXTERNAL_KNOWLEDGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS external_knowledge_policy (
  key text PRIMARY KEY,
  stage text NOT NULL
);
`;

const STAGE_KEY = "external_knowledge_stage";

export class PgExternalKnowledgePolicyRepo implements ExternalKnowledgePolicyRepo {
  constructor(private readonly pool: Pool) {}

  async getStage(): Promise<ExternalKnowledgeStage | null> {
    const res = await this.pool.query<{ stage: string }>(
      "SELECT stage FROM external_knowledge_policy WHERE key=$1",
      [STAGE_KEY],
    );
    const row = res.rows[0];
    return row ? normalizeExternalKnowledgeStage(row.stage) : null;
  }

  async setStage(stage: ExternalKnowledgeStage): Promise<void> {
    await this.pool.query(
      "INSERT INTO external_knowledge_policy(key,stage) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET stage=$2",
      [STAGE_KEY, stage],
    );
  }
}

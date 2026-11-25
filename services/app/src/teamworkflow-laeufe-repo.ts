import type { Pool } from "pg";
import type { SessionUser } from "../../auth";
import { sqlSichtbarkeitFuer } from "./sichtbarkeit";
import type { TeamAntwort } from "./teamassistenten-wissen";
import { workflowQuellschutzSql } from "./teamworkflows-sql";
import type { WorkflowSprache } from "./teamworkflows-vertrag";

export type LaufStand = "laeuft" | "rueckfrage" | "abgelehnt" | "abgeschlossen" | "angehalten";
export type LaufAktion = "weiter" | "annehmen" | "rueckfrage" | "antworten" | "ablehnen";
export interface WorkflowEreignis {
  index: number;
  typ: "start" | "assistent" | "aktion" | Exclude<LaufAktion, "weiter">;
  akteur: string;
  am: string;
  notiz?: string;
  assistentId?: string;
  version?: number;
  antwort?: TeamAntwort;
  ergebnisId?: string;
}
export interface WorkflowErgebnis {
  id: string;
  index: number;
  titel: string;
  erstelltAm: string;
  erstelltVon: string;
  workflowVersion: number;
  /** References into the same immutable history, including prior evidence and decisions. */
  schritte: number[];
}
export interface WorkflowLauf {
  id: string;
  workflowId: string;
  teamId: string;
  version: number;
  revision: number;
  sprache: WorkflowSprache;
  fall: string;
  stand: LaufStand;
  index: number;
  gestartetVon: string;
  aktualisiertAm: string;
  verlauf: WorkflowEreignis[];
  ergebnisse: WorkflowErgebnis[];
}
export interface LaufBindung {
  leser: SessionUser;
  teamVersion: number;
  assistenten: Record<string, number>;
  bindungen: Record<string, Record<string, number>>;
  konfliktstand: Record<string, string>;
}
export interface WorkflowLaeufeRepo {
  lesen(id: string): Promise<WorkflowLauf | undefined>;
  fuerWorkflow(id: string): Promise<WorkflowLauf[]>;
  speichern(lauf: WorkflowLauf, basis: number, bindung: LaufBindung): Promise<boolean>;
}
export const WORKFLOW_LAEUFE_SCHEMA = `
CREATE TABLE IF NOT EXISTS team_workflow_laeufe (
  id text PRIMARY KEY,
  workflow_id text NOT NULL,
  team_id text NOT NULL,
  revision integer NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_team_workflow_laeufe_workflow ON team_workflow_laeufe(workflow_id);
`;
export class InMemoryWorkflowLaeufe implements WorkflowLaeufeRepo {
  private readonly daten = new Map<string, WorkflowLauf>();
  async lesen(id: string) {
    return structuredClone(this.daten.get(id));
  }
  async fuerWorkflow(id: string) {
    return Array.from(this.daten.values())
      .filter((l) => l.workflowId === id)
      .map((l) => structuredClone(l));
  }
  async speichern(lauf: WorkflowLauf, basis: number, _bindung: LaufBindung) {
    if ((this.daten.get(lauf.id)?.revision ?? 0) !== basis || lauf.revision !== basis + 1)
      return false;
    this.daten.set(lauf.id, structuredClone(lauf));
    return true;
  }
}
export class PgWorkflowLaeufe implements WorkflowLaeufeRepo {
  constructor(private readonly pool: Pool) {}
  async lesen(id: string) {
    return (
      await this.pool.query<{ data: WorkflowLauf }>(
        "SELECT data FROM team_workflow_laeufe WHERE id=$1",
        [id],
      )
    ).rows[0]?.data;
  }
  async fuerWorkflow(id: string) {
    return (
      await this.pool.query<{ data: WorkflowLauf }>(
        "SELECT data FROM team_workflow_laeufe WHERE workflow_id=$1",
        [id],
      )
    ).rows.map((r) => r.data);
  }
  async speichern(lauf: WorkflowLauf, basis: number, b: LaufBindung) {
    if (lauf.revision !== basis + 1) return false;
    // The receipt and the step transition share one atomic row update. Recheck the active
    // workflow, team generation, assistant releases and KO revisions in the same SQL snapshot.
    const sicht = sqlSichtbarkeitFuer(b.leser);
    const guard = `
        EXISTS (SELECT 1 FROM team_workflows w WHERE w.id=$2 AND w.team_id=$3
          AND w.data->>'aktiv' IS NOT NULL AND ($6::int>0 OR (w.data->>'aktiv')::int=$7))
        AND (SELECT max(version) FROM teams_fassungen WHERE team_id=$3)=$8
        AND NOT EXISTS (SELECT 1 FROM jsonb_each_text($9::jsonb) r WHERE NOT EXISTS (
          SELECT 1 FROM team_assistenten a WHERE a.id=r.key AND a.team_id=$3 AND a.data->>'aktiv'=r.value))
        AND ${workflowQuellschutzSql(10, 11, sicht.sql("k", 12))}`;
    const sql =
      basis === 0
        ? `INSERT INTO team_workflow_laeufe(id,workflow_id,team_id,revision,data)
          SELECT $1,$2,$3,$4,$5::jsonb WHERE ${guard} ON CONFLICT DO NOTHING`
        : `UPDATE team_workflow_laeufe SET revision=$4,data=$5::jsonb
          WHERE id=$1 AND workflow_id=$2 AND team_id=$3 AND revision=$6 AND ${guard}`;
    const res = await this.pool.query(sql, [
      lauf.id,
      lauf.workflowId,
      lauf.teamId,
      lauf.revision,
      JSON.stringify(lauf),
      basis,
      lauf.version,
      b.teamVersion,
      JSON.stringify(b.assistenten),
      JSON.stringify(b.bindungen),
      JSON.stringify(b.konfliktstand),
      ...sicht.params,
    ]);
    return res.rowCount === 1;
  }
}

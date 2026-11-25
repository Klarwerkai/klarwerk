import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import type { SessionUser } from "../../auth";
import { can } from "../../rbac";
import { rechtekontextStempel } from "./rechtekontext";
import { sqlSichtbarkeitFuer } from "./sichtbarkeit";
import type { TeamassistentDienst } from "./teamassistenten";
import type { TeamFassung, TeamsRepo } from "./teams";
import { probeWorkflow } from "./teamworkflow-lauf";
import { workflowQuellschutzSql } from "./teamworkflows-sql";
import {
  type WorkflowDefinition,
  WorkflowFehler,
  type WorkflowProbe,
  type WorkflowSitzung,
  type WorkflowSprache,
  type WorkflowZugang,
  workflowDefinition,
  workflowEingabe,
  workflowFehlt,
  workflowNummer,
  workflowObjekt,
  workflowSprache,
  workflowStand,
  workflowText,
} from "./teamworkflows-vertrag";

interface Pruefung extends WorkflowProbe {
  version: number;
  sprache: WorkflowSprache;
}
interface Freigabe {
  version: number;
  definition: WorkflowDefinition;
  pruefung: Pruefung;
}
interface Teamworkflow {
  id: string;
  teamId: string;
  verantwortlich: string;
  revision: number;
  entwurf: number;
  definition: WorkflowDefinition;
  pruefung: Pruefung | null;
  aktiv: number | null;
  freigaben: Freigabe[];
}
export interface TeamworkflowRepo {
  lesen(id: string): Promise<Teamworkflow | undefined>;
  fuerTeams(teams: string[]): Promise<Teamworkflow[]>;
  speichern(
    w: Teamworkflow,
    basis: number,
    teamVersion: number,
    u: SessionUser,
    freigabe?: Freigabe,
  ): Promise<boolean>;
  loeschen(id: string, basis: number, teamVersion: number): Promise<boolean>;
}
export const TEAMWORKFLOWS_SCHEMA = `
CREATE TABLE IF NOT EXISTS team_workflows (
 id text PRIMARY KEY, team_id text NOT NULL, revision integer NOT NULL, data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS team_workflows_team_idx ON team_workflows(team_id);
`;
export class InMemoryTeamworkflowRepo implements TeamworkflowRepo {
  private readonly werte = new Map<string, Teamworkflow>();
  async lesen(id: string) {
    return structuredClone(this.werte.get(id));
  }
  async fuerTeams(teams: string[]) {
    return structuredClone([...this.werte.values()].filter((w) => teams.includes(w.teamId)));
  }
  async speichern(w: Teamworkflow, basis: number) {
    if (w.revision !== basis + 1 || (this.werte.get(w.id)?.revision ?? 0) !== basis) return false;
    this.werte.set(w.id, structuredClone(w));
    return true;
  }
  async loeschen(id: string, basis: number) {
    const w = this.werte.get(id);
    return w?.revision === basis && !w.freigaben.length && this.werte.delete(id);
  }
}
export class PgTeamworkflowRepo implements TeamworkflowRepo {
  constructor(private readonly pool: Pool) {}
  async lesen(id: string) {
    const r = await this.pool.query<{ data: Teamworkflow }>(
      "SELECT data FROM team_workflows WHERE id=$1",
      [id],
    );
    return r.rows[0]?.data;
  }
  async fuerTeams(teams: string[]) {
    const r = await this.pool.query<{ data: Teamworkflow }>(
      "SELECT data FROM team_workflows WHERE team_id=ANY($1::text[])",
      [teams],
    );
    return r.rows.map((x) => x.data);
  }
  async speichern(
    w: Teamworkflow,
    basis: number,
    teamVersion: number,
    u: SessionUser,
    freigabe?: Freigabe,
  ) {
    if (w.revision !== basis + 1) return false;
    const sicht = sqlSichtbarkeitFuer(u);
    const r =
      basis === 0
        ? await this.pool.query(
            `INSERT INTO team_workflows(id,team_id,revision,data)
      SELECT $1,$2,1,$3::jsonb WHERE (SELECT max(version) FROM teams_fassungen WHERE team_id=$2)=$4
      ON CONFLICT DO NOTHING`,
            [w.id, w.teamId, JSON.stringify(w), teamVersion],
          )
        : await this.pool.query(
            `UPDATE team_workflows SET revision=$3,data=$4::jsonb WHERE id=$1 AND team_id=$2 AND revision=$5
       AND (SELECT max(version) FROM teams_fassungen WHERE team_id=$2)=$6
       AND NOT EXISTS (SELECT 1 FROM jsonb_each_text($7::jsonb) r WHERE NOT EXISTS (
          SELECT 1 FROM team_assistenten a WHERE a.team_id=$2 AND a.id=r.key AND a.data->>'aktiv'=r.value))
       AND ${workflowQuellschutzSql(8, 9, sicht.sql("k", 10))}`,
            [
              w.id,
              w.teamId,
              w.revision,
              JSON.stringify(w),
              basis,
              teamVersion,
              JSON.stringify(
                Object.fromEntries(
                  (freigabe?.definition.schritte ?? []).flatMap((s) =>
                    s.typ === "assistent" ? [[s.assistentId, s.version]] : [],
                  ),
                ),
              ),
              JSON.stringify(freigabe?.pruefung.bindungen ?? {}),
              JSON.stringify(freigabe?.pruefung.konfliktstand ?? {}),
              ...sicht.params,
            ],
          );
    return r.rowCount === 1;
  }
  async loeschen(id: string, basis: number, teamVersion: number) {
    const r = await this.pool.query(
      `DELETE FROM team_workflows w WHERE id=$1 AND revision=$2 AND jsonb_array_length(data->'freigaben')=0
   AND (SELECT max(version) FROM teams_fassungen WHERE team_id=w.team_id)=$3`,
      [id, basis, teamVersion],
    );
    return r.rowCount === 1;
  }
}
function mitglied(t: TeamFassung, u: SessionUser) {
  return !t.archiviert && t.mitglieder.includes(u.id);
}
function ansicht(w: Teamworkflow, u: SessionUser, detail: boolean) {
  const bearbeitbar = w.verantwortlich === u.id && can(u.role, "ko.create");
  const frei = w.freigaben.find((a) => a.version === w.aktiv);
  if (!bearbeitbar && !frei) return null;
  const basis = {
    id: w.id,
    teamId: w.teamId,
    verantwortlich: w.verantwortlich,
    bearbeitbar,
    nutzbar: Boolean(frei),
    name: bearbeitbar ? w.definition.name : frei?.definition.name,
    aktivName: frei?.definition.name ?? null,
    aktiv: w.aktiv,
    ...(detail && frei
      ? {
          veroeffentlicht: {
            ausloeser: frei.definition.ausloeser,
            brauchtFall: frei.definition.schritte.some(
              (s) => s.typ === "assistent" && s.frage.includes("{{fall}}"),
            ),
            schritte: frei.definition.schritte.map(({ typ, titel }) => ({ typ, titel })),
          },
        }
      : {}),
  };
  if (!bearbeitbar) return basis;
  const entwurf = { ...basis, revision: w.revision, entwurf: w.entwurf };
  if (!detail) return entwurf;
  const p = w.pruefung;
  return {
    ...entwurf,
    definition: w.definition,
    pruefung: p
      ? { version: p.version, sprache: p.sprache, bestanden: p.bestanden, schritte: p.schritte }
      : null,
    freigegebeneVersionen: w.freigaben.map((f) => f.version),
  };
}
export class TeamworkflowDienst implements WorkflowZugang {
  constructor(
    private readonly repo: TeamworkflowRepo,
    private readonly teams: TeamsRepo,
    private readonly assistenten: TeamassistentDienst,
  ) {}
  private async team(id: string, u: SessionUser) {
    const t = (await this.teams.fassungen(id)).at(-1);
    return t && mitglied(t, u) ? t : workflowFehlt();
  }
  async liste(u: SessionUser) {
    const zuerst = (await this.teams.aktuelle()).filter((t) => mitglied(t, u));
    const gesamt = await this.repo.fuerTeams(zuerst.map((t) => t.id));
    const teams = (await this.teams.aktuelle()).filter((t) => mitglied(t, u));
    const teamIds = new Set(teams.map((t) => t.id));
    return {
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        kannErstellen: can(u.role, "ko.create"),
      })),
      workflows: gesamt.flatMap((w) => {
        const v = teamIds.has(w.teamId) && ansicht(w, u, false);
        return v ? [v] : [];
      }),
    };
  }
  private async laden(id: string, u: SessionUser) {
    const w = await this.repo.lesen(id);
    if (!w) return workflowFehlt();
    return { w, team: await this.team(w.teamId, u) };
  }
  async lesen(id: string, u: SessionUser) {
    const { w } = await this.laden(id, u);
    return ansicht(w, u, true) ?? workflowFehlt();
  }
  private async bearbeitbar(id: string, u: SessionUser, basis: unknown) {
    const { w } = await this.laden(id, u);
    if (w.verantwortlich !== u.id || !can(u.role, "ko.create")) return workflowFehlt();
    if (w.revision !== workflowNummer(basis)) return workflowStand();
    return w;
  }
  private async schreiben(w: Teamworkflow, u: SessionUser, basis: number, freigabe?: Freigabe) {
    const t = await this.team(w.teamId, u);
    if (!(await this.repo.speichern(w, basis, t.version, u, freigabe))) return workflowStand();
    return ansicht(w, u, true);
  }
  private async assistentenStand(
    u: SessionUser,
    teamId: string,
    d: WorkflowDefinition,
    probe?: WorkflowProbe,
  ) {
    const gewaehlt = new Map<string, number>();
    for (const s of d.schritte) {
      if (s.typ !== "assistent") continue;
      const bereits = gewaehlt.get(s.assistentId);
      if (bereits === s.version) continue;
      if (bereits !== undefined) return workflowEingabe();
      const aktuell = await this.assistenten.workflowBindung(s.assistentId, u, s.version, teamId);
      if (
        probe &&
        (!isDeepStrictEqual(aktuell.quellen, probe.bindungen?.[s.assistentId]) ||
          aktuell.konflikte !== probe.konfliktstand?.[s.assistentId])
      ) {
        throw new WorkflowFehler(409, "GRUNDLAGE_GEAENDERT");
      }
      gewaehlt.set(s.assistentId, s.version);
    }
  }
  async anlegen(u: SessionUser, roh: unknown) {
    if (!can(u.role, "ko.create")) return workflowFehlt();
    const r = workflowObjekt(roh);
    const t = await this.team(workflowText(r.teamId, 150), u);
    const definition = workflowDefinition(r.definition);
    await this.assistentenStand(u, t.id, definition);
    return this.schreiben(
      {
        id: randomUUID(),
        teamId: t.id,
        verantwortlich: u.id,
        definition,
        entwurf: 1,
        revision: 1,
        aktiv: null,
        freigaben: [],
        pruefung: null,
      },
      u,
      0,
    );
  }
  async speichern(id: string, u: SessionUser, roh: unknown) {
    const r = workflowObjekt(roh);
    const w = await this.bearbeitbar(id, u, r.revision);
    if (r.teamId !== undefined && r.teamId !== w.teamId) return workflowEingabe();
    const definition = workflowDefinition(r.definition);
    await this.assistentenStand(u, w.teamId, definition);
    if (isDeepStrictEqual(w.definition, definition)) return this.lesen(id, u);
    return this.schreiben(
      { ...w, definition, revision: w.revision + 1, entwurf: w.entwurf + 1, pruefung: null },
      u,
      w.revision,
    );
  }
  private bindung(w: Teamworkflow, u: SessionUser, sitzung: WorkflowSitzung) {
    return async () => {
      const neu = await sitzung();
      if (!neu || rechtekontextStempel(neu) !== rechtekontextStempel(u)) return workflowFehlt();
      await this.bearbeitbar(w.id, neu, w.revision);
      return neu;
    };
  }
  async pruefen(id: string, u: SessionUser, roh: unknown, sitzung: WorkflowSitzung) {
    const r = workflowObjekt(roh);
    const w = await this.bearbeitbar(id, u, r.revision);
    const sprache = workflowSprache(r.sprache);
    const frisch = this.bindung(w, u, sitzung);
    const probe = await probeWorkflow(w.definition, w.teamId, u, frisch, sprache, this.assistenten);
    if (probe.bestanden) await this.assistentenStand(await frisch(), w.teamId, w.definition, probe);
    const alt = w.freigaben.find((f) => f.version === w.entwurf);
    // A published version remains immutable even if a new trial finds changed evidence.
    const entwurf =
      alt &&
      (!isDeepStrictEqual(alt.pruefung.schritte, probe.schritte) ||
        !isDeepStrictEqual(alt.pruefung.konfliktstand, probe.konfliktstand) ||
        !isDeepStrictEqual(alt.pruefung.bindungen, probe.bindungen))
        ? w.entwurf + 1
        : w.entwurf;
    return this.schreiben(
      {
        ...w,
        entwurf,
        revision: w.revision + 1,
        pruefung: { ...probe, version: entwurf, sprache },
      },
      await frisch(),
      w.revision,
    );
  }
  async freigeben(id: string, u: SessionUser, roh: unknown, sitzung: WorkflowSitzung) {
    const r = workflowObjekt(roh);
    const w = await this.bearbeitbar(id, u, r.revision);
    const version = workflowNummer(r.version);
    const alt = w.freigaben.find((f) => f.version === version);
    const fassung =
      version === w.entwurf && w.pruefung
        ? { definition: w.definition, pruefung: w.pruefung, version }
        : alt;
    if (!fassung?.pruefung.bestanden || fassung.pruefung.version !== version)
      throw new WorkflowFehler(409, "PRUEFUNG_FEHLT");
    const frisch = this.bindung(w, u, sitzung);
    const probe = await probeWorkflow(
      fassung.definition,
      w.teamId,
      u,
      frisch,
      fassung.pruefung.sprache,
      this.assistenten,
    );
    if (
      !probe.bestanden ||
      !isDeepStrictEqual(probe.schritte, fassung.pruefung.schritte) ||
      !isDeepStrictEqual(probe.konfliktstand, fassung.pruefung.konfliktstand) ||
      !isDeepStrictEqual(probe.bindungen, fassung.pruefung.bindungen)
    )
      throw new WorkflowFehler(409, "PRUEFUNG_FEHLT");
    await this.assistentenStand(await frisch(), w.teamId, fassung.definition, probe);
    return this.schreiben(
      {
        ...w,
        revision: w.revision + 1,
        aktiv: version,
        freigaben: alt ? w.freigaben : [...w.freigaben, fassung],
      },
      await frisch(),
      w.revision,
      fassung,
    );
  }
  async zurueckziehen(id: string, u: SessionUser, roh: unknown) {
    const w = await this.bearbeitbar(id, u, workflowObjekt(roh).revision);
    return this.schreiben({ ...w, revision: w.revision + 1, aktiv: null }, u, w.revision);
  }
  async loeschen(id: string, u: SessionUser, roh: unknown) {
    const w = await this.bearbeitbar(id, u, workflowObjekt(roh).revision);
    const t = await this.team(w.teamId, u);
    if (w.freigaben.length || !(await this.repo.loeschen(id, w.revision, t.version)))
      return workflowStand();
  }
  async freigabe(id: string, u: SessionUser, version?: number, laufend = false) {
    const { w, team } = await this.laden(id, u);
    if (!w.aktiv) return workflowFehlt();
    if (version !== undefined && version !== w.aktiv && !laufend) return workflowStand();
    const f = w.freigaben.find((e) => e.version === (version ?? w.aktiv));
    if (!f) return workflowFehlt();
    return { version: f.version, definition: f.definition, pruefung: f.pruefung, team };
  }
}

import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import type { SessionUser } from "../../auth";
import { can } from "../../rbac";
import { rechtekontextStempel } from "./rechtekontext";
import {
  type TeamAntwort,
  offeneTeamAntwort,
  pruefeTeamAntwortVorAuslieferung,
} from "./teamassistenten-wissen";
import type { TeamFassung, TeamsRepo } from "./teams";

export type TeamUrteil = "belegt" | "widerspruch" | "offen";
export type TeamSprache = "de" | "en" | "nl";
export interface TeamDefinition {
  name: string;
  aufgabe: string;
  sachfragen?: boolean;
  quellen: string[];
  beispiele: { frage: string; erwartet: TeamUrteil }[];
}

export interface TeamassistentWissen {
  quellstand(user: SessionUser, definition: TeamDefinition): Promise<Record<string, number> | null>;
  fragen(
    user: SessionUser,
    definition: TeamDefinition,
    frage: string,
    sprache: TeamSprache,
    gebundeneQuellen?: Readonly<Record<string, number>>,
    pruefeSitzung?: () => Promise<void>,
  ): Promise<TeamAntwort>;
}

interface Pruefung {
  sprache: TeamSprache;
  version: number;
  bestanden: boolean;
  faelle: { frage: string; erwartet: TeamUrteil; ist: TeamUrteil; bestanden: boolean }[];
  quellstand: Record<string, number>;
}

interface Freigabe {
  version: number;
  definition: TeamDefinition;
  pruefung: Pruefung;
}

interface Assistent {
  id: string;
  teamId: string;
  verantwortlich: string;
  revision: number;
  entwurf: number;
  definition: TeamDefinition;
  pruefung: Pruefung | null;
  aktiv: number | null;
  freigaben: Freigabe[];
}

export class TeamassistentFehler extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function fehlt(): never {
  throw new TeamassistentFehler(404, "NICHT_VERFUEGBAR");
}
function eingabefehler(): never {
  throw new TeamassistentFehler(400, "EINGABE");
}

function objekt(wert: unknown): Record<string, unknown> {
  if (!wert || typeof wert !== "object" || Array.isArray(wert)) return eingabefehler();
  return wert as Record<string, unknown>;
}
function text(wert: unknown, max: number): string {
  if (typeof wert !== "string") return eingabefehler();
  const t = wert.trim();
  if (!t || t.length > max) return eingabefehler();
  return t;
}
function nummer(wert: unknown): number {
  if (typeof wert !== "number" || !Number.isSafeInteger(wert) || wert < 1) return eingabefehler();
  return wert;
}
function sprache(wert: unknown): TeamSprache {
  if (wert === undefined) return "de";
  if (wert === "de" || wert === "en" || wert === "nl") return wert;
  return eingabefehler();
}
function definitionAus(wert: unknown): TeamDefinition {
  const d = objekt(wert);
  if (d.sachfragen !== undefined && typeof d.sachfragen !== "boolean") return eingabefehler();
  if (
    !Array.isArray(d.quellen) ||
    d.quellen.length > 20 ||
    !Array.isArray(d.beispiele) ||
    d.beispiele.length > 12
  )
    return eingabefehler();
  const quellen = d.quellen.map((id: unknown) => text(id, 150));
  const beispiele = d.beispiele.map((eintrag: unknown): TeamDefinition["beispiele"][number] => {
    const b = objekt(eintrag);
    if (b.erwartet !== "belegt" && b.erwartet !== "widerspruch" && b.erwartet !== "offen")
      return eingabefehler();
    return { frage: text(b.frage, 1000), erwartet: b.erwartet };
  });
  if (
    new Set(quellen).size !== quellen.length ||
    new Set(beispiele.map((b) => b.frage.toLowerCase().replace(/\s+/g, " "))).size !==
      beispiele.length
  )
    return eingabefehler();
  return {
    name: text(d.name, 100),
    aufgabe: text(d.aufgabe, 2000),
    sachfragen: d.sachfragen ?? true,
    quellen,
    beispiele,
  };
}

export interface TeamassistentRepo {
  lesen(id: string): Promise<Assistent | undefined>;
  fuerTeams(ids: string[]): Promise<Assistent[]>;
  speichern(stand: Assistent, basis: number, teamVersion: number): Promise<boolean>;
  loeschen(id: string, basis: number, teamVersion: number): Promise<boolean>;
}

export class InMemoryTeamassistentRepo implements TeamassistentRepo {
  private readonly speicher = new Map<string, Assistent>();
  async lesen(id: string) {
    return structuredClone(this.speicher.get(id));
  }
  async fuerTeams(ids: string[]) {
    return structuredClone([...this.speicher.values()].filter((s) => ids.includes(s.teamId)));
  }
  async loeschen(id: string, basis: number) {
    const s = this.speicher.get(id);
    return s?.revision === basis && !s.freigaben.length && this.speicher.delete(id);
  }
  async speichern(stand: Assistent, basis: number) {
    if (stand.revision !== basis + 1 || (this.speicher.get(stand.id)?.revision ?? 0) !== basis)
      return false;
    this.speicher.set(stand.id, structuredClone(stand));
    return true;
  }
}

export const TEAMASSISTENTEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS team_assistenten (
  id text PRIMARY KEY,
  team_id text NOT NULL,
  revision integer NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS team_assistenten_team_idx ON team_assistenten(team_id);
`;

export class PgTeamassistentRepo implements TeamassistentRepo {
  constructor(private readonly pool: Pool) {}
  async lesen(id: string) {
    const r = await this.pool.query<{ data: Assistent }>(
      "SELECT data FROM team_assistenten WHERE id=$1",
      [id],
    );
    return r.rows[0]?.data;
  }
  async fuerTeams(ids: string[]) {
    if (!ids.length) return [];
    const r = await this.pool.query<{ data: Assistent }>(
      "SELECT data FROM team_assistenten WHERE team_id=ANY($1::text[])",
      [ids],
    );
    return r.rows.map((z) => z.data);
  }
  async loeschen(id: string, basis: number, teamVersion: number) {
    const r = await this.pool.query(
      `DELETE FROM team_assistenten a WHERE a.id=$1 AND a.revision=$2
         AND jsonb_array_length(a.data->'freigaben')=0
         AND (SELECT max(t.version) FROM teams_fassungen t WHERE t.team_id=a.team_id)=$3`,
      [id, basis, teamVersion],
    );
    return r.rowCount === 1;
  }
  async speichern(stand: Assistent, basis: number, teamVersion: number) {
    if (stand.revision !== basis + 1) return false;
    const r =
      basis === 0
        ? await this.pool.query(
            `INSERT INTO team_assistenten(id,team_id,revision,data)
               SELECT $1,$2,1,$3::jsonb WHERE (SELECT max(version) FROM teams_fassungen WHERE team_id=$2)=$4
               ON CONFLICT DO NOTHING`,
            [stand.id, stand.teamId, JSON.stringify(stand), teamVersion],
          )
        : await this.pool.query(
            `UPDATE team_assistenten SET revision=$3,data=$4::jsonb WHERE id=$1 AND team_id=$2 AND revision=$5
               AND (SELECT max(version) FROM teams_fassungen WHERE team_id=$2)=$6`,
            [stand.id, stand.teamId, stand.revision, JSON.stringify(stand), basis, teamVersion],
          );
    return r.rowCount === 1;
  }
}

function gehoertZu(team: TeamFassung, id: string) {
  return !team.archiviert && (team.verantwortlich === id || team.mitglieder.includes(id));
}

function sicht(s: Assistent, team: TeamFassung, user: SessionUser, detail: boolean) {
  if (!gehoertZu(team, user.id)) return null;
  const bearbeitbar = s.verantwortlich === user.id && can(user.role, "ko.create");
  const aktiv = s.freigaben.find((f) => f.version === s.aktiv);
  const nutzbar = Boolean(aktiv) && team.mitglieder.includes(user.id);
  if (!bearbeitbar && !nutzbar) return null;
  const pruefung = s.pruefung && {
    version: s.pruefung.version,
    bestanden: s.pruefung.bestanden,
    faelle: s.pruefung.faelle,
  };
  return {
    id: s.id,
    teamId: s.teamId,
    verantwortlich: s.verantwortlich,
    bearbeitbar,
    nutzbar,
    name: bearbeitbar ? s.definition.name : aktiv?.definition.name,
    aktiv: s.aktiv,
    aktivName: aktiv?.definition.name ?? null,
    ...(bearbeitbar ? { entwurf: s.entwurf, revision: s.revision } : {}),
    ...(bearbeitbar && detail
      ? {
          definition: s.definition,
          pruefung,
          freigegebeneVersionen: s.freigaben.map((f) => f.version),
        }
      : {}),
  };
}

type SitzungLesen = () => Promise<SessionUser | undefined>;
export class TeamassistentDienst {
  constructor(
    private readonly repo: TeamassistentRepo,
    private readonly teams: TeamsRepo,
    private readonly wissen: TeamassistentWissen,
  ) {}
  async liste(user: SessionUser) {
    const erst = await this.teams.aktuelle();
    const teamIds = erst.filter((t) => gehoertZu(t, user.id)).map((t) => t.id);
    const gespeichert = await this.repo.fuerTeams(teamIds);
    const aktuell = gespeichert.length ? await this.teams.aktuelle() : erst;
    const auswahl = aktuell.filter((t) => gehoertZu(t, user.id));
    const teams = new Map(auswahl.map((t) => [t.id, t]));
    return {
      teams: auswahl.map((t) => ({
        id: t.id,
        name: t.name,
        kannErstellen: can(user.role, "ko.create"),
      })),
      assistenten: gespeichert.flatMap((s) => {
        const team = teams.get(s.teamId);
        const eintrag = team && sicht(s, team, user, false);
        return eintrag ? [eintrag] : [];
      }),
    };
  }
  private async team(id: string, user: SessionUser) {
    const team = (await this.teams.fassungen(id)).at(-1);
    if (!team || !gehoertZu(team, user.id)) return fehlt();
    return team;
  }
  private async laden(id: string, user: SessionUser) {
    const stand = await this.repo.lesen(id);
    if (!stand) return fehlt();
    return { stand, team: await this.team(stand.teamId, user) };
  }
  async lesen(id: string, user: SessionUser) {
    const { stand, team } = await this.laden(id, user);
    return sicht(stand, team, user, true) ?? fehlt();
  }
  private async entwurf(id: string, user: SessionUser, basis: unknown) {
    const { stand } = await this.laden(id, user);
    if (stand.verantwortlich !== user.id || !can(user.role, "ko.create")) return fehlt();
    if (stand.revision !== nummer(basis)) throw new TeamassistentFehler(409, "STAND_GEAENDERT");
    return stand;
  }
  private async schreiben(stand: Assistent, user: SessionUser, basis: number) {
    const team = await this.team(stand.teamId, user);
    if (!(await this.repo.speichern(stand, basis, team.version)))
      throw new TeamassistentFehler(409, "STAND_GEAENDERT");
    return sicht(stand, team, user, true);
  }
  private async quellen(user: SessionUser, definition: TeamDefinition) {
    if (!definition.quellen.length) return {};
    const stand = await this.wissen.quellstand(user, definition);
    if (!stand) throw new TeamassistentFehler(409, "QUELLEN_GEAENDERT");
    return stand;
  }
  async anlegen(user: SessionUser, roh: unknown) {
    if (!can(user.role, "ko.create")) return fehlt();
    const r = objekt(roh);
    const team = await this.team(text(r.teamId, 150), user);
    const definition = definitionAus(r.definition);
    await this.quellen(user, definition);
    return this.schreiben(
      {
        id: randomUUID(),
        teamId: team.id,
        verantwortlich: user.id,
        revision: 1,
        entwurf: 1,
        definition,
        aktiv: null,
        pruefung: null,
        freigaben: [],
      },
      user,
      0,
    );
  }
  async speichern(id: string, user: SessionUser, roh: unknown) {
    const r = objekt(roh);
    const s = await this.entwurf(id, user, r.revision);
    if (r.teamId !== undefined && r.teamId !== s.teamId) return eingabefehler();
    const definition = definitionAus(r.definition);
    await this.quellen(user, definition);
    if (isDeepStrictEqual(s.definition, definition)) return this.lesen(id, user);
    return this.schreiben(
      { ...s, revision: s.revision + 1, entwurf: s.entwurf + 1, definition, pruefung: null },
      user,
      s.revision,
    );
  }
  private async recheck(user: SessionUser, sitzung: SitzungLesen) {
    const frisch = await sitzung();
    if (!frisch || rechtekontextStempel(frisch) !== rechtekontextStempel(user)) return fehlt();
    return frisch;
  }
  private async prueffaelle(
    user: SessionUser,
    definition: TeamDefinition,
    lang: TeamSprache,
    gebunden: Readonly<Record<string, number>>,
    pruefeSitzung: () => Promise<void>,
  ) {
    const faelle = [];
    for (const b of definition.beispiele) {
      const antwort = await this.wissen.fragen(
        user,
        definition,
        b.frage,
        lang,
        gebunden,
        pruefeSitzung,
      );
      faelle.push({ ...b, ist: antwort.stand, bestanden: antwort.stand === b.erwartet });
    }
    return faelle;
  }
  async pruefen(id: string, user: SessionUser, roh: unknown, sitzung: SitzungLesen) {
    const r = objekt(roh);
    const s = await this.entwurf(id, user, r.revision);
    if (
      !s.definition.quellen.length ||
      new Set(s.definition.beispiele.map((b) => b.erwartet)).size !== 3
    )
      return eingabefehler();
    const lang = sprache(r.sprache);
    const vorher = await this.quellen(user, s.definition);
    const pruefeSitzung = async () => {
      await this.entwurf(id, await this.recheck(user, sitzung), s.revision);
    };
    const faelle = await this.prueffaelle(user, s.definition, lang, vorher, pruefeSitzung);
    const frisch = await this.recheck(user, sitzung);
    if (!isDeepStrictEqual(vorher, await this.quellen(frisch, s.definition)))
      throw new TeamassistentFehler(409, "QUELLEN_GEAENDERT");
    const alt = s.freigaben.find((f) => f.version === s.entwurf);
    // A later test may bind newer company knowledge even when the author did not edit the instructions.
    // The version already offered to members keeps its original test and source bindings.
    const neu =
      alt &&
      (!isDeepStrictEqual(alt.pruefung.quellstand, vorher) ||
        !isDeepStrictEqual(alt.pruefung.faelle, faelle));
    const entwurf = neu ? s.entwurf + 1 : s.entwurf;
    const pruefung = {
      version: entwurf,
      sprache: lang,
      quellstand: vorher,
      faelle,
      bestanden: faelle.every((f) => f.bestanden),
    };
    return this.schreiben(
      { ...s, revision: s.revision + 1, entwurf, pruefung },
      frisch,
      s.revision,
    );
  }
  async freigeben(id: string, user: SessionUser, roh: unknown, sitzung: SitzungLesen) {
    const r = objekt(roh);
    const s = await this.entwurf(id, user, r.revision);
    const version = nummer(r.version);
    const bekannt = s.freigaben.find((f) => f.version === version);
    const pruefung = version === s.entwurf ? s.pruefung : bekannt?.pruefung;
    const definition = version === s.entwurf ? s.definition : bekannt?.definition;
    if (!definition || !pruefung?.bestanden || pruefung.version !== version)
      throw new TeamassistentFehler(409, "PRUEFUNG_FEHLT");
    const pruefeQuellenstand = async (leser: SessionUser) => {
      if (!isDeepStrictEqual(pruefung.quellstand, await this.quellen(leser, definition)))
        throw new TeamassistentFehler(409, "QUELLEN_GEAENDERT");
    };
    await pruefeQuellenstand(user);
    // A conflict can change without producing a new version of either source.
    const pruefeSitzung = async () => {
      await this.entwurf(id, await this.recheck(user, sitzung), s.revision);
    };
    const faelle = await this.prueffaelle(
      user,
      definition,
      pruefung.sprache,
      pruefung.quellstand,
      pruefeSitzung,
    );
    if (!isDeepStrictEqual(pruefung.faelle, faelle))
      throw new TeamassistentFehler(409, "PRUEFUNG_FEHLT");
    const frisch = await this.recheck(user, sitzung);
    await pruefeQuellenstand(frisch);
    const freigaben = bekannt ? s.freigaben : [...s.freigaben, { version, definition, pruefung }];
    return this.schreiben(
      { ...s, revision: s.revision + 1, freigaben, aktiv: version },
      frisch,
      s.revision,
    );
  }
  async loeschen(id: string, user: SessionUser, roh: unknown) {
    const s = await this.entwurf(id, user, objekt(roh).revision);
    const team = await this.team(s.teamId, user);
    if (s.freigaben.length || !(await this.repo.loeschen(id, s.revision, team.version)))
      throw new TeamassistentFehler(409, "STAND_GEAENDERT");
  }
  async zurueckziehen(id: string, user: SessionUser, roh: unknown) {
    const s = await this.entwurf(id, user, objekt(roh).revision);
    return this.schreiben({ ...s, revision: s.revision + 1, aktiv: null }, user, s.revision);
  }
  private async teamfassung(id: string, user: SessionUser, version: number) {
    const { stand, team } = await this.laden(id, user);
    if (!team.mitglieder.includes(user.id) || !stand.aktiv) return fehlt();
    if (version !== stand.aktiv) throw new TeamassistentFehler(409, "STAND_GEAENDERT");
    return stand.freigaben.find((f) => f.version === version) ?? fehlt();
  }
  async fragen(
    id: string,
    user: SessionUser,
    roh: unknown,
    sitzung: SitzungLesen,
    modellErlaubt: boolean,
  ) {
    const r = objekt(roh);
    const version = nummer(r.version);
    const freigabe = await this.teamfassung(id, user, version);
    const lang = sprache(r.sprache);
    let antwort = await this.wissen.fragen(
      user,
      freigabe.definition,
      text(r.frage, 1000),
      lang,
      freigabe.pruefung.quellstand,
      modellErlaubt
        ? async () => {
            await this.teamfassung(id, await this.recheck(user, sitzung), version);
          }
        : undefined,
    );
    const frisch = await this.recheck(user, sitzung);
    await this.teamfassung(id, frisch, version);
    if (antwort.quellen.length) {
      const quellen = [...new Set(antwort.quellen.map((q) => q.id))];
      const aktuell = await this.wissen.quellstand(frisch, { ...freigabe.definition, quellen });
      if (
        !aktuell ||
        antwort.quellen.some(
          (q) => aktuell[q.id] !== q.version || freigabe.pruefung.quellstand[q.id] !== q.version,
        )
      )
        antwort = offeneTeamAntwort(lang);
    }
    antwort = pruefeTeamAntwortVorAuslieferung(antwort);
    return { assistentId: id, version, antwort };
  }
}

import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { Role } from "../../auth";
import {
  type SpaceEingabe,
  type SpaceFassung,
  type SpaceTeamMitglied,
  type SpaceZugangsweg,
  type SpacesRepo,
  eigenesSpaceRecht,
  zugangswege,
} from "./spaces";

// ================================================================================================
// TEAMS — EIN MITGLIEDSCHAFTSWEG AUF BESTEHENDEN KONTEN (produkt:20261009:admin-teams, ADMIN-06).
// ================================================================================================
//
// Ein Team ist KEINE Kopie von Nutzerkonten: es führt Name, Zweck, eine zuständige Person und die
// Kennungen seiner Mitglieder — Name, Rolle und Zugang stehen weiter allein am Konto (auth). Ein
// Team hat KEINE eigene Rolle und ändert keine globale Rolle.
//
// WIRKUNG: ein Space bindet ein Team mit einem Recht (`SpaceTeam` in `spaces.ts`). Beim Lesen der
// Spaces werden die aktiven Teammitglieder als ABGELEITETE Mitgliedschaft eingetragen
// (`TeamAufloesendeSpaces`) — gespeichert wird davon nichts. Damit greift die eine bestehende
// Rechteregel (`darfSpaceInhalteLesen`, `lesbareSpaces` → `sichtbarkeit.ts`) ohne zweite Auslegung,
// und zwar je ANFRAGE: `makeGuards` erhebt `spaceLesbar` bei jedem Aufruf neu. Ein Entzug wirkt
// deshalb ab der nächsten Anfrage, auch aus einem schon offenen Tab (docs/teams.md).
//
// ARCHIVIEREN STATT UMSCHREIBEN: jede Änderung ist eine neue, unveränderliche Fassung; das
// Archivieren ist eine weitere Fassung. Ein archiviertes Team nimmt keine Mitglieder mehr auf,
// lässt sich nicht neu an einen Space binden und gewährt keinen Zugang mehr. Inhalte, Autorschaft,
// Fassungen und Prüfprotokoll bleiben unberührt — ein Team besitzt keine Inhalte.

export interface TeamEingabe {
  name: string;
  zweck: string;
  /** Teamzuständigkeit — eine Konto-Kennung. Zuständig sein heisst NICHT Mitglied sein. */
  verantwortlich: string;
  /** Konto-Kennungen der aktiven Mitglieder. */
  mitglieder: string[];
}

export type TeamVorgang = "angelegt" | "geaendert" | "archiviert";

/** Eine gespeicherte, unveränderliche Fassung eines Teams. */
export interface TeamFassung extends TeamEingabe {
  id: string;
  version: number;
  archiviert: boolean;
  /** Was diese Fassung gegenüber der vorigen getan hat — für den Verlauf nach Reload. */
  vorgang: TeamVorgang;
  angelegtVon: string;
  angelegtAm: string;
  geaendertVon: string;
  geaendertAm: string;
}

export const TEAM_GRENZEN = {
  name: 80,
  zweck: 1_000,
  mitglieder: 500,
} as const;

export class TeamFehler extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TeamFehler";
  }
}

function text(wert: unknown): string {
  return typeof wert === "string" ? wert.normalize("NFC").replace(/\s+/g, " ").trim() : "";
}

/**
 * Prüft eine Pflege-Eingabe und gibt sie bereinigt zurück — oder wirft `TeamFehler`. Zuständige
 * und Mitglieder müssen bestehende Konten sein (`konten`); doppelte Mitglieder werden
 * zusammengefasst.
 */
export function pruefeTeamEingabe(roh: unknown, konten: ReadonlySet<string>): TeamEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw new TeamFehler("TEAM_UNGUELTIG", "Erwartet wird ein Team als Objekt.");
  }
  const r = roh as Record<string, unknown>;
  const name = text(r.name);
  const zweck = text(r.zweck);
  const verantwortlich = text(r.verantwortlich);
  if (!name || name.length > TEAM_GRENZEN.name) {
    throw new TeamFehler("TEAM_UNGUELTIG", "Der Name fehlt oder ist zu lang.");
  }
  if (!zweck || zweck.length > TEAM_GRENZEN.zweck) {
    throw new TeamFehler("TEAM_UNGUELTIG", "Der Zweck fehlt oder ist zu lang.");
  }
  if (!verantwortlich || !konten.has(verantwortlich)) {
    throw new TeamFehler(
      "TEAM_UNGUELTIG",
      "Die Teamzuständigkeit fehlt oder nennt kein bestehendes Konto.",
    );
  }
  return { name, zweck, verantwortlich, mitglieder: pruefeTeamMitglieder(r.mitglieder, konten) };
}

/** Eine Mitgliederliste aus Konto-Kennungen — bereinigt, ohne Doppelte — oder `TeamFehler`. */
export function pruefeTeamMitglieder(roh: unknown, konten: ReadonlySet<string>): string[] {
  const liste = roh ?? [];
  if (!Array.isArray(liste) || liste.length > TEAM_GRENZEN.mitglieder) {
    throw new TeamFehler("TEAM_UNGUELTIG", "Die Mitglieder sind keine gültige Liste.");
  }
  const mitglieder: string[] = [];
  for (const eintrag of liste) {
    const nutzer = text(eintrag);
    if (!nutzer || !konten.has(nutzer)) {
      throw new TeamFehler("TEAM_UNGUELTIG", "Ein Mitglied nennt kein bestehendes Konto.");
    }
    if (!mitglieder.includes(nutzer)) {
      mitglieder.push(nutzer);
    }
  }
  return mitglieder;
}

// ================================================================================================
// DIE AUFLÖSUNG — aus Bindung und aktuellem Teamstand die abgeleiteten Mitgliedschaften.
// ================================================================================================

export function teamMitgliederFuer(
  space: SpaceEingabe,
  teams: readonly TeamFassung[],
): SpaceTeamMitglied[] {
  const raus: SpaceTeamMitglied[] = [];
  for (const bindung of space.teams ?? []) {
    const team = teams.find((t) => t.id === bindung.team);
    if (!team || team.archiviert) {
      continue;
    }
    for (const nutzer of team.mitglieder) {
      raus.push({ nutzer, recht: bindung.recht, team: team.id });
    }
  }
  return raus;
}

export function mitTeams(
  spaces: readonly SpaceFassung[],
  teams: readonly TeamFassung[],
): SpaceFassung[] {
  return spaces.map((s) => ({ ...s, teamMitglieder: teamMitgliederFuer(s, teams) }));
}

/**
 * Die Spaces-Ablage, wie sie die App sieht: jede gelesene Fassung trägt die aus Teams abgeleiteten
 * Mitgliedschaften. Geschrieben wird ohne sie — die Ableitung ist nie Teil einer Fassung.
 */
export class TeamAufloesendeSpaces implements SpacesRepo {
  constructor(
    private readonly basis: SpacesRepo,
    private readonly teams: TeamsRepo,
  ) {}

  async aktuelle(): Promise<SpaceFassung[]> {
    const [spaces, teams] = await Promise.all([this.basis.aktuelle(), this.teams.aktuelle()]);
    return mitTeams(spaces, teams);
  }

  async fassungen(id: string): Promise<SpaceFassung[]> {
    const [spaces, teams] = await Promise.all([this.basis.fassungen(id), this.teams.aktuelle()]);
    return mitTeams(spaces, teams);
  }

  lege(fassung: SpaceFassung): Promise<boolean> {
    const { teamMitglieder: _abgeleitet, ...rein } = fassung;
    return this.basis.lege(rein);
  }
}

// ================================================================================================
// DIE WIRKUNG EINER ÄNDERUNG — vor der Bestätigung gezeigt, bei der Übernahme nachgeprüft.
// ================================================================================================

export type WirksamesRecht = ReturnType<typeof eigenesSpaceRecht>;

export interface Konto {
  id: string;
  name: string;
  role: Role;
}

export interface SpaceWirkung {
  spaceId: string;
  spaceName: string;
  /** Das Recht, das dieses Team in diesem Space vermittelt. */
  teamRecht: "lesen" | "schreiben";
  vorher: WirksamesRecht;
  nachher: WirksamesRecht;
  /** Alle Wege nach der Änderung — direkte Rechte und andere Teams bleiben benannt. */
  wegeNachher: (SpaceZugangsweg & { teamName?: string })[];
}

export interface PersonWirkung {
  nutzer: string;
  name: string;
  /** Die globale Rolle — sie ändert sich durch Teams nie. */
  role: Role;
  aenderung: "hinzu" | "entfernt" | "archiviert";
  spaces: SpaceWirkung[];
}

export interface TeamWirkung {
  teamId: string;
  version: number;
  personen: PersonWirkung[];
  /** Die Spaces, an die dieses Team gebunden ist — mit Zahl der Betroffenen. */
  spaces: { id: string; name: string; recht: "lesen" | "schreiben"; verlieren: number }[];
  /** Bindet die Bestätigung an genau diese Wirkung (Team-, Space- und Teamstand). */
  grundlage: string;
}

/**
 * Die Wirkung, wenn `vorher` durch `nachher` ersetzt wird — für jede betroffene Person und jeden
 * Space, an den das Team gebunden ist. „Betroffen" sind hinzukommende und gehende Mitglieder, beim
 * Archivieren alle Mitglieder.
 */
export function teamWirkung(
  vorher: TeamFassung,
  nachher: TeamFassung,
  spaces: readonly SpaceFassung[],
  teams: readonly TeamFassung[],
  konten: readonly Konto[],
): TeamWirkung {
  const teamsNachher = teams.map((t) => (t.id === nachher.id ? nachher : t));
  const spacesVor = mitTeams(spaces, teams);
  const spacesNach = mitTeams(spaces, teamsNachher);
  const gebunden = spaces
    .filter((s) => (s.teams ?? []).some((b) => b.team === vorher.id))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const teamName = (id: string): string | undefined => teams.find((t) => t.id === id)?.name;

  const betroffen: { id: string; aenderung: PersonWirkung["aenderung"] }[] = [];
  if (nachher.archiviert && !vorher.archiviert) {
    for (const id of vorher.mitglieder) {
      betroffen.push({ id, aenderung: "archiviert" });
    }
  } else {
    for (const id of nachher.mitglieder) {
      if (!vorher.mitglieder.includes(id)) {
        betroffen.push({ id, aenderung: "hinzu" });
      }
    }
    for (const id of vorher.mitglieder) {
      if (!nachher.mitglieder.includes(id)) {
        betroffen.push({ id, aenderung: "entfernt" });
      }
    }
  }

  const personen: PersonWirkung[] = [];
  for (const { id, aenderung } of betroffen) {
    const konto = konten.find((k) => k.id === id);
    const nutzer = { id, role: konto?.role ?? ("viewer" as Role) };
    personen.push({
      nutzer: id,
      name: konto?.name ?? id,
      role: nutzer.role,
      aenderung,
      spaces: gebunden.map((s) => {
        const vor = spacesVor.find((x) => x.id === s.id) ?? s;
        const nach = spacesNach.find((x) => x.id === s.id) ?? s;
        return {
          spaceId: s.id,
          spaceName: s.name,
          teamRecht: (s.teams ?? []).find((b) => b.team === vorher.id)?.recht ?? "lesen",
          vorher: eigenesSpaceRecht(vor, nutzer),
          nachher: eigenesSpaceRecht(nach, nutzer),
          wegeNachher: zugangswege(nach, nutzer).map((w) =>
            w.team ? { ...w, teamName: teamName(w.team) ?? w.team } : w,
          ),
        };
      }),
    });
  }
  const verliert = (r: WirksamesRecht): boolean => r === "keins" || r === "verwalten";
  const spaceZeilen = gebunden.map((s) => ({
    id: s.id,
    name: s.name,
    recht: (s.teams ?? []).find((b) => b.team === vorher.id)?.recht ?? ("lesen" as const),
    verlieren: personen.filter((p) =>
      p.spaces.some((w) => w.spaceId === s.id && !verliert(w.vorher) && verliert(w.nachher)),
    ).length,
  }));
  const grundlage = createHash("sha256")
    .update(
      JSON.stringify({
        team: vorher.id,
        version: vorher.version,
        personen,
        spaces: gebunden.map((s) => [s.id, s.version]),
      }),
    )
    .digest("hex")
    .slice(0, 32);
  return { teamId: vorher.id, version: vorher.version, personen, spaces: spaceZeilen, grundlage };
}

// ================================================================================================
// DIE ABLAGE — jede Änderung ist eine neue, unveränderliche Fassung (wie `spaces.ts`).
// ================================================================================================

export interface TeamsRepo {
  /** Je Team die jüngste Fassung. */
  aktuelle(): Promise<TeamFassung[]>;
  /** Alle Fassungen eines Teams, aufsteigend nach Version — leer, wenn es es nicht gibt. */
  fassungen(id: string): Promise<TeamFassung[]>;
  /** Legt eine neue Fassung ab. `false`, wenn es diese Version schon gibt (paralleler Schreiber). */
  lege(fassung: TeamFassung): Promise<boolean>;
}

export class InMemoryTeamsRepo implements TeamsRepo {
  private readonly zeilen = new Map<string, TeamFassung[]>();

  aktuelle(): Promise<TeamFassung[]> {
    const raus: TeamFassung[] = [];
    for (const liste of this.zeilen.values()) {
      const letzte = liste[liste.length - 1];
      if (letzte) {
        raus.push(structuredClone(letzte));
      }
    }
    return Promise.resolve(raus);
  }

  fassungen(id: string): Promise<TeamFassung[]> {
    return Promise.resolve((this.zeilen.get(id) ?? []).map((f) => structuredClone(f)));
  }

  lege(fassung: TeamFassung): Promise<boolean> {
    const liste = this.zeilen.get(fassung.id) ?? [];
    if (liste.some((f) => f.version === fassung.version)) {
      return Promise.resolve(false);
    }
    liste.push(structuredClone(fassung));
    liste.sort((a, b) => a.version - b.version);
    this.zeilen.set(fassung.id, liste);
    return Promise.resolve(true);
  }
}

/**
 * Die Tabelle der Teamfassungen. REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS`, kein
 * DROP, kein DELETE, kein UPDATE, kein Fremdschlüssel, kein Seed. Der zusammengesetzte
 * Primärschlüssel ist die Nebenläufigkeitsregel (zweiter Schreiber derselben Version → 409).
 */
export const TEAMS_SCHEMA = `
CREATE TABLE IF NOT EXISTS teams_fassungen (
  team_id text NOT NULL,
  version integer NOT NULL,
  data jsonb NOT NULL,
  geaendert_von text NOT NULL,
  geaendert_am timestamptz NOT NULL,
  PRIMARY KEY (team_id, version)
);
`;

interface FassungsZeile {
  data: TeamFassung;
}

export class PgTeamsRepo implements TeamsRepo {
  constructor(private readonly pool: Pool) {}

  async aktuelle(): Promise<TeamFassung[]> {
    const res = await this.pool.query<FassungsZeile>(
      `SELECT DISTINCT ON (team_id) data
         FROM teams_fassungen
        ORDER BY team_id, version DESC`,
    );
    return res.rows.map((z) => z.data);
  }

  async fassungen(id: string): Promise<TeamFassung[]> {
    const res = await this.pool.query<FassungsZeile>(
      "SELECT data FROM teams_fassungen WHERE team_id=$1 ORDER BY version ASC",
      [id],
    );
    return res.rows.map((z) => z.data);
  }

  async lege(fassung: TeamFassung): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO teams_fassungen(team_id, version, data, geaendert_von, geaendert_am)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (team_id, version) DO NOTHING`,
      [
        fassung.id,
        fassung.version,
        JSON.stringify(fassung),
        fassung.geaendertVon,
        fassung.geaendertAm,
      ],
    );
    return (res.rowCount ?? 0) === 1;
  }
}

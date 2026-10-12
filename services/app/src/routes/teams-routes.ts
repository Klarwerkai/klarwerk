// ================================================================================================
// TEAMS — ANLEGEN, BEARBEITEN, MITGLIEDER MIT WIRKUNGSVORSCHAU, ARCHIVIEREN (`teams.ts`, ADMIN-06).
// ================================================================================================
//
// RECHT: jede Route verlangt `users.manage` — dieselbe Kontoverwaltung, die Konten und Rollen
// pflegt. Wer sie nicht hat, bekommt 403 und es wird nichts geschrieben oder protokolliert.
//
// BESTÄTIGUNG: eine Mitgliederänderung und das Archivieren tragen die `grundlage` der zuvor
// gezeigten Wirkung (`POST /api/teams/:id/vorschau`). Hat sich seither etwas geändert — Team,
// gebundene Spaces, andere Teams —, wird nichts geschrieben und die neue Wirkung kommt zurück (409).
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { AuthService, PublicUser } from "../../../auth";
import { type Guards, sendError } from "../http";
import type { SpaceFassung, SpacesRepo } from "../spaces";
import {
  type Konto,
  type TeamEingabe,
  type TeamFassung,
  TeamFehler,
  type TeamWirkung,
  type TeamsRepo,
  pruefeTeamEingabe,
  pruefeTeamMitglieder,
  teamWirkung,
} from "../teams";

export interface TeamsRouteDienste {
  teams: TeamsRepo;
  spaces: SpacesRepo;
  auth: AuthService;
  audit?: AuditService;
  /** Uhr für `geaendertAm` — in Tests stellbar. */
  jetzt?: () => Date;
}

function fehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof TeamFehler) {
    reply.code(400).send({ error: e.code, message: e.message });
    return;
  }
  sendError(reply, e);
}

function nichtGefunden(reply: FastifyReply): void {
  reply.code(404).send({ error: "NOT_FOUND", message: "Team nicht gefunden." });
}

function archiviertAbsage(reply: FastifyReply): void {
  reply.code(409).send({
    error: "TEAM_ARCHIVIERT",
    message: "Dieses Team ist archiviert und nimmt keine Änderungen oder Mitglieder mehr auf.",
  });
}

export function teamsRoutes(dienste: TeamsRouteDienste, guards: Guards): FastifyPluginAsync {
  const jetzt = dienste.jetzt ?? (() => new Date());

  async function konten(): Promise<PublicUser[]> {
    return (await dienste.auth.listUsers()).filter((u) => u.approved);
  }

  function kontoListe(liste: readonly PublicUser[]): Konto[] {
    return liste.map((u) => ({ id: u.id, name: u.name, role: u.role }));
  }

  async function aktuellesTeam(id: string): Promise<TeamFassung | undefined> {
    const f = await dienste.teams.fassungen(id);
    return f[f.length - 1];
  }

  function teamSicht(
    team: TeamFassung,
    alle: readonly PublicUser[],
    spaces: readonly SpaceFassung[],
  ) {
    const konto = (id: string) => alle.find((u) => u.id === id);
    return {
      ...team,
      verantwortlichName: konto(team.verantwortlich)?.name ?? null,
      mitglieder: team.mitglieder.map((id) => ({
        nutzer: id,
        name: konto(id)?.name ?? null,
        role: konto(id)?.role ?? null,
      })),
      spaces: spaces
        .flatMap((s) =>
          (s.teams ?? [])
            .filter((b) => b.team === team.id)
            .map((b) => ({ id: s.id, name: s.name, recht: b.recht })),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async function wirkung(vorher: TeamFassung, nachher: TeamFassung): Promise<TeamWirkung> {
    const [spaces, teams, alle] = await Promise.all([
      dienste.spaces.aktuelle(),
      dienste.teams.aktuelle(),
      konten(),
    ]);
    return teamWirkung(vorher, nachher, spaces, teams, kontoListe(alle));
  }

  /** Die gewünschte Mitgliederliste aus einem Body — `undefined`, wenn keine angegeben ist. */
  function mitgliederAus(body: unknown, gueltig: ReadonlySet<string>): string[] | undefined {
    const roh = (body as { mitglieder?: unknown } | null)?.mitglieder;
    return roh === undefined ? undefined : pruefeTeamMitglieder(roh, gueltig);
  }

  function gleicheMitglieder(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((x) => b.includes(x));
  }

  return async (app) => {
    app.get("/api/teams", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const [teams, spaces, alle] = await Promise.all([
        dienste.teams.aktuelle(),
        dienste.spaces.aktuelle(),
        dienste.auth.listUsers(),
      ]);
      reply.code(200).send({
        teams: teams
          .sort(
            (a, b) =>
              Number(a.archiviert) - Number(b.archiviert) ||
              a.name.localeCompare(b.name) ||
              a.id.localeCompare(b.id),
          )
          .map((t) => teamSicht(t, alle, spaces)),
      });
    });

    app.get<{ Params: { id: string } }>("/api/teams/:id", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const fassungen = await dienste.teams.fassungen(request.params.id);
      const aktuell = fassungen[fassungen.length - 1];
      if (!aktuell) {
        nichtGefunden(reply);
        return;
      }
      const [spaces, alle] = await Promise.all([
        dienste.spaces.aktuelle(),
        dienste.auth.listUsers(),
      ]);
      const name = (id: string) => alle.find((u) => u.id === id)?.name ?? null;
      reply.code(200).send({
        team: teamSicht(aktuell, alle, spaces),
        // Der Verlauf aus den Fassungen selbst: wer wann was getan hat, und WER dabei kam oder ging.
        verlauf: fassungen.map((f, i) => {
          const vor = fassungen[i - 1];
          const hinzu = vor
            ? f.mitglieder.filter((m) => !vor.mitglieder.includes(m))
            : f.mitglieder;
          const weg = vor ? vor.mitglieder.filter((m) => !f.mitglieder.includes(m)) : [];
          return {
            version: f.version,
            vorgang: f.vorgang,
            geaendertVon: f.geaendertVon,
            geaendertVonName: name(f.geaendertVon),
            geaendertAm: f.geaendertAm,
            hinzugefuegt: hinzu.map((id) => ({ id, name: name(id) })),
            entfernt: weg.map((id) => ({ id, name: name(id) })),
          };
        }),
      });
    });

    // Anlegen — Version 1. Ein neues Team ist an keinen Space gebunden; es gibt noch keine Wirkung.
    app.post<{ Body: unknown }>("/api/teams", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const alle = await konten();
      let eingabe: TeamEingabe;
      try {
        eingabe = pruefeTeamEingabe(request.body, new Set(alle.map((u) => u.id)));
      } catch (e) {
        fehler(reply, e);
        return;
      }
      const am = jetzt().toISOString();
      const fassung: TeamFassung = {
        ...eingabe,
        id: randomUUID(),
        version: 1,
        archiviert: false,
        vorgang: "angelegt",
        angelegtVon: user.id,
        angelegtAm: am,
        geaendertVon: user.id,
        geaendertAm: am,
      };
      await dienste.teams.lege(fassung);
      await dienste.audit?.record({
        actor: user.id,
        action: "team.angelegt",
        target: fassung.id,
        payload: {
          version: 1,
          verantwortlich: fassung.verantwortlich,
          hinzugefuegt: fassung.mitglieder,
        },
      });
      reply.code(201).send(teamSicht(fassung, alle, await dienste.spaces.aktuelle()));
    });

    // Die Wirkung einer Mitgliederänderung (`mitglieder`) oder des Archivierens (`archivieren`).
    // Schreibt nichts.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/teams/:id/vorschau",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const aktuell = await aktuellesTeam(request.params.id);
        if (!aktuell) {
          nichtGefunden(reply);
          return;
        }
        if (aktuell.archiviert) {
          archiviertAbsage(reply);
          return;
        }
        const archivieren =
          (request.body as { archivieren?: unknown } | null)?.archivieren === true;
        let mitglieder: string[] | undefined;
        try {
          mitglieder = mitgliederAus(request.body, new Set((await konten()).map((u) => u.id)));
        } catch (e) {
          fehler(reply, e);
          return;
        }
        if (!archivieren && mitglieder === undefined) {
          reply.code(400).send({
            error: "TEAM_UNGUELTIG",
            message: "Erwartet wird die neue Mitgliederliste oder archivieren: true.",
          });
          return;
        }
        const nachher: TeamFassung = archivieren
          ? { ...aktuell, archiviert: true }
          : { ...aktuell, mitglieder: mitglieder ?? aktuell.mitglieder };
        reply.code(200).send(await wirkung(aktuell, nachher));
      },
    );

    // Bearbeiten — eine NEUE Fassung. `version` nennt die gesehene Fassung; ändern sich die
    // Mitglieder, muss `grundlage` die der gezeigten Wirkung sein.
    app.put<{ Params: { id: string }; Body: unknown }>("/api/teams/:id", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const aktuell = await aktuellesTeam(request.params.id);
      if (!aktuell) {
        nichtGefunden(reply);
        return;
      }
      if (aktuell.archiviert) {
        archiviertAbsage(reply);
        return;
      }
      const body = (request.body ?? {}) as { version?: unknown; grundlage?: unknown };
      if (typeof body.version !== "number") {
        reply.code(400).send({
          error: "VERSION_FEHLT",
          message: "Die zuletzt gesehene Version des Teams fehlt.",
        });
        return;
      }
      const alle = await konten();
      let eingabe: TeamEingabe;
      try {
        eingabe = pruefeTeamEingabe(request.body, new Set(alle.map((u) => u.id)));
      } catch (e) {
        fehler(reply, e);
        return;
      }
      const fassung: TeamFassung = {
        ...eingabe,
        id: aktuell.id,
        version: body.version + 1,
        archiviert: false,
        vorgang: "geaendert",
        angelegtVon: aktuell.angelegtVon,
        angelegtAm: aktuell.angelegtAm,
        geaendertVon: user.id,
        geaendertAm: jetzt().toISOString(),
      };
      if (body.version !== aktuell.version) {
        reply.code(409).send({
          error: "VERSION_VERALTET",
          message: "Das Team wurde inzwischen geändert. Bitte neu laden.",
          aktuelleVersion: aktuell.version,
        });
        return;
      }
      const mitgliederGeaendert = !gleicheMitglieder(aktuell.mitglieder, fassung.mitglieder);
      let w: TeamWirkung | undefined;
      if (mitgliederGeaendert) {
        w = await wirkung(aktuell, fassung);
        if (typeof body.grundlage !== "string") {
          reply.code(400).send({
            error: "VORSCHAU_FEHLT",
            message: "Eine Mitgliederänderung braucht die bestätigte Wirkungsvorschau.",
          });
          return;
        }
        if (body.grundlage !== w.grundlage) {
          reply.code(409).send({
            error: "VORSCHAU_VERALTET",
            message: "Die Rechtelage hat sich seit der Vorschau geändert. Bitte neu prüfen.",
            vorschau: w,
          });
          return;
        }
      }
      if (!(await dienste.teams.lege(fassung))) {
        reply.code(409).send({
          error: "VERSION_VERALTET",
          message: "Das Team wurde inzwischen geändert. Bitte neu laden.",
          aktuelleVersion: aktuell.version,
        });
        return;
      }
      await dienste.audit?.record({
        actor: user.id,
        action: "team.geaendert",
        target: fassung.id,
        payload: {
          vorherVersion: aktuell.version,
          version: fassung.version,
          verantwortlich: fassung.verantwortlich,
          vorherVerantwortlich: aktuell.verantwortlich,
          hinzugefuegt: fassung.mitglieder.filter((m) => !aktuell.mitglieder.includes(m)),
          entfernt: aktuell.mitglieder.filter((m) => !fassung.mitglieder.includes(m)),
          ...(w ? { betroffeneSpaces: w.spaces.map((s) => s.id) } : {}),
        },
      });
      reply.code(200).send(teamSicht(fassung, alle, await dienste.spaces.aktuelle()));
    });

    // Archivieren — eine letzte Fassung. Nur mit der Grundlage der gezeigten Folgen.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/teams/:id/archivieren",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const aktuell = await aktuellesTeam(request.params.id);
        if (!aktuell) {
          nichtGefunden(reply);
          return;
        }
        if (aktuell.archiviert) {
          archiviertAbsage(reply);
          return;
        }
        const body = (request.body ?? {}) as { version?: unknown; grundlage?: unknown };
        if (body.version !== aktuell.version) {
          reply.code(409).send({
            error: "VERSION_VERALTET",
            message: "Das Team wurde inzwischen geändert. Bitte neu laden.",
            aktuelleVersion: aktuell.version,
          });
          return;
        }
        const fassung: TeamFassung = {
          ...aktuell,
          version: aktuell.version + 1,
          archiviert: true,
          vorgang: "archiviert",
          geaendertVon: user.id,
          geaendertAm: jetzt().toISOString(),
        };
        const w = await wirkung(aktuell, fassung);
        if (typeof body.grundlage !== "string") {
          reply.code(400).send({
            error: "VORSCHAU_FEHLT",
            message: "Das Archivieren braucht die bestätigte Folgenvorschau.",
          });
          return;
        }
        if (body.grundlage !== w.grundlage) {
          reply.code(409).send({
            error: "VORSCHAU_VERALTET",
            message: "Die Rechtelage hat sich seit der Vorschau geändert. Bitte neu prüfen.",
            vorschau: w,
          });
          return;
        }
        if (!(await dienste.teams.lege(fassung))) {
          reply.code(409).send({
            error: "VERSION_VERALTET",
            message: "Das Team wurde inzwischen geändert. Bitte neu laden.",
            aktuelleVersion: aktuell.version,
          });
          return;
        }
        await dienste.audit?.record({
          actor: user.id,
          action: "team.archiviert",
          target: fassung.id,
          payload: {
            vorherVersion: aktuell.version,
            version: fassung.version,
            mitglieder: fassung.mitglieder,
            betroffeneSpaces: w.spaces.map((s) => s.id),
          },
        });
        const alle = await dienste.auth.listUsers();
        reply.code(200).send(teamSicht(fassung, alle, await dienste.spaces.aktuelle()));
      },
    );
  };
}

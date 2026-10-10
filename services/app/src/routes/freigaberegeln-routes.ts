// ================================================================================================
// ADMIN-09 · FREIGABEREGELN UND PRÜFZUSTÄNDIGKEITEN JE SPACE (produkt:20261009:admin-freigaberegeln).
// ================================================================================================
//
// RECHTE:
//   · Lesen (Übersicht): wer den Space sehen darf (`darfSpaceSehen`) — dieselbe Grenze wie
//     `GET /api/spaces/:id`. Vorgänge mit Titel nur über `darfSehen`; unsichtbare zählen nur mit.
//   · Ändern (Vorschau und Übernahme): die Kontoverwaltung (`users.manage`) — wie die bestehende
//     Standard-Prüferanzahl (`PUT /api/validation/settings`). Eine Regeländerung verändert, wer
//     über fremde Beiträge entscheidet; das ist keine Pflege eines einzelnen Arbeitsraums.
//   · Fristlauf: die Spacezuständigen oder die Kontoverwaltung (`darfSpaceBearbeiten`). Er legt nur
//     Vertretungsaufgaben an, die die Regel schon vorsieht, und ist wiederholbar.
//
// KEIN VERDECKTER FREIGABEWEG: keine dieser Routen gibt etwas frei. Entschieden wird ausschliesslich
// über die bestehenden Wege an `PUT /api/kos/:id` (`rate`, `owner-validate`, `admin-validate`),
// und dort prüft `FreigabeRegelDienst.tor` die Regel serverseitig.
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuthService } from "../../../auth";
import { can } from "../../../rbac";
import type { FreigabeRegelDienst } from "../freigaberegel-dienst";
import { type FreigabeRegel, pruefeFreigabeRegel } from "../freigaberegeln";
import { type Guards, sendError } from "../http";
import { darfSehen } from "../sichtbarkeit";
import {
  SPACE_GRENZEN,
  type SpaceFassung,
  SpaceFehler,
  darfSpaceBearbeiten,
  darfSpaceSehen,
  istArchiviert,
} from "../spaces";
import type { TeamsRepo } from "../teams";

export interface FreigaberegelnRouteDienste {
  dienst: FreigabeRegelDienst;
  auth: Pick<AuthService, "listUsers">;
  teams?: TeamsRepo;
}

function nichtGefunden(reply: FastifyReply): void {
  reply.code(404).send({ error: "NOT_FOUND", message: "Space nicht gefunden." });
}

function fehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof SpaceFehler) {
    reply.code(400).send({ error: e.code, message: e.message });
    return;
  }
  sendError(reply, e);
}

function archiviertAbsage(reply: FastifyReply): void {
  reply.code(409).send({
    error: "SPACE_ARCHIVIERT",
    message: "Dieser Space ist archiviert. Erst wiederaufnehmen, dann die Freigaberegel ändern.",
  });
}

export function freigaberegelnRoutes(
  d: FreigaberegelnRouteDienste,
  guards: Guards,
): FastifyPluginAsync {
  /** Die eingereichte Regel — gegen bestehende Konten und die Teams, die sie nennen darf. */
  async function regelAus(body: unknown, space: SpaceFassung): Promise<FreigabeRegel> {
    const konten = new Set((await d.auth.listUsers()).map((u) => u.id));
    const teams = d.teams ? await d.teams.aktuelle() : [];
    const nennbar = new Set([
      ...teams.filter((t) => !t.archiviert).map((t) => t.id),
      ...(space.freigabe?.prueferTeams ?? []),
    ]);
    return pruefeFreigabeRegel((body as { regel?: unknown } | null)?.regel, konten, nennbar);
  }

  return async (app) => {
    // Die Regelübersicht: berechtigte Prüfer, Schritte, fehlende Voraussetzungen, laufende Vorgänge.
    app.get<{ Params: { id: string } }>("/api/spaces/:id/freigaberegel", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const space = await d.dienst.aktuellerSpace(request.params.id);
      if (!space || !darfSpaceSehen(space, user)) {
        nichtGefunden(reply);
        return;
      }
      try {
        const uebersicht = await d.dienst.uebersicht(
          space,
          (ko) => darfSehen(user, ko),
          can(user.role, "users.manage"),
        );
        reply.code(200).send(uebersicht);
      } catch (e) {
        fehler(reply, e);
      }
    });

    // Alte und neue Regel samt Wirkung auf laufende Vorgänge — schreibt nichts.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/spaces/:id/freigaberegel/vorschau",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const space = await d.dienst.aktuellerSpace(request.params.id);
        if (!space || !darfSpaceSehen(space, user)) {
          nichtGefunden(reply);
          return;
        }
        if (istArchiviert(space)) {
          archiviertAbsage(reply);
          return;
        }
        try {
          const neu = await regelAus(request.body, space);
          reply.code(200).send(await d.dienst.vorschau(space, neu, (ko) => darfSehen(user, ko)));
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // Die neue Regel übernehmen — eine neue Space-Fassung, nur mit der Grundlage der Vorschau.
    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/spaces/:id/freigaberegel",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const space = await d.dienst.aktuellerSpace(request.params.id);
        if (!space || !darfSpaceSehen(space, user)) {
          nichtGefunden(reply);
          return;
        }
        if (istArchiviert(space)) {
          archiviertAbsage(reply);
          return;
        }
        const body = (request.body ?? {}) as {
          version?: unknown;
          grundlage?: unknown;
          begruendung?: unknown;
        };
        if (body.version !== space.version) {
          reply.code(409).send({
            error: "VERSION_VERALTET",
            message: "Der Space wurde inzwischen geändert. Bitte neu laden.",
            aktuelleVersion: space.version,
          });
          return;
        }
        if (typeof body.grundlage !== "string") {
          reply.code(400).send({
            error: "VORSCHAU_FEHLT",
            message: "Eine Regeländerung braucht die bestätigte Wirkungsvorschau.",
          });
          return;
        }
        const begruendung =
          typeof body.begruendung === "string" ? body.begruendung.replace(/\s+/g, " ").trim() : "";
        if (begruendung.length > SPACE_GRENZEN.begruendung) {
          reply.code(400).send({
            error: "BEGRUENDUNG_ZU_LANG",
            message: "Die Begründung ist zu lang.",
          });
          return;
        }
        const sieht = (ko: Parameters<typeof darfSehen>[1]) => darfSehen(user, ko);
        try {
          const neu = await regelAus(request.body, space);
          const ergebnis = await d.dienst.uebernehmen(space, neu, user, sieht, {
            grundlage: body.grundlage,
            begruendung: begruendung || null,
          });
          if (!ergebnis.ok) {
            if (ergebnis.grund === "unveraendert") {
              reply.code(400).send({
                error: "KEINE_AENDERUNG",
                message: "Die Regel entspricht der geltenden — es gibt nichts zu übernehmen.",
              });
              return;
            }
            if (ergebnis.grund === "vorschau_veraltet") {
              reply.code(409).send({
                error: "VORSCHAU_VERALTET",
                message:
                  "Vorgänge, Prüfer oder Regel haben sich seit der Vorschau geändert. Bitte die neue Wirkung prüfen.",
                vorschau: ergebnis.vorschau,
              });
              return;
            }
            reply.code(409).send({
              error: "VERSION_VERALTET",
              message: "Der Space wurde inzwischen geändert. Bitte neu laden.",
              aktuelleVersion: space.version,
            });
            return;
          }
          const uebersicht = await d.dienst.uebersicht(ergebnis.fassung, sieht, true);
          reply.code(200).send({ ...uebersicht, angehoben: ergebnis.angehoben });
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // Frist und Vertretung: überfällige oder verwaiste Prüfaufgaben gehen an die Vertretung.
    app.post<{ Params: { id: string } }>(
      "/api/spaces/:id/freigaberegel/fristlauf",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const space = await d.dienst.aktuellerSpace(request.params.id);
        if (!space || !darfSpaceSehen(space, user)) {
          nichtGefunden(reply);
          return;
        }
        if (!darfSpaceBearbeiten(space, user)) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message: "Den Fristlauf starten die Spacezuständigen oder die Kontoverwaltung.",
          });
          return;
        }
        try {
          reply.code(200).send(await d.dienst.fristlauf(space, user, (ko) => darfSehen(user, ko)));
        } catch (e) {
          fehler(reply, e);
        }
      },
    );
  };
}

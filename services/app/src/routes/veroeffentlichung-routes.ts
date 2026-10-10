import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { KnowledgeObject, VeroeffentlichungsMeldung } from "../../../knowledge-object";
import { can } from "../../../rbac";
import { type Guards, type SessionUser, sendError } from "../http";
import { darfSehen } from "../sichtbarkeit";
import {
  MELDUNGEN,
  type VeroeffentlichungDienst,
  VeroeffentlichungFehler,
} from "../veroeffentlichung";

// ================================================================================================
// VERÖFFENTLICHUNG · ZWEI TÜREN.
// ================================================================================================
//
//   GET  /api/kos/:id/veroeffentlichung — Stand für jeden Leser; mit `ko.validate` dazu die
//                                         Vorschau (Zustand, Sichtbarkeit, Empfänger, Kenntnisnahmen)
//   POST /api/kos/:id/veroeffentlichung — gültige Fassung veröffentlichen         ko.validate
//
// KEINE NEUE ROLLE: Veröffentlichen hängt am vorhandenen Freigaberecht (`ko.validate`,
// Controller/Admin). Jede Tür hält den Eintrag VOR jeder Antwort gegen `darfSehen` — ein
// unsichtbarer Eintrag ist hier wie am Detailabruf ein 404. Die Empfängerliste (Namen) sieht nur,
// wer veröffentlichen darf.

export interface VeroeffentlichungRoutesDeps {
  dienst: VeroeffentlichungDienst;
  kos: { get(id: string): Promise<KnowledgeObject | undefined> };
}

const FEHLERCODE: Record<VeroeffentlichungFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
  503: "NICHT_HALTBAR",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof VeroeffentlichungFehler) {
    reply.code(fehler.status).send({
      ...fehler.details,
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

function nichtGefunden(reply: FastifyReply): void {
  reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
}

function koerper(request: FastifyRequest): Record<string, unknown> {
  return request.body && typeof request.body === "object"
    ? (request.body as Record<string, unknown>)
    : {};
}

function meldungAus(wert: unknown): VeroeffentlichungsMeldung | null {
  return MELDUNGEN.find((m) => m === wert) ?? null;
}

export function veroeffentlichungRoutes(
  deps: VeroeffentlichungRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, kos } = deps;

  async function sichtbaresKo(
    user: SessionUser,
    koId: string,
  ): Promise<KnowledgeObject | undefined> {
    const ko = await kos.get(koId);
    return ko && darfSehen(user, ko) ? ko : undefined;
  }

  return async (app) => {
    app.get<{ Params: { id: string } }>(
      "/api/kos/:id/veroeffentlichung",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const ko = await sichtbaresKo(user, request.params.id);
          if (!ko) {
            nichtGefunden(reply);
            return;
          }
          // Die Empfängerliste (Namen) und die Kenntnisnahmelage sieht nur, wer veröffentlichen
          // darf; jeder andere Leser bekommt den Stand und den Verlauf.
          if (can(user.role, "ko.validate")) {
            reply
              .code(200)
              .send({ darfVeroeffentlichen: true, ...(await dienst.vorschau(ko, user.id)) });
            return;
          }
          reply.code(200).send({ darfVeroeffentlichen: false, ...(await dienst.stand(ko)) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/kos/:id/veroeffentlichung",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        const body = koerper(request);
        const fassung =
          typeof body.fassung === "number" && Number.isInteger(body.fassung) && body.fassung > 0
            ? body.fassung
            : null;
        const meldung = meldungAus(body.meldung);
        if (fassung === null || meldung === null) {
          reply.code(400).send({
            error: "VALIDATION",
            grund: "eingabe",
            message:
              "Fassung oder Meldungswahl (still, normal, hervorgehoben) fehlt oder ist ungültig.",
          });
          return;
        }
        try {
          const ko = await sichtbaresKo(user, request.params.id);
          if (!ko) {
            nichtGefunden(reply);
            return;
          }
          const ergebnis = await dienst.veroeffentlichen(ko, { fassung, meldung }, user.id);
          reply.code(201).send(ergebnis);
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}

import type { FastifyPluginAsync } from "fastify";
import type { ConflictService } from "../../../conflicts";
import { type Guards, sendError } from "../http";

// Konflikt-API (§2.3/FR-CON). Erstellen/Auflösen auch über den KO-Dispatcher möglich;
// hier zusätzlich Liste, Detail, Eskalation und Zweitmeinung.
export function conflictRoutes(conflicts: ConflictService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/conflicts", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await conflicts.unresolved());
    });

    app.get<{ Params: { id: string } }>("/api/conflicts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const conflict = await conflicts.get(request.params.id);
      if (!conflict) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Konflikt nicht gefunden." });
        return;
      }
      reply.code(200).send(conflict);
    });

    app.post<{ Params: { id: string } }>("/api/conflicts/:id/escalate", async (request, reply) => {
      const user = await guards.requirePermission("conflict.resolve", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await conflicts.escalate(request.params.id, user.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    // Berater-Konzept 04.07. (Stufe 4): „Fehlalarm — kein Widerspruch" schließt einen (meist
    // automatisch erkannten) Konflikt bewusst als falsch-positiv. Menschlicher Entscheider (⚑).
    app.post<{ Params: { id: string }; Body: { note?: string } | null }>(
      "/api/conflicts/:id/dismiss",
      async (request, reply) => {
        const user = await guards.requirePermission("conflict.resolve", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await conflicts.dismiss(request.params.id, user.id, request.body?.note));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: { opinion: string } }>(
      "/api/conflicts/:id/second-opinion",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await conflicts.secondOpinion(request.params.id, request.body.opinion, user.id));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

import type { FastifyPluginAsync } from "fastify";
import type { BoardFilter, ValidationService } from "../../../validation";
import { type Guards, sendError } from "../http";

// Validierungs-Leseansichten (§2.3). Bewerten/Zuweisen laufen über den KO-Dispatcher.
export function validationRoutes(
  validation: ValidationService,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: BoardFilter }>("/api/validation/board", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await validation.board(request.query));
    });

    app.get("/api/validation/overview", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await validation.overview());
    });

    // SCRUM-395: Standard-Prüferanzahl. Lesen dürfen alle Leseberechtigten (die
    // Erfassen-Seite zeigt den Standard an); ändern darf nur die Nutzerverwaltung.
    app.get("/api/validation/settings", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply
          .code(200)
          .send({ defaultNeededValidations: await validation.defaultNeededValidations() });
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.put<{ Body: { defaultNeededValidations?: number } }>(
      "/api/validation/settings",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const saved = await validation.setDefaultNeededValidations(
            request.body?.defaultNeededValidations,
            user.id,
          );
          reply.code(200).send({ defaultNeededValidations: saved });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

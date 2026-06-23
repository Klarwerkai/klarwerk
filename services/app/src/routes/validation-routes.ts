import type { FastifyPluginAsync } from "fastify";
import type { BoardFilter, ValidationService } from "../../../validation";
import type { Guards } from "../http";

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
  };
}

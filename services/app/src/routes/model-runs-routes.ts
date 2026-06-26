import type { FastifyPluginAsync } from "fastify";
import type { ModelRunService } from "../../../model-runs";
import type { Guards } from "../http";

// SCRUM-165: read-only Einsicht in jüngste ModelRuns (Betrieb/QM). Nur Metadaten —
// keine Prompt-/Antworttexte. Limit defensiv im Service normalisiert. Keine Write-Route.
export function modelRunRoutes(service: ModelRunService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: { limit?: string } }>("/api/model-runs", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const raw = request.query.limit;
      const limit = raw !== undefined ? Number(raw) : undefined;
      reply.code(200).send(await service.recent(limit));
    });
  };
}

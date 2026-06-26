import type { FastifyPluginAsync } from "fastify";
import type { ExternalSearchService } from "../../../external-search";
import { type Guards, sendError } from "../http";

// SCRUM-118 / FR-EXT-02: optionaler Server-Proxy für externe Quellensuche.
// Ist der Proxy nicht konfiguriert (EXTERNAL_SEARCH=off), antwortet die Route mit 501.
export function externalRoutes(
  search: ExternalSearchService | undefined,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: { q?: string } }>("/api/external/search", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      if (!search) {
        reply
          .code(501)
          .send({ error: "EXTERNAL_SEARCH_DISABLED", message: "Externe Suche ist nicht aktiv." });
        return;
      }
      try {
        reply.code(200).send(await search.search(request.query.q ?? ""));
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}

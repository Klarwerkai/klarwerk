import type { FastifyPluginAsync } from "fastify";
import type { I18nService } from "../../../i18n";

// Mehrsprachigkeit (FR-I18N). UI-Strings sind öffentlich lesbar (kein Login nötig).
export function i18nRoutes(i18n: I18nService): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/i18n/locales", async (_request, reply) => {
      reply.code(200).send({ locales: i18n.locales() });
    });

    app.get<{ Params: { locale: string; key: string } }>(
      "/api/i18n/:locale/:key",
      async (request, reply) => {
        reply.code(200).send({ value: i18n.translate(request.params.key, request.params.locale) });
      },
    );
  };
}

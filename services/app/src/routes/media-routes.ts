import type { FastifyPluginAsync } from "fastify";
import { MediaAnalysisError, type MediaAnalysisService } from "../../../media";
import type { Guards } from "../http";

// SCRUM-382: Video-/Audio-Analyse (Transkript) für die Erfassung. Der Schlüssel des
// Transkriptions-Dienstes bleibt serverseitig; der Client erhält nur Ergebnis + ehrlichen Status.
export function mediaRoutes(media: MediaAnalysisService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/media/status", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(media.engineInfo());
    });

    app.post<{
      Body: { objectId?: string; locale?: "de" | "en"; confidentiality?: string };
    }>("/api/media/analyze", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const objectId = request.body?.objectId ?? "";
      const locale = request.body?.locale === "en" ? "en" : "de";
      // SCRUM-521 (WP1): Die Vertraulichkeit wird NICHT mehr aus dem Request bestimmt. Der Service
      // liest sie serverseitig aus dem gespeicherten Objekt; `request.body.confidentiality` wird nur
      // als optionale HOCHSTUFUNG (restriktiver) durchgereicht — eine Herabstufung ist unmöglich.
      try {
        reply.code(200).send(await media.analyze(objectId, locale, request.body?.confidentiality));
      } catch (err) {
        if (err instanceof MediaAnalysisError) {
          const status =
            err.code === "NOT_FOUND" ? 404 : err.code === "UNSUPPORTED_KIND" ? 400 : 502;
          reply.code(status).send({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }
    });
  };
}

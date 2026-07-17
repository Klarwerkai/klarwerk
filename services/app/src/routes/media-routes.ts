import type { FastifyPluginAsync } from "fastify";
import { MediaAnalysisError, type MediaAnalysisService } from "../../../media";
import type { Guards } from "../http";
import { classifyProvenanceConfidential } from "./reasoner-routes";

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
      // SCRUM-502 R7: das hochgeladene Medium ist ein transient-document (Upload). Vertraulichkeit
      // fail-safe klassifizieren — fehlt/ungültig → vertraulich → kein externer Transkriptions-Egress.
      const confidential = classifyProvenanceConfidential(
        "transient-document",
        request.body?.confidentiality,
        { found: false },
      );
      try {
        reply.code(200).send(await media.analyze(objectId, locale, confidential));
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

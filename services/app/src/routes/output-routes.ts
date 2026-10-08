import type { FastifyPluginAsync } from "fastify";
import type { GenerateOutputInput, OutputService } from "../../../output";
import { type Guards, sendError } from "../http";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

// FR-EXT-03 / SCRUM-117: Output Factory. Quellen + Generierung sind read-only
// (kein Schreibzugriff, keine Persistenz). Zugriff wie Bibliothek: ko.read.
//
// R-1175: beide Türen reichen die EINE Sichtbarkeitsentscheidung dieses Betrachters in den Dienst
// (Space und Autorschaft, nicht nur die Vertraulichkeitsstufe). Ein unsichtbares Objekt fehlt in
// der Quellenliste und antwortet beim Erzeugen wie ein unbekanntes.
export function outputRoutes(output: OutputService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/output/sources", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await output.listEligible(sichtbarkeitsfilterFuer(user)));
    });

    app.post<{ Body: GenerateOutputInput }>("/api/output/generate", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await output.generate(request.body, sichtbarkeitsfilterFuer(user)));
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}

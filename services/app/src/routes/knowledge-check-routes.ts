import type { FastifyPluginAsync } from "fastify";
import type { ConflictService } from "../../../conflicts";
import type { KoService } from "../../../knowledge-object";
import type { Reasoner } from "../../../reasoner";
import type { Guards } from "../http";
import { checkKnowledge } from "../knowledge-check";

// SCRUM-527 (Live-Check): POST /api/knowledge/check — echte Ähnlichkeits-/Widerspruchsprüfung eines
// Entwurfstextes gegen den Bestand, für die Live-Reaktion in „Wissen erfassen". Auth-geschützt
// (requirePermission("ko.read") → vom routeGuardAudit erfasst, kein Blindspot). never block: bei einem
// Fehler ehrlicher Status statt 5xx; ohne Modell liefert der Endpoint ehrliche „pending"-Konflikte.
export interface KnowledgeCheckRouteDeps {
  ko: KoService;
  conflicts: ConflictService;
  reasoner: Reasoner;
  guards: Guards;
}

export function knowledgeCheckRoutes(deps: KnowledgeCheckRouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: { text?: string } }>("/api/knowledge/check", async (request, reply) => {
      const user = await deps.guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const text = typeof request.body?.text === "string" ? request.body.text : "";
      const result = await checkKnowledge(text, {
        ko: deps.ko,
        conflicts: deps.conflicts,
        reasoner: deps.reasoner,
      });
      reply.code(200).send(result);
    });
  };
}

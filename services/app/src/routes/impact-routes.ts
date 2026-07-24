import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import type { KoService } from "../../../knowledge-object";
import type { Guards } from "../http";
import { computeMyImpact } from "../impact";

// FUNKE F1 (nacht24 Paket 6): GET /api/me/impact — die persönlichen Wirkungs-Zähler des
// ANGEMELDETEN Nutzers (nur eigene Beiträge, nur Zahlen; Ableitung pure in impact.ts).
// Kein neuer Datenbestand: eigene KOs + bestehende Audits ask.query / answer.helpful.
export function impactRoutes(
  deps: { ko: Pick<KoService, "list">; audit: Pick<AuditService, "list"> },
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/me/impact", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const [kos, helpful, asks] = await Promise.all([
        deps.ko.list({}),
        deps.audit.list({ action: "answer.helpful" }),
        deps.audit.list({ action: "ask.query" }),
      ]);
      reply.code(200).send(
        computeMyImpact(
          user.id,
          kos,
          helpful.map((e) => ({ actor: e.actor, target: e.target, payload: e.payload })),
          asks.map((e) => ({ actor: e.actor, target: e.target, payload: e.payload })),
        ),
      );
    });
  };
}

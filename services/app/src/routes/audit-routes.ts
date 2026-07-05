import type { FastifyPluginAsync } from "fastify";
import type { AuditFilter, AuditService } from "../../../audit";
import type { Guards } from "../http";

// Audit-Log (§2.4 / FR-AUD). Governance-Einsicht: Controller/Admin (ko.validate-Recht).
export function auditRoutes(audit: AuditService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: AuditFilter }>("/api/audit", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await audit.list(request.query));
    });

    // SCRUM-439: aktive Integritätsprüfung der Audit-Kette (verify statt nur Aussage). Governance-
    // Einsicht wie /api/audit (ko.validate). Antwort: { ok, count } — Grundlage des Admin-Knopfs.
    app.get("/api/audit/verify", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await audit.verifyReport());
    });
  };
}

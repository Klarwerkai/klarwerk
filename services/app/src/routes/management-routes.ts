import type { FastifyPluginAsync } from "fastify";
import type { ManagementService } from "../../../management";
import type { Guards } from "../http";

// SCRUM-120 / FE-MGMT: Management-/Wissenskapital-Snapshot. Read-only, stateless.
export function managementRoutes(
  management: ManagementService,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/management/snapshot", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await management.snapshot());
    });
  };
}

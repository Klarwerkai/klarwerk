import type { FastifyPluginAsync } from "fastify";
import type { ManagementService } from "../../../management";
import type { Guards } from "../http";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

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
      // AUFTRAG-mega76 BLOCK D: der breiteste der sechs Leckpfade. Die Grundmenge wird gefiltert,
      // BEVOR gerechnet wird — sonst trügen die Scores und die Kategoriezeilen den unsichtbaren
      // Bestand weiter mit.
      reply.code(200).send(await management.snapshot({ sichtbar: sichtbarkeitsfilterFuer(user) }));
    });
  };
}

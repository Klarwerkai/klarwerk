import type { FastifyPluginAsync } from "fastify";
import type { Guards } from "../http";
import { TeamassistentFehler } from "../teamassistenten";
import type { TeamworkflowLaufDienst } from "../teamworkflow-lauf";
import { WorkflowFehler } from "../teamworkflows-vertrag";

type Params = { Params: { id: string; laufId: string } };
export function workflowLaufRoutes(
  dienst: TeamworkflowLaufDienst,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.setErrorHandler((err, _req, reply) => {
      if (reply.sent) return;
      if (err instanceof WorkflowFehler) return reply.code(err.status).send({ error: err.code });
      if (err instanceof TeamassistentFehler)
        return reply.code(409).send({ error: "GRUNDLAGE_GEAENDERT" });
      throw err;
    });
    app.get<Params>("/api/teamworkflows/:id/laeufe", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u) return dienst.liste(req.params.id, u, () => guards.requireUser(req, reply));
    });
    app.post<Params>("/api/teamworkflows/:id/laeufe", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u)
        return dienst.starten(req.params.id, u, req.body, () => guards.requireUser(req, reply));
    });
    app.get<Params>("/api/teamworkflows/:id/laeufe/:laufId", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u)
        return dienst.lesen(req.params.id, req.params.laufId, u, () =>
          guards.requireUser(req, reply),
        );
    });
    app.post<Params>("/api/teamworkflows/:id/laeufe/:laufId/weiter", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u)
        return dienst.weiter(req.params.id, req.params.laufId, u, req.body, () =>
          guards.requireUser(req, reply),
        );
    });
  };
}

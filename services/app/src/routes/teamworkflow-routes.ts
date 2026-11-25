import type { FastifyPluginAsync } from "fastify";
import { imBindungsrahmen } from "../../../reasoner";
import type { Guards } from "../http";
import { TeamassistentFehler } from "../teamassistenten";
import type { TeamworkflowDienst } from "../teamworkflows";
import { WorkflowFehler } from "../teamworkflows-vertrag";

type Params = { Params: { id: string } };

export function teamworkflowRoutes(dienst: TeamworkflowDienst, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.addHook("onRequest", (_req, _reply, done) => {
      imBindungsrahmen(() => done());
    });
    app.setErrorHandler((error, _req, reply) => {
      if (reply.sent) return;
      if (error instanceof TeamassistentFehler || error instanceof WorkflowFehler)
        return reply.code(error.status).send({ error: error.code });
      throw error;
    });
    app.get("/api/teamworkflows", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u) return dienst.liste(u);
    });
    app.get<Params>("/api/teamworkflows/:id", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u) return dienst.lesen(req.params.id, u);
    });
    app.post("/api/teamworkflows", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u) return reply.code(201).send(await dienst.anlegen(u, req.body));
    });
    app.put<Params>("/api/teamworkflows/:id", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u) return dienst.speichern(req.params.id, u, req.body);
    });
    app.delete<Params>("/api/teamworkflows/:id", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u) {
        await dienst.loeschen(req.params.id, u, req.body);
        return reply.code(204).send();
      }
    });
    app.post<Params>("/api/teamworkflows/:id/pruefen", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u)
        return dienst.pruefen(req.params.id, u, req.body, () => guards.requireUser(req, reply));
    });
    app.post<Params>("/api/teamworkflows/:id/freigeben", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u)
        return dienst.freigeben(req.params.id, u, req.body, () => guards.requireUser(req, reply));
    });
    app.post<Params>("/api/teamworkflows/:id/zurueckziehen", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u) return dienst.zurueckziehen(req.params.id, u, req.body);
    });
  };
}

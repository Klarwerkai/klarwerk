import type { FastifyPluginAsync } from "fastify";
import { imBindungsrahmen } from "../../../reasoner";
import type { Guards } from "../http";
import { type TeamassistentDienst, TeamassistentFehler } from "../teamassistenten";

import { type Ka4Freigabepruefer, ka4Freigabe, klaraBindungVorhanden } from "./ask-routes";

type Params = { Params: { id: string } };

export function teamassistentenRoutes(
  dienst: TeamassistentDienst,
  guards: Guards,
  office: Ka4Freigabepruefer,
): FastifyPluginAsync {
  return async (app) => {
    app.addHook("onRequest", (_req, _reply, done) => {
      imBindungsrahmen(() => done());
    });
    app.setErrorHandler((error, _req, reply) => {
      if (reply.sent) return;
      if (error instanceof TeamassistentFehler)
        return reply.code(error.status).send({ error: error.code });
      throw error;
    });
    app.get("/api/teamassistenten", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u) return dienst.liste(u);
    });
    app.get<Params>("/api/teamassistenten/:id", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u) return dienst.lesen(req.params.id, u);
    });
    app.post("/api/teamassistenten", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u) return reply.code(201).send(await dienst.anlegen(u, req.body));
    });
    app.put<Params>("/api/teamassistenten/:id", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u) return dienst.speichern(req.params.id, u, req.body);
    });
    app.delete<Params>("/api/teamassistenten/:id", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u) {
        await dienst.loeschen(req.params.id, u, req.body);
        return reply.code(204).send();
      }
    });
    app.post<Params>("/api/teamassistenten/:id/pruefen", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u)
        return dienst.pruefen(req.params.id, u, req.body, () => guards.requireUser(req, reply));
    });
    app.post<Params>("/api/teamassistenten/:id/freigeben", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u)
        return dienst.freigeben(req.params.id, u, req.body, () => guards.requireUser(req, reply));
    });
    app.post<Params>("/api/teamassistenten/:id/zurueckziehen", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (u) return dienst.zurueckziehen(req.params.id, u, req.body);
    });
    app.post<Params>("/api/teamassistenten/:id/fragen", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u)
        return dienst.fragen(
          req.params.id,
          u,
          req.body,
          () => guards.requireUser(req, reply),
          !klaraBindungVorhanden(req.headers) ||
            (await ka4Freigabe(office, req.headers, u.id, req.log)),
        );
    });
    app.post<Params>("/api/office/teamassistenten/:id/fragen", async (req, reply) => {
      const u = await guards.requirePermission("ko.read", req, reply);
      if (u)
        return dienst.fragen(
          req.params.id,
          u,
          req.body,
          () => guards.requireUser(req, reply),
          await ka4Freigabe(office, req.headers, u.id, req.log),
        );
    });
  };
}

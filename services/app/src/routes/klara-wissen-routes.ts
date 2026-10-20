import type { FastifyPluginAsync } from "fastify";
import type { Guards } from "../http";
import { sendError } from "../http";
import { KlaraNotizFehler } from "../klara-notiz";
import { type KlaraWissensDienst, WissensFehler, wissensZiel } from "../klara-wissensuebernahme";
import { type SpacesRepo, darfInSpaceSchreiben, darfSpaceInhalteLesen } from "../spaces";

export function klaraWissenRoutes(
  dienst: KlaraWissensDienst,
  spaces: SpacesRepo,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/me/klara/wissen/ziele", async (req, reply) => {
      const u = await guards.requirePermission("ko.create", req, reply);
      if (!u) return;
      return {
        spaces: (await spaces.aktuelle())
          .filter((s) => darfSpaceInhalteLesen(s, u.id) && darfInSpaceSchreiben(s, u))
          .map((s) => ({ id: s.id, name: s.name, version: s.version, zugang: s.zugang })),
      };
    });
    app.post("/api/me/klara/wissen/import", async (req, reply) => {
      const u = await guards.requireUser(req, reply);
      if (!u) return;
      try {
        const r = await dienst.importiere(u, req.body);
        reply.code(r.wiederholt ? 200 : 201).send(r);
      } catch (e) {
        fehler(reply, e);
      }
    });
    for (const weg of ["vorschau", "pruefen", "uebernehmen"] as const) {
      app.post<{ Params: { id: string }; Body: { fassung?: unknown; ziel?: unknown } }>(
        `/api/me/klara/notizen/:id/wissen/${weg}`,
        async (req, reply) => {
          const u = await guards.requirePermission("ko.create", req, reply);
          if (!u) return;
          try {
            const x = req.body ?? {};
            if (weg === "vorschau")
              return await dienst.vorschau(u, req.params.id, x.fassung, wissensZiel(x.ziel));
            if (weg === "pruefen") return await dienst.pruefe(u, req.params.id);
            return await dienst.uebernehmen(u, req.params.id, x);
          } catch (e) {
            fehler(reply, e);
          }
        },
      );
    }
  };
}
function fehler(reply: import("fastify").FastifyReply, e: unknown) {
  if (e instanceof WissensFehler || e instanceof KlaraNotizFehler) {
    reply
      .code(e.status)
      .send({ error: e.status === 404 ? "NOT_FOUND" : "WISSEN", message: e.message });
    return;
  }
  sendError(reply, e);
}

import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, sendError } from "../http";
import { FristenFehler } from "../klara-fristen";
import type { KlaraFristenDienst } from "../klara-fristen-dienst";

function fehler(reply: FastifyReply, err: unknown): void {
  if (err instanceof FristenFehler) {
    reply.code(err.status).send({
      error: err.status === 404 ? "NOT_FOUND" : err.status === 409 ? "CONFLICT" : "VALIDATION",
      message: err.message,
    });
  } else sendError(reply, err);
}

function rumpf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function klaraFristenRoutes(
  deps: { dienst: KlaraFristenDienst; audit: AuditService },
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/me/klara/fristen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) return;
      try {
        return reply.send(await deps.dienst.sicht(user));
      } catch (err) {
        fehler(reply, err);
      }
    });
    app.post("/api/me/klara/fristen/vorschau", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) return;
      try {
        return reply.send(await deps.dienst.vorschau(user, rumpf(request.body).regel));
      } catch (err) {
        fehler(reply, err);
      }
    });
    app.put("/api/me/klara/fristen/regel", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) return;
      try {
        const r = rumpf(request.body);
        if (!Number.isSafeInteger(r.fassung) || Number(r.fassung) < 0)
          throw new FristenFehler(400, "Die gesehene Regelfassung ist erforderlich.");
        const stand = await deps.dienst.konfigurieren(user, r.regel, Number(r.fassung));
        await deps.audit.record({
          actor: user.id,
          action: "klara.fristen.regel",
          target: `fristen:${user.id}`,
          payload: { fassung: stand.fassung, aktiv: stand.regel?.aktiv === true },
        });
        return reply.send(stand);
      } catch (err) {
        fehler(reply, err);
      }
    });
    app.post("/api/me/klara/fristen/aktualisieren", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) return;
      try {
        const stand = await deps.dienst.aktualisieren(user);
        await deps.audit.record({
          actor: user.id,
          action: "klara.fristen.gelesen",
          target: `fristen:${user.id}`,
          payload: { fassung: stand.fassung },
        });
        return reply.send(stand);
      } catch (err) {
        fehler(reply, err);
      }
    });
    app.post<{ Params: { id: string } }>(
      "/api/me/klara/fristen/:id/aktion",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) return;
        try {
          const f = await deps.dienst.aendere(user, request.params.id, request.body);
          await deps.audit.record({
            actor: user.id,
            action: "klara.fristen.aktion",
            target: `frist:${f.id}`,
            payload: { fassung: f.fassung, stand: f.stand },
          });
          return reply.send({ id: f.id, fassung: f.fassung, stand: f.stand });
        } catch (err) {
          fehler(reply, err);
        }
      },
    );
  };
}

import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, sendError } from "../http";
import { FristenFehler } from "../klara-fristen";
import { type KlaraNormereignisDienst, NormereignisFehler } from "../klara-normereignisse-dienst";

function fehler(reply: FastifyReply, err: unknown) {
  if (err instanceof FristenFehler || err instanceof NormereignisFehler)
    return reply.code(err.status).send({
      error:
        err.status === 403
          ? "FORBIDDEN"
          : err.status === 404
            ? "NOT_FOUND"
            : err.status === 409
              ? "CONFLICT"
              : "VALIDATION",
      message: err.message,
    });
  return sendError(reply, err);
}
function auswahl(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new NormereignisFehler(400, "Ausdrücklich erlaubte Bekanntmachungsquellen wählen.");
  const r = body as Record<string, unknown>;
  if (
    Object.keys(r).some((k) => k !== "quellen" && k !== "bekanntmachungErlaubt") ||
    r.bekanntmachungErlaubt !== true ||
    !Array.isArray(r.quellen) ||
    r.quellen.length < 1 ||
    r.quellen.length > 20 ||
    r.quellen.some((id) => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(id))
  )
    throw new NormereignisFehler(
      400,
      "Eine bis zwanzig konkrete erlaubte Bekanntmachungen wählen. Dieser Weg beschafft oder verarbeitet keine Normvolltexte.",
    );
  return [...new Set(r.quellen as string[])];
}

export function klaraNormereignisRoutes(
  deps: { dienst: KlaraNormereignisDienst; audit: AuditService },
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/me/klara/normereignisse", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) return;
      try {
        return reply.send(await deps.dienst.stand(user.id));
      } catch (err) {
        return fehler(reply, err);
      }
    });
    app.post("/api/me/klara/normereignisse/vorschau", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) return;
      try {
        return reply.send({
          ...(await deps.dienst.vorschau(user.id, auswahl(request.body))),
          wirkung: "keine",
        });
      } catch (err) {
        return fehler(reply, err);
      }
    });
    app.post("/api/me/klara/normereignisse/erfassen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) return;
      try {
        const vorbereitung = await deps.dienst.beobachten(user.id, auswahl(request.body), {
          gilt: () => true,
          sql: () => ({ und: ["true"], params: [] }),
        });
        const stand = await deps.dienst.stand(user.id);
        await deps.audit.record({
          actor: user.id,
          action: "klara.normereignisse.erfasst",
          target: `normereignisse:${user.id}`,
          payload: {
            fassung: stand.fassung,
            bekanntmachungErlaubt: true,
            umfang: "begrenzte_bekanntmachung",
            ereignisse: vorbereitung.ereignisse.map((e) => e.ereignis.id),
          },
        });
        return reply.send({ ...stand, ungeprueft: vorbereitung.ungeprueft });
      } catch (err) {
        return fehler(reply, err);
      }
    });
    app.get<{ Params: { id: string } }>(
      "/api/me/klara/normereignisse/:id/fachoptionen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) return;
        try {
          return reply.send({
            fassungen: await deps.dienst.fachoptionen(user.id, request.params.id),
          });
        } catch (err) {
          return fehler(reply, err);
        }
      },
    );
    app.post<{ Params: { id: string } }>(
      "/api/me/klara/normereignisse/:id/annahme",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) return;
        try {
          const r = await deps.dienst.nehmeAbloesungAn(user.id, request.params.id, request.body);
          if (!r.wiederholt)
            await deps.audit.record({
              actor: user.id,
              action: "klara.normereignisse.fachlich_angenommen",
              target: request.params.id,
              payload: {
                annahmeId: r.annahme.id,
                bisher: r.annahme.bisher,
                nachfolger: r.annahme.nachfolger,
              },
            });
          return reply.send(r);
        } catch (err) {
          return fehler(reply, err);
        }
      },
    );
    app.get<{ Params: { id: string; koId: string; fassung: string } }>(
      "/api/me/klara/normereignisse/:id/fassungen/:koId/:fassung",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) return;
        try {
          return reply.send(
            await deps.dienst.fachfassung(
              user.id,
              request.params.id,
              request.params.koId,
              Number(request.params.fassung),
            ),
          );
        } catch (err) {
          return fehler(reply, err);
        }
      },
    );
  };
}

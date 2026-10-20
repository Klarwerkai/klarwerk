import type { FastifyPluginAsync } from "fastify";
import { type ObjectStore, decodeDataUrl } from "../../../object-store";
import type { Guards } from "../http";
import { sendError } from "../http";
import type { KlaraBesprechungsDienst } from "../klara-besprechung";
import { WissensFehler } from "../klara-wissensuebernahme";
export function klaraBesprechungRoutes(
  d: KlaraBesprechungsDienst,
  objects: ObjectStore,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.post("/api/me/klara/besprechungen/import", async (req, reply) => {
      const u = await guards.requireUser(req, reply);
      if (!u) return;
      try {
        return await d.importiere(u.id, req.body);
      } catch (e) {
        if (e instanceof WissensFehler) {
          reply.code(e.status).send({ error: "BESPRECHUNG", message: e.message });
          return;
        }
        sendError(reply, e);
      }
    });
    for (const weg of ["lesen", "korrektur", "uebernehmen", "fristquelle", "teilschritt"] as const)
      app.post<{ Params: { id: string } }>(
        `/api/me/klara/besprechungen/:id/${weg}`,
        async (req, reply) => {
          const u = await guards.requireUser(req, reply);
          if (!u) return;
          try {
            return weg === "lesen"
              ? await d.sicht(u.id, req.params.id)
              : weg === "korrektur"
                ? await d.korrektur(u.id, req.params.id, req.body)
                : weg === "fristquelle"
                  ? await d.fristquelle(u.id, req.params.id, req.body)
                  : weg === "teilschritt"
                    ? await d.teilschritt(u.id, req.params.id, req.body)
                    : await d.uebernehmen(u.id, req.params.id, req.body);
          } catch (e) {
            if (e instanceof WissensFehler) {
              reply.code(e.status).send({
                error: e.status === 404 ? "NOT_FOUND" : "BESPRECHUNG",
                message: e.message,
              });
              return;
            }
            sendError(reply, e);
          }
        },
      );
    app.get<{ Params: { id: string } }>(
      "/api/me/klara/besprechungen/:id/audio",
      async (req, reply) => {
        const u = await guards.requireUser(req, reply);
        if (!u) return;
        try {
          const n = await d.hole(u.id, req.params.id);
          const id = n.wissensHerkunft?.besprechung?.audioId;
          const audio = id ? await objects.read(id) : null;
          const decoded = audio ? decodeDataUrl(audio.data) : null;
          if (!audio || !decoded || !audio.ref.mime.startsWith("audio/"))
            throw new WissensFehler(404, "Audio nicht gefunden.");
          reply
            .header("Cache-Control", "no-store, private")
            .header("Content-Type", audio.ref.mime)
            .header("X-Content-Type-Options", "nosniff")
            .send(decoded.bytes);
        } catch (e) {
          if (e instanceof WissensFehler) {
            reply.code(e.status).send({ error: "NOT_FOUND", message: "Audio nicht gefunden." });
            return;
          }
          sendError(reply, e);
        }
      },
    );
  };
}

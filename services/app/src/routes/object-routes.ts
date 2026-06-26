import type { FastifyPluginAsync } from "fastify";
import { type ObjectKind, type ObjectStore, decodeDataUrl } from "../../../object-store";
import { type Guards, sendError } from "../http";

// SCRUM-121: Objekt-/Attachment-Speicher. Upload liefert eine ObjectRef (nur Metadaten);
// das KO speichert die Referenz + kleine Vorschau statt des großen Originals.
export function objectRoutes(store: ObjectStore, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: { name: string; mime: string; data: string; kind?: ObjectKind } }>(
      "/api/objects",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          const { name, mime, data, kind } = request.body;
          reply.code(201).send(await store.put({ name, mime, data, ...(kind ? { kind } : {}) }));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/objects/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const obj = await store.read(request.params.id);
      if (!obj) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Objekt nicht gefunden." });
        return;
      }
      reply.code(200).send(obj);
    });

    // SCRUM-45/46/48 (KW-STR): rohe Bytes für <img src="/api/objects/:id/raw"> im Editor-Body.
    app.get<{ Params: { id: string } }>("/api/objects/:id/raw", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const obj = await store.read(request.params.id);
      if (!obj) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Objekt nicht gefunden." });
        return;
      }
      const decoded = decodeDataUrl(obj.data);
      if (!decoded) {
        reply.code(415).send({ error: "UNSUPPORTED", message: "Kein dekodierbares Objekt." });
        return;
      }
      reply
        .header("Content-Type", obj.ref.mime || decoded.mime)
        .header("Cache-Control", "private, max-age=31536000, immutable")
        .code(200)
        .send(decoded.bytes);
    });
  };
}

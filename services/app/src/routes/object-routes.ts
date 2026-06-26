import type { FastifyPluginAsync } from "fastify";
import type { ObjectKind, ObjectStore } from "../../../object-store";
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
  };
}

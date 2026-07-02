import type { FastifyPluginAsync } from "fastify";
import type { LifecycleService } from "../../../lifecycle";
import { type Guards, sendError } from "../http";

// Lebenszyklus & Lernpfade (§ FR-LIF). Re-Validierung/Autor-Übergabe laufen über den KO-Dispatcher.
export function lifecycleRoutes(lifecycle: LifecycleService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: { assetRef: string; koId: string } }>(
      "/api/lifecycle/couple",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        await lifecycle.couple(request.body.assetRef, request.body.koId);
        reply.code(204).send();
      },
    );

    // Audit B1 (Pedi 02.07.): gekoppelte Anlagen eines KOs lesen — fürs KO-Detail.
    app.get<{ Params: { koId: string } }>(
      "/api/lifecycle/couplings/:koId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        reply.code(200).send(await lifecycle.couplingsForKo(request.params.koId));
      },
    );

    app.post<{ Body: { assetRef: string } }>(
      "/api/lifecycle/asset-changed",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        reply.code(200).send(await lifecycle.assetChanged(request.body.assetRef));
      },
    );

    app.get("/api/lifecycle/pending", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await lifecycle.pendingRevalidation());
    });

    app.post<{ Body: { role: string; steps: { title: string }[] } }>(
      "/api/learning-paths",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        reply
          .code(201)
          .send(await lifecycle.createPath(request.body.role, request.body.steps ?? []));
      },
    );

    app.get<{ Params: { role: string } }>("/api/learning-paths/:role", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const path = await lifecycle.getPath(request.params.role);
      if (!path) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Lernpfad nicht gefunden." });
        return;
      }
      reply.code(200).send(path);
    });

    app.post<{ Params: { pathId: string }; Body: { stepId: string } }>(
      "/api/learning-paths/:pathId/complete",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(
              await lifecycle.completeStep(request.params.pathId, user.id, request.body.stepId),
            );
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Params: { pathId: string } }>(
      "/api/learning-paths/:pathId/progress",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        reply.code(200).send(await lifecycle.progress(request.params.pathId, user.id));
      },
    );
  };
}

import type { FastifyPluginAsync } from "fastify";
import type { AiCheck, KoService } from "../../../knowledge-object";
import type { BoardFilter, ValidationService } from "../../../validation";
import { type AiCheckWorker, shouldReEnqueueAiCheck } from "../ai-check-worker";
import { type Guards, sendError } from "../http";

// WP-SUBMIT-ASYNC (Neustart-Robustheit, pragmatisch + ehrlich): der Prüf-Worker hält seine Queue
// NUR im Speicher — nach einem Prozess-Neustart wäre ein pending-Job verloren. Beim Laden der
// Validierungs-Liste werden deshalb festhängende pending-KOs (requestedAt älter als
// AI_CHECK_STALE_PENDING_MS) LAZY neu eingereiht; markAiCheckPending frischt requestedAt auf,
// damit nicht jeder Board-Load erneut einreiht. GRENZE (bewusst, kein Cron/keine neue Infra):
// wird das Board nie geladen, bleibt ein verwaister Job ehrlich als pending sichtbar liegen.
export interface ValidationAiCheckDeps {
  ko: KoService;
  worker: AiCheckWorker;
}

// Validierungs-Leseansichten (§2.3). Bewerten/Zuweisen laufen über den KO-Dispatcher.
export function validationRoutes(
  validation: ValidationService,
  guards: Guards,
  aiCheck?: ValidationAiCheckDeps,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: BoardFilter }>("/api/validation/board", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const board = await validation.board(request.query);
      if (aiCheck) {
        const nowMs = Date.now();
        for (const item of board as { id: string; aiCheck?: AiCheck }[]) {
          if (shouldReEnqueueAiCheck(item.aiCheck, nowMs) && !aiCheck.worker.has(item.id)) {
            await aiCheck.ko.markAiCheckPending(item.id);
            aiCheck.worker.enqueue(item.id);
          }
        }
      }
      reply.code(200).send(board);
    });

    app.get("/api/validation/overview", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await validation.overview());
    });

    // SCRUM-395: Standard-Prüferanzahl. Lesen dürfen alle Leseberechtigten (die
    // Erfassen-Seite zeigt den Standard an); ändern darf nur die Nutzerverwaltung.
    app.get("/api/validation/settings", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply
          .code(200)
          .send({ defaultNeededValidations: await validation.defaultNeededValidations() });
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.put<{ Body: { defaultNeededValidations?: number } }>(
      "/api/validation/settings",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const saved = await validation.setDefaultNeededValidations(
            request.body?.defaultNeededValidations,
            user.id,
          );
          reply.code(200).send({ defaultNeededValidations: saved });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

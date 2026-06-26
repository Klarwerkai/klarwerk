import type { FastifyPluginAsync } from "fastify";
import { type AskService, isGapPriority } from "../../../ask";
import { type Guards, sendError } from "../http";

// Fragen & Wissenslücken (§2.4 / FR-ASK).
export function askRoutes(ask: AskService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: { question: string } }>("/api/ask", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await ask.ask(request.body.question ?? "", user.id));
    });

    // FR-ASK-04: „Hat geholfen" — Bewährung durch Nutzung.
    app.post<{ Body: { koId: string } }>("/api/ask/helpful", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        await ask.markHelpful(request.body.koId, user.id);
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.get("/api/gaps", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await ask.listGaps());
    });

    app.put<{
      Params: { id: string };
      Body: { expertId?: string; close?: boolean; action?: string; priority?: string };
    }>("/api/gaps/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.assign", request, reply);
      if (!user) {
        return;
      }
      try {
        // SCRUM-115: Priorität setzen.
        if (request.body.priority !== undefined) {
          if (!isGapPriority(request.body.priority)) {
            reply.code(400).send({ error: "BAD_REQUEST", message: "Ungültige Priorität." });
            return;
          }
          reply.code(200).send(await ask.setGapPriority(request.params.id, request.body.priority));
          return;
        }
        // Close akzeptiert sowohl { close:true } als auch { action:"close" } (FE-Kopplung).
        if (request.body.close === true || request.body.action === "close") {
          reply.code(200).send(await ask.closeGap(request.params.id));
          return;
        }
        if (request.body.expertId) {
          reply.code(200).send(await ask.assignGap(request.params.id, request.body.expertId));
          return;
        }
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: "expertId, close oder priority erforderlich." });
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.delete<{ Params: { id: string }; Querystring: { confirm?: string } }>(
      "/api/gaps/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          await ask.deleteGap(request.params.id, request.query.confirm === "true");
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

import type { FastifyPluginAsync } from "fastify";
import type { CaptureService, DraftPayload } from "../../../capture";
import type { KoService } from "../../../knowledge-object";
import type { ValidationService } from "../../../validation";
import { type Guards, sendError } from "../http";
import type { AssignmentNotifier } from "../notify";

// Entwürfe (§2.4 / FR-CAP). Gemeinsamer Pool, Autor bleibt erhalten; Promote → KO.
export interface CaptureRoutesDeps {
  capture: CaptureService;
  ko: KoService;
  // SCRUM-395: Prüfer-Vorschlag beim Promote (Zuweisung + Benachrichtigung wie im Board).
  validation: ValidationService;
  notifyAssignment?: AssignmentNotifier;
}

export function captureRoutes(deps: CaptureRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { capture, ko, validation, notifyAssignment } = deps;

  return async (app) => {
    app.get("/api/drafts", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await capture.listDrafts());
    });

    app.post<{ Body: DraftPayload }>("/api/drafts", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(201).send(await capture.createDraft(request.body, user.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.get<{ Params: { id: string } }>("/api/drafts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const draft = await capture.getDraft(request.params.id);
      if (!draft) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Entwurf nicht gefunden." });
        return;
      }
      reply.code(200).send(draft);
    });

    app.put<{ Params: { id: string }; Body: DraftPayload }>(
      "/api/drafts/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await capture.continueDraft(request.params.id, request.body, user.id));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.delete<{ Params: { id: string } }>("/api/drafts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        await capture.deleteDraft(request.params.id);
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    // FR-CAP-07: Entwurf → Wissensobjekt; Autor = Originalautor (in toKoInput gesetzt).
    // SCRUM-395: optionaler Prüfer-Vorschlag beim Einreichen — wie bei POST /api/kos
    // (dedupliziert, ohne den Einreicher selbst; Benachrichtigung über FR-VAL-07).
    app.post<{ Params: { id: string }; Body: { reviewerIds?: string[] } | null }>(
      "/api/drafts/:id/promote",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          const input = await capture.toKoInput(request.params.id);
          const created = await ko.create(input);
          await capture.deleteDraft(request.params.id);
          const reviewers = [...new Set(request.body?.reviewerIds ?? [])].filter(
            (id) => id !== user.id,
          );
          if (reviewers.length > 0) {
            await validation.assign(created.id, reviewers, user.id);
            await notifyAssignment?.(created.id, reviewers);
          }
          reply.code(201).send(created);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

import type { FastifyPluginAsync } from "fastify";
import type { ConflictInput, ConflictService } from "../../../conflicts";
import type {
  CreateKoInput,
  KnowledgeType,
  KoService,
  KoStatus,
  ReviseKoInput,
} from "../../../knowledge-object";
import type { LifecycleService } from "../../../lifecycle";
import type { ValidationService, Verdict } from "../../../validation";
import { type Guards, sendError } from "../http";
import type { AssignmentNotifier } from "../notify";

// Knowledge-Object-API (§2.3). Mutationen laufen über EINEN Endpunkt
// PUT /api/kos/:id, der per {action} an das passende Modul verzweigt — die
// Orchestrierung über Modulgrenzen ist Aufgabe der App (Composition-Root).
export interface KoRoutesDeps {
  ko: KoService;
  validation: ValidationService;
  conflicts: ConflictService;
  lifecycle: LifecycleService;
  notifyAssignment?: AssignmentNotifier; // FR-VAL-07
}

interface KoQuery {
  type?: KnowledgeType;
  status?: KoStatus;
  category?: string;
  tag?: string;
}

interface PutBody {
  action: string;
  verdict?: Verdict;
  userIds?: string[];
  changes?: ReviseKoInput;
  category?: string;
  tags?: string[];
  conflict?: ConflictInput;
  conflictId?: string;
  decision?: string;
  newAuthor?: string;
}

export function koRoutes(deps: KoRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { ko, validation, conflicts, lifecycle, notifyAssignment } = deps;

  return async (app) => {
    app.get<{ Querystring: KoQuery }>("/api/kos", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await ko.list(request.query));
    });

    app.get<{ Params: { id: string } }>("/api/kos/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const item = await ko.get(request.params.id);
      if (!item) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
        return;
      }
      reply.code(200).send(item);
    });

    app.post<{ Body: Omit<CreateKoInput, "author"> }>("/api/kos", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        // FR-CAP-07: Autor = angemeldeter Nutzer, serverseitig gesetzt (nicht aus dem Body).
        reply.code(201).send(await ko.create({ ...request.body, author: user.id }));
      } catch (error) {
        sendError(reply, error);
      }
    });

    // FR-RBAC-02: Löschen nur Controller/Admin (nur diese Rollen haben ko.validate).
    app.delete<{ Params: { id: string } }>("/api/kos/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      try {
        await ko.delete(request.params.id, user.id);
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    // PUT /api/kos/:id — ein Mutations-Endpunkt, per {action} verzweigt (§2.3).
    app.put<{ Params: { id: string }; Body: PutBody }>("/api/kos/:id", async (request, reply) => {
      const { id } = request.params;
      const body = request.body;
      const badRequest = (message: string): void => {
        reply.code(400).send({ error: "BAD_REQUEST", message });
      };
      try {
        switch (body.action) {
          case "rate": {
            const user = await guards.requirePermission("ko.validate", request, reply);
            if (!user) {
              return;
            }
            if (!body.verdict) {
              return badRequest("verdict fehlt.");
            }
            reply.code(200).send(await validation.rate(id, user.id, body.verdict));
            return;
          }
          case "assign": {
            const user = await guards.requirePermission("ko.assign", request, reply);
            if (!user) {
              return;
            }
            await validation.assign(id, body.userIds ?? [], user.id);
            await notifyAssignment?.(id, body.userIds ?? []); // FR-VAL-07
            reply.code(204).send();
            return;
          }
          case "revise": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            reply.code(200).send(await ko.revise(id, body.changes ?? {}, user.id));
            return;
          }
          case "category": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            if (!body.category) {
              return badRequest("category fehlt.");
            }
            reply.code(200).send(await ko.updateCategory(id, body.category, user.id));
            return;
          }
          case "tags": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            reply.code(200).send(await ko.updateTags(id, body.tags ?? []));
            return;
          }
          case "conflict": {
            const user = await guards.requirePermission("ko.validate", request, reply);
            if (!user) {
              return;
            }
            if (!body.conflict) {
              return badRequest("conflict fehlt.");
            }
            reply.code(201).send(await conflicts.create(body.conflict, user.id));
            return;
          }
          case "resolve-conflict": {
            const user = await guards.requirePermission("conflict.resolve", request, reply);
            if (!user) {
              return;
            }
            if (!body.conflictId || !body.decision) {
              return badRequest("conflictId/decision fehlt.");
            }
            reply.code(200).send(await conflicts.resolve(body.conflictId, user.id, body.decision));
            return;
          }
          case "transfer-author": {
            const user = await guards.requirePermission("users.manage", request, reply);
            if (!user) {
              return;
            }
            if (!body.newAuthor) {
              return badRequest("newAuthor fehlt.");
            }
            reply.code(200).send(await lifecycle.transferAuthor(id, body.newAuthor, user.id));
            return;
          }
          case "revalidate": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            reply.code(200).send(await lifecycle.confirmStillValid(id, user.id));
            return;
          }
          default:
            badRequest(`Unbekannte Aktion: ${body.action}`);
        }
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}

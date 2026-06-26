import type { FastifyPluginAsync } from "fastify";
import type { ConflictInput, ConflictService } from "../../../conflicts";
import {
  type CreateKoInput,
  type KnowledgeType,
  type KoService,
  type KoStatus,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  type ReviseKoInput,
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
  text?: string;
  attachment?: {
    name?: string;
    mime?: string;
    dataUrl?: string;
    objectId?: string;
    thumbnail?: string;
    size?: number;
  };
  attachmentId?: string;
  source?: { label?: string; url?: string; excerpt?: string };
  sourceId?: string;
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
          case "comment": {
            // FR-KO-06: jeder angemeldete Nutzer darf kommentieren.
            const user = await guards.requireUser(request, reply);
            if (!user) {
              return;
            }
            if (!body.text?.trim()) {
              return badRequest("text fehlt.");
            }
            reply.code(200).send(await ko.addComment(id, user.id, body.text.trim()));
            return;
          }
          case "attach": {
            // FR-CAP-05 / SCRUM-121: Anhang anfügen. Neu: Objekt-Referenz + kleine Vorschau;
            // alt (rückwärtskompatibel): Inline-Daten-URL.
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            const att = body.attachment;
            if (!att?.name || !att.mime) {
              return badRequest("attachment {name, mime} fehlt.");
            }
            const current = await ko.get(id);
            if ((current?.attachments?.length ?? 0) >= MAX_ATTACHMENTS) {
              return badRequest(`Maximal ${MAX_ATTACHMENTS} Anhänge je Objekt.`);
            }
            if (att.objectId) {
              // SCRUM-121: Original liegt im Object-Store; am KO nur Referenz + kleine Vorschau.
              if (att.thumbnail && att.thumbnail.length > MAX_ATTACHMENT_BYTES) {
                return badRequest("Vorschau zu groß (Pilot-Limit überschritten).");
              }
              reply.code(200).send(
                await ko.addAttachment(id, user.id, {
                  name: att.name,
                  mime: att.mime,
                  objectId: att.objectId,
                  ...(att.thumbnail ? { thumbnail: att.thumbnail } : {}),
                  ...(att.size !== undefined ? { size: att.size } : {}),
                }),
              );
              return;
            }
            // Alt-Pfad: Inline-Daten-URL (Bild-Thumbnail).
            if (!att.dataUrl) {
              return badRequest("attachment braucht objectId oder dataUrl.");
            }
            if (!att.mime.startsWith("image/") || !att.dataUrl.startsWith("data:")) {
              return badRequest("Nur Bild-Daten-URLs erlaubt.");
            }
            if (att.dataUrl.length > MAX_ATTACHMENT_BYTES) {
              return badRequest("Anhang zu groß (Pilot-Limit überschritten).");
            }
            reply.code(200).send(
              await ko.addAttachment(id, user.id, {
                name: att.name,
                mime: att.mime,
                dataUrl: att.dataUrl,
              }),
            );
            return;
          }
          case "detach": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            if (!body.attachmentId) {
              return badRequest("attachmentId fehlt.");
            }
            reply.code(200).send(await ko.removeAttachment(id, body.attachmentId, user.id));
            return;
          }
          case "add-source": {
            // SCRUM-129 / FR-KO-07: externe Quelle anhängen (Bearbeiterpfad).
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            if (!body.source?.label?.trim()) {
              return badRequest("source.label fehlt.");
            }
            reply.code(200).send(
              await ko.addSource(id, user.id, {
                label: body.source.label,
                url: body.source.url ?? null,
                excerpt: body.source.excerpt ?? null,
              }),
            );
            return;
          }
          case "remove-source": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            if (!body.sourceId) {
              return badRequest("sourceId fehlt.");
            }
            reply.code(200).send(await ko.removeSource(id, body.sourceId, user.id));
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

import type { FastifyPluginAsync } from "fastify";
import type { KoFilter } from "../../../knowledge-object";
import type { ImportItem, LibraryService, ReviewAction } from "../../../library-analytics";
import { type Guards, sendError } from "../http";

// Bibliothek & Analytics (§2.3/§2.4 / FR-LIB, FR-ANA).
export function libraryRoutes(library: LibraryService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: KoFilter & { q?: string } }>(
      "/api/library/search",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const { q, ...filter } = request.query;
        reply.code(200).send(await library.search(q ?? "", filter));
      },
    );

    app.get<{ Querystring: { format?: string } }>("/api/library/export", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      if (request.query.format === "markdown") {
        reply
          .header("content-type", "text/markdown; charset=utf-8")
          .code(200)
          .send(await library.exportMarkdown());
        return;
      }
      if (request.query.format === "mediawiki") {
        reply
          .header("content-type", "text/plain; charset=utf-8")
          .code(200)
          .send(await library.exportMediaWiki());
        return;
      }
      if (request.query.format === "html") {
        // FR-LIB-02: druckfertiges HTML; PDF entsteht im Browser-Druck.
        reply
          .header("content-type", "text/html; charset=utf-8")
          .code(200)
          .send(await library.exportHtml());
        return;
      }
      reply.code(200).send(await library.exportJson());
    });

    app.post<{ Body: { items: ImportItem[] } }>("/api/library/import", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await library.importJson(request.body.items ?? [], user.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    // SCRUM-116: Import-/Source-Review-Kandidaten (JSON-Re-Import mit Review-Queue).
    app.post<{ Body: { items: ImportItem[] } }>(
      "/api/library/import/candidates",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(201)
            .send(await library.createImportCandidates(request.body.items ?? [], user.id));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get("/api/library/import/candidates", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await library.listImportCandidates());
    });

    app.put<{ Params: { id: string }; Body: { action: ReviewAction; note?: string } }>(
      "/api/library/import/candidates/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(
              await library.reviewImportCandidate(
                request.params.id,
                request.body.action,
                user.id,
                request.body.note,
              ),
            );
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get("/api/analytics", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await library.analytics());
    });

    app.get("/api/analytics/busfactor", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await library.busFactor());
    });

    app.get("/api/graph", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await library.graph());
    });
  };
}

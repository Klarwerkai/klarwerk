import type { FastifyPluginAsync } from "fastify";
import { type ConfluenceSourceAdapter, createConfluenceAdapterFromEnv } from "../../../confluence";
import type { KoService } from "../../../knowledge-object";
import type { LibraryService } from "../../../library-analytics";
import { type ImportRunSummary, runConfluenceImport } from "../confluence-import";
import type { Guards } from "../http";

// SCRUM-510 WP2: Admin-Trigger für den Confluence-Space-Import. NUR bei aktivem KLARWERK_CONFLUENCE_IMPORT
// registriert (Flag OFF → Route existiert nicht). Echte Admin-Auth (users.manage, wie die übrigen
// Admin-Routen → vom routeGuardAudit-Scanner erfasst, kein Blindspot). Modi: dry-run (zählt/listet,
// schreibt nichts) und echt. REVIEW-INVARIANTE: alles landet nur als Kandidat, keine Auto-KOs.

export interface ConfluenceImportRouteDeps {
  library: LibraryService;
  koService: KoService;
  guards: Guards;
  // Injizierbar für Tests (Fixture-Adapter); Standard = env-basierte, gecappte Adapter-Factory.
  makeAdapter?: () => ConfluenceSourceAdapter | undefined;
}

export function confluenceImportRoutes(deps: ConfluenceImportRouteDeps): FastifyPluginAsync {
  const makeAdapter = deps.makeAdapter ?? (() => createConfluenceAdapterFromEnv());
  return async (app) => {
    app.post<{ Body: { dryRun?: boolean } }>(
      "/api/admin/import/confluence",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          reply.code(503).send({
            error: "IMPORT_UNAVAILABLE",
            message: "Confluence-Import nicht konfiguriert.",
          });
          return;
        }
        const dryRun = request.body?.dryRun === true;
        try {
          const summary: ImportRunSummary = await runConfluenceImport({
            adapter,
            library: deps.library,
            koService: deps.koService,
            dryRun,
            actor: user.id,
          });
          reply.code(200).send(summary);
        } catch {
          // Never block: ehrlicher Fehlerstatus, KEINE Interna/Token im Body.
          reply
            .code(502)
            .send({ error: "IMPORT_FAILED", message: "Confluence-Import fehlgeschlagen." });
        }
      },
    );
  };
}

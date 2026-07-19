import type { FastifyPluginAsync } from "fastify";
import { type ConfluenceSourceAdapter, createConfluenceAdapterFromEnv } from "../../../confluence";
import type { KoService } from "../../../knowledge-object";
import type { LibraryService } from "../../../library-analytics";
import { type ImportRunSummary, runConfluenceImport } from "../confluence-import";
import type { Guards } from "../http";
import { sanitizeLogText } from "../log-sanitize";

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
    // WP-E (19.07.2026): JEDER Sende-Pfad endet mit `return reply`. Reply ist ein Thenable — die
    // Handler-Promise adoptiert es und resolved erst NACH Response-Ende; Fastifys Promise-Abschluss
    // (wrap-thenable) sieht dann sent=true und sendet nie ein zweites Mal. Resolved der Handler
    // stattdessen mit undefined, sendet wrap-thenable erneut, sobald globale async-onSend-Hooks das
    // writeHead über die Handler-Resolution hinaus verzögern (≥2 async-Hops) → ERR_HTTP_HEADERS_SENT
    // als unhandled rejection → Prozess-Crash. Der systemische Schutz (globale onSend-Hooks synchron)
    // liegt in addin-static-routes.ts/server.ts; `return reply` ist die handler-lokale Absicherung.
    app.post<{ Body: { dryRun?: boolean } }>(
      "/api/admin/import/confluence",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          reply.code(503).send({
            error: "IMPORT_UNAVAILABLE",
            message: "Confluence-Import nicht konfiguriert.",
          });
          return reply;
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
          return reply;
        } catch (err) {
          // WP-E: Ursache server-seitig sichtbar machen (analog importDetectionLog) — NUR die Message
          // (vom rest-client bereits via redactedError/redactSecrets redigiert), NIE Stack oder cause.
          // WP-E2: zusätzlich senkenseitig sanitisiert (zweite Verteidigungslinie, quellen-agnostisch).
          console.warn(
            "[confluence-import] fehlgeschlagen:",
            sanitizeLogText(err instanceof Error ? err.message : String(err)),
          );
          // Never block: ehrlicher Fehlerstatus, KEINE Interna/Token im Body.
          reply
            .code(502)
            .send({ error: "IMPORT_FAILED", message: "Confluence-Import fehlgeschlagen." });
          return reply;
        }
      },
    );
  };
}

import type { FastifyPluginAsync } from "fastify";
import type { ConflictService, OverlapService, OverlapSettingsRepo } from "../../../conflicts";
import type { KoFilter, KoService } from "../../../knowledge-object";
import {
  type ImportItem,
  type LibraryService,
  type ReviewAction,
  imageCaptionTexts,
} from "../../../library-analytics";
import { can } from "../../../rbac";
import type { Reasoner } from "../../../reasoner";
import { detectConflictsForKo } from "../conflict-detection";
import { type SemanticPrefilter, detectDuplicatesForKo } from "../duplicate-detection";
import { type Guards, sendError } from "../http";

// Consultant-System (Experten-Matching): Feature-Flag, Default AUS. Vor der BR/DSB-Freigabe bleibt das
// Thema→Personen-Matching unsichtbar (Route antwortet 404, als gäbe es sie nicht). Erst
// KLARWERK_EXPERT_MATCHING=1|true schaltet sie frei.
function expertMatchingEnabled(): boolean {
  const flag = process.env.KLARWERK_EXPERT_MATCHING;
  return flag === "1" || flag === "true";
}

// SCRUM-470 (Confluence-Import): Feature-Flag, Default AUS. Nur wenn aktiv, läuft nach einem
// akzeptierten Import-Kandidaten die Widerspruchs-/Duplikat-Erkennung (S6). Aus = heutiges Verhalten.
function confluenceImportEnabled(): boolean {
  const flag = process.env.KLARWERK_CONFLUENCE_IMPORT;
  return flag === "1" || flag === "true";
}

// SCRUM-470 (ben-Review #2): erlaubte Review-Aktionen — Single Source of Truth für die Route-Validierung.
const REVIEW_ACTIONS: readonly ReviewAction[] = ["accept", "reject", "info"];

// ben-Review #6: schmale, immer sichtbare Log-Linie für best-effort-Erkennung am Import-Accept-Pfad
// (Fastify läuft ohne eigenen Logger) — analog defaultLog des dup-prefilters. Bewusst kein Werfen.
function importDetectionLog(msg: string, err: unknown): void {
  console.warn(`[import-accept-detection] ${msg}`, err);
}

// SCRUM-470 (S6): Deps für die Erkennung nach einem akzeptierten Import-Kandidaten. Dieselben Bausteine,
// die auch der Promote-Pfad (capture-routes) nutzt — hier gebündelt, damit der Route-Layer sie an
// detect*ForKo reichen kann. Optional: fehlt das Bündel, unterbleibt die Erkennung (wie bisher).
export interface ImportDetectionDeps {
  ko: KoService;
  conflicts: ConflictService;
  overlaps: OverlapService;
  overlapSettings: OverlapSettingsRepo;
  reasoner: Reasoner;
  semanticPrefilter?: SemanticPrefilter | undefined;
}

// Bibliothek & Analytics (§2.3/§2.4 / FR-LIB, FR-ANA).
export function libraryRoutes(
  library: LibraryService,
  guards: Guards,
  detection?: ImportDetectionDeps,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: KoFilter & { q?: string } }>(
      "/api/library/search",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const { q, ...filter } = request.query;
        // WP-BILD-1f (bens P4): die Trefferliste transportiert KEINE Bilddaten — bodyHtml (mit
        // potenziell megabyte-großen eingebetteten base64-Bildern) bleibt weg; die durchsuchbaren
        // Bild-Fußnoten reisen stattdessen als kleines additives captionTexts-Feld mit (der Client
        // kennzeichnet damit die Fundstelle). Detailansichten laden ihr KO weiterhin einzeln voll.
        const hits = await library.search(q ?? "", filter);
        reply.code(200).send(
          hits.map(({ bodyHtml, ...rest }) => ({
            ...rest,
            captionTexts: imageCaptionTexts(bodyHtml),
          })),
        );
      },
    );

    app.get<{ Querystring: { format?: string } }>("/api/library/export", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // SCRUM-506: der Export durchsetzt Validiert-only + Vertraulichkeit wie die übrigen Egress-
      // Pfade. Vertrauliche KOs nur für Berechtigte — hier an ko.validate gebunden (Controller/
      // Admin, die den Bestand ohnehin kuratieren). Alle anderen Rollen (viewer/experte) bekommen
      // nur die validierten, nicht-vertraulichen KOs.
      const opts = { includeConfidential: can(user.role, "ko.validate") };
      if (request.query.format === "markdown") {
        reply
          .header("content-type", "text/markdown; charset=utf-8")
          .code(200)
          .send(await library.exportMarkdown(opts));
        return;
      }
      if (request.query.format === "mediawiki") {
        reply
          .header("content-type", "text/plain; charset=utf-8")
          .code(200)
          .send(await library.exportMediaWiki(opts));
        return;
      }
      if (request.query.format === "html") {
        // FR-LIB-02: druckfertiges HTML; PDF entsteht im Browser-Druck.
        reply
          .header("content-type", "text/html; charset=utf-8")
          .code(200)
          .send(await library.exportHtml(opts));
        return;
      }
      reply.code(200).send(await library.exportJson(opts));
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
        // SCRUM-470 (ben-Review #2): Review-Aktion an der Route auf die Whitelist prüfen. Der Service
        // behandelt alles außer "reject"/"info" als Accept — ein Tippfehler wie {action:"foo"} würde
        // sonst still ein KO anlegen/revidieren. Ungültige Aktion → 400, kein KO-Write.
        if (!REVIEW_ACTIONS.includes(request.body.action)) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "Ungültige Review-Aktion (accept/reject/info).",
          });
          return;
        }
        try {
          const result = await library.reviewImportCandidate(
            request.params.id,
            request.body.action,
            user.id,
            request.body.note,
          );
          // SCRUM-470 (S6): ein akzeptierter Import-Kandidat wird — wie ein promoteter Entwurf im
          // Einreiche-Pfad — auf Widerspruch/Duplikat geprüft. Hinter dem Import-Flag (Default AUS).
          // detect*ForKo sind selbst fehlertolerant (schlucken Fehler intern) → der Accept kann daran
          // nie scheitern. VOR send(), damit das Ergebnis deterministisch sichtbar ist (analog Promote).
          if (detection && confluenceImportEnabled() && result.koId) {
            // ben-Review #6: Erkennungsfehler bleiben best-effort (kippen den Accept nie), werden aber
            // sichtbar geloggt (statt still geschluckt) — dieselbe Log-Linie wie beim dup-prefilter.
            await detectConflictsForKo(
              result.koId,
              { ko: detection.ko, conflicts: detection.conflicts, reasoner: detection.reasoner },
              importDetectionLog,
            );
            await detectDuplicatesForKo(
              result.koId,
              {
                ko: detection.ko,
                overlaps: detection.overlaps,
                reasoner: detection.reasoner,
                settings: detection.overlapSettings,
                semanticPrefilter: detection.semanticPrefilter,
              },
              importDetectionLog,
            );
          }
          reply.code(200).send(result);
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

    // Consultant-System (Experten-Matching): Thema → beitragende Personen. Hinter Feature-Flag
    // (Default AUS → 404) und ENGER als die übrigen Analytics: nur ko.assign (controller/admin), die
    // real entscheiden „wen einbeziehe ich". Personen-Matching ist datenschutzsensibel (BetrVG §87(1)6,
    // DSGVO) — scharf erst nach BR/DSB-Freigabe.
    app.get("/api/analytics/expertise", async (request, reply) => {
      if (!expertMatchingEnabled()) {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      const user = await guards.requirePermission("ko.assign", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await library.expertise());
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

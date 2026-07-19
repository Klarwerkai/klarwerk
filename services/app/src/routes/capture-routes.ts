import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { CaptureService, Draft, DraftPayload } from "../../../capture";
import type { ConflictService, OverlapService, OverlapSettingsRepo } from "../../../conflicts";
import type { KoService } from "../../../knowledge-object";
import type { Reasoner } from "../../../reasoner";
import type { ValidationService } from "../../../validation";
import { detectConflictsForKo } from "../conflict-detection";
import {
  type SemanticPrefilter,
  detectDuplicatesForKo,
  indexKoForDuplicatePrefilter,
} from "../duplicate-detection";
import { type Guards, type SessionUser, sendError } from "../http";
import type { AssignmentNotifier } from "../notify";

function canSeeDraft(user: SessionUser, draft: Draft): boolean {
  return user.role === "admin" || draft.originalAuthor === user.id;
}

function visibleDraftsFor(user: SessionUser, drafts: Draft[]): Draft[] {
  return user.role === "admin"
    ? drafts
    : drafts.filter((draft) => draft.originalAuthor === user.id);
}

async function requireVisibleDraft(
  capture: CaptureService,
  id: string,
  user: SessionUser,
  reply: FastifyReply,
): Promise<Draft | undefined> {
  const draft = await capture.getDraft(id);
  if (!draft) {
    reply.code(404).send({ error: "NOT_FOUND", message: "Entwurf nicht gefunden." });
    return undefined;
  }
  if (!canSeeDraft(user, draft)) {
    reply.code(403).send({ error: "FORBIDDEN", message: "Entwurf nicht verfuegbar." });
    return undefined;
  }
  return draft;
}

// WP-D1c („viele Bilder BEHALTEN, nicht wegwerfen"): expliziter, dokument-tauglicher bodyLimit für die
// Draft-schreibenden Routen (POST/PUT /api/drafts) — statt des globalen 1-MiB-Fastify-Defaults (Muster
// OBJECTS_BODY_LIMIT, object-routes.ts). Beide Routen sind auth-geschützt (ko.create). Großzügig, weil
// der Dokument-Import mit VIELEN eingebetteten Bildern der Kern-Use-Case ist (technische Handbücher);
// die Bilder werden clientseitig AGGRESSIV komprimiert (files.ts) — dieser Cap ist der Deckel, NICHT das
// Ziel. Über dem Cap gibt es ein kontrolliertes 413 statt des viel zu engen 1-MiB-Defaults.
export const DRAFTS_BODY_LIMIT = 25 * 1024 * 1024; // 25 MiB

// Entwürfe (§2.4 / FR-CAP). Admin sieht den gemeinsamen Pool; normale Nutzer nur eigene Entwürfe.
// Autor bleibt erhalten; Promote → KO.
export interface CaptureRoutesDeps {
  capture: CaptureService;
  ko: KoService;
  // SCRUM-395: Prüfer-Vorschlag beim Promote (Zuweisung + Benachrichtigung wie im Board).
  validation: ValidationService;
  // Berater-Konzept 04.07. (Stufe 3): automatische Widerspruchs-Erkennung auch beim Promote (Entwurf → KO).
  conflicts: ConflictService;
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-Erkennung auch beim Promote.
  overlaps: OverlapService;
  // Pedi 04.07.: einstellbare Anzeige-Schwelle der Duplikat-Erkennung.
  overlapSettings: OverlapSettingsRepo;
  reasoner: Reasoner;
  notifyAssignment?: AssignmentNotifier;
  // Weg 3 (Feature-Flag): semantischer Vorfilter der Duplikat-Erkennung. Nur gesetzt, wenn aktiviert.
  semanticPrefilter?: SemanticPrefilter | undefined;
}

export function captureRoutes(deps: CaptureRoutesDeps, guards: Guards): FastifyPluginAsync {
  const {
    capture,
    ko,
    validation,
    conflicts,
    overlaps,
    overlapSettings,
    reasoner,
    notifyAssignment,
    semanticPrefilter,
  } = deps;

  return async (app) => {
    app.get("/api/drafts", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(visibleDraftsFor(user, await capture.listDrafts()));
    });

    app.post<{ Body: DraftPayload }>(
      "/api/drafts",
      { bodyLimit: DRAFTS_BODY_LIMIT },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(201).send(await capture.createDraft(request.body, user.id));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/drafts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const draft = await requireVisibleDraft(capture, request.params.id, user, reply);
      if (!draft) {
        return;
      }
      reply.code(200).send(draft);
    });

    app.put<{ Params: { id: string }; Body: DraftPayload }>(
      "/api/drafts/:id",
      // WP-D1c: derselbe dokument-taugliche Cap wie POST — ein bildreicher Entwurf wird auch beim
      // Weiterbearbeiten/Speichern gesendet.
      { bodyLimit: DRAFTS_BODY_LIMIT },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
            return;
          }
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
        if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
          return;
        }
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
          if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
            return;
          }
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
          // Berater-Konzept 04.07. (Stufe 3): Widerspruchs-Erkennung auch für den promoteten Entwurf.
          await detectConflictsForKo(created.id, { ko, conflicts, reasoner });
          // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-Erkennung auch beim Promote.
          await detectDuplicatesForKo(created.id, {
            ko,
            overlaps,
            reasoner,
            settings: overlapSettings,
            semanticPrefilter,
          });
          reply.code(201).send(created);
          // Weg 3 (B6): Einbettung + Ablage NACH der Antwort — der Nutzer wartet nie darauf. Flag aus
          // = No-op; Fehler brechen den (bereits gesendeten) Submit nie. await nur zur deterministischen
          // Fertigstellung der Ablage, nicht zur Client-Latenz (201 ist schon raus).
          await indexKoForDuplicatePrefilter(created, semanticPrefilter);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

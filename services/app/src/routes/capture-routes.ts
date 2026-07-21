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

// WP-D1d (Pedi-Entscheid): expliziter bodyLimit für die Draft-schreibenden Routen (POST/PUT
// /api/drafts). Ceiling = 5 MiB — bewusst KLEIN (kleine Pre-Auth-Parser-Fläche; später erhöhbar),
// aber deutlich über dem 1-MiB-Default, damit ein Dokument-Import mit VIELEN clientseitig komprimierten
// Bildern durchgeht. Über dem Cap: kontrolliertes 413. bens ROT-Fix 3: die vergrößerte Parser-Fläche
// ist zusätzlich durch einen AUTH-Guard VOR dem Body-Parsing abgesichert (onRequest, s.
// requireAuthedBeforeParse) — ein anonymer Request wird mit 401 abgewiesen, BEVOR bis zu 5 MiB Body
// gelesen/geparst werden. 5 MiB ist ohnehin eine kleine Fläche; die Abwägung ist bewusst konservativ.
export const DRAFTS_BODY_LIMIT = 5 * 1024 * 1024; // 5 MiB

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

  // WP-D1d (bens ROT-Fix 3): AUTH VOR BODY-PARSING. Fastify parst den Body (bis DRAFTS_BODY_LIMIT) in
  // der preValidation/-Handler-Phase — VOR guards.requirePermission im Handler. Dieser onRequest-Hook
  // läuft VOR dem Parsing: ein anonymer/ungültiger Request wird sofort mit 401 abgewiesen, sodass die
  // vergrößerte Parser-Fläche nicht für eine anonyme Flut offensteht. Der Handler prüft danach zusätzlich
  // die konkrete Berechtigung (ko.create) — Defense-in-Depth.
  const requireAuthedBeforeParse = async (
    request: Parameters<Guards["requireUser"]>[0],
    reply: Parameters<Guards["requireUser"]>[1],
  ): Promise<void> => {
    // requireUser sendet bei fehlender/ungültiger Session 401. Fastify stoppt den Lifecycle dann anhand
    // reply.sent VOR dem Body-Parsing — die 5-MiB-Parser-Fläche steht anonym nicht offen.
    await guards.requireUser(request, reply);
  };

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
      { bodyLimit: DRAFTS_BODY_LIMIT, onRequest: requireAuthedBeforeParse },
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
      // WP-D1c/WP-D1d: derselbe dokument-taugliche Cap + Auth-vor-Parsing wie POST — ein bildreicher
      // Entwurf wird auch beim Weiterbearbeiten/Speichern gesendet.
      { bodyLimit: DRAFTS_BODY_LIMIT, onRequest: requireAuthedBeforeParse },
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
          // WP-RETEST7 R6: author IMMER aus einem echten Nutzer — normal der Originalautor des
          // Entwurfs (FR-CAP-07); trägt ein Altbestands-Entwurf KEINEN originalAuthor (leer),
          // wird ehrlich der EINREICHENDE Session-Nutzer gesetzt statt eines leeren author-Felds
          // (Pedis Befund: Validierungskarte ohne „von …").
          const created = await ko.create({
            ...input,
            author: input.author.trim() ? input.author : user.id,
          });
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

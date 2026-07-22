import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import type {
  ConflictInput,
  ConflictService,
  OverlapService,
  OverlapSettingsRepo,
} from "../../../conflicts";
import {
  type CreateKoInput,
  DEFAULT_UPLOAD_LIMITS,
  type KnowledgeType,
  type KoService,
  type KoStatus,
  type ReviseKoInput,
  type UploadLimitsRepo,
  normalizeUploadLimits,
} from "../../../knowledge-object";
import type { LifecycleService } from "../../../lifecycle";
import { can } from "../../../rbac";
import type { Reasoner } from "../../../reasoner";
import type { ValidationService, Verdict } from "../../../validation";
import type { AiCheckWorker } from "../ai-check-worker";
import { type SemanticPrefilter, indexKoForDuplicatePrefilter } from "../duplicate-detection";
import { type Guards, sendError } from "../http";
import type { AssignmentNotifier } from "../notify";

// Knowledge-Object-API (§2.3). Mutationen laufen über EINEN Endpunkt
// PUT /api/kos/:id, der per {action} an das passende Modul verzweigt — die
// Orchestrierung über Modulgrenzen ist Aufgabe der App (Composition-Root).
export interface KoRoutesDeps {
  ko: KoService;
  validation: ValidationService;
  conflicts: ConflictService;
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-Erkennung beim Einreichen.
  overlaps: OverlapService;
  // Pedi 04.07.: einstellbare Anzeige-Schwelle der Duplikat-Erkennung.
  overlapSettings: OverlapSettingsRepo;
  lifecycle: LifecycleService;
  // Berater-Konzept 04.07. (Stufe 3): Reasoner für die automatische Widerspruchs-Erkennung beim Einreichen.
  reasoner: Reasoner;
  notifyAssignment?: AssignmentNotifier; // FR-VAL-07
  // SCRUM-421: einstellbare Upload-Grenzen (persistiert) + Audit für Änderungen.
  uploadLimits: UploadLimitsRepo;
  audit?: AuditService;
  // Weg 3 (Feature-Flag): semantischer Vorfilter der Duplikat-Erkennung. Nur gesetzt, wenn aktiviert.
  semanticPrefilter?: SemanticPrefilter | undefined;
  // WP-SUBMIT-ASYNC (Pedis R3): In-Process-Worker der Hintergrund-KI-Prüfung. Optional (direkt
  // konstruierte Routen-Tests ohne Worker vermerken dann ehrlich KEINEN Prüf-Job).
  aiCheckWorker?: AiCheckWorker | undefined;
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
  source?: { label?: string; url?: string; excerpt?: string; provider?: string };
  sourceId?: string;
  // SCRUM-415: Vertraulichkeitsstufe setzen/ändern.
  level?: string;
}

export function koRoutes(deps: KoRoutesDeps, guards: Guards): FastifyPluginAsync {
  const {
    ko,
    validation,
    conflicts,
    overlaps,
    lifecycle,
    notifyAssignment,
    uploadLimits,
    audit,
    semanticPrefilter,
    aiCheckWorker,
  } = deps;

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

    app.get<{ Params: { id: string } }>("/api/kos/:id/versions", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await ko.versionsOf(request.params.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.get<{ Params: { id: string } }>("/api/kos/:id/evidence", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await ko.evidenceOf(request.params.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    // SCRUM-169: KO-übergreifender read-only Evidence-Index (QM/Stufe 2). Nur Metadaten,
    // defensiv limitiert; keine Object-Rohdaten, keine externen Inhalte.
    app.get<{ Querystring: { limit?: string } }>("/api/evidence", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const raw = request.query.limit;
      const limit = raw !== undefined ? Number(raw) : undefined;
      try {
        reply.code(200).send(await ko.recentEvidence(limit));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.post<{ Body: Omit<CreateKoInput, "author"> & { reviewerIds?: string[] } }>(
      "/api/kos",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          // FR-CAP-07: Autor = angemeldeter Nutzer, serverseitig gesetzt (nicht aus dem Body).
          // SCRUM-470 (ben-Review #1): Herkunfts-/Vertrauensanker (`sources`: peerValidated, externalId/
          // pageId, spaceKey, sourceVersion) dürfen NUR über den Import-Pfad gesetzt werden. Auf dem
          // öffentlichen Schreibpfad Client-`sources` verwerfen — sonst könnte jeder mit ko.create
          // gefälschte/peer-validierte Anker setzen und spätere pageId-Upserts kapern.
          // WP-SHIP8-CLOSE-3/4 (bens ROT-1): importCandidateId ebenfalls verwerfen — der
          // Kandidaten-Anker gehört AUSSCHLIESSLICH dem Import-Accept (sonst könnte ein Client
          // die Crash-Recovery eines fremden Review-Claims auf sein eigenes KO umlenken bzw.
          // den DB-Unique-Anker eines Kandidaten vorab besetzen).
          const {
            reviewerIds,
            sources: _ignoredSources,
            importCandidateId: _ignoredAnchor,
            ...input
          } = request.body;
          const created = await ko.create({ ...input, author: user.id });
          // SCRUM-395: Prüfer-Vorschlag beim Einreichen — der Autor darf für sein EIGENES,
          // frisch eingereichtes KO Prüfer benennen (dedupliziert, ohne sich selbst).
          // Läuft über validation.assign + Benachrichtigung (FR-VAL-07) wie die Board-Zuweisung.
          const reviewers = [...new Set(reviewerIds ?? [])].filter((id) => id !== user.id);
          if (reviewers.length > 0) {
            await validation.assign(created.id, reviewers, user.id);
            await notifyAssignment?.(created.id, reviewers);
          }
          // WP-SUBMIT-ASYNC (Pedis Architektur-Entscheid R3, 21.07.): die KI-Prüfung blockiert
          // das Einreichen NICHT mehr (Messung: 1:28 min). Statt der früheren synchronen
          // detect*-Aufrufe wird nur der Prüf-Job vermerkt (aiCheck pending, ein schmaler
          // Feld-Patch) und im In-Process-Worker NACH der Antwort abgearbeitet — dieselben
          // Erkennungs-Pfade, dieselben Ergebnis-Signale, nur später (Status im Board sichtbar).
          // Die 201-Antwort trägt den Vermerk ehrlich mit (aiCheck pending) — das Nachlesen
          // passiert VOR dem enqueue, damit die Antwort deterministisch den Job-Start zeigt.
          let submitted = created;
          if (aiCheckWorker) {
            await ko.markAiCheckPending(created.id);
            submitted = (await ko.get(created.id)) ?? created;
            // WP-SHIP8-CLOSE-2 (bens F3): die Zielversion des frisch gesetzten pending-Vermerks
            // reist SYNCHRON mit dem Job — die Overflow-Eviction schließt hart versionsgebunden ab.
            aiCheckWorker.enqueue(created.id, submitted.aiCheck?.koVersion);
          }
          reply.code(201).send(submitted);
          // Weg 3 (B6): Einbettung + Ablage NACH der Antwort — der Nutzer wartet nie darauf. Flag aus
          // = No-op; Fehler brechen den (bereits gesendeten) Submit nie. await nur zur deterministischen
          // Fertigstellung der Ablage, nicht zur Client-Latenz (201 ist schon raus).
          await indexKoForDuplicatePrefilter(created, semanticPrefilter);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // WP-SUBMIT-ASYNC (Teil 3, Retry): reiht einen FEHLGESCHLAGENEN (oder festhängenden pending-)
    // Prüf-Job neu ein. Recht ko.validate — der Knopf lebt auf den Validierungs-Karten der Prüfer.
    // done/ohne Feld ist nicht wiederholbar (ehrlicher 409 statt stillem Doppel-Lauf).
    app.post<{ Params: { id: string } }>("/api/kos/:id/ai-check", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      try {
        const subject = await ko.get(request.params.id);
        if (!subject) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
          return;
        }
        if (!aiCheckWorker) {
          reply.code(503).send({
            error: "AI_CHECK_UNAVAILABLE",
            message: "Die Hintergrund-Pruefung ist auf diesem Server nicht verdrahtet.",
          });
          return;
        }
        const status = subject.aiCheck?.status;
        if (status !== "failed" && status !== "pending") {
          reply.code(409).send({
            error: "AI_CHECK_NOT_RETRYABLE",
            message: "Fuer dieses Wissensobjekt steht kein wiederholbarer Pruef-Job an.",
          });
          return;
        }
        await ko.markAiCheckPending(request.params.id);
        // WP-SHIP8-CLOSE-2 (bens F3): Vermerk NACH dem Setzen frisch lesen — der Job trägt die
        // Zielversion synchron (subject von oben wäre der VERALTETE Vermerk vor dem Retry).
        const marked = await ko.get(request.params.id);
        aiCheckWorker.enqueue(request.params.id, marked?.aiCheck?.koVersion);
        reply.code(200).send({ status: "pending" });
      } catch (error) {
        sendError(reply, error);
      }
    });

    // SCRUM-421: Upload-Grenzen — lesen dürfen alle Leseberechtigten (Anzeige beim Erfassen),
    // ändern nur die Nutzerverwaltung (Admin). Änderung landet im Audit-Log.
    app.get("/api/upload-limits", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send((await uploadLimits.get()) ?? DEFAULT_UPLOAD_LIMITS);
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.put<{ Body: { maxAttachments?: number; maxAttachmentBytes?: number } }>(
      "/api/upload-limits",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const limits = normalizeUploadLimits(request.body);
          await uploadLimits.set(limits);
          await audit?.record({
            actor: user.id,
            action: "upload.limits.set",
            target: "settings",
            // Inline-Literal (Record<string, unknown>) — ein benannter Typ ohne Index-Signatur
            // ist nicht direkt zuweisbar (TS2322).
            payload: {
              maxAttachments: limits.maxAttachments,
              maxAttachmentBytes: limits.maxAttachmentBytes,
            },
          });
          reply.code(200).send(limits);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // SCRUM-422: Papierkorb — nur Admin (users.manage). Liste ist rein metadatenbasiert;
    // Wiederherstellen und sofortige Endlöschung sind bewusste Admin-Entscheidungen.
    app.get("/api/kos/trash", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await ko.trashed());
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.post<{ Params: { id: string } }>("/api/kos/:id/restore", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await ko.restore(request.params.id, user.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.delete<{ Params: { id: string } }>("/api/kos/trash/:id", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        // SCRUM-523 P.3 (WP2): die HARTE Endlöschung läuft über den zentralen purgeKo-Vertrag im
        // KoService — er schließt offene Konflikte/Überschneidungen geordnet (kein Geist) und entfernt
        // den Embedding-Vektor (GDPR Art. 17, Kaskadenlöschung) über den verdrahteten Aufräum-Hook.
        // Kein separater Cleanup-Aufruf mehr hier: exakt EINE Löschmechanik, kein Bypass.
        await ko.purgeTrashed(request.params.id, user.id);
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    // FR-RBAC-02 + Pedi 02.07.: Löschen dürfen Controller/Admin (ko.validate) ODER der
    // AUTOR seines eigenen Wissensobjekts. Ehrlich: Löschung landet im Audit (ko.deleted).
    // SCRUM-422: Löschen heißt jetzt Papierkorb (Demo-Daten weiterhin endgültig).
    app.delete<{ Params: { id: string } }>("/api/kos/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const target = await ko.get(request.params.id);
      if (!target) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
        return;
      }
      const mayDelete = can(user.role, "ko.validate") || target.author === user.id;
      if (!mayDelete) {
        reply.code(403).send({
          error: "FORBIDDEN",
          message: "Löschen dürfen nur Autor, Controller oder Admin.",
        });
        return;
      }
      try {
        await ko.delete(request.params.id, user.id);
        // Konzept 04.07. (Stufe 1): offene Konflikte dieses KO geordnet beenden (kein Geist).
        await conflicts.onKoRemoved(request.params.id, user.id);
        // Pedi 04.07.: dasselbe für offene Überschneidungen (kein Duplikat-Geist nach Löschen).
        await overlaps.onKoRemoved(request.params.id, user.id);
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
          // Pedi 05.07.: Admin-Override „als wahr kennzeichnen" — schließt die Validierung komplett
          // ab. Bewusst nur Admin (users.manage), nicht schon ko.validate (Controller/Experte).
          case "admin-validate": {
            const user = await guards.requirePermission("users.manage", request, reply);
            if (!user) {
              return;
            }
            reply.code(200).send(await validation.adminValidate(id, user.id));
            return;
          }
          case "revise": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            // SCRUM-470 (ben-Review #1): Client-`sources` auch beim Revise verwerfen — Anker bleiben
            // dem Import-Pfad vorbehalten. Ohne `sources` in den Changes bleiben die bestehenden erhalten.
            const { sources: _ignoredSources, ...changes } = body.changes ?? {};
            reply.code(200).send(await ko.revise(id, changes, user.id));
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
            // SCRUM-421: geltende Upload-Grenzen aus der Admin-Einstellung (sonst Werksvorgabe).
            const limits = (await uploadLimits.get()) ?? DEFAULT_UPLOAD_LIMITS;
            if ((current?.attachments?.length ?? 0) >= limits.maxAttachments) {
              return badRequest(`Maximal ${limits.maxAttachments} Anhänge je Objekt.`);
            }
            if (att.objectId) {
              // SCRUM-121: Original liegt im Object-Store; am KO nur Referenz + kleine Vorschau.
              if (att.thumbnail && att.thumbnail.length > limits.maxAttachmentBytes) {
                return badRequest("Vorschau zu groß (Upload-Grenze überschritten).");
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
            if (att.dataUrl.length > limits.maxAttachmentBytes) {
              return badRequest("Anhang zu groß (Upload-Grenze überschritten).");
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
                provider: body.source.provider ?? null,
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
          // SCRUM-415/509: Vertraulichkeitsstufe setzen/ändern. Basisrecht ko.create (wie Bearbeiten).
          case "confidentiality": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            // SCRUM-509 R2: die Prüfung (ungültige Stufe → 400) UND die Downgrade-Autorisierung laufen
            // ATOMAR in der Datenschicht (setConfidentiality, per-KO serialisiert) — kein TOCTOU
            // zwischen Rollenprüfung und Änderung. Die Route reicht nur die Downgrade-Berechtigung
            // (ko.validate = Prüfer/Admin) durch; Fehler werden zu 400/403/404 gemappt (sendError).
            try {
              const updated = await ko.setConfidentiality(id, body.level, user.id, {
                mayDowngrade: can(user.role, "ko.validate"),
              });
              reply.code(200).send(updated);
            } catch (error) {
              sendError(reply, error);
            }
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
            const created = await conflicts.create(body.conflict, user.id);
            // SCRUM-358 / AG-14-SERVER-TRUST: ein offener WAHRHEITSKONFLIKT holt betroffene VALIDIERTE
            // Bezugs-KOs serverseitig zurück in Review (Status validiert→offen, Trust konservativ
            // gesenkt). markTruthConflictReview ist idempotent/No-op für offene/fehlende KOs.
            if (created.type === "truth") {
              await ko.markTruthConflictReview(created.koA, user.id);
              await ko.markTruthConflictReview(created.koB, user.id);
            }
            reply.code(201).send(created);
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

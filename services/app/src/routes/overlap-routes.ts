import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import {
  DEFAULT_OVERLAP_SETTINGS,
  type OverlapService,
  type OverlapSettingsRepo,
  normalizeOverlapSettings,
} from "../../../conflicts";
import { type Guards, sendError } from "../http";

// Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-API (/api/duplicates). Liste +
// Detail lesen alle Leseberechtigten; die menschlichen Abschlüsse (Fehlalarm / getrennt lassen /
// verwandt verlinken) sind kuratorische Entscheidungen (ko.validate). Bewusst schlank: kein
// Eskalieren/Zweitmeinung — es geht um Redaktion, nicht um Wahrheit. Merge folgt in D5.
// Pedi 04.07.: zusätzlich die einstellbare Anzeige-Schwelle (lesen: alle; setzen: Admin).
export interface OverlapRoutesDeps {
  overlaps: OverlapService;
  settings: OverlapSettingsRepo;
  audit?: AuditService;
}

export function overlapRoutes(deps: OverlapRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { overlaps, settings, audit } = deps;
  return async (app) => {
    app.get("/api/duplicates", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // SCRUM-496: DB-/Serverfehler NICHT roh durchreichen (das Board zeigte sonst die nackte
      // Postgres-Meldung). sendError generalisiert Infrastruktur-Fehler zu einem sauberen 500.
      try {
        reply.code(200).send(await overlaps.unresolved());
      } catch (error) {
        sendError(reply, error);
      }
    });

    // Pedi 04.07.: Anzeige-Schwelle der Duplikat-Erkennung. Lesen dürfen alle Leseberechtigten
    // (Anzeige im Board/Admin), setzen nur die Nutzerverwaltung (Admin). Änderung landet im Audit.
    app.get("/api/duplicates/settings", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send((await settings.get()) ?? DEFAULT_OVERLAP_SETTINGS);
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.put<{ Body: { minConfidence?: number } }>(
      "/api/duplicates/settings",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const next = normalizeOverlapSettings(request.body);
          await settings.set(next);
          await audit?.record({
            actor: user.id,
            action: "overlap.settings.set",
            target: "settings",
            payload: { minConfidence: next.minConfidence },
          });
          reply.code(200).send(next);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/duplicates/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const entry = await overlaps.get(request.params.id);
        if (!entry) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Überschneidung nicht gefunden." });
          return;
        }
        reply.code(200).send(entry);
      } catch (error) {
        sendError(reply, error);
      }
    });

    // „Fehlalarm — kein Duplikat" schließt einen (meist automatisch erkannten) Eintrag bewusst als
    // falsch-positiv. Menschlicher Entscheider (⚑).
    app.post<{ Params: { id: string }; Body: { note?: string } | null }>(
      "/api/duplicates/:id/dismiss",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await overlaps.dismiss(request.params.id, user.id, request.body?.note));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // „Getrennt lassen" — bewusste Entscheidung, beide Beiträge nebeneinander zu behalten.
    app.post<{ Params: { id: string }; Body: { note?: string } | null }>(
      "/api/duplicates/:id/keep-separate",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await overlaps.keepSeparate(request.params.id, user.id, request.body?.note));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // „Als verwandt verlinken" — kein Duplikat, aber sachlich verbunden.
    app.post<{ Params: { id: string }; Body: { note?: string } | null }>(
      "/api/duplicates/:id/link-related",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await overlaps.linkRelated(request.params.id, user.id, request.body?.note));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

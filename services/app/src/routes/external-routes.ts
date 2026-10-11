import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import {
  DEFAULT_EXTERNAL_KNOWLEDGE_STAGE,
  type ExternalKnowledgePolicyRepo,
  type ExternalSearchService,
  externalSearchAllowed,
  normalizeExternalKnowledgeStage,
  stelleAbrufbelegAus,
} from "../../../external-search";
import { type Guards, sendError } from "../http";

// SCRUM-118 / FR-EXT-02: optionaler Server-Proxy für externe Quellensuche.
// SCRUM-414: Admin-Regler „externe Wissensabfrage" (4 Stufen, persistiert) — die Policy
// existiert IMMER (unabhängig davon, ob der Suchproxy konfiguriert ist) und ist zugleich
// die Freigabe für die Public-KI-Anreicherung (SCRUM-426).
export interface ExternalRoutesDeps {
  search: ExternalSearchService | undefined;
  policy: ExternalKnowledgePolicyRepo;
  audit?: AuditService;
}

export function externalRoutes(deps: ExternalRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { search, policy, audit } = deps;

  return async (app) => {
    // Lesen: alle Leseberechtigten (Erfassen/Prüfen zeigen den Stand ehrlich an).
    app.get("/api/external/policy", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const stage = (await policy.getStage()) ?? DEFAULT_EXTERNAL_KNOWLEDGE_STAGE;
        reply.code(200).send({ stage });
      } catch (error) {
        sendError(reply, error);
      }
    });

    // Setzen: nur Nutzerverwaltung (Admin). Änderung landet im Audit-Log.
    app.put<{ Body: { stage?: string } }>("/api/external/policy", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        const stage = normalizeExternalKnowledgeStage(request.body?.stage);
        await policy.setStage(stage);
        await audit?.record({
          actor: user.id,
          action: "external.policy.set",
          target: "settings",
          payload: { stage },
        });
        reply.code(200).send({ stage });
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.get<{ Querystring: { q?: string } }>("/api/external/search", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // SCRUM-414: Serverseitiges Gate — bei „blocked" ist die externe Suche gesperrt
      // (nicht nur in der UI ausgeblendet). Ehrliche Rückmeldung.
      const stage = (await policy.getStage()) ?? DEFAULT_EXTERNAL_KNOWLEDGE_STAGE;
      if (!externalSearchAllowed(stage)) {
        reply.code(403).send({
          error: "EXTERNAL_SEARCH_BLOCKED",
          message: "Die externe Wissensabfrage ist vom Administrator gesperrt.",
        });
        return;
      }
      if (!search) {
        reply
          .code(501)
          .send({ error: "EXTERNAL_SEARCH_DISABLED", message: "Externe Suche ist nicht aktiv." });
        return;
      }
      try {
        const treffer = await search.search(request.query.q ?? "");
        // REF-01 (Ben nacharbeit-7 K2): der Abruf ist HIER geschehen — der Server hält ihn je
        // Treffer fest (Adresse, abgerufener Inhalt, Zeitpunkt) und signiert ihn. Wer den Treffer
        // anhängt, legt den Beleg vor; nur dann trägt die Belegstelle eine Abrufzeit.
        const abgerufenAm = new Date().toISOString();
        reply.code(200).send(
          treffer.map((t) => ({
            ...t,
            abgerufenAm,
            abrufbeleg: stelleAbrufbelegAus({ url: t.url, inhalt: t.snippet, abgerufenAm }),
          })),
        );
      } catch (error) {
        // JOB 2683 D1 (Review R2-36): nach außen geht über `sendError` nur die generische `message`
        // des Providers. R-0623 (Ben, Nacharbeit 1): ins Log geht nicht mehr der freie Netzfehlertext
        // (`detail`: Host, DNS), sondern der Fehler über den Erlaubnislisten-Serializer — Typ, Code
        // und Quelltextstelle, request-gebunden über die Request-Id.
        request.log.warn({ err: error }, "external-search: Anfrage an den Anbieter fehlgeschlagen");
        sendError(reply, error);
      }
    });
  };
}

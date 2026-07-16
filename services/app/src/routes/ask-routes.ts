import type { FastifyPluginAsync } from "fastify";
import { type AskService, isGapPriority } from "../../../ask";
import { authorizesAsk } from "../addon-principal";
import { addonRateLimit } from "../addon-rate-limit";
import { type Guards, type SessionUser, sendError } from "../http";

// SCRUM-498 B1: Body-Schema + engeres bodyLimit für POST /api/ask. Reines Härten — NO-OP für jeden
// heute-gültigen Request: question bleibt required string, kurze Fragen bleiben zulässig (minLength 1,
// KEINE 40er-Mindestlänge wie check-text), Obergrenze konsistent mit check-text (8.000 Zeichen).
// additionalProperties bleibt UNGESETZT (= true, wie das check-text-Schema) → nichts wird neu verboten,
// was ein Client heute mitschickt. Fehlender/malformer/oversized Body → kontrolliertes 400 (kein 500).
const askBodySchema = {
  type: "object",
  required: ["question"],
  properties: {
    question: { type: "string", minLength: 1, maxLength: 8_000 },
    locale: { type: "string" },
  },
} as const;

// Engeres Route-bodyLimit (statt global 1 MiB): komfortabel über dem größten gültigen Body
// (8.000 Zeichen UTF-8 worst case ~32 KiB + JSON-Envelope), aber weit darunter. Überschreitung → 413.
const ASK_BODY_LIMIT = 64 * 1024; // 64 KiB

// Request-lokal getragener Session-User (analog authContext): in preValidation aufgelöst, im Handler
// nur gelesen — kein zweiter Guard-Aufruf.
declare module "fastify" {
  interface FastifyRequest {
    askSessionUser?: SessionUser | null;
  }
}

// Fragen & Wissenslücken (§2.4 / FR-ASK).
export function askRoutes(ask: AskService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.decorateRequest("askSessionUser", null);
    app.post<{ Body: { question: string; locale?: string } }>(
      "/api/ask",
      {
        // SCRUM-490 D3: Drossel NUR für den addon-Pfad. Bei Flag AUS ist das @fastify/rate-limit-Plugin
        // nicht registriert → diese config.rateLimit ist inert (Fastify ignoriert unbekannte route-config)
        // → /api/ask exakt wie heute. Bei Flag AN drosselt sie nur den Add-on-Principal (allowList
        // exempt-iert Session-Requests der Live-App), gekeyt auf den stabilen addon-Actor.
        config: { rateLimit: addonRateLimit() },
        bodyLimit: ASK_BODY_LIMIT,
        schema: { body: askBodySchema },
        // SCRUM-498 B1: Auth VOR der Body-Validierung (wie check-text). Der Add-on-Pfad ist bereits im
        // onRequest-Hook autorisiert (401/403 vor der validation-Phase); den Session-Pfad prüfen wir
        // hier in preValidation, damit ein anonymer Request 401 bekommt, BEVOR die Schema-400 greift
        // (kein Reihenfolge-Oracle). Der aufgelöste User wird request-lokal für den Handler getragen.
        preValidation: async (request, reply) => {
          const auth = request.authContext;
          if (auth?.authKind === "addon") {
            // Defense-in-Depth (ben-Review): nur ein Principal mit Capability ask.validated erreicht den
            // Ask-Pfad; sonst fail-closed (403).
            if (!authorizesAsk(auth.principal)) {
              reply
                .code(403)
                .send({ error: "FORBIDDEN", message: "Add-in-Capability unzureichend." });
              return reply;
            }
            return;
          }
          // Live-App unverändert: Session-Guard mit ko.read — jetzt vor der Body-Validierung.
          const user = await guards.requirePermission("ko.read", request, reply);
          if (!user) {
            return reply;
          }
          request.askSessionUser = user;
        },
      },
      async (request, reply) => {
        // Body ist schema-validiert: question ist ein nicht-leerer String ≤ 8.000 Zeichen; Auth ist in
        // preValidation erledigt. FR-I18N-01: UI-Sprache an den Reasoner; ungültig → "de".
        const locale: "de" | "en" = request.body.locale === "en" ? "en" : "de";
        const auth = request.authContext;
        if (auth?.authKind === "addon") {
          // SCRUM-490 D1/D2: validated-only + count_only für den Nur-Lese-Add-on-Key (unverändert).
          reply.code(200).send(
            await ask.ask(request.body.question, auth.principal.id, locale, {
              validatedOnly: true,
              gapPolicy: "count_only",
            }),
          );
          return;
        }
        // Session: in preValidation autorisiert, User request-lokal getragen.
        const user = request.askSessionUser;
        if (!user) {
          // Defense-in-Depth: erreichbar nur, wenn preValidation nichts gesetzt hätte (soll nie sein).
          reply.code(401).send({ error: "UNAUTHENTICATED", message: "Session erforderlich." });
          return;
        }
        reply.code(200).send(await ask.ask(request.body.question, user.id, locale));
      },
    );

    // FR-ASK-04: „Hat geholfen" — Bewährung durch Nutzung.
    app.post<{ Body: { koId: string } }>("/api/ask/helpful", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        await ask.markHelpful(request.body.koId, user.id);
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.get("/api/gaps", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await ask.listGaps());
    });

    app.put<{
      Params: { id: string };
      Body: { expertId?: string; close?: boolean; action?: string; priority?: string };
    }>("/api/gaps/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.assign", request, reply);
      if (!user) {
        return;
      }
      try {
        // SCRUM-115: Priorität setzen.
        if (request.body.priority !== undefined) {
          if (!isGapPriority(request.body.priority)) {
            reply.code(400).send({ error: "BAD_REQUEST", message: "Ungültige Priorität." });
            return;
          }
          reply.code(200).send(await ask.setGapPriority(request.params.id, request.body.priority));
          return;
        }
        // Close akzeptiert sowohl { close:true } als auch { action:"close" } (FE-Kopplung).
        if (request.body.close === true || request.body.action === "close") {
          reply.code(200).send(await ask.closeGap(request.params.id));
          return;
        }
        if (request.body.expertId) {
          reply.code(200).send(await ask.assignGap(request.params.id, request.body.expertId));
          return;
        }
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: "expertId, close oder priority erforderlich." });
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.delete<{ Params: { id: string }; Querystring: { confirm?: string } }>(
      "/api/gaps/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          await ask.deleteGap(request.params.id, request.query.confirm === "true");
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

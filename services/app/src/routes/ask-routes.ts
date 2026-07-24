import type { FastifyPluginAsync } from "fastify";
import { type AskService, isGapPriority, redactGapForViewer } from "../../../ask";
import { can } from "../../../rbac";
import { authorizesAsk } from "../addon-principal";
import { addonRateLimit } from "../addon-rate-limit";
import { type Guards, type SessionUser, sendError } from "../http";

// SCRUM-498 B1 (ben-Review): bewusste Eingabe-Härtung von POST /api/ask, definiert über die GÜLTIGE
// HÜLLE eines Requests:
//   - Body MUSS ein JSON-Objekt sein.
//   - question: optional; wenn vorhanden string, ≤ 8.000 Codepoints (ajv zählt Codepoints). Fehlt/leer/
//     null → Handler normalisiert auf "" → 200 (wie Parent e6abb25).
//   - locale: optional; string oder skalar-coercierbar; der Handler normalisiert auf de/en.
//   - additionalProperties erlaubt.
//   - Gesamt-Body ≤ 128 KiB (sonst 413).
// Alles AUSSERHALB dieser Hülle → kontrolliertes 400 (413 bei Größe), nie 500. Gegenüber dem Parent
// bewusst gehärtet: nicht-objektförmiger Body, question > 8.000, locale nicht-coercierbar, Body > 128 KiB,
// fehlender Body (Crash-Fix). Kein legitimer Klara-Traffic ist davon betroffen.
const askBodySchema = {
  type: "object",
  properties: {
    question: { type: "string", maxLength: 8_000 },
    locale: { type: "string" },
    // WP-KLARA-ASK-FIX (bens Fix 1, P0): optionaler, SERVER-garantierter Modus. "retrieval-only"
    // erzwingt serverseitig: NUR validierte KOs als Grundlage, NULL Modell- und NULL Embedder-
    // Aufrufe (rein deterministisches Retrieval, Antwort = woertliche validierte Aussage +
    // Quellen, keine Synthese). Anderer Wert → Schema-400. Ohne Feld: Konsolen-Bestandsverhalten.
    mode: { type: "string", enum: ["retrieval-only"] },
  },
} as const;

// Route-bodyLimit (bewusster milder Cap, runter von global 1 MiB): deckt eine escaped 8.000-Codepoint-
// Frage (roh bis ~96 KiB) plus Envelope/locale/moderate Extras. Bodies über 128 KiB liegen außerhalb der
// gültigen Hülle → kontrolliertes 413.
const ASK_BODY_LIMIT = 128 * 1024; // 128 KiB

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
    app.post<{ Body: { question?: string; locale?: string; mode?: string } }>(
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
        // Der fehlende Body ist bereits durch das Schema (type:object) mit 400 abgefangen; ab hier ist
        // request.body ein Objekt. question kann fehlen/leer sein → wie im Parent auf "" normalisieren
        // (kein neuer 500). FR-I18N-01: UI-Sprache an den Reasoner; ungültig → "de".
        const question = request.body.question ?? "";
        const locale: "de" | "en" = request.body.locale === "en" ? "en" : "de";
        const auth = request.authContext;
        if (auth?.authKind === "addon") {
          // SCRUM-490 D1/D2: validated-only + count_only für den Nur-Lese-Add-on-Key. R2 (B1):
          // retrievalOnly → der vertrauliche Dokumenttext wird NIE ans Modell/den Embedder gegeben; die
          // Antwort ist rein Retrieval gegen validierte, nicht-vertrauliche KOs (kein Egress).
          reply.code(200).send(
            await ask.ask(question, auth.principal.id, locale, {
              validatedOnly: true,
              gapPolicy: "count_only",
              retrievalOnly: true,
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
        // WP-KLARA-ASK-FIX (bens Fix 1, P0-Kern): "retrieval-only" — der Modus des Word-Add-ins
        // (markierter DOKUMENTTEXT ist potenziell vertraulich und darf NIE zur Cloud). Bewusst ein
        // Request-Flag statt eines eigenen Endpunkts: Auth, Body-Schema, Rate-Limits und der
        // Add-on-Zweig dieser Route bleiben EINE Quelle der Wahrheit — server-erzwungen ist die
        // SEMANTIK des Modus: ask.ask mit validatedOnly (nur validierte KOs als Grundlage) +
        // retrievalOnly (answerRetrievalOnly = deterministischer Pfad; kein Modell-, kein
        // Embedder-Aufruf erreichbar — exakt der seit SCRUM-490 R2 bestehende Add-on-Vertrag).
        // Die Antwort ist die WOERTLICHE validierte Aussage + Quellen, keine Synthese. Die
        // Wissensluecke wird weiter vermerkt (Session-Nutzer, bestehende gap-Semantik) — darauf
        // baut der Offene-Frage-Weg des Panels. Konsole ohne mode: byte-identisches Verhalten.
        if (request.body.mode === "retrieval-only") {
          reply.code(200).send(
            await ask.ask(question, user.id, locale, {
              validatedOnly: true,
              retrievalOnly: true,
            }),
          );
          return;
        }
        reply.code(200).send(await ask.ask(question, user.id, locale));
      },
    );

    // FR-ASK-04: „Hat geholfen" — Bewährung durch Nutzung.
    // FUNKE-FIX P0 (bens ROT-1): Das „Danke" verlangt den opaken Answer-Receipt aus dem echten
    // Antwortvorgang (POST /api/ask liefert ihn). Der Server verifiziert damit, dass GENAU dieses KO
    // diesem Nutzer als Quelle ausgeliefert wurde — eine frei gewählte/unbelegte KO-ID ⇒ 403. Die
    // Genau-einmal-Garantie (recordOnce-CAS) und der atomare Trust-Bump liegen im Service.
    app.post<{ Body: { koId: string; receipt?: string } }>(
      "/api/ask/helpful",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          await ask.markHelpful(request.body.receipt ?? "", request.body.koId, user.id);
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // FUNKE-FIX2 P0 (bens Erforderlich 1): rein aggregierte Zähler — KEIN Fragetext. Die Startseite
    // nutzt AUSSCHLIESSLICH diesen Endpunkt (kein Volltext-Fetch der Lücken mehr auf /start).
    app.get("/api/gaps/summary", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await ask.gapsSummary());
    });

    // FUNKE-FIX2 P0 (bens Erforderlich 2): Detail-Endpunkt liefert den Fragetext ADRESSATENGERECHT.
    // Volltext sehen nur der Ersteller/Owner, ein Assignee ODER eine Rolle mit ausdrücklicher Detail-
    // Berechtigung (ko.validate-Ebene, d. h. Controller/Admin — die Lücken ohnehin kuratieren). Alle
    // anderen erhalten eine REDIGIERTE Sicht (Kategorie/Neutralbezeichnung, Zähler, KEIN Fragetext).
    // Fail-closed: im Zweifel redigiert (redactGapForViewer entscheidet zentral).
    app.get("/api/gaps", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const maySeeDetail = can(user.role, "ko.validate");
      const gaps = await ask.listGaps();
      reply
        .code(200)
        .send(gaps.map((gap) => redactGapForViewer(gap, { viewerId: user.id, maySeeDetail })));
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

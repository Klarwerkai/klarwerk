import type { FastifyPluginAsync } from "fastify";
import type { OverlapService } from "../../../conflicts";
import type { KoService } from "../../../knowledge-object";
import { authorizesCheckText } from "../addon-principal";
import { addonRateLimit } from "../addon-rate-limit";
import { type CheckTextResult, checkText } from "../check-text-detection";
import type { Guards } from "../http";

// SCRUM-491 Slice 5: POST /api/check-text v1 = Stufe 1 (deterministisch). Prüft freien Text im
// Dry-Run gegen den VALIDIERTEN Bestand — KEIN Modell, KEIN embed, kein Textabfluss (Slice-4-Garantie
// ohne Judge), KEINE Persistenz (kein KO/Gap/Board/Inhalts-Audit). Nur registriert bei Flag AN
// (build-app.ts) → Flag AUS = Endpunkt existiert nicht = bit-identisch. want:"deep" (Stufe 2, Modell)
// kommt in Slice 6; hier wird es explizit als „noch nicht" mit 400 abgelehnt, statt still Stufe 1 zu
// liefern (kein Vortäuschen einer tieferen Prüfung).
const MIN_TEXT = 40;
const MAX_TEXT = 8_000;

export interface CheckTextRouteDeps {
  ko: KoService;
  overlaps: OverlapService;
}

// Ergebnis-Form → Response-Vertrag. snippet OPTIONAL (der Kern erzeugt heute keinen Beleg-Snippet →
// Feld nur führen, wenn vorhanden; NICHT fabrizieren). confidence/rationale sind für den
// deterministischen Pfad regulär leer → als null geführt (stabile Form, kein erfundener Wert).
function toResponse(result: CheckTextResult) {
  return {
    duplicates: result.duplicates.map((d) => ({
      koId: d.koId,
      koTitle: d.koTitle,
      relation: d.relation,
      confidence: d.confidence ?? null,
      method: d.method,
      rationale: d.rationale ?? null,
      ...(d.snippet !== undefined ? { snippet: d.snippet } : {}),
    })),
    // v1: Konflikt-Erkennung kommt später (modellgetrieben) → hier bewusst leer.
    conflicts: [],
    answer: null,
    persisted: false,
  };
}

export function checkTextRoutes(deps: CheckTextRouteDeps, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.post<{
      Body: { text?: string; title?: string; locale?: "de" | "en"; want?: string };
    }>(
      "/api/check-text",
      // Dieselbe Drossel-Config wie /api/ask (Slice 1): greift nur, wenn @fastify/rate-limit registriert
      // ist (Flag AN), und dort nur auf Add-on-Principal-Requests — Session-Requests bleibt exempt.
      { config: { rateLimit: addonRateLimit() } },
      async (request, reply) => {
        const text = typeof request.body.text === "string" ? request.body.text : "";
        if (text.length < MIN_TEXT || text.length > MAX_TEXT) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: `text muss ${MIN_TEXT}–${MAX_TEXT} Zeichen haben.`,
          });
          return;
        }
        // Stufe 2 (Modell) ist Slice 6. Bis dahin ehrlich „noch nicht" statt still Stufe 1 zu liefern.
        if (request.body.want === "deep") {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "want='deep' (Stufe 2) ist noch nicht verfügbar.",
          });
          return;
        }
        const locale = request.body.locale === "en" ? "en" : "de";

        // Auth: Add-on-Principal (checktext.validated) ODER Session (ko.read). Der ungültige/fremde-
        // Route-/Capability-Fall ist bereits im onRequest-Hook mit 401/403 behandelt; hier zusätzlich
        // Defense-in-Depth für den Add-on-Pfad.
        const auth = request.authContext;
        if (auth?.authKind === "addon") {
          if (!authorizesCheckText(auth.principal)) {
            reply
              .code(403)
              .send({ error: "FORBIDDEN", message: "Add-in-Capability unzureichend." });
            return;
          }
        } else {
          const user = await guards.requirePermission("ko.read", request, reply);
          if (!user) {
            return;
          }
        }

        // Dry-Run-Kern OHNE Judge/Prefilter → rein deterministisch (kein Modell, kein embed,
        // validated-only, topK gedeckelt). Kein Insert, keine Gap, kein Board, kein Inhalts-Audit.
        const result = await checkText(
          {
            text,
            locale,
            ...(request.body.title !== undefined ? { title: request.body.title } : {}),
          },
          { ko: deps.ko, overlaps: deps.overlaps },
        );
        reply.code(200).send(toResponse(result));
      },
    );
  };
}

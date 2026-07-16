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

// ben-Review-Fix: Body-Schema als EINZIGE Quelle der Eingabe-Validierung. Fehlender/null/malformer
// Body oder text außerhalb 40–8.000 → Fastify liefert einen kontrollierten 400 in der validation-Phase
// (kein Handler-Zugriff auf undefined, KEINE interne TypeError/500 nach außen). want bleibt bewusst ein
// freier String (kein enum), damit "deep" das Schema passiert und im Handler die klare „noch nicht"-
// Meldung erzeugt; locale bleibt permissiv (Handler normalisiert auf de/en).
const bodySchema = {
  type: "object",
  required: ["text"],
  properties: {
    text: { type: "string", minLength: MIN_TEXT, maxLength: MAX_TEXT },
    title: { type: "string" },
    locale: { type: "string" },
    want: { type: "string" },
  },
} as const;

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
    app.post<{ Body: { text: string; title?: string; locale?: string; want?: string } }>(
      "/api/check-text",
      {
        // Dieselbe Drossel-Config wie /api/ask (Slice 1): greift nur, wenn @fastify/rate-limit
        // registriert ist (Flag AN), und dort nur auf Add-on-Principal-Requests — Session exempt.
        config: { rateLimit: addonRateLimit() },
        schema: { body: bodySchema },
        // Fix 2 (ben-Review): Auth VOR der Body-Validierung. Fastify-Lifecycle:
        // onRequest → preParsing → preValidation → validation → preHandler. Der Add-on-Pfad ist bereits
        // im onRequest-Hook autorisiert (401/403 laufen VOR der validation-Phase); den Session-Pfad
        // prüfen wir hier in preValidation, damit ein anonymer Request 401 bekommt, BEVOR die
        // Schema-Validierung 400 liefert (Reihenfolge-Oracle entschärft).
        preValidation: async (request, reply) => {
          const auth = request.authContext;
          if (auth?.authKind === "addon") {
            // Defense-in-Depth: der onRequest-Hook hat checktext.validated bereits erzwungen.
            if (!authorizesCheckText(auth.principal)) {
              reply
                .code(403)
                .send({ error: "FORBIDDEN", message: "Add-in-Capability unzureichend." });
              return reply;
            }
            return;
          }
          // Session-Pfad: ko.read wie die übrigen Lese-Routen — jetzt vor der Body-Validierung.
          const user = await guards.requirePermission("ko.read", request, reply);
          if (!user) {
            return reply;
          }
        },
      },
      async (request, reply) => {
        // Body ist schema-validiert: text ist ein String mit 40–8.000 Zeichen; Auth ist in
        // preValidation bereits erledigt. Stufe 2 (Modell) ist Slice 6 → want:"deep" ehrlich 400.
        if (request.body.want === "deep") {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "want='deep' (Stufe 2) ist noch nicht verfügbar.",
          });
          return;
        }
        const locale = request.body.locale === "en" ? "en" : "de";
        // Dry-Run-Kern OHNE Judge/Prefilter → rein deterministisch (kein Modell, kein embed,
        // validated-only, topK gedeckelt). Kein Insert, keine Gap, kein Board, kein Inhalts-Audit.
        const result = await checkText(
          {
            text: request.body.text,
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

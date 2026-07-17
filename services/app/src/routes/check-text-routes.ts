import type { FastifyPluginAsync } from "fastify";
import type { OverlapService } from "../../../conflicts";
import type { Confidentiality, KoService } from "../../../knowledge-object";
import type { Reasoner } from "../../../reasoner";
import { authorizesCheckText } from "../addon-principal";
import { addonRateLimit } from "../addon-rate-limit";
import { type CheckTextResult, checkText } from "../check-text-detection";
import type { SemanticPrefilter } from "../duplicate-detection";
import type { Guards } from "../http";
import { classifyProvenanceConfidential } from "./reasoner-routes";

// SCRUM-491 Slice 5/6: POST /api/check-text gegen den VALIDIERTEN Bestand, KEINE Persistenz
// (kein KO/Gap/Board/Inhalts-Audit — Dry-Run-Kern-Garantie). Nur registriert bei Flag AN (build-app.ts)
// → Flag AUS = Endpunkt existiert nicht = bit-identisch.
//   Stufe 1 (want fehlend / != "deep"): rein deterministisch — KEIN Modell, KEIN embed, kein
//     Textabfluss (Slice-4-Garantie ohne Judge). Byte-identisch zu Slice 5.
//   Stufe 2 (SCRUM-491 D4, want:"deep"): der 92%/26%-Moment auf Knopfdruck — DERSELBE checkText-Kern,
//     aber MIT duplicateJudge (reasoner.judgeDuplicate) + Semantic-Prefilter. Das ist bewusster
//     Textabfluss (Modell + Embedder) — die DSGVO-Grenze aus D4: NUR bei want:"deep", nie automatisch.
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
    // SCRUM-502 Schicht 2 (Round 3): Herkunft des GEPRÜFTEN Textes (fail-safe). Optional im Schema,
    // damit Alt-Clients (z. B. das Add-in) NICHT 400 bekommen — fehlt/ungültig → im Handler
    // vertraulich → deterministisch-only (kein Embedder/Cloud-Judge), nie unbemerkter Cloud-Egress.
    source: { type: "string" },
    koId: { type: "string" },
    confidentiality: { type: "string" },
  },
} as const;

export interface CheckTextRouteDeps {
  ko: KoService;
  overlaps: OverlapService;
  // Stufe 2 (want:"deep"): Modell-Urteil + semantischer Vorfilter. Der Prefilter ist env-gegated
  // (KLARWERK_DUP_PREFILTER); fehlt er, fällt checkText auf die gedeckelte lexikalische Kandidatenwahl
  // zurück — der Judge (Modell) läuft trotzdem. Für Stufe 1 werden beide bewusst NICHT übergeben.
  reasoner: Reasoner;
  semanticPrefilter?: SemanticPrefilter | undefined;
}

// Ergebnis-Form → Response-Vertrag. snippet OPTIONAL (der Kern erzeugt heute keinen Beleg-Snippet →
// Feld nur führen, wenn vorhanden; NICHT fabrizieren). confidence/rationale sind für den
// deterministischen Pfad regulär leer → als null geführt (stabile Form, kein erfundener Wert).
// SCRUM-502 Schicht 2 (Round 3): `note` trägt den ehrlichen Hinweis, wenn eine want:"deep"-Prüfung
// wegen vertraulichem Text auf den deterministischen Pfad zurückfällt (kein Embedder/Cloud-Judge).
function toResponse(result: CheckTextResult, note: string | null = null) {
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
    note,
    persisted: false,
  };
}

// SCRUM-502 Round 4: der GEPRÜFTE Text ist immer transient (Paste/Upload). Die Stufe kommt aus der
// aktuellen draft/transient-document-Deklaration; eine koId ist NUR ein hebender Backstop, nie ein
// Freigabe-Anker für frei gelieferten Text. Fehlt/ungültig → fail-safe vertraulich. Gleiche reine
// Regel wie der Reasoner.
async function resolveCheckedTextConfidential(
  body: { source?: string; koId?: string; confidentiality?: string },
  ko: KoService,
): Promise<boolean> {
  let backstop = { found: false } as { found: boolean; level?: Confidentiality | null };
  if (
    (body.source === "draft" || body.source === "transient-document") &&
    typeof body.koId === "string" &&
    body.koId.length > 0
  ) {
    const stored = await ko.get(body.koId);
    backstop = { found: stored !== undefined, level: stored?.confidentiality ?? null };
  }
  return classifyProvenanceConfidential(body.source, body.confidentiality, backstop);
}

export function checkTextRoutes(deps: CheckTextRouteDeps, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.post<{
      Body: {
        text: string;
        title?: string;
        locale?: string;
        want?: string;
        // SCRUM-502 Schicht 2 (Round 3): Herkunft des geprüften Textes (fail-safe, siehe bodySchema).
        source?: string;
        koId?: string;
        confidentiality?: string;
      };
    }>(
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
        // preValidation bereits erledigt.
        const locale: "de" | "en" = request.body.locale === "en" ? "en" : "de";
        const input = {
          text: request.body.text,
          locale,
          ...(request.body.title !== undefined ? { title: request.body.title } : {}),
        };
        // Stufe-1-Deps: OHNE Judge/Prefilter → rein deterministisch (kein Modell, kein embed). Für
        // want fehlend / != "deep" bleibt das byte-identisch zu Slice 5.
        const stage1Deps = { ko: deps.ko, overlaps: deps.overlaps };
        // SCRUM-502 R4/R5: Herkunft/Stufe des GEPRÜFTEN Textes bestimmen (fail-safe). Der Text ist
        // immer transient (Paste/Upload) → seine Stufe kommt aus der draft/transient-document-
        // Deklaration; eine koId ist nur hebender Backstop, nie Freigabe-Anker. Fehlt das Signal
        // (z. B. Alt-Add-in) → vertraulich. Vertraulich sperrt Embedder UND Cloud-Judge: die Deep-
        // Prüfung fällt auf den DETERMINISTISCHEN Pfad zurück (findet weiter Textduplikate — NICHT
        // „fest false"), plus ehrlicher Hinweis. Der Text verlässt den Prozess nie extern.
        const wantDeep = request.body.want === "deep";
        const confidential = await resolveCheckedTextConfidential(request.body, deps.ko);
        const deepAllowed = wantDeep && !confidential;
        // Stufe 2 (want:"deep", nicht vertraulich): derselbe Kern MIT Modell-Judge + Prefilter → findet
        // umformulierte Duplikate, liefert Modell-confidence + wörtliche rationale. Bewusster
        // Textabfluss (D4). Vertraulich → bewusst NICHT: kein judge, kein prefilter (deterministisch).
        const checkDeps = deepAllowed
          ? {
              ...stage1Deps,
              duplicateJudge: (a: string, b: string) => deps.reasoner.judgeDuplicate(a, b, locale),
              semanticPrefilter: deps.semanticPrefilter,
            }
          : stage1Deps;
        // Dry-Run in BEIDEN Stufen: kein Insert, keine Gap, kein Board, kein Inhalts-Audit.
        const result = await checkText(input, checkDeps);
        const note =
          wantDeep && confidential
            ? locale === "en"
              ? "Confidential content is checked deterministically only — no cloud AI or embedder was used."
              : "Vertrauliche Inhalte werden nur deterministisch geprüft — keine Cloud-KI, kein Embedder."
            : null;
        reply.code(200).send(toResponse(result, note));
      },
    );
  };
}

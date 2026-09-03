import type { FastifyPluginAsync } from "fastify";
import type { ConflictService, OverlapService } from "../../../conflicts";
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

// SCRUM-498 (WP-D): expliziter Route-bodyLimit (statt des globalen 1-MiB-Fastify-Default) — Konsistenz
// zu /api/ask (ASK_BODY_LIMIT, ask-routes.ts). 128 KiB deckt einen 8.000-Codepoint-Text (roh bis
// ~96 KiB bei Escape-Worst-Case) plus title + Envelope/Zusatzfelder komfortabel; Bodies darüber liegen
// außerhalb der gültigen Hülle → kontrolliertes 413 statt des globalen 1-MiB-Defaults.
const CHECK_TEXT_BODY_LIMIT = 128 * 1024; // 128 KiB

// ben-Review-Fix: Body-Schema als Quelle der INHALTLICHEN Eingabe-Validierung (Länge/Typ der Felder).
// Fehlender/null/malformer Body oder text außerhalb 40–8.000 → Fastify liefert einen kontrollierten 400
// in der validation-Phase (kein Handler-Zugriff auf undefined, KEINE interne TypeError/500 nach außen).
// SCRUM-498 (WP-D): die GRÖSSE des Bodies selbst prüft zusätzlich CHECK_TEXT_BODY_LIMIT (Transport-Cap,
// vor der Schema-Validierung) — zusammen bilden beide die vollständige Eingabe-Härtung. want bleibt
// bewusst ein freier String (kein enum), damit "deep" das Schema passiert und im Handler die klare
// „noch nicht"-Meldung erzeugt; locale bleibt permissiv (Handler normalisiert auf de/en).
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
  // ============================================================================================
  // JOB 1970 RIEGEL 1 — DER KONFLIKTDIENST KANN JETZT HEREIN, UND ER MUSS ES NICHT.
  // ============================================================================================
  //
  // KA7 (Widerspruchs-Hinweis) zeigt Serverbefunde; die Quelle dafuer ist diese Route. Der Kern
  // `checkText` fuehrt den Konfliktzweig laengst — er bleibt ohne Dienst schlicht leer
  // (`check-text-detection.ts:186-188`: `deps.conflicts ? await … : []`). Was fehlte, war der
  // Weg hierher.
  //
  // OPTIONAL UND ADDITIV, mit Absicht: die Kompositionswurzel reicht heute KEINEN Konfliktdienst
  // durch (`build-app.ts:1328-1337` — gemessen). Ohne ihn verhaelt sich diese Route byteweise wie
  // vorher, und die gesetzte Zusicherung `expect(body.conflicts).toEqual([])`
  // (`check-text-routes.test.ts:124`) bleibt unangetastet. Erst wenn jemand den Dienst hier
  // hereinreicht, traegt die Antwort Konflikte — und dann sind es ECHTE, keine erfundenen.
  conflicts?: ConflictService | undefined;
}

// Ergebnis-Form → Response-Vertrag. snippet OPTIONAL (der Kern erzeugt heute keinen Beleg-Snippet →
// Feld nur führen, wenn vorhanden; NICHT fabrizieren). confidence/rationale sind für den
// deterministischen Pfad regulär leer → als null geführt (stabile Form, kein erfundener Wert).
// SCRUM-502 Schicht 2 (Round 3): `note` trägt den ehrlichen Hinweis, wenn eine want:"deep"-Prüfung
// wegen vertraulichem Text auf den deterministischen Pfad zurückfällt (kein Embedder/Cloud-Judge).
// JOB 3020: `koStatus`/`koCategory` reichen den FUNDORT additiv nach außen — in duplicates UND
// conflicts, in derselben Form. Beide Werte stammen aus dem Kern (check-text-detection.ts) und damit
// aus dem bereits geladenen Pool; die Route lädt nichts nach und rät nichts. `null` heißt „der
// Bestand sagt dazu nichts" (fehlende Kategorie) — kein Platzhalter, kein Standardwert.
function toResponse(result: CheckTextResult, note: string | null = null) {
  return {
    duplicates: result.duplicates.map((d) => ({
      koId: d.koId,
      koTitle: d.koTitle,
      relation: d.relation,
      confidence: d.confidence ?? null,
      method: d.method,
      rationale: d.rationale ?? null,
      koStatus: d.koStatus,
      koCategory: d.koCategory,
      ...(d.snippet !== undefined ? { snippet: d.snippet } : {}),
    })),
    // JOB 1970 RIEGEL 2: bis hierher stand `conflicts: []` FEST — die Antwort behauptete „keine
    // Konflikte", auch wenn der Kern welche gefunden hatte. Jetzt traegt sie, was DER KERN sagt,
    // in derselben Form wie `duplicates`. Ohne Konfliktdienst liefert der Kern eine leere Liste
    // (`check-text-detection.ts:186-188`), also bleibt die Antwort heute byteweise dieselbe —
    // aber sie ist ab jetzt ABGELEITET statt behauptet.
    conflicts: result.conflicts.map((c) => ({
      koId: c.koId,
      koTitle: c.koTitle,
      type: c.type,
      confidence: c.confidence ?? null,
      method: c.method,
      rationale: c.rationale ?? null,
      koStatus: c.koStatus,
      koCategory: c.koCategory,
      ...(c.snippet !== undefined ? { snippet: c.snippet } : {}),
    })),
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
        bodyLimit: CHECK_TEXT_BODY_LIMIT,
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
        // ==========================================================================================
        // JOB 3020 — WER FRAGT, ENTSCHEIDET DIE REICHWEITE. NICHT DER RUMPF DER ANFRAGE.
        // ==========================================================================================
        //
        // Der ANGEMELDETE MENSCH (Session-Pfad, `ko.read` in preValidation erzwungen) prüft gegen
        // den ganzen Bestand — auch gegen noch nicht validierte Objekte. Genau das war Pedis
        // Diktat vom 30.07.: eine Dublette entsteht sonst gegen einen Eintrag, den es längst gibt.
        //
        // Der ADD-IN-PFAD bleibt unverändert auf Validiertes beschränkt. Seine Capability heißt
        // `checktext.validated` (addon-principal.ts) und dieselbe Linie zieht der Fragepfad
        // (ask/src/service.ts): ein Add-on-Principal darf nie aus unvalidierten Inhalten antworten.
        //
        // ES GIBT BEWUSST KEIN RUMPF-FELD DAFÜR: käme die Reichweite aus dem Body, könnte sich der
        // Add-in-Client sie selbst geben — der Riegel wäre eine Bitte. Sie hängt deshalb am
        // authentifizierten Weg, den der Client nicht wählen kann.
        const istAddon = request.authContext?.authKind === "addon";
        const includeUnvalidated = !istAddon;
        // Stufe-1-Deps: OHNE Judge/Prefilter → rein deterministisch (kein Modell, kein embed). Für
        // want fehlend / != "deep" bleibt das byte-identisch zu Slice 5.
        const stage1Deps = { ko: deps.ko, overlaps: deps.overlaps, includeUnvalidated };
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
              // JOB 1970 D4 (bens Auflage 1): der Konfliktdienst wird AUSSCHLIESSLICH hier
              // gereicht — im freigegebenen tiefen, nicht vertraulichen Zweig. Stand er wie in D3
              // in `stage1Deps`, erreichte ihn auch der vertrauliche Fall (`checkDeps` waehlt dort
              // genau dieses Objekt) und rief `assessAgainstPool` einmal ergebnislos. Dass der
              // Dienst ohne Judge sofort `[]` liefert (conflicts/src/service.ts:481-483), ersetzt
              // die Zusicherung „null Dienstaufrufe" nicht.
              ...(deps.conflicts ? { conflicts: deps.conflicts } : {}),
              duplicateJudge: (a: string, b: string) => deps.reasoner.judgeDuplicate(a, b, locale),
              conflictJudge: (a: string, b: string) => deps.reasoner.judgeConflict(a, b),
              semanticPrefilter: deps.semanticPrefilter,
            }
          : stage1Deps;
        // Dry-Run in BEIDEN Stufen: kein Insert, keine Gap, kein Board, kein Inhalts-Audit.
        const result = await checkText(input, checkDeps);
        // Die Antwort sagt, WOGEGEN geprüft wurde. Beide Aussagen sind unabhängig voneinander wahr
        // und schließen sich nicht aus — treffen beide zu, stehen auch beide da (JOB 3020: der
        // Vertraulichkeits-Hinweis aus SCRUM-502 darf durch den neuen Satz nicht verloren gehen).
        const hinweise: string[] = [];
        if (wantDeep && confidential) {
          hinweise.push(
            locale === "en"
              ? "Confidential content is checked deterministically only — no cloud AI or embedder was used."
              : "Vertrauliche Inhalte werden nur deterministisch geprüft — keine Cloud-KI, kein Embedder.",
          );
        }
        if (includeUnvalidated) {
          // KEIN „gegen den GESAMTEN Bestand": die Kandidatenwahl ist gedeckelt
          // (DETECTION_CANDIDATE_CAP) — dieser Satz sagt deshalb nur, WELCHE ZUSTÄNDE mitzählen,
          // und behauptet keine Vollständigkeit, die der Lauf nicht hergibt.
          hinweise.push(
            locale === "en"
              ? "Entries that are not yet validated were included in this check."
              : "Auch noch nicht validierte Einträge wurden mitgeprüft.",
          );
        }
        const note = hinweise.length > 0 ? hinweise.join(" ") : null;
        reply.code(200).send(toResponse(result, note));
      },
    );
  };
}

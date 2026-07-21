import type { FastifyPluginAsync } from "fastify";
import type { AskService } from "../../../ask";
import {
  DEFAULT_EXTERNAL_KNOWLEDGE_STAGE,
  type ExternalKnowledgePolicyRepo,
  publicAiEnrichmentAllowed,
} from "../../../external-search";
import { type Confidentiality, type KoService, isConfidential } from "../../../knowledge-object";
import {
  MAX_DESCRIBE_IMAGE_DATAURL_CHARS,
  type Reasoner,
  type ReasonerLocale,
  ReasonerPolicyLockedError,
} from "../../../reasoner";
import { runConflictSelfTest } from "../conflict-self-test";
import { runDuplicateSelfTest } from "../duplicate-self-test";
import type { Guards } from "../http";

// FR-I18N-01: nur DE/EN; alles andere/ungültige normalisiert sauber auf "de" (keine 400).
function normalizeLocale(value: unknown): ReasonerLocale {
  return value === "en" ? "en" : "de";
}

// SCRUM-502 Round 4 (ben-Review): die Einstufung ist an den VERARBEITETEN TEXT gebunden, nicht an
// eine lose koId. Round 3 ehrte `source:"ko"` und stufte nach der GESPEICHERTEN KO-Stufe ein —
// verarbeitete aber frei gelieferten Text. Damit konnte ein fremdes/internes KO als Freigabe-Anker
// für beliebigen (vertraulichen) Text dienen (Editor-Text, Upload). Round 4:
//   - Gültige Quellen für client-gelieferten Text: "draft" (Editor/getippt) und "transient-document"
//     (Upload). Beide tragen die AKTUELLE Stufe EXPLIZIT (inkl. "intern"); fehlt/ungültig → fail-safe.
//   - Eine mitgelieferte koId ist NUR ein Backstop, der die Stufe HEBEN darf (Schutz vor Downgrade
//     eines gespeichert-vertraulichen KOs), NIEMALS senken → sie kann nie als falscher Freigabe-Anker
//     dienen (ein internes/fremdes KO hebt nichts).
//   - Eine bloße `source:"ko"` (loser Anker für frei gelieferten Text) wird NICHT mehr geehrt →
//     fail-safe vertraulich. (Ein künftiger digest-/versionsgebundener Pfad könnte sie re-aktivieren.)
// `backstop` ist das Ergebnis eines optionalen koId-Loads (found=false → kein Backstop).
export type StoredLookup = { found: boolean; level?: Confidentiality | null };

const CLIENT_TEXT_SOURCES = new Set(["draft", "transient-document"]);

export function classifyProvenanceConfidential(
  source: unknown,
  declared: unknown,
  backstop: StoredLookup,
): boolean {
  if (typeof source === "string" && CLIENT_TEXT_SOURCES.has(source)) {
    // Explizite, gültige AKTUELLE Stufe des Textes ist Pflicht — fehlt/ungültig → fail-safe.
    if (declared !== "intern" && declared !== "vertraulich" && declared !== "streng_vertraulich") {
      return true;
    }
    // Backstop hebt nur: ein gespeichert-vertrauliches KO (via koId) macht auch als "intern"
    // deklarierten Text vertraulich; ein internes/unbekanntes KO senkt nie eine Deklaration.
    return isConfidential(declared) || isConfidential(backstop.level ?? null);
  }
  // source:"ko"/plain/fehlend/ungültig → loser/kein Anker → fail-safe vertraulich.
  return true;
}

// Reasoner (§2.5): ein einheitlicher, modellagnostischer Endpunkt. 'structure' formt Rohtext
// zu einem KO-Vorschlag; 'ask' beantwortet über die Ask-Schicht (Kontext aus validierten KOs).
export interface ReasonerRoutesDeps {
  reasoner: Reasoner;
  ask: AskService;
  // SCRUM-426: Freigabe-Gate der Public-KI-Anreicherung (Admin-Regler SCRUM-414).
  externalKnowledge: ExternalKnowledgePolicyRepo;
  // SCRUM-502 Schicht 2: für den autoritativen koId-Load der gespeicherten Vertraulichkeitsstufe.
  ko: KoService;
}

// WP-BILD-1c: Body-Deckel des Reasoner-Dispatchers. 6 MiB = 5-MB-Bild-Deckel (describe) + JSON-
// Overhead; die Text-Tasks bleiben serverseitig ohnehin enger gedeckelt (z. B. extract 60.000
// Zeichen). Über dem Cap: kontrolliertes 413 von Fastify; der describe-Zweig meldet seinen
// eigenen 5-MB-Deckel zusätzlich mit ehrlicher Begründung.
export const REASONER_BODY_LIMIT = 6 * 1024 * 1024; // 6 MiB

export function reasonerRoutes(deps: ReasonerRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { reasoner, ask, externalKnowledge, ko } = deps;

  // SCRUM-502 Round 4: die Stufe kommt aus der AKTUELLEN Text-Deklaration (draft/transient-document).
  // Eine koId wird — falls mitgeliefert — NUR als hebender Backstop geladen (Downgrade-Schutz), nie
  // als Freigabe-Anker. Die reine Regel entscheidet fail-safe.
  const resolveConfidential = async (
    source: unknown,
    koId: unknown,
    declared: unknown,
  ): Promise<boolean> => {
    let backstop: StoredLookup = { found: false };
    if (
      typeof source === "string" &&
      CLIENT_TEXT_SOURCES.has(source) &&
      typeof koId === "string" &&
      koId.length > 0
    ) {
      const stored = await ko.get(koId);
      backstop = { found: stored !== undefined, level: stored?.confidentiality ?? null };
    }
    return classifyProvenanceConfidential(source, declared, backstop);
  };

  return async (app) => {
    // WP-BILD-1c: der describe-Task trägt eine data:image-URL (bis 5 MB Deckel) — der globale
    // 1-MiB-Fastify-Default würde echte Fotos schon VOR der ehrlichen Routen-Prüfung abweisen.
    // Muster WP-D1d (capture-routes): expliziter Route-bodyLimit + AUTH VOR dem Body-Parsing
    // (onRequest), damit die vergrößerte Parser-Fläche anonym nicht offensteht; der Handler prüft
    // danach wie bisher die konkrete Berechtigung (ko.read) — Defense-in-Depth.
    const requireAuthedBeforeParse = async (
      request: Parameters<Guards["requireUser"]>[0],
      reply: Parameters<Guards["requireUser"]>[1],
    ): Promise<void> => {
      await guards.requireUser(request, reply);
    };
    app.post<{
      Body: {
        task: "structure" | "ask" | "assist" | "interview" | "extract" | "describe";
        text?: string;
        answers?: string[];
        // WP-BILD-1c: Bild-Daten für 'describe' (KI-Bildbeschreibungs-Vorschlag) — eine
        // data:image-URL; Größe und Format werden VOR dem Modellaufruf geprüft.
        dataUrl?: string;
        locale?: "de" | "en";
        // SCRUM-312: optionale Bearbeitungs-Anweisung für 'assist' (klarer/strukturieren/… oder frei).
        instruction?: string;
        // PMO-FEA-0006: optionaler Suchauftrag des Experten für 'extract' (wonach suchen?).
        query?: string;
        // SCRUM-451: Ergebnis-Sprache für 'extract' — "system" (Default, UI-Sprache) oder
        // "source" (Sprache des Dokuments, nichts übersetzen).
        outputLanguage?: "system" | "source";
        // SCRUM-502 Round 4: Herkunft des VERARBEITETEN Textes. Da die Reasoner-Aktionen immer
        // client-gelieferten Text bearbeiten, sind nur die Text-Quellen gültig: `draft` (Editor/
        // getippt) und `transient-document` (Upload) — beide mit AKTUELLER `confidentiality` (Pflicht,
        // inkl. "intern"). Optionale `koId` ist NUR ein hebender Backstop (Downgrade-Schutz), nie ein
        // Freigabe-Anker. Fehlt/ungültig → fail-safe vertraulich.
        source?: "draft" | "transient-document";
        koId?: string;
        confidentiality?: Confidentiality;
      };
    }>(
      "/api/reasoner",
      { bodyLimit: REASONER_BODY_LIMIT, onRequest: requireAuthedBeforeParse },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const { task, text } = request.body;
        // FR-I18N-01: UI-Sprache steuert Prompt/Frage/Label (Quelleninhalt bleibt original).
        const locale = normalizeLocale(request.body.locale);
        if (task === "structure") {
          // SCRUM-502 Schicht 2: vertraulicher Draft/KO → Cloud aus der Kette (lokal/deterministisch).
          const confidential = await resolveConfidential(
            request.body.source,
            request.body.koId,
            request.body.confidentiality,
          );
          reply.code(200).send(await reasoner.structure(text ?? "", locale, confidential));
          return;
        }
        if (task === "ask") {
          // Kartierung SCRUM-502 Schicht 2: 'ask' trägt eine reine Nutzerfrage (kein gespeicherter
          // KO-Text); der Antwort-Kontext ist bereits Schicht-1-gefiltert. Keine Sensitivitäts-Route.
          reply.code(200).send(await ask.ask(text ?? "", user.id, locale));
          return;
        }
        if (task === "assist") {
          // FR-RSN-03 / SCRUM-312: Text präzisieren/glätten, optional mit Bearbeitungs-Anweisung.
          const confidential = await resolveConfidential(
            request.body.source,
            request.body.koId,
            request.body.confidentiality,
          );
          reply
            .code(200)
            .send(
              await reasoner.assistText(text ?? "", locale, request.body.instruction, confidential),
            );
          return;
        }
        if (task === "interview") {
          // SCRUM-132: reasoner-getriebenes Interview, stateless (Antworten rein).
          const confidential = await resolveConfidential(
            request.body.source,
            request.body.koId,
            request.body.confidentiality,
          );
          reply
            .code(200)
            .send(await reasoner.interview(request.body.answers ?? [], locale, confidential));
          return;
        }
        if (task === "extract") {
          // SCRUM-451: Ergebnis-Sprache validieren — nur die zwei bekannten Werte, sonst 400.
          const outputLanguage = request.body.outputLanguage;
          if (
            outputLanguage !== undefined &&
            outputLanguage !== "system" &&
            outputLanguage !== "source"
          ) {
            reply.code(400).send({
              error: "BAD_REQUEST",
              message: "outputLanguage muss 'system' oder 'source' sein.",
            });
            return;
          }
          // PMO-FEA-0006: Wissenspunkte aus Dokumenttext (optional mit Suchauftrag). Ohne
          // Modell antwortet der Reasoner ehrlich mit leerer Liste + note (keine Fake-Punkte).
          // SCRUM-502 Schicht 2: vertraulicher Dokumenttext/KO → Cloud aus der Kette.
          const confidential = await resolveConfidential(
            request.body.source,
            request.body.koId,
            request.body.confidentiality,
          );
          reply
            .code(200)
            .send(
              await reasoner.extract(
                text ?? "",
                locale,
                request.body.query,
                outputLanguage === "source",
                confidential,
              ),
            );
          return;
        }
        if (task === "describe") {
          // WP-BILD-1c: KI-Bildbeschreibung als VORSCHLAG. Erst die deterministischen Prüfungen
          // (Format + Größendeckel), dann derselbe Vertraulichkeits-Pfad wie die anderen Tasks —
          // vertrauliche Entwürfe erreichen die Cloud (den einzigen Vision-Client) nie.
          const dataUrl = request.body.dataUrl;
          if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
            reply.code(400).send({
              error: "BAD_REQUEST",
              message: "dataUrl fehlt oder ist keine data:image-URL.",
            });
            return;
          }
          if (dataUrl.length > MAX_DESCRIBE_IMAGE_DATAURL_CHARS) {
            // Ehrliche Meldung statt stillem Abschneiden — der Client zeigt sie im Vorschlags-Panel.
            reply.code(413).send({
              error: "PAYLOAD_TOO_LARGE",
              message: "Das Bild ist zu groß für den Beschreibungs-Vorschlag (max. 5 MB).",
            });
            return;
          }
          const confidential = await resolveConfidential(
            request.body.source,
            request.body.koId,
            request.body.confidentiality,
          );
          reply.code(200).send(await reasoner.describeImage(dataUrl, locale, confidential));
          return;
        }
        reply.code(400).send({
          error: "BAD_REQUEST",
          message:
            "task muss 'structure', 'ask', 'assist', 'interview', 'extract' oder 'describe' sein.",
        });
      },
    );

    // SCRUM-426: Public-KI-Anreicherung (Modellwissen) — bewusst NICHT quellengebunden.
    // Zwei Gates: (1) Schreibberechtigung (ko.create); (2) der Admin-Regler „externe
    // Wissensabfrage" muss auf „offen" stehen (publicAiEnrichmentAllowed) — sonst 403.
    // Ergebnis ist extern/ungeprüft; die UI kennzeichnet das und übernimmt nur bewusst.
    app.post<{ Body: { query?: string; locale?: "de" | "en" } }>(
      "/api/reasoner/enrich",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const stage = (await externalKnowledge.getStage()) ?? DEFAULT_EXTERNAL_KNOWLEDGE_STAGE;
        if (!publicAiEnrichmentAllowed(stage)) {
          reply.code(403).send({
            error: "PUBLIC_AI_ENRICHMENT_BLOCKED",
            message: "Die Public-KI-Anreicherung ist vom Administrator nicht freigegeben.",
          });
          return;
        }
        const query = (request.body?.query ?? "").trim();
        if (query.length === 0) {
          reply.code(400).send({ error: "BAD_REQUEST", message: "query fehlt." });
          return;
        }
        reply
          .code(200)
          .send(await reasoner.enrichPublic(query, normalizeLocale(request.body.locale)));
      },
    );

    // SCRUM-166: read-only Provider-/Model-Konfiguration (nur Metadaten, keine Secrets).
    app.get("/api/reasoner/config", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(reasoner.configStatus());
    });

    // KI-Verwaltung v1 (02.07.2026, Teil-Slice): Zuordnung global + je Aufgabe setzen.
    // Nur Admin; keine Schlüssel — die leben weiter ausschließlich serverseitig.
    app.put<{ Body: { global?: string; perTask?: Record<string, string> } }>(
      "/api/reasoner/config",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          // Laufzeit-Validierung übernimmt setTaskConfig (wirft bei ungültigen Werten).
          // SCRUM-525 P.5 (WP6): setTaskConfig persistiert jetzt → die Zuordnung überlebt Neustart/Deploy.
          await reasoner.setTaskConfig({
            global: request.body.global ?? "auto",
            perTask: request.body.perTask ?? {},
          } as Parameters<typeof reasoner.setTaskConfig>[0]);
          reply.code(200).send(reasoner.configStatus());
        } catch (error) {
          // SCRUM-525 P.5 (WP-C): Befund 3(a) — ein aktiver ENV-Override (KLARWERK_REASONER_POLICY) lehnt
          // den Schreibversuch ab (409, ehrliche Begründung), statt ihn wie einen 400-Validierungsfehler
          // zu behandeln oder still zu übernehmen.
          if (error instanceof ReasonerPolicyLockedError) {
            reply.code(409).send({ error: "REASONER_POLICY_ENV_LOCKED", message: error.message });
            return;
          }
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Ungültige KI-Zuordnung.",
          });
        }
      },
    );

    // SCRUM-386: kundeneigene KI-Assist-Funktionen (Presets). Lesen darf jede angemeldete
    // Rolle (die Palette im Editor zeigt sie an); verwalten nur der Admin. Leitplanken:
    // Presets sind benannte instructions für den VORHANDENEN assist-Task — keine neue
    // Modellfläche, keine Secrets; Vorschau + bewusste Übernahme (G-3) bleiben unverändert.
    app.get("/api/reasoner/assist-presets", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await reasoner.getAssistPresets());
    });

    app.put<{ Body: { presets?: { id?: string; name?: string; instruction?: string }[] } }>(
      "/api/reasoner/assist-presets",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(200).send(await reasoner.setAssistPresets(request.body?.presets ?? []));
        } catch (error) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Ungültige KI-Funktionen.",
          });
        }
      },
    );

    // Key-Test (Pedi 02.07.): echter Mini-Aufruf gegen das konfigurierte Modell — beweist,
    // ob der hinterlegte Schlüssel WIRKLICH funktioniert (401 wird ehrlich benannt).
    // Nur Admin; der Schlüssel selbst verlässt den Server nie.
    app.post("/api/reasoner/test", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await reasoner.probe());
    });

    // SCRUM-428: Key-Test für den eigenen lokalen LLM (echter Mini-Aufruf über den Tunnel).
    app.post("/api/reasoner/test-local", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await reasoner.probeLocal());
    });

    // SCRUM-493: End-to-End-Selbsttest der Konflikterkennung — beweist, dass judgeConflict im
    // deployten Stand antwortet UND kollision liefert. Läuft die echte Erkennungskette gegen einen
    // Wegwerf-Repo (kein Fußabdruck, idempotent). Nur Admin; der Schlüssel verlässt den Server nie.
    app.post("/api/reasoner/conflict-self-test", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await runConflictSelfTest(reasoner));
    });

    // SCRUM-494: End-to-End-Selbsttest der Duplikat-Erkennung — beweist, dass judgeDuplicate im
    // deployten Stand ein semantisches Duplikat erkennt (der reifen-Fall, den der deterministische
    // Ersatzmodus nicht sehen kann). Echte Kette gegen einen Wegwerf-Repo (kein Fußabdruck,
    // idempotent). Nur Admin; der Schlüssel verlässt den Server nie.
    app.post("/api/reasoner/duplicate-self-test", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await runDuplicateSelfTest(reasoner));
    });
  };
}

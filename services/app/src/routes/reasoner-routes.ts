import type { FastifyPluginAsync } from "fastify";
import type { AskService } from "../../../ask";
import {
  DEFAULT_EXTERNAL_KNOWLEDGE_STAGE,
  type ExternalKnowledgePolicyRepo,
  publicAiEnrichmentAllowed,
} from "../../../external-search";
import { type Confidentiality, type KoService, isConfidential } from "../../../knowledge-object";
import type { Reasoner, ReasonerLocale } from "../../../reasoner";
import { runConflictSelfTest } from "../conflict-self-test";
import { runDuplicateSelfTest } from "../duplicate-self-test";
import type { Guards } from "../http";

// FR-I18N-01: nur DE/EN; alles andere/ungültige normalisiert sauber auf "de" (keine 400).
function normalizeLocale(value: unknown): ReasonerLocale {
  return value === "en" ? "en" : "de";
}

// SCRUM-502 Schicht 2 (Round 3, ben-Review): verbindlicher Herkunftsvertrag, FAIL-SAFE. Die frühere
// Regel war fail-OPEN — fehlte jedes Signal, ging der Text an die Cloud. Jetzt MUSS der Client die
// Herkunft des Modell-Aktions-Textes über `source` deklarieren; im Zweifel gilt „vertraulich"
// (kein Cloud-Egress). Reine, testbare Kern-Regel:
//   source "ko"    → koId Pflicht + gültig; der Server lädt die GESPEICHERTE Stufe autoritativ.
//                    Fehlende/UNBEKANNTE koId → vertraulich (NIE false — Downgrade unmöglich).
//   source "draft" → explizite confidentiality-Stufe (inkl. "intern") Pflicht; fehlt/ungültig → vertraulich.
//   alles andere (plain / fehlend / ungültig) für einen KO-/Draft-Task → vertraulich.
// `stored` ist das Ergebnis des koId-Loads (found=false, wenn keine oder unbekannte koId).
export type StoredLookup = { found: boolean; level?: Confidentiality | null };

export function classifyProvenanceConfidential(
  source: unknown,
  koId: unknown,
  declared: unknown,
  stored: StoredLookup,
): boolean {
  if (source === "ko") {
    if (typeof koId !== "string" || koId.length === 0) {
      return true; // fail-safe: KO-Quelle ohne koId
    }
    if (!stored.found) {
      return true; // fail-safe: unbekannte koId (nie stillschweigend false)
    }
    return isConfidential(stored.level ?? null);
  }
  if (source === "draft") {
    // Explizite, gültige Stufe (auch "intern") ist Pflicht — fehlt/ungültig → fail-safe.
    if (declared !== "intern" && declared !== "vertraulich" && declared !== "streng_vertraulich") {
      return true;
    }
    return isConfidential(declared);
  }
  return true; // plain/fehlend/ungültig für einen KO-/Draft-Task → fail-safe vertraulich
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

export function reasonerRoutes(deps: ReasonerRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { reasoner, ask, externalKnowledge, ko } = deps;

  // SCRUM-502 Schicht 2 (Round 3): fail-safe Herkunftsvertrag. Lädt die gespeicherte Stufe NUR für
  // eine gültige source:"ko" + koId; alle anderen Fälle klassifiziert die reine Regel (fail-safe).
  const resolveConfidential = async (
    source: unknown,
    koId: unknown,
    declared: unknown,
  ): Promise<boolean> => {
    if (source === "ko" && typeof koId === "string" && koId.length > 0) {
      const stored = await ko.get(koId);
      return classifyProvenanceConfidential(source, koId, declared, {
        found: stored !== undefined,
        level: stored?.confidentiality ?? null,
      });
    }
    return classifyProvenanceConfidential(source, koId, declared, { found: false });
  };

  return async (app) => {
    app.post<{
      Body: {
        task: "structure" | "ask" | "assist" | "interview" | "extract";
        text?: string;
        answers?: string[];
        locale?: "de" | "en";
        // SCRUM-312: optionale Bearbeitungs-Anweisung für 'assist' (klarer/strukturieren/… oder frei).
        instruction?: string;
        // PMO-FEA-0006: optionaler Suchauftrag des Experten für 'extract' (wonach suchen?).
        query?: string;
        // SCRUM-451: Ergebnis-Sprache für 'extract' — "system" (Default, UI-Sprache) oder
        // "source" (Sprache des Dokuments, nichts übersetzen).
        outputLanguage?: "system" | "source";
        // SCRUM-502 Schicht 2 (Round 3): verbindlicher Herkunfts-Discriminator. `source:"ko"` =
        // Aktion an einem GESPEICHERTEN KO (koId Pflicht, Server lädt Stufe autoritativ);
        // `source:"draft"` = noch nicht gespeicherter Draft (confidentiality Pflicht, inkl. "intern");
        // fehlt/ungültig → fail-safe vertraulich (kein Cloud-Egress).
        source?: "ko" | "draft" | "plain";
        koId?: string;
        confidentiality?: Confidentiality;
      };
    }>("/api/reasoner", async (request, reply) => {
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
      reply.code(400).send({
        error: "BAD_REQUEST",
        message: "task muss 'structure', 'ask', 'assist', 'interview' oder 'extract' sein.",
      });
    });

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
          reasoner.setTaskConfig({
            global: request.body.global ?? "auto",
            perTask: request.body.perTask ?? {},
          } as Parameters<typeof reasoner.setTaskConfig>[0]);
          reply.code(200).send(reasoner.configStatus());
        } catch (error) {
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

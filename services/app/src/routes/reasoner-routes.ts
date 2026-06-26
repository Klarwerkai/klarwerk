import type { FastifyPluginAsync } from "fastify";
import type { AskService } from "../../../ask";
import type { Reasoner, ReasonerLocale } from "../../../reasoner";
import type { Guards } from "../http";

// FR-I18N-01: nur DE/EN; alles andere/ungültige normalisiert sauber auf "de" (keine 400).
function normalizeLocale(value: unknown): ReasonerLocale {
  return value === "en" ? "en" : "de";
}

// Reasoner (§2.5): ein einheitlicher, modellagnostischer Endpunkt. 'structure' formt Rohtext
// zu einem KO-Vorschlag; 'ask' beantwortet über die Ask-Schicht (Kontext aus validierten KOs).
export interface ReasonerRoutesDeps {
  reasoner: Reasoner;
  ask: AskService;
}

export function reasonerRoutes(deps: ReasonerRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { reasoner, ask } = deps;

  return async (app) => {
    app.post<{
      Body: {
        task: "structure" | "ask" | "assist" | "interview";
        text?: string;
        answers?: string[];
        locale?: "de" | "en";
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
        reply.code(200).send(await reasoner.structure(text ?? "", locale));
        return;
      }
      if (task === "ask") {
        reply.code(200).send(await ask.ask(text ?? "", user.id, locale));
        return;
      }
      if (task === "assist") {
        // FR-RSN-03: Text präzisieren/glätten.
        reply.code(200).send(await reasoner.assistText(text ?? "", locale));
        return;
      }
      if (task === "interview") {
        // SCRUM-132: reasoner-getriebenes Interview, stateless (Antworten rein).
        reply.code(200).send(await reasoner.interview(request.body.answers ?? [], locale));
        return;
      }
      reply.code(400).send({
        error: "BAD_REQUEST",
        message: "task muss 'structure', 'ask', 'assist' oder 'interview' sein.",
      });
    });

    // SCRUM-166: read-only Provider-/Model-Konfiguration (nur Metadaten, keine Secrets).
    app.get("/api/reasoner/config", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(reasoner.configStatus());
    });
  };
}

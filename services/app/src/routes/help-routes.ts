import type { FastifyPluginAsync } from "fastify";
import type { KnowledgeRef, Reasoner, ReasonerLocale } from "../../../reasoner";
import type { Guards } from "../http";

// Klara Stufe 2 (Pedi 05.07., präzisiert): „Mit KI-Unterstützung suchen" im Hilfe-Panel.
// Der Client schickt die Frage PLUS die best-passenden Einträge der Hilfe-Wissensdatenbank
// (die Registry lebt im Frontend — eine Quelle der Wahrheit, keine Duplizierung).
// reasoner.helpAnswer GENERIERT daraus eine Antwort: Wissensdatenbank vorrangig, eigenes
// Folgern/Kombinieren erlaubt — das Frontend kennzeichnet jede Antwort als „KI-generiert,
// nicht zu 100 % geprüft". Ohne Modell greift ehrlich die strikte Zitierlogik des Fallbacks.
// Es fließt nur Hilfe-Inhalt + die Nutzerfrage zum Modell — keine Wissensobjekte, keine Kundendaten.

function normalizeLocale(value: unknown): ReasonerLocale {
  return value === "en" ? "en" : "de";
}

interface HelpSnippet {
  id: string;
  title: string;
  body: string;
}

// Enge, ehrliche Eingabegrenzen — die Hilfe braucht keine Romane.
const MAX_SNIPPETS = 12;
const MAX_QUESTION = 300;
const MAX_ID = 80;
const MAX_TITLE = 160;
const MAX_BODY = 700;

function parseSnippets(value: unknown): HelpSnippet[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SNIPPETS) {
    return null;
  }
  const out: HelpSnippet[] = [];
  for (const raw of value) {
    const s = raw as { id?: unknown; title?: unknown; body?: unknown };
    if (
      typeof s.id !== "string" ||
      typeof s.title !== "string" ||
      typeof s.body !== "string" ||
      s.id.length === 0 ||
      s.id.length > MAX_ID ||
      s.title.length === 0 ||
      s.title.length > MAX_TITLE ||
      s.body.length === 0 ||
      s.body.length > MAX_BODY
    ) {
      return null;
    }
    out.push({ id: s.id, title: s.title, body: s.body });
  }
  return out;
}

export interface HelpRoutesDeps {
  reasoner: Reasoner;
}

export function helpRoutes(deps: HelpRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { reasoner } = deps;

  return async (app) => {
    app.post<{
      Body: { question?: unknown; snippets?: unknown; locale?: unknown };
    }>("/api/help/explain", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const question =
        typeof request.body?.question === "string" ? request.body.question.trim() : "";
      if (question.length < 3 || question.length > MAX_QUESTION) {
        reply.code(400).send({ error: "BAD_REQUEST", message: "Frage fehlt oder ist zu lang." });
        return;
      }
      const snippets = parseSnippets(request.body?.snippets);
      if (!snippets) {
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: "snippets fehlen oder sind ungültig." });
        return;
      }
      // Hilfe-Schnipsel als Antwort-Quellen: kuratierte Produkt-Hilfe, daher als gesichert markiert.
      const context: KnowledgeRef[] = snippets.map((s) => ({
        id: s.id,
        title: s.title,
        statement: s.body,
        status: "validiert",
        trust: 90,
      }));
      const result = await reasoner.helpAnswer(
        question,
        context,
        normalizeLocale(request.body?.locale),
      );
      reply.code(200).send(result);
    });
  };
}

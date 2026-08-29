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
      // ==========================================================================================
      // JOB 2660 D3 — WAS DER SERVER NICHT SELBST GELADEN HAT, BEKOMMT KEINE GUETEZUSICHERUNG.
      // ==========================================================================================
      //
      // HIER STAND `status: "validiert", trust: 90` mit der Begruendung „kuratierte Produkt-Hilfe,
      // daher als gesichert markiert". Die Begruendung setzt voraus, dass die Schnipsel WIRKLICH
      // aus der kuratierten Hilfe stammen. Der Server kann das nicht wissen: Sie kommen aus der
      // Registry im FRONTEND und reisen im Rumpf mit (der Kopfkommentar dieser Datei sagt es
      // selbst, Z. 5-7). Ein veraenderter Client-Bestand liefert an derselben Stelle beliebigen
      // Text — und bekam dafuer das Guetesiegel des Hauses.
      //
      // GEMESSEN AM BILDSCHIRM, vor dieser Aenderung (tests/web/job2660-hilfe-fremdtext-ui.test.tsx,
      // Fall F1): Ein frei erfundener Satz wurde Antwortgrundlage, und daneben stand
      //
      //     {"answered":true,"knowledgeClass":"gesichert","trust":90,"sources":["page:start"]}
      //
      // im Panel sichtbar als Etikett „Gesichert". Genau das schliesst die Abnahme aus.
      //
      // `status: "offen"` und `trust: 0` sind keine Abwertung der Hilfe, sondern die ehrliche
      // Aussage ueber die HERKUNFT dieser Refs: unbestaetigt. Die Wirkung entsteht nicht hier,
      // sondern in `answerStanding` (services/reasoner/src/provider.ts): Es stuft nur dann auf
      // „gesichert", wenn JEDE tragende Quelle `status === "validiert"` traegt — ab hier also nie,
      // und der Vertrauenswert ist das Minimum ueber die Quellen, also 0.
      //
      // WAS SICH FUER DEN MENSCHEN AENDERT: Die Antwort bleibt dieselbe; sie heisst nur nicht mehr
      // faelschlich „Gesichert", sondern „Ungeprüft" — das Wort, das der Katalog fuer diesen
      // Zustand schon fuehrt (`ask.knowledgeClass.ungeprueft`). Kein neuer Begriff, keine zweite
      // Wahrheit neben der Wissenssuche.
      const context: KnowledgeRef[] = snippets.map((s) => ({
        id: s.id,
        title: s.title,
        statement: s.body,
        status: "offen",
        trust: 0,
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

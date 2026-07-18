import type { FastifyPluginAsync } from "fastify";
import type { ConflictService } from "../../../conflicts";
import type { Confidentiality, KoService } from "../../../knowledge-object";
import type { Reasoner } from "../../../reasoner";
import type { Guards } from "../http";
import { checkKnowledge } from "../knowledge-check";
import { classifyProvenanceConfidential } from "./reasoner-routes";

// SCRUM-527 (Live-Check): POST /api/knowledge/check — echte Ähnlichkeits-/Widerspruchsprüfung eines
// Entwurfstextes gegen den Bestand, für die Live-Reaktion in „Wissen erfassen". Auth-geschützt
// (requirePermission("ko.read") → vom routeGuardAudit erfasst, kein Blindspot). never block: bei einem
// Fehler ehrlicher Status statt 5xx.
//
// SCRUM-527 (WP3 — voller Provenienz-Vertrag): der Freitext bekommt denselben fail-safe Herkunfts-/
// Vertraulichkeitsvertrag wie /api/check-text. Fehlende/ungültige Klassifikation = VERTRAULICH → KEIN
// Judge (kein Cloud-/Modell-Egress des Freitexts); der Endpoint liefert dann nur similar + status
// "pending". NUR ein sicher als nicht-vertraulich klassifizierter Freitext (draft/transient-document mit
// expliziter Stufe, koId nur hebender Backstop) UND ein verfügbares Modell erhalten den Widerspruchs-Judge.
export interface KnowledgeCheckRouteDeps {
  ko: KoService;
  conflicts: ConflictService;
  reasoner: Reasoner;
  guards: Guards;
}

// Fail-safe Herkunftsauflösung (identische reine Regel wie /api/check-text): der Freitext ist immer
// transient (Editor-Entwurf) → seine Stufe kommt aus der draft/transient-document-Deklaration; eine koId
// ist NUR ein hebender Backstop, nie ein Freigabe-Anker. Fehlt/ungültig → fail-safe vertraulich.
async function resolveDraftConfidential(
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

export function knowledgeCheckRoutes(deps: KnowledgeCheckRouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.post<{
      // source/koId/confidentiality optional (kein Schema) — Alt-Clients ohne diese Felder bekommen
      // fail-safe „vertraulich" (kein Egress), nie 400.
      Body: { text?: string; source?: string; koId?: string; confidentiality?: string };
    }>("/api/knowledge/check", async (request, reply) => {
      const user = await deps.guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const body = request.body ?? {};
      const text = typeof body.text === "string" ? body.text : "";
      // Fail-safe Vertrag: vertraulich/unklassifiziert ODER kein Modell → KEIN Judge (kein Cloud-Egress
      // des Freitexts). Nur nicht-vertraulich + Modell verfügbar → echter Widerspruchs-Judge.
      const confidential = await resolveDraftConfidential(body, deps.ko);
      const modelActive = deps.reasoner.status().active;
      const judge =
        !confidential && modelActive
          ? (coreA: string, coreB: string) => deps.reasoner.judgeConflict(coreA, coreB)
          : null;
      const result = await checkKnowledge(text, {
        ko: deps.ko,
        conflicts: deps.conflicts,
        judge,
      });
      reply.code(200).send(result);
    });
  };
}

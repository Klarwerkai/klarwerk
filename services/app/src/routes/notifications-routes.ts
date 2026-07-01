import type { FastifyPluginAsync } from "fastify";
import type { AskService } from "../../../ask";
import type { AuditService } from "../../../audit";
import type { ConflictService } from "../../../conflicts";
import type { ValidationService } from "../../../validation";
import type { Guards } from "../http";
import { type ImpactNotice, buildNotifications } from "../notification-feed";

// In-App-Benachrichtigungen (U-3): aggregiert aus vorhandenen Signalen. Für jeden
// angemeldeten Nutzer lesbar; keine eigene Persistenz nötig.
export interface NotificationRoutesDeps {
  conflicts: ConflictService;
  ask: AskService;
  // SCRUM-363 / AG-15: Quelle der persönlichen offenen Review-Zuweisungen.
  validation: ValidationService;
  // PMO-FEA-0002: Wirkungs-Rückmeldungen werden aus dem Audit-Log abgeleitet (read-only).
  audit: AuditService;
}

// PMO-FEA-0002: „Hat geholfen"-Ereignisse für den Originalautor. Bewusst ehrlich:
// nur fremde Klicks (kein Selbst-Applaus), nur Einträge mit Autor/Titel-Payload,
// begrenzt auf die letzten 12 — kein Zähler, keine Rangliste (EK-19-Richtung).
export function deriveImpacts(
  entries: Array<{ actor: string; target: string; at: string; payload: Record<string, unknown> }>,
  userId: string,
): ImpactNotice[] {
  const out: ImpactNotice[] = [];
  for (const e of entries) {
    const koAuthor = e.payload.koAuthor;
    const koTitle = e.payload.koTitle;
    if (e.actor === userId || koAuthor !== userId || typeof koTitle !== "string") {
      continue;
    }
    out.push({ koId: e.target, title: koTitle, at: e.at });
  }
  return out.slice(-12);
}

export function notificationsRoutes(
  deps: NotificationRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/notifications", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      // SCRUM-363: Zuweisungen werden PRO NUTZER geladen (user.id) — der Feed zeigt nur die
      // Review-Arbeit der angemeldeten Person, keine fremden Zuweisungen.
      const [conflicts, gaps, assignments, helpful] = await Promise.all([
        deps.conflicts.unresolved(),
        deps.ask.listGaps(),
        deps.validation.openAssignmentsFor(user.id),
        deps.audit.list({ action: "answer.helpful" }),
      ]);
      const impacts = deriveImpacts(helpful, user.id);
      reply.code(200).send(buildNotifications({ conflicts, gaps, assignments, impacts }));
    });
  };
}

import type { FastifyPluginAsync } from "fastify";
import type { AskService } from "../../../ask";
import type { ConflictService } from "../../../conflicts";
import type { ValidationService } from "../../../validation";
import type { Guards } from "../http";
import { buildNotifications } from "../notification-feed";

// In-App-Benachrichtigungen (U-3): aggregiert aus vorhandenen Signalen. Für jeden
// angemeldeten Nutzer lesbar; keine eigene Persistenz nötig.
export interface NotificationRoutesDeps {
  conflicts: ConflictService;
  ask: AskService;
  // SCRUM-363 / AG-15: Quelle der persönlichen offenen Review-Zuweisungen.
  validation: ValidationService;
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
      const [conflicts, gaps, assignments] = await Promise.all([
        deps.conflicts.unresolved(),
        deps.ask.listGaps(),
        deps.validation.openAssignmentsFor(user.id),
      ]);
      reply.code(200).send(buildNotifications({ conflicts, gaps, assignments }));
    });
  };
}

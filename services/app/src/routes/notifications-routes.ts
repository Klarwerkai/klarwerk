import type { FastifyPluginAsync } from "fastify";
import type { AskService } from "../../../ask";
import type { ConflictService } from "../../../conflicts";
import type { Guards } from "../http";
import { buildNotifications } from "../notification-feed";

// In-App-Benachrichtigungen (U-3): aggregiert aus vorhandenen Signalen. Für jeden
// angemeldeten Nutzer lesbar; keine eigene Persistenz nötig.
export interface NotificationRoutesDeps {
  conflicts: ConflictService;
  ask: AskService;
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
      const [conflicts, gaps] = await Promise.all([
        deps.conflicts.unresolved(),
        deps.ask.listGaps(),
      ]);
      reply.code(200).send(buildNotifications({ conflicts, gaps }));
    });
  };
}

import type { FastifyPluginAsync } from "fastify";
import type { AskService } from "../../../ask";
import type { AuditService } from "../../../audit";
import type { ConflictService } from "../../../conflicts";
import type { NotificationSeenRepo } from "../../../notifications";
import type { ValidationService } from "../../../validation";
import type { Guards } from "../http";
import { type ImpactNotice, type Notification, buildNotifications } from "../notification-feed";

// In-App-Benachrichtigungen (U-3): aggregiert aus vorhandenen Signalen. Für jeden
// angemeldeten Nutzer lesbar; keine eigene Persistenz nötig.
export interface NotificationRoutesDeps {
  conflicts: ConflictService;
  ask: AskService;
  // SCRUM-363 / AG-15: Quelle der persönlichen offenen Review-Zuweisungen.
  validation: ValidationService;
  // PMO-FEA-0002: Wirkungs-Rückmeldungen werden aus dem Audit-Log abgeleitet (read-only).
  audit: AuditService;
  // Audit-P3 (SCRUM-397): pro Nutzer bewusst als gesehen markierte Benachrichtigungs-IDs.
  seen: NotificationSeenRepo;
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

// Audit-P3 (SCRUM-397): Feed einmal bauen, Gelesen-Status je Item ehrlich anreichern.
async function loadFeed(
  deps: NotificationRoutesDeps,
  userId: string,
): Promise<Array<Notification & { seen: boolean }>> {
  // SCRUM-363: Zuweisungen werden PRO NUTZER geladen (user.id) — der Feed zeigt nur die
  // Review-Arbeit der angemeldeten Person, keine fremden Zuweisungen.
  const [conflicts, gaps, assignments, helpful, seenIds] = await Promise.all([
    deps.conflicts.unresolved(),
    deps.ask.listGaps(),
    deps.validation.openAssignmentsFor(userId),
    deps.audit.list({ action: "answer.helpful" }),
    deps.seen.seenFor(userId),
  ]);
  const impacts = deriveImpacts(helpful, userId);
  const seen = new Set(seenIds);
  return buildNotifications({ conflicts, gaps, assignments, impacts }).map((n) => ({
    ...n,
    seen: seen.has(n.id),
  }));
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
      // Rückgabe bleibt das bisherige Array (kompatibel) — neu ist NUR das seen-Feld je Item.
      reply.code(200).send(await loadFeed(deps, user.id));
    });

    // Audit-P3 (SCRUM-397): bewusstes Als-gesehen-Markieren. Idempotent; nur eigene Sicht —
    // markiert wird pro Nutzer, nie für andere. Antwort nennt den ehrlichen Rest-Stand.
    app.post("/api/notifications/seen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const body = request.body as { ids?: unknown } | null;
      const ids = Array.isArray(body?.ids)
        ? body.ids.filter((x): x is string => typeof x === "string")
        : [];
      if (ids.length === 0) {
        reply.code(400).send({ error: "ids fehlt oder leer" });
        return;
      }
      await deps.seen.markSeen(user.id, ids);
      const items = await loadFeed(deps, user.id);
      reply.code(200).send({ unseenCount: items.filter((n) => !n.seen).length });
    });
  };
}

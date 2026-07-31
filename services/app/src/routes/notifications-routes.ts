import type { FastifyPluginAsync } from "fastify";
import { type AskService, redactGapForViewer } from "../../../ask";
import type { AuditService } from "../../../audit";
import type { ConflictService, OverlapService } from "../../../conflicts";
import type { NotificationSeenRepo } from "../../../notifications";
import { can } from "../../../rbac";
import type { ValidationService } from "../../../validation";
import type { Guards, SessionUser } from "../http";
import { type ImpactNotice, type Notification, buildNotifications } from "../notification-feed";
import { type KoSichtbarkeitsZugang, sichtbareEintraege, sichtbarePaare } from "../sichtbarkeit";

// In-App-Benachrichtigungen (U-3): aggregiert aus vorhandenen Signalen. Für jeden
// angemeldeten Nutzer lesbar; keine eigene Persistenz nötig.
export interface NotificationRoutesDeps {
  conflicts: ConflictService;
  // Pedi 04.07.: offene Überschneidungen (Duplikate) in der Glocke, analog zu Konflikten.
  overlaps: OverlapService;
  ask: AskService;
  // SCRUM-363 / AG-15: Quelle der persönlichen offenen Review-Zuweisungen.
  validation: ValidationService;
  // PMO-FEA-0002: Wirkungs-Rückmeldungen werden aus dem Audit-Log abgeleitet (read-only).
  audit: AuditService;
  // Audit-P3 (SCRUM-397): pro Nutzer bewusst als gesehen markierte Benachrichtigungs-IDs.
  seen: NotificationSeenRepo;
  // AUFTRAG-mega74 BLOCK D (G5): Zugang zur Sichtbarkeit der beteiligten Wissensobjekte.
  //
  // AUFTRAG-mega76 BLOCK A: von `kos?` auf PFLICHT. Diese Route ist die schwächste Tür des Satzes
  // (sie steht auf `requireUser`, nicht auf `ko.read`); fehlte der Zugang, trug der Feed die
  // Konflikt-`description`, die Duplikat-`rationale` und den KO-Titel einer Zuweisung ungefiltert.
  // Pflichtparameter ohne Umbau möglich: einziger Aufrufer ist build-app.ts:1018.
  kos: KoSichtbarkeitsZugang;
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
// FUNKE-FIX3 P0 (bens Blocker B): der Feed wird PRO BETRACHTER gebaut — die Gap-Ableitung läuft
// durch denselben zentralen Sichtbarkeitsvertrag wie /api/gaps (gap-visibility.redactGapForViewer):
// Fragetext nur für Owner/Assignee/Detail-Rolle (ko.validate); alle anderen erhalten NUR einen
// redigierten Eintrag (leerer Titel + redacted-Marker → neutrale Bezeichnung im Client). Der
// Betrachter stammt IMMER aus der authentifizierten Session (Route), nie aus dem Body/Client.
async function loadFeed(
  deps: NotificationRoutesDeps,
  user: SessionUser,
): Promise<Array<Notification & { seen: boolean }>> {
  // SCRUM-363: Zuweisungen werden PRO NUTZER geladen (user.id) — der Feed zeigt nur die
  // Review-Arbeit der angemeldeten Person, keine fremden Zuweisungen.
  const [conflicts, overlaps, gaps, assignments, helpful, seenIds] = await Promise.all([
    deps.conflicts.unresolved(),
    deps.overlaps.unresolved(),
    deps.ask.listGaps(),
    deps.validation.openAssignmentsFor(user.id),
    deps.audit.list({ action: "answer.helpful" }),
    deps.seen.seenFor(user.id),
  ]);
  const viewer = { viewerId: user.id, maySeeDetail: can(user.role, "ko.validate") };
  const gapViews = gaps.map((gap) => redactGapForViewer(gap, viewer));
  const impacts = deriveImpacts(helpful, user.id);
  const seen = new Set(seenIds);
  // ================================================================================================
  // AUFTRAG-mega74 BLOCK D (G5) — DIE SCHWÄCHSTE TÜR DES GANZEN SATZES.
  // ================================================================================================
  //
  // Diese Route stand auf `requireUser` — schwächer als `ko.read` — und schrieb die Konflikt-
  // `description`, die Duplikat-`rationale` und den KO-TITEL einer Zuweisung ungefiltert als
  // `title` in den Feed (notification-feed.ts:57-68 und :81-89). Nur der Gap-Zweig war redigiert.
  // Wer ein vertrauliches Objekt nicht öffnen durfte, bekam seinen Kern in der Glocke serviert.
  //
  // Die Impacts brauchen KEIN Tor: `deriveImpacts` gibt ausschliesslich Titel von Objekten aus,
  // deren AUTOR der Betrachter selbst ist (`koAuthor !== userId` → continue, :36) — die trägt die
  // Autor-Ausnahme des Prädikats ohnehin.
  //
  // AUFTRAG-mega76 BLOCK A: die drei Aufrufe standen unter `deps.kos ? ... : <ungefiltert>`. Der
  // Zugang ist jetzt Pflicht, und die Filter laufen UNBEDINGT — es gibt keinen Zweig mehr, der das
  // alte Ergebnis zurückgibt.
  const sichtbareKonflikte = await sichtbarePaare(user, conflicts, deps.kos);
  const sichtbareUeberschneidungen = await sichtbarePaare(user, overlaps, deps.kos);
  // Eine Zuweisung nennt den Titel ihres Wissensobjekts. Sie ist bereits auf den Betrachter
  // beschränkt (openAssignmentsFor), aber ein Prüfer ohne `ko.validate` kann auf ein vertrauliches
  // Objekt angesetzt sein, das er nicht öffnen darf — dann darf auch der Titel nicht erscheinen.
  const sichtbareZuweisungen = await sichtbareEintraege(user, assignments, deps.kos);
  return buildNotifications({
    conflicts: sichtbareKonflikte,
    overlaps: sichtbareUeberschneidungen,
    gaps: gapViews,
    assignments: sichtbareZuweisungen,
    impacts,
  }).map((n) => ({
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
      reply.code(200).send(await loadFeed(deps, user));
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
      const items = await loadFeed(deps, user);
      reply.code(200).send({ unseenCount: items.filter((n) => !n.seen).length });
    });
  };
}

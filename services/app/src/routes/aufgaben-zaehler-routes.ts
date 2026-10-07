import type { FastifyPluginAsync } from "fastify";
import {
  RUECKGABE_REGEL_AKTIONEN,
  returnedToAuthor,
} from "../../../../apps/web/src/lib/validationStatus";
import type { AuditService } from "../../../audit";
import type { KoService } from "../../../knowledge-object";
import type { Guards } from "../http";
import { sichtbareFuer, sqlSichtbarkeitFuer } from "../sichtbarkeit";

// ================================================================================================
// AUTORENÜBERGABE-AUFTRAG, K3 (Ben, Nacharbeit 1) — DIE SECHSTE ZÄHLQUELLE DES KOPFBANDS.
// ================================================================================================
//
// DER BEFUND: Die Aufgabenseite führt die an MICH zurückgegebenen Entwürfe
// (`pages/MyTasks.tsx`, `returnedToAuthor(audit, kos, user.id)`), der Aufgaben-Badge
// (`app/useNavBadges.ts`) zählte sie nicht. Ein eigener zurückgegebener Entwurf ergab Liste=1,
// Badge=0. Die Liste braucht dafür zwei Volltextquellen (`/api/audit`, `/api/kos`), die die
// Shell auf jeder Seite nicht laden darf (FUNKE-FIX3 P0).
//
// DIESE ROUTE liefert nur die Zahl: `{ open }`, kein Titel, kein Protokollinhalt, keine Kennung.
// Sie rechnet mit DENSELBEN drei Regeln wie die Liste:
//   · Sitzung: der angemeldete Betrachter (`user.id`), wie `useSession()` auf der Seite.
//   · Sichtbarkeit: dieselbe Grundmenge wie `GET /api/kos` (`sqlSichtbarkeitFuer` im SQL,
//     `sichtbareFuer` danach, `ko-routes.ts`). Ein unsichtbares Objekt zählt nicht.
//   · Rückgabe: dieselbe FUNKTION `returnedToAuthor`, die die Seite ruft. Sie wird importiert und
//     nicht nachgebaut. Gelesen werden nur die Protokollaktionen, aus denen sie rechnet.
export function aufgabenZaehlerRoutes(
  deps: { ko: Pick<KoService, "list">; audit: Pick<AuditService, "list"> },
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/me/returned-tasks/summary", async (request, reply) => {
      // Dieselbe Tür wie `GET /api/kos`, aus dem die Liste ihre Objekte holt.
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const [kos, protokoll] = await Promise.all([
        deps.ko.list({}, sqlSichtbarkeitFuer(user)),
        Promise.all(RUECKGABE_REGEL_AKTIONEN.map((action) => deps.audit.list({ action }))),
      ]);
      const offen = returnedToAuthor(protokoll.flat(), sichtbareFuer(user, kos), user.id).length;
      reply.code(200).send({ open: offen });
    });
  };
}

import type { FastifyPluginAsync } from "fastify";
import {
  RUECKGABE_REGEL_AKTIONEN,
  returnedToAuthor,
} from "../../../../apps/web/src/lib/validationStatus";
import type { AuditService } from "../../../audit";
import type { KoService } from "../../../knowledge-object";
import type { Guards, SessionUser } from "../http";
import { sichtbareFuer, sqlSichtbarkeitFuer } from "../sichtbarkeit";

// ================================================================================================
// AUTORENÜBERGABE-AUFTRAG, K3 — DIE AN MICH ZURÜCKGEGEBENEN ENTWÜRFE: LISTE UND ZAHL AUS EINER QUELLE.
// ================================================================================================
//
// DER BEFUND (Ben, Nacharbeit 1): Die Aufgabenseite führte die an MICH zurückgegebenen Entwürfe,
// der Aufgaben-Badge (`app/useNavBadges.ts`) zählte sie nicht: Liste=1, Badge=0.
//
// DER ZWEITE BEFUND (Ben, Nacharbeit 3): Die Seite rechnete die Liste im Browser aus dem ganzen
// Protokoll (`GET /api/audit`). Das verlangt `ko.validate`, und Experten haben es nicht
// (`services/rbac/src/policy.ts`). Für genau die Autorinnen, denen die Rückgaben gelten, scheiterte
// die Liste, während der Zähler sie zählte. Zählgleichheit gab es damit nicht.
//
// DESHALB ZWEI WEGE MIT DERSELBEN AUSWAHL, beide nur mit `ko.read` (dieselbe Tür wie `GET /api/kos`):
//   · `GET /api/me/returned-tasks`         → `[{ koId, at, verdict }]` für die Aufgabenliste,
//   · `GET /api/me/returned-tasks/summary` → `{ open }` für das Kopfband (textfrei).
// Beide rechnen mit DENSELBEN drei Regeln:
//   · Sitzung: der angemeldete Betrachter (`user.id`).
//   · Sichtbarkeit: dieselbe Grundmenge wie `GET /api/kos` (`sqlSichtbarkeitFuer` im SQL,
//     `sichtbareFuer` danach). Ein unsichtbares Objekt erscheint und zählt nicht.
//   · Rückgabe: die FUNKTION `returnedToAuthor`, importiert und nicht nachgebaut. Gelesen werden nur
//     die Protokollaktionen, aus denen sie rechnet. Kein Protokolleintrag verlässt den Server.
// `GET /api/audit` bleibt unverändert bei `ko.validate`.
async function grundlage(
  deps: { ko: Pick<KoService, "list">; audit: Pick<AuditService, "list"> },
  user: SessionUser,
) {
  const [kos, protokoll] = await Promise.all([
    deps.ko.list({}, sqlSichtbarkeitFuer(user)),
    Promise.all(RUECKGABE_REGEL_AKTIONEN.map((action) => deps.audit.list({ action }))),
  ]);
  return { kos, protokoll: protokoll.flat() };
}

export function aufgabenZaehlerRoutes(
  deps: { ko: Pick<KoService, "list">; audit: Pick<AuditService, "list"> },
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/me/returned-tasks", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const { kos, protokoll } = await grundlage(deps, user);
      reply.code(200).send(returnedToAuthor(protokoll, sichtbareFuer(user, kos), user.id));
    });

    app.get("/api/me/returned-tasks/summary", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const { kos, protokoll } = await grundlage(deps, user);
      const offen = returnedToAuthor(protokoll, sichtbareFuer(user, kos), user.id).length;
      reply.code(200).send({ open: offen });
    });
  };
}

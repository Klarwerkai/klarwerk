import type { FastifyPluginAsync } from "fastify";
import {
  UEBERGABE_REGEL_AKTIONEN,
  type UebergabeBereich,
  type UebergabeKonto,
  anstehendeUebergaben,
} from "../../../../apps/web/src/lib/autorenuebergabe";
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

// ================================================================================================
// AUTORENÜBERGABE-AUFTRAG (R-0961, K1/K3) — DIE WARTENDEN AUTORENÜBERGABEN.
// ================================================================================================
//
// Liste und Zahl der anstehenden Übergaben, aus derselben Regel (`lib/autorenuebergabe.ts`, Quelle
// und Abbildung der Entscheidung stehen dort). Angezeigt werden sie den Admins (`users.manage`):
//   · Nur sie dürfen die Übergabe ausführen (`transfer-author`, ko-routes.ts).
//   · Nur sie dürfen die Kontolage lesen (`/api/users`).
// Nichts davon verlässt den Server außer Kennung, Grund und Dringlichkeit; Titel und Autor holt die
// Seite über `GET /api/kos`.
export interface UebergabeQuellen {
  /** Die vorhandenen Konten — `AuthService.listUsers`. */
  konten: () => Promise<readonly UebergabeKonto[]>;
  /** Die gepflegten Bereichsprofile (Kritikalität) — `ManagementService.listCategoryProfiles`. */
  bereiche: () => Promise<readonly UebergabeBereich[]>;
}

async function uebergaben(
  deps: { ko: Pick<KoService, "list">; audit: Pick<AuditService, "list"> } & UebergabeQuellen,
  user: SessionUser,
) {
  const [kos, konten, protokoll, bereiche] = await Promise.all([
    deps.ko.list({}, sqlSichtbarkeitFuer(user)),
    deps.konten(),
    Promise.all(UEBERGABE_REGEL_AKTIONEN.map((action) => deps.audit.list({ action }))),
    deps.bereiche(),
  ]);
  return anstehendeUebergaben({
    kos: sichtbareFuer(user, kos),
    konten,
    protokoll: protokoll.flat(),
    bereiche,
  });
}

export function aufgabenZaehlerRoutes(
  deps: { ko: Pick<KoService, "list">; audit: Pick<AuditService, "list"> } & UebergabeQuellen,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/me/author-transfers", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await uebergaben(deps, user));
    });

    app.get("/api/me/author-transfers/summary", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ open: (await uebergaben(deps, user)).length });
    });

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

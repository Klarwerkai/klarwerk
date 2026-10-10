import type { FastifyPluginAsync } from "fastify";
import { type Guards, sendError } from "../http";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";
import {
  type KennzahlDeps,
  KennzahlFilterFehler,
  anfrageAus,
  ladeWissenskennzahlen,
} from "../wissenskennzahlen";

// ADMIN-11 · Wissenskennzahlen (produkt:20261009:admin-wissenskennzahlen).
//
// Eine Lesetür mit `users.manage` — dasselbe Recht wie die Qualitätsaufgaben, aus denen der
// Handlungsbedarf stammt. Das Zeilenrecht ist die EINE Entscheidung aus `sichtbarkeit.ts`.
//
//   GET /api/wissenskennzahlen?tage=7|30|90&space=<id>&team=<id>
//       200 Kennzahlen mit Stand, Zeitraum, Lage je Zahl und den gezählten Vorgängen
//       400 bei einem Space oder Team, das dieser Betrachter nicht wählen kann (keine
//           Existenzauskunft: unbekannt und nicht lesbar antworten gleich)
export function wissenskennzahlenRoutes(deps: KennzahlDeps, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/wissenskennzahlen", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        const anfrage = anfrageAus((request.query ?? {}) as Record<string, unknown>);
        const sichtbar = sichtbarkeitsfilterFuer(user);
        reply.code(200).send(await ladeWissenskennzahlen(deps, user, sichtbar, anfrage));
      } catch (error) {
        if (error instanceof KennzahlFilterFehler) {
          reply.code(400).send({ error: "BAD_REQUEST", message: error.message });
          return;
        }
        sendError(reply, error);
      }
    });
  };
}

import type { FastifyPluginAsync } from "fastify";
import { type Guards, sendError } from "../http";
import {
  type QualitaetsDeps,
  ladeQualitaetsaufgaben,
  uebernimmRueckmeldung,
} from "../qualitaetsaufgaben";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

// ADMIN-10 · Qualitätsaufgaben und Rückmeldungen (produkt:20261009:admin-qualitaetsaufgaben).
//
// Zwei Türen, beide mit `users.manage` — dasselbe Recht wie die übrige Verwaltung. Das Zeilenrecht
// ist die EINE Entscheidung aus `sichtbarkeit.ts`: die Route bildet `sichtbarkeitsfilterFuer(user)`
// und reicht ihn unbedingt herein. Ein Admin sieht also keinen Inhalt eines Space, den er nicht
// lesen darf (kein Rollen-Durchgriff).
//
//   GET  /api/qualitaetsaufgaben                                  — die Übersicht, frisch je Abruf
//   POST /api/qualitaetsaufgaben/rueckmeldungen/:meldungId/uebernehmen
//        200 { art: "angelegt" | "angehaengt" | "bereits", vorgang, am, durch }
//        404 bei unbekannter Meldung ODER nicht sichtbarem Objekt (keine Existenzauskunft)
export function qualitaetsaufgabenRoutes(deps: QualitaetsDeps, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/qualitaetsaufgaben", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        const sichtbar = sichtbarkeitsfilterFuer(user);
        reply.code(200).send(await ladeQualitaetsaufgaben(deps, user, sichtbar));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.post<{ Params: { meldungId: string } }>(
      "/api/qualitaetsaufgaben/rueckmeldungen/:meldungId/uebernehmen",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const sichtbar = sichtbarkeitsfilterFuer(user);
          const ergebnis = await uebernimmRueckmeldung(
            deps,
            user,
            sichtbar,
            request.params.meldungId,
          );
          if (ergebnis.art === "nicht_gefunden") {
            reply.code(404).send({ error: "NOT_FOUND", message: "Rückmeldung nicht gefunden." });
            return;
          }
          reply.code(200).send(ergebnis);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

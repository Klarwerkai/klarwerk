import type { FastifyPluginAsync } from "fastify";
import { type Guards, sendError } from "../http";
import type { KenntnisnahmeKoLeser } from "../kenntnisnahme";
import { darfSehen } from "../sichtbarkeit";
import { type WissensauskunftDeps, wissensauskunftFuer } from "../wissensauskunft";

// ================================================================================================
// WISSENSAUSKUNFT ZUM ZEITPUNKT · EINE LESENDE TÜR (R-1644).
// ================================================================================================
//
//   GET /api/kos/:id/wissensauskunft?zeitpunkt=<ISO>     — Auskunft zum Zeitpunkt   ko.validate
//
// DIESELBE EINSICHTSSTUFE WIE DAS AUDIT-PROTOKOLL (`/api/audit`, Controller/Admin): die Auskunft
// ist eine Auswahl aus genau diesen Belegen, ergänzt um Fassungen und Kenntnisnahmen. Der Eintrag
// wird VOR jeder Antwort gegen `darfSehen` gehalten — ein unsichtbarer Eintrag ist hier wie am
// Detailabruf ein 404. Ein Eintrag im Papierkorb ist über diese Tür nicht abfragbar (404).
//
// Ein Zeitpunkt in der Zukunft wird abgewiesen: über ihn gibt es noch keine Belege, und eine
// Antwort darauf sähe aus wie eine Aussage über das, was dann gilt.

export interface WissensauskunftRoutesDeps extends WissensauskunftDeps {
  kos: KenntnisnahmeKoLeser;
  jetzt: () => number;
}

export function wissensauskunftRoutes(
  deps: WissensauskunftRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { id: string }; Querystring: { zeitpunkt?: string } }>(
      "/api/kos/:id/wissensauskunft",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        const roh = request.query.zeitpunkt;
        const zeitpunkt = typeof roh === "string" && roh.length > 0 ? Date.parse(roh) : Number.NaN;
        if (!Number.isFinite(zeitpunkt)) {
          reply.code(400).send({
            error: "VALIDATION",
            grund: "zeitpunkt_ungueltig",
            message: "Der Zeitpunkt fehlt oder ist ungültig.",
          });
          return;
        }
        if (zeitpunkt > deps.jetzt()) {
          reply.code(400).send({
            error: "VALIDATION",
            grund: "zeitpunkt_zukunft",
            message: "Der Zeitpunkt liegt in der Zukunft.",
          });
          return;
        }
        try {
          const ko = await deps.kos.get(request.params.id);
          if (!ko || !darfSehen(user, ko)) {
            reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
            return;
          }
          reply.code(200).send(await wissensauskunftFuer(deps, ko, zeitpunkt));
        } catch (fehler) {
          sendError(reply, fehler);
        }
      },
    );
  };
}

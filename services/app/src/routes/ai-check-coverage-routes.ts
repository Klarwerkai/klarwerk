import type { FastifyPluginAsync } from "fastify";
import type { KoService } from "../../../knowledge-object";
import { type Guards, sendError } from "../http";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

// ================================================================================================
// AUFTRAG-mega29 C2 (bens M28-3) — DIE LEEREN BOARDS BEKOMMEN EINE EHRLICHE FUSSNOTE.
// ================================================================================================
//
// „Keine offenen Konflikte" und „Keine offenen Überschneidungen" sind wörtlich richtig — und laden
// im Produktkontext trotzdem zu genau dem Schluss ein, gegen den der Deckel-Ehrlichkeitsvertrag
// gebaut wurde. Die Finding-Endpunkte (/api/conflicts, /api/duplicates) liefern nur OFFENE Befunde
// und wissen nichts über die Abdeckung der Läufe, aus denen sie stammen. Ein einzelnes KO trägt sie,
// das aggregierte Board sieht sie nie.
//
// UMFANG, bewusst und ausdrücklich begrenzt (Pedis Reißleine Z galt genau dieser Stelle): EIN
// Lese-Endpunkt, DREI Zähler über den Bestand, keine Objektdaten, keine IDs, keine Titel, keine
// zweite Rechtestufe. Er sagt, dass hinter dem Bestand unvollständige Läufe stehen und in welchem
// Umfang — mehr braucht das leere Board nicht, und mehr würde die Fläche über ihren Zweck hinaus
// verbreitern. Welche Objekte betroffen sind, welcher Erkennungsweg wie weit reichte und ob es
// einen Wiederaufnahme-Weg gibt, bleibt ausdrücklich Post-VIP.
//
// Lesegrenze: `ko.read` — dieselbe wie die beiden Boards, an denen die Aussage erscheint. Es werden
// keine Inhalte berichtet, nur Zählwerte über den Prüf-Zustand.
export function aiCheckCoverageRoutes(ko: KoService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/ai-check/coverage-summary", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply
          .code(200)
          .send(await ko.aiCheckCoverageSummary({ sichtbar: sichtbarkeitsfilterFuer(user) }));
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}

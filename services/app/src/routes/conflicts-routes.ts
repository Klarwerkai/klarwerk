import type { FastifyPluginAsync } from "fastify";
import type { ConflictService } from "../../../conflicts";
import { type Guards, sendError } from "../http";
import {
  type KoSichtbarkeitsZugang,
  feldFreigabe,
  paarSichtbar,
  redigiereKonflikt,
  sichtbarePaare,
} from "../sichtbarkeit";

// Konflikt-API (§2.3/FR-CON). Erstellen/Auflösen auch über den KO-Dispatcher möglich;
// hier zusätzlich Liste, Detail, Eskalation und Zweitmeinung.
//
// AUFTRAG-mega74 BLOCK D (G5): der Konflikt trägt `description` und `detector.quotes.a/b` —
// wörtliche Belegzitate BEIDER Objekte. Ohne den Zugang unten gab diese Datei sie jedem
// `ko.read`-Inhaber heraus, auch wenn er keins der beiden Objekte öffnen durfte. Der Zugang wird
// injiziert (Kompositionswurzel), nicht importiert: die Regel wohnt in ../sichtbarkeit, hier steht
// nur ihre Anwendung.
//
// AUFTRAG-mega76 BLOCK A: `kos` war OPTIONAL und ist jetzt PFLICHT. Der Grund steht in
// ../sichtbarkeit über `zugangTauglich`: ein fehlender Zugang lieferte hier nicht fail-closed,
// sondern `offen` — die ungefilterte Konfliktliste mit allen wörtlichen Belegzitaten. Ein
// Pflichtparameter war an dieser Stelle ohne Umbau möglich, weil die Kompositionswurzel der
// EINZIGE Aufrufer ist (build-app.ts:937); es gab also keinen zweiten Bauweg zu versorgen.
export function conflictRoutes(
  conflicts: ConflictService,
  guards: Guards,
  kos: KoSichtbarkeitsZugang,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/conflicts", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const offen = await conflicts.unresolved();
      // JOB 1125: erste Stufe Existenz (Paar), zweite Stufe Inhalt (Feld je Seite). Siehe die
      // ausführliche Begründung in ../sichtbarkeit über `feldFreigabe`.
      const sichtbar = await sichtbarePaare(user, offen, kos);
      const sichten = [];
      for (const konflikt of sichtbar) {
        sichten.push(
          redigiereKonflikt(konflikt, await feldFreigabe(user, konflikt.koA, konflikt.koB, kos)),
        );
      }
      reply.code(200).send(sichten);
    });

    app.get<{ Params: { id: string } }>("/api/conflicts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const conflict = await conflicts.get(request.params.id);
      // Nicht sichtbar sieht aus wie nicht vorhanden — dieselbe Form wie am Wissensobjekt.
      // JOB 1125, Pflicht 3: das bleibt ein 404 und wird NICHT zur leeren Redaktion. Fehlendes
      // Paar und zurückgehaltener Inhalt sind zwei verschiedene Aussagen.
      if (!conflict || !(await paarSichtbar(user, conflict.koA, conflict.koB, kos))) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Konflikt nicht gefunden." });
        return;
      }
      reply
        .code(200)
        .send(
          redigiereKonflikt(conflict, await feldFreigabe(user, conflict.koA, conflict.koB, kos)),
        );
    });

    app.post<{ Params: { id: string } }>("/api/conflicts/:id/escalate", async (request, reply) => {
      const user = await guards.requirePermission("conflict.resolve", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await conflicts.escalate(request.params.id, user.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    // Berater-Konzept 04.07. (Stufe 4): „Fehlalarm — kein Widerspruch" schließt einen (meist
    // automatisch erkannten) Konflikt bewusst als falsch-positiv. Menschlicher Entscheider (⚑).
    app.post<{ Params: { id: string }; Body: { note?: string } | null }>(
      "/api/conflicts/:id/dismiss",
      async (request, reply) => {
        const user = await guards.requirePermission("conflict.resolve", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await conflicts.dismiss(request.params.id, user.id, request.body?.note));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: { opinion: string } }>(
      "/api/conflicts/:id/second-opinion",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(await conflicts.secondOpinion(request.params.id, request.body.opinion, user.id));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

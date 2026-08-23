import type { FastifyPluginAsync } from "fastify";
import type { LifecycleService } from "../../../lifecycle";
import { type Guards, sendError } from "../http";
import { type KoSichtbarkeitsZugang, sichtbareEintraege } from "../sichtbarkeit";

// Lebenszyklus & Lernpfade (§ FR-LIF). Re-Validierung/Autor-Übergabe laufen über den KO-Dispatcher.
//
// ================================================================================================
// AUFTRAG-JOB2017 (G7) — DIESER LESEWEG SETZTE NICHTS DURCH.
// ================================================================================================
//
// DER BEFUND: `GET /api/lifecycle/couplings/:koId` prüfte `ko.read` und reichte danach die
// gekoppelten Anlagen JEDES Wissensobjekts heraus — die Kennung wählt der Aufrufer. Wer die
// Kennung eines vertraulichen Objekts kennt (aus einem Konflikt, einer Benachrichtigung oder
// durch Raten), bekam seine Kopplungen, ohne das Objekt je öffnen zu dürfen. Der Hauptlesepfad
// `GET /api/kos/:id` hätte demselben Menschen ein 404 gegeben (`ko-routes.ts:440-447`).
//
// WARUM `sichtbareEintraege` UND KEINE EIGENE PRÜFUNG: die Regel wohnt in `../sichtbarkeit`, und
// die Datei warnt ausdrücklich davor, sie ein zweites Mal auszulegen (dort :243f). `sichtbareEintraege`
// ist die vorhandene Form für „diese Kennung(en), für diesen Menschen" — sie ist zusätzlich
// fail-closed: ein untauglicher Zugang liefert die leere Liste, also 404, nicht das alte Ergebnis.
//
// WARUM 404 UND NICHT 403: wörtlich die Begründung aus `ko-routes.ts:436-439` — bei einem
// vertraulichen Objekt ist schon die Existenz eine Auskunft. Deshalb dieselbe Meldung, Wort für Wort.
//
// `kos` IST PFLICHTPARAMETER, nicht optional (AUFTRAG-mega76 BLOCK A): ein Schutz, den der
// Aufrufer weglassen kann, ist keiner. Einziger Aufrufer ist die Kompositionswurzel.
export function lifecycleRoutes(
  lifecycle: LifecycleService,
  guards: Guards,
  kos: KoSichtbarkeitsZugang,
): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: { assetRef: string; koId: string } }>(
      "/api/lifecycle/couple",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        await lifecycle.couple(request.body.assetRef, request.body.koId);
        reply.code(204).send();
      },
    );

    // Audit B1 (Pedi 02.07.): gekoppelte Anlagen eines KOs lesen — fürs KO-Detail.
    app.get<{ Params: { koId: string } }>(
      "/api/lifecycle/couplings/:koId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        // AUFTRAG-JOB2017 (G7): dasselbe Tor wie am Hauptlesepfad, bevor irgendetwas hinausgeht.
        const sichtbar = await sichtbareEintraege(user, [{ koId: request.params.koId }], kos);
        if (sichtbar.length === 0) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
          return;
        }
        reply.code(200).send(await lifecycle.couplingsForKo(request.params.koId));
      },
    );

    app.post<{ Body: { assetRef: string } }>(
      "/api/lifecycle/asset-changed",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        reply.code(200).send(await lifecycle.assetChanged(request.body.assetRef));
      },
    );

    // ============================================================================================
    // AUFTRAG-JOB2020 (G7b) — DIE KENNUNG ALLEIN IST HIER DIE AUSKUNFT.
    // ============================================================================================
    //
    // DER BEFUND: `pendingRevalidation()` liefert `Promise<string[]>` — nackte KO-Kennungen. Der
    // Dienst „nimmt keinen Nutzer entgegen und kennt keine Sichtbarkeitsregel"; die Route reichte
    // das Ergebnis unveraendert durch. Belegt und benannt seit JOB 704 D3
    // (`tests/security/w9-lifecycle-pending-sichtbarkeit.test.ts`, Kopf): „sie ist nicht getrimmt,
    // und wer sie anzeigt, muss selbst trimmen."
    //
    // WARUM EINE KENNUNG HIER REICHT — die Vorfrage, die JOB 2017 offengelassen hat, ist gemessen:
    // `GET /api/kos` laesst ein unsichtbares Objekt aus der Liste FALLEN (`ko-routes.ts:507f`,
    // Trim bis ins SQL) — „ein Platzhalter waere wieder eine Existenzauskunft". Ein Betrachter
    // bekommt die Kennung eines vertraulichen Objekts also nirgends sonst. Sie hier auszugeben ist
    // damit KEINE Doppelung einer ohnehin offenen Zahl (anders als `openGaps`, JOB 1562 D2),
    // sondern die einzige Stelle, an der sie hinausgeht.
    //
    // DIESELBE FORM WIE DER KOPPLUNGSWEG (JOB 2017): `sichtbareEintraege` ist die vorhandene Regel
    // fuer „diese Kennungen, fuer diesen Menschen", und sie ist fail-closed — ein untauglicher
    // Zugang liefert die leere Liste, nicht die alte. Kein zweiter Weg, keine zweite Auslegung.
    //
    // KEIN 404 HIER: eine Liste ist keine Existenzfrage. Ein unsichtbarer Eintrag FEHLT einfach —
    // genau wie in `GET /api/kos`, und aus demselben Grund.
    app.get("/api/lifecycle/pending", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const faellig = await lifecycle.pendingRevalidation();
      const sichtbar = await sichtbareEintraege(
        user,
        faellig.map((koId) => ({ koId })),
        kos,
      );
      reply.code(200).send(sichtbar.map((eintrag) => eintrag.koId));
    });

    app.post<{ Body: { role: string; steps: { title: string }[] } }>(
      "/api/learning-paths",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        reply
          .code(201)
          .send(await lifecycle.createPath(request.body.role, request.body.steps ?? []));
      },
    );

    app.get<{ Params: { role: string } }>("/api/learning-paths/:role", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const path = await lifecycle.getPath(request.params.role);
      if (!path) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Lernpfad nicht gefunden." });
        return;
      }
      reply.code(200).send(path);
    });

    app.post<{ Params: { pathId: string }; Body: { stepId: string } }>(
      "/api/learning-paths/:pathId/complete",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send(
              await lifecycle.completeStep(request.params.pathId, user.id, request.body.stepId),
            );
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Params: { pathId: string } }>(
      "/api/learning-paths/:pathId/progress",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        reply.code(200).send(await lifecycle.progress(request.params.pathId, user.id));
      },
    );
  };
}

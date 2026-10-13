import type { FastifyPluginAsync } from "fastify";
import { type PushAboRepo, type PushSender, pushEndpunktErlaubt } from "../../../notifications";
import type { Guards } from "../http";

// ================================================================================================
// R-0679 / R-2156 / FR-VAL-07 — GERÄTE-PUSH: KONFIGURATION LESEN, GERÄT AN- UND ABMELDEN.
// ================================================================================================
//
// Jede Route wirkt nur auf das EIGENE Konto (`user.id` aus der Sitzung). Ein Abo trägt keine
// Inhalte, nur den Zustellweg des Browsers; die Zuweisungsbenachrichtigung selbst bleibt ohne
// Nutzlast (`notifications/src/push.ts`).

export interface PushRoutesDeps {
  /** Fehlt ohne VAPID-Konfiguration — dann meldet die Anwendung „Push nicht verfügbar". */
  push?: PushSender | undefined;
  abos: PushAboRepo;
}

/** Der Teil eines `PushSubscription.toJSON()`, den der Server braucht. */
function aboAus(roh: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (typeof roh !== "object" || roh === null) {
    return null;
  }
  const { endpoint, keys } = roh as { endpoint?: unknown; keys?: unknown };
  const { p256dh, auth } = (typeof keys === "object" && keys !== null ? keys : {}) as {
    p256dh?: unknown;
    auth?: unknown;
  };
  if (
    typeof endpoint !== "string" ||
    endpoint.length > 2048 ||
    typeof p256dh !== "string" ||
    p256dh.length > 256 ||
    typeof auth !== "string" ||
    auth.length > 256
  ) {
    return null;
  }
  return { endpoint, p256dh, auth };
}

export function pushRoutes(deps: PushRoutesDeps, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/push/config", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply
        .code(200)
        .send({ verfuegbar: deps.push !== undefined, publicKey: deps.push?.publicKey ?? null });
    });

    app.post("/api/push/abo", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      // Auch ohne VAPID-Konfiguration wird das Abo geführt: gesendet wird dann nichts (der
      // Notifier bekommt keinen Push-Weg), aber ein später eingerichteter Betrieb findet die
      // Geräte vor. Die Oberfläche bietet das Einschalten ohnehin nur an, wenn `verfuegbar` gilt.
      const abo = aboAus(request.body);
      if (!abo || !pushEndpunktErlaubt(abo.endpoint)) {
        reply.code(400).send({
          error: "BAD_REQUEST",
          message:
            "Das Geräteabo ist unvollständig oder zeigt nicht auf einen bekannten Push-Dienst.",
        });
        return;
      }
      await deps.abos.speichern({ ...abo, userId: user.id, angelegtAm: new Date().toISOString() });
      reply.code(200).send({ angemeldet: true });
    });

    app.post("/api/push/abo/entfernen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const endpoint = (request.body as { endpoint?: unknown } | null)?.endpoint;
      if (typeof endpoint !== "string") {
        reply.code(400).send({ error: "BAD_REQUEST", message: "endpoint fehlt." });
        return;
      }
      await deps.abos.entfernen(user.id, endpoint);
      reply.code(200).send({ angemeldet: false });
    });
  };
}

import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, sendError } from "../http";
import {
  type KlaraGespraech,
  type KlaraGespraechDienst,
  KlaraGespraechFehler,
  type KlaraNachrichtEingabe,
  type KlaraSchrittEingabe,
} from "../klara-gespraech";

// ================================================================================================
// produkt:20261008:klara-basis — DAS EIGENE KLARA-GESPRÄCH, NUR FÜR DAS EIGENE KONTO.
// ================================================================================================
//
//   GET    /api/me/klara/gespraech                         — das zuletzt geführte eigene Gespräch
//   POST   /api/me/klara/gespraeche                        — ein Gespräch mit Objektbezug beginnen
//   GET    /api/me/klara/gespraeche/:id                    — ein eigenes Gespräch lesen
//   POST   /api/me/klara/gespraeche/:id/nachrichten        — eine Nachricht festhalten
//   PUT    /api/me/klara/gespraeche/:id/schritt            — den letzten bewusst begonnenen Schritt
//   PUT    /api/me/klara/gespraeche/:id/einwilligung       — Einwilligung erteilen oder widerrufen
//   DELETE /api/me/klara/gespraeche/:id                    — ein eigenes Gespräch löschen
//
// Das Konto kommt AUSSCHLIESSLICH aus der Sitzung (`user.id`), nie aus Pfad oder Rumpf. Ein fremdes
// und ein unbekanntes Gespräch antworten gleich (404). Kein zusätzliches Recht: wer angemeldet ist,
// führt seine eigenen Gespräche — ob eine Frage beantwortet wird, entscheidet der Frageweg
// (`POST /api/ask`, `ko.read`), nicht diese Ablage.
//
// Ins Prüfprotokoll gehen nur EREIGNISSE (angelegt, Einwilligung, gelöscht) mit der Kennung — nie
// Frage, Antwort oder Objektbezug. Das Protokoll ist anhängend; ein Inhalt dort wäre nach dem Löschen
// nicht mehr zu entfernen.

export const KLARA_GESPRAECH_BEGONNEN = "klara.gespraech.begonnen";
export const KLARA_GESPRAECH_EINWILLIGUNG = "klara.gespraech.einwilligung";
export const KLARA_GESPRAECH_GELOESCHT = "klara.gespraech.geloescht";

export interface KlaraGespraechRoutenDeps {
  dienst: KlaraGespraechDienst;
  audit: AuditService;
}

const FEHLERCODE: Record<KlaraGespraechFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof KlaraGespraechFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

/** Die Sicht nach außen — ohne Kontokennung, die der Fragende ohnehin selbst ist. */
function sicht(g: KlaraGespraech) {
  return {
    id: g.id,
    objektbezug: g.objektbezug,
    nachrichten: g.nachrichten,
    letzterSchritt: g.letzterSchritt,
    einwilligungAm: g.einwilligungAm,
    angelegtAm: g.angelegtAm,
    geaendertAm: g.geaendertAm,
  };
}

function rumpf<T>(body: unknown): T {
  return (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as T;
}

export function klaraGespraechRoutes(
  deps: KlaraGespraechRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, audit } = deps;

  return async (app) => {
    app.get("/api/me/klara/gespraech", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const g = await dienst.aktuelles(user.id);
        reply.code(200).send({ gespraech: g ? sicht(g) : null });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Body: { objektbezug?: unknown } }>(
      "/api/me/klara/gespraeche",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const g = await dienst.beginne(
            user.id,
            rumpf<{ objektbezug?: unknown }>(request.body).objektbezug,
          );
          await audit.record({
            actor: user.id,
            action: KLARA_GESPRAECH_BEGONNEN,
            target: `klara-gespraech:${g.id}`,
          });
          reply.code(201).send({ gespraech: sicht(g) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/me/klara/gespraeche/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const g = await dienst.hole(user.id, request.params.id);
        reply.code(200).send({ gespraech: sicht(g) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { id: string }; Body: KlaraNachrichtEingabe }>(
      "/api/me/klara/gespraeche/:id/nachrichten",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { gespraech, nachricht } = await dienst.fuegeHinzu(
            user.id,
            request.params.id,
            rumpf<KlaraNachrichtEingabe>(request.body),
          );
          reply.code(201).send({ nachricht, gespraech: sicht(gespraech) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: KlaraSchrittEingabe }>(
      "/api/me/klara/gespraeche/:id/schritt",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const g = await dienst.setzeSchritt(
            user.id,
            request.params.id,
            rumpf<KlaraSchrittEingabe>(request.body),
          );
          reply.code(200).send({ gespraech: sicht(g) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: { erteilt?: unknown } }>(
      "/api/me/klara/gespraeche/:id/einwilligung",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const erteilt = rumpf<{ erteilt?: unknown }>(request.body).erteilt;
          const g = await dienst.setzeEinwilligung(user.id, request.params.id, erteilt);
          await audit.record({
            actor: user.id,
            action: KLARA_GESPRAECH_EINWILLIGUNG,
            target: `klara-gespraech:${g.id}`,
            payload: { erteilt: g.einwilligungAm !== null },
          });
          reply.code(200).send({ gespraech: sicht(g) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // Löschen wirkt ZUERST, der Nachweis folgt: ein nicht erreichbares Protokoll darf einen
    // gewünschten Löschvorgang nicht aufhalten.
    app.delete<{ Params: { id: string } }>(
      "/api/me/klara/gespraeche/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          if (!(await dienst.loesche(user.id, request.params.id))) {
            reply.code(404).send({ error: "NOT_FOUND", message: "Gespräch nicht gefunden." });
            return;
          }
          await audit.record({
            actor: user.id,
            action: KLARA_GESPRAECH_GELOESCHT,
            target: `klara-gespraech:${request.params.id}`,
          });
          reply.code(200).send({ geloescht: 1 });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}

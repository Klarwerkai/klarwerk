import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, sendError } from "../http";
import {
  type KlaraAufgabe,
  type KlaraAufgabeAenderung,
  type KlaraAufgabeDienst,
  type KlaraAufgabeEingabe,
  KlaraAufgabeFehler,
} from "../klara-aufgabe";

// ================================================================================================
// produkt:20261008:klara-aufgaben (Klara 07) — DIE EIGENEN AUFGABEN, NUR FÜR DAS EIGENE KONTO.
// ================================================================================================
//
//   GET    /api/me/klara/aufgaben?status=…   — die eigenen Aufgaben (offene zuerst, nach Priorität)
//   POST   /api/me/klara/aufgaben            — eine Aufgabe aus Notiz oder Auftrag anlegen
//   GET    /api/me/klara/aufgaben/:id        — eine eigene Aufgabe öffnen
//   PUT    /api/me/klara/aufgaben/:id        — bearbeiten, priorisieren, erledigen (gesehene Fassung)
//   DELETE /api/me/klara/aufgaben/:id        — eine eigene Aufgabe löschen
//
// Dieselbe Tür-Regel wie die Notizen (`klara-notiz-routes.ts`): das Konto kommt AUSSCHLIESSLICH aus
// der Sitzung, eine fremde und eine unbekannte Aufgabe antworten gleich (404), kein Weg führt zu
// fremden Aufgaben — auch nicht für Administratoren. Ins Prüfprotokoll gehen nur Ereignisse mit
// Kennung, Weg, Priorität, Status und Fassung — nie Titel, Inhalt oder Bezugstext.

export const KLARA_AUFGABE_ANGELEGT = "klara.aufgabe.angelegt";
export const KLARA_AUFGABE_GEAENDERT = "klara.aufgabe.geaendert";
export const KLARA_AUFGABE_GELOESCHT = "klara.aufgabe.geloescht";

export interface KlaraAufgabeRoutenDeps {
  dienst: KlaraAufgabeDienst;
  audit: AuditService;
}

const FEHLERCODE: Record<KlaraAufgabeFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof KlaraAufgabeFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

/**
 * Die Sicht nach außen — ohne Kontokennung. `zustaendig: "selbst"` sagt, was die Kennung sagen würde:
 * die fragende Person ist die zuständige.
 */
function sicht(a: KlaraAufgabe) {
  return {
    id: a.id,
    vorgang: a.vorgang,
    bereich: a.bereich,
    zustaendig: "selbst" as const,
    weg: a.weg,
    titel: a.titel,
    inhalt: a.inhalt,
    prioritaet: a.prioritaet,
    status: a.status,
    bezug: a.bezug,
    objektbezug: a.objektbezug,
    angelegtAm: a.angelegtAm,
    geaendertAm: a.geaendertAm,
    erledigtAm: a.erledigtAm,
    fassung: a.fassung,
  };
}

function rumpf<T>(body: unknown): T {
  return (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as T;
}

export function klaraAufgabeRoutes(
  deps: KlaraAufgabeRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, audit } = deps;

  return async (app) => {
    app.get<{ Querystring: { status?: unknown } }>(
      "/api/me/klara/aufgaben",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const aufgaben = await dienst.liste(user.id, request.query.status);
          reply.code(200).send({ aufgaben: aufgaben.map(sicht) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Body: KlaraAufgabeEingabe }>("/api/me/klara/aufgaben", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const { aufgabe, wiederholt } = await dienst.lege(
          user.id,
          rumpf<KlaraAufgabeEingabe>(request.body),
        );
        if (!wiederholt) {
          await audit.record({
            actor: user.id,
            action: KLARA_AUFGABE_ANGELEGT,
            target: `klara-aufgabe:${aufgabe.id}`,
            payload: { weg: aufgabe.weg, prioritaet: aufgabe.prioritaet },
          });
        }
        // Eine Wiederholung desselben Vorgangs legt nichts an: 200 mit der gespeicherten Aufgabe.
        reply.code(wiederholt ? 200 : 201).send({ aufgabe: sicht(aufgabe), wiederholt });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.get<{ Params: { id: string } }>("/api/me/klara/aufgaben/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const aufgabe = await dienst.hole(user.id, request.params.id);
        reply.code(200).send({ aufgabe: sicht(aufgabe) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.put<{ Params: { id: string }; Body: KlaraAufgabeAenderung }>(
      "/api/me/klara/aufgaben/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { aufgabe, wiederholt } = await dienst.aendere(
            user.id,
            request.params.id,
            rumpf<KlaraAufgabeAenderung>(request.body),
          );
          if (!wiederholt) {
            await audit.record({
              actor: user.id,
              action: KLARA_AUFGABE_GEAENDERT,
              target: `klara-aufgabe:${aufgabe.id}`,
              payload: {
                fassung: aufgabe.fassung,
                status: aufgabe.status,
                prioritaet: aufgabe.prioritaet,
              },
            });
          }
          reply.code(200).send({ aufgabe: sicht(aufgabe), wiederholt });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // Löschen wirkt ZUERST, der Nachweis folgt — wie bei den Notizen.
    app.delete<{ Params: { id: string } }>("/api/me/klara/aufgaben/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        if (!(await dienst.loesche(user.id, request.params.id))) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Aufgabe nicht gefunden." });
          return;
        }
        await audit.record({
          actor: user.id,
          action: KLARA_AUFGABE_GELOESCHT,
          target: `klara-aufgabe:${request.params.id}`,
        });
        reply.code(200).send({ geloescht: 1 });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });
  };
}

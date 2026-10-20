import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, type SessionUser, sendError } from "../http";
import {
  type KlaraNotiz,
  type KlaraNotizAenderung,
  type KlaraNotizDienst,
  type KlaraNotizEingabe,
  KlaraNotizFehler,
} from "../klara-notiz";

// ================================================================================================
// produkt:20261007:klara-notizen-aufgaben (Klara 06) — DIE EIGENEN NOTIZEN, NUR FÜR DAS EIGENE KONTO.
// ================================================================================================
//
//   GET    /api/me/klara/notizen?q=…&art=…   — die eigenen Notizen, durchsucht (zuletzt geänderte zuerst)
//   POST   /api/me/klara/notizen             — eine Notiz anlegen (Vorgangsschlüssel: keine Doppelnotiz)
//   GET    /api/me/klara/notizen/:id         — eine eigene Notiz öffnen
//   PUT    /api/me/klara/notizen/:id         — eine eigene Notiz bearbeiten (mit gesehener Fassung)
//   DELETE /api/me/klara/notizen/:id         — eine eigene Notiz löschen
//
// Das Konto kommt AUSSCHLIESSLICH aus der Sitzung (`user.id`), nie aus Pfad, Abfrage oder Rumpf.
// Eine fremde und eine unbekannte Notiz antworten gleich (404). Kein zusätzliches Recht: wer
// angemeldet ist, führt seine eigenen Notizen; es gibt keinen Weg, fremde zu lesen — auch nicht für
// Administratoren.
//
// Ins Prüfprotokoll gehen nur EREIGNISSE (angelegt, geändert, gelöscht) mit Kennung, Weg, Art und
// Fassung — nie Titel, Inhalt, Fragen oder Objektbezug. Das Protokoll ist anhängend; ein Inhalt dort
// wäre nach dem Löschen nicht mehr zu entfernen.

export const KLARA_NOTIZ_ANGELEGT = "klara.notiz.angelegt";
export const KLARA_NOTIZ_GEAENDERT = "klara.notiz.geaendert";
export const KLARA_NOTIZ_GELOESCHT = "klara.notiz.geloescht";

export interface KlaraNotizRoutenDeps {
  dienst: KlaraNotizDienst;
  audit: AuditService;
  loesche?: (kontoId: string, id: string) => Promise<boolean>;
  lesbar?: (user: SessionUser, notiz: KlaraNotiz) => Promise<boolean>;
}

const FEHLERCODE: Record<KlaraNotizFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof KlaraNotizFehler) {
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
function sicht(n: KlaraNotiz) {
  return {
    wissensHerkunft: n.wissensHerkunft,
    id: n.id,
    vorgang: n.vorgang,
    art: n.art,
    weg: n.weg,
    titel: n.titel,
    inhalt: n.inhalt,
    offeneFragen: n.offeneFragen,
    objektbezug: n.objektbezug,
    quelle: n.quelle,
    angelegtAm: n.angelegtAm,
    geaendertAm: n.geaendertAm,
    fassung: n.fassung,
  };
}

function rumpf<T>(body: unknown): T {
  return (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as T;
}

export function klaraNotizRoutes(deps: KlaraNotizRoutenDeps, guards: Guards): FastifyPluginAsync {
  const { dienst, audit } = deps;

  return async (app) => {
    app.get<{ Querystring: { q?: unknown; art?: unknown } }>(
      "/api/me/klara/notizen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const notizen = await dienst.liste(user.id, request.query.q, request.query.art);
          const erlaubt = await Promise.all(notizen.map((n) => deps.lesbar?.(user, n) ?? true));
          reply.code(200).send({ notizen: notizen.filter((_, i) => erlaubt[i]).map(sicht) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Body: KlaraNotizEingabe }>("/api/me/klara/notizen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const { notiz, wiederholt } = await dienst.lege(
          user.id,
          rumpf<KlaraNotizEingabe>(request.body),
        );
        if (!wiederholt) {
          await audit.record({
            actor: user.id,
            action: KLARA_NOTIZ_ANGELEGT,
            target: `klara-notiz:${notiz.id}`,
            payload: { weg: notiz.weg, art: notiz.art },
          });
        }
        // Eine Wiederholung desselben Vorgangs legt nichts an: 200 mit der gespeicherten Notiz.
        reply.code(wiederholt ? 200 : 201).send({ notiz: sicht(notiz), wiederholt });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.get<{ Params: { id: string } }>("/api/me/klara/notizen/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const notiz = await dienst.hole(user.id, request.params.id);
        if (deps.lesbar && !(await deps.lesbar(user, notiz))) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Notiz nicht gefunden." });
          return;
        }
        reply.code(200).send({ notiz: sicht(notiz) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.put<{ Params: { id: string }; Body: KlaraNotizAenderung }>(
      "/api/me/klara/notizen/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { notiz, wiederholt } = await dienst.aendere(
            user.id,
            request.params.id,
            rumpf<KlaraNotizAenderung>(request.body),
          );
          if (!wiederholt) {
            await audit.record({
              actor: user.id,
              action: KLARA_NOTIZ_GEAENDERT,
              target: `klara-notiz:${notiz.id}`,
              payload: { fassung: notiz.fassung, art: notiz.art },
            });
          }
          reply.code(200).send({ notiz: sicht(notiz), wiederholt });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // Löschen wirkt ZUERST, der Nachweis folgt: ein nicht erreichbares Protokoll darf einen
    // gewünschten Löschvorgang nicht aufhalten.
    app.delete<{ Params: { id: string } }>("/api/me/klara/notizen/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        if (
          !(await (deps.loesche
            ? deps.loesche(user.id, request.params.id)
            : dienst.loesche(user.id, request.params.id)))
        ) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Notiz nicht gefunden." });
          return;
        }
        await audit.record({
          actor: user.id,
          action: KLARA_NOTIZ_GELOESCHT,
          target: `klara-notiz:${request.params.id}`,
        });
        reply.code(200).send({ geloescht: 1 });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });
  };
}

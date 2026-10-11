import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { KnowledgeObject } from "../../../knowledge-object";
import { type Guards, type SessionUser, sendError } from "../http";
import { darfSehen, sichtbarkeitsfilterFuer } from "../sichtbarkeit";
import type { WissensempfehlungDienst } from "../wissensempfehlung";

// ================================================================================================
// R-1656 · „DU SOLLTEST AUCH WISSEN…" — ZWEI TÜREN.
// ================================================================================================
//
//   GET  /api/kos/:id/empfehlungen  — verwandte Einträge mit ihren Gründen      ko.read
//   POST /api/kos/:id/mitgelesen    — `{ zuvor }`: in derselben Lesesitzung      ko.read
//                                     nach `zuvor` geöffnet (Co-Reading)
//
// Beide Türen halten JEDEN genannten Eintrag vor der Antwort gegen `darfSehen` — ein unsichtbarer
// Eintrag ist hier wie am Detailabruf ein 404. Das Co-Reading-Signal speichert keine Kontokennung;
// Begründung und Grenzen am Kopf von `wissensempfehlung.ts`.

export interface WissensempfehlungRoutesDeps {
  dienst: WissensempfehlungDienst;
  kos: { get(id: string): Promise<KnowledgeObject | undefined> };
}

function nichtGefunden(reply: FastifyReply): void {
  reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
}

export function wissensempfehlungRoutes(
  deps: WissensempfehlungRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, kos } = deps;

  /** Der Eintrag, wenn dieses Konto ihn sehen darf — sonst `undefined` (Antwort 404). */
  async function sichtbaresKo(
    user: SessionUser,
    koId: string,
  ): Promise<KnowledgeObject | undefined> {
    const ko = await kos.get(koId);
    if (!ko || !darfSehen(user, ko)) {
      return undefined;
    }
    return ko;
  }

  return async (app) => {
    app.get<{ Params: { id: string } }>("/api/kos/:id/empfehlungen", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const ko = await sichtbaresKo(user, request.params.id);
        if (!ko) {
          nichtGefunden(reply);
          return;
        }
        reply.code(200).send(await dienst.empfehlungen(ko, sichtbarkeitsfilterFuer(user)));
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/kos/:id/mitgelesen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const body =
          request.body && typeof request.body === "object"
            ? (request.body as Record<string, unknown>)
            : {};
        const zuvor = typeof body.zuvor === "string" ? body.zuvor : "";
        if (zuvor === "" || zuvor === request.params.id) {
          reply.code(400).send({
            error: "VALIDATION",
            message: "zuvor muss ein anderer Wissenseintrag sein.",
          });
          return;
        }
        try {
          const ko = await sichtbaresKo(user, request.params.id);
          const vorher = await sichtbaresKo(user, zuvor);
          if (!ko || !vorher) {
            nichtGefunden(reply);
            return;
          }
          const gezaehlt = await dienst.mitgelesen(user.id, ko.id, vorher.id);
          reply.code(200).send({ gezaehlt });
        } catch (fehler) {
          sendError(reply, fehler);
        }
      },
    );
  };
}

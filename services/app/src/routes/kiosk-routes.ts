import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Guards } from "../http";
import { type KioskProfilQuelle, kioskBindung, leseKioskProfil } from "../kiosk-profil";
import { type AskRouteDeps, antwortLauf } from "./ask-routes";

/** Enger Adapter am bestehenden Antwortlauf. Keine Befehlsausführung und keine Rollenübernahme. */
export function kioskRoutes(
  deps: Pick<AskRouteDeps, "ask" | "ko" | "conflicts">,
  guards: Guards,
  quelle?: KioskProfilQuelle,
): FastifyPluginAsync {
  return async (app) => {
    app.decorateRequest("askSessionUser", null);
    const gesperrt = (reply: FastifyReply): void => {
      reply.code(403).send({ error: "KIOSK_GESPERRT", message: "Kiosk-Zugang nicht verfügbar." });
    };
    const bindung = async (request: FastifyRequest, reply: FastifyReply) => {
      const profil = await leseKioskProfil(quelle);
      if (!profil || request.authContext?.authKind === "addon") {
        gesperrt(reply);
        return null;
      }
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) return null;
      if (user.id !== profil.leserId) {
        gesperrt(reply);
        return null;
      }
      return { profil, user };
    };
    app.get("/api/kiosk/profil", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const b = await bindung(request, reply);
      if (!b) return;
      return { profilId: b.profil.id, revision: b.profil.revision, zugang: "sitzung" };
    });
    app.post<{ Body: { question: string; locale?: string; profilId: string; revision: number } }>(
      "/api/kiosk/fragen",
      {
        bodyLimit: 40_000,
        preValidation: async (request, reply) => {
          const b = await bindung(request, reply);
          if (!b) return reply;
          if (
            request.body &&
            typeof request.body === "object" &&
            Object.keys(request.body).some(
              (k) => !["question", "locale", "profilId", "revision"].includes(k),
            )
          ) {
            reply.code(400).send({ error: "BAD_REQUEST", message: "Unbekanntes Kiosk-Feld." });
            return reply;
          }
          request.askSessionUser = b.user;
        },
        schema: {
          body: {
            type: "object",
            additionalProperties: false,
            required: ["question", "profilId", "revision"],
            properties: {
              question: { type: "string", minLength: 1, maxLength: 8000 },
              locale: { type: "string", enum: ["de", "en", "nl"] },
              profilId: { type: "string", minLength: 1, maxLength: 200 },
              revision: { type: "integer", minimum: 1 },
            },
          },
        },
      },
      async (request, reply) => {
        reply.header("Cache-Control", "no-store");
        const b = await bindung(request, reply);
        if (!b) return;
        const { profil, user } = b;
        if (request.body.profilId !== profil.id || request.body.revision !== profil.revision) {
          gesperrt(reply);
          return;
        }
        if (!request.body.question.trim()) {
          reply.code(400).send({ error: "BAD_REQUEST", message: "Eine Frage ist erforderlich." });
          return;
        }
        const stand = kioskBindung(profil);
        const umfang = new Map(profil.quellen.map((q) => [q.koId, q.fassung]));
        // Der zusätzliche Filter verengt die bestehende Sicht, auch bei der Schlussprüfung.
        const bereich = (ko: object): boolean =>
          "id" in ko &&
          "version" in ko &&
          typeof ko.id === "string" &&
          umfang.get(ko.id) === ko.version;
        request.askSessionUser = user;
        await antwortLauf(deps, request, reply, {
          question: request.body.question.trim(),
          locale: request.body.locale === "en" ? "en" : request.body.locale === "nl" ? "nl" : "de",
          actorId: user.id,
          anlass: "frage",
          bereich,
          opts: { validatedOnly: true, retrievalOnly: true, gapPolicy: "count_only" },
          nachpruefung: async () => {
            const frisch = await bindung(request, reply);
            if (!frisch) return undefined;
            if (kioskBindung(frisch.profil) !== stand) {
              gesperrt(reply);
              return undefined;
            }
            return frisch.user;
          },
          beilage: (out) => ({
            kiosk: {
              profilId: profil.id,
              revision: profil.revision,
              quellen: out.result.sources.map((koId) => ({ koId, fassung: umfang.get(koId) })),
            },
          }),
        });
      },
    );
  };
}

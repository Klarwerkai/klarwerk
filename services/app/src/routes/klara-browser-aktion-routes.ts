import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Guards } from "../http";
import { sendError, tokenFromRequest } from "../http";
import { type BrowserAktionDienst, BrowserAktionFehler } from "../klara-browser-aktion-dienst";
import { KlaraGespraechFehler } from "../klara-gespraech";

// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — DIE TÜREN DER BROWSERAKTIONEN.
// ================================================================================================
//
// Eine Serialisierungsschicht wie `klara-gespraech-routes.ts`: Anmeldung prüfen, Rumpf an den
// Dienst (`klara-browser-aktion-dienst.ts`) reichen, Fehler auf den Draht abbilden. Sie entscheidet
// nichts über Rechte am Ziel — die prüft der Dienst vor JEDEM Schritt frisch.
//
//   POST /api/me/klara/browser-auftraege            Auftrag aus dem Wortlaut anlegen und starten
//   GET  /api/me/klara/browser-auftraege            Browseraufträge im aktuellen Gespräch
//   GET  /api/me/klara/browser-auftraege/:id        ein Browserauftrag
//   POST /api/me/klara/browser-auftraege/:id/takt   Antwort der Seite melden, nächsten Schritt holen
//   POST /api/me/klara/browser-auftraege/:id/steuerung   Pause, Fortsetzen, Abbruch, Bestätigen,
//                                                         Rücknahme, Widerruf
//
// BERECHTIGUNG: `ko.read` an der Tür (wie alle Klara-Wege); jede Wirkung verlangt im Dienst vor
// ihrem Schritt zusätzlich `ko.create`. Nur eine eigene Anmeldesitzung trägt einen Auftrag.

export interface KlaraBrowserAktionRoutenDeps {
  dienst: BrowserAktionDienst;
}

const FEHLERCODE: Record<BrowserAktionFehler["status"], string> = {
  400: "VALIDATION",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof BrowserAktionFehler) {
    reply
      .code(fehler.status)
      .send({ error: FEHLERCODE[fehler.status], grund: fehler.grund, message: fehler.message });
    return;
  }
  if (fehler instanceof KlaraGespraechFehler) {
    const code =
      fehler.status === 400 ? "VALIDATION" : fehler.status === 404 ? "NOT_FOUND" : "CONFLICT";
    reply.code(fehler.status).send({ error: code, grund: fehler.grund, message: fehler.message });
    return;
  }
  sendError(reply, fehler);
}

export function klaraBrowserAktionRoutes(
  deps: KlaraBrowserAktionRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst } = deps;

  /**
   * Die Anmeldesitzung der Anfrage (Bearer oder Sitzungskeks) — ohne sie kein Browserauftrag. Das
   * Recht `ko.read` prüft JEDE Route selbst mit `guards.requirePermission` (sichtbar für die
   * Routenmatrix), danach diese Zeile.
   */
  function sitzung(request: FastifyRequest, reply: FastifyReply): string | undefined {
    const token = tokenFromRequest(request);
    if (!token) {
      reply.code(403).send({
        error: "FORBIDDEN",
        grund: "nur_sitzung",
        message: "Nur mit eigener Anmeldung möglich.",
      });
    }
    return token;
  }

  return async (app) => {
    app.post("/api/me/klara/browser-auftraege", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) return;
      const token = sitzung(request, reply);
      if (!token) return;
      const w = { user, token };
      try {
        const antwort = await dienst.lege(w.user, w.token, request.body);
        reply.code(antwort.art === "auftrag" ? 201 : 200).send(antwort);
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.get("/api/me/klara/browser-auftraege", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) return;
      const token = sitzung(request, reply);
      if (!token) return;
      const w = { user, token };
      try {
        reply.code(200).send({ auftraege: await dienst.liste(w.user) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.get<{ Params: { id: string } }>(
      "/api/me/klara/browser-auftraege/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) return;
        const token = sitzung(request, reply);
        if (!token) return;
        const w = { user, token };
        try {
          reply.code(200).send({ auftrag: await dienst.sicht(w.user, w.token, request.params.id) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/me/klara/browser-auftraege/:id/takt",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) return;
        const token = sitzung(request, reply);
        if (!token) return;
        const w = { user, token };
        try {
          reply.code(200).send(await dienst.takt(w.user, w.token, request.params.id, request.body));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/me/klara/browser-auftraege/:id/steuerung",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) return;
        const token = sitzung(request, reply);
        if (!token) return;
        const w = { user, token };
        try {
          reply
            .code(200)
            .send(await dienst.steuere(w.user, w.token, request.params.id, request.body));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}

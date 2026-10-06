import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { KnowledgeObject } from "../../../knowledge-object";
import { type Guards, type SessionUser, sendError } from "../http";
import {
  type EigeneKenntnisnahme,
  KENNTNISNAHME_MAX_EMPFAENGER,
  type KenntnisnahmeDienst,
  KenntnisnahmeFehler,
  type KenntnisnahmeKoLeser,
} from "../kenntnisnahme";
import { darfSehen } from "../sichtbarkeit";

// ================================================================================================
// KENNTNISNAHME · DIE FÜNF TÜREN.
// ================================================================================================
//
//   GET  /api/kos/:id/kenntnisnahmen                       — zuständige Übersicht      ko.assign
//   POST /api/kos/:id/kenntnisnahmen                       — Kenntnisnahme anfordern   ko.assign
//   POST /api/kenntnisnahmen/:anforderungId/erinnern       — offene Empfänger erinnern ko.assign
//   GET  /api/kenntnisnahmen/meine                         — die eigenen Anforderungen ko.read
//   POST /api/kenntnisnahmen/:anforderungId/bestaetigen    — selbst bestätigen         ko.read
//
// KEINE NEUE ROLLE: Anfordern, Übersicht und Erinnern hängen am vorhandenen Zuweisungsrecht
// (`ko.assign`, Controller/Admin), Lesen und Bestätigen am Leserecht. Jede Tür hält den Eintrag
// VOR jeder Antwort gegen `darfSehen` — ein unsichtbarer Eintrag ist hier wie am Detailabruf ein
// 404, auch für einen Empfänger, dem der Zugriff nach der Anforderung entzogen wurde.
//
// FREMDE EMPFÄNGER: Die eigenen Anforderungen tragen keinen anderen Empfänger und keine Zählung
// über andere — nur die Übersicht des Anfordernden nennt den Empfängerkreis.

export interface KenntnisnahmeRoutesDeps {
  dienst: KenntnisnahmeDienst;
  kos: KenntnisnahmeKoLeser;
}

const FEHLERCODE: Record<KenntnisnahmeFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
  503: "NICHT_HALTBAR",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof KenntnisnahmeFehler) {
    reply.code(fehler.status).send({
      ...fehler.details,
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

function nichtGefunden(reply: FastifyReply): void {
  reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
}

function eingabeFehler(reply: FastifyReply, message: string): void {
  reply.code(400).send({ error: "VALIDATION", grund: "eingabe", message });
}

function koerper(request: FastifyRequest): Record<string, unknown> {
  return request.body && typeof request.body === "object"
    ? (request.body as Record<string, unknown>)
    : {};
}

function fassungAus(wert: unknown): number | null {
  return typeof wert === "number" && Number.isInteger(wert) && wert > 0 ? wert : null;
}

export function kenntnisnahmeRoutes(
  deps: KenntnisnahmeRoutesDeps,
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

  function alsEigene(eigene: EigeneKenntnisnahme, namen: Map<string, string>) {
    const { anforderung, eintrag, ko } = eigene;
    return {
      anforderungId: anforderung.id,
      koId: ko.id,
      titel: ko.title,
      fassung: anforderung.fassung,
      aktuelleFassung: ko.version,
      angefordertVon: namen.get(anforderung.angefordertVon) ?? "",
      angefordertAm: anforderung.angefordertAm,
      frist: anforderung.frist,
      erinnertAm: anforderung.erinnertAm,
      status: dienst.statusVon(eigene),
      bestaetigtAm: eintrag.bestaetigtAm,
    };
  }

  return async (app) => {
    app.get<{ Params: { id: string } }>("/api/kos/:id/kenntnisnahmen", async (request, reply) => {
      const user = await guards.requirePermission("ko.assign", request, reply);
      if (!user) {
        return;
      }
      try {
        const ko = await sichtbaresKo(user, request.params.id);
        if (!ko) {
          nichtGefunden(reply);
          return;
        }
        reply.code(200).send({
          koId: ko.id,
          aktuelleFassung: ko.version,
          gueltig: ko.status === "validiert",
          moeglicheEmpfaenger: await dienst.moeglicheEmpfaenger(ko),
          anforderungen: await dienst.uebersicht(ko),
        });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { id: string } }>("/api/kos/:id/kenntnisnahmen", async (request, reply) => {
      const user = await guards.requirePermission("ko.assign", request, reply);
      if (!user) {
        return;
      }
      const body = koerper(request);
      const fassung = fassungAus(body.fassung);
      const empfaenger = Array.isArray(body.empfaenger)
        ? body.empfaenger.filter((w): w is string => typeof w === "string" && w.length > 0)
        : null;
      const frist =
        body.frist === undefined || body.frist === null || body.frist === ""
          ? null
          : typeof body.frist === "string"
            ? body.frist
            : undefined;
      if (fassung === null || empfaenger === null || frist === undefined) {
        eingabeFehler(reply, "Fassung, Empfänger oder Frist fehlen oder sind ungültig.");
        return;
      }
      if (empfaenger.length > KENNTNISNAHME_MAX_EMPFAENGER) {
        eingabeFehler(reply, "Zu viele Empfänger in einer Anforderung.");
        return;
      }
      try {
        const ko = await sichtbaresKo(user, request.params.id);
        if (!ko) {
          nichtGefunden(reply);
          return;
        }
        const ergebnis = await dienst.anfordern(ko, { fassung, empfaenger, frist }, user.id);
        reply.code(ergebnis.angelegt ? 201 : 200).send(ergebnis);
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { anforderungId: string } }>(
      "/api/kenntnisnahmen/:anforderungId/erinnern",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.assign", request, reply);
        if (!user) {
          return;
        }
        try {
          const treffer = await dienst.anforderungMitKo(request.params.anforderungId);
          if (!treffer || !darfSehen(user, treffer.ko)) {
            nichtGefunden(reply);
            return;
          }
          const erinnert = await dienst.erinnern(treffer.anforderung, treffer.ko);
          reply.code(200).send({ erinnert });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get("/api/kenntnisnahmen/meine", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const namen = await dienst.kontoNamen();
        const eigene = (await dienst.eigene(user.id)).filter((e) => darfSehen(user, e.ko));
        reply.code(200).send({ eintraege: eigene.map((e) => alsEigene(e, namen)) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { anforderungId: string } }>(
      "/api/kenntnisnahmen/:anforderungId/bestaetigen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const fassung = fassungAus(koerper(request).fassung);
        if (fassung === null) {
          eingabeFehler(reply, "Die gelesene Fassung fehlt.");
          return;
        }
        try {
          // Nur die EIGENE Anforderung, und nur, solange der Eintrag sichtbar ist: eine fremde
          // Anforderung und ein inzwischen entzogener Zugriff antworten gleich — 404.
          const eigene = await dienst.eigeneZu(request.params.anforderungId, user.id);
          if (!eigene || !darfSehen(user, eigene.ko)) {
            nichtGefunden(reply);
            return;
          }
          const { eintrag, bereits } = await dienst.bestaetigen(eigene, fassung);
          reply.code(200).send({
            anforderungId: eintrag.anforderungId,
            fassung: eintrag.fassung,
            status: "bestaetigt",
            bestaetigtAm: eintrag.bestaetigtAm,
            bereits,
          });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}

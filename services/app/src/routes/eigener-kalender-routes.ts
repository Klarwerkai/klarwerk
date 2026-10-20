import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type EigenerKalenderDienst, KalenderFehler } from "../eigener-kalender";
import { type Guards, sendError } from "../http";

// ================================================================================================
// produkt:20261010:klara-eigener-kalender (AW-16) — DER EIGENE KALENDER, OHNE EXTERNEN DIENST.
// ================================================================================================
//
//   GET    /api/me/kalender                          — Ansicht: persönlich (Standard) oder Team
//   PUT    /api/me/kalender/einstellungen            — Sichtwahl: eigen, vorhanden oder beide
//   POST   /api/me/kalender/eintraege                — einen Eintrag anlegen
//   GET    /api/me/kalender/eintraege/:id            — einen Eintrag öffnen
//   PUT    /api/me/kalender/eintraege/:id            — einen Eintrag ändern (mit gesehener Fassung)
//   DELETE /api/me/kalender/eintraege/:id            — einen Eintrag löschen
//   POST   /api/me/kalender/eintraege/:id/folgen     — die Folgen einer Aktion zeigen (ändert nichts)
//   POST   /api/me/kalender/eintraege/:id/aktionen   — eine Aktion ausführen (nur bestätigt)
//
// Kein zusätzliches Recht über die Anmeldung hinaus: jeder angemeldete Mensch führt seinen eigenen
// Kalender. Das Konto kommt AUSSCHLIESSLICH aus der Sitzung; welche Einträge jemand sieht und
// steuert, entscheidet der Dienst mit HEUTIGEN Rechten (Konto, aktuelle Teammitgliedschaft,
// Sichtbarkeit der Quelle). Fremd und unbekannt antworten gleich (404).
//
// Ins Prüfprotokoll gehen nur EREIGNISSE mit Kennung und Bereich — nie Titel, Notiz oder Quelle.
// KEIN WEITERER WEG: diese Routen rufen kein Modell, versenden nichts und lösen nichts aus.

export const KALENDER_EINTRAG_ANGELEGT = "kalender.eintrag.angelegt";
export const KALENDER_EINTRAG_GEAENDERT = "kalender.eintrag.geaendert";
export const KALENDER_EINTRAG_GELOESCHT = "kalender.eintrag.geloescht";
export const KALENDER_EINTRAG_AKTION = "kalender.eintrag.aktion";
export const KALENDER_SICHT_GEWAEHLT = "kalender.sicht.gewaehlt";

export interface EigenerKalenderRoutenDeps {
  dienst: EigenerKalenderDienst;
  audit: AuditService;
}

const FEHLERCODE: Record<KalenderFehler["status"], string> = {
  400: "VALIDATION",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof KalenderFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

function rumpf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function ziel(id: string): string {
  return `kalender-eintrag:${id}`;
}

export function eigenerKalenderRoutes(
  deps: EigenerKalenderRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, audit } = deps;

  return async (app) => {
    app.get<{ Querystring: { bereich?: string; ausgeblendete?: string } }>(
      "/api/me/kalender",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const ansicht = await dienst.ansicht(
            user,
            request.query.bereich,
            request.query.ausgeblendete === "1",
          );
          reply.code(200).send(ansicht);
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put("/api/me/kalender/einstellungen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const einstellungen = await dienst.setzeEinstellungen(user, rumpf(request.body));
        await audit.record({
          actor: user.id,
          action: KALENDER_SICHT_GEWAEHLT,
          target: `kalender:${user.id}`,
          payload: { sichtmodus: einstellungen.sichtmodus },
        });
        reply.code(200).send({ einstellungen });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post("/api/me/kalender/eintraege", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const eintrag = await dienst.lege(user, rumpf(request.body));
        await audit.record({
          actor: user.id,
          action: KALENDER_EINTRAG_ANGELEGT,
          target: ziel(eintrag.id),
          payload: { bereich: eintrag.bereich, art: eintrag.art },
        });
        reply.code(201).send({ eintrag });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.get<{ Params: { id: string } }>(
      "/api/me/kalender/eintraege/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(200).send({ eintrag: await dienst.hole(user, request.params.id) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string } }>(
      "/api/me/kalender/eintraege/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const eintrag = await dienst.aendere(user, request.params.id, rumpf(request.body));
          await audit.record({
            actor: user.id,
            action: KALENDER_EINTRAG_GEAENDERT,
            target: ziel(eintrag.id),
            payload: { bereich: eintrag.bereich, fassung: eintrag.fassung },
          });
          reply.code(200).send({ eintrag });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // Löschen wirkt ZUERST, der Nachweis folgt — wie beim Klara-Gespräch.
    app.delete<{ Params: { id: string } }>(
      "/api/me/kalender/eintraege/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const weg = await dienst.loesche(user, request.params.id);
          await audit.record({
            actor: user.id,
            action: KALENDER_EINTRAG_GELOESCHT,
            target: ziel(weg.id),
            payload: { bereich: weg.bereich },
          });
          reply.code(200).send({ geloescht: 1 });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // Die Folgen VOR der Änderung: liest nur, schreibt nichts, protokolliert nichts.
    app.post<{ Params: { id: string } }>(
      "/api/me/kalender/eintraege/:id/folgen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const folgen = await dienst.folgen(user, request.params.id, rumpf(request.body).aktion);
          reply.code(200).send({ folgen });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/me/kalender/eintraege/:id/aktionen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const b = rumpf(request.body);
          const ergebnis = await dienst.handle(user, request.params.id, b.aktion, b.bestaetigt);
          await audit.record({
            actor: user.id,
            action: KALENDER_EINTRAG_AKTION,
            target: ziel(ergebnis.eintrag.id),
            payload: {
              aktion: ergebnis.folgen.aktion,
              betroffeneEintraege: ergebnis.folgen.betroffeneEintraege,
            },
          });
          reply.code(200).send(ergebnis);
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}

import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, sendError } from "../http";
import {
  GEDAECHTNIS_FRISTEN_TAGE,
  GEDAECHTNIS_STANDARD_FRIST_TAGE,
  GEDAECHTNIS_STANDARD_VERTRAULICHKEIT,
  type GedaechtnisDienst,
  type GedaechtnisEingabe,
  GedaechtnisFehler,
  type Gedaechtniseintrag,
} from "../interaktionsgedaechtnis";

// ================================================================================================
// R-0466 · DAS EIGENE GEDÄCHTNIS — VIER TÜREN, ALLE NUR FÜR DAS EIGENE KONTO.
// ================================================================================================
//
//   GET    /api/me/gedaechtnis        — die eigenen, nicht abgelaufenen Einträge
//   POST   /api/me/gedaechtnis        — eine Frage mit Antwort oder eine Vorliebe merken
//   DELETE /api/me/gedaechtnis/:id    — einen Eintrag löschen
//   DELETE /api/me/gedaechtnis        — das ganze eigene Gedächtnis löschen
//
// Das Konto kommt AUSSCHLIESSLICH aus der Sitzung (`user.id`), nie aus Pfad oder Rumpf. Ein fremder
// und ein unbekannter Eintrag antworten gleich (404). Kein zusätzliches Recht: wer angemeldet ist,
// führt sein eigenes Gedächtnis.
//
// Ins Prüfprotokoll gehen nur die EREIGNISSE — Kennung, Art, Herkunftsart, Vertraulichkeit, Frist —
// nie Frage, Antwort oder Vorliebe. Das Protokoll ist anhängend; ein Inhalt dort wäre nach dem
// Löschen nicht mehr zu entfernen.

export const GEDAECHTNIS_GEMERKT = "gedaechtnis.gemerkt";
export const GEDAECHTNIS_VERGESSEN = "gedaechtnis.vergessen";
export const GEDAECHTNIS_ALLES_VERGESSEN = "gedaechtnis.alles-vergessen";

export interface GedaechtnisRoutenDeps {
  dienst: GedaechtnisDienst;
  audit: AuditService;
}

const FEHLERCODE: Record<GedaechtnisFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof GedaechtnisFehler) {
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
function sicht(e: Gedaechtniseintrag) {
  return {
    id: e.id,
    art: e.art,
    inhalt: e.inhalt,
    antwort: e.antwort,
    herkunft: e.herkunft,
    vertraulichkeit: e.vertraulichkeit,
    aufbewahrungTage: e.aufbewahrungTage,
    angelegtAm: e.angelegtAm,
    verfallAm: e.verfallAm,
  };
}

export function gedaechtnisRoutes(deps: GedaechtnisRoutenDeps, guards: Guards): FastifyPluginAsync {
  const { dienst, audit } = deps;

  return async (app) => {
    app.get("/api/me/gedaechtnis", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const eintraege = await dienst.eigene(user.id);
        reply.code(200).send({
          eintraege: eintraege.map(sicht),
          fristenTage: GEDAECHTNIS_FRISTEN_TAGE,
          standardFristTage: GEDAECHTNIS_STANDARD_FRIST_TAGE,
          standardVertraulichkeit: GEDAECHTNIS_STANDARD_VERTRAULICHKEIT,
        });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Body: GedaechtnisEingabe }>("/api/me/gedaechtnis", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const body = request.body && typeof request.body === "object" ? request.body : {};
      try {
        const eintrag = await dienst.merken(user.id, body);
        await audit.record({
          actor: user.id,
          action: GEDAECHTNIS_GEMERKT,
          target: `gedaechtnis:${eintrag.id}`,
          payload: {
            art: eintrag.art,
            herkunft: eintrag.herkunft.art,
            vertraulichkeit: eintrag.vertraulichkeit,
            aufbewahrungTage: eintrag.aufbewahrungTage,
            verfallAm: eintrag.verfallAm,
          },
        });
        reply.code(201).send({ eintrag: sicht(eintrag) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    // Löschen wirkt ZUERST, der Nachweis folgt: ein nicht erreichbares Protokoll darf einen
    // gewünschten Löschvorgang nicht aufhalten.
    app.delete<{ Params: { id: string } }>("/api/me/gedaechtnis/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        if (!(await dienst.vergessen(user.id, request.params.id))) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Eintrag nicht gefunden." });
          return;
        }
        await audit.record({
          actor: user.id,
          action: GEDAECHTNIS_VERGESSEN,
          target: `gedaechtnis:${request.params.id}`,
        });
        reply.code(200).send({ geloescht: 1 });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.delete("/api/me/gedaechtnis", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const geloescht = await dienst.allesVergessen(user.id);
        await audit.record({
          actor: user.id,
          action: GEDAECHTNIS_ALLES_VERGESSEN,
          target: user.id,
          payload: { geloescht },
        });
        reply.code(200).send({ geloescht });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });
  };
}

// ================================================================================================
// R-1646 · AUSGANGSPRÜFUNG — der Controller sieht, was das Werk verlassen würde, und entscheidet.
// ================================================================================================
//
// RECHT: `ko.validate` — dieselben Rollen, die über den Beitrag anderer urteilen (controller,
// admin). Die Vorschau zeigt Frage- und Kandidatentexte, die gerade hinausgehen sollen; das ist
// Urteilsstoff, kein Leseweg für jede Rolle. Vertraulich eingestufte Inhalte erreichen diese Liste
// nie: der Chokepoint lehnt sie vor der Prüfung ab (`ConfidentialEgressError`).
//
// KEINE ABLAGE: die wartenden Aufrufe leben nur im Prozess, bis sie entschieden oder abgelaufen
// sind. Ins Prüfprotokoll geht die Entscheidung mit Metadaten (Empfänger, Zahl der Ersetzungen) —
// nie der Text.
//
// AUSGESCHALTET (`pruefung: null`): die Liste antwortet ehrlich mit `aktiv: false`, die beiden
// Entscheidungsrouten mit 404 — es gibt nichts zu entscheiden.
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { AusgangsEntscheidung, Ausgangspruefung } from "../../../reasoner";
import type { Guards } from "../http";

export interface AusgangspruefungRouteDienste {
  pruefung: Ausgangspruefung | null;
  audit?: AuditService;
}

async function entscheiden(
  dienste: AusgangspruefungRouteDienste,
  nutzer: string,
  id: string,
  entscheidung: AusgangsEntscheidung,
  reply: FastifyReply,
): Promise<void> {
  const entschieden = dienste.pruefung?.entscheide(id, entscheidung) ?? null;
  if (!entschieden) {
    reply.code(404).send({
      error: "NOT_FOUND",
      message: "Dieser Aufruf wartet nicht mehr — er wurde schon entschieden oder ist abgelaufen.",
    });
    return;
  }
  await dienste.audit?.record({
    actor: nutzer,
    action: entscheidung === "freigegeben" ? "ausgang.freigegeben" : "ausgang.abgelehnt",
    target: entschieden.id,
    payload: {
      anbieter: entschieden.anbieter,
      ersetzungen: entschieden.ersetzungen,
      bildUnveraendert: entschieden.bildUnveraendert,
    },
  });
  reply.code(200).send({ id: entschieden.id, entscheidung });
}

export function ausgangspruefungRoutes(
  dienste: AusgangspruefungRouteDienste,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    // Die wartenden Aufrufe mit dem Text, der hinausginge — Ersetzungen als eigene Abschnitte.
    app.get("/api/ausgangspruefung", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const pruefung = dienste.pruefung;
      reply
        .code(200)
        .send(
          pruefung
            ? { aktiv: true, wartezeitMs: pruefung.wartezeitMs, offen: pruefung.offene() }
            : { aktiv: false, wartezeitMs: null, offen: [] },
        );
    });

    app.post<{ Params: { id: string } }>(
      "/api/ausgangspruefung/:id/freigeben",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        await entscheiden(dienste, user.id, request.params.id, "freigegeben", reply);
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/ausgangspruefung/:id/ablehnen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        await entscheiden(dienste, user.id, request.params.id, "abgelehnt", reply);
      },
    );
  };
}

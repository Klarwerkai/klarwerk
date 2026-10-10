import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { PaarpflichtFehler, type PaarpflichtService } from "../../../conflicts";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import { type Guards, type SessionUser, sendError } from "../http";
import { PAARPFLICHT_PRUEFFASSUNG, type PaarpflichtAusfuehrung } from "../paarpflicht-ausfuehrung";
import { paarpflichtAussageVon } from "../paarpflicht-aussagen";
import { darfSehen } from "../sichtbarkeit";

// ================================================================================================
// AUFNAHME 20260922 · PAARPFLICHTEN-DAUERHAFT (G2) — DER EINSTIEG IN DEN AUSFÜHRUNGSWEG.
// ================================================================================================
//
// Ein Mensch wählt ausdrücklich die Aussagen eines Laufs; daraus entstehen alle ungeordneten
// Paarpflichten, gespeichert und im Hintergrund abgearbeitet. Es gibt KEINE Wahl „ganzer Bestand"
// und keinen automatischen Start (Nachtrag KW-DKP-00: keine Vollpaarprüfung).
//
// Rechte, unverändert übernommen: dasselbe Recht wie die gewählte Vollprüfung eines Objekts
// (`POST /api/kos/:id/ai-check`, `ko.validate`), dazu dieselbe Sichtregel wie die Lesewege
// (`darfSehen`). Eine nicht sichtbare Aussage antwortet wie eine fehlende (404) — ihr Dasein wird
// nicht verraten. Die Antworten tragen nur Kennungen und Zählwerte, keine Inhalte. Freigaben werden
// weder gelesen noch geschrieben.
//
//   POST /api/paarpflichten/laeufe                    { aussagen: string[] } → 202 { laufId, bilanz }
//   GET  /api/paarpflichten/laeufe/:laufId            → 200 { laufId, bilanz }
//   POST /api/paarpflichten/laeufe/:laufId/fortsetzen → 202 { laufId, bilanz }

export interface PaarpflichtRoutenDeps {
  ko: KoService;
  paarpflichten: PaarpflichtService;
  ausfuehrung: PaarpflichtAusfuehrung;
}

function nichtGefunden(reply: FastifyReply): void {
  reply.code(404).send({ error: "NOT_FOUND", message: "Aussage oder Lauf nicht gefunden." });
}

function auswahlAus(body: unknown): string[] | null {
  const roh = (body as { aussagen?: unknown } | undefined)?.aussagen;
  if (!Array.isArray(roh) || roh.length < 2) {
    return null;
  }
  const ids = roh.filter((id): id is string => typeof id === "string" && id.length > 0);
  return ids.length === roh.length && new Set(ids).size === ids.length ? ids : null;
}

async function sichtbareAussagen(
  ko: KoService,
  user: SessionUser,
  ids: readonly string[],
): Promise<KnowledgeObject[] | null> {
  const gefunden: KnowledgeObject[] = [];
  for (const id of ids) {
    const aussage = await ko.get(id);
    if (!aussage || !darfSehen(user, aussage)) {
      return null;
    }
    gefunden.push(aussage);
  }
  return gefunden;
}

export function paarpflichtenRoutes(
  deps: PaarpflichtRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { ko, paarpflichten, ausfuehrung } = deps;

  // Lauf vorhanden und jede seiner Aussagen für den Fragenden sichtbar?
  async function lesbarerLauf(laufId: string, user: SessionUser): Promise<boolean> {
    const kopf = await paarpflichten.laufkopf(laufId);
    if (!kopf) {
      return false;
    }
    const ids = kopf.aussagen.map((a) => a.refId);
    return (await sichtbareAussagen(ko, user, ids)) !== null;
  }

  return async (app) => {
    app.post("/api/paarpflichten/laeufe", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      try {
        const ids = auswahlAus(request.body);
        if (!ids) {
          reply.code(400).send({
            error: "PAARPFLICHT_AUSWAHL_UNGUELTIG",
            message: "Mindestens zwei verschiedene Aussagen-Kennungen angeben.",
          });
          return;
        }
        const gewaehlt = await sichtbareAussagen(ko, user, ids);
        if (!gewaehlt) {
          nichtGefunden(reply);
          return;
        }
        const bestand = await ko.pruefbestandStempel();
        const laufId = randomUUID();
        await paarpflichten.planen(
          laufId,
          gewaehlt.map((aussage) => paarpflichtAussageVon(aussage, bestand)),
          { bestand, pruefFassung: PAARPFLICHT_PRUEFFASSUNG },
        );
        ausfuehrung.anstossen(laufId);
        reply.code(202).send({ laufId, bilanz: await paarpflichten.bilanz(laufId) });
      } catch (error) {
        if (error instanceof PaarpflichtFehler) {
          reply.code(409).send({ error: error.code, message: error.message });
          return;
        }
        sendError(reply, error);
      }
    });

    app.get<{ Params: { laufId: string } }>(
      "/api/paarpflichten/laeufe/:laufId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          const { laufId } = request.params;
          if (!(await lesbarerLauf(laufId, user))) {
            nichtGefunden(reply);
            return;
          }
          reply.code(200).send({ laufId, bilanz: await paarpflichten.bilanz(laufId) });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // Setzt einen gespeicherten Lauf fort — z. B. wenn inzwischen ein Modell verfügbar ist. Was
    // schon geurteilt ist, wird nicht erneut vorgelegt.
    app.post<{ Params: { laufId: string } }>(
      "/api/paarpflichten/laeufe/:laufId/fortsetzen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          const { laufId } = request.params;
          if (!(await lesbarerLauf(laufId, user))) {
            nichtGefunden(reply);
            return;
          }
          ausfuehrung.anstossen(laufId);
          reply.code(202).send({ laufId, bilanz: await paarpflichten.bilanz(laufId) });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

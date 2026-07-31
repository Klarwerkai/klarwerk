import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import type { KoService } from "../../../knowledge-object";
import type { Guards } from "../http";
import { buildLiveWall } from "../livewall";
import { sichtbareFuer } from "../sichtbarkeit";

// Audit-P4 (SCRUM-398): Live-Wall — read-only Aggregation „frisch gesichert / hat heute
// geholfen" für Start-Karte (und später Beamer-Ansicht). Nur Lesen, keine Write-Route.
export interface LiveWallRoutesDeps {
  ko: KoService;
  audit: AuditService;
}

export function livewallRoutes(deps: LiveWallRoutesDeps, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/livewall", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const [kos, helpful] = await Promise.all([
        deps.ko.list(),
        deps.audit.list({ action: "answer.helpful" }),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      // AUFTRAG-mega74 BLOCK E: die Live-Wall nennt Titel UND Autor je Objekt (livewall.ts:42-48)
      // und zog ihre Grundmenge ungefiltert aus `ko.list()`. Gefiltert wird die GRUNDMENGE, nicht
      // das Ergebnis — sonst zählten unsichtbare Objekte in den Aggregaten weiter mit.
      reply.code(200).send(buildLiveWall({ kos: sichtbareFuer(user, kos), helpful, today }));
    });
  };
}

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
      const sichtbar = sichtbareFuer(user, kos);
      // JOB 1325 (G14, dritter Ausgabezweig): derselbe Satz galt bisher nur für `kos`. Der
      // `helped`-Zweig zog seine Titel aus dem `answer.helpful`-Audit, dessen Payload den ECHTEN
      // KO-Titel trägt (ask/service.ts:626) — und `livewall.ts:51` prüft davon nur den TYP, nicht
      // die Sichtbarkeit. Ein vertrauliches Objekt stand damit samt Titel in der Wall und zählte
      // in `helpedToday` mit. Der zweite Verbraucher desselben Stroms filtert längst
      // (notifications-routes.ts:45); hier fehlte es. Auch das ist die GRUNDMENGE, nicht das
      // Ergebnis — `helpedToday` (livewall.ts:57) zählt dadurch von selbst richtig.
      const sichtbareIds = new Set(sichtbar.map((ko) => ko.id));
      reply.code(200).send(
        buildLiveWall({
          kos: sichtbar,
          helpful: helpful.filter((e) => sichtbareIds.has(e.target)),
          today,
        }),
      );
    });
  };
}

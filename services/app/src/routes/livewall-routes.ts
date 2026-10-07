import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import type { KoService } from "../../../knowledge-object";
import type { Guards } from "../http";
import {
  LIVEWALL_WIDERRUF,
  LIVEWALL_ZUSTIMMUNG,
  buildLiveWall,
  zustimmendeKonten,
} from "../livewall";
import { sichtbareFuer } from "../sichtbarkeit";

// Audit-P4 (SCRUM-398): Live-Wall — read-only Aggregation „frisch gesichert / hat heute
// geholfen" für Start-Karte (und später Beamer-Ansicht). Nur Lesen, keine Write-Route.
//
// PMO-FEA-0003: dazu die Zustimmung zur Namensnennung — die einzige Schreibroute hier, und sie
// betrifft ausschließlich das EIGENE Konto (Nutzer aus der Sitzung, nie aus Pfad oder Körper).
export interface LiveWallRoutesDeps {
  ko: KoService;
  audit: AuditService;
  // Anzeigenamen der Konten. Optional: fehlt die Quelle, nennt die Wand niemanden.
  konten?: () => Promise<Array<{ id: string; name: string }>>;
}

async function zustimmungsEreignisse(audit: AuditService) {
  const [ja, nein] = await Promise.all([
    audit.list({ action: LIVEWALL_ZUSTIMMUNG }),
    audit.list({ action: LIVEWALL_WIDERRUF }),
  ]);
  return [...ja, ...nein];
}

export function livewallRoutes(deps: LiveWallRoutesDeps, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/livewall", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const [kos, helpful, zustimmung] = await Promise.all([
        deps.ko.list(),
        deps.audit.list({ action: "answer.helpful" }),
        zustimmungsEreignisse(deps.audit),
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
      // PMO-FEA-0003: Namen nur für Konten, deren JÜNGSTE Erklärung eine Zustimmung ist. Der
      // `validated`-Zweig entsteht aus `sichtbar` — die Sichtrechte gelten dort unverändert.
      const ja = zustimmendeKonten(zustimmung);
      const namen = new Map<string, string>();
      if (ja.size > 0 && deps.konten) {
        for (const konto of await deps.konten()) {
          if (ja.has(konto.id) && konto.name) {
            namen.set(konto.id, konto.name);
          }
        }
      }
      reply.code(200).send(
        buildLiveWall({
          kos: sichtbar,
          helpful: helpful.filter((e) => sichtbareIds.has(e.target)),
          today,
          zugestimmt: namen,
        }),
      );
    });

    // Der eigene Stand: hat dieses Konto der Namensnennung auf der Wand zugestimmt?
    app.get("/api/livewall/consent", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const ja = zustimmendeKonten(await zustimmungsEreignisse(deps.audit));
      reply.code(200).send({ nameConsent: ja.has(user.id) });
    });

    // Zustimmen (`true`) oder widerrufen (`false`). Freiwillig, jederzeit umkehrbar; beides ist
    // ein Ereignis im Prüfprotokoll, und der Widerruf wirkt beim nächsten Abruf der Wand.
    app.put<{ Body: { nameConsent?: unknown } }>(
      "/api/livewall/consent",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        const wert = request.body?.nameConsent;
        if (typeof wert !== "boolean") {
          reply
            .code(400)
            .send({ error: "BAD_REQUEST", message: "nameConsent muss true oder false sein." });
          return;
        }
        await deps.audit.record({
          actor: user.id,
          action: wert ? LIVEWALL_ZUSTIMMUNG : LIVEWALL_WIDERRUF,
          target: user.id,
        });
        reply.code(200).send({ nameConsent: wert });
      },
    );
  };
}

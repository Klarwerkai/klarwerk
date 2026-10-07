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
import {
  LIVEWALL_FOTO_MAX_ZEICHEN,
  type LiveWallFotoRepo,
  istZulaessigesFoto,
} from "../livewall-fotos";
import { sichtbareFuer } from "../sichtbarkeit";

// Audit-P4 (SCRUM-398): Live-Wall — read-only Aggregation „frisch gesichert / hat heute
// geholfen" für Start-Karte und Beamer-Ansicht (`/livewall`, dieselbe Antwort).
//
// PMO-FEA-0003: dazu die Zustimmung zur Namensnennung und das freiwillige Foto — die einzigen
// Schreibrouten hier, und sie betreffen ausschließlich das EIGENE Konto (Nutzer aus der Sitzung,
// nie aus Pfad oder Körper).
export interface LiveWallRoutesDeps {
  ko: KoService;
  audit: AuditService;
  // Anzeigenamen der Konten. Optional: fehlt die Quelle, nennt die Wand niemanden und zeigt kein
  // Foto — ein Foto erscheint nur für ein Konto, das es noch gibt.
  konten?: () => Promise<Array<{ id: string; name: string }>>;
  // Die freiwilligen Fotos. Optional: fehlt die Ablage, zeigt die Wand keine Fotos.
  fotos?: LiveWallFotoRepo;
}

export const LIVEWALL_FOTO_GESETZT = "livewall.photo-consent-granted";
export const LIVEWALL_FOTO_WIDERRUFEN = "livewall.photo-consent-revoked";

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
      // PMO-FEA-0003: Namen nur für Konten, deren JÜNGSTE Erklärung eine Zustimmung ist; Fotos nur
      // für Konten, die selbst eines hinterlegt haben. Beides nur für Autorinnen/Autoren SICHTBARER
      // validierter Einträge — der `validated`-Zweig entsteht aus `sichtbar`, und nach Fotos wird
      // nur für genau diese Konten gefragt. Ein gelöschtes Konto bekommt weder Name noch Foto.
      const ja = zustimmendeKonten(zustimmung);
      const autoren = [
        ...new Set(sichtbar.filter((ko) => ko.status === "validiert").map((ko) => ko.author)),
      ];
      const namen = new Map<string, string>();
      const fotos = new Map<string, string>();
      if (deps.konten && autoren.length > 0) {
        const bestehend = new Map((await deps.konten()).map((k) => [k.id, k.name]));
        for (const id of autoren) {
          const name = bestehend.get(id);
          if (ja.has(id) && name) {
            namen.set(id, name);
          }
        }
        if (deps.fotos) {
          const kandidaten = autoren.filter((id) => bestehend.has(id));
          for (const [id, foto] of await deps.fotos.lies(kandidaten)) {
            fotos.set(id, foto);
          }
        }
      }
      reply.code(200).send(
        buildLiveWall({
          kos: sichtbar,
          helpful: helpful.filter((e) => sichtbareIds.has(e.target)),
          today,
          zugestimmt: namen,
          fotos,
        }),
      );
    });

    // Der eigene Stand: Namenszustimmung und — falls hinterlegt — das eigene Foto zur Vorschau.
    app.get("/api/livewall/consent", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const ja = zustimmendeKonten(await zustimmungsEreignisse(deps.audit));
      const eigenes = deps.fotos ? (await deps.fotos.lies([user.id])).get(user.id) : undefined;
      reply.code(200).send({
        nameConsent: ja.has(user.id),
        photoConsent: eigenes !== undefined,
        ...(eigenes ? { photo: eigenes } : {}),
      });
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

    // Das eigene Foto hinterlegen — das Hochladen IST die Zustimmung. Nur Rasterbilder als
    // Daten-URL (PNG/JPEG/WebP), begrenzt; ins Prüfprotokoll geht das Ereignis, nicht das Bild.
    app.put<{ Body: { photo?: unknown } }>("/api/livewall/photo", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      if (!deps.fotos) {
        reply.code(503).send({ error: "UNAVAILABLE", message: "Keine Fotoablage verfügbar." });
        return;
      }
      const foto = request.body?.photo;
      if (!istZulaessigesFoto(foto)) {
        reply.code(400).send({
          error: "BAD_REQUEST",
          message: `photo muss ein PNG-, JPEG- oder WebP-Bild als Daten-URL bis ${LIVEWALL_FOTO_MAX_ZEICHEN} Zeichen sein.`,
        });
        return;
      }
      await deps.audit.record({ actor: user.id, action: LIVEWALL_FOTO_GESETZT, target: user.id });
      await deps.fotos.setze(user.id, foto, new Date().toISOString());
      reply.code(200).send({ photoConsent: true });
    });

    // Widerruf: die Bilddaten werden GELÖSCHT, nicht nur ausgeblendet.
    app.delete("/api/livewall/photo", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      if (deps.fotos) {
        await deps.fotos.entferne(user.id);
      }
      await deps.audit.record({
        actor: user.id,
        action: LIVEWALL_FOTO_WIDERRUFEN,
        target: user.id,
      });
      reply.code(200).send({ photoConsent: false });
    });
  };
}

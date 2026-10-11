// ================================================================================================
// ADMIN-12 · KOMMUNIKATIONSREGELN — DIE TÜREN (`kommunikationsregeln.ts`).
// ================================================================================================
//
// RECHTE NACH DER BESTEHENDEN KONTOREGEL, KEINE NEUE ROLLE:
//   · Die Übersicht (Ereignis, Zielgruppe, Kanäle, Häufigkeit, Abwahl) und die EIGENEN
//     Einstellungen: jedes angemeldete Konto (`requireUser`). Wer Meldungen bekommt, soll lesen
//     können, nach welcher Regel.
//   · Unternehmensweite Vorgaben ändern und ihre Fassungen einsehen: `users.manage` — dieselbe
//     Schranke wie Unternehmensprofil und Markenwahl.
//
// JEDE ÄNDERUNG WIRD PROTOKOLLIERT: eine Vorgabe als neue Fassung UND als Eintrag
// `kommunikationsregeln.geaendert` im Prüfprotokoll; die eigene Abwahl als
// `meldungsregel.persoenlich`. Ins Protokoll kommen Ereignis, Feld und Werte — keine Inhalte.
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { can } from "../../../rbac";
import type { Guards } from "../http";
import { type KommunikationDienst, KommunikationFehler } from "../kommunikationsregeln";

export interface KommunikationRouteDienste {
  dienst: KommunikationDienst;
  audit?: AuditService;
}

function fehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof KommunikationFehler) {
    reply.code(e.status).send({ ...e.extra, error: e.code, message: e.message });
    return;
  }
  throw e;
}

export function kommunikationRoutes(
  dienste: KommunikationRouteDienste,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst } = dienste;
  return async (app) => {
    // Die zentrale Übersicht samt geltender Unternehmensvorgabe — für jedes angemeldete Konto.
    app.get("/api/kommunikation/regeln", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({
        darfAendern: can(user.role, "users.manage"),
        ...(await dienst.uebersicht()),
      });
    });

    // Unternehmensvorgabe ändern — eine NEUE Fassung. `version` nennt die zuletzt gesehene.
    app.put<{ Body: unknown }>("/api/admin/kommunikation/regeln", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        const { vorher, nachher, aenderungen } = await dienst.speichern(request.body, user.id);
        if (aenderungen.length > 0) {
          await dienste.audit?.record({
            actor: user.id,
            action: "kommunikationsregeln.geaendert",
            target: "kommunikationsregeln",
            payload: { vorherVersion: vorher.version, version: nachher.version, aenderungen },
          });
        }
        reply.code(200).send({
          geaendert: aenderungen.length > 0,
          darfAendern: true,
          ...(await dienst.uebersicht()),
        });
      } catch (e) {
        fehler(reply, e);
      }
    });

    // Alle Fassungen der Unternehmensvorgabe, neueste zuerst — lesend, ohne Löschweg.
    app.get("/api/admin/kommunikation/fassungen", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ fassungen: await dienst.fassungen() });
    });

    // Die eigenen Einstellungen — je Ereignis, mit dem, was gerade wirkt.
    app.get("/api/meldungsregeln/meine", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ zeilen: await dienst.persoenlich(user.id) });
    });

    // Die eigene Abwahl ändern — nur für sich selbst, nur wo die Vorgabe sie erlaubt.
    app.put<{ Body: unknown }>("/api/meldungsregeln/meine", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const zeilen = await dienst.persoenlichSetzen(user.id, request.body);
        const body = request.body as { ereignis: string; abgewaehlt: boolean };
        await dienste.audit?.record({
          actor: user.id,
          action: "meldungsregel.persoenlich",
          target: user.id,
          payload: { ereignis: body.ereignis, abgewaehlt: body.abgewaehlt },
        });
        reply.code(200).send({ zeilen });
      } catch (e) {
        fehler(reply, e);
      }
    });
  };
}

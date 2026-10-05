import type { FastifyPluginAsync } from "fastify";
import type { AuditFilter, AuditService } from "../../../audit";
import type { Guards } from "../http";

/** Wer die Befunde (Konflikte, Überschneidungen) eines Objekts kennt — nur deren Kennungen. */
export interface BefundKennungen {
  idsForKo(koId: string): Promise<string[]>;
}

// Audit-Log (§2.4 / FR-AUD). Governance-Einsicht: Controller/Admin (ko.validate-Recht).
export function auditRoutes(
  audit: AuditService,
  guards: Guards,
  befunde: readonly BefundKennungen[] = [],
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: AuditFilter }>("/api/audit", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await audit.list(request.query));
    });

    // SCRUM-439: aktive Integritätsprüfung der Audit-Kette (verify statt nur Aussage). Governance-
    // Einsicht wie /api/audit (ko.validate). Antwort: { ok, count } — Grundlage des Admin-Knopfs.
    app.get("/api/audit/verify", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await audit.verifyReport());
    });

    // R-0766 (Aufnahme gesamt-auditprotokoll, Lauf 2): die Kennungen der Konflikte und
    // Überschneidungen eines Objekts — offen und abgeschlossen. Die Kette am Objekt (`koAuditEvents`)
    // ordnet damit auch Altbelege zu, die das Objekt nicht selbst nennen. Nur Kennungen, die im
    // Protokoll ohnehin als Ziel stehen; deshalb dieselbe Tür wie `/api/audit`.
    app.get<{ Params: { koId: string } }>(
      "/api/audit/ko/:koId/findings",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        const ids = new Set<string>();
        for (const quelle of befunde) {
          for (const id of await quelle.idsForKo(request.params.koId)) {
            ids.add(id);
          }
        }
        reply.code(200).send({ ids: [...ids] });
      },
    );

    // R-0613: die Kette als Datei — Einträge, Prüfbericht und Kopf (letzte Sequenz + Hash) für die
    // Ablage außerhalb der Datenbank. Dieselbe Einsichtsstufe wie `/api/audit`, das dieselben
    // Einträge ohnehin vollständig ausgibt. Der Abruf selbst wird als `audit.exported` angehängt.
    //
    // FR-AUD-02: unter `/api/audit` gibt es ausschließlich GET-Wege. Ein POST/PUT/PATCH/
    // DELETE ist nirgends registriert — `tests/audit-gesamt/append-only-http.test.ts` misst das.
    app.get("/api/audit/export", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const datei = await audit.exportChain(user.id);
      const stempel = datei.exportedAt.replace(/[:.]/g, "-");
      reply
        .header("content-disposition", `attachment; filename="klarwerk-audit-${stempel}.json"`)
        .code(200)
        .send(datei);
    });
  };
}

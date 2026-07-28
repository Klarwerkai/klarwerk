import type { FastifyPluginAsync } from "fastify";
import type { ModelRunRecord, ModelRunService } from "../../../model-runs";
import { can } from "../../../rbac";
import type { Guards } from "../http";

// mega26 Block A — GOVERNANCE-PARITÄT DES LAUFKONTEXTS.
//
// Diese Route steht auf `ko.read`, also auf der breitesten Lesestufe. Der mit mega26 hinzugekommene
// Laufkontext (`actor`, `subject`) ist aber genau die Art Aussage, die das Audit-Log trägt — „wer
// hat wann was an welchem Objekt getan" —, und `/api/audit` steht bewusst auf der HÖHEREN Stufe
// `ko.validate` (`services/app/src/routes/audit-routes.ts:9`).
//
// Den neuen Bezug unter diesem Niveau auszuliefern, wäre eine neue Offenlegung durch die Hintertür:
// jeder Lesende könnte ablesen, welcher Kollege wann an welchem Wissensobjekt eine KI-Extraktion
// gefahren hat. Deshalb wird der Kontext an GENAU der Stufe sichtbar, die auch das Audit regelt.
//
// Für alle anderen bleibt die Antwort FELDGLEICH zu vor mega26 — es fällt nichts weg, was es vorher
// gab, und es kommt nichts hinzu, was das Audit nicht ohnehin zeigte.
export function projectModelRunForReader(
  record: ModelRunRecord,
  maySeeContext: boolean,
): ModelRunRecord {
  if (maySeeContext) {
    return record;
  }
  const { actor: _actor, subject: _subject, ...rest } = record;
  return rest;
}

// SCRUM-165: read-only Einsicht in jüngste ModelRuns (Betrieb/QM). Nur Metadaten —
// keine Prompt-/Antworttexte. Limit defensiv im Service normalisiert. Keine Write-Route.
export function modelRunRoutes(service: ModelRunService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: { limit?: string } }>("/api/model-runs", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const raw = request.query.limit;
      const limit = raw !== undefined ? Number(raw) : undefined;
      const records = await service.recent(limit);
      // mega26 Block A: der Laufkontext nur an der Audit-Stufe (s. o.). Die Prüfung ist REIN
      // (kein zweiter Guard, keine zweite Antwort) — der `ko.read`-Guard oben bleibt der einzige,
      // der über Zugang entscheidet.
      const maySeeContext = can(user.role, "ko.validate");
      reply.code(200).send(records.map((r) => projectModelRunForReader(r, maySeeContext)));
    });
  };
}

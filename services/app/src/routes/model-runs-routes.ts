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

    // Aufnahme gesamt-ki-laufprotokoll (V9, R-2071): Auswertung eines Zeitraums — Läufe, Fehler,
    // Rückfälle, Dauer, Token und Kosten je Währung, je Aufgabenart. Nur Summen und Zähler: kein
    // Anfragender, kein Gegenstand, kein Fehlertext — deshalb dieselbe Lesestufe wie die Liste.
    app.get<{ Querystring: { von?: string; bis?: string } }>(
      "/api/model-runs/auswertung",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const zeitraum = leseZeitraum(request.query.von, request.query.bis, new Date());
        if ("fehler" in zeitraum) {
          reply.code(400).send({ error: "BAD_REQUEST", message: zeitraum.fehler });
          return;
        }
        const auswertung = await service.auswertung(zeitraum.von, zeitraum.bis);
        reply.code(200).send({ auswertung, preisgrundlage: service.preisgrundlage() });
      },
    );
  };
}

/** Vorgabe ohne Angabe: die letzten 30 Tage. Längster Zeitraum: 366 Tage. */
const AUSWERTUNG_VORGABE_TAGE = 30;
const AUSWERTUNG_MAX_TAGE = 366;
const TAG_MS = 24 * 60 * 60 * 1000;

// Liest `von`/`bis` als Zeitpunkte (ISO 8601) und gibt sie normalisiert (`toISOString`) zurück —
// in genau der Form, in der die Läufe ihren Start speichern; nur so stimmt der Textvergleich.
export function leseZeitraum(
  von: string | undefined,
  bis: string | undefined,
  jetzt: Date,
): { von: string; bis: string } | { fehler: string } {
  const bisMs = bis === undefined ? jetzt.getTime() : Date.parse(bis);
  if (Number.isNaN(bisMs)) {
    return { fehler: "`bis` ist kein gültiger Zeitpunkt (ISO 8601)." };
  }
  const vonMs = von === undefined ? bisMs - AUSWERTUNG_VORGABE_TAGE * TAG_MS : Date.parse(von);
  if (Number.isNaN(vonMs)) {
    return { fehler: "`von` ist kein gültiger Zeitpunkt (ISO 8601)." };
  }
  if (vonMs >= bisMs) {
    return { fehler: "`von` muss vor `bis` liegen." };
  }
  if (bisMs - vonMs > AUSWERTUNG_MAX_TAGE * TAG_MS) {
    return { fehler: `Der Zeitraum darf höchstens ${AUSWERTUNG_MAX_TAGE} Tage umfassen.` };
  }
  return { von: new Date(vonMs).toISOString(), bis: new Date(bisMs).toISOString() };
}

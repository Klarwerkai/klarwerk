import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { type Guards, sendError } from "../http";
import {
  type KiArbeitsbegleitungDienst,
  KiArbeitsbegleitungFehler,
} from "../ki-arbeitsbegleitung-dienst";
import { KlaraGespraechFehler } from "../klara-gespraech";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

// ================================================================================================
// BPA-13 (produkt:20261011:assistenz-ki-arbeitsbegleitung) — MIT EINER AUSGEWÄHLTEN KI IM RICHTIGEN
// KONTEXT ARBEITEN, AM EIGENEN KLARA-GESPRÄCH.
// ================================================================================================
//
//   GET  /api/me/klara/ki-faehigkeiten                                 — Fähigkeiten und Lage
//   POST /api/me/klara/ki-verbindung/:anbieter/pruefen                 — echte Probe (users.manage)
//   GET  /api/me/klara/gespraeche/:id/ki-auftraege                     — Aufträge des Gesprächs
//   POST /api/me/klara/gespraeche/:id/ki-auftraege                     — Auftrag vorbereiten
//   POST /api/me/klara/gespraeche/:id/ki-auftraege/:jobId/uebergabe    — übergeben / wiederaufnehmen
//   POST /api/me/klara/gespraeche/:id/ki-auftraege/:jobId/ergebnis     — Ergebnis zurückgeben
//   POST /api/me/klara/gespraeche/:id/ki-auftraege/:jobId/unterbrechen
//   POST /api/me/klara/gespraeche/:id/ki-auftraege/:jobId/stopp
//   POST /api/me/klara/gespraeche/:id/ki-auftraege/:jobId/freigabe-schliessen
//   POST /api/me/klara/gespraeche/:id/ki-auftraege/:jobId/neu-binden
//   POST /api/me/klara/gespraeche/:id/ki-auftraege/:jobId/codex       — Codex-Ergebnis anwenden
//   POST /api/me/klara/gespraeche/:id/ki-vergleich                     — zwei Ergebnisse vergleichen
//
// Das Konto kommt AUSSCHLIESSLICH aus der Sitzung; ein fremdes und ein unbekanntes Gespräch
// antworten gleich (404). Die Sichtbarkeit jeder Quelle entscheidet die EINE Regel
// (`sichtbarkeitsfilterFuer` aus `sichtbarkeit.ts`), an jeder Route frisch gebildet und an den
// Dienst gereicht. Inhalte gehen nicht ins Prüfprotokoll; Jobstand und Belege stehen im Verlauf.

export interface KiArbeitsbegleitungRoutenDeps {
  dienst: KiArbeitsbegleitungDienst;
}

const FEHLERCODE: Record<400 | 404 | 409, string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof KiArbeitsbegleitungFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
      ...(fehler.details !== undefined ? { details: fehler.details } : {}),
    });
    return;
  }
  if (fehler instanceof KlaraGespraechFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

function rumpf<T>(body: unknown): T {
  return (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as T;
}

type GParams = { Params: { id: string } };
type JParams = { Params: { id: string; jobId: string } };

export function kiArbeitsbegleitungRoutes(
  deps: KiArbeitsbegleitungRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst } = deps;

  return async (app) => {
    app.get("/api/me/klara/ki-faehigkeiten", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(dienst.faehigkeiten());
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { anbieter: string } }>(
      "/api/me/klara/ki-verbindung/:anbieter/pruefen",
      async (request, reply) => {
        // Dieselbe Regel wie die vorhandene Anbieterprobe (`reasoner-routes.ts`): ein echter
        // Modellaufruf, deshalb nur mit `users.manage`.
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(200).send(await dienst.pruefeVerbindung(request.params.anbieter));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get<GParams>("/api/me/klara/gespraeche/:id/ki-auftraege", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
        const auftraege = await dienst.liste(wer, request.params.id);
        reply.code(200).send({ auftraege });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<GParams>("/api/me/klara/gespraeche/:id/ki-auftraege", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
        const auftrag = await dienst.bereite(wer, request.params.id, rumpf(request.body));
        reply.code(201).send({ auftrag });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<JParams>(
      "/api/me/klara/gespraeche/:id/ki-auftraege/:jobId/uebergabe",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
          const b = rumpf<{ erneutSendenBestaetigt?: unknown }>(request.body);
          const ergebnis = await dienst.uebergib(wer, request.params.id, request.params.jobId, {
            erneutSendenBestaetigt: b.erneutSendenBestaetigt === true,
          });
          reply.code(200).send(ergebnis);
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<JParams>(
      "/api/me/klara/gespraeche/:id/ki-auftraege/:jobId/ergebnis",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
          const auftrag = await dienst.ergebnis(
            wer,
            request.params.id,
            request.params.jobId,
            rumpf(request.body),
          );
          reply.code(200).send({ auftrag });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<JParams>(
      "/api/me/klara/gespraeche/:id/ki-auftraege/:jobId/unterbrechen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
          const b = rumpf<{ teilergebnis?: unknown }>(request.body);
          const auftrag = await dienst.unterbrich(
            wer,
            request.params.id,
            request.params.jobId,
            b.teilergebnis,
          );
          reply.code(200).send({ auftrag });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<JParams>(
      "/api/me/klara/gespraeche/:id/ki-auftraege/:jobId/stopp",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
          const { sicht, text } = await dienst.stoppe(wer, request.params.id, request.params.jobId);
          reply.code(200).send({ auftrag: sicht, text });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<JParams>(
      "/api/me/klara/gespraeche/:id/ki-auftraege/:jobId/freigabe-schliessen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
          const b = rumpf<{ quelleId?: unknown }>(request.body);
          const auftrag = await dienst.schliesseFreigabe(
            wer,
            request.params.id,
            request.params.jobId,
            b.quelleId,
          );
          reply.code(200).send({ auftrag });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<JParams>(
      "/api/me/klara/gespraeche/:id/ki-auftraege/:jobId/neu-binden",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
          const auftrag = await dienst.bindeNeu(wer, request.params.id, request.params.jobId);
          reply.code(201).send({ auftrag });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<JParams>(
      "/api/me/klara/gespraeche/:id/ki-auftraege/:jobId/codex",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
          const auftrag = await dienst.wendeCodexAn(
            wer,
            request.params.id,
            request.params.jobId,
            rumpf(request.body),
          );
          reply.code(200).send({ auftrag });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<GParams>("/api/me/klara/gespraeche/:id/ki-vergleich", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const wer = { user, sichtbar: sichtbarkeitsfilterFuer(user) };
        const zeilen = await dienst.vergleiche(wer, request.params.id, rumpf(request.body));
        reply.code(200).send({ zeilen });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });
  };
}

import type { FastifyPluginAsync } from "fastify";
import type { AiCheck, KoService } from "../../../knowledge-object";
import { type BoardFilter, type ValidationService, mitHerkunft } from "../../../validation";
import { type AiCheckWorker, shouldReEnqueueAiCheck } from "../ai-check-worker";
import { type Guards, sendError } from "../http";
import { sichtbareFuer, sichtbarkeitsfilterFuer } from "../sichtbarkeit";

// WP-SUBMIT-ASYNC (Neustart-Robustheit, pragmatisch + ehrlich): der Prüf-Worker hält seine Queue
// NUR im Speicher — nach einem Prozess-Neustart wäre ein pending-Job verloren. Beim Laden der
// Validierungs-Liste werden deshalb festhängende pending-KOs (requestedAt älter als
// AI_CHECK_STALE_PENDING_MS) LAZY neu eingereiht; markAiCheckPending frischt requestedAt auf,
// damit nicht jeder Board-Load erneut einreiht. GRENZE (bewusst, kein Cron/keine neue Infra):
// wird das Board nie geladen, bleibt ein verwaister Job ehrlich als pending sichtbar liegen.
export interface ValidationAiCheckDeps {
  ko: KoService;
  worker: AiCheckWorker;
}

// Validierungs-Leseansichten (§2.3). Bewerten/Zuweisen laufen über den KO-Dispatcher.
export function validationRoutes(
  validation: ValidationService,
  guards: Guards,
  aiCheck?: ValidationAiCheckDeps,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: BoardFilter }>("/api/validation/board", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // AUFTRAG-mega74 BLOCK E: `validation.board()` gibt VOLLE Wissensobjekte aus
      // (validation/src/service.ts:185-215) — Titel, Kernaussage, alles. Das Prüf-Board war damit
      // ein vollwertiger Lesepfad ohne Tor. Gefiltert wird VOR dem Re-Enqueue unten, damit die
      // Route über ein unsichtbares Objekt auch keine Arbeit auslöst.
      const board = sichtbareFuer(user, await validation.board(request.query));
      if (aiCheck) {
        const nowMs = Date.now();
        for (const item of board as { id: string; aiCheck?: AiCheck }[]) {
          if (shouldReEnqueueAiCheck(item.aiCheck, nowMs) && !aiCheck.worker.has(item.id)) {
            await aiCheck.ko.markAiCheckPending(item.id);
            // WP-SHIP8-CLOSE-2 (bens F3): den FRISCHEN Vermerk nachlesen — item.aiCheck ist der
            // veraltete Stand vor dem Re-Enqueue; der Job trägt die Zielversion synchron.
            const marked = await aiCheck.ko.get(item.id);
            aiCheck.worker.enqueue(item.id, marked?.aiCheck?.koVersion);
          }
        }
      }
      // ==========================================================================================
      // JOB 3003 · STATION 4 — STUFE UND HERKUNFT, UND EIN FEHLEN HEISST FEHLEN.
      // ==========================================================================================
      //
      // Bis hierher trug diese Route keinen einzigen Bezug auf Vertraulichkeit oder Herkunft. Wer
      // validiert, sah Titel, Kernaussage, Stimmen und Zuweisungen — aber nicht, wie vertraulich das
      // Objekt ist und woher es kommt. Beide Felder stehen am Wissensobjekt schon; sie sind dort nur
      // OPTIONAL, und ein nicht gesetztes optionales Feld fehlt im JSON vollstaendig.
      //
      // WARUM `null` MIT `confidentialityProvenance: "unknown"` UND NICHT DAS WEGGELASSENE FELD: ein
      // fehlender Schluessel ist fuer den, der davorsitzt, nicht unterscheidbar von „die Route
      // liefert das nicht" — er muesste raten. Derselbe Grundsatz steht im Produkt schon
      // ausgeschrieben, nur nicht auf diesem Lesepfad: `search-projection.ts:691-698` — „Weggelassen
      // heisst AUSDRUECKLICH unbestaetigt … nie eine stillschweigend als `verified` gehashte
      // Aussage." Die vollstaendige Begruendung samt Grenzen steht in
      // `services/validation/src/board-herkunft.ts`.
      //
      // DIE REIHENFOLGE IST DER SCHUTZ: `sichtbareFuer` steht OBEN, VOR dieser Zeile. Die
      // Anreicherung erweitert vorhandene Zeilen und legt keine an; ein unsichtbares Objekt bleibt
      // damit vollstaendig weg statt als Zeile mit `null`-Feldern zu erscheinen — schon die Zeile
      // waere eine Existenzauskunft (JOB 1510 / G1). Es ist eine reine Lese-Sicht: kein neues
      // Datenmodell, keine Persistenz, kein Backfill, und `/api/validation/overview` bleibt
      // unberuehrt.
      reply.code(200).send(board.map((ko) => mitHerkunft(ko)));
    });

    app.get("/api/validation/overview", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // AUFTRAG-mega76 BLOCK D: die Personenzeilen rechnen über den SICHTBAREN Zuweisungen.
      reply.code(200).send(await validation.overview({ sichtbar: sichtbarkeitsfilterFuer(user) }));
    });

    // SCRUM-395: Standard-Prüferanzahl. Lesen dürfen alle Leseberechtigten (die
    // Erfassen-Seite zeigt den Standard an); ändern darf nur die Nutzerverwaltung.
    app.get("/api/validation/settings", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply
          .code(200)
          .send({ defaultNeededValidations: await validation.defaultNeededValidations() });
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.put<{ Body: { defaultNeededValidations?: number } }>(
      "/api/validation/settings",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const saved = await validation.setDefaultNeededValidations(
            request.body?.defaultNeededValidations,
            user.id,
          );
          reply.code(200).send({ defaultNeededValidations: saved });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

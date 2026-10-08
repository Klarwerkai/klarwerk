import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { OverlapService } from "../../../conflicts";
import type { AiCheck, KantenRepo, KoService } from "../../../knowledge-object";
import { type BoardFilter, type ValidationService, mitHerkunft } from "../../../validation";
import { type AiCheckWorker, shouldReEnqueueAiCheck } from "../ai-check-worker";
import { type Guards, type SessionUser, sendError } from "../http";
import {
  type KoSichtbarkeitsZugang,
  sichtbareFuer,
  sichtbarePaare,
  sichtbarkeitsfilterFuer,
} from "../sichtbarkeit";

// ================================================================================================
// R-0247 — OFFENE DUBLETTE: WEICHE SPERRE AM SERVER (Pedis Entscheidung 73b53301).
// ================================================================================================
//
// Liegt zu einem Wissensobjekt eine offene, unentschiedene Dublette vor (Status nicht
// „geschlossen", versionsgebunden über `OverlapService.unresolved`), wird es nur validiert, wenn
// der Aufruf das Bestätigungskennzeichen `duplicateAcknowledged: true` trägt. Ohne Kennzeichen:
// 409 mit verständlicher Meldung, es wird nichts geschrieben. Mit Kennzeichen: die Bestätigung
// steht VOR der Validierung im Audit (`ko.duplicate-acknowledged`, Person = `actor`, Zeit = `at`).
//
// Keine harte Sperre und keine Auflösung: die Dublette bleibt offen, wie sie ist. Gezählt werden
// dieselben Paare, die `/api/duplicates` diesem Menschen zeigt (`sichtbarePaare`) — sonst verlangte
// der Server die Bestätigung einer Dublette, die die Prüfkarte nie anzeigen darf.
//
// Verdrahtet im KO-Dispatcher (`ko-routes.ts`) an den zwei Freigabewegen der Prüfkarte:
// `rate` mit `verdict: "up"` und `admin-validate`.
export const DUBLETTE_BESTAETIGUNG_FEHLT = "DUPLICATE_ACK_REQUIRED";
export const DUBLETTE_BESTAETIGT_AUDIT = "ko.duplicate-acknowledged";

export interface DublettenTorDeps {
  overlaps: Pick<OverlapService, "unresolved">;
  kos: KoSichtbarkeitsZugang;
  audit?: AuditService | undefined;
}

/**
 * `true` = es darf validiert werden (keine offene Dublette, oder bestätigt UND festgehalten).
 * `false` = die Antwort ist schon gesendet; der Aufrufer schreibt nichts.
 */
export async function dublettenTor(
  deps: DublettenTorDeps,
  user: SessionUser,
  koId: string,
  kennzeichen: unknown,
  weg: "rate" | "admin-validate",
  reply: FastifyReply,
): Promise<boolean> {
  const offen = (await deps.overlaps.unresolved()).filter(
    (e) => e.status !== "geschlossen" && (e.koA === koId || e.koB === koId),
  );
  const sichtbar = await sichtbarePaare(user, offen, deps.kos);
  if (sichtbar.length === 0) {
    return true;
  }
  if (kennzeichen !== true) {
    reply.code(409).send({
      error: DUBLETTE_BESTAETIGUNG_FEHLT,
      message:
        "Zu diesem Wissensobjekt liegt eine offene Dublette vor. Bitte bestätigen Sie, dass Sie sie gesehen haben (duplicateAcknowledged: true). Es wurde nichts validiert.",
    });
    return false;
  }
  // Ohne Audit lässt sich die Bestätigung nicht festhalten — dann wird auch nicht validiert.
  if (!deps.audit) {
    reply.code(503).send({
      error: "AUDIT_UNAVAILABLE",
      message:
        "Die Bestätigung der Dublette kann nicht im Audit festgehalten werden. Es wurde nichts validiert.",
    });
    return false;
  }
  await deps.audit.record({
    actor: user.id,
    action: DUBLETTE_BESTAETIGT_AUDIT,
    target: koId,
    payload: { overlapIds: sichtbar.map((e) => e.id), weg },
  });
  return true;
}

// WP-SUBMIT-ASYNC (Neustart-Robustheit, pragmatisch + ehrlich): der Prüf-Worker hält seine Queue
// NUR im Speicher — nach einem Prozess-Neustart wäre ein pending-Job verloren. Beim Laden der
// Validierungs-Liste werden deshalb festhängende pending-KOs (requestedAt älter als
// AI_CHECK_STALE_PENDING_MS) LAZY neu eingereiht; markAiCheckPending frischt requestedAt auf,
// damit nicht jeder Board-Load erneut einreiht. GRENZE (bewusst, kein Cron/keine neue Infra):
// wird das Board nie geladen, bleibt ein verwaister Job ehrlich als pending sichtbar liegen.
export interface ValidationAiCheckDeps {
  ko: KoService;
  worker: AiCheckWorker;
  /**
   * PRÜFSTATUS-ANZEIGE (R-0208): die offenen Konflikte — nur gelesen, um „Konflikt gefunden" am
   * KI-Prüfkennzeichen zu belegen. Optional: ohne ihn bleibt `konfliktGefunden` unerhoben.
   */
  conflicts?: { unresolved(): Promise<readonly OffenerKonflikt[]> };
}

/** Die Felder eines offenen Konflikts, die die Prüfauskunft braucht — und keines mehr. */
interface OffenerKonflikt {
  koA: string;
  koB: string;
  origin?: "manual" | "auto";
}

// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0208) · DIE KI-PRÜFAUSKUNFT DES BRETTS — ABGELEITET, NICHT GESPEICHERT.
// ================================================================================================
//
// Der gespeicherte Vermerk kennt drei Lagen (`pending | done | failed`). Die Prüfseite soll mehr
// unterscheiden: „ausstehend" von „läuft" und „geprüft" von „Konflikt gefunden". Beides weiß der
// Server — der Worker, welcher Job gerade läuft, und der Konfliktbestand, wozu die automatische
// Erkennung etwas gefunden hat. Diese Funktion liest beides und hängt es an die ANTWORT, nicht an
// das Objekt.
//
// SICHTBARKEIT: ein Konflikt zählt nur, wenn der Leser BEIDE Seiten sehen darf (`sichtbarePaare`,
// dieselbe Regel wie `GET /api/conflicts`) — sonst wäre schon das Kennzeichen eine Auskunft über
// ein Objekt, das er nicht sehen darf. Nur automatisch erkannte Konflikte mit diesem Objekt als
// Subjekt (`koA`) zählen: es geht um das Ergebnis SEINER Prüfung, nicht um eine Meldung von Hand.
//
// SCHEITERT DIE KONFLIKTABFRAGE, bleibt `konfliktGefunden` weg — weder „ja" noch „nein".
async function mitKiPruefauskunft<T extends { id: string; aiCheck?: AiCheck }>(
  user: SessionUser,
  board: readonly T[],
  deps: ValidationAiCheckDeps,
): Promise<T[]> {
  let konfliktSubjekte: Set<string> | null = null;
  if (deps.conflicts) {
    try {
      const ids = new Set(board.map((ko) => ko.id));
      const auto = (await deps.conflicts.unresolved()).filter(
        (c) => c.origin === "auto" && ids.has(c.koA),
      );
      const sichtbar = await sichtbarePaare(user, auto, deps.ko);
      konfliktSubjekte = new Set(sichtbar.map((c) => c.koA));
    } catch {
      konfliktSubjekte = null;
    }
  }
  return board.map((ko) => {
    const vermerk = ko.aiCheck;
    if (!vermerk) {
      return ko;
    }
    if (vermerk.status === "pending") {
      return { ...ko, aiCheck: { ...vermerk, laeuft: deps.worker.laeuft(ko.id) } };
    }
    if (vermerk.status === "done" && konfliktSubjekte) {
      return { ...ko, aiCheck: { ...vermerk, konfliktGefunden: konfliktSubjekte.has(ko.id) } };
    }
    return ko;
  });
}

// R-0265: was der Prüfer-Vorschlag aus der Kompositionswurzel braucht. Die Personen sind dieselbe
// Liste wie die manuelle Auswahl (`GET /api/directory`); die Beziehungen kommen aus demselben
// Kantenbestand wie das Wissensnetz.
export interface PrueferVorschlagDeps {
  ko: Pick<KoService, "get">;
  kanten: Pick<KantenRepo, "fuerKo">;
  personen: () => Promise<readonly { id: string }[]>;
}

/**
 * `tags` kommt als kommagetrennte Liste; leere Teile fallen weg. Ein wiederholter Parameter
 * (`?tags=a&tags=b`) kommt als Feld an und wird ebenso gelesen; alles andere zählt nicht.
 */
function schlagworteAus(roh: unknown): string[] {
  const teile = Array.isArray(roh) ? roh : [roh];
  return teile
    .filter((t): t is string => typeof t === "string")
    .flatMap((t) => t.split(","))
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Ein Abfragewert als Text — ein Feld oder ein Fremdtyp gilt als nicht angegeben. */
function textAus(roh: unknown): string {
  return typeof roh === "string" ? roh.trim() : "";
}

// Validierungs-Leseansichten (§2.3). Bewerten/Zuweisen laufen über den KO-Dispatcher.
export function validationRoutes(
  validation: ValidationService,
  guards: Guards,
  aiCheck?: ValidationAiCheckDeps,
  vorschlag?: PrueferVorschlagDeps,
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
      let board = sichtbareFuer(user, await validation.board(request.query));
      if (aiCheck) {
        const nowMs = Date.now();
        // AUFNAHME 20260922: der frische Vermerk eines neu eingereihten Laufs ersetzt in der Antwort
        // den gelesenen (überholten) Stand — der alte Nachweis erscheint nicht als aktuell.
        const frisch = new Map<string, AiCheck>();
        for (const item of board as { id: string; aiCheck?: AiCheck }[]) {
          if (shouldReEnqueueAiCheck(item.aiCheck, nowMs) && !aiCheck.worker.has(item.id)) {
            await aiCheck.ko.markAiCheckPending(item.id);
            // WP-SHIP8-CLOSE-2 (bens F3): den FRISCHEN Vermerk nachlesen — item.aiCheck ist der
            // veraltete Stand vor dem Re-Enqueue; der Job trägt die Zielversion synchron.
            const marked = await aiCheck.ko.get(item.id);
            aiCheck.worker.enqueue(item.id, marked?.aiCheck?.koVersion);
            if (marked?.aiCheck) {
              frisch.set(item.id, marked.aiCheck);
            }
          }
        }
        if (frisch.size > 0) {
          board = board.map((ko) => {
            const neu = frisch.get(ko.id);
            return neu ? { ...ko, aiCheck: neu } : ko;
          });
        }
        board = await mitKiPruefauskunft(user, board, aiCheck);
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

    // R-0265: Prüfer-Vorschlag. Zwei Lagen:
    //   · ohne `koId` — ein NEUES Objekt beim Einreichen: Thema aus `category`/`tags`, Autor ist
    //     der Fragende selbst, Beziehungen gibt es noch keine.
    //   · mit `koId` — ein vorhandenes Objekt: Thema und Autor vom Objekt, dazu seine aktiven
    //     Beziehungen. Ein Objekt, das der Fragende nicht sehen darf, ist für ihn nicht da (404).
    // Rechnet nur über den SICHTBAREN Bestand. Weist niemanden zu.
    app.get<{ Querystring: { category?: string; tags?: string; koId?: string } }>(
      "/api/validation/reviewer-suggestions",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        if (!vorschlag) {
          reply.code(503).send({
            error: "SUGGESTIONS_UNAVAILABLE",
            message: "Der Prüfer-Vorschlag ist in dieser Umgebung nicht verdrahtet.",
          });
          return;
        }
        const sichtbar = sichtbarkeitsfilterFuer(user);
        const koId = textAus(request.query.koId);
        let ziel: { id?: string; category?: string; tags?: readonly string[] } = {
          category: textAus(request.query.category),
          tags: schlagworteAus(request.query.tags),
        };
        const ausgeschlossen = [user.id];
        const nachbarn = new Set<string>();
        if (koId) {
          const ko = await vorschlag.ko.get(koId);
          if (!ko || !sichtbar(ko)) {
            reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
            return;
          }
          ziel = { id: ko.id, category: ko.category, tags: ko.tags };
          ausgeschlossen.push(ko.author);
          for (const k of await vorschlag.kanten.fuerKo(ko.id)) {
            if (k.status === "aktiv") {
              nachbarn.add(k.quelleId === ko.id ? k.zielId : k.quelleId);
            }
          }
        }
        const kandidaten = (await vorschlag.personen()).map((p) => p.id);
        reply.code(200).send(
          await validation.prueferVorschlagFuer({
            ziel,
            ausgeschlossen,
            kandidaten,
            nachbarn,
            sichtbar,
          }),
        );
      },
    );

    // R-1655: die Messgrundlage „Validierungszeiten sinken messbar" — je Zuweisungsweg erledigte
    // und offene Zuweisungen samt Median der Prüfdauer, nur über den SICHTBAREN Bestand.
    app.get("/api/validation/pruefdauer", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply
        .code(200)
        .send(await validation.pruefdauerAuswertung({ sichtbar: sichtbarkeitsfilterFuer(user) }));
    });

    // R-1655: das persönliche Opt-out aus der automatischen Zuweisung — nur das EIGENE Konto.
    // `optOut: null` = in dieser Umgebung wird die Einstellung nicht geführt.
    app.get("/api/me/pruefrouting", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ optOut: await validation.routingOptOutVon(user.id) });
    });

    app.put<{ Body: { optOut?: unknown } }>("/api/me/pruefrouting", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const optOut = request.body?.optOut;
      if (typeof optOut !== "boolean") {
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: "optOut muss true oder false sein." });
        return;
      }
      try {
        reply.code(200).send({ optOut: await validation.setzeRoutingOptOut(user.id, optOut) });
      } catch (error) {
        sendError(reply, error);
      }
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

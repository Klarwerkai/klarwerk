import type { FastifyPluginAsync } from "fastify";
import { type AskService, answerEvidence, isGapPriority, redactGapForViewer } from "../../../ask";
import type { ConflictService } from "../../../conflicts";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import { can } from "../../../rbac";
import { authorizesAsk } from "../addon-principal";
import { addonRateLimit } from "../addon-rate-limit";
import { type Guards, type SessionUser, sendError } from "../http";

// SCRUM-498 B1 (ben-Review): bewusste Eingabe-Härtung von POST /api/ask, definiert über die GÜLTIGE
// HÜLLE eines Requests:
//   - Body MUSS ein JSON-Objekt sein.
//   - question: optional; wenn vorhanden string, ≤ 8.000 Codepoints (ajv zählt Codepoints). Fehlt/leer/
//     null → Handler normalisiert auf "" → 200 (wie Parent e6abb25).
//   - locale: optional; string oder skalar-coercierbar; der Handler normalisiert auf de/en/nl.
//   - additionalProperties erlaubt.
//   - Gesamt-Body ≤ 128 KiB (sonst 413).
// Alles AUSSERHALB dieser Hülle → kontrolliertes 400 (413 bei Größe), nie 500. Gegenüber dem Parent
// bewusst gehärtet: nicht-objektförmiger Body, question > 8.000, locale nicht-coercierbar, Body > 128 KiB,
// fehlender Body (Crash-Fix). Kein legitimer Klara-Traffic ist davon betroffen.
const askBodySchema = {
  type: "object",
  properties: {
    question: { type: "string", maxLength: 8_000 },
    locale: { type: "string" },
    // WP-KLARA-ASK-FIX (bens Fix 1, P0): optionaler, SERVER-garantierter Modus. "retrieval-only"
    // erzwingt serverseitig: NUR validierte KOs als Grundlage, NULL Modell- und NULL Embedder-
    // Aufrufe (rein deterministisches Retrieval, Antwort = woertliche validierte Aussage +
    // Quellen, keine Synthese). Anderer Wert → Schema-400. Ohne Feld: Konsolen-Bestandsverhalten.
    mode: { type: "string", enum: ["retrieval-only"] },
  },
} as const;

// Route-bodyLimit (bewusster milder Cap, runter von global 1 MiB): deckt eine escaped 8.000-Codepoint-
// Frage (roh bis ~96 KiB) plus Envelope/locale/moderate Extras. Bodies über 128 KiB liegen außerhalb der
// gültigen Hülle → kontrolliertes 413.
const ASK_BODY_LIMIT = 128 * 1024; // 128 KiB

// Request-lokal getragener Session-User (analog authContext): in preValidation aufgelöst, im Handler
// nur gelesen — kein zweiter Guard-Aufruf.
declare module "fastify" {
  interface FastifyRequest {
    askSessionUser?: SessionUser | null;
  }
}

// ================================================================================================
// AUFTRAG-mega34 BLOCK B1 — DER EVIDENZZUSTAND WIRD HIER ZUSAMMENGESETZT.
// ================================================================================================
//
// Die REGEL steht in services/ask/src/answer-evidence.ts. Diese Route beschafft nur ihre Eingaben:
// die Antwort (hat sie schon), die Quell-KOs und die offenen Konflikte. Beide Dienste liegen an der
// Kompositionswurzel ohnehin vor — das ist das Hausmuster (s. livewallRoutes, impactRoutes).
//
// FAIL-SAFE, ausdrücklich: reißt der Konfliktabruf ab, wird `null` weitergereicht — „unbekannt",
// nicht „keine". Ein Fehler im Konfliktdienst darf eine Antwort nicht zu stark aussehen lassen; er
// darf die Antwort aber auch nicht verhindern, denn die Antwort selbst ist bereits fertig.
//
// KEIN NEUER EGRESS: `ko.get` und `conflicts.unresolved()` sind bestehende, interne Lesewege,
// dieselben, die `GET /api/kos/:id` und `GET /api/conflicts` seit jeher benutzen.
export interface AskRouteDeps {
  ask: AskService;
  ko: KoService;
  conflicts: ConflictService;
  /**
   * KW-KA4: das bestehende Ausführungstor aus `services/klara-session-service.ts`. OPTIONAL und
   * additiv — fehlt es, verhält sich diese Route byteweise wie vor KA4 (siehe `ka4Freigabe`).
   */
  klaraSessions?: Ka4Freigabepruefer | undefined;
}

// ================================================================================================
// KW-KA4-DOKUMENT-CONSENT — DIE EINWILLIGUNG JE DOKUMENT ENTSCHEIDET, NICHT DER CLIENT.
// ================================================================================================
//
// PEDIS WEICHE (Werkstattbeschluss 18.08.2026): „Externe KI mit Dokumenttext: JA, aber nie still.
// Je Dokument eine ausdrückliche Einwilligung … Vertraulich Markiertes bleibt IMMER draußen."
//
// WAS HIER STEHT UND WAS AUSDRÜCKLICH NICHT. Hier steht die ANWENDUNG des Tors, nicht das Tor
// selbst. Ob eine Zustimmung trägt, entscheidet allein `KlaraSessionService.pruefeExterneAusfuehrung`
// — dieselbe Prüfung, die neun Bindungen einzeln vergleicht (`klara-session-service.ts:243-261`),
// frisch liest, nicht deckende Zustimmungen entwertet und die Auflösung selbst befragt. Eine
// zweite Auslegung dieser Regel an dieser Stelle wäre genau der Fehler, den KW-S4-23 abstellt.
//
// DREI EIGENSCHAFTEN, die diesen Weg zu einer Sicherheitsgrenze machen:
//
//   1. FAIL-CLOSED IN JEDER RICHTUNG. Kein Dienst, fehlende Kopfzeile, leerer Wert, geworfener
//      Fehler, `erlaubt: false` — jeder dieser Fälle endet in der unveränderten Enge. Es gibt
//      keinen Zweig, in dem ein unklarer Zustand zur Freigabe führt.
//   2. DIE KOPFZEILEN AUTORISIEREN NICHT. Sie sind Lookup (`klara-ai-routes.ts:36-38`: „Die Werte
//      sind OPAK — der Server interpretiert sie nie, er prüft nur Gleichheit"). Wer fremde Werte
//      schickt, bekommt dieselbe Absage wie bei einer fremden Sitzung: der Dienst wirft `NOT_FOUND`,
//      und der Fang unten macht daraus eine Nichtfreigabe. Ein Client-Bool gibt es nicht und darf
//      es nie geben.
//   3. DER VERTRAULICHKEITSFILTER HÄNGT NICHT DARAN. `dropConfidential` läuft in
//      `services/ask/src/service.ts:275` VOR der Kandidatenauswahl und unabhängig von jeder
//      Option — er kann durch eine Freigabe strukturell nicht ausgeschaltet werden. Das ist keine
//      Zusage dieser Datei, sondern eine Eigenschaft des Bestands, und sie ist der Grund, warum
//      KA4 die Vertraulichkeit nicht eigens erzwingen muss.
//
// WAS DIE FREIGABE HEUTE BEWIRKT: nichts, und das ist richtig so. `KLARA_EXTERNAL_EXECUTION_MIGRATED`
// steht in `services/reasoner/src/klara-policy.ts:161` auf `false`; jede externe Auflösung wird
// deshalb mit `external_not_migrated` blockiert, und `pruefeExterneAusfuehrung` kann gar kein
// `erlaubt: true` liefern. Der Weg ist gebaut, geprüft und wartet auf genau eine benannte
// Entscheidung an genau einer Stelle — er schaltet sich nicht selbst frei.

/** Die schmale Sicht auf das bestehende Tor — mehr braucht diese Route nicht zu kennen. */
export interface Ka4Freigabepruefer {
  pruefeExterneAusfuehrung(
    sessionId: string,
    bindung: { actorId: string; addinInstanceId: string; documentContextId: string },
  ): Promise<{ readonly erlaubt: boolean; readonly grund?: string }>;
}

// Dieselben Kopfzeilen wie der Klara-Sitzungsweg (`klara-ai-routes.ts:40-42`) — eine Schreibweise,
// kein zweiter Transportvertrag.
const KLARA_SESSION_HEADER = "x-klara-session";
const KLARA_INSTANCE_HEADER = "x-klara-instance";
const KLARA_DOCUMENT_HEADER = "x-klara-document";

function klaraKopf(headers: Record<string, unknown>, name: string): string {
  const wert = headers[name];
  return typeof wert === "string" ? wert.trim() : "";
}

/**
 * Darf dieser Ask die erzwungene Enge verlassen?
 *
 * PROTOKOLL AUSDRÜCKLICH METADATA-ONLY: geloggt werden Entscheidung und Grund — nie die Frage, nie
 * ein Dokumentinhalt, nie eine Kopfzeile. Die Kennungen sind zwar opak, aber ein Protokoll, das
 * sie mitschreibt, wäre eine Verknüpfungsspur über Dokumente hinweg; sie bleibt deshalb draußen.
 */
async function ka4Freigabe(
  pruefer: Ka4Freigabepruefer | undefined,
  headers: Record<string, unknown>,
  actorId: string,
  log: { info: (obj: unknown, msg: string) => void },
): Promise<boolean> {
  if (!pruefer || typeof pruefer.pruefeExterneAusfuehrung !== "function") {
    return false;
  }
  const sessionId = klaraKopf(headers, KLARA_SESSION_HEADER);
  const addinInstanceId = klaraKopf(headers, KLARA_INSTANCE_HEADER);
  const documentContextId = klaraKopf(headers, KLARA_DOCUMENT_HEADER);
  if (!sessionId || !addinInstanceId || !documentContextId) {
    // Kein Protokolleintrag: eine Anfrage ganz ohne Klara-Bindung ist der Normalfall und keine
    // Entscheidung über eine Einwilligung.
    return false;
  }
  try {
    const freigabe = await pruefer.pruefeExterneAusfuehrung(sessionId, {
      actorId,
      addinInstanceId,
      documentContextId,
    });
    const erlaubt = freigabe?.erlaubt === true;
    log.info(
      { ka4: { entscheidung: erlaubt ? "freigegeben" : "blockiert", grund: freigabe?.grund } },
      "ask.ka4.dokument-consent",
    );
    return erlaubt;
  } catch (err) {
    // Fremde/abgelaufene/geschlossene Sitzung wirft (NOT_FOUND/CONFLICT). Das ist eine Absage,
    // kein Serverfehler — der Ask läuft in der unveränderten Enge weiter.
    log.info(
      { ka4: { entscheidung: "blockiert", grund: "bindung_ungueltig" } },
      "ask.ka4.dokument-consent",
    );
    return false;
  }
}
// KW-KA4-DOKUMENT-CONSENT-END

// AUFTRAG-mega53 B4 — DIE ZWEITE DER VIER STELLEN.
//
// Diese Route beschafft nur die Eingaben; entschieden wird in `answerEvidence`. Neu ist, dass sie
// `citedSources` MITREICHT. Ohne dieses Feld rechnete die Regel serverseitig weiter auf allen
// herangezogenen Quellen — die Signatur macht das Weglassen jetzt unmöglich (Pflichtfeld).
//
// Aufgelöst werden weiterhin ALLE herangezogenen Quellen, nicht nur die tragenden: die Karte ist
// ein Nachschlagewerk, und die Regel greift daraus die tragende Teilmenge. So bleibt der
// Auflösungs-Warnpfad für jede ausgelieferte Quelle erhalten, ohne dass eine bloß angesehene
// Quelle die Einstufung berührt.
async function evidenceFor(
  deps: AskRouteDeps,
  result: {
    answered: boolean;
    knowledgeClass: string;
    sources: string[];
    citedSources: string[];
  },
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<ReturnType<typeof answerEvidence>> {
  const sourceKos = new Map<string, KnowledgeObject>();
  // Höchstens DEFAULT_TOP_K Quellen (8) — dieselbe N+1-Runde, die das Add-in heute schon für
  // Titel und Datum fährt, nur einmal statt clientseitig.
  await Promise.all(
    result.sources.map(async (id) => {
      try {
        const ko = await deps.ko.get(id);
        if (ko) {
          sourceKos.set(id, ko);
        }
      } catch (err) {
        // Nicht auflösbar ⇒ die Regel führt sie als `unknown`. Genau das ist gewollt.
        log.warn({ err, koId: id }, "ask.evidence: Quell-KO nicht auflösbar");
      }
    }),
  );
  let openConflicts: Awaited<ReturnType<ConflictService["unresolved"]>> | null = null;
  try {
    openConflicts = await deps.conflicts.unresolved();
  } catch (err) {
    log.warn({ err }, "ask.evidence: Konfliktabruf gescheitert — Einstufung bleibt unbelegt");
  }
  return answerEvidence({
    answer: result as Parameters<typeof answerEvidence>[0]["answer"],
    sourceKos,
    openConflicts,
  });
}

// Fragen & Wissenslücken (§2.4 / FR-ASK).
export function askRoutes(deps: AskRouteDeps, guards: Guards): FastifyPluginAsync {
  const ask = deps.ask;
  return async (app) => {
    app.decorateRequest("askSessionUser", null);
    app.post<{ Body: { question?: string; locale?: string; mode?: string } }>(
      "/api/ask",
      {
        // SCRUM-490 D3: Drossel NUR für den addon-Pfad. Bei Flag AUS ist das @fastify/rate-limit-Plugin
        // nicht registriert → diese config.rateLimit ist inert (Fastify ignoriert unbekannte route-config)
        // → /api/ask exakt wie heute. Bei Flag AN drosselt sie nur den Add-on-Principal (allowList
        // exempt-iert Session-Requests der Live-App), gekeyt auf den stabilen addon-Actor.
        config: { rateLimit: addonRateLimit() },
        bodyLimit: ASK_BODY_LIMIT,
        schema: { body: askBodySchema },
        // SCRUM-498 B1: Auth VOR der Body-Validierung (wie check-text). Der Add-on-Pfad ist bereits im
        // onRequest-Hook autorisiert (401/403 vor der validation-Phase); den Session-Pfad prüfen wir
        // hier in preValidation, damit ein anonymer Request 401 bekommt, BEVOR die Schema-400 greift
        // (kein Reihenfolge-Oracle). Der aufgelöste User wird request-lokal für den Handler getragen.
        preValidation: async (request, reply) => {
          const auth = request.authContext;
          if (auth?.authKind === "addon") {
            // Defense-in-Depth (ben-Review): nur ein Principal mit Capability ask.validated erreicht den
            // Ask-Pfad; sonst fail-closed (403).
            if (!authorizesAsk(auth.principal)) {
              reply
                .code(403)
                .send({ error: "FORBIDDEN", message: "Add-in-Capability unzureichend." });
              return reply;
            }
            return;
          }
          // Live-App unverändert: Session-Guard mit ko.read — jetzt vor der Body-Validierung.
          const user = await guards.requirePermission("ko.read", request, reply);
          if (!user) {
            return reply;
          }
          request.askSessionUser = user;
        },
      },
      async (request, reply) => {
        // Der fehlende Body ist bereits durch das Schema (type:object) mit 400 abgefangen; ab hier ist
        // request.body ein Objekt. question kann fehlen/leer sein → wie im Parent auf "" normalisieren
        // (kein neuer 500). FR-I18N-01: UI-Sprache an den Reasoner; ungültig → "de".
        const question = request.body.question ?? "";
        // mega52 D1: die Route reicht Niederländisch durch, statt es auf Deutsch zu werfen.
        // Unbekannte Werte fallen weiterhin auf den sicheren Default "de".
        const locale: "de" | "en" | "nl" =
          request.body.locale === "en" ? "en" : request.body.locale === "nl" ? "nl" : "de";
        // AUFTRAG-mega34 B1: EIN Ausgang für alle drei Zweige — der Evidenzzustand hängt additiv am
        // bestehenden Antwortkörper. Wer ihn nicht liest, sieht die Antwort wie bisher; wer ihn
        // liest (Word/Klara), bekommt dieselbe Einstufung wie Desktop und Mobil.
        const answer = async (
          actorId: string,
          opts?: Parameters<AskService["ask"]>[3],
        ): Promise<void> => {
          const out = await ask.ask(question, actorId, locale, opts);
          const evidence = await evidenceFor(deps, out.result, request.log);
          reply.code(200).send({ ...out, result: { ...out.result, evidence } });
        };
        const auth = request.authContext;
        if (auth?.authKind === "addon") {
          // KW-KA4: NUR eine serverbestätigte Einwilligung für exakt diese Sitzung UND dieses
          // Dokument hebt die Enge auf. Ohne sie fällt der Ablauf in den unveränderten Zweig
          // darunter — Zeile für Zeile derselbe wie vor KA4.
          if (
            await ka4Freigabe(deps.klaraSessions, request.headers, auth.principal.id, request.log)
          ) {
            // `gapPolicy` bleibt: die Wissenslücken-Nebenwirkung ist keine Egressfrage und war nie
            // Gegenstand der Einwilligung.
            await answer(auth.principal.id, { gapPolicy: "count_only" });
            return;
          }
          // SCRUM-490 D1/D2: validated-only + count_only für den Nur-Lese-Add-on-Key. R2 (B1):
          // retrievalOnly → der vertrauliche Dokumenttext wird NIE ans Modell/den Embedder gegeben; die
          // Antwort ist rein Retrieval gegen validierte, nicht-vertrauliche KOs (kein Egress).
          await answer(auth.principal.id, {
            validatedOnly: true,
            gapPolicy: "count_only",
            retrievalOnly: true,
          });
          return;
        }
        // Session: in preValidation autorisiert, User request-lokal getragen.
        const user = request.askSessionUser;
        if (!user) {
          // Defense-in-Depth: erreichbar nur, wenn preValidation nichts gesetzt hätte (soll nie sein).
          reply.code(401).send({ error: "UNAUTHENTICATED", message: "Session erforderlich." });
          return;
        }
        // WP-KLARA-ASK-FIX (bens Fix 1, P0-Kern): "retrieval-only" — der Modus des Word-Add-ins
        // (markierter DOKUMENTTEXT ist potenziell vertraulich und darf NIE zur Cloud). Bewusst ein
        // Request-Flag statt eines eigenen Endpunkts: Auth, Body-Schema, Rate-Limits und der
        // Add-on-Zweig dieser Route bleiben EINE Quelle der Wahrheit — server-erzwungen ist die
        // SEMANTIK des Modus: ask.ask mit validatedOnly (nur validierte KOs als Grundlage) +
        // retrievalOnly (answerRetrievalOnly = deterministischer Pfad; kein Modell-, kein
        // Embedder-Aufruf erreichbar — exakt der seit SCRUM-490 R2 bestehende Add-on-Vertrag).
        // Die Antwort ist die WOERTLICHE validierte Aussage + Quellen, keine Synthese. Die
        // Wissensluecke wird weiter vermerkt (Session-Nutzer, bestehende gap-Semantik) — darauf
        // baut der Offene-Frage-Weg des Panels. Konsole ohne mode: byte-identisches Verhalten.
        if (request.body.mode === "retrieval-only") {
          // KW-KA4: derselbe Riegel wie im Add-on-Zweig. Dieser Weg ist der, den das Word-Panel
          // heute tatsächlich fährt (same-origin, Sitzungscookie — `taskpane.html:910-916`), und
          // deshalb muss die Einwilligung genau hier greifen.
          if (await ka4Freigabe(deps.klaraSessions, request.headers, user.id, request.log)) {
            // Der normale Answerweg — dieselbe Form wie der Konsolen-Ask darunter, keine
            // Sonderbehandlung: `validatedOnly`/`retrievalOnly` entfallen, alles andere bleibt.
            await answer(user.id);
            return;
          }
          await answer(user.id, { validatedOnly: true, retrievalOnly: true });
          return;
        }
        await answer(user.id);
      },
    );

    // FR-ASK-04: „Hat geholfen" — Bewährung durch Nutzung.
    // FUNKE-FIX P0 (bens ROT-1): Das „Danke" verlangt den opaken Answer-Receipt aus dem echten
    // Antwortvorgang (POST /api/ask liefert ihn). Der Server verifiziert damit, dass GENAU dieses KO
    // diesem Nutzer als Quelle ausgeliefert wurde — eine frei gewählte/unbelegte KO-ID ⇒ 403. Die
    // Genau-einmal-Garantie (recordOnce-CAS) und der atomare Trust-Bump liegen im Service.
    app.post<{ Body: { koId: string; receipt?: string } }>(
      "/api/ask/helpful",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          await ask.markHelpful(request.body.receipt ?? "", request.body.koId, user.id);
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // FUNKE-FIX2 P0 (bens Erforderlich 1): rein aggregierte Zähler — KEIN Fragetext. Die Startseite
    // nutzt AUSSCHLIESSLICH diesen Endpunkt (kein Volltext-Fetch der Lücken mehr auf /start).
    app.get("/api/gaps/summary", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await ask.gapsSummary());
    });

    // FUNKE-FIX2 P0 (bens Erforderlich 2): Detail-Endpunkt liefert den Fragetext ADRESSATENGERECHT.
    // Volltext sehen nur der Ersteller/Owner, ein Assignee ODER eine Rolle mit ausdrücklicher Detail-
    // Berechtigung (ko.validate-Ebene, d. h. Controller/Admin — die Lücken ohnehin kuratieren). Alle
    // anderen erhalten eine REDIGIERTE Sicht (Kategorie/Neutralbezeichnung, Zähler, KEIN Fragetext).
    // Fail-closed: im Zweifel redigiert (redactGapForViewer entscheidet zentral).
    app.get("/api/gaps", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const maySeeDetail = can(user.role, "ko.validate");
      const gaps = await ask.listGaps();
      reply
        .code(200)
        .send(gaps.map((gap) => redactGapForViewer(gap, { viewerId: user.id, maySeeDetail })));
    });

    app.put<{
      Params: { id: string };
      Body: { expertId?: string; close?: boolean; action?: string; priority?: string };
    }>("/api/gaps/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.assign", request, reply);
      if (!user) {
        return;
      }
      try {
        // SCRUM-115: Priorität setzen.
        if (request.body.priority !== undefined) {
          if (!isGapPriority(request.body.priority)) {
            reply.code(400).send({ error: "BAD_REQUEST", message: "Ungültige Priorität." });
            return;
          }
          reply.code(200).send(await ask.setGapPriority(request.params.id, request.body.priority));
          return;
        }
        // Close akzeptiert sowohl { close:true } als auch { action:"close" } (FE-Kopplung).
        if (request.body.close === true || request.body.action === "close") {
          reply.code(200).send(await ask.closeGap(request.params.id));
          return;
        }
        if (request.body.expertId) {
          reply.code(200).send(await ask.assignGap(request.params.id, request.body.expertId));
          return;
        }
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: "expertId, close oder priority erforderlich." });
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.delete<{ Params: { id: string }; Querystring: { confirm?: string } }>(
      "/api/gaps/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        try {
          await ask.deleteGap(request.params.id, request.query.confirm === "true");
          reply.code(204).send();
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}

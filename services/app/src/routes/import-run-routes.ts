// ================================================================================================
// W2-A / AUFTRAG 148 — DER LESEWEG DER LAUFDOMAENE.
// ================================================================================================
//
// PRO 144 hat die Laufdomaene in `services/library-analytics` gebaut und ihre oeffentlichen
// Vertraege ausgeleitet. Was fehlte, war der Anschluss: es gab keine Route, ueber die ein Betreiber
// einen Lauf oder sein Ergebnis lesen konnte. `tests/app/w2a-import-run-routes-148.test.ts` haelt
// genau diese Luecke fest und war deshalb rot, ohne dass eine einzige Domaenenregel gefehlt haette.
//
// ------------------------------------------------------------------------------------------------
// DREI ENTSCHEIDUNGEN, DIE HIER VERTRAG SIND — NICHT STIL.
// ------------------------------------------------------------------------------------------------
//
// 1. RECHT VOR OBJEKTAUFLOESUNG. `requirePermission` steht in jedem Handler VOR jedem Repo-Zugriff.
//    Stuende es dahinter, waere die Antwort fuer eine fremde Identitaet bei einem EXISTIERENDEN
//    Lauf 404 und bei einem erfundenen ebenfalls 404 — aber bei einem existierenden erst nach dem
//    Lesen. Schlimmer noch im umgekehrten Fall: 403 hier, 404 dort verriete die Existenz des Laufs
//    an jemanden, der ihn nicht sehen darf. Die Reihenfolge IST die Zusage.
//
// 2. EIN 404 SPIEGELT DIE ANGEFRAGTE KENNUNG NICHT ZURUECK. Der Koerper nennt weder die gesuchte Id
//    noch Fachinhalt. Sonst waere die Fehlermeldung selbst eine Auskunft darueber, wonach gefragt
//    wurde — und in Protokollen und Proxys eine zweite, unbeabsichtigte Datenspur.
//
// 3. NIE EIN ERFUNDENER LEER-LAUF. Findet der Repo nichts, ist die Antwort 404 — nicht ein Objekt
//    mit leeren Feldern. `KW-S4-26` §142-143 nennt das ausdruecklich; ein Leer-Lauf waere von einem
//    echten, noch leeren Lauf nicht zu unterscheiden.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIE GAP-BINDUNG HIER `RELATION_NOT_AVAILABLE` IST.
// ------------------------------------------------------------------------------------------------
//
// `ImportRunItemRef` fuehrt keine Wissensluecken-Relation (types.ts:398-408). Der ehrliche Wert ist
// deshalb genau der kanonische Nichtwissen-Wert des Paares — `RELATION_NOT_AVAILABLE` mit `null` —
// und NICHT `AVAILABLE` mit `[]`. Die leere Liste hiesse „nachgesehen, es gibt keine"; hier wurde
// aber gar nicht nachgesehen. `pruefeGapBindung` erzwingt das Paar; der Test ruft dieselbe Regel
// ueber die HTTP-Grenze auf.
import type { FastifyPluginAsync } from "fastify";
import type {
  ExternalSourceRecord,
  ExternalSourceRepo,
  ImportRun,
  ImportRunItemRef,
  ImportRunRepo,
} from "../../../library-analytics";
import type { Guards } from "../http";

export interface ImportRunRoutesDeps {
  readonly importRuns: ImportRunRepo;
  readonly externalSources: ExternalSourceRepo;
  readonly guards: Guards;
}

/** Der Lauf auf der Leitung — Feld fuer Feld, damit nichts Internes mitreist. */
function laufNachAussen(run: ImportRun) {
  return {
    importId: run.importId,
    sourceSystem: run.sourceSystem,
    externalId: run.externalId,
    sourceScope: run.sourceScope,
    requestedSourceVersion: run.requestedSourceVersion,
    status: run.status,
    sourceRecordId: run.sourceRecordId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    failureCode: run.failureCode,
    failureReason: run.failureReason,
    counters: { ...run.counters },
  };
}

/**
 * Die Quellrevision auf der Leitung.
 *
 * `contentReferenceState` steht NICHT im Datensatz (`ExternalSourceRecord` fuehrt nur die Referenz
 * selbst). Er wird deshalb aus ihr ABGELEITET, und zwar genau nach der kanonischen Paarregel:
 * keine Referenz heisst `NOT_CAPTURED`, eine Referenz heisst `AVAILABLE`. Das ist keine Deutung,
 * sondern die Umkehrung derselben Regel, die `pruefeInhaltsreferenzBindung` durchsetzt — ein
 * eigenes Feld in der Ablage waere eine zweite Wahrheit, die auseinanderlaufen kann.
 */
function quelleNachAussen(satz: ExternalSourceRecord) {
  const referenz = satz.rawOrRenderedContentReference;
  return {
    sourceRecordId: satz.sourceRecordId,
    sourceSystem: satz.sourceSystem,
    externalId: satz.externalId,
    sourceVersion: satz.sourceVersion,
    url: satz.url,
    title: satz.title,
    rawOrRenderedContentReference: referenz,
    contentReferenceState: referenz === null ? ("NOT_CAPTURED" as const) : ("AVAILABLE" as const),
    importedAt: satz.importedAt,
  };
}

/** Eine Elementreferenz auf der Leitung, samt des ehrlichen Gap-Paares (siehe Kopf). */
function elementNachAussen(ref: ImportRunItemRef) {
  return {
    importId: ref.importId,
    ordinal: ref.ordinal,
    sourceRecordId: ref.sourceRecordId,
    candidateItemId: ref.candidateItemId,
    knowledgeObjectId: ref.knowledgeObjectId,
    itemOutcome: ref.itemOutcome,
    itemFailureCode: ref.itemFailureCode,
    knowledgeGapRelationState: "RELATION_NOT_AVAILABLE" as const,
    knowledgeGapIds: null,
  };
}

export function importRunRoutes(deps: ImportRunRoutesDeps): FastifyPluginAsync {
  const { importRuns, externalSources, guards } = deps;

  /** Der eine Nicht-gefunden-Koerper. Ohne Kennung, ohne Fachinhalt — bewusst nichtssagend. */
  const nichtGefunden = { error: "NOT_FOUND", message: "Nicht gefunden." };

  return async (app) => {
    app.get<{ Params: { importId: string } }>(
      "/api/admin/import/runs/:importId",
      async (request, reply) => {
        // ERST das Recht. Siehe Entscheidung 1 im Kopf.
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const run = await importRuns.findById(request.params.importId);
        if (!run) {
          reply.code(404).send(nichtGefunden);
          return reply;
        }
        reply.code(200).send(laufNachAussen(run));
        return reply;
      },
    );

    app.get<{ Params: { importId: string } }>(
      "/api/admin/import/runs/:importId/result",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const run = await importRuns.findById(request.params.importId);
        if (!run) {
          reply.code(404).send(nichtGefunden);
          return reply;
        }
        // Die Quellrevision gibt es erst, wenn der Lauf eine geschrieben hat. `null` ist hier eine
        // Aussage („noch keine"), kein fehlendes Feld — das Ergebnis FUEHRT `source` immer.
        const quelle = run.sourceRecordId
          ? await externalSources.findById(run.sourceRecordId)
          : undefined;
        // `listItemRefs` gibt bereits stabil nach `ordinal` aufsteigend zurueck (repo.ts:569-570).
        // Die Reihenfolge ist Vertrag; sie wird hier nicht noch einmal umsortiert, sondern gehalten.
        const elemente = await importRuns.listItemRefs(run.importId);
        reply.code(200).send({
          run: laufNachAussen(run),
          source: quelle ? quelleNachAussen(quelle) : null,
          items: elemente.map(elementNachAussen),
        });
        return reply;
      },
    );

    app.get<{ Params: { sourceRecordId: string } }>(
      "/api/admin/import/source-records/:sourceRecordId",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const satz = await externalSources.findById(request.params.sourceRecordId);
        if (!satz) {
          reply.code(404).send(nichtGefunden);
          return reply;
        }
        reply.code(200).send(quelleNachAussen(satz));
        return reply;
      },
    );
  };
}

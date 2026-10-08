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
// `ImportRunItemRef` fuehrt keine Wissensluecken-Relation (types.ts:398-408). Ohne Lückenport ist
// der ehrliche Wert deshalb genau der kanonische Nichtwissen-Wert des Paares —
// `RELATION_NOT_AVAILABLE` mit `null` — und NICHT `AVAILABLE` mit `[]`. Die leere Liste hiesse
// „nachgesehen, es gibt keine"; ohne Port wurde aber gar nicht nachgesehen. `pruefeGapBindung`
// erzwingt das Paar; der Test ruft dieselbe Regel ueber die HTTP-Grenze auf.
//
// R-0142 (Lauf 5 R3): MIT Lückenport (`AskService.offeneLueckenZu`, verdrahtet in der
// Kompositionswurzel) wird nachgesehen — `AVAILABLE` mit den Kennungen der offenen Lücken, für
// deren Frage die Antwortsuche das Objekt heranzieht (`[]` = nachgesehen, keine). Wie viele offene
// Lücken geprüft wurden, steht daneben (`knowledgeGapScope`); ist das weniger als alle, ist die
// Liste eine Untergrenze.
import type { FastifyPluginAsync } from "fastify";
import { AskError, type Gap, redactGapForViewer } from "../../../ask";
import type { KoService } from "../../../knowledge-object";
import {
  type ExternalSourceRecord,
  type ExternalSourceRepo,
  type ImportRun,
  type ImportRunItemRef,
  type ImportRunRepo,
  importProviderKey,
} from "../../../library-analytics";
import type { Guards } from "../http";
import {
  type ImportRunSourceSync,
  InMemoryQuellabgleichRepo,
  type QuellabgleichRepo,
} from "../quellabgleich-ablage";
import { darfSehen } from "../sichtbarkeit";

export interface ImportRunRoutesDeps {
  readonly importRuns: ImportRunRepo;
  readonly externalSources: ExternalSourceRepo;
  /**
   * R-0162: die Ablage der Quellabgleiche. Die Kompositionswurzel reicht DIESELBE Ablage an die
   * Import-Routen, die sie beschreiben. Fehlt sie (Einzeltests ohne Abgleich), liest dieser Weg
   * eine eigene, leere Ablage — jeder Lauf trägt dann ehrlich `sourceSync: null`.
   */
  readonly quellabgleich?: QuellabgleichRepo;
  /**
   * R-0142 (Lauf 5): für das Importergebnis EINES Wissensobjekts. Fehlt er, gibt es die Route
   * `GET /api/admin/import/knowledge/:koId` nicht.
   */
  readonly koService?: KoService;
  /**
   * R-0142 (Lauf 5 R3, Bens B7): offene Lücken je Objekt (`AskService.offeneLueckenZu`). Fehlt der
   * Port, bleibt die Lückenbindung ehrlich `RELATION_NOT_AVAILABLE`.
   */
  readonly luecken?: {
    offeneLueckenZu(
      koIds: readonly string[],
    ): Promise<{ bezug: Map<string, Gap[]>; geprueft: number; offen: number }>;
  };
  readonly guards: Guards;
}

/**
 * Der Lauf auf der Leitung — Feld fuer Feld, damit nichts Internes mitreist.
 *
 * R-0162 (Runde 3): `sourceSync` ist der Quellabgleich des Laufs aus seiner eigenen Ablage
 * (`quellabgleich-ablage.ts`) — nur Quell-Kennungen. `null` heisst: dieser Lauf trägt keinen
 * (anderer Importweg oder Altlauf), nicht „nichts gelöscht".
 */
function laufNachAussen(run: ImportRun, abgleich: ImportRunSourceSync | undefined) {
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
    sourceSync: abgleich
      ? {
          checked: abgleich.checked,
          reason: abgleich.reason,
          removed: [...abgleich.removed],
          restored: [...abgleich.restored],
          outsideScope: [...abgleich.outsideScope],
          unchecked: [...abgleich.unchecked],
          attachmentsUpdated: [...abgleich.attachmentsUpdated],
          restrictionsUpdated: [...abgleich.restrictionsUpdated],
          syncFailed: [...abgleich.syncFailed],
          attachmentsIncomplete: [...abgleich.attachmentsIncomplete],
          counts: { ...abgleich.counts },
          listsTruncated: abgleich.listsTruncated,
        }
      : null,
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

/** Das Lücken-Paar auf der Leitung: ohne Port ehrlich nicht verfügbar, sonst die Kennungen. */
type LueckenPaar =
  | { knowledgeGapRelationState: "RELATION_NOT_AVAILABLE"; knowledgeGapIds: null }
  | { knowledgeGapRelationState: "AVAILABLE"; knowledgeGapIds: string[] };

const KEIN_LUECKENBEZUG: LueckenPaar = {
  knowledgeGapRelationState: "RELATION_NOT_AVAILABLE",
  knowledgeGapIds: null,
};

/** Eine Elementreferenz auf der Leitung, samt des ehrlichen Gap-Paares (siehe Kopf). */
function elementNachAussen(ref: ImportRunItemRef, luecken: LueckenPaar = KEIN_LUECKENBEZUG) {
  return {
    importId: ref.importId,
    ordinal: ref.ordinal,
    sourceRecordId: ref.sourceRecordId,
    candidateItemId: ref.candidateItemId,
    knowledgeObjectId: ref.knowledgeObjectId,
    itemOutcome: ref.itemOutcome,
    itemFailureCode: ref.itemFailureCode,
    ...luecken,
  };
}

export function importRunRoutes(deps: ImportRunRoutesDeps): FastifyPluginAsync {
  const { importRuns, externalSources, guards } = deps;
  const quellabgleich = deps.quellabgleich ?? new InMemoryQuellabgleichRepo();

  /**
   * R-0142 (Lauf 5 R3): das Lücken-Paar je Objekt, EINMAL je Anfrage erhoben. Nur Objekte, die
   * dieser Betrachter sehen darf, bekommen einen Bezug; alle anderen (und jeder Aufruf ohne Port)
   * tragen ehrlich `RELATION_NOT_AVAILABLE`. Die Lücken selbst reisen redigiert wie `/api/gaps`.
   *
   * Lauf 5 R4 (Bens B15): der Lückenbezug ist eine ZUGABE zum gespeicherten Importergebnis. Kann er
   * nicht erhoben werden — etwa weil die KI administrativ abgeschaltet ist und die Vorauswahl der
   * Antwortsuche deshalb gesperrt bleibt —, wird die Sperre NICHT umgangen: das Ergebnis wird
   * trotzdem ausgeliefert, mit `RELATION_NOT_AVAILABLE` und dem Grund `unavailableReason`
   * (`KI_ABGESCHALTET` bzw. `LUECKENBEZUG_FEHLER`).
   */
  const lueckenJeObjekt = async (
    user: Parameters<typeof darfSehen>[0],
    koIds: readonly string[],
  ): Promise<{
    paar: (koId: string) => LueckenPaar;
    sichten: (koId: string) => ReturnType<typeof redactGapForViewer>[];
    scope: { checkedOpenGaps: number; openGaps: number } | null;
    unavailableReason: "KI_ABGESCHALTET" | "LUECKENBEZUG_FEHLER" | null;
  }> => {
    const nichts = {
      paar: () => KEIN_LUECKENBEZUG,
      sichten: () => [],
      scope: null,
      unavailableReason: null,
    };
    if (!deps.luecken || !deps.koService || koIds.length === 0) {
      return nichts;
    }
    const sichtbar = new Set<string>();
    for (const id of new Set(koIds)) {
      const ko = await deps.koService.get(id);
      if (ko && darfSehen(user, ko)) {
        sichtbar.add(id);
      }
    }
    if (sichtbar.size === 0) {
      return nichts;
    }
    let erhoben: Awaited<ReturnType<NonNullable<typeof deps.luecken>["offeneLueckenZu"]>>;
    try {
      erhoben = await deps.luecken.offeneLueckenZu([...sichtbar]);
    } catch (err) {
      // `AskError` aus der Antwortdomäne; der Code wird auch gelesen, falls eine Zwischenschicht
      // (Suchprojektion) den Fehler unverändert, aber nicht als dieselbe Klasse weiterreicht.
      const kiAus =
        (err instanceof AskError && err.code === "KI_ABGESCHALTET") ||
        (err as { code?: unknown } | null)?.code === "KI_ABGESCHALTET";
      if (!kiAus) {
        process.stderr.write(
          `[KLARWERK] Lückenbezug des Importergebnisses nicht erhoben (fehler=${
            err instanceof Error ? err.name : "unknown"
          }) — Ergebnis ohne Lückenbezug ausgeliefert.\n`,
        );
      }
      return { ...nichts, unavailableReason: kiAus ? "KI_ABGESCHALTET" : "LUECKENBEZUG_FEHLER" };
    }
    const { bezug, geprueft, offen } = erhoben;
    // R-0585: Fragetext nur für Fragende und Zuständige — kein Rollenrecht (gap-visibility.ts).
    const betrachter = { viewerId: user.id };
    return {
      paar: (koId) =>
        sichtbar.has(koId)
          ? {
              knowledgeGapRelationState: "AVAILABLE",
              knowledgeGapIds: (bezug.get(koId) ?? []).map((g) => g.id),
            }
          : KEIN_LUECKENBEZUG,
      sichten: (koId) =>
        sichtbar.has(koId)
          ? (bezug.get(koId) ?? []).map((g) => redactGapForViewer(g, betrachter))
          : [],
      scope: { checkedOpenGaps: geprueft, openGaps: offen },
      unavailableReason: null,
    };
  };

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
        reply.code(200).send(laufNachAussen(run, await quellabgleich.lies(run.importId)));
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
        const luecken = await lueckenJeObjekt(
          user,
          elemente.map((e) => e.knowledgeObjectId).filter((id): id is string => id !== null),
        );
        reply.code(200).send({
          run: laufNachAussen(run, await quellabgleich.lies(run.importId)),
          source: quelle ? quelleNachAussen(quelle) : null,
          items: elemente.map((e) =>
            elementNachAussen(
              e,
              e.knowledgeObjectId ? luecken.paar(e.knowledgeObjectId) : KEIN_LUECKENBEZUG,
            ),
          ),
          ...(luecken.scope ? { knowledgeGapScope: luecken.scope } : {}),
          ...(luecken.unavailableReason
            ? { knowledgeGapUnavailableReason: luecken.unavailableReason }
            : {}),
        });
        return reply;
      },
    );

    // ============================================================================================
    // R-0142 (Lauf 5, Bens B7) — DAS IMPORTERGEBNIS EINES WISSENSOBJEKTS.
    // ============================================================================================
    //
    // Die Wissensseite ist die zusammenhängende Fläche (Original, Quellen, Validierung,
    // Widersprüche). Was ihr fehlte, war der Weg zurück in den Lauf: aus welcher Quellrevision das
    // Objekt stammt, in welchem Lauf sie aufgenommen wurde und mit welchem Ausgang die Entscheidung
    // es angelegt oder gebunden hat. Alles wird hier aus den autoritativen Ablagen GELESEN — die
    // Antwort erfindet nichts:
    //   · kein Herkunftsanker → 404 (dieses Objekt ist nicht importiert);
    //   · Anker, aber keine festgehaltene Revision (Import vor Lauf 5) → `source: null`;
    //   · Lauf unbekannt → `run: null`; keine Elementreferenz für dieses Objekt → `item: null`.
    // Lauf 5 R3 (Bens B11): der Lauf ist der der ANNAHME, die den Anker zuletzt geschrieben hat
    // (`importRunId` am Anker) — nicht der, der die Revision zuerst aufnahm. Die Revision ist die
    // der Elementreferenz. Anker ohne Laufkennung (Altbestand, Importe ohne Lauf) tragen `run: null`
    // — die Revision allein nennt keinen Lauf. Die Revision selbst kommt (Zusammenführung mit
    // R-0169) zuerst aus `sourceRecordId` am Anker, sonst über die Revisionsidentität mit
    // DEMSELBEN Schlüssel, mit dem sie geschrieben wird (`importProviderKey`).
    // Lücken: s. Kopf dieser Datei (`lueckenJeObjekt`).
    const koService = deps.koService;
    if (koService) {
      app.get<{ Params: { koId: string } }>(
        "/api/admin/import/knowledge/:koId",
        async (request, reply) => {
          const user = await guards.requirePermission("users.manage", request, reply);
          if (!user) {
            return reply;
          }
          const ko = await koService.get(request.params.koId);
          const anker = ko?.sources.find(
            (s) => typeof s.externalId === "string" && s.attachmentOf === undefined,
          );
          // Unsichtbar ist wie nicht vorhanden (dieselbe Regel wie die Wissensseite selbst).
          if (!ko || !darfSehen(user, ko) || !anker?.externalId) {
            reply.code(404).send(nichtGefunden);
            return reply;
          }
          const revision: ExternalSourceRecord | undefined = anker.sourceRecordId
            ? await externalSources.findById(anker.sourceRecordId)
            : typeof anker.sourceVersion === "number"
              ? await externalSources.findByRevision(
                  importProviderKey(anker.provider),
                  anker.externalId,
                  anker.sourceVersion,
                )
              : undefined;
          const importId = anker.importRunId ?? null;
          const run = importId ? await importRuns.findById(importId) : undefined;
          // Die jüngste Referenz dieses Laufs auf genau dieses Objekt.
          const ref = run
            ? (await importRuns.listItemRefs(run.importId))
                .filter((r) => r.knowledgeObjectId === ko.id)
                .pop()
            : undefined;
          const satz = ref?.sourceRecordId
            ? await externalSources.findById(ref.sourceRecordId)
            : revision;
          const luecken = await lueckenJeObjekt(user, [ko.id]);
          reply.code(200).send({
            knowledgeObjectId: ko.id,
            source: satz ? quelleNachAussen(satz) : null,
            run: run ? laufNachAussen(run, await quellabgleich.lies(run.importId)) : null,
            item: ref ? elementNachAussen(ref, luecken.paar(ko.id)) : null,
            ...luecken.paar(ko.id),
            knowledgeGaps: luecken.sichten(ko.id),
            knowledgeGapScope: luecken.scope,
            ...(luecken.unavailableReason
              ? { knowledgeGapUnavailableReason: luecken.unavailableReason }
              : {}),
          });
          return reply;
        },
      );
    }

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

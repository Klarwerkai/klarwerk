// ================================================================================================
// R-0170 — DIE DREI TÜREN DES JIRA-IMPORTS: VORGÄNGE UND EPICS ALS KANDIDATEN, ROLLEN ALS LESERECHTE.
// ================================================================================================
//
// Alle drei sind `users.manage`-gebunden, wie JEDE Import-Route dieses Produkts, und registriert
// werden sie NUR bei aktivem `KLARWERK_JIRA_IMPORT` — Schalter aus, Route existiert nicht.
//
//   TÜR 1 `issues`        → eine Seite der Vorgänge des Projekts zur Auswahl. READ-ONLY: kein
//                           Kandidat, kein Objekt, kein Lauf, kein Rollenabruf.
//   TÜR 2 `apply`         → die gewählten Vorgänge (höchstens `MAX_JIRA_KEYS`) abrufen und in die
//                           Prüf-Warteschlange stellen.
//   TÜR 3 `project-apply` → das GANZE Projekt, eine Ergebnisseite je Aufruf. Die Antwort trägt den
//                           Cursor auf die nächste Seite (`fortsetzung`); weiter geht es nur, wenn
//                           jemand ausdrücklich damit fragt. `projektAbgeschlossen` ist erst wahr,
//                           wenn Jira keine weitere Seite nennt. Der Cursor stammt aus der Antwort
//                           von Jira und wird vor jeder Verwendung geprüft.
//
// FEHLERCODES: `IMPORT_UNAVAILABLE` (503) heisst wie bei Confluence und SharePoint „für dieses
// Quellsystem sind keine (brauchbaren) Zugangsdaten hinterlegt". Die übrigen sind deckungsgleich mit
// den Lagen aus `services/jira`:
//
//     403 JIRA_FORBIDDEN        — das Konto darf das Projekt/den Vorgang nicht sehen
//     403 JIRA_ROLES_FORBIDDEN  — das Konto darf die Projektrollen nicht lesen; ohne Leserechte wird
//                                 nichts übernommen
//     404 JIRA_NOT_FOUND        — das Projekt gibt es dort nicht (mehr)
//     502 JIRA_UNREACHABLE      — Zugang abgelaufen oder Gegenstelle nicht brauchbar erreichbar
//
// KEIN ZWEITER IMPORT-KERN. Jede Tür endet bei `library.createImportCandidates` — es entsteht ein
// KANDIDAT, nie ein Wissensobjekt. Erst ein Mensch nimmt an. KEIN MODELL: diese Routen kennen keinen
// Reasoner.

import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger, FastifyPluginAsync, FastifyReply } from "fastify";
import {
  JIRA_PAGE_LIMIT,
  type JiraFehlerlage,
  type JiraItemSeite,
  type JiraSourceAdapter,
  createJiraAdapterFromEnv,
  jiraFehlerlage,
} from "../../../jira";
import type {
  ImportItem,
  ImportRun,
  ImportRunRepo,
  ImportRunStatus,
  LibraryService,
} from "../../../library-analytics";
import {
  importProviderKey,
  isOpenReviewStatus,
  sanitizeImportFailureReason,
} from "../../../library-analytics";
import type { Guards } from "../http";
import { sanitizeLogText } from "../log-sanitize";

export interface JiraImportRouteDeps {
  library: LibraryService;
  guards: Guards;
  /** Injizierbar für Tests; Standard = die Adapter-Factory aus der Umgebung. */
  makeAdapter?: () => JiraSourceAdapter | undefined;
  /** Die Laufablage. Die Kompositionswurzel reicht sie IMMER durch. */
  importRuns?: ImportRunRepo;
}

/** Harter Deckel der Schlüssel je Übernahme — jeder kostet einen Abruf. Drüber: ehrlicher 400. */
export const MAX_JIRA_KEYS = JIRA_PAGE_LIMIT;

/** Das Quellsystem dieser Routen — derselbe Name, den die Zugangs-Auskunft nachschlägt. */
const SYSTEM = "jira";

/** Die Abbildung Lage → Antwort. EINE Stelle, damit alle Türen dasselbe sagen. */
export function jiraAntwort(lage: JiraFehlerlage): { status: 403 | 404 | 502; error: string } {
  switch (lage) {
    case "keine-berechtigung":
      return { status: 403, error: "JIRA_FORBIDDEN" };
    case "rollen-nicht-lesbar":
      return { status: 403, error: "JIRA_ROLES_FORBIDDEN" };
    case "nicht-gefunden":
      return { status: 404, error: "JIRA_NOT_FOUND" };
    default:
      return { status: 502, error: "JIRA_UNREACHABLE" };
  }
}

/** Kurz und hostfrei — die Auskunft für Protokoll und Aufrufer ohne Oberfläche. */
const MELDUNG: Record<string, string> = {
  IMPORT_UNAVAILABLE: "Jira-Import nicht konfiguriert.",
  JIRA_FORBIDDEN: "Keine Leseberechtigung für diese Jira-Quelle.",
  JIRA_ROLES_FORBIDDEN:
    "Die Projektrollen (Leserechte) sind mit dem hinterlegten Konto nicht lesbar; es wurde nichts übernommen.",
  JIRA_NOT_FOUND: "Diese Jira-Quelle ist nicht mehr vorhanden.",
  JIRA_UNREACHABLE: "Der Jira-Zugang ist abgelaufen oder nicht erreichbar.",
};

function warne(log: FastifyBaseLogger, stelle: string, err: unknown): void {
  log.warn(
    { stelle, fehler: sanitizeLogText(err instanceof Error ? err.message : String(err)) },
    `jira-import: ${stelle} fehlgeschlagen`,
  );
}

/** Die Schlüssel aus dem Rumpf — dedupliziert, ohne Fremdtypen, Reihenfolge erhalten. */
function leseSchluessel(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const schluessel = raw
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && k.length <= 255);
  return [...new Set(schluessel)];
}

/**
 * Die Fortsetzung aus dem Rumpf: fehlt sie, beginnt es vorn (`null`); eine Zeichenkette, die der
 * Adapter deuten kann, ist der Cursor; alles andere ist ungültig (`undefined`).
 */
function leseFortsetzung(raw: unknown, adapter: JiraSourceAdapter): string | null | undefined {
  if (raw === undefined || raw === null) {
    return null;
  }
  return typeof raw === "string" && adapter.istGueltigeFortsetzung(raw) ? raw : undefined;
}

function nichtEingerichtet(reply: FastifyReply): FastifyReply {
  reply.code(503).send({ error: "IMPORT_UNAVAILABLE", message: MELDUNG.IMPORT_UNAVAILABLE });
  return reply;
}

function fortsetzungUngueltig(reply: FastifyReply): FastifyReply {
  reply.code(400).send({
    error: "FORTSETZUNG_INVALID",
    message: "Die Fortsetzung muss der angebotene Cursor einer vorigen Antwort sein.",
  });
  return reply;
}

/** Ein Fehler aus dem Modul wird zur Antwort. Kein fremder Text, kein Statusdurchgriff. */
function sendeLage(reply: FastifyReply, err: unknown): FastifyReply {
  const ausgang = jiraAntwort(jiraFehlerlage(err) ?? "nicht-erreichbar");
  reply.code(ausgang.status).send({
    error: ausgang.error,
    message: MELDUNG[ausgang.error] ?? "Jira-Abruf fehlgeschlagen.",
  });
  return reply;
}

export function jiraImportRoutes(deps: JiraImportRouteDeps): FastifyPluginAsync {
  const makeAdapter = deps.makeAdapter ?? (() => createJiraAdapterFromEnv());

  return async (app) => {
    // TÜR 1: eine Seite der Vorgänge des Projekts. READ-ONLY.
    app.post<{ Body: { fortsetzung?: unknown } }>(
      "/api/admin/import/jira/issues",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          return nichtEingerichtet(reply);
        }
        const weiter = leseFortsetzung(request.body?.fortsetzung, adapter);
        if (weiter === undefined) {
          return fortsetzungUngueltig(reply);
        }
        try {
          const { vorgaenge, weiter: naechste } = await adapter.listeVorgaenge(weiter);
          reply.code(200).send({ projekt: adapter.projectKey, vorgaenge, fortsetzung: naechste });
          return reply;
        } catch (err) {
          warne(request.log, "Vorgangsliste", err);
          return sendeLage(reply, err);
        }
      },
    );

    // TÜR 2: die gewählten Vorgänge abrufen und in die Prüf-Warteschlange stellen.
    app.post<{ Body: { keys?: unknown } }>(
      "/api/admin/import/jira/apply",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          return nichtEingerichtet(reply);
        }
        const keys = leseSchluessel(request.body?.keys);
        if (keys.length === 0) {
          reply.code(400).send({
            error: "APPLY_EMPTY_SELECTION",
            message: "Kein Vorgang ausgewählt.",
          });
          return reply;
        }
        if (keys.length > MAX_JIRA_KEYS) {
          reply.code(400).send({
            error: "APPLY_TOO_MANY",
            message: `Zu viele Vorgänge für eine Übernahme (${keys.length} von max. ${MAX_JIRA_KEYS}).`,
          });
          return reply;
        }
        const ausgang = await fuehreUebernahmeAus(
          deps,
          `project:${adapter.projectKey}`,
          keys.length,
          user.id,
          request.log,
          async (einreihen) => {
            const notFound: string[] = [];
            for (const key of keys) {
              try {
                const item = await adapter.holeItem(key);
                if (item) {
                  await einreihen(key, item);
                } else {
                  notFound.push(key);
                }
              } catch (err) {
                // Ein verschwundener Vorgang ist eine Auskunft über die Quelle, kein Fehler des
                // Laufs. Jede andere Lage (Zugang, Recht, Rollen) betrifft den GANZEN Lauf.
                if (jiraFehlerlage(err) === "nicht-gefunden") {
                  notFound.push(key);
                  continue;
                }
                throw err;
              }
            }
            return { notFound };
          },
        );
        reply.code(ausgang.code).send(ausgang.body);
        return reply;
      },
    );

    // TÜR 3: das ganze Projekt, eine Ergebnisseite je Aufruf, mit Halt nach jeder Seite.
    app.post<{ Body: { fortsetzung?: unknown } }>(
      "/api/admin/import/jira/project-apply",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          return nichtEingerichtet(reply);
        }
        const weiter = leseFortsetzung(request.body?.fortsetzung, adapter);
        if (weiter === undefined) {
          return fortsetzungUngueltig(reply);
        }
        // LESEN VOR JEDEM SCHREIBEFFEKT: scheitert schon die Seite (oder die Rollen), entsteht kein
        // Lauf und kein Kandidat.
        let seite: JiraItemSeite;
        try {
          seite = await adapter.itemSeite(weiter);
        } catch (err) {
          warne(request.log, "Projektseite", err);
          return sendeLage(reply, err);
        }
        const ausgang = await fuehreUebernahmeAus(
          deps,
          `project:${adapter.projectKey}`,
          seite.items.length + seite.unbrauchbar.length,
          user.id,
          request.log,
          async (einreihen) => {
            for (const item of seite.items) {
              await einreihen(item.externalId ?? item.title, item);
            }
            return { notFound: [...seite.unbrauchbar] };
          },
        );
        if (ausgang.code !== 200) {
          reply.code(ausgang.code).send(ausgang.body);
          return reply;
        }
        reply.code(200).send({
          ...ausgang.body,
          fortsetzung: seite.weiter,
          projektAbgeschlossen: seite.weiter === null,
        });
        return reply;
      },
    );
  };
}

/** Ein übernommener Vorgang im Ergebnisbild — genau das, was die Übernahme selbst gelesen hat. */
interface Uebernommen {
  readonly key: string;
  readonly titel: string;
  readonly url: string | null;
  readonly geaendertAm: string | null;
  /** Wie viele Benutzer- und Gruppenkennungen als Leserechte mitkamen. */
  readonly leserechte: { readonly benutzer: number; readonly gruppen: number };
}

type Einreihen = (ref: string, item: ImportItem) => Promise<void>;

type UebernahmeAusgang =
  | { readonly code: 200; readonly body: Record<string, unknown> }
  | { readonly code: 403 | 404 | 502; readonly body: { error: string; message: string } };

/**
 * Der EINE Übernahmeweg, den Tür 2 und Tür 3 teilen: Lauf anlegen, Items einreihen, Lauf schliessen.
 *
 * DREI AUSGÄNGE JE VORGANG, disjunkt: eingereiht (`imported`), schon da (`alreadyQueued` — derselbe
 * Stand wartet bereits offen oder ist bereits angenommen), gescheitert (`failed`, PII-frei) bzw.
 * nicht gefunden (`notFound`). Eine Lage, die den GANZEN Lauf betrifft (Zugang, Recht, Rollen),
 * bricht ab — weiterzumachen hiesse, dieselbe Antwort noch einmal zu holen.
 */
async function fuehreUebernahmeAus(
  deps: JiraImportRouteDeps,
  sourceScope: string,
  beauftragt: number,
  userId: string,
  log: FastifyBaseLogger,
  lauf: (einreihen: Einreihen) => Promise<{ notFound: string[] }>,
): Promise<UebernahmeAusgang> {
  let importId: string | null = null;
  try {
    let eingereiht = 0;
    let bereitsDa = 0;
    const failed: { key: string; reason: string }[] = [];
    const vorgaenge: Uebernommen[] = [];
    // Der Stand der Warteschlange, VOR dem ersten eigenen Schreibeffekt gelesen.
    const bekannt = await bekannteStaende(deps.library, log);
    importId = await legeLaufAn(deps.importRuns, sourceScope, beauftragt, log);
    const einreihen: Einreihen = async (ref, item) => {
      try {
        const stand = item.sourceVersion ?? 1;
        const schon =
          item.externalId === undefined
            ? undefined
            : bekannt.get(importProviderKey(item.provider))?.get(item.externalId);
        if (schon !== undefined && stand <= schon) {
          bereitsDa += 1;
          return;
        }
        const angelegt = await deps.library.createImportCandidates([item], userId);
        if (angelegt.length === 0) {
          bereitsDa += 1;
          return;
        }
        eingereiht += 1;
        vorgaenge.push({
          key: item.externalId ?? ref,
          titel: item.title,
          url: item.url ?? null,
          geaendertAm: item.updatedAt ?? null,
          leserechte: {
            benutzer: item.sourceRestrictions?.users.length ?? 0,
            gruppen: item.sourceRestrictions?.groups.length ?? 0,
          },
        });
      } catch (err) {
        failed.push({ key: ref, reason: err instanceof Error ? err.name : "unknown" });
      }
    };
    const { notFound } = await lauf(einreihen);
    const status: ImportRunStatus =
      failed.length > 0 || notFound.length > 0 ? "PARTIAL" : "COMPLETED";
    await schliesseLauf(
      deps.importRuns,
      importId,
      {
        status,
        completedAt: new Date().toISOString(),
        counters: {
          itemsTotal: beauftragt,
          itemsCreated: eingereiht,
          itemsBound: 0,
          itemsSkipped: bereitsDa,
          itemsFailed: failed.length + notFound.length,
        },
      },
      log,
    );
    return {
      code: 200,
      body: {
        imported: eingereiht,
        alreadyQueued: bereitsDa,
        failed,
        notFound,
        vorgaenge,
        ...(importId !== null ? { importId } : {}),
      },
    };
  } catch (err) {
    warne(log, "Uebernahme", err);
    const ausgang = jiraAntwort(jiraFehlerlage(err) ?? "nicht-erreichbar");
    const message = MELDUNG[ausgang.error] ?? "Jira-Übernahme fehlgeschlagen.";
    await schliesseLauf(
      deps.importRuns,
      importId,
      {
        status: "FAILED",
        completedAt: new Date().toISOString(),
        failureCode: ausgang.error,
        failureReason: sanitizeImportFailureReason(message),
      },
      log,
    );
    return { code: ausgang.status, body: { error: ausgang.error, message } };
  }
}

/**
 * Der höchste Quellstand je (Anbieter, Quellkennung), der bereits OFFEN wartet oder ANGENOMMEN zu
 * einem Wissensobjekt geworden ist — aus EINER Lesung der Warteschlange (dieselbe Regel wie beim
 * SharePoint-Weg, `leseStaende`). Ein unveränderter Vorgang wird damit nicht noch einmal eingereiht.
 * Scheitert die Lesung, ist die Karte leer: im Zweifel wird eingereiht und ein Mensch entscheidet.
 */
async function bekannteStaende(
  library: LibraryService,
  log: FastifyBaseLogger,
): Promise<ReadonlyMap<string, ReadonlyMap<string, number>>> {
  const karte = new Map<string, Map<string, number>>();
  try {
    for (const kandidat of await library.listImportCandidates()) {
      const externalId = kandidat.item.externalId;
      const zaehlt =
        isOpenReviewStatus(kandidat.status) ||
        (kandidat.status === "angenommen" && kandidat.koId !== null);
      if (!externalId || !zaehlt) {
        continue;
      }
      const anbieter = importProviderKey(kandidat.item.provider);
      const stand = kandidat.item.sourceVersion ?? 1;
      const jeAnbieter = karte.get(anbieter) ?? new Map<string, number>();
      if (stand > (jeAnbieter.get(externalId) ?? 0)) {
        jeAnbieter.set(externalId, stand);
      }
      karte.set(anbieter, jeAnbieter);
    }
  } catch (err) {
    warne(log, "Vorgaenge lesen", err);
    return new Map();
  }
  return karte;
}

/**
 * Legt den Übernahmelauf an — VOR dem ersten Schreibeffekt. `null` heisst „ohne Spur weitermachen"
 * (keine Ablage, oder die Ablage hat abgelehnt — dann geloggt); verlorene Vorgänge wären schlimmer.
 */
async function legeLaufAn(
  importRuns: ImportRunRepo | undefined,
  sourceScope: string,
  beauftragt: number,
  log: FastifyBaseLogger,
): Promise<string | null> {
  if (!importRuns) {
    return null;
  }
  const importId = randomUUID();
  const lauf: ImportRun = {
    importId,
    sourceSystem: SYSTEM,
    externalId: null,
    sourceScope,
    requestedSourceVersion: null,
    status: "QUEUED",
    sourceRecordId: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    failureCode: null,
    failureReason: null,
    counters: {
      itemsTotal: beauftragt,
      itemsCreated: 0,
      itemsBound: 0,
      itemsSkipped: 0,
      itemsFailed: 0,
    },
  };
  try {
    await importRuns.insertIfAbsent(lauf);
    return importId;
  } catch (err) {
    warne(log, "Uebernahmelauf anlegen", err);
    return null;
  }
}

/** Schreibt den Ausgang fort. Ein Ablagefehler bricht die Übernahme NICHT ab. */
async function schliesseLauf(
  importRuns: ImportRunRepo | undefined,
  importId: string | null,
  fortschritt: Parameters<ImportRunRepo["advance"]>[1],
  log: FastifyBaseLogger,
): Promise<void> {
  if (!importRuns || importId === null) {
    return;
  }
  try {
    await importRuns.advance(importId, fortschritt);
  } catch (err) {
    warne(log, `Uebernahmelauf schreiben (${importId})`, err);
  }
}

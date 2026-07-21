import type { FastifyPluginAsync } from "fastify";
import { type ConfluenceSourceAdapter, createConfluenceAdapterFromEnv } from "../../../confluence";
import type { KoService } from "../../../knowledge-object";
import {
  GROUP_PROMPT_MAX_UTF8_BYTES,
  type LibraryService,
  type SelectCriteria,
  candidateHints,
  candidateIdOf,
  deriveCriteriaFromPrompt,
  filterImportItems,
  groupPromptUtf8Bytes,
  groupingCandidates,
  groupingRequiresConfidential,
  sanitizeCriteria,
  summarizeImportItems,
  toPreviewEntry,
} from "../../../library-analytics";
import {
  MAX_GROUP_CANDIDATES,
  type Reasoner,
  deterministicCandidateGroups,
} from "../../../reasoner";
import {
  type ImportRunSummary,
  importStatusFor,
  importedAnchorVersions,
  pendingCandidateVersions,
  runConfluenceImport,
} from "../confluence-import";
import type { Guards } from "../http";
import { sanitizeLogText } from "../log-sanitize";

// SCRUM-510 WP2: Admin-Trigger für den Confluence-Space-Import. NUR bei aktivem KLARWERK_CONFLUENCE_IMPORT
// registriert (Flag OFF → Route existiert nicht). Echte Admin-Auth (users.manage, wie die übrigen
// Admin-Routen → vom routeGuardAudit-Scanner erfasst, kein Blindspot). Modi: dry-run (zählt/listet,
// schreibt nichts) und echt. REVIEW-INVARIANTE: alles landet nur als Kandidat, keine Auto-KOs.

export interface ConfluenceImportRouteDeps {
  library: LibraryService;
  koService: KoService;
  guards: Guards;
  // Injizierbar für Tests (Fixture-Adapter); Standard = env-basierte, gecappte Adapter-Factory.
  makeAdapter?: () => ConfluenceSourceAdapter | undefined;
  // IC-3: Reasoner für die optionale Prompt→Kriterien-Ableitung (READ-ONLY Auswahl-Vorschau). Ohne
  // Reasoner (oder ohne aktives Modell) greift nur der deterministische Klick-Filter.
  reasoner?: Reasoner;
}

// WP-SHIP7-FIX (bens sammel17-Fix 3): harter Deckel der Apply-Ids je Aufruf (nach Dedupe) —
// deckungsgleich mit der Gruppierungs-Kappung (MAX_GROUP_CANDIDATES = 200). Drüber: ehrlicher 400.
export const MAX_APPLY_IDS = 200;

export function confluenceImportRoutes(deps: ConfluenceImportRouteDeps): FastifyPluginAsync {
  const makeAdapter = deps.makeAdapter ?? (() => createConfluenceAdapterFromEnv());

  // WP-IC-PAKET-1b (bens ROT-3): kurzlebiger SNAPSHOT-Cache NUR für die READ-ONLY Erkundungs-/
  // Vorschau-Routen. Die Live-Trefferzahl (debounced Filter-Änderungen) feuerte sonst je Änderung
  // einen VOLLEN Quell-Scan (adapter.collectAll) — langsam, Rate-Limit-Risiko und racy: zwei Scans
  // können sich überholen und liefern verschiedene Datenbasen in die Vorschau. Der Snapshot hält die
  // Filterung auf EINER geladenen Datenbasis. TTL bewusst 60 s: lang genug für einen kompletten
  // Filter-Klick-Zyklus, kurz genug, dass eine neue Erkundung frische Quelldaten sieht. Es gibt genau
  // EINE konfigurierte Quelle und die Routen sind admin-only (users.manage) → ein Cache je
  // Routen-Registrierung genügt („pro Quelle"). Als PROMISE gecacht, damit auch zeitgleiche erste
  // Aufrufe denselben Scan teilen (kein Doppel-Scan); Fehler werden NICHT gecacht. Der ECHTE Import
  // (runConfluenceImport) liest weiterhin IMMER frisch; Import-Status/Markierung wird je Request
  // frisch aus den Repos gelesen — nur die Quell-Items sind gecacht.
  // WP-IC-PAKET-1c (bens Mini-Härtung): ein LAUFENDER Scan (at === null) wird UNABHÄNGIG von der TTL
  // geteilt — die TTL startet erst mit dem ERFOLG (sonst könnte ein langsamer Scan seine eigene TTL
  // aufbrauchen und direkt nach Abschluss einen zweiten Vollscan auslösen).
  const SNAPSHOT_TTL_MS = 60_000;
  type CollectAllResult = Awaited<ReturnType<ConfluenceSourceAdapter["collectAll"]>>;
  let snapshot: {
    at: number | null;
    token: number;
    promise: Promise<CollectAllResult>;
  } | null = null;
  // WP-SHIP7-FIX (bens sammel17-GELB, „EIN Snapshot je Apply-Lauf"): jeder frische Scan bekommt
  // einen monotonen Token; die letzten ERFOLGREICHEN Snapshots bleiben (über die TTL hinaus)
  // referenzierbar. /group gibt den Token an den Client; JEDER Apply-Batch desselben Laufs wird
  // aus GENAU diesem festgehaltenen Snapshot bedient — kein Batch sieht eine andere Datenbasis
  // (row-N-Ids bleiben stabil, notFound bleibt ehrlich). Unbekannter Token → ehrlicher 409.
  let snapshotTokenCounter = 0;
  const RETAINED_SNAPSHOTS = 2;
  const retainedSnapshots = new Map<number, CollectAllResult>();
  function collectSnapshotWithToken(adapter: ConfluenceSourceAdapter): {
    token: number;
    promise: Promise<CollectAllResult>;
  } {
    if (snapshot !== null && (snapshot.at === null || Date.now() - snapshot.at < SNAPSHOT_TTL_MS)) {
      return { token: snapshot.token, promise: snapshot.promise };
    }
    const promise = adapter.collectAll();
    snapshotTokenCounter += 1;
    const entry: { at: number | null; token: number; promise: Promise<CollectAllResult> } = {
      at: null,
      token: snapshotTokenCounter,
      promise,
    };
    snapshot = entry;
    promise.then(
      (result) => {
        // Erfolg: TTL läuft AB JETZT (nicht ab Scan-Start); Snapshot für Apply-Läufe festhalten.
        if (snapshot === entry) {
          entry.at = Date.now();
        }
        retainedSnapshots.set(entry.token, result);
        for (const key of retainedSnapshots.keys()) {
          if (retainedSnapshots.size <= RETAINED_SNAPSHOTS) {
            break;
          }
          retainedSnapshots.delete(key);
        }
      },
      () => {
        // Fehlgeschlagene Scans nicht festhalten — nächster Aufruf versucht es frisch.
        if (snapshot === entry) {
          snapshot = null;
        }
      },
    );
    return { token: entry.token, promise };
  }
  function collectSnapshot(adapter: ConfluenceSourceAdapter): Promise<CollectAllResult> {
    return collectSnapshotWithToken(adapter).promise;
  }

  return async (app) => {
    // WP-E (19.07.2026): JEDER Sende-Pfad endet mit `return reply`. Reply ist ein Thenable — die
    // Handler-Promise adoptiert es und resolved erst NACH Response-Ende; Fastifys Promise-Abschluss
    // (wrap-thenable) sieht dann sent=true und sendet nie ein zweites Mal. Resolved der Handler
    // stattdessen mit undefined, sendet wrap-thenable erneut, sobald globale async-onSend-Hooks das
    // writeHead über die Handler-Resolution hinaus verzögern (≥2 async-Hops) → ERR_HTTP_HEADERS_SENT
    // als unhandled rejection → Prozess-Crash. Der systemische Schutz (globale onSend-Hooks synchron)
    // liegt in addin-static-routes.ts/server.ts; `return reply` ist die handler-lokale Absicherung.
    app.post<{ Body: { dryRun?: boolean } }>(
      "/api/admin/import/confluence",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          reply.code(503).send({
            error: "IMPORT_UNAVAILABLE",
            message: "Confluence-Import nicht konfiguriert.",
          });
          return reply;
        }
        const dryRun = request.body?.dryRun === true;
        try {
          const summary: ImportRunSummary = await runConfluenceImport({
            adapter,
            library: deps.library,
            koService: deps.koService,
            dryRun,
            actor: user.id,
          });
          reply.code(200).send(summary);
          return reply;
        } catch (err) {
          // WP-E: Ursache server-seitig sichtbar machen (analog importDetectionLog) — NUR die Message
          // (vom rest-client bereits via redactedError/redactSecrets redigiert), NIE Stack oder cause.
          // WP-E2: zusätzlich senkenseitig sanitisiert (zweite Verteidigungslinie, quellen-agnostisch).
          console.warn(
            "[confluence-import] fehlgeschlagen:",
            sanitizeLogText(err instanceof Error ? err.message : String(err)),
          );
          // Never block: ehrlicher Fehlerstatus, KEINE Interna/Token im Body.
          reply
            .code(502)
            .send({ error: "IMPORT_FAILED", message: "Confluence-Import fehlgeschlagen." });
          return reply;
        }
      },
    );

    // IC-1 (Import-Cockpit): READ-ONLY Erkundung — „was ist da" VOR jedem Import. Liest den Space
    // (collectAll), aggregiert Mengen/Autoren/Themen/Zeitraum und gibt sie zurück. Schreibt NICHTS:
    // keine Kandidaten, keine KOs, kein Object-Store. Gleiche Admin-Auth (users.manage), gleiche
    // Fehler-/Flag-Disziplin wie die Import-Route (503 ohne Adapter, 502 bei Lesefehler, sanitisiertes
    // Log). WP-E-Regel: JEDER Sende-Pfad endet mit `return reply`.
    app.post("/api/admin/import/confluence/explore", async (request, reply) => {
      const user = await deps.guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return reply;
      }
      const adapter = makeAdapter();
      if (!adapter) {
        reply.code(503).send({
          error: "IMPORT_UNAVAILABLE",
          message: "Confluence-Import nicht konfiguriert.",
        });
        return reply;
      }
      try {
        // READ-ONLY: nur lesen + aggregieren (WP-IC-PAKET-1b ROT-3: über den 60-s-Snapshot).
        const { items, truncated } = await collectSnapshot(adapter);
        // WP-IC-PAKET-1 (Teil 4, IC-6a): ehrlicher Import-Abgleich über die Quell-Referenzen
        // (KoSource-Anker + offene Kandidaten, provider-scoped) — „X Seiten, davon Y bereits importiert".
        const [anchorVersions, pendingVersions] = await Promise.all([
          importedAnchorVersions(deps.koService),
          pendingCandidateVersions(deps.library),
        ]);
        const alreadyImported = items.filter(
          (item) => importStatusFor(item, anchorVersions, pendingVersions).alreadyImported,
        ).length;
        reply.code(200).send({ summary: summarizeImportItems(items), truncated, alreadyImported });
        return reply;
      } catch (err) {
        // Gleiche Beobachtbarkeit/Redaction wie der Import-Pfad (WP-E/WP-E2).
        console.warn(
          "[confluence-explore] fehlgeschlagen:",
          sanitizeLogText(err instanceof Error ? err.message : String(err)),
        );
        reply
          .code(502)
          .send({ error: "EXPLORE_FAILED", message: "Confluence-Erkundung fehlgeschlagen." });
        return reply;
      }
    });

    // IC-3 (Import-Cockpit): READ-ONLY Auswahl-VORSCHAU. Der Nutzer grenzt per Freitext-Prompt UND/ODER
    // Klick-Kriterien ein; wir leiten aus dem Prompt (falls gesetzt) über den Reasoner Kriterien ab
    // (KI aus/unsicher → leer, nur Klick-Filter), verbinden sie mit den gelieferten Kriterien, filtern
    // deterministisch und geben eine VORSCHAU zurück — inkl. der EFFEKTIV benutzten Kriterien
    // (Transparenz: wie hat die KI den Satz verstanden?). SCHREIBT NICHTS (keine Kandidaten, keine KOs).
    // Gleiche Admin-Auth + Fehler-/Flag-Disziplin wie explore. WP-E: JEDER Sende-Pfad endet mit `return reply`.
    app.post<{ Body: { prompt?: string; criteria?: unknown } }>(
      "/api/admin/import/confluence/select",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          reply.code(503).send({
            error: "IMPORT_UNAVAILABLE",
            message: "Confluence-Import nicht konfiguriert.",
          });
          return reply;
        }
        try {
          const prompt = typeof request.body?.prompt === "string" ? request.body.prompt : "";
          // Klick-Kriterien immer sanitisieren; aus dem Prompt zusätzlich KI-Kriterien ableiten.
          const clickCriteria = sanitizeCriteria(request.body?.criteria);
          const reasoner = deps.reasoner;
          const promptCriteria =
            prompt.trim().length > 0 && reasoner
              ? await deriveCriteriaFromPrompt(prompt, (p) => reasoner.deriveImportCriteria(p))
              : {};
          // Effektiv genutzte Kriterien: Klick-Kriterien haben Vorrang, KI ergänzt nur Fehlendes.
          const criteria: SelectCriteria = { ...promptCriteria, ...clickCriteria };
          // READ-ONLY: nur lesen + filtern (WP-IC-PAKET-1b ROT-3: Filterung auf dem 60-s-Snapshot —
          // jede Live-Filter-Änderung arbeitet auf DERSELBEN geladenen Datenbasis, kein Scan-Race).
          const { items, truncated } = await collectSnapshot(adapter);
          const { selected, matched, limited } = filterImportItems(items, criteria);
          // WP-IC-PAKET-1 (Teil 4, IC-6a): jeden Vorschau-Eintrag ehrlich markieren (Quell-Referenz-
          // Abgleich, je Request frisch); `alreadyImported` zählt die markierten Einträge der Vorschau.
          const [anchorVersions, pendingVersions] = await Promise.all([
            importedAnchorVersions(deps.koService),
            pendingCandidateVersions(deps.library),
          ]);
          const preview = selected.map((item) =>
            toPreviewEntry(item, importStatusFor(item, anchorVersions, pendingVersions)),
          );
          reply.code(200).send({
            matched,
            limited,
            truncated,
            criteria,
            preview,
            alreadyImported: preview.filter((entry) => entry.alreadyImported === true).length,
          });
          return reply;
        } catch (err) {
          console.warn(
            "[confluence-select] fehlgeschlagen:",
            sanitizeLogText(err instanceof Error ? err.message : String(err)),
          );
          reply
            .code(502)
            .send({ error: "SELECT_FAILED", message: "Confluence-Auswahl fehlgeschlagen." });
          return reply;
        }
      },
    );

    // WP-IC-4 (Schritt 4): KI-GRUPPIERUNG der eingegrenzten Kandidaten. BEWUSST eine eigene Route
    // NEBEN dem Reasoner-Dispatcher (Begründung): sie braucht den Import-Kontext (Snapshot,
    // IC-6a-Statusabgleich, Feature-Flag) und denselben Admin-Guard (users.manage) wie explore/
    // select — der generische Dispatcher (ko.read) hat all das nicht. Der REASONER-TASK selbst
    // (group) folgt trotzdem vollständig dem Task-Muster (ModelRun-Protokoll, KI-Verwaltung,
    // Vertraulichkeits-Routing, ehrlicher deterministischer Fallback). READ-ONLY: schreibt nichts.
    app.post<{ Body: { criteria?: unknown; locale?: string } }>(
      "/api/admin/import/confluence/group",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          reply.code(503).send({
            error: "IMPORT_UNAVAILABLE",
            message: "Confluence-Import nicht konfiguriert.",
          });
          return reply;
        }
        try {
          const locale = request.body?.locale === "en" ? ("en" as const) : ("de" as const);
          const criteria = sanitizeCriteria(request.body?.criteria);
          const snap = collectSnapshotWithToken(adapter);
          const { items } = await snap.promise;
          const { selected } = filterImportItems(items, criteria);
          // Harte Server-Kappung mit EHRLICHER Meldung — kein stilles Kappen.
          if (selected.length > MAX_GROUP_CANDIDATES) {
            reply.code(400).send({
              error: "GROUP_TOO_MANY",
              message: `Zu viele Kandidaten für die Gruppierung (${selected.length} von max. ${MAX_GROUP_CANDIDATES}) — bitte die Auswahl weiter eingrenzen.`,
            });
            return reply;
          }
          const [anchorVersions, pendingVersions] = await Promise.all([
            importedAnchorVersions(deps.koService),
            pendingCandidateVersions(deps.library),
          ]);
          const nowMs = Date.now();
          const candidates = selected.map((item, index) => {
            const status = importStatusFor(item, anchorVersions, pendingVersions);
            return {
              id: candidateIdOf(item, index),
              title: item.title,
              ...(item.textCodec === "decoded" ? { textCodec: "decoded" as const } : {}),
              alreadyImported: status.alreadyImported,
              // WP-IC-6b (Pedis Entscheid: Versionierung): die Quelle ist NEUER als der Import —
              // solche Kandidaten sind als „Aktualisierung importieren" wählbar (nicht vorab
              // abgewählt); die Übernahme wird beim Review als neue Version des bestehenden KOs
              // angenommen (bestehender acceptToKo-Re-Sync via revise).
              sourceNewer: status.sourceNewer,
              // Rein deterministische Qualitätshinweise (Dublette/veraltet/wenig Inhalt).
              hints: candidateHints(item, status.alreadyImported, nowMs),
            };
          });
          const inputs = groupingCandidates(selected);
          // WP-SHIP7-FIX (GELB): der harte UTF-8-Gesamtdeckel — groupingCandidates kappt bereits
          // stufenweise (Texte, dann Titel); bleibt selbst die Minimalform drüber (pathologisch
          // lange Ids), wird EHRLICH abgelehnt statt still übertragen.
          if (groupPromptUtf8Bytes(inputs) > GROUP_PROMPT_MAX_UTF8_BYTES) {
            reply.code(400).send({
              error: "GROUP_TOO_LARGE",
              message:
                "Die Kandidatendaten sind zu umfangreich für die Gruppierung — bitte die Auswahl weiter eingrenzen.",
            });
            return reply;
          }
          // WP-SHIP7-FIX (bens P0, Fix 1): ECHTE Import-Vertraulichkeit statt pauschal false.
          // Ganz-oder-gar-nicht-Batch-Vertrag (groupingRequiresConfidential): EIN vertraulicher/
          // unklassifizierter/ungültiger Kandidat → die GESAMTE Gruppierung läuft vertraulich,
          // die Provider-Kette nimmt die Cloud heraus (SCRUM-502-Routing im Reasoner).
          const confidential = groupingRequiresConfidential(selected);
          const grouped = deps.reasoner
            ? await deps.reasoner.groupCandidates(inputs, locale, confidential)
            : {
                groups: deterministicCandidateGroups(inputs, locale),
                demo: true,
                fallbackReason: "no-model" as const,
              };
          reply.code(200).send({
            groups: grouped.groups,
            candidates,
            demo: grouped.demo,
            // Der Apply-Lauf bedient sich aus GENAU diesem Snapshot (Token-Pin, s. /apply).
            snapshotToken: snap.token,
            ...(grouped.fallbackReason ? { fallbackReason: grouped.fallbackReason } : {}),
          });
          return reply;
        } catch (err) {
          console.warn(
            "[confluence-group] fehlgeschlagen:",
            sanitizeLogText(err instanceof Error ? err.message : String(err)),
          );
          reply
            .code(502)
            .send({ error: "GROUP_FAILED", message: "Confluence-Gruppierung fehlgeschlagen." });
          return reply;
        }
      },
    );

    // WP-IC-4 (Schritt 5): AUSWAHL ÜBERNEHMEN — startet den BESTEHENDEN Import-Weg
    // (createImportCandidates → Review-Queue; REVIEW-INVARIANTE bleibt: menschliches OK im Review,
    // keine Auto-KOs). Der Client schickt die freigegebenen Ids (ggf. in Batches für ehrlichen
    // Fortschritt); die Antwort ist die ehrliche Teil-Bilanz dieses Aufrufs: übernommen,
    // fehlgeschlagen (mit PII-freiem Grund je Id), nicht mehr in der Auswahl gefunden.
    app.post<{ Body: { criteria?: unknown; includeIds?: unknown; snapshotToken?: unknown } }>(
      "/api/admin/import/confluence/apply",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          reply.code(503).send({
            error: "IMPORT_UNAVAILABLE",
            message: "Confluence-Import nicht konfiguriert.",
          });
          return reply;
        }
        try {
          const criteria = sanitizeCriteria(request.body?.criteria);
          const rawIds = Array.isArray(request.body?.includeIds) ? request.body.includeIds : [];
          // WP-SHIP7-FIX (Fix 3): serverseitig DEDUPLIZIEREN (doppelte Ids einmal verarbeiten) …
          const includeIds = [
            ...new Set(rawIds.filter((id): id is string => typeof id === "string")),
          ];
          // … und hart deckeln — drüber ehrlicher 400 statt eines unbegrenzten Schreiblaufs.
          if (includeIds.length > MAX_APPLY_IDS) {
            reply.code(400).send({
              error: "APPLY_TOO_MANY",
              message: `Zu viele Ids für die Übernahme (${includeIds.length} von max. ${MAX_APPLY_IDS}).`,
            });
            return reply;
          }
          // WP-SHIP7-FIX (GELB, „EIN Snapshot je Lauf"): der Client reicht den snapshotToken der
          // Gruppierung mit — ALLE Batches eines Laufs werden aus GENAU diesem festgehaltenen
          // Snapshot bedient (stabile row-N-Ids, ehrliches notFound). Unbekannter/abgelaufener
          // Token → ehrlicher 409 (neu gruppieren). Ohne Token: frischer/gecachter Snapshot.
          const rawToken = request.body?.snapshotToken;
          let items: CollectAllResult["items"];
          if (typeof rawToken === "number") {
            const retained = retainedSnapshots.get(rawToken);
            if (!retained) {
              reply.code(409).send({
                error: "SNAPSHOT_EXPIRED",
                message:
                  "Die Datengrundlage der Gruppierung ist abgelaufen — bitte neu gruppieren.",
              });
              return reply;
            }
            items = retained.items;
          } else {
            items = (await collectSnapshot(adapter)).items;
          }
          const { selected } = filterImportItems(items, criteria);
          const byId = new Map(selected.map((item, index) => [candidateIdOf(item, index), item]));
          // WP-IC-6b: Status-Wissen VOR dem Lauf — „Aktualisierungen" (Quelle neuer als Import)
          // zählen in der Bilanz separat (Teilmenge von imported, der Bilanz-Vertrag bleibt exakt).
          const [applyAnchors, applyPending] = await Promise.all([
            importedAnchorVersions(deps.koService),
            pendingCandidateVersions(deps.library),
          ]);
          let imported = 0;
          let updates = 0;
          let alreadyQueued = 0;
          const failed: { id: string; reason: string }[] = [];
          const notFound: string[] = [];
          for (const id of includeIds) {
            const item = byId.get(id);
            if (!item) {
              notFound.push(id);
              continue;
            }
            try {
              // BESTEHENDER Weg: Kandidat in die Review-Queue (stempelt textCodec, IC-6a-Dedupe-
              // Markierung läuft dort wie gehabt) — pro Item, damit Fehlschläge zuordenbar sind.
              // WP-SHIP7-FIX (Fix 3): die Rückgabe zählt EHRLICH — nur tatsächlich eingereihte
              // Kandidaten sind „importiert"; ein idempotenter No-op (bereits offener Kandidat
              // derselben externalId/Version, z. B. Retry/Parallel-Lauf) wird SEPARAT ausgewiesen.
              const created = await deps.library.createImportCandidates([item], user.id);
              if (created.length > 0) {
                imported += 1;
                if (importStatusFor(item, applyAnchors, applyPending).sourceNewer) {
                  updates += 1;
                }
              } else {
                alreadyQueued += 1;
              }
            } catch (err) {
              // PII-frei: nur Id + Fehlerklasse, nie Inhalte.
              failed.push({ id, reason: err instanceof Error ? err.name : "unknown" });
            }
          }
          reply.code(200).send({ imported, updates, alreadyQueued, failed, notFound });
          return reply;
        } catch (err) {
          console.warn(
            "[confluence-apply] fehlgeschlagen:",
            sanitizeLogText(err instanceof Error ? err.message : String(err)),
          );
          reply
            .code(502)
            .send({ error: "APPLY_FAILED", message: "Confluence-Übernahme fehlgeschlagen." });
          return reply;
        }
      },
    );
  };
}

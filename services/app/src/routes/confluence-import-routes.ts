import type { FastifyPluginAsync } from "fastify";
import { type ConfluenceSourceAdapter, createConfluenceAdapterFromEnv } from "../../../confluence";
import type { KoService } from "../../../knowledge-object";
import {
  type LibraryService,
  type SelectCriteria,
  deriveCriteriaFromPrompt,
  filterImportItems,
  sanitizeCriteria,
  summarizeImportItems,
  toPreviewEntry,
} from "../../../library-analytics";
import type { Reasoner } from "../../../reasoner";
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
  const SNAPSHOT_TTL_MS = 60_000;
  type CollectAllResult = Awaited<ReturnType<ConfluenceSourceAdapter["collectAll"]>>;
  let snapshot: { at: number; promise: Promise<CollectAllResult> } | null = null;
  function collectSnapshot(adapter: ConfluenceSourceAdapter): Promise<CollectAllResult> {
    if (snapshot !== null && Date.now() - snapshot.at < SNAPSHOT_TTL_MS) {
      return snapshot.promise;
    }
    const promise = adapter.collectAll();
    const entry = { at: Date.now(), promise };
    snapshot = entry;
    promise.catch(() => {
      // Fehlgeschlagene Scans nicht 60 s festhalten — nächster Aufruf versucht es frisch.
      if (snapshot === entry) {
        snapshot = null;
      }
    });
    return promise;
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
  };
}

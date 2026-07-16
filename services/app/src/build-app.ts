import cors, { type FastifyCorsOptions } from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import type { Pool } from "pg";
import { AskService, type GapRepo, InMemoryGapRepo, PgGapRepo } from "../../ask";
import { type AuditRepo, AuditService, InMemoryAuditRepo, PgAuditRepo } from "../../audit";
import {
  AuthService,
  InMemoryPasswordResetRepo,
  InMemorySessionRepo,
  InMemoryUserRepo,
  type PasswordResetRepo,
  PgPasswordResetRepo,
  PgSessionRepo,
  PgUserRepo,
  type SessionRepo,
  type UserRepo,
  authRoutes,
  createOidcProviderFromEnv,
} from "../../auth";
import { CaptureService, type DraftRepo, InMemoryDraftRepo, PgDraftRepo } from "../../capture";
import {
  type ConflictRepo,
  ConflictService,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  InMemoryOverlapSettingsRepo,
  type OverlapRepo,
  OverlapService,
  type OverlapSettingsRepo,
  PgConflictRepo,
  PgOverlapRepo,
  PgOverlapSettingsRepo,
} from "../../conflicts";
import { InMemoryEmbeddingStore, createEmbeddingProviderFromEnv } from "../../embedding";
import {
  type ExternalKnowledgePolicyRepo,
  type ExternalSearchService,
  InMemoryExternalKnowledgePolicyRepo,
  PgExternalKnowledgePolicyRepo,
  createExternalSearchFromEnv,
} from "../../external-search";
import { I18nService } from "../../i18n";
import {
  type EvidenceRepo,
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  InMemoryUploadLimitsRepo,
  type KoRepo,
  KoService,
  type KoVersionRepo,
  PgEvidenceRepo,
  PgKoRepo,
  PgKoVersionRepo,
  PgUploadLimitsRepo,
  type UploadLimitsRepo,
} from "../../knowledge-object";
import {
  type CandidateRepo,
  InMemoryCandidateRepo,
  LibraryService,
  PgCandidateRepo,
} from "../../library-analytics";
import {
  InMemoryLifecycleRepo,
  type LifecycleRepo,
  LifecycleService,
  PgLifecycleRepo,
} from "../../lifecycle";
import { ManagementService } from "../../management";
import { MediaAnalysisService, createTranscriberFromEnv } from "../../media";
import {
  InMemoryModelRunRepo,
  type ModelRunRepo,
  ModelRunService,
  PgModelRunRepo,
} from "../../model-runs";
import {
  ConsoleMailer,
  InMemoryNotificationSeenRepo,
  type Mailer,
  type NotificationSeenRepo,
  PgNotificationSeenRepo,
  createMailerFromEnv,
} from "../../notifications";
import { InMemoryObjectRepo, type ObjectRepo, ObjectStore, PgObjectRepo } from "../../object-store";
import { OutputService } from "../../output";
// SCRUM-443: echte Rollenwechsel-Regel (FR-RBAC-03) in den AuthService injizieren.
import { canChangeRole } from "../../rbac";
import {
  type AssistPresetRepo,
  InMemoryAssistPresetRepo,
  ModelCapacityError,
  ModelProvider,
  PgAssistPresetRepo,
  Reasoner,
  cappedModelClient,
  createLocalClientFromEnv,
  createModelClientFromEnv,
} from "../../reasoner";
import {
  type AssignmentRepo,
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  InMemoryValidationSettingsRepo,
  PgAssignmentRepo,
  PgRatingRepo,
  PgValidationSettingsRepo,
  type RatingRepo,
  ValidationService,
  type ValidationSettingsRepo,
} from "../../validation";
import {
  ADDON_ASK_PATH,
  ADDON_CHECK_TEXT_PATH,
  ADDON_KEY_HEADER,
  addonApiEnabled,
  resolveAddonOrigin,
} from "./addon-api";
import { matchAddonRoute, principalHasCapability, resolveAddonAuth } from "./addon-principal";
import type { SemanticPrefilter } from "./duplicate-detection";
import { cappedEmbeddingProvider } from "./embed-concurrency";
import type { FactoryReset } from "./factory-reset";
import { makeGuards } from "./http";
import { impactReport } from "./impact";
import { makeAssignmentNotifier } from "./notify";
import { adminRoutes } from "./routes/admin-routes";
import { askRoutes } from "./routes/ask-routes";
import { auditRoutes } from "./routes/audit-routes";
import { captureRoutes } from "./routes/capture-routes";
import { checkTextRoutes } from "./routes/check-text-routes";
import { conflictRoutes } from "./routes/conflicts-routes";
import { externalRoutes } from "./routes/external-routes";
import { helpRoutes } from "./routes/help-routes";
import { i18nRoutes } from "./routes/i18n-routes";
import { koRoutes } from "./routes/ko-routes";
import { libraryRoutes } from "./routes/library-routes";
import { lifecycleRoutes } from "./routes/lifecycle-routes";
import { livewallRoutes } from "./routes/livewall-routes";
import { managementRoutes } from "./routes/management-routes";
import { mediaRoutes } from "./routes/media-routes";
import { modelRunRoutes } from "./routes/model-runs-routes";
import { notificationsRoutes } from "./routes/notifications-routes";
import { objectRoutes } from "./routes/object-routes";
import { outputRoutes } from "./routes/output-routes";
import { overlapRoutes } from "./routes/overlap-routes";
import { reasonerRoutes } from "./routes/reasoner-routes";
import { validationRoutes } from "./routes/validation-routes";

// Composition-Root des modularen Monolithen: verdrahtet ALLE Module zu EINER App.
// Jeder Import läuft über die öffentliche index.ts des jeweiligen Moduls.
export interface AppServices {
  auth: AuthService;
  ko: KoService;
  reasoner: Reasoner;
  audit: AuditService;
  capture: CaptureService;
  ask: AskService;
  validation: ValidationService;
  conflicts: ConflictService;
  // Berater-Konzept Duplikate 04.07. (Stufe D3): Überschneidungs-/Duplikat-Erkennung (eigene Entität).
  overlaps: OverlapService;
  // Pedi 04.07.: einstellbare Anzeige-Schwelle der Duplikat-Erkennung (Admin) — schmale Repo-Schnittstelle.
  overlapSettings: OverlapSettingsRepo;
  library: LibraryService;
  output: OutputService;
  management: ManagementService;
  // SCRUM-118: optionaler externer Such-Proxy (undefined, wenn EXTERNAL_SEARCH=off).
  externalSearch: ExternalSearchService | undefined;
  lifecycle: LifecycleService;
  i18n: I18nService;
  objects: ObjectStore;
  media: MediaAnalysisService;
  // SCRUM-165: read-only Einsicht in das ModelRun-Protokoll.
  modelRuns: ModelRunService;
  mailer: Mailer;
  // Audit-P3 (SCRUM-397): Gelesen-Status der Glocke (öffentliche Modul-Schnittstelle).
  notificationSeen: NotificationSeenRepo;
  // SCRUM-414: Admin-Regler „externe Wissensabfrage" (persistiert) — direkt als schmale
  // Modul-Schnittstelle, wie notificationSeen.
  externalKnowledge: ExternalKnowledgePolicyRepo;
  // SCRUM-421: einstellbare Upload-Grenzen (persistiert), direkt für die KO-Routen.
  uploadLimits: UploadLimitsRepo;
}

// Alle Repositories der App. Sie sind der einzige Unterschied zwischen In-Memory und
// Postgres — die Service-Verdrahtung darüber ist identisch.
// SCRUM-387: exportiert, damit die Dev-Persistenz (dev-persist.ts) dieselben Repos
// über ihre öffentlichen Interfaces journalieren kann — kein Griff in Modul-Interna.
export interface AppRepos {
  auditRepo: AuditRepo;
  koRepo: KoRepo;
  koVersions: KoVersionRepo;
  evidence: EvidenceRepo;
  users: UserRepo;
  sessions: SessionRepo;
  resetTokens: PasswordResetRepo;
  drafts: DraftRepo;
  gaps: GapRepo;
  ratings: RatingRepo;
  assignments: AssignmentRepo;
  conflictsRepo: ConflictRepo;
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Persistenz der Überschneidungs-Einträge.
  overlapRepo: OverlapRepo;
  // Pedi 04.07.: persistierte Anzeige-Schwelle der Duplikat-Erkennung (Admin-Einstellung).
  overlapSettings: OverlapSettingsRepo;
  lifecycleRepo: LifecycleRepo;
  objects: ObjectRepo;
  candidates: CandidateRepo;
  modelRuns: ModelRunRepo;
  // Audit-P3 (SCRUM-397): pro Nutzer bewusst als gesehen markierte Benachrichtigungs-IDs.
  notificationSeen: NotificationSeenRepo;
  // SCRUM-386: kundeneigene KI-Assist-Presets (Admin pflegt; Palette zeigt sie allen Rollen).
  assistPresets: AssistPresetRepo;
  // SCRUM-395: Standard-Prüferanzahl (Admin-Einstellung, gilt für neue Einreichungen).
  validationSettings: ValidationSettingsRepo;
  // SCRUM-414: Admin-Regler „externe Wissensabfrage" (4 Stufen, persistiert).
  externalKnowledge: ExternalKnowledgePolicyRepo;
  // SCRUM-421: einstellbare Upload-Grenzen (persistiert).
  uploadLimits: UploadLimitsRepo;
}

// Verdrahtet aus den Repos die vollständige Service-Landschaft. Ein gemeinsames
// Audit-Log und ein KO-Repository für alle Module, die auf denselben Bestand wirken.
// SCRUM-387: exportiert für die Dev-Persistenz (identische Verdrahtung über journalierte Repos).
export function assembleServices(repos: AppRepos): AppServices {
  const audit = new AuditService({ repo: repos.auditRepo });
  const ko = new KoService({
    repo: repos.koRepo,
    audit,
    versions: repos.koVersions,
    evidence: repos.evidence,
    // SCRUM-395: Standard-Prüferanzahl aus der Admin-Einstellung — als injizierte
    // Funktion (keine Modulgrenzen-Verletzung); null → Modul-Default 3.
    defaultNeededValidations: () => repos.validationSettings.getDefaultNeeded(),
  });
  // FR-RSN-02/06: echtes Cloud-Modell, wenn der Cloud-Key per Env/Keychain verfügbar ist.
  const modelClient = createModelClientFromEnv(
    process.env,
    process.env.KLARWERK_SKIP_KEYCHAIN ? () => undefined : undefined,
  );
  // SCRUM-424: eigener lokaler LLM (OpenAI-kompatibel), wenn KLARWERK_LOCAL_LLM_URL + _MODEL
  // gesetzt sind. Beide Backends werden serverseitig beim Start verdrahtet — unabhängig vom
  // Login. Die Werte kommen aus dem Launcher/Schlüsselbund, nie aus dem Code.
  const localClient = createLocalClientFromEnv();
  // SCRUM-498 B2: beide Modell-Clients durch den EINEN prozess-globalen In-Flight-Cap führen (Cloud UND
  // lokal teilen denselben Semaphore). Jeder complete()-Aufruf acquired/released einzeln → die
  // Gesamt-Gleichzeitigkeit ist über alle Requests hinweg begrenzt, ohne Bypass.
  const cappedCloud = modelClient ? cappedModelClient(modelClient) : undefined;
  const cappedLocal = localClient ? cappedModelClient(localClient) : undefined;
  // SCRUM-164: ModelRun-Protokoll mitgeben (No-op-fähig); API-Shape des Reasoners unverändert.
  const reasoner = new Reasoner(
    cappedCloud ? new ModelProvider(cappedCloud) : undefined,
    undefined,
    repos.modelRuns,
    // SCRUM-386: Presets über das Repo — persistent in Pg bzw. im Dev-Journal der Desktop-App.
    repos.assistPresets,
    // SCRUM-424: zweites Backend (lokaler LLM) als optionaler Provider.
    cappedLocal ? new ModelProvider(cappedLocal) : undefined,
  );

  // Vorab erstellt, da das Management-Modul (SCRUM-120) deren Live-Daten aggregiert.
  const ask = new AskService({ reasoner, koService: ko, gaps: repos.gaps, audit });
  const conflicts = new ConflictService({ repo: repos.conflictsRepo, audit });
  // Berater-Konzept Duplikate 04.07. (Stufe D3): eigener Dienst für Überschneidungen (teilt Audit).
  const overlaps = new OverlapService({ repo: repos.overlapRepo, audit });
  // SCRUM-470 (ben-Review #7): der gesamte Confluence-Import-Strang (pageId-Dedup + -Upsert) hängt am
  // selben Flag wie die S6-Erkennung. Aus (Default) = heutiges Bestandsverhalten.
  const confluenceImport =
    process.env.KLARWERK_CONFLUENCE_IMPORT === "1" ||
    process.env.KLARWERK_CONFLUENCE_IMPORT === "true";
  const library = new LibraryService({
    koService: ko,
    audit,
    candidates: repos.candidates,
    confluenceImport,
  });
  const lifecycle = new LifecycleService({ koService: ko, repo: repos.lifecycleRepo });

  return {
    audit,
    reasoner,
    ko,
    auth: new AuthService({
      users: repos.users,
      sessions: repos.sessions,
      resetTokens: repos.resetTokens,
      audit,
      // SCRUM-443: FR-RBAC-03 serverseitig durchsetzen (kein Selbst-Entzug der Admin-Rolle).
      canChangeRole,
    }),
    capture: new CaptureService({ repo: repos.drafts }),
    ask,
    validation: new ValidationService({
      koService: ko,
      ratings: repos.ratings,
      assignments: repos.assignments,
      audit,
      // SCRUM-395: persistierte Standard-Prüferanzahl (Admin pflegt sie über die Route).
      settings: repos.validationSettings,
    }),
    conflicts,
    overlaps,
    // Pedi 04.07.: Schwellen-Repo direkt durchreichen (Routen + Duplikat-Erkennung nutzen es).
    overlapSettings: repos.overlapSettings,
    library,
    // SCRUM-117: Output Factory — stateless, nur validierte KOs als Quelle.
    output: new OutputService({ koService: ko }),
    // SCRUM-120: Management/Kapital — stateless, aggregiert echte Live-Daten.
    management: new ManagementService({
      koService: ko,
      listGaps: () => ask.listGaps(),
      countOpenConflicts: async () => (await conflicts.unresolved()).length,
      pendingRevalidation: () => lifecycle.pendingRevalidation(),
      busFactor: () => library.busFactor(),
    }),
    // SCRUM-118: externer Such-Proxy (Wikipedia) — optional via Env abschaltbar.
    externalSearch: createExternalSearchFromEnv(),
    lifecycle,
    i18n: new I18nService(),
    // SCRUM-121: interner Objekt-/Attachment-Speicher (In-Memory; Pg/Disk = Folge-Ticket).
    objects: new ObjectStore({ repo: repos.objects }),
    media: new MediaAnalysisService({
      objects: new ObjectStore({ repo: repos.objects }),
      transcriber: createTranscriberFromEnv(),
    }),
    // SCRUM-165: read-only ModelRun-Sicht über dasselbe Protokoll-Repo wie der Reasoner.
    modelRuns: new ModelRunService({ repo: repos.modelRuns }),
    // FR-AUTH-08/FR-VAL-07: SMTP, wenn konfiguriert; sonst sammelnder Fallback ohne Versand.
    mailer: createMailerFromEnv() ?? new ConsoleMailer(),
    // Audit-P3 (SCRUM-397): Gelesen-Status der Glocke — Repo direkt (schmale Modul-API).
    notificationSeen: repos.notificationSeen,
    // SCRUM-414: Regler-Repo direkt durchreichen (Routen nutzen es + Audit).
    externalKnowledge: repos.externalKnowledge,
    // SCRUM-421: Upload-Grenzen-Repo direkt durchreichen (KO-Routen nutzen es + Audit).
    uploadLimits: repos.uploadLimits,
  };
}

// In-Memory-Repos als benannter Satz — von buildServices (Tests/Dev) und der Dev-Persistenz
// (SCRUM-387: Journal-Replay + Journalierung über dieselben Interfaces) gemeinsam genutzt.
export function inMemoryRepos(): AppRepos {
  return {
    auditRepo: new InMemoryAuditRepo(),
    koRepo: new InMemoryKoRepo(),
    koVersions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
    resetTokens: new InMemoryPasswordResetRepo(),
    drafts: new InMemoryDraftRepo(),
    gaps: new InMemoryGapRepo(),
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    conflictsRepo: new InMemoryConflictRepo(),
    overlapRepo: new InMemoryOverlapRepo(),
    overlapSettings: new InMemoryOverlapSettingsRepo(),
    lifecycleRepo: new InMemoryLifecycleRepo(),
    objects: new InMemoryObjectRepo(),
    candidates: new InMemoryCandidateRepo(),
    modelRuns: new InMemoryModelRunRepo(),
    notificationSeen: new InMemoryNotificationSeenRepo(),
    assistPresets: new InMemoryAssistPresetRepo(),
    validationSettings: new InMemoryValidationSettingsRepo(),
    externalKnowledge: new InMemoryExternalKnowledgePolicyRepo(),
    uploadLimits: new InMemoryUploadLimitsRepo(),
  };
}

// In-Memory-Komposition (Tests, Dev ohne Datenbank).
export function buildServices(): AppServices {
  return assembleServices(inMemoryRepos());
}

// Postgres-Komposition: dieselbe App, alle Repos gegen eine echte Datenbank.
export function buildPgServices(pool: Pool): AppServices {
  return assembleServices({
    auditRepo: new PgAuditRepo(pool),
    koRepo: new PgKoRepo(pool),
    koVersions: new PgKoVersionRepo(pool),
    evidence: new PgEvidenceRepo(pool),
    users: new PgUserRepo(pool),
    sessions: new PgSessionRepo(pool),
    resetTokens: new PgPasswordResetRepo(pool),
    drafts: new PgDraftRepo(pool),
    gaps: new PgGapRepo(pool),
    ratings: new PgRatingRepo(pool),
    assignments: new PgAssignmentRepo(pool),
    conflictsRepo: new PgConflictRepo(pool),
    // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-Einträge persistent.
    overlapRepo: new PgOverlapRepo(pool),
    // Pedi 04.07.: Anzeige-Schwelle persistent.
    overlapSettings: new PgOverlapSettingsRepo(pool),
    lifecycleRepo: new PgLifecycleRepo(pool),
    // SCRUM-155: Object-Store jetzt persistent (Attachment-/Evidence-Originale überleben Neustart).
    objects: new PgObjectRepo(pool),
    // SCRUM-157: Import-/Source-Review-Queue persistent (Review-Stand überlebt Neustart).
    candidates: new PgCandidateRepo(pool),
    // SCRUM-164: ModelRun-Protokoll persistent (KI-Aufrufe nachvollziehbar).
    modelRuns: new PgModelRunRepo(pool),
    // Audit-P3 (SCRUM-397): Gelesen-Status der Glocke persistent.
    notificationSeen: new PgNotificationSeenRepo(pool),
    // SCRUM-386: kundeneigene KI-Assist-Presets persistent.
    assistPresets: new PgAssistPresetRepo(pool),
    // SCRUM-395: Standard-Prüferanzahl persistent.
    validationSettings: new PgValidationSettingsRepo(pool),
    // SCRUM-414: externe-Wissensabfrage-Regler persistent.
    externalKnowledge: new PgExternalKnowledgePolicyRepo(pool),
    // SCRUM-421: Upload-Grenzen persistent.
    uploadLimits: new PgUploadLimitsRepo(pool),
  });
}

// Weg 3: baut den semantischen Vorfilter NUR, wenn KLARWERK_DUP_PREFILTER=1|true gesetzt ist —
// Standard AUS (heutiges „jeder gegen jeden" bleibt Default). Ohne einsatzbereiten Provider (z. B.
// Modus cloud/local noch nicht verdrahtet) → ehrlich undefined statt Fake. topK aus
// KLARWERK_DUP_PREFILTER_TOPK (Default 25). Der In-Memory-Store ist in dieser Ausbaustufe noch nicht
// befüllt (Befüllung im Einreiche-Pfad ist ein separater Folgeschritt) → der Prefilter fällt bis dahin
// über den leeren Store auf den Voll-Pool zurück.
function createSemanticPrefilterFromEnv(): SemanticPrefilter | undefined {
  const flag = process.env.KLARWERK_DUP_PREFILTER;
  if (flag !== "1" && flag !== "true") {
    return undefined;
  }
  const embedder = createEmbeddingProviderFromEnv(process.env);
  if (!embedder) {
    return undefined;
  }
  const rawTopK = Number(process.env.KLARWERK_DUP_PREFILTER_TOPK);
  const topK = Number.isInteger(rawTopK) && rawTopK > 0 ? rawTopK : 25;
  // SCRUM-498 B2 (Fix): embed() durch den prozess-globalen Embed-Cap führen, damit der Prefilter den
  // Cap nicht umgeht. Bei Normallast (und mit dem Stub) ein No-Op → Prefilter-Verhalten bit-gleich.
  return { embedder: cappedEmbeddingProvider(embedder), store: new InMemoryEmbeddingStore(), topK };
}

// SCRUM-498 B2: einheitliche Backpressure-Antwort. Ein Modell-/Embed-Cap-Überlauf (ModelCapacityError)
// wird von der Reasoner-Kette bzw. dem Prefilter bis hierher durchgereicht → 503 + Retry-After (kein
// 500/Crash). Jeder andere Fehler wird formtreu an Fastifys Standard-Fehlerbehandlung weitergereicht
// (Validierungs-400 etc. unverändert). Als benannte Funktion exportiert, damit Tests denselben Handler
// verdrahten wie die App (kein duplizierter Handler, keine Drift).
export function modelBusyErrorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof ModelCapacityError) {
    reply.code(503).header("Retry-After", "1").send({
      error: "MODEL_BUSY",
      message: "KI-Modell derzeit ausgelastet. Bitte in Kürze erneut versuchen.",
    });
    return;
  }
  reply.send(error);
}

export function buildApp(
  services: AppServices = buildServices(),
  // Pedi 05.07. (Beta): optionale Werksreset-Fähigkeit. Standard = nicht verfügbar (Tests/Produktion);
  // nur der Desktop/Dev-Journal-Betrieb (server.ts) reicht eine echte Fähigkeit durch.
  opts: { factoryReset?: FactoryReset } = {},
): FastifyInstance {
  const app = Fastify();
  // SCRUM-498 B2: einheitliche Backpressure-Antwort. Ein Modell-Cap-Überlauf (ModelCapacityError) wird
  // von der Reasoner-Kette bis hierher durchgereicht → 503 + Retry-After (kein 500/Crash). Jeder andere
  // Fehler wird formtreu an Fastifys Standard-Fehlerbehandlung weitergereicht (Validierungs-400 etc.
  // unverändert).
  app.setErrorHandler(modelBusyErrorHandler);
  const guards = makeGuards(services.auth);

  // Add-on-API (Klara-Panel), hinter KLARWERK_ADDON_API: CORS NUR bei aktivem Flag, NUR für die eine
  // validierte Add-in-Origin und NUR für POST /api/ask UND POST /api/check-text (SCRUM-491 Slice 5).
  // Flag AUS → gar nicht registriert → keine CORS-Header (exakt heutiges Verhalten). Kein
  // credentials-Modus: der Add-in-Pfad nutzt einen Key-Header, keine Cookies — so werden Session-Cookies
  // nie cross-origin exponiert.
  // ben-Review SCRUM-490 (P2): (1) Origin fail-closed validieren — "*"/leer/malformed → gar kein CORS
  // (resolveAddonOrigin === null). (2) Scope über einen Delegator strikt auf die Add-on-Pfade begrenzen;
  // alle anderen Routen bekommen { origin: false } → keinerlei CORS-Header (nicht mehr app-weit).
  if (addonApiEnabled()) {
    // SCRUM-490 D2: request-lokaler Auth-Kontext. Der Add-on-Key wird hier GENAU EINMAL pro Request
    // validiert und der Principal (Capabilities ask.validated + checktext.validated) am Request
    // getragen; Rate-Limiter, allowList und
    // Handler LESEN ihn danach nur noch (keine erneute Key-Prüfung → die von ben gemeldete
    // Dreifach-Validierung entfällt). Der Hook ist vor rate-limit registriert, damit die Drossel den
    // fertigen Principal sieht.
    //  - Key vorhanden + gültig  → Principal; erlaubt AUSSCHLIESSLICH die in ADDON_ROUTES gelisteten
    //    Endpunkte (POST /api/ask mit ask.validated, POST /api/check-text mit checktext.validated),
    //    jede andere Route/fehlende Capability → 403 (Deny-by-default, kein Teilzugriff).
    //  - Key vorhanden + ungültig → 401 (kein Fallback auf Session mit falschem Key).
    //  - kein Key                → Session-Kontext (Live-App unverändert).
    app.decorateRequest("authContext", null);
    app.addHook("onRequest", async (request, reply) => {
      const auth = resolveAddonAuth(request);
      if (auth.kind === "invalid") {
        reply.code(401).send({ error: "UNAUTHENTICATED", message: "Ungültiger Add-in-Zugang." });
        return reply;
      }
      if (auth.kind === "valid") {
        request.authContext = { authKind: "addon", principal: auth.principal };
        // ben-Review: der kanonische routeOptions.url-Check allein reicht nicht — Fastify normalisiert
        // Prozent-Enkodierung (z. B. /api/%61sk, /%2e%2e/api/ask) und würde solche Requests auf die
        // Ziel-Route matchen. matchAddonRoute verlangt daher zusätzlich, dass der ROHE, un-normalisierte
        // Pfad (request.raw.url) byte-genau dem erlaubten Pfad entspricht. Klara sendet ausschließlich
        // die literalen Pfade → kein legitimer enkodierter Aufruf → risikolos. Und der Principal muss
        // GENAU das schmale Recht der Route tragen (Least-Privilege). Beides Defense-in-Depth.
        const route = matchAddonRoute(request.method, request.routeOptions?.url, request.raw.url);
        if (!route || !principalHasCapability(auth.principal, route.capability)) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message: "Add-in-Zugang für diese Route/Capability nicht erlaubt.",
          });
          return reply;
        }
        return;
      }
      request.authContext = { authKind: "session", principal: null };
    });
    // SCRUM-490 D3: Drossel für den Add-on-Pfad. global:false → greift NUR auf Routen mit
    // `config.rateLimit` (POST /api/ask; Slice 5: /api/check-text), nicht app-weit. Die eigentliche
    // Enge (nur addon-Principal, gekeyt auf den Actor; Session-Requests exempt) steckt in
    // addonRateLimit(). Flag AUS → hier gar nicht registriert → /api/ask exakt wie heute.
    app.register(rateLimit, { global: false });
    const addonOrigin = resolveAddonOrigin();
    if (addonOrigin !== null) {
      app.register(
        cors,
        () =>
          (req: FastifyRequest, cb: (err: Error | null, options: FastifyCorsOptions) => void) => {
            const path = (req.url ?? "").split("?")[0];
            if (path === ADDON_ASK_PATH || path === ADDON_CHECK_TEXT_PATH) {
              cb(null, {
                origin: addonOrigin,
                methods: ["POST", "OPTIONS"],
                allowedHeaders: ["Content-Type", ADDON_KEY_HEADER],
                credentials: false,
              });
            } else {
              cb(null, { origin: false });
            }
          },
      );
    }
  }

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/api/reasoner/status", async () => services.reasoner.status()); // FR-RSN-05
  app.get("/api/ai-status", async () => ({ ai: services.reasoner.status() })); // §2.1: ist die KI verfügbar?

  // HTTP-Oberfläche der Module. Auth bringt seine eigenen Routen mit; die übrigen
  // Module werden über App-Routen verdrahtet, die den gemeinsamen Guard nutzen.
  const resetBaseUrl = process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/reset` : undefined;
  app.register(
    authRoutes(services.auth, {
      mailer: services.mailer,
      resetBaseUrl,
      oidc: createOidcProviderFromEnv(),
    }),
  );
  // FR-VAL-07: EIN Notifier für alle Zuweisungswege (Board-Zuweisung + Einreichen, SCRUM-395).
  const notifyAssignment = makeAssignmentNotifier(services.auth, services.mailer);
  // Weg 3: semantischer Vorfilter der Duplikat-Erkennung. Standard AUS → beide Routen bekommen
  // undefined → heutiges „jeder gegen jeden". Erst KLARWERK_DUP_PREFILTER=1 schaltet ihn scharf.
  const semanticPrefilter = createSemanticPrefilterFromEnv();
  app.register(
    koRoutes(
      {
        ko: services.ko,
        validation: services.validation,
        conflicts: services.conflicts,
        // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-Erkennung beim Einreichen.
        overlaps: services.overlaps,
        // Pedi 04.07.: einstellbare Anzeige-Schwelle für die Duplikat-Erkennung.
        overlapSettings: services.overlapSettings,
        lifecycle: services.lifecycle,
        // Berater-Konzept 04.07. (Stufe 3): Reasoner für die automatische Widerspruchs-Erkennung.
        reasoner: services.reasoner,
        notifyAssignment,
        // SCRUM-421: einstellbare Upload-Grenzen + Audit für Änderungen.
        uploadLimits: services.uploadLimits,
        audit: services.audit,
        // Weg 3 (Feature-Flag): semantischer Vorfilter (undefined = Default „jeder gegen jeden").
        semanticPrefilter,
      },
      guards,
    ),
  );
  app.register(validationRoutes(services.validation, guards));
  app.register(conflictRoutes(services.conflicts, guards));
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-API (/api/duplicates) +
  // (Pedi 04.07.) einstellbare Anzeige-Schwelle.
  app.register(
    overlapRoutes(
      { overlaps: services.overlaps, settings: services.overlapSettings, audit: services.audit },
      guards,
    ),
  );
  app.register(captureRoutes({ ...services, notifyAssignment, semanticPrefilter }, guards));
  app.register(askRoutes(services.ask, guards));
  // SCRUM-491 Slice 5: /api/check-text existiert NUR bei aktivem Add-on-Flag — sonst gar nicht
  // registriert → Endpunkt existiert nicht → bit-identisch zum heutigen Verhalten. Deterministische
  // Stufe-1-Dry-Run-Prüfung (validated-only, kein Modell, keine Persistenz).
  if (addonApiEnabled()) {
    app.register(
      checkTextRoutes(
        {
          ko: services.ko,
          overlaps: services.overlaps,
          // Stufe 2 (want:"deep"): Modell-Judge + (env-gegated) Semantic-Prefilter. Stufe 1 nutzt beide nicht.
          reasoner: services.reasoner,
          semanticPrefilter,
        },
        guards,
      ),
    );
  }
  // SCRUM-470 (S6): Erkennung nach Import-Accept — dasselbe Deps-Bündel wie der Promote-Pfad.
  // Greift nur bei KLARWERK_CONFLUENCE_IMPORT=1 (Default AUS → heutiges Verhalten).
  app.register(
    libraryRoutes(services.library, guards, {
      ko: services.ko,
      conflicts: services.conflicts,
      overlaps: services.overlaps,
      overlapSettings: services.overlapSettings,
      reasoner: services.reasoner,
      semanticPrefilter,
    }),
  );
  app.register(outputRoutes(services.output, guards));
  app.register(managementRoutes(services.management, guards));
  app.register(modelRunRoutes(services.modelRuns, guards));
  app.register(
    externalRoutes(
      {
        search: services.externalSearch,
        policy: services.externalKnowledge,
        audit: services.audit,
      },
      guards,
    ),
  );
  app.register(lifecycleRoutes(services.lifecycle, guards));
  app.register(
    notificationsRoutes(
      {
        conflicts: services.conflicts,
        // Pedi 04.07.: offene Überschneidungen (Duplikate) in der Glocke.
        overlaps: services.overlaps,
        ask: services.ask,
        validation: services.validation,
        audit: services.audit,
        // Audit-P3 (SCRUM-397): Gelesen-Status je Nutzer.
        seen: services.notificationSeen,
      },
      guards,
    ),
  );
  // Audit-P4 (SCRUM-398): Live-Wall — read-only „frisch gesichert / hat heute geholfen".
  app.register(livewallRoutes({ ko: services.ko, audit: services.audit }, guards));
  app.register(auditRoutes(services.audit, guards));
  app.register(reasonerRoutes(services, guards));
  // Klara Stufe 2 (Pedi 05.07.): KI-gestuetzte Hilfe-Antwort aus Hilfe-Schnipseln (help-routes).
  app.register(helpRoutes({ reasoner: services.reasoner }, guards));
  app.register(objectRoutes(services.objects, guards));
  app.register(mediaRoutes(services.media, guards));
  app.register(i18nRoutes(services.i18n));
  app.register(adminRoutes(services, guards, opts.factoryReset)); // SCRUM-181: Demo-Seed; Pedi 05.07.: Werksreset

  // FR-ANA-02: Wirkungs-Dashboard (orchestriert KO-Bestand + Ask-Telemetrie aus dem Audit).
  app.get("/api/analytics/impact", async (request, reply) => {
    const user = await guards.requirePermission("ko.read", request, reply);
    if (!user) {
      return;
    }
    reply.code(200).send(await impactReport(services.ko, services.audit));
  });

  return app;
}

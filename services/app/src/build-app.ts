import Fastify, { type FastifyInstance } from "fastify";
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
  PgConflictRepo,
} from "../../conflicts";
import { type ExternalSearchService, createExternalSearchFromEnv } from "../../external-search";
import { I18nService } from "../../i18n";
import {
  type EvidenceRepo,
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  type KoRepo,
  KoService,
  type KoVersionRepo,
  PgEvidenceRepo,
  PgKoRepo,
  PgKoVersionRepo,
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
import {
  InMemoryModelRunRepo,
  type ModelRunRepo,
  ModelRunService,
  PgModelRunRepo,
} from "../../model-runs";
import { ConsoleMailer, type Mailer, createMailerFromEnv } from "../../notifications";
import { InMemoryObjectRepo, type ObjectRepo, ObjectStore, PgObjectRepo } from "../../object-store";
import { OutputService } from "../../output";
import { ModelProvider, Reasoner, createModelClientFromEnv } from "../../reasoner";
import {
  type AssignmentRepo,
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  PgAssignmentRepo,
  PgRatingRepo,
  type RatingRepo,
  ValidationService,
} from "../../validation";
import { makeGuards } from "./http";
import { impactReport } from "./impact";
import { makeAssignmentNotifier } from "./notify";
import { adminRoutes } from "./routes/admin-routes";
import { askRoutes } from "./routes/ask-routes";
import { auditRoutes } from "./routes/audit-routes";
import { captureRoutes } from "./routes/capture-routes";
import { conflictRoutes } from "./routes/conflicts-routes";
import { externalRoutes } from "./routes/external-routes";
import { i18nRoutes } from "./routes/i18n-routes";
import { koRoutes } from "./routes/ko-routes";
import { libraryRoutes } from "./routes/library-routes";
import { lifecycleRoutes } from "./routes/lifecycle-routes";
import { managementRoutes } from "./routes/management-routes";
import { modelRunRoutes } from "./routes/model-runs-routes";
import { notificationsRoutes } from "./routes/notifications-routes";
import { objectRoutes } from "./routes/object-routes";
import { outputRoutes } from "./routes/output-routes";
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
  library: LibraryService;
  output: OutputService;
  management: ManagementService;
  // SCRUM-118: optionaler externer Such-Proxy (undefined, wenn EXTERNAL_SEARCH=off).
  externalSearch: ExternalSearchService | undefined;
  lifecycle: LifecycleService;
  i18n: I18nService;
  objects: ObjectStore;
  // SCRUM-165: read-only Einsicht in das ModelRun-Protokoll.
  modelRuns: ModelRunService;
  mailer: Mailer;
}

// Alle Repositories der App. Sie sind der einzige Unterschied zwischen In-Memory und
// Postgres — die Service-Verdrahtung darüber ist identisch.
interface AppRepos {
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
  lifecycleRepo: LifecycleRepo;
  objects: ObjectRepo;
  candidates: CandidateRepo;
  modelRuns: ModelRunRepo;
}

// Verdrahtet aus den Repos die vollständige Service-Landschaft. Ein gemeinsames
// Audit-Log und ein KO-Repository für alle Module, die auf denselben Bestand wirken.
function assembleServices(repos: AppRepos): AppServices {
  const audit = new AuditService({ repo: repos.auditRepo });
  const ko = new KoService({
    repo: repos.koRepo,
    audit,
    versions: repos.koVersions,
    evidence: repos.evidence,
  });
  // FR-RSN-02/06: echtes Modell, wenn ANTHROPIC_API_KEY gesetzt ist; sonst deterministisch.
  const modelClient = createModelClientFromEnv();
  // SCRUM-164: ModelRun-Protokoll mitgeben (No-op-fähig); API-Shape des Reasoners unverändert.
  const reasoner = new Reasoner(
    modelClient ? new ModelProvider(modelClient) : undefined,
    undefined,
    repos.modelRuns,
  );

  // Vorab erstellt, da das Management-Modul (SCRUM-120) deren Live-Daten aggregiert.
  const ask = new AskService({ reasoner, koService: ko, gaps: repos.gaps, audit });
  const conflicts = new ConflictService({ repo: repos.conflictsRepo, audit });
  const library = new LibraryService({ koService: ko, audit, candidates: repos.candidates });
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
    }),
    capture: new CaptureService({ repo: repos.drafts }),
    ask,
    validation: new ValidationService({
      koService: ko,
      ratings: repos.ratings,
      assignments: repos.assignments,
      audit,
    }),
    conflicts,
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
    // SCRUM-165: read-only ModelRun-Sicht über dasselbe Protokoll-Repo wie der Reasoner.
    modelRuns: new ModelRunService({ repo: repos.modelRuns }),
    // FR-AUTH-08/FR-VAL-07: SMTP, wenn konfiguriert; sonst sammelnder Fallback ohne Versand.
    mailer: createMailerFromEnv() ?? new ConsoleMailer(),
  };
}

// In-Memory-Komposition (Tests, Dev ohne Datenbank).
export function buildServices(): AppServices {
  return assembleServices({
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
    lifecycleRepo: new InMemoryLifecycleRepo(),
    objects: new InMemoryObjectRepo(),
    candidates: new InMemoryCandidateRepo(),
    modelRuns: new InMemoryModelRunRepo(),
  });
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
    lifecycleRepo: new PgLifecycleRepo(pool),
    // SCRUM-155: Object-Store jetzt persistent (Attachment-/Evidence-Originale überleben Neustart).
    objects: new PgObjectRepo(pool),
    // SCRUM-157: Import-/Source-Review-Queue persistent (Review-Stand überlebt Neustart).
    candidates: new PgCandidateRepo(pool),
    // SCRUM-164: ModelRun-Protokoll persistent (KI-Aufrufe nachvollziehbar).
    modelRuns: new PgModelRunRepo(pool),
  });
}

export function buildApp(services: AppServices = buildServices()): FastifyInstance {
  const app = Fastify();
  const guards = makeGuards(services.auth);

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
  app.register(
    koRoutes(
      {
        ko: services.ko,
        validation: services.validation,
        conflicts: services.conflicts,
        lifecycle: services.lifecycle,
        notifyAssignment: makeAssignmentNotifier(services.auth, services.mailer),
      },
      guards,
    ),
  );
  app.register(validationRoutes(services.validation, guards));
  app.register(conflictRoutes(services.conflicts, guards));
  app.register(captureRoutes(services, guards));
  app.register(askRoutes(services.ask, guards));
  app.register(libraryRoutes(services.library, guards));
  app.register(outputRoutes(services.output, guards));
  app.register(managementRoutes(services.management, guards));
  app.register(modelRunRoutes(services.modelRuns, guards));
  app.register(externalRoutes(services.externalSearch, guards));
  app.register(lifecycleRoutes(services.lifecycle, guards));
  app.register(
    notificationsRoutes(
      { conflicts: services.conflicts, ask: services.ask, validation: services.validation },
      guards,
    ),
  );
  app.register(auditRoutes(services.audit, guards));
  app.register(reasonerRoutes(services, guards));
  app.register(objectRoutes(services.objects, guards));
  app.register(i18nRoutes(services.i18n));
  app.register(adminRoutes(services, guards)); // SCRUM-181: admin-only Demo-Seed

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

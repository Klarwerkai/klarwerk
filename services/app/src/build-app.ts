import { readFileSync } from "node:fs";
import cors, { type FastifyCorsOptions } from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import type { Pool } from "pg";
import {
  type AnswerSnapshotRepo,
  AskService,
  type GapRepo,
  InMemoryAnswerSnapshotRepo,
  InMemoryGapRepo,
  PgAnswerSnapshotRepo,
  PgGapRepo,
  parseConfiguredReceiptSecret,
} from "../../ask";
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
import {
  CaptureError,
  CaptureService,
  type DraftRepo,
  InMemoryDraftRepo,
  PgDraftRepo,
  validateDraftPayloadShape,
} from "../../capture";
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
// SCRUM-523 P.3 (WP-A2): gemeinsamer Transaktions-Kernel — nur die Kompositionswurzel bindet withPgTx
// an den echten, mit PgKoRepo/PgAuditRepo geteilten Pool (s. buildPgServices unten).
import { gatedPool, withPgTx } from "../../db-tx";
import { InMemoryEmbeddingStore, createEmbeddingProviderFromEnv } from "../../embedding";
import {
  type ExternalKnowledgePolicyRepo,
  type ExternalSearchService,
  InMemoryExternalKnowledgePolicyRepo,
  PgExternalKnowledgePolicyRepo,
  createExternalSearchFromEnv,
  parseInternalSourceOrigins,
} from "../../external-search";
import { I18nService } from "../../i18n";
import {
  type EvidenceRepo,
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  InMemoryUploadLimitsRepo,
  type KoRepo,
  type KoSearchProjectionRepo,
  KoService,
  type KoVersionRepo,
  PgEvidenceRepo,
  PgKoRepo,
  PgKoSearchProjectionRepo,
  PgKoVersionRepo,
  PgUploadLimitsRepo,
  type UploadLimitsRepo,
  type WithTx,
} from "../../knowledge-object";
import {
  type CandidateRepo,
  type ExternalSourceRepo,
  type ImportRunRepo,
  InMemoryCandidateRepo,
  InMemoryExternalSourceRepo,
  InMemoryImportRunRepo,
  LibraryService,
  PgCandidateRepo,
  PgExternalSourceRepo,
  PgImportRunRepo,
} from "../../library-analytics";
import {
  InMemoryLifecycleRepo,
  type LifecycleRepo,
  LifecycleService,
  PgLifecycleRepo,
} from "../../lifecycle";
import { ManagementService } from "../../management";
import { MediaAnalysisService, createCappedTranscriberFromEnv } from "../../media";
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
  // W1 S4: Ablage der Klara-Sitzungen/Zustimmungen — dieselbe Modulgrenze wie die übrige
  // Reasoner-Persistenz (Cross-Modul-Import nur über die öffentliche index.ts).
  InMemoryKlaraSessionRepo,
  InMemoryReasonerPolicyRepo,
  type KlaraSessionRepo,
  ModelCapacityError,
  ModelProvider,
  PgAssistPresetRepo,
  PgKlaraSessionRepo,
  PgReasonerPolicyRepo,
  Reasoner,
  type ReasonerPolicyRepo,
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
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
import {
  AddonAuthAttemptThrottle,
  addonAuthThrottleConfigFromEnv,
  isAddonEndpointPath,
  resolveTrustProxy,
} from "./addon-auth-throttle";
import { matchAddonRoute, principalHasCapability, resolveAddonAuth } from "./addon-principal";
import { type AiCheckWorker, createAiCheckRunner, createAiCheckWorker } from "./ai-check-worker";
import { type SemanticPrefilter, removeKoFromDuplicatePrefilter } from "./duplicate-detection";
import { cappedEmbeddingProvider } from "./embed-concurrency";
import type { FactoryReset } from "./factory-reset";
import { schalterAn } from "./feature-flags";
import {
  type SessionUser,
  isInternalOnlyError,
  makeGuards,
  sendError,
  tokenFromRequest,
} from "./http";
import { impactReport } from "./impact";
import { makeAssignmentNotifier } from "./notify";
// AUFTRAG-mega20 Block C: die modulübergreifende Referenzprüfung lebt in services/app (s. Datei).
import type { ObjectReferenceSources } from "./object-references";
import { addinStaticRoutes } from "./routes/addin-static-routes";
import { adminRoutes } from "./routes/admin-routes";
import { aiCheckCoverageRoutes } from "./routes/ai-check-coverage-routes";
import { askRoutes } from "./routes/ask-routes";
import { auditRoutes } from "./routes/audit-routes";
import { canSeeDraft, captureRoutes } from "./routes/capture-routes";
import { checkTextRoutes } from "./routes/check-text-routes";
import { conflictRoutes } from "./routes/conflicts-routes";
import { confluenceImportRoutes } from "./routes/confluence-import-routes";
import { externalRoutes } from "./routes/external-routes";
import { featuresRoutes } from "./routes/features-routes";
import { helpRoutes } from "./routes/help-routes";
import { i18nRoutes } from "./routes/i18n-routes";
import { impactRoutes } from "./routes/impact-routes";
import { importAccessRoutes } from "./routes/import-access-routes";
import { importRunRoutes } from "./routes/import-run-routes";
import { klaraAiRoutes } from "./routes/klara-ai-routes";
// W3-C (JOB 541 D3): die kanonische Antwort-Erklaerroute und ihr Lesedienst.
import { klaraAnswerExplanationRoutes } from "./routes/klara-answer-explanation-routes";
import { knowledgeCheckRoutes } from "./routes/knowledge-check-routes";
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
import { provenanceEnabled, provenanceRoutes } from "./routes/provenance-routes";
import { reasonerRoutes } from "./routes/reasoner-routes";
import { slidesRoutes } from "./routes/slides-routes";
import { validationRoutes } from "./routes/validation-routes";
// G27 R2 (Entscheidung 15 §A): der EINE kanonische Startupvertrag der Suchprojektion — von
// App-Ready hier und von `runSeed()` in `seed.ts` gemeinsam benutzt.
import { stelleSuchprojektionBereit } from "./search-projection-startup";
import { AnswerExplanationService } from "./services/answer-explanation";
// W1 S4 (KW-S4-04 §59-100): Klara-Sitzung und Zustimmung. NUR Verdrahtung — die
// Policyentscheidung liegt im Reasoner-Modul, die Orchestrierung im Sitzungsdienst.
import { ImportAccessService } from "./services/import-access-service";
import { KlaraSessionService } from "./services/klara-session-service";
import { sichtbarkeitsfilterFuer } from "./sichtbarkeit";
// WP-D11: PPTX-Folien → PNG (Route + injizierbarer Konverter).
import { type SlideConverter, createSofficeSlideConverter } from "./slide-converter";

// Composition-Root des modularen Monolithen: verdrahtet ALLE Module zu EINER App.
// Jeder Import läuft über die öffentliche index.ts des jeweiligen Moduls.
export interface AppServices {
  auth: AuthService;
  ko: KoService;
  reasoner: Reasoner;
  // W1 S4: Ablage der Klara-Sitzungen und ihrer Zustimmungen. Als eigenes Feld und nicht in
  // `AppRepos`, weil es wie `searchProjections` ein abgeleiteter Betriebsdatenraum ist — die
  // Dev-Persistenz journaliert ihn bewusst nicht; nach einem Replay ist er schlicht leer.
  klaraSessions: KlaraSessionRepo;
  audit: AuditService;
  capture: CaptureService;
  ask: AskService;
  // W3-C (JOB 541 D3): der Belegspeicher der Antworten. Er steht hier und nicht nur als Dep des
  // AskService, weil der Erklaer-Lesepfad ihn ebenfalls braucht — und beide MUESSEN denselben
  // benutzen: zwei Zugaenge waeren zwei Bestaende ueber denselben Beleg.
  answerSnapshots: AnswerSnapshotRepo;
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
  // AUFTRAG-mega20 Block C: die MODULÜBERGREIFENDE Referenzprüfung — verdrahtet mit den echten
  // Beständen (Wissensobjekte inkl. Papierkorb, Versions-Snapshots, Belegkette, Entwürfe). Sie
  // gehört in die Composition-Root, weil nur sie alle Module kennen darf; die ausgeschriebene
  // Begründung und die fünf Fundorte stehen in object-references.ts. Sie ENTSCHEIDET nichts und
  // löscht nichts — der Waisen-Sweep ist ausdrücklich nicht Teil dieses Blocks.
  objectReferences: ObjectReferenceSources;
  media: MediaAnalysisService;
  // SCRUM-165: read-only Einsicht in das ModelRun-Protokoll.
  modelRuns: ModelRunService;
  // W2-A/148: die Laufablage des Imports. Sie steht hier als Ablage — wie `klaraSessions` — weil
  // die Import-Routen sie direkt lesen.
  // JOB-924 D6: Fuer die ZUGANGS-Auskunft gilt das nicht mehr. Der Satz „einen Dienst darum gibt es
  // (noch) nicht, und einen zu erfinden, nur damit die Form stimmt, waere eine Schicht ohne
  // Aufgabe" stand hier zu Recht, solange jene Route drei lokale Tatsachen zusammensetzte. Mit dem
  // letzten erfolgreichen Lauf als vierter hat die Schicht eine Aufgabe: die Auswahlregel von der
  // Route fernhalten. `ImportAccessService` bekommt diese Ablage; die Route bekommt nur ihn.
  importRuns: ImportRunRepo;
  externalSources: ExternalSourceRepo;
  mailer: Mailer;
  // Audit-P3 (SCRUM-397): Gelesen-Status der Glocke (öffentliche Modul-Schnittstelle).
  notificationSeen: NotificationSeenRepo;
  // SCRUM-414: Admin-Regler „externe Wissensabfrage" (persistiert) — direkt als schmale
  // Modul-Schnittstelle, wie notificationSeen.
  externalKnowledge: ExternalKnowledgePolicyRepo;
  // SCRUM-421: einstellbare Upload-Grenzen (persistiert), direkt für die KO-Routen.
  uploadLimits: UploadLimitsRepo;
  // WP-D11: PPTX-Folien-Konverter (injizierbar — Tests nutzen einen Fake, keine soffice-Pflicht).
  slideConverter: SlideConverter;
  // WP-SUBMIT-ASYNC (Pedis R3): In-Process-Worker der Hintergrund-KI-Prüfung. Von buildApp
  // erstellt (braucht den dort gebauten semanticPrefilter); Tests können VOR buildApp einen
  // eigenen (Spy-)Worker setzen — wie beim slideConverter.
  aiCheckWorker?: AiCheckWorker;
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
  // W2-A/148 (KW-S4-26 §133): die Laufdomaene des Imports. Ohne sie in der Wurzel konnte kein
  // Lauf angelegt werden — die Tabelle wurde migriert und blieb leer.
  importRuns: ImportRunRepo;
  externalSources: ExternalSourceRepo;
  modelRuns: ModelRunRepo;
  // Audit-P3 (SCRUM-397): pro Nutzer bewusst als gesehen markierte Benachrichtigungs-IDs.
  notificationSeen: NotificationSeenRepo;
  // SCRUM-386: kundeneigene KI-Assist-Presets (Admin pflegt; Palette zeigt sie allen Rollen).
  assistPresets: AssistPresetRepo;
  // SCRUM-525 P.5 (WP6): persistente KI-Zuordnung (Policy) — überlebt Neustart/Deploy.
  reasonerPolicy: ReasonerPolicyRepo;
  // SCRUM-395: Standard-Prüferanzahl (Admin-Einstellung, gilt für neue Einreichungen).
  validationSettings: ValidationSettingsRepo;
  // SCRUM-414: Admin-Regler „externe Wissensabfrage" (4 Stufen, persistiert).
  externalKnowledge: ExternalKnowledgePolicyRepo;
  // SCRUM-421: einstellbare Upload-Grenzen (persistiert).
  uploadLimits: UploadLimitsRepo;
  /**
   * W1 Weg A: der Answer-Beleg-Schreibweg — und zwar HIER, nicht mehr als Option.
   *
   * Bis Auftrag 143 stand er als optionaler Parameter an `assembleServices`, mit dem ehrlich
   * benannten Preis, dass der Beleg NICHT durch das Dev-Journal lief: nach einem Replay fehlten
   * die Snapshots des Journallaufs. Pedis Entscheidung ist Weg A — die Zusage wird journalisiert
   * und muss Neustarts überleben. Genau dafür gehört das Repo in `AppRepos`: dieser Satz Repos
   * ist es, den `dev-persist.ts` journalierend umhüllt und beim Start aus dem Journal
   * wiederherstellt. Der zugehörige Eintrag steht in `MUTATING_METHODS`
   * (`createRecord`, `appendSnapshot`) — der Wächter in `tests/app/dev-persist.test.ts` erzwingt,
   * dass beide Mengen deckungsgleich bleiben.
   */
  answerSnapshots: AnswerSnapshotRepo;
}

// Verdrahtet aus den Repos die vollständige Service-Landschaft. Ein gemeinsames
// Audit-Log und ein KO-Repository für alle Module, die auf denselben Bestand wirken.
// SCRUM-387: exportiert für die Dev-Persistenz (identische Verdrahtung über journalierte Repos).
// SCRUM-523 P.3 (WP-A2): `opts.withTx` ist NUR gesetzt, wenn der Aufrufer wirklich einen echten
// Pg-Pool hat (buildPgServices unten) — Dev-Persistenz/InMemory rufen ohne opts, KoService fällt dann
// auf den sequentiellen purgeKo-Pfad zurück (s. Kommentar dort).
// G27: `opts.searchProjections` liefert den PERSISTENTEN Adapter der Suchprojektion — gesetzt nur
// von buildPgServices (echter Pool). Bewusst NICHT in `AppRepos`: die Projektion ist ein
// ABGELEITETER Datenraum, kein eigenständiger Bestand. Sie gehört deshalb nicht in das
// Mutations-Journal der Dev-Persistenz (SCRUM-387) — nach einem Replay ist sie schlicht leer und
// wird vom idempotenten Backfill wiederhergestellt. Ohne Injektion baut sich der KoService seinen
// In-Memory-Adapter über dasselbe KO-Repo (s. KoServiceDeps.searchProjections).
export function assembleServices(
  repos: AppRepos,
  opts: {
    withTx?: WithTx;
    searchProjections?: KoSearchProjectionRepo;
    // W1 S4: gesetzt nur von `buildPgServices` (echter Pool). Ohne Injektion die
    // In-Memory-Ablage — derselbe Vertrag, andere Haltbarkeit; beide werden getrennt geprüft.
    klaraSessions?: KlaraSessionRepo;
    // W1 Weg A (Auftrag 143): `answerSnapshots` stand hier als Option, mit dem benannten Preis,
    // dass der Beleg nicht durch das Dev-Journal lief. Die Restgrenze ist geschlossen — das Repo
    // liegt jetzt in `AppRepos` und kommt wie jedes andere aus `repos.`.
  } = {},
): AppServices {
  const audit = new AuditService({ repo: repos.auditRepo });
  const ko = new KoService({
    repo: repos.koRepo,
    audit,
    versions: repos.koVersions,
    evidence: repos.evidence,
    // SCRUM-395: Standard-Prüferanzahl aus der Admin-Einstellung — als injizierte
    // Funktion (keine Modulgrenzen-Verletzung); null → Modul-Default 3.
    defaultNeededValidations: () => repos.validationSettings.getDefaultNeeded(),
    // exactOptionalPropertyTypes: den Key nur setzen, wenn wirklich ein withTx da ist (sonst würde
    // `withTx: undefined` explizit gegen den optionalen KoServiceDeps.withTx?: WithTx verstoßen).
    ...(opts.withTx ? { withTx: opts.withTx } : {}),
    ...(opts.searchProjections ? { searchProjections: opts.searchProjections } : {}),
  });
  // FR-RSN-02/06 + SCRUM-502 R8: echtes Cloud-Modell, wenn der Cloud-Key per Env/Keychain verfügbar ist
  // — GECAPPT aus der Factory (Egress-Wächter rejectsConfidential=true + globaler In-Flight-Cap sind
  // dort zwingend verdrahtet; der rohe Client + der Schlüssel bleiben modul-intern, hier nicht
  // erreichbar). Ohne Schlüssel → undefined (deterministischer Betrieb).
  const cappedCloud = createCappedCloudClientFromEnv(
    process.env,
    process.env.KLARWERK_SKIP_KEYCHAIN ? () => undefined : undefined,
  );
  // SCRUM-424 + R8: eigener lokaler LLM (OpenAI-kompatibel), wenn KLARWERK_LOCAL_LLM_URL + _MODEL
  // gesetzt sind — ebenfalls gecappt (globaler Cap), aber ohne Egress-Wächter (on-prem, kein externer
  // Egress → bedient vertrauliche Inhalte weiter). Werte aus Launcher/Schlüsselbund, nie aus dem Code.
  const cappedLocal = createCappedLocalClientFromEnv();
  // SCRUM-164: ModelRun-Protokoll mitgeben (No-op-fähig); API-Shape des Reasoners unverändert.
  const reasoner = new Reasoner(
    cappedCloud ? new ModelProvider(cappedCloud) : undefined,
    undefined,
    repos.modelRuns,
    // SCRUM-386: Presets über das Repo — persistent in Pg bzw. im Dev-Journal der Desktop-App.
    repos.assistPresets,
    // SCRUM-424: zweites Backend (lokaler LLM) als optionaler Provider.
    cappedLocal ? new ModelProvider(cappedLocal) : undefined,
    // SCRUM-525 P.5 (WP6): persistente KI-Zuordnung (Policy) über das Repo — die Admin-Entscheidung
    // überlebt Neustart/Deploy (kein stiller Auto-Fallback). Geladen wird sie beim Serverstart.
    repos.reasonerPolicy,
  );

  // Vorab erstellt, da das Management-Modul (SCRUM-120) deren Live-Daten aggregiert.
  // FUNKE-FIX P0 (bens ROT-1): optionales Answer-Receipt-Secret aus ENV — gesetzt für
  // Mehr-Instanz-/reproduzierbare Deployments, sonst prozess-lokal zufällig (Belege sind kurzlebig).
  const ask = new AskService({
    reasoner,
    koService: ko,
    gaps: repos.gaps,
    // W3-C1 (Auftrag 76): ab hier schreibt der Antwortweg wirklich einen Beleg.
    // W1 Weg A (Auftrag 143): das Repo kommt aus `repos.` — derselbe Satz, den die Dev-Persistenz
    // journaliert. Kein bedingter Key mehr: es ist immer da, und damit läuft der Beleg in JEDER
    // Komposition durch denselben Weg.
    answerSnapshots: repos.answerSnapshots,
    audit,
    ...(process.env.KLARWERK_ASK_RECEIPT_SECRET
      ? { receiptSecret: parseConfiguredReceiptSecret(process.env.KLARWERK_ASK_RECEIPT_SECRET) }
      : {}),
    // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): dieselbe echte DB-Transaktion wie KoService — Audit-CAS
    // und Trust-Inkrement des „Danke" committen/rollbacken gemeinsam. Nur mit echtem Pg-Pool gesetzt.
    ...(opts.withTx ? { withTx: opts.withTx } : {}),
  });
  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): Versions-Autorität für die fail-closed Lesepfade
  // beider Befund-Dienste (unresolved() UND get()/Detail-Routen, gemeinsamer version-guard) — die
  // aktuelle KO-Version kommt IMMER frisch aus dem KO-Store; ein offener Befund mit abweichender
  // (oder nicht ermittelbarer) gebundener Version wird nie ausgeliefert.
  const koVersion = async (koId: string): Promise<number | undefined> =>
    (await ko.get(koId))?.version;
  const conflicts = new ConflictService({
    repo: repos.conflictsRepo,
    audit,
    currentVersion: koVersion,
  });
  // Berater-Konzept Duplikate 04.07. (Stufe D3): eigener Dienst für Überschneidungen (teilt Audit).
  const overlaps = new OverlapService({
    repo: repos.overlapRepo,
    audit,
    currentVersion: koVersion,
  });
  // SCRUM-510 R2b: GENERISCHES Import-Enable (quellneutral). Der externalId-Upsert-/Re-Sync-Strang ist an,
  // sobald IRGENDEINE Quelle aktiv ist; der Confluence-Flag KLARWERK_CONFLUENCE_IMPORT schaltet nur die
  // EINE Quelle Confluence. Ein Adapter #2 (Jira-TEST) OR-t später sein eigenes Flag ein — ohne dass der
  // Import-Kern Confluence-Begriffe kennt. Aus (Default) = heutiges Bestandsverhalten.
  // AUFTRAG-mega46 Block F: Prüfung aus dem EINEN Schalter-Registry, nicht mehr abgeschrieben.
  const externalImportEnabled = schalterAn("confluenceImport"); // künftig: || jiraEnabled || …
  const library = new LibraryService({
    koService: ko,
    audit,
    candidates: repos.candidates,
    externalUpsert: externalImportEnabled,
  });
  const lifecycle = new LifecycleService({ koService: ko, repo: repos.lifecycleRepo });
  // AUFTRAG-mega20 Block C/D: EINE ObjectStore-Instanz für die Composition-Root. Bis mega19 wurde
  // sie zweimal gebaut (einmal für die Routen, einmal für die Medien-Analyse); solange der Store
  // nur las und schrieb, war das folgenlos. Mit `list`/`delete` und der Lebenszyklus-Zuordnung ist
  // es das nicht mehr — zwei Instanzen wären zwei Orte, an denen jemand künftig einen Cache oder
  // eine Sperre einbaut, ohne die andere zu kennen. Ein Repo, ein Store.
  const objects = new ObjectStore({ repo: repos.objects });

  return {
    audit,
    reasoner,
    klaraSessions: opts.klaraSessions ?? new InMemoryKlaraSessionRepo(),
    importRuns: repos.importRuns,
    externalSources: repos.externalSources,
    ko,
    auth: new AuthService({
      users: repos.users,
      sessions: repos.sessions,
      resetTokens: repos.resetTokens,
      audit,
      // SCRUM-443: FR-RBAC-03 serverseitig durchsetzen (kein Selbst-Entzug der Admin-Rolle).
      canChangeRole,
      // AUFTRAG-mega62 Block B: dieselbe echte DB-Transaktion wie KoService/AskService — der
      // Konto-Vermerk der Hinweis-Kenntnisnahme und sein Prüfprotokoll-Eintrag committen bzw.
      // rollbacken gemeinsam. Nur mit echtem Pg-Pool gesetzt; ohne ihn trägt die Schreibreihenfolge
      // (Protokoll zuerst) die verbleibende Zusage, s. AuthService.acknowledgeNotice.
      ...(opts.withTx ? { withTx: opts.withTx } : {}),
    }),
    // AUFTRAG-mega20 Block D: die Ankerprüfung des Entwurfs bekommt ihre Auflösung HIER — capture
    // kennt den Objektspeicher nicht (Modulgrenze), die Composition-Root kennt beide. Dieselbe
    // Bewegung wie bei `koConfidentiality` für die Medien-Analyse.
    capture: new CaptureService({
      repo: repos.drafts,
      objectExists: async (objectId) => (await objects.metadata(objectId)) !== undefined,
    }),
    ask,
    // W3-C (JOB 541 D3): der Belegspeicher wird durchgereicht, weil der Erklaer-Lesepfad ihn
    // braucht. Er ist DASSELBE Repo, das der Schreibweg oben benutzt — ein zweites waere ein
    // zweiter Bestand und damit ein zweiter Wahrheitsort ueber denselben Beleg.
    answerSnapshots: repos.answerSnapshots,
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
      // AUFTRAG-mega76 BLOCK D: ein Konflikt zitiert BEIDE beteiligten Objekte; er zählt nur,
      // wenn beide sichtbar sind — dieselbe Paar-Regel wie /api/conflicts. Die Auflösung der
      // beiden Kennungen kann nur hier passieren: `services/management` kennt den KO-Bestand
      // nicht und soll ihn nicht kennen.
      countOpenConflicts: async (opts) => {
        const offen = await conflicts.unresolved();
        let zaehler = 0;
        for (const fund of offen) {
          const [a, b] = await Promise.all([ko.get(fund.koA), ko.get(fund.koB)]);
          if (a && b && opts.sichtbar(a) && opts.sichtbar(b)) {
            zaehler += 1;
          }
        }
        return zaehler;
      },
      pendingRevalidation: () => lifecycle.pendingRevalidation(),
      busFactor: (opts) => library.busFactor(opts),
    }),
    // SCRUM-118: externer Such-Proxy (Wikipedia) — optional via Env abschaltbar.
    externalSearch: createExternalSearchFromEnv(),
    lifecycle,
    i18n: new I18nService(),
    // SCRUM-121: interner Objekt-/Attachment-Speicher (In-Memory; Pg/Disk = Folge-Ticket).
    objects,
    // AUFTRAG-mega20 Block C: die Quellen der Referenzprüfung, direkt an den REPOS — nicht an den
    // Diensten. Der Unterschied ist tragend: `ko.list()` blendet getrashte Wissensobjekte aus
    // (SCRUM-422), und ein Aufräumlauf, der den Papierkorb übersieht, macht aus „gelöscht"
    // ein „unwiederbringlich". Hier wird deshalb bewusst der ROHE Bestand befragt.
    objectReferences: {
      kos: () => repos.koRepo.list({}),
      drafts: () => repos.drafts.list(),
      versions: (koId) => repos.koVersions.listByKo(koId),
      evidence: (koId) => repos.evidence.listByKo(koId),
    },
    media: new MediaAnalysisService({
      objects,
      // SCRUM-502 R7: der (Cloud-)Whisper-Transkriber durch den Egress-Chokepoint — verweigert
      // vertrauliche Medien per Konstruktion (rejectsConfidential), analog cappedCloud beim Reasoner.
      // SCRUM-502 R8: gecappter Cloud-Transkriber aus der Factory (Egress-Wächter zwingend; roher
      // Client + Credential modul-intern, hier nicht erreichbar). Ohne Schlüssel → undefined (inaktiv).
      transcriber: createCappedTranscriberFromEnv(),
      // SCRUM-521 (WP2, nacht24): KO-Kontext für die Egress-Entscheidung — die Stufen ALLER KOs,
      // die das Objekt als Anhang tragen (restriktivste gewinnt im Service; ein „intern"
      // hochgeladenes Medium an einem vertraulichen KO bleibt vertraulich). Injizierte Auflösung,
      // damit media von knowledge-object entkoppelt bleibt; Fehler behandelt der Service fail-safe.
      // FUNKE-FIX P2 (bens Sammel-Nacht): Ein genuin FEHLENDES Feld ist der dokumentierte
      // „intern"-Default (SCRUM-415). Ein PRÄSENTER, aber korrupter/unerwarteter Wert wird bewusst
      // UNVERÄNDERT durchgereicht — mediaIsConfidential hebt ihn dann fail-closed auf den höchsten
      // Rang an (kein externer Egress), statt ihn hier still zu „intern" zu glätten.
      koConfidentiality: async (objectId) =>
        (await ko.list({}))
          .filter((k) => (k.attachments ?? []).some((a) => a.objectId === objectId))
          .map((k) => k.confidentiality ?? "intern"),
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
    // WP-D11: PPTX-Folien → PNG (LibreOffice headless). In Tests/Dev ohne soffice meldet
    // available() ehrlich false (Route → 503); Tests injizieren einen Fake VOR buildApp.
    slideConverter: createSofficeSlideConverter(),
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
    importRuns: new InMemoryImportRunRepo(),
    externalSources: new InMemoryExternalSourceRepo(),
    modelRuns: new InMemoryModelRunRepo(),
    notificationSeen: new InMemoryNotificationSeenRepo(),
    assistPresets: new InMemoryAssistPresetRepo(),
    reasonerPolicy: new InMemoryReasonerPolicyRepo(),
    validationSettings: new InMemoryValidationSettingsRepo(),
    externalKnowledge: new InMemoryExternalKnowledgePolicyRepo(),
    uploadLimits: new InMemoryUploadLimitsRepo(),
    // W1 Weg A (Auftrag 143): der Answer-Beleg gehört in denselben Repo-Satz wie alles andere —
    // nur so umhüllt ihn die Dev-Persistenz und spielt ihn beim Start aus dem Journal zurück.
    answerSnapshots: new InMemoryAnswerSnapshotRepo(),
  };
}

// In-Memory-Komposition (Tests, Dev ohne Datenbank).
export function buildServices(): AppServices {
  // W3-C1: auch die In-Memory-Komposition schreibt Belege — derselbe Vertrag, andere Haltbarkeit.
  // W1 Weg A: das Repo kommt jetzt aus `inMemoryRepos()`; hier bleibt nichts nachzureichen.
  return assembleServices(inMemoryRepos());
}

// Postgres-Komposition: dieselbe App, alle Repos gegen eine echte Datenbank.
//
// ================================================================================================
// JOB 596 · D9 — HIER, UND NUR HIER, WIRD DIE RESETSPERRE VERDRAHTET.
// ================================================================================================
//
// Die Ownerentscheidung (`00_CONTROL/ENTSCHEIDUNGEN/JOB-596.md`) lautet „zentrale Sperrrichtung"
// statt elf einzeln geänderter Adapter. DIES IST DIESE EINE STELLE: Der rohe Pool wird EINMAL
// umhüllt, und alle 28 Weitergaben unten bekommen die Hülle. Kein Adapter wurde angefasst, keiner
// muss von der Sperre wissen — genau das war der Sinn der Entscheidung.
//
// BEN hat an D8 gerügt, dass der `gatedPool` nur exportiert und nicht verdrahtet war: „damit wirkt
// die zentrale Resetsperre dort nicht, wo die 24 Adapter zugreifen." Das traf. Der Beleg, dass es
// jetzt anders ist, steht in `tests/db-tx/job596-adapter-sperre.test.ts` — er greift über
// `services.objects` auf einen BESTEHENDEN Adapter zu und misst, dass während eines Resets keine
// einzige Nutzanweisung die Datenbank erreicht.
//
// WER DEN ROHEN POOL WEITER BRAUCHT — und warum das kein zweiter Weg ist:
//
//   · `migrate(pool)` und `migrateAuthTokensAtRest(pool)` in `server.ts:23/:27` laufen VOR diesem
//     Aufruf, beim Start, bevor irgendein Reset laufen kann. Sie nehmen den rohen Pool und dürfen
//     das: Ein Schemalauf, der sich an einer Resetsperre abwiese, käme nie durch den Start.
//   · `fuehreBestandsresetAus()` nimmt den ROHEN Pool (s. `services/db-tx/src/bestandsreset.ts`) —
//     sonst nähme der Reset die GETEILTE Sperre seiner eigenen Kapselung und stünde sich mit der
//     EXKLUSIVEN selbst im Weg. Der Fall `R1` in `gated-pool.test.ts` hält das fest.
//
// Beide sind benannte Ausnahmen mit Grund, kein belassener Parallelweg: Nach dem Start hat kein
// Adapter mehr einen Weg an der Hülle vorbei.
export function buildPgServices(rohPool: Pool): AppServices {
  const pool = gatedPool(rohPool);
  return assembleServices(
    {
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
      // W2-A/148: Laufdomaene persistent — ein Lauf muss einen Neustart ueberleben, sonst waere
      // „haengend in QUEUED" nach jedem Neustart ununterscheidbar von „nie gestartet".
      importRuns: new PgImportRunRepo(pool),
      externalSources: new PgExternalSourceRepo(pool),
      // SCRUM-164: ModelRun-Protokoll persistent (KI-Aufrufe nachvollziehbar).
      modelRuns: new PgModelRunRepo(pool),
      // Audit-P3 (SCRUM-397): Gelesen-Status der Glocke persistent.
      notificationSeen: new PgNotificationSeenRepo(pool),
      // SCRUM-386: kundeneigene KI-Assist-Presets persistent.
      assistPresets: new PgAssistPresetRepo(pool),
      // SCRUM-525 P.5 (WP6): KI-Zuordnung (Policy) persistent — überlebt Neustart/Deploy.
      reasonerPolicy: new PgReasonerPolicyRepo(pool),
      // SCRUM-395: Standard-Prüferanzahl persistent.
      validationSettings: new PgValidationSettingsRepo(pool),
      // SCRUM-414: externe-Wissensabfrage-Regler persistent.
      externalKnowledge: new PgExternalKnowledgePolicyRepo(pool),
      // SCRUM-421: Upload-Grenzen persistent.
      uploadLimits: new PgUploadLimitsRepo(pool),
      // W3-C1 (Auftrag 76): der Answer-Beleg gegen die echte Datenbank. Die Tabellen
      // `answer_records` und `answer_snapshots` stehen seit Freeze 61 im Migrationsweg.
      // W1 Weg A (Auftrag 143): er steht jetzt bei den übrigen Repos statt in den Optionen —
      // dieselbe Stelle, dieselbe Regel, in allen drei Kompositionen.
      answerSnapshots: new PgAnswerSnapshotRepo(pool),
    },
    {
      // SCRUM-523 P.3 (WP-A2): EIN echter Pg-Pool (derselbe, mit dem PgKoRepo/PgAuditRepo oben
      // verdrahtet sind) → purgeKo kann repo.delete + audit.record in EINER echten Transaktion
      // ausführen (services/db-tx). Ohne diesen Zweig (InMemory/Dev-Journal) bleibt der sequentielle
      // Fallback aktiv (s. KoService.purgeKo).
      withTx: (fn) => withPgTx(pool, fn),
      // G27: die revisionsgebundene Suchprojektion liegt in DERSELBEN Datenbank wie der Bestand
      // (dedizierte Kundeninstanz = ein Datenraum). Kein zweiter Dienst, kein geteilter Cache,
      // keine kundenübergreifende Ablage.
      searchProjections: new PgKoSearchProjectionRepo(pool),
      // W1 S4: Klara-Sitzungen und Zustimmungen liegen in DERSELBEN Datenbank wie der
      // Bestand — kein zweiter Dienst, keine kundenübergreifende Ablage.
      klaraSessions: new PgKlaraSessionRepo(pool),
    },
  );
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
// G27 R1 (KW-ARCH-G27-HTTP-MASKIERUNG-07 §1, KW-G27-R1-KOPF-AUSWERTUNG-07 §3): DER ZWEITE ÄUSSERE
// WEG. `sendError` ist der Standardausgang der Routen, die abfangen — aber GENAU DIE SUCHROUTEN
// fangen nicht ab: `GET /api/library/search`, `POST /api/ask` und `POST /api/reasoner` (task `ask`)
// lassen den Fehler durch und landen hier. Fastifys Standardweg serialisiert dann `error.code` und
// `error.message`, also den technischen Code UND die Control-State-Meldung („Zustand V2_BUILDING").
// Der Status war zufällig schon 500; alles andere verletzte §4 der Entscheidung.
//
// KEINE ZWEITE WAHRHEIT. Geprüft wird das aus `http.ts` exportierte Prädikat und geantwortet über
// dieselbe `sendError`-Funktion — die Codekenntnis und die generische Antwort stehen genau einmal
// im Repository. Eine eigene Codeliste hier wäre die Duplikation, die morgen auseinanderläuft.
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
  if (isInternalOnlyError(error)) {
    sendError(reply, error);
    return;
  }
  reply.send(error);
}

// ================================================================================================
// JOB 1113 / JOB-947-B3 — DIE BEIDEN BENANNTEN QUELLEN FÜR /health
// ================================================================================================

/**
 * Was ausgegeben wird, wenn der Deploy-Commit nicht bekannt ist.
 *
 * Ehrlich und ausdrücklich: **nie ein erfundener Hash, nie ein Platzhalter, der wie einer aussieht.**
 * Ein unbekannter Stand ist eine Information; ein falscher wäre eine Falschaussage.
 */
export const BUILD_UNBEKANNT = "unbekannt";

/** Die EINE Umgebungsvariable, aus der der Deploy-Commit kommt. Der Name ist Teil des Vertrags. */
export const BUILD_COMMIT_ENV = "KLARWERK_BUILD_COMMIT";

// Ein Git-Objektname: 7 bis 40 hexadezimale Zeichen. Alles andere ist KEIN Commit.
const COMMIT_RE = /^[0-9a-f]{7,40}$/i;

/**
 * Der Deploy-Commit aus der benannten Quelle — oder ehrlich `unbekannt`.
 *
 * Die Formprüfung ist kein Zierat: eine halb verdrahtete Auslieferungskette reicht gern einen
 * Branchnamen, ein `latest` oder einen uneingesetzten `$SOURCE_COMMIT` durch. Das als Deploy-Commit
 * auszugeben wäre derselbe Fehler wie ein erfundener Hash — nur unauffälliger. Wer den Wert setzt,
 * setzt ihn richtig oder gar nicht.
 *
 * ABSICHTLICH KEINE PLATTFORM-AUTOMATIK: der Baum kennt (gemessen) keine Commit-Variable, und JOB
 * 947 warnt ausdrücklich davor, Plattformverhalten zu behaupten, das nie gemessen wurde. Deshalb
 * genau EIN Name, den die Auslieferung selbst setzen muss.
 */
export function buildCommit(env: NodeJS.ProcessEnv = process.env): string {
  const roh = (env[BUILD_COMMIT_ENV] ?? "").trim();
  return COMMIT_RE.test(roh) ? roh : BUILD_UNBEKANNT;
}

// Einmal gelesen, dann gemerkt: die Datei ändert sich zur Laufzeit nicht, und /health soll keine
// Plattenzugriffe pro Anfrage machen.
let versionGemerkt: string | null = null;

/**
 * Die Version aus `package.json` — der einzigen Versionsquelle, die im Produktionsimage existiert.
 *
 * WARUM NICHT `apps/web/src/version.ts`, wo `APP_VERSION` steht: `Dockerfile:37-38` kopiert in die
 * Laufzeitstufe ausschliesslich `services` und `apps/web/dist`. **`apps/web/src` ist im Image nicht
 * vorhanden** — ein Import von dort bräche den Container beim Start. `package.json` liegt dort
 * (`Dockerfile:33`). Die Quelle ist damit gemessen, nicht gewählt.
 *
 * Dass beide Stellen dieselbe Nummer tragen, erzwingt `tests/app/health-version-commit.test.ts`;
 * ohne diesen Wächter wäre `package.json` eine zweite Wahrheit statt einer Kopie.
 */
export function buildVersion(): string {
  if (versionGemerkt !== null) {
    return versionGemerkt;
  }
  try {
    const roh = readFileSync(new URL("../../../package.json", import.meta.url), "utf8");
    const wert = (JSON.parse(roh) as { version?: unknown }).version;
    versionGemerkt = typeof wert === "string" && wert.trim() !== "" ? wert.trim() : BUILD_UNBEKANNT;
  } catch {
    // Eine unlesbare oder kaputte package.json macht den Server nicht krank — sie macht die
    // Versionsangabe ehrlich unbekannt.
    versionGemerkt = BUILD_UNBEKANNT;
  }
  return versionGemerkt;
}

export function buildApp(
  services: AppServices = buildServices(),
  // Pedi 05.07. (Beta): optionale Werksreset-Fähigkeit. Standard = nicht verfügbar (Tests/Produktion);
  // nur der Desktop/Dev-Journal-Betrieb (server.ts) reicht eine echte Fähigkeit durch.
  opts: { factoryReset?: FactoryReset } = {},
): FastifyInstance {
  // SCRUM-490 R3 (B2, Fix 4): trustProxy gezielt aus env (KLARWERK_TRUST_PROXY) — request.ip = echte
  // Client-IP hinter dem bekannten Proxy-Hop; Default (unset) = false = Socket-Peer (heutiges Verhalten).
  // NIE blanket (spoofbar). Siehe resolveTrustProxy.
  const app = Fastify({ trustProxy: resolveTrustProxy() });
  // SCRUM-498 B2: einheitliche Backpressure-Antwort. Ein Modell-Cap-Überlauf (ModelCapacityError) wird
  // von der Reasoner-Kette bis hierher durchgereicht → 503 + Retry-After (kein 500/Crash). Jeder andere
  // Fehler wird formtreu an Fastifys Standard-Fehlerbehandlung weitergereicht (Validierungs-400 etc.
  // unverändert).
  app.setErrorHandler(modelBusyErrorHandler);
  // G27 R1 / Entscheidung 06 §3 — DIE READINESS-BINDUNG.
  //
  // `onReady` ist der von Fastify vorgesehene asynchrone Start-/Ready-Pfad: `app.ready()`,
  // `app.listen()` und `app.inject()` warten ihn ab, und ein Fehler darin lässt die App gar nicht
  // erst bereit werden. Genau das verlangt 06 §3 — „der notwendige Lauf wird synchron abgewartet,
  // bevor die Anwendung als vollständig bereit gilt", und bei Fehlschlag bleibt sie fail-closed
  // (06 §2, `FAILED`). Ein Hintergrundlauf mit gleichzeitig positiver Readiness ist ausdrücklich
  // verboten; ein `void`-Aufruf hier wäre genau der.
  //
  // GENAU EINMAL JE APP-INITIALISIERUNG (06 §5): `onReady` läuft je Instanz einmal, nicht je
  // Request und nicht je Route.
  //
  // G27 R2 (Entscheidung 15 §A): die Betriebsfolge selbst steht seit dieser Welle in
  // `search-projection-startup.ts`. Sie ist unverändert dieselbe — sie ist nur nicht mehr privat,
  // weil der CLI-Seed sie ebenfalls braucht und sie bis dahin nicht erreichen konnte. Kein
  // zweiter Weg, keine zweite Zustandsmaschine: `stelleSuchprojektionBereit` ist der EINE Einstieg
  // für App-Ready und `runSeed()`. Er wirft, wenn die Instanz nicht `V2_ACTIVE` erreicht — die App
  // wird dann nie ready und die Suche bleibt fail-closed.
  app.addHook("onReady", async () => {
    await stelleSuchprojektionBereit(services.ko);
  });
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
    // SCRUM-490 R2 (B2): IP-Drossel für fehlgeschlagene Add-on-Auth-Versuche (falscher/fehlender Key)
    // gegen die Add-on-Endpunkte. Ein gültiger Key läuft über addonRateLimit; eine gültige Session ist
    // ausgenommen (Session-Pfad ungedrosselt).
    const authAttemptThrottle = new AddonAuthAttemptThrottle(addonAuthThrottleConfigFromEnv());
    app.addHook("onRequest", async (request, reply) => {
      const auth = resolveAddonAuth(request);
      // SCRUM-490 R3/R4 (B2): Throttle für fehlgeschlagene Add-on-Auth-Versuche — VOR dem 401/Principal.
      //  Fix 3: ein UNGÜLTIGER Key zählt auf JEDER Route (kein 401/403-Gültigkeitsorakel, keine
      //         ungedrosselte Fremdroute); fehlende Auth zählt gegen die NORMALISIERTEN Add-on-Endpunkte
      //         (Trailing-Slash/%-Enkodierung/Case/Dot-Segmente, isAddonEndpointPath).
      //  Fix 2: eine „gültige Session" wird ECHT authentifiziert (auth.authenticate) — ein gefälschter
      //         Bearer/erfundenes kw_session-Cookie umgeht die Zählung NICHT (nicht nur Token-Präsenz).
      //  R4/Fix 1: NUR ein ECHTER Preflight (OPTIONS OHNE Key-Header) ist ausgenommen. OPTIONS MIT
      //         gesetztem x-klarwerk-addon-key ist KEIN legitimer Preflight (Browser senden auf dem
      //         Preflight nie den Key), sondern ein Auth-Versuch → wird gezählt (schließt das 401/403-
      //         Orakel via OPTIONS). Key-Präsenz = auth.kind ist „valid"/„invalid" (nicht „none").
      const hasKey = auth.kind === "valid" || auth.kind === "invalid";
      const isRealPreflight = request.method === "OPTIONS" && !hasKey;
      if (!isRealPreflight) {
        let failed: boolean;
        if (request.method === "OPTIONS") {
          // OPTIONS MIT Key → immer Versuch (unabhängig von der Key-Gültigkeit, damit weder 401 noch 403
          // via Preflight ein ungedrosseltes Gültigkeitsorakel bleibt).
          failed = true;
        } else if (auth.kind === "invalid") {
          failed = true;
        } else if (auth.kind === "valid") {
          failed = false;
        } else if (isAddonEndpointPath(request.raw.url)) {
          const token = tokenFromRequest(request);
          const validSession = token ? Boolean(await services.auth.authenticate(token)) : false;
          failed = !validSession;
        } else {
          failed = false;
        }
        if (failed && !authAttemptThrottle.registerFailure(request.ip, Date.now())) {
          reply
            .code(429)
            .header("retry-after", String(authAttemptThrottle.retryAfterSeconds()))
            .send({
              error: "RATE_LIMITED",
              message: "Zu viele Zugangsversuche — bitte später erneut.",
            });
          return reply;
        }
      }
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
    // SCRUM-490 H: das statische Klara-Add-in-Bundle unter /addin/* — NUR bei aktivem Flag. Traversal-
    // sicher (explizite Datei-Map), kein Directory-Listing, öffentlich lesbar (kein Key), berührt den
    // Add-on-Auth/Throttle-Pfad nicht und öffnet keinen neuen API-Weg. Flag AUS → nicht registriert → 404.
    app.register(addinStaticRoutes());
  }

  // JOB 1113 (JOB-947-B3): /health nennt jetzt zusätzlich VERSION und DEPLOY-COMMIT.
  //
  // JOB 947 nannte den Zustand davor K-VAKUUM: ein `/health`, das nur `{"status":"ok"}` liefert,
  // kann nicht unterscheiden, WELCHER Stand antwortet — „Coolify Success" belegte damit den
  // Deploy-Lauf, nie den Deploy-Stand. Genau eine Auslieferung (Ship 9) hat den Commit einmal von
  // Hand gegengelesen; ab hier ist das eine Abfrage statt einer Erinnerung.
  //
  // `status` bleibt unverändert `"ok"` — der Container-Healthcheck (`Dockerfile:42-43`) prüft
  // genau dieses Feld, und die bestehenden Bestandstests binden es. Die beiden neuen Felder sind
  // rein additiv.
  app.get("/health", async () => ({
    status: "ok",
    version: buildVersion(),
    commit: buildCommit(),
  }));
  // FR-RSN-05 + WP-VIP2-GATE (bens P1): die beiden OEFFENTLICHEN Status-Routen sind ABSTRAHIERT —
  // KEIN Provider-/Modellname (der stand hier frueher anonym lesbar). Provider-Details liefert
  // ausschliesslich die ECHTE Admin-Sicht GET /api/reasoner/config (users.manage — WP-VIP2-GATE-2
  // Fix 3/4).
  // AUFTRAG-mega69 B2 (bens sammel65, Punkt 4 — der Vertrag ehrlich benannt): der oeffentliche
  // Status ist seit D-AISTATE/mega67 BEWUSST breiter als {active, mode}: er traegt zusaetzlich
  // `reachable` sowie die abstrakten per-Aufgabe-Karten `tasks` (nutzbar?) und `billable`
  // (Cloud KANN fuer diese Aufgabe kostenpflichtig genutzt werden — eine Moeglichkeit, keine
  // Abrechnungstatsache). Damit ist je Aufgabe ableitbar, ob die Kette Cloud oder Nicht-Cloud
  // enthaelt — weniger als Anbieter-/Modelloffenlegung, aber mehr als frueher; das ist eine
  // BEWUSSTE Vertragsentscheidung (Kostenhinweis fuer alle Rollen), keine stille Erweiterung.
  // PAKET 2 (D-AISTATE, Pedi 23.07.): der Status-Abruf stößt — HÖCHSTENS einmal je Cache-Frist (60 s)
  // und feuern-und-vergessen — einen echten Erreichbarkeits-Probe an; die Antwort trägt sofort den
  // aktuellen Cache-Zustand (kein Ping pro Request, Kosten/Rate geschont).
  app.get("/api/reasoner/status", async () => {
    services.reasoner.refreshReachabilityIfStale();
    return services.reasoner.publicStatus();
  });
  app.get("/api/ai-status", async () => {
    services.reasoner.refreshReachabilityIfStale();
    return { ai: services.reasoner.publicStatus() }; // §2.1: ist die KI verfügbar?
  });

  // ============================================================================================
  // W1 S4 — KLARA-STATUS, SITZUNG UND ZUSTIMMUNG (KW-S4-04 §13-100)
  // ============================================================================================
  //
  // NUR VERDRAHTUNG. Die Auflösung entsteht im Reasoner-Modul (`resolveKlaraPolicy`), die
  // Sitzungsführung im Dienst; hier wird beides zusammengesteckt und registriert.
  //
  // Die Policyquelle liest die VORHANDENE Reasoner-Konfiguration bei jedem Zugriff frisch — eine
  // Kopie oder ein Zwischenspeicher wäre eine zweite Wahrheit, und eine Admin-Änderung würde
  // erst beim nächsten Neustart wirken. `configStatus()` liefert genau die Felder, die der
  // Resolver braucht; Klara bekommt dadurch KEINE eigene Konfiguration (KW-S4-04 §129).
  //
  // Die beiden bestehenden Statusrouten darüber bleiben unverändert: Klara-spezifische Policy dort
  // hineinzuziehen ist das ausdrückliche No-Go aus KW-S4-04 §54.
  // KW-KA4: DERSELBE Dienst, zwei Aufrufer. Er stand bis hierher inline in der Registrierung; für
  // die Einwilligung je Dokument braucht ihn auch `askRoutes` (Ausführungstor vor dem Ask). Eine
  // zweite Instanz wäre eine zweite Wahrheit über denselben Sitzungsbestand — deshalb wird die
  // vorhandene gehoben und weitergereicht, nicht kopiert. Keine neue Ablage, keine neue Route.
  const klaraSessions = new KlaraSessionService({
    repo: services.klaraSessions,
    policy: () => {
      const config = services.reasoner.configStatus();
      const antwortWahl = config.taskConfig.perTask.answer ?? config.taskConfig.global;
      // W1 S4 R2 (BEN ROT-1): DIE EFFEKTIVE ANSWER-BINDUNG entscheidet, nicht die globale
      // Bevorzugung. `config.provider`/`config.model` beschreiben den bevorzugten aktiven
      // Provider; bei gleichzeitig verdrahtetem Cloud UND Local und Admin-Wahl
      // `answer = local` meldete der Kopf dadurch `internal` MIT dem Cloud-Anbieter.
      // `config.effectiveProvider.answer` ist die taskbezogene Wahrheit, die der Reasoner
      // ohnehin schon führt — sie wird hier durchgereicht, nicht nachgerechnet.
      return {
        choice: antwortWahl,
        source: config.policySource,
        effectiveAnswerProvider: config.effectiveProvider.answer ?? "deterministic",
        cloudConfigured: config.cloudConfigured,
        localConfigured: config.localConfigured,
        providerLabel: config.provider,
        modelLabel: config.model,
        localProviderLabel: config.localProvider,
      };
    },
  });
  app.register(klaraAiRoutes({ sessions: klaraSessions }, guards));

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
  // SCRUM-523 P.3 (WP2): den zentralen Purge-Aufräum-Hook verdrahten. JEDE harte KO-Endlöschung (manuell
  // ODER automatisch abgelaufen) räumt jetzt über EINEN Vertrag die Folgeartefakte auf: offene Konflikte/
  // Überschneidungen geordnet schließen + Embedding-Vektor entfernen. Damit umgeht auch der automatische
  // Trash-Sweep die Aufräum-Kaskade nicht mehr (früher: repo.delete direkt → verwaiste „Geister").
  // conflicts/overlaps sind idempotent (schließen nur noch offene Einträge) — der Aufruf im Löschpfad der
  // Routen bleibt für den SOFT-Delete (Papierkorb) zuständig; hier greift der HARTE Purge.
  services.ko.setPurgeCleanup(async (koId, actor) => {
    await services.conflicts.onKoRemoved(koId, actor);
    await services.overlaps.onKoRemoved(koId, actor);
    await removeKoFromDuplicatePrefilter(koId, semanticPrefilter);
  });
  // WP-SUBMIT-ASYNC (Pedis R3): der Prüf-Worker kapselt die früher synchron im Submit-Pfad
  // laufende Erkennung (detectConflicts/detectDuplicates) — Concurrency 1, In-Process, PII-freies
  // Log. Ein von Tests vorab gesetzter services.aiCheckWorker (Spy) hat Vorrang.
  const aiCheckWorker =
    services.aiCheckWorker ??
    createAiCheckWorker({
      ko: services.ko,
      run: createAiCheckRunner({
        ko: services.ko,
        conflicts: services.conflicts,
        overlaps: services.overlaps,
        overlapSettings: services.overlapSettings,
        reasoner: services.reasoner,
        semanticPrefilter,
      }),
    });
  services.aiCheckWorker = aiCheckWorker;
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
        // AUFTRAG-mega14 Block E (SCRUM-421): DERSELBE Object-Store, in den der Upload schreibt —
        // die Größenprüfung liest die gespeicherte Größe, nicht die Client-Angabe.
        objects: services.objects,
        // AUFTRAG-mega14 Block D (SCRUM-414): DIESELBE Stufen-Quelle, die auch external-routes und
        // reasoner-routes lesen — eine Autorität, kein zweiter Speicher.
        externalPolicy: services.externalKnowledge,
        // AUFTRAG-mega16 Block A (bens SB-4): die Allowlist interner Origins — die EINZIGE Stelle,
        // an der sie herkommt. Kein Host steht im Code; ohne Konfiguration ist sie leer, und dann
        // ist jede Adresse öffentlich. Genau das ist der fail-closed Auslieferungszustand.
        internalSourceOrigins: parseInternalSourceOrigins(
          process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS,
        ),
        audit: services.audit,
        // Weg 3 (Feature-Flag): semantischer Vorfilter (undefined = Default „jeder gegen jeden").
        semanticPrefilter,
        // WP-SUBMIT-ASYNC: Prüf-Job-Vermerk + Hintergrund-Worker statt synchroner Erkennung.
        aiCheckWorker,
        // AUFTRAG-mega19 Block B: der Entwurfs-Zugang der Dokumentübernahme. HIER, in der
        // Composition-Root, treffen sich Capture und Knowledge-Object — ko-routes importiert das
        // Capture-Modul nicht. Die Sichtbarkeitsregel ist DIESELBE Funktion wie auf den
        // Entwurfs-Routen (canSeeDraft), nicht eine zweite Auffassung davon.
        draftPromotion: {
          load: async (draftId, user) => {
            const draft = await services.capture.getDraft(draftId);
            if (!draft) {
              return { ok: false, reason: "not-found" as const };
            }
            if (!canSeeDraft({ id: user.id, role: user.role as SessionUser["role"] }, draft)) {
              return { ok: false, reason: "forbidden" as const };
            }
            const input = await services.capture.toKoInput(draftId);
            // WP-RETEST7 R6: author IMMER aus einem echten Nutzer — normal der Originalautor des
            // Entwurfs (FR-CAP-07); trägt ein Altbestands-Entwurf keinen, wird ehrlich der
            // einreichende Session-Nutzer gesetzt. Gleiche Regel wie im Promote-Pfad.
            return {
              ok: true as const,
              input: { ...input, author: input.author.trim() ? input.author : user.id },
            };
          },
          discard: (draftId) => services.capture.deleteDraft(draftId),
          // AUFTRAG-mega21 Block B: Entwurfsaktualisierung UND Erstanlage in EINEM Vorgang. Die
          // Sichtbarkeitsregel ist DIESELBE Funktion wie oben (canSeeDraft) und dieselbe wie auf
          // `PUT /api/drafts/:id` — es entsteht keine zweite Auffassung davon, wer einen Entwurf
          // schreiben darf. `continueDraft` ist derselbe Aufruf, den auch die Entwurfsroute
          // benutzt, samt seiner Merge- und Löschsemantik (mergeDraftPayload) und seiner
          // Formprüfung; deren Fehler wird als `invalid` durchgereicht statt als 500 verschluckt.
          applyAndLoad: async (draftId, payload, user) => {
            const draft = await services.capture.getDraft(draftId);
            if (!draft) {
              return { ok: false, reason: "not-found" as const };
            }
            if (!canSeeDraft({ id: user.id, role: user.role as SessionUser["role"] }, draft)) {
              return { ok: false, reason: "forbidden" as const };
            }
            // ==================================================================================
            // AUFTRAG-mega22 Block D — FORMFEHLER AM RAND, STÖRUNGEN DURCH DEN ZENTRALEN PFAD.
            // ==================================================================================
            //
            // (1) DIE GESTALT ZUERST. Was hier abgewiesen wird, kann `continueDraft` danach nicht
            //     mehr werfen — insbesondere nicht mehr der TypeError aus `Object.entries(null)`,
            //     dessen Rohtext bis mega21 als 400-Meldung nach aussen ging.
            const gestalt = validateDraftPayloadShape(payload);
            if (!gestalt.ok) {
              return { ok: false as const, reason: "invalid" as const, message: gestalt.message };
            }
            try {
              await services.capture.continueDraft(draftId, gestalt.payload, user.id);
            } catch (error) {
              // (2) NUR BEKANNTE FORMFEHLER WERDEN 400. `CaptureError` ist die benannte Klasse der
              //     Fachprüfungen dieses Moduls; ihre Meldungen sind für Menschen geschrieben und
              //     dürfen nach aussen. `NOT_FOUND` ist ausgenommen — der Entwurf war oben noch da,
              //     ein Verschwinden dazwischen ist keine Form-, sondern eine Bestandsfrage.
              if (error instanceof CaptureError && error.code !== "NOT_FOUND") {
                return {
                  ok: false as const,
                  reason: "invalid" as const,
                  message: error.message,
                };
              }
              // (3) ALLES ANDERE IST EINE STÖRUNG und wird ERNEUT GEWORFEN. Sie läuft dann durch
              //     den zentralen, redigierten Fehlerpfad der Route (sendError) und wird zu 500
              //     OHNE Rohmeldung — statt als 400 den Vorgangsschlüssel des Clients zu töten
              //     (lib/createOperation.ts: 4xx gilt als eindeutige Ablehnung).
              throw error;
            }
            const input = await services.capture.toKoInput(draftId);
            // Dieselbe Autorregel wie in `load` (WP-RETEST7 R6) — der Entwurfsautor bleibt der
            // Autor des Wissensobjekts, auch wenn ein Admin einreicht. Der EIGENTÜMER des
            // Vorgangs ist davon getrennt und ist der einreichende Nutzer (mega21 Block A).
            return {
              ok: true as const,
              input: { ...input, author: input.author.trim() ? input.author : user.id },
            };
          },
        },
      },
      guards,
    ),
  );
  app.register(
    validationRoutes(services.validation, guards, { ko: services.ko, worker: aiCheckWorker }),
  );
  // AUFTRAG-mega74 BLOCK D (G5): der EINE Zugang, über den die Nebenwege die Sichtbarkeit ihrer
  // beteiligten Wissensobjekte erfragen. Hier gebaut, damit alle drei dieselbe Quelle benutzen.
  const koSichtbarkeit = { get: (id: string) => services.ko.get(id) };
  // JOB 1546 D2 (A28, OFFEN.md:165): zwei Argumente MEHR am bestehenden Aufruf, kein zweiter
  // Aufrufweg. `services.overlaps` liefert die offenen Ueberschneidungen, `services.ko` den
  // Bestand, aus dem die EIGENEN Objekte des Betrachters bestimmt werden. Damit bekommt die Regel
  // aus `7fb6ace` ihren ersten Aufrufer — bis hierher hatte sie keinen (gemessen in JOB 1546 D1).
  app.register(
    conflictRoutes(services.conflicts, guards, koSichtbarkeit, services.overlaps, services.ko),
  );
  // AUFTRAG-mega29 C2: die schmale Abdeckungs-Zusammenfassung, die die LEEREN Konflikt-/Duplikat-
  // Boards brauchen, um nicht als „geprüft und frei" gelesen zu werden.
  app.register(aiCheckCoverageRoutes(services.ko, guards));
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-API (/api/duplicates) +
  // (Pedi 04.07.) einstellbare Anzeige-Schwelle.
  app.register(
    overlapRoutes(
      {
        overlaps: services.overlaps,
        settings: services.overlapSettings,
        audit: services.audit,
        kos: koSichtbarkeit,
      },
      guards,
    ),
  );
  app.register(
    captureRoutes({ ...services, notifyAssignment, semanticPrefilter, aiCheckWorker }, guards),
  );
  // WP-D11: PPTX-Folien-Konvertierung (eigene Route mit großem bodyLimit + Auth vor dem Parse).
  app.register(slidesRoutes(services.slideConverter, guards));
  // AUFTRAG-mega34 B1: die Ask-Route liefert zusätzlich den kanonischen Evidenzzustand und braucht
  // dafür Bestand und Konflikte. Beide liegen hier ohnehin — dasselbe Muster wie livewallRoutes und
  // impactRoutes darunter.
  // KW-KA4: `klaraSessions` ist das bestehende Ausführungstor von oben — dieselbe Instanz, kein
  // zweiter Dienst. Ohne es verhielte sich die Ask-Route byteweise wie vor KA4 (fail-closed).
  app.register(
    askRoutes(
      { ask: services.ask, ko: services.ko, conflicts: services.conflicts, klaraSessions },
      guards,
    ),
  );
  // W3-C (KW-W3-18, JOB 541 D3): die EINE Erklaerroute. Sie bekommt denselben Belegspeicher wie
  // der Schreibweg und denselben Wissensbestand wie der Antwortweg — kein eigener Zugang, keine
  // zweite Aufloesung.
  app.register(
    klaraAnswerExplanationRoutes(
      {
        explanations: new AnswerExplanationService({
          answerSnapshots: services.answerSnapshots,
          ko: services.ko,
        }),
      },
      guards,
    ),
  );
  // SCRUM-527: Live-Check (Ähnlichkeit/Widerspruch eines Entwurfstextes gegen den Bestand).
  app.register(
    knowledgeCheckRoutes({
      ko: services.ko,
      conflicts: services.conflicts,
      reasoner: services.reasoner,
      guards,
    }),
  );
  // SCRUM-491 Slice 5: /api/check-text existiert NUR bei aktivem Add-on-Flag — sonst gar nicht
  // registriert → Endpunkt existiert nicht → bit-identisch zum heutigen Verhalten. Deterministische
  // Stufe-1-Dry-Run-Prüfung (validated-only, kein Modell, keine Persistenz).
  if (addonApiEnabled()) {
    app.register(
      checkTextRoutes(
        {
          ko: services.ko,
          overlaps: services.overlaps,
          conflicts: services.conflicts,
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
        // AUFTRAG-mega74 BLOCK D (G5): dieselbe Quelle wie Konflikte und Überschneidungen.
        kos: koSichtbarkeit,
      },
      guards,
    ),
  );
  // Audit-P4 (SCRUM-398): Live-Wall — read-only „frisch gesichert / hat heute geholfen".
  app.register(livewallRoutes({ ko: services.ko, audit: services.audit }, guards));
  // FUNKE F1 (nacht24 Paket 6): „Meine Wirkung" — persönliche Zähler aus eigenen KOs + Audits.
  app.register(impactRoutes({ ko: services.ko, audit: services.audit }, guards));
  app.register(auditRoutes(services.audit, guards));
  app.register(reasonerRoutes(services, guards));
  // Klara Stufe 2 (Pedi 05.07.): KI-gestuetzte Hilfe-Antwort aus Hilfe-Schnipseln (help-routes).
  app.register(helpRoutes({ reasoner: services.reasoner }, guards));
  // AUFTRAG-mega74 BLOCK C (G2): der Anhang-Lesepfad erfährt hier — und nur hier —, welche
  // Wissensobjekte einen Anhang tragen. `services/object-store` darf das nicht selbst wissen
  // (dieselbe Modulgrenze wie object-references.ts); die Kompositionswurzel reicht den Zugang.
  //
  // AUFTRAG-mega76 BLOCK B: dazu kommen die drei Herkünfte, die bis mega76 durchfielen —
  // Versions-Schnappschüsse, Belegketten und Entwürfe. Dieselbe Aufzählung wie in
  // object-references.ts, dort gegen Datenverlust, hier gegen Auskunft.
  app.register(
    objectRoutes(services.objects, guards, {
      kos: () => services.ko.list(),
      // AUFTRAG-mega78 BLOCK A: die Fassung reist MIT IHREM URHEBER. `v.author` ist die Person,
      // die diese Fassung geschrieben hat (serverseitig aus der Anmeldung) — `v.snapshot.author`
      // wäre der über Revisionen unveränderte Autor des Wissensobjekts und damit kein Nachweis.
      versionen: async (koId) =>
        (await services.ko.versionsOf(koId)).map((v) => ({ author: v.author, stand: v.snapshot })),
      // `EvidenceRecord.createdBy` reist mit — der Urheber-Nachweis der Belegkette.
      belege: (koId) => services.ko.evidenceOf(koId),
      entwuerfe: async () =>
        (await services.capture.listDrafts()).map((draft) => ({
          originalAuthor: draft.originalAuthor,
          lastEditor: draft.lastEditor,
          bodyHtml: draft.payload.bodyHtml,
          objectIds: [
            ...(draft.payload.pendingSources ?? []).map((src) => src.objectId),
            ...(draft.payload.anchorDocuments ?? []).map((doc) => doc.objectId),
          ],
        })),
    }),
  );
  app.register(mediaRoutes(services.media, guards));
  app.register(i18nRoutes(services.i18n));
  // AUFTRAG-mega46 Block F: die EINE Auskunft „welche Schalter stehen" — Ja/Nein je Schalter, sonst
  // nichts. Sie ist selbst NICHT geschaltet: Eine Auskunft, die man erst freischalten muss, könnte
  // die Oberfläche nie fragen. Angemeldete Nutzung genügt (Begründung in features-routes.ts).
  app.register(featuresRoutes(guards));
  // AUFTRAG-mega67 Block C/D: der ZUGANGS-ZUSTAND des Confluence-Imports, rein lesend. BEWUSST
  // ausserhalb des `confluenceImport`-Schalters registriert (anders als die Import-Routen unten):
  // eine Auskunft, die selbst hinter dem Schalter laege, koennte den Zustand „ausgeschaltet" nicht
  // melden — und genau der ist einer der vier Zustaende aus Block D.
  // JOB-924 D6: Die Route bekommt den Dienst, nicht die Ablage. Die Ablage geht AUSSCHLIESSLICH
  // hier hinein — das ist die einzige Stelle, an der beide zusammenkommen.
  app.register(
    importAccessRoutes(guards, new ImportAccessService({ importRuns: services.importRuns })),
  );
  app.register(adminRoutes(services, guards, opts.factoryReset)); // SCRUM-181: Demo-Seed; Pedi 05.07.: Werksreset
  // SCRUM-510 WP2: Admin-Trigger für den Confluence-Space-Import — NUR bei aktivem Import-Flag registriert
  // (Flag OFF → Route existiert nicht). Echte Admin-Auth; alles landet nur als Review-Kandidat.
  // AUFTRAG-mega46 Block F: Die Prüfung stand hier als dritte Kopie derselben Regel und kommt jetzt
  // aus dem Schalter-Registry — dieselbe Quelle, aus der GET /api/features antwortet.
  if (schalterAn("confluenceImport")) {
    app.register(
      confluenceImportRoutes({
        library: services.library,
        koService: services.ko,
        guards,
        // IC-3: Reasoner für die optionale Prompt→Kriterien-Ableitung der Auswahl-Vorschau.
        reasoner: services.reasoner,
        // W2-A/148: der echte Lauf bekommt seine Identität VOR dem ersten Effekt.
        importRuns: services.importRuns,
      }),
    );
    // W2-A/148: der Leseweg der Laufdomäne. Hinter demselben Schalter wie der Start — ein Lesepfad
    // auf Läufe, die es ohne den Schalter gar nicht geben kann, wäre eine Route ins Leere.
    app.register(
      importRunRoutes({
        importRuns: services.importRuns,
        externalSources: services.externalSources,
        guards,
      }),
    );
  }

  // AUFTRAG-mega45 Block D (Epic SCRUM-545, Stufe 1): „Warum weiss Klarwerk das?" — die
  // Herkunftskette EINES Objekts, rein lesend. VORGABE AUS: ohne KLARWERK_PROVENANCE_ENABLED wird
  // die Route gar nicht erst registriert (dasselbe Muster wie der Confluence-Import darüber), und
  // die Oberfläche rendert den Knopf ebenfalls nicht. „Wieder verstecken" ist damit ein Schalter,
  // kein Rückbau.
  if (provenanceEnabled()) {
    app.register(
      provenanceRoutes(
        { ko: services.ko, conflicts: services.conflicts, modelRuns: services.modelRuns },
        guards,
      ),
    );
  }

  // FR-ANA-02: Wirkungs-Dashboard (orchestriert KO-Bestand + Ask-Telemetrie aus dem Audit).
  app.get("/api/analytics/impact", async (request, reply) => {
    const user = await guards.requirePermission("ko.read", request, reply);
    if (!user) {
      return;
    }
    reply.code(200).send(
      await impactReport(services.ko, services.audit, {
        sichtbar: sichtbarkeitsfilterFuer(user),
      }),
    );
  });

  return app;
}

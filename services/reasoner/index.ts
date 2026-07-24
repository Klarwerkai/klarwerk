// Öffentliche API des Moduls reasoner.
export {
  Reasoner,
  DEFAULT_REASONER_POLICY,
  LOAD_FAILURE_FALLBACK_POLICY,
  isValidReasonerChoice,
  // SCRUM-525 P.5 (WP-C): eigener Fehlertyp für den Admin-Schreibpfad, wenn ein ENV-Override aktiv ist.
  ReasonerPolicyLockedError,
  // WP-BILD-1c: die eine Task-Liste + der Bild-Daten-Deckel des describe-Aufrufs (Route/Tests).
  REASONER_TASKS,
  MAX_DESCRIBE_IMAGE_DATAURL_CHARS,
  // WP-IC-4: harte Kappung der KI-Gruppierung (Route lehnt darueber ehrlich ab).
  MAX_GROUP_CANDIDATES,
} from "./src/service";
// WP-BILD-1f (bens P3): strikte, frühe Bild-Validierung der describe-Route (Format, strikte
// Base64, dekodierte Bytegrenze, Magic-Bytes-Abgleich) — komplett VOR jedem Provider-Aufruf.
export {
  MAX_DESCRIBE_IMAGE_BYTES,
  validateDescribeImageDataUrl,
  type DescribeImageRejection,
  type DescribeImageVerdict,
} from "./src/image-validation";
export {
  DeterministicProvider,
  keywordSelect,
  type ReasonerProvider,
  // SCRUM-360 / AG-03: begrenzte, status-/trust-bewusste Top-K-Kandidatenauswahl.
  DEFAULT_TOP_K,
  selectCandidates,
  rankCandidates,
  statusTrustBoost,
  type RankedCandidate,
  // SCRUM-361 / AG-03: Tokenisierung der Frage für den Repo-Prefilter (konsistent zum Ranking).
  queryTokens,
  // PMO-FEA-0006: ehrlicher Extract-Fallback (keine Fake-Punkte ohne Modell).
  honestExtractUnavailable,
  // WP-IC-4: ehrliche deterministische Themen-Gruppierung (Fallback + Tests).
  deterministicCandidateGroups,
} from "./src/provider";
export {
  ModelProvider,
  type ModelClient,
  // Berater-Konzept 04.07. (Stufe 2, kon-v1): DOM-freies, testbares Parsen des Konflikturteils.
  parseConflictResponse,
  // Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): testbares Parsen des Überschneidungs-Urteils.
  parseDuplicateResponse,
  // PMO-FEA-0006: DOM-freies Extract-Parsing inkl. G-2-Belegstellen-Gate (testbar).
  parseExtractResponse,
  excerptFoundInDocument,
  MAX_EXTRACT_POINTS,
  MAX_EXCERPT_LENGTH,
  MAX_EXTRACT_DOCUMENT_LENGTH,
  // WP-BILD-1c: harte Server-Obergrenze der Bildbeschreibungs-Vorschlagslänge.
  MAX_IMAGE_DESCRIPTION_LENGTH,
  // WP-BILD-1f: hartes Server-Budget für den mitgereichten Dokument-Kontext.
  MAX_IMAGE_CONTEXT_LENGTH,
  // WP-IC-4: strikte Validierung der Gruppierungs-Antwort (testbar, DOM-frei).
  normalizeCandidateGroups,
  catchAllGroupTitle,
  MAX_GROUP_TITLE_LENGTH,
} from "./src/provider-model";
// SCRUM-502 R8 (Encapsulation + Credential-Gating): nach außen NUR die GECAPPTEN Client-Factories.
// Die rohen Clients (anthropicClient/openAiCompatibleClient), ihre Config-Typen und die
// Credential-Resolver (resolveCloudApiKey/Keychain) werden BEWUSST NICHT re-exportiert — ein externer
// Aufrufer kann keinen ungecappten Client bauen und den Schlüssel nicht erreichen. Rohe Clients bleiben
// modul-intern (Tests greifen white-box relativ auf ./src/model-client zu).
export {
  createCappedCloudClientFromEnv,
  // SCRUM-424: eigener lokaler LLM (OpenAI-kompatibel, z. B. vLLM/Qwen) — gecappt, on-prem.
  createCappedLocalClientFromEnv,
  // D-AISTATE PAKET 1 (bens V1, aistate-fix3): technische On-Prem-Begrenzung der „lokalen" URL —
  // nur Loopback bzw. explizit freigegebene private Origins gelten als vertraulichkeits-tauglich.
  isConfirmedLocalOrigin,
} from "./src/model-client";
// WP-D10 (Fix 3): typisierte Modellfehler + Klassifizierung (timeout|http|network|parse) — nur
// Metadaten (Status/Dauer), keine Credentials, kein Prompt-/Antwortinhalt.
export {
  ModelHttpError,
  ModelTimeoutError,
  classifyModelFailure,
  type ModelFailureClass,
  type ModelFailureInfo,
} from "./src/model-errors";
// SCRUM-498 B2: prozess-globaler In-Flight-Cap für Modellaufrufe.
export {
  ModelCapacityError,
  ModelSemaphore,
  type ModelCapConfig,
  modelCapConfigFromEnv,
  cappedModelClient,
  withModelSlot,
  resetModelSemaphoreForTests,
} from "./src/model-concurrency";
// SCRUM-386: kundeneigene KI-Assist-Presets (Admin verwaltet; Palette zeigt sie allen Rollen).
export {
  ASSIST_PRESETS_SCHEMA,
  ASSIST_PRESET_INSTRUCTION_MAX,
  ASSIST_PRESET_NAME_MAX,
  type AssistPreset,
  type AssistPresetInput,
  type AssistPresetRepo,
  InMemoryAssistPresetRepo,
  MAX_ASSIST_PRESETS,
  normalizeAssistPresets,
  PgAssistPresetRepo,
} from "./src/presets";
// SCRUM-525 P.5 (WP6): persistente KI-Zuordnung (Policy) — überlebt Neustart/Deploy.
export {
  InMemoryReasonerPolicyRepo,
  PgReasonerPolicyRepo,
  REASONER_POLICY_SCHEMA,
  type ReasonerPolicyRepo,
} from "./src/reasoner-policy";
export type {
  KnowledgeRef,
  KnowledgeClass,
  ReasonerTaskChoice,
  ReasonerTaskConfig,
  ReasonerLocale,
  AnswerResult,
  AnswerStep,
  StructureResult,
  AssistResult,
  ConflictJudgeResult,
  ConflictJudgeOutcome,
  DuplicateJudgeResult,
  DuplicateJudgeOutcome,
  JudgeFailure,
  DuplicateAspect,
  ExtractResult,
  ExtractedPoint,
  EnrichResult,
  // WP-BILD-1c: KI-Bildbeschreibung als Vorschlag (text null + fallbackReason ohne Modell).
  DescribeImageResult,
  // WP-IC-4: KI-Gruppierung der Import-Kandidaten (mit ehrlichem Themen-Fallback).
  GroupCandidateInput,
  CandidateGroup,
  GroupCandidatesResult,
  ImportCriteriaResult,
  InterviewResult,
  ReasonerStatus,
  ReasonerConfigStatus,
  ReasonerConfigMode,
  ReasonerProbeResult,
  ReasonerTask,
  // SCRUM-525 P.5 (WP-C): Herkunft der aktiven Policy (env|db|default) — Teil von ReasonerConfigStatus.
  ReasonerPolicySource,
} from "./src/types";

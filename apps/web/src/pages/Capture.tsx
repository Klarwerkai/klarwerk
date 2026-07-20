import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  FileText,
  Globe,
  Loader2,
  Mic,
  Paperclip,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDirectory, useDrafts } from "../api/hooks";
import type {
  Confidentiality,
  Draft,
  DraftPayload,
  ExternalResult,
  ExtractedPoint,
  InterviewResult,
  KnowledgeObject,
  KnowledgeType,
  StructureResult,
} from "../api/types";
import { useSession } from "../app/AuthContext";
import { useNavGuard } from "../app/NavGuardContext";
import { useToast } from "../app/ToastContext";
import { AiAssistBox } from "../components/AiAssistBox";
import { AiModelInfo } from "../components/AiModelInfo";
// SCRUM-435: extrahierte Erkenntnis(se) an einen BESTEHENDEN Artikel anhängen (Artikel-Picker).
import { AppendToArticleModal } from "../components/AppendToArticleModal";
// SCRUM-405: „Aus Dokument ergänzen" — extract-Punkte anhängen (nichts ersetzen).
import { BodyExtractPanel } from "../components/BodyExtractPanel";
import { BodyTemplateChooser } from "../components/BodyTemplateChooser";
import { DemoBanner } from "../components/DemoBanner";
import { EditorAttachmentContext } from "../components/EditorAttachmentContext";
import { EditorContentQuality } from "../components/EditorContentQuality";
import { EditorGuidance } from "../components/EditorGuidance";
import { ExternalUrlText } from "../components/ExternalUrlText";
import { HelpTip } from "../components/HelpTip";
import { KnowledgeInputStudio } from "../components/KnowledgeInputStudio";
import { KnowledgeRescueIntro } from "../components/KnowledgeRescueIntro";
import { PublicAiEnrichPanel } from "../components/PublicAiEnrichPanel";
import { RichTextEditor } from "../components/RichTextEditor";
import { ListEditor, TagEditor } from "../components/editors";
import { KNOWLEDGE_TYPES, ReasonerDraft } from "../components/trust";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import { GAP_RESCUE_STEPS, GAP_RESCUE_TEXT } from "../lib/askGapRescue";
import { applyBodyAssist, applyBodyAssistBlock, bodyTextForAssist } from "../lib/bodyAiAssist";
import { appendExtractSections, normalizeExtractLocale } from "../lib/bodyExtract";
import { fileLinkHtml } from "../lib/bodyFileLink";
import { ADVANCED_FIELDS_KEYS, advancedFieldsSummary } from "../lib/captureAdvancedFields";
import {
  ATTACHMENT_RECOVERY_KEYS,
  type AttachmentFailure,
  type AttachmentUploadApi,
  type AttachmentUploadItem,
  type OriginalDocument,
  type OriginalRefCache,
  capAttachmentSelection,
  classifyUploadError,
  estimateDataUrlBytes,
  finalizeCaptureSubmit,
} from "../lib/captureAttachments";
import { applyDraftArticle, normalizeDraftArticleLocale } from "../lib/captureDraftArticle";
import {
  CAPTURE_ENTRY_TEXT,
  type CaptureMode,
  EXPERT_MODE,
  NARRATE_MODES,
  initialCaptureWorkspaceOpen,
  isCaptureFirstRun,
  isExpertMode,
  markCaptureIntroSeen,
} from "../lib/captureEntry";
import { CAPTURE_EXAMPLE } from "../lib/captureExample";
import { CAPTURE_FLOW_TEXT } from "../lib/captureFlowGuide";
// PMO-FEA-0006: „Aus Datei" — Punkteliste + Entwurfs-Warteschlange (DOM-freie Logik).
import {
  CAPTURE_FILE_TEXT,
  DraftPayloadTooLargeError,
  FILE_CAPTURE_ACCEPT,
  FILE_IMPORT_ACCEPT,
  type FileDraftQueue,
  type FileImportMode,
  type SelectableExtractPoint,
  type WholeDocumentSourceKind,
  advanceFileQueue,
  buildFileQueue,
  currentQueuePoint,
  draftFromPoint,
  draftPayloadWithinLimit,
  fileSourcePayload,
  importImageNotice,
  mergeSelectedIntoOne,
  queueProgress,
  selectablePoints,
  selectedCount,
  setAllSelected,
  togglePoint,
  wholeDocumentDraftPayload,
  wholeDraftFitsWithObjectLink,
} from "../lib/captureFromFile";
import { gapContextDraft, readGapContext } from "../lib/captureFromGap";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../lib/captureFrontDoor";
// SCRUM-407: zentrale ?-Hilfen-Karte des Erfassen-Wegs (chelp.*) — Gegenstück zu lib/reviewHelp.
import { type CaptureHelpId, captureHelp } from "../lib/captureHelp";
import { captureReadiness } from "../lib/captureReadiness";
import { originForSave, resumeTargetForDraft } from "../lib/captureResume";
// SCRUM-408: externe Quellen schon beim Erfassen — Warteliste + add-source beim Einreichen.
import {
  type PendingSource,
  addPendingSource,
  attachPendingSources,
  canAttachCaptureSources,
  pendingFromForm,
  pendingFromResult,
  removePendingSource,
} from "../lib/captureSources";
import { captureNextSteps, captureSavedStatus } from "../lib/captureSuccess";
import {
  CAPTURE_WIZARD_TEXT,
  type CaptureWizardStep,
  resolveWizardStep,
  wizardChips,
} from "../lib/captureWizard";
import { CONFIDENTIALITY_LEVELS } from "../lib/confidentiality";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
import { draftTitle } from "../lib/draftForm";
import { studioSaveConfidence } from "../lib/editorApplySafety";
import { EDITOR_BLOCKS } from "../lib/editorBlocks";
import { editorImagesFromLocalImages } from "../lib/editorImages";
// WP-D5b (bens GELB-Fix 4): Erkennung im Capture-Import-Pfad über die ZENTRALE detectFileKind-Reihenfolge
// (image→pdf→docx→pptx→text) — sonst landet eine .pptx mit MIME text/plain im Text-Pfad.
import { detectFileKind } from "../lib/extract";
// SCRUM-409 (PMO-FEA-0008-Delta): Mehrpunkt-Entwürfe + Zusammenführen im „Aus Datei"-Weg.
import { createPointDrafts } from "../lib/fileMultiPoint";
import {
  fileToThumbDataUrl,
  isImage,
  isPdfDocument,
  isTextDocument,
  isWordDocument,
  readDocxFile,
  readDocxRich,
  readFileAsDataUrl,
  readPdfFile,
  readPptxRich,
  readTextFile,
  runImageOcr,
} from "../lib/files";
import { appendAnswer, interviewSourceKey, isInterviewDone } from "../lib/interviewFlow";
import { EMPTY_SOURCE_FORM, type SourceFormInput, isSourceFormValid } from "../lib/koSource";
// WP-D5b (bens GELB-Fix 3): ehrlicher Importfehler bei Überschreitung des Archiv-/Dekompressionsbudgets.
import { PptxTooLargeError } from "../lib/pptx";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { documentProvenance, draftProvenance } from "../lib/reasonerProvenance";
import { hasSpeechRecognition } from "../lib/speechSupport";

type Mode = CaptureMode;

const EMPTY_DRAFT: StructureResult = {
  title: "",
  statement: "",
  conditions: [],
  measures: [],
  tags: [],
  confidence: 0,
  demo: false,
};

interface LocalImage {
  id: string;
  name: string;
  mime: string;
  dataUrl: string; // kleine Vorschau (Thumbnail)
  original: string; // Original-Daten-URL (→ Object-Store)
}

// Web-Speech-API (Diktat) — minimale Typen statt any.
interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
type SpeechCtor = new () => SpeechRec;
function speechCtor(): SpeechCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const textareaCls =
  "w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none placeholder:text-muted-2 focus:border-ink/30";

// WP-D7b (Rot-Fix 1): schlanke Dev-Instrumentierung — je Submit-Phase eine performance.now-Spanne als
// debug-Log (im Browser standardmäßig gefiltert, kein Produktionslärm), damit Pedi/wir die ECHTEN Zeiten
// sehen und den Kostentreiber (Object-Uploads) belegen können.
function logSubmitPhase(phase: string, startMs: number): void {
  // eslint-disable-next-line no-console -- bewusstes Diagnose-Log, nur console.debug.
  console.debug(`[KW-SUBMIT] ${phase}: ${Math.round(performance.now() - startMs)}ms`);
}

interface FrontDoorDraftSavedState {
  id: string;
  title: string;
}

interface FileWholeDraftSavedState {
  id: string | null;
  title: string;
  fileName: string;
}

function frontDoorDraftSavedFromState(state: unknown): FrontDoorDraftSavedState | null {
  const value = state as { frontDoorDraftSaved?: { id?: unknown; title?: unknown } } | null;
  const draft = value?.frontDoorDraftSaved;
  if (typeof draft?.id !== "string") {
    return null;
  }
  return {
    id: draft.id,
    title: typeof draft.title === "string" && draft.title.trim() ? draft.title : "Entwurf",
  };
}

function formatDraftTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "unbekannt";
  }
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function draftAuthorName(draft: Draft, directory: readonly { id: string; name: string }[]): string {
  return directory.find((entry) => entry.id === draft.originalAuthor)?.name ?? draft.originalAuthor;
}

export function Capture(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const { push } = useToast();
  const authorName = user?.name ?? user?.email ?? "—";
  const draftScopeLabel =
    user?.role === "admin" ? "Admin-Ansicht: alle Entwuerfe" : "Meine Entwuerfe";
  const navigate = useNavigate();
  const location = useLocation();

  // SCRUM-263: optionaler Startkontext aus einer offenen Wissenslücke (?gap=…) — nur Anstoß für
  // die Rohnotiz, kein automatisches KO. Der Mensch ergänzt die Erfahrung, die KI strukturiert nur.
  const [params] = useSearchParams();
  const gapContext = readGapContext(params);

  const [mode, setMode] = useState<Mode>("freitext");
  // SCRUM-384 / KG-UX-001/002: Erstnutzer-Führung pro Browser — beim Erstbesuch ist die geführte
  // Einführung ausgeklappt, danach eingeklappt (jederzeit wieder aufklappbar; nichts entfernt).
  const [firstRun] = useState(() => isCaptureFirstRun(window.localStorage));
  useEffect(() => {
    markCaptureIntroSeen(window.localStorage);
  }, []);
  // SCRUM-270: Gap-Frage als OFFENE-Frage-Vorlage übernehmen (kein fertiges Wissen); ohne Gap leer.
  const [raw, setRaw] = useState(() =>
    gapContext
      ? gapContextDraft(gapContext, {
          question: t("capture.gapDraftQuestion"),
          experience: t("capture.gapDraftExperience"),
        })
      : "",
  );
  const [draft, setDraft] = useState<StructureResult | null>(null);
  // SCRUM-384 (Pedi-Review): Wizard-Schritt — EIN Fokus je Schritt; Expertenmodus bleibt
  // außerhalb des Wizards (klassische Zwei-Spalten-Ansicht, bewusst gewählt).
  const [wizStepRaw, setWizStep] = useState<CaptureWizardStep>("tell");
  const [showCondMeasures, setShowCondMeasures] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmTellReset, setConfirmTellReset] = useState(false);
  const [showHelpers, setShowHelpers] = useState(false);
  // KW-STR / SCRUM-45/46/48: WYSIWYG-Body (sanitisiertes HTML), separat vom Reasoner-Draft.
  const [bodyHtml, setBodyHtml] = useState("");
  // SCRUM-337: großer Knowledge-Studio-Arbeitsraum (Overlay) auf demselben bodyHtml-State.
  const [studioOpen, setStudioOpen] = useState(false);
  // SCRUM-339: kurzes, ehrliches Feedback nach Übernahme aus dem Studio (kein Auto-Save).
  const [studioApplied, setStudioApplied] = useState(false);
  // SCRUM-375 / AG-12: erweiterte/technische Felder (Metadaten, Dokumente, Bilder) sind Progressive
  // Disclosure — standardmäßig eingeklappt, damit „Wissen erzählen → im Studio strukturieren" führt.
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Metadaten (vorab erfassbar, FR-CAP-08)
  const [type, setType] = useState<KnowledgeType>("best_practice");
  const [category, setCategory] = useState("");
  const [asset, setAsset] = useState("");
  // SCRUM-415: Vertraulichkeitsstufe ab Erfassen (Standard „intern"). Vertrauliche KOs gehen nie in
  // externe Kontexte (Output/Export).
  const [confidentiality, setConfidentiality] = useState<Confidentiality>("intern");
  const [neededValidations, setNeededValidations] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  // SCRUM-395: optionaler Prüfer-Vorschlag beim Einreichen (Server: assign + Benachrichtigung).
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const directory = useDirectory();
  // SCRUM-395: Standard-Prüferanzahl (Admin-Einstellung) — nur Anzeige/Platzhalter;
  // leer lassen heißt: der Standard gilt.
  const valSettings = useQuery({
    queryKey: ["validation", "settings"],
    queryFn: endpoints.validation.settings,
  });
  const defaultNeeded = valSettings.data?.defaultNeededValidations ?? 3;
  // SCRUM-414: Admin-Regler „externe Wissensabfrage" — blendet die externe Quellensuche aus,
  // wenn der Admin sie komplett blockiert hat (der Server sperrt zusätzlich).
  const extPolicy = useQuery({
    queryKey: ["external", "policy"],
    queryFn: endpoints.external.policy,
  });
  const extPolicyStage = extPolicy.data?.stage ?? "search_on_click";
  // SCRUM-421: geltende Upload-Grenzen (Anzeige beim Erfassen); Fallback = Werksvorgabe.
  const uploadLimitsQ = useQuery({
    queryKey: ["upload-limits"],
    queryFn: endpoints.uploadLimits.get,
  });
  // WP-D2: Fallback spiegelt DEFAULT_UPLOAD_LIMITS (Server) — dokumententauglich 20 MB je Anhang.
  const uploadLimitsData = uploadLimitsQ.data ?? {
    maxAttachments: 8,
    maxAttachmentBytes: 20_000_000,
  };
  const reviewerChoices = (directory.data ?? []).filter((p) => p.id !== user?.id);
  const toggleReviewer = (id: string): void => {
    setReviewerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Anhänge (FR-CAP-05/06)
  const [images, setImages] = useState<LocalImage[]>([]);
  // SCRUM-373 / AG-02-SESSION: Nicht-Bild-Session-Dateien behalten jetzt ihre Originalbytes (data), damit
  // sie beim Speichern in den Object-Store gelegt und danach im KO-Editor als sichere Body-Referenz nutzbar
  // sind. Der extrahierte Text geht weiterhin als Kontext in die Rohnotiz.
  const [docs, setDocs] = useState<{ id: string; name: string; mime: string; data: string }[]>([]);

  // SCRUM-408: Quellen-Warteliste beim Erfassen (angehängt wird erst beim Einreichen) +
  // dasselbe Formular/Such-Muster wie im Prüfbereich (SCRUM-118/129, eine Regel-Quelle).
  const [pendingSources, setPendingSources] = useState<PendingSource[]>([]);
  const [sourceForm, setSourceForm] = useState<SourceFormInput>({ ...EMPTY_SOURCE_FORM });
  const [extQuery, setExtQuery] = useState("");
  const [extResults, setExtResults] = useState<ExternalResult[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [frontDoorDraftSaved, setFrontDoorDraftSaved] = useState<FrontDoorDraftSavedState | null>(
    () => frontDoorDraftSavedFromState(location.state),
  );
  // SCRUM-276: nach erfolgreichem Einreichen die ID des gespeicherten KO (für die Success-Card).
  const [savedKoId, setSavedKoId] = useState<string | null>(null);
  // WP-D7b (Rot-Fix 1): mehrstufiger, ehrlicher Fortschritt beim Einreichen — der Nutzer sieht, WAS gerade
  // dauert (KO anlegen → Original/Anhänge sichern (mit Größe) → Quellen verknüpfen). null = kein Submit aktiv.
  const [submitStage, setSubmitStage] = useState<{ key: string; mb?: string } | null>(null);
  // SCRUM-354: ob das eingereichte KO aus einem fortgesetzten Entwurf promotet wurde (Success-Copy).
  const [submittedFromDraft, setSubmittedFromDraft] = useState(false);
  // SCRUM-369: ob dieser Save aus einem Ask-Lücken-Kontext (?gap=…) kam → ehrlicher Rescue-Anschluss.
  const [savedFromGap, setSavedFromGap] = useState(false);
  // SCRUM-373: Anzahl der beim Speichern in den Object-Store gelegten Anhänge (Bilder + Dateien) — für den
  // ehrlichen Anschluss „jetzt als sichere Objekt-Referenz im KO-Editor verlinkbar".
  const [savedFilesCount, setSavedFilesCount] = useState(0);
  // SCRUM-374: Anhänge, die trotz gespeichertem KO NICHT hochgeladen/angehängt werden konnten (Teilfehler).
  const [failedAttachments, setFailedAttachments] = useState<AttachmentFailure[]>([]);
  // SCRUM-123: laufende Bild-OCR (für ehrlichen Status / Button-Sperre).
  const [ocrBusy, setOcrBusy] = useState<string | null>(null);
  // SCRUM-382: laufende Video-/Audio-Transkription (Objekt-ID der Session-Datei).
  const [videoBusy, setVideoBusy] = useState<string | null>(null);
  // SCRUM-113 / FE-CAP-07: aktuell fortgesetzter Entwurf (null = neuer Entwurf).
  const [draftId, setDraftId] = useState<string | null>(null);
  // Bugfix (Pedi 04.07.): Inline-Bestätigung vor dem Löschen eines Entwurfs (null = keine offen).
  const [confirmDiscardDraftId, setConfirmDiscardDraftId] = useState<string | null>(null);
  const qc = useQueryClient();
  const drafts = useDrafts();
  const [draftsOpen, setDraftsOpen] = useState(false);
  // SCRUM-458: Der Erfassungs-Arbeitsraum startet EINGEKLAPPT (ruhiger Aufklapp-Einstieg statt vollem
  // Formular). Defensiv aufgeklappt, wenn schon ein aktiver Kontext vorliegt (Lücken-Kontext ?gap= oder
  // vorbefüllter Rohtext aus Deep-Link/Entwurf), damit dieser nie verdeckt startet.
  const [captureWorkspaceOpen, setCaptureWorkspaceOpen] = useState(() =>
    initialCaptureWorkspaceOpen({
      hasGapContext: gapContext !== null,
      hasPrefilledRaw: raw.trim().length > 0,
    }),
  );
  const workAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = frontDoorDraftSavedFromState(location.state);
    if (!saved) {
      return;
    }
    setFrontDoorDraftSaved(saved);
    setNotice(`Entwurf gespeichert: ${saved.title}`);
    void qc.invalidateQueries({ queryKey: ["drafts"] });
    navigate("/erfassen", { replace: true, state: null });
  }, [location.state, navigate, qc]);

  // Diktat
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  // SCRUM-236: ehrliche, DOM-freie Feature-Detection statt inline-window-Zugriff.
  const speechSupported = hasSpeechRecognition(window);
  // SCRUM-403: Diktat auch für die Interview-Antwort (eigener Rekorder, gleiches Muster).
  const [ivListening, setIvListening] = useState(false);
  const ivRecRef = useRef<SpeechRec | null>(null);
  // SCRUM-403: Interview-Frage vorlesen (SpeechSynthesis) — nur auf Klick, kein Auto-Play.
  const [ivReading, setIvReading] = useState(false);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // SCRUM-132: reasoner-getriebenes Interview (stateless; Antworten → nächste Frage).
  const [ivAnswers, setIvAnswers] = useState<string[]>([]);
  const [ivAnswer, setIvAnswer] = useState("");
  const [ivResult, setIvResult] = useState<InterviewResult | null>(null);

  // PMO-FEA-0006: „Aus Datei" — Dokumenttext, optionaler Suchauftrag, KI-Punkteliste,
  // sichtbare Entwurfs-Warteschlange. Nichts wird automatisch gespeichert.
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState("");
  // WP-D1/WP-D4: strukturerhaltendes DOCX-HTML (für den Ganzdokument-Modus) + Formatkennung für die
  // ehrliche Import-Quittung. null = keine Datei bzw. reiner Textpfad ohne Rich-Anteil.
  const [fileRich, setFileRich] = useState<{
    html: string | null;
    kind: WholeDocumentSourceKind;
  } | null>(null);
  // WP-D2 („Original ist heilig"): die Quelldatei selbst — geht beim Speichern/Übernehmen als Anhang
  // in den Object-Store. Der Ref-Cache stellt sicher, dass die Punkte-Queue (mehrere KOs) das Original
  // nur EINMAL hochlädt und danach dieselbe objectId referenziert.
  const [fileOriginal, setFileOriginal] = useState<OriginalDocument | null>(null);
  const fileOriginalRef = useRef<OriginalRefCache>({ ref: null });
  // WP-D1d: Bild-Bilanz des DOCX-Imports mit EXPLIZITEN Zählern (gesamt / tatsächlich komprimiert / als
  // Notbremse weggelassen). Beim Lesen gesetzt und ERST beim Speichern — gekoppelt an den ECHTEN
  // Anhang-Erfolg — ehrlich gemeldet (nur dann „Original im Anhang", wenn der Upload wirklich gelang).
  const [fileImageInfo, setFileImageInfo] = useState<{
    total: number;
    compressed: number;
    dropped: number;
    // WP-D1e (bens Fix 3): das strukturerhaltende bodyHtml sprengte schon beim Lesen das Bild-Budget
    // (docx.htmlOverflow). Dieses Signal wird beim Speichern ausgewertet — ehrlicher Abbruch VOR dem
    // Upload, statt es (wie bisher) ungenutzt verpuffen zu lassen.
    htmlOverflow: boolean;
  } | null>(null);
  const [fileImageUrl, setFileImageUrl] = useState<string | null>(null); // OCR-Kandidat (nur auf Klick)
  const [fileBusy, setFileBusy] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [fileImportMode, setFileImportMode] = useState<FileImportMode>("points");
  const [fileWholeDraftSaved, setFileWholeDraftSaved] = useState<FileWholeDraftSavedState | null>(
    null,
  );
  // SCRUM-451 (Pedi 05.07.): Ergebnis-Sprache der Extraktion — Systemsprache (Default) oder
  // Originalsprache des Dokuments (nichts übersetzen; Belegstellen sind ohnehin wörtlich).
  const [fileLang, setFileLang] = useState<"system" | "source">("system");
  const [filePoints, setFilePoints] = useState<SelectableExtractPoint[] | null>(null);
  // SCRUM-435: ausgewählte Erkenntnis(se) für den „an bestehenden Artikel anhängen"-Picker.
  const [appendPts, setAppendPts] = useState<{ points: ExtractedPoint[]; fileName: string } | null>(
    null,
  );
  // Pedi 04.07.: Beim „Entwürfe speichern" mit nicht ausgewählten Punkten fragen, ob diese gelöscht
  // werden sollen; die Entscheidung reist über purgeUnselectedRef in den onSuccess der Mutation.
  const [confirmSaveDrafts, setConfirmSaveDrafts] = useState(false);
  const purgeUnselectedRef = useRef(false);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [fileQueue, setFileQueue] = useState<FileDraftQueue | null>(null);

  const fail = (e: unknown): void => setErr(e instanceof ApiError ? e.message : t("state.error"));

  // FR-I18N-01: Reasoner-Aufrufe folgen der aktuellen UI-Sprache (Quelleninhalt bleibt original).
  const locale = toReasonerLocale(i18n.language);

  const structure = useMutation({
    // SCRUM-502 Schicht 2: die Draft-Vertraulichkeit mitsenden → vertrauliche Drafts nutzen nie die Cloud.
    mutationFn: () => endpoints.reasoner.structure(raw, locale, draftProvenance(confidentiality)),
    onSuccess: (r) => {
      setDraft(r);
      setTags((prev) => (prev.length > 0 ? prev : r.tags));
      setErr(null);
      // SCRUM-384: direkt zur Wissensseite — Artikel-Vorschlag einmalig erzeugen
      // (leerer Body ⇒ setzen; vorhandener Inhalt wird NIE still überschrieben).
      setBodyHtml((prev) =>
        prev.trim() ? prev : applyDraftArticle(prev, r, normalizeDraftArticleLocale(i18n.language)),
      );
      setWizStep("refine");
    },
    onError: fail,
  });

  // SCRUM-132: ein Interview-Turn — Antworten rein, nächste Frage + Draft raus.
  const interview = useMutation({
    mutationFn: (answers: string[]) =>
      endpoints.reasoner.interview(answers, locale, draftProvenance(confidentiality)),
    onSuccess: (res) => {
      setIvResult(res);
      setErr(null);
      if (isInterviewDone(res)) {
        setDraft(res.draft);
        setTags((prev) => (prev.length > 0 ? prev : res.draft.tags));
        // SCRUM-384: Interview fertig → gleiche Wissensseiten-Führung wie beim Freitext.
        setBodyHtml((prev) =>
          prev.trim()
            ? prev
            : applyDraftArticle(prev, res.draft, normalizeDraftArticleLocale(i18n.language)),
        );
        setWizStep("refine");
      }
    },
    onError: fail,
  });

  // SCRUM-312: KI-Nachbearbeitung über die sichtbare AiAssistBox (Vorschau + bewusste Übernahme);
  // die frühere stille Direkt-Mutation (setRaw/setDraft) wurde durch den Vorschau-Flow ersetzt.
  const runAssist = (input: string, instruction?: string): Promise<string> =>
    endpoints.reasoner
      .assist(input, locale, instruction, draftProvenance(confidentiality))
      .then((r) => r.text);

  // PMO-FEA-0006: Wissenssuche im Dokument — Ergebnis ist die Punkteliste ODER (ohne Modell)
  // eine ehrliche note ohne Fake-Punkte. Die note kommt lokalisiert vom Server.
  // SCRUM-408: externe Quellensuche über den vorhandenen Server-Proxy (SCRUM-118 / FR-EXT-02).
  const extSearch = useMutation({
    mutationFn: (q: string) => endpoints.external.search(q),
    onSuccess: (r) => {
      setExtResults(r);
      setErr(null);
    },
    onError: fail,
  });

  const extract = useMutation({
    mutationFn: () =>
      endpoints.reasoner.extract(
        fileText,
        locale,
        fileQuery,
        fileLang,
        documentProvenance(confidentiality),
      ),
    onSuccess: (r) => {
      setErr(null);
      setNotice(null);
      setFilePoints(selectablePoints(r.points));
      setFileNote(r.note);
    },
    onError: fail,
  });

  // PMO-FEA-0006: einen Warteschlangen-Punkt als Wissensseiten-Entwurf in den Wizard laden.
  // Bedingungen/Maßnahmen bleiben leer (stehen nicht belegt im Punkt — nichts erfinden, G-2).
  const loadQueuePoint = (queue: FileDraftQueue): void => {
    const point = currentQueuePoint(queue);
    if (!point) {
      return;
    }
    const d = draftFromPoint(point, false);
    setDraft(d);
    setBodyHtml(applyDraftArticle("", d, normalizeDraftArticleLocale(i18n.language)));
    setStudioApplied(false);
    setNotice(t(CAPTURE_FILE_TEXT.sourceNote, { name: queue.fileName }));
    setWizStep("refine");
  };

  // PMO-FEA-0006: „Ausgewählte übernehmen" — sichtbare Warteschlange starten, ersten Punkt laden.
  const applySelectedPoints = (): void => {
    if (!filePoints || !fileName) {
      return;
    }
    const queue = buildFileQueue(filePoints, fileName);
    if (!queue) {
      return;
    }
    setFileQueue(queue);
    loadQueuePoint(queue);
  };

  // SCRUM-409: mehrere bestätigte Punkte als SEPARATE Entwürfe in den bestehenden Pool
  // (FE-CAP-07) — je Entwurf mit sichtbarem Quellenvermerk im Body. Teilfehler werden
  // ehrlich gemeldet; bereits angelegte Entwürfe bleiben in der „Fortsetzen"-Liste sichtbar.
  const filePointDrafts = useMutation({
    mutationFn: (input: {
      points: { title: string; summary: string; sourceExcerpt: string }[];
      fileName: string;
    }) =>
      createPointDrafts(input.points, input.fileName, normalizeExtractLocale(i18n.language), (p) =>
        endpoints.drafts.create(p),
      ),
    onSuccess: (result, input) => {
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      if (result.failed.length > 0) {
        setErr(t(CAPTURE_FILE_TEXT.draftsPartial, { failed: result.failed.join(", ") }));
      } else {
        setErr(null);
      }
      if (result.created > 0) {
        setNotice(
          t(CAPTURE_FILE_TEXT.draftsSaved, { count: result.created, name: input.fileName }),
        );
        push(
          "success",
          t(CAPTURE_FILE_TEXT.draftsSaved, { count: result.created, name: input.fileName }),
        );
        // Pedi 04.07.: gespeicherte (ausgewählte) Punkte verlassen die Liste. Nicht ausgewählte
        // bleiben — außer der Nutzer hat ihr Löschen bestätigt (purgeUnselectedRef).
        const rest = purgeUnselectedRef.current
          ? []
          : (filePoints ?? []).filter((p) => !p.selected);
        if (rest.length > 0) {
          setFilePoints(rest);
        } else {
          setFilePoints(null);
          setFileName(null);
          setFileText("");
          setFileRich(null);
          setFileOriginal(null);
          fileOriginalRef.current = { ref: null };
          setFileQuery("");
        }
      }
    },
    onError: fail,
  });

  // KW-W2-01: bewusstes Ganzdokument-MVP. Dieser Weg erzeugt genau EINEN Entwurf über die
  // bestehende Draft-Route; kein KO, keine Validierung, keine KI-Strukturierung.
  const fileWholeDraft = useMutation({
    // WP-D1/WP-D4: bei DOCX reist das strukturerhaltende HTML mit (Server sanitisiert autoritativ);
    // sourceKind steuert den ehrlichen Format-Hinweis im Quelle-Blockquote.
    // WP-D2 („Original ist heilig"): die Quelldatei wandert VOR dem Entwurf in den Object-Store und
    // reist als sichere Body-Datei-Referenz (fileLinkHtml) im Entwurf mit — sie überlebt so auch den
    // späteren Promote zum KO. Scheitert der Upload, bleibt der Text-Import erhalten; der Grund
    // (zu groß vs. Upload-Fehler) wird ehrlich gemeldet.
    mutationFn: async (input: {
      fileName: string;
      text: string;
      html?: string;
      sourceKind?: WholeDocumentSourceKind;
    }): Promise<{
      draft: Draft;
      originalFailure: AttachmentFailure | null;
      originalAttached: boolean;
    }> => {
      let payload = wholeDocumentDraftPayload({ ...input, locale: i18n.language });
      let originalFailure: AttachmentFailure | null = null;
      // WP-D1d (Fix 4): originalAttached ist NUR true, wenn der Upload WIRKLICH gelang — nicht schon,
      // wenn es keinen Fehler gab (ohne Original bleibt es false). Beweis = erhaltene objectId.
      let originalAttached = false;
      // WP-D1e (bens Fix 3): htmlOverflow VERDRAHTEN. Sprengte das strukturerhaltende bodyHtml schon beim
      // Lesen das Bild-Budget (docx.htmlOverflow), ist das Dokument zu groß für den Inline-Import — der
      // Aufrufer verweigert JETZT ehrlich (statt das Signal ungenutzt zu lassen und ein zu großes bodyHtml
      // erst am finalen JSON-Guard auffliegen zu lassen). Der finale Guard bleibt zusätzlich als Autorität.
      if (fileImageInfo?.htmlOverflow) {
        throw new DraftPayloadTooLargeError();
      }
      // WP-D1e (bens Fix 2): Größen-PREFLIGHT VOR dem Upload. Der Object-Upload legt das Original
      // UNWIDERRUFLICH im Store ab; liefe er vor der Größenprüfung, entstünde bei Überlauf ein verwaistes
      // Object (kein Entwurf referenziert es) und ein Retry lüde erneut hoch. Wir messen den Payload MIT
      // einem reservierten Object-Link (großzügige Id-Reserve) — passt er schon so nicht, brechen wir ab,
      // BEVOR irgendetwas hochgeladen wird.
      if (fileOriginal && !wholeDraftFitsWithObjectLink(payload, fileOriginal.name)) {
        throw new DraftPayloadTooLargeError();
      }
      if (fileOriginal) {
        try {
          // WP-D1e (bens Fix 2): Ref-Cache-Reuse — ein Retry (z. B. nach transientem drafts.create-Fehler)
          // referenziert dieselbe objectId, statt das Original ein zweites Mal hochzuladen (kein Doppel-Upload).
          let ref = fileOriginalRef.current.ref;
          if (!ref) {
            ref = await endpoints.objects.upload({
              name: fileOriginal.name,
              mime: fileOriginal.mime,
              data: fileOriginal.data,
              kind: "document",
            });
            fileOriginalRef.current = { ref };
          }
          originalAttached = true;
          payload = {
            ...payload,
            bodyHtml: `${payload.bodyHtml ?? ""}${fileLinkHtml({
              objectId: ref.id,
              name: fileOriginal.name,
            })}`,
          };
        } catch (error) {
          originalFailure = { name: fileOriginal.name, reason: classifyUploadError(error) };
        }
      }
      // WP-D1d (Fix 2)/WP-D1e: finaler Guard nach dem realen Link-Anhängen — zweite Sicherheit. Prüft den
      // FINALEN, serialisierten Payload in ECHTEN UTF-8-Bytes gegen die Client-Grenze (unter dem
      // Server-Ceiling) — statt eines stillen 413 ein ehrlicher Abbruch.
      if (!draftPayloadWithinLimit(payload)) {
        throw new DraftPayloadTooLargeError();
      }
      return { draft: await endpoints.drafts.create(payload), originalFailure, originalAttached };
    },
    onSuccess: ({ draft, originalFailure, originalAttached }, input) => {
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      setErr(null);
      const savedDraftId =
        typeof draft.id === "string" && draft.id.trim().length > 0 ? draft.id : null;
      setFilePoints(null);
      setFileNote(null);
      setFileQueue(null);
      setFileWholeDraftSaved({
        id: savedDraftId,
        title: draftTitle(draft, input.fileName),
        fileName: input.fileName,
      });
      setFileName(null);
      setFileText("");
      setFileRich(null);
      const imageInfo = fileImageInfo;
      setFileImageInfo(null);
      setFileOriginal(null);
      fileOriginalRef.current = { ref: null };
      setFileQuery("");
      const savedNote = t(CAPTURE_FILE_TEXT.wholeSaved, { name: input.fileName });
      // WP-D1d (Fix 4): ehrliche Bild-Meldung mit EXPLIZITEN Zählern über die pure importImageNotice —
      // „Original im Anhang" NUR bei originalAttached === true (echter Upload-Erfolg, nicht bloß „kein
      // Fehler"); weggelassene Bilder ohne gesichertes Original werden als VERLOREN benannt.
      const notice = imageInfo
        ? importImageNotice({
            total: imageInfo.total,
            compressed: imageInfo.compressed,
            dropped: imageInfo.dropped,
            originalAttached,
          })
        : null;
      const imageNote = notice ? ` ${t(notice.key, notice.params)}` : "";
      setNotice(`${savedNote}${imageNote}`);
      push("success", savedNote);
      if (!savedDraftId) {
        setErr(t(CAPTURE_FILE_TEXT.wholeOpenMissing));
        push("error", t(CAPTURE_FILE_TEXT.wholeOpenMissing));
      }
      // WP-D2: der Text-Import ist gesichert, aber das ORIGINAL nicht — ehrlich und mit Grund melden
      // („zu groß" gesondert), statt den Import wie eine Voll-Übernahme aussehen zu lassen.
      if (originalFailure) {
        const key =
          originalFailure.reason === "too-large"
            ? "capture.attachTooLarge"
            : "capture.originalAttachFailed";
        setErr(t(key, { name: originalFailure.name }));
        push("error", t(key, { name: originalFailure.name }));
      }
    },
    // WP-D1d (Fix 2): der Client-Payload-Guard wirft DraftPayloadTooLargeError → ehrliche, spezifische
    // Meldung statt eines stillen 413 (oder der generischen Fehlermeldung).
    onError: (error: unknown) => {
      if (error instanceof DraftPayloadTooLargeError) {
        setErr(t(CAPTURE_FILE_TEXT.tooLargeForImport));
        push("error", t(CAPTURE_FILE_TEXT.tooLargeForImport));
        return;
      }
      fail(error);
    },
  });

  // Pedi 04.07.: eigentliches Speichern; purgeUnselected bestimmt, ob nicht ausgewählte Punkte
  // nach dem Speichern gelöscht werden (siehe onSuccess der Mutation).
  const doSaveDrafts = (purgeUnselected: boolean): void => {
    setConfirmSaveDrafts(false);
    if (!filePoints || !fileName) {
      return;
    }
    const chosen = filePoints
      .filter((p) => p.selected)
      .map(({ title, summary, sourceExcerpt }) => ({ title, summary, sourceExcerpt }));
    if (chosen.length < 2) {
      return;
    }
    purgeUnselectedRef.current = purgeUnselected;
    filePointDrafts.mutate({ points: chosen, fileName });
  };

  // Gibt es nicht ausgewählte Punkte, erst fragen, ob sie gelöscht werden sollen; sonst direkt.
  const requestSaveDrafts = (): void => {
    if (!filePoints) {
      return;
    }
    if (filePoints.length - selectedCount(filePoints) > 0) {
      setConfirmSaveDrafts(true);
    } else {
      doSaveDrafts(false);
    }
  };

  // SCRUM-409: mehrere bestätigte Punkte VOR der Übernahme zu EINEM Eintrag zusammenführen —
  // der Body trägt ALLE Belegstellen als Abschnitte; die Quelle je Punkt geht in die
  // SCRUM-408-Warteliste (add-source beim Einreichen). Kein Auto-Save.
  // Pedi 04.07.: „Verbinden" fasst die ausgewählten Punkte zu EINEM zusammen und zeigt ihn WIEDER
  // in der Liste — KEIN automatischer Sprung ins Studio, damit die anderen Funde nicht verloren
  // gehen. Weiterverarbeitet wird danach bewusst mit „übernehmen" (genau ein Punkt).
  const mergeSelectedPoints = (): void => {
    if (!filePoints || !fileName) {
      return;
    }
    const count = selectedCount(filePoints);
    if (count < 2) {
      return;
    }
    setFilePoints((pts) => (pts ? mergeSelectedIntoOne(pts) : pts));
    setNotice(t(CAPTURE_FILE_TEXT.mergedInList, { count, name: fileName }));
  };

  // SCRUM-435: ausgewählte Erkenntnis(se) an einen BESTEHENDEN Artikel anhängen (statt neuer Eintrag).
  // Sammelt die Auswahl und öffnet den Artikel-Picker; die Übernahme läuft dort über revise + add-source.
  const requestAppendToArticle = (): void => {
    if (!filePoints || !fileName) {
      return;
    }
    const chosen = filePoints
      .filter((p) => p.selected)
      .map(({ title, summary, sourceExcerpt }) => ({ title, summary, sourceExcerpt }));
    if (chosen.length === 0) {
      return;
    }
    setAppendPts({ points: chosen, fileName });
  };

  // Nach erfolgreichem Anhängen: Quittung, KO-Liste auffrischen, ausgewählte Punkte verlassen die Liste.
  const onAppendedToArticle = (title: string): void => {
    const count = appendPts?.points.length ?? 0;
    push("success", t("xtr.append.done", { count, title }));
    void qc.invalidateQueries({ queryKey: ["kos"] });
    const rest = (filePoints ?? []).filter((p) => !p.selected);
    if (rest.length > 0) {
      setFilePoints(rest);
    } else {
      setFilePoints(null);
      setFileName(null);
      setFileText("");
      setFileRich(null);
      setFileOriginal(null);
      fileOriginalRef.current = { ref: null };
      setFileQuery("");
    }
    setAppendPts(null);
  };

  // PMO-FEA-0006: Punkt bewusst überspringen (nichts wird gespeichert) → nächster Punkt.
  const skipQueuePoint = (): void => {
    if (!fileQueue) {
      return;
    }
    const next = advanceFileQueue(fileQueue);
    setFileQueue(next);
    if (next) {
      loadQueuePoint(next);
    } else {
      setDraft(null);
      setBodyHtml("");
      setWizStep("tell");
      setNotice(t(CAPTURE_FILE_TEXT.queueDone, { name: fileQueue.fileName }));
    }
  };

  const parsedValidations = (): number | undefined => {
    const n = Number.parseInt(neededValidations, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!draft) {
        throw new Error("no draft");
      }
      const n = parsedValidations();
      // SCRUM-354 / FR-STR-06 / G-P1-2: Ein FORTGESETZTER Entwurf (draftId vorhanden) wird sauber
      // über die vorhandene Promote-Route abgeschlossen — NICHT nur lokal vergessen. Dazu zuerst den
      // Entwurf mit den AKTUELLEN Capture-/Studio-Inhalten aktualisieren, dann promoten: das erzeugt
      // ein KO (Status „offen") AUS dem gespeicherten Entwurf (Originalautor + bodyHtml bleiben erhalten,
      // FR-CAP-07) und ENTFERNT den Entwurf serverseitig aus dem gemeinsamen Pool. Ein frischer Entwurf
      // (ohne draftId) wird wie bisher direkt als KO angelegt (Autor = aktueller Nutzer).
      // WP-D7b (Rot-Fix 1): Phase 1 — Wissensobjekt anlegen/promoten (Metadaten + bodyHtml).
      setSubmitStage({ key: "capture.submitStageCreating" });
      const tCreate = performance.now();
      let ko: KnowledgeObject;
      if (draftId) {
        const payload: DraftPayload = {
          title: draft.title,
          statement: draft.statement,
          type,
          category: category.trim() || "Allgemein",
          tags: tags.filter((x) => x.trim()),
          conditions: draft.conditions.filter((x) => x.trim()),
          measures: draft.measures.filter((x) => x.trim()),
          asset: asset.trim() ? asset.trim() : undefined,
          ...(bodyHtml.trim() ? { bodyHtml } : {}),
          ...(n ? { neededValidations: n } : {}),
          ...(confidentiality !== "intern" ? { confidentiality } : {}),
        };
        await endpoints.drafts.update(draftId, payload);
        // SCRUM-395: gewählte Prüfer wandern mit dem Promote zum Server (assign + Meldung).
        ko = await endpoints.drafts.promote(
          draftId,
          reviewerIds.length > 0 ? { reviewerIds } : undefined,
        );
        setSubmittedFromDraft(true);
      } else {
        ko = await endpoints.ko.create({
          title: draft.title,
          statement: draft.statement,
          conditions: draft.conditions.filter((x) => x.trim()),
          measures: draft.measures.filter((x) => x.trim()),
          tags: tags.filter((x) => x.trim()),
          type,
          category: category.trim() || "Allgemein",
          asset: asset.trim() ? asset.trim() : null,
          ...(bodyHtml.trim() ? { bodyHtml } : {}),
          ...(n ? { neededValidations: n } : {}),
          ...(confidentiality !== "intern" ? { confidentiality } : {}),
          // SCRUM-395: Prüfer-Vorschlag beim direkten Einreichen.
          ...(reviewerIds.length > 0 ? { reviewerIds } : {}),
        });
        setSubmittedFromDraft(false);
      }
      logSubmitPhase("ko-create/promote", tCreate);
      // SCRUM-121/373/374: Originale in den Object-Store; am KO nur Referenz + kleine Vorschau.
      //  - Bilder: kind "image" mit Thumbnail; Nicht-Bild-Session-Dateien: kind "document" (AG-02-SESSION,
      //    danach body-verlinkbar via editorFilesFromAttachments/bodyFileLink).
      //  - SCRUM-374: Ein Teilfehler kippt NICHT den Gesamt-Save. Das KO ist bereits (offen) gespeichert;
      //    misslungene Anhänge werden ehrlich gemeldet. Kein Fake-Attach ohne Upload.
      const attachmentItems: AttachmentUploadItem[] = [
        ...images.map((img) => ({
          name: img.name,
          mime: img.mime,
          data: img.original,
          kind: "image" as const,
          thumbnail: img.dataUrl,
        })),
        ...docs.map((doc) => ({
          name: doc.name,
          mime: doc.mime,
          data: doc.data,
          kind: "document" as const,
        })),
      ];
      const attachApi: AttachmentUploadApi = {
        upload: (input) => endpoints.objects.upload(input),
        attach: (koId, attachment) => endpoints.ko.act(koId, { action: "attach", attachment }),
      };
      const queuePoint = currentQueuePoint(fileQueue);
      // WP-D7c (bens D7b-ROT-Fix): finalizeCaptureSubmit trennt jetzt sauber — Phase A lädt die Objekte
      // PARALLEL hoch (der Byte-Kostentreiber bleibt schnell), Phase B schreibt die KO-Mutationen STRIKT
      // SERIELL (kein CAS-STALE_WRITE durch Selbst-Konkurrenz am selben KO).
      // GELB-Fix 2: uploadBytes zählt NUR real übertragene Bytes — greift der Original-Ref-Cache (kein
      // erneuter Upload), wird das Original NICHT mitgezählt.
      const originalWillUpload = Boolean(fileQueue && fileOriginal && !fileOriginalRef.current.ref);
      const uploadBytes =
        attachmentItems.reduce((sum, item) => sum + estimateDataUrlBytes(item.data), 0) +
        (originalWillUpload && fileOriginal ? estimateDataUrlBytes(fileOriginal.data) : 0);
      const uploadMb =
        uploadBytes > 0
          ? (uploadBytes / 1_000_000).toLocaleString(i18n.language, { maximumFractionDigits: 1 })
          : null;
      const tFinalize = performance.now();
      const { attached, failed } = await finalizeCaptureSubmit({
        koId: ko.id,
        attachments: attachmentItems,
        api: attachApi,
        // WP-D2: Ref-Cache lädt das Original höchstens EINMAL hoch (Queue-KOs teilen die objectId).
        original:
          fileQueue && fileOriginal ? { doc: fileOriginal, cache: fileOriginalRef.current } : null,
        // PMO-FEA-0006: Quelle (Dateiname + Belegstelle) des Datei-Imports am KO vermerken (KO-Write, Phase B).
        queueSource:
          fileQueue && queuePoint
            ? {
                name: fileQueue.fileName,
                run: async () => {
                  await endpoints.ko.act(ko.id, {
                    action: "add-source",
                    source: fileSourcePayload(fileQueue.fileName, queuePoint),
                  });
                },
              }
            : null,
        // SCRUM-408: gesammelte externe Quellen ans KO hängen (Stufe 2, nie peer-validiert; Phase B).
        pendingSources: () =>
          attachPendingSources(ko.id, pendingSources, (koId, source) =>
            endpoints.ko.act(koId, { action: "add-source", source }),
          ),
        // WP-D7b/c (Gelb-Fix 2): echte Stufen-Transition — Phase A "uploading" (mit Bytes) → Phase B "linking".
        onPhase: (phase) => {
          if (phase === "uploading") {
            setSubmitStage(
              uploadMb !== null
                ? { key: "capture.submitStageUploading", mb: uploadMb }
                : { key: "capture.submitStageLinking" },
            );
          } else {
            setSubmitStage({ key: "capture.submitStageLinking" });
          }
        },
      });
      logSubmitPhase("attachments(upload parallel)+KO-writes(serial)", tFinalize);
      return { ko, attached, failed };
    },
    // SCRUM-276: kein stilles Weiterleiten — „gespeichert" + nächster Schritt sichtbar machen.
    // Formular zurücksetzen (kein versehentlicher Doppel-Submit); Modus bleibt erhalten.
    onSuccess: ({ ko, attached, failed }) => {
      setSavedKoId(ko.id);
      // SCRUM-369: Rescue-Anschluss nur, wenn dieser Save aus einer Ask-Lücke gestartet wurde.
      setSavedFromGap(gapContext !== null);
      // SCRUM-373/374: nur die WIRKLICH gesicherten Anhänge zählen; Teilfehler getrennt ehrlich melden.
      setSavedFilesCount(attached);
      setFailedAttachments(failed);
      push("success", t("capture.savedTitle"));
      void qc.invalidateQueries({ queryKey: ["validation"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      // SCRUM-354: Der promotete Entwurf ist serverseitig entfernt — Entwurfsliste aktualisieren.
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      setDraft(null);
      setRaw("");
      setBodyHtml("");
      setTags([]);
      setImages([]);
      setDocs([]);
      setCategory("");
      setAsset("");
      setNeededValidations("");
      // SCRUM-395: Prüfer-Auswahl gehört zum abgeschickten KO — für das nächste leeren.
      setReviewerIds([]);
      setDraftId(null);
      // SCRUM-408: Quellen-Warteliste ist mit dem Einreichen ans KO gewandert → leeren.
      setPendingSources([]);
      setSourceForm({ ...EMPTY_SOURCE_FORM });
      setExtQuery("");
      setExtResults([]);
      // SCRUM-375: nach dem Zurücksetzen sind die erweiterten Felder leer → wieder einklappen.
      setShowAdvanced(false);
      setNotice(null);
      // SCRUM-384: nach dem Einreichen zurück zu Schritt 1 (gespeichert-Karte bleibt sichtbar).
      setWizStep("tell");
      setShowCondMeasures(false);
      setShowHelpers(false);
      // PMO-FEA-0006: läuft eine Datei-Warteschlange, direkt den nächsten Punkt zur Prüfung
      // laden (Wizard bleibt im Fluss); nach dem letzten Punkt ehrlicher Abschluss-Hinweis.
      if (fileQueue) {
        const nextQueue = advanceFileQueue(fileQueue);
        setFileQueue(nextQueue);
        if (nextQueue) {
          loadQueuePoint(nextQueue);
        } else {
          setNotice(t(CAPTURE_FILE_TEXT.queueDone, { name: fileQueue.fileName }));
          setFilePoints(null);
          setFileName(null);
          setFileText("");
          setFileRich(null);
          setFileOriginal(null);
          fileOriginalRef.current = { ref: null };
          setFileQuery("");
        }
      }
    },
    onError: fail,
    // WP-D7b (Rot-Fix 1): Fortschritts-Stufe nach jedem Ausgang (Erfolg/Fehler) zurücksetzen.
    onSettled: () => setSubmitStage(null),
  });

  const saveDraft = useMutation({
    mutationFn: () => {
      const n = parsedValidations();
      const payload: DraftPayload = {
        title: draft?.title || raw.split("\n")[0]?.slice(0, 80) || t("capture.draftFallbackTitle"),
        statement: draft?.statement || raw,
        type,
        category: category.trim() || undefined,
        tags: tags.filter((x) => x.trim()),
        conditions: draft?.conditions.filter((x) => x.trim()),
        measures: draft?.measures.filter((x) => x.trim()),
        asset: asset.trim() ? asset.trim() : undefined,
        ...(bodyHtml.trim() ? { bodyHtml } : {}),
        ...(n ? { neededValidations: n } : {}),
        ...(confidentiality !== "intern" ? { confidentiality } : {}),
        // SCRUM-457: Herkunft mitspeichern → „Fortsetzen" öffnet genau hier wieder.
        origin: originForSave({ expert: isExpertMode(mode), wizStep: wizStepRaw }),
      };
      // SCRUM-113 / FE-CAP-07: fortgesetzten Entwurf aktualisieren, sonst neu anlegen.
      return draftId ? endpoints.drafts.update(draftId, payload) : endpoints.drafts.create(payload);
    },
    onSuccess: (_d) => {
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      setErr(null);
      const msg = draftId ? t("capture.draftUpdated") : t("capture.draftSaved");
      // Bugfix (Pedi 04.07.): nach dem Speichern ist die Eingabe leer/neu — der Entwurf liegt in
      // „Entwürfe fortsetzen"; Weiterarbeiten läuft bewusst über „Fortsetzen".
      setRaw("");
      setDraft(null);
      setBodyHtml("");
      setTags([]);
      setImages([]);
      setDocs([]);
      setCategory("");
      setAsset("");
      setNeededValidations("");
      setConfidentiality("intern");
      setReviewerIds([]);
      setPendingSources([]);
      setShowAdvanced(false);
      setWizStep("tell");
      setDraftId(null);
      setNotice(msg);
      push("success", msg);
    },
    onError: (e) => {
      fail(e);
      push("error", t("state.error"));
    },
  });

  // SCRUM-113 / FE-CAP-07: bestehenden Entwurf laden (gemeinsamer Pool).
  // Bugfix (Pedi 04.07.): ein Entwurf öffnet sich WIEDER DORT, wo er entstand — ein einfacher
  // (nur Text) Entwurf im Erzähl-Feld (Freitext), ein strukturierter im Experten-Formular.
  // Vorher landete jeder Entwurf im Formular (fremde Darstellung, verwirrend).
  const loadDraft = (d: Draft): void => {
    setErr(null);
    setCaptureWorkspaceOpen(true);
    const p = d.payload;
    // SCRUM-457: nicht mehr aus dem Inhalt raten — der gespeicherte Herkunfts-Marker entscheidet
    // (Alt-Entwürfe ohne Marker: Rückfall-Heuristik in resumeTargetForDraft).
    const target = resumeTargetForDraft(p);
    if (target === "frontdoor") {
      navigate(`${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(d.id)}`);
      return;
    }
    // gemeinsame Metadaten (erweiterte Felder)
    setType(p.type ?? "best_practice");
    setCategory(p.category ?? "");
    setTags(p.tags ?? []);
    setAsset(p.asset ?? "");
    setNeededValidations(p.neededValidations ? String(p.neededValidations) : "");
    setBodyHtml(p.bodyHtml ?? "");
    // SCRUM-415: Vertraulichkeitsstufe aus dem Entwurf wiederherstellen.
    setConfidentiality(p.confidentiality ?? "intern");
    setDraftId(d.id);
    // SCRUM-375: geladener Entwurf bringt erweiterte Felder mit → aufklappen, nichts verstecken.
    setShowAdvanced(true);
    const structuredDraft = {
      ...EMPTY_DRAFT,
      title: p.title ?? "",
      statement: p.statement ?? "",
      conditions: p.conditions ?? [],
      measures: p.measures ?? [],
    };
    if (target === "tell") {
      // Erzähl-Einstieg → Rohtext-Feld, sofort editier- und speicherbar.
      setMode("freitext");
      setDraft(null);
      setRaw(p.statement ?? p.title ?? "");
      setWizStep("tell");
    } else if (target === "expert") {
      // Experten-Formular (mode formular ⇒ expertView).
      setMode("formular");
      setDraft(structuredDraft);
      setWizStep("tell");
    } else {
      // Geführtes Studio: kein Experten-Modus (expertView false) + refine-Schritt + Entwurf.
      setMode("freitext");
      setDraft(structuredDraft);
      setWizStep("refine");
    }
    setNotice(t("capture.editingDraft"));
    window.setTimeout(() => {
      workAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const discardDraft = useMutation({
    mutationFn: (id: string) => endpoints.drafts.remove(id),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      push("success", t("capture.draftDiscarded"));
      setConfirmDiscardDraftId(null);
      if (draftId === id) {
        setDraftId(null);
      }
    },
    onError: fail,
  });

  const switchMode = (m: Mode): void => {
    setErr(null);
    setNotice(null);
    setCaptureWorkspaceOpen(true);
    // Bug (Pedi 04.07.): Inhalt beim Moduswechsel NICHT verlieren. Der Rohtext (Freitext/Diktat)
    // und die Aussage des Experten-Formulars werden aneinander übergeben.
    const carried = raw.trim();
    if (m === "formular") {
      // Freitext → Formular: Rohtext als „Aussage" ins Formular übernehmen (nur wenn dort leer).
      setDraft((d) => {
        const base = d ?? { ...EMPTY_DRAFT };
        if (base.statement.trim()) {
          return base;
        }
        return {
          ...base,
          statement: carried,
          title: base.title || carried.split("\n")[0]?.slice(0, 80) || "",
        };
      });
    } else if ((m === "freitext" || m === "diktat") && !carried && draft?.statement.trim()) {
      // Formular → Erzählen: Aussage zurück in den Rohtext (nur wenn der Rohtext leer ist).
      setRaw(draft.statement);
    }
    setMode(m);
    if (m === "interview") {
      // SCRUM-132: Interview startet mit der ersten reasoner-getriebenen Frage.
      setIvAnswers([]);
      setIvAnswer("");
      setIvResult(null);
      interview.mutate([]);
    }
  };

  const openFileImport = (): void => {
    setCaptureWorkspaceOpen(true);
    setWizStep("tell");
    switchMode("datei");
    window.setTimeout(() => {
      workAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const openCaptureWorkspace = (): void => {
    setCaptureWorkspaceOpen(true);
    setWizStep("tell");
    window.setTimeout(() => {
      workAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  // SCRUM-458: der Aufklapp-Einstieg ist ein echter Toggle — erneuter Klick klappt den Arbeitsraum
  // wieder ein (reine Sichtbarkeit; Inhalte/State bleiben erhalten).
  const closeCaptureWorkspace = (): void => {
    setCaptureWorkspaceOpen(false);
  };

  const cancelFileImport = (): void => {
    setFileName(null);
    setFileText("");
    setFileRich(null);
    setFileImageInfo(null);
    setFileOriginal(null);
    fileOriginalRef.current = { ref: null };
    setFileImageUrl(null);
    setFileBusy(false);
    setFileQuery("");
    setFilePoints(null);
    setFileNote(null);
    setFileQueue(null);
    setFileWholeDraftSaved(null);
    setFileImportMode("points");
    setErr(null);
    setNotice(null);
    setCaptureWorkspaceOpen(false);
    setMode("freitext");
    setWizStep("tell");
    navigate("/erfassen", { replace: true, state: null });
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  };

  // Bug (Pedi 04.07.): ungespeicherten Entwurf nicht still verlieren. Diese Wache greift beim
  const { setGuard } = useNavGuard();
  // Verlassen der Seite über den BROWSER (Zurück-Taste, Neuladen, Tab schließen) — dann fragt der
  // Browser „Seite verlassen?".
  // Bug (Pedi 05.07.): Der Wächter muss in JEDEM Erfassungsmodus greifen, sobald IRGENDEIN Feld
  // befüllt ist — vorher nur Freitext/Body/Aussage. Jetzt zusätzlich: geführtes Interview
  // (begonnene/laufende Antwort), „Aus Datei" (hochgeladene Datei bereits VOR der KI-Auswertung),
  // Experten-Formular (Kernaussage/Titel/Bedingungen/Maßnahmen) sowie erweiterte Felder/Anhänge.
  const draftHasContent =
    !!draft &&
    (draft.statement.trim().length > 0 ||
      draft.title.trim().length > 0 ||
      (draft.conditions?.some((c) => c.trim().length > 0) ?? false) ||
      (draft.measures?.some((mm) => mm.trim().length > 0) ?? false));
  const hasUnsavedEntry =
    raw.trim().length > 0 ||
    bodyHtml.trim().length > 0 ||
    draftHasContent ||
    // Geführtes Interview: begonnene Antworten oder gerade getippte Antwort.
    ivAnswer.trim().length > 0 ||
    ivAnswers.some((a) => a.trim().length > 0) ||
    // Aus Datei: hochgeladene Datei / eingelesener Text (auch VOR der KI-Auswertung).
    Boolean(fileName) ||
    fileText.trim().length > 0 ||
    // Erweiterte Felder, Metadaten und Anhänge zählen ebenfalls als „etwas eingetragen".
    category.trim().length > 0 ||
    asset.trim().length > 0 ||
    tags.length > 0 ||
    images.length > 0 ||
    docs.length > 0 ||
    pendingSources.length > 0;
  // In „Aus Datei" ausgewertete Funde (filePoints) — die ganze Tabelle darf nicht still verloren gehen.
  const hasUnsavedFilePoints = Boolean(filePoints && filePoints.length > 0);
  const hasUnsaved = hasUnsavedEntry || hasUnsavedFilePoints;
  useEffect(() => {
    if (!hasUnsaved) {
      return;
    }
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  // Bug (Pedi 04.07./05.07.): In-App-Seitenwechsel (Menü, Command-Palette) fängt jetzt der Navigations-
  // Wächter ab — Nachfrage „Bleiben · Verwerfen · Entwurf speichern", bevor Inhalt verloren geht.
  // „Entwurf speichern" sichert die manuelle Eingabe UND — falls vorhanden — ALLE offenen Datei-Funde
  // als separate Entwürfe (nichts geht verloren). Teilfehler halten den Dialog offen (kein Wechsel).
  useEffect(() => {
    setGuard({
      isDirty: () => hasUnsaved,
      save: async () => {
        if (hasUnsavedEntry) {
          await saveDraft.mutateAsync();
        }
        if (filePoints && filePoints.length > 0 && fileName) {
          const all = filePoints.map(({ title, summary, sourceExcerpt }) => ({
            title,
            summary,
            sourceExcerpt,
          }));
          const result = await createPointDrafts(
            all,
            fileName,
            normalizeExtractLocale(i18n.language),
            (p) => endpoints.drafts.create(p),
          );
          void qc.invalidateQueries({ queryKey: ["drafts"] });
          if (result.failed.length > 0) {
            setErr(t(CAPTURE_FILE_TEXT.draftsPartial, { failed: result.failed.join(", ") }));
            // Nicht wechseln: Dialog bleibt offen, die Seite zeigt die Fehlermeldung.
            throw new Error("draftsPartial");
          }
          push(
            "success",
            t(CAPTURE_FILE_TEXT.draftsSaved, { count: result.created, name: fileName }),
          );
          setFilePoints(null);
          setFileName(null);
          setFileText("");
          setFileRich(null);
          setFileOriginal(null);
          fileOriginalRef.current = { ref: null };
          setFileQuery("");
        }
      },
    });
    return () => setGuard(null);
  }, [
    hasUnsaved,
    hasUnsavedEntry,
    filePoints,
    fileName,
    saveDraft,
    setGuard,
    qc,
    i18n.language,
    t,
    push,
  ]);

  // SCRUM-403: gemeinsame Rekorder-Fabrik für beide Diktat-Ziele (Freitext + Interview-Antwort).
  const makeRec = (append: (text: string) => void, onDone: () => void): SpeechRec | null => {
    const Ctor = speechCtor();
    if (!Ctor) {
      return null;
    }
    const rec = new Ctor();
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      append(text);
    };
    rec.onend = onDone;
    rec.onerror = onDone;
    return rec;
  };

  const toggleDictation = (): void => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = makeRec(
      (text) => setRaw((prev) => (prev ? `${prev} ${text}` : text)),
      () => setListening(false),
    );
    if (!rec) {
      return;
    }
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  // SCRUM-403: Diktat für die Interview-Antwort — hängt Erkanntes an die laufende Antwort an.
  const toggleIvDictation = (): void => {
    if (ivListening) {
      ivRecRef.current?.stop();
      return;
    }
    const rec = makeRec(
      (text) => setIvAnswer((prev) => (prev ? `${prev} ${text}` : text)),
      () => setIvListening(false),
    );
    if (!rec) {
      return;
    }
    ivRecRef.current = rec;
    rec.start();
    setIvListening(true);
  };

  // SCRUM-403: aktuelle Interview-Frage vorlesen; erneuter Klick stoppt. Ehrlich: Knopf
  // erscheint nur, wenn der Browser SpeechSynthesis kann. Kein Auto-Play.
  const toggleReadQuestion = (): void => {
    if (!ttsSupported) {
      return;
    }
    if (ivReading) {
      window.speechSynthesis.cancel();
      setIvReading(false);
      return;
    }
    const text = ivResult?.question;
    if (!text) {
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = i18n.language.startsWith("en") ? "en-US" : "de-DE";
    u.onend = () => setIvReading(false);
    u.onerror = () => setIvReading(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setIvReading(true);
  };

  // SCRUM-403: Vorlesen sauber beenden, wenn die Frage wechselt oder die Seite verlassen wird.
  useEffect(() => {
    return () => {
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [ttsSupported]);
  // Bei jeder neuen Frage wird ein laufendes Vorlesen gestoppt (kein Weiterlesen alter Fragen).
  // biome-ignore lint/correctness/useExhaustiveDependencies: ivResult ist bewusst der Auslöser.
  useEffect(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
    setIvReading(false);
  }, [ivResult, ttsSupported]);

  // SCRUM-373 / AG-02-SESSION: Session-Datei mit Originalbytes merken (für den Object-Store-Upload beim
  // Speichern). Reine lokale Erfassung — noch KEINE objectId, daher noch NICHT body-verlinkbar (kein Fake-Link).
  const pushDoc = async (f: File): Promise<void> => {
    const data = await readFileAsDataUrl(f);
    setDocs((d) => [
      ...d,
      { id: crypto.randomUUID(), name: f.name, mime: f.type || "application/octet-stream", data },
    ]);
  };

  // WP-D7d (bens Härtung 1b): die angezeigte maxAttachments-Grenze VOR dem Upload durchsetzen — die
  // Auswahl wird auf die freien Plätze (Bilder + Dateien zusammen) gedeckelt, mit ehrlicher Meldung
  // (n von m akzeptiert, Limit X). Kein Server-Umbau; der Server bleibt die harte Grenze.
  // WP-D7e (bens ROT-Fix): läuft eine Datei-Warteschlange mit Original, hängt DERSELBE Submit das Original
  // ZUSÄTZLICH an → EIN Platz wird hier reserviert, damit das Original nie als überzähliger Anhang abgelehnt
  // wird (D2-Vertrag). Gilt AUCH bei Ref-Cache-Treffer: der Attach je KO passiert trotzdem, nur der Upload
  // entfällt. EINE Ableitung für alle drei Pfade (onDocs, attachFiles, onImages).
  const capIncomingFiles = (files: File[]): File[] => {
    const { accepted, dropped } = capAttachmentSelection(
      files,
      images.length + docs.length,
      uploadLimitsData.maxAttachments,
      fileQueue && fileOriginal ? 1 : 0,
    );
    if (dropped > 0) {
      setErr(
        t("capture.attachLimitReached", {
          taken: accepted.length,
          total: files.length,
          limit: uploadLimitsData.maxAttachments,
        }),
      );
    }
    return accepted;
  };

  // WP-D7e (bens GELB-Fix): welche Dateien onDocs überhaupt verarbeiten kann — Typ-Filter VOR dem Cap,
  // damit nicht unterstützte Dateien keine Anhang-Plätze verbrauchen (ein gültiges Element derselben
  // Mehrfachauswahl fiele sonst am Limit unnötig heraus).
  const isDocsSupported = (f: File): boolean =>
    isImage(f) ||
    isTextDocument(f) ||
    isWordDocument(f) ||
    isPdfDocument(f) ||
    f.type.startsWith("video/") ||
    f.type.startsWith("audio/");

  const onDocs = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const all = Array.from(e.target.files ?? []);
    e.target.value = "";
    // Nicht unterstützte Dateien ehrlich melden — sie zählen NICHT gegen die Anhang-Grenze.
    for (const f of all.filter((x) => !isDocsSupported(x))) {
      setErr(t("capture.docUnsupported", { name: f.name }));
    }
    const files = capIncomingFiles(all.filter(isDocsSupported));
    for (const f of files) {
      if (isImage(f)) {
        await addImage(f);
      } else if (isTextDocument(f) || isWordDocument(f)) {
        try {
          const text = isWordDocument(f) ? await readDocxFile(f) : await readTextFile(f);
          setRaw((prev) => (prev ? `${prev}\n\n[${f.name}]\n${text}` : `[${f.name}]\n${text}`));
          await pushDoc(f);
          setNotice(t("capture.docAdded", { name: f.name }));
        } catch {
          setErr(t("capture.docParseError", { name: f.name }));
        }
      } else if (isPdfDocument(f)) {
        // SCRUM-122: PDF lazy als Text-Kontext übernehmen; Status ehrlich anzeigen.
        setErr(null);
        setNotice(t("capture.docExtracting", { name: f.name }));
        try {
          // WP-D3: zeilen-/absatztreuer PDF-Text; truncated meldet den Seiten-Cap ehrlich.
          const { text, truncated, pageCount } = await readPdfFile(f);
          if (text.length === 0) {
            setErr(t("capture.docEmpty", { name: f.name }));
            continue;
          }
          setRaw((prev) => (prev ? `${prev}\n\n[${f.name}]\n${text}` : `[${f.name}]\n${text}`));
          await pushDoc(f);
          const truncatedNote = truncated
            ? ` ${t(CAPTURE_FILE_TEXT.pdfTruncated, { count: pageCount })}`
            : "";
          setNotice(`${t("capture.docAdded", { name: f.name })}${truncatedNote}`);
        } catch {
          setErr(t("capture.docParseError", { name: f.name }));
        }
      } else if (f.type.startsWith("video/") || f.type.startsWith("audio/")) {
        // SCRUM-382: Video/Audio als Session-Datei merken (Attach beim Speichern) —
        // Transkription NUR auf Klick, wie bei der Bild-OCR (keine stille Aktion).
        await pushDoc(f);
        setNotice(t("capture.videoAdded", { name: f.name }));
      }
      // WP-D7e: kein else-Zweig mehr — nicht unterstützte Dateien sind bereits VOR dem Cap
      // aussortiert und gemeldet (isDocsSupported).
    }
  };

  // Pedi 04.07.: „Datei oder Bild beifügen" — Menschen sind es gewohnt, Dateien anzuhängen. Anders
  // als „Text aus Datei … einfügen" (onDocs) wird hier KEIN Text ins Feld gelesen: die Datei wird NUR
  // als Anhang mitgeführt (Bild → Bildanhang, alles andere → Dokumentanhang), sichtbar unter
  // „Erweiterte Details". Späteres Anhängen als benannte Quelle bleibt der bewusste Schritt beim
  // Einreichen (SCRUM-408) — hier wird nichts automatisch als Quelle gespeichert.
  // Kern des Anhängens (auch vom Studio genutzt): Bild → Bildanhang, sonst → Dokumentanhang.
  const attachFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) {
      return;
    }
    setErr(null);
    // WP-D7d (Härtung 1b): auch der Anhang-Pfad (Wizard + Studio) respektiert die Anhang-Grenze.
    const accepted = capIncomingFiles(files);
    for (const f of accepted) {
      if (isImage(f)) {
        await addImage(f);
      } else {
        await pushDoc(f);
      }
    }
    if (accepted.length > 0) {
      setNotice(t(CAPTURE_WIZARD_TEXT.attached, { count: accepted.length }));
    }
  };
  const onAttach = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    await attachFiles(files);
  };

  // PMO-FEA-0006: Dokument für die Wissens-Extraktion lesen — nutzt die VORHANDENEN
  // Extraktoren (Text/Word/PDF; Bild als OCR-Kandidat, Erkennung NUR auf Klick wie SCRUM-123).
  const onExtractFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) {
      return;
    }
    setFilePoints(null);
    setFileNote(null);
    setFileQueue(null);
    setFileWholeDraftSaved(null);
    setFileImageUrl(null);
    setFileText("");
    setFileRich(null);
    setFileImageInfo(null);
    setFileOriginal(null);
    fileOriginalRef.current = { ref: null };
    setErr(null);
    setFileName(f.name);
    setFileBusy(true);
    setNotice(t(CAPTURE_FILE_TEXT.extracting, { name: f.name }));
    try {
      if (isImage(f)) {
        setFileImageUrl(await readFileAsDataUrl(f));
        setNotice(null);
        return;
      }
      let text = "";
      let rich: { html: string | null; kind: WholeDocumentSourceKind } = {
        html: null,
        kind: "text",
      };
      // WP-D3: Hinweis, wenn der PDF-Seiten-Cap griff (nur die ersten N Seiten gelesen).
      let pdfTruncatedPages: number | null = null;
      // WP-D5: Hinweis, wenn der PPTX-Folien-Cap griff (nur die ersten N Folien gelesen).
      let pptxTruncatedSlides: number | null = null;
      // WP-D9: ehrliche Teilverlust-Hinweise für Folien-Bilder (Format nicht unterstützt / Bild-Budget).
      let pptxImagesDroppedFormat = 0;
      let pptxImagesDroppedBudget = 0;
      // WP-D1c: Bild-Bilanz des DOCX-Imports — erst beim Speichern (an den Anhang-Erfolg gekoppelt)
      // gemeldet, NICHT hier (zur Lesezeit ist noch nichts angehängt).
      let imageInfo: {
        total: number;
        compressed: number;
        dropped: number;
        htmlOverflow: boolean;
      } | null = null;
      // WP-D5b (bens GELB-Fix 4): Format über die zentrale detectFileKind-Reihenfolge bestimmen
      // (image→pdf→docx→pptx→text). So gewinnt die Endung .pptx gegen einen irreführenden MIME text/plain
      // — sonst landete eine .pptx im Text-Pfad (Bug: isTextDocument stand VOR der PPTX-Erkennung).
      const kind = detectFileKind({ name: f.name, type: f.type });
      if (kind === "docx") {
        // WP-D1: DOCX strukturerhaltend — HTML (Überschriften/Listen/Tabellen/Bilder, Best-Effort)
        // für den Ganzdokument-Modus, Klartext weiterhin für die KI-Punkte-Extraktion.
        // WP-BILD-1a: jedes behaltene Bild bekommt eine bearbeitbare Bild-Fußnote mit ehrlichem
        // Platzhalter (lokalisiert injiziert; KI-Beschreibung folgt in BILD-1b).
        const docx = await readDocxRich(f, t(CAPTURE_FILE_TEXT.imageCaptionPlaceholder));
        text = docx.text;
        rich = { html: docx.html, kind: "docx" };
        imageInfo = {
          total: docx.totalImages,
          compressed: docx.compressedImages,
          dropped: docx.droppedImages,
          // WP-D1e (Fix 3): htmlOverflow bis zum Speichern mitführen — dort wird VOR dem Upload abgebrochen.
          htmlOverflow: docx.htmlOverflow,
        };
      } else if (kind === "pdf") {
        // WP-D3: zeilen-/absatztreuer PDF-Text; truncated meldet den Seiten-Cap.
        const pdf = await readPdfFile(f);
        text = pdf.text;
        rich = { html: null, kind: "pdf" };
        pdfTruncatedPages = pdf.truncated ? pdf.pageCount : null;
      } else if (kind === "pptx") {
        // WP-D5/WP-D9 (Pedis Live-Befund): PowerPoint strukturerhaltend (Folie für Folie: Titel→h2,
        // Text→Absätze, Bullets→Listen, Tabellen→<table>) — und die Folien-Bilder jetzt wie beim
        // DOCX-Import als <figure> mit Bild-Fußnote (gleicher Platzhalter-Key). Teilverluste
        // (Format/Bild-Budget) werden ehrlich beziffert; die Bild-Bilanz reist wie beim DOCX mit
        // (kept = total - dropped), htmlOverflow greift weiter VOR dem Upload (WP-D1e).
        const pptx = await readPptxRich(f, t(CAPTURE_FILE_TEXT.imageCaptionPlaceholder));
        text = pptx.text;
        rich = { html: pptx.html, kind: "pptx" };
        pptxTruncatedSlides = pptx.truncated ? pptx.slideCount : null;
        pptxImagesDroppedFormat = pptx.droppedImageFormat;
        pptxImagesDroppedBudget = pptx.droppedImageBudget;
        imageInfo = {
          total: pptx.imageCount,
          compressed: 0,
          // ALLES nicht Eingebettete zählt als dropped (Format/Budget/fehlendes Ziel) — kept bleibt ehrlich.
          dropped: pptx.imageCount - pptx.embeddedImages,
          htmlOverflow: pptx.htmlOverflow,
        };
      } else if (kind === "text") {
        text = await readTextFile(f);
      } else {
        setFileName(null);
        setNotice(null);
        setErr(t(CAPTURE_FILE_TEXT.unsupported, { name: f.name }));
        return;
      }
      if (text.trim().length === 0) {
        setNotice(null);
        // WP-D4: bei PDFs ehrlich auf die fehlende Textebene hinweisen — OHNE falsche OCR-Hoffnung
        // (eine PDF-OCR existiert nicht).
        const emptyKey =
          rich.kind === "pdf"
            ? CAPTURE_FILE_TEXT.emptyPdf
            : rich.kind === "pptx"
              ? CAPTURE_FILE_TEXT.emptyPptx
              : CAPTURE_FILE_TEXT.empty;
        setErr(t(emptyKey, { name: f.name }));
        return;
      }
      setFileText(text);
      setFileRich(rich);
      setFileImageInfo(imageInfo);
      // WP-D2 („Original ist heilig"): die Quelldatei selbst merken — sie wird beim Speichern
      // (Ganzdokument-Entwurf bzw. Punkte-Queue-KOs) als Anhang in den Object-Store mitgeführt.
      setFileOriginal({
        name: f.name,
        mime: f.type || "application/octet-stream",
        data: await readFileAsDataUrl(f),
      });
      // SCRUM-409: ehrliche Import-Quittung — Dateiname + Umfang (Zeichen; Seiten gibt der
      // Text-Extraktor nicht her, also wird auch keine Seitenzahl behauptet).
      // WP-D4: plus formatabhängige Format-Quittung (DOCX: Struktur+Bilder Best-Effort; PDF: nur Text).
      const formatNote =
        rich.kind === "docx"
          ? ` ${t(CAPTURE_FILE_TEXT.importNoteDocx)}`
          : rich.kind === "pdf"
            ? ` ${t(CAPTURE_FILE_TEXT.importNotePdf)}`
            : rich.kind === "pptx"
              ? ` ${t(CAPTURE_FILE_TEXT.importNotePptx)}`
              : "";
      // WP-D3/WP-D5: bei Seiten-/Folien-Cap ehrlich anhängen, wie viele Seiten/Folien importiert wurden.
      const truncatedNote =
        pdfTruncatedPages !== null
          ? ` ${t(CAPTURE_FILE_TEXT.pdfTruncated, { count: pdfTruncatedPages })}`
          : pptxTruncatedSlides !== null
            ? ` ${t(CAPTURE_FILE_TEXT.pptxTruncated, { count: pptxTruncatedSlides })}`
            : "";
      // WP-D9: ehrliche Teilverlust-Notizen für Folien-Bilder — NUR wenn wirklich etwas verloren ging
      // (übernommene Bilder brauchen keinen Sonderhinweis). Der Dokumenttext ist davon unberührt.
      const imageLossNote =
        (pptxImagesDroppedFormat > 0
          ? ` ${t(CAPTURE_FILE_TEXT.pptxImagesFormat, { count: pptxImagesDroppedFormat })}`
          : "") +
        (pptxImagesDroppedBudget > 0
          ? ` ${t(CAPTURE_FILE_TEXT.pptxImagesBudget, { count: pptxImagesDroppedBudget })}`
          : "");
      // WP-D1c: KEINE „Original im Anhang"-Behauptung zur Lesezeit (noch nichts angehängt) — die
      // ehrliche, anhang-gekoppelte Bild-Meldung folgt beim Speichern (fileWholeDraft.onSuccess).
      setNotice(
        `${t(CAPTURE_FILE_TEXT.loadedStats, {
          name: f.name,
          chars: text.length,
        })}${formatNote}${truncatedNote}${imageLossNote}`,
      );
    } catch (error) {
      setFileName(null);
      setNotice(null);
      // WP-D5b (bens GELB-Fix 3): Archiv-/Dekompressionsbudget überschritten → ehrliche, spezifische
      // Meldung statt generischem Parse-Fehler (und statt UI-Freeze).
      if (error instanceof PptxTooLargeError) {
        setErr(t(CAPTURE_FILE_TEXT.pptxTooLarge, { name: f.name }));
      } else {
        setErr(t(CAPTURE_FILE_TEXT.parseError, { name: f.name }));
      }
    } finally {
      setFileBusy(false);
    }
  };

  // PMO-FEA-0006: Bild-OCR für die Extraktion — NUR auf Klick, ehrlicher Status (SCRUM-123-Muster).
  const onExtractOcr = async (): Promise<void> => {
    if (!fileImageUrl || !fileName) {
      return;
    }
    setErr(null);
    setOcrBusy("extract-file");
    setNotice(t("capture.ocrRunning", { name: fileName }));
    try {
      const res = await runImageOcr(fileImageUrl);
      if (res.status === "success" && res.text.length > 0) {
        setFileText(res.text);
        setNotice(t(CAPTURE_FILE_TEXT.loadedStats, { name: fileName, chars: res.text.length }));
      } else if (res.status === "unavailable") {
        setNotice(null);
        setErr(t("capture.ocrUnavailable"));
      } else {
        setNotice(null);
        setErr(t("capture.ocrEmpty", { name: fileName }));
      }
    } finally {
      setOcrBusy(null);
    }
  };

  const addImage = async (f: File): Promise<void> => {
    try {
      // SCRUM-121: kleine Vorschau lokal + Original separat (geht beim Submit in den Object-Store).
      // Bugfix (Pedi 04.07.): Das Thumbnail ist OPTIONAL. Schlägt die Vorschau-Erzeugung fehl
      // (z. B. exotisches Bildformat / Canvas-Grenze), nutzen wir das Original als Vorschau —
      // statt den ganzen Anhang mit „Es ist etwas schiefgegangen" abzubrechen.
      const original = await readFileAsDataUrl(f);
      let dataUrl = original;
      try {
        dataUrl = await fileToThumbDataUrl(f);
      } catch {
        // Vorschau optional — Original bleibt als Anzeige erhalten.
      }
      setImages((im) => [
        ...im,
        { id: crypto.randomUUID(), name: f.name, mime: f.type || "image/jpeg", dataUrl, original },
      ]);
    } catch {
      setErr(t("capture.imageError", { name: f.name }));
    }
  };

  const onImages = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    // WP-D7d (Härtung 1b): auch der reine Bild-Upload zählt gegen die gemeinsame Anhang-Grenze.
    const files = capIncomingFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
    for (const f of files) {
      if (isImage(f)) {
        await addImage(f);
      }
    }
  };

  // SCRUM-382: Video-/Audio-Transkription, NUR auf Nutzeraktion. Der Server hält den
  // Dienst-Schlüssel; ohne Dienst kommt ein ehrlicher Inaktiv-Hinweis (kein Fake-Text).
  const onTranscribe = async (d: { id: string; name: string; mime: string; data: string }) => {
    setErr(null);
    setVideoBusy(d.id);
    setNotice(t("capture.videoRunning", { name: d.name }));
    try {
      // SCRUM-521 (WP1): die Vertraulichkeit des Entwurfs BEIM UPLOAD persistieren — sie ist danach
      // die serverseitige Quelle der Wahrheit für die Egress-Entscheidung. Nur ein als „intern"
      // hochgeladenes Medium darf extern transkribiert werden; fehlt die Stufe, bleibt es serverseitig
      // fail-safe vertraulich.
      const ref = await endpoints.objects.upload({
        name: d.name,
        mime: d.mime,
        data: d.data,
        kind: "video",
        confidentiality,
      });
      // Die Analyse reicht die Stufe nur noch als optionale HOCHSTUFUNG durch — herabstufen kann sie nicht.
      const res = await endpoints.media.analyze(ref.id, locale, confidentiality);
      if (res.engineActive && res.transcript && res.transcript.length > 0) {
        setRaw((prev) =>
          prev
            ? `${prev}\n\n[Transkript: ${d.name}]\n${res.transcript}`
            : `[Transkript: ${d.name}]\n${res.transcript}`,
        );
        setNotice(t("capture.videoDone", { name: d.name }));
      } else {
        setNotice(null);
        setErr(res.note);
      }
    } catch (e) {
      setNotice(null);
      setErr(e instanceof ApiError ? e.message : t("state.error"));
    } finally {
      setVideoBusy(null);
    }
  };

  // SCRUM-123: optionale Bild-OCR, NUR auf Nutzeraktion. Status ehrlich anzeigen.
  const onOcr = async (img: { id: string; name: string; dataUrl: string }): Promise<void> => {
    setErr(null);
    setOcrBusy(img.id);
    setNotice(t("capture.ocrRunning", { name: img.name }));
    try {
      const res = await runImageOcr(img.dataUrl);
      if (res.status === "success" && res.text.length > 0) {
        setRaw((prev) =>
          prev ? `${prev}\n\n[OCR: ${img.name}]\n${res.text}` : `[OCR: ${img.name}]\n${res.text}`,
        );
        setNotice(t("capture.ocrDone", { name: img.name }));
      } else if (res.status === "success") {
        setErr(t("capture.ocrEmpty", { name: img.name }));
      } else if (res.status === "unavailable") {
        setErr(t("capture.ocrUnavailable"));
      } else {
        setErr(t("capture.ocrFailed", { name: img.name }));
      }
    } finally {
      setOcrBusy(null);
    }
  };

  // SCRUM-132: Antwort senden → nächster reasoner-getriebener Turn.
  const ivSend = (): void => {
    const answers = appendAnswer(ivAnswers, ivAnswer);
    setIvAnswers(answers);
    setIvAnswer("");
    interview.mutate(answers);
  };

  // SCRUM-257: produktnaher Beispielpfad — lädt eine industrielle Erfahrungsnotiz (Linie L4 /
  // Dosierwert / Schichtwechsel) aus dem DOM-freien Helper und nennt den nächsten Schritt.
  const loadExample = (): void => {
    setRaw(CAPTURE_EXAMPLE.raw);
    setCategory(CAPTURE_EXAMPLE.category);
    setAsset(CAPTURE_EXAMPLE.asset);
    setTags(CAPTURE_EXAMPLE.tags);
    // SCRUM-375: das Beispiel füllt erweiterte Felder → aufklappen, damit der Nutzer sie sieht.
    setShowAdvanced(true);
    setNotice(t(CAPTURE_EXAMPLE.noticeKey));
  };

  const busy = structure.isPending || saveDraft.isPending;
  // WP-D7b (Rot-Fix 1): ehrlicher, mehrstufiger Einreichen-Text — zeigt die aktuelle Phase (mit Upload-Größe),
  // sonst der generische Busy-Text. DE/EN/NL über die i18n-Keys.
  const submitBusyLabel = submitStage
    ? t(submitStage.key, submitStage.mb !== undefined ? { mb: submitStage.mb } : undefined)
    : t("capture.submitBusy");

  // SCRUM-407 (Pedi 03.07.): durchgängige, ausführliche ?-Hilfen im Erfassen-Weg — Themen und
  // i18n-Schlüssel kommen aus der zentralen Karte lib/captureHelp (gleiches Muster wie SCRUM-406).
  const chelp = (id: CaptureHelpId): { title: string; body: string } => {
    const topic = captureHelp(id);
    return { title: t(topic.titleKey), body: t(topic.bodyKey) };
  };

  // SCRUM-408: gleiche Guard-Logik wie im Prüfbereich (viewer darf keine Quellen anhängen).
  const canSources = canAttachCaptureSources(user?.role);

  // SCRUM-375: wie viele erweiterte Felder schon Inhalt tragen — für das „X ausgefüllt"-Badge.
  const advancedSummary = advancedFieldsSummary({
    category,
    asset,
    neededValidations,
    tags,
    documentCount: docs.length,
    imageCount: images.length,
  });

  // SCRUM-248: ehrlicher Speicher-Check — was landet im KO, was fehlt noch? (nur echte Felder)
  const readiness = draft
    ? captureReadiness({
        title: draft.title,
        statement: draft.statement,
        bodyHtml,
        category,
        type,
        attachmentCount: images.length,
      })
    : null;

  // SCRUM-384: abgeleiteter Wizard-Zustand (refine nur mit Entwurf) + sichtbare Schritt-Leiste.
  const expertView = isExpertMode(mode);
  const wizStep = resolveWizardStep(wizStepRaw, draft !== null);
  const chips = wizardChips(wizStepRaw, draft !== null);
  const draftCount = drafts.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        kicker={t("capture.kicker")}
        title={t("capture.title")}
        actions={
          <Link
            className="text-sm font-semibold text-muted hover:text-ink"
            to={CAPTURE_FRONT_DOOR_ROUTE}
          >
            Dokument-Canvas
          </Link>
        }
      />
      {/* SCRUM-296: Demo-/Pilotpfad auf der Erfassungsseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="capture" /> : null}

      {/* KW-PROD-15: Vordertuer als klarer Default; die bisherigen Wege bleiben darunter erhalten. */}
      <Card className="mb-4 border-ai/30 bg-ai/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[12px] font-semibold uppercase text-ai">Standardweg</div>
            <h2 className="mt-1 text-lg font-semibold text-ink">Neues Wissensobjekt erfassen</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Dokument-Canvas fuer Titel, Inhalt, Formatierung, Bilder und Entwurf-Fortsetzen.
            </p>
          </div>
          <Link
            to={CAPTURE_FRONT_DOOR_ROUTE}
            className="inline-flex items-center justify-center rounded-btn bg-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Dokument-Canvas oeffnen <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3 text-[12.5px] text-muted">
          <span className="flex-1">
            Weitere Wege: Expertenformular, Diktat, Interview und Datei importieren bleiben
            erreichbar.
          </span>
          <Button variant="outline" onClick={openFileImport}>
            <FileText size={15} />
            {t("capture.fileImportJump")}
          </Button>
          {/* SCRUM-458 (Nullschulung): echter Disclosure-Einstieg für den Erfassungs-Arbeitsraum —
              standardmäßig eingeklappt, Klick klappt Schritt-Leiste + Erzähl-Modi + Formular auf, erneuter
              Klick wieder ein. aria-expanded/aria-controls für Tastatur/Screenreader. */}
          <Button
            variant="ghost"
            onClick={captureWorkspaceOpen ? closeCaptureWorkspace : openCaptureWorkspace}
            aria-expanded={captureWorkspaceOpen}
            aria-controls="capture-workspace"
          >
            {captureWorkspaceOpen ? "Weitere Wege einklappen ▴" : "Weitere Wege anzeigen ▾"}
          </Button>
        </div>
      </Card>

      {/* SCRUM-352: ruhiger, geführter Einstieg — Story „Erfahrungswissen sichern" + 3 Schritte +
          leichter Wertbeitrag. Progressive Disclosure; entfernt keine Funktion (Modi/Editor folgen). */}
      {/* SCRUM-384: Erstnutzer-Führung — beim Erstbesuch ausgeklappt, danach ruhig eingeklappt. */}
      <KnowledgeRescueIntro defaultOpen={firstRun} />

      {frontDoorDraftSaved ? (
        <Card className="mb-4 border-trust-pos-fill/40 bg-trust-pos-bg">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[13px] font-semibold text-trust-pos-text">Entwurf gespeichert</div>
            <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-pos-text">
              fortsetzen bereit
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-trust-pos-text/90">
            <strong>{frontDoorDraftSaved.title}</strong> ist unter Entwuerfe fortsetzen sichtbar.
            Der gespeicherte Entwurf ist in der Liste hervorgehoben; der Dokument-Canvas startet
            beim naechsten Oeffnen wieder leer.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              to={`${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(frontDoorDraftSaved.id)}`}
              className="inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
            >
              Entwurf fortsetzen <span aria-hidden="true">→</span>
            </Link>
            <Link
              to={CAPTURE_FRONT_DOOR_ROUTE}
              className="inline-flex items-center gap-1 rounded-btn border border-hairline bg-page px-3 py-1.5 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
            >
              Neuer leerer Eintrag <span aria-hidden="true">→</span>
            </Link>
            <Button variant="ghost" onClick={() => setFrontDoorDraftSaved(null)}>
              Hinweis ausblenden
            </Button>
          </div>
        </Card>
      ) : null}

      {/* SCRUM-276: nach erfolgreichem Einreichen „gespeichert" + nächster Schritt (kein Auto-Redirect). */}
      {savedKoId ? (
        <Card className="mb-4 border-trust-pos-fill/40 bg-trust-pos-bg">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[13px] font-semibold text-trust-pos-text">
              {t("capture.savedTitle")}
              <HelpTip {...chelp("savedNext")} />
            </div>
            {/* SCRUM-286: ehrlicher Status — gespeichert, aber noch offen/nicht validiert. */}
            <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
              {t(captureSavedStatus().badgeKey)}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-trust-pos-text/90">{t("capture.savedBody")}</p>
          {/* SCRUM-354: ehrlich machen — fortgesetzter Entwurf wurde eingereicht und ist aus dem Pool. */}
          {submittedFromDraft ? (
            <p className="mt-1 text-[12px] text-trust-pos-text/80">{t("capture.savedFromDraft")}</p>
          ) : null}
          {/* SCRUM-369: ehrlicher Rescue-Anschluss — nach Validierung beantwortet die Wissensbasis
              die Frage künftig besser; die Lücke wird NICHT automatisch geschlossen. */}
          {savedFromGap ? (
            <p className="mt-1 text-[12px] text-trust-pos-text/80">
              {t(GAP_RESCUE_TEXT.savedNote)}
            </p>
          ) : null}
          {/* SCRUM-373 / AG-02-SESSION: ehrlicher Anschluss — hochgeladene Bilder/Dateien haben jetzt eine
              sichere Objekt-Referenz und sind im KO-Editor als Beleg verlinkbar (Evidence ≠ Validierung). */}
          {savedFilesCount > 0 ? (
            <p className="mt-1 text-[12px] text-trust-pos-text/80">
              {t("capture.savedFilesNote", { count: savedFilesCount })}
            </p>
          ) : null}
          {/* SCRUM-374 / AG-02-SESSION: ehrlicher Teilfehler-Hinweis — das KO ist gespeichert, aber
              einzelne Anhänge nicht. Getrennt vom „gespeichert"-Erfolg, mit klarem nächstem Schritt.
              Kein „alles erfolgreich"-Gefühl bei fehlenden Anhängen. Kein Fake-Link. */}
          {failedAttachments.length > 0 ? (
            <div className="mt-2 rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-2.5">
              <p className="text-[12.5px] font-semibold text-trust-warn-text">
                {t(ATTACHMENT_RECOVERY_KEYS.title)}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-trust-warn-text/90">
                {t(ATTACHMENT_RECOVERY_KEYS.body, {
                  names: failedAttachments.map((f) => f.name).join(", "),
                })}
              </p>
              {/* WP-D2: „zu groß" wird als Grund gesondert benannt (Limit, nicht „irgendein Fehler"). */}
              {failedAttachments.some((f) => f.reason === "too-large") ? (
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-trust-warn-text/90">
                  {t(ATTACHMENT_RECOVERY_KEYS.tooLarge, {
                    name: failedAttachments
                      .filter((f) => f.reason === "too-large")
                      .map((f) => f.name)
                      .join(", "),
                  })}
                </p>
              ) : null}
              <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-trust-warn-text">
                {t(ATTACHMENT_RECOVERY_KEYS.next)}
              </p>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {captureNextSteps(savedKoId).map((s) => (
              <Link
                key={s.to}
                // SCRUM-296: im Demo-Kontext den Capture→Validation→Use-Fluss weitertragen.
                to={demoHref(s.to, params)}
                className={`inline-flex items-center gap-1 rounded-btn px-3 py-1.5 text-[12.5px] font-semibold hover:opacity-90 ${
                  s.primary ? "bg-ink text-white" : "border border-hairline bg-page text-text"
                }`}
              >
                {t(s.labelKey)} <span aria-hidden="true">→</span>
              </Link>
            ))}
            <Button
              variant="ghost"
              onClick={() => {
                setSavedKoId(null);
                setSubmittedFromDraft(false);
                setSavedFromGap(false);
                setSavedFilesCount(0);
                setFailedAttachments([]);
              }}
            >
              {t("capture.savedAgain")}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* SCRUM-263: Startkontext aus einer offenen Wissenslücke — ehrlich: Mensch erfasst, KI strukturiert. */}
      {gapContext ? (
        <Card className="mb-4 border-dashed">
          <div className="text-[12.5px] font-semibold text-text">
            {t("capture.gapContextTitle")}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {t("capture.gapContextBody")}
          </p>
          <p className="mt-1.5 rounded-input bg-page px-2.5 py-1.5 text-[12.5px] text-text">
            „{gapContext}“
          </p>
          {/* SCRUM-369 / AG-12/13: geführter Arbeitsauftrag — Frage → Erfahrung → KI strukturiert → Prüfung.
              Progressive Disclosure, gleiche Schrittfolge wie in der Ask-Lücke (eine Quelle). */}
          <div className="mt-2 border-t border-hairline pt-2">
            <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
              {t("capture.gapStepsTitle")}
            </div>
            <ol className="space-y-1">
              {GAP_RESCUE_STEPS.map((step, i) => (
                <li key={step.id} className="text-[11.5px] leading-relaxed text-muted">
                  <span className="font-semibold text-text">
                    {i + 1}. {t(step.labelKey)}
                  </span>{" "}
                  {t(step.hintKey)}
                </li>
              ))}
            </ol>
          </div>
        </Card>
      ) : null}

      {/* SCRUM-113 / FE-CAP-07: Entwürfe fortsetzen (gemeinsamer Pool mit Mobile) */}
      {draftCount > 0 ? (
        <Card className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SectionLabel>{t("capture.resumeTitle")}</SectionLabel>
              <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2">
                {draftScopeLabel}
              </span>
              <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2">
                {draftCount}
              </span>
            </div>
            <button
              type="button"
              aria-expanded={draftsOpen}
              onClick={() => setDraftsOpen((open) => !open)}
              className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
            >
              {draftsOpen
                ? t("capture.resumeCollapse")
                : t("capture.resumeExpand", { count: draftCount })}
              <ChevronDown
                size={14}
                className={`transition-transform ${draftsOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          {draftsOpen ? (
            <ul className="divide-y divide-hairline">
              {(drafts.data ?? []).map((d) => (
                <li
                  key={d.id}
                  className={`flex flex-col gap-2 py-2 sm:flex-row sm:items-center ${
                    frontDoorDraftSaved?.id === d.id
                      ? "rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg px-2"
                      : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-text">
                      {draftTitle(d, t("capture.draftFallbackTitle"))}
                      {draftId === d.id ? (
                        <span className="ml-2 font-mono text-[10px] uppercase text-ai">
                          {t("capture.editingBadge")}
                        </span>
                      ) : null}
                      {frontDoorDraftSaved?.id === d.id ? (
                        <span className="ml-2 font-mono text-[10px] uppercase text-trust-pos-text">
                          gerade gespeichert
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
                      <span>Ersteller: {draftAuthorName(d, directory.data ?? [])}</span>
                      <span>Gespeichert: {formatDraftTimestamp(d.updatedAt || d.createdAt)}</span>
                      <span>Status: Entwurf</span>
                    </div>
                  </div>
                  {/* Bugfix (Pedi 04.07.): Löschen erst nach Inline-Nachfrage — kein stiller Verlust. */}
                  {confirmDiscardDraftId === d.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-[11.5px] font-semibold text-text">
                        {t("capture.discardDraftQ")}
                      </span>
                      <Button variant="ghost" onClick={() => setConfirmDiscardDraftId(null)}>
                        {t("capture.discardDraftKeep")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={discardDraft.isPending}
                        onClick={() => discardDraft.mutate(d.id)}
                      >
                        {t("capture.discardDraftYes")}
                      </Button>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => loadDraft(d)}
                        className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                      >
                        <RotateCcw size={13} />
                        {t("capture.resume")}
                      </button>
                      <button
                        type="button"
                        title={t("capture.discardDraft")}
                        onClick={() => setConfirmDiscardDraftId(d.id)}
                        className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-btn bg-page px-3 py-2 text-[12px] leading-relaxed text-muted">
              {t("capture.resumeCollapsedHint", { count: draftCount })}
            </p>
          )}
        </Card>
      ) : null}

      {/* SCRUM-384: Die frühere Weg-Leiste (SCRUM-370) entfiel — die „Wissen retten“-
          Einführung oben erklärt denselben Dreischritt; Doppel-Blöcke erschlagen (Pedi-Review). */}
      <div ref={workAreaRef} className="scroll-mt-4" />

      {/* SCRUM-384 / AG-12 / KG-UX-001/002/003/010: Erzähl-Einstieg als Standardweg — die Erzähl-Modi
          (Freitext · Diktat · Interview) führen in den Studio-Hauptweg; das klassische Formular bleibt
          als bewusst wählbarer Expertenpfad erhalten (progressive disclosure, NICHTS entfernt). */}
      {/* SCRUM-384: sichtbare Schritt-Leiste des Wizards (Erzählen → Wissensseite → Einreichen);
          fertige Schritte sind anklickbar — vor und zurück ohne Datenverlust. */}
      {captureWorkspaceOpen && !expertView ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {chips.map((c, i) => {
            const clickable =
              (c.id === "raw" && wizStep !== "tell") ||
              (c.id === "studio" && draft !== null && wizStep !== "refine");
            return (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                {i > 0 ? (
                  <span aria-hidden="true" className="text-[11px] text-muted-2">
                    →
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => setWizStep(c.id === "studio" ? "refine" : "tell")}
                  className={`rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ${
                    c.state === "active"
                      ? "bg-ink text-white"
                      : c.state === "done"
                        ? "border border-hairline text-text"
                        : "border border-hairline text-muted-2"
                  } ${clickable ? "hover:text-text" : ""}`}
                >
                  {i + 1} · {t(c.labelKey)}
                </button>
              </span>
            );
          })}
          <HelpTip {...chelp("wizardSteps")} />
        </div>
      ) : null}

      {/* Erzähl-Einstieg nur im Schritt „Erzählen" (bzw. immer im Expertenmodus). */}
      {captureWorkspaceOpen && (expertView || wizStep === "tell") ? (
        <div className="mb-4">
          <div
            data-help="cap:modes"
            className="mb-1.5 flex items-center gap-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2"
          >
            {t(CAPTURE_ENTRY_TEXT.narrateKicker)}
            <HelpTip {...chelp("modes")} />
          </div>
          {/* SCRUM-458: Sobald „Weitere Wege" aufgeklappt ist, zeigt diese Leiste ALLE Erzähl-Modi
              (Freitext · Diktat · Interview · Aus Datei) dauerhaft und direkt, plus den Expertenformular-
              Umschalter — keine zweite Aufklapp-Ebene mehr. Reine Sichtbarkeit — switchMode/Funktionen
              sind unverändert. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {NARRATE_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                title={
                  m === "diktat" && !speechSupported ? t("capture.diktatUnsupported") : undefined
                }
                className={`rounded-btn px-3 py-1.5 text-[13px] font-semibold ${
                  mode === m
                    ? "bg-ink text-white"
                    : "border border-hairline text-muted hover:text-text"
                }`}
              >
                {t(`capture.mode.${m}`)}
                {m === "diktat" && !speechSupported ? (
                  <span className="ml-1 text-[11px] opacity-70">·{t("capture.diktatNa")}</span>
                ) : null}
              </button>
            ))}
            {/* Bug (Pedi 04.07./05.07.): Expertenmodus als DAUERHAFT sichtbarer Umschalter in der
                Leiste (vorher verschwand der Knopf nach dem Aktivieren). Aktiv = hervorgehoben wie
                die anderen Modus-Knöpfe; erneuter Klick führt zurück auf den geführten Weg. */}
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => switchMode(isExpertMode(mode) ? "freitext" : EXPERT_MODE)}
                title={t(CAPTURE_ENTRY_TEXT.expertHint)}
                aria-pressed={isExpertMode(mode)}
                className={`rounded-btn border px-3 py-1.5 text-[13px] font-semibold ${
                  isExpertMode(mode)
                    ? "border-ink bg-ink text-white"
                    : "border-dashed border-hairline text-muted hover:border-ink/30 hover:text-text"
                }`}
              >
                {t(CAPTURE_ENTRY_TEXT.expertToggle)}
              </button>
              <HelpTip {...chelp("expertPath")} />
            </span>
          </div>
          {/* Im Expertenmodus: ehrliche Einordnung + sichtbarer Rückweg auf den geführten Standardweg. */}
          {isExpertMode(mode) ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-surface px-3 py-2">
              <span className="text-[12px] text-muted">{t(CAPTURE_ENTRY_TEXT.expertActive)}</span>
              <button
                type="button"
                onClick={() => switchMode("freitext")}
                className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
              >
                {t(CAPTURE_ENTRY_TEXT.backToGuided)}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* SCRUM-384: Wizard — genau EIN Fokus je Schritt (nichts entfernt).
          Pedi 04.07.: Expertenmodus war zweispaltig mit leerer linker Hälfte und ins rechte
          Drittel gequetschtem Formular. Jetzt EINE zentrierte, volle Spalte — das Formular zuerst
          (order-first), darunter die optionalen Details und die Aktionen. Ruhig und lesbar. */}
      <div
        id="capture-workspace"
        aria-hidden={!captureWorkspaceOpen}
        className={
          captureWorkspaceOpen
            ? expertView
              ? "mx-auto flex max-w-3xl flex-col gap-5"
              : wizStep === "refine"
                ? "mx-auto max-w-4xl"
                : "mx-auto max-w-3xl"
            : "hidden"
        }
      >
        {expertView || wizStep === "tell" ? (
          <Card className="space-y-4">
            {/* Aufräum-Pass 02.07. (Pedi): Autor/Wissensart aus dem Kopf in „Erweiterte Details" —
                Schritt 1 ist nur noch Erzählen + ein Knopf. Autor ist ohnehin read-only, die
                Wissensart bleibt in den Details jederzeit änderbar. */}

            {/* Modus-spezifische Eingabe */}
            {mode === "freitext" || mode === "diktat" ? (
              <div data-help="cap:tellRaw">
                <div className="mb-1.5 flex items-center gap-1">
                  <SectionLabel>{t("capture.raw")}</SectionLabel>
                  <HelpTip {...chelp("tellRaw")} />
                </div>
                {mode === "diktat" ? (
                  speechSupported ? (
                    <div className="mb-2 flex items-center gap-1">
                      <Button variant={listening ? "primary" : "ghost"} onClick={toggleDictation}>
                        <Mic size={15} />
                        {listening ? t("capture.diktatStop") : t("capture.diktatStart")}
                      </Button>
                      <HelpTip {...chelp("dictate")} />
                    </div>
                  ) : (
                    <p className="mb-2 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
                      {t("capture.diktatUnsupported")}
                    </p>
                  )
                ) : null}
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={7}
                  placeholder={t("capture.rawPlaceholder")}
                  className={textareaCls}
                />
                {/* Pedi 02.07. (Runde 5): Upload direkt beim Erzählen — Text aus Dokumenten (PDF/Word/
                    Text) fließt sofort in den Freitext, Bilder/Videos werden Anhang (PMO-FEA-0006-Anschluss). */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
                    <FileText size={14} />
                    {t(CAPTURE_WIZARD_TEXT.upload)}
                    <input
                      type="file"
                      multiple
                      accept={FILE_CAPTURE_ACCEPT}
                      className="hidden"
                      onChange={(e) => void onDocs(e)}
                    />
                  </label>
                  {/* Pedi 04.07.: eigener „beifügen"-Knopf gleich daneben — Datei/Bild NUR anhängen. */}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
                    <Paperclip size={14} />
                    {t(CAPTURE_WIZARD_TEXT.attach)}
                    <input
                      type="file"
                      multiple
                      accept={FILE_CAPTURE_ACCEPT}
                      className="hidden"
                      onChange={(e) => void onAttach(e)}
                    />
                  </label>
                  <HelpTip {...chelp("tellUpload")} />
                  {images.length + docs.length > 0 ? (
                    <span className="text-[11.5px] text-muted-2">
                      {t(CAPTURE_WIZARD_TEXT.uploadCount, { count: images.length + docs.length })}
                    </span>
                  ) : null}
                </div>
                {/* SCRUM-312: sichtbare KI-Nachbearbeitung mit Vorschau + bewusster Übernahme.
                  SCRUM-384: im Wizard erst auf der Wissensseite (EINE KI-Palette je Schritt);
                  im Expertenmodus wie gehabt direkt am Rohtext. */}
                {expertView ? (
                  <AiAssistBox text={raw} runAssist={runAssist} onApply={setRaw} />
                ) : null}
                <div className="mt-3 flex items-center gap-1">
                  <Button
                    variant="primary"
                    disabled={raw.trim().length === 0 || structure.isPending}
                    onClick={() => structure.mutate()}
                  >
                    <Sparkles size={15} />
                    {structure.isPending
                      ? t(CAPTURE_WIZARD_TEXT.structuring)
                      : t("capture.structure")}
                  </Button>
                  {/* Pedi 04.07.: (!)-Info — welche KI das Strukturieren ausführt. */}
                  <AiModelInfo task="structure" />
                  <HelpTip {...chelp("structureNow")} />
                </div>
              </div>
            ) : null}

            {mode === "formular" ? (
              <div className="flex items-start gap-1.5 rounded-card border border-dashed border-hairline p-3 text-[13px] text-muted">
                <span className="flex-1">{t("capture.formularHint")}</span>
                <HelpTip {...chelp("expertForm")} />
              </div>
            ) : null}

            {mode === "interview" ? (
              ivResult && isInterviewDone(ivResult) ? (
                <p className="rounded-card border border-dashed border-hairline p-3 text-[13px] text-trust-pos-text">
                  {t("capture.ivDone")}
                </p>
              ) : (
                <div data-help="cap:interview" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-2">
                      {t("capture.ivTurn", { n: ivAnswers.length + 1 })}
                    </span>
                    <HelpTip {...chelp("interview")} />
                    {ivResult ? (
                      <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
                        {t(interviewSourceKey(ivResult))}
                      </span>
                    ) : null}
                  </div>
                  {/* SCRUM-403 (Pedi 03.07.): Frage vorlesen + Antwort diktieren — Sprache in
                      beide Richtungen; Knöpfe nur, wenn der Browser es ehrlich kann. */}
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-[14px] font-medium text-text">
                      {interview.isPending
                        ? t("capture.ivThinking")
                        : (ivResult?.question ?? t("capture.ivThinking"))}
                    </p>
                    {ttsSupported && ivResult && !interview.isPending ? (
                      <Button
                        variant={ivReading ? "primary" : "ghost"}
                        onClick={toggleReadQuestion}
                        title={ivReading ? t("capture.ivReadStop") : t("capture.ivReadAloud")}
                      >
                        <Volume2 size={15} />
                        {ivReading ? t("capture.ivReadStop") : t("capture.ivReadAloud")}
                      </Button>
                    ) : null}
                  </div>
                  <textarea
                    value={ivAnswer}
                    onChange={(e) => setIvAnswer(e.target.value)}
                    rows={2}
                    placeholder={t("capture.ivAnswerHint")}
                    className={textareaCls}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      disabled={interview.isPending || ivAnswer.trim().length === 0 || !ivResult}
                      onClick={ivSend}
                    >
                      {t("capture.ivSend")}
                    </Button>
                    {/* Pedi 04.07.: (!)-Info — welche KI das geführte Interview steuert. */}
                    <AiModelInfo task="interview" />
                    {speechSupported ? (
                      <Button
                        variant={ivListening ? "primary" : "ghost"}
                        onClick={toggleIvDictation}
                        disabled={interview.isPending || !ivResult}
                      >
                        <Mic size={15} />
                        {ivListening ? t("capture.diktatStop") : t("capture.diktatStart")}
                      </Button>
                    ) : (
                      <span className="text-[12px] text-muted-2">{t("capture.ivDictNa")}</span>
                    )}
                  </div>
                </div>
              )
            ) : null}

            {/* PMO-FEA-0006: Erzähl-Modus „Aus Datei" — Dokument hochladen, optional sagen wonach
                gesucht wird, KI-Punkteliste mit Belegstellen prüfen, Ausgewählte übernehmen.
                EIN Fokus je Schritt: Upload → (Suchauftrag) → Punkteliste → Warteschlange. */}
            {mode === "datei" ? (
              <div className="space-y-3">
                <div className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
                  <span className="flex-1">{t(CAPTURE_FILE_TEXT.hint)}</span>
                  <HelpTip {...chelp("filePoints")} />
                </div>
                <div>
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">
                    {t(CAPTURE_FILE_TEXT.importModeLabel)}
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["points", "whole"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={fileImportMode === option}
                        onClick={() => setFileImportMode(option)}
                        className={`rounded-card border px-3 py-2 text-left transition-colors ${
                          fileImportMode === option
                            ? "border-ink/30 bg-surface text-text"
                            : "border-hairline bg-page text-muted hover:text-text"
                        }`}
                      >
                        <span className="block text-[12.5px] font-semibold">
                          {t(
                            option === "points"
                              ? CAPTURE_FILE_TEXT.importModePoints
                              : CAPTURE_FILE_TEXT.importModeWhole,
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-2">
                          {t(
                            option === "points"
                              ? CAPTURE_FILE_TEXT.importModePointsDesc
                              : CAPTURE_FILE_TEXT.importModeWholeDesc,
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-card border border-hairline bg-page px-3 py-2">
                  <div className="text-[12.5px] font-semibold text-text">
                    {t(CAPTURE_FILE_TEXT.formatTitle)}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                    {t(CAPTURE_FILE_TEXT.formatHint)}
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                    <strong>{t(CAPTURE_FILE_TEXT.supportedTitle)}</strong>{" "}
                    {t(CAPTURE_FILE_TEXT.supportedFormats)}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-2">
                    {t(CAPTURE_FILE_TEXT.unsupportedFormats)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
                    <Paperclip size={14} />
                    {fileName ? t(CAPTURE_FILE_TEXT.replace) : t(CAPTURE_FILE_TEXT.upload)}
                    <input
                      type="file"
                      accept={FILE_IMPORT_ACCEPT}
                      className="hidden"
                      onChange={(e) => void onExtractFile(e)}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    disabled={
                      fileBusy || extract.isPending || fileWholeDraft.isPending || ocrBusy !== null
                    }
                    onClick={cancelFileImport}
                  >
                    <X size={14} />
                    {t(CAPTURE_FILE_TEXT.cancel)}
                  </Button>
                  {fileName ? (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text">
                      <FileText size={13} className="text-muted-2" />
                      {fileName}
                    </span>
                  ) : null}
                </div>
                {/* Bild als OCR-Kandidat: Texterkennung NUR auf Klick (SCRUM-123-Muster). */}
                {fileImageUrl && !fileText ? (
                  <Button
                    variant="ghost"
                    disabled={ocrBusy !== null}
                    onClick={() => void onExtractOcr()}
                  >
                    {ocrBusy ? t(CAPTURE_FILE_TEXT.ocrBusy) : t(CAPTURE_FILE_TEXT.ocrCta)}
                  </Button>
                ) : null}
                {fileWholeDraftSaved ? (
                  <div className="rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[12.5px] font-semibold text-trust-pos-text">
                        {t(CAPTURE_FILE_TEXT.wholeSavedTitle)}
                      </div>
                      <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-pos-text">
                        Frontdoor bereit
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-trust-pos-text/90">
                      <strong>{fileWholeDraftSaved.title}</strong> ·{" "}
                      {t(CAPTURE_FILE_TEXT.wholeSavedSource, {
                        name: fileWholeDraftSaved.fileName,
                      })}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {fileWholeDraftSaved.id ? (
                        <Link
                          to={`${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(fileWholeDraftSaved.id)}`}
                          className="inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
                        >
                          {t(CAPTURE_FILE_TEXT.wholeOpenDraft)} <span aria-hidden="true">→</span>
                        </Link>
                      ) : (
                        <p className="rounded-btn bg-trust-warn-bg px-3 py-1.5 text-[12.5px] font-semibold text-trust-warn-text">
                          {t(CAPTURE_FILE_TEXT.wholeOpenMissing)}
                        </p>
                      )}
                      <Button variant="ghost" onClick={() => setFileWholeDraftSaved(null)}>
                        {t(CAPTURE_FILE_TEXT.wholeImportAnother)}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {fileText ? (
                  <div className="space-y-3">
                    {fileImportMode === "points" ? (
                      <div>
                        <span className="mb-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-muted">
                          {t(CAPTURE_FILE_TEXT.queryLabel)}
                          <HelpTip
                            title={t(CAPTURE_FILE_TEXT.queryHelpTitle)}
                            body={t(CAPTURE_FILE_TEXT.queryHelpBody)}
                          />
                        </span>
                        <TextInput
                          value={fileQuery}
                          onChange={(e) => setFileQuery(e.target.value)}
                          placeholder={t(CAPTURE_FILE_TEXT.queryPlaceholder)}
                        />
                        {/* SCRUM-451 (Pedi 05.07.): Ergebnis-Sprache — Systemsprache oder Original. */}
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-muted">
                            {t(CAPTURE_FILE_TEXT.langLabel)}
                            <HelpTip
                              title={t(CAPTURE_FILE_TEXT.langHelpTitle)}
                              body={t(CAPTURE_FILE_TEXT.langHelpBody)}
                            />
                          </span>
                          <div className="flex overflow-hidden rounded-pill border border-hairline text-[12px] font-semibold">
                            {(["system", "source"] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setFileLang(mode)}
                                className={`px-2.5 py-1 transition-colors ${
                                  fileLang === mode
                                    ? "bg-ink text-white"
                                    : "text-muted hover:text-text"
                                }`}
                              >
                                {t(
                                  mode === "system"
                                    ? CAPTURE_FILE_TEXT.langSystem
                                    : CAPTURE_FILE_TEXT.langSource,
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <Button
                            variant="primary"
                            disabled={extract.isPending || fileBusy}
                            onClick={() => extract.mutate()}
                          >
                            {/* SCRUM-418: sichtbare Arbeits-Animation, solange die KI liest. */}
                            {extract.isPending ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Sparkles size={15} />
                            )}
                            {extract.isPending
                              ? t(CAPTURE_FILE_TEXT.searching)
                              : t(CAPTURE_FILE_TEXT.searchCta)}
                          </Button>
                          {/* Pedi 04.07.: (!)-Info — welche KI die Extraktion ausführt. */}
                          <AiModelInfo task="extract" />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-card border border-hairline bg-page px-3 py-2">
                        <p className="text-[12px] leading-relaxed text-muted">
                          {t(CAPTURE_FILE_TEXT.wholeSourceNote, { name: fileName })}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button
                            variant="primary"
                            disabled={
                              fileWholeDraft.isPending ||
                              fileBusy ||
                              !fileName ||
                              fileText.trim().length === 0
                            }
                            onClick={() => {
                              if (!fileName) {
                                return;
                              }
                              fileWholeDraft.mutate({
                                fileName,
                                text: fileText,
                                ...(fileRich?.html ? { html: fileRich.html } : {}),
                                ...(fileRich ? { sourceKind: fileRich.kind } : {}),
                              });
                            }}
                          >
                            {fileWholeDraft.isPending ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Save size={15} />
                            )}
                            {fileWholeDraft.isPending
                              ? t(CAPTURE_FILE_TEXT.wholeSaving)
                              : t(CAPTURE_FILE_TEXT.wholeCta)}
                          </Button>
                          <span className="text-[11.5px] leading-relaxed text-muted-2">
                            {t(CAPTURE_FILE_TEXT.importModeWholeDesc)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
                {/* Ehrlicher Hinweis vom Server (z. B. „ohne Modell keine Extraktion") — KEINE Fake-Punkte. */}
                {fileNote ? (
                  <p className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
                    {fileNote}
                  </p>
                ) : null}
                {fileImportMode === "points" && filePoints && filePoints.length > 0 ? (
                  <div className="space-y-2 border-t border-hairline pt-3">
                    <SectionLabel>{t(CAPTURE_FILE_TEXT.pointsTitle)}</SectionLabel>
                    <p className="text-[11.5px] leading-relaxed text-muted-2">
                      {t(CAPTURE_FILE_TEXT.pointsHint)}
                    </p>
                    {/* Pedi 04.07.: Alle auswählen / alle abwählen (wichtig bei vielen Funden). */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setFilePoints((pts) => (pts ? setAllSelected(pts, true) : pts))
                        }
                        className="text-[11.5px] font-semibold text-ai hover:underline"
                      >
                        {t(CAPTURE_FILE_TEXT.selectAll)}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFilePoints((pts) => (pts ? setAllSelected(pts, false) : pts))
                        }
                        className="text-[11.5px] font-semibold text-muted hover:text-text"
                      >
                        {t(CAPTURE_FILE_TEXT.deselectAll)}
                      </button>
                    </div>
                    <ul className="space-y-2">
                      {filePoints.map((p) => (
                        <li
                          key={p.id}
                          className={`rounded-card border p-3 ${
                            p.selected
                              ? "border-ink/25 bg-surface"
                              : "border-hairline bg-page opacity-70"
                          }`}
                        >
                          <label className="flex cursor-pointer items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={p.selected}
                              onChange={() =>
                                setFilePoints((pts) => (pts ? togglePoint(pts, p.id) : pts))
                              }
                              className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13.5px] font-semibold text-text">
                                {p.title}
                              </span>
                              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">
                                {p.summary}
                              </span>
                              <span className="mt-1.5 block rounded-input bg-page px-2.5 py-1.5 text-[11.5px] leading-relaxed text-muted-2">
                                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider">
                                  {t(CAPTURE_FILE_TEXT.excerptLabel)}
                                  {fileName ? ` · ${fileName}` : ""}
                                </span>
                                <span className="mt-0.5 block italic">„{p.sourceExcerpt}“</span>
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="space-y-2 border-t border-hairline pt-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[11.5px] text-muted-2">
                          {t(CAPTURE_FILE_TEXT.pointCount, {
                            selected: selectedCount(filePoints),
                            total: filePoints.length,
                          })}
                        </span>
                        {/* SCRUM-433 (Pedi 03.07., VIP): die drei Wege sind jetzt immer sichtbar
                            erklärt — mehrere Erkenntnisse aus dem Dokument zu EINEM Eintrag
                            verbinden, einzeln als Entwürfe sichern oder direkt übernehmen. */}
                        <span className="text-[11px] leading-relaxed text-muted-2">
                          {t(CAPTURE_FILE_TEXT.connectHint)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* SCRUM-433: „Verbinden" immer sichtbar (auffindbar), erst ab 2 Ausgewählten
                            aktiv — der Kernwunsch: Erkenntnisse aus dem Dokument zusammenführen. */}
                        <Button
                          variant="outline"
                          disabled={selectedCount(filePoints) < 2}
                          title={t(CAPTURE_FILE_TEXT.connectDisabledHint)}
                          onClick={mergeSelectedPoints}
                        >
                          {t(CAPTURE_FILE_TEXT.mergeCta)}
                        </Button>
                        {/* SCRUM-435: ausgewählte Erkenntnis(se) an einen bestehenden Artikel
                            anhängen (ab 1 Ausgewähltem) — Artikel-Picker, Übernahme via revise + add-source. */}
                        <Button
                          variant="outline"
                          disabled={selectedCount(filePoints) < 1}
                          onClick={requestAppendToArticle}
                        >
                          {t("xtr.append.button")}
                        </Button>
                        {/* SCRUM-409 / Pedi 04.07.: ab 2 Ausgewählten als getrennte Entwürfe sichern —
                            mit Nachfrage, ob nicht ausgewählte Punkte gelöscht werden sollen. */}
                        {selectedCount(filePoints) >= 2 ? (
                          <Button
                            variant="ghost"
                            disabled={filePointDrafts.isPending}
                            onClick={requestSaveDrafts}
                          >
                            {t(CAPTURE_FILE_TEXT.saveDraftsCta)} ({selectedCount(filePoints)})
                          </Button>
                        ) : null}
                        {/* Pedi 04.07.: „übernehmen" verarbeitet GENAU EINEN Punkt weiter — bei
                            mehreren Ausgewählten blockiert (erst verbinden oder als Entwürfe sichern). */}
                        <Button
                          variant="primary"
                          className="ml-auto"
                          disabled={selectedCount(filePoints) !== 1}
                          title={t(CAPTURE_FILE_TEXT.applyDisabledHint)}
                          onClick={applySelectedPoints}
                        >
                          {t(CAPTURE_FILE_TEXT.applyCta)} ({selectedCount(filePoints)}) →
                        </Button>
                      </div>
                      {confirmSaveDrafts ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-page px-3 py-2">
                          <span className="text-[12px] text-text">
                            {t(CAPTURE_FILE_TEXT.purgeUnselectedQ, {
                              count: filePoints.length - selectedCount(filePoints),
                            })}
                          </span>
                          <button
                            type="button"
                            className="ml-auto text-[12px] font-semibold text-muted hover:text-text"
                            onClick={() => doSaveDrafts(false)}
                          >
                            {t(CAPTURE_FILE_TEXT.purgeUnselectedKeep)}
                          </button>
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-trust-crit-text"
                            onClick={() => doSaveDrafts(true)}
                          >
                            {t(CAPTURE_FILE_TEXT.purgeUnselectedYes)}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* SCRUM-375 / AG-12: erweiterte/technische Felder als Progressive Disclosure — standardmäßig
              eingeklappt, damit „Wissen erzählen → im Studio strukturieren" führt. NICHTS entfernt; bei
              vorhandenem Inhalt (Entwurf/Beispiel) automatisch aufgeklappt; Badge zeigt Ausgefülltes an. */}
            <div className="border-t border-hairline pt-4">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-expanded={showAdvanced}
                  onClick={() => setShowAdvanced((s) => !s)}
                  className="flex flex-1 items-center justify-between gap-2 text-left"
                >
                  <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-text">
                    {t(ADVANCED_FIELDS_KEYS.title)}
                    {advancedSummary.filledCount > 0 ? (
                      <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted-2">
                        {t(ADVANCED_FIELDS_KEYS.filled, { count: advancedSummary.filledCount })}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-muted-2 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  />
                </button>
                <HelpTip {...chelp("advancedDetails")} />
              </div>
              {!showAdvanced ? (
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-2">
                  {t(ADVANCED_FIELDS_KEYS.hint)}
                </p>
              ) : null}
            </div>

            {showAdvanced ? (
              <>
                {/* Metadaten (Autor/Wissensart hier seit Aufräum-Pass 02.07.) */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("capture.author")}>
                    <div className="flex h-10 items-center rounded-input border border-hairline bg-page px-3 text-sm text-muted">
                      {authorName}
                    </div>
                  </Field>
                  <Field
                    label={
                      <span
                        data-help="cap:knowledgeType"
                        className="inline-flex items-center gap-1"
                      >
                        {t("capture.fType")}
                        <HelpTip {...chelp("knowledgeType")} />
                      </span>
                    }
                  >
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as KnowledgeType)}
                      className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
                    >
                      {KNOWLEDGE_TYPES.map((k) => (
                        <option key={k} value={k}>
                          {t(`ktype.${k}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={
                      <span className="inline-flex items-center gap-1">
                        {t("capture.fCategory")}
                        <HelpTip
                          title={t("capture.help.category.title")}
                          body={t("capture.help.category.body")}
                        />
                      </span>
                    }
                  >
                    <TextInput value={category} onChange={(e) => setCategory(e.target.value)} />
                  </Field>
                  <Field
                    label={
                      <span className="inline-flex items-center gap-1">
                        {t("capture.fRevalidation")}
                        <HelpTip
                          title={t("capture.help.validations.title")}
                          body={t("capture.help.validations.body")}
                        />
                      </span>
                    }
                  >
                    <TextInput
                      type="number"
                      min={1}
                      max={5}
                      value={neededValidations}
                      onChange={(e) => setNeededValidations(e.target.value)}
                      // SCRUM-395: leer = Admin-Standard gilt; der Platzhalter zeigt ihn ehrlich an.
                      placeholder={t("capture.reviewers.defaultPlaceholder", { n: defaultNeeded })}
                    />
                  </Field>
                  <Field
                    label={
                      <span className="inline-flex items-center gap-1">
                        {t("capture.fAsset")}
                        <HelpTip {...chelp("assetField")} />
                      </span>
                    }
                  >
                    <TextInput value={asset} onChange={(e) => setAsset(e.target.value)} />
                  </Field>
                  {/* SCRUM-415: Vertraulichkeitsstufe ab Erfassen (Standard „intern"). Vertrauliche
                      KOs gehen nie in externe Kontexte (Output/Export). */}
                  <Field
                    label={
                      <span className="inline-flex items-center gap-1">
                        {t("conf.field")}
                        <HelpTip title={t("conf.field")} body={t("conf.help")} />
                      </span>
                    }
                  >
                    <select
                      value={confidentiality}
                      onChange={(e) => setConfidentiality(e.target.value as Confidentiality)}
                      aria-label={t("conf.field")}
                      className="h-9 w-full rounded-input border border-hairline bg-surface px-2 text-[13px] text-text"
                    >
                      {CONFIDENTIALITY_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {t(`conf.level.${lvl}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div data-help="cap:tagsField">
                    <TagEditor tags={tags} onChange={setTags} />
                    <div className="mt-1">
                      <HelpTip {...chelp("tagsField")} />
                    </div>
                  </div>
                </div>

                {/* SCRUM-395: Prüfer direkt beim Einreichen vorschlagen (optional). */}
                <div className="rounded-card border border-dashed border-hairline p-3">
                  <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                    {t("capture.reviewers.title")}
                    <HelpTip
                      title={t("capture.reviewers.helpTitle")}
                      body={t("capture.reviewers.helpBody")}
                    />
                  </div>
                  {reviewerChoices.length === 0 ? (
                    <div className="text-[12px] text-muted-2">{t("capture.reviewers.none")}</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {reviewerChoices.map((p) => {
                        const active = reviewerIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleReviewer(p.id)}
                            aria-pressed={active}
                            className={
                              active
                                ? "rounded-btn border border-ink bg-ink px-2.5 py-1 text-[12px] font-semibold text-white"
                                : "rounded-btn border border-hairline px-2.5 py-1 text-[12px] text-muted hover:text-text"
                            }
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {reviewerIds.length > 0 ? (
                    <div className="mt-1.5 text-[11.5px] text-muted-2">
                      {t("capture.reviewers.selected", { n: reviewerIds.length })}
                    </div>
                  ) : null}
                </div>

                {/* Dokumente */}
                <div className="rounded-card border border-dashed border-hairline p-3">
                  <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                    <FileText size={13} />
                    {t("capture.documents")}
                    <HelpTip {...chelp("docsImages")} />
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
                    {t("capture.documentsUpload")}
                    <input
                      type="file"
                      multiple
                      accept={FILE_CAPTURE_ACCEPT}
                      className="hidden"
                      onChange={(e) => void onDocs(e)}
                    />
                  </label>
                  <span className="ml-2 text-[11.5px] text-muted-2">
                    {t("capture.documentsHint")}
                  </span>
                  {/* SCRUM-421: geltende Upload-Grenzen ehrlich anzeigen (aus der Admin-Einstellung). */}
                  <p className="mt-1 text-[11px] text-muted-2">
                    {t("capture.uploadLimits", {
                      count: uploadLimitsData.maxAttachments,
                      mb: Math.round((uploadLimitsData.maxAttachmentBytes / 1_000_000) * 10) / 10,
                    })}
                  </p>
                  {docs.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {docs.map((d) => (
                        <li key={d.id} className="flex items-center gap-2 text-[12.5px] text-text">
                          <FileText size={12} className="text-muted-2" />
                          <span className="truncate">{d.name}</span>
                          {d.mime.startsWith("video/") || d.mime.startsWith("audio/") ? (
                            <button
                              type="button"
                              disabled={videoBusy !== null}
                              onClick={() => void onTranscribe(d)}
                              className="rounded-btn border border-hairline px-1.5 py-0.5 text-[10.5px] font-semibold text-muted hover:text-text disabled:opacity-50"
                            >
                              {videoBusy === d.id
                                ? t("capture.videoBusy")
                                : t("capture.videoTranscribe")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            aria-label={t("capture.listRemove")}
                            onClick={() => setDocs((arr) => arr.filter((x) => x.id !== d.id))}
                            className="ml-auto text-muted-2 hover:text-text"
                          >
                            <X size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {/* Bilder */}
                <div className="rounded-card border border-dashed border-hairline p-3">
                  <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                    <Paperclip size={13} />
                    {t("capture.images")}
                    <HelpTip {...chelp("docsImages")} />
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
                    {t("capture.imagesUpload")}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void onImages(e)}
                    />
                  </label>
                  <span className="ml-2 text-[11.5px] text-muted-2">{t("capture.imagesHint")}</span>
                  {images.length > 0 ? (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {images.map((img) => (
                        <div key={img.id} className="group relative">
                          <img
                            src={img.dataUrl}
                            alt={img.name}
                            className="h-16 w-full rounded-card border border-hairline object-cover"
                          />
                          <button
                            type="button"
                            aria-label={t("capture.listRemove")}
                            onClick={() => setImages((arr) => arr.filter((x) => x.id !== img.id))}
                            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-white opacity-0 group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                          {/* SCRUM-123: OCR nur auf Klick, mit sichtbarem Lade-/Fehlerstatus */}
                          <button
                            type="button"
                            disabled={ocrBusy === img.id}
                            onClick={() => void onOcr(img)}
                            className="absolute inset-x-1 bottom-1 truncate rounded-btn bg-ink/70 px-1 py-0.5 text-center text-[9.5px] font-semibold text-white opacity-0 group-hover:opacity-100 disabled:opacity-100"
                          >
                            {ocrBusy === img.id ? t("capture.ocrRunningShort") : t("capture.ocr")}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* SCRUM-408: Externe Quellen schon beim Erfassen — dasselbe Panel-Muster wie im
                    Prüfbereich (SCRUM-118/129): Formular (Bezeichnung/URL/Auszug) + Server-Proxy-
                    Suche. Beim Erfassen existiert das KO noch nicht → sichtbare Warteliste;
                    angehängt wird beim Einreichen. Stufe 2, nie peer-validiert, nichts automatisch. */}
                {canSources ? (
                  <div className="rounded-card border border-dashed border-hairline p-3">
                    <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                      <Globe size={13} />
                      {t("capture.sourcesTitle")}
                      <HelpTip {...chelp("sourcesPanel")} />
                    </div>
                    <p className="mb-2 text-[11.5px] leading-relaxed text-muted-2">
                      {t("capture.sourcesHint")}
                    </p>
                    {pendingSources.length > 0 ? (
                      <ul className="mb-2 space-y-1.5">
                        {pendingSources.map((s, i) => (
                          <li
                            key={`${s.label}-${s.url ?? i}`}
                            className="rounded-input bg-page p-2.5"
                          >
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[13px] font-medium text-text">
                                    {s.label}
                                  </span>
                                  <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                                    {t("ko.sourceUnvalidated")}
                                  </span>
                                  {s.provider ? (
                                    <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted">
                                      {s.provider}
                                    </span>
                                  ) : null}
                                </div>
                                {s.url ? (
                                  <span className="block truncate font-mono text-[11px] text-ai">
                                    {s.url}
                                  </span>
                                ) : null}
                                {s.excerpt ? (
                                  <p className="mt-1 text-[12px] text-muted">{s.excerpt}</p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                title={t("ko.sourceRemove")}
                                onClick={() =>
                                  setPendingSources((list) => removePendingSource(list, i))
                                }
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="space-y-2">
                      <TextInput
                        value={sourceForm.label}
                        onChange={(e) => setSourceForm((s) => ({ ...s, label: e.target.value }))}
                        placeholder={t("ko.sourceLabel")}
                      />
                      <TextInput
                        value={sourceForm.url}
                        onChange={(e) => setSourceForm((s) => ({ ...s, url: e.target.value }))}
                        placeholder={t("ko.sourceUrl")}
                      />
                      <TextInput
                        value={sourceForm.excerpt}
                        onChange={(e) => setSourceForm((s) => ({ ...s, excerpt: e.target.value }))}
                        placeholder={t("ko.sourceExcerpt")}
                      />
                      <p className="text-[11.5px] text-muted-2">{t("ko.sourcesHint")}</p>
                      <Button
                        variant="ghost"
                        disabled={!isSourceFormValid(sourceForm)}
                        onClick={() => {
                          setPendingSources((list) =>
                            addPendingSource(list, pendingFromForm(sourceForm)),
                          );
                          setSourceForm({ ...EMPTY_SOURCE_FORM });
                        }}
                      >
                        {t("ko.sourceAdd")}
                      </Button>
                    </div>
                    {/* SCRUM-118 / FR-EXT-02: externe Quellensuche (Server-Proxy) — wie im Prüfbereich.
                        SCRUM-414: nur sichtbar, wenn der Admin-Regler die externe Wissensabfrage
                        nicht komplett blockiert (der Server setzt die Sperre zusätzlich durch). */}
                    {extPolicyStage !== "blocked" ? (
                      <div className="mt-3 space-y-2 border-t border-hairline pt-3">
                        <SectionLabel>{t("ext.title")}</SectionLabel>
                        <p className="text-[11.5px] text-muted-2">{t("ext.hint")}</p>
                        <form
                          className="flex gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (extQuery.trim()) {
                              extSearch.mutate(extQuery.trim());
                            }
                          }}
                        >
                          <TextInput
                            value={extQuery}
                            onChange={(e) => setExtQuery(e.target.value)}
                            placeholder={t("ext.placeholder")}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            disabled={extSearch.isPending || extQuery.trim().length === 0}
                          >
                            {t("ext.search")}
                          </Button>
                        </form>
                        {extResults.length > 0 ? (
                          <ul className="space-y-1.5">
                            {extResults.map((r) => (
                              <li
                                key={r.url}
                                className="rounded-input border border-hairline p-2.5"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[13px] font-medium text-text">
                                        {r.title}
                                      </span>
                                      <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
                                        {r.provider}
                                      </span>
                                    </div>
                                    {r.snippet ? (
                                      <p className="mt-0.5 text-[11.5px] text-muted">{r.snippet}</p>
                                    ) : null}
                                    <ExternalUrlText
                                      url={r.url}
                                      className="block truncate font-mono text-[10.5px] text-ai hover:underline"
                                    />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    onClick={() =>
                                      setPendingSources((list) =>
                                        addPendingSource(list, pendingFromResult(r)),
                                      )
                                    }
                                  >
                                    {t("ext.attach")}
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {err ? (
              <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                {err}
              </div>
            ) : null}
            {notice ? (
              <div className="rounded-btn bg-trust-pos-bg px-3 py-2 text-[12.5px] text-trust-pos-text">
                {notice}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              <Button variant="ghost" disabled={busy} onClick={() => saveDraft.mutate()}>
                <Save size={15} />
                {t("capture.saveDraft")}
              </Button>
              <HelpTip {...chelp("saveDraftHelp")} />
              <Button variant="ghost" onClick={loadExample}>
                {t("capture.loadExample")}
              </Button>
              <HelpTip {...chelp("loadExample")} />
              {/* Pedi 02.07.: Verwerfen auch im Erzähl-Schritt — leert Text + Anhänge. */}
              {/* SCRUM-412 (CI): Bestätigung = neutrale Fläche; Ampel-Farben bleiben Reife/Status
                  vorbehalten — Rot nur am destruktiven Aktions-Element selbst. */}
              {confirmTellReset ? (
                <span className="inline-flex items-center gap-2 rounded-card border border-hairline bg-page px-2.5 py-1.5">
                  <span className="text-[12px] font-semibold text-text">
                    {t("capture.tellResetQ")}
                  </span>
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-muted hover:text-text"
                    onClick={() => setConfirmTellReset(false)}
                  >
                    {t(CAPTURE_WIZARD_TEXT.discardKeep)}
                  </button>
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-trust-crit-text"
                    onClick={() => {
                      setRaw("");
                      setDocs([]);
                      setImages([]);
                      setNotice(null);
                      setErr(null);
                      setConfirmTellReset(false);
                    }}
                  >
                    {t(CAPTURE_WIZARD_TEXT.discardYes)}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmTellReset(true)}
                  disabled={!raw.trim() && images.length + docs.length === 0}
                  className="rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t(CAPTURE_WIZARD_TEXT.discard)}
                </button>
              )}
              <HelpTip {...chelp("discardHelp")} />
            </div>
          </Card>
        ) : null}

        {expertView ? (
          <div className="order-first">
            {draft ? (
              <ReasonerDraft>
                <div className="space-y-3">
                  <Field label={t("capture.fTitle")}>
                    <TextInput
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                  </Field>
                  <Field label={t("capture.fStatement")}>
                    <textarea
                      value={draft.statement}
                      onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
                      rows={3}
                      className={textareaCls}
                    />
                    {/* SCRUM-312: KI-Nachbearbeitung des Reasoner-Entwurfs (Vorschau + bewusste Übernahme). */}
                    <AiAssistBox
                      text={draft.statement}
                      runAssist={runAssist}
                      onApply={(next) => setDraft((d) => (d ? { ...d, statement: next } : d))}
                    />
                  </Field>
                  {/* KW-STR / FR-STR-02: optionaler WYSIWYG-Body. SCRUM-321: lokale Bild-Anhänge
                    können vor dem Speichern als sichere data:image-Vorschau eingefügt werden. */}
                  <Field label={t("capture.fBody")}>
                    {/* SCRUM-340: aus dem vorhandenen Reasoner-Entwurf einen strukturierten Body-Artikel
                      erzeugen und direkt im Studio weiterbearbeiten. Vorschlag, kein validiertes Wissen;
                      vorhandener Body wird nicht still überschrieben (leer = setzen, sonst anhängen). */}
                    {/* SCRUM-370 / AG-12: das Studio ist der empfohlene Strukturier-Hauptweg — ruhiger
                      Lead-Hinweis + „Empfohlen"-Chip am primären Einstieg. Das Formular bleibt erhalten. */}
                    <p className="mb-1.5 text-[11.5px] leading-relaxed text-muted">
                      {t(CAPTURE_FLOW_TEXT.studioLead)}
                    </p>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBodyHtml((prev) =>
                            applyDraftArticle(
                              prev,
                              draft,
                              normalizeDraftArticleLocale(i18n.language),
                            ),
                          );
                          setStudioApplied(false);
                          setStudioOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
                      >
                        <Sparkles size={14} /> {t("studio.fromDraft.cta")}
                        <span className="rounded-pill bg-white/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase">
                          {t(CAPTURE_FLOW_TEXT.studioRecommended)}
                        </span>
                      </button>
                      {/* SCRUM-337: Studio auch ohne Artikel-Erzeugung öffnen (leerer/eigener Body). */}
                      <button
                        type="button"
                        onClick={() => {
                          setStudioApplied(false);
                          setStudioOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text"
                      >
                        {t("studio.open")}
                      </button>
                    </div>
                    <p className="mb-2 text-[11px] text-muted-2">{t("studio.fromDraft.hint")}</p>
                    <KnowledgeInputStudio
                      open={studioOpen}
                      onClose={() => setStudioOpen(false)}
                      bodyHtml={bodyHtml}
                      onApply={(next) => {
                        setBodyHtml(next);
                        setStudioApplied(true);
                      }}
                      runAssist={runAssist}
                      images={editorImagesFromLocalImages(images)}
                      attachments={[...images, ...docs.map((d) => ({ mime: d.mime }))]}
                      // SCRUM-426: Public-KI-Anreicherung auch im Studio (gleiche Freigabe/Regeln).
                      externalStage={extPolicyStage}
                      enrichLocale={locale}
                      onAttachFiles={attachFiles}
                    />
                    {/* SCRUM-339: ehrliches Feedback — übernommen in den Entwurf, kein Auto-Save. */}
                    {studioApplied ? (
                      <p className="mb-2 rounded-btn bg-trust-pos-bg px-2.5 py-1.5 text-[11.5px] text-trust-pos-text">
                        {t("studio.applied")}
                      </p>
                    ) : null}
                    {/* SCRUM-317: kompakte Orientierung am Body-Feld (Struktur/Handlung/Blöcke/KI). */}
                    <EditorGuidance />
                    {/* SCRUM-323: Anhänge-Kontext — Bilder (einfügbar) vs. Dateien (Anhang/Evidence). */}
                    <EditorAttachmentContext
                      attachments={[...images, ...docs.map((d) => ({ mime: d.mime }))]}
                    />
                    {/* SCRUM-324: kompakte Struktur-/Nachvollziehbarkeits-Signale (keine Validierung). */}
                    <EditorContentQuality
                      bodyHtml={bodyHtml}
                      attachments={[...images, ...docs.map((d) => ({ mime: d.mime }))]}
                    />
                    {/* SCRUM-319: bewusst wählbare Body-Strukturvorlagen (leer = setzen, sonst anhängen). */}
                    <BodyTemplateChooser bodyHtml={bodyHtml} onApply={setBodyHtml} />
                    <RichTextEditor
                      value={bodyHtml}
                      onChange={setBodyHtml}
                      images={editorImagesFromLocalImages(images)}
                      onAttachFiles={attachFiles}
                    />
                    {/* SCRUM-426: Public-KI-Anreicherung — nur bei Admin-Freigabe (Stufe „offen"),
                        Ergebnisse extern/ungeprüft, nur bewusst in den Entwurf übernehmen. */}
                    <PublicAiEnrichPanel
                      stage={extPolicyStage}
                      locale={locale}
                      onAppendHtml={(h) => setBodyHtml((prev) => prev + h)}
                    />
                    {/* SCRUM-315: KI-Nachbearbeitung des ausführlichen Inhalts — Textbasis aus dem Body,
                      Vorschau + bewusste Übernahme (Ersetzen/Anhängen) als sicheres Body-HTML. */}
                    <AiAssistBox
                      text={bodyTextForAssist(bodyHtml)}
                      runAssist={runAssist}
                      applyFn={(mode, _original, suggestion) =>
                        applyBodyAssist(mode, bodyHtml, suggestion)
                      }
                      onApply={setBodyHtml}
                      hintKey="capture.ai.bodyHint"
                      extraApplyActions={EDITOR_BLOCKS.map((block) => ({
                        labelKey: `capture.ai.applyAs.${block}`,
                        apply: (_original, suggestion) =>
                          applyBodyAssistBlock(bodyHtml, suggestion, block),
                      }))}
                    />
                  </Field>
                  <ListEditor
                    label={t("capture.fConditions")}
                    items={draft.conditions}
                    onChange={(conditions) => setDraft({ ...draft, conditions })}
                  />
                  <ListEditor
                    label={t("capture.fMeasures")}
                    items={draft.measures}
                    onChange={(measures) => setDraft({ ...draft, measures })}
                  />
                  {/* SCRUM-248: Speicher-Check — Pflicht-/Kernfelder + mitgenommene Anhänge ehrlich sichtbar. */}
                  {readiness ? (
                    <div className="rounded-card border border-hairline bg-page p-3">
                      <div className="flex items-center gap-1">
                        <SectionLabel>{t("capture.readyTitle")}</SectionLabel>
                        <HelpTip {...chelp("readiness")} />
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {readiness.checks.map((c) => (
                          <li key={c.key} className="flex items-center gap-2 text-[12.5px]">
                            <span
                              className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                                c.ok
                                  ? "bg-trust-pos-bg text-trust-pos-text"
                                  : c.required
                                    ? "bg-trust-warn-bg text-trust-warn-text"
                                    : "bg-hairline-soft text-muted-2"
                              }`}
                            >
                              {c.ok ? "✓" : c.required ? "!" : "–"}
                            </span>
                            <span className="flex-1 text-text">
                              {t(`capture.ready.${c.key}`)}
                              {c.key === "attachments" ? ` (${images.length})` : ""}
                            </span>
                            <span className="font-mono text-[10.5px] uppercase text-muted-2">
                              {c.ok
                                ? t("capture.readyDone")
                                : c.required
                                  ? t("capture.readyMissing")
                                  : t("capture.readyOptional")}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {!readiness.canSave ? (
                        <p className="mt-2 text-[11.5px] text-trust-warn-text">
                          {t("capture.readyHint")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {/* SCRUM-344: Save-Confidence — nach Studio-Apply vor dem Einreichen ehrlich klarmachen,
                    dass der Inhalt im Entwurf liegt, aber noch nicht gespeichert/validiert ist. */}
                  {studioApplied
                    ? (() => {
                        const conf = studioSaveConfidence("capture");
                        return (
                          <div className="mb-2 rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-2.5">
                            <p className="text-[12.5px] font-semibold text-trust-warn-text">
                              {t(conf.titleKey)}
                            </p>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-trust-warn-text/90">
                              {t(conf.hintKey)}
                            </p>
                            <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-trust-warn-text">
                              {t(conf.nextStepKey)}
                            </p>
                          </div>
                        );
                      })()
                    : null}
                  {/* SCRUM-370 / AG-P2-4: leichter Beitragswert direkt an der Einreich-Entscheidung —
                    Motivation ohne Score/Gamification; ehrlich: gesichert erst nach der Prüfung. */}
                  <p className="text-[11.5px] leading-relaxed text-muted">
                    {t(CAPTURE_FLOW_TEXT.submitValue)}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      className="flex-1"
                      disabled={submit.isPending || !readiness?.canSave}
                      onClick={() => submit.mutate()}
                    >
                      {/* WP-D7/D7b (Befund 4/Rot-Fix 1): ehrliches, mehrstufiges Ladefeedback — Einreichen
                          kettet mehrere Netz-Aufrufe; der Text zeigt die aktuelle Phase (inkl. Upload-Größe). */}
                      {submit.isPending ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          {submitBusyLabel}
                        </>
                      ) : (
                        t("capture.submit")
                      )}
                    </Button>
                    <HelpTip {...chelp("submitReview")} />
                  </div>
                </div>
              </ReasonerDraft>
            ) : (
              <Card className="border-dashed text-center text-sm text-muted">
                {t("capture.draftHint")}
              </Card>
            )}
          </div>
        ) : null}

        {/* SCRUM-384: Schritt „Wissensseite prüfen & verfeinern" — Dokument im Zentrum,
            EINE KI-Palette (ARGUS-Muster „Wissensseite bearbeiten"); Struktur-Details und
            Hilfen eingeklappt hinter Badges/?-Hilfen (keine Info-Wand, nichts entfernt). */}
        {!expertView && wizStep === "refine" && draft ? (
          /* ARGUS-Sollbild „Wissensseite bearbeiten" (Pedi 02.07., Runde 4): ruhige weiße Karte,
             großer Titel, Titel-Feld, Toolbar, Dokument. KI-Kennung (G-3) bleibt — als kompakte
             Pill statt violetter Vollfläche; Kernaussage/Aussage-Felder wandern in die
             Struktur-Aufklappung (Inhalt steht bereits im Dokument — keine Doppel-Anzeige). */
          <Card className="space-y-4">
            {/* PMO-FEA-0006: sichtbare Warteschlange — Punkt X von Y aus der Datei; jeder Punkt
                wird einzeln geprüft/eingereicht, Überspringen ist bewusst möglich. */}
            {fileQueue ? (
              <div className="flex flex-wrap items-center gap-2 rounded-card border border-dashed border-ai-dashed bg-ai-surface-2 px-3 py-2">
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ai">
                  {t(CAPTURE_FILE_TEXT.queueBadge, {
                    current: queueProgress(fileQueue).current,
                    total: queueProgress(fileQueue).total,
                    name: fileQueue.fileName,
                  })}
                </span>
                <span className="text-[11.5px] text-muted">{t(CAPTURE_FILE_TEXT.queueHint)}</span>
                <button
                  type="button"
                  onClick={skipQueuePoint}
                  className="ml-auto rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                >
                  {t(CAPTURE_FILE_TEXT.queueSkip)}
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setWizStep("tell")}
                className="inline-flex items-center gap-1 rounded-btn px-1 py-1 text-[12px] font-medium text-muted hover:text-text"
              >
                ← {t(CAPTURE_WIZARD_TEXT.back)}
              </button>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-pill border border-dashed border-ai-dashed bg-ai-surface-2 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-ai">
                  <span aria-hidden>✦</span>
                  {t("reasoner.draftLabel")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStudioApplied(false);
                    setStudioOpen(true);
                  }}
                  className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                >
                  {t("studio.open")}
                </button>
              </div>
            </div>

            <h2 className="flex items-center gap-2 text-[19px] font-bold text-text">
              <span aria-hidden className="text-ai">
                ✦
              </span>
              {t(CAPTURE_WIZARD_TEXT.pageTitle)}
            </h2>

            <div>
              <div className="mb-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-muted">
                {t(CAPTURE_WIZARD_TEXT.titleLabel)}
                <HelpTip {...chelp("captureTitle")} />
              </div>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="w-full rounded-card bg-page px-4 py-3 text-[15px] font-medium text-text outline-none ring-hairline focus:ring-1"
              />
            </div>

            <div className="space-y-4">
              <div>
                {/* SCRUM-384: die EINE KI-Palette dieses Schritts sitzt IM Editor und öffnet
                    sich erst über den ✨KI-Knopf der Toolbar (ARGUS-Sollbild, Pedi 02.07.). */}
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  images={editorImagesFromLocalImages(images)}
                  onAttachFiles={attachFiles}
                  aiPanel={
                    <AiAssistBox
                      text={bodyTextForAssist(bodyHtml)}
                      runAssist={runAssist}
                      applyFn={(mode, _original, suggestion) =>
                        applyBodyAssist(mode, bodyHtml, suggestion)
                      }
                      onApply={setBodyHtml}
                      hintKey="capture.ai.bodyHint"
                      extraApplyActions={EDITOR_BLOCKS.map((block) => ({
                        labelKey: `capture.ai.applyAs.${block}`,
                        apply: (_original, suggestion) =>
                          applyBodyAssistBlock(bodyHtml, suggestion, block),
                      }))}
                      compact
                    />
                  }
                />
              </div>

              <KnowledgeInputStudio
                open={studioOpen}
                onClose={() => setStudioOpen(false)}
                bodyHtml={bodyHtml}
                onApply={(next) => {
                  setBodyHtml(next);
                  setStudioApplied(true);
                }}
                runAssist={runAssist}
                images={editorImagesFromLocalImages(images)}
                attachments={[...images, ...docs.map((d) => ({ mime: d.mime }))]}
                // SCRUM-434: Public-KI-Anreicherung auch im Verfeinern-Studio (gleiche Freigabe/Regeln)
                // — vorher fehlte hier die Weitergabe, das Panel blieb still gesperrt.
                externalStage={extPolicyStage}
                enrichLocale={locale}
                onAttachFiles={attachFiles}
              />
              {studioApplied ? (
                <p className="rounded-btn bg-trust-pos-bg px-2.5 py-1.5 text-[11.5px] text-trust-pos-text">
                  {t("studio.applied")}
                </p>
              ) : null}

              {/* SCRUM-405: Fakten aus weiteren Dokumenten per KI ergänzen — ausgewählte Punkte
                  (G-2: nur mit Belegstelle) werden ANGEHÄNGT, nichts ersetzt; die Quelle je Punkt
                  wandert in die Quellen-Warteliste (SCRUM-408) und beim Einreichen ans KO. */}
              <BodyExtractPanel
                onAppend={(pts, name) => {
                  setBodyHtml((prev) =>
                    appendExtractSections(prev, pts, name, normalizeExtractLocale(i18n.language)),
                  );
                  setPendingSources((list) =>
                    pts.reduce((acc, p) => addPendingSource(acc, fileSourcePayload(name, p)), list),
                  );
                }}
              />

              {/* Struktur-Daten (Kernaussage/Aussage/Bedingungen/Maßnahmen) — eingeklappt; der
                  Inhalt steht sichtbar im Dokument, hier nur die strukturierte Bearbeitung. */}
              <div className="rounded-card border border-hairline">
                <div className="flex items-center gap-1.5 px-3 py-2.5">
                  <button
                    type="button"
                    aria-expanded={showCondMeasures}
                    onClick={() => setShowCondMeasures((s) => !s)}
                    className="flex flex-1 items-center justify-between gap-2 text-left"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text">
                      {t(CAPTURE_WIZARD_TEXT.structData)}
                      <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-muted-2">
                        {draft.conditions.length + draft.measures.length}
                      </span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-muted-2 transition-transform ${showCondMeasures ? "rotate-180" : ""}`}
                    />
                  </button>
                  <HelpTip
                    title={t(CAPTURE_WIZARD_TEXT.structData)}
                    body={t(CAPTURE_WIZARD_TEXT.condMeasuresHint)}
                  />
                </div>
                {showCondMeasures ? (
                  <div className="space-y-3 border-t border-hairline p-3">
                    <Field label={t("capture.fStatement")}>
                      <textarea
                        value={draft.statement}
                        onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
                        rows={2}
                        className={textareaCls}
                      />
                    </Field>
                    <ListEditor
                      label={t("capture.fConditions")}
                      items={draft.conditions}
                      onChange={(conditions) => setDraft({ ...draft, conditions })}
                    />
                    <ListEditor
                      label={t("capture.fMeasures")}
                      items={draft.measures}
                      onChange={(measures) => setDraft({ ...draft, measures })}
                    />
                  </div>
                ) : null}
              </div>

              {/* Hilfen & Vorlagen — optional, eingeklappt (SCRUM-317/319/323/324 bleiben erhalten). */}
              <div className="rounded-card border border-hairline">
                <div className="flex items-center gap-1.5 px-3 py-2.5">
                  <button
                    type="button"
                    aria-expanded={showHelpers}
                    onClick={() => setShowHelpers((s) => !s)}
                    className="flex flex-1 items-center justify-between gap-2 text-left"
                  >
                    <span className="text-[12.5px] font-semibold text-text">
                      {t(CAPTURE_WIZARD_TEXT.helpers)}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-muted-2 transition-transform ${showHelpers ? "rotate-180" : ""}`}
                    />
                  </button>
                  <HelpTip
                    title={t(CAPTURE_WIZARD_TEXT.helpers)}
                    body={t(CAPTURE_WIZARD_TEXT.helpersHint)}
                  />
                </div>
                {showHelpers ? (
                  <div className="space-y-3 border-t border-hairline p-3">
                    <BodyTemplateChooser bodyHtml={bodyHtml} onApply={setBodyHtml} />
                    <EditorGuidance />
                    <EditorAttachmentContext
                      attachments={[...images, ...docs.map((d) => ({ mime: d.mime }))]}
                    />
                    <EditorContentQuality
                      bodyHtml={bodyHtml}
                      attachments={[...images, ...docs.map((d) => ({ mime: d.mime }))]}
                    />
                  </div>
                ) : null}
              </div>

              {/* SCRUM-248: ehrlicher Speicher-Check — nur sichtbar, wenn wirklich etwas fehlt
                  (alles bereit ⇒ der Einreichen-Knopf ist aktiv; keine unnötige Info-Wand). */}
              {readiness && !readiness.canSave ? (
                <div className="rounded-card border border-hairline bg-page p-3">
                  <div className="flex items-center gap-1">
                    <SectionLabel>{t("capture.readyTitle")}</SectionLabel>
                    <HelpTip {...chelp("readiness")} />
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {readiness.checks.map((c) => (
                      <li key={c.key} className="flex items-center gap-2 text-[12.5px]">
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                            c.ok
                              ? "bg-trust-pos-bg text-trust-pos-text"
                              : c.required
                                ? "bg-trust-warn-bg text-trust-warn-text"
                                : "bg-hairline-soft text-muted-2"
                          }`}
                        >
                          {c.ok ? "✓" : c.required ? "!" : "–"}
                        </span>
                        <span className="flex-1 text-text">
                          {t(`capture.ready.${c.key}`)}
                          {c.key === "attachments" ? ` (${images.length})` : ""}
                        </span>
                        <span className="font-mono text-[10.5px] uppercase text-muted-2">
                          {c.ok
                            ? t("capture.readyDone")
                            : c.required
                              ? t("capture.readyMissing")
                              : t("capture.readyOptional")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!readiness.canSave ? (
                    <p className="mt-2 text-[11.5px] text-trust-warn-text">
                      {t("capture.readyHint")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {err ? (
                <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                  {err}
                </div>
              ) : null}
              {notice ? (
                <div className="rounded-btn bg-trust-pos-bg px-3 py-2 text-[12.5px] text-trust-pos-text">
                  {notice}
                </div>
              ) : null}

              {/* SCRUM-370 / AG-P2-4: Beitragswert an der Einreich-Entscheidung — ehrlich. */}
              <p className="text-[11.5px] leading-relaxed text-muted">
                {t(CAPTURE_FLOW_TEXT.submitValue)}
              </p>
              {/* Pedi 02.07. (Runde 5): Verwerfen wie im ARGUS-Original — mit Inline-Bestätigung
                  (kein confirm()); der Erzähltext bleibt erhalten, nur der Entwurf geht. */}
              {/* SCRUM-412 (CI): neutrale Bestätigungs-Fläche statt Warn-Einfärbung. */}
              {confirmDiscard ? (
                <div className="flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-page p-2.5">
                  <span className="flex-1 text-[12.5px] font-semibold text-text">
                    {t(CAPTURE_WIZARD_TEXT.discardQ)}
                  </span>
                  <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
                    {t(CAPTURE_WIZARD_TEXT.discardKeep)}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraft(null);
                      setBodyHtml("");
                      setStudioApplied(false);
                      setConfirmDiscard(false);
                      setShowCondMeasures(false);
                      setShowHelpers(false);
                      setWizStep("tell");
                      setNotice(t(CAPTURE_WIZARD_TEXT.discardDone));
                    }}
                  >
                    {t(CAPTURE_WIZARD_TEXT.discardYes)}
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" disabled={busy} onClick={() => saveDraft.mutate()}>
                  <Save size={15} />
                  {t("capture.saveDraft")}
                </Button>
                <HelpTip {...chelp("saveDraftHelp")} />
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(true)}
                  className="rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                >
                  {t(CAPTURE_WIZARD_TEXT.discard)}
                </button>
                <HelpTip {...chelp("discardHelp")} />
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={submit.isPending || !readiness?.canSave}
                  onClick={() => submit.mutate()}
                >
                  {/* WP-D7/D7b (Befund 4/Rot-Fix 1): mehrstufiges Ladefeedback beim Einreichen. */}
                  {submit.isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      {submitBusyLabel}
                    </>
                  ) : (
                    <>{t("capture.submit")} →</>
                  )}
                </Button>
                <HelpTip {...chelp("submitReview")} />
              </div>
            </div>
          </Card>
        ) : null}
      </div>
      {/* SCRUM-435: Artikel-Picker zum Anhängen der ausgewählten Erkenntnis(se) an einen Bestand. */}
      <AppendToArticleModal
        open={appendPts !== null}
        points={appendPts?.points ?? []}
        fileName={appendPts?.fileName ?? ""}
        onClose={() => setAppendPts(null)}
        onDone={onAppendedToArticle}
      />
    </div>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  FileText,
  Mic,
  Paperclip,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDrafts } from "../api/hooks";
import type {
  Draft,
  DraftPayload,
  InterviewResult,
  KnowledgeObject,
  KnowledgeType,
  StructureResult,
} from "../api/types";
import { useSession } from "../app/AuthContext";
import { useToast } from "../app/ToastContext";
import { AiAssistBox } from "../components/AiAssistBox";
import { BodyTemplateChooser } from "../components/BodyTemplateChooser";
import { DemoBanner } from "../components/DemoBanner";
import { EditorAttachmentContext } from "../components/EditorAttachmentContext";
import { EditorContentQuality } from "../components/EditorContentQuality";
import { EditorGuidance } from "../components/EditorGuidance";
import { HelpTip } from "../components/HelpTip";
import { KnowledgeInputStudio } from "../components/KnowledgeInputStudio";
import { KnowledgeRescueIntro } from "../components/KnowledgeRescueIntro";
import { RichTextEditor } from "../components/RichTextEditor";
import { ListEditor, TagEditor } from "../components/editors";
import { KNOWLEDGE_TYPES, ReasonerDraft } from "../components/trust";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import { GAP_RESCUE_STEPS, GAP_RESCUE_TEXT } from "../lib/askGapRescue";
import { applyBodyAssist, applyBodyAssistBlock, bodyTextForAssist } from "../lib/bodyAiAssist";
import { ADVANCED_FIELDS_KEYS, advancedFieldsSummary } from "../lib/captureAdvancedFields";
import {
  ATTACHMENT_RECOVERY_KEYS,
  type AttachmentFailure,
  type AttachmentUploadItem,
  uploadAttachments,
} from "../lib/captureAttachments";
import { applyDraftArticle, normalizeDraftArticleLocale } from "../lib/captureDraftArticle";
import {
  CAPTURE_ENTRY_TEXT,
  type CaptureMode,
  EXPERT_MODE,
  NARRATE_MODES,
  isCaptureFirstRun,
  isExpertMode,
  markCaptureIntroSeen,
} from "../lib/captureEntry";
import { CAPTURE_EXAMPLE } from "../lib/captureExample";
import { CAPTURE_FLOW_STEPS, CAPTURE_FLOW_TEXT } from "../lib/captureFlowGuide";
import { gapContextDraft, readGapContext } from "../lib/captureFromGap";
import { captureReadiness } from "../lib/captureReadiness";
import { captureNextSteps, captureSavedStatus } from "../lib/captureSuccess";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
import { draftTitle } from "../lib/draftForm";
import { studioSaveConfidence } from "../lib/editorApplySafety";
import { EDITOR_BLOCKS } from "../lib/editorBlocks";
import { editorImagesFromLocalImages } from "../lib/editorImages";
import {
  fileToThumbDataUrl,
  isImage,
  isPdfDocument,
  isTextDocument,
  isWordDocument,
  readDocxFile,
  readFileAsDataUrl,
  readPdfFile,
  readTextFile,
  runImageOcr,
} from "../lib/files";
import { appendAnswer, interviewSourceKey, isInterviewDone } from "../lib/interviewFlow";
import { toReasonerLocale } from "../lib/reasonerLocale";
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

export function Capture(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const { push } = useToast();
  const authorName = user?.name ?? user?.email ?? "—";

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
  const [neededValidations, setNeededValidations] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Anhänge (FR-CAP-05/06)
  const [images, setImages] = useState<LocalImage[]>([]);
  // SCRUM-373 / AG-02-SESSION: Nicht-Bild-Session-Dateien behalten jetzt ihre Originalbytes (data), damit
  // sie beim Speichern in den Object-Store gelegt und danach im KO-Editor als sichere Body-Referenz nutzbar
  // sind. Der extrahierte Text geht weiterhin als Kontext in die Rohnotiz.
  const [docs, setDocs] = useState<{ id: string; name: string; mime: string; data: string }[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // SCRUM-276: nach erfolgreichem Einreichen die ID des gespeicherten KO (für die Success-Card).
  const [savedKoId, setSavedKoId] = useState<string | null>(null);
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
  const qc = useQueryClient();
  const drafts = useDrafts();

  // Diktat
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  // SCRUM-236: ehrliche, DOM-freie Feature-Detection statt inline-window-Zugriff.
  const speechSupported = hasSpeechRecognition(window);

  // SCRUM-132: reasoner-getriebenes Interview (stateless; Antworten → nächste Frage).
  const [ivAnswers, setIvAnswers] = useState<string[]>([]);
  const [ivAnswer, setIvAnswer] = useState("");
  const [ivResult, setIvResult] = useState<InterviewResult | null>(null);

  const fail = (e: unknown): void => setErr(e instanceof ApiError ? e.message : t("state.error"));

  // FR-I18N-01: Reasoner-Aufrufe folgen der aktuellen UI-Sprache (Quelleninhalt bleibt original).
  const locale = toReasonerLocale(i18n.language);

  const structure = useMutation({
    mutationFn: () => endpoints.reasoner.structure(raw, locale),
    onSuccess: (r) => {
      setDraft(r);
      setTags((prev) => (prev.length > 0 ? prev : r.tags));
      setErr(null);
    },
    onError: fail,
  });

  // SCRUM-132: ein Interview-Turn — Antworten rein, nächste Frage + Draft raus.
  const interview = useMutation({
    mutationFn: (answers: string[]) => endpoints.reasoner.interview(answers, locale),
    onSuccess: (res) => {
      setIvResult(res);
      setErr(null);
      if (isInterviewDone(res)) {
        setDraft(res.draft);
        setTags((prev) => (prev.length > 0 ? prev : res.draft.tags));
      }
    },
    onError: fail,
  });

  // SCRUM-312: KI-Nachbearbeitung über die sichtbare AiAssistBox (Vorschau + bewusste Übernahme);
  // die frühere stille Direkt-Mutation (setRaw/setDraft) wurde durch den Vorschau-Flow ersetzt.
  const runAssist = (input: string, instruction?: string): Promise<string> =>
    endpoints.reasoner.assist(input, locale, instruction).then((r) => r.text);

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
        };
        await endpoints.drafts.update(draftId, payload);
        ko = await endpoints.drafts.promote(draftId);
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
        });
        setSubmittedFromDraft(false);
      }
      // SCRUM-121/373/374: Originale in den Object-Store; am KO nur Referenz + kleine Vorschau.
      //  - Bilder: kind "image" mit Thumbnail; Nicht-Bild-Session-Dateien: kind "document" (AG-02-SESSION,
      //    danach body-verlinkbar via editorFilesFromAttachments/bodyFileLink).
      //  - SCRUM-374: Der Upload/Attach jeder Datei läuft EINZELN (uploadAttachments) — ein Teilfehler kippt
      //    NICHT den Gesamt-Save. Das KO ist bereits (offen) gespeichert; misslungene Anhänge werden ehrlich
      //    gemeldet, statt den ganzen Save als Fehler erscheinen zu lassen. Kein Fake-Attach ohne Upload.
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
      const attachResult = await uploadAttachments(ko.id, attachmentItems, {
        upload: (input) => endpoints.objects.upload(input),
        attach: (koId, attachment) => endpoints.ko.act(koId, { action: "attach", attachment }),
      });
      return { ko, attached: attachResult.attached, failed: attachResult.failed };
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
      setDraftId(null);
      // SCRUM-375: nach dem Zurücksetzen sind die erweiterten Felder leer → wieder einklappen.
      setShowAdvanced(false);
      setNotice(null);
    },
    onError: fail,
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
      };
      // SCRUM-113 / FE-CAP-07: fortgesetzten Entwurf aktualisieren, sonst neu anlegen.
      return draftId ? endpoints.drafts.update(draftId, payload) : endpoints.drafts.create(payload);
    },
    onSuccess: (d) => {
      setDraftId(d.id);
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      setErr(null);
      const msg = draftId ? t("capture.draftUpdated") : t("capture.draftSaved");
      setNotice(msg);
      push("success", msg);
    },
    onError: (e) => {
      fail(e);
      push("error", t("state.error"));
    },
  });

  // SCRUM-113 / FE-CAP-07: bestehenden Entwurf ins Formular laden (gemeinsamer Pool).
  const loadDraft = (d: Draft): void => {
    setErr(null);
    setMode("formular");
    setDraft({
      ...EMPTY_DRAFT,
      title: d.payload.title ?? "",
      statement: d.payload.statement ?? "",
      conditions: d.payload.conditions ?? [],
      measures: d.payload.measures ?? [],
    });
    setBodyHtml(d.payload.bodyHtml ?? "");
    setType(d.payload.type ?? "best_practice");
    setCategory(d.payload.category ?? "");
    setTags(d.payload.tags ?? []);
    setAsset(d.payload.asset ?? "");
    setNeededValidations(d.payload.neededValidations ? String(d.payload.neededValidations) : "");
    setDraftId(d.id);
    // SCRUM-375: geladener Entwurf bringt erweiterte Felder mit → aufklappen, nichts verstecken.
    setShowAdvanced(true);
    setNotice(t("capture.editingDraft"));
  };

  const discardDraft = useMutation({
    mutationFn: (id: string) => endpoints.drafts.remove(id),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      push("success", t("capture.draftDiscarded"));
      if (draftId === id) {
        setDraftId(null);
      }
    },
    onError: fail,
  });

  const switchMode = (m: Mode): void => {
    setErr(null);
    setNotice(null);
    setMode(m);
    if (m === "formular" && !draft) {
      setDraft({ ...EMPTY_DRAFT });
      setBodyHtml("");
    }
    if (m === "interview") {
      // SCRUM-132: Interview startet mit der ersten reasoner-getriebenen Frage.
      setIvAnswers([]);
      setIvAnswer("");
      setIvResult(null);
      interview.mutate([]);
    }
  };

  const toggleDictation = (): void => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) {
      return;
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
      setRaw((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  // SCRUM-373 / AG-02-SESSION: Session-Datei mit Originalbytes merken (für den Object-Store-Upload beim
  // Speichern). Reine lokale Erfassung — noch KEINE objectId, daher noch NICHT body-verlinkbar (kein Fake-Link).
  const pushDoc = async (f: File): Promise<void> => {
    const data = await readFileAsDataUrl(f);
    setDocs((d) => [
      ...d,
      { id: crypto.randomUUID(), name: f.name, mime: f.type || "application/octet-stream", data },
    ]);
  };

  const onDocs = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
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
          const text = await readPdfFile(f);
          if (text.length === 0) {
            setErr(t("capture.docEmpty", { name: f.name }));
            continue;
          }
          setRaw((prev) => (prev ? `${prev}\n\n[${f.name}]\n${text}` : `[${f.name}]\n${text}`));
          await pushDoc(f);
          setNotice(t("capture.docAdded", { name: f.name }));
        } catch {
          setErr(t("capture.docParseError", { name: f.name }));
        }
      } else if (f.type.startsWith("video/") || f.type.startsWith("audio/")) {
        // SCRUM-382: Video/Audio als Session-Datei merken (Attach beim Speichern) —
        // Transkription NUR auf Klick, wie bei der Bild-OCR (keine stille Aktion).
        await pushDoc(f);
        setNotice(t("capture.videoAdded", { name: f.name }));
      } else {
        setErr(t("capture.docUnsupported", { name: f.name }));
      }
    }
  };

  const addImage = async (f: File): Promise<void> => {
    try {
      // SCRUM-121: kleine Vorschau lokal + Original separat (geht beim Submit in den Object-Store).
      const [dataUrl, original] = await Promise.all([fileToThumbDataUrl(f), readFileAsDataUrl(f)]);
      setImages((im) => [
        ...im,
        { id: crypto.randomUUID(), name: f.name, mime: f.type || "image/jpeg", dataUrl, original },
      ]);
    } catch {
      setErr(t("state.error"));
    }
  };

  const onImages = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? []);
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
      const ref = await endpoints.objects.upload({
        name: d.name,
        mime: d.mime,
        data: d.data,
        kind: "video",
      });
      const res = await endpoints.media.analyze(ref.id, locale);
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

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader kicker={t("capture.kicker")} title={t("capture.title")} />
      {/* SCRUM-296: Demo-/Pilotpfad auf der Erfassungsseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="capture" /> : null}

      {/* SCRUM-352: ruhiger, geführter Einstieg — Story „Erfahrungswissen sichern" + 3 Schritte +
          leichter Wertbeitrag. Progressive Disclosure; entfernt keine Funktion (Modi/Editor folgen). */}
      {/* SCRUM-384: Erstnutzer-Führung — beim Erstbesuch ausgeklappt, danach ruhig eingeklappt. */}
      <KnowledgeRescueIntro defaultOpen={firstRun} />

      {/* SCRUM-276: nach erfolgreichem Einreichen „gespeichert" + nächster Schritt (kein Auto-Redirect). */}
      {savedKoId ? (
        <Card className="mb-4 border-trust-pos-fill/40 bg-trust-pos-bg">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[13px] font-semibold text-trust-pos-text">
              {t("capture.savedTitle")}
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
      {(drafts.data ?? []).length > 0 ? (
        <Card className="mb-4 space-y-2">
          <SectionLabel>{t("capture.resumeTitle")}</SectionLabel>
          <ul className="divide-y divide-hairline">
            {(drafts.data ?? []).map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-text">
                  {draftTitle(d, t("capture.draftFallbackTitle"))}
                  {draftId === d.id ? (
                    <span className="ml-2 font-mono text-[10px] uppercase text-ai">
                      {t("capture.editingBadge")}
                    </span>
                  ) : null}
                </span>
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
                  disabled={discardDraft.isPending}
                  onClick={() => discardDraft.mutate(d.id)}
                  className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* SCRUM-370 / AG-12/13: ruhige Weg-Leiste — Rohwissen → im Studio strukturieren (empfohlen) →
          prüfen & einreichen. Positioniert das Knowledge Studio als naheliegenden Hauptweg, ohne die
          Formular-Modi zu entfernen (progressive disclosure, kein Zwang). Eine Quelle: captureFlowGuide. */}
      <div className="mb-4 rounded-card border border-hairline bg-surface px-4 py-3">
        <p className="mb-2 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
          {t(CAPTURE_FLOW_TEXT.railKicker)}
        </p>
        <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          {CAPTURE_FLOW_STEPS.map((step, i) => (
            <li key={step.id} className="flex flex-1 items-start gap-2">
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                  step.recommended ? "bg-ai text-white" : "bg-ink text-white"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-text">{t(step.labelKey)}</span>
                  {step.recommended ? (
                    <span className="rounded-pill bg-ai/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-ai">
                      {t(CAPTURE_FLOW_TEXT.studioRecommended)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{t(step.hintKey)}</p>
              </div>
              {i < CAPTURE_FLOW_STEPS.length - 1 ? (
                <span aria-hidden="true" className="hidden self-center text-muted-2 sm:inline">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-muted-2">{t(CAPTURE_FLOW_TEXT.railKickerHint)}</p>
      </div>

      {/* SCRUM-384 / AG-12 / KG-UX-001/002/003/010: Erzähl-Einstieg als Standardweg — die Erzähl-Modi
          (Freitext · Diktat · Interview) führen in den Studio-Hauptweg; das klassische Formular bleibt
          als bewusst wählbarer Expertenpfad erhalten (progressive disclosure, NICHTS entfernt). */}
      <div className="mb-4">
        <p className="mb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
          {t(CAPTURE_ENTRY_TEXT.narrateKicker)}
        </p>
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
          {/* Expertenpfad: ruhig rechts abgesetzt, bewusster Klick — kein gleichrangiger Modus. */}
          {!isExpertMode(mode) ? (
            <button
              type="button"
              onClick={() => switchMode(EXPERT_MODE)}
              title={t(CAPTURE_ENTRY_TEXT.expertHint)}
              className="ml-auto rounded-btn px-2.5 py-1.5 text-[12px] font-medium text-muted-2 underline-offset-2 hover:text-text hover:underline"
            >
              {t(CAPTURE_ENTRY_TEXT.expertToggle)}
            </button>
          ) : null}
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

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("capture.author")}>
              <div className="flex h-10 items-center rounded-input border border-hairline bg-page px-3 text-sm text-muted">
                {authorName}
              </div>
            </Field>
            <Field label={t("capture.fType")}>
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
          </div>

          {/* Modus-spezifische Eingabe */}
          {mode === "freitext" || mode === "diktat" ? (
            <div>
              <div className="mb-1.5">
                <SectionLabel>{t("capture.raw")}</SectionLabel>
              </div>
              {mode === "diktat" ? (
                speechSupported ? (
                  <Button
                    variant={listening ? "primary" : "ghost"}
                    className="mb-2"
                    onClick={toggleDictation}
                  >
                    <Mic size={15} />
                    {listening ? t("capture.diktatStop") : t("capture.diktatStart")}
                  </Button>
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
              {/* SCRUM-312: sichtbare KI-Nachbearbeitung mit Vorschau + bewusster Übernahme. */}
              <AiAssistBox text={raw} runAssist={runAssist} onApply={setRaw} />
              <Button
                variant="primary"
                className="mt-3"
                disabled={raw.trim().length === 0 || structure.isPending}
                onClick={() => structure.mutate()}
              >
                <Sparkles size={15} />
                {t("capture.structure")}
              </Button>
            </div>
          ) : null}

          {mode === "formular" ? (
            <p className="rounded-card border border-dashed border-hairline p-3 text-[13px] text-muted">
              {t("capture.formularHint")}
            </p>
          ) : null}

          {mode === "interview" ? (
            ivResult && isInterviewDone(ivResult) ? (
              <p className="rounded-card border border-dashed border-hairline p-3 text-[13px] text-trust-pos-text">
                {t("capture.ivDone")}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-2">
                    {t("capture.ivTurn", { n: ivAnswers.length + 1 })}
                  </span>
                  {ivResult ? (
                    <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
                      {t(interviewSourceKey(ivResult))}
                    </span>
                  ) : null}
                </div>
                <p className="text-[14px] font-medium text-text">
                  {interview.isPending
                    ? t("capture.ivThinking")
                    : (ivResult?.question ?? t("capture.ivThinking"))}
                </p>
                <textarea
                  value={ivAnswer}
                  onChange={(e) => setIvAnswer(e.target.value)}
                  rows={2}
                  placeholder={t("capture.ivAnswerHint")}
                  className={textareaCls}
                />
                <Button
                  variant="primary"
                  disabled={interview.isPending || ivAnswer.trim().length === 0 || !ivResult}
                  onClick={ivSend}
                >
                  {t("capture.ivSend")}
                </Button>
              </div>
            )
          ) : null}

          {/* SCRUM-375 / AG-12: erweiterte/technische Felder als Progressive Disclosure — standardmäßig
              eingeklappt, damit „Wissen erzählen → im Studio strukturieren" führt. NICHTS entfernt; bei
              vorhandenem Inhalt (Entwurf/Beispiel) automatisch aufgeklappt; Badge zeigt Ausgefülltes an. */}
          <div className="border-t border-hairline pt-4">
            <button
              type="button"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((s) => !s)}
              className="flex w-full items-center justify-between gap-2 text-left"
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
            {!showAdvanced ? (
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-2">
                {t(ADVANCED_FIELDS_KEYS.hint)}
              </p>
            ) : null}
          </div>

          {showAdvanced ? (
            <>
              {/* Metadaten */}
              <div className="grid grid-cols-2 gap-3">
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
                    value={neededValidations}
                    onChange={(e) => setNeededValidations(e.target.value)}
                  />
                </Field>
                <Field label={t("capture.fAsset")}>
                  <TextInput value={asset} onChange={(e) => setAsset(e.target.value)} />
                </Field>
                <div>
                  <TagEditor tags={tags} onChange={setTags} />
                </div>
              </div>

              {/* Dokumente */}
              <div className="rounded-card border border-dashed border-hairline p-3">
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                  <FileText size={13} />
                  {t("capture.documents")}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
                  {t("capture.documentsUpload")}
                  <input
                    type="file"
                    multiple
                    accept=".txt,.md,.markdown,.csv,.log,.json,.docx,.pdf,application/pdf,image/*,video/*,audio/*"
                    className="hidden"
                    onChange={(e) => void onDocs(e)}
                  />
                </label>
                <span className="ml-2 text-[11.5px] text-muted-2">
                  {t("capture.documentsHint")}
                </span>
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

          <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
            <Button variant="ghost" disabled={busy} onClick={() => saveDraft.mutate()}>
              <Save size={15} />
              {t("capture.saveDraft")}
            </Button>
            <Button variant="ghost" onClick={loadExample}>
              {t("capture.loadExample")}
            </Button>
          </div>
        </Card>

        <div>
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
                    <SectionLabel>{t("capture.readyTitle")}</SectionLabel>
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
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={submit.isPending || !readiness?.canSave}
                  onClick={() => submit.mutate()}
                >
                  {t("capture.submit")}
                </Button>
              </div>
            </ReasonerDraft>
          ) : (
            <Card className="border-dashed text-center text-sm text-muted">
              {t("capture.draftHint")}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

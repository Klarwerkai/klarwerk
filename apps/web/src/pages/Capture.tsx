import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Mic, Paperclip, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
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
  KnowledgeType,
  StructureResult,
} from "../api/types";
import { useSession } from "../app/AuthContext";
import { useToast } from "../app/ToastContext";
import { AiAssistBox } from "../components/AiAssistBox";
import { BodyTemplateChooser } from "../components/BodyTemplateChooser";
import { DemoBanner } from "../components/DemoBanner";
import { EditorGuidance } from "../components/EditorGuidance";
import { HelpTip } from "../components/HelpTip";
import { RichTextEditor } from "../components/RichTextEditor";
import { ListEditor, TagEditor } from "../components/editors";
import { KNOWLEDGE_TYPES, ReasonerDraft } from "../components/trust";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import { applyBodyAssist, applyBodyAssistBlock, bodyTextForAssist } from "../lib/bodyAiAssist";
import { CAPTURE_EXAMPLE } from "../lib/captureExample";
import { gapContextDraft, readGapContext } from "../lib/captureFromGap";
import { captureReadiness } from "../lib/captureReadiness";
import { captureNextSteps, captureSavedStatus } from "../lib/captureSuccess";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
import { draftTitle } from "../lib/draftForm";
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

const MODES = ["freitext", "formular", "diktat", "interview"] as const;
type Mode = (typeof MODES)[number];

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

  // Metadaten (vorab erfassbar, FR-CAP-08)
  const [type, setType] = useState<KnowledgeType>("best_practice");
  const [category, setCategory] = useState("");
  const [asset, setAsset] = useState("");
  const [neededValidations, setNeededValidations] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Anhänge (FR-CAP-05/06)
  const [images, setImages] = useState<LocalImage[]>([]);
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // SCRUM-276: nach erfolgreichem Einreichen die ID des gespeicherten KO (für die Success-Card).
  const [savedKoId, setSavedKoId] = useState<string | null>(null);
  // SCRUM-123: laufende Bild-OCR (für ehrlichen Status / Button-Sperre).
  const [ocrBusy, setOcrBusy] = useState<string | null>(null);
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
      const ko = await endpoints.ko.create({
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
      // SCRUM-121: Original in den Object-Store; am KO nur Referenz + kleine Vorschau.
      for (const img of images) {
        const ref = await endpoints.objects.upload({
          name: img.name,
          mime: img.mime,
          data: img.original,
          kind: "image",
        });
        await endpoints.ko.act(ko.id, {
          action: "attach",
          attachment: {
            name: img.name,
            mime: img.mime,
            objectId: ref.id,
            thumbnail: img.dataUrl,
            size: ref.size,
          },
        });
      }
      return ko;
    },
    // SCRUM-276: kein stilles Weiterleiten — „gespeichert" + nächster Schritt sichtbar machen.
    // Formular zurücksetzen (kein versehentlicher Doppel-Submit); Modus bleibt erhalten.
    onSuccess: (ko) => {
      setSavedKoId(ko.id);
      push("success", t("capture.savedTitle"));
      void qc.invalidateQueries({ queryKey: ["validation"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
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
          setDocs((d) => [...d, { id: crypto.randomUUID(), name: f.name }]);
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
          setDocs((d) => [...d, { id: crypto.randomUUID(), name: f.name }]);
          setNotice(t("capture.docAdded", { name: f.name }));
        } catch {
          setErr(t("capture.docParseError", { name: f.name }));
        }
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
    setNotice(t(CAPTURE_EXAMPLE.noticeKey));
  };

  const busy = structure.isPending || saveDraft.isPending;

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
            <Button variant="ghost" onClick={() => setSavedKoId(null)}>
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

      <div className="mb-4 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            title={m === "diktat" && !speechSupported ? t("capture.diktatUnsupported") : undefined}
            className={`rounded-btn px-3 py-1.5 text-[13px] font-semibold ${
              mode === m ? "bg-ink text-white" : "border border-hairline text-muted hover:text-text"
            }`}
          >
            {t(`capture.mode.${m}`)}
            {m === "diktat" && !speechSupported ? (
              <span className="ml-1 text-[11px] opacity-70">·{t("capture.diktatNa")}</span>
            ) : null}
          </button>
        ))}
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

          {/* Metadaten */}
          <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-4">
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
                accept=".txt,.md,.markdown,.csv,.log,.json,.docx,.pdf,application/pdf,image/*"
                className="hidden"
                onChange={(e) => void onDocs(e)}
              />
            </label>
            <span className="ml-2 text-[11.5px] text-muted-2">{t("capture.documentsHint")}</span>
            {docs.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-[12.5px] text-text">
                    <FileText size={12} className="text-muted-2" />
                    <span className="truncate">{d.name}</span>
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
                  {/* SCRUM-317: kompakte Orientierung am Body-Feld (Struktur/Handlung/Blöcke/KI). */}
                  <EditorGuidance />
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

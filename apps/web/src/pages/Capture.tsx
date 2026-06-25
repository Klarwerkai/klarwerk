import { useMutation } from "@tanstack/react-query";
import { FileText, Mic, Paperclip, Save, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { KnowledgeType, StructureResult } from "../api/types";
import { useSession } from "../app/AuthContext";
import { HelpTip } from "../components/HelpTip";
import { ListEditor, TagEditor } from "../components/editors";
import { KNOWLEDGE_TYPES, ReasonerDraft } from "../components/trust";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import {
  fileToThumbDataUrl,
  isImage,
  isTextDocument,
  isWordDocument,
  readDocxFile,
  readTextFile,
} from "../lib/files";

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
  dataUrl: string;
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

const IV_STEPS = ["title", "statement", "conditions", "measures", "tags"] as const;
type IvField = (typeof IV_STEPS)[number];

export function Capture(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSession();
  const authorName = user?.name ?? user?.email ?? "—";

  const [mode, setMode] = useState<Mode>("freitext");
  const [raw, setRaw] = useState("");
  const [draft, setDraft] = useState<StructureResult | null>(null);

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

  // Diktat
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const speechSupported = Boolean(speechCtor());

  // Interview
  const [ivStep, setIvStep] = useState(0);
  const [ivAnswer, setIvAnswer] = useState("");
  const [iv, setIv] = useState<StructureResult>({ ...EMPTY_DRAFT });

  const fail = (e: unknown): void => setErr(e instanceof ApiError ? e.message : t("state.error"));

  const structure = useMutation({
    mutationFn: () => endpoints.reasoner.structure(raw),
    onSuccess: (r) => {
      setDraft(r);
      setTags((prev) => (prev.length > 0 ? prev : r.tags));
      setErr(null);
    },
    onError: fail,
  });

  const assistRaw = useMutation({
    mutationFn: () => endpoints.reasoner.assist(raw),
    onSuccess: (r) => {
      setRaw(r.text);
      setErr(null);
    },
    onError: fail,
  });

  const assistStatement = useMutation({
    mutationFn: () => endpoints.reasoner.assist(draft?.statement ?? ""),
    onSuccess: (r) => {
      setDraft((d) => (d ? { ...d, statement: r.text } : d));
      setErr(null);
    },
    onError: fail,
  });

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
        ...(n ? { neededValidations: n } : {}),
      });
      // Gesammelte Bilder am neu erstellten Objekt anhängen (FR-CAP-05).
      for (const img of images) {
        await endpoints.ko.act(ko.id, {
          action: "attach",
          attachment: { name: img.name, mime: "image/jpeg", dataUrl: img.dataUrl },
        });
      }
      return ko;
    },
    onSuccess: (ko) => navigate(`/wissen/${ko.id}`),
    onError: fail,
  });

  const saveDraft = useMutation({
    mutationFn: () => {
      const n = parsedValidations();
      return endpoints.drafts.create({
        title: draft?.title || raw.split("\n")[0]?.slice(0, 80) || t("capture.draftFallbackTitle"),
        statement: draft?.statement || raw,
        type,
        category: category.trim() || undefined,
        tags: tags.filter((x) => x.trim()),
        conditions: draft?.conditions.filter((x) => x.trim()),
        measures: draft?.measures.filter((x) => x.trim()),
        asset: asset.trim() ? asset.trim() : undefined,
        ...(n ? { neededValidations: n } : {}),
      });
    },
    onSuccess: () => {
      setNotice(t("capture.draftSaved"));
      setErr(null);
    },
    onError: fail,
  });

  const switchMode = (m: Mode): void => {
    setErr(null);
    setNotice(null);
    setMode(m);
    if (m === "formular" && !draft) {
      setDraft({ ...EMPTY_DRAFT });
    }
    if (m === "interview") {
      setIvStep(0);
      setIvAnswer("");
      setIv({ ...EMPTY_DRAFT });
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
      } else {
        setErr(t("capture.docUnsupported", { name: f.name }));
      }
    }
  };

  const addImage = async (f: File): Promise<void> => {
    try {
      const dataUrl = await fileToThumbDataUrl(f);
      setImages((im) => [...im, { id: crypto.randomUUID(), name: f.name, dataUrl }]);
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

  const ivField = IV_STEPS[ivStep] as IvField;
  const ivAdvance = (): void => {
    const next: StructureResult = { ...iv };
    const val = ivAnswer.trim();
    const lines = (sep: string): string[] =>
      val
        ? val
            .split(sep)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    if (ivField === "title") {
      next.title = val;
    } else if (ivField === "statement") {
      next.statement = val;
    } else if (ivField === "conditions") {
      next.conditions = lines("\n");
    } else if (ivField === "measures") {
      next.measures = lines("\n");
    } else {
      setTags((prev) => (prev.length > 0 ? prev : lines(",")));
    }
    setIv(next);
    if (ivStep + 1 < IV_STEPS.length) {
      setIvStep(ivStep + 1);
      setIvAnswer("");
    } else {
      setDraft(next);
    }
  };

  const loadExample = (): void => {
    setRaw(
      "Bei Außentemperaturen unter -5 °C die Pumpe P-12 vor dem Start 10 Minuten vorwärmen, " +
        "sonst drohen Kavitationsschäden am Laufrad. Gilt für alle baugleichen Pumpen P-12/P-13.",
    );
    setCategory("Instandhaltung");
    setAsset("Pumpe P-12");
    setTags(["Frost", "Pumpe", "Winter"]);
    setNotice(t("capture.exampleLoaded"));
  };

  const busy = structure.isPending || assistRaw.isPending || saveDraft.isPending;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader kicker={t("capture.kicker")} title={t("capture.title")} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`rounded-btn px-3 py-1.5 text-[13px] font-semibold ${
              mode === m ? "bg-ink text-white" : "border border-hairline text-muted hover:text-text"
            }`}
          >
            {t(`capture.mode.${m}`)}
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
              <div className="mb-1.5 flex items-center justify-between">
                <SectionLabel>{t("capture.raw")}</SectionLabel>
                <button
                  type="button"
                  disabled={assistRaw.isPending || raw.trim().length === 0}
                  onClick={() => assistRaw.mutate()}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-ai hover:opacity-80 disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  {t("capture.assist")}
                </button>
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
            draft ? (
              <p className="rounded-card border border-dashed border-hairline p-3 text-[13px] text-trust-pos-text">
                {t("capture.ivDone")}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-2">
                  {t("capture.ivStep", { n: ivStep + 1, total: IV_STEPS.length })}
                </div>
                <p className="text-[14px] font-medium text-text">{t(`capture.ivQ.${ivField}`)}</p>
                <textarea
                  value={ivAnswer}
                  onChange={(e) => setIvAnswer(e.target.value)}
                  rows={ivField === "statement" ? 4 : 2}
                  placeholder={t(`capture.ivQHint.${ivField}`)}
                  className={textareaCls}
                />
                <div className="flex gap-2">
                  {ivStep > 0 ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIvStep(ivStep - 1);
                        setIvAnswer("");
                      }}
                    >
                      {t("capture.ivBack")}
                    </Button>
                  ) : null}
                  <Button variant="primary" onClick={ivAdvance}>
                    {ivStep + 1 < IV_STEPS.length ? t("capture.ivNext") : t("capture.ivFinish")}
                  </Button>
                </div>
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
                accept=".txt,.md,.markdown,.csv,.log,.json,.docx,image/*"
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
                  <button
                    type="button"
                    disabled={assistStatement.isPending || draft.statement.trim().length === 0}
                    onClick={() => assistStatement.mutate()}
                    className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-ai hover:opacity-80 disabled:opacity-50"
                  >
                    <Sparkles size={13} />
                    {t("capture.assist")}
                  </button>
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
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={submit.isPending || draft.title.trim().length === 0}
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

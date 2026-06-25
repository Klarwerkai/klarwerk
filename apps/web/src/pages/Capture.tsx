import { useMutation } from "@tanstack/react-query";
import { Mic, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { KnowledgeType, StructureResult } from "../api/types";
import { ListEditor, TagEditor } from "../components/editors";
import { KNOWLEDGE_TYPES, ReasonerDraft } from "../components/trust";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";

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

// Geführtes Interview: feste Fragesequenz, baut den Entwurf Schritt für Schritt.
const IV_STEPS = ["title", "statement", "conditions", "measures", "tags"] as const;
type IvField = (typeof IV_STEPS)[number];

export function Capture(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("freitext");
  const [raw, setRaw] = useState("");
  const [draft, setDraft] = useState<StructureResult | null>(null);
  const [type, setType] = useState<KnowledgeType>("best_practice");
  const [category, setCategory] = useState("");
  const [asset, setAsset] = useState("");
  const [neededValidations, setNeededValidations] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Diktat
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const speechSupported = Boolean(speechCtor());

  // Interview
  const [ivStep, setIvStep] = useState(0);
  const [ivAnswer, setIvAnswer] = useState("");
  const [iv, setIv] = useState<StructureResult>({ ...EMPTY_DRAFT });

  const structure = useMutation({
    mutationFn: () => endpoints.reasoner.structure(raw),
    onSuccess: (r) => {
      setDraft(r);
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const submit = useMutation({
    mutationFn: () => {
      if (!draft) {
        throw new Error("no draft");
      }
      const n = Number.parseInt(neededValidations, 10);
      return endpoints.ko.create({
        title: draft.title,
        statement: draft.statement,
        conditions: draft.conditions.filter((x) => x.trim()),
        measures: draft.measures.filter((x) => x.trim()),
        tags: draft.tags.filter((x) => x.trim()),
        type,
        category: category || "Allgemein",
        asset: asset.trim() ? asset.trim() : null,
        ...(Number.isFinite(n) && n > 0 ? { neededValidations: n } : {}),
      });
    },
    onSuccess: (ko) => navigate(`/wissen/${ko.id}`),
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // FR-RSN-03: Aussage sprachlich präzisieren lassen.
  const assist = useMutation({
    mutationFn: () => endpoints.reasoner.assist(draft?.statement ?? ""),
    onSuccess: (r) => {
      setDraft((d) => (d ? { ...d, statement: r.text } : d));
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const switchMode = (m: Mode): void => {
    setErr(null);
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

  const ivField = IV_STEPS[ivStep] as IvField;
  const ivAdvance = (): void => {
    const next: StructureResult = { ...iv };
    const val = ivAnswer.trim();
    if (ivField === "title") {
      next.title = val;
    } else if (ivField === "statement") {
      next.statement = val;
    } else if (ivField === "conditions") {
      next.conditions = val
        ? val
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    } else if (ivField === "measures") {
      next.measures = val
        ? val
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    } else {
      next.tags = val
        ? val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    }
    setIv(next);
    if (ivStep + 1 < IV_STEPS.length) {
      setIvStep(ivStep + 1);
      setIvAnswer("");
    } else {
      setDraft(next);
    }
  };

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
        <Card>
          <SectionLabel>{t("capture.raw")}</SectionLabel>

          {mode === "freitext" || mode === "diktat" ? (
            <>
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
                rows={8}
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
            </>
          ) : null}

          {mode === "formular" ? (
            <p className="py-4 text-sm text-muted">{t("capture.formularHint")}</p>
          ) : null}

          {mode === "interview" ? (
            draft ? (
              <p className="py-4 text-sm text-trust-pos-text">{t("capture.ivDone")}</p>
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
                    disabled={assist.isPending || draft.statement.trim().length === 0}
                    onClick={() => assist.mutate()}
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
                <TagEditor tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
                <div className="grid grid-cols-2 gap-3">
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
                  <Field label={t("capture.fCategory")}>
                    <TextInput value={category} onChange={(e) => setCategory(e.target.value)} />
                  </Field>
                  <Field label={t("capture.fAsset")}>
                    <TextInput value={asset} onChange={(e) => setAsset(e.target.value)} />
                  </Field>
                  <Field label={t("capture.fRevalidation")}>
                    <TextInput
                      type="number"
                      min={1}
                      value={neededValidations}
                      onChange={(e) => setNeededValidations(e.target.value)}
                    />
                  </Field>
                </div>
                {err ? (
                  <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                    {err}
                  </div>
                ) : null}
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
              {err ?? t("capture.draftHint")}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

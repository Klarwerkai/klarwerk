import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { KnowledgeType, StructureResult } from "../api/types";
import { KNOWLEDGE_TYPES, ReasonerDraft } from "../components/trust";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";

const MODES = ["freitext", "formular", "diktat", "interview"] as const;

export function Capture(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<(typeof MODES)[number]>("freitext");
  const [raw, setRaw] = useState("");
  const [draft, setDraft] = useState<StructureResult | null>(null);
  const [type, setType] = useState<KnowledgeType>("best_practice");
  const [category, setCategory] = useState("");
  const [err, setErr] = useState<string | null>(null);

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
      return endpoints.ko.create({
        title: draft.title,
        statement: draft.statement,
        conditions: draft.conditions,
        measures: draft.measures,
        tags: draft.tags,
        type,
        category: category || "Allgemein",
      });
    },
    onSuccess: (ko) => navigate(`/wissen/${ko.id}`),
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader kicker={t("capture.kicker")} title={t("capture.title")} />
      <div className="mb-4 flex gap-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
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
          {mode === "freitext" ? (
            <>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={8}
                placeholder={t("capture.rawPlaceholder")}
                className="w-full resize-y rounded-input border border-hairline bg-surface p-3 text-sm text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
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
          ) : (
            <p className="py-6 text-sm text-muted">{t("capture.modeSoon")}</p>
          )}
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
                    className="w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30"
                  />
                </Field>
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
                </div>
                {err ? (
                  <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                    {err}
                  </div>
                ) : null}
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={submit.isPending}
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

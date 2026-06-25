import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { type KoAction, endpoints } from "../api/endpoints";
import { useKo } from "../api/hooks";
import type { KnowledgeObject, KnowledgeType } from "../api/types";
import { useRole } from "../app/RoleContext";
import { ListEditor, TagEditor } from "../components/editors";
import {
  ConfidenceBar,
  KNOWLEDGE_TYPES,
  KnowledgeTypeTag,
  ProvenanceLine,
  StatusPill,
} from "../components/trust";
import {
  Button,
  Card,
  Field,
  PageHeader,
  QueryState,
  SectionLabel,
  TextInput,
} from "../components/ui";
import { deriveStatus } from "../lib/displayStatus";

interface EditState {
  title: string;
  statement: string;
  type: KnowledgeType;
  category: string;
  conditions: string[];
  measures: string[];
  tags: string[];
}

const textareaCls =
  "w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30";

export function KnowledgeDetail(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { role } = useRole();
  const query = useKo(id);
  const qc = useQueryClient();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canEdit = role !== "viewer";

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["ko", id] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
  };

  const act = useMutation({
    mutationFn: (body: KoAction) => endpoints.ko.act(id, body),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!edit) {
        throw new Error("no edit");
      }
      await endpoints.ko.act(id, {
        action: "revise",
        changes: {
          title: edit.title,
          statement: edit.statement,
          type: edit.type,
          conditions: edit.conditions.filter((x) => x.trim()),
          measures: edit.measures.filter((x) => x.trim()),
        },
      });
      await endpoints.ko.act(id, { action: "tags", tags: edit.tags.filter((x) => x.trim()) });
      if (edit.category.trim()) {
        await endpoints.ko.act(id, { action: "category", category: edit.category.trim() });
      }
    },
    onSuccess: () => {
      invalidate();
      setEdit(null);
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const startEdit = (ko: KnowledgeObject): void => {
    setErr(null);
    setEdit({
      title: ko.title,
      statement: ko.statement,
      type: ko.type,
      category: ko.category,
      conditions: [...ko.conditions],
      measures: [...ko.measures],
      tags: [...ko.tags],
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader kicker={t("ko.kicker")} title={t("ko.title")} />
      <QueryState query={query}>
        {(ko) => (
          <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={deriveStatus(ko)} />
                <KnowledgeTypeTag type={ko.type} />
                <span className="font-mono text-[11px] text-muted-2">
                  v{ko.version}
                  {ko.asset ? ` · ${ko.asset}` : ""}
                </span>
                {canEdit && !edit ? (
                  <button
                    type="button"
                    onClick={() => startEdit(ko)}
                    className="ml-auto inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                  >
                    <Pencil size={13} />
                    {t("ko.edit")}
                  </button>
                ) : null}
              </div>

              {edit ? (
                <div className="mt-4 space-y-3">
                  <Field label={t("capture.fTitle")}>
                    <TextInput
                      value={edit.title}
                      onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                    />
                  </Field>
                  <Field label={t("capture.fStatement")}>
                    <textarea
                      value={edit.statement}
                      onChange={(e) => setEdit({ ...edit, statement: e.target.value })}
                      rows={3}
                      className={textareaCls}
                    />
                  </Field>
                  <ListEditor
                    label={t("capture.fConditions")}
                    items={edit.conditions}
                    onChange={(conditions) => setEdit({ ...edit, conditions })}
                  />
                  <ListEditor
                    label={t("capture.fMeasures")}
                    items={edit.measures}
                    onChange={(measures) => setEdit({ ...edit, measures })}
                  />
                  <TagEditor tags={edit.tags} onChange={(tags) => setEdit({ ...edit, tags })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("capture.fType")}>
                      <select
                        value={edit.type}
                        onChange={(e) =>
                          setEdit({ ...edit, type: e.target.value as KnowledgeType })
                        }
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
                      <TextInput
                        value={edit.category}
                        onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                      />
                    </Field>
                  </div>
                  <p className="text-[12px] text-muted">{t("ko.editNote")}</p>
                  {err ? (
                    <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                      {err}
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      disabled={save.isPending || edit.title.trim().length === 0}
                      onClick={() => save.mutate()}
                    >
                      {t("ko.saveEdit")}
                    </Button>
                    <Button variant="ghost" onClick={() => setEdit(null)}>
                      {t("ko.cancelEdit")}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="mt-3 text-xl font-semibold text-ink">{ko.title}</h2>
                  <div className="mt-2">
                    <ConfidenceBar value={ko.confidence} />
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <SectionLabel>{t("ko.statement")}</SectionLabel>
                      <p className="text-[14.5px] leading-relaxed text-text">{ko.statement}</p>
                    </div>
                    {ko.conditions.length > 0 ? (
                      <div>
                        <SectionLabel>{t("ko.conditions")}</SectionLabel>
                        <ul className="list-inside list-disc text-[13.5px] text-text">
                          {ko.conditions.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {ko.measures.length > 0 ? (
                      <div className="rounded-card bg-trust-pos-bg p-3">
                        <SectionLabel>{t("ko.measures")}</SectionLabel>
                        <ul className="list-inside list-disc text-[13.5px] text-trust-pos-text">
                          {ko.measures.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {ko.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {ko.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-pill bg-page px-2 py-0.5 font-mono text-[11px] text-muted"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-4">
                    {role === "controller" || role === "admin" ? (
                      <>
                        <Button
                          variant="primary"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ action: "rate", verdict: "up" })}
                        >
                          {t("ko.validate")}
                        </Button>
                        <Button
                          disabled={act.isPending}
                          onClick={() => act.mutate({ action: "rate", verdict: "warn" })}
                        >
                          {t("ko.conditional")}
                        </Button>
                        <Button
                          disabled={act.isPending}
                          onClick={() => act.mutate({ action: "rate", verdict: "down" })}
                        >
                          {t("ko.reject")}
                        </Button>
                      </>
                    ) : null}
                    <Button
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: "revalidate" })}
                    >
                      {t("ko.stillValid")}
                    </Button>
                  </div>
                  {err ? (
                    <div className="mt-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                      {err}
                    </div>
                  ) : null}
                </>
              )}
            </Card>

            <div className="space-y-5">
              <Card>
                <SectionLabel>{t("ko.provenance")}</SectionLabel>
                <ProvenanceLine
                  author={ko.author}
                  originalAuthor={ko.originalAuthor}
                  domain={ko.category}
                  version={ko.version}
                />
              </Card>
              <Card>
                <SectionLabel>{t("ko.history")}</SectionLabel>
                <ol className="space-y-3">
                  {ko.history.map((h) => (
                    <li key={h.version} className="border-l-2 border-hairline pl-3">
                      <div className="font-mono text-[11px] text-muted-2">
                        v{h.version} · {new Date(h.at).toLocaleDateString()}
                      </div>
                      <div className="text-[12.5px] text-text">{h.note || h.author}</div>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}

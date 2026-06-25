import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Pencil, X } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { type KoAction, endpoints } from "../api/endpoints";
import { useDirectory, useKo, useKos } from "../api/hooks";
import type { ConflictType, KnowledgeObject, KnowledgeType } from "../api/types";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
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
import { fileToThumbDataUrl } from "../lib/files";

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

const CONFLICT_TYPES: readonly ConflictType[] = [
  "truth",
  "experience",
  "context",
  "temporal",
  "role",
];

interface ConflictForm {
  koB: string;
  type: ConflictType;
  description: string;
}

export function KnowledgeDetail(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { role } = useRole();
  const query = useKo(id);
  const koList = useKos();
  const dir = useDirectory();
  const nameOf = (uid: string): string => dir.data?.find((d) => d.id === uid)?.name || uid;
  const qc = useQueryClient();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [conflict, setConflict] = useState<ConflictForm | null>(null);
  const [commentText, setCommentText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [newAuthor, setNewAuthor] = useState("");
  const { push } = useToast();
  const canEdit = role !== "viewer";
  const canReview = role === "controller" || role === "admin";
  // SCRUM-144: Autor-Übergabe nutzt users.manage-Pfad → nur Admin.
  const canTransfer = role === "admin";

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["ko", id] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["conflicts"] });
  };

  const act = useMutation({
    mutationFn: (body: KoAction) => endpoints.ko.act(id, body),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-144: Autorenübergabe über bestehende KO-Action transfer-author.
  const transfer = useMutation({
    mutationFn: (nextAuthor: string) =>
      endpoints.ko.act(id, { action: "transfer-author", newAuthor: nextAuthor }),
    onSuccess: () => {
      invalidate();
      setNewAuthor("");
      push("success", t("ko.transferDone"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  const comment = useMutation({
    mutationFn: () => endpoints.ko.act(id, { action: "comment", text: commentText.trim() }),
    onSuccess: () => {
      invalidate();
      setCommentText("");
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const attach = useMutation({
    mutationFn: (att: { name: string; mime: string; dataUrl: string }) =>
      endpoints.ko.act(id, { action: "attach", attachment: att }),
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const detach = useMutation({
    mutationFn: (attachmentId: string) => endpoints.ko.act(id, { action: "detach", attachmentId }),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    try {
      const dataUrl = await fileToThumbDataUrl(file);
      attach.mutate({ name: file.name, mime: "image/jpeg", dataUrl });
    } catch {
      setErr(t("state.error"));
    }
  };

  const report = useMutation({
    mutationFn: () => {
      if (!conflict || !conflict.koB) {
        throw new Error("no target");
      }
      return endpoints.ko.act(id, {
        action: "conflict",
        conflict: {
          koA: id,
          koB: conflict.koB,
          type: conflict.type,
          description: conflict.description,
        },
      });
    },
    onSuccess: () => {
      invalidate();
      setConflict(null);
      setErr(null);
    },
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
                    {canReview ? (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setConflict(conflict ? null : { koB: "", type: "truth", description: "" })
                        }
                      >
                        {t("ko.reportConflict")}
                      </Button>
                    ) : null}
                  </div>

                  {conflict ? (
                    <div className="mt-4 space-y-3 rounded-card border border-trust-crit-fill/30 bg-trust-crit-bg/40 p-4">
                      <SectionLabel>{t("ko.conflictTitle")}</SectionLabel>
                      <Field label={t("ko.conflictTarget")}>
                        <select
                          value={conflict.koB}
                          onChange={(e) => setConflict({ ...conflict, koB: e.target.value })}
                          className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
                        >
                          <option value="">{t("ko.conflictTargetPlaceholder")}</option>
                          {(koList.data ?? [])
                            .filter((k) => k.id !== id)
                            .map((k) => (
                              <option key={k.id} value={k.id}>
                                {k.title}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label={t("ko.conflictType")}>
                        <select
                          value={conflict.type}
                          onChange={(e) =>
                            setConflict({ ...conflict, type: e.target.value as ConflictType })
                          }
                          className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
                        >
                          {CONFLICT_TYPES.map((ct) => (
                            <option key={ct} value={ct}>
                              {t(`con.type.${ct}`)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={t("ko.conflictDesc")}>
                        <textarea
                          value={conflict.description}
                          onChange={(e) =>
                            setConflict({ ...conflict, description: e.target.value })
                          }
                          rows={2}
                          className={textareaCls}
                        />
                      </Field>
                      <Button
                        variant="primary"
                        disabled={report.isPending || !conflict.koB}
                        onClick={() => report.mutate()}
                      >
                        {t("ko.conflictSubmit")}
                      </Button>
                    </div>
                  ) : null}

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
                  author={nameOf(ko.author)}
                  originalAuthor={nameOf(ko.originalAuthor)}
                  domain={ko.category}
                  version={ko.version}
                />
                {canTransfer ? (
                  <div className="mt-3 border-t border-hairline pt-3">
                    <div className="mb-1.5 font-mono text-micro uppercase tracking-wider text-muted-2">
                      {t("ko.transferTitle")}
                    </div>
                    <div className="mb-2 text-[12px] text-muted">
                      {t("ko.transferOriginal")}: {nameOf(ko.originalAuthor)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={t("ko.transferTitle")}
                        value={newAuthor}
                        onChange={(e) => setNewAuthor(e.target.value)}
                        className="h-9 flex-1 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text outline-none focus:border-ink/30"
                      >
                        <option value="">{t("ko.transferPick")}</option>
                        {(dir.data ?? [])
                          .filter((d) => d.id !== ko.author)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                      <Button
                        variant="primary"
                        disabled={transfer.isPending || !newAuthor}
                        onClick={() => transfer.mutate(newAuthor)}
                      >
                        {t("ko.transfer")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
              <Card>
                <SectionLabel>{t("ko.history")}</SectionLabel>
                <ol className="space-y-3">
                  {ko.history.map((h) => (
                    <li key={h.version} className="border-l-2 border-hairline pl-3">
                      <div className="font-mono text-[11px] text-muted-2">
                        v{h.version} · {new Date(h.at).toLocaleDateString()}
                      </div>
                      <div className="text-[12.5px] text-text">{h.note || nameOf(h.author)}</div>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card>
                <SectionLabel>{t("ko.comments")}</SectionLabel>
                <div className="space-y-3">
                  {(ko.comments ?? []).length === 0 ? (
                    <p className="text-[13px] text-muted">{t("ko.commentsEmpty")}</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {(ko.comments ?? []).map((cm) => (
                        <li key={cm.id} className="border-l-2 border-hairline pl-3">
                          <div className="font-mono text-[11px] text-muted-2">
                            {nameOf(cm.author)} · {new Date(cm.at).toLocaleDateString()}
                          </div>
                          <div className="text-[13px] text-text">{cm.text}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="space-y-2 border-t border-hairline pt-3">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={2}
                      placeholder={t("ko.commentPlaceholder")}
                      className={textareaCls}
                    />
                    <Button
                      variant="primary"
                      disabled={comment.isPending || commentText.trim().length === 0}
                      onClick={() => comment.mutate()}
                    >
                      {t("ko.commentAdd")}
                    </Button>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionLabel>{t("ko.attachments")}</SectionLabel>
                {(ko.attachments ?? []).length === 0 ? (
                  <p className="text-[13px] text-muted">{t("ko.attachmentsEmpty")}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {(ko.attachments ?? []).map((a) => (
                      <div key={a.id} className="group relative">
                        <a href={a.dataUrl} target="_blank" rel="noreferrer">
                          <img
                            src={a.dataUrl}
                            alt={a.name}
                            className="h-20 w-full rounded-card border border-hairline object-cover"
                          />
                        </a>
                        {canEdit ? (
                          <button
                            type="button"
                            aria-label={t("ko.attachmentRemove")}
                            onClick={() => detach.mutate(a.id)}
                            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                {canEdit ? (
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
                    <Paperclip size={14} />
                    {attach.isPending ? t("ko.attachmentUploading") : t("ko.attachmentAdd")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={attach.isPending}
                      onChange={(e) => void onPickFile(e)}
                    />
                  </label>
                ) : null}
              </Card>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}

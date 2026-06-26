import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, FilePlus2, RotateCcw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDrafts, useLibrarySearch } from "../api/hooks";
import type { AnswerResult } from "../api/types";
import { useToast } from "../app/ToastContext";
import { ConfidenceBar, KnowledgeTypeTag, StatusPill } from "../components/trust";
import { selectAnswer } from "../lib/askResponse";
import { deriveStatus } from "../lib/displayStatus";
import {
  type DraftFormState,
  EMPTY_DRAFT_FORM,
  draftTitle,
  draftToForm,
  formToPayload,
  isDraftFormFillable,
} from "../lib/draftForm";
import type { EvidenceTone } from "../lib/knowledgeClass";
import { summarizeAnswer } from "../lib/mobileAsk";

type MobileTab = "capture" | "ask" | "lookup";

const EVIDENCE_TONE: Record<EvidenceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
  neutral: "bg-page text-muted",
};

// SCRUM-113: echte mobile Erfassung (FE-MOB-02/04/06) + Fragen (FE-MOB-03) + Wissenszugriff (FE-MOB-05).
// Alle Aktionen über bestehende APIs/State; Bestätigung über den Toast-Bus.
export function Mobile(): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<MobileTab>("capture");

  // --- Erfassen (FE-MOB-02/04) ---
  const drafts = useDrafts();
  const [form, setForm] = useState<DraftFormState>({ ...EMPTY_DRAFT_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const resetForm = (): void => {
    setForm({ ...EMPTY_DRAFT_FORM });
    setEditingId(null);
  };
  const invalidateDrafts = (): void => void qc.invalidateQueries({ queryKey: ["drafts"] });
  const fail = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

  const save = useMutation({
    mutationFn: () => {
      const payload = formToPayload(form);
      return editingId
        ? endpoints.drafts.update(editingId, payload)
        : endpoints.drafts.create(payload);
    },
    onSuccess: () => {
      invalidateDrafts();
      push("success", editingId ? t("mob.updated") : t("mob.saved"));
      resetForm();
    },
    onError: fail,
  });
  const discard = useMutation({
    mutationFn: (id: string) => endpoints.drafts.remove(id),
    onSuccess: (_d, id) => {
      invalidateDrafts();
      push("success", t("mob.discarded"));
      if (editingId === id) {
        resetForm();
      }
    },
    onError: fail,
  });
  const resume = (id: string): void => {
    const d = (drafts.data ?? []).find((x) => x.id === id);
    if (d) {
      setForm(draftToForm(d));
      setEditingId(id);
    }
  };

  // --- Fragen (FE-MOB-03) ---
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const ask = useMutation({
    mutationFn: (question: string) => endpoints.ask.ask(question),
    onSuccess: (res) => setAnswer(selectAnswer(res)),
    onError: (e) => {
      setAnswer(null);
      push("error", e instanceof ApiError ? e.message : t("state.error"));
    },
  });

  // --- Suchen (FE-MOB-05) ---
  const [sq, setSq] = useState("");
  const search = useLibrarySearch(sq.trim() ? { q: sq.trim() } : {});

  const tabCls = (active: boolean): string =>
    `flex-1 rounded-btn py-1.5 text-[12px] font-semibold ${
      active ? "bg-ink text-white" : "text-muted"
    }`;

  return (
    <div className="grid min-h-[520px] place-items-center rounded-card bg-page p-6">
      <div className="w-[340px] overflow-hidden rounded-[34px] border-4 border-ink bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-sans text-[15px] font-bold tracking-[2px] text-ink">KLARWERK</span>
          <span className="flex items-center gap-1 font-mono text-[11px] text-trust-pos-text">
            <span className="h-1.5 w-1.5 rounded-full bg-trust-pos-fill" />
            online
          </span>
        </div>

        {/* Tabs */}
        <div className="mb-3 flex gap-1 rounded-btn bg-page p-1">
          <button
            type="button"
            className={tabCls(tab === "capture")}
            onClick={() => setTab("capture")}
          >
            {t("mob.tabCapture")}
          </button>
          <button type="button" className={tabCls(tab === "ask")} onClick={() => setTab("ask")}>
            {t("mob.tabAsk")}
          </button>
          <button
            type="button"
            className={tabCls(tab === "lookup")}
            onClick={() => setTab("lookup")}
          >
            {t("mob.tabLookup")}
          </button>
        </div>

        {tab === "capture" ? (
          <div>
            <p className="mb-2 text-[13px] text-muted">
              {editingId ? t("mob.editing") : t("mob.sub")}
            </p>
            <div className="space-y-2">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t("mob.formTitle")}
                className="h-10 w-full rounded-input border border-hairline bg-page px-3 text-sm outline-none focus:border-ink/30"
              />
              <textarea
                value={form.statement}
                onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))}
                placeholder={t("mob.formStatement")}
                rows={3}
                className="w-full resize-y rounded-input border border-hairline bg-page p-2.5 text-sm outline-none focus:border-ink/30"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={save.isPending || !isDraftFormFillable(form)}
                  onClick={() => save.mutate()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-btn bg-ink py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  <Check size={15} />
                  {editingId ? t("mob.update") : t("mob.save")}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex items-center gap-1.5 rounded-btn border border-hairline px-3 py-2.5 text-[13px] font-semibold text-muted hover:text-text"
                  >
                    <FilePlus2 size={15} />
                    {t("mob.new")}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                {t("mob.drafts")}
              </div>
              {(drafts.data ?? []).length === 0 ? (
                <p className="text-[12.5px] text-muted">{t("mob.draftsEmpty")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {(drafts.data ?? []).map((d) => (
                    <li
                      key={d.id}
                      className={`flex items-center gap-2 rounded-input border px-2.5 py-2 ${
                        editingId === d.id ? "border-ink bg-page" : "border-hairline"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text">
                        {draftTitle(d, t("capture.draftFallbackTitle"))}
                      </span>
                      <button
                        type="button"
                        title={t("mob.resume")}
                        onClick={() => resume(d.id)}
                        className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        type="button"
                        title={t("mob.discard")}
                        disabled={discard.isPending}
                        onClick={() => discard.mutate(d.id)}
                        className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {tab === "ask" ? (
          <div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) {
                  ask.mutate(q.trim());
                }
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("ask.placeholder")}
                className="h-10 flex-1 rounded-input border border-hairline bg-page px-3 text-sm outline-none focus:border-ink/30"
              />
              <button
                type="submit"
                disabled={ask.isPending || q.trim().length === 0}
                className="grid h-10 w-10 place-items-center rounded-btn bg-ink text-white disabled:opacity-50"
              >
                <ArrowRight size={16} />
              </button>
            </form>

            {answer
              ? (() => {
                  const s = summarizeAnswer(answer);
                  return s.answered ? (
                    <div className="mt-3 rounded-card border border-hairline p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${EVIDENCE_TONE[s.evidence.tone]}`}
                        >
                          {t("ask.evidence")}: {t(s.evidence.labelKey)}
                        </span>
                        <span className="shrink-0">
                          <ConfidenceBar value={s.trust} showLabel={false} />
                        </span>
                      </div>
                      <p className="text-[14px] leading-relaxed text-text">{s.text}</p>
                      {s.sources.length > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase text-muted-2">
                            {t("ask.sources")}
                          </span>
                          {s.sources.map((id) => (
                            <Link
                              key={id}
                              to={`/wissen/${id}`}
                              className="font-mono text-[11px] text-brand"
                            >
                              {id}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-card border border-dashed border-hairline p-3">
                      <p className="text-[14px] font-semibold text-text">{t("ask.noBasisTitle")}</p>
                      <p className="mt-1 text-[12.5px] text-muted">{t("ask.noBasisBody")}</p>
                      <Link
                        to="/risiko"
                        className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand"
                      >
                        {t("ask.toGaps")}
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  );
                })()
              : null}
          </div>
        ) : null}

        {tab === "lookup" ? (
          <div>
            <div className="flex items-center gap-2 rounded-input border border-hairline bg-page px-3">
              <Search size={15} className="text-muted-2" />
              <input
                value={sq}
                onChange={(e) => setSq(e.target.value)}
                placeholder={t("mob.searchPlaceholder")}
                className="h-10 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="mt-3">
              {(search.data ?? []).length === 0 ? (
                <p className="text-[12.5px] text-muted">{t("mob.searchEmpty")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {(search.data ?? []).slice(0, 20).map((k) => (
                    <li key={k.id}>
                      <Link
                        to={`/wissen/${k.id}`}
                        className="block rounded-input border border-hairline p-2.5 hover:bg-hairline-soft"
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          <StatusPill status={deriveStatus(k)} />
                          <KnowledgeTypeTag type={k.type} />
                          <span className="ml-auto font-mono text-[10px] text-muted-2">
                            T{k.trust}
                          </span>
                        </div>
                        <div className="truncate text-[13px] text-text">{k.title}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useDirectory, useValidationBoard } from "../api/hooks";
import type { Verdict } from "../api/types";
import { useSession } from "../app/AuthContext";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { ConfidenceBar, KnowledgeTypeTag, KoAuthorLine, StatusPill } from "../components/trust";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
import { koAuthorParts } from "../lib/koAuthor";
import { REVIEW_DECISIONS, type ReviewTone } from "../lib/reviewDecision";
import { type TrustBand, reviewSignals, sortByReviewPriority } from "../lib/reviewSignals";
import {
  type FeedbackVerdict,
  buildValidationFeedback,
  isFeedbackSubmittable,
} from "../lib/validationFeedback";
import {
  EMPTY_VALIDATION_FILTER,
  categoryOptions,
  matchesValidationFilter,
  tagOptions,
  typeOptions,
} from "../lib/validationFilters";

// SCRUM-249: Trust-Band → Tönung der Trust-Plakette (kritisch/mittel/gut).
const TRUST_TONE: Record<TrustBand, string> = {
  low: "bg-trust-crit-bg text-trust-crit-text",
  mid: "bg-trust-warn-bg text-trust-warn-text",
  high: "bg-trust-pos-bg text-trust-pos-text",
};

// SCRUM-258: Tönung der drei Review-Entscheidungs-Schaltflächen (Freigeben/Rückfrage/Ablehnen).
const DECISION_TONE: Record<ReviewTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
};

export function Validation(): JSX.Element {
  const { t } = useTranslation();
  const query = useValidationBoard();
  const users = useDirectory();
  const { user } = useSession();
  const qc = useQueryClient();
  // FR-LIF-04: Autor je KO-Karte (Namen via Directory, Fallback ID).
  const nameOf = (uid: string): string => users.data?.find((d) => d.id === uid)?.name || uid;
  const [filter, setFilter] = useState(EMPTY_VALIDATION_FILTER);
  // Offenes Feedback-Formular (FE-VAL-06): pro KO + gewählter Verdict.
  const [feedback, setFeedback] = useState<{ id: string; verdict: FeedbackVerdict } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const selectCls =
    "h-10 rounded-input border border-hairline bg-surface px-2 text-sm text-text outline-none focus:border-ink/30";

  const invalidate = (): void => void qc.invalidateQueries({ queryKey: ["validation"] });

  const rate = useMutation({
    mutationFn: ({ id, verdict }: { id: string; verdict: Verdict }) =>
      endpoints.ko.act(id, { action: "rate", verdict }),
    onSuccess: invalidate,
  });

  // Gelb/Rot: erst Pflicht-Kommentar, dann Bewertung (FE-VAL-06).
  const reviewWithFeedback = useMutation({
    mutationFn: async ({
      id,
      verdict,
      text,
    }: { id: string; verdict: FeedbackVerdict; text: string }) => {
      await endpoints.ko.act(id, {
        action: "comment",
        text: buildValidationFeedback(verdict, text),
      });
      await endpoints.ko.act(id, { action: "rate", verdict });
    },
    onSuccess: () => {
      invalidate();
      setFeedback(null);
      setFeedbackText("");
    },
  });

  const openFeedback = (id: string, verdict: FeedbackVerdict): void => {
    setFeedback({ id, verdict });
    setFeedbackText("");
    reviewWithFeedback.reset();
  };

  const assign = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      endpoints.ko.act(id, { action: "assign", userIds: [userId] }),
    onSuccess: invalidate,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader kicker={t("val.kicker")} title={t("nav.validation")} />
      <p className="-mt-3 mb-4 text-sm text-muted">{t("val.intro")}</p>
      <QueryState
        query={query}
        emptyText={t("val.empty")}
        emptyExtra={<EmptyStateCtas context="validation" />}
      >
        {(items) => {
          const cats = categoryOptions(items);
          const tags = tagOptions(items);
          const types = typeOptions(items);
          // SCRUM-249: handlungsnah priorisieren (Autor-Transfer/niedriger Trust zuerst) — Filter
          // bleiben unverändert, es wird nichts verworfen, nur die Reihenfolge geschärft.
          const visible = sortByReviewPriority(
            items.filter((k) => matchesValidationFilter(k, filter, user?.id ?? null)),
          );
          return (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  value={filter.search}
                  onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                  placeholder={t("val.filter")}
                  className="h-10 min-w-[12rem] flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
                />
                <select
                  value={filter.type}
                  onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">{t("val.filterAllTypes")}</option>
                  {types.map((tp) => (
                    <option key={tp} value={tp}>
                      {t(`ktype.${tp}`)}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.category}
                  onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">{t("val.filterAllCategories")}</option>
                  {cats.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.tag}
                  onChange={(e) => setFilter((f) => ({ ...f, tag: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">{t("val.filterAllTags")}</option>
                  {tags.map((tg) => (
                    <option key={tg} value={tg}>
                      {tg}
                    </option>
                  ))}
                </select>
                <label className="flex h-10 items-center gap-1.5 rounded-input border border-hairline bg-surface px-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={filter.mineOnly}
                    onChange={(e) => setFilter((f) => ({ ...f, mineOnly: e.target.checked }))}
                  />
                  {t("val.filterMine")}
                </label>
              </div>
              <div className="space-y-3">
                {visible.map((k) => {
                  const sig = reviewSignals(k);
                  return (
                    <div key={k.id} className="space-y-2">
                      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <KnowledgeTypeTag type={k.type} />
                            <StatusPill status={sig.status} />
                            <span className="font-mono text-[11px] text-muted-2">{k.category}</span>
                          </div>
                          <Link
                            to={`/wissen/${k.id}`}
                            className="block truncate text-[14px] font-medium text-text hover:text-ink"
                          >
                            {k.title}
                          </Link>
                          {/* SCRUM-249: Review-Signale kompakt — Trust, Version, Ziel, Provenance. */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <ConfidenceBar value={k.confidence} showLabel={false} />
                            <span
                              className={`rounded-pill px-1.5 py-0.5 font-mono text-[10px] font-semibold ${TRUST_TONE[sig.trustBand]}`}
                            >
                              {t("val.trust")} {sig.trust}
                            </span>
                            <span className="font-mono text-[10px] text-muted-2">
                              v{sig.version}
                            </span>
                            <span className="font-mono text-[11px] text-muted-2">
                              {t("val.target", { n: sig.needed })}
                            </span>
                            {sig.authorTransferred ? (
                              <span className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-trust-warn-text">
                                {t("val.transferred")}
                              </span>
                            ) : null}
                            {sig.assigned ? (
                              <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
                                {t("val.assigned")}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1">
                            <KoAuthorLine {...koAuthorParts(k, nameOf)} />
                          </div>
                          {/* SCRUM-249: ehrlicher Entscheidungs-Hinweis (aus Trust-Band abgeleitet). */}
                          <p className="mt-1 text-[11.5px] text-muted">
                            <span className="font-semibold text-text">
                              {t("val.decisionLabel")}{" "}
                            </span>
                            {t(`val.decision.${sig.trustBand}`)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
                          {/* SCRUM-258: Review-Entscheidung textlich geführt — gleiche Mutationen
                              (up/warn/down), Rückfrage/Ablehnen öffnen weiterhin das Pflicht-Feedback. */}
                          <div className="flex flex-wrap gap-1.5 sm:justify-end">
                            {REVIEW_DECISIONS.map((d) => {
                              const active =
                                feedback?.id === k.id && feedback.verdict === d.verdict;
                              return (
                                <button
                                  key={d.verdict}
                                  type="button"
                                  title={t(d.labelKey)}
                                  disabled={
                                    d.verdict === "up"
                                      ? rate.isPending || reviewWithFeedback.isPending
                                      : reviewWithFeedback.isPending
                                  }
                                  onClick={() =>
                                    d.verdict === "up"
                                      ? rate.mutate({ id: k.id, verdict: "up" })
                                      : openFeedback(k.id, d.verdict)
                                  }
                                  className={`flex h-9 items-center gap-1.5 rounded-btn px-2.5 text-[12.5px] font-semibold hover:opacity-80 disabled:opacity-50 ${DECISION_TONE[d.tone]} ${
                                    active ? "ring-2 ring-current" : ""
                                  }`}
                                >
                                  {d.verdict === "up" ? (
                                    <Check size={15} />
                                  ) : d.verdict === "warn" ? (
                                    <Minus size={15} />
                                  ) : (
                                    <X size={15} />
                                  )}
                                  <span>{t(d.labelKey)}</span>
                                  {d.requiresFeedback ? <sup className="-mr-0.5">*</sup> : null}
                                </button>
                              );
                            })}
                          </div>
                          {/* SCRUM-258: Pflicht-Feedback sichtbar machen (Rückfrage/Ablehnen). */}
                          <p className="text-[10.5px] text-muted-2 sm:text-right">
                            {t("val.feedbackRequiredHint")}
                          </p>
                          <select
                            value=""
                            disabled={assign.isPending}
                            onChange={(e) => {
                              if (e.target.value) {
                                assign.mutate({ id: k.id, userId: e.target.value });
                              }
                            }}
                            className="h-8 w-40 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
                          >
                            <option value="">{t("val.assign")}</option>
                            {(users.data ?? []).map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name || u.id}
                              </option>
                            ))}
                          </select>
                        </div>
                      </Card>
                      {feedback?.id === k.id ? (
                        <Card className="border-hairline/80">
                          <div className="mb-2 text-[12.5px] font-semibold text-text">
                            {feedback.verdict === "warn"
                              ? t("val.feedback.condTitle")
                              : t("val.feedback.rejTitle")}
                          </div>
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder={t("val.feedback.placeholder")}
                            rows={3}
                            className="w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
                          />
                          {reviewWithFeedback.isError ? (
                            <div className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                              {t("val.feedback.error")}
                            </div>
                          ) : null}
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              disabled={reviewWithFeedback.isPending}
                              onClick={() => {
                                setFeedback(null);
                                setFeedbackText("");
                              }}
                            >
                              {t("val.feedback.cancel")}
                            </Button>
                            <Button
                              variant="primary"
                              disabled={
                                reviewWithFeedback.isPending || !isFeedbackSubmittable(feedbackText)
                              }
                              onClick={() =>
                                reviewWithFeedback.mutate({
                                  id: k.id,
                                  verdict: feedback.verdict,
                                  text: feedbackText,
                                })
                              }
                            >
                              {t("val.feedback.submit")}
                            </Button>
                          </div>
                        </Card>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

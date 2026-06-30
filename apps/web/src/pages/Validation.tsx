import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useDirectory, useValidationBoard } from "../api/hooks";
import type { Verdict } from "../api/types";
import { useSession } from "../app/AuthContext";
import { DemoBanner } from "../components/DemoBanner";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { ValidationReviewContext } from "../components/ValidationReviewContext";
import { ConfidenceBar, KnowledgeTypeTag, KoAuthorLine, StatusPill } from "../components/trust";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
import {
  DEMO_KNOWLEDGE_FILTERS,
  type DemoKnowledgeFilter,
  demoKnowledgeFilterLabelKey,
  matchesDemoKnowledgeFilter,
  ownKnowledgeEmptyHint,
  readDemoKnowledgeFilter,
} from "../lib/demoKnowledge";
import { isDemoContext } from "../lib/demoPilotPath";
import { koAuthorParts } from "../lib/koAuthor";
import {
  REVIEW_DECISIONS,
  type ReviewOutcomeTone,
  type ReviewTone,
  type ReviewVerdict,
  reviewNextSteps,
  reviewOutcome,
} from "../lib/reviewDecision";
import {
  DECISION_IMPACTS,
  DECISION_TRUST_NOTE_KEY,
  REVIEW_CHECK_ITEMS,
  decisionImpact,
  reviewGuidanceFocusKey,
} from "../lib/reviewGuidance";
import {
  type ReviewWorkTone,
  type TrustBand,
  reviewSignals,
  reviewWorkView,
  sortByReviewPriority,
} from "../lib/reviewSignals";
import {
  applyBoardFocusParams,
  boardEmptyKind,
  boardFocusActive,
  resetBoardFocusParams,
} from "../lib/validationBoardFocus";
import {
  type FeedbackVerdict,
  buildValidationFeedback,
  isFeedbackSubmittable,
} from "../lib/validationFeedback";
import {
  EMPTY_VALIDATION_FILTER,
  type ValidationFilterState,
  applyMineOnlyParam,
  categoryOptions,
  matchesValidationFilter,
  mineQueueEmptyHint,
  readMineOnlyFilter,
  tagOptions,
  typeOptions,
} from "../lib/validationFilters";
import {
  REVIEW_FOCUS_FILTERS,
  type ReviewFocusFilter,
  countByReviewFocus,
  matchesReviewFocus,
  readReviewFocusFilter,
  reviewFocusLabelKey,
  validationReviewContext,
} from "../lib/validationReviewContext";

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

// SCRUM-365: Textfarbe der Entscheidungswirkungen in der „Was prüfe ich?"-Führung (Grün/Gelb/Rot).
const IMPACT_TEXT_TONE: Record<"pos" | "warn" | "crit", string> = {
  pos: "text-trust-pos-text",
  warn: "text-trust-warn-text",
  crit: "text-trust-crit-text",
};

// SCRUM-287: Review-Arbeitszustand konsistent zu MyTasks (neu/offen, zugewiesen, in Prüfung).
const REVIEW_WORK_TONE: Record<ReviewWorkTone, string> = {
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
  pos: "bg-trust-pos-bg text-trust-pos-text",
};

// SCRUM-292: Success-/Outcome-Card passend zum Verdict tönen (up/warn/down).
const OUTCOME_TONE: Record<
  ReviewOutcomeTone,
  { card: string; text: string; subtle: string; close: string }
> = {
  pos: {
    card: "border-trust-pos-fill/40 bg-trust-pos-bg",
    text: "text-trust-pos-text",
    subtle: "text-trust-pos-text/90",
    close: "text-trust-pos-text/70 hover:text-trust-pos-text",
  },
  warn: {
    card: "border-trust-warn-fill/40 bg-trust-warn-bg",
    text: "text-trust-warn-text",
    subtle: "text-trust-warn-text/90",
    close: "text-trust-warn-text/70 hover:text-trust-warn-text",
  },
  crit: {
    card: "border-trust-crit-fill/40 bg-trust-crit-bg",
    text: "text-trust-crit-text",
    subtle: "text-trust-crit-text/90",
    close: "text-trust-crit-text/70 hover:text-trust-crit-text",
  },
};

export function Validation(): JSX.Element {
  const { t } = useTranslation();
  const [params, setSearchParams] = useSearchParams();
  const query = useValidationBoard();
  const users = useDirectory();
  const { user } = useSession();
  const qc = useQueryClient();
  // FR-LIF-04: Autor je KO-Karte (Namen via Directory, Fallback ID).
  const nameOf = (uid: string): string => users.data?.find((d) => d.id === uid)?.name || uid;
  // SCRUM-364 / AG-15 follow-up: „Mir zugewiesen"-Linse lazy aus ?mine=1 (Ziel der Assignment-
  // Benachrichtigung) — die übrigen Filter starten leer. Aktiviert nur die vorhandene mineOnly-Filterung.
  const [filter, setFilter] = useState<ValidationFilterState>(() => ({
    ...EMPTY_VALIDATION_FILTER,
    mineOnly: readMineOnlyFilter(params),
  }));
  // SCRUM-364: „Mir zugewiesen" umschalten + URL synchron halten (übrige Query bleibt erhalten).
  const setMineOnly = (mineOnly: boolean): void => {
    setFilter((f) => ({ ...f, mineOnly }));
    setSearchParams((prev) => applyMineOnlyParam(prev, mineOnly), { replace: true });
  };
  // SCRUM-311: Herkunftsfilter (Demo/Eigenes) — ergänzend zur Review-Auswahl; lazy aus ?origin=…
  // (z. B. Capture-Success → eigenes Wissen), fehlend/ungültig → „all". Nur Ansicht, kein Review-Status.
  const [demoFilter, setDemoFilter] = useState<DemoKnowledgeFilter>(() =>
    readDemoKnowledgeFilter(params),
  );
  // SCRUM-327: Review-Fokus (Alle/Neu/Überarbeitet) — lazy aus ?review=…, fehlend/ungültig → „all".
  // Nur Ansicht; nutzt dieselbe neu-vs.-revision-Logik (Version > 1) wie SCRUM-326.
  const [reviewFocus, setReviewFocus] = useState<ReviewFocusFilter>(() =>
    readReviewFocusFilter(params),
  );
  // SCRUM-328: beide Fokusfilter auf Standard zurücksetzen (State + URL; übrige Query bleibt erhalten).
  const resetBoardFocus = (): void => {
    setDemoFilter("all");
    setReviewFocus("all");
    setSearchParams((prev) => resetBoardFocusParams(prev), { replace: true });
  };
  // Offenes Feedback-Formular (FE-VAL-06): pro KO + gewählter Verdict.
  const [feedback, setFeedback] = useState<{ id: string; verdict: FeedbackVerdict } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  // SCRUM-277: letzte erfolgreiche Entscheidung → Rückmeldung + nächster Schritt (KO ansehen/nutzen).
  const [lastDecision, setLastDecision] = useState<{
    id: string;
    title: string;
    verdict: ReviewVerdict;
  } | null>(null);
  const selectCls =
    "h-10 rounded-input border border-hairline bg-surface px-2 text-sm text-text outline-none focus:border-ink/30";

  const invalidate = (): void => void qc.invalidateQueries({ queryKey: ["validation"] });

  const rate = useMutation({
    // SCRUM-277: Titel mitführen → Rückmeldung/Next-Step benennt das betroffene KO.
    mutationFn: ({ id, verdict }: { id: string; title: string; verdict: Verdict }) =>
      endpoints.ko.act(id, { action: "rate", verdict }),
    onSuccess: (_data, vars) => {
      invalidate();
      setLastDecision({ id: vars.id, title: vars.title, verdict: vars.verdict });
    },
  });

  // Gelb/Rot: erst Pflicht-Kommentar, dann Bewertung (FE-VAL-06).
  const reviewWithFeedback = useMutation({
    mutationFn: async ({
      id,
      verdict,
      text,
    }: { id: string; title: string; verdict: FeedbackVerdict; text: string }) => {
      await endpoints.ko.act(id, {
        action: "comment",
        text: buildValidationFeedback(verdict, text),
      });
      await endpoints.ko.act(id, { action: "rate", verdict });
    },
    onSuccess: (_data, vars) => {
      invalidate();
      setFeedback(null);
      setFeedbackText("");
      setLastDecision({ id: vars.id, title: vars.title, verdict: vars.verdict });
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
      {/* SCRUM-291: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="validation" /> : null}
      <p className="-mt-3 mb-4 text-sm text-muted">{t("val.intro")}</p>
      {/* SCRUM-277: Rückmeldung nach der Entscheidung + nächster Schritt (KO ansehen / optional nutzen). */}
      {lastDecision
        ? (() => {
            const outcome = reviewOutcome(lastDecision.verdict);
            const tone = OUTCOME_TONE[outcome.tone];
            return (
              <Card className={`mb-4 ${tone.card}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-[13px] font-semibold ${tone.text}`}>
                      {t("val.decisionSaved")}
                    </div>
                    <p className={`mt-0.5 truncate text-[12.5px] ${tone.subtle}`}>
                      {lastDecision.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    title={t("val.feedback.cancel")}
                    onClick={() => setLastDecision(null)}
                    className={`shrink-0 ${tone.close}`}
                  >
                    <X size={16} />
                  </button>
                </div>
                {/* SCRUM-292: ehrliche Folge-Aussage je Verdict — up nutzbar (wenn Status/Trust tragen),
                    warn/down bleiben Review-/Feedback-Arbeit; keine automatische/Fake-Validierung. */}
                <p className={`mt-2 text-[12px] leading-relaxed ${tone.subtle}`}>
                  {t(outcome.statusKey)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {reviewNextSteps(lastDecision).map((s) => (
                    <Link
                      key={s.to}
                      to={s.to}
                      className="inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
                    >
                      {t(s.labelKey)} <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              </Card>
            );
          })()
        : null}
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
          const boardFiltered = items.filter((k) =>
            matchesValidationFilter(k, filter, user?.id ?? null),
          );
          // SCRUM-311: Herkunfts-Zähler über die (review-)gefilterte Menge; dann ergänzend nach
          // Herkunft filtern. Nur Ansicht — Status/Trust/Review-Entscheidung unberührt.
          const demoCounts: Record<DemoKnowledgeFilter, number> = {
            all: boardFiltered.length,
            demo: boardFiltered.filter((k) => matchesDemoKnowledgeFilter(k, "demo")).length,
            "non-demo": boardFiltered.filter((k) => matchesDemoKnowledgeFilter(k, "non-demo"))
              .length,
          };
          // SCRUM-327: Review-Fokus über die fachlich + herkunfts-gefilterte Menge zählen, dann anwenden.
          const focusBase = boardFiltered.filter((k) => matchesDemoKnowledgeFilter(k, demoFilter));
          const reviewFocusCounts = countByReviewFocus(focusBase);
          const visible = sortByReviewPriority(
            focusBase.filter((k) => matchesReviewFocus(k, reviewFocus)),
          );
          // SCRUM-364 / AG-15: ehrlicher Leerzustand der persönlichen Linse (nur wenn „Mir zugewiesen"
          // aktiv ist und nichts für die Person offen ist) — hat Vorrang vor dem generischen Filter-Empty.
          const mineEmpty = mineQueueEmptyHint({
            mineOnly: filter.mineOnly,
            visibleCount: visible.length,
          });
          return (
            <>
              {/* SCRUM-364 / AG-15 follow-up: aktive „Mir zugewiesen"-Linse verständlich benennen —
                  „Das ist deine persönliche Review-Liste" + Zähler + Rückweg zur allgemeinen Liste. */}
              {filter.mineOnly ? (
                <Card className="mb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-ai">
                        {t("val.mineFocus.title")}
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">{t("val.mineFocus.hint")}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[11px] font-semibold text-text">
                        {t("val.mineFocus.count", { n: visible.length })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMineOnly(false)}
                        className="text-[11.5px] font-semibold text-muted hover:text-text"
                      >
                        {t("val.mineFocus.reset")}
                      </button>
                    </div>
                  </div>
                </Card>
              ) : null}
              {/* SCRUM-311: Herkunftsfilter (Demo/Eigenes) — nur Ansicht/Auffinden, KEIN Review-Status;
                  Labels konsistent mit der Library. Ersetzt nicht Status/Trust/Review-Entscheidung. */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                  {t("lib.originLabel")}:
                </span>
                {DEMO_KNOWLEDGE_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setDemoFilter(f);
                      // SCRUM-328: URL-Sync — Herkunft setzen, übrige Query (z. B. demo=stage1) erhalten.
                      setSearchParams(
                        (prev) => applyBoardFocusParams(prev, { origin: f, review: reviewFocus }),
                        { replace: true },
                      );
                    }}
                    className={`rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                      demoFilter === f
                        ? "border-ink bg-ink text-white"
                        : "border-hairline text-muted hover:text-text"
                    }`}
                  >
                    {t(demoKnowledgeFilterLabelKey(f))} · {demoCounts[f]}
                  </button>
                ))}
              </div>
              {/* SCRUM-327: Review-Fokus (Alle/Neu/Überarbeitet) — nur Ansicht; Counts über die fachlich
                  + herkunfts-gefilterte Menge. Ersetzt keinen Filter, ändert keinen Review-Status. */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                  {t("val.reviewFocus.label")}:
                </span>
                {REVIEW_FOCUS_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setReviewFocus(f);
                      // SCRUM-328: URL-Sync — Review-Fokus setzen, übrige Query erhalten.
                      setSearchParams(
                        (prev) => applyBoardFocusParams(prev, { origin: demoFilter, review: f }),
                        { replace: true },
                      );
                    }}
                    className={`rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                      reviewFocus === f
                        ? "border-ink bg-ink text-white"
                        : "border-hairline text-muted hover:text-text"
                    }`}
                  >
                    {t(reviewFocusLabelKey(f))} · {reviewFocusCounts[f]}
                  </button>
                ))}
              </div>
              {/* SCRUM-328: aktive Fokusfilter sichtbar benennen + zurücksetzbar. */}
              {boardFocusActive({ origin: demoFilter, review: reviewFocus }) ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-page px-3 py-2">
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                    {t("val.focusActive.label")}:
                  </span>
                  {demoFilter !== "all" ? (
                    <span className="rounded-pill bg-surface px-2 py-0.5 text-[11px] font-semibold text-text">
                      {t("lib.originLabel")}: {t(demoKnowledgeFilterLabelKey(demoFilter))}
                    </span>
                  ) : null}
                  {reviewFocus !== "all" ? (
                    <span className="rounded-pill bg-surface px-2 py-0.5 text-[11px] font-semibold text-text">
                      {t("val.reviewFocus.label")}: {t(reviewFocusLabelKey(reviewFocus))}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={resetBoardFocus}
                    className="ml-auto text-[11.5px] font-semibold text-muted hover:text-text"
                  >
                    {t("val.focusReset")}
                  </button>
                </div>
              ) : null}
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
                    onChange={(e) => setMineOnly(e.target.checked)}
                  />
                  {t("val.filterMine")}
                </label>
              </div>
              <div className="space-y-3">
                {/* SCRUM-364 / AG-15: spezifischer Leerzustand der persönlichen Linse — ruhig und
                    motivierend, mit Rückweg zur allgemeinen Liste. Vorrang vor dem generischen Filter-Empty. */}
                {mineEmpty ? (
                  <Card className="text-center">
                    <p className="text-[13px] font-semibold text-text">{t(mineEmpty.titleKey)}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{t(mineEmpty.hintKey)}</p>
                    <Button variant="ghost" className="mt-2" onClick={() => setMineOnly(false)}>
                      {t(mineEmpty.ctaKey)}
                    </Button>
                  </Card>
                ) : null}
                {/* SCRUM-328: ehrlicher Filter-Empty-State — Daten vorhanden, aber Filter zu eng.
                    QueryState behandelt den „gar keine Review-Arbeit"-Fall (items leer) separat. */}
                {!mineEmpty &&
                boardEmptyKind({ totalItems: items.length, visibleCount: visible.length }) ===
                  "filtered" ? (
                  <Card className="text-center">
                    <p className="text-[13px] text-muted">{t("val.focusEmpty.filtered")}</p>
                    {boardFocusActive({ origin: demoFilter, review: reviewFocus }) ? (
                      <Button variant="ghost" className="mt-2" onClick={resetBoardFocus}>
                        {t("val.focusReset")}
                      </Button>
                    ) : (
                      <p className="mt-1 text-[11.5px] text-muted-2">
                        {t("val.focusEmpty.otherFilters")}
                      </p>
                    )}
                  </Card>
                ) : null}
                {/* Beta Own-Knowledge Work Queue v0: bei aktiver „Eigenes Wissen"-Linse ohne eigene KOs
                    den Weg ins Erfassen zeigen — eigenes Wissen erscheint hier nach dem Speichern. */}
                {(() => {
                  const ownEmpty = ownKnowledgeEmptyHint({
                    filter: demoFilter,
                    count: demoCounts["non-demo"],
                  });
                  if (!ownEmpty) {
                    return null;
                  }
                  return (
                    <Card>
                      <p className="text-[13px] font-semibold text-text">{t(ownEmpty.titleKey)}</p>
                      <p className="mt-0.5 text-[12px] text-muted">{t(ownEmpty.hintKey)}</p>
                      <Link
                        to={ownEmpty.to}
                        className="mt-2 inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                      >
                        {t(ownEmpty.ctaKey)} <span aria-hidden="true">→</span>
                      </Link>
                    </Card>
                  );
                })()}
                {visible.map((k) => {
                  const sig = reviewSignals(k);
                  const reviewWork = reviewWorkView(k);
                  // SCRUM-365 / AG-12: kontextbezogener Prüf-Fokus aus vorhandenen Signalen
                  // (revidiert → gezielt die Änderung; Autor übertragen → extra Blick).
                  const guideFocusKey = reviewGuidanceFocusKey({
                    kind: validationReviewContext(k).kind,
                    authorTransferred: sig.authorTransferred,
                  });
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
                            <span
                              className={`rounded-pill px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${REVIEW_WORK_TONE[reviewWork.tone]}`}
                            >
                              {t(reviewWork.labelKey)}
                            </span>
                          </div>
                          {/* SCRUM-326: Review-Kontext — neu/offen vs. revidiert (Version>1) + Hinweis. */}
                          <ValidationReviewContext ko={k} />
                          <div className="mt-1">
                            <KoAuthorLine {...koAuthorParts(k, nameOf)} />
                          </div>
                          {/* SCRUM-249: ehrlicher Entscheidungs-Hinweis (aus Trust-Band abgeleitet). */}
                          <p className="mt-1 text-[11.5px] text-muted">
                            <span className="font-semibold text-text">
                              {t("val.decisionLabel")}{" "}
                            </span>
                            {t(`val.decision.${sig.trustBand}`)}
                            <span className="ml-1">{t(reviewWork.hintKey)}</span>
                          </p>
                          {/* SCRUM-365 / AG-12 / PI-K2: ruhige, einklappbare Review-Führung —
                              „Was prüfe ich?" (Checkliste + Kontext-Fokus) + „Was bewirkt die
                              Entscheidung?" + ehrliche Trust-/Quorum-Notiz. Progressive disclosure,
                              damit das Board nicht zur Formularwand wird. */}
                          <details className="mt-2">
                            <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-ai hover:opacity-80">
                              {t("val.guide.title")}
                            </summary>
                            <div className="mt-2 space-y-2 rounded-card border border-hairline bg-page px-3 py-2.5">
                              <ul className="space-y-1">
                                {REVIEW_CHECK_ITEMS.map((item) => (
                                  <li
                                    key={item.id}
                                    className="text-[11.5px] leading-relaxed text-muted"
                                  >
                                    <span className="font-semibold text-text">
                                      {t(item.labelKey)}
                                    </span>{" "}
                                    {t(item.hintKey)}
                                  </li>
                                ))}
                              </ul>
                              {guideFocusKey ? (
                                <p className="text-[11.5px] leading-relaxed text-trust-warn-text">
                                  {t(guideFocusKey)}
                                </p>
                              ) : null}
                              <div className="border-t border-hairline pt-2">
                                <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                                  {t("val.guide.impactTitle")}
                                </div>
                                <ul className="space-y-1">
                                  {DECISION_IMPACTS.map((d) => (
                                    <li
                                      key={d.verdict}
                                      className="text-[11.5px] leading-relaxed text-muted"
                                    >
                                      <span className={`font-semibold ${IMPACT_TEXT_TONE[d.tone]}`}>
                                        {t(d.titleKey)}:
                                      </span>{" "}
                                      {t(d.bodyKey)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <p className="border-t border-hairline pt-2 text-[11px] leading-relaxed text-muted-2">
                                {t(DECISION_TRUST_NOTE_KEY)}
                              </p>
                            </div>
                          </details>
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
                                  // SCRUM-365: Hover/Touch zeigt direkt die ehrliche Wirkung der Entscheidung.
                                  title={t(decisionImpact(d.verdict).bodyKey)}
                                  disabled={
                                    d.verdict === "up"
                                      ? rate.isPending || reviewWithFeedback.isPending
                                      : reviewWithFeedback.isPending
                                  }
                                  onClick={() =>
                                    d.verdict === "up"
                                      ? rate.mutate({ id: k.id, title: k.title, verdict: "up" })
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
                          <div className="mb-1 text-[12.5px] font-semibold text-text">
                            {feedback.verdict === "warn"
                              ? t("val.feedback.condTitle")
                              : t("val.feedback.rejTitle")}
                          </div>
                          {/* SCRUM-365 / AG-12: Feedback als Hilfe zur Nacharbeit rahmen, nicht technisch. */}
                          <p className="mb-2 text-[11.5px] leading-relaxed text-muted">
                            {t("val.feedback.helpHint")}
                          </p>
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
                                  title: k.title,
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

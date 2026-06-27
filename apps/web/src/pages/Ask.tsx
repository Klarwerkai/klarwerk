import { useMutation } from "@tanstack/react-query";
import { ArrowRight, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useReasonerStatus } from "../api/hooks";
import type { AnswerResult } from "../api/types";
import { ConfidenceBar } from "../components/trust";
import { Button, Card, PageHeader, SectionLabel } from "../components/ui";
import { selectAnswer } from "../lib/askResponse";
import { helpfulDisabled, helpfulLabel } from "../lib/helpfulSignal";
import { type EvidenceTone, knowledgeClassMeta } from "../lib/knowledgeClass";
import { type ReasonerBadgeTone, reasonerBadge } from "../lib/reasonerBadge";
import { toReasonerLocale } from "../lib/reasonerLocale";

// Tone → Badge-Stil (Tailwind-Tokens), bewusst in der Komponente gehalten.
const EVIDENCE_TONE: Record<EvidenceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
  neutral: "bg-page text-muted",
};

// SCRUM-233: Modus-Badge-Tönung (eigene Skala, neutral inklusive Lade-/Unbekannt-Zustand).
const REASONER_TONE: Record<ReasonerBadgeTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

export function Ask(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);

  // SCRUM-233: ehrlicher Reasoner-Modus aus vorhandenem read-only Status (kein Backend-Umbau).
  const reasonerStatus = useReasonerStatus();
  const badge = reasonerBadge({
    status: reasonerStatus.data,
    isLoading: reasonerStatus.isLoading,
    isError: reasonerStatus.isError,
  });

  const ask = useMutation({
    mutationFn: () => endpoints.ask.ask(q, toReasonerLocale(i18n.language)),
    // SCRUM-138: Backend liefert { result, gap } — Antwort sauber entpacken.
    onSuccess: (r) => setResult(selectAnswer(r)),
  });
  const helpful = useMutation({ mutationFn: (koId: string) => endpoints.ask.helpful(koId) });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker={t("ask.kicker")} title={t("ask.title")} />
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">{t("ask.intro")}</p>
        <span
          title={t("ask.reasoner.hint")}
          className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${REASONER_TONE[badge.tone]}`}
        >
          {t(badge.labelKey)}
        </span>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) {
            ask.mutate();
          }
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("ask.placeholder")}
          className="h-11 flex-1 rounded-input border border-hairline bg-surface px-3.5 text-sm outline-none focus:border-ink/30"
        />
        <Button type="submit" variant="primary" disabled={ask.isPending}>
          {t("ask.submit")}
          <ArrowRight size={15} />
        </Button>
      </form>

      {result ? (
        result.answered ? (
          <Card className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-pill bg-trust-pos-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-pos-text">
                  {t("ask.fromValidated")}
                </span>
                <span
                  className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${EVIDENCE_TONE[knowledgeClassMeta(result.knowledgeClass).tone]}`}
                >
                  {t("ask.evidence")}: {t(knowledgeClassMeta(result.knowledgeClass).labelKey)}
                </span>
              </div>
              <ConfidenceBar value={result.trust} />
            </div>
            <p className="text-[15px] leading-relaxed text-text">{result.answer}</p>
            {result.steps.length > 0 ? (
              <div className="mt-4">
                <SectionLabel>{t("ask.steps")}</SectionLabel>
                <ul className="space-y-2">
                  {result.steps.map((s) => (
                    <li
                      key={s.description}
                      className="rounded-btn bg-page p-2.5 text-[13px] text-text"
                    >
                      {s.description}
                      {s.snippet ? (
                        <span className="mt-1 block font-mono text-[11px] text-muted-2">
                          “{s.snippet}”
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.sources.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <SectionLabel>{t("ask.sources")}</SectionLabel>
                {result.sources.map((id) => (
                  <Link key={id} to={`/wissen/${id}`} className="font-mono text-[12px] text-brand">
                    {id}
                  </Link>
                ))}
              </div>
            ) : null}
            <Button
              className="mt-4"
              disabled={helpfulDisabled(
                { pending: helpful.isPending, success: helpful.isSuccess },
                result.sources.length === 0,
              )}
              onClick={() => result.sources[0] && helpful.mutate(result.sources[0])}
            >
              <ThumbsUp size={15} />
              {helpfulLabel({ success: helpful.isSuccess }, t("ask.helpful"), t("ask.thanked"))}
            </Button>
          </Card>
        ) : (
          <Card className="mt-5 border-dashed">
            <p className="text-[15px] font-semibold text-text">{t("ask.noBasisTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("ask.noBasisBody")}</p>
            <Link
              to="/risiko"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand"
            >
              {t("ask.toGaps")}
              <ArrowRight size={15} />
            </Link>
          </Card>
        )
      ) : null}
    </div>
  );
}

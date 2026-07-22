import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Copy, FileDown, Printer, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useConflicts, useKos, useReasonerStatus } from "../api/hooks";
import type { AnswerResult } from "../api/types";
import { useToast } from "../app/ToastContext";
// WP-UX-WOW-1 U1: sichere Markdown-Darstellung der Antwort (React-Elemente, kein HTML-Sink).
import { AnswerMarkdown } from "../components/AnswerMarkdown";
import { DemoBanner } from "../components/DemoBanner";
import { HelpTip } from "../components/HelpTip";
import { ConfidenceBar } from "../components/trust";
import { Button, Card, PageHeader, SectionLabel } from "../components/ui";
import { answerExportFilename, buildAnswerMarkdown } from "../lib/answerExport";
import {
  ANSWER_CONTRACT_TRUST_NOTE_KEY,
  answerContract,
  answerSourceSummary,
} from "../lib/askAnswerContract";
// WP-UX-WOW-1 U2/U3: ehrliche Beispiel-Chips aus dem ECHTEN validierten Bestand (+ Lücken-Frage).
import { buildAskExampleChips } from "../lib/askExampleChips";
import { type AskExpectationTone, askExpectation } from "../lib/askExamples";
import { GAP_RESCUE_STEPS, GAP_RESCUE_TEXT } from "../lib/askGapRescue";
import {
  isConfidentialAskPrefill,
  isPrefilledAskQuestion,
  readAskQuestion,
  shouldAutoAskFromSearch,
} from "../lib/askQuestion";
import { selectAnswer } from "../lib/askResponse";
import { answerReviewGuard, answerStatus, conflictAwareSourceRefs } from "../lib/askView";
import { captureGapHref, gapPrivacyNoticeKey } from "../lib/captureFromGap";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
import { helpfulDisabled, helpfulLabel } from "../lib/helpfulSignal";
import { type EvidenceTone, knowledgeClassMeta } from "../lib/knowledgeClass";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../lib/knowledgeGuidance";
import { type ReasonerBadgeTone, reasonerBadge } from "../lib/reasonerBadge";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { useReadiness } from "../lib/useReadiness";

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

// SCRUM-266: Tönung der Ergebnis-Erwartung je Beispiel (quellengebundene Antwort vs. Wissenslücke).
const EXPECT_TONE: Record<AskExpectationTone, string> = {
  answer: "bg-trust-pos-bg text-trust-pos-text",
  gap: "bg-trust-warn-bg text-trust-warn-text",
};

// SCRUM-289: Ask-Führung — quellengebunden antworten, offene Quellen prüfen lassen.
const GUIDE_TONE: Record<KnowledgeGuidanceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

export function Ask(): JSX.Element {
  const { t, i18n } = useTranslation();
  // SCRUM-272: optionale Startfrage aus der URL (/fragen?q=…) — nur vorbefüllen, kein Auto-Ask.
  const [params] = useSearchParams();
  const [q, setQ] = useState(() => readAskQuestion(params) ?? "");
  const [result, setResult] = useState<AnswerResult | null>(null);
  // SCRUM-264: zuletzt gestellte Frage festhalten → bei Lücke als Capture-Kontext übergeben.
  const [asked, setAsked] = useState("");
  const guide = knowledgeGuidance("ask");

  // SCRUM-233: ehrlicher Reasoner-Modus aus vorhandenem read-only Status (kein Backend-Umbau).
  const reasonerStatus = useReasonerStatus();
  const badge = reasonerBadge({
    status: reasonerStatus.data,
    isLoading: reasonerStatus.isLoading,
    isError: reasonerStatus.isError,
  });

  // SCRUM-250: KO-Bestand für lesbare Quellen-Titel (kein neuer Endpoint).
  const kos = useKos();
  // SCRUM-357 / AG-14: konfliktbewusste Quellen — ein konfliktbetroffenes Quell-KO erscheint NICHT
  // als uneingeschränkt nutzbar/gesichert (effektive, konfliktbegrenzte Nutzbarkeit + Konflikt-Chip).
  const conflicts = useConflicts();
  const answerSources = result?.answered
    ? conflictAwareSourceRefs(result.sources, kos.data ?? [], conflicts.data ?? [])
    : [];
  const reviewGuard = result?.answered
    ? answerReviewGuard(result.knowledgeClass, answerSources)
    : null;
  // Mindestens eine Antwortquelle hat einen offenen Konflikt → ehrlicher Antwort-Hinweis.
  const sourcesConflicted = answerSources.some((s) => s.conflictLimited);
  // SCRUM-366 / FR-ASK-02 / PI-K2: Antwortvertrag — quellengebunden, ehrlich (gesichert vs. ungeprüft
  // vs. Wissenslücke), kein generischer Chatbot. Aus vorhandenen Signalen abgeleitet (kein Backend).
  const contract = result
    ? answerContract({
        answered: result.answered,
        knowledgeClass: result.knowledgeClass,
        sourcesConflicted,
      })
    : null;
  const sourceSummary = result?.answered ? answerSourceSummary(answerSources) : null;

  // WP-UX-WOW-1 U3/U5: die Frage reist als Mutations-PARAMETER — Chips/Direkt-Sender rufen
  // ask.mutate(frage) im selben Handler wie setQ auf, ohne auf den nächsten Render zu warten
  // (der alte q-Closure hätte sonst die VORHERIGE Eingabe gesendet).
  const ask = useMutation({
    mutationFn: (question: string) => endpoints.ask.ask(question, toReasonerLocale(i18n.language)),
    // SCRUM-138: Backend liefert { result, gap } — Antwort sauber entpacken.
    onSuccess: (r) => setResult(selectAnswer(r)),
  });
  const helpful = useMutation({ mutationFn: (koId: string) => endpoints.ask.helpful(koId) });

  // WP-UX-WOW-1 U2/U3: Beispiel-Chip → Frage setzen UND direkt senden (ein Klick → Antwort).
  const askExample = (question: string): void => {
    setQ(question);
    setAsked(question);
    ask.mutate(question);
  };
  // Chips stabil je Bestand memoisiert (die Zufallswahl würfelt sonst bei jedem Render neu).
  const exampleChips = useMemo(() => buildAskExampleChips(kos.data ?? []), [kos.data]);

  // SCRUM-460: Kommt der Nutzer aus der Bibliothek-Suche mit ausdrücklichem Antwort-Wunsch
  // (?ask=1), wird die vorbefüllte Frage EINMAL automatisch beantwortet — so liefert die Suche
  // eine echte Antwort mit Quellen. Sonst (SCRUM-272) bleibt es beim reinen Vorbefüllen.
  const autoAsked = useRef(false);
  useEffect(() => {
    if (autoAsked.current) {
      return;
    }
    if (shouldAutoAskFromSearch(params) && q.trim().length > 0) {
      autoAsked.current = true;
      // WP-UX-WOW-1 U5: die Startfrage auch als Lücken-/Capture-Kontext festhalten (wie Submit).
      setAsked(q.trim());
      ask.mutate(q.trim());
    }
  }, [params, q, ask]);

  // SCRUM-430 (VIP): beantwortete Frage inkl. Quellen exportieren/teilen. Quellen bleiben klar
  // ausgewiesen (Status/Trust/Nutzbarkeit). Markdown wird erst beim Klick gebaut (frischer Zeitstempel).
  const { push } = useToast();
  const kosById = new Map((kos.data ?? []).map((k) => [k.id, k]));
  const buildExport = (): { markdown: string; filename: string } | null => {
    if (!result?.answered) {
      return null;
    }
    const generatedAt = new Date().toISOString();
    const sources = answerSources.map((s) => {
      const ko = kosById.get(s.id);
      return {
        title: s.label,
        ...(ko ? { statusLabel: t(`status.${ko.status}`), trust: ko.trust } : {}),
        ...(s.usability ? { usabilityLabel: t(useReadiness(s.usability).labelKey) } : {}),
      };
    });
    const markdown = buildAnswerMarkdown({
      question: asked || q,
      answer: result.answer ?? "",
      statusLabel: t(`ask.status.${answerStatus(result.knowledgeClass).key}`),
      evidenceLabel: t(knowledgeClassMeta(result.knowledgeClass).labelKey),
      trust: result.trust,
      steps: result.steps.map((s) => ({ description: s.description, snippet: s.snippet })),
      sources,
      generatedAt,
      labels: {
        answer: t("ask.export.answer"),
        evidence: t("ask.evidence"),
        trust: t("val.trust"),
        steps: t("ask.steps"),
        sources: t("ask.sources"),
        footer: t("ask.export.footer"),
      },
    });
    return { markdown, filename: answerExportFilename(generatedAt) };
  };
  const copyAnswer = (): void => {
    const ex = buildExport();
    if (!ex) {
      return;
    }
    void navigator.clipboard?.writeText(ex.markdown).then(
      () => push("success", t("ask.export.copied")),
      () => push("error", t("state.error")),
    );
  };
  const downloadAnswer = (): void => {
    const ex = buildExport();
    if (!ex) {
      return;
    }
    const blob = new Blob([ex.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ex.filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  // SCRUM-440-Muster: nur den markierten Auszug (.print-area) drucken; Klasse nach dem Druck entfernen.
  const printAnswer = (): void => {
    document.body.classList.add("printing-extract");
    window.addEventListener(
      "afterprint",
      () => document.body.classList.remove("printing-extract"),
      {
        once: true,
      },
    );
    window.print();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        kicker={t("ask.kicker")}
        title={t("ask.title")}
        actions={<HelpTip title={t("ask.help.sources.title")} body={t("ask.help.sources.body")} />}
      />
      {/* SCRUM-291: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="ask" /> : null}
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">{t("ask.intro")}</p>
        <span
          title={t("ask.reasoner.hint")}
          className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${REASONER_TONE[badge.tone]}`}
        >
          {t(badge.labelKey)}
        </span>
      </div>

      {/* SCRUM-289: vor dem Fragen erklären, warum Klarwerk kein generischer Chat ist. */}
      <Card className="mb-4 border-dashed">
        <h2 className="text-[14px] font-semibold text-ink">{t(guide.titleKey)}</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t(guide.bodyKey)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {guide.items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="inline-flex items-start gap-2 rounded-btn border border-hairline bg-surface px-2.5 py-2 hover:border-ink/30"
            >
              <span
                className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${GUIDE_TONE[item.tone]}`}
              >
                {t(item.labelKey)}
              </span>
              <span className="max-w-[18rem] text-[12px] leading-relaxed text-muted">
                {t(item.bodyKey)}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      {/* SCRUM-295: im Demo-/Use-Kontext mit vorbefüllter Startfrage (z. B. aus KO-Detail „Wissen
          nutzen") ehrlich führen: Frage ist nur Startpunkt, kein Auto-Submit; Antwort bleibt
          quellengebunden, Status/Trust entscheiden. Ohne Demo-Kontext unverändert. */}
      {isDemoContext(params) && isPrefilledAskQuestion(params) && !result ? (
        <p className="mb-2 rounded-btn bg-page px-2.5 py-2 text-[12px] text-muted-2">
          {t("ask.demoPrefillHint")}
        </p>
      ) : null}

      {/* WP-POLISH-CLOSE (bens Punkt 1): Frage zu einem VERTRAULICHEN KO wurde nur vorbefüllt
          (kein Auto-Send) — nüchterner Hinweis, der Nutzer sendet bewusst selbst. */}
      {isConfidentialAskPrefill(params) && !result ? (
        <p className="mb-2 rounded-btn bg-trust-warn-bg px-2.5 py-2 text-[12px] text-trust-warn-text">
          {t("ask.confidentialPrefillHint")}
        </p>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) {
            setAsked(q.trim());
            ask.mutate(q.trim());
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

      {/* WP-UX-WOW-1 U2/U3 (statt SCRUM-265-Statik): ehrliche Beispiel-Chips. Antwort-Beispiele
          kommen aus dem ECHTEN validierten Bestand (Badge damit ehrlich korrekt), dazu EINE bewusste
          Lücken-Frage; ohne validierten Bestand neutrale statische Beispiele ohne Behauptung.
          Klick sendet DIREKT — kein zweiter Klick nötig. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
          {t("ask.examplesLabel")}
        </span>
        {exampleChips.map((chip) => {
          const question =
            chip.kind === "ko" ? t("ask.koQuestion", { title: chip.title }) : t(chip.questionKey);
          const expect =
            chip.kind === "ko"
              ? askExpectation("answerable")
              : chip.expectation === "gap"
                ? askExpectation("gap")
                : null;
          return (
            <button
              key={question}
              type="button"
              disabled={ask.isPending}
              onClick={() => askExample(question)}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-pill border border-hairline px-2.5 py-1 text-[12px] text-muted hover:border-ink/30 hover:text-text disabled:opacity-50"
            >
              <span className="min-w-0 max-w-[16rem] truncate">{question}</span>
              {expect ? (
                <span
                  className={`shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${EXPECT_TONE[expect.tone]}`}
                >
                  {t(expect.labelKey)}
                </span>
              ) : (
                <span className="shrink-0 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-2">
                  {t("ask.expect.neutral")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {result && contract ? (
        <>
          {/* SCRUM-366 / AG-P2-2 / AG-P2-3 / PI-K2: Antwortvertrag — ruhige Karte, die vor dem Lesen
              klar macht: Worauf basiert die Antwort? Gesichert, ungeprüft oder Wissenslücke? Quellen-
              bilanz + ehrliche Trust-Notiz (kein Wahrheitsversprechen) + sicherer nächster Schritt. */}
          <Card
            className={`mt-5 ${
              contract.tone === "pos"
                ? "border-trust-pos-fill bg-trust-pos-bg"
                : "border-trust-warn-fill bg-trust-warn-bg"
            }`}
          >
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
              {t("ask.contract.label")}
            </span>
            <p
              className={`mt-0.5 text-[13px] font-semibold ${
                contract.tone === "pos" ? "text-trust-pos-text" : "text-trust-warn-text"
              }`}
            >
              {t(contract.titleKey)}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t(contract.bodyKey)}</p>
            {sourceSummary && sourceSummary.total > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-pill bg-surface px-2 py-0.5 font-mono text-[10px] font-semibold text-text">
                  {t("ask.contract.sumTotal", { count: sourceSummary.total })}
                </span>
                {sourceSummary.validated > 0 ? (
                  <span className="rounded-pill bg-trust-pos-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-pos-text">
                    {t("ask.contract.sumValidated", { count: sourceSummary.validated })}
                  </span>
                ) : null}
                {sourceSummary.open > 0 ? (
                  <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-warn-text">
                    {t("ask.contract.sumOpen", { count: sourceSummary.open })}
                  </span>
                ) : null}
                {sourceSummary.conflictLimited > 0 ? (
                  <span className="rounded-pill bg-trust-crit-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-trust-crit-text">
                    {t("ask.contract.sumConflict", { count: sourceSummary.conflictLimited })}
                  </span>
                ) : null}
              </div>
            ) : null}
            {contract.sourceBound ? (
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted-2">
                {t(ANSWER_CONTRACT_TRUST_NOTE_KEY)}
              </p>
            ) : null}
            <p className="mt-2 text-[12px] font-medium text-text">{t(contract.nextStepKey)}</p>
          </Card>
          {result.answered ? (
            <Card className="print-area mt-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* SCRUM-250: ehrlicher Antwort-Status aus der Knowledge-Class (gesichert vs ungeprüft). */}
                  <span
                    className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${EVIDENCE_TONE[answerStatus(result.knowledgeClass).tone]}`}
                  >
                    {t(`ask.status.${answerStatus(result.knowledgeClass).key}`)}
                  </span>
                  <span
                    className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${EVIDENCE_TONE[knowledgeClassMeta(result.knowledgeClass).tone]}`}
                  >
                    {t("ask.evidence")}: {t(knowledgeClassMeta(result.knowledgeClass).labelKey)}
                  </span>
                </div>
                <ConfidenceBar value={result.trust} />
              </div>
              {/* SCRUM-430 (VIP): Antwort inkl. Quellen exportieren/teilen — Kopieren, Markdown-Download,
                  Druck/PDF. Beim Drucken über die Body-Klasse isoliert (nur diese Karte). */}
              <div className="print-hide mb-3 flex flex-wrap items-center gap-1.5">
                <Button variant="ghost" onClick={copyAnswer}>
                  <Copy size={14} />
                  {t("ask.export.copy")}
                </Button>
                <Button variant="ghost" onClick={downloadAnswer}>
                  <FileDown size={14} />
                  {t("ask.export.download")}
                </Button>
                <Button variant="ghost" onClick={printAnswer}>
                  <Printer size={14} />
                  {t("ask.export.print")}
                </Button>
              </div>
              {/* WP-UX-WOW-1 U1: Markdown der Antwort SICHER gerendert (Subset via React-Elemente);
                  Kopieren/Download/Druck nutzen weiter den ROHEN Text (buildExport unverändert). */}
              <AnswerMarkdown
                text={result.answer ?? ""}
                className="text-[15px] leading-relaxed text-text"
              />
              {reviewGuard ? (
                <div className="mt-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
                  <div className="font-semibold">{t(reviewGuard.labelKey)}</div>
                  <p className="mt-0.5">{t(reviewGuard.hintKey)}</p>
                  <Link
                    to={demoHref(reviewGuard.ctaTo, params)}
                    className="mt-2 inline-flex items-center gap-1 rounded-btn bg-surface px-2.5 py-1 text-[12px] font-semibold text-text hover:opacity-90"
                  >
                    {t(reviewGuard.ctaKey)}
                    <ArrowRight size={13} />
                  </Link>
                </div>
              ) : null}
              {result.steps.length > 0 ? (
                <div className="mt-4">
                  <SectionLabel>{t("ask.steps")}</SectionLabel>
                  <ul className="space-y-2">
                    {result.steps.map((s) => (
                      <li
                        key={s.description}
                        className="rounded-btn bg-page p-2.5 text-[13px] text-text"
                      >
                        {/* Pedi 05.07.: Die Quellen-Headline verlinkt direkt auf das Wissensobjekt in
                            der Bibliothek — so kommt man aus der Antwort schnell zum Artikel. */}
                        {s.sourceId ? (
                          <Link
                            to={demoHref(`/wissen/${s.sourceId}`, params)}
                            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                          >
                            <span className="text-text">{s.description}</span>
                            <ArrowRight size={12} className="shrink-0 text-muted-2" />
                          </Link>
                        ) : (
                          s.description
                        )}
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
              {/* SCRUM-357 / AG-14 / VC-P1-1: mind. eine Antwortquelle hat einen offenen Konflikt →
                ehrlicher Hinweis, dass die Antwort trotz Status nicht uneingeschränkt gesichert ist. */}
              {sourcesConflicted ? (
                <div className="mt-3 rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2">
                  <p className="text-[12.5px] font-semibold text-trust-warn-text">
                    {t("conflict.impact.title")}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
                    {t("conflict.impact.hint")}
                  </p>
                  <Link
                    to="/konflikte"
                    className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-trust-warn-text underline"
                  >
                    {t("conflict.impact.cta")}
                  </Link>
                </div>
              ) : null}
              {result.sources.length > 0 ? (
                <div className="mt-4">
                  <SectionLabel>{t("ask.sources")}</SectionLabel>
                  {/* SCRUM-300: ehrliche Kernaussage — die Antwort ist quellengebunden und nur so
                    belastbar wie die genutzte Quelle (Status/Trust/Nutzbarkeit). */}
                  <p className="mt-0.5 text-[12px] text-muted-2">{t("ask.sourcesHint")}</p>
                  {/* SCRUM-250: Quellen handlungsnah — KO-Titel statt roher ID, Link zum Detail.
                    SCRUM-300: je Quelle die kanonische Nutzbarkeit (gleiche Sprache wie KO-Detail/
                    Library) + Demo-Kontext am Link weitertragen (kein Auto-Use). */}
                  <ul className="mt-1.5 space-y-1.5">
                    {answerSources.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          to={demoHref(`/wissen/${s.id}`, params)}
                          className="inline-flex items-center gap-1.5 text-[13px] text-brand hover:underline"
                        >
                          <ArrowRight size={12} className="shrink-0 text-muted-2" />
                          <span className="text-text">{s.label}</span>
                        </Link>
                        {s.usability ? (
                          <span
                            title={t(useReadiness(s.usability).hintKey)}
                            className={`shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${EVIDENCE_TONE[useReadiness(s.usability).tone]}`}
                          >
                            {t(useReadiness(s.usability).labelKey)}
                          </span>
                        ) : null}
                        {/* SCRUM-357 / AG-14: konfliktbetroffene Quelle ehrlich kennzeichnen. */}
                        {s.conflictLimited ? (
                          <span
                            title={t("conflict.impact.hint")}
                            className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-trust-warn-text"
                          >
                            {t("conflict.impact.badge")}
                          </span>
                        ) : null}
                        {/* WP-RETEST7 R5: Treffer kam über die Bild-Fußnote — gleiche Fundstellen-
                            Kennzeichnung wie in der Bibliothek. */}
                        {result.captionSources?.includes(s.id) ? (
                          <span className="shrink-0 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-2">
                            {t("lib.match.caption")}
                          </span>
                        ) : null}
                        {/* SCRUM-308: Herkunfts-Kennzeichnung Demo-/Seed-Wissen (neutral, kein Statussignal). */}
                        {s.demo ? (
                          <span
                            title={t("demo.badge.hint")}
                            className="shrink-0 rounded-pill bg-hairline-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-2"
                          >
                            {t("demo.badge.label")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button
                className="print-hide mt-4"
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
            <Card className="mt-3 border-dashed">
              <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-warn-text">
                {t("ask.gapBadge")}
              </span>
              <p className="mt-2 text-[15px] font-semibold text-text">{t("ask.noBasisTitle")}</p>
              <p className="mt-1 text-sm text-muted">{t("ask.noBasisBody")}</p>
              {/* SCRUM-369 / AG-12/13/P2-4: die Lücke als geführter „Wissenslücke retten"-Einstieg —
                  Story + Beitragswert + ehrlich „keine Antwort erfunden" + geführte Schrittfolge. */}
              <div className="mt-3 rounded-card border border-ai/30 bg-ai/5 px-3 py-2.5">
                <div className="text-[13px] font-semibold text-ai">
                  {t(GAP_RESCUE_TEXT.storyTitle)}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {t(GAP_RESCUE_TEXT.impact)}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-2">
                  {t(GAP_RESCUE_TEXT.noInvent)}
                </p>
                <div className="mt-2 border-t border-hairline pt-2">
                  <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                    {t(GAP_RESCUE_TEXT.stepsTitle)}
                  </div>
                  <ol className="space-y-1">
                    {GAP_RESCUE_STEPS.map((step, i) => (
                      <li key={step.id} className="text-[11.5px] leading-relaxed text-muted">
                        <span className="font-semibold text-text">
                          {i + 1}. {t(step.labelKey)}
                        </span>{" "}
                        {t(step.hintKey)}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              {/* SCRUM-250: klarer nächster Schritt — die Lücke ist erfasst und im Risiko-Board handelbar. */}
              <p className="mt-2 text-[13px] text-muted">{t("ask.gapNext")}</p>
              {/* SCRUM-283: ehrlich + datensparsam — Frage wird als Lücke gespeichert, keine Antwort,
                keine sensiblen Details; geprüfte Erfahrung später ergänzen. */}
              <p className="mt-2 rounded-btn bg-page px-2.5 py-2 text-[12px] text-muted-2">
                {t(gapPrivacyNoticeKey())}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                {/* SCRUM-264: direkt Wissen erfassen — die gestellte Frage als Capture-Kontext (kein Auto-KO). */}
                {asked ? (
                  <Link
                    to={captureGapHref(asked)}
                    className="inline-flex items-center gap-1.5 rounded-btn bg-ink px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90"
                  >
                    {t(GAP_RESCUE_TEXT.cta)}
                    <ArrowRight size={15} />
                  </Link>
                ) : null}
                <Link
                  to="/risiko"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand"
                >
                  {t("ask.toGaps")}
                  <ArrowRight size={15} />
                </Link>
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

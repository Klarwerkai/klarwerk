import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  useAiCheckCoverageSummary,
  useAnalytics,
  useAudit,
  useBusFactor,
  useConflicts,
  useGaps,
  useImpact,
  useKos,
  useLifecyclePending,
  useValidationOverview,
} from "../api/hooks";
import type { AuditFilter } from "../api/types";
import { HelpTip } from "../components/HelpTip";
import { LoadErrorState, StaleMarker } from "../components/LoadState";
import { PersonenZeilen } from "../components/PruefaufgabenJePerson";
import { Card, PageHeader, QueryState, SectionLabel } from "../components/ui";
import {
  assignmentRows,
  auditActions,
  auditActors,
  averageTrust,
  categoryDistribution,
  filterAudit,
  formatRate,
  validationRate,
  weeklyAnswerRate,
  weeklyValidated,
  workloadSummary,
} from "../lib/analyticsMetrics";
import { ANALYTICS_AUDIT_ANCHOR, hashToElementId } from "../lib/analyticsSections";
import { isDemoKnowledge } from "../lib/demoKnowledge";
import { executiveKpis } from "../lib/executiveKpis";
import { type HealthBand, knowledgeHealth } from "../lib/knowledgeHealth";
import { isGroupError, isGroupLoading, isGroupStale } from "../lib/loadingState";

const BAND_TONE: Record<HealthBand, string> = {
  gut: "bg-trust-pos-bg text-trust-pos-text",
  mittel: "bg-trust-warn-bg text-trust-warn-text",
  kritisch: "bg-trust-crit-bg text-trust-crit-text",
};

function Kpi({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-card bg-page p-4">
      <div className="font-mono text-micro uppercase tracking-wider text-muted-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}

// SCRUM-431: Executive-Kachel mit kurzer Erklärung darunter — jede Zahl ist selbsterklärend.
// E2E-016: solange die Quelle noch lädt, zeigt die Kachel „—" statt einer echten 0 (unbekannt ≠ 0).
function ExecKpi({
  label,
  value,
  hint,
  loading = false,
}: { label: string; value: number | string; hint: string; loading?: boolean }): JSX.Element {
  return (
    <div className="rounded-card bg-page p-4">
      <div className="font-mono text-micro uppercase tracking-wider text-muted-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{loading ? "—" : value}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-muted-2">{hint}</div>
    </div>
  );
}

export function Analytics(): JSX.Element {
  const { t } = useTranslation();
  const analytics = useAnalytics();
  const audit = useAudit();
  const kos = useKos();
  const overview = useValidationOverview();
  const impact = useImpact();
  const gaps = useGaps();
  const conflicts = useConflicts();
  const pending = useLifecyclePending();
  const busFactor = useBusFactor();
  // AUFTRAG-mega32 F: dieselbe Zusammenfassung, die schon die leeren Boards ehrlich hält (mega29 C2).
  const coverageSummary = useAiCheckCoverageSummary();

  // SCRUM-139: datenbasierte Trust-/Arbeitslast-Kennzahlen aus realem Bestand.
  const trust = averageTrust(kos.data ?? []);
  const work = workloadSummary(overview.data ?? []);

  // SCRUM-431: Executive-Blick — die vier Kern-Kennzahlen aus echten Live-Daten (kein Fake).
  const exec = executiveKpis({
    kos: kos.data ?? [],
    gaps: gaps.data ?? [],
    busFactor: busFactor.data ?? [],
  });
  // E2E-016: die vier Exec-Kennzahlen sind EINE zusammengehörige Gruppe — bis ALLE Quellen geladen
  // sind, wird die Gruppe atomar als „lädt" behandelt (kein Mischbild aus echter Zahl und 0). Seit
  // bens D9-Auflage über den gemeinsamen Ladezustand-Helfer (dasselbe Muster wie Start/Nav/Bereitschaft).
  // R-0723: drei der vier Kernzahlen oben kommen aus dem Wirkungsbericht — er gehört deshalb mit in
  // die Gruppe.
  const execSources = [kos, gaps, busFactor, impact];
  const execLoading = isGroupLoading(execSources);
  // AUFTRAG-mega3 Block B (bens D9): dritte Phase „error"/„stale" für die Exec-KPI-Gruppe.
  const execError = isGroupError(execSources);
  const execStale = isGroupStale(execSources);
  const retryExec = (): void => {
    void kos.refetch();
    void gaps.refetch();
    void busFactor.refetch();
    void impact.refetch();
  };
  const im = impact.data;
  const rateWeeks = weeklyAnswerRate(im?.askByWeek);
  const latestRateWeek = rateWeeks[rateWeeks.length - 1];
  // R-0736/R-0755: Demodaten zählen mit, aber nicht stillschweigend — der Anteil wird benannt.
  const kosList = kos.data ?? [];
  const demoCount = kosList.filter(isDemoKnowledge).length;

  // SCRUM-141: erklärbarer Knowledge-Health-Score aus echten Signalen.
  // AUFTRAG-mega32 F: die Abdeckungs-Zusammenfassung entscheidet, ob der Konfliktfaktor überhaupt
  // in die Punktzahl darf. Ohne sie ist die Erkennung unbelegt — und unbelegt zählt nicht.
  const health = knowledgeHealth({
    kos: kos.data ?? [],
    gaps: gaps.data ?? [],
    conflicts: conflicts.data ?? [],
    pendingRevalidation: pending.data ?? [],
    busFactor: busFactor.data ?? [],
    detectionCoverage: coverageSummary.data ?? null,
  });
  // R-0734: „Fehlen Live-Signale, gilt er ehrlich als unbekannt statt geschätzt." Solange eine der
  // fünf Quellen des Werts KEINE Antwort hat (lädt noch, gescheitert ohne früheren Stand), stünde
  // oben sonst die Rechnung über leere Listen — eine 0, die wie ein Befund aussieht. Ein früher
  // geholter Stand (gescheiterte Auffrischung) bleibt ein echtes Signal und zählt weiter.
  const healthUnknown = [kos, gaps, conflicts, pending, busFactor].some(
    (q) => q.data === undefined,
  );

  // SCRUM-143: Audit-Filter über echte Daten (clientseitig, ohne Chain-Umbau).
  const [filter, setFilter] = useState<AuditFilter>({});
  // Ein leeres Feld wird ENTFERNT statt auf undefined gesetzt (exactOptionalPropertyTypes: kein
  // explizites undefined in einem optionalen Feld).
  const setAuditField = (key: keyof AuditFilter, value: string): void =>
    setFilter((f) => {
      const next = { ...f };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  const allEntries = audit.data ?? [];

  // SCRUM-229: Deep-Link auf einen Abschnitt (z. B. /analytics#analytics-audit) zuverlässig
  // anspringen. react-router scrollt nicht automatisch zu Hash-Ankern; der Abschnitts-Wrapper
  // existiert sofort (unabhängig vom Datenladen), daher genügt scrollIntoView nach dem Mount.
  const location = useLocation();
  useEffect(() => {
    const id = hashToElementId(location.hash);
    if (!id) {
      return;
    }
    const handle = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [location.hash]);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <PageHeader kicker={t("ana.kicker")} title={t("nav.analytics")} pageKey="analytics" />

      {/* SCRUM-431 (VIP/Investor): ruhiger Executive-Blick aus Live-Daten.
          R-0723: oben die vier Kernzahlen für Entscheider — geprüftes Wissen, gestellte Fragen, ohne
          Lücke beantwortete Fragen, Antwortquote (ihr Wochenverlauf steht unter „Wirkung"). Die
          bisherigen Bestands-/Risikokacheln bleiben als zweite Zeile derselben Gruppe erhalten. */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("ana.exec.title")}</SectionLabel>
          <HelpTip title={t("ana.exec.title")} body={t("kennzahlen.help.exec")} />
        </div>
        <Card>
          {execStale ? (
            <div className="mb-3">
              <StaleMarker onRetry={retryExec} />
            </div>
          ) : null}
          {execError ? (
            // Block B: dauerhaft gescheitert → ehrlicher Fehlerzustand mit Wiederholen (kein „lädt", keine 0).
            <LoadErrorState onRetry={retryExec} />
          ) : (
            <div className="space-y-3">
              {!execLoading && demoCount > 0 ? (
                <p
                  data-testid="analytics-demo-hinweis"
                  className="rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2 text-[12px] leading-relaxed text-trust-warn-text"
                >
                  {t("kennzahlen.demo.hinweis", { demo: demoCount, total: kosList.length })}
                </p>
              ) : null}
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                data-testid="analytics-kernzahlen"
              >
                <ExecKpi
                  label={t("ana.exec.validated")}
                  value={exec.validated}
                  hint={t("ana.exec.validatedHint")}
                  loading={execLoading}
                />
                <ExecKpi
                  label={t("ana.impactAsk")}
                  value={im?.askTotal ?? 0}
                  hint={t("kennzahlen.exec.askedHint")}
                  loading={execLoading}
                />
                <ExecKpi
                  label={t("ana.impactAnswered")}
                  value={im?.answeredWithoutGap ?? 0}
                  hint={t("kennzahlen.exec.answeredHint")}
                  loading={execLoading}
                />
                <ExecKpi
                  label={t("ana.impactRate")}
                  value={formatRate(im?.answerRate ?? 0)}
                  hint={
                    latestRateWeek
                      ? t("kennzahlen.exec.rateHint", {
                          rate: formatRate(latestRateWeek.rate),
                          week: latestRateWeek.week,
                        })
                      : t("kennzahlen.exec.rateHintLeer")
                  }
                  loading={execLoading}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <ExecKpi
                  label={t("ana.exec.openReviews")}
                  value={exec.openReviews}
                  hint={t("ana.exec.openReviewsHint")}
                  loading={execLoading}
                />
                <ExecKpi
                  label={t("ana.exec.busFactor")}
                  value={exec.singleSourceCategories}
                  hint={t("ana.exec.busFactorHint")}
                  loading={execLoading}
                />
                <ExecKpi
                  label={t("ana.exec.rescued")}
                  value={exec.rescuedGaps}
                  hint={t("ana.exec.rescuedHint")}
                  loading={execLoading}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* SCRUM-141: Knowledge Health — datenbasiert & erklärbar */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("health.title")}</SectionLabel>
          <HelpTip title={t("health.title")} body={t("ana.help.health")} />
        </div>
        {healthUnknown ? (
          <Card data-testid="health-unknown" className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-card bg-page">
              <span className="font-mono text-[10px] font-semibold uppercase text-muted-2">
                {t("health.unknown")}
              </span>
            </div>
            <p className="min-w-0 flex-1 text-[12.5px] text-muted">{t("health.unknownExplain")}</p>
          </Card>
        ) : (
          <Card className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-card bg-page">
                <span className="text-2xl font-semibold text-ink">{health.score}</span>
                <span className="font-mono text-[9px] uppercase text-muted-2">/100</span>
              </div>
              <div className="min-w-0 flex-1">
                {/* AUFTRAG-mega33 B3: solange der Konfliktanteil unbelegt ist, gibt es KEIN Band.
                    Ein „gut" mit Fußnote wäre wieder eine Behauptung, die sich selbst widerspricht —
                    hier steht stattdessen, dass die Einstufung nicht belegt ist. */}
                {health.band ? (
                  <>
                    <span
                      className={`inline-block rounded-pill px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${BAND_TONE[health.band]}`}
                    >
                      {t(`health.band.${health.band}`)}
                    </span>
                    <p className="mt-1.5 text-[12.5px] text-muted">
                      {t(`health.explain.${health.band}`)}
                    </p>
                  </>
                ) : (
                  <>
                    <span
                      data-testid="health-band-unproven"
                      className="inline-block rounded-pill bg-page px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase text-muted-2"
                    >
                      {t("health.band.unproven")}
                    </span>
                    <p className="mt-1.5 text-[12.5px] text-muted">
                      {t("health.range.explain", {
                        worst: health.score,
                        best: health.scoreOptimistic,
                      })}
                    </p>
                  </>
                )}
              </div>
            </div>
            {/* AUFTRAG-mega33 BLOCK B (Pedi 27.07.): bei unbelegter Erkennung rechnet die sichtbare
                Zahl mit dem VOLLEN Konfliktabzug — der schlechteste Fall steht groß da. Der
                optimistische Rand steht daneben, benannt als das, was er ist. */}
            {health.conflictFactor.proven ? null : (
              <div
                data-testid="health-conflict-unproven"
                className="rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2"
              >
                <p className="text-[12.5px] font-semibold leading-snug text-trust-warn-text">
                  {t("health.conflictUnproven.title", {
                    worst: health.score,
                    best: health.scoreOptimistic,
                  })}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
                  {t(`health.conflictUnproven.${health.conflictFactor.reason}`)}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
                  {t("health.conflictUnproven.known", {
                    count: health.openConflicts,
                    penalty: health.conflictFactor.knownPenalty,
                    max: health.conflictFactor.maxPenalty,
                  })}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              {health.factors.map((f) => (
                <div key={f.key} className="flex items-center gap-2 text-[12.5px]">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      f.direction === "positive" ? "bg-trust-pos-fill" : "bg-trust-crit-fill"
                    }`}
                  />
                  <span className="flex-1 text-text">{t(`health.factor.${f.key}`)}</span>
                  <span className="font-mono text-muted-2">
                    {f.value}
                    {f.unit === "percent" ? "%" : ""}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <QueryState query={analytics}>
        {(a) => {
          const maxType = Math.max(1, ...Object.values(a.byType));
          const categories = categoryDistribution(a.byCategory);
          const maxCategory = Math.max(1, ...categories.map((c) => c.count));
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label={t("ana.total")} value={a.total} />
                <Kpi label={t("status.offen")} value={a.byStatus.offen ?? 0} />
                <Kpi label={t("status.validiert")} value={a.byStatus.validiert ?? 0} />
                <Kpi label={t("ana.categories")} value={Object.keys(a.byCategory).length} />
              </div>

              {/* SCRUM-139: Trust & Arbeitslast */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label={t("ana.avgTrust")} value={trust} />
                <Kpi
                  label={t("ana.validationRate")}
                  value={`${validationRate(a.total, a.byStatus.validiert ?? 0)}%`}
                />
                <Kpi label={t("ana.openTasks")} value={work.openTotal} />
                <Kpi label={t("ana.doneTasks")} value={work.doneTotal} />
              </div>

              <Card>
                <SectionLabel>{t("ana.byType")}</SectionLabel>
                <div className="space-y-2">
                  {Object.entries(a.byType).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-32 truncate text-[13px] text-text">{t(`ktype.${k}`)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${(v / maxType) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-muted-2">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* FR-ANA-01 / R-0723: die Kategorie-Verteilung — bisher stand nur ihre Anzahl da. */}
              {categories.length > 0 ? (
                <Card data-testid="analytics-kategorien">
                  <SectionLabel>{t("kennzahlen.byCategory")}</SectionLabel>
                  <div className="space-y-2">
                    {categories.map((c) => (
                      <div key={c.category} className="flex items-center gap-3">
                        <span className="w-32 truncate text-[13px] text-text">{c.category}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${(c.count / maxCategory) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-muted-2">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}
            </div>
          );
        }}
      </QueryState>

      {/* FR-VAL-06 / FR-ANA-01: Prüfaufgaben je Person (offen/erledigt) — dieselbe Quelle wie die
          Summen „Offene Aufgaben"/„Erledigt" darüber, jetzt Zeile für Zeile. */}
      <div>
        <div className="mb-2">
          <SectionLabel>{t("kennzahlen.personen.titel")}</SectionLabel>
        </div>
        <QueryState query={overview} emptyText={t("kennzahlen.personen.leer")}>
          {(summaries) => {
            const rows = assignmentRows(summaries);
            return (
              <Card>
                {rows.length === 0 ? (
                  <p className="text-[12.5px] text-muted">{t("kennzahlen.personen.leer")}</p>
                ) : (
                  <PersonenZeilen rows={rows} />
                )}
              </Card>
            );
          }}
        </QueryState>
      </div>

      {/* SCRUM-140: Wirkungs-/Impact-Metriken aus GET /api/analytics/impact.
          R-0723/R-0750: die vier Zahlen stehen oben im Executive-Blick; hier steht ihr Verlauf
          über die Zeit — validiertes Wissen je Woche und die Antwortquote je Woche. */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("ana.impact")}</SectionLabel>
          <HelpTip title={t("ana.impact")} body={t("kennzahlen.help.wirkung")} />
        </div>
        <QueryState query={impact}>
          {(bericht) => {
            const weeks = weeklyValidated(bericht.validatedByWeek);
            const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
            const rates = weeklyAnswerRate(bericht.askByWeek);
            const ohnePruefzeitpunkt = bericht.validatedUnknownWeek ?? 0;
            return (
              <div className="space-y-4">
                <Card data-testid="analytics-quote-woche">
                  <SectionLabel>{t("kennzahlen.wochen.quote")}</SectionLabel>
                  {rates.length === 0 ? (
                    <p className="text-[12.5px] text-muted">{t("kennzahlen.wochen.keineFragen")}</p>
                  ) : (
                    <div className="space-y-2">
                      {rates.map((w) => (
                        <div key={w.week} className="flex items-center gap-3">
                          <span className="w-24 font-mono text-[11px] text-muted-2">{w.week}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{ width: `${w.rate * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-muted-2">
                            {t("kennzahlen.wochen.quoteZeile", {
                              rate: formatRate(w.rate),
                              answered: w.answered,
                              asked: w.asked,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
                {weeks.length > 0 || ohnePruefzeitpunkt > 0 ? (
                  <Card data-testid="analytics-validiert-woche">
                    <SectionLabel>{t("ana.weekly")}</SectionLabel>
                    <p className="mb-2 text-[11px] leading-snug text-muted-2">
                      {t("kennzahlen.wochen.validiertHinweis")}
                    </p>
                    {ohnePruefzeitpunkt > 0 ? (
                      <p
                        data-testid="analytics-ohne-pruefzeitpunkt"
                        className="mb-2 text-[11px] leading-snug text-muted-2"
                      >
                        {t("kennzahlen.wochen.ohnePruefzeitpunkt", { n: ohnePruefzeitpunkt })}
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      {weeks.map((w) => (
                        <div key={w.week} className="flex items-center gap-3">
                          <span className="w-24 font-mono text-[11px] text-muted-2">{w.week}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{ width: `${(w.count / maxWeek) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-muted-2">{w.count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}
              </div>
            );
          }}
        </QueryState>
      </div>

      {/* SCRUM-143: Audit-Log mit Filtern (Actor/Action/Target) über echte Daten */}
      {/* SCRUM-229: stabiler Deep-Link-Anker für den Audit-Abschnitt. */}
      <div id={ANALYTICS_AUDIT_ANCHOR} className="scroll-mt-4">
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("ana.audit")}</SectionLabel>
          <HelpTip title={t("ana.audit")} body={t("ana.help.audit")} />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            aria-label={t("ana.filterActor")}
            value={filter.actor ?? ""}
            onChange={(e) => setAuditField("actor", e.target.value)}
            className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text outline-none focus:border-ink/30"
          >
            <option value="">
              {t("ana.filterActor")}: {t("ana.filterAll")}
            </option>
            {auditActors(allEntries).map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </select>
          <select
            aria-label={t("ana.filterAction")}
            value={filter.action ?? ""}
            onChange={(e) => setAuditField("action", e.target.value)}
            className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text outline-none focus:border-ink/30"
          >
            <option value="">
              {t("ana.filterAction")}: {t("ana.filterAll")}
            </option>
            {auditActions(allEntries).map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <input
            value={filter.target ?? ""}
            onChange={(e) => setAuditField("target", e.target.value)}
            placeholder={t("ana.filterTarget")}
            className="h-9 min-w-[10rem] flex-1 rounded-input border border-hairline bg-surface px-3 text-[13px] outline-none focus:border-ink/30"
          />
        </div>
        <QueryState query={audit} emptyText={t("ana.auditEmpty")}>
          {(entries) => {
            const filtered = filterAudit(entries, filter);
            return (
              <Card className="p-0">
                <div className="flex items-center justify-between px-4 py-2 text-[11px] text-muted-2">
                  <span className="font-mono uppercase tracking-wider">{t("ana.audit")}</span>
                  <span className="font-mono">
                    {t("ana.auditCount", { shown: filtered.length, total: entries.length })}
                  </span>
                </div>
                <div className="divide-y divide-hairline border-t border-hairline">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[12.5px] text-muted">
                      {t("ana.auditNoMatch")}
                    </div>
                  ) : (
                    filtered
                      .slice(-20)
                      .reverse()
                      .map((e) => (
                        <div
                          key={e.seq}
                          className="flex items-center gap-3 px-4 py-2 text-[12.5px]"
                        >
                          <span className="font-mono text-[11px] text-muted-2">
                            {new Date(e.at).toLocaleString()}
                          </span>
                          <span className="font-semibold text-text">{e.action}</span>
                          <span className="truncate text-muted">{e.target}</span>
                          <span className="ml-auto font-mono text-[11px] text-muted-2">
                            {e.actor}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </Card>
            );
          }}
        </QueryState>
      </div>
    </div>
  );
}

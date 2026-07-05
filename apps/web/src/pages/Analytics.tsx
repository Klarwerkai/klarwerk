import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
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
import { Card, PageHeader, QueryState, SectionLabel } from "../components/ui";
import {
  auditActions,
  auditActors,
  averageTrust,
  filterAudit,
  formatRate,
  validationRate,
  weeklyValidated,
  workloadSummary,
} from "../lib/analyticsMetrics";
import { ANALYTICS_AUDIT_ANCHOR, hashToElementId } from "../lib/analyticsSections";
import { executiveKpis } from "../lib/executiveKpis";
import { type HealthBand, knowledgeHealth } from "../lib/knowledgeHealth";

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
function ExecKpi({
  label,
  value,
  hint,
}: { label: string; value: number; hint: string }): JSX.Element {
  return (
    <div className="rounded-card bg-page p-4">
      <div className="font-mono text-micro uppercase tracking-wider text-muted-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
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

  // SCRUM-139: datenbasierte Trust-/Arbeitslast-Kennzahlen aus realem Bestand.
  const trust = averageTrust(kos.data ?? []);
  const work = workloadSummary(overview.data ?? []);

  // SCRUM-431: Executive-Blick — die vier Kern-Kennzahlen aus echten Live-Daten (kein Fake).
  const exec = executiveKpis({
    kos: kos.data ?? [],
    gaps: gaps.data ?? [],
    busFactor: busFactor.data ?? [],
  });

  // SCRUM-141: erklärbarer Knowledge-Health-Score aus echten Signalen.
  const health = knowledgeHealth({
    kos: kos.data ?? [],
    gaps: gaps.data ?? [],
    conflicts: conflicts.data ?? [],
    pendingRevalidation: pending.data ?? [],
    busFactor: busFactor.data ?? [],
  });

  // SCRUM-143: Audit-Filter über echte Daten (clientseitig, ohne Chain-Umbau).
  const [filter, setFilter] = useState<AuditFilter>({});
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
      <PageHeader kicker={t("ana.kicker")} title={t("nav.analytics")} />

      {/* SCRUM-431 (VIP/Investor): ruhiger Executive-Blick — vier Kern-Kennzahlen aus Live-Daten. */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("ana.exec.title")}</SectionLabel>
          <HelpTip title={t("ana.exec.title")} body={t("ana.help.exec")} />
        </div>
        <Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ExecKpi
              label={t("ana.exec.validated")}
              value={exec.validated}
              hint={t("ana.exec.validatedHint")}
            />
            <ExecKpi
              label={t("ana.exec.openReviews")}
              value={exec.openReviews}
              hint={t("ana.exec.openReviewsHint")}
            />
            <ExecKpi
              label={t("ana.exec.busFactor")}
              value={exec.singleSourceCategories}
              hint={t("ana.exec.busFactorHint")}
            />
            <ExecKpi
              label={t("ana.exec.rescued")}
              value={exec.rescuedGaps}
              hint={t("ana.exec.rescuedHint")}
            />
          </div>
        </Card>
      </div>

      {/* SCRUM-141: Knowledge Health — datenbasiert & erklärbar */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("health.title")}</SectionLabel>
          <HelpTip title={t("health.title")} body={t("ana.help.health")} />
        </div>
        <Card className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-card bg-page">
              <span className="text-2xl font-semibold text-ink">{health.score}</span>
              <span className="font-mono text-[9px] uppercase text-muted-2">/100</span>
            </div>
            <div className="min-w-0 flex-1">
              <span
                className={`inline-block rounded-pill px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${BAND_TONE[health.band]}`}
              >
                {t(`health.band.${health.band}`)}
              </span>
              <p className="mt-1.5 text-[12.5px] text-muted">
                {t(`health.explain.${health.band}`)}
              </p>
            </div>
          </div>
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
      </div>

      <QueryState query={analytics}>
        {(a) => {
          const maxType = Math.max(1, ...Object.values(a.byType));
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
            </div>
          );
        }}
      </QueryState>

      {/* SCRUM-140: Wirkungs-/Impact-Metriken aus GET /api/analytics/impact */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("ana.impact")}</SectionLabel>
          <HelpTip title={t("ana.impact")} body={t("ana.help.impact")} />
        </div>
        <QueryState query={impact}>
          {(im) => {
            const weeks = weeklyValidated(im.validatedByWeek);
            const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Kpi label={t("ana.impactValidated")} value={im.validatedTotal} />
                  <Kpi label={t("ana.impactAsk")} value={im.askTotal} />
                  <Kpi label={t("ana.impactAnswered")} value={im.answeredWithoutGap} />
                  <Kpi label={t("ana.impactRate")} value={formatRate(im.answerRate)} />
                </div>
                {weeks.length > 0 ? (
                  <Card>
                    <SectionLabel>{t("ana.weekly")}</SectionLabel>
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
            onChange={(e) => setFilter((f) => ({ ...f, actor: e.target.value || undefined }))}
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
            onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value || undefined }))}
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
            onChange={(e) => setFilter((f) => ({ ...f, target: e.target.value || undefined }))}
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

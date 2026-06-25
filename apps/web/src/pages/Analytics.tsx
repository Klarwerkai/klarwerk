import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAnalytics, useAudit, useImpact, useKos, useValidationOverview } from "../api/hooks";
import type { AuditFilter } from "../api/types";
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

function Kpi({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-card bg-page p-4">
      <div className="font-mono text-micro uppercase tracking-wider text-muted-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
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

  // SCRUM-139: datenbasierte Trust-/Arbeitslast-Kennzahlen aus realem Bestand.
  const trust = averageTrust(kos.data ?? []);
  const work = workloadSummary(overview.data ?? []);

  // SCRUM-143: Audit-Filter über echte Daten (clientseitig, ohne Chain-Umbau).
  const [filter, setFilter] = useState<AuditFilter>({});
  const allEntries = audit.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <PageHeader kicker={t("ana.kicker")} title={t("nav.analytics")} />

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
        <SectionLabel>{t("ana.impact")}</SectionLabel>
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
      <div>
        <SectionLabel>{t("ana.audit")}</SectionLabel>
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

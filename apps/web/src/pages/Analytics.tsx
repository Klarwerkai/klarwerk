import { useTranslation } from "react-i18next";
import { useAnalytics, useAudit } from "../api/hooks";
import { Card, PageHeader, QueryState, SectionLabel } from "../components/ui";

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
              <Card>
                <SectionLabel>{t("ana.byType")}</SectionLabel>
                <div className="space-y-2">
                  {Object.entries(a.byType).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-32 truncate text-[13px] text-text">{t(`ktype.${k}`)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(v / maxType) * 100}%` }} />
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

      <div>
        <SectionLabel>{t("ana.audit")}</SectionLabel>
        <QueryState query={audit} emptyText={t("ana.auditEmpty")}>
          {(entries) => (
            <Card className="p-0">
              <div className="divide-y divide-hairline">
                {entries.slice(-20).reverse().map((e) => (
                  <div key={e.seq} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                    <span className="font-mono text-[11px] text-muted-2">{new Date(e.at).toLocaleString()}</span>
                    <span className="font-semibold text-text">{e.action}</span>
                    <span className="truncate text-muted">{e.target}</span>
                    <span className="ml-auto font-mono text-[11px] text-muted-2">{e.actor}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </QueryState>
      </div>
    </div>
  );
}

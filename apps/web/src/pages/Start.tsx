import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAnalytics, useGaps, useValidationBoard } from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { useRole } from "../app/RoleContext";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { Card, PageHeader } from "../components/ui";
import { missionsForRole } from "../lib/missions";
import { stufe2FeatureLabelKeys, stufe2HintKind } from "../lib/stufe2Hint";

const CTA: Record<string, { to: string; key: string }> = {
  viewer: { to: "/fragen", key: "start.ctaAsk" },
  experte: { to: "/erfassen", key: "start.ctaCapture" },
  controller: { to: "/validierung", key: "start.ctaValidate" },
  admin: { to: "/validierung", key: "start.ctaValidate" },
};

function Kpi({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-card bg-page p-4">
      <div className="font-mono text-micro uppercase tracking-wider text-muted-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}

export function Start(): JSX.Element {
  const { t } = useTranslation();
  const { role, stufe2 } = useRole();
  const { user } = useSession();
  const analytics = useAnalytics();
  const board = useValidationBoard();
  const gaps = useGaps();
  const cta = CTA[role] ?? CTA.viewer;
  // FE-FND-09: rollenbewusste Missionen — Deep-Links in echte Flows (keine neuen Seiten).
  const missions = missionsForRole(role, stufe2);
  // SCRUM-235: ehrlicher Stufe-2-Auffindbarkeits-Hinweis — nur für Admins mit ausgeschaltetem Schalter.
  const showStufe2Hint = stufe2HintKind(role, stufe2) === "enable";
  const stufe2Features = stufe2FeatureLabelKeys()
    .map((k) => t(k))
    .join(", ");

  const todo = [
    ...(board.data ?? [])
      .slice(0, 3)
      .map((k) => ({ id: k.id, label: k.title, to: `/wissen/${k.id}` })),
    ...(gaps.data ?? []).slice(0, 2).map((g) => ({ id: g.id, label: g.question, to: "/risiko" })),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        kicker={t("start.kicker")}
        title={t("start.greeting", { name: user?.name ?? "" })}
        actions={
          <Link
            to={cta.to}
            className="inline-flex items-center gap-2 rounded-btn bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
          >
            {t(cta.key)}
            <ArrowRight size={16} />
          </Link>
        }
      />
      {missions.length > 0 ? (
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold text-ink">{t("missions.title")}</h2>
          <p className="mb-3 mt-0.5 text-[12.5px] text-muted">{t("missions.subtitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {missions.map((m) => (
              <Link
                key={m.id}
                to={m.path}
                className="group rounded-card border border-hairline bg-surface p-4 transition hover:border-ink/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-ink">{t(m.labelKey)}</span>
                  <ArrowRight
                    size={16}
                    className="text-muted-2 transition group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{t(m.descKey)}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {showStufe2Hint ? (
        <Card className="mb-5 border-dashed">
          <h2 className="text-[14px] font-semibold text-ink">{t("start.stufe2.title")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {t("start.stufe2.body", { features: stufe2Features, toggle: t("role.stage2") })}
          </p>
        </Card>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">{t("start.todo")}</h2>
            <Link to="/aufgaben" className="text-[12.5px] font-semibold text-brand">
              {t("start.allTasks")}
            </Link>
          </div>
          <div className="divide-y divide-hairline">
            {todo.length === 0 ? (
              <div className="py-4">
                <p className="text-sm text-muted">{t("start.todoEmpty")}</p>
                <EmptyStateCtas context="start" />
              </div>
            ) : (
              todo.map((it) => (
                <Link
                  key={it.id}
                  to={it.to}
                  className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80"
                >
                  <span className="truncate text-[13.5px] text-text">{it.label}</span>
                  <ArrowRight size={15} className="shrink-0 text-muted-2" />
                </Link>
              ))
            )}
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Kpi label={t("start.kpiTotal")} value={analytics.data?.total ?? "—"} />
          <Kpi label={t("start.kpiOpen")} value={analytics.data?.byStatus?.offen ?? "—"} />
          <Kpi label={t("start.kpiValidated")} value={analytics.data?.byStatus?.validiert ?? "—"} />
          <Kpi label={t("start.kpiGaps")} value={gaps.data?.length ?? "—"} />
        </div>
      </div>
    </div>
  );
}

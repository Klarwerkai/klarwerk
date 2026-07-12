import { ArrowRight, Check, CheckSquare, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAnalytics, useReasonerConfig } from "../api/hooks";
import {
  type FirstRunProgress,
  type FirstRunStepId,
  KI_STATE_KEY,
  firstRunStepDone,
  isAdminFirstRun,
  kiConnectionState,
  kiStateTone,
  markAdminFirstRunSeen,
} from "../lib/adminFirstRun";
import { Button, Card } from "./ui";

// SCRUM-429 (Pedi 03.07., VIP): ruhige Erststart-Führung für den neuen Admin. Nur beim ersten
// Besuch sichtbar (localStorage-Merker), bewusst ausblendbar. Bestätigt ehrlich, dass beide KIs
// verbunden sind (aus der echten Config, nie geraten), und zeigt drei geführte erste Schritte.
// Wird von Start.tsx NUR für Admins gerendert.

const TONE_CLASS: Record<"ok" | "warn" | "crit", string> = {
  ok: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
};

const STEPS: {
  id: FirstRunStepId;
  to: string;
  icon: typeof Plus;
  titleKey: string;
  bodyKey: string;
}[] = [
  {
    id: "capture",
    to: "/erfassen",
    icon: Plus,
    titleKey: "adm.firstrun.step.capture.t",
    bodyKey: "adm.firstrun.step.capture.b",
  },
  {
    id: "validate",
    to: "/validierung",
    icon: CheckSquare,
    titleKey: "adm.firstrun.step.validate.t",
    bodyKey: "adm.firstrun.step.validate.b",
  },
  {
    id: "admin",
    to: "/admin",
    icon: ShieldCheck,
    titleKey: "adm.firstrun.step.admin.t",
    bodyKey: "adm.firstrun.step.admin.b",
  },
];

export function AdminFirstRunCard(): JSX.Element | null {
  const { t } = useTranslation();
  const cfg = useReasonerConfig();
  const analytics = useAnalytics();
  const [visible, setVisible] = useState(() => isAdminFirstRun(window.localStorage));

  if (!visible) {
    return null;
  }

  const kiState = kiConnectionState(
    cfg.data?.cloudConfigured ?? false,
    cfg.data?.localConfigured ?? false,
  );
  // SCRUM-441: echter Fortschritt aus den vorhandenen Zählern — Häkchen statt Behauptung.
  const progress: FirstRunProgress = {
    total: analytics.data?.total ?? 0,
    validated: analytics.data?.byStatus.validiert ?? 0,
    kiBoth: kiState === "both",
  };
  const dismiss = (): void => {
    markAdminFirstRunSeen(window.localStorage, new Date().toISOString());
    setVisible(false);
  };

  return (
    <Card className="mb-5 border-ai/30 bg-ai-surface-1/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-ai" />
          <div>
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
              {t("adm.firstrun.kicker")}
            </p>
            <h2 className="text-[15px] font-semibold text-ink">{t("adm.firstrun.title")}</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-btn border border-hairline px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:text-text"
        >
          {t("adm.firstrun.dismiss")}
        </button>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{t("adm.firstrun.lead")}</p>

      {/* Ehrlicher KI-Verbindungsstatus — bei „both" beruhigend grün, sonst klarer Hinweis. */}
      <div
        className={`mt-3 inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ${
          TONE_CLASS[kiStateTone(kiState)]
        }`}
      >
        <ShieldCheck size={13} />
        {cfg.isLoading ? t("adm.firstrun.ki.loading") : t(KI_STATE_KEY[kiState])}
      </div>

      {/* Drei geführte erste Schritte — echte Deep-Links, keine neuen Seiten. */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STEPS.map((step) => {
          const done = firstRunStepDone(step.id, progress);
          return (
            <Link
              key={step.to}
              to={step.to}
              className={`group rounded-card border p-3 hover:border-ink/25 ${
                done ? "border-trust-pos-fill/40 bg-trust-pos-bg/40" : "border-hairline bg-surface"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text">
                {done ? (
                  <Check size={14} className="text-trust-pos-text" />
                ) : (
                  <step.icon size={14} className="text-muted-2" />
                )}
                {t(step.titleKey)}
                {done ? (
                  <span className="rounded-pill bg-trust-pos-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-trust-pos-text">
                    {t("adm.firstrun.doneBadge")}
                  </span>
                ) : null}
                <ArrowRight
                  size={13}
                  className="ml-auto text-muted-2 transition-transform group-hover:translate-x-0.5"
                />
              </span>
              <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
                {t(step.bodyKey)}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-2">{t("adm.firstrun.note")}</p>

      <div className="mt-2">
        <Button variant="ghost" onClick={dismiss}>
          {t("adm.firstrun.done")}
        </Button>
      </div>
    </Card>
  );
}

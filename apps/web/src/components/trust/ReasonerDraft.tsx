import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

// KI-Kennung (BRIEF §5 / G-3): Reasoner-Inhalte sind IMMER als Entwurf
// erkennbar — gestrichelter violetter Rahmen, violette Fläche, Label + ✦.
export function ReasonerDraft({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-dashed border-ai-dashed bg-ai-surface-2 p-4">
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ai">
        <span aria-hidden>✦</span>
        {t("reasoner.draftLabel")}
      </div>
      {children}
    </div>
  );
}

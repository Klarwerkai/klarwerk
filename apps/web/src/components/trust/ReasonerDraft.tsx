import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ERGEBNIS_STUFE_TEXT, REASONER_ENTWURF_FLAECHE } from "../../lib/kiHerkunft";

// KI-Kennung (BRIEF §5 / G-3): Reasoner-Inhalte sind IMMER als Entwurf
// erkennbar — gestrichelter violetter Rahmen, violette Fläche, Label + ✦.
// R-1020 (Ben Nacharbeit 2): Beschriftung jetzt im Wortlaut der Quelle — „Reasoner-Entwurf, nicht
// validiert" — und Fläche/Rahmen aus derselben Konstante wie alle übrigen KI-Ergebnisse.
export function ReasonerDraft({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className={`rounded-card p-4 ${REASONER_ENTWURF_FLAECHE}`}>
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ai">
        <span aria-hidden>✦</span>
        {t(ERGEBNIS_STUFE_TEXT.entwurf)}
      </div>
      {children}
    </div>
  );
}

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

// AUFTRAG-mega3 Block B (bens D9): EIN sichtbarer, übersetzter Fehlerzustand mit Wiederholen-Knopf für
// die zusammengehörigen Kennzahl-Gruppen (Start, Analytics, Bereitschaft). Ehrlich: ein dauerhaft
// gescheiterter Abruf zeigt „konnte nicht geladen werden" statt endlos „lädt" oder einer erfundenen 0.
export function LoadErrorState({ onRetry }: { onRetry: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-card border border-trust-crit-bg bg-trust-crit-bg px-3 py-2.5 text-[13px] text-trust-crit-text"
    >
      <AlertTriangle size={16} className="shrink-0" />
      <span className="flex-1">{t("loadstate.error.title")}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-btn border border-trust-crit-text/40 px-2.5 py-1 font-semibold hover:bg-trust-crit-text/10"
      >
        <RefreshCw size={13} />
        {t("loadstate.error.retry")}
      </button>
    </div>
  );
}

// Stale/gestört: die Daten sind noch da (weiter angezeigt), aber ein Refetch scheiterte — sichtbar als
// veraltet markiert (NICHT in den Initialfehlerzustand gefallen). Optionaler Retry.
export function StaleMarker({ onRetry }: { onRetry?: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    // <output> trägt implizit role="status" (biome useSemanticElements) — sichtbare Störungsmarkierung.
    <output className="flex flex-wrap items-center gap-2 rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] font-semibold text-trust-warn-text">
      <AlertTriangle size={13} className="shrink-0" />
      <span className="flex-1">{t("loadstate.stale")}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-btn px-2 py-0.5 hover:bg-trust-warn-text/10"
        >
          <RefreshCw size={12} />
          {t("loadstate.error.retry")}
        </button>
      ) : null}
    </output>
  );
}

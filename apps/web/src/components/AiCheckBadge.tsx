// WP-SUBMIT-ASYNC (Pedis Architektur-Entscheid R3, 21.07.): das Einreichen blockiert nicht mehr
// auf die KI-Pruefung — DIESES Badge macht den Hintergrund-Status auf der Validierungs-Karte
// sichtbar. pending → dezenter Laeuft-Hinweis (Uhr, kein lauter Spinner); failed → ehrliche
// Warn-Pill mit Ursache im Tooltip + Retry-Knopf (reiht den Job serverseitig neu ein);
// done ODER Altbestand ohne aiCheck-Feld → bewusst NICHTS (kein Badge-Rauschen fuer den Normalfall).
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../api/types";
import { aiCheckFailureReasonKey } from "../lib/aiCheckStatusCard";

export interface AiCheckBadgeProps {
  aiCheck: KnowledgeObject["aiCheck"];
  // Reiht die Pruefung neu ein (POST /api/kos/:id/ai-check) — nur im failed-Zustand sichtbar.
  onRetry: () => void;
  retryBusy?: boolean;
}

// WP-SHIP9-S1 (Pedis B3): die Ursache→Key-Abbildung lebt jetzt in der lib (aiCheckStatusCard) —
// EINE Quelle für dieses Badge UND die Live-Status-Karte auf /erfassen (eine .ts-lib darf keine
// .tsx importieren, Root-Build ohne jsx). Re-Export erhält die bestehende Import-Fläche.
export { aiCheckFailureReasonKey };

export function AiCheckBadge({
  aiCheck,
  onRetry,
  retryBusy,
}: AiCheckBadgeProps): JSX.Element | null {
  const { t } = useTranslation();
  if (!aiCheck || aiCheck.status === "done") {
    return null;
  }
  if (aiCheck.status === "pending") {
    return (
      <span
        title={t("val.aiCheck.pendingHint")}
        className="inline-flex items-center gap-1 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted"
      >
        <Clock className="h-3 w-3 animate-pulse" aria-hidden="true" />
        {t("val.aiCheck.pending")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span
        title={t(aiCheckFailureReasonKey(aiCheck.fallbackReason))}
        className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold text-trust-warn-text"
      >
        {t("val.aiCheck.failed")}
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={retryBusy}
        className="rounded-pill border border-hairline px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted hover:text-text disabled:opacity-50"
      >
        {t("val.aiCheck.retry")}
      </button>
    </span>
  );
}

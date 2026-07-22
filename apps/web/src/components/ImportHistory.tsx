// WP-COCKPIT-LINIE (Punkt 4, Pedis Stör-Befund): die Source-Review-Queue unter dem Cockpit bekommt
// eine klare Abgrenzung — eigene, STANDARDMÄSSIG EINGEKLAPPTE Sektion „Bereits übernommene Beiträge
// (Verlauf)" mit Zähler. Der laufende Import-Fluss oben bleibt dadurch eine gerade Linie; wer den
// Verlauf braucht, klappt ihn bewusst auf. Reiner Präsentations-Rahmen — die Queue selbst (Inhalt)
// bleibt unverändert und wird als children durchgereicht.
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function ImportHistorySection({
  openCount,
  totalCount,
  children,
}: {
  // WP-COCKPIT-LINIE-b (bens Punkt 3): der Zähler zeigt offen und gesamt getrennt.
  openCount: number;
  totalCount: number;
  children: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    // Bewusst OHNE open-Attribut: Standard zu (Pedis Befund — die Altlast stört die Linie nicht mehr).
    <details className="mb-5 rounded-card border border-hairline bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3">
        <ChevronDown size={16} className="shrink-0 text-muted-2" />
        <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-text">
          {t("imp.history.title")}
        </span>
        <span className="shrink-0 rounded-pill bg-page px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-2">
          {t("imp.history.count", { open: openCount, total: totalCount })}
        </span>
      </summary>
      <div className="border-t border-hairline p-3">
        <p className="mb-3 text-[12px] leading-relaxed text-muted">{t("imp.history.hint")}</p>
        {children}
      </div>
    </details>
  );
}

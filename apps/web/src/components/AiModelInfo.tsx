// Pedi 04.07.: „(!)"-Info an jedem KI-Knopf — zeigt beim Öffnen offen, WELCHE KI die Aufgabe
// ausführt: Modus (Cloud / Lokal / Regelbasiert) und, falls ein Modell arbeitet, dessen Name.
// Read-only aus der vorhandenen /reasoner/config (SCRUM-166: nur Metadaten, keine Secrets).
// Reine Anzeige — kein Zustand, keine Aktion, keine Validierung.
import { Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useReasonerConfig } from "../api/hooks";
import { AI_TASK_INFO_TEXT, aiTaskInfo } from "../lib/reasonerTaskInfo";

export function AiModelInfo({ task }: { task: string }): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const config = useReasonerConfig();
  const info = aiTaskInfo(config.data, task);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={t(AI_TASK_INFO_TEXT.title)}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-4 w-4 place-items-center rounded-full text-[11px] ${
          open ? "text-ai" : "text-muted-2 hover:text-text"
        }`}
      >
        <Info size={14} />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label={t("cmd.close")}
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute left-0 top-6 z-40 w-64 rounded-card border border-hairline bg-surface p-3 text-left shadow-popover">
            <div className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
              {t(AI_TASK_INFO_TEXT.title)}
            </div>
            <div className="mt-1 text-[13px] font-semibold text-ink">{t(info.modeLabelKey)}</div>
            {info.modelName ? (
              <div className="mt-0.5 text-[11.5px] text-muted">
                {t(AI_TASK_INFO_TEXT.modelLabel)}: {info.modelName}
              </div>
            ) : null}
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{t(info.bodyKey)}</p>
          </div>
        </>
      ) : null}
    </span>
  );
}

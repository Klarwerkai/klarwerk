// Pedi 04.07.: „(!)"-Info an jedem KI-Knopf — zeigt beim Öffnen offen, WELCHE KI die Aufgabe
// ausführt: Modus (Cloud / Lokal / Regelbasiert) und, falls ein Modell arbeitet, dessen Name.
// WP-VIP2-GATE-2 (bens Fix 3): /reasoner/config ist jetzt echte ADMIN-Sicht (users.manage) —
// Admins sehen weiter die per-Aufgabe-Zuordnung samt Modellname; alle anderen bekommen die
// ehrliche GLOBALE Stufe aus dem oeffentlichen abstrahierten Status (/reasoner/status), ohne
// Modellname. Reine Anzeige — kein Zustand, keine Aktion, keine Validierung.
import { Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useReasonerConfig, useReasonerStatus } from "../api/hooks";
import { useRole } from "../app/RoleContext";
import { AI_TASK_INFO_TEXT, aiTaskInfo, aiTaskInfoPublic } from "../lib/reasonerTaskInfo";

export function AiModelInfo({ task }: { task: string }): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { role } = useRole();
  const config = useReasonerConfig(role === "admin");
  const publicStatus = useReasonerStatus();
  const info = config.data ? aiTaskInfo(config.data, task) : aiTaskInfoPublic(publicStatus.data);
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
            {/* Pedi 05.07.: Datenschutz-Hinweis — grün, wenn die KI im Haus läuft (lokal/regelbasiert,
                keine Übermittlung an Dritte); amber bei externer Cloud-Verarbeitung. Ohne Konfiguration
                bewusst keine Aussage (kein Fake-Grün). */}
            {info.dsgvo !== "unknown" ? (
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    info.dsgvo === "inhouse"
                      ? "bg-trust-pos-bg text-trust-pos-text"
                      : "bg-trust-warn-bg text-trust-warn-text"
                  }`}
                >
                  {t(
                    info.dsgvo === "inhouse"
                      ? AI_TASK_INFO_TEXT.dsgvoInhouse
                      : AI_TASK_INFO_TEXT.dsgvoExternal,
                  )}
                </span>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-2">
                  {t(
                    info.dsgvo === "inhouse"
                      ? AI_TASK_INFO_TEXT.dsgvoInhouseBody
                      : AI_TASK_INFO_TEXT.dsgvoExternalBody,
                  )}
                </p>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </span>
  );
}

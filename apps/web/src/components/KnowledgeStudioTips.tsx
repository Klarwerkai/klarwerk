// SCRUM-345: kompakte Bedien-/Formatierungs-Hilfe über der Editorfläche im Knowledge Input Studio.
// Erklärt die vorhandenen Werkzeuge als kurze Arbeitsschritte (markieren→formatieren, Struktur,
// KI-Vorschlag bewusst übernehmen, Templates/Blöcke) — kein Onboarding-Overlay, keine neue State-
// Maschine. Reine Anzeige auf Basis des DOM-freien knowledgeStudioTips-Helfers.
import { Keyboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { KNOWLEDGE_STUDIO_TIPS } from "../lib/knowledgeStudioTips";

export function KnowledgeStudioTips(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-hairline bg-page p-2.5">
      <div className="flex items-center gap-1.5">
        <Keyboard size={13} className="text-muted" />
        <span className="text-[11.5px] font-semibold text-ink">{t("studio.tips.title")}</span>
      </div>
      <ul className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {KNOWLEDGE_STUDIO_TIPS.map((tip) => (
          <li key={tip.id} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] font-semibold text-text">{t(tip.labelKey)}</span>
              {tip.shortcut ? (
                <span className="rounded-btn border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[9.5px] text-muted-2">
                  {tip.shortcut}
                </span>
              ) : null}
            </div>
            <p className="text-[11px] leading-relaxed text-muted">{t(tip.hintKey)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

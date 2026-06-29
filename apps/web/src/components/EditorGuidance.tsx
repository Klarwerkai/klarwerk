// SCRUM-317: kompakte Orientierungs-Karte direkt am Feld „Ausführlicher Inhalt". Erklärt die
// Editor-Werkzeuge (Struktur/Handlung/Blöcke/KI) in einer kleinen Hilfezeile — verdrängt den Editor
// nicht. Reine Anzeige auf Basis des DOM-freien editorGuidance-Helfers.
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EDITOR_GUIDANCE } from "../lib/editorGuidance";

export function EditorGuidance(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mb-2 rounded-card border border-hairline bg-page p-2.5">
      <div className="flex items-center gap-1.5">
        <Info size={13} className="text-muted" />
        <span className="text-[11.5px] font-semibold text-ink">{t("editor.guidance.title")}</span>
      </div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {EDITOR_GUIDANCE.map((item) => (
          <li key={item.id} className="text-[11.5px] leading-relaxed text-muted">
            {t(item.labelKey)}
          </li>
        ))}
      </ul>
    </div>
  );
}

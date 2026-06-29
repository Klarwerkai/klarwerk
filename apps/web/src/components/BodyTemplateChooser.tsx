// SCRUM-319: kleine, bewusste Body-Vorlagen-Auswahl für den ausführlichen Inhalt.
// Kein Auto-Fill: Nutzer klickt eine Vorlage; leerer Body wird gesetzt, vorhandener Body ergänzt.

import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  BODY_TEMPLATES,
  applyBodyTemplate,
  normalizeBodyTemplateLocale,
} from "../lib/bodyTemplates";
import { templateApplyMode, templateApplyModeHintKey } from "../lib/editorApplySafety";

export function BodyTemplateChooser({
  bodyHtml,
  onApply,
}: {
  bodyHtml: string;
  onApply: (html: string) => void;
}): JSX.Element {
  const { i18n, t } = useTranslation();
  const locale = normalizeBodyTemplateLocale(i18n.language);
  const mode = templateApplyMode(bodyHtml);

  return (
    <div className="mb-2 rounded-card border border-hairline bg-surface p-2.5">
      <div className="flex items-center gap-1.5">
        <FileText size={13} className="text-muted" />
        <span className="text-[11.5px] font-semibold text-ink">{t("editor.template.title")}</span>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{t("editor.template.hint")}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-2">
        {t(templateApplyModeHintKey(mode))}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {BODY_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            title={t(template.descriptionKey)}
            onClick={() => onApply(applyBodyTemplate(bodyHtml, template.id, locale))}
            className="rounded-pill border border-hairline bg-page px-2.5 py-1 text-[12px] font-semibold text-muted hover:border-ink/30 hover:text-text"
          >
            {t(template.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

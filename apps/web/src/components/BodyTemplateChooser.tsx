// SCRUM-319: bewusste Body-Vorlagen-Auswahl für den ausführlichen Inhalt.
// SCRUM-342: Preview-&-Apply — Nutzer wählt eine Vorlage, sieht die Vorschau und den Set/Append-Hinweis
// und übernimmt dann bewusst per Button. Kein Auto-Fill, kein stilles Überschreiben: leerer Body wird
// gesetzt, vorhandener Body ergänzt. Die Vorschau zeigt nur sicheres, sanitisiertes Template-HTML
// (vorhandene Konstanten über bodyTemplateHtml + SanitizedHtml) — keine Nutzereingaben.

import { FileText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BODY_TEMPLATES,
  type BodyTemplateId,
  applyBodyTemplate,
  bodyTemplateHtml,
  normalizeBodyTemplateLocale,
} from "../lib/bodyTemplates";
import { templateApplyMode, templateApplyModeHintKey } from "../lib/editorApplySafety";
import { HelpTip } from "./HelpTip";
import { SanitizedHtml } from "./SanitizedHtml";
import { Button } from "./ui";

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
  // SCRUM-342: aktuell ausgewählte Vorlage (lokal); Default = erste Vorlage. Klick wählt nur aus.
  const [selected, setSelected] = useState<BodyTemplateId>(BODY_TEMPLATES[0]?.id ?? "procedure");
  const selectedTemplate = BODY_TEMPLATES.find((tmpl) => tmpl.id === selected) ?? BODY_TEMPLATES[0];

  return (
    <div className="mb-2 rounded-card border border-hairline bg-surface p-2.5">
      <div className="flex items-center gap-1.5">
        <FileText size={13} className="text-muted" />
        <span className="text-[11.5px] font-semibold text-ink">{t("editor.template.title")}</span>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{t("editor.template.hint")}</p>

      {/* Auswahl: Klick wählt eine Vorlage aus (wendet sie NICHT sofort an).
          SCRUM-404 (Pedi 03.07.): ?-Hilfe an jeder Vorlage — ein Satz, was sie enthält. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {BODY_TEMPLATES.map((template) => (
          <span key={template.id} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              title={t(template.descriptionKey)}
              onClick={() => setSelected(template.id)}
              aria-pressed={selected === template.id}
              className={`rounded-pill border px-2.5 py-1 text-[12px] font-semibold ${
                selected === template.id
                  ? "border-ink bg-ink text-white"
                  : "border-hairline bg-page text-muted hover:border-ink/30 hover:text-text"
              }`}
            >
              {t(template.labelKey)}
            </button>
            <HelpTip title={t(template.labelKey)} body={t(template.descriptionKey)} />
          </span>
        ))}
      </div>

      {selectedTemplate ? (
        <>
          <p className="mt-2 text-[11px] text-muted">
            <span className="font-semibold text-text">{t("editor.template.selected")}: </span>
            {t(selectedTemplate.descriptionKey)}
          </p>

          {/* Vorschau: nur sicheres, sanitisiertes Template-HTML. */}
          <div className="mt-1.5">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
              {t("editor.template.preview")}
            </p>
            <SanitizedHtml
              html={bodyTemplateHtml(selectedTemplate.id, locale)}
              className="prose-kw mt-1 max-h-56 overflow-y-auto rounded-btn border border-hairline bg-page px-2.5 py-2 text-[12.5px]"
            />
          </div>

          {/* Set/Append-Hinweis + bewusste Übernahme.
              SCRUM-404 (Pedi 03.07.): Knopf sagt jetzt konkret, WAS passiert (einsetzen vs. unten
              anfügen), plus ?-Hilfe mit der vollständigen Erklärung. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] leading-relaxed text-muted-2 sm:mr-auto">
              {t(templateApplyModeHintKey(mode))}
            </span>
            <span className="inline-flex items-center gap-1">
              <Button
                variant="primary"
                onClick={() => onApply(applyBodyTemplate(bodyHtml, selectedTemplate.id, locale))}
              >
                {mode === "set" ? t("editor.template.applySet") : t("editor.template.applyAppend")}
              </Button>
              <HelpTip
                title={
                  mode === "set" ? t("editor.template.applySet") : t("editor.template.applyAppend")
                }
                body={t("editor.template.applyHelp")}
              />
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

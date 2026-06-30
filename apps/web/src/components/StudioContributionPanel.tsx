// SCRUM-353: leichtgewichtiger Beitragswert-/Qualitätsblick im Knowledge Studio. Zeigt ruhig,
//  - welches Niveau der Entwurf gerade hat (leer / Entwurf / solide),
//  - was schon gut ist (vorhandene Struktur-Stärken),
//  - was ihn noch stärker machen würde (Hinweise, keine Blocker).
// Reine Anzeige auf Basis des DOM-freien studioContribution-Helfers. KEIN Score, keine Punkte,
// keine Validierung — Status/Trust bleiben unverändert maßgeblich.
import { useTranslation } from "react-i18next";
import type { AttachmentLike } from "../lib/editorAttachmentContext";
import { editorContentQuality } from "../lib/editorContentQuality";
import { studioContribution } from "../lib/knowledgeStudioGuide";

const LEVEL_TONE = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
} as const;

export function StudioContributionPanel({
  bodyHtml,
  attachments = [],
}: {
  bodyHtml: string;
  attachments?: readonly AttachmentLike[];
}): JSX.Element {
  const { t } = useTranslation();
  const contribution = studioContribution(editorContentQuality({ bodyHtml, attachments }));

  return (
    <div className="rounded-card border border-hairline bg-page p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-ink">{t("studio.contrib.title")}</span>
        <span
          className={`rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${LEVEL_TONE[contribution.tone]}`}
        >
          {t(contribution.levelLabelKey)}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{t(contribution.levelHintKey)}</p>

      {contribution.strengths.length > 0 ? (
        <div className="mt-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-trust-pos-text">
            {t("studio.contrib.strengthsTitle")}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {contribution.strengths.map((item) => (
              <li key={item.id} className="text-[11.5px] leading-relaxed text-text">
                <span aria-hidden="true" className="mr-1 text-trust-pos-text">
                  ✓
                </span>
                {t(item.labelKey)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {contribution.suggestions.length > 0 ? (
        <div className="mt-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-2">
            {t("studio.contrib.suggestionsTitle")}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {contribution.suggestions.map((item) => (
              <li key={item.id} className="text-[11.5px] leading-relaxed text-muted">
                <span aria-hidden="true" className="mr-1 text-muted-2">
                  +
                </span>
                {t(item.labelKey)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Leichtgewichtiger Wertbeitrag — warum dieser Beitrag zählt (ehrlich: erst nach Prüfung gesichert). */}
      <p className="mt-2 border-t border-hairline pt-2 text-[11px] leading-relaxed text-muted">
        {t("studio.contrib.valueNote")}
      </p>
    </div>
  );
}

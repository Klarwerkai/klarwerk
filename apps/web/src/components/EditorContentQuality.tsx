// SCRUM-324: kompakte Inhaltsqualitätskarte am Body-Feld. Zeigt STRUKTUR-/Nachvollziehbarkeits-
// Signale (Überschriften, Listen, Blöcke, Links, Anhang-Bezug) als positive bzw. warnende Hinweise.
// Ehrlich: prüft Struktur, NICHT fachliche Richtigkeit; blockiert das Speichern nicht.
import { AlertTriangle, Check, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AttachmentLike } from "../lib/editorAttachmentContext";
import { editorContentQuality } from "../lib/editorContentQuality";

export function EditorContentQuality({
  bodyHtml,
  attachments = [],
}: {
  bodyHtml?: string | null;
  attachments?: readonly AttachmentLike[];
}): JSX.Element {
  const { t } = useTranslation();
  const q = editorContentQuality({ bodyHtml, attachments });

  const positives: string[] = [];
  if (q.hasHeadings) positives.push(t("editor.quality.headings"));
  if (q.hasLists) positives.push(t("editor.quality.lists"));
  if (q.hasBlocks) positives.push(t("editor.quality.blocks"));
  if (q.hasLinks) positives.push(t("editor.quality.links"));

  const warnings: string[] = [];
  if (q.isEmpty) warnings.push(t("editor.quality.empty"));
  if (q.isThin) warnings.push(t("editor.quality.thin"));
  if (q.attachmentsUnreferenced) warnings.push(t("editor.quality.attachmentsUnreferenced"));

  return (
    <div className="mb-2 rounded-card border border-hairline bg-page p-2.5">
      <div className="flex items-center gap-1.5">
        <ListChecks size={13} className="text-muted" />
        <span className="text-[11.5px] font-semibold text-ink">{t("editor.quality.title")}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-2">{t("editor.quality.hint")}</p>
      {positives.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {positives.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-pill bg-trust-pos-bg px-2 py-0.5 text-[10.5px] font-semibold text-trust-pos-text"
            >
              <Check size={11} />
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {warnings.map((label) => (
            <li key={label} className="flex items-start gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-trust-warn-fill" />
              <span className="text-[11.5px] leading-relaxed text-muted">{label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

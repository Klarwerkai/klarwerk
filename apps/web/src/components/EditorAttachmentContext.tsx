// SCRUM-323: kompakte Attachment-Kontextkarte am Feld „Ausführlicher Inhalt". Zeigt Anzahl Bilder und
// Dateien und erklärt ehrlich: Bilder lassen sich über den Bild-Button einfügen, Dateien bleiben
// Anhang/Evidence (nicht inline). Ohne Anhänge wird nichts gerendert (keine leere Karte).
import { FileText, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ATTACH_FILES_KEY,
  ATTACH_FILE_HINT_KEY,
  ATTACH_IMAGES_KEY,
  ATTACH_IMAGE_HINT_KEY,
  ATTACH_TITLE_KEY,
  type AttachmentLike,
  attachmentContext,
} from "../lib/editorAttachmentContext";

export function EditorAttachmentContext({
  attachments,
}: {
  attachments: readonly AttachmentLike[];
}): JSX.Element | null {
  const { t } = useTranslation();
  const ctx = attachmentContext(attachments);
  if (!ctx.hasAny) {
    return null;
  }
  return (
    <div className="mb-2 rounded-card border border-hairline bg-page p-2.5">
      <span className="text-[11.5px] font-semibold text-ink">{t(ATTACH_TITLE_KEY)}</span>
      <div className="mt-1.5 flex flex-col gap-1">
        <div className="flex items-start gap-1.5">
          <ImageIcon size={13} className="mt-0.5 shrink-0 text-muted" />
          <span className="text-[11.5px] leading-relaxed text-muted">
            <span className="font-semibold text-text">
              {ctx.imageCount} {t(ATTACH_IMAGES_KEY)}
            </span>{" "}
            — {t(ATTACH_IMAGE_HINT_KEY)}
          </span>
        </div>
        <div className="flex items-start gap-1.5">
          <FileText size={13} className="mt-0.5 shrink-0 text-muted" />
          <span className="text-[11.5px] leading-relaxed text-muted">
            <span className="font-semibold text-text">
              {ctx.fileCount} {t(ATTACH_FILES_KEY)}
            </span>{" "}
            — {t(ATTACH_FILE_HINT_KEY)}
          </span>
        </div>
      </div>
    </div>
  );
}

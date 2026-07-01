// SCRUM-323 / SCRUM-371: kompakte Media-/Evidence-Kontextkarte am Feld „Ausführlicher Inhalt". Erklärt
// ehrlich und object-store-bewusst, welche Anhänge inline eingebettet werden können (Bilder), welche als
// sicherer Body-Link referenzierbar sind (Dateien mit Object-Store-ID) und welche als Anhang/Evidence
// bleiben (noch nicht hochgeladene Session-Dateien — kein Fake-Link, nach dem Speichern verlinkbar).
// Kernaussage: Evidence verbessert die Nachvollziehbarkeit, ersetzt aber NIE Status/Trust/Validierung.
// Ohne Anhänge wird nichts gerendert (keine leere Karte). Reine Anzeige auf Basis DOM-freier Helfer.
import { FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type AttachmentLike,
  MEDIA_EVIDENCE_HINT_KEY,
  MEDIA_EVIDENCE_KEY,
  MEDIA_IMAGES_KEY,
  MEDIA_IMAGE_HINT_KEY,
  MEDIA_LINKABLE_HINT_KEY,
  MEDIA_LINKABLE_KEY,
  MEDIA_NOTE_KEY,
  MEDIA_TITLE_KEY,
  editorMediaGuide,
} from "../lib/editorAttachmentContext";

export function EditorAttachmentContext({
  attachments,
}: {
  attachments: readonly AttachmentLike[];
}): JSX.Element | null {
  const { t } = useTranslation();
  const guide = editorMediaGuide(attachments);
  if (!guide.hasAny) {
    return null;
  }
  return (
    <div className="mb-2 rounded-card border border-hairline bg-page p-2.5">
      <span className="text-[11.5px] font-semibold text-ink">{t(MEDIA_TITLE_KEY)}</span>
      <div className="mt-1.5 flex flex-col gap-1">
        {guide.hasImages ? (
          <div className="flex items-start gap-1.5">
            <ImageIcon size={13} className="mt-0.5 shrink-0 text-muted" />
            <span className="text-[11.5px] leading-relaxed text-muted">
              <span className="font-semibold text-text">
                {guide.inlineImages} {t(MEDIA_IMAGES_KEY)}
              </span>{" "}
              — {t(MEDIA_IMAGE_HINT_KEY)}
            </span>
          </div>
        ) : null}
        {guide.hasLinkableFiles ? (
          <div className="flex items-start gap-1.5">
            <Paperclip size={13} className="mt-0.5 shrink-0 text-muted" />
            <span className="text-[11.5px] leading-relaxed text-muted">
              <span className="font-semibold text-text">
                {guide.linkableFiles} {t(MEDIA_LINKABLE_KEY)}
              </span>{" "}
              — {t(MEDIA_LINKABLE_HINT_KEY)}
            </span>
          </div>
        ) : null}
        {guide.hasEvidenceFiles ? (
          <div className="flex items-start gap-1.5">
            <FileText size={13} className="mt-0.5 shrink-0 text-muted" />
            <span className="text-[11.5px] leading-relaxed text-muted">
              <span className="font-semibold text-text">
                {guide.evidenceFiles} {t(MEDIA_EVIDENCE_KEY)}
              </span>{" "}
              — {t(MEDIA_EVIDENCE_HINT_KEY)}
            </span>
          </div>
        ) : null}
      </div>
      {/* Ehrlich: Evidence verbessert Nachvollziehbarkeit, ist aber keine Freigabe — Validierung entscheidet. */}
      <p className="mt-1.5 border-t border-hairline pt-1.5 text-[11px] leading-relaxed text-muted-2">
        {t(MEDIA_NOTE_KEY)}
      </p>
    </div>
  );
}

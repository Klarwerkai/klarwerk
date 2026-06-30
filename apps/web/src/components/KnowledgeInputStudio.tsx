// SCRUM-337: Beta Knowledge Input Studio — großer, KI-gestützter Editing-Arbeitsraum als Fullscreen-
// Overlay. Öffnet aus Capture UND KO-Detail-Edit und bündelt die vorhandenen Editor-Bausteine
// (Orientierung, Anhang-Kontext, Inhaltsqualität, Strukturvorlagen, RichText-Editor, KI-Hilfe) auf
// deutlich mehr Arbeitsfläche. Arbeitet auf einem internen Entwurf des vorhandenen `bodyHtml`-State
// und schreibt NUR bei bewusster Übernahme zurück. KEIN Auto-Save, KEINE Auto-Validierung, kein
// Backend, keine neue Editor-Library — reine Wiederverwendung bestehender Komponenten/Helfer.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type BodyAssistBlockAction,
  applyBodyAssist,
  bodyAssistBlockActions,
  bodyTextForAssist,
} from "../lib/bodyAiAssist";
import type { AttachmentLike } from "../lib/editorAttachmentContext";
import { AiAssistBox } from "./AiAssistBox";
import { BodyTemplateChooser } from "./BodyTemplateChooser";
import { EditorAttachmentContext } from "./EditorAttachmentContext";
import { EditorContentQuality } from "./EditorContentQuality";
import { EditorGuidance } from "./EditorGuidance";
import type { EditorImage } from "./RichTextEditor";
import { RichTextEditor } from "./RichTextEditor";
import { Button } from "./ui";

export function KnowledgeInputStudio({
  open,
  onClose,
  bodyHtml,
  onApply,
  runAssist,
  images = [],
  attachments = [],
}: {
  open: boolean;
  onClose: () => void;
  bodyHtml: string;
  // Wird NUR bei bewusster Übernahme aufgerufen (kein Auto-Save).
  onApply: (next: string) => void;
  runAssist: (text: string, instruction?: string) => Promise<string>;
  images?: EditorImage[];
  attachments?: readonly AttachmentLike[];
}): JSX.Element | null {
  const { t } = useTranslation();
  // Interner Entwurf: beim Öffnen aus dem aktuellen Body initialisiert; Änderungen bleiben lokal,
  // bis der Nutzer bewusst übernimmt. So bleibt der bestehende Save/Revise-Flow unberührt.
  const [draft, setDraft] = useState(bodyHtml);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur beim Öffnen synchronisieren.
  useEffect(() => {
    if (open) {
      setDraft(bodyHtml);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const blockActions: BodyAssistBlockAction[] = bodyAssistBlockActions(draft);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-page/95 backdrop-blur-sm">
      {/* Kopfzeile: Titel + ehrlicher Hinweis (kein Auto-Save) + Schließen. */}
      <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-text">{t("studio.title")}</h2>
          <p className="truncate text-[11.5px] text-muted">{t("studio.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-btn border border-hairline px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-text"
        >
          {t("studio.close")}
        </button>
      </div>

      {/* Arbeitsfläche: scrollbar, großzügig — die gebündelten Editor-Bausteine. */}
      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <EditorGuidance />
        <EditorAttachmentContext attachments={attachments} />
        <EditorContentQuality bodyHtml={draft} attachments={attachments} />
        <BodyTemplateChooser bodyHtml={draft} onApply={setDraft} />
        <div className="mt-2">
          <RichTextEditor value={draft} onChange={setDraft} images={images} />
        </div>
        {/* KI-Hilfe direkt im Arbeitsraum sichtbar: Aktionen (Klarer/Strukturieren/Erweitern/
            Rechtschreibung) + freies Anweisungsfeld + Vorschau mit Ersetzen/Anhängen/Verwerfen,
            zusätzlich Übernahme als Info/Hinweis/Warnung/Erfolg-Block. */}
        <div className="mt-3">
          <AiAssistBox
            text={bodyTextForAssist(draft)}
            runAssist={runAssist}
            applyFn={(mode, _original, suggestion) => applyBodyAssist(mode, draft, suggestion)}
            onApply={setDraft}
            hintKey="capture.ai.bodyHint"
            extraApplyActions={blockActions}
          />
        </div>
      </div>

      {/* Fußzeile: bewusste Übernahme in den Entwurf ODER Verwerfen — nichts wird automatisch gespeichert. */}
      <div className="flex items-center justify-end gap-2 border-t border-hairline bg-surface px-4 py-3 sm:px-6">
        <Button variant="ghost" onClick={onClose}>
          {t("studio.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          {t("studio.apply")}
        </Button>
      </div>
    </div>
  );
}

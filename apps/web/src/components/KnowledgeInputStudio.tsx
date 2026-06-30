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
  bodyAssistStructuredActions,
  bodyTextForAssist,
} from "../lib/bodyAiAssist";
import { BODY_READ_BLOCKS_KEY, BODY_READ_TITLE_KEY } from "../lib/bodyReadMode";
import { knowledgeStudioState } from "../lib/editorApplySafety";
import type { AttachmentLike } from "../lib/editorAttachmentContext";
import { STUDIO_GUIDE_STEPS, studioGuideActiveStep } from "../lib/knowledgeStudioGuide";
import { knowledgeStudioSectionLabelKey } from "../lib/knowledgeStudioLayout";
import {
  STUDIO_EDITOR_VIEWS,
  type StudioEditorView,
  studioEditorViewLabelKey,
  studioPreviewState,
} from "../lib/knowledgeStudioPreview";
import { AiAssistBox } from "./AiAssistBox";
import { BodyTemplateChooser } from "./BodyTemplateChooser";
import { EditorAttachmentContext } from "./EditorAttachmentContext";
import { EditorContentQuality } from "./EditorContentQuality";
import { EditorGuidance } from "./EditorGuidance";
import { KnowledgeStudioTips } from "./KnowledgeStudioTips";
import type { EditorImage } from "./RichTextEditor";
import { RichTextEditor } from "./RichTextEditor";
import { SanitizedHtml } from "./SanitizedHtml";
import { StudioContributionPanel } from "./StudioContributionPanel";
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
  // SCRUM-339: Inline-Bestätigung, bevor unübernommene Änderungen verworfen werden (kein confirm()).
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // SCRUM-346: Umschalter Bearbeiten ↔ Vorschau/Review der zentralen Editor-Spalte (lokaler Anzeige-State).
  const [view, setView] = useState<StudioEditorView>("edit");

  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur beim Öffnen synchronisieren.
  useEffect(() => {
    if (open) {
      setDraft(bodyHtml);
      setConfirmDiscard(false);
      setView("edit");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  // SCRUM-343: strukturierte KI-Übernahme-Modi (als Abschnitt + Info/Hinweis/Warnung/Erfolg-Block).
  const blockActions: BodyAssistBlockAction[] = bodyAssistStructuredActions(draft);
  // SCRUM-339: Dirty-Status — gibt es unübernommene Studio-Änderungen?
  const studioState = knowledgeStudioState(draft, bodyHtml);
  // Schließen/Verwerfen: bei unübernommenen Änderungen erst Inline-Bestätigung, sonst direkt schließen.
  const requestClose = (): void => {
    if (studioState.dirty) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  };
  const apply = (): void => {
    onApply(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-page/95 backdrop-blur-sm">
      {/* Kopfzeile: Titel + ehrlicher Hinweis (kein Auto-Save) + Schließen. */}
      <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-text">{t("studio.title")}</h2>
          <p className="truncate text-[11.5px] text-muted">{t("studio.subtitle")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* SCRUM-339: sichtbarer Dirty-Status — unübernommene Änderungen klar markiert. */}
          <span
            className={`rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${
              studioState.dirty ? "bg-trust-warn-bg text-trust-warn-text" : "bg-page text-muted-2"
            }`}
          >
            {t(studioState.statusKey)}
          </span>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-btn border border-hairline px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-text"
          >
            {t("studio.close")}
          </button>
        </div>
      </div>

      {/* SCRUM-353: ruhige, geführte Schrittfolge als Orientierung — was als Nächstes ein guter
          Schritt ist (Strukturieren → KI prüfen → Vorschau → bewusst übernehmen), danach speichern/
          validieren. Reine Anzeige, kein State-Zwang; in der Vorschau ist der Vorschau-Schritt aktiv. */}
      <div className="border-b border-hairline bg-surface px-4 py-2 sm:px-6">
        <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1">
          {STUDIO_GUIDE_STEPS.map((step, i) => {
            const active = studioGuideActiveStep(view) === step.id;
            return (
              <li key={step.id} className="flex items-center gap-2">
                {i > 0 ? (
                  <span aria-hidden="true" className="text-muted-2">
                    ·
                  </span>
                ) : null}
                <span
                  title={t(step.hintKey)}
                  className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold ${
                    active ? "bg-ink text-white" : "text-muted"
                  }`}
                >
                  {i + 1}. {t(step.labelKey)}
                </span>
              </li>
            );
          })}
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="text-muted-2">
              →
            </span>
            <span className="text-[11px] text-muted-2">{t("studio.guide.thenSave")}</span>
          </li>
        </ol>
      </div>

      {/* SCRUM-341: Arbeitsraum-Layout — drei klar getrennte Bereiche statt einer linearen Liste.
          Breit (lg): Kontext-Spalte · große Editorfläche · KI-Spalte. Schmal: sinnvoll gestapelt. */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)_19rem]">
          {/* Kontext & Struktur: Orientierung, Anhänge, Inhaltsqualität, Strukturvorlagen. */}
          <aside className="space-y-2">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
              {t(knowledgeStudioSectionLabelKey("context"))}
            </p>
            {/* SCRUM-353: Beitragswert/Qualität zuerst — was ist gut, was fehlt, warum wertvoll. */}
            <StudioContributionPanel bodyHtml={draft} attachments={attachments} />
            <EditorGuidance />
            <EditorAttachmentContext attachments={attachments} />
            <EditorContentQuality bodyHtml={draft} attachments={attachments} />
            <BodyTemplateChooser bodyHtml={draft} onApply={setDraft} />
          </aside>

          {/* Zentrale Editorfläche — sichtbar der Hauptarbeitsbereich (mehr vertikale Fläche). */}
          <section className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
                {t(knowledgeStudioSectionLabelKey("editor"))}
              </p>
              {/* SCRUM-346: klare Trennung Bearbeiten ↔ Vorschau/Review (kein Layout-Umbau). */}
              <div className="inline-flex rounded-btn border border-hairline bg-page p-0.5">
                {STUDIO_EDITOR_VIEWS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={`rounded-[6px] px-2.5 py-1 text-[11.5px] font-semibold ${
                      view === v ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
                    }`}
                  >
                    {t(studioEditorViewLabelKey(v))}
                  </button>
                ))}
              </div>
            </div>
            {/* SCRUM-345: kurze Bedien-/Formatierungs-Hilfe direkt über der Editorfläche.
                SCRUM-347: nur im Bearbeiten-View — in der Vorschau ist kein Editor sichtbar, dort
                wären Formatier-/Shortcut-Hinweise irreführend. */}
            {view === "edit" ? <KnowledgeStudioTips /> : null}
            {view === "edit" ? (
              <div className="min-h-[55vh] rounded-card border border-hairline bg-surface p-2 sm:p-3">
                <RichTextEditor value={draft} onChange={setDraft} images={images} />
              </div>
            ) : (
              // SCRUM-346: sichere Live-Vorschau — spiegelt die KO-Detail-Read-Mode-Darstellung
              // (SanitizedHtml + .prose-kw + Blöcke-Chip). Ehrlich: Entwurf, kein validiertes Wissen.
              <div className="min-h-[55vh] rounded-card border border-hairline bg-surface p-3">
                {(() => {
                  const previewState = studioPreviewState(draft);
                  return (
                    <>
                      <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-hairline pb-2">
                        <span className="text-[11.5px] font-semibold text-ink">
                          {t(BODY_READ_TITLE_KEY)}
                        </span>
                        {previewState.hasBlocks ? (
                          <span className="rounded-pill bg-page px-2 py-0.5 text-[10.5px] font-semibold text-muted">
                            {t(BODY_READ_BLOCKS_KEY)}
                          </span>
                        ) : null}
                      </div>
                      {previewState.emptyHintKey ? (
                        <p className="py-6 text-center text-[12.5px] text-muted">
                          {t(previewState.emptyHintKey)}
                        </p>
                      ) : (
                        <SanitizedHtml
                          html={draft}
                          className="prose-kw text-[14.5px] leading-relaxed text-text"
                        />
                      )}
                      <p className="mt-2 border-t border-hairline pt-2 text-[11px] leading-relaxed text-muted">
                        {t("studio.preview.note")}
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </section>

          {/* KI-Hilfe direkt sichtbar: Aktionen (Klarer/Strukturieren/Erweitern/Rechtschreibung) +
              freies Anweisungsfeld + Vorschau (Ersetzen/Anhängen/Verwerfen) + Block-Übernahme. */}
          <aside className="space-y-2">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
              {t(knowledgeStudioSectionLabelKey("assist"))}
            </p>
            <AiAssistBox
              text={bodyTextForAssist(draft)}
              runAssist={runAssist}
              applyFn={(mode, _original, suggestion) => applyBodyAssist(mode, draft, suggestion)}
              onApply={setDraft}
              hintKey="capture.ai.bodyHint"
              extraApplyActions={blockActions}
            />
          </aside>
        </div>
      </div>

      {/* Fußzeile: bewusste Übernahme in den Entwurf ODER Verwerfen — nichts wird automatisch gespeichert.
          SCRUM-339: unübernommene Änderungen werden nicht still verworfen — erst Inline-Bestätigung. */}
      <div className="border-t border-hairline bg-surface px-4 py-3 sm:px-6">
        {confirmDiscard ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <span className="text-[12.5px] font-semibold text-trust-warn-text sm:mr-auto">
              {t("studio.confirmDiscard.q")}
            </span>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              {t("studio.confirmDiscard.keep")}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t("studio.confirmDiscard.discard")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={requestClose}>
              {t("studio.cancel")}
            </Button>
            <Button variant="primary" onClick={apply}>
              {t("studio.apply")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

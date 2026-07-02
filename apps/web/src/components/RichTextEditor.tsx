import { Eye, Image as ImageIcon, Link as LinkIcon, Paperclip, Pencil } from "lucide-react";
import type { ClipboardEvent, DragEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type EditorFile, fileLinkHtml } from "../lib/bodyFileLink";
import {
  EDITOR_BLOCKS,
  type EditorBlock,
  editorBlockHtml,
  editorBlockLabelKey,
} from "../lib/editorBlocks";
import {
  EDITOR_DROP_KEYS,
  isInsertableImageMime,
  partitionDropMedia,
} from "../lib/editorDropPaste";
import { editorLinkHtml } from "../lib/editorLinks";
import { fileToThumbDataUrl } from "../lib/files";
import { insertImageHtml, insertImageSrcHtml, sanitizeHtml } from "../lib/richText";
import { SanitizedHtml } from "./SanitizedHtml";
import { Button } from "./ui";

export interface EditorImage {
  objectId?: string;
  src?: string;
  name: string;
}

// SCRUM-384 (Pedi-Sollbild ARGUS „Wissensseite bearbeiten"): farbige Callout-Knöpfe wie im
// Alt-Editor — statische, sichere Klassen je Blocktyp (kein dynamischer Klassenbau).
const BLOCK_BTN_CLASS: Record<EditorBlock, string> = {
  info: "border-ai/40 text-ai",
  note: "border-hairline text-text",
  warning: "border-trust-warn-fill/50 text-trust-warn-text",
  success: "border-trust-pos-fill/50 text-trust-pos-text",
};

// KW-STR / SCRUM-45/46/48: minimaler nativer WYSIWYG (contentEditable, keine Editor-Lib).
// Speichert sanitisiertes HTML; Vorschau↔Bearbeiten ohne State-Verlust.
// SCRUM-384: Toolbar folgt dem ARGUS-Muster (H2 H3 ¶ | B I | Listen/Link | Bild/Datei |
// Callouts | ✨KI) — die KI-Palette (aiPanel) öffnet sich erst auf Klick des ✨KI-Knopfs.
export function RichTextEditor({
  value,
  onChange,
  images = [],
  files = [],
  aiPanel,
}: {
  value: string;
  onChange: (html: string) => void;
  images?: EditorImage[];
  // SCRUM-355: im Body verlinkbare Nicht-Bild-Dateien (mit Object-Store-objectId).
  files?: EditorFile[];
  // SCRUM-384: KI-Palette (z. B. AiAssistBox) — erscheint erst nach Klick auf ✨KI.
  aiPanel?: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  // SCRUM-384: KI-Palette geschlossen bis zum bewussten Klick (ARGUS-Muster, keine Info-Wand).
  const [showAi, setShowAi] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkErr, setLinkErr] = useState<string | null>(null);

  // Editor-Inhalt nur setzen, wenn er abweicht und der Editor nicht fokussiert ist
  // (verhindert Cursor-Sprünge während des Tippens). Verlustfrei über Mode-Wechsel.
  useEffect(() => {
    const el = ref.current;
    if (mode === "edit" && el && el.innerHTML !== value && document.activeElement !== el) {
      el.innerHTML = value;
    }
  }, [value, mode]);

  const emit = (): void => onChange(sanitizeHtml(ref.current?.innerHTML ?? ""));

  const exec = (command: string, arg?: string): void => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const openLinkPanel = (): void => {
    setShowImages(false);
    setShowLink((s) => !s);
    setLinkErr(null);
    const selected = window.getSelection()?.toString().trim() ?? "";
    if (selected && !linkLabel) {
      setLinkLabel(selected);
    }
  };
  const addLink = (): void => {
    const html = editorLinkHtml({ url: linkUrl, label: linkLabel });
    if (!html) {
      setLinkErr(t("editor.linkInvalid"));
      return;
    }
    exec("insertHTML", html);
    setShowLink(false);
    setLinkUrl("");
    setLinkLabel("");
    setLinkErr(null);
  };
  // SCRUM-314: vier sichtbare Blocktypen statt eines generischen Panels (sichere, statische Klassen).
  const addBlock = (block: EditorBlock): void => exec("insertHTML", editorBlockHtml(block));
  const addImage = (img: EditorImage): void => {
    setShowImages(false);
    const html = img.objectId
      ? insertImageHtml(img.objectId, img.name)
      : img.src
        ? insertImageSrcHtml(img.src, img.name)
        : "";
    if (html) {
      exec("insertHTML", html);
    }
  };
  // SCRUM-355: Nicht-Bild-Datei als sicheren Body-Link (Object-Store-Raw-Pfad) einfügen.
  const addFile = (file: EditorFile): void => {
    setShowFiles(false);
    const html = fileLinkHtml({ objectId: file.objectId, name: file.name });
    if (html) {
      exec("insertHTML", html);
    }
  };

  // SCRUM-372 / AG-P2-1 / FR-STR-03: Drag&Drop + Einfügen (Paste). NUR Bilder werden inline eingebettet —
  // über denselben sicheren Pfad wie der Bild-Button (verkleinertes JPEG-data:image → insertImageSrcHtml
  // → Sanitizer). Nicht-Bild-Dateien werden NIE als Body-Link gefaked (kein Legacy-data:-URL); sie bleiben
  // Anhang/Evidence, der Nutzer bekommt einen ehrlichen Hinweis. SVG/andere „Bilder" gelten NICHT als
  // einbettbar (XSS-Schutz, deckt sich mit dem Sanitizer).
  const [dragActive, setDragActive] = useState(false);
  const [fileNotice, setFileNotice] = useState(false);

  const insertImageFile = async (file: File): Promise<void> => {
    try {
      // Verkleinertes, sicheres JPEG-data:image (kein Original-Riesen-Blob im KO-Body).
      const dataUrl = await fileToThumbDataUrl(file);
      exec("insertHTML", insertImageSrcHtml(dataUrl, file.name));
    } catch {
      // Einzelnes Bild nicht lesbar → still überspringen (kein Abbruch der übrigen).
    }
  };

  const handleMediaFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) {
      return;
    }
    // DOM-freie Entscheidung: welche Elemente sind sicher einbettbare Bilder, welche bleiben Evidence?
    const part = partitionDropMedia(files.map((f) => ({ mime: f.type, file: f })));
    for (const item of part.images) {
      await insertImageFile(item.file);
    }
    // Nicht-Bild-Dateien: kein Fake-Link — ehrlicher Hinweis (Anhang/Evidence, Validierung entscheidet).
    if (part.hasFiles) {
      setFileNotice(true);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) {
      return;
    }
    e.preventDefault();
    setDragActive(false);
    void handleMediaFiles(files);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>): void => {
    if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) {
      e.preventDefault();
      setDragActive(true);
    }
  };
  const onDragLeave = (): void => setDragActive(false);

  const onPaste = (e: ClipboardEvent<HTMLDivElement>): void => {
    // Nur eingefügte BILD-Dateien abfangen; normalen Text-/HTML-Paste normal durchlassen (emit sanitisiert).
    const fileItems = Array.from(e.clipboardData?.items ?? []).filter((it) => it.kind === "file");
    const imageFiles = fileItems
      .filter((it) => isInsertableImageMime(it.type))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (imageFiles.length === 0) {
      if (fileItems.length > 0) {
        setFileNotice(true);
      }
      return;
    }
    e.preventDefault();
    void handleMediaFiles(imageFiles);
  };

  // SCRUM-384: ARGUS-Toolbar — kleine Text-Pills wie im Alt-Editor („Wissensseite bearbeiten").
  const tb =
    "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-btn border border-hairline bg-surface px-2 text-[12px] font-semibold text-text hover:bg-hairline-soft";
  const sep = <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-hairline" />;

  return (
    <div className="relative rounded-card border border-hairline bg-surface">
      <div className="flex flex-wrap items-center gap-1 border-b border-hairline bg-page/60 p-1.5">
        <button
          type="button"
          title={t("editor.h2")}
          className={tb}
          onClick={() => exec("formatBlock", "h2")}
        >
          H2
        </button>
        <button
          type="button"
          title={t("editor.h3")}
          className={tb}
          onClick={() => exec("formatBlock", "h3")}
        >
          H3
        </button>
        <button
          type="button"
          title={t("editor.para")}
          className={tb}
          onClick={() => exec("formatBlock", "p")}
        >
          ¶
        </button>
        {sep}
        <button type="button" title={t("editor.bold")} className={tb} onClick={() => exec("bold")}>
          <strong>B</strong>
        </button>
        <button
          type="button"
          title={t("editor.italic")}
          className={tb}
          onClick={() => exec("italic")}
        >
          <em>I</em>
        </button>
        {sep}
        <button
          type="button"
          title={t("editor.ul")}
          className={tb}
          onClick={() => exec("insertUnorderedList")}
        >
          •
        </button>
        <button
          type="button"
          title={t("editor.ol")}
          className={tb}
          onClick={() => exec("insertOrderedList")}
        >
          1.
        </button>
        <button type="button" title={t("editor.link")} className={tb} onClick={openLinkPanel}>
          <LinkIcon size={14} />
        </button>
        {sep}
        <div className="relative">
          <button
            type="button"
            title={t("editor.image")}
            className={tb}
            onClick={() => setShowImages((s) => !s)}
          >
            <ImageIcon size={14} />
            {t("editor.imageLabel")}
          </button>
          {showImages ? (
            <div className="absolute z-10 mt-1 w-56 rounded-card border border-hairline bg-surface p-1.5 shadow">
              {images.length === 0 ? (
                <p className="px-2 py-1 text-[12px] text-muted">{t("editor.noImages")}</p>
              ) : (
                images.map((img) => (
                  <button
                    key={img.objectId ?? img.src ?? img.name}
                    type="button"
                    onClick={() => addImage(img)}
                    className="block w-full truncate rounded-btn px-2 py-1 text-left text-[12.5px] text-text hover:bg-hairline-soft"
                  >
                    {img.name}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        {/* SCRUM-355: Nicht-Bild-Datei als sichere Body-Referenz (Object-Store) einfügen. */}
        <div className="relative">
          <button
            type="button"
            title={t("editor.file")}
            className={tb}
            onClick={() => setShowFiles((s) => !s)}
          >
            <Paperclip size={14} />
            {t("editor.fileLabel")}
          </button>
          {showFiles ? (
            <div className="absolute z-10 mt-1 w-60 rounded-card border border-hairline bg-surface p-1.5 shadow">
              <p className="px-2 pb-1 pt-0.5 text-[11px] text-muted-2">{t("editor.insertFile")}</p>
              {files.length === 0 ? (
                <p className="px-2 py-1 text-[12px] text-muted">{t("editor.noFiles")}</p>
              ) : (
                files.map((file) => (
                  <button
                    key={file.objectId}
                    type="button"
                    onClick={() => addFile(file)}
                    className="block w-full truncate rounded-btn px-2 py-1 text-left text-[12.5px] text-text hover:bg-hairline-soft"
                  >
                    {file.name}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        {sep}
        {/* SCRUM-314/384: Callouts Info/Hinweis/Warnung/Erfolg — farbige Text-Pills (ARGUS). */}
        {EDITOR_BLOCKS.map((block) => (
          <button
            key={block}
            type="button"
            title={t(editorBlockLabelKey(block))}
            className={`inline-flex h-8 items-center rounded-btn border bg-surface px-2 text-[12px] font-semibold hover:bg-hairline-soft ${BLOCK_BTN_CLASS[block]}`}
            onClick={() => addBlock(block)}
          >
            {t(editorBlockLabelKey(block))}
          </button>
        ))}
        {/* SCRUM-384: ✨KI öffnet/schließt die KI-Palette — erst auf bewussten Klick (Pedi-Sollbild). */}
        {aiPanel ? (
          <>
            {sep}
            <button
              type="button"
              title={t("editor.aiToggle")}
              aria-expanded={showAi}
              className={`inline-flex h-8 items-center gap-1 rounded-btn border px-2.5 text-[12px] font-semibold ${
                showAi
                  ? "border-ai/50 bg-ai-surface-1 text-ai"
                  : "border-hairline bg-surface text-text hover:bg-hairline-soft"
              }`}
              onClick={() => setShowAi((s) => !s)}
            >
              ✨ {t("editor.aiLabel")}
            </button>
          </>
        ) : null}
        <div className="ml-auto">
          <button
            type="button"
            title={mode === "edit" ? t("editor.preview") : t("editor.edit")}
            className={tb}
            onClick={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
          >
            {mode === "edit" ? <Eye size={14} /> : <Pencil size={14} />}
            {mode === "edit" ? t("editor.preview") : t("editor.edit")}
          </button>
        </div>
      </div>

      {/* SCRUM-384: KI-Palette direkt unter der Toolbar — nur wenn ✨KI aktiv ist. */}
      {aiPanel && showAi ? (
        <div className="border-b border-hairline bg-page/60 px-2 pb-2">{aiPanel}</div>
      ) : null}

      {showLink ? (
        <div className="border-b border-hairline bg-page p-2">
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block text-[11.5px] font-semibold text-muted">
              {t("editor.linkUrl")}
              <input
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkErr(null);
                }}
                placeholder={t("editor.linkUrlPlaceholder")}
                className="mt-1 h-8 w-full rounded-input border border-hairline bg-surface px-2 text-[13px] font-normal text-text outline-none focus:border-ink/30"
              />
            </label>
            <label className="block text-[11.5px] font-semibold text-muted">
              {t("editor.linkLabel")}
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder={t("editor.linkLabelPlaceholder")}
                className="mt-1 h-8 w-full rounded-input border border-hairline bg-surface px-2 text-[13px] font-normal text-text outline-none focus:border-ink/30"
              />
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={addLink}>
                {t("editor.linkInsert")}
              </Button>
              <button
                type="button"
                onClick={() => setShowLink(false)}
                className="text-[12px] font-semibold text-muted hover:text-text"
              >
                {t("editor.linkCancel")}
              </button>
            </div>
          </div>
          {linkErr ? <p className="mt-1 text-[11.5px] text-trust-crit-text">{linkErr}</p> : null}
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="relative">
          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onInput={emit}
            onBlur={emit}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onPaste={onPaste}
            className="prose-kw min-h-[260px] p-4 text-[14.5px] leading-relaxed text-text outline-none md:p-6"
          />
          {/* SCRUM-372: sichtbares Ziel beim Drüberziehen — nur Bilder werden eingebettet. */}
          {dragActive ? (
            <div className="pointer-events-none absolute inset-1 grid place-items-center rounded-input border-2 border-dashed border-ai/50 bg-ai/5 text-[12.5px] font-semibold text-ai">
              {t(EDITOR_DROP_KEYS.imageActive)}
            </div>
          ) : null}
        </div>
      ) : (
        // FR-STR-05: Vorschau aus demselben State (sanitisiert), kein Datenverlust.
        <SanitizedHtml
          html={value}
          className="prose-kw min-h-[260px] p-4 text-[14.5px] leading-relaxed text-text md:p-6"
        />
      )}

      {/* SCRUM-372: ruhige Progressive-Disclosure-Führung — Bilder inline, Dateien bleiben Evidence.
          Der ehrliche Datei-Hinweis erscheint erst, wenn wirklich Nicht-Bild-Dateien gedroppt/eingefügt
          wurden (kein Fake-Link). Nur im Bearbeiten-Modus. */}
      {mode === "edit" ? (
        <div className="border-t border-hairline px-3 py-1.5">
          <p className="text-[11px] leading-relaxed text-muted-2">{t(EDITOR_DROP_KEYS.hint)}</p>
          {fileNotice ? (
            <div className="mt-1 flex items-start justify-between gap-2 rounded-btn bg-trust-warn-bg px-2 py-1.5">
              <p className="text-[11px] leading-relaxed text-trust-warn-text">
                {t(EDITOR_DROP_KEYS.fileNotice)}
              </p>
              <button
                type="button"
                onClick={() => setFileNotice(false)}
                className="shrink-0 text-[11px] font-semibold text-trust-warn-text/80 hover:text-trust-warn-text"
              >
                {t("editor.linkCancel")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

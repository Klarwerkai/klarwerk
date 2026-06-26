import {
  Bold,
  Eye,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pencil,
  SquareStack,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { insertImageHtml, sanitizeHtml } from "../lib/richText";
import { SanitizedHtml } from "./SanitizedHtml";

export interface EditorImage {
  objectId: string;
  name: string;
}

// KW-STR / SCRUM-45/46/48: minimaler nativer WYSIWYG (contentEditable, keine Editor-Lib).
// Speichert sanitisiertes HTML; Vorschau↔Bearbeiten ohne State-Verlust.
export function RichTextEditor({
  value,
  onChange,
  images = [],
}: {
  value: string;
  onChange: (html: string) => void;
  images?: EditorImage[];
}): JSX.Element {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showImages, setShowImages] = useState(false);

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

  const addLink = (): void => {
    const url = window.prompt(t("editor.linkPrompt"));
    if (url) {
      exec("createLink", url);
    }
  };
  const addPanel = (): void => exec("insertHTML", '<div class="panel"><p>…</p></div>');
  const addImage = (img: EditorImage): void => {
    setShowImages(false);
    exec("insertHTML", insertImageHtml(img.objectId, img.name));
  };

  const btn =
    "grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text";

  return (
    <div className="rounded-input border border-hairline">
      <div className="flex flex-wrap items-center gap-1 border-b border-hairline p-1.5">
        <button type="button" title={t("editor.bold")} className={btn} onClick={() => exec("bold")}>
          <Bold size={15} />
        </button>
        <button
          type="button"
          title={t("editor.italic")}
          className={btn}
          onClick={() => exec("italic")}
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          title={t("editor.h2")}
          className={btn}
          onClick={() => exec("formatBlock", "h2")}
        >
          <Heading2 size={15} />
        </button>
        <button
          type="button"
          title={t("editor.h3")}
          className={btn}
          onClick={() => exec("formatBlock", "h3")}
        >
          <Heading3 size={15} />
        </button>
        <button
          type="button"
          title={t("editor.ul")}
          className={btn}
          onClick={() => exec("insertUnorderedList")}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          title={t("editor.ol")}
          className={btn}
          onClick={() => exec("insertOrderedList")}
        >
          <ListOrdered size={15} />
        </button>
        <button type="button" title={t("editor.link")} className={btn} onClick={addLink}>
          <LinkIcon size={15} />
        </button>
        <button type="button" title={t("editor.panel")} className={btn} onClick={addPanel}>
          <SquareStack size={15} />
        </button>
        <div className="relative">
          <button
            type="button"
            title={t("editor.image")}
            className={btn}
            onClick={() => setShowImages((s) => !s)}
          >
            <ImageIcon size={15} />
          </button>
          {showImages ? (
            <div className="absolute z-10 mt-1 w-56 rounded-card border border-hairline bg-surface p-1.5 shadow">
              {images.length === 0 ? (
                <p className="px-2 py-1 text-[12px] text-muted">{t("editor.noImages")}</p>
              ) : (
                images.map((img) => (
                  <button
                    key={img.objectId}
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
        <div className="ml-auto">
          <button
            type="button"
            title={mode === "edit" ? t("editor.preview") : t("editor.edit")}
            className={btn}
            onClick={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
          >
            {mode === "edit" ? <Eye size={15} /> : <Pencil size={15} />}
          </button>
        </div>
      </div>

      {mode === "edit" ? (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          className="prose-kw min-h-[140px] p-3 text-[14px] leading-relaxed text-text outline-none"
        />
      ) : (
        // FR-STR-05: Vorschau aus demselben State (sanitisiert), kein Datenverlust.
        <SanitizedHtml
          html={value}
          className="prose-kw min-h-[140px] p-3 text-[14px] leading-relaxed text-text"
        />
      )}
    </div>
  );
}

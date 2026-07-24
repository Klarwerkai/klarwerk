import { Eye, Image as ImageIcon, Link as LinkIcon, Paperclip, Pencil } from "lucide-react";
import type {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  MouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DescribeImageResult } from "../api/types";
import { type EditorFile, fileLinkHtml } from "../lib/bodyFileLink";
import { bodyReadMode } from "../lib/bodyReadMode";
import {
  CAPTION_AI_TEXT,
  applyCaptionSuggestion,
  captionResponseApplicable,
  captionSuggestOutcome,
  captionSuggestVisible,
  checkCaptionImageDataUrl,
} from "../lib/captionAiSuggest";
import { collectImageContext } from "../lib/captionContext";
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
import {
  enhanceFiguresForEditing,
  normalizeEmptyCaption,
  shouldBlockCaptionDeletion,
} from "../lib/editorFigures";
import { editorFileButtonVisible } from "../lib/editorFiles";
import { editorLinkHtml } from "../lib/editorLinks";
import { fileToThumbDataUrl } from "../lib/files";
import {
  type ImageScaleValue,
  insertImageHtml,
  insertImageSrcHtml,
  normalizeImageScale,
  normalizePastedHtml,
  sanitizeHtml,
} from "../lib/richText";
import { AiUnavailableHint } from "./AiUnavailableHint";
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

const IMAGE_SCALE_OPTIONS: Array<{ value: ImageScaleValue; label: string }> = [
  { value: "25", label: "Klein" },
  { value: "50", label: "Mittel" },
  { value: "75", label: "Groß" },
  { value: "100", label: "Volle Breite" },
];

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
  onAttachFiles,
  placeholder,
  onDescribeImage,
  documentTitle,
  describeAvailable = true,
}: {
  value: string;
  onChange: (html: string) => void;
  images?: EditorImage[];
  // SCRUM-355: im Body verlinkbare Nicht-Bild-Dateien (mit Object-Store-objectId).
  files?: EditorFile[];
  // SCRUM-384: KI-Palette (z. B. AiAssistBox) — erscheint erst nach Klick auf ✨KI.
  aiPanel?: ReactNode;
  // SCRUM-474 P1: aktive Einladung im LEEREN Editor (Overlay, verschwindet beim ersten Zeichen).
  placeholder?: string;
  // Pedi 06.07.: neue Datei(en) vom Rechner als Anhang/Evidence hinzufügen (über das Eltern-Capture).
  // Anders als „Bild" wird NICHT in den Body eingefügt. Fehlt der Callback, bleibt der Knopf aus.
  // `| undefined` explizit: erlaubt das Durchreichen eines optionalen Callbacks (exactOptionalPropertyTypes).
  onAttachFiles?: ((files: File[]) => void | Promise<void>) | undefined;
  // WP-BILD-1c: KI-Bildbeschreibungs-Vorschlag für die fokussierte Bild-Fußnote. Der Eltern-Kontext
  // verdrahtet den describe-Aufruf (inkl. Provenienz/Vertraulichkeit); ohne Callback bleibt der
  // Knopf aus (kein toter Klick). Erscheint NIE in der Vorschau/Leseansicht.
  // WP-BILD-1f (Pedi 22.07.): der Editor reicht als zweites Argument den umgebenden Klartext-Kontext
  // (Titel + Überschrift + Absätze) mit — er reist im selben describe-Request und damit über
  // DIESELBE Vertraulichkeits-/Egress-Stelle wie das Bild.
  onDescribeImage?:
    | ((dataUrl: string, context?: string) => Promise<DescribeImageResult>)
    | undefined;
  // WP-BILD-1f: Dokument-Titel für den Kontext (Formularfeld, kein HTML). Optional.
  documentTitle?: string | undefined;
  // PAKET 1 (D-AISTATE, Pedi 23.07.): ist der KI-Bildbeschreibungs-Vorschlag (Task „describe") nutzbar?
  // Als PROP (nicht Hook), damit der Editor ohne QueryClient-Provider isoliert testbar bleibt; das
  // Eltern-Capture reicht die echte Verfügbarkeit ein. Default true = bedienbar (kein Test-Bruch).
  describeAvailable?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  // SCRUM-456 (Pedi/VIP 06.07.): verstecktes Datei-Feld, damit der „Bild"-Knopf auch ein NEUES
  // Bild vom Rechner einfügen kann (nicht nur vorhandene Anhänge).
  const imgInputRef = useRef<HTMLInputElement>(null);
  // Pedi 06.07.: verstecktes Feld für „Datei vom Rechner anhängen …" (Anhang/Evidence, kein Body-Einfügen).
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  // SCRUM-384: KI-Palette geschlossen bis zum bewussten Klick (ARGUS-Muster, keine Info-Wand).
  const [showAi, setShowAi] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [selectedImageScale, setSelectedImageScale] = useState<ImageScaleValue>("100");
  // WP-BILD-1c: die aktuell fokussierte/angeklickte Bild-Fußnote (Editier-Modus) + der Zustand des
  // KI-Vorschlags-Panels. Der Vorschlag wird NIE automatisch übernommen — nur über den Knopf.
  const [selectedCaption, setSelectedCaption] = useState<HTMLElement | null>(null);
  // WP-BILD-1f (bens P1): Bindung Request↔Fußnote. Die Generation zählt bei JEDEM Fußnoten-Wechsel
  // hoch; ein laufender Request merkt sich (Generation + data-image-id + Element) seiner
  // Ausgangs-Fußnote und wendet seine Antwort NUR an, wenn all das noch aktuell ist.
  const captionGenerationRef = useRef(0);
  const selectedCaptionRef = useRef<HTMLElement | null>(null);
  const [captionAi, setCaptionAi] = useState<
    | null
    | { status: "loading" }
    | { status: "fallback"; messageKey: string }
    // WP-BILD-1f: withContext = der Vorschlag wurde mit umgebendem Dokument-Kontext erzeugt.
    | { status: "suggestion"; text: string; withContext: boolean }
  >(null);

  // Editor-Inhalt nur setzen, wenn er abweicht und der Fokus nicht IM Editor liegt
  // (verhindert Cursor-Sprünge während des Tippens). Verlustfrei über Mode-Wechsel.
  // SCRUM-524 P.1 (WP5): DEFENSIVE Grenze am DOM. Server sanitisiert bodyHtml bereits an der Persistenz-
  // Grenze; hier wird `value` VOR dem innerHTML-Setzen zusätzlich durch denselben Allowlist-Sanitizer
  // geführt — kein innerHTML mit ungeprüftem Inhalt, egal woher `value` stammt (belt & suspenders).
  // WP-D8 (Pedis Live-ROT A): der Guard MUSS `contains` prüfen, nicht Identität. Die Bild-Fußnote
  // (figcaption[contenteditable=true]) ist ein EIGENER Editing-Host — beim Klick hinein wird SIE zum
  // document.activeElement, nicht der Editor-Container. Mit dem alten `!== el`-Guard galt der Editor
  // dann als unfokussiert, und da el.innerHTML (mit contenteditable-Attributen der Verankerung) nie dem
  // sanitisierten `safe` gleicht, wurde bei JEDEM Tastendruck in der Fußnote das innerHTML neu gesetzt —
  // Caret/Fokus zerstört, die Fußnote wirkte „nicht editierbar" (genau Pedis Befund).
  // WP-UX-WOW-1 U8: Werte, die aus DIESEM Editor-DOM emittiert wurden, werden NIE zurückgeschrieben.
  // Vorher konnte jeder Blur (z. B. der Klick auf „Vorschlag verwerfen" im fokussierten Zustand) ein
  // Ping-Pong anstoßen: emit → neuer value (sanitize kanonisiert anders als die DOM-Serialisierung) →
  // Effekt setzt das KOMPLETTE innerHTML neu (bei großen Dokumenten mit eingebetteten Bildern ein
  // teurer synchroner Voll-Neuaufbau samt Figure-Verankerung) → nächster Blur wieder von vorn. Mit dem
  // lastEmitted-Guard bleibt der DOM die Quelle seiner eigenen Emissionen; geschrieben wird nur bei
  // ECHTEN Fremd-Änderungen (Vorschlag übernehmen, Entwurf laden, Reset).
  const lastEmittedRef = useRef<string | null>(null);
  // Beim Wechsel zurück in den Bearbeiten-Modus ist der contentEditable-Knoten FRISCH gemountet
  // (leer) — der Emissions-Guard darf dann nicht greifen, sonst bliebe der Editor leer.
  useEffect(() => {
    if (mode === "edit") {
      lastEmittedRef.current = null;
    }
  }, [mode]);
  useEffect(() => {
    const el = ref.current;
    if (mode !== "edit" || !el) {
      return;
    }
    // WP-POLISH-CLOSE (bens Punkt 2): der Emissionsmarker ist eine EINMALIGE Bestätigung. Kam der
    // emittierte Wert als value-Prop zurück, wird er hier VERBRAUCHT (kein Rückschreiben, Marker
    // weg); jeder EXTERNE Set löscht ihn ebenfalls. Ohne das Löschen würde eine echte
    // A→B→A-Rückkehr (extern B gesetzt, dann extern zurück auf das früher emittierte A) am alten
    // Marker hängen bleiben und der Editor zeigte weiter B — genau bens Kante.
    if (value === lastEmittedRef.current) {
      lastEmittedRef.current = null;
      return;
    }
    lastEmittedRef.current = null;
    const safe = sanitizeHtml(value);
    if (el.innerHTML !== safe && !el.contains(document.activeElement)) {
      el.innerHTML = safe;
      // WP-D7 (Befund 2): Bild-Fußnoten nach jedem innerHTML-Setzen editierbar verankern.
      // WP-D10: lokalisierter, rein visueller Einlade-Text für LEERE Fußnoten (data-kw-placeholder +
      // CSS :empty::before) — wird vom Sanitizer beim Speichern gestrippt, nie echter Inhalt.
      enhanceFiguresForEditing(el, t("editor.captionPlaceholder"));
    }
  }, [value, mode, t]);

  const emit = (): void => {
    const next = sanitizeHtml(ref.current?.innerHTML ?? "");
    lastEmittedRef.current = next;
    // U8: ein No-op-Blur (nichts geändert) löst keinen Parent-Renderzyklus mehr aus.
    if (next !== value) {
      onChange(next);
    }
  };

  // WP-RETEST7 R2: die figcaption unter dem Caret finden (oder null) — für den Leeren-/Lösch-Guard.
  const captionAtSelection = (): HTMLElement | null => {
    const node = window.getSelection()?.anchorNode ?? null;
    const element = node instanceof Element ? node : (node?.parentElement ?? null);
    const cap = element?.closest("figcaption");
    return cap instanceof HTMLElement && ref.current?.contains(cap) ? cap : null;
  };

  // WP-RETEST7 R2 (Pedis Befund): Löscht der Nutzer den gesamten Fußnotentext, lässt der Browser
  // oft ein <br> zurück — die figcaption ist nicht :empty, der Platzhalter erscheint nicht. Nach
  // JEDEM input wird eine leer gewordene Fußnote WIRKLICH geleert und das Caret darin gehalten.
  const onEditorInput = (): void => {
    const cap = captionAtSelection();
    if (cap && normalizeEmptyCaption(cap)) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(cap);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    emit();
  };

  // WP-RETEST7 R2: Backspace/Delete in einer LEEREN figcaption (bzw. Backspace am Fußnoten-ANFANG)
  // darf die figcaption nicht löschen oder mit dem Nachbarn mergen — Element und Fokus bleiben.
  const onEditorKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "Backspace" && e.key !== "Delete") {
      return;
    }
    const cap = captionAtSelection();
    if (!cap) {
      return;
    }
    const selection = window.getSelection();
    const collapsed = selection?.isCollapsed ?? false;
    let atStart = false;
    if (selection && selection.rangeCount > 0) {
      const probe = selection.getRangeAt(0).cloneRange();
      probe.setStart(cap, 0);
      atStart = probe.toString().length === 0;
    }
    if (shouldBlockCaptionDeletion(cap, e.key, atStart, collapsed)) {
      e.preventDefault();
    }
  };

  const selectImage = (img: HTMLImageElement | null): void => {
    if (!img || !ref.current?.contains(img)) {
      setSelectedImage(null);
      setSelectedImageScale("100");
      return;
    }
    setSelectedImage(img);
    setSelectedImageScale(normalizeImageScale(img.getAttribute("data-kw-scale")) ?? "100");
  };

  const updateImageSelectionFromNode = (node: Node | null): void => {
    if (!node || !ref.current?.contains(node)) {
      selectImage(null);
      return;
    }
    const element = node instanceof Element ? node : node.parentElement;
    const img = element?.closest("img");
    selectImage(img instanceof HTMLImageElement ? img : null);
  };

  // WP-BILD-1c: Fußnoten-Fokus verfolgen — steht der Cursor/Klick in einer figcaption des Editors,
  // erscheint der Vorschlags-Knopf. Wechselt die Fußnote (oder verlässt der Cursor sie), wird ein
  // offenes Vorschlags-Panel geschlossen (der Vorschlag gehört zu SEINEM Bild).
  const updateCaptionSelectionFromNode = (node: Node | null): void => {
    const element = node instanceof Element ? node : (node?.parentElement ?? null);
    const cap = element?.closest("figcaption");
    const next =
      cap instanceof HTMLElement && ref.current?.contains(cap) && node && ref.current.contains(node)
        ? cap
        : null;
    // WP-BILD-1f (bens P1): jeder Fußnoten-Wechsel invalidiert laufende Requests (Generation++).
    if (next !== selectedCaptionRef.current) {
      captionGenerationRef.current += 1;
      selectedCaptionRef.current = next;
      setCaptionAi(null);
    }
    setSelectedCaption(next);
  };

  const updateImageSelectionFromCursor = (): void => {
    const node = window.getSelection()?.anchorNode ?? null;
    updateImageSelectionFromNode(node);
    updateCaptionSelectionFromNode(node);
  };

  const onEditorClick = (e: MouseEvent<HTMLDivElement>): void => {
    const node = e.target instanceof Node ? e.target : null;
    updateImageSelectionFromNode(node);
    updateCaptionSelectionFromNode(node);
  };

  // WP-BILD-1c: Bildquelle der Fußnote → data:image-URL. Eingebettete data:-Bilder direkt;
  // Objekt-Store-Bilder (/api/objects/…/raw) über die Cookie-Session laden und als data:-URL lesen.
  const imageSrcAsDataUrl = async (src: string): Promise<string> => {
    if (src.startsWith("data:")) {
      return src;
    }
    const res = await fetch(src, { credentials: "include" });
    if (!res.ok) {
      throw new Error(`Bild nicht ladbar (${res.status})`);
    }
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Bild nicht lesbar"));
      reader.readAsDataURL(blob);
    });
  };

  const requestCaptionSuggestion = async (): Promise<void> => {
    const caption = selectedCaption;
    if (!caption || !onDescribeImage) {
      return;
    }
    // WP-BILD-1f (bens P1): der Request trägt die Bindung an SEINE Ausgangs-Fußnote (data-image-id
    // + Generation). Nach jedem await wird geprüft, ob das Ziel unverändert ist — sonst wird die
    // Antwort STILL verworfen (A→B-Wechsel: As späte Antwort berührt B nie).
    const binding = {
      imageId: caption.getAttribute("data-image-id"),
      generation: captionGenerationRef.current,
    };
    const stillCurrent = (): boolean =>
      selectedCaptionRef.current === caption &&
      captionResponseApplicable(binding, {
        imageId: selectedCaptionRef.current.getAttribute("data-image-id"),
        generation: captionGenerationRef.current,
      });
    const src = caption.parentElement?.querySelector("img")?.getAttribute("src") ?? "";
    if (!src) {
      setCaptionAi({ status: "fallback", messageKey: CAPTION_AI_TEXT.imageUnreadable });
      return;
    }
    setCaptionAi({ status: "loading" });
    let dataUrl: string;
    try {
      dataUrl = await imageSrcAsDataUrl(src);
    } catch {
      if (stillCurrent()) {
        setCaptionAi({ status: "fallback", messageKey: CAPTION_AI_TEXT.imageUnreadable });
      }
      return;
    }
    const checked = checkCaptionImageDataUrl(dataUrl);
    if (!checked.ok) {
      if (stillCurrent()) {
        setCaptionAi({ status: "fallback", messageKey: checked.messageKey });
      }
      return;
    }
    // WP-BILD-1f: umgebenden Dokument-Kontext AM AKTUELLEN DOM sammeln (Titel + nächste Überschrift +
    // Absätze), budgetgekürzt. Reist im selben describe-Request wie das Bild → dieselbe Egress-Stelle.
    const editorRoot = ref.current;
    const figure = caption.parentElement;
    const context =
      editorRoot && figure ? collectImageContext(editorRoot, figure, documentTitle) : "";
    try {
      const result = await onDescribeImage(checked.dataUrl, context || undefined);
      if (!stillCurrent()) {
        return; // Ziel gewechselt → Antwort still verwerfen (kein Panel, keine Inhalts-Änderung).
      }
      const outcome = captionSuggestOutcome(result);
      setCaptionAi(
        outcome.kind === "suggestion"
          ? { status: "suggestion", text: outcome.text, withContext: result.withContext === true }
          : { status: "fallback", messageKey: outcome.messageKey },
      );
    } catch {
      // Netz-/Serverfehler (inkl. 413-Größendeckel) → ehrliche Fehlermeldung, kein Pseudo-Text.
      if (stillCurrent()) {
        setCaptionAi({ status: "fallback", messageKey: CAPTION_AI_TEXT.fallbackError });
      }
    }
  };

  // Übernahme über die NORMALE Editier-Mechanik der Fußnote (textContent + emit) — Sanitizer-
  // Verträge bleiben unangetastet, gespeichert wird wie bei jeder Handeingabe.
  const applyCaptionAi = (): void => {
    if (selectedCaption && captionAi?.status === "suggestion") {
      applyCaptionSuggestion(selectedCaption, captionAi.text);
      emit();
    }
    setCaptionAi(null);
  };

  const applyImageScale = (scale: ImageScaleValue): void => {
    if (!selectedImage || !ref.current?.contains(selectedImage)) {
      selectImage(null);
      return;
    }
    selectedImage.setAttribute("data-kw-scale", scale);
    setSelectedImageScale(scale);
    emit();
  };

  const exec = (command: string, arg?: string): void => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    // WP-D7b (Gelb-Fix 2): auch nach execCommand-Einfügungen (z. B. insertHTML) Bild-Fußnoten editierbar
    // verankern — der Editor ist hier fokussiert, die useEffect-Verankerung greift dann bewusst nicht.
    if (ref.current) {
      enhanceFiguresForEditing(ref.current, t("editor.captionPlaceholder"));
    }
    emit();
  };

  // SCRUM-456-Fix (VIP 06.07.): zuverlässiges Einfügen von HTML (Bild) — unabhängig von
  // document.execCommand. Nach dem nativen Datei-Dialog („Bild vom Rechner …") hat der Editor
  // keinen gültigen Cursor mehr; execCommand griff dann ins Leere → das Bild erschien nicht und
  // landete auch nicht im Entwurf. Wir fügen daher direkt per Range ein: am Cursor, wenn er im
  // Editor liegt, sonst am Ende des Inhalts. emit() sanitisiert wie gehabt beim Rausschreiben.
  const insertHtmlReliable = (html: string): void => {
    const el = ref.current;
    if (!el || !html) {
      return;
    }
    el.focus();
    const sel = window.getSelection();
    const caret =
      sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)
        ? sel.getRangeAt(0)
        : null;
    if (caret) {
      // Cursor liegt im Editor → genau dort einfügen (Drop/Einfügen mit gültiger Auswahl).
      caret.deleteContents();
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      const lastNode = tpl.content.lastChild;
      caret.insertNode(tpl.content);
      if (lastNode && sel) {
        const after = document.createRange();
        after.setStartAfter(lastNode);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
      }
    } else {
      // Kein Cursor im Editor (typisch NACH dem nativen Datei-Dialog „Bild vom Rechner"): bombensicher
      // ans Ende anhängen — unabhängig von Fokus/Auswahl. Genau hier hakte es vorher.
      el.insertAdjacentHTML("beforeend", html);
    }
    // WP-D7b (Gelb-Fix 2): frisch eingefügte Bild-Fußnoten sofort editierbar verankern (Editor fokussiert).
    enhanceFiguresForEditing(el, t("editor.captionPlaceholder"));
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
      // SCRUM-456-Fix: zuverlässig per Range einfügen (nicht execCommand) — funktioniert auch,
      // wenn der Editor nach dem Datei-Dialog gerade keinen Cursor hat.
      insertHtmlReliable(insertImageSrcHtml(dataUrl, file.name));
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

  // SCRUM-456: „Bild vom Rechner …" — Auswahl aus dem Finder läuft über denselben sicheren Pfad
  // wie Drop/Einfügen (partitionDropMedia → insertImageFile). SVG/Nicht-Raster bleiben Evidence.
  const onPickImages = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? []);
    // Feld zurücksetzen, damit dasselbe Bild direkt erneut gewählt werden kann.
    e.target.value = "";
    setShowImages(false);
    await handleMediaFiles(files);
  };

  // Pedi 06.07.: „Datei vom Rechner anhängen …" — neue Datei(en) als Anhang/Evidence an den Entwurf
  // hängen (über den Eltern-Callback). KEIN Body-Einfügen, kein Behelfs-Link.
  const onPickAttachFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    setShowFiles(false);
    if (picked.length > 0) {
      void onAttachFiles?.(picked);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    // SCRUM-466 Teil A: Browser-Default IMMER unterbinden, bevor irgendein
    // Early-Return greift. Ein Bild aus einem anderen Tab kommt als URL
    // (text/uri-list), nicht als File - ohne preventDefault navigiert der
    // Browser weg und der getippte Text geht verloren (P0-Datenverlust).
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) {
      return;
    }
    void handleMediaFiles(files);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>): void => {
    // SCRUM-466 Teil A: Default immer unterbinden, damit der Editor ein
    // gueltiges Drop-Ziel bleibt - nicht nur bei "Files" (Tab-Bilder haben
    // text/uri-list statt Files).
    e.preventDefault();
    e.stopPropagation();
    if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) {
      setDragActive(true);
    }
  };
  const onDragLeave = (): void => setDragActive(false);

  const onPaste = (e: ClipboardEvent<HTMLDivElement>): void => {
    // Bild-Paste bleibt vorrangig auf dem bestehenden sicheren Pfad.
    const fileItems = Array.from(e.clipboardData?.items ?? []).filter((it) => it.kind === "file");
    const imageFiles = fileItems
      .filter((it) => isInsertableImageMime(it.type))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (imageFiles.length > 0) {
      e.preventDefault();
      void handleMediaFiles(imageFiles);
      return;
    }
    if (fileItems.length > 0) {
      setFileNotice(true);
    }

    const html = e.clipboardData?.getData("text/html")?.trim() ?? "";
    if (!html) {
      return;
    }
    e.preventDefault();
    insertHtmlReliable(normalizePastedHtml(html));
  };

  // SCRUM-384: ARGUS-Toolbar — kleine Text-Pills wie im Alt-Editor („Wissensseite bearbeiten").
  const tb =
    "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-btn border border-hairline bg-surface px-2 text-[12px] font-semibold text-text hover:bg-hairline-soft";
  const sep = <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-hairline" />;

  return (
    <div className="relative rounded-card border border-hairline bg-surface">
      {/* SCRUM-456: verstecktes Datei-Feld für „Bild vom Rechner …" (nur Rasterbilder werden
          eingebettet; SVG/anderes bleibt Evidence — dieselbe Sicherheitslogik wie Drop/Einfügen). */}
      <input
        ref={imgInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => void onPickImages(e)}
      />
      {/* Pedi 06.07.: verstecktes Feld für „Datei vom Rechner anhängen …" — hängt neue Dateien als
          Anhang/Evidence an (über den Eltern-Callback), fügt NICHT in den Body ein. */}
      <input
        ref={attachFileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onPickAttachFiles}
      />
      <div className="flex flex-wrap items-center gap-1 border-b border-hairline bg-page/60 p-1.5">
        {/* SCRUM-404 (Pedi 03.07.): In der Vorschau sind Formatier-Knöpfe wirkungslos — sie
            verschwinden dort und ein deutliches Vorschau-Signal macht den Moduswechsel sichtbar
            (vorher sah Vorschau ≈ Bearbeiten aus → „der Knopf tut nichts"). */}
        {mode === "edit" ? (
          <>
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
            <button
              type="button"
              title={t("editor.bold")}
              className={tb}
              onClick={() => exec("bold")}
            >
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
                  {/* SCRUM-456: immer verfügbar — neues Bild vom Rechner einfügen (Finder). */}
                  <button
                    type="button"
                    onClick={() => imgInputRef.current?.click()}
                    className="mb-1 flex w-full items-center gap-1.5 rounded-btn px-2 py-1 text-left text-[12.5px] font-semibold text-ai hover:bg-hairline-soft"
                  >
                    <ImageIcon size={13} />
                    {t("editor.imageFromDisk")}
                  </button>
                  {images.length === 0 ? (
                    <p className="border-hairline border-t px-2 pb-1 pt-1.5 text-[11.5px] text-muted-2">
                      {t("editor.noImages")}
                    </p>
                  ) : (
                    <div className="border-hairline border-t pt-1">
                      <p className="px-2 pb-0.5 text-[10.5px] text-muted-2">
                        {t("editor.imageFromAttachment")}
                      </p>
                      {images.map((img) => (
                        <button
                          key={img.objectId ?? img.src ?? img.name}
                          type="button"
                          onClick={() => addImage(img)}
                          className="block w-full truncate rounded-btn px-2 py-1 text-left text-[12.5px] text-text hover:bg-hairline-soft"
                        >
                          {img.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {/* SCRUM-355 / SCRUM-488: „Datei"-Button nur zeigen, wenn er etwas kann — Datei-Upload
                (onAttachFiles) ODER einfügbare Object-Store-Dateien. Ohne beides wäre es ein toter
                Klick (Nullschulungs-Killer): kein Upload möglich, nichts zum Einfügen. */}
            {editorFileButtonVisible(onAttachFiles !== undefined, files.length) ? (
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
                    {/* Pedi 06.07.: neue Datei vom Rechner anhängen — direkt hier, wo der Nutzer sucht. */}
                    {onAttachFiles ? (
                      <button
                        type="button"
                        onClick={() => attachFileInputRef.current?.click()}
                        className="mb-1 flex w-full items-center gap-1.5 rounded-btn px-2 py-1 text-left text-[12.5px] font-semibold text-ai hover:bg-hairline-soft"
                      >
                        <Paperclip size={13} />
                        {t("editor.fileFromDisk")}
                      </button>
                    ) : null}
                    <p className="border-hairline px-2 pb-1 pt-0.5 text-[11px] text-muted-2">
                      {t("editor.insertFile")}
                    </p>
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
            ) : null}
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
          </>
        ) : (
          <span className="rounded-pill border border-ai/30 bg-ai-surface-1 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ai">
            {t("editor.previewBadge")}
          </span>
        )}
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

      {mode === "edit" && selectedImage ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-hairline bg-ai-surface-1 px-2 py-1.5">
          <span className="mr-1 text-[11.5px] font-semibold text-muted">Bildgröße</span>
          {IMAGE_SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selectedImageScale === opt.value}
              onClick={() => applyImageScale(opt.value)}
              className={`inline-flex h-7 items-center rounded-btn border px-2 text-[11.5px] font-semibold ${
                selectedImageScale === opt.value
                  ? "border-ai/50 bg-ai text-white"
                  : "border-hairline bg-surface text-text hover:bg-hairline-soft"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* WP-BILD-1c: KI-Beschreibung als VORSCHLAG an der fokussierten Fußnote — nur im
          Editier-Modus, nur mit verdrahtetem describe-Aufruf. Kein Auto-Übernehmen. */}
      {captionSuggestVisible(mode, selectedCaption !== null, onDescribeImage !== undefined) ? (
        <div className="border-b border-hairline bg-ai-surface-1 px-2 py-1.5">
          <button
            type="button"
            // PAKET 1 (D-AISTATE): hart ausgrauen, wenn kein Modell für „describe" nutzbar ist.
            disabled={captionAi?.status === "loading" || !describeAvailable}
            title={!describeAvailable ? t("ai.unavailable.hint") : undefined}
            onClick={() => void requestCaptionSuggestion()}
            className="inline-flex h-7 items-center gap-1 rounded-btn border border-ai/40 bg-surface px-2 text-[11.5px] font-semibold text-ai hover:bg-hairline-soft disabled:opacity-60"
          >
            ✨{" "}
            {captionAi?.status === "loading"
              ? t(CAPTION_AI_TEXT.loading)
              : t(CAPTION_AI_TEXT.suggest)}
          </button>
          {!describeAvailable ? <AiUnavailableHint show={true} /> : null}
          {captionAi?.status === "suggestion" ? (
            <div className="mt-1.5 rounded-btn border border-ai/30 bg-surface p-2">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-ai">
                {t(CAPTION_AI_TEXT.panelTitle)} · {t(CAPTION_AI_TEXT.aiBadge)}
              </p>
              {/* WP-BILD-1f: ehrliche Kennzeichnung, wenn der Vorschlag mit Dokument-Kontext entstand. */}
              {captionAi.withContext ? (
                <p className="mt-0.5 text-[10.5px] leading-snug text-muted">
                  {t(CAPTION_AI_TEXT.withContext)}
                </p>
              ) : null}
              <p className="mt-1 text-[12.5px] leading-relaxed text-text">{captionAi.text}</p>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={applyCaptionAi}
                  className="inline-flex h-7 items-center rounded-btn border border-ai/50 bg-ai px-2 text-[11.5px] font-semibold text-white"
                >
                  {t(CAPTION_AI_TEXT.apply)}
                </button>
                <button
                  type="button"
                  onClick={() => setCaptionAi(null)}
                  className="inline-flex h-7 items-center rounded-btn border border-hairline bg-surface px-2 text-[11.5px] font-semibold text-muted hover:text-text"
                >
                  {t(CAPTION_AI_TEXT.discard)}
                </button>
              </div>
            </div>
          ) : null}
          {captionAi?.status === "fallback" ? (
            <p className="mt-1.5 rounded-btn bg-trust-warn-bg px-2 py-1.5 text-[11.5px] leading-relaxed text-trust-warn-text">
              {t(captionAi.messageKey)}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="relative">
          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onInput={onEditorInput}
            onBlur={emit}
            onClick={onEditorClick}
            onKeyDown={onEditorKeyDown}
            onKeyUp={updateImageSelectionFromCursor}
            onMouseUp={updateImageSelectionFromCursor}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onPaste={onPaste}
            className="prose-kw min-h-[260px] p-4 text-[14.5px] leading-relaxed text-text outline-none md:p-6"
          />
          {/* SCRUM-474 P1: Placeholder als aktive Einladung im leeren Editor — pointer-events-none, damit
              der Klick den Editor fokussiert; verschwindet, sobald Inhalt vorhanden ist. */}
          {placeholder && !bodyReadMode(value).hasBody ? (
            <div className="pointer-events-none absolute inset-0 p-4 text-[14.5px] leading-relaxed text-muted-2 md:p-6">
              {placeholder}
            </div>
          ) : null}
          {/* SCRUM-372: sichtbares Ziel beim Drüberziehen — nur Bilder werden eingebettet. */}
          {dragActive ? (
            <div className="pointer-events-none absolute inset-1 grid place-items-center rounded-input border-2 border-dashed border-ai/50 bg-ai/5 text-[12.5px] font-semibold text-ai">
              {t(EDITOR_DROP_KEYS.imageActive)}
            </div>
          ) : null}
        </div>
      ) : // FR-STR-05: Vorschau aus demselben State (sanitisiert), kein Datenverlust.
      // SCRUM-404: leerer Inhalt → ehrlicher Hinweis statt stiller weißer Fläche.
      bodyReadMode(value).hasBody ? (
        <SanitizedHtml
          html={value}
          className="prose-kw min-h-[260px] p-4 text-[14.5px] leading-relaxed text-text md:p-6"
        />
      ) : (
        <p className="grid min-h-[260px] place-items-center p-4 text-[12.5px] text-muted md:p-6">
          {t("editor.previewEmpty")}
        </p>
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

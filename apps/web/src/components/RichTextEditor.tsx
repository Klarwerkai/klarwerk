import { Eye, Image as ImageIcon, Link as LinkIcon, Paperclip, Pencil } from "lucide-react";
import type {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  MouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageDescribe } from "../app/ImageDescribeContext";
import { type EditorFile, fileLinkHtml } from "../lib/bodyFileLink";
import { bodyReadMode } from "../lib/bodyReadMode";
import {
  CAPTION_AI_TEXT,
  type CaptionFormCurrent,
  MAX_CAPTION_TEXT_CHARS,
  applyCaptionHtml,
  applyCaptionSuggestionToHtml,
  captionFormResponseApplicable,
  captionFormTargetIntact,
  captionSuggestOutcome,
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
// AUFTRAG-mega89 Block B: die Paarung Bild↔Fußnote kommt aus EINER Stelle. Sie liegt in
// `editorFigures.ts` neben der Invariante, die die Struktur herstellt — und ist dort DOM-lib-frei
// und ohne Editor prüfbar, auch an Markup, das nie durch die Verankerung gelaufen ist.
import { captionForImage, enhanceFiguresForEditing, imageForCaption } from "../lib/editorFigures";
import { editorFileButtonVisible } from "../lib/editorFiles";
import { editorLinkHtml } from "../lib/editorLinks";
import { fileToThumbDataUrl } from "../lib/files";
import {
  type ImageScaleValue,
  capCaptionHtml,
  captionPlainText,
  insertImageHtml,
  insertImageSrcHtml,
  normalizeImageScale,
  normalizePastedHtml,
  sanitizeCaptionHtml,
  sanitizeHtml,
} from "../lib/richText";
import { AiCostHint } from "./AiCostHint";
import { AiGeneratedNotice } from "./AiGeneratedNotice";
import { AiUnavailableHint } from "./AiUnavailableHint";
// D44 Teil 2, Weg (a): nur der Ereignisname und seine Nutzlast — keine Komponente, kein Zyklus
// (`BodyImageGallery` importiert nichts aus dieser Datei, gemessen).
import { type D44BildEreignis, D44_BILD_EREIGNIS } from "./BodyImageGallery";
// AUFTRAG-mega9 Block F: dieselbe Dialog-Vorrichtung wie überall sonst (Fokusfalle, Escape,
// Rückgabe des Fokus) — kein eigener Dialog für das Bildbeschreibungs-Formular.
import { Modal } from "./Modal";
import { SanitizedHtml } from "./SanitizedHtml";
import { UploadLimitsHint } from "./UploadLimitsHint";
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

// AUFTRAG-mega9 Block F: der Zustand eines Vorschlags-Laufs — geteilt von Inline-Panel und
// Eingabeformular, damit beide dieselben vier ehrlichen Ausgänge kennen (kein Modell,
// Zeitüberschreitung, Vertraulichkeit, Fehler) und keiner davon je eine Pseudo-Beschreibung zeigt.
type CaptionAiState =
  | null
  | { status: "loading" }
  | { status: "fallback"; messageKey: string }
  // WP-BILD-1f: withContext = der Vorschlag wurde mit umgebendem Dokument-Kontext erzeugt.
  | { status: "suggestion"; text: string; withContext: boolean };

const IMAGE_SCALE_OPTIONS: Array<{ value: ImageScaleValue; label: string }> = [
  { value: "25", label: "Klein" },
  { value: "50", label: "Mittel" },
  { value: "75", label: "Groß" },
  { value: "100", label: "Volle Breite" },
];

// SCRUM-456-Fix (VIP 06.07.): zuverlässiges Einfügen von HTML — unabhängig von
// `document.execCommand`. Nach dem nativen Datei-Dialog („Bild vom Rechner …") hat der Editor
// keinen gültigen Cursor mehr; execCommand griff dann ins Leere → das Bild erschien nicht und
// landete auch nicht im Entwurf. Wir fügen daher direkt per Range ein: am Cursor, wenn er im
// Zielelement liegt, sonst am Ende des Inhalts.
//
// AUFTRAG-mega85 Block C: bis hierher stand dieser Rumpf INNERHALB von `insertHtmlReliable` und war
// damit fest an den Editor-Body gebunden. Er liegt jetzt als reine Funktion mit einem
// Ziel-PARAMETER daneben, weil die Bildbeschreibung denselben Weg braucht (der Rückfall des
// Umbruch-Knopfes). Zwei Kopien wären zwei Wahrheiten — genau das, wogegen mega50 angetreten ist.
// Das Verhalten für den Body ist unverändert; das Anhängen von `verankereFiguren`/`emit` bleibt beim
// Aufrufer, weil es Body-Sache ist und die Fußnote nichts damit zu tun hat.
function fuegeAmCursorEin(el: HTMLElement, html: string): void {
  el.focus();
  const sel = window.getSelection();
  const caret =
    sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)
      ? sel.getRangeAt(0)
      : null;
  if (caret) {
    // Cursor liegt im Ziel → genau dort einfügen (Drop/Einfügen mit gültiger Auswahl).
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
    // Kein Cursor im Ziel (typisch NACH dem nativen Datei-Dialog „Bild vom Rechner"): bombensicher
    // ans Ende anhängen — unabhängig von Fokus/Auswahl. Genau hier hakte es vorher.
    el.insertAdjacentHTML("beforeend", html);
  }
}

// AUFTRAG-mega86 Block B (bens GELB aus sammel84) — FETT UND KURSIV BIS ZUR SICHTBAREN WIRKUNG.
//
// DER BEFUND, und er trägt: bis mega85 waren fett und kursiv NUR bis zum Aufruf von
// `document.execCommand` gepinnt. Der Spion meldete `true` und veränderte kein DOM; der Test
// startete mit bereits vorhandenem `<strong>` und bewies damit nicht, dass der Klick die AUSWAHL
// formatiert. Meldet ein Browser `false` oder fehlt `execCommand` ganz, tat der Produktcode sichtbar
// NICHTS — ohne Rückfall und ohne Hinweis. Beim Zeilenumbruch war das seit mega85 geschlossen
// (`fuegeAmCursorEin`), bei diesen beiden nicht.
//
// Das hier ist derselbe Rückfall, eine Etage genauer: die Auswahl wird per Range in ihr
// Auszeichnungs-Tag GEHÜLLT. Keine zweite Bauform — `fuegeAmCursorEin` darüber arbeitet auf
// denselben Ranges, und beide schreiben in dasselbe Feld, das `captionFieldChanged` danach durch
// den EINEN Sanitizer schickt.
//
// WARUM `execCommand` trotzdem zuerst gefragt wird und das hier der Rückfall bleibt: dort, wo es
// funktioniert, hängt es in der NATIVEN Rückgängig-Kette des Browsers. Eine Range-Mutation von Hand
// tut das nicht — Strg+Z nähme die Auszeichnung dann nicht zurück. Den funktionierenden Weg
// aufzugeben, um den kaputten testbar zu machen, wäre ein schlechter Tausch. Der Rückfall schließt
// genau die Lücke, die ben benannt hat, und er ist im Unit-Test deterministisch fahrbar, weil jsdom
// `execCommand` gar nicht kennt.
//
// DIE AUSWAHL MUSS VOR DEM FOKUSWECHSEL GESICHERT WERDEN, und das ist kein Testzugeständnis: ein
// Klick auf einen Werkzeug-Knopf nimmt dem Feld den Fokus, und `el.focus()` setzt danach einen
// Cursor, statt die Markierung wiederherzustellen. In jsdom ist das nachgemessen — nach `focus()`
// meldet dieselbe Auswahl `collapsed === true`, und ein späteres `feld.focus()` holt sie NICHT
// zurück (`_relay/messung/mega87-auswahl-sonde.ts`). Ein Range-KLON überlebt den Fokuswechsel
// dagegen unversehrt; er zeigt weiter auf die lebenden Knoten.
//
// AUFTRAG-mega87 Block A: bis mega86 stand hier, `captionFormat` merke sich den Bereich „GANZ
// ZUERST, vor jedem Fokuswechsel". Das war eine Zusage, die der Code nicht hielt — die drei
// Schaltflächen trugen ausschließlich `onClick`, und `mousedown` verschiebt den Fokus, bevor
// `onClick` läuft. „Ganz zuerst" innerhalb des Klick-Handlers ist zu spät.
//
// WAS DARAN GEMESSEN IST UND WAS NICHT — die Ehrlichkeit gehört hierher, weil genau diese Zeilen
// schon einmal mehr behauptet haben, als der Code hielt:
//   · In jsdom kollabiert `focus()` die Auswahl. Das ist nachgemessen und stimmt.
//   · In ECHTEN Browsern nicht. `_relay/messung/mega87-browser-messung.spec.ts` misst Chromium,
//     Firefox und WebKit: nach dem Fokuswechsel auf die Schaltfläche meldet die Auswahl weiterhin
//     `collapsed === false` und denselben Text. Alle drei bewahren die Selection des
//     contentEditable, und `execCommand` trifft sie danach korrekt.
//   · Der daraus gezogene Schluss ist also NICHT „ohne das Folgende wäre fett kaputt". Er ist:
//     jsdom ist an dieser Stelle eine unrealistische Attrappe, und der Weg unten hängt nicht mehr
//     davon ab, wie eine Engine mit der Auswahl beim Fokuswechsel umgeht. Dazu kommt ein
//     Bedienungsgewinn, der für sich zählt: der Fokus bleibt im Feld, man kann nach dem Klick
//     weitertippen, statt erst zurückklicken zu müssen.
// Zwei Wege, die zusammen Maus UND Tastatur tragen:
//   · Maus: die Schaltflächen unterbinden den Fokuswechsel schon bei `mousedown` (`haltAuswahl`).
//     Der Fokus bleibt im Feld, die Markierung lebt, `gemerkteAuswahl` findet sie.
//   · Tastatur: dort gibt es kein `mousedown` — mit Tab wandert der Fokus, und die Markierung
//     kollabiert. Deshalb merkt sich das FELD den letzten markierten Bereich, während er noch da
//     ist (`merkeAuswahl` an `keyup`/`mouseup`), und `captionFormat` greift darauf zurück.
// Beide Wege liefern denselben Bereich an dieselbe Stelle; eine zweite Bauform entsteht nicht.

// Ein Bereich zählt nur, wenn er etwas umfasst UND im Feld liegt. Das ist zugleich die Verfallsprobe
// für den gemerkten Bereich: wird der Feldinhalt von außen ersetzt (Vorschlag übernehmen, anderes
// Bild), hängen seine Knoten nicht mehr am Feld und er wird verworfen, statt fremden Text zu treffen.
function bereichImFeld(el: HTMLElement, bereich: Range | null): bereich is Range {
  return !!bereich && !bereich.collapsed && el.contains(bereich.commonAncestorContainer);
}

function gemerkteAuswahl(el: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return null;
  }
  const bereich = sel.getRangeAt(0);
  return bereichImFeld(el, bereich) ? bereich.cloneRange() : null;
}

// AUFTRAG-mega87 Block A, zweiter Teil: der gemerkte Bereich wurde bis mega86 NIE zurückgestellt.
// Auf ihn folgte unmittelbar `el.focus()` und dann `document.execCommand` — der native Befehl
// arbeitete also auf dem, was der Browser gerade für ausgewählt hielt (nach dem Fokuswechsel: nichts),
// nicht auf dem, was der Nutzer markiert hatte. Hier wird er wieder in die Auswahl gesetzt, BEVOR
// der Befehl abgeht. Die Auswahl bekommt einen eigenen Klon, damit der Rückfall unten seinen
// unversehrten Bereich behält, falls der Befehl die Auswahl unterwegs verstellt.
function stelleAuswahlWiederHer(el: HTMLElement, bereich: Range | null): void {
  el.focus();
  if (!bereich) {
    return;
  }
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(bereich.cloneRange());
}

// Rückgabe: ob WIRKLICH etwas ausgezeichnet wurde. `false` heißt „es gab keine Auswahl im Feld" —
// und genau dieser Zustand wird dem Nutzer gesagt, statt ihn raten zu lassen.
function umschliesseAuswahlMit(
  el: HTMLElement,
  tag: "strong" | "em",
  bereich: Range | null,
): boolean {
  if (!bereich) {
    return false;
  }
  el.focus();
  const sel = window.getSelection();
  const huelle = document.createElement(tag);
  huelle.appendChild(bereich.extractContents());
  bereich.insertNode(huelle);
  // Die Auswahl bleibt auf dem, was der Nutzer gerade ausgezeichnet hat — sonst wäre nach dem Klick
  // unklar, worauf ein zweiter wirkte, und der Cursor spränge an den Anfang.
  const nach = document.createRange();
  nach.selectNodeContents(huelle);
  sel?.removeAllRanges();
  sel?.addRange(nach);
  return true;
}

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
  documentTitle,
  captionFormRequest,
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
  // WP-BILD-1f: Dokument-Titel für den Kontext des KI-Bildbeschreibungs-Vorschlags (Klartext, kein
  // HTML) — der stärkste Fachbegriff-Anker, den ein Beitrag hat.
  //
  // AUFTRAG-mega85 Block D (bens ROT-Punkt 4 zu mega84): das war ein OPTIONALER Prop, und mega84 hat
  // ihn an allen heutigen Flächen versorgt. Repariert an den heutigen Stellen ist aber nicht
  // dasselbe wie baulich ausgeschlossen — eine fünfte Fläche morgen wäre vom Typsystem zu nichts
  // gezwungen gewesen. Genau diese Klasse ist mega50 schon einmal zum Verhängnis geworden
  // (`onDescribeImage`, zwei von vier Flächen), und danach noch einmal hier.
  //
  // ER IST DESHALB PFLICHT. Das ist der billigste Weg, weil der Compiler die Einbindungen SELBST
  // aufzählt — dieselbe Lösung wie bei den vier Zugängen in mega76. Der zweite Weg des Projekts,
  // ein Kontext nach dem Muster von `app/ImageDescribeContext.tsx`, passt hier NICHT: dieser
  // Kontext wird auch als WURZEL in `App.tsx` montiert und deckt damit Flächen ab, zu denen es gar
  // kein Dokument gibt. Ein Titel darin wäre für die Wurzel eine Lüge. Der Titel ist Inhalt EINER
  // Einbindung, nicht eine Fähigkeit der Umgebung — und Inhalt gehört an den Prop.
  //
  // Ein leerer String ist erlaubt und heißt „dieses Dokument hat (noch) keinen Titel" — eine
  // ENTSCHEIDUNG, kein Vergessen. Dass die Produktflächen wirklich einen führen, prüft je Instanz
  // `tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx` (Stufe 1+2, seit mega85 fundgenau).
  documentTitle: string;
  // AUFTRAG-mega69 Block A: eine Fläche AUSSERHALB des Editors (die Bildergalerie) bittet darum,
  // das Bildbeschreibungs-Formular für ein bestimmtes verankertes Bild zu öffnen. Es ist DASSELBE
  // Formular, derselbe describe-Weg — nur der Einstieg kommt von dort, wo das Bild betrachtet wird.
  // `nonce` macht jede Bitte zu einem neuen Ereignis (zweimal dasselbe Bild öffnet zweimal).
  captionFormRequest?: { imageId: string; nonce: number } | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  // AUFTRAG-mega50 Block A: der Weg zur Bildbeschreibung (WP-BILD-1c/1f, mega9 Block F) wird HIER
  // GEHOLT statt von jedem Aufrufer hereingereicht. Vorher waren das zwei optionale Props
  // (`onDescribeImage`, `describeAvailable`), die zwei der vier Flächen weggelassen haben — auf
  // ihnen verschwanden Formular und Vorschlag geräuschlos (Pedis Befund vom 29.07.). Der Aufruf
  // dahinter ist derselbe geblieben; nur seine Herkunft ist jetzt eine, die man nicht vergessen
  // kann (`app/ImageDescribeContext.tsx`).
  const imageDescribe = useImageDescribe();
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
  // WP-BILD-1f (bens P1): Bindung Request↔Fußnote. Die Generation zählte bei jedem Wechsel der
  // AKTUELLEN Fußnote hoch; ein laufender Request merkt sich (Generation + data-image-id + Element)
  // seiner Ausgangs-Fußnote und wendet seine Antwort NUR an, wenn all das noch aktuell ist.
  //
  // AUFTRAG-mega84 Block A: „die aktuelle Fußnote" war bis heute die FOKUSSIERTE — es gab den
  // Inline-Weg, bei dem der Cursor von Fußnote A nach B wandern konnte, während ein Request lief.
  // Diesen Weg gibt es nicht mehr; die aktuelle Fußnote ist ab jetzt immer die des offenen
  // Formulars. Der Zähler bleibt deshalb, wandert aber mit dem Formularlauf (`neuerFormularlauf`):
  // Er ist damit nicht schwächer als vorher, sondern deckt dieselben Ereignisse aus derselben
  // Quelle. Ihn ersatzlos zu streichen hätte `captionFormResponseApplicable` — die EINE Stelle, an
  // der mega11 Block D seine Geltungsprüfung führt — halbiert.
  const captionGenerationRef = useRef(0);
  // AUFTRAG-mega9 Block F (Pedi: „immer noch kein richtiges Eingabeformular mit einem KI-generierten
  // Vorschlag, den ich einfügen kann"). Der bisherige Weg war Inline-Editieren: in die figcaption
  // HINEINKLICKEN, dann erschien ein kleiner Knopf und ein schwebendes Panel. Das ist kein Formular.
  // Hier der Zustand des echten Formulars: die Ziel-Fußnote, das Bild dazu und der BEARBEITETE Text
  // (das Formular schreibt erst beim Speichern in die Fußnote — Abbrechen verwirft wirklich).
  //
  // AUFTRAG-mega11 Block D (bens SB-4): Beim Öffnen werden die Kennung des Bildes und seine Quelle
  // MIT eingefroren — nicht nur der Fußnoten-Knoten. Sie sind die Grundlage jeder Geltungsprüfung.
  // AUFTRAG-mega84 Block B: `draft` ist ab jetzt HTML, nicht Klartext — Pedis Formular kennt fett,
  // kursiv und Zeilenumbruch. Der Wert ist immer schon durch `sanitizeCaptionHtml` gelaufen.
  const [captionForm, setCaptionForm] = useState<{
    caption: HTMLElement;
    imageId: string | null;
    src: string;
    run: number;
    draft: string;
  } | null>(null);
  // Lauf-Nummer des Formulars: hoch bei Öffnen, Schließen, Speichern und bei jedem EXTERNEN
  // Wertwechsel (der den Editor-DOM neu aufbaut). Sie schließt den Fall, den Knoten-Identität und
  // Attribute allein nicht erwischen: Formular schließen und auf demselben Bild neu öffnen, während
  // die erste Anfrage noch unterwegs ist.
  const captionFormRunRef = useRef(0);
  // AUFTRAG-mega84 Block B: das Formularfeld ist ein contentEditable und damit UNKONTROLLIERT — sein
  // innerHTML wird bewusst nicht bei jedem Tastendruck aus dem State neu gesetzt (das zerstörte den
  // Caret, dieselbe Kante wie im Editor-Body oben). Geschrieben wird es nur, wenn sich der Inhalt von
  // AUSSEN ändert: beim Öffnen und beim Übernehmen eines Vorschlags. Dieser Zähler ist genau dieses
  // „von außen" — er steigt an beiden Stellen und an keiner dritten.
  const [captionFieldEpoch, setCaptionFieldEpoch] = useState(0);
  const captionFieldRef = useRef<HTMLDivElement>(null);
  // AUFTRAG-mega87 Block A: der zuletzt IM FELD markierte Bereich, gemerkt solange er noch lebt.
  // Kein State, sondern ein Ref: er ist nichts, was gerendert wird, und ein Zustandswechsel mitten
  // im Markieren würde nur unnötig neu zeichnen.
  const gemerkterBereichRef = useRef<Range | null>(null);
  // AUFTRAG-mega11 Block D: Das Ziel ist unter dem offenen Formular weggezogen worden. Dann wird
  // NICHT geschrieben, und das steht sichtbar am Formular — der getippte Text bleibt erhalten.
  const [captionFormStale, setCaptionFormStale] = useState(false);
  // AUFTRAG-mega86 Block B: der Formatier-Knopf, der weder über `execCommand` noch über den
  // Range-Rückfall etwas ausrichten konnte, SAGT das. Der Wert ist ein i18n-Schlüssel oder nichts —
  // im JSX steht keine Zeichenkette (DE/EN/NL im Katalog).
  const [captionFormatHint, setCaptionFormatHint] = useState<string | null>(null);
  // AUFTRAG-mega88 Block C: der Restfall, in dem KEIN Anker herstellbar ist. Er darf nicht mehr
  // lautlos sein — die Aktion war sichtbar, also muss auch ihr Ausfall sichtbar sein. Nach der
  // Invariante (editorFigures.ts) ist dieser Fall nicht mehr erreichbar; dass er trotzdem einen
  // Text hat, ist genau der Unterschied zwischen fail-closed und Vertrauen.
  const [ankerNotice, setAnkerNotice] = useState(false);
  // Der Vorschlags-Zustand des Formulars. Bis mega82 stand daneben ein zweiter für das Inline-Panel;
  // seit mega84 gibt es das Inline-Panel nicht mehr und damit auch nur noch diesen einen.
  const [captionFormAi, setCaptionFormAi] = useState<CaptionAiState>(null);
  // Spiegel des Formular-Zustands für die Gültigkeitsprüfung einer späten Antwort (kein Re-Render
  // nötig, und der Callback sieht immer den aktuellen Stand statt eines eingefrorenen).
  const captionFormRef = useRef<typeof captionForm>(null);
  captionFormRef.current = captionForm;

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
      // AUFTRAG-mega11 Block D (bens SB-4): der KOMPLETTE Editor-Inhalt wurde von außen ersetzt —
      // jede Fußnote, auf die ein offenes Formular oder ein laufender Request zeigt, ist ab jetzt
      // ein abgelöster Knoten. Die Lauf-Nummer macht beides ungültig.
      captionFormRunRef.current += 1;
      captionGenerationRef.current += 1;
      // WP-D7 (Befund 2): Bild-Fußnoten nach jedem innerHTML-Setzen verankern.
      // WP-D10: lokalisierter, rein visueller Einlade-Text für LEERE Fußnoten (data-kw-placeholder +
      // CSS :empty::before) — wird vom Sanitizer beim Speichern gestrippt, nie echter Inhalt.
      // AUFTRAG-mega84 Block A: dazu die angekündigte Beschriftung des Bedienelements.
      verankereFiguren(el);
    }
  }, [value, mode]);

  const emit = (): void => {
    const next = sanitizeHtml(ref.current?.innerHTML ?? "");
    lastEmittedRef.current = next;
    // U8: ein No-op-Blur (nichts geändert) löst keinen Parent-Renderzyklus mehr aus.
    if (next !== value) {
      onChange(next);
    }
  };

  // AUFTRAG-mega84 Block A: die Bild-Fußnoten im Editor verankern — an EINER Stelle, damit
  // Platzhalter und Beschriftung nicht an einem von vier Aufrufern hängen bleiben (genau die
  // Vergesslichkeit, an der mega50 entstanden ist).
  // I47 Punkt 5 (JOB 994 D1): `useCallback` mit `[t]` — die EINE Aufrufstelle bleibt die eine
  // Aufrufstelle (mega84 Block A, gepinnt in `tests/capture/editor-figure-caption.test.ts`), und
  // ihre Identität wechselt genau dann, wenn sich die Übersetzung ändert. Damit ist sie zugleich
  // der ehrliche Auslöser des Auffrischungseffekts unten: kein Auslöser, den der Rumpf nicht liest.
  const verankereFiguren = useCallback(
    (el: HTMLElement): void => {
      enhanceFiguresForEditing(
        el,
        t("editor.captionPlaceholder"),
        t(CAPTION_AI_TEXT.captionOpenLabel),
      );
    },
    [t],
  );

  // I47 PUNKT 5 (JOB 994 D1) — DER SPRACHWECHSEL AM OFFENEN EDITOR.
  //
  // DER BEFUND: die beiden Texte oben werden NICHT von React gerendert, sondern per `setAttribute`
  // in den DOM geschrieben — `data-kw-placeholder` (der visuelle Einlade-Text der leeren Fußnote)
  // und `aria-label` (die angekündigte Beschriftung). Der einzige Aufrufer war bis hierher der
  // Ladeeffekt mit `[value, mode]`. Wechselt die Sprache am offenen Editor, rendert React die
  // Werkzeugleiste neu — diese zwei Attribute blieben in der alten Sprache stehen, bis der nächste
  // Wert- oder Moduswechsel kam. I47 nennt das die einzige der fünf Härtungen, die ein Nutzer
  // heute merken könnte.
  //
  // WARUM EIN EIGENER EFFEKT UND NICHT `t` IN DIE ALTEN ABHÄNGIGKEITEN: der Ladeeffekt SCHREIBT
  // `el.innerHTML` neu. Liefe er bei jedem Sprachwechsel mit, verlöre der Nutzer mitten im Tippen
  // Auswahl und Einfügemarke — und die Lauf-Nummern für Fußnotenformular und Bildbeschreibung
  // würden ungültig, obwohl sich am Inhalt nichts geändert hat. Dieser Effekt schreibt deshalb
  // KEINEN Inhalt: `enhanceFiguresForEditing` setzt ausschließlich Attribute an vorhandenen Knoten.
  // Inhalt, Fokus und die Bildanker bleiben unberührt — genau das pinnt
  // `tests/capture/editor-language-refresh-mounted.test.tsx` (S-3 bis S-5).
  //
  // WARUM `i18n.language` UND NICHT `t`: die Sprache ist der Auslöser, den wir meinen. `t` ist eine
  // Funktion, deren Identität von der Bindung abhängt; die Sprachkennung ist ein Wert, der sich
  // genau dann ändert, wenn sich die Sprache ändert. Der Auslöser soll das sagen, was gemeint ist.
  //
  // WARUM ÜBER `verankereFiguren` UND NICHT DIREKT: die Verankerung läuft seit mega84 Block A über
  // GENAU EINE Stelle — der Wächter in `tests/capture/editor-figure-caption.test.ts` zählt sie. Ein
  // zweiter direkter Aufruf wäre exakt die Vergesslichkeit, gegen die diese eine Stelle gebaut
  // wurde; dieser Durchgang hat sie zwischenzeitlich eingebaut und ist daran rot geworden.
  // Beide Abhängigkeiten werden im Rumpf gelesen: es gibt hier keinen Auslöser, der nur behauptet
  // wird.
  useEffect(() => {
    const el = ref.current;
    if (mode !== "edit" || !el) {
      return;
    }
    verankereFiguren(el);
  }, [verankereFiguren, mode]);

  // AUFTRAG-mega84 Block A: die figcaption unter einem Ereignis finden (oder null).
  const captionAtNode = (node: Node | null): HTMLElement | null => {
    const element = node instanceof Element ? node : (node?.parentElement ?? null);
    const cap = element?.closest("figcaption");
    return cap instanceof HTMLElement && ref.current?.contains(cap) === true ? cap : null;
  };

  // WP-RETEST7 R2 ist hier ENTFALLEN (AUFTRAG-mega84 Block A): der Leeren-Normalisierer und der
  // Backspace-/Delete-Guard reparierten Schäden, die nur ein contenteditable-Editing-Host anrichten
  // kann. Die Fußnote ist keiner mehr — es gibt in ihr kein Caret, das etwas löschen könnte.
  const onEditorInput = (): void => {
    emit();
  };

  // D44 Teil 2, Weg (a): meldet einen Klick auf ein verankertes Bild an die Galerie desselben
  // Editors. `bubbles: true` ist der Kern — das Ereignis muss den gemeinsamen Elternknoten von
  // Editor und Galerie erreichen; `composed` bleibt aus, es soll den Baum nicht verlassen.
  //
  // `nonce` folgt dem Hausmuster von `captionFormRequest` (siehe :298): Zweimal dasselbe Bild
  // muss zweimal öffnen. Ein reiner Kennungsvergleich bliebe beim zweiten Klick stumm, weil sich
  // nichts geändert hätte — der Nutzer klickte, und die Grossansicht bliebe zu.
  const d44NonceRef = useRef(0);
  const meldeBildklick = (node: Node | null): void => {
    const el = ref.current;
    if (!el || mode !== "edit") {
      return;
    }
    const element = node instanceof Element ? node : (node?.parentElement ?? null);
    const bild = element?.closest("img");
    const imageId = bild?.getAttribute("data-image-id");
    if (!bild || !imageId || !el.contains(bild)) {
      return;
    }
    d44NonceRef.current += 1;
    const nutzlast: D44BildEreignis = { imageId, nonce: d44NonceRef.current };
    // JOB 1890 D13 — DAS EREIGNIS GEHT VOM BILD AUS, NICHT VON DER FLAECHE.
    //
    // Hier stand `el.dispatchEvent(...)`. Damit war `event.target` IMMER das contenteditable
    // <div>, und der Empfaenger (`BodyImageGallery.tsx:161`) sucht sein Bild ueber
    // `e.target.closest("img")` — `closest` steigt AUFWAERTS, ein <div> ist kein <img> und hat
    // keines ueber sich. Das Bild wurde deshalb nie gefunden, `setAttribute("tabindex", "-1")`
    // (:163) lief nie, und die Fokusrueckkehr beim Schliessen (:252-256) hatte kein Ziel.
    //
    // `bubbles: true` bleibt und traegt das Ereignis vom Bild ueber diese Flaeche bis zum
    // gemeinsamen Elternknoten von Editor und Galerie — dort haengt der Zuhoerer. Die
    // Bildidentitaet aendert sich nicht: sie kam und kommt aus `detail.imageId`.
    bild.dispatchEvent(
      new CustomEvent<D44BildEreignis>(D44_BILD_EREIGNIS, {
        detail: nutzlast,
        bubbles: true,
      }),
    );
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

  const updateImageSelectionFromCursor = (): void => {
    updateImageSelectionFromNode(window.getSelection()?.anchorNode ?? null);
  };

  // AUFTRAG-mega84 Block A (Pedis Befund vom 31.07.): DER KLICK AUF DIE BESCHREIBUNG IST DER WEG.
  // Bisher setzte er nur `selectedCaption` und ließ den Nutzer inline tippen; das Formular war
  // ausschließlich über einen Umweg erreichbar (erst das BILD anklicken, dann den Knopf in der
  // Werkzeugleiste). Genau die Fläche, die der Nutzer ansieht, war der einzige Ort ohne Weg.
  const onEditorClick = (e: MouseEvent<HTMLDivElement>): void => {
    const node = e.target instanceof Node ? e.target : null;
    const cap = captionAtNode(node);
    if (cap) {
      openCaptionFormForCaption(cap);
      return;
    }
    // D44 Teil 2, Weg (a) (ENTSCHEIDUNGEN/JOB-1620.md): Ein Klick auf ein verankertes Bild meldet
    // dessen Kennung an die Galerie DIESES Editors — sie zeigt es gross. Der Editor öffnet nichts
    // selbst; er ruft, was gebaut und abgenommen ist (`BodyImageGallery`), statt einen zweiten
    // Vergrösserungsweg anzulegen.
    //
    // WARUM EIN DOM-EREIGNIS UND KEINE PROP: Editor und Galerie sind in `Capture.tsx` und
    // `CaptureFrontDoor.tsx` GESCHWISTER — sie kennen einander nicht, ihre einzige Verbindung ist
    // der gemeinsame Elternteil. Das Ereignis steigt genau bis dorthin auf und wird von der
    // Galerie an ihrem eigenen Elternknoten abgeholt: kein globaler Kanal, keine zweite Galerie
    // im Baum, und keine Änderung an den Seiten.
    //
    // NUR MIT `data-image-id`: Nur verankerte Bilder stehen in der Galerie (`bodyImages.ts`).
    // Ein Bild ohne Kennung meldet nichts — fail-closed statt einer leeren Grossansicht.
    meldeBildklick(node);
    updateImageSelectionFromNode(node);
  };

  // AUFTRAG-mega84 Block A: der Tastaturweg ist dem Mausweg GLEICHWERTIG. Die Fußnote ist
  // fokussierbar (tabindex=0, role=button) — Eingabe- und Leertaste öffnen das Formular, und der
  // erste Tastendruck einer Schreibtaste ebenfalls, statt ins Leere zu laufen. Ohne diese letzte
  // Regel wäre Pedis ursprünglicher Satz („wenn ich hier einen Text eingebe, sollte sich ein
  // Eingabefeld öffnen") halb erfüllt: er tippt, und nichts geschieht.
  const onEditorKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const cap = captionAtNode(e.target instanceof Node ? e.target : null);
    if (!cap) {
      return;
    }
    const schreibtaste = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar" || schreibtaste) {
      e.preventDefault();
      openCaptionFormForCaption(cap);
    }
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

  // AUFTRAG-mega9 Block F: der GEMEINSAME Kern des Vorschlags-Laufs. Er lag vorher fest im
  // Inline-Weg (fokussierte Fußnote); das neue Eingabeformular braucht denselben Lauf für eine
  // FESTE Fußnote, unabhängig vom Fokus. Deshalb sind die zwei Dinge, die sich zwischen beiden
  // Wegen unterscheiden, zu Parametern geworden:
  //   `caption`     — für welche Fußnote wird beschrieben,
  //   `stillCurrent`— wann ist eine (späte) Antwort noch gültig,
  //   `report`      — wohin geht das Ergebnis (Inline-Panel oder Formular).
  // Die Logik dazwischen — Bindungsprüfung, Deckel, Kontext-Sammlung, Fallback-Gründe — bleibt
  // BYTE-GLEICH dieselbe. Es gibt weiterhin genau einen describe-Aufruf und genau eine Egress-Stelle.
  const runCaptionSuggestion = async (
    caption: HTMLElement,
    stillCurrent: () => boolean,
    report: (state: CaptionAiState) => void,
  ): Promise<void> => {
    // AUFTRAG-mega89 Block B: das Bild DIESER Fußnote — über die Kennung, sonst über das direkte
    // Kind. Hier stand `caption.parentElement?.querySelector("img")`: ein beliebiger Nachfahre der
    // umgebenden figure, der an einer verschachtelten Struktur das FALSCHE Bild traf. Beschrieben
    // worden wäre dann ein anderes Bild als das, auf das der Nutzer geklickt hat.
    const src = imageForCaption(caption, ref.current)?.getAttribute("src") ?? "";
    if (!src) {
      report({ status: "fallback", messageKey: CAPTION_AI_TEXT.imageUnreadable });
      return;
    }
    report({ status: "loading" });
    let dataUrl: string;
    try {
      dataUrl = await imageSrcAsDataUrl(src);
    } catch {
      if (stillCurrent()) {
        report({ status: "fallback", messageKey: CAPTION_AI_TEXT.imageUnreadable });
      }
      return;
    }
    const checked = checkCaptionImageDataUrl(dataUrl);
    if (!checked.ok) {
      if (stillCurrent()) {
        report({ status: "fallback", messageKey: checked.messageKey });
      }
      return;
    }
    // WP-BILD-1f: umgebenden Dokument-Kontext AM AKTUELLEN DOM sammeln (Titel + nächste Überschrift +
    // Absätze), budgetgekürzt. Reist im selben describe-Request wie das Bild → dieselbe Egress-Stelle.
    const editorRoot = ref.current;
    // AUFTRAG-mega89 Block B: `closest("figure")` statt `parentElement` — die Fußnote ist der
    // figure zugeordnet, nicht dem Knoten, der zufällig ihr Elternteil ist. `collectImageContext`
    // sucht die figure in seiner Blockliste; ein <div> dazwischen fände sich dort nicht wieder.
    const figure = caption.closest("figure");
    const context =
      editorRoot && figure ? collectImageContext(editorRoot, figure, documentTitle) : "";
    try {
      const result = await imageDescribe.describe(checked.dataUrl, context || undefined);
      if (!stillCurrent()) {
        return; // Ziel gewechselt → Antwort still verwerfen (kein Panel, keine Inhalts-Änderung).
      }
      const outcome = captionSuggestOutcome(result);
      report(
        outcome.kind === "suggestion"
          ? { status: "suggestion", text: outcome.text, withContext: result.withContext === true }
          : { status: "fallback", messageKey: outcome.messageKey },
      );
    } catch {
      // Netz-/Serverfehler (inkl. 413-Größendeckel) → ehrliche Fehlermeldung, kein Pseudo-Text.
      if (stillCurrent()) {
        report({ status: "fallback", messageKey: CAPTION_AI_TEXT.fallbackError });
      }
    }
  };

  // AUFTRAG-mega84 Block A: der Inline-Weg (`requestCaptionSuggestion`, `applyCaptionAi`) ist HIER
  // ENTFALLEN. Er beschrieb die gerade FOKUSSIERTE Fußnote und hing damit an einem Zustand, den es
  // seit heute nicht mehr gibt: die Fußnote ist kein Editing-Host, sie hat keinen Fokus im Sinne
  // eines Carets, und der Klick auf sie öffnet das Formular. Sein Knopf und sein Panel wären ab
  // jetzt unerreichbar gewesen — ein zweiter KI-Weg, den niemand mehr aufrufen kann, ist genau die
  // Doppelwahrheit, gegen die dieses Projekt gebaut ist. Der Egress-Kern (`runCaptionSuggestion`)
  // war schon immer geteilt und bleibt unverändert: EIN describe-Aufruf, EINE Egress-Stelle.

  // AUFTRAG-mega9 Block F: Das Formular öffnet sich über eine SICHTBARE Aktion am Bild.
  // AUFTRAG-mega69 Block A: der Kern nimmt das Ziel als Argument, damit auch die Galerie (über
  // `captionFormRequest`) DASSELBE Formular öffnen kann — kein zweites Formular.
  // AUFTRAG-mega84 Block A: und damit der Klick auf die Beschreibung selbst dorthin führt. Alle
  // Wege laufen durch DIESE Funktion; das ist der Grund, warum es weiterhin nur ein Formular gibt.
  const openCaptionFormForCaption = (caption: HTMLElement): void => {
    if (!ref.current?.contains(caption)) {
      return;
    }
    // AUFTRAG-mega89 Block B: dasselbe hier — `closest("figure")?.querySelector("img")` suchte über
    // beliebige Nachfahren. In einer verschachtelten Struktur zeigte das Formular daher das Bild des
    // ZWEITEN Eintrags, während der Text an die Fußnote des ersten geschrieben wurde.
    const image = imageForCaption(caption, ref.current);
    setCaptionFormAi(null);
    // AUFTRAG-mega11 Block D: jedes Öffnen ist ein neuer Lauf — eine Antwort auf den vorigen kann
    // hier nicht mehr landen, auch wenn es dieselbe Fußnote und dasselbe Bild ist.
    captionFormRunRef.current += 1;
    captionGenerationRef.current += 1;
    setCaptionFormStale(false);
    // Ein frisch geöffnetes Formular trägt keinen Hinweis aus dem vorigen.
    setCaptionFormatHint(null);
    setCaptionForm({
      caption,
      imageId: caption.getAttribute("data-image-id"),
      src: image?.getAttribute("src") ?? "",
      run: captionFormRunRef.current,
      // AUFTRAG-mega84 Block B: Ausgangswert ist der vorhandene Fußnoteninhalt EINSCHLIESSLICH
      // seiner Formatierung — deshalb innerHTML statt textContent. Der Platzhaltertext ist dabei
      // kein Inhalt: er lebt als CSS-::before am data-Attribut und steht nie im innerHTML.
      draft: capCaptionHtml(sanitizeCaptionHtml(caption.innerHTML), MAX_CAPTION_TEXT_CHARS),
    });
    // Das Feld ist unkontrolliert — es muss beim Öffnen einmal aus dem State befüllt werden.
    setCaptionFieldEpoch((n) => n + 1);
  };

  // AUFTRAG-mega88 Block B/C — HIER STAND EIN KOMMENTAR, DER NICHT WAHR WAR.
  //
  // Wörtlich: „fehlt sie (Altbestand), legt die bestehende Verankerung sie beim nächsten
  // enhanceFiguresForEditing an — dann gibt es hier nichts zu tun." Das tat sie nicht:
  // `enhanceFiguresForEditing` erweiterte ausschließlich VORHANDENE figure-Strukturen. Fehlte der
  // Anker, endete diese Funktion ohne jede Rückmeldung — der Knopf in der Bild-Werkzeugleiste blieb
  // sichtbar und tat lautlos nichts. Das war der Auslieferungsblocker.
  //
  // Seit mega88 ist der Satz WAHR: `enhanceFiguresForEditing` trägt die Invariante
  // (`ensureImageAnchors`, editorFigures.ts) und umschließt jedes nackte Bild. Trotzdem wird hier
  // nicht darauf VERTRAUT, sondern nachgesehen — und wenn wirklich kein Anker herstellbar ist,
  // sagt die Oberfläche das, statt zu schweigen. Fail-closed statt optimistisch: eine Aktion, die
  // nichts tut, muss den Grund nennen.
  const openCaptionFormFor = (image: HTMLImageElement): void => {
    // AUFTRAG-mega89 Block B: DIE Stelle, an der Bild 1 die Beschreibung von Bild 2 bekam. Hier
    // stand `image.closest("figure")?.querySelector("figcaption")` — für das erste Bild einer
    // verschachtelten Struktur fand das die INNERE Fußnote des zweiten (Dokumentreihenfolge).
    const finde = (): HTMLElement | null => {
      const gefunden = captionForImage(image, ref.current);
      return gefunden instanceof HTMLElement ? gefunden : null;
    };
    let caption = finde();
    if (caption === null && ref.current) {
      // Zweiter Versuch — die Invariante an genau diesem Bild einlösen (z. B. wenn der Inhalt seit
      // dem letzten Verankern von einer fremden Quelle verändert wurde).
      verankereFiguren(ref.current);
      caption = finde();
    }
    if (caption === null) {
      setAnkerNotice(true);
      return;
    }
    setAnkerNotice(false);
    openCaptionFormForCaption(caption);
  };

  const openCaptionForm = (): void => {
    if (selectedImage) {
      openCaptionFormFor(selectedImage);
    }
  };

  // AUFTRAG-mega69 Block A: die Bitte der Galerie einlösen — das verankerte Bild im Editor-DOM
  // finden und das Formular dafür öffnen. Attribut-Vergleich statt Selektor-Interpolation (kein
  // Escaping-Thema); ohne Treffer passiert bewusst nichts (das Bild ist dann nicht mehr im Body).
  // biome-ignore lint/correctness/useExhaustiveDependencies: openCaptionFormFor liest nur Refs/Setter — die Bitte selbst ist das Ereignis.
  useEffect(() => {
    if (!captionFormRequest || mode !== "edit") {
      return;
    }
    const el = ref.current;
    if (!el) {
      return;
    }
    const image = Array.from(el.querySelectorAll("img[data-image-id]")).find(
      (img) => img.getAttribute("data-image-id") === captionFormRequest.imageId,
    );
    if (image instanceof HTMLImageElement) {
      openCaptionFormFor(image);
    }
  }, [captionFormRequest]);

  // AUFTRAG-mega11 Block D (bens SB-4): der JETZIGE Stand des Formularziels, direkt am DOM abgelesen.
  // Eine Quelle für die Anzeige einer späten Antwort UND für das Speichern — genau die Trennung,
  // die mega9 hatte (geteilter Egress-Kern, ungeteilte Geltungsprüfung), gibt es damit nicht mehr.
  const captionFormCurrent = (): CaptionFormCurrent & {
    generation: number;
    caption: HTMLElement | null;
  } => {
    const form = captionFormRef.current;
    const caption = form?.caption ?? null;
    // AUFTRAG-mega89 Block B: auch die Geltungsprüfung liest das Bild über die Paarung. Sonst
    // vergliche sie beim Speichern die Quelle eines Bildes, das gar nicht das Ziel des Formulars ist.
    const img = caption !== null ? imageForCaption(caption, ref.current) : null;
    return {
      open: form !== null,
      sameCaption: true, // vom Aufrufer gegen SEIN Ziel überschrieben
      inDom: caption !== null && ref.current?.contains(caption) === true,
      imageId: caption?.getAttribute("data-image-id") ?? null,
      src: img?.getAttribute("src") ?? "",
      generation: captionGenerationRef.current,
      run: captionFormRunRef.current,
      caption,
    };
  };

  // Vorschlag IM FORMULAR: derselbe Lauf wie inline — und ab mega11 auch dieselbe Strenge. Eine
  // späte Antwort wird nur angezeigt, wenn das Formular noch offen ist, dieselbe Fußnote zeigt, die
  // Fußnote noch im Editor-DOM hängt, `captionResponseApplicable` (Generation + Bild-Kennung) hält
  // UND die Bildquelle unverändert ist.
  const requestCaptionFormSuggestion = async (): Promise<void> => {
    const form = captionForm;
    if (!form) {
      return;
    }
    const target = form.caption;
    const opened = {
      imageId: form.imageId,
      src: form.src,
      run: form.run,
      generation: captionGenerationRef.current,
    };
    const stillCurrent = (): boolean => {
      const now = captionFormCurrent();
      return captionFormResponseApplicable(opened, {
        ...now,
        sameCaption: now.caption === target,
      });
    };
    await runCaptionSuggestion(target, stillCurrent, setCaptionFormAi);
  };

  // Übernehmen/Anhängen setzt den Vorschlag ins FELD — nicht in die Fußnote. Erst „Speichern"
  // schreibt, und zwar über dieselbe Mechanik wie jede Handeingabe (applyCaptionHtml → innerHTML +
  // emit): die Sanitizer-Verträge bleiben unangetastet.
  const adoptCaptionSuggestion = (strategy: "replace" | "append"): void => {
    if (captionFormAi?.status !== "suggestion") {
      return;
    }
    const text = captionFormAi.text;
    setCaptionForm((prev) =>
      prev ? { ...prev, draft: applyCaptionSuggestionToHtml(prev.draft, text, strategy) } : prev,
    );
    // Eine Änderung von AUSSEN am unkontrollierten Feld → sie muss in den DOM geschrieben werden.
    setCaptionFieldEpoch((n) => n + 1);
  };

  const saveCaptionForm = (): void => {
    const form = captionForm;
    if (!form) {
      return;
    }
    // AUFTRAG-mega11 Block D (bens SB-4): VOR dem Schreiben prüfen, ob das Ziel überhaupt noch das
    // ist, das beim Öffnen eingefroren wurde. Ohne diese Prüfung konnte der Text auf eine abgelöste
    // oder auf eine zu einem ANDEREN Bild gehörende Fußnote geschrieben werden — genau die falsche
    // Inhaltszuordnung, gegen die captionResponseApplicable in WP-BILD-1f gebaut wurde.
    const now = captionFormCurrent();
    if (
      !captionFormTargetIntact(
        { imageId: form.imageId, src: form.src, run: form.run },
        { ...now, sameCaption: now.caption === form.caption },
      )
    ) {
      // Nicht schreiben, nicht schließen: der getippte Text bleibt sichtbar, der Grund steht dabei.
      setCaptionFormStale(true);
      setCaptionFormAi(null);
      return;
    }
    // AUFTRAG-mega84 Block B: geschrieben wird HTML — aber ausschließlich solches, das durch den
    // vorhandenen Client-Sanitizer und die Verengung auf fett/kursiv/Umbruch gelaufen ist. Der
    // Vertrag wird danach ein zweites Mal geprüft (emit → sanitizeHtml) und ein drittes Mal am
    // Server. Leerer Klartext bedeutet leere Fußnote: sonst bliebe ein <strong></strong> stehen,
    // die Fußnote wäre nicht :empty und der Platzhalter erschiene nicht mehr.
    const html = capCaptionHtml(sanitizeCaptionHtml(form.draft), MAX_CAPTION_TEXT_CHARS);
    applyCaptionHtml(form.caption, captionPlainText(html).length === 0 ? "" : html);
    emit();
    captionFormRunRef.current += 1;
    captionGenerationRef.current += 1;
    setCaptionForm(null);
    setCaptionFormAi(null);
    setCaptionFormStale(false);
    setCaptionFormatHint(null);
  };

  const closeCaptionForm = (): void => {
    // Abbrechen verwirft wirklich: in die Fußnote wurde bis hierher nichts geschrieben.
    // AUFTRAG-mega11 Block D: das Schließen macht einen noch laufenden Vorschlags-Request ungültig.
    captionFormRunRef.current += 1;
    captionGenerationRef.current += 1;
    setCaptionForm(null);
    setCaptionFormAi(null);
    setCaptionFormStale(false);
    setCaptionFormatHint(null);
  };

  // ── AUFTRAG-mega84 Block B: fett, kursiv, Zeilenumbruch IM FELD ───────────────────────────────
  //
  // Pedis Wort ist „formatieren", sein entschiedener Umfang (31.07., 13:30) sind diese drei. Die
  // Bedienung läuft über `document.execCommand` — dieselbe Mechanik, die die Editor-Werkzeugleiste
  // oben seit SCRUM-384 benutzt (`exec`), also keine zweite Bauform. Was der Browser daraus macht
  // (<b> oder <strong>, <i> oder <em>), ist egal: der Sanitizer bildet b→strong und i→em ab, auf
  // dem Client wie auf dem Server.
  const captionFieldChanged = (): void => {
    const el = captionFieldRef.current;
    if (!el) {
      return;
    }
    const html = sanitizeCaptionHtml(el.innerHTML);
    setCaptionForm((prev) => (prev ? { ...prev, draft: html } : prev));
  };

  // AUFTRAG-mega85 Block C (bens Hinweis aus sammel83-mega84): `insertLineBreak` ist kein
  // standardisiertes Kommando; ein Browser, der es nicht kennt, meldete `false`, und der Knopf ↵ tat
  // NICHTS, ohne dass es irgendwo auffiel. Genau der Fehlschlag, den man nicht sieht. mega85 las
  // deshalb den Rückgabewert und hängte einen Rückfallweg daran, und zwar denselben, den dieser
  // Editor für Einfügungen seit SCRUM-456 ohnehin benutzt (`fuegeAmCursorEin`) — kein zweiter
  // Mechanismus. Der Aufruf selbst wird gekapselt, weil eine Umgebung ganz OHNE execCommand (jsdom,
  // ältere Einbettungen) sonst den Knopf mit in den Fehler risse.
  //
  // Der Rückgabewert wird seit mega87 NICHT mehr gelesen: er war die zu schwache Probe (siehe unten
  // an `captionFormat`). Was mega85 mit ihm erkannte, erkennt die Wirkungsmessung auch — ein Befehl,
  // der `false` meldet, hat das Feld nicht verändert. Umgekehrt gilt es nicht, und darin lag der
  // Blocker.
  //
  // AUFTRAG-mega86 Block B (bens GELB aus sammel84): hier stand, für fett/kursiv gebe es keinen
  // Rückfall, weil ein `false` dort „keine Auswahl" bedeute und der Nutzer den Ausfall ohnehin sehe.
  // Das war eine Annahme, keine Messung — und sie deckt den Fall „Browser kennt das Kommando nicht"
  // gar nicht ab. Beide Fähigkeiten haben jetzt denselben zweistufigen Weg wie der Umbruch:
  //   1. `execCommand` (dort, wo es trägt, hängt es in der nativen Rückgängig-Kette),
  //   2. blieb das Feld dabei UNVERÄNDERT, der Range-Weg `umschliesseAuswahlMit` — deterministisch
  //      und im Unit-Test fahrbar,
  //   3. und wenn AUCH der nichts ausrichtet (es gibt keine Auswahl), wird das GESAGT. Ein
  //      Formatier-Knopf, der schweigend nichts tut, ist genau der Fehlschlag, den man nicht sieht.
  //
  // AUFTRAG-mega87 Block A (Pedis Ship-Blocker, am Quelltext nachgemessen): an dieser Stelle
  // entschied bis mega86 der RÜCKGABEWERT von `execCommand`, nicht die Wirkung. `execCommand` ist
  // seit Jahren abgekündigt; sein `true` ist in keiner Engine eine Zusage über das DOM. Meldete ein
  // Browser Erfolg, ohne etwas zu verändern, blieb der Rückfall aus UND der Hinweis wurde auf `null`
  // gesetzt — der stille Ausfall aus bens sammel84, unverändert möglich, und von keinem Test
  // gesehen, weil jsdom `execCommand` gar nicht kennt und deshalb nur den Rückfallweg fährt.
  // Gemessen wird jetzt der ZUSTAND DES FELDES vor und nach dem Aufruf. Hat sich nichts geändert,
  // greift der Rückfall — gleichgültig, was der Befehl gemeldet hat.
  const captionFormat = (command: "bold" | "italic" | "insertLineBreak"): void => {
    const el = captionFieldRef.current;
    if (!el) {
      return;
    }
    // Was JETZT markiert ist (Mausweg: der Fokus hat das Feld nie verlassen), sonst der zuletzt im
    // Feld markierte Bereich (Tastaturweg: Tab hat die Markierung kollabiert). Beides durch
    // dieselbe Probe gefiltert — ein Bereich außerhalb des Feldes zählt nirgends.
    const gemerkt = gemerkterBereichRef.current;
    const auswahl = gemerkteAuswahl(el) ?? (bereichImFeld(el, gemerkt) ? gemerkt : null);

    // Zurückstellen VOR dem Befehl: sonst formatiert er das, was der Browser gerade für ausgewählt
    // hält, statt das, was der Nutzer markiert hat.
    stelleAuswahlWiederHer(el, auswahl);

    const vorher = el.innerHTML;
    try {
      document.execCommand(command);
    } catch {
      // Eine Umgebung ganz ohne `execCommand` (jsdom, ältere Einbettungen) darf den Knopf nicht
      // mitreißen — sie ist nur einer von mehreren Gründen, aus denen unten nichts steht.
    }
    // DIE WIRKUNG, nicht die Meldung.
    let gewirkt = el.innerHTML !== vorher;

    if (!gewirkt) {
      if (command === "insertLineBreak") {
        fuegeAmCursorEin(el, "<br>");
        gewirkt = true;
      } else {
        gewirkt = umschliesseAuswahlMit(el, command === "bold" ? "strong" : "em", auswahl);
      }
    }
    // Das Gedächtnis geht mit: nach einer gelungenen Auszeichnung steht die Auswahl auf dem gerade
    // Ausgezeichneten, ein zweiter Knopf (fett UND kursiv) trifft also dasselbe Stück. Ging nichts,
    // wird auch nichts Totes aufgehoben.
    gemerkterBereichRef.current = gemerkteAuswahl(el);
    // Bleibt es trotz Rückfall bei nichts, ist die Ursache immer dieselbe: es war nichts markiert.
    // Der Hinweis verschwindet beim nächsten gelungenen Klick von selbst.
    setCaptionFormatHint(gewirkt ? null : CAPTION_AI_TEXT.formSelectFirst);
    captionFieldChanged();
  };

  // Das Gedächtnis für die Markierung, gepflegt, SOLANGE sie noch lebt. Ein Nutzer erzeugt beim
  // Markieren `mouseup` (ziehen und loslassen) beziehungsweise `keyup` (Umschalt+Pfeil); danach
  // kann Tab den Fokus wegnehmen, ohne dass die Auswahl verloren geht. `selectionchange` am
  // Dokument wäre der dritte denkbare Weg — jsdom feuert es bei `addRange` nachweislich null Mal
  // (Sonde), es wäre also unbelegter Code an einer Stelle, an der genau das der Befund war.
  const merkeAuswahl = (): void => {
    const el = captionFieldRef.current;
    if (el) {
      gemerkterBereichRef.current = gemerkteAuswahl(el);
    }
  };

  // AUFTRAG-mega87 Block A, erster Teil: der Fokuswechsel wird unterbunden, BEVOR er passiert —
  // das kanonische Muster für Werkzeugleisten über einem Editierfeld. Gemessen (siehe oben an
  // `gemerkteAuswahl`) fressen Chromium, Firefox und WebKit die Markierung dabei NICHT; der Grund
  // hier ist deshalb nicht Rettung, sondern zweierlei: der Fokus bleibt, wo der Nutzer schreibt
  // (nach dem Klick weitertippen, ohne zurückzuklicken), und der Weg hängt nicht mehr davon ab,
  // wie eine Engine das handhabt.
  const haltAuswahl = (e: MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
  };

  // Die Grenze zählt KLARTEXT. Ist sie erreicht, wird eine weitere Schreibtaste geblockt — genau
  // das, was das alte `maxLength` am <textarea> tat. Löschen, Navigieren und Formatieren bleiben
  // erlaubt: sie machen den Text nicht länger.
  const captionFieldKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const schreibtaste = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!schreibtaste) {
      return;
    }
    const el = captionFieldRef.current;
    const belegt = captionPlainText(el?.innerHTML ?? "").length;
    const auswahl = window.getSelection()?.toString().length ?? 0;
    if (belegt - auswahl >= MAX_CAPTION_TEXT_CHARS) {
      e.preventDefault();
    }
  };

  // Das unkontrollierte Feld aus dem State befüllen — NUR bei Änderungen von außen (Öffnen,
  // Vorschlag übernehmen), niemals beim Tippen. Sonst spränge der Caret bei jedem Zeichen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: die Epoche IST das Ereignis „von außen gesetzt".
  useEffect(() => {
    const el = captionFieldRef.current;
    if (el && captionForm) {
      const html = captionForm.draft;
      if (el.innerHTML !== html) {
        el.innerHTML = html;
      }
    }
  }, [captionFieldEpoch]);

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
      verankereFiguren(ref.current);
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
    fuegeAmCursorEin(el, html);
    // WP-D7b (Gelb-Fix 2): frisch eingefügte Bild-Fußnoten sofort editierbar verankern (Editor fokussiert).
    verankereFiguren(el);
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
                  {/* AUFTRAG-mega14 Block E (SCRUM-421): geltende Grenzen an der Auswahlstelle, Serverquelle.
                        Der Editor ist zugleich Ablege- und Einfügefeld — die Grenze steht dort, wo
                        die Datei gewählt wird. */}
                  <UploadLimitsHint className="mb-1 px-2 text-[11px] text-muted-2" />
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
                    {onAttachFiles ? (
                      <UploadLimitsHint className="mb-1 px-2 text-[11px] text-muted-2" />
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
          {/* AUFTRAG-mega9 Block F (Pedi): die SICHTBARE Aktion am Bild, die das echte
              Eingabeformular öffnet. Bisher war die Bildbeschreibung nur erreichbar, indem man in
              die Fußnote hineinklickte — eine Aktion, die man kennen musste. */}
          {/* AUFTRAG-mega50 Block A: ohne Bedingung. Der Weg zur Bildbeschreibung kommt aus der
              App (ImageDescribeContext) und ist damit auf JEDER Fläche da, auf der ein Bild
              stehen kann — nicht mehr nur dort, wo ein Aufrufer daran gedacht hat. */}
          <button
            type="button"
            data-testid="caption-form-open"
            onClick={openCaptionForm}
            className="ml-2 inline-flex h-7 items-center gap-1 rounded-btn border border-ai/40 bg-surface px-2 text-[11.5px] font-semibold text-ai hover:bg-hairline-soft"
          >
            <ImageIcon size={13} aria-hidden="true" />
            {t(CAPTION_AI_TEXT.formOpen)}
          </button>
        </div>
      ) : null}

      {/* AUFTRAG-mega9 Block F: das ECHTE, benannte Eingabeformular für die Bildbeschreibung.
          Reihenfolge wie im Auftrag: Bild → beschriftetes Feld mit sichtbarem Maximum →
          KI-Vorschlag erzeugen → abgesetzter Vorschlagsblock mit Übernehmen → Speichern/Abbrechen.
          Die Vorschlags-Logik (captionAiSuggest) bleibt unverändert die eine Quelle; das hier ist
          nur die Oberfläche davor. Kein neuer Endpunkt, kein neuer Egress: derselbe describe-Aufruf. */}
      <Modal
        open={captionForm !== null}
        onClose={closeCaptionForm}
        title={t(CAPTION_AI_TEXT.formTitle)}
      >
        {captionForm ? (
          <div className="space-y-3">
            {/* 1. Das Bild — groß genug zum Erkennen, worum es geht. */}
            {captionForm.src ? (
              <img
                src={captionForm.src}
                alt={t(CAPTION_AI_TEXT.formImageAlt)}
                className="max-h-64 w-full rounded-card border border-hairline bg-page object-contain"
              />
            ) : null}

            {/* 2. Beschriftetes Feld mit SICHTBAREM Maximum.
                AUFTRAG-mega84 Block B (Pedi: „ein Eingabefeld, in dem ich den Text eingeben UND
                FORMATIEREN kann"): das Feld nimmt fett, kursiv und Zeilenumbruch auf. Der Umfang ist
                Pedis eigener (31.07., 13:30) und deckt sich mit dem, was Client- und Server-Sanitizer
                ohnehin tragen — keine neue Allowlist, kein style, keine Klassen. */}
            <div>
              <label
                htmlFor="caption-form-text"
                className="mb-1 block text-[12.5px] font-medium text-muted"
              >
                {t(CAPTION_AI_TEXT.formLabel)}
              </label>
              {/* Ein echtes <fieldset> statt role="group": die Gruppe der drei Auszeichnungen
                  bekommt ihren Namen aus dem Element, nicht aus einem ARIA-Nachbau. */}
              <fieldset
                aria-label={t(CAPTION_AI_TEXT.formFormatLabel)}
                className="mb-1 flex flex-wrap items-center gap-1"
              >
                <button
                  type="button"
                  data-testid="caption-form-bold"
                  title={t(CAPTION_AI_TEXT.formBold)}
                  aria-label={t(CAPTION_AI_TEXT.formBold)}
                  onMouseDown={haltAuswahl}
                  onClick={() => captionFormat("bold")}
                  className={tb}
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  data-testid="caption-form-italic"
                  title={t(CAPTION_AI_TEXT.formItalic)}
                  aria-label={t(CAPTION_AI_TEXT.formItalic)}
                  onMouseDown={haltAuswahl}
                  onClick={() => captionFormat("italic")}
                  className={tb}
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  data-testid="caption-form-linebreak"
                  title={t(CAPTION_AI_TEXT.formLineBreak)}
                  aria-label={t(CAPTION_AI_TEXT.formLineBreak)}
                  onMouseDown={haltAuswahl}
                  onClick={() => captionFormat("insertLineBreak")}
                  className={tb}
                >
                  ↵
                </button>
              </fieldset>
              {/* AUFTRAG-mega86 Block B, dritter Fall: weder `execCommand` noch der Range-Rückfall
                  konnten etwas ausrichten. Das passiert genau dann, wenn nichts markiert ist — und
                  dann wird es GESAGT. `aria-live` kündigt es an, ohne den Fokus zu stehlen; der
                  Text kommt aus dem Katalog (DE/EN/NL), nicht aus dem JSX. */}
              {captionFormatHint ? (
                <p
                  data-testid="caption-form-format-hint"
                  aria-live="polite"
                  className="mb-1 text-[11.5px] text-trust-warn-text"
                >
                  {t(captionFormatHint)}
                </p>
              ) : null}
              {/* Unkontrolliert (siehe captionFieldEpoch): der Inhalt wird nur bei Änderungen von
                  AUSSEN gesetzt, sonst spränge der Caret bei jedem Zeichen. */}
              <div
                id="caption-form-text"
                ref={captionFieldRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label={t(CAPTION_AI_TEXT.formLabel)}
                data-kw-placeholder={t(CAPTION_AI_TEXT.formPlaceholder)}
                tabIndex={0}
                onInput={captionFieldChanged}
                onBlur={captionFieldChanged}
                onKeyDown={captionFieldKeyDown}
                // AUFTRAG-mega87 Block A: die Markierung wird gemerkt, WÄHREND sie noch da ist —
                // beim Loslassen der Maus und beim Loslassen der Taste. Danach darf Tab den Fokus
                // nehmen, ohne dass der Tastaturweg zweite Klasse wird.
                onMouseUp={merkeAuswahl}
                onKeyUp={merkeAuswahl}
                className="kw-caption-field min-h-[4.5em] w-full rounded-input border border-hairline bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-ai/50"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11.5px] text-muted-2">
                  {t(CAPTION_AI_TEXT.formLimit, {
                    // AUFTRAG-mega84 Block B: gezählt wird KLARTEXT, nicht Markup — sonst kostete
                    // ein einziges <strong> den Nutzer 17 seiner 300 Zeichen.
                    n: captionPlainText(captionForm.draft).length,
                    max: MAX_CAPTION_TEXT_CHARS,
                  })}
                </span>
                {/* Grenze ERREICHT wird zusätzlich benannt — sonst wäre ein vom Feld gekappter
                    Einfüge-Text ein unbemerkter Teilverlust (Muster aus mega6 Block D). */}
                {captionPlainText(captionForm.draft).length >= MAX_CAPTION_TEXT_CHARS ? (
                  <span
                    aria-live="polite"
                    className="text-[11.5px] font-medium text-trust-crit-text"
                  >
                    {t(CAPTION_AI_TEXT.formLimitReached, { max: MAX_CAPTION_TEXT_CHARS })}
                  </span>
                ) : null}
              </div>
            </div>

            {/* 3. Der KI-Vorschlag wird BEWUSST erzeugt, mit ehrlichem Ladezustand. */}
            <div className="rounded-card border border-dashed border-ai/30 bg-ai/5 p-2.5">
              <button
                type="button"
                data-testid="caption-form-suggest"
                disabled={captionFormAi?.status === "loading" || !imageDescribe.available}
                title={!imageDescribe.available ? t("ai.unavailable.hint") : undefined}
                onClick={() => void requestCaptionFormSuggestion()}
                className="inline-flex h-8 items-center gap-1 rounded-btn border border-ai/40 bg-surface px-2.5 text-[12px] font-semibold text-ai hover:bg-hairline-soft disabled:opacity-60"
              >
                ✨{" "}
                {captionFormAi?.status === "loading"
                  ? t(CAPTION_AI_TEXT.loading)
                  : t(CAPTION_AI_TEXT.suggest)}
              </button>
              {!imageDescribe.available ? <AiUnavailableHint show={true} /> : null}
              {/* AUFTRAG-mega61 Block E: die Bildbeschreibung erzeugt Text, den es vorher nicht
                  gab — sie trägt den Hinweis dauerhaft, nicht erst am Ergebnis.
                  AUFTRAG-mega62 Block F: der Kostenhinweis daneben, aus demselben Grund. */}
              <p className="mt-1">
                <AiGeneratedNotice /> <AiCostHint billable={imageDescribe.billable} />
              </p>

              {/* 4. Der Vorschlag als EIGENER, sichtbar abgesetzter Block — als KI-Vorschlag
                  gekennzeichnet und NICHT mit der Nutzereingabe vermischt. */}
              {captionFormAi?.status === "suggestion" ? (
                <div
                  data-testid="caption-form-suggestion"
                  className="mt-2 rounded-card border border-ai/30 bg-surface p-2"
                >
                  <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-ai">
                    {t(CAPTION_AI_TEXT.panelTitle)} · {t(CAPTION_AI_TEXT.aiBadge)}
                  </p>
                  {captionFormAi.withContext ? (
                    <p className="mt-0.5 text-[10.5px] leading-snug text-muted">
                      {t(CAPTION_AI_TEXT.withContext)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[12.5px] leading-relaxed text-text">
                    {captionFormAi.text}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="caption-form-adopt"
                      onClick={() => adoptCaptionSuggestion("replace")}
                      className="inline-flex h-7 items-center rounded-btn border border-ai/50 bg-ai px-2 text-[11.5px] font-semibold text-white"
                    >
                      {t(CAPTION_AI_TEXT.apply)}
                    </button>
                    {/* „Anhängen" nur, wenn schon Text im Feld steht: bei leerem Feld wäre es
                        dasselbe wie Übernehmen — zwei Knöpfe für dieselbe Wirkung wären eine
                        Scheinwahl. So ist die Entscheidung echt. */}
                    {captionPlainText(captionForm.draft).trim().length > 0 ? (
                      <button
                        type="button"
                        data-testid="caption-form-append"
                        onClick={() => adoptCaptionSuggestion("append")}
                        className="inline-flex h-7 items-center rounded-btn border border-ai/50 bg-surface px-2 text-[11.5px] font-semibold text-ai"
                      >
                        {t(CAPTION_AI_TEXT.formAppend)}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setCaptionFormAi(null)}
                      className="inline-flex h-7 items-center rounded-btn border border-hairline bg-surface px-2 text-[11.5px] font-semibold text-muted hover:text-text"
                    >
                      {t(CAPTION_AI_TEXT.discard)}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* 5. Bleibt der Vorschlag aus, steht hier der WAHRE Grund — nie eine
                  Pseudo-Beschreibung. Die vier Fälle stammen unverändert aus captionSuggestOutcome. */}
              {captionFormAi?.status === "fallback" ? (
                <p
                  data-testid="caption-form-fallback"
                  className="mt-2 rounded-btn bg-trust-warn-bg px-2 py-1.5 text-[11.5px] leading-relaxed text-trust-warn-text"
                >
                  {t(captionFormAi.messageKey)}
                </p>
              ) : null}
              {captionFormAi === null ? (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-2">
                  {t(CAPTION_AI_TEXT.formNoSuggestionYet)}
                </p>
              ) : null}
            </div>

            {/* AUFTRAG-mega11 Block D (bens SB-4): Das Ziel ist unter dem offenen Formular
                weggezogen worden (Bild getauscht, Quelle gewechselt, Bildblock entfernt, Inhalt von
                außen ersetzt). Dann wird NICHT geschrieben — und das steht hier, statt still auf ein
                abgelöstes oder fremdes Ziel zu schreiben. Der getippte Text bleibt stehen. */}
            {captionFormStale ? (
              <p
                data-testid="caption-form-stale"
                className="mt-2 rounded-btn bg-trust-crit-bg px-2 py-1.5 text-[11.5px] leading-relaxed text-trust-crit-text"
              >
                {t(CAPTION_AI_TEXT.formStale)}
              </p>
            ) : null}

            {/* 6. Speichern schreibt in die Fußnote, Abbrechen verwirft. */}
            <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={closeCaptionForm}
                className="inline-flex h-8 items-center rounded-btn border border-hairline bg-surface px-3 text-[12px] font-semibold text-muted hover:text-text"
              >
                {t(CAPTION_AI_TEXT.formCancel)}
              </button>
              <button
                type="button"
                data-testid="caption-form-save"
                onClick={saveCaptionForm}
                className="inline-flex h-8 items-center rounded-btn border border-ink bg-ink px-3 text-[12px] font-semibold text-white hover:opacity-90"
              >
                {t(CAPTION_AI_TEXT.formSave)}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* AUFTRAG-mega84 Block A — HIER STAND DAS INLINE-VORSCHLAGSPANEL (WP-BILD-1c).
          Es erschien, sobald der Cursor in einer figcaption stand, und zwar HIER: am oberen Rand
          des Editors, nicht an der Fußnote, die man angeklickt hatte. Seit mega84 ist die Fußnote
          kein Editing-Host mehr — es gibt keinen Cursor in ihr, die Bedingung konnte nie mehr wahr
          werden. Ein KI-Weg, den niemand mehr erreichen kann, ist keine Bequemlichkeit, sondern
          eine zweite Wahrheit neben dem Formular. Der Vorschlag lebt jetzt ausschließlich dort. */}

      {mode === "edit" ? (
        <div className="relative">
          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            // E2E-012/013: das contenteditable braucht einen zugänglichen Namen + Textbox-Semantik,
            // sonst kündigt der Screenreader nur „bearbeitbar" ohne Rolle/Mehrzeiligkeit an.
            role="textbox"
            aria-multiline="true"
            aria-label={t("editor.bodyLabel")}
            tabIndex={0}
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
          {/* AUFTRAG-mega88 Block C: kein stiller Ausfall mehr. Wenn zu einem Bild kein Anker
              herstellbar ist, sagt der Editor das an derselben Stelle, an der er auch den
              Datei-Hinweis sagt — lokalisiert (DE/EN/NL), als `status` angekündigt, wegklickbar. */}
          {ankerNotice ? (
            // Barrierearm ohne `role="status"`: die Ankündigung läuft über `aria-live`. `<output>`
            // wäre das, was die Regel `useSemanticElements` für diese Rolle vorschlägt — es steht
            // aber für das ERGEBNIS einer Berechnung, und hier meldet die Fläche einen Zustand.
            <div
              aria-live="polite"
              data-testid="editor-anchor-notice"
              className="mt-1 flex items-start justify-between gap-2 rounded-btn bg-trust-warn-bg px-2 py-1.5"
            >
              <p className="text-[11px] leading-relaxed text-trust-warn-text">
                {t("editor.captionNoAnchor")}
              </p>
              <button
                type="button"
                onClick={() => setAnkerNotice(false)}
                className="shrink-0 text-[11px] font-semibold text-trust-warn-text/80 hover:text-trust-warn-text"
              >
                {t("editor.linkCancel")}
              </button>
            </div>
          ) : null}
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

// SCRUM-315: DOM-freie Helfer für die KI-Nachbearbeitung des ausführlichen Inhalts (bodyHtml).
// Die KI liefert PLAINTEXT (reasoner.assist) — diese Helfer leiten den KI-Quelltext aus dem Body ab
// und wandeln einen Plaintext-Vorschlag in SICHERES Body-HTML um. Sicherheit: KI-Text wird escaped;
// erzeugt werden nur statische <p>/<br>-Tags. Bestehender Body-HTML-Stand wird NICHT erneut escaped
// (sanitizeHtml ist bei Entities nicht idempotent → keine Doppel-Maskierung). Kein Auto-Speichern,
// keine Validierung — der Mensch übernimmt den Vorschlag bewusst.

import { EDITOR_BLOCKS, type EditorBlock, editorBlockClass } from "./editorBlocks";
import { htmlToPlainText, isEmptyHtml } from "./richText";

export type BodyAssistMode = "replace" | "append";

function escapeBodyText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plaintext → escapte <p>-Absätze (Doppel-Umbruch = Absatz, einfacher Umbruch = <br>). Leer → "".
// Gemeinsame Basis für freie Absätze (suggestionToBodyHtml) und Block-Inhalt (suggestionToBodyBlockHtml).
function escapedParagraphs(text: string | null | undefined): string {
  const normalized = (text ?? "").replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0) {
    return "";
  }
  return normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${p.split("\n").map(escapeBodyText).join("<br>")}</p>`)
    .join("");
}

// KI-Quelltext aus dem Body ableiten (reiner Text; Bilder/Markup fallen weg — der Reasoner arbeitet
// auf Text). Leerer/fehlender Body → leerer String (Box wird dann deaktiviert).
export function bodyTextForAssist(bodyHtml: string | null | undefined): string {
  return bodyHtml ? htmlToPlainText(bodyHtml) : "";
}

// Plaintext-Vorschlag → strukturiertes, sicheres Body-HTML: Doppel-Zeilenumbruch = Absatz, einfacher
// Umbruch = <br>. Der Text wird selbst escaped; die einzigen erzeugten Tags sind statische <p>/<br>.
// Leer → "".
export function suggestionToBodyHtml(text: string | null | undefined): string {
  return escapedParagraphs(text);
}

// SCRUM-316: Plaintext-Vorschlag → sicherer Body-BLOCK (Info/Hinweis/Warnung/Erfolg). Nutzt die
// statische, sichere Klasse aus editorBlocks (`panel panel-<typ>`); der Text wird escaped, es entstehen
// nur statische <div>/<p>/<br>-Tags — keine fremden Klassen, kein aktives HTML aus Modelltext.
// Leerer Vorschlag → "".
export function suggestionToBodyBlockHtml(
  block: EditorBlock,
  text: string | null | undefined,
): string {
  const inner = escapedParagraphs(text);
  if (inner.length === 0) {
    return "";
  }
  return `<div class="${editorBlockClass(block)}">${inner}</div>`;
}

// Bewusste Übernahme: replace ersetzt den Body durch den Vorschlag, append hängt ihn an.
// Bestehender Body (`currentHtml`) gilt als bereits sanitisiert (kommt aus dem Editor) und wird
// unverändert übernommen; nur der neue Vorschlag wird sanitisiert. Leerer Vorschlag = No-Op.
export function applyBodyAssist(
  mode: BodyAssistMode,
  currentHtml: string | null | undefined,
  suggestionText: string | null | undefined,
): string {
  const base = currentHtml ?? "";
  const next = suggestionToBodyHtml(suggestionText);
  if (next.length === 0) {
    return base;
  }
  if (mode === "replace") {
    return next;
  }
  return isEmptyHtml(base) ? next : base + next;
}

// SCRUM-316: Vorschlag bewusst als Body-Block ANHÄNGEN (Info/Hinweis/Warnung/Erfolg). Bestehender
// Body bleibt unverändert; nur der neue Block wird ergänzt. Leerer Vorschlag = No-Op.
export function applyBodyAssistBlock(
  currentHtml: string | null | undefined,
  suggestionText: string | null | undefined,
  block: EditorBlock,
): string {
  const base = currentHtml ?? "";
  const next = suggestionToBodyBlockHtml(block, suggestionText);
  if (next.length === 0) {
    return base;
  }
  return isEmptyHtml(base) ? next : base + next;
}

// SCRUM-337: gebündelte AiAssistBox-„extraApplyActions" für die vier Body-Blocktypen (Info/Hinweis/
// Warnung/Erfolg) — bisher in Capture UND KO-Detail dupliziert, jetzt eine geteilte, testbare Quelle
// (auch vom Knowledge Input Studio genutzt). Reine Ableitung über die bestehenden Helfer; kein DOM.
export interface BodyAssistBlockAction {
  labelKey: string;
  apply: (original: string, suggestion: string) => string;
}

export function bodyAssistBlockActions(currentHtml: string): BodyAssistBlockAction[] {
  return EDITOR_BLOCKS.map((block) => ({
    labelKey: `capture.ai.applyAs.${block}`,
    apply: (_original: string, suggestion: string) =>
      applyBodyAssistBlock(currentHtml, suggestion, block),
  }));
}

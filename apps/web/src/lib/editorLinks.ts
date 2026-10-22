// SCRUM-322: DOM-freie Link-Helfer für den Beta-RichTextEditor.
// Der Sanitizer bleibt autoritativ; dieser Helper erzeugt nur bewusst sichere Link-HTML-Snippets.

import { istErlaubtesLinkziel } from "./richText";

export interface EditorLinkInput {
  url: string;
  label?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

// BIB-6 / H8: dieselbe Positivliste wie der Sanitizer (istErlaubtesLinkziel). Vorher galt alles, was
// mit `/` beginnt, als interner Pfad — auch `//fremd.example` und `/\fremd.example`, die der Browser
// als Fremdhost deutet. Was mit `/`, `\` oder `#` beginnt oder ein Schema traegt, wird so geprueft,
// wie es eingegeben wurde; nur eine nackte Domain bekommt `https://` vorangestellt.
export function normalizeEditorLinkUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) {
    return null;
  }
  const istZiel =
    /^[a-z][a-z0-9+.-]*:/i.test(raw) ||
    raw.startsWith("/") ||
    raw.startsWith("\\") ||
    raw.startsWith("#");
  const ziel = istZiel ? raw : `https://${raw}`;
  return istErlaubtesLinkziel(ziel) ? ziel : null;
}

export function editorLinkHtml(input: EditorLinkInput): string | null {
  const href = normalizeEditorLinkUrl(input.url);
  if (!href) {
    return null;
  }
  const text = input.label?.trim() || href;
  return `<a href="${escapeAttr(href)}">${escapeHtml(text)}</a>`;
}

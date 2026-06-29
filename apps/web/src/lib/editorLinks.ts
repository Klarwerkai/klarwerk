// SCRUM-322: DOM-freie Link-Helfer für den Beta-RichTextEditor.
// Der Sanitizer bleibt autoritativ; dieser Helper erzeugt nur bewusst sichere Link-HTML-Snippets.

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

export function normalizeEditorLinkUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return /^(https?:|mailto:)/i.test(raw) ? raw : null;
  }
  if (raw.startsWith("/") || raw.startsWith("#")) {
    return raw;
  }
  return `https://${raw}`;
}

export function editorLinkHtml(input: EditorLinkInput): string | null {
  const href = normalizeEditorLinkUrl(input.url);
  if (!href) {
    return null;
  }
  const text = input.label?.trim() || href;
  return `<a href="${escapeAttr(href)}">${escapeHtml(text)}</a>`;
}

// SCRUM-470 (Confluence-Import): Confluence Storage Format (XHTML + ac:/ri:-Makros) → generisches
// HTML. Das ist KEIN Voll-Parser und KEIN Sanitizer — der Reducer RETTET nur den Nutztext der Makros;
// die anschließende sanitizeHtml-Allowlist (services/structure) wirft alles Nicht-Erlaubte ohnehin
// raus. Grundregel: niemals Text verlieren. Bewusst regex-basiert (pragmatisch, Demo-tauglich).

const PANEL_MACROS = new Set(["info", "note", "warning", "tip"]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Entfernt die Body-Wrapper von Makros (rich-text-body / plain-text-body), behält den Inhalt.
function unwrapBodies(s: string): string {
  return s.replace(/<\/?ac:(?:rich-text-body|plain-text-body)\b[^>]*>/g, "");
}

export function confluenceStorageToHtml(storage: string): string {
  let html = storage;

  // Code-Makro: <ac:plain-text-body><![CDATA[…]]></ac:plain-text-body> → <pre> mit escaptem Text.
  html = html.replace(
    /<ac:plain-text-body>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/ac:plain-text-body>/g,
    (_m: string, code: string) => `<pre>${escapeHtml(code)}</pre>`,
  );
  // Verbliebene CDATA-Blöcke → escapter Text (nie roh durchreichen).
  html = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m: string, t: string) => escapeHtml(t));

  // Bild: <ac:image …><ri:attachment ri:filename="f.png"/></ac:image> → [Bild: f.png].
  html = html.replace(
    /<ac:image\b[^>]*>[\s\S]*?<ri:attachment\b[^>]*\bri:filename="([^"]*)"[^>]*\/?>[\s\S]*?<\/ac:image>/g,
    (_m: string, file: string) => `<p>[Bild: ${escapeHtml(file)}]</p>`,
  );
  html = html.replace(/<ac:image\b[^>]*>[\s\S]*?<\/ac:image>/g, ""); // Bild ohne Dateiname → weg

  // Link: Text aus link-body/plain-text-link-body, sonst der content-title.
  html = html.replace(/<ac:link\b[^>]*>([\s\S]*?)<\/ac:link>/g, (_m: string, inner: string) => {
    const body =
      /<ac:(?:plain-text-link-body|link-body)>([\s\S]*?)<\/ac:(?:plain-text-link-body|link-body)>/.exec(
        inner,
      );
    const bodyText = body?.[1]?.trim();
    if (bodyText) {
      return bodyText;
    }
    const title = /ri:content-title="([^"]*)"/.exec(inner);
    return title?.[1] ? escapeHtml(title[1]) : "";
  });

  // Aufgabenliste: <ac:task-list> → <ul>, jede <ac:task-body> → <li>.
  html = html.replace(
    /<ac:task-list\b[^>]*>([\s\S]*?)<\/ac:task-list>/g,
    (_m: string, inner: string) => {
      const items = [...inner.matchAll(/<ac:task-body>([\s\S]*?)<\/ac:task-body>/g)]
        .map((mm) => `<li>${mm[1] ?? ""}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    },
  );

  // Strukturierte Makros: Panel-Namen (info/note/warning/tip) → <blockquote>, sonst Inhalt entpacken.
  // <ac:parameter> ist Konfiguration, kein Inhalt → verwerfen.
  html = html.replace(
    /<ac:structured-macro\b[^>]*\bac:name="([^"]*)"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g,
    (_m: string, name: string, inner: string) => {
      const body = inner.replace(/<ac:parameter\b[^>]*>[\s\S]*?<\/ac:parameter>/g, "");
      const content = unwrapBodies(body).trim();
      return PANEL_MACROS.has(name) ? `<blockquote>${content}</blockquote>` : content;
    },
  );

  // Verbliebene Body-Wrapper (Makros ohne name o. Ä.) entpacken.
  html = unwrapBodies(html);

  // Layout-Wrapper strippen (Inhalt behalten).
  html = html.replace(/<\/?ac:layout(?:-section|-cell)?\b[^>]*>/g, "");

  // Rest: alle übrigen ri:-/ac:-Tags entfernen — Textinhalt bleibt immer erhalten.
  html = html.replace(/<ri:[a-z-]+\b[^>]*\/?>/g, "");
  html = html.replace(/<\/?ac:[a-z-]+\b[^>]*>/g, "");

  return html.trim();
}

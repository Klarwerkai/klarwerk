// KW-STR / SCRUM-45/46/48: DOM-freie Richtext-Helfer für den WYSIWYG-Editor.
// Der Server ist die autoritative Sanitizing-Instanz; dies hier ist Defense-in-Depth
// für Preview/UX (gleiche Allowlist) plus Editor-State-Helfer. Rein/testbar ohne DOM.

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "h2",
  "h3",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "blockquote",
  "div",
  // Formatierung Stufe 2: Tabellen aus Import/Paste ERHALTEN (nicht editieren). Reine Struktur-Tags
  // ohne style/Handler; an Zellen nur colspan/rowspan (numerisch). Sicher — kein XSS-Vektor.
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
]);
const VOID_TAGS = new Set(["br", "img"]);
// SCRUM-458 (Formatierungs-Erhaltung): identische Tag-Abbildung wie der Server-Sanitizer —
// semantische Formatier-Tags aus Word/Browser-Paste auf das erlaubte Äquivalent abbilden statt
// verwerfen (Fett/Kursiv/Überschriften bleiben). Kein style; Tabellen werden als Struktur ERHALTEN
// (Stufe 2, siehe ALLOWED_TAGS) — sie werden durchgelassen, nicht abgebildet.
const TAG_MAP: Record<string, string> = {
  b: "strong",
  i: "em",
  h1: "h2",
  h4: "h3",
  h5: "h3",
  h6: "h3",
};
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt"]),
  div: new Set(["class"]),
  // Formatierung Stufe 2 (Tabellen): nur numerische Zell-Spannen erhalten (Merges aus Word/HTML).
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
};

function isSafeHref(value: string): boolean {
  const v = value.trim();
  if (/^(https?:|mailto:|#|\/)/i.test(v)) {
    return true;
  }
  return !/^[a-z][a-z0-9+.-]*:/i.test(v);
}

// img src: Object-Store-raw oder data:image für SICHERE Rastertypen (kein SVG → XSS).
function isSafeImgSrc(value: string): boolean {
  const v = value.trim();
  return (
    /^\/api\/objects\/[\w-]+\/raw$/.test(v) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)
  );
}

// SCRUM-314: nur sichere, statische Block-Klassen erlaubt (Basis + vier Blocktypen). Fremde Klassen,
// style und on*-Handler werden weiterhin entfernt; Reihenfolge der erlaubten Klassen bleibt stabil.
const ALLOWED_DIV_CLASSES = new Set([
  "panel",
  "callout",
  "panel-info",
  "panel-note",
  "panel-warning",
  "panel-success",
  // SCRUM-355: schmale Erweiterung für sichere Body-Datei-Referenzen (Link auf Object-Store-Raw-Pfad).
  "attachment",
  // SCRUM-438: Herkunfts-Marker für übernommenes Public-KI-/Web-Wissen („extern · ungeprüft").
  "panel-external",
]);

function sanitizeDivClass(value: string): string | null {
  const classes = value.split(/\s+/).filter((c) => ALLOWED_DIV_CLASSES.has(c));
  return classes.length > 0 ? classes.join(" ") : null;
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseAttrs(raw: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null = re.exec(raw);
  while (m !== null) {
    const name = (m[1] ?? "").toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name && !attrs.has(name)) {
      attrs.set(name, value);
    }
    m = re.exec(raw);
  }
  return attrs;
}

function renderAttrs(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) {
    return "";
  }
  const out: string[] = [];
  for (const [name, value] of parseAttrs(raw)) {
    if (name.startsWith("on") || !allowed.has(name)) {
      continue;
    }
    if (tag === "a" && name === "href" && !isSafeHref(value)) {
      continue;
    }
    if (tag === "img" && name === "src" && !isSafeImgSrc(value)) {
      return "__INVALID_IMG__";
    }
    if (tag === "div" && name === "class") {
      const cls = sanitizeDivClass(value);
      if (!cls) {
        continue;
      }
      out.push(`class="${escapeText(cls)}"`);
      continue;
    }
    // Formatierung Stufe 2 (Tabellen): Zell-Spannen nur als positive Ganzzahl (1–999) übernehmen.
    if ((tag === "td" || tag === "th") && (name === "colspan" || name === "rowspan")) {
      if (/^[1-9]\d{0,2}$/.test(value)) {
        out.push(`${name}="${value}"`);
      }
      continue;
    }
    out.push(`${name}="${escapeText(value)}"`);
  }
  if (tag === "a") {
    out.push('rel="noopener noreferrer nofollow"', 'target="_blank"');
  }
  return out.length > 0 ? ` ${out.join(" ")}` : "";
}

// Tags, deren INHALT komplett verworfen wird (gespiegelt zu services/structure).
const DROP_CONTENT_TAGS = new Set(["script", "style", "iframe"]);

// Formatierung Stufe 2 (Paste-Normalisierer): Word/Browser liefern Fett/Kursiv/Unterstrichen oft als
// style-basierte <span> (z. B. style="font-weight:700") statt als <b>/<i>/<u>. Der Sanitizer verwirft
// <span> (nicht erlaubt) + style → die Formatierung ginge verloren. Wir bilden die häufigen, EINDEUTIGEN
// Fälle VOR dem Sanitizing auf semantische Tags ab; der Sanitizer räumt danach auf (Sicherheitsnetz).
// Konservativ und idempotent — nach der Umschreibung matcht nichts mehr.
function normalizeInlineFormatting(html: string): string {
  if (html.indexOf("<span") === -1) {
    return html;
  }
  return html
    .replace(
      /<span\b[^>]*\bstyle="[^"]*font-weight:\s*(?:bold|[6-9]00)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      "<strong>$1</strong>",
    )
    .replace(
      /<span\b[^>]*\bstyle="[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      "<em>$1</em>",
    )
    .replace(
      /<span\b[^>]*\bstyle="[^"]*text-decoration:[^"]*underline[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      "<u>$1</u>",
    );
}

export function sanitizeHtml(input: string): string {
  if (!input) {
    return "";
  }
  // Formatierung Stufe 2: style-basierte Formatierung vor dem Sanitizing auf semantische Tags abbilden.
  const html = normalizeInlineFormatting(input);
  const out: string[] = [];
  const openStack: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  let dropUntil: string | null = null;
  let m: RegExpExecArray | null = tagRe.exec(html);
  while (m !== null) {
    const full = m[0];
    const rawTag = (m[1] ?? "").toLowerCase();
    // SCRUM-458: bekannte Formatier-Tags auf ihr erlaubtes Äquivalent abbilden (b→strong usw.).
    const tag = TAG_MAP[rawTag] ?? rawTag;
    const isClose = full.startsWith("</");
    const text = html.slice(last, m.index);
    last = tagRe.lastIndex;

    if (dropUntil) {
      if (isClose && tag === dropUntil) {
        dropUntil = null;
      }
      m = tagRe.exec(html);
      continue;
    }

    if (text) {
      out.push(escapeText(text));
    }

    if (DROP_CONTENT_TAGS.has(tag) && !isClose) {
      dropUntil = tag;
    } else if (ALLOWED_TAGS.has(tag)) {
      if (isClose) {
        if (!VOID_TAGS.has(tag)) {
          const idx = openStack.lastIndexOf(tag);
          if (idx >= 0) {
            for (let i = openStack.length - 1; i >= idx; i -= 1) {
              out.push(`</${openStack[i]}>`);
            }
            openStack.splice(idx);
          }
        }
      } else {
        const attrs = renderAttrs(tag, m[2] ?? "");
        if (attrs !== "__INVALID_IMG__") {
          out.push(`<${tag}${attrs}>`);
          if (!VOID_TAGS.has(tag)) {
            openStack.push(tag);
          }
        }
      }
    }
    m = tagRe.exec(html);
  }
  if (!dropUntil) {
    const tail = html.slice(last);
    if (tail) {
      out.push(escapeText(tail));
    }
  }
  for (let i = openStack.length - 1; i >= 0; i -= 1) {
    out.push(`</${openStack[i]}>`);
  }
  return out.join("");
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|h2|h3|li|blockquote|div|caption|th|td|tr)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Leer = kein sichtbarer Inhalt (nur Whitespace/leere Tags).
export function isEmptyHtml(html: string | null | undefined): boolean {
  if (!html) {
    return true;
  }
  return htmlToPlainText(html).length === 0 && !/<img\b/i.test(html);
}

// Bild aus dem Object-Store als <img>-Markup (für insert-at-cursor im Editor).
export function insertImageHtml(objectId: string, alt: string): string {
  return insertImageSrcHtml(`/api/objects/${objectId}/raw`, alt);
}

export function insertImageSrcHtml(src: string, alt: string): string {
  const safeSrc = src.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const safeAlt = alt.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<img src="${safeSrc}" alt="${safeAlt}">`;
}

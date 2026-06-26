// SCRUM-45/46/48 (KW-STR) / NFR-SEC-04: reiner, DOM-freier Allowlist-Sanitizer für
// den WYSIWYG-Body. Server-autoritativ — jedes bodyHtml läuft hier durch, bevor es
// persistiert wird. Bewusst eng: nur eine kleine, sichere Tag-/Attribut-Menge.

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
]);

// Selbstschließende/leere Elemente ohne End-Tag.
const VOID_TAGS = new Set(["br", "img"]);

// Erlaubte Attribute je Tag (alles andere wird verworfen, inkl. on*-Handler/style).
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt"]),
  div: new Set(["class"]),
};

// href: nur sichere Schemes; KEIN javascript:/data: etc.
function isSafeHref(value: string): boolean {
  const v = value.trim();
  if (/^(https?:|mailto:|#|\/)/i.test(v)) {
    return true;
  }
  // relative ohne Schema (kein ":") ist ok
  return !/^[a-z][a-z0-9+.-]*:/i.test(v);
}

// img src: nur interner Object-Store-Raw-Pfad oder data:image für SICHERE Rastertypen.
// image/svg+xml ist bewusst NICHT erlaubt (SVG kann Skripte tragen → XSS).
function isSafeImgSrc(value: string): boolean {
  const v = value.trim();
  return (
    /^\/api\/objects\/[\w-]+\/raw$/.test(v) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)
  );
}

// div nur als Panel/Callout-Container.
function sanitizeDivClass(value: string): string | null {
  const classes = value.split(/\s+/).filter((c) => c === "panel" || c === "callout");
  return classes.length > 0 ? classes.join(" ") : null;
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseAttrs(raw: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = re.exec(raw)) !== null) {
    const name = (m[1] ?? "").toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name && !attrs.has(name)) {
      attrs.set(name, value);
    }
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
      return "__INVALID_IMG__"; // Bild ohne sichere src komplett verwerfen
    }
    if (tag === "div" && name === "class") {
      const cls = sanitizeDivClass(value);
      if (!cls) {
        continue;
      }
      out.push(`class="${escapeText(cls)}"`);
      continue;
    }
    out.push(`${name}="${escapeText(value)}"`);
  }
  // Links immer mit Schutz öffnen.
  if (tag === "a") {
    out.push('rel="noopener noreferrer nofollow"', 'target="_blank"');
  }
  return out.length > 0 ? ` ${out.join(" ")}` : "";
}

// Tags, deren INHALT komplett verworfen wird (nicht als Text behalten) — XSS/Style-Leaks.
const DROP_CONTENT_TAGS = new Set(["script", "style", "iframe"]);

// Allowlist-Tokenizer: läuft das HTML einmal durch, gibt nur erlaubte Tags + Text aus.
export function sanitizeHtml(html: string): string {
  if (!html) {
    return "";
  }
  const out: string[] = [];
  const openStack: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  let dropUntil: string | null = null; // wenn gesetzt: Inhalt bis zum Close-Tag verwerfen
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = tagRe.exec(html)) !== null) {
    const full = m[0];
    const tag = (m[1] ?? "").toLowerCase();
    const isClose = full.startsWith("</");
    const text = html.slice(last, m.index);
    last = tagRe.lastIndex;

    // Innerhalb von script/style/iframe: Text + alle Tags verwerfen, bis zum Close.
    if (dropUntil) {
      if (isClose && tag === dropUntil) {
        dropUntil = null;
      }
      continue;
    }

    if (text) {
      out.push(escapeText(text));
    }

    if (DROP_CONTENT_TAGS.has(tag) && !isClose) {
      dropUntil = tag; // Inhalt komplett verwerfen
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      continue; // unbekannte/gefährliche Tags verwerfen (Inhalt bleibt als Text)
    }
    if (isClose) {
      if (VOID_TAGS.has(tag)) {
        continue;
      }
      const idx = openStack.lastIndexOf(tag);
      if (idx >= 0) {
        // alle bis dahin offenen Tags schließen (toleriert Verschachtelungsfehler)
        for (let i = openStack.length - 1; i >= idx; i -= 1) {
          out.push(`</${openStack[i]}>`);
        }
        openStack.splice(idx);
      }
      continue;
    }

    const attrs = renderAttrs(tag, m[2] ?? "");
    if (attrs === "__INVALID_IMG__") {
      continue;
    }
    if (VOID_TAGS.has(tag)) {
      out.push(`<${tag}${attrs}>`);
    } else {
      out.push(`<${tag}${attrs}>`);
      openStack.push(tag);
    }
  }
  // Tail nur ausgeben, wenn nicht in einem Drop-Block (unbalanciertes script o. Ä.).
  if (!dropUntil) {
    const tail = html.slice(last);
    if (tail) {
      out.push(escapeText(tail));
    }
  }
  // Noch offene Tags sauber schließen.
  for (let i = openStack.length - 1; i >= 0; i -= 1) {
    out.push(`</${openStack[i]}>`);
  }
  return out.join("");
}

// Reine Plaintext-Ableitung aus HTML (für die statement-Kurzfassung).
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|h2|h3|li|blockquote|div)>/gi, " ")
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

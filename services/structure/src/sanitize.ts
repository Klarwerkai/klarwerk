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

// Selbstschließende/leere Elemente ohne End-Tag.
const VOID_TAGS = new Set(["br", "img"]);

// SCRUM-458 (Formatierungs-Erhaltung, Pedi K.-o.-Kriterium): Beim Einfügen aus Word/Browser kommen
// oft semantische Formatier-Tags, die nicht in unserer engen Allowlist stehen — sie werden auf das
// erlaubte Äquivalent ABGEBILDET statt verworfen, damit Fett/Kursiv/Überschriften erhalten bleiben.
// (Rein semantisch, kein style/kein Skript — die Sicherheits-Leitplanke bleibt unangetastet.)
// Tabellen werden inzwischen als Struktur ERHALTEN (Stufe 2, siehe ALLOWED_TAGS) — durchgelassen,
// nicht abgebildet. Weiterhin NICHT enthalten: style-basierte Formatierung
// (z. B. <span style="font-weight:bold">) — das übernimmt der Paste-Normalisierer in Stufe 2.
const TAG_MAP: Record<string, string> = {
  b: "strong",
  i: "em",
  h1: "h2",
  h4: "h3",
  h5: "h3",
  h6: "h3",
};

// Erlaubte Attribute je Tag (alles andere wird verworfen, inkl. on*-Handler/style).
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt"]),
  div: new Set(["class"]),
  // Formatierung Stufe 2 (Tabellen): nur numerische Zell-Spannen erhalten (Merges aus Word/HTML).
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
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

// SCRUM-314: div nur als Panel/Callout-Container + vier sichere Blocktyp-Varianten. Fremde Klassen,
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
  // SCRUM-438: übernommener Public-KI-/Web-Block wird als „extern · ungeprüft" markiert (stabiles,
  // sprachunabhängiges Herkunfts-Marker-Klassenzeichen; nur eine Klasse, kein Skript/Style).
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
    // Formatierung Stufe 2 (Tabellen): Zell-Spannen nur als positive Ganzzahl (1–999) übernehmen.
    if ((tag === "td" || tag === "th") && (name === "colspan" || name === "rowspan")) {
      if (/^[1-9]\d{0,2}$/.test(value)) {
        out.push(`${name}="${value}"`);
      }
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

function attrValue(raw: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const match = re.exec(raw);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function stripOfficeMarkup(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<xml\b[\s\S]*?<\/xml>/gi, "")
    .replace(/<o:p\b[^>]*>[\s\S]*?<\/o:p>/gi, "")
    .replace(/<\/?o:p\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<\/?(?:html|head|body|font)\b[^>]*>/gi, "")
    .replace(/\s(?:xmlns(?::\w+)?|lang)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

// Formatierung Stufe 2 (Paste-Normalisierer, autoritativ am Server): Word/Browser liefern Fett/Kursiv/
// Unterstrichen oft als style-basierte <span> (z. B. style="font-weight:700") statt als <b>/<i>/<u>.
// Der Sanitizer verwirft <span> + style → Formatierung ginge verloren. Wir bilden die häufigen,
// EINDEUTIGEN Fälle VOR dem Sanitizing auf semantische Tags ab; der Sanitizer räumt danach auf.
// Konservativ und idempotent — nach der Umschreibung matcht nichts mehr.
function normalizeInlineFormatting(html: string): string {
  if (html.indexOf("<span") === -1) {
    return html;
  }
  return html.replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (_full, rawAttrs, body) => {
    const style = attrValue(String(rawAttrs), "style");
    let out = String(body);
    if (!style) {
      return out;
    }
    if (/text-decoration(?:-line)?\s*:[^;]*underline/i.test(style)) {
      out = `<u>${out}</u>`;
    }
    if (/font-style\s*:\s*italic/i.test(style)) {
      out = `<em>${out}</em>`;
    }
    if (/font-weight\s*:\s*(?:bold|[6-9]00)\b/i.test(style)) {
      out = `<strong>${out}</strong>`;
    }
    return out;
  });
}

function normalizeRichTextInput(input: string): string {
  if (!input) {
    return "";
  }
  return normalizeInlineFormatting(stripOfficeMarkup(input));
}

// Allowlist-Tokenizer: läuft das HTML einmal durch, gibt nur erlaubte Tags + Text aus.
export function sanitizeHtml(input: string): string {
  if (!input) {
    return "";
  }
  // Formatierung Stufe 2: style-basierte Formatierung vor dem Sanitizing auf semantische Tags abbilden.
  const html = normalizeRichTextInput(input);
  const out: string[] = [];
  const openStack: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  let dropUntil: string | null = null; // wenn gesetzt: Inhalt bis zum Close-Tag verwerfen
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = tagRe.exec(html)) !== null) {
    const full = m[0];
    const rawTag = (m[1] ?? "").toLowerCase();
    // SCRUM-458: bekannte Formatier-Tags auf das erlaubte Äquivalent abbilden (b→strong usw.);
    // Open- und Close-Tag werden identisch abgebildet, damit der Schließ-Stack konsistent bleibt.
    const tag = TAG_MAP[rawTag] ?? rawTag;
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

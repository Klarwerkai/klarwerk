const NAME_END = /[\s/><]/u;
const SPACE = /\s/u;

/** DOM-freier, fortlaufender XML-Tagscanner; fehlende Enden lösen keine erneute Restsuche aus. */
export interface XmlTag {
  name: string;
  start: number;
  end: number;
  closing: boolean;
  selfClosing: boolean;
}

export function* xmlTags(xml: string): Generator<XmlTag> {
  let offset = 0;
  while (offset < xml.length) {
    const start = xml.indexOf("<", offset);
    if (start < 0) return;
    const special = xml.startsWith("<!--", start)
      ? (["-->", 4] as const)
      : xml.startsWith("<![CDATA[", start)
        ? (["]]>", 9] as const)
        : xml.startsWith("<?", start)
          ? (["?>", 2] as const)
          : null;
    if (special) {
      const end = xml.indexOf(special[0], start + special[1]);
      if (end < 0) return;
      offset = end + special[0].length;
      continue;
    }
    let cursor = start + 1;
    const closing = xml[cursor] === "/";
    if (closing) cursor += 1;
    const nameStart = cursor;
    while (cursor < xml.length && !NAME_END.test(xml[cursor] ?? "")) cursor += 1;
    const name = xml.slice(nameStart, cursor);
    let quote = "";
    for (; cursor < xml.length; cursor += 1) {
      const char = xml[cursor] ?? "";
      if (quote) {
        if (char === quote) quote = "";
      } else if (char === "'" || char === '"') quote = char;
      else if (char === ">" || char === "<") break;
    }
    if (cursor >= xml.length) return;
    if (xml[cursor] === "<") {
      offset = cursor; // kaputter Vorgänger; jedes Zeichen trotzdem nur einmal durchlaufen
      continue;
    }
    let last = cursor - 1;
    while (last > nameStart && SPACE.test(xml[last] ?? "")) last -= 1;
    offset = cursor + 1;
    if (name && !name.startsWith("!")) {
      yield { name, start, end: offset, closing, selfClosing: xml[last] === "/" };
    }
  }
}

export interface XmlElement {
  name: string;
  start: number;
  innerStart: number;
  innerEnd: number;
  end: number;
}

/** Nicht überlappende Blöcke; der QName des Schlusses gehört zum gewählten Öffner. */
export function* xmlElements(xml: string, names: string): Generator<XmlElement> {
  const accepts = new RegExp(`^(?:${names})$`, "u");
  let open: XmlTag | undefined;
  for (const tag of xmlTags(xml)) {
    if (open) {
      if (tag.closing && tag.name === open.name) {
        yield {
          name: open.name,
          start: open.start,
          innerStart: open.end,
          innerEnd: tag.start,
          end: tag.end,
        };
        open = undefined;
      }
    } else if (!tag.closing && accepts.test(tag.name)) {
      if (tag.selfClosing) {
        yield {
          name: tag.name,
          start: tag.start,
          innerStart: tag.end,
          innerEnd: tag.end,
          end: tag.end,
        };
      } else open = tag;
    }
  }
}

/** Einzelne öffnende Tags inklusive leerer Elemente, ohne über ihre Grenze zu suchen. */
export function* xmlOpeningTags(xml: string, names: string): Generator<string> {
  const accepts = new RegExp(`^(?:${names})$`, "u");
  for (const tag of xmlTags(xml)) {
    if (!tag.closing && accepts.test(tag.name)) yield xml.slice(tag.start, tag.end);
  }
}

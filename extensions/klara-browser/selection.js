// Runs once in Chrome's isolated world, only after an explicit capture gesture.
// No page listener, no request of its own, no form-field extraction, no extension-session access.
//
// JOB 3279 · CHR-04/05: es liest, was das offene Dokument BEREITS zeigt, in drei bewussten
// Umfängen — Markierung, Artikel, zugängliche Seite — und benennt jeden Teil, den es nicht
// mitnehmen kann, statt ihn still fallen zu lassen.
//
// BILDER OHNE EIGENE ANFRAGE: Die Bytes kommen aus dem bereits geladenen Bild über eine
// Zeichenfläche (drawImage/toDataURL). Ein Bild fremder Herkunft färbt die Zeichenfläche ein und
// toDataURL wirft — genau dann steht das Bild unter „Nicht übernommen" mit seiner Adresse. Was
// hier entsteht, ist eine KOPIE DER ANGEZEIGTEN DARSTELLUNG (bis 1200 px Kantenlänge), nicht die
// Originaldatei; die Leiste und der Entwurfskörper sagen das ausdrücklich.
(() => {
  const MAX_TEXT = 200000;
  const MAX_NODES = 4000;
  const MAX_DEPTH = 12;
  const MAX_IMAGES = 8;
  const MAX_IMAGE_CHARS = 700000;
  const MAX_IMAGE_BUDGET = 1200000;
  const MAX_EDGE = 1200;
  const MAX_GAPS = 20;
  const MIN_ARTICLE = 200;

  // Behaltene Tags, abgebildet auf die Tagmenge, die der Entwurfskörper zulässt.
  /** @type {Record<string, string>} */
  const KEEP = {
    h1: "h2",
    h2: "h2",
    h3: "h3",
    h4: "h3",
    h5: "h3",
    h6: "h3",
    p: "p",
    pre: "p",
    ul: "ul",
    ol: "ol",
    li: "li",
    blockquote: "blockquote",
    b: "strong",
    strong: "strong",
    i: "em",
    em: "em",
    u: "u",
    table: "table",
    thead: "thead",
    tbody: "tbody",
    tfoot: "tfoot",
    tr: "tr",
    th: "th",
    td: "td",
    caption: "caption",
    br: "br",
  };
  // Tags, deren Inhalt bewusst nicht gelesen wird — mit der Lückenklasse, unter der sie erscheinen.
  /** @type {Record<string, string>} */
  const DROP = {
    iframe: "embedded",
    object: "embedded",
    embed: "embedded",
    frame: "embedded",
    video: "media",
    audio: "media",
    canvas: "media",
    svg: "media",
    noscript: "dynamic",
    dialog: "dynamic",
    form: "form",
    input: "form",
    select: "form",
    textarea: "form",
    button: "form",
  };
  // Tags ohne Inhaltswert; ihr Wegfall ist keine Lücke und wird nicht gemeldet.
  const SILENT = new Set(["script", "style", "template", "link", "meta", "head", "title"]);
  const BLOCKS = new Set(["p", "h2", "h3", "li", "tr", "caption", "blockquote"]);

  /** @param {string} value */
  const absolute = (value) => {
    try {
      return new URL(value, location.href).href;
    } catch {
      return "";
    }
  };

  /** @param {Element} element */
  function visible(element) {
    if (element.hasAttribute("hidden")) return false;
    try {
      const style = getComputedStyle(element);
      // Losgelöste Knoten (geklonte Markierung) liefern leere Werte — das ist kein „unsichtbar".
      return style.display !== "none" && style.visibility !== "hidden";
    } catch {
      return true;
    }
  }

  /**
   * JOB 3279 R2 (bens Befund 5): Sichtbarkeit EINSCHLIESSLICH aller Vorfahren. `visible()` sieht
   * nur ein Element für sich; ein Kandidat in einem `<div hidden>` galt damit als sichtbar,
   * obwohl auf der Seite nichts davon zu sehen ist. Textknoten und Bruchstücke der geklonten
   * Markierung haben keine Vorfahren im Dokument — sie gelten wie bisher als sichtbar.
   * @param {Node} node
   */
  function sichtbar(node) {
    /** @type {Node | null} */
    let schritt = node;
    while (schritt) {
      if (
        schritt.nodeType === 1 &&
        !visible(/** @type {Element} */ (/** @type {unknown} */ (schritt)))
      )
        return false;
      schritt = schritt.parentNode;
    }
    return true;
  }

  /**
   * Die bereits geladene Bildinstanz im Dokument. In der geklonten Markierung ist das Bild
   * losgelöst und trägt keine Pixel; die Adresse führt zurück auf das echte Element.
   * @param {HTMLImageElement} image
   */
  function live(image) {
    if (image.isConnected) return image;
    const wanted = absolute(image.getAttribute("src") ?? "");
    for (const candidate of document.images) {
      const own = absolute(candidate.getAttribute("src") ?? "");
      if (candidate.currentSrc === wanted || own === wanted) return candidate;
    }
    return image;
  }

  /**
   * Die Beschriftung eines Bildes: die eigene Bildunterschrift, sonst der Alternativtext, sonst
   * der Titel. Nichts davon wird erfunden — fehlt alles, bleibt sie leer.
   * @param {HTMLImageElement} image @param {HTMLImageElement} source
   */
  function label(image, source) {
    for (const candidate of [image, source]) {
      const own = candidate.closest("figure")?.querySelector("figcaption")?.textContent ?? "";
      if (own.trim()) return own.trim().slice(0, 500);
    }
    const alt = (image.getAttribute("alt") ?? "").trim();
    return (alt || (image.getAttribute("title") ?? "").trim()).slice(0, 500);
  }

  /**
   * Die Bytes des angezeigten Bildes als Daten-Adresse — oder die ehrliche Lückenklasse.
   *
   * JOB 3279 R2 (bens Befund 4): DER VORRAT WIRD HIER NICHT MEHR GEPRÜFT. Das Ergebnis dieser
   * Funktion wird je Adresse zwischengespeichert und über alle drei Umfänge hinweg
   * wiederverwendet; eine Vorratsprüfung IN ihr wäre also mitgespeichert worden und hätte für
   * einen späteren Umfang mit vollem Vorrat weiterhin „zu groß" behauptet. Umgekehrt ging bei
   * einem Treffer im Zwischenspeicher gar keine Prüfung mehr — gemessen: drei gleiche Bilder
   * ergaben 1.950.066 Zeichen bei 1.200.000 Vorrat, `gaps: []`. Der Vorrat gehört zum UMFANG,
   * nicht zum Bild; er wird deshalb in `figure()` geprüft, bei jedem Bild einzeln.
   * @param {HTMLImageElement} image
   * @returns {{data?: string, gap?: string}}
   */
  function pixels(image) {
    const source = live(image);
    if (!source.complete || !source.naturalWidth || !source.naturalHeight)
      return { gap: "pending" };
    const scale = Math.min(1, MAX_EDGE / Math.max(source.naturalWidth, source.naturalHeight));
    const board = document.createElement("canvas");
    board.width = Math.max(1, Math.round(source.naturalWidth * scale));
    board.height = Math.max(1, Math.round(source.naturalHeight * scale));
    let data = "";
    try {
      const pen = board.getContext("2d");
      if (!pen) return { gap: "blocked" };
      pen.drawImage(source, 0, 0, board.width, board.height);
      data = board.toDataURL("image/png");
      if (data.length > MAX_IMAGE_CHARS) data = board.toDataURL("image/jpeg", 0.8);
    } catch {
      // Fremde Herkunft färbt die Zeichenfläche ein; das ist der Regelfall, nicht die Ausnahme.
      return { gap: "blocked" };
    }
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(data))
      return { gap: "blocked" };
    if (data.length > MAX_IMAGE_CHARS) return { gap: "large" };
    return { data };
  }

  /**
   * Der Sammelzustand eines Umfangs. `cache` hält bereits gelesene Bilder fest, damit dasselbe
   * Bild in Artikel und Seite nicht zweimal gelesen werden muss.
   * @param {Map<string, {data?: string, gap?: string}>} cache
   */
  function collector(cache) {
    return {
      cache,
      /** @type {import("./types").Piece[]} */ nodes: [],
      /** @type {import("./types").Gap[]} */ gaps: [],
      /** @type {string[]} */ pieces: [],
      chars: 0,
      count: 0,
      images: 0,
      budget: MAX_IMAGE_BUDGET,
      stop: false,
      seen: new Set(),
    };
  }

  /** @param {ReturnType<typeof collector>} state @param {string} kind @param {string} detail */
  function gap(state, kind, detail) {
    const key = `${kind} ${detail}`;
    if (state.seen.has(key)) return;
    if (state.gaps.length >= MAX_GAPS) {
      if (!state.seen.has("more")) {
        state.seen.add("more");
        state.gaps.push({ kind: "more", detail: "" });
      }
      return;
    }
    state.seen.add(key);
    state.gaps.push({ kind, detail });
  }

  /** @param {ReturnType<typeof collector>} state @param {string} value */
  function grow(state, value) {
    state.pieces.push(value);
    state.chars += value.length;
    if (state.chars > MAX_TEXT) state.stop = true;
  }

  /**
   * @param {HTMLImageElement} element @param {ReturnType<typeof collector>} state
   * @returns {import("./types").Piece | null}
   */
  function figure(element, state) {
    const source = live(element);
    const url = source.currentSrc || absolute(element.getAttribute("src") ?? "");
    const caption = label(element, source);
    const alt = (element.getAttribute("alt") ?? "").trim();
    if (state.images >= MAX_IMAGES) {
      gap(state, "image_limit", url);
      return null;
    }
    let result = state.cache.get(url);
    if (!result) {
      result = pixels(element);
      state.cache.set(url, result);
    }
    if (!result.data) {
      gap(state, `image_${result.gap ?? "blocked"}`, url);
      return null;
    }
    // JOB 3279 R2: DER VORRAT WIRD BEI JEDEM BILD GEPRÜFT — auch beim zweiten Auftreten desselben
    // Bildes und auch, wenn die Bytes schon im Zwischenspeicher liegen. Vorher zog nur der erste
    // Lesevorgang ab; dasselbe Bild dreimal auf einer Seite sprengte den Vorrat lautlos.
    if (result.data.length > state.budget) {
      gap(state, "image_large", url);
      return null;
    }
    state.images += 1;
    state.budget -= result.data.length;
    const note = caption ? `${caption} · Quelle / Source: ${url}` : `Quelle / Source: ${url}`;
    grow(state, `${note}\n`);
    return {
      tag: "figure",
      children: [
        { tag: "img", attrs: { src: result.data, alt: alt.slice(0, 500) } },
        { tag: "figcaption", children: [{ tag: "#text", text: note }] },
      ],
    };
  }

  /**
   * @param {ChildNode} node @param {import("./types").Piece[]} out
   * @param {ReturnType<typeof collector>} state @param {number} depth
   */
  function walk(node, out, state, depth) {
    if (state.stop) return;
    if (state.count >= MAX_NODES) {
      state.stop = true;
      return;
    }
    if (node.nodeType === 3) {
      const raw = (node.nodeValue ?? "").replace(/[ \t\f\r]+/g, " ");
      if (!/\S/.test(raw)) {
        if (raw && out.length > 0) out.push({ tag: "#text", text: " " });
        return;
      }
      state.count += 1;
      grow(state, raw);
      out.push({ tag: "#text", text: raw });
      return;
    }
    if (node.nodeType !== 1) return;
    const element = /** @type {Element} */ (/** @type {unknown} */ (node));
    const name = element.tagName.toLowerCase();
    if (SILENT.has(name)) return;
    const dropped = DROP[name];
    if (dropped) {
      gap(
        state,
        dropped,
        dropped === "embedded"
          ? absolute(element.getAttribute("src") ?? element.getAttribute("data") ?? "")
          : "",
      );
      return;
    }
    if (!visible(element)) return;
    if (name === "figcaption") return; // bereits als Beschriftung des Bildes verwendet
    if (name === "img") {
      const built = figure(/** @type {HTMLImageElement} */ (element), state);
      if (built) {
        state.count += 1;
        out.push(built);
      }
      return;
    }
    if (name === "pre") gap(state, "preformatted", "");
    if (name === "a" && (element.getAttribute("href") ?? "").trim()) gap(state, "links", "");
    const kept = KEEP[name];
    if (kept === "br") {
      state.count += 1;
      grow(state, "\n");
      out.push({ tag: "br" });
      return;
    }
    if (!kept || depth >= MAX_DEPTH) {
      // Unbekannte Hülle (div, section, span, nav …): durchsichtig, ihre Kinder zählen.
      for (const child of element.childNodes) walk(child, out, state, depth + 1);
      return;
    }
    /** @type {import("./types").Piece[]} */
    const children = [];
    for (const child of element.childNodes) walk(child, children, state, depth + 1);
    if (children.length === 0) return;
    state.count += 1;
    /** @type {import("./types").Piece} */
    const built = { tag: kept, children };
    if (kept === "th" || kept === "td") {
      /** @type {Record<string, string>} */
      const attrs = {};
      for (const key of ["colspan", "rowspan"]) {
        const value = element.getAttribute(key) ?? "";
        if (/^[1-9]\d{0,2}$/.test(value)) attrs[key] = value;
      }
      if (Object.keys(attrs).length > 0) built.attrs = attrs;
    }
    if (BLOCKS.has(kept)) grow(state, "\n");
    out.push(built);
  }

  /**
   * Nackter Text auf oberster Ebene bekommt einen Absatz; sonst stünde er ohne Block im
   * Entwurfskörper, und kein Editor fände ihn als eigenen Abschnitt wieder.
   * @param {import("./types").Piece[]} nodes
   */
  function blocks(nodes) {
    const inline = new Set(["#text", "br", "strong", "em", "u"]);
    /** @type {import("./types").Piece[]} */
    const out = [];
    /** @type {import("./types").Piece[]} */
    let open = [];
    const flush = () => {
      const carries = open.some((n) => Boolean((n.text ?? "").trim()) || n.tag !== "#text");
      if (carries) out.push({ tag: "p", children: open });
      open = [];
    };
    for (const node of nodes) {
      if (inline.has(node.tag)) {
        open.push(node);
        continue;
      }
      flush();
      out.push(node);
    }
    flush();
    return out;
  }

  /**
   * @param {Node | null} root @param {Map<string, {data?: string, gap?: string}>} cache
   * @param {string} [plain] Der maßgebliche Klartext, wenn der Aufrufer ihn schon kennt.
   * @returns {import("./types").Variant}
   */
  function variant(root, cache, plain) {
    const state = collector(cache);
    // JOB 3279 R2 (bens Befund 5): auch die WURZEL wird auf Sichtbarkeit geprüft. `walk()` prüfte
    // nur Kinder; ein `<article hidden>` lieferte deshalb seinen ganzen verborgenen Text.
    if (root && sichtbar(root))
      for (const child of root.childNodes) walk(child, state.nodes, state, 0);
    if (state.stop) gap(state, "truncated", String(state.chars));
    const nodes = blocks(state.nodes);
    const derived = state.pieces
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return {
      available: nodes.length > 0,
      text: (plain ?? derived).slice(0, MAX_TEXT),
      nodes,
      gaps: state.gaps,
      images: state.images,
    };
  }

  /**
   * Der Artikelbereich — oder NICHTS.
   *
   * JOB 3279 R2 (bens Befunde 3 und 5), zwei Korrekturen an einer Stelle:
   *   · Kandidaten werden auf SICHTBARKEIT geprüft, mitsamt ihren Vorfahren. Vorher gewann ein
   *     langer versteckter `<article hidden>` gegen den sichtbaren Artikel daneben — der Umfang
   *     „Artikel" hätte verborgenen Text übernommen.
   *   · KEIN Rückfall auf `document.body`. Wird kein Artikelbereich erkannt, gibt es keinen
   *     Artikel; die ganze Seite kommt nur über die ausdrückliche Wahl „Zugängliche Seite".
   *     Vorher stand unter „Artikel" stillschweigend die komplette Seite samt Navigation und
   *     Fußzeile — genau die Ausweitung, die der Auftrag ausschließt.
   * @returns {Element | null}
   */
  function article() {
    /** @type {Element | null} */
    let best = null;
    let score = 0;
    for (const element of document.querySelectorAll("article, main, [role='main']")) {
      if (!sichtbar(element)) continue;
      const own = (element.textContent ?? "").trim().length;
      if (own > score) {
        best = element;
        score = own;
      }
    }
    if (best && score >= MIN_ARTICLE) return best;
    for (const element of document.querySelectorAll("div, section, td")) {
      if (!sichtbar(element)) continue;
      let own = 0;
      for (const child of element.children)
        if (["P", "H1", "H2", "H3", "UL", "OL", "TABLE", "FIGURE"].includes(child.tagName))
          own += (child.textContent ?? "").trim().length;
      if (own > score) {
        best = element;
        score = own;
      }
    }
    return score >= MIN_ARTICLE ? best : null;
  }

  const selection = window.getSelection();
  const chosen = selection?.toString() ?? "";
  /** @type {Map<string, {data?: string, gap?: string}>} */
  const cache = new Map();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const marked = chosen.trim() && range ? variant(range.cloneContents(), cache, chosen) : null;
  const found = article();
  const written = found
    ? variant(found, cache)
    : { available: false, text: "", nodes: [], gaps: [], images: 0 };
  return {
    text: chosen,
    title: document.title,
    url: location.href,
    variants: {
      selection: marked ?? { available: false, text: chosen, nodes: [], gaps: [], images: 0 },
      article: written,
      page: variant(document.body, cache),
    },
  };
})();

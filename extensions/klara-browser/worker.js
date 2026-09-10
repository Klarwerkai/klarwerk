// Classic MV3 worker; all listeners are registered synchronously. Session storage is
// the only durable state across worker suspension. No automatic POST on startup.
(() => {
  const HOST = "https://app.klarwerk.ai";
  const MAX_BYTES = 5 * 1024 * 1024;
  // Deliberately smaller than the transport ceiling: also bounds session quota and preview cost.
  const MAX_SELECTION = 200000;
  const SOURCE_URL = 2048;
  const SOURCE_LABEL = 300;
  const EXCERPT = 500;
  // JOB 3279: Grenzen für den Inhaltsbaum, den die SEITE liefert. Er ist Fremddatum und wird
  // niemals durchgereicht, sondern hier neu aufgebaut — Tag für Tag, Attribut für Attribut.
  const MAX_PIECES = 6000;
  const MAX_PIECE_DEPTH = 14;
  const MAX_GAPS = 21;
  /**
   * JOB 3280 · CHR-06: `clipboard` ist der VIERTE Umfang, kein Sonderweg daneben. Er entsteht
   * ausschliesslich durch einen Klick auf „Aus Zwischenablage einfügen" — die Seite liefert ihn
   * nie mit, und er ist nie Vorbelegung. Damit läuft die eingefügte Antwort durch dieselbe
   * Umfangswahl, dieselbe Vorschau und denselben Speicherweg wie jede andere Übernahme.
   * @type {import("./types").Mode[]}
   */
  const MODES = ["selection", "article", "page", "clipboard"];
  /**
   * JOB 3524 · DIE ZWEI FELDER DIESER RUNDE — UND WARUM SIE HIER STEHEN UND NICHT IN `types.d.ts`.
   *
   * `lastTab` ist der zuletzt ERFOLGREICH gelesene Tab. Er überlebt das Verwerfen (das setzt nur
   * `work` zurück) und ist damit die einzige Angabe, aus der eine neue Übernahme aus der Leiste
   * heraus starten kann — die Erweiterung hat kein `tabs`-Recht und darf den offenen Tab nicht
   * raten. `logout` räumt ihn mit allem anderen weg (`storage.session.clear()`).
   *
   * `canCapture` sagt der Leiste, DASS ein solcher Tab da ist. Bewusst schwach: „es gibt einen
   * Tab", nicht „das Lesen wird gelingen" — das entscheidet sich erst am Zugriff.
   *
   * `types.d.ts` wäre ihr Platz, steht aber nicht in den Zielpfaden dieses Auftrags; Runde 1 wurde
   * genau dafür zurückgewiesen. Sie wohnen deshalb bei ihrem Erzeuger. Kommt `types.d.ts` einmal
   * zu einem Auftrag, ziehen beide dorthin und diese drei Typen fallen ersatzlos weg — es ist eine
   * Ortsangabe, keine zweite Wahrheit.
   * @typedef {{ id?: number, url?: string, title?: string }} Reiter
   * @typedef {import("./types").State & { lastTab?: Reiter }} Zustand
   * @typedef {import("./types").View & { canCapture?: boolean }} Sicht
   */
  const ready = chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  let busy = false;
  let captureBusy = false;

  // Die Tagmenge des Entwurfskörpers, gespiegelt aus services/structure/src/sanitize.ts. Was hier
  // nicht steht, kommt weder in die Vorschau noch in den Entwurf; der Server ist die zweite Linie.
  /** @type {Record<string, string[]>} */
  const ALLOWED = {
    h2: [],
    h3: [],
    p: [],
    ul: [],
    ol: [],
    li: [],
    blockquote: [],
    strong: [],
    em: [],
    u: [],
    table: [],
    thead: [],
    tbody: [],
    tfoot: [],
    tr: [],
    caption: [],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    figure: [],
    figcaption: [],
    img: ["src", "alt"],
    br: [],
  };
  const VOID = new Set(["br", "img"]);
  // Genau die Bildquellen, die der Server-Sanitizer durchlässt (isSafeImgSrc). Eine fremde
  // Bildadresse würde dort ersatzlos verworfen — das Bild wäre im Entwurf still weg.
  const IMAGE_SRC = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]{1,900000}$/;
  const SPAN = /^[1-9]\d{0,2}$/;

  // Beschriftung der Lückenklassen im Entwurfskörper. Zweisprachig wie der übrige Körper; die
  // Leiste hat ihre eigene, einsprachige Fassung in i18n.js.
  /** @type {Record<string, string>} */
  const GAP_TEXT = {
    embedded: "Eingebetteter Inhalt (Rahmen) / Embedded content (frame)",
    media: "Video, Audio, Zeichenfläche oder Vektorgrafik / Video, audio, canvas or vector graphic",
    dynamic:
      "Skriptabhängiger oder nachgeladener Inhalt / Script-dependent or lazily loaded content",
    form: "Formularfelder und Schaltflächen / Form fields and buttons",
    image_blocked:
      "Bild fremder Herkunft, Bildpunkte nicht lesbar / Cross-origin image, pixels unreadable",
    image_pending: "Bild noch nicht geladen / Image not loaded yet",
    image_large: "Bild über der Größengrenze / Image beyond the size limit",
    image_limit: "Weiteres Bild über der Anzahlgrenze / Further image beyond the count limit",
    preformatted:
      "Vorformatierter Block als Absatz übernommen / Preformatted block kept as a paragraph",
    links: "Verweise als Text übernommen, Zieladressen nicht / Links kept as text, targets dropped",
    truncated: "Inhalt an der Größengrenze gekürzt / Content truncated at the size limit",
    more: "Weitere Lücken nicht einzeln aufgeführt / Further gaps not listed individually",
  };
  /** @type {Record<string, string>} */
  const SCOPE_TEXT = {
    // JOB 3279 R2: der leere Umfang hat einen EIGENEN Satz. Vorher fiel er auf „Markierung"
    // zurück und der Entwurfskörper behauptete eine Wahl, die niemand getroffen hatte.
    "": "Noch nicht gewählt / Not chosen yet",
    selection: "Markierung / Selection",
    article: "Artikel / Article",
    page: "Zugängliche Seite / Accessible page",
    clipboard: "Zwischenablage / Clipboard",
  };
  /**
   * JOB 3280 · CHR-06: die HERKUNFT eingefügten Textes ist eine ANGABE DER PERSON, keine Messung.
   * Der Browser sieht die Zwischenablage erst im Augenblick des Einfügens und weiss nicht, woher
   * ihr Inhalt stammt. Deshalb steht im Entwurfskörper ausdrücklich, WER das behauptet — und die
   * Adresse daneben ist der offene Tab, nicht die Quelle des Textes.
   * @type {Record<string, string>}
   */
  const ORIGIN_TEXT = {
    ki_chat: "KI-Chat, ungeprüft / AI chat, unverified",
    web: "Webseite, ungeprüft / Web page, unverified",
    eigen: "Eigener Text, ungeprüft / Own text, unverified",
  };
  const ORIGINS = ["", "ki_chat", "web", "eigen"];
  // Chat-KI-Seiten. Der Vergleich ist Host-genau oder echte Unterdomäne — „www.perplexity.ai.evil.test"
  // ist damit KEINE Chat-KI, sondern eine fremde Seite, die so heißen möchte.
  const AI_HOSTS = [
    "chatgpt.com",
    "chat.openai.com",
    "openai.com",
    "claude.ai",
    "gemini.google.com",
    "bard.google.com",
    "perplexity.ai",
    "copilot.microsoft.com",
    "poe.com",
    "mistral.ai",
    "deepseek.com",
    "grok.com",
  ];

  /** @param {string | undefined} raw */
  function supported(raw) {
    try {
      const u = new URL(raw ?? "");
      return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
    } catch {
      return false;
    }
  }
  /** @param {string} url */
  function aiChat(url) {
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return false;
    }
    return AI_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
  }
  /** @param {string} text */
  const escapeText = (text) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  /** @param {string} text @returns {import("./types").Piece} */
  const words = (text) => ({ tag: "#text", text });
  /** @param {string} text @returns {import("./types").Piece} */
  const para = (text) => ({ tag: "p", children: [words(text)] });
  /** @param {string} text @returns {import("./types").Piece} */
  const head = (text) => ({ tag: "h3", children: [words(text)] });

  /**
   * Der Baum als HTML — dieselbe Quelle, aus der die Leiste ihre Vorschau baut. Es gibt keinen
   * zweiten Weg in den Entwurfskörper; was die Vorschau zeigt, ist genau das hier Geschriebene.
   * @param {import("./types").Piece[]} pieces
   */
  function serialize(pieces) {
    let out = "";
    for (const piece of pieces) {
      if (piece.tag === "#text") {
        out += escapeText(piece.text ?? "").replace(/\r\n|\r|\n/g, "<br>");
        continue;
      }
      const allowed = ALLOWED[piece.tag];
      if (!allowed) continue;
      let attrs = "";
      for (const name of allowed) {
        const value = piece.attrs?.[name];
        if (typeof value === "string") attrs += ` ${name}="${escapeText(value)}"`;
      }
      out += `<${piece.tag}${attrs}>`;
      if (VOID.has(piece.tag)) continue;
      out += `${serialize(piece.children ?? [])}</${piece.tag}>`;
    }
    return out;
  }

  /**
   * Der Inhaltsbaum der Seite, NEU GEBAUT. Fremde Tags, fremde Attribute, fremde Bildadressen und
   * zu tiefe oder zu große Bäume kommen nicht durch; ein Bild ohne sichere Quelle fällt ganz weg,
   * statt als leeres Kästchen im Entwurf zu stehen.
   * DER DECKEL IST EIN GEMEINSAMER VORRAT, KEINE GRENZE JE KNOTEN. Eine Grenze je Textknoten
   * hätte genau eine Markierung von 200.000 Zeichen — die größte, die B0 ausdrücklich zulässt —
   * still auf ihren ersten Knoten gekürzt: der Entwurf sähe vollständig aus und wäre es nicht.
   * Gemessen vor der Korrektur: der Körper trug 20.000 statt 200.000 Zeichen, und kein Test sah
   * es. Der Vorrat deckelt jetzt die SUMME und lässt jede zulässige Übernahme ganz durch.
   * @param {unknown} raw @param {{left: number, chars: number}} budget @param {number} depth
   * @returns {import("./types").Piece[]}
   */
  function clean(raw, budget, depth) {
    if (!Array.isArray(raw) || depth > MAX_PIECE_DEPTH) return [];
    /** @type {import("./types").Piece[]} */
    const out = [];
    for (const item of raw) {
      if (budget.left <= 0 || budget.chars <= 0) break;
      if (!item || typeof item !== "object") continue;
      const tag = /** @type {{tag?: unknown}} */ (item).tag;
      const source =
        /** @type {{text?: unknown, attrs?: Record<string, unknown>, children?: unknown}} */ (item);
      if (tag === "#text") {
        if (typeof source.text !== "string" || !source.text) continue;
        budget.left -= 1;
        const text = source.text.slice(0, budget.chars);
        budget.chars -= text.length;
        out.push({ tag: "#text", text });
        continue;
      }
      if (typeof tag !== "string" || !Object.hasOwn(ALLOWED, tag)) continue;
      /** @type {Record<string, string>} */
      const attrs = {};
      for (const name of ALLOWED[tag] ?? []) {
        const value = source.attrs?.[name];
        if (typeof value !== "string") continue;
        if (name === "src" && !IMAGE_SRC.test(value)) continue;
        if ((name === "colspan" || name === "rowspan") && !SPAN.test(value)) continue;
        attrs[name] = name === "alt" ? value.slice(0, SOURCE_LABEL) : value;
      }
      if (tag === "img" && !attrs.src) continue;
      budget.left -= 1;
      const children = VOID.has(tag) ? [] : clean(source.children, budget, depth + 1);
      if (!VOID.has(tag) && children.length === 0) continue;
      /** @type {import("./types").Piece} */
      const built = { tag };
      if (Object.keys(attrs).length > 0) built.attrs = attrs;
      if (!VOID.has(tag)) built.children = children;
      out.push(built);
    }
    return out;
  }

  /** @param {import("./types").Piece[]} pieces */
  function countImages(pieces) {
    let total = 0;
    for (const piece of pieces)
      total += piece.tag === "img" ? 1 : countImages(piece.children ?? []);
    return total;
  }

  /** @param {unknown} raw @returns {import("./types").Variant} */
  function cleanVariant(raw) {
    const source = /** @type {Record<string, unknown>} */ (
      raw && typeof raw === "object" ? raw : {}
    );
    const nodes = clean(source.nodes, { left: MAX_PIECES, chars: MAX_SELECTION }, 0);
    const gaps = (Array.isArray(source.gaps) ? source.gaps : [])
      .slice(0, MAX_GAPS)
      .filter(
        (gap) =>
          gap &&
          typeof gap === "object" &&
          typeof gap.kind === "string" &&
          Object.hasOwn(GAP_TEXT, gap.kind),
      )
      .map((gap) => ({
        kind: String(gap.kind),
        detail: typeof gap.detail === "string" ? gap.detail.slice(0, SOURCE_URL) : "",
      }));
    return {
      available: nodes.length > 0,
      text: typeof source.text === "string" ? source.text.slice(0, MAX_SELECTION) : "",
      nodes,
      gaps,
      images: countImages(nodes),
    };
  }
  /** @param {unknown} raw @returns {import("./types").Variants} */
  function cleanVariants(raw) {
    const source = /** @type {Record<string, unknown>} */ (
      raw && typeof raw === "object" ? raw : {}
    );
    return {
      selection: cleanVariant(source.selection),
      article: cleanVariant(source.article),
      page: cleanVariant(source.page),
      // Die SEITE liefert diesen Umfang nie mit — er entsteht allein durch das Einfügen. Er wird
      // hier trotzdem gebaut, damit die Leiste ihn von Anfang an als „nicht vorhanden" anzeigen
      // kann statt als fehlendes Feld.
      clipboard: cleanVariant(source.clipboard),
    };
  }
  /**
   * JOB 3280 · CHR-06: der eingefügte Text als Umfang. Absätze trennt eine LEERZEILE; einfache
   * Zeilenumbrüche bleiben im Absatz (`serialize` macht `<br>` daraus, die Vorschau ebenso).
   * Der Text wird NICHT als Markup gedeutet — er kommt aus der Zwischenablage und ist Fremddatum
   * wie jeder Seiteninhalt. Wird an der Grenze gekürzt, sagt die Lückenliste das ausdrücklich.
   * @param {string} raw @returns {import("./types").Variant}
   */
  function clipboardVariant(raw) {
    const text = raw.slice(0, MAX_SELECTION);
    const nodes = text
      .split(/\r?\n[ \t]*\r?\n/)
      .map((teil) => teil.trim())
      .filter((teil) => teil.length > 0)
      .slice(0, MAX_PIECES)
      .map(para);
    return {
      available: nodes.length > 0,
      text,
      nodes,
      gaps: raw.length > text.length ? [{ kind: "truncated", detail: String(raw.length) }] : [],
      images: 0,
    };
  }
  /** @param {unknown} value @returns {value is import("./types").Mode} */
  const isMode = (value) => typeof value === "string" && MODES.some((mode) => mode === value);
  const LEER = { available: false, text: "", nodes: [], gaps: [], images: 0 };
  /**
   * Der gewählte Umfang — oder der leere, solange keiner gewählt ist. Kein Rückfall auf
   * „Markierung": ein nicht gewählter Umfang darf nicht wie eine Wahl aussehen (bens Befund 3).
   * @param {import("./types").Work} work @returns {import("./types").Variant}
   */
  function chosen(work) {
    if (!isMode(work.mode)) return LEER;
    return work.variants?.[work.mode] ?? LEER;
  }

  /**
   * Der vollständige Entwurfskörper als Baum: Herkunft, Kontext, die ehrliche Lückenliste und der
   * übernommene Inhalt — in dieser Reihenfolge, damit der Inhalt zuletzt steht.
   * @param {import("./types").Work} work @param {import("./types").Form} form
   * @returns {import("./types").Piece[]}
   */
  function bodyPieces(work, form) {
    const s = work.selection;
    const variant = chosen(work);
    const clip = work.mode === "clipboard";
    const provenance = `Browser / ${new URL(s.url).hostname}`;
    /** @type {Record<string, string>} */
    const classifications = {
      "": "Offen / Not classified",
      intern: "Intern / Internal",
      vertraulich: "Vertraulich / Confidential",
      streng_vertraulich: "Streng vertraulich / Strictly confidential",
    };
    /** @type {import("./types").Piece[]} */
    const out = [
      { tag: "h2", children: [words(form.title)] },
      para(`${provenance} · Ungeprüfter Entwurf / Unreviewed draft`),
    ];
    // JOB 3280: bei eingefügtem Text steht die ANGABE DER PERSON an der Stelle, an der sonst die
    // gemessene Kennzeichnung der Seite steht — und die Adresse heisst dann „Tab", nicht „Quelle".
    // Eine Zwischenablage kann von überall kommen; die Seite daneben zu benennen wäre eine
    // Herkunftsbehauptung, für die es keinen Beleg gibt.
    if (clip)
      out.push(
        para(
          `Herkunft (Angabe der Person) / Origin (stated by the person): ${originText(work, form)}`,
        ),
        para(
          "Aus der Zwischenablage eingefügt; der Browser kann die Herkunft nicht prüfen / Pasted from the clipboard; the browser cannot verify its origin",
        ),
      );
    else if (aiChat(s.url)) out.push(para("KI-Chat, ungeprüft / AI chat, unverified"));
    out.push(
      para(`Seite / Page: ${s.title}`),
      clip
        ? // JOB 3280 R2 (Codex 3683da57): die Zeile hiess „Offener Tab beim Einfügen" und nannte
          // dabei `s.url` — die Adresse der ERFASSUNG. Wer nach der Übernahme den Tab wechselt und
          // erst dann einfügt, bekam damit eine Behauptung über einen Augenblick, den niemand
          // gemessen hat. Der Tab beim Einfügen wäre neu zu messen; das ginge nur mit dem Recht
          // `tabs` (die Leiste hat es nicht, und `activeTab` gilt nur zur Klickgeste am Symbol).
          // Also steht hier jetzt der Augenblick, der WIRKLICH belegt ist — derselbe, den die
          // Zeile „Erfasst" darunter datiert.
          para(`Bei der Erfassung verwendeter Tab / Tab used at capture: ${s.url}`)
        : para(`Ursprüngliche Quelle / Original source: ${s.url}`),
      para(`Erfasst / Captured: ${s.capturedAt}`),
      para(`Umfang / Scope: ${SCOPE_TEXT[work.mode] ?? SCOPE_TEXT[""]}`),
      para(`Vertraulichkeit / Confidentiality: ${classifications[form.confidentiality]}`),
      clip
        ? para("Eingefügter Text, kein unabhängiger Beleg / Pasted text, not independent evidence")
        : para("Quellseite, kein unabhängiger Beleg / Source page, not independent evidence"),
    );
    if (variant.images > 0)
      out.push(
        para(
          "Bilder sind Kopien der angezeigten Darstellung, nicht die Originaldateien / Images are copies of the rendered view, not the original files",
        ),
      );
    out.push(head("Kontext / Context"), para(form.context));
    if (variant.gaps.length > 0)
      out.push(head("Nicht übernommen / Not captured"), {
        tag: "ul",
        children: variant.gaps.map((gap) => ({
          tag: "li",
          children: [
            words(gap.detail ? `${GAP_TEXT[gap.kind]}: ${gap.detail}` : GAP_TEXT[gap.kind]),
          ],
        })),
      });
    out.push(head("Übernommener Inhalt / Captured content"), ...variant.nodes);
    return out;
  }

  /**
   * Die Herkunftsangabe im Klartext. Nennt der Mensch einen KI-Chat UND ist der offene Tab
   * wirklich einer, steht dessen Name dabei — abgelesen vom Host, nicht erfunden.
   * @param {import("./types").Work} work @param {import("./types").Form} form
   */
  function originText(work, form) {
    const base = ORIGIN_TEXT[form.origin] ?? "Nicht angegeben / Not stated";
    return form.origin === "ki_chat" && aiChat(work.selection.url)
      ? `${base} (${new URL(work.selection.url).hostname})`
      : base;
  }
  /**
   * JOB 3280: das Formular in EINER Gestalt. `origin` ist an der Nachrichtengrenze optional — die
   * Wege aus JOB 3278/3279 kennen das Feld nicht und sollen unverändert weiterlaufen —, im
   * gespeicherten Zustand ist es immer vorhanden. Ein fehlendes Feld heisst „nicht angegeben".
   * @param {Partial<import("./types").Form> | undefined} form @returns {import("./types").Form}
   */
  const einheitlich = (form) => ({
    title: form?.title ?? "",
    context: form?.context ?? "",
    confidentiality: form?.confidentiality ?? "",
    origin: form?.origin ?? "",
  });
  /** @param {import("./types").Work} work @param {import("./types").Form | undefined} form @returns {import("./types").Payload} */
  function payload(work, form) {
    if (
      !form ||
      typeof form.title !== "string" ||
      !form.title.trim() ||
      form.title.length > 90 ||
      typeof form.context !== "string" ||
      form.context.length > 4000 ||
      !["", "intern", "vertraulich", "streng_vertraulich"].includes(form.confidentiality) ||
      !ORIGINS.includes(form.origin)
    )
      throw new Error("invalid_form");
    const s = work.selection;
    const clip = work.mode === "clipboard";
    const variant = chosen(work);
    if (!variant.available) throw new Error("empty");
    // Eingefügter Text OHNE Herkunftsangabe wird nicht gespeichert: der Entwurfskörper trüge sonst
    // „Nicht angegeben" an der einzigen Stelle, die über die Herkunft überhaupt etwas sagen kann.
    if (clip && !form.origin) throw new Error("origin_missing");
    const provenance = `Browser / ${new URL(s.url).hostname}`;
    return {
      title: form.title,
      statement: variant.text,
      bodyHtml: serialize(bodyPieces(work, form)),
      pendingSources: [
        // Beim eingefügten Text FEHLT die Adresse bewusst. Der offene Tab ist nicht die Quelle;
        // ihn hier einzutragen hiesse, in der Quellenliste von Klarwerk eine Herkunft zu
        // behaupten, die niemand gemessen hat. Er steht im Körper, ausdrücklich als Tab benannt.
        clip
          ? {
              label: "Zwischenablage / Clipboard",
              excerpt: variant.text.slice(0, EXCERPT),
              sourceProvider: "Browser",
            }
          : {
              label: provenance,
              url: s.url,
              excerpt: variant.text.slice(0, EXCERPT),
              sourceProvider: "Browser",
            },
      ],
      ...(form.confidentiality ? { confidentiality: form.confidentiality } : {}),
    };
  }
  async function read() {
    await ready;
    return chrome.storage.session.get(null);
  }
  /** @param {import("./types").Work} work */
  async function put(work) {
    await chrome.storage.session.set({ work });
  }
  /** @param {Zustand} state @param {string} [status] @returns {Sicht} */
  function view(state, status) {
    const w = state.work;
    return {
      status:
        status ??
        w?.status ??
        (state.captureStatus && state.captureStatus !== "preview"
          ? state.captureStatus
          : "no_selection"),
      pendingCapture: state.pendingCapture === true,
      // JOB 3524 · Lieferung 3+4: DASS eine neue Übernahme von hier aus überhaupt beginnen kann.
      // Sie braucht einen Tab (laufende Übernahme oder zuletzt gelesener); ohne einen steht in der
      // Leiste kein Knopf, der nichts tun könnte. Die Zusage ist bewusst schwach: „es gibt einen
      // Tab", nicht „das Lesen wird gelingen" — das entscheidet sich erst am Zugriff (s. oben).
      canCapture: Boolean(state.work?.selection || state.lastTab),
      ...(state.auth ? { user: { id: state.auth.id, email: state.auth.email } } : {}),
      ...(w
        ? {
            captureId: w.id,
            selection: w.selection,
            variants: w.variants,
            mode: w.mode,
            aiChat: aiChat(w.selection.url),
            // Die Vorschau IST der Entwurfskörper, nicht seine Beschreibung.
            preview: bodyPieces(w, w.form),
            gaps: chosen(w).gaps,
            form: w.form,
            sourceChanged: state.sourceChangedId === w.id,
            attempted: w.operations.length > 0,
            // JOB 3280 R3: DASS eine Anlage unklar ist. Die Leiste hält daran den Inhalt still und
            // sagt, was das nächste Sichern tun wird — sie behauptet dabei keinen Entwurf.
            unresolvedCreate: Boolean(w.pendingCreate),
            // JOB 3280 · CHR-07: DASS es einen Entwurf gibt, ist eine andere Aussage als „er ist
            // bestätigt und dieser Link führt hin". Die Kennung reist deshalb ohne Adresse mit —
            // die Leiste sagt damit „hier liegen ungesicherte Änderungen", baut aber keinen Link
            // daraus. Der entsteht weiter NUR aus einem frisch nachgelesenen Entwurf, unten.
            ...(w.draftId ? { draftId: w.draftId } : {}),
            // A stored receipt alone never produces a success claim or usable link.
            // JOB 3280: `updated` ist derselbe bestätigte Zustand wie `saved`, nur die zweite
            // Fassung — er trägt denselben Link auf DIESELBE Kennung.
            ...(w.status === "saved" && ["saved", "updated"].includes(status ?? "") && w.receipt
              ? { link: `${HOST}/capture/frontdoor?draft=${encodeURIComponent(w.receipt)}` }
              : {}),
          }
        : {}),
    };
  }
  const DRAFT_ID = /^[\w-]{1,128}$/;
  /** @param {"login" | "logout" | "save" | "read" | "update"} kind @param {import("./types").Auth | null} auth @param {object | null} [body] @param {string} [id] @returns {Promise<import("./types").Wire | null>} */
  async function api(kind, auth, body, id) {
    // Fixed operation table. No URL/method/headers from messages or page data.
    const paths = {
      login: "/api/auth/login",
      logout: "/api/auth/logout",
      save: "/api/drafts",
      read: `/api/drafts/${encodeURIComponent(id ?? "")}`,
      // JOB 3280 · CHR-07: derselbe Entwurf, zweite Fassung. PUT statt eines zweiten POST — genau
      // das ist der Unterschied zwischen „ein Vorgang" und „zwei Entwürfe im Bestand".
      update: `/api/drafts/${encodeURIComponent(id ?? "")}`,
    };
    /** @type {Record<string, string>} */
    const methods = { login: "POST", logout: "POST", save: "POST", read: "GET", update: "PUT" };
    if (
      !Object.hasOwn(paths, kind) ||
      ((kind === "read" || kind === "update") && !DRAFT_ID.test(id ?? ""))
    )
      throw new Error("invalid_message");
    const response = await fetch(HOST + paths[kind], {
      method: methods[kind] ?? "POST",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "expired"
          : response.status === 403
            ? "denied"
            : response.status === 409
              ? "conflict"
              : response.status === 413
                ? "too_large"
                : response.status === 429
                  ? "rate_limited"
                  : response.status >= 500
                    ? "server_error"
                    : "rejected",
      );
    if (kind === "logout") return null;
    if (
      (kind === "save" && ![200, 201].includes(response.status)) ||
      (kind !== "save" && response.status !== 200)
    )
      throw new Error("uncertain");
    return response.json();
  }
  /** @param {import("./types").State} state @param {unknown} error */
  async function failure(state, error) {
    const code = error instanceof Error ? error.message : "uncertain";
    const known = [
      "expired",
      "denied",
      "conflict",
      "too_large",
      "rate_limited",
      "server_error",
      "rejected",
      "invalid_form",
      "uncertain",
      "verify_failed",
      "operation_limit",
      "empty",
      // JOB 3280: eingefügter Text ohne Herkunftsangabe, und die Einstufung, die von hier aus
      // nicht mehr zurückgenommen werden kann. Beide sind Nutzerlagen mit einem klaren nächsten
      // Schritt — sie dürfen nicht als „uncertain" verschwinden.
      "origin_missing",
      "classification_locked",
      // JOB 3280 R3: die unklare Erstanlage, die sich nicht mehr zeichengleich wiederholen lässt.
      // Sie ist eine Nutzerlage mit klarem nächsten Schritt und darf nicht als „uncertain" enden.
      "unresolved_create",
    ];
    const status = known.includes(code) ? code : "uncertain";
    if (status === "expired") await chrome.storage.session.set({ auth: null });
    if (state.work) {
      state.work.status = status;
      await put(state.work);
    }
    return view(await read(), status);
  }
  /**
   * JOB 3279: Der Server verankert Bildhüllen beim Sanitisieren (`data-image-id`, sanitize.ts
   * anchorFigures). Genau dieses eine Attribut kommt also zurück, ohne dass jemand den Inhalt
   * angefasst hätte. Verglichen wird deshalb OHNE den Anker — und sonst Zeichen für Zeichen.
   * @param {string | undefined} html
   */
  const anchorless = (html) => String(html ?? "").replace(/ data-image-id="[^"]*"/g, "");
  /**
   * JOB 3280: verglichen wird gegen das GESENDETE, nicht gegen die Quelle im Zustand. Beim
   * eingefügten Text trägt die Quellenzeile bewusst KEINE Adresse (s. `payload`) — ein Vergleich
   * gegen `work.selection.url` hätte dort auf einer Adresse bestanden, die gar nicht mitging.
   * @param {import("./types").Wire | null} draft @param {import("./types").Payload} sent @param {string} owner @returns {draft is import("./types").ConfirmedDraft}
   */
  function matches(draft, sent, owner) {
    return (
      Boolean(draft) &&
      draft !== null &&
      DRAFT_ID.test(draft.id ?? "") &&
      draft.originalAuthor === owner &&
      anchorless(draft.payload?.bodyHtml) === anchorless(sent.bodyHtml) &&
      draft.payload?.title === sent.title &&
      draft.payload?.confidentiality === sent.confidentiality &&
      draft.payload?.pendingSources?.[0]?.url === sent.pendingSources[0]?.url
    );
  }
  async function stateView() {
    const state = await read();
    if (state.work?.receipt) {
      if (!state.auth) return view(state, "expired");
      try {
        const draft = await api("read", state.auth, null, state.work.receipt);
        if (!matches(draft, payload(state.work, state.work.form), state.auth.id))
          throw new Error("verify_failed");
        // JOB 3280: das frisch Nachgelesene ist der Stand, auf dem die nächste Fassung aufsetzt.
        // Ohne diese Zeile liefe der Vorgangsschutz (`expectedUpdatedAt`) nach einem verlorenen
        // PUT auf einen veralteten Wert und meldete einen Konflikt, den es nicht gibt.
        state.work.draftId = draft.id;
        state.work.updatedAt = typeof draft.updatedAt === "string" ? draft.updatedAt : null;
        state.work.savedLevel = draft.payload?.confidentiality ?? "";
        state.work.status = "saved";
        await put(state.work);
        return view(state, "saved");
      } catch (error) {
        return failure(state, error);
      }
    }
    return view(
      state,
      state.work?.status === "saving" || state.work?.status === "saved" ? "uncertain" : undefined,
    );
  }
  /** @param {import("./types").Message} message @returns {Promise<import("./types").View>} */
  async function dispatch(message) {
    if (
      !message ||
      typeof message !== "object" ||
      ![
        "state",
        "login",
        "logout",
        "edit",
        "mode",
        "clipboard",
        "save",
        "cancel",
        "recapture",
      ].includes(message.type)
    )
      return { status: "invalid_message" };
    if (message.type === "state") {
      if (busy || captureBusy) return view(await read(), "saving");
      busy = true;
      try {
        return await stateView();
      } finally {
        busy = false;
        void nachholen();
      }
    }
    // ==============================================================================================
    // JOB 3524 · Lieferung 3+4 — EINE NEUE ÜBERNAHME BEGINNT AUS DER LEISTE HERAUS.
    // ==============================================================================================
    //
    // DER BEFUND (Pedi am 10.09., Bildschirmfoto 09.18.36): links ein frisch markierter Absatz,
    // rechts die Leiste auf dem zuvor GESPEICHERTEN Artikel und „Markierung · nicht vorhanden"
    // ausgegraut. Der Grund steht in `capture()` weiter unten: solange eine Übernahme im Zustand
    // liegt, wird eine neue NICHT darüber geschrieben — sie wird nur als `pendingCapture` gemerkt.
    // Das ist richtig (eine begonnene Übernahme verschwindet nie von selbst), aber der einzige
    // Ausweg war „Auswahl verwerfen" und danach ein neuer Griff zum Symbol. Pedi hat stattdessen
    // die Erweiterung neu gestartet.
    //
    // Diese Nachricht ist genau dieser Ausweg, als EINE bewusste Handlung: die örtliche Übernahme
    // geht weg, und die Seite wird sofort neu gelesen. Es ist kein zweiter Erfassungsweg — es ist
    // dasselbe `capture()`, das auch Symbol und Kontextmenü rufen.
    //
    // WAS DABEI NICHT GESCHIEHT: kein Netzauftrag, also auch kein Überschreiben und kein Löschen
    // eines bereits gespeicherten Entwurfs. Er liegt auf dem Server und bleibt dort unberührt;
    // die neue Übernahme bekommt eine eigene Kennung und wird beim Sichern ein eigener Entwurf.
    //
    // DIE GRENZE, DIE HIER NICHT MESSBAR IST: `scripting.executeScript` braucht Zugriff auf den
    // Tab. Den hat die Erweiterung aus `activeTab` — erteilt beim Klick auf Symbol oder
    // Kontextmenü, gültig für DIESEN Tab, bis er woanders hin navigiert oder geschlossen wird. Ein
    // Klick in der Leiste erteilt ihn NICHT neu. Solange derselbe Tab offen und unnavigiert ist,
    // trägt der alte Zugriff; danach scheitert der Aufruf, und `capture()` meldet ehrlich
    // `capture_failed` statt still nichts zu tun. Im Prüfstand ist `executeScript` gestellt, dort
    // ist diese Grenze also NICHT nachgewiesen — nur das Verhalten drumherum.
    if (message.type === "recapture") {
      if (busy || captureBusy) return view(await read(), "busy");
      busy = true;
      /** @type {Reiter | undefined} */
      let tab;
      try {
        const state = /** @type {Zustand} */ (await read());
        const s = state.work?.selection;
        // Der Tab der laufenden Übernahme, sonst der zuletzt erfolgreich gelesene. Beides steht im
        // eigenen Zustand — die Leiste hat kein `tabs`-Recht und darf den offenen Tab nicht raten.
        tab = s ? { id: s.tabId, url: s.url, title: s.title } : state.lastTab;
        if (tab)
          await chrome.storage.session.set({
            work: null,
            captureStatus: null,
            pendingCapture: false,
          });
      } finally {
        busy = false;
      }
      if (!tab) {
        void nachholen();
        return view(await read(), "no_tab");
      }
      // NACH der Sperre: `capture()` steigt bei `busy` aus und merkt sich den Wunsch nur — die
      // Leiste bekäme dann eine Antwort, in der die neue Übernahme noch gar nicht steht.
      await capture(tab);
      return view(await read());
    }
    if (busy || captureBusy) return view(await read(), "busy");
    busy = true;
    try {
      const state = await read();
      return await mutate(message, state);
    } finally {
      busy = false;
      void nachholen();
    }
  }
  /** @param {import("./types").Message} message @param {import("./types").State} state @returns {Promise<import("./types").View>} */
  async function mutate(message, state) {
    try {
      if (message.type === "logout") {
        await chrome.storage.session.clear();
        try {
          if (state.auth) await api("logout", state.auth, {});
        } catch {
          return { status: "logged_out_local" };
        }
        return { status: "logged_out" };
      }
      if (message.type === "login") {
        if (state.auth) return view(state, "logout_first");
        if (
          typeof message.email !== "string" ||
          typeof message.password !== "string" ||
          message.email.length > 320 ||
          message.password.length > 1024
        )
          return view(state, "invalid_form");
        const result = await api("login", null, {
          email: message.email.trim(),
          password: message.password,
        });
        if (
          typeof result?.token !== "string" ||
          !result.token ||
          typeof result.user?.id !== "string" ||
          typeof result.user?.email !== "string"
        )
          throw new Error("uncertain");
        const accountChanged = state.work?.owner && state.work.owner !== result.user.id;
        const auth = { token: result.token, id: result.user.id, email: result.user.email };
        if (accountChanged) {
          await chrome.storage.session.clear();
          await chrome.storage.session.set({ auth });
          return view(await read(), "account_changed");
        }
        await chrome.storage.session.set({ auth });
        if (state.work) {
          state.work.owner = auth.id;
          state.work.status = "preview";
          await put(state.work);
        }
        return view(await read(), state.work ? "preview" : "no_selection");
      }
      if (!state.work || message.captureId !== state.work.id) return view(state, "stale_preview");
      if (message.type === "cancel") {
        // Cancel never sends a draft request. A prior uncertain request cannot be undone.
        const uncertain = state.work.operations.length > 0;
        await chrome.storage.session.set({
          work: null,
          captureStatus: null,
          pendingCapture: false,
        });
        return view(await read(), uncertain ? "cancelled_uncertain" : "cancelled");
      }
      // ==========================================================================================
      // JOB 3280 R3 — SOLANGE EINE ANLAGE UNKLAR IST, STEHT DER INHALT STILL.
      // ==========================================================================================
      //
      // Der unklare Vorgang wird durch WIEDERHOLUNG geklärt (`aufloesen`), und wiederholen heisst
      // zeichengleich: nur dieselbe Ladung unter demselben Schlüssel beantwortet der Server mit
      // demselben Entwurf statt mit einem zweiten. Ein anderer Umfang oder ein anderer eingefügter
      // Text machte genau das unmöglich — und der einzige verbliebene Ausweg wäre wieder eine
      // zweite Anlage. Also bleibt der Inhalt stehen, sichtbar und vollständig; die ANGABEN
      // (Titel, Kontext, Einstufung, Herkunft) bleiben bearbeitbar, denn sie gehen nach der
      // Klärung per PUT in denselben Entwurf.
      if ((message.type === "mode" || message.type === "clipboard") && state.work.pendingCreate)
        return view(state, "unresolved_create");
      if (message.type === "mode") {
        // Der Umfang wird bewusst gewählt und nie automatisch ausgeweitet: ein Umfang ohne
        // Inhalt bleibt unwählbar, statt eine leere Übernahme zu erlauben.
        //
        // JOB 3524 · Lieferung 2 — GENAU EINE AUSNAHME, UND SIE GILT NUR DEM VIERTEN UMFANG.
        //
        // Die drei Umfänge der SEITE entstehen beim Erfassen oder gar nicht: `article` ohne
        // Artikelbereich wird durch keine Handlung des Menschen noch voll. Der vierte entsteht
        // umgekehrt AUSSCHLIESSLICH durch eine Handlung des Menschen — er ist nach dem Erfassen
        // immer leer. Die Regel „leer bleibt unwählbar" sperrte ihn damit dauerhaft: wählbar wurde
        // er erst durch das Einfügen, und einfügen konnte man nur über die Taste, die ein Recht
        // anfragt. Pedi kam so an das Feld nie ohne Rechtefrage heran (10.09. 08:57).
        //
        // Der leere vierte Umfang ist deshalb wählbar — und BEHAUPTET DABEI NICHTS: die Vorschau
        // wird leer (`chosen()` liefert die leere Variante), `payload()` wirft weiter `empty`, und
        // die Leiste hält den Speicherknopf gesperrt. Gewählt heisst hier „hierhin gehört der
        // Inhalt", nicht „hier ist Inhalt".
        const wanted = message.mode;
        if (
          !isMode(wanted) ||
          (wanted !== "clipboard" && !state.work.variants?.[wanted]?.available)
        )
          return view(state, "invalid_message");
        state.work.mode = wanted;
        state.work.receipt = null;
        state.work.status = "preview";
        await put(state.work);
        return view(state, "preview");
      }
      if (message.type === "clipboard") {
        // JOB 3280 · CHR-06: der eingefügte und danach BEARBEITETE Text. Er kommt ausschliesslich
        // über diese Nachricht herein — der Worker liest die Zwischenablage nie selbst; er hat in
        // einem Service Worker gar keinen Zugriff darauf, und das soll so bleiben.
        if (typeof message.text !== "string" || message.text.length > MAX_SELECTION)
          throw new Error("invalid_form");
        const variant = clipboardVariant(message.text);
        state.work.variants = { ...state.work.variants, clipboard: variant };
        // Leerer Text nimmt den Umfang wieder weg, statt eine leere Übernahme wählbar zu lassen.
        state.work.mode = variant.available
          ? "clipboard"
          : state.work.mode === "clipboard"
            ? ""
            : state.work.mode;
        state.work.receipt = null;
        state.work.status = "preview";
        await put(state.work);
        return view(state, "preview");
      }
      if (message.type === "edit") {
        if (
          !message.form ||
          typeof message.form.title !== "string" ||
          message.form.title.length > 90 ||
          typeof message.form.context !== "string" ||
          message.form.context.length > 4000 ||
          !["", "intern", "vertraulich", "streng_vertraulich"].includes(
            message.form.confidentiality ?? "",
          ) ||
          !ORIGINS.includes(message.form.origin ?? "")
        )
          throw new Error("invalid_form");
        state.work.form = einheitlich(message.form);
        state.work.receipt = null;
        state.work.status = "preview";
        await put(state.work);
        return view(state, "preview");
      }
      const gewollt = einheitlich(message.form);
      const sent = payload(state.work, gewollt);
      if (!state.auth) return view(state, "expired");
      if (state.work.owner && state.work.owner !== state.auth.id)
        return view(state, "account_changed");
      // ==========================================================================================
      // JOB 3280 · CHR-07 — DIE ZWEITE FASSUNG GEHT IN DENSELBEN ENTWURF.
      // ==========================================================================================
      //
      // Bis hierher legte JEDES Speichern einen neuen Entwurf an: eine Änderung erzeugte einen
      // neuen Abdruck, der neue Abdruck einen neuen Vorgangsschlüssel, und der Server sah einen
      // zweiten POST. Wer nach dem Sichern noch ein Wort am Titel änderte, hatte zwei Entwürfe zu
      // einem Vorgang im Bestand — und „In Klarwerk öffnen" führte zum ERSTEN.
      //
      // Sobald ein Entwurf zu dieser Übernahme existiert, ist der Weg deshalb `PUT` auf seine
      // Kennung. Kein `operationId` im Rumpf: der PUT-Weg mischt den Rumpf in den Entwurf
      // (`capture/src/service.ts` mergeDraftPayload), der Schlüssel läge sonst als Nutzlast im
      // gespeicherten Entwurf. Er wird auch nicht gebraucht — ein wiederholtes PUT mit demselben
      // Inhalt ist von sich aus derselbe Vorgang.
      //
      // R3 (bens Korrekturpflicht aus Runde 2): DAS GILT AUCH, WENN DIE ERSTE ANTWORT VERLOREN
      // GING. Bis hierher hing der Schutz an einer Kennung, die es nur mit Antwort gab: blieb sie
      // aus, erzeugte die nächste Bearbeitung einen neuen Abdruck, einen neuen Vorgangsschlüssel —
      // und damit den zweiten Entwurf, den CHR-07 gerade abschaffen sollte. Der unklare Vorgang
      // wird deshalb ZUERST geklärt, bevor irgendetwas Neues hinausgeht.
      if (state.work.pendingCreate) return await aufloesen(state, gewollt, sent, state.auth);
      if (state.work.draftId) return await aktualisiere(state, gewollt, sent, state.auth);
      const fingerprint = await abdruck(sent);
      let operation = state.work.operations.find(
        (op) => op.fingerprint === fingerprint && op.owner === state.auth?.id,
      );
      if (!operation) {
        if (state.work.operations.length >= 100) throw new Error("operation_limit");
        operation = { id: crypto.randomUUID(), fingerprint, owner: state.auth.id };
        state.work.operations.push(operation);
      }
      const body = { ...sent, operationId: operation.id };
      if (new TextEncoder().encode(JSON.stringify(body)).byteLength > MAX_BYTES)
        throw new Error("too_large");
      state.work.form = gewollt;
      state.work.owner = state.auth.id;
      state.work.status = "saving";
      state.work.receipt = null;
      // Persist BEFORE sending; suspension/response loss must retain the operation key.
      // JOB 3280 R3: und nicht nur den Schlüssel, sondern den GANZEN unklaren Vorgang — Schlüssel,
      // Abdruck und die Fassung, die hinausgeht. Nur damit lässt er sich später zeichengleich
      // wiederholen; ein Schlüssel ohne seine Ladung ist nicht wiederholbar.
      state.work.pendingCreate = { id: operation.id, fingerprint, form: gewollt };
      await put(state.work);
      const draft = await anlegen(state.work, state.auth, body, "erstversuch");
      if (!matches(draft, sent, state.auth.id)) throw new Error("verify_failed");
      state.work.receipt = draft.id;
      // JOB 3280: ab hier GEHÖRT dieser Übernahme ein Entwurf. Die Kennung überlebt jede weitere
      // Änderung — nur Verwerfen, Abmelden oder ein Kontowechsel nehmen sie wieder weg.
      state.work.draftId = draft.id;
      // Der Vorgang ist geklärt: er hat einen Entwurf und braucht keine Wiederholung mehr.
      state.work.pendingCreate = null;
      state.work.updatedAt = typeof draft.updatedAt === "string" ? draft.updatedAt : null;
      state.work.savedLevel = gewollt.confidentiality;
      state.work.status = "saved";
      await put(state.work);
      return view(state, "saved");
    } catch (error) {
      return failure(state, error);
    }
  }
  /**
   * Der Abdruck einer Ladung — der Beweis, dass eine Wiederholung wirklich DIESELBE Sendung ist.
   * @param {import("./types").Payload} sent @returns {Promise<string>}
   */
  async function abdruck(sent) {
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(sent)),
    );
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  /**
   * Antworten, die eine Anlage AUSSCHLIESSEN: der Server hat abgewiesen, bevor etwas entstand
   * (400/401/403/413/429). Alles andere — Netz weg, Zeitablauf, 5xx, 409 — lässt offen, ob
   * geschrieben wurde.
   */
  const OHNE_ANLAGE = ["rejected", "expired", "denied", "too_large", "rate_limited"];
  /**
   * JOB 3280 R3: DER EINE WEG, AUF DEM EIN ENTWURF ANGELEGT WIRD — Erstversuch wie Wiederholung.
   *
   * R4 (bens Korrekturpflicht aus Runde 3, von Codex vorher statisch vorhergesagt) — DIE ABWEISUNG
   * DES ERSTVERSUCHS KLÄRT IHN, DIE ABWEISUNG DER WIEDERHOLUNG KLÄRT GAR NICHTS.
   *
   * Bis hierher führten beide dieselbe Bereinigung: eine 429 auf die WIEDERHOLUNG löschte den
   * festgehaltenen Vorgang. Sie sagt aber nur, dass DIESE Anfrage abgewiesen wurde — über den
   * Ausgang der vorher verlorenen Sendung sagt sie nichts. Der Zustand galt danach als geklärt, die
   * nächste Bearbeitung nahm wieder den Anlageweg mit neuem Schlüssel, und der zweite Entwurf war
   * zurück (ben, gemessen: `to have a length of 1 but got 2`).
   *
   * Deshalb: NUR der Erstversuch klärt sich durch seine eigene Abweisung — er ist die einzige
   * Sendung dieses Vorgangs, und wenn der Server sie abweist, ist nichts entstanden. Eine
   * abgewiesene Wiederholung lässt den Vorgang stehen: unklar bleibt unklar, die Inhaltssperre
   * bleibt, und die Wiederholung ist weiterhin möglich (nach 401 nach erneuter Anmeldung). Geklärt
   * wird er allein durch eine eindeutige Auskunft des Servers — die angelegte Kennung.
   * @param {import("./types").Work} work @param {import("./types").Auth} auth @param {object} body
   * @param {"erstversuch" | "wiederholung"} art
   */
  async function anlegen(work, auth, body, art) {
    try {
      return await api("save", auth, body);
    } catch (error) {
      if (
        art === "erstversuch" &&
        OHNE_ANLAGE.includes(error instanceof Error ? error.message : "")
      ) {
        work.pendingCreate = null;
        await put(work);
      }
      throw error;
    }
  }
  /**
   * JOB 3280 R3 · DER UNKLARE VORGANG WIRD GEKLÄRT, BEVOR ETWAS NEUES ENTSTEHT.
   *
   * Wiederholt wird die verlorene Sendung ZEICHENGLEICH und unter ihrem Schlüssel. Der Server
   * beantwortet dieselbe Wiederholung mit demselben Entwurf (`createDraftVorgang`, 200 statt 201);
   * kam die erste Sendung nie an, legt er sie jetzt an (201). Beide Wege enden bei EINEM Entwurf,
   * und erst danach geht die gewollte Fassung per PUT dort hinein.
   *
   * Stimmt der Abdruck der Wiederholung nicht mit dem festgehaltenen überein, wird NICHTS gesendet:
   * eine andere Ladung unter demselben Schlüssel bekäme 409, eine andere unter neuem Schlüssel wäre
   * der zweite Entwurf. Dann steht die Lage da, statt still eine von beiden zu wählen.
   * @param {import("./types").State} state @param {import("./types").Form} gewollt
   * @param {import("./types").Payload} sent @param {import("./types").Auth} auth
   * @returns {Promise<import("./types").View>}
   */
  async function aufloesen(state, gewollt, sent, auth) {
    const work = state.work;
    const offen = work?.pendingCreate;
    if (!work || !offen) throw new Error("uncertain");
    const wieder = payload(work, offen.form);
    if ((await abdruck(wieder)) !== offen.fingerprint) throw new Error("unresolved_create");
    work.status = "saving";
    work.receipt = null;
    await put(work);
    const draft = await anlegen(work, auth, { ...wieder, operationId: offen.id }, "wiederholung");
    if (!matches(draft, wieder, auth.id)) throw new Error("verify_failed");
    work.draftId = draft.id;
    work.receipt = draft.id;
    work.updatedAt = typeof draft.updatedAt === "string" ? draft.updatedAt : null;
    work.savedLevel = offen.form.confidentiality;
    work.pendingCreate = null;
    work.status = "saved";
    await put(work);
    // War die gewollte Fassung genau die geklärte, ist hier Schluss — kein PUT ohne Änderung.
    if (JSON.stringify(sent) === JSON.stringify(wieder)) return view(state, "saved");
    return await aktualisiere(state, gewollt, sent, auth);
  }
  /**
   * JOB 3280 · CHR-07: die zweite und jede weitere Fassung DESSELBEN Entwurfs.
   * @param {import("./types").State} state @param {import("./types").Form} form
   * @param {import("./types").Payload} sent @param {import("./types").Auth} auth
   * @returns {Promise<import("./types").View>}
   */
  async function aktualisiere(state, form, sent, auth) {
    const work = state.work;
    if (!work?.draftId) throw new Error("uncertain");
    // DIE EINE LAGE, DIE DER PUT-WEG NICHT KANN, UND SIE WIRD BENANNT.
    //
    // `PUT /api/drafts/:id` mischt (mergeDraftPayload): ein NICHT mitgeschicktes Feld behält seinen
    // Altwert, und `confidentiality: ""` ist am Serverschema keine Stufe, sondern ein Formfehler
    // (capture/src/draft-payload-schema.ts:108-114). Eine einmal gespeicherte Einstufung lässt sich
    // von hier aus also nicht auf „Offen" zurücknehmen. Statt sie still stehen zu lassen und dabei
    // „gespeichert" zu melden, bricht der Weg hier ab und sagt, wo es geht: in Klarwerk selbst.
    if (!form.confidentiality && work.savedLevel) throw new Error("classification_locked");
    if (new TextEncoder().encode(JSON.stringify(sent)).byteLength > MAX_BYTES)
      throw new Error("too_large");
    work.form = form;
    work.owner = auth.id;
    work.status = "saving";
    // Die Kennung bleibt stehen, wo sonst `null` steht: geht die Antwort verloren, kann „Status
    // erneut prüfen" den Entwurf nachlesen und entscheiden, ob das PUT angekommen ist. Der Link
    // entsteht daraus NICHT — `view()` gibt ihn nur bei bestätigtem `saved`.
    work.receipt = work.draftId;
    await put(work);
    const draft = await api(
      "update",
      auth,
      // `expectedUpdatedAt` ist der Stand, den DIESE Leiste zuletzt gesehen hat. Hat inzwischen
      // jemand denselben Entwurf in Klarwerk bearbeitet, gibt es 409 statt eines stillen
      // Überschreibens (capture/src/service.ts pruefeStand).
      { ...sent, ...(work.updatedAt ? { expectedUpdatedAt: work.updatedAt } : {}) },
      work.draftId,
    );
    if (!matches(draft, sent, auth.id) || draft.id !== work.draftId)
      throw new Error("verify_failed");
    work.receipt = draft.id;
    work.updatedAt = typeof draft.updatedAt === "string" ? draft.updatedAt : null;
    work.savedLevel = form.confidentiality;
    work.status = "saved";
    await put(work);
    return view(state, "updated");
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("panel.html")) {
      respond({ status: "forbidden_sender" });
      return false;
    }
    dispatch(message).then(respond, () => respond({ status: "storage_error" }));
    return true;
  });
  // ================================================================================================
  // JOB 3280 (Codex 4368959e, Rest aus 3279 R3) — EINE ERFASSUNG WIRD NIE STILL VERWORFEN.
  // ================================================================================================
  //
  // DER BEFUND: `capture()` stieg bei `busy || captureBusy` wortlos aus. Wer den Rechtsklick
  // benutzt, während die Leiste gerade den Zustand abfragt oder speichert, verlor die Übernahme
  // vollständig — kein Inhalt, keine Meldung, nichts. Das Fenster ist klein, aber genau in ihm
  // liegt der Aufbau der Leiste (die letzte Zeile von `panel.js` fragt mit Sperre ab).
  //
  // Der Wunsch wird deshalb GEMERKT und nach dem laufenden Vorgang genau einmal nachgeholt —
  // dieselbe Bauform wie `nachholen()`/`erledigt()` in der Leiste. Nur der ZULETZT geäusserte
  // Wunsch wird behalten: zwei Übernahmen hintereinander sind eine Absichtsänderung, keine
  // Warteschlange, und die zweite ist die gemeinte.
  /** @type {{tab: {id?: number, url?: string, title?: string} | undefined, info: {frameUrl?: string, pageUrl?: string, frameId?: number, selectionText?: string} | undefined} | null} */
  let gemerkt = null;
  async function nachholen() {
    const wartend = gemerkt;
    if (!wartend || busy || captureBusy) return;
    gemerkt = null;
    await capture(wartend.tab, wartend.info);
  }
  /** @param {{id?: number, url?: string, title?: string} | undefined} tab @param {{frameUrl?: string, pageUrl?: string, frameId?: number, selectionText?: string}} [info] */
  async function capture(tab, info) {
    if (captureBusy || busy) {
      gemerkt = { tab, info };
      return;
    }
    captureBusy = true;
    try {
      const state = await read();
      // Never overwrite a pending selection with another tab's content.
      if (state.work) {
        await chrome.storage.session.set({ pendingCapture: true });
        return;
      }
      const source = info?.frameUrl ?? info?.pageUrl ?? tab?.url;
      let status = "unsupported";
      if (tab?.id !== undefined && supported(source) && (!info?.frameId || info.frameId === 0)) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["selection.js"],
          });
          const s = results[0]?.result;
          if (
            s &&
            supported(s.url) &&
            s.url === source &&
            typeof s.text === "string" &&
            typeof s.title === "string"
          ) {
            const variants = cleanVariants(s.variants);
            const nothing =
              !s.text.trim() && !variants.article.available && !variants.page.available;
            status = nothing
              ? "empty"
              : s.text.length > MAX_SELECTION ||
                  s.url.length > SOURCE_URL ||
                  s.title.length > SOURCE_LABEL ||
                  `Browser / ${new URL(s.url).hostname}`.length > SOURCE_LABEL
                ? "selection_too_large"
                : "preview";
            if (status === "preview") {
              const selection = {
                text: s.text,
                url: s.url,
                title: s.title,
                capturedAt: new Date().toISOString(),
                tabId: tab.id,
              };
              // Der Standard ist die Markierung, wenn es eine gibt — sonst der Artikel.
              //
              // JOB 3279 R2 (bens Befund 3): und SONST GAR NICHTS. Vorher fiel der Standard auf
              // „Zugängliche Seite" durch; damit war die ganze Seite samt Navigation und Fußzeile
              // vorbelegt, ohne dass jemand sie gewählt hätte. Der leere Umfang ist ehrlicher: die
              // Leiste zeigt die Wahl, das Speichern bleibt gesperrt, bis Pedi sie trifft.
              const mode = variants.selection.available
                ? "selection"
                : variants.article.available
                  ? "article"
                  : "";
              await put({
                id: crypto.randomUUID(),
                selection,
                variants,
                mode,
                owner: state.auth?.id ?? null,
                form: {
                  title: s.title.slice(0, 90) || "Browser",
                  context: "",
                  confidentiality: "",
                  // JOB 3280: die Herkunft ist eine ANGABE, keine Vorbelegung der Maschine. Die
                  // Leiste schlägt sie beim Einfügen vor; hier steht sie leer.
                  origin: "",
                },
                operations: [],
                status,
                pendingCreate: null,
                draftId: null,
                updatedAt: null,
                savedLevel: "",
                receipt: null,
              });
              // JOB 3524 · Lieferung 3: DER TAB, DEN DIE ERWEITERUNG SCHON EINMAL LESEN DURFTE.
              // Er überlebt das Verwerfen (das setzt nur `work` zurück) und ist damit die einzige
              // Angabe, aus der eine neue Übernahme nach dem Verwerfen überhaupt starten kann —
              // die Leiste hat kein `tabs`-Recht und darf den offenen Tab nicht raten. Abgemeldet
              // wird er mit allem anderen: `logout` ruft `storage.session.clear()`.
              /** @type {Zustand} */
              const merken = { lastTab: { id: tab.id, url: s.url, title: s.title } };
              await chrome.storage.session.set(merken);
            }
          } else status = "source_changed";
        } catch {
          status = "capture_failed";
        }
      }
      await chrome.storage.session.set({ captureStatus: status, pendingCapture: false });
    } finally {
      captureBusy = false;
      await nachholen();
    }
  }
  // JOB 3278 · CHR-02. The panel lives BESIDE the page in Chrome's side panel, never in a tab of
  // its own: the source page stays visible and usable while its selection is reviewed.
  //
  // WHY THIS CALL RUNS FIRST, BEFORE ANY await. `chrome.sidePanel.open()` is gesture-bound —
  // Chrome rejects it once the click that carried the gesture has been handed back to the event
  // loop. Reading session storage first (`read()` awaits `setAccessLevel` and `get`) would spend
  // exactly that gesture, and the panel would silently never appear. So: open, then capture.
  //
  // NO setOptions ANYWHERE. The panel is registered globally in the manifest (`side_panel`), which
  // is what keeps it open across tab switches and keeps it showing the ORIGINALLY captured source.
  // A per-tab `setOptions({ tabId })` would tie it to one tab and undo exactly that.
  /** @param {{id?: number} | undefined} tab */
  function openPanel(tab) {
    if (tab?.id === undefined) return;
    void chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
  chrome.action.onClicked.addListener((tab) => {
    openPanel(tab);
    return capture(tab);
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== "capture") return undefined;
    openPanel(tab);
    return capture(tab, info);
  });
  chrome.runtime.onInstalled.addListener(async () => {
    // Explicitly FALSE, and it must stay false: with `openPanelOnActionClick: true` Chrome opens
    // the panel itself and `action.onClicked` never fires — the icon would open an empty panel and
    // capture nothing. We open the panel ourselves in the listener above and capture in the same
    // gesture.
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: "capture",
      title: chrome.i18n.getMessage("capture"),
      contexts: ["selection"],
      // Menu visibility only; activeTab grants access after an explicit user gesture.
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
  });
  /** @param {number} tabId @param {string} [url] */
  async function changed(tabId, url) {
    const state = await read();
    if (!state.work || busy || captureBusy) return;
    if (tabId !== state.work.selection.tabId || (url && url !== state.work.selection.url)) {
      await chrome.storage.session.set({ sourceChangedId: state.work.id });
    }
  }
  chrome.tabs.onActivated.addListener(({ tabId }) => changed(tabId));
  chrome.tabs.onUpdated.addListener(async (tabId, info) => {
    if (info.url && (await read()).work?.selection.tabId === tabId) await changed(tabId, info.url);
  });
})();

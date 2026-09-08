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
  /** @type {import("./types").Mode[]} */
  const MODES = ["selection", "article", "page"];
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
  };
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
    if (aiChat(s.url)) out.push(para("KI-Chat, ungeprüft / AI chat, unverified"));
    out.push(
      para(`Seite / Page: ${s.title}`),
      para(`Ursprüngliche Quelle / Original source: ${s.url}`),
      para(`Erfasst / Captured: ${s.capturedAt}`),
      para(`Umfang / Scope: ${SCOPE_TEXT[work.mode] ?? SCOPE_TEXT[""]}`),
      para(`Vertraulichkeit / Confidentiality: ${classifications[form.confidentiality]}`),
      para("Quellseite, kein unabhängiger Beleg / Source page, not independent evidence"),
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

  /** @param {import("./types").Work} work @param {import("./types").Form | undefined} form @returns {import("./types").Payload} */
  function payload(work, form) {
    if (
      !form ||
      typeof form.title !== "string" ||
      !form.title.trim() ||
      form.title.length > 90 ||
      typeof form.context !== "string" ||
      form.context.length > 4000 ||
      !["", "intern", "vertraulich", "streng_vertraulich"].includes(form.confidentiality)
    )
      throw new Error("invalid_form");
    const s = work.selection;
    const variant = chosen(work);
    if (!variant.available) throw new Error("empty");
    const provenance = `Browser / ${new URL(s.url).hostname}`;
    return {
      title: form.title,
      statement: variant.text,
      bodyHtml: serialize(bodyPieces(work, form)),
      pendingSources: [
        {
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
  /** @param {import("./types").State} state @param {string} [status] @returns {import("./types").View} */
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
            // A stored receipt alone never produces a success claim or usable link.
            ...(w.status === "saved" && status === "saved" && w.receipt
              ? { link: `${HOST}/capture/frontdoor?draft=${encodeURIComponent(w.receipt)}` }
              : {}),
          }
        : {}),
    };
  }
  /** @param {"login" | "logout" | "save" | "read"} kind @param {import("./types").Auth | null} auth @param {object | null} [body] @param {string} [id] @returns {Promise<import("./types").Wire | null>} */
  async function api(kind, auth, body, id) {
    // Fixed operation table. No URL/method/headers from messages or page data.
    const paths = {
      login: "/api/auth/login",
      logout: "/api/auth/logout",
      save: "/api/drafts",
      read: `/api/drafts/${encodeURIComponent(id ?? "")}`,
    };
    if (!Object.hasOwn(paths, kind) || (kind === "read" && !/^[\w-]{1,128}$/.test(id ?? "")))
      throw new Error("invalid_message");
    const response = await fetch(HOST + paths[kind], {
      method: kind === "read" ? "GET" : "POST",
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
  /** @param {import("./types").Wire | null} draft @param {import("./types").Work} work @param {import("./types").Payload} sent @param {string} owner @returns {draft is import("./types").ConfirmedDraft} */
  function matches(draft, work, sent, owner) {
    return (
      Boolean(draft) &&
      draft !== null &&
      /^[\w-]{1,128}$/.test(draft.id ?? "") &&
      draft.originalAuthor === owner &&
      anchorless(draft.payload?.bodyHtml) === anchorless(sent.bodyHtml) &&
      draft.payload?.title === sent.title &&
      draft.payload?.confidentiality === sent.confidentiality &&
      draft.payload?.pendingSources?.[0]?.url === work.selection.url
    );
  }
  async function stateView() {
    const state = await read();
    if (state.work?.receipt) {
      if (!state.auth) return view(state, "expired");
      try {
        const draft = await api("read", state.auth, null, state.work.receipt);
        if (!matches(draft, state.work, payload(state.work, state.work.form), state.auth.id))
          throw new Error("verify_failed");
        state.work.status = "saved";
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
      !["state", "login", "logout", "edit", "mode", "save", "cancel"].includes(message.type)
    )
      return { status: "invalid_message" };
    if (message.type === "state") {
      if (busy || captureBusy) return view(await read(), "saving");
      busy = true;
      try {
        return await stateView();
      } finally {
        busy = false;
      }
    }
    if (busy || captureBusy) return view(await read(), "busy");
    busy = true;
    try {
      const state = await read();
      return await mutate(message, state);
    } finally {
      busy = false;
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
      if (message.type === "mode") {
        // Der Umfang wird bewusst gewählt und nie automatisch ausgeweitet: ein Umfang ohne
        // Inhalt bleibt unwählbar, statt eine leere Übernahme zu erlauben.
        const wanted = message.mode;
        if (!isMode(wanted) || !state.work.variants?.[wanted]?.available)
          return view(state, "invalid_message");
        state.work.mode = wanted;
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
            message.form.confidentiality,
          )
        )
          throw new Error("invalid_form");
        state.work.form = /** @type {import("./types").Form} */ (message.form);
        state.work.receipt = null;
        state.work.status = "preview";
        await put(state.work);
        return view(state, "preview");
      }
      const sent = payload(state.work, message.form);
      if (!state.auth) return view(state, "expired");
      if (state.work.owner && state.work.owner !== state.auth.id)
        return view(state, "account_changed");
      const fingerprint = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(sent))),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
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
      state.work.form = /** @type {import("./types").Form} */ (message.form);
      state.work.owner = state.auth.id;
      state.work.status = "saving";
      state.work.receipt = null;
      // Persist BEFORE sending; suspension/response loss must retain the operation key.
      await put(state.work);
      const draft = await api("save", state.auth, body);
      if (!matches(draft, state.work, sent, state.auth.id)) throw new Error("verify_failed");
      state.work.receipt = draft.id;
      state.work.status = "saved";
      await put(state.work);
      return view(state, "saved");
    } catch (error) {
      return failure(state, error);
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("panel.html")) {
      respond({ status: "forbidden_sender" });
      return false;
    }
    dispatch(message).then(respond, () => respond({ status: "storage_error" }));
    return true;
  });
  /** @param {{id?: number, url?: string, title?: string} | undefined} tab @param {{frameUrl?: string, pageUrl?: string, frameId?: number, selectionText?: string}} [info] */
  async function capture(tab, info) {
    if (captureBusy || busy) return;
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
                },
                operations: [],
                status,

                receipt: null,
              });
            }
          } else status = "source_changed";
        } catch {
          status = "capture_failed";
        }
      }
      await chrome.storage.session.set({ captureStatus: status, pendingCapture: false });
    } finally {
      captureBusy = false;
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

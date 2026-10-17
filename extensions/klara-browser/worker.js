// Classic MV3 worker; all listeners are registered synchronously. Session storage is
// the only durable state across worker suspension. No automatic POST on startup.
(() => {
  // BPA-01: der Kontextvertrag (`kontext.js`), synchron beim Start geladen. `importScripts` gibt es
  // nur im Worker; ohne ihn (und ohne vorgeladenen Vertrag) bindet die Erweiterung keinen Kontext
  // und sagt das — die Übernahme selbst bleibt davon unberührt.
  /** @typedef {{ importScripts?: (...urls: string[]) => void }} Arbeiter */
  const roh = /** @type {unknown} */ (globalThis);
  const arbeiter = /** @type {Arbeiter} */ (roh);
  if (!globalThis.KlaraKontext && typeof arbeiter.importScripts === "function")
    arbeiter.importScripts("kontext.js");
  const K = globalThis.KlaraKontext;
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
   * JOB 3606 ergänzt hier, aus demselben Grund und mit derselben Abmachung:
   * `pendingTab`/`pendingSource` — die Seite, die eine neue Übernahme wollte, während noch ein
   * offener Vorgang lag; `activeTabId` — der zuletzt gesehene aktive Tab, aus dem `sourceChanged`
   * auch dann folgt, wenn der Merker `sourceChangedId` nie gesetzt wurde; `reason` — der Satz, den
   * der Server seiner Abweisung mitgegeben hat.
   * @typedef {{ id?: number, url?: string, title?: string }} Reiter
   * @typedef {{ url: string, title: string }} Herkunft
   * Nacharbeit 2 (Ben): `skippedCaptures` — wie viele gleichzeitig ausgelöste Erfassungen verdrängt
   * wurden, ohne gelesen zu werden (s. `capture()`). Dieselbe Abmachung wie oben.
   * @typedef {import("./types").State & { lastTab?: Reiter, pendingTab?: Reiter | null, pendingSource?: Herkunft | null, activeTabId?: number, skippedCaptures?: number }} Zustand
   * @typedef {import("./types").View & { canCapture?: boolean, pendingSource?: Herkunft, reason?: string, skippedCaptures?: number }} Sicht
   */
  const ready = chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  /**
   * JOB 3606: EIN Schreibweg in den Sitzungszustand, der die drei neuen Felder mitträgt. Die
   * Signatur des Chrome-Anschlusses in `types.d.ts` kennt nur `State`; `types.d.ts` steht nicht in
   * den Zielpfaden dieses Auftrags (dieselbe Abmachung wie oben bei `Zustand`/`Sicht`). Statt an
   * fünf Aufrufstellen zu tricksen, steht die Erweiterung EINMAL hier. Zieht `Zustand` einmal nach
   * `types.d.ts`, fällt diese Funktion ersatzlos weg.
   * @param {Zustand} zustand
   */
  const merke = (zustand) =>
    chrome.storage.session.set(/** @type {Partial<import("./types").State>} */ (zustand));
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
  // ================================================================================================
  // BPA-02 · TECHNISCHE DATEN AUS DER MARKIERTEN TABELLE.
  // ================================================================================================
  //
  // Der Weg: Markierung in einer Tabelle → `capture()` merkt sich DIESE Tabelle (`technik`) →
  // „Prüfen" schickt sie an `POST /api/technische-daten/vorschau` und erhält Werte, Klärungen und
  // den signierten Vorschaubeleg → „Übernehmen" liest DENSELBEN Tab neu (gleiche Adresse, gleicher
  // Abschnitt), schickt die frische Fassung mit dem Vorschaubeleg an `…/uebernahme` und öffnet den
  // Entwurf über denselben Link wie jede andere Übernahme. Die Seitendaten sind Fremddatum und
  // werden hier Zelle für Zelle neu aufgebaut; der Server rechnet und entscheidet, nicht die Leiste.
  const TECHNIK_ZEILEN = 200;
  const TECHNIK_SPALTEN = 30;
  const TECHNIK_ZELLE = 500;
  const TECHNIK_ANKER = /^[\w.:-]{1,128}$/;
  const SCHUTZKLASSEN = ["", "intern", "vertraulich", "streng_vertraulich"];
  /**
   * Eine Tabelle aus der Seite — oder `null`, wenn sie nicht genau die erwartete Gestalt hat.
   * @param {unknown} raw @returns {import("./types").Tabelle | null}
   */
  function cleanTabelle(raw) {
    if (!raw || typeof raw !== "object") return null;
    const t = /** @type {Record<string, unknown>} */ (raw);
    /** @param {unknown} z */
    const zelle = (z) => typeof z === "string" && z.length <= TECHNIK_ZELLE;
    /** @param {unknown} r */
    const reihe = (r) => Array.isArray(r) && r.length <= TECHNIK_SPALTEN && r.every(zelle);
    const abschnitt = t.abschnitt;
    const anker = t.anker;
    const zeilen = t.zeilen;
    if (
      typeof abschnitt !== "string" ||
      !abschnitt.trim() ||
      abschnitt.length > 300 ||
      typeof anker !== "string" ||
      (anker !== "" && !TECHNIK_ANKER.test(anker)) ||
      !reihe(t.kopf) ||
      !Array.isArray(zeilen) ||
      zeilen.length === 0 ||
      zeilen.length > TECHNIK_ZEILEN ||
      !zeilen.every(reihe)
    )
      return null;
    return {
      abschnitt,
      anker,
      kopf: /** @type {string[]} */ (t.kopf).slice(),
      zeilen: /** @type {string[][]} */ (zeilen).map((r) => r.slice()),
    };
  }
  /**
   * Die markierte Tabelle eines Inhaltsskript-Ergebnisses.
   * @param {import("./types").CaptureResult} s
   */
  function markierteTabelle(s) {
    const liste = Array.isArray(s.tabellen) ? s.tabellen : [];
    const index = typeof s.tabelleGewaehlt === "number" ? s.tabelleGewaehlt : -1;
    return index >= 0 ? cleanTabelle(liste[index]) : null;
  }
  /**
   * Dieselbe Tabelle in einem neuen Lesevorgang — erkannt an ihrem Abschnitt, nie geraten.
   * @param {import("./types").CaptureResult} s @param {string} abschnitt
   */
  function wiedergefunden(s, abschnitt) {
    const liste = Array.isArray(s.tabellen) ? s.tabellen : [];
    for (const roh of liste) {
      const t = cleanTabelle(roh);
      if (t && t.abschnitt === abschnitt) return t;
    }
    return null;
  }
  /**
   * Der Beleg, wie der Server ihn verlangt: Art, Adresse, Abschnitt, Erfassungszeit, Zellen.
   * @param {import("./types").TechnikQuelle} q @param {string} am
   * @returns {import("./types").Beleg}
   */
  function beleg(q, am) {
    return {
      art: q.art,
      url: q.url,
      abschnitt: q.tabelle.abschnitt,
      ...(q.tabelle.anker ? { anker: q.tabelle.anker } : {}),
      titel: q.titel.slice(0, 300),
      abgerufenAm: am,
      kopf: q.tabelle.kopf,
      zeilen: q.tabelle.zeilen,
    };
  }
  /** Höchstens so viele Belege je Übernahme (dieselbe Grenze wie am Server). */
  const TECHNIK_BELEGE = 5;
  /** @param {unknown} art @returns {"html" | "datenblatt"} */
  const belegArt = (art) => (art === "datenblatt" ? "datenblatt" : "html");
  /** @param {import("./types").TechnikQuelle} q */
  const ortVon = (q) => `${q.url}\n${q.tabelle.abschnitt}`;
  /**
   * Die Quelle der markierten Tabelle DIESER Übernahme, als Beleg der gewählten Art.
   * @param {import("./types").Work} w @param {import("./types").Technik} t @param {unknown} art
   * @returns {import("./types").TechnikQuelle}
   */
  function aktuelleQuelle(w, t, art) {
    return {
      tabId: w.selection.tabId,
      url: w.selection.url,
      titel: w.selection.title,
      art: belegArt(art),
      tabelle: t.tabelle,
      erfasstAm: w.selection.capturedAt,
    };
  }
  /**
   * Die bewusst gemerkten weiteren Belege DIESES Kontos (z. B. ein verlinktes Datenblatt in einem
   * anderen Tab) — gehören sie zu einem anderen Konto, gelten sie nicht.
   * @param {Zustand} state @returns {import("./types").TechnikQuelle[]}
   */
  function gemerkte(state) {
    const s = state.technikSammlung;
    return s && state.auth && s.owner === state.auth.id ? s.quellen : [];
  }
  /** Die Lage einer Quelle, zweisprachig wie der Entwurfskörper. @type {Record<string, string>} */
  const LAGE_TEXT = {
    quelle_geaendert: "Quelle geändert / Source changed",
    quelle_nicht_mehr_erreichbar: "Quelle nicht mehr erreichbar / Source no longer reachable",
    unveraendert: "unverändert / unchanged",
  };
  /**
   * Feste Wege zum Server, ohne Adresse aus Nachricht oder Seite. Antwortet auch bei 4xx mit dem
   * Rumpf: die Abweisungen dieses Weges (geänderte Quelle, gesperrte Quelle) tragen den nächsten
   * Schritt in sich.
   * @param {"vorschau" | "uebernahme" | "abgleich" | "rechte"} kind
   * @param {import("./types").Auth} auth
   * @param {object} body
   * @returns {Promise<{ status: number, body: Record<string, unknown> }>}
   */
  async function technikApi(kind, auth, body) {
    const paths = {
      vorschau: "/api/technische-daten/vorschau",
      uebernahme: "/api/technische-daten/uebernahme",
      abgleich: "/api/technische-daten/quellenabgleich",
      rechte: "/api/technische-daten/quellenrechte",
    };
    if (!Object.hasOwn(paths, kind)) throw new Error("invalid_message");
    const response = await fetch(HOST + paths[kind], {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    /** @type {Record<string, unknown>} */
    let inhalt = {};
    try {
      const gelesen = await response.json();
      if (gelesen && typeof gelesen === "object") inhalt = gelesen;
    } catch {
      inhalt = {};
    }
    return { status: response.status, body: inhalt };
  }
  /**
   * Was die Leiste von einer Serverauswertung zeigt — nur Texte, keine Struktur der Seite.
   * @param {Record<string, unknown>} v @returns {import("./types").TechnikErgebnis}
   */
  function ergebnis(v) {
    /** @param {unknown} x @returns {Record<string, unknown>[]} */
    const liste = (x) =>
      Array.isArray(x) ? x.filter((e) => e && typeof e === "object").slice(0, 400) : [];
    /** @param {unknown} x */
    const text = (x) => (typeof x === "string" ? x.slice(0, 600) : "");
    const werte = liste(v.geraete).flatMap((g) => {
      const name = [text(g.modell), text(g.variante)].filter(Boolean).join(" / ");
      return liste(g.werte).map((w) => {
        const n = /** @type {Record<string, unknown> | null} */ (w.normalisierung ?? null);
        let normal = "";
        if (n && typeof n === "object") {
          const zahl = [text(n.von), text(n.bis)].filter(Boolean).join(" … ") || text(n.wert);
          normal = ` → ${zahl} ${text(n.einheit)} (${text(n.formel)})`;
        }
        const status = w.status === "uebernehmbar" ? "" : " · in Klärung";
        // Getrennte Herkunft: jeder Wert nennt den Beleg, aus dem er stammt.
        const h = /** @type {Record<string, unknown>} */ (w.herkunft ?? {});
        const art = h.art === "datenblatt" ? "Datenblatt" : "Webseite";
        const herkunft = text(h.abschnitt) ? ` · ${art} „${text(h.abschnitt)}“` : "";
        const kern = `${name || "?"} · ${text(w.merkmal)}: ${text(w.original)}`;
        return `${kern}${normal}${status}${herkunft}`;
      });
    });
    return {
      werte,
      klaerungen: liste(v.klaerungen).map((k) => text(k.text)),
      abweichungen: liste(v.abweichungen).map((a) => text(a.begruendung)),
    };
  }
  /**
   * Vorschau und Übernahme der technischen Daten. Beide verlangen die Anmeldung und eine
   * markierte Tabelle DIESER Übernahme; die Übernahme verlangt zusätzlich eine geprüfte Vorschau.
   * @param {import("./types").Message} message @param {Zustand} state
   */
  async function technik(message, state) {
    const w = state.work;
    const t = state.technik;
    if (!w || !t || t.captureId !== w.id) return view(state, "technik_none");
    if (message.captureId !== w.id) return view(state, "stale_preview");
    if (!state.auth) return view(state, "expired");
    /** @param {unknown} x */
    const angabe = (x) => (typeof x === "string" ? x.slice(0, 200) : "");
    const objekt = angabe(message.ziel?.objekt);
    const variante = angabe(message.ziel?.variante);
    const ziel = {
      ...(objekt.trim() ? { objekt } : {}),
      ...(variante.trim() ? { variante } : {}),
    };
    /**
     * Gesperrte Quelle ist etwas anderes als ein fehlendes Recht des Kontos.
     * @param {Record<string, unknown>} body
     */
    const verweigert = (body) => (body.error === "QUELLE_GESPERRT" ? "technik_blocked" : "denied");
    const auth = state.auth;
    try {
      // ==========================================================================================
      // WEITERE BELEGE (AC05, Nacharbeit 5): ein ausdrücklich gewähltes Datenblatt oder eine zweite
      // Seite wird in seinem eigenen Tab erfasst und hier GEMERKT — mit Tab, Adresse, Abschnitt und
      // der gewählten Art. Die nächste Prüfung nimmt alle gemerkten Belege zusammen mit der
      // aktuellen Tabelle; jeder bleibt ein eigener Beleg mit eigener Herkunft.
      // ==========================================================================================
      if (message.type === "technik_merken") {
        const neu = aktuelleQuelle(w, t, message.art);
        const bisher = gemerkte(state).filter((q) => ortVon(q) !== ortVon(neu));
        const quellen = [...bisher, neu].slice(-(TECHNIK_BELEGE - 1));
        await merke({ technikSammlung: { owner: auth.id, quellen } });
        return view(/** @type {Zustand} */ (await read()), "technik_gemerkt");
      }
      if (message.type === "technik_leeren") {
        await merke({ technikSammlung: null });
        return view(/** @type {Zustand} */ (await read()), "technik_geleert");
      }
      // ==========================================================================================
      // QUELLENPFLEGE (AC08/AC09, Nacharbeit 5 + 7): die GEBUNDENE Quelle dieser Übernahme wird für
      // jeden Abgleich NEU gelesen — derselbe Tab, dieselbe Adresse, derselbe Abschnitt. Gepflegt
      // wird ausschliesslich mit dieser frischen Lesung, nie mit der gespeicherten Tabelle.
      //   · Tab zeigt eine andere Adresse (Navigation) → Kontextwechsel, nichts gesendet;
      //   · Abschnitt gefunden → Abgleich „vorhanden" mit der aktuellen Fassung;
      //   · Abschnitt fehlt ODER die Quelle ist gar nicht lesbar (Nacharbeit 8: Tab geschlossen,
      //     Seite verschwunden, kein Zugriff) → nichts gesendet, die Leiste fragt: gelöscht,
      //     verschoben oder Zugriff entzogen? Nur „gelöscht" kennzeichnet die Übernahmen als nicht
      //     mehr erreichbar — dafür genügt die GESPEICHERTE Identität der Quelle (Adresse +
      //     Abschnitt), eine erfolgreiche Inhaltslesung ist dann gerade nicht möglich. „Zugriff
      //     entzogen" geht an den Rechteweg (nur die Fachprüfung); „verschoben" ändert nichts.
      // ==========================================================================================
      if (
        message.type === "technik_abgleich" ||
        message.type === "technik_quelle_geloescht" ||
        message.type === "technik_quelle_entzogen"
      ) {
        const gelesen = await neuLesen(w.selection.tabId, w.selection.url, t.tabelle.abschnitt);
        if (gelesen === "navigiert") return view(state, "source_changed");
        const am = new Date().toISOString();
        const ort = aktuelleQuelle(w, t, message.art);
        if (gelesen !== "fehlt" && gelesen !== "unlesbar") {
          // Der Abschnitt ist (wieder) da — gepflegt wird mit genau dieser Lesung.
          return abgleichen(state, t, { ...ort, tabelle: gelesen, erfasstAm: am }, "vorhanden");
        }
        const unlesbar = gelesen === "unlesbar";
        if (message.type === "technik_abgleich" || !t.klaerung) {
          await merke({ technik: { ...t, abgleich: null, klaerung: { am, unlesbar } } });
          return view(
            /** @type {Zustand} */ (await read()),
            unlesbar ? "technik_quelle_unlesbar" : "technik_abschnitt_fehlt",
          );
        }
        if (message.type === "technik_quelle_geloescht")
          return abgleichen(state, t, { ...ort, erfasstAm: am }, "geloescht");
        // Zugriff entzogen: der bestehende Rechteweg — der Server lässt nur die Fachprüfung zu.
        const antwort = await technikApi("rechte", auth, {
          url: w.selection.url,
          abschnitt: t.tabelle.abschnitt,
          ...(t.tabelle.anker ? { anker: t.tabelle.anker } : {}),
          zustand: "entzogen",
        });
        if (antwort.status === 401) return failure(state, new Error("expired"));
        if (antwort.status === 403) return view(state, "technik_rechte_nur_pruefung");
        if (antwort.status !== 200) return view(state, "technik_failed", textAus(antwort.body));
        await merke({ technik: { ...t, klaerung: null } });
        return view(/** @type {Zustand} */ (await read()), "technik_rechte_entzogen");
      }
      if (message.type === "technik_quelle_verschoben") {
        // Verschoben ist keine Löschung: nichts wird gekennzeichnet; die neue Stelle wird erfasst.
        await merke({ technik: { ...t, klaerung: null } });
        return view(/** @type {Zustand} */ (await read()), "technik_verschoben");
      }
      if (message.type === "technik_vorschau") {
        const aktuell = aktuelleQuelle(w, t, message.art);
        const quellen = [
          ...gemerkte(state).filter((q) => ortVon(q) !== ortVon(aktuell)),
          aktuell,
        ].slice(-TECHNIK_BELEGE);
        const belege = quellen.map((q) => beleg(q, q.erfasstAm));
        const antwort = await technikApi("vorschau", auth, { belege, ziel });
        if (antwort.status === 401) return failure(state, new Error("expired"));
        if (antwort.status === 403) return view(state, verweigert(antwort.body));
        const vorschaubeleg = antwort.body.vorschaubeleg;
        if (antwort.status !== 200 || typeof vorschaubeleg !== "string")
          return view(state, "technik_failed", textAus(antwort.body));
        await merke({
          technik: {
            ...t,
            ziel: { objekt, variante },
            quellen,
            belege,
            vorschaubeleg,
            ergebnis: ergebnis(antwort.body),
            entwurfId: null,
            wissensobjektId: null,
            imWissenFreigegeben: false,
          },
        });
        return view(/** @type {Zustand} */ (await read()), "technik_preview");
      }
      // Übernahme: zuerst JEDEN Beleg in SEINEM Tab neu lesen. Andere Adresse → nichts gesendet;
      // Abschnitt nicht mehr da → nichts gesendet, die Leiste sagt es.
      if (!t.vorschaubeleg || !t.belege || !t.quellen || t.quellen.length !== t.belege.length)
        return view(state, "technik_none");
      /** @type {import("./types").TechnikQuelle[]} */
      const neueQuellen = [];
      /** @type {import("./types").Beleg[]} */
      const neueBelege = [];
      for (let i = 0; i < t.quellen.length; i += 1) {
        const q = /** @type {import("./types").TechnikQuelle} */ (t.quellen[i]);
        const alt = /** @type {import("./types").Beleg} */ (t.belege[i]);
        const results = await chrome.scripting.executeScript({
          target: { tabId: q.tabId },
          files: ["selection.js"],
        });
        const s = results[0]?.result;
        if (!s || s.url !== q.url) return view(state, "source_changed");
        const frisch = wiedergefunden(s, q.tabelle.abschnitt);
        if (!frisch) return view(state, "technik_changed");
        // Die neue Lesung liegt immer NACH der geprüften — der Server verlangt genau das.
        const am = new Date(Math.max(Date.now(), Date.parse(alt.abgerufenAm) + 1)).toISOString();
        const neu = { ...q, tabelle: frisch, erfasstAm: am };
        neueQuellen.push(neu);
        neueBelege.push(beleg(neu, am));
      }
      const schutz = SCHUTZKLASSEN.includes(message.schutzklasse ?? "")
        ? (message.schutzklasse ?? "")
        : "";
      const antwort = await technikApi("uebernahme", auth, {
        belege: neueBelege,
        vorschauBelege: t.belege,
        vorschaubeleg: t.vorschaubeleg,
        ziel,
        ...(schutz ? { schutzklasse: schutz } : {}),
      });
      if (antwort.status === 401) return failure(state, new Error("expired"));
      if (antwort.status === 403) return view(state, verweigert(antwort.body));
      if (antwort.status === 409 && antwort.body.error === "QUELLE_GEAENDERT") {
        const v = /** @type {Record<string, unknown>} */ (antwort.body.vorschau ?? {});
        await merke({
          technik: {
            ...t,
            quellen: neueQuellen,
            belege: neueBelege,
            vorschaubeleg: typeof v.vorschaubeleg === "string" ? v.vorschaubeleg : null,
            ergebnis: ergebnis(v),
            entwurfId: null,
          },
        });
        return view(/** @type {Zustand} */ (await read()), "technik_changed");
      }
      // AC06/AC10 (Nacharbeit 5, Ben): dieselbe Fassung ist schon als Wissensobjekt eingereicht —
      // der Server legt keinen Entwurf an und nennt das Objekt. Das ist ein Erfolg, kein Fehler:
      // die Leiste sagt den tatsächlichen Übernahmestand und bietet das Objekt zum Öffnen an.
      const wissen = /** @type {Record<string, unknown>} */ (antwort.body.wissensobjekt ?? {});
      const stand = /** @type {Record<string, unknown>} */ (antwort.body.stand ?? {});
      if (antwort.status === 200 && DRAFT_ID.test(String(wissen.id ?? ""))) {
        const freigegeben = stand.fachlicheFreigabe === "erteilt";
        await merke({
          technik: {
            ...t,
            entwurfId: null,
            wissensobjektId: String(wissen.id),
            imWissenFreigegeben: freigegeben,
          },
          technikSammlung: null,
        });
        return view(
          /** @type {Zustand} */ (await read()),
          freigegeben ? "technik_im_wissen_freigegeben" : "technik_im_wissen",
        );
      }
      const entwurf = /** @type {Record<string, unknown>} */ (antwort.body.entwurf ?? {});
      if (![200, 201].includes(antwort.status) || !DRAFT_ID.test(String(entwurf.id ?? "")))
        return view(state, "technik_failed", textAus(antwort.body));
      await merke({
        technik: { ...t, entwurfId: String(entwurf.id), wissensobjektId: null },
        technikSammlung: null,
      });
      return view(/** @type {Zustand} */ (await read()), "technik_saved");
    } catch {
      return view(state, "technik_failed");
    }
  }
  /**
   * Die gebundene Quelle neu lesen: derselbe Tab, dieselbe Adresse, derselbe Abschnitt.
   *
   * Nacharbeit 8 (Ben): ZWEI verschiedene Lagen, nicht eine.
   *   · `"navigiert"` — der Tab ist lesbar, zeigt aber eine ANDERE Adresse: ein Kontextwechsel.
   *     Darüber lässt sich zu dieser Quelle nichts sagen; es wird nichts gesendet.
   *   · `"unlesbar"` — der Tab liefert gar nichts (geschlossen, Seite verschwunden, Zugriff weg):
   *     Die Quelle selbst ist nicht erreichbar. Das wird geklärt, nicht verschwiegen.
   * @param {number} tabId @param {string} url @param {string} abschnitt
   * @returns {Promise<import("./types").Tabelle | "navigiert" | "unlesbar" | "fehlt">}
   */
  async function neuLesen(tabId, url, abschnitt) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        files: ["selection.js"],
      });
      const s = results[0]?.result;
      if (!s || typeof s.url !== "string") return "unlesbar";
      if (s.url !== url) return "navigiert";
      return wiedergefunden(s, abschnitt) ?? "fehlt";
    } catch {
      return "unlesbar";
    }
  }
  /**
   * Der Abgleich mit dem vorhandenen Wissen — ausschliesslich mit einer FRISCHEN Lesung.
   * @param {Zustand} state @param {import("./types").Technik} t
   * @param {import("./types").TechnikQuelle} quelle @param {"vorhanden" | "geloescht"} zustand
   */
  async function abgleichen(state, t, quelle, zustand) {
    if (!state.auth) return view(state, "expired");
    const antwort = await technikApi("abgleich", state.auth, {
      beleg: beleg(quelle, quelle.erfasstAm),
      zustand,
    });
    if (antwort.status === 401) return failure(state, new Error("expired"));
    if (antwort.status !== 200) return view(state, "technik_failed", textAus(antwort.body));
    /** @param {unknown} x @returns {Record<string, unknown>[]} */
    const liste = (x) => (Array.isArray(x) ? x.filter((e) => e && typeof e === "object") : []);
    const zeile = (/** @type {Record<string, unknown>} */ e) => {
      const art = e.art === "wissensobjekt" ? "Wissen / Knowledge" : "Entwurf / Draft";
      const fassung = typeof e.fassung === "number" ? ` · Fassung ${e.fassung}` : "";
      const lage = LAGE_TEXT[String(e.lage)] ?? String(e.lage ?? "");
      return `${art} „${String(e.titel ?? "").slice(0, 200)}“${fassung} · ${lage}`;
    };
    const abgleich = [...liste(antwort.body.betroffen), ...liste(antwort.body.unveraendert)]
      .slice(0, 50)
      .map(zeile);
    await merke({ technik: { ...t, abgleich, klaerung: null } });
    return view(/** @type {Zustand} */ (await read()), "technik_abgeglichen");
  }
  /**
   * Die Meldung einer Abweisung als eine Zeile — Fremdtext, nie Zustand.
   * @param {Record<string, unknown>} body
   */
  function textAus(body) {
    const text = body.message;
    if (typeof text !== "string") return "";
    const eine = text.replace(/\p{C}+/gu, " ").trim();
    return eine.length > GRUND_MAX ? `${eine.slice(0, GRUND_MAX - 1)}…` : eine;
  }
  async function read() {
    await ready;
    return chrome.storage.session.get(null);
  }
  /** @param {import("./types").Work} work */
  async function put(work) {
    await chrome.storage.session.set({ work });
  }
  /**
   * JOB 3606: ABGESCHLOSSEN — der Entwurf ist angelegt, frisch nachgelesen und bestätigt
   * (`stateView` setzt `draftId`/`updatedAt` erst nach `matches`), und es hängt keine unklare
   * Anlage daran. Ein solcher Vorgang lebt auf dem Server; die Kopie in der Leiste ist nur noch
   * seine Ansicht und darf die nächste Übernahme nicht blockieren. Alles andere — Vorschau,
   * Bearbeitung, gescheitertes oder unklares Sichern — gilt als OFFEN und blockiert weiter, dann
   * aber sichtbar und mit Wahl (s. `capture`).
   * @param {import("./types").Work} work
   */
  const fertig = (work) => work.status === "saved" && Boolean(work.draftId) && !work.pendingCreate;
  /**
   * JOB 3606 · Nachtrag 14:45 — DER ENTWURF IST WEG; DIE KENNUNG WIRD FALLEN GELASSEN, DER TEXT NICHT.
   *
   * Was einmal 404 war, wird nicht wieder angefragt: bliebe `draftId` stehen, ginge JEDES weitere
   * Sichern wieder als `PUT` auf dieselbe tote Kennung und scheiterte gleich — Pedi käme aus der
   * Schleife nie heraus. Also fällt alles weg, was auf den gelöschten Entwurf zeigt, und NUR das:
   * Auswahl, Umfang, Inhalt und das ausgefüllte Formular (`work.form`, `work.variants`) bleiben
   * unangetastet. Das nächste Speichern nimmt damit den Anlageweg — der Text wird ein NEUER Entwurf.
   *
   * `savedLevel` geht mit: es ist die Einstufung des gelöschten Entwurfs und der Grund, aus dem der
   * PUT-Weg „Offen" sperrt (`classification_locked`). Ein neuer Entwurf trägt diese Sperre nicht.
   * `operations` geht mit: diese Vorgangsschlüssel gehören zu dem Entwurf, den es nicht mehr gibt;
   * unter einem alten Schlüssel zu senden hiesse, den Server nach genau diesem Vorgang zu fragen.
   * `pendingCreate` bleibt stehen — eine unklare Anlage ist eine eigene Lage mit eigenem Weg
   * (`aufloesen`); an beiden Aufrufstellen hier ist sie ohnehin null.
   * @param {import("./types").Work} work
   */
  function vergessen(work) {
    work.draftId = null;
    work.receipt = null;
    work.updatedAt = null;
    work.savedLevel = "";
    work.operations = [];
  }
  /** @param {Zustand} state @param {string} [status] @param {string} [grundText] @returns {Sicht} */
  function view(state, status, grundText) {
    const w = state.work;
    const tk = w && state.technik && state.technik.captureId === w.id ? state.technik : null;
    return {
      // JOB 3606 · Befund (c): der Satz des Servers reist NEBEN dem Zustand, nie an seiner Stelle.
      // Die Leiste hängt ihn hinter ihren eigenen Satz; fehlt er, bleibt alles wie bisher.
      ...(grundText ? { reason: grundText } : {}),
      status:
        status ??
        w?.status ??
        (state.captureStatus && state.captureStatus !== "preview"
          ? state.captureStatus
          : "no_selection"),
      pendingCapture: state.pendingCapture === true,
      // JOB 3606 · Befund (a)+(b): WELCHE Seite wartet. Ohne diese Angabe war „Es ist bereits eine
      // Vorschau offen" eine Meldung über nichts Greifbares — mit ihr kann die Leiste die wartende
      // Seite benennen und zur Wahl stellen. Sie steht nur, wenn wirklich eine wartet.
      ...(state.pendingCapture === true && state.pendingSource
        ? { pendingSource: state.pendingSource }
        : {}),
      // Nacharbeit 2 (Ben): verdrängte gleichzeitige Erfassungen werden genannt, nicht verschwiegen.
      ...(typeof state.skippedCaptures === "number" && state.skippedCaptures > 0
        ? { skippedCaptures: state.skippedCaptures }
        : {}),
      // JOB 3524 · Lieferung 3+4: DASS eine neue Übernahme von hier aus überhaupt beginnen kann.
      // Sie braucht einen Tab (laufende Übernahme oder zuletzt gelesener); ohne einen steht in der
      // Leiste kein Knopf, der nichts tun könnte. Die Zusage ist bewusst schwach: „es gibt einen
      // Tab", nicht „das Lesen wird gelingen" — das entscheidet sich erst am Zugriff (s. oben).
      canCapture: Boolean(state.work?.selection || state.lastTab || state.pendingTab),
      ...(state.auth ? { user: { id: state.auth.id, email: state.auth.email } } : {}),
      ...(w
        ? {
            captureId: w.id,
            selection: w.selection,
            variants: w.variants,
            mode: w.mode,
            aiChat: aiChat(w.selection.url),
            // JOB 3606 · Nachtrag 14:53 — DIE VORSCHAU ZEIGT DEN ÜBERNOMMENEN INHALT, SONST NICHTS.
            //
            // Bis hierher stand hier der GANZE Entwurfskörper (`bodyPieces`): Titelzeile, Herkunft,
            // „Seite", „Ursprüngliche Quelle", „Erfasst", „Umfang", „Vertraulichkeit", der
            // Beleghinweis, „Kontext" und die Lückenliste — und erst ganz unten, hinter der
            // Zwischenüberschrift „Übernommener Inhalt", der Text des Menschen. Wer nachsehen
            // wollte, was Klara gelesen hat, musste durch einen technischen Block scrollen.
            //
            // Was GESPEICHERT wird, ist davon unberührt: `payload()` baut den vollen Körper
            // weiterhin aus `bodyPieces` (s. `bodyHtml`). Geändert ist allein die ANSICHT. Die
            // Angaben, die hier herausfallen, sind in der Leiste weiter da — Seite, Quelle,
            // Erfasst, Umfang und die Lücken stehen dort als eigene Felder, nicht als Textwand.
            preview: chosen(w).nodes,
            gaps: chosen(w).gaps,
            form: w.form,
            // JOB 3606 · Befund (b): KEIN STILLER MISCHZUSTAND. Bis hierher hing dieser Satz allein
            // an `sourceChangedId` — einem Merker, den `changed()` bei `busy || captureBusy` gar
            // nicht erst setzt. Ein Tabwechsel während eines Sicherns war damit für immer verloren,
            // und die Leiste zeigte danach den fremden Inhalt, als gehörte er zur offenen Seite.
            // Deshalb zählt jetzt AUCH der zuletzt gesehene aktive Tab: steht er nicht auf dem Tab
            // dieser Übernahme, ist die Herkunft eine andere — und das steht da.
            sourceChanged:
              state.sourceChangedId === w.id ||
              (typeof state.activeTabId === "number" && state.activeTabId !== w.selection.tabId),
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
      // BPA-02: die markierte Tabelle DIESER Übernahme — sonst nichts. Der Link entsteht nur aus
      // der Kennung, die der Server für genau diese Übernahme bestätigt hat.
      ...(tk ? { technik: technikSicht(tk, gemerkte(state)) } : {}),
    };
  }
  /** @param {import("./types").TechnikQuelle} q */
  const quellZeile = (q) =>
    `${q.art === "datenblatt" ? "Datenblatt" : "Webseite"} · ${q.tabelle.abschnitt} · ${q.url}`;
  /**
   * @param {import("./types").Technik} tk @param {import("./types").TechnikQuelle[]} sammlung
   * @returns {import("./types").TechnikSicht}
   */
  function technikSicht(tk, sammlung) {
    return {
      abschnitt: tk.tabelle.abschnitt,
      ziel: tk.ziel,
      geprueft: Boolean(tk.vorschaubeleg),
      belege: (tk.quellen ?? []).map(quellZeile),
      sammlung: sammlung.map(quellZeile),
      ...(tk.ergebnis ? { ergebnis: tk.ergebnis } : {}),
      ...(tk.abgleich ? { abgleich: tk.abgleich } : {}),
      // Der Abschnitt fehlte bei der letzten frischen Lesung — die Leiste fragt nach dem Grund.
      ...(tk.klaerung ? { klaerung: true, klaerungUnlesbar: tk.klaerung.unlesbar === true } : {}),
      ...(tk.entwurfId
        ? { link: `${HOST}/capture/frontdoor?draft=${encodeURIComponent(tk.entwurfId)}` }
        : {}),
      // Die erneute Übernahme fand dieselbe Fassung schon als Wissen — dorthin führt der Link.
      ...(tk.wissensobjektId
        ? {
            wissenLink: `${HOST}/wissen/${encodeURIComponent(tk.wissensobjektId)}`,
            imWissenFreigegeben: tk.imWissenFreigegeben === true,
          }
        : {}),
    };
  }
  const DRAFT_ID = /^[\w-]{1,128}$/;
  // JOB 3606 · Befund (c). Die Obergrenze ist die einer LESBAREN Zeile, nicht die eines Protokolls:
  // die Leiste ist schmal, und ein langer Serverfehler drängt den Inhalt weg.
  const GRUND_MAX = 200;
  /**
   * Die Meldung einer abweisenden Antwort, oder "" — sie ist Fremdtext und wird nie zum Zustand.
   * @param {Response} response @returns {Promise<string>}
   */
  async function grund(response) {
    try {
      const body = await response.json();
      const text = body?.message;
      if (typeof text !== "string") return "";
      // Zeilenumbrüche und Steuerzeichen raus: die Zustandszeile ist EINE Zeile.
      const eine = text.replace(/\p{C}+/gu, " ").trim();
      return eine.length > GRUND_MAX ? `${eine.slice(0, GRUND_MAX - 1)}…` : eine;
    } catch {
      return "";
    }
  }
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
    if (!response.ok) {
      /** @type {Record<number, string>} */
      const codes = {
        401: "expired",
        403: "denied",
        409: "conflict",
        413: "too_large",
        429: "rate_limited",
      };
      // JOB 3606 · Nachtrag 14:45 — 404 IST „GIBT ES NICHT MEHR", NICHT „DEINE ANGABEN SIND FALSCH".
      //
      // Pedi hatte seine Entwürfe in der Weboberfläche gelöscht; die Leiste hielt `work.draftId`
      // aber weiter fest und schickte `PUT /api/drafts/:id`. Der Server antwortete 404
      // (`{ error: "NOT_FOUND", message: "Entwurf nicht gefunden." }`) — und weil 404 hier fehlte,
      // fiel die Antwort in den Sammelfall `rejected`: „Der Server hat abgelehnt. Angaben prüfen."
      // Das schickt den Menschen auf die falsche Fährte: seine Angaben waren tadellos, es gab nur
      // den Entwurf nicht mehr (Codex, im echten Chromium gemessen; der Anlageweg antwortete
      // demselben Stand mit 201).
      //
      // NUR die beiden Wege, die eine Entwurfskennung tragen, deuten 404 so. Eine 404 auf
      // `login`/`logout`/`save` sagt nichts über einen Entwurf aus — sie bleibt der Sammelfall.
      const code =
        response.status === 404 && (kind === "read" || kind === "update")
          ? "draft_missing"
          : (codes[response.status] ?? (response.status >= 500 ? "server_error" : "rejected"));
      const fehler = /** @type {Error & { grund?: string }} */ (new Error(code));
      // JOB 3606 · Befund (c): DER GRUND DER ABWEISUNG GEHÖRT DEM MENSCHEN.
      //
      // `rejected` ist der Sammelfall für alles, was nicht 401/403/409/413/429/5xx ist — in der
      // Praxis die 400 des Anlegewegs. Die Route antwortet dort MIT einer Meldung
      // (`{ error: "BAD_REQUEST", message }`, capture-routes.ts, Gestaltprüfung aus JOB 2690 D1).
      // Bis hierher wurde der Rumpf nie gelesen, und Pedi las „Der Server hat abgelehnt. Angaben
      // prüfen." — ein Satz, der nicht sagt, WELCHE Angabe. Jetzt reist die Meldung mit.
      //
      // Sie ist FREMDTEXT und wird als solcher behandelt: nur ein `message`-Feld vom Typ Text, auf
      // eine Zeile normalisiert, auf `GRUND_MAX` gekürzt, nie als Ersatz für den Zustandssatz,
      // immer als Zusatz dahinter. Nicht lesbar oder leer → die Zeile bleibt wie bisher.
      fehler.grund = await grund(response);
      throw fehler;
    }
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
      // JOB 3606: der Entwurf, den es auf dem Server nicht mehr gibt. Auch er ist eine Nutzerlage
      // mit einem klaren nächsten Schritt — als neuer Entwurf sichern — und kein Ausfall.
      "draft_missing",
    ];
    const status = known.includes(code) ? code : "uncertain";
    // JOB 3606 · Befund (c): die Meldung des Servers, falls die Antwort eine trug.
    const grundText =
      typeof (/** @type {{grund?: unknown}} */ (error)?.grund) === "string"
        ? /** @type {{grund: string}} */ (error).grund
        : "";
    if (status === "expired") await chrome.storage.session.set({ auth: null });
    if (state.work) {
      state.work.status = status;
      await put(state.work);
    }
    return view(await read(), status, grundText);
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
        // JOB 3606: derselbe Fall auf dem Leseweg. „Status erneut prüfen" auf einen gelöschten
        // Entwurf ist eine 404 — auch sie bindet nicht weiter an die tote Kennung, sonst fragte
        // jeder weitere Druck auf denselben Knopf wieder dieselbe.
        if (error instanceof Error && error.message === "draft_missing" && state.work) {
          vergessen(state.work);
          await put(state.work);
        }
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
        // JOB 3606: „Offene Übernahme behalten" — der zweite Ausgang der Nachfrage.
        "keep",
        // BPA-02: technische Daten aus der markierten Tabelle prüfen und übernehmen.
        "technik_vorschau",
        "technik_uebernahme",
        // Nacharbeit 5: weitere Belege merken/verwerfen und die Quelle mit dem Wissen abgleichen.
        "technik_merken",
        "technik_leeren",
        "technik_abgleich",
        // Nacharbeit 7: die Klärung eines fehlenden Abschnitts — gelöscht, verschoben, entzogen.
        "technik_quelle_geloescht",
        "technik_quelle_verschoben",
        "technik_quelle_entzogen",
      ].includes(message.type)
    )
      return { status: "invalid_message" };
    // Er sendet nichts, ändert den offenen Vorgang nicht und braucht keine Kennung: er räumt allein
    // die Nachfrage weg, die `capture()` gestellt hat. Die neue Auswahl bleibt ungelesen — genau
    // das hat der Mensch hier gewählt.
    if (message.type === "keep") {
      if (busy || captureBusy) return view(await read(), "busy");
      // Nacharbeit 2: die Lage ist beantwortet — der Hinweis auf verdrängte Erfassungen ist gesehen.
      uebergangen = 0;
      await merke({
        pendingCapture: false,
        pendingTab: null,
        pendingSource: null,
        skippedCaptures: 0,
      });
      return view(await read());
    }
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
        // JOB 3606: ZUERST DIE SEITE, DIE WARTET. Wartet eine Übernahme (`pendingTab`, gesetzt in
        // `capture`, wenn ein offener Vorgang sie aufgehalten hat), dann ist sie die gemeinte —
        // „übernehmen und ersetzen" meint genau SIE und nicht die alte. Ohne wartende Seite bleibt
        // es beim bisherigen Weg: der Tab der laufenden Übernahme, sonst der zuletzt gelesene.
        // Alles steht im eigenen Zustand — die Leiste hat kein `tabs`-Recht und rät keinen Tab.
        tab = state.pendingTab ?? (s ? { id: s.tabId, url: s.url, title: s.title } : state.lastTab);
        if (tab) {
          // Nacharbeit 2: „ersetzen" beantwortet auch den Hinweis auf verdrängte Erfassungen.
          uebergangen = 0;
          await merke({
            work: null,
            captureStatus: null,
            pendingCapture: false,
            pendingTab: null,
            pendingSource: null,
            skippedCaptures: 0,
          });
        }
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
      if (message.type.startsWith("technik_")) return await technik(message, state);
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
        // BPA-01 AC03/AC10: eine dem Begleiter übergebene Karte gehört dem abgemeldeten Konto.
        begleiterTrennen(true);
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
          begleiterTrennen(true);
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
        // JOB 3606: die Nachfrage ist mit dem Verwerfen beantwortet, ihr Tab aber bleibt stehen —
        // er ist die Seite, die Pedi gemeint hat, und „Neue Übernahme" soll danach SIE lesen und
        // nicht die eben verworfene. Die Nachfrage selbst (`pendingSource`) ist erledigt.
        // Nacharbeit 2: auch Verwerfen beantwortet den Hinweis auf verdrängte Erfassungen.
        uebergangen = 0;
        await merke({
          work: null,
          captureStatus: null,
          pendingCapture: false,
          pendingSource: null,
          skippedCaptures: 0,
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
    /** @type {import("./types").Wire | null} */
    let draft;
    try {
      draft = await api(
        "update",
        auth,
        // `expectedUpdatedAt` ist der Stand, den DIESE Leiste zuletzt gesehen hat. Hat inzwischen
        // jemand denselben Entwurf in Klarwerk bearbeitet, gibt es 409 statt eines stillen
        // Überschreibens (capture/src/service.ts pruefeStand).
        { ...sent, ...(work.updatedAt ? { expectedUpdatedAt: work.updatedAt } : {}) },
        work.draftId,
      );
    } catch (error) {
      // JOB 3606 · Nachtrag 14:45: DER FALL, AN DEM PEDI HEUTE GESCHEITERT IST. Der Entwurf ist in
      // Klarwerk gelöscht — dieser Weg führt nicht mehr hin und wird deshalb hier abgeräumt, bevor
      // der Fehler weiterreist. `failure()` schreibt danach den Zustand `draft_missing`, und die
      // Leiste sagt, was gilt: der Entwurf ist nicht mehr da, das nächste Speichern legt einen
      // neuen an. Der Text bleibt dabei stehen — `vergessen()` fasst ihn nicht an.
      if (error instanceof Error && error.message === "draft_missing") {
        vergessen(work);
        await put(work);
      }
      throw error;
    }
    if (!matches(draft, sent, auth.id) || draft.id !== work.draftId)
      throw new Error("verify_failed");
    work.receipt = draft.id;
    work.updatedAt = typeof draft.updatedAt === "string" ? draft.updatedAt : null;
    work.savedLevel = form.confidentiality;
    work.status = "saved";
    await put(work);
    return view(state, "updated");
  }
  // ================================================================================================
  // KW-MARKE-START — DER MARKENSTAND DER INSTANZ (JOB 3512).
  // ================================================================================================
  //
  // WARUM DIESER ABRUF HIER STEHT UND NICHT IN DER LEISTE: `panel.js` hat baulich KEINEN Netzzugang
  // — `tests/klara-browser/package.test.ts` verbietet dort `fetch(`, und das ist der Grund, warum
  // eine geöffnete Seitenleiste keine Adresse und keinen Kopf aus Seitendaten bilden kann. Der
  // Markenstand nimmt deshalb denselben Weg wie alles andere: Nachricht an den Worker, Abruf hier.
  //
  // WARUM ER NICHT DURCH `api()` LÄUFT: jene Tabelle ist der ANGEMELDETE Weg — sie reicht das
  // Sitzungstoken mit und übersetzt jeden Fehlschlag in einen Vorgangszustand der Übernahme. Beides
  // wäre hier falsch. `GET /api/branding` ist die öffentliche Darstellungsauskunft der Instanz
  // (JOB 3510: „die drei Verbraucher färben ihre Oberfläche, bevor irgendjemand angemeldet ist");
  // sie braucht kein Token, bekommt deshalb ausdrücklich `credentials: "omit"` UND keinen
  // `Authorization`-Kopf, und ein Fehlschlag ist hier kein Zustand, sondern schlicht „nicht
  // abrufbar" — die Leiste behält dann den zuletzt bekannten Look.
  //
  // KEIN ZWEITER HOST: dieselbe Konstante `HOST` wie jeder andere Abruf. Die CSP der Erweiterung
  // (`connect-src https://app.klarwerk.ai`) deckt genau ihn und sonst nichts.
  //
  // DER TYP WOHNT HIER UND NICHT IN `types.d.ts`: jene Datei steht nicht in den Zielpfaden dieses
  // Auftrags — dieselbe Ortsangabe wie `Sicht` in `panel.js` (JOB 3524). Kommt `types.d.ts` einmal
  // zu einem Auftrag, zieht `MarkeAntwort` dorthin und dieser Typ fällt ersatzlos weg.
  /** @typedef {{ok: boolean, stand?: unknown}} MarkeAntwort */
  /** @returns {Promise<MarkeAntwort>} */
  async function markeLesen() {
    try {
      const response = await fetch(`${HOST}/api/branding`, {
        method: "GET",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) return { ok: false };
      return { ok: true, stand: await response.json() };
    } catch {
      // Absicht: kein Zustand, keine Meldung, kein Zurücksetzen. Die Leiste liest `ok: false` als
      // „nichts Neues erfahren" und lässt stehen, was steht.
      return { ok: false };
    }
  }
  // KW-MARKE-END
  // ================================================================================================
  // KW-KONTEXT · BPA-01 — SEITE UND MARKIERUNG AN KLARA BINDEN.
  // ================================================================================================
  //
  // DER WEG: Klickgeste (Symbol/Kontextmenü) → `capture()` liest die Seite → `kontextErfassen`
  // erteilt die einmalige Freigabe dieser Geste und bindet die Karte (`kontext.js`) → die Leiste
  // zeigt sie (`kontext`) → „Mit Klara verbinden" liest die Seite FRISCH, gleicht die Fassung ab und
  // bindet den Kontext an eine Sitzung des vorhandenen Klara-Kerns (`POST /api/klara/sessions` bzw.
  // `…/document-context`, angemeldet wie jeder andere Abruf). Gesendet wird dabei nur die Adresse
  // als Dokumentmerkmal; der Server leitet daraus eine opake Kontextkennung ab. Die Markierung
  // selbst verlässt die Erweiterung auf diesem Weg nicht.
  //
  // KEIN ZWEITER KERN: Sitzung, Anmeldung und Rechteprüfung sind die des Servers. Ein nativer
  // Begleiter ist nicht angeschlossen — im Arbeitsbaum gibt es keinen.
  //
  // SPÄTE ANTWORT (AC02): die Bestätigung des Kerns gilt nur, wenn sie beim Eintreffen noch zu
  // derselben Karte (Folge, Tab, Konto, Fassung) gehört; sonst wird sie nicht gebunden.
  const KERN_ID = /^[\w-]{1,128}$/;
  const KONTEXT_NACHRICHTEN = [
    "kontext",
    "kontextVerbinden",
    "kontextErklaeren",
    "kontextWiderrufen",
    "kontextBegleiter",
  ];
  /** @type {import("./types").KontextSicht} */
  const KONTEXT_FEHLER = {
    kontext: true,
    status: "storage_error",
    angemeldet: false,
    karte: null,
    sperre: null,
    verbunden: false,
    beobachtung: false,
    importe: [],
    // Auch ohne lesbaren Zustand bleibt der Stopp erreichbar.
    widerrufbar: true,
    laeuft: false,
    antwort: null,
    begleiter: null,
  };
  let kontextBusy = false;

  // ================================================================================================
  // DER STOPP (BPA-01 · AC08, G10/G12). Ein Widerruf wartet auf nichts: er läuft auch, während
  // Verbinden oder Erklären unterwegs sind, und auch ohne sichtbare Karte. Jeder Widerruf erhöht die
  // Epoche; ein Schritt, der unter einer älteren Epoche begann, wirkt danach nicht mehr — eine
  // verspätet bestätigte Kernsitzung wird geschlossen, eine verspätete Antwort verworfen.
  // ================================================================================================
  /** @param {Zustand} state */
  const epocheVon = (state) => state.kontextEpoche ?? 0;
  /** @param {number} epoche */
  async function widerrufenSeit(epoche) {
    return epocheVon(/** @type {Zustand} */ (await read())) !== epoche;
  }

  /** @param {Zustand} state @returns {import("./types").Konto} */
  const kontoVon = (state) => ({
    mandant: HOST,
    nutzer: state.auth?.id ?? "",
    sitzung: state.kern?.sessionId ?? "",
  });

  /**
   * Der Kontextzustand unter dem Konto von JETZT. Gehört der gespeicherte zu einem anderen Nutzer,
   * entsteht eine leere Sitzung — ohne Karte, Verlauf, Freigaben und Importe (AC03).
   * @param {Zustand} state @returns {import("./types").KontextZustand | null}
   */
  function kontextVon(state) {
    if (!K) return null;
    const konto = kontoVon(state);
    return K.kontoZuordnen(state.kontext ?? K.sitzung(konto), konto);
  }

  /** @param {string} grund @returns {import("./types").Sperre} */
  function sperreAus(grund) {
    const text = K?.sperrText(grund, "de");
    return { grund, text: text?.text ?? "", naechsterSchritt: text?.naechsterSchritt ?? "" };
  }

  /**
   * Die Chrome-Fassung, soweit der Browser sie ohne Zusatzabfrage nennt. Seit der Kürzung der
   * Kennung ist das die Hauptversion (`141.0.0.0`); die genaue Fassung bindet erst die Hostprobe.
   */
  function browserFassung() {
    const kennung = globalThis.navigator?.userAgent ?? "";
    return { name: "Chrome", version: /Chrome\/([\d.]+)/.exec(kennung)?.[1] ?? "" };
  }

  /**
   * @param {{id?: number, incognito?: boolean} | undefined} tab
   * @param {{frameId?: number} | undefined} info
   * @param {string | undefined} source
   * @param {string} status
   * @param {{text: string, url: string, title: string, variants: import("./types").Variants} | null} gelesen
   */
  async function kontextErfassen(tab, info, source, status, gelesen) {
    if (!K || tab?.id === undefined) return;
    try {
      const state = /** @type {Zustand} */ (await read());
      let zustand = kontextVon(state);
      if (!zustand) return;
      const jetzt = new Date().toISOString();
      // Die Klickgeste auf Symbol oder Kontextmenü IST die einmalige Freigabe (`activeTab`) — für
      // genau diesen Tab und diese Herkunft. Interne Seiten nimmt `freigeben` gar nicht an.
      if (source)
        zustand = K.freigeben(zustand, {
          art: "einmalig",
          tabId: tab.id,
          url: gelesen?.url ?? source,
          erteiltAm: jetzt,
        });
      /** @type {import("./types").Sperre | null} */
      let sperre = null;
      if (gelesen) {
        const ergebnis = K.binden(
          zustand,
          {
            quelle: "seite",
            tabId: tab.id,
            url: gelesen.url,
            titel: gelesen.title,
            text: gelesen.text,
            nodes: gelesen.variants.selection.nodes,
            gaps: gelesen.variants.page.gaps,
            browser: browserFassung(),
            erweiterung: chrome.runtime.getManifest?.().version ?? "",
          },
          jetzt,
        );
        zustand = ergebnis.zustand;
        sperre = ergebnis.sperre;
      } else {
        const pruefung = K.zugang(zustand, {
          url: source ?? "",
          tabId: tab.id,
          incognito: tab.incognito === true,
          frameId: info?.frameId ?? 0,
        });
        if (!pruefung.erlaubt) sperre = pruefung.sperre;
        else if (status === "source_changed") sperre = sperreAus("quelle_geaendert");
        else if (status === "empty") sperre = sperreAus("keine_auswahl");
        else sperre = sperreAus("zugriff_beendet");
      }
      await merke({ kontext: zustand, kontextSperre: sperre });
      await begleiterNachziehen();
    } catch {
      // Die Übernahme darf an der Kontextkarte nie scheitern; ohne Karte bleibt nur ihre Anzeige leer.
    }
  }

  /** @param {import("./types").KontextWechsel} ereignis */
  async function kontextWechsel(ereignis) {
    if (!K) return;
    try {
      const state = /** @type {Zustand} */ (await read());
      if (!state.kontext) return;
      const zustand = K.wechseln(state.kontext, ereignis);
      if (JSON.stringify(zustand) !== JSON.stringify(state.kontext))
        await merke({ kontext: zustand });
      // AC02/AC10: eine dem Begleiter übergebene Karte wird mit der Karte der Erweiterung ungültig.
      await begleiterNachziehen();
    } catch {
      // Ein verpasster Wechsel wird spätestens beim Verbinden sichtbar: dort wird frisch gelesen.
    }
  }

  /** @param {Zustand} state @param {string} status @returns {import("./types").KontextSicht} */
  function kontextSicht(state, status) {
    const zustand = kontextVon(state);
    const karte = zustand?.karte ?? null;
    const kern = state.kern ?? null;
    const verbunden =
      karte !== null &&
      !karte.veraltet &&
      kern !== null &&
      kern.sessionId !== "" &&
      kern.folge === karte.folge &&
      kern.fassung === karte.fassung;
    // Die Antwort gilt nur für die Karte, zu der sie gestellt wurde — derselben Folge, derselben
    // Fassung, demselben Tab. Nach Tabwechsel, Navigation oder Quelländerung steht sie nicht mehr da.
    const gestellt = state.kontextAntwort ?? null;
    const antwort =
      karte !== null &&
      gestellt !== null &&
      !karte.veraltet &&
      gestellt.folge === karte.folge &&
      gestellt.fassung === karte.fassung &&
      gestellt.tabId === karte.tabId
        ? {
            text: gestellt.text,
            answerId: gestellt.answerId,
            beantwortet: gestellt.beantwortet,
            lage: gestellt.lage,
            gruende: gestellt.gruende,
            vorbehalt: gestellt.vorbehalt,
            konflikt: gestellt.konflikt,
            konfliktUnbekannt: gestellt.konfliktUnbekannt,
            quellen: gestellt.quellen,
            absaetze: gestellt.absaetze,
            fassung: gestellt.fassung,
          }
        : null;
    // Zu stoppen gibt es etwas, solange eine Karte, eine Freigabe, eine Kernsitzung oder ein
    // laufender Schritt besteht — sichtbar oder nicht.
    const widerrufbar =
      kontextBusy ||
      karte !== null ||
      (zustand?.freigaben.length ?? 0) > 0 ||
      Boolean(kern?.sessionId);
    return {
      kontext: true,
      status,
      angemeldet: Boolean(state.auth),
      karte: karte && K ? K.anzeige(karte) : null,
      sperre: state.kontextSperre?.grund ?? null,
      verbunden,
      beobachtung: zustand && karte && K ? K.beobachtenErlaubt(zustand, karte.url) : false,
      importe: (zustand?.importe ?? []).map((i) => ({
        herkunft: i.herkunft,
        verbindung: i.verbindung,
      })),
      widerrufbar,
      laeuft: kontextBusy,
      antwort,
      begleiter: begleiterSicht(state, karte),
    };
  }

  /**
   * Der Begleiter, wie die Leiste ihn sieht. „Verbunden" heisst: in DIESEM Worker steht ein
   * geprüfter Kanal offen — ein gespeicherter Stand nach einem Neustart des Workers ist es nicht.
   * @param {Zustand} state @param {import("./types").Karte | null} karte
   * @returns {import("./types").KontextSicht["begleiter"]}
   */
  function begleiterSicht(state, karte) {
    const stand = state.begleiter ?? null;
    if (!stand) return null;
    return {
      verbunden: begleiterPort !== null && !stand.fehler,
      version: stand.version,
      macos: stand.macos,
      uebergeben: karte !== null && stand.folge === karte.folge && stand.fassung === karte.fassung,
      fehler: stand.fehler,
    };
  }

  /**
   * Zustand und Sperre schreiben — aber nur, wenn seit dem Lesen weder eine neue Karte entstanden
   * noch widerrufen worden ist. Sonst gewänne ein langsamer Vorgang gegen eine frischere Erfassung
   * oder gegen den Stopp.
   * @param {Zustand} vorher @param {import("./types").KontextZustand} zustand @param {string} grund
   */
  async function kontextSperren(vorher, zustand, grund) {
    const jetzt = /** @type {Zustand} */ (await read());
    const unveraendert =
      (jetzt.kontext?.folge ?? -1) === (vorher.kontext?.folge ?? -1) &&
      epocheVon(jetzt) === epocheVon(vorher);
    if (unveraendert) await merke({ kontext: zustand, kontextSperre: sperreAus(grund) });
    // AC09/AC10: eine veraltete oder weggefallene Karte gilt auch beim Begleiter nicht mehr.
    await begleiterNachziehen();
    return kontextSicht(await read(), unveraendert ? grund : "widerrufen");
  }

  /**
   * Eine Kernsitzung schliessen — bestmöglich. Ein Fehlschlag ändert nichts am örtlichen Zustand:
   * ohne gespeicherte Kennung benutzt die Erweiterung diese Sitzung ohnehin nicht mehr.
   * @param {import("./types").Auth} auth
   * @param {{instanz: string, sessionId: string, documentContextId: string}} kern
   */
  async function kernSchliessen(auth, kern) {
    if (!KERN_ID.test(kern.sessionId) || !KERN_ID.test(kern.documentContextId)) return;
    try {
      await fetch(`${HOST}/api/klara/sessions/${encodeURIComponent(kern.sessionId)}/close`, {
        method: "POST",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
          "x-klara-instance": kern.instanz,
          "x-klara-session": kern.sessionId,
          "x-klara-document": kern.documentContextId,
        },
        body: "{}",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      // s. o.
    }
  }

  /**
   * Die Seite der Karte FRISCH lesen und die Fassung abgleichen — Text UND Tabellenstruktur (AC09).
   * Chrome entscheidet dabei selbst, ob die Freigabe noch trägt.
   * @param {import("./types").KontextZustand} zustand @param {import("./types").Karte} karte
   * @returns {Promise<{zustand: import("./types").KontextZustand, grund: string}>}
   */
  async function frischAbgleichen(zustand, karte) {
    if (!K) return { zustand, grund: "kontext_fehlt" };
    /** @type {import("./types").CaptureResult | undefined} */
    let frisch;
    try {
      frisch = await leseSeite(karte.tabId);
    } catch {
      frisch = undefined;
    }
    if (!frisch || typeof frisch.text !== "string" || typeof frisch.url !== "string")
      return { zustand, grund: "zugriff_beendet" };
    const abgleich = K.abgleichen(zustand, {
      tabId: karte.tabId,
      url: frisch.url,
      text: frisch.text,
      nodes: cleanVariants(frisch.variants).selection.nodes,
    });
    return { zustand: abgleich.zustand, grund: abgleich.aktuell ? "" : "quelle_geaendert" };
  }

  /**
   * Eine abgelaufene Anmeldung löschen — aber NUR, wenn noch genau die Anmeldung besteht, unter der
   * der Abruf begann (Nutzerkennung UND Sitzungsschlüssel). Ein verspätetes 401 darf eine
   * inzwischen erfolgte neue Anmeldung nicht löschen, auch nicht eine neue Sitzung derselben
   * Person (nacharbeit-6).
   * @param {import("./types").Auth} start @returns {Promise<boolean>} `true`, wenn gelöscht wurde.
   */
  async function abgelaufeneAnmeldungLoeschen(start) {
    const jetzt = /** @type {Zustand} */ (await read());
    if (jetzt.auth?.id !== start.id || jetzt.auth?.token !== start.token) return false;
    await chrome.storage.session.set({ auth: null });
    return true;
  }

  /** Ein Vorgang, der vor einer Übermittlung seine Grundlage verloren hat. */
  class VorgangUngueltig extends Error {
    /** @param {string} grund */
    constructor(grund) {
      super(grund);
      this.grund = grund;
    }
  }

  /**
   * GILT DER BEGONNENE VORGANG NOCH? Unmittelbar vor JEDER Übermittlung wird der aktuelle Zustand
   * gegen den Zustand beim Beginn geprüft: Widerruf (Epoche), dieselbe Anmeldung (Kennung UND
   * Sitzungsschlüssel), dasselbe Konto, dieselbe Kernsitzung, dieselbe Karte (Folge, Tab, Fassung,
   * nicht veraltet) und eine noch tragende Freigabe. Ein Tab-, Konto- oder Kontextwechsel während
   * des Neulesens führt so nie dazu, dass die alte Auswahl unter der alten Anmeldung hinausgeht.
   * @param {Zustand} start @param {import("./types").Karte} karte @param {Zustand} jetzt
   * @returns {string} `""`, wenn der Vorgang weiterlaufen darf; sonst der Sperrgrund.
   */
  function vorgangGilt(start, karte, jetzt) {
    if (!K) return "kontext_fehlt";
    if (epocheVon(jetzt) !== epocheVon(start)) return "verbindung_widerrufen";
    const anmeldung =
      Boolean(start.auth) &&
      jetzt.auth?.id === start.auth?.id &&
      jetzt.auth?.token === start.auth?.token;
    if (!anmeldung) return "kontext_gewechselt";
    if ((jetzt.kern?.sessionId ?? "") !== (start.kern?.sessionId ?? ""))
      return "kontext_gewechselt";
    const zustand = kontextVon(jetzt);
    const aktuell = zustand?.karte ?? null;
    const kontoStart = kontoVon(start);
    const gleicheKarte =
      zustand !== null &&
      aktuell !== null &&
      !aktuell.veraltet &&
      aktuell.folge === karte.folge &&
      aktuell.tabId === karte.tabId &&
      aktuell.fassung === karte.fassung &&
      zustand.konto.nutzer === kontoStart.nutzer &&
      zustand.konto.mandant === kontoStart.mandant;
    if (!zustand || !gleicheKarte) return "kontext_gewechselt";
    if (!K.uebermittlung(zustand).erlaubt) return "kontext_gewechselt";
    return "";
  }

  /**
   * Abbruch OHNE Schreiben: der neuere Zustand (anderer Tab, anderes Konto, Widerruf) bleibt
   * unangetastet. Der Grund reist nur in der Antwort an die Leiste.
   * @param {string} grund
   */
  async function kontextAbbruch(grund) {
    // Der Stopp meldet sich überall mit demselben Status `widerrufen` (wie `kontextWiderrufen` und
    // `kontextSperren`); der Grund steht in `sperre`.
    const status = grund === "verbindung_widerrufen" ? "widerrufen" : grund;
    const sicht = kontextSicht(/** @type {Zustand} */ (await read()), status);
    return { ...sicht, sperre: grund };
  }

  /**
   * Der eine Abruf an den Klara-Kern. Feste Pfade, keine Adresse aus Nachricht oder Seite. Gibt
   * es schon eine Sitzung, wird ihr Dokumentkontext neu gebunden; scheitert das (abgelaufen,
   * geschlossen), entsteht eine neue Sitzung. Vor JEDEM einzelnen Abruf fragt `pruefe`, ob der
   * Vorgang noch gilt; sonst geht nichts hinaus (Fehler mit dem Sperrgrund).
   * @param {import("./types").Auth} auth @param {string} url @param {string} instanz
   * @param {import("./types").Kern | null} kern @param {() => Promise<string>} pruefe
   * @returns {Promise<{sessionId?: unknown, documentContextId?: unknown}>}
   */
  async function kernBinden(auth, url, instanz, kern, pruefe) {
    const documentDescriptor = { kind: "saved", canonicalUrl: url };
    const alt =
      kern && KERN_ID.test(kern.sessionId) && KERN_ID.test(kern.documentContextId) ? kern : null;
    /** @param {string} pfad @param {object} body @param {Record<string, string>} kopf */
    async function senden(pfad, body, kopf) {
      const grund = await pruefe();
      if (grund) throw new VorgangUngueltig(grund);
      return fetch(HOST + pfad, {
        method: "POST",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
          "x-klara-instance": instanz,
          ...kopf,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
    }
    if (alt) {
      const neu = await senden(
        `/api/klara/sessions/${encodeURIComponent(alt.sessionId)}/document-context`,
        { documentDescriptor },
        { "x-klara-session": alt.sessionId, "x-klara-document": alt.documentContextId },
      );
      if (neu.status === 401) throw new Error("expired");
      if (neu.ok) return neu.json();
    }
    const response = await senden(
      "/api/klara/sessions",
      { addinInstanceId: instanz, documentDescriptor },
      {},
    );
    if (response.status === 401) throw new Error("expired");
    if (!response.ok) throw new Error("kern_nicht_erreichbar");
    return response.json();
  }

  async function kontextVerbinden() {
    const state = /** @type {Zustand} */ (await read());
    const epoche = epocheVon(state);
    let zustand = kontextVon(state);
    if (!K || !zustand) return kontextSicht(state, "kontext_fehlt");
    const karte = zustand.karte;
    if (!karte) return kontextSperren(state, zustand, "kein_kontext");
    if (!state.auth) return kontextSperren(state, zustand, "anmeldung_fehlt");
    // 1/2 · Die Seite FRISCH lesen und die Fassung abgleichen.
    const abgleich = await frischAbgleichen(zustand, karte);
    zustand = abgleich.zustand;
    if (abgleich.grund) return kontextSperren(state, zustand, abgleich.grund);
    if (await widerrufenSeit(epoche)) return kontextSicht(await read(), "widerrufen");
    // 3 · Nur was die Freigabe deckt.
    const ausgang = K.uebermittlung(zustand);
    if (!ausgang.erlaubt || !ausgang.daten)
      return kontextSperren(state, zustand, ausgang.sperre?.grund ?? "kein_kontext");
    const antwort = {
      folge: karte.folge,
      tabId: karte.tabId,
      konto: zustand.konto,
      fassung: karte.fassung,
    };
    const instanz = state.kern?.instanz || `klara-browser-${crypto.randomUUID()}`;
    // Unmittelbar vor jedem Kernabruf: gilt der Vorgang noch? (Befund nacharbeit-4)
    const pruefe = async () => vorgangGilt(state, karte, /** @type {Zustand} */ (await read()));
    /** @type {{sessionId?: unknown, documentContextId?: unknown}} */
    let bestaetigt;
    try {
      bestaetigt = await kernBinden(
        state.auth,
        ausgang.daten.url,
        instanz,
        state.kern ?? null,
        pruefe,
      );
    } catch (error) {
      if (error instanceof VorgangUngueltig) return kontextAbbruch(error.grund);
      // Ein 401 löscht nur die Anmeldung, unter der dieser Abruf begann. Ist inzwischen eine andere
      // (oder eine neue derselben Person) da, wird abgebrochen, ohne irgendetwas zu ändern.
      const abgelaufen = error instanceof Error && error.message === "expired";
      if (abgelaufen && !(await abgelaufeneAnmeldungLoeschen(state.auth)))
        return kontextAbbruch("kontext_gewechselt");
      return kontextSperren(state, zustand, "kern_nicht_erreichbar");
    }
    const sessionId = typeof bestaetigt?.sessionId === "string" ? bestaetigt.sessionId : "";
    const documentContextId =
      typeof bestaetigt?.documentContextId === "string" ? bestaetigt.documentContextId : "";
    if (!KERN_ID.test(sessionId) || !KERN_ID.test(documentContextId))
      return kontextSperren(state, zustand, "kern_nicht_erreichbar");
    // 4 · Inzwischen widerrufen oder abgemeldet/umgemeldet? Dann wird die eben bestätigte Sitzung
    // geschlossen und NICHTS geschrieben — der neuere Zustand gehört womöglich einem anderen Konto.
    const nachher = /** @type {Zustand} */ (await read());
    const gleicheAnmeldung =
      nachher.auth?.id === state.auth.id && nachher.auth?.token === state.auth.token;
    if (epocheVon(nachher) !== epoche || !gleicheAnmeldung) {
      await kernSchliessen(state.auth, { instanz, sessionId, documentContextId });
      return kontextAbbruch(gleicheAnmeldung ? "verbindung_widerrufen" : "kontext_gewechselt");
    }
    // 5 · Gehört die Bestätigung noch zu DIESER Karte? Erst jetzt wird gebunden.
    const aktuell = kontextVon(nachher);
    if (!aktuell || !K.antwortPruefen(aktuell, antwort).zustellen) {
      await merke({
        kern: { instanz, sessionId, documentContextId, folge: -1, fassung: "", url: "" },
        kontextSperre: sperreAus("antwort_veraltet"),
      });
      return kontextSicht(await read(), "antwort_veraltet");
    }
    await merke({
      kontext: K.kontoZuordnen(aktuell, { ...aktuell.konto, sitzung: sessionId }),
      kontextSperre: null,
      kern: {
        instanz,
        sessionId,
        documentContextId,
        folge: karte.folge,
        fassung: karte.fassung,
        url: karte.url,
      },
    });
    return kontextSicht(await read(), "verbunden");
  }

  /**
   * „Erkläre mir diese Angaben" — der bestellte Arbeitsfall, über den VORHANDENEN Ausführungsweg
   * des Klara-Kerns (`POST /api/klara/sessions/{id}/execute`). Dort gelten unverändert:
   * Anmeldung und `ko.read`, die Bindung an Sitzung/Instanz/Dokumentkontext, die Einwilligung je
   * Dokument (KA4) und die Dokumenttext-Freigabe. Ohne Einwilligung antwortet der Kern aus
   * geprüftem Wissen ohne Modell; die Markierung schärft dann nur die Suche.
   *
   * Gesendet wird genau die gebundene Auswahl (Text und Tabellenzeilen). Ihre Schutzklasse kennt
   * die Erweiterung nicht — sie geht deshalb als NICHT `intern` hinaus (G05: unbekannt bleibt
   * geschützt), sodass der Kern sie nur mit der zweiten zentralen Freigabe ans Modell gibt.
   * Die Antwort wird nur gebunden, wenn sie beim Eintreffen noch zu derselben Folge, demselben Tab,
   * demselben Konto und derselben Fassung gehört und nicht widerrufen wurde.
   * @param {string} sprache
   */
  async function kontextErklaeren(sprache) {
    const state = /** @type {Zustand} */ (await read());
    const epoche = epocheVon(state);
    let zustand = kontextVon(state);
    if (!K || !zustand) return kontextSicht(state, "kontext_fehlt");
    const karte = zustand.karte;
    if (!karte) return kontextSperren(state, zustand, "kein_kontext");
    if (!state.auth) return kontextSperren(state, zustand, "anmeldung_fehlt");
    const kern = state.kern ?? null;
    const gebunden =
      kern !== null &&
      KERN_ID.test(kern.sessionId) &&
      KERN_ID.test(kern.documentContextId) &&
      kern.folge === karte.folge &&
      kern.fassung === karte.fassung;
    if (!kern || !gebunden) return kontextSperren(state, zustand, "nicht_verbunden");
    const abgleich = await frischAbgleichen(zustand, karte);
    zustand = abgleich.zustand;
    if (abgleich.grund) return kontextSperren(state, zustand, abgleich.grund);
    if (await widerrufenSeit(epoche)) return kontextSicht(await read(), "widerrufen");
    const ausgang = K.uebermittlung(zustand);
    if (!ausgang.erlaubt || !ausgang.daten)
      return kontextSperren(state, zustand, ausgang.sperre?.grund ?? "kein_kontext");
    const selection = K.auswahlFuerFrage(ausgang.daten.auswahl);
    if (selection === null) return kontextSperren(state, zustand, "auswahl_zu_lang");
    const antwort = {
      folge: karte.folge,
      tabId: karte.tabId,
      konto: zustand.konto,
      fassung: karte.fassung,
    };
    const locale = sprache === "en" ? "en" : "de";
    // Unmittelbar vor der Übermittlung: gilt der Vorgang noch? Sonst geht nichts hinaus, und der
    // neuere Zustand bleibt unangetastet (Befund nacharbeit-4).
    const grund = vorgangGilt(state, karte, /** @type {Zustand} */ (await read()));
    if (grund) return kontextAbbruch(grund);
    /** @type {unknown} */
    let roh = null;
    try {
      const response = await fetch(
        `${HOST}/api/klara/sessions/${encodeURIComponent(kern.sessionId)}/execute`,
        {
          method: "POST",
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${state.auth.token}`,
            "x-klara-instance": kern.instanz,
            "x-klara-session": kern.sessionId,
            "x-klara-document": kern.documentContextId,
          },
          // DIE FRAGE SIND DIE MARKIERTEN ANGABEN SELBST (nacharbeit-5). Der Kern bindet jeden
          // Sachbegriff der Frage an jede Quelle (R-0473, `decktAlleFragebegriffe`) und verlangt
          // zwei gemeinsame Begriffe (`MIN_ANSWER_SUBSTANCE`). Eine vom Produkt formulierte
          // Anweisung („Erkläre …") bände Wörter, die keine Quelle führt — der Weg fände nie
          // geprüftes Wissen. Weil die Frage damit Dokumenttext IST, wird sie als solcher gemeldet
          // (`questionSource: "selection"`): mit Einwilligung gilt dann zusätzlich die
          // Dokumenttext-Freigabe des Kerns, ohne sie bleibt der Weg in der Enge.
          body: JSON.stringify({
            question: ausgang.daten.auswahl.text.trim(),
            locale,
            selection,
            selectionConfidentiality: "unbekannt",
            questionSource: "selection",
          }),
          signal: AbortSignal.timeout(60000),
        },
      );
      // Ein 401 löscht nur die Anmeldung, unter der diese Frage begann (s. o.).
      if (response.status === 401 && !(await abgelaufeneAnmeldungLoeschen(state.auth)))
        return kontextAbbruch("kontext_gewechselt");
      if (!response.ok) return kontextSperren(state, zustand, "erklaerung_fehlgeschlagen");
      roh = await response.json();
    } catch {
      return kontextSperren(state, zustand, "erklaerung_fehlgeschlagen");
    }
    // Erst jetzt, mit der Antwort in der Hand: gilt sie noch? Widerruf oder eine andere Anmeldung
    // ⇒ verwerfen, NICHTS schreiben (der neuere Zustand gehört womöglich einem anderen Konto).
    const nachher = /** @type {Zustand} */ (await read());
    const gleicheAnmeldung =
      nachher.auth?.id === state.auth.id && nachher.auth?.token === state.auth.token;
    if (epocheVon(nachher) !== epoche) return kontextAbbruch("verbindung_widerrufen");
    if (!gleicheAnmeldung) return kontextAbbruch("kontext_gewechselt");
    const aktuell = kontextVon(nachher);
    if (!aktuell || !K.antwortPruefen(aktuell, antwort).zustellen) {
      await merke({ kontextSperre: sperreAus("antwort_veraltet") });
      return kontextSicht(await read(), "antwort_veraltet");
    }
    // Der gemeinsame Quellen-/Belegvertrag bleibt erhalten: Quellen, Aussagezuordnung, Lage,
    // Gründe und Einschränkungen reisen bis in die Leiste.
    await merke({
      kontextAntwort: {
        folge: karte.folge,
        fassung: karte.fassung,
        tabId: karte.tabId,
        url: karte.url,
        ...K.erklaerungAus(roh),
      },
      kontextSperre: null,
    });
    return kontextSicht(await read(), "erklaert");
  }

  /**
   * Der Stopp. Er entwertet SOFORT jede Freigabe und Karte, die besteht — auch ohne sichtbare Karte
   * (etwa nach einem Tabwechsel) —, erhöht die Epoche (laufende Schritte wirken danach nicht mehr),
   * verwirft eine gestellte Antwort und schliesst die Kernsitzung.
   */
  async function kontextWiderrufen() {
    const state = /** @type {Zustand} */ (await read());
    let zustand = kontextVon(state);
    if (!K || !zustand) return kontextSicht(state, "kontext_fehlt");
    const kern = state.kern ?? null;
    /** @type {Set<string>} */
    const ziele = new Set();
    if (zustand.karte) ziele.add(zustand.karte.url);
    if (kern?.url) ziele.add(kern.url);
    for (const f of zustand.freigaben) ziele.add(f.art === "bereich" ? f.herkunft : f.url);
    // Ein bereits bewusst gespeicherter Entwurf von dieser Seite bleibt auf dem Server unberührt;
    // er wird mit Herkunft als widerrufen geführt (G05) — gelöscht wird nichts.
    const work = state.work;
    if (zustand.karte && work?.draftId && work.selection.url === zustand.karte.url)
      zustand = K.importMerken(zustand, work.draftId);
    for (const ziel of ziele) zustand = K.widerrufen(zustand, ziel);
    /** @type {import("./types").Kern | null} */
    let ohneSitzung = null;
    if (kern) ohneSitzung = { ...kern, sessionId: "", documentContextId: "", folge: -1, url: "" };
    // Der Begleiter erfährt den Widerruf sofort und verwirft die übergebene Karte (AC08/AC10).
    begleiterTrennen(true);
    await merke({
      kontext: zustand,
      kontextSperre: sperreAus("verbindung_widerrufen"),
      kern: ohneSitzung,
      kontextAntwort: null,
      kontextEpoche: epocheVon(state) + 1,
      begleiter: null,
    });
    if (kern && state.auth) await kernSchliessen(state.auth, kern);
    return kontextSicht(await read(), "widerrufen");
  }

  /**
   * @param {string} art @param {string} sprache
   * @returns {Promise<import("./types").KontextSicht>}
   */
  async function kontextNachricht(art, sprache) {
    if (art === "kontext") return kontextSicht(/** @type {Zustand} */ (await read()), "bereit");
    // Der Stopp wartet auf nichts und ist nie „busy".
    if (art === "kontextWiderrufen") {
      const sicht = await kontextWiderrufen();
      // BPA-03: ein laufender Browserauftrag auf dieser Freigabe endet sofort beim Kern.
      await aktionNachWiderruf();
      return sicht;
    }
    if (art === "kontextBegleiter") return begleiterVerbinden();
    if (kontextBusy) return kontextSicht(/** @type {Zustand} */ (await read()), "busy");
    kontextBusy = true;
    try {
      return art === "kontextVerbinden"
        ? await kontextVerbinden()
        : await kontextErklaeren(sprache);
    } finally {
      kontextBusy = false;
    }
  }
  // ================================================================================================
  // KW-BEGLEITER · BPA-01 AC10 — DIE ERWEITERUNG UND DER KLARA-BEGLEITER AUF DIESEM MAC.
  // ================================================================================================
  //
  // DER KANAL ist Chrome Native Messaging: `connectNative` startet den Host
  // `ai.klarwerk.klara_begleiter` (apps/desktop/klara-begleiter/BrowserBruecke). Chrome lässt das
  // nur zu, wenn (a) die Erweiterung das OPTIONALE Recht `nativeMessaging` erteilt bekommen hat —
  // angefragt auf Klick in der Leiste — und (b) das Host-Manifest genau diese Erweiterung unter
  // `allowed_origins` nennt. Es gibt keinen offenen Port, keinen lokalen Webserver und keine
  // allgemeine Steuerschnittstelle; der Host liest und schreibt nur über stdin/stdout dieser einen
  // Verbindung.
  //
  // DIE ECHTHEIT DER ANTWORT: jede Verbindung beginnt mit `hallo` und einem frischen Einmalwert; nur
  // eine Antwort mit genau diesem Wert, dem Protokoll und einer Fassung gilt (`begleiterAntwort`).
  // Die Fassungen von Begleiter und macOS hält die Leiste sichtbar fest — sie sind die Hostfassungen
  // des Belegs.
  //
  // WAS HINÜBERGEHT: nur auf Klick, nur die gebundene Karte (`begleiterKarte`), nur solange sie
  // gilt. Widerruf und Abmelden schicken `widerrufen` und trennen; der Host verwirft die Karte.
  const BEGLEITER_HOST = "ai.klarwerk.klara_begleiter";
  /** @type {import("./types").NativePort | null} */
  let begleiterPort = null;

  /**
   * Die nächste Nachricht des Hosts — oder `null` nach Ablauf bzw. Trennung.
   * @param {import("./types").NativePort} port @param {number} ms @returns {Promise<unknown>}
   */
  function naechsteNachricht(port, ms) {
    return new Promise((fertig) => {
      /** @param {unknown} nachricht */
      const auf = (nachricht) => abschliessen(nachricht);
      const weg = () => abschliessen(null);
      const frist = setTimeout(() => abschliessen(null), ms);
      /** @param {unknown} ergebnis */
      function abschliessen(ergebnis) {
        clearTimeout(frist);
        port.onMessage.removeListener(auf);
        port.onDisconnect.removeListener(weg);
        fertig(ergebnis);
      }
      port.onMessage.addListener(auf);
      port.onDisconnect.addListener(weg);
    });
  }

  /**
   * Der Verbindungsaufbau, der noch läuft (nacharbeit-8). Er ist von Anfang an registriert, damit
   * Widerruf und Abmelden ihn schliessen können — nicht erst nach dem Handshake.
   * @type {import("./types").NativePort | null}
   */
  let begleiterAusstehend = null;
  /** Jeder Aufbau und jedes Trennen zählt hoch; ein älterer Aufbau wirkt danach nicht mehr. */
  let begleiterGeneration = 0;
  /**
   * Die Karte, die GERADE zum Begleiter unterwegs ist und noch nicht quittiert wurde
   * (nacharbeit-10) — gebunden an Port, Folge und Fassung, BEVOR sie gesendet wird. Ein
   * Kontextwechsel währenddessen verwirft sie sofort; die spätere Quittung zählt dann nicht.
   * @type {{port: import("./types").NativePort, folge: number, fassung: string} | null}
   */
  let begleiterUnterwegs = null;

  /** @param {import("./types").NativePort} port @param {boolean} melden */
  function portSchliessen(port, melden) {
    try {
      if (melden) port.postMessage({ typ: "widerrufen" });
      port.disconnect();
    } catch {
      // Ein schon getrennter Kanal ist das Ziel, kein Fehler.
    }
  }

  /**
   * Den Kanal schliessen — den verbundenen UND einen noch laufenden Aufbau. Mit `melden` erfährt
   * der Host vorher, dass die Karte nicht mehr gilt. Die Generation steigt: ein Aufbau, der danach
   * noch eine Antwort bekommt, setzt weder Port noch Zustand.
   */
  function begleiterTrennen(melden = false) {
    begleiterGeneration += 1;
    const ports = [begleiterPort, begleiterAusstehend];
    begleiterPort = null;
    begleiterAusstehend = null;
    begleiterUnterwegs = null;
    for (const port of ports) if (port) portSchliessen(port, melden);
  }

  /**
   * Die native Karte nachziehen: gilt die übergebene Karte nicht mehr — anderer Tab, Navigation,
   * neue Erfassung, Quelländerung, Kontowechsel —, erfährt der Begleiter es SOFORT (`verwerfen`), und
   * der Zustand vermerkt „keine Karte übergeben". Der Kanal selbst bleibt offen.
   */
  async function begleiterNachziehen() {
    if (!K) return;
    // Zuerst die UNQUITTIERTE Karte: sie kann beim Begleiter schon abgelegt sein, obwohl der
    // Zustand der Erweiterung noch nichts von ihr weiss. Passt sie nicht mehr, sofort `verwerfen`.
    const unterwegs = begleiterUnterwegs;
    if (unterwegs) {
      const aktuell = kontextVon(/** @type {Zustand} */ (await read()))?.karte ?? null;
      const passt =
        aktuell !== null &&
        !aktuell.veraltet &&
        aktuell.folge === unterwegs.folge &&
        aktuell.fassung === unterwegs.fassung;
      if (!passt && begleiterUnterwegs === unterwegs) {
        begleiterUnterwegs = null;
        try {
          unterwegs.port.postMessage({ typ: "verwerfen", folge: unterwegs.folge });
        } catch {
          // Ein schon getrennter Kanal hat die Karte ohnehin verworfen.
        }
      }
    }
    const port = begleiterPort;
    if (!port) return;
    const state = /** @type {Zustand} */ (await read());
    const stand = state.begleiter ?? null;
    if (!stand || stand.folge === -1) return;
    const karte = kontextVon(state)?.karte ?? null;
    const gilt =
      karte !== null &&
      !karte.veraltet &&
      karte.folge === stand.folge &&
      karte.fassung === stand.fassung;
    if (gilt) return;
    try {
      port.postMessage({ typ: "verwerfen", folge: stand.folge });
    } catch {
      begleiterTrennen();
    }
    await merke({ begleiter: { ...stand, folge: -1, fassung: "" } });
  }

  /** @param {string} grund */
  async function begleiterFehler(grund) {
    await merke({
      begleiter: {
        version: "",
        macos: "",
        protokoll: 0,
        verbundenAm: "",
        folge: -1,
        fassung: "",
        fehler: grund,
      },
    });
    return kontextAbbruch(grund);
  }

  /**
   * „Mit Begleiter verbinden": Kanal öffnen, Begleiter prüfen, dann die gültige Karte übergeben.
   * @returns {Promise<import("./types").KontextSicht>}
   */
  async function begleiterVerbinden() {
    const state = /** @type {Zustand} */ (await read());
    if (!K) return kontextSicht(state, "kontext_fehlt");
    if (!state.auth) return kontextAbbruch("anmeldung_fehlt");
    const verbinde = chrome.runtime.connectNative;
    // Ohne erteiltes `nativeMessaging` gibt es die Schnittstelle gar nicht.
    if (typeof verbinde !== "function") return begleiterFehler("begleiter_recht_fehlt");
    begleiterTrennen();
    // Ab hier gehört der Aufbau GENAU dieser Generation; jeder Wartepunkt prüft sie neu.
    const generation = begleiterGeneration;
    const anmeldung = state.auth;
    /** @param {Zustand} jetzt */
    const giltNoch = (jetzt) =>
      generation === begleiterGeneration &&
      jetzt.auth?.id === anmeldung.id &&
      jetzt.auth?.token === anmeldung.token;
    /** @type {import("./types").NativePort} */
    let port;
    try {
      port = verbinde.call(chrome.runtime, BEGLEITER_HOST);
    } catch {
      return begleiterFehler("begleiter_nicht_erreichbar");
    }
    // Sofort registriert: Widerruf und Abmelden schliessen auch einen Aufbau, der noch wartet.
    begleiterAusstehend = port;
    /** Überholter Aufbau: Port schliessen, NICHTS schreiben. */
    const ueberholt = () => {
      if (begleiterAusstehend === port) begleiterAusstehend = null;
      if (begleiterPort === port) begleiterPort = null;
      portSchliessen(port, true);
      return kontextAbbruch("kontext_gewechselt");
    };
    const nonce = crypto.randomUUID();
    const erste = naechsteNachricht(port, 5000);
    try {
      port.postMessage(
        K.begleiterHallo({
          nonce,
          erweiterung: chrome.runtime.getManifest?.().version ?? "",
          nutzer: anmeldung.id,
        }),
      );
    } catch {
      if (begleiterAusstehend === port) begleiterAusstehend = null;
      return begleiterFehler("begleiter_nicht_erreichbar");
    }
    const hallo = K.begleiterAntwort(await erste, nonce);
    if (!giltNoch(/** @type {Zustand} */ (await read()))) return ueberholt();
    if (!hallo.ok) {
      begleiterAusstehend = null;
      portSchliessen(port, false);
      return begleiterFehler(hallo.grund);
    }
    begleiterAusstehend = null;
    begleiterPort = port;
    port.onDisconnect.addListener(() => {
      if (begleiterPort !== port) return;
      begleiterPort = null;
      void merke({ begleiter: null });
    });
    // Die Karte nur, wenn sie unter DIESER Anmeldung gilt und übermittelt werden darf — und erst
    // nach dem FRISCHEN Quellenabgleich (Text und Tabellenstruktur) samt Vorgangsprüfung direkt vor
    // der Übertragung, wie bei Verbinden und Erklären (AC02/AC09).
    const jetzt = /** @type {Zustand} */ (await read());
    const zustand = kontextVon(jetzt);
    const karte = zustand?.karte ?? null;
    let folge = -1;
    let fassung = "";
    if (zustand && karte && giltNoch(jetzt) && K.uebermittlung(zustand).erlaubt) {
      const abgleich = await frischAbgleichen(zustand, karte);
      if (!giltNoch(/** @type {Zustand} */ (await read()))) return ueberholt();
      if (abgleich.grund) {
        // Die Seite hat sich geändert: die Karte wird veraltet vermerkt, NICHT übertragen.
        await kontextSperren(jetzt, abgleich.zustand, abgleich.grund);
      } else {
        const grund = vorgangGilt(jetzt, karte, /** @type {Zustand} */ (await read()));
        if (!grund && begleiterPort === port) {
          // VOR dem Senden binden: ab jetzt kann ein Kontextwechsel die Karte verwerfen lassen.
          const unterwegs = { port, folge: karte.folge, fassung: karte.fassung };
          begleiterUnterwegs = unterwegs;
          const quittung = naechsteNachricht(port, 5000);
          port.postMessage(K.begleiterKarte(karte));
          const angenommen = K.begleiterQuittung(await quittung, karte);
          // Noch dieselbe Übertragung? Hat ein Wechsel sie inzwischen verworfen, zählt die Quittung
          // nicht — auch eine gültige nicht.
          const nochUnterwegs = begleiterUnterwegs === unterwegs;
          if (nochUnterwegs) begleiterUnterwegs = null;
          const nachher = /** @type {Zustand} */ (await read());
          if (!giltNoch(nachher) || begleiterPort !== port) return ueberholt();
          if (angenommen && nochUnterwegs && vorgangGilt(jetzt, karte, nachher) === "") {
            folge = karte.folge;
            fassung = karte.fassung;
          } else if (nochUnterwegs) {
            // Keine, eine ungültige oder eine überholte Quittung: die Karte kann trotzdem schon
            // abgelegt sein — der Begleiter verwirft sie sofort.
            port.postMessage({ typ: "verwerfen", folge: karte.folge });
          }
        }
      }
    }
    if (!giltNoch(/** @type {Zustand} */ (await read())) || begleiterPort !== port)
      return ueberholt();
    await merke({
      begleiter: {
        version: hallo.version,
        macos: hallo.macos,
        protokoll: hallo.protokoll,
        verbundenAm: new Date().toISOString(),
        folge,
        fassung,
        fehler: "",
      },
    });
    // Ein Wechsel zwischen letzter Prüfung und diesem Schreiben darf die übergebene Karte nicht
    // gültig stehen lassen: einmal nachziehen.
    await begleiterNachziehen();
    return kontextSicht(/** @type {Zustand} */ (await read()), "begleiter_verbunden");
  }
  // KW-KONTEXT-END
  // ================================================================================================
  // KW-AKTION · BPA-03 — BERECHTIGTE FUNKTIONEN AUF DER FREIGEGEBENEN SEITE AUSFÜHREN.
  // ================================================================================================
  //
  // DER WEG (produkt:20261011:assistenz-browser-aktionen): Die Person gibt in der Leiste einen
  // Auftrag — getippt oder gesprochen — für die Seite, die sie mit der Klickgeste freigegeben hat
  // (BPA-01, einmalige Freigabe = `activeTab`). Der Worker schickt ihn an den Aktionskern am Server
  // (`POST /api/me/klara/browser-auftraege`). Dort wird er gegen das Seitenprofil erkannt, gebunden,
  // je Schritt mit den aktuellen Rechten geprüft und im eigenen Klara-Gespräch verzeichnet. Jeden
  // Schritt holt der Worker mit seiner Anmeldung ab (`…/takt`) und führt ihn mit `chrome.scripting`
  // über `aktion.js` in Chromes isolierter Welt aus — und nur dort, nur in diesem Tab.
  //
  // DER WORKER ENTSCHEIDET NICHTS ÜBER DEN AUFTRAG. Er prüft vor JEDEM Befehl nur, ob die Freigabe
  // der Seite noch trägt (BPA-01-Vertrag `zugang`, Widerrufsepoche, gleiche Anmeldung). Trägt sie
  // nicht, führt er nichts aus und meldet den Entzug; der Kern beendet den Lauf. Jede Befehlsnummer
  // wird höchstens EINMAL ausgeführt: kommt dieselbe Nummer erneut (Antwort unterwegs verloren),
  // geht die gemerkte Antwort noch einmal hinaus — kein zweiter Klick.
  //
  // SEITENINHALT BLEIBT DATEN: Was `aktion.js` liest, geht als Antwort an den Kern, der es nach
  // Vertrag prüft. Die Leiste zeigt nur, was der Kern zurückgibt.
  /** @typedef {import("./types").AktionZustand} AktionZustand */
  /** @typedef {import("./types").AktionSicht} AktionSicht */
  const AKTION_NACHRICHTEN = ["aktion", "aktionStarten", "aktionSteuern"];
  const AKTION_STEUERUNG = ["pause", "fortsetzen", "abbruch", "bestaetigen", "ruecknahme"];
  const AKTION_VORGANG = /^[\w-]{8,64}$/;
  const AKTION_PFAD = "/api/me/klara/browser-auftraege";
  /** Höchstens so viele Takte je Antrieb — danach übernimmt der nächste Anlass (kein Endlosbetrieb). */
  const AKTION_TAKTE = 400;
  /** @type {Promise<void> | null} */
  let aktionAntrieb = null;
  let aktionKette = Promise.resolve();

  /** Die zuletzt mit der Klickgeste erteilte einmalige Freigabe — das Ziel eines Auftrags. */
  /** @param {Zustand} state @returns {{tabId: number, url: string} | null} */
  function aktionsZiel(state) {
    const zustand = kontextVon(state);
    const einmalig = (zustand?.freigaben ?? []).filter((f) => f.art === "einmalig");
    const f = einmalig.sort((a, b) => (a.erteiltAm < b.erteiltAm ? 1 : -1))[0];
    return f && f.art === "einmalig" ? { tabId: f.tabId, url: f.url } : null;
  }

  /**
   * Trägt die Freigabe der Seite noch? Vertrag (`zugang`), Widerruf (Epoche), Anmeldung und ob der
   * Tab noch da ist. `null` heisst: ja.
   * @param {Zustand} state @param {AktionZustand} aktion @returns {Promise<string | null>}
   */
  async function aktionSperre(state, aktion) {
    if (!K) return "kontext_fehlt";
    if (!state.auth || state.auth.id !== aktion.nutzer) return "abgemeldet";
    if (epocheVon(state) !== aktion.epoche) return "verbindung_widerrufen";
    const zustand = kontextVon(state);
    if (!zustand) return "kontext_fehlt";
    /** @type {{incognito?: boolean} | undefined} */
    let tab;
    try {
      tab = await chrome.tabs.get(aktion.tabId);
    } catch {
      return "tab_geschlossen";
    }
    const zugang = K.zugang(zustand, {
      url: aktion.url,
      tabId: aktion.tabId,
      incognito: tab?.incognito === true,
      frameId: 0,
    });
    return zugang.erlaubt ? null : zugang.sperre.grund;
  }

  /**
   * Läuft in der isolierten Welt der Seite, NACH `aktion.js`. Ruft genau eine Handlung des
   * Seitenausführers; alles andere gibt es dort nicht.
   *
   * VORHER, IN DER SEITE, OHNE LÜCKE: Ist es noch dasselbe Ziel wie bei der Freigabe? Es binden
   * Herkunft und Pfad (wie beim Kern) und nur die Adressteile, die das Seitenprofil als Kennung des
   * Datensatzes nennt (`?id=…`, Ankerroute). Ändert die Seite anderes selbst (`?entwurf=…`,
   * `#gespeichert`), bleibt es dasselbe Ziel. Ein anderer Datensatz: geschrieben wird nichts; das
   * Lesen meldet die neue Adresse, damit der Kern gezielt klärt. Ohne Bindungsangabe gilt streng
   * die ganze Adresse.
   * @param {string} art @param {unknown} args
   * @param {{url: string, parameter: string[], anker: boolean, streng: boolean}} ziel
   */
  function aktionAufruf(art, args, ziel) {
    let abweichend = true;
    let adresse = "";
    try {
      const jetzt = new URL(location.href);
      const frei = new URL(ziel.url);
      adresse = `${jetzt.pathname}${jetzt.search}${jetzt.hash}`;
      abweichend = ziel.streng
        ? jetzt.href !== frei.href
        : jetzt.origin !== frei.origin ||
          jetzt.pathname !== frei.pathname ||
          ziel.parameter.some((n) => jetzt.searchParams.get(n) !== frei.searchParams.get(n)) ||
          (ziel.anker && jetzt.hash !== frei.hash);
    } catch {
      abweichend = true;
    }
    if (abweichend && art !== "lage") return { abweichend: true };
    const api = /** @type {Record<string, unknown> | undefined} */ (
      /** @type {Record<string, unknown>} */ (globalThis).KlaraBrowserAktion
    );
    const f = api?.[art];
    if (!api || typeof f !== "function") return { fehlt: true };
    return { wert: f.call(api, args), fassung: api.fassung, abweichend, adresse };
  }

  /**
   * Die Adressbindung des Befehls — nur in ihrer genauen Form; sonst streng die ganze Adresse.
   * @param {import("./types").AktionBefehl} b @param {AktionZustand} aktion
   */
  function aktionZiel(b, aktion) {
    const a = b.adresse;
    const gueltig =
      a !== undefined &&
      Array.isArray(a.parameter) &&
      a.parameter.length <= 10 &&
      a.parameter.every((n) => typeof n === "string" && /^[\w.-]{1,40}$/.test(n)) &&
      typeof a.anker === "boolean";
    return gueltig
      ? { url: aktion.url, parameter: [...a.parameter], anker: a.anker, streng: false }
      : { url: aktion.url, parameter: [], anker: false, streng: true };
  }

  /**
   * Führt einen Befehl des Kerns in der Seite aus — oder sagt belastbar, dass nichts geschah.
   * @param {import("./types").AktionBefehl} b @param {AktionZustand} aktion
   * @returns {Promise<{ergebnis: unknown, seite?: {recht?: string, grund?: string, adapter?: string}}>}
   */
  async function aktionBefehl(b, aktion) {
    const state = /** @type {Zustand} */ (await read());
    const sperre = await aktionSperre(state, aktion);
    if (sperre === "tab_geschlossen" && b.art === "lage") return { ergebnis: null };
    if (sperre) {
      return {
        ergebnis: { fehler: "nicht_ausgefuehrt" },
        seite: { recht: "entzogen", grund: sperre },
      };
    }
    if (b.tabId !== aktion.tabId) return { ergebnis: { fehler: "nicht_ausgefuehrt" } };
    try {
      await chrome.scripting.executeScript({ target: { tabId: b.tabId }, files: ["aktion.js"] });
    } catch {
      // Chrome hat das Skript gar nicht eingesetzt (kein Zugriff mehr, Seite weg): nichts geschah.
      return { ergebnis: { fehler: "nicht_ausgefuehrt" } };
    }
    try {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: b.tabId },
        func: aktionAufruf,
        args: [b.art, b.args, aktionZiel(b, aktion)],
      });
      const aus =
        /** @type {{wert?: unknown, fassung?: unknown, fehlt?: boolean, abweichend?: boolean, adresse?: unknown} | undefined} */ (
          r?.result
        );
      // Anderes Ziel oder kein Seitenausführer: in der Seite geschah nichts.
      if (!aus || aus.fehlt || (aus.abweichend && b.art !== "lage"))
        return { ergebnis: { fehler: "nicht_ausgefuehrt" } };
      const fassung = typeof aus.fassung === "string" ? aus.fassung : "";
      if (b.art === "lage") {
        /** @type {Record<string, unknown> | null} */
        let lage =
          aus.wert && typeof aus.wert === "object" ? { ...aus.wert, tabId: b.tabId } : null;
        if (lage && aus.abweichend && typeof aus.adresse === "string" && aus.adresse) {
          lage = { ...lage, pfad: aus.adresse };
        }
        return { ergebnis: lage ?? { fehler: "verbindung" }, seite: { adapter: fassung } };
      }
      return { ergebnis: aus.wert ?? { fehler: "verbindung" }, seite: { adapter: fassung } };
    } catch {
      // Eingesetzt, aber ohne Antwort zurück (Seite lud neu, Rahmen weg): die Wirkung ist offen.
      return { ergebnis: { fehler: "verbindung" } };
    }
  }

  /**
   * @param {import("./types").Auth} auth @param {string} pfad @param {unknown} body
   * @returns {Promise<{status: number, body: Record<string, unknown>}>}
   */
  async function aktionApi(auth, pfad, body) {
    const response = await fetch(HOST + pfad, {
      method: body === undefined ? "GET" : "POST",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${auth.token}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      // Der Takt wartet am Server bis zu 20 s auf den nächsten Schritt.
      signal: AbortSignal.timeout(30000),
    });
    /** @type {Record<string, unknown>} */
    let inhalt = {};
    try {
      const gelesen = await response.json();
      if (gelesen && typeof gelesen === "object") inhalt = gelesen;
    } catch {
      inhalt = {};
    }
    return { status: response.status, body: inhalt };
  }

  /**
   * Die Sicht des Kerns, so wie sie kam. Die Leiste setzt jede Angabe nur als Text; was fehlt,
   * bleibt leer — gerechnet wird mit ihr nichts.
   * @param {unknown} roh @returns {import("./types").AuftragSicht | null}
   */
  const alsSicht = (roh) =>
    roh && typeof roh === "object" ? /** @type {import("./types").AuftragSicht} */ (roh) : null;

  /** Schreibvorgänge am Auftragszustand nacheinander — keiner überschreibt einen späteren. */
  let merkKette = Promise.resolve();
  /** @param {Partial<AktionZustand>} teil */
  function aktionMerken(teil) {
    const schreiben = merkKette.then(async () => {
      const state = /** @type {Zustand} */ (await read());
      if (!state.aktion) return;
      await merke({ aktion: { ...state.aktion, ...teil } });
    });
    merkKette = schreiben.then(
      () => undefined,
      () => undefined,
    );
    return schreiben;
  }

  /** Streng steigend, auch über einen Neustart des Workers hinweg. @param {AktionZustand} a */
  const naechsteFolge = (a) => Math.max(Date.now(), (a.folge ?? 0) + 1);

  /**
   * Der Antrieb: meldet die Antwort des letzten Befehls, holt den nächsten und führt ihn aus —
   * bis der Kern nichts mehr hat und der Lauf ruht. Läuft höchstens einmal zugleich.
   * @param {{auftrag?: unknown, befehl?: unknown} | null} start
   */
  function aktionAntreiben(start) {
    if (aktionAntrieb) return aktionAntrieb;
    aktionAntrieb = (async () => {
      let antwort = start;
      for (let takt = 0; takt < AKTION_TAKTE; takt++) {
        const state = /** @type {Zustand} */ (await read());
        const aktion = state.aktion;
        if (!aktion?.id || !state.auth) return;
        if (antwort?.auftrag) {
          await aktionMerken({ sicht: alsSicht(antwort.auftrag), fehler: null });
        }
        const befehl = /** @type {import("./types").AktionBefehl | null} */ (
          antwort?.befehl ?? null
        );
        const auftrag = /** @type {{laeuft?: boolean} | undefined} */ (antwort?.auftrag);
        if (antwort && !befehl && auftrag && !auftrag.laeuft) {
          await aktionMerken({ laeuft: false });
          return;
        }
        /** @type {Record<string, unknown>} */
        let body = {};
        if (befehl) {
          // Dieselbe Nummer noch einmal (die Antwort ging verloren): nicht erneut ausführen, die
          // gemerkte Antwort geht noch einmal hinaus. Eine Nummer, die schon begonnen hatte, aber
          // ohne gemerkte Antwort ist (Worker unterbrochen), eine kleinere als die höchste
          // ausgeführte und ein schon abgeholter Befehl (`wiederholt`), den dieser Worker nicht
          // lückenlos einordnen kann, werden NIE ausgeführt: ihr Ausgang ist offen — der Kern gleicht
          // an der Seite ab. Lesen wirkt nicht und darf immer wiederholt werden.
          const gemerkt =
            aktion.erledigt && aktion.erledigt.nr === befehl.nr ? aktion.erledigt : null;
          const hoechste = Math.max(aktion.erledigt?.nr ?? 0, aktion.ausfuehrend ?? 0);
          // Ein als `wiederholt` gekennzeichneter Befehl ist nur dann sicher neu, wenn dieser Worker
          // den Lauf LÜCKENLOS kennt: die Nummer davor ist die höchste, die er begonnen oder
          // beantwortet hat — dann ging nur die Antwort verloren, die ihn brachte, und er hat ihn nie
          // gesehen. Fehlt dieser Zusammenhang (Zustand verloren), wird er nie ausgeführt.
          const unbekannt =
            befehl.wiederholt === true && befehl.art !== "lage" && hoechste !== befehl.nr - 1;
          /** @type {{ergebnis: unknown, seite?: {recht?: string, grund?: string, adapter?: string}}} */
          let aus;
          if (gemerkt) {
            aus = {
              ergebnis: gemerkt.ergebnis,
              ...(gemerkt.seite ? { seite: gemerkt.seite } : {}),
            };
          } else if (befehl.nr <= hoechste || unbekannt) {
            aus = { ergebnis: { fehler: "verbindung" } };
          } else {
            await aktionMerken({ ausfuehrend: befehl.nr });
            aus = await aktionBefehl(befehl, aktion);
            await aktionMerken({
              erledigt: { nr: befehl.nr, ergebnis: aus.ergebnis, seite: aus.seite ?? null },
            });
          }
          body = { antwort: { nr: befehl.nr, ergebnis: aus.ergebnis } };
          if (aus.seite) body.seite = aus.seite;
        }
        const jetzt = /** @type {AktionZustand} */ ((await read()).aktion ?? aktion);
        const folge = naechsteFolge(jetzt);
        await aktionMerken({ folge });
        /** @type {{status: number, body: Record<string, unknown>} | null} */
        let r = null;
        for (let versuch = 0; versuch < 3 && !r; versuch++) {
          try {
            r = await aktionApi(
              state.auth,
              `${AKTION_PFAD}/${encodeURIComponent(aktion.id)}/takt`,
              {
                ...body,
                folge: versuch === 0 ? folge : naechsteFolge({ ...jetzt, folge: folge + versuch }),
              },
            );
          } catch {
            r = null;
          }
        }
        if (!r || r.status !== 200) {
          // Ohne Verbindung ruht der Antrieb. Am Server läuft die Frist; was unklar ist, gleicht der
          // Kern beim Fortsetzen an der Seite ab.
          await aktionMerken({
            laeuft: false,
            fehler:
              r?.status === 404
                ? "lauf_beendet"
                : r?.status === 401
                  ? "anmelden"
                  : r?.status === 409
                    ? String(r.body.grund ?? "andere_sitzung")
                    : "verbindung",
          });
          return;
        }
        antwort = r.body;
      }
      await aktionMerken({ laeuft: false });
    })().finally(() => {
      aktionAntrieb = null;
    });
    return aktionAntrieb;
  }

  /** @param {Zustand} state @param {string} status @returns {AktionSicht} */
  function aktionSicht(state, status) {
    const a = state.aktion ?? null;
    const ziel = aktionsZiel(state);
    return {
      aktion: true,
      status,
      angemeldet: Boolean(state.auth),
      ziel: ziel ? { url: ziel.url } : null,
      laeuft: Boolean(a?.laeuft) || aktionAntrieb !== null,
      klaerung: a?.klaerung ?? null,
      fehler: a?.fehler ?? null,
      auftrag: a?.sicht ?? null,
    };
  }

  /**
   * Ist der freigegebene Tab der Webseiten-Tab, in dem die Person zuletzt war? Die Leiste selbst
   * zählt nicht, wenn sie als Tab läuft. Ohne Auskunft des Browsers: nein (nichts beginnen).
   * @param {{tabId: number}} ziel @param {number | null} leisteTab @returns {Promise<boolean>}
   */
  async function aktionZielVorn(ziel, leisteTab) {
    try {
      // Der aktive Tab des Fensters, in dem die Person zuletzt war — im Seitenfenster ist das die
      // Seite. Läuft die Leiste selbst als Tab und ist sie vorn, zählt der zuletzt benutzte andere.
      const vorn = (await chrome.tabs.query({ active: true, lastFocusedWindow: true })).find(
        (t) => typeof t.id === "number" && t.id !== leisteTab,
      );
      if (vorn) return vorn.id === ziel.tabId;
      const andere = (await chrome.tabs.query({})).filter(
        (t) => typeof t.id === "number" && t.id !== leisteTab,
      );
      const zuletzt = andere.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
      return zuletzt !== undefined && zuletzt.id === ziel.tabId;
    } catch {
      return false;
    }
  }

  /** @param {{wortlaut?: unknown, quelle?: unknown, vorgang?: unknown, leisteTab?: unknown}} m @returns {Promise<AktionSicht>} */
  async function aktionStarten(m) {
    const state = /** @type {Zustand} */ (await read());
    if (!state.auth) return aktionSicht(state, "anmelden");
    if (aktionAntrieb || state.aktion?.laeuft) return aktionSicht(state, "laeuft");
    const wortlaut = typeof m.wortlaut === "string" ? m.wortlaut.trim() : "";
    const quelle = m.quelle === "gesprochen" ? "gesprochen" : "getippt";
    const vorgang = typeof m.vorgang === "string" ? m.vorgang : "";
    if (!wortlaut || wortlaut.length > 2000 || !AKTION_VORGANG.test(vorgang))
      return aktionSicht(state, "invalid_message");
    const ziel = aktionsZiel(state);
    if (!ziel) return aktionSicht(state, "keine_freigabe");
    // Freigegeben ist, was die Person zuletzt mit der Klickgeste freigab. Ist der Tab, in dem sie
    // zuletzt war, ein anderer (etwa weil eine Geste dort keine Freigabe erteilte), wäre das Ziel
    // für sie nicht das, was sie vor sich sieht: erst klären, nichts beginnen (AC02).
    if (!(await aktionZielVorn(ziel, typeof m.leisteTab === "number" ? m.leisteTab : null))) {
      await merke({
        aktion: {
          ...(state.aktion ?? {
            id: null,
            vorgang,
            tabId: ziel.tabId,
            url: ziel.url,
            epoche: epocheVon(state),
            nutzer: state.auth.id,
            folge: 0,
            sicht: null,
            klaerung: null,
            erledigt: null,
          }),
          laeuft: false,
          fehler: "ziel_nicht_vorn",
        },
      });
      return aktionSicht(/** @type {Zustand} */ (await read()), "gesperrt");
    }
    // Derselbe Vorgang noch einmal (zweiter Klick nach einem Verbindungsabbruch): gibt der Kern
    // DENSELBEN Lauf zurück, gilt weiter, was dieser Worker dort schon ausgeführt hat — sonst
    // käme ein abgeholter Klick als neu an und würde ein zweites Mal geklickt.
    const vorher = state.aktion?.vorgang === vorgang && state.aktion.id ? state.aktion : null;
    /** @type {AktionZustand} */
    const aktion = {
      id: vorher?.id ?? null,
      vorgang,
      tabId: ziel.tabId,
      url: ziel.url,
      epoche: epocheVon(state),
      nutzer: state.auth.id,
      folge: vorher?.folge ?? 0,
      sicht: null,
      klaerung: null,
      fehler: null,
      ausfuehrend: vorher?.ausfuehrend ?? null,
      erledigt: vorher?.erledigt ?? null,
      laeuft: true,
    };
    const sperre = await aktionSperre(state, aktion);
    if (sperre) {
      await merke({ aktion: { ...aktion, laeuft: false, fehler: sperre } });
      return aktionSicht(/** @type {Zustand} */ (await read()), "gesperrt");
    }
    await merke({ aktion });
    /** @type {{status: number, body: Record<string, unknown>}} */
    let r;
    try {
      r = await aktionApi(state.auth, AKTION_PFAD, {
        vorgang,
        quelle,
        wortlaut,
        ziel: { tabId: ziel.tabId, url: ziel.url },
        host: {
          browser: browserFassung().name,
          version: browserFassung().version,
          erweiterung: chrome.runtime.getManifest?.().version ?? "",
        },
      });
    } catch {
      await aktionMerken({ laeuft: false, fehler: "verbindung" });
      return aktionSicht(/** @type {Zustand} */ (await read()), "verbindung");
    }
    if (r.status === 401) {
      await merke({ auth: null, aktion: null });
      return aktionSicht(/** @type {Zustand} */ (await read()), "anmelden");
    }
    // Klärung oder Ablehnung: es gibt keinen (neuen) Lauf — nichts vom früheren gilt weiter.
    const ohneLauf = { id: null, ausfuehrend: null, erledigt: null };
    if (r.status === 200 && r.body.art === "klaerung") {
      await aktionMerken({ ...ohneLauf, laeuft: false, klaerung: String(r.body.text ?? "") });
      return aktionSicht(/** @type {Zustand} */ (await read()), "klaerung");
    }
    const auftrag = /** @type {{id?: unknown} | undefined} */ (r.body.auftrag);
    if (r.status !== 201 || typeof auftrag?.id !== "string") {
      await aktionMerken({ ...ohneLauf, laeuft: false, fehler: String(r.body.grund ?? "fehler") });
      return aktionSicht(/** @type {Zustand} */ (await read()), "fehler");
    }
    // Ein ANDERER Lauf zählt seine Befehle neu: dann gilt nichts vom früheren.
    const derselbe = vorher !== null && vorher.id === auftrag.id;
    await aktionMerken({
      id: auftrag.id,
      sicht: alsSicht(auftrag),
      ...(derselbe ? {} : { ausfuehrend: null, erledigt: null }),
    });
    void aktionAntreiben(r.body);
    return aktionSicht(/** @type {Zustand} */ (await read()), "gestartet");
  }

  /** @param {{art?: unknown, fingerabdruck?: unknown}} m @returns {Promise<AktionSicht>} */
  async function aktionSteuern(m) {
    const state = /** @type {Zustand} */ (await read());
    const aktion = state.aktion;
    if (!state.auth || !aktion?.id) return aktionSicht(state, "kein_auftrag");
    const art = typeof m.art === "string" ? m.art : "";
    if (!AKTION_STEUERUNG.includes(art)) return aktionSicht(state, "invalid_message");
    /** @type {{status: number, body: Record<string, unknown>}} */
    let r;
    try {
      r = await aktionApi(state.auth, `${AKTION_PFAD}/${encodeURIComponent(aktion.id)}/steuerung`, {
        art,
        ...(art === "bestaetigen" ? { fingerabdruck: String(m.fingerabdruck ?? "") } : {}),
      });
    } catch {
      return aktionSicht(state, "verbindung");
    }
    if (r.status !== 200) {
      await aktionMerken({
        fehler: r.status === 401 ? "anmelden" : String(r.body.grund ?? "fehler"),
      });
      return aktionSicht(/** @type {Zustand} */ (await read()), "abgelehnt");
    }
    await aktionMerken({ sicht: alsSicht(r.body.auftrag), fehler: null, laeuft: true });
    // Läuft der Antrieb schon, holt ER den nächsten Befehl; sonst beginnt er mit dieser Antwort.
    void aktionAntreiben(aktionAntrieb ? null : r.body);
    return aktionSicht(/** @type {Zustand} */ (await read()), "gesteuert");
  }

  /**
   * Nach einem Widerruf der Seitenfreigabe (BPA-01) erfährt der Kern es sofort — nicht erst beim
   * nächsten Befehl.
   */
  async function aktionNachWiderruf() {
    const state = /** @type {Zustand} */ (await read());
    const aktion = state.aktion;
    // Auch ein pausierter oder ruhender Lauf erfährt es — er darf danach nicht fortgesetzt werden.
    if (!state.auth || !aktion?.id) return;
    try {
      const r = await aktionApi(
        state.auth,
        `${AKTION_PFAD}/${encodeURIComponent(aktion.id)}/steuerung`,
        { art: "widerruf" },
      );
      if (r.status === 200) await aktionMerken({ sicht: alsSicht(r.body.auftrag) });
    } catch {
      // Ohne Verbindung wirkt der Widerruf beim nächsten Befehl: er wird nicht mehr ausgeführt.
    }
  }

  /** @param {import("./types").Message} m @returns {Promise<AktionSicht>} */
  function aktionNachricht(m) {
    const lauf = aktionKette.then(async () => {
      if (m.type === "aktionStarten") return aktionStarten(m);
      if (m.type === "aktionSteuern") return aktionSteuern(m);
      const state = /** @type {Zustand} */ (await read());
      // Nach einem Neustart des Workers: ein unterbrochener Antrieb setzt am Server fort.
      if (state.aktion?.id && state.aktion.laeuft && !aktionAntrieb) void aktionAntreiben(null);
      return aktionSicht(state, "bereit");
    });
    aktionKette = lauf.then(
      () => undefined,
      () => undefined,
    );
    return lauf;
  }
  // KW-AKTION-END
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("panel.html")) {
      respond({ status: "forbidden_sender" });
      return false;
    }
    // JOB 3512: der Markenstand geht bewusst NICHT durch `dispatch` — der beantwortet Fragen zur
    // Übernahme und gibt eine `View` zurück. Die Marke ist keine Übernahme: sie kennt keinen
    // Vorgang, keine Auswahl und keinen Zustand, und ein Fehlschlag darf die Leiste nicht in einen
    // Übernahmezustand versetzen. Eigene Frage, eigene Antwort, eine Zeile.
    if (message && typeof message === "object" && message.type === "branding") {
      // `respond` ist im Vertrag auf `View` typisiert (types.d.ts, nicht Zielpfad). Die Marke IST
      // keine View — deshalb hier die eine benannte Umtypung statt einer erfundenen View-Form.
      const antworte = /** @type {(antwort: MarkeAntwort) => void} */ (
        /** @type {unknown} */ (respond)
      );
      markeLesen().then(antworte, () => antworte({ ok: false }));
      return true;
    }
    // BPA-01: die Kontextkarte ist keine Übernahme — eigene Fragen, eigene Antwort (`KontextSicht`),
    // außerhalb von `dispatch` und seiner Sperre.
    if (message && typeof message === "object" && KONTEXT_NACHRICHTEN.includes(message.type)) {
      const antworte = /** @type {(antwort: import("./types").KontextSicht) => void} */ (
        /** @type {unknown} */ (respond)
      );
      const sprache = message.sprache ?? "de";
      kontextNachricht(message.type, sprache).then(antworte, () => antworte(KONTEXT_FEHLER));
      return true;
    }
    // BPA-03: Browseraufträge sind keine Übernahme — eigene Fragen, eigene Antwort (`AktionSicht`).
    if (message && typeof message === "object" && AKTION_NACHRICHTEN.includes(message.type)) {
      const antworte = /** @type {(antwort: AktionSicht | {status: string}) => void} */ (
        /** @type {unknown} */ (respond)
      );
      aktionNachricht(message).then(antworte, () => antworte({ status: "storage_error" }));
      return true;
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
  // Der Wunsch wird deshalb GEMERKT und nach dem laufenden Vorgang nachgeholt — dieselbe Bauform
  // wie `nachholen()`/`erledigt()` in der Leiste.
  //
  // CHROME-ERFASSEN-EINFUEGEN: ZWEI WÜNSCHE IM SELBEN FENSTER VERSCHWINDEN AUCH NICHT. Bis hierher
  // überschrieb der zweite den ersten — die erste Übernahme war damit still weg, ohne Meldung. Jetzt
  // bleiben der ERSTE und der LETZTE stehen: der erste wird gelesen, und der letzte trifft danach
  // auf die offene Vorschau und wird dort, wie jede andere wartende Seite, sichtbar zur Wahl
  // gestellt („übernehmen und ersetzen" oder „behalten", s. `capture()`). Was dazwischen kam, ist
  // dieselbe Lage wie eine zweite wartende Seite: die zuletzt genannte steht in der Nachfrage. Eine
  // Warteschlange ohne Deckel ist es bewusst nicht — sie verschöbe das Überschreiben nur in die
  // Nachfrage, die ebenfalls genau EINE wartende Seite benennt.
  //
  // BEN (Nacharbeit 2): DAS DAZWISCHEN DARF AUCH NICHT STILL WEG SEIN. Drei Erfassungen A, B, C
  // während einer Sperre ergaben [A, B] → [A, C]; B war ohne Rückmeldung gelöscht. Jetzt wird jede
  // so verdrängte Erfassung GEZÄHLT und sofort im Sitzungszustand festgehalten
  // (`skippedCaptures`). Die Leiste zeigt die Zahl als Warnung, bis der Mensch die Lage beantwortet
  // (behalten, ersetzen oder verwerfen) — dann ist sie gesehen und wird zurückgesetzt.
  //
  // BPA-01 (AC05): der gemerkte Tab trägt `incognito` mit — auch ein nachgeholter Wunsch aus einem
  // privaten Fenster wird nicht gelesen.
  /** @typedef {{tab: {id?: number, url?: string, title?: string, incognito?: boolean} | undefined, info: {frameUrl?: string, pageUrl?: string, frameId?: number, selectionText?: string} | undefined}} Wunsch */
  /** @type {Wunsch[]} */
  let gemerkt = [];
  let uebergangen = 0;
  async function nachholen() {
    if (gemerkt.length === 0 || busy || captureBusy) return;
    const [wartend, ...rest] = gemerkt;
    gemerkt = rest;
    if (wartend) await capture(wartend.tab, wartend.info);
  }
  /**
   * Der EINE Skripteinsatz in eine Seite: der Auswahl-Leser. Erfassung und das frische Nachlesen
   * vor dem Verbinden (BPA-01) gehen beide hier durch; Chrome prüft dabei selbst den Zugriff.
   * @param {number} tabId
   */
  async function leseSeite(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["selection.js"],
    });
    return results[0]?.result;
  }
  /** @param {{id?: number, url?: string, title?: string, incognito?: boolean} | undefined} tab @param {{frameUrl?: string, pageUrl?: string, frameId?: number, selectionText?: string}} [info] */
  async function capture(tab, info) {
    if (captureBusy || busy) {
      // Der Merker wird SYNCHRON gesetzt, erst danach wird gespeichert — sonst könnte `nachholen()`
      // während des Speicherns den alten Stand abarbeiten.
      const verdraengt = gemerkt.length >= 2;
      gemerkt = [...gemerkt.slice(0, 1), { tab, info }];
      if (verdraengt) {
        uebergangen += 1;
        await merke({ skippedCaptures: uebergangen });
      }
      return;
    }
    captureBusy = true;
    try {
      const state = await read();
      const source = info?.frameUrl ?? info?.pageUrl ?? tab?.url;
      // ==========================================================================================
      // JOB 3606 · DIE URSACHE DER BEFUNDE (a) UND (b) — HIER STAND EIN STUMMES `return`.
      // ==========================================================================================
      //
      // Bis hierher hiess es: `if (state.work) { pendingCapture = true; return; }` — VOR
      // `executeScript`. Lag also noch irgendein Vorgang im Zustand, wurde die Seite gar nicht
      // erst gelesen. Nach aussen sah das aus wie zwei verschiedene Fehler, war aber einer:
      //   (a) „Markierung · nicht vorhanden" trotz markiertem Text — es wurde nie nachgesehen.
      //   (b) Leiste zeigt Titel/Inhalt einer FREMDEN Seite — der alte Stand blieb einfach stehen.
      // Pedi hat beides am 11.09. selbst gefunden (Bildbelege 14:20 und 14:23).
      //
      // ZWEI DINGE ÄNDERN SICH, DIE ABSICHT NICHT:
      //
      // 1. FERTIG IST NICHT OFFEN. Ein Vorgang mit bestätigtem Entwurf (`draftId` nach dem
      //    Nachlesen in `stateView`, Status `saved`, keine unklare Anlage) ist ABGESCHLOSSEN: er
      //    liegt auf dem Server und wird durch eine neue Übernahme weder überschrieben noch
      //    gelöscht — genau das sagt schon der `recapture`-Weg. Er darf die nächste Übernahme
      //    also nicht blockieren, und tut es ab hier nicht mehr.
      //
      // 2. EIN OFFENER VORGANG BLOCKIERT WEITER — ABER NICHT MEHR STUMM. Eine begonnene,
      //    ungesicherte Übernahme darf nicht von einem anderen Tab überschrieben werden; das war
      //    und bleibt richtig. Neu ist, dass der Mensch davon ERFÄHRT und einen Griff hat: welche
      //    Seite wartet, steht in `pendingSource`, und der wartende Tab in `pendingTab` — daraus
      //    baut die Leiste die Frage „übernehmen und ersetzen, oder die alte behalten?".
      //    `recapture` nimmt dann diesen Tab, nicht mehr den alten.
      if (state.work && !fertig(state.work)) {
        /** @type {Zustand} */
        const wartend = {
          pendingCapture: true,
          ...(tab?.id !== undefined && supported(source)
            ? {
                pendingTab: { id: tab.id, url: source ?? "", title: tab.title ?? "" },
                pendingSource: { url: source ?? "", title: tab.title ?? "" },
              }
            : {}),
        };
        // BEN (Nacharbeit 3): DIESELBE VERDRÄNGUNG AN DER NACHFRAGE. Läuft A schon und kommen B und C
        // währenddessen, landet erst B als wartende Seite hier und wird gleich danach von C
        // überschrieben — B war noch unbeantwortet und wäre ohne Hinweis weg. Eine noch offene
        // wartende Seite, die von einer ANDEREN ersetzt wird, zählt deshalb genauso wie eine im
        // Merker verdrängte Erfassung.
        //
        // BEN (Nacharbeit 4): UND ZWAR UNABHÄNGIG VON DER ADRESSE. Bis hierher galt „dieselbe URL ist
        // kein Verlust" — aber zwei Tabs mit derselben Adresse (oder derselbe Tab mit einer neuen
        // Markierung) können verschiedenen Inhalt tragen. Die wartende Erfassung ist ein VORGANG,
        // keine Adresse; die Seite wird hier gar nicht gelesen, ihr Inhalt ist also unbekannt. Jede
        // noch unbeantwortete wartende Erfassung, die durch eine neue ersetzt wird, zählt deshalb.
        const vorher = /** @type {Zustand} */ (state);
        if (wartend.pendingSource && vorher.pendingCapture === true && vorher.pendingSource) {
          uebergangen = Math.max(uebergangen, vorher.skippedCaptures ?? 0) + 1;
          wartend.skippedCaptures = uebergangen;
        }
        await merke(wartend);
        return;
      }
      let status = "unsupported";
      // BPA-01: was die Seite geliefert hat, für die Kontextkarte. Bleibt `null`, wenn nichts
      // gelesen wurde oder werden durfte.
      /** @type {{text: string, url: string, title: string, variants: import("./types").Variants} | null} */
      let gelesen = null;
      // BPA-01 · AC05: im privaten Fenster wird die Seite gar nicht erst gelesen.
      if (
        tab?.id !== undefined &&
        supported(source) &&
        (!info?.frameId || info.frameId === 0) &&
        tab.incognito !== true
      ) {
        try {
          const s = await leseSeite(tab.id);
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
              const id = crypto.randomUUID();
              // BPA-02: steht die Markierung in einer Tabelle, wird GENAU diese gemerkt — gebunden an
              // diese Übernahme. Ohne Tabelle bleibt der Weg zu, statt eine Tabelle zu raten.
              const tabelle = markierteTabelle(s);
              await merke({
                technik: tabelle
                  ? {
                      captureId: id,
                      tabelle,
                      ziel: { objekt: "", variante: "" },
                      quellen: null,
                      belege: null,
                      vorschaubeleg: null,
                      ergebnis: null,
                      abgleich: null,
                      klaerung: null,
                      entwurfId: null,
                      wissensobjektId: null,
                      imWissenFreigegeben: false,
                    }
                  : null,
              });
              await put({
                id,
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
              // JOB 3606: derselbe Griff beweist auch, WELCHER Tab gerade aktiv ist — Symbol und
              // Kontextmenü wirken nur auf ihn. Ohne diese Zeile stünde nach einer Übernahme noch
              // der zuvor gemerkte fremde Tab da, und `sourceChanged` meldete eine Abweichung, die
              // es nicht gibt.
              const merken = {
                lastTab: { id: tab.id, url: s.url, title: s.title },
                activeTabId: tab.id,
              };
              await merke(merken);
              gelesen = { text: s.text, url: s.url, title: s.title, variants };
            }
          } else status = "source_changed";
        } catch {
          status = "capture_failed";
        }
      }
      // BPA-01: dieselbe Geste bindet die Kontextkarte — oder hält fest, warum nicht.
      await kontextErfassen(tab, info, source, status, gelesen);
      // JOB 3606: die Nachfrage ist beantwortet — sie und der Tab, auf den sie zeigte, gehen weg.
      await merke({
        captureStatus: status,
        pendingCapture: false,
        pendingTab: null,
        pendingSource: null,
      });
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
    // JOB 3606 · Befund (b): DER WECHSEL WIRD IMMER FESTGEHALTEN, auch während gearbeitet wird.
    // Vorher stieg diese Zeile bei `busy || captureBusy` aus — wer den Tab wechselte, während die
    // Leiste sicherte, dessen Wechsel war danach nicht mehr nachweisbar. Der aktive Tab ist eine
    // Tatsache über den Browser, kein Ergebnis eines Vorgangs; er wird deshalb unabhängig von jeder
    // Sperre gemerkt, und `view()` liest ihn (s. `sourceChanged`).
    await merke({ activeTabId: tabId });
    const state = await read();
    if (!state.work || busy || captureBusy) return;
    if (tabId !== state.work.selection.tabId || (url && url !== state.work.selection.url)) {
      await chrome.storage.session.set({ sourceChangedId: state.work.id });
    }
  }
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    await changed(tabId);
    // BPA-01 · AC02: ein anderer aktiver Tab entwertet die Kontextkarte.
    await kontextWechsel({ art: "tab", tabId });
  });
  chrome.tabs.onUpdated.addListener(async (tabId, info) => {
    if (info.url && (await read()).work?.selection.tabId === tabId) await changed(tabId, info.url);
    // BPA-01 · AC04/AC09: Navigation. Mit Adresse entscheidet die Herkunft über die Freigabe und
    // das Dokument über die Karte. Ohne Adresse (Chrome nennt sie nur mit Zugriff) beginnt ein neues
    // Dokument unbekannter Lage: die Karte wird ungültig, die Freigabe prüft Chrome beim nächsten
    // Lesen selbst.
    if (info.url) await kontextWechsel({ art: "navigation", tabId, url: info.url });
    else if (info.status === "loading") await kontextWechsel({ art: "dokument", tabId });
  });
  chrome.tabs.onRemoved?.addListener((tabId) => kontextWechsel({ art: "geschlossen", tabId }));
})();

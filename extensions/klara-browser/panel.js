(() => {
  /** @param {string} id @returns {HTMLInputElement} */
  const $ = (id) => {
    const element = document.getElementById(id);
    if (!element) throw new Error("Missing panel element");
    return /** @type {HTMLInputElement} */ (element);
  };
  // JOB 3279 (Pedi 08.09.): Deutsch ist der Standard. Die Browsersprache entscheidet NICHT mehr —
  // sie greift nur, wenn die gespeicherte Wahl gar nicht gelesen werden kann.
  let language = "de";
  /** @type {import("./types").View} */
  let current = { status: "no_selection" };
  /** @type {string | null | undefined} */
  let loadedId = null;
  let drawn = "";
  let busy = false;
  let queue = Promise.resolve();
  /** @type {import("./types").Mode[]} */
  const MODES = ["selection", "article", "page"];
  // Dieselbe Tagmenge wie im Entwurfskörper (worker.js ALLOWED). Die Vorschau baut den Baum mit
  // createElement — kein HTML aus der Seite wird je als Markup gedeutet.
  /** @type {Record<string, string[]>} */
  const RENDER = {
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
  const IMAGE_SRC = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
  /** @param {string} key */
  const t = (key) =>
    globalThis.KLARA_TEXT[language][key] ?? globalThis.KLARA_TEXT[language].storage_error;
  // JOB 3278 · Pflichtlieferung 4: der Ton der EINEN Zustandszeile. Er ist eine Tabelle und keine
  // Heuristik über den Text — „gespeichert" ist grün, jedes gescheiterte Speichern rot mit Grund,
  // jeder Zwischen- und Hinweiszustand gelb. Ruhe, Vorschau und ein sauberer Abbruch tragen KEINE
  // Fläche; sie sind kein Ereignis. Der Test verlangt, dass diese vier Mengen zusammen jeden
  // Zustandstext abdecken — ein neuer Text ohne Ton ist rot, nicht still neutral.
  const TON = {
    ok: ["saved", "logged_out"],
    crit: [
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
      "storage_error",
      "invalid_message",
      "forbidden_sender",
      "capture_failed",
      "logged_out_local",
    ],
    warn: [
      "saving",
      "busy",
      "unsupported",
      "empty",
      "selection_too_large",
      "source_changed",
      "cancelled_uncertain",
      "account_changed",
      "stale_preview",
      "logout_first",
    ],
    "": ["no_selection", "preview", "previewState", "previewEdited", "cancelled"],
  };
  /** @param {string} status */
  const ton = (status) =>
    Object.keys(TON).find((klasse) =>
      /** @type {Record<string, string[]>} */ (TON)[klasse].includes(status),
    ) ?? "crit";
  const form = () => ({
    title: $("title").value,
    context: $("context").value,
    confidentiality: $("confidentiality").value,
  });
  /** @param {HTMLElement} target */
  function clear(target) {
    while (target.firstChild) target.removeChild(target.firstChild);
  }
  /**
   * Der Vorschaubaum, den der Worker geschickt hat — derselbe, aus dem sein bodyHtml entsteht.
   * @param {HTMLElement} target @param {import("./types").Piece[]} pieces
   */
  function paint(target, pieces) {
    for (const piece of pieces) {
      if (piece.tag === "#text") {
        const parts = String(piece.text ?? "").split(/\r\n|\r|\n/);
        for (let index = 0; index < parts.length; index += 1) {
          if (index > 0) target.appendChild(document.createElement("br"));
          target.appendChild(document.createTextNode(parts[index] ?? ""));
        }
        continue;
      }
      const allowed = RENDER[piece.tag];
      if (!allowed) continue;
      if (piece.tag === "img" && !IMAGE_SRC.test(piece.attrs?.src ?? "")) continue;
      const element = document.createElement(piece.tag);
      for (const name of allowed) {
        const value = piece.attrs?.[name];
        if (typeof value === "string") element.setAttribute(name, value);
      }
      if (piece.tag !== "img" && piece.tag !== "br") paint(element, piece.children ?? []);
      target.appendChild(element);
    }
  }
  /** @param {import("./types").View} next */
  function controls(next = current) {
    $("save").disabled =
      busy ||
      !next.user ||
      !next.selection ||
      // JOB 3279 R2: ohne gewählten Umfang gibt es nichts zu speichern. Der Knopf bleibt gesperrt,
      // bis die Wahl getroffen ist — statt still die ganze Seite mitzunehmen.
      !next.mode ||
      !$("confirm").checked ||
      !$("title").value.trim() ||
      next.status === "saved";
    for (const id of [
      "title",
      "context",
      "confidentiality",
      "confirm",
      "cancel",
      "refresh",
      "logout",
      "login",
    ])
      $(id).disabled = busy;
    for (const mode of MODES)
      $(`mode-${mode}`).disabled = busy || !next.variants?.[mode]?.available;
  }
  /** @param {import("./types").View} next */
  function render(next) {
    current = next;
    document.documentElement.lang = language;
    $("language").value = language;
    for (const node of document.querySelectorAll("[data-i18n]"))
      node.textContent = t(node.getAttribute("data-i18n") ?? "");
    $("status").textContent = t(
      next.status === "preview" ? (next.attempted ? "previewEdited" : "previewState") : next.status,
    );
    $("status").className = ton(next.status);
    $("rest").hidden = Boolean(next.selection);
    $("pending-capture").hidden = !next.pendingCapture;
    $("account").textContent = next.user?.email ?? t("signedOut");
    $("login-form").hidden = Boolean(next.user);
    $("logout").hidden = !next.user;
    $("preview").hidden = !next.selection;
    if (next.selection) {
      $("page").textContent = next.selection.title;
      $("source").textContent = next.selection.url;
      $("captured").textContent = next.selection.capturedAt;
      $("scope-value").textContent = next.mode
        ? t(
            `mode${next.mode === "article" ? "Article" : next.mode === "page" ? "Page" : "Selection"}`,
          )
        : t("scopeNone");
      $("scope-none").hidden = Boolean(next.mode);
      $("ai-chat").hidden = next.aiChat !== true;
      $("source-changed").hidden = !next.sourceChanged;
      for (const mode of MODES) {
        const variant = next.variants?.[mode];
        $(`mode-${mode}`).checked = next.mode === mode;
        $(`info-${mode}`).textContent = variant?.available
          ? `· ${variant.text.length} ${t("chars")}${variant.images ? ` · ${variant.images} ${t("images")}` : ""}`
          : `· ${t("scopeEmpty")}`;
      }
      const gaps = next.gaps ?? [];
      $("gaps-box").hidden = gaps.length === 0;
      clear($("gaps"));
      for (const gap of gaps) {
        const item = document.createElement("li");
        item.textContent = gap.detail
          ? `${t(`gap_${gap.kind}`)}: ${gap.detail}`
          : t(`gap_${gap.kind}`);
        $("gaps").appendChild(item);
      }
      $("image-note").hidden =
        ((next.mode ? next.variants?.[next.mode] : undefined)?.images ?? 0) === 0;
      // Der Baum wird nur neu gezeichnet, wenn sich der Inhalt geändert hat. Ein Sprachwechsel
      // ändert ihn NICHT — die Vorschau bleibt dieselbe, nur die Beschriftungen wechseln.
      const mark = [
        next.captureId,
        next.mode,
        next.form?.title,
        next.form?.context,
        next.form?.confidentiality,
      ].join(" ");
      if (mark !== drawn) {
        clear($("content"));
        paint($("content"), next.preview ?? []);
        drawn = mark;
      }
      if (loadedId !== next.captureId) {
        $("title").value = next.form?.title ?? "";
        $("context").value = next.form?.context ?? "";
        $("confidentiality").value = next.form?.confidentiality ?? "";
        $("confirm").checked = false;
        loadedId = next.captureId;
      }
    } else {
      for (const id of ["title", "context", "confidentiality"]) $(id).value = "";
      for (const id of ["page", "source", "captured", "scope-value"]) $(id).textContent = "";
      clear($("content"));
      clear($("gaps"));
      drawn = "";
      loadedId = null;
      $("confirm").checked = false;
    }
    $("done").hidden = !(next.status === "saved" && next.link);
    $("open").removeAttribute("href");
    if (next.status === "saved" && next.link) {
      const url = new URL(next.link);
      if (
        url.origin === "https://app.klarwerk.ai" &&
        url.pathname === "/capture/frontdoor" &&
        [...url.searchParams.keys()].join() === "draft" &&
        !url.hash
      )
        $("open").setAttribute("href", url.href);
    }
    controls(next);
  }
  /** @param {import("./types").Message} message @param {boolean} lock */
  function send(message, lock = true) {
    if (lock) {
      busy = true;
      controls();
    }
    queue = queue.then(async () => {
      try {
        render(await chrome.runtime.sendMessage(message));
      } catch {
        render({ ...current, status: "uncertain", link: undefined });
      } finally {
        busy = false;
        controls();
        // Diese Antwort ist gerade gezeichnet worden. War sie schon veraltet, als sie ankam, holt
        // `erledigt()` genau hier nach — sonst bliebe die Leiste auf ihr stehen. Siehe `refresh()`.
        erledigt();
      }
    });
    return queue;
  }
  /** @param {string} value */
  function remember(value) {
    try {
      void chrome.storage.local.set({ language: value });
    } catch {
      // Ohne lokalen Speicher bleibt die Wahl für diese Sitzung; nichts wird still behauptet.
    }
  }
  $("language").addEventListener("change", () => {
    language = $("language").value === "en" ? "en" : "de";
    remember(language);
    render(current);
  });
  $("confirm").addEventListener("change", () => controls());
  for (const mode of MODES)
    $(`mode-${mode}`).addEventListener("change", () => {
      if (busy || $(`mode-${mode}`).disabled || current.mode === mode) return;
      // Ein anderer Umfang ist ein anderer Inhalt: die Bestätigung verfällt und muss neu erfolgen.
      $("confirm").checked = false;
      void send({ type: "mode", captureId: current.captureId, mode });
    });
  for (const id of ["title", "context", "confidentiality"])
    $(id).addEventListener("input", () => {
      $("confirm").checked = false;
      controls();
      void send({ type: "edit", captureId: current.captureId, form: form() }, false);
    });
  $("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy) return;
    const password = $("password").value;
    $("password").value = "";
    $("confirm").checked = false;
    void send({ type: "login", email: $("email").value, password });
  });
  $("refresh").addEventListener("click", () => {
    if (!busy) void send({ type: "state" });
  });
  $("logout").addEventListener("click", () => {
    if (!busy) void send({ type: "logout" });
  });
  $("cancel").addEventListener("click", () => {
    if (!busy) void send({ type: "cancel", captureId: current.captureId });
  });
  $("save").addEventListener("click", () => {
    if (busy || $("save").disabled || !$("confirm").checked) return;
    $("confirm").checked = false;
    void send({ type: "save", captureId: current.captureId, form: form() });
  });
  // ================================================================================================
  // JOB 3279 R2 — DIE LEISTE STEHT OFFEN NEBEN DER SEITE UND MUSS VON SELBST NACHZIEHEN.
  // ================================================================================================
  //
  // Seit JOB 3278 ist Klara eine SEITENLEISTE, kein Tab mehr: sie bleibt offen, während Pedi
  // weiterliest und die nächste Passage markiert. Bis hierher verarbeitete dieser Zuhörer aber nur
  // die LÖSCHUNG von `work`. Eine neue Übernahme — und ebenso „verwerfen, dann neu markieren" —
  // erschien deshalb erst nach einem Druck auf „Status erneut prüfen". Die Leiste stand daneben und
  // zeigte Leere, obwohl der Worker längst eine Vorschau hatte.
  //
  // GEFRAGT WIRD DER WORKER, NICHT DER SPEICHER. Aus dem Rohsatz in `chrome.storage.session` ließe
  // sich die Ansicht zwar zusammenbauen — das wäre eine ZWEITE Auffassung davon, was eine Vorschau
  // ist, neben `view()` im Worker. Der Zuhörer stellt deshalb nur fest, DASS sich etwas geändert
  // hat, und holt die Ansicht dort, wo sie entsteht.
  //
  // R3 (Bens Korrekturpflicht 1 aus Runde 2): DER BEDARF WIRD GEMERKT, NIE VERWORFEN.
  // Runde 2 gab bei `busy` einfach auf. Das trifft ausgerechnet den Aufbau der Leiste: die letzte
  // Zeile dieser Datei fragt den Zustand mit Sperre ab, und wer Klara während einer laufenden
  // Erfassung öffnet, bekommt auf diese Frage noch die LEERE Antwort. Das Erfassungsergebnis traf
  // in genau diesem Fenster ein, fand `busy` vor und war weg — die Leiste stand leer neben einer
  // fertigen Vorschau, bis jemand „Status erneut prüfen" drückte. Ein gemerkter Bedarf kostet ein
  // Flag; ein verlorener kostet den ganzen Weg.
  let refreshing = false;
  let nachholen = false;
  function refresh() {
    // Läuft schon eine Abfrage — eine Nutzeraktion (`busy`) oder eine eigene Auffrischung —, wird
    // ihre Antwort abgewartet: dazwischenzufunken hiesse, sie zu überholen. Der Bedarf wird gemerkt
    // und nach ihrem Abschluss genau einmal nachgeholt (`erledigt()`), nicht fallen gelassen.
    // Auch ein Erfassungsvorgang schreibt ZWEIMAL (`work`, dann `captureStatus`/`pendingCapture`);
    // dieselbe Merkstelle trägt beide Meldungen.
    if (busy || refreshing) {
      nachholen = true;
      return;
    }
    refreshing = true;
    const fertig = () => {
      refreshing = false;
      erledigt();
    };
    void send({ type: "state" }, false).then(fertig, fertig);
  }
  /**
   * Der gemerkte Bedarf, genau einmal. Läuft noch etwas, geschieht hier nichts — der laufende
   * Vorgang ruft am Ende selbst wieder hier an. Das Flag wird VOR dem Fragen gelöscht: eine
   * Meldung, die während der Nachholung eintrifft, setzt es neu und wird ihrerseits nachgeholt.
   * Ohne neue Meldung endet die Kette — es entsteht keine Abfrageschleife.
   */
  function erledigt() {
    if (!nachholen || busy || refreshing) return;
    nachholen = false;
    refresh();
  }
  /**
   * Welche Speicheränderung eine neue Ansicht verlangt.
   *
   * BEWUSST NICHT „jede Änderung an `work`": `failure()` im Worker schreibt bei einem
   * Fehlschlag denselben Vorgang zurück. Ein Zuhörer, der darauf neu lädt, fragt erneut, scheitert
   * erneut, schreibt erneut — offline wäre das eine Endlosschleife über das Netz. Gemeldet wird
   * deshalb nur, was WIRKLICH eine andere Übernahme ist: eine andere Kennung, eine gelöschte
   * Übernahme, oder ein neues Erfassungsergebnis.
   * @param {{work?: {newValue?: import("./types").Work}}} changes
   */
  function andereUebernahme(changes) {
    if (!("work" in changes)) return false;
    const next = changes.work?.newValue;
    return !next || next.id !== current.captureId;
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "session") return;
    if (changes.sourceChangedId?.newValue === current.captureId) {
      current.sourceChanged = true;
      $("source-changed").hidden = false;
    }
    // Another extension view can sign out. Clear its sensitive DOM immediately.
    if (changes.auth && !changes.auth.newValue) {
      $("password").value = "";
      $("confirm").checked = false;
      render({ ...current, user: undefined, status: "expired", link: undefined });
    }
    // Deckt beide Folgen aus dem Befund ab: Leiste offen VOR der ersten Erfassung, und Verwerfen
    // gefolgt von einer neuen Markierung. Beide erreichen die Leiste jetzt ohne „Status prüfen".
    if (andereUebernahme(changes) || "captureStatus" in changes || "pendingCapture" in changes)
      refresh();
  });
  render(current);
  // Die gespeicherte Sprachwahl kommt asynchron; sie wechselt nur Beschriftungen, nie Inhalt.
  void (async () => {
    try {
      const stored = await chrome.storage.local.get({ language: null });
      if (stored?.language === "de" || stored?.language === "en") language = stored.language;
    } catch {
      language = navigator.language.startsWith("de") ? "de" : "en";
    }
    render(current);
  })();
  void send({ type: "state" });
})();

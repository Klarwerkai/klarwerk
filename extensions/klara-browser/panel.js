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
  const MODES = ["selection", "article", "page", "clipboard"];
  /** Die zwei Sprachen der Leiste — und die einzigen, die im Öffnen-Link stehen dürfen. */
  const SPRACHEN = ["de", "en"];
  const DRAFT_ID = /^[\w-]{1,128}$/;
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
    ok: ["saved", "updated", "logged_out"],
    crit: [
      // JOB 3412: der Sammelausgang `clipboard_denied` ist ERSETZT. Was übrig bleibt, ist ein
      // echter Ausfall: die Leiste durfte lesen und es ging trotzdem schief. Der Fall „darf nicht
      // lesen" ist kein Ausfall mehr, sondern eine Nachfrage mit gangbarem Weg — er steht unten.
      "clipboard_failed",
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
      // JOB 3280: drei Lagen mit einem klaren nächsten Schritt — sie sind kein Ausfall, sondern
      // eine Nachfrage. Gelb, nicht rot; und keine von ihnen hat etwas gesendet.
      "clipboard_empty",
      // JOB 3412: „Klara darf die Zwischenablage nicht lesen" ist gelb, nicht rot — es ist kein
      // Ausfall, sondern eine Nachfrage mit einem Griff, der nachweislich funktioniert (Cmd+V in
      // das Feld). Nichts ging verloren, nichts wurde gesendet.
      "clipboard_manual",
      "classification_locked",
      "origin_missing",
      // JOB 3280 R3: der Inhalt steht still, bis die unklare Anlage geklärt ist. Nichts ging
      // verloren und nichts wurde gesendet — eine Nachfrage, kein Ausfall.
      "unresolved_create",
    ],
    "": [
      "no_selection",
      "preview",
      "previewState",
      "previewEdited",
      "previewUnresolved",
      "previewSameDraft",
      "cancelled",
    ],
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
    origin: $("origin").value,
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
      // JOB 3280: eingefügter Text ohne Herkunftsangabe wird nicht gespeichert. Dieselbe Grenze
      // zieht der Worker (`payload`, `origin_missing`) — hier ist sie nur sichtbar, nicht neu.
      (next.mode === "clipboard" && !$("origin").value) ||
      !$("confirm").checked ||
      !$("title").value.trim() ||
      next.status === "saved" ||
      next.status === "updated";
    for (const id of [
      "title",
      "context",
      "confidentiality",
      "origin",
      "confirm",
      "cancel",
      "refresh",
      "logout",
      "login",
    ])
      $(id).disabled = busy;
    // JOB 3280 R3: solange eine Anlage unklar ist, steht der INHALT still — Einfügen, das Textfeld
    // und die Umfangswahl sind gesperrt, die Angaben daneben nicht. Der Worker zieht dieselbe
    // Grenze (`unresolved_create`); hier ist sie nur sichtbar, damit niemand vergeblich klickt —
    // und niemand die Zwischenablage freigibt, deren Inhalt danach abgewiesen würde.
    const ungeklaert = next.unresolvedCreate === true;
    for (const id of ["paste", "clipboard"]) $(id).disabled = busy || !next.selection || ungeklaert;
    for (const mode of MODES)
      $(`mode-${mode}`).disabled = busy || !next.variants?.[mode]?.available || ungeklaert;
  }
  /** Der Wirt einer Adresse, oder die Adresse selbst — nie ein geratener Name. @param {string} url */
  const wirt = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };
  /** @param {import("./types").View} next */
  function render(next) {
    current = next;
    document.documentElement.lang = language;
    $("language").value = language;
    for (const node of document.querySelectorAll("[data-i18n]"))
      node.textContent = t(node.getAttribute("data-i18n") ?? "");
    // JOB 3280 · CHR-06: ist der offene Tab wirklich ein KI-Chat, steht sein NAME in der Wahl —
    // abgelesen vom Host des erfassten Tabs, nicht geraten. Ist er es nicht, bleibt die
    // allgemeine Beschriftung stehen; ein „(ChatGPT)" über einer beliebigen Seite wäre erfunden.
    $("origin-ki").textContent =
      next.aiChat === true && next.selection
        ? `${t("originKiChat")} (${wirt(next.selection.url)})`
        : t("originKiChat");
    $("status").textContent = t(
      next.status === "preview"
        ? // JOB 3280: gibt es zu dieser Übernahme schon einen Entwurf, ist der Satz „Änderungen
          // erzeugen einen neuen Vorgang" falsch geworden — sie gehen jetzt in denselben Entwurf.
          next.draftId
          ? "previewSameDraft"
          : // JOB 3280 R3: ist die Anlage unklar, sagt die Zeile GENAU DAS — und was das nächste
            // Sichern damit tut. „Ein neuer Vorgang" wäre hier falsch: es wird zuerst der alte
            // wiederholt und die Änderung geht danach in denselben Entwurf.
            next.unresolvedCreate === true
            ? "previewUnresolved"
            : next.attempted
              ? "previewEdited"
              : "previewState"
        : next.status,
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
      // JOB 3280: die Chat-Kennzeichnung gilt der SEITE. Bei eingefügtem Text sagt sie nichts über
      // den Inhalt aus — dort trägt die Herkunftsangabe die Aussage, und nur sie.
      $("ai-chat").hidden = next.aiChat !== true || next.mode === "clipboard";
      $("origin-box").hidden = next.mode !== "clipboard";
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
        // JOB 3280: der eingefügte Text und seine Herkunft stehen im Entwurfskörper — ändert sich
        // einer von beiden, ist die gezeichnete Vorschau nicht mehr das Gespeicherte.
        next.form?.origin,
        next.variants?.clipboard?.text,
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
        $("origin").value = next.form?.origin ?? "";
        $("clipboard").value = next.variants?.clipboard?.text ?? "";
        $("confirm").checked = false;
        loadedId = next.captureId;
      }
    } else {
      for (const id of ["title", "context", "confidentiality", "origin", "clipboard"])
        $(id).value = "";
      for (const id of ["page", "source", "captured", "scope-value"]) $(id).textContent = "";
      clear($("content"));
      clear($("gaps"));
      drawn = "";
      loadedId = null;
      $("confirm").checked = false;
    }
    // JOB 3280 · CHR-07: DER LINK GEHÖRT ZU EINEM BESTÄTIGTEN STAND, SONST GAR NICHT.
    //
    // `link` kommt nur aus einem frisch nachgelesenen Entwurf (`view()` im Worker). `draftId` sagt
    // nur, DASS es einen gibt. Gibt es einen, stimmt der Stand hier aber nicht mit ihm überein,
    // steht die Rückfrage da statt eines Links auf eine überholte Fassung.
    const href = next.link ? oeffnenLink(next.link, language) : null;
    const offen = Boolean(next.draftId) && !href;
    $("open").removeAttribute("href");
    if (href) $("open").setAttribute("href", href);
    $("open").hidden = !href;
    $("open-stale").hidden = !offen;
    $("done").hidden = !href && !offen;
    controls(next);
  }
  /**
   * JOB 3280 (Codex-Nachführung 08.09. 21:19) — DIE LINKPRÜFUNG BLEIBT ENG.
   *
   * Erlaubt sind GENAU dieser Host, GENAU dieser Pfad und GENAU zwei Schlüssel: `draft` (Pflicht,
   * Kennungsform) und `lang` (nur `de` oder `en`). Kein Fragment, kein doppelter Schlüssel, kein
   * dritter Name. Die Sprache wird nicht durchgereicht, sondern hier neu gesetzt — die Leiste weiss
   * als Einzige, welche gerade gewählt ist.
   *
   * WAS `lang` HEUTE BEWIRKT: nichts. Auf diesem Stand liest die Vollapp den Parameter nirgends
   * (`apps/web/src/components/erfassen/Blatt.tsx:216` liest `draft`, sonst niemand etwas), die
   * Sprache kommt dort aus `localStorage` (`apps/web/src/lib/sprachwahl.ts`). Der Parameter ist die
   * HÄLFTE des Vertrags mit JOB 3323 (APP-SPRACHSCHALTER) und behauptet nichts: kein Text in dieser
   * Leiste sagt, dass Klarwerk in der gewählten Sprache aufgeht.
   * @param {string} link @param {string} sprache @returns {string | null}
   */
  function oeffnenLink(link, sprache) {
    let url;
    try {
      url = new URL(String(link));
    } catch {
      return null;
    }
    if (
      url.origin !== "https://app.klarwerk.ai" ||
      url.pathname !== "/capture/frontdoor" ||
      url.hash
    )
      return null;
    const schluessel = [...url.searchParams.keys()];
    if (
      new Set(schluessel).size !== schluessel.length ||
      schluessel.some((name) => name !== "draft" && name !== "lang")
    )
      return null;
    const draft = url.searchParams.get("draft") ?? "";
    const mitgeliefert = url.searchParams.get("lang");
    if (!DRAFT_ID.test(draft) || (mitgeliefert !== null && !SPRACHEN.includes(mitgeliefert)))
      return null;
    const ziel = new URL(url.origin + url.pathname);
    ziel.searchParams.set("draft", draft);
    ziel.searchParams.set("lang", SPRACHEN.includes(sprache) ? sprache : "de");
    return ziel.href;
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
  for (const id of ["title", "context", "confidentiality", "origin"])
    $(id).addEventListener("input", () => {
      $("confirm").checked = false;
      controls();
      void send({ type: "edit", captureId: current.captureId, form: form() }, false);
    });
  // ================================================================================================
  // JOB 3280 · CHR-06 / JOB 3412 — DIE ZWISCHENABLAGE WIRD GENAU EINMAL GELESEN: HIER, AUF KLICK.
  // ================================================================================================
  //
  // `navigator.clipboard.readText()` steht in dieser Datei GENAU EINMAL, und zwar in diesem
  // Klickzuhörer. Kein Aufruf beim Laden, keiner beim Fokuswechsel, keiner im Takt — ein
  // Dauerleser der Zwischenablage wäre ein Mitleser fremder Passwörter.
  //
  // WAS HIER BIS JOB 3412 FALSCH STAND. Der Kommentar sagte: „Das Manifest trägt deshalb auch KEIN
  // `clipboardRead`: ohne Dauerrecht fragt Chrome beim ersten Mal nach." Die Liveprobe vom 09.09.
  // (`gespraech/arbeitsfenster-20260909/CHATGPT-ABNAHME.md`) widerlegt beide Hälften des Satzes: es
  // kam KEIN Dialog, und Cmd+V im selben Feld fügte den Text unmittelbar danach ein. Am Bestand
  // abzulesen war auch der Grund — `manifest.json` führte `clipboardRead` weder fest NOCH optional,
  // es gab also gar kein Recht, über das Chrome hätte fragen können. Der Klick scheiterte still,
  // und die Leiste gab dem Menschen einen Rat, den er nicht befolgen konnte.
  //
  // WAS JETZT GESCHIEHT, alles in DERSELBEN Klickgeste:
  //   1. `chrome.permissions.request({ permissions: ["clipboardRead"] })` fragt das OPTIONALE Recht
  //      an (`manifest.json`, `optional_permissions`). Die Zusage dazu lautet GENAU SO: keine
  //      Pflichtberechtigung im Manifest; kein Lesen der Zwischenablage ohne Klick. Ein erteiltes
  //      optionales Recht kann bestehen bleiben — Chrome verwaltet es weiter, bis der Mensch es
  //      entzieht, und ein späterer `request` darf deshalb sofort `true` liefern, ohne Dialog
  //      (developer.chrome.com/docs/extensions/reference/api/permissions). „Kein Dauerrecht" stand
  //      hier bis Runde 2 und war falsch: optional sagt etwas über die ANFRAGE, nichts über die
  //      DAUER. Was die Erweiterung zusichern kann, ist der Klick davor — und der steht hier.
  //   2. Ist es erteilt (oder schon vorhanden), wird gelesen.
  //   3. Sonst nennt die Zeile den Weg, der nachweislich funktioniert: in das Textfeld klicken und
  //      Cmd+V bzw. Strg+V drücken. Kein Verweis auf einen Dialog, dessen Erscheinen niemand
  //      zusichern kann.
  //
  // DREI AUSGÄNGE, DREI SÄTZE, KEINER MEINT EINEN ANDEREN MIT: `clipboard_manual` (darf nicht
  // lesen), `clipboard_empty` (durfte, fand aber nichts), `clipboard_failed` (durfte, ging schief).
  // In allen dreien bleiben eingefügter Text, Umfang, Herkunftswahl und Öffnen-Link unangetastet.
  /**
   * Das optionale Recht, angefragt in der Klickgeste. `true` heisst „erteilt" — auch dann, wenn es
   * schon vorlag; Chrome fragt in dem Fall gar nicht erst.
   *
   * WARUM DIE TYPZUSICHERUNG HIER STEHT und nicht in `types.d.ts`, wo die übrige
   * Chrome-Schnittstelle beschrieben ist: diese Datei liegt ausserhalb der Zielpfade von JOB 3412
   * (in der Rückgabe unter ABWEICHUNGEN genannt). Die Zusicherung ist deshalb eng auf genau diesen
   * einen Aufruf begrenzt.
   *
   * Ein fehlender Zweig ist KEIN Fehler, sondern der Fall „dieser Browser kennt die Anfrage nicht";
   * er führt in denselben ehrlichen Satz wie eine Ablehnung.
   * @returns {Promise<boolean>}
   */
  async function darfLesen() {
    const rechte =
      /** @type {{ permissions?: { request(anfrage: { permissions: string[] }): Promise<boolean> } }} */ (
        /** @type {unknown} */ (chrome)
      ).permissions;
    if (!rechte) return false;
    try {
      return (await rechte.request({ permissions: ["clipboardRead"] })) === true;
    } catch {
      return false;
    }
  }
  $("paste").addEventListener("click", async () => {
    if (busy || $("paste").disabled) return;
    // Der Öffnen-Link bleibt in JEDEM der drei Ausgänge stehen: am gespeicherten Entwurf hat sich
    // nichts geändert, es wurde gar nichts gesendet. Ihn wegzunehmen wäre eine Folge ohne Ursache.
    // Ebenso bleiben der bereits eingefügte Text, der gewählte Umfang und die Herkunftswahl —
    // `render()` schreibt die Felder nur bei einer ANDEREN Übernahme neu (`loadedId`).
    if (!(await darfLesen())) {
      render({ ...current, status: "clipboard_manual" });
      return;
    }
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch (fehler) {
      // Der NAME des Fehlers trennt die beiden Ausgänge, nicht seine Bauart (`instanceof` griffe
      // über eine Fensterrealm-Grenze hinweg ins Leere). `NotAllowedError` heisst „darf gerade
      // nicht" — das deckt auch die nicht fokussierte Leiste mit ab, und beide Lagen löst derselbe
      // Griff: in das Feld klicken (das gibt ihm den Fokus) und einfügen. Jeder ANDERE Name heisst
      // „ging schief" und bekommt seinen eigenen Satz, statt als Verweigerung ausgegeben zu werden.
      const name = /** @type {{ name?: unknown }} */ (fehler)?.name;
      render({
        ...current,
        status: name === "NotAllowedError" ? "clipboard_manual" : "clipboard_failed",
      });
      return;
    }
    if (!text.trim()) {
      render({ ...current, status: "clipboard_empty" });
      return;
    }
    $("clipboard").value = text;
    // Ein anderer Inhalt ist eine andere Übernahme: die Bestätigung verfällt und muss neu erfolgen.
    $("confirm").checked = false;
    // Die Herkunft wird VORGESCHLAGEN, nicht gesetzt: ein KI-Chat im offenen Tab ist ein Hinweis,
    // kein Beleg. Steht schon eine Wahl da, bleibt sie — der Vorschlag überschreibt nie.
    if (!$("origin").value && current.aiChat === true) $("origin").value = "ki_chat";
    void send({ type: "clipboard", captureId: current.captureId, text }).then(() =>
      send({ type: "edit", captureId: current.captureId, form: form() }, false),
    );
  });
  $("clipboard").addEventListener("input", () => {
    $("confirm").checked = false;
    controls();
    void send(
      { type: "clipboard", captureId: current.captureId, text: $("clipboard").value },
      false,
    );
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

(() => {
  /** @param {string} id @returns {HTMLInputElement} */
  const $ = (id) => {
    const element = document.getElementById(id);
    if (!element) throw new Error("Missing panel element");
    return /** @type {HTMLInputElement} */ (element);
  };
  let language = navigator.language.startsWith("de") ? "de" : "en";
  /** @type {import("./types").View} */
  let current = { status: "no_selection" };
  /** @type {string | null | undefined} */
  let loadedId = null;
  let busy = false;
  let queue = Promise.resolve();
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
  function controls() {
    $("save").disabled =
      busy ||
      !current.user ||
      !current.selection ||
      !$("confirm").checked ||
      !$("title").value.trim() ||
      current.status === "saved";
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
      $("text").textContent = next.selection.text;
      $("source-changed").hidden = !next.sourceChanged;
      if (loadedId !== next.captureId) {
        $("title").value = next.form?.title ?? "";
        $("context").value = next.form?.context ?? "";
        $("confidentiality").value = next.form?.confidentiality ?? "";
        $("confirm").checked = false;
        loadedId = next.captureId;
      }
    } else {
      for (const id of ["title", "context", "confidentiality"]) $(id).value = "";
      for (const id of ["text", "page", "source", "captured"]) $(id).textContent = "";
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
    controls();
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
      }
    });
    return queue;
  }
  $("language").addEventListener("change", () => {
    language = $("language").value;
    render(current);
  });
  $("confirm").addEventListener("change", controls);
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
    if (changes.work && !changes.work.newValue)
      render({
        ...current,
        selection: undefined,
        form: undefined,
        link: undefined,
        status: "no_selection",
      });
  });
  render(current);
  void send({ type: "state" });
})();

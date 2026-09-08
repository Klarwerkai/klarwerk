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
  const ready = chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  let busy = false;
  let captureBusy = false;

  /** @param {string | undefined} raw */
  function supported(raw) {
    try {
      const u = new URL(raw ?? "");
      return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
    } catch {
      return false;
    }
  }
  /** @param {string} text */
  const escapeText = (text) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  /** @param {string} text */
  const block = (text) => `<p>${escapeText(text).replace(/\r\n|\r|\n/g, "<br>")}</p>`;
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
    const provenance = `Browser / ${new URL(s.url).hostname}`;
    /** @type {Record<string, string>} */
    const classifications = {
      "": "Offen / Not classified",
      intern: "Intern / Internal",
      vertraulich: "Vertraulich / Confidential",
      streng_vertraulich: "Streng vertraulich / Strictly confidential",
    };
    const classification = classifications[form.confidentiality];
    return {
      title: form.title,
      statement: s.text,
      bodyHtml: `<h2>${escapeText(form.title)}</h2>${block(`${provenance} · Ungeprüfter Entwurf / Unreviewed draft`)}${block(`Seite / Page: ${s.title}`)}${block(`Quelle / Source: ${s.url}`)}${block(`Erfasst / Captured: ${s.capturedAt}`)}${block(`Vertraulichkeit / Confidentiality: ${classification}`)}${block("Quellseite, kein unabhängiger Beleg / Source page, not independent evidence")}<h3>Kontext / Context</h3>${block(form.context)}<h3>Originaltext / Original text</h3>${block(s.text)}`,
      pendingSources: [
        {
          label: provenance,
          url: s.url,
          excerpt: s.text.slice(0, EXCERPT),
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
    ];
    const status = known.includes(code) ? code : "uncertain";
    if (status === "expired") await chrome.storage.session.set({ auth: null });
    if (state.work) {
      state.work.status = status;
      await put(state.work);
    }
    return view(await read(), status);
  }
  /** @param {import("./types").Wire | null} draft @param {import("./types").Work} work @param {import("./types").Payload} sent @param {string} owner @returns {draft is import("./types").ConfirmedDraft} */
  function matches(draft, work, sent, owner) {
    return (
      Boolean(draft) &&
      draft !== null &&
      /^[\w-]{1,128}$/.test(draft.id ?? "") &&
      draft.originalAuthor === owner &&
      draft.payload?.bodyHtml === sent.bodyHtml &&
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
      !["state", "login", "logout", "edit", "save", "cancel"].includes(message.type)
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
            status = !s.text.trim()
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
              await put({
                id: crypto.randomUUID(),
                selection,
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

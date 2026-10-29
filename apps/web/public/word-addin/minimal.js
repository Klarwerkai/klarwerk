/* Word UI-MIN: gemeinsame Navigation und persönliche Ablage über die vorhandenen Dienste.
 * Die Hostadapter behalten Lesen, Freigabe und bewusstes Einfügen. Keine lokale Gesprächsablage.
 */
((root) => {
  "use strict";
  const TEXT = {
    de: {
      name: "Deine Assistenz", menu: "Menü", back: "Zurück zum Gespräch", new: "Neues Gespräch",
      history: "Verlauf", functions: "Meine Funktionen", settings: "Einstellungen", help: "Hilfe",
      context: "Kontext und Datenwege", empty: "Wie kann ich helfen?", loading: "Wird geladen …",
      retry: "Erneut versuchen", error: "Nicht geladen. Bitte erneut versuchen.",
      login: "Bitte anmelden.", saved: "Auf diesem Konto gespeichert", unsaved: "Nicht gespeichert",
      consent: "Gespräch auf diesem Konto speichern", revoke: "Gesprächsspeicherung widerrufen",
      consentInfo: "Fragen, Antworten und Quellen werden erst nach deiner Zustimmung persönlich gespeichert. Die Freigabe für externe KI im Dokument bleibt davon getrennt.",
      erase: "Dieses Gespräch löschen", eraseConfirm: "Dieses gespeicherte Gespräch jetzt löschen?",
      newInfo: "Ein neues Gespräch beginnen? Deine ungesendete Eingabe bleibt erhalten.",
      start: "Beginnen", cancel: "Abbrechen", you: "Du", sources: "Quellen", note: "Als Notiz sichern",
      stop: "Stopp", stopped: "Gestoppt. Bereits ausgeführte Schritte werden dadurch nicht zurückgenommen.",
      working: "Frage wird bearbeitet", details: "Details", storageError: "Antwort sichtbar, Speicherung nicht bestätigt. Erneut laden.",
      account: "Konto", language: "Sprache", display: "Darstellung", system: "System", light: "Hell",
      dark: "Dunkel", dictation: "Diktieren", dictating: "Diktat läuft", noSpeech: "Diktat ist in diesem Host nicht verfügbar. Du kannst die Frage eingeben.",
      read: "Vorlesen", readStop: "Vorlesen stoppen", word: "Word", selection: "Markierung",
      tools: "Word-Werkzeuge", unavailable: "Für diese Funktion bitte anmelden und ein Word-Dokument öffnen.",
      notes: "Notizen", tasks: "Aufgaben", reminders: "Erinnerungen", overview: "Arbeitsüberblick",
      create: "Anlegen", save: "Speichern", delete: "Löschen", title: "Titel", content: "Inhalt",
      done: "Erledigt", open: "Offen", taskFromNote: "Aufgabe aus Notiz", noEntries: "Noch keine Einträge.",
      confirm: "Bewusst übernehmen", date: "Datum", time: "Uhrzeit", zone: "Zeitzone",
      preview: "Vorschau", pause: "Pausieren", resume: "Fortsetzen", end: "Beenden",
      reminderInfo: "Die Erinnerung meldet sich über die vorhandene Klarwerk-Glocke.",
      change: "Bearbeiten", mark: "Prüfen", capture: "Wissen erfassen", compare: "Dokument prüfen",
      terms: "Begriffe", templates: "Vorlagen und Bausteine", calendar: "Kalender", learn: "Lernen und Vormachen",
      writing: "Schreiben und Bildsuche", knowledge: "Bestandsblick und Quellen", finish: "Zurück",
      profile: "Name und Avatar", profileSave: "Profil speichern", avatar: "Avatar", nameLabel: "Name",
      neutral: "Neutral", ki: "Mit KI arbeiten", update: "Neue Fassung laden", memory: "Daten und Freigaben", external: "Verbindungen und externe KI",
    },
    en: {
      name: "Your assistant", menu: "Menu", back: "Back to conversation", new: "New conversation",
      history: "History", functions: "My functions", settings: "Settings", help: "Help",
      context: "Context and data access", empty: "How can I help?", loading: "Loading …",
      retry: "Try again", error: "Could not load. Please try again.", login: "Please sign in.",
      saved: "Saved to this account", unsaved: "Not saved", consent: "Save conversation to this account",
      revoke: "Revoke conversation storage",
      consentInfo: "Questions, answers and sources are saved personally only with your consent. Permission to use external AI with this document remains separate.",
      erase: "Delete this conversation", eraseConfirm: "Delete this saved conversation now?",
      newInfo: "Start a new conversation? Your unsent text will be kept.", start: "Start", cancel: "Cancel",
      you: "You", sources: "Sources", note: "Save as note", stop: "Stop", working: "Processing question",
      stopped: "Stopped. Steps already performed are not undone.", details: "Details",
      storageError: "Answer is visible, but saving was not confirmed. Reload to check.",
      account: "Account", language: "Language", display: "Appearance", system: "System", light: "Light",
      dark: "Dark", dictation: "Dictate", dictating: "Dictating", noSpeech: "Dictation is unavailable in this host. You can type your question.",
      read: "Read aloud", readStop: "Stop reading", word: "Word", selection: "Selection",
      tools: "Word tools", unavailable: "Sign in and open a Word document to use this function.",
      notes: "Notes", tasks: "Tasks", reminders: "Reminders", overview: "Work overview",
      create: "Create", save: "Save", delete: "Delete", title: "Title", content: "Content",
      done: "Done", open: "Open", taskFromNote: "Task from note", noEntries: "No entries yet.",
      confirm: "Confirm", date: "Date", time: "Time", zone: "Time zone", preview: "Preview",
      pause: "Pause", resume: "Resume", end: "End",
      reminderInfo: "The reminder uses the existing Klarwerk notification bell.",
      change: "Edit", mark: "Check", capture: "Capture knowledge", compare: "Check document",
      terms: "Terms", templates: "Templates and building blocks", calendar: "Calendar",
      learn: "Learn and demonstrate", writing: "Writing and image search", knowledge: "Knowledge and sources",
      finish: "Back", profile: "Name and avatar", profileSave: "Save profile", avatar: "Avatar",
      nameLabel: "Name", neutral: "Neutral", ki: "Work with AI", update: "Load new version", memory: "Data and permissions", external: "Connections and external AI",
    },
    nl: {
      name: "Je assistent", menu: "Menu", back: "Terug naar gesprek", new: "Nieuw gesprek",
      history: "Geschiedenis", functions: "Mijn functies", settings: "Instellingen", help: "Hulp",
      context: "Context en gegevens", empty: "Hoe kan ik helpen?", loading: "Laden …",
      retry: "Opnieuw proberen", error: "Niet geladen. Probeer opnieuw.", login: "Meld je aan.",
      saved: "Op dit account opgeslagen", unsaved: "Niet opgeslagen", consent: "Gesprek op dit account opslaan",
      revoke: "Toestemming voor gespreksopslag intrekken",
      consentInfo: "Vragen, antwoorden en bronnen worden alleen met jouw toestemming persoonlijk opgeslagen. Toestemming voor externe AI met dit document blijft apart.",
      erase: "Dit gesprek verwijderen", eraseConfirm: "Dit opgeslagen gesprek nu verwijderen?",
      newInfo: "Een nieuw gesprek beginnen? Je ongestuurde tekst blijft behouden.", start: "Beginnen",
      cancel: "Annuleren", you: "Jij", sources: "Bronnen", note: "Als notitie opslaan", stop: "Stop",
      stopped: "Gestopt. Reeds uitgevoerde stappen worden hiermee niet teruggedraaid.", working: "Vraag verwerken",
      details: "Details", storageError: "Antwoord zichtbaar, maar opslag niet bevestigd. Laad opnieuw.",
      account: "Account", language: "Taal", display: "Weergave", system: "Systeem", light: "Licht",
      dark: "Donker", dictation: "Dicteren", dictating: "Dictaat loopt",
      noSpeech: "Dicteren is niet beschikbaar in deze host. Je kunt de vraag typen.",
      read: "Voorlezen", readStop: "Voorlezen stoppen", word: "Word", selection: "Selectie",
      tools: "Word-hulpmiddelen", unavailable: "Meld je aan en open een Word-document voor deze functie.",
      notes: "Notities", tasks: "Taken", reminders: "Herinneringen", overview: "Werkoverzicht",
      create: "Aanmaken", save: "Opslaan", delete: "Verwijderen", title: "Titel", content: "Inhoud",
      done: "Gedaan", open: "Open", taskFromNote: "Taak uit notitie", noEntries: "Nog geen items.",
      confirm: "Bevestigen", date: "Datum", time: "Tijd", zone: "Tijdzone", preview: "Voorbeeld",
      pause: "Pauzeren", resume: "Hervatten", end: "Beëindigen",
      reminderInfo: "De herinnering gebruikt de bestaande Klarwerk-meldingen.",
      change: "Bewerken", mark: "Controleren", capture: "Kennis vastleggen", compare: "Document controleren",
      terms: "Begrippen", templates: "Sjablonen en bouwstenen", calendar: "Agenda",
      learn: "Leren en voordoen", writing: "Schrijven en afbeeldingen", knowledge: "Kennis en bronnen",
      finish: "Terug", profile: "Naam en avatar", profileSave: "Profiel opslaan", avatar: "Avatar",
      nameLabel: "Naam", neutral: "Neutraal", ki: "Met AI werken", update: "Nieuwe versie laden", memory: "Gegevens en toestemming", external: "Verbindingen en externe AI",
    },
  };
  const AVATARS = ["original", "lichtwesen", "roboter", "eule", "fuchs", "pinguin", "wolke",
    "kompass", "prisma", "wissensbuch", "verbindungsknoten", "monolith", "leuchtkreis"];
  function create(config) {
    const doc = config.document || root.document;
    const byId = (id) => doc.getElementById(id);
    const node = (tag, cls, text) => {
      const el = doc.createElement(tag);
      if (cls) el.className = cls;
      if (text !== undefined) el.textContent = text;
      return el;
    };
    let locale = config.language || "de";
    let page = "home";
    let account = null;
    let generation = 0;
    let conversation = null;
    let profile = null;
    let beforeTurn = Infinity;
    let writeQueue = Promise.resolve();
    let navigating = false;
    const rooms = new Map();
    const active = new Map();
    const t = (key) => (TEXT[locale] || TEXT.de)[key] || TEXT.de[key] || key;
    const button = (key, action, cls = "") => {
      const el = node("button", cls, t(key));
      el.type = "button";
      el.dataset.miniText = key;
      el.addEventListener("click", action);
      return el;
    };
    const status = node("p", "mini-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const shell = node("div", "mini-shell");
    shell.id = "mini-shell";
    doc.body.classList.add("kw-minimal");
    const header = byId(config.header);
    const back = button("back", () => show("home"), "mini-back");
    back.textContent = "‹";
    back.dataset.miniLabel = "back";
    delete back.dataset.miniText;
    const avatar = node("img", "mini-avatar");
    avatar.alt = "";
    avatar.src = "/klara/klara-avatar-v1.png";
    const title = node("strong", "mini-name", t("name"));
    const menuButton = button("menu", () => menu.hidden ? openMenu() : closeMenu(), "mini-menu-button");
    menuButton.textContent = "⋯";
    menuButton.dataset.miniLabel = "menu";
    delete menuButton.dataset.miniText;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-controls", "mini-menu");
    const head = node("header", "mini-head");
    head.append(back, avatar, title, menuButton);
    // Der alte Kopf lebt für seine bestehenden Status-/Profil-Handler in den Kontextdetails weiter.
    const menu = node("nav", "mini-menu");
    menu.id = "mini-menu";
    menu.setAttribute("aria-label", t("menu"));
    menu.hidden = true;
    for (const key of ["new", "history", "functions", "settings", "help"]) {
      const el = button(key, () => { closeMenu(); show(key); });
      el.id = "mini-menu-" + key;
      menu.append(el);
    }
    const context = button("context", () => show("context"), "mini-context");
    context.id = "mini-context";
    const ongoing = node("section", "mini-active");
    ongoing.id = "mini-active";
    ongoing.setAttribute("aria-live", "polite");
    ongoing.setAttribute("aria-label", t("stop"));
    const viewport = node("main", "mini-viewport");
    const home = node("section", "mini-home");
    const feed = node("div", "mini-feed");
    feed.id = "mini-feed";
    const homePanel = byId(config.home);
    const composer = byId(config.composer);
    const homePosition = homePanel.parentNode;
    homePosition.insertBefore(shell, homePanel);
    for (const id of config.homeExtras || []) { const el = byId(id); if (el) home.append(el); }
    home.append(feed, homePanel);
    viewport.append(home);
    shell.append(head, context, menu, ongoing, status, viewport, composer);
    const contextRoom = room("context");
    if (header) contextRoom.append(header);
    for (const id of config.contextDetails || []) {
      const el = byId(id);
      if (el && !header?.contains(el)) contextRoom.append(el);
    }
    const settings = room("settings");
    const data = node("section", "mini-data");
    data.id = "mini-data";
    settings.append(data);
    const version = node("p", "mini-meta", doc.querySelector('meta[name="kw-loaded-version"]')?.content || "dev");
    settings.append(version);
    void config.request(root.location.pathname, "HEAD").then((response) => {
      const available = response.version;
      if (available && available !== version.textContent) settings.append(button("update", () => {
        if (!config.input.value.trim() || root.confirm(t("newInfo"))) root.location.reload();
      }));
    }).catch(() => {});
    for (const id of config.settings || []) {
      const el = byId(id);
      if (el) settings.append(el);
    }
    const help = room("help");
    for (const id of config.help || []) {
      const el = byId(id);
      if (el) help.append(el);
    }
    const functions = room("functions");
    const tools = new Map();
    for (const group of config.tools || []) {
      const tool = room("tool-" + group.key);
      tool.dataset.tool = group.key;
      tools.set(group.key, tool);
      functions.append(button(group.key, () => show("tool-" + group.key), "mini-function"));
    }
    const observer = new root.MutationObserver(() => adoptTools());
    function adoptTools() {
      for (const group of config.tools || []) {
        for (const id of group.ids) {
          const el = byId(id);
          const destination = tools.get(group.key);
          if (el && !destination.contains(el)) destination.append(el);
        }
      }
      for (const id of config.activeElements || []) {
        const el = byId(id);
        if (el && el.parentNode !== ongoing) ongoing.append(el);
      }
    }
    adoptTools();
    observer.observe(doc.body, { childList: true, subtree: true });
    function room(key) {
      if (rooms.has(key)) return rooms.get(key);
      const el = node("section", "mini-room");
      el.id = "mini-page-" + key;
      el.hidden = true;
      el.setAttribute("aria-label", t(key));
      rooms.set(key, el);
      viewport.append(el);
      return el;
    }
    function paint() {
      back.hidden = page === "home";
      title.textContent = page === "home" ? (profile?.name || t("name")) : t(page.replace("tool-", ""));
      context.textContent = config.contextText?.() || t("word");
      context.title = t("context");
      home.hidden = page !== "home";
      for (const [key, el] of rooms) el.hidden = key !== page;
      // Die Eingabe bleibt derselbe Knoten und damit samt Fokus-/Hosthandlern erhalten.
      composer.hidden = page !== "home";
      menuButton.setAttribute("aria-expanded", String(!menu.hidden));
      status.hidden = !status.textContent;
      ongoing.hidden = active.size === 0 && !Array.from(ongoing.children).some(
        (el) => !el.hidden && !el.classList.contains("hidden"),
      );
      config.paint?.(page);
    }
    function show(key) {
      page = key;
      closeMenu();
      navigating = true;
      try { config.navigate?.(key); } finally { navigating = false; }
      if (key === "new") renderNew();
      if (key === "history") void loadConversation(true);
      if (key === "settings") renderData();
      if (key === "context") settings.setAttribute("aria-label", t("settings"));
      paint();
      viewport.scrollTop = 0;
      const heading = rooms.get(key);
      if (heading) { heading.tabIndex = -1; heading.focus(); }
      else if (key === "home") config.input.focus();
    }
    function legacy(name) {
      if (navigating) return;
      const target = { fragen: "home", erfassen: "tool-capture", einstellungen: "settings", hilfe: "help" }[name];
      if (target) { page = target; paint(); }
    }
    function openMenu() {
      menu.hidden = false;
      paint();
      menu.querySelector("button")?.focus();
    }
    function closeMenu() { menu.hidden = true; menuButton.setAttribute("aria-expanded", "false"); }
    doc.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!menu.hidden) { event.preventDefault(); closeMenu(); menuButton.focus(); }
      else if (page !== "home") { event.preventDefault(); show("home"); }
    });
    function notify(text) { status.textContent = text || ""; paint(); }
    async function request(path, method = "GET", body) {
      if (!path.startsWith("/api/")) throw new Error("Same-origin API required");
      const response = await config.request(path, method, body);
      if (response.status < 200 || response.status >= 300) {
        const error = new Error(response.json?.message || "HTTP " + response.status);
        error.status = response.status;
        throw error;
      }
      return response.json;
    }
    async function guarded(action) {
      const stamp = generation;
      try { return await action(stamp); }
      catch (error) { if (stamp === generation) notify(error.status === 401 ? t("login") : error.status === 409 ? error.message : t("error")); }
    }
    const base = "/api/me/klara";
    const conversationPath = () => base + "/gespraeche/" + encodeURIComponent(conversation.id);
    const reference = () => ({
      pfad: root.location.pathname, seitenName: "Word", objekt: "Word", bezug: "frei",
    });
    async function loadConversation(history) {
      return guarded(async (stamp) => {
        if (!account) { if (history) room("history").replaceChildren(node("p", "", t("login"))); return; }
        if (history) room("history").replaceChildren(node("p", "", t("loading")));
        const data = await request(base + "/gespraech");
        if (stamp !== generation) return;
        conversation = data.gespraech;
        renderFeed();
        renderData();
        if (history) renderHistory();
      });
    }
    function renderMessages(parent, messages) {
      parent.replaceChildren();
      for (const message of messages) {
        const article = node("article", "mini-message mini-" + message.von);
        article.append(node("strong", "", message.von === "du" ? t("you") : (profile?.name || t("name"))));
        article.append(node("p", "mini-message-text", message.text));
        if (message.grund) article.append(node("p", "mini-meta", message.grund));
        if (message.quellenAngaben?.length) {
          const details = node("details", "mini-sources");
          details.append(node("summary", "", t("sources")));
          for (const source of message.quellenAngaben) {
            const link = node("a", "", source.titel);
            link.href = config.sourceHref(source.koId);
            link.target = "_blank";
            link.rel = "noopener";
            details.append(link, node("span", "", source.fassung === null ? "" : " · v" + source.fassung));
          }
          article.append(details);
        }
        if (message.von === "klara") {
          article.append(button("note", () => guarded(async (stamp) => {
            const result = await request(base + "/notizen", "POST", {
              vorgang: "word-gespraech-" + message.id, weg: "gespraech",
              quelle: { gespraechId: conversation.id, nachrichtId: message.id },
            });
            if (stamp === generation) notify(t("saved") + ": " + result.notiz.titel);
          }), "mini-inline"));
          if (config.read) article.append(button("read", () => read(message.text), "mini-inline"));
        }
        parent.append(article);
      }
    }
    function renderFeed() {
      renderMessages(feed, (conversation?.nachrichten || []).slice(0, beforeTurn));
    }
    function renderHistory() {
      const el = room("history");
      renderMessages(el, conversation?.nachrichten || []);
      if (!conversation?.nachrichten?.length) el.append(node("p", "mini-meta", t("noEntries")));
      if (conversation?.letzterSchritt) el.append(node("p", "mini-meta", conversation.letzterSchritt.stand));
      el.append(button("finish", () => show("home")));
    }
    async function ensureConversation() {
      if (!conversation) {
        const data = await request(base + "/gespraeche", "POST", { objektbezug: reference() });
        conversation = data.gespraech;
      }
      return conversation;
    }
    function renderData() {
      data.replaceChildren(node("h2", "", t("memory")), node("p", "mini-meta", t("consentInfo")));
      data.append(button(conversation?.einwilligungAm ? "revoke" : "consent", () => guarded(async (stamp) => {
        await ensureConversation();
        if (stamp !== generation) return;
        const response = await request(conversationPath() + "/einwilligung", "PUT", {
          erteilt: !conversation.einwilligungAm,
        });
        if (stamp !== generation) return;
        conversation = response.gespraech;
        renderData();
      })));
      if (conversation) data.append(button("erase", () => {
        if (!root.confirm(t("eraseConfirm"))) return;
        void guarded(async (stamp) => {
          await request(conversationPath(), "DELETE");
          if (stamp !== generation) return;
          conversation = null; beforeTurn = Infinity; renderFeed(); renderData();
        });
      }));
      const languages = node("div", "mini-row");
      languages.append(node("span", "", t("language")));
      for (const lang of ["de", "en", "nl"]) {
        const el = node("button", "", { de: "Deutsch", en: "English", nl: "Nederlands" }[lang]);
        el.type = "button";
        el.setAttribute("aria-pressed", String(locale === lang));
        el.addEventListener("click", () => { setLanguage(lang); config.setLanguage?.(lang); });
        languages.append(el);
      }
      data.append(languages);
      const theme = node("select");
      theme.setAttribute("aria-label", t("display"));
      for (const value of ["system", "light", "dark"]) {
        const option = node("option", "", t(value)); option.value = value; theme.append(option);
      }
      theme.value = doc.documentElement.dataset.wordTheme || "system";
      theme.addEventListener("change", () => { doc.documentElement.dataset.wordTheme = theme.value; });
      data.append(theme);
    }
    function renderNew() {
      const el = room("new");
      el.replaceChildren(node("p", "", t("newInfo")));
      const start = button("start", () => guarded(async (stamp) => {
        start.disabled = true;
        try {
          const result = await request(base + "/gespraeche", "POST", { objektbezug: reference() });
          if (stamp !== generation) return;
          conversation = result.gespraech; beforeTurn = Infinity;
          config.reset?.(); renderFeed(); show("home");
        } finally { start.disabled = false; }
      }));
      start.disabled = active.size > 0;
      el.append(start, button("cancel", () => show("home")));
    }
    function setLanguage(value) {
      locale = Object.hasOwn(TEXT, value) ? value : "de";
      doc.documentElement.lang = locale;
      for (const el of shell.querySelectorAll("[data-mini-text]")) el.textContent = t(el.dataset.miniText);
      for (const el of shell.querySelectorAll("[data-mini-label]")) el.setAttribute("aria-label", t(el.dataset.miniLabel));
      menu.setAttribute("aria-label", t("menu"));
      if (page === "new") renderNew();
      renderFeed(); renderData(); paint();
    }
    async function refreshProfile() {
      if (!account) return;
      return guarded(async (stamp) => {
        const data = await request("/api/me/assistenz");
        if (stamp !== generation) return;
        profile = data.profil;
        const id = profile?.avatar || "original";
        if (AVATARS.includes(id)) avatar.src = id === "original" ? "/klara/klara-avatar-v1.png" :
          "/assistenz/erstauswahl-v1/" + id + ".png";
        else avatar.removeAttribute("src");
        avatar.hidden = !AVATARS.includes(id);
        paint();
      });
    }
    async function setAccount(user) {
      const id = user?.id || user?.user?.id || null;
      if (id === account) return;
      for (const row of active.values()) row.remove(); active.clear();
      if (account !== null) config.onAccountChange?.();
      generation++; account = id; conversation = null; profile = null; beforeTurn = Infinity;
      renderFeed(); renderData(); paint();
      if (!account) return;
      void loadConversation(false);
      void refreshProfile();
    }
    function turn(text) {
      beforeTurn = conversation?.nachrichten?.length || 0;
      renderFeed();
      const snapshot = { generation, id: conversation?.id, consent: !!conversation?.einwilligungAm,
        reference: reference(), text, saved: false };
      if (snapshot.consent) {
        writeQueue = writeQueue.catch(() => {}).then(async () => {
          if (snapshot.generation !== generation) return;
          const path = base + "/gespraeche/" + encodeURIComponent(snapshot.id);
          await request(path + "/nachrichten", "POST", {
            von: "du", modus: "frage", text, objektbezug: snapshot.reference,
          });
          await request(path + "/schritt", "PUT", {
            art: "frage", text, objektbezug: snapshot.reference, stand: "laeuft",
          });
          snapshot.saved = true;
        }).catch(() => { if (snapshot.generation === generation) notify(t("storageError")); });
      }
      return snapshot;
    }
    function answer(snapshot, result) {
      if (!snapshot || snapshot.generation !== generation || !snapshot.consent) return Promise.resolve();
      writeQueue = writeQueue.then(async () => {
        if (!snapshot.saved || snapshot.generation !== generation) return;
        const path = base + "/gespraeche/" + encodeURIComponent(snapshot.id);
        if (result.answerId) {
          await request(path + "/nachrichten", "POST", {
            von: "klara", modus: result.aiGenerated ? "ki" : "ohne_ki",
            text: result.answer || "", objektbezug: snapshot.reference,
            antwortId: result.answerId, quellen: result.sources || [],
          });
        }
        const data = await request(path + "/schritt", "PUT", {
          art: "frage", text: snapshot.text, objektbezug: snapshot.reference,
          stand: result.stopped ? "abgebrochen" : result.answerId ? "beantwortet" : "fehlgeschlagen",
        });
        if (snapshot.generation !== generation) return;
        conversation = data.gespraech;
        if (!result.answerId && !result.stopped) notify(t("storageError"));
      }).catch(() => { if (snapshot.generation === generation) notify(t("storageError")); });
      return writeQueue;
    }
    function activity(id, label, stop) {
      const old = active.get(id); old?.remove(); active.delete(id);
      if (stop) {
        const row = node("div", "mini-active-row");
        row.append(node("span", "", label), button("stop", stop));
        active.set(id, row); ongoing.prepend(row);
      }
      paint();
    }
    function read(text) { config.read?.(text); }
    root.addEventListener("pagehide", () => {
      observer.disconnect();
      for (const stop of config.onPageHide || []) stop();
    });
    if (!config.read) functions.append(node("p", "mini-meta", t("noSpeech")));
    const ui = { t, button, node, room, show, paint, legacy, notify, request, guarded, setAccount, setLanguage,
      turn, answer, activity, reference, read, refreshProfile, ensureConversation,
      get conversationId() { return conversation?.id || null; },
      isToolPage: () => page.startsWith("tool-"), get account() { return account; },
      get generation() { return generation; }, get locale() { return locale; } };
    root.KlarwerkWordFunktionen?.attach(ui, functions, settings);
    setLanguage(locale);
    return ui;
  }
  root.KlarwerkWordMinimal = { create };
})(typeof window === "undefined" ? globalThis : window);

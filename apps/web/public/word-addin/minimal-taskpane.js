/* Die vorhandenen Word-Handler werden an die gemeinsame UI-MIN-Navigation angeschlossen. */
(() => {
  "use strict";
  if (!window.KlarwerkWordMinimal) return;
  const el = (id) => document.getElementById(id);
  const toolRoots = ["section-capture", "kw-einstellungen", "kw-hilfe"];
  window.kwWordUi = window.KlarwerkWordMinimal.create({
    header: "kw-kopf", home: "section-ask", composer: "ask-feld", input: el("ask-input"),
    settings: ["kw-einstellungen"], help: ["kw-hilfe"],
    language: typeof lang === "string" ? lang : "de",
    tools: [
      { key: "capture", ids: ["section-capture"] },
      { key: "compare", ids: ["wv-block"] },
      { key: "terms", ids: ["begriffe-block"] },
      { key: "templates", ids: ["anleitung-block"] },
      { key: "calendar", ids: ["kalender-block"] },
      { key: "learn", ids: ["kw-routinen"] },
      { key: "writing", ids: ["ka6-block", "m5-bild-block"] },
      { key: "knowledge", ids: ["bestand-block", "ka7-block", "ka3-karten", "ka1-block"] },
    ],
    activeElements: ["kw-vormachen"],
    contextText: () => {
      const state = el("klara-s4-mode").textContent;
      return ["Word", typeof askMarkierungDa !== "undefined" && askMarkierungDa ? window.kwWordUi?.t("selection") : "",
        state === "–" ? el("session-status").textContent : state].filter(Boolean).join(" · ");
    },
    sourceHref: (id) => koDetailUrl(window.location.origin, id),
    request: (path, method, body) => fetch(path, {
      method, credentials: "include",
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    }).then(async (res) => ({ status: res.status, json: await res.json().catch(() => null), version: res.headers.get("x-kw-available-version") })),
    navigate: (page) => {
      if (page === "tool-capture") setTab("capture");
      else kwAnsichtSetzen(page === "settings" ? "einstellungen" : page === "help" ? "hilfe" : "fragen");
      if (page.startsWith("tool-")) {
        if (typeof updateAskState === "function") updateAskState();
        if (typeof bestandNeuzeichnen === "function") bestandNeuzeichnen();
        if (typeof m5SichtbarkeitZeichnen === "function") m5SichtbarkeitZeichnen();
        if (typeof ka7SichtbarkeitZeichnen === "function") ka7SichtbarkeitZeichnen();
        if (typeof anleitungZeichnen === "function") anleitungZeichnen();
        if (typeof wvSichtbarkeitZeichnen === "function") wvSichtbarkeitZeichnen();
      }
    },
    paint: (page) => {
      el("section-ask").hidden = page !== "home";
      for (const id of toolRoots) el(id).hidden = id === "section-capture" ? page !== "tool-capture" :
        id === "kw-einstellungen" ? page !== "settings" : page !== "help";
      if (typeof signedIn !== "undefined" && signedIn && !currentAskOutcome) {
        el("ask-ruhe-satz").textContent = window.kwWordUi?.t("empty") || "Wie kann ich helfen?";
      }
    },
    onAccountChange: () => askMinimalAbbrechen(),
    setLanguage: (value) => setLang(value),
    reset: () => { if (!askLaeuft) resetAskResult(); },
    onPageHide: [() => { if (typeof askMinimalAbbrechen === "function") askMinimalAbbrechen(); }],
  });
  const ui = window.kwWordUi;
  const compareStop = el("wv-abbrechen");
  if (compareStop) {
    const refresh = () => ui.activity("word-compare",
      el("wv-stand")?.textContent || ui.t("compare"),
      compareStop.classList.contains("hidden") ? null : () => compareStop.click());
    new MutationObserver(refresh).observe(compareStop, { attributes: true, attributeFilter: ["class", "hidden"] });
    refresh();
  }
  ui.paint();
  // Dieselbe Sitzungsprüfung liefert Konto, Rechte und den S4-Zustand; kein zweites Login.
  checkSession();
})();

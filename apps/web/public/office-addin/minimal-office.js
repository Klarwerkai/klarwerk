/* Derselbe UI-MIN-Kern; alle Office-Wirkungen bleiben im vorhandenen Hostkern/Panel. */
(() => {
  "use strict";
  const panel = window.klaraOfficeFenster;
  if (!panel || !window.KlarwerkWordMinimal) return;
  const el = (id) => document.getElementById(id);
  const home = document.createElement("section");
  home.id = "office-conversation";
  const composer = el("frage-block");
  composer.before(home);
  for (const id of ["antwort", "frage-meldung"]) home.append(el(id));
  const ui = window.KlarwerkWordMinimal.create({
    header: "klara-figur", home: "office-conversation", homeExtras: ["anmeldung-block"],
    composer: "frage-block", input: el("frage-text"), settings: ["zustimmung"], help: ["anleitung"],
    contextDetails: ["host-block", "ki-zeile"],
    tools: [
      { key: "selection", ids: ["kontext-block"] },
      { key: "use", ids: ["rueckgabe-block"] },
      { key: "provenance", ids: ["herkunft-block"] },
    ],
    hostName: () => panel.zustand.host === "excel" ? "Excel" :
      panel.zustand.host === "powerpoint" ? "PowerPoint" : "Office",
    sourceHref: (id) => "/wissen/" + encodeURIComponent(id),
    request: (path, method, body) => panel.abruf(path, {
      method,
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    }).then(async (res) => ({ status: res.status, json: await res.json().catch(() => null),
      version: res.headers.get("x-kw-available-version") })),
    contextText: () => el("kontext-zeile").textContent || "Office",
    paint: () => {
      const account = el("anmeldung-block");
      const destination = panel.zustand.angemeldet ? el("mini-page-settings") : home.parentNode;
      if (destination && account.parentNode !== destination) destination.append(account);
      const source = document.querySelector('[data-mini-tool="provenance"]');
      if (source) {
        source.disabled = panel.zustand.host !== "powerpoint";
        source.title = source.disabled ? "PowerPoint" : "";
      }
    },
    reset: () => {},
    onAccountChange: () => panel.frageAbbrechen(),
    onPageHide: [() => panel.frageAbbrechen()],
  });
  window.kwOfficeUi = ui;
  panel.anmeldungPruefen();
})();

// ================================================================================================
// produkt:wettbewerb:20261003:lernplattform — DIE LAUFZEIT IM PAKET (SCO), ALS FESTER TEXT.
// ================================================================================================
//
// Das SCORM-Paket trägt GENAU EIN Skript (`sco.js`) und GENAU EINEN Stil (`sco.css`). Beide stehen
// hier als Zeichenkette, weil sie unverändert in jedes Paket wandern: der Server führt sie nie aus,
// er legt sie nur ab. Kein Fremdskript, keine Schrift aus dem Netz, kein Analysedienst — das Paket
// lädt ausschliesslich Dateien aus sich selbst (die CSP im `index.html` erzwingt das zusätzlich).
//
// WAS DAS SKRIPT AN DIE LERNPLATTFORM MELDET (SCORM 1.2, RTE 3.4), und nur das:
//   · `cmi.core.lesson_status` — „incomplete" beim ersten Öffnen; „completed" AUSSCHLIESSLICH,
//     wenn jede Lerneinheit angezeigt wurde UND der Lernende auf der letzten Einheit ausdrücklich
//     „Abschließen" gewählt hat. Ein Schließen vorher lässt „incomplete" stehen. Ein bereits
//     gemeldetes „completed"/„passed" wird nie zurückgestuft.
//   · `cmi.core.lesson_location` und `cmi.suspend_data` — die zuletzt gezeigte Einheit und die
//     besuchten Einheiten, damit ein abgebrochener Durchlauf an derselben Stelle weitergeht.
//   · `cmi.core.exit` — „suspend", solange nicht abgeschlossen; sonst leer.
//   · `cmi.core.session_time` — die Dauer dieser Sitzung.
// KEIN Punktwert, KEINE Antworten (`cmi.interactions`): das Paket enthält keine Verständnisprüfung
// (Auftrag 02 ist ausdrücklich nicht Teil dieser Lieferung), es hat also nichts zu bewerten.
//
// OHNE LERNPLATTFORM (Datei direkt geöffnet) zeigt das Paket den Inhalt und sagt ausdrücklich, dass
// nichts gemeldet wird — es tut nicht so, als wäre ein Abschluss angekommen.

export type ScormSprache = "de" | "en";

export const SCORM_SPRACHEN: readonly ScormSprache[] = ["de", "en"];

/** Die festen Beschriftungen der Paketoberfläche — im Paket, nicht in der Klarwerk-Web-App. */
export interface ScormBeschriftung {
  zurueck: string;
  weiter: string;
  abschliessen: string;
  fortschritt: string; // {i} und {n}
  keinLms: string;
  verbunden: string;
  abgeschlossen: string;
  abschlussOffen: string;
  abschlussFehler: string;
  abschlussOhneLms: string;
  kernaussage: string;
  kontext: string;
  vorgehen: string;
  herkunft: string;
  fassung: string;
  quellen: string;
  keineQuellen: string;
  exportfassung: string;
  lernziel: string;
}

export const SCORM_BESCHRIFTUNG: Record<ScormSprache, ScormBeschriftung> = {
  de: {
    zurueck: "Zurück",
    weiter: "Weiter",
    abschliessen: "Abschließen",
    fortschritt: "Lerneinheit {i} von {n}",
    keinLms:
      "Keine Lernplattform verbunden. Der Inhalt wird angezeigt, ein Fortschritt oder Abschluss wird nicht gemeldet.",
    verbunden: "Mit der Lernplattform verbunden.",
    abgeschlossen: "Abschluss an die Lernplattform gemeldet.",
    abschlussOffen: "Noch nicht abgeschlossen: bitte jede Lerneinheit ansehen.",
    abschlussFehler:
      "Die Lernplattform hat den Abschluss nicht angenommen. Er gilt NICHT als gemeldet.",
    abschlussOhneLms: "Nicht gemeldet: Es ist keine Lernplattform verbunden.",
    kernaussage: "Kernaussage",
    kontext: "Kontext / Voraussetzungen",
    vorgehen: "Was zu tun ist",
    herkunft: "Herkunft",
    fassung: "Wissensobjekt {id} · Fassung v{v} · Stand {stand}",
    quellen: "Quellen",
    keineQuellen: "Keine externen Quellen hinterlegt.",
    exportfassung: "Klarwerk-Exportfassung {kennung}",
    lernziel: "Lernziel: Inhalt sicher anwenden können ({kategorie}).",
  },
  en: {
    zurueck: "Back",
    weiter: "Next",
    abschliessen: "Complete",
    fortschritt: "Learning unit {i} of {n}",
    keinLms:
      "No learning platform connected. The content is shown, but no progress or completion is reported.",
    verbunden: "Connected to the learning platform.",
    abgeschlossen: "Completion reported to the learning platform.",
    abschlussOffen: "Not completed yet: please view every learning unit.",
    abschlussFehler:
      "The learning platform did not accept the completion. It is NOT considered reported.",
    abschlussOhneLms: "Not reported: no learning platform is connected.",
    kernaussage: "Key statement",
    kontext: "Context / prerequisites",
    vorgehen: "What to do",
    herkunft: "Origin",
    fassung: "Knowledge object {id} · version v{v} · as of {stand}",
    quellen: "Sources",
    keineQuellen: "No external sources recorded.",
    exportfassung: "Klarwerk export version {kennung}",
    lernziel: "Learning goal: apply the content confidently ({kategorie}).",
  },
};

// Bewusst ES5 ohne Module: SCORM-1.2-Spieler laufen teils in alten Rahmen. Die Texte kommen aus
// `data-*`-Attributen des `<body>`, damit dieses Skript sprachneutral und in jedem Paket gleich ist.
export const SCO_JS = `(function () {
  "use strict";
  var doc = document;
  var body = doc.body;
  var api = null;
  var verbunden = false;
  var beendet = false;
  var abgeschlossen = false;
  var start = new Date().getTime();
  var einheiten = doc.querySelectorAll("section[data-einheit]");
  var n = einheiten.length;
  var besucht = [];
  var aktuell = 0;

  function text(name) { return body.getAttribute("data-text-" + name) || ""; }

  function sucheApi(win) {
    var tiefe = 0;
    while (win && tiefe < 12) {
      try { if (win.API) { return win.API; } } catch (e) { return null; }
      if (!win.parent || win.parent === win) { break; }
      win = win.parent;
      tiefe += 1;
    }
    return null;
  }

  function setze(element, wert) {
    if (!verbunden) { return false; }
    return String(api.LMSSetValue(element, wert)) === "true";
  }

  function lies(element) {
    if (!verbunden) { return ""; }
    return String(api.LMSGetValue(element) || "");
  }

  function sichere() {
    if (verbunden) { api.LMSCommit(""); }
  }

  function meldung(t) {
    var el = doc.getElementById("kw-meldung");
    if (el) { el.textContent = t; }
  }

  function zweistellig(z) { return z < 10 ? "0" + z : String(z); }

  function sitzungsdauer() {
    var s = Math.max(0, Math.round((new Date().getTime() - start) / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    return (h < 1000 ? ("000" + h).slice(-4) : String(h)) + ":" + zweistellig(m) + ":" + zweistellig(r);
  }

  function alleBesucht() {
    for (var i = 0; i < n; i += 1) { if (!besucht[i]) { return false; } }
    return n > 0;
  }

  function zeige(i) {
    if (i < 0 || i >= n) { return; }
    aktuell = i;
    besucht[i] = true;
    for (var k = 0; k < n; k += 1) {
      if (k === i) { einheiten[k].removeAttribute("hidden"); } else { einheiten[k].setAttribute("hidden", ""); }
    }
    doc.getElementById("kw-zurueck").disabled = i === 0;
    doc.getElementById("kw-weiter").hidden = i === n - 1;
    doc.getElementById("kw-abschliessen").hidden = i !== n - 1;
    doc.getElementById("kw-fortschritt").textContent =
      text("fortschritt").replace("{i}", String(i + 1)).replace("{n}", String(n));
    if (verbunden) {
      setze("cmi.core.lesson_location", String(i));
      var liste = [];
      for (var b = 0; b < n; b += 1) { if (besucht[b]) { liste.push(b); } }
      setze("cmi.suspend_data", "besucht:" + liste.join(","));
      sichere();
    }
  }

  function abschliessen() {
    if (!alleBesucht()) { meldung(text("abschluss-offen")); return; }
    if (!verbunden) { meldung(text("abschluss-ohne-lms")); return; }
    if (abgeschlossen) { meldung(text("abgeschlossen")); return; }
    var ok = setze("cmi.core.lesson_status", "completed");
    sichere();
    var fehler = String(api.LMSGetLastError());
    if (ok && fehler === "0") {
      abgeschlossen = true;
      body.setAttribute("data-kw-abgeschlossen", "ja");
      meldung(text("abgeschlossen"));
    } else {
      meldung(text("abschluss-fehler"));
    }
  }

  function beenden() {
    if (beendet || !verbunden) { return; }
    beendet = true;
    setze("cmi.core.session_time", sitzungsdauer());
    setze("cmi.core.exit", abgeschlossen ? "" : "suspend");
    sichere();
    api.LMSFinish("");
  }

  function wiederaufnahme() {
    var daten = lies("cmi.suspend_data");
    if (daten.indexOf("besucht:") === 0) {
      var teile = daten.slice(8).split(",");
      for (var t = 0; t < teile.length; t += 1) {
        var z = parseInt(teile[t], 10);
        if (z >= 0 && z < n) { besucht[z] = true; }
      }
    }
    var ort = parseInt(lies("cmi.core.lesson_location"), 10);
    return ort >= 0 && ort < n ? ort : 0;
  }

  function starte() {
    api = sucheApi(window);
    if (!api && window.opener) { api = sucheApi(window.opener); }
    if (api && String(api.LMSInitialize("")) === "true") { verbunden = true; }
    var ziel = 0;
    if (verbunden) {
      var status = lies("cmi.core.lesson_status");
      if (status === "completed" || status === "passed") {
        abgeschlossen = true;
        body.setAttribute("data-kw-abgeschlossen", "ja");
      } else if (status === "" || status === "not attempted") {
        setze("cmi.core.lesson_status", "incomplete");
      }
      ziel = wiederaufnahme();
      body.setAttribute("data-kw-lms", "verbunden");
      meldung(text("verbunden"));
    } else {
      body.setAttribute("data-kw-lms", "keins");
      meldung(text("kein-lms"));
    }
    doc.getElementById("kw-zurueck").addEventListener("click", function () { zeige(aktuell - 1); });
    doc.getElementById("kw-weiter").addEventListener("click", function () { zeige(aktuell + 1); });
    doc.getElementById("kw-abschliessen").addEventListener("click", abschliessen);
    window.addEventListener("pagehide", beenden);
    window.addEventListener("beforeunload", beenden);
    window.addEventListener("unload", beenden);
    zeige(ziel);
  }

  if (doc.readyState === "loading") { doc.addEventListener("DOMContentLoaded", starte); } else { starte(); }
})();
`;

export const SCO_CSS = `html { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1d1d1f; }
body { margin: 0 auto; max-width: 52rem; padding: 1.5rem; line-height: 1.5; }
header h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.kw-fortschritt { color: #555; font-size: .9rem; }
.kw-meldung { margin: .75rem 0; padding: .5rem .75rem; background: #f2f2f4; border-radius: 6px; font-size: .9rem; }
section h2 { font-size: 1.25rem; }
.kw-herkunft { margin-top: 1.5rem; padding-top: .75rem; border-top: 1px solid #ddd; color: #555; font-size: .85rem; }
nav { display: flex; gap: .5rem; margin-top: 1.5rem; }
button { font: inherit; padding: .5rem 1rem; border-radius: 6px; border: 1px solid #888; background: #fff; cursor: pointer; }
button[disabled] { opacity: .4; cursor: default; }
img { max-width: 100%; height: auto; }
footer { margin-top: 2rem; color: #777; font-size: .8rem; }
`;

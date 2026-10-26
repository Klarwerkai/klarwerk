// ================================================================================================
// KLARA IN EXCEL UND POWERPOINT · DAS AUFGABENFENSTER (aufnahme:20260922:excel-erster-weg)
// ================================================================================================
//
// WAS DIESE DATEI TUT — und nur das:
//   1. Office erkennen: Host, Plattform, Version und die API-Stufen, die DIESE Office-Fassung zur
//      Laufzeit bestätigt (`Office.context.requirements.isSetSupported`, KO-04-01). Was fehlt, steht
//      im Fenster; die zugehörigen Knöpfe bleiben aus.
//   2. Anmelden über den VORHANDENEN Weg: dieselbe Dialogseite wie Word (`/word-addin/anmeldung.html`),
//      derselbe einmalige Übergabecode (`/api/auth/office-handover/redeem`). Kein zweites Login.
//   3. Lesen, was markiert ist (KO-04-02, KO-04-04) — die Regeln dafür stehen in `hostkern.js`.
//   4. Fragen über den VORHANDENEN Klara-Sitzungsweg (`/api/klara/sessions`, `/execute`). Der
//      gelesene Kontext reist als `selection`; ob er ein Modell erreicht, entscheidet der Server
//      anhand der Zustimmung je Sitzung und Dokument — dieses Fenster entscheidet das nie.
//   5. Zurückgeben nur nach zweitem Klick und nur nach frischer Zielprüfung (KO-04-03, KO-04-05,
//      KO-04-06). Unterstützt: Summenformel und Text in eine Zelle (Excel), Text eines Textfelds
//      (PowerPoint). Nie Bilder, nie Formen anlegen, nie eine Figur ins Dokument.
//   6. Zurücknehmen, solange das Ziel genau das enthält, was Klara geschrieben hat.
//
// Gespeichert wird wie in Office üblich (Autospeichern im Web/OneDrive, sonst ⌘S); Klara ruft kein
// Speichern auf. Ob die gespeicherte Datei stimmt, belegt allein die Hostabnahme (Wiederöffnen).
// ================================================================================================
(function () {
  "use strict";

  var K = window.KlaraOfficeHost;
  var OFFICE_FRIST_MS = 10000;
  var ABRUF_FRIST_MS = 20000;
  var FRAGE_FRIST_MS = 60000;
  var ANMELDE_FRIST_MS = 5 * 60 * 1000;
  var ANMELDE_TAKT_MS = 2000;
  var LESE_RUHE_MS = 400;
  var UEBERGABE_ART = "kw-office-handover";

  var z = {
    host: null,
    api: null,
    plattform: null,
    officeBereit: false,
    angemeldet: false,
    schluessel: null,
    instanz: neueKennung(),
    nonce: neueKennung(),
    sitzung: null,
    dokumentKontext: null,
    sitzungsDokument: null,
    sitzungLaeuft: false,
    aufloesung: null,
    kontext: null,
    lage: null,
    bewertung: null,
    kontextText: "",
    // Ben-Befund (Nacharbeit 2): der Schlüssel der zuletzt gelesenen Lage und ob sie noch gilt.
    // Eine Auswahländerung macht sie ungültig, bis neu gelesen ist.
    kontextBindung: null,
    kontextGueltig: false,
    // Jede Frage bekommt eine Laufnummer; eine ältere Antwort überschreibt nie eine neuere.
    frageLauf: 0,
    antwort: null,
    plan: null,
    letzte: null,
    beschaeftigt: false,
  };

  var anmeldeLauf = 0;
  var leseTimer = null;

  function neueKennung() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") { return window.crypto.randomUUID(); }
    } catch (e) { /* weiter unten */ }
    var s = "";
    for (var i = 0; i < 4; i += 1) { s += Math.random().toString(16).slice(2, 10); }
    return s;
  }

  // ----------------------------------------------------------------------------------------------
  // DOM-HELFER
  // ----------------------------------------------------------------------------------------------

  function el(id) { return document.getElementById(id); }

  function text(id, satz) { var e = el(id); if (e) { e.textContent = satz; } }

  function zeigen(id, an) { var e = el(id); if (e) { e.hidden = !an; } }

  function meldung(id, satz, art) {
    var e = el(id);
    if (!e) { return; }
    e.textContent = satz || "";
    e.hidden = !satz;
    e.className = art === "ok" ? "hinweis ok" : "hinweis";
  }

  function aktiv(id, an) { var e = el(id); if (e) { e.disabled = !an; } }

  // ----------------------------------------------------------------------------------------------
  // ABRUF — same-origin, mit Frist; der Übergabeschlüssel (Office im Web) hängt an /api-Abrufen.
  // ----------------------------------------------------------------------------------------------

  function abruf(pfad, init, fristMs) {
    var controller = new AbortController();
    var frist = setTimeout(function () {
      try { controller.abort(); } catch (e) { /* schon beendet */ }
    }, fristMs || ABRUF_FRIST_MS);
    var koepfe = {};
    var alt = (init && init.headers) || {};
    for (var k in alt) { if (Object.prototype.hasOwnProperty.call(alt, k)) { koepfe[k] = alt[k]; } }
    if (z.schluessel) { koepfe.authorization = "Bearer " + z.schluessel; }
    return fetch(pfad, {
      method: (init && init.method) || "GET",
      headers: koepfe,
      body: init && init.body,
      credentials: "include",
      signal: controller.signal,
    }).then(
      function (res) { clearTimeout(frist); if (res.status === 401) { z.schluessel = null; } return res; },
      function (err) { clearTimeout(frist); throw err; }
    );
  }

  function sitzungsKoepfe() {
    return {
      "x-klara-session": z.sitzung || "",
      "x-klara-instance": z.instanz,
      "x-klara-document": z.dokumentKontext || "",
    };
  }

  function klaraJson(pfad, methode, koerper) {
    var koepfe = sitzungsKoepfe();
    if (koerper) { koepfe["content-type"] = "application/json"; }
    return abruf(pfad, { method: methode, headers: koepfe, body: koerper ? JSON.stringify(koerper) : undefined })
      .then(function (res) {
        if (!res.ok) { var f = new Error("HTTP " + res.status); f.status = res.status; throw f; }
        return res.json();
      });
  }

  // ----------------------------------------------------------------------------------------------
  // OFFICE
  // ----------------------------------------------------------------------------------------------

  function dokumentUrl() {
    try { return (window.Office && Office.context && Office.context.document && Office.context.document.url) || ""; }
    catch (e) { return ""; }
  }

  function dokumentModus() {
    try {
      var m = Office.context.document.mode;
      return m === "readOnly" || (Office.DocumentMode && m === Office.DocumentMode.ReadOnly) ? "readOnly" : "readWrite";
    } catch (e) { return "readWrite"; }
  }

  function start() {
    verdrahten();
    var erledigt = false;
    var frist = setTimeout(function () {
      if (erledigt) { return; }
      erledigt = true;
      ohneOffice();
    }, OFFICE_FRIST_MS);
    if (window.Office && typeof Office.onReady === "function") {
      Office.onReady(function (info) {
        if (erledigt) { return; }
        erledigt = true;
        clearTimeout(frist);
        officeBereit(info || {});
      });
    }
    anmeldungPruefen();
  }

  function ohneOffice() {
    text("kontext-zeile", "Kein Office gefunden");
    text("host-zeile", "Dieses Fenster arbeitet nur in Excel oder PowerPoint. Im Browser allein kann Klara kein Dokument lesen.");
  }

  function officeBereit(info) {
    var host = K.hostAusOffice(info.host);
    z.plattform = K.plattformAus(Office.context && Office.context.diagnostics, info.platform);
    if (host !== "excel" && host !== "powerpoint") {
      text("host-zeile", host === "word"
        ? "Dieses Fenster ist für Excel und PowerPoint. In Word nutze das Klara-Fenster für Word."
        : "Dieser Office-Host wird von Klara hier nicht unterstützt.");
      text("kontext-zeile", "Kein unterstützter Host");
      return;
    }
    z.host = host;
    z.officeBereit = true;
    z.api = K.pruefeApiStufen(host, function (satz, stufe) {
      return Office.context.requirements.isSetSupported(satz, stufe);
    });
    el("klara-figur").setAttribute("data-host", host);
    var name = host === "excel" ? "Excel" : "PowerPoint";
    text("host-zeile", name + " · " + z.plattform.anzeige + (z.plattform.version ? " " + z.plattform.version : "") +
      (z.plattform.imAuftrag ? "" : " – diese Plattform ist nicht Teil der Abnahme (Mac, Web)."));
    text("api-zeile", z.api.satz + ": bestätigt bis " + (z.api.hoechste || "keine geprüfte Stufe"));
    var fehlt = K.fehlendeFaehigkeiten(z.api);
    meldung("api-fehlt", fehlt.length ? "Nicht verfügbar in dieser Fassung: " + fehlt.join(", ") + "." : "");
    zeigen("rueckgabe-excel", host === "excel");
    zeigen("rueckgabe-powerpoint", host === "powerpoint");
    text("kontext-zeile", K.kontextZeile(host, null));
    try {
      Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, auswahlGeaendert);
      if (host === "powerpoint" && Office.EventType.ActiveViewChanged) {
        Office.context.document.addHandlerAsync(Office.EventType.ActiveViewChanged, auswahlGeaendert);
      }
    } catch (e) { /* ohne Ereignis bleibt „Auswahl lesen" der Weg */ }
    kontrollen();
    sitzungStarten();
    return kontextLesen();
  }

  /**
   * Jede Auswahländerung verwirft eine vorbereitete Rückgabe — ihr Ziel war die alte Lage — und
   * sperrt die Antwort für Rückgaben, bis neu gelesen ist und die Lage wieder zur Antwort passt.
   */
  function auswahlGeaendert() {
    z.kontextGueltig = false;
    kontrollen();
    if (z.plan) {
      z.plan = null;
      zeigen("plan", false);
      meldung("rueckgabe-meldung", "Die Auswahl hat sich geändert; die vorbereitete Änderung ist verworfen. Bitte neu vorbereiten.");
    }
    if (leseTimer) { clearTimeout(leseTimer); }
    leseTimer = setTimeout(function () { leseTimer = null; kontextLesen(); }, LESE_RUHE_MS);
  }

  // ----------------------------------------------------------------------------------------------
  // ANMELDUNG — derselbe Weg wie im Word-Fenster
  // ----------------------------------------------------------------------------------------------

  function anmeldungPruefen() {
    return abruf("/api/auth/me", { method: "GET" })
      .then(function (res) { return res.ok; }, function () { return false; })
      .then(function (ok) {
        z.angemeldet = ok;
        text("anmeldung-zeile", ok ? "Angemeldet." : "Nicht angemeldet.");
        zeigen("anmelden-knopf", !ok);
        if (ok) { sitzungStarten(); }
        kontrollen();
        return ok;
      });
  }

  function uebergabeCode(nachricht) {
    try {
      var k = JSON.parse(String(nachricht));
      return k && k.art === UEBERGABE_ART && typeof k.code === "string" && k.code.length > 0 ? k.code : null;
    } catch (e) { return null; }
  }

  function anmelden() {
    anmeldeLauf += 1;
    var lauf = anmeldeLauf;
    var beginn = Date.now();
    var dialog = null;
    text("anmeldung-zeile", "Anmeldung läuft im eigenen Fenster …");
    aktiv("anmelden-knopf", false);
    // Ben-Befund B: die gemeinsame Dialogseite erfährt, für welchen Host sie anmeldet.
    var url = window.location.origin + "/word-addin/anmeldung.html" + "?host=" + encodeURIComponent(z.host || "");
    var fertig = function (satz) {
      if (lauf !== anmeldeLauf) { return; }
      anmeldeLauf += 1;
      aktiv("anmelden-knopf", true);
      try { if (dialog) { dialog.close(); } } catch (e) { /* schon zu */ }
      if (satz) { text("anmeldung-zeile", satz); }
    };
    var pruefen = function () {
      if (lauf !== anmeldeLauf) { return; }
      anmeldungPruefen().then(function (ok) {
        if (lauf !== anmeldeLauf) { return; }
        if (ok) { fertig(""); return; }
        if (Date.now() - beginn >= ANMELDE_FRIST_MS) { fertig("Anmeldung nicht abgeschlossen. Bitte erneut versuchen."); return; }
        setTimeout(pruefen, ANMELDE_TAKT_MS);
      });
    };
    try {
      Office.context.ui.displayDialogAsync(url, { height: 75, width: 45 }, function (ergebnis) {
        if (ergebnis && ergebnis.status === Office.AsyncResultStatus.Succeeded) {
          dialog = ergebnis.value;
          dialog.addEventHandler(Office.EventType.DialogMessageReceived, function (arg) {
            var code = uebergabeCode(arg && arg.message);
            if (code === null || lauf !== anmeldeLauf) { return; }
            abruf("/api/auth/office-handover/redeem", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ code: code }),
            })
              .then(function (res) { return res.ok ? res.json() : null; }, function () { return null; })
              .then(function (koerper) {
                if (koerper && typeof koerper.token === "string" && koerper.token.length > 0) { z.schluessel = koerper.token; }
                pruefen();
              });
          });
        } else {
          fertig("Office hat das Anmeldefenster nicht geöffnet. Bitte Pop-ups für diese Seite erlauben und erneut versuchen.");
        }
      });
    } catch (e) {
      fertig("Office hat das Anmeldefenster nicht geöffnet.");
      return;
    }
    setTimeout(pruefen, ANMELDE_TAKT_MS);
  }

  // ----------------------------------------------------------------------------------------------
  // KLARA-SITZUNG — der vorhandene Sitzungsweg, je Dokument
  // ----------------------------------------------------------------------------------------------

  function beschreiber() {
    var url = dokumentUrl();
    return url ? { kind: "saved", canonicalUrl: url } : { kind: "unsaved", clientDocumentNonce: z.nonce };
  }

  function sitzungStarten() {
    if (!z.angemeldet || !z.officeBereit || z.sitzungLaeuft) { return Promise.resolve(); }
    var url = dokumentUrl();
    if (z.sitzung && z.sitzungsDokument === url) { return Promise.resolve(); }
    z.sitzungLaeuft = true;
    var alt = z.sitzung;
    var schliessen = alt
      ? klaraJson("/api/klara/sessions/" + encodeURIComponent(alt) + "/close", "POST", null).catch(function () { return null; })
      : Promise.resolve(null);
    return schliessen
      .then(function () {
        z.sitzung = null;
        z.dokumentKontext = null;
        z.aufloesung = null;
        return klaraJson("/api/klara/sessions", "POST", { addinInstanceId: z.instanz, documentDescriptor: beschreiber() });
      })
      .then(function (sicht) {
        z.sitzung = sicht.sessionId;
        z.dokumentKontext = sicht.documentContextId;
        z.sitzungsDokument = url;
        z.aufloesung = sicht.resolution || null;
        return klaraJson("/api/klara/ai-status", "GET", null);
      })
      .then(function (aufloesung) { z.aufloesung = aufloesung; meldung("frage-meldung", ""); })
      .catch(function () {
        if (!z.sitzung) { meldung("frage-meldung", "Die Klara-Sitzung konnte nicht beginnen. Fragen geht erst mit Sitzung."); }
      })
      .then(function () { z.sitzungLaeuft = false; kiZeigen(); kontrollen(); });
  }

  function kiZeigen() {
    var a = z.aufloesung;
    if (!a) {
      text("ki-zeile", z.angemeldet ? "Klara-Sitzung wird vorbereitet …" : "Ohne Anmeldung keine Frage.");
      zeigen("zustimmung", false);
      return;
    }
    var mitModell = a.executionAllowed === true && a.effectiveMode && a.effectiveMode !== "deterministic";
    text("ki-zeile", mitModell
      ? "Antwort mit " + (a.provider || "Modell") + (a.model ? " (" + a.model + ")" : "") + " auf Grundlage geprüften Wissens."
      : "Antwort aus geprüftem Wissen, ohne dass der Dateiinhalt an ein externes Modell geht.");
    var frage = a.externalConsentRequired === true && typeof a.externalConsentProvider === "string" && a.externalConsentProvider.length > 0;
    zeigen("zustimmung", frage);
    if (frage) {
      var granted = a.externalConsentGranted === true;
      text("zustimmung-satz", granted
        ? "Freigegeben: Der gelesene Inhalt dieser Datei darf in dieser Sitzung an " + a.externalConsentProvider + " gehen."
        : "Darf Klara den gelesenen Inhalt dieser Datei an " + a.externalConsentProvider +
          (a.externalConsentModel ? " (" + a.externalConsentModel + ")" : "") + " geben? Gilt nur für diese Sitzung und dieses Dokument.");
      zeigen("zustimmung-geben", !granted);
      zeigen("zustimmung-widerrufen", granted);
    }
  }

  function zustimmung(geben) {
    if (!z.sitzung) { return Promise.resolve(); }
    return klaraJson("/api/klara/sessions/" + encodeURIComponent(z.sitzung) + "/consent", geben ? "POST" : "DELETE", null)
      .then(function () { return klaraJson("/api/klara/ai-status", "GET", null); })
      .then(function (a) { z.aufloesung = a; }, function () {
        // Ungewiss, ob der Server zugestimmt hat: der alte Stand gilt nicht mehr.
        z.aufloesung = null;
        meldung("frage-meldung", "Die Freigabe konnte nicht bestätigt werden. Bitte das Fenster neu öffnen.");
      })
      .then(function () { kiZeigen(); kontrollen(); });
  }

  // ----------------------------------------------------------------------------------------------
  // LESEN
  // ----------------------------------------------------------------------------------------------

  function kontextLesen() {
    if (!z.officeBereit) { return Promise.resolve(); }
    var weg;
    // Ein Host, der beim Aufruf selbst wirft (Fenster wird gerade geschlossen), wird wie ein
    // gescheitertes Lesen behandelt — nie als unbehandelter Fehler im Zeitgeber.
    try { weg = z.host === "excel" ? excelLesen() : pptLesen(); } catch (e) { weg = Promise.reject(e); }
    return weg.then(
      function (ergebnis) { kontextUebernehmen(ergebnis); },
      function (fehler) {
        z.kontext = null;
        z.kontextText = "";
        z.kontextBindung = null;
        z.kontextGueltig = false;
        var satz = fehler && /InvalidSelection|multiple/i.test(String(fehler.code || fehler.message))
          ? "Mehrere Bereiche markiert – diese Excel-Fassung liest nur einen zusammenhängenden Bereich (ExcelApi 1.9 fehlt)."
          : "Die Auswahl konnte nicht gelesen werden" + (fehler && fehler.code ? " (" + fehler.code + ")" : "") + ".";
        text("kontext-zustand", satz);
        kontrollen();
      }
    );
  }

  function excelLesen() {
    return Excel.run(function (ctx) {
      var blatt = ctx.workbook.worksheets.getActiveWorksheet();
      blatt.load("name");
      var mappe = null;
      if (z.api.faehigkeiten.mappenname) { mappe = ctx.workbook; mappe.load("name"); }
      var sammlung = null;
      var einzel = null;
      if (z.api.faehigkeiten.mehrfachauswahl) {
        sammlung = ctx.workbook.getSelectedRanges();
        sammlung.areas.load("items/address,items/rowCount,items/columnCount,items/cellCount");
      } else {
        einzel = ctx.workbook.getSelectedRange();
        einzel.load("address,rowCount,columnCount,cellCount");
      }
      return ctx.sync().then(function () {
        var flaechen = sammlung ? sammlung.areas.items : [einzel];
        var lesen = [];
        for (var i = 0; i < flaechen.length && i < K.GRENZEN.maxBereiche; i += 1) {
          var zer = K.adresseZerlegen(flaechen[i].address);
          if (!zer) { continue; }
          var leseAdresse = K.lokaleAdresse(K.teilblock(zer, K.GRENZEN.maxZellen));
          var r = blatt.getRange(leseAdresse);
          r.load("values,formulas,text,valueTypes");
          lesen.push({ flaeche: flaechen[i], block: r, leseAdresse: leseAdresse });
        }
        return ctx.sync().then(function () {
          var bereiche = lesen.map(function (l) {
            var f = l.flaeche;
            var gesamt = typeof f.cellCount === "number" && f.cellCount >= 0 ? f.cellCount : f.rowCount * f.columnCount;
            var b = K.excelBereich({
              address: f.address,
              values: l.block.values,
              formulas: l.block.formulas,
              text: l.block.text,
              valueTypes: l.block.valueTypes,
              rowCount: f.rowCount,
              columnCount: f.columnCount,
              cellCount: gesamt,
            }, gesamt);
            b.leseAdresse = l.leseAdresse;
            return b;
          });
          var url = dokumentUrl();
          var kontext = {
            host: "excel",
            dokument: url,
            mappe: (mappe && mappe.name) || K.dokumentName(url),
            blatt: blatt.name,
            bereiche: bereiche,
            flaechenGesamt: flaechen.length,
          };
          kontext.bewertung = K.excelAuswahlBewerten(bereiche);
          if (flaechen.length > bereiche.length) {
            kontext.bewertung.hinweise.push("Nur " + bereiche.length + " von " + flaechen.length + " Bereichen gelesen.");
          }
          kontext.abdruck = K.abdruck(bereiche.map(function (b) { return [b.werte, b.formeln]; }));
          return { kontext: kontext, bewertung: kontext.bewertung, text: K.excelKontextText(kontext) };
        });
      });
    });
  }

  function officeAsync(aufruf) {
    return new Promise(function (aufloesen) {
      try {
        aufruf(function (ergebnis) {
          aufloesen(ergebnis && ergebnis.status === Office.AsyncResultStatus.Succeeded ? ergebnis.value : null);
        });
      } catch (e) { aufloesen(null); }
    });
  }

  function ansichtLesen() {
    var d = Office.context.document;
    if (!d || typeof d.getActiveViewAsync !== "function") { return Promise.resolve(null); }
    return officeAsync(function (cb) { d.getActiveViewAsync(cb); });
  }

  function textAuswahlLesen() {
    return officeAsync(function (cb) {
      Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, cb);
    }).then(function (wert) { return typeof wert === "string" ? wert : ""; });
  }

  var PPT_FORM_FELDER = "items/id,items/name,items/type,items/left,items/top,items/width,items/height";

  function formDaten(f, tr) {
    return { id: f.id, name: f.name, typ: f.type, text: tr ? tr.text : null, links: f.left, oben: f.top, breite: f.width, hoehe: f.height };
  }

  function pptLesen() {
    return ansichtLesen().then(function (ansicht) {
      var url = dokumentUrl();
      var lage = { ansicht: ansicht, modus: dokumentModus(), api: z.api, folien: [], formen: [], textAuswahl: "" };
      var kontext = { host: "powerpoint", dokument: url, praesentation: K.dokumentName(url), folien: [], formen: [], textAuswahl: "" };
      var fertig = function () {
        var bewertung = K.pptLageBewerten(lage);
        return { kontext: kontext, lage: lage, bewertung: bewertung, text: K.pptKontextText(kontext) };
      };
      if (ansicht === "read") { return fertig(); }
      if (!z.api.faehigkeiten.auswahl) {
        return textAuswahlLesen().then(function (t) { lage.textAuswahl = t; kontext.textAuswahl = t; return fertig(); });
      }
      return PowerPoint.run(function (ctx) {
        var alle = ctx.presentation.slides;
        alle.load("items/id");
        var folien = ctx.presentation.getSelectedSlides();
        folien.load("items/id");
        var formen = ctx.presentation.getSelectedShapes();
        formen.load(PPT_FORM_FELDER);
        return ctx.sync().then(function () {
          var ids = alle.items.map(function (s) { return s.id; });
          lage.folien = folien.items.map(function (s) { return { id: s.id, nummer: ids.indexOf(s.id) + 1 }; });
          kontext.folien = lage.folien;
          var folienFormen = null;
          if (formen.items.length === 0 && folien.items.length > 0) {
            folienFormen = folien.items[0].shapes;
            folienFormen.load(PPT_FORM_FELDER);
          }
          return ctx.sync().then(function () {
            var gewaehlt = formen.items.slice(0, K.GRENZEN.maxFormen);
            var ausFolie = folienFormen ? folienFormen.items.slice(0, K.GRENZEN.maxFormen) : [];
            var lesen = gewaehlt.concat(ausFolie).map(function (f) {
              if (!K.istTextform(f.type)) { return null; }
              var tr = f.textFrame.textRange;
              tr.load("text");
              return tr;
            });
            return ctx.sync().then(function () {
              lage.formen = gewaehlt.map(function (f, i) { return formDaten(f, lesen[i]); });
              kontext.formen = gewaehlt.length
                ? lage.formen
                : ausFolie.map(function (f, i) { return formDaten(f, lesen[gewaehlt.length + i]); });
              return fertig();
            });
          });
        });
      });
    });
  }

  function kontextUebernehmen(ergebnis) {
    z.kontext = ergebnis.kontext;
    z.lage = ergebnis.lage || null;
    z.bewertung = ergebnis.bewertung;
    z.kontextText = ergebnis.bewertung.zustand === "leer" ? "" : ergebnis.text;
    z.kontextBindung = K.kontextBindung(z.host, z.kontext);
    z.kontextGueltig = true;
    if (z.antwort && !antwortNutzbar()) {
      meldung("frage-meldung", "Die Antwort gehört zur vorherigen Auswahl. Sie bleibt sichtbar, wird aber nicht zurückgegeben – bitte zur aktuellen Auswahl erneut fragen.");
    }
    var zeile = K.kontextZeile(z.host, z.kontext);
    text("kontext-zeile", zeile);
    // KO-04-06: die gemeinsame Begleitfigur liest denselben Stand — als Eigenschaft und als Ereignis.
    window.klaraOfficeKontext = { host: z.host, zeile: zeile, dokument: z.kontext.dokument, gelesenAm: new Date().toISOString() };
    try { window.dispatchEvent(new CustomEvent("klara-office-kontext", { detail: window.klaraOfficeKontext })); } catch (e) { /* alter Webview */ }
    text("kontext-text", ergebnis.text);
    if (z.host === "excel") {
      var b = z.bewertung;
      text("kontext-zustand", b.zustand === "leer"
        ? "Nichts Gefülltes markiert."
        : b.zellenGefuellt + " gefüllte Zellen gelesen (" + b.zellenGesamt + " markiert).");
      meldung("kontext-ausweg", b.hinweise.join(" "));
      var rechnung = K.zahlenNachrechnen(z.kontext.bereiche);
      zeigen("nachrechnung", rechnung.anzahl > 0);
      text("nachrechnung", rechnung.anzahl > 0
        ? "Nachgerechnet aus den Zellwerten: " + rechnung.anzahl + " Zahlen, Summe " + rechnung.summe + ", kleinste " + rechnung.min + ", größte " + rechnung.max + "."
        : "");
      if (!el("ziel-zelle").value) { el("ziel-zelle").value = K.zielVorschlag(z.kontext); }
    } else {
      var p = z.bewertung;
      var satz = { form: "Ein Textfeld markiert.", folie: "Folie markiert – Klara liest ihre Textfelder.", mehrereFormen: "Mehrere Formen markiert.", nurText: "Markierter Text gelesen." };
      text("kontext-zustand", satz[p.zustand] || "Nicht lesbar in dieser Lage.");
      meldung("kontext-ausweg", p.ausweg);
    }
    kontrollen();
  }

  // ----------------------------------------------------------------------------------------------
  // FRAGEN — der vorhandene Klara-Ausführungsweg
  // ----------------------------------------------------------------------------------------------

  function fragen() {
    var frage = (el("frage-text").value || "").trim();
    if (frage.length === 0) { meldung("frage-meldung", "Bitte eine Frage eingeben."); return Promise.resolve(); }
    if (!z.sitzung) { meldung("frage-meldung", "Ohne Klara-Sitzung keine Frage. Bitte anmelden."); return Promise.resolve(); }
    if (dokumentUrl() !== z.sitzungsDokument) {
      meldung("frage-meldung", "Das Dokument hat gewechselt (zum Beispiel durch Speichern unter). Klara beginnt eine neue Sitzung; bitte erneut fragen.");
      return sitzungStarten().then(kontextLesen);
    }
    // Ben-Befund (Nacharbeit 2): gefragt wird nur zu einer frisch gelesenen Lage. Steht nach einer
    // Auswahländerung das Neulesen noch aus, wird zuerst gelesen.
    if (!z.kontextGueltig) {
      return kontextLesen().then(function () {
        if (!z.kontextGueltig) {
          meldung("frage-meldung", "Die aktuelle Auswahl konnte nicht gelesen werden; ohne sie fragt Klara nicht.");
          return null;
        }
        return frageSenden(frage);
      });
    }
    return frageSenden(frage);
  }

  /** Antwort gilt für Rückgaben nur zur gerade gültigen, frisch gelesenen Lage. */
  function antwortPruefung() {
    return K.antwortBindungPruefen(z.antwort, z.kontextGueltig ? z.kontextBindung : null);
  }

  function antwortNutzbar() { return antwortPruefung().ok; }

  function frageSenden(frage) {
    z.frageLauf += 1;
    var lauf = z.frageLauf;
    // Die Bindung DIESER Frage: genau die Lage, deren Kontext jetzt mitgeht.
    var bindung = z.kontextBindung;
    z.beschaeftigt = true;
    kontrollen();
    meldung("frage-meldung", "");
    var koepfe = sitzungsKoepfe();
    koepfe["content-type"] = "application/json";
    return abruf("/api/klara/sessions/" + encodeURIComponent(z.sitzung) + "/execute", {
      method: "POST",
      headers: koepfe,
      body: JSON.stringify({
        question: frage,
        locale: "de",
        mode: "retrieval-only",
        selection: z.kontextText.length > 0 ? z.kontextText : undefined,
        questionSource: "manual",
      }),
    }, FRAGE_FRIST_MS)
      .then(function (res) {
        if (res.status === 401) { throw new Error("Bitte neu anmelden."); }
        if (res.status === 403) { throw new Error("Dir fehlt das Leserecht für Wissen (ko.read)."); }
        if (res.status === 429) { throw new Error("Gerade zu viele Fragen. Bitte kurz warten."); }
        if (res.status === 503) { throw new Error("Klara ist gerade abgeschaltet oder nicht erreichbar."); }
        if (!res.ok) { throw new Error("Klara hat nicht geantwortet (HTTP " + res.status + ")."); }
        return res.json();
      })
      .then(function (body) {
        // Eine neuere Frage läuft schon: diese Antwort überschreibt nichts.
        if (lauf !== z.frageLauf) { return; }
        var ergebnis = body && body.result ? body.result : {};
        var antwort = typeof ergebnis.answer === "string" ? ergebnis.answer.trim() : "";
        var quellen = Array.isArray(ergebnis.sources)
          ? ergebnis.sources.filter(function (q) { return typeof q === "string" && q.trim().length > 0; })
          : [];
        z.antwort = antwort.length > 0 ? { text: antwort, quellen: quellen, frage: frage, bindung: bindung } : null;
        if (z.antwort && !antwortNutzbar()) {
          // Verspätet: die Auswahl oder ihr Inhalt hat sich geändert, während Klara antwortete.
          meldung("frage-meldung", "Die Antwort kam nach einem Auswahlwechsel an. Sie bleibt sichtbar, wird aber nicht zurückgegeben – bitte zur aktuellen Auswahl erneut fragen.");
        }
        zeigen("antwort", true);
        text("antwort-text", antwort.length > 0 ? antwort : "Klara hat dazu kein geprüftes Wissen gefunden.");
        text("antwort-quellen", quellen.length > 0
          ? "Quellen: " + quellen.map(function (q) { return window.location.origin + "/wissen/" + encodeURIComponent(q); }).join(", ")
          : "Ohne geprüfte Quelle.");
      }, function (fehler) {
        if (lauf !== z.frageLauf) { return; }
        meldung("frage-meldung", fehler && fehler.name === "AbortError" ? "Keine Antwort in der Frist." : (fehler && fehler.message) || "Fehler.");
      })
      .then(function () { z.beschaeftigt = false; kontrollen(); });
  }

  // ----------------------------------------------------------------------------------------------
  // RÜCKGABE — vorbereiten, zeigen, nach zweitem Klick frisch prüfen und schreiben
  // ----------------------------------------------------------------------------------------------

  function planZeigen(plan, satz) {
    z.plan = plan;
    text("plan-satz", satz);
    zeigen("plan", true);
    meldung("rueckgabe-meldung", "");
    // Ben-Befund C: „Jetzt schreiben" ist der zweite Klick — er muss sofort bedienbar sein.
    kontrollen();
  }

  function excelZielLesen(adresse) {
    return Excel.run(function (ctx) {
      var r = ctx.workbook.worksheets.getActiveWorksheet().getRange(adresse);
      r.load("formulas");
      return ctx.sync().then(function () { return r.formulas; });
    });
  }

  function excelPlanBasis(art, zielAdresse, inhalt, ziel) {
    return {
      art: art,
      dokument: z.kontext.dokument,
      blatt: z.kontext.blatt,
      quellen: z.kontext.bereiche.map(function (b) { return b.leseAdresse; }),
      quelleAbdruck: z.kontext.abdruck,
      zielAdresse: zielAdresse,
      zielAbdruck: K.abdruck(ziel),
      inhalt: inhalt,
      ueberschreibenBestaetigt: el("ziel-ueberschreiben").checked === true,
      erstelltMs: Date.now(),
    };
  }

  function belegt(ziel) { return K.abdruck(ziel) !== K.abdruck([[""]]); }

  function summeVorbereiten() {
    var p = K.summenPlan(z.kontext);
    if (!p.ok) { meldung("rueckgabe-meldung", K.grundSatz(p.grund)); return Promise.resolve(); }
    return excelZielLesen(p.zielAdresse).then(function (ziel) {
      var plan = excelPlanBasis("summenformel", p.zielAdresse, p.inhalt, ziel);
      plan.erwartet = p.erwartet;
      planZeigen(plan, "Ziel: " + plan.blatt + "!" + p.zielAdresse + " · neu: " + p.inhalt + " · Klara erwartet " + p.erwartet + "." +
        (belegt(ziel) ? " Achtung: Die Zelle ist nicht leer." : ""));
    }, function () { meldung("rueckgabe-meldung", "Die Zielzelle konnte nicht gelesen werden."); });
  }

  function zelltextVorbereiten() {
    var bezug = antwortPruefung();
    if (!bezug.ok) { meldung("rueckgabe-meldung", K.grundSatz(bezug.grund)); return Promise.resolve(); }
    var adresse = (el("ziel-zelle").value || "").trim().toUpperCase();
    if (!K.istEinzelzelle(adresse)) { meldung("rueckgabe-meldung", K.grundSatz("zielUngueltig")); return Promise.resolve(); }
    var antwort = z.antwort;
    return excelZielLesen(adresse).then(function (ziel) {
      var plan = excelPlanBasis("zelltext", adresse, antwort.text, ziel);
      plan.antwortBindung = antwort.bindung;
      planZeigen(plan, "Ziel: " + plan.blatt + "!" + adresse + " · neu: die Antwort als Text (" + antwort.text.length + " Zeichen)." +
        (belegt(ziel) ? " Achtung: Die Zelle ist nicht leer." : ""));
    }, function () { meldung("rueckgabe-meldung", "Die Zielzelle konnte nicht gelesen werden."); });
  }

  function formtextVorbereiten() {
    var bezug = antwortPruefung();
    if (!bezug.ok) { meldung("rueckgabe-meldung", K.grundSatz(bezug.grund)); return Promise.resolve(); }
    if (!z.bewertung || z.bewertung.zustand !== "form" || !z.bewertung.rueckgabeMoeglich) {
      meldung("rueckgabe-meldung", (z.bewertung && z.bewertung.ausweg) || "Markiere genau ein Textfeld.");
      return Promise.resolve();
    }
    if (!z.lage || z.lage.folien.length !== 1) {
      meldung("rueckgabe-meldung", "Die Folie des Textfelds ist nicht eindeutig. Klicke auf die Folie und markiere das Textfeld erneut.");
      return Promise.resolve();
    }
    var form = z.lage.formen[0];
    var folie = z.lage.folien[0];
    var plan = {
      art: "formtext",
      dokument: z.kontext.dokument,
      folieId: folie.id,
      folieNummer: folie.nummer,
      formId: form.id,
      formName: form.name,
      zielAbdruck: K.abdruck(form.text),
      position: { links: form.links, oben: form.oben, breite: form.breite, hoehe: form.hoehe },
      inhalt: z.antwort.text,
      antwortBindung: z.antwort.bindung,
      erstelltMs: Date.now(),
    };
    planZeigen(plan, "Ziel: Folie " + folie.nummer + " · Textfeld „" + (form.name || form.id) + "“ · bisher: „" +
      String(form.text || "").slice(0, 80) + "“ · neu: die Antwort (" + z.antwort.text.length + " Zeichen). Der ganze Text des Textfelds wird ersetzt.");
    return Promise.resolve();
  }

  function ausfuehren() {
    var plan = z.plan;
    if (!plan || !K.rueckgabeErlaubt(z.host, plan.art)) { return Promise.resolve(); }
    // Eine Antwort-Rückgabe wird unmittelbar vor dem Schreiben erneut an ihren Bezug gebunden:
    // dieselbe Antwort, dieselbe gültige Lage wie bei der Vorbereitung.
    if (plan.antwortBindung !== undefined) {
      var bezug = antwortPruefung();
      if (!bezug.ok || z.antwort.bindung !== plan.antwortBindung || z.antwort.text !== plan.inhalt) {
        z.plan = null;
        zeigen("plan", false);
        meldung("rueckgabe-meldung", K.grundSatz(bezug.ok ? "antwortVeraltet" : bezug.grund));
        kontrollen();
        return Promise.resolve();
      }
    }
    z.beschaeftigt = true;
    kontrollen();
    var weg = z.host === "excel" ? excelSchreiben(plan) : pptSchreiben(plan);
    return weg.then(function (ergebnis) {
      z.plan = null;
      zeigen("plan", false);
      if (!ergebnis.ok) { meldung("rueckgabe-meldung", K.grundSatz(ergebnis.grund)); return; }
      z.letzte = { host: z.host, plan: plan, vorher: ergebnis.vorher, geschrieben: ergebnis.geschrieben };
      meldung("rueckgabe-meldung", ergebnis.satz, ergebnis.warnung ? "" : "ok");
      zeigen("ruecknahme", true);
      zeigen("speichern-hinweis", true);
    }, function (fehler) {
      meldung("rueckgabe-meldung", "Office hat die Änderung abgelehnt" + (fehler && fehler.code ? " (" + fehler.code + ")" : "") + ". Nichts wurde bestätigt.");
    }).then(function () { z.beschaeftigt = false; kontrollen(); });
  }

  function excelSchreiben(plan) {
    return Excel.run(function (ctx) {
      var blatt = ctx.workbook.worksheets.getActiveWorksheet();
      blatt.load("name");
      var schutz = null;
      if (z.api.faehigkeiten.blattschutz) { schutz = blatt.protection; schutz.load("protected"); }
      var quellen = plan.quellen.map(function (a) { var r = blatt.getRange(a); r.load("values,formulas"); return r; });
      var ziel = blatt.getRange(plan.zielAdresse);
      ziel.load("formulas");
      return ctx.sync().then(function () {
        var lage = {
          jetztMs: Date.now(),
          dokument: dokumentUrl(),
          blatt: blatt.name,
          modus: dokumentModus(),
          blattGeschuetzt: schutz ? schutz.protected : null,
          quelleAbdruck: K.abdruck(quellen.map(function (r) { return [r.values, r.formulas]; })),
          zielFormeln: ziel.formulas,
          zielAbdruck: K.abdruck(ziel.formulas),
        };
        var pruefung = K.excelZielPruefen(plan, lage);
        if (!pruefung.ok) { return { ok: false, grund: pruefung.grund }; }
        var vorher = ziel.formulas;
        if (plan.art === "summenformel") { ziel.formulas = [[plan.inhalt]]; }
        else { ziel.values = [[K.zellTextSicher(plan.inhalt)]]; }
        var nach = blatt.getRange(plan.zielAdresse);
        nach.load("values,text,formulas");
        return ctx.sync().then(function () {
          var ort = plan.blatt + "!" + plan.zielAdresse;
          if (plan.art === "summenformel") {
            var v = K.ergebnisVergleichen(plan.erwartet, nach.values[0][0]);
            return {
              ok: true, vorher: vorher, geschrieben: nach.formulas, warnung: !v.gleich,
              satz: "Geschrieben in " + ort + ": " + nach.formulas[0][0] + ". Excel hat " + nach.text[0][0] + " berechnet; Klaras Nachrechnung: " + v.erwartet +
                (v.gleich ? " – stimmt überein." : " – weicht ab. Bitte prüfen."),
            };
          }
          return { ok: true, vorher: vorher, geschrieben: nach.formulas, satz: "Antwort als Text in " + ort + " geschrieben." };
        });
      });
    });
  }

  function folieUndForm(ctx, folieId, formId) {
    var alle = ctx.presentation.slides;
    alle.load("items/id");
    return ctx.sync().then(function () {
      var folie = alle.items.filter(function (s) { return s.id === folieId; })[0] || null;
      if (!folie) { return { folie: null, form: null }; }
      var formen = folie.shapes;
      formen.load(PPT_FORM_FELDER);
      return ctx.sync().then(function () {
        var form = formen.items.filter(function (f) { return f.id === formId; })[0] || null;
        if (!form || !K.istTextform(form.type)) { return { folie: folie, form: form, tr: null }; }
        var tr = form.textFrame.textRange;
        tr.load("text");
        return ctx.sync().then(function () { return { folie: folie, form: form, tr: tr }; });
      });
    });
  }

  /** Lage und Größe einer gelesenen Form in der Sprache des Plans — oder null. */
  function positionVon(form) {
    return form ? { links: form.left, oben: form.top, breite: form.width, hoehe: form.height } : null;
  }

  function pptSchreiben(plan) {
    return ansichtLesen().then(function (ansicht) {
      return PowerPoint.run(function (ctx) {
        return folieUndForm(ctx, plan.folieId, plan.formId).then(function (ziel) {
          var lage = {
            jetztMs: Date.now(),
            dokument: dokumentUrl(),
            ansicht: ansicht,
            modus: dokumentModus(),
            folieVorhanden: !!ziel.folie,
            formVorhanden: !!ziel.form,
            formTyp: ziel.form ? ziel.form.type : null,
            formText: ziel.tr ? ziel.tr.text : null,
            // Ben-Befund (Nacharbeit 2): die FRISCH gelesene Lage und Größe geht in die Prüfung VOR
            // dem Schreiben ein — eine verschobene Form wird nicht überschrieben.
            position: positionVon(ziel.form),
          };
          var pruefung = K.pptZielPruefen(plan, lage);
          if (!pruefung.ok) { return { ok: false, grund: pruefung.grund }; }
          ziel.tr.text = plan.inhalt;
          return ctx.sync().then(function () { return folieUndForm(ctx, plan.folieId, plan.formId); }).then(function (nach) {
            // Das zurückgelesene Ergebnis — Text UND Position — gegen die beabsichtigte Änderung.
            var ergebnis = K.pptErgebnisPruefen(plan, {
              formVorhanden: !!nach.tr,
              text: nach.tr ? nach.tr.text : null,
              position: positionVon(nach.form),
            });
            var abweichung = {
              formFehlt: "das Textfeld ist nicht mehr lesbar",
              textAbweichend: "der gelesene Text entspricht nicht der Antwort",
              positionAbweichend: "Lage oder Größe des Textfelds weichen ab",
            };
            return {
              ok: true,
              vorher: lage.formText,
              geschrieben: nach.tr ? nach.tr.text : null,
              warnung: !ergebnis.ok,
              satz: "Geschrieben in Folie " + plan.folieNummer + ", Textfeld „" + (plan.formName || plan.formId) + "“ (" +
                (nach.tr ? nach.tr.text.length : 0) + " Zeichen gelesen)." +
                (ergebnis.ok
                  ? " Text wie beabsichtigt, Position unverändert."
                  : " Achtung: " + ergebnis.abweichungen.map(function (a) { return abweichung[a] || a; }).join(", ") +
                    ". Bitte prüfen und gegebenenfalls zurücknehmen."),
            };
          });
        });
      });
    });
  }

  /** Zurücknehmen nur, wenn das Ziel noch genau Klaras Text bzw. Formel trägt. */
  function zuruecknehmen() {
    var l = z.letzte;
    if (!l) { return Promise.resolve(); }
    var weg;
    if (l.host === "excel") {
      weg = Excel.run(function (ctx) {
        var blatt = ctx.workbook.worksheets.getActiveWorksheet();
        blatt.load("name");
        var ziel = blatt.getRange(l.plan.zielAdresse);
        ziel.load("formulas");
        return ctx.sync().then(function () {
          if (dokumentUrl() !== l.plan.dokument || blatt.name !== l.plan.blatt) { return "dokumentGewechselt"; }
          if (K.abdruck(ziel.formulas) !== K.abdruck(l.geschrieben)) { return "zielGeaendert"; }
          ziel.formulas = l.vorher;
          return ctx.sync().then(function () { return null; });
        });
      });
    } else {
      weg = PowerPoint.run(function (ctx) {
        return folieUndForm(ctx, l.plan.folieId, l.plan.formId).then(function (ziel) {
          if (dokumentUrl() !== l.plan.dokument) { return "dokumentGewechselt"; }
          if (!ziel.tr) { return ziel.folie ? "formFehlt" : "folieFehlt"; }
          if (ziel.tr.text !== l.geschrieben) { return "zielGeaendert"; }
          ziel.tr.text = l.vorher === null ? "" : l.vorher;
          return ctx.sync().then(function () { return null; });
        });
      });
    }
    return weg.then(function (grund) {
      if (grund) { meldung("rueckgabe-meldung", "Nicht zurückgenommen: " + K.grundSatz(grund)); return; }
      z.letzte = null;
      zeigen("ruecknahme", false);
      meldung("rueckgabe-meldung", "Zurückgenommen. Der frühere Inhalt steht wieder im Ziel.", "ok");
    }, function () { meldung("rueckgabe-meldung", "Office hat die Rücknahme abgelehnt."); });
  }

  // ----------------------------------------------------------------------------------------------
  // WISSENS-ENTWURF AUS EXCEL (R-0187) — der vorhandene Entwurfsweg
  // ----------------------------------------------------------------------------------------------

    var letzterEntwurfsVorgang = null;
    function mitEntwurfsVorgang(roh) {
      var payload = typeof roh === "string" ? JSON.parse(roh) : roh;
      var abdruck = JSON.stringify(payload);
      if (!letzterEntwurfsVorgang || letzterEntwurfsVorgang.abdruck !== abdruck) {
        var bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        letzterEntwurfsVorgang = {
          abdruck: abdruck,
          id: "office-" + Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("")
        };
      }
      return JSON.stringify(Object.assign({}, payload, { operationId: letzterEntwurfsVorgang.id }));
    }

  function entwurfSenden() {
    if (!z.kontext || z.host !== "excel" || z.bewertung.zustand === "leer") {
      meldung("rueckgabe-meldung", "Erst Zellen markieren und lesen.");
      return Promise.resolve();
    }
    var b0 = z.kontext.bereiche[0];
    // Ben-Befund D: der Bereich bleibt vollständig; gekürzt wird nur der beschreibende Teil.
    var titel = K.entwurfTitel(z.kontext.mappe, z.kontext.blatt + "!" + K.lokaleAdresse(b0.zerlegt));
    z.beschaeftigt = true;
    kontrollen();
    return abruf("/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: mitEntwurfsVorgang({ title: titel, statement: z.kontextText, bodyHtml: K.excelTabelleHtml(z.kontext) }),
    })
      .then(function (res) {
        if (res.status === 201 || res.status === 200) {
          meldung("rueckgabe-meldung", "Entwurf „" + titel + "“ angelegt. Er ist noch keine geprüfte Quelle: in KLARWERK unter Erfassen prüfen und einreichen.", "ok");
        } else if (res.status === 403) {
          meldung("rueckgabe-meldung", "Dir fehlt das Recht, Entwürfe anzulegen (ko.create).");
        } else if (res.status === 401) {
          meldung("rueckgabe-meldung", "Bitte neu anmelden.");
        } else {
          meldung("rueckgabe-meldung", "Der Entwurf wurde nicht angelegt (HTTP " + res.status + ").");
        }
      }, function () { meldung("rueckgabe-meldung", "KLARWERK ist nicht erreichbar; der Ausgang ist unklar. Bitte erneut senden."); })
      .then(function () { z.beschaeftigt = false; kontrollen(); });
  }

  // ----------------------------------------------------------------------------------------------
  // ZUSTAND DER KNÖPFE UND VERDRAHTUNG
  // ----------------------------------------------------------------------------------------------

  function kontrollen() {
    var frei = !z.beschaeftigt;
    var gelesen = !!z.kontext && !!z.bewertung && z.bewertung.zustand !== "leer";
    aktiv("kontext-lesen", z.officeBereit && frei);
    aktiv("frage-senden", z.officeBereit && !!z.sitzung && frei);
    var excel = z.host === "excel" && z.api && z.api.faehigkeiten.bereichSchreiben;
    aktiv("summe-vorbereiten", frei && excel && gelesen && z.bewertung.zustand === "ok");
    // Ben-Befund (Nacharbeit 2): zurückgeben lässt sich nur eine Antwort zur gültigen Lage.
    var antwortGilt = antwortNutzbar();
    aktiv("zelltext-vorbereiten", frei && excel && antwortGilt);
    aktiv("entwurf-senden", frei && z.host === "excel" && gelesen && z.angemeldet);
    aktiv("formtext-vorbereiten", frei && z.host === "powerpoint" && antwortGilt && !!z.bewertung && z.bewertung.rueckgabeMoeglich === true);
    aktiv("plan-ausfuehren", frei && !!z.plan);
  }

  function schrittZeigen(ziel) {
    var e = el(ziel);
    if (!e) { return; }
    e.classList.add("hervorgehoben");
    try { e.scrollIntoView({ block: "center" }); } catch (err) { /* alter Webview */ }
    if (typeof e.focus === "function") { e.focus(); }
    setTimeout(function () { e.classList.remove("hervorgehoben"); }, 2000);
  }

  function verdrahten() {
    el("anmelden-knopf").addEventListener("click", anmelden);
    el("kontext-lesen").addEventListener("click", kontextLesen);
    el("frage-senden").addEventListener("click", fragen);
    el("zustimmung-geben").addEventListener("click", function () { zustimmung(true); });
    el("zustimmung-widerrufen").addEventListener("click", function () { zustimmung(false); });
    el("summe-vorbereiten").addEventListener("click", summeVorbereiten);
    el("zelltext-vorbereiten").addEventListener("click", zelltextVorbereiten);
    el("formtext-vorbereiten").addEventListener("click", formtextVorbereiten);
    el("entwurf-senden").addEventListener("click", entwurfSenden);
    el("plan-ausfuehren").addEventListener("click", ausfuehren);
    el("plan-verwerfen").addEventListener("click", function () { z.plan = null; zeigen("plan", false); kontrollen(); });
    el("ruecknahme").addEventListener("click", zuruecknehmen);
    var schritte = document.querySelectorAll("button.schritt[data-ziel]");
    for (var i = 0; i < schritte.length; i += 1) {
      (function (knopf) {
        knopf.addEventListener("click", function () { schrittZeigen(knopf.getAttribute("data-ziel")); });
      })(schritte[i]);
    }
  }

  // Für Prüfstände und die gemeinsame Begleitfigur: lesender Zugriff auf den Stand und die Wege.
  window.klaraOfficeFenster = {
    zustand: z,
    // PP-02 (folien-herkunft.js): derselbe Abrufweg samt Übergabeschlüssel — kein zweiter Login.
    abruf: abruf,
    kontextLesen: kontextLesen,
    fragen: fragen,
    summeVorbereiten: summeVorbereiten,
    zelltextVorbereiten: zelltextVorbereiten,
    formtextVorbereiten: formtextVorbereiten,
    ausfuehren: ausfuehren,
    zuruecknehmen: zuruecknehmen,
    entwurfSenden: entwurfSenden,
    auswahlGeaendert: auswahlGeaendert,
    officeBereit: officeBereit,
  };

  start();
})();

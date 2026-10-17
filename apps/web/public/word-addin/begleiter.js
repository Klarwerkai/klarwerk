// ================================================================================================
// KLARA · BEGLEITAPP — DER BLOCK KW-BEGLEITER: DIESES WORD-FENSTER ALS OFFICE-ADAPTER.
// ================================================================================================
//
// AUFTRAG `produkt:20261010:klara-office-mac-maskottchen` (KLARA-OFFICE-02): Die frei bewegliche
// Begleitapp auf dem Mac (`apps/desktop/klara-begleiter`) bekommt ihren Office-Kontext
// AUSSCHLIESSLICH von hier — nie aus Bildschirmbildern, Fenstertiteln oder Bedienungshilfen.
// Office liefert Host, Hostfassung, Dokumentadresse und Auswahl; dieser Block reicht genau das an
// die eigene Klarwerk-Instanz weiter (`/api/me/klara/begleiter/*`, Kanal `klara-begleiter.ts`), und
// die Begleitapp liest es dort unter derselben Anmeldung.
//
// WAS DER BLOCK TUT, und wann:
//   · NICHTS, solange der Schalter „Mit Begleitapp verbinden" in den Einstellungen aus ist. Er ist
//     bei jedem Laden des Fensters aus; die Wahl wird nirgends gespeichert.
//   · EINGESCHALTET meldet er dieses Fenster an (Host, Fassung, Dokumentkennung, Dateiname) und
//     danach alle zwei Sekunden: die aktuelle Markierung (höchstens 4.000 Zeichen, dazu die volle
//     Länge) mit einem Auswahlstand, der bei jeder Änderung steigt. Die Dokumentadresse verlässt
//     Word NICHT — gesendet wird nur ihre SHA-256-Prüfsumme und der Dateiname.
//   · AKTIONEN der Begleitapp kommen als Antwort auf die Meldung zurück und werden HIER ausgeführt:
//       - „einfuegen": der Text kommt HINTER den bestätigten, verfolgten Office-Bereich — nur,
//         wenn seither keine Auswahländerung kam (auch nicht bei gleichem Text), die Markierung
//         noch genau dieser Bereich ist und sein Text gleich blieb; sonst wird abgelehnt.
//       - „frage": die Frage geht in das Fragefeld DIESES Fensters und über dessen eigenen,
//         gebundenen Frageweg (Sitzung, Einwilligung, Rechte, Markierungsregeln unverändert). Was
//         das Fenster als Antwort oder Fehler zeigt, geht als Ergebnis zurück.
//   · AUSGESCHALTET, beim Schließen des Fensters und beim Abmelden meldet er sich ab.
//
// WARUM EINE EIGENE DATEI: dieselbe Bauform wie `begriffe.js` und `anleitung.js` — `taskpane.js`
// ist in seiner Grösse bewacht (`tests/klara-zerlegung/schnittflaechen.test.ts` B3). Klassisches
// Skript, ES5 wie das Fenster, auf der Ignorierliste von Biome, im KOPF von `taskpane.html`
// geladen; es schliesst sich erst bei `DOMContentLoaded` an. Das Markup (eine Einstellungszeile)
// baut der Block selbst. Er liest die Globale `lang` des Fensters und ruft `fetch` erst beim
// Abruf — so trägt jeder Aufruf den Zugangsschlüssel des Fensters (Word im Web). Ohne Anmeldung
// antwortet der Server 401; die Zeile sagt dann „Bitte zuerst bei Klarwerk anmelden".
//
// DATENFLUSS (ausgewiesen): Nur bei eingeschaltetem Schalter gehen Host, Hostfassung, Dateiname,
// Prüfsumme der Dokumentadresse und die Markierung an DIESELBE Klarwerk-Instanz, unter dem eigenen
// Konto, in den Arbeitsspeicher des Servers (nichts davon wird gespeichert oder protokolliert).
// Kein Modell, kein externer Dienst. In das Dokument geschrieben wird nur auf eine Aktion aus der
// Begleitapp, und nur hinter die unveränderte Markierung.
// ================================================================================================
"use strict";

    // KW-BEGLEITER-START
    var BEGLEITER_TEXTE = {
      de: {
        titel: "Mit Begleitapp verbinden",
        hinweis: "Teilt Host, Dateiname und Markierung dieses Fensters (höchstens 4.000 Zeichen) mit deiner Klarwerk-Begleitapp auf diesem Konto — nur solange eingeschaltet.",
        aus: "Nicht verbunden.",
        verbindet: "Verbindet …",
        verbunden: "Verbunden · Begleitapp sieht dieses Fenster.",
        getrennt: "Verbindung unterbrochen — wird erneut versucht.",
        anmeldung: "Bitte zuerst bei Klarwerk anmelden.",
        keinOffice: "Ohne Word-Dokument gibt es nichts zu teilen."
      },
      en: {
        titel: "Connect companion app",
        hinweis: "Shares host, file name and selection of this window (at most 4,000 characters) with your Klarwerk companion app on this account — only while switched on.",
        aus: "Not connected.",
        verbindet: "Connecting …",
        verbunden: "Connected · the companion app sees this window.",
        getrennt: "Connection interrupted — retrying.",
        anmeldung: "Please sign in to Klarwerk first.",
        keinOffice: "Without a Word document there is nothing to share."
      },
      nl: {
        titel: "Verbinden met begeleider-app",
        hinweis: "Deelt host, bestandsnaam en selectie van dit venster (maximaal 4.000 tekens) met je Klarwerk-begeleider-app op dit account — alleen zolang ingeschakeld.",
        aus: "Niet verbonden.",
        verbindet: "Verbinden …",
        verbunden: "Verbonden · de begeleider-app ziet dit venster.",
        getrennt: "Verbinding onderbroken — opnieuw proberen.",
        anmeldung: "Meld je eerst aan bij Klarwerk.",
        keinOffice: "Zonder Word-document valt er niets te delen."
      }
    };
    var BEGLEITER_BASIS = "/api/me/klara/begleiter";
    var BEGLEITER_TAKT_MS = 2000;
    var BEGLEITER_AUSWAHL_MAX = 4000;
    var BEGLEITER_ERGEBNIS_MAX = 8000;
    var BEGLEITER_FRAGE_FRIST_MS = 90000;

    var begleiterAn = false;
    var begleiterLage = "aus";
    var begleiterInstanz = null;
    var begleiterAngemeldet = false;
    var begleiterSeq = 0;
    var begleiterAuswahl = null;
    var begleiterAuswahlStand = 0;
    var begleiterTimer = null;
    var begleiterUnterwegs = false;
    var begleiterErledigt = [];
    var begleiterDokument = null;
    var begleiterNonce = null;
    var begleiterAuswahlHandler = false;
    var begleiterAuswahlVerzoegerung = null;
    // Jede Verbindung hat ihre Runde; eine Antwort aus einer alten Runde (ausgeschaltet, neu
    // verbunden) wird verworfen, statt den Zustand der neuen zu überschreiben.
    var begleiterRunde = 0;

    function begleiterT(schluessel) {
      var sprache = (typeof lang === "string" && BEGLEITER_TEXTE[lang]) ? lang : "de";
      return BEGLEITER_TEXTE[sprache][schluessel] || BEGLEITER_TEXTE.de[schluessel] || "";
    }

    function begleiterHex(puffer) {
      var bytes = new Uint8Array(puffer);
      var hex = "";
      for (var i = 0; i < bytes.length; i += 1) {
        hex += ("0" + bytes[i].toString(16)).slice(-2);
      }
      return hex;
    }

    function begleiterZufall(praefix) {
      var puffer = new Uint8Array(16);
      (self.crypto || window.crypto).getRandomValues(puffer);
      return praefix + "-" + begleiterHex(puffer.buffer);
    }

    /** Welcher Host? Office sagt es selbst (`diagnostics.platform`) — nichts wird geraten. */
    function begleiterHost() {
      var d = null;
      try { d = window.Office && Office.context && Office.context.diagnostics; } catch (e) { d = null; }
      var plattform = d && typeof d.platform === "string" ? d.platform : "";
      var fassung = d && typeof d.version === "string" ? d.version.slice(0, 40) : "";
      var host = plattform === "Mac" ? "word-mac"
        : plattform === "OfficeOnline" ? "word-web"
        : plattform === "PC" ? "word-windows"
        : "word-andere";
      return { host: host, fassung: fassung.replace(/[^0-9A-Za-z .()_-]/g, "") };
    }

    function begleiterTitelAus(url) {
      var ohne = url.split("#")[0].split("?")[0];
      var teile = ohne.split(/[\/\\]/);
      var name = teile[teile.length - 1] || "";
      try { name = decodeURIComponent(name); } catch (e) { /* roh lassen */ }
      return name.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 120);
    }

    /**
     * Die Dokumentkennung aus Office: für ein gespeichertes Dokument die Prüfsumme seiner Adresse
     * (dieselbe Adresse → dieselbe Kennung, auch in zwei Fenstern), sonst eine Nonce dieses Fensters.
     */
    function begleiterDokumentLesen(fertig) {
      var url = "";
      try {
        url = (window.Office && Office.context && Office.context.document && Office.context.document.url) || "";
      } catch (e) { url = ""; }
      if (typeof url !== "string" || url.length === 0 || !(window.crypto && crypto.subtle)) {
        if (begleiterNonce === null) { begleiterNonce = begleiterZufall("neu").slice(4); }
        fertig({ kennung: "neu-" + begleiterNonce, titel: "", gespeichert: false });
        return;
      }
      var bytes = new TextEncoder().encode(url);
      crypto.subtle.digest("SHA-256", bytes).then(function (summe) {
        fertig({ kennung: "url-" + begleiterHex(summe).slice(0, 32), titel: begleiterTitelAus(url), gespeichert: true });
      }, function () {
        if (begleiterNonce === null) { begleiterNonce = begleiterZufall("neu").slice(4); }
        fertig({ kennung: "neu-" + begleiterNonce, titel: "", gespeichert: false });
      });
    }

    // DER BESTÄTIGTE BEREICH (Ben, Nacharbeit 2): Ein Einfügen gilt nicht für „die Auswahl, die
    // gerade ist", sondern für GENAU den Office-Bereich, den die Begleitapp gesehen hat. Beim Lesen
    // der Markierung wird der Bereich über `Word.run` geholt und verfolgt (`track`); ein späterer
    // Auftrag schreibt in DIESEN Bereich (`Word.run(bereich, …)`), nie in `getSelection()`. Jede
    // Auswahländerung — auch ein Positionswechsel mit identischem Text — macht den Bereich SOFORT
    // ungültig (Stand steigt im Ereignis, nicht erst nach dem verzögerten Lesen).
    var begleiterBereich = null;

    function begleiterBereichFreigeben() {
      var alt = begleiterBereich;
      begleiterBereich = null;
      if (alt && alt.bereich && typeof alt.bereich.untrack === "function" && window.Word && Word.run) {
        try {
          Word.run(alt.bereich, function (context) {
            alt.bereich.untrack();
            return context.sync();
          }).then(null, function () { /* Word hat ihn schon verworfen */ });
        } catch (e) { /* ohne Kontext nichts freizugeben */ }
      }
    }

    /** Jede Auswahländerung: sofort ungültig — Stand steigt, Auswahl und Bereich verfallen. */
    function begleiterAuswahlUngueltig() {
      begleiterAuswahlStand += 1;
      begleiterAuswahl = null;
      begleiterBereichFreigeben();
    }

    function begleiterAuswahlLesen() {
      var runde = begleiterRunde;
      var stand = begleiterAuswahlStand;
      // Gibt `true` zurück, wenn `bereich` als Bindung ÜBERNOMMEN wurde. Sonst gehört er niemandem
      // und muss vom Aufrufer im selben Kontext wieder freigegeben werden (Ben, Nacharbeit 4).
      var uebernehmen = function (text, bereich) {
        // Hat sich die Auswahl seit Beginn des Lesens erneut geändert, gilt dieser Stand nicht.
        if (runde !== begleiterRunde || !begleiterAn || stand !== begleiterAuswahlStand) { return false; }
        begleiterAuswahl = text.length === 0 ? null : { voll: text };
        // Eine noch gehaltene Bindung (sollte nach `begleiterAuswahlUngueltig` nicht vorkommen)
        // wird freigegeben, bevor die neue sie ersetzt — nie still überschrieben.
        if (begleiterBereich !== null) { begleiterBereichFreigeben(); }
        var gebunden = text.length > 0 && Boolean(bereich);
        begleiterBereich = gebunden ? { bereich: bereich, stand: stand, text: text } : null;
        // Eine geänderte Markierung geht sofort hinaus, nicht erst mit dem nächsten Takt.
        begleiterMelden();
        return gebunden;
      };
      if (window.Word && Word.run) {
        Word.run(function (context) {
          var bereich = context.document.getSelection();
          var verfolgt = typeof bereich.track === "function";
          bereich.load("text");
          if (verfolgt) { bereich.track(); }
          return context.sync().then(function () {
            var uebernommen = uebernehmen(typeof bereich.text === "string" ? bereich.text : "", bereich);
            // Leere Auswahl, veraltetes Ergebnis (Auswahlwechsel), Ausschalten oder Rundenwechsel:
            // der verfolgte Bereich wird hier, unabhängig von `begleiterBereich`, wieder freigegeben —
            // und die Freigabe mit `context.sync()` abgeschlossen.
            if (!uebernommen && verfolgt && typeof bereich.untrack === "function") {
              bereich.untrack();
              return context.sync();
            }
            return undefined;
          });
        }).then(null, function () { /* nicht lesbar: keine Auswahl */ });
        return;
      }
      // Ohne Word-API nur der Text — ohne Bereich ist ein Einfügen nicht möglich (s. unten).
      if (!(window.Office && Office.context && Office.context.document && Office.context.document.getSelectedDataAsync)) {
        return;
      }
      Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, function (ergebnis) {
        uebernehmen(ergebnis && ergebnis.status === Office.AsyncResultStatus.Succeeded && typeof ergebnis.value === "string"
          ? ergebnis.value : "", null);
      });
    }

    function begleiterAuswahlBeobachten() {
      if (begleiterAuswahlHandler || !(window.Office && Office.context && Office.context.document
        && Office.context.document.addHandlerAsync && Office.EventType)) {
        return;
      }
      begleiterAuswahlHandler = true;
      Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, function () {
        if (!begleiterAn) { return; }
        begleiterAuswahlUngueltig();
        clearTimeout(begleiterAuswahlVerzoegerung);
        begleiterAuswahlVerzoegerung = setTimeout(begleiterAuswahlLesen, 300);
      });
    }

    function begleiterAbruf(methode, pfad, koerper, keepalive) {
      var init = { method: methode, credentials: "include", headers: {} };
      if (koerper) {
        init.headers["content-type"] = "application/json";
        init.body = JSON.stringify(koerper);
      }
      if (keepalive) { init.keepalive = true; }
      return window.fetch(BEGLEITER_BASIS + pfad, init).then(function (res) {
        return res.json().then(function (body) { return { status: res.status, body: body }; },
          function () { return { status: res.status, body: null }; });
      });
    }

    function begleiterLageSetzen(lage) {
      begleiterLage = lage;
      begleiterZeichnen();
    }

    function begleiterAnmelden() {
      var runde = begleiterRunde;
      begleiterDokumentLesen(function (dokument) {
        if (runde !== begleiterRunde || !begleiterAn) { return; }
        begleiterDokument = dokument;
        var host = begleiterHost();
        begleiterUnterwegs = true;
        begleiterAbruf("POST", "/adapter", {
          instanz: begleiterInstanz,
          host: host.host,
          hostFassung: host.fassung,
          dokument: dokument
        }).then(function (antwort) {
          begleiterUnterwegs = false;
          if (runde !== begleiterRunde || !begleiterAn) { return; }
          if (antwort.status === 201) {
            begleiterAngemeldet = true;
            begleiterSeq = 0;
            begleiterLageSetzen("verbunden");
            begleiterAuswahlUngueltig();
            begleiterAuswahlLesen();
            begleiterMelden();
          } else {
            begleiterLageSetzen(antwort.status === 401 ? "anmeldung" : "getrennt");
          }
        }, function () {
          begleiterUnterwegs = false;
          if (runde === begleiterRunde && begleiterAn) { begleiterLageSetzen("getrennt"); }
        });
      });
    }

    function begleiterMelden() {
      if (!begleiterAn || begleiterUnterwegs) { return; }
      if (!begleiterAngemeldet) { begleiterAnmelden(); return; }
      var runde = begleiterRunde;
      begleiterSeq += 1;
      var ergebnisse = begleiterErledigt.slice(0, 10);
      var koerper = { seq: begleiterSeq, erledigt: ergebnisse };
      if (begleiterAuswahl !== null) {
        koerper.auswahl = {
          text: begleiterAuswahl.voll.slice(0, BEGLEITER_AUSWAHL_MAX).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " "),
          laenge: begleiterAuswahl.voll.length,
          stand: begleiterAuswahlStand
        };
      } else {
        koerper.auswahl = null;
        koerper.auswahlStand = begleiterAuswahlStand;
      }
      begleiterUnterwegs = true;
      begleiterAbruf("PUT", "/adapter/" + begleiterInstanz, koerper).then(function (antwort) {
        begleiterUnterwegs = false;
        if (runde !== begleiterRunde || !begleiterAn) { return; }
        if (antwort.status === 200) {
          begleiterErledigt = begleiterErledigt.slice(ergebnisse.length);
          if (begleiterLage !== "verbunden") { begleiterLageSetzen("verbunden"); }
          var auftraege = antwort.body && antwort.body.aktionen;
          if (auftraege && auftraege.length) {
            for (var i = 0; i < auftraege.length; i += 1) { begleiterAusfuehren(auftraege[i]); }
          }
        } else if (antwort.status === 404 || antwort.status === 409) {
          // Vergessen (Neustart, Frist) oder aus dem Takt: neu anmelden — die Wiederverbindung.
          begleiterAngemeldet = false;
          begleiterLageSetzen("verbindet");
        } else {
          begleiterLageSetzen(antwort.status === 401 ? "anmeldung" : "getrennt");
        }
      }, function () {
        begleiterUnterwegs = false;
        if (runde === begleiterRunde && begleiterAn) { begleiterLageSetzen("getrennt"); }
      });
    }

    function begleiterErgebnis(id, stand, ergebnis, grund) {
      begleiterErledigt.push({
        id: id,
        stand: stand,
        ergebnis: ergebnis === null ? null : String(ergebnis).slice(0, BEGLEITER_ERGEBNIS_MAX),
        grund: grund === null ? null : String(grund).slice(0, 200)
      });
      begleiterMelden();
    }

    /**
     * Einfügen in den BESTÄTIGTEN Bereich. Abgelehnt wird vor jedem Schreiben, wenn
     *   · der Auftrag einem anderen Auswahlstand gilt oder seither eine Auswahländerung kam,
     *   · es keinen bestätigten Bereich zu diesem Stand gibt,
     *   · die aktuelle Markierung nicht mehr genau dieser Bereich ist (`compareLocationWith`) oder
     *   · sein Text sich geändert hat.
     */
    function begleiterEinfuegen(auftrag) {
      var b = begleiterBereich;
      if (auftrag.auswahlStand !== begleiterAuswahlStand || !b || b.stand !== auftrag.auswahlStand) {
        begleiterErgebnis(auftrag.id, "abgelehnt", null, "auswahl_geaendert");
        return;
      }
      if (!(window.Word && Word.run)) {
        begleiterErgebnis(auftrag.id, "fehler", null, "word_api_fehlt");
        return;
      }
      Word.run(b.bereich, function (context) {
        var jetzt = context.document.getSelection();
        var lage = typeof jetzt.compareLocationWith === "function" ? jetzt.compareLocationWith(b.bereich) : null;
        b.bereich.load("text");
        return context.sync().then(function () {
          var unveraendert = auftrag.auswahlStand === begleiterAuswahlStand && begleiterBereich === b
            && (lage === null || lage.value === "Equal") && b.bereich.text === b.text;
          if (!unveraendert) { return "auswahl_geaendert"; }
          b.bereich.insertText(auftrag.text, "After");
          return context.sync().then(function () { return null; });
        });
      }).then(function (grund) {
        if (grund) {
          begleiterErgebnis(auftrag.id, "abgelehnt", null, grund);
        } else {
          begleiterErgebnis(auftrag.id, "erledigt", null, null);
        }
      }, function (fehler) {
        begleiterErgebnis(auftrag.id, "fehler", null, (fehler && fehler.code) || "word_fehler");
      });
    }

    function begleiterTextVon(id) {
      var el = document.getElementById(id);
      return el ? (el.textContent || "").trim() : "";
    }

    /**
     * Die Frage geht über das Fragefeld DIESES Fensters — derselbe Knopf, den die Person drücken
     * würde, mit allen Toren des Fensters. Gewartet wird auf eine NEUE Antwort oder einen Status.
     */
    function begleiterFragen(auftrag) {
      var feld = document.getElementById("ask-input");
      var knopf = document.getElementById("ask-btn");
      if (!feld || !knopf) {
        begleiterErgebnis(auftrag.id, "fehler", null, "fragefeld_fehlt");
        return;
      }
      var reiter = document.getElementById("tab-ask");
      if (reiter && typeof reiter.click === "function") { reiter.click(); }
      feld.value = auftrag.text;
      feld.dispatchEvent(new Event("input", { bubbles: true }));
      if (knopf.disabled) {
        begleiterErgebnis(auftrag.id, "abgelehnt", null, begleiterTextVon("ask-status").slice(0, 200) || "frage_gesperrt");
        return;
      }
      var antwortVorher = begleiterTextVon("ask-answer-text");
      var statusVorher = begleiterTextVon("ask-status");
      var beginn = Date.now();
      knopf.click();
      var pruefen = setInterval(function () {
        var antwort = begleiterTextVon("ask-answer-text");
        var status = begleiterTextVon("ask-status");
        var block = document.getElementById("ask-answer-block");
        var sichtbar = !block || block.className.indexOf("hidden") < 0;
        if (antwort && antwort !== antwortVorher && sichtbar) {
          clearInterval(pruefen);
          begleiterErgebnis(auftrag.id, "erledigt", antwort, null);
        } else if (!knopf.disabled && status && status !== statusVorher && Date.now() - beginn > 500) {
          clearInterval(pruefen);
          begleiterErgebnis(auftrag.id, "fehler", null, status);
        } else if (Date.now() - beginn > BEGLEITER_FRAGE_FRIST_MS) {
          clearInterval(pruefen);
          begleiterErgebnis(auftrag.id, "fehler", null, "zeitueberschreitung");
        }
      }, 400);
    }

    function begleiterAusfuehren(auftrag) {
      if (!auftrag || typeof auftrag.id !== "string") { return; }
      if (auftrag.art === "einfuegen") { begleiterEinfuegen(auftrag); }
      else if (auftrag.art === "frage") { begleiterFragen(auftrag); }
      else { begleiterErgebnis(auftrag.id, "abgelehnt", null, "unbekannte_aktion"); }
    }

    function begleiterVerbinden() {
      begleiterRunde += 1;
      begleiterAn = true;
      begleiterInstanz = begleiterZufall("bgl");
      begleiterAngemeldet = false;
      begleiterAuswahl = null;
      begleiterAuswahlStand = 0;
      begleiterBereichFreigeben();
      begleiterErledigt = [];
      begleiterLageSetzen("verbindet");
      begleiterAuswahlBeobachten();
      begleiterAnmelden();
      clearInterval(begleiterTimer);
      begleiterTimer = setInterval(begleiterMelden, BEGLEITER_TAKT_MS);
    }

    function begleiterTrennen() {
      var instanz = begleiterInstanz;
      var warAngemeldet = begleiterAngemeldet;
      begleiterRunde += 1;
      begleiterAn = false;
      begleiterAngemeldet = false;
      begleiterUnterwegs = false;
      begleiterAuswahl = null;
      begleiterBereichFreigeben();
      clearInterval(begleiterTimer);
      begleiterTimer = null;
      begleiterLageSetzen("aus");
      if (instanz && warAngemeldet) {
        begleiterAbruf("DELETE", "/adapter/" + instanz, null, true).then(null, function () { /* Frist räumt ab */ });
      }
      begleiterInstanz = null;
    }

    function begleiterZeichnen() {
      var schalter = document.getElementById("einst-begleiter");
      var titel = document.getElementById("einst-begleiter-text");
      var lageZeile = document.getElementById("einst-begleiter-lage");
      if (!schalter || !titel || !lageZeile) { return; }
      titel.textContent = begleiterT("titel");
      schalter.setAttribute("aria-checked", begleiterAn ? "true" : "false");
      schalter.className = begleiterAn ? "schalter an" : "schalter";
      var officeDa = Boolean(window.Office && Office.context && Office.context.document);
      lageZeile.textContent = (!officeDa && !begleiterAn) ? begleiterT("keinOffice") : begleiterT(begleiterLage);
      lageZeile.setAttribute("data-lage", begleiterLage);
      lageZeile.setAttribute("title", begleiterT("hinweis"));
    }

    function begleiterAnschliessen() {
      if (document.getElementById("einst-begleiter")) { return; }
      var nachbar = document.getElementById("einst-absatzblick");
      var zeile = nachbar && nachbar.parentNode;
      var gruppe = zeile && zeile.parentNode;
      if (!gruppe) { return; }
      var neu = document.createElement("div");
      neu.className = "einst-zeile";
      neu.id = "einst-begleiter-zeile";
      var text = document.createElement("span");
      text.id = "einst-begleiter-text";
      var schalter = document.createElement("button");
      schalter.type = "button";
      schalter.id = "einst-begleiter";
      schalter.setAttribute("role", "switch");
      var knopf = document.createElement("span");
      knopf.className = "knopf";
      schalter.appendChild(knopf);
      neu.appendChild(text);
      neu.appendChild(schalter);
      var lageZeile = document.createElement("p");
      lageZeile.id = "einst-begleiter-lage";
      lageZeile.className = "einst-hinweis";
      lageZeile.setAttribute("aria-live", "polite");
      gruppe.insertBefore(lageZeile, zeile.nextSibling);
      gruppe.insertBefore(neu, lageZeile);
      schalter.addEventListener("click", function () {
        if (begleiterAn) { begleiterTrennen(); } else { begleiterVerbinden(); }
      });
      // Das Fenster schliesst: abmelden, solange der Seitenabbau es noch zulässt.
      window.addEventListener("pagehide", function () { if (begleiterAn) { begleiterTrennen(); } });
      begleiterZeichnen();
      // Sprachwechsel und Anmeldestand des Fensters folgen ohne eigenen Haken am Fenster.
      setInterval(begleiterZeichnen, 1500);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", begleiterAnschliessen);
    } else {
      begleiterAnschliessen();
    }
    // KW-BEGLEITER-END

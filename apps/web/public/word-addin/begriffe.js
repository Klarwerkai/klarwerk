// ================================================================================================
// KLARA · FIRMENWÖRTERBUCH IN WORD — DER BLOCK KW-BEGRIFFE, ALS EIGENE DATEI.
// ================================================================================================
//
// WOZU: Klara prüft das offene Word-Dokument gegen das Firmenwörterbuch der Instanz und zeigt je
// Fundstelle die gepflegte Vorzugsbezeichnung mit Bedeutung und Herkunft (Eintrag, Fassung). Der
// Nutzer übernimmt oder verwirft JEDEN Hinweis einzeln; übernommen wird genau die angezeigte
// Stelle über `Range.insertText(…, "Replace")` — die Zeichenformatierung der Stelle und alle anderen
// Textteile bleiben, wie sie sind. Es gibt kein „alle ersetzen".
//
// WARUM EINE EIGENE DATEI: `taskpane.js` ist in seiner Grösse bewacht
// (`tests/klara-zerlegung/schnittflaechen.test.ts` B3, „schneiden statt anheben"). Dieselbe Bauform
// wie `marke.js`: klassisches Skript, ES5 wie das Fenster, auf der Ignorierliste von Biome. Es steht
// im KOPF von `taskpane.html` und schliesst sich erst bei `DOMContentLoaded` an — dann sind Markup,
// `taskpane.js` und `marke.js` gelaufen. (Hinter dem Fensterskript darf kein Verweis stehen: rund
// fünfzehn Prüfstände schneiden das Skript bis zum LETZTEN `</script>` heraus.) Es nutzt die
// Globalen des Fensters (`lang`, `signedIn`, `officeUsable`, `bestandRuheSichtbar`,
// `bestandSitzung`) und hängt sich an `bestandZeichnen` und `setLang`. Fehlen sie (das
// Fensterskript ist nicht geladen), bleibt der Block verborgen.
//
// DATENFLUSS (ausgewiesen): Gelesen werden die Absatztexte des offenen Dokuments über Office.js im
// Word-Host des Kunden. Sie gehen an GENAU EINE Stelle: `POST /api/begriffe/pruefen` derselben
// Klarwerk-Instanz (gleicher Ursprung, Sitzung des Fensters). Dort werden sie deterministisch gegen
// den Katalog abgeglichen — kein Modell, kein externer Dienst — und weder gespeichert noch
// protokolliert. Microsoft 365 erhält über diesen Weg nichts zusätzlich; geschrieben wird nur bei
// „Übernehmen", und nur an der einen Stelle im Dokument.
//
// KEINE SACHAUSSAGE: Der feste Satz unter dem Knopf sagt, dass nur Benennungen geprüft werden.
// ================================================================================================
"use strict";

    // KW-BEGRIFFE-START
    var BEGRIFFE_TEXTE = {
      de: {
        cta: "Begriffe prüfen",
        alle: "Alle Geltungsbereiche",
        bereich: "Geltungsbereich",
        grenze: "Geprüft wird nur die Benennung nach dem Firmenwörterbuch – nicht, ob die Aussage sachlich stimmt.",
        laeuft: "Begriffe werden geprüft …",
        keine: "Keine Begriffshinweise (geprüft {zeit}). Das sagt nichts über die sachliche Richtigkeit.",
        treffer: "Begriffshinweise: {n} (geprüft {zeit})",
        fehler: "Begriffsprüfung nicht möglich.",
        anmeldung: "Bitte erneut anmelden.",
        recht: "Dafür fehlt das Recht.",
        zuGross: "Das Dokument ist für die Begriffsprüfung zu umfangreich (höchstens {segmente} Absätze, {zeichen} Zeichen).",
        keinText: "Word hat keinen lesbaren Text geliefert.",
        vorschlag: "„{gefunden}“ → im Haus heißt es „{vorzug}“",
        definition: "Bedeutung: {definition}",
        herkunft: "Geltungsbereich „{bereich}“, Fassung {version}",
        mehrdeutig: "In mehreren Geltungsbereichen gepflegt – bitte prüfen, welcher gemeint ist.",
        uebernehmen: "Übernehmen",
        verwerfen: "Verwerfen",
        uebernommen: "Übernommen: „{vorzug}“.",
        veraltet: "Der Absatz hat sich seit der Prüfung geändert – nichts ersetzt. Bitte erneut prüfen.",
        uneindeutig: "Die Stelle ist in Word nicht eindeutig zu finden – nichts ersetzt. Bitte von Hand ändern.",
        schreibfehler: "Word hat die Änderung nicht angenommen – nichts ersetzt."
      },
      en: {
        cta: "Check terms",
        alle: "All scopes",
        bereich: "Scope",
        grenze: "Only the wording is checked against the company glossary – not whether the statement is factually correct.",
        laeuft: "Checking terms …",
        keine: "No term hints (checked {zeit}). This says nothing about factual correctness.",
        treffer: "Term hints: {n} (checked {zeit})",
        fehler: "Term check not possible.",
        anmeldung: "Please sign in again.",
        recht: "You do not have permission for this.",
        zuGross: "The document is too large for the term check (at most {segmente} paragraphs, {zeichen} characters).",
        keinText: "Word did not return any readable text.",
        vorschlag: "“{gefunden}” → the company term is “{vorzug}”",
        definition: "Meaning: {definition}",
        herkunft: "Scope “{bereich}”, version {version}",
        mehrdeutig: "Maintained in more than one scope – please check which one is meant.",
        uebernehmen: "Apply",
        verwerfen: "Dismiss",
        uebernommen: "Applied: “{vorzug}”.",
        veraltet: "The paragraph has changed since the check – nothing replaced. Please check again.",
        uneindeutig: "The location cannot be found unambiguously in Word – nothing replaced. Please change it manually.",
        schreibfehler: "Word did not accept the change – nothing replaced."
      },
      nl: {
        cta: "Begrippen controleren",
        alle: "Alle toepassingsgebieden",
        bereich: "Toepassingsgebied",
        grenze: "Alleen de benaming wordt getoetst aan het bedrijfswoordenboek – niet of de uitspraak inhoudelijk klopt.",
        laeuft: "Begrippen worden gecontroleerd …",
        keine: "Geen begripshints (gecontroleerd {zeit}). Dit zegt niets over de inhoudelijke juistheid.",
        treffer: "Begripshints: {n} (gecontroleerd {zeit})",
        fehler: "Begripscontrole niet mogelijk.",
        anmeldung: "Meld je opnieuw aan.",
        recht: "Daarvoor heb je geen recht.",
        zuGross: "Het document is te groot voor de begripscontrole (maximaal {segmente} alinea's, {zeichen} tekens).",
        keinText: "Word heeft geen leesbare tekst geleverd.",
        vorschlag: "‘{gefunden}’ → binnen het bedrijf heet het ‘{vorzug}’",
        definition: "Betekenis: {definition}",
        herkunft: "Toepassingsgebied ‘{bereich}’, versie {version}",
        mehrdeutig: "In meerdere toepassingsgebieden beheerd – controleer welk bedoeld is.",
        uebernehmen: "Overnemen",
        verwerfen: "Negeren",
        uebernommen: "Overgenomen: ‘{vorzug}’.",
        veraltet: "De alinea is sinds de controle gewijzigd – niets vervangen. Controleer opnieuw.",
        uneindeutig: "De plek is in Word niet eenduidig te vinden – niets vervangen. Wijzig het handmatig.",
        schreibfehler: "Word heeft de wijziging niet aangenomen – niets vervangen."
      }
    };
    // Dieselben Grenzen wie der Server (`BEGRIFF_GRENZEN` in services/app/src/firmenwoerterbuch.ts).
    var BEGRIFFE_MAX_SEGMENTE = 2000;
    var BEGRIFFE_MAX_ZEICHEN = 200000;

    var begriffeLage = "ruhe";   // ruhe | laden | fehler
    var begriffeGrund = "";
    var begriffeMeldung = "";
    var begriffeLauf = 0;
    var begriffeStand = null;    // { segmente, hinweise, zeit, sitzung }
    var begriffeVerworfen = {};
    var begriffeBereiche = null; // null: noch nicht geladen
    var begriffeBereicheLaedt = false;
    var begriffeBereicheSitzung = null;

    function begriffeT(schluessel, werte) {
      var tabelle = BEGRIFFE_TEXTE[typeof lang === "string" && BEGRIFFE_TEXTE[lang] ? lang : "de"];
      var satz = tabelle[schluessel] || BEGRIFFE_TEXTE.de[schluessel] || schluessel;
      if (werte) {
        for (var name in werte) {
          if (Object.prototype.hasOwnProperty.call(werte, name)) {
            satz = satz.split("{" + name + "}").join(String(werte[name]));
          }
        }
      }
      return satz;
    }

    function begriffeZeit() {
      var d = new Date();
      function pad(n) { return n < 10 ? "0" + n : String(n); }
      return pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    function begriffeSitzung() {
      return typeof bestandSitzung === "undefined" ? null : bestandSitzung;
    }

    /** Ist ein Word-Dokument nutzbar? Ohne das Fensterskript (Ladefehler) schlicht nein. */
    function begriffeOffice() {
      return typeof officeUsable === "function" && Boolean(officeUsable()) &&
        typeof Word !== "undefined" && Boolean(Word) && typeof Word.run === "function";
    }

    function begriffeSichtbar() {
      var angemeldet = typeof signedIn !== "undefined" && Boolean(signedIn);
      var ruhe = typeof bestandRuheSichtbar === "function" ? bestandRuheSichtbar() : false;
      return angemeldet && ruhe && begriffeOffice();
    }

    function begriffeKnoten(tag, klasse, text) {
      var el = document.createElement(tag);
      if (klasse) { el.className = klasse; }
      if (text !== undefined) { el.textContent = text; }
      return el;
    }

    function begriffeKennung(h, segmentText) {
      return h.begriffId + "|" + h.start + "|" + h.gefunden + "|" + segmentText;
    }

    function begriffeSichtbareHinweise() {
      if (!begriffeStand) { return []; }
      var raus = [];
      for (var i = 0; i < begriffeStand.hinweise.length; i += 1) {
        var h = begriffeStand.hinweise[i];
        var kennung = begriffeKennung(h, begriffeStand.segmente[h.segment] || "");
        if (!begriffeVerworfen[kennung]) { raus.push(h); }
      }
      return raus;
    }

    function begriffeAusschnitt(segment, start, ende) {
      var von = Math.max(0, start - 32);
      var bis = Math.min(segment.length, ende + 32);
      return (von > 0 ? "…" : "") + segment.slice(von, start) + "[" + segment.slice(start, ende) + "]" +
        segment.slice(ende, bis) + (bis < segment.length ? "…" : "");
    }

    /**
     * Die Geltungsbereiche für die Auswahl. Erst auf Bedienung geholt (Auswahl angefasst oder
     * „Begriffe prüfen" geklickt) — das Panel ruft ohne Zutun des Nutzers nichts zusätzlich ab.
     */
    function begriffeBereicheLaden() {
      if (begriffeBereiche !== null || begriffeBereicheLaedt || !begriffeSichtbar()) { return; }
      begriffeBereicheLaedt = true;
      var sitzung = begriffeSitzung();
      var fertig = function (namen) {
        begriffeBereicheLaedt = false;
        if (sitzung !== begriffeSitzung()) { return; }
        begriffeBereiche = namen;
        begriffeBereicheSitzung = sitzung;
        begriffeZeichnen();
      };
      fetch("/api/begriffe", { credentials: "include" })
        .then(function (res) { return res && res.ok ? res.json() : null; })
        .then(function (koerper) {
          var liste = koerper && Array.isArray(koerper.begriffe) ? koerper.begriffe : [];
          var namen = [];
          for (var i = 0; i < liste.length; i += 1) {
            var b = liste[i] && typeof liste[i].geltungsbereich === "string" ? liste[i].geltungsbereich : "";
            if (b && namen.indexOf(b) === -1) { namen.push(b); }
          }
          namen.sort();
          fertig(namen);
        }, function () { fertig([]); });
    }

    function begriffeAuswahlZeichnen(auswahl) {
      var gewaehlt = auswahl.value;
      while (auswahl.firstChild) { auswahl.removeChild(auswahl.firstChild); }
      var alle = begriffeKnoten("option", "", begriffeT("alle"));
      alle.value = "";
      auswahl.appendChild(alle);
      var namen = begriffeBereiche || [];
      for (var i = 0; i < namen.length; i += 1) {
        var o = begriffeKnoten("option", "", namen[i]);
        o.value = namen[i];
        auswahl.appendChild(o);
      }
      auswahl.value = namen.indexOf(gewaehlt) === -1 ? "" : gewaehlt;
      auswahl.setAttribute("aria-label", begriffeT("bereich"));
    }

    function begriffeZeichnen() {
      var block = document.getElementById("begriffe-block");
      var knopf = document.getElementById("begriffe-btn");
      var auswahl = document.getElementById("begriffe-bereich");
      var grenze = document.getElementById("begriffe-grenze");
      var stand = document.getElementById("begriffe-stand");
      var liste = document.getElementById("begriffe-liste");
      if (!block || !knopf || !auswahl || !grenze || !stand || !liste) { return; }
      // Was eine andere oder keine Sitzung gefunden hat, sieht diese nie.
      if (begriffeStand && begriffeStand.sitzung !== begriffeSitzung()) {
        begriffeStand = null;
        begriffeVerworfen = {};
      }
      if (begriffeBereicheSitzung !== begriffeSitzung()) { begriffeBereiche = null; }
      block.className = begriffeSichtbar() ? "" : "hidden";
      knopf.textContent = begriffeT("cta");
      knopf.disabled = begriffeLage === "laden";
      grenze.textContent = begriffeT("grenze");
      begriffeAuswahlZeichnen(auswahl);
      var sichtbar = begriffeSichtbareHinweise();
      var zeilen = [];
      if (begriffeLage === "laden") { zeilen.push(begriffeT("laeuft")); }
      if (begriffeLage === "fehler") { zeilen.push(begriffeT("fehler") + (begriffeGrund ? " " + begriffeGrund : "")); }
      if (begriffeLage !== "laden" && begriffeStand) {
        zeilen.push(sichtbar.length === 0
          ? begriffeT("keine", { zeit: begriffeStand.zeit })
          : begriffeT("treffer", { n: sichtbar.length, zeit: begriffeStand.zeit }));
      }
      if (begriffeMeldung) { zeilen.push(begriffeMeldung); }
      stand.textContent = zeilen.join(" ");
      while (liste.firstChild) { liste.removeChild(liste.firstChild); }
      for (var i = 0; i < sichtbar.length; i += 1) {
        liste.appendChild(begriffeZeile(sichtbar[i]));
      }
    }

    function begriffeZeile(h) {
      var li = begriffeKnoten("li", "begriffe-hinweis");
      li.setAttribute("data-begriff", h.begriffId);
      // Je Aussage eine eigene Zeile (Blockelemente) — ohne eine Regel in `taskpane.css`.
      li.appendChild(begriffeKnoten("div", "begriffe-vorschlag", begriffeT("vorschlag", { gefunden: h.gefunden, vorzug: h.vorzug })));
      var segment = begriffeStand.segmente[h.segment] || "";
      li.appendChild(begriffeKnoten("div", "begriffe-stelle muted", begriffeAusschnitt(segment, h.start, h.ende)));
      if (h.definition) {
        li.appendChild(begriffeKnoten("div", "begriffe-definition muted", begriffeT("definition", { definition: h.definition })));
      }
      li.appendChild(begriffeKnoten("div", "begriffe-herkunft muted", begriffeT("herkunft", { bereich: h.geltungsbereich, version: h.begriffVersion })));
      if (h.mehrdeutig) {
        li.appendChild(begriffeKnoten("div", "begriffe-mehrdeutig muted", begriffeT("mehrdeutig")));
      }
      var annehmen = begriffeKnoten("button", "ghost begriffe-uebernehmen", begriffeT("uebernehmen"));
      annehmen.type = "button";
      annehmen.addEventListener("click", function () { begriffeUebernehmen(h); });
      var verwerfen = begriffeKnoten("button", "ghost begriffe-verwerfen", begriffeT("verwerfen"));
      verwerfen.type = "button";
      verwerfen.addEventListener("click", function () { begriffeVerwerfen(h); });
      li.appendChild(annehmen);
      li.appendChild(verwerfen);
      return li;
    }

    function begriffeVerwerfen(h) {
      if (!begriffeStand) { return; }
      begriffeVerworfen[begriffeKennung(h, begriffeStand.segmente[h.segment] || "")] = true;
      begriffeMeldung = "";
      begriffeZeichnen();
    }

    /** Die Absatztexte des ganzen Dokuments — frisch bei jedem Klick. `done(null)`: nichts lesbar. */
    function begriffeAbsaetzeLesen(done) {
      if (!begriffeOffice()) { done(null); return; }
      Word.run(function (context) {
        var absaetze = context.document.body.paragraphs;
        absaetze.load("items/text");
        return context.sync().then(function () {
          var texte = [];
          for (var i = 0; i < absaetze.items.length; i += 1) { texte.push(String(absaetze.items[i].text || "")); }
          done(texte);
        });
      }).catch(function () { done(null); });
    }

    function begriffePruefen() {
      if (begriffeLage === "laden") { return; }
      begriffeLauf += 1;
      var lauf = begriffeLauf;
      var sitzung = begriffeSitzung();
      var auswahl = document.getElementById("begriffe-bereich");
      var kontext = auswahl && auswahl.value ? auswahl.value : null;
      begriffeLage = "laden";
      begriffeGrund = "";
      begriffeMeldung = "";
      begriffeZeichnen();
      begriffeBereicheLaden();
      var abschluss = function (lage, grund) {
        if (lauf !== begriffeLauf) { return; }
        begriffeLage = lage;
        begriffeGrund = grund || "";
        begriffeZeichnen();
      };
      begriffeAbsaetzeLesen(function (segmente) {
        if (lauf !== begriffeLauf) { return; }
        if (!segmente) { abschluss("fehler", begriffeT("keinText")); return; }
        var zeichen = 0;
        for (var i = 0; i < segmente.length; i += 1) { zeichen += segmente[i].length; }
        if (segmente.length > BEGRIFFE_MAX_SEGMENTE || zeichen > BEGRIFFE_MAX_ZEICHEN) {
          abschluss("fehler", begriffeT("zuGross", { segmente: BEGRIFFE_MAX_SEGMENTE, zeichen: BEGRIFFE_MAX_ZEICHEN }));
          return;
        }
        fetch("/api/begriffe/pruefen", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ segmente: segmente, kontext: kontext })
        }).then(function (res) {
          if (!res || !res.ok) {
            var status = res && typeof res.status === "number" ? res.status : 0;
            if (status === 401 || status === 403) {
              begriffeStand = null;
              abschluss("fehler", begriffeT(status === 401 ? "anmeldung" : "recht"));
              if (status === 401 && typeof checkSession === "function") { checkSession(); }
              return null;
            }
            abschluss("fehler", "");
            return null;
          }
          return res.json().then(function (koerper) {
            if (lauf !== begriffeLauf) { return; }
            if (!koerper || !Array.isArray(koerper.hinweise)) { abschluss("fehler", ""); return; }
            begriffeStand = { segmente: segmente, hinweise: koerper.hinweise, zeit: begriffeZeit(), sitzung: sitzung };
            begriffeVerworfen = {};
            abschluss("ruhe", "");
          });
        }).catch(function () { abschluss("fehler", ""); });
      });
    }

    /**
     * Übernimmt GENAU die Stelle des Hinweises. Ersetzt wird nur, wenn der Absatz noch derselbe
     * Text ist und Words eigene Ganzwort-Suche dieselbe Zahl gleicher Stellen findet wie die
     * Prüfung — sonst bleibt das Dokument unberührt und die Fläche sagt warum.
     */
    function begriffeUebernehmen(h) {
      if (!begriffeStand || !begriffeOffice()) { return; }
      var stand = begriffeStand;
      var erwartet = stand.segmente[h.segment];
      var ergebnis = "schreibfehler";
      Word.run(function (context) {
        var absaetze = context.document.body.paragraphs;
        absaetze.load("items/text");
        return context.sync().then(function () {
          var absatz = absaetze.items[h.segment];
          if (!absatz || String(absatz.text || "") !== erwartet ||
              erwartet.slice(h.start, h.ende) !== h.gefunden) {
            ergebnis = "veraltet";
            return null;
          }
          var funde = absatz.search(h.gefunden, { matchCase: true, matchWholeWord: true });
          funde.load("items/text");
          return context.sync().then(function () {
            var ziel = funde.items[h.vorkommen];
            if (funde.items.length !== h.vorkommenGesamt || !ziel || ziel.text !== h.gefunden) {
              ergebnis = "uneindeutig";
              return null;
            }
            ziel.insertText(h.vorzug, "Replace");
            return context.sync().then(function () { ergebnis = "uebernommen"; });
          });
        });
      }).then(function () {
        begriffeNachUebernahme(stand, h, ergebnis);
      }, function () {
        begriffeNachUebernahme(stand, h, "schreibfehler");
      });
    }

    function begriffeNachUebernahme(stand, h, ergebnis) {
      if (begriffeStand !== stand) { return; }
      if (ergebnis === "uebernommen") {
        // Der Absatz trägt jetzt den neuen Text; Hinweise DESSELBEN Absatzes zeigen auf verschobene
        // Stellen und fallen weg, bis neu geprüft wird. Alle anderen Absätze sind unverändert.
        var alt = stand.segmente[h.segment];
        stand.segmente[h.segment] = alt.slice(0, h.start) + h.vorzug + alt.slice(h.ende);
        var bleibt = [];
        for (var i = 0; i < stand.hinweise.length; i += 1) {
          if (stand.hinweise[i].segment !== h.segment) { bleibt.push(stand.hinweise[i]); }
        }
        stand.hinweise = bleibt;
        begriffeMeldung = begriffeT("uebernommen", { vorzug: h.vorzug });
      } else {
        begriffeMeldung = begriffeT(ergebnis);
      }
      begriffeZeichnen();
    }

    function begriffeAnschliessen() {
      if (!document.getElementById("begriffe-block")) { return; }
      document.getElementById("begriffe-btn").addEventListener("click", begriffePruefen);
      document.getElementById("begriffe-bereich").addEventListener("focus", begriffeBereicheLaden);
      document.getElementById("begriffe-bereich").addEventListener("mousedown", begriffeBereicheLaden);
      // Jede Lage, in der das Fenster den Bestandsblock neu zeichnet (Sitzung, Office-Erkennung,
      // Flächenwechsel), gilt auch für diesen Block — derselbe Anschluss wie KW-WORDVERGLEICH.
      if (typeof bestandZeichnen === "function") {
        var begriffeBestandZeichnen = bestandZeichnen;
        bestandZeichnen = function () {
          begriffeBestandZeichnen.apply(this, arguments);
          begriffeZeichnen();
        };
      }
      if (typeof setLang === "function") {
        var begriffeSetLang = setLang;
        setLang = function () {
          begriffeSetLang.apply(this, arguments);
          begriffeZeichnen();
        };
      }
      begriffeZeichnen();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", begriffeAnschliessen);
    } else {
      begriffeAnschliessen();
    }
    // KW-BEGRIFFE-END

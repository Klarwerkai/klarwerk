// ================================================================================================
// KLARA · VORMACHEN IN WORD — DER BLOCK KW-VORMACHEN (Lernanzeige mit sofortiger Pause), EIGENE DATEI.
// ================================================================================================
//
// WOZU (produkt:20261011:peter-p06, P06-AC02): Läuft für das angemeldete Konto eine Lernsitzung im
// Host Word, steht im Klara-Panel SICHTBAR, dass mitgeschrieben wird (oder dass pausiert ist), mit
// einem Knopf, der SOFORT pausiert bzw. fortsetzt. Nur solange dieses Panel den Zustand anzeigt,
// schreibt der Server Word-Arbeitswege mit: die Anzeige meldet sich alle 20 s
// (`GET /api/me/vormachen?anzeige=word`); der Server bindet die Meldung an genau diese
// Anmeldesitzung und lässt sie 60 s gelten. Ist das Panel zu oder verborgen, meldet es nichts —
// dann wird in Word nichts gespeichert, nur „nicht sichtbar" gezählt.
//
// WARUM EINE EIGENE DATEI: dieselbe Bauform wie `begriffe.js` und `anleitung.js` — klassisches
// Skript, ES5 wie das Fenster, auf der Ignorierliste von Biome, im KOPF von `taskpane.html`, und es
// schliesst sich erst bei `DOMContentLoaded` an. `taskpane.js` bleibt unberührt (bewachte Grösse).
// Es liest nur die Globalen `lang` und `signedIn`; fehlen sie, bleibt die Anzeige verborgen.
//
// DATENFLUSS (ausgewiesen): zwei Abrufe derselben Klarwerk-Instanz (gleicher Ursprung, Sitzung des
// Fensters): `GET /api/me/vormachen?anzeige=word` (eigene Übersicht, zugleich Sichtbarkeitsmeldung)
// und `PUT /api/me/vormachen/:id/zustand` (Pause/Fortsetzen, nur auf Klick). Der Block KW-VORMACHEN
// liest aus dem Dokument NICHTS; mitgeschrieben werden ausschließlich die vorhandenen Serverwege des
// Panels. Der zweite Block KW-ROUTINEN (BPA-06, Nacharbeit 41) liest die Markierung nur auf Klick
// „Mit Markierung ausführen"/„An dieses Word binden" — sein Datenfluss steht an ihm.
// ================================================================================================
"use strict";

    // KW-VORMACHEN-START
    var VORMACHEN_TEXTE = {
      de: {
        region: "Mitschreiben deiner Assistenz",
        lernt: "Lernt mit – {n} Schritte mitgeschrieben",
        pausiert: "Pausiert – es wird nichts mitgeschrieben",
        pause: "Pause",
        fortsetzen: "Fortsetzen",
        fehler: "Pause nicht möglich – bitte erneut versuchen."
      },
      en: {
        region: "Your assistant is noting",
        lernt: "Learning – {n} steps noted",
        pausiert: "Paused – nothing is being noted",
        pause: "Pause",
        fortsetzen: "Resume",
        fehler: "Could not pause – please try again."
      },
      nl: {
        region: "Je assistent noteert",
        lernt: "Leert mee – {n} stappen genoteerd",
        pausiert: "Gepauzeerd – er wordt niets genoteerd",
        pause: "Pauze",
        fortsetzen: "Hervatten",
        fehler: "Pauzeren niet mogelijk – probeer het opnieuw."
      }
    };

    /** Abstand der Sichtbarkeitsmeldungen während einer offenen Word-Sitzung (Gültigkeit am Server: 60 s). */
    var VORMACHEN_PULS_MS = 20000;
    /** Ohne offene Word-Sitzung wird seltener nachgesehen, ob eine begonnen wurde. */
    var VORMACHEN_RUHE_MS = 60000;
    /**
     * Der erste Blick erst kurz nach dem Laden: dann hat das Fenster seine Anmeldung geklärt, und
     * der Block fragt nicht zu einem Zeitpunkt, der vom Ladeweg (inline oder eigene Datei) abhängt.
     */
    var VORMACHEN_START_MS = 2000;

    var vormachenSitzung = null;
    var vormachenLaeuft = false;
    var vormachenTakt = null;
    var vormachenFehler = false;

    function vormachenText(schluessel, n) {
      var tabelle = VORMACHEN_TEXTE[typeof lang === "string" && VORMACHEN_TEXTE[lang] ? lang : "de"];
      return String(tabelle[schluessel]).replace("{n}", String(n === undefined ? "" : n));
    }

    function vormachenAngemeldet() {
      return typeof signedIn !== "undefined" && Boolean(signedIn);
    }

    /** Die Anzeige — einmal angelegt, danach nur gezeigt, verborgen und beschriftet. */
    function vormachenElement() {
      var el = document.getElementById("kw-vormachen");
      if (el) { return el; }
      el = document.createElement("section");
      el.id = "kw-vormachen";
      el.className = "hidden";
      el.setAttribute("data-testid", "vormachen-word-anzeige");
      el.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:50;display:flex;"
        + "align-items:center;gap:8px;padding:6px 10px;border:1px solid #d0d4d8;border-radius:8px;"
        + "background:#fff;font-size:12px;";
      var zeile = document.createElement("output");
      zeile.id = "kw-vormachen-zustand";
      zeile.setAttribute("aria-live", "polite");
      zeile.style.flex = "1";
      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.id = "kw-vormachen-pause";
      knopf.className = "ghost";
      knopf.addEventListener("click", vormachenUmschalten);
      el.appendChild(zeile);
      el.appendChild(knopf);
      document.body.appendChild(el);
      return el;
    }

    function vormachenZeichnen() {
      var el = vormachenElement();
      var s = vormachenSitzung;
      if (!s || s.host !== "word" || s.zustand === "abgebrochen") {
        el.className = "hidden";
        el.style.display = "none";
        return;
      }
      var pausiert = s.zustand === "pausiert";
      el.className = "";
      el.style.display = "flex";
      el.setAttribute("aria-label", vormachenText("region"));
      el.setAttribute("data-zustand", s.zustand);
      var zeile = document.getElementById("kw-vormachen-zustand");
      zeile.textContent = vormachenFehler
        ? vormachenText("fehler")
        : (pausiert ? vormachenText("pausiert") : vormachenText("lernt", s.beobachtet));
      var knopf = document.getElementById("kw-vormachen-pause");
      knopf.textContent = pausiert ? vormachenText("fortsetzen") : vormachenText("pause");
      knopf.disabled = vormachenLaeuft;
    }

    function vormachenPlanen() {
      if (vormachenTakt !== null) { clearTimeout(vormachenTakt); }
      var offen = vormachenSitzung && vormachenSitzung.host === "word";
      vormachenTakt = setTimeout(vormachenLesen, offen ? VORMACHEN_PULS_MS : VORMACHEN_RUHE_MS);
    }

    /**
     * Liest die eigene Übersicht. Nur wenn das Panel gerade sichtbar ist, meldet der Abruf zugleich
     * die Sichtbarkeit (`?anzeige=word`) — ein verborgenes Panel behauptet nichts.
     */
    function vormachenLesen() {
      if (!vormachenAngemeldet() || typeof fetch !== "function") {
        vormachenSitzung = null;
        vormachenZeichnen();
        vormachenPlanen();
        return Promise.resolve();
      }
      var sichtbar = typeof document.hidden !== "boolean" || !document.hidden;
      var pfad = sichtbar ? "/api/me/vormachen?anzeige=word" : "/api/me/vormachen";
      return fetch(pfad, { credentials: "include" })
        .then(function (res) {
          if (!res.ok) { throw new Error("HTTP " + res.status); }
          return res.json();
        })
        .then(function (body) {
          var liste = body && Array.isArray(body.sitzungen) ? body.sitzungen : [];
          vormachenSitzung = null;
          for (var i = 0; i < liste.length; i += 1) {
            if (liste[i] && liste[i].zustand !== "abgebrochen") { vormachenSitzung = liste[i]; }
          }
        })
        .catch(function () {
          // Nicht erreichbar: die Anzeige bleibt beim zuletzt bestätigten Stand.
        })
        .then(function () {
          vormachenZeichnen();
          vormachenPlanen();
        });
    }

    /** Pause wirkt sofort am Server; angezeigt wird danach der Stand, den der Server bestätigt. */
    function vormachenUmschalten() {
      var s = vormachenSitzung;
      if (!s || vormachenLaeuft) { return Promise.resolve(); }
      vormachenLaeuft = true;
      vormachenFehler = false;
      vormachenZeichnen();
      var ziel = s.zustand === "pausiert" ? "lernt" : "pausiert";
      return fetch("/api/me/vormachen/" + encodeURIComponent(s.id) + "/zustand", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ zustand: ziel })
      })
        .then(function (res) {
          if (!res.ok) { throw new Error("HTTP " + res.status); }
          return res.json();
        })
        .then(function (body) {
          if (body && body.sitzung) { vormachenSitzung = body.sitzung; }
        })
        .catch(function () {
          vormachenFehler = true;
        })
        .then(function () {
          vormachenLaeuft = false;
          vormachenZeichnen();
          return vormachenLesen();
        });
    }

    function vormachenAnschliessen() {
      vormachenElement();
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) { vormachenLesen(); }
      });
      vormachenTakt = setTimeout(vormachenLesen, VORMACHEN_START_MS);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", vormachenAnschliessen);
    } else {
      vormachenAnschliessen();
    }
    // KW-VORMACHEN-ENDE

    // KW-ROUTINEN-START
    // produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 Nacharbeit 41 — MEINE ROUTINEN IN
    // WORD. Eine in Word vorgemachte, bestätigte Routine wird hier ausdrücklich an DIESES Word
    // gebunden (Programm und Hostfassung) und mit der AKTUELLEN Markierung ausgeführt — auch ein
    // anstehender Termin der vorhandenen Zeitsteuerung. Wirkung: ein Entwurf in Klarwerk; im
    // Word-Dokument ändert der Lauf nichts.
    // DATENFLUSS (ausgewiesen), nur mit Klara-Sitzung des Fensters, gleicher Ursprung:
    //   GET  /api/me/vormachen/word-routinen        eigene Word-Routinen (Titel, Zustand, Termin)
    //   POST /api/klara/programme/verbinden          gesiegelte Bindung (BPA-04) an Sitzung,
    //                                                Dokument und Prüfsumme der Markierung
    //   PUT  /api/me/vormachen/routinen/:id/host     nur auf Klick „An dieses Word binden", samt der
    //                                                ausdrücklichen Wahl „Fällige Termine … ohne Klick"
    //   POST /api/me/vormachen/routinen/:id/word-lauf auf Klick ODER (Nacharbeit 43) für einen
    //                                                fälligen Termin ohne Klick, wenn genau diese Wahl
    //                                                getroffen ist und dies das gebundene Dokument ist.
    //                                                Der bestätigte Umfang (Markierung und/oder ganzes
    //                                                Dokument) wird UNMITTELBAR davor neu gelesen und
    //                                                mitgeschickt — der Server prüft ihn gegen die
    //                                                Bindung (anderes Dokument/Inhalt: nichts).
    // Gelesen wird die Markierung über `readAskSelection`, das ganze Dokument über `Word.run`
    // (`body.text`) — beides nur mit der Fenstereinstellung „Mitlesen"; ist sie aus, nichts.
    var ROUTINEN_TEXTE = {
      de: {
        titel: "Meine Funktionen in Word",
        ungebunden: "Noch an kein Word gebunden.",
        gebunden: "Gebunden an {fassung}.",
        binden: "An dieses Word binden",
        pausiert: "Pausiert – läuft nicht.",
        eingabe: "Titel des Berichts",
        ausfuehren: "Mit Markierung ausführen",
        termin: "Ein Termin steht an.",
        terminAusfuehren: "Termin jetzt mit Markierung ausführen",
        laeuft: "Läuft …",
        ohneMarkierung: "Bitte zuerst den Text in Word markieren.",
        ohneFassung: "Die Word-Fassung ist nicht lesbar – binden nicht möglich.",
        ohneTitel: "Bitte einen Titel eingeben.",
        gebundenOk: "Gebunden.",
        fertig: "Bericht angelegt und geprüft.",
        oeffnen: "In Klarwerk öffnen",
        abweichung: "Bericht angelegt, die Prüfung fand Abweichungen.",
        offen: "Noch nicht abgeschlossen – bitte erneut ausführen.",
        fehler: "Nicht möglich – bitte erneut versuchen.",
        ausfuehrenDokument: "Mit dem ganzen Dokument ausführen",
        ohneDokument: "Das ganze Dokument ist nicht lesbar (Mitlesen aus oder kein Word-Zugriff). Die Routine läuft nicht – die Markierung ersetzt das Dokument nicht.",
        freigabe: "Fällige Termine in diesem Dokument ohne Klick ausführen",
        automatisch: "Ein fälliger Termin wird jetzt ohne Klick ausgeführt …"
      },
      en: {
        titel: "My functions in Word",
        ungebunden: "Not bound to any Word yet.",
        gebunden: "Bound to {fassung}.",
        binden: "Bind to this Word",
        pausiert: "Paused – does not run.",
        eingabe: "Report title",
        ausfuehren: "Run with selection",
        termin: "A scheduled run is due.",
        terminAusfuehren: "Run the scheduled run with the selection now",
        laeuft: "Running …",
        ohneMarkierung: "Please select the text in Word first.",
        ohneFassung: "The Word version cannot be read – binding is not possible.",
        ohneTitel: "Please enter a title.",
        gebundenOk: "Bound.",
        fertig: "Report created and checked.",
        oeffnen: "Open in Klarwerk",
        abweichung: "Report created, the check found differences.",
        offen: "Not finished yet – please run again.",
        fehler: "Not possible – please try again.",
        ausfuehrenDokument: "Run with the whole document",
        ohneDokument: "The whole document cannot be read (reading is off or Word is not reachable). The routine does not run – the selection does not replace the document.",
        freigabe: "Run due scheduled runs in this document without a click",
        automatisch: "A due scheduled run is now running without a click …"
      },
      nl: {
        titel: "Mijn functies in Word",
        ungebunden: "Nog aan geen Word gekoppeld.",
        gebunden: "Gekoppeld aan {fassung}.",
        binden: "Aan deze Word koppelen",
        pausiert: "Gepauzeerd – loopt niet.",
        eingabe: "Titel van het verslag",
        ausfuehren: "Met selectie uitvoeren",
        termin: "Er staat een geplande uitvoering klaar.",
        terminAusfuehren: "Geplande uitvoering nu met selectie uitvoeren",
        laeuft: "Bezig …",
        ohneMarkierung: "Selecteer eerst de tekst in Word.",
        ohneFassung: "De Word-versie is niet leesbaar – koppelen niet mogelijk.",
        ohneTitel: "Voer een titel in.",
        gebundenOk: "Gekoppeld.",
        fertig: "Verslag aangemaakt en gecontroleerd.",
        oeffnen: "In Klarwerk openen",
        abweichung: "Verslag aangemaakt, de controle vond afwijkingen.",
        offen: "Nog niet afgerond – voer opnieuw uit.",
        fehler: "Niet mogelijk – probeer het opnieuw.",
        ausfuehrenDokument: "Met het hele document uitvoeren",
        ohneDokument: "Het hele document is niet leesbaar (meelezen uit of geen toegang tot Word). De routine loopt niet – de selectie vervangt het document niet.",
        freigabe: "Geplande uitvoeringen in dit document zonder klik uitvoeren",
        automatisch: "Een geplande uitvoering loopt nu zonder klik …"
      }
    };

    var routinenListe = [];
    /** Je Routine die Laufkennung eines noch nicht abgeschlossenen Laufs — ein erneuter Klick setzt ihn fort. */
    var routinenOffen = {};
    var routinenMeldungen = {};
    var routinenBeschaeftigt = false;

    function routinenText(schluessel, fassung) {
      var tabelle = ROUTINEN_TEXTE[typeof lang === "string" && ROUTINEN_TEXTE[lang] ? lang : "de"];
      return String(tabelle[schluessel]).replace("{fassung}", String(fassung || ""));
    }

    /** Nur mit Anmeldung UND Klara-Sitzung des Fensters — sonst fragt dieser Block nichts. */
    function routinenBereit() {
      return vormachenAngemeldet()
        && typeof klaraS4SessionId === "string" && klaraS4SessionId !== ""
        && typeof bpaZielAus === "function" && typeof bpaPruefsumme === "function"
        && typeof readAskSelection === "function";
    }

    function routinenAbruf(pfad, methode, koerper) {
      var init = { method: methode, credentials: "include", headers: {} };
      if (koerper !== undefined) {
        init.headers["content-type"] = "application/json";
        init.body = JSON.stringify(koerper);
      }
      return fetch(pfad, init).then(function (res) {
        var fertig = function (body) {
          return { ok: res.ok, status: res.status, body: body && typeof body === "object" ? body : {} };
        };
        return res.json().then(fertig, function () { return fertig({}); });
      });
    }

    function routinenHostfassung() {
      try {
        var d = Office.context.diagnostics;
        return d ? String((d.platform || "") + " " + (d.version || "")).trim() : "";
      } catch (e) {
        return "";
      }
    }

    /** Die aktuelle Markierung über den Leseweg des Fensters (Word zuerst, sonst Office). */
    function routinenMarkierung(weiter, fehler) {
      readAskSelection(function (text) {
        weiter(String(text || "").replace(/\r\n?/g, "\n").replace(/^\s+|\s+$/g, ""));
      }, true, fehler);
    }

    function routinenElement() {
      var el = document.getElementById("kw-routinen");
      if (el) { return el; }
      el = document.createElement("section");
      el.id = "kw-routinen";
      el.setAttribute("data-testid", "word-routinen");
      el.style.display = "none";
      el.style.cssText += "margin:8px;padding:8px;border:1px solid #d0d4d8;border-radius:8px;font-size:12px;";
      document.body.appendChild(el);
      return el;
    }

    function routinenKnopf(text, aktion) {
      var k = document.createElement("button");
      k.type = "button";
      k.className = "ghost";
      k.textContent = text;
      k.disabled = routinenBeschaeftigt;
      k.addEventListener("click", aktion);
      return k;
    }

    function routinenZeichnen() {
      var el = routinenElement();
      while (el.firstChild) { el.removeChild(el.firstChild); }
      if (!routinenBereit() || routinenListe.length === 0) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.setAttribute("aria-label", routinenText("titel"));
      var kopf = document.createElement("h3");
      kopf.textContent = routinenText("titel");
      el.appendChild(kopf);
      routinenListe.forEach(function (r) {
        var eintrag = document.createElement("div");
        eintrag.setAttribute("data-routine", r.id);
        var name = document.createElement("strong");
        name.textContent = r.titel;
        eintrag.appendChild(name);
        var zeile = document.createElement("p");
        zeile.textContent = r.hostbindung
          ? routinenText("gebunden", r.hostbindung.hostVersion)
          : routinenText("ungebunden");
        eintrag.appendChild(zeile);
        // Nacharbeit 43: die ausdrückliche Freigabe, fällige Termine hier ohne Klick laufen zu lassen.
        var freigabe = document.createElement("input");
        freigabe.type = "checkbox";
        freigabe.setAttribute("data-feld", "zeitplan-im-host");
        freigabe.checked = Boolean(r.hostbindung && r.hostbindung.zeitplanImHost);
        var freigabeLabel = document.createElement("label");
        freigabeLabel.appendChild(freigabe);
        freigabeLabel.appendChild(document.createTextNode(" " + routinenText("freigabe")));
        eintrag.appendChild(freigabeLabel);
        eintrag.appendChild(routinenKnopf(routinenText("binden"), function () {
          routinenBinden(r, freigabe.checked);
        }));
        if (r.zustand === "pausiert") {
          var p = document.createElement("p");
          p.textContent = routinenText("pausiert");
          eintrag.appendChild(p);
        } else if (r.hostbindung) {
          var label = document.createElement("label");
          label.textContent = routinenText("eingabe") + " ";
          var feld = document.createElement("input");
          feld.type = "text";
          feld.setAttribute("data-feld", "titel");
          label.appendChild(feld);
          eintrag.appendChild(label);
          var nurDokument = routinenBraucht(r, "dokument") && !routinenBraucht(r, "markierung");
          eintrag.appendChild(routinenKnopf(routinenText(nurDokument ? "ausfuehrenDokument" : "ausfuehren"), function () {
            if (!feld.value.trim()) { routinenMelden(r.id, routinenText("ohneTitel")); return; }
            routinenAusfuehren(r, routinenOffen[r.id] || routinenNeueKennung(), { titel: feld.value.trim() });
          }));
          if (r.anstehend) {
            var t = document.createElement("p");
            t.textContent = routinenText("termin");
            eintrag.appendChild(t);
            eintrag.appendChild(routinenKnopf(routinenText("terminAusfuehren"), function () {
              routinenAusfuehren(r, r.anstehend, {});
            }));
          }
        }
        var meldung = document.createElement("output");
        meldung.setAttribute("aria-live", "polite");
        meldung.setAttribute("data-meldung", r.id);
        var m = routinenMeldungen[r.id];
        if (m) {
          meldung.textContent = m.text;
          if (m.pfad) {
            var link = document.createElement("a");
            link.href = m.pfad;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = " " + routinenText("oeffnen");
            meldung.appendChild(link);
          }
        }
        eintrag.appendChild(meldung);
        el.appendChild(eintrag);
      });
    }

    function routinenMelden(id, text, pfad) {
      routinenMeldungen[id] = { text: text, pfad: pfad || null };
      routinenZeichnen();
    }

    function routinenNeueKennung() {
      return "word-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    }

    function routinenLesen() {
      if (!routinenBereit() || typeof fetch !== "function") {
        routinenListe = [];
        routinenZeichnen();
        return Promise.resolve();
      }
      return routinenAbruf("/api/me/vormachen/word-routinen", "GET")
        .then(function (a) {
          if (a.ok && Array.isArray(a.body.routinen)) { routinenListe = a.body.routinen; }
        }, function () {
          // Nicht erreichbar: die Liste bleibt beim zuletzt bestätigten Stand.
        })
        .then(function () {
          routinenZeichnen();
          routinenAutomatisch();
        });
    }

    /** Fehlertext des Servers (verständlicher Satz) oder der allgemeine Hinweis. */
    function routinenFehlertext(a) {
      var e = a && a.body ? (a.body.ergebnis || a.body) : {};
      return (e && (e.text || e.message)) || routinenText("fehler");
    }

    function routinenSchritt(id, arbeit) {
      if (routinenBeschaeftigt) { return; }
      routinenBeschaeftigt = true;
      routinenMelden(id, routinenText("laeuft"));
      var ende = function () {
        routinenBeschaeftigt = false;
        routinenLesen();
      };
      try {
        arbeit(ende);
      } catch (e) {
        routinenMelden(id, routinenText("fehler"));
        ende();
      }
    }

    function routinenBraucht(r, umfang) {
      return Array.isArray(r.umfaenge) && r.umfaenge.indexOf(umfang) >= 0;
    }

    /**
     * Nacharbeit 43: das GANZE Dokument über Word.run (`body.text`) — getrennt von der Markierung.
     * Mit ausgeschaltetem „Mitlesen" oder ohne Word-Zugriff: `null`; dann läuft eine
     * Dokumentroutine nicht (es wird nie still die Markierung genommen).
     */
    function routinenDokument(weiter, fehler) {
      var mitlesen = typeof askMitlesen === "undefined" || Boolean(askMitlesen);
      if (!mitlesen || !window.Word || typeof Word.run !== "function") { weiter(null); return; }
      try {
        Word.run(function (context) {
          var koerper = context.document.body;
          koerper.load("text");
          return context.sync().then(function () { return koerper.text; });
        }).then(function (text) {
          weiter(String(text || "").replace(/\r\n?/g, "\n").replace(/^\s+|\s+$/g, ""));
        }, fehler);
      } catch (e) {
        fehler(e);
      }
    }

    /**
     * Liest genau den bestätigten Umfang der Routine aus dem AKTUELLEN Host und bildet daraus das
     * Ziel: `auswahl` = Prüfsumme der Markierung (ohne Markierungsumfang leer), `fassung` = Prüfsumme
     * des Dokuments (ohne Dokumentumfang leer). `weiter({ ziel, markierung, dokument })` oder
     * `weiter(null, Grund)`.
     */
    function routinenUmfangLesen(r, weiter, fehler) {
      var braucheMarkierung = routinenBraucht(r, "markierung");
      var braucheDokument = routinenBraucht(r, "dokument");
      var mitDokument = function (markierung) {
        var fertig = function (dokument) {
          if (braucheDokument && dokument === null) { weiter(null, "ohneDokument"); return; }
          var ziel = bpaZielAus(klaraS4SessionId, klaraS4DocumentId, markierung || "");
          if (!braucheMarkierung) { ziel.auswahl = ""; }
          ziel.fassung = braucheDokument ? bpaPruefsumme(dokument) : "";
          weiter({
            ziel: ziel,
            markierung: braucheMarkierung ? markierung : undefined,
            dokument: braucheDokument ? dokument : undefined
          });
        };
        if (braucheDokument) { routinenDokument(fertig, fehler); } else { fertig(null); }
      };
      if (braucheMarkierung) { routinenMarkierung(mitDokument, fehler); } else { mitDokument(""); }
    }

    /**
     * Ausdrücklich: diese Routine an DIESES Word (Programm, Hostfassung, Dokument) binden — samt der
     * ausdrücklichen Wahl, ob fällige Termine hier ohne Klick laufen dürfen.
     */
    function routinenBinden(r, zeitplanImHost) {
      routinenSchritt(r.id, function (ende) {
        var hostVersion = routinenHostfassung();
        if (!hostVersion) { routinenMelden(r.id, routinenText("ohneFassung")); ende(); return; }
        routinenUmfangLesen(r, function (gelesen, grund) {
          if (!gelesen) { routinenMelden(r.id, routinenText(grund)); ende(); return; }
          routinenAbruf("/api/klara/programme/verbinden", "POST", { ziel: gelesen.ziel })
            .then(function (v) {
              if (!v.ok) { return v; }
              return routinenAbruf("/api/me/vormachen/routinen/" + encodeURIComponent(r.id) + "/host", "PUT", {
                bindung: v.body.bindung,
                aktuell: gelesen.ziel,
                hostVersion: hostVersion,
                zeitplanImHost: zeitplanImHost === true
              });
            })
            .then(function (a) {
              routinenMelden(r.id, a.ok ? routinenText("gebundenOk") : routinenFehlertext(a));
            }, function () { routinenMelden(r.id, routinenText("fehler")); })
            .then(ende);
        }, function () { routinenMelden(r.id, routinenText("fehler")); ende(); });
      });
    }

    /**
     * Je Routine UND Terminkennung: in diesem Fenster schon ohne Klick versucht (nicht endlos
     * wiederholen). Nacharbeit 46: die Kennung allein reicht nicht — Wochentermine verschiedener
     * Routinen heißen gleich (`zeitplan-w-<Datum>`); sonst liefe die zweite nicht mehr.
     */
    var routinenAutoVersucht = {};

    function routinenVersuchSchluessel(r, kennung) {
      return String(r.id) + "|" + String(kennung);
    }

    /**
     * Ein Lauf mit dem bestätigten Umfang: lesen und binden (gesiegelt), UNMITTELBAR vor der Wirkung
     * erneut lesen und damit laufen lassen. Der Server prüft beides gegeneinander; nichts wird
     * geraten. `automatisch`: ein fälliger Termin, den dieses Fenster ohne Klick abholt.
     */
    function routinenAusfuehren(r, kennung, eingaben, automatisch) {
      routinenSchritt(r.id, function (ende) {
        var hostVersion = routinenHostfassung();
        var nochmal = function () {
          if (automatisch) { delete routinenAutoVersucht[routinenVersuchSchluessel(r, kennung)]; }
        };
        routinenUmfangLesen(r, function (gewaehlt, grund) {
          if (!gewaehlt) { nochmal(); routinenMelden(r.id, routinenText(grund)); ende(); return; }
          if (routinenBraucht(r, "markierung") && !gewaehlt.markierung) {
            nochmal();
            routinenMelden(r.id, routinenText("ohneMarkierung"));
            ende();
            return;
          }
          routinenAbruf("/api/klara/programme/verbinden", "POST", { ziel: gewaehlt.ziel })
            .then(function (v) {
              if (!v.ok) { return v; }
              return new Promise(function (weiter, scheitern) {
                routinenUmfangLesen(r, function (jetzt, grundJetzt) {
                  if (!jetzt) { weiter({ ok: false, status: 409, body: { message: routinenText(grundJetzt) } }); return; }
                  if (r.id && kennung.indexOf("zeitplan-") !== 0) { routinenOffen[r.id] = kennung; }
                  var host = { bindung: v.body.bindung, aktuell: jetzt.ziel, hostVersion: hostVersion };
                  if (jetzt.markierung !== undefined) { host.markierung = jetzt.markierung; }
                  if (jetzt.dokument !== undefined) { host.dokument = jetzt.dokument; }
                  routinenAbruf("/api/me/vormachen/routinen/" + encodeURIComponent(r.id) + "/word-lauf", "POST", {
                    lauf: kennung,
                    fassung: r.fassung,
                    eingaben: eingaben,
                    automatisch: automatisch === true,
                    host: host
                  }).then(weiter, scheitern);
                }, scheitern);
              });
            })
            .then(function (a) {
              var e = a.body && a.body.ergebnis ? a.body.ergebnis : null;
              var offen = a.status === 202 || a.status === 503;
              if (!offen) { delete routinenOffen[r.id]; } else { nochmal(); }
              if (a.status === 201) {
                routinenMelden(r.id, routinenText("fertig"), a.body.pfad);
              } else if (a.status === 200 && e && e.stand === "abweichung") {
                routinenMelden(r.id, routinenText("abweichung"), a.body.pfad);
              } else if (offen) {
                routinenMelden(r.id, routinenText("offen"));
              } else {
                routinenMelden(r.id, routinenFehlertext(a));
              }
            }, function () { nochmal(); routinenMelden(r.id, routinenText("offen")); })
            .then(ende);
        }, function () { nochmal(); routinenMelden(r.id, routinenText("fehler")); ende(); });
      });
    }

    /**
     * Nacharbeit 43: die Übergabe der Zeitsteuerung. Ein fälliger Termin mit `uebergabe:
     * "automatisch"` (ausdrücklich beim Binden freigegeben) läuft ohne Klick — aber nur in GENAU dem
     * gebundenen Programm und Dokument; der Server prüft das noch einmal. Je Routine und Termin ein
     * Versuch je Fenster, ein offener (vorübergehender) wird beim nächsten Abruf wieder aufgenommen.
     * Sind mehrere Routinen zugleich fällig, laufen sie nacheinander: nach dem Ende eines Laufs liest
     * das Fenster die Liste neu und holt den nächsten ab.
     */
    function routinenAutomatisch() {
      if (routinenBeschaeftigt || !routinenBereit()) { return; }
      var programm = typeof bpaProgramm === "function" ? bpaProgramm() : null;
      for (var i = 0; i < routinenListe.length; i += 1) {
        var r = routinenListe[i];
        var hb = r && r.hostbindung;
        var schluessel = r && r.anstehend ? routinenVersuchSchluessel(r, r.anstehend) : "";
        if (
          r && r.uebergabe === "automatisch" && r.anstehend && r.zustand !== "pausiert" && hb &&
          hb.zeitplanImHost && hb.objekt === klaraS4DocumentId &&
          (programm === null || hb.programm === programm) && !routinenAutoVersucht[schluessel]
        ) {
          routinenAutoVersucht[schluessel] = true;
          routinenMelden(r.id, routinenText("automatisch"));
          routinenAusfuehren(r, r.anstehend, {}, true);
          return;
        }
      }
    }

    function routinenAnschliessen() {
      routinenElement();
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) { routinenLesen(); }
      });
      var takt = function () {
        routinenLesen();
        setTimeout(takt, VORMACHEN_RUHE_MS);
      };
      setTimeout(takt, VORMACHEN_START_MS);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", routinenAnschliessen);
    } else {
      routinenAnschliessen();
    }
    // KW-ROUTINEN-ENDE

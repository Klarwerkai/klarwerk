// ================================================================================================
// KLARA IN POWERPOINT · HERKUNFT AN DER ZAHL (PP-02 · produkt:20261015:klara-powerpoint-datenherkunft)
// ================================================================================================
//
// WAS DIESE DATEI TUT — und nur das, im vorhandenen Fenster aus A01 (aufnahme:20260922:excel-erster-weg):
//   1. Die geöffnete Präsentation mit EINEM PowerPoint-Anhang eines KLARWERK-Artikels verbinden: der
//      Mensch nennt den Artikel (Link oder Kennung) und wählt den Anhang. Nichts wird geraten.
//   2. Abgleichen: Office liefert die geöffnete Datei (`getFileAsync`, Compressed = .pptx); der
//      Server liest sie mit DEMSELBEN Leser wie den Anhang und nennt ihre echten `p:sldId` und
//      `p:cNvPr/@id` sowie den Befund jeder Bindung in dieser Datei. Die Office-Kennungen von Folie
//      und Form werden dabei nicht gedeutet (ihr Format ist nicht dokumentiert): eine Folie wird über
//      ihre Stelle in der Datei zugeordnet — nennt die Office-Kennung („<Zahl>#…“) die p:sldId einer
//      ANDEREN Folie der Datei, sind die Folien vertauscht und es wird nichts zugeordnet; ist die Zahl
//      unbekannt oder das Format ein anderes, gilt die Stelle —, eine Form über Kennung UND Name, sonst
//      über einen Namen, der auf der Folie in PowerPoint UND in der Datei eindeutig ist. Welche Regel
//      griff, steht im Fenster.
//   3. An der markierten Form die gebundenen Zahlen mit Erfassungsart und Prüfstand zeigen; ein Klick
//      öffnet die Herkunft: Quelle mit Fassung, Fundstelle, Rechenweg mit allen verwendeten Eingaben
//      (jede Eingabe öffnet ihre eigene Herkunft), Annahmen, Prüfungen, Befund in dieser Datei.
//
// Diese Datei SCHREIBT NICHT ins Dokument, legt keine Form an und speichert nichts. Sie benutzt die
// Anmeldung und den Abrufweg des Fensters (`klaraOfficeFenster.abruf`) — kein zweiter Login.
// ================================================================================================
(function () {
  "use strict";

  var SCHEIBE = 4194304;
  var GRENZE_BYTES = 30 * 1024 * 1024;
  // Prüfbefund B5 (18.10.2026): der Abgleich schickt bis zu 40 MiB Base64 — die 20-s-Frist des
  // Fensters reicht dafür nicht. Frist = Grundzeit + Körper bei mindestens ≈ 1 Mbit/s.
  var ABGLEICH_GRUNDFRIST_MS = 30000;
  var ABGLEICH_BYTES_JE_SEKUNDE = 128 * 1024;
  /** Office-Folienkennung „<p:sldId>#…“ (so in der Prüfattrappe; im Hostlauf zu bestätigen). */
  var FOLIENKENNUNG = /^(\d+)#/;
  var MERKER = "klara-pp02-verbindung:";
  var PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  var ERFASSUNG = {
    direkt: "direkt aus der Quelle übernommen",
    ocr: "per Texterkennung (OCR) aus einem Bild gelesen",
    manuell: "manuell eingegeben",
    berechnet: "berechnet",
    prognose: "Prognose – kein beobachteter Wert",
  };
  var ERFASSUNG_KURZ = { direkt: "direkt", ocr: "OCR", manuell: "manuell", berechnet: "berechnet", prognose: "Prognose" };
  var ZUSTAND = {
    erfasst: "erfasst",
    in_pruefung: "in Prüfung",
    klaerung: "Klärung nötig",
    validiert: "validiert",
    ueberpruefung_noetig: "Überprüfung nötig",
  };
  var DIMENSION = {
    erkennung: "Erkennung",
    struktur: "Struktur",
    berechnung: "Berechnung",
    konsistenz: "Konsistenz",
    aktualitaet: "Aktualität",
    fachliche_freigabe: "Fachliche Freigabe",
  };
  var STAND = {
    bestanden: "bestanden",
    klaerung: "Klärung nötig",
    offen: "offen",
    ueberholt: "überholt",
    nicht_zutreffend: "trifft nicht zu",
  };
  var RECHENART = { summe: "Summe", differenz: "Differenz", anteil_prozent: "Anteil in Prozent" };

  // ----------------------------------------------------------------------------------------------
  // REGELN — ohne Office und ohne Fenster prüfbar
  // ----------------------------------------------------------------------------------------------

  /** Artikelkennung aus einem KLARWERK-Link (`…/wissen/<id>`) oder der Kennung selbst; sonst null. */
  function artikelKennung(eingabe) {
    var t = String(eingabe || "").trim();
    var m = /\/wissen\/([A-Za-z0-9_-]{1,100})(?:[/?#]|$)/.exec(t);
    if (m) { return m[1]; }
    return /^[A-Za-z0-9_-]{1,100}$/.test(t) ? t : null;
  }

  function istPptx(anhang) {
    return !!anhang && (anhang.mime === PPTX_MIME || /\.pptx$/i.test(String(anhang.name || "")));
  }

  /**
   * Baut die Zuordnung Office → Datei. `officeFolien`: [{ id, formen: [{ id, name }] }] in der
   * Reihenfolge der Präsentation; `geoeffnet`: der Foliensatz, den der Server aus derselben Datei las.
   * Ergebnis: Schlüssel „Folien-Id|Form-Id“ → { sldId, shapeId, regel } und ein Befund mit Zählung.
   */
  function zuordnungBauen(officeFolien, geoeffnet) {
    var folien = (geoeffnet && geoeffnet.folien) || [];
    var befund = { folienOffice: officeFolien.length, folienDatei: folien.length, folienGeprueft: 0, kennung: 0, name: 0, ohne: 0 };
    var formen = {};
    var folienKarte = {};
    if (officeFolien.length !== folien.length) {
      befund.zustand = "uneins";
      befund.grund = "anzahl";
      return { formen: formen, folien: folienKarte, befund: befund };
    }
    // Prüfbefund P1/B9 (18.10.2026): die Stelle allein ist keine Gewähr. Nennt PowerPoint die Folie als
    // „<Zahl>#…“ und ist diese Zahl die p:sldId der Datei an derselben Stelle, ist die Folie bestätigt.
    // Nachprüfung N5: „uneins“ (nichts zugeordnet) NUR bei klarem Beleg — die Zahl ist die p:sldId einer
    // ANDEREN Folie der Datei, die Folien sind also vertauscht. Eine unbekannte Zahl oder ein anderes
    // Format beweist nichts (das Host-Format ist nicht gemessen): dann gilt die Stelle.
    var dateiKennungen = Object.create(null);
    for (var q = 0; q < folien.length; q += 1) { dateiKennungen[String(folien[q].sldId)] = true; }
    for (var p = 0; p < officeFolien.length; p += 1) {
      var kennungOffice = FOLIENKENNUNG.exec(String(officeFolien[p].id));
      if (!kennungOffice) { continue; }
      if (kennungOffice[1] === String(folien[p].sldId)) { befund.folienGeprueft += 1; continue; }
      if (dateiKennungen[kennungOffice[1]]) {
        befund.zustand = "uneins";
        befund.grund = "kennung";
        befund.stelle = p + 1;
        befund.officeKennung = kennungOffice[1];
        befund.dateiKennung = String(folien[p].sldId);
        return { formen: formen, folien: folienKarte, befund: befund };
      }
    }
    for (var i = 0; i < officeFolien.length; i += 1) {
      var of = officeFolien[i];
      var df = folien[i];
      folienKarte[of.id] = { sldId: df.sldId, position: df.position };
      var elemente = df.elemente || [];
      // Prüfbefund B2: zuerst alle Treffer über Kennung UND Name; der Name gilt danach nur, wenn er
      // auch unter den Office-Formen dieser Folie eindeutig ist und keine Office-Form das Element
      // schon über die Kennung trifft (eine leere Kopie mit gleichem Namen erbt sonst die Zahl).
      var officeNamen = Object.create(null);
      var ueberKennung = Object.create(null);
      var perKennung = [];
      for (var a = 0; a < of.formen.length; a += 1) {
        var fa = of.formen[a];
        officeNamen[fa.name] = (officeNamen[fa.name] || 0) + 1;
        perKennung[a] = null;
        for (var k = 0; k < elemente.length; k += 1) {
          if (elemente[k].shapeId === String(fa.id) && elemente[k].name === fa.name) { perKennung[a] = elemente[k]; ueberKennung[elemente[k].shapeId] = true; break; }
        }
      }
      for (var j = 0; j < of.formen.length; j += 1) {
        var form = of.formen[j];
        var treffer = perKennung[j];
        var regel = treffer ? "kennung" : null;
        if (!treffer && officeNamen[form.name] === 1) {
          var gleichnamig = elemente.filter(function (e) { return e.name === form.name; });
          if (gleichnamig.length === 1 && !ueberKennung[gleichnamig[0].shapeId]) { treffer = gleichnamig[0]; regel = "name"; }
        }
        if (treffer) {
          formen[of.id + "|" + form.id] = { sldId: df.sldId, shapeId: treffer.shapeId, regel: regel, name: treffer.name };
          befund[regel] += 1;
        } else {
          befund.ohne += 1;
        }
      }
    }
    befund.zustand = "ok";
    return { formen: formen, folien: folienKarte, befund: befund };
  }

  /** Die gebundenen Zahlen an einem Element der geöffneten Datei, mit dem Befund dieser Datei. */
  function zahlenAm(antwort, ziel) {
    var raus = [];
    var lagen = (antwort && antwort.hostLagen) || [];
    for (var i = 0; i < lagen.length; i += 1) {
      var l = lagen[i];
      if (l.sldId !== ziel.sldId || l.shapeId !== ziel.shapeId) { continue; }
      var sicht = null;
      for (var j = 0; j < antwort.datenpunkte.length; j += 1) {
        if (antwort.datenpunkte[j].id === l.datenpunktId) { sicht = antwort.datenpunkte[j]; break; }
      }
      if (sicht) { raus.push({ sicht: sicht, lage: l }); }
    }
    return raus;
  }

  /**
   * Der Stand, der an der Zahl gilt: trägt die Sicht die Datenkontrolle aus PP-03 (`kontrolle`), dann
   * diese — wie die Fläche am Artikel (FolienDaten); sonst der PP-02-Prüfstand. Nie beide nebeneinander.
   */
  function geltenderStand(sicht) {
    return sicht.kontrolle || sicht.pruefstand || null;
  }

  function zahlKnopfText(sicht) {
    var st = geltenderStand(sicht);
    return sicht.wert + " · " + (ERFASSUNG_KURZ[sicht.erfassung] || sicht.erfassung) + " · " +
      ((st && (ZUSTAND[st.zustand] || st.zustandName)) || "ohne Prüfstand");
  }

  function lageSatz(lage) {
    if (!lage) { return ""; }
    if (lage.lage === "passt") { return "In dieser Präsentation steht der Wert an seinem Element."; }
    if (lage.lage === "abweichung") { return "In dieser Präsentation steht dort heute: „" + lage.heute + "“ – das weicht vom Datenpunkt ab."; }
    return "In dieser Präsentation fehlt das gebundene Element.";
  }

  function fundstelleSatz(f) {
    if (!f) { return "keine"; }
    var folie = f.folienPosition ? "Folie " + f.folienPosition + (f.folienTitel ? " „" + f.folienTitel + "“" : "") : "";
    if (f.art === "tabellenzelle") {
      return folie + " · " + f.elementName + " · Zeile " + f.zeile + " („" + f.zeilenkopf + "“), Spalte " + f.spalte + " („" + f.spaltenkopf + "“): „" + f.zitat + "“";
    }
    if (f.art === "folienelement") { return folie + " · " + f.elementName + ": „" + f.zitat + "“"; }
    if (f.art === "bild") {
      return folie + " · Bild „" + f.elementName + "“ · erkannter Text: „" + f.ocrText + "“" + (f.unsicher ? " · die Erkennung meldete unsichere Stellen" : "");
    }
    if (f.art === "artikel") { return "Stelle im Quellartikel: „" + f.zitat + "“"; }
    if (f.art === "eingabe") { return "Eingabe" + (f.beleg ? ", gestützt auf: " + f.beleg : " ohne Beleg"); }
    if (f.art === "rechenweg") { return "aus dem Rechenweg"; }
    return f.art;
  }

  function quelleSatz(q) {
    if (q === null || q === undefined) { return "keine eigene Quelle"; }
    if (!q.lesbar) { return "für dich nicht lesbar"; }
    var satz = "„" + q.titel + "“, Fassung " + q.koFassung + (q.aktuelleFassung !== q.koFassung ? " (aktuell " + q.aktuelleFassung + ")" : "");
    if (q.anhangName) { satz += " · Anhang „" + q.anhangName + "“"; }
    if (q.dateiFassung) { satz += " · Dateifassung " + String(q.dateiFassung).slice(0, 12); }
    return satz;
  }

  /** Base64 aus den Scheiben, die `getSliceAsync` liefert (Byte-Felder). */
  function base64AusScheiben(scheiben) {
    var teile = [];
    for (var i = 0; i < scheiben.length; i += 1) {
      var daten = scheiben[i];
      var binaer = "";
      for (var p = 0; p < daten.length; p += 0x8000) {
        binaer += String.fromCharCode.apply(null, Array.prototype.slice.call(daten, p, p + 0x8000));
      }
      teile.push(binaer);
    }
    return btoa(teile.join(""));
  }

  var regeln = {
    artikelKennung: artikelKennung,
    istPptx: istPptx,
    zuordnungBauen: zuordnungBauen,
    zahlenAm: zahlenAm,
    zahlKnopfText: zahlKnopfText,
    geltenderStand: geltenderStand,
    lageSatz: lageSatz,
    fundstelleSatz: fundstelleSatz,
    quelleSatz: quelleSatz,
    base64AusScheiben: base64AusScheiben,
  };

  // ----------------------------------------------------------------------------------------------
  // OFFICE — nur lesen
  // ----------------------------------------------------------------------------------------------

  function officeRuf(start) {
    return new Promise(function (ok, nein) {
      start(function (r) {
        if (r && r.status === Office.AsyncResultStatus.Succeeded) { ok(r.value); }
        else { nein((r && r.error) || new Error("Office meldet einen Fehler")); }
      });
    });
  }

  /** Die geöffnete Präsentation als .pptx-Bytes, Scheibe für Scheibe; die Datei wird danach geschlossen. */
  function dateiLesen() {
    var d = Office.context.document;
    return officeRuf(function (cb) { d.getFileAsync(Office.FileType.Compressed, { sliceSize: SCHEIBE }, cb); })
      .then(function (datei) {
        var scheiben = [];
        var schliessen = function () {
          return new Promise(function (ok) { try { datei.closeAsync(function () { ok(); }); } catch (e) { ok(); } });
        };
        if (datei.size > GRENZE_BYTES) {
          return schliessen().then(function () {
            var f = new Error("zu gross"); f.zuGross = true; f.groesse = datei.size; throw f;
          });
        }
        var weiter = function (i) {
          if (i >= datei.sliceCount) { return Promise.resolve(); }
          return officeRuf(function (cb) { datei.getSliceAsync(i, cb); }).then(function (s) {
            scheiben.push(s.data);
            return weiter(i + 1);
          });
        };
        return weiter(0).then(schliessen, function (f) { return schliessen().then(function () { throw f; }); })
          .then(function () { return scheiben; });
      });
  }

  /** Folien in Präsentationsreihenfolge, je Folie Kennung und Name jeder Form (PowerPointApi 1.3). */
  function officeFolienLesen() {
    return PowerPoint.run(function (ctx) {
      var folien = ctx.presentation.slides;
      folien.load("items/id");
      return ctx.sync().then(function () {
        var formen = folien.items.map(function (s) { var f = s.shapes; f.load("items/id,items/name"); return f; });
        return ctx.sync().then(function () {
          return folien.items.map(function (s, i) {
            return { id: s.id, formen: formen[i].items.map(function (f) { return { id: f.id, name: f.name }; }) };
          });
        });
      });
    });
  }

  // ----------------------------------------------------------------------------------------------
  // FENSTER
  // ----------------------------------------------------------------------------------------------

  var h = {
    verbindung: null,
    anhaenge: [],
    antwort: null,
    zuordnung: null,
    ziele: [],
    stapel: [],
    beschaeftigt: false,
  };

  function el(id) { return document.getElementById(id); }
  function text(id, satz) { var e = el(id); if (e) { e.textContent = satz; } }
  function zeigen(id, an) { var e = el(id); if (e) { e.hidden = !an; } }
  function meldung(satz) { var e = el("herkunft-meldung"); if (e) { e.textContent = satz || ""; e.hidden = !satz; } }
  function fenster() { return window.klaraOfficeFenster || null; }
  function zustand() { var f = fenster(); return f ? f.zustand : null; }

  function merkerSchluessel() {
    var z = zustand();
    var url = (z && z.kontext && z.kontext.dokument) || "";
    return url ? MERKER + url : null;
  }

  function merken(v) {
    var k = merkerSchluessel();
    if (!k) { return; }
    try { window.localStorage.setItem(k, JSON.stringify({ koId: v.koId, anhangId: v.anhangId })); } catch (e) { /* ohne Speicher */ }
  }

  function erinnern() {
    var k = merkerSchluessel();
    if (!k) { return null; }
    try { var v = JSON.parse(window.localStorage.getItem(k) || "null"); return v && v.koId ? v : null; } catch (e) { return null; }
  }

  function fehlerSatz(status, nachricht) {
    if (status === 401) { return "Bitte neu anmelden."; }
    if (status === 403) { return "Dir fehlt das Leserecht (ko.read)."; }
    if (status === 404) { return "Artikel oder Anhang nicht gefunden – oder für dich nicht sichtbar."; }
    if (status === 413) { return "Die Präsentation ist für den Abgleich zu groß."; }
    return nachricht || "KLARWERK antwortet mit HTTP " + status + ".";
  }

  function jsonAbruf(pfad, init, fristMs) {
    var f = fenster();
    return f.abruf(pfad, init, fristMs).then(function (res) {
      return res.json().then(function (b) { return b; }, function () { return {}; }).then(function (body) {
        if (!res.ok) { var x = new Error("HTTP " + res.status); x.status = res.status; x.nachricht = body && body.message; throw x; }
        return body;
      });
    });
  }

  function kontrollen() {
    var z = zustand();
    var bereit = !!z && z.host === "powerpoint" && !h.beschaeftigt;
    var api = !!z && !!z.api && z.api.faehigkeiten.auswahl === true;
    var knopf = el("herkunft-verbinden");
    if (knopf) { knopf.disabled = !bereit; }
    var abgleich = el("herkunft-abgleichen");
    if (abgleich) { abgleich.disabled = !(bereit && api && !!h.verbindung); }
    // Prüfbefund B6: kein Anhangwechsel, während ein Abgleich läuft.
    var wahl = el("herkunft-anhang");
    if (wahl) { wahl.disabled = h.beschaeftigt; }
  }

  function verbinden() {
    var z = zustand();
    if (!z || !z.angemeldet) { meldung("Bitte zuerst oben bei KLARWERK anmelden."); return Promise.resolve(); }
    var koId = artikelKennung(el("herkunft-artikel").value);
    if (!koId) { meldung("Bitte den Link zum Artikel (…/wissen/…) oder seine Kennung eingeben."); return Promise.resolve(); }
    meldung("");
    h.beschaeftigt = true;
    kontrollen();
    return jsonAbruf("/api/kos/" + encodeURIComponent(koId), { method: "GET" })
      .then(function (ko) {
        h.anhaenge = (ko.attachments || []).filter(istPptx);
        var wahl = el("herkunft-anhang");
        while (wahl.firstChild) { wahl.removeChild(wahl.firstChild); }
        h.anhaenge.forEach(function (a) {
          var o = document.createElement("option");
          o.value = a.id;
          o.textContent = a.name;
          wahl.appendChild(o);
        });
        zeigen("herkunft-anhang-wahl", h.anhaenge.length > 0);
        if (h.anhaenge.length === 0) {
          h.verbindung = null;
          meldung("Dieser Artikel hat keinen PowerPoint-Anhang (.pptx).");
          return;
        }
        var frueher = erinnern();
        var vorab = frueher && frueher.koId === ko.id ? h.anhaenge.filter(function (a) { return a.id === frueher.anhangId; })[0] : null;
        wahl.value = (vorab || h.anhaenge[0]).id;
        anhangGewaehlt(ko);
      }, function (f) { h.verbindung = null; meldung(fehlerSatz(f.status, f.nachricht)); })
      .then(function () { h.beschaeftigt = false; kontrollen(); });
  }

  function anhangGewaehlt(ko) {
    var id = el("herkunft-anhang").value;
    var anhang = h.anhaenge.filter(function (a) { return a.id === id; })[0];
    var koId = ko ? ko.id : h.verbindung && h.verbindung.koId;
    if (!anhang || !koId) { return; }
    h.verbindung = { koId: koId, titel: ko ? ko.title : h.verbindung.titel, anhangId: anhang.id, anhangName: anhang.name };
    h.antwort = null;
    h.zuordnung = null;
    merken(h.verbindung);
    text("herkunft-zeile", "Verbunden mit „" + h.verbindung.titel + "“ · Anhang „" + anhang.name + "“. Noch nicht abgeglichen.");
    listeZeigen();
    kontrollen();
  }

  function abgleichen() {
    var z = zustand();
    if (!h.verbindung || !z || z.host !== "powerpoint") { return Promise.resolve(); }
    if (!z.api || z.api.faehigkeiten.auswahl !== true) {
      meldung("Diese PowerPoint-Fassung bestätigt PowerPointApi 1.5 nicht; ohne Auswahl der Form lässt sich die Herkunft nicht zuordnen.");
      return Promise.resolve();
    }
    if (typeof Office.context.document.getFileAsync !== "function") {
      meldung("Diese PowerPoint-Fassung gibt die geöffnete Datei nicht heraus (getFileAsync fehlt).");
      return Promise.resolve();
    }
    h.beschaeftigt = true;
    meldung("");
    kontrollen();
    text("herkunft-abgleich", "Abgleich läuft …");
    var v = h.verbindung;
    var officeFolien = null;
    var frist = ABGLEICH_GRUNDFRIST_MS;
    return officeFolienLesen()
      .then(function (f) { officeFolien = f; return dateiLesen(); })
      .then(function (scheiben) {
        var koerper = JSON.stringify({ datei: base64AusScheiben(scheiben) });
        frist = ABGLEICH_GRUNDFRIST_MS + Math.ceil(koerper.length / ABGLEICH_BYTES_JE_SEKUNDE) * 1000;
        return jsonAbruf("/api/kos/" + encodeURIComponent(v.koId) + "/office/" + encodeURIComponent(v.anhangId) + "/folien-abgleich", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: koerper,
        }, frist);
      })
      .then(function (antwort) {
        // Prüfbefund B6: inzwischen mit einem anderen Anhang verbunden — diese Antwort gilt nicht mehr.
        if (h.verbindung !== v) { text("herkunft-abgleich", "Nicht abgeglichen."); return; }
        h.antwort = antwort;
        h.zuordnung = zuordnungBauen(officeFolien, antwort.geoeffnet);
        var b = h.zuordnung.befund;
        if (b.zustand !== "ok" && b.grund === "kennung") {
          text("herkunft-abgleich", "An Stelle " + b.stelle + " zeigt PowerPoint die Folie mit der Kennung " + b.officeKennung + ", die gelesene Datei die Folie " + b.dateiKennung + ". Ohne passende Folien wird keine Zahl zugeordnet – bitte kurz warten und neu abgleichen.");
        } else if (b.zustand !== "ok") {
          text("herkunft-abgleich", "PowerPoint zeigt " + b.folienOffice + " Folien, die gelesene Datei " + b.folienDatei + ". Bitte kurz warten und neu abgleichen.");
        } else {
          // Prüfbefund B9: der Satz nennt die Regel, die tatsächlich galt.
          var folienSatz = b.folienGeprueft === b.folienDatei
            ? b.folienDatei + " Folien zugeordnet über ihre Stelle in der Datei, jede bestätigt durch ihre Kennung (p:sldId). "
            : b.folienGeprueft > 0
              ? b.folienDatei + " Folien zugeordnet über ihre Stelle in der Datei, " + b.folienGeprueft + " davon bestätigt durch ihre Kennung (p:sldId), die übrigen nach Position (Kennung nicht vergleichbar). "
              : b.folienDatei + " Folien zugeordnet nach Position (Kennung nicht vergleichbar). ";
          text("herkunft-abgleich",
            (antwort.geoeffnet.gleicheDatei ? "Die geöffnete Datei ist dieselbe Fassung wie der Anhang. " : "Die geöffnete Datei ist nicht bytegleich mit dem Anhang (PowerPoint gibt sie neu gespeichert heraus); jede Zahl nennt ihren Befund in dieser Datei. ") +
            folienSatz + "Formen: " + b.kennung + " über Kennung und Name, " +
            b.name + " über den Namen, " + b.ohne + " ohne lesbares Element.");
          // Hostlauf H01 (17.10.): die Zeile sagte nach dem Abgleich weiter „Noch nicht abgeglichen.“
          text("herkunft-zeile", "Verbunden mit „" + v.titel + "“ · Anhang „" + v.anhangName + "“. Abgeglichen um " +
            new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + ".");
        }
        auswahlZeigen();
      }, function (f) {
        if (h.verbindung !== v) { text("herkunft-abgleich", "Nicht abgeglichen."); return; }
        h.antwort = null;
        h.zuordnung = null;
        text("herkunft-abgleich", "Nicht abgeglichen.");
        text("herkunft-zeile", "Verbunden mit „" + v.titel + "“ · Anhang „" + v.anhangName + "“. Nicht abgeglichen.");
        meldung(f && f.zuGross ? "Die Präsentation ist mit " + Math.round(f.groesse / 1048576) + " MB für den Abgleich zu groß (höchstens 30 MB)."
          : f && f.name === "AbortError" ? "Der Abgleich dauerte länger als " + Math.round(frist / 1000) + " Sekunden und wurde abgebrochen. Bitte neu abgleichen – bei einer großen Präsentation über eine schnellere Verbindung."
            : fehlerSatz(f && f.status, f && (f.nachricht || f.message)));
      })
      .then(function () { h.beschaeftigt = false; kontrollen(); });
  }

  /** Nach jedem Lesen des Fensters: welche Formen sind markiert, welche Zahlen hängen daran? */
  function auswahlZeigen() {
    var z = zustand();
    if (!z || z.host !== "powerpoint") { zeigen("herkunft-block", false); return; }
    zeigen("herkunft-block", true);
    kontrollen();
    var vorher = zieleSchluessel(h.ziele);
    h.ziele = [];
    if (!h.antwort || !h.zuordnung || h.zuordnung.befund.zustand !== "ok" || !z.kontext) { listeZeigen(); return; }
    var folie = z.kontext.folien && z.kontext.folien[0];
    var formen = z.kontext.formen || [];
    var unbekannt = 0;
    for (var i = 0; folie && i < formen.length; i += 1) {
      var ziel = h.zuordnung.formen[folie.id + "|" + formen[i].id];
      if (!ziel) { unbekannt += 1; continue; }
      var doppelt = h.ziele.some(function (x) { return x.sldId === ziel.sldId && x.shapeId === ziel.shapeId; });
      if (!doppelt) { h.ziele.push(ziel); }
    }
    if (folie && !h.zuordnung.folien[folie.id]) {
      meldung("Diese Folie war beim Abgleich noch nicht da. Bitte neu abgleichen.");
    } else if (formen.length > 0 && h.ziele.length === 0 && unbekannt > 0) {
      meldung("Für die markierte Form gibt es in der abgeglichenen Datei kein lesbares Element.");
    } else {
      meldung("");
    }
    // Hostlauf H01 (17.10.): nach einem Auswahlwechsel stand noch die Herkunft der vorher geöffneten
    // Zahl neben der neuen Liste. Eine andere Auswahl schließt den Detailbereich.
    if (zieleSchluessel(h.ziele) !== vorher) { schliessen(); }
    listeZeigen();
  }

  function zieleSchluessel(ziele) {
    return ziele.map(function (x) { return x.sldId + "|" + x.shapeId; }).join(",");
  }

  function listeZeigen() {
    var liste = el("herkunft-liste");
    if (!liste) { return; }
    while (liste.firstChild) { liste.removeChild(liste.firstChild); }
    var zahlen = [];
    h.ziele.forEach(function (ziel) {
      zahlenAm(h.antwort, ziel).forEach(function (eintrag) { eintrag.ziel = ziel; zahlen.push(eintrag); });
    });
    zahlen.forEach(function (eintrag) {
      var li = document.createElement("li");
      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "zahl";
      knopf.setAttribute("data-datenpunkt", eintrag.sicht.id);
      knopf.setAttribute("data-erfassung", eintrag.sicht.erfassung);
      knopf.textContent = zahlKnopfText(eintrag.sicht);
      knopf.setAttribute("aria-label", "Herkunft von " + eintrag.sicht.wert + " öffnen: " + (ERFASSUNG[eintrag.sicht.erfassung] || eintrag.sicht.erfassung) + ", " + (ZUSTAND[(geltenderStand(eintrag.sicht) || {}).zustand] || "") + ", am Element „" + eintrag.ziel.name + "“");
      // Nachprüfung N6: den GEKLICKTEN Knopf merken (derselbe Datenpunkt kann mehrfach in der Liste stehen),
      // samt Stelle in der Liste für den Fall, dass sie inzwischen neu gezeichnet wurde.
      knopf.addEventListener("click", function () {
        var alle = Array.prototype.slice.call(liste.querySelectorAll("button.zahl"));
        h.stapel = [];
        h.ausloeser = { id: eintrag.sicht.id, knopf: knopf, stelle: alle.indexOf(knopf) };
        herkunftOeffnen(eintrag.sicht, eintrag.lage);
      });
      li.appendChild(knopf);
      liste.appendChild(li);
    });
    var leer = h.antwort && h.ziele.length > 0 && zahlen.length === 0;
    text("herkunft-leer", leer ? "An der markierten Form hängt keine gebundene Zahl." : "");
    zeigen("herkunft-leer", !!leer);
    if (!h.antwort) { zeigen("herkunft-detail", false); }
  }

  function zeile(dl, name, wert) {
    var dt = document.createElement("dt");
    dt.textContent = name;
    var dd = document.createElement("dd");
    if (typeof wert === "string") { dd.textContent = wert; } else { dd.appendChild(wert); }
    dl.appendChild(dt);
    dl.appendChild(dd);
    return dd;
  }

  /** Prüfbefund B8: der Fokus folgt der Herkunft (Öffnen, Eingabe, Zurück) und kehrt beim Schließen zurück. */
  function detailFokussieren() {
    var d = el("herkunft-detail");
    if (d && !d.hidden && typeof d.focus === "function") { d.focus(); }
  }

  function herkunftOeffnen(sicht, lage) {
    h.stapel.push({ sicht: sicht, lage: lage || null });
    detailZeigen();
    detailFokussieren();
  }

  function detailZeigen() {
    var oben = h.stapel[h.stapel.length - 1];
    var inhalt = el("herkunft-detail-inhalt");
    if (!oben || !inhalt) { zeigen("herkunft-detail", false); return; }
    var s = oben.sicht;
    while (inhalt.firstChild) { inhalt.removeChild(inhalt.firstChild); }
    var kopf = document.createElement("h3");
    kopf.textContent = s.wert + (s.historisch ? " (frühere Fassung " + s.fassung + ", aktuell " + s.historisch.aktuelleFassung + ")" : "");
    inhalt.appendChild(kopf);
    var dl = document.createElement("dl");
    inhalt.appendChild(dl);
    zeile(dl, "Erfasst als", ERFASSUNG[s.erfassung] || s.erfassung);
    var rahmen = [s.einheit, s.waehrung, s.zeitraum, s.bezugsgroesse].filter(function (x) { return !!x; });
    if (rahmen.length) { zeile(dl, "Bezugsrahmen", rahmen.join(" · ")); }
    zeile(dl, "Quelle", quelleSatz(s.quelle));
    zeile(dl, "Fundstelle", fundstelleSatz(s.fundstelle));
    if (s.rechenweg) {
      var r = s.rechenweg;
      zeile(dl, "Rechenweg", (RECHENART[r.art] || r.art) + ": " + r.formel + " = " + r.ergebnis + " (gerundet auf " + r.stellen + " Nachkommastellen)");
      var ul = document.createElement("ul");
      r.eingaben.forEach(function (e, i) {
        var li = document.createElement("li");
        if (!e.lesbar) {
          li.textContent = "Eingabe " + (i + 1) + ": für dich nicht lesbar (Fassung " + e.verwendet.fassung + ")";
        } else {
          var k = document.createElement("button");
          k.type = "button";
          k.setAttribute("data-eingabe", String(i));
          k.textContent = "Eingabe " + (i + 1) + ": " + e.verwendet.wert + " (Fassung " + e.verwendet.fassung + ", " + (ERFASSUNG_KURZ[e.datenpunkt.erfassung] || e.datenpunkt.erfassung) + ")" +
            (e.aktuell && e.aktuell.fassung !== e.verwendet.fassung ? " – heute " + e.aktuell.wert : "");
          k.addEventListener("click", function () { herkunftOeffnen(e.datenpunkt, null); });
          li.appendChild(k);
        }
        ul.appendChild(li);
      });
      zeile(dl, "Verwendete Eingaben", ul);
    }
    if (s.annahmen && s.annahmen.length) { zeile(dl, "Annahmen", s.annahmen.join(" · ")); }
    var ps = geltenderStand(s);
    zeile(dl, s.kontrolle ? "Datenkontrolle" : "Prüfstand", (ZUSTAND[ps.zustand] || ps.zustandName || ps.zustand) + " – " + ps.grund);
    var dims = document.createElement("ul");
    ps.dimensionen.forEach(function (d) {
      var li = document.createElement("li");
      li.textContent = (DIMENSION[d.dimension] || d.name || d.dimension) + ": " + (STAND[d.stand] || d.standName || d.stand) + " – " + d.grund;
      dims.appendChild(li);
    });
    zeile(dl, "Je Prüfdimension", dims);
    if (oben.lage) { zeile(dl, "In dieser Präsentation", lageSatz(oben.lage)); }
    zeile(dl, "Schutzstufe", s.schutzstufe);
    var link = el("herkunft-link");
    if (link) { link.setAttribute("href", "/wissen/" + encodeURIComponent(s.heimatKoId)); }
    zeigen("herkunft-zurueck", h.stapel.length > 1);
    zeigen("herkunft-detail", true);
  }

  function zurueck() { if (h.stapel.length > 1) { h.stapel.pop(); detailZeigen(); detailFokussieren(); } }

  /**
   * Schließt die Herkunft. `ausdruecklich` (Knopf „Schließen“, Escape): der Fokus geht an den
   * Zahl-Knopf, der sie geöffnet hat. Schließt die Herkunft wegen einer anderen Auswahl in PowerPoint,
   * bleibt der Fokus, wo er ist — das Fenster nimmt dem Dokument den Fokus nicht weg.
   */
  function schliessen(ausdruecklich) {
    var offen = h.stapel.length > 0;
    h.stapel = [];
    zeigen("herkunft-detail", false);
    var a = h.ausloeser;
    if (!ausdruecklich || !offen || !a) { return; }
    if (a.knopf && a.knopf.isConnected) { a.knopf.focus(); return; }
    // Die Liste wurde neu gezeichnet: derselbe Datenpunkt an derselben Stelle, sonst sein erster Knopf.
    var knoepfe = document.querySelectorAll("#herkunft-liste button.zahl");
    var dort = knoepfe[a.stelle];
    if (dort && dort.getAttribute("data-datenpunkt") === a.id) { dort.focus(); return; }
    for (var i = 0; i < knoepfe.length; i += 1) {
      if (knoepfe[i].getAttribute("data-datenpunkt") === a.id) { knoepfe[i].focus(); return; }
    }
  }

  function verdrahten() {
    if (!el("herkunft-block")) { return false; }
    el("herkunft-verbinden").addEventListener("click", verbinden);
    el("herkunft-anhang").addEventListener("change", function () {
      // Prüfbefund B6: während eines Abgleichs gesperrt; falls ein Host das Feld doch ändert, zurück.
      if (h.beschaeftigt) { if (h.verbindung) { el("herkunft-anhang").value = h.verbindung.anhangId; } return; }
      anhangGewaehlt(null);
    });
    el("herkunft-abgleichen").addEventListener("click", abgleichen);
    el("herkunft-zurueck").addEventListener("click", zurueck);
    el("herkunft-schliessen").addEventListener("click", function () { schliessen(true); });
    el("herkunft-detail").addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); schliessen(true); } });
    window.addEventListener("klara-office-kontext", function () {
      var z = zustand();
      var eingabe = el("herkunft-artikel");
      if (z && z.host === "powerpoint" && !h.verbindung && eingabe && !eingabe.value) {
        var frueher = erinnern();
        if (frueher) { eingabe.value = frueher.koId; }
      }
      auswahlZeigen();
    });
    return true;
  }

  window.KlaraFolienHerkunft = {
    regeln: regeln,
    zustand: h,
    verbinden: verbinden,
    abgleichen: abgleichen,
    auswahlZeigen: auswahlZeigen,
    zurueck: zurueck,
    schliessen: function () { schliessen(true); },
  };

  verdrahten();
})();

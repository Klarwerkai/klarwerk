// ================================================================================================
// KLARA IN EXCEL UND POWERPOINT · DER HOSTKERN (aufnahme:20260922:excel-erster-weg, KO-04-01..07)
// ================================================================================================
//
// WAS DIESE DATEI IST: die reine Entscheidungslogik des Office-Aufgabenfensters — ohne DOM, ohne
// Office-Aufruf, ohne Netz. Sie bekommt gelesene Daten herein und gibt Bewertungen zurück:
//
//   · welcher Host, welche Plattform, welche API-Stufe WIRKLICH zur Laufzeit da ist (KO-04-01)
//   · wie eine Excel-Auswahl zu lesen ist: Wert, Formel und angezeigter Text GETRENNT, leere,
//     mehrteilige und zu grosse Auswahl mit eigener Behandlung und begrenztem Kontext (KO-04-02)
//   · wie eine PowerPoint-Lage zu lesen ist: Folie, Form, Text, Leseansicht, Ausweg (KO-04-04)
//   · ob eine Rückgabe an ihr Ziel darf: dasselbe Dokument, dasselbe Blatt bzw. dieselbe Folie und
//     Form, unverändert seit dem Lesen, nicht geschützt, nicht nur lesbar, nicht veraltet (KO-04-06)
//   · was Klara selbst nachrechnet (deterministisch, KO-04-03) — und was sie nicht behauptet.
//
// WARUM EIGENE DATEI: `taskpane.js` spricht mit Office und dem Server. Diese Regeln sollen ohne
// beides prüfbar sein (`tests/office-addin/hostkern.test.ts` lädt genau diese Datei). Dieselbe
// Sprache wie das Word-Fenster (ES5, `var`, kein Modul, kein Build); deshalb steht die Datei wie
// die Word-Skripte auf der Ignorierliste von Biome.
//
// KEINE ZWEITE ASSISTENZ: gefragt wird über den vorhandenen Klara-Sitzungsweg
// (`/api/klara/sessions/{id}/execute`). Diese Datei baut nur den Kontexttext, den das Fenster dort
// als `selection` mitgibt; ob er ein Modell erreicht, entscheidet allein der Server (Zustimmung).
// ================================================================================================
(function (wurzel) {
  "use strict";

  /** Die Grenzen des Kontexts. `maxKontextZeichen` bleibt unter `selection.maxLength` (8000). */
  var GRENZEN = {
    maxZellen: 500,
    maxBereiche: 5,
    maxKontextZeichen: 6000,
    maxZellText: 200,
    maxFormen: 20,
    maxFormText: 1500,
    planGueltigMs: 5 * 60 * 1000,
  };

  /**
   * Die geprüften API-Stufen je Host. Jede Fähigkeit nennt die Stufe, ab der Office sie offiziell
   * anbietet; das Fenster schaltet sie nur frei, wenn `isSetSupported` sie zur Laufzeit bestätigt.
   */
  var API = {
    excel: {
      satz: "ExcelApi",
      stufen: ["1.1", "1.2", "1.7", "1.9"],
      faehigkeiten: {
        bereichLesen: "1.1",
        bereichSchreiben: "1.1",
        blattschutz: "1.2",
        mappenname: "1.7",
        mehrfachauswahl: "1.9",
      },
    },
    powerpoint: {
      satz: "PowerPointApi",
      stufen: ["1.1", "1.2", "1.4", "1.5"],
      faehigkeiten: {
        folienListe: "1.2",
        formTextSchreiben: "1.4",
        auswahl: "1.5",
      },
    },
  };

  /** Die einzigen Rückgaben, die das Fenster kennt. Bilder oder Figuren gehören nicht dazu. */
  var RUECKGABE_ARTEN = {
    excel: ["summenformel", "zelltext"],
    powerpoint: ["formtext"],
  };

  /** PowerPoint-Formen, deren Text Office lesen und schreiben lässt. */
  var PPT_TEXTFORMEN = ["GeometricShape", "TextBox", "Placeholder", "Callout"];

  /** Die abgenommenen Plattformen dieses Auftrags: Mac und Web. Andere sind nicht abgenommen. */
  var PLATTFORMEN = { Mac: "Mac", OfficeOnline: "Web" };

  // ----------------------------------------------------------------------------------------------
  // HOST, PLATTFORM, API-STUFE (KO-04-01)
  // ----------------------------------------------------------------------------------------------

  /** `Office.HostType` → "excel" | "powerpoint" | "word" | null. Nichts wird geraten. */
  function hostAusOffice(wert) {
    var w = typeof wert === "string" ? wert.toLowerCase() : "";
    if (w === "excel") { return "excel"; }
    if (w === "powerpoint") { return "powerpoint"; }
    if (w === "word") { return "word"; }
    return null;
  }

  /**
   * Fragt jede Stufe einzeln ab. `isSetSupported` ist `Office.context.requirements.isSetSupported`
   * oder im Test eine Attrappe. Wirft sie, gilt die Stufe als NICHT vorhanden (fail-closed).
   */
  function pruefeApiStufen(host, isSetSupported) {
    var def = API[host];
    if (!def) { return null; }
    var stufen = {};
    var hoechste = null;
    for (var i = 0; i < def.stufen.length; i += 1) {
      var stufe = def.stufen[i];
      var da = false;
      try { da = typeof isSetSupported === "function" && isSetSupported(def.satz, stufe) === true; }
      catch (e) { da = false; }
      stufen[stufe] = da;
      if (da) { hoechste = stufe; }
    }
    var faehigkeiten = {};
    for (var name in def.faehigkeiten) {
      if (Object.prototype.hasOwnProperty.call(def.faehigkeiten, name)) {
        faehigkeiten[name] = stufen[def.faehigkeiten[name]] === true;
      }
    }
    return { host: host, satz: def.satz, stufen: stufen, hoechste: hoechste, faehigkeiten: faehigkeiten };
  }

  /** Was fehlt — als lesbare Liste „Fähigkeit (Satz Stufe)". */
  function fehlendeFaehigkeiten(api) {
    var raus = [];
    if (!api) { return raus; }
    var def = API[api.host];
    for (var name in api.faehigkeiten) {
      if (Object.prototype.hasOwnProperty.call(api.faehigkeiten, name) && !api.faehigkeiten[name]) {
        raus.push(name + " (" + def.satz + " " + def.faehigkeiten[name] + ")");
      }
    }
    return raus;
  }

  /**
   * Aus `Office.context.diagnostics` (host, platform, version) und `Office.context.platform`.
   * `imAuftrag` heisst nur: diese Plattform gehört zum Auftrag (Mac, Web) — nicht, dass sie schon
   * abgenommen IST. Das belegt allein die Hostabnahme.
   */
  function plattformAus(diagnostics, platform) {
    var d = diagnostics || {};
    var p = typeof d.platform === "string" && d.platform ? d.platform : (typeof platform === "string" ? platform : "");
    return {
      host: typeof d.host === "string" ? d.host : "",
      plattform: p,
      anzeige: PLATTFORMEN[p] || (p || "unbekannt"),
      version: typeof d.version === "string" ? d.version : "",
      imAuftrag: Object.prototype.hasOwnProperty.call(PLATTFORMEN, p),
    };
  }

  /** Der Dateiname aus der Dokumentadresse — ohne Abfrage, dekodiert. Leer, wenn ungespeichert. */
  function dokumentName(url) {
    if (typeof url !== "string" || url.length === 0) { return ""; }
    var ohne = url.split("?")[0].split("#")[0];
    var teile = ohne.split(/[\\/]/);
    var letzter = teile[teile.length - 1] || "";
    try { return decodeURIComponent(letzter); } catch (e) { return letzter; }
  }

  // ----------------------------------------------------------------------------------------------
  // EXCEL-ADRESSEN
  // ----------------------------------------------------------------------------------------------

  function spalteZuZahl(buchstaben) {
    var n = 0;
    var b = String(buchstaben).toUpperCase();
    for (var i = 0; i < b.length; i += 1) { n = n * 26 + (b.charCodeAt(i) - 64); }
    return n;
  }

  function zahlZuSpalte(n) {
    var s = "";
    var z = n;
    while (z > 0) {
      var r = (z - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      z = Math.floor((z - 1) / 26);
    }
    return s;
  }

  var MAX_ZEILE = 1048576;
  var MAX_SPALTE = 16384;

  /**
   * Zerlegt eine Excel-Adresse: "Tabelle1!B2:C5", "'Mein Blatt'!B2", "B:B", "2:4".
   * Liefert null, wenn die Adresse nicht eindeutig lesbar ist.
   */
  function adresseZerlegen(adresse) {
    if (typeof adresse !== "string" || adresse.length === 0) { return null; }
    var blatt = "";
    var teil = adresse;
    var ausruf = adresse.lastIndexOf("!");
    if (ausruf >= 0) {
      blatt = adresse.slice(0, ausruf);
      teil = adresse.slice(ausruf + 1);
      if (blatt.charAt(0) === "'" && blatt.charAt(blatt.length - 1) === "'") {
        blatt = blatt.slice(1, -1).replace(/''/g, "'");
      }
    }
    var stuecke = teil.replace(/\$/g, "").split(":");
    if (stuecke.length < 1 || stuecke.length > 2) { return null; }
    var a = zelleZerlegen(stuecke[0]);
    var b = zelleZerlegen(stuecke.length === 2 ? stuecke[1] : stuecke[0]);
    if (!a || !b) { return null; }
    var startSpalte = a.spalte === null ? 1 : a.spalte;
    var endSpalte = b.spalte === null ? MAX_SPALTE : b.spalte;
    var startZeile = a.zeile === null ? 1 : a.zeile;
    var endZeile = b.zeile === null ? MAX_ZEILE : b.zeile;
    return {
      blatt: blatt,
      startSpalte: Math.min(startSpalte, endSpalte),
      endSpalte: Math.max(startSpalte, endSpalte),
      startZeile: Math.min(startZeile, endZeile),
      endZeile: Math.max(startZeile, endZeile),
    };
  }

  function zelleZerlegen(text) {
    var m = /^([A-Za-z]{1,3})?([0-9]{1,7})?$/.exec(text);
    if (!m || (!m[1] && !m[2])) { return null; }
    return { spalte: m[1] ? spalteZuZahl(m[1]) : null, zeile: m[2] ? parseInt(m[2], 10) : null };
  }

  function zellAdresse(spalte, zeile) { return zahlZuSpalte(spalte) + String(zeile); }

  /** Lokale Adresse eines Bereichs ohne Blatt: "B2:C5" bzw. "B2". */
  function lokaleAdresse(z) {
    var a = zellAdresse(z.startSpalte, z.startZeile);
    var b = zellAdresse(z.endSpalte, z.endZeile);
    return a === b ? a : a + ":" + b;
  }

  /**
   * Der lesbare Teilblock eines grossen Bereichs: höchstens `maxZellen` Zellen ab der linken oberen
   * Ecke, ganze Zeilen bevorzugt. So wird nie eine ganze Spalte (1 048 576 Zellen) geladen.
   */
  function teilblock(z, maxZellen) {
    var spalten = z.endSpalte - z.startSpalte + 1;
    var zeilen = z.endZeile - z.startZeile + 1;
    var nutzSpalten = Math.min(spalten, Math.max(1, maxZellen));
    var nutzZeilen = Math.min(zeilen, Math.max(1, Math.floor(maxZellen / nutzSpalten)));
    return {
      blatt: z.blatt,
      startSpalte: z.startSpalte,
      endSpalte: z.startSpalte + nutzSpalten - 1,
      startZeile: z.startZeile,
      endZeile: z.startZeile + nutzZeilen - 1,
    };
  }

  /** Eine einzelne Zelladresse ohne Blatt, z. B. "D7" — sonst false. */
  function istEinzelzelle(text) {
    return typeof text === "string" && /^[A-Za-z]{1,3}[1-9][0-9]{0,6}$/.test(text.trim());
  }

  // ----------------------------------------------------------------------------------------------
  // EXCEL-ZELLEN: WERT, FORMEL, ANGEZEIGTER TEXT (KO-04-02)
  // ----------------------------------------------------------------------------------------------

  /**
   * Eine Zelle in drei getrennten Angaben plus Art. Die Art kommt aus `valueTypes`, wenn Office sie
   * geliefert hat; sonst aus dem Wert. Eine Formel ist immer eine Formel, auch wenn sie eine Zahl
   * ergibt — ihr Ergebnis steht im Wert, ihre Rechnung in der Formel.
   */
  function zelleBeschreiben(wert, formel, text, typ) {
    var f = typeof formel === "string" && formel.charAt(0) === "=" ? formel : null;
    var t = typeof text === "string" ? text : (wert === null || wert === undefined ? "" : String(wert));
    var art;
    if (typ === "Empty" || ((wert === "" || wert === null || wert === undefined) && !f && t === "")) {
      art = "leer";
    } else if (typ === "Error" || (typeof wert === "string" && /^#[A-Z0-9\/!?]+[!?]?$/.test(wert) && typ !== "String")) {
      art = "fehler";
    } else if (typ === "Double" || typ === "Integer" || typeof wert === "number") {
      art = "zahl";
    } else if (typ === "Boolean" || typeof wert === "boolean") {
      art = "wahrheitswert";
    } else {
      art = "text";
    }
    return { wert: wert, formel: f, text: t, art: art };
  }

  /**
   * Ein gelesener Bereich als schlichte Daten: Adresse, Matrizen, Masse. `roh` hat die Felder, die
   * das Fenster aus Office lädt (address, values, formulas, text, valueTypes, rowCount, columnCount,
   * cellCount) — im Test eine Attrappe.
   */
  function excelBereich(roh, gesamtZellen) {
    var zerlegt = adresseZerlegen(roh.address);
    var werte = Array.isArray(roh.values) ? roh.values : [];
    var formeln = Array.isArray(roh.formulas) ? roh.formulas : [];
    var texte = Array.isArray(roh.text) ? roh.text : [];
    var typen = Array.isArray(roh.valueTypes) ? roh.valueTypes : [];
    var zellen = [];
    for (var r = 0; r < werte.length; r += 1) {
      for (var c = 0; c < (werte[r] || []).length; c += 1) {
        var z = zelleBeschreiben(
          werte[r][c],
          formeln[r] ? formeln[r][c] : null,
          texte[r] ? texte[r][c] : undefined,
          typen[r] ? typen[r][c] : undefined
        );
        z.adresse = zerlegt ? zellAdresse(zerlegt.startSpalte + c, zerlegt.startZeile + r) : "";
        z.zeile = r;
        z.spalte = c;
        zellen.push(z);
      }
    }
    var gelesen = zellen.length;
    var gesamt = typeof gesamtZellen === "number" ? gesamtZellen : (typeof roh.cellCount === "number" ? roh.cellCount : gelesen);
    return {
      adresse: roh.address || "",
      zerlegt: zerlegt,
      zeilen: typeof roh.rowCount === "number" ? roh.rowCount : werte.length,
      spalten: typeof roh.columnCount === "number" ? roh.columnCount : (werte[0] || []).length,
      zellenGesamt: gesamt,
      zellenGelesen: gelesen,
      gekuerzt: gesamt > gelesen,
      zellen: zellen,
      werte: werte,
      formeln: formeln,
    };
  }

  /**
   * Bewertet die ganze Auswahl. Zustände:
   *   leer       — nichts markiert oder nur leere Zellen
   *   ok         — ein zusammenhängender Bereich, vollständig gelesen
   *   mehrteilig — mehrere Bereiche (Strg/⌘-Auswahl); Kontext ja, Summe nein
   *   zuGross    — mehr Zellen, als Klara liest; Kontext begrenzt, Summe nein
   */
  function excelAuswahlBewerten(bereiche, grenzen) {
    var g = grenzen || GRENZEN;
    var liste = Array.isArray(bereiche) ? bereiche : [];
    var gesamt = 0;
    var gefuellt = 0;
    var gekuerzt = false;
    for (var i = 0; i < liste.length; i += 1) {
      gesamt += liste[i].zellenGesamt;
      gekuerzt = gekuerzt || liste[i].gekuerzt;
      for (var j = 0; j < liste[i].zellen.length; j += 1) {
        if (liste[i].zellen[j].art !== "leer") { gefuellt += 1; }
      }
    }
    var hinweise = [];
    var zustand;
    if (liste.length === 0 || gefuellt === 0) {
      zustand = "leer";
      hinweise.push("Die Auswahl ist leer. Markiere die Zellen, um die es geht – zum Beispiel eine Spalte mit Beträgen.");
    } else if (liste.length > 1) {
      zustand = "mehrteilig";
      hinweise.push("Mehrere Bereiche markiert (" + liste.length + "). Klara liest sie getrennt; Summe einfügen geht nur bei einem zusammenhängenden Bereich.");
    } else if (gekuerzt || gesamt > g.maxZellen) {
      zustand = "zuGross";
      hinweise.push("Die Auswahl hat " + gesamt + " Zellen. Klara liest nur die ersten " + g.maxZellen + " und sagt das in der Frage dazu.");
    } else {
      zustand = "ok";
    }
    if (liste.length > g.maxBereiche) {
      hinweise.push("Nur die ersten " + g.maxBereiche + " Bereiche werden gelesen.");
    }
    return { zustand: zustand, zellenGesamt: gesamt, zellenGefuellt: gefuellt, bereiche: liste.length, hinweise: hinweise };
  }

  function kuerzen(text, max) {
    var t = String(text);
    return t.length > max ? t.slice(0, max - 1) + "…" : t;
  }

  function wertAlsText(wert) {
    if (wert === null || wert === undefined) { return ""; }
    if (typeof wert === "number") { return String(wert); }
    if (typeof wert === "boolean") { return wert ? "WAHR" : "FALSCH"; }
    return String(wert);
  }

  /**
   * Der Kontexttext, der als `selection` an den Klara-Sitzungsweg geht. Jede Zelle steht mit
   * angezeigtem Text, gespeichertem Wert und Formel in eigenen Spalten — eine Zahl im Format
   * „1.200 €" und ihr Wert 1200 bleiben unterscheidbar. Leere Zellen werden gezählt, nicht gelistet.
   * Die Länge ist hart begrenzt; was fehlt, steht als Satz am Ende.
   */
  function excelKontextText(kontext, grenzen) {
    var g = grenzen || GRENZEN;
    var zeilen = [];
    zeilen.push("Excel-Kontext (aus der geöffneten Arbeitsmappe gelesen; Klara hat nichts verändert)");
    zeilen.push("Arbeitsmappe: " + (kontext.mappe || "(ungespeichert)"));
    zeilen.push("Blatt: " + (kontext.blatt || "?"));
    var bewertung = kontext.bewertung || excelAuswahlBewerten(kontext.bereiche, g);
    zeilen.push("Auswahl: " + kontext.bereiche.map(function (b) { return b.adresse; }).join(", ") +
      " (" + bewertung.zellenGesamt + " Zellen, davon " + bewertung.zellenGefuellt + " gefüllt gelesen)");
    zeilen.push("Spalten je Zelle: Adresse | angezeigt | Wert | Formel");
    var kopf = zeilen.join("\n");
    var rumpf = [];
    var laenge = kopf.length;
    var weggelassen = 0;
    var bereiche = kontext.bereiche.slice(0, g.maxBereiche);
    for (var i = 0; i < bereiche.length; i += 1) {
      var b = bereiche[i];
      var titel = "Bereich " + b.adresse + " (" + b.zeilen + " × " + b.spalten + ")";
      if (laenge + titel.length + 1 > g.maxKontextZeichen) { weggelassen += b.zellen.length; continue; }
      rumpf.push(titel);
      laenge += titel.length + 1;
      for (var j = 0; j < b.zellen.length; j += 1) {
        var z = b.zellen[j];
        if (z.art === "leer") { continue; }
        var zeile = z.adresse + " | " + kuerzen(z.text, g.maxZellText) + " | " +
          kuerzen(wertAlsText(z.wert), g.maxZellText) + " | " + (z.formel ? kuerzen(z.formel, g.maxZellText) : "–");
        if (laenge + zeile.length + 1 > g.maxKontextZeichen) { weggelassen += 1; continue; }
        rumpf.push(zeile);
        laenge += zeile.length + 1;
      }
    }
    for (var k = g.maxBereiche; k < kontext.bereiche.length; k += 1) { weggelassen += kontext.bereiche[k].zellen.length; }
    var schluss = [];
    if (bewertung.zustand === "zuGross") {
      schluss.push("Hinweis: Die Auswahl ist grösser; gelesen wurden nur die ersten " + g.maxZellen + " Zellen.");
    }
    if (weggelassen > 0) {
      schluss.push("Hinweis: " + weggelassen + " weitere Zellen passen nicht in den Kontext und wurden nicht übermittelt.");
    }
    return [kopf].concat(rumpf, schluss).join("\n");
  }

  function html(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /**
   * Der Rumpf eines Wissens-Entwurfs aus einer Excel-Auswahl (R-0187, package:excel): je Bereich
   * eine Tabelle mit dem ANGEZEIGTEN Text (Zahlen behalten Format und Einheit), davor die Herkunft
   * (Arbeitsmappe, Blatt, Bereich). Formeln stehen darunter je Zelle, damit Rechenwege sichtbar
   * bleiben. Ein Entwurf ist noch keine geprüfte Quelle — das sagt das Fenster beim Senden.
   */
  function excelTabelleHtml(kontext) {
    var teile = ["<p>Herkunft: Excel-Arbeitsmappe „" + html(kontext.mappe || "ungespeichert") + "“, Blatt „" +
      html(kontext.blatt || "?") + "“, Bereich " + html(kontext.bereiche.map(function (b) { return b.adresse; }).join(", ")) + ".</p>"];
    for (var i = 0; i < kontext.bereiche.length && i < GRENZEN.maxBereiche; i += 1) {
      var b = kontext.bereiche[i];
      var zeilen = {};
      var formeln = [];
      for (var j = 0; j < b.zellen.length; j += 1) {
        var z = b.zellen[j];
        (zeilen[z.zeile] = zeilen[z.zeile] || [])[z.spalte] = z.text;
        if (z.formel) { formeln.push(html(z.adresse) + ": " + html(z.formel)); }
      }
      var rumpf = [];
      for (var r in zeilen) {
        if (Object.prototype.hasOwnProperty.call(zeilen, r)) {
          var zellen = [];
          for (var c = 0; c < zeilen[r].length; c += 1) { zellen.push("<td>" + html(zeilen[r][c] || "") + "</td>"); }
          rumpf.push("<tr>" + zellen.join("") + "</tr>");
        }
      }
      teile.push("<table>" + rumpf.join("") + "</table>");
      if (formeln.length > 0) { teile.push("<p>Formeln: " + formeln.join("; ") + "</p>"); }
      if (b.gekuerzt) { teile.push("<p>Gekürzt: gelesen " + b.zellenGelesen + " von " + b.zellenGesamt + " Zellen.</p>"); }
    }
    return teile.join("");
  }

  /**
   * Klaras EIGENE Nachrechnung — deterministisch, im Fenster, ohne Modell: Anzahl, Summe, Minimum,
   * Maximum der Zahlenwerte (gespeicherte Werte, nicht der angezeigte Text). Sie ist die Gegenprobe
   * zu Excels Ergebnis nach einer Summenformel; eine Modellantwort wird damit NICHT „bestätigt".
   */
  function zahlenNachrechnen(bereiche) {
    var anzahl = 0;
    var summe = 0;
    var min = null;
    var max = null;
    var nichtZahlen = 0;
    for (var i = 0; i < (bereiche || []).length; i += 1) {
      var zellen = bereiche[i].zellen;
      for (var j = 0; j < zellen.length; j += 1) {
        var z = zellen[j];
        if (z.art === "zahl" && typeof z.wert === "number" && isFinite(z.wert)) {
          anzahl += 1;
          summe += z.wert;
          min = min === null ? z.wert : Math.min(min, z.wert);
          max = max === null ? z.wert : Math.max(max, z.wert);
        } else if (z.art !== "leer") {
          nichtZahlen += 1;
        }
      }
    }
    return { anzahl: anzahl, summe: runden(summe), min: min, max: max, nichtZahlen: nichtZahlen };
  }

  function runden(x) { return Math.round(x * 1e10) / 1e10; }

  /**
   * Die unterstützte Excel-Änderung „Summe einfügen": eine SUM-Formel direkt unter einer
   * zusammenhängenden, einspaltigen Zahlenauswahl. Excel rechnet; Klara vergleicht danach Excels
   * Ergebnis mit ihrer Nachrechnung. Formeln über `Range.formulas` sind in Excel-JS englisch (SUM).
   */
  function summenPlan(kontext) {
    var bewertung = kontext.bewertung || excelAuswahlBewerten(kontext.bereiche);
    if (bewertung.zustand !== "ok") {
      return { ok: false, grund: "auswahl-" + bewertung.zustand };
    }
    var b = kontext.bereiche[0];
    if (!b.zerlegt || b.zerlegt.startSpalte !== b.zerlegt.endSpalte) {
      return { ok: false, grund: "keineEinzelspalte" };
    }
    var rechnung = zahlenNachrechnen([b]);
    if (rechnung.anzahl === 0) { return { ok: false, grund: "keineZahlen" }; }
    if (rechnung.nichtZahlen > 0) { return { ok: false, grund: "textInSpalte" }; }
    if (b.zerlegt.endZeile >= MAX_ZEILE) { return { ok: false, grund: "keinPlatzDarunter" }; }
    var quelle = lokaleAdresse(b.zerlegt);
    return {
      ok: true,
      art: "summenformel",
      quelleAdresse: quelle,
      zielAdresse: zellAdresse(b.zerlegt.startSpalte, b.zerlegt.endZeile + 1),
      inhalt: "=SUM(" + quelle + ")",
      erwartet: rechnung.summe,
    };
  }

  /** Die Zelle direkt unter der ersten Spalte der Auswahl — Vorschlag für „Antwort in Zelle". */
  function zielVorschlag(kontext) {
    var b = kontext && kontext.bereiche && kontext.bereiche[0];
    if (!b || !b.zerlegt || b.zerlegt.endZeile >= MAX_ZEILE) { return ""; }
    return zellAdresse(b.zerlegt.startSpalte, b.zerlegt.endZeile + 1);
  }

  /**
   * Text, der in eine Zelle geschrieben wird, bleibt Text: ein führendes =, +, - oder @ würde Excel
   * sonst als Formel lesen. Ein Apostroph davor ist Excels eigener Weg, Text zu erzwingen.
   * Excel fasst höchstens 32 767 Zeichen je Zelle.
   */
  function zellTextSicher(text) {
    var t = String(text === null || text === undefined ? "" : text).replace(/\r\n/g, "\n");
    if (/^[=+\-@]/.test(t)) { t = "'" + t; }
    return t.length > 32767 ? t.slice(0, 32767) : t;
  }

  /** Vergleicht Excels Ergebnis mit der Nachrechnung (relative Toleranz für Gleitkomma). */
  function ergebnisVergleichen(erwartet, gelesen) {
    if (typeof gelesen !== "number" || !isFinite(gelesen)) {
      return { gleich: false, erwartet: erwartet, gelesen: gelesen };
    }
    var diff = Math.abs(gelesen - erwartet);
    var skala = Math.max(1, Math.abs(erwartet));
    return { gleich: diff <= 1e-9 * skala, erwartet: erwartet, gelesen: gelesen };
  }

  /**
   * Ein stabiler Abdruck (FNV-1a, 32 Bit) über beliebige JSON-Daten. Er erkennt, ob sich Quelle
   * oder Ziel seit dem Lesen geändert haben — durch eigene Bearbeitung, Koautoren oder einen
   * anderen Weg. Er ist KEIN Sicherheitsmerkmal.
   */
  function abdruck(daten) {
    var s = JSON.stringify(daten === undefined ? null : daten);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  function matrixLeer(m) {
    if (!Array.isArray(m)) { return true; }
    for (var r = 0; r < m.length; r += 1) {
      for (var c = 0; c < (m[r] || []).length; c += 1) {
        var v = m[r][c];
        if (!(v === "" || v === null || v === undefined)) { return false; }
      }
    }
    return true;
  }

  /**
   * DIE ZIELPRÜFUNG VOR JEDER EXCEL-RÜCKGABE (KO-04-03, KO-04-06). `plan` entsteht beim Vorbereiten,
   * `lage` wird UNMITTELBAR vor dem Schreiben frisch aus Excel gelesen. Jede Abweichung verhindert
   * das Schreiben — mit einem benannten Grund, nie still.
   */
  function excelZielPruefen(plan, lage) {
    if (!plan || RUECKGABE_ARTEN.excel.indexOf(plan.art) < 0) { return nein("artNichtErlaubt"); }
    if (!istEinzelzelle(plan.zielAdresse)) { return nein("zielUngueltig"); }
    if (lage.jetztMs - plan.erstelltMs > GRENZEN.planGueltigMs) { return nein("planVeraltet"); }
    if (lage.dokument !== plan.dokument) { return nein("dokumentGewechselt"); }
    if (lage.blatt !== plan.blatt) { return nein("blattGewechselt"); }
    if (lage.modus === "readOnly") { return nein("nurLesen"); }
    if (lage.blattGeschuetzt === true) { return nein("blattGeschuetzt"); }
    if (plan.quelleAbdruck && lage.quelleAbdruck !== plan.quelleAbdruck) { return nein("quelleGeaendert"); }
    if (!matrixLeer(lage.zielFormeln) && plan.ueberschreibenBestaetigt !== true) { return nein("zielBelegt"); }
    if (plan.zielAbdruck && lage.zielAbdruck !== plan.zielAbdruck) { return nein("zielGeaendert"); }
    return { ok: true, grund: null };
  }

  function nein(grund) { return { ok: false, grund: grund }; }

  // ----------------------------------------------------------------------------------------------
  // POWERPOINT (KO-04-04, KO-04-05)
  // ----------------------------------------------------------------------------------------------

  function istTextform(typ) { return PPT_TEXTFORMEN.indexOf(typ) >= 0; }

  /**
   * Bewertet die PowerPoint-Lage. `lage`: { ansicht: "edit"|"read"|null, modus, folien: [{id,
   * nummer}], formen: [{id, name, typ, text}], textAuswahl, api }. Zustände mit Ausweg:
   *   leseansicht, nurLesen, keineAuswahl, folie, form, formOhneText, mehrereFormen, nurText.
   */
  function pptLageBewerten(lage) {
    var l = lage || {};
    var folien = Array.isArray(l.folien) ? l.folien : [];
    var formen = Array.isArray(l.formen) ? l.formen : [];
    var text = typeof l.textAuswahl === "string" ? l.textAuswahl : "";
    var api = l.api || { faehigkeiten: {} };
    if (l.ansicht === "read") {
      return ppt("leseansicht", false, "Die Präsentation ist in der Lese- oder Präsentationsansicht. Wechsle über „Ansicht › Normal“ (Web: „Bearbeiten“) in die Bearbeitung; dann sieht Klara Folien und Formen.");
    }
    if (l.modus === "readOnly") {
      return ppt("nurLesen", false, "Die Datei ist nur zum Lesen geöffnet. Öffne sie zum Bearbeiten; Klara kann sie dann lesen und gezielt ändern.");
    }
    if (!api.faehigkeiten.auswahl) {
      if (text.length > 0) {
        return ppt("nurText", false, "Diese PowerPoint-Fassung meldet PowerPointApi 1.5 nicht. Klara liest den markierten Text, kann ihn aber nicht gezielt zurückschreiben.");
      }
      return ppt("keineAuswahl", false, "Diese PowerPoint-Fassung meldet PowerPointApi 1.5 nicht. Markiere Text in einem Textfeld; Folien und Formen kann Klara hier nicht auswählen.");
    }
    if (formen.length > 1) {
      return ppt("mehrereFormen", false, "Mehrere Formen markiert. Klara liest sie alle; zum Zurückschreiben markiere genau ein Textfeld.");
    }
    if (formen.length === 1) {
      if (!istTextform(formen[0].typ)) {
        return ppt("formOhneText", false, "Markiert ist „" + (formen[0].name || formen[0].typ) + "“ (" + formen[0].typ + "). Bilder, Diagramme und Grafiken ändert Klara nicht – markiere ein Textfeld.");
      }
      return ppt("form", api.faehigkeiten.formTextSchreiben === true,
        api.faehigkeiten.formTextSchreiben ? "" : "Lesen geht; zum Zurückschreiben fehlt PowerPointApi 1.4.");
    }
    if (folien.length > 0) {
      return ppt("folie", false, "Klara liest die Textfelder der markierten Folie. Zum Zurückschreiben markiere auf der Folie genau ein Textfeld.");
    }
    return ppt("keineAuswahl", false, "Nichts markiert. Klicke links eine Folie an oder markiere auf der Folie ein Textfeld.");
  }

  function ppt(zustand, rueckgabe, ausweg) { return { zustand: zustand, rueckgabeMoeglich: rueckgabe, ausweg: ausweg }; }

  /** Der Kontexttext einer PowerPoint-Lage — begrenzt, mit Folie und Form je Textstelle. */
  function pptKontextText(kontext, grenzen) {
    var g = grenzen || GRENZEN;
    var zeilen = [];
    zeilen.push("PowerPoint-Kontext (aus der geöffneten Präsentation gelesen; Klara hat nichts verändert)");
    zeilen.push("Präsentation: " + (kontext.praesentation || "(ungespeichert)"));
    if (kontext.folien && kontext.folien.length) {
      zeilen.push("Folie: " + kontext.folien.map(function (f) { return f.nummer ? "Nr. " + f.nummer : f.id; }).join(", "));
    }
    var laenge = zeilen.join("\n").length;
    var weggelassen = 0;
    var formen = (kontext.formen || []).slice(0, g.maxFormen);
    for (var i = 0; i < formen.length; i += 1) {
      var f = formen[i];
      if (!istTextform(f.typ) || typeof f.text !== "string" || f.text.trim().length === 0) { continue; }
      var zeile = "Form „" + (f.name || f.id) + "“ (" + f.typ + "): " + kuerzen(f.text.replace(/\s+/g, " ").trim(), g.maxFormText);
      if (laenge + zeile.length + 1 > g.maxKontextZeichen) { weggelassen += 1; continue; }
      zeilen.push(zeile);
      laenge += zeile.length + 1;
    }
    if ((kontext.formen || []).length > g.maxFormen) { weggelassen += kontext.formen.length - g.maxFormen; }
    if (kontext.textAuswahl && formen.length === 0) {
      zeilen.push("Markierter Text: " + kuerzen(kontext.textAuswahl, Math.max(20, g.maxKontextZeichen - laenge - 20)));
    }
    if (weggelassen > 0) { zeilen.push("Hinweis: " + weggelassen + " weitere Formen wurden nicht übermittelt."); }
    return zeilen.join("\n");
  }

  /** DIE ZIELPRÜFUNG VOR JEDER POWERPOINT-RÜCKGABE (KO-04-05, KO-04-06). */
  function pptZielPruefen(plan, lage) {
    if (!plan || RUECKGABE_ARTEN.powerpoint.indexOf(plan.art) < 0) { return nein("artNichtErlaubt"); }
    if (lage.jetztMs - plan.erstelltMs > GRENZEN.planGueltigMs) { return nein("planVeraltet"); }
    if (lage.dokument !== plan.dokument) { return nein("dokumentGewechselt"); }
    if (lage.ansicht === "read") { return nein("leseansicht"); }
    if (lage.modus === "readOnly") { return nein("nurLesen"); }
    if (!lage.folieVorhanden) { return nein("folieFehlt"); }
    if (!lage.formVorhanden) { return nein("formFehlt"); }
    if (!istTextform(lage.formTyp)) { return nein("keinTextfeld"); }
    if (abdruck(lage.formText) !== plan.zielAbdruck) { return nein("zielGeaendert"); }
    return { ok: true, grund: null };
  }

  /** Ist diese Rückgabeart für diesen Host erlaubt? Alles andere — insbesondere Bilder — nein. */
  function rueckgabeErlaubt(host, art) {
    return Object.prototype.hasOwnProperty.call(RUECKGABE_ARTEN, host) && RUECKGABE_ARTEN[host].indexOf(art) >= 0;
  }

  // ----------------------------------------------------------------------------------------------
  // DIE KONTEXTZEILE FÜR DIE GEMEINSAME BEGLEITFIGUR (KO-04-06)
  // ----------------------------------------------------------------------------------------------

  /**
   * Eine Zeile, die sagt, was Klara GERADE sieht — Host, Datei, Blatt/Folie, Bereich/Form. Sie wird
   * bei jedem Lesen neu gebildet, also auch nach einem Host- oder Dokumentwechsel.
   */
  function kontextZeile(host, kontext) {
    if (!kontext) { return host === "excel" ? "Excel · noch nichts gelesen" : host === "powerpoint" ? "PowerPoint · noch nichts gelesen" : "Kein Office-Kontext"; }
    if (host === "excel") {
      var auswahl = (kontext.bereiche || []).map(function (b) { return lokaleAdresse(b.zerlegt || { startSpalte: 1, endSpalte: 1, startZeile: 1, endZeile: 1 }); }).join(", ");
      return ["Excel", kontext.mappe || "ungespeichert", kontext.blatt || "?", auswahl || "keine Auswahl"].join(" · ");
    }
    if (host === "powerpoint") {
      var folie = (kontext.folien || []).map(function (f) { return f.nummer ? "Folie " + f.nummer : "Folie"; }).join(", ");
      var form = (kontext.formen || []).length === 1 ? (kontext.formen[0].name || kontext.formen[0].typ) : ((kontext.formen || []).length > 1 ? kontext.formen.length + " Formen" : "");
      return ["PowerPoint", kontext.praesentation || "ungespeichert", folie || "keine Folie", form].filter(function (t) { return t; }).join(" · ");
    }
    return "Kein Office-Kontext";
  }

  /** Die Gründe der Zielprüfungen als Sätze für den Menschen. */
  var GRUND_SAETZE = {
    artNichtErlaubt: "Diese Änderung unterstützt Klara hier nicht.",
    zielUngueltig: "Das Ziel ist keine einzelne Zelle (Beispiel: D7).",
    planVeraltet: "Die Vorbereitung ist älter als fünf Minuten. Bitte neu vorbereiten.",
    dokumentGewechselt: "Inzwischen ist ein anderes Dokument aktiv. Nichts wurde geschrieben.",
    blattGewechselt: "Inzwischen ist ein anderes Blatt aktiv. Nichts wurde geschrieben.",
    nurLesen: "Die Datei ist nur zum Lesen geöffnet. Nichts wurde geschrieben.",
    blattGeschuetzt: "Das Blatt ist geschützt. Klara hebt keinen Schutz auf; nichts wurde geschrieben.",
    quelleGeaendert: "Die gelesenen Zellen haben sich seitdem geändert (eigene Bearbeitung oder Koautor). Bitte neu lesen.",
    zielBelegt: "Die Zielzelle ist nicht leer. Bestätige das Überschreiben ausdrücklich oder wähle eine leere Zelle.",
    zielGeaendert: "Das Ziel hat sich seit der Vorbereitung geändert. Nichts wurde geschrieben.",
    leseansicht: "PowerPoint ist in der Leseansicht. Nichts wurde geschrieben.",
    folieFehlt: "Die Folie gibt es nicht mehr. Nichts wurde geschrieben.",
    formFehlt: "Die Form gibt es nicht mehr. Nichts wurde geschrieben.",
    keinTextfeld: "Das Ziel ist kein Textfeld. Nichts wurde geschrieben.",
    keineEinzelspalte: "Summe einfügen geht für genau eine Spalte.",
    keineZahlen: "In der Auswahl stehen keine Zahlen.",
    textInSpalte: "In der Spalte steht auch Text. Markiere nur die Zahlen.",
    keinPlatzDarunter: "Unter der Auswahl ist keine Zeile mehr frei.",
    "auswahl-leer": "Die Auswahl ist leer.",
    "auswahl-mehrteilig": "Summe einfügen geht nur für einen zusammenhängenden Bereich.",
    "auswahl-zuGross": "Für die Nachrechnung ist die Auswahl zu groß (höchstens " + GRENZEN.maxZellen + " Zellen).",
  };

  function grundSatz(grund) { return GRUND_SAETZE[grund] || "Nichts wurde geschrieben."; }

  var KlaraOfficeHost = {
    GRENZEN: GRENZEN,
    API: API,
    RUECKGABE_ARTEN: RUECKGABE_ARTEN,
    PPT_TEXTFORMEN: PPT_TEXTFORMEN,
    hostAusOffice: hostAusOffice,
    pruefeApiStufen: pruefeApiStufen,
    fehlendeFaehigkeiten: fehlendeFaehigkeiten,
    plattformAus: plattformAus,
    dokumentName: dokumentName,
    adresseZerlegen: adresseZerlegen,
    lokaleAdresse: lokaleAdresse,
    teilblock: teilblock,
    istEinzelzelle: istEinzelzelle,
    zelleBeschreiben: zelleBeschreiben,
    excelBereich: excelBereich,
    excelAuswahlBewerten: excelAuswahlBewerten,
    excelKontextText: excelKontextText,
    excelTabelleHtml: excelTabelleHtml,
    zahlenNachrechnen: zahlenNachrechnen,
    summenPlan: summenPlan,
    zielVorschlag: zielVorschlag,
    zellTextSicher: zellTextSicher,
    ergebnisVergleichen: ergebnisVergleichen,
    abdruck: abdruck,
    excelZielPruefen: excelZielPruefen,
    istTextform: istTextform,
    pptLageBewerten: pptLageBewerten,
    pptKontextText: pptKontextText,
    pptZielPruefen: pptZielPruefen,
    rueckgabeErlaubt: rueckgabeErlaubt,
    kontextZeile: kontextZeile,
    grundSatz: grundSatz,
  };

  wurzel.KlaraOfficeHost = KlaraOfficeHost;
})(typeof window !== "undefined" ? window : this);

// H: Erhaltene BPA-04-Zielmerkmale für den P06-Wordkanal. Kein eigener Hostzugriff,
// keine Koordinaten und keine Ausweitung der Schreibbefugnis.
"use strict";
    /** FNV-1a ueber den normalisierten Text — Aenderungserkennung, kein Geheimnisschutz. */
    function bpaPruefsumme(text) {
      var s = String(text || "").replace(/\r\n?/g, "\n").replace(/^\s+|\s+$/g, "");
      var h = 0x811c9dc5;
      for (var i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return s.length + ":" + h.toString(16);
    }

    // Nur ein Gleichheitsmerkmal innerhalb DIESES Fensters (beide Seiten der Pruefung lesen es
    // gleich); es behauptet keinen belegten Host.
    function bpaProgramm() {
      var plattform = "";
      try {
        plattform = (Office.context.diagnostics && Office.context.diagnostics.platform) || "";
      } catch (e) { plattform = ""; }
      return plattform === "Mac" ? "word-mac" : "word-web";
    }

    // Office.js nennt kein angemeldetes Microsoft-Konto und keine Dokumentfassung (WordApi 1.1);
    // beide Felder bleiben leer. Das KLARWERK-Konto haengt an der Sitzung.
    function bpaZielAus(sitzung, objekt, auswahlText) {
      return {
        programm: bpaProgramm(),
        sitzung: sitzung || "",
        hostKonto: "",
        objekt: objekt || "",
        auswahl: bpaPruefsumme(auswahlText),
        fassung: "",
      };
    }


// ENDE LERNZIEL

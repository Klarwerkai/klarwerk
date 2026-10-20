// ================================================================================================
// KLARA-OFFICE-01 · DER WORD-ADAPTER DER BEGLEITAPP (Vertrag `klarwerk.office-kontext/1`)
// ================================================================================================
//
// WAS DIESE DATEI IST: der erste anwendungsspezifische Hostadapter für den gemeinsamen
// Office-Kontext (`services/app/src/office-kontext.ts`). `taskpane.html` lädt sie NICHT — der alte
// Word-Rückgabevertrag des Aufgabenfensters bleibt unverändert. Geladen wird sie von der Seite der
// Begleitapp (`begleitung.html`) nach `office.js` als klassisches Skript.
//
// NUR OFFIZIELLE SCHNITTSTELLEN: die Auswahl kommt aus `Word.run` → `context.document
// .getSelection()`, Host und Fassung aus `Office.context.diagnostics`, die Auswahländerung aus
// `Office.EventType.DocumentSelectionChanged`. Die Markierung im Seitenfenster und eigene
// Tutorialanker werden hier NIE gelesen — sie sind keine Dokumentauswahl.
//
// BEGRENZTER KONTEXT: an den Office-Kanal gehen nur Länge und SHA-256 der Auswahl, nie ihr Text.
//
// KEINE AUTORISIERUNG IM CLIENT: ob ein Einfügeziel gilt, entscheidet der Server
// (`…/office-kontext/ziel`). Der Client darf eine Zusage aber auch nur dann übernehmen, wenn sie
// noch zu SEINEM jetzigen Kontext gehört — sonst würde eine verspätete Antwort einen verworfenen
// Bezug wieder aktivieren (Befund Ben, nacharbeit-2).
//
// DIE KONTEXTGENERATION: jeder Kontextwechsel — Auswahländerung im Dokument (auch während einer
// laufenden ERSTEN Meldung), `kontextWechsel()`/`verwerfe()` (Konto, Dokument, Sitzung), eine
// beobachtete Bindungsänderung — erhöht `generation` und löscht Marke und Bezug. Jeder Vorgang hält
// beim Start Generation und eine EINGEFRORENE Kopie der Bindung fest und vergleicht beides nach
// jedem asynchronen Abschnitt, vor dem Senden, vor der Zustandsübernahme und vor der
// Zielbestätigung erneut. Meldungen tragen zusätzlich eine Laufnummer: nur der jüngste Lauf darf
// seinen Ausgang übernehmen. Alte Erfolgs- UND Fehlerantworten verändern keinen neueren Zustand.

((wurzel) => {
  const VERTRAG = "klarwerk.office-kontext/1";
  const VERALTET = { gueltig: false, grund: "kontext_gewechselt", aktion: "aktualisieren" };

  function hex(puffer) {
    return Array.from(new Uint8Array(puffer), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** Eine unveränderliche Kopie der Bindung — ein später in-place geänderter Wert wirkt nicht zurück. */
  function einfrieren(roh) {
    if (!roh?.sessionId || !roh.instanz || !roh.dokument) {
      return null;
    }
    return Object.freeze({
      sessionId: String(roh.sessionId),
      instanz: String(roh.instanz),
      dokument: String(roh.dokument),
    });
  }

  function gleicheBindung(a, b) {
    return (
      a !== null &&
      b !== null &&
      a.sessionId === b.sessionId &&
      a.instanz === b.instanz &&
      a.dokument === b.dokument
    );
  }

  function erstelleWordAdapter(umgebung) {
    const office = umgebung.office;
    const word = umgebung.word;
    const krypto = umgebung.crypto;
    let sequenz = 0;
    let generation = 0;
    let meldeLauf = 0;
    let marke = null;
    let markenSumme = null;
    let bezug = null;
    let zustand = "getrennt";
    let zuletztGesehen = einfrieren(umgebung.bindung());

    function pfad(sessionId, rest) {
      return `/api/klara/sessions/${encodeURIComponent(sessionId)}/office-kontext${rest}`;
    }

    function standardAbruf(ziel, methode, koerper, bindung) {
      const ohneRumpf = koerper === null || koerper === undefined;
      const koepfe = {
        "x-klara-session": bindung.sessionId,
        "x-klara-instance": bindung.instanz,
        "x-klara-document": bindung.dokument,
      };
      // Rumpftyp nur bei tatsächlichem JSON-Rumpf: ein `DELETE` mit `content-type:
      // application/json` und leerem Rumpf weist der Server als leeren JSON-Rumpf ab (400) — dann
      // blieb die Kontextabmeldung aus (KLARA-OFFICE-02, Nacharbeit 9, wie begleitung.js `api`).
      if (!ohneRumpf) {
        koepfe["content-type"] = "application/json";
      }
      return fetch(ziel, {
        method: methode,
        credentials: "include",
        headers: koepfe,
        body: ohneRumpf ? undefined : JSON.stringify(koerper),
      }).then((antwort) =>
        antwort
          .json()
          .catch(() => null)
          .then((json) => ({ status: antwort.status, json })),
      );
    }

    const abruf = umgebung.abruf || standardAbruf;

    /** Kontextwechsel: neue Generation, kein Bezug. `zustand` sagt, warum. */
    function invalidiere(neuerZustand) {
      generation += 1;
      marke = null;
      markenSumme = null;
      bezug = null;
      zustand = neuerZustand;
    }

    /**
     * Liest die Bindung frisch. Hat sie sich gegenüber dem zuletzt Gesehenen geändert, ist das ein
     * Kontextwechsel — auch wenn niemand `kontextWechsel()` gerufen hat. So fängt der Adapter auch
     * A→B→A ab, sobald er B einmal sieht.
     */
    function aktuelleBindung() {
      const jetzt = einfrieren(umgebung.bindung());
      if (!gleicheBindung(jetzt, zuletztGesehen) && (jetzt !== null || zuletztGesehen !== null)) {
        const vorher = zuletztGesehen;
        zuletztGesehen = jetzt;
        invalidiere(jetzt === null || vorher === null ? "getrennt" : "veraltet");
      }
      return jetzt;
    }

    /** Gilt ein Vorgang, der mit `gen` und `bindung` begann, noch? */
    function nochGueltig(gen, bindung) {
      const jetzt = aktuelleBindung();
      return gen === generation && gleicheBindung(jetzt, bindung);
    }

    /** Die Dokumentauswahl über die Host-API — der einzige Weg, auf dem hier gelesen wird. */
    function leseAuswahl() {
      return word.run((kontext) => {
        const auswahl = kontext.document.getSelection();
        auswahl.load("text");
        return kontext.sync().then(() => (typeof auswahl.text === "string" ? auswahl.text : ""));
      });
    }

    function pruefsumme(text) {
      return krypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(hex);
    }

    function hostangaben() {
      const diagnose = office?.context?.diagnostics ?? {};
      return {
        anwendung: "word",
        plattform: String(diagnose.platform || "unbekannt"),
        version: String(diagnose.version || "unbekannt"),
      };
    }

    /** Meldet die aktuelle Auswahl. Ergebnis: der Office-Bezug oder `null` (Zustand sagt warum). */
    function melde() {
      const bindung = aktuelleBindung();
      if (bindung === null) {
        invalidiere("getrennt");
        return Promise.resolve(null);
      }
      const gen = generation;
      meldeLauf += 1;
      const lauf = meldeLauf;
      // Nur der jüngste Lauf in derselben Generation mit derselben Bindung darf übernehmen.
      const darf = () => lauf === meldeLauf && nochGueltig(gen, bindung);
      return leseAuswahl()
        .then((text) => (darf() ? pruefsumme(text).then((summe) => ({ text, summe })) : null))
        .then((gelesen) => {
          if (gelesen === null || !darf()) {
            return null;
          }
          const { text, summe } = gelesen;
          sequenz += 1;
          const meldung = {
            vertrag: VERTRAG,
            host: hostangaben(),
            objekt: { art: "dokument" },
            auswahl: {
              quelle: "host-api",
              art: text.length > 0 ? "text" : "leer",
              laenge: text.length,
              pruefsumme: summe,
            },
            sequenz,
          };
          return abruf(pfad(bindung.sessionId, ""), "POST", meldung, bindung).then((antwort) => ({
            antwort,
            summe,
          }));
        })
        .then((ergebnis) => {
          if (ergebnis === null || !darf()) {
            return null;
          }
          const { antwort, summe } = ergebnis;
          if (antwort.status !== 200 || !antwort.json?.marke) {
            invalidiere("getrennt");
            return null;
          }
          marke = antwort.json.marke;
          markenSumme = summe;
          bezug = antwort.json.bezug;
          zustand = "aktiv";
          return bezug;
        })
        .catch(() => {
          if (darf()) {
            invalidiere("getrennt");
          }
          return null;
        });
    }

    /**
     * Fragt den Server, ob die JETZIGE Auswahl noch das gemeldete Einfügeziel ist. Eine Zusage zählt
     * nur, wenn danach Generation, Bindung und Marke noch dieselben sind.
     */
    function pruefeZiel() {
      const bindung = aktuelleBindung();
      if (!marke || bindung === null) {
        return Promise.resolve({ gueltig: false, grund: "keine_marke", aktion: "aktualisieren" });
      }
      const gen = generation;
      const gemerkt = marke;
      const darf = () => nochGueltig(gen, bindung) && marke === gemerkt;
      return leseAuswahl()
        .then((text) => (darf() ? pruefsumme(text) : null))
        .then((summe) => {
          if (summe === null || !darf()) {
            return null;
          }
          return abruf(
            pfad(bindung.sessionId, "/ziel"),
            "POST",
            { marke: gemerkt, ziel: { pruefsumme: summe } },
            bindung,
          );
        })
        .then((antwort) => {
          if (antwort === null || !darf()) {
            return VERALTET;
          }
          const json = antwort.json || {};
          if (antwort.status === 200 && json.gueltig === true) {
            return json;
          }
          invalidiere(json.aktion === "aktualisieren" ? "veraltet" : "getrennt");
          return {
            gueltig: false,
            grund: json.grund || `status_${antwort.status}`,
            aktion: json.aktion || "verwerfen",
          };
        })
        .catch(() => {
          if (!darf()) {
            return VERALTET;
          }
          invalidiere("getrennt");
          return { gueltig: false, grund: "nicht_erreichbar", aktion: "verwerfen" };
        });
    }

    /**
     * Fügt `text` an der Auswahl ein (dieselbe Stelle wie das Aufgabenfenster:
     * `Word.InsertLocation.replace`). NUR nach dem zweiten Klick des Menschen aufrufen. Davor:
     * Zielprüfung am Server; im selben `Word.run` noch einmal die Auswahl gegen die gemeldete
     * Prüfsumme, damit zwischen Zusage und Schreiben nichts verrutscht.
     *
     * `ort`: `"Replace"` (Vorgabe, Begleitseite wie Aufgabenfenster) oder `"After"` — so verlangt es
     * der Vertrag der nativen Figur im Begleiterkanal („hinter den bestätigten Bereich").
     */
    function fuegeEin(text, ort) {
      const stelle = ort === "After" ? "After" : "Replace";
      return pruefeZiel().then((ziel) => {
        if (ziel.gueltig !== true) {
          return ziel;
        }
        const bindung = aktuelleBindung();
        const gen = generation;
        const summeVorher = markenSumme;
        return word
          .run((kontext) => {
            const auswahl = kontext.document.getSelection();
            auswahl.load("text");
            return kontext
              .sync()
              .then(() => pruefsumme(typeof auswahl.text === "string" ? auswahl.text : ""))
              .then((summe) => {
                if (!nochGueltig(gen, bindung) || summe !== summeVorher) {
                  return false;
                }
                auswahl.insertText(String(text), stelle);
                return kontext.sync().then(() => true);
              });
          })
          .then((geschrieben) => {
            if (!geschrieben) {
              return VERALTET;
            }
            // Das Dokument hat sich geändert: der Bezug gilt nicht mehr.
            invalidiere("veraltet");
            return { gueltig: true, eingefuegt: true };
          })
          .catch(() => ({
            gueltig: false,
            grund: "einfuegen_fehlgeschlagen",
            aktion: "verwerfen",
          }));
      });
    }

    /** Den Auswahltext NUR für einen ausdrücklichen Nutzerschritt (Mitsenden über den Antwortweg). */
    function auswahlText() {
      return leseAuswahl();
    }

    /** Jede Auswahländerung invalidiert — auch im getrennten Zustand und während einer Meldung. */
    function beobachte() {
      office.context.document.addHandlerAsync(office.EventType.DocumentSelectionChanged, () => {
        invalidiere(zustand === "getrennt" ? "getrennt" : "veraltet");
      });
    }

    /** Vom Host gemeldeter Konto-, Dokument- oder Sitzungswechsel. */
    function kontextWechsel() {
      zuletztGesehen = einfrieren(umgebung.bindung());
      invalidiere("getrennt");
    }

    /** Konto-, Dokument- oder Sitzungswechsel: der Bezug wird verworfen, nicht übertragen. */
    function verwerfe() {
      const bindung = einfrieren(umgebung.bindung());
      kontextWechsel();
      if (bindung !== null) {
        return abruf(pfad(bindung.sessionId, ""), "DELETE", null, bindung).catch(() => null);
      }
      return Promise.resolve(null);
    }

    return {
      vertrag: VERTRAG,
      melde,
      pruefeZiel,
      fuegeEin,
      auswahlText,
      beobachte,
      kontextWechsel,
      verwerfe,
      zustand: () => zustand,
      marke: () => marke,
      bezug: () => bezug,
    };
  }

  wurzel.KlarwerkOfficeHostWord = { VERTRAG, erstelleWordAdapter };
})(typeof self !== "undefined" ? self : globalThis);

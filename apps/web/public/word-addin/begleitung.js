// ================================================================================================
// KLARA-OFFICE-01 · DIE BEGLEITAPP-SEITE IN WORD (`begleitung.html`)
// ================================================================================================
//
// DER GEMEINSAME EINSTIEG: sichtbarer Arbeitskontext, Fragen und bewusstes Verwenden im selben
// Dokument — über VORHANDENE Dienste, ohne zweite Verwaltung:
//   · Anmeldung: dieselbe Sitzung wie die Anwendung (`/api/auth/me`), in Word über den
//     vorhandenen Übergabeweg (`anmeldung.html` → `messageParent` → `/api/auth/office-handover/redeem`).
//   · Sitzung/Dokument/Zustimmung: `/api/klara/sessions` samt Rebind und Zustimmung.
//   · Fragen: Klaras vorhandener Ausführungszugang `POST /api/klara/sessions/:id/execute` — dort
//     wirken Sitzungstor, Zustimmung, Dokumenttext-Riegel und Vertraulichkeit unverändert.
//   · Office-Kontext und Einfügeziel: der Word-Adapter (`office-host-word.js`) und der enge Kanal.
// Der alte Word-Rückgabevertrag des Aufgabenfensters bleibt unberührt: `taskpane.html` lädt keine
// dieser Dateien.
//
// ZWEI GENERATIONEN (Nacharbeit 4, Befunde Ben begleitung.js:233/309):
//   · `bindungsGen` — Konto, Sitzung, Dokument. Erhöht bei Kontowechsel, Abmelden und JEDEM
//     erkannten Dokumentwechsel, und zwar VOR dem asynchronen Rebind bzw. Sitzungsstart.
//   · `auswahlGen` — die Auswahl im Dokument. Erhöht SOFORT bei jeder Auswahländerung, nicht erst
//     nach der verzögerten Neumeldung.
// Frage, Antwort und Einfügebestätigung tragen beide Generationen UND die Office-Marke des Bezugs,
// zu dem gefragt wurde. Jeder Wechsel verwirft Antwort und offene Bestätigung sofort; vor der
// Antwortübernahme und vor dem Einfügen wird erneut verglichen. Verspätete Abschlüsse (Antwort,
// Rebind, Sitzungsstart) ändern keinen neueren Zustand.
//
// DOKUMENTIDENTITÄT: verglichen wird der VOLLSTÄNDIGE gebundene Beschreiber (Art und Adresse bzw.
// Einmalwert) — gespeichert-A → gespeichert-B ist ein Wechsel wie ungespeichert → gespeichert.
//
// DARSTELLUNG: nur `textContent` über `zeige`/`sichtbar` — kein HTML aus Antworten. Angezeigt wird
// der Name des GEBUNDENEN Dokuments und sein Stand, soweit Word ihn meldet; fehlt er, steht das da.
// Word-Version und Nummer der Kontextmeldung stehen getrennt davon.

((wurzel) => {
  const UEBERGABE_ART = "kw-office-handover";

  function gleicherBeschreiber(a, b) {
    return (
      a !== null &&
      b !== null &&
      a.kind === b.kind &&
      a.canonicalUrl === b.canonicalUrl &&
      a.clientDocumentNonce === b.clientDocumentNonce
    );
  }

  /** Der lesbare Name eines Beschreibers — nie die ganze Adresse. */
  function dokumentname(b) {
    if (!b || b.kind !== "saved") {
      return "Ungespeichertes Dokument";
    }
    const ohneAnhang = String(b.canonicalUrl).split(/[?#]/)[0] ?? "";
    const teil = ohneAnhang.split(/[/\\]/).filter(Boolean).pop() ?? "";
    try {
      return decodeURIComponent(teil) || "Dokument ohne Namen";
    } catch {
      return teil || "Dokument ohne Namen";
    }
  }

  /** Steuerzeichen werden zu Leerzeichen (Länge bleibt); Umbrüche/Tabulator nur, wo erlaubt. */
  function ohneSteuerzeichen(text, umbruecheErlaubt) {
    let ergebnis = "";
    for (const zeichen of String(text)) {
      const n = zeichen.charCodeAt(0);
      const erlaubt = n >= 32 ? n !== 127 : umbruecheErlaubt && (n === 9 || n === 10 || n === 13);
      ergebnis += erlaubt ? zeichen : " ";
    }
    return ergebnis;
  }

  function hexAus(puffer) {
    return Array.from(new Uint8Array(puffer), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function erstelle(umgebung) {
    const office = umgebung.office;
    const word = umgebung.word;
    let letzterHinweis = "";
    const zeige = (feld, text) => {
      if (feld === "hinweis") {
        letzterHinweis = text;
      }
      umgebung.zeige(feld, text);
    };
    const sichtbar = umgebung.sichtbar;
    const abrufen = umgebung.fetch;
    const neueId = umgebung.neueId;
    let schluessel = null;
    let konto = null;
    let sitzung = null;
    let gebundenerBeschreiber = null;
    let dokumentStand = null;
    let adapter = null;
    let antwort = null;
    let bestaetigung = null;
    let wartet = null;
    let frageController = null;
    let frageEpoch = 0;
    let bindungsGen = 0;
    let auswahlGen = 0;
    /** Läuft gerade ein Sitzungsstart oder Rebind der jetzigen Bindungsgeneration? */
    let bindungInArbeit = false;
    /** Laufnummer des Vorgangs, dem die Sperre gehört — nur er darf sie lösen. */
    let bindungsVorgang = 0;
    // Brücke zur nativen Figur (Begleiterkanal) — Zustand siehe Abschnitt „DIE BRÜCKE" unten.
    let begleiterAn = false;
    let begleiterRunde = 0;
    let begleiterInstanz = null;
    let begleiterAngemeldet = false;
    let begleiterSeq = 0;
    let begleiterStand = 0;
    let begleiterAuswahl = null;
    let begleiterErledigt = [];
    let begleiterUnterwegs = null;
    let begleiterLage = "aus";

    /** Die Sperre für einen neuen Vorgang setzen; Rückgabe: dessen Laufnummer. */
    function sperreBindung() {
      bindungsVorgang += 1;
      bindungInArbeit = true;
      return bindungsVorgang;
    }

    /** Gehört der Abschluss noch zum jetzigen Vorgang? Dann die Sperre lösen. */
    function eigenerAbschluss(vorgang, gen, kontoBeiStart) {
      if (vorgang !== bindungsVorgang || gen !== bindungsGen || konto !== kontoBeiStart) {
        return false; // ein neuerer Vorgang oder Wechsel hat übernommen — nichts anfassen
      }
      bindungInArbeit = false;
      return true;
    }

    /** Fehlerausgang eines Starts/Rebinds: getrennt anzeigen, Wiederverbindung bleibt möglich. */
    function bindungFehlgeschlagen(text) {
      sitzung = null;
      gebundenerBeschreiber = null;
      dokumentStand = null;
      adapter?.kontextWechsel();
      zeigeKontext();
      zeige("verbindung", text);
      return false;
    }
    const nonce = neueId("doc");
    const instanz = neueId("inst");

    function kopf(mitSitzung) {
      const k = { "content-type": "application/json" };
      if (schluessel) {
        k.authorization = `Bearer ${schluessel}`;
      }
      if (mitSitzung && sitzung) {
        k["x-klara-session"] = sitzung.sessionId;
        k["x-klara-instance"] = sitzung.instanz;
        k["x-klara-document"] = sitzung.dokument;
      }
      return k;
    }

    function bindungsKopf(s) {
      return {
        "x-klara-session": s.sessionId,
        "x-klara-instance": s.instanz,
        "x-klara-document": s.dokument,
      };
    }

    function api(pfad, methode, koerper, mitSitzung, extraKopf, signal) {
      const ohneRumpf = koerper === null || koerper === undefined;
      // KLARA-OFFICE-02 (Nacharbeit 6): ohne Rumpf auch kein Rumpftyp. Ein `DELETE` mit
      // `content-type: application/json` und leerem Rumpf weist der Server als leeren JSON-Rumpf
      // ab — dann blieb das abgemeldete Fenster bei der Figur stehen (Dokumentwechsel/Trennen).
      const koepfe = Object.fromEntries(
        Object.entries({ ...kopf(mitSitzung), ...(extraKopf || {}) }).filter(
          ([name]) => !(ohneRumpf && name === "content-type"),
        ),
      );
      return abrufen(pfad, {
        method: methode,
        credentials: "include",
        headers: koepfe,
        body: ohneRumpf ? undefined : JSON.stringify(koerper),
        ...(signal ? { signal } : {}),
      }).then((res) =>
        res
          .json()
          .catch(() => null)
          .then((json) => ({ status: res.status, json })),
      );
    }

    function beschreiber() {
      let url = "";
      try {
        url = office?.context?.document?.url || "";
      } catch {
        url = "";
      }
      return typeof url === "string" && url.length > 0
        ? Object.freeze({ kind: "saved", canonicalUrl: url })
        : Object.freeze({ kind: "unsaved", clientDocumentNonce: nonce });
    }

    /** Der Stand des Dokuments, soweit Word ihn meldet (`properties.lastSaveTime`, WordApi 1.3). */
    function leseDokumentstand() {
      try {
        return word
          .run((kontext) => {
            const eigenschaften = kontext.document.properties;
            eigenschaften.load("lastSaveTime");
            return kontext.sync().then(() => eigenschaften.lastSaveTime);
          })
          .then((zeit) => {
            const datum = zeit instanceof Date ? zeit : zeit ? new Date(zeit) : null;
            return datum && !Number.isNaN(datum.getTime()) ? datum.toISOString() : null;
          })
          .catch(() => null);
      } catch {
        return Promise.resolve(null);
      }
    }

    function zeigeDokument() {
      if (!sitzung || !gebundenerBeschreiber) {
        zeige("dokument", "Kein Dokument gebunden");
        zeige("dokumentstand", "—");
        return;
      }
      zeige("dokument", `Dokument: ${dokumentname(gebundenerBeschreiber)}`);
      zeige(
        "dokumentstand",
        dokumentStand
          ? `Dokumentstand: zuletzt gespeichert ${dokumentStand}`
          : gebundenerBeschreiber.kind === "unsaved"
            ? "Dokumentstand: noch nicht gespeichert"
            : "Dokumentstand: von Word nicht gemeldet",
      );
    }

    function zeigeKontext() {
      const zustand = adapter && sitzung ? adapter.zustand() : "getrennt";
      zeige(
        "verbindung",
        zustand === "aktiv"
          ? "Verbunden mit diesem Dokument"
          : zustand === "veraltet"
            ? "Auswahl geändert — wird aktualisiert"
            : "Keine aktive Verbindung",
      );
      zeigeDokument();
      const bezug = adapter?.bezug();
      if (zustand === "aktiv" && bezug) {
        zeige(
          "kontext",
          `Word-Version: ${bezug.host?.plattform ?? "?"} ${bezug.host?.version ?? "?"}`,
        );
        zeige(
          "auswahl",
          bezug.auswahl?.art === "text"
            ? `Markierung: ${bezug.auswahl.laenge} Zeichen`
            : "Keine Markierung — Frage ohne Dokumentbezug möglich",
        );
        zeige("meldung", `Kontextmeldung Nr. ${bezug.sequenz}`);
      } else {
        zeige("kontext", "—");
        zeige("auswahl", "—");
        zeige("meldung", "—");
      }
      sichtbar("verwenden", Boolean(antwort?.text) && zustand === "aktiv");
      sichtbar("bestaetigung", bestaetigung !== null);
    }

    function zeigeZustimmung(resolution) {
      if (!resolution) {
        zeige("zustimmung", "KI-Stand unbekannt");
        return;
      }
      zeige(
        "zustimmung",
        resolution.externalConsentRequired && !resolution.externalConsentGranted
          ? "Externe KI nur mit deiner Zustimmung für dieses Dokument"
          : resolution.executionAllowed
            ? "KI für dieses Dokument freigegeben"
            : "Nur geprüfte Inhalte, ohne Modell",
      );
    }

    function verwirfAntwort(grund) {
      antwort = null;
      bestaetigung = null;
      zeige("antwort", "");
      zeige("belege", "");
      if (grund) {
        zeige("hinweis", grund);
      }
    }

    /** Konto, Sitzung oder Dokument wechselt: alles Gebundene sofort verwerfen. */
    function bindungWechselt(grund) {
      bindungsGen += 1;
      bindungInArbeit = false; // ein laufender Start/Rebind gehört ab hier niemandem mehr
      if (antwort || bestaetigung) {
        verwirfAntwort(grund);
      } else if (grund) {
        zeige("hinweis", grund);
      }
      adapter?.kontextWechsel();
      zeigeZustimmung(null);
      if (begleiterAn) {
        // Die Figur sieht das alte Fenster nicht mehr; nach Rebind/Neustart meldet es sich neu an.
        begleiterAbmeldenAlt();
        begleiterNeueRunde();
        begleiterLageSetzen("verbindet");
      }
    }

    /** Der Bezug, zu dem gerade gefragt oder eingefügt würde — unveränderlich. */
    function aktuellerBezug() {
      return Object.freeze({
        bindungsGen,
        auswahlGen,
        sitzung,
        konto,
        marke: adapter ? adapter.marke() : null,
      });
    }

    /** Konto, Sitzung, Bindungs- und Auswahlgeneration — gilt auch ohne Office-Marke. */
    function kontextGiltNoch(b) {
      return (
        b.bindungsGen === bindungsGen &&
        b.auswahlGen === auswahlGen &&
        b.sitzung === sitzung &&
        b.sitzung !== null &&
        b.konto === konto
      );
    }

    /** Wie `kontextGiltNoch`, dazu die unveränderte Office-Marke des Auswahlbezugs. */
    function bezugGiltNoch(b) {
      return (
        kontextGiltNoch(b) && b.marke !== null && adapter !== null && adapter.marke() === b.marke
      );
    }

    /** Nur der Office-Kanal — ohne Brücke (darf aus einer laufenden Brückenmeldung gerufen werden). */
    function meldeOffice() {
      if (!adapter || !sitzung) {
        zeigeKontext();
        return Promise.resolve(null);
      }
      return adapter.melde().then((bezug) => {
        zeigeKontext();
        return bezug;
      });
    }

    /** Office-Kanal und — falls eingeschaltet — derselbe neue Stand an die Figur. */
    function melde() {
      return meldeOffice().then((bezug) =>
        begleiterAn ? begleiterMelden().then(() => bezug) : bezug,
      );
    }

    function bindeAdapter() {
      if (!adapter) {
        adapter = umgebung.adapterModul.erstelleWordAdapter({
          office,
          word,
          crypto: umgebung.crypto,
          bindung: () =>
            sitzung
              ? {
                  sessionId: sitzung.sessionId,
                  instanz: sitzung.instanz,
                  dokument: sitzung.dokument,
                }
              : null,
          // Gesendet wird mit der Bindung, die der Adapter beim Start des Vorgangs EINGEFROREN
          // hat — nie mit dem inzwischen vielleicht gewechselten Seitenzustand.
          abruf: (pfad, methode, koerper, b) =>
            api(pfad, methode, koerper, false, {
              "x-klara-session": b.sessionId,
              "x-klara-instance": b.instanz,
              "x-klara-document": b.dokument,
            }),
        });
        adapter.beobachte();
      } else {
        adapter.kontextWechsel();
      }
    }

    function starteSitzung() {
      const gen = bindungsGen;
      const kontoBeiStart = konto;
      const b = beschreiber();
      const vorgang = sperreBindung();
      const fehler = () =>
        eigenerAbschluss(vorgang, gen, kontoBeiStart)
          ? bindungFehlgeschlagen("Keine Klara-Sitzung — Verbindung getrennt.")
          : false;
      return api(
        "/api/klara/sessions",
        "POST",
        { addinInstanceId: instanz, documentDescriptor: b },
        false,
      ).then((res) => {
        if (res.status !== 201 || !res.json?.sessionId) {
          return fehler();
        }
        if (!eigenerAbschluss(vorgang, gen, kontoBeiStart)) {
          return false; // verspäteter Start nach einem Wechsel — gehört niemandem mehr
        }
        sitzung = Object.freeze({
          sessionId: res.json.sessionId,
          instanz,
          dokument: res.json.documentContextId,
          actorId: res.json.actorId,
        });
        gebundenerBeschreiber = b;
        dokumentStand = null;
        zeigeZustimmung(res.json.resolution);
        bindeAdapter();
        return leseDokumentstand().then((stand) => {
          if (gen === bindungsGen && gleicherBeschreiber(gebundenerBeschreiber, b)) {
            dokumentStand = stand;
          }
          return melde().then(() => true);
        });
      }, fehler); // Netzabbruch: dieselbe, vorgangsgebundene Behandlung wie eine Absage
    }

    /** Anmeldung prüfen. Gibt es ein ANDERES Konto als die Sitzung, wird alles verworfen. */
    function pruefeKonto() {
      return api("/api/auth/me", "GET", null, false).then((res) => {
        const id = res.status === 200 ? (res.json?.id ?? res.json?.user?.id ?? null) : null;
        umgebung.onAccount?.(res.status === 200 ? res.json : null);
        if (id === null) {
          zeige("konto", "Nicht angemeldet");
          sichtbar("anmelden", true);
          if (sitzung || konto !== null) {
            konto = null;
            sitzung = null;
            gebundenerBeschreiber = null;
            bindungWechselt("Abgemeldet — der bisherige Bezug gilt nicht mehr.");
          }
          zeigeKontext();
          return false;
        }
        sichtbar("anmelden", false);
        const name = res.json?.name ?? res.json?.user?.name ?? "";
        zeige("konto", name ? `Angemeldet als ${name}` : "Angemeldet");
        if (konto !== null && konto !== id) {
          // Kontowechsel: alter Bezug und alte Antwort gehören nicht zum neuen Konto.
          sitzung = null;
          gebundenerBeschreiber = null;
          bindungWechselt("Konto gewechselt — der bisherige Bezug wurde verworfen.");
        }
        konto = id;
        if (sitzung) {
          return true;
        }
        // Läuft schon ein Start oder Rebind derselben Bindung, keinen zweiten daneben beginnen.
        return bindungInArbeit ? false : starteSitzung();
      });
    }

    /**
     * Prüft, ob das gebundene Dokument noch das Dokument in Word ist. Bei JEDER Abweichung des
     * Beschreibers wird VOR dem Rebind invalidiert; der Rebind geht mit der alten Bindung über den
     * vorhandenen Weg `…/document-context`, sein Abschluss zählt nur in derselben Bindungsgeneration.
     */
    function pruefeDokument() {
      if (!sitzung || !gebundenerBeschreiber) {
        return Promise.resolve(false);
      }
      const b = beschreiber();
      if (gleicherBeschreiber(b, gebundenerBeschreiber)) {
        return Promise.resolve(false);
      }
      const alt = sitzung;
      sitzung = null;
      gebundenerBeschreiber = null;
      dokumentStand = null;
      bindungWechselt("Dokument gewechselt — der bisherige Bezug wurde verworfen.");
      const gen = bindungsGen;
      const kontoBeiStart = konto;
      const vorgang = sperreBindung();
      const fehler = () =>
        eigenerAbschluss(vorgang, gen, kontoBeiStart)
          ? bindungFehlgeschlagen("Dokumentwechsel nicht bestätigt — Verbindung getrennt.")
          : false;
      zeigeKontext();
      return api(
        `/api/klara/sessions/${encodeURIComponent(alt.sessionId)}/document-context`,
        "POST",
        { documentDescriptor: b },
        false,
        bindungsKopf(alt),
      ).then((res) => {
        if (res.status !== 200 || !res.json?.documentContextId) {
          return fehler();
        }
        if (!eigenerAbschluss(vorgang, gen, kontoBeiStart)) {
          return false; // ein neuerer Wechsel hat übernommen
        }
        sitzung = Object.freeze({ ...alt, dokument: res.json.documentContextId });
        gebundenerBeschreiber = b;
        zeigeZustimmung(res.json.resolution);
        adapter?.kontextWechsel();
        return leseDokumentstand().then((stand) => {
          if (gen === bindungsGen && gleicherBeschreiber(gebundenerBeschreiber, b)) {
            dokumentStand = stand;
          }
          return melde().then(() =>
            // Hat sich das Dokument während des Rebinds noch einmal geändert, gleich nachziehen.
            gleicherBeschreiber(beschreiber(), b) ? true : pruefeDokument().then(() => true),
          );
        });
      }, fehler); // Netzabbruch: Sperre lösen, getrennt zeigen; Kontoabgleich baut neu auf
    }

    function frageAbbrechen() {
      frageEpoch++;
      frageController?.abort();
      umgebung.onBusy?.(false);
      umgebung.onStopped?.();
    }

    function frage(text, optionen) {
      const frageText = String(text || "").trim();
      if (!sitzung || frageText.length === 0) {
        zeige("hinweis", sitzung ? "Bitte eine Frage eingeben." : "Keine aktive Verbindung.");
        return Promise.resolve(null);
      }
      frageController?.abort();
      frageController = new AbortController();
      const controller = frageController;
      const epoch = ++frageEpoch;
      let turn = null;
      verwirfAntwort("");
      const bezug = aktuellerBezug();
      const gefragt = bezug.sitzung;
      const mitMarkierung = optionen?.markierungMitsenden === true;
      if (mitMarkierung && !bezugGiltNoch(bezug)) {
        // Markierungstext geht NUR mit gültigem Auswahlbezug hinaus (Befund Ben begleitung.js:442).
        zeige("hinweis", "Markierung nicht gebunden — bitte kurz warten und neu fragen.");
        return Promise.resolve(null);
      }
      turn = umgebung.onTurn?.(frageText);
      umgebung.onBusy?.(true);
      zeige("hinweis", "Klara sucht …");
      const markierung = mitMarkierung ? adapter.auswahlText() : Promise.resolve("");
      return markierung
        .then((auswahl) => {
          // VOR JEDEM SENDEN, unabhängig von der Marke: Konto, Sitzung, Bindungs- und
          // Auswahlgeneration sind noch die der Frage. Mit Markierung zusätzlich die Marke selbst.
          if (
            epoch !== frageEpoch ||
            !kontextGiltNoch(bezug) ||
            (mitMarkierung && !bezugGiltNoch(bezug))
          ) {
            return null; // nichts gesendet — die Auswahl oder Bindung hat sich geändert
          }
          const sprache = umgebung.locale?.();
          const koerper = {
            question: frageText,
            locale: ["de", "en", "nl"].includes(sprache) ? sprache : "de",
            questionSource: "manual",
          };
          if (auswahl) {
            koerper.selection = auswahl;
            // Ohne ausdrückliche Wahl gilt die Markierung als vertraulich (fail-closed).
            koerper.selectionConfidentiality =
              optionen?.vertraulichkeit === "intern" ? "intern" : "vertraulich";
          }
          return api(
            `/api/klara/sessions/${encodeURIComponent(gefragt.sessionId)}/execute`,
            "POST",
            koerper,
            false,
            bindungsKopf(gefragt),
            controller.signal,
          );
        })
        .then((res) => {
          if (epoch !== frageEpoch) return null;
          if (res === null || !kontextGiltNoch(bezug)) {
            // Die Antwort kam nach einem Wechsel: sie gehört nicht zum jetzigen Kontext.
            zeige("hinweis", "Die Antwort kam nach einem Wechsel und wurde verworfen.");
            return null;
          }
          if (res.status !== 200) {
            zeige(
              "hinweis",
              res.json?.message ? String(res.json.message) : `Keine Antwort (HTTP ${res.status}).`,
            );
            return null;
          }
          const ergebnis = res.json?.result ?? {};
          umgebung.onAnswer?.(turn, {
            answer: ergebnis.answer,
            answerId: res.json?.answerId,
            sources: ergebnis.sources,
            aiGenerated: ergebnis.aiGenerated?.aiGenerated === true,
          });
          const textAntwort =
            ergebnis.answered && typeof ergebnis.answer === "string" ? ergebnis.answer : "";
          if (!textAntwort) {
            zeige("hinweis", "Dazu gibt es keine belegte Antwort.");
            zeigeKontext();
            return null;
          }
          antwort = Object.freeze({ text: textAntwort, bezug });
          zeige("antwort", textAntwort);
          const belege = Array.isArray(ergebnis.sources) ? ergebnis.sources.length : 0;
          zeige("belege", belege > 0 ? `${belege} Beleg(e) aus KLARWERK` : "Ohne genannten Beleg");
          zeige("hinweis", "");
          zeigeKontext();
          return antwort;
        })
        .catch(() => {
          if (epoch === frageEpoch) zeige("hinweis", "Klara ist gerade nicht erreichbar.");
          return null;
        })
        .finally(() => {
          if (epoch === frageEpoch) umgebung.onBusy?.(false);
        });
    }

    /** Erster Klick: nur die Bestätigung zeigen — nichts wird geschrieben. */
    function verwendenVorbereiten() {
      if (!antwort || !bezugGiltNoch(antwort.bezug)) {
        if (antwort) {
          verwirfAntwort(
            antwort.bezug.marke === null
              ? "Antwort ohne gebundenen Dokumentbezug — bitte markieren und neu fragen."
              : "Die Antwort gehört zu einer anderen Auswahl und wurde verworfen.",
          );
          zeigeKontext();
        }
        return false;
      }
      bestaetigung = Object.freeze({ antwort, auswahlGen, bindungsGen });
      zeigeKontext();
      return true;
    }

    /**
     * Zweiter Klick: nur wenn Bestätigung, Antwort und deren ursprünglicher Office-Bezug (Marke,
     * Auswahl- und Bindungsgeneration, Sitzung, Konto) noch genau die jetzigen sind.
     */
    function verwendenBestaetigen() {
      const offen = bestaetigung;
      bestaetigung = null;
      if (
        !offen ||
        offen.antwort !== antwort ||
        offen.auswahlGen !== auswahlGen ||
        offen.bindungsGen !== bindungsGen ||
        !bezugGiltNoch(offen.antwort.bezug)
      ) {
        if (antwort) {
          verwirfAntwort("Die Antwort gehört zu einem anderen Kontext und wurde nicht eingefügt.");
        }
        zeigeKontext();
        return Promise.resolve({
          gueltig: false,
          grund: offen ? "anderer_kontext" : "keine_antwort",
        });
      }
      return adapter.fuegeEin(offen.antwort.text).then((ergebnis) => {
        if (ergebnis.gueltig === true) {
          verwirfAntwort("Eingefügt.");
        } else {
          verwirfAntwort("Nicht eingefügt — die Auswahl hat sich geändert. Bitte neu markieren.");
        }
        return melde().then(() => ergebnis);
      });
    }

    function zustimmen(erteilen) {
      if (!sitzung) {
        return Promise.resolve(false);
      }
      const gen = bindungsGen;
      return api(
        `/api/klara/sessions/${encodeURIComponent(sitzung.sessionId)}/consent`,
        erteilen ? "POST" : "DELETE",
        null,
        true,
      ).then((res) => {
        if (gen !== bindungsGen) {
          return false;
        }
        zeigeZustimmung(res.status === 200 ? res.json?.resolution : null);
        return res.status === 200;
      });
    }

    /**
     * Auswahl geändert: SOFORT neue Auswahlgeneration, Antwort und offene Bestätigung verworfen;
     * die Neumeldung folgt kurz danach.
     */
    function auswahlGeaendert() {
      auswahlGen += 1;
      // Auch für die Figur sofort ungültig: neuer Stand, keine bestätigte Auswahl mehr.
      begleiterStand += 1;
      begleiterAuswahl = null;
      if (antwort || bestaetigung) {
        verwirfAntwort("Auswahl geändert — die Antwort gehörte zur vorherigen Auswahl.");
      }
      zeigeKontext();
      if (wartet !== null) {
        umgebung.clearTimeout(wartet);
      }
      wartet = umgebung.setTimeout(() => {
        wartet = null;
        pruefeDokument().then((umgebunden) => (umgebunden ? null : melde()));
      }, 300);
    }

    // ============================================================================================
    // DIE BRÜCKE ZUR NATIVEN FIGUR (Nacharbeit 6, Befund Ben begleitung.js:306)
    // ============================================================================================
    //
    // Die native Begleitfigur liest AUSSCHLIESSLICH den vorhandenen Begleiterkanal
    // (`/api/me/klara/begleiter/*`, `services/app/src/klara-begleiter.ts`) und legt dort Aktionen
    // ab. Diese Seite meldet sich dort als weiteres Word-Fenster an — mit demselben Vertrag wie der
    // Adapter des alten Aufgabenfensters (`begleiter.js`), aber gespeist aus DIESEM Office-Kern:
    //   · NUR NACH EINSCHALTEN („Mit Begleitfigur verbinden"); bei jedem Laden aus, nirgends
    //     gespeichert. Davor geht nichts an den Kanal.
    //   · Dokument = das GEBUNDENE Dokument der Klara-Sitzung (Kennung: SHA-256 der Adresse bzw. des
    //     Fenster-Einmalwerts, dazu der Dateiname); die Adresse selbst verlässt Word nicht.
    //   · Auswahl = nur bei gültigem Office-Bezug (Marke, Auswahl- und Bindungsgeneration), höchstens
    //     4.000 Zeichen mit voller Länge; der Auswahlstand steigt SOFORT bei jeder Auswahländerung.
    //     Ohne gültigen Bezug meldet die Seite „keine Auswahl" — nie die zuletzt bekannte.
    //   · Aktionen der Figur laufen über DIESELBEN Regeln wie die Seite: „einfuegen" nur für den
    //     gemeldeten Stand mit noch gültigem Bezug und über die Zielprüfung des Office-Kanals
    //     (`fuegeEin`, hinter die Auswahl wie im Vertrag der Figur); „frage" über `frage()` und damit
    //     über Klaras Ausführungszugang mit Sitzungstor, Zustimmung und Markierungsregeln.
    //   · Konto-, Sitzungs- und Dokumentwechsel: altes Fenster abmelden, neue Runde, neu anmelden.
    //     Alte Antworten einer früheren Runde ändern nichts.
    const BEGLEITER_BASIS = "/api/me/klara/begleiter";
    const BEGLEITER_AUSWAHL_MAX = 4000;
    const BEGLEITER_ERGEBNIS_MAX = 8000;
    const BEGLEITER_LAGEN = {
      aus: "Begleitfigur nicht verbunden.",
      verbindet: "Verbindet mit der Begleitfigur …",
      verbunden: "Verbunden · die Begleitfigur sieht dieses Dokument.",
      getrennt: "Verbindung zur Begleitfigur unterbrochen — wird erneut versucht.",
      anmeldung: "Bitte zuerst bei Klarwerk anmelden.",
      keinDokument: "Kein Dokument gebunden — die Begleitfigur sieht nichts.",
    };

    function begleiterLageSetzen(lage) {
      begleiterLage = lage;
      zeige("begleiter", BEGLEITER_LAGEN[lage] ?? lage);
    }

    function sha256Hex(text) {
      return umgebung.crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(String(text)))
        .then(hexAus);
    }

    function begleiterAbruf(methode, pfad, koerper) {
      return api(`${BEGLEITER_BASIS}${pfad}`, methode, koerper, false);
    }

    function begleiterHost() {
      const d = office?.context?.diagnostics ?? {};
      const plattform = typeof d.platform === "string" ? d.platform : "";
      const fassung = typeof d.version === "string" ? d.version.slice(0, 40) : "";
      return {
        host:
          plattform === "Mac"
            ? "word-mac"
            : plattform === "OfficeOnline"
              ? "word-web"
              : plattform === "PC"
                ? "word-windows"
                : "word-andere",
        fassung: fassung.replace(/[^0-9A-Za-z .()_-]/g, ""),
      };
    }

    /** Das GEBUNDENE Dokument im Format des Kanals — die Adresse nur als Prüfsumme. */
    function begleiterDokument(b) {
      if (b.kind === "saved") {
        return sha256Hex(b.canonicalUrl).then((h) => ({
          kennung: `url-${h.slice(0, 32)}`,
          titel: ohneSteuerzeichen(dokumentname(b), false).trim().slice(0, 120),
          gespeichert: true,
        }));
      }
      return sha256Hex(b.clientDocumentNonce).then((h) => ({
        kennung: `neu-${h.slice(0, 32)}`,
        titel: "",
        gespeichert: false,
      }));
    }

    function begleiterNeueRunde() {
      begleiterRunde += 1;
      begleiterAngemeldet = false;
      begleiterSeq = 0;
      begleiterAuswahl = null;
      begleiterErledigt = [];
      begleiterStand += 1;
      begleiterInstanz = null;
      // Eine noch laufende Meldung der alten Runde blockiert die neue nicht (sie wird verworfen).
      begleiterUnterwegs = null;
    }

    function begleiterAbmeldenAlt() {
      const alt = begleiterInstanz;
      if (alt && begleiterAngemeldet) {
        begleiterAbruf("DELETE", `/adapter/${alt}`, null).catch(() => null);
      }
    }

    function begleiterAnmelden(runde) {
      const s = sitzung;
      const b = gebundenerBeschreiber;
      const instanzBereit = begleiterInstanz
        ? Promise.resolve(begleiterInstanz)
        : sha256Hex(neueId("bgl")).then((h) => `bgl-${h.slice(0, 32)}`);
      return Promise.all([instanzBereit, begleiterDokument(b)]).then(([instanz, dokument]) => {
        if (runde !== begleiterRunde || s !== sitzung) {
          return false;
        }
        begleiterInstanz = instanz;
        const host = begleiterHost();
        return begleiterAbruf("POST", "/adapter", {
          instanz,
          host: host.host,
          hostFassung: host.fassung,
          dokument,
        }).then((res) => {
          if (runde !== begleiterRunde) {
            // Inzwischen Dokument-/Kontowechsel oder Trennen: eine verspätet ANGENOMMENE Anmeldung
            // gehört niemandem mehr und wird sofort wieder abgemeldet — sonst sähe die Figur das
            // alte Fenster bis zum Ablauf der Frist weiter (KLARA-OFFICE-02, Nacharbeit 6).
            if (res.status === 201) {
              begleiterAbruf("DELETE", `/adapter/${instanz}`, null).catch(() => null);
            }
            return false;
          }
          if (res.status === 201) {
            begleiterAngemeldet = true;
            begleiterSeq = 0;
            return true;
          }
          begleiterLageSetzen(res.status === 401 ? "anmeldung" : "getrennt");
          return false;
        });
      });
    }

    /** Die Auswahl NUR mit gültigem Office-Bezug — sonst `null` („keine Auswahl"). */
    function begleiterAuswahlLesen() {
      const bezug = aktuellerBezug();
      const stand = begleiterStand;
      if (!adapter || !bezugGiltNoch(bezug)) {
        return Promise.resolve(null);
      }
      return adapter.auswahlText().then(
        (text) =>
          text && bezugGiltNoch(bezug) && stand === begleiterStand ? { text, stand, bezug } : null,
        () => null,
      );
    }

    function begleiterErgebnis(runde, id, stand, ergebnis, grund) {
      if (runde !== begleiterRunde) {
        return;
      }
      begleiterErledigt.push({
        id,
        stand,
        ergebnis: ergebnis === null ? null : String(ergebnis).slice(0, BEGLEITER_ERGEBNIS_MAX),
        grund: grund === null ? null : String(grund).slice(0, 200),
      });
    }

    /** Die Bindung, unter der Aufträge der Figur empfangen wurden — unveränderlich. */
    function begleiterBindung(runde) {
      return Object.freeze({ runde, bindungsGen, sitzung, konto });
    }

    /** Gilt die Empfangsbindung noch? Eingeschaltet, dieselbe Runde, Bindung, Sitzung, Konto. */
    function begleiterBindungGilt(b) {
      return (
        begleiterAn &&
        b.runde === begleiterRunde &&
        b.bindungsGen === bindungsGen &&
        b.sitzung === sitzung &&
        b.sitzung !== null &&
        b.konto === konto
      );
    }

    /**
     * Eine Aktion der Figur — über dieselben Tore wie die Bedienung der Seite. VOR jeder Aktion
     * gilt noch die Bindung, unter der sie empfangen wurde (Befund Ben begleitung.js:850): nach
     * Trennen, Dokument-, Sitzungs- oder Kontowechsel werden verbliebene Aufträge verworfen, ohne
     * `frage` oder `fuegeEin` zu erreichen — sie würden sich sonst an den neuen Bezug binden.
     */
    function begleiterAusfuehren(auftrag, bindung) {
      if (!auftrag || typeof auftrag.id !== "string") {
        return Promise.resolve();
      }
      const runde = bindung.runde;
      if (!begleiterBindungGilt(bindung)) {
        // Ergebnis nur, solange die Runde noch besteht (sonst gehört es niemandem mehr).
        begleiterErgebnis(runde, auftrag.id, "abgelehnt", null, "bindung_gewechselt");
        return Promise.resolve();
      }
      if (auftrag.art === "einfuegen") {
        const b = begleiterAuswahl;
        if (
          !b ||
          auftrag.auswahlStand !== begleiterStand ||
          b.stand !== auftrag.auswahlStand ||
          !bezugGiltNoch(b.bezug)
        ) {
          begleiterErgebnis(runde, auftrag.id, "abgelehnt", null, "auswahl_geaendert");
          return Promise.resolve();
        }
        return adapter.fuegeEin(String(auftrag.text), "After").then((r) => {
          if (r.gueltig !== true) {
            begleiterErgebnis(runde, auftrag.id, "abgelehnt", null, r.grund || "auswahl_geaendert");
            return null;
          }
          begleiterErgebnis(runde, auftrag.id, "erledigt", null, null);
          // Das Dokument hat sich geändert: der gesehene Stand ist verbraucht.
          begleiterStand += 1;
          begleiterAuswahl = null;
          return meldeOffice();
        });
      }
      if (auftrag.art === "frage") {
        const optionen =
          typeof umgebung.frageOptionen === "function" ? umgebung.frageOptionen() : {};
        return frage(String(auftrag.text), optionen).then((a) => {
          if (a?.text) {
            begleiterErgebnis(runde, auftrag.id, "erledigt", a.text, null);
          } else {
            const grund = letzterHinweis || "keine_antwort";
            begleiterErgebnis(runde, auftrag.id, "fehler", null, grund);
          }
        });
      }
      begleiterErgebnis(runde, auftrag.id, "abgelehnt", null, "unbekannte_aktion");
      return Promise.resolve();
    }

    function begleiterMeldenRoh(runde) {
      if (!sitzung || !gebundenerBeschreiber) {
        begleiterLageSetzen("keinDokument");
        return Promise.resolve(false);
      }
      const anmeldung = begleiterAngemeldet ? Promise.resolve(true) : begleiterAnmelden(runde);
      return anmeldung.then((ok) => {
        if (!ok || runde !== begleiterRunde) {
          return false;
        }
        return begleiterAuswahlLesen().then((gelesen) => {
          if (runde !== begleiterRunde) {
            return false;
          }
          const instanz = begleiterInstanz;
          const bindung = begleiterBindung(runde);
          begleiterSeq += 1;
          const ergebnisse = begleiterErledigt.slice(0, 10);
          const koerper = { seq: begleiterSeq, erledigt: ergebnisse };
          if (gelesen) {
            begleiterAuswahl = { stand: gelesen.stand, bezug: gelesen.bezug };
            koerper.auswahl = {
              text: ohneSteuerzeichen(gelesen.text.slice(0, BEGLEITER_AUSWAHL_MAX), true),
              laenge: gelesen.text.length,
              stand: gelesen.stand,
            };
          } else {
            begleiterAuswahl = null;
            koerper.auswahl = null;
            koerper.auswahlStand = begleiterStand;
          }
          return begleiterAbruf("PUT", `/adapter/${instanz}`, koerper).then((res) => {
            if (runde !== begleiterRunde || instanz !== begleiterInstanz) {
              return false; // Antwort einer früheren Runde — ändert nichts
            }
            if (res.status === 200) {
              begleiterErledigt = begleiterErledigt.slice(ergebnisse.length);
              begleiterLageSetzen("verbunden");
              const auftraege = Array.isArray(res.json?.aktionen) ? res.json.aktionen : [];
              let kette = Promise.resolve();
              for (const auftrag of auftraege) {
                kette = kette.then(() => begleiterAusfuehren(auftrag, bindung));
              }
              return kette.then(() => true);
            }
            if (res.status === 404 || res.status === 409) {
              // Vergessen (Neustart, Frist) oder aus dem Takt: neu anmelden.
              begleiterAngemeldet = false;
              begleiterLageSetzen("verbindet");
              return false;
            }
            begleiterLageSetzen(res.status === 401 ? "anmeldung" : "getrennt");
            return false;
          });
        });
      });
    }

    /**
     * Eine Meldung an den Kanal (Takt, Auswahländerung, Ergebnis). Läuft schon eine, kommt deren
     * Promise zurück. Nur nach ERFOLGREICHER Meldung folgt für neu angefallene Ergebnisse sofort
     * eine weitere; nach einem Fehlschlag bleiben sie gepuffert und gehen mit dem regulären Takt
     * (2 s) — kein sofortiges Nachsenden in Schleife (Befund Ben begleitung.js:973).
     */
    function begleiterMelden() {
      if (!begleiterAn) {
        return Promise.resolve(false);
      }
      if (begleiterUnterwegs) {
        return begleiterUnterwegs;
      }
      const runde = begleiterRunde;
      const lauf = begleiterMeldenRoh(runde)
        .catch(() => {
          if (runde === begleiterRunde && begleiterAn) {
            begleiterLageSetzen("getrennt");
          }
          return false;
        })
        .then((ergebnis) => {
          if (begleiterUnterwegs === lauf) {
            begleiterUnterwegs = null;
          }
          if (
            ergebnis === true &&
            begleiterAn &&
            runde === begleiterRunde &&
            begleiterErledigt.length > 0
          ) {
            return begleiterMelden();
          }
          return ergebnis;
        });
      begleiterUnterwegs = lauf;
      return lauf;
    }

    function begleiterVerbinden() {
      begleiterAn = true;
      begleiterNeueRunde();
      begleiterLageSetzen("verbindet");
      return begleiterMelden();
    }

    function begleiterTrennen() {
      begleiterAbmeldenAlt();
      begleiterAn = false;
      begleiterNeueRunde();
      begleiterUnterwegs = null;
      begleiterLageSetzen("aus");
    }

    function uebergabeEinloesen(nachricht) {
      let code = null;
      try {
        const k = JSON.parse(String(nachricht));
        code = k?.art === UEBERGABE_ART && typeof k.code === "string" && k.code ? k.code : null;
      } catch {
        code = null;
      }
      if (code === null) {
        return Promise.resolve(false);
      }
      return api("/api/auth/office-handover/redeem", "POST", { code }, false).then((res) => {
        const token = res.status === 200 ? res.json?.token : null;
        if (typeof token !== "string" || token.length === 0) {
          zeige("hinweis", "Die Anmeldung wurde nicht übergeben. Bitte erneut anmelden.");
          return false;
        }
        schluessel = token;
        return pruefeKonto();
      });
    }

    /** Der vorhandene Anmeldedialog — keine eigene Anmeldeverwaltung. */
    function anmelden() {
      const ui = office?.context?.ui;
      if (!ui || typeof ui.displayDialogAsync !== "function") {
        zeige("hinweis", "Bitte in KLARWERK anmelden und die Begleitung neu öffnen.");
        return;
      }
      ui.displayDialogAsync(
        `${umgebung.herkunft}/word-addin/anmeldung.html`,
        { height: 75, width: 45 },
        (ergebnis) => {
          const dialog = ergebnis?.status === "succeeded" ? ergebnis.value : null;
          if (!dialog) {
            zeige("hinweis", "Der Anmeldedialog ließ sich nicht öffnen.");
            return;
          }
          dialog.addEventHandler(office.EventType.DialogMessageReceived, (arg) => {
            try {
              dialog.close();
            } catch {
              // bereits geschlossen
            }
            uebergabeEinloesen(arg?.message);
          });
        },
      );
    }

    /** So lange wartet der Start höchstens auf den Registrierungsrückruf von office.js. */
    const REGISTRIERUNG_FRIST_MS = 1500;

    /**
     * Auswahlereignis registrieren und den Rückruf von office.js ABWARTEN, bevor Konto und Sitzung
     * starten (Befund Ben begleitung.js:1083). Ohne dieses Warten folgt bei schon gültiger
     * Anmeldung sofort die zweite Registrierung (`adapter.beobachte()`); Word für Mac 16.111 liefert
     * danach keine Auswahlwechsel mehr — der Kanal-Auswahlstand blieb bei 1. Ruft der Host den
     * Rückruf nicht auf, geht es nach der Frist trotzdem weiter.
     */
    function registriereAuswahlereignis() {
      return new Promise((fertig) => {
        let offen = true;
        const ende = (ergebnis) => {
          if (!offen) {
            return;
          }
          offen = false;
          umgebung.clearTimeout(frist);
          if (ergebnis && ergebnis.status === "failed") {
            zeige("hinweis", "Word meldet Auswahlwechsel nicht — bitte die Begleitung neu öffnen.");
          }
          fertig(ergebnis ?? null);
        };
        const frist = umgebung.setTimeout(() => ende(null), REGISTRIERUNG_FRIST_MS);
        try {
          office.context.document.addHandlerAsync(
            office.EventType.DocumentSelectionChanged,
            auswahlGeaendert,
            ende,
          );
        } catch {
          ende(null);
        }
      });
    }

    function starte() {
      zeigeKontext();
      return registriereAuswahlereignis().then(() => pruefeKonto());
    }

    return {
      starte,
      pruefeKonto,
      pruefeDokument,
      frage,
      frageAbbrechen,
      persoenlicheAnfrage: (pfad, methode, koerper) => api(pfad, methode, koerper, false),
      verwendenVorbereiten,
      verwendenBestaetigen,
      zustimmen,
      anmelden,
      uebergabeEinloesen,
      auswahlGeaendert,
      sitzung: () => sitzung,
      antwort: () => antwort,
      bestaetigungOffen: () => bestaetigung !== null,
      adapter: () => adapter,
      begleiterVerbinden,
      begleiterTrennen,
      begleiterMelden,
      begleiterLage: () => begleiterLage,
    };
  }

  /** Browserstart: verbindet die Seite mit `begleitung.html`. In Tests nicht benutzt. */
  function imBrowser() {
    const doc = wurzel.document;
    const Office = wurzel.Office;
    let ui = null;
    let letzteFrage = null;
    if (!doc || !Office || typeof Office.onReady !== "function") {
      return;
    }
    const element = (name) => doc.getElementById(`kw-${name}`);
    const zeige = (name, text) => {
      const el = element(name);
      if (el) {
        el.textContent = text;
      }
      ui?.paint();
    };
    const sichtbar = (name, an) => {
      const el = element(name);
      if (el) {
        el.hidden = !an;
      }
    };
    Office.onReady((info) => {
      if (info?.host !== Office.HostType.Word) {
        zeige("verbindung", "Diese Begleitung läuft nur in Word.");
        return;
      }
      const seite = erstelle({
        office: Office,
        word: wurzel.Word,
        crypto: wurzel.crypto,
        fetch: wurzel.fetch.bind(wurzel),
        adapterModul: wurzel.KlarwerkOfficeHostWord,
        herkunft: wurzel.location.origin,
        setTimeout: wurzel.setTimeout.bind(wurzel),
        clearTimeout: wurzel.clearTimeout.bind(wurzel),
        neueId: (praefix) => `${praefix}-${wurzel.crypto.randomUUID()}`,
        zeige,
        sichtbar,
        onAccount: (konto) => ui?.setAccount(konto),
        onTurn: (text) => {
          letzteFrage = ui?.turn(text);
          return letzteFrage;
        },
        onAnswer: (turn, ergebnis) => ui?.answer(turn, ergebnis),
        onBusy: (an) =>
          ui?.activity("frage", ui.t("working"), an ? () => seite.frageAbbrechen() : null),
        onStopped: () => {
          ui?.answer(letzteFrage, { stopped: true });
          ui?.notify(ui.t("stopped"));
        },
        locale: () => ui?.locale || "de",
        // Eine Frage der Begleitfigur folgt denselben Wahlen wie eine hier getippte.
        frageOptionen: () => ({
          markierungMitsenden: element("markierung")?.checked === true,
          vertraulichkeit: element("vertraulichkeit")?.value,
        }),
      });
      ui = wurzel.KlarwerkWordMinimal?.create({
        header: "kw-begleitung-kopf",
        home: "kw-begleitung-antwort",
        homeExtras: ["kw-anmelden"],
        composer: "kw-begleitung-eingabe",
        input: element("frage"),
        contextDetails: ["kw-begleitung-kontext"],
        settings: ["kw-begleitung-begleiter"],
        help: [],
        tools: [],
        sourceHref: (id) => `/wissen/${encodeURIComponent(id)}`,
        request: (pfad, methode, koerper) =>
          methode === "HEAD"
            ? wurzel
                .fetch(pfad, { method: "HEAD", credentials: "include" })
                .then((r) => ({
                  status: r.status,
                  version: r.headers.get("x-kw-available-version"),
                }))
            : seite.persoenlicheAnfrage(pfad, methode, koerper),
        contextText: () => ["Word", element("verbindung")?.textContent].filter(Boolean).join(" · "),
        paint: () => {},
        reset: () => {},
        onAccountChange: () => seite.frageAbbrechen(),
        onPageHide: [() => seite.frageAbbrechen()],
      });
      for (const id of ["markierung", "vertraulichkeit"]) {
        const label = element(id)?.closest("label");
        if (label && ui) ui.room("context").append(label);
      }
      const begleiterKnopf = element("begleiter-knopf");
      begleiterKnopf?.addEventListener("click", () => {
        const an = seite.begleiterLage() !== "aus";
        if (an) {
          seite.begleiterTrennen();
        } else {
          seite.begleiterVerbinden();
        }
        begleiterKnopf.setAttribute("aria-checked", an ? "false" : "true");
      });
      // Derselbe Takt wie der Adapter des Aufgabenfensters: der Kanal hält ein Fenster 12 s aktiv.
      wurzel.setInterval(() => seite.begleiterMelden(), 2000);
      wurzel.addEventListener("pagehide", () => {
        if (seite.begleiterLage() !== "aus") {
          seite.begleiterTrennen();
        }
      });
      element("anmelden-knopf")?.addEventListener("click", () => seite.anmelden());
      element("frage-knopf")?.addEventListener("click", () => {
        seite.frage(element("frage")?.value, {
          markierungMitsenden: element("markierung")?.checked === true,
          vertraulichkeit: element("vertraulichkeit")?.value,
        });
      });
      element("verwenden-knopf")?.addEventListener("click", () => seite.verwendenVorbereiten());
      element("bestaetigen-knopf")?.addEventListener("click", () => seite.verwendenBestaetigen());
      element("zustimmen-knopf")?.addEventListener("click", () => seite.zustimmen(true));
      element("widerrufen-knopf")?.addEventListener("click", () => seite.zustimmen(false));
      // Fokus-/Sichtbarkeitswechsel: Konto und Dokument frisch prüfen (Wechsel ⇒ Bezug verwerfen).
      wurzel.addEventListener("focus", () => {
        seite.pruefeKonto().then(() => seite.pruefeDokument());
      });
      seite.starte();
    });
  }

  wurzel.KlarwerkBegleitung = { erstelle };
  imBrowser();
})(typeof self !== "undefined" ? self : globalThis);

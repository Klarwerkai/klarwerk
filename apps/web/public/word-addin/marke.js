// ================================================================================================
// KLARA · FIRMEN-CI (JOB 3512) — DER BLOCK KW-MARKE, ALS EIGENE DATEI.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT: das Fensterskript ist in seiner Groesse bewacht
// (`tests/klara-zerlegung/schnittflaechen.test.ts` B3, Schranke 12500 Zeilen — bis R-1611 am
// Inline-Skript von `taskpane.html`, seither an `taskpane.js`), und seit JOB 3667 gilt dort
// „schneiden statt anheben". Der Bestandsblick-Kandidat (aufnahme:20260922:gesamt-bestandsblick)
// hat die Schranke mit 12551 Zeilen gerissen; die Schranke bleibt, wo sie ist. Geschnitten wird
// nach dem Vorbild `rueckweg.js`: ein geschlossener Abschnitt wandert heraus.
//
// WARUM GERADE DIESER BLOCK: er ist der letzte im Fensterskript und haengt an nichts aus dem
// Fenster — nur an `document`, `window`, `fetch`, `setTimeout` und dem Logo-Element
// `#kw-marke-logo` im Rumpf. Keine Zeile ausserhalb des Blocks ruft eine seiner Funktionen.
//
// ZEILE FUER ZEILE VERSCHOBEN, NICHTS UMGESCHRIEBEN. Unterhalb dieses Kopfes steht der Abschnitt
// unveraendert, samt Einrueckung und seinem Markenpaar (Start und Ende), und davor die eine
// Leerzeile, die ihn im Skript vom Block davor trennte. Dieselbe Sprache wie das Fenster (ES5,
// `var`, kein Modul, kein Build) — deshalb steht die Datei wie `rueckweg.js` auf der Ignorierliste
// von Biome.
//
// LADEREIHENFOLGE, und sie ist Absicht: `taskpane.html` laedt diese Datei als klassisches Skript
// UNMITTELBAR NACH `taskpane.js`. Klassische Skripte laufen in Dokumentreihenfolge; der Block laeuft
// damit genau dort, wo er bisher stand: am Ende des Fensterskripts. Der erste Abruf von
// `/api/branding` geht weiter durch den `fetch`-Umschlag des Fensters, und die Zuhoerer fuer
// `visibilitychange`/`focus` haengen sich wie bisher hinter die des Fensters.
//
// KEINE VERHALTENSAENDERUNG: `"use strict"` steht hier wie im Fensterskript. Die Pruefstaende lesen
// das Fenster ueber `tests/support/panelquelle.ts`; das setzt diesen Block beim Zusammenfuegen
// wieder an das Ende des Skripts — dasselbe Dokument wie vor dem Schnitt.
// ================================================================================================
"use strict";

    // ============================================================================================
    // KW-MARKE-START — DIE FIRMEN-CI DER VORFUEHRUNG (JOB 3512).
    // ============================================================================================
    //
    // WOZU: Schaltet der Administrator in KLARWERK das Demo-Erscheinungsbild ein, traegt Klara im
    // Word dasselbe Logo und dieselben Hausfarben — ohne zweiten Schalter, ohne Neustart des
    // Add-ins. Pedis Vorgabe fuer Freitag (gespraech/ci-advisor/AUFTRAGSGRUNDLAGE.md): Logo und
    // Markenfarben, KEIN Layout- oder Funktionsumbau, Produktidentitaet erkennbar halten.
    //
    // DIE EINE QUELLE IST DER SERVER. `GET /api/branding` (JOB 3510) beantwortet genau eine Frage:
    // „In welchem Erscheinungsbild laeuft diese Instanz?" Der Weg ist bewusst ohne Anmeldung
    // erreichbar — dieses Fenster faerbt sich, bevor irgendjemand angemeldet ist. Es gibt hier
    // KEINE gespeicherte Wahl, KEINEN eigenen Schalter und KEINEN zweiten Farbsatz: die beiden
    // Werte kommen im Vertrag (`marke.farben`), alles Weitere ist daraus GERECHNET.
    //
    // WARUM DIE WURZELVARIABLEN UND NICHT NEUE REGELN: Der Stilblock oben ist die Kopie der
    // Werkbank-Palette; jede Regel darunter greift ueber `var(--…)`, und mega43 haelt genau das
    // fest. Wird eine Variable an der Wurzel ueberschrieben, wirkt die Marke ueberall dort, wo
    // heute der Funke wirkt — und wird sie WEGGENOMMEN, steht wieder exakt der Wert aus `:root`.
    // Das ist der ganze Beweis fuer „Ausschalten stellt den vorherigen Look wieder her": es bleibt
    // keine Markenregel stehen, die noch matchen koennte. Ein zweiter Farbsatz im Stilblock waere
    // dagegen genau die zweite Wahrheit, gegen die mega43 steht.
    //
    // DIE ABLEITUNG IST DIE DES WEBS, ZIFFER FUER ZIFFER (apps/web/src/styles/marke.css):
    //   · `--brand`      = die belegte Markenfarbe selbst (#0578b7).
    //   · `--brand-text` und `--brand-deep` = 0,8 × jeder Kanal (#046092). Der Markenwert selbst
    //     traegt als TEXT auf Papier nur 4,36:1 und fiele unter AA — dieselbe Falle wie mega62 D.
    //   · `--ink`        = die zweite belegte Farbe, der dunkle Schriftzug (#161417). Sie traegt
    //     die Ueberschriften; auf Papier misst sie 17,3:1, auf Karte 18,3:1.
    //   · `--shadow-primary` = derselbe Knopfschein wie bisher, nur in der Markenfarbe.
    // WAS AUSDRUECKLICH NICHT ANGEFASST WIRD: `--pos-*`, `--warn-*` und jede andere Signalfarbe.
    // Eine Warnung bleibt gelb, ein Fehler rot — Bedeutung ist keine Marke.
    //
    // DER ABRUF: einmal beim Laden, danach beim Sichtbarwerden, beim Fokus und in einer stets neu
    // gestellten Frist — alle drei durch DIESELBE Drosselung von einem Abruf je Minute. Die Frist
    // ist die wichtigste der drei: ein Aufgabenfenster, das waehrend der Vorfuehrung offen daneben
    // steht, erzeugt gar kein Ereignis (BENs Befund an JOB 3511, dort im Kopf von `brandTheme.ts`).
    //
    // UND SIE IST AUSDRUECKLICH KEIN `setInterval`. Dieses Fenster haelt FRISTEN, keinen Takt —
    // eine Hauszusage, die an zwei Stellen gemessen wird: der Quelltext darf das Wort nicht
    // enthalten (word-addin.test.ts, „Poll-Lifecycle: sequenziell (kein Interval)"), und ka3
    // misst zur Laufzeit, dass es nie gerufen wird. Der Grund ist derselbe wie beim Anmeldepoll:
    // ein Intervall feuert weiter, waehrend ein Abruf noch laeuft, und legt Aufrufe uebereinander.
    // Die naechste Frist wird deshalb erst NACH dem jeweiligen Blick gestellt; es gibt immer genau
    // eine offene, nie zwei.
    // Faellt ein Abruf aus, passiert NICHTS: der zuletzt bekannte Stand bleibt sichtbar, es gibt
    // keine Meldung, und das Fenster bleibt voll bedienbar (LEHREN §7).
    var KW_MARKE_PFAD = "/api/branding";
    var KW_MARKE_ABSTAND_MS = 60000;
    /** Der Abtoenungsfaktor der texttragenden Markentoene — 0.8, wie in `styles/marke.css`. */
    var KW_MARKE_ABTOENUNG = 0.8;
    /** Die Deckung des Knopfscheins. Sie ist der Bestandswert, nur die Farbe wandert mit. */
    var KW_MARKE_SCHEIN = 0.45;
    /**
     * Der Alternativtext JE PROFIL. Er steht hier und NICHT im Woerterbuch: „Advisor ICT solutions
     * logo" ist der Alternativtext der Originaldatei (Auftragsgrundlage), also eine Eigenschaft des
     * Bildes und keine Uebersetzung — und als Zuordnung, damit ein zweites Profil ihn nicht erbt.
     */
    var KW_MARKE_ALT = { advisor: "Advisor ICT solutions logo" };
    /** Genau die Stellen, die die Marke belegt. Ausschalten heisst: diese fuenf wieder freigeben. */
    var KW_MARKE_TOKEN = ["--brand", "--brand-deep", "--brand-text", "--ink", "--shadow-primary"];
    /** Das zuletzt AUFGETRAGENE Aussehen (Kennung, s. u.); `null` = es wurde noch nichts gesetzt. */
    var kwMarkeAussehen = null;
    var kwMarkeLetzterAbruf = Number.NEGATIVE_INFINITY;
    var kwMarkeLaeuft = false;

    /** Die drei Kanaele eines 6-stelligen Hexwerts — oder `null`, wenn es keiner ist. */
    function kwMarkeKanaele(hex) {
      var treffer = /^#([0-9a-fA-F]{6})$/.exec(String(hex === undefined || hex === null ? "" : hex).trim());
      if (!treffer) { return null; }
      return [
        parseInt(treffer[1].slice(0, 2), 16),
        parseInt(treffer[1].slice(2, 4), 16),
        parseInt(treffer[1].slice(4, 6), 16)
      ];
    }

    /** Kanaele mit einem Faktor multipliziert, wieder als Hexwert (Faktor 1 = nur normalisiert). */
    function kwMarkeAbgetoent(kanaele, faktor) {
      var teile = [];
      for (var i = 0; i < 3; i += 1) {
        var wert = Math.round(kanaele[i] * faktor);
        wert = wert < 0 ? 0 : (wert > 255 ? 255 : wert);
        teile.push((wert < 16 ? "0" : "") + wert.toString(16));
      }
      return "#" + teile.join("");
    }

    /**
     * Traegt dieser Stand wirklich eine anzeigbare Marke?
     *
     * Der Server loest das schon auf (`brandingAntwort`: die Marke haengt an Profil UND Schalter) —
     * diese Flaeche verlaesst sich aber nicht darauf. Fehlt eine der Voraussetzungen oder ist ein
     * Farbwert unlesbar, gilt „keine Firmen-CI" und nicht „Firmen-CI mit halben Werten".
     */
    function kwMarkeGueltig(stand) {
      if (!stand || typeof stand !== "object" || stand.aktiv !== true) { return false; }
      if (typeof stand.profil !== "string" || !stand.profil) { return false; }
      var marke = stand.marke;
      if (!marke || typeof marke !== "object" || !marke.farben) { return false; }
      if (typeof marke.logo !== "string" || !marke.logo) { return false; }
      return !!(kwMarkeKanaele(marke.farben.primaer) && kwMarkeKanaele(marke.farben.schrift));
    }

    /** Den Stand auf die Flaeche schreiben — oder sie vollstaendig zurueckgeben. */
    function kwMarkeAnwenden(stand) {
      var wurzel = document.documentElement.style;
      var bild = document.getElementById("kw-marke-logo");
      if (!kwMarkeGueltig(stand)) {
        for (var i = 0; i < KW_MARKE_TOKEN.length; i += 1) {
          wurzel.removeProperty(KW_MARKE_TOKEN[i]);
        }
        if (bild) {
          bild.className = "hidden";
          // Kein `src = ""`: das waere ein Abruf auf die eigene Adresse, kein leeres Bild.
          bild.removeAttribute("src");
          bild.setAttribute("alt", "");
        }
        return;
      }
      var primaer = kwMarkeKanaele(stand.marke.farben.primaer);
      var schrift = kwMarkeKanaele(stand.marke.farben.schrift);
      var tief = kwMarkeAbgetoent(primaer, KW_MARKE_ABTOENUNG);
      wurzel.setProperty("--brand", kwMarkeAbgetoent(primaer, 1));
      wurzel.setProperty("--brand-deep", tief);
      wurzel.setProperty("--brand-text", tief);
      wurzel.setProperty("--ink", kwMarkeAbgetoent(schrift, 1));
      wurzel.setProperty(
        "--shadow-primary",
        "0 2px 10px -2px rgba(" + primaer[0] + ", " + primaer[1] + ", " + primaer[2] + ", " + KW_MARKE_SCHEIN + ")"
      );
      if (bild) {
        bild.setAttribute("src", stand.marke.logo);
        bild.setAttribute("alt", KW_MARKE_ALT[stand.profil] || stand.marke.name || "");
        bild.className = "";
      }
    }

    /**
     * Was dieser Stand SICHTBAR traegt — die Kennung des Aussehens, nicht die des Zaehlers.
     *
     * Verglichen wird genau das, was `kwMarkeAnwenden` schreibt: Profil, die beiden Markenfarben
     * und die Logoadresse. Zwei Staende mit derselben Kennung sehen zeichengleich aus; ein zweiter
     * Auftrag waere dann Arbeit ohne Wirkung.
     */
    function kwMarkeKennung(stand) {
      if (!kwMarkeGueltig(stand)) { return "aus"; }
      return [
        stand.profil,
        stand.marke.farben.primaer,
        stand.marke.farben.schrift,
        stand.marke.logo
      ].join("|");
    }

    /**
     * Einen eingetroffenen Stand pruefen und uebernehmen — AM AUSSEHEN, NICHT AM ZAEHLER.
     *
     * FRUEHER STAND HIER „nur vorwaerts": `version <= meine` wurde verworfen. Das war falsch, und
     * zwar an der Stelle, an der es weh tut. `version` gilt laut Vertrag (JOB 3510, Rueckgabe
     * Runde 3) NUR INNERHALB EINES PROZESSLAUFS: die Wahl liegt im Speicher, nach einem
     * Serverneustart beginnt der Zaehler wieder bei 0. Ein offenes Aufgabenfenster, das vorher
     * `version 9` gesehen hat, haette danach JEDE weitere Schaltung verworfen — es waere blau
     * geblieben, waehrend der Server laengst „aus" sagt. Der Vertrag schreibt darum ausdruecklich
     * „auf Version UNGLEICH meiner pruefen, nicht auf groesser als meine".
     *
     * Hier wird noch eine Stufe strenger verglichen, naemlich am AUSSEHEN: auch „ungleich" traegt
     * nach einem Neustart nicht sicher, weil derselbe Zaehlerstand dann einen ANDEREN Stand
     * bezeichnen kann (v2 vor dem Neustart „an", v2 danach „aus"). Die Kennung kann das nicht
     * verwechseln — sie ist aus den angezeigten Werten selbst gebildet.
     *
     * Und das Ueberholen, gegen das der Zaehler einmal antreten sollte? Dagegen steht `kwMarkeLaeuft`:
     * es ist baulich immer nur EIN Abruf offen (gemessen in W8), also kann keine aeltere Antwort
     * eine neuere ueberholen. Der Zaehler hat diesen Schutz nie geleistet, er hat nur den
     * Neustartfall zerstoert.
     *
     * `version` bleibt trotzdem gelesen — aber als VERTRAGSMERKMAL: eine 200er-Antwort ohne
     * numerische `version` ist keine Auskunft ueber die Marke, sondern Unsinn auf der Leitung. Sie
     * wird verworfen, und der zuletzt bekannte Look bleibt stehen (LEHREN §7).
     */
    function kwMarkeUebernehmen(stand) {
      if (!stand || typeof stand !== "object" || typeof stand.version !== "number") { return; }
      var kennung = kwMarkeKennung(stand);
      if (kennung === kwMarkeAussehen) { return; }
      kwMarkeAussehen = kennung;
      kwMarkeAnwenden(stand);
    }

    /** Einmal nachsehen. Gedrosselt ueber ALLE Anlaesse zusammen, nie zwei Abrufe gleichzeitig. */
    function kwMarkeHolen(erzwingen) {
      if (kwMarkeLaeuft || typeof fetch !== "function") { return; }
      var jetzt = Date.now();
      if (!erzwingen && jetzt - kwMarkeLetzterAbruf < KW_MARKE_ABSTAND_MS) { return; }
      kwMarkeLaeuft = true;
      kwMarkeLetzterAbruf = jetzt;
      var fertig = function () { kwMarkeLaeuft = false; };
      fetch(KW_MARKE_PFAD, { credentials: "include" })
        .then(function (antwort) { return antwort && antwort.ok ? antwort.json() : null; })
        .then(function (stand) { kwMarkeUebernehmen(stand); fertig(); }, fertig);
    }

    /** Die naechste Frist stellen — immer genau eine offene, gestellt NACH dem letzten Blick. */
    function kwMarkeFristStellen() {
      setTimeout(function () {
        kwMarkeHolen(false);
        kwMarkeFristStellen();
      }, KW_MARKE_ABSTAND_MS);
    }

    // Anschluss. Drei Anlaesse, eine Drosselung — und der erste Abruf blockiert nichts.
    if (typeof document !== "undefined" && document.getElementById("kw-marke-logo")) {
      document.addEventListener("visibilitychange", function () {
        // Nur das SICHTBARWERDEN zaehlt; beim Wegschalten hat ein Abruf keinen Adressaten.
        if (!document.hidden) { kwMarkeHolen(false); }
      });
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("focus", function () { kwMarkeHolen(false); });
      }
      if (typeof setTimeout === "function") { kwMarkeFristStellen(); }
      kwMarkeHolen(true);
    }
    // KW-MARKE-END

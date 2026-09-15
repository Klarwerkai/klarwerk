// ================================================================================================
// KLARA · WORD-RUECKWEG (JOB 3667) — DER BLOCK KW-RUECKWEG, ALS EIGENE DATEI.
// ================================================================================================
//
// WARUM DIESE DATEI UEBERHAUPT EXISTIERT, und zwar als EINZIGE Geschwisterdatei neben
// `taskpane.html`: das Aufgabenfenster ist buildlos und traegt seinen ganzen Code in EINEM
// Inline-Skript. Dessen Groesse ist bewacht (`tests/klara-zerlegung/schnittflaechen.test.ts` B3,
// Schranke 12500 Zeilen) — ein Riegel gegen weiteres Anbauen, solange der eigentliche Schnitt
// (P11 / JOB 3227) aussteht. Der Rueckweg hat den Riegel gerissen: 13182 >= 12500. Kuerzen half
// nicht (12974 ohne jeden Kommentar des Blocks), also wandert der Block heraus — die Grenze
// wurde NICHT angehoben.
//
// ZEILE FUER ZEILE VERSCHOBEN, NICHTS UMGESCHRIEBEN. Unterhalb dieses Kopfes steht der Abschnitt
// aus `taskpane.html` unveraendert, samt seiner Einrueckung und seiner Marken
// `KW-RUECKWEG-START`/`-END`. Wer beide Staende vergleichen will, vergleicht Text gegen Text;
// eine Umformatierung haette genau diese Pruefung unmoeglich gemacht. Dieselbe Sprache wie das
// Fenster: ES5, `var`, kein Modul, kein Build — deshalb steht die Datei (wie das andere
// handgeschriebene Add-in-Skript unter `services/app/addin-static`) auf der Ignorierliste von
// Biome. Sie ist kein Anwendungsquelltext im Sinne des Linters, sondern ein Stueck des
// ausgelieferten Fensters.
//
// LADEREIHENFOLGE, und sie ist Absicht: `taskpane.html` laedt diese Datei als KLASSISCHES Skript
// unmittelbar VOR dem Inline-Skript, also nach dem Rumpf. Beides zaehlt:
//   · nach dem Rumpf, weil die letzte Anweisung hier (`document.getElementById("rw-btn")`) die
//     Ereignisse des Kastens bindet — vor dem Rumpf faende sie nichts;
//   · vor dem Inline-Skript, damit dessen Funktionen `rwZeichnen` und `rwRolleMelden` schon
//     stehen. Beide werden dort AUSSCHLIESSLICH innerhalb von Funktionen gerufen (Sprachwechsel,
//     Markierung, Dublettenstand, checkSession), nie zur Ladezeit — umgekehrt braucht dieser
//     Block vom Fenster nur Dinge, die er erst beim Klick liest (`t`, `checkSession`,
//     `selectionToBodyHtml`, `officeUsable`, `signedIn` …). Die Richtungen schliessen sich also
//     nicht aus; die Aufrufe bleiben bewusst UNGESCHUETZT (kein `typeof`-Waechter): faellt diese
//     Datei aus, ist das ein Auslieferungsfehler und soll laut sein, nicht still.
//
// KEINE VERHALTENSAENDERUNG: `"use strict"` steht hier wie im Inline-Skript, damit der Block
// unter denselben Regeln laeuft wie vorher. Die Pruefstaende, die das Fenster im jsdom bauen,
// fuegen beide Skripte in DERSELBEN Reihenfolge zusammen (`splitTaskpane` in
// `tests/app/klara-panel-fixture.ts`); die Chromium-Buehnen liefern die Datei mit aus.
// ================================================================================================
"use strict";

    // ============================================================================================
    // JOB 3667 · WORD-RUECKWEG — DIE AENDERUNG GEHT AN DASSELBE WISSENSOBJEKT ZURUECK.
    // ============================================================================================
    //
    // PEDIS WORTLAUT (11.09. 17:20, ueber Codex): „kontrollierte Dokumentaktualisierung mit
    // Accountfreigaben + freiwilliger Zweitpruefung". Er oeffnet ein Wissensobjekt in Word, aendert
    // den Text und gibt die Aenderung zurueck — DANACH TRAEGT DASSELBE OBJEKT DEN NEUEN STAND.
    //
    // DER BEFUND, gegen den dieser Block steht: bis hierher legte JEDER Weg aus Word Neues an
    // (POST /api/drafts, POST /api/drafts/from-docx, promote ohne Zielobjekt). Wer in Word etwas
    // aenderte und zurueckgab, bekam ein ZWEITES Objekt daneben; die Zahl der PUT-Aufrufe im ganzen
    // Add-in war null. Der Schreibweg selbst fehlte nie — `PUT /api/kos/:id` mit `action: "revise"`
    // steht seit je da. Es fehlte der Weg dorthin.
    //
    // DIE FUENF ZUSAGEN, jede an ihrer Stelle im Code:
    //
    //  1 DAS ZIEL WIRD GEFRAGT, NIE GERATEN. Die Kandidaten sind die Treffer DERSELBEN
    //    Dublettenpruefung, die die Markierungskarte ohnehin faehrt (`captureDubletten`, JOB 3092) —
    //    kein zweiter Weg zur Route. Vorgewaehlt ist NICHTS, auch nicht bei genau einem Kandidaten:
    //    dass ein Text einem Eintrag aehnelt, ist keine Feststellung, welcher Eintrag hier
    //    bearbeitet wird. Das Ziel haengt am TEXT, zu dem es gewaehlt wurde (`rwZielText`): eine
    //    andere Markierung nimmt die Wahl zurueck (`rwBindungPruefen`), statt den neuen Text an das
    //    alte Ziel zu schicken.
    //
    //  2 DERSELBE SCHREIBWEG. `PUT /api/kos/:id`, `action: "revise"`. Kein neuer Endpunkt, kein
    //    Entwurf daneben, kein zweites Objekt. Der Rueckweg ist deshalb an dasselbe Recht gebunden
    //    wie das Erfassen (`ko.create`, ko-routes.ts) — keine neue Rolle, keine neue Berechtigung.
    //
    //  3 DIE VERSION REIST MIT. `expectedVersion` ist die Version, die BEIM LADEN des Ziels zu sehen
    //    war (GET /api/kos/:id). Hat sich das Objekt zwischenzeitlich geaendert, schreibt die Route
    //    NICHTS und antwortet 409 `KO_STALE` mit der jetzt gespeicherten Version. Hier steht dann
    //    genau dieser Satz und ein Knopf „Stand neu laden" — entschieden wird nicht automatisch,
    //    weder „meiner gewinnt" noch „abbrechen". Ohne belegte Version (`version` fehlt in der
    //    Antwort) gibt es KEIN Ziel: lieber kein Rueckweg als einer, der still ueberschreibt.
    //
    //  4 BEWUSSTER GRIFF, UND VORHER LESBAR. Geschrieben wird nur auf Klick auf #rw-btn; Tippen,
    //    Markieren und Zielwahl schreiben nichts. Was freigegeben wird, steht vorher in
    //    #rw-vorschau — dieselben Absaetze, die die Markierungskarte zeigt. UNMITTELBAR vor dem
    //    Absetzen wird die Markierung noch einmal frisch gelesen und mit der Vorschau verglichen
    //    (`rwMarkierungFrisch`, dieselbe Zerlegung `captureAbsaetze`, damit der Vergleich keine
    //    Formunterschiede meldet, die keine sind): auf einem Host OHNE DocumentSelectionChanged
    //    zeigt die Karte sonst einen Text, der so nicht mehr dasteht. Weichen sie ab, geht nichts
    //    hinaus. Eine leere Markierung geht nie hinaus — sie wuerde den Inhalt des Objekts loeschen.
    //
    //  5 DAS KONTO ENTSCHEIDET, WAS DER GRIFF TUT (Pedis Accountregel, Auftrag §4.5 —
    //    Primaerquelle SICHTBARES-GESPRAECH.jsonl:693: „Es kommt dabei aber darauf an, wer
    //    angemeldet ist … dies muss nochmal von jemand anders ueberprueft werden"). ZWEI FAELLE,
    //    und sie sind NICHT gleich:
    //
    //    FALL 1 — BERECHTIGTES KONTO (`users.manage`): der Griff aktualisiert das Objekt UND gibt
    //      es frei, in EINEM Aufruf (`action: "revise-release"`). RUNDE 2: das waren zwei Aufrufe
    //      (`revise`, dann `admin-validate`), und dazwischen lag eine Spanne, in der ein fremder
    //      Schreiber die Fassung wechseln konnte — freigegeben worden waere dann SEIN Text. Der
    //      Dienst macht jetzt beides in einer Transaktion; WER wann freigegeben hat, steht im Beleg
    //      (`ko.admin-validated`, Akteur + Zeit) und in `ownership.validators`.
    //      WARUM `users.manage` UND NICHT `ko.validate`: eine Bewertung ist EINE Stimme von
    //      `neededValidations` (Werksvorgabe 3, knowledge-object/src/service.ts). Sie macht die
    //      Aenderung NICHT „gleich" gueltig — genau das verlangt Pedis Satz aber. Heute traegt
    //      `users.manage` nur die Rolle `admin` (services/rbac/src/policy.ts); soll ein Controller
    //      das auch duerfen, ist das eine Aenderung der Rechtematrix, keine dieses Fensters.
    //
    //    FALL 2 — JEDES ANDERE KONTO: es aktualisiert NICHT. Es reicht einen an DIESES Objekt
    //      GEBUNDENEN Vorschlag ein (`action: "propose"` → `KoProposal` am Objekt). Der freigegebene
    //      Stand BLEIBT unangetastet stehen — wer das Objekt liest, sieht weiter ihn, nicht den
    //      Vorschlag. Das ist die Zusage „der geprüfte Stand darf nicht vorzeitig als ersetzt
    //      ausgegeben werden"; sie ist kein Versprechen dieser Flaeche, sondern die Bauform des
    //      Schreibvorgangs. UND SIE HAENGT NICHT AN DIESEM FENSTER: die Route weist seit Runde 2
    //      auch einen direkten `revise` auf ein freigegebenes Objekt ab, wenn das Recht fehlt
    //      (403 `PROPOSAL_REQUIRED`) — eine Regel, die ein Aufruf mit curl aushebelt, ist keine.
    //
    //    FALL 3 — BERECHTIGTES KONTO WAEHLT FALL 2: der Haken „Erst jemand anderen ansehen lassen".
    //      NUR HIER ist etwas freiwillig. Beim nicht berechtigten Konto gibt es den Haken nicht —
    //      dort steht der Satz „Freigabe durch andere ist Pflicht.", und der Griff kann nichts
    //      anderes tun. Wer nicht freigeben darf, gibt seine eigene Aenderung nie selbst frei.
    //
    //    DIE ENTSCHEIDUNG UEBER EINEN VORSCHLAG schliesst den Kreis: das berechtigte Konto sieht die
    //    OFFENEN Vorschlaege des gewaehlten Objekts (aus `ko.proposals`, beim Laden mitgelesen) und
    //    uebernimmt oder lehnt einen ab (`action: "decide-proposal"`). Beim eigenen Vorschlag steht
    //    KEIN Knopf: eine Pruefung durch sich selbst ist keine (Server: `PROPOSAL_OWN`).
    //
    // WAS DIESER WEG NICHT TUT, damit niemand es annimmt: er holt KEINE Bilder nach (der Sendeweg
    // tut das ueber `holeWordBilder`). Ein nicht herausgegebenes Bild wird GEZAEHLT und gesagt —
    // ueber dieselbe Bilanz und denselben Wortlaut wie am Entwurfsweg (`bilderBilanz`/`bilderText`),
    // nicht stillschweigend weggelassen. Und er aendert den TITEL des Objekts nicht: der Rueckweg
    // traegt den Text zurueck, nicht die Benennung.
    // KW-RUECKWEG-START
    var rwZiel = null;      // { id, title, version, vorschlaege } — das GEWAEHLTE Objekt, vom Server
    var rwZielText = "";    // die Markierung, zu der das Ziel gewaehlt wurde (Bindung an den Text)
    var rwLage = "ruhe";    // ruhe | laden | senden
    var rwSatz = null;      // { text, warn, aktion } — der EINE sichtbare Satz, oder keiner
    var rwLauf = 0;         // Laufnummer: ein spaeter Rueckruf eines aelteren Griffs wird verworfen
    var rwRolle = null;     // die Rolle der Sitzung (aus /api/auth/me), null = nicht angemeldet
    var rwIchId = null;     // die eigene Kennung — ein eigener Vorschlag ist keine fremde Pruefung

    /**
     * DIE ACCOUNTREGEL, an EINER Stelle. „Berechtigt" heisst: das Konto darf eine Aenderung GLEICH
     * als geprueft ablegen — im Bestand ist das genau die Aktion `admin-validate`, und die verlangt
     * `users.manage`. Diese Liste ist der Spiegel von `ROLE_PERMISSIONS`
     * (services/rbac/src/policy.ts); dass sie ihm gleich bleibt, misst
     * tests/word-rueckweg/accountregel-spiegel.test.ts — der Test LIEST die Matrix, statt sie noch
     * einmal abzuschreiben, und wird rot, sobald sich dort etwas bewegt.
     *
     * DER SERVER BLEIBT DIE AUTORITAET: das Fenster waehlt damit nur den WEG. Liegt es falsch,
     * antwortet die Route 403, und der Satz sagt es — geschrieben wird nichts.
     */
    var KW_RW_FREIGABE_ROLLEN = ["admin"];

    function rwDarfFreigeben() {
      return typeof rwRolle === "string" && KW_RW_FREIGABE_ROLLEN.indexOf(rwRolle) !== -1;
    }

    /**
     * checkSession meldet die Identitaet — ohne Sitzung gibt es keine Rolle und kein Recht.
     *
     * DIE KENNUNG WIRD MITGENOMMEN (Runde 2, Befund 2 des Pruefers): eine Zweitpruefung ist erst
     * eine, wenn sie von JEMAND ANDEREM kommt. Ohne die eigene Kennung koennte das Fenster den
     * eigenen Vorschlag nicht von einem fremden unterscheiden und boete den Freigabeknopf an
     * beiden an. Die Regel selbst haelt der Server (`PROPOSAL_OWN`); hier geht es darum, keinen
     * Knopf anzubieten, der nur zu einer Absage fuehren kann.
     */
    function rwRolleMelden(user) {
      var rolle = user && typeof user.role === "string" ? user.role : null;
      var kennung = user && typeof user.id === "string" ? user.id : null;
      if (rolle !== rwRolle || kennung !== rwIchId) {
        rwRolle = rolle;
        rwIchId = kennung;
        rwZeichnen();
      }
    }

    // ---- Die OFFENEN Vorschlaege eines geladenen Objekts -----------------------------------------
    //
    // RUNDE 2: sie kommen aus `ko.proposals` — einem eigenen, getypten Datensatz am Objekt
    // (services/knowledge-object/src/types.ts, `KoProposal`). In Runde 1 trug ein KOMMENTAR mit
    // einer Textmarke den Vorschlag; der Pruefer hat den Fehler benannt: ein Kommentar kennt keinen
    // entschiedenen Zustand, also war jeder Vorschlag fuer immer „offen" — auch ein laengst
    // uebernommener oder abgelehnter. Hier wird `status` gelesen, und nur „offen" steht im Bild.
    function rwVorschlaegeAus(ko) {
      var raus = [];
      var liste = ko && Array.isArray(ko.proposals) ? ko.proposals : [];
      for (var i = 0; i < liste.length; i += 1) {
        var p = liste[i];
        if (!p || p.status !== "offen" || typeof p.id !== "string") { continue; }
        raus.push({
          id: p.id,
          wer: p.author ? String(p.author) : "",
          zeit: p.at ? String(p.at).slice(0, 10) : "",
          version: typeof p.baseVersion === "number" ? p.baseVersion : null,
          text: typeof p.statement === "string" ? p.statement : "",
          // RUNDE 4 (Prueferbefund 13.09.): TRAEGT DER VORSCHLAG EINEN FLIESSTEXT? Nur die TATSACHE
          // reist mit, nicht das HTML — dieses Fenster setzt nirgends fremdes HTML in den Baum, und
          // eine Ausnahme dafuer waere ein Sink. Die Folge steht in `rwVorschlaegeZeichnen`: was hier
          // nicht angezeigt werden kann, wird hier auch nicht freigegeben.
          rumpf: typeof p.bodyHtml === "string" && p.bodyHtml.trim().length > 0,
          // RUNDE 5: WILL der Vorschlag den ausfuehrlichen Inhalt LOESCHEN? Nur das ausdrueckliche
          // Signal `clearBody` heisst das. Ein fehlender Rumpf ist seit R5 ein „nicht eingereicht":
          // die Uebernahme laesst den bestehenden Inhalt dann stehen (service.ts, rumpfAusVorschlag).
          rumpfWeg: p.clearBody === true,
          // Der eigene Vorschlag bekommt keinen Freigabeknopf — s. `rwRolleMelden`.
          eigen: Boolean(rwIchId) && p.author === rwIchId
        });
      }
      return raus;
    }

    /**
     * Traegt der geladene Stand einen Fliesstext? Davon haengt ab, WAS ueber ihn zu sagen ist.
     *
     * RUNDE 5 HAT DIE WIRKUNG GEAENDERT, nicht nur ihre Anzeige: `KoService.decideProposal` uebergab
     * `bodyHtml: vorschlag.bodyHtml ?? null`, und `null` heisst in `naechsteFassung` „leeren". Ein
     * Vorschlag ohne Fliesstext — und genau so reicht DIESES Fenster ein (`rwEinreichen`) — haette
     * bei der Freigabe den ganzen Fliesstext des Eintrags ENTFERNT. Seit R5 gilt: ausgelassen ist
     * nicht geloescht (service.ts, `rumpfAusVorschlag`). Geloescht wird nur auf das ausdrueckliche
     * `clearBody`; ein Textvorschlag aus Word laesst den Inhalt stehen. Beides steht im Bild, bevor
     * jemand greift — der Pruefer soll das ERGEBNIS kennen, nicht nur den Vorschlag.
     */
    function rwHatRumpf(ko) {
      return Boolean(ko && typeof ko.bodyHtml === "string" && ko.bodyHtml.trim().length > 0);
    }

    /** Die Treffer der Dublettenpruefung mit belegter Kennung — nur sie koennen ein Ziel sein. */
    function rwKandidaten() {
      var d = captureDubletten;
      if (!d || d.lage !== "treffer" || !Array.isArray(d.treffer)) { return []; }
      var raus = [];
      for (var i = 0; i < d.treffer.length; i += 1) {
        var e = d.treffer[i];
        if (e && typeof e.id === "string" && e.id.length > 0) { raus.push(e); }
      }
      return raus;
    }

    function rwMarkierungsText() {
      return captureMarkierung.join("\n");
    }

    /**
     * Die Wahl haengt am Text: eine andere Markierung nimmt Ziel und Satz zurueck.
     *
     * EINE AUSNAHME, und sie ist der Grund fuer das Feld `halten`: der Satz „Die Markierung hat sich
     * geaendert — nichts gesendet." entsteht GENAU DANN, wenn diese Bindung bricht. Ohne die
     * Ausnahme loeschte der naechste Neuzeichnen-Lauf die einzige Erklaerung dafuer, dass nichts
     * hinausging — und zurueck bliebe ein stummer Abbruch.
     */
    function rwBindungPruefen() {
      if (rwZiel && rwZielText !== rwMarkierungsText()) {
        rwLauf += 1;
        rwZiel = null;
        rwZielText = "";
        rwLage = "ruhe";
        if (!(rwSatz && rwSatz.halten)) { rwSatz = null; }
      }
    }

    function rwSatzSetzen(text, warn, aktion, halten) {
      rwSatz = text
        ? { text: text, warn: Boolean(warn), aktion: aktion || null, halten: Boolean(halten) }
        : null;
    }

    /** Die Fehlersaetze sind die des Sendewegs — ein zweiter Wortlaut waere eine zweite Wahrheit. */
    function rwFehlersatz(status) {
      if (status === 401) { return t("sendAuth"); }
      if (status === 403) { return t("sendForbidden"); }
      if (status === 404) { return t("rwLadeFehler"); }
      return t("sendError", { detail: "HTTP " + status });
    }

    /** EINE Kandidatenzeile: ein Knopf, reiner Text (kein HTML-Sink), der Klick waehlt das Ziel. */
    function rwKandidatenZeile(eintrag) {
      var zeile = document.createElement("li");
      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "ghost";
      knopf.setAttribute("data-ziel", eintrag.id);
      knopf.setAttribute("aria-pressed", rwZiel && rwZiel.id === eintrag.id ? "true" : "false");
      knopf.textContent = eintrag.title || eintrag.id;
      knopf.addEventListener("click", function () { rwZielWaehlen(eintrag.id); });
      zeile.appendChild(knopf);
      return zeile;
    }

    /**
     * Geht dieser Griff den Pruefweg (Fall 2/3)? Zwei Gruende, ein Ergebnis: das Konto DARF nicht
     * freigeben (Pflicht) — oder es darf und WAEHLT den Pruefweg (der Haken, Fall 3).
     */
    function rwPruefweg() {
      if (!rwDarfFreigeben()) { return true; }
      var haken = document.getElementById("rw-zweit");
      return Boolean(haken && haken.checked === true);
    }

    /** Die offenen Vorschlaege des Ziels. Der Freigabeknopf steht NUR beim berechtigten Konto. */
    function rwVorschlaegeZeichnen() {
      var block = document.getElementById("rw-vorschlaege");
      var liste = document.getElementById("rw-vorschlaege-liste");
      if (!block || !liste) { return; }
      var offen = rwZiel && Array.isArray(rwZiel.vorschlaege) ? rwZiel.vorschlaege : [];
      block.className = offen.length > 0 ? "" : "hidden";
      while (liste.firstChild) { liste.removeChild(liste.firstChild); }
      for (var i = 0; i < offen.length; i += 1) {
        var v = offen[i];
        var zeile = document.createElement("li");
        zeile.setAttribute("data-vorschlag", v.id);
        var kopf = document.createElement("p");
        kopf.className = "muted";
        kopf.textContent = t("rwVorschlagZeile", {
          wer: v.wer,
          zeit: v.zeit,
          n: v.version === null ? "?" : String(v.version)
        });
        zeile.appendChild(kopf);
        var text = document.createElement("p");
        text.className = "rw-vorschlag-text";
        text.textContent = v.text;
        zeile.appendChild(text);
        // Ein Vorschlag aus einer aelteren Fassung sagt das — er wuerde die Zwischenstaende ersetzen.
        if (rwZiel && v.version !== null && v.version !== rwZiel.version) {
          var alt = document.createElement("p");
          alt.className = "muted";
          alt.textContent = t("rwVorschlagAelter", { n: String(v.version), m: String(rwZiel.version) });
          zeile.appendChild(alt);
        }
        // RUNDE 4 · FREIGEGEBEN WIRD NUR, WAS ANGEZEIGT WURDE.
        //
        // Traegt der Vorschlag einen Fliesstext, kann dieses Fenster ihn nicht zeigen (kein HTML in
        // den Baum, s. `rwVorschlaegeAus`) — dann gibt es hier KEINEN Freigabeknopf, sondern den
        // Satz mit dem Weg nach KLARWERK. Ablehnen bleibt: eine Ablehnung schreibt keinen Inhalt.
        // RUNDE 5 · DREI LAGEN STATT ZWEI, und die dritte ist der Normalfall aus Word: der
        // Vorschlag traegt nur Text, der Eintrag hat einen ausfuehrlichen Inhalt — der BLEIBT jetzt
        // stehen (service.ts, `rumpfAusVorschlag`). Geloescht wird nur auf das ausdrueckliche
        // `clearBody`, und dann sagt es der Warnsatz. Der Pruefer liest also in jeder Lage, was
        // nach der Freigabe im Eintrag steht — nicht bloss, was der Vorschlag mitbringt.
        var rumpfSatz = null;
        var rumpfLage = null;
        var rumpfWarnt = true;
        if (v.rumpf) {
          rumpfSatz = t("rwVorschlagRumpf");
          rumpfLage = "nicht-lesbar";
        } else if (v.rumpfWeg && rwZiel && rwZiel.rumpf) {
          rumpfSatz = t("rwVorschlagRumpfWeg");
          rumpfLage = "entfernt";
        } else if (!v.rumpfWeg && rwZiel && rwZiel.rumpf) {
          rumpfSatz = t("rwVorschlagRumpfBleibt");
          rumpfLage = "bleibt";
          rumpfWarnt = false;
        }
        if (rumpfSatz) {
          var rumpfZeile = document.createElement("p");
          rumpfZeile.className = rumpfWarnt ? "warn" : "muted";
          rumpfZeile.setAttribute("data-rumpf", rumpfLage);
          rumpfZeile.textContent = rumpfSatz;
          zeile.appendChild(rumpfZeile);
        }
        // DIE FREMDE PRUEFUNG: nur ein anderes, freigabeberechtigtes Konto entscheidet. Am EIGENEN
        // Vorschlag steht kein Knopf, sondern der Satz, warum — ein Knopf, der sicher eine Absage
        // ergibt (Server: `PROPOSAL_OWN`), waere ein Versprechen, das die Fläche nicht halten kann.
        if (rwDarfFreigeben()) {
          if (v.eigen) {
            var eigen = document.createElement("p");
            eigen.className = "muted";
            eigen.textContent = t("rwVorschlagEigen");
            zeile.appendChild(eigen);
          } else {
            if (!v.rumpf) {
              zeile.appendChild(rwVorschlagKnopf(v, "uebernehmen"));
            }
            zeile.appendChild(rwVorschlagKnopf(v, "ablehnen"));
          }
        }
        liste.appendChild(zeile);
      }
    }

    function rwVorschlagKnopf(vorschlag, entscheidung) {
      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "ghost";
      knopf.setAttribute(entscheidung === "ablehnen" ? "data-ablehnen" : "data-freigabe", vorschlag.id);
      knopf.textContent = t(entscheidung === "ablehnen" ? "rwVorschlagAblehnenCta" : "rwVorschlagCta");
      knopf.addEventListener("click", function () { rwVorschlagEntscheiden(vorschlag, entscheidung); });
      return knopf;
    }

    /** Was freigegeben wird, steht lesbar da: genau die Absaetze der Markierungskarte. */
    function rwVorschauZeichnen() {
      var kasten = document.getElementById("rw-vorschau");
      if (!kasten) { return; }
      while (kasten.firstChild) { kasten.removeChild(kasten.firstChild); }
      for (var i = 0; i < captureMarkierung.length; i += 1) {
        var absatz = document.createElement("p");
        absatz.textContent = captureMarkierung[i];
        kasten.appendChild(absatz);
      }
    }

    function rwZeichnen() {
      var block = document.getElementById("rw-block");
      if (!block) { return; }
      rwBindungPruefen();
      var kandidaten = rwKandidaten();
      // Ohne Kandidaten gibt es kein Ziel — und ein leerer Kasten waere eine Aussage ueber einen nie
      // gelaufenen Vorgang. Ohne Anmeldung und ohne Word erst recht nicht.
      block.className = signedIn && officeUsable() && kandidaten.length > 0 ? "" : "hidden";
      var liste = document.getElementById("rw-liste");
      while (liste.firstChild) { liste.removeChild(liste.firstChild); }
      for (var i = 0; i < kandidaten.length; i += 1) {
        liste.appendChild(rwKandidatenZeile(kandidaten[i]));
      }
      var zielBlock = document.getElementById("rw-ziel");
      zielBlock.className = rwZiel ? "" : "hidden";
      if (rwZiel) {
        document.getElementById("rw-ziel-zeile").textContent =
          t("rwZielZeile", { titel: rwZiel.title, n: String(rwZiel.version) });
        rwVorschauZeichnen();
        rwVorschlaegeZeichnen();
      }
      // DIE ACCOUNTREGEL IM BILD: der Haken ist die Wahl des BERECHTIGTEN (Fall 3). Wer nicht
      // freigeben darf, sieht keinen Haken — er sieht, dass die Freigabe durch andere Pflicht ist.
      var darf = rwDarfFreigeben();
      document.getElementById("rw-zweit-zeile").className = darf ? "" : "hidden";
      document.getElementById("rw-pflicht").className = darf ? "muted hidden" : "muted";
      var knopf = document.getElementById("rw-btn");
      knopf.textContent = t(rwPruefweg() ? "rwCtaEinreichen" : "rwCtaFrei");
      knopf.disabled = rwLage === "senden" || rwLage === "laden";
      var satzEl = document.getElementById("rw-status");
      var knopf = document.getElementById("rw-status-btn");
      satzEl.textContent = rwSatz ? rwSatz.text : "";
      satzEl.className = !rwSatz ? "hidden" : rwSatz.warn ? "warn" : "";
      if (rwSatz && rwSatz.aktion === "neu-laden") {
        knopf.textContent = t("rwStaleCta");
        knopf.className = "ghost";
      } else {
        knopf.textContent = "";
        knopf.className = "ghost hidden";
      }
    }

    /** Der EINE Abrufweg dieses Blocks: das Ziel laden UND schreiben gehen hier durch. */
    function rwRuf(id, init) {
      return fetch("/api/kos/" + encodeURIComponent(id), init);
    }

    /**
     * Das Ziel waehlen heisst: es beim Server LESEN. Titel und Version kommen aus der Antwort, nicht
     * aus dem Dublettentreffer — sie sind die Grundlage des bedingten Schreibzugriffs und muessen so
     * frisch sein wie moeglich.
     */
    function rwZielWaehlen(id) {
      rwLauf += 1;
      var lauf = rwLauf;
      var text = rwMarkierungsText();
      rwZiel = null;
      rwLage = "laden";
      rwSatzSetzen(t("rwLaden"), false, null);
      rwZeichnen();
      rwRuf(id, { credentials: "include" })
        .then(function (res) {
          if (lauf !== rwLauf) { return null; }
          if (!res.ok) {
            rwLage = "ruhe";
            rwSatzSetzen(rwFehlersatz(res.status), true, null);
            if (res.status === 401 && typeof checkSession === "function") { checkSession(); }
            rwZeichnen();
            return null;
          }
          return res.json();
        })
        .then(function (ko) {
          if (!ko || lauf !== rwLauf) { return; }
          var version = typeof ko.version === "number" && isFinite(ko.version) ? ko.version : null;
          if (version === null) {
            // Ohne belegte Version gibt es keinen bedingten Schreibzugriff — und ohne den keinen
            // Rueckweg. Kein Ziel ist besser als eines, das still ueberschreiben wuerde.
            rwLage = "ruhe";
            rwSatzSetzen(t("rwLadeFehler"), true, null);
            rwZeichnen();
            return;
          }
          rwZiel = {
            id: id,
            title: ko.title ? String(ko.title) : id,
            version: version,
            // Hat DIESER Stand einen Fliesstext? Nur dann kann eine Freigabe ihn entfernen.
            rumpf: rwHatRumpf(ko),
            // Die offenen Vorschlaege reisen mit dem Ziel — sie gehoeren zu DIESEM Stand.
            vorschlaege: rwVorschlaegeAus(ko)
          };
          rwZielText = text;
          rwLage = "ruhe";
          rwSatzSetzen(null);
          rwZeichnen();
        })
        .catch(function (err) {
          if (lauf !== rwLauf) { return; }
          rwLage = "ruhe";
          rwSatzSetzen(sendeFehlerText(err), true, null);
          rwZeichnen();
        });
    }

    /** Die Markierung JETZT — durch dieselbe Zerlegung wie die Vorschau. `null` = nichts Lesbares. */
    function rwMarkierungFrisch(done) {
      try {
        Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, function (r) {
          done(r && r.status === Office.AsyncResultStatus.Succeeded
            ? captureAbsaetze(String(r.value || "")).join("\n")
            : null);
        });
      } catch (err) {
        done(null);
      }
    }

    /** Das HTML der Markierung; gibt Word keines her, ist das kein Abbruch — `""` heisst Klartext. */
    function rwAuswahlHtml(done) {
      try {
        Office.context.document.getSelectedDataAsync(Office.CoercionType.Html, function (r) {
          done(r && r.status === Office.AsyncResultStatus.Succeeded ? String(r.value || "") : "");
        });
      } catch (err) {
        done("");
      }
    }

    /**
     * Die Schreibladung des Rueckwegs — dieselbe Bauform wie `prepareWordDraftRequest`, aber fuer den
     * Revise-Koerper: erst das Word-HTML, bei Budgetueberschreitung erst Bilder weglassen, dann der
     * Klartext. Was dabei verloren geht, steht in der Bilanz und wird gesagt (bilderBilanz).
     */
    function rwSchreibladung(html, text, version) {
      var statement = text.trim();
      var bauen = function (koerper) {
        return JSON.stringify({
          // RUNDE 2: EINE Aktion fuer Fassung UND Freigabe (s. `rwUeberarbeiten`).
          action: "revise-release",
          expectedVersion: version,
          changes: { bodyHtml: koerper, statement: statement }
        });
      };
      var inner = extractWordBodyHtml(html || "");
      if (inner.length === 0) {
        return { payload: bauen(selectionToBodyHtml(text)), usedHtml: false, overBudget: false, undeliveredImages: 0, plainTextFallback: true, droppedImages: 0 };
      }
      var passt = function (kandidat) {
        return wordHtmlUtf8Bytes(bauen(kandidat)) <= WORD_ADDIN_BODY_BUDGET_BYTES;
      };
      if (!passt(inner)) {
        var getrimmt = trimWordImagesToBudget(inner, passt);
        if (getrimmt.passt && getrimmt.dropped > 0) {
          return { payload: bauen(getrimmt.html), usedHtml: true, overBudget: false, undeliveredImages: countUndeliveredWordImages(getrimmt.html), plainTextFallback: false, droppedImages: getrimmt.dropped };
        }
        return { payload: bauen(selectionToBodyHtml(text)), usedHtml: false, overBudget: true, undeliveredImages: countUndeliveredWordImages(inner), plainTextFallback: false, droppedImages: 0 };
      }
      return { payload: bauen(inner), usedHtml: true, overBudget: false, undeliveredImages: countUndeliveredWordImages(inner), plainTextFallback: false, droppedImages: 0 };
    }

    /** Der Abbruchweg beider Griffe: Lage zurueck auf Ruhe, EIN Satz, nichts behauptet. */
    function rwAbbruch(lauf, text, halten) {
      if (lauf !== rwLauf) { return; }
      rwLage = "ruhe";
      rwSatzSetzen(text, true, null, halten);
      rwZeichnen();
    }

    /**
     * EIN Satz, und die ehrliche Bilderbilanz haengt dran (derselbe Wortlaut wie am Sendeweg).
     *
     * `ohneBilanz` ist KEIN Schalter fuer Bequemlichkeit: beim Freigeben eines eingereichten
     * Vorschlags gibt es gar keine Word-Auswahl, aus der etwas haette verlorengehen koennen. Ein
     * „Word lieferte kein verwertbares HTML" waere dort eine Aussage ueber einen Vorgang, den es
     * nicht gab.
     */
    function rwSatzMitBildern(satz, ladung, warn) {
      var bilder = ladung && ladung.ohneBilanz !== true ? bilderText(bilderBilanz(ladung)) : "";
      rwLage = "ruhe";
      rwSatzSetzen(bilder ? satz + " " + bilder : satz, warn, null);
      rwZeichnen();
    }

    /**
     * DER SCHREIBZUGRIFF DES BERECHTIGTEN — EIN AUFRUF, NICHT ZWEI (Runde 2, Befund 3).
     *
     * `action: "revise-release"` schreibt die neue Fassung UND gibt sie frei, in einer einzigen
     * Transaktion des Dienstes. In Runde 1 waren das zwei Aufrufe, und dazwischen lag eine Spanne,
     * in der ein fremder Schreiber die Fassung wechseln konnte — freigegeben worden waere dann SEIN
     * Text. Diese Spanne gibt es nicht mehr; es gibt auch keinen Zwischensatz „Freigabe steht noch
     * aus" mehr, weil es keinen Zwischenzustand mehr gibt.
     *
     * DENSELBEN Weg nimmt die Uebernahme eines eingereichten Vorschlags (`decide-proposal`) — nur
     * mit einer anderen Nutzlast; die Antwortbehandlung ist dieselbe, und genau deshalb steht sie
     * hier einmal.
     */
    function rwUeberarbeiten(ziel, ladung, lauf) {
      rwRuf(ziel.id, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: ladung.payload
      })
        .then(function (res) {
          if (lauf !== rwLauf) { return null; }
          if (res.status === 409) {
            // DER TEURE FALL: fremd geaendert. NICHTS wurde ueberschrieben — und entschieden wird
            // hier nichts, der Mensch bekommt die neue Version und den Weg dorthin.
            return res.json().then(function (koerper) {
              if (lauf !== rwLauf) { return; }
              var jetzt = koerper && typeof koerper.currentVersion === "number" ? koerper.currentVersion : null;
              rwLage = "ruhe";
              rwSatzSetzen(jetzt === null ? t("rwLadeFehler") : t("rwStale", { n: String(jetzt) }), true, "neu-laden");
              rwZeichnen();
            });
          }
          if (!res.ok) {
            rwLage = "ruhe";
            rwSatzSetzen(rwFehlersatz(res.status), true, null);
            if (res.status === 401 && typeof checkSession === "function") { checkSession(); }
            rwZeichnen();
            return null;
          }
          return res.json().then(function (ko) {
            if (lauf !== rwLauf) { return; }
            // Die Version kommt aus der ANTWORT — nicht aus „alt + 1", das waere geraten.
            var version = ko && typeof ko.version === "number" && isFinite(ko.version) ? ko.version : null;
            if (version === null) {
              rwSatzMitBildern(t("rwLadeFehler"), null, true);
              return;
            }
            rwZiel = {
              id: ziel.id,
              title: ziel.title,
              version: version,
              // Auch der Fliesstext-Befund kommt aus der ANTWORT: die soeben geschriebene Fassung
              // kann einen haben, wo der alte Stand keinen hatte — und umgekehrt.
              rumpf: rwHatRumpf(ko),
              // Die Vorschlagsliste kommt aus der Antwort des Servers, nicht aus dem alten Stand.
              vorschlaege: rwVorschlaegeAus(ko)
            };
            // WAS GILT, SAGT DER SERVER — nicht dieser Knopf. Nur ein `status: "validiert"` in der
            // Antwort darf „freigegeben" heissen; alles andere ist eine offene Freigabe und wird
            // auch so genannt (der Fall kann nur eintreten, wenn die Route den Weg aendert).
            var frei = ko.status === "validiert";
            rwSatzMitBildern(
              t(frei ? "rwFertigFrei" : "rwFertigOffen", { n: String(version) }),
              ladung,
              !frei
            );
          });
        })
        .catch(function (err) { rwAbbruch(lauf, sendeFehlerText(err)); });
    }

    /**
     * DER WEG DES NICHT BERECHTIGTEN — UND DES BERECHTIGTEN, DER IHN WAEHLT (Fall 2/3).
     *
     * Hier wird das Objekt NICHT angefasst: `action: "propose"` legt einen GEBUNDENEN
     * Aenderungsvorschlag an (`KoProposal`), und der Inhalt, die Version und der Pruefstand des
     * Objekts bleiben, wie sie sind. Wer das Objekt liest, sieht weiter den freigegebenen Stand —
     * genau das ist die Zusage aus §4.5(2).
     *
     * `baseVersion` ist die Fassung, die der Einreicher gesehen hat; hat sich das Objekt inzwischen
     * bewegt, weist der Server den Vorschlag ab (409 `KO_STALE`) statt ihn an eine Fassung zu
     * haengen, die es nicht mehr gibt. `origin` sagt, woher er kam — dieselbe feste Herkunft, die
     * der Entwurfsweg seit JOB 660 traegt.
     *
     * HIER GEHT KEIN `bodyHtml` HINAUS, UND DAS IST SEIT RUNDE 5 EINE AUSSAGE: der Vorschlag aendert
     * die AUSSAGE, sonst nichts. Der ausfuehrliche Inhalt des Eintrags bleibt bei der Uebernahme
     * unveraendert stehen (service.ts, `rumpfAusVorschlag`: ausgelassen ist nicht geloescht). Ein
     * `clearBody` schickt dieses Fenster nie — wer aus Word Text zurueckgibt, will kein Dokument
     * loeschen, und die Loeschung ist ein eigener, ausdruecklicher Griff in KLARWERK.
     */
    function rwEinreichen(ziel, text, lauf) {
      rwRuf(ziel.id, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "propose",
          proposal: {
            statement: text,
            baseVersion: ziel.version,
            origin: "word_addin"
          }
        })
      })
        .then(function (res) {
          if (lauf !== rwLauf) { return null; }
          if (res.status === 409) {
            // Der Stand hat sich bewegt, WAEHREND getippt wurde — eingereicht wurde nichts.
            return res.json().then(function (koerper) {
              if (lauf !== rwLauf) { return; }
              var jetzt = koerper && typeof koerper.currentVersion === "number" ? koerper.currentVersion : null;
              rwLage = "ruhe";
              rwSatzSetzen(jetzt === null ? t("rwEinreichFehler") : t("rwStale", { n: String(jetzt) }), true, "neu-laden");
              rwZeichnen();
            });
          }
          if (!res.ok) {
            rwLage = "ruhe";
            rwSatzSetzen(res.status === 401 || res.status === 403 ? rwFehlersatz(res.status) : t("rwEinreichFehler"), true, null);
            if (res.status === 401 && typeof checkSession === "function") { checkSession(); }
            rwZeichnen();
            return null;
          }
          return res.json().then(function (ko) {
            if (lauf !== rwLauf) { return; }
            // Der eingereichte Vorschlag steht sofort in der Liste — aus der Antwort des Servers.
            rwZiel = { id: ziel.id, title: ziel.title, version: ziel.version, rumpf: rwHatRumpf(ko), vorschlaege: rwVorschlaegeAus(ko) };
            rwLage = "ruhe";
            rwSatzSetzen(t("rwEingereicht"), false, null);
            rwZeichnen();
          });
        })
        .catch(function (err) { rwAbbruch(lauf, sendeFehlerText(err)); });
    }

    /** DER GRIFF: was er tut, entscheidet das Konto (und im berechtigten Fall der Haken). */
    function rwFreigeben() {
      if (!rwZiel || rwLage === "senden") { return; }
      if (!officeUsable()) {
        rwSatzSetzen(t("noOffice"), true, null);
        rwZeichnen();
        return;
      }
      rwLauf += 1;
      var lauf = rwLauf;
      var ziel = rwZiel;
      var vorschau = rwZielText;
      var pruefweg = rwPruefweg();
      rwLage = "senden";
      rwSatzSetzen(t("rwLaeuft"), false, null);
      rwZeichnen();
      rwMarkierungFrisch(function (frisch) {
        if (lauf !== rwLauf) { return; }
        if (frisch === null) { rwAbbruch(lauf, t("sendError", { detail: "Word-API" })); return; }
        if (frisch.length === 0) { rwAbbruch(lauf, t("sendEmpty")); return; }
        if (frisch !== vorschau) {
          // Der Mensch saehe etwas anderes, als hinausginge. Nichts wird gesendet; die Karte liest
          // die neue Markierung — damit faellt ueber `rwBindungPruefen` auch die Zielwahl. Der Satz
          // haelt (`halten`), sonst raeumte ihn genau dieser Neuzeichnen-Lauf wieder weg.
          rwAbbruch(lauf, t("rwMarkierungAnders"), true);
          captureMarkierungLesen();
          return;
        }
        if (pruefweg) {
          // Fall 2/3: KEIN Word-HTML. Der Kommentar traegt Klartext — ein HTML-Rumpf waere hier eine
          // Formatierung, die beim Freigeben ohnehin nicht wieder entstuende (s. Kopfkommentar).
          rwEinreichen(ziel, frisch, lauf);
          return;
        }
        rwAuswahlHtml(function (html) {
          if (lauf !== rwLauf) { return; }
          rwUeberarbeiten(ziel, rwSchreibladung(html, frisch, ziel.version), lauf);
        });
      });
    }

    /**
     * DIE FREMDE ENTSCHEIDUNG (der Kreis von Fall 2): das berechtigte Konto uebernimmt oder lehnt
     * einen eingereichten Vorschlag ab — `action: "decide-proposal"` am selben Endpunkt.
     *
     * DER SERVER ENTSCHEIDET, WER DARF: dass der Einreicher nicht sein eigener Pruefer sein kann,
     * haelt `KoService.decideProposal` (`PROPOSAL_OWN`), nicht dieser Knopf. Hier wird er nur nicht
     * angeboten, wo er sicher abgewiesen wuerde.
     *
     * MIT DEM STAND, DEN DER MENSCH GESEHEN HAT: `expectedVersion` ist die geladene Fassung des
     * ZIELS (nicht die Grundlage des Vorschlags) — uebernommen wird in die Fassung, die hier im
     * Bild steht, oder gar nicht.
     */
    function rwVorschlagEntscheiden(vorschlag, entscheidung) {
      if (!rwZiel || rwLage === "senden" || !rwDarfFreigeben() || vorschlag.eigen) { return; }
      // RUNDE 4: der Riegel sitzt am Weg, nicht nur am Knopf. Was dieses Fenster nicht anzeigen kann,
      // gibt es auch dann nicht frei, wenn der Aufruf anders als ueber den Knopf kaeme.
      if (entscheidung === "uebernehmen" && vorschlag.rumpf) { return; }
      rwLauf += 1;
      var lauf = rwLauf;
      var ziel = rwZiel;
      rwLage = "senden";
      rwSatzSetzen(t("rwLaeuft"), false, null);
      rwZeichnen();
      var ladung = {
        payload: JSON.stringify({
          action: "decide-proposal",
          proposalId: vorschlag.id,
          decision: entscheidung,
          expectedVersion: ziel.version
        }),
        // Hier gab es keine Word-Auswahl, aus der etwas haette verlorengehen koennen — s.
        // `rwSatzMitBildern`. Ein Bilder-Satz waere eine Aussage ueber einen Vorgang, den es nicht gab.
        ohneBilanz: true
      };
      if (entscheidung === "ablehnen") {
        rwVorschlagAblehnen(ziel, ladung, lauf);
        return;
      }
      rwUeberarbeiten(ziel, ladung, lauf);
    }

    /**
     * Die ABLEHNUNG erzeugt KEINE neue Fassung — deshalb nicht der Weg von `rwUeberarbeiten`, der
     * eine Version und eine Freigabe erwartet. Sie sagt, dass entschieden ist, und nichts sonst.
     */
    function rwVorschlagAblehnen(ziel, ladung, lauf) {
      rwRuf(ziel.id, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: ladung.payload
      })
        .then(function (res) {
          if (lauf !== rwLauf) { return null; }
          if (!res.ok) {
            rwLage = "ruhe";
            rwSatzSetzen(rwFehlersatz(res.status), true, null);
            if (res.status === 401 && typeof checkSession === "function") { checkSession(); }
            rwZeichnen();
            return null;
          }
          return res.json().then(function (ko) {
            if (lauf !== rwLauf) { return; }
            rwZiel = {
              id: ziel.id,
              title: ziel.title,
              version: typeof ko.version === "number" ? ko.version : ziel.version,
              rumpf: rwHatRumpf(ko),
              vorschlaege: rwVorschlaegeAus(ko)
            };
            rwLage = "ruhe";
            rwSatzSetzen(t("rwAbgelehnt"), false, null);
            rwZeichnen();
          });
        })
        .catch(function (err) { rwAbbruch(lauf, sendeFehlerText(err)); });
    }

    if (document.getElementById("rw-btn")) {
      document.getElementById("rw-btn").addEventListener("click", rwFreigeben);
      document.getElementById("rw-zweit").addEventListener("change", rwZeichnen);
      document.getElementById("rw-abwahl").addEventListener("click", function () {
        rwLauf += 1;
        rwZiel = null;
        rwZielText = "";
        rwLage = "ruhe";
        rwSatzSetzen(null);
        rwZeichnen();
      });
      document.getElementById("rw-status-btn").addEventListener("click", function () {
        if (rwSatz && rwSatz.aktion === "neu-laden" && rwZiel) { rwZielWaehlen(rwZiel.id); }
      });
    }
    // KW-RUECKWEG-END

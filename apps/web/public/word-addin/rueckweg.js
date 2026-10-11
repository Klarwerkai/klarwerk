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
    // BILDER UND UEBERSCHRIFTEN holt dieser Weg seit Nacharbeit 9 (Realhostbeleg 06.10.2026) aus
    // Word selbst nach (`rwStrukturLesen`/`rwStrukturErgaenzen`, s. dort). Ein nicht herausgegebenes
    // Bild wird GEZAEHLT und gesagt — ueber dieselbe Bilanz und denselben Wortlaut wie am Entwurfsweg
    // (`bilderBilanz`/`bilderText`), nicht stillschweigend weggelassen. Und er aendert den TITEL des
    // Objekts nicht: der Rueckweg traegt den Text zurueck, nicht die Benennung.
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

    // ============================================================================================
    // WORD-WEB-RETURN-STRUCTURE (Realhostbeleg 06.10.2026, Nacharbeit 9): BILDER UND UEBERSCHRIFTEN
    // AUS WORD SELBST.
    // ============================================================================================
    //
    // DER BEFUND: in Word im Web wurde eine Markierung mit „Ueberschrift 1", Tabelle und zwei
    // Rasterbildern an dasselbe Objekt zurueckgegeben. v3 trug keine Bilder, die Ueberschrift war ein
    // Absatz — und der Satz lautete „Aktualisiert und freigegeben", ohne Verlust. Tabelle, Fett und
    // Text kamen an. Das Roh-HTML von `getSelectedDataAsync(Html)` ist NICHT beobachtet; belegt ist das
    // Ergebnis, und aus ihm folgt: es enthielt kein `<img>` (sonst haette `countUndeliveredWordImages`
    // gezaehlt und der Satz es gesagt) und keine Ueberschriftenauszeichnung.
    //
    // DESHALB FRAGT DIESER SCHRITT WORD NACH DER STRUKTUR, statt sie aus dem HTML zu raten — alles
    // WordApi 1.1, das Manifest bleibt: `Range.getHtml()` als zweites HTML, je Absatz `text` und
    // `style` (die Formatvorlage, im Web lokalisiert: „Ueberschrift 1"/„Heading 1"), je Absatz
    // `inlinePictures` und ueber `ladeBilder` (derselbe Helfer wie am Sendeweg) die Bytes.
    //   · Bilder werden je Word-Absatz ZUGEORDNET (Nacharbeit 12, s. `rwStrukturEinsetzen`): ein schon
    //     eingebettetes Bild mit denselben Bytes bleibt, passende Platzhalter bekommen ihre Bytes, ein
    //     fehlendes Bild steht in SEINEM Absatz (Absatz mit Text) oder als eigener Absatz vor dem
    //     Absatz, der in Word darauf folgt — vor dessen Tabelle, falls er in einer beginnt; ohne
    //     Nachfolger am Ende. Die Zuordnung laeuft ueber den Absatztext in Reihenfolge.
    //   · Ein Absatz mit Ueberschriftenvorlage wird `<hN>` (der Server bildet h1 auf h2 ab).
    // WAS DANACH FEHLT, WIRD GEZAEHLT UND GESAGT, und der Satz ist dann eine Warnung: Bilder mit dem
    // Wortlaut des Sendewegs (`sendImagesMissing`, auch fuer EMF/WMF — sie sind kein Rasterbild),
    // Ueberschriften mit `rwUeberschriftFehlt`. Antwortet Word nicht (Fehler, Frist), sagt
    // `rwStrukturUngeprueft` genau das — gesendet wird dann das HTML von vorher, wie bisher.
    // OHNE `Word` (kein Word-Host) bleibt alles wie vorher; es gibt dort nichts zu fragen.
    var RW_UEBERSCHRIFT_RE = /^(?:heading|überschrift|kop|titre|titolo|título|encabezado)\s*([1-6])$/i;

    // Die Zeichenklasse unten traegt nach den Steuerzeichen ZWEI Zeichen woertlich: das geschuetzte
    // Leerzeichen (U+00A0) und U+FFFC, Words Platzhalter fuer ein Bild im Absatztext — beide werden
    // Leerraum, damit der Absatztext aus Word gleich dem aus dem HTML ist.
    function rwNorm(text) {
      return String(text || "")
        .replace(/[\u0000-\u001f ￼]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^\s+|\s+$/g, "");
    }

    /** Der Absatztext eines HTML-Stuecks — dieselbe Ableitung wie am Sendeweg, plus Zahlzeichen. */
    function rwHtmlText(stueck) {
      return rwNorm(wordHtmlToPlainText(stueck)
        .replace(/&#(\d+);/g, function (_m, n) { return String.fromCharCode(Number(n)); })
        .replace(/&#x([0-9a-f]+);/gi, function (_m, n) { return String.fromCharCode(parseInt(n, 16)); }));
    }

    /** Die Absatzbloecke des HTML in Reihenfolge: Tag, Beginn, Schluss-Tag, Ende, Text. */
    function rwBloecke(inner) {
      var re = /<\/(p|h[1-6]|li|td|th)\s*>/gi;
      var bloecke = [];
      var von = 0;
      var m = re.exec(inner);
      while (m !== null) {
        var tag = m[1].toLowerCase();
        var bis = m.index + m[0].length;
        var stueck = inner.slice(von, bis);
        var auf = new RegExp("<" + tag + "(?=[\\s>/])", "gi");
        var start = -1;
        var a = auf.exec(stueck);
        while (a !== null) { start = von + a.index; a = auf.exec(stueck); }
        bloecke.push({ tag: tag, start: start, schluss: m.index, ende: bis, text: rwHtmlText(stueck) });
        von = bis;
        m = re.exec(inner);
      }
      return bloecke;
    }

    function rwUeberschriftStufe(stil) {
      var m = RW_UEBERSCHRIFT_RE.exec(rwNorm(stil));
      return m ? Number(m[1]) : 0;
    }

    /** Bildbytes ohne `data:`-Kopf und Leerraum — die Form, in der zwei Bilder verglichen werden. */
    function rwRoh(b64) {
      return String(b64 || "").replace(/^\s*data:[^,]*,/, "").replace(/\s+/g, "");
    }

    /** Die Bildtags eines Absatzes; was kein unterstuetztes Rasterbild ist, zaehlt als fehlend. */
    function rwBildTags(liste) {
      var tags = "";
      var fehlen = 0;
      for (var i = 0; i < liste.length; i += 1) {
        var roh = rwRoh(liste[i]);
        var mime = wordImageMimeFromBase64(roh);
        if (mime) { tags += '<img src="data:' + mime + ";base64," + roh + '">'; } else { fehlen += 1; }
      }
      return { tags: tags, fehlen: fehlen };
    }

    /** Alle `<img>`-Tags des HTML: Lage, Wortlaut und — wenn schon eingebettet — ihre Bytes. */
    function rwImgTags(inner) {
      var re = /<img\b[^>]*>/gi;
      var liste = [];
      var m = re.exec(inner);
      while (m !== null) {
        var src = /src\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[0]);
        var wert = src ? (src[1] !== undefined ? src[1] : src[2]) : "";
        var daten = /^\s*data:image\/(png|jpe?g|gif|webp);base64,/i.test(wert) ? rwRoh(wert) : null;
        liste.push({ pos: m.index, ende: m.index + m[0].length, tag: m[0], daten: daten, frei: true });
        m = re.exec(inner);
      }
      return liste;
    }

    /** Ein Platzhalter-Tag bekommt die Bytes SEINES Bildes; andere Attribute bleiben (wie `fillWordImages`). */
    function rwTagMitBild(tag, mime, roh) {
      var datenUrl = "data:" + mime + ";base64," + roh;
      return /src\s*=\s*(?:"[^"]*"|'[^']*')/i.test(tag)
        ? tag.replace(/src\s*=\s*(?:"[^"]*"|'[^']*')/i, 'src="' + datenUrl + '"')
        : tag.replace(/^<img/i, '<img src="' + datenUrl + '"');
    }

    /**
     * Der Bereich des HTML, in dem die Bilder von Word-Absatz `i` stehen muessten: der eigene Block
     * (Absatz mit Text) oder die Strecke zwischen dem vorigen und dem naechsten gefundenen Absatz.
     */
    function rwBildBereich(inner, bloecke, treffer, i) {
      var vor = 0;
      for (var j = i - 1; j >= 0; j -= 1) {
        if (treffer[j] >= 0) { vor = bloecke[treffer[j]].ende; break; }
      }
      if (treffer[i] >= 0) {
        var blk = bloecke[treffer[i]];
        return { von: blk.start >= 0 ? blk.start : vor, bis: blk.ende, stelle: blk.schluss, imBlock: true, schluessel: "b" + treffer[i] };
      }
      var bis = inner.length;
      for (var k = i + 1; k < treffer.length; k += 1) {
        var b = treffer[k] >= 0 ? bloecke[treffer[k]] : null;
        if (b && b.start >= vor) { bis = b.start; break; }
      }
      return { von: vor, bis: bis, stelle: rwBildStelle(inner, bloecke, treffer, i), imBlock: false, schluessel: vor + ":" + bis };
    }

    /** Wohin ein Bildabsatz ohne Text kommt: vor den naechsten gefundenen Absatz (oder dessen Tabelle). */
    function rwBildStelle(inner, bloecke, treffer, i) {
      var vor = 0;
      for (var j = i - 1; j >= 0; j -= 1) {
        if (treffer[j] >= 0) { vor = bloecke[treffer[j]].ende; break; }
      }
      for (var k = i + 1; k < treffer.length; k += 1) {
        var b = treffer[k] >= 0 ? bloecke[treffer[k]] : null;
        if (b && b.start >= vor) {
          var tabelle = inner.slice(vor, b.start).search(/<table\b/i);
          return tabelle >= 0 ? vor + tabelle : b.start;
        }
      }
      return inner.length;
    }

    /**
     * Ueberschriften und Bilder in das HTML einsetzen — und zaehlen, was nicht ging.
     *
     * BILDER NACH ZUORDNUNG, NICHT NACH GESAMTZAHL (Nacharbeit 12, Ben): die Bilder eines Word-Absatzes
     * gehoeren in SEINEN Bereich (`rwBildBereich`). Je Bereich gilt:
     *   1. Ein schon eingebettetes Bild (data-URL) mit denselben Bytes IST dieses Bild — es bleibt,
     *      wo es steht, und wird nicht ein zweites Mal eingesetzt.
     *   2. Stehen dort genau so viele Platzhalter (`<img>` ohne Bytes) wie noch offene Bilder, bekommt
     *      jeder Platzhalter der Reihe nach die Bytes seines Bildes — sofern die Lagen dann der
     *      Word-Reihenfolge folgen.
     *   3. Sonst ist die Zuordnung im Bereich nicht eindeutig: die Platzhalter fallen, und jedes offene
     *      Bild steht RELATIV zu den schon eingebetteten Bildern seines Absatzes in Word-Reihenfolge
     *      (vor dem naechsten, sonst hinter dem letzten; ohne beide an der Stelle des ersten
     *      Platzhalters bzw. des Absatzes). Mehr Platzhalter als Bilder heisst: Word gab diese nicht
     *      heraus — sie zaehlen als fehlend.
     * Ein Platzhalter ausserhalb jedes Bildbereichs bleibt unberuehrt; `rwLadung` zaehlt ihn wie bisher.
     */
    function rwStrukturEinsetzen(inner, w, bilderJe) {
      var bloecke = rwBloecke(inner);
      var treffer = [];
      var zeiger = 0;
      var i;
      for (i = 0; i < w.absaetze.length; i += 1) {
        treffer.push(-1);
        var soll = rwNorm(w.absaetze[i].text);
        if (soll.length === 0) { continue; }
        for (var b = zeiger; b < bloecke.length; b += 1) {
          if (bloecke[b].text === soll) { treffer[i] = b; zeiger = b + 1; break; }
        }
      }
      var aenderungen = [];
      var setze = function (pos, weg, neu) {
        aenderungen.push({ pos: pos, weg: weg, neu: neu, nr: aenderungen.length });
      };
      var ergebnis = { html: inner, bilderFehlen: 0, ueberschriftenFehlen: 0, ungeprueft: false };
      var gruppen = [];
      var gruppeVon = {};
      for (i = 0; i < w.absaetze.length; i += 1) {
        var blk = treffer[i] >= 0 ? bloecke[treffer[i]] : null;
        var stufe = rwUeberschriftStufe(w.absaetze[i].stil);
        if (stufe > 0 && !(blk && /^h[1-6]$/.test(blk.tag))) {
          if (blk && blk.tag === "p" && blk.start >= 0) {
            setze(blk.start, inner.indexOf(">", blk.start) + 1 - blk.start, "<h" + stufe + ">");
            setze(blk.schluss, blk.ende - blk.schluss, "</h" + stufe + ">");
          } else {
            ergebnis.ueberschriftenFehlen += 1;
          }
        }
        var zahl = w.zahlen[i] || 0;
        if (zahl === 0) { continue; }
        var bereich = rwBildBereich(inner, bloecke, treffer, i);
        if (!gruppeVon[bereich.schluessel]) {
          gruppeVon[bereich.schluessel] = { bereich: bereich, zahl: 0, bilder: [] };
          gruppen.push(gruppeVon[bereich.schluessel]);
        }
        var gruppe = gruppeVon[bereich.schluessel];
        gruppe.zahl += zahl;
        if (bilderJe) { gruppe.bilder = gruppe.bilder.concat(bilderJe[i]); }
      }
      var imgs = rwImgTags(inner);
      for (var g = 0; g < gruppen.length; g += 1) {
        var gr = gruppen[g];
        var drin = [];
        for (var t = 0; t < imgs.length; t += 1) {
          if (imgs[t].frei && imgs[t].pos >= gr.bereich.von && imgs[t].ende <= gr.bereich.bis) { drin.push(imgs[t]); }
        }
        if (!bilderJe) {
          // Ohne Bytes keine Zuordnung: was im Bereich als Tag steht, zaehlt `rwLadung`; der Rest fehlt.
          ergebnis.bilderFehlen += gr.zahl > drin.length ? gr.zahl - drin.length : 0;
          for (t = 0; t < drin.length; t += 1) { drin[t].frei = false; }
          continue;
        }
        // (1) schon eingebettete Bilder ueber ihre Bytes zuordnen — im Bereich, sonst irgendwo frei.
        // `folge` haelt die Bilder in WORD-Reihenfolge; `anker` ist der eingebettete Tag IM Bereich,
        // an dem sich ein fehlendes Bild ausrichtet (ein Treffer ausserhalb verhindert nur das Duplikat).
        var folge = [];
        for (var o = 0; o < gr.bilder.length; o += 1) {
          var roh = rwRoh(gr.bilder[o]);
          var da = null;
          for (t = 0; t < imgs.length && da === null; t += 1) {
            if (imgs[t].frei && imgs[t].daten !== null && imgs[t].daten === roh) { da = imgs[t]; }
          }
          if (da) { da.frei = false; }
          var drinnen = da !== null && da.pos >= gr.bereich.von && da.ende <= gr.bereich.bis;
          folge.push({ roh: roh, da: da !== null, anker: drinnen ? da : null, platz: null });
        }
        var offen = [];
        for (o = 0; o < folge.length; o += 1) { if (!folge[o].da) { offen.push(folge[o]); } }
        var platzhalter = [];
        for (t = 0; t < drin.length; t += 1) {
          if (drin[t].frei && drin[t].daten === null) { platzhalter.push(drin[t]); drin[t].frei = false; }
        }
        if (platzhalter.length === offen.length) {
          // (2) gleich viele: der Reihe nach zuordnen — aber nur, wenn die Lagen dann der
          // Word-Reihenfolge folgen (Nacharbeit 13). Sonst ist es Fall (3).
          var letzte = -1;
          var steigt = true;
          for (o = 0; o < folge.length; o += 1) {
            if (!folge[o].da) { folge[o].platz = platzhalter[offen.indexOf(folge[o])]; }
            var lage = folge[o].anker ? folge[o].anker.pos : folge[o].platz ? folge[o].platz.pos : -1;
            if (lage >= 0) { steigt = steigt && lage > letzte; letzte = lage; }
          }
          if (steigt) {
            for (t = 0; t < offen.length; t += 1) {
              var mime = wordImageMimeFromBase64(offen[t].roh);
              if (mime) { setze(offen[t].platz.pos, offen[t].platz.ende - offen[t].platz.pos, rwTagMitBild(offen[t].platz.tag, mime, offen[t].roh)); }
            }
            continue;
          }
        }
        // (3) nicht eindeutig: Platzhalter fallen; jedes offene Bild steht VOR dem naechsten schon
        // eingebetteten Bild seines Absatzes (Word-Reihenfolge), sonst HINTER dem letzten davor, sonst
        // an der Stelle des ersten Platzhalters bzw. des Absatzes (Nacharbeit 13, Ben: A, B statt B, A).
        for (t = 0; t < platzhalter.length; t += 1) { setze(platzhalter[t].pos, platzhalter[t].ende - platzhalter[t].pos, ""); }
        if (platzhalter.length > offen.length) { ergebnis.bilderFehlen += platzhalter.length - offen.length; }
        for (o = 0; o < folge.length; o += 1) {
          if (folge[o].da) { continue; }
          var bild = rwBildTags([folge[o].roh]);
          ergebnis.bilderFehlen += bild.fehlen;
          if (bild.tags.length === 0) { continue; }
          var nach = null;
          var vorher = null;
          for (var n = o + 1; n < folge.length && nach === null; n += 1) { if (folge[n].anker) { nach = folge[n].anker; } }
          for (n = o - 1; n >= 0 && vorher === null; n -= 1) { if (folge[n].anker) { vorher = folge[n].anker; } }
          if (nach) { setze(nach.pos, 0, bild.tags); continue; }
          if (vorher) { setze(vorher.ende, 0, bild.tags); continue; }
          if (platzhalter.length > 0) { setze(platzhalter[0].pos, 0, bild.tags); continue; }
          setze(gr.bereich.stelle, 0, gr.bereich.imBlock ? bild.tags : "<p>" + bild.tags + "</p>");
        }
      }
      // Von hinten nach vorn: Ersetzungen vor Einfuegungen an derselben Stelle, Einfuegungen in
      // umgekehrter Reihenfolge — so steht, was zuerst kam, auch vorn.
      aenderungen.sort(function (x, y) { return y.pos - x.pos || y.weg - x.weg || y.nr - x.nr; });
      for (var e = 0; e < aenderungen.length; e += 1) {
        var a = aenderungen[e];
        ergebnis.html = ergebnis.html.slice(0, a.pos) + a.neu + ergebnis.html.slice(a.pos + a.weg);
      }
      return ergebnis;
    }

    /**
     * Die Struktur der Markierung aus Word: `done(null)` ohne Word, `done({ fehler: true })` wenn
     * Word nicht (rechtzeitig) antwortet, sonst `{ html, absaetze: [{ text, stil }], zahlen, liste }`
     * — `liste` sind die Bildbytes in Absatzreihenfolge oder `null` (nicht herausgegeben).
     */
    function rwStrukturLesen(done) {
      if (!window.Word || typeof Word.run !== "function") { done(null); return; }
      var erledigt = false;
      var einmal = function (wert) {
        if (erledigt) { return; }
        erledigt = true;
        clearTimeout(uhr);
        done(wert || { fehler: true });
      };
      var uhr = setTimeout(function () { einmal(null); }, WORD_ADDIN_AUSWAHL_FRIST_MS);
      try {
        Word.run(function (context) {
          var auswahl = context.document.getSelection();
          var html = auswahl.getHtml();
          var absaetze = auswahl.paragraphs;
          absaetze.load("text,style");
          return context.sync().then(function () {
            var items = absaetze.items || [];
            var sammlungen = [];
            for (var a = 0; a < items.length; a += 1) { sammlungen.push(items[a].inlinePictures); }
            return ladeBilder(context, sammlungen).then(function (liste) {
              var w = { html: String(html.value || ""), absaetze: [], zahlen: [], liste: liste };
              for (var b = 0; b < items.length; b += 1) {
                w.absaetze.push({ text: String(items[b].text || ""), stil: String(items[b].style || "") });
                w.zahlen.push((sammlungen[b].items || []).length);
              }
              return w;
            });
          });
        }).then(function (w) { einmal(w); }, function () { einmal(null); });
      } catch (err) {
        einmal(null);
      }
    }

    /** Das HTML, das hinausgeht, und die Bilanz dessen, was Word nicht hergab. */
    function rwStrukturErgaenzen(html, w) {
      var leer = { html: html, bilderFehlen: 0, ueberschriftenFehlen: 0, ungeprueft: false };
      if (w === null) { return leer; }
      if (w.fehler) { leer.ungeprueft = true; return leer; }
      var imgZahl = function (h) { return (String(h || "").match(/<img\b/gi) || []).length; };
      // Das Office-HTML bleibt die Grundlage (an ihm sind Tabelle und Fett belegt); das zweite HTML
      // nur, wenn das erste leer ist oder es MEHR Bilder traegt.
      var quelle = extractWordBodyHtml(html || "").length === 0 || imgZahl(w.html) > imgZahl(html) ? w.html : html;
      var inner = extractWordBodyHtml(quelle || "");
      if (inner.length === 0) { return leer; }
      var summe = 0;
      for (var i = 0; i < w.zahlen.length; i += 1) { summe += w.zahlen[i]; }
      var bilderJe = null;
      if (w.liste && w.liste.length === summe) {
        bilderJe = [];
        var pos = 0;
        for (var j = 0; j < w.zahlen.length; j += 1) {
          bilderJe.push(w.liste.slice(pos, pos + w.zahlen[j]));
          pos += w.zahlen[j];
        }
      }
      return rwStrukturEinsetzen(inner, w, bilderJe);
    }

    // ============================================================================================
    // DAS BUDGET IST DER KLEINERE VON FENSTERBUDGET UND ROUTENGRENZE (JOB 4085 R2, JOB 4115).
    // ============================================================================================
    //
    // DER BEFUND (BEN, Runde 1) — GESCHICHTE, weil JOB 4115 ihn behoben hat; er steht hier, weil
    // er die Bauart dieser Stelle erklaert: der Rueckweg mass seine Nutzlast an
    // `WORD_ADDIN_BODY_BUDGET_BYTES` (3.500.000). Diese Zahl gehoert dem ENTWURFSWEG — dessen Route
    // `POST /api/drafts` traegt ein ausdruecklich angehobenes `bodyLimit` (DRAFTS_BODY_LIMIT,
    // 5 MiB, capture-routes.ts). Der Rueckweg schreibt aber an `PUT /api/kos/:id`, und die Route
    // hatte damals KEIN eigenes `bodyLimit`; es galt Fastifys Vorgabe von 1 MiB. Gemessen wurde
    // genau das: eine Bildlast von 1.520.700 Bytes lag unter 3.500.000, wurde also nicht
    // beschnitten — und kam als `413 FST_ERR_CTP_BODY_TOO_LARGE` zurueck. Der Mensch las
    // „Einreichen fehlgeschlagen", seine Bilder waren nicht zu gross, sondern an der falschen Zahl
    // gemessen.
    //
    // DESHALB RECHNET DIESER WEG AB HIER GEGEN DIE ROUTE, an die er wirklich schreibt. Das Budget
    // ist der KLEINERE der beiden Werte: sinkt das Fensterbudget einmal unter die Routengrenze,
    // gilt weiter das Fensterbudget; steigt es, deckelt die Route. So kann die Beschneidung
    // (`trimWordImagesToBudget`) greifen, BEVOR der Server ablehnt — und die Bilderbilanz sagt dem
    // Menschen, was weggefallen ist, statt ihn vor einem Serverfehler stehen zu lassen.
    //
    // DIE ROUTENGRENZE IST SEIT JOB 4115 DIE BREITERE VON BEIDEN — und deshalb nicht mehr das Mass.
    // Bis dahin stand hier 1048576: 1 MiB, Fastifys Vorgabe, weil die Route keine eigene Grenze
    // trug. Abzueglich der Reserve blieben rund 1.032.192 Bytes fuer die ganze Nutzlast, base64
    // kostet ein Drittel — rund 750 KiB Bilddaten. Fuer einen Word-Absatz mit Fotos war das zu
    // knapp: die Folge war EHRLICH (Bilder fielen weg und wurden genannt), aber unbrauchbar. Die
    // Route traegt jetzt eine eigene, benannte Annahmegrenze (`KOS_BODY_LIMIT` in
    // `services/app/src/routes/ko-routes.ts`, 5 MiB — dieselbe Zahl wie der Entwurfsweg), und diese
    // Zahl hier ist ihr Spiegel. Sie wird an der echten Route nachgemessen, nicht geglaubt
    // (`tests/office-pg-abnahme/echte-worddatei-am-rueckweg.test.ts`, A0d).
    //
    // AB JETZT GEWINNT DAS FENSTERBUDGET (3.500.000), UND DAS IST SO GEWOLLT: die Min-Regel unten
    // bleibt unveraendert, nur die groessere der beiden Zahlen hat gewechselt. Das Fenster schneidet
    // also weiterhin SELBST, bevor der Server ablehnt — der Mensch liest, was nicht mitkonnte,
    // statt in einen Serverfehler zu laufen. Sinkt eine der beiden Zahlen unter die andere, dreht
    // sich das ohne weiteres Zutun; geprueft wird die REGEL, nicht die Konstellation von heute.
    var RW_ROUTE_BODY_LIMIT_BYTES = 5242880;
    // Die Reserve ist kein Sicherheitsgefuehl, sondern der Abstand zur Kante: gemessen wird hier die
    // Zeichenkette, die `fetch` als Koerper bekommt; gezaehlt wird am Server, was ankommt. Beides ist
    // heute deckungsgleich (UTF-8), aber ein Rueckweg, der auf das letzte Byte an die Grenze faehrt,
    // waere von jeder Zwischenstelle abhaengig, die noch etwas anhaengt.
    var RW_ROUTE_RESERVE_BYTES = 16384;

    /** Das Budget DIESES Weges: Fensterbudget und Routengrenze, der kleinere Wert gewinnt. */
    function rwBudgetBytes() {
      var routengrenze = RW_ROUTE_BODY_LIMIT_BYTES - RW_ROUTE_RESERVE_BYTES;
      return WORD_ADDIN_BODY_BUDGET_BYTES < routengrenze ? WORD_ADDIN_BODY_BUDGET_BYTES : routengrenze;
    }

    /**
     * DIE LADUNG DES RUECKWEGS — EINE FUNKTION FUER BEIDE WEGE (JOB 4085).
     *
     * Dieselbe Bauform wie `prepareWordDraftRequest`: erst das Word-HTML, bei Budgetueberschreitung
     * erst Bilder weglassen, dann der Klartext. Was dabei verloren geht, steht in der Bilanz und
     * wird gesagt (bilderBilanz).
     *
     * WARUM SIE BEIDE NUTZLASTEN BAUT UND NICHT NUR DIE DES SCHREIBERS: bis JOB 4085 baute
     * `rwEinreichen` seinen Koerper von Hand — ohne `bodyHtml`. Derselbe Mensch, dieselbe
     * Word-Auswahl, dasselbe Objekt, und doch zwei Ergebnisse: wer freigeben darf, schickte
     * Formatierung und Bilder mit; wer nicht darf, schickte den nackten Text, ohne einen Satz
     * darueber. Zwei Kopien dieser Logik waeren genau der Fehler, den `rumpf-faelle.ts` in seinem
     * Kopf beschreibt — beide Seiten koennten gruen sein und Verschiedenes meinen. Deshalb entsteht
     * eine Word-Nutzlast ab hier an EINER Stelle.
     *
     * DAS BUDGET MISST DIE NUTZLAST, DIE WIRKLICH HINAUSGEHT: `bauen` erzeugt den Koerper der
     * jeweiligen Aktion, und `passt` zaehlt genau diesen. Ein am `revise-release`-Koerper
     * gemessenes Budget waere eine Zahl ueber etwas anderes (`propose` traegt andere Felder).
     * Und es misst gegen die Grenze DIESER Route (`rwBudgetBytes`), nicht gegen die des
     * Entwurfswegs — s. den Kopf ueber `RW_ROUTE_BODY_LIMIT_BYTES`.
     *
     * `clearBody` GEHT HIER NIE HINAUS — weder gesetzt noch berechnet, auch nicht als `false`.
     * Liefert Word kein verwertbares HTML, greift der Klartext-Rueckfall (`selectionToBodyHtml`);
     * ein leerer Rumpf, den der Dienst als Loeschsignal lesen koennte, entsteht nicht.
     */
    function rwLadung(aktion, html, text, version) {
      var statement = text.trim();
      var bauen = function (koerper) {
        if (aktion === "propose") {
          // Fall 2/3: der Vorschlag traegt DIESELBEN vier Felder wie der Einreichweg der
          // Web-Flaeche (statement, bodyHtml, baseVersion, origin) — nicht mehr und nicht weniger.
          return JSON.stringify({
            action: "propose",
            proposal: {
              statement: statement,
              bodyHtml: koerper,
              baseVersion: version,
              origin: "word_addin"
            }
          });
        }
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
      var budget = rwBudgetBytes();
      var passt = function (kandidat) {
        return wordHtmlUtf8Bytes(bauen(kandidat)) <= budget;
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
      var teile = bilder ? [satz, bilder] : [satz];
      // Nacharbeit 9: was Word nicht als Struktur hergab, steht dahinter — und dann als Warnung.
      var s = ladung && ladung.struktur ? ladung.struktur : null;
      if (s && s.ueberschriftenFehlen > 0) { teile.push(t("rwUeberschriftFehlt", { n: String(s.ueberschriftenFehlen) })); }
      if (s && s.ungeprueft) { teile.push(t("rwStrukturUngeprueft")); }
      var verlust = Boolean(s && (s.bilderFehlen > 0 || s.ueberschriftenFehlen > 0 || s.ungeprueft));
      rwLage = "ruhe";
      rwSatzSetzen(teile.join(" "), warn || verlust, null);
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
     * SEIT JOB 4085 TRAEGT AUCH DER VORSCHLAG DEN RUMPF, und zwar ueber DIESELBE Ladung wie der
     * Schreibweg (`rwLadung`): dasselbe Budget, dieselbe Bildbeschneidung, dieselbe Bilderbilanz.
     * Bis dahin stand hier eine von Hand gebaute Nutzlast mit drei Feldern, und die Begruendung
     * lautete, der Vorschlag aendere „die AUSSAGE, sonst nichts". Diese Begruendung traegt nicht
     * mehr: der Server nimmt einen Rumpf am `propose` laengst an (tests/word-rueckweg/rumpf-erhalt.test.ts,
     * Faelle G1/G2), und der Einreichweg der Web-Flaeche schickt ihn seit JOB 3667 R5 mit. Uebrig
     * blieb allein diese Tuer, durch die Formatierung und Bilder STILL verschwanden.
     *
     * WAS UNVERAENDERT GILT: ein `clearBody` schickt dieses Fenster NIE — wer aus Word Text
     * zurueckgibt, will kein Dokument loeschen, und die Loeschung ist ein eigener, ausdruecklicher
     * Griff in KLARWERK. Die Dienstregel dahinter bleibt unberuehrt (service.ts,
     * `rumpfAusVorschlag`: ausgelassen ist nicht geloescht) — sie gilt jetzt fuer den Fall, dass
     * Word gar kein HTML hergibt und auch der Klartext-Rueckfall nichts zu tragen haette.
     *
     * KEIN FEHLERWEG TRAEGT EINE BILDERBILANZ: nichts ist angekommen, also ist auch nichts
     * verlorengegangen. Der Bilanzsatz haengt allein am Erfolg.
     */
    function rwEinreichen(ziel, ladung, lauf) {
      rwRuf(ziel.id, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: ladung.payload
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
            // JOB 4085: derselbe Erfolgssatz wie bisher — und die ehrliche Bilderbilanz dieses
            // Vorgangs daran, mit denselben Worten wie am Schreibweg. Ist nichts verlorengegangen,
            // liefert `bilderText` "" und der Satz steht unveraendert da.
            rwSatzMitBildern(t("rwEingereicht"), ladung, false);
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
        // JOB 4085: BEIDE Wege holen dasselbe Word-HTML und bauen ihre Nutzlast an DERSELBEN
        // Stelle. Bis hierher sprang der Pruefweg vor `rwAuswahlHtml` ab — was der Mensch in Word
        // markiert hatte, wurde auf diesem Weg nicht verworfen, sondern nie geholt.
        rwAuswahlHtml(function (html) {
          if (lauf !== rwLauf) { return; }
          // Nacharbeit 9: Bilder und Ueberschriften aus Word, bevor die Ladung entsteht.
          rwStrukturLesen(function (wort) {
            if (lauf !== rwLauf) { return; }
            var struktur = rwStrukturErgaenzen(html, wort);
            var ladung = rwLadung(pruefweg ? "propose" : "revise-release", struktur.html, frisch, ziel.version);
            // Nicht herausgegebene Bilder zaehlen in derselben Bilanz wie nicht gefuellte Tags.
            if (ladung.usedHtml) { ladung.undeliveredImages += struktur.bilderFehlen; }
            ladung.struktur = ladung.usedHtml || struktur.ungeprueft ? struktur : null;
            if (pruefweg) {
              rwEinreichen(ziel, ladung, lauf);
              return;
            }
            rwUeberarbeiten(ziel, ladung, lauf);
          });
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

// ================================================================================================
// KLARA · WORD-VERGLEICH (JOB 3281) — DER BLOCK KW-WORDVERGLEICH, ALS EIGENE DATEI.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT: das Fensterskript ist in seiner Groesse bewacht
// (`tests/klara-zerlegung/schnittflaechen.test.ts` B3, Schranke 12500 Zeilen an `taskpane.js`),
// und seit JOB 3667 gilt dort „schneiden statt anheben". Der Auftrag „Geschriebene Behauptungen
// gegen den Wissensbestand pruefen" (R-0336, R-0708) baut an genau diesem Block weiter; `taskpane.js`
// stand vorher bei 12493 Zeilen. Geschnitten wird nach dem Vorbild `marke.js`: der letzte,
// geschlossene Abschnitt des Fensterskripts wandert heraus (Schritt 2 des Schnittplans, C1).
//
// WARUM GERADE DIESER BLOCK: er ist der letzte im Fensterskript, und keine Zeile ausserhalb des
// Blocks ruft eine seiner Funktionen oder liest eine seiner Variablen. Er selbst benutzt, was das
// Fenster vorher deklariert hat (`t`, `w6DublettenAusCheckText`, `ka7ExterneKi`, `KA7_*`,
// `signedIn`, `officeUsable`, …) — klassische Skripte teilen sich den globalen Rahmen, und das
// Fenster ist zu dem Zeitpunkt vollstaendig gelaufen.
//
// ZEILE FUER ZEILE VERSCHOBEN. Unterhalb dieses Kopfes steht der Abschnitt samt Einrueckung und
// seinem Markenpaar (Start und Ende), und davor die eine Leerzeile, die ihn im Skript vom Block
// davor trennte. Was der Auftrag darin aendert, steht als eigene Aenderung im Abschnitt selbst
// (Kopfkommentar „R-0336 / R-0708"). Dieselbe Sprache wie das Fenster (ES5, `var`, kein Modul,
// kein Build) — deshalb steht die Datei wie `marke.js` auf der Ignorierliste von Biome.
//
// LADEREIHENFOLGE, und sie ist Absicht: `taskpane.html` laedt diese Datei als klassisches Skript
// UNMITTELBAR NACH `taskpane.js` und VOR `marke.js`. Der Block laeuft damit genau dort, wo er
// bisher stand: am Ende des Fensterskripts, vor dem Abschnitt KW-MARKE. Seine Umschlaege um
// `updateAskState`, `kwFlaecheZeichnen`, `klaraS4Verwerfen` und `setLang` legen sich in derselben
// Reihenfolge um die Originale wie vorher.
//
// `"use strict"` steht hier wie im Fensterskript. Die Pruefstaende lesen das Fenster ueber
// `tests/support/panelquelle.ts`; das setzt diesen Block beim Zusammenfuegen wieder an das Ende des
// Skripts, vor den Abschnitt aus `marke.js` — dasselbe Dokument wie vor dem Schnitt.
// ================================================================================================
"use strict";

    // KW-WORDVERGLEICH-START
    // ============================================================================================
    // JOB 3281 · WORD-VERGLEICH — DAS GANZE DOKUMENT, ABSATZ FUER ABSATZ, MIT FARBE UND BELEG.
    // ============================================================================================
    //
    // PEDIS FALL (Auftrag §1): er oeffnet das Vergleichsdokument in Word und klickt „Dokument
    // pruefen". Klara geht Absatz fuer Absatz durch, faerbt IM DOKUMENT und listet im Panel je
    // Absatz die Quellen. Sie entscheidet nichts: „aehnlich" und „Widerspruch" sind Hinweise mit
    // Beleg, die der Mensch im Dokument sieht.
    //
    // DIE VIER AUSSAGEN UND WORAN SIE HAENGEN — jede an ihrer eigenen Voraussetzung (§7 des
    // Zustandsmodells), keine an einer Punktzahl:
    //
    //   gruen  „woertlich belegt"   Ein Quellenfund mit `coverage: "full"` UND
    //          (BrightGreen)        `gedeckteZeichen === passageZeichen` UND — das ist der Kern —
    //                               die MITGELIEFERTE Fundstelle traegt den normalisierten Absatz
    //                               woertlich (`wvWoertlich`). Ein hoher Trigramm-/Dublettenwert
    //                               fuehrt hier NIE hin: `confidence` wird in diesem Block nirgends
    //                               gelesen. Codex' Nachfuehrung 08.09., Punkt 1, als Code.
    //   gelb   „aehnlich"           Es gibt Dublettentreffer oder Quellenfunde, aber keinen
    //          (Yellow)             woertlichen Beleg. Die schwaechere Aussage steht da, nicht die
    //                               starke — auch bei `relation: "identisch"` mit 0,98.
    //   tuerkis „kein Fund"         NUR nach einem VOLLSTAENDIGEN Lauf: der Absatz ging ungekuerzt
    //          (Turquoise)          hinaus, der Bestand wurde wirklich durchsucht
    //                               (`quellenfund.gelaufen === true`), der Deckel hat nichts
    //                               abgeschnitten (`sourceHitsTruncated !== true`) — und es kam
    //                               nichts zurueck. Fehlt eine dieser Voraussetzungen, gibt es
    //                               KEINE Farbe und einen Grund. Kein pauschales Blau.
    //                               DER SATZ SAGT „im durchsuchten Bestand", nicht „nirgends": die
    //                               Kandidatenwahl der Route ist gedeckelt und behauptet keine
    //                               Vollstaendigkeit (check-text-routes.ts, `includeUnvalidated`).
    //   rot    „Widerspruch"        Die Antwort traegt einen Konflikttreffer mit einem BENANNTEN
    //          (Red)                Konflikttyp (`KA7_KONFLIKT_TYPEN`; Doppelungstypen zaehlen als
    //                               Aehnlichkeit, nicht als Widerspruch). Der belegte Satz aus der
    //                               Quelle (`stellen.quelle`) steht daneben.
    //
    // OHNE FARBE ist eine eigene, ehrliche Lage und kein Rest: zu kurz, gekuerzt, nicht durchsucht,
    // Deckel, Fehler — jede mit ihrem Grund in der Liste.
    //
    // R-0336 / R-0708 (Auftrag „Geschriebene Behauptungen gegen den Wissensbestand pruefen"):
    //   · „Markierung pruefen" gleicht EINE markierte Behauptung ab — derselbe Weg zur Route,
    //     dieselbe Einstufung wie je Absatz: gedeckt (gruen, mit Quelle und deren Stelle), im
    //     Widerspruch (rot, mit Gegenquelle und deren Stelle) oder kein Fund (tuerkis, „dazu wissen
    //     wir nichts"). Dieser Weg faerbt NICHTS: die Markierung ist kein Absatz, ihre Farbe waere
    //     ueber die Merkliste nicht zuruecknehmbar. Die Auskunft steht nur im Fenster.
    //   · Jeder Quellenfund nennt seine `fundstelle` als Zitat — bei „gedeckt" steht damit die
    //     belegende Stelle der Quelle daneben, nicht nur ihr Titel.
    //   · Die Zustimmung „Auch noch nicht validierten Bestand einbeziehen" ist AUS, bis der Mensch
    //     den Haken setzt; sie gilt nur fuer dieses Fenster (nichts gespeichert), jeder Lauf haelt
    //     fest, mit welcher er begann, und sagt es im Standsatz. Ohne sie prueft dieser Weg nur
    //     gegen Validiertes (`ungeprueftEinbeziehen`, check-text-routes.ts). Die Erfassen- und die
    //     Bestandsflaeche stellen eine andere Frage („gibt es das schon?") und schicken das Feld
    //     nicht — ihr Weg bleibt davon getrennt (JOB 3020).
    //
    // DER WIDERSPRUCHSZWEIG KOSTET EINEN TEXTABFLUSS, UND DEN ENTSCHEIDET NICHT DIESER BLOCK.
    // `conflicts` entsteht serverseitig nur im tiefen, nicht vertraulichen Zweig
    // (`want: "deep"`, check-text-routes.ts `deepAllowed`). Das ist der Gang an die externe KI und
    // braucht Pedis Weiche je Dokument (Werkstattbeschluss 18.08., KA4). Dieser Block liest sie
    // ueber `ka7ExterneKi()` — dieselbe eine Stelle, die KA7 dafuer gebaut hat, kein zweiter
    // Riegel. Ohne Einwilligung geht `want` NICHT hinaus, Rot kann konstruktiv nicht entstehen,
    // und das Fenster sagt genau das (`wvKiFehlt`) — statt „kein Widerspruch" zu behaupten.
    //
    // EIN WEG ZUR ROUTE, KEIN ZWEITER. Der Abruf laeuft durch `w6DublettenAusCheckText` (Block
    // KW-KLARA-W6-CHECKTEXT), denselben Uebersetzer, den die Erfassen- und die Bestandsflaeche
    // benutzen: dieselbe Sitzung, derselbe Rumpf (`source: "transient-document"`,
    // `nichtEingestuft: true`), dieselben Grenzen (40 / 8.000 Zeichen), dieselbe Kuerzungsauskunft.
    // Es kommt KEINE neue `fetch(`-Stelle und KEIN neues Abrufziel dazu (mega69-klara-merkmale
    // M6/M7 bleiben unberuehrt). Was `wvUmschlag` am hereingereichten `fetchFn` tut, ist dreierlei
    // und gehoert genau hierher, nicht in den W6-Vertrag:
    //   · es setzt `want: "deep"` in den Rumpf, WENN die Weiche oben es erlaubt;
    //   · es setzt `ungeprueftEinbeziehen` IMMER ausdruecklich — die Zustimmung des Laufs (R-0708);
    //   · es hoert die Antwort EINMAL mit, weil `conflicts`/`konfliktpruefung` im selben Rumpf
    //     stehen und W6 nur `duplicates`/`sourceHits` uebersetzt. `json()` wird dabei genau einmal
    //     gelesen und das Ergebnis beiden Lesern gegeben (ein zweites `res.json()` wuerde an einer
    //     echten Antwort werfen).
    //
    // GESCHRIEBEN WIRD NICHTS. Kein `insertText`, kein `insertHtml`, kein
    // `setSelectedDataAsync` — der Block setzt ausschliesslich `font.highlightColor` und ruft
    // `range.select()`. `tests/app/word-addin-wortvergleich.test.ts` V2 haelt das an den
    // ausgelieferten Bytes fest, nicht nur an einem Ablauf.
    //
    // DIE MERKLISTE HAENGT AM VORKOMMEN, NICHT AN DER ABSATZNUMMER (Codex 08.09., Punkt 3+4):
    //   · Ein Posten ist (TEXT-HASH + VORKOMMEN `vk`), nicht der Hash allein. Zwei woertlich
    //     gleiche Absaetze sind ZWEI Posten und zwei Stellen im Dokument. Der Hash allein war der
    //     Fehler der Runde 1 (Ben 08.09.): er fasste beide zu einem Posten zusammen, liess nach der
    //     Ruecknahme den zweiten gefaerbt stehen, sprang immer zum ersten — und ueberschrieb beim
    //     Faerben die fremde Hervorhebung des ersten Vorkommens, obwohl der Auftrag dem zweiten galt.
    //     Die Absatznummer taugt als Identitaet nicht: sie verschiebt sich beim Bearbeiten. `vk`
    //     zaehlt je Wortlaut und verschiebt sich nur, wenn ein GLEICHER Absatz davor wegfaellt —
    //     dann greift der zweite Durchgang von `wvZuordnen`.
    //   · Vor dem Faerben wird die URSPRUNGSFARBE jedes Absatzes festgehalten. Traegt ein Absatz
    //     schon eine FREMDE Hervorhebung, wird er NICHT ueberfaerbt — er wird nur eingestuft, mit
    //     Hinweis. Fremde Arbeit geht nicht verloren. Geprueft wird das ZWEIMAL: beim Lesen und
    //     noch einmal unmittelbar vor dem Schreiben, denn zwischen beidem kann ein Mensch faerben.
    //   · „Markierungen entfernen" stellt die Ursprungsfarbe wieder her, nicht „keine Farbe" — und
    //     nur dort, wo JETZT noch genau die Farbe steht, die Klara gesetzt hat. Hat ein Mensch
    //     seither umgefaerbt, bleibt seine Farbe stehen und die Zahl sagt es.
    //   · Ein zweiter Lauf uebernimmt die Ursprungsfarbe aus der Merkliste und nicht das, was er
    //     im Dokument vorfindet — sonst merkte sich Klara ihre eigene Farbe als Ursprung.
    //   · Verschiebt sich ein Absatz, findet der Hash ihn wieder. Aendert sich sein Text, wird
    //     NICHTS blind entfaerbt: der Posten bleibt stehen und wird als „veraendert" gemeldet.
    //   · Gemerkt wird ERST NACH dem erfolgreichen Schreiblauf. Scheitert er, steht keine Farbe im
    //     Dokument — dann darf das Panel auch keine Ruecknahme dafuer anbieten.
    //
    // WIEDEROEFFNEN: die Farben gehoeren ab dem Speichern Word, nicht Klara — sie bleiben von
    // selbst. Das Panel haelt NICHTS ueber ein Fenster hinaus (kein localStorage, kein Cookie);
    // in der Ruhe steht deshalb `wvRuhe` — der Satz, der genau das sagt, statt eine Liste
    // vorzutaeuschen, die niemand mehr belegen kann.
    var WV_TEXTE = {
      de: {
        wvCta: "Dokument prüfen",
        wvAbbrechen: "Abbrechen",
        wvEntfernen: "Markierungen entfernen",
        wvRuhe: "Für dieses Fenster liegt noch kein Abgleich vor. Farben aus einem früheren Lauf bleiben im Dokument — die Liste hier entsteht erst beim erneuten Abgleich.",
        wvLaeuft: "Absatz {n} von {m} …",
        wvFertig: "{n} von {m} Absätzen abgeglichen · {zeit}. Klara hat nur Farben gesetzt, kein Wort im Dokument verändert.",
        wvAbgebrochen: "Abgebrochen · {n} von {m} Absätzen abgeglichen · {zeit}. Klara hat nur Farben gesetzt, kein Wort im Dokument verändert.",
        wvLeer: "Das Dokument enthält keinen Absatz mit Text.",
        wvFehler: "Abgleich nicht möglich — Word hat keinen lesbaren Text geliefert.",
        wvAnmeldung: "Abgleich abgebrochen: Du bist nicht angemeldet oder darfst den Bestand nicht lesen.",
        wvLegende: "Farben im Dokument",
        wvKatExakt: "Wörtlich im Bestand belegt",
        wvKatSinngleich: "Ähnlich — inhaltlich verwandt, nicht wörtlich",
        wvKatNeu: "Kein Fund im durchsuchten Bestand",
        wvKatWiderspruch: "Widerspruch zu einem Eintrag",
        wvKatOffen: "Nicht abgeglichen",
        wvFarbeExakt: "Grün",
        wvFarbeSinngleich: "Gelb",
        wvFarbeNeu: "Türkis",
        wvFarbeWiderspruch: "Rot",
        wvFarbeKeine: "keine Farbe",
        wvAbsatzNr: "Absatz {n}",
        wvGrundZuKurz: "unter {min} Zeichen — so kurzen Text nimmt der Bestandsabgleich nicht an",
        wvGrundGekuerzt: "nur die ersten {max} Zeichen gingen in den Abgleich, der Rest blieb außen vor",
        wvGrundNichtDurchsucht: "der Bestand wurde für diesen Absatz nicht durchsucht",
        wvGrundGekappt: "es gab mehr Quellen, als der Deckel durchsucht hat",
        wvGrundFehler: "der Abgleich dieses Absatzes ist fehlgeschlagen",
        wvTeilHinweis: "Nur die ersten {max} Zeichen gingen in den Abgleich.",
        wvFremdeFarbe: "Der Absatz trägt bereits eine eigene Hervorhebung — Klara hat sie nicht überschrieben.",
        wvKonfliktOffen: "Widerspruch nicht abgeglichen: {grund}.",
        wvKonfliktStelle: "Die Quelle sagt: „{stelle}“",
        wvKonfliktOhneStelle: "Die Quelle: Stelle nicht benannt.",
        wvKeineEntscheidung: "Klara entscheidet nichts — die Belege stehen daneben.",
        wvSpringen: "Im Dokument zeigen",
        wvEntferntZahl: "{n} Markierungen zurückgenommen; {m} Absätze haben sich seither verändert und blieben unangetastet.",
        wvEntferntFremd: "{k} Absätze tragen inzwischen eine andere Hervorhebung — Klara hat sie so gelassen.",
        wvEntferntFehler: "Die Markierungen konnten nicht zurückgenommen werden.",
        wvFarbenFehler: "Die Farben konnten nicht ins Dokument geschrieben werden — der Befund steht hier, im Dokument steht keine Markierung.",
        wvVeraendert: "Der Absatz hat sich seit dem Abgleich verändert — er wurde nicht gefärbt; gleiche ihn erneut ab.",
        wvKiZeile: "Widerspruchsabgleich mit externer KI{ki}.",
        wvKiFehlt: "Ohne Einwilligung für dieses Dokument bleibt der Widerspruchsabgleich aus — die Farbe Rot kann in diesem Lauf nicht entstehen.",
        wvMarkierungCta: "Markierung prüfen",
        wvMarkierungNr: "Markierte Stelle",
        wvMarkierungLaeuft: "Klara gleicht die Markierung mit dem Bestand ab …",
        wvMarkierungFertig: "Markierung abgeglichen · {zeit}. Klara hat nichts im Dokument verändert.",
        wvKeineMarkierung: "Markiere in Word die Behauptung, die Klara mit dem Bestand abgleichen soll.",
        wvUngeprueftFrage: "Auch noch nicht validierten Bestand einbeziehen",
        wvBestandValidiert: "Abgeglichen nur mit validiertem Bestand.",
        wvBestandMitOffenen: "Mit deiner Zustimmung auch mit noch nicht validiertem Bestand abgeglichen.",
      },
      en: {
        wvCta: "Check document",
        wvAbbrechen: "Cancel",
        wvEntfernen: "Remove highlights",
        wvRuhe: "No comparison exists for this pane yet. Colours from an earlier run stay in the document — the list here only appears after a new comparison.",
        wvLaeuft: "Paragraph {n} of {m} …",
        wvFertig: "{n} of {m} paragraphs compared · {zeit}. Klara only set colours; no word in the document was changed.",
        wvAbgebrochen: "Cancelled · {n} of {m} paragraphs compared · {zeit}. Klara only set colours; no word in the document was changed.",
        wvLeer: "The document contains no paragraph with text.",
        wvFehler: "Comparison not possible — Word returned no readable text.",
        wvAnmeldung: "Comparison stopped: you are not signed in or may not read the knowledge base.",
        wvLegende: "Colours in the document",
        wvKatExakt: "Found verbatim in the knowledge base",
        wvKatSinngleich: "Similar — related in content, not verbatim",
        wvKatNeu: "No match in the searched knowledge base",
        wvKatWiderspruch: "Contradicts an entry",
        wvKatOffen: "Not compared",
        wvFarbeExakt: "Green",
        wvFarbeSinngleich: "Yellow",
        wvFarbeNeu: "Turquoise",
        wvFarbeWiderspruch: "Red",
        wvFarbeKeine: "no colour",
        wvAbsatzNr: "Paragraph {n}",
        wvGrundZuKurz: "under {min} characters — the knowledge check does not accept text that short",
        wvGrundGekuerzt: "only the first {max} characters went into the comparison, the rest stayed out",
        wvGrundNichtDurchsucht: "the knowledge base was not searched for this paragraph",
        wvGrundGekappt: "there were more sources than the cap searched",
        wvGrundFehler: "the comparison of this paragraph failed",
        wvTeilHinweis: "Only the first {max} characters went into the comparison.",
        wvFremdeFarbe: "The paragraph already carries a highlight of its own — Klara did not overwrite it.",
        wvKonfliktOffen: "Contradiction not compared: {grund}.",
        wvKonfliktStelle: "The source says: “{stelle}”",
        wvKonfliktOhneStelle: "The source: passage not named.",
        wvKeineEntscheidung: "Klara does not decide this — the evidence is right beside it.",
        wvSpringen: "Show in document",
        wvEntferntZahl: "{n} highlights taken back; {m} paragraphs have changed since and were left untouched.",
        wvEntferntFremd: "{k} paragraphs now carry a different highlight — Klara left them as they are.",
        wvEntferntFehler: "The highlights could not be taken back.",
        wvFarbenFehler: "The colours could not be written into the document — the findings are here, but no highlight is in the document.",
        wvVeraendert: "The paragraph has changed since the comparison — it was not coloured; compare it again.",
        wvKiZeile: "Contradiction compared with external AI{ki}.",
        wvKiFehlt: "Without consent for this document the contradiction comparison stays off — the colour red cannot appear in this run.",
        wvMarkierungCta: "Check selection",
        wvMarkierungNr: "Selected text",
        wvMarkierungLaeuft: "Klara is comparing the selection with the knowledge base …",
        wvMarkierungFertig: "Selection compared · {zeit}. Klara changed nothing in the document.",
        wvKeineMarkierung: "Select the statement in Word that Klara should compare with the knowledge base.",
        wvUngeprueftFrage: "Also include knowledge that is not yet validated",
        wvBestandValidiert: "Compared with validated knowledge only.",
        wvBestandMitOffenen: "With your consent also compared with knowledge that is not yet validated.",
      },
      nl: {
        wvCta: "Document controleren",
        wvAbbrechen: "Annuleren",
        wvEntfernen: "Markeringen verwijderen",
        wvRuhe: "Voor dit venster is er nog geen vergelijking. Kleuren uit een eerdere ronde blijven in het document — de lijst hier ontstaat pas bij een nieuwe vergelijking.",
        wvLaeuft: "Alinea {n} van {m} …",
        wvFertig: "{n} van {m} alinea's vergeleken · {zeit}. Klara heeft alleen kleuren gezet; geen woord in het document is gewijzigd.",
        wvAbgebrochen: "Afgebroken · {n} van {m} alinea's vergeleken · {zeit}. Klara heeft alleen kleuren gezet; geen woord in het document is gewijzigd.",
        wvLeer: "Het document bevat geen alinea met tekst.",
        wvFehler: "Vergelijking niet mogelijk — Word gaf geen leesbare tekst.",
        wvAnmeldung: "Vergelijking gestopt: je bent niet aangemeld of mag het bestand niet lezen.",
        wvLegende: "Kleuren in het document",
        wvKatExakt: "Woordelijk in het bestand aangetroffen",
        wvKatSinngleich: "Vergelijkbaar — inhoudelijk verwant, niet woordelijk",
        wvKatNeu: "Geen vondst in het doorzochte bestand",
        wvKatWiderspruch: "Spreekt een vermelding tegen",
        wvKatOffen: "Niet vergeleken",
        wvFarbeExakt: "Groen",
        wvFarbeSinngleich: "Geel",
        wvFarbeNeu: "Turkoois",
        wvFarbeWiderspruch: "Rood",
        wvFarbeKeine: "geen kleur",
        wvAbsatzNr: "Alinea {n}",
        wvGrundZuKurz: "onder {min} tekens — zo korte tekst neemt de bestandsvergelijking niet aan",
        wvGrundGekuerzt: "alleen de eerste {max} tekens gingen de vergelijking in, de rest bleef buiten beschouwing",
        wvGrundNichtDurchsucht: "het bestand is voor deze alinea niet doorzocht",
        wvGrundGekappt: "er waren meer bronnen dan het maximum heeft doorzocht",
        wvGrundFehler: "de vergelijking van deze alinea is mislukt",
        wvTeilHinweis: "Alleen de eerste {max} tekens gingen de vergelijking in.",
        wvFremdeFarbe: "De alinea draagt al een eigen markering — Klara heeft die niet overschreven.",
        wvKonfliktOffen: "Tegenstrijdigheid niet vergeleken: {grund}.",
        wvKonfliktStelle: "De bron zegt: “{stelle}”",
        wvKonfliktOhneStelle: "De bron: passage niet benoemd.",
        wvKeineEntscheidung: "Klara beslist dit niet — de onderbouwing staat ernaast.",
        wvSpringen: "In het document tonen",
        wvEntferntZahl: "{n} markeringen teruggenomen; {m} alinea's zijn sindsdien gewijzigd en zijn onaangeroerd gebleven.",
        wvEntferntFremd: "{k} alinea's dragen inmiddels een andere markering — Klara heeft ze zo gelaten.",
        wvEntferntFehler: "De markeringen konden niet worden teruggenomen.",
        wvFarbenFehler: "De kleuren konden niet in het document worden geschreven — de bevinding staat hier, in het document staat geen markering.",
        wvVeraendert: "De alinea is sinds de vergelijking gewijzigd — hij is niet gekleurd; vergelijk hem opnieuw.",
        wvKiZeile: "Tegenstrijdigheid vergeleken met externe AI{ki}.",
        wvKiFehlt: "Zonder toestemming voor dit document blijft de tegenstrijdigheidsvergelijking uit — de kleur rood kan in deze ronde niet ontstaan.",
        wvMarkierungCta: "Selectie controleren",
        wvMarkierungNr: "Geselecteerde tekst",
        wvMarkierungLaeuft: "Klara vergelijkt de selectie met het bestand …",
        wvMarkierungFertig: "Selectie vergeleken · {zeit}. Klara heeft niets in het document gewijzigd.",
        wvKeineMarkierung: "Selecteer in Word de bewering die Klara met het bestand moet vergelijken.",
        wvUngeprueftFrage: "Ook nog niet gevalideerd bestand meenemen",
        wvBestandValidiert: "Alleen met gevalideerd bestand vergeleken.",
        wvBestandMitOffenen: "Met je toestemming ook met nog niet gevalideerd bestand vergeleken.",
      },
    };

    // Die vier Word-Hervorhebungen. BEWUSST die Namen der Word-Aufzaehlung und KEIN Farbliteral:
    // was Word malt, bestimmt Word — ein eigener Hex-Wert waere eine zweite Farbwahrheit neben der
    // Werkbank-Palette (mega43 B1) und wuerde am Ende doch nicht das zeigen, was im Dokument steht.
    // Aus demselben Grund traegt die Legende die NAMEN dieser Farben und kein gemaltes Kaestchen.
    var WV_FARBEN = { exakt: "BrightGreen", sinngleich: "Yellow", neu: "Turquoise", widerspruch: "Red" };
    var WV_KAT_KEYS = { exakt: "wvKatExakt", sinngleich: "wvKatSinngleich", neu: "wvKatNeu", widerspruch: "wvKatWiderspruch", offen: "wvKatOffen" };
    var WV_FARB_KEYS = { exakt: "wvFarbeExakt", sinngleich: "wvFarbeSinngleich", neu: "wvFarbeNeu", widerspruch: "wvFarbeWiderspruch" };
    var WV_LEGENDE = ["exakt", "sinngleich", "neu", "widerspruch", "offen"];

    var wvLauf = 0;        // Laufnummer: ein spaeter Rueckruf eines ueberholten Laufs wird verworfen
    var wvLaeuft = false;
    var wvStand = null;    // { zeilen, gesamt, geprueft, zeit, lage, tief, ki, ungeprueft, markierung }
    var wvMerk = [];       // [{ hash, vk, kategorie, vorher, gesetzt }] — je VORKOMMEN ein Posten
    var wvMeldung = "";    // die Auskunft der letzten Ruecknahme
    var wvSchreibfehler = false; // der Schreiblauf am Ende scheiterte: keine Farbe steht im Dokument
    // R-0708: die ausdrueckliche Zustimmung zum noch nicht validierten Bestand — AUS bis zum Haken,
    // nur fuer dieses Fenster. Ein Lauf liest sie EINMAL beim Start (`wvStand.ungeprueft`).
    var wvUngeprueftJa = false;

    /** Normalisierung fuer Vergleich UND Hash: Anfuehrungszeichen, Leerraum, Gross-/Kleinschreibung. */
    function wvNorm(text) {
      return String(text === null || text === undefined ? "" : text)
        .replace(/[‘’‚‛′´`]/g, "'")
        .replace(/[“”„‟″]/g, '"')
        .replace(/[‐-―]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/^ +| +$/g, "")
        .toLowerCase();
    }

    /** Ein kurzer, stabiler Fingerabdruck des normalisierten Absatzes (djb2 + Laenge). */
    function wvHash(text) {
      var n = wvNorm(text);
      var h = 5381;
      for (var i = 0; i < n.length; i += 1) { h = ((h * 33) ^ n.charCodeAt(i)) >>> 0; }
      return h.toString(36) + ":" + n.length;
    }

    function wvZeit() {
      var d = new Date();
      function pad(n) { return n < 10 ? "0" + n : String(n); }
      return pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    /** Eine Hervorhebung, wie Word sie meldet — `null` heisst „keine". Kein Platzhalter. */
    function wvFarbeAm(absatz) {
      var f = absatz && absatz.font ? absatz.font.highlightColor : null;
      return typeof f === "string" && f.length > 0 ? f : null;
    }

    /**
     * EIN Word-Lauf ueber die Absaetze. `arbeit(items)` darf faerben oder waehlen; danach folgt
     * genau ein zweiter `sync`. Ohne Word, ohne Dokumentkontext oder bei einem Fehler des Hosts
     * meldet `done(false)` — dann sagt die Flaeche das, statt einen Erfolg zu behaupten.
     */
    function wvMitAbsaetzen(arbeit, done) {
      if (!officeUsable() || !window.Word || typeof Word.run !== "function") { done(false); return; }
      try {
        Word.run(function (kontext) {
          var liste = kontext.document.body.paragraphs;
          liste.load("items/text,items/font/highlightColor");
          return kontext.sync().then(function () {
            arbeit(liste.items || []);
            return kontext.sync().then(function () { done(true); });
          });
        }).catch(function () { done(false); });
      } catch (err) {
        done(false);
      }
    }

    /**
     * Die Vorkommen je Wortlaut, in Dokumentreihenfolge: `{ index, vk, vergeben }`. `vk` ist die
     * laufende Nummer DIESES Wortlauts — bei eindeutigem Text immer 0, bei zwei gleichen Absaetzen
     * 0 und 1. Gezaehlt wird ueber ALLE Absaetze, auch die leeren, damit die Nummer aus dem
     * Lesedurchgang (`wvPruefen`) und die aus der Zuordnung dieselbe ist.
     */
    function wvVorkommen(items) {
      var frei = {};
      for (var i = 0; i < items.length; i += 1) {
        var h = wvHash(items[i] && items[i].text);
        if (!frei[h]) { frei[h] = []; }
        frei[h].push({ index: i, vk: frei[h].length, vergeben: false });
      }
      return frei;
    }

    /**
     * Merkposten den HEUTIGEN Absaetzen zuordnen — ueber (Text-Hash + Vorkommen), nie ueber die
     * Absatznummer. Jede Stelle wird hoechstens einmal vergeben; zwei gleiche Absaetze sind zwei
     * Posten und bleiben zwei. Erster Durchgang: das EIGENE Vorkommen. Zweiter Durchgang: wer es
     * nicht mehr findet (ein gleicher Absatz davor wurde geloescht), nimmt das naechste freie
     * Vorkommen desselben Wortlauts. Was gar nichts findet, bleibt UNANGETASTET und kommt als
     * `verloren` zurueck.
     */
    function wvZuordnen(items, posten) {
      var frei = wvVorkommen(items);
      var paare = [];
      var offen = [];
      var verloren = [];
      var i;
      var j;
      for (i = 0; i < posten.length; i += 1) {
        var stellen = frei[posten[i].hash];
        var treffer = null;
        for (j = 0; stellen && j < stellen.length; j += 1) {
          if (!stellen[j].vergeben && stellen[j].vk === posten[i].vk) { treffer = stellen[j]; break; }
        }
        if (treffer) { treffer.vergeben = true; paare.push({ posten: posten[i], absatz: items[treffer.index] }); }
        else { offen.push(posten[i]); }
      }
      for (i = 0; i < offen.length; i += 1) {
        var rest = frei[offen[i].hash];
        var naechste = null;
        for (j = 0; rest && j < rest.length; j += 1) {
          if (!rest[j].vergeben) { naechste = rest[j]; break; }
        }
        if (naechste) { naechste.vergeben = true; paare.push({ posten: offen[i], absatz: items[naechste.index] }); }
        else { verloren.push(offen[i]); }
      }
      return { paare: paare, verloren: verloren };
    }

    /** Der Merkposten zu genau diesem Vorkommen, oder `null`. */
    function wvPosten(hash, vk) {
      for (var i = 0; i < wvMerk.length; i += 1) {
        if (wvMerk[i].hash === hash && wvMerk[i].vk === vk) { return wvMerk[i]; }
      }
      return null;
    }

    /** Die Ursprungsfarbe eines Absatzes: aus der Merkliste, sonst die heute gelesene. Ohne diese
     *  Regel merkte sich ein zweiter Lauf Klaras eigene Farbe als „Ursprung" (D6). */
    function wvUrsprung(hash, vk, gelesen) {
      var p = wvPosten(hash, vk);
      return p ? p.vorher : gelesen;
    }

    /** Traegt DIESER Absatz jetzt Klaras Farbe? Nur dann darf seine Zeile eine Farbe nennen —
     *  nach „Markierungen entfernen" steht im Dokument keine mehr, und die Zeile sagt das, statt
     *  eine Farbe zu behaupten, die niemand mehr sieht. */
    function wvGefaerbt(hash, vk) {
      return wvPosten(hash, vk) !== null;
    }

    /**
     * Darf Klara auf DIESEN Absatz schreiben? Nur wenn dort keine Hervorhebung steht oder genau
     * die, die sie selbst zuletzt gesetzt hat. Alles andere ist die Arbeit eines Menschen — auch
     * dann, wenn sie erst zwischen Lesen und Faerben entstanden ist (Ben 08.09., Pflicht 2).
     */
    function wvDarfFaerben(hash, vk, absatz) {
      var ist = wvFarbeAm(absatz);
      if (ist === null) { return true; }
      var p = wvPosten(hash, vk);
      return p !== null && p.gesetzt === ist;
    }

    /** `gesetzt` ist die Farbe, die WIRKLICH ins Dokument ging — daran erkennt die Ruecknahme
     *  spaeter, ob die Markierung noch Klaras ist. */
    function wvMerken(zeile, farbe) {
      var p = wvPosten(zeile.hash, zeile.vk);
      if (p) { p.kategorie = zeile.kategorie; p.gesetzt = farbe; return; }
      wvMerk.push({ hash: zeile.hash, vk: zeile.vk, kategorie: zeile.kategorie, vorher: zeile.vorher, gesetzt: farbe });
    }

    /**
     * DER WOERTLICHE BELEG. `coverage: "full"` sagt: die ganze normalisierte Passage steht
     * zusammenhaengend im Suchtext der Quelle (check-text-detection.ts `deckungAm`) — und die
     * `fundstelle` ist genau der Ausschnitt darum. Beides wird hier NACHGEPRUEFT: die Zahlen
     * muessen sich decken UND der mitgelieferte Quellabschnitt muss den Absatz woertlich tragen.
     * Stimmt das nicht, ist es kein woertlicher Beleg — dann steht die schwaechere Aussage da.
     */
    function wvWoertlich(fund, text) {
      if (!fund || fund.coverage !== "full") { return false; }
      if (typeof fund.gedeckteZeichen !== "number" || typeof fund.passageZeichen !== "number") { return false; }
      if (fund.gedeckteZeichen !== fund.passageZeichen) { return false; }
      var absatz = wvNorm(text);
      return absatz.length > 0 && wvNorm(fund.fundstelle).indexOf(absatz) >= 0;
    }

    /** Die Konflikttreffer der Antwort — nur BENANNTE Konflikttypen; Doppelungstypen sind
     *  Aehnlichkeit und werden hier bewusst nicht zu Rot (dieselbe Trennung wie KA7). */
    function wvKonflikteAus(koerper) {
      var raus = [];
      if (!koerper || !Array.isArray(koerper.conflicts)) { return raus; }
      for (var i = 0; i < koerper.conflicts.length; i += 1) {
        var c = koerper.conflicts[i];
        var id = c && typeof c.koId === "string" ? c.koId : "";
        if (!id || !KA7_KONFLIKT_TYPEN[typeof c.type === "string" ? c.type : ""]) { continue; }
        var stellen = c.stellen && typeof c.stellen === "object" ? c.stellen : null;
        raus.push({
          id: id,
          title: (typeof c.koTitle === "string" && c.koTitle) || id,
          pruefstand: c.pruefstand === "validiert" || c.pruefstand === "eingereicht" ? c.pruefstand : null,
          fundort: w6Fundort(c),
          stelle: stellen && typeof stellen.quelle === "string" && stellen.quelle.replace(/^\s+|\s+$/g, "").length > 0 ? stellen.quelle : null
        });
      }
      return raus;
    }

    /** Ob und warum die Konfliktpruefung gelaufen ist — gelesen, nie geraten (JOB 3094). */
    function wvKonfliktlage(koerper) {
      var p = koerper && koerper.konfliktpruefung && typeof koerper.konfliktpruefung === "object" ? koerper.konfliktpruefung : null;
      if (!p || typeof p.gelaufen !== "boolean") { return { gelaufen: false, grund: null }; }
      return { gelaufen: p.gelaufen === true, grund: typeof p.grund === "string" ? p.grund : null };
    }

    /**
     * DIE EINSTUFUNG — eine reine Funktion ueber dem, was der Server gesagt hat. `confidence`
     * kommt darin NICHT vor: eine Punktzahl ist nie ein woertlicher Beleg.
     */
    function wvEinstufen(text, ergebnis, konflikte) {
      var lage = ergebnis && typeof ergebnis.lage === "string" ? ergebnis.lage : "fehler";
      if (lage === "zu-kurz") { return { kategorie: "offen", grund: "wvGrundZuKurz" }; }
      if (lage !== "treffer" && lage !== "leer") { return { kategorie: "offen", grund: "wvGrundFehler" }; }
      if (konflikte.length > 0) { return { kategorie: "widerspruch", grund: null }; }
      var quellenfund = ergebnis.quellenfund && typeof ergebnis.quellenfund === "object" ? ergebnis.quellenfund : null;
      var durchsucht = Boolean(quellenfund) && quellenfund.gelaufen === true;
      var funde = durchsucht && Array.isArray(quellenfund.treffer) ? quellenfund.treffer : [];
      var i;
      for (i = 0; i < funde.length; i += 1) {
        if (wvWoertlich(funde[i], text)) { return { kategorie: "exakt", grund: null }; }
      }
      var treffer = Array.isArray(ergebnis.treffer) ? ergebnis.treffer : [];
      if (treffer.length > 0 || funde.length > 0) { return { kategorie: "sinngleich", grund: null }; }
      // Ab hier waere die Aussage „nichts gefunden" — sie darf nur nach einem VOLLSTAENDIGEN Lauf
      // stehen. Jede fehlende Voraussetzung nimmt die Farbe und nennt ihren Grund.
      if (ergebnis.gekuerzt === true) { return { kategorie: "offen", grund: "wvGrundGekuerzt" }; }
      if (!durchsucht) { return { kategorie: "offen", grund: "wvGrundNichtDurchsucht" }; }
      if (quellenfund.mehr === true) { return { kategorie: "offen", grund: "wvGrundGekappt" }; }
      return { kategorie: "neu", grund: null };
    }

    /** Die Quellen einer Zeile: Dublettentreffer, Quellenfunde und Konflikte — in EINER Form. */
    function wvQuellen(ergebnis, konflikte) {
      var raus = [];
      var i;
      for (i = 0; i < konflikte.length; i += 1) {
        // `konflikt: true` heisst: von DIESER Quelle erwartet der Leser die widersprechende Stelle.
        // Fehlt sie, wird sie benannt (`wvKonfliktOhneStelle`) und nicht verschwiegen.
        raus.push({ id: konflikte[i].id, title: konflikte[i].title, pruefstand: konflikte[i].pruefstand,
          fundort: konflikte[i].fundort, stelle: konflikte[i].stelle, konflikt: true });
      }
      var treffer = ergebnis && Array.isArray(ergebnis.treffer) ? ergebnis.treffer : [];
      for (i = 0; i < treffer.length; i += 1) {
        raus.push({ id: treffer[i].id, title: treffer[i].title || treffer[i].id,
          pruefstand: treffer[i].pruefstand, fundort: treffer[i].fundort, stelle: null, konflikt: false });
      }
      var quellenfund = ergebnis && ergebnis.quellenfund && Array.isArray(ergebnis.quellenfund.treffer)
        ? ergebnis.quellenfund.treffer : [];
      for (i = 0; i < quellenfund.length; i += 1) {
        // R-0336: ein Quellenfund nennt seine Fundstelle — der Ausschnitt der Quelle, in dem der
        // Text steht. Bei „gedeckt" ist das das Zitat, das den Befund belegt.
        raus.push({ id: quellenfund[i].id, title: quellenfund[i].title || quellenfund[i].id,
          pruefstand: quellenfund[i].pruefstand, fundort: quellenfund[i].fundort,
          stelle: quellenfund[i].fundstelle || null, konflikt: false });
      }
      return raus;
    }

    /**
     * DER UMSCHLAG UM `fetchFn`. Siehe Kopfkommentar: er setzt `want` (nur mit Weiche) und die
     * Zustimmung zum noch nicht validierten Bestand (R-0708), und er hoert die EINE Antwort mit,
     * ohne einen zweiten Abruf und ohne eine zweite Abrufstelle.
     */
    function wvUmschlag(tief, mitschnitt, ungeprueft) {
      var roh = fetch.bind(window);
      return function (pfad, anfrage) {
        var eigen = anfrage;
        if (anfrage && typeof anfrage.body === "string") {
          try {
            var koerper = JSON.parse(anfrage.body);
            if (tief) { koerper.want = "deep"; }
            koerper.ungeprueftEinbeziehen = ungeprueft === true;
            eigen = { method: anfrage.method, credentials: anfrage.credentials,
              headers: anfrage.headers, body: JSON.stringify(koerper) };
          } catch (err) {
            // Ohne lesbaren Rumpf liesse sich die Zustimmung nicht mitschicken, und die Route fiele
            // auf die weitere Reichweite des Sitzungswegs zurueck. Dann lieber kein Abruf: die
            // Zeile sagt „fehlgeschlagen" (W6-Lage „fehler"), statt ungefragt mehr einzubeziehen.
            return Promise.resolve({ ok: false });
          }
        }
        return roh(pfad, eigen).then(function (res) {
          if (!res || !res.ok || typeof res.json !== "function") { return res; }
          var einmal = null;
          return {
            ok: res.ok,
            status: res.status,
            headers: res.headers,
            json: function () {
              if (einmal === null) {
                einmal = res.json().then(function (k) { mitschnitt.koerper = k; return k; });
              }
              return einmal;
            }
          };
        });
      };
    }

    // ------------------------------------------------------------------------------------------
    // Der Lauf
    // ------------------------------------------------------------------------------------------
    function wvPruefen() {
      if (wvLaeuft) { return; }
      wvLauf += 1;
      var lauf = wvLauf;
      wvLaeuft = true;
      wvMeldung = "";
      wvSchreibfehler = false;
      var weiche = ka7ExterneKi();
      var tief = weiche.lage === "erlaubt";
      wvStand = { zeilen: [], gesamt: 0, geprueft: 0, zeit: null, lage: "laeuft", tief: tief, ki: weiche.ki,
        ungeprueft: wvUngeprueftJa, markierung: false };
      wvZeichnen();
      var gelesen = null;
      wvMitAbsaetzen(function (items) {
        gelesen = [];
        // Die Vorkommen werden ueber ALLE Absaetze gezaehlt — auch die leeren, die gleich
        // uebersprungen werden. Nur so ist `vk` dieselbe Nummer wie spaeter in `wvZuordnen`.
        var zaehler = {};
        for (var i = 0; i < items.length; i += 1) {
          var text = String(items[i] && items[i].text !== undefined && items[i].text !== null ? items[i].text : "");
          var hash = wvHash(text);
          var vk = zaehler[hash] === undefined ? 0 : zaehler[hash];
          zaehler[hash] = vk + 1;
          if (text.replace(/^\s+|\s+$/g, "").length === 0) { continue; }
          gelesen.push({ nr: i + 1, text: text, hash: hash, vk: vk,
            vorher: wvUrsprung(hash, vk, wvFarbeAm(items[i])) });
        }
      }, function (ok) {
        // UEBERHOLT: ein anderer Lauf haelt die Fahne. Diese Antwort faellt weg — sie raeumt NICHT
        // auf. `wvLaeuft` gehoert dem Lauf mit der aktuellen Kennung; wer sie hier zuruecksetzte,
        // nahm dem laufenden Lauf sein „Abbrechen" weg und gab den Startknopf frei, waehrend Klara
        // noch fragte (Codex-Vorpruefung R2, 08.09.). Jede Stelle, die `wvLauf` erhoeht, setzt
        // `wvLaeuft` selbst: `wvPruefen` und `wvMarkierungPruefen` auf true, `wvAbbrechen` und
        // `wvVerwerfen` auf false.
        if (lauf !== wvLauf) { return; }
        if (!ok || gelesen === null) { wvSchluss(lauf, "fehler"); return; }
        wvStand.gesamt = gelesen.length;
        wvZeichnen();
        if (gelesen.length === 0) { wvSchluss(lauf, "leer"); return; }
        wvSchritt(lauf, gelesen, 0, tief);
      });
    }

    function wvSchritt(lauf, absaetze, i, tief) {
      // Ueberholt: stumm aussteigen, nichts anfassen (Begruendung an der ersten Stelle in `wvPruefen`).
      if (lauf !== wvLauf) { return; }
      if (i >= absaetze.length) { wvSchluss(lauf, "fertig"); return; }
      var a = absaetze[i];
      wvStand.geprueft = i;
      wvZeichnen();
      var mitschnitt = { koerper: null };
      w6DublettenAusCheckText(
        "wortvergleich",
        function () { return a.text; },
        wvUmschlag(tief, mitschnitt, wvStand.ungeprueft),
        askLocale(lang),
        deriveDraftTitleFromSelection(a.text)
      ).then(function (ergebnis) {
        // DIE VERSPAETETE ANTWORT EINES ABGEBROCHENEN LAUFS: sie gehoert niemandem mehr. Weder
        // Fortschritt noch Liste noch `wvLaeuft` duerfen sie sehen (Begruendung in `wvPruefen`).
        if (lauf !== wvLauf) { return; }
        var http = ergebnis && typeof ergebnis.http === "number" ? ergebnis.http : 0;
        wvStand.zeilen.push(wvZeile(a, ergebnis, mitschnitt.koerper));
        wvStand.geprueft = i + 1;
        // Die Sitzung traegt nicht mehr (oder das Recht fehlt): weiterzufragen waere sinnlos.
        if (http === 401 || http === 403) { wvSchluss(lauf, "anmeldung"); return; }
        wvZeichnen();
        wvSchritt(lauf, absaetze, i + 1, tief);
      });
    }

    function wvZeile(absatz, ergebnis, koerper) {
      var konflikte = wvKonflikteAus(koerper);
      var urteil = wvEinstufen(absatz.text, ergebnis, konflikte);
      return {
        nr: absatz.nr,
        hash: absatz.hash,
        vk: absatz.vk,
        vorher: absatz.vorher,
        fremdeFarbe: absatz.vorher !== null,
        kategorie: urteil.kategorie,
        grund: urteil.grund,
        teil: Boolean(ergebnis) && ergebnis.gekuerzt === true,
        quellen: wvQuellen(ergebnis, konflikte),
        konflikte: konflikte,
        konfliktlage: wvKonfliktlage(koerper),
        veraendert: false
      };
    }

    /**
     * Der markierte Text, frisch aus Word — `null` heisst: Word hat nichts Lesbares geliefert.
     * Derselbe Host-Weg wie die Absaetze (`Word.run`): in Word im Web schwieg
     * `getSelectedDataAsync` (Realhost 06.10.2026, readAskSelection), `Word.run` nicht.
     */
    function wvMarkierungLesen(done) {
      if (!officeUsable() || !window.Word || typeof Word.run !== "function") { done(null); return; }
      try {
        Word.run(function (kontext) {
          var auswahl = kontext.document.getSelection();
          auswahl.load("text");
          return kontext.sync().then(function () {
            done(typeof auswahl.text === "string" ? auswahl.text.replace(/\r\n?/g, "\n") : null);
          });
        }).catch(function () { done(null); });
      } catch (err) {
        done(null);
      }
    }

    /**
     * R-0336 — EINE MARKIERTE BEHAUPTUNG. Derselbe Weg zur Route und dieselbe Einstufung wie je
     * Absatz (`wvZeile`, `wvEinstufen`); die Zeile steht ohne Absatznummer und ohne Sprung. Der
     * Lauf faerbt nichts (`wvSchluss` steigt bei `markierung` vor dem Schreiblauf aus) — Grund im
     * Kopfkommentar. Kennung, Fahne und spaete Antworten wie in `wvPruefen`.
     */
    function wvMarkierungPruefen() {
      if (wvLaeuft) { return; }
      wvLauf += 1;
      var lauf = wvLauf;
      wvLaeuft = true;
      wvMeldung = "";
      wvSchreibfehler = false;
      var weiche = ka7ExterneKi();
      var tief = weiche.lage === "erlaubt";
      wvStand = { zeilen: [], gesamt: 1, geprueft: 0, zeit: null, lage: "laeuft", tief: tief, ki: weiche.ki,
        ungeprueft: wvUngeprueftJa, markierung: true };
      wvZeichnen();
      wvMarkierungLesen(function (text) {
        if (lauf !== wvLauf) { return; }
        if (text === null) { wvSchluss(lauf, "fehler"); return; }
        if (text.replace(/^\s+|\s+$/g, "").length === 0) { wvSchluss(lauf, "keine-markierung"); return; }
        var mitschnitt = { koerper: null };
        w6DublettenAusCheckText(
          "wortvergleich",
          function () { return text; },
          wvUmschlag(tief, mitschnitt, wvStand.ungeprueft),
          askLocale(lang),
          deriveDraftTitleFromSelection(text)
        ).then(function (ergebnis) {
          if (lauf !== wvLauf) { return; }
          var http = ergebnis && typeof ergebnis.http === "number" ? ergebnis.http : 0;
          wvStand.zeilen.push(wvZeile({ nr: 0, text: text, hash: null, vk: 0, vorher: null }, ergebnis, mitschnitt.koerper));
          wvStand.geprueft = 1;
          wvSchluss(lauf, http === 401 || http === 403 ? "anmeldung" : "markierung");
        });
      });
    }

    function wvSchluss(lauf, lage) {
      // Die Kennung ZUERST: nur der Lauf, der noch der aktuelle ist, beendet den Lauf. Andernfalls
      // raeumte ein ueberholter Schluss die Fahne eines fremden, laufenden Vergleichs.
      if (lauf !== wvLauf || !wvStand) { return; }
      wvLaeuft = false;
      wvStand.lage = lage;
      wvStand.zeit = wvZeit();
      var auftraege = [];
      for (var i = 0; i < wvStand.zeilen.length; i += 1) {
        var z = wvStand.zeilen[i];
        // Fremde Hervorhebungen werden NICHT ueberfaerbt — sie sind Arbeit eines Menschen.
        if (WV_FARBEN[z.kategorie] && !z.fremdeFarbe) { auftraege.push(z); }
      }
      // ZUERST ZEICHNEN, DANN FAERBEN. Der Lauf ist hier zu Ende — gezeichnet war zuletzt aber
      // MITTEN im Lauf. Ohne diese Zeile stand im Fenster weiter „Absatz 3 von 3 …" mit sichtbarem
      // Abbruchknopf, waehrend `wvAbbrechen` schon bei `!wvLaeuft` aussteigt: ein Knopf, der nichts
      // tut. Das faellt erst auf, wenn Word den bestaetigenden `sync` nicht sofort zurueckgibt —
      // gemessen mit einem festgehaltenen `sync` (Codex-Vorpruefung R2, 08.09., zweite Pruefluecke).
      wvZeichnen();
      // R-0336: der Abgleich einer Markierung schreibt keine Farbe (Kopfkommentar).
      if (auftraege.length === 0 || wvStand.markierung === true) { return; }
      // Was wirklich geschrieben wurde — gemerkt wird es erst, wenn der `sync` es bestaetigt hat.
      var geschrieben = [];
      wvMitAbsaetzen(function (items) {
        // DIE KENNUNG GILT AUCH HIER — VOR DEM ERSTEN SCHREIBVORGANG, NICHT NUR BEIM AUFRAEUMEN.
        // Zwischen dem Schluss oben und dieser Stelle liegt ein `sync`: Word laedt die Absaetze,
        // auf die gefaerbt werden soll. Kommt er verzoegert zurueck (in Word der Normalfall bei
        // grossen Dokumenten), kann in der Zwischenzeit ein NEUER Vergleich vollstaendig gelaufen
        // sein und seine Farben stehen bereits im Dokument. Wer dann noch faerbt, schreibt die
        // Kategorien eines ueberholten Laufs ueber die des aktuellen: das Fenster wies „Ähnlich"
        // aus, im Dokument stand „Turquoise" (Ben, Pruefung der Runde 3 vom 08.09., Z7).
        // Der ueberholte Lauf schreibt also nichts — `geschrieben` bleibt leer, und damit merkt
        // er auch nichts vor. Die Farben des laufenden Vergleichs bleiben, wie er sie gesetzt hat.
        if (lauf !== wvLauf) { return; }
        var zu = wvZuordnen(items, auftraege);
        for (var j = 0; j < zu.paare.length; j += 1) {
          var p = zu.paare[j];
          // Zweite Pruefung, unmittelbar vor dem Schreiben: zwischen Lesen und Faerben kann ein
          // Mensch gefaerbt haben. Dann steht seine Farbe da, nicht Klaras.
          if (!wvDarfFaerben(p.posten.hash, p.posten.vk, p.absatz)) { p.posten.fremdeFarbe = true; continue; }
          var farbe = WV_FARBEN[p.posten.kategorie];
          if (p.absatz && p.absatz.font) { p.absatz.font.highlightColor = farbe; }
          geschrieben.push({ zeile: p.posten, farbe: farbe });
        }
        for (var k = 0; k < zu.verloren.length; k += 1) { zu.verloren[k].veraendert = true; }
      }, function (ok) {
        // Ohne bestaetigten `sync` steht keine Farbe im Dokument — dann wird auch nichts gemerkt,
        // sonst boete das Panel eine Ruecknahme fuer Markierungen an, die es nie gab.
        //
        // ZWEI VERSCHIEDENE DINGE, ZWEI VERSCHIEDENE ZUSTAENDIGKEITEN — deshalb steht die
        // Kennungspruefung NUR am zweiten:
        //   · Die Merkliste gehoert dem DOKUMENT. Was Word bestaetigt hat, steht wirklich dort,
        //     auch wenn inzwischen ein neuer Vergleich laeuft. Wuerde sie hier uebersprungen,
        //     stuenden Klaras Farben im Dokument, ohne dass „Markierungen entfernen" sie noch
        //     zuruecknehmen koennte (Fall Z6).
        //   · `wvSchreibfehler` gehoert dem LAUF: der Satz steht neben dessen Standsatz. Ein spaet
        //     gescheiterter Schreiblauf haengte ihn sonst dem naechsten Lauf an, der gar nicht
        //     geschrieben hat (Fall Z5).
        if (ok) {
          for (var m = 0; m < geschrieben.length; m += 1) { wvMerken(geschrieben[m].zeile, geschrieben[m].farbe); }
        } else if (lauf === wvLauf) {
          wvSchreibfehler = true;
        }
        wvZeichnen();
      });
    }

    function wvAbbrechen() {
      if (!wvLaeuft || !wvStand) { return; }
      // Die Laufnummer steigt: die noch offene Antwort des laufenden Absatzes faellt weg, und
      // `wvSchritt` fragt nicht weiter. Das Erreichte bleibt und wird gefaerbt.
      wvLauf += 1;
      wvLaeuft = false;
      wvSchluss(wvLauf, "abgebrochen");
    }

    /**
     * Nur Klaras eigene Farben zurueck — auf die URSPRUNGSFARBE, nicht auf „keine". Drei Ausgaenge,
     * jeder mit eigener Auskunft:
     *   · zurueck  — der Absatz traegt noch genau Klaras Farbe: Ursprungsfarbe wieder herstellen.
     *   · fremd    — dort steht inzwischen eine ANDERE Hervorhebung: das ist die Entscheidung eines
     *                Menschen. Sie bleibt stehen, und der Posten faellt aus der Liste, weil die
     *                Markierung nicht mehr Klaras ist (Ben 08.09., Pflicht 2).
     *   · verloren — der Absatz ist nicht mehr da oder umgeschrieben: unangetastet, Posten bleibt.
     */
    function wvEntfernen() {
      if (wvMerk.length === 0) { return; }
      var posten = wvMerk.slice(0);
      var ergebnis = null;
      wvMitAbsaetzen(function (items) {
        var zu = wvZuordnen(items, posten);
        var zurueck = 0;
        var fremd = 0;
        for (var i = 0; i < zu.paare.length; i += 1) {
          var p = zu.paare[i];
          if (wvFarbeAm(p.absatz) !== p.posten.gesetzt) { fremd += 1; continue; }
          if (p.absatz && p.absatz.font) { p.absatz.font.highlightColor = p.posten.vorher; }
          zurueck += 1;
        }
        ergebnis = { zurueck: zurueck, fremd: fremd, verloren: zu.verloren };
      }, function (ok) {
        if (!ok || ergebnis === null) { wvMeldung = t("wvEntferntFehler"); wvZeichnen(); return; }
        // Nur was WIRKLICH zurueckgestellt wurde, faellt aus der Merkliste; ein veraenderter
        // Absatz bleibt darin, damit seine Ursprungsfarbe nicht verloren geht.
        wvMerk = ergebnis.verloren.slice(0);
        wvMeldung = t("wvEntferntZahl", { n: String(ergebnis.zurueck), m: String(ergebnis.verloren.length) });
        if (ergebnis.fremd > 0) { wvMeldung += " " + t("wvEntferntFremd", { k: String(ergebnis.fremd) }); }
        wvZeichnen();
      });
    }

    function wvSpringen(hash, vk) {
      wvMitAbsaetzen(function (items) {
        var zu = wvZuordnen(items, [{ hash: hash, vk: vk }]);
        if (zu.paare.length === 0) { return; }
        var a = zu.paare[0].absatz;
        var bereich = a && typeof a.getRange === "function" ? a.getRange() : null;
        if (bereich && typeof bereich.select === "function") { bereich.select(); }
        else if (a && typeof a.select === "function") { a.select(); }
      }, function () {});
    }

    // ------------------------------------------------------------------------------------------
    // Die Flaeche
    // ------------------------------------------------------------------------------------------
    function wvKnoten(tag, klasse, text) {
      var el = document.createElement(tag);
      if (klasse) { el.className = klasse; }
      if (text !== undefined && text !== null) { el.textContent = text; }
      return el;
    }

    function wvBlockElement() {
      var vorhanden = document.getElementById("wv-block");
      if (vorhanden) { return vorhanden; }
      var block = wvKnoten("div", "hidden", null);
      block.id = "wv-block";
      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.id = "wv-btn";
      knopf.className = "ghost";
      knopf.setAttribute("data-t", "wvCta");
      knopf.textContent = t("wvCta");
      knopf.addEventListener("click", wvPruefen);
      block.appendChild(knopf);
      // R-0336: der zweite Einstieg — dieselbe Pruefung fuer EINE markierte Behauptung.
      var markierung = document.createElement("button");
      markierung.type = "button";
      markierung.id = "wv-markierung";
      markierung.className = "ghost";
      markierung.setAttribute("data-t", "wvMarkierungCta");
      markierung.textContent = t("wvMarkierungCta");
      markierung.addEventListener("click", wvMarkierungPruefen);
      block.appendChild(markierung);
      var stop = document.createElement("button");
      stop.type = "button";
      stop.id = "wv-abbrechen";
      stop.className = "ghost hidden";
      stop.setAttribute("data-t", "wvAbbrechen");
      stop.textContent = t("wvAbbrechen");
      stop.addEventListener("click", wvAbbrechen);
      block.appendChild(stop);
      var weg = document.createElement("button");
      weg.type = "button";
      weg.id = "wv-entfernen";
      weg.className = "ghost hidden";
      weg.setAttribute("data-t", "wvEntfernen");
      weg.textContent = t("wvEntfernen");
      weg.addEventListener("click", wvEntfernen);
      block.appendChild(weg);
      // R-0708: die ausdrueckliche Zustimmung. Der Text sitzt in einem eigenen <span> mit `data-t`:
      // der Sprachwechsel ersetzt den Textinhalt des Elements und nahm sonst den Haken mit.
      var zustimmung = wvKnoten("label", "muted", null);
      zustimmung.id = "wv-zustimmung";
      var haken = document.createElement("input");
      haken.type = "checkbox";
      haken.id = "wv-ungeprueft";
      haken.addEventListener("change", function () { wvUngeprueftJa = haken.checked === true; });
      zustimmung.appendChild(haken);
      var hakenText = wvKnoten("span", null, t("wvUngeprueftFrage"));
      hakenText.setAttribute("data-t", "wvUngeprueftFrage");
      zustimmung.appendChild(hakenText);
      block.appendChild(zustimmung);
      var karte = wvKnoten("div", "card", null);
      karte.id = "wv-karte";
      karte.setAttribute("role", "region");
      karte.setAttribute("aria-live", "polite");
      var stand = wvKnoten("p", "muted", "");
      stand.id = "wv-stand";
      karte.appendChild(stand);
      var legende = wvKnoten("ul", "muted", null);
      legende.id = "wv-legende";
      karte.appendChild(legende);
      var liste = wvKnoten("ul", null, null);
      liste.id = "wv-liste";
      karte.appendChild(liste);
      block.appendChild(karte);
      var anker = document.getElementById("ka7-block") || document.getElementById("bestand-block") || document.getElementById("ask-ruhe");
      if (anker && anker.parentNode) { anker.parentNode.insertBefore(block, anker.nextSibling); }
      else { document.body.appendChild(block); }
      return block;
    }

    /** Der Standsatz — jede Lage hat ihren eigenen, keine erfindet etwas. */
    function wvStandsatz() {
      if (wvMeldung) { return wvMeldung; }
      if (!wvStand) { return t("wvRuhe"); }
      var zahlen = { n: String(wvStand.geprueft), m: String(wvStand.gesamt), zeit: wvStand.zeit || "" };
      if (wvStand.lage === "laeuft") {
        if (wvStand.markierung === true) { return t("wvMarkierungLaeuft"); }
        if (wvStand.gesamt === 0) { return t("wvLaeuft", { n: "1", m: "?" }); }
        return t("wvLaeuft", { n: String(Math.min(wvStand.geprueft + 1, wvStand.gesamt)), m: String(wvStand.gesamt) });
      }
      if (wvStand.lage === "fehler") { return t("wvFehler"); }
      if (wvStand.lage === "leer") { return t("wvLeer"); }
      if (wvStand.lage === "anmeldung") { return t("wvAnmeldung"); }
      if (wvStand.lage === "keine-markierung") { return t("wvKeineMarkierung"); }
      if (wvStand.lage === "markierung") { return t("wvMarkierungFertig", zahlen); }
      return t(wvStand.lage === "abgebrochen" ? "wvAbgebrochen" : "wvFertig", zahlen);
    }

    /** Die Auskunft ueber den Widerspruchszweig — die Farbe Rot haengt an ihr. */
    function wvKiSatz() {
      if (!wvStand) { return ""; }
      if (!wvStand.tief) { return t("wvKiFehlt"); }
      return t("wvKiZeile", { ki: ka7KiZusatz(wvStand.ki) });
    }

    function wvQuellenzeile(quelle) {
      var zeile = wvKnoten("li", null, null);
      zeile.appendChild(wvKnoten("span", "wv-quelle-titel", quelle.title));
      zeile.appendChild(wvKnoten("span", "muted wv-quelle-pruefstand",
        quelle.pruefstand === "validiert" ? t("askStatusValidiert")
          : quelle.pruefstand === "eingereicht" ? t("bestandNochNichtGeprueft") : t("askStatusUnknown")));
      if (quelle.stelle) { zeile.appendChild(wvKnoten("p", "wv-quelle-stelle", t("wvKonfliktStelle", { stelle: quelle.stelle }))); }
      else if (quelle.konflikt) { zeile.appendChild(wvKnoten("p", "wv-quelle-stelle", t("wvKonfliktOhneStelle"))); }
      var pfad = quelle.fundort ? quelle.fundort.bibliothekPfad : null;
      if (pfad) {
        var weg = wvKnoten("a", null, t("bestandOeffnen"));
        weg.href = window.location.origin + pfad;
        weg.target = "_blank";
        weg.rel = "noopener noreferrer";
        zeile.appendChild(weg);
      }
      return zeile;
    }

    function wvAbsatzzeile(z) {
      var zeile = wvKnoten("li", "wv-zeile wv-zeile-" + z.kategorie, null);
      var kopf = wvKnoten("p", "wv-kopf", null);
      // R-0336: die Zeile einer Markierung (`hash === null`) hat keine Absatznummer.
      kopf.appendChild(wvKnoten("span", "wv-nr", z.hash === null ? t("wvMarkierungNr") : t("wvAbsatzNr", { n: String(z.nr) })));
      kopf.appendChild(wvKnoten("span", "wv-kategorie", t(WV_KAT_KEYS[z.kategorie])));
      kopf.appendChild(wvKnoten("span", "muted wv-farbe",
        WV_FARB_KEYS[z.kategorie] && wvGefaerbt(z.hash, z.vk) ? t(WV_FARB_KEYS[z.kategorie]) : t("wvFarbeKeine")));
      zeile.appendChild(kopf);
      if (z.grund) {
        zeile.appendChild(wvKnoten("p", "muted wv-grund",
          t(z.grund, { min: String(W6_MINDESTZEICHEN), max: String(W6_HOECHSTZEICHEN) })));
      }
      if (z.teil && !z.grund) { zeile.appendChild(wvKnoten("p", "muted wv-teil", t("wvTeilHinweis", { max: String(W6_HOECHSTZEICHEN) }))); }
      if (z.fremdeFarbe) { zeile.appendChild(wvKnoten("p", "muted wv-fremd", t("wvFremdeFarbe"))); }
      // Zwischen Lesen und Faerben umgeschrieben: nichts wurde blind gefaerbt, und die Zeile sagt es.
      if (z.veraendert) { zeile.appendChild(wvKnoten("p", "muted wv-veraendert", t("wvVeraendert"))); }
      if (z.kategorie === "widerspruch") { zeile.appendChild(wvKnoten("p", "wv-entscheidung", t("wvKeineEntscheidung"))); }
      // Ob die Konfliktpruefung ueberhaupt lief, sagt jede Zeile fuer sich — „kein Widerspruch"
      // waere sonst eine Aussage ueber einen Vorgang, den niemand angestossen hat.
      if (z.kategorie !== "widerspruch" && z.konfliktlage.gelaufen !== true && !z.grund) {
        var grundKey = KA7_GRUND_KEYS[z.konfliktlage.grund || ""] || "ka7GrundUnbekannt";
        zeile.appendChild(wvKnoten("p", "muted wv-konflikt-offen", t("wvKonfliktOffen", { grund: t(grundKey) })));
      }
      if (z.quellen.length > 0) {
        var quellen = wvKnoten("ul", "wv-quellen", null);
        for (var i = 0; i < z.quellen.length; i += 1) { quellen.appendChild(wvQuellenzeile(z.quellen[i])); }
        zeile.appendChild(quellen);
      }
      // Eine Markierung ist keine Stelle, die sich ueber die Merkliste wiederfinden liesse: kein Sprung.
      if (z.hash === null) { return zeile; }
      var sprung = document.createElement("button");
      sprung.type = "button";
      sprung.className = "ghost wv-sprung";
      sprung.setAttribute("data-wv-sprung", String(z.nr));
      sprung.textContent = t("wvSpringen");
      // Der Sprung gilt DIESEM Vorkommen: bei zwei gleichen Absaetzen fuehrt Zeile 2 zu Absatz 2.
      sprung.addEventListener("click", (function (hash, vk) {
        return function () { wvSpringen(hash, vk); };
      })(z.hash, z.vk));
      zeile.appendChild(sprung);
      return zeile;
    }

    function wvZeichnen() {
      var block = wvBlockElement();
      var ruhe = document.getElementById("ask-ruhe");
      var ruheSichtbar = Boolean(ruhe) && ruhe.className.indexOf("hidden") === -1;
      block.className = signedIn && officeUsable() && ruheSichtbar ? "" : "hidden";
      var knopf = document.getElementById("wv-btn");
      var stop = document.getElementById("wv-abbrechen");
      var weg = document.getElementById("wv-entfernen");
      var stand = document.getElementById("wv-stand");
      var legende = document.getElementById("wv-legende");
      var liste = document.getElementById("wv-liste");
      if (!knopf || !stop || !weg || !stand || !legende || !liste) { return; }
      knopf.disabled = wvLaeuft;
      var markierung = document.getElementById("wv-markierung");
      if (markierung) { markierung.disabled = wvLaeuft; }
      // R-0708: waehrend eines Laufs ist der Haken fest — der Lauf hat seine Zustimmung schon gelesen.
      var haken = document.getElementById("wv-ungeprueft");
      if (haken) { haken.checked = wvUngeprueftJa; haken.disabled = wvLaeuft; }
      // Der Abgleich EINER Markierung ist ein einzelner Abruf ohne Fortschritt — kein Abbruchknopf.
      var nurMarkierung = Boolean(wvStand) && wvStand.markierung === true;
      stop.className = wvLaeuft && !nurMarkierung ? "ghost" : "ghost hidden";
      weg.className = wvMerk.length > 0 ? "ghost" : "ghost hidden";
      var saetze = [wvStandsatz()];
      // Der Schreiblauf am Ende scheiterte: der Befund steht, die Farben stehen NICHT im Dokument.
      // Das ersetzt den Standsatz nicht, es ergaenzt ihn — beides ist wahr.
      if (wvSchreibfehler) { saetze.push(t("wvFarbenFehler")); }
      var ki = wvKiSatz();
      if (ki) { saetze.push(ki); }
      // R-0708: wogegen abgeglichen wurde — die Zustimmung, mit der DIESER Lauf begann. Nur, wenn
      // auch etwas abgeglichen wurde.
      if (wvStand && wvStand.zeilen.length > 0) {
        saetze.push(t(wvStand.ungeprueft === true ? "wvBestandMitOffenen" : "wvBestandValidiert"));
      }
      stand.textContent = saetze.join(" ");
      while (legende.firstChild) { legende.removeChild(legende.firstChild); }
      while (liste.firstChild) { liste.removeChild(liste.firstChild); }
      if (!wvStand) { return; }
      // Die Legende erklaert Farben IM DOKUMENT. Steht dort keine von Klara — vor dem ersten
      // Faerben und nach „Markierungen entfernen" —, erklaert sie nichts und steht nicht da.
      if (wvMerk.length > 0) {
        legende.appendChild(wvKnoten("li", "wv-legende-kopf", t("wvLegende")));
        for (var l = 0; l < WV_LEGENDE.length; l += 1) {
          var kat = WV_LEGENDE[l];
          legende.appendChild(wvKnoten("li", "wv-legende-" + kat,
            t(WV_KAT_KEYS[kat]) + " · " + (WV_FARB_KEYS[kat] ? t(WV_FARB_KEYS[kat]) : t("wvFarbeKeine"))));
        }
      }
      for (var i = 0; i < wvStand.zeilen.length; i += 1) { liste.appendChild(wvAbsatzzeile(wvStand.zeilen[i])); }
    }

    /** Ein bestaetigter Logout verwirft den BEFUND — nie den Befund einer fremden Sitzung zeigen.
     *  Die Merkliste bleibt: sie traegt kein Wissen, nur Farben, und ohne sie waeren Klaras eigene
     *  Markierungen im Dokument nicht mehr zurueckzunehmen. */
    function wvVerwerfen() {
      wvLauf += 1;
      wvLaeuft = false;
      wvStand = null;
      // R-0708: die Zustimmung war die der abgemeldeten Person — sie geht nicht auf die naechste ueber.
      wvUngeprueftJa = false;
      wvMeldung = "";
      wvSchreibfehler = false;
      wvZeichnen();
    }

    // ------------------------------------------------------------------------------------------
    // Anschluss — derselbe Wrapper-Gedanke wie in KA6/KA7: das Original zuerst und unveraendert.
    // ------------------------------------------------------------------------------------------
    if (typeof document !== "undefined" && document.getElementById("ask-ruhe")) {
      if (typeof STRINGS !== "undefined") {
        for (var wvSprache in WV_TEXTE) {
          if (Object.prototype.hasOwnProperty.call(WV_TEXTE, wvSprache) && STRINGS[wvSprache]) {
            var wvTabelle = WV_TEXTE[wvSprache];
            for (var wvSchluessel in wvTabelle) {
              if (Object.prototype.hasOwnProperty.call(wvTabelle, wvSchluessel)) {
                STRINGS[wvSprache][wvSchluessel] = wvTabelle[wvSchluessel];
              }
            }
          }
        }
      }
      wvBlockElement();
      wvZeichnen();
      if (typeof updateAskState === "function") {
        var wvAskStateBestand = updateAskState;
        updateAskState = function () { wvAskStateBestand.apply(this, arguments); wvZeichnen(); };
      }
      if (typeof kwFlaecheZeichnen === "function") {
        var wvFlaecheBestand = kwFlaecheZeichnen;
        kwFlaecheZeichnen = function () { wvFlaecheBestand.apply(this, arguments); wvZeichnen(); };
      }
      if (typeof klaraS4Verwerfen === "function") {
        var wvVerwerfenBestand = klaraS4Verwerfen;
        klaraS4Verwerfen = function () { wvVerwerfenBestand.apply(this, arguments); wvVerwerfen(); };
      }
      if (typeof setLang === "function") {
        var wvSetLangBestand = setLang;
        setLang = function () { wvSetLangBestand.apply(this, arguments); wvZeichnen(); };
      }
    }
    // KW-WORDVERGLEICH-END

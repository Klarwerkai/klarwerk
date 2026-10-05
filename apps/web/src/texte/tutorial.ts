// ================================================================================================
// FE-003 · DIE TEXTE DES SEITENTUTORIALS — Rahmen (`tutorial.*`) und Unterricht „Fragen“
// (`tutorial.fragen.*`), in DE/EN/NL.
// ================================================================================================
//
// WIE EIN LEHRER: erklären → vormachen → gemeinsam üben → selbst anwenden. Ausführlich in der Sache,
// überschaubar je Schritt; die Vertiefung ist aufklappbar. Platzhalter wie `{{mehr}}` werden mit den
// Beschriftungen der ECHTEN Seite gefüllt (`tutorial/fragen/lektion.ts`, `textWerte`) — die
// Erklärung nennt einen Knopf also immer so, wie er gerade heisst.
//
// ALLES BEISPIELHAFTE IST ALS ERFUNDEN BENANNT: die Homeoffice-Frage, die Antwort, die
// Demo-Richtlinie. Keine Demoantwort gibt sich als Auskunft eines Unternehmens aus.
//
// WAS DIE TEXTE NICHT BEHAUPTEN: Produktverhalten, das es nicht gibt. Jeder Satz über die Seite
// beschreibt einen Zustand, den `pages/Ask.tsx` heute zeigt (Warten, Antwortkarte mit Ziffern und
// Chips, „…“ → „Mehr“ mit Quellenliste, Wissenslücke, gesperrter Sendeknopf mit Alternativen).
// Ändert sich die Seite, müssen diese Sätze mitgeprüft werden — die Bausteine der Demo ändern sich
// von selbst mit, die Erklärung nicht (Ticket FE-003, „Aktualität ohne Screenshots“).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "tutorial.",
  legacySchluessel: [],
  de: {
    "tutorial.begleitung.label": "Tutorial: {{titel}}",
    "tutorial.begleitung.erklaerung": "Erklärung zu diesem Schritt",
    "tutorial.begleitung.zurueck":
      "Mit „Schließen“ oben im Blatt oder mit Escape geht es zurück zum Tutorial.",
    // ---------------------------------------------------------------------------------- Rahmen
    "tutorial.knopf": "Tutorial",
    "tutorial.knopf.oeffnen": "Interaktives Tutorial zu dieser Seite öffnen",
    "tutorial.knopf.schliessen": "Tutorial zu dieser Seite schließen",
    "tutorial.lernziel": "Lernziel",
    "tutorial.schliessen": "Tutorial schließen",
    "tutorial.vorlesen.start": "Vorlesen",
    "tutorial.vorlesen.stop": "Vorlesen stoppen",
    "tutorial.vorlesen.hinweis":
      "Vorlesen ist freiwillig: Es nutzt die Sprachausgabe deines Browsers und startet nur auf Klick.",
    "tutorial.vorlesen.nichtMoeglich":
      "Dieser Browser kann nicht vorlesen. Alle Inhalte stehen vollständig als Text da.",
    "tutorial.fortschritt": "Schritt {{nr}} von {{gesamt}}: {{titel}}",
    "tutorial.fortschritt.label": "Fortschritt im Tutorial",
    "tutorial.kapitel": "Kapitel",
    "tutorial.vertiefung": "Mehr dazu",
    "tutorial.zurueck": "Zurück",
    "tutorial.weiter": "Weiter",
    "tutorial.beenden": "Tutorial beenden",
    "tutorial.abspielen": "Vorführen",
    "tutorial.pause": "Pause",
    "tutorial.wiederholen": "Schritt wiederholen",
    "tutorial.vorfuehrung": "Die Vorführung in diesem Schritt",
    "tutorial.vorfuehrung.laeuft": "Gerade gezeigt:",
    "tutorial.vorfuehrung.steht": "Angehalten bei:",
    "tutorial.reduziert":
      "Reduzierte Bewegung ist eingeschaltet: Die Vorführung zeigt Eingaben sofort vollständig statt Buchstabe für Buchstabe und verzichtet auf Aufleuchten.",
    "tutorial.demo.kennzeichen": "Demo",
    "tutorial.demo.hinweis": "Beispieldaten · es wird nichts gesendet oder gespeichert",
    "tutorial.demo.label": "Vorführung: verkleinerte Fragen-Seite mit Beispieldaten",
    "tutorial.demo.verweis":
      "In der Vorführung öffnet dieser Verweis nichts. Auf der echten Seite führt er zu: {{ziel}}",
    "tutorial.ziel.fehlt":
      "Das erklärte Bedienelement fehlt in der Vorführung ({{ziel}}). Die Erklärung passt nicht mehr zur Seite — bitte melden.",
    "tutorial.laden": "Vorführung wird geladen …",
    "tutorial.laden.fehler": "Die Vorführung konnte nicht geladen werden.",
    "tutorial.laden.nochmal": "Noch einmal versuchen",

    // --------------------------------------------------------------------- Unterricht „Fragen“
    "tutorial.fragen.titel": "Tutorial: Fragen",
    "tutorial.fragen.lernziel":
      "Du stellst eine Frage so, dass KLARWERK sie aus eurem eigenen Wissen beantworten kann, liest die Antwort richtig und prüfst jede Aussage an ihrer Quelle. Am Ende stellst du selbst eine Frage.",

    "tutorial.fragen.verstehen.kurz": "Verstehen",
    "tutorial.fragen.verstehen.titel": "Verstehen: Wofür ist diese Seite da?",
    "tutorial.fragen.verstehen.text":
      "Auf der Seite „Fragen“ stellst du eine Frage in eigenen Worten. KLARWERK sucht die Antwort ausschließlich in den Wissensobjekten eures Unternehmens — nicht im allgemeinen Wissen eines Sprachmodells — und zeigt zu jeder Antwort, auf welche Quellen sie sich stützt.\n\nGut geeignet sind Fragen nach Regeln, Abläufen und Zuständigkeiten, zum Beispiel: „Wie viele Homeoffice-Tage sind erlaubt?“ Dieses Beispiel und alles, was das Tutorial dazu zeigt, ist erfunden und als Demo gekennzeichnet.",
    "tutorial.fragen.verstehen.vertiefung":
      "Findet KLARWERK keine belastbare Grundlage, sagt es das offen, statt zu raten. Die Seite ist deshalb kein allgemeiner Chat: Eine Frage zu einem Thema, das in eurem Wissen nicht vorkommt, endet ehrlich als Wissenslücke. Wie das aussieht, zeigt Schritt 6.\n\nDie Vorführung rechts ist eine verkleinerte Fragen-Seite aus denselben Bausteinen wie die echte — mit Beispieldaten. Du kannst sie bedienen; sie sendet nichts.",
    "tutorial.fragen.verstehen.teil.feld":
      "Das Eingabefeld: Hier schreibst du deine Frage. Es steht unten auf der Seite.",
    "tutorial.fragen.verstehen.teil.beispiele":
      "„{{beispiele}}“: Solange das Feld leer ist, schlägt die Seite Fragen aus eurem Bestand vor. Auf der echten Seite schickt ein Klick auf einen Vorschlag die Frage sofort ab.",
    "tutorial.fragen.verstehen.teil.ergebnis":
      "Über dem Feld erscheint nach dem Absenden die Antwort mit ihren Quellen. Vor der ersten Frage ist dieser Bereich leer.",

    "tutorial.fragen.formulieren.kurz": "Formulieren",
    "tutorial.fragen.formulieren.titel": "Frage formulieren: konkret und mit Kontext",
    "tutorial.fragen.formulieren.text":
      "Je genauer die Frage, desto sicherer findet KLARWERK die passende Stelle in eurem Wissen. Nenne, worum es geht, und — wenn es darauf ankommt — für wen oder wofür: Standort, Abteilung, Anlage, Zeitraum.\n\n„Wie viele Homeoffice-Tage sind erlaubt?“ ist eine gute Frage. „Homeoffice?“ lässt offen, was du wissen willst. In der Vorführung wird die Beispielfrage ins Eingabefeld getippt; mit „Pause“ hältst du sie an, mit „Schritt wiederholen“ beginnt sie neu.",
    "tutorial.fragen.formulieren.vertiefung":
      "Stelle eine Frage pro Eingabe: Wer zwei Dinge wissen will, stellt besser zwei Fragen. Verwende die Wörter, die in eurem Unternehmen üblich sind — so heißen meist auch die Wissensobjekte.\n\nUnterstützt dein Browser Spracheingabe, steht neben dem Feld ein Mikrofon. Das Gesagte wird an die Frage angehängt; abgeschickt wird erst, wenn du selbst absendest.",
    "tutorial.fragen.formulieren.teil.tippen":
      "Die Beispielfrage wird ins Eingabefeld geschrieben.",
    "tutorial.fragen.formulieren.teil.kontext":
      "Die Frage steht im Feld: konkret, mit Gegenstand. Noch ist nichts gesendet.",

    "tutorial.fragen.absenden.kurz": "Absenden",
    "tutorial.fragen.absenden.titel": "Frage absenden: was nach dem Klick passiert",
    "tutorial.fragen.absenden.text":
      "Abgeschickt wird mit dem runden Pfeil rechts im Feld oder mit der Eingabetaste. Danach dreht sich im Knopf ein Ladesymbol, und über dem Feld erscheinen graue Platzhalterzeilen: KLARWERK sucht passende Wissensobjekte und formuliert daraus die Antwort. Das dauert meist einige Sekunden; so lange ist der Knopf gesperrt, damit dieselbe Frage nicht doppelt läuft.\n\nIn dieser Vorführung wird nichts gesendet — der Wartezustand ist nur gezeigt. Du kannst den Pfeil in der Demo auch selbst anklicken.",
    "tutorial.fragen.absenden.vertiefung":
      "Ist der Pfeil ausgegraut, fehlt entweder die Frage im Feld, oder für Antworten ist gerade kein KI-Modell aktiv. Im zweiten Fall steht der Grund direkt unter dem Feld (Schritt 6).\n\nBricht die Verbindung ab, meldet die Seite das an der Stelle, an der sonst die Antwort erscheint, und bietet an, es erneut zu versuchen. Stellst du dieselbe Frage noch einmal, bleibt die vorige Antwort stehen, bis die neue da ist.",
    "tutorial.fragen.absenden.teil.knopf":
      "Der Sendeknopf mit dem Pfeil. Auf der echten Seite schickt er die Frage ab.",
    "tutorial.fragen.absenden.teil.warten":
      "Der Wartezustand: Ladesymbol im Knopf und Platzhalterzeilen über dem Feld. Hier nur vorgeführt.",

    "tutorial.fragen.antwort.kurz": "Antwort",
    "tutorial.fragen.antwort.titel": "Antwort verstehen: Aussage, Quelle, Einschränkung",
    "tutorial.fragen.antwort.text":
      "Die Antwort erscheint als Karte über dem Eingabefeld. Lies sie in drei Schritten:\n\n1. Die Aussage selbst.\n2. Die kleinen hochgestellten Ziffern im Text: Jede Ziffer gehört zu dem Quellen-Chip mit derselben Nummer unter der Antwort. Am Chip steht außerdem, ob die Quelle die Antwort getragen hat („{{verwendet}}“).\n3. Der Hinweis unter der Aussage: Die Antwort wurde von einer KI aus euren Quellen formuliert. Sie ist nur so verlässlich wie diese Quellen — prüfe sie, bevor du dich auf etwas Wichtiges verlässt.\n\nDie Antwort in der Vorführung ist ein erfundenes Beispiel und keine Auskunft deines Unternehmens.",
    "tutorial.fragen.antwort.vertiefung":
      "Ein gelber Punkt am Chip heißt: Diese Quelle ist noch nicht geprüft. Ein roter Punkt heißt: Zu ihr gibt es einen offenen Konflikt. „{{angesehen}}“ bedeutet, dass die Quelle herangezogen, aber für die Antwort nicht verwendet wurde.\n\nUnter der Karte kannst du die Antwort mit „{{kopieren}}“ übernehmen und mit „{{geholfen}}“ rückmelden, dass sie dir geholfen hat. Über das Menü „…“ an der Karte lässt sie sich drucken oder als Datei speichern.",
    "tutorial.fragen.antwort.teil.aussage":
      "Die Aussage der Antwort — hier ein erfundenes Beispiel.",
    "tutorial.fragen.antwort.teil.ziffer":
      "Ziffer im Text und Chip gehören zusammen: Die Aussage stützt sich auf Quelle 1.",
    "tutorial.fragen.antwort.teil.kennzeichnung":
      "Die Kennzeichnung: von einer KI aus euren Quellen formuliert — fachlich prüfen.",

    "tutorial.fragen.quelle.kurz": "Quelle",
    "tutorial.fragen.quelle.titel": "Quelle nachvollziehen: eine Aussage prüfen",
    "tutorial.fragen.quelle.text":
      "Um eine Aussage zu prüfen, gehst du an ihre Quelle — auf zwei Wegen, die die Seite anbietet:\n\n1. Der Quellen-Chip unter der Antwort führt auf der echten Seite direkt zum Wissensobjekt.\n2. Das Menü „…“ oben rechts an der Antwortkarte, dann „{{mehr}}“: Es öffnet ein Blatt mit der Liste der herangezogenen Quellen — je Quelle, ob sie verwendet wurde, ihr Prüfstand, ihre Nutzbarkeit, eine Kurzvorschau, der Auszug im Dokumentformat und, falls hinterlegt, das Original.\n\nIn der Vorführung ist beides bedienbar: Der Chip sagt, wohin er auf der echten Seite führt (die erfundene Demo-Quelle hat kein Wissensobjekt), und „…“ → „{{mehr}}“ öffnet dasselbe Blatt mit derselben Quellenliste wie auf der echten Seite. Vergleiche dort die Aussage der Antwort mit dem Auszug: Steht dort wirklich, was die Antwort sagt?",
    "tutorial.fragen.quelle.vertiefung":
      "Achte beim Prüfen auf drei Dinge: Ist die Quelle validiert oder noch offen? Wie aktuell ist sie? Fügt die Antwort etwas hinzu, das im Auszug nicht steht?\n\nDie Demo-Quelle hat kein hinterlegtes Original, und die Vorführung sagt das so, wie es die echte Seite bei jeder Quelle ohne Datei oder Adresse sagt — sie deutet keine Tür an, die es nicht gibt.",
    "tutorial.fragen.quelle.teil.chip":
      "Der Quellen-Chip. Auf der echten Seite öffnet er das Wissensobjekt; in der Demo erklärt er das, weil die Demo-Quelle keines hat.",
    "tutorial.fragen.quelle.teil.liste":
      "Das Blatt „{{mehr}}“ mit der Liste der herangezogenen Quellen — dasselbe wie auf der echten Seite.",
    "tutorial.fragen.quelle.teil.stand":
      "Zwei Auskünfte je Quelle: Hat sie die Antwort getragen („{{verwendet}}“), und wie ist ihr Prüfstand?",
    "tutorial.fragen.quelle.teil.original":
      "Kurzvorschau, Auszug und Original: Hier prüfst du die Aussage selbst nach.",

    "tutorial.fragen.sonderfaelle.kurz": "Sonderfälle",
    "tutorial.fragen.sonderfaelle.titel": "Sonderfälle: wenn es keine sichere Antwort gibt",
    "tutorial.fragen.sonderfaelle.text":
      "Nicht jede Frage bekommt eine Antwort — das ist Absicht. Drei Fälle solltest du kennen:\n\n1. Wissenslücke: Findet KLARWERK nichts Belastbares, erscheint „{{luecke}}“ statt einer erfundenen Antwort. Formuliere die Frage mit anderen Fachwörtern neu oder halte das fehlende Wissen fest.\n2. Unsichere Belege: Ist eine Quelle noch nicht geprüft oder lässt sich nicht zuordnen, welche Quelle die Antwort trägt, sagt die Seite das am Chip und in der Quellenliste. Prüfe dann besonders sorgfältig.\n3. Fragefunktion nicht verfügbar: Ist für Antworten gerade kein KI-Modell aktiv, bleibt der Sendeknopf gesperrt. Unter dem Feld stehen die Wege, die auch ohne KI funktionieren: „{{bibliothek}}“ und „{{erfassen}}“.",
    "tutorial.fragen.sonderfaelle.vertiefung":
      "„{{bibliothek}}“ führt in die Bibliothek: Dort suchst du ohne KI im Bestand und liest die Wissensobjekte selbst. „{{erfassen}}“ ist der Weg, eine Lücke zu schließen. Ob du ihn gehen darfst, hängt von deiner Rolle ab — ohne Berechtigung zeigt die Seite ihn als Hinweis ohne Link.\n\nWas bei einer Wissenslücke als Nächstes sinnvoll ist, steht auf der echten Seite unter „…“ → „{{mehr}}“.",
    "tutorial.fragen.sonderfaelle.teil.luecke":
      "Wissenslücke: keine belastbare Grundlage — keine Antwort wird erfunden.",
    "tutorial.fragen.sonderfaelle.teil.unsicher":
      "Unsichere Belege: gelber Punkt und „{{unbekannt}}“ am Chip, unter „…“ → „{{mehr}}“ der Satz zur unbekannten Zuordnung — besonders sorgfältig prüfen.",
    "tutorial.fragen.sonderfaelle.teil.kiaus":
      "Fragefunktion nicht verfügbar: Sendeknopf gesperrt, darunter die Wege ohne KI.",

    "tutorial.fragen.ueben.kurz": "Üben",
    "tutorial.fragen.ueben.titel": "Selbst ausprobieren",
    "tutorial.fragen.ueben.text":
      "Jetzt du. Tippe in der Vorführung eine eigene Übungsfrage ein und schicke sie mit dem Pfeil oder der Eingabetaste ab. Prüfe danach die Quelle: über „…“ → „{{mehr}}“ an der Übungsantwort.\n\nDie Übung sendet nichts: Sie antwortet auf jede Frage mit derselben erfundenen Beispielantwort, damit du den Ablauf in Ruhe durchgehen kannst.\n\nWenn du so weit bist, bringt dich „{{eigeneFrage}}“ zum echten Eingabefeld. Eine Frage, die dort schon steht, bleibt erhalten; abgeschickt wird erst, wenn du selbst absendest.",
    "tutorial.fragen.ueben.vertiefung":
      "Der Ablauf für den Alltag: konkret fragen → Antwort lesen → Ziffer und Chip verbinden → Quelle öffnen → Aussage am Auszug prüfen. Ohne passende Quelle gibt es keine Antwort; dann helfen die Bibliothek oder das Festhalten des fehlenden Wissens.",
    "tutorial.fragen.ueben.teil.eingeben": "Tippe deine Übungsfrage ins Feld der Vorführung.",
    "tutorial.fragen.ueben.teil.senden":
      "Schicke sie in der Vorführung ab — es geht nichts hinaus.",
    "tutorial.fragen.ueben.teil.pruefen":
      "Lies die Übungsantwort und prüfe die Quelle: Chip oder „…“ → „{{mehr}}“.",

    "tutorial.fragen.demo.frage": "Wie viele Homeoffice-Tage sind erlaubt?",
    "tutorial.fragen.demo.antwort":
      "Laut der fiktiven Demo-Richtlinie sind bis zu **zwei Homeoffice-Tage pro Woche** möglich, nach Absprache mit der Führungskraft [1]. Dies ist ein erfundenes Beispiel und keine Regel deines Unternehmens.",
    "tutorial.fragen.demo.beispielantwort": "Demo · Beispielantwort",
    "tutorial.fragen.demo.uebungsantwort": "Demo · Übungsantwort",
    "tutorial.fragen.demo.uebungHinweis":
      "Übung: Die Vorführung antwortet auf jede Frage mit diesem erfundenen Beispiel. Deine Frage wurde nicht gesendet.",
    "tutorial.fragen.demo.uebungLeer":
      "Hier erscheint nach dem Absenden die Übungsantwort. Tippe unten eine Frage ein.",
    "tutorial.fragen.demo.leer": "Hier erscheint nach dem Absenden die Antwort mit ihren Quellen.",
    "tutorial.fragen.demo.beispiele":
      "Auf der echten Seite stehen hier Beispielfragen aus eurem Bestand; ein Klick schickt sie sofort ab.",
    "tutorial.fragen.quelle.teil.menue":
      "Das Menü „…“ oben rechts an der Antwortkarte. Öffne es und wähle „{{mehr}}“.",
    "tutorial.fragen.demo.chip":
      "Auf der echten Seite öffnet dieser Chip das Wissensobjekt der Quelle. Die Demo-Quelle ist erfunden und hat keines — ihren Nachweis zeigt „…“ → „{{mehr}}“ an dieser Antwortkarte.",
    "tutorial.fragen.demo.menueNichts":
      "In der Vorführung wird nichts gedruckt und nichts gespeichert. Auf der echten Seite drucken bzw. speichern diese Punkte die Antwort samt Quellen.",
    "tutorial.fragen.demo.mehrHinweis":
      "Beispieldaten — dieselbe Quellenliste wie auf der echten Seite.",
    "tutorial.fragen.demo.mehrOrt": "Auf der echten Seite unter „…“ → „{{menue}}“ an der Antwort:",
    "tutorial.fragen.demo.lueckenfrage": "Wie lange dauert ein Sabbatical?",
    "tutorial.fragen.demo.quelle.titel": "Demo-Richtlinie Homeoffice (fiktiv)",
    "tutorial.fragen.demo.quelle.kernaussage":
      "Bis zu zwei Homeoffice-Tage pro Woche nach Absprache mit der Führungskraft (erfundenes Beispiel).",
    "tutorial.fragen.demo.quelle.abschnitt": "Abschnitt 2 · Mobiles Arbeiten (fiktiv)",
    "tutorial.fragen.demo.quelle.auszug":
      "Beschäftigte können bis zu zwei Tage pro Woche von zu Hause arbeiten. Die Tage werden mit der Führungskraft abgestimmt. — Erfundener Beispieltext für das Tutorial.",
    "tutorial.fragen.demo.quelle.autor": "Demo-Redaktion (fiktiv)",

    "tutorial.fragen.uebergang.text":
      "Bereit für die echte Seite? „Eigene Frage stellen“ schließt das Tutorial und setzt den Cursor ins echte Eingabefeld. Was dort schon steht, bleibt stehen, und es wird nichts automatisch gesendet.",
    "tutorial.fragen.uebergang.knopf": "Eigene Frage stellen",
    "tutorial.fragen.uebergang.kiAus":
      "Hinweis: Auf der echten Seite ist die Fragefunktion gerade nicht verfügbar. Das gilt dort gerade:",
    "tutorial.fragen.uebergang.zielFehlt":
      "Das echte Eingabefeld wurde auf dieser Seite nicht gefunden. Schließe das Tutorial und lade die Seite neu.",
  },
  en: {
    "tutorial.begleitung.label": "Tutorial: {{titel}}",
    "tutorial.begleitung.erklaerung": "Explanation for this step",
    "tutorial.begleitung.zurueck":
      "Use “Close” at the top of the sheet or Escape to return to the tutorial.",
    "tutorial.knopf": "Tutorial",
    "tutorial.knopf.oeffnen": "Open the interactive tutorial for this page",
    "tutorial.knopf.schliessen": "Close the tutorial for this page",
    "tutorial.lernziel": "Learning goal",
    "tutorial.schliessen": "Close tutorial",
    "tutorial.vorlesen.start": "Read aloud",
    "tutorial.vorlesen.stop": "Stop reading",
    "tutorial.vorlesen.hinweis":
      "Reading aloud is optional: it uses your browser's speech output and only starts when you click.",
    "tutorial.vorlesen.nichtMoeglich":
      "This browser cannot read aloud. All content is fully available as text.",
    "tutorial.fortschritt": "Step {{nr}} of {{gesamt}}: {{titel}}",
    "tutorial.fortschritt.label": "Tutorial progress",
    "tutorial.kapitel": "Chapters",
    "tutorial.vertiefung": "More on this",
    "tutorial.zurueck": "Back",
    "tutorial.weiter": "Next",
    "tutorial.beenden": "Finish tutorial",
    "tutorial.abspielen": "Demonstrate",
    "tutorial.pause": "Pause",
    "tutorial.wiederholen": "Repeat step",
    "tutorial.vorfuehrung": "The demonstration in this step",
    "tutorial.vorfuehrung.laeuft": "Now showing:",
    "tutorial.vorfuehrung.steht": "Paused at:",
    "tutorial.reduziert":
      "Reduced motion is on: the demonstration shows input in full at once instead of letter by letter and does not flash.",
    "tutorial.demo.kennzeichen": "Demo",
    "tutorial.demo.hinweis": "Sample data · nothing is sent or saved",
    "tutorial.demo.label": "Demonstration: scaled-down Ask page with sample data",
    "tutorial.demo.verweis":
      "In the demonstration this link opens nothing. On the real page it leads to: {{ziel}}",
    "tutorial.ziel.fehlt":
      "The control being explained is missing from the demonstration ({{ziel}}). The explanation no longer matches the page — please report this.",
    "tutorial.laden": "Loading the demonstration …",
    "tutorial.laden.fehler": "The demonstration could not be loaded.",
    "tutorial.laden.nochmal": "Try again",

    "tutorial.fragen.titel": "Tutorial: Ask",
    "tutorial.fragen.lernziel":
      "You ask a question so that KLARWERK can answer it from your own knowledge, read the answer correctly and check every statement against its source. At the end you ask a question yourself.",

    "tutorial.fragen.verstehen.kurz": "Understand",
    "tutorial.fragen.verstehen.titel": "Understand: what is this page for?",
    "tutorial.fragen.verstehen.text":
      "On the Ask page you ask a question in your own words. KLARWERK looks for the answer only in your company's knowledge objects — not in the general knowledge of a language model — and shows which sources each answer relies on.\n\nQuestions about rules, procedures and responsibilities work well, for example: “How many home-office days are allowed?” This example and everything the tutorial shows about it is made up and marked as a demo.",
    "tutorial.fragen.verstehen.vertiefung":
      "If KLARWERK finds no reliable basis, it says so openly instead of guessing. The page is therefore not a general chat: a question about a topic that does not appear in your knowledge honestly ends as a knowledge gap. Step 6 shows what that looks like.\n\nThe demonstration is a scaled-down Ask page built from the same components as the real one — with sample data. You can use it; it sends nothing.",
    "tutorial.fragen.verstehen.teil.feld":
      "The input field: this is where you write your question. It sits at the bottom of the page.",
    "tutorial.fragen.verstehen.teil.beispiele":
      "“{{beispiele}}”: while the field is empty, the page suggests questions from your knowledge base. On the real page, clicking a suggestion sends the question immediately.",
    "tutorial.fragen.verstehen.teil.ergebnis":
      "After sending, the answer with its sources appears above the field. Before the first question this area is empty.",

    "tutorial.fragen.formulieren.kurz": "Phrase",
    "tutorial.fragen.formulieren.titel": "Phrase the question: specific and with context",
    "tutorial.fragen.formulieren.text":
      "The more precise the question, the more reliably KLARWERK finds the right place in your knowledge. Say what it is about and — if it matters — for whom or for what: site, department, equipment, period.\n\n“How many home-office days are allowed?” is a good question. “Home office?” leaves open what you want to know. In the demonstration the sample question is typed into the input field; “Pause” stops it, “Repeat step” starts it again.",
    "tutorial.fragen.formulieren.vertiefung":
      "Ask one question per entry: if you want to know two things, ask two questions. Use the words that are common in your company — knowledge objects are usually named that way too.\n\nIf your browser supports voice input, a microphone appears next to the field. What you say is appended to the question; nothing is sent until you send it yourself.",
    "tutorial.fragen.formulieren.teil.tippen":
      "The sample question is written into the input field.",
    "tutorial.fragen.formulieren.teil.kontext":
      "The question is in the field: specific, with a subject. Nothing has been sent yet.",

    "tutorial.fragen.absenden.kurz": "Send",
    "tutorial.fragen.absenden.titel": "Send the question: what happens after the click",
    "tutorial.fragen.absenden.text":
      "You send with the round arrow on the right of the field or with the Enter key. Then a loading symbol spins in the button and grey placeholder lines appear above the field: KLARWERK looks for matching knowledge objects and phrases the answer from them. This usually takes a few seconds; meanwhile the button is locked so the same question does not run twice.\n\nNothing is sent in this demonstration — the waiting state is only shown. You can also click the arrow in the demo yourself.",
    "tutorial.fragen.absenden.vertiefung":
      "If the arrow is greyed out, either the field has no question, or no AI model is currently active for answers. In the second case the reason is shown directly below the field (step 6).\n\nIf the connection fails, the page says so where the answer would otherwise appear and offers to try again. If you ask the same question again, the previous answer stays until the new one arrives.",
    "tutorial.fragen.absenden.teil.knopf":
      "The send button with the arrow. On the real page it sends the question.",
    "tutorial.fragen.absenden.teil.warten":
      "The waiting state: loading symbol in the button and placeholder lines above the field. Only demonstrated here.",

    "tutorial.fragen.antwort.kurz": "Answer",
    "tutorial.fragen.antwort.titel": "Understand the answer: statement, source, limitation",
    "tutorial.fragen.antwort.text":
      "The answer appears as a card above the input field. Read it in three steps:\n\n1. The statement itself.\n2. The small superscript numbers in the text: each number belongs to the source chip with the same number below the answer. The chip also says whether the source carried the answer (“{{verwendet}}”).\n3. The notice below the statement: the answer was phrased by an AI from your sources. It is only as reliable as those sources — check them before you rely on anything important.\n\nThe answer in the demonstration is a made-up example and not information from your company.",
    "tutorial.fragen.antwort.vertiefung":
      "A yellow dot on the chip means: this source has not been reviewed yet. A red dot means: there is an open conflict about it. “{{angesehen}}” means the source was consulted but not used for the answer.\n\nBelow the card you can take over the answer with “{{kopieren}}” and report with “{{geholfen}}” that it helped you. The “…” menu on the card lets you print it or save it as a file.",
    "tutorial.fragen.antwort.teil.aussage": "The statement of the answer — here a made-up example.",
    "tutorial.fragen.antwort.teil.ziffer":
      "The number in the text and the chip belong together: the statement relies on source 1.",
    "tutorial.fragen.antwort.teil.kennzeichnung":
      "The label: phrased by an AI from your sources — review it professionally.",

    "tutorial.fragen.quelle.kurz": "Source",
    "tutorial.fragen.quelle.titel": "Trace the source: check a statement",
    "tutorial.fragen.quelle.text":
      "To check a statement, go to its source — the page offers two ways:\n\n1. The source chip below the answer leads straight to the knowledge object on the real page.\n2. The “…” menu at the top right of the answer card, then “{{mehr}}”: it opens a sheet with the list of sources consulted — for each one whether it was used, its review status, its usability, a short preview, the excerpt in document format and, if stored, the original.\n\nBoth work in the demonstration: the chip says where it leads on the real page (the made-up demo source has no knowledge object), and “…” → “{{mehr}}” opens the same sheet with the same source list as on the real page. Compare the statement of the answer with the excerpt there: does it really say what the answer says?",
    "tutorial.fragen.quelle.vertiefung":
      "When checking, look at three things: is the source validated or still open? How current is it? Does the answer add something that is not in the excerpt?\n\nThe demo source has no stored original, and the demonstration says so exactly as the real page does for any source without a file or address — it does not suggest a door that does not exist.",
    "tutorial.fragen.quelle.teil.chip":
      "The source chip. On the real page it opens the knowledge object; in the demo it explains this, because the demo source has none.",
    "tutorial.fragen.quelle.teil.liste":
      "The “{{mehr}}” sheet with the list of sources consulted — the same as on the real page.",
    "tutorial.fragen.quelle.teil.stand":
      "Two facts per source: did it carry the answer (“{{verwendet}}”), and what is its review status?",
    "tutorial.fragen.quelle.teil.original":
      "Short preview, excerpt and original: this is where you check the statement yourself.",

    "tutorial.fragen.sonderfaelle.kurz": "Special cases",
    "tutorial.fragen.sonderfaelle.titel": "Special cases: when there is no reliable answer",
    "tutorial.fragen.sonderfaelle.text":
      "Not every question gets an answer — on purpose. You should know three cases:\n\n1. Knowledge gap: if KLARWERK finds nothing reliable, “{{luecke}}” appears instead of an invented answer. Rephrase the question with other technical terms or record the missing knowledge.\n2. Uncertain evidence: if a source has not been reviewed yet or it cannot be determined which source carries the answer, the page says so on the chip and in the source list. Then check especially carefully.\n3. Ask function unavailable: if no AI model is currently active for answers, the send button stays locked. Below the field are the ways that work without AI: “{{bibliothek}}” and “{{erfassen}}”.",
    "tutorial.fragen.sonderfaelle.vertiefung":
      "“{{bibliothek}}” leads to the library: there you search the knowledge base without AI and read the knowledge objects themselves. “{{erfassen}}” is the way to close a gap. Whether you may take it depends on your role — without permission the page shows it as a note without a link.\n\nWhat makes sense next for a knowledge gap is shown on the real page under “…” → “{{mehr}}”.",
    "tutorial.fragen.sonderfaelle.teil.luecke":
      "Knowledge gap: no reliable basis — no answer is invented.",
    "tutorial.fragen.sonderfaelle.teil.unsicher":
      "Uncertain evidence: yellow dot and “{{unbekannt}}” on the chip, the sentence about unknown attribution under “…” → “{{mehr}}” — check especially carefully.",
    "tutorial.fragen.sonderfaelle.teil.kiaus":
      "Ask function unavailable: send button locked, the ways without AI below it.",

    "tutorial.fragen.ueben.kurz": "Practice",
    "tutorial.fragen.ueben.titel": "Try it yourself",
    "tutorial.fragen.ueben.text":
      "Your turn. Type your own practice question into the demonstration and send it with the arrow or the Enter key. Then check the source: via “…” → “{{mehr}}” on the practice answer.\n\nThe exercise sends nothing: it answers every question with the same made-up sample answer so you can go through the flow calmly.\n\nWhen you are ready, “{{eigeneFrage}}” takes you to the real input field. A question already there is kept; nothing is sent until you send it yourself.",
    "tutorial.fragen.ueben.vertiefung":
      "The everyday flow: ask specifically → read the answer → connect number and chip → open the source → check the statement against the excerpt. Without a matching source there is no answer; then the library or recording the missing knowledge helps.",
    "tutorial.fragen.ueben.teil.eingeben":
      "Type your practice question into the demonstration field.",
    "tutorial.fragen.ueben.teil.senden": "Send it in the demonstration — nothing goes out.",
    "tutorial.fragen.ueben.teil.pruefen":
      "Read the practice answer and check the source: chip or “…” → “{{mehr}}”.",

    "tutorial.fragen.demo.frage": "How many home-office days are allowed?",
    "tutorial.fragen.demo.antwort":
      "According to the fictitious demo policy, up to **two home-office days per week** are possible, by agreement with your manager [1]. This is a made-up example and not a rule of your company.",
    "tutorial.fragen.demo.beispielantwort": "Demo · sample answer",
    "tutorial.fragen.demo.uebungsantwort": "Demo · practice answer",
    "tutorial.fragen.demo.uebungHinweis":
      "Exercise: the demonstration answers every question with this made-up example. Your question was not sent.",
    "tutorial.fragen.demo.uebungLeer":
      "After sending, the practice answer appears here. Type a question below.",
    "tutorial.fragen.demo.leer": "After sending, the answer with its sources appears here.",
    "tutorial.fragen.demo.beispiele":
      "On the real page, sample questions from your knowledge base appear here; a click sends them immediately.",
    "tutorial.fragen.quelle.teil.menue":
      "The “…” menu at the top right of the answer card. Open it and choose “{{mehr}}”.",
    "tutorial.fragen.demo.chip":
      "On the real page this chip opens the source's knowledge object. The demo source is made up and has none — its evidence is shown under “…” → “{{mehr}}” on this answer card.",
    "tutorial.fragen.demo.menueNichts":
      "Nothing is printed or saved in the demonstration. On the real page these entries print or save the answer with its sources.",
    "tutorial.fragen.demo.mehrHinweis": "Sample data — the same source list as on the real page.",
    "tutorial.fragen.demo.mehrOrt": "On the real page under “…” → “{{menue}}” on the answer:",
    "tutorial.fragen.demo.lueckenfrage": "How long does a sabbatical last?",
    "tutorial.fragen.demo.quelle.titel": "Demo home-office policy (fictitious)",
    "tutorial.fragen.demo.quelle.kernaussage":
      "Up to two home-office days per week by agreement with your manager (made-up example).",
    "tutorial.fragen.demo.quelle.abschnitt": "Section 2 · Mobile working (fictitious)",
    "tutorial.fragen.demo.quelle.auszug":
      "Employees may work from home up to two days per week. The days are agreed with the manager. — Made-up sample text for the tutorial.",
    "tutorial.fragen.demo.quelle.autor": "Demo editorial team (fictitious)",

    "tutorial.fragen.uebergang.text":
      "Ready for the real page? “Ask your own question” closes the tutorial and puts the cursor into the real input field. Whatever is already there stays, and nothing is sent automatically.",
    "tutorial.fragen.uebergang.knopf": "Ask your own question",
    "tutorial.fragen.uebergang.kiAus":
      "Note: on the real page the ask function is currently unavailable. This is what applies there right now:",
    "tutorial.fragen.uebergang.zielFehlt":
      "The real input field was not found on this page. Close the tutorial and reload the page.",
  },
  nl: {
    "tutorial.begleitung.label": "Tutorial: {{titel}}",
    "tutorial.begleitung.erklaerung": "Uitleg bij deze stap",
    "tutorial.begleitung.zurueck":
      "Met „Sluiten” bovenaan het blad of met Escape ga je terug naar de tutorial.",
    "tutorial.knopf": "Tutorial",
    "tutorial.knopf.oeffnen": "Interactieve tutorial voor deze pagina openen",
    "tutorial.knopf.schliessen": "Tutorial voor deze pagina sluiten",
    "tutorial.lernziel": "Leerdoel",
    "tutorial.schliessen": "Tutorial sluiten",
    "tutorial.vorlesen.start": "Voorlezen",
    "tutorial.vorlesen.stop": "Voorlezen stoppen",
    "tutorial.vorlesen.hinweis":
      "Voorlezen is vrijwillig: het gebruikt de spraakuitvoer van je browser en start alleen na een klik.",
    "tutorial.vorlesen.nichtMoeglich":
      "Deze browser kan niet voorlezen. Alle inhoud staat volledig als tekst beschikbaar.",
    "tutorial.fortschritt": "Stap {{nr}} van {{gesamt}}: {{titel}}",
    "tutorial.fortschritt.label": "Voortgang in de tutorial",
    "tutorial.kapitel": "Hoofdstukken",
    "tutorial.vertiefung": "Meer hierover",
    "tutorial.zurueck": "Terug",
    "tutorial.weiter": "Verder",
    "tutorial.beenden": "Tutorial beëindigen",
    "tutorial.abspielen": "Voordoen",
    "tutorial.pause": "Pauze",
    "tutorial.wiederholen": "Stap herhalen",
    "tutorial.vorfuehrung": "De demonstratie in deze stap",
    "tutorial.vorfuehrung.laeuft": "Nu getoond:",
    "tutorial.vorfuehrung.steht": "Gepauzeerd bij:",
    "tutorial.reduziert":
      "Verminderde beweging staat aan: de demonstratie toont invoer meteen volledig in plaats van letter voor letter en laat niets oplichten.",
    "tutorial.demo.kennzeichen": "Demo",
    "tutorial.demo.hinweis": "Voorbeeldgegevens · er wordt niets verzonden of opgeslagen",
    "tutorial.demo.label": "Demonstratie: verkleinde Vragen-pagina met voorbeeldgegevens",
    "tutorial.demo.verweis":
      "In de demonstratie opent deze verwijzing niets. Op de echte pagina leidt hij naar: {{ziel}}",
    "tutorial.ziel.fehlt":
      "Het uitgelegde bedieningselement ontbreekt in de demonstratie ({{ziel}}). De uitleg past niet meer bij de pagina — meld dit alsjeblieft.",
    "tutorial.laden": "Demonstratie wordt geladen …",
    "tutorial.laden.fehler": "De demonstratie kon niet worden geladen.",
    "tutorial.laden.nochmal": "Opnieuw proberen",

    "tutorial.fragen.titel": "Tutorial: Vragen",
    "tutorial.fragen.lernziel":
      "Je stelt een vraag zo dat KLARWERK die uit jullie eigen kennis kan beantwoorden, leest het antwoord goed en controleert elke uitspraak aan de bron. Aan het eind stel je zelf een vraag.",

    "tutorial.fragen.verstehen.kurz": "Begrijpen",
    "tutorial.fragen.verstehen.titel": "Begrijpen: waarvoor is deze pagina?",
    "tutorial.fragen.verstehen.text":
      "Op de pagina „Vragen” stel je een vraag in je eigen woorden. KLARWERK zoekt het antwoord uitsluitend in de kennisobjecten van jullie bedrijf — niet in de algemene kennis van een taalmodel — en laat bij elk antwoord zien op welke bronnen het steunt.\n\nGoed geschikt zijn vragen over regels, werkwijzen en verantwoordelijkheden, bijvoorbeeld: „Hoeveel thuiswerkdagen zijn toegestaan?” Dit voorbeeld en alles wat de tutorial erover laat zien is verzonnen en als demo gemarkeerd.",
    "tutorial.fragen.verstehen.vertiefung":
      "Vindt KLARWERK geen betrouwbare basis, dan zegt het dat eerlijk in plaats van te gokken. De pagina is dus geen algemene chat: een vraag over een onderwerp dat niet in jullie kennis voorkomt, eindigt eerlijk als kennishiaat. Stap 6 laat zien hoe dat eruitziet.\n\nDe demonstratie is een verkleinde Vragen-pagina uit dezelfde bouwstenen als de echte — met voorbeeldgegevens. Je kunt hem bedienen; hij verzendt niets.",
    "tutorial.fragen.verstehen.teil.feld":
      "Het invoerveld: hier schrijf je je vraag. Het staat onderaan de pagina.",
    "tutorial.fragen.verstehen.teil.beispiele":
      "„{{beispiele}}”: zolang het veld leeg is, stelt de pagina vragen uit jullie kennisbank voor. Op de echte pagina verzendt een klik op een voorstel de vraag meteen.",
    "tutorial.fragen.verstehen.teil.ergebnis":
      "Na het verzenden verschijnt boven het veld het antwoord met zijn bronnen. Vóór de eerste vraag is dit gebied leeg.",

    "tutorial.fragen.formulieren.kurz": "Formuleren",
    "tutorial.fragen.formulieren.titel": "Vraag formuleren: concreet en met context",
    "tutorial.fragen.formulieren.text":
      "Hoe preciezer de vraag, hoe zekerder KLARWERK de juiste plek in jullie kennis vindt. Noem waar het om gaat en — als het ertoe doet — voor wie of waarvoor: locatie, afdeling, installatie, periode.\n\n„Hoeveel thuiswerkdagen zijn toegestaan?” is een goede vraag. „Thuiswerken?” laat open wat je wilt weten. In de demonstratie wordt de voorbeeldvraag in het invoerveld getypt; met „Pauze” zet je hem stil, met „Stap herhalen” begint hij opnieuw.",
    "tutorial.fragen.formulieren.vertiefung":
      "Stel één vraag per invoer: wie twee dingen wil weten, stelt beter twee vragen. Gebruik de woorden die in jullie bedrijf gebruikelijk zijn — zo heten de kennisobjecten meestal ook.\n\nOndersteunt je browser spraakinvoer, dan staat naast het veld een microfoon. Wat je zegt wordt aan de vraag toegevoegd; er wordt pas verzonden als je zelf verzendt.",
    "tutorial.fragen.formulieren.teil.tippen":
      "De voorbeeldvraag wordt in het invoerveld geschreven.",
    "tutorial.fragen.formulieren.teil.kontext":
      "De vraag staat in het veld: concreet, met onderwerp. Er is nog niets verzonden.",

    "tutorial.fragen.absenden.kurz": "Verzenden",
    "tutorial.fragen.absenden.titel": "Vraag verzenden: wat er na de klik gebeurt",
    "tutorial.fragen.absenden.text":
      "Je verzendt met de ronde pijl rechts in het veld of met de Enter-toets. Daarna draait er een laadsymbool in de knop en verschijnen boven het veld grijze plaatshouderregels: KLARWERK zoekt passende kennisobjecten en formuleert daaruit het antwoord. Dat duurt meestal enkele seconden; zolang is de knop geblokkeerd, zodat dezelfde vraag niet dubbel loopt.\n\nIn deze demonstratie wordt niets verzonden — de wachttoestand wordt alleen getoond. Je kunt de pijl in de demo ook zelf aanklikken.",
    "tutorial.fragen.absenden.vertiefung":
      "Is de pijl grijs, dan ontbreekt de vraag in het veld, of er is op dit moment geen AI-model actief voor antwoorden. In het tweede geval staat de reden direct onder het veld (stap 6).\n\nValt de verbinding weg, dan meldt de pagina dat op de plek waar anders het antwoord verschijnt en biedt aan het opnieuw te proberen. Stel je dezelfde vraag nog eens, dan blijft het vorige antwoord staan tot het nieuwe er is.",
    "tutorial.fragen.absenden.teil.knopf":
      "De verzendknop met de pijl. Op de echte pagina verzendt hij de vraag.",
    "tutorial.fragen.absenden.teil.warten":
      "De wachttoestand: laadsymbool in de knop en plaatshouderregels boven het veld. Hier alleen voorgedaan.",

    "tutorial.fragen.antwort.kurz": "Antwoord",
    "tutorial.fragen.antwort.titel": "Antwoord begrijpen: uitspraak, bron, beperking",
    "tutorial.fragen.antwort.text":
      "Het antwoord verschijnt als kaart boven het invoerveld. Lees het in drie stappen:\n\n1. De uitspraak zelf.\n2. De kleine superscriptcijfers in de tekst: elk cijfer hoort bij de bronchip met hetzelfde nummer onder het antwoord. Op de chip staat ook of de bron het antwoord heeft gedragen („{{verwendet}}”).\n3. De melding onder de uitspraak: het antwoord is door een AI uit jullie bronnen geformuleerd. Het is maar zo betrouwbaar als die bronnen — controleer ze voordat je op iets belangrijks vertrouwt.\n\nHet antwoord in de demonstratie is een verzonnen voorbeeld en geen informatie van jouw bedrijf.",
    "tutorial.fragen.antwort.vertiefung":
      "Een gele stip op de chip betekent: deze bron is nog niet gecontroleerd. Een rode stip betekent: er is een open conflict over. „{{angesehen}}” betekent dat de bron is geraadpleegd maar niet voor het antwoord is gebruikt.\n\nOnder de kaart kun je het antwoord met „{{kopieren}}” overnemen en met „{{geholfen}}” laten weten dat het je geholpen heeft. Via het menu „…” op de kaart kun je het afdrukken of als bestand opslaan.",
    "tutorial.fragen.antwort.teil.aussage":
      "De uitspraak van het antwoord — hier een verzonnen voorbeeld.",
    "tutorial.fragen.antwort.teil.ziffer":
      "Cijfer in de tekst en chip horen bij elkaar: de uitspraak steunt op bron 1.",
    "tutorial.fragen.antwort.teil.kennzeichnung":
      "De markering: door een AI uit jullie bronnen geformuleerd — inhoudelijk controleren.",

    "tutorial.fragen.quelle.kurz": "Bron",
    "tutorial.fragen.quelle.titel": "Bron nagaan: een uitspraak controleren",
    "tutorial.fragen.quelle.text":
      "Om een uitspraak te controleren, ga je naar de bron — de pagina biedt twee wegen:\n\n1. De bronchip onder het antwoord brengt je op de echte pagina direct naar het kennisobject.\n2. Het menu „…” rechtsboven op de antwoordkaart, dan „{{mehr}}”: het opent een blad met de lijst van geraadpleegde bronnen — per bron of ze gebruikt is, de controlestatus, de bruikbaarheid, een korte preview, het fragment in documentopmaak en, indien vastgelegd, het origineel.\n\nIn de demonstratie werkt beide: de chip zegt waar hij op de echte pagina naartoe leidt (de verzonnen demobron heeft geen kennisobject), en „…” → „{{mehr}}” opent hetzelfde blad met dezelfde bronnenlijst als op de echte pagina. Vergelijk daar de uitspraak van het antwoord met het fragment: staat daar echt wat het antwoord zegt?",
    "tutorial.fragen.quelle.vertiefung":
      "Let bij het controleren op drie dingen: is de bron gevalideerd of nog open? Hoe actueel is ze? Voegt het antwoord iets toe dat niet in het fragment staat?\n\nDe demobron heeft geen vastgelegd origineel, en de demonstratie zegt dat precies zoals de echte pagina het bij elke bron zonder bestand of adres zegt — ze suggereert geen deur die er niet is.",
    "tutorial.fragen.quelle.teil.chip":
      "De bronchip. Op de echte pagina opent hij het kennisobject; in de demo legt hij dat uit, omdat de demobron er geen heeft.",
    "tutorial.fragen.quelle.teil.liste":
      "Het blad „{{mehr}}” met de lijst van geraadpleegde bronnen — hetzelfde als op de echte pagina.",
    "tutorial.fragen.quelle.teil.stand":
      "Twee gegevens per bron: heeft ze het antwoord gedragen („{{verwendet}}”), en wat is haar controlestatus?",
    "tutorial.fragen.quelle.teil.original":
      "Korte preview, fragment en origineel: hier controleer je de uitspraak zelf.",

    "tutorial.fragen.sonderfaelle.kurz": "Bijzondere gevallen",
    "tutorial.fragen.sonderfaelle.titel": "Bijzondere gevallen: als er geen zeker antwoord is",
    "tutorial.fragen.sonderfaelle.text":
      "Niet elke vraag krijgt een antwoord — met opzet. Drie gevallen moet je kennen:\n\n1. Kennishiaat: vindt KLARWERK niets betrouwbaars, dan verschijnt „{{luecke}}” in plaats van een verzonnen antwoord. Formuleer de vraag opnieuw met andere vakwoorden of leg de ontbrekende kennis vast.\n2. Onzeker bewijs: is een bron nog niet gecontroleerd of is niet vast te stellen welke bron het antwoord draagt, dan zegt de pagina dat op de chip en in de bronnenlijst. Controleer dan extra zorgvuldig.\n3. Vraagfunctie niet beschikbaar: is er op dit moment geen AI-model actief voor antwoorden, dan blijft de verzendknop geblokkeerd. Onder het veld staan de wegen die ook zonder AI werken: „{{bibliothek}}” en „{{erfassen}}”.",
    "tutorial.fragen.sonderfaelle.vertiefung":
      "„{{bibliothek}}” leidt naar de bibliotheek: daar zoek je zonder AI in de kennisbank en lees je de kennisobjecten zelf. „{{erfassen}}” is de weg om een hiaat te dichten. Of je die mag gaan, hangt af van je rol — zonder bevoegdheid toont de pagina hem als melding zonder link.\n\nWat bij een kennishiaat als volgende stap zinvol is, staat op de echte pagina onder „…” → „{{mehr}}”.",
    "tutorial.fragen.sonderfaelle.teil.luecke":
      "Kennishiaat: geen betrouwbare basis — er wordt geen antwoord verzonnen.",
    "tutorial.fragen.sonderfaelle.teil.unsicher":
      "Onzeker bewijs: gele stip en „{{unbekannt}}” op de chip, onder „…” → „{{mehr}}” de zin over de onbekende toewijzing — extra zorgvuldig controleren.",
    "tutorial.fragen.sonderfaelle.teil.kiaus":
      "Vraagfunctie niet beschikbaar: verzendknop geblokkeerd, daaronder de wegen zonder AI.",

    "tutorial.fragen.ueben.kurz": "Oefenen",
    "tutorial.fragen.ueben.titel": "Zelf uitproberen",
    "tutorial.fragen.ueben.text":
      "Nu jij. Typ in de demonstratie een eigen oefenvraag en verzend die met de pijl of de Enter-toets. Controleer daarna de bron: via „…” → „{{mehr}}” bij het oefenantwoord.\n\nDe oefening verzendt niets: ze beantwoordt elke vraag met hetzelfde verzonnen voorbeeldantwoord, zodat je het verloop rustig kunt doorlopen.\n\nAls je zover bent, brengt „{{eigeneFrage}}” je naar het echte invoerveld. Een vraag die daar al staat, blijft behouden; er wordt pas verzonden als je zelf verzendt.",
    "tutorial.fragen.ueben.vertiefung":
      "Het verloop voor elke dag: concreet vragen → antwoord lezen → cijfer en chip verbinden → bron openen → uitspraak aan het fragment controleren. Zonder passende bron is er geen antwoord; dan helpen de bibliotheek of het vastleggen van de ontbrekende kennis.",
    "tutorial.fragen.ueben.teil.eingeben": "Typ je oefenvraag in het veld van de demonstratie.",
    "tutorial.fragen.ueben.teil.senden":
      "Verzend hem in de demonstratie — er gaat niets naar buiten.",
    "tutorial.fragen.ueben.teil.pruefen":
      "Lees het oefenantwoord en controleer de bron: chip of „…” → „{{mehr}}”.",

    "tutorial.fragen.demo.frage": "Hoeveel thuiswerkdagen zijn toegestaan?",
    "tutorial.fragen.demo.antwort":
      "Volgens de fictieve demorichtlijn zijn tot **twee thuiswerkdagen per week** mogelijk, in overleg met je leidinggevende [1]. Dit is een verzonnen voorbeeld en geen regel van jouw bedrijf.",
    "tutorial.fragen.demo.beispielantwort": "Demo · voorbeeldantwoord",
    "tutorial.fragen.demo.uebungsantwort": "Demo · oefenantwoord",
    "tutorial.fragen.demo.uebungHinweis":
      "Oefening: de demonstratie beantwoordt elke vraag met dit verzonnen voorbeeld. Je vraag is niet verzonden.",
    "tutorial.fragen.demo.uebungLeer":
      "Na het verzenden verschijnt hier het oefenantwoord. Typ hieronder een vraag.",
    "tutorial.fragen.demo.leer": "Na het verzenden verschijnt hier het antwoord met zijn bronnen.",
    "tutorial.fragen.demo.beispiele":
      "Op de echte pagina staan hier voorbeeldvragen uit jullie kennisbank; een klik verzendt ze meteen.",
    "tutorial.fragen.quelle.teil.menue":
      "Het menu „…” rechtsboven op de antwoordkaart. Open het en kies „{{mehr}}”.",
    "tutorial.fragen.demo.chip":
      "Op de echte pagina opent deze chip het kennisobject van de bron. De demobron is verzonnen en heeft er geen — het bewijs staat onder „…” → „{{mehr}}” op deze antwoordkaart.",
    "tutorial.fragen.demo.menueNichts":
      "In de demonstratie wordt niets afgedrukt en niets opgeslagen. Op de echte pagina drukken of bewaren deze punten het antwoord met de bronnen.",
    "tutorial.fragen.demo.mehrHinweis":
      "Voorbeeldgegevens — dezelfde bronnenlijst als op de echte pagina.",
    "tutorial.fragen.demo.mehrOrt": "Op de echte pagina onder „…” → „{{menue}}” bij het antwoord:",
    "tutorial.fragen.demo.lueckenfrage": "Hoe lang duurt een sabbatical?",
    "tutorial.fragen.demo.quelle.titel": "Demorichtlijn thuiswerken (fictief)",
    "tutorial.fragen.demo.quelle.kernaussage":
      "Tot twee thuiswerkdagen per week in overleg met de leidinggevende (verzonnen voorbeeld).",
    "tutorial.fragen.demo.quelle.abschnitt": "Paragraaf 2 · Mobiel werken (fictief)",
    "tutorial.fragen.demo.quelle.auszug":
      "Medewerkers kunnen tot twee dagen per week thuiswerken. De dagen worden met de leidinggevende afgestemd. — Verzonnen voorbeeldtekst voor de tutorial.",
    "tutorial.fragen.demo.quelle.autor": "Demoredactie (fictief)",

    "tutorial.fragen.uebergang.text":
      "Klaar voor de echte pagina? „Eigen vraag stellen” sluit de tutorial en zet de cursor in het echte invoerveld. Wat daar al staat, blijft staan, en er wordt niets automatisch verzonden.",
    "tutorial.fragen.uebergang.knopf": "Eigen vraag stellen",
    "tutorial.fragen.uebergang.kiAus":
      "Let op: op de echte pagina is de vraagfunctie op dit moment niet beschikbaar. Daar geldt nu:",
    "tutorial.fragen.uebergang.zielFehlt":
      "Het echte invoerveld is op deze pagina niet gevonden. Sluit de tutorial en laad de pagina opnieuw.",
  },
} satisfies Textmodul;

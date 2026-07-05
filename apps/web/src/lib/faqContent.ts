// FAQ-Inhalte (Berater-Lieferung 3a, 05.07.2026): 77 Antworten in 12 Bereichen, wortgetreu.
// Bewusst NICHT in i18n: Die EN-Fassung folgt mit Lieferung 3b — bis dahin ist die FAQ nur im
// deutschen UI aktiv (allFaqEntries gate), statt halbe Parität vorzutäuschen. Jede Antwort ist
// Teil der Klara-Wissensdatenbank: durchsuchbar UND Grundlage der KI-Suche. route = Absprungziel.

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  route: string;
}

const H = "/hilfe";

export const FAQ_CONTENT: readonly FaqItem[] = [
  // ---- Grundverständnis ----
  {
    id: "faq.grund.1",
    route: H,
    question: "Ist KLARWERK ein Chatbot wie ChatGPT? Was ist der Unterschied?",
    answer:
      "Nein. Ein Chatbot beantwortet alles — auch dann, wenn er die Antwort in Wirklichkeit nicht weiß. KLARWERK ist ein Wissenssystem: Es antwortet nur aus dem geprüften Wissen eurer eigenen Organisation und nennt zu jeder Antwort die Quelle. Gibt es kein gesichertes Wissen zu deiner Frage, sagt KLARWERK das ehrlich, statt etwas zu erfinden.",
  },
  {
    id: "faq.grund.2",
    route: H,
    question: "Warum antwortet die KI nicht einfach auf alles?",
    answer:
      "Weil eine falsche Antwort im Arbeitsalltag teurer ist als gar keine. In eurer Organisation hängen an Antworten echte Entscheidungen — an einer Maschine, am Pflegebett, in einer Akte. Darum darf die KI in KLARWERK nur aussprechen, was Kolleginnen und Kollegen vorher geprüft haben. Alles andere wird als Wissenslücke gezeigt, und eine Lücke kann man füllen — eine unbemerkte Falschantwort nicht.",
  },
  {
    id: "faq.grund.3",
    route: H,
    question: "Was heißt „validiert“ überhaupt?",
    answer:
      "Validiert heißt: Fachlich geeignete Kolleginnen und Kollegen haben diese Aussage geprüft und freigegeben — nach dem Mehr-Augen-Prinzip, mit einer festgelegten Anzahl an Freigaben. Es heißt nicht, dass eine KI zugestimmt hat, und auch nicht, dass etwas für immer wahr ist. Validiertes Wissen ist das einzige Wissen, aus dem KLARWERK Fragen beantwortet.",
  },
  {
    id: "faq.grund.4",
    route: H,
    question: "Wem gehört das Wissen, das ich eingebe?",
    answer:
      "Eurer Organisation — es liegt in eurer KLARWERK-Instanz und wird nicht zum Training fremder KI-Modelle verwendet. Jeder Eintrag behält sichtbar seine Herkunft: Wer ihn erfasst hat, bleibt dauerhaft nachvollziehbar, auch wenn andere ihn später weiterpflegen.",
  },
  {
    id: "faq.grund.5",
    route: H,
    question: "Muss ich Technik verstehen, um KLARWERK zu benutzen?",
    answer:
      "Nein. Du erzählst, was du weißt — tippen oder diktieren reicht. Die KI schlägt eine Struktur vor, und du bestätigst oder korrigierst sie. Alles Weitere, etwa Prüfung und Einordnung, führt dich die App Schritt für Schritt; an fast jeder Stelle gibt es ein Fragezeichen mit Erklärung und die Hilfe-Assistentin Klara.",
  },
  {
    id: "faq.grund.6",
    route: H,
    question: "Was ist ein „Wissensobjekt“?",
    answer:
      "Das Wissensobjekt ist die kleinste Einheit in KLARWERK: eine einzelne, klare Aussage plus alles, was sie tragfähig macht — unter welchen Bedingungen sie gilt, was zu tun ist, welche Belege es gibt, wer sie erfasst und geprüft hat. Ein gutes Wissensobjekt beantwortet eine Frage aus der Praxis, zum Beispiel: Was tue ich, wenn der Kessel Überdruck hat? Oder: Welche Frist gilt bei der Schankgenehmigung?",
  },
  {
    id: "faq.grund.7",
    route: H,
    question: "Kann die KI sich irren oder etwas erfinden?",
    answer:
      "Ja — genau deshalb ist KLARWERK so gebaut, wie es ist. Jeder KI-Vorschlag ist nur ein Vorschlag: Nichts wird automatisch gespeichert, bei Auszügen aus Dokumenten muss die KI die Fundstelle wörtlich belegen, und gesichert wird Wissen erst durch menschliche Prüfung. Wo die KI frei formuliert, etwa in Klaras KI-Suche, ist das sichtbar als KI-generiert gekennzeichnet.",
  },
  // ---- Erfassen ----
  {
    id: "faq.erfassen.1",
    route: "/erfassen",
    question: "Wie fange ich an — muss ich etwas Bestimmtes ausfüllen?",
    answer:
      "Nein. Öffne „Erfassen“ und erzähle einfach, was du weißt — als Freitext, so wie du es einem neuen Kollegen erklären würdest. Alles Weitere ist optional: Kategorie, Schlagwörter und Anhänge machen dein Wissen besser auffindbar, sind aber keine Pflicht. Die KI hilft dir anschließend beim Strukturieren.",
  },
  {
    id: "faq.erfassen.2",
    route: "/erfassen",
    question: "Muss ich schön formulieren, oder darf ich einfach drauflos erzählen?",
    answer:
      "Erzähl einfach drauflos — genau dafür ist der Weg gebaut. Aus deinem Rohtext macht die KI einen Strukturvorschlag mit Kernaussage, Bedingungen und Maßnahmen. Du siehst den Vorschlag in der Vorschau und übernimmst nur, was stimmt. Deine Fachbegriffe und Zahlen bleiben dabei erhalten; verschönert wird nichts auf Kosten der Fakten.",
  },
  {
    id: "faq.erfassen.3",
    route: "/erfassen",
    question: "Kann ich ein Dokument hochladen und Wissen daraus ziehen?",
    answer:
      "Ja. Lade zum Beispiel ein Textdokument, eine Word-Datei oder ein PDF hoch — die KI schlägt daraus eine Liste möglicher Wissenspunkte vor, jeder mit einem wörtlichen Zitat als Fundstelle aus deinem Dokument. Du wählst aus, was übernommen werden soll; bei Bildern oder Scans bietet die App eine Texterkennung an. Nichts davon wird automatisch zu Wissen — du entscheidest je Punkt.",
  },
  {
    id: "faq.erfassen.4",
    route: "/erfassen",
    question: "Die KI hat meinen Text umgeschrieben — sind meine Fakten noch korrekt?",
    answer:
      "Das prüfst du in der Vorschau, bevor irgendetwas übernommen wird — und genau dafür ist sie da. Die KI-Hilfe soll klarer formulieren, ohne Fakten zu verändern oder zu ergänzen. Vergleiche besonders Zahlen, Grenzwerte und Namen; wenn etwas nicht stimmt, verwirf den Vorschlag oder korrigiere ihn. Übernommen wird nur, was du bestätigst.",
  },
  {
    id: "faq.erfassen.5",
    route: "/erfassen",
    question: "Speichert KLARWERK automatisch, oder muss ich etwas bestätigen?",
    answer:
      "KLARWERK speichert Wissen nie automatisch. Die KI macht Vorschläge, und erst dein Klick übernimmt sie — als Entwurf oder als Einreichung. Das ist ein Grundprinzip der App: Der Mensch übernimmt bewusst.",
  },
  {
    id: "faq.erfassen.6",
    route: "/erfassen",
    question: "Was ist der Unterschied zwischen „Entwurf“ und „Einreichen“?",
    answer:
      "Ein Entwurf gehört noch dir allein: Du kannst ihn liegen lassen, weiterbearbeiten oder verwerfen, und kein Prüfer sieht ihn. Mit dem Einreichen wird daraus ein Wissensobjekt in der Prüfung: Es ist jetzt für andere sichtbar, ehrlich als „in Prüfung“ markiert, und wartet auf die Freigaben der Prüfer.",
  },
  {
    id: "faq.erfassen.7",
    route: "/erfassen",
    question: "Was passiert, nachdem ich „Einreichen“ geklickt habe — wer sieht es jetzt?",
    answer:
      "Dein Beitrag wird als Wissensobjekt angelegt und erscheint auf dem Prüf-Board, wo Prüfer ihn bewerten. Sichtbar ist er ab jetzt für andere, aber deutlich als „in Prüfung“ gekennzeichnet — nicht als gesichert. Du musst nichts weiter tun: Entweder hast du beim Einreichen Prüfer vorgeschlagen, die eine Benachrichtigung bekommen, oder der Beitrag liegt offen für alle Prüfer. Für Antworten auf Fragen zählt dein Wissen erst nach der Validierung.",
  },
  {
    id: "faq.erfassen.8",
    route: "/erfassen",
    question: "Warum stellt mir die KI beim Interview Rückfragen — kann ich die überspringen?",
    answer:
      "Die Rückfragen holen genau das heraus, was Erfahrungswissen wertvoll macht: Grenzwerte, Ausnahmen, das Warum dahinter. Ein „man muss das Ventil rechtzeitig schließen“ wird erst durch die Nachfrage „ab welchem Druck?“ wirklich brauchbar. Du kannst das Interview jederzeit beenden und mit dem bisher Erzählten weiterarbeiten. Ehrlicher Hinweis: Richtig gute, themenbezogene Fragen stellt das Interview nur mit verbundener KI — ohne sie kommen bewusst einfache Standardfragen.",
  },
  {
    id: "faq.erfassen.9",
    route: "/erfassen",
    question: "Welche Wissensart soll ich wählen, wenn ich unsicher bin?",
    answer:
      "Wähle die, die am ehesten passt — die Wissensart hilft beim Einordnen und Suchen, sie verändert den Prüfweg nicht. Besonders wertvoll und oft vergessen ist das Negativwissen: „Das haben wir probiert, es funktioniert nicht, und zwar deshalb.“ Wenn du schwankst, nimm die naheliegendste Art; Prüfer können bei der Prüfung darauf schauen.",
  },
  {
    id: "faq.erfassen.10",
    route: "/erfassen",
    question: "Kann ich einen Entwurf später weiterbearbeiten oder löschen?",
    answer:
      "Ja. Unter „Entwürfe fortsetzen“ findest du alles, was du angefangen und noch nicht eingereicht hast. Du kannst dort weiterarbeiten oder einen Entwurf verwerfen. Solange du nicht einreichst, bleibt ein Entwurf deine Privatsache.",
  },
  // ---- Prüfen und Validierung ----
  {
    id: "faq.pruefen.1",
    route: "/validierung",
    question: "Wie viele Freigaben braucht mein Beitrag, und wo sehe ich den Stand?",
    answer:
      "Die benötigte Anzahl legt eure Verwaltung fest — erlaubt sind eins bis fünf, üblich sind zwei oder drei. Den Stand siehst du direkt am Wissensobjekt in der Signale-Zeile: Dort steht das Ziel, also wie viele Freigaben es braucht, zusammen mit dem Vertrauensbalken. Sobald genug grüne Freigaben da sind und keine rote Bewertung offen ist, gilt der Beitrag als validiert.",
  },
  {
    id: "faq.pruefen.2",
    route: "/validierung",
    question: "Wer entscheidet, wer meinen Beitrag prüft?",
    answer:
      "Beim Einreichen kannst du selbst Kolleginnen und Kollegen als Prüfer vorschlagen — sie bekommen dann eine Benachrichtigung und eine offene Zuweisung. Wählst du niemanden, liegt dein Beitrag offen auf dem Prüf-Board, und jeder mit Prüfrecht kann ihn übernehmen. Prüfen dürfen Controller und Admins.",
  },
  {
    id: "faq.pruefen.3",
    route: "/validierung",
    question: "Kann ich meinen eigenen Beitrag freigeben?",
    answer:
      "Nein, und das ist Absicht: In KLARWERK gilt das Mehr-Augen-Prinzip. Wissen wird erst dadurch belastbar, dass jemand anderes es unabhängig beurteilt. Auch ein Admin gibt die eigenen Beiträge nicht selbst frei.",
  },
  {
    id: "faq.pruefen.4",
    route: "/validierung",
    question: "Was bedeutet Gelb — ist das schon abgelehnt?",
    answer:
      "Nein. Gelb heißt: richtig mit Vorbehalt — der Prüfer sieht die Aussage grundsätzlich als brauchbar, hat aber Einwände oder Ergänzungswünsche. Ein Gelb senkt das Vertrauen des Objekts und schickt es mit der Begründung zur Nacharbeit an dich zurück. Einen Status „abgelehnt“ gibt es in KLARWERK übrigens gar nicht: Ein Beitrag bleibt offen, bis er verbessert und freigegeben wird — oder ihr ihn bewusst verwerft.",
  },
  {
    id: "faq.pruefen.5",
    route: "/validierung",
    question: "Warum blockiert ein einziges Rot, obwohl zwei andere Grün gesagt haben?",
    answer:
      "Weil ein begründeter fachlicher Einwand nicht per Mehrheit überstimmt werden soll. Rot bedeutet: Aus Sicht dieses Prüfers wäre es falsch oder riskant, danach zu handeln — und so ein Einwand muss ausgeräumt werden, nicht übertönt. Der Beitrag geht mit der Begründung zur Nacharbeit an den Autor; danach kann neu bewertet werden. Das ist unbequemer als Abstimmen, aber es ist der Grund, warum man validiertem Wissen trauen kann.",
  },
  {
    id: "faq.pruefen.6",
    route: "/validierung",
    question: "Mein Beitrag kam „zur Nacharbeit zurück“ — was soll ich jetzt tun?",
    answer:
      "Lies zuerst die Begründung des Prüfers — sie sagt dir, woran es hakt: eine unklare Bedingung, ein fehlender Beleg, ein strittiger Wert. Überarbeite den Beitrag entsprechend; jede inhaltliche Änderung wird als neue Version festgehalten. Danach geht er wieder in die Prüfung. Nacharbeit ist kein Makel, sondern der normale Weg, auf dem aus einem guten Anfang gesichertes Wissen wird.",
  },
  {
    id: "faq.pruefen.7",
    route: "/validierung",
    question: "Wie lange dauert es, bis etwas geprüft ist?",
    answer:
      "So lange, wie eure Prüfer brauchen — KLARWERK setzt bewusst keine Automatik ein, die nach Zeitablauf freigibt. Offene Prüfungen sind für Prüfer sichtbar auf dem Prüf-Board und in ihren Aufgaben. Wenn etwas liegen bleibt, sprich die vorgeschlagenen Prüfer an oder bitte die Verwaltung, eine Zuweisung zu setzen.",
  },
  {
    id: "faq.pruefen.8",
    route: "/validierung",
    question: "Darf ein Controller den Beitrag eines Admins prüfen?",
    answer:
      "Ja. Geprüft wird nach Rolle und Mehr-Augen-Prinzip, nicht nach Rang: Controller und Admins prüfen alle fremden Beiträge — auch die von Admins. Nur den eigenen Beitrag prüft niemand selbst.",
  },
  {
    id: "faq.pruefen.9",
    route: "/validierung",
    question: "Was, wenn niemand außer mir das Thema beurteilen kann?",
    answer:
      "Dann sagt KLARWERK das ehrlich, statt die Regel aufzuweichen: Ohne unabhängige Prüfung bleibt der Beitrag als „in Prüfung“ sichtbar und wird nicht für Antworten verwendet. Sinnvolle Wege: eine zweite Person ins Thema holen, externe Quellen als zusätzliche Belege anhängen, oder — als dokumentierter Sonderweg — die Verwaltung nutzt die Admin-Kennzeichnung, die im Protokoll sichtbar bleibt. Der Engpass selbst ist übrigens genau das Risiko, das die App im Bereich Risiko als Einzelquellen-Problem anzeigt.",
  },
  {
    id: "faq.pruefen.10",
    route: "/validierung",
    question: "Kann eine Freigabe später zurückgenommen werden?",
    answer:
      "Ja, auf zwei Wegen. Prüfer können ihre Bewertung ändern — Vertrauen und Status werden dann neu berechnet. Und unabhängig davon altert Wissen: Über den Lebenszyklus kommen Objekte zur erneuten Prüfung, etwa nach einer gemeldeten Anlagenänderung. Validierung ist ein Stand, kein Ewigkeitsurteil.",
  },
  // ---- Vertrauen, Status und Sichtbarkeit ----
  {
    id: "faq.vertrauen.1",
    route: "/bibliothek",
    question: "Was bedeutet die Vertrauens-Zahl genau?",
    answer:
      "Der Vertrauenswert entsteht aus den Prüfstimmen und der Bewährung im Einsatz: Grüne Freigaben heben ihn, Vorbehalte senken ihn, und wenn Wissen nachweislich geholfen hat, steigt er leicht. Er ist eine ehrliche Einordnung, wie belastbar eine Aussage gerade ist — keine Wahrheitsgarantie. Lies ihn zusammen mit dem Status und der Beleglage, nicht allein.",
  },
  {
    id: "faq.vertrauen.2",
    route: "/bibliothek",
    question: "Warum steht da nie hundert Prozent?",
    answer:
      "Absichtlich: Der Vertrauenswert ist bei neunundneunzig gedeckelt, weil in KLARWERK nichts jemals als hundertprozentig wahr gilt. Erfahrungswissen kann sich ändern — eine neue Anlage, eine neue Vorschrift, eine bessere Methode. Die fehlende Eins ist die eingebaute Erinnerung daran, wachsam zu bleiben.",
  },
  {
    id: "faq.vertrauen.3",
    route: "/bibliothek",
    question: "Was ist der Unterschied zwischen „offen“ und „validiert“?",
    answer:
      "Offen heißt: erfasst, sichtbar, aber noch nicht ausreichend geprüft — daraus beantwortet KLARWERK keine Fragen. Validiert heißt: von genug Prüfern freigegeben, ohne offene rote Bewertung — erst dieses Wissen trägt Antworten. Mehr Status gibt es bewusst nicht; alles Weitere sagen dir Vertrauenswert, Beleglage und Hinweise am Objekt.",
  },
  {
    id: "faq.vertrauen.4",
    route: "/bibliothek",
    question: "Wer kann mein Wissen sehen — kann ich das einschränken?",
    answer:
      "Innerhalb eurer Organisation sehen alle angemeldeten Rollen die Wissensobjekte — die App versteckt Wissen bewusst nicht vor Kollegen, denn Teilen ist ihr Zweck. Was du steuern kannst, ist der Schutz nach außen: Mit den Vertraulichkeitsstufen verhinderst du, dass sensibles Wissen jemals in Exporte oder erzeugte Dokumente gelangt. Eine persönliche Sichtbarkeits-Einschränkung je Nutzer gibt es derzeit nicht — das sagt dir die App auch so ehrlich.",
  },
  {
    id: "faq.vertrauen.5",
    route: "/bibliothek",
    question: "Was heißt „intern“ oder „vertraulich“ bei einem Objekt?",
    answer:
      "Es gibt drei Stufen. Öffentlich-intern ist der Standard und bedeutet keine Einschränkung. Vertraulich und streng vertraulich markieren sensibles Wissen: Solche Objekte werden nie in externe Kontexte gegeben, also weder exportiert noch in erzeugte Dokumente aufgenommen. Innerhalb der App bleiben sie für die Rollen sichtbar; jede Stufen-Änderung wird im Prüfprotokoll festgehalten.",
  },
  {
    id: "faq.vertrauen.6",
    route: "/bibliothek",
    question: "Ein Objekt ist validiert, aber „in Prüfung“ markiert — wie kann das sein?",
    answer:
      "Dann gibt es einen offenen Widerspruch: Ein anderes Objekt oder eine Meldung stellt die Aussage in Frage, und der Konflikt ist noch nicht entschieden. KLARWERK nimmt dem Objekt dabei nichts weg — es kennzeichnet nur ehrlich, dass man sich gerade nicht uneingeschränkt darauf stützen sollte, bis Menschen den Widerspruch geklärt haben.",
  },
  {
    id: "faq.vertrauen.7",
    route: "/bibliothek",
    question: "Woran erkenne ich, ob ich einem Eintrag trauen kann?",
    answer:
      "Schau auf vier Dinge: den Status — validiert oder noch offen; den Vertrauenswert samt Ziel-Anzeige; die Belege — worauf stützt sich die Aussage; und die Hinweise — gibt es einen offenen Widerspruch oder eine fällige Auffrischung. Diese vier zusammen sind die ehrliche Antwort; eine einzelne Zahl allein ist es nie.",
  },
  // ---- Bibliothek ----
  {
    id: "faq.bibliothek.1",
    route: "/bibliothek",
    question: "Wo finde ich das Wissen, das schon geprüft ist?",
    answer:
      "In der Bibliothek — sie ist der Ort des gesicherten Wissens. Dort kannst du suchen, nach Reife und Herkunft filtern und jedes Objekt im Detail öffnen. Was noch in Prüfung ist, erkennst du überall an der ehrlichen Kennzeichnung.",
  },
  {
    id: "faq.bibliothek.2",
    route: "/bibliothek",
    question: "Warum finde ich meinen gerade erfassten Beitrag nicht in der Bibliothek?",
    answer:
      "Vermutlich ist er noch ein Entwurf oder noch in Prüfung. Entwürfe findest du unter „Entwürfe fortsetzen“; Eingereichtes steht auf dem Prüf-Board und am Objekt selbst als „in Prüfung“. In der Bibliothek erscheint Wissen mit vollem Gewicht erst nach der Validierung.",
  },
  {
    id: "faq.bibliothek.3",
    route: "/bibliothek",
    question: "Wie suche ich am besten — nach Stichwort oder Thema?",
    answer:
      "Beides geht: Stichworte aus Aussage und Titel, dazu Filter nach Kategorie, Reife und Herkunft. Nutze die Begriffe, die in eurem Alltag fallen — Anlagennamen, Kennungen, Fachwörter. Wenn du nichts findest, stell die Frage im Fragen-Bereich: Entweder gibt es eine belegte Antwort, oder du hast eine echte Wissenslücke gefunden — auch das ist ein wertvolles Ergebnis.",
  },
  {
    id: "faq.bibliothek.4",
    route: "/bibliothek",
    question: "Woher weiß ich, wer diesen Eintrag geschrieben und geprüft hat?",
    answer:
      "Auf der Detailseite: Der Abschnitt Herkunft zeigt, wer das Wissen erfasst hat und wie es entstanden ist; die Prüfstimmen und der Verlauf zeigen, wer beteiligt war. Diese Nachvollziehbarkeit ist Absicht — Vertrauen braucht ein Gesicht und einen Weg dorthin.",
  },
  {
    id: "faq.bibliothek.5",
    route: "/bibliothek",
    question: "Kann ich sehen, was sich an einem Eintrag geändert hat?",
    answer:
      "Ja. Jede inhaltliche Änderung erzeugt eine neue Version, und der Verlauf zeigt, wer wann was geändert hat. Ältere Stände bleiben als eingefrorene Schnappschüsse erhalten. Nichts wird still überschrieben.",
  },
  {
    id: "faq.bibliothek.6",
    route: "/bibliothek",
    question: "Kann ich Wissen exportieren, zum Beispiel als PDF?",
    answer:
      "Exportieren ja — als JSON, als MediaWiki-Text oder als HTML; beantwortete Fragen lassen sich zusätzlich samt Quellen als Markdown-Datei mitnehmen. Einen PDF-Export gibt es derzeit nicht. Beachte: Als vertraulich markierte Objekte werden grundsätzlich nicht exportiert.",
  },
  // ---- Fragen stellen ----
  {
    id: "faq.fragen.1",
    route: "/fragen",
    question: "Wie stelle ich eine Frage, und woher kommt die Antwort?",
    answer:
      "Tippe deine Frage im Fragen-Bereich ein, so wie du sie einem Kollegen stellen würdest. KLARWERK sucht dann ausschließlich im validierten Wissen eurer Organisation und baut daraus die Antwort — mit den Argumentationsschritten zum Nachvollziehen und den Quellen zum Anklicken. Was nicht aus geprüftem Wissen belegbar ist, kommt nicht in die Antwort.",
  },
  {
    id: "faq.fragen.2",
    route: "/fragen",
    question:
      "Warum sagt KLARWERK „dazu liegt kein gesichertes Wissen vor“, obwohl ich weiß, dass es das gibt?",
    answer:
      "Meist aus einem von drei Gründen. Erstens: Das Wissen ist erfasst, aber noch nicht validiert — es zählt für Antworten erst nach der Prüfung; schau am Objekt nach dem Status. Zweitens: Es ist noch gar nicht erfasst, sondern steckt nur in Köpfen oder Ordnern — dann ist die Lücke ehrlich. Drittens: Die Frage und das Wissen benutzen sehr unterschiedliche Worte — formuliere um oder ergänze das Objekt um gängige Begriffe. In allen drei Fällen zeigt dir die entstandene Wissenslücke den kürzesten Weg zur Lösung.",
  },
  {
    id: "faq.fragen.3",
    route: "/fragen",
    question: "Ist eine Wissenslücke ein Fehler der App?",
    answer:
      "Nein — sie ist eine ehrliche Auskunft und eines der wichtigsten Ergebnisse überhaupt. Eine Lücke sagt: Zu dieser Frage gibt es noch kein geprüftes Wissen. Ein System, das an dieser Stelle trotzdem flüssig antwortet, rät — und genau das tut KLARWERK bewusst nicht. Jede erkannte Lücke ist eine konkrete Chance, wichtiges Wissen zu sichern, bevor es gebraucht wird oder verloren geht.",
  },
  {
    id: "faq.fragen.4",
    route: "/fragen",
    question: "Was mache ich mit einer Wissenslücke — wie fülle ich sie?",
    answer:
      "Offene Lücken werden gesammelt und lassen sich priorisieren und angehen: Wer die Antwort kennt, erfasst sie als neues Wissen — gern direkt aus der Lücke heraus. Danach läuft der normale Weg: Prüfung, Validierung, und beim nächsten Mal gibt es eine belegte Antwort statt der Lücke. So wächst die Wissensbasis genau dort, wo wirklich gefragt wird.",
  },
  {
    id: "faq.fragen.5",
    route: "/fragen",
    question: "Warum steht bei jeder Antwort eine Quelle?",
    answer:
      "Damit du nicht glauben musst, sondern prüfen kannst. Jede Quelle ist ein geprüftes Wissensobjekt — ein Klick öffnet es, und du siehst Bedingungen, Belege und Prüfstand. Eine Antwort ohne Quelle gibt es in KLARWERK nicht; das ist der Kern von „Vertrauen ist Evidenz“.",
  },
  {
    id: "faq.fragen.6",
    route: "/fragen",
    question: "Kann die KI auch aus dem Internet oder Weltwissen antworten?",
    answer:
      "Nur, wenn eure Verwaltung das ausdrücklich freigibt, und dann klar getrennt: Die externe Wissensabfrage hat vier Stufen, von komplett blockiert bis offen. Was von außen kommt, wird sichtbar als extern und ungeprüft markiert und niemals mit eurem validierten Wissen vermischt — es ist Material der Stufe zwei und wird erst durch eure Prüfung zu gesichertem Wissen.",
  },
  {
    id: "faq.fragen.7",
    route: "/fragen",
    question: "Kann ich eine Antwort mit Quellen weitergeben?",
    answer:
      "Ja. Du kannst eine beantwortete Frage kopieren oder als Markdown-Datei herunterladen — inklusive der Quellenangaben, damit die Belegkette erhalten bleibt. Ein PDF-Export ist derzeit nicht dabei.",
  },
  // ---- Konflikte und Duplikate ----
  {
    id: "faq.konflikte.1",
    route: "/konflikte",
    question: "Was ist ein „Konflikt“ — habe ich etwas falsch gemacht?",
    answer:
      "Nein. Ein Konflikt heißt nur: Zwei Aussagen im Bestand passen nicht zusammen — zum Beispiel nennt eine sechs bar als Grenze und die andere acht. Das passiert in jeder lebendigen Organisation. KLARWERK macht den Widerspruch sichtbar, statt ihn zu verstecken, damit Menschen ihn klären können. Wer einen Konflikt auslöst, hat oft gerade etwas Wertvolles getan: eine Unstimmigkeit ans Licht geholt.",
  },
  {
    id: "faq.konflikte.2",
    route: "/konflikte",
    question: "Entscheidet KLARWERK, welche von zwei widersprüchlichen Aussagen stimmt?",
    answer:
      "Nein, niemals. Das System stellt die Aussagen gegenüber, begründet den Verdacht mit wörtlichen Zitaten aus beiden und begrenzt ehrlich die Nutzbarkeit, solange die Frage offen ist. Wer recht hat, entscheiden Menschen — die Entscheidung wird festgehalten und ist im Protokoll nachvollziehbar.",
  },
  {
    id: "faq.konflikte.3",
    route: "/konflikte",
    question: "Was ist der Unterschied zwischen „Zweitmeinung“, „Eskalieren“ und „Auflösen“?",
    answer:
      "Drei Wege, je nachdem, wo die Klärung liegt. Zweitmeinung heißt: eine weitere fachliche Einschätzung einholen und festhalten. Eskalieren heißt: Die Frage ist auf dieser Ebene nicht entscheidbar und geht an die nächste Instanz. Auflösen heißt: Die zuständige Person hält die Entscheidung mit Begründung fest — erst damit endet der Konflikt. Auflösen können Controller und Admins.",
  },
  {
    id: "faq.konflikte.4",
    route: "/konflikte",
    question: "Erkennt das System Widersprüche selbst, oder muss ich sie melden?",
    answer:
      "Beides. Beim Einreichen prüft die KI den neuen Beitrag gegen den Bestand und legt bei einem erkannten Widerspruch automatisch einen Konflikt an — sichtbar mit Begründung und Zitaten; die Erkennung ist eine Unterstützung nach bestem Können und hält dein Einreichen nie auf. Zusätzlich kannst du jederzeit selbst einen Widerspruch am Wissensobjekt melden — dein Blick bleibt der wichtigste Detektor.",
  },
  {
    id: "faq.konflikte.5",
    route: "/konflikte",
    question: "Was passiert mit einem Konflikt, wenn einer der beiden Beiträge gelöscht wird?",
    answer:
      "Dann verliert der Konflikt seine Grundlage und wird geordnet beendet — nachvollziehbar im Protokoll, ohne Fehleranzeigen. Der verbleibende Beitrag gilt wieder als konfliktfrei; inhaltlich neu geprüft ist er dadurch aber nicht — das bleibt, wie immer, Sache von Menschen.",
  },
  {
    id: "faq.konflikte.6",
    route: "/duplikate",
    question: "Was ist ein Duplikat, und soll ich zwei ähnliche Artikel zusammenführen?",
    answer:
      "Ein Duplikat liegt vor, wenn zwei Einträge inhaltlich dasselbe sagen — die App erkennt Überschneidungen automatisch und zeigt, wie stark sich zwei Einträge decken, samt Empfehlung. Zusammenführen ist dann meist sinnvoll: ein Eintrag statt zwei halber. Das Zusammenführen bleibt ein bewusster menschlicher Schritt — automatisch verschmolzen wird nichts.",
  },
  // ---- Bus-Faktor und Risiko ----
  {
    id: "faq.busfaktor.1",
    route: "/risiko",
    question: "Was bedeutet Rot beim Bus-Faktor?",
    answer:
      "Rot heißt: Ein ganzes Wissensgebiet speist sich aus einer einzigen Quelle. Fällt diese eine Quelle aus — Urlaub, Krankheit, Renteneintritt, Kündigung —, steht das Wissen dieses Gebiets nicht mehr zur Verfügung. Der Name kommt von der unbequemen Frage: Was wäre, wenn diese Person morgen vom Bus angefahren würde? Rot ist also ein Organisations-Risiko, das man entschärfen kann, solange es noch nicht eingetreten ist.",
  },
  {
    id: "faq.busfaktor.2",
    route: "/risiko",
    question: "WER ist bei einem roten Bus-Faktor „das Problem“ — eine Person?",
    answer:
      "Niemand ist das Problem — schon gar nicht die Person. Die Kennzahl bewertet Wissensgebiete, nicht Menschen: Sie sagt „dieses Thema hängt an einer Quelle“, nicht „diese Person arbeitet falsch“. Im Gegenteil: Die eine Quelle ist meist die wertvollste Fachkraft im Thema. Die Anzeige, von wem ein Gebiet getragen wird, dient der Absicherung — wen einbinden, wo eine zweite Person aufbauen — und ist ausdrücklich keine Leistungsbewertung und kein Tracking.",
  },
  {
    id: "faq.busfaktor.3",
    route: "/risiko",
    question: "Ist der Bus-Faktor eine Bewertung meiner Mitarbeiter?",
    answer:
      "Nein. Er misst die Verteilung von Wissen, nicht die Leistung von Personen. Ein rotes Gebiet entsteht gerade dadurch, dass jemand dort viel weiß und andere noch nicht — das ist ein Kompliment an die Person und ein Auftrag an die Organisation. KLARWERK ist bewusst kein Werkzeug zur Leistungskontrolle.",
  },
  {
    id: "faq.busfaktor.4",
    route: "/risiko",
    question: "Wie senke ich ein Bus-Faktor-Risiko?",
    answer:
      "Indem mehr als eine Quelle das Gebiet trägt: Die tragende Person erfasst ihr Kernwissen als Wissensobjekte, eine zweite Person prüft es — schon dadurch entsteht ein zweiter Kopf im Thema. Danach hilft der Lernpfad, weitere Kolleginnen und Kollegen strukturiert hineinzuführen. Der Risiko-Bereich zeigt dir, welche Gebiete zuerst dran sein sollten.",
  },
  {
    id: "faq.busfaktor.5",
    route: "/risiko",
    question: "Warum ist es riskant, wenn nur eine Person ein Thema kennt?",
    answer:
      "Weil Erfahrungswissen sonst mit der Person geht — in den Urlaub, in die Rente, zum nächsten Arbeitgeber. Genau dieser stille Verlust ist das Problem, gegen das KLARWERK gebaut ist: Wissen soll der Organisation gehören, nachvollziehbar und geprüft — nicht nur einem Gedächtnis.",
  },
  // ---- KI und Datenschutz ----
  {
    id: "faq.ki.1",
    route: "/admin",
    question: "Woher weiß ich, welche KI gerade arbeitet und ob sie meine Daten sieht?",
    answer:
      "An jedem KI-Knopf sitzt ein Info-Zeichen: Es nennt die Aufgabe, die eingestellte KI und die Datenschutz-Einordnung. „Im Haus“ bedeutet: Die Verarbeitung läuft lokal oder regelbasiert, deine Inhalte bleiben hier und gehen an keinen Dritten. „Externe Verarbeitung“ bedeutet: Ein Cloud-Anbieter arbeitet mit — die Datenschutz-Konformität hängt dann am Auftragsverarbeitungsvertrag mit diesem Anbieter. Du musst also nie raten; die Einordnung steht an genau der Stelle, an der du klickst.",
  },
  {
    id: "faq.ki.2",
    route: "/admin",
    question: "Was ist der Unterschied zwischen „interner“ und „externer“ KI?",
    answer:
      "Die interne KI läuft bei euch — lokal, ohne dass Inhalte das Haus verlassen. Die externe KI ist ein Cloud-Dienst mit oft mehr Leistung, aber die Inhalte der jeweiligen Aufgabe werden dorthin übertragen. Eure Verwaltung legt je Aufgabe fest, welche KI arbeitet, und kann beides kombinieren: sensible Aufgaben intern, andere extern.",
  },
  {
    id: "faq.ki.3",
    route: "/admin",
    question: "Verlassen meine Daten das Haus, wenn ich die KI benutze?",
    answer:
      "Das hängt von der eingestellten KI ab, und du siehst es an der Kennzeichnung: Bei „Im Haus“ bleiben die Inhalte lokal; bei „Externe Verarbeitung“ gehen die Inhalte der jeweiligen Aufgabe an den Cloud-Anbieter. Unabhängig davon gilt: KI-Schlüssel liegen nur auf dem Server, nie im Browser, und als vertraulich markierte Objekte gehen grundsätzlich nicht in externe Kontexte.",
  },
  {
    id: "faq.ki.4",
    route: "/admin",
    question: "Was heißt „deterministischer Modus“ — die KI wirkt plötzlich einfach?",
    answer:
      "Das ist der ehrliche Ersatzmodus ohne Sprachmodell: Wenn keine KI verbunden ist, arbeitet die App regelbasiert weiter — mit einfacheren Vorschlägen und Standardfragen, klar gekennzeichnet. Sie täuscht keine Intelligenz vor, die gerade nicht da ist. Sobald ein gültiger KI-Zugang eingestellt ist, sind die vollwertigen Funktionen wieder aktiv.",
  },
  {
    id: "faq.ki.5",
    route: "/admin",
    question: "Was passiert mit meinen Daten, wenn kein KI-Schlüssel hinterlegt ist?",
    answer:
      "Dann findet gar keine externe Verarbeitung statt — es gibt schlicht keinen Kanal nach draußen. Dein Wissen liegt in eurer Instanz, und die App arbeitet im regelbasierten Modus. Der Schlüssel selbst ist übrigens nie in deinem Browser: Er wird serverseitig verwahrt.",
  },
  {
    id: "faq.ki.6",
    route: "/admin",
    question: "Ist KLARWERK DSGVO-konform?",
    answer:
      "Die ehrliche Antwort hat zwei Teile. Technisch sichert KLARWERK viel zu: lokale Verarbeitung im „Im Haus“-Modus, Schlüssel nur serverseitig, ein manipulationssicheres Protokoll mit Prüfkette, Vertraulichkeitsstufen gegen Abfluss nach außen und rückstandslos entfernbare Demodaten. Aber DSGVO-Konformität ist immer auch Betreibersache: Der Vertrag mit einem Cloud-Anbieter und die Abläufe für Betroffenenrechte liegen bei eurer Organisation. Darum sagt die App es je Aufgabe konkret — im Haus heißt: Daten bleiben hier; extern heißt: Es kommt auf euren Auftragsverarbeitungsvertrag an.",
  },
  // ---- Verwaltung ----
  {
    id: "faq.verwaltung.1",
    route: "/admin",
    question: "Wie stelle ich ein, welche KI für welche Aufgabe benutzt wird?",
    answer:
      "In der KI-Verwaltung im Admin-Bereich: Dort ordnest du je Aufgabe zu, ob die Cloud-KI, eure lokale KI oder der regelbasierte Modus arbeitet — global oder je Einsatz unterschiedlich. Mit „Schlüssel testen“ prüfst du per echtem Mini-Aufruf, ob ein Zugang funktioniert. Die App zeigt anschließend ehrlich an, was je Aufgabe wirksam ist.",
  },
  {
    id: "faq.verwaltung.2",
    route: "/admin",
    question: "Wie lege ich neue Nutzer an und gebe ihnen eine Rolle?",
    answer:
      "Im Admin-Bereich unter Nutzer anlegen: Konto erstellen und eine Rolle vergeben — Betrachter lesen, Experten erfassen, Controller prüfen, Admins verwalten. Selbstregistrierte Konten gibst du dort frei. Ein Schutz ist eingebaut: Der letzte Admin kann sich nicht selbst die Admin-Rolle entziehen.",
  },
  {
    id: "faq.verwaltung.3",
    route: "/admin",
    question: "Wie ändere ich, wie viele Prüfer ein Beitrag braucht?",
    answer:
      "Im Admin-Bereich unter Prüfungen: Die Standard-Prüferanzahl gilt für neue Einreichungen und darf zwischen eins und fünf liegen. Bereits eingereichte Beiträge behalten ihre Zahl. Jede Änderung wird im Protokoll festgehalten, denn sie verändert den Prüfprozess.",
  },
  {
    id: "faq.verwaltung.4",
    route: "/admin",
    question: "Wie groß dürfen hochgeladene Dateien sein, und wie ändere ich das?",
    answer:
      "Die Grenzen für Uploads — Anzahl und Größe — stellt die Verwaltung im Admin-Bereich ein; die Erfassen-Seite zeigt sie den Nutzern an. Wird eine Datei abgewiesen, ist sie meist über der eingestellten Grenze.",
  },
  {
    id: "faq.verwaltung.5",
    route: "/admin",
    question: "Wie spiele ich Beispieldaten ein — und wie werde ich sie sauber wieder los?",
    answer:
      "Demodaten lassen sich nur auf eine leere Instanz laden, damit sich Beispiel und Ernstfall nie mischen. Alle Beispieldaten sind markiert und mit einem Klick rückstandslos entfernbar. Zum Üben ideal — und vor dem echten Start verschwinden sie spurlos.",
  },
  {
    id: "faq.verwaltung.6",
    route: "/admin",
    question: "Wie erkenne ich vor dem Start, ob alles bereit ist?",
    answer:
      "Der Admin-Bereich hat dafür die Bereitschafts-Übersicht: eine Ampel über verbundene KIs, validiertes Wissen, offene Prüfungen, Upload-Grenzen und die Stufe der externen Abfrage — aus echten Zahlen, nicht geschönt. Dazu gibt es den druckbaren Auszug zu Vertrauen und Sicherheit.",
  },
  // ---- Mobil und unterwegs ----
  {
    id: "faq.mobil.1",
    route: "/mobile",
    question: "Kann ich unterwegs mit dem Handy Wissen erfassen?",
    answer:
      "Ja — die mobile Ansicht ist genau dafür da: schnell erfassen mit einer Kurzform, Fragen stellen und Wissen nachschlagen. Die App lässt sich wie eine normale App auf dem Startbildschirm ablegen.",
  },
  {
    id: "faq.mobil.2",
    route: "/mobile",
    question: "Was passiert, wenn ich gerade kein Internet habe?",
    answer:
      "Dann landet dein erfasstes Wissen in einer Offline-Warteschlange und wird übertragen, sobald wieder Verbindung besteht. Die App zeigt dir ehrlich an, ob du online oder offline bist und was noch aussteht — es geht nichts verloren.",
  },
  {
    id: "faq.mobil.3",
    route: "/mobile",
    question: "Geht mobil alles, was am Rechner geht?",
    answer:
      "Nein, bewusst nicht: Mobil kannst du erfassen, fragen und nachschlagen. Das Prüfen und Validieren bleibt dem großen Bildschirm vorbehalten — eine sorgfältige Prüfung mit Belegen und Vergleichen ist auf dem Handy nicht gut aufgehoben.",
  },
  // ---- Ich komme nicht weiter ----
  {
    id: "faq.meta.1",
    route: H,
    question: "Ich verstehe einen Begriff nicht — wo schlage ich nach?",
    answer:
      "Am schnellsten über Klara: Begriff eintippen oder markieren, und du bekommst die Erklärung — auf Wunsch vorgelesen. Zusätzlich hat fast jede Stelle der App ein Fragezeichen mit Kurzerklärung, und das Glossar der Hilfeseite erklärt jeden Fachbegriff in einem Satz.",
  },
  {
    id: "faq.meta.2",
    route: H,
    question: "Ich habe eine Frage, die hier nicht steht — was tun?",
    answer:
      "Stell sie Klara — sie durchsucht die gesamte Hilfe und kann mit eingeschalteter KI auch frei formulierte Fragen beantworten, klar gekennzeichnet und mit Quellen. Kann sie etwas nicht beantworten, sagt sie das ehrlich, und die Frage wird als Hilfe-Lücke festgehalten — genau so, wie KLARWERK auch mit Wissenslücken umgeht: Sie werden gesammelt und geschlossen.",
  },
  {
    id: "faq.meta.3",
    route: H,
    question: "Wo finde ich eine Schritt-für-Schritt-Anleitung für genau meine Aufgabe?",
    answer:
      "Auf der Hilfeseite: Die geführten Einstiege decken die häufigsten Wege ab, und die Schnellwege-Sammlung führt dich vom Ziel — etwa „ich will Wissen aus einem Dokument ziehen“ — auf dem kürzesten Klickweg hin, mit Link in den passenden Vertiefungs-Artikel.",
  },
  {
    id: "faq.meta.4",
    route: H,
    question: "Warum sieht meine Kollegin andere Knöpfe als ich?",
    answer:
      "Wegen der Rollen: Die App zeigt jedem nur die Handlungen, die seine Rolle erlaubt. Ein Betrachter sieht keine Erfassen-Knöpfe, ein Experte keine Prüf-Entscheidungen, und Verwaltungs-Bereiche sehen nur Admins. Das ist kein Fehler, sondern Rechteschutz — welche Rolle du hast, siehst du in deinem Profil.",
  },
] as const;

# KLARWERK — Konzept: Die Erfassung als „vertraute Vordertür"

*Auftraggeber: Pedi · über Paul (Cloud-Worker) · Ausarbeitung: externer Berater · Stand: 06.07.2026 · Antwort auf den Richtungs-Auftrag „So einfach wie Word — aber nicht Word"*

> **Was hier steht:** (1) das Sollbild der Vordertür als Fließtext + Wireframe-Beschreibung, (2) konkrete Antworten EF-1 bis EF-9, (3) ein Migrationspfad in drei Stufen, (4) der ausdrücklich erbetene Widerspruch — die ehrliche Gegenprobe zu eurer These, an zwei Stellen deutlich. Ich arbeite in euren Leitplanken (Formatierung bleibt, kein Sackgassen-Gefühl, Burggraben bleibt, Ehrlichkeit, Sicherheit, kein Funktionsverlust) und auf dem bestätigten Bestand (Rich-Text-Editor mit Blöcken, sichere Bild-Einbettung, Datei-Import mit Belegstellen-Extraktion, Reasoner Freitext→Struktur, quellengebundene Fragen). Ich habe keine blockierenden Rückfragen; wo ich Produktverhalten annehme, ist es als **Annahme** markiert — Paul möge korrigieren, falls der Code abweicht.
>
> **Vorab die Kurzfassung in drei Sätzen:** Die richtige Vordertür ist **ein leeres Blatt mit einem Titelfeld**, in das man tippt, Bilder zieht und aus Office einfügt — und *unter* dem die Struktur später, sichtbar angeboten aber nie erzwungen, entsteht. Die Sackgasse verschwindet, indem das „Studio" aufhört, ein zweiter Ort zu sein, und zu einer **Ansicht desselben Blatts** wird (ein Schalter „einfach ↔ strukturiert", kein zweites Fenster). Und die These „so einfach wie Word" stimmt für die *Eingabe*, ist aber für den *Moment der Strukturierung und der Prüfung* falsch — genau dort liegt euer Wert, und genau dort darf es sich nicht wie Word anfühlen, sondern muss einen bewussten, ehrlichen Übergang haben (mein Hauptwiderspruch, Abschnitt 4).

---

## 1 · Sollbild: die Vordertür

### 1.1 Das Grundbild
Der Nutzer klickt „Wissen erfassen" und sieht **ein leeres Blatt**: oben ein großes, ruhiges Titelfeld („Worum geht es? — in einem Satz"), darunter eine großzügige Schreibfläche mit blinkendem Cursor. Keine Modus-Wahl, keine Schritt-Leiste, kein Formular, keine Frage „Erzählen, Diktieren, Interview oder aus Datei?" vorab. Das Blatt **ist** schon der Rich-Text-Editor, der im Code existiert — nur ohne die Verpackung davor. Es fühlt sich an wie ein neues Word-Dokument, weil es sich exakt so verhält: tippen, Absätze, Aufzählung, Fett — die vertrauten Gesten funktionieren sofort.

Am Blatt sind, unaufdringlich, drei Einstiege für alle, die nicht tippen wollen — als kleine Zeile über oder unter dem Titel, nicht als Gabelung davor:
- **📎 Datei einwerfen** (oder Datei irgendwo aufs Blatt fallen lassen),
- **🎤 Diktieren** (spricht in dasselbe Blatt),
- **🖼 Bild einfügen** (oder Bild reinziehen / aus der Zwischenablage einfügen).

Entscheidend: Diese drei sind **Einwürfe in dasselbe Blatt**, keine getrennten Welten. Wer eine Datei fallen lässt, landet nicht in einem anderen Werkzeug — der Inhalt erscheint **im Blatt**, formatiert, und der Cursor steht danach im selben Dokument. Das ist der Kern gegen die Sackgasse: Es gibt nur **einen Ort**.

### 1.2 Was „darunter" passiert (unsichtbar, bis es hilft)
Während der Nutzer schreibt oder einwirft, arbeitet KLARWERK im Hintergrund — aber **schweigend**, bis es etwas Nützliches anzubieten hat. Unten am Blatt (oder in einer ruhigen Randspalte) wächst ein **„Klarwerk versteht"-Streifen**: eine dezente, jederzeit ignorierbare Vorschau dessen, was das System aus dem Text als Struktur erkennt — Kernaussage, Bedingungen, Maßnahmen. Der Nutzer muss ihn nie ansehen. Er ist ein **Angebot, kein Tor**. Erst wenn der Nutzer „Übernehmen" oder „Ordnen" tippt, wird aus dem freien Blatt ein strukturiertes Wissensobjekt — und selbst dann bleibt der Volltext erhalten (siehe EF-2).

### 1.3 Der eine Ausgang (gegen die Sackgasse)
Oben rechts, immer sichtbar, unveränderlich: **„Speichern"** und **„Einreichen"**. „Speichern" legt einen Entwurf ab (das Blatt ist nie verloren). „Einreichen" gibt es in die Prüfung. Daneben ein **„Abbrechen/Schließen"**, das immer zurück zur vorigen Seite führt. Kein Zustand der Vordertür darf ohne diese drei Ausgänge existieren. Es gibt **kein** „Studio im Studio", keine Ansicht, aus der man nur über einen versteckten Pfeil herauskommt.

### 1.4 „Einfach ↔ Strukturiert" als Schalter, nicht als zweiter Raum
Das heutige Studio wird **kein zweiter Ort mehr**, sondern eine **zweite Ansicht desselben Blatts**, erreichbar über einen Schalter oben („Einfach • Strukturiert"). In der Einfach-Ansicht: ein Blatt, tippen. In der Strukturiert-Ansicht: dieselben Inhalte, aber in die Felder Aussage/Bedingungen/Maßnahmen sortiert, zum Feinschliff. Ein Klick wechselt hin und her, **ohne** dass sich ein Fenster öffnet oder der Kontext verloren geht. Damit ist die Verschachtelung strukturell unmöglich geworden: Es gibt nur ein Dokument in zwei Darstellungen.

### 1.5 Wireframe-Beschreibung (grob)
```
┌───────────────────────────────────────────── Wissen erfassen ──────┐
│  [ Ansicht: ● Einfach  ○ Strukturiert ]        [Abbrechen] [Speichern] [Einreichen] │
│                                                                     │
│  Worum geht es? ______________________________________________     │  ← Titel (ein Satz)
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Schreib einfach, was du weißt …                          │   │  ← das Blatt (Rich-Text)
│  │  [B] [•Liste] [H] [🖼 Bild] [ℹ Hinweisblock]              │   │  ← vertraute Werkzeugleiste
│  │                                                           │   │
│  │  (getippter Text, eingefügte Absätze, Bilder an Ort)      │   │
│  └───────────────────────────────────────────────────────────┘   │
│   📎 Datei einwerfen    🎤 Diktieren    🖼 Bild einfügen            │  ← Einwürfe ins SELBE Blatt
│                                                                     │
│  ┌─ Klarwerk versteht (Vorschau, optional) ───────────────────┐   │
│  │  Aussage:  …            [Ordnen ▸]  [ausblenden]           │   │  ← Angebot, kein Zwang
│  │  Bedingungen: …   Maßnahmen: …                             │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2 · Antworten EF-1 bis EF-9

### EF-1 · Die Vordertür
Ein leeres Blatt mit Titelfeld (Abschnitt 1). Kein Modus-Vorabentscheid. Die vier heutigen „Erzähl-Modi" werden zu **einem** Blatt mit drei Einwürfen (Datei/Diktat/Bild), die alle in dasselbe Dokument münden. Die Brücke ins Wissensobjekt-Modell: Der Titel wird zur vorgeschlagenen **Aussage**, der Fließtext bleibt als **ausführlicher Text** erhalten, und die KI schlägt darunter Bedingungen/Maßnahmen vor — übernommen wird nur, was der Nutzer bestätigt. Ein Wissensobjekt kann also von Anfang an entstehen, ohne dass der Nutzer je ein Feld ausgefüllt hat, das „Feld" heißt.

### EF-2 · Struktur ohne Zwang — die ehrlichste Reihenfolge
**Reihenfolge: schreiben → (im Hintergrund erkennen) → am Ende anbieten → auf Klick ordnen.** Konkret: Während des Schreibens erkennt der Reasoner still mit und füllt die „Klarwerk versteht"-Vorschau — aber er unterbricht nie und ändert nie den Text des Nutzers. Erst beim „Einreichen" (oder wenn der Nutzer aktiv „Ordnen" tippt) wird die Struktur verbindlich vorgeschlagen: „Ich habe das so verstanden — passt das?" mit der Möglichkeit, jedes Feld zu korrigieren. **Was ich ausdrücklich abrate:** Inline-Strukturierung *während* des Tippens (Felder, die sich live füllen und den Cursor stören) — das ist genau die „Maschine statt Blatt"-Erfahrung, die vertrieben werden soll. Die Struktur kommt **nach** dem Gedanken, nicht mittendrin. Und der Volltext wird nie weggeworfen: Auch ein strukturiertes Objekt behält seinen ausführlichen Text (heute `bodyHtml`), damit nichts von dem verloren geht, was der Nutzer geschrieben hat.

### EF-3 · Office-Paste (Word/Excel/PowerPoint)
Beim Einfügen aus Office kommt **HTML** in der Zwischenablage mit — daraus lässt sich Formatierung erhalten. Regel: **durch den vorhandenen Sanitizer, Allowlist-basiert**, nicht rohes Office-HTML übernehmen.
- **Übernehmen:** Überschriften, Absätze, Fett/Kursiv/Unterstrichen, Aufzählungen und nummerierte Listen, einfache Tabellen, eingebettete Bilder (als sichere Einbettung, siehe EF-5).
- **Verwerfen/normalisieren:** Office-Wrapper-Müll (`mso-`-Styles, leere `span`-Verschachtelungen), Schriftart/-größe/-farbe (auf die KLARWERK-CI normalisieren — sonst sieht jeder Eintrag anders aus), absolute Positionierung, aktive Inhalte, externe Verweise auf fremde Server (kein Hotlinking — Bilder werden **eingezogen und lokal gespeichert**, nicht verlinkt).
- **Excel/Tabellen:** als echte Tabelle übernehmen, wenn die Struktur einfach ist; bei riesigen/verschachtelten Tabellen ehrlich anbieten: „Als Tabelle einfügen" oder „als Text einfügen". Keine stille Verstümmelung.
- **PowerPoint:** Text je Folie als Absätze, Folien-Grafiken als Bilder (EF-5). Sprechernotizen optional mit anbieten.
- **Leitsatz:** Lieber **sauber reduziert** als „pixelgenau, aber Müll". Der Nutzer wirft ein formatiertes Dokument rein und bekommt ein **sauber formatiertes** zurück — nicht sein Word-Layout eins zu eins, aber nie rohen Text (das K.-o.-Kriterium ist erfüllt: Struktur und Bilder bleiben, nur der Office-Ballast fällt weg).
*Annahme:* Der bestehende Sanitizer kann um eine Office-Paste-Normalisierung erweitert werden; das ist Editor-Arbeit, kein neues Modul.

### EF-4 · Ganz-Dokument als verlässliche Quelle (Design-Guide-Szenario)
Hier ist die heikelste Vertrauensfrage — ich beantworte sie mit einer **klaren Grenze**, weil hier der Burggraben verteidigt werden muss.

Ein extern bereits freigegebenes Dokument (Design-Guide, Norm, Betriebsanweisung) wird importiert und soll „verlässlich" sein. **Ehrliche Wahrheit: „extern freigegeben" ist nicht dasselbe wie „von uns validiert".** Es ist eine andere Art von Vertrauen — Herkunfts-Vertrauen, nicht Peer-Vertrauen. KLARWERK darf das nicht verwischen, sonst bricht das Kernversprechen. Mein Vorschlag, der beides ehrlich hält:

- Das importierte Dokument wird **ein Wissensobjekt einer eigenen Herkunftsart: „externe Referenz"** — mit sichtbarem Chip „Aus freigegebenem Dokument übernommen" und dem Belegdokument als Anhang.
- Es bekommt **nicht** automatisch vollen Trust. Es durchläuft eine **Schnellprüfung mit einer Freigabe** (eure aktuelle Idee — ich halte sie für richtig), bei der ein Controller/Admin **nicht den Inhalt neu erfindet**, sondern **die Herkunft bestätigt**: „Ja, dieses Dokument ist bei uns die gültige Referenz, und der Import ist vollständig/unverfälscht." Das ist eine ehrliche, andere Prüffrage als die inhaltliche Peer-Prüfung — und sie sollte in der UI auch anders heißen: **„Als Referenz bestätigen"** statt „validieren".
- Der Trust-Wert eines so bestätigten Objekts trägt sichtbar das Etikett **„Herkunft: externe Referenz"** — er ist nutzbar für Antworten, aber die Antwort zeigt, dass die Quelle eine bestätigte externe Referenz ist, nicht ein peer-validiertes Erfahrungsobjekt. So bleibt für jeden erkennbar, *welche Art* Vertrauen dahinter steht.
- **Die Grenze:** Ein Dokument, das *niemand* bestätigt, bleibt ein ungeprüfter Anhang/Entwurf und speist keine Antworten. „Verlässlich, weil extern freigegeben" gilt erst nach der einen menschlichen Bestätigung — nie allein durch den Upload.

Optional und stark: Bei großen Dokumenten läuft **zusätzlich** die vorhandene Punkte-Extraktion, sodass aus dem Design-Guide einzelne, gezielt abfragbare Wissenspunkte mit wörtlicher Belegstelle entstehen — das Dokument als Ganzes bleibt die Referenz, die Punkte machen es durchsuchbar.

### EF-5 · Grafiken
Grafiken sind bei einem Design-Guide oft die eigentliche Aussage — sie dürfen nicht verlorengehen. Verhalten:
- **Position erhalten:** Bilder bleiben an ihrer Stelle im Fließtext (inline, dort wo sie im Dokument standen), nicht in einen anonymen Anhang-Haufen verschoben.
- **Im Zweifel alle übernehmen:** Beim Ganz-Dokument-Import werden alle enthaltenen Grafiken eingezogen (lokal gespeichert, sichere Einbettung) — lieber eine zu viel als eine zu wenig; Wegwerfen kann der Nutzer leicht, Wiederbeschaffen nicht.
- **Galerie zusätzlich:** Neben der Position im Text eine kleine „Bilder in diesem Objekt"-Galerie, damit man schnell sieht/verwaltet, was drin ist.
- **Jederzeit ergänzen:** Bild einfügen per Knopf, Drag&Drop und Zwischenablage — überall im Blatt, nicht nur an einer Sonderstelle.
- **Sicherheit (Leitplanke):** Rastergrafiken (PNG/JPG) werden eingebettet; **SVG bleibt Anhang, nicht inline** (aktiver Inhalt); kein Hotlinking auf fremde Server — alles wird lokal gespeichert. Upload-Grenzen gelten; bei sehr großen Bildern verkleinern und das Original als Anhang behalten.

### EF-6 · Dokumentgestützte Fragen
Dokument hochladen → Fragen darauf stellen, Antwort verknüpft die Inhalte. Ehrliche Präsentation:
- Die Antwort ist **klar als „KI-generiert — aus diesem Dokument, nicht zu 100 % geprüft"** gekennzeichnet (dieselbe Kennzeichnung wie Klaras KI-Suche).
- **Belegstellen statt Behauptung:** Jede Aussage der Antwort trägt einen Verweis auf die Stelle im Dokument (Zitat/Abschnitt), anklickbar. Was sich nicht belegen lässt, kommt nicht in die Antwort.
- **Ehrliche Lücke:** Gibt das Dokument die Antwort nicht her, sagt die KI das — kein Weltwissen-Auffüllen aus dem Modell (es sei denn, der Nutzer schaltet externe Anreicherung bewusst zu, dann klar getrennt markiert).
- **Grenze zum Bestand:** „Fragen auf dieses Dokument" ist zunächst eine Arbeitshilfe *vor* dem Erfassen — das Dokument ist noch kein validiertes Wissen. Was der Nutzer aus den Antworten für wertvoll hält, überführt er bewusst in Wissensobjekte (die dann den normalen Weg gehen). So bleibt die Trennung „Arbeitsmaterial vs. gesichertes Wissen" sauber.

### EF-7 · Suche → Antwort/Zusammenfassung
Aus der Suche heraus zwei optionale, **sichtbar getrennte** Modi:
- **„Gefunden"** (Standard, immer da): die Trefferliste — echte Wissensobjekte, kein KI-Eingriff. Das ist die verlässliche, wörtliche Ebene.
- **„Von der KI verdichtet"** (optionaler Knopf): eine KI-Antwort oder Zusammenfassung über die Treffer, mit Quellen-Chips zu jedem herangezogenen Objekt, deutlich als KI-generiert etikettiert.
Die sichtbare Unterscheidung ist Pflicht: **gefunden = wörtlich aus dem Bestand; verdichtet = von der KI kombiniert.** Farbe/Etikett/Icon trennen die beiden klar, damit niemand eine KI-Zusammenfassung für ein zitierfähiges Original hält. Das ist exakt das Muster, das Klaras KI-Suche schon nutzt — hier auf die Wissenssuche übertragen.

### EF-8 · Onboarding / Progressive Disclosure
- **Erststart:** nur das leere Blatt + Titel + ein einziger ruhiger Satz Hilfe („Schreib einfach, was du weißt — ordnen kann KLARWERK später."). Die drei Einwürfe (Datei/Diktat/Bild) sind sichtbar, aber klein.
- **Fortgeschrittenes erscheint bei Bedarf:** Der „Strukturiert"-Schalter, Vertraulichkeitsstufe, Kategorie/Tags, Prüfer-Vorschlag liegen unter „Erweitert" (progressive disclosure — existiert im Bestand) und tauchen erst auf, wenn der Nutzer sie sucht oder beim Einreichen sinnvoll sind.
- **Kontext-Hilfe:** Klara ist die Führung — kein Zwangs-Tutorial. Wer nicht fragt, wird nicht belehrt.
- **Prinzip:** Der Erstnutzer erlebt Tag eins ein Blatt. Möglichkeiten wachsen mit der Vertrautheit, nicht mit dem ersten Klick.

### EF-9 · Migration (Kurzform, Details Abschnitt 3)
Der heutige Multi-Modus-Wizard bleibt als „andere Wege" erhalten, wird aber **nachrangig**: Die Vordertür wird der Standard-Einstieg; „Erzähl-Modi", Experten-Formular und die alte Studio-Ansicht sind über „Andere Wege zum Erfassen" erreichbar für die, die sie schätzen. Kein Funktionsverlust, nur neue Priorität.

---

## 3 · Migrationspfad (3 Stufen, ohne Funktionsverlust)

**Stufe 1 — Die Sackgasse zuerst schließen (klein, dringend, hoher Effekt).**
Das „Studio im Studio" auflösen: Studio wird von einem zweiten Ort zu einer **zweiten Ansicht** desselben Editors (Schalter „Einfach ↔ Strukturiert"), mit immer sichtbaren Ausgängen Abbrechen/Speichern/Einreichen. Bild einfügen reparieren (der gemeldete Fehler „ging nicht"). Das behebt die beiden schmerzhaftesten Tester-Befunde, ohne die Architektur umzuwerfen — und ist für den nächsten Testlauf sofort spürbar. *Kein Datenmodell-Eingriff.*

**Stufe 2 — Die Vordertür bauen.**
Das leere Blatt als neuer Standard-Einstieg vor die bestehenden Modi setzen; die drei Einwürfe (Datei/Diktat/Bild) als Einwürfe ins selbe Blatt verdrahten (die Bausteine existieren, sie werden nur zusammengeführt statt verzweigt). Office-Paste-Normalisierung im Sanitizer (EF-3). „Klarwerk versteht"-Vorschau als stiller Hintergrund-Reasoner (EF-2). Die alten Modi wandern unter „Andere Wege". *Hier liegt die Hauptarbeit — reiner Frontend-/Editor-Umbau, kein neues Backend.*

**Stufe 3 — Das Ganz-Dokument & die Verdichtung.**
Ganz-Dokument-Import als „externe Referenz" mit „Als Referenz bestätigen"-Schnellprüfung (EF-4) — das braucht einen kleinen Datenmodell-Zusatz (Herkunftsart + Etikett) und berührt die Prüf-/Trust-Logik, daher zuletzt und mit Bedacht. Grafik-Übernahme an Position (EF-5). Dokumentgestützte Fragen (EF-6) und Suche-Verdichtung (EF-7) als aufgesetzte KI-Funktionen, die auf Klaras vorhandenem KI-Suchmuster aufbauen.

**Reihenfolge-Logik:** erst Schmerz beheben (1), dann die vertraute Tür öffnen (2), dann die anspruchsvollen Vertrauens-Features (3). Nach jeder Stufe ist ein testbarer, ehrlich lieferbarer Stand erreicht.

---

## 4 · Ausdrücklicher Widerspruch (die erbetene Gegenprobe)

Ihr wollt die ehrliche Gegenprobe — hier ist sie, an drei Punkten.

**Widerspruch 1 (der wichtigste): „So einfach wie Word" ist für die Eingabe richtig und für den Wert-Moment gefährlich.** Word ist einfach, *weil es nichts von dir will* — es speichert stumm, was du tippst, und fragt nie nach. Euer ganzer Wert entsteht aber genau an der Stelle, an der KLARWERK etwas will: den Übergang von „hingeschrieben" zu „strukturiert, geprüft, mit Herkunft". Wenn dieser Übergang so unsichtbar wird wie bei Word, entsteht dasselbe wie bei Word: eine Halde unstrukturierter Dokumente ohne Prüfung — nur mit KLARWERK-Logo. Die Konsequenz ist nicht, den Übergang wieder kompliziert zu machen, sondern ihn **bewusst und leicht** zu gestalten: ein klarer, freundlicher Moment „Soll ich das ordnen und zur Prüfung geben?" — nicht null Reibung, sondern *die richtige, minimale* Reibung an der einen Stelle, die zählt. „So einfach wie Word bei der Eingabe, aber mit einem bewussten Moment beim Übergang" ist die ehrlichere Formel als „so einfach wie Word".

**Widerspruch 2: Der Tester-Satz „Ich verzettel mich mit all den Möglichkeiten" wird durch die Vordertür gelöst — aber ein Ganz-Dokument-Import als „verlässlich" schafft ein neues, größeres Verzettel-Risiko.** Wenn das Reinwerfen kompletter Dokumente zu leicht wird und sie zu schnell „verlässlich" heißen, kippt die Bibliothek von *kuratiertem Erfahrungswissen* zu einer *Dokumentenablage*. Dann sucht der Nutzer wieder in 80-seitigen PDFs statt in geprüften Aussagen — das ist der Zustand vor KLARWERK. Deshalb bestehe ich in EF-4 auf der klaren Grenze und dem eigenen Etikett „externe Referenz": Der Ganz-Dokument-Import ist wertvoll, aber er darf nicht der bequemste Weg werden, die eigentliche Wissensarbeit zu umgehen. Meine Empfehlung: Ganz-Dokument-Import ist ein **bewusstes** Feature (eigener Knopf „Referenzdokument aufnehmen"), nicht der Default der Vordertür.

**Widerspruch 3 (kleiner, aber praktisch): „Formatierung darf nicht verloren gehen" und „es entsteht etwas Sauberes" sind ein Zielkonflikt — und ihr müsst euch entscheiden, welche Seite im Zweifel gewinnt.** Pixelgenaue Word-Treue *und* einheitliche, saubere KLARWERK-Darstellung gehen nicht immer zusammen (Word-Dokumente sind oft chaotisch formatiert). Meine klare Empfehlung: Im Zweifel gewinnt **sauber und einheitlich** über pixelgenau — Struktur und Bilder bleiben erhalten (das K.-o.-Kriterium), aber Schriftarten, Farben und Abstände werden auf die KLARWERK-CI normalisiert. Ein Nutzer, der erwartet, dass sein Corporate-Design-PDF *exakt* so aussieht wie im Original, wird sonst enttäuscht — und diese Erwartung solltet ihr aktiv nicht wecken. „Formatierung bleibt erhalten" bitte kommunizieren als „**Struktur und Bilder** bleiben erhalten", nicht als „dein Layout bleibt erhalten".

**Wo ich euch ausdrücklich recht gebe:** Die Diagnose stimmt vollständig — die vier Modi + Formular + Studio-im-Studio sind Verpackung, die die wertvollsten Nutzer vertreibt; „Menschen bringen ihre Werkzeuge mit, nicht ihre Lernbereitschaft" ist genau richtig; und die Bausteine sind da. Der Umbau ist überfällig und die Richtung ist gut. Mein Widerspruch betrifft nicht das *Ob*, sondern zwei Stellen, an denen die Vereinfachung zu weit gedacht den Burggraben beschädigen würde.

---

*Ende des Konzepts. Sollbild, EF-1…EF-9, Migration in drei Stufen und drei Gegenproben geliefert. In euren Leitplanken gearbeitet; die eine strategische Empfehlung, die ich euch dringend ans Herz lege: den Ganz-Dokument-Import als bewusstes „externe Referenz"-Feature mit eigenem Etikett und eigener Prüffrage führen, nicht als Default der Vordertür — so bleibt die Bibliothek kuratiertes Wissen und wird keine Dokumentenhalde. Kein Code verändert; reine Konzeptlieferung. Annahmen zum Editor/Sanitizer bitte von Paul gegen den Code prüfen.*

# Klara in Excel und PowerPoint (Mac und Web)

Auftrag `aufnahme:20260922:excel-erster-weg`, Revision 4 (KLARA-OFFICE-04). Stand dieser Datei:
Kandidatenvorbereitung vom 15.10.2026. **Das hier ist Bauumfang und Abnahmeplan, keine Abnahme.**
Ob Klara in Excel und PowerPoint auf diesem Mac und im Web wirklich läuft, belegen erst die vier
Hostläufe aus Abschnitt 6. Bis dahin gilt jede Aussage unten als gebaut und automatisiert geprüft,
nicht als in Office benutzt.

## 1. Was gebaut ist

| Teil | Datei | Zweck |
| --- | --- | --- |
| Manifest Excel | `docs/office-addin/klara-excel-manifest.xml` | Host `Workbook`, `ExcelApi 1.1`, `ReadWriteDocument` |
| Manifest PowerPoint | `docs/office-addin/klara-powerpoint-manifest.xml` | Host `Presentation`, `PowerPointApi 1.1`, `ReadWriteDocument` |
| Aufgabenfenster | `apps/web/public/office-addin/taskpane.html`, `taskpane.js`, `taskpane.css` | ein Fenster für beide Hosts; Office sagt beim Start, welcher Host es geöffnet hat |
| Hostkern | `apps/web/public/office-addin/hostkern.js` | Regeln ohne Office: API-Stufen, Auswahl, Grenzen, Zielprüfung, Nachrechnung |
| Auslieferung | `services/app/src/web-static.ts` (`/office-addin/taskpane.html`) | gestempelte Fassung, `no-cache`, lautes 404 — wie die Word-Seite |
| CSP | `services/app/src/security-headers.ts` (`OFFICE_ADDIN_CSP_PATHS`) | office.js und Einbettung durch Excel/PowerPoint im Web, exakt nur für diese Seite |

**Wiederverwendet, nicht neu gebaut:** die Anmeldung (Dialogseite `/word-addin/anmeldung.html`,
Übergabecode `/api/auth/office-handover/redeem`), der Klara-Sitzungsweg (`/api/klara/sessions`,
Zustimmung je Sitzung und Dokument, `/execute`), der Entwurfsweg (`/api/drafts`), die Einbettungsregel
(`office-host.ts`, samt `KLARWERK_M365_MANDANTEN`). Das Word-Manifest und das Word-Fenster sind
unverändert; das Word-Manifest bleibt Word-only (`<Host Name="Document" />`).

## 2. Erster Arbeitsweg (Vorschlag — wartet auf Pedis Bestätigung)

Kriterium K1 verlangt, dass **Pedi** einen ersten konkreten Arbeitsweg bestätigt. Eine solche
Bestätigung liegt diesem Auftrag nicht vor; der Weg unten ist der gebaute Vorschlag, nicht eine
bestätigte Entscheidung.

- **Rolle:** das vorhandene berechtigte fiktive Testkonto (Rechte `ko.read`, für Entwürfe
  `ko.create`), Schreibrecht nur am eigenen fiktiven Testdokument. Keine Organisationsrechte, keine
  Graph-Rechte, keine Installation auf fremden Rechnern.
- **Eingabe Excel:** markierte Zellen der aktiven Arbeitsmappe und des aktiven Blatts.
- **Eingabe PowerPoint:** markiertes Textfeld oder markierte Folie der aktiven Präsentation.
- **Frage:** frei formuliert im Fenster; der gelesene Kontext reist mit.
- **Ausgabe (bewusste, zielgebundene Rückgabe nach zweitem Klick):**
  - Excel: `=SUM(…)` direkt unter eine einspaltige Zahlenauswahl; oder die Antwort als Text in eine
    angegebene Zelle.
  - PowerPoint: die Antwort ersetzt den Text des markierten Textfelds.
- **Rücknahme:** „Letzte Änderung zurücknehmen", solange das Ziel genau Klaras Inhalt trägt.
- **Wissensquelle (R-0187):** „Auswahl als Wissens-Entwurf übernehmen" legt einen Entwurf an. Er ist
  **keine geprüfte Quelle**, bis er in KLARWERK regulär geprüft und eingereicht ist.

## 3. Werte, Formeln, Bereiche und Quellenbezug (K2, KO-04-02)

| Angabe | Woher | Wie Klara sie behandelt |
| --- | --- | --- |
| angezeigter Text | `Range.text` | so, wie Excel ihn zeigt (Format, Einheit: „1.200 €") |
| gespeicherter Wert | `Range.values` | Zahl, Text, Wahrheitswert oder Fehler; Grundlage jeder Nachrechnung |
| Formel | `Range.formulas` | nur wenn die Zelle eine hat; steht getrennt neben dem Wert |
| Art | `Range.valueTypes` | Zahl, Text, Fehler, Wahrheitswert, leer |
| Bereich | `getSelectedRanges()` (ExcelApi 1.9), sonst `getSelectedRange()` | Adresse mit Blatt; mehrteilige Auswahl je Teilbereich |
| Quellenbezug | Dateiname, Blatt, Adresse | steht im Kontext jeder Frage und in jedem Entwurf |

Grenzen: höchstens **500 Zellen** je Bereich und **5 Bereiche** werden gelesen; der Kontext zu einer
Frage ist auf **6000 Zeichen** begrenzt (der Klara-Weg nimmt höchstens 8000). Was wegfällt, steht als
Satz im Kontext. Leere Auswahl, mehrteilige Auswahl und zu große Auswahl (zum Beispiel eine ganze
Spalte) haben je einen eigenen, sichtbaren Satz.

**Rechnen:** Klara behauptet keine mathematische Richtigkeit einer Modellantwort. Sie rechnet die
gespeicherten Zahlenwerte im Fenster selbst nach (Anzahl, Summe, kleinste, größte). Beim Einfügen von
`=SUM(…)` rechnet **Excel**; Klara liest Excels Ergebnis zurück und vergleicht es mit ihrer
Nachrechnung („stimmt überein" oder „weicht ab").

**Text bleibt Text:** eine Antwort, die mit `=`, `+`, `-` oder `@` beginnt, wird mit vorangestelltem
Apostroph geschrieben und damit nie zur Formel.

## 4. PowerPoint (KO-04-04, KO-04-05)

| Lage | Was Klara liest | Rückgabe | Ausweg im Fenster |
| --- | --- | --- | --- |
| ein Textfeld markiert | Text der Form, Folie | ja (PowerPointApi 1.4 + 1.5) | — |
| nur eine Folie markiert | Text aller Textfelder der Folie | nein | „markiere genau ein Textfeld" |
| mehrere Formen | Text aller markierten Textfelder | nein | „markiere genau ein Textfeld" |
| Bild, Diagramm, Grafik | nichts | nein | „Bilder, Diagramme und Grafiken ändert Klara nicht" |
| Lese- oder Präsentationsansicht | nichts | nein | „Ansicht › Normal" bzw. im Web „Bearbeiten" |
| nur lesbar geöffnet | nichts | nein | „zum Bearbeiten öffnen" |
| PowerPointApi 1.5 fehlt | markierter Text (gemeinsame Office-API) | nein | benennt die fehlende Stufe |

Vor dem Schreiben prüft Klara Position, Ziel und Inhalt; danach liest sie Text und Position zurück.
Klara legt **keine** Form, kein Bild, keine Folie und keine Figur an — auch keine Begleitfigur.

## 5. Schutz vor falschen Zieländerungen (KO-04-06)

Jede Rückgabe wird **unmittelbar vor dem Schreiben** frisch gegen Office geprüft. Sie unterbleibt mit
benanntem Grund, wenn:

- ein anderes Dokument oder ein anderes Blatt aktiv ist;
- die Datei nur lesbar oder das Blatt geschützt ist (Klara hebt keinen Schutz auf);
- die gelesenen Zellen bzw. das Textfeld sich seit der Vorbereitung geändert haben (eigene
  Bearbeitung oder Koautor);
- die Zielzelle belegt ist und das Überschreiben nicht ausdrücklich angehakt wurde;
- Folie oder Form nicht mehr existieren oder PowerPoint in der Leseansicht ist;
- die Form seit der Vorbereitung verschoben oder in der Größe geändert wurde (Lage und Größe werden
  vor dem Schreiben frisch gelesen; nach dem Schreiben werden Text und Position zurückgelesen und
  gegen die beabsichtigte Änderung geprüft);
- die Antwort nicht zur aktuellen Lage gehört: jede Antwort ist an Dokument, Auswahl und
  Inhaltsstand gebunden, zu denen gefragt wurde. Ein Auswahl- oder Inhaltswechsel sperrt sie für
  Rückgaben; eine verspätet eintreffende Antwort wird gegen diese Bindung geprüft und nur angezeigt;
  unmittelbar vor dem Schreiben wird der Antwortbezug erneut geprüft;
- die Vorbereitung älter als fünf Minuten ist oder sich die Auswahl inzwischen geändert hat
  (Unterbrechung).

Die Zustimmung zum Senden von Dokumentinhalt an ein externes Modell gilt wie bei Word je Sitzung und
Dokument; ohne sie gehen nur geprüftes Wissen und Suchbegriffe in die Antwort.

**Begleitfigur:** das Fenster zeigt oben in einer Zeile, was Klara gerade sieht (Host, Datei, Blatt
bzw. Folie, Bereich bzw. Form), und meldet denselben Stand als `window.klaraOfficeKontext` und
Ereignis `klara-office-kontext`. Eine **frei bewegliche native Begleitfigur auf dem Mac** gehört zu
`produkt:20261010:klara-office-mac-maskottchen` (KLARA-OFFICE-02) und ist hier **nicht** gebaut.

## 6. Abnahmeplan: vier echte Hostläufe (KO-04-07, K3)

Nur fiktive Inhalte. Testdateien: Arbeitsmappe `Haushalt-fiktiv.xlsx` (A1:B4: Position/Betrag,
Miete 1.200 €, Strom 85,50 €, Wasser `=20*2`) und Präsentation `Quartal-fiktiv.pptx` (Folie 1: Titel,
Textfeld „Umsatz Q3: 1,2 Mio. € (fiktiv)", ein Bild). Je Lauf festhalten: Datum, Host-App und
Version (aus der Kopfzeile „Umgebung" im Fenster), API-Stufe, Plattform, Kandidatenfassung
(Kopf `X-KW-Available-Version`), Bildschirmbelege.

| Lauf | Host | Schritte | Erwartung |
| --- | --- | --- | --- |
| E-Web | Excel im Web, **Chrome** | 1. Manifest hochladen. 2. B2:B4 markieren, „Auswahl lesen". 3. Frage stellen. 4. „Summe unter die Spalte setzen", „Jetzt schreiben". 5. **Speichern** (Autospeichern abwarten), Browsertab schließen, Datei **wieder öffnen**. 6. B5 prüfen. 7. Rücknahme an einer zweiten Kopie prüfen. | Kontextzeile `Excel · Haushalt-fiktiv.xlsx · Tabelle1 · B2:B4`; B5 = `=SUM(B2:B4)` mit 1325,5 nach Wiederöffnen; Fenster meldet „stimmt überein" |
| E-Mac | Excel für Mac | wie E-Web, Speichern mit ⌘S bzw. Autospeichern, Excel beenden, Datei wieder öffnen | wie E-Web |
| P-Web | PowerPoint im Web, Chrome | 1. Manifest hochladen. 2. Textfeld markieren, lesen. 3. Frage stellen. 4. „Antwort in das markierte Textfeld schreiben", „Jetzt schreiben". 5. Speichern, schließen, wieder öffnen. 6. Text und Position prüfen; Leseansicht und markiertes Bild auf den Ausweg prüfen. | Text ersetzt, Position unverändert, kein neues Objekt auf der Folie |
| P-Mac | PowerPoint für Mac | wie P-Web | wie P-Web |

Zusätzlich je Host einmal: geschütztes Blatt bzw. Leseansicht, Koautorenänderung (zweites Fenster),
Dokumentwechsel. **Nicht bestellte Erweiterungen bleiben offen** (Abschnitt 8).

### Bereitstellung auf diesem Mac (nur durch den Menschen am Rechner)

- **Excel für Mac:** Manifest in `~/Library/Containers/com.microsoft.Excel/Data/Documents/wef`
  kopieren (Ordner bei Bedarf anlegen), Excel neu starten; Klara unter **Start › Add-Ins**.
- **PowerPoint für Mac:** dasselbe unter `~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef`.
- **Web:** in Excel bzw. PowerPoint im Web **Add-Ins › Mein Add-In hochladen** und das jeweilige
  Manifest wählen (gilt für dieses Konto). Ob der Testmandant das Hochladen zulässt, zeigt erst der
  Lauf; bettet ein SharePoint-Mandant ein, muss er in `KLARWERK_M365_MANDANTEN` stehen.

Diese Schritte sind beschrieben, **nicht ausgeführt**. Keine zentrale Bereitstellung, keine
Installation auf fremden Rechnern.

## 7. Plattformen, Formate, Rechte (package:excel)

| Plattform | Excel | PowerPoint |
| --- | --- | --- |
| Mac (Desktop-App) | gebaut, **Hostlauf offen** | gebaut, **Hostlauf offen** |
| Web (Chrome) | gebaut, **Hostlauf offen** | gebaut, **Hostlauf offen** |
| Windows, iPad | nicht Teil dieses Auftrags; das Fenster meldet „nicht Teil der Abnahme" | ebenso |

- **Formate:** im Host jede Arbeitsmappe bzw. Präsentation, die Excel/PowerPoint selbst öffnen. Der
  vorhandene **Datei-Import** (`.xlsx`/`.csv` über die Import-Prüfliste, `.pptx` über Erfassen)
  bleibt unverändert und ist **keine Host-Integration**.
- **Rechte:** `ReadWriteDocument` im Manifest (Office kennt keine feinere Stufe); geschrieben wird
  nur nach zweitem Klick. In KLARWERK `ko.read` (Fragen) und `ko.create` (Entwurf).
- **API-Stufen zur Laufzeit:** ExcelApi 1.1 (Lesen/Schreiben), 1.2 (Blattschutz), 1.7 (Mappenname),
  1.9 (Mehrfachauswahl); PowerPointApi 1.2 (Folienliste), 1.4 (Text schreiben), 1.5 (Auswahl). Fehlt
  eine Stufe, nennt das Fenster sie und lässt den zugehörigen Knopf aus.

## 8. Abgrenzung, offene Punkte und Quellenlage (K9)

**Offen in diesem Auftrag:**

- **K1:** Pedis Bestätigung des Arbeitswegs (Abschnitt 2) liegt nicht vor.
- **KO-04-07 / K3:** die vier Hostläufe (Abschnitt 6) sind nicht gelaufen; ohne sie ist keine
  Plattform abgenommen.
- **K17:** Ben-Prüfung, reguläre Veröffentlichung, lokale Installation mit Version und Startpfad.
- Mehrsprachigkeit des Fensters: nur Deutsch (das Word-Fenster hat DE/EN/NL).
- Kein Leseweg für Notizen, Diagrammdaten, SmartArt in PowerPoint; keine Diagrammänderung in Excel.

**Gesonderte Aufträge (hier nicht gebaut):**

- Gemeinsamer Office-Hostkern `produkt:20261010:klara-office-gemeinsamer-kern` (KLARA-OFFICE-01):
  dieser Auftrag nutzt die vorhandenen Word-Bausteine; die Zusammenführung zu einem allgemeinen Kern
  gehört dorthin.
- Native Begleitfigur `produkt:20261010:klara-office-mac-maskottchen` (KLARA-OFFICE-02).
- **Outlook** (Zielzustand TEST-A12 „Excel und Outlook"): Outlook gehört zu KLARA-OFFICE-05; hier ist
  nur Excel bzw. PowerPoint gebaut.
- PowerPoint-Fachpaket PP-02 ff. (`docs/klara-powerpoint/BESTAND.md`) baut auf diesen Hosts auf.

**Quellenlage:** R-0187 wurde als geplante Funktion beworben; geliefert war bis hierher nur der
Datei-Import, keine Übernahme aus Excel heraus. K24 führte PowerPoint als ausgeschlossen; die jüngere
Nutzerentscheidung vom 10.10.2026 bestellt das PowerPoint-Add-in ausdrücklich. Ein jüngerer
Abschlussbeleg für eine frühere Excel- oder PowerPoint-Host-Integration liegt nicht vor.

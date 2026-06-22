# KLARWERK — Funktionsbeschreibung (Functional Specification)

*Version 1.0 · 14. Juni 2026. Fachliche Beschreibung aller Funktionen der Anwendung. Grundlage
für den Neubau. Die Beschreibung ist implementierungsneutral; Verweise auf die Referenz dienen
nur dem Verständnis.*

---

## 1. Zweck & Geltungsbereich

KLARWERK ist eine Web-Anwendung (Desktop „Control Room" + mobile, installierbare Ansicht) zur
**Erfassung, Strukturierung, Validierung, Pflege und Abfrage** von industriellem
Erfahrungswissen mithilfe einer argumentierenden, prüfbaren KI (Reasoner). Diese Beschreibung
deckt **alle** Funktionsbereiche ab.

## 2. Glossar

- **Wissensobjekt (KO):** kleinste geprüfte Wissenseinheit (Aussage + Bedingungen + Maßnahmen + Metadaten).
- **Wissensart (kind):** eine von fünf Kategorien (Bauchgefühl, Best Practice, Lernkurve, Technik, Negativwissen).
- **Kategorie (category):** frei vergebbare fachliche Einordnung (z. B. „Instandhaltung").
- **Trust-Score:** verdienter Vertrauenswert 0–99 %.
- **Validierung:** Peer-Bestätigung; ab konfigurierbarer Zahl gilt ein KO als „validiert".
- **Konflikt:** offengelegter Widerspruch zwischen Wissen; fünf Arten; nur Wahrheitskonflikte eskalieren.
- **Wissenslücke (gap):** Frage ohne belastbare Antwort, an Experten geroutet.
- **Bus-Faktor:** Risiko, dass nur eine Person ein Thema trägt.
- **Re-Validierung:** „Stimmt das noch?" nach Anlagen-/Prozessänderung.
- **Reasoner:** interne KI (modell-/anbieteragnostisch).
- **Entwurf (draft):** geparkte Roh-Erfassung vor der Strukturierung.

## 3. Akteure / Rollen

| Rolle | Beschreibung | Kernrechte |
|---|---|---|
| **Viewer** | Lesezugriff | Wissen lesen, fragen |
| **Experte (expert)** | erfasst & teilt Wissen | erfassen, kommentieren, eskalieren, importieren |
| **Controller** | Governance/Qualität | zusätzlich: bewerten, Konflikte auflösen |
| **Admin** | Systemverwaltung | zusätzlich: Nutzer/Freigaben/Rollen, Autor-Übergabe |

Die genaue Rechtematrix steht im Technischen Anhang §4. Anmeldung erfolgt per E-Mail+Passwort
(Referenz) bzw. SSO (gefordert, siehe Pflichtenheft).

---

## 4. Authentifizierung, Onboarding & Sitzungen

### 4.1 Ersteinrichtung
Beim ersten Aufruf einer leeren Instanz erkennt das System, dass **kein Nutzer** existiert, und
zeigt die **Ersteinrichtung**: Anlegen des ersten Kontos, das automatisch die **Admin-Rolle**
erhält.

### 4.2 Selbstregistrierung mit Admin-Freigabe
Neue Nutzer registrieren sich (Name, E-Mail, Passwort, min. 8 Zeichen). Das Konto wird **gesperrt
angelegt** (Status „wartet auf Freigabe"). Bis zur Freigabe sieht der Nutzer nur einen
Hinweis-Bildschirm. Ein Admin gibt das Konto im Admin-Bereich frei; erst danach ist Login
möglich. (Missbrauchsschutz.)

### 4.3 Login / Logout
Anmeldung per E-Mail+Passwort. Falsche Daten und nicht freigegebene Konten werden mit klaren,
nicht-verräterischen Meldungen abgewiesen. Sitzung über sicheres, langlebiges Sitzungs-Token
(Referenz: HttpOnly-Cookie, 14 Tage). Logout beendet die Sitzung serverseitig.

### 4.4 Passwort-Reset
Der Admin kann das Passwort eines Nutzers zurücksetzen; bestehende Sitzungen dieses Nutzers
werden dadurch beendet. (Self-Service-Reset per E-Mail ist Erweiterung, siehe Pflichtenheft.)

---

## 5. Wissenserfassung (Capture)

Erfassen ist bewusst **niederschwellig** und in mehreren Modi möglich. Die KI übernimmt die
Strukturierungsarbeit; der Experte spricht/tippt und bestätigt.

### 5.1 Erfassungsmodi
1. **Freitext** — natürliche Beschreibung in einem Textfeld.
2. **Geführtes Formular** — Felder Symptom / Kontext / Diagnose & Maßnahme / Risiko.
3. **Diktat** — Live-Spracherkennung; gesprochenes erscheint sofort als Text. (Plattformhinweis:
   Auf iOS wird die native Tastatur-Mikrofontaste genutzt; siehe Mobile §13.)
4. **KI-Interview** — der Reasoner stellt als „erfahrener Redakteur" **eine gezielte Frage nach
   der anderen**, spiegelt das Verstandene und bohrt nach Bedingungen, Schwellen, Ausnahmen.
   Abschluss, wenn genug für ein solides KO vorliegt.

### 5.2 Anhänge
- **Fotos**: aus der Kamera **oder** aus der Mediathek/Bibliothek; werden als Thumbnails
  angezeigt, einzeln entfernbar; lassen sich später frei im Dokument platzieren.
- **Dokumente**: txt, md, pdf, docx, Bilder; Bilder mit **Auto-OCR**; dienen als
  Hintergrundkontext für Strukturierung und Interview.

### 5.3 Entwürfe (Drafts)
Jede Erfassung kann als **Entwurf geparkt** werden (z. B. mobil aufgenommen, später am Rechner
fertiggestellt). Entwürfe sind ein **gemeinsamer Pool**: alle Schreibberechtigten sehen sie,
mit Anzeige des **Autors**. Beim Fortsetzen bleibt der **ursprüngliche Autor** erhalten (das
strukturierte KO wird ihm zugeschrieben, nicht dem, der es fertigstellt). Entwürfe lassen sich
fortsetzen, als Entwurf erneut speichern, verwerfen (Eingabe leeren, Entwurf bleibt) oder
**mit Bestätigung löschen**.

### 5.4 Metadaten bei der Erstellung
- **Domäne** (fachlicher Bereich, z. B. „Instandhaltung · Antriebe").
- **Kategorie** (frei, mit Vorschlagsliste).
- **#Tags** (frei, mit Vorschlägen).
- **Nötige Validierungen** (1–5; Standard 3) — wie viele Bestätigungen „vollständig validiert" bedeuten.
- **Autor** (in der Referenz der eingeloggte Nutzer; Controller können stellvertretend erfassen).

---

## 6. Strukturierung (Reasoner → Wissensobjekt)

Aus der Roh-Eingabe erzeugt der Reasoner ein **strukturiertes Wissensobjekt** mit: Titel (als
Aussage, keine Warum-Frage), Domäne, Aussage, Bedingungen (Wenn), Maßnahmen (Dann), Tags,
Konfidenz, Wissensart. Das Ergebnis wird als **bearbeitbare WYSIWYG-Wissensseite** dargestellt
(„Confluence-Stil"): Überschriften, Listen, Hervorhebungen, Info-/Hinweis-/Warn-/Erfolg-Panels,
Links, **Bilder und Datei-Anhänge** (Button, Drag&Drop, Einfügen). Angehängte Fotos erscheinen
als Palette und lassen sich per Klick an der Cursorposition einfügen.

Eine **KI-Schreibhilfe** im Editor bietet Aktionen: klarer formulieren, strukturieren,
erweitern (fehlende Bedingungen/Grenzwerte/Negativwissen vorschlagen), Rechtschreibung; Ergebnis
übernehmen oder einfügen.

Vor dem Einreichen sind **Vorschau** und **Bearbeiten** umschaltbar (der zuletzt bearbeitete
Stand bleibt erhalten). Mit „Zur Validierung einreichen" wird das KO mit Status „offen"
angelegt; ein verbundener Entwurf wird entfernt.

---

## 7. Das Wissensobjekt (Datensicht)

Ein KO trägt u. a.: `id`, `title`, `kind` (Wissensart), `category`, `domain`, `statement`,
`conditions[]`, `actions[]`, `tags[]`, `confidence`, `status`, `trust`, `needed`,
`ratings{green,amber,red}`, `version`, `history[]`, `author`, `originalAuthor`, `role`,
`sources[]`, `comments[]`, `conflict|null`, `assignments[]`, `external|null`, `helped`,
`asset|null`, `revalidate|null`, `page` (WYSIWYG-HTML), `photos[]`, `createdAt`. Vollständige
Definition im Technischen Anhang §1.

### 7.1 Fünf Wissensarten
💡 Bauchgefühl erklärt · 🏛 Best Practice · 📈 Lernkurve/Evolution · 🔧 Technik · ⛔ Negativwissen.

---

## 8. Validierung (Peer-Review)

### 8.1 Bewertung & Status
Berechtigte (Controller) bewerten ein KO mit **✅ validieren / ⚠️ Prüfbedarf / ❌ ablehnen**.
Daraus leitet das System **Status** und **Trust** ab (Formeln im Technischen Anhang §3):
- `pending` (keine Bewertung) → `review` → `validated` (≥ *needed* grüne, keine rote) bzw.
  `rejected` (mehr rote als grüne).
- Jede Statusänderung erzeugt einen **History-Eintrag**.

### 8.2 Validation Board (Arbeits-Posteingang)
Listet die **offenen** Beiträge (vollständig validierte verschwinden und leben in der
Bibliothek). Funktionen: Status-Filter (Offen/Prüfung/Abgelehnt + „Mir zugewiesen"),
**Volltextsuche**, **Domäne**-, **Kategorie**-, **Tag**-Filter (Parität zur Bibliothek);
Fortschrittsanzeige je Karte (`grün/needed`); Kennzeichnung von Konflikten; Klick öffnet die
Beitragsseite. Kennzahlen: Offen, in Prüfung, Pending, Konflikte.

### 8.3 Zuweisung zur Validierung
Ein Beitrag kann einer oder mehreren Personen **zur Validierung zugewiesen** werden. Die
Zugewiesenen erhalten eine **In-App-Benachrichtigung** (Badge am Navigationspunkt +
„Mir zugewiesen"-Filter). Eine Bewertung durch die zugewiesene Person erfüllt die Aufgabe
(Status der Zuweisung: pending → done). Fortschritt erscheint in Analytics und im
Management-/Admin-Konto (wer hat erledigt, wer nicht). *Hinweis:* echte E-Mail-/Push-Zustellung
ist gefordert (Pflichtenheft), heute nur In-App.

---

## 9. Konflikte

### 9.1 Erkennung & Klassifizierung
Widerspricht neues/abweichendes Wissen dem Bestand, wird ein **Konflikt** erzeugt und einer von
fünf Arten zugeordnet: **Truth (Wahrheit)**, **Experience**, **Context**, **Temporal**, **Role**.
Jede Art hat eine Trust-Wirkung; **nur Truth eskaliert** an einen Menschen (Technischer Anhang §3).

### 9.2 Auflösung
Ablauf bei Wahrheitskonflikt: **Eskalieren → unabhängige Zweitmeinung** anfordern (vom Reasoner
oder einem benannten Experten) → **Controller entscheidet** → Konflikt gelöst, Trust erholt sich.

### 9.3 Konflikt-Seite
Eine eigene Ansicht **„Beiträge mit Konflikten"** listet alle KOs mit **ungelöstem** Konflikt —
unabhängig vom Status, also auch noch in Validierung befindliche — mit Konfliktkarte (Art,
Beteiligte, Beschreibung) und Link zur Klärung. Sidebar zeigt ein **rotes Badge** mit der Zahl
offener Konflikte.

---

## 10. Abfrage (Ask / Query Interface)

Nutzer stellen eine Frage in natürlicher Sprache. Der Reasoner:
1. wählt **semantisch** das relevanteste Wissensobjekt (mit Keyword-Fallback),
2. erzeugt eine **begründete Antwort** mit **Trust-Score**, **Quelle(n)**, **Argumentationsschritten**
   und ggf. Konflikt-Hinweis,
3. **verweigert ehrlich** die Antwort, wenn keine belastbare Grundlage existiert, und legt die
   Frage als **Wissenslücke** ab.

Zur Antwort: **„Hat geholfen"** bestätigt die Bewährung (erhöht Trust leicht, Audit-Eintrag).
Externe Referenzen werden separat und als „nicht peer-validiert" gekennzeichnet.

---

## 11. Wissenslücken, Risiko & Wissensgraph

- **Wissenslücken** sammeln unbeantwortete Fragen; ein Experte kann zugewiesen werden, die
  Lücke wird geschlossen, wenn das Wissen erfasst ist. Löschen mit Bestätigung.
- **Risiko & Lücken** zeigt zusätzlich den **Bus-Faktor**: Domänen, die nur eine Person trägt.
- **Wissensgraph** visualisiert Zusammenhänge zwischen Maschinen/Themen, Symptomen und Experten.

---

## 12. Bibliothek, Analytics, Audit

### 12.1 Bibliothek (Library)
Gesamtbestand mit **Suche** (Titel/Aussage/Tags/Autor), optionaler **KI-Suche** (semantisch),
Filtern (Domäne, Status, Kategorie, Tags), Karten mit Status/Trust/Bewährung/Version.
**Export** der aktuellen Auswahl als **JSON**, **MediaWiki**, **PDF**; **Import** per JSON
(Zusammenführung per id/Titel, ohne Duplikate). Kategorie/Zuweisung je Karte bearbeitbar.

### 12.2 Analytics
Auswertungen u. a.: Bestände nach Status/Art, **Validierungs-Aufgaben pro Person** (offen/erledigt),
Verteilung nach **Kategorie**. (Erweiterbar um Wirkungs-Kennzahlen, siehe Pflichtenheft.)

### 12.3 Audit-Log
**Lückenlose** Protokollierung jeder relevanten Aktion (Erfassen, Validieren, Ablehnen,
Kommentieren, Konflikt, Eskalation, Auflösung, Zuweisung, Kategorie, Re-Validierung, „Hat
geholfen", Export/Import, Login/Logout, Nutzerverwaltung, Autor-Übergabe) mit **wer, was, wann**.

---

## 13. Mobile App / PWA

Eine mobil-optimierte Ansicht, **als App auf dem Smartphone installierbar** (PWA, „Zum
Home-Bildschirm"; Vollbild, Icon, Offline-Start des App-Shells; Daten live gegen den Server).
Tabs: **Aufnehmen**, **Fragen**, **Entwürfe**, **Wissen**.

- **Aufnehmen**: Umschalter **Notiz | Interview**. Notiz: Diktat/Tippen, Fotos (Kamera/Mediathek);
  Interview: KI-Redakteur, Antworten per Tippen/Diktat. Primäraktion **„Als Entwurf speichern"**,
  Sekundäraktion „Direkt veröffentlichen".
- **Fragen**: wie Query Interface in kompakt, inkl. „Hat geholfen".
- **Entwürfe**: gemeinsamer Pool; Löschen mit **In-App-Bestätigung** (keine nativen Dialoge).
- **Wissen**: Liste/Detail der Wissensobjekte.

Plattformhinweis: Diktat nutzt auf iOS die **native Tastatur-Mikrofontaste** (die Web-Speech-API
ist dort unzuverlässig); ein Sicherungs-Timeout verhindert „hängende" Aufnahmen.

---

## 14. Wissenslebenszyklus

- **Versionierung & Historie**: jede Revision/Statusänderung erzeugt einen History-Eintrag;
  beim Überarbeiten werden Bewertungen zurückgesetzt, ältere Kommentare der Vorversion zugeordnet.
- **Re-Validierung**: KOs können an **Anlagen/Prozesse** gekoppelt sein; bei Änderung werden sie
  „Stimmt das noch?" markiert; Bestätigen erzeugt einen Versions-Eintrag.
- **Autor-Übergabe (Admin)**: Auf der Beitragsseite kann der Admin die **Autorschaft** an einen
  anderen Autor übergeben (z. B. wenn der Originalautor ausscheidet). Der **Originalautor bleibt
  in der Fußnote** vermerkt.
- **Lernpfade**: rollenspezifische Einarbeitungspfade mit Abhaken (Konsum-/Onboarding-Seite).
- **Vermächtnis-Framing**: Wissen trägt sichtbar den **Namen** des Beitragenden.

---

## 15. Der Reasoner (KI)

Der Reasoner ist eine **gekapselte, austauschbare** Schicht mit den Aufgaben: **Strukturieren**
(Roh→KO), **Beantworten** (Frage→begründete Antwort), **Interview** (Redakteur-Dialog),
**semantische Suche/Auswahl**, **Zweitmeinung** bei Konflikten, **Schreibhilfe** im Editor.

- **Modell-/anbieteragnostisch**: das konkrete Modell (Frontier-API, Enterprise-Endpunkt,
  Open-Weight on-prem) ist konfigurierbar und austauschbar.
- **Anti-Halluzination**: nie raten; klar trennen zwischen gesichert / ungeprüft / Expertenmeinung
  / extern / Annahme; Unwissen benennen.
- **Fallback**: ohne konfiguriertes Modell ein **deterministischer Ersatz** (System bleibt
  bedienbar, Antworten als „Demo/Platzhalter" erkennbar).
- **Statusanzeige**: die Oberfläche zeigt **server-echt**, ob der Reasoner aktiv ist.
- **Datenfluss** abhängig vom Deployment-Modell (Technischer Anhang §5): nur **On-Premises**
  verlässt nichts das Haus; bei Cloud/Private AI Verarbeitung durch externen Anbieter unter
  Enterprise-Bedingungen (kein Training auf Kundendaten).

---

## 16. Internationalisierung

Vollständig **zweisprachig DE/EN** mit Umschalter; Antworten/Interviews in der gewählten Sprache.
Architektur soll **weitere Sprachen** zulassen.

---

## 17. Querschnittsverhalten

- **Bestätigungen** vor destruktiven Aktionen (Löschen von KO, Entwurf, Lücke, Nutzer); im
  Mobile als In-App-Dialog (keine nativen Dialoge).
- **Optimistische UI** mit Server als Quelle der Wahrheit; **automatische Aktualisierung**
  geteilter Stände.
- **Rollenabhängige Sichtbarkeit** von Aktionen.

---

## 18. Strategische Erweiterungen: Import, Output, Priorisierung

> Status: in Demo und App als interaktive Screens umgesetzt; die produktive Backend-Pipeline
> (Extraktion/Parser) ist priorisierte Roadmap. Klar als „Demo/Konzept" gekennzeichnet.

### 18.1 Knowledge Import (`/classic/import`)
- Importiert vorhandenes Firmenwissen aus mind.: Schulungsvideo, Bedienungsanleitung,
  Arbeitsanweisung/SOP, Servicebericht, Excel-Liste, Wiki/SharePoint, PDF/Word, Foto.
- **Pipeline:** Upload → Extrahieren → Strukturieren → Validieren → Freigeben → Wiederverwenden.
- Erzeugt **Wissensobjekt-Kandidaten** statt eines Datei-Dumps; erkennt mögliche **Konflikte**,
  **fehlende Informationen**, **veraltete** Inhalte, **Dubletten** und **IP-/Security-Risiken**.
- Importiertes Objekt ist initial `unvalidated/imported/draft`, wird Experten/Controllern zur
  Prüfung zugewiesen; Originalquelle bleibt verlinkt.
- **Import-Dashboard:** importierte Quellen, extrahierte Objekte, Validierungsbedarf, Konflikte,
  Wissenslücken, potenziell kritisches IP, geschätzte Zeitersparnis.

### 18.2 Output Factory (`/classic/output`)
- Erzeugt aus **validiertem/freigegebenem** Wissen nutzbare Inhalte: Arbeitsanweisung, SOP,
  Checkliste, Schulung, FAQ, Troubleshooting-Guide, Onboarding, Management Summary u. a.
- **Pflichtangaben je Output:** Quelle, Trust-Score, Validierungsstatus, Version,
  Gültigkeitsbereich/-datum, verantwortliche Rolle, Datum der letzten Validierung, offene
  Unsicherheiten; Kennzeichnung, wenn nicht vollständig validiert.
- Export-Formate (Roadmap): PDF, Word, PowerPoint, Wiki-Seite.

### 18.3 Wissens-Priorisierung (`/classic/prioritizer`)
- Zeigt fehlendes/veraltetes/personenabhängiges Wissen und ordnet nach Dringlichkeit.
- **Prioritäts-Score** aus neun Faktoren: Bus-Faktor, Kritikalität, Prozessnähe, Wissensalter,
  Quellenqualität, Konfliktdichte, Wiederholhäufigkeit, Schadenspotenzial, IP-Wert.
- Filter (Alle / Bus-Faktor 1 / Veraltet / Hoher IP-Wert); je Eintrag Risiko/Kosten-Framing,
  empfohlene Maßnahme und Faktor-Detail.

### 18.4 Wissensobjekt — neue Felder (Konzept)
`source_type`, `source_reference`, `source_excerpt`, `source_confidence`, `import_batch_id`,
`import_status`, `extraction_notes`, `validation_required_by`, `validity_until`,
`freshness_status`, `ip_sensitivity`, `security_classification`, `business_process`,
`related_asset`, `related_customer_case`, `output_eligible`, `generated_outputs`,
`last_output_generation_date`.

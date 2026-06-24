# KLARWERK — Anforderungsbeschreibung Frontend (Live-App)

> Zweck dieses Dokuments: vollständige, gestaltungs­neutrale Beschreibung dessen, **was** das KLARWERK-Frontend leisten muss. Grundlage für ein nachgelagertes UI/UX-Konzept. Es schreibt **keine** konkrete Optik, Layout oder Komponenten vor — es definiert Rollen, Bereiche, Abläufe, Zustände und Randbedingungen, gegen die ein Designer das Konzept entwickeln kann.
>
> Stand: 24.06.2026 · Quelle: Bestands-App, Live-App-Spezifikation, Funktions-Checkliste, Jira (Epic SCRUM-97 + Domänen-Tickets). Backend ist live (alle Modul-APIs vorhanden), das Frontend wird neu gebaut.

---

## 1. Kontext und Kern-Herausforderung

KLARWERK ist eine Plattform zur **Kontinuität industriellen Erfahrungswissens**: Erfahrungswissen von Experten wird erfasst, strukturiert, von Kollegen validiert, bei Bedarf in Konflikten geklärt, später abgefragt und über die Zeit gepflegt. Eine austauschbare KI-Schicht („Reasoner") unterstützt beim Strukturieren und Beantworten, entscheidet aber nie selbst über Wahrheit.

Die zentrale Herausforderung für das Frontend: **hohe fachliche Komplexität und sehr viele Funktionen** (rund 17 Funktionsbereiche, vier Rollen, mehrere Objekt-Lebenszyklen, Desktop und Mobil) müssen so integriert werden, dass die Anwendung für nicht-technische Fachanwender (Werker, Meister, Ingenieure) **bedienbar und verständlich** bleibt. Das Frontend muss Komplexität führen, nicht abbilden: Jeder Anwender soll zu jedem Zeitpunkt nur das sehen und tun können, was seiner Rolle und seiner aktuellen Aufgabe entspricht.

Dieses Dokument beschreibt die Anforderungen; die Lösung dieser Herausforderung (Navigationsmodell, Reduktion, Screen-Aufteilung) ist Gegenstand des UI/UX-Konzepts.

---

## 2. Produktgrundsätze (verbindliche Leitplanken)

Diese Grundsätze sind keine Designvorschläge, sondern fachliche Pflichten, die jede Oberfläche einhalten muss:

- **G-1 Vertrauen = Evidenz, nicht Wahrheit.** Jede Wissensaussage trägt einen nachvollziehbaren Vertrauens-/Reifegrad, abgeleitet aus Validierung und Nutzung. Das Frontend muss diesen Grad überall sichtbar machen, wo eine Aussage angezeigt oder verwendet wird.
- **G-2 Keine erfundenen Antworten.** Wo keine belastbare Grundlage existiert, darf das Frontend keine Antwort vortäuschen. Stattdessen wird Unwissen offen benannt und der Weg zur Wissenslücke angeboten.
- **G-3 KI ist Hilfsmittel, nicht Autorität.** Inhalte aus dem Reasoner müssen klar als Entwurf/Empfehlung erkennbar sein und sich visuell und sprachlich von validiertem Wissen unterscheiden. Der Mensch bestätigt, korrigiert oder verwirft.
- **G-4 Herkunft bleibt sichtbar.** Autorschaft, Quelle, Version, Status und Gültigkeit eines Wissensobjekts sind an jeder Darstellung und an jedem erzeugten Output nachvollziehbar. Der Originalautor geht nie verloren.
- **G-5 Kein stilles Überschreiben.** Widersprüche werden als Konflikt sichtbar gemacht und geführt aufgelöst — niemals durch unbemerktes Ersetzen.
- **G-6 Rollen bestimmen Sicht und Handlung.** Was ein Nutzer sieht und tun kann, richtet sich strikt nach seiner Rolle (Abschnitt 3). Unerlaubtes ist nicht nur ausgeblendet, sondern serverseitig abgesichert; das Frontend zeigt es gar nicht erst an.
- **G-7 Sicherheit im Client.** Keine Geheimnisse (insb. KI-Schlüssel) im Frontend-Bundle. Alle KI-/Mailaufrufe laufen serverseitig.
- **G-8 Zweisprachigkeit.** Die gesamte Oberfläche inkl. KI-Antworten und geführter Interviews muss vollständig in Deutsch und Englisch funktionieren, mit Umschaltung.
- **G-9 Desktop und Mobil.** Vollwertige Desktop-Nutzung (stationäre Wissensarbeit) und mobile Nutzung (Erfassung an der Anlage) sind beide Pflicht — mit unterschiedlichen Schwerpunkten (Abschnitt 4).
- **G-10 Nachvollziehbarkeit.** Sicherheits- und wissensrelevante Aktionen sind protokolliert; das Audit ist einsehbar, aber unveränderlich.

---

## 3. Nutzerrollen und Berechtigungen

Das Frontend muss vier Rollen unterscheiden. Jede höhere Rolle schließt die Rechte der niedrigeren ein. Maßgeblich ist die serverseitige Rechtematrix; das Frontend bildet sie ab.

- **R-Viewer (Betrachter/Leser).** Darf Wissen suchen, lesen, Fragen stellen, Antworten als hilfreich markieren. Keine Erstellung, keine Validierung, keine Verwaltung.
- **R-Experte.** Zusätzlich: Wissen erfassen und strukturieren, Entwürfe bearbeiten und einreichen, eigene Objekte pflegen, an Validierung/Konfliktklärung als Beitragender teilnehmen, zugewiesene Aufgaben bearbeiten.
- **R-Controller (Prüfer/Validierer).** Zusätzlich: Validierungsaufgaben zuweisen und bewerten, Status setzen, Konflikte klassifizieren und auflösen, Re-Validierungen anstoßen.
- **R-Admin.** Zusätzlich: Nutzerverwaltung (anlegen, freigeben, Rolle ändern, Passwort zurücksetzen, löschen), Autorenübergabe, Audit-Einsicht, Systemeinstellungen.

Anforderungen:
- **RB-1** Die Navigation und alle Aktionsmöglichkeiten müssen sich rollenabhängig zusammensetzen; nicht erlaubte Bereiche/Aktionen erscheinen nicht.
- **RB-2** Bei direktem Aufruf einer nicht erlaubten Funktion (z. B. per Deep-Link) muss das Frontend dies sauber abfangen und verständlich abweisen.
- **RB-3** Rollen können sich im Verlauf ändern (Admin vergibt Rechte); die Oberfläche muss eine Rollenänderung ohne Neuaufbau des mentalen Modells verkraften.
- **RB-4** Ein Admin darf sich nicht selbst die Admin-Rechte entziehen; das Frontend muss diesen Fall verständlich verhindern bzw. die serverseitige Abweisung erklären.

---

## 4. Plattform- und Geräteanforderungen

- **P-1 Desktop („Control Room").** Primärer Arbeitsplatz für Strukturieren, Validieren, Konfliktklärung, Analyse, Verwaltung. Muss große Informationsmengen, Listen, Filter und parallele Aufgaben handhaben.
- **P-2 Mobil / PWA.** Installierbar (Start vom Home-Bildschirm, eigenes Icon, Offline-Start), optimiert für **Erfassung an der Anlage**: schnelles Festhalten von Wissen (Notiz, Diktat, Foto), Fragen stellen, Entwürfe fortsetzen, Wissen nachschlagen. Die dominante mobile Aktion ist das Festhalten eines Entwurfs.
- **P-3 Durchgängigkeit.** Ein mobil begonnener Entwurf muss am Desktop fortsetzbar sein und umgekehrt (gemeinsamer Entwurfs-Pool, Abschnitt 7.3).
- **P-4 Mobile Bestätigung.** Destruktive Aktionen (z. B. Löschen) verlangen mobil eine app-eigene Inline-Bestätigung statt eines nativen Dialogs.
- **P-5 Offline-Verhalten (Stufe 2).** Mobil ohne Netz erfasste Entwürfe werden zwischengespeichert und synchronisieren bei Wiederverbindung; der Zustand (offen/synchronisiert) muss erkennbar sein.

---

## 5. Übergreifende (bereichsunabhängige) Anforderungen

- **U-1 Rollenabhängige Navigation** zwischen allen erlaubten Bereichen, inkl. Kennzeichnung offener Aufgaben (z. B. Anzahl offener Validierungen/Konflikte für die eigene Rolle).
- **U-2 Globale Suche / schneller Sprung** zu Wissensobjekten und Funktionen.
- **U-3 Benachrichtigungen** für relevante Ereignisse (Zuweisung, Eskalation, Rückgabe eines Objekts) — in der App sichtbar; außerhalb der App per E-Mail (Backend vorhanden).
- **U-4 In-App-Hilfe**, durchsuchbar, zweisprachig, kontextnah.
- **U-5 Sprachumschaltung** DE/EN jederzeit erreichbar.
- **U-6 Sitzungs-/Login-Status** sichtbar; Logout beendet die Sitzung serverseitig (danach kein Zugriff mit altem Token).
- **U-7 Eigenes Profil** einsehbar/bearbeitbar.
- **U-8 Konsistente Statuserkennung.** Reaktionszustände (lädt, gespeichert, Fehler, KI nicht verfügbar) müssen einheitlich und ehrlich angezeigt werden — eine angezeigte „aktiv/offline"-Information muss der tatsächlichen Server-Verfügbarkeit entsprechen, nicht simuliert sein.
- **U-9 Fehlertoleranz.** Fehler (Netz, Berechtigung, Validierung von Eingaben) werden verständlich erklärt; kein Datenverlust bei Bedienfehlern oder Ansichtswechsel.

---

## 6. Datenobjekte aus Anwendersicht (was die Oberfläche abbilden muss)

Das Frontend muss folgende Objekte und ihre Felder/Zustände nachvollziehbar darstellen und bearbeitbar machen (soweit die Rolle es erlaubt):

- **Wissensobjekt (WO).** Kern des Systems. Mindestens: Titel als Kernaussage, ausführliche Aussage, Bedingungen/Kontext, empfohlene Maßnahmen, Wissensart, Domäne/Bereich, Anlagen-/Asset-Bezug, Kategorie und #Tags, Quellen/Anhänge, Status, Vertrauens-/Reifegrad, Autor und Originalautor, Version und Historie, Gültigkeit/Re-Validierungsbedarf, benötigte Validierungen.
- **Wissensarten (fünf).** Bauchgefühl/Intuition, Best Practice, Lernkurve/Evolution, Technik, Negativwissen (was *nicht* funktioniert). Müssen setz- und filterbar und visuell unterscheidbar sein.
- **Entwurf.** Vorstufe eines WO; bearbeitbar, teilbar im Team, fortsetzbar über Geräte.
- **Validierungsaufgabe.** Einem Prüfer zugewiesen; Status offen/erledigt; mündet in Bewertung.
- **Konflikt.** Widerspruch zwischen Aussagen; mit Konfliktart, Beschreibung, beteiligten Positionen/Quellen, Status, Auflösung.
- **Wissenslücke.** Offene, unbeantwortete Frage/fehlendes Wissen; zuweisbar, priorisierbar, schließbar.
- **Importkandidat (Stufe 2).** Aus Dokumenten extrahierter Vorschlag mit Quelle und Review-Status.
- **Nutzer.** Name, Rolle, Freigabestatus.
- **Audit-Eintrag.** Wer/was/wann; unveränderlich.

---

## 7. Funktionsbereiche (Detail-Anforderungen)

Die folgenden 17 Bereiche entsprechen den Frontend-Domänen in Jira (SCRUM-98–114). Pro Bereich: Zweck, was der Anwender tun können muss, relevante Zustände/Regeln und Stufen-Hinweis (Stufe 1 = Kern für Erstrelease, Stufe 2 = erweitert).

### 7.1 Foundation (Grundgerüst)
**Zweck:** durchgängiges Bedien- und Orientierungsgerüst.
**Anforderungen:** rollenabhängige Navigation; schneller Funktions-/Objektsprung; Benachrichtigungsbereich; durchsuchbare zweisprachige Hilfe; Sprachumschalter; konsistentes Sitzungs-/Statusverhalten (optimistische Aktualisierung mit Abgleich). Einheitliche Bausteine, damit alle Bereiche gleich bedient werden. *(Stufe 1)*

### 7.2 Auth & Onboarding
**Zweck:** sicherer, geführter Erstzugang.
**Anforderungen:** Ersteinrichtung — das erste angelegte Konto wird Admin (Setup-Maske bei leerer Instanz); Selbstregistrierung (Name, E-Mail, Passwort ≥ 8 Zeichen); „wartet auf Freigabe"-Hinweis, solange ein Admin den Zugang nicht freigeschaltet hat; Login/Logout mit klarer Abweisung falscher oder nicht freigegebener Anmeldungen; eigenes Profil. Stufe 2: Self-Service-Passwort-Reset per E-Mail; SSO/OIDC-Login mit Rollen-Mapping. *(Kern Stufe 1; Reset/SSO Stufe 2)*

### 7.3 Capture / Expert Studio (Erfassung)
**Zweck:** Erfahrungswissen so niedrigschwellig wie möglich festhalten.
**Anforderungen:** mehrere Erfassungsmodi — Freitext, strukturiertes Formular, Diktat/Spracheingabe (iOS-robust, mit Tastatur-Fallback), geführtes Wissens-Interview (eine Frage pro Schritt, nach wenigen Antworten liegt ein strukturierbares Objekt vor); Anhänge/Fotos aus Kamera oder Mediathek (Vorschau, entfernbar); Dokument-Upload mit Textextraktion/OCR (txt/md/pdf/docx/Bild), deren Text in Strukturierung/Interview einfließt; Metadaten setzen (Domäne, Anlage/Asset, Kategorie, Tags, Anzahl nötiger Validierungen); Entwurf speichern und geräteübergreifend fortsetzen; strukturiertes Ergebnis vor dem Einreichen prüfen und korrigieren; der Originalautor bleibt am Objekt erhalten, auch wenn ein anderer es bearbeitet. Anhänge benötigen serverseitigen Objektspeicher (Backend-Lücke). *(Kern Stufe 1; Foto/Objektspeicher Stufe 2)*

### 7.4 Reasoner-Assistenz (eingebettet)
**Zweck:** KI-Unterstützung beim Strukturieren und Vervollständigen — als Hilfsmittel.
**Anforderungen:** Strukturierung von Rohtext zu einem Wissensobjekt (Aussage, Bedingungen, Maßnahmen, Tags, Konfidenz, Wissensart); Interview-Rückfragen zur Vervollständigung; klare Kennzeichnung „Entwurf/Empfehlung" vs. „validiert" (Grundsatz G-3); ehrliche Verfügbarkeitsanzeige des Reasoners; ohne KI laufen alle Seiten weiter, ersatzweise Antworten sind als solche erkennbar. Textverbesserung/Präzisierung als Stufe 2. *(Kern Stufe 1; Schreibhilfe Stufe 2)*

### 7.5 Wissensobjekt-Detail / Wiki
**Zweck:** vollständige, lesbare Darstellung und Pflege eines Objekts.
**Anforderungen:** vollständige Anzeige aller Felder (Aussage, Bedingungen, Maßnahmen, Tags, Quellen, Asset, Status, Vertrauen, Autor/Originalautor, Version); wiki-/seitenartige Struktur; inline bzw. geführte Bearbeitung; Versionierung mit Historie (eine Revision erhöht die Version, setzt Bewertungen zurück, erzeugt einen Historieneintrag); die fünf Wissensarten sichtbar; Objekt-Aktionen je nach Rolle (validieren, kommentieren, Beitrag leisten, Quelle ergänzen, Konflikt melden, „hat geholfen", „noch gültig"). Externe Quelle anhängen (als „nicht peer-validiert" markiert) Stufe 2. *(Kern Stufe 1)*

### 7.6 Validierung / Review (Validation Board)
**Zweck:** Qualitätssicherung durch Kollegen.
**Anforderungen:** Arbeitsliste der offenen Objekte; kombinierbare Filter (Status, Volltext, Domäne, Kategorie, Tags, „mir zugewiesen"); Peer-Bewertung (grün/gelb/rot) mit Wirkung auf Status und Vertrauen gemäß hinterlegter Formel; Statusübergänge offen→in Prüfung→validiert/abgelehnt; ab konfigurierter Zahl grüner und null roter Bewertungen gilt ein Objekt als validiert; Zuweisung an Prüfer mit Benachrichtigung und Badge; Revisions-Schleife (Rückgabe an Autor mit Kommentaren); validierte Objekte verschwinden aus dem Board, bleiben aber in der Bibliothek; ein validiertes Objekt kann sichtbar in „erneut in Prüfung" zurückkehren. Zuweisungsstatus pro Person sichtbar (offen/erledigt). *(Kern Stufe 1)*

### 7.7 Konflikte (Conflict Board)
**Zweck:** Widersprüche kontrolliert klären, ohne Wissen zu verlieren.
**Anforderungen:** Board aller ungelösten Konflikte (jeder Status) mit korrektem Badge-Zähler; Gegenüberstellung der widersprüchlichen Positionen samt Quellen; Klassifikation der Konfliktart (Kontext, Zeit, Rolle, Erfahrung, Wahrheit); **nur** Wahrheitskonflikte lösen zwingend den menschlichen Eskalationspfad aus; Ablauf Eskalation → Zweitmeinung → Controller-Entscheidung → gelöst; sichtbare Wirkung der Auflösung auf Status und Vertrauen (Vertrauen erholt sich nach Klärung); kein stilles Überschreiben (G-5). *(Kern Stufe 1)*

### 7.8 Ask / Query Console (Fragen)
**Zweck:** betriebliche Fragen aus validiertem Wissen beantworten.
**Anforderungen:** Frage stellen; relevante Wissensobjekte werden herangezogen (semantisch, mit Stichwort-Rückfall — sinngemäße Fragen finden das Objekt trotz anderer Worte); Antwort mit Quellen, Argumentationsschritten, Vertrauens-/Evidenzlevel und ggf. Konflikt-/Unsicherheitshinweis; bei fehlender Grundlage **keine** erfundene Antwort, sondern Anlegen einer Wissenslücke (G-2); Rückmeldung „hat geholfen" erhöht Vertrauen leicht und erzeugt einen Audit-Eintrag; optional Belegstelle/Snippet der Quelle. Lücken-Anlage benötigt die gaps-API (Backend-Lücke). *(Kern Stufe 1)*

### 7.9 Risiko / Wissenslücken / Wissensgraph
**Zweck:** Wissensrisiken und Lücken sichtbar machen und steuern.
**Anforderungen:** Übersicht offener Wissenslücken; Lücke zuweisen, priorisieren, schließen, mit Bestätigung löschen; Bus-Faktor/Einzelquellen-Risiko sichtbar (Domänen, die von einer einzigen Person abhängen); Risiko-Cockpit nach Bereichen/Domänen. Wissensgraph (Relationen zwischen Objekten/Domänen/Experten) als visuelle Sicht Stufe 2. Benötigt gaps-API und Graph-Daten (Backend-Lücken). *(Lücken Stufe 1, sobald gaps-API steht; Graph Stufe 2)*

### 7.10 Bibliothek / Export / Re-Import
**Zweck:** das gesicherte Wissen durchsuchbar bereitstellen und teilen.
**Anforderungen:** Volltext-/intelligente Suche plus strukturierte Filter (Art, Status, Domäne, Kategorie, Tags) mit korrekten Treffern; Listen- und Detailzugriff; Export einer Auswahl als JSON, Text/Markdown, MediaWiki und PDF; Re-Validierung aus der Bibliothek anstoßen. JSON-Re-Import mit Zusammenführung ohne Duplikate Stufe 2. *(Kern Stufe 1; Re-Import Stufe 2)*

### 7.11 Import / Source-Review
**Zweck:** vorhandene Dokumente in geprüftes Wissen überführen.
**Anforderungen:** Datei annehmen, Text/OCR extrahieren; Importkandidaten erzeugen und in eine Review-Warteschlange stellen; je Kandidat annehmen, ablehnen oder Nachinformation anfordern; akzeptierte Kandidaten gehen in den Validierungs-/Wissensobjektfluss, initial als unvalidiert/importiert/Entwurf mit verlinkter Originalquelle. Benötigt imports-API (Backend-Lücke). *(Stufe 2)*

### 7.12 Output Factory / Instruction Builder
**Zweck:** aus gesichertem Wissen verwendbare Ergebnisse erzeugen.
**Anforderungen:** aus **validierten** Objekten Arbeitsanweisungen/SOPs, Checklisten, Troubleshooting, Schulungsinhalte, Management-Zusammenfassungen erzeugen (Vorschau, Export z. B. Markdown); jeder Output trägt vollständige Herkunftskennzeichnung (Quelle, Status, Vertrauen, Version, Gültigkeit, Rolle). Benötigt Output-Logik (Backend-Lücke). *(Stufe 2)*

### 7.13 Analytics / Audit
**Zweck:** Überblick über Bestand, Wirkung und Nachvollziehbarkeit.
**Anforderungen:** Dashboard mit Kennzahlen (Status- und Art-Verteilung, Validierungsaufgaben pro Person, Kategorien); Wirkungsmetriken (validierte Objekte pro Woche, Antwortquote ohne Lücke, Zeitverlauf); einsehbares, unveränderliches Audit-Log aller sicherheits-/wissensrelevanten Aktionen (wer/was/wann), nicht änder- oder löschbar. Knowledge-Health und Herkunfts-/Lineage-Sicht Stufe 2. *(Kern-Kennzahlen + Audit Stufe 1; tiefe Analytik Stufe 2)*

### 7.14 Wissenslebenszyklus
**Zweck:** Wissen aktuell und gepflegt halten.
**Anforderungen:** Re-Validierung/Gültigkeitsprüfung; Anlagenänderung markiert gekoppelte Objekte „Stimmt das noch?", Bestätigen erzeugt eine neue Version; „noch gültig" bestätigen; „hat geholfen"-Signal; Autorenübergabe durch Admin (Autor ändert sich, Originalautor bleibt in der Fußnote); Versionen/Revisionen/Pflegebedarf sichtbar. Rollenbezogene Lernpfade mit Fortschritt Stufe 2. *(Kern Stufe 1; Lernpfade Stufe 2)*

### 7.15 Admin / Nutzerverwaltung
**Zweck:** Betrieb und Zugang steuern.
**Anforderungen:** Nutzerliste; Nutzer anlegen; Freigabe erteilen; Rolle ändern; Passwort zurücksetzen (alter Login ungültig, bestehende Sitzungen verfallen); Nutzer löschen; je Aktion ein Audit-Eintrag; Audit-Einsicht. Selbstschutz: ein Admin kann sich nicht selbst die Admin-Rolle entziehen. *(Kern Stufe 1)*

### 7.16 Mobile / PWA
**Zweck:** Wissensarbeit an der Anlage.
**Anforderungen:** installierbare PWA (Vollbild, Icon, Offline-Start); mobile Erfassung mit Entwurf als dominanter Aktion (Notiz und Interview vorhanden); mobil Fragen stellen; Entwürfe und Wissenszugriff mobil; app-eigene Inline-Bestätigung destruktiver Aktionen. Offline-Queue/Sync Stufe 2. *(Kern Stufe 1; Offline Stufe 2)*

### 7.17 Management- / Kapital-Sichten
**Zweck:** Wissens-Wert und -Risiko für Entscheider sichtbar machen.
**Anforderungen (alle datenbasiert, nicht aus Beispieldaten):** operativer Überblick/Snapshot; Pilot-Bericht (30/60/90 Tage, echte Kennzahlen, druck-/PDF-fähig); Knowledge Capital Score; Wissensbewertung (€-Modell, transparente Schätzung); Knowledge Statement (Aktiva/Risiken/Netto); Reifegrad-Reise; Handlungsempfehlungen; „Knowledge House"-Visualisierung des Unternehmensgedächtnisses; Wissens-Priorisierung über einen 9-Faktoren-Score (Bus-Faktor, Kritikalität, Prozessnähe, Alter, Quellenqualität, Konfliktdichte, Wiederholhäufigkeit, Schadenspotenzial, IP-Wert). **Wichtig:** Diese Sichten existierten im Altstand nur mit Beispieldaten; sie gelten erst als erfüllt, wenn sie auf echten Live-Daten und bestätigten Berechnungsregeln beruhen. Benötigt Wissenskapital-Kennzahlen (Backend-Lücke). *(Stufe 2)*

---

## 8. Statusmodelle und Lebenszyklen, die das Frontend abbilden muss

- **L-1 Wissensobjekt:** Entwurf → eingereicht/offen → in Prüfung → validiert **oder** abgelehnt; aus „validiert" zurück in „in Prüfung" (Re-Validierung). Jede Revision erhöht die Version, setzt Bewertungen zurück, schreibt Historie.
- **L-2 Validierung:** zugewiesen → bewertet (grün/gelb/rot) → Aufgabe erledigt; Wirkung auf Status und Vertrauen gemäß Formel.
- **L-3 Konflikt:** gemeldet/klassifiziert → (nur Wahrheit) eskaliert → Zweitmeinung → Entscheidung → gelöst; Vertrauen erholt sich nach Klärung.
- **L-4 Wissenslücke:** offen → zugewiesen/priorisiert → geschlossen (oder bestätigt gelöscht).
- **L-5 Import (Stufe 2):** Kandidat → Review (annehmen/ablehnen/Nachfrage) → in Validierung übernommen.

Das Frontend muss diese Übergänge konsistent darstellen, die jeweils erlaubten nächsten Schritte (rollenabhängig) anbieten und die Wirkung jeder Aktion auf Status und Vertrauen erkennbar machen.

---

## 9. Durchgängige Kern-Workflows (End-to-End)

- **W-1 Erfassen → Wissensobjekt:** Modus wählen → erfassen (Text/Diktat/Foto/Interview) → Reasoner strukturiert → Anwender prüft/korrigiert, setzt Metadaten → einreichen → Objekt erscheint offen im Validierungs-Board, Entwurf wird entfernt.
- **W-2 Validieren:** Prüfer öffnet zugewiesene/offene Objekte → bewertet → Status/Vertrauen aktualisieren → bei Mängeln Rückgabe an Autor; ab Schwelle „validiert".
- **W-3 Konflikt klären:** Widerspruch melden → Klassifikation → (nur Wahrheit) Eskalation → Zweitmeinung/Entscheidung → gelöst, Wirkung sichtbar.
- **W-4 Fragen → Antwort/Lücke:** Frage stellen → begründete Antwort mit Quellen/Vertrauen **oder** offen benannte Lücke + Anlegen einer Wissenslücke → „hat geholfen"-Rückmeldung.
- **W-5 Pflegen:** Anlagen-/Zeitänderung markiert Objekte zur Re-Validierung → bestätigen oder überarbeiten → neue Version; Autorenübergabe unter Wahrung des Originalautors.

Jeder Workflow muss auch unter Last (Abschnitt 10) und mit klarer Orientierung („wo bin ich, was ist der nächste Schritt") bedienbar bleiben.

---

## 10. Nicht-funktionale Anforderungen ans Frontend

- **N-1 Skalierbarkeit der Bedienung:** Bestände von ≥100.000 Wissensobjekten müssen such- und filterbar bleiben, ohne dass Listen/Boards unbenutzbar werden.
- **N-2 Komplexitätsführung:** Die Oberfläche muss Anwender ohne Schulung durch ihre Aufgaben führen; die Vielzahl der Funktionen darf den einzelnen Nutzer in seiner Rolle nicht überfordern (konkrete Lösung = UI/UX-Konzept).
- **N-3 Reaktionsverhalten:** spürbar schnelle Rückmeldungen; optimistische Aktualisierung mit serverseitigem Abgleich; ehrliche Lade-/Fehler-/Offline-Zustände.
- **N-4 Sicherheit:** keine Geheimnisse im Client; alle privilegierten Aktionen serverseitig geprüft; das Frontend zeigt unerlaubtes gar nicht.
- **N-5 Barrierefreiheit/Industrieumfeld:** gut lesbar und bedienbar auch mobil an der Anlage (Touch, ggf. Handschuhe, wechselnde Lichtverhältnisse) — als Anforderung, Umsetzung im Konzept.
- **N-6 Zweisprachigkeit & Erweiterbarkeit:** DE/EN vollständig; weitere Sprachen ohne Code-Umbau ergänzbar (ressourcenbasiert).
- **N-7 Datensparsamkeit/On-Prem:** keine Datenabflüsse an Dritte aus dem Client; passt zur On-Premises-Ausrichtung der Plattform.
- **N-8 Verlustfreiheit:** Ansichtswechsel, Vorschau↔Bearbeiten und Geräte­wechsel dürfen keine Eingaben (inkl. Bilder) verlieren.

---

## 11. Abhängigkeiten zum Backend

Backend-APIs sind weitgehend vorhanden. Folgende Frontend-Bereiche hängen an noch zu bauenden Backend-Lücken (Jira SCRUM-115–121) und können erst dann vollständig umgesetzt/abgenommen werden:

- Wissenslücken-Verwaltung & „Frage→Lücke" → **gaps-API**
- Import / Source-Review → **imports-API**
- Output Factory / Instruction Builder → **Output-Logik**
- Externe Quelle anhängen → **External-Knowledge-Proxy**
- Wissensgraph → **Graph-Daten**
- Management-/Kapital-Sichten → **Wissenskapital-Kennzahlen (datenbasiert)**
- Foto-/Dateianhänge → **Objekt-/Dateispeicher**

Das UI/UX-Konzept kann diese Bereiche vollständig mitdenken; in der Umsetzung sind sie Stufe 2 bzw. an die jeweilige Backend-Lücke gekoppelt.

---

## 12. Umsetzungsstufen (Scope-Leitlinie)

- **Stufe 1 (Kern / Erstrelease):** Foundation, Auth & Onboarding, Capture (ohne Foto/Objektspeicher), Reasoner-Strukturierung/Interview, Wissensobjekt-Detail, Validierung, Konflikte, Ask (Lücken sobald gaps-API steht), Bibliothek/Export, Analytics-Kernkennzahlen + Audit, Lebenszyklus (Re-Validierung/Übergabe), Admin, Mobile-Kern.
- **Stufe 2 (erweitert):** Foto/Objektspeicher, Self-Service-Reset, SSO/OIDC, Schreibhilfe, externe Quellen, Wissensgraph, Import/Source-Review, Output Factory, tiefe Analytik/Health/Lineage, Lernpfade, Offline-Sync, Management-/Kapital-Sichten.

Diese Stufung priorisiert den geschlossenen Kernkreislauf (Erfassen → Strukturieren → Validieren → Konflikt/Lücke → Fragen → Pflegen) vor den erweiterten Auswertungs- und Ausgabe-Funktionen.

---

## 13. Abnahmekriterien für „anwenderfreundlich"

Damit „anwenderfreundlich" prüfbar wird, sollte das UI/UX-Konzept gegen folgende Kriterien antreten:

- **A-1** Ein Experte kann ohne Schulung an der Anlage in unter zwei Minuten ein verwertbares Wissensobjekt festhalten (mobil, Entwurf).
- **A-2** Ein Prüfer erkennt seine offenen Aufgaben sofort und kann eine Validierung in wenigen, klaren Schritten abschließen.
- **A-3** Ein Betrachter erhält auf eine Fachfrage entweder eine begründete, mit Quellen und Vertrauen versehene Antwort — oder eine ehrliche Lücke, niemals eine erfundene Aussage.
- **A-4** Vertrauensgrad, Status und Herkunft eines Wissens sind an jeder Stelle ohne Klick erkennbar.
- **A-5** Jeder Nutzer sieht ausschließlich die seiner Rolle entsprechenden Funktionen; niemand wird mit irrelevanten Bereichen konfrontiert.
- **A-6** Ein Widerspruch führt nie zu stillem Datenverlust, sondern immer zu einem sichtbaren, geführten Konflikt.
- **A-7** Die Oberfläche bleibt bei sehr großen Wissensbeständen und vielen offenen Aufgaben übersichtlich und schnell.

---

*Ende der Anforderungsbeschreibung. Nächster Schritt: Überführung in ein UI/UX-Konzept (Informationsarchitektur, Navigationsmodell, Screen-Konzepte, Interaktions- und Gestaltungsrichtlinien) auf Basis dieser Anforderungen.*

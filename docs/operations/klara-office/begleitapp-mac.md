# Klara Begleiter auf dem Mac (KLARA-OFFICE-02)

Auftrag `produkt:20261010:klara-office-mac-maskottchen`. Dieses Dokument beschreibt, was gebaut
ist, wie die App auf Peters Apple-Silicon-Mac installiert, gestartet, aktualisiert und entfernt
wird, und enthält das Protokoll der lokalen Bedienabnahme. **Das Protokoll ist leer, bis Root die
Abnahme am geprüften Kandidaten tatsächlich durchführt** — Dateien, Tests und diese Anleitung sind
keine Hostabnahme.

## 1. Was gebaut ist

| Teil | Ort | Rolle |
| --- | --- | --- |
| Native Begleitapp (Swift 6.1 im Sprachmodus 5, AppKit, WKWebView) | `apps/desktop/klara-begleiter/` | Ein schwebendes, randloses Fenster mit der Figur; Ziehen, Tastaturschritte, Andocken, Zurücksetzen, Ein-/Ausblenden, Wiederfinden (Control-Option-K), Menüleistensymbol; Bildschirmrand, Mehrmonitor, Skalierung, Spaces und Vollbild. Kein Dock-Symbol, kein Autostart. |
| Webfläche der App | `apps/web/src/pages/Begleiter.tsx` (Route `/begleiter`, ohne Hülle) | Figur mit tatsächlichem Zustand, Word-Kontext, eigenes Klara-Gespräch (Klara 01), Sprechen/Diktieren/Vorlesen (Klara 02), Bedienung der Figur, Fassungen. |
| Office-Adapter im Word-Fenster | `apps/web/public/word-addin/begleiter.js` (Schalter „Mit Begleitapp verbinden“ in den Einstellungen des Klara-Seitenfensters) | Meldet Host, Hostfassung, Dateiname, Prüfsumme der Dokumentadresse und Markierung; führt Einfügen und „Frage in Word“ aus. Aus, bis die Person einschaltet. |
| Kontextkanal | `services/app/src/klara-begleiter.ts`, Routen `/api/me/klara/begleiter/*` | Bindet Adapter und Begleitapp an das eigene Konto; weist fremde, nicht angemeldete und veraltete Meldungen ab; ohne aktiven Adapter keine Auswahl. Nur Arbeitsspeicher. |
| Bauen/Installieren/Entfernen | `scripts/klara-office/begleiter-{bauen,installieren,entfernen}.sh` | Eigener App-Pfad, keine Administratorrechte, kein LaunchAgent. |

Gewählte Technik: Swift/AppKit mit WKWebView statt Electron — auf dem Mac vorhanden (Swift 6.1.2),
kein neues Framework im Produkt; Gespräch, Sprache und Avatar kommen unverändert aus dem bestehenden
TypeScript/React-Kern über die eigene, angemeldete Webfläche.

Avatar: Die Figur zeigt den Avatar aus der persönlichen Assistenzwahl (`profil.ts`), solange die
separat laufende Profilintegration (`produkt:20261010:assistenz-name-avatar`) noch kein Profil
liefert, den vorhandenen freigegebenen Avatar `klara/klara-avatar-v1.png` (SHA-256
`c2327f5b…`). **Teilstand:** eine kontobezogene Avatarwahl ist hier nicht geliefert, nur gelesen.

## 2. Datenweg

```
Word für Mac / Word im Web (Klara-Seitenfenster, begleiter.js)
   │  nur nach „Mit Begleitapp verbinden“: Host, Hostfassung, Dateiname,
   │  SHA-256 der Dokumentadresse (32 Zeichen), Markierung ≤ 4.000 Zeichen + Länge
   ▼
Klarwerk-Instanz (dieselbe wie das Seitenfenster), Konto aus der Sitzung,
nur Arbeitsspeicher, nicht protokolliert, nach 60 s Stille vergessen
   ▲  GET /api/me/klara/begleiter/kontext (alle 1,5 s), Aufträge „einfuegen“/„frage“
   │
Klara Begleiter (WKWebView, Webfläche /begleiter, eigene Anmeldung)
```

- Die Dokumentadresse (z. B. SharePoint-Pfad) verlässt Word nicht.
- Die Begleitapp liest NICHTS vom Bildschirm, aus Fenstertiteln oder Bedienungshilfen. Sie braucht
  weder Bildschirmaufnahme noch Bedienungshilfen. Sichtbarkeit eines Word-Fensters ist keine
  Kontexterkennung; gebunden ist nur ein Fenster, dessen Adapter sich angemeldet hat.
- Das Gespräch der Begleitapp sendet keinen Dokumenttext (allgemeiner Frageweg, Klara 01). Eine
  Frage zur Markierung geht als Auftrag an das Word-Fenster und läuft dort über dessen eigenen,
  gebundenen Weg (Sitzung, Einwilligung, Rechte, Markierungsregeln — R-0700). Die dort angezeigte
  Antwort kommt als Ergebnis zurück.
- Einfügen schreibt hinter den bestätigten, verfolgten Office-Bereich (`Word.run` + `track`), nie
  in die gerade aktuelle Auswahl. Jede Auswahländerung — auch ein Positionswechsel mit gleichem
  Text — macht den Auftrag sofort ungültig; vor dem Schreiben wird zusätzlich geprüft, dass die
  Markierung noch genau dieser Bereich ist (`compareLocationWith`) und ihr Text gleich blieb.
- Installation: Erweiterte Attribute werden nicht übernommen und am Zielbündel entfernt; die
  Signatur wird vor dem Start streng geprüft (`codesign --verify --strict --deep`).

### Sprache (KO-06-04)

- Diktieren und „Auftrag sprechen“ nutzen in der Begleitapp die Spracherkennung der WebKit-Engine
  (`webkitSpeechRecognition` im WKWebView). Auf macOS verarbeitet WebKit dafür über Apples
  Spracherkennung; ob lokal oder über Apples Server, entscheidet macOS (Einstellungen →
  Tastatur → Diktat). An Klarwerk geht nur der erkannte Text, und erst nach „Senden“.
- **Offen bis zur Abnahme:** ob `webkitSpeechRecognition` im WKWebView dieser macOS-Fassung
  verfügbar ist. Ist es nicht verfügbar, zeigt die Fläche den vorhandenen ehrlichen Satz („nicht
  verfügbar“) und die Texteingabe bleibt vollständig nutzbar.
- Mikrofon: macOS fragt beim ersten Diktieren („Klara Begleiter möchte auf das Mikrofon
  zugreifen“); die App gibt Mikrofonzugriff nur für die eigene Webfläche frei. „Nicht erlauben“ →
  Hinweis in der Fläche, Texteingabe unverändert. Stopp: „Aufnahme stoppen“; Schliessen des
  Gesprächs bricht die Aufnahme ab.
- Vorlesen: `speechSynthesis` des Systems (lokale macOS-Stimmen), Stopp über „Vorlesen stoppen“.

## 3. Installation, Start, Version, Aktualisieren, Entfernen

Voraussetzung: Xcode oder die Command Line Tools (Swift 6.1). Ausführen aus der Werkswurzel des
**geprüften Kandidaten** (die Skripte sind ohne Ausführungsrecht eingecheckt, deshalb `bash …`):

```
bash scripts/klara-office/begleiter-bauen.sh          # → apps/desktop/klara-begleiter/build/Klara Begleiter.app + BAU.txt
bash scripts/klara-office/begleiter-installieren.sh   # → ~/Applications/Klara Begleiter.app, startet sie, INSTALLATION.txt
```

| Frage | Antwort |
| --- | --- |
| Installierter Pfad | `~/Applications/Klara Begleiter.app` (nur dieser Pfad; keine Administratorrechte) |
| Bündelkennung | `ai.klarwerk.klara-begleiter` |
| Fassung | `apps/desktop/klara-begleiter/VERSION` (jetzt `0.1.0`) als `CFBundleShortVersionString`; Bau = Git-Kurzkennung des Kandidaten als `CFBundleVersion` |
| Wo sichtbar | Menüleiste → Klara-Symbol: „Klara Begleiter 0.1.0 (<bau>)“, „Webfläche <APP_VERSION> · <Server>“; im Gespräch unten: „Webfläche … · Begleitapp …“ |
| Startweg | Finder → Benutzer-Programme → „Klara Begleiter“, Spotlight „Klara Begleiter“ oder `open ~/Applications/Klara\ Begleiter.app` |
| Server | `https://klarwerk.ai` (beim Bauen `KLARWERK_SERVER=…` setzbar; nur https oder `http://localhost`) |
| Erste Anmeldung | Die App öffnet die Klarwerk-Anmeldung in ihrem Fenster; danach wird sie zur Figur |
| Autostart | keiner — kein Anmeldeobjekt, kein LaunchAgent (Installationsskript prüft und schreibt das in `INSTALLATION.txt`) |
| Beenden | Menüleiste → „Klara Begleiter beenden“ (Cmd-Q im Menü) |
| Aktualisieren | Kandidat auschecken, beide Skripte erneut ausführen — das Installationsskript beendet nur diese App und ersetzt sie |
| Entfernen | `bash scripts/klara-office/begleiter-entfernen.sh` (App + gemerkte Lage); mit `--mit-anmeldung` zusätzlich Web-Speicher/Anmeldung der App |
| Word-Seite | Kein Sideload nötig: `begleiter.js` kommt mit der regulären Auslieferung des Seitenfensters (Manifest unverändert). Word ggf. Seitenfenster neu laden. |

## 4. Bedienung

| Was | Wie |
| --- | --- |
| Gespräch öffnen/schliessen | Figur anklicken; Escape oder × schliesst; Menüleiste „Gespräch öffnen“ |
| Mausziehen | Figur mit der Maus ziehen (auch über Bildschirmgrenzen); beim Loslassen wird sie vollständig auf den Bildschirm gesetzt |
| Tastaturbewegung | Figur fokussieren, Pfeiltasten (12 pt), mit Umschalt 60 pt |
| Andocken / Zurücksetzen | Menüleiste oder „Figur“ im Gespräch: Links/Rechts andocken, Position zurücksetzen (unten rechts, Hauptbildschirm) |
| Ein-/Ausblenden, Wiederfinden | Menüleiste „Figur ausblenden/einblenden“; Control-Option-K holt die Figur zum Mauszeiger (auf dessen Bildschirm) |
| Reduzierte Bewegung | Menüleiste oder Häkchen im Gespräch; Vorgabe folgt „Bewegung reduzieren“ von macOS |
| Fläche der Figur | in der Lage „Figur“ ist das Fenster 96 × 96 pt und durchsichtig — mehr verdeckt sie vom Dokument nicht |
| Word verbinden | In Word: Klara öffnen → Einstellungen → „Mit Begleitapp verbinden“ (je Dokumentfenster) |
| Mehrere Word-Fenster | Die Begleitapp listet jedes verbundene Fenster mit Host, Fassung und Dateiname; „Dieses Fenster verwenden“ bindet eines. Ohne Wahl gilt das Fenster mit der jüngsten Markierungsänderung. |

Figurzustände (tatsächlich, nicht gespielt): bereit · wartet auf Antwort (Frage läuft oder Word
führt aus) · Antwort ist da (8 s) · Fehler (Ladefehler, Fehlermeldung, Abbruch) · hört zu · liest
vor. Der graue Punkt an der Figur heisst: kein aktives Word-Fenster.

## 5. Lokale Bedienabnahme (Root, am geprüften Kandidaten)

Nur fiktive Inhalte (z. B. ein neues Dokument „Abnahme Begleiter.docx“ mit erfundenem Text). Keine
Geheimnisse, keine echten Kundendaten. Bildbelege nach `docs/operations/klara-office/belege/`
(Konto- und Mandantennamen schwärzen).

**Kopf (vor dem Lauf eintragen):**

| Feld | Eintrag |
| --- | --- |
| Datum / Uhrzeit (UTC) | |
| Kandidat (Commit) und Webfläche (`APP_VERSION`, im Gespräch unten) | |
| App: Fassung (Bau) aus Menüleiste, Pfad, SHA-256 aus `BAU.txt` | |
| macOS-Fassung, Mac-Modell (Apple Silicon) | |
| Word für Mac (Word → Über Word) | |
| Chrome-Fassung, Word im Web (Host/Fassung wie in der Begleitapp angezeigt) | |
| Bildschirme (Anzahl, Skalierung) | |

**Ablauf:**

| # | Schritt | Soll | Ergebnis |
| --- | --- | --- | --- |
| A1 | `begleiter-bauen.sh`, `begleiter-installieren.sh` | `BAU.txt`, `INSTALLATION.txt` mit Pfad, Fassung, Bau, `autostart=nein`; App startet | |
| A2 | Anmelden in der App | Figur erscheint unten rechts; Menüleiste zeigt Fassung und „verbunden“ | |
| A3 | Word für Mac: Dokument öffnen, Klara → Einstellungen → verbinden | Begleitapp: „Word für Mac · Fassung … · aktiv“, Dateiname; grauer Punkt verschwindet | |
| A4 | Text markieren | Markierung erscheint in der Begleitapp (≤ 2 s) | |
| A5 | Figur über das Word-Fenster ziehen, Pfeiltasten, Umschalt+Pfeil | bewegt sich; Word behält den Fokus beim Ziehen | |
| A6 | Links/rechts andocken, zurücksetzen, ausblenden, Control-Option-K | jeweils sichtbar wirksam | |
| A7 | Reduzierte Bewegung an/aus | kein Pulsieren bei „wartet“ | |
| A8 | Word im Vollbild; anderen Space wechseln | Figur bleibt erreichbar | |
| A9 | Zweiter Bildschirm: Figur hinüberziehen; Bildschirm abziehen; Skalierung ändern | Figur bleibt sichtbar (wird eingepasst) | |
| A10 | Chrome: Word im Web öffnen, Klara-Seitenfenster → verbinden | zweites Fenster „Word im Web“ mit eigenem Dateinamen; Wahl zwischen beiden | |
| A11 | Fensterwechsel Word ↔ Chrome, je markieren | gebundenes Fenster wechselt nach jüngster Markierung; „Dieses Fenster verwenden“ hält es fest | |
| A12 | Gespräch: Frage stellen (fiktiv), Stopp ausprobieren | Antwort mit Herkunft; Figur „wartet“ → „Antwort ist da“; Stopp → „abgebrochen“ | |
| A13 | „In Word fragen“ zur Markierung | Frage läuft im Word-Seitenfenster; Antwort erscheint als „Antwort aus Word“ | |
| A14 | „Letzte Antwort hinter der Markierung einfügen“; dann Markierung ändern und erneut | erst eingefügt; danach abgelehnt („veraltet“) statt an falscher Stelle | |
| A15 | Diktieren: Mikrofon erlauben, sprechen, stoppen; einmal ablehnen (Systemeinstellungen → Datenschutz → Mikrofon zurücksetzen) | Text im Feld bzw. ehrlicher Hinweis; Texteingabe bleibt; Verfügbarkeit von `webkitSpeechRecognition` notieren | |
| A16 | Vorlesen einer Antwort, stoppen | liest, stoppt | |
| A17 | WLAN aus | „Keine Verbindung zu Klarwerk“, automatischer Neuversuch; WLAN an → wieder verbunden | |
| A18 | Word-Fenster schliessen bzw. Seitenfenster schliessen | Fenster verschwindet aus der Begleitapp bzw. „meldet sich nicht – keine aktuelle Auswahl“ | |
| A19 | Menüleiste → Beenden; `~/Library/LaunchAgents` prüfen | App beendet; kein Eintrag | |

**Ergebnis:** _offen_ — erst nach ausgefülltem Protokoll gilt die lokale Abnahme als erbracht.

## 6. Offene Punkte (ehrlich)

- Lokale Installation, Start und reale Hostbedienung sind **nicht** durch diese Lieferung belegt;
  sie gehören Root am geprüften Kandidaten (Abschnitt 5).
- Verfügbarkeit der Spracherkennung im WKWebView (s. 2).
- Word für Windows und andere Hosts: der Adapter meldet sie (`word-windows`/`word-andere`), die
  Begleitapp gibt es nur für macOS (Apple Silicon). Keine Abnahme für andere Plattformen.
- Menütexte der nativen App sind deutsch; die Webfläche ist DE/EN/NL.
- Der Kontextkanal lebt im Arbeitsspeicher EINES Serverprozesses. Bei mehreren Prozessen hinter
  einem Verteiler müssten Adapter und Begleitapp denselben Prozess treffen — heute ein Prozess.
- Signatur nur ad hoc (lokal); keine Notarisierung, keine Verteilung an andere Macs.
- Der gemeinsame Office-Hostkern (`produkt:20261010:klara-office-gemeinsamer-kern`) ist ein eigener
  Auftrag; dieser Kanal ist bewusst schmal und kann in ihn übergehen.
- **Verbindung mit dem gemeinsamen Office-Kern — gebaut in Nacharbeit 6, Hostabnahme offen.**
  Auf Anweisung (Root-Beleg `QUELLEN-ROOT-OFFICE-GEMEINSAME-BEREITSTELLUNG-20261011.json`) ist der
  erforderliche Kernumfang aus dem Kernkandidaten `d96bc286` gezielt übernommen — kein Gesamtmerge:
  `office-kontext.ts`, `routes/office-kontext-routes.ts` (an derselben `klaraSessions`-Instanz in
  `build-app.ts`), `word-addin/office-host-word.js`, `word-addin/begleitung.html/.js`, die
  CSP-Ausnahme der Begleitseite (`security-headers.ts`), Manifest und Doku
  (`docs/word-addin/klara-begleitung-manifest.xml`, `office-kontext.md`) samt Tests
  (`tests/office-kontext/`). Angebunden ist der Weg „Begleitseite beschickt den Begleiterkanal“:
  `begleitung.js` meldet sich nach „Mit Begleitfigur verbinden“ als Word-Fenster im vorhandenen
  Kanal an und meldet dort nur die Auswahl mit gültigem Office-Bezug; Aufträge der Figur laufen
  in DIESER Seite über die Zielprüfung des Kerns (`fuegeEin`) bzw. Klaras Ausführungszugang.
  Die native Figur liest unverändert denselben Kanal. Der alte Adapter `begleiter.js` im
  Seitenfenster bleibt als zweiter Weg erhalten.
  Korrigiert gegenüber dem Kernstand: Abmeldungen ohne Rumpf tragen keinen Rumpftyp mehr (sonst
  konnte der Server das `DELETE` als leeren JSON-Rumpf abweisen), und eine nach Dokumentwechsel
  oder Trennen verspätet angenommene Anmeldung wird sofort wieder abgemeldet.

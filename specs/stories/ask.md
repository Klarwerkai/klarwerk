# Modul: ask — Abfrage & Wissenslücken

> Quelle: Pflichtenheft §3.8 (FR-ASK-01…06), NFR-TAI-01. Jira-Epic: KW-ASK.

## Ziel
Fragen begründet beantworten mit Trust, Quellen und Argumentationsschritten — und ehrlich
verweigern, wenn Wissen fehlt (Ablage als Wissenslücke).

## User Stories & Akzeptanzkriterien

### FR-ASK-01 · Begründete Antwort (MUSS)
- [ ] **Gegeben** eine Frage, **dann** Antwort mit Trust, Quelle(n), Argumentationsschritten, ggf. Konflikt-Hinweis.

### FR-ASK-02 · Semantische Auswahl (MUSS)
- [ ] **Gegeben** eine sinngemäß passende Frage mit anderen Worten, **dann** wird das relevante KO gefunden (Keyword-Fallback).

### FR-ASK-03 · Ehrliche Verweigerung (MUSS)
- [ ] **Gegeben** fehlende Grundlage, **dann** keine erfundene Antwort; es entsteht eine Wissenslücke.

### FR-ASK-04 · „Hat geholfen" (MUSS)
- [ ] **Gegeben** Klick auf „hat geholfen", **dann** Trust leicht erhöht + Audit-Eintrag.

### FR-ASK-05 · Wissenslücken verwalten (MUSS)
- [ ] **Gegeben** eine Lücke, **dann** einem Experten zuweisbar, schließbar und mit Bestätigung löschbar.

### FR-ASK-06 · Belegstelle (KANN)
- [ ] **Gegeben** eine Antwort, **dann** Verweis auf konkretes Quell-Snippet.

### FR-ASK-07 · Administrative KI-Abschaltung des Fragewegs (MUSS, D5)
- [x] **Gegeben** der Administrator hat die KI abgeschaltet (`PUT /api/reasoner/config` mit Wahl `deterministic` für `answer`, gespeichert in `reasoner_policy`, sichtbar als `kiAbschaltung` bzw. `kiAbgeschaltet`), **dann** beantworten frische, vorbereitete und wiederholte Fragen (`POST /api/ask` in allen Zweigen, `POST /api/reasoner` Aufgabe `ask`) nichts, antworten mit 503 `KI_ABGESCHALTET` und einem verständlichen Satz (DE/EN/NL) ohne Kundeninhalt — und lesen dafür keinen Bestand.
- [x] **Gegeben** eine laufende Frage trifft zwischen zwei Schritten auf die Abschaltung, **dann** wird sie vor dem nächsten inhaltlesenden oder übergebenden Schritt angehalten; Wiedereinschalten holt nichts nach. Geprüft wird nach JEDEM Warten und vor JEDEM Lesen bzw. Übertragen: in den Suchspeichern vor ihrer Inhaltsabfrage (`KoSearchQuery.vorInhaltsabruf`), vor dem Nachladen der Kandidaten (`listByIds`), zwischen Objekt und Dokumenttext (`searchProjectionUnterKiSperre`), vor der Übergabe an den Antwortweg, am Modell-Chokepoint nach dem Warten auf einen Modellplatz (`KiAbgeschaltetFehler`), vor Beleg und Lücke, zwischen den beiden Schreibaufrufen des Belegs und INNERHALB der Beleg- und Lückenablage vor jeder ihrer Anweisungen (`AnswerSnapshotRepo.appendSnapshot`, `GapRepo.insertOrIncrement`, jeweils `vorInhaltsabruf`) sowie in der Route vor jedem Quellen- und Konfliktabruf, in der Lesefassung der Wissensobjekte vor dem Schreibstand und vor dem Bestand des Prüfstempels (`KoService.get(id, vorInhaltsabruf)`, `findCandidates`; die Versions-Autorität der Befund-Dienste liest nur die Fassung, `aktuelleFassungVon`), innerhalb des Konfliktabrufs vor jeder Versionsabfrage einer Konfliktseite (`ConflictService.unresolved(vorObjektabruf)`; Board, Badge und Detail rufen ohne Haken und bleiben unverändert) und vor der Auslieferung — an BEIDEN Eingängen: `POST /api/ask` und `POST /api/reasoner` (Aufgabe `ask`) prüfen nach der Antwort des Dienstes noch einmal gegen Zustand und Epoche, bevor sie ausliefern; die Abschaltauskunft folgt an beiden der angefragten Sprache (DE/EN/NL). Jede Frage hält beim EINGANG der Anfrage — im ersten globalen onRequest-Hook (`buildApp`), also vor dem Anmelde-Hook der Add-on-API, vor dem Sitzungs-Guard und vor dem Warten auf die Klara-Einwilligung (`ka4Freigabe`) — die Abschalt-Epoche fest (`Reasoner.kiAbschaltStand`, steigt mit jeder gespeicherten Abschaltung) und wird nach diesem Warten, unmittelbar vor dem Dienst, dagegen geprüft (`AskService.kiSperreVorFrage`); eine während der Frage erfolgte Abschaltung entwertet sie dauerhaft, auch nach bewusstem Wiedereinschalten — nur neue Fragen laufen dann wieder.
- [x] **Gegeben** KI aus, **dann** bleiben Bibliothek und Originale nach den bestehenden Leserechten lesbar; ein Rechteentzug ist ein eigener Zustand.
- Nicht erfasst: fehlende Freigabe für öffentliche KI, Modellstörung, Ladefehler und Deploy-Vorgabe (`KLARWERK_REASONER_POLICY`) — sie sind keine Abschaltung. Andere KI-Verbraucher (Struktur, Assistenz, Prüfungen, Bildbeschreibung) sind nicht Teil dieses Kriteriums.
- Nachweis: `tests/d5-ki-aus/` (`halt-in-der-anmeldung.test.ts`: an beiden Eingängen mit und ohne Add-on-API in der Anmeldung angehalten, Aus/Ein, mit Kontrolle und Gegenprobe; `halt-vor-dem-dienst.test.ts`: an beiden Eingängen während der Einwilligungsprüfung angehalten, Aus bzw. Aus/Ein, mit Kontrolle und Gegenprobe; Zähler an den Ablagen unterhalb der Dienste; je Wartepunkt ein Haltefall mit Gegenprobe; `lesefassung-unter-sperre.test.ts` für den Bestandszweig des Prüfstempels; die PostgreSQL-Adapter von Beleg und Lücke über einem instrumentierten SQL-Ersatz), `tests/d5-gesamtweg/ki-aus-pg-browser.integration.test.ts` (PostgreSQL, Chromium, SQL-Mitschnitt; H6 hält zwischen den Anweisungen von Beleg- und Lückenablage an; die Messung scheitert, wenn Produkt- oder Testquellen vom geprüften HEAD abweichen, und nennt jede Abweichung des Arbeitsbaums; läuft auch mit Socket-Adressen ohne Rechnernamen; ohne angebotene `KLARWERK_PG_TEST_URL` startet der Prüfplatz eine eigene Wegwerf-Instanz aus vorhandenen PostgreSQL-Programmen, `KLARWERK_PG_BIN` oder Suchpfad).

### R-0348 · Gesprächsfaden statt Einzelfragen (Auftrag `aufnahme:20260922:gesamt-gespraechsfaden`)
- [x] **Gegeben** eine beantwortete Frage auf der Fragen-Seite, **dann** knüpft die nächste Frage an: die Seite schickt höchstens drei vorangegangene Fragen als `thread` mit — die erste Frage als Themenanker plus die jüngsten Nachfragen —, zeigt den Faden über dem Fragefeld und bietet „Neues Thema beginnen" an; eine danach noch eintreffende Antwort trägt ihre Frage nicht in den neuen Faden. Dieselbe Frage erneut ist eine Auffrischung und schickt sich nicht selbst als Faden.
- [x] **Gegeben** eine Nachfrage mit Faden, **dann** wählt der Fragedienst die Quellen im Zusammenhang (Vorauswahl, Tor 1, Tor 2, Antwortweg) — gebunden bleibt allein die getippte Nachfrage: jede Quelle muss alle ihre Begriffe tragen. Ohne tragende Quelle entsteht eine Wissenslücke, deren Text den Zusammenhang nennt.
- Grenzen (R-0345, kein offener Chatbot): der Faden schafft keine Grundlage, die Antwort bleibt quellengebunden. Wirksam nur im Konsolenzweig (Sitzung, getippte Frage); Add-on-, Word-/Klara- und `retrieval-only`-Wege lassen `thread` liegen. Der Faden lebt in der geöffneten Seite und beginnt nach Neuladen bei der wiederaufgenommenen Antwort; Mobilseite und Word-Panel haben keinen Faden.
- Nachweis (Lauf in der Kandidatenprüfung, nicht beim Bau): `tests/gespraechsfaden/nachfrage-im-faden.test.ts` (echte Route, Kalibrierung ohne Faden, Gegenprobe ohne Grundlage, Word-Weg, Schema), `tests/gespraechsfaden/faden-flaeche-mounted.test.tsx` (echte Fragen-Seite).

## API / Schnittstellen (Entwurf)
`POST /api/ask` (→ reasoner: semantische Auswahl + Antwort; optional `thread`: vorangegangene Fragen, höchstens drei) · `GET/POST /api/gaps` · `POST /api/gaps/:id/assign|close`. Event `gap.created`.

## Datenmodell (Auszug)
`gaps(id, question, status, assignee, created_at)`. Antwort-Provenienz (Quellen-KO-IDs, Schritte) im Response.

## Nicht-Ziele (v1)
Freie generative Antworten ohne Quellenbindung (verboten, Anti-Halluzination FR-RSN-03).

## Offene Fragen
Embedding-/Retrieval-Verfahren für semantische Suche (lokal vs. extern, NFR-PRV) · Trust-Inkrement-Höhe.

# Aktueller Stand — 04.07.2026, Abend

> Diese Datei bei jedem größeren Schritt fortschreiben (Version, Tickets, Plan).
> Feinere Historie: `docs/qm/claude-after-report.md` + Git-Log + Jira.
>
> **➤ Verifizierter Status-quo-Zwischenbericht des Assistenten (06.07.):**
> `PROJECT_CONTEXT/13_ASSISTENT_ZWISCHENBERICHT.md` (Rohstand: `docs/boss-assistant/`).
> Live-Version dort bestätigt: **v1.0.0-beta.1.4**.

## 08.10.2026 — Aufnahme „Negativwissen-Hinweis“ (R-1629, Roadmap 2.3)

- `POST /api/knowledge/check` weist ähnliche Einträge der Wissensart `negativwissen` gesondert aus
  (`negativwissen[]`: Titel, gekürzte Begründung, Fundort; höchstens 3). Dieselbe Vorauswahl,
  Sichtbarkeitsregel, Vertraulichkeitssperre und Schwelle wie `similar`, kein Modell. Das Feld fehlt
  ohne Treffer. Vertrag am Ende von `services/app/src/knowledge-check.ts`.
- Das Blatt zeigt den Hinweis offen über dem Vorschau-Chip (`components/erfassen/NegativwissenHinweis.tsx`,
  Texte `apps/web/src/texte/negativwissen.ts`), auch wenn die Widerspruchsprüfung „pending“ bleibt.
  Er blockiert nichts.
- Prüfstand: `tests/negativwissen-hinweis/` (Auskunft + gemountetes Blatt, jsdom). Eine Messung im
  echten Browser und eine fachliche Abnahme mit echtem Negativwissen-Bestand stehen aus.

## 01.10.2026 — Aufnahme „KI-Laufprotokoll“ (Runde 1 + Nacharbeit Runden 2 und 3)

- Abgleich aller zugeordneten Anliegen (R-0612 … V9, MR-SELECT-1) mit Fassungen und Belegen:
  `tests/ki-lauf-protokoll/README.md`. MR-SELECT-1 ist seit JOB 3127 (1.0.0-beta.1.140) geliefert,
  der Tokenverbrauch seit JOB 3074 (1.0.0-beta.1.88).
- Neu im Laufprotokoll:
  - Ein Lauf, der an `ModelCapacityError` endet, schreibt jetzt einen Datensatz.
  - `error` ist inhaltsfrei: Meldungen nur von einer Erlaubnisliste, sonst nur Typ und Klasse.
  - Vier weitere Laufarten: `enrich`, `conflict`, `duplicate`, `probe`.
  - `kosten` aus Verbrauch × Preisliste, mit Preisstand.
  - `erzeugt` mit Art und Anzahl des Erzeugten.
  - Strukturierte Logzeile `ki_lauf`.
- Neu in der Oberfläche: Die KI-Übersicht zeigt Kosten und Erzeugtes je Lauf. Dazu kommt die Karte
  „KI-Auswertung (Zeitraum)“ (7/30/90 Tage, Kosten je Währung) über `GET /api/model-runs/auswertung`.
- **Preise setzt der Betreiber** über `KLARWERK_KI_PREISLISTE` (JSON, im Startvertrag). Der Code
  liefert keine Preise mit. **Entscheidung Pedi offen:** welche Preise, Währung und Stand.
- Runde 3 (Bens R2-Befunde):
  - HTTP-Fehler ohne Anbietertext im Protokoll.
  - `versuche` je Lauf (Modell, Verbrauch, Span); Kosten je Versuch zum Preis seines Modells.
  - Tracing nach W3C Trace Context (`trace` am Lauf, Kennungen in der Logzeile).
  - Die Auswertungskarte behandelt Offline und gescheiterte Auffrischung.
- Offen: Export an einen Trace-/Metrik-Sammler, Verknüpfung erzeugter Gegenstände mit späteren
  Entwürfen/KOs, Anzeige des Fehlergrunds. Nicht geprüft: echte Modell-API, PostgreSQL, Browser.

## 03.10.2026 — Erstnutzerführung: ausgelagerte Zielzustände (Folgeauftrag `…-quellen`)

- R-1012 (OFFEN.md U4, SCRUM-474): Das Blatt „Über KLARWERK“ (Start → „…“) trägt die
  Fähigkeitsübersicht „Was KLARWERK kann“: erfassen → prüfen → finden, acht Bereiche mit je einem
  Satz und einem Weg. Namen und Ziele kommen aus `app/navigation.ts` (`lib/faehigkeiten.ts`), die
  Texte DE/EN/NL aus `texte/erstnutzer.ts`. Das Sichtfeld von `/start` ist unverändert.
  Test: `tests/erstnutzerfuehrung/faehigkeitsuebersicht.test.tsx`. Der Startziel-Sammler (mega51)
  ist nachgeführt.
- Zugeordnet mit Belegen: R-0455 (Artefakte nicht auffindbar, Kriterium abgeleitet), R-0928
  (eigene Einstiegsseiten offen), R-1675 (Kacheln geliefert und abgelöst), R-0939 (Erhebung mit
  Abbruchstellen geliefert; höchste: keine Meldung an die Autorin bei Freigabe). Drei Fragen an Pedi:
  `tests/erstnutzerfuehrung/README.md`.
- Nicht geprüft: Nachtest mit Menschen, Browser-Lauf des H5-Funktionsinventars mit der erweiterten
  Übersicht.

## 01.10.2026 — Erstnutzer-Hürden U2/U3 im Browser (Revision 9)

- Neue Playwright-Sonde `tests-smoke/erstnutzer-u2-u3-browser.spec.ts`: U2 (Suchraum der Bibliothek
  mit Nulltreffer und Weg zum Erfassen; „Meine Entwürfe“ nennt den Entwurfs-Suchraum und führt in
  die Bibliothek) und U3 (Weg zu „Meine Aufgaben“ über das Zahnrad, Erklärung in der Seitenhilfe,
  kein Tooltip am Kopfband). U1 stand schon im Browser. Sollmanifest: Version 11, 201 Fälle.
  Der Browserlauf selbst steht im Linux-Tor aus.
- Per Pedi-Entscheidung `622a6ae6` (Option B) liegen R-0455, R-0928, R-0939, R-1012 und R-1675 im
  Folgeauftrag `…-quellen`. Abgleich: `tests/erstnutzerfuehrung/README.md`.

## 01.10.2026 — Gesamt-KI-Einwilligung, Lauf 1: Prüfprotokoll der Zustimmung (Teilstand)

Auftrag `aufnahme:20260922:gesamt-ki-einwilligung`, Lauf 1 Runde 1. Bestandsabgleich der Kriterien
ergab: KA4/Einwilligung je Dokument, aktives Fragen und gemerktes Nein, Word-Einwilligungskarte,
Schalter `KLARA_EXTERNAL_EXECUTION_MIGRATED = true` (JOB 3079), Kostenhinweis nur bei
`billable`, serverseitige Entwurfsstufe/`draftId`, N11b, Datenklassen im Dialog und
Richtlinienbindung waren bereits gebaut. **Neu (R-0609):** Jede Erteilung und jedes Ende einer
Klara-Zustimmung (Widerruf, Ablauf, Entwertung, Schliessen, Umbinden, Zweitgrant) steht im
append-only Prüfprotokoll (`klara.consent.granted` / `klara.consent.ended`, `KlaraSessionService`
→ `services/audit`), mit Wer, Dokumentkontext, Anbieter, Modell, Datenklassen, Richtlinienfassung,
Erteilung, Ablauf und Endzeitpunkt. Dazu überholte Kommentare zum Schalter bereinigt (R-1533).

**Runde 2 (Bens B1–B3):** Der Erteilungseintrag wird VOR dem Speichern geschrieben (scheitert er,
entsteht keine Zustimmung; verliert das Speichern danach, folgt `ended`/`nicht_wirksam`). Endeinträge
sind genau-einmal je Zustimmung (`recordOnce`) und werden bei Protokollausfall vom nächsten
Sitzungszugriff aus der Zeile nachgetragen (`laden`); ein Zweitgrant beendet die erste Zustimmung
in einem eigenen Übergang. Das Ausführungstor prüft jetzt die AUFGABE: eine an `answer` gebildete
Zustimmung trägt eine andere Aufgabe (oder `global` für die Urteile) nur, wenn sie an denselben
Anbieter geht (`task_provider_mismatch`); die Anbieterkarte je Aufgabe steht in der
Konfigurationsversion, ein Wechsel entwertet die Zustimmung. Neu im Reasoner-Status:
`effectiveAnbieterGlobal`. Tests: `services/app/src/services/klara-consent-protokoll.test.ts`,
`tests/app/einwilligung-anbieter-je-aufgabe.test.ts`.

**Runde 3 (Bens B2–B4 aus Runde 2):** `raeumeAbgelaufeneAuf` trägt vor dem Löschen jeden fehlenden
Endeintrag aus den Zeilen nach (Repo: `findExpiredSessionIds`); scheitert das, wird nichts
gelöscht. Neue Klara-Anbieterbindung `services/reasoner/src/anbieterbindung.ts`
(AsyncLocalStorage): die fünf Routen mit Einwilligungstor öffnen je Anfrage einen Rahmen, das Tor
(`ka4Entscheidung`, Zuruf-Prüfer) hält den zugestimmten Anbieter darin fest, und der Reasoner lässt
beim Kettenbau (`chainForChoice`) nur diesen Cloud-Anbieter zu; der Zuruf-Modellclient prüft
dasselbe. Ein Anbieterwechsel zwischen Tor und Lauf erreicht damit nichts mehr. Die Reasoner-Route
meldet die Anbieterabweichung als eigenen Grund `provider_mismatch` statt als Einstufung.
**Nicht abgenommen; PostgreSQL-Lauf steht aus.**

## 30.09.2026 — Erfassen-Doppelklick, Lauf 6: Blattwechsel erst nach dem Datei-Anteil (Teilstand)

Auftrag `aufnahme:20260922:erfassen-doppelklick`, Lauf 6 Runde 1, Basis `5e44e7e6`. Die
Lauf-5-Commits `cfddc51a`, `7bdef2cd`, `c840a21b` waren nicht in `main`; sie sind unverändert
übernommen (Cherry-Pick ohne Konflikt) und um Bens Befunde B5/B6 (Lauf 5, Prüfauftrag
`pa-1790662305-e1b41479`, geprüfter Commit `f2d594cb`) ergänzt. **Nicht abgenommen; die reale
Browser-/PostgreSQL-Messung dieser Fassung steht aus.**

- **B5 (Datei ging nach Formularerfolg verloren):** `saveDraft.onSuccess` ruft den Blatt-Rückruf
  `onEntwurfInsBlatt` nicht mehr, solange ein Datei-Anteil folgt (`blattWechselRef` in
  `Capture.tsx`, gesetzt von `manuellSichern` und vom Wache-Rückruf). Der manuelle Knopf wechselt
  erst nach gesicherter Datei zum Formularentwurf; scheitert der Datei-Anteil, bleiben Arbeitsraum,
  Datei und Wiederholzustand stehen, und der nächste Druck sichert nur noch die Datei.
- **Nebenbefund, mitbehoben:** Nennt die Adresse den Entwurf schon, den das Blatt öffnen soll,
  lud es bisher nicht neu und zeigte den Stand von vor dem Speichern (alter Titel).
  `Blatt.tsx` `entwurfOeffnen` erhöht dann den vorhandenen Laderunden-Zähler (`reloadNonce`).
- **B6 (lokale Regression ohne Blatt, Q2 wartete auf abgebaute Quittung):** `huelle.tsx` montiert
  auf Wunsch die ganze Seite (`Capture` mit echtem Blatt);
  `tests/entwurf-verlassen/erfassen-doppelklick-blatt-mounted.test.tsx` B1/B2 grün, Gegenprobe
  ohne Capture-Korrektur rot. Q2 im Browser-/PostgreSQL-Test wartet jetzt auf den sichtbaren
  Abschluss (Blatt ohne Arbeitsraum, Titel des Formularentwurfs) und findet die Datei-Zeile über
  PostgreSQL; neu Q6 (Formular + Datei, Upload angehalten + zweiter Klick, Upload- und
  Anlagefehler, erneuter Druck). Q2 und Q6 sind im Bau **nicht ausgeführt** (keine Datenbank und
  kein Browserlauf auf dem Produktions-Mac).
- **Runde 2 · B7 (grüner Erfolg zu früh):** Beim gemeinsamen Speichern hält `saveDraft.onSuccess`
  den Satz „Entwurf aktualisiert./gespeichert." zurück; stattdessen steht der ausdrückliche
  Teilerfolg `capture-teilerfolg` (`ausstehend`: neutral, „Noch nicht alles gesichert …";
  `gescheitert`: Warnfarbe, „Nur teilweise gespeichert … die Datei nicht"). Der grüne Satz erscheint
  erst, wenn auch die Datei gesichert ist (`teilerfolgErledigen`, aufgerufen aus
  `fileWholeDraft.onSuccess`, `manuellSichern` und dem Wache-Rückruf). Neue Texte de/en/nl
  `capture.teilerfolg.*`. B1/B2 prüfen grüne Meldungen und Teilerfolg (Gegenprobe ohne
  Zurückhalten: rot); Q6 prüft dasselbe im Browser, ist aber im Bau nicht ausgeführt.

## 29.09.2026 — Aufnahme „Gesamt-Erstnutzerführung“ (Abgleich + R-0474)

- Die Nulltreffer von „Gehe zu …“ und der Hilfesuche bieten jetzt die Eingabe als Frage an
  (`/fragen?q=…`; nur wenn die Rolle „Fragen“ erreicht). Texte in `apps/web/src/texte/erstnutzer.ts`.
  Runde 2: Ist `/fragen` schon offen, übernimmt `Ask` die neue `?q=`-Frage jetzt ins Feld (vorher
  blieb die alte stehen). Weiterhin nur Vorbefüllung, kein Auto-Ask.
  Runde 3: Ein Antwortlink (`?q=…&ask=1`) auf die offene Seite sendet genau seine Frage; der
  Auto-Ask gilt je Navigation und liest dieselbe Quelle wie die Vorbefüllung.
- Missionen: am 26.06. als Start-Kacheln geliefert (`9be7466b`), durch mega38 G2 zurückgenommen und
  in mega39 F gelöscht (`5150cd5a`). Eigene Einstiegsseiten gab es nie; ihr Stand ist ungeklärt.
- Abgleich aller zugeordneten Anliegen mit Belegen, abgelösten Teilen (JOB 3064 H5) und offenen
  Punkten: `tests/erstnutzerfuehrung/README.md`. Offen bzw. mit Entscheidungsbedarf (Pedi):
  „Missions“-Einstiegsseiten (optional), eine Fähigkeitsübersicht für Erstnutzer (R-1012) und die
  Browser-Messung der Hürden U1–U3.

## 29.09.2026 — Aufnahme „Vorschau-Reichweite“ (Wissensvorschau beim Erfassen)

- `POST /api/knowledge/check` meldet jetzt immer `coverage`: `{kind:"candidates", checked, limit,
  limitReached}` oder ausdrücklich `{kind:"unknown"}` (zu kurzer Text, Fehler). Vertrag am Ende von
  `services/app/src/knowledge-check.ts`.
- Blatt und `LiveReactionZone` sprechen von „Vorschau“ und nennen nur diesen Umfang; „Das ist neu“
  gibt es auf diesem Weg nicht mehr (Anzeigezustand `new` → `empty`). Texte in `apps/web/src/texte/vorschau.ts`.
- Echter Nachweis (PostgreSQL + Chromium, Eintrag auf Rang 41):
  `tests/vorschau-reichweite/vorschau-reichweite-pg-im-browser.integration.test.ts` — Ausführung auf
  dem Prüfserver steht aus. Datenhaltung nur über Testcontainers (eine gesetzte
  `KLARWERK_PG_TEST_URL` wird nicht benutzt); die alte Fläche für K4-R entsteht ohne
  Git-Vorgeschichte aus `tests/vorschau-reichweite/alte-flaeche.patch` (Umkehrung dieser Änderung).

## 29.09.2026 — Erfassen: Formular + Datei gemeinsam, Doppelklick und verlorene Antwort (Teilstand)

Auftrag `aufnahme:20260922:erfassen-doppelklick` (R-0017, R-0020, R-0156). **Stand: Code und
lokale Tests geliefert, reale Browser-/PostgreSQL-Messung ausstehend — nicht abgenommen.**
R-0020 gilt unverändert für **Speichern UND Einreichen**, auch bei verlorener Serverantwort.

- **Wiederverwendet, nicht neu gebaut:**
  - Einreichen: Wiederholschlüssel des Einreichens (`submitOperationRef`, `lib/createOperation.ts`,
    mega20–22) mit vorhandenen Antwortverlust-Belegen `tests/capture/mega20-capture-submit-mounted`
    („ANTWORTVERLUST … KEIN zweites Objekt"), `mega21-capture-mounted` (nach Fortsetzen),
    `mega22-vorgang-mounted` (Promote-Weg), `mega20-erstanlage-antwortverlust`. In diesem Auftrag
    nicht verändert und nicht neu gemessen; das Doppelklick-Kriterium für Einreichen stützt sich
    auf diese Belege.
  - JOB 4352 (manueller Knopf sichert die geladene Datei über `fileWholeDraft`), JOB 3770 R4
    (`dateiTraeger`), JOB 2697 (`operationId` an `POST /api/drafts`: Route, Dienst, Ablage).
- **Fassungen:** Runde 1 `cfddc51a` (Einzellauf je Weg) — laut Ben unzureichend. Runde 2 `7bdef2cd`
  (Wiederholschlüssel an Formular- und Datei-Anlage, Marke für gesicherten Dateistand) — laut Ben
  weiterhin **Doppelbestand ohne Benutzeränderung**: Upload scheitert, Anlage-Antwort geht
  verloren, beim zweiten Druck gelingt der Upload, die neu gebaute Nutzlast trägt den Originallink
  → neuer Schlüssel → zweiter Entwurf (Gegenprobe G5/API-G5). Runde 3 (Commit nach `7bdef2cd`,
  vom Starter erzeugt): ein unklar abgeschlossener Ganzdokument-Vorgang wird wörtlich
  wiederaufgenommen (gleiche Nutzlast, gleicher Schlüssel, kein neuer Upload).
- **Belege lokal (Runde 3):** `tests/entwurf-verlassen/erfassen-doppelklick-mounted.test.tsx`
  (Attrappen, u. a. V4 = G5) und `…-echte-api-mounted.test.tsx` (echte Fastify-Anwendung,
  In-Memory-Ablage, A6 = API-G5); Gegenprobe gegen `7bdef2cd`: V4 und A6 rot.
- **Offen:** `speicherknopf-ganzdokument-pg-im-browser.integration.test.ts` Q2–Q5 (Chromium +
  PostgreSQL) sind geschrieben, aber nur auf dem Prüfserver ausführbar und nicht gelaufen —
  die reale API-/Browsermessung mit passendem Commit fehlt.
- **Verbleibende Grenzen:** Hat der Mensch nach verlorener Antwort den Inhalt WIRKLICH geändert,
  entsteht ein zweiter Entwurf mit dem neuen Stand (Formularweg: neuer Abdruck, neuer Schlüssel;
  Dateiweg: nur bei neu eingelesener Datei). Für den Formularweg ist ein automatischer
  Nutzlastwechsel ohne Benutzerhandlung nicht bekannt, aber nicht ausgeschlossen. Eine sichtbare
  Erklärung „war bereits gespeichert" (R-0156) gibt es nicht — die Wiederholung meldet den
  normalen Speichererfolg.

## 29.09.2026 — Auditprotokoll: Änderung und Beleg gemeinsam oder gar nicht (Lauf 3)

- Audit-Kette: Vorgänger lesen und anhängen als ein Schritt (`AuditRepo.appendNext`; PostgreSQL unter
  `pg_advisory_xact_lock`, auch zwischen Instanzen). Erfassen, Ändern und Validieren eines
  Wissensobjekts schreiben Objekt und Auditeintrag mit `withTx` in einer Transaktion; ohne sie mit
  Rücknahme und `ko.change-rolled-back`. Löst WP-SHIP8-CLOSE-5 ab.
- Export der Kette (`GET /api/audit/export`), `library.export`, `ko.revalidated`, Objektkette.
- Details, Belege, Grenzen: `docs/entscheidungen/gesamt-auditprotokoll.md`. PostgreSQL-Integration
  (`tests/audit-gesamt/*.integration.test.ts`) auf dem Prüfserver noch zu fahren.

## 29.09.2026 — Bildidentität: die Kennung kommt vom Bild (Aufnahme gesamt-bildidentitaet, Lauf 3)

- Server-Sanitizer (`anchorFigures`) und Editor (`ensureImageAnchors`) überschreiben keine
  abweichende Fußnotenkennung mehr. Ein ersetztes Bild in einer verankerten Hülle erbt die alte
  Beschreibung nicht mehr. Die fremde Fußnote bleibt sichtbar, gekennzeichnet und bewusst
  zuordenbar (V7).
- Runde 2 (nach Bens Befunden): Körperklick und Galerie-Bitte treffen das Vorkommen über „k-tes
  Bild mit dieser Quelle“ statt über die Listenposition (R-0945/R-0053); eine lose Fußnote behält
  die Kennung ihres Bildes und wird in Editor, Galerie und Bildsuche gelesen; beim Trennen folgt
  die eigene Beschreibung auch hinter einer fremden Fußnote; beide Sanitizer hinterlassen bei
  doppelter oder ungültiger Kennung die Spur `data-kw-kennung`, der Editor meldet sie beim Öffnen
  (R-0090).
- Runde 3: Der Körperklick baut die Großansicht aus dem aktuellen Editorstand statt aus dem
  verzögerten Galeriestand; die Galerie-Bitte ist an die Kennung gebunden und öffnet im Zweifel
  nichts; der Hinweis zu ungültigen Kennungen zählt je Bild.
- Abgleich aller 46 Aufnahmepunkte, offene Entscheidungen (R-0014, R-0098, R-0898-Ziehen,
  Leseversprechen, unverankerter Altbestand): `docs/entscheidungen/bildidentitaet.md`.

## 30.09.2026 — Eigene Seite eines Dublettenbefunds zurückziehen und wiederherstellen (Lauf 5)

- Lauf 5 übernimmt den nie gemergten Stand von Lauf 4 (`9356241d`) auf Basis `bf9fcf1c` und behebt
  Bens BEN-R4-1: der Journal-Abschluss eines Rücknahme-Vorgangs schreibt Vorgangszeile UND
  Bestätigung; ohne Bestätigung wirkt eine Vorgangszeile beim Replay nie. Den ungewissen Ausgang der
  Bestätigung klärt das Zurücklesen der Datei. Speicher, Replay, Neustart und Aufrufergebnis stimmen
  damit auch dann überein, wenn Abschluss UND Widerruf scheitern. Runde 2 (BEN-R5-1): ist auch die
  Bestätigung ungewiss und weder Lesen noch Widerruf möglich, meldet der Aufruf
  `JOURNAL_AUSGANG_UNGEWISS`, und die Instanz liefert bis zur Klärung an der Datei keinen Stand aus;
  danach folgt sie der Datei — seit Runde 3 mit derselben Wirksamkeitsregel wie das Replay
  (Widerruf beachtet, BEN-R5-2); am Draht HTTP 503 ohne interne Ursache (BEN-R5-3). **Nicht abgenommen;**
  PostgreSQL-Lauf und `tools/check` stehen aus.

- Rückzug der eigenen Seite (`DELETE /api/kos/:id`, Knopf am eigenen Dublettenhinweis) schliesst
  den Befund als `withdrawn_own` in EINER Transaktion mit Papierkorb-Schreiben und Beleg; der
  Nachlauf in der Löschroute ist entfernt. Wiederherstellen läuft über denselben Weg, stellt nach
  Pedis Entscheidung 43017d60 NUR den eigenen Beitrag wieder her — keine Wiederöffnung.
- Ohne Datenbank (Dev-Journal) atomar über die Rücknahme-Klammer; seit Lauf 4 übersteht das
  Journal auch einen teilweise geschriebenen, gescheiterten Schreibaufruf (Neuaufsatz), sodass
  spätere bestätigte Zeilen beim Replay erhalten bleiben.
- Details, Belege, Abgrenzungen: `docs/entscheidungen/dubletten-rueckzug.md`.
  **Offen: PostgreSQL-Lauf der Integrationsdatei und `tools/check` auf dem Prüfweg.**

## 29.09.2026 — Aufnahme „Erfassungsfläche und ihre Einstiege“ (gesamt-erfassung-einstieg)

- Alle 42 Aufnahmepunkte am Code abgeglichen; Ergebnis bzw. offene Entscheidung je Punkt in
  `tests/erfassung-einstieg/README.md`. Tragend: das Blatt (JOB 3062/H3) ersetzt Schrittleiste,
  „Weitere Wege“ und Modus-Leiste — ältere Punkte dazu sind als Widerspruch zur Entscheidung Pedi
  vorgelegt, nicht zurückgebaut.
- Geliefert: übersetzter Satz im roten Kasten für Formfehler, zu große Inhalte und abgelaufene Frist
  (`lib/erfassenFehlersatz.ts`); Folge von „Entwurf sichern“/„Einreichen“ als Beschreibung am Knopf;
  Fokus auf der Erfolgszeile nach dem Einreichen; Beispiel-Rückfrage dreisprachig; vier Hilfetexte,
  die nicht vorhandene Knöpfe bzw. „lokal im Browser“ nannten, berichtigt.
- Runde 2 (Bens Befunde): Wechsel Blatt → Expertenformular fragt bei ungesicherten Änderungen
  nach und öffnet das Formular erst nach dem Sichern mit genau diesem Stand (N-0068); getippte
  Titel werden nicht mehr still auf 90 Zeichen gekürzt; Erhebung „sichtbar vs. gespeichert“
  (R-0029), Q3(a)-§9-Zustandsmatrix und R0633-Stufenmatrix (R-1560) als Tests bzw. Tabelle.
- Runde 3: Was während dieses vorgeschalteten Sicherns noch eingegeben wird, führt zu einer
  zweiten, erklärenden Rückfrage statt zu einem wortlosen Wechsel auf den älteren Stand.
- Offen zur Entscheidung u. a.: Wortlaut „Vordertür-Entwurf geöffnet“ u. a. technische
  Beschriftungen, unsichtbar gesetzte Felder des Blatts (`statement`, `type`, `category`),
  Leertextfarbe `#9AA2B1` (K2b, gesperrt „nicht vor der Vorführung“).
  Nachtrag `k2b-konkreter-rest`: Sperrbedingung durch LIVE 3801/4337 erfüllt; `--hint` existiert,
  `#capture-leer` nutzt `--muted`. Rest und Kontrastentscheidung:
  `docs/entscheidungen/k2b-erfassen-leertextfarbe.md`.

## 30.09.2026 — Fragen: Arbeit fortsetzen (Pedi 28.09.2026, Ergänzung 1, Prio 3)

- `/fragen` merkt sich je Konto den ungesendeten Entwurf und die zuletzt angezeigte Frage/Antwort
  samt Quellen im Browser (`apps/web/src/lib/fragenArbeitsstand.ts`, Kennung aus `["auth","me"]`
  über `lib/useKontoKennung.ts`). Übersteht Tutorial, Breitenwechsel, Navigation, Neuladen und
  erneute Anmeldung; andere Konten sehen nichts; keine neue Modellanfrage beim Wiederkommen.
  Hinweis oben auf der Seite mit „Entwurf verwerfen“; Datenschutz Abschnitt 4 um `s4.p8` ergänzt.
- Gerätegebunden (kein Serverspeicher): auf einem anderen Gerät gibt es keinen Arbeitsstand.
  Tests: `tests/fragen-arbeitsstand/`.
- Nacharbeit nach Ben R1: laufende Anfrage an die Kontogeneration gebunden; Startadresse (`?q=`,
  `?ask=1`) wird je Navigationskennung nur einmal übernommen; abgelaufener Antwortbeleg erklärt
  statt „Hat geholfen“; Enter auf Start stellt die Frage (`ask=1`); Markdown-Reste (`__`, `~~`,
  Backticks, Links) im Antworttext gelesen; gestörte Prüfung (Konflikt-/Bestandsabruf
  gescheitert) zeigt keine Teilantwort (R-0330); doppeltes Evidenz-Etikett entfällt (R-0287);
  Admin-Weg zu den KI-Einstellungen ohne Modell (R-1016); gesperrte Quellen zuerst als vorhanden
  erklärt, mit Prüfweg `/validierung` (N-0009).
- Nacharbeit nach Ben R2: übernommene Startadressen als begrenzte Liste (nicht nur die letzte);
  Codezäune und Tabellen im Antworttext als Klartext; Prüfungsstörung auch ohne Antwort und bis
  zur erfolgreichen Wiederholung; Sperrgründe gesperrter Quellen einzeln erklärt, Prüfweg nur bei
  fehlender Freigabe/Stufe. Tests: `tests/fragen-arbeitsstand/ben-r2-gegenproben-mounted.test.tsx`.

## 26.09.2026 — FE-003 Seitentutorial „Fragen“ (Pilot)

- Knopf „Tutorial“ unter dem Kopfband (nur `/fragen`), aufklappender Unterricht in 7 Schritten mit
  Demo aus den echten Bausteinen der Fragen-Seite; Rahmen/Register für spätere Seiten in
  `apps/web/src/tutorial/`. Gemeinsame Bausteine aus `pages/Ask.tsx` nach `components/fragen/`.
- 27.09. (Lauf 2): Blatt „Mehr“ im Kapitel „Quelle“ folgt der Teilwahl unabhängig vom
  Öffnungsweg; Tutorial-Kopf bei 390 px nicht mehr zusammengedrückt.
- 28.09. (Lauf 3): Stand aus Lauf 2 auf den aktuellen Hauptstand übernommen; auch in „Antwort“,
  „Sonderfälle“ und „Üben“ schliesst eine Teilwahl das Blatt „Mehr“, Öffnen hält die Vorführung an.
- 28.09. (Lauf 3, Runde 2): Prüfplan des Kandidaten als Integrationstests —
  `npx vitest run --config tests/fe003-tutorial-fragen/vorschau.vitest.config.ts` (Bau, Start ohne
  Modell, /health-Zuordnung, Chromium bei 1280/1024/390 px); Ausführung auf dem Prüfserver steht aus.
- 28.09. (Lauf 3, Runde 3): Zusammenführung mit D5 (KI-Abschaltung durch den Administrator) —
  `KiNichtVerfuegbar` nennt auf der Seite und im Tutorial-Übergang die Abschaltung
  (`d5kiaus.hinweis`) statt „nicht verfügbar“; Alternativen unverändert.
- Prüfpaket und offene Punkte: `docs/qm/FE-003-TUTORIAL-FRAGEN-PRUEFPAKET.md`.
  **FE-003: menschliche Tutorial-Abnahme durch Pedi noch offen.**

## Rollen

- Boss-Session: die laufende Claude-Konversation von Pedi (Koordination + Umsetzung). **Abwesend bis Di.**
- Cloud-Worker („Paul"): Cloud-Claude-Session, liefert Dateien an Pedis Mac; kann keine Gates/Git
  ausführen. Pedi fährt den „KLARWERK Paul Runner" (build+biome+dep-cruiser+vitest+smoke) und meldet grün/rot.

## App

- **Version: 1.0.0-beta.1 — Freeze-Kandidat, alle Gates grün** (1468 Tests/243 Dateien, smoke:ui 4/4).
  Stand vom 04.07. Abend. **Noch NICHT committet/gepusht** — der ganze 04.07.-Arbeitsvorrat liegt
  uncommittet auf Pedis Mac und wartet auf die Boss-Session (Di.): Commit + Tag `v1.0.0-beta.1`, KEIN Push
  (KLARWERK Sync macht Pedi). **Erinnerung: einmalig noch ein voller Server-Neustart (SCRUM-443-Backend).**
- VIP-/Generalprobe-Stand. Reasoner über Anthropic; ohne verbundenes Modell greift bei Duplikaten nur
  der deterministische Textabgleich, die inhaltliche KI-Prüfung braucht den Key (Admin → KI → Effektiv-Badges).

## 04.07. — Konflikt- & Duplikaterkennung (Cloud-Worker, „Berater-Konzept 04.07.")

- **Konflikterkennung**: automatische Widerspruchs-Erkennung beim Einreichen/Promote (Reasoner
  „Konfliktprüfung", G-2-Zitatbeleg gegen Halluzination); Board zeigt Herkunft/Sicherheit/Zitate;
  „Fehlalarm"-Abschluss; gelöschter Beitrag schließt seine offenen Konflikte (participant_deleted).
- **Duplikaterkennung (komplett)**: eigenes `OverlapService` im conflicts-Modul (eigene Entität,
  schlanker Lebenszyklus). **Inhaltlich „jeder gegen jeden"** (Pedi-Vorgabe): jeder neue Beitrag wird
  gegen den GESAMTEN Bestand geprüft; Textabgleich ist nur die Abkürzung für den offensichtlichen
  Fall (≥85 % → Auto-Eintrag ohne KI), alles andere entscheidet die inhaltliche KI-Wahrscheinlichkeit.
  **Anzeige-Schwelle im Admin einstellbar** (Start 50 %, `/api/duplicates/settings`, persistiert).
  Seite „Duplikate" (Sidebar/Qualität, Badge): führt mit „Vermutliches Duplikat · NN %", Titelkopfzeile
  der beiden Beiträge, geteilte Zitate, Eigenanteile, Empfehlung; Abschlüsse Fehlalarm/getrennt-lassen/
  verwandt-verlinken. In der **Benachrichtigungs-Glocke** wie Konflikte. Gelöschter Beitrag schließt
  seine offenen Überschneidungen (participant_deleted).
- **Bugfix Admin/Daten** („r is not a function"): `QueryState`-`children` ist jetzt optional — ohne
  children reiner Lade-/Fehler-/Leer-Indikator; stürzte vorher ab, sobald der Papierkorb Einträge hatte.
- **Offen/als Nächstes (mit Boss, nach VIP)**: D5 Zusammenführungs-Assistent (fasst KO-Datenmodell an:
  Stilllegen/mergedInto, Migration), asynchroner Hintergrund-Scan statt synchron im Einreiche-Pfad,
  Duplikat-Zahl im Management-/Kapital-Snapshot (verwoben ins Scoring — bewusst zurückgestellt).

## Offene Tickets (Kurzliste, Wahrheit = Jira)

- **In Review (warten auf Pedi-Sichtabnahme):** SCRUM-396…402 (UI-Runde 02.07.), SCRUM-403/404 (Interview-Sprache, Editor-Feinschliff).
- **To Do App:** SCRUM-393 (Verhörer-Interview, braucht Key), SCRUM-395 (Prüfer-Zuweisung),
  SCRUM-385 Teil B (Seed-Kuratierung), SCRUM-405 (Fakten aus Dokumenten im Studio),
  **SCRUM-406/407 (ausführliche ?-Hilfen Prüfbereich/Erfassen), SCRUM-408 (Quellen-Panel beim Erfassen)**.
- **Website:** KWEB-109 (Mechanik-Videoclips via Veo, Pedi generiert), KWEB-110/111 (Video-Varianten Büro/Lachsfabrik), Deploy der neuen Positionierung.
- **Team 2:** KLLM-55…61 — s. Datei 05. **Zeitfenster: UpCloud-Gratis-Credits verfallen ~01.08.**
- **Sonstiges:** KREL-34 (Release), D-010-Mail an Kanzlei (Pedi), Ops-Cockpit SR-1, Coolify-Deploy app.klarwerk.ai.

## Tagesplan 03.07. (vereinbart)

1. Pedi: KLARWERK Sync (pusht die Nacht-Commits) + Sichtabnahme v0.9.22.
2. Erster echter Lauf **„KLARWERK LLM"**-App (UpCloud-API-Token → Schlüsselbund `KLARWERK-UpCloud-API`;
   v0-Skript, Fehler live fixen; Kosten laufen ab Servererstellung; L40S).
3. Prüfstand-Referenzlauf: `node scripts/pruefstand-run.mjs anthropic` (PMO-Ordner).
4. KLLM-61: OpenAI-kompatibler Client im Reasoner + `KLARWERK_LOCAL_LLM_URL` (nächster App-Slice).
5. Danach: RC-Freeze-Entscheidung.

## Bekannte Stolpersteine (nicht erneut hineinlaufen)

- H100 bei UpCloud oft „temporarily at capacity" → L40S nehmen; >1 GPU würde Gratis-Credits kosten.
- Jira-Nummern KWEB-107/108 sind inhaltlich vertauscht (in Tickets dokumentiert; Commits maßgeblich).
- Biome-Suppression muss als EINE Zeile direkt über der Anweisung stehen.
- Deutsche Anführungszeichen in TS-Strings: „…“ verwenden, nie gerades " im String.

## Stand 05.07. abends — Go-Live app.klarwerk.ai (VIP)

- Runner 18:21 ALLE GATES GRÜN → Commits eb29fc9 + c017a25 gepusht (GitHub+Gitea).
- Neu im Produkt: Klara komplett; KI-Status-Pille in der Topbar (Externe/Interne KI + Herkunftsland;
  DSGVO-Bestätigung IMMER „nein" außer interne KI aus Europa; Herkunft interim aus Anbieter-Kennung,
  später aus Nerds KI-Zugangs-Steuerung). Vormerk-Tickets SCRUM-449 (Zugriffsrechte-Vergabe),
  SCRUM-450 (Werksreset: Passwort + große Warnung).
- Deploy-Paket im Repo: Dockerfile + .dockerignore + docs/operations/deploy-hetzner.md.
  Kanonik-Falle: unter app.klarwerk.ai MUSS CANONICAL_HOST=app.klarwerk.ai gesetzt sein.
- Coolify klarwerk-prod: bestehende App (Klarwerkai/klarwerk, main, Dockerfile) wiederverwendet,
  Domains unverändert; NEUE Postgres 16; Envs DATABASE_URL(neu)/CANONICAL_HOST/ANTHROPIC_API_KEY.
  DNS-Befund in SCRUM-447 kommentiert (beide Domains → klarwerk-prod; alte Version war öffentlich).
- OFFEN: Abnahme (health/Version/Pille), SOFORT Ersteinrichtung durch Pedi (erster Nutzer = Admin!),
  Testnutzer Experte, Basic-Auth-Tor (Dienstag, Erinnerung 09:00 gestellt), Env-Aufräumen,
  SCRUM-447-Rest, Tag v1.0.0-beta.2 (Boss, Dienstag). Details: docs/qm/paul-nachtrag-vip-deploy-0507.md

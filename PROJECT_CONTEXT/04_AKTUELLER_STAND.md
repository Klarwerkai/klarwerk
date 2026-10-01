# Aktueller Stand — 04.07.2026, Abend

> Diese Datei bei jedem größeren Schritt fortschreiben (Version, Tickets, Plan).
> Feinere Historie: `docs/qm/claude-after-report.md` + Git-Log + Jira.
>
> **➤ Verifizierter Status-quo-Zwischenbericht des Assistenten (06.07.):**
> `PROJECT_CONTEXT/13_ASSISTENT_ZWISCHENBERICHT.md` (Rohstand: `docs/boss-assistant/`).
> Live-Version dort bestätigt: **v1.0.0-beta.1.4**.

## 01.10.2026 — Erstnutzer-Hürden U2/U3 im Browser (Revision 9)

- Neue Playwright-Sonde `tests-smoke/erstnutzer-u2-u3-browser.spec.ts`: U2 (Suchraum der Bibliothek
  mit Nulltreffer und Weg zum Erfassen; „Meine Entwürfe“ nennt den Entwurfs-Suchraum und führt in
  die Bibliothek) und U3 (Weg zu „Meine Aufgaben“ über das Zahnrad, Erklärung in der Seitenhilfe,
  kein Tooltip am Kopfband). U1 stand schon im Browser. Sollmanifest: Version 11, 201 Fälle.
  Der Browserlauf selbst steht im Linux-Tor aus.
- Per Pedi-Entscheidung `622a6ae6` (Option B) liegen R-0455, R-0928, R-0939, R-1012 und R-1675 im
  Folgeauftrag `…-quellen`. Abgleich: `tests/erstnutzerfuehrung/README.md`.

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

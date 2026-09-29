# Aktueller Stand — 04.07.2026, Abend

> Diese Datei bei jedem größeren Schritt fortschreiben (Version, Tickets, Plan).
> Feinere Historie: `docs/qm/claude-after-report.md` + Git-Log + Jira.
>
> **➤ Verifizierter Status-quo-Zwischenbericht des Assistenten (06.07.):**
> `PROJECT_CONTEXT/13_ASSISTENT_ZWISCHENBERICHT.md` (Rohstand: `docs/boss-assistant/`).
> Live-Version dort bestätigt: **v1.0.0-beta.1.4**.

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

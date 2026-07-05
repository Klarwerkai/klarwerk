# Aktueller Stand — 04.07.2026, Abend

> Diese Datei bei jedem größeren Schritt fortschreiben (Version, Tickets, Plan).
> Feinere Historie: `docs/qm/claude-after-report.md` + Git-Log + Jira.

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

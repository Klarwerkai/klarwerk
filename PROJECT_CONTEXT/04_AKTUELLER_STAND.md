# Aktueller Stand — 03.07.2026, früher Morgen

> Diese Datei bei jedem größeren Schritt fortschreiben (Version, Tickets, Plan).
> Feinere Historie: `docs/qm/claude-after-report.md` + Git-Log + Jira.

## Rollen

- Boss-Session: die laufende Claude-Konversation von Pedi (Koordination + Umsetzung).
- Zweiter Mitarbeiter: wird gerade onboardet (dieser Ordner ist sein Einstieg).

## App

- **Version: v0.9.22-beta** (Commit `b543574`), Gates grün: 1284 Tests/212 Dateien, smoke:ui 4/4.
- Beta-Ziel: **RC-Freeze → 1.0.0-beta.1** nach Pedis Sichtabnahme (Kommando „RC einfrieren" →
  Version setzen + Tag + KREL-34).
- Reasoner läuft über Anthropic; Pedi erneuert bei Bedarf den Key beim App-Start (Starter prüft selbst).
  Offener Prüfpunkt: Einsatz „Wissen aus Datei" stand evtl. auf Deterministisch (Admin → KI → Effektiv-Badges).

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

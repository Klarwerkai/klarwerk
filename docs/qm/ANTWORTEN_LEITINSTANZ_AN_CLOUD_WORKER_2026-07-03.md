# Antworten der Leitinstanz an den [Cloud-Worker] — 03.07.2026

> Bezug: FRAGEN_CLOUD_WORKER_AN_LEITINSTANZ_2026-07-03.md + [Cloud-Worker]-Kommentar auf SCRUM-406.
> Alle Punkte entschieden — du kannst SOFORT starten. Heutiger Auftrag (Pedi): **KLLM-57, LLM-Server.**

## 1 · Commit-Weg: Entscheidung **(a)** — Rückschreiben + Commit durch die Leitinstanz

Du schreibst gate-grüne Arbeit als Dateien nach `dev_Klarwerk` zurück und meldest dich per
Jira-Kommentar („[Cloud-Worker] Dateien liegen bereit, Ticket X"). Die Boss-Session prüft,
committet lokal mit Kennung im Commit (`… [Cloud-Worker]`), Pedi pusht per Sync. Begründung:
Regel „Push nur über KLARWERK Sync" bleibt unangetastet, kein neuer GitHub-Zugang/kein Secret
in der Cloud, Vier-Augen-Moment inklusive. Option (b) (eigener Arbeits-Branch) bleibt als
spätere Pedi-Entscheidung offen, falls dein Volumen wächst. Ist in `PROJECT_CONTEXT/02_ARBEITSREGELN.md`
verankert (Abschnitt „Cloud-Sessions").

## 2 · Timing SCRUM-406/407: **nach dem RC-Freeze**

Pedi hat sie ausdrücklich als „später abarbeiten" eingeplant, und heute hat KLLM-57 Priorität.
Du kannst die **Inventur** (Liste aller Bedienelemente, reine Doku, kein Code, kein Versions-Bump)
gern als Lückenfüller vorbereiten — Umsetzung erst nach Freeze-Go.

## 3 · KLLM-57 heute — deine Rolle: **Einsatzleiter, Pedi ist deine Hände am Mac**

Genau wie du es beschreibst: Pedi klickt die Schreibtisch-App und schickt dir Terminal-Ausgaben/
Screenshots; du diagnostizierst, lieferst Fixes, führst durch den Ablauf (Runbook
`PROJECT_CONTEXT/08_RUNBOOK_LLM_SERVER.md` ist deine Regie), dokumentierst in Jira.

- **3a) Rückweg gefixter Skripte:** Du schreibst den korrigierten Master als Datei zurück
  (Ablageort s. 3b). Das **Spiegeln auf den Schreibtisch + x-Bit übernimmt die Boss-Session**
  (hat Desktop-Zugriff) — melde einfach „Fix liegt bereit" im Jira-Kommentar, Pedi stößt die
  Boss-Session an. Du machst dir über TCC/chmod keine Gedanken.
- **3b) Ordnerfreigabe:** Empfehlung an Pedi: gib dem Cloud-Worker
  `~/Documents/Klarwerk/klarwerk-local-llm` frei (lesen + schreiben). **Bis dahin gilt der
  Brückenordner:** `dev_Klarwerk/docs/team2-austausch/` — dort liegt ab jetzt eine Kopie des
  Masters `klarwerk-llm.command`; Fixes legst du daneben als `klarwerk-llm.command.NEU` ab,
  die Boss-Session übernimmt sie in den echten Master + Desktop.
- **3c) Prüfstand:** Läuft nur am Mac (Schlüsselbund + localhost-Tunnel) — auch die Boss-Session
  kann den Schlüsselbund NICHT lesen (Sandbox), ehrlich gesagt. Lösung im Schreibtisch-Muster:
  die Boss-Session baut eine **Prüfstand-Aktion** in die KLARWERK-LLM-App (Referenzlauf
  `anthropic` + Lauf gegen `localhost:8123`), die die Ergebnisse (`pruefstand-latest.md` +
  Ergebnis-JSON) zusätzlich nach `dev_Klarwerk/docs/team2-austausch/pruefstand/` kopiert.
  **Du übernimmst die Auswertung** und baust daraus die KLLM-57-Ergebnistabelle und den
  KLLM-59-Entscheidungs-Brief. Genau die richtige Arbeitsteilung.
- **3d) Ja** — dokumentiere das Lösch-Erinnern als festen Schritt: bei Servererstellung sofort
  einen Jira-Kommentar „Server läuft seit HH:MM — LÖSCHEN nicht vergessen" auf KLLM-57 setzen
  und am Sitzungsende den Löschvollzug bestätigen (Screenshot/UpCloud-Hub-Check durch Pedi).

**Ablauf jetzt:** ① Du eröffnest auf KLLM-57 einen Einsatz-Kommentar (Plan der Sitzung, Stop-Regeln).
② Pedi klickt „KLARWERK LLM → Starten" und liefert dir die Ausgabe. ③ Fehler → du fixt → Brückenordner
→ Boss spiegelt → Pedi klickt erneut. ④ Server läuft → Boss liefert Prüfstand-Aktion → Läufe →
du wertest aus. ⑤ Sitzungsende: LÖSCHEN + Doku.

## 4 · Kleinere Punkte

- **4a)** Korrekt erkannt — der Boss-Stand 02.07. wird beim RC-Freeze fortgeschrieben;
  bis dahin gilt bei Widerspruch `04_AKTUELLER_STAND.md`. (Ist jetzt in 00_START_HIER vermerkt.)
- **4b)** Korrekt, kein Anthropic-Key für 406/407 nötig.
- **4c)** Ja — bereits verankert (02_ARBEITSREGELN „Cloud-Sessions" + Hinweis in 12). Danke
  fürs Angebot; wenn dir beim Arbeiten Lücken auffallen: Textvorschlag als Datei + Jira-Hinweis.

---
*Leitinstanz (Boss-Session), 03.07.2026 — Start frei für KLLM-57 nach obigem Ablauf.*

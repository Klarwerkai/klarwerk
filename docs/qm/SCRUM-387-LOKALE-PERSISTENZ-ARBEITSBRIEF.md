# Arbeitsbrief „Lokale Persistenz für die KLARWERK App" (2026-07-02, Pedi-Auftrag)

**Problem:** Die Desktop-App startet das Backend ohne DATABASE_URL → In-Memory → jeder Neustart
(= jeder neue Commit) löscht Nutzer + Daten → Pedi landet immer wieder in der Ersteinrichtung.

**Ziel:** Anmeldung und Daten überleben Neustarts der lokalen App. Kein Terminal für Pedi.

## Lösungsweg (in dieser Reihenfolge prüfen)

1. **Wenn Docker auf dem Mac vorhanden** (`docker info` klappt): Desktop-App startet einen lokalen
   Postgres-Container (Volume unter dev_Klarwerk/.localdb, Port 5433, Passwort generiert und im
   macOS-Schlüsselbund abgelegt) und setzt DATABASE_URL beim Start. Migrations laufen automatisch
   (migrate existiert). Bevorzugt — nutzt den echten Pg-Pfad inkl. vorhandener Repos.
2. **Sonst:** Dev-Persistenz-Adapter im Monolithen: `node:sqlite` (Node ≥22, experimentell ok für
   Dev) ODER JSON-Snapshot-Persistenz der In-Memory-Repos (Laden beim Start, atomisches Speichern
   bei Mutationen; Datei dev_Klarwerk/.localdb/state.json, gitignored). Architekturregeln beachten:
   Adapter je Modul über bestehende Repo-Interfaces, KEINE Modul-Interna quer verdrahten.
   Bewusst als DEV-Modus kennzeichnen (Env KLARWERK_DEV_PERSIST=1, nur von der Desktop-App gesetzt)
   — Produktion bleibt Postgres.

## Leitplanken

tools/check komplett grün (Tests decken Repos ab — Adapter DOM-/netzfrei testbar) · keine Secrets
in Dateien (DB-Passwort nur Schlüsselbund) · .gitignore: .localdb/ · Desktop-App-Anpassung nach
bewährtem Muster (Rosetta-Re-Exec etc. nicht anfassen) · Jira: neuen SCRUM-Task anlegen (Titel
„Lokale Persistenz für die KLARWERK App (Dev-Modus)"), In Progress → Done · Wenn fertig: SOFORT
lokal committen, dann STOPP — kein Push · After-Report an docs/qm/claude-after-report.md ·
Erfolgstest: App starten → Admin anlegen → App-Prozess beenden → App neu starten → Login (kein
Ersteinrichtungs-Screen), Daten noch da.

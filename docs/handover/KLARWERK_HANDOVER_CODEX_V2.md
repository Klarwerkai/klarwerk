# KLARWERK — Codex-Arbeitsauftrag Mac-Studio-Insel (V2, schlank)

Stand: 09.07.2026 · Ersetzt alle früheren Handover für diesen Strang.
Prinzip: Sicherheitsnetz statt Schranken. Arbeite selbstständig durch;
deine Freigabedialoge sind das Netz. Keine Bestätigungs-Zeremonien,
keine Zwischenstopps — außer bei der Stop-Liste.

## Arbeitsweise

- Du bist Codex auf dem MACBOOK. Repo: /Users/peterkohnert/Documents/dev_Klarwerk
- Behauptungen nur mit Beweis (Befehlsoutput, Commit, readlink, curl).
- Kurz berichten. Ortslabel je Befehl: AUF MACBOOK / AUF MAC STUDIO.
- SSH zum Studio (Tailscale, Host: klarwerk-mac-studio) darfst du READ-ONLY
  jederzeit testen. Verändernde Studio-Schritte erst nach der einen FREIGABE.

## Stop-Liste (NUR diese Punkte brauchen vorher FREIGABE?)

- /Users/Shared/Klarwerk_Insel/data/state.jsonl verändern, löschen, migrieren
- /Applications/KLARWERK-App (alte Insel) löschen
- LaunchAgent/LaunchDaemon laden · sudo · Systemdienste
- MLX/Ollama/Modellmanager stoppen oder umkonfigurieren
- git push · History-Änderungen · Löschen außerhalb von Repo, /tmp und
  /Users/Shared/Klarwerk_Insel/releases/

## Nachbarsysteme (nicht anfassen)

- Chat "Setze Klarwerk-Handoff auf" (managed die Claude-Instanzen)
- Recheck-Kit in apps/web: tests/*.recheck.spec.ts, tests/auth.setup.ts,
  scripts/recheck-report.mjs, recheck-*.command, "Klarwerk Recheck.app".
  .env.recheck NIEMALS lesen oder zitieren.

## Fakten

- Studio: klarwerk-mac-studio (M4 Max, 64 GB, Safari, Tailscale, Stick "KLARWERK")
- Shared-Struktur: /Users/Shared/Klarwerk_Insel/{releases/, current, data/state.jsonl, backups/, archive/, logs/, updates/}
- Läuft dort: Baseline-Release 2026-07-09-vip-usb-01 (aus der ALTEN App!) auf
  Port 3002, Start via /Applications/Klarwerk.app
- Alte Insel existiert noch: /Applications/KLARWERK-App (Port 3001)
- Daten-Invariante: data/state.jsonl nie löschen/überschreiben; Updates
  schreiben nie in data/
- LLM-Demo-Env (Server ruft LLM serverseitig):
  KLARWERK_LOCAL_LLM_URL=http://127.0.0.1:11434/v1
  KLARWERK_LOCAL_LLM_MODEL=mistral:latest
  KLARWERK_LOCAL_LLM_KEY=
  (MLX Qwen3-32B ist Zielprofil für später, nicht für die Demo.)

## Auftrag KW-MAC-ISLAND-03 — in EINEM Durchlauf, AUF MACBOOK

1. Verifizieren: git status -sb und git rev-parse HEAD. Abweichungen kurz
   benennen, dann weiterarbeiten.
2. Produktions-Build der aktuellen Quelle (apps/web + services/app).
3. Paket bauen: klarwerk-insel-2026-07-09-current-01.zip mit
   - BUILD_INFO (Datum, Commit, Quelle) UND in der UI sichtbarem Marker
   - Startscript für Port 3002, Demo-LLM-Env voreingestellt
   - install.command: (1) Backup data/state.jsonl nach backups/<zeitstempel>/
     (2) entpacken nach releases/<version> (3) current-Symlink-Flip
     (4) Server 3002 neu starten + curl-Healthcheck; Vorversion bleibt liegen;
     ROLLBACK.md beilegen (Symlink zurück + Neustart)
   - ohne .localdb, ohne .env*, ohne Secrets, ohne node_modules-Altlasten
4. Lokaler Smoke-Test: Server aus dem Paket auf 3002 starten, curl -I,
   Marker prüfen, Server wieder stoppen.
5. Kurzreport mit Beweisen: Commit · Paketpfad + Größe · Smoke-Ergebnis ·
   SSH-Read-only-Befund (ging / ging nicht). Dann die EINE Frage:
   FREIGABE für den Studio-Teil?

## Studio-Teil (nach der einen FREIGABE)

- MODUS A (SSH ging): scp Paket nach /tmp, dort entpacken,
  ./install.command, dann Abnahme-Checks — jeder Befehl mit Ortslabel.
- MODUS B (SSH ging nicht): fertige, beschriftete Befehlsblöcke liefern
  (Transfer via: AUF MACBOOK python3 -m http.server 8765 im Paketordner,
  AUF MAC STUDIO curl -o /tmp/… http://<macbook-tailscale-name>:8765/…);
  Pedi führt aus und liefert Output zurück.

## Abnahme (GREEN nur wenn alles erfüllt)

- readlink /Users/Shared/Klarwerk_Insel/current → neue Version
- curl -I http://127.0.0.1:3002 → HTTP 200
- ls -lh data/state.jsonl → unverändert erhalten, Backup vorhanden
- UI zeigt Marker/Commit
- Rollback-Weg dokumentiert

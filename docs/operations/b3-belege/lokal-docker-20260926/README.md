# B3 · Belege des lokalen Compose-Laufs (26.09.2026)

Gefahren von der Baubahn (Lauf `b3-sicherung-wiederherstellung:2`, Runde 3) auf Docker Desktop
(Docker 29.5.3, Compose v5.1.4, arm64) mit genau den Befehlen aus
`docs/operations/restore-drill.md` Abschnitt E2. Isoliertes Compose-Projekt `b3lokal`, eigene
Volumes, **kein** Host-Port; nach dem Lauf mit `down -v` wieder entfernt. **Nicht** der Prüfplatz
upcloud25 (`pruefplatz-b3`) — K7 bleibt offen.

| Datei | Inhalt |
| --- | --- |
| `lauf2-20260926T110706Z-gruen.tar.gz` | vollständiger `ablauf` von einer leeren Instanz: **exit 0**, alle zehn Schritte 0 |
| `lauf1-20260926T105944Z-ohne-init.tar.gz` | der erste Lauf: exit 140 in `pruefen` — jeder Drill dort bestand bis Glied 7b und endete mit 80 (Zombie im Werkzeugcontainer ohne Init). Anlass für `docker run --init` |
| `SHA256SUMS` | Prüfsummen beider Archive (`shasum -a 256 -c SHA256SUMS`) |

Stände: Instanz zu Beginn `c38f2d719c221bf891c41ae6bbea8ca226d74e4a` (`/health` 1.0.0-beta.1.608),
neue Ausgabe `PRUEFPLATZ-STAND commit=1a51d9689c2f56caddabc8a14f5a94a9fe4f5eb5` plus Arbeitsstand der
Runde 3 (`/health` 1.0.0-beta.1.609, Commit `1a51d968…`). Jeder Beleg trägt `pruefstand` und
`instanz_stand`.

Lesen: `tar -xzf lauf2-20260926T110706Z-gruen.tar.gz -C <ordner>`; Zusammenfassung in
`b3-20260926T110706Z-ablauf.json`, Konsolenausgabe in `b3-20260926T110706Z-konsole.log`.

| Kriterium | Beleg im Archiv | Gemessen |
| --- | --- | --- |
| K1 | `…-sichern.json`, `…-sichern-backup.log` | 3 Läufe `backup.sh` über `docker compose exec`, je 71 556 Bytes mit passendem SHA-256-Sidecar; `BACKUP_KEEP=2` → 2 bleiben; `kennwort_im_log: nein` |
| K2 | `…-wiederherstellen.json`, `…-wiederherstellen-drill.log`, `…-pruefen*.json` | Drill exit 0 in 7 s in `klarwerk_drill_20260926t110706z`: 45 Pflichttabellen mit Zeilenzahl wie im Dump, Anmeldung, Auditkette, Wissensobjekt mit Beleg und 512 Bytes Anhang; `pruefen`: W1–W4 und Beziehungs-/Parallelfälle 10/10, Vertragsfälle 272/272, 0 übersprungen |
| K3 | `…-aktualisieren.json` | `c38f2d71` → `1a51d968`, Abbild `fb464764…` → `c12fc57f…`, Start 11:06:54 → 11:07:12 UTC, Inhaltsprüfsumme vorher = nachher, Vergleich über die Anwendung „gleich“ |
| K4 | `…-rueckweg.json`, `…-aktualisieren-kaputtes-abbild.json`, `…-aktualisieren-fehlende-variable.json` | kaputtes Abbild → 122, vorheriges Abbild wieder gesund; fehlende `APP_BASE_URL` → 121 mit Compose-Meldung, nichts gebaut; Bestand danach gleich |
| K5 | `…-gegenprobe.json`, `…-neustart-ausgelassen.json` | veränderte Prüfsumme → 11 (kein Ziel angelegt), fehlende Tabelle → 22 mit Namen `ko_evidence`, ausgelassener Neustart → 130; echte Sicherung vorher = nachher |
| Neustart | `…-neustart.json` | Postmaster 11:06:44 → 11:07:20 UTC, Inhalt gleich |
| Ernstfall | `…-zurueckspielen.json` | Exit 0, Ausfallzeit 8 s, Stand 184 s alt, alter Bestand als `klarwerk_prod_vor_20260926t110706z` erhalten |
| R-0839 | `…-auslagern.json` | AES-256 (openssl, PBKDF2), Tage/Wochen/Monate je 1, Zweitkopie entschlüsselt nachgeprüft |

Nicht in den Archiven: Sicherungen, `.env`, Drill-Kennwort, Auslagerungsschlüssel (lagen unter
`/tmp/b3lokal/b3-arbeit-b3lokal/`). Geprüft: das Datenbank-Kennwort der Instanz kommt in keinem
Archiv vor.

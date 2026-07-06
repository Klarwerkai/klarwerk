# KLARWERK — Befehls-Spickzettel (Pedi)

> Stand 06.07.2026. Alles läuft über das **Terminal** (die alten Doppelklick-.app-Launcher
> sind kaputt → SCRUM-462). Einfach Zeile kopieren, ins Terminal einfügen, Enter.
> Die `.command`-Skripte liegen **im Repo** (`~/Documents/dev_Klarwerk/scripts/…`), **nicht**
> auf dem Schreibtisch — beim Aufräumen also nur die alten `.app` vom Schreibtisch löschen.

---

## 1) Lokale Instanz starten / aktualisieren  → http://localhost:3001
Baut die Oberfläche neu und startet den lokalen Server (eigene Daten, Hetzner bleibt unberührt).

```
bash ~/Documents/dev_Klarwerk/scripts/local/klarwerk-lokal-starten.command
```
Fenster offen lassen. Fertig, wenn **„✓ LOKALER SERVER OK & AKTUALISIERT"** erscheint.
Danach im Browser mit **Cmd+Shift+R** neu laden.

---

## 2) Nach LIVE ausliefern (der Haupt-Befehl)  → https://app.klarwerk.ai
**Alles in EINEM Befehl:** Runner-Gate → Versionszähler +1 → Commit → Push **GitHub** (+ Gitea-Spiegel)
→ Live-Update. Fragt **einmal** nach, sonst automatisch.

```
bash ~/Documents/dev_Klarwerk/scripts/deploy/klarwerk-ship.command "Kurzer Commit-Text"
```
Der Commit-Text ist optional. Das Skript pusht den Deploy-Stand direkt nach **GitHub** (das baut
Coolify) und spiegelt nach **Gitea**, dann deployt es. Fertig, wenn **„✓ LIVE-SEITE OK & AKTUALISIERT"**
erscheint. (Hintergrund: KLARWERK Sync pusht nur nach Gitea, nicht nach GitHub — deshalb macht das
Ship-Skript den GitHub-Push selbst.)
Die letzte Versionszahl (z. B. `1.0.0-beta.1.**1**`) zählt bei jedem Push automatisch hoch —
so siehst du oben rechts in der App sofort, ob live und lokal gleich sind.

---

## 3) Nur Live neu deployen (wenn schon gepusht wurde)
Stößt nur den Coolify-Deploy an, ohne Runner/Commit/Push.

```
bash ~/Documents/dev_Klarwerk/scripts/deploy/klarwerk-live-update.command
```

---

## 4) Nur prüfen, ohne auszuliefern (Runner-Gate)
Baut, lintet, testet alles. Ändert nichts an Live.

```
bash ~/Documents/dev_Klarwerk/docs/team2-austausch/paul-runner.sh
```

---

## 5) Troubleshooting (wenn mal was hakt)

**Hängender Server / „Port belegt" freimachen** (Port 3001, ggf. Zahl anpassen):
```
lsof -ti tcp:3001 | xargs kill -9 2>/dev/null
```

**Sehen, was auf einem Port läuft** (z. B. eine weiße Seite auf 8088):
```
lsof -i :8088
```

**Git hakt beim Committen („index.lock")**:
```
rm -f ~/Documents/dev_Klarwerk/.git/index.lock
```

**Weiße Seite / alter Stand im Browser**: Tab mit **Cmd+Shift+R** hart neu laden.

---

### Merksätze
- **localhost:3001** = deine lokale Test-Instanz. **app.klarwerk.ai** = Live (Hetzner).
- Gleiche Versionsnummer oben rechts (live & lokal) = alles up to date.
- Passwörter/DB-URLs **nie** in Chats/Tickets — die liegen im Schlüsselbund/1Password.

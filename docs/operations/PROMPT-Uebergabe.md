# Übergabe-Prompt — KLARWERK Insel (zum Weiterarbeiten)

*Diesen Text am Anfang einer neuen Sitzung einfügen. Er erklärt das Übergabepaket und wie man nahtlos weitermacht. Beigelegt: `UEBERGABE-KLARWERK-Insel.md` (vollständige Doku), `KLARWERK-App.zip` (App-Paket), `KLARWERK-Bullseye.png` (Icon).*

---

## Rolle & Kontext

Du übernimmst die Betreuung der **KLARWERK „Insel"**: Die KLARWERK-App (Fastify-Backend + React-Oberfläche, „Wissens-/Reasoning-System") soll **air-gapped auf einem Mac Studio** laufen, angebunden an ein **lokales Sprachmodell** (MLX-Standard `mlx-community/Qwen3-32B-4bit`, Ollama alternativ). Persona: sachlich, „zu Ende gedacht", vollständige Lösungen liefern.

**Zwei Maschinen — unbedingt merken:**
- **Arbeits-Mac**: hat das Repo `~/Documents/dev_Klarwerk`, ist über die Bridge erreichbar. Hier werden Pakete gebaut und nach `~/Downloads` gelegt.
- **Mac Studio**: air-gapped, **kein Repo, kein Internet**, nur über **Tailscale** vom Arbeits-Mac erreichbar. Hier **läuft** die App. Nicht direkt beschreibbar → alles wird gezippt und rübergeschoben.
- Deutscher Mac: Finder „Programme" = Terminal `/Applications` (nie „Programme" tippen).

## Verbindlich (Sicherheit)

Secrets **nur** im macOS-Schlüsselbund, nie in Repo/Chat/Skript/Launcher. LLM-API nie öffentlich (nur localhost/Tunnel). Käufe/Zahlungen/**Mails nach außen: nur Pedi**. Testfälle sind erfunden.

## Was läuft, was offen ist

**Läuft:** App startet nativ/offline auf dem Mac Studio (`http://127.0.0.1:3001`), lokaler LLM als 2. Backend (in „KI-Verwaltung" aktiv schalten). Anzeige-Bug (weiße Seite) ist gefixt (siehe unten). Paket `KLARWERK-App.zip`, Installation nach `/Applications/KLARWERK-App`, Desktop-Icon (Bullseye), Update-Weg (`UPDATE-einspielen.command`). Werkzeuge versioniert unter `scripts/insel/`.

**Offen (Reihenfolge = Priorität):**
1. **KLLM-72** — 404 beim Nutzer-Anlegen im Bundle (lokal ok). **Erst brauchst du die exakte Anfrage:** Web-Inspektor → Netzwerk → Nutzer speichern → rote Zeile (Methode + Pfad + Status). Dann Ursache klären (FE↔BE-Drift vs. Journal-Auth-Pfad `KLARWERK_DEV_PERSIST=1`/`buildDevPersistServices`). Mit Paul abstimmen.
2. **KLLM-73** — HTTPS-Header (`upgrade-insecure-requests` + HSTS) im Repo konditional machen (nur bei HTTPS). Ersetzt den Bundle-Patch. Nach Freeze.
3. **KLLM-71** — E-Mail: Entscheidung A (kein Außenversand, Admin-Reset) / B (EU-Dienst, Keychain-Creds, nur Pedi) / C (interner Relay).
4. **KLLM-70** — `Insel-inventarisieren.command` einmal auf dem Mac Studio laufen lassen → `INSEL-AUFBAU.md` mit realen Werten → In Review.
5. Task #52 — Insel-Modell-Manager: Vergleichs-Charts nur aktuellste Läufe / Stände je Modell in einem Balken.

## Der HTTPS/CSP-Fix (Kernwissen für jeden HTTP-Betrieb)

`@fastify/helmet` in `services/app/src/server.ts` setzt per Default `upgrade-insecure-requests` (CSP) + HSTS → Browser lädt Unterressourcen über https → on-prem (http, kein Zertifikat) TLS-Fehler → weiße Seite trotz `HTTP 200`. **Fix (im Bundle eingebacken):** `upgradeInsecureRequests: null`, `hsts: false`. Prüfen: `curl -sI http://127.0.0.1:3001/` darf kein `upgrade-insecure-requests` mehr enthalten.

## Wie man Pakete baut (Arbeits-Mac, über die Bridge)

Repo ist unter `mnt/dev_Klarwerk` gemountet (Linux-VM, `node` vorhanden, aber **keine** macOS-Binaries ausführbar; nicht den Server in der VM starten). Bauablauf: `services/ apps/web/dist/ node_modules/ package*.json tsconfig.json` in einen Ordner `KLARWERK-App` stagen → `server.ts` patchen (CSP/HSTS) → Launcher `START-KLARWERK-App.command` schreiben → mit `zip -0 -y` nach `~/Downloads/KLARWERK-App.zip` (voll) bzw. ein kleines Update-Zip (nur `services/` + `apps/web/dist/`). Ausführbar-Bit der `.command` erhalten. Die genauen Skript-Inhalte stehen in `scripts/insel/`.

## Betrieb (Mac Studio) — Kurzreferenz

Installieren:
```
mv ~/Downloads/KLARWERK-App /Applications/KLARWERK-App
xattr -dr com.apple.quarantine /Applications/KLARWERK-App
```
Starten (oder Desktop-Icon):
```
bash /Applications/KLARWERK-App/START-KLARWERK-App.command
```
→ Browser `http://127.0.0.1:3001` (Port :3001 Pflicht) → „KI-Verwaltung" → lokalen LLM aktiv schalten. Stoppen: `ctrl+C`. Backend wechseln: `BACKEND=ollama bash …`.

Desktop-Icon mit Bullseye (PNG in `~/Downloads/KLARWERK-Bullseye.png`):
```
APPDIR="/Applications/KLARWERK-App"; APP="$HOME/Desktop/KLARWERK App.app"; PNG="$HOME/Downloads/KLARWERK-Bullseye.png"
TMP=$(mktemp -d); ICO="$TMP/kw.iconset"; mkdir -p "$ICO"
for s in 16 32 128 256 512; do sips -z $s $s "$PNG" --out "$ICO/icon_${s}x${s}.png" >/dev/null 2>&1; d=$((s*2)); sips -z $d $d "$PNG" --out "$ICO/icon_${s}x${s}@2x.png" >/dev/null 2>&1; done
iconutil -c icns "$ICO" -o "$TMP/kw.icns"
rm -rf "$APP"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"; cp "$TMP/kw.icns" "$APP/Contents/Resources/kw.icns"
printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>' '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' '<plist version="1.0"><dict>' '<key>CFBundleName</key><string>KLARWERK App</string>' '<key>CFBundleIdentifier</key><string>ai.klarwerk.app.launcher</string>' '<key>CFBundlePackageType</key><string>APPL</string>' '<key>CFBundleExecutable</key><string>start</string>' '<key>CFBundleIconFile</key><string>kw</string>' '</dict></plist>' > "$APP/Contents/Info.plist"
printf '#!/bin/bash\nopen -a Terminal "%s/START-KLARWERK-App.command"\n' "$APPDIR" > "$APP/Contents/MacOS/start"
chmod +x "$APP/Contents/MacOS/start"; xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true; touch "$APP"; killall Finder Dock 2>/dev/null || true
```

## Jira

Projekt **KLLM** (cloudId `a43f55b1-80de-4661-aa9d-e9bd5c697140`). Offene: KLLM-71/72/73; laufend: KLLM-61/70; Dach: KLLM-62; Gehirn: KLLM-63/64/65/66/69. Assignee Pedi (`712020:ab61a750-568f-4c4c-a863-d556945c62b5`). App-Fragen mit **Paul** abstimmen.

## Umgangston aus der Zusammenarbeit (lessons learned)

Nicht raten — messen (curl/Netzwerk-Tab), dann handeln. Namen konsistent halten (alles heißt `KLARWERK-App`). Prozesse nicht ohne Ansage ändern. Dateien, die im Repo leben sollen, gehören ins Repo (versioniert); zum Transport zusätzlich als Zip. Vollständige, zu-Ende-gedachte Schritte liefern.

**Sofort-Einstieg:** Frag Pedi nach der roten Netzwerk-Zeile zum 404 (KLLM-72) — das ist der schnellste offene Punkt. Details: `UEBERGABE-KLARWERK-Insel.md`.

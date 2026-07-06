# scripts/insel — On-Prem-Insel (Mac Studio)

Werkzeuge für den Betrieb der KLARWERK-App auf dem air-gapped Mac Studio.
Alles läuft **nativ und lokal** (kein Docker, kein Cloud-Schlüssel, nur `127.0.0.1`).
Quelle der Wahrheit: **KLLM-61** (App ↔ lokaler LLM), **KLLM-62** (Insel), **KLLM-70** (Aufbau).

## Dateien

| Datei | Zweck |
|---|---|
| `Insel-App-starten.command` | Startet die KLARWERK-App **nativ** (`npm start`), bindet den lokalen LLM an (Ollama/MLX), setzt die Datenhaltung und öffnet den Browser. |
| `Insel-App-Desktop-Icon.command` | Legt einmalig eine Doppelklick-App „KLARWERK App" auf den Schreibtisch, die den Launcher startet. |
| `Insel-inventarisieren.command` | Erfasst den Ist-Zustand des Mac (Homebrew, Ollama-Modelle inkl. bge-m3, MLX-Pins, Node, Ports, Datenpfade) → versioniert unter `docs/operations/` (**ohne Secrets**). |
| `Insel-aufbauen.command` | Baut aus dem Inventar einen vergleichbaren Rechner (idempotent, Air-Gap-bewusst). |
| `LIESMICH.txt` | Ausführliche Bedienung (deutsch). |

## App starten

```bash
bash ~/Documents/dev_Klarwerk/scripts/insel/Insel-App-starten.command
```

Öffnet die App unter <http://127.0.0.1:3001>. Danach in der App unter **„KI-Verwaltung"**
den lokalen LLM als **aktives** Backend wählen (der Launcher hat ihn bereits verbunden).
Fenster offen lassen; `Strg-C` beendet.

Bequemer per Doppelklick: einmal `Insel-App-Desktop-Icon.command` ausführen → danach
startet die App vom Schreibtisch.

### Einstellungen (oben in `Insel-App-starten.command`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `BACKEND` | `ollama` | `ollama` (`:11434`) oder `mlx` (`:8080`) |
| `OLLAMA_MODELL` | `qwen3:32b` | genaues Ollama-Modell |
| `MLX_MODELL` | `mlx-community/Qwen3-32B-4bit` | MLX-Modellname |
| `PERSIST` | `journal` | `journal` (Daten bleiben) oder `memory` (frisch je Start) |
| `PORT` | `3001` | Adresse |

Umschalten ohne Datei-Änderung, z. B. auf MLX:

```bash
BACKEND=mlx bash ~/Documents/dev_Klarwerk/scripts/insel/Insel-App-starten.command
```

## Voraussetzungen

- Node.js ≥ 20 und `npm install` (Projekt-Abhängigkeiten vorhanden).
- Ollama-Modell geladen (`ollama pull qwen3:32b`) **oder** MLX-Server auf `:8080` aktiv.
- Das Frontend (`apps/web/dist`) wird beim ersten Start automatisch gebaut, falls es fehlt.

## Wie es technisch läuft (kurz)

Der Server (`services/app/src/server.ts`) liefert die gebaute Web-Oberfläche
Single-Origin gleich mit aus. Der lokale LLM ist als **zweites Backend** im
Composition-Root verdrahtet (`build-app.ts` → `createLocalClientFromEnv`,
Env `KLARWERK_LOCAL_LLM_URL` / `KLARWERK_LOCAL_LLM_MODEL`, SCRUM-424). Der Launcher
setzt nur diese Umgebung — **kein Eingriff in den App-Code**.

## Sicherheit

Keine Secrets in Repo, Skripten oder Doku. API-Schlüssel bleiben im macOS-Schlüsselbund
(das Inventar nennt nur Referenznamen). Betrieb rein lokal; Datenbank bewusst nicht in
der Cloud (nativ, Journal oder In-Memory).

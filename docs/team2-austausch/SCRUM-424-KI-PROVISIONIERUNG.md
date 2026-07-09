# SCRUM-424 — Zwei KIs vorab verbinden (Provisionierung) · für den VIP-Vortest

Ziel: Wenn der VIP die Erstanmeldung macht (und dadurch Admin wird), ist das System bereits
mit BEIDEN KIs verbunden — Claude-Cloud UND dem eigenen lokalen LLM (Qwen3-32B-AWQ).

## Warum das automatisch klappt
Die KI-Anbindung liest der **Server beim Start** aus Umgebungsvariablen (aus dem
Schlüsselbund). Sie hat mit dem Login nichts zu tun. Sobald der Server mit beiden Backends
hochgefahren ist, sind beide KIs verbunden — egal, wer sich zuerst anmeldet. Kein Schlüssel
wird je in der Oberfläche eingegeben; der lokale LLM ist nur über den SSH-Tunnel auf
localhost erreichbar.

## Die Umgebungsvariablen (im Launcher setzen, NICHT im Repo)
Cloud (bereits genutzt):
- `ANTHROPIC_API_KEY`   — der Claude-Schlüssel (aus dem Schlüsselbund)
- `REASONER_MODEL`      — optional, Default `claude-sonnet-4-6`

Lokaler LLM (neu, SCRUM-424):
- `KLARWERK_LOCAL_LLM_URL`   — OpenAI-kompatibler Endpoint, z. B. `http://127.0.0.1:8000/v1`
                               (die localhost-Adresse deines SSH-Tunnels zum vLLM-Server)
- `KLARWERK_LOCAL_LLM_MODEL` — Modellname, z. B. `Qwen3-32B-AWQ`
- `KLARWERK_LOCAL_LLM_KEY`   — optional (nur falls dein vLLM einen API-Key verlangt)

Fehlt URL oder Modell, läuft alles wie bisher (nur Cloud + Ersatzmodus) — nichts bricht.

## Schlüssel aus dem macOS-Schlüsselbund holen (Beispielmuster)
Mac-Studio-Insel (launchd): Der Server liest zuerst `ANTHROPIC_API_KEY` aus der Prozess-Env.
Fehlt diese Variable, nutzt er direkt den macOS-Schlüsselbund des Studio-Benutzers:
```
security find-generic-password -s "Klarwerk" -a "ANTHROPIC_API_KEY" -w
```
Eintragen dafür:
```
security add-generic-password -U -s "Klarwerk" -a "ANTHROPIC_API_KEY" -w '<claude-key>'
```

Einmalig ablegen (macht Pedi, nicht im Repo):
```
security add-generic-password -a "$USER" -s KLARWERK_ANTHROPIC_KEY -w '<claude-key>'
# lokaler LLM braucht i. d. R. KEINEN Key; nur falls doch:
security add-generic-password -a "$USER" -s KLARWERK_LOCAL_LLM_KEY -w '<optionaler-key>'
```
Im Launcher-Skript (vor dem Server-Start) exportieren:
```
export ANTHROPIC_API_KEY="$(security find-generic-password -a "$USER" -s KLARWERK_ANTHROPIC_KEY -w)"
export KLARWERK_LOCAL_LLM_URL="http://127.0.0.1:8000/v1"
export KLARWERK_LOCAL_LLM_MODEL="Qwen3-32B-AWQ"
# optional:
# export KLARWERK_LOCAL_LLM_KEY="$(security find-generic-password -a "$USER" -s KLARWERK_LOCAL_LLM_KEY -w)"
```
Wichtig: Diese Zeilen in DEINEN vorhandenen Starter aufnehmen — die vorhandene `.command`-Datei
nicht überschreiben (sonst geht das Ausführungsrecht verloren). Und den **SSH-Tunnel** zum
vLLM-Server aufbauen, bevor der KLARWERK-Server startet.

## Vorab prüfen (bevor der VIP kommt)
1. SSH-Tunnel steht (der vLLM-Port ist auf localhost erreichbar).
2. KLARWERK-Server frisch gestartet (mit gesetzten Env-Variablen).
3. In der App: Admin → KI → „Verfügbare KIs": Cloud = aktiv, Lokaler LLM = **bereit** (mit
   Modell-Label), Ersatzmodus = bereit.
4. Schlüssel-Test (Cloud) grün. Der lokale LLM zeigt „bereit" = verbunden/auswählbar; die
   tatsächliche Antwort testest du mit einem echten Aufruf (z. B. Wissen erfassen → Interview
   nach Umschalten auf „Lokaler LLM").

## Standard & Umschaltung (deine Wahl aus 03.07.)
- Standard = **automatisch**: Cloud arbeitet zuerst, fällt sie aus, übernimmt der lokale LLM,
  zuletzt der deterministische Ersatzmodus. Robust für die Demo.
- Admin → KI: global und je Aufgabe (Strukturieren/Interview/Fragen/Extraktion/…) zwischen
  „Cloud (Claude)", „Lokaler LLM" und „Deterministisch" umschaltbar. Der lokale LLM erscheint
  in den Auswahllisten nur, wenn er verdrahtet ist.

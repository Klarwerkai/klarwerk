# KLARWERK Modell-Manager (On-Prem) — v0

Kleines, eigenständiges Tool für den Mac Studio (Benutzer „Klarwerk"): lokale LLMs per
Web-Oberfläche laden und verwalten — Name/Alias + Quelle (Ollama-Tag, Link oder hf.co-Code)
eingeben, **Herunterladen** klicken, Live-Fortschritt sehen, installierte Modelle listen/löschen.

Es fasst die KLARWERK-App **nicht** an (keine Provider-/App-Code-Änderung, keine Paul-Abstimmung
nötig). Es spricht nur mit dem lokalen **Ollama** (127.0.0.1:11434). Bindet ausschließlich an
**127.0.0.1** — nie öffentlich. Keine Secrets, keine Käufe.

## Dateien
- `klarwerk-modell-manager.mjs` — abhängigkeitsfreier lokaler Server (Node 18+).
- `ui.html` — die Oberfläche (KLARWERK-Stil).
- `KLARWERK Modell-Manager starten.command.NEU` — Doppelklick-Starter (Boss: `chmod +x`,
  Schreibtisch-Spiegel + App-Hülle; x-Bit-Regel).

## Schnellstart (zum Ausprobieren, ohne App-Hülle)
Im Terminal (Benutzer „Klarwerk"):

    cd <dieser Ordner>
    node klarwerk-modell-manager.mjs
    # dann im Browser: http://localhost:11888

Voraussetzung: `brew install ollama node` erledigt. Der Starter oben startet Ollama bei Bedarf
selbst und öffnet den Browser automatisch.

## Bedienung
- **Quelle** = das, was Ollama versteht: `qwen3:32b` (Standard), `qwen3:14b` (Rückfall) oder ein
  Hugging-Face-Code `hf.co/<user>/<repo>:<Quant>`.
- **Name/Alias** (optional): nach dem Laden wird zusätzlich ein Alias angelegt (`ollama copy`),
  z. B. `klarwerk-32b`.
- Der Download braucht **einmalig Internet**; danach ist das Modell lokal/offline nutzbar.

## Grenzen v0
- Startpunkt („lass uns so anfangen"): Laden + Liste + Löschen. Noch offen/ausbaubar: Modell im
  KLARWERK-Provider aktiv setzen, GGUF-Datei-Upload per Datei-Auswahl, Fortschritt pro Layer,
  Prüfstand-Knopf. Sag, was als Nächstes dran soll.

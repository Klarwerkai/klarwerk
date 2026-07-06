# Klarwerk

Neuauflage als professionelles, KI-gestütztes Entwicklungssystem nach dem Harness-Ansatz (Blueprint im Ordner `Blueprint/`).

**Kernidee:** Nicht „KI schreibt Code", sondern implizites Engineering-Wissen wird zu **expliziten, ausführbaren Regeln**. Drei getrennte Wahrheiten: Spec (Was) · Harness (Wie) · Tests (Korrekt?).

## Struktur
```
CLAUDE.md / AGENTS.md   Agent-Regelwerk (Quelle: /harness)
/harness                Architektur-, Coding-, Test-, Sicherheitsregeln + Correction-Log
/specs                  Ideen → Stories → Akzeptanzkriterien → Entscheidungen (ADRs)
/services               Modularer Monolith (ein Verzeichnis je Modul)
/tools                  build · lint · format · test · check (ein Befehl = ein Schritt)
/tests                  api · workflows · contracts
/agents                 Lean-Agenten: Spec · Review-Panel · Doku/Logbuch
/docs                   generierte + operative Doku
/scripts/insel          On-Prem-Betrieb Mac Studio (App starten, Aufbau, Inventar)
docker-compose.yml      Postgres + n8n
.github/workflows       CI: nichts nach main ohne grünen check
```

## Loslegen
1. `npm install`
2. `docker compose up -d`
3. `./tools/check` (sobald erstes Modul existiert)

## On-Prem-Betrieb (Mac Studio · Insel)
Die App läuft auch **nativ und offline** auf dem Mac Studio, angebunden an einen lokalen
LLM (Ollama/MLX) — kein Docker, kein Cloud-Schlüssel. Start:

```bash
bash scripts/insel/Insel-App-starten.command   # App auf http://127.0.0.1:3001
```

Werkzeuge, Einstellungen und Wiederaufbau: **`scripts/insel/README.md`**. Inventar/Aufbau
des Rechners: **`docs/operations/INSEL-AUFBAU.md`** (KLLM-61 · KLLM-62 · KLLM-70).

Aufbaustand & nächste Schritte: **`SETUP.md`**.

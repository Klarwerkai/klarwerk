# Klarwerk — Lokale Inferenz-Runtime (Ollama / llama.cpp): Readiness-Notiz

> Ehrliche Prüfung, ob eine lokale Inferenz-Runtime vorhanden/lauffähig ist, plus
> Installations-/Verifikationspfad für später.
> **Keine Runtime installiert, kein Modell heruntergeladen, keine Docker-/GPU-/Autostart-Arbeit.**
> Verwandt: `inference-server-readiness.md`, `gpu-provider-decision.md`,
> `local-chat-ui-readiness.md`, `local-function-performance-baseline.md`.

---

## 1. Wichtige Einschränkung der Prüfumgebung (Ehrlichkeit)

Die ausführende Shell läuft in einer **isolierten Linux-Sandbox** (`uname`: Linux aarch64), **nicht** auf dem Mac des Betreibers. Daher:

- `which ollama`, `ollama --version`, `curl http://localhost:11434/api/tags`, `ps aux | grep ollama`, `system_profiler` **können den realen Mac nicht prüfen** — ein Ergebnis aus der Sandbox wäre **irreführend** und wird **nicht** als Befund über die Zielmaschine ausgegeben.
- Ein direktes Ausführen auf dem Mac über die Desktop-Steuerung ist hier **nicht möglich** (Terminal-Eingabe gesperrt).

→ Die **Maschinen-Verifikation** (ist Ollama/llama.cpp auf dem Mac installiert/lauffähig?) ist von **Pedi lokal** auszuführen (Befehle in §7). Diese Notiz liefert den **Readiness-/Verifikationsrahmen**, **nicht** einen erfundenen „installiert"-Befund.

---

## 2. Was prüfbar war (real)

- **Repo-Verdrahtung:** Suche nach `ollama|llama.cpp|llama-server|llama-cli|11434|OLLAMA|MODEL_PATH|GGUF|Metal` in `services/`, `apps/web/src`, `.env.example`, `docker-compose*.yml` → **keine Treffer**. Die Runtime ist **nirgends im Produkt verdrahtet** (konsistent mit `inference-server-readiness.md`: Anthropic-API **oder** deterministischer Fallback; `baseUrl`/`REASONER_PROVIDER` nicht env-konfigurierbar).
- **Heutiger Betrieb:** lokal läuft der **deterministische** Reasoner (kein Modell) — Funktions-/Latenz-Baseline in `local-function-performance-baseline.md`.

> **Folge:** Selbst **wenn** auf dem Mac eine Runtime installiert wäre, ist sie **nicht** mit Klarwerk verbunden (kein Adapter). Das Kriterium „Runtime installiert **und** Modell antwortet, mit Klarwerk nutzbar" ist **nicht** belegt.

---

## 3. Ollama vs. llama.cpp (Entscheidung für später)

| Kriterium | **Ollama** | **llama.cpp** |
| --- | --- | --- |
| Setup | **sehr einfach** (1 Installer, Modell-Pull) | manueller Build/Binaries, GGUF selbst beschaffen |
| API | **HTTP-Server** (`localhost:11434`), OpenAI-kompatibler Modus | `llama-server` bietet HTTP; sonst CLI |
| Apple-Silicon/Metal | **automatisch** (Metal-Beschleunigung) | Metal via Build-Flag |
| Modellverwaltung | integriert (`ollama pull/list`) | manuell (GGUF-Dateien) |
| Eignung Klarwerk-PoC | **erste Wahl** (geringste Hürde) | wenn maximale Kontrolle/Quantisierung nötig |

**Empfehlung:** **Ollama** für den ersten lokalen PoC (einfach, Metal out-of-the-box). llama.cpp nur, wenn feingranulare Kontrolle gebraucht wird.

---

## 4. Installationspfad (macOS / Apple Silicon) — Konzept, NICHT ausgeführt

1. **Ollama** installieren (offizieller macOS-Installer **oder** `brew install ollama`).
2. Dienst starten (`ollama serve` bzw. App) → HTTP unter `http://localhost:11434`.
3. **Kleines** Modell ziehen — **nur nach Pedi-Freigabe** (Download-Größe beachten), z. B. ein 3B–8B-Instruct in Q4-Quantisierung.
4. Test: `ollama run <model> "kurzer Prompt"` und `curl http://localhost:11434/api/generate`.

> **Kein** Download in diesem Item (Vorgabe: keine großen Downloads ohne Pedi-Entscheidung).

---

## 5. Modell-Speicherort & Größen

- **Ollama-Modelle (macOS):** standardmäßig `~/.ollama/models` (überschreibbar via `OLLAMA_MODELS`).
- **llama.cpp:** GGUF-Dateien an frei wählbarem Pfad (z. B. `~/models/*.gguf`).
- **RAM/VRAM-Faustregel (Apple Silicon = Unified Memory):** 3B Q4 ≈ ~2–3 GB; 7–8B Q4 ≈ ~5–6 GB; 13B Q4 ≈ ~8–10 GB. → auf einem Mac mit **≥16 GB** sind kleine–mittlere Modelle gut lauffähig.

---

## 6. Metal / GPU-Verifikation (Konzept)

- Ollama nutzt auf Apple Silicon **Metal automatisch**; Verifikation über Server-Logs (GPU/Metal-Hinweis) und Antwortgeschwindigkeit (Tokens/sec, in `local-function-performance-baseline.md` heute **blocked**).
- `system_profiler SPDisplaysDataType` zeigt die GPU; `ollama ps` zeigt laufende Modelle/Backing.

---

## 7. Selbst-Verifikation auf dem Mac (durch Pedi)

```bash
which ollama && ollama --version            # installiert?
ps aux | grep -i '[o]llama'                 # Dienst läuft?
curl -s http://localhost:11434/api/tags     # erreichbar? welche Modelle?
ollama list                                  # lokale Modelle
# falls ein kleines Modell vorhanden ist:
ollama run <model> "Sag in einem Satz hallo."   # antwortet das Modell?
system_profiler SPDisplaysDataType | grep -i -A2 'Chipset\|Metal'  # GPU/Metal
# llama.cpp-Alternative:
which llama-server llama-cli 2>/dev/null
```
→ Ergebnisse (installiert ja/nein, Modellantwort ja/nein, Metal sichtbar ja/nein) zurückmelden; dann lässt sich Done sauber bewerten.

---

## 8. Datenschutz / Logging

- **Vorteil lokal:** Prompts/Antworten bleiben **auf der Maschine** (kein externer Datenfluss) — gut für DSGVO.
- Klarwerk selbst loggt **keine** Prompt-/Antworttexte (`monitoring-logging.md`); eine lokale Runtime/Chat-UI muss eigenes Logging entsprechend zurückhaltend konfigurieren.
- PoC nur mit Testdaten; kein ungeprüfter Werks-/PII-Abfluss in Chat-Logs.

---

## 9. Done-Kriterien

1. Ollama (oder llama.cpp) auf dem Mac **installiert** und **Dienst erreichbar** (`/api/tags` antwortet).
2. **Ein kleines Modell** lokal vorhanden und **antwortet** (`ollama run …`).
3. **Metal/GPU-Nutzung** sichtbar/plausibel (Logs/Geschwindigkeit).
4. (Für Produkt-Nutzung zusätzlich) Klarwerk-Adapter + `REASONER_PROVIDER`/Base-URL env-verdrahtet (`inference-server-readiness.md`).

---

## 10. Blocker / Nicht-Ziele

- **Blocker:** Maschinen-Verifikation aus dieser Umgebung **nicht möglich** (Linux-Sandbox; Terminal-Eingabe auf dem Mac gesperrt). Installation/Modell-Download brauchen lokale Rechte/Netz/Pedi-Freigabe.
- **Nicht-Ziele:** keine Runtime-Installation, kein Modell-Download, keine Docker-/GPU-/Autostart-/Dienst-Änderung, kein Produktcode.

---

## 11. Empfehlung

**PARTIAL / Blocked-on-local-verification.** Im **Repo** ist **keine** lokale Runtime verdrahtet, und ob auf dem **Mac** Ollama/llama.cpp installiert/lauffähig ist, **kann aus dieser Umgebung nicht ehrlich geprüft werden** (Linux-Sandbox; kein Terminal-Zugriff auf den Mac). Es liegt **kein** Nachweis vor, dass eine Runtime läuft, ein Modell antwortet oder Metal genutzt wird — daher **kein Fake-Done**. Diese Notiz liefert Entscheidung (Ollama zuerst), Installations-/Speicher-/Verifikationspfad und Done-Kriterien. **Empfehlung: Partial**; die eigentliche Verifikation/Installation ist von **Pedi lokal** auszuführen (§7), eine Produkt-Anbindung zusätzlich über den Inferenz-Adapter (`inference-server-readiness.md`).

---

*Read-only Readiness-Notiz. Kein Produktcode geändert; keine Runtime/Modell/Infra erzeugt; Sandbox-Umgebung ist nicht der Zielrechner — Maschinenbefunde bewusst nicht erfunden.*

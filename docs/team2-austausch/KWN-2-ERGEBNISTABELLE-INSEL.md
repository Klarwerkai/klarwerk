# KWN-2 — Lokaler LLM (Insel) auf dem Mac Studio · Prüfstand-Abnahme

> Umsetzung: **KLARWERK NERD** · Quelle der Wahrheit: **KLLM-62** · Board: **KWN** · Ticket: **KWN-2**
> Stand: 04.07.2026 — **Kit gebaut, Messung auf dem Gerät steht aus** (s. „Warum offen").

## Ziel der Abnahme

Der lokale LLM der Insellösung wird **auf dem Zielgerät (Mac Studio, M4 Pro, 64 GB, Apple
Silicon/Metal)** gemessen, bevor er dem VIP zugesagt wird. Verbindliche Doktrin (Lehre aus
KLLM-3/4/5/7): **erst auf der echten Hardware messen, dann zusagen** — nie auf fremder Hardware
(z. B. Cloud-GPU) versprechen. Prüfstand = die 12 deutschen Testfälle (KLLM-56) über alle 6
Reasoner-Aufgaben, 2 Punkte je Fall → **max. 24**, inkl. G-2-Belegstellen-Check und drei
„ehrlich passen"-Fällen (lieber ehrlich nichts als halluzinieren).

## Aufbau (was gemessen wird)

- **LLM:** Ollama (Metal) mit **Qwen3-32B quantisiert** (Tag `qwen3:32b`, ~20 GB, passt in 64 GB);
  **Qwen3-14B** (`qwen3:14b`) als Rückfall.
- **Anbindung:** über den **vorhandenen** OpenAI-kompatiblen Weg auf localhost (SCRUM-424) —
  `http://localhost:11434/v1`. Nichts neu gebaut, nur konfiguriert.
- **KLLM-61 (Pflicht lokaler Weg):** Denkmodus aus (`enable_thinking=false`, mit Fallback) **und**
  `<think>`-Blöcke werden vor der Bewertung gestrippt. Beides erledigt der unveränderte
  PMO-Runner `scripts/pruefstand-run.mjs` — genau wie der App-Client (KLLM-61).
- **Runner-Aufruf:** `node scripts/pruefstand-run.mjs http://localhost:11434/v1` (im PMO-Ordner).
- **Ausführung:** über das Kit `KWN-2 Insel-Pruefstand.command` (Aufbauphase, einmalig Internet
  fürs Modell-Pullen; danach läuft der Prüfstand rein lokal).

## Ergebnistabelle (Abnahme-Artefakt KWN-2)

Referenzspalten sind **Kontext** und stammen von **anderer Hardware** — sie ersetzen die
Mac-Studio-Messung NICHT. Die Insel-Zusage stützt sich ausschließlich auf die Apple-Silicon-Spalten.

| Messgröße | Referenz Claude (Cloud-API)¹ | Qwen3-32B — L40S/vLLM (Cloud, Kontext)² | **Qwen3-32B — Mac Studio / Metal** | **Qwen3-14B — Mac Studio / Metal** |
|---|---|---|---|---|
| Punkte gesamt (von 24) | **22** | 22 | _offen — auf dem Gerät messen_ | _offen (nur falls 32B nicht reicht)_ |
| „Ehrlich passen"-Fälle (3) | bestanden | 3/3 | _offen_ | _offen_ |
| G-2-Belegstellen-Check | ✓ | ✓ | _offen_ | _offen_ |
| Sekunden/Antwort (Ø) | 3,3 | 1,7 | _offen_ | _offen_ |
| Speicher (Gewichte / belegt) | — | 18,2 / 42,7 GiB (VRAM) | _offen (Unified Memory)_ | _offen_ |
| Denkmodus aus + <think>-Filter | n/a | ✓ (Runner v2) | _auf dem Gerät verifizieren_ | _verifizieren_ |

¹ Referenz `claude-sonnet-4-6` über die Anthropic-API (Token-Preis, andere Kostenbasis).
² Lauf 03.07. auf **UpCloud L40S 48 GB / vLLM** (KLLM-57). **Andere Hardware** — nur Orientierung,
  keine Zusagegrundlage für die Insel. Quelle: `docs/team2-austausch/pruefstand/` + KLLM-57-Auswertung.

## Abnahmekriterien (Definition of Done KWN-2)

1. Alles läuft im **Benutzer „Klarwerk" auf dem Mac Studio** (nicht im persönlichen Account);
   keine KLARWERK-/Modell-/Prüfstands-/VIP-Daten dauerhaft im persönlichen Account.
2. Prüfstand dort gelaufen, Report in `docs/team2-austausch/pruefstand/`
   (Dateiname trägt `macstudio` + Modell-Tag), Zahlen oben eingetragen.
3. **Offline-Start bestätigt:** Netz aus → App/Prüfstand läuft weiter (Modelle + Repos lokal).
4. **LLM-API nur lokal** erreichbar (localhost/127.0.0.1), nicht öffentlich gebunden.
5. **KLLM-61 aktiv:** `enable_thinking=false` + `<think>`-Filter (keine `<think>`-Leckage, plausible Zeiten).
6. Die drei „ehrlich passen"-Fälle bestanden (härtestes Kriterium für KLARWERK).
7. Ergebnistabelle für **Qwen3-32B** vorhanden; **14B-Rückfall** nur falls 32B nicht reicht,
   dann ehrlich mitdokumentiert. **Modellentscheidung 32B vs. 14B fällt NACH dieser Messung.**
8. `KWN-2-Abschluss-Check.command` gelaufen, `KWN-2-ABSCHLUSS-CHECK-ERGEBNIS.md` liegt vor.

## Warum diese Spalten (noch) offen sind

Die Messung MUSS auf dem Mac Studio laufen. Diese Cloud-Session kann Dateien auf dem Mac lesen/
schreiben, aber **keine Befehle auf dem Gerät ausführen** (dieselbe Grenze wie beim „Paul Runner":
Cloud-Umgebung kann nicht auf dem Mac ausführen). Ein On-Prem-Benchmark in der Cloud zu „messen"
wäre genau der Fehler, den KLLM-62 verbietet. Deshalb ist alles **vorbereitet** und wird durch
**einen Doppelklick auf dem Mac Studio** (Pedi/Boss) zu echten Zahlen — die dann hier eintragen.

## Offener Abstimmungspunkt (mit Paul)

Der Prüfstand-Runner misst das **erste** von `/v1/models` angebotene Modell. Für eindeutige
32B-vs-14B-Läufe wäre eine optionale Modellwahl (3. Argument) im Runner hilfreich. Der Runner ist
ein **Team-2-Artefakt (Paul)** — Änderung daran läuft als `.NEU` → Boss-Übernahme, nicht einseitig.
Zwischenlösung: **ein Modell pro Lauf** messen; der Report-Kopf nennt das tatsächlich gemessene Modell.

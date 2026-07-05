# Datenvertrag: Prüfstand-Fälle & Verhaltensartefakte (Insel ↔ KLARWERK-App)

*Version 1.0 · 05.07.2026 · NERD → Paul · Bezug: KLLM-63/64, SCRUM-393/386/415, KWN-2 · Ablage: docs/team2-austausch/*

Antwort auf Pauls Fragen (a)–(d). Alles hier Beschriebene ist in der Insel-App v3.2 **operativ umgesetzt** — die App kann direkt gegen dieselben Verträge bauen.

---

## (a) Testfall

**Kanonische Quelle:** `PRUEFSTAND-FAELLE-v2.json` (identisch mit `BERATER_PRUEFSTAND_TESTFAELLE_V2_20260704.json`; 53 Fälle, version "v2 (Berater, 2026-07-04)"). Die Insel-App bettet eine *generierte Kopie* ein; bei Abweichungen gilt die JSON-Datei. Änderungen an Fällen nur über diese Datei + Ansage (version-Feld hochziehen).

```json
{
  "version": "v2 (Berater, 2026-07-04)",
  "faelle": [
    { "id": "EXT-2", "task": "extract",
      "titel": "Ehrlich-Fall: kein verwertbares Wissen",
      "eingabe": "AUS DEM PROTOKOLL: Die Sitzung begann um 14 Uhr. …",
      "checks": { "ehrlichLeer": true, "enthaeltNicht": ["Filterwechsel", "Wartung", "Sicherheit"] } }
  ]
}
```

- **id:** `<PREFIX>-<n>` — STR/EXT/ANT/INT/ASS/SEL/KON/DUP.
- **task (8):** `structure | extract | answer | interview | assist | select | conflict | dedupe`. Mapping zur App-Taxonomie (abgestimmt, Kommentar KLLM-64): `ask ≙ answer`; `select/conflict/dedupe` vorerst reine Artefakt-/Prüfstand-Tasks ohne eigenen App-Reasoner-Endpunkt.
- **checks (maschinenlesbar), alle optional, UND-verknüpft:**
  - `json: true` — Antwort muss parsebares JSON sein (```json-Fences werden toleriert/entfernt)
  - `enthaelt: string[]` — jedes Stichwort muss vorkommen (case-insensitiv, Whitespace normalisiert)
  - `enthaeltNicht: string[]` — darf nicht vorkommen (Halluzinations-Falle)
  - `enthaeltEines: string[]` — mindestens eines muss vorkommen
  - `istFrage: true` — Antwort enthält "?"
  - `belegstelleImText: true` — `punkte[0].belegstelle` (>5 Zeichen) muss wörtlich in `eingabe` stehen
  - `ehrlichLeer: true` — Regex /\[\]|keiner passt|kein verwertbar|keine punkte|nichts gefunden|enthält kein/i
  - `ehrlichUnwissend: true` — Regex /kein gesichertes wissen|weiß (es )?nicht|liegt nicht vor|wissenslücke|kann .*nicht beantwort/i
  - `jsonFeld: {feld, wert}` — Top-Level-Feld der JSON-Antwort == wert (Vergleich nach clean(): lowercase, Umlaut-Normalisierung ä→ae…, Klammern/Quotes/Whitespace entfernt)
- **Klartext-Erklärung:** deterministische Abbildung checks→deutsche Sätze; Referenz `checksText()` in `ui.html` (v3.2) — 1:1 übernehmbar.
- **Scoring (deterministisch, Referenz `bewerte()` in `klarwerk-modell-manager.mjs`):** 2 Punkte = alle Checks bestanden, 1 = ≥ Hälfte, 0 sonst. Vor Bewertung: `<think>…</think>`-Blöcke strippen. Max = 2 × Fallzahl (106). **Ehrlich-Quote:** Fälle mit ehrlichLeer/ehrlichUnwissend oder jsonFeld widerspruch=false bzw. beziehung=eigenstaendig (14 Fälle); bestanden = 2 Punkte.
- **Lauf-/Fehlhistorie** (`benchmarks.json`):
```json
{ "laeufe": [ { "id": "r…", "zeit": "ISO", "provider": "ollama|mlx|anthropic|openai|google",
  "modell": "Label", "summe": 98, "max": 106, "oSekunden": 20.2,
  "ehrlichOk": 11, "ehrlichGesamt": 14, "artefakteAktiv": 1,
  "faelle": [ { "id": "EXT-2", "task": "extract", "titel": "…", "punkte": 0,
                "checksOk": "1/4", "sekunden": 4.1, "gruende": ["hat nicht ehrlich …"] } ] } ] }
```
  Abgebrochene/fehlgeschlagene Läufe werden **nicht** gespeichert.
- **API (Insel, http://127.0.0.1:11888):** `GET /api/testinfo` {total,max,version} · `GET /api/testfall?id=EXT-2` {fall} (404 wenn unbekannt, id case-insensitiv) · `GET /api/history` · `GET /api/export?fmt=csv|json` · `POST /api/benchmark {provider,model}` → NDJSON-Stream `{type:meta}` / `{type:case,…}` / `{type:done,run}` / `{type:error}`.

## (b) Regel/Artefakt

**Operativer Insel-Store (PoC):** `~/Library/Application Support/KLARWERK-Insel/artefakte.json`

```json
{ "artefakte": [ { "id": "a1783…", "task": "extract", "art": "guardrail",
  "inhalt": "Kein verwertbares Fachwissen (nur Termine/Anwesenheit/Alltag) → exakt {\"punkte\":[]}, niemals Punkte erfinden.",
  "version": 1, "aktiv": true, "herkunftsfall": "EXT-2", "erstelltAm": "ISO" } ] }
```

- **art (PoC):** `guardrail | antwort_kontrakt | few_shot`. Die App/Zentrale trägt zusätzlich `system_prompt` und `instruction_preset` (= SCRUM-386-Presets) — siehe Superset-Spec `SCHEMA-VERHALTENSARTEFAKTE-SUPERSET.md`. Die PoC-Felder sind eine **echte Teilmenge** des Supersets; App bitte von Anfang an mit den Superset-Feldern bauen (name, sprache, modellklasse, belegMessung, provenienz inkl. SCRUM-415-Vertraulichkeit).
- **Injektion (deterministisch, Referenz `baueSystem()`):**
  `finalSystem = SYSTEM[task] + "\n\nZUSAETZLICHE REGELN (unbedingt beachten):\n- " + guardrails+kontrakte(aktiv, je Task) + "\n\nBEISPIELE ZUR ORIENTIERUNG:\n" + fewshots(aktiv, je Task)`
  Beim Modellwechsel ändert sich daran nichts — das ist der PoC-Beweis.
- **API:** `GET /api/artefakte` {artefakte, tasks} · `POST /api/artefakte` {task, art, inhalt, herkunftsfall} · `POST /api/artefakte/toggle` {id} · `POST /api/artefakte/delete` {id}.

## (c) Live-Gegenprüfung

**Insel heute:** `POST /api/benchmark` fährt die **volle 53er-Suite** gegen den gewählten Endpunkt:
- Ollama `http://127.0.0.1:11434/v1` (OpenAI-kompatibel)
- MLX `http://127.0.0.1:8080/v1` (OpenAI-kompatibel; Versuch mit `chat_template_kwargs.enable_thinking=false`, Fallback ohne)
- Cloud: Anthropic/OpenAI/Gemini (Keys nur Keychain)

Das Gate ist im PoC noch **manuell** (nachmessen + Vorher/Nachher vergleichen; „Regeln aktiv" steht am Lauf). Das **automatische Regressions-Gate** ist Phase 1: Zielfall vorher <2 und nachher =2 **UND** kein anderer Fall sinkt → erst dann `freigegeben/aktiv`.

**Empfehlung für die App: ja — dieselbe Suite, dieselbe Bewertung, aber der App-eigene Endpunkt.** Die KLARWERK-App fährt die kanonische JSON-Suite mit identischem Scoring gegen ihre **eigene Reasoner-Kette** (`/api/reasoner` + `taskConfig`, intern/extern wie konfiguriert — SSH-Tunnel eingeschlossen). Entscheidend für Vergleichbarkeit ist **Suite + Scoring identisch**, nicht der Endpunkt. Pragmatischer Start: die 5 App-Tasks (structure/extract/ask≙answer/interview/assist) = 32 der 53 Fälle; select/conflict/dedupe folgen, wenn die App diese Tasks bekommt.

## (d) Gemeinsame Quelle der Wahrheit

Vorschlag angenommen: **`docs/team2-austausch/`** mit
1. `PRUEFSTAND-FAELLE-v2.json` — kanonische Fall-Suite (liegt diesem Paket bei)
2. `VERTRAG-PRUEFSTAND-ARTEFAKTE.md` — dieses Dokument
3. `SCHEMA-VERHALTENSARTEFAKTE-SUPERSET.md` — Superset-Schema (liegt bei Pedi)

Rollen: **App = zentrale Wahrheit** für Verhaltensartefakte (SCRUM-393), **Insel spiegelt kuratiert** (Sync zentral→Insel, KLLM-63 §6.3); die Insel-`artefakte.json` bleibt der operative Insel-Store. Die Fall-Suite ist gemeinsames Gut: Änderungen nur über die JSON-Datei + version-Bump, beide Seiten ziehen nach (Insel: Neu-Einbettung beim nächsten Build).

---

*Referenz-Implementierung: KLARWERK-Insel v3.2 (`klarwerk-modell-manager.mjs` = Scoring/Injektion/APIs, `ui.html` = checksText/Fall-Detail-UI). Bei Fragen: NERD via Pedi oder Kommentar auf KLLM-64.*

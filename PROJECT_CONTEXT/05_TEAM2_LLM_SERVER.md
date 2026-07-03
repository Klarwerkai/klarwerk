# Team 2 — Eigener LLM-Server (Kurzfassung)

> Vollständiges, maßgebliches Konzept: `~/Documents/Klarwerk/klarwerk-local-llm/docs/KLLM_HETZNER_GPU_KONZEPT_V0.md`
> (Titel historisch — Inhalt ist das Gesamtkonzept V1 inkl. UpCloud-Entscheidung).

## Warum

MacBook-LLM-Versuche sind beendet (zu langsam/instabil). Ziel: EU-gehosteter eigener LLM-Server
für die 6 Reasoner-Aufgaben — Grundlage des On-Premises-Versprechens. Ehrliche Erwartung:
kein Claude-Niveau; „gut genug für die Reasoner-Tasks" reicht, sonst bleibt Anthropic Betriebsweg.

## Phasen

- **Phase 0 · Prüfstand (KLLM-56)** — FERTIG gebaut: 12 deutsche Testfälle über alle 6 Tasks inkl.
  G-2-Belegstellen-Check und „ehrlich passen"-Fällen; Runner im PMO
  (`scripts/pruefstand-run.mjs anthropic` = Referenz-Messlatte; erster echter Lauf steht aus).
- **Phase 1 · Eval auf Stunden-GPU (KLLM-57)** — UpCloud Helsinki, **1× L40S 48 GB, 1,11 €/h**
  (H100 „at capacity"); real ~0 € dank Gratis-Credits (Verfall ~01.08!). Modelle: Qwen3 32B (AWQ),
  Qwen3 14B, Mistral Small — je Modell kompletter Prüfstand; Messgrößen: Punkte vs. Referenz,
  s/Antwort, VRAM, €/1.000 Aufgaben. Server nach Eval löschen.
- **Phase 2 · Entscheidungs-Brief (KLLM-59)** — eine Seite für Pedi: bestes Modell + 3 Betriebsoptionen
  (UpCloud monatlich, Hetzner dediziert, „lohnt nicht → Anthropic bleibt").
- **Phase 3 · Dauerbetrieb (KLLM-60)** — nur nach Pedi-Go; gehärtet, systemd, Modell gepinnt,
  als Provider in der KI-Verwaltung.
- **Phase 4 · Kunden-Blaupause** — On-Prem-Anleitung für Pilotkunden.

## Werkzeug: „KLARWERK LLM"-App (Schreibtisch)

Ein-Klick-Routine (`klarwerk-local-llm/scripts/klarwerk-llm.command`): liest UpCloud-Token aus
Schlüsselbund `KLARWERK-UpCloud-API`, erstellt Server per API (fi-hel2, L40S-Plan, Ubuntu-24.04-
NVIDIA-Template, 200 GB), bootstrappt vLLM per Docker (Standardmodell `Qwen/Qwen3-32B-AWQ`,
API nur auf 127.0.0.1), baut SSH-Tunnel `localhost:8123` — Aktionen: Starten/Status/Löschen.
**Status: syntaxgeprüft, noch NIE echt gelaufen** — erster Lauf gemeinsam mit Pedi, Fehler live fixen.

## App-Anschluss (KLLM-61, offen)

`openAiCompatibleClient` im Reasoner + Env `KLARWERK_LOCAL_LLM_URL` → lokaler Server erscheint
als Provider in der KI-Verwaltung (Key-Test-Muster „Provider: grün").

## Harte Regeln

Kosten laufen ab Servererstellung (je angefangene Stunde; GPU bleibt ~1 h nach Shutdown reserviert)
→ nach Eval LÖSCHEN (mit Storage). LLM-API nie öffentlich. Käufe/Buchungen nur Pedi.

# KLLM-57 · Auswertungsgerüst Eval-Sitzung 1 (lebendes Dokument)

> [Cloud-Worker], 03.07.2026 · Wird während/nach den Prüfstand-Läufen gefüllt.
> Quellen nach den Läufen: `docs/team2-austausch/pruefstand/` (pruefstand-latest.md + Ergebnis-JSON).
> Kostenbasis: 1× L40S 48 GB, **1,11 €/h je angefangene Stunde** (UpCloud FI-HEL2, verifiziert).

## Sitzungs- & Kostenprotokoll (ehrlich, fortlaufend)

| Zeit (MESZ) | Ereignis | Kosten-Relevanz |
|---|---|---|
| ~08:00 | Server MANUELL im Hub erstellt (Default-Name, 50 GB statt 200 GB) | Kostenuhr läuft ab hier |
| ~08:07 | Pedi-Entscheid: weiternutzen statt löschen (Slot-Reservierung); Umbenennung auf `klarwerk-llm-eval` | — |
| 08:08 | App „Starten": Server erkannt ✓, Docker-Image gezogen ✓, vLLM-Container gestartet, Modell-Download läuft (Qwen3-32B-AWQ) | — |
| _offen_ | Modell bereit / Tunnel steht (FERTIG-Meldung) | — |
| _offen_ | Prüfstand Referenzlauf `anthropic` | — |
| _offen_ | Prüfstand Lauf 1: Qwen3-32B-AWQ | — |
| _offen_ | Modellwechsel + Lauf 2/3 (Qwen3 14B, Mistral Small) — Achtung 50-GB-Disk: Cache ggf. leeren | — |
| _offen_ | **Aktion „Löschen" (inkl. Storage) + Hub-Check durch Pedi** | Kostenuhr ENDE |
| _offen_ | Gesamtdauer → Kosten der Sitzung: `⌈Stunden⌉ × 1,11 €` (aus Gratis-Credits) | |

## Ergebnistabelle (Abnahme-Artefakt KLLM-57)

Referenz-Messlatte: Anthropic-Lauf (`pruefstand-run.mjs anthropic`) — Punkte von max. 24 (12 Fälle × 0–2).

| Messgröße | Referenz (Anthropic) | Qwen3-32B-AWQ | Qwen3 14B | Mistral Small |
|---|---|---|---|---|
| Punkte gesamt (von 24) | _offen_ | _offen_ | _offen_ | _offen_ |
| davon „Ehrlich passen"-Fälle bestanden (3) | _offen_ | _offen_ | _offen_ | _offen_ |
| davon G-2-Belegstellen-Check | _offen_ | _offen_ | _offen_ | _offen_ |
| Sekunden/Antwort (Ø) | _offen_ | _offen_ | _offen_ | _offen_ |
| VRAM (GB, nvidia-smi während Lauf) | — | _offen_ | _offen_ | _offen_ |
| €/1.000 Aufgaben¹ | API-Preis je Token² | _offen_ | _offen_ | _offen_ |

¹ Formel lokal: `€/1.000 = (Ø s/Antwort × 1.000 ÷ 3.600) × 1,11 €` — reine GPU-Zeit, ohne Standby.
² Referenz ehrlich anders gerechnet (Token-Preis, nicht Stundenpreis) — im Brief transparent machen.

**Je-Fall-Detail** (aus Ergebnis-JSON, nach den Läufen): Tabelle Fall × Modell mit 0/1/2-Wertung
und Begründung — v. a. wo lokale Modelle bei „weiß nicht"-Fällen halluzinieren (K.-o.-Kriterium).

## Gerüst Entscheidungs-Brief KLLM-59 (eine Seite für Pedi, nach der Eval)

1. **Ergebnis in einem Satz:** Modell X erreicht Y von 24 Referenzpunkten (Anthropic: Z) bei ~N s/Antwort.
2. **Ehrlichkeits-Check:** Besteht X die drei „weiß nicht"-Fälle? (Wenn nein: für KLARWERK untauglich, egal wie gut sonst.)
3. **Drei Optionen mit echten Zahlen:**
   - A · UpCloud monatlich (L40S dauerhaft: Stundenpreis × Betriebsstunden, Zahlen aus Konfigurator),
   - B · Hetzner dediziert (Konfigurator-Preis am Entscheidungstag prüfen — nie Pressemitteilung),
   - C · **„Lohnt nicht"** — Anthropic bleibt Betriebsweg (gültiges Ergebnis, D-012: Beta hängt nicht daran).
4. **Empfehlung + nächster Schritt** (Phase 3 nur nach Pedi-Go).

## Merkzettel für die Sitzung (Stop-Regeln)

Löschen nach der Sitzung ist PFLICHT (inkl. Storage, Hub-Check) · nur 1 GPU · API nie öffentlich ·
nicht über Nacht · Disk-Füllstand vor jedem Modellwechsel prüfen (50-GB-Risiko dokumentiert).

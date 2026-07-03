# KLLM-57 · Auswertung Eval-Sitzung 1 — FINAL (Stand 09:50)

> [Paul / Cloud-Worker], 03.07.2026 · Quellen: `docs/team2-austausch/pruefstand/` (Läufe 09:27 + 09:29).
> Kostenbasis: 1× L40S 48 GB, **1,11 €/h je angefangene Stunde** (UpCloud FI-HEL2, verifiziert).

## Sitzungs- & Kostenprotokoll (ehrlich, fortlaufend)

| Zeit (MESZ) | Ereignis | Kosten-Relevanz |
|---|---|---|
| ~08:00 | Server MANUELL im Hub erstellt (Default-Name, **50 GB statt 200 GB**) | Kostenuhr läuft ab hier |
| ~08:07 | Pedi-Entscheid: weiternutzen (Slot-Reservierung); Umbenennung auf `klarwerk-llm-eval` | — |
| 08:08 | App „Starten": Docker-Pull ✓, vLLM gestartet, Modell-Download läuft | — |
| 08:38–08:46 | Timeout nach 30 Min; Status rot; Diagnose: **Disk 100 % voll**, Download bei 6,3/20 GB, Container-Schleife | Wurzel: 50-GB-Deploy |
| ~08:55 | Pedi: Hub Stop → **Resize 200 GB** → Start; Skript v2 (growpart + Platz-Check) gespiegelt | Storage-Aufpreis marginal |
| 09:04 | **Modell bereit** (Status grün; vLLM 0.24.0, 42,7/46 GB GPU, Gewichte 18,2 GiB) | — |
| 09:27 | Prüfstand Referenzlauf `anthropic` (12 Fälle) | API-Token-Kosten (PMO-Key) |
| 09:29 | Prüfstand Lauf 1: Qwen3-32B-AWQ | — |
| 09:38 | Runner v2 deployed (Denkmodus aus + <think>-Strip, fair zur App-Realität KLLM-61) | — |
| 09:36* | **Lauf 2: 22/24, Ø 1,7 s — Referenzniveau, alle Ehrlich-Fälle ✓** (*Runner-Zeitstempel) | — |
| 09:50 | Pedi-Entscheid: Sitzung beenden, Server LÖSCHEN; 14B/Mistral → Sitzung 2 | — |
| verschoben | Modellwechsel Qwen3 14B / Mistral Small → **Sitzung 2** (Skript-Erweiterung Modellwahl via .NEU → Boss) | — |
| ~09:55 | **Aktion „Löschen" (inkl. Storage) + Hub-Check durch Pedi — Vollzug siehe Jira** | Kostenuhr ENDE (~2 h ≈ 2,22 € aus Credits) |

## Ergebnistabelle (Abnahme-Artefakt KLLM-57) — Stand nach Lauf 1

| Messgröße | Referenz (claude-sonnet-4-6) | Qwen3-32B-AWQ (Lauf 1) | Qwen3-32B-AWQ (Lauf 2, bereinigt) | Qwen3 14B | Mistral Small |
|---|---|---|---|---|---|
| Punkte gesamt (von 24) | **22** | 16 | **22 — GLEICHSTAND mit Referenz** | Sitzung 2 | Sitzung 2 |
| „Ehrlich passen"-Fälle | bestanden | 2 von 3 gerissen | **3/3 BESTANDEN** | Sitzung 2 | Sitzung 2 |
| G-2-Belegstellen-Check | ✓ | ✗ (EXT-1 nicht wörtlich) | **✓ wörtlich** | | |
| Sekunden/Antwort (Ø) | 3,3 | 9,9 | **1,7 (schneller als Referenz)** | | |
| VRAM | — | Gewichte 18,2 GiB (belegt inkl. KV-Cache: 42,7 GiB) | identisch | | |
| €/1.000 Aufgaben¹ | Token-Preis (andere Basis²) | ≈ 3,05 € | **≈ 0,52 €** | | |

¹ `Ø s/Antwort × 1.000 ÷ 3.600 × 1,11 €` — reine GPU-Zeit, ohne Standby/Setup.
² Referenz läuft je Token über die Anthropic-API — im Brief transparent gegenüberstellen.

## Befunde Lauf 1 (je Fall siehe Brücken-Reports)

1. **Messartefakt (behoben in Runner v2):** Qwen3 stellt Antworten einen `<think>`-Block voran → JSON-Checks STR-1/2 scheiterten trotz inhaltlich richtiger Struktur (5/6 bzw. 4/5). Der App-Client (KLLM-61) wird Denkblöcke ohnehin abstreifen → Lauf 2 misst fair.
2. **Echtes Ehrlichkeitsproblem (K.-o.-relevant):** EXT-2 hat nicht ehrlich „keine Punkte" geantwortet; SEL-2 hat Kandidaten ERFUNDEN (0 P). Für KLARWERK („lieber ehrlich passen als halluzinieren") ist das das härteste Kriterium — Lauf 2 zeigt, ob es am Denkmodus lag oder am Modell.
3. G-2: eine Belegstelle nicht wörtlich (EXT-1) — Halluzinationsneigung bei Zitaten.
4. Tempo Lauf 1: Faktor 3 langsamer — durch Denkmodus; Lauf 2: SCHNELLER als Referenz (1,7 s).
5. **Fazit Lauf 2:** Der komplette Lauf-1-Einbruch war der Denkmodus. Ohne ihn: Referenzniveau,
   alle Ehrlich-Fälle bestanden, doppeltes Tempo, ~0,52 €/1.000. Verbleibend je 1 P: INT-2
   (Nachbohren zu generisch) und ASS-2 („sechs Wochen" fehlt — identisch bei der Referenz).
   **Harte Auflage KLLM-61: enable_thinking=false + <think>-Filter im App-Client.**

## Entscheidungs-Brief KLLM-59: Entwurf liegt separat (`KLLM-59-ENTSCHEIDUNGSBRIEF-ENTWURF.md`)

### Ursprüngliches Gerüst (erledigt durch Entwurf)

1. Ergebnis in einem Satz: Modell X erreicht Y/24 (Referenz 22/24) bei Ø N s.
2. Ehrlichkeits-Check: Besteht X die drei „weiß nicht"-Fälle? (Wenn nein: untauglich oder nur mit Prompt-Härtung.)
3. Drei Optionen mit echten Zahlen: A UpCloud monatlich · B Hetzner dediziert (Konfigurator!) · C „lohnt nicht" → Anthropic bleibt (D-012: gültiges Ergebnis).
4. Empfehlung + nächster Schritt (Phase 3 nur nach Pedi-Go).

## Merkzettel (Stop-Regeln)

Löschen nach der Sitzung PFLICHT (inkl. Storage, Hub-Check) · nur 1 GPU · API nie öffentlich ·
nicht über Nacht · Modellwechsel erst nach Skript-Erweiterung (.NEU → Boss-Übernahme, x-Bit-Regel).

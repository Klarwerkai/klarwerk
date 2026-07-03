# Runbook — LLM-Eval-Server aufsetzen (Phase 1, erster Lauf)

> Für den geplanten ersten echten Lauf (03.07.). **Ehrlich:** Das Skript ist v0, syntaxgeprüft,
> aber noch NIE echt gelaufen — Fehler beim ersten Lauf sind ERWARTET und werden live mit einer
> Claude-Session gefixt. Nicht alleine durchbeißen.

## Vorher wissen (Kosten & Stop-Regeln)

- Kosten laufen **ab Servererstellung**, je angefangene Stunde (~1,11 €/h L40S); GPU bleibt nach
  Shutdown ~1 h reserviert. Gratis-Credits (~500 €, Verfall ~01.08.) werden ZUERST verbraucht.
- **Nach jeder Eval-Sitzung: Server LÖSCHEN** (Aktion „Löschen" in der App, löscht inkl. Storage).
  Über Nacht laufen lassen ist verboten.
- Nur **1× L40S** (mehr GPUs würden laut UpCloud-Support die Gratis-Credits entfernen; H100 meist „at capacity").
- LLM-API nie öffentlich — die App bindet sie nur an 127.0.0.1 und nutzt einen SSH-Tunnel.
- **Server NUR über die App „KLARWERK LLM" erstellen — NIE über das Hub-Deploy-Formular.**
  Die App erkennt ihren Server am Namen `klarwerk-llm-eval`; ein manuell erstellter Server
  (Default-Name, abweichender Storage) wird nicht erkannt → Gefahr eines zweiten Servers
  bzw. GPU-Limit-Fehler. Falls doch manuell erstellt (Vorfall 03.07.): im Hub auf exakt
  `klarwerk-llm-eval` umbenennen, Storage-Größe prüfen (Soll: 200 GB), dann erst „Starten".

## Einmalige Vorbereitung (Pedi, ~5 Minuten)

1. UpCloud-Konsole → API-Token erstellen (hub.upcloud.com, Account → API tokens), kopieren.
2. Schreibtisch-App **„KLARWERK LLM"** doppelklicken → beim ersten Start fragt sie nach dem
   Token und legt ihn in den Schlüsselbund (`KLARWERK-UpCloud-API`/team2). Token danach nirgends speichern.
3. SSH-Schlüssel existiert schon (`Documents/Klarwerk/llm-eval-zugang/`), Public Key ist im
   UpCloud-Konto hinterlegt — nichts zu tun.

## Ablauf einer Eval-Sitzung

1. **„KLARWERK LLM" doppelklicken → Aktion „Starten".** Die App: findet Plan+Template per API,
   erstellt den Server (fi-hel2), installiert vLLM per Docker (Standard: `Qwen/Qwen3-32B-AWQ`),
   wartet auf Bereitschaft (Modell-Download dauert beim ersten Mal spürbar — Geduld),
   baut den Tunnel: LLM ist dann unter `http://localhost:8123/v1` erreichbar.
2. **Prüfstand fahren** (Claude-Session oder Terminal-Sichtfenster):
   Referenz einmalig: `node scripts/pruefstand-run.mjs anthropic` (im PMO-Ordner).
   Lokal: `node scripts/pruefstand-run.mjs http://localhost:8123/v1`.
   Ergebnis: `reports/pruefstand-latest.md` + Historie in `data/pruefstand-ergebnisse.json`;
   im PMO-Dashboard unter „⚖ Prüfstand" sichtbar.
3. **Modell wechseln** (Qwen3 14B, Mistral Small): Claude-Session ändert `$MODEL` / startet den
   Docker-Container neu — je Modell kompletter Prüfstand + VRAM notieren.
4. **Aktion „Status"** zeigt jederzeit Serverzustand/IP/Tunnel.
5. **Aktion „Löschen"** am Ende — Pflicht. Danach im UpCloud-Hub kurz prüfen: keine Server, keine Storages.

## Erfolgskriterien (Abnahme KLLM-57)

Ergebnistabelle je Modell: Punkte vs. Anthropic-Referenz · Sekunden/Antwort · VRAM · €/1.000 Aufgaben.
Danach Phase 2: Entscheidungs-Brief (KLLM-59) für Pedi.

## Wenn etwas klemmt

- Fehlermeldung im Terminal-Fenster stehen lassen, Screenshot an die Claude-Session — Fix am
  Master (`klarwerk-local-llm/scripts/klarwerk-llm.command`), Spiegel auf Schreibtisch, neu klicken.
- Häufigste erwartbare Punkte: Token-Rechte, Plan-/Template-Namen (API-Discovery), SSH-Fingerprint-
  Erstbestätigung, Docker-/NVIDIA-Startzeit. Alles lösbar — nichts davon kostet mehr als Minuten.
- Notbremse geht immer: UpCloud-Hub → Server → Delete (inkl. Storage).

# KWN-2 — Übergabe an Pedi (Insel-Prüfstand im Benutzer „Klarwerk" auf dem Mac Studio)

Von: **KLARWERK NERD** · 04.07.2026 · Quelle: KLLM-62 · Ticket: KWN-2

## Reihenfolge (wichtig)

1. **Zuerst:** Mac Studio aufsetzen nach `MAC-STUDIO-ERSTEINRICHTUNG.md`
   (persönlicher Account → Updates → Sicherheit → Benutzer **„Klarwerk"** anlegen → offline-fähig
   machen → als „Klarwerk" anmelden). Diese Admin-Schritte macht **Pedi** — NERD kann sie nicht
   fernausführen.
2. **Dann, im Benutzer „Klarwerk":** KWN-2 messen (dieses Dokument).
3. **Zum Schluss:** `KWN-2-Abschluss-Check.command` laufen lassen.

## Worum es geht (ein Satz)

Alles ist vorbereitet, um den lokalen LLM der Insel **im Benutzer „Klarwerk" auf dem Mac Studio**
zu messen. Gemessen wird erst, wenn jemand es **auf dem Gerät** startet — diese Cloud-Session darf
auf dem Mac nur Dateien lesen/schreiben, nicht ausführen (gleiche Grenze wie beim „Paul Runner").

## Dateien (in der Brücke `docs/team2-austausch/`, über Sync im Klarwerk-User verfügbar)

- `MAC-STUDIO-ERSTEINRICHTUNG.md` — Ersteinrichtungs-Runbook (Vorstufe).
- `KWN-2 Insel-Pruefstand.command.NEU` — Mess-Skript (Ollama + Qwen3 + Prüfstand auf localhost).
  Nutzt `$HOME` → läuft automatisch unter dem Benutzer, der es startet (also „Klarwerk").
- `KWN-2-Abschluss-Check.command.NEU` — prüft die Abnahmepunkte und schreibt einen Report.
- `KWN-2-ERGEBNISTABELLE-INSEL.md` — Abnahme-Tabelle (Apple-Silicon-Spalten noch offen).

## Boss-/Admin-Weg (x-Bit-Regel, einmalig)

Cloud-Sessions setzen keine Ausführungsrechte. Für **beide** `.NEU`-Skripte:
1. In den Master übernehmen, `chmod +x`.
2. Auf den Schreibtisch spiegeln + dünne App-Hülle bauen
   (`open -a Terminal "…/…command"`), eigener CFBundleIdentifier.
3. Dann klickt Pedi nur die **.app** (im Benutzer „Klarwerk").

## Was Pedi im Benutzer „Klarwerk" tut

1. Einmalig, mit Internet (Teil der Ersteinrichtung): `brew install ollama node git`,
   Repos über KLARWERK Sync/GitHub holen, `ollama pull qwen3:32b` (Rückfall `qwen3:14b`).
2. **„KWN-2 Insel-Pruefstand"** doppelklicken. Prüft Hardware, startet Ollama nur auf localhost,
   fährt den **unveränderten** PMO-Runner gegen `localhost:11434/v1`, legt den Report in
   `docs/team2-austausch/pruefstand/` (Dateiname mit `macstudio` + Modell-Tag).
3. Reicht 32B nicht: `MODELL=qwen3:14b ./"KWN-2 Insel-Pruefstand.command"`.
4. **Offline-Abnahme:** Netz (Wi-Fi/Ethernet) AUS → App/Prüfstand erneut starten → muss laufen.
5. **„KWN-2-Abschluss-Check"** doppelklicken → prüft Benutzer/Hardware/lokale API/Modell/KLLM-61/
   Reports; schreibt `KWN-2-ABSCHLUSS-CHECK-ERGEBNIS.md`.
6. Mir Bescheid geben — ich trage die Zahlen in KWN-2 ein (Referenz 22/24 + L40S als andere Hardware).

## Damit NERD die Ergebnisse sehen kann

Die Datei-Brücke hängt am jeweiligen Benutzer. Damit ich die Reports **aus dem Klarwerk-User**
lesen kann: im Benutzer „Klarwerk" die Claude-Desktop-App verbinden und dieselben Ordner freigeben
(`dev_Klarwerk`, `KLARWERK_Reporting_PMO`, `Documents`) — **oder** die Reports in einen für mich
sichtbaren Ordner kopieren. Sonst sehe ich nur den aktuell verbundenen Account (`peterkohnert`).

## Ehrlich / Grenzen

- Modell-Pullen braucht **einmalig** Internet (Aufbau) — **nicht** beim Air-Gap-VIP; danach lokal.
- **Zeitpunkt:** Bau + Messung jetzt; **Übergabe an den VIP** erst nach VIP-Zusage (nach 05.07.), KLLM-62.
- Keine Käufe, keine Secrets im Skript. LLM nur über localhost.
- **Welcher Mac?** Die Messung gehört auf den **Mac Studio M4 Pro / 64 GB**, Benutzer „Klarwerk".
  Das Skript prüft die Hardware selbst und bricht auf falscher Hardware ab.

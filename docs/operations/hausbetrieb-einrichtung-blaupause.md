# KLARWERK im eigenen Haus — Blaupause für die Einrichtung beim Kunden

*R-0843 (Auftrag `aufnahme:20260922:gesamt-kundenbetrieb`). Zusammengesetzt aus den vorhandenen
Bausteinen: Inselpaket (`scripts/insel/build-current-release.mjs`, `scripts/insel/release-texte.mjs`),
Einspielweg (`scripts/insel/update-einspielen.sh`), Rückfall (`scripts/insel/rueckfall.sh`),
Sicherung (`scripts/backup/backup.sh`). Die Bedienung danach steht auf einer Seite in
`docs/operations/hausbetrieb-bedienkarte.md`.*

> **Was diese Blaupause ist:** die Schrittfolge, mit der jemand KLARWERK auf einem Rechner im Haus
> des Kunden aufsetzt, je Schritt mit dem, was man sehen muss. **Was sie nicht ist:** ein Beleg, dass
> ein Kunde das schon ohne Beistand getan hat. Eine solche Abnahme gibt es nicht (§4).

## 1. Voraussetzungen — belegt oder ausdrücklich ungewiss

| Voraussetzung | Stand |
| --- | --- |
| Rechner: macOS auf Apple Silicon | **belegt** als Referenz (Mac Studio). Ein Paket gilt nur für die Plattform, auf der es gebaut wurde (native Bibliotheken; `insel-hausbetrieb-anforderungen.md` H1). |
| Node.js ≥ 20, unter `/opt/homebrew/bin/node` oder im `PATH` | **Vorbedingung beim Kunden**; nicht im Paket (H1). `start.command` bricht ohne Node mit einer Meldung ab. |
| Lokales Sprachmodell (Ollama auf `127.0.0.1:11434`, Vorgabe `mistral:latest`) | **optional**; ohne Modell arbeitet KLARWERK im deterministischen Ersatzmodus. Modell und Laufzeit sind nicht im Paket (H1). |
| Hardware | **ungewiss**: keine gemessene Mindestangabe. Beispielwerte für das Modell in `docs/operations/local-hardware-readiness.md`; das Erstinventar am Zielrechner fehlt (H2). |
| Datenhaltung | Vorgabe: Journal unter `/Users/Shared/Klarwerk_Insel/data/state.jsonl`. PostgreSQL, wenn `KLARWERK_DATABASE_URL` gesetzt ist. Beides steht in `start.command`. |
| Netz | Der Server horcht auf **allen** Schnittstellen (`services/app/src/server.ts`, `host: "0.0.0.0"`) auf Port `3002`. Wer nur diesen Rechner zulassen will, sperrt den Port in der macOS-Firewall; wer andere Rechner im Haus zulassen will, setzt `APP_BASE_URL` auf deren Zugriffsadresse. |

## 2. Material

1. `klarwerk-insel-<app-version>-<commit8>-<bauzeit>.zip` aus dem offiziellen Bauer.
2. `<…>.zip.sha256` daneben (Prüfsumme, `scripts/insel/paket-pruefsumme.mjs`).
3. Diese Blaupause und die Bedienkarte.

Nicht im Material und deshalb vorab beim Kunden zu klären: Node.js, die Modelllaufzeit samt Modell,
eine Signatur (es gibt keine; H3).

## 3. Schritte

| Nr. | Schritt | Was man sehen muss |
| --- | --- | --- |
| 1 | Paket und Prüfsumme in einen Ordner legen; dort `shasum -a 256 -c <…>.zip.sha256`. | `<…>.zip: OK` |
| 2 | ZIP auspacken (Doppelklick im Finder). | Ein Ordner `klarwerk-insel-…` mit `install.command`, `start.command`, `ROLLBACK.md`, `SCHEMA-VERTRAG`. |
| 3 | Optional: Datenhaltung und Modell festlegen — `KLARWERK_DATABASE_URL`, `KLARWERK_LOCAL_LLM_URL`, `KLARWERK_LOCAL_LLM_MODEL`, `PORT`, `APP_BASE_URL` in der Umgebung des späteren Starts (launchd-Agent oder `start.command`). Ohne Angabe gelten die Vorgaben aus §1. | — |
| 4 | Doppelklick auf `install.command`. Er übergibt an `update-einspielen.sh`: sichern, Schema-Vertrag prüfen, nach `/Users/Shared/Klarwerk_Insel/releases/` legen, `current` setzen, starten, `/health` samt Version prüfen. | Ergebniszeile `Update auf <version> aktiv, Sicherung <pfad>`. Bei einem Rechner, auf dem schon Daten ohne Fassungsangabe liegen: Abbruch mit Exit 10 — dann mit `--datenstand-unbekannt-uebernehmen` wiederholen. |
| 5 | Browser `http://127.0.0.1:3002`, erstes Konto anlegen (Ersteinrichtung). | Anmeldung gelingt; das Konto ist Verwalter. |
| 6 | Ein Wissensobjekt erfassen und speichern. | Es erscheint in der Liste und im Wissensnetz. |
| 7 | `http://127.0.0.1:3002/health` öffnen und die Version mit dem Paketnamen vergleichen. | `"status":"ok"`, `"version"` gleich der App-Version im Paketnamen. |
| 8 | Optional: launchd-Agent `de.klarwerk.insel` einrichten, damit der Server mit dem Rechner startet. Der Einspielweg erkennt ihn und startet über `launchctl kickstart`. | Nach Neustart des Rechners zeigt Schritt 7 dasselbe. |

## 4. Grenzen, ausdrücklich

- **Keine Abnahme durch Dritte.** Kein Beleg, dass ein Kunde diese Schritte ohne Beistand gefahren hat.
  Die vergleichbare Probe für die Kundeninstanz unter Linux gehört zu B2 (R-0823).
- **Plattform.** Nur macOS auf Apple Silicon ist als Referenz belegt; der launchd-Teil braucht macOS.
- **Material ohne Netz.** Node und Modell sind Vorbedingung, nicht Lieferumfang (H1, Entscheidung offen).
- **Echtheit.** Die Prüfsumme zeigt Unversehrtheit, nicht Herkunft; eine Signatur gibt es nicht (H3).
- **Wiederaufbau.** `scripts/insel/Insel-inventarisieren.command` und `Insel-aufbauen.command` sind
  vorhanden, aber nie auf einem echten Gerät gefahren (R-0809).
- **Zwei Startwege, zwei Ports.** Das Paket startet auf `3002`; der Referenzstarter
  `scripts/insel/Insel-App-starten.command` auf dem Entwicklungs-Mac auf `3001`. Diese Blaupause gilt
  für das Paket.

# KLARWERK im eigenen Haus — Bedienkarte

*Für die Person, die KLARWERK auf dem Rechner im Haus betreut. Einrichtung:
`docs/operations/hausbetrieb-einrichtung-blaupause.md`. Arbeiten mit KLARWERK:
`docs/onboarding/user-quickstart.md`. Stand: Inselpaket aus `scripts/insel/build-current-release.mjs`.*

| Ich will … | So geht es | Woran ich sehe, dass es geklappt hat |
| --- | --- | --- |
| **KLARWERK öffnen** | Im Browser `http://127.0.0.1:3002` (auf dem KLARWERK-Rechner). Von einem anderen Rechner im Haus: die Adresse, die bei der Einrichtung als `APP_BASE_URL` festgelegt wurde. | Die Anmeldemaske erscheint. |
| **KLARWERK starten** | Führt ein launchd-Dienst (`de.klarwerk.insel`) den Server, startet er mit dem Rechner von selbst. Sonst: Doppelklick auf `start.command` im Ordner `/Users/Shared/Klarwerk_Insel/current`. | Das Fenster meldet `[start] Datenhaltung: …`; danach öffnet sich die Seite oben. |
| **Prüfen, welche Fassung läuft** | Im Browser `http://127.0.0.1:3002/health`. | `"status":"ok"` und `"version":"…"` — das ist die **laufende** Fassung. |
| **Neue Fassung einspielen** | Das neue Paket auf den Rechner legen, Prüfsumme prüfen (siehe nächste Zeile), auspacken, im ausgepackten Ordner **Doppelklick auf `install.command`**. Es sichert zuerst, prüft, schaltet um und prüft die neue Fassung. | Genau eine Ergebniszeile: `Update auf <version> aktiv, Sicherung <pfad>` — oder `Update abgebrochen, Vorversion <version> läuft wieder, Grund: …`. Bei Abbruch läuft die alte Fassung weiter; nichts ist verloren. |
| **Paket prüfen** | Im Paketordner `shasum -a 256 -c <version>.zip.sha256` (Terminal). | `<version>.zip: OK`. Alles andere: Paket **nicht** einspielen. |
| **Zur vorigen Fassung zurück** | `bash /Users/Shared/Klarwerk_Insel/current/scripts/insel/rueckfall.sh` (Terminal). | `Vorversion <version> aktiv`. |
| **Sicherungen finden** | Jedes Update sichert vorher selbst nach `/Users/Shared/Klarwerk_Insel/backups`. | Die Ergebniszeile des Updates nennt den Pfad. |
| **Daten zurückholen** | Journalbetrieb: `rueckfall.sh --daten-zurueck <sicherung>`. PostgreSQL: Rückspielen ist ein eigener Schritt nach `scripts/backup/RESTORE.md` — `restore-drill.sh` **prüft** eine Sicherung nur. | siehe `ROLLBACK.md` im Paket |
| **Wenn etwas nicht geht** | Protokoll `/Users/Shared/Klarwerk_Insel/logs/server-3002.log` ansehen; die letzte Ergebniszeile von Update oder Rückfall aufheben. | — |

**Was das Haus verlässt.** Nichts, solange auf diesem Rechner kein Cloud-Schlüssel
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`), kein externer Mail- oder Anmeldedienst und kein nicht
bestätigter Modellendpunkt eingetragen ist (`docs/operations/kundenbetrieb-betriebsmodelle.md` §2.2).

**Grenzen dieser Karte.** Paketprüfung und Rückfall von Hand brauchen heute ein Terminalfenster; nur
Start und Update haben einen Doppelklick. Port `3002` ist die Vorgabe des Pakets und lässt sich bei der
Einrichtung über `PORT` ändern — dann gilt überall die neue Zahl.

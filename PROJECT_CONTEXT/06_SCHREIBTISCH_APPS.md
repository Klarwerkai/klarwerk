# Schreibtisch-Apps — so bleibt alles benutzerfreundlich

## Das Prinzip

Pedi (und jeder nicht-technische Mitarbeiter) bedient das Projekt **ausschließlich über
Doppelklick-Apps auf dem Schreibtisch** — nie über Terminal-Eingaben. Alles, was regelmäßig
gebraucht wird, MUSS als Schreibtisch-App existieren. Neue wiederkehrende Abläufe bekommen
eine neue App nach demselben Muster. Das ist eine Produktentscheidung, keine Bequemlichkeit:
Benutzerfreundlichkeit für den Stakeholder = weniger Fehler, keine Abhängigkeit von Technikern.

## Das technische Muster (für Claude-Sessions, die Apps bauen/ändern)

macOS blockiert Script-Apps oft beim Documents-Zugriff (TCC). Bewährtes Muster:
1. Die eigentliche Logik lebt in einer **`.command`-Datei** (Bash; Terminal hat Ordnerzugriff
   und zeigt sichtbaren Fortschritt — der Nutzer sieht IMMER, was passiert).
2. Die **`.app`** daneben ist nur eine dünne Hülle: `open -a Terminal "….command"`.
3. **Master-Kopie liegt versioniert** (Repo oder `Documents/Klarwerk/tools-sync/`), die
   Schreibtisch-Kopie ist ein Spiegel. **Dauerregel:** Jede Änderung sofort auf den
   Schreibtisch spiegeln (diff prüfen, Ausführbarkeit +x erhalten). Der Schreibtisch ist
   die Wahrheit für den Nutzer — eine veraltete Kopie dort ist ein ernster Fehler (ist passiert).
4. Schlüssel/Tokens NIE in der Datei — immer macOS-Schlüsselbund (`security find-generic-password`);
   fehlt der Eintrag, fragt die App den Nutzer einmalig per Dialog.
5. Ehrliche Ausgaben: ✓/FEHLER je Schritt, Log-Datei, kein stilles Scheitern.
6. **DAUERREGEL (Pedi, 03.07.): Pedi bedient AUSSCHLIESSLICH .app-Doppelklicks** — nackte
   .command-Dateien sind für ihn tabu. JEDE neue oder geänderte Terminal-Routine bekommt
   SOFORT und unaufgefordert die passende App-Hülle auf dem Schreibtisch (eigene
   CFBundleIdentifier, +x auf das MacOS-Binary, Spiegel-Diff gegen den Master).
7. **Grenze der Cloud-Datei-Brücke (gelernt 03.07.):** Die Brücke (`docs/team2-austausch/`)
   kann KEINE Ausführungsrechte setzen — Cloud-Sessions ([Paul]) dürfen daher NIE direkt
   funktionierende Starter/App-Binaries überschreiben. Ablauf immer: Paul legt `.NEU` in die
   Brücke + Jira-Kommentar → die Boss-Session übernimmt in den Master, setzt +x, spiegelt auf
   den Schreibtisch und baut/aktualisiert die App-Hülle. (Vorfall: App-Hülle ohne x-Bit und mit
   falschem Binary-Namen → „can't be opened".)

## Die Apps im Einzelnen

### KLARWERK App.app
Startet die KLARWERK-App lokal und öffnet sie im Browser. Prüft beim Start den Anthropic-Key
im Schlüsselbund (`KLARWERK-App-Anthropic`/team1) gegen die API; ungültig/fehlend → Dialog zum
Eintragen; erneuerter Key erzwingt Server-Neustart. Master: Repo `dev_Klarwerk/desktop-app/`.
**Check nach jedem Update:** Versionsnummer oben rechts in der App muss der erwarteten entsprechen.

### KLARWERK Sync.app (+ „KLARWERK Sync starten.command")
**Der einzige Weg, wie Code das Haus verlässt.** Pusht alle Projekt-Repos sichtbar im Terminal
zu GitHub + Gitea (je Repo ✓/FEHLER + Anzahl Commits). Claude-Sessions committen nur lokal —
Pedi (oder der Mitarbeiter) klickt Sync. Vor Arbeitsbeginn und nach Feierabend laufen lassen.
Master: `Documents/Klarwerk/tools-sync/klarwerk-sync.command`. Log: `tools-sync/sync.log`.

### KLARWERK LLM.app (+ .command)
Team 2: erstellt per UpCloud-API den LLM-Eval-Server (L40S), installiert vLLM, baut den
SSH-Tunnel `localhost:8123`; Aktionen Starten/Status/**Löschen** (wichtig: nach der Eval löschen,
Kosten laufen je angefangene Stunde!). Token im Schlüsselbund `KLARWERK-UpCloud-API`/team2.
Master: `Documents/Klarwerk/klarwerk-local-llm/scripts/`. Status: noch nie echt gelaufen (v0).

### PMO-Dashboard (kein .app nötig)
`Documents/KLARWERK_Reporting_PMO/index.html` doppelklicken → Fortschritt, Register, Prüfstand-Tab.

## Für den neuen Mitarbeiter

Die Apps sind an Pedis Mac gebaut (Pfade unter `/Users/peterkohnert/…`). Für einen zweiten Mac:
Ordnerstruktur gleich anlegen (`~/Documents/Klarwerk/…`, `~/Documents/dev_Klarwerk`), Repos über
GitHub beziehen, dann eine Claude-Session bitten, die Starter-Dateien auf die eigenen Pfade
anzupassen und auf den Schreibtisch zu legen (Muster oben). Eigene Keys/Tokens von Pedi
persönlich erhalten und NUR in den eigenen Schlüsselbund legen.

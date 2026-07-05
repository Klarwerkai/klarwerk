# Mac Studio — Ersteinrichtung für die KLARWERK-Insel (Runbook für Pedi)

Von: **KLARWERK NERD** · 04.07.2026 · Quelle: KLLM-62 · Vorstufe zu KWN-2

> **Wer macht was:** Diese Schritte sind **physische Admin-Handlungen am Gerät** (Apple-Account,
> Systemeinstellungen, Passwörter, Benutzeranlage). Die macht **Pedi selbst** — KLARWERK NERD
> kann und darf das nicht aus der Ferne tun (keine Befehlsausführung, und Account-/Sicherheits-
> einstellungen sind ausdrücklich Menschensache). NERD liefert die Anleitung, das KWN-2-Kit und
> den Abschluss-Check. Häkchen bitte in dieser Datei setzen (wird über die Brücke/Sync sichtbar).

## Warum diese Account-Struktur

- **Persönlicher Account (Pedi):** nur Geräte-Admin, Updates, Recovery, Notfallzugriff.
- **Benutzer „Klarwerk" (Standardnutzer):** der EINZIGE Arbeits- und VIP-Test-User. Alles
  Insel-Bezogene (App, lokaler LLM, Ollama, Modelle, Provider-Config, Prüfstand, Logs, Installer,
  USB-Test, Fernhilfe-Test) lebt hier. Keine KLARWERK-/Modell-/Prüfstands-/VIP-Daten dauerhaft
  im persönlichen Account.
- **Abnahme zählt nur**, wenn Installation, Messung und Offline-Test **im Benutzer „Klarwerk"**
  auf dem **Mac Studio** erfolgt sind.

## Schritt 1 — Grundinstallation (persönlicher Account)

- [ ] Mac Studio mit **Pedis persönlichem Apple-Account** durch die Ersteinrichtung (Setup Assistant).
- [ ] Gerätename vergeben (z. B. `klarwerk-mac-studio`).
- [ ] Mit dem Internet verbinden (nur für Einrichtung/Downloads — der **finale Abnahmetest** läuft
      später **ohne** Internet).

## Schritt 2 — Updates

- [ ] Systemeinstellungen → Allgemein → **Softwareupdate** → alles einspielen, bis „aktuell".
- [ ] Neustart, erneut prüfen (manchmal folgt eine zweite Runde).

## Schritt 3 — Sicherheitsbasis (persönlicher Account)

- [ ] **FileVault** aktivieren (Systemeinstellungen → Datenschutz & Sicherheit → FileVault).
      Wiederherstellungsschlüssel sicher notieren (nicht im Repo/Chat!). Sinnvoll, weil das Gerät
      später beim VIP steht.
- [ ] **Firewall** einschalten (Datenschutz & Sicherheit → Firewall).
- [ ] **Keine unnötigen Freigaben:** Systemeinstellungen → Allgemein → **Teilen** — Bildschirm-,
      Datei-, Fernanmeldung (SSH) etc. AUS, sofern nicht gebraucht. Insbesondere **kein offener
      eingehender Port als Standard** (Fernhilfe kommt später als *ausgehender* Tunnel auf Klick).
- [ ] „Automatische Anmeldung" AUS.

## Schritt 4 — Benutzer „Klarwerk" anlegen

- [ ] Systemeinstellungen → **Benutzer & Gruppen** → Benutzer hinzufügen:
      - Typ: **Standard** (nicht Administrator)
      - Vollständiger Name: **Klarwerk**
      - Kontoname (Kurzname): **klarwerk**
      - Eigenes Passwort setzen (in Pedis Schlüsselbund/Passwortspeicher, nicht im Repo).
- [ ] Optional VIP-Tauglichkeit: aufgeräumter Schreibtisch, klare Benennung, nur die
      KLARWERK-Doppelklick-Apps sichtbar.

> **Adminrechte bei Bedarf:** Braucht „Klarwerk" kurz Admin (z. B. Ollama-Installation), fragt
> KLARWERK NERD Pedi vorher kurz und nennt den Zweck. Pedi gibt das Admin-Passwort ein bzw.
> wechselt kurz in den Admin-Account und **danach wieder zurück zu „Klarwerk"**. Temporäre
> Admin-Erhöhung des Klarwerk-Users dokumentieren und danach zurückstellen.

## Schritt 5 — „Klarwerk" offline-arbeitsfähig machen

- [ ] Einmalig **mit Internet** im Benutzer „Klarwerk":
      - [ ] **Homebrew** installieren (falls noch nicht) → dann `brew install ollama node git`.
      - [ ] KLARWERK-Repos in den Klarwerk-User holen (empfohlen über die vorhandene
            **KLARWERK Sync**/GitHub — gleiche Ordnerstruktur wie bei Pedi):
            `~/Documents/dev_Klarwerk`, `~/Documents/KLARWERK_Reporting_PMO`,
            `~/Documents/Klarwerk/klarwerk-local-llm`.
      - [ ] Modell einmalig laden: `ollama pull qwen3:32b` (Rückfall `qwen3:14b`).
- [ ] Danach ist „Klarwerk" so weit, dass der **Abnahmetest ohne Internet** läuft (Modelle + Repos
      liegen lokal). Der finale Offline-Check kommt in KWN-2.

## Schritt 6 — In „Klarwerk" wechseln und KWN-2 starten

- [ ] Abmelden aus dem persönlichen Account → als **Klarwerk** anmelden.
- [ ] KWN-2-Kit ausführen (siehe `KWN-2-UEBERGABE-PEDI.md`): Prüfstand messen, Ergebnistabelle füllen.
- [ ] Danach `KWN-2-Abschluss-Check.command` laufen lassen (prüft die Abnahmepunkte).

## Betreute Verbindung (Arbeitsweise-Test)

Die Verbindung, über die wir arbeiten, muss **sichtbar, bewusst gestartet und wieder trennbar**
sein — **keine Dauerverbindung**, **kein offener eingehender Port** als Standard. Sie dient nur
dazu, den späteren Ablauf zu proben: anmelden als „Klarwerk" → aufsetzen → messen → dokumentieren
→ Offline prüfen → VIP-Tauglichkeit prüfen. Fernhilfe später ausschließlich **ausgehend, auf Klick,
trennbar, protokolliert** (KWN-4).

> **Praxis-Hinweis (wichtig für NERD):** Die Claude-Datei-Brücke hängt am jeweiligen Benutzer/an
> freigegebenen Ordnern. Damit NERD die **Ergebnisse aus dem Klarwerk-User** lesen kann, im
> Benutzer „Klarwerk" die Claude-Desktop-App verbinden und dieselben Ordner freigeben — **oder**
> die Ergebnis-Reports (aus `docs/team2-austausch/pruefstand/`) in einen für NERD sichtbaren Ordner
> kopieren. Sonst sieht NERD nur, was im aktuell verbundenen Account liegt.

## Sicherheits-Merksätze

Keys nur im macOS-Schlüsselbund · keine Secrets in Code/Repo/Ticket/Chat · private SSH-Keys nie in
Git · LLM-API nie öffentlich (nur localhost bzw. ausgehender Tunnel) · Käufe/Zahlungen/Mails nach
außen nur Pedi · Internet nur für Einrichtung/Downloads, **Abnahme offline**.

# Klara · Arbeit mit ausgewählter öffentlicher KI (BPA-13)

Auftrag `produkt:20261011:assistenz-ki-arbeitsbegleitung` (BPA-Gesamtpaket r2, BPA-13).

| Teil | Datei |
|---|---|
| Kern (rein, ohne I/O) | `services/app/src/ki-arbeitsbegleitung.ts` |
| Dienst (Anschluss an Bestand) | `services/app/src/ki-arbeitsbegleitung-dienst.ts` |
| Codex-Dateiwirkung | `services/app/src/ki-codex-arbeitsbereich.ts` |
| Routen | `services/app/src/routes/ki-arbeitsbegleitung-routes.ts` |
| Verdrahtung | `services/app/src/build-app.ts` (Block „BPA-13“) |
| Oberfläche | `apps/web/src/components/klara-vorschau/KiArbeitsweg.tsx` (im Klara-Gespräch) |
| Prüfung | `tests/ki-arbeitsbegleitung/*.test.ts` |

## Arbeitsweg im Produkt

Eigenes Klara-Gespräch → natürlicher Auftrag mit Ziel, Format, Anbieter, Weg und Quellen →
Paket aus aktuell lesbaren, ausdrücklich freigegebenen Quellen → Job im **bestehenden Verlauf**
(`KlaraGespraech.kiAuftraege`) → Übergabe → Antwort am Ursprung → Beleg.

Vor **jeder** Übergabe (Erstsendung, Wiederaufnahme, erneutes Senden, manuelle Übergabe,
Codex-Wirkung) prüft der Dienst Weg **und** gebundenes Paket neu (`pruefeUebergabe`):
Leserecht (`sichtbarkeitsfilterFuer`), Dokumentfreigabe, Schutzstufe, Fassung und Wortlaut je
Abschnitt. Ein geändertes Paket wird nie still übernommen; es muss ausdrücklich neu gebunden
werden (alter Job → `ersetzt`). Auch die Anzeige des Prompts hängt an dieser Prüfung.

Es gibt keine zweite Policy. Gelesen werden frisch je Aufruf:

- „Keine KI“ = administrative KI-Abschaltung (`kiAbschaltung`),
- öffentliche KI = `kiFreigabe.oeffentlicheKi`, Vertrauliches = `vertraulicheAusleitungFreigegeben`,
- erlaubte Anbieter = die beiden externen Anbieter des Reasoners, die P04 nennt (`anthropic`, `openai`),
- dokumentbezogene Freigabe = je Auftrag und Quelle ausdrücklich erteilt; zurückgenommen = geschlossen.

## Fähigkeiten

| Fähigkeit | Weg | gilt als verbunden, wenn |
|---|---|---|
| `prompt_manuell` | Nutzer überträgt den geprüften Prompt und gibt das Ergebnis zurück | immer (außer „Keine KI“, fehlende Freigabe, Anbieter nicht erlaubt) |
| `api` | `assistText` des Reasoners im Bindungsrahmen (`bindeAnbieter`): nur der gewählte Anbieter, kein Ausweichweg | Anbieter eingerichtet **und** reale Probe (`POST /api/me/klara/ki-verbindung/:anbieter/pruefen`, `users.manage`) oder realer Lauf in diesem Prozess; wirksame Zuordnung der Aufgabe `assist` = gewählter Anbieter |
| `codex_auftrag` | Prompt an Codex (manuell), Ergebnisdateien zurück → `wendeCodexAenderungenAn` | synthetischer Arbeitsbereich beschreibbar (Temp-Ordner, je Auftrag ein Unterordner) |
| `browser_begleitung` | — | kein Adapter vorhanden: „nicht eingerichtet“ |

MCP-Status bedeutet nur „Klara-Wissen als Werkzeug verfügbar“; fremde Chats werden nicht gesteuert.

Codex: geschrieben wird nur Anlegen/Ändern unter `src`, `tests`, `docs` im eigenen Ordner des
Auftrags, nach `realpath`-Prüfung (kein Symlink-Ausbruch). Löschen, Deployment, Shell,
Installation und jede andere Aktion werden abgelehnt und nicht ausgeführt.

## Belege

`promptentwurf`, `manuelle_uebergabe`, `simulation`, `realer_adapterlauf` bleiben getrennt.
`realer_adapterlauf` nur mit geprüftem Adapter, eindeutig zugeordnetem Eintrag im
Modelllauf-Protokoll (Laufkennung) und vom Anbieter gemeldetem Verbrauch. Ist der Lauf nicht
eindeutig zuzuordnen, wird kein Beleg geraten.

## Offene Grenzen

- **Realer Anbieterlauf (AC10):** Der Weg ist angeschlossen, aber in dieser Lieferung nicht real
  ausgeführt. Dazu braucht es eine Instanz mit eingerichtetem Anbieter, erteilter Freigabe und
  einem ausdrücklich beauftragten Lauf. Ob dafür Zugang oder Budget fehlt, ist hier nicht
  festgestellt.
- **Codex selbst** wird nicht automatisch gestartet. Der Prompt geht manuell an Codex; Klarwerk
  setzt die zurückgegebenen Dateien begrenzt um.
- **Browserbegleitung:** kein Adapter, ehrlich „nicht eingerichtet“.
- **Word-Add-in:** nicht angeschlossen. Die Oberfläche ist das Klara-Gespräch der Web-App.
- Unabhängige Prüfung, Installation, Veröffentlichung und Gesamtabnahme sind getrennte Schritte.

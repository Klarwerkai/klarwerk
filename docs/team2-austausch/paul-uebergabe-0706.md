# Übergabe an den Boss — Stand 06.07.2026 (Paul/Pedi-Session)

Kurzfassung der heutigen Punkte, die der Boss kennen sollte. Details in den jeweiligen Tickets.

## 1) Launcher-Wechsel: kaputte .app → .command-Skripte  (SCRUM-462)
Die iCloud-/Desktop-`.app`-Launcher haben die macOS-Automation-Berechtigung verloren und
blockierten das Terminal. **Kein Code-Problem.** Täglicher Ablauf läuft jetzt stabil über
`.command`-Skripte im Repo (per `bash <Pfad>`). Pedi hat den Befehls-Spickzettel
(`docs/team2-austausch/BEFEHLE-SPICKZETTEL.md`) und räumt die alten Apps selbst weg.

## 2) Laufender Versionszähler (neu, intern)
`APP_VERSION` hat jetzt das Format `1.0.0-beta.<Freeze>.<Push-Zähler>`. Das Ship-Skript
(`klarwerk-ship.command`) erhöht die **letzte** Zahl bei jedem echten Push automatisch.
Damit sieht man an der Topbar (live **und** lokal) sofort, ob beide auf demselben Stand sind.
Basis steht auf `1.0.0-beta.1.0`; der nächste Ship-Lauf ergibt `…1.1`.

## 3) Datenbank / Login-Vorfall (geklärt, kein Datenverlust)
Der „komme nicht mehr rein"-Vorfall war **operativ** (Login-Sperre nach vielen Fehlversuchen:
5/15 Min), **nicht** die DB. Daten waren nie weg. Die App läuft weiter stabil auf der
bestehenden Postgres. Aufräumen der überzähligen DB-Instanzen + `APP_BASE_URL`-Altlast:
**SCRUM-461** (niedrige Prio, nach dem VIP).

## 4) Betriebssicherheit: Storage-Guard ist live
Neu: In Produktion bricht der Start bewusst ab, falls keine dauerhafte Datenhaltung gesetzt
ist — verhindert die „still In-Memory → Daten weg"-Fehlerklasse künftig.

## 5) Offen / als Nächstes
- **Ship ausstehend:** Commit `11573de` (Storage-Guard + 8 Fixes: Bild-Finder, Studio-Ausgang,
  Formatierung, Sprach-Toggle, Admin-PW-Wiederholung, Resume, KI-Pille) geht mit dem nächsten
  `klarwerk-ship.command`-Lauf live (dann v1.0.0-beta.1.1).
- **Tester-Account** als „Experte" anlegen, sobald der Ship durch ist.
- **SSH-Deploy-Key rotieren:** Während der Coolify-Token-Einrichtung war ein privater
  Deploy-Key im Chat sichtbar → neuen Key in Coolify + GitHub setzen, alten entfernen.
- **Boss-Themen (warten auf dich):** Vordertür/„Word-Weg" (Erfassung vereinfachen), W2
  Ganz-Dokument-Import als bewusster Toggle (Default-Analyse ↔ ganzes Dokument),
  Suche → Antwort + Quelle. Konzepte liegen vor.

## Ticket-Übersicht heute
- SCRUM-461 — Coolify aufräumen (überzählige Postgres + APP_BASE_URL)
- SCRUM-462 — kaputte .app-Launcher ersetzen/entfernen

# `produkt:20261007:veroeffentlichungsoptionen:admin-20261009` (ADMIN-12) — Benachrichtigungsregeln und Veröffentlichungswirkung

Basis `a2ec8873` (`1.0.0-beta.1.877`). Lauf 1. Die Tests in diesem Ordner hat dieser Lauf nur
geschrieben, nicht ausgeführt (keine Testausführung erlaubt). Ausgeführt werden sie im Prüflauf
(`CLAUDE/PRUEFPLAN.json`).

## Bestandsabgleich vor dem Bau

| Teil des Umfangs | Stand an der Basis | Hier |
| --- | --- | --- |
| Veröffentlichen mit still/normal/hervorgehoben, Vorschau, Zustellungen je Empfänger | geliefert (`produkt:20261007:veroeffentlichungsoptionen`, `tests/veroeffentlichungsoptionen/`) | wiederverwendet; Vorschau um die Regelwirkung je Wahl ergänzt |
| Glocke mit Gelesenstatus | geliefert (`aufnahme:20260922:gesamt-benachrichtigungen`) | wiederverwendet; „gelesen" wird daraus gelesen |
| Verbindliche Kenntnisnahme samt Erinnerung | geliefert (`tests/kenntnisnahme/`) | unverändert; „bestätigt" wird daraus gelesen |
| Mailversand | nur Kontotexte und Prüfzuweisung, SMTP nur wenn eingerichtet | Veröffentlichungsmail nur bei eingerichtetem SMTP UND Vorgabe |
| Zentrale Regel nach Ereignis, Empfänger, Kanal | **fehlte** (Verwaltungsgruppe „Kommunikation" ohne Bedienort) | **gebaut** |

## Was gebaut ist

* **Server** `services/app/src/kommunikationsregeln.ts`: geschlossener Ereigniskatalog (aus den
  vorhandenen Glockenarten abgeleitet) mit Zielgruppe, Kanälen, Häufigkeit, Abwahl und
  Verbindlichkeit; Unternehmensvorgabe als Fassungen (Version als Primärschlüssel →
  gleichzeitige Änderungen gewinnen nie beide); persönliche Abwahl; tägliche Zusammenfassung in
  der Glocke; Zustellstatus je Veröffentlichung, Empfänger und Kanal; Mailversand mit atomarer
  Beanspruchung (keine doppelte Mail) und Rechteprüfung zum Versandzeitpunkt. Ablage im Speicher
  oder Postgres (`KOMMUNIKATION_SCHEMA`, drei Tabellen, additiv).
* **Türen** `routes/kommunikation-routes.ts`: Übersicht und eigene Einstellungen für jedes
  angemeldete Konto; Vorgaben ändern und Fassungen lesen nur mit `users.manage`. Prüfprotokoll:
  `kommunikationsregeln.geaendert`, `meldungsregel.persoenlich`. Am Veröffentlichungsweg zwei
  weitere Türen (`ko.validate` + `darfSehen`): Zustellstatus und Wiederaufnahme. Alle sieben in
  die drei Sicherheitsinventare eingetragen.
* **Fläche** `/kommunikation` (`pages/Kommunikation.tsx`): Übersicht, Wirkungserklärung, eigene
  Einstellungen, für die Verwaltung Vorgaben samt Protokoll. Erreichbar über das Profil und die
  Verwaltungsübersicht (Gruppe „Kommunikation"). Am Eintrag (`VeroeffentlichungBereich`) die
  Regelwirkung je Wahl und der aufklappbare Zustellstatus je Verlaufszeile. Texte DE/EN/NL.

## Kriterien → Tests

| Kriterium | Server (`regeln-am-server.test.ts`) | PG (`kommunikation-pg.integration.test.ts`) | Fläche (`seite-mounted.test.tsx`) | Browser (`tests-smoke/kommunikation-browser.spec.ts`) |
| --- | --- | --- | --- | --- |
| K1 Ereignis → Zielgruppe, Kanäle, Häufigkeit; Abwahl und Kenntnisnahme erklärt | K1 (2) | P2 | S1, S2, S5 | beide Fälle |
| K2 Vorschau je Wahl; Sichtbarkeit/Freigabe unabhängig | K2 | — | — | Fall 1 (Regelwirkung) |
| K3 still ≠ Kenntnisnahme aus; hervorheben ohne Rechte | K3 (2) | — | — | — |
| K4 nur angeschlossene Kanäle; Status angelegt/zugestellt/fehlgeschlagen/gelesen/bestätigt | K4 (2) | P3 | S3 | Fall 1 (zugestellt → gelesen) |
| K5 keine Doppelten; Zusammenfassung nach Rechten und Regeln | K5 (3) | P3, P4 | — | — |
| K6 gilt nach Reload, protokolliert, nur Verwaltung | K6 (2) | P1, P5 | S3, S4 | Fall 1 |

## Grenzen

* **Nicht ausgeführt** in diesem Lauf. Nachgeführte Sollwerte sind **gerechnet**, nicht gemessen:
  Komponentenzahl in `tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx` (606 → 612) und das
  Smoke-Mengenmanifest (`chromium-zustand` 24 → 26, Version 31).
* **Mail nur im Testkanal belegt**: Der Servertest ersetzt den Mailer durch ein `Testpostfach`
  (nimmt an oder lehnt eine fiktive Adresse ab). Ein echter SMTP-Versand an ein kontrolliertes
  Testpostfach ist nicht gelaufen. „Zugestellt" bei Mail heisst: vom Mailserver angenommen — mehr
  kann ein Mailserver nicht belegen.
* **Push** gibt es im Produkt nicht; er steht überall als „nicht angeschlossen".
* **Zusammenfassung** nur in der Glocke (keine Sammelmail); Tagesgrenze ist UTC. Sie wird beim
  Abruf zusammengestellt — die Rechte gelten zum Abruf (= Auslieferung).
* **Wiederaufnahme** ist eine ausdrückliche Tür (Knopf „Versand fortsetzen"), kein automatischer
  Lauf beim Neustart. Eine Mail, deren Versand begonnen, aber nie quittiert wurde (Abbruch mitten
  im Senden), bleibt „angelegt" und wird nie ein zweites Mal geschickt (lieber keine als doppelt).
  Die Unterbrechung ist im Servertest **simuliert** (Zeilen ohne Versand angelegt).
* Veröffentlichungen **vor** ADMIN-12 haben keinen Zustellstatus (die Fläche sagt das).
* Keine echte Nutzerbeobachtung, ob die Erklärungen verstanden werden.

## Nacharbeit 1 (Kandidat `dee18326`)

* Zustellstatus las beim Wiederaufklappen den 30-s-Zwischenspeicher und blieb nach dem Lesen auf
  „zugestellt" stehen — jetzt frische Abfrage je Aufklappen. Gegenprobe:
  `zustellstatus-mounted.test.tsx` (Betriebswerte des Zwischenspeichers).
* `seite-mounted.test.tsx` S2 wartet auf die zweite Abfrage der eigenen Einstellungen.
* Komponenten-Pin `mega84`: gemessen 637 (statt gerechnet 612).
* Rote Inventarfälle mit ausschließlich fremden Basisbeständen sind nicht Teil dieses Auftrags und
  nicht angefasst.

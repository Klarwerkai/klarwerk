# `produkt:20261007:veroeffentlichungsoptionen` — Entwurf und Veröffentlichung mit Benachrichtigungswahl

Basis `4b4408f4` (`1.0.0-beta.1.743`). Lauf 1. Die Tests in diesem Ordner hat dieser Lauf nur
geschrieben, nicht ausgeführt. Ausgeführt werden sie im Prüflauf (`CLAUDE/PRUEFPLAN.json`).

## Bestandsabgleich vor dem Bau

| Teil des Umfangs | Stand an der Basis | Hier |
| --- | --- | --- |
| Entwurf sichern, privat und fortsetzbar | geliefert (`aufnahme:20260922:gesamt-entwurf-einreichen`, `tests/entwurf-einreichen/`) | unverändert, nicht neu abgenommen |
| Zur Prüfung einreichen → Objekt `offen`, Prüferzuweisung samt Mail | geliefert (dieselbe Aufnahme, `POST /api/drafts/:id/promote`) | unverändert |
| Fachliche Freigabe (`validiert`) | Prüfweg der Validierung | unverändert; ist jetzt Voraussetzung für das Veröffentlichen |
| Kenntnisnahme einer gültigen Fassung samt Glockenmeldung | geliefert (`tests/kenntnisnahme/`) | unverändert; wird an der Wahl genannt |
| Hinweisfläche/Gelesenstatus | eigener offener Auftrag `aufnahme:20260922:gesamt-benachrichtigungen` | nicht gebaut; der vorhandene Meldungsweg (Glocke) wird genutzt |
| **Veröffentlichen mit Wahl still/normal/hervorgehoben und erklärter Wirkung** | **fehlte** | **gebaut** |

## Was gebaut ist

* **Vermerk am Wissensobjekt** — `KnowledgeObject.veroeffentlichungen` (optional, JSONB, keine
  Migration): Fassung, `neu`/`aktualisierung`, Meldungswahl, Person, Zeitpunkt, **Anzahl** der
  Benachrichtigten. Keine Kennungen der Kollegen am Objekt. Geschrieben nur über
  `KoService.vermerkeVeroeffentlichung` unter dem KO-Lock, zusammen mit dem Prüfprotokolleintrag
  `ko.veroeffentlicht`. Status, Fassung, Verlauf und Einstufung bleiben unberührt.
* **Dienst** `services/app/src/veroeffentlichung.ts`: Stand (alle Leser), Vorschau (nur
  `ko.validate`) mit Zustand, Sichtbarkeit (Stufe, Space, Leserzahl), Empfängerliste und
  Kenntnisnahmelage; Veröffentlichen nur für eine gültige, aktuelle, noch nicht veröffentlichte
  Fassung. Der Leserkreis ist **derselbe** wie der Empfängerkreis einer Kenntnisnahme
  (`KenntnisnahmeDienst.moeglicheEmpfaenger`) — keine zweite Rechteregel.
* **Türen** `GET|POST /api/kos/:id/veroeffentlichung` (`ko.read` bzw. vorhandenes `ko.validate`,
  beide mit `darfSehen` → sonst 404). In die drei Sicherheitsinventare eingetragen.
* **Glocke** (vorhandener Weg): Art `veroeffentlichung`. `still` erzeugt nie eine Meldung; `normal`
  meldet jedem, der den Eintrag lesen darf und zum Zeitpunkt schon ein Konto hatte (ohne die
  veröffentlichende Person); `hervorgehoben` hat denselben Kreis, ist markiert und steht oben, bis
  sie gelesen ist. Die Sichtbarkeit wird beim Lesen erneut über `sichtbareEintraege` geprüft.
* **Fläche** `VeroeffentlichungBereich` an der Lesefläche (`BibliothekLesen`): Stand und Verlauf für
  alle; für Freigebende die Wahl ohne Vorauswahl, die Wirkung erscheint sofort bei der Wahl.
  Texte DE/EN/NL im Textmodul `texte/veroeffentlichung.ts`.

## Kriterien → Tests

| Kriterium | Server (`veroeffentlichung-am-server.test.ts`) | Fläche (`veroeffentlichung-flaeche.test.tsx`) |
| --- | --- | --- |
| K1 Zustand, Sichtbarkeit, Empfänger erklärt | K1 (4 Fälle) | F1, F4 |
| K2 still: keine Meldung, auffindbar, Historie | K2 (3 Fälle) | F1 (Verlaufszeile) |
| K3 normal/hervorgehoben wie erklärt, keine Rechteerweiterung | K3 (5 Fälle) | F1 |
| K4 Entwurf ≠ veröffentlicht; Rechte und Prüfregeln | K4 (5 Fälle) | F2 |
| K5 Kenntnisnahme durch still nicht unbemerkt aus | K5 (2 Fälle) | F3 |
| K6 neu und Aktualisierung getrennt, passende Rollen | K6 (Controllerin neu, Experte gesperrt, Admin Aktualisierung) | — |

Bedienbeleg im echten Browser: `tests-smoke/veroeffentlichung-browser.spec.ts` (K1, K3, K4) — Wahl
und Wirkung als Admin, dann eine neu angelegte Leserin mit der hervorgehobenen Meldung oben in der
Glocke und derselben veröffentlichten Fassung auf der Lesefläche; fünf Bildschirmfotos als Anhänge.
Die Sonde legt Bestand an und läuft deshalb nur im isolierten Projekt `chromium-zustand`
(`playwright.smoke.config.ts`, `ZUSTAND_SPEC`); `tests/smoke/smoke-mengen-manifest.json` ist um
diesen einen Fall nachgeführt (Version 14).

## Grenzen

* Nicht ausgeführt in diesem Lauf (keine Testausführung erlaubt). `tests/app/mega84-…-sammler`:
  Sollzahl 451 → 452 ist **gerechnet** (ein neues Bauteil), nicht gemessen; ebenso der
  Manifestnachtrag. Die vorgefundene fremde Manifestdrift (u. a. `spaces-browser.spec.ts`,
  `firmenwoerterbuch-browser.spec.ts`, `bildschirmablauf-browser.spec.ts` fehlen) ist unverändert.
* Kein eigener PostgreSQL-Test: der Vermerk liegt im vorhandenen JSONB des Objekts und der Beleg im
  vorhandenen Prüfprotokoll; beide Ablagen sind unverändert.
* Keine E-Mail bei Veröffentlichung — der Auftrag nennt den vorhandenen Meldungsweg; das ist die
  Glocke. Die Prüfer-Mail beim Einreichen ist unverändert.
* Nacharbeit 8 (Ben): Der angekündigte Empfängerkreis steht je Empfänger in der eigenen Tabelle
  `veroeffentlichung_zustellungen` (nicht am lesbaren Objekt). Die Glocke liefert nur dorthin
  zugestellte Meldungen, solange der Eintrag sichtbar ist; spätere Rechteerteilung öffnet keine alte
  Meldung. Hervorgehobene Zustellungen werden immer geliefert, gewöhnliche die jüngsten 100 je Konto
  (`VEROEFFENTLICHUNG_MELDUNGEN_FENSTER`); stille erzeugen keine Zustellung.
* Keine echte Nutzerbeobachtung, ob die Erklärung verstanden wird.
* Nachtrag ADMIN-12 (`produkt:20261007:veroeffentlichungsoptionen:admin-20261009`): persönliche
  Abwahl, tägliche Zusammenfassung, Mail bei eingerichtetem SMTP und Zustellstatus bauen auf
  diesem Weg auf — siehe `tests/kommunikationsregeln/README.md`. Die Aussage „Keine E-Mail bei
  Veröffentlichung" oben gilt für die Werksvorgabe weiter.

# Quellenänderungen in einer Arbeitsanleitung erkennen, prüfen und bewusst übernehmen

Auftrag: `aufnahme:20260928:quellenaenderungen-bewusst-uebernehmen` (Revision 3).
Ausgangsstand des Repositorys: `3b79c5d1` (Branch `codex/auftrag-92aa62869ce8e538615a`).

Diese Datei belegt Kriterium 1: den Abgleich mit `gesamt-wissen-frische` und mit der vorhandenen
Fassungsbindung, bevor etwas ergänzt wurde.

## 1. Abgleich mit `gesamt-wissen-frische`

Im Repository gibt es am Ausgangsstand `3b79c5d1` **keinen** Code, kein Dokument und keinen Test
mit dem Namen `gesamt-wissen-frische`. Gesucht wurde ohne Beachtung der Groß- und Kleinschreibung
nach `gesamt-wissen-frische`, `wissen-frische`, `wissensfrische` und `frische-logik`. Es gab null
Treffer. Eine Frischelogik unter diesem Namen lässt sich hier also weder übernehmen noch umgehen.

Für Arbeitsanleitungen gibt es genau eine Frischeregel, und sie bleibt die einzige:

- `lesestand()` in `services/knowledge-object/src/gesamtanweisung-service.ts` setzt
  `aktualisierungsvorschlag`, wenn `aktuelleVersion > koVersion` gilt (Startvertrag: „Neuere
  Fassung bedeutet Aktualisierungsvorschlag“).
- Die neue Änderungsprüfung (`aenderungspruefungAus`) zählt **genau diese Vorschläge**. Sie
  vergleicht keine Versionen selbst und hat keinen eigenen Zeitgeber. Es gibt also keine zweite
  Frischelogik.
- Nicht verwendet werden die Frischeregeln anderer Bereiche (`tests/kopfzaehler-frische`,
  Abfrage-`staleTime`, `scripts/dist-frische.ts`). Sie betreffen Zähler, Zwischenspeicher und
  Auslieferung, nicht Quellenfassungen.

**Offen für Ben und Pedi:** Falls `gesamt-wissen-frische` ein Auftrag oder Zweig außerhalb dieses
Repositorys ist, muss der Abgleich dort nachgeholt werden. Am Stand `3b79c5d1` lässt er sich nicht
belegen.

## 2. Was am Ausgangsstand bereits erfüllt war (Fassung `3b79c5d1`)

| Kriterium | Bereits erfüllt | Beleg am Ausgangsstand |
|---|---|---|
| K2: neuere Fassung am Abschnitt mit verwendeter und neuerer Fassung | ja, auf Dienst- und Anzeigeebene | `tests/wiki-gesamtanweisung/f2-keine-stille-ersetzung.test.ts` („die neuere Fassung erscheint als VORSCHLAG daneben, nicht als Ersetzung“); `tests/wiki-gesamtanweisung-fassungsbindung/neustart-und-bindung.test.ts` („der Aktualisierungsvorschlag steht DANEBEN …“) |
| K4, Teil „keine automatische Inhaltsänderung“ | ja | `f2-…` („die Bindung im BESTAND ist durch das Lesen nicht gewandert“) |
| K4, Teil „frühere Stände bleiben erhalten“ | ja (Prüfstände je Version, atomar) | `tests/wiki-gesamtanweisung/atomare-speicherung.test.ts`, `tests/wiki-gesamtanweisung/postgres-atomar.integration.test.ts` |
| K5: verwendete Fassung bleibt erkennbar | ja, als „Gebundene Fassung N“ | `tests/wiki-gesamtanweisung-fassungsbindung/lesestand-ansicht.test.tsx` |
| K6, Teil Kontoregel | ja: Einreichen mit `ko.create`, Entscheiden nur mit `ko.validate` | `tests/wiki-gesamtanweisung/f8-plugin-registrierung.test.ts`, `tests/wiki-gesamtanweisung-abnahme/a2-jede-neue-tuer-steht-in-der-tabelle.test.ts` |

## 3. Was fehlte und ergänzt wurde

- **K3/K4: bewusste Übernahme.** Bisher konnte eine neuere Fassung nur als zusätzlicher Abschnitt
  aufgenommen werden (`neustart-und-bindung.test.ts`, dritter Fall). Neu ist
  `GesamtanweisungDienst.fassungUebernehmen` mit der reinen Regel `mitUebernommenerFassung` und der
  Tür `POST /api/gesamtanweisungen/:id/bausteine/:bausteinId/uebernehmen` (`ko.create`). Sie bindet
  genau einen Abschnitt neu, erzeugt einen neuen Anleitungsstand und hält ihn als Prüfstand fest.
- **K6: keine Übertragung einer früheren Entscheidung.** Eine Übernahme setzt den Stand auf
  `entwurf`, auch wenn die Anleitung vorher entschieden war. Danach gilt wieder die bestehende
  Kontoregel: Vorlegen mit `ko.create`, Entscheiden mit `ko.validate`. Andere Änderungen an einer
  entschiedenen Anleitung bleiben gesperrt (`nurAenderbar`).
- **K3: Unterschiede ansehen und Beibehalten.** Die Gegenüberstellung nutzt die vorhandene
  `paarDiff` aus `apps/web/src/lib/koVersionDiff.ts`, also dieselbe Regel wie die Fassungskarte der
  Bibliothek. „Bisherige Fassung beibehalten“ schreibt nichts, denn die gebundene Fassung ist schon
  die bisherige. Die gefundene Änderung bleibt als solche sichtbar.
- **K7: Änderungsprüfung.** Der Lesestand trägt jetzt `aenderungspruefung` mit `pruefzeitpunkt`,
  `ergebnis`, `gefundeneAenderungen`, `fehlgeschlageneQuellen` und `ueberwachung`, außerdem
  `uebernommeneAenderungen`. Die übernommenen Änderungen werden aus aufeinanderfolgenden Prüfständen
  abgelesen. Es gibt dafür kein zweites Protokoll und keine neue Tabelle. Ein Lesefehler ergibt
  `fehlgeschlagen`, ein verborgener Abschnitt `unvollstaendig`; beides wird nie zu `aktuell`. In der
  Oberfläche wird ein früheres `aktuell` nach gescheiterter Auffrischung oder ohne Verbindung als
  „nicht gesichert“ gezeigt.
- **K8: Momentaufnahme.** Belegstellen mit bestätigter Anhangskennung (`KoSource.objectId`) der
  gebundenen Fassung erscheinen als „Hochgeladene Datei … Momentaufnahme vom …“. Der Server meldet
  `ueberwachung: "nicht_eingerichtet"`, und die Oberfläche sagt das so. Eine aktive Überwachung wird
  nirgends angezeigt, weil keine eingerichtet ist.

## 4. Grenzen

- Geprüft wird beim Öffnen der Anleitung. Eine automatische, zeitgesteuerte Prüfung gibt es nicht.
- „Beibehalten“ wird nicht als eigene Entscheidung gespeichert. Der Vorschlag bleibt sichtbar, bis
  jemand übernimmt.
- Eine Übernahme trägt keinen Nachweis-Hash weiter (`nachweisHash: null`). Der alte Hash belegt eine
  andere Fassung.
- Als „hochgeladene Datei“ gilt eine Belegstelle mit bestätigtem Anhang. Andere Uploadwege, etwa ein
  Wissenseintrag, der direkt aus einem Dokument erfasst wurde und keine solche Belegstelle hat,
  werden nicht als Momentaufnahme gekennzeichnet.
- Ältere, weitergehende Kriterien aus `aufnahme:20260922:wiki-gesamtweg` (Word-/Hostweg,
  sechsstufige Gesamtsitzung) sind mit dieser Lieferung **nicht** erfüllt und werden hier auch
  nicht abgenommen.

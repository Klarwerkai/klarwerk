# Freigaberegeln und Prüfzuständigkeiten je Space (ADMIN-09)

*Auftrag `produkt:20261009:admin-freigaberegeln`. Fläche: Space-Detailseite › „Freigaberegel und
Prüfzuständigkeit" (`apps/web/src/components/SpaceFreigaberegel.tsx`). Server:
`services/app/src/freigaberegeln.ts` (reine Regeln), `services/app/src/freigaberegel-dienst.ts`
(Anwendung), `services/app/src/routes/freigaberegeln-routes.ts` (Routen).*

## Was gebaut ist

Eine Freigaberegel ist Teil der versionierten Space-Fassung (`SpaceFassung.freigabe`, neuer
Vorgang `freigaberegel` im Space-Verlauf). Sie nennt:

| Einstellung | Zulässig | Wirkung |
| --- | --- | --- |
| Erforderliche Zustimmungen | 1–5 (bestehendes Band, FR-CAP-08) | Mindestzahl grüner Stimmen der aktuellen Fassung, keine Ablehnung (`computeOutcome` unverändert) |
| Prüfer (Konten) und Prüferteams | bestehende Konten, aktive Teams | Prüferkreis; leer = alle mit `ko.validate` und Zugang zum Space |
| Frist | leer oder 1–90 Tage ab Zuweisung | überfällige Prüfaufgabe → Vertretung im Fristlauf |
| Vertretungen | bestehende Konten, niemand vertritt sich selbst | greift, wenn die Aufgabe übergeben ist oder die vertretene Person nicht aktiv ist |

Nicht einstellbar, weil bestehende Fachregel: **Selbstprüfung ist ausgeschlossen** (Autor oder
Erstautor; Hilfe `faq.pruefen.3`/`faq.pruefen.8`), auch für Administratoren.

## Serverseitiger Prüfpunkt

`FreigabeRegelDienst.tor` läuft vor `rate`, `owner-validate` und `admin-validate`
(`PUT /api/kos/:id`), nur wenn der führende Space eine Regel trägt:

1. Eigener Beitrag → 403 `SELBSTPRUEFUNG` (auch am Ausnahmeweg `admin-validate`).
2. Zustimmung ohne geprüfte Fassung (`expectedVersion`) → 400 `FASSUNG_FEHLT`; abweichende
   Fassung → 409 `KO_STALE` mit `currentVersion`. Der Validierungsdienst prüft dieselbe Fassung
   noch einmal (`ValidationService.rate`/`adminValidate`/`ownerValidate`, `erwarteteFassung`).
3. Nicht im Prüferkreis (oder nur Vertretung, die noch nicht greift) → 403 `NICHT_PRUEFBERECHTIGT`.
4. Laufender Vorgang mit niedrigerer Anforderung → `KoService.raiseNeededValidations` hebt an
   (Beleg `ko.needed-validations-raised`).

`expectedVersion` ist an `rate`, `owner-validate` und `admin-validate` jetzt überall erlaubt; ohne
Regel bindet es die Entscheidung, Pflicht ist es nur in Spaces mit Regel.

## Regeländerung

`POST …/freigaberegel/vorschau` zeigt alte und neue Regel, die Wirkung je laufendem Vorgang
(bisher/danach/vorhandene Zustimmungen), die Zahl erteilter Freigaben, neu und nicht mehr
berechtigte Prüfer samt offener Aufgaben und die danach fehlenden Voraussetzungen.
`PUT …/freigaberegel` übernimmt nur mit der `grundlage` dieser Vorschau (sonst 409
`VORSCHAU_VERALTET` mit neuer Vorschau) und nur durch die Kontoverwaltung (`users.manage`).

Wirkung, ausdrücklich: laufende Vorgänge (`offen`) brauchen mindestens die neue Zahl — nur nach
oben, mit Beleg je Vorgang. Erteilte Freigaben (`validiert`) bleiben unverändert; nichts wird
neu berechnet. Eine niedrigere Regel senkt keine schon gestempelte Anforderung. Belege:
`space.freigaberegel-geaendert` (alt, neu, Änderungen, Wirkung).

## Zustand eines Vorgangs

Abgeleitet aus vorhandenen Feldern (`vorgangszustand`): `eingereicht` (offen), `korrektur_noetig`
(Rückfrage/Ablehnung zur aktuellen Fassung), `freigegeben` (`validiert`), `veroeffentlicht`
(aktuelle Fassung ist die zuletzt veröffentlichte). `entwurf` wird nie aus einem Wissensobjekt
abgeleitet — ein Entwurf gehört noch keinem Space. Eine einzelne Zustimmung heisst immer
„x von y — noch nicht freigegeben".

## Entscheidungen, Ausnahmen, Fristlauf

- Entscheidungen je Vorgang aus dem Prüfprotokoll (`ko.rated`, `ko.admin-validated`,
  `ko.owner-validated`): Person, Zeitpunkt, geprüfte Fassung, ob sie zur aktuellen Fassung gehört.
- Ausnahmewege (bestehend): Admin-Kennzeichnung und Eigentümerfreigabe. In einem Regel-Space
  schreiben sie zusätzlich `freigaberegel.ausnahme` (Weg, Fassung, Regelfassung, vorhandene und
  erforderliche Zustimmungen, unabhängige Prüfer). Die direkte Freigabe beim Überarbeiten
  (`revise-release`, Entscheidung Pedi 11.09.) bleibt unverändert und erscheint als
  Admin-Kennzeichnung.
- `POST …/freigaberegel/fristlauf` (Spacezuständige oder Kontoverwaltung): je offener Prüfaufgabe,
  die überfällig ist oder einer nicht aktiven Person gehört, eine Vertretungsaufgabe
  (`ValidationService.vertretungZuweisen`, `quelle: "vertretung"`). Wiederholt: keine zweite
  Aufgabe, keine zweite Meldung, kein zweiter Beleg (`freigaberegel.fristlauf` nur bei Neuem).

## Grenzen

- Kein Zeitplaner: der Fristlauf wird ausgelöst (Knopf/Route), nicht automatisch.
- Fällig ab dem Zuweisungsbeleg (`ko.assigned`) bzw. `Assignment.seit`; ohne beides ab
  Objektanlage.
- Die Detailseite eines Beitrags zeigt die gestempelte Anforderung; wurde ein freigegebener Beitrag
  später überarbeitet, hebt erst die nächste Entscheidung oder ein Fristlauf sie an. Das Prüfbrett
  zeigt immer die wirksame Zahl.
- Der Prüfpunkt gilt für die Peer-Wege; der offene Peer-Gesamtvertrag
  (`aufnahme:20260922:gesamt-peer-validierung`) ist nicht ersetzt. Ausserhalb von Regel-Spaces
  bleibt die Bewertung wie bisher (keine serverseitige Selbstprüfungssperre am Bewertungsweg).

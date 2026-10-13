# Lagebild · Beispielwerte kennzeichnen, reale Werte erfassen

Auftrag `produkt:20261013:lagebild-reale-werte-eingabe` (Peter, 13.10.2026, Nr. 13: „verwende
beispielwerte, wir brauchen dort eine eingabemoeglichkeit der echten werte durch die anwender /
admin"). Verknüpfte Originale: `aufnahme:20260922:gesamt-management-lagebild`,
`produkt:20261011:peter-p13` — deren offene Kriterien bleiben dort offen.

## Was gebaut ist

| Teil | Ort |
|---|---|
| Kennzeichnung der Beispielrechnung („Beispiel (geschätzt)“, nicht gespeichert, kein Unternehmenskapital) | `pages/Stufe2.tsx`, Abschnitt `mgmt.valuation` |
| Karte „Reale Werte für die Wissensbewertung“ (Anzeige, Rechnung, Eingabe) | `components/LagebildWerte.tsx` |
| Erreichbar für die Verwaltung | `/kapital` (Stufe 2), Bereichswahl „Ganzes Unternehmen“ und jeder lesbare Space |
| Erreichbar für Anwender | `/spaces/:id`, Knopf „Lagebild-Werte dieses Arbeitsbereichs“ |
| Rechnung und Gründe ohne Geldwert | `lib/lagebildRechnung.ts` (ruft die bestehende `estimateValuation`) |
| Ablage | `services/management/src/lagebild-werte.ts`, Tabelle `management_lagebild_werte` in derselben Management-Ablage wie Bereichsprofile (`profiles.ts`) |
| Türen | `GET /api/management/lagebild-werte`, `PUT /api/management/lagebild-werte/:bereich` |

Keine zweite Kennzahlen- oder Kapitalverwaltung: gespeichert werden nur die drei Eingänge der
vorhandenen Formel (Stundensatz, gesparte Stunden je validiertem Objekt, Wiederverwendung). Die
Fakten (validierte Objekte, Ø-Vertrauen) sind dieselbe Rechnung wie `valuationFacts` des Snapshots,
über dem sichtbaren Bestand des Bereichs.

## Regeln

- **Bereich** ist `gesamt` (eine Firma je Instanz) oder ein Space. Gelesen wird `gesamt` von jeder
  lesenden Rolle, ein Space nur mit Leserecht an seinen Inhalten (kein Admin-Durchgriff).
  Geschrieben wird `gesamt` nur mit `users.manage`, ein Space nur mit Schreibrecht darin und
  `ko.create`; ein archivierter Space ist nicht pflegbar. Die Bereiche werden je Anfrage frisch aus
  der Space-Ablage abgeleitet. Ein unlesbarer Bereich antwortet wie ein unbekannter (404) und steht
  in keiner Antwort.
- **Herkunft je Wert:** „eigene Eingabe (Annahme)“ oder „gemessen (laut Angabe)“ mit Pflicht-Beleg.
  Ein gemessener Zeitraum darf nicht in der Zukunft liegen. Auch eine angegebene Messung ist nicht
  unabhängig geprüft; die Fläche sagt das an jedem Ergebnis.
- **Kein erfundener Geldwert:** fehlt ein Wert oder gibt es im Bereich keine validierten Objekte,
  steht kein Betrag da, sondern die Gründe. Leere Felder werden nie mit Beispielwerten ergänzt; das
  Formular startet ohne gespeicherten Stand leer. Negative gesparte Stunden (Zusatzaufwand) bleiben
  als negative Entlastung in der Rechnung. Der Qualitätsfaktor (Ø-Vertrauen) bleibt.
- **Schreiben:** jede Eingabe trägt `basisVersion` und `anfrageId`. Weicht der Stand ab, wird nichts
  geschrieben (409 mit aktuellem Stand; die Eingabe bleibt im Formular, Übernehmen oder bewusstes
  Überschreiben per Klick). Dieselbe `anfrageId` ein zweites Mal liefert den gespeicherten Stand
  (`wiederholt: true`) statt einer zweiten Anlage. Netz- oder Serverfehler nennt die Fläche
  „Ausgang unbekannt“; „Erneut senden“ schickt dieselbe Kennung. Das bedingte Schreiben ist in
  PostgreSQL eine einzige Anweisung (`INSERT … ON CONFLICT DO NOTHING` bzw. `UPDATE … WHERE version`).

## Grenzen

- Ein zweiter Mandant ist in einer Instanz nicht aufbaubar; die Instanzgrenze belegt
  `tests/mandanten-isolation`, die Bereichsgrenze die neuen Tests.
- Die Selbstauskunft führt die neue Datenart noch nicht (Dateninventar: `lagebild-werte`, Grund
  ausgeschrieben). Gespeichert wird zur Person nur die ändernde Kennung des letzten Stands; die
  Fläche nennt keine fremden Namen („von einer anderen berechtigten Person“).
- Kein Verlauf früherer Stände; die Version zählt hoch, ältere Werte werden überschrieben.
- Technische Proben mit erfundenen Daten sind keine Kunden- oder PoC-Bestätigung.

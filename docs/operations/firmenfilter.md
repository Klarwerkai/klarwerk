# Firmenfilter: eigene Firma, Partnerbereich, öffentlich

Auftrag `produkt:20261011:peter-p14` (Peters Entscheidung 51, 11.10.2026): Der Firmenfilter ist ein serverseitiger Kontext für eigene Firma, freigegebene Partner und öffentliche Inhalte. Er vergibt keine Rechte.

## Betriebsmodell

Jede Firma hat ihre eigene Anlage mit eigener Datenbank (`services/app/src/instanzbindung.ts`). Ein Mandanten- oder Firmenschlüssel in der Anfrage existiert nicht. Angaben wie `tenant_id`, `mandant` oder `firma` werden ignoriert. Die Sitzung gilt nur in der Anlage, in der sie entstanden ist. Ein `tenant_id` allein belegt keine dedizierte Instanz. Diesen Nachweis liefern Instanzbindung und getrennte Datenbank.

## Die drei Bereiche

Jeder Bereich wird aus dem Bestand abgeleitet (`services/app/src/firmenbereich.ts`):

| Bereich | Bedingung am Wissensobjekt |
|---|---|
| `partner` | Der führende Space ist als Partnerbereich markiert (`partner` = Name der Partnerfirma). |
| `oeffentlich` | Der Eintrag ist als öffentlich gekennzeichnet (`schutz-oeffentlich`). Das wirkt nur bei interner Stufe. |
| `eigen` | Für alle anderen Einträge. |

Ein Eintrag in einem Partnerbereich zählt immer als Partnerwissen, auch wenn er als öffentlich markiert ist.

## Partnerbereich einrichten

Ein Space wird als Partnerbereich geführt, wenn bei Anlage oder Pflege `partner: "<Name der Partnerfirma>"` gesetzt ist (`POST`/`PUT /api/spaces`). Dafür gelten dieselben Rechte wie für jede Spacepflege: Spacezuständige oder Kontoverwaltung. Fehlt `partner` bei der Pflege, bleibt die Marke unverändert. `partner: null` entfernt sie.

Wer die Inhalte lesen darf, bestimmen weiterhin Zugang und Mitglieder des Space. Die Marke öffnet nichts. Auch die Administration bekommt dadurch keinen Durchgriff.

## Anfragen

`firmenbereich=eigen|partner|oeffentlich` ist kommagetrennt oder wiederholt erlaubt. Optional grenzt `partner=<Space-Kennung>` auf genau einen Partnerbereich ein. Diese Wege nehmen den Filter an:

- `GET /api/kos`
- `GET /api/library/search`
- `GET /api/library/export` (alle Formate)
- `POST /api/ask` im Körper

Gefilterte Listen- und Suchantworten nennen an jedem Treffer `firmenbereich`. Ohne Filter bleibt die Antwort unverändert.

Ablauf einer gefilterten Anfrage:

1. Zuerst die Anmeldung: ohne gültige Sitzung kommt `401`, auch bei ungültigem Filter.
2. Dann die Form des Filters: eine ungültige Angabe ergibt `400 FIRMENFILTER_UNGUELTIG` mit einem festen Text, bevor gelesen wird.
3. In SQL wirkt der Filter als UND hinter dem Sichtbarkeitstrim, vor Trefferdeckel, Seite und Zählung.
4. Vor der Ausgabe wird `sichtbareFuer` und der Filter erneut angewendet.

Eine Partnerkennung, die nicht lesbar, kein Partnerbereich, unbekannt oder aus einer anderen Firma ist, liefert dieselbe leere Antwort `[]`.

Rechte und Partnerbereiche werden je Anfrage frisch aus der Ablage gelesen. Es gibt keinen Zwischenspeicher: Ein Entzug der Mitgliedschaft oder eine geänderte Marke wirkt mit der nächsten Anfrage. Die Weboberfläche führt den Filter im Abfrageschlüssel mit (`KoFilter`) und leert ihren Zwischenspeicher bei der Abmeldung.

## Grenzen

- Eine Bedienfläche für den Bereichswechsel in der Bibliothek ist nicht gebaut. Der Filter ist über die API und die Web-API-Typen nutzbar.
- Eine Suche mit Firmenfilter wird ohne Treffer nicht als Nulltreffer vermerkt. Die gespeicherte Eingrenzung kennt den Bereich nicht.

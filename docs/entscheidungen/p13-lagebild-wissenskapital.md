# PETER-20261011-P13 · Lagebild und Wissenskapital

Auftrag `produkt:20261011:peter-p13`, Phase „Konzept jetzt; Messung im PoC“. Quelle: Peters
Entscheidung 50 vom 11.10.2026 („Reifegrade an Belege knüpfen, Wissenskapital nicht aus Textmenge
monetarisieren“). Verknüpfte, unverändert erhaltene Verträge: `aufnahme:20260922:gesamt-management-lagebild`,
`aufnahme:20260922:gesamt-kennzahlen`, `produkt:20261009:admin-wissenskennzahlen`.

Benutzt werden die vorhandenen Flächen: die Kapitalsicht `/kapital` (`pages/Stufe2.tsx`) und die
Wissenskennzahlen oben auf `/analytics` (ADMIN-11). Die Regeln stehen rein und DOM-frei in
`apps/web/src/lib/lagebild.ts` (Rechenregel `p13-lagebild-v1`).

## Was vorher stand und warum es ging

| Fläche | Vorher | Problem |
|---|---|---|
| Wissensbewertung | validierte Objekte × 60 €/h × 2 h × 3 × Ø-Vertrauen, ungekennzeichnet | Euro aus Objektzahl mit Vorgabewerten (heute: als Beispiel gekennzeichnet, s. unten) |
| Reifegrad-Pfad | „Stufe n/5“ firmenweit aus der Validierungsquote | kein Beleg, kein Arbeitsweg |

Bei leerem Bestand zeigt `Capital` schon im Bestand nur den Hinweis „mgmt.empty“ statt der
Kapitalsicht — der vom Server gerechnete Wert 0/100 und die Anteile erscheinen dort nicht. Das
bleibt so und ist mit einer Gegenprobe belegt.

## Zusammenführung mit `produkt:20261013:lagebild-reale-werte-eingabe`

Parallel hat Peter am 13.10. entschieden („verwende beispielwerte, wir brauchen dort eine
eingabemoeglichkeit der echten werte“). Dieser Auftrag hat die Beispielrechnung
(`lib/knowledgeValuation.ts`) als „Beispiel (geschätzt)“ gekennzeichnet behalten und daneben
gespeicherte reale Werte je Bereich ergänzt (`components/LagebildWerte.tsx`,
`docs/entscheidungen/lagebild-reale-werte.md`). Beide Teile bleiben unverändert. Der Geldwert aus
gemessenen Fällen dieses Auftrags steht darunter als dritter, getrennter Teil.

Offene Produktentscheidung, hier nicht getroffen: Die Beispielrechnung und die realen Werte je
Bereich rechnen Euro aus der Zahl validierter Objekte × eingegebener Annahmen. Entscheidung 50
(„Wissenskapital nicht aus Textmenge monetarisieren“, Geldwert nur aus gemessenen Fällen) und die
Entscheidung vom 13.10. stehen sich dabei gegenüber. Welche Rechnung künftig gilt, entscheidet
Peter.

## Reifegrad je Arbeitsweg (K1, K2)

| Stufe | Tatsächlich erforderlicher Nachweis |
|---|---|
| Erfasst | Ursprung, Version, Verantwortlichkeit und Einstufung vorhanden |
| Geordnet | Kontext, Verknüpfung und Rechte nachvollziehbar |
| Fachlich bestätigt | passende fachliche Befugnis, Entscheidung und Geltung belegt |
| Technisch geprüft | vollständiger Arbeitsweg mit Positiv- und Negativfällen bestanden |
| Im echten Alltag belegt | reale Anwender und Aufgaben, Gesamtaufwand und Ergebnis gemessen |

`reifegrad(arbeitsweg, belege)`: eine Stufe gilt, wenn jeder ihrer Nachweise einen Beleg DIESES
Arbeitswegs mit Quelle hat und alle Stufen darunter gelten. Ein nicht bestandener Prüflauf ist kein
Nachweis. Agentenbelege (fiktive Testdaten) tragen bis „Technisch geprüft“; „Im echten Alltag
belegt“ verlangt Messart `mensch`. Agentenbelege für den Alltag werden als `nichtAnrechenbar`
benannt.

Der Bestand führt keine Belege je Arbeitsweg. Die Kapitalsicht zeigt deshalb die Stufen mit ihren
Nachweisen und sagt ausdrücklich, dass kein Reifegrad vergeben ist — auch kein firmenweiter. Die
Belege entstehen in der PoC-Messung (Agentenprüfung RF01–RF18, drei Arbeitswege aus dem Briefing)
und für den Alltag erst mit echten Anwendern. Das ist keine Zugangssperre für den PoC.

## Kennzahlen: Nenner, Zeitraum, Kontext, Quellenstand, Messart (K2, K3, K4)

ADMIN-11 nennt je Zahl bereits Bedeutung, Grundmenge (bei Quoten Zähler/Nenner), Zeitraum und
Datenstand. Ergänzt unter „So gezählt“:

- **Kontext**: die Auswahl (Space/Team) bzw. „alle Spaces, deren Inhalte Sie lesen dürfen“.
- **Quellenstand**: „Quelle vollständig abgerufen“ oder „Quelle nicht abrufbar“.
- **Messart**: Momentaufnahmen sind keine Nutzungsmessung; Zeitraumzahlen kommen aus dem Protokoll
  aller Konten, das Agentenprüfung und echte Nutzung nicht unterscheidet — kein Nachweis von
  Alltagsnutzen.

`quote(zaehler, nenner)` liefert ohne festgelegte Grundgesamtheit (`nenner: null`) keinen Wert
(`grundgesamtheit_unbekannt`), bei Nenner 0 `nenner_null`. Ohne Bestand zeigt die Kapitalseite
keinen Kapitalwert und keine Anteile, sondern den vorhandenen Leerhinweis.

## Klärbedarf und nächste Handlung (K5, K8)

Die Detaillisten der Wissenskennzahlen tragen je Vorgang die Zuständigkeit aus ADMIN-10 und den
ältesten offenen Fall. Konflikte führen im Bestand keine Zuständigkeit — das steht als „Keine
Zuständigkeit hinterlegt“ da; ein Schweregrad wird für Konflikte nicht erhoben und deshalb nicht
angezeigt. Die nächste Handlung ist der vorhandene Arbeitsweg des Vorgangs. Die Detailliste ist
unverändert genau die gezählte, nach demselben Sichtbarkeitsfilter wie ADMIN-10; zurückgehaltene
Titel bleiben zurückgehalten.

## Geldwert (K6, K7)

`geldwert({ faelle, kostensatzEurProStunde, zusatzkostenEur })` rechnet
Fallzahl × gemessene Zeitdifferenz × vereinbarter Kostensatz − zusätzliche Pflege-, Betriebs- und
Prüfkosten.

- Kein Wert ohne gemessenen Fall, ohne vereinbarten Kostensatz oder ohne Angabe der Zusatzkosten
  (0 ist eine Angabe). Es gibt keine Vorgabewerte.
- Negative Zeitdifferenz bleibt negativ; das Netto darf negativ sein.
- Ein Fall ohne vergleichbare Ergebnisqualität verhindert den Wert für alle (kein Aussortieren).
- Jeder Betrag gilt für einen angegebenen Messrahmen: Messzeitraum (gilt für Fälle UND
  Zusatzkosten), Arbeitskontext und Messquelle mit Stand. Fehlt eine Angabe, gibt es keinen Betrag,
  und die fehlenden Angaben werden genannt. Der Zeitraum darf nicht in der Zukunft enden; der
  Quellenstand muss ihn abdecken (nicht vor seinem Ende) und darf nicht in der Zukunft liegen. Das
  Ergebnis nennt Zeitraum, Kontext und Quelle mit Stand.
- Nur fachlich identische Wiederholungen derselben Fallkennung zählen einmal. Weichen Einträge
  derselben Kennung ab (Minuten, Qualität, Messart), ist das Klärbedarf mit Nennung der Kennungen —
  kein Betrag, unabhängig von der Reihenfolge der Eingabe.
- Agenten- und Menschenmessung werden nie zusammengerechnet.
- Eine Agentenmessung ist als Simulation gekennzeichnet — kein realer Kapitalwert.
- Ersparnis ist kein Umsatz und keine Liquidität; keine Hochrechnung.

In der Kapitalsicht werden die Fälle von Hand eingetragen und nicht gespeichert. Eine
Messablage mit Berechnungsversion und Snapshot gehört zur PoC-Messung und ist hier nicht gebaut.

## Grenzen

- Keine Messung mit echten Anwendern; alle Testdaten sind fiktiv.
- Die Hilfetexte `shelp.mgmt.valuation` und `shelp.mgmt.maturity` liegen im eingefrorenen
  Wörterbuch und beschreiben die Abschnitte allgemein; die verbindliche Regel steht in der Karte.
- Das Frageprotokoll unterscheidet Agenten- und Menschenkonten nicht; die Trennung ist dort nur
  ausgewiesen, nicht gerechnet.

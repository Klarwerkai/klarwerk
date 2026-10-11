# Präsentation nach der Besprechung nachbearbeiten (BPA-17)

Auftrag `produkt:20261011:assistenz-dokumentnachbearbeitung`. Code: `services/app/src/office-nachbearbeitung.ts`,
Routen am Ende von `services/app/src/routes/office-routes.ts`, Tests: `tests/assistenz-dokumentnachbearbeitung/`.

## Weg

Belegter Änderungsauftrag → bestehender Office-Fassungsweg (`KoService.uebernimmOfficeFassung`, CAS gegen
`basisFassung`) → neue Fassung (Status `offen`) → Wiederöffnen aus dem Objektspeicher und Prüfung →
private Folgeprodukte. Kein zweiter Kern, keine neue Rechteachse, kein Modellaufruf.

```
POST /api/kos/:id/office/:anhangId/nachbearbeitung
POST /api/kos/:id/office/:anhangId/nachbearbeitung/:laufId/stopp
```

Rechte wie `zurueckholen`: `ko.create`, Artikel sichtbar, Schreibweg `direkt`. Freigegebener Artikel ohne
Freigaberecht: 403 `PROPOSAL_REQUIRED` (Nur-Vorschlag bleibt). Laufende Editor-Sitzung: 409
`OFFICE_SITZUNG_LAEUFT`. Nur `.pptx`.

## Auftrag (Rumpf)

| Feld | Bedeutung |
|---|---|
| `laufId` | Kennung des Laufs; eine Wiederholung liefert das Ergebnis erneut (`wiederholt: true`) und schreibt nichts |
| `basisFassung` | die besprochene Artikelfassung |
| `schritte[]` | `{ id, art: "text"\|"diagramm", folieId (p:sldId), alt, neu, herkunft, zahlenbeleg? }` |
| `herkunft` | `meetingbeschluss` (braucht `quelle` + `stelle`), `nutzerauftrag`, `ki_empfehlung` (wird nie eingearbeitet) |
| `zahlenbeleg` | `{ quelle, stelle?, werte[], berechnung? { art: summe\|differenz\|anteil_prozent, eingaben[], ergebnis } }` |
| `sprechernotizen[]` | `{ folieId, text, herkunft }` |
| `folgeprodukte` | `{ handout?: true, sprechernotizen?: true }` |

## Verhalten

- Neue Zahl ohne Beleg, falsche Rechnung, Beschluss ohne Gesprächsstelle, Diagrammänderung, mehrdeutiger
  oder über Formatierungsläufe verteilter Text: **Klärung**, nichts geändert.
- Geändert wird nur Text einzelner `a:t`-Läufe. Vorlage, Layouts, Master, Thema bleiben byte-gleich
  (`pruefung.vorlageUnveraendert`).
- Sprechernotiz: an der echten Notizseite angefügt, wenn die Folie eine hat (bestehende Notizen bleiben);
  sonst Notizdatei (Markdown) mit Grund — es wird keine Notizseite erfunden.
- Handout (Markdown): nur sichtbare Folien des gespeicherten Stands, keine Notizseiten.
- Paralleländerung: 409 `KO_STALE` mit Bericht je Schritt (`passt_auf_heutigen_stand` / `konflikt` mit
  heutigem Text) und privatem Entwurf; nichts überschrieben. Zusammenführen = Auftrag mit neuer
  `basisFassung` erneut erteilen.
- Stopp: vor jeder Wirkung abgefragt; Ergebnis nennt `gestopptVor` und was schon gespeichert ist.
- Rücknahme: `POST …/zurueckholen` mit `ausFassung = basisFassung`.
- Folgeprodukte: Eigentümer = Auftraggeber, `ziel: privat`, Schutzklasse mindestens `vertraulich`,
  `versandt: false`, `gemeinsamFreigegeben: false`, an keinen Artikel gebunden. Am Objekt steht
  `lifecycle.privatQuelle` (Kennung des Quellartikels): über `GET /api/objects/:id`, `/raw` und die
  Medienroute liest NUR der Eigentümer — keine Rolle, auch kein Admin — und nur, solange er den
  Quellartikel jetzt sehen darf (`privatesFolgeprodukt`, `services/app/src/sichtbarkeit.ts`).
  Rechteentzug an der Quelle sperrt damit auch die Kopien.
- Quelle gewöhnlich gelöscht (Papierkorb): die Kopie bleibt für ihren Eigentümer lesbar, gekennzeichnet
  (Kopfzeile `X-Klarwerk-Quelle: geloescht; ko=<id>`, in `GET /api/objects/:id` zusätzlich
  `quelle: { koId, status: "geloescht" }`); die Rechte gelten an den Fakten der gelöschten Quelle
  weiter. Quelle endgültig entfernt (Papierkorb geleert, harte/personenbezogene Löschung): gesperrt,
  weil keine Rechtegrundlage mehr prüfbar ist.
- Auch der hochgeladene Dokumentstand trägt `privatQuelle`: bei Stopp vor der Übernahme oder
  gescheiterter Übernahme bleibt er privat. Nach der Übernahme (am Artikel oder in dessen Belegkette)
  gilt die gewöhnliche Anhangsregel.
- Zahlenprüfung: Vorzeichen zählen (`-10` → `10` ist eine Änderung); verglichen wird die Zahlenfolge
  Stelle für Stelle, auch Entfernen/Umstellen braucht einen Beleg.
- Stopp wird auch NACH dem Hochladen und VOR der Übernahme abgefragt (`gestopptVor: "uebernahme"`,
  `nichtUebernommen.objectId`).
- Scheitert ein Schritt nach einer Wirkung (Hochladen, Fassung, Folgeprodukt): 500
  `NACHBEARBEITUNG_TEILFEHLER` mit `wirkungen` (Ergebniskennungen) und Rücknahmehinweis; dieselbe
  `laufId` liefert diesen Stand erneut und erzeugt keine weiteren Kopien.

## Hostprobe

`tests/assistenz-dokumentnachbearbeitung/code-hostweg.integration.test.ts` fährt den Weg mit dem
eingebetteten Editor Collabora CODE (Container, echtes Chromium): Nachbearbeitung → Öffnen im Editor →
Speichern durch den Editor → Übernahme → Wiederöffnen → Quellenprüfung → zweite Nachbearbeitung auf dem
vom Host geschriebenen Stand. Beleg: `test-results/assistenz-dokumentnachbearbeitung/HOSTBELEG.json`
(Abbild, vom Host gemeldete Version, Rolle, Fassungen, Objektkennungen, Bildschirmfotos).

## Grenzen

- Host der Probe ist Collabora CODE, nicht Microsoft PowerPoint; ob eine angefügte Notiz in PowerPoint
  (Desktop/Web) erscheint, ist nicht belegt.
- Laufgedächtnis (Wiederholung/Stopp) je Prozess; nach Neustart zeigt der Anhangsverlauf das Gespeicherte.
- Keine automatische Meetingbindung (BPA-16); Beschlussstellen kommen als belegte Angaben im Auftrag.
- Keine Oberfläche in dieser Lieferung; die Fähigkeit ist über die API erreichbar.
- Eine endgültig gelöschte Quelle sperrt ihre privaten Kopien; ob eine personenbezogene Löschung sie
  zusätzlich physisch entfernen soll, regelt der bestehende Löschweg, nicht diese Lieferung.

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
  `versandt: false`, `gemeinsamFreigegeben: false`, an keinen Artikel gebunden.

## Grenzen

- Belegt durch Routentests mit synthetischer Datei; kein echtes PowerPoint/Collabora, keine Hostversion.
- Laufgedächtnis (Wiederholung/Stopp) je Prozess; nach Neustart zeigt der Anhangsverlauf das Gespeicherte.
- Keine automatische Meetingbindung (BPA-16); Beschlussstellen kommen als belegte Angaben im Auftrag.
- Keine Oberfläche in dieser Lieferung; die Fähigkeit ist über die API erreichbar.
- Private Folgeprodukte sind nach der bestehenden Stufenregel für `vertraulich` auch für `ko.validate`-Rollen
  über ihre Kennung lesbar.

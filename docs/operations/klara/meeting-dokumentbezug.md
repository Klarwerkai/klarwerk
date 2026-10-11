# BPA-16 · Gesprächsaussagen mit Folien verbinden — Format, Weg und Zuordnungsgrenze

Auftrag: `produkt:20261011:assistenz-meeting-dokumentbezug` r1 (Nacharbeit 2).

| Teil | Datei |
|---|---|
| Bindungsschicht | `services/app/src/meeting-dokumentbezug.ts` |
| Ablage (Speicher, PostgreSQL) | `services/app/src/meeting-dokumentbezug-ablage.ts`, Tabelle `meeting_dokumentbezuege` |
| Bedienweg (HTTP) | `services/app/src/routes/meeting-dokumentbezug-routes.ts`, `/api/meetings/**` (API-Referenz 3.11) |
| Prüfung | `tests/meeting-dokumentbezug/` (`folienbezug`, `bedienweg`, `bedienweg-pg.integration`) |

## Der Weg

1. PPTX und WebVTT werden über den vorhandenen Objektweg `POST /api/objects` hochgeladen. Die
   Dateikennung einer Präsentation ist die Objektkennung.
2. `POST /api/meetings` legt den Meetingbezug an: Titel, Zeitbasis und eingetragene Teilnehmer.
3. `…/praesentationen` verbindet die präsentierte Datei, optional mit ihrem Original (eigene
   Kennung erlaubt). `…/mitschriften` verbindet die WebVTT-Mitschrift.
4. `…/folienwechsel` nimmt Hostereignisse an (Datei, Fassung, `sldId`).
5. `…/rueckmeldungen` nimmt eine geäußerte Rückmeldung zu einer Stelle der Mitschrift auf.
6. Geöffnet wird eine Rückmeldung aus der Folie (`…/folien/:dateiId/:sldId`, über Kopie oder
   Original) oder aus der Zeitstelle (`…/zeitstellen/:zeitMs`).
7. Weitere Wege sind Klärung oder Korrektur, Verwerfen und der Abgleich einer neuen
   Originalfassung (`…/fassungsabgleich`).

## Was gebunden wird

| Teil | Quelle | Identität |
|---|---|---|
| Datei | Objektkennung | `dateiId` |
| Fassung | Dateibytes | SHA-256 der `.pptx` |
| Folie | `ppt/presentation.xml` → `p:sldId/@id` | `dateiId` + `fassung` + `sldId` |
| Folieninhalt | Folien-XML und rekursiv alle eingebundenen Teile ohne Notizfolie (Bilder, Diagramme mit Daten, SmartArt, Medien, Layout, Master, Design) | SHA-256 über die Inhalte der Teile, pfadunabhängig |
| Kopie → Original | ausdrücklich beim Verbinden | gespeicherte Zuordnung |
| Gesprächsstelle | WebVTT-Abschnitt (Kennung, Start/Ende, `<v Sprecher>`) | Mitschrift + Abschnittskennung + Zeitbasis |

Die Foliennummer ist nur Anzeige. Ein extern verknüpfter oder fehlender Bestandteil macht eine
Folie **nicht vergleichbar**: Sie gilt nie als gleich, und Änderungen an ihr gehen zur Prüfung.
Externe Hyperlinks zählen als Inhalt, machen die Folie aber nicht unvergleichbar.

## Was wann adressiert wird

- **Gebunden:** Der Host meldet Datei, Fassung und `sldId` auf derselben Zeitbasis wie die
  Mitschrift.
- **In Klärung**, ohne Änderungsziel: abweichende Zeitbasis, kein vorangehender Folienwechsel,
  nur eine Foliennummer oder ein Bildschirmtext. OCR wird über den Bedienweg nicht angenommen.
- **Änderungsziel Original:** nur über die gespeicherte Zuordnung Kopie → Original, und nur wenn
  die Folie dort dieselbe Fassung hat oder vollständig vergleichbar und inhaltsgleich ist.
- **Spätere Originalfassung:** Der Abgleich erfasst alle Bindungen an das Original und an jede
  zugeordnete Kopie. Ergebnis je Bindung: `unveraendert`, `geaendert`, `entfernt` oder
  `nicht_vergleichbar`. Die Bindung bleibt an der präsentierten Fassung. Offene Änderungen gehen
  außer bei `unveraendert` auf `fassung_pruefen`.
- **Klärung/Korrektur:** neue Bindungsversion, die alte bleibt in der Historie. Neu gebunden
  werden nur nicht ausgeführte und nicht verworfene Änderungen. Wiederholungen bleiben wirkungslos.

## Rechte

Lesen braucht `ko.read`, Wirkungen brauchen `ko.create`; es gibt kein neues Recht. Dazu kommt bei
jeder Anfrage:

- **Meetingrecht** (Eigner oder eingetragener Teilnehmer). Ohne es antwortet jede Route mit 404
  ohne Existenzauskunft, auch bei Klärung, Historie, Änderungsobjekt und Abgleich.
- **Dokumentrecht je Datei:** dasselbe Urteil wie an `GET /api/objects/:id` (`beurteileAnhang`).
  Ohne es gibt es keine Folie, kein Original, kein Änderungsziel (`zielVerborgen`) und keine
  Klärung auf diese Datei.
- **Versteckte Folien und Sprechernotizen** hängen am Leserecht der Datei selbst. Ein feineres
  Recht nur für Notizen gibt es im Produkt nicht; Meetingteilnahme allein öffnet keins von beiden.

## Grenzen dieses Stands

- Es gibt keine Weboberfläche für diese Routen. Der Bedienweg ist die HTTP-Schnittstelle der App.
- Geprüfte Dateien sind synthetisch erzeugtes OOXML und `tests/fixtures/d3-referenz.pptx`, nicht
  mit einer PowerPoint-Installation gespeichert. Eine Hostprobe steht aus (O11).
- Der Leser erwartet die üblichen Präfixe `p:`/`a:`/`r:`. Titel kommen aus `title`/`ctrTitle`.
- Live-Folienwechsel aus einem Meetinghost fehlen (BPA-15, O04/O08). Ereignisse kommen von einem
  Hostadapter oder von Hand. Eine neue Originalfassung wird als eigenes Objekt hochgeladen und
  ausdrücklich abgeglichen; eine automatische Erkennung von Dateiänderungen gibt es nicht.
- Es gibt keine Schreibwirkung an der Originaldatei (BPA-17) und keine eigene OCR oder
  Modellstufe.
- Es gibt keinen eigenen Löschweg für einen Meetingbezug; der Bestandsreset entfernt ihn.

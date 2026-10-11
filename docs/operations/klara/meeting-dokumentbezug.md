# BPA-16 · Gesprächsaussagen mit Folien verbinden — Format und Zuordnungsgrenze

Auftrag: `produkt:20261011:assistenz-meeting-dokumentbezug` r1.
Code: `services/app/src/meeting-dokumentbezug.ts`.
Prüfung: `tests/meeting-dokumentbezug/folienbezug.test.ts`.

## Was gebunden wird

| Teil | Quelle | Identität |
|---|---|---|
| Datei | berechtigte Ablagekennung (vom Aufrufer) | `dateiId` |
| Fassung | Dateibytes | SHA-256 der `.pptx` |
| Folie | `ppt/presentation.xml` → `p:sldId/@id` | `dateiId` + `fassung` + `sldId` |
| Folieninhalt | Folienteil `ppt/slides/*.xml` | SHA-256 des Folien-XML |
| Gesprächsstelle | WebVTT-Abschnitt (Kennung, Start/Ende, `<v Sprecher>`) | Abschnittskennung + Zeitbasis |

Die Foliennummer ist nur Anzeige. PowerPoint behält `p:sldId` beim Umsortieren bei. Meldet ein
Folienwechsel nur eine Nummer, bleibt die Zuordnung in Klärung.

## Was wann adressiert wird

- **Gebunden:** Der Host meldet Datei, Fassung und `sldId` auf derselben Zeitbasis wie die Mitschrift.
- **In Klärung**, ohne Änderungsziel: eine abweichende Zeitbasis, kein vorangehender
  Folienwechsel, ein Wechsel nur mit Foliennummer oder ein Bildschirmtext (OCR). OCR liefert nur
  Kandidaten. Bei „Keine KI“ wird ein Bildschirmtext gar nicht angenommen.
- **Änderungsziel Original:** nur, wenn die präsentierte Folie im zugänglichen Original
  inhaltsgleich vorhanden ist. Fehlt das Original, gilt „ungeklärt, kein Originalzugriff“. Weicht
  die Folie ab, wird das Änderungsobjekt nicht adressiert.
- **Spätere Originalfassung:** Ein Fassungsabgleich ergibt je Bindung `unveraendert`,
  `geaendert` oder `entfernt`. Die Bindung bleibt an der präsentierten Fassung. Offene Änderungen
  an geänderten oder entfernten Folien gehen auf `fassung_pruefen`.
- **Klärung/Korrektur:** Sie erzeugt eine neue Bindungsversion, die alte bleibt in der Historie.
  Nur nicht ausgeführte und nicht verworfene Änderungsobjekte werden neu gebunden. Eine
  wiederholte Klärung und ein wiederholter Import bleiben wirkungslos.

## Rechte

Die Rechte werden bei jedem Lesen geprüft. Ohne Meetingrecht gibt es keine Sicht, auch keine
Existenzauskunft. Die Folie erscheint nur mit Dokumentrecht. Versteckte Folien (`show="0"`) und
Sprechernotizen erscheinen nur mit eigenem Recht darauf. Meetingmitgliedschaft genügt nicht.

## Grenzen dieses Stands

- Belegt ist eine reine Bindungsschicht mit Unit-Prüfung. Es gibt keine HTTP-Route, keine
  Oberfläche und keine dauerhafte Ablage.
- Geprüfte Dateien: synthetisch erzeugtes OOXML und `tests/fixtures/d3-referenz.pptx`. Beide sind
  nicht mit einer PowerPoint-Installation gespeichert. Eine Hostprobe mit echter PowerPoint-Fassung
  steht aus (O11).
- Der Leser erwartet die üblichen Präfixe `p:`/`a:`/`r:`. Titel kommen aus den Platzhaltern
  `title`/`ctrTitle`.
- Live-Folienwechsel aus einem Meetinghost (BPA-15, O04/O08) gibt es hier nicht. Eingabe sind
  Hostereignisse oder eine vorhandene WebVTT-Mitschrift.
- Es gibt keine Schreibwirkung an der Originaldatei (Folgeumfang BPA-17) und keine eigene OCR oder
  Modellstufe.

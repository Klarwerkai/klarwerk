# Wissensnetz in offenem Format exportieren (R-0711)

Auftrag `aufnahme:20260922:gesamt-wissensnetz-export`, Revision 1. Originalpunkt R-0711 (Alias F-0711,
Herkunft `ZEITPROJEKT-Wissensnetz-Bausteine` §2 vom 26.07.2026: „Danach: OKF-Export (SCRUM-549) …
dann ist es kein Zeitprojekt mehr, sondern ein eigener Strang.“).

## Abgleich vor der Umsetzung

Im Arbeitsbaum (Basis `13bf9f2bd`, 1.0.0-beta.1.785) gab es **keinen** Export des Wissensnetzes. Der
Bibliotheks-Export (`GET /api/library/export`, JSON/Markdown/MediaWiki/HTML) gibt Wissensobjekte aus,
aber keine Knoten und Kanten. `GET /api/graph` liefert das Netz als anwendungseigenes JSON, also nicht
in einem offenen Austauschformat. Die Bestandsaufnahme `wissensnetz-themenkarte-bestandsaufnahme-2026-10-03.md`
führt diesen Auftrag ausdrücklich als gesonderten, dort nicht bearbeiteten Strang.

## Geliefert

- **Format:** GraphML (offenes XML-Austauschformat für Graphen, herstellerneutral). Lesbar u. a. in
  Gephi, yEd, Cytoscape, NetworkX und igraph.
- **Ort:** Seite `/graph` (Wissensgraph), Knopf „Wissensnetz herunterladen (GraphML)“, Datei
  `klarwerk-wissensnetz.graphml`. Texte in `apps/web/src/texte/netzexport.ts` (de/en/nl).
- **Erzeugung:** `apps/web/src/lib/wissensnetzExport.ts` aus derselben `GET /api/graph`-Antwort, die
  das Bild zeichnet. Damit gilt die Sichtbarkeitsentscheidung des Servers (`ko.read`,
  `sichtbarkeitsfilterFuer`) unverändert. Es gibt keinen neuen Server-Leseweg.
- **Inhalt:** alle sichtbaren Wissensobjekte (Kennung, Titel), auch über den 60-Knoten-Ausschnitt des
  Bildes hinaus. Dazu die Schlagwortkanten (`herkunft = schlagwort`, mit Schlagwort, ungerichtet) und
  die gesetzten Fachbeziehungen (`herkunft = kuratiert`, Art, Richtung, bei `gerichtet` als gerichtete
  Kante). Als Graphdaten kommen die Grenzen der Antwort hinzu: Gesamtzahl und Kürzung beider
  Kantenmengen, Deckel und übergangene Schlagwörter. Fehlt ein Feld in der Antwort, fehlt es auch in
  der Datei.
- **Tests:** `tests/wissensnetz-export/graphml.test.ts` (Dateitext) und
  `tests/wissensnetz-export/export-am-graphen.test.tsx` (gemountete Seite, heruntergeladene Datei per
  XML-Parser gelesen).

## Grenzen

- Die Kanten sind wie in `/api/graph` je Menge bei 5.000 gedeckelt. Die Datei enthält dann dieselbe
  gekürzte Menge, nennt aber die Gesamtzahl, und die Seite weist darauf hin.
- Nicht enthalten sind Inhalte der Wissensobjekte, Status, Konflikte und Themenkarte. Die Quelle
  verlangt das Netz, nicht den Bestand; Inhalte gibt der Bibliotheks-Export aus.
- Ein Exportvermerk im Auditprotokoll (`library.export`) entsteht nicht. Die Datei wird im Browser aus
  einer Antwort gebildet, deren Abruf ebenfalls nicht protokolliert wird.
- Ein Import der Datei in ein fremdes Werkzeug durch einen Menschen ist nicht belegt. Belegt ist nur,
  dass ein XML-Parser die Datei liest und sie dem GraphML-Aufbau folgt.

## Quellenlücken

- „OKF“ ist in den Quellen nicht ausgeschrieben, und ein bestimmtes Format wird nicht genannt. Gefordert
  ist nur „offen, herstellerneutral“; GraphML ist eine Auslegung. SCRUM-549 selbst liegt nicht vor.
- Der Punkt hat den Prüfstatus `nur_altquelle` mit dem Zustand „angedacht“. Einen jüngeren
  Erledigungsbeleg gibt es nicht.

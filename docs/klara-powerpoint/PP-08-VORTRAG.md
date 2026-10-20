# PP-08 · Vortrag und bereitgestellte Nachbereitung

Original `produkt:20261015:klara-powerpoint-vortrag-nachbereitung`, Revision 2.
Quelle: Produktpaket 12.10.2026, Abschnitte 3–7/PP-08, Produktleitlinien 14.10.2026,
vollständiger Vertrag und History im zugewiesenen Q-Auftragsbestand vom 20.10.2026.
Der Originalauftrag bleibt offen. Diese Implementierung ist ein begrenzter Anhangweg,
keine native PowerPoint-, Audio-, Live- oder unabhängige Gesamtabnahme.

## Nutzbarer Weg

Am vorhandenen PPTX-Anhang im Artikel unter „Im Artikel öffnen“ → „Vortrag vorbereiten“.
Kein neuer Hauptmenüpunkt, kein zweites Setup und kein zusätzlicher Office-Host.

- Eigene Sprechernotizen, Übergänge und Zeitrahmen bleiben an `sldId`, Dateifassung
  und ausdrücklich ausgewählten Datenpunktfassungen gebunden. Sprechhilfen verwenden
  ausschließlich aktuell gebundene Angaben und nennen Bedeutung/Prüfbedarf als offene Arbeit.
  Die Vorschau überschreibt keine gefüllte Notiz. Eine Schätzung mit 120 Wörtern/Minute
  ist eine Annahme, keine gemessene Redezeit.
- Die ausdrücklich gestartete Textprobe liest den bereitgestellten Text einer gewählten
  Folie. Sie zählt Wörter/lange Sätze, schätzt Dauer bei 100–140 Wörtern/Minute und zeigt
  ungebundene Zahlen als konkrete Arbeit. Keine Aufnahme, keine automatische Probe und
  keine behauptete semantische Verständlichkeitsprüfung. Frei formulierte sachliche
  Behauptungen werden nicht automatisch fachlich validiert.
- Eine Frage mit einer Zahl führt bei genau einer passenden aktuellen Bindung zu ihrer
  Datenpunktfassung. Mehrere gleiche Zahlen verlangen Auswahl; kein Treffer erfindet
  keinen Beleg. „Herkunft öffnen“ nutzt den vorhandenen PP-02/03-Inspektor mit Quelle,
  Quellfassung, Fundstelle, Rechenweg/Eingaben, Korrekturen und getrennten Prüfdimensionen.
- Detailfolien müssen dieselbe Datenpunktfassung wirklich gebunden enthalten. Gleiche
  Positionen, Titel oder Elementnummern genügen nicht. Die generischen Leitfragen fragen
  nach Herkunft, Zeitraum, Formel bzw. Prognoseannahmen; sie sind keine Modellantworten.
- Bereitgestellte Rückfragen, Erklärlücken, Zusagen und Korrekturen erhalten einen ausdrücklich
  gewählten Aussage-/Folienbezug und einen vom Nutzer benannten Herkunftshinweis. Zunächst
  entstehen sichtbare Arbeitsvorschläge. Nur der bewusste Knopf speichert eine eigene Notiz
  und daraus eine persönliche Aufgabe über die unveränderten Klara-Dienste. Kein Schreiben
  in zentrale Produktaufträge und kein Eingriff in F-Besprechungsoriginale.

## Rechte, Fassungen und Speichergrenzen

`POST …/office/:anhangId/vortrag` wertet aus, schreibt nichts und setzt `no-store`.
Der vorhandene PP-02/03-Anfragekontext prüft Heimatartikel, Quellen, Eingabeketten und
Präsentationsbindung mit den aktuellen Sitzungsrechten. Überholte Datei- oder Datenfassungen
werden mit 409 abgewiesen. Eine Zuordnung muss ausdrücklich neu geprüft werden; ein alter
Validierungsstatus wird niemals neu erzeugt oder übernommen.

Der Vortragsentwurf lebt in der geöffneten Ansicht, bleibt beim Zuklappen erhalten und
geht beim Verlassen/Neuladen verloren; das steht vor der Eingabe. Es gibt keinen lokalen
Quellcache und keinen zusätzlichen Vortragsbestand. Eigene Nachbereitung wird nur nach
Bestätigung in die bestehenden persönlichen Notizen/Aufgaben geschrieben. Gespeichert werden
bereitgestellter Nutzertext und Kennungen/Fassungen, keine automatisch kopierten Quellwerte,
Quelltitel, Rechenwege oder Prüfberichte. Vor dem Speichern prüft derselbe Auswertungsweg
aktuelle Lesbarkeit und Zuordnung erneut. Stabile Vorgänge erlauben Wiederholen nach
Antwortverlust ohne Doppelnotiz/Doppelaufgabe. Eine erfolgreiche Notiz kann bei anschließendem
Aufgabenfehler bestehen bleiben; Wiederholen verwendet genau diese Notiz weiter.

## Originalkriterien und offene Abnahme

1. Notizen/Übergänge/Zeit, ausdrücklich gestartete Textprobe, Leitfragen, gebundene
   Detailfolien und bereitgestellte Nachbereitung sind am vorhandenen Anhangweg umgesetzt.
   Vollständiger PP-05/07-Fassungsweg und echte Audio-/Hostprüfung bleiben getrennte Voraussetzungen.
2. Rückfrage zur Zahl und Erklärlücke sind über echte App-Routen und montierte Fläche geprüft.
   Eine tatsächliche Browserprobe wird separat berichtet; sie ist keine PowerPoint-Hostabnahme.
3. Gemeinsame Evidenz wird referenziert und über den bestehenden Inspektor vollständig gelesen;
   keine zweite Aussageablage, keine erfundenen fachlichen Werte oder Freigaben.
4. Zustände und Gründe stammen unverändert aus PP-03, getrennt nach Dimension. Rechteentzug,
   falsche Zuordnung, veraltete Datei-/Datenfassung und mehrdeutige Zahlen sind negative Fälle.
5. Kontextbezogener, klappbarer Bereich am bestehenden Anhang. Eigene Textmodule de/en/nl.
   Serverseitige Arbeitsvorschläge/Sprechhilfen bleiben deutsch wie PP-03-Gründe. Kein neues Setup.
   Echte Screenreader-, weitere Browser-/Skalierungs-/Hell-Dunkel-Abnahmen bleiben offen.
6. Basis .1001 wurde nach fester Führungsbindung regulär auf .1002 vorgeführt. PP-03 ist dort
   vorhanden. N/PP-05 und P/PP-07 werden nur mit konkreten festen Elternständen gebunden.
   Importierter Capture-Text, native PowerPoint-App und PowerPoint-Web sind hier nicht angeschlossen.
   Notizen werden noch nicht in die native PPTX-Notizseite oder einen Export zurückgeschrieben.
7. Eigenprüfungen sind keine unabhängige Ben-Abnahme. Integration, unabhängiges Urteil,
   Providerabschluss, passende Livefassung, native Installation und zentraler B1-Abschluss
   liegen bei der vorhandenen Führung und sind für PP-08 nicht behauptet.

Gezielte Belege: `pp08-vortrag.test.ts`, `pp08-vortrag-flaeche.test.tsx`,
`pp08-vortrag-browser.test.tsx`; die bestehende PP-03-Anschlussfläche prüft den eng betroffenen
Inspektor/Fokus-/Setup-Weg. Vollständige tatsächliche Logs, Negativa und Grenzen stehen im
Q/ARBEIT-Übergabebündel. Historische PP-01/02/03-Belege bleiben erhalten und werden nicht
als neue Gesamtprüfung ausgegeben.

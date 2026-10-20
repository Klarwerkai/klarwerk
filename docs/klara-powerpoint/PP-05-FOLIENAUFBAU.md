# PP-05 · Aus Daten bearbeitbare Präsentationen entwickeln

Original `produkt:20261015:klara-powerpoint-folien-aufbau`, Revision 1, acht Originalkriterien.
Vertrag samt unveränderter History und Produktquellen vom 12./14.10.2026 sind im zugeordneten
N-Arbeitspaket erhalten. Startbasis .1001 / `3ba2c457d4b03b1581d789fe816417678f35e68e`, dann die von
der Führung fest gebundene .1002 / `3b03ad5ec6b27c760361f43794fee9792fc5d8f0` regulär übernommen.
Keine fremde D/G-/BES-Arbeit übernommen. Keine Versionierung, Veröffentlichung oder Installation
durch N. Der Originalgesamtabschluss bleibt offen.

## Nutzerweg und Umfang

Am bestehenden PPTX-Anhang unter „Im Artikel öffnen“ steht die aufklappbare Kontextaktion
„Folien aus Daten entwickeln“. Ziel, Publikum, Dauer und Titel gehören zum konkreten Deck.
Aus den bestehenden PP-02-Datenpunkten werden 1 bis 12 ausgewählt. Die Vorschau baut die tatsächliche
PPTX im Speicher und öffnet ihre gebundenen Werte erneut. Sie zeigt Gliederung, Werte, Prüfbedarf,
Quellen, Rechenwege, Diagrammskala und Grenzen. Bis zur bewussten Übernahme wird nichts gespeichert.
Eine Änderung der Eingaben verwirft die Vorschau. Die Übernahme hängt neue Folien an die Vorlage;
vorhandene Folien, unabhängige Inhalte, Master und Layoutteile bleiben unverändert.

Die erzeugten Folien enthalten native Texte und Tabellen. Vergleichbare Zahlen können als natives
Säulendiagramm mit eingebetteter editierbarer XLSX-Arbeitsmappe ausgegeben werden. Die Skala umfasst
Null sowie alle Werte. Unterschiedliche Einheiten, Währungen, Zeiträume und unpassende Prozentbezüge
verhindern das Diagramm. Vergleichbarkeit fachlicher Definitionen bleibt eine offene Fachprüfung.
Prognosen tragen ihre Kennzeichnung auch auf Einzelfolie, Tabelle und Diagrammkategorie.

Designvarianten übernehmen das vorhandene Layout/Thema und können die neuen Titel fett setzen.
Der bestehende Office-Fassungsverlauf nimmt die gesamte Änderung zurück. Das ist eine Inhalts- und
Gestaltungsvariante mit Textvorschau; eine visuelle PowerPoint-Voransicht ist nicht belegt.

## Ein Daten-, Prüf- und Speicherweg

* `praesentation-aufbau.ts` wählt vorhandene PP-02-Sichten und PP-03-Kontrollen aus. Keine eigene
  fachliche Validierung, OCR, Berechnung, Datenbank, Assistenz oder Hostanbindung.
* `office-datenfolien.ts` erweitert den W06-Schreibweg mit dem vorhandenen PPTX-Leser. Die Ausgabe
  wird über `uebernimmOfficeFassung` gespeichert, gegen die erwartete Artikelfassung geprüft und
  wieder aus dem Objektspeicher gelesen. Rücknahme bleibt `…/zurueckholen`.
* `routes/praesentation-aufbau-routes.ts` hängt innerhalb von `officeRoutes` an dessen bestehendem
  Schreib-/Sitzungstor. PP-02 stellt dieselbe `datenUmgebung` nun exportiert zur Verfügung. Bestehende
  PP-02-Routen verwenden sie weiter. Der normale Kompositionspunkt übergibt `services.datenpunkte`.
* Text-/Tabellenzellen binden mit PP-02 `binde` an dieselben Datenpunkte. Der interne Parameter
  `datenwert` erlaubt dabei, bereits erfassten OCR-Text als nativen Text auszugeben; Standard und
  externe PP-02-Bindungsroute behalten ihre bisherige Bildbindung. Erkennung gilt dadurch nie als
  fachliche Freigabe. Ein tatsächlicher PP-04-/Bildhostlauf ist separat offen.

## Rechte und Fassungen

Beide neuen POST-Routen `…/folienaufbau/vorschau` und `…/folienaufbau/uebernehmen` verlangen
`ko.create`, vorhandenes Zeilenrecht und direkten Office-Schreibweg. Eine offene Editor-Sitzung
verhindert den Fassungsschritt. Die ganze PP-02-Herkunft muss lesbar sein. Der Zielartikel darf den
Quell-Leserkreis nicht erweitern: Space, Einstufung und Quellleser müssen übereinstimmen; bei
geschützten Objekten zusätzlich der Autor. Das gilt auch für frühere Quellen und Eingaben der
Korrekturhistorie. Komplexere zulässige Rechtekombinationen werden konservativ abgewiesen.

Der Vorschaufingerabdruck bindet Ziel-/Dateifassung, Auftrag, Datenfassungen, Prüfstände und aktuelle
Quellfassungen/Rechte. Er wird bei Übernahme und nach dem Bau frisch ermittelt. Datenkorrektur,
Rechteentzug, geänderte Quelle oder Prüfung erfordern eine neue Vorschau. Der Ziel-CAS bleibt der
vorhandene KO-Dienst. Es gibt keine atomare Transaktion über mehrere Quellartikel: eine gleichzeitige
Änderung unmittelbar nach der letzten Quellenprüfung ist keine belegte globale Sperre.

Ist der Zielartikel zugleich Quelle oder Herkunft einer Eingabe, benennt die Ausgabe bereits vor
Übernahme die nötige neue Aktualitätsprüfung: die Übernahme erzeugt selbst eine neue Quellfassung.
Vorprüfungen bleiben als Belege der ausdrücklich genannten Ausgangsfassung erhalten.

Schlägt nach dem Dateispeichern eine Herkunftsbindung fehl, nennt `bindungenOffen` die betroffenen
Datenpunkte. Ein fehlgeschlagener Readback antwortet mit `PP05_TEILWIRKUNG` und der tatsächlich
übernommenen Fassung. Kein solcher Fall gilt als vollständiger Abschluss. Alle Antworten tragen
`Cache-Control: no-store`.

Die Datei ist eine Momentaufnahme mit lesbaren Belegfolien. Ein Empfänger erhält keine Klarwerkrechte.
Spätere Quell-Rechteänderungen widerrufen bereits kopierte Belege/Dateien nicht. Im historischen Teilstand
`ae10cc6b` war die dynamische Quellenrechtsprüfung erneuter Downloads noch offen. Der getrennte
Nachtrag unten schließt diese Kante im tatsächlichen Object-Downloadcaller. Kein neuer
Synchronisations- oder Freigabeanspruch.

## Fester Deckvertrag für PP-07 und PP-08

Erster fester Port: `fbc1ef39dff20253dacc4c03b86cf4b58bbed9c2`,
`services/app/src/office-datenfolien.ts`, `DeckVertrag` / `GebundenerDeckVertrag`.
Ergänzungen danach sind additiv: optionaler Folientitel, Währung und Prognosekennung.
Der Kontrollzeitpunkt gehört bereits zum ersten festen Port.

```ts
{
  dateiFassung: "<SHA256 der fertigen PPTX-Bytes>",
  deck: {
    vertrag: "klara-pp05-v1",
    plan: { basis: { koId, anhangId, artikelFassung, dateiFassung }, /* PP02/03-Snapshot */ },
    folien: [{ sldId: "258", titel: "Datenübersicht", rolle: "haupt",
               datenpunkte: [{ id: "DP", fassung: 1 }] }],
    bindungen: [{ datenpunktId: "DP", datenFassung: 1, sldId: "258", shapeId: "3",
                 zeile: 2, spalte: 2 }],
    belegfolien: [{ datenpunktId: "DP", datenFassung: 1, sldIds: ["264"] }],
    diagramme: [{ sldId: "263", shapeId: "3", teil: "ppt/charts/…xml",
                 datenpunkte: ["DP", "DP2"], minimum: 0, maximum: 1000 }]
  }
}
```

`dateiFassung` außen entsteht aus den fertigen Bytes. Sie kann nicht im gehashten Paket selbst
stehen. Das eingebettete Manifest `ppt/klara/pp05-<sldId>.json` hält den Snapshot und stabile
Zuordnungen; es ist keine zweite fachliche Ablage. Rollen sind `haupt`, `detail`, `einzelfolie`.
`belegfolien` verknüpft eine Aussage mit ihren Detail-/Quellfolien. Diagramme nennen die nativen
Teile und dieselben Datenpunkte; die PP-02-Fläche liest weiterhin deren gebundene Tabelle/Texte,
keine neue allgemeine Diagramm-Importengine. Manuelle Dateiänderungen aktualisieren das Manifest
nicht automatisch; PP-07 muss die tatsächlichen Bytes gegen den gebundenen Stand prüfen.

## Nachweise und offene Originalkriterien

Die gezielten Testdateien `pp05-folienaufbau.test.ts`, `pp05-folienaufbau-flaeche.test.tsx` und
`pp05-sicherheitsregister.test.ts` prüfen echten lokalen Datei-/API-Speicherweg, kontrollierte
Werte 400 + 600 = 1000 T€, Quellen, Eingabefassungen, Prüfungen, native OOXML-Inhalte, Arbeitsmappe,
Fassungsrücknahme, Vorlagenbestand, Rechte, veränderte Daten, fehlenden Zeitraum, Währungen,
Prognosekennzeichnung und echte Teilwirkungen. Die Fläche verwendet dieselben echten Routen,
ersetzt nur den HTTP-Transport durch `app.inject`; das ist kein Browser-/Hostnachweis.
Bestehende PP-02/03-Tests sichern die ausgegliederte Umgebung und unveränderten Standardbindungen.
Die tatsächlichen kandidatgebundenen Ausführungsprotokolle stehen in der Übergabe, einschließlich
zunächst roter Testvorrichtungen und deren Korrekturen.

Offen bleiben echte neue H01-PowerPoint-Mac-/H02-Web-Bearbeitung mit Speichern/Wiederöffnen,
importierte Datei außerhalb des bestehenden Anhangwegs, visuelle Prüfung der nativen Ausgabe,
echter Screenreader, Audio, PP-04-Bildhostintegration, Zurückrufen bereits lokal gespeicherter Kopien, unabhängiger ursprünglicher Ben, reguläre Integration/Providerabschluss/Liveprüfung und
zentraler B1-Abschluss. Browserlauf H04 ist separat kandidatgebunden zu protokollieren. Grenzen:
1–12 Datenpunkte, kurze native Werte/Bezugsrahmen, 80 Herkunftsknoten, höchstens 160 neue Folien,
bestehende Layoutvorlage mit Standardformat; keine freie Generierung unbelegter Geschichten.

Implementiert, eigengeprüft, unabhängig geprüft, installiert, live und Originalauftrag abgeschlossen
sind getrennte Zustände. Hier wird ausschließlich ein implementierter Teilkern zur Prüfung geliefert.


## Nachtrag · dynamische Rechte am erneuten Dateidownload

Der tatsächliche Caller `objectRoutes.urteile` schützt `/api/objects/:id/raw`,
`/api/objects/:id` (enthält dieselben Bytes als Daten-URL) und `/api/objects/:id/traeger`.
`praesentation-snapshot-recht.ts` ergänzt dort ausschließlich ein UND zum vorhandenen
`beurteileAnhang`/`privatesFolgeprodukt`. Die Kompositionswurzel reicht dieselbe PP-02-
`datenUmgebung` der angemeldeten Person frisch je Anfrage durch. Normale Dateien erhalten
keinen neuen ZIP-Parserlauf; erkannte PP-05-Pakete verwenden die vorhandenen Archivgrenzen.

Für ein PP-05-Deck sind das unveränderte `klara-pp05-v1`-Manifest, echte PP-02-Datenfassungen
(`inFassung`), aktuelle Quell-/Heimat-/Zielartikelrechte (`vollLesbar` über `darfSehen`),
verwendete Eingabefassungen und die tatsächlich gespeicherten Element-/Zellen-/Dateibindungen
nötig. Mindestens eine passende Bindung muss Objektkennung UND SHA256 der ausgelieferten
Bytes bestätigen. Ein bloß kopiertes Manifest oder Belegtext erteilt keine Erlaubnis.
Frühere erhaltene Deckteile folgen ihren bestehenden Dateifassungsbindungen; die Rechte
werden dabei ebenfalls frisch gelesen. Fehlende Eingaben, ungültige Manifeste, nicht mehr
passende native Elemente oder fehlende Dateibindung führen zur normalen 404-Antwort.
Eine als Teilwirkung gespeicherte Datei ohne vollständige Bindung bleibt entsprechend gesperrt.

Der Entzug einer auch nur transitiv verwendeten Quelle sperrt beim nächsten Abruf alle drei
URLs. Status, Fehlerkörper und `Cache-Control: no-store` sind wie bei einer unbekannten
Objektkennung. Berechtigte Leser können die Datei weiterhin abrufen; eine inzwischen
vertrauliche Quelle führt auch bei ihnen zu `no-store`. Unvertrauliche gültige Ausgaben
behalten `private, no-cache, must-revalidate`, damit der nächste Abruf erneut prüft.

`pp05-snapshot-download.test.ts` prüft den echten `buildApp`-Caller, reguläre fiktive Anmeldung,
wirkliche PP-05-Erzeugung/Übernahme und anschließenden Download: Positiv/Entzug/Wiederfreigabe,
berechtigte Gegenprobe, historische Datenfassung/Vorgängerdeck und Zielentzug, umbenannte Kopie
ohne Dateibindung sowie fehlende verwendete Eingabe (gezielte Fehler-Einspritzung). Die vier
bestehenden MIME-/Disposition-Fälle in `object-raw-xss.test.ts` sichern die konkret berührte
gewöhnliche Rohbyteausgabe. Keine Wiederholung der unveränderten 59 Original-Teilbelege.

Der PP-07/08-Transportvertrag und die Erzeugung bleiben unverändert. Eine spätere
Fassungsübernahme muss den vorhandenen Deckvertrag und echte neue PP-02-Dateibindungen erhalten;
keine Rechte werden aus einer verloren gegangenen oder unpassenden Zuordnung erfunden.
Die Änderung gilt ausschließlich den genannten Download-/Rückverweiscallern. Sie behauptet
keine native Hostprüfung, keinen Rückruf bereits heruntergeladener lokaler Kopien und
keine globale Transaktion über mehrere Quellartikel.

## Getrennter Nachtrag: Arbeitsstand beim Breitenwechsel

Der erste tatsächliche PP-05-Browserfall auf `ccfb8759` erreichte den regulären Artikelweg
über Mehr/Anhänge, die Tastaturbedienung und die Vorschau mit 400/600 T€. Beim Wechsel auf
320 px verschwand die Kontextaktion: die getrennten schmalen/breiten AppShell-Bäume montierten
den Inhalt neu und verloren dabei lokale Office-/PP-05-Zustände. Der Lauf blieb rot und wurde beendet.

Die reguläre AppShell verwendet jetzt einen gemeinsamen Baum mit unverändert montierten
Providern, Portal-Anker `<main>`, Inhalts-Modalregion und Inhaltskasten. Nur Kopfband-Props,
Seitenleiste/Drawer und Breitenabstände wechseln. Ein offener Drawer endet beim Verbreitern.
Die shell-losen Rückgaben für `/mobile` und `/begleiter` bleiben unverändert. Kein neuer
Persistenzspeicher, Nachladen oder automatisches Wiederöffnen ersetzt den Zustandserhalt.

Die bestehende montierte Breitenwechselprobe erwartete historisch ein neues Eingabefeld.
Sie verlangt nun dieselben main-, Modalregion- und Eingabeknoten sowie erhaltenen Entwurf,
Antwort/Quelle, eine einzige Modellanfrage und saubere Drawer-Freigabe. Sie scheitert gegen
den alten Shell-Baum und besteht mit der Korrektur; fünf bestehende Shell-/Modalitätsfälle
bestehen ebenfalls. Das sind Komponentenbelege. Der unveränderte PP-05-Browserfall mit
Übernahme/Herkunft/Rücknahme und die visuelle Prüfung bei 320 px warten auf eine neue feste
Ressourcenzuteilung. Vorige PP-05-/Downloadbelege werden dadurch nicht zu neuen Browserbelegen.

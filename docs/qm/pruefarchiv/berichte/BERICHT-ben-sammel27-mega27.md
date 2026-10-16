# Ben-Review Sammel27 / Mega27

Erstellt: 2026-07-26 21:00:06 CEST
Pruefmodus: streng read-only; statische Code-, Diff- und Testinspektion

## Pruefobjekte

- Repository: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Basis/HEAD: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
- Kumulativer Diff: `_relay/patches138/mega27.diff`
- Diff-SHA-256: `ce1af210505b17631911fd0b5ef85d6883def58eaf712ab65bce5b7263d9dc55` - stimmt
- Hand-Bericht: `_relay/hand/outbox/BERICHT-mega27.md`
- Hand-Inhalts-SHA-256: `d90b73f8ea9190e361aa27236396bfc9cdacabf45687603446eb88d5baab8617` - stimmt
- Arbeitsbaum: erwartete, nicht eingecheckte Mega26/Mega27-Aenderungen vorhanden; keine Aenderung durch Ben

## Kurzurteil

Der direkte Bulk-JSON-Import von 12.480 KOs loest im geprueften Stand tatsaechlich
null Modell-, Embedder- oder AI-Worker-Aufrufe aus. Diese Aussage gilt sowohl fuer
den synchronen Import als auch fuer spaetere automatische Verarbeitung: Die KOs
werden ohne `aiCheck` angelegt und weder der Validation-Board-Lesepfad noch die
Retry-Route erzeugen aus einem fehlenden `aiCheck` nachtraeglich einen Auftrag.

Die Kehrseite muss in der Jahresring-Entscheidung explizit bleiben: null
Modellaufrufe bedeuten zugleich null automatische Duplikat- und Konfliktpruefung.
Der Bestand ist nach dem Bulk-Import geladen, aber nicht automatisch AI-geprueft.

Mega27 ist funktional weitgehend korrekt. Es gibt keinen Ship-Blocker, aber einen
realen UI-Randfehler: Ordnernamen mit `/` koennen identische Open-State-Schluessel
wie eine echte verschachtelte Ordnerfolge erzeugen. Zudem ist Hands
Modellaufruf-Inventar rund um Confluence nicht vollstaendig. Deshalb GELB statt
GRUEN.

## Findings

### M27-1 - GELB - Ordner-Open-State kollidiert bei `/` in Confluence-Titeln

**Bereich:** Mega27, Hierarchieanzeige

**Beleg:**

- `apps/web/src/lib/importSelectView.ts:453-468` uebernimmt jeden
  `sourcePath`-Abschnitt unveraendert als `group.key`.
- `apps/web/src/components/ImportPreviewTree.tsx:72-89` erzeugt den
  Open-State-Schluessel per Stringverkettung
  ``${prefix}/${group.key}``.

Damit erhalten beispielsweise der einzelne Ordnername `A/B` und die Hierarchie
`A` -> `B` denselben Schluessel `folder:<scope>/A/B`. Wenn beide Strukturen im
gleichen Import vorkommen, teilen sie ihren Auf-/Zu-Zustand. Auswahlindizes und
Daten werden dadurch nicht vertauscht, aber das Aufklappen einer Gruppe kann die
andere Gruppe mit umschalten.

**Testluecke:** Die neuen Tests pruefen `/` nur im Seitentitel ohne
Ancestor-Pfad. Sie pruefen nicht die Kollision eines Ancestor-Titels `A/B` gegen
die echte Hierarchie `A` -> `B`.

**Fix-Richtung:** Pfadsegmente strukturiert bzw. kollisionsfrei kodieren, etwa
als JSON-Array oder laengenpraefigierte/URI-kodierte Segmente. Dazu ein Test mit
beiden kollidierenden Strukturen im selben Baum.

**Live-/Ship-Relevanz:** kein Ship-Blocker; sichtbarer Randfehler bei legalen
Confluence-Seitentiteln.

### JR-1 - GELB - Modellaufruf-Inventar fuer Confluence ist unvollstaendig

**Bereich:** Jahresring / Hand-Bericht, nicht durch Mega27 neu verursacht

Hands Kernaussage zum direkten Bulk-JSON-Import ist korrekt. Die allgemeinere
Load-Pfad-Tabelle laesst jedoch zwei optionale Modellkanten der
Confluence-Vorbereitung aus:

- `services/app/src/routes/confluence-import-routes.ts:369-378`:
  `/api/admin/import/confluence/select` kann bei einem Prompt
  `reasoner.deriveImportCriteria` aufrufen.
- `services/app/src/routes/confluence-import-routes.ts:532-538`:
  `/api/admin/import/confluence/group` ruft `reasoner.groupCandidates` auf.

Beide Kanten liegen vor dem eigentlichen Apply/Accept und erzeugen nicht pro KO
einen Call. Sie widerlegen deshalb nicht die Null-Call-Aussage fuer
`POST /api/library/import`. Fuer ein vollstaendiges Kosteninventar aller
Confluence-Ladeablaeufe muessen sie trotzdem genannt werden.

**Fix-Richtung:** Lastpfade im Entscheidungsdokument in drei Klassen trennen:
direkter Bulk-JSON-Import, Confluence-Auswahl/Gruppierung und spaetere
AI-Pruefung.

**Live-/Ship-Relevanz:** kein Ship-Blocker; Dokumentations- und
Kostenplanungsgenauigkeit.

### JR-2 - GELB - ModelCapacityError fuehrt pfadabhaengig zu unvollstaendigen Scans

**Bereich:** Jahresring / bestehende Detection-Pipeline

Hands technischer Nebenbefund ist im Kern richtig:

- `services/conflicts/src/overlap-service.ts:402-421` reicht
  `ModelCapacityError` weiter. Dadurch bricht `detectForSubject` den restlichen
  Duplikat-Kandidatenlauf ab.
- `services/app/src/duplicate-detection.ts:100-103` faengt den Fehler erst um
  den gesamten Duplikatlauf.
- `services/conflicts/src/service.ts:281-294` faengt Judge-Fehler hingegen pro
  Konfliktkandidat und setzt den Lauf fort.

Die Formulierung "stumm" ist fuer den normalen AI-Worker jedoch zu weit:

- `services/app/src/ai-check-worker.ts:540-553` merkt sich den Fehler im
  beobachteten Reasoner.
- `services/app/src/ai-check-worker.ts:572-593` liefert anschliessend
  `ok:false`; der AI-Check wird damit als fehlgeschlagen und retry-faehig
  sichtbar.

Wirklich schwach beobachtbar ist die Import-Accept-Kante: Dort kann die
Duplikatpruefung nur eine Warnung erzeugen, waehrend der Accept erfolgreich
bleibt und kein sichtbarer `aiCheck`-Status angelegt wird. Beim Konfliktlauf wird
der pro Kandidat geschluckte Capacity-Fehler dort noch weniger deutlich.

**Fix-Richtung:** Vor einem spaeteren kontrollierten Jahresring-Rescan
einheitliche Capacity-Semantik festlegen: Scan als unvollstaendig markieren,
Fortschritt/Kandidatenzaehler speichern und explizit retrybar machen. Ein
Kapazitaetsfehler darf nicht als vollstaendiger konfliktfreier Lauf erscheinen.

**Live-/Ship-Relevanz:** kein Mega27-Ship-Blocker; vor einer spaeteren
AI-Massenpruefung zu klaeren.

## Direkter Bulk-JSON-Import: Null-Modell-Nachweis

### Aufrufkette

1. `services/app/src/routes/library-routes.ts:146-155` registriert
   `POST /api/library/import`, prueft `ko.create` und ruft ausschliesslich
   `library.importJson` auf.
2. `services/library-analytics/src/service.ts:1215-1252` sanitisiert die
   Eintraege, liest den Bestand, ruft pro Eintrag `koService.create` auf und
   schreibt am Ende den Import-Audit.
3. `services/knowledge-object/src/service.ts:480-567` konstruiert und
   persistiert das KO. Der Create-Pfad ruft weder Reasoner noch
   Duplicate-/Conflict-Detection, Embedder oder AI-Queue auf.

Im Bulk-Pfad fehlen insbesondere alle Trigger
`markAiCheckPending`, `enqueue`, `detectDuplicatesForKo` und
`detectConflictsForKo`.

### Keine verzoegerte automatische Modellkante

- `services/knowledge-object/src/types.ts:171-176`: `aiCheck` ist optional;
  fehlend bedeutet, dass kein Job angelegt wurde.
- `services/app/src/ai-check-worker.ts:220-228`: Die Re-Enqueue-Pruefung
  akzeptiert nur ein vorhandenes, veraltetes `status:"pending"`. Ein fehlendes
  `aiCheck` wird nicht erzeugt.
- `services/app/src/routes/validation-routes.ts:25-43`: Das Validation Board
  reiht nur solche veralteten Pending-Checks neu ein.
- `services/app/src/routes/ko-routes.ts:881-915`: Die manuelle Retry-Route
  akzeptiert nur `failed` oder `pending`; ein KO ohne `aiCheck` endet mit 409.
- `services/app/src/routes/ko-routes.ts:1106`: Auch eine Revision reiht nur
  dann erneut ein, wenn bereits ein `aiCheck` am revidierten KO vorhanden ist.

### Entscheidung fuer 12.480 KOs

**Verifiziert:** Der direkte Bulk-JSON-Pfad erzeugt im geprueften Stand
`0` Modellaufrufe und `0` Embedder-Aufrufe, unabhaengig von 12.480 Eintraegen.

**Ebenso verifiziert:** Er erzeugt dabei keine automatische
Duplikat-/Konfliktpruefung. Diese Aussage muss in Abnahme und Kommunikation
neben der Kostenersparnis stehen.

**Empfehlung vor dem echten Lauf:** Einen schmalen Regressionstest pinnen, der
einen Bulk-Import mit Reasoner-, Embedder-, Detection- und Queue-Spies ausfuehrt
und jeweils `0` Aufrufe fordert. Die aktuelle statische Kette ist eindeutig;
der Test schuetzt sie gegen spaetere Hook-Erweiterungen.

## Hierarchie und Auswahl

### Quellpfad-Ehrlichkeit - GRUEN

- `services/confluence/src/rest-client.ts:38-59` fordert `ancestors` explizit
  an.
- `services/confluence/src/mapper.ts:37-53` erzeugt `sourcePath` nur aus
  vorhandenen, nichtleeren Ancestor-Titeln.
- Fehlen Ancestors oder sind alle Titel leer, wird das Feld nicht gesetzt.
- Es wird weder aus dem Dokumenttitel noch aus `/` im Titel ein Ordner
  erfunden.
- `services/library-analytics/src/select.ts:254-290` reicht den Pfad nur weiter,
  wenn er tatsaechlich nichtleer ist.

### Eintraege ohne Pfad - GRUEN

`apps/web/src/lib/importSelectView.ts:420-469` haengt Eintraege ohne
`sourcePath` direkt an den Quellen-Container (`sourceScope`). Es gibt keinen
erfundenen Ordner "Sonstiges". Die neuen Pure- und Mounted-Tests pinnen dieses
Verhalten.

### Tiefe Hierarchie und Tri-State - GRUEN

- Der Baum wird rekursiv aufgebaut und gerendert.
- Jede Ancestor-Gruppe sammelt in `rows` ihren vollstaendigen Unterbaum.
- Der Gruppen-Checkbox-Zustand wird damit aus allen Nachfahren berechnet.
- Der Mounted-Test prueft vier Ebenen sowie einen indeterminierten Root-Zustand.

### Bindung an Originalindizes - GRUEN

`PreviewRow.index` bleibt der Ursprungsindex. Sortierung, Gruppierung und
Filterung erzeugen keine neuen Positionsindizes. Gruppenaktionen und final
ausgewaehlte IDs referenzieren weiterhin die Originalpositionen. Die Tests
verwenden bewusst nichtsortierte Ursprungsindizes und sind damit aussagekraeftig.

## Alte F1/F2-Anforderungen

### F1: Bulk-Aktionen beruehren Known-Eintraege nicht - GRUEN

`bulkSelectableRows` schliesst sowohl `alreadyImported` als auch
`alreadyQueued` aus. Das gilt fuer globale Auswahl und Gruppenaktionen.
Known-Eintraege werden nicht neu ausgewaehlt oder an Apply weitergereicht.

### F2: "Alle abwaehlen" leert auch versteckte Auswahl - GRUEN

`clearAllSelected` setzt das gesamte Checked-Array auf `false`, nicht nur die
aktuell sichtbaren Zeilen. Wenn die UI die Aktion "Alle abwaehlen" anbietet,
werden daher auch durch Filter verborgene Markierungen entfernt.

## Filter-Umbau

### Datenabhaengige Aequivalenz - GRUEN

Der alte Schalter `hideImported` entfernte sowohl bereits importierte als auch
bereits eingereihte Eintraege. Der neue Statuswert `new` verwendet dieselbe
Bedingung `!alreadyImported && !alreadyQueued`.

Der alte Chip "Alle" bedeutete keine Statusfilterung. Das entspricht der neuen
leeren Statusauswahl. Die Einzelzustaende importiert/eingereiht/neu bleiben
ueber dieselben Pradikate erreichbar.

Nicht mehr darstellbar sind lediglich widerspruechliche Alt-Kombinationen wie
"Chip importiert" plus gleichzeitig "Importierte ausblenden", die
notwendigerweise eine leere Ansicht erzeugten. Das ist keine verlorene
fachliche Filtermenge.

### Auswahl- und Refresh-Semantik - GRUEN

- Bekannte Eintraege bleiben initial abgewahlt.
- Ausgewaehlte IDs bleiben an Originalindizes gebunden.
- Die Latest-wins-Sicherung bleibt im Preview-Request-Pfad erhalten.
- Die bestehende debounced Live-Aktualisierung fuer serverseitige Kriterien
  bleibt unveraendert.
- Lokale Facetten filtern nur die bereits geladene Vorschau und starten keinen
  zusaetzlichen Import- oder Modellpfad.

## Testehrlichkeit

Die Hierarchie-Tests sind fuer fehlenden Pfad, keine Pfaderfindung, tiefe
Rekursion, Tri-State und Originalindex-Bindung konkret und wuerden bei einem
Rueckbau der jeweiligen Logik rot.

Die Filtertests enthalten teilweise Source-Pins fuer Latest-wins und
Live-Refresh statt ausschliesslich verhaltensbasierter Proben. Die zugrunde
liegende Produktionslogik ist im Diff jedoch unveraendert und statisch
nachvollziehbar.

Nicht abgedeckt sind:

- kollidierende Open-State-Schluessel bei `/` in Ancestor-Titeln;
- ein expliziter Null-Reasoner-/Null-Queue-Test fuer Bulk JSON;
- die Sichtbarkeit eines unvollstaendigen Import-Accept-Scans bei
  `ModelCapacityError`.

## Trennung Mega27 / Jahresring

### Mega27

- Hierarchiequelle, no-path-Darstellung, Rekursion, Tri-State und Indexbindung:
  korrekt.
- F1/F2 sowie Filterersatz: korrekt.
- Offener Randfehler: kollidierende Folder-Open-State-Keys bei `/`.
- Kein Mega27-Ship-Blocker.

### Jahresring

- Direkter Bulk-JSON-Import von 12.480 KOs: null Modell-/Embedder-Aufrufe.
- Konsequenz: null automatische Duplikat-/Konfliktpruefung.
- Confluence-Auswahl/Gruppierung besitzt optionale, im Hand-Inventar fehlende
  Modellkanten.
- Ein spaeterer AI-Rescan braucht vorab Budgetierung und eine ehrliche
  Incomplete-/Retry-Semantik bei Capacity-Fehlern.

## No-op-Nachweis

- Kein Produktcode geaendert.
- Kein Patch angewandt.
- Kein Build und keine Tests ausgefuehrt.
- Kein Commit, kein Push, kein Deploy.
- Kein Jira-Zugriff.
- Keine Secrets oder ENV-Werte gelesen oder ausgegeben.
- Ausgefuehrt wurden ausschliesslich lesende Datei-, Git-, Such- und
  Hash-Pruefungen sowie das Schreiben dieses angeforderten Berichts.

GESAMTVERDIKT: GELB
SHA-256: 748f3ea97d3e6ffd502251da5372fef554525b561ed4dfe37b02855444801192

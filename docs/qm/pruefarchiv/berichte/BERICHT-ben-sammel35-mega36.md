# BERICHT ben sammel35 - Gegenpruefung mega36

Erstellt: 2026-07-27 16:35:36 CEST
Pruefrolle: ben, unabhaengige read-only Gegenpruefung
Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
Basis/HEAD: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
Gegenstand: `_relay/patches147/mega36.diff` (mega26 bis mega36)

## Findings zuerst

### ROT-1 - Native Ausgaenge umgehen das Quellenaufloesungs-Gate

Die neue Ableitung wird bei nativer Kopie, Ausschneiden und Ziehen zwar
aufgerufen, aber zu frueh. Sobald `/api/ask` geantwortet hat, ist der
Antwortkoerper sichtbar. Die Quellentitel werden erst danach asynchron geladen:

- `currentAskSourcesResolved` ist bis zum Abschluss `false`;
- die beiden Schaltflaechen bleiben deshalb korrekt gesperrt
  (`apps/web/public/word-addin/taskpane.html:1389-1400`);
- `handleAnswerClipboard` und `handleAnswerDragStart` pruefen diesen Zustand
  jedoch nicht (`:1757-1804`).

Bei Cmd+C, Kontextmenue, Cmd+X oder Drag vor Abschluss der Aufloesung ruft der
Code `composeOutputText` mit leeren `currentAskSourceTitles` auf. Der zentrale
Builder ersetzt die fehlenden Titel dann durch den generischen Namen
`KLARWERK` (`apps/web/src/lib/wordAddin.ts:359-368`). Die Antwort verlaesst das
Panel also bereits, obwohl die konkrete Quellenzeile noch nicht vollstaendig
ist.

Beim Kopieren/Cut erscheint nachtraeglich ein Pending-Hinweis. Das heilt die
bereits gefuellte Zwischenablage nicht. Beim Drag-Pfad erscheint nicht einmal
dieser Hinweis. Fehlt beim nativen Copy-Event `clipboardData`, zeigt der Code
ebenfalls sofort den bereits abgeleiteten Text mit dem generischen Titel im
Fallbackfeld, statt auf die Quellen zu warten.

Das widerspricht der vorhandenen Invariante unmittelbar neben dem Button-Gate:
"die Quellen-Zeile darf nie halb geladene Titel tragen"
(`taskpane.html:1395-1397`). Die neuen Tests loesen vor jeder Ausgabe zuerst
`quellenAufloesen()` aus; der Zustand ist ungetestet
(`tests/app/mega36-word-ausgaenge.test.tsx:184-191`). Auch der Browser-Smoke
wartet auf den aktivierten Copy-Button und damit auf die Aufloesung
(`tests-smoke/word-taskpane-kopieren.spec.ts:91-96`).

**Auswirkung:** Aufgabe 6 "Klara in Word" kann eine scheinbar quellengebundene
Antwort mit nur `Quelle: KLARWERK` statt der tatsaechlichen Belege exportieren.
Das trifft unmittelbar Aufgabe 7, das eigene Vertrauensurteil.

**Minimaler Abschluss vor Ship:** Fuer eine ganze Auswahl muessen Copy, Cut und
Drag bei `currentAskSourcesResolved === false` fail-closed bleiben:

1. kein Text in Clipboard/DataTransfer schreiben;
2. Cut darf den Koerper nicht entfernen;
3. Default-Export verhindern;
4. sichtbar "Quellen werden noch geladen - noch nicht kopiert" melden;
5. erst nach Aufloesung `composeOutputText` ausgeben.

Ein montierter Test und der Browser-Smoke muessen genau das Zeitfenster
abdecken. Erst danach ist der in mega35 eingefuehrte Quellen-Gate-Vertrag fuer
alle Ausgaenge gleich.

### GELB-2 - Die Zahl "neun Ausgaenge" ist keine belastbare Vollstaendigkeitszahl

Ich finde keinen zusaetzlichen produktdefinierten Netz-, Datei-, Print-,
Share-, Download- oder zweiten Fenster-Sink fuer den Antworttext. Der
Negativ-Sweep der Hand ist fuer den Quelltext korrekt.

Die Zahl neun mischt jedoch unterschiedliche Zaehlebenen:

- `Word.run` und `setSelectedDataAsync` werden als zwei Ausgaenge gezaehlt;
- Tastatur und Kontextmenue werden trotz desselben `copy`-Events als zwei
  Ausgaenge gezaehlt;
- das Fallback-`textarea` wird als ein Ausgang gezaehlt, seine eigenen nativen
  Copy-, Kontextmenue- und Drag-Wege dagegen nicht.

Das neue read-only Fallbackfeld (`taskpane.html:202-205`) hat keine eigenen
Eventhandler. Sein vollstaendig vorausgewaehlter Wert ist bereits korrekt
abgeleitet, sodass eine Vollauswahl sicher ist. Eine Nutzerin kann dort aber
auch nur einen Teil markieren oder ziehen; dieser weitere rohe Fragmentweg ist
in der Aufzaehlung und in der benannten Ausnahme nicht enthalten.

Damit ist die sicherheitsrelevante Aussage nicht "exakt neun", sondern:
Alle gefundenen **vollstaendigen** Antwortausgaben muessen entweder
`composeOutputText` durchlaufen oder aus einem bereits dadurch erzeugten
read-only Volltext stammen. Diese Aussage ist nach Behebung von ROT-1
tragfaehig. Die numerische Neun sollte nicht als Architekturbeweis verwendet
werden.

### GELB-3 - Die benannte Teilausnahme schweigt beim Drag

Fuer eine partielle Copy-/Cut-Auswahl zeigt `handleAnswerClipboard`
`askCopyPartial` (`taskpane.html:1763-1766`). Fuer eine partielle
Drag-Auswahl kehrt `handleAnswerDragStart` dagegen kommentarlos zurueck
(`:1795-1803`). Der Browser/Host darf dann das rohe Fragment transportieren,
ohne den im Kommentar versprochenen Hinweis.

Die Ausnahme selbst ist vertretbar: Ein Satzfragment braucht nicht jedes Mal
einen Metablock. Falsch ist nur die Aussage, die Oberflaeche benenne sie bei
jedem Ausgang. Fuer Freitag ist dies kein eigener Blocker, sollte aber mit
ROT-1 entweder vereinheitlicht oder im Kommentar korrekt eingeschraenkt werden.

## 1. Artefakte und Umfang

- Inhalts-SHA des Hand-Berichts nach der geforderten Methode verifiziert:
  `8c89024761d3aacfa30048cea877a383edcdc8f70c188a895742e956235ccf46`.
- Gewoehnlicher Datei-SHA des Berichts ist abweichend, weil er die letzte
  Hashzeile mit einschliesst; das ist erwartbar.
- Diff-SHA verifiziert:
  `311b7b6ec6d416de6c75662b19d510313f85e0ab66a911f5a78747c7d97d0d1d`.
- Aus mega35 ist kein Diff-Block verschwunden.
- Genau zwei Dateien sind neu:
  `tests/app/mega36-word-ausgaenge.test.tsx` und
  `tests-smoke/word-taskpane-kopieren.spec.ts`.

## 2. Ausgangsinventur

### Verifizierte Code-Sinks

Die unabhaengige Suche findet sechs technische Antwort-Sinks:

1. `Word.run(...insertText...)`;
2. `Office.context.document.setSelectedDataAsync`;
3. `navigator.clipboard.writeText`;
4. `ClipboardEvent.clipboardData.setData` fuer Copy/Cut;
5. `DragEvent.dataTransfer.setData`;
6. das read-only Fallback-`textarea`.

Die ersten fuenf verwenden fuer vollstaendige Antworten
`composeOutputText`; der sechste erhaelt seinen Wert aus demselben bereits
abgeleiteten Text. Es gibt keinen `navigator.share`, Blob/Download,
`createObjectURL`, `postMessage`, `messageParent`, Storage- oder
produktdefinierten Printpfad.

### Kein "zehnter" unabhaengiger Produktsink, aber ausgelassene Varianten

Entwicklerwerkzeuge, Screenshot, Vorlesefunktion und Betriebssystemdienste
sind keine vom Produkt kontrollierten Antwort-Sinks. Sie koennen sichtbaren
Text naturgemaess lesen, sind aber nicht sinnvoll durch einen
Anwendungs-Composer zu erzwingen.

Der Fallbackfeld-Fragmentweg und der Quellen-pending-Zustand zeigen dennoch,
dass die Aktionsliste nicht vollstaendig genug ist, um aus ihrer Zahl ein
Ship-Argument abzuleiten. Der sicherheitsrelevante neue Befund ist ROT-1.

## 3. Ganze gegen teilweise Auswahl

GRUEN. `answerSelectionIsWhole` vergleicht den getrimmten Slice mit dem
getrimmten Feldwert (`apps/web/src/lib/wordAddin.ts:525-532`).

- Eine echte Teilmenge mit fehlenden Nicht-Leerraumzeichen kann nicht als ganz
  gelten.
- Weggelassene Zeilenumbrueche oder Leerzeichen ausschliesslich am Anfang/Ende
  gelten bewusst als ganze Koerperauswahl.
- Eine leere Auswahl bei nichtleerem Feld ist `false`.
- Ein nur aus Leerraum bestehender Koerper ist `false`.
- Umgedrehte Indizes werden durch `min/max` korrekt behandelt.
- Indizes ausserhalb des Feldes werden auf `0..value.length` begrenzt.
- Im realen `textarea` bleiben `selectionStart/selectionEnd` ohnehin an den
  Feldwert gebunden, auch wenn die Maus ueber den sichtbaren Feldrand gezogen
  wird.

Ich finde keine Auswahl, die echten Inhalt auslaesst und dennoch als ganz
klassifiziert wird. Ebenso finde ich keinen normalen Textarea-Fall, in dem der
gesamte Inhalt wegen eines abschliessenden Zeilenumbruchs faelschlich als
Teilauswahl gilt.

## 4. Idempotenz

### Normaler Wieder-Einfuegefall: GRUEN

`stripComposedMetaLines` entfernt einen am Ende stehenden, in der aktuellen
Sprache exakt erkennbaren Metablock und setzt ihn anschliessend neu
(`wordAddin.ts:446-510`). Der neue End-to-End-Gegenfall prueft echte
Ausgabe -> Rueckpaste -> erneute Ausgabe und pinnt Zeichenidentitaet. Damit ist
mein mega35-Doppelfund fuer diesen realistischen Standardfall geschlossen.

### Benannte Grenzen: sachlich richtig, bewusst nicht idempotent

- Steht eine Einstufungs- oder Quellenzeile mitten im Koerper, bleibt sie
  erhalten; am Ende wird der aktuelle Metablock zusaetzlich angehaengt.
- Ein Metablock in einer anderen Sprache wird nicht erkannt und bleibt neben
  dem aktuellen Sprachblock stehen.

Das ist die sicherere Richtung als ein sprachuebergreifender, grosszuegiger
Loeschfilter, der Nutztext entfernen koennte. Im normalen Freitagspfad entsteht
keine dieser Situationen: Das Feld beginnt mit dem reinen Antwortkoerper.
Realistisch werden sie erst, wenn ein bereits vollstaendig ausgegebener Text
wieder eingefuegt, danach unterhalb des Metablocks weitergeschrieben oder die
Sprache gewechselt wird.

Der Hand-Smoke Schritt 9 prueft nur dieselbe Sprache ohne nachtraeglichen Text;
Schritt 11 sollte deshalb jeweils mit einer frischen Antwort beginnen. Die
beiden Grenzen sind Post-VIP-Haertung, kein Grund, den Mittwoch-Ship allein
aufzuhalten.

Zusatz: Das Quellen-Template nutzt `.*` fuer Titel und Datum. Eine
nutzerverfasste letzte Zeile, die zufaellig exakt wie eine KLARWERK-Quellenzeile
geformt ist, kann ebenfalls entfernt werden. Das ist eng, aber als
nachgelagerter Testfall zu dokumentieren.

## 5. Rueckfall DE/EN/NL

GRUEN fuer den vorgesehenen Volltextfall.

- Die drei alten Saetze, die zum manuellen Kopieren des rohen Antwortfeldes
  aufforderten, sind im aktuellen Taskpane byteweise nicht mehr vorhanden.
  Sie erscheinen nur noch als entfernte Minuszeilen im kumulativen Diff.
- `#ask-copy-fallback-text` ist mit `readonly` versehen
  (`taskpane.html:202-205`).
- `showCopyFallback` setzt den bereits abgeleiteten Text, fokussiert das Feld
  und selektiert `0..text.length` (`:1728-1740`).
- `askCopyFail` und `askCopyFallbackHint` sind in DE, EN und NL vorhanden und
  weisen auf den vollstaendigen Text hin.
- Reset und erfolgreicher Button-Copy raeumen den alten Fallback.

Der Quellen-pending-Fall aus ROT-1 bleibt davon unberuehrt: Ein abgeleiteter
Text kann trotzdem zu frueh nur den generischen Systemnamen tragen.

## 6. Kommentar gegen Laufzeit

Teilweise GRUEN:

- Der Kommentar nennt die fruehere Falschaussage ausdruecklich.
- Er zaehlt Button-Insert, Button-Copy, natives Copy, Kontextmenue, Cut, Drag
  und Fallback auf.
- Er benennt die rohe Teilauswahl.

Nicht vollstaendig:

- Die Aufzaehlung mischt Nutzeraktionen und technische Sinks und ergibt daher
  keine stabile Zahl.
- Der native Quellen-pending-Ausgang fehlt.
- Die Aussage, die Oberflaeche benenne die Teilausnahme im Moment, trifft auf
  partielle Drag-Auswahl nicht zu.
- Native Ausgaenge aus dem read-only Fallbackfeld sind nicht erwaehnt.

Der Kommentar ist ehrlicher als mega35, stimmt aber noch nicht vollstaendig mit
der Laufzeit ueberein.

## 7. Browserbeleg

GRUEN als Chromium-Beleg, mit korrekt benannter Grenze.

Der Playwright-Test:

- laedt das echte statische Taskpane;
- benutzt echte Cmd/Strg+A-, Cmd/Strg+C- und Cmd/Strg+V-Tastendruecke;
- prueft den Text nach der Runde in einem anderen Feld;
- kalibriert mit einer rohen Teilauswahl;
- blockiert das Office-CDN und stubbt die same-origin APIs;
- ueberspringt Firefox/WebKit mit einem ausdruecklichen Grund.

Der Rot-zuerst-Vergleich ohne die drei Registrierungen ist fachlich
beweiskraeftig: Ohne Listener gelangt nur der Antwortkoerper in die
Browserzwischenablage. Die gemeldeten Laufresultate habe ich gemaess
read-only-Auftrag nicht erneut ausgefuehrt; die Testkonstruktion selbst misst
den behaupteten Pfad.

Ein Chromium-Lauf beweist nicht Word Mac/WKWebView, das macOS-Kontextmenue oder
die Systemzwischenablage ausserhalb der Engine. Diese Grenze ist tragbar, wenn
der echte Word-Smoke vor Freitag Pflicht bleibt.

## 8. Pruefung der elf Word-Schritte

Die elf Schritte decken nach Behebung von ROT-1 viel ab:

- Kontextmenue und Tastatur;
- Ganz- und Teilauswahl;
- Cut und Drag;
- beide Schaltflaechen;
- Clipboard-Fallback;
- Idempotenz;
- beide Grade;
- DE/EN/NL.

Es fehlt ein entscheidender Schritt:

**Neu vor dem bisherigen Schritt 1:** Eine Antwort mit absichtlich
verzoegerter Quellenauflosung anzeigen. Solange "Kopieren" noch ausgegraut ist,
ganze Auswahl mit Cmd+C, Cmd+X und Drag versuchen.

Erwartung nach dem Fix:

- nichts landet in Zwischenablage oder DataTransfer;
- das Antwortfeld bleibt bei Cmd+X unveraendert;
- es erscheint "Quellen werden noch geladen - noch nicht kopiert";
- nach Aufloesung enthalten alle Wege die echten Quellentitel, niemals nur den
  generischen Titel `KLARWERK`.

Zusaetzlich sollte Schritt 11 jede Sprache mit einer frischen Antwort starten,
damit die bewusst benannte sprachgebundene Idempotenz nicht unbeabsichtigt zum
Testfehler wird.

## 9. Sieben Testaufgaben und Ship-Entscheidung

- Aufgaben 1 bis 5: Im mega36-Scope kein neuer Blocker.
- Aufgabe 6 "Klara in Word": **blockiert durch ROT-1**.
- Aufgabe 7 "eigenes Urteil": **mitbetroffen**, weil die konkrete
  Quellenzuordnung vorzeitig fehlen kann.

Die Teilauswahl- und sprachgebundenen Idempotenzgrenzen koennen nach dem
VIP-Test gehaertet werden. Der Quellen-pending-Ausgang kann nicht warten, weil
er die zentrale Quellenbindung im sicheren Testpfad beruehrt.

**Kein Ship-GO fuer den vorliegenden Stand.** Erforderlich ist ein kleiner
mega37-Abschluss fuer das Quellen-Gate aller nativen Ausgaenge, die partielle
Drag-Meldung und die entsprechende Test-/Kommentarangleichung. Danach reicht
der ergaenzte echte Word-Smoke; eine weitere breite Suchrunde ist aus diesem
Review nicht begruendet.

## 10. No-op-Nachweis

- Kein Produktcode, keine Konfiguration und keine bestehende Datei geaendert.
- Genau eine verlangte Berichtdatei wird neu geschrieben.
- Kein Build, kein Test, keine App und kein Server ausgefuehrt.
- Ausschliesslich lesende Shell-/Git-Befehle verwendet.
- Kein `git add`, kein Commit, kein Push und kein Jira-Zugriff.
- Preflight:
  - HEAD `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`;
  - Working-Tree-Signatur
    `3a2096d387991016bd922ecbd284f56255b4693f3698579f222d322c2c5e340c`;
  - Produktdiff-Signatur
    `2907ba47abfacb32cdd4d554966f2e050abebe0ef25ada6924b3d08e48e29cfb`;
  - Indexdiff leer:
    `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Diese Signaturen werden nach Ablage des Berichts erneut geprueft.

GESAMTVERDIKT: ROT
SHA-256: 0f67319f36de8f41b68ae3f879c0fd38d42da1ada79bbcfc2ed21f71e3213435

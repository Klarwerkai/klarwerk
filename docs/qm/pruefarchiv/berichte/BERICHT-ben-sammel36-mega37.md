# BERICHT ben sammel36 - Gegenpruefung mega37

Erstellt: 2026-07-27 18:11:12 CEST
Pruefrolle: ben, unabhaengige read-only Gegenpruefung
Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
Basis/HEAD: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
Gegenstand: `_relay/patches148/mega37.diff` (mega26 bis mega37)

## Kurzurteil

**Mega37 schliesst den ROT-Befund aus sammel35 fuer die regulaeren Copy-, Cut-
und Drag-Ereignisse. Der Gesamtstand ist trotzdem noch nicht auslieferungsreif.**

Vor Mittwoch bleiben drei reale Stopper:

1. `/fragen` scrollt nach einer Antwort weiterhin nicht zum Ergebnis und zeigt
   am Ergebnisort keinen Ladezustand. Der live gemessene Erstnutzerfehler ist
   im Arbeitsbaum nicht repariert.
2. Der Drag-Handler bleibt bei fehlendem `dataTransfer` fail-open: kein
   `preventDefault`, keine Meldung, keine strukturelle Garantie gegen den rohen
   Standard-Drag.
3. Die live sichtbaren E2E-/Loeschtest-Objekte und doppelten Importe werden
   durch keinen Code in mega37 bereinigt. Das ist ein operativer
   Vor-Test-Pflichtschritt.

Zusaetzlich ist `npm run smoke:ui` weiterhin kein belastbarer Schnelltest nach
Quellaenderungen, weil der Befehl das von ihm ausgelieferte `apps/web/dist`
nicht selbst baut oder seine Frische prueft.

## 1. Artefakte und Dateiinventar

### Hashes

- Inhalts-SHA des Hand-Berichts nach der verlangten Methode verifiziert:
  `950ec5e9ad8d34717388059e8acfc1dd8c1e1e73300d94f7983dc0d7932c64cc`.
- Diff-SHA verifiziert:
  `5ed9e1f733c0e1f67f417f51ff92981ff2a416eeeb45a95fc09737a651370cd8`.
- Hand-Bericht und Diff sind byteweise NUL-frei.

### Die identische 151er-Liste ist korrekt

Die drei unabhaengig gebildeten, sortierten Pfadlisten haben denselben SHA:

`5699d479614b1225aca75b70a9bbb6db06f11dd2f57b58bb0e10c3e81b6e2bd3`

Das gilt fuer:

- `_relay/patches147/mega36.diff`: 151 Pfade;
- `_relay/patches148/mega37.diff`: 151 Pfade;
- den produktrelevanten Arbeitsbaum gegen `d3fe69d`: 151 Pfade.

`comm` liefert in keiner Richtung eine Abweichung. Insbesondere gibt es keine
Produkt- oder Testdatei im Arbeitsbaum, die mega36 noch nicht kannte und im
mega37-Diff fehlt. Die sechs neuen jsdom-Faelle stehen in der bereits
vorhandenen Datei `tests/app/mega36-word-ausgaenge.test.tsx`; die
Playwright-Sonde steht in der bereits vorhandenen Datei
`tests-smoke/word-taskpane-kopieren.spec.ts`.

Damit ist der identische Dateisatz diesmal kein versteckter Artefaktverlust.

## 2. Quellen-Tor und Auswahlraender

### Regulaere Vollausgabe: GRUEN

Das Tor steht in beiden nativen Handlern vor Textbildung und vor dem Zugriff
auf Clipboard beziehungsweise DataTransfer:

- Copy/Cut: `taskpane.html:1788-1807`;
- Drag: `taskpane.html:1847-1854`.

Bei nicht aufgeloesten Quellen wird der Standardvorgang verhindert, es wird
nichts in den Behaelter geschrieben, Cut veraendert das Feld nicht und die
Oberflaeche meldet den Wartezustand. Der Copy-Fallback wird ebenfalls erst
nach dem Tor erreicht. Damit ist der konkrete sammel35-Fall
`Quelle: KLARWERK` vor abgeschlossener Titelaufloesung fuer diese Wege
geschlossen.

Nach der Aufloesung laeuft die ganze Auswahl weiter ueber
`composeOutputText`; der echte Quellentitel wird eingesetzt.

### Auswahlraender: GRUEN

Die Vorschaltung der Teilauswahl hebelt das Tor nicht aus:

- zusammengefallener Cursor bei nichtleerem Feld: `answerSelectionIsWhole`
  ist `false`; der Vorgang bleibt die rohe, leere Teilauswahl und gibt keinen
  Volltext aus;
- Auswahl nur aus Leerraum: ebenfalls `false`; maximal dieser Leerraum bleibt
  roh;
- Feld selbst nur aus Leerraum: der Handler kehrt bereits an der
  Leerkoerper-Pruefung zurueck;
- gesamter getrimmter Koerper, waehrend Quellen laden: `true`, danach greift
  zwingend das Quellen-Tor;
- umgebende Leerzeichen oder Schlusszeilen duerfen fehlen, echter Nutztext
  dagegen nicht (`taskpane.html:603-608`,
  `apps/web/src/lib/wordAddin.ts:525-532`).

Der Rand mit leerer Auswahl zeigt zwar den allgemeinen Teilauswahl-Hinweis,
aber er exportiert keinen Inhalt und ist kein Sicherheitsbypass.

## 3. ROT - Drag ohne DataTransfer bleibt fail-open

Der von der Auftraggeberin markierte Zweig ist real im Code:

```js
var daten = ev.dataTransfer || null;
if (!daten || typeof daten.setData !== "function") { return; }
```

`taskpane.html:1855-1857`.

Der DOM-Typ selbst ist nullable
(`node_modules/typescript/lib/lib.dom.d.ts:10512-10518`). Bei einem
konformen, nutzerinitiierten Browser-Drag ist ein `DataTransfer` normalerweise
vorhanden. Der Zweig ist aber fuer synthetische Ereignisse sicher erreichbar;
das Verhalten eines Word-/WKWebView-Hosts ohne Schnittstelle ist nicht
belegt.

Entscheidend ist die statische Wirkung: Der Handler kehrt ohne
`preventDefault` und ohne Hinweis zurueck. Damit darf der Host seinen
Standard-Drag fortsetzen. Fuer eine Textauswahl kann das der rohe
Antwortkoerper sein. A1 und A3 sind an diesem Rand folglich nicht
strukturell garantiert.

Kein Test pinnt diesen Zweig. Alle Drag-Tests befestigen einen
`setData`-faehigen Behaelter am Ereignis. Auch Handpruefung Schritt 7 kann nur
beobachten, was der konkrete Host tut; sie ersetzt den einfachen
Fail-closed-Vertrag nicht.

**Erforderlich vor Ship:** Wenn `dataTransfer` oder `setData` fehlt,
`preventDefault`, nichts schreiben und denselben ehrlichen
Nicht-ausgegeben-Hinweis zeigen. Ein Test muss `dataTransfer=null` und
fehlendes `setData` abdecken.

## 4. Hinweise und Meldungen

### Teilauswahl: GRUEN

Copy, Cut und Drag rufen bei einer echten Teilauswahl denselben Key
`askCopyPartial` auf (`taskpane.html:1783-1786` und `1839-1845`). Drag bleibt
bewusst ungebremst. Die Ausnahme und ihre sichtbare Benennung sind damit
vereinheitlicht.

### Wartemeldung: GELB

Der Schlusssatz ist in DE/EN/NL jetzt ausgangsneutral:

- DE: "es erneut versuchen";
- EN: "try again";
- NL: "probeer het opnieuw".

Der fuehrende Satz bleibt jedoch "NOCH NICHT kopiert", "NOT copied yet" und
"NOG NIET gekopieerd" (`taskpane.html:763,851,939`). Dieselbe Meldung wird
beim blockierten Ziehen gezeigt, obwohl dort nichts kopiert werden sollte.
Die Behauptung des Hand-Berichts, der Wortlaut sei fuer alle drei Wege
ausgangsneutral, ist daher nur teilweise richtig.

Die Erfolgsmeldung `askCopyNativeOk` wird nur nach Copy/Cut gezeigt, nicht
nach Drag. Ihr Wort "Kopiert" ist auf den Wegen, auf denen sie tatsaechlich
erscheint, korrekt. Fuer den Wartezustand sollte der gesamte Text neutral
lauten, etwa "Noch nicht ausgegeben".

## 5. Kommentar Block D

Der Kommentar ist wesentlich ehrlicher als mega36:

- er nennt gefundene statt beweisbar vollstaendige Ausgaenge;
- er verwirft die Zahl als Architekturbeweis;
- er benennt die Teilauswahl im Antwortfeld;
- er benennt separat die Teilauswahl im read-only Fallbackfeld.

Die zweite Ausnahme ist keine neue semantische Regel, aber eine eigene
UI-Flaeche ohne eigene Handler. Sie ist deshalb als zweite Fundstelle
sinnvoll und nicht bloss eine doppelte Formulierung.

Eine Aussage bleibt zu weit:

> "alle nativen Wege stehen ... hinter dem QUELLEN-TOR - solange
> currentAskSourcesResolved === false ist, geht ueberhaupt nichts hinaus"

`taskpane.html:1632-1633`.

Bewusste Teilauswahlen stehen vor dem Tor und duerfen roh hinaus. Gemeint und
belegt ist nur: **keine vollstaendige Antwortausgabe** passiert das Tor. Der
Kommentar sollte genau so eingegrenzt werden. Der nullable-DataTransfer-Zweig
ist eine weitere Grenze der pauschalen Aussage.

## 6. Rot-zuerst- und Browser-Evidence

### Aktueller Gruen-Beleg: tragfaehig

Die aktuelle Quelle und das aktuell ausgelieferte Artefakt sind bytegleich:

`apps/web/public/word-addin/taskpane.html`
und
`apps/web/dist/word-addin/taskpane.html`

haben beide SHA-256
`4875b594ee61a7f9713d417ff6180cc35f6445f225c93db18527ddc5846e7298`.

Das Dist-Artefakt ist zeitlich nach Quelle und Testdateien erzeugt worden.
Der aktuelle Browserbeleg kann daher den heutigen Taskpane-Stand gesehen
haben. Die Sonde kalibriert die echte Zwischenablage mit einem Kennsatz,
haelt die Quellenroute offen, prueft das geschlossene Tor und oeffnet es
danach fuer den echten Quellentitel. Ihre Konstruktion ist beweiskraeftig.

### Historischer Rotlauf: plausibel, aber nicht konserviert

Der protokollierte Rotlauf passt exakt zum alten Codeverhalten und zu den
neuen Assertions. Das historische rote Dist-Artefakt wurde jedoch vom
spaeteren Gruen-Build ueberschrieben; sein Hash ist im Bericht nicht
festgehalten. Ich kann deshalb den damaligen Rotlauf nicht kryptografisch an
einen konkreten Build binden. Das ist eine Beleggrenze, kein Hinweis auf einen
erfundenen Lauf.

### `npm run smoke:ui`: vor Mittwoch reparieren

`package.json:21` startet Playwright unmittelbar. Die Smoke-Konfiguration
serviert den vorhandenen Produktions-Build und dokumentiert selbst
"erwartet gebautes apps/web/dist". Nur `tools/check` ruft vorher
`./tools/build` auf (`tools/check:5`).

Damit kann ein direkter `npm run smoke:ui` nach einer Quellaenderung einen
alten Build gruen pruefen. Da Mittwoch und Donnerstag genau dieser
Schnellaufruf verwendet werden soll, ist das nicht tragbar.

**Vor der Nutzung beheben:** Entweder der Befehl baut explizit vorher, oder
ein vorgeschalteter Frische-/Hash-Check bricht laut ab. Bis dahin darf ein
direktes Gruen nicht als Quellbeleg gelten.

## 7. Erstnutzerbefund gegen den heutigen Arbeitsbaum

### ROT-1 Antwort unterhalb des Viewports: NICHT repariert

`Ask.tsx` besitzt keinen Ergebnis-Ref, kein `scrollIntoView`, kein
`scrollTo` und keinen Fokuswechsel nach `onSuccess`. `onSuccess` setzt nur
Ergebnis, Receipt und Gap (`Ask.tsx:142-151`). Die Ergebnisflaeche beginnt
erst bedingt ab `Ask.tsx:430`.

Auch am kuenftigen Ergebnisort existiert kein Ladeblock. `ask.isPending`
deaktiviert lediglich Submit und Beispielchips (`Ask.tsx:370,409`).

Der live gemessene Zustand "Antwort beginnt bei 674 px in 678 px Hoehe,
Ansicht springt nicht" ist damit im Arbeitsbaum weiterhin die zu erwartende
Wirkung. Aufgabe 3 kann fuer eine Erstnutzerin wie ein erfolgloser Klick
aussehen.

**Muss vor Mittwoch:** sichtbarer Ladezustand an der Ergebnisflaeche und nach
Ergebnis/GAP kontrolliertes Scrollen oder Fokussieren dorthin.

### ROT-2 widersprechende Einstufungen: Kern repariert

Mega33/34 fuehren die Signale in `effectiveAnswer` und `answerGrade` einmalig
zusammen (`answerGrade.ts:54-66`, `effectiveAnswer.ts:104-153`).
Vertragskarte, Status, Evidenz, Review-Waechter, Export und Mobilansicht lesen
diese effektive Einstufung. Bei ungepruefter Antwort:

- steht unten nicht mehr "Gesichert";
- die Evidenzklasse wird zu "Ungeprueft" abgesenkt;
- der Confidence-Balken zeigt weiterhin die Zahl, aber nicht mehr das
  Qualitaetswort "Gesichert" (`Ask.tsx:486-509`).

Der konkrete Live-Widerspruch "Quellengebunden, aber ungeprueft" direkt ueber
"GESICHERT / EVIDENZ: GESICHERT / 99 Gesichert" ist damit im Arbeitsbaum
geschlossen.

Nicht geschlossen ist die Ueberfrachtung: `sourceSummary` zaehlt weiterhin
alle vom Answer-Result gelieferten Quellen, und `result.steps` rendert
weiterhin alle gelieferten Argumentationsschritte (`Ask.tsx:453-474` und
`546-576`). Ob eine Quelle im Antworttext als irrelevant bezeichnet wird,
filtert die UI nicht. Der "8 Quellen"-Eindruck kann daher bleiben, nur ohne
die widersprechenden Sicherheitsplaketten.

### Wortkollision "gesichert": teilweise repariert

- Ask: repariert wie oben.
- KO-Detail: prozentbasierter Confidence-Balken zeigt "84 % sicher" ohne
  das zweite Qualitaetswort (`KoRead.tsx:22-35`).
- Startseite: nicht repariert. Die Live-Wall heisst weiterhin
  "Frisch gesichert", waehrend sie Eintraege mit `StatusPill` auch als
  "Offen" darstellen kann (`Start.tsx:74-76,107-130`;
  `i18n.ts:2237-2243`).

Die Wortkollision ist somit nicht mehr auf der Antwortkarte, aber weiterhin
im ersten Startseitenblick vorhanden.

### ROT-3 Testartefakte: durch Code nicht repariert

Im aktuellen Produktcode gibt es keine Entfernung der live genannten
Objekte. Die Titel "E2E KI-Pending Validierung", "E2E Loeschtest Studio" und
die genannten doppelten Importtitel sind Datenbestand, kein Bestandteil des
mega37-Diffs.

Vor der Testsitzung muessen die Artefakte kontrolliert aus dem Live-Bestand
entfernt beziehungsweise archiviert und die doppelten Importe bereinigt
werden. Danach Startseite und Bibliothek mit dem echten Testkonto erneut
read-only pruefen. Ein Code-Ship allein veraendert diesen Befund nicht.

## 8. Auslieferung nach den sieben Testaufgaben

| Aufgabe | Urteil | Begruendung |
|---|---|---|
| 1 Anmelden und umsehen | ROT | Live-Testartefakte und die Startseiten-Kollision "Frisch gesichert / Offen" beschaedigen den ersten Eindruck; Testkonto noch nicht gegengeprueft. |
| 2 Wissen erfassen und einreichen | GELB | Im geprueften Delta kein neuer Blocker; echter Handlauf mit Testkonto und Datei bleibt erforderlich. |
| 3 Frage stellen und vertrauen | ROT | Antwort bleibt unterhalb des Viewports ohne Scroll und ohne Ergebnis-Ladeflaeche. Die Einstufungs-Kollision ist dagegen repariert. |
| 4 In Bibliothek wiederfinden | GELB | Kernsuche ist laut Live-Befund nutzbar; sichtbare Test- und Dubletten-Daten muessen vorher weg. |
| 5 Word-Dokument hineinbringen | GELB | Einstieg vorhanden, aber echter Datei-/Word-Handlauf ist noch der Beleg. |
| 6 Klara in Word | ROT | Haupttor repariert, aber `dataTransfer=null` bleibt fail-open; zusaetzlich muss der reale Word-/Manifest-Smoke gruen sein. |
| 7 Eigenes Urteil | ROT | Die zentrale Einstufung ist ehrlicher, doch Aufgabe 3 ist ohne sichtbare Antwort nicht durchfuehrbar; irrelevante Quellen/Schritte bleiben sichtbar. |

**Auslieferungsurteil fuer Mittwoch frueh: NO-GO im aktuellen Stand.**

Das ist keine Forderung nach einer weiteren breiten Suchrunde. Es ist eine
enge Abschlussliste:

1. `/fragen`: Ladeflaeche plus Scroll/Fokus zum Ergebnis;
2. Word: fehlendes `dataTransfer` fail-closed und Wartetext vollstaendig
   ausgangsneutral;
3. `smoke:ui`: Build-Frische erzwingen;
4. Live-Bestand aufraeumen und mit dem vorgesehenen Testkonto gegenpruefen.

Danach genuegt ein fokussierter Recheck dieser Punkte plus die Handpruefung.
Alle anderen im Auftrag benannten Nicht-Gegenstaende koennen auf der
Post-Freitag-Liste bleiben.

## 9. Die zwoelf Word-Handschritte

Die neue Reihenfolge ist deutlich besser:

- Schritt 1 prueft genau das vormals fehlende Quellen-Zeitfenster;
- Kontextmenue, Tastatur, Teil- und Vollauswahl, Cut, Drag, beide
  Schaltflaechen, Fallback, Idempotenz, beide Grade und DE/EN/NL sind
  enthalten;
- Schritt 12 beginnt je Sprache mit einer frischen Frage und vermeidet damit
  den bekannten sprachgebundenen Idempotenz-Messfehler.

Zwei Ergaenzungen bleiben noetig:

1. Nach dem Code-Fix ein maschineller Fall mit `dataTransfer=null` und einer
   Schnittstelle ohne `setData`; das ist im Word-Host nicht verlaesslich
   erzwingbar.
2. In Schritt 9 einmal nur einen Teil des read-only Fallbackfeldes markieren
   und bestaetigen, dass das rohe Fragment als bewusst benannte zweite
   Ausnahme verstanden wird. Das ist kein Produktblocker, aber sonst bleibt
   die neue Kommentar-Ausnahme ohne Handsmoke.

Mit diesen Ergaenzungen sind die Word-Schritte nach Behebung des ROT-Zweigs
ausreichend. Sie ersetzen nicht den separaten Erstnutzerlauf auf
`/fragen`, `/start` und `/bibliothek`.

## 10. No-op-Nachweis

Vor der Berichtablage:

- Branch `main`, HEAD
  `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`;
- bestehender kumulativer Produkt-Diff:
  `c3eb92ad37a1f47ada520119bf7eb209703999b5ee39e0ce833079627bd0a9be`;
- Index-Diff leer:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
- Statussignatur vor Bericht:
  `3a2096d387991016bd922ecbd284f56255b4693f3698579f222d322c2c5e340c`.

Ich habe keine Produktdatei geaendert, keinen Build und keinen Test
ausgefuehrt, keine App und keinen Server gestartet, nichts zum Index
hinzugefuegt, keinen Commit erzeugt, nichts gepusht und Jira nicht
aufgerufen. Die einzige Schreiboperation dieser Gegenpruefung ist dieser
angeforderte Bericht. Nach seiner Ablage werden HEAD, Produkt-Diff,
Index-Diff und der um den Bericht bereinigte Status erneut verglichen.

GESAMTVERDIKT: ROT
SHA-256: b76a90c2eb448482da7fc70252e6317d08983e284eca3580e30bc76260c7359c

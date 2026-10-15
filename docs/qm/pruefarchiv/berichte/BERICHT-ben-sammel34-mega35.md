# BERICHT ben sammel34 - Gegenpruefung mega35

Erstellt: 2026-07-27 15:19:41 CEST
Pruefrolle: ben, unabhaengige read-only Gegenpruefung
Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
Basis: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
Gegenstand: `_relay/patches146/mega35.diff` (mega26 bis mega35)

## Kurzurteil

Der Umbau schliesst den frueheren Race-/Bearbeitungsverlust fuer die beiden
programmatischen Schaltflaechen "Kopieren" und "In Word einfuegen". Er schliesst
aber nicht alle Textausgaenge des Panels: Das editierbare Antwortfeld enthaelt
weiterhin nur den Antwortkoerper. Nativer Kopierzugriff per Cmd+C bzw.
Kontextmenue kopiert deshalb nur diesen Koerper. Ausgerechnet bei einem Fehler
der Clipboard-API fordert das Panel die Nutzerin ausdruecklich zu diesem
manuellen Weg auf.

Das ist kein theoretischer Randfall, sondern ein direkter Bypass der zentralen
Zusage "Einstufung und Quellen-Zeile koennen nicht fehlen". Er betrifft die am
Freitag sichere Aufgabe 6 "Klara in Word" und damit auch Aufgabe 7, das eigene
Vertrauensurteil. Der vorliegende Stand ist deshalb noch nicht auslieferbar.

## 1. Artefakt- und Umfangscheck

- Inhalts-SHA des Hand-Berichts verifiziert:
  `8a117de24734b00904e38adf7cb05b2b8d18323cf8a10873c02e3fdb796d08d6`.
- SHA des kumulativen Diffs verifiziert:
  `3576fd36519b5029e23842e2f2b3c94178b8c2ec2122a4eb3f89891eec359b25`.
- Gegen mega34 ist keine Datei verschwunden; neun Dateien sind hinzugekommen.
- HEAD/Basis ist weiterhin `d3fe69d`; der kumulative Arbeitsbaum war bereits
  vor dieser Gegenpruefung umfangreich dirty.

## 2. Word-Ausgaenge

### ROT-1 - Nativer manueller Kopierweg umgeht die Ableitung

**Beleg**

- Das Feld `#ask-answer-edit` ist ein normales editierbares `textarea` und
  enthaelt ausdruecklich nur den Antwortkoerper:
  `apps/web/public/word-addin/taskpane.html:183-189`.
- Es existiert kein `copy`-, `keydown`- oder `contextmenu`-Handler, der einen
  nativen Kopiervorgang ueber `composeOutputText` leitet. Registriert sind nur
  die Klickhandler der beiden Schaltflaechen:
  `taskpane.html:1710-1711`.
- Wenn `navigator.clipboard.writeText` fehlt oder scheitert, sagt die UI in DE,
  EN und NL ausdruecklich, den Text im Feld zu markieren und manuell zu
  kopieren: `taskpane.html:702`, `:786`, `:870`.
- Dieser manuelle Cmd+C-/Kontextmenue-Weg kopiert den Feldwert, also nur den
  Antwortkoerper. Er erreicht weder `composeOutputText` (`:1531-1547`) noch
  `composeAnswerOutput`.

**Auswirkung**

Einstufung, Quellenzeile und gegebenenfalls Kappungshinweis fehlen im kopierten
Text. Damit ist die Aussage im Codekommentar, `composeOutputText` sei der
einzige Weg, auf dem Text das Panel verlaesst (`:1526-1529`), nachweislich
falsch. Gerade der angebotene Fehler-Fallback fuehrt die Nutzerin auf den
unsicheren Weg.

**Erforderliche Korrektur vor Auslieferung**

Der native Ausgang muss ebenfalls durch die Ableitung gehen. Belastbare
Varianten sind:

1. `copy` am Antwortfeld abfangen und den abgeleiteten Text in
   `event.clipboardData` schreiben, oder
2. bei Clipboard-Fehler einen separaten read-only Volltext aus
   `composeOutputText(body)` anzeigen und nur diesen zum manuellen Kopieren
   anbieten.

Der DE/EN/NL-Fallback darf nicht mehr zum manuellen Kopieren des reinen
Antwortkoerpers auffordern. Ein echter Cmd+C- und Kontextmenue-Test gehoert zum
Word-Smoke.

### GELB-2 - Doppelte Einstufung/Quelle bei manuell eingefuegtem Metatext

`composeAnswerOutput` haengt Quellenzeile und Einstufung immer an den
uebergebenen Koerper an (`apps/web/src/lib/wordAddin.ts:442-456`). Es gibt
keine Erkennung bereits vorhandener Metazeilen. Kopiert die Nutzerin selbst
eine Einstufungs- oder Quellenzeile in das editierbare Feld, entsteht die Zeile
bei der Schaltflaechen-Ausgabe doppelt.

Der vorhandene "genau eine Einstufungszeile"-Test verwendet einen Koerper ohne
Einstufung (`tests/app/mega35-word-ausgabe-entsteht-beim-ausgeben.test.tsx:
236-254`) und prueft diesen Gegenfall daher nicht. Das ist im Normalfluss
weniger wahrscheinlich als ROT-1, beantwortet die Auftragsfrage aber eindeutig:
Ja, die neue Bauweise kann bei manuell eingefuegtem Metatext doppeln.

### GRUEN - Programmatische Schaltflaechen

Fuer die beiden angebotenen Schaltflaechen ist die neue Ableitung korrekt:

- `insertAnswer` und `copyAnswer` lesen den aktuellen Koerper und rufen beide
  unmittelbar vor der Ausgabe `composeOutputText` auf
  (`taskpane.html:1596-1636`).
- Die Ableitung setzt Quellendatum bzw. Abrufdatum, Grad und Kappungshinweis
  zentral zusammen (`wordAddin.ts:422-456`).
- Der montierte Taskpane-Test treibt echte Klicks, Bearbeitung vor und nach der
  Quellenaufloesung sowie beide Ausgabe-APIs
  (`mega35-word-ausgabe-entsteht-beim-ausgeben.test.tsx:163-272`).
- Weitere programmatische Teilen-, Export- oder Download-Ausgaenge fuer die
  Klara-Antwort sind im Taskpane nicht vorhanden.

## 3. Spiegel- und Paritaetswaechter

### GRUEN fuer den heutigen Vertrag

Der Waechter fuehrt den echten Inline-Markerblock aus und exportiert jetzt
`askGradeOf`, `answerInsertEvidenceNote`, den Vier-Parameter-Builder und
`composeAnswerOutput` (`tests/app/word-addin-ask.test.ts:302-329`). Die
Vergleiche decken beide Grade, leere/falsche Evidenz, Kappung, Datumsfallback
und Quellentitel ab (`:418-520`). Entfernt oder veraendert man eine der heute
ausgeuebten Bedingungen nur auf einer Seite, entsteht fuer mindestens ein
Fixture eine Abweichung. Die positive Kalibrierung pinnt den Einstufungstext.

### GELB als Zukunftsgarantie

Der Waechter ist eine Fallmatrix, kein struktureller Gleichheitsbeweis. Wird
nur eine Seite um eine neue optionale Eingabe oder einen neuen Zweig erweitert,
den keines der heutigen Fixtures ausloest, bleibt der Test gruen. Ebenso kann
eine auf beiden Seiten gleichzeitig verlorene Bedingung der reinen
Gleichheitspruefung entgehen; nur die gesonderten funktionalen Pins schuetzen
einzelne Zusagen. Die Hand-Aussage ist fuer den aktuellen Vertrag belegt, aber
nicht als allgemeine Garantie fuer jede kuenftige Erweiterung.

## 4. Wortliste DE/EN/NL

### Aktueller Inhalt: GRUEN

Die sechs betroffenen Schluessel in drei Sprachen ergeben die genannten 18
Textaenderungen: fuenf Neutralisierungen je Sprache sowie der je Sprache
korrigierte Bearbeitungshinweis. Die heute vorhandenen unconditional claims
sind entfernt. Die eingesetzten Formen werden ausserhalb der beiden
Einstufungsschluessel abgefangen:

- DE: `geprueft/geprüft`, `gesichert`
- EN: `verified`, `assured`
- NL: `gecontroleerd`, `gewaarborgd`

### Zukunftsbehauptung: GELB

Die "Ernte aller Werte" ist an genau eine Quelltextform gebunden:
acht Leerzeichen, Bezeichner, doppeltes Anfuehrungszeichen, einzeiliger Wert
(`tests/i18n/mega35-word-wortliste.test.ts:42-51`). Ein neuer Schluessel im
heutigen Format wird erfasst. Ein mehrzeiliger Wert, ein einfach
gequoteter/zusammengesetzter Wert oder eine anders eingerueckte Zeile wird
nicht erfasst, waehrend die Kalibrierung `>150` weiter gruen bleiben kann.

Ausserdem sind nur die sechs heute verwendeten Wortfamilien verboten.
Synonyme wie EN `checked/secured` oder NL `geverifieerd/verzekerd` sind keine
Treffer. Fuer den aktuellen Textbestand ist der Nachweis korrekt; die
Formulierung, jeder kuenftige i18n-Schluessel bzw. jede sprachliche
Entsprechung werde sicher erfasst, ist zu stark.

## 5. Audit-Rechnung

### Unabhaengige Nachrechnung: GRUEN

Die read-only Nachrechnung des vorliegenden Exports mit der Formel aus
`services/audit/src/chain.ts:7-18` ergibt:

- 871 Eintraege;
- Variantenverteilung exakt
  `1->682, 2->110, 6->36, 120->37, 144->5, 720->1`;
- Maximum 720 bei seq 757, `import.cleanup`, sechs flache Schluessel;
- 189 Eintraege mit mehr als einem Top-Level-Schluessel;
- 182 Hashabweichungen und genau sieben Multi-Key-Eintraege ohne Abweichung.

Die sieben Nicht-Abweichler sind seq 36, 42, 46, 51, 61, 67 und 767. Alle
sieben sind `answer.helpful` und tragen die Schluesselreihenfolge
`koTitle, koAuthor`. Genau in dieser Reihenfolge erzeugt der Schreibpfad das
Objekt (`services/ask/src/service.ts:241-243`); dieselbe Reihenfolge erscheint
in der jsonb-Rueckleseform. Deshalb bleibt `JSON.stringify(payload)` identisch
und der gespeicherte Hash passt. Das ist der verlangte zusaetzliche Beleg fuer
die Erklaerung "zufaellig bereits kanonische Reihenfolge".

Der korrigierte Kommentar (`services/audit/src/chain.ts:64-92`) ist sachlich
richtig. `MAX_PAYLOAD_ORDERINGS` und die Laufzeitlogik bleiben unveraendert.
Der neue Kommentartest pinnt allerdings primaer Text und Arithmetik, nicht den
Export selbst; die Datenbehauptung wird erst durch die vorstehende separate
Nachrechnung belegt.

## 6. ConfidenceBar-Vorgabewert

GRUEN. `showLabel` hat jetzt den Default `false`
(`apps/web/src/components/trust/ConfidenceBar.tsx:15-18`). Die vollstaendige
Symbolsuche findet zehn JSX-Aufrufstellen; jede uebergibt `showLabel`
ausdruecklich:

- neunmal explizit `false`;
- einmal in `Ask.tsx` als
  `effective?.grade === "verified"`.

Es existiert keine direkte Funktionsverwendung oder JSX-Stelle, die sich auf
den frueheren Default verlaesst. Der Default-Wechsel ist im heutigen Baum daher
wirkungslos; die sichtbare UI-Kit-Korrektur entsteht durch dessen drei
explizite `showLabel={false}`-Werte.

## 7. Echter Word-Host und Systemzwischenablage

Die Restluecke waere fuer sich genommen tragbar, wenn sie vor Freitag durch
einen menschlichen Smoke geschlossen wird. jsdom belegt den Vertrag bis
`clipboard.writeText` bzw. `setSelectedDataAsync`, aber weder Word Mac noch die
Systemzwischenablage.

Nach Behebung von ROT-1 muss am Mittwoch oder spaetestens Donnerstag in der
tatsaechlich auszuliefernden Word-/Manifest-Version Folgendes geprueft werden:

1. Mit realer Session eine Frage mit bekannter Quelle stellen und die
   Quellenaufloesung abwarten.
2. Den Antwortkoerper sichtbar kuerzen oder aendern.
3. "In Word einfuegen" ausloesen und im Dokument pruefen: geaenderter Koerper,
   genau eine Quellenzeile, genau eine Einstufungszeile, bei gekappter Frage
   genau ein Kappungshinweis.
4. Dieselbe Antwort ueber "Kopieren" ausgeben, in einen Klartexteditor und in
   Word einfuegen und Zeichenfolge/Zeilenreihenfolge mit Schritt 3 vergleichen.
5. Nach dem Fix das Antwortfeld markieren und sowohl Cmd+C als auch
   Kontextmenue-Kopieren pruefen: Auch diese Ausgaben muessen Einstufung und
   Quelle genau einmal tragen.
6. Einen Clipboard-Fehler/Fallback provozieren oder die Clipboard-API
   blockieren und pruefen, dass der angebotene manuelle Ausweg den
   vollstaendigen abgeleiteten Text liefert.
7. Mindestens je eine `verified`- und eine `unverified`-Antwort pruefen; der
   Wortlaut im Panel und in Word muss uebereinstimmen.

## 8. Bezug zu den sieben Testaufgaben

- Aufgaben 1 bis 5: Im mega35-Pruefscope kein neuer Blocker gefunden.
- Aufgabe 6, Klara in Word: **direkt blockiert** durch ROT-1.
- Aufgabe 7, eigenes Urteil: **mitbetroffen**, weil ein ohne Einstufung und
  Quelle kopierter Text die Vertrauensentscheidung entkernt.

Der echte Word-Host-Smoke ist eine notwendige letzte Abnahme, aber nicht der
Grund fuer ROT: Der belegte native Kopier-Bypass liegt bereits im Quelltext.

## 9. No-op-Nachweis

- Kein Produktcode und keine Konfiguration geaendert.
- Kein Build, kein Test, keine App und kein Server ausgefuehrt.
- Ausgefuehrt wurden ausschliesslich lesende Shell-/Git-Befehle sowie eine
  read-only Node-Nachrechnung des vorhandenen TSV-Exports.
- Kein Indexeintrag, kein Commit, kein Push und kein Jira-Zugriff.
- Vor Berichtserstellung:
  - HEAD `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
  - Working-Tree-Signatur
    `3b00edb90afa4307ae240f127e5240c6d389040e706339cde439d8c37bc047ad`
  - Produktdiff-Signatur
    `24666fe6151036878d37145f207f4e1b99531e50ef5b4fcf539dce60de281904`
  - Indexdiff leer:
    `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Nach Berichtserstellung werden dieselben Signaturen unter Ausschluss genau
  dieser verlangten Berichtdatei erneut verifiziert.

## Gesamtentscheidung

**Kein Ship-GO fuer den vorliegenden Stand.** Es braucht keine breite zehnte
Runde, sondern einen kleinen, gezielten Abschluss: nativen/manuellen
Kopiervorgang auf den vollstaendigen abgeleiteten Text fuehren, den
irrefuehrenden Fallbacktext korrigieren, den Metatext-Doppelfall entscheiden
und danach den oben beschriebenen echten Word-Smoke fahren. Erst dann ist
Aufgabe 6 belastbar.

GESAMTVERDIKT: ROT
SHA-256: 5a9c7cea194a579f3a789a9d546056b6afde296d5eb8d9014cf3fccee30d710e

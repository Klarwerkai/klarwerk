# BERICHT ben-sammel32 - Gegenpruefung mega33

Erstellt: 2026-07-27 10:50:48 CEST
Pruefmodus: streng read-only; keine Builds, keine Tests, keine App-Ausfuehrung
Repo: /Users/peterkohnert/Documents/dev_Klarwerk
Basis: d3fe69d
Pruefgegenstand: _relay/patches144/mega33.diff (mega26 bis mega33)

## Kurzurteil

Die neue Einstufung ist innerhalb der Web-Antwortansicht und der mobilen
Antwortansicht wesentlich besser zentralisiert: `effectiveAnswer()` leitet die
Antwortklasse einmal aus den tatsaechlich zitierten Quellen, deren KI-Pruefstand
und den bekannten Konflikten ab. Status, Belegtext, Waechter und Ausgabe der
beiden Ansichten verwenden danach denselben Wert.

Der Stand ist trotzdem nicht bereit fuer die Auslieferung vor dem Freitagstest.
Zwei sicherheits- beziehungsweise vertrauensrelevante Luecken liegen genau auf
der zu testenden Frage-Antwort-Flaeche:

1. Ein noch ladender oder fehlgeschlagener Konfliktabruf wird wie "keine
   Konflikte" behandelt und kann eine Antwort fail-open als `verified`
   einstufen.
2. Die Word-/Klara-Leseflaeche verwendet die zentrale Einstufung ueberhaupt
   nicht und bezeichnet Antworten weiterhin pauschal als "verifiziertes
   Wissen", einschliesslich Kopier- und Einfuegeweg.

Zusaetzlich wird das Wort "Gesichert" im KO-Detail weiterhin allein aus einem
Trust-Prozentwert abgeleitet. Fuer eine Testerin ohne Vorwissen ist diese
Doppelbedeutung nicht verlaesslich unterscheidbar.

## Artefakt- und Scope-Nachweis

- Der Inhalts-SHA des Hand-Berichts wurde mit der verlangten
  `head -n (wc -l - 1)`-Methode nachgerechnet:
  `889b98fb7e8a403f4a67ab1abcd53a9d9c98a30a1c8476c1249d92a92a629efc`.
- Der SHA-256 des kumulativen Diffs stimmt:
  `446f214719cdba1887c3644f77e63f1b1bc4807edbc0ea5f4733e0dfb3de52d6`.
- Gegen mega32 sind keine Dateien verschwunden; die angegebenen 15 Dateien
  sind hinzugekommen.
- Gepruefter HEAD: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`.
- Der vorgefundene Arbeitsbaum war bereits vor der Gegenpruefung umfangreich
  veraendert (`main`, ahead 5, behind 1). Diese Gegenpruefung hat diesen
  Produktbaum nicht veraendert.

## Befunde

### 1. ROT - Unbekannter Konfliktstatus wird fail-open zu "konfliktfrei"

Belege:

- `apps/web/src/pages/Ask.tsx:104-121` ruft `useKos()` und `useConflicts()`
  auf, uebergibt aber nur `conflicts.data ?? []` an `effectiveAnswer()`.
- `apps/web/src/pages/Mobile.tsx:209-217` und `:476-479` verwenden denselben
  Default.
- `apps/web/src/lib/effectiveAnswer.ts:54-62` berechnet
  `sourcesConflicted` ausschliesslich aus dem uebergebenen Array.

Damit sind drei fachlich verschiedene Zustaende nicht unterscheidbar:

- Konfliktdaten erfolgreich geladen und leer,
- Konfliktdaten noch nicht geladen,
- Konfliktabruf fehlgeschlagen.

In den letzten beiden Faellen wird `[]` eingesetzt. Eine Antwort mit
`knowledgeClass="gesichert"` und voll belegter KI-Pruefabdeckung kann dadurch
voruebergehend oder dauerhaft `verified` werden, obwohl die
Konfliktfreiheit nicht belegt ist. Der KO-Abruf ist demgegenueber eher
fail-safe, weil eine nicht aufgeloeste Quelle den Pruefstand `unknown` erhaelt.

Impact:

- Direkt sichtbar in Desktop und Mobile.
- Trifft genau die Freitagsaufgabe "Vertraue ich der Antwort und woran?".
- Ein Netz- oder Backendfehler kann zu einer zu starken Vertrauensaussage
  statt zu einer ehrlichen Unsicherheit fuehren.

Fix vor Freitag:

- Verfuegbarkeit/Erfolg des Konfliktabrufs als Pflichtsignal in
  `effectiveAnswer()` aufnehmen.
- `loading`, `error` und unbekannt muessen `unverified` plus benannten
  Hinweis ergeben oder die Einstufung bis zum erfolgreichen Abruf
  zurueckhalten.
- Mounted Tests fuer Desktop und Mobile mit Konflikt-Loading und
  Konflikt-Fehler ergaenzen.

live-relevant: ja

### 2. ROT - Word/Klara ist eine uebersehene Leseflaeche ohne Einstufung

Belege:

- `apps/web/public/word-addin/taskpane.html:404-450` ruft `/api/ask` auf und
  verarbeitet Antwort, Quellen und Trust, aber weder `AnswerGrade` noch
  KI-Pruefabdeckung oder Konfliktstand.
- `apps/web/public/word-addin/taskpane.html:709-718` verspricht mehrfach
  "verified knowledge".
- `apps/web/public/word-addin/taskpane.html:741-742` schreibt dieselbe
  Behauptung in die Quellenzeile.
- `apps/web/public/word-addin/taskpane.html:1310-1340` laedt Quell-KOs, behaelt
  aber nur ID, Titel, Trust, Datum und Status; `aiCheck.coverage` wird nicht
  weitergegeben.
- `apps/web/public/word-addin/taskpane.html:1381-1411` zeigt die Antwort,
  ohne die neue Einstufung abzuleiten.
- `apps/web/public/word-addin/taskpane.html:1465-1476` kopiert beziehungsweise
  fuegt Antwort und Quellen ohne Einstufungs-Hinweis ein.
- `apps/web/src/lib/wordAddin.ts:221-280` und `:301-309` spiegeln denselben
  Vertrag.
- Eine Suche nach `effectiveAnswer` und `AnswerGrade` findet in der
  Word-Flaeche keinen Verbraucher.

Damit kann eine Antwort mit gedeckelter oder unbekannter KI-Pruefabdeckung in
Word als "verifiziertes Wissen" angezeigt, kopiert und in ein Dokument
eingefuegt werden. Die zentrale Einstufung speist folglich nicht alle Anzeigen,
Waechter und Ausgabewege.

Fix vor Freitag:

- Word muss denselben effektiven Antwortzustand erhalten. Bevorzugt liefert
  der Server einen kanonischen, quellengebundenen Evidenzzustand; alternativ
  muss die Word-Laufzeit Quellen-KOs, Abdeckung und Konfliktstatus nach
  demselben gemeinsamen Vertrag auswerten.
- Anzeige, Copy und Insert muessen denselben Hinweis beziehungsweise Gate
  verwenden.
- Tests fuer `verified`, gedeckelte Abdeckung, Konfliktstatus unbekannt und
  Abruffehler pinnen.

live-relevant: ja

### 3. ROT - "Gesichert" hat weiterhin zwei nicht trennbare Bedeutungen

Belege:

- `apps/web/src/components/trust/ConfidenceBar.tsx:3-13` ordnet ab 85 Prozent
  den Key `quality.assured` zu.
- `apps/web/src/components/trust/ConfidenceBar.tsx:44-48` zeigt das Label
  standardmaessig an.
- `apps/web/src/i18n.ts:148` uebersetzt `quality.assured` mit "Gesichert".
- `apps/web/src/pages/Ask.tsx:496-503` hat die Antwortkarte korrekt gebunden:
  Das Label erscheint nur bei `effective.grade === "verified"`.
- `apps/web/src/components/ko/KoRead.tsx:19-27` und
  `apps/web/src/components/ko/SourceEvidence.tsx:119-138` verwenden den
  Default weiterhin im KO-Detail, also nur prozentbasiert.

Korrektur zum Hand-Bericht:

- Bibliothek (`Library.tsx:957`), Validierung (`Validation.tsx:828`), Mobile
  (`Mobile.tsx:490`) und kompakte Konfliktseite
  (`ConflictKoSide.tsx:39-44`) setzen `showLabel={false}`. Dort erscheint das
  exakte Wort "Gesichert" nicht ueber diesen Balken.
- Die Doppelbehauptung ist aber im KO-Detail real und dort besonders
  irritierend: Eine Testerin kann von einer Antwort direkt zur Quelle wechseln
  und dort ein rein prozentbasiertes "Gesichert" sehen.

Urteil:

Das Wort behauptet fuer einen normalen Leser dieselbe Sache. Die technische
Unterscheidung zwischen hohem Trust-Prozent und belegter Antwortklasse ist
ohne Erklaerung nicht erkennbar. Das sollte vor Freitag sprachlich getrennt
werden, zum Beispiel "Hohe Konfidenz" beziehungsweise "Trust 87 %" fuer den
Prozentbalken und "Gesichert" ausschliesslich fuer die belegte Einstufung.

live-relevant: ja

### 4. GELB - Health-Mathematik korrekt, aber Hinweislogik erwartet das entfernte Band

Positiv:

- `apps/web/src/lib/knowledgeHealth.ts:145-163` begrenzt den bekannten
  Konfliktabzug durch den Maximalabzug.
- Bei unbelegter Erkennung verwendet der sichtbare Score den schlechteren
  Maximalabzug und der optimistische Rand den bekannten Abzug.
- Damit gilt stets `score <= optimisticScore`.
- Bei belegter Erkennung sind angewandter und bekannter Abzug gleich; die
  Raender fallen zusammen.
- `apps/web/src/lib/knowledgeHealth.ts:175-178` setzt das Band bei unbelegter
  Erkennung bewusst auf `null`.
- `apps/web/src/pages/Analytics.tsx:214-265` behandelt diesen Zustand sichtbar.

Restproblem:

- `apps/web/src/lib/knowledgeOsHints.ts:78-88` und `:143-152` erzeugen einen
  Health-Hinweis nur fuer die Baender `kritisch` oder `mittel`.
- `apps/web/src/pages/Stufe2.tsx:1184-1232` reicht den neuen Health-Zustand in
  diese Logik.
- Bei unbelegter Konflikterkennung kann der sichtbare Worst-Case-Score kritisch
  sein, waehrend `band === null` keinen Hinweis erzeugt.
- `apps/web/src/lib/knowledgeOsHints.ts:197-212` kann den Health-Zustand dann
  trotzdem als vorhanden behandeln und bei fehlenden anderen Hinweisen sogar
  "all-clear" liefern.
- `tests/analytics/knowledge-os-hints.test.ts:87-110` baut nur Fixtures mit
  einem vorhandenen `HealthBand`; ein `null`-Fall fehlt.

Fix nach Freitag, sofern Stufe 2 nicht zu den sieben Testaufgaben gehoert:

- Einen expliziten Hinweis "Konflikterkennung nicht vollstaendig belegt"
  aus `conflictFactor.proven === false` ableiten.
- In diesem Zustand niemals "all-clear" ausgeben.
- Null-Band/Worst-Case-Tests ergaenzen.

live-relevant: ja, aber ausserhalb der beschriebenen Frageflaeche

### 5. GELB - Der Coverage-Waechter prueft Drift stark, die Fachformel aber nicht unabhaengig

Belege:

- `tests/conflicts/coverage-invariant-parity.test.ts:67-97` definiert eine
  `CONDITIONS`-Liste mit denselben fuenf fachlichen Praedikaten und bildet
  daraus `referenceComplete`.
- Die 32 Wahrheitskombinationen und das 1296er Gitter vergleichen die
  Implementierungen sehr wirksam gegen diese Referenz.
- Die absichtliche Mutation `skipped === 0` zeigt nachvollziehbar, dass die
  alte Neun-Fall-Matrix Drift nicht gefunden haette und der neue Waechter sie
  findet.

Einschraenkung:

Die Referenz ist ausfuehrungstechnisch unabhaengig, fachlich aber eine vierte
Kodierung derselben Formel. Sind die fuenf Bedingungen gemeinsam falsch oder
unvollstaendig gedacht, bleiben Referenz und alle Spiegel gruen. Der Waechter
ist daher ein starker Driftwaechter, aber kein unabhaengiges Orakel fuer die
Richtigkeit der Fachregel.

Fix nach Freitag:

- Die Aussage im Test und Bericht auf "unabhaengige Referenzimplementierung
  gegen Drift" verengen.
- Zusaetzlich wenige fachlich formulierte Beispielvertraege aufnehmen, deren
  Erwartung nicht aus `CONDITIONS` berechnet wird, einschliesslich
  inkonsistenter oder unmoeglicher Zaehlerstaende.

live-relevant: nein

## Gepruefte Kernfragen

### Eine Einstufung fuer alle sechs Web-Flaechen

GRUEN innerhalb Ask und Mobile:

- `apps/web/src/lib/effectiveAnswer.ts:54-69` ist der einzige Produktaufrufer
  von `answerGrade`.
- Eingaben sind die wirklich zitierten Quellen, deren reale
  `knowledgeClass`, deren realer KI-Pruefstand und die bekannten Konflikte.
- `sourcesCheckUnproven` ist aus dem realen Caveat abgeleitet und kein fester
  Wert.
- Status, Beleg, Review-Guard und Export-/Copy-Vertrag der Web-Antwortansicht
  verwenden danach den effektiven Grade.
- `tests/ask/mega33-eine-einstufung.test.ts:82-200` pinnt die sechs logischen
  Web-Flaechen und positive wie negative Faelle.

ROT fuer die Gesamtbehauptung "alle Leseflaechen": Word ist nicht angebunden,
und der unbekannte Konfliktstatus ist nicht Teil des zentralen Vertrags.

### Keine Herabstufung durch unbeteiligte gedeckelte Laeufe

GRUEN:

- `effectiveAnswer()` betrachtet nur `answer.sources`.
- `askView` ermittelt den KI-Pruefstand pro aufgeloester Quell-ID.
- Ein unbeteiligtes gedeckeltes KO im restlichen Bestand beeinflusst die
  Antwortklasse nicht.

### Neunundzwanzig Typwechsel-Aufrufstellen

GRUEN mit Blick auf den Produktcode:

- Es wurde kein Produktaufrufer gefunden, der das neue Signal durch einen
  fest gesetzten harmlosen Wahrheitswert abschaltet.
- Feste Werte liegen in Test-Fixtures, die einzelne Vertragsfaelle isolieren,
  nicht in der Laufzeitverdrahtung.
- Der einzige produktive Grade-Aufruf nutzt reale, quellengebundene Daten.

### Answered ohne Quellen

GRUEN:

- `services/ask/src/service.ts:164-169` wandelt `answered=true` ohne Quellen
  in eine unbeantwortete Antwort um.
- Die betrachteten Reasoner-Pfade liefern quellengebundene Antworten.

## Entscheidung fuer Donnerstag/Freitag

### Muss vor der Auslieferung geschlossen werden

1. Konfliktabruf `loading/error/unknown` fail-safe in die zentrale
   Einstufung aufnehmen.
2. Word/Klara an denselben Einstufungs-, Hinweis-, Copy- und Insert-Vertrag
   anbinden.
3. Das rein prozentbasierte Wort "Gesichert" im KO-Detail sprachlich von der
   belegten Antwortklasse trennen.

### Kann nach Freitag erfolgen

1. `knowledgeOsHints` an `band === null` und unbelegte Konflikterkennung
   anpassen, sofern Stufe 2 sicher nicht Teil des Testablaufs ist.
2. Coverage-Testbeschreibung praezisieren und um fachlich unabhaengige
   Beispielvertraege ergaenzen.

## No-op-Nachweis

- Ausgefuehrt wurden ausschliesslich lesende Befehle wie `git status`,
  `git diff`, `git show`, `rg`, `sed`, `nl`, `comm`, `wc`, `head`, `date`
  und SHA-256-Berechnungen.
- Kein Build und keine Tests wurden ausgefuehrt.
- Keine Anwendung und kein Server wurden gestartet.
- Kein Produktcode und kein Index wurden veraendert.
- Kein Commit und kein Push wurden ausgefuehrt.
- Jira und andere externe Systeme wurden nicht gelesen oder beschrieben.
- Keine Secrets oder ENV-Werte wurden gelesen oder ausgegeben.
- Einzige von ben erzeugte Datei ist dieser angeforderte Bericht in
  `_relay/ben/outbox/`.
- Der abschliessende Repo-Status entspricht dem vorgefundenen kumulativen
  mega33-Arbeitsbaum; die Gegenpruefung hat keine Produktdatei hinzugefuegt,
  entfernt oder veraendert.

GESAMTVERDIKT: ROT
SHA-256: 31d352068ebfc34b912c049777c14815faf0aa1fb5cf0f980fb36f9555695178

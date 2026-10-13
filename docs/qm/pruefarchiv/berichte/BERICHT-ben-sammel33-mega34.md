# BERICHT ben-sammel33 - Gegenpruefung mega34

Erstellt: 2026-07-27 12:47:31 CEST
Pruefmodus: streng read-only; keine Builds, keine Tests, keine App-Ausfuehrung
Repo: /Users/peterkohnert/Documents/dev_Klarwerk
Basis: d3fe69d
Pruefgegenstand: _relay/patches145/mega34.diff (mega26 bis mega34)

## Kurzurteil

Mega34 schliesst zwei der drei ROT-Befunde aus sammel32 im Produktcode:

- Ein unbekannter Konfliktstand kann Desktop und Mobile nicht mehr
  fail-open als `verified` erscheinen lassen.
- Das prozentbasierte Wort "Gesichert" ist aus den normalen KO-, Bibliotheks-,
  Validierungs- und mobilen Leseflaechen entfernt beziehungsweise dort
  grade-gebunden.

Der Datei-Knopf und der neue Health-Hinweis tragen ebenfalls.

Der Word-Befund ist jedoch nicht vollstaendig geschlossen. Der reine
Text-Builder kann die Einstufung anhaengen, aber der reale Copy-/Insert-Pfad
kopiert den frei editierbaren Feldinhalt. Bearbeitet die Nutzerin die Antwort,
bevor die Quellenaufloesung beendet ist, werden Quellenzeile und Einstufung
danach bewusst nicht mehr nachgetragen. Sobald die Quellenaufloesung endet,
werden Copy und Insert trotzdem freigeschaltet. Damit kann genau der
vorgesehene Bearbeitungsweg eine Antwort ohne Einstufung und ohne Quelle aus
Word herauskopieren oder einfuegen.

Das betrifft unmittelbar zwei der sieben Freitagsaufgaben: Klara in Word und
das eigene Vertrauensurteil. Daher besteht vor einer Auslieferung am
Donnerstag ein konkreter Blocker.

## Artefakt- und Scope-Nachweis

- Der Inhalts-SHA des Hand-Berichts stimmt:
  `c31fb32237c37905e4bcb281de4b6f1e5a5be8effbc41dac33f60e816adf4a10`.
- Der SHA-256 des kumulativen Diffs stimmt:
  `924ca3b516fdf08f4b35649bf214ed9dca2d44fca7c03ca215a9cef7fbebb594`.
- Gegen mega33 sind keine Dateien verschwunden; 21 Dateien sind hinzugekommen.
- Gepruefter HEAD:
  `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`.
- Der Arbeitsbaum war bereits vor dieser Gegenpruefung umfangreich veraendert:
  `main`, 5 Commits vor und 1 Commit hinter `origin/main`.

## Befunde

### 1. ROT - Word Copy/Insert verliert die Einstufung im vorgesehenen Bearbeitungsweg

Belege im realen Taskpane:

- `apps/web/public/word-addin/taskpane.html:1433-1438` befuellt das editierbare
  Feld zuerst ausschliesslich mit `outcome.answer`.
- `apps/web/public/word-addin/taskpane.html:1441-1454` traegt Quellenzeile und
  Einstufung erst nach der asynchronen Quellenaufloesung nach.
- Das Nachtragen erfolgt nur, wenn
  `edit.value === askAnswerPrefill` (`:1448`). Sobald die Nutzerin die Antwort
  waehrend des Ladens kuerzt oder anpasst, ist die Bedingung falsch und
  `buildDefaultInsertText()` wird nicht mehr eingesetzt.
- Trotzdem setzt derselbe Callback
  `currentAskSourcesResolved = true` (`:1444`) und aktiviert anschliessend die
  Ausgabewege (`:1454`).
- `updateInsertState()` schaltet Copy und Insert allein aus
  `canInsertAnswer(currentAskOutcome) && currentAskSourcesResolved` frei
  (`:1299-1308`). Es prueft nicht, ob der editierte Feldinhalt Quellenzeile und
  Einstufung enthaelt.
- `insertAnswer()` liest nur `getEditedAnswerText()` und gibt genau diesen Text
  an Word (`:1573-1587`).
- `copyAnswer()` liest ebenfalls nur `getEditedAnswerText()` und schreibt genau
  diesen Text in die Zwischenablage (`:1598-1608`).

Reproduzierbarer Ablauf ohne Fehler oder Race-Injektion:

1. Klara liefert eine quellengebundene Antwort.
2. Das Textfeld wird sofort mit der reinen Antwort sichtbar.
3. Die Nutzerin folgt dem sichtbaren Hinweis und kuerzt die Antwort, waehrend
   die Quell-KOs noch geladen werden.
4. Die Quellenaufloesung endet. Wegen der Bearbeitung wird die vollstaendige
   Vorbefuellung nicht nachgetragen.
5. Copy und Insert werden freigeschaltet.
6. Der ausgegebene Text enthaelt weder Quellenzeile noch Einstufung.

Das ist kein theoretisches Entfernen eines Hinweises durch einen absichtlich
handelnden Nutzer. Es ist der normale, in der UI ausdruecklich angebotene
Bearbeitungsweg:

- `taskpane.html:679` fordert zum Kuerzen oder Anpassen auf.
- Das Feld ist bereits vor Abschluss der Quellenaufloesung editierbar.

Der Fehler besteht auch strukturell nach Abschluss der Aufloesung: Einstufung,
Quelle und editierbarer Antworttext liegen in demselben frei editierbaren
Textfeld. Die Aussage "der eingefuegte Text traegt die Einstufung wirklich mit,
auch beim Kopieren" ist deshalb nicht garantiert.

Warum die Tests den Fehler nicht finden:

- `tests/app/mega34-word-einstufung.test.ts:243-268` prueft nur
  `buildAnswerInsertText()` direkt.
- Der Test mountet den Taskpane-Ablauf nicht, bearbeitet das Textfeld nicht
  waehrend der asynchronen Quellenaufloesung und klickt weder Copy noch Insert.
- `tests/app/word-addin-ask.test.ts:555-586` prueft die reale Verdrahtung nur
  ueber Quelltext-Strings.
- Der Test bestaetigt sogar, dass Copy und Insert den aktuellen Feldinhalt
  verwenden, prueft aber nicht, dass dieser Feldinhalt die Einstufung
  garantiert enthaelt.

Fix vor Donnerstag:

- Das Textfeld darf nur den editierbaren Antwortkoerper enthalten.
- Copy und Insert muessen im Moment der Aktion aus drei getrennten Teilen
  zusammensetzen:
  1. aktuell editierter Antwortkoerper,
  2. unveraenderliche Quellenzeile,
  3. unveraenderlicher Einstufungshinweis.
- Die Aktion bleibt bis zur Quellenaufloesung gesperrt, baut danach aber immer
  selbst den finalen Text. Eine fruehe Bearbeitung darf das Nachtragen nicht
  verhindern.
- Ein gemounteter Laufzeittest muss die Reihenfolge
  "Antwort erscheint -> Nutzer editiert -> Quellen loesen auf -> Copy/Insert"
  pinnen und den tatsaechlich uebergebenen Text pruefen.

live-relevant: ja
Freitag-relevant: ja

### 2. ROT - Word spricht im ungeprueften Zustand gleichzeitig von "geprueftem Wissen"

Mega34 zeigt bei `unverified` jetzt einen ehrlichen Einstufungshinweis. Die
umgebenden Texte bleiben jedoch unbedingt positiv:

- `apps/web/public/word-addin/taskpane.html:652`:
  "AUSSCHLIESSLICH aus geprueftem KLARWERK-Wissen".
- `:656`: "Klara sucht im geprueften Werkswissen".
- `:661`: "Antwort aus geprueftem Wissen".
- `:689-690`: Die in Copy/Insert vorgesehene Quellenzeile nennt
  "KLARWERK, geprueftes Wissen".
- Die englischen Entsprechungen stehen in `:742`, `:747` und `:773-774`.

Daneben steht bei gedeckelter Abdeckung oder unbekanntem Konfliktstand:

- `:666`: "Einstufung: ungeprueft - nicht als konfliktfrei belegt".

Technisch kann "geprueftes Wissen" den menschlich validierten KO-Bestand
meinen, waehrend "ungeprueft" die effektive Antwortklasse meint. Eine
Testerin ohne Vorwissen kann diese zwei Ebenen aber nicht auseinanderhalten.
Die Word-Flaeche widerspricht sich damit aus Nutzersicht weiterhin genau bei
der Frage, woran Vertrauen erkennbar ist.

Fix vor Donnerstag:

- Ueberschrift und Quellenzeile neutral auf "KLARWERK-Wissen" beziehungsweise
  "quellengebundene Antwort" formulieren.
- Die Worte "gesichert/geprueft" ausschliesslich im Einstufungshinweis
  verwenden.
- DE, EN und NL gemeinsam aendern.

live-relevant: ja
Freitag-relevant: ja

### 3. GELB - Der Word-Paritaetswaechter ist aktuell hilfreich, aber nicht vollstaendig

Aktueller positiver Befund:

- Die vier aktuellen booleschen Bedingungen werden in
  `tests/app/mega34-word-einstufung.test.ts:134-170` vollstaendig
  durchlaufen.
- Fuer die drei dort gewaehlten Klassen sind es tatsaechlich
  `3 * 2^4 = 48` Faelle.
- Nimmt man auf nur einer der beiden aktuellen Implementierungen eine der
  vier Bedingungen aus der `verified`-Konjunktion, existiert mindestens eine
  Kombination, in der der Test rot wird.
- Die heutige Server- und Web-Regel sind fuer die erfassten Eingaben gleich.

Die Bezeichnung "vollstaendige Wahrheitstafel" ist trotzdem falsch:

- `KnowledgeClass` hat sechs Werte, nicht drei:
  `gesichert`, `ungeprueft`, `meinung`, `extern`, `annahme`, `unbekannt`
  (`apps/web/src/api/types.ts:730-736`,
  `services/reasoner/src/types.ts:23-29`).
- Der Test nimmt nur `gesichert`, `ungeprueft` und `meinung`
  (`mega34-word-einstufung.test.ts:135`).
- Die vollstaendige aktuelle Domaene umfasst daher
  `6 * 2^4 = 96` Kombinationen.

Die ausgelassenen Klassen driften heute nicht, weil beide Implementierungen
nur auf `knowledgeClass === "gesichert"` pruefen. Der Waechter wuerde aber
eine spaetere Sonderbehandlung von `extern`, `annahme` oder `unbekannt` auf
nur einer Seite nicht erkennen.

Auch fuer eine kuenftige sechste Bedingung gibt es keinen Strukturwaechter:

- Wird ein neues Pflichtfeld nur im Webtyp ergaenzt, muss der Test zwar
  angepasst werden.
- Wird es dort in allen Fixtures bequem auf denselben harmlosen Wert gesetzt,
  bleibt die neue Dimension ungeprueft und die Serverseite kann unveraendert
  bleiben.
- Es gibt keine kalibrierte Mutation, die nacheinander den Verlust jeder
  Bedingung und eine nur einseitige Erweiterung nachweist.

Zusaetzliche Luecke im Inline-Spiegel:

- `tests/app/word-addin-ask.test.ts:307-323` exportiert aus dem Inline-Block
  `askGradeOf` und `answerInsertEvidenceNote` nicht.
- `:395-400` vergleicht `buildAnswerInsertText` nur mit zwei und drei
  Argumenten, nicht mit dem neuen vierten Einstufungsparameter.
- Die Behauptung, der bestehende Aequivalenzwaechter pruefe die neue
  Einstufungsauswahl zwischen TS-Modul und Inline-HTML, ist daher nicht
  belegt.

Das ist fuer die aktuelle Grade-Formel ein Proof-Gap, kein nachgewiesener
zweiter Laufzeitfehler. Der gemountete Copy-/Insert-Fehler aus Befund 1 ist
davon unabhaengig real.

Fix:

- Alle sechs `KnowledgeClass`-Werte enumerieren.
- `askGradeOf` und `answerInsertEvidenceNote` in den Inline-Fabrikvergleich
  aufnehmen.
- Den vierten Parameter von `buildAnswerInsertText` vergleichen.
- Eine kalibrierte Mutation pro aktueller Bedingung und einen
  Erweiterungs-Sentinel ergaenzen.

live-relevant: mittelbar
Freitag-relevant: als Absicherung des Word-Fixes, ja

### 4. GELB - Prozentbasiertes "Gesichert" ist aus normalen Flaechen entfernt, aber im UI-Kit erreichbar

Positiver Befund:

- Bibliothek: `Library.tsx:957`, `showLabel={false}`.
- Validierung: `Validation.tsx:828`, `showLabel={false}`.
- Mobile Antwort: `Mobile.tsx:500`, `showLabel={false}`.
- KO-Kopf: `KoRead.tsx:34`, `showLabel={false}`.
- KO-Belegansicht: `SourceEvidence.tsx:112` und `:140`,
  `showLabel={false}`.
- Desktop-Antwort: `Ask.tsx:509`, das Label erscheint nur bei
  `effective.grade === "verified"`.
- Word verwendet sein Wort "gesichert" aus dem serverseitigen Grade, nicht
  aus einem Trust-Prozentwert.
- Print der Antwort druckt dieselbe `print-area` wie die Webansicht; es gibt
  keine zweite prozentbasierte Druckableitung.

Rest:

- `ConfidenceBar` hat weiterhin `showLabel = true` als Default
  (`apps/web/src/components/trust/ConfidenceBar.tsx:15-18`).
- `apps/web/src/pages/UiKit.tsx:39-41` ruft den Balken ohne Override auf.
- Das Dev-Schaufenster ist zwar nicht in der Navigation, aber unter
  `/ui-kit` als Route registriert (`apps/web/src/routes.tsx:137`).
- Dort entsteht "Gesichert" weiterhin allein aus `value={91}`.

Das beruehrt keine der sieben Freitagsaufgaben. Nach dem Test sollte der
Default jedoch auf `false` gedreht oder das UI-Kit klar ausserhalb der
Produkt-Routen gehalten werden, damit die alte Doppelbedeutung nicht beim
naechsten Aufrufer zurueckkehrt.

live-relevant: ja, aber nur nicht navigiertes Dev-Schaufenster
Freitag-relevant: nein

## Audit-Kette - unabhaengige Gegenrechnung

### Ergebnis auf dem forensischen Datensatz

Datensatz:

`_relay/spikes/audit-forensik-25072026/nachlauf-1629/rows.tsv`

- 871 Zeilen, Seq 1 bis 871, keine doppelten Sequenzen.
- Der TSV liegt nicht in Sequenzreihenfolge. In roher Dateireihenfolge
  entstehen genau 85 scheinbare Verkettungsbrueche.
- Das ist die von der Hand genannte falsche Lesart ohne `ORDER BY seq`.
- Nach Sortierung nach `seq`, entsprechend
  `PgAuditRepo.all()` in `services/audit/src/repo-pg.ts:108-110`:
  - Verkettungsbrueche: 0
  - Nutzdatenabweichungen: 182
  - durch Schluesselreihenfolge reproduzierbar: 182
  - unaufgeloest: 0
  - ungeprueft wegen Cap: 0
  - erste Abweichung: Seq 24,
    `2026-07-05T18:41:57.988Z`, `ask.query`
- 682 Eintraege haben hoechstens einen Top-Level-Nutzdatenschluessel;
  davon weicht keiner ab.
- 189 Eintraege haben mehr als einen Top-Level-Schluessel;
  davon weichen 182 ab.

Diese Zahlen bestaetigen die Serialisierungserklaerung fuer den vorliegenden
Backup-Stand.

### Kann derselbe Befund trotz tatsaechlicher Wertaenderung entstehen?

Ja, aber nur unter einer wichtig zu benennenden Angreiferfaehigkeit:

- Wird lediglich ein gespeicherter Nutzdatenwert veraendert und bleiben Hash
  und Folgekette unangetastet, findet keine Schluesselpermutation mehr den
  alten SHA-256. Der Eintrag wird `unresolved`; eine reine Wertmutation wird
  nicht als Serialisierung wegerklaert, abgesehen von einer praktisch
  auszuschliessenden SHA-256-Kollision.
- Kann ein Angreifer dagegen die Datenbank vollstaendig beschreiben, kann er
  den geaenderten Eintrag und alle Folgehashes neu bilden. Dann kann eine
  historisch veraenderte Kette gruen sein oder denselben
  Serialisierungsbefund erzeugen.
- Beim letzten Eintrag reicht bereits das Neuberechnen dieses einen Hashes,
  weil kein Folgeeintrag mehr auf den alten Hash zeigt.

Damit entlasten die 182 reproduzierbaren Abweichungen den aktuellen
Wertebestand gegen die konkrete Behauptung "der vorhandene Hash passt zu
keiner Darstellung dieser Werte". Sie beweisen nicht, dass die Werte
historisch unveraendert sind.

Diese Grenze ist im Produkt korrekt offengelegt:

- `apps/web/src/i18n.ts:652-653` nennt den fehlenden extern verankerten Kopf
  und die Moeglichkeit, Eintrag und Folgehashes neu zu bilden.
- Die Anzeige behauptet weder "Manipulation erkannt" noch "Manipulation
  ausgeschlossen".

### Ist die Annahme mehrerer Urbilder eine Schwachstelle?

Der Pruefer akzeptiert mehrere byteverschiedene
`JSON.stringify`-Darstellungen. Diese Darstellungen enthalten aber exakt
dieselben Schluessel mit exakt denselben zugeordneten Werten; nur die
Einfuegereihenfolge von JSON-Objektschluesseln weicht ab. Arrays werden
nicht umgeordnet.

Fuer die semantischen Nutzdaten ist das keine Mehrdeutigkeit: JSON-Objekte
sind fachlich ungeordnet. Fuer den historischen Hash ist es dennoch eine
Einschraenkung:

- `serialisation` bedeutet nur, dass mindestens eine moegliche damalige
  Einfuegereihenfolge zum gespeicherten Hash passt.
- Es beweist nicht, welche Reihenfolge tatsaechlich geschrieben wurde.
- Es beweist wegen des fehlenden externen Ankers auch keine historische
  Unveraendertheit.

Die Klassifikation ist daher als Kompatibilitaetsdiagnose vertretbar, nicht
als Manipulationsausschluss.

### MAX_PAYLOAD_ORDERINGS

Die Schranke schuetzt vor faktorieller Laufzeit, erzeugt aber eine
fail-safe Falschwarnkante:

- Acht flache Schluessel: `8! = 40.320`, werden noch untersucht.
- Neun flache Schluessel: `9! = 362.880`, werden bei Cap 50.000 als
  `unchecked` markiert.
- Dasselbe kann mit weniger Top-Level-Schluesseln durch verschachtelte
  Objekte entstehen.
- Stimmen Werte und historische Einfuegereihenfolge, aber Postgres hat die
  Schluesselreihenfolge normalisiert, wird ein solcher Eintrag rot als
  "Kette nicht bestaetigt / Nutzdaten-Pruefsumme nicht geprueft" angezeigt,
  obwohl keine Wertaenderung vorliegen muss.

Das ist keine falsche Behauptung "Manipulation erkannt", denn die UI sagt
ausdruecklich "nicht geprueft". Es ist aber ein moeglicher falscher roter
Alarm.

Korrektur zum Hand-Bericht und Codekommentar:

- Im untersuchten Datensatz liegt das Maximum bei 720 Varianten, Seq 757
  (`import.cleanup`), nicht bei 4.320.
- Seq 714 und die weiteren verschachtelten `examples.load`-Eintraege haben
  144 Varianten.
- Von 189 Eintraegen mit mehr als einem Top-Level-Schluessel weichen 7 nicht
  ab. Die Aussage "jeder neue Eintrag mit mehr als einem Payload-Schluessel
  erzeugt eine weitere Abweichung" ist daher zu absolut. Eine Abweichung
  entsteht nur, wenn JS-Einfuegereihenfolge und Postgres-Reihenfolge
  tatsaechlich verschieden sind.

Folgearbeit nach Freitag:

- Neue Audit-Eintraege versioniert mit kanonischer JSON-Darstellung hashen.
- Alt- und Neuhashformat ueber eine explizite Hashversion unterscheiden.
- Fuer den Altbestand die heutige Diagnose behalten, aber nicht als primaere
  Langzeitverifikation ausbauen.
- Einen Kettenkopf regelmaessig extern verankern, wenn historische
  Manipulationsresistenz verlangt wird.
- Cap-Zustand weiter ehrlich als `unchecked` behandeln.

Freitag-relevant: nein; die Sicherheitsseite ist keine der sieben Aufgaben.

## Sicherheitsseite im aktuellen Arbeitsbaum

Die Anzeige ist fachlich korrekt:

- `auditVerifyView()` zeigt Gelb nur, wenn es keine Verkettungsbrueche gibt
  und jede Nutzdatenabweichung als Serialisierung aufgeloest ist
  (`apps/web/src/lib/auditVerifyState.ts:46-56`).
- Unaufgeloeste, ungepruefte oder echte Verkettungsabweichungen werden Rot
  und nennen Nummer, Datum, Aktion und Art der ersten Abweichung
  (`:59-70`).
- Der aktuelle 0/182/182/0/0-Befund ist Gelb und nennt keine
  "Manipulation".
- Die Textfassung in DE, EN und NL nennt die fehlende externe Verankerung.

Klarstellung:

- Der rote Text mit Nummer und Datum gilt nicht fuer den aktuellen
  vollstaendig aufgeloesten Backup-Befund. Dieser bekommt die gelbe
  Serialisierungsmeldung.
- Eine laufende Instanz, die noch "Manipulation erkannt" zeigt, waere gegen
  den geprueften Arbeitsbaum veraltet. Die Live-Instanz wurde in dieser
  read-only Gegenpruefung nicht aufgerufen; ein Deployment-Rueckstand ist
  daher aus dem Code ableitbar, aber nicht live verifiziert.

## Antwort-Einstufung - Konfliktstand als Pflichtsignal

GRUEN:

- `AnswerGradeInput.conflictsUnproven` ist Pflicht
  (`apps/web/src/lib/answerGrade.ts:33-52`).
- `verified` verlangt ausdruecklich `!conflictsUnproven`
  (`:54-66`).
- `ConflictKnowledge` unterscheidet `loaded`, `pending` und `failed`
  (`apps/web/src/lib/effectiveAnswer.ts:44-56`).
- `conflictKnowledge()` verwirft bei Fehler auch vorhandene stale Daten und
  meldet `failed` (`:61-75`).
- `effectiveAnswer()` setzt bei jedem Zustand ausser `loaded`
  `conflictsUnproven = true` und damit hoechstens `unverified`
  (`:104-153`).
- Ask und Mobile benutzen denselben Ableiter.
- Es gibt keinen Zustand, in dem die gewaehlte sofort-vorsichtige
  Einstufung zu stark ausfaellt. Der moegliche Irrtum geht ausschliesslich
  in Richtung `unverified`, obwohl spaeter `verified` belegbar waere.

Die 23 Alt-Aufrufstellen:

- Im Produktcode gibt es keinen festen harmlosen Runtime-Wert.
- Alle 23 Vorkommen `conflictsUnproven: false` liegen in bestehenden
  Test-Fixtures.
- Ein weiteres neues Testfixture setzt den Wert auf `true`.
- Die pauschalen `false`-Werte machen einzelne alte Tests blind fuer die neue
  Bedingung, schalten sie aber nicht im Produkt ab.
- Die neue gemountete Desktop-/Mobile-Suite prueft `pending`, `failed` und
  die positive Gegenprobe `loaded + leer`.

Freitag-relevant: geschlossen.

## Health-Hinweis

GRUEN:

- `knowledgeOsHints.ts:92-101` erzeugt bei
  `conflictFactor.proven === false` einen eigenen kritischen Hinweis.
- Der Hinweis entsteht unabhaengig vom entfallenen Band.
- Dadurch kann in diesem Zustand kein `all-clear` mehr entstehen.
- `tests/analytics/mega34-health-hinweis-null-band.test.ts:45-84` deckt
  kritischen Worst Case, All-clear-Verbot, bekannten Null-Band-Zustand und
  die positive Gegenprobe bei belegter Erkennung ab.

Freitag-relevant: geschlossen beziehungsweise nicht im Kernpfad.

## Datei-Knopf und Tastatur

GRUEN fuer den beauftragten Datei-Import:

- `CaptureFileImport.tsx:71-77` enthaelt genau einen versteckten
  `input[type=file]`.
- Sichtbarer Knopf (`:111-121`) und Ablageflaeche (`:95-110`) rufen beide
  `openFileDialog()` auf, das genau diesen Ref klickt (`:65-67`).
- Der Knopf erzeugt keinen zweiten Upload- oder Egress-Pfad.
- Die Ablageflaeche ist in der zweiten Fassung ein nativer
  `<button type="button">`. Damit sind Tab-Fokus, Enter und Leertaste
  Browsersemantik; ein eigener Keydown-Handler, der doppelt ausloesen
  koennte, existiert nicht.
- `.docx` bleibt im `accept` des realen Eingangs und laeuft ueber
  `onExtractFile`.

Reichweitenklarstellung:

- Die gesamte Capture-Seite enthaelt weitere bestehende Datei-Eingaenge fuer
  die getrennten Dokument-, Bild- und Anhangswege
  (`Capture.tsx:3889`, `:3901`, `:4678`, `:4733`).
- "Es bleibt bei einem Datei-Eingang" stimmt innerhalb des hier geaenderten
  `CaptureFileImport`-Wegs, nicht als globale Aussage ueber die gesamte
  Erfassen-Seite.

Freitag-relevant: geschlossen.

## NUL-Kalibrierung und Linter-Korrektur

GRUEN:

- Die erste BSD-grep-Pruefung war als immer anschlagender Pruefer blind und
  durfte nicht als Nachweis gelten.
- Eine bytezaehlende NUL-Pruefung ist fuer diese Frage geeignet.
- Die unabhaengige Bytezaehlung auf
  `_relay/patches145/mega34.diff` ergibt 0 NUL-Bytes.
- Die Linter-Korrektur vom nachgebauten Tastatur-Div zum nativen Button ist
  semantisch richtig und vermeidet die moegliche Doppelaktivierung.

## Entscheidung fuer Donnerstag/Freitag

### Muss vor Auslieferung geschlossen werden

1. Word Copy und Insert muessen die Einstufung und Quellenzeile im
   Aktionsmoment unveraenderlich an den editierbaren Antwortkoerper
   anhaengen.
2. Ein gemounteter Laufzeittest muss eine Bearbeitung vor Abschluss der
   Quellenaufloesung und den tatsaechlichen Clipboard-/Word-Text pruefen.
3. Die unbedingten Word-Texte "Antwort aus geprueftem Wissen" und
   "geprueftes Wissen" in der Quellenzeile muessen neutralisiert werden,
   damit sie einem `unverified`-Hinweis nicht widersprechen.
4. Fuer denselben Fix sollte der Inline-Paritaetstest die neuen
   Einstufungshelfer und den vierten Builder-Parameter wirklich ausfuehren.

### Kann nach Freitag erfolgen

1. Word-Paritaetsmatrix von 48 auf alle 96 aktuellen Domaenenfaelle
   erweitern und gegen kuenftige Dimensionen kalibrieren.
2. Prozentlabel-Default und erreichbares `/ui-kit` bereinigen.
3. Audit-Hashformat versioniert kanonisieren, Cap-Rand dokumentieren und
   gegebenenfalls externen Kettenkopf einfuehren.
4. Falsche Audit-Kommentare zu 4.320 Varianten und "jeder Multi-Key-Eintrag"
   korrigieren.

## No-op-Nachweis

- Ausgefuehrt wurden ausschliesslich lesende Repo-, Datei-, Hash- und
  Analysebefehle.
- Die Audit-Zahlen wurden lokal aus dem vorhandenen TSV neu berechnet; keine
  Datenbank und kein Server wurden aufgerufen.
- Kein Build, kein Formatierer, kein Linter und keine Tests wurden
  ausgefuehrt.
- Keine Anwendung und kein Dev-Server wurden gestartet.
- Kein Produktcode und kein Git-Index wurden veraendert.
- Kein Commit und kein Push wurden ausgefuehrt.
- Jira und andere externe Systeme wurden nicht gelesen oder beschrieben.
- Keine Secrets oder ENV-Werte wurden gelesen oder ausgegeben.
- Einzige von ben erzeugte Datei ist dieser angeforderte Bericht in
  `_relay/ben/outbox/`.
- Vor dem Schreiben:
  - Status-Signatur:
    `e51bafa6dd7a96f00d5593e2af12dd29b33f08521966b72f561e9c9821047681`
  - Arbeitsbaum-Diff-Signatur:
    `35069403d6e1a483dcc263083eeda3fd7cadc9545e1655d87f7ecf2b4f2af27a`
  - Index-Diff-Signatur:
    `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

GESAMTVERDIKT: ROT
SHA-256: 6ef542ff3662eccf3382688f15d2c60223201eedf09c1c2d40ef52290cc65be5

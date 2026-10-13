# Ben-Gegenpruefung mega32

Pruefzeitpunkt: 2026-07-27
Arbeitsverzeichnis: `/Users/peterkohnert/Documents/dev_Klarwerk`
Basis: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
Branch: `main` (`5` vor, `1` hinter `origin/main`)

## Kurzurteil

mega32 schliesst mehrere Auflagen aus sammel30 im Produktcode: Die positive
Coverage-Invariante enthaelt jetzt die beiden Zahlenbedingungen, die Summary
benutzt ihren benannten Spiegel, der Langexport ist wirklich lang, und die
Quellenwahl funktioniert auch in der kritischen Reihenfolge Confluence -> JSON.

Das Gesamtverdikt ist trotzdem ROT. Drei Kernzusagen halten nicht:

1. Der Health-Score belohnt unbelegte Erkennung weiterhin numerisch.
2. Der als erschoepfend bezeichnete Paritaetstest kann eine fachlich moegliche
   Abweichung der drei Spiegel uebersehen und schuetzt keine spaetere sechste
   Bedingung.
3. Die Ask-Seite stuft nur den Vertragskasten herab. Direkt darunter und im
   Export stehen fuer dieselbe Antwort weiterhin `Gesichert` und
   `Evidenz: Gesichert`. Die mobile Antwort ist als zehnte Leseflaeche ganz
   ohne Coverage-Vorbehalt.

## Findings

### ROT 1 - Health-Score belohnt Unwissen weiterhin

`apps/web/src/lib/knowledgeHealth.ts:125-144` setzt den Konfliktabzug bei
unbelegter Erkennung auf null. Der sichtbare Score und sein Band werden danach
unveraendert aus dieser kleineren Strafsumme berechnet
(`apps/web/src/lib/knowledgeHealth.ts:144-175`).

Der eigene Test belegt die Sorge statt sie zu widerlegen:

- belegte Erkennung mit drei gefundenen Konflikten: Score `65`;
- lueckenhafte Erkennung ohne gefundene Konflikte: Score `80`.

Beleg: `tests/analytics/health-conflict-factor.test.ts:109-131`.

Die Warnung in `apps/web/src/pages/Analytics.tsx:221-236` ist sichtbar und
wertvoll. Sie aendert aber weder die Zahl `80/100` noch das daraus berechnete
Band `gut` (`apps/web/src/pages/Analytics.tsx:204-218`). Damit bleibt die
lueckenhafte Lage als hoeherer Health-Wert stehen. Der Anreiz wurde nicht
beseitigt, sondern mit einem Warntext versehen.

Die Vorgabe "Konfliktfaktor bei unbelegter Erkennung nicht einrechnen" war
unvollstaendig. Null ist hier eine Annahme ueber einen unbekannten negativen
Faktor. Das widerspricht der Beweislast-Umkehr aus Block A.

Fix-Richtung:

- Bereits gefundene Konflikte muessen mindestens als sicherer Mindestabzug
  erhalten bleiben.
- Bei unvollstaendiger Erkennung keinen voll vergleichbaren Einzelwert mit
  normalem Band zeigen. Geeignet waere ein als unvollstaendig markierter
  oberer Grenzwert oder ein Intervall:
  `Basis - maximaler Konfliktabzug` bis
  `Basis - Abzug der bereits bekannten Konflikte`.
- Das Band darf nicht normal `gut` behaupten, solange der Konfliktanteil
  unbelegt ist.

### ROT 2 - Paritaetstest ist nicht erschoepfend und kann Drift uebersehen

Die drei Produktionsfunktionen enthalten heute dieselbe Formel:

- kanonisch:
  `services/conflicts/src/coverage.ts:197-204`;
- Knowledge-Object-Spiegel:
  `services/knowledge-object/src/coverage-complete.ts:22-29`;
- Web-Spiegel:
  `apps/web/src/lib/aiCheckStatusCard.ts:177-184`.

Der aktuelle Code ist damit inhaltlich gleich. Die Aussage, die Spiegel
leiteten nichts eigenstaendig ab, ist technisch trotzdem falsch: Beide
Spiegel wiederholen die komplette boolesche Formel und entscheiden sie
eigenstaendig. Nur ein wirksamer Paritaetswaechter koennte diese Duplikation
absichern.

Der Test `tests/conflicts/coverage-invariant-parity.test.ts:47-120` hat neun
Zeilen, aber nur sieben verschiedene Wahrheitsvektoren. Drei Zeilen
(`belegt vollstaendig`, leerer Bestand, alles bereits offen) bilden denselben
Vektor ab.

Entscheidend: Die Zeile `skipped > 0` veraendert gleichzeitig
`completed` von 3 auf 2
(`tests/conflicts/coverage-invariant-parity.test.ts:63`). Damit sind zwei
Bedingungen falsch:

- `attempted === completed`
- `skipped === 0`

Entfernt nur einer der Spiegel die Bedingung `skipped === 0`, bleibt diese
Zeile wegen `attempted !== completed` unvollstaendig. Alle anderen Zeilen
bleiben ebenfalls gleich. Der gesamte Paritaetstest laeuft gruen, obwohl die
Spiegel auseinanderliegen.

Die fehlende Kombination ist fachlich moeglich, weil gespeicherte Coverage
aus zwei Laeufen zusammengefuehrt wird und die Einzellauf-Gleichung nach
`mergeCoverage` ausdruecklich nicht gilt. Beispiel:

- Lauf A: attempted 3, completed 3, skipped 0;
- Lauf B: attempted 4, completed 3, skipped 1;
- Merge: attempted 3, completed 3, skipped 1.

Damit gelten alle anderen Vollstaendigkeitsbedingungen, nur `skipped === 0`
ist falsch. Genau diesen Vektor testet die Matrix nicht.

Zur Anzahl:

- Als reine fuenfteilige boolesche Vertragsflaeche existieren `2^5 = 32`
  Kombinationen.
- Fuer einen wohlgeformten Einzellauf reduzieren Erzeuger-Invarianten die
  Zahl, aber `isCompleteRun` bewertet die zusammengefuehrte Coverage.
- Durch `min/max/sum/or` in `mergeCoverage`
  (`services/conflicts/src/coverage.ts:144-154`) werden weitere Kombinationen
  fachlich moeglich, darunter der oben belegte fehlende Vektor.

Eine spaetere sechste Bedingung ist ebenfalls nicht geschuetzt. Wird sie nur
kanonisch ergaenzt und ist sie fuer alle neun alten Fixtures wahr, bleiben
beide Spiegel und der Test gruen. Die Behauptung in
`tests/conflicts/coverage-invariant-parity.test.ts:48-50`, jeder neue Term
lasse automatisch mindestens eine Zeile kippen, ist falsch.

Fix-Richtung:

- Sofort eine Zeile pinnen, in der ausschliesslich `skipped > 0` gilt und
  `attempted === completed` erhalten bleibt.
- Fuer jeden Term einen Mutationstest verwenden, der den Term an genau einem
  Spiegel entfernt und den Paritaetstest rot sehen muss.
- Zukunftsfest ist nur ein gemeinsam importierbarer, reiner Vertrag oder ein
  versioniertes gemeinsames Contract-Artefakt. Drei handkopierte Formeln plus
  feste Beispieltabelle sichern neue Bedingungen nicht automatisch.

### ROT 3 - Ask zeigt und exportiert trotz Absenkung weiter "Gesichert"

Der neue Vertragsweg ist fuer sich korrekt:

- Er betrachtet nur die tatsaechlich herangezogenen Quellen
  (`apps/web/src/lib/askView.ts:123-140`).
- Eine unbekannte Quelle wird fail-safe als `unknown` behandelt.
- `answered=true` ohne Quellen wird serverseitig in einen Nicht-Treffer
  umgewandelt (`services/ask/src/service.ts:164-169`).
- Eine unbelegte beteiligte Quelle senkt den Vertrag herab; ein unbeteiligtes
  gedeckeltes KO im Bestand wirkt nicht auf die Antwort.

Es existieren jedoch weitere Einstufungsstellen auf derselben Seite:

- Der Antwortstatus zeigt weiter aus dem rohen `knowledgeClass`
  `Gesichert` (`apps/web/src/pages/Ask.tsx:485-490`).
- Die zweite Plakette zeigt weiter
  `Evidenz: Gesichert` (`apps/web/src/pages/Ask.tsx:491-495`).
- `answerReviewGuard` gibt bei `knowledgeClass === "gesichert"` weiterhin
  keinen Review-Hinweis zurueck
  (`apps/web/src/lib/askView.ts:152-167`).
- Kopieren und Markdown-Download exportieren weiterhin den rohen Status und
  die rohe Evidenzklasse
  (`apps/web/src/pages/Ask.tsx:220-245`,
  `apps/web/src/lib/answerExport.ts:50-60`).

Der Mounted-Test bemerkt das nicht. Er prueft nur, dass der Titel
`ask.contract.verified.title` fehlt
(`tests/ask/ask-check-caveat-mounted.test.tsx:153-155`). Dieser Titel lautet
`Quellengebundene Antwort`, nicht `Gesichert`. Die beiden positiven Plaketten
und der Export bleiben ungeprueft.

Zusaetzlich ist `sourcesCheckUnproven` im Vertrag optional
(`apps/web/src/lib/askAnswerContract.ts:66-74`). Ein anderer Aufrufer kann die
neue Bedingung daher weiter weglassen und fuer `knowledgeClass=gesichert`
`verified` erhalten. Der Produktionsaufruf in Ask reicht sie ein; der
Typvertrag verhindert eine spaetere Umgehung aber nicht.

Fix-Richtung:

- Eine einzige effektive Antwort-Einstufung aus Knowledge-Class,
  Konfliktlage und Coverage bilden.
- Vertragskasten, Statusplakette, Evidenzplakette, Review-Guard und Export
  ausschliesslich aus dieser effektiven Einstufung speisen.
- `sourcesCheckUnproven` verpflichtend machen oder statt einzelner Booleans
  direkt die bereits abgeleitete effektive Einstufung uebergeben.
- Der Mounted-Test muss fuer den gedeckelten Fall jede sichtbare und
  exportierte Form von `Gesichert` ausschliessen.

### ROT 4 - Zehnte Leseflaeche: Mobile-Antwort

`apps/web/src/lib/mobileAsk.ts:15-23` leitet die mobile Evidenz ausschliesslich
aus `answer.knowledgeClass` ab. `apps/web/src/pages/Mobile.tsx:472-518`
rendert daraus `Evidenz: Gesichert`, Trust und Quellen.

Die Mobile-Seite laedt den KO-Bestand bereits fuer Quellentitel
(`apps/web/src/pages/Mobile.tsx:213,500`), verwendet aber weder den
AI-Check-Zustand der Quelle noch bekannte Konflikte. Sie zeigt keinen
Pruefvorbehalt und keine herabgestufte effektive Evidenz.

Das ist eine eigenstaendige zehnte Leseflaeche. Sie wiederholt den Befund aus
Block E ausserhalb der Desktop-Ask-Seite.

Fix-Richtung: Den gemeinsamen effektiven Antwortvertrag auch fuer Mobile
verwenden. Mindestens die Coverage der tatsaechlichen Quell-KOs aus dem
bereits geladenen Bestand muss einbezogen werden; fuer vollstaendige
Konfliktparitaet ist zusaetzlich die Konfliktlage erforderlich.

### GELB 1 - Langtest ist lang, aber die behauptete Titelreihenfolge ist blind

Der neue Test ist wirklich ein Langtest:

- zwoelf lange KOs und mindestens 20.000 Zeichen fuer Markdown, MediaWiki und
  HTML (`tests/library/ai-check-coverage-reach.test.ts:289-345`);
- acht lange KOs und mindestens 10.000 Zeichen fuer die Output Factory
  (`tests/library/ai-check-coverage-reach.test.ts:347-380`);
- Warnsatz im vordersten Zehntel und mit grosser Distanz zum Ende.

Damit ist die sammel30-Auflage zur Laenge und Enddistanz erfuellt.

Die kommentierte Reihenfolge `Titel -> Warnsatz -> erster Inhalt` ist fuer
Markdown/MediaWiki jedoch nicht gepinnt. `firstTitle` wird zwar in
`tests/library/ai-check-coverage-reach.test.ts:329-331` gesucht, danach aber
nie mit `note` verglichen. Produktiv steht der Warnsatz in beiden Formaten vor
dem ersten Titel:

- `services/library-analytics/src/service.ts:1177-1181`;
- `services/library-analytics/src/service.ts:1189-1211`.

HTML und Output Factory pinnen ihren Kopf vor dem Warnsatz korrekt. Fuer
Markdown/MediaWiki ist die Sichtbarkeit sehr gut, aber der behauptete exakte
Vertrag "unter Titel oder Exportkopf" ist nicht bewiesen und mangels
Exportkopf nicht umgesetzt.

Fix-Richtung: Entweder einen echten Exportkopf hinzufuegen und
`Kopf < Warnsatz < erster Inhalt` pinnen oder den Vertrag ehrlich auf
`Warnsatz vor erstem Inhalt` begrenzen. Die ungenutzte `firstTitle`-Variable
ist ein weiterer blinder Pruefer im selben Auftrag.

## Gruene Gegenpruefungen

### Kanonische Invariante und Summary

Die aktuelle Produktionsformel ist an allen drei Orten identisch und enthaelt
die fuenf geforderten Bedingungen. Die Bestandszusammenfassung schreibt die
Formel nicht mehr in ihrer Schleife aus, sondern ruft
`isCompleteAiCheckCoverage` auf
(`services/knowledge-object/src/service.ts:1514-1522`).

Das behebt den konkreten sammel30-Produktfehler. ROT bleibt der unzureichende
Driftschutz der drei Kopien, nicht die heutige Formel.

### Antwortvertrag - keine Ueberabsenkung durch fremde KOs

Die Absenkung betrachtet nur `result.sources`. Ein gedeckelter Lauf eines
unbeteiligten KOs wirkt nicht auf die Antwort. Sind alle herangezogenen
Quellen belegt, bleibt der neue Vertragskasten verifiziert. Der Weg ohne
Quellen wird serverseitig als unbeantwortet normalisiert.

Die Richtung "nicht zu weit" ist damit im neuen Vertragskasten GRUEN.
Die Gegenrichtung ist wegen der positiven Parallelplaketten ROT.

### Quellenwahl

`tests/app/import-source-selection-mounted.test.tsx:183-196` pinnt exakt die
kritische Reihenfolge erst Confluence, dann JSON. Der alte DOM-Durchgriff
haette dort null Dialoge erzeugt.

Die Implementierung erhoeht bei jeder JSON-Wahl monoton
`filePickRequest` (`apps/web/src/components/ImportStepper.tsx:118-132`);
der JSON-Kasten beobachtet diesen Wert ueber seine eigene Ref
(`apps/web/src/components/ImportJsonUpload.tsx:49-58`).

Direkt JSON, wiederholt JSON, Confluence -> JSON sowie Rueckwechsel sind
getestet. Auch JSON -> Confluence -> JSON funktioniert aus der Mechanik:
jede zweite JSON-Wahl erhoeht den Zaehler erneut und die Ref ist nach dem
Render wieder vorhanden. Es wurde kein dritter aktuell geraeuschlos
ausfallender Reihenfolgepfad gefunden. Ein expliziter Pin fuer diese
Spiegelsequenz waere sinnvoll, ist aber kein aktueller Blocker.

### Korrigierte Egress- und NUL-Pruefung

Die zweite Egress-Gegenprobe traegt bei unabhaengiger statischer Kontrolle:
In den mega32-Produktpfaden wurde keine direkte `fetch`-, Axios-, XHR-,
Undici-, Modell-, Judge- oder Embedder-Kante gefunden. Die Treffer sind
bestehende API-Wrapper (`endpoints.*`) bzw. React-Query-`refetch`.

Die zweite NUL-Pruefung ist als byteweise Pruefung mit positiver und negativer
Kalibrierung geeignet. Eine unabhaengige byteweise Gegenprobe ueber
`od -t x1` und exakte `00`-Bytes ergab:

- Datei mit NUL: erkannt;
- Datei ohne NUL: kein Falschpositiv;
- `_relay/patches143/mega32.diff`: NUL-frei.

Eine weitere blinde Pruefung existiert dennoch: der Paritaetstest aus ROT 2.
Ausserdem behauptet der Langtest eine Titelreihenfolge, die er nicht
assertiert. Die Kalibrierung hat also die beiden urspruenglichen Detektoren
repariert, aber nicht alle Beweisluecken dieses Auftrags beseitigt.

## Prioritaet

Ohne die aufgehobene VIP-2-Sperre sollten die folgenden Punkte nicht
zurueckgestellt werden:

1. Health-Score als unvollstaendigen Grenzwert/Intervall statt als normalen
   hoeheren Score darstellen.
2. Effektive Antwort-Einstufung zentralisieren und Desktop-Plaketten, Export
   und Mobile daran anschliessen.
3. Paritaetsmatrix mindestens um den isolierten `skipped`-Vektor erweitern
   und den Vertrag gegen spaetere Bedingungen versionieren oder gemeinsam
   importierbar machen.
4. Langexport-Vertrag fuer Markdown/MediaWiki entscheiden und exakt pinnen.

## No-op-Nachweis

- Produktcode geaendert: nein.
- Tests oder Build ausgefuehrt: nein.
- Anwendung oder Server gestartet: nein.
- Commit erstellt: nein.
- Push ausgefuehrt: nein.
- Jira gelesen oder geschrieben: nein.
- Secrets oder ENV-Werte gelesen/ausgegeben: nein.
- `_relay/patches143/mega32.diff` SHA-256:
  `277e9915004167e47f9c4458966fb61c446704cebaaececa7af5091f21780b9f`.
- Hand-Bericht Inhalts-SHA-256:
  `d468c4f41b8520f8a13aa30a26e2f219c1a2d0635f3c0b9dac8b6af7d12153ed`.
- Vor Berichtserstellung:
  `git status --porcelain=v1` SHA-256
  `fff596607aed9d6078e4d8d8f5743eaa78332cf2589349a3360d288060647deb`;
  `git diff --binary d3fe69d` SHA-256
  `40d6ef5730815fa97f77bfab1a688cb4f565bdf2454b297a660be6e3453f9712`;
  Index-Diff leer.
- Der vorgefundene kumulative Arbeitsbaum blieb unangetastet. Geschrieben
  wird ausschliesslich dieses angeforderte Berichtsartefakt.

GESAMTVERDIKT: ROT
SHA-256: ce83a7d2befd9c020273a0eec5dd006fb6cb63db984038475dacfaa815867973

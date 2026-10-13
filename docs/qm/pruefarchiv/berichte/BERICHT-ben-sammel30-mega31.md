# Ben-Gegenpruefung mega31

Pruefzeitpunkt: 2026-07-27 07:16:59 CEST
Arbeitsverzeichnis: `/Users/peterkohnert/Documents/dev_Klarwerk`
Basis: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
Branch: `main` (`1` hinter, `5` vor Upstream)

## Kurzurteil

Die beiden ROT-Ursachen aus sammel28/sammel29 sind im produktiven Kern von mega31
geschlossen:

- Ein Vergleich zaehlt nur noch als abgeschlossen, wenn ein nicht-null Verdict
  vorliegt. Fuer beide produktiven Providerpfade ist ein gueltiges negatives Urteil
  immer ein Objekt; `null` ist ein Fehlerausgang.
- `failed` und `pending` werden in der Bestandszusammenfassung unabhaengig von den
  Coverage-Merkern als unvollstaendig gezaehlt.

Das alte ROT ist damit aufgehoben. Fuer mega31 insgesamt bleibt das Verdikt GELB:
Die jetzige Vollstaendigkeitsaussage prueft die numerischen Erfolgsinvarianten noch
nicht fail-safe, die geforderte Reihenfolgeprobe verwendet nur einen kurzen Export,
und die Antwortansicht ist eine weitere ungedeckte Leseflaeche.

## Befunde

### GELB 1 - Vollstaendigkeit wird nicht vollstaendig positiv bewiesen

`services/conflicts/src/coverage.ts:143-148` definiert einen Lauf als vollstaendig,
wenn `capped=false`, `aborted=false` und `skipped=0` gelten. Die Funktion prueft
nicht zusaetzlich:

- `selected === available`
- `attempted === completed`

Auch `services/knowledge-object/src/service.ts:1498-1515` stuft einen `done`-Lauf
nur anhand der drei Marker als unvollstaendig ein. Ein inkonsistenter oder alter
Coverage-Datensatz mit `completed < attempted`, aber ohne gesetzten Marker, wuerde
weiter schweigen. Die heutigen Erzeuger setzen bei den bekannten Fehlerwegen die
Marker korrekt; deshalb ist das kein reproduzierter aktueller Laufzeitfehler.
Pedis umgedrehter Vertrag "vollstaendig nur bei ausdruecklich belegtem Erfolg" ist
aber strukturell noch nicht ganz durchgesetzt.

Empfehlung: Eine gemeinsame positive Invariante verwenden, beispielsweise
`selected === available && attempted === completed && skipped === 0 &&
!capped && !aborted`, und Summary sowie Oberflaechen ausschliesslich daraus
ableiten. Einen Negativtest mit inkonsistenten Zahlen pinnen.

### GELB 2 - Geforderter Langdokument-Beleg fehlt

Die vier Produktwege sind korrekt umgebaut:

- MediaWiki: `services/library-analytics/src/service.ts:1168-1181`
- Markdown: `services/library-analytics/src/service.ts:1184-1211`
- HTML: `services/library-analytics/src/service.ts:1214-1246`
- Output Factory: `services/output/src/service.ts:76-94`

Der Warnsatz steht jeweils vor dem eigentlichen Inhalt; beim HTML nach dem Titel.
Der Reihenfolgetest `tests/library/ai-check-coverage-reach.test.ts:250-288` pinnt
das mit Zeichenpositionen. Er erzeugt jedoch nur ein einziges kurzes KO
(`Zweiter Inhalt` bzw. `Fabrikinhalt`). Die ausdruecklich verlangte Probe an einem
langen Beispiel ist damit nicht erbracht.

Empfehlung: Einen Export mit mehreren langen KOs erzeugen und weiterhin
`Titel < Warnsatz < erster Inhalt` sowie eine deutliche Distanz zum Dokumentende
pinnen. Die Implementierung selbst ist hier GRUEN; offen ist die Beweisluecke.

### GELB 3 - Neunte Leseflaeche: Antwortansicht

`apps/web/src/pages/Ask.tsx:109-129` leitet `sourcesConflicted` allein aus bereits
bekannten Konflikten ab. Dieser Wert steuert den Antwortvertrag. Der Warnhinweis
und die Konflikt-Badges erscheinen nur bei bekannten Treffern
(`apps/web/src/pages/Ask.tsx:559-612`).

Bei unvollstaendiger Erkennung kann eine Quelle deshalb weiter als nutzbar bzw.
die Antwort als gesichert erscheinen, obwohl unbekannte Konflikte nicht
ausgeschlossen sind. Das ist die neunte relevante Leseflaeche.

Empfehlung: Den Coverage-Status der Antwortquellen in den Antwortvertrag
einbeziehen. Solange mindestens eine Quelle keinen vollstaendig belegten Lauf
hat, darf der Vertrag nicht "gesichert" behaupten und muss den konkreten
Pruefvorbehalt anzeigen.

### GELB 4 - Kommentar-Invariante beim Abbruch ist falsch

`services/conflicts/src/coverage.ts:48-50` behauptet fuer jeden Einzellauf
`attempted = completed + skipped`. Beim kapazitaetsbedingten Abbruch zaehlt der
abbrechende Kandidat als `attempted`, aber weder als `completed` noch als
`skipped`; `aborted=true` traegt den Ausgang separat. Der Zaehler selbst ist
fachlich nachvollziehbar, der Kommentar ist es nicht.

Empfehlung: Entweder die dokumentierte Gleichung auf nicht-abgebrochene Laeufe
begrenzen oder den terminal abgebrochenen Versuch in einer eigenen numerischen
Groesse ausweisen. Ein Test sollte die gewaehlte Invariante explizit pinnen.

## Detailpruefung

### 1. Providervertrag: gueltige Nicht-Treffer sind nie null - GRUEN

Konflikt:

- Der Modellprompt erlaubt `kein_konflikt`
  (`services/reasoner/src/provider-model.ts:249-257`).
- `parseConflictResponse` liefert fuer ein gueltiges
  `kein_konflikt` einschliesslich Pflichtfeldern ein Verdict-Objekt und nur bei
  ungueltiger Antwort `null`
  (`services/reasoner/src/provider-model.ts:317-350`).
- `judgeConflictOutcome` akzeptiert nur ein nicht-null Verdict als Erfolg und
  klassifiziert `null` als Provider-/Parsefehler
  (`services/reasoner/src/service.ts:1253-1305`).

Duplikat:

- Der Modellprompt erlaubt `verschieden`
  (`services/reasoner/src/provider-model.ts:353-378`).
- `parseDuplicateResponse` liefert fuer ein gueltiges `verschieden` ein
  Verdict-Objekt und nur bei ungueltiger Antwort `null`
  (`services/reasoner/src/provider-model.ts:383-429`).
- `judgeDuplicateOutcome` behandelt den nicht-null Ausgang als Erfolg und
  `null` als Fehler (`services/reasoner/src/service.ts:1324-1372`).

Die produktiven Provideraufrufe laufen ueber diese Parser
(`services/reasoner/src/provider-model.ts:1040-1064`). Es wurde kein weiterer
produktiver Judge-Provider gefunden, der ein gueltiges negatives Urteil als
`null` ausdrueckt. Die Behauptung der Hand ist fuer den aktuellen
Produktionsvertrag exakt.

### 2. Duplikat-Skipped-Zaehler - GRUEN mit Dokumentationsauflage

Die gemeinsame Umkehr liegt in
`services/conflicts/src/coverage.ts:91-103`. Der Duplikatweg erhoeht `skipped`
bei strukturiertem null-Urteil und bei geworfenen, nicht-terminalen
Kandidatenfehlern; ein gueltiges `verschieden` erhoeht `completed`
(`services/conflicts/src/overlap-service.ts:224-291`,
`services/conflicts/src/overlap-service.ts:308-377`).

Ein `ModelCapacityError` beendet den Lauf und wird ueber `aborted` abgebildet.
Das ist keine still uebersprungene Fortsetzung, deshalb ist die getrennte
Semantik vertretbar. Falsch ist nur die oben genannte Kommentar-Gleichung.

### 3. Deckel-Fixtures und unveraenderte Erwartungen - GRUEN

Der Vergleich mega29 gegen mega31 zeigt:

- Die fehlerhaften null-Fakes wurden durch echte Nicht-Treffer-Verdicts
  `kein_konflikt` bzw. `verschieden` ersetzt.
- Die zugehoerigen Erwartungswerte der Deckel-Tests wurden nicht veraendert.
- Damit beweisen die betroffenen Tests weiterhin dieselbe Deckel- und
  Abbruchmechanik; nur der Providervertrag der Fixtures wurde realistisch.

Ein weiterer null-Fake bleibt in
`tests/conflicts/coverage-terms.test.ts:314-320`. Dessen Test prueft nur
relative Vorauswahl-/Mergewerte und nicht die Completed-/Skipped-Semantik.
Er ist kein Blocker fuer den Deckelbeleg, sollte aber zur Vermeidung der alten
Begriffsverwechslung bereinigt werden.

### 4. Rechnung bei 39 Objekten - GRUEN

Die Hand hat recht. Der echte Duplikatpfad bildet fuer jedes Subjekt den
Kandidatenpool aus dem Bestand und deckelt auf 20. Bei 39 Objekten stehen je
Subjekt 38 Nachbarn zur Wahl; `selected/attempted=20` und `capped=true`.
Deshalb waren bereits vor mega31 alle 39 Objekte in einem erfolgreichen realen
Lauf als unvollstaendig erkennbar.

Die stille Entwarnung trat unterhalb des Deckels auf, beispielsweise bei
hoechstens 21 Gesamtobjekten bzw. bei fachlich kleinerem Kandidatenpool, wenn
ein gescheiterter Lauf makellose Marker trug. Dieser Fall ist im Produkt real:
neue oder kleine Bestaende beginnen regelmaessig unterhalb des Deckels.

### 5. 39er-Nachrechnung - GRUEN

`tests/library/mega31-bestand-39-umkehr.test.ts:63-89` erzeugt echte KOs,
verwendet `buildServices`, `createAiCheckRunner` und
`recordAiCheckOutcome`. Nur der externe Provider ist kontrolliert ersetzt.

Der Test prueft:

- erfolgreicher Lauf: 38 verfuegbar, 20 versucht, `capped=true`,
  `incomplete=39` (`:93-116`);
- 429: `completed=0`, ehrliches `skipped`, weiterhin
  `incomplete=39` (`:118-137`);
- gescheiterte Laeufe ohne Marker: jetzt `incomplete=39`
  (`:142-171`);
- Altlaeufe ohne Coverage: eigener `noCoverage`-Zaehler (`:174-188`).

Eine Aenderung an Deckel, Runner oder Summary wuerde die Erwartungen brechen.
Das ist echte Orchestrierung, keine Nachbildung der Kernlogik.

### 6. Risikoansicht - GRUEN

`apps/web/src/pages/Risk.tsx:127-138` rendert den Pruefvorbehalt unabhaengig
von der Hoehe der KPI. Der Mounted-Test
`tests/conflicts/mega31-risiko-caveat-mounted.test.tsx:111-142` pinnt
unvollstaendige, fehlende und vollstaendige Coverage.

### 7. Import-Timeout und Statusschreib - GRUEN mit Restrisiko

Worker und Import-Accept verwenden dieselbe Funktion und dieselbe Konstante:

- `runWithTimeout` und `AI_CHECK_JOB_TIMEOUT_MS`
  (`services/app/src/ai-check-worker.ts:47-50,235-271`);
- Worker-Aufruf (`services/app/src/ai-check-worker.ts:368-390`);
- Import-Aufruf (`services/app/src/routes/library-routes.ts:301-323`).

`settled` verhindert, dass ein spaeter Providerabschluss einen zweiten
Timeout-Ausgang erzeugt. Die Importkante ruft
`recordImportAcceptAiCheck` genau einmal auf. Der echte Haegetest pinnt
`failed/timeout` und genau einen Schreibaufruf
(`tests/app/import-accept-aicheck-honesty.test.ts:336-385`).

Ein Nullschreib ist weiterhin moeglich, wenn der eine Persistenzversuch selbst
scheitert; `recordImportAcceptAiCheck` faengt das best-effort ab
(`services/app/src/routes/library-routes.ts:108-121`). Aus dem Timeout entsteht
aber weder ein Doppel- noch ein fehlender Aufruf. Der nicht abbrechbare spaete
Runner kann weiterhin interne Detection-Nebenwirkungen beenden; er schreibt
jedoch keinen zweiten AI-Check-Status. Das ist eine spaetere
Cancellation-/Job-Queue-Haertung, kein mega31-Blocker.

### 8. Arbeitsuebersicht und Knowledge-Health

Die Einschaetzung der Hand stimmt:

- Die Arbeitsuebersicht interpretiert bekannte Konflikte primaer als
  Arbeitsvorrat. Ein zu niedriger Wert ist irrefuehrend, aber keine direkt
  verbesserte Qualitaetskennzahl.
- `knowledgeHealth` zieht fuer offene Konflikte bis zu 20 Punkte ab
  (`apps/web/src/lib/knowledgeHealth.ts:57,66-79`). Weniger erkannte Konflikte
  erhoehen den Score. `Analytics` berechnet diesen Wert direkt aus der
  Konfliktliste (`apps/web/src/pages/Analytics.tsx:102-109`).

Eine Fussnote reicht beim Health-Score nicht: Die Zahl selbst bleibt in die
falsche Richtung verzerrt. Bei unvollstaendiger Erkennung muss der Score als
unvollstaendig/Intervall ausgewiesen oder der Konfliktfaktor aus der
Punktzahl herausgenommen werden. Da die alte VIP-2-Sperre entfallen ist,
sollte diese Korrektur nicht weiter zurueckgestellt werden.

## Beurteilung der Hand-Aussagen

- Der fruehere Positivtest mit `null` als sauberem Nicht-Treffer war fachlich
  ungueltig und konnte die Umkehr nicht beweisen: bestaetigt.
- Die korrigierten gueltigen Verdict-Fixtures machen den Beleg jetzt tragfaehig:
  bestaetigt.
- Bei 39 Objekten dominiert der Deckel bereits vor mega31: bestaetigt.
- Der relevante stille Fehler liegt in kleinen bzw. fachlich unter dem Deckel
  bleibenden Bestaenden: bestaetigt und produktreal.
- Arbeitsuebersicht schwach, Knowledge-Health gefaehrlicher: bestaetigt.
- Eine reine Fussnote am Knowledge-Health-Score waere unzureichend: bestaetigt.

## Aufhebung der frueheren ROT-Befunde

Sammel28/sammel29 ROT-1 ist aufgehoben: `null` wird in beiden Erkennungswegen
nicht mehr als abgeschlossener Vergleich gezaehlt, und der produktive
Providervertrag unterscheidet gueltige Nicht-Treffer eindeutig.

Sammel28/sammel29 ROT-2 ist aufgehoben: `failed` und `pending` koennen nicht
mehr aufgrund fehlender Coverage-Marker als vollstaendig schweigen;
Altbestand ohne Coverage wird separat und ehrlich ausgewiesen.

Das Gesamt-GELB ist kein Fortbestehen dieser beiden ROT-Ursachen. Es folgt aus
den neu abgegrenzten Restauflagen: positive numerische Invariante, echter
Langdokument-Beleg und Coverage-Ehrlichkeit in Antwortansicht/Health-Score.

## No-op-Nachweis

- Produktcode geaendert: nein.
- Tests oder Build ausgefuehrt: nein.
- Anwendung/Server gestartet: nein.
- Commit: nein.
- Push: nein.
- Jira gelesen oder geschrieben: nein.
- Secrets/ENV gelesen oder ausgegeben: nein.
- `_relay/patches142/mega31.diff` SHA-256:
  `7fb0ea4800d2f86e2f05d8f7ba510895e70faa068a8de43cc068a70f4c5aa697`.
- Hand-Bericht Inhalts-SHA-256:
  `f428a21b497d75f776168bc5c4bba85421f6123bdd63be1ba761d9f7c452ece9`.
- Der vorgefundene kumulative Arbeitsbaum blieb unangetastet; einzig dieses
  geforderte Berichtsartefakt wird in die Ben-Outbox geschrieben.

GESAMTVERDIKT: GELB
SHA-256: fb29a4beeca85182e15cda41a98d40c8f6cf9e89383262c156c0f6b3dbb365e5

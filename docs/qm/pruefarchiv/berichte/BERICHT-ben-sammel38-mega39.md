# BERICHT ben sammel38 - Gegenpruefung mega39

Ben / Codex, 27.07.2026

## 1. Auftrag, Referenz und Methode

Geprueft wurde der Auftrag
`_relay/ben/inbox/AUFTRAG-ben-sammel38.md` mit SHA-256
`d039ef604fe58508edcce1c591d94d664a85681c5312661299eb319470ba061f`.

Referenz:

- Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Branch: `main`
- HEAD/Basis: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
- kumulativer Diff: `_relay/patches150/mega39.diff`
- bestaetigter Diff-SHA-256:
  `8e73ffa3c617df851b8d7002a0d9751e10664a1f0e320a50e2604b4f9918ad89`
- Handbericht: `_relay/hand/outbox/BERICHT-mega39.md`
- nachgerechneter Inhalts-SHA des Handberichts ueber die ersten 611 Zeilen:
  `8cbf047f2b254a954c149bb23b8e6809caa499730c650bf4222d4df8d0ce3066`

Die Gegenpruefung war statisch und read-only. Ich habe Diff, Ist-Code,
Tests und Berichte gelesen. Die vom Auftrag bereits bestaetigten
Diff-/NUL-/Pfad-Zaehlungen wurden nicht erneut gefahren. Es wurden keine
Builds und keine Tests ausgefuehrt.

## 2. Findings zuerst

### Kein verbleibender Pre-Ship-Codeblocker aus sammel37

Die fuenf von mir in sammel37 verlangten Reparaturen sind in mega39
inhaltlich geschlossen:

1. Rollenempfehlungen lesen dieselbe Rollenquelle wie Navigation und Router.
2. Die drei Topbar-Chips laufen durch den echten Ungespeichert-Waechter.
3. Eine neue Frage entfernt das Ergebnis der vorigen Frage bereits am Start.
4. Quellen- und Schrittedarstellung behaupten keine nicht belegte Herleitung mehr.
5. Der Web-Lockfile ist Eingang des Dist-Frische-Waechters.

Ich finde in diesen Reparaturen keinen neuen Egress-, Persistenz- oder
Datenverlustpfad. Der Stand ist aus Code-Sicht fuer die Auslieferung am
Mittwoch freigegeben.

### Kein Ship-Blocker: Viewer/Experte sehen keinen leeren Fokus-Platzhalter

Fuer Viewer und Experte ist `focus` jetzt korrekt `null`
(`apps/web/src/lib/workCenter.ts:94-112`). Die Startseite rendert dann den
gesamten Fokus-Link einschliesslich der Beschriftung "Dringendste offene
Arbeit" gar nicht (`apps/web/src/pages/Start.tsx:499-524`). Es bleibt weder
eine leere Ueberschrift noch ein Platzhalter oder ein leeres Kartenloch.

Der richtige erste Weg ist bereits oberhalb davon vorhanden:

- Viewer: `Frage stellen`;
- Experte: `Wissen erfassen`.

Beide kommen aus `CTA_PRIMARY` und stehen als lauter Primaerknopf im
Seitenkopf (`Start.tsx:62-84,252-275`). Testaufgabe 1 ist deshalb nicht
blockiert.

### Post-Friday-UX-Rest: sichtbare Arbeitszahlen fuehren weiter auf Controller-Seiten

Die globale Liste unter dem Fokus bleibt fuer alle Rollen sichtbar und
rendert jeden Eintrag als Link auf sein unveraendertes Ziel
(`Start.tsx:531-565`). Fuer Viewer und Experte sind alle fuenf Ziele
Controller-Seiten (`navigation.ts:131-187`); der Router schickt sie wieder
nach `/start` (`routes.tsx:97-102`).

Das betrifft auch den von der Hand genannten Lernpfad, und nicht nur Viewer:
`useLearningPath(role)` sowie `learningOpenSteps` laufen fuer jede Rolle
(`Start.tsx:196-220`), waehrend die einzige Lernpfad-Anzeige in
`/lebenszyklus` liegt und diese Route Controller voraussetzt. Eine
Experten-Testerin kann daher ebenfalls eine eigene Lernpfad-Zahl sehen,
aber nicht oeffnen.

Das beruehrt Testaufgabe 1 "Anmelden und umsehen", ist fuer den
Freitag-Goldpfad aber kein Ship-Blocker: Der Primaerweg ist klar und
rollenrichtig, und keine der sieben Aufgaben verlangt den Lernpfad. Nach
Freitag sollte die Zeile entweder auf eine fuer die Rolle sichtbare
Lernpfad-Ansicht fuehren oder fuer nicht berechtigte Rollen nicht als
klickbare Arbeit erscheinen.

### Operativer Korrekturpunkt: der verdeckte Key-Befehl ist fuer zsh falsch

Der Handbericht nennt:

`read -rs -p "Schluessel: " KLARWERK_SHIP_SMOKE_API_KEY`

Das ist Bash-Syntax. Auf dem hier verwendeten macOS-`zsh` bedeutet `-p`
"vom Coprocess lesen" und ist kein Prompt-Schalter. Kopierfaehig fuer zsh
ist:

`read -rs 'KLARWERK_SHIP_SMOKE_API_KEY?Schluessel: ' && echo && export KLARWERK_SHIP_SMOKE_API_KEY`

Das ist kein Produktcode-Blocker. Der korrigierte Befehl muss aber in der
Mittwoch-Checkliste verwendet werden, sonst ist diese nicht ohne Rueckfrage
abarbeitbar.

## 3. Block A - eine Rollenquelle

**Verdikt: GRUEN.**

`WORK_ROLES` existiert als Laufzeittabelle nicht mehr. `canActOn` sucht das
Klickziel in `ALL_ITEMS` und delegiert an `roleAllows`; unbekannte Ziele
fallen auf `false` (`workCenter.ts:94-99`). Sidebar und Router lesen
dieselbe Navigationsquelle (`navigation.ts:65-67`, `routes.tsx:97-102`).

Der neue Test schreibt keine zweite Erwartungsmatrix ab. Er gewinnt die
fuenf Kategorien aus `buildWorkOverview`, findet deren Ziele in
`ALL_ITEMS` und vergleicht jedes der 20 Rollen-/Kategoriepaare mit
`roleAllows` (`tests/app/mega39-empfehlung-rollenquelle.test.ts:25-86`).

Die verbliebenen Treffer auf `WORK_ROLES` sind historische Kommentare und
Testbegruendung; sie behaupten keine aktive zweite Liste. Die Entscheidung,
Viewer und Experte keine der fuenf Controller-Arbeiten als Fokus zu
empfehlen, ist logisch und fail-closed.

## 4. Block B - Topbar und Sammler

**Verdikt: GRUEN.**

`ReasonerStatusPill`, `ExternalStagePill` und `KiModePill` verwenden jetzt
jeweils `GuardedLink` nach `/admin`
(`apps/web/src/shell/Topbar.tsx:223-240,247-264,272-318`). Der gemountete
Test prueft alle drei echten Anker in einem `NavGuardProvider`: Dialog
erscheint und der Ort bleibt `/erfassen`
(`tests/app/mega39-topbar-chips-guarded-mounted.test.tsx:138-185`).

Der Shell-Sammler bestimmt seinen Scope rekursiv aus allen `.ts/.tsx` unter
`apps/web/src/shell`, ausgenommen Testdateien
(`tests/app/shell-links-guarded.test.ts:29-50`). Er faengt:

- navigierende Named-Imports aus `react-router-dom`, auch Aliase;
- rohe `<Link>` und `<NavLink>`;
- direkte `window.location`-, History- und statische interne Anchor-Wege.

Er besitzt keine dateibezogene Ausnahmeliste. Seine offen dokumentierten
Grenzen sind reale Grenzen eines Textscanners: Kindkomponenten ausserhalb
von `shell`, dynamisch berechnete Ziele, `window.open` oder indirekte
Re-Exports koennen ihn umgehen (`shell-links-guarded.test.ts:21-24`).
Das macht ihn nicht zu einer vollstaendigen Architekturgrenze, aber der
aktuelle Produktfall wird zusaetzlich durch den echten Mount-Test bewiesen.
Fuer den Ship ist das ausreichend.

## 5. Block C - Ergebnis an die Frage binden

**Verdikt: GRUEN.**

`onMutate` leert vor jedem Netzaufruf `result`, `receipt`, `gapId` und die
bedankten Quellen (`apps/web/src/pages/Ask.tsx:145-178`). Damit sind bei
Fehler und Netzabbruch weder alte Antwortkarte noch alter Gap-Einstieg oder
alte Exportknopfe vorhanden.

Die Randfaelle tragen:

- Zwei Bedienversuche waehrend eines Laufs werden zentral durch
  `ask.isPending` abgewehrt (`Ask.tsx:242-255`); Formular und Beispielchips
  sind ebenfalls gesperrt (`Ask.tsx:450-455,491-495`).
- Ein abgebrochener Request endet nach dem bereits erfolgten `onMutate`
  ohne altes Ergebnis.
- Antwort -> Wissensluecke und Wissensluecke -> Antwort beginnen jeweils
  mit leerem `result`/`gapId`; `onSuccess` setzt danach nur den neuen
  Ausgang.
- Kopieren, Markdown und Druck sind innerhalb der Ergebnisdarstellung
  erreichbar und `buildExport` liefert ohne aktuelles beantwortetes
  `result` nichts (`Ask.tsx:286-348,571-673`).

Der neue Sequenztest Erfolg -> Folgefrage -> Fehler prueft sowohl den
sichtbaren Text als auch das Verschwinden der Exportflaeche
(`tests/ask/mega39-fehler-ohne-fremde-antwort.test.tsx:148-233`).

Ein programmatisch erzwungener paralleler `mutate`-Aufruf ausserhalb der
zentralen UI-Funktion waere kein bedienbarer Produktweg. Fuer die
erreichbaren Ausgaenge ist die Klasse geschlossen.

## 6. Block D - ehrliche Nachweisqualitaet

**Verdikt: GRUEN.**

Die Regel in `askSteps.ts` ist exakt:

- Schritt ohne `sourceId`: sichtbar;
- `sourceId` fehlt in der Quellenliste: sichtbar;
- `sourceId` steht in der Quellenliste: ausgeblendet.

`stepsBeyondSources` filtert nur die zusaetzlichen Schritte und
`stepsWorthShowing` zeigt den Abschnitt nur bei mindestens einem solchen
Schritt (`apps/web/src/lib/askSteps.ts:30-59`). Die Ask-Seite rendert genau
diese gefilterte Menge (`Ask.tsx:689-724`). Im heutigen Modellweg entstehen
`sources` und `steps` 1:1 aus `relevant`
(`services/reasoner/src/provider-model.ts:985-1023`); dort verschwindet die
Doppelliste deshalb vollstaendig. Bei einem kuenftigen abweichenden Schritt
bleibt nur dessen eigene Fundstelle sichtbar. Die Regel zeigt somit weder
immer alles noch immer nichts.

Die sichtbaren Begriffe lauten nun "Herangezogene Kontextquellen" sowie
entsprechend EN/NL. `ask.sourcesHint` sagt ausdruecklich, dass der
Antworttext die Zuordnung nicht markieren muss. Hilfe und FAQ sagen
ebenfalls nur "herangezogen", nicht "hergeleitet"
(`apps/web/src/i18n.ts:1711,1732,3195,5590,5601,6976,9331,9342,10703`;
`apps/web/src/lib/faqContent.ts:303-309`).

Eine Suche nach den alten Zusagen findet im Produkt nur noch historische
Kommentare. Eine vierte aktive Produktbehauptung wurde nicht gefunden.
Der Markdown-Export fuehrt die herangezogenen Kontextquellen weiterhin
zweimal auf, aber unter ehrlichen Titeln; das ist Dichte, keine falsche
Nachweisbehauptung. Die echte cited-vs-consulted-Modellierung bleibt wie
beauftragt nach Freitag.

## 7. Block E - Dist-Frische

**Verdikt: GRUEN.**

`apps/web/package-lock.json` steht jetzt in `QUELL_PFADE`
(`scripts/dist-frische.ts:102-113`). Das passt zur Build-Topologie:
`tools/build` startet Vite in `apps/web`, dessen eigene `package.json` und
Lockdatei die Web-Abhaengigkeiten festlegen (`tools/build:9-17`).

Der Sammler vergleicht alle Top-Level-Eintraege von `apps/web` gegen
`QUELL_PFADE` oder `NICHT_EINGANG`, verlangt einen nichtleeren
Begruendungstext, verbietet verwaiste Ausnahmen und leere Quellpfade
(`tests/smoke/dist-frische.test.ts:95-135`). Neue Dateien innerhalb von
`src` oder `public` sind bereits rekursiv gedeckt; neue
Top-Level-Konfigurationen werden rot.

Eine beliebige Begruendung mit mehr als 20 Zeichen koennte technisch als
Ausnahme eingetragen werden. Das ist keine geheime Umgehung: Sie verlangt
eine sichtbare, reviewbare Codeaenderung am zentralen Register. Als
Regressionstest ist das angemessen; als Schutz gegen einen boeswilligen
Committer war der Waechter nie gedacht.

`smoke:ui` und `smoke:ui:gate` koppeln den Frischelauf per `&&` hart vor
Playwright (`package.json:21-23`). Der direkte Playwright-Aufruf bleibt
moeglich, ist nun aber in beiden Skripten ehrlich als nicht geschuetzter
Nebenweg benannt. Die behauptete Garantie stimmt damit.

## 8. Block F und G - kleine Reste

**Verdikt: GRUEN.**

Die alte untracked Datei `tests/i18n/zz-j1-probe.test.ts` aus mega38
enthielt 14 `expect`-Aufrufe. Die neue
`tests/i18n/lib-zaehlzeile-und-beispielfrage.test.ts` enthaelt ebenfalls
14. Der Vergleich zeigt nur den bereinigten Dateikopf; die sechs Tests und
alle 14 Zusicherungen zu Zaehllinie und Beispielfrage sind erhalten.

`missionsForRole` und `missions.*` haben keinen Laufzeitverwender mehr.
Ausser dem erklaerenden historischen Kommentar in `Start.tsx` bleibt kein
Quelltreffer. Das Loeschen von `missions.ts` und seinem Selbsttest verliert
keine Produktfunktion.

`aria-invalid` folgt jetzt demselben `emptyAttempted`-Praedikat wie die
sichtbare Meldung (`Ask.tsx:422-470`). Vor dem ersten Versuch ist das Feld
nicht als fehlerhaft markiert, nach leerem Enter-Submit sind Meldung und
ARIA-Signal gleichzeitig aktiv. Der aktualisierte Mount-Test pinnt beide
Phasen (`tests/ask/ask-empty-guard-mounted.test.tsx:104-139`).

## 9. Hermetik und Egress

**Verdikt: GRUEN auf Basis der vorgelegten Evidence.**

Alle im Handbericht zitierten Einzeltestbefehle tragen
`KLARWERK_SKIP_KEYCHAIN=1`. Der Abschlusslauf wird als Aufruf aus einer
Shell mit vorher und nachher `UNSET` dokumentiert. Unabhaengig davon setzt
die echte Playwright-Webserver-Konfiguration
`KLARWERK_SKIP_KEYCHAIN: "1"` fest und schliesst im Gate lokalen LLM und
externe Suche (`playwright.smoke.config.ts:181-213`). Die Hermetik haengt
damit nicht von der Aufrufer-Shell ab.

Fuer mega39 wurden nur Rollenlogik, Navigation, lokaler UI-Zustand,
Filterlogik, Frischelisten, Texte und Tests veraendert. Kein
Provider-, Credential-, Fetch- oder Server-Egress-Modul wurde angefasst.
Die kalibrierte Egress-Ernte des Handberichts nennt nur bekannte
Testfixtures und Abort-Regeln; keine Trefferdatei ist eine mega39-Datei.

Ein separates maschinenlesbares mega39-Ausfuehrungslog liegt nicht im
Postfach. Der Laufbeleg ist daher Berichtsevidence, waehrend die
entscheidenden Hermetikgrenzen im Code statisch nachvollzogen sind. Der
Auftrag untersagte ausdruecklich, die bereits bestaetigten Laeufe zu
wiederholen.

## 10. Die sieben Testaufgaben

| Nr. | Testaufgabe | Urteil | Begruendung |
|---:|---|---|---|
| 1 | Anmelden und umsehen | **GRUEN** | Zweck-Satz und rollenrichtiger Primaerweg bleiben sichtbar. Der unzugaengliche Lernpfad beruehrt diese Aufgabe als alter UX-Rest, blockiert den vorgesehenen Weg aber nicht. |
| 2 | Wissen erfassen und einreichen | **GRUEN** | Die drei neuen Topbar-Ausgaenge sind durch `GuardedLink` und echten Dirty-Mount-Test abgesichert. |
| 3 | Eine Frage stellen und ihr vertrauen oder nicht | **GRUEN** | Antwort, Fehler und Luecke kommen sichtbar an; eine Folgefrage kann keine alte Antwort mehr rendern/exportieren; Copy behauptet keine Herleitung. |
| 4 | In der Bibliothek wiederfinden | **GRUEN** | Im mega39-Scope kein Weg- oder Datenverlust; die umbenannte Zaehllinien-Sonde behielt alle Zusicherungen. |
| 5 | Ein Word-Dokument hineinbringen | **GRUEN** | Kein mega39-Eingriff in diesen bereits abgenommenen Pfad; realer Datei-/Manifest-Handlauf bleibt erforderlich. |
| 6 | Klara in Word | **GRUEN im Code-Scope** | Keine Regression; voller Drei-Engine-Smoke und die reale Word-Handpruefung bleiben das Auslieferungstor. |
| 7 | Das eigene Urteil | **GRUEN** | Keine fremde Vorantwort nach Fehler und keine falsche Quellen-/Herleitungszusage mehr. |

Die in sammel37 roten Aufgaben 1, 2, 3 und 7 sind damit nicht mehr rot.
Alle sieben Aufgaben sind im mega39-Scope gruen.

## 11. Was am Mittwoch von Hand laufen muss

Die fachliche Menge ist vollstaendig, aber der Handbericht ist allein noch
nicht in jedem Punkt ohne Rueckfrage abarbeitbar:

1. Der Ship-Key-Befehl muss in der oben genannten zsh-Fassung verwendet
   werden.
2. Vor Word muss das neue Manifest in der tatsaechlich getesteten
   Word-Version neu sideloaded sein.
3. Fuer Natascha muessen Konto und Rolle vor dem Lauf feststehen. Nach
   aktuellem Plan ist `Experte` der naheliegende Goldpfad; dann sind
   Erfassen, Fragen und Bibliothek erreichbar, Controller-Flaechen nicht.
4. Der 14-Schritte-Word-Lauf steht vollstaendig in
   `_relay/hand/outbox/BERICHT-mega38.md`, Abschnitt
   "DIE HANDPRUEFUNG IN WORD AM MITTWOCH".
5. Der Erstnutzerlauf darf nicht auf die vier mega39-Differenzen reduziert
   werden. Fuer den kompletten Lauf sind die sieben Aufgaben der
   Generalprobe zu verwenden; die mega39-Liste ist nur der gezielte
   Regressionszusatz.

Mit diesen konkretisierten Bedienpunkten ist die Reihenfolge
"Drei-Engine-Smoke -> Word 14 Schritte -> Erstnutzerlauf" ausreichend und
ohne technische Rueckfrage abarbeitbar. Jeder rote Handschritt stoppt die
Auslieferung; das ist ein Auslieferungstor, kein offener Codebefund.

## 12. No-op-Nachweis

Vor der Berichtablage:

- HEAD:
  `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`;
- getrackter Produkt-Diff-SHA:
  `2e5709cd04729201bcdf95784233c73d02f330854bce985cc97450729c199ecb`;
- Index-Diff-SHA (leer):
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
- Statussignatur:
  `b9ada414d88d05d5662600b563535f9cd7ee0acd978ca1e2574c3ed0b50968ba`.

Ich habe keinen Produktcode und keine bestehende Datei geaendert, keinen
Build und keinen Test ausgefuehrt, keine App und keinen Server gestartet,
nichts zum Index hinzugefuegt, keinen Commit erzeugt, nichts gepusht und
Jira nicht aufgerufen. Die einzige dauerhafte Schreiboperation ist dieser
angeforderte Bericht. HEAD, Produkt-Diff, Index-Diff und Statussignatur
werden nach seiner Ablage erneut verglichen.

Der mega39-Stand ist fuer Mittwoch shippbar. Die fuenf offenen
sammel37-Punkte sind geschlossen. Es bleibt kein Pre-Ship-Codeblocker.

GESAMTVERDIKT: GRUEN
SHA-256: e9f5bd3e48c2765d73c35ec86ab09debc860cad8c180d480bc254634d1ca4ba1

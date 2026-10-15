# BERICHT ben sammel37 - Gegenpruefung mega38

Ben / Codex, 27.07.2026

## 1. Auftrag, Referenz und Methode

Geprueft wurde der Auftrag
`_relay/ben/inbox/AUFTRAG-ben-sammel37.md` mit SHA-256
`3016a800177452b60fa0fd018a4849d148459c57ab91dfe1ba4a5a48c402a35c`.

Referenz:

- Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Branch: `main`
- HEAD/Basis: `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`
- kumulativer Diff: `_relay/patches149/mega38.diff`
- Diff-SHA-256:
  `2a1090a499ead07877c76272a2730c9d111955a3c000279d8d1632c8650fa6e0`
- Handbericht: `_relay/hand/outbox/BERICHT-mega38.md`
- bestaetigter Inhalts-SHA des Handberichts ueber die ersten 805 Zeilen:
  `64a6c685739f5deb5983893a9035a3c4dd2d49697a15233365f7e52893628288`

Die vorgegebenen Hashes und Zeilenzahlen stimmen. Die Gegenpruefung war
statisch/read-only: Diff, Ist-Code, Tests und Berichte wurden gelesen und
miteinander verglichen. Es wurden keine Builds und keine Tests ausgefuehrt.
Bereits gruen gegebene Runden und die ausdrueckliche Nicht-Gegenstandsliste
wurden nicht neu bewertet.

## 2. Findings zuerst

### ROT 1 - Die neue rollenbewusste Empfehlung fuehrt Viewer und Experten weiter in gesperrte Ziele

`apps/web/src/lib/workCenter.ts:70-76` erlaubt `criticalGaps` und `learning`
fuer Viewer, Experte, Controller und Admin. Die zugehoerigen Ziele sind aber
fest `/risiko` (`workCenter.ts:35`) und `/lebenszyklus`
(`workCenter.ts:37-40`).

Die zentrale Rollenquelle widerspricht:

- `/risiko` hat `minRole: "controller"`
  (`apps/web/src/app/navigation.ts:169-174`);
- `/lebenszyklus` hat `minRole: "controller"`
  (`navigation.ts:178-183`);
- der echte Router leitet eine nicht berechtigte Rolle auf `/start` zurueck
  (`apps/web/src/routes.tsx:97-102`).

Damit kann `primaryWorkItem(overview, role)` auf der Startseite
(`apps/web/src/pages/Start.tsx:239-242`) einem Viewer oder Experten
"Dringendste offene Arbeit" zeigen, deren Klick lediglich auf dieselbe
Startseite zurueckleitet. Das ist genau die Sackgasse, die Block G3 laut
Kommentar beseitigen sollte.

Ein Rollen-Pin fehlt: `tests/app/work-center.test.ts:126-158` prueft nur den
rollenlosen Altvertrag. Weder Viewer/Experte noch Controller/Admin werden
gegen die echten Route-Rechte kalibriert.

**Impact:** erster Eindruck und Testaufgabe 1; zudem ist die neue
Produktbehauptung "rollenbewusst" falsch.

**Vor Ship erforderlich:** `WORK_ROLES` und Zielwahl aus derselben
Rollenquelle wie Navigation/Router ableiten. Entweder Viewer/Experte fuer
diese Kategorien nicht empfehlen oder je Rolle auf einen wirklich
erlaubten Handlungsweg fuehren. Mit vier Rollen und allen fuenf
Arbeitskategorien gegen `roleAllows` pinnen.

### ROT 2 - Die drei neuen Admin-Chips umgehen den zentralen Ungespeichert-Waechter

Die drei Betriebs-Chips wurden korrekt auf Admins begrenzt, aber als rohe
React-Router-`Link`s nach `/admin` umgesetzt:

- `ReasonerStatusPill`: `apps/web/src/shell/Topbar.tsx:217-235`;
- `ExternalStagePill`: `Topbar.tsx:241-259`;
- `KiModePill`: `Topbar.tsx:266-313`;
- Admin-only-Mount: `Topbar.tsx:443-459`.

Das widerspricht der im selben Produkt festgeschriebenen Shell-Grenze:
Shell-Navigation muss `GuardedLink` oder `useGuardedNavigate` verwenden
(`apps/web/src/app/NavGuardContext.tsx:310-326`). Der Waechter ist
quellenbasiert; ein normaler `Link` ruft `guard()` nicht auf
(`NavGuardContext.tsx:381-430`).

**Impact:** Ein Admin kann beim Erfassen oder in einem anderen Dirty-Flow
einen Status-Chip anklicken und ohne Speichern-/Verwerfen-Dialog nach
`/admin` wechseln. Das ist ein neuer Datenverlust-Ausgang und betrifft
Testaufgabe 2. Der vorhandene Shell-Test erfasst diese drei neu
hinzugekommenen Links nicht.

**Vor Ship erforderlich:** alle drei `Link`s durch `GuardedLink` ersetzen
und mindestens einen gemounteten Admin-Fall mit aktivem Dirty-Guard pinnen.

### ROT 3 - Nach Fehler einer Folgefrage erscheint die alte Antwort wieder unter der Fehlermeldung

Der neue Fehlerkasten ist fuer die erste fehlgeschlagene Frage richtig.
Der Zustandsvertrag bei einer Folgefrage ist jedoch inkonsistent:

- `onSuccess` ersetzt `result`, ein `onMutate`/`onError` zum Leeren oder
  Binden des alten Ergebnisses existiert nicht
  (`apps/web/src/pages/Ask.tsx:143-157`);
- `submitAsk` setzt nur `asked` und startet die Mutation
  (`Ask.tsx:224-233`);
- waehrend Pending wird das alte Ergebnis korrekt ausgeblendet
  (`Ask.tsx:542-544`);
- nach einem Fehler ist Pending wieder falsch, `result` bleibt aber das
  Ergebnis der vorigen Frage. Daher werden Fehlerkasten und alte Antwort
  gleichzeitig gerendert (`Ask.tsx:524-544`).

Besonders kritisch: `asked` ist dann bereits die neue Frage. Export- und
Anzeigewege koennen dadurch die alte Antwort mit der neuen Frage
zusammenbringen.

Der neue Test prueft nur den leeren Erstzustand
(`tests/ask/mega38-antwort-ankunft.test.tsx:244-269`). Der reale
Regressionsfall "Antwort 1 erfolgreich, Frage 2 scheitert" fehlt.

**Impact:** Testaufgaben 3 und 7. Eine technisch gescheiterte zweite Frage
kann so aussehen, als habe Klarwerk neben der Fehlermeldung doch geantwortet.
Das ist fuer Vertrauen schlimmer als eine reine Fehlermeldung.

**Vor Ship erforderlich:** Ergebnis an den erfolgreichen Request binden
oder beim Start einer neuen Frage leeren; im Fehlerfall darf nie ein
Ergebnis einer anderen Frage rendern/exportiert werden. Sequenztest
Erfolg -> Folgefrage -> Fehler ergaenzen.

### ROT 4 - Block F ist strukturell korrekt vertagt, aber die sichtbare Erklaerung bleibt zu weit

Die vier Aussagen der Hand zu F sind im Kern bestaetigt:

1. Im Modellweg entstehen `sources` und `steps` 1:1 aus derselben Menge
   `relevant` (`services/reasoner/src/provider-model.ts:1011-1021`).
2. `DEFAULT_TOP_K = 8` ist die Obergrenze der Retrieval-Auswahl
   (`services/reasoner/src/provider.ts:447-451`;
   `services/ask/src/service.ts:155-163`). Die sichtbare Acht ist damit die
   konkrete Treffermenge in diesem Lauf, nicht die Zahl nachweislich
   zitierter Quellen. Acht ist ein Cap, keine garantierte feste Zahl.
3. Der Antworttext wird nach `complete()` nur getrimmt
   (`provider-model.ts:1002-1010`). Es gibt keinen Rueckparser, der
   `[n]`-Verweise in eine benutzte Quellenmenge ueberfuehrt.
4. Der Prompt erlaubt Quellenverweise nur ("Du darfst"), er verlangt kein
   verbindliches Zitatformat (`provider-model.ts:75-83`).

Die echte Trennung "herangezogen" gegen "tatsaechlich benutzt" kann daher
vertretbar nach Freitag gebaut werden. Der aktuelle Text muss bis dahin
aber innerhalb der belegten Wahrheit bleiben. Das tut er noch nicht:

- `ask.sourcesHint` behauptet in DE/EN/NL, der Antworttext nenne die
  Quellen, auf die er sich stuetzt
  (`apps/web/src/i18n.ts:1732-1733,5601-5602,9342-9343`);
- der Prompt garantiert genau das nicht;
- `ask.steps` heisst weiterhin "Argumentationsschritte"
  (`i18n.ts:1711,5590,9331`), obwohl die Liste nur dieselben
  herangezogenen Quellen samt Aussage wiederholt
  (`Ask.tsx:662-692`).

**Impact:** Testaufgaben 3 und 7. Die Seite erklaert eine nicht vorhandene
Nachweisqualitaet.

**Vor Ship erforderlich:** kein Backend-Umbau, sondern enger Copy-Fix:
den letzten Satz aus `ask.sourcesHint` entfernen/relativieren und
"Argumentationsschritte" als herangezogene Kontextquellen benennen oder
die doppelte Liste ausblenden. Die strukturelle Zitat-Trennung bleibt
Post-Freitag.

### GELB 5 - Der Frische-Waechter ist beiden Smoke-Befehlen vorgeschaltet, aber seine Eingabemenge ist unvollstaendig

Positiv:

- `smoke:ui` und `smoke:ui:gate` beginnen beide mit
  `npm run --silent smoke:ui:frisch` und sind per `&&` hart gekoppelt
  (`package.json:21-23`);
- `scripts/smoke-dist-frisch.ts:8-14` beendet einen unfrischen Lauf mit
  Exit-Code 1;
- kein `|| true`, kein Warn-only-Pfad;
- die eigentliche Entscheidung ist in beide Richtungen gepinnt
  (`tests/smoke/dist-frische.test.ts:24-70`).

Die Aussage "alles, woraus vite build das Buendel erzeugt" ist dennoch zu
weit: `QUELL_PFADE` enthaelt `apps/web/package.json`, aber nicht
`apps/web/package-lock.json`
(`scripts/dist-frische.ts:83-95`). Der Lockfile ist ein realer Build-Input
des `npm ci`/Vite-Builds. Eine reine Lockfile-Aenderung kann deshalb bei
altem `dist` den Frische-Check passieren.

Ein direkter manueller Playwright-Aufruf umgeht den npm-Waechter ebenfalls;
das ist fuer die zwei benannten Smoke-Befehle akzeptabel, sollte aber nicht
als allgemeine Integritaetsgarantie beschrieben werden.

**Vor Ship empfohlen:** `apps/web/package-lock.json` aufnehmen und mit
einem Sammler-Test pinnen. Fuer den aktuellen Stand ist kein konkreter
staler Lockfile-Build belegt; deshalb GELB statt ROT.

## 3. Gegenpruefung A bis D

### A - GELB im Slice, wegen ROT 3 insgesamt nicht abgenommen

Der Ladeblock sitzt an der Ergebnisstelle und traegt eine stabile
Mindesthoehe (`Ask.tsx:488-523`). Antwort, Luecke und Fehler scrollen zum
Kopf und fokussieren den Anker (`Ask.tsx:182-219`).

Die Zusatzfragen:

- **Sehr kurze Antwort:** greift. Die Effekte haengen an `result`, nicht an
  Textlaenge.
- **Zwei Fragen schnell hintereinander:** waehrend die erste laeuft,
  verhindert `ask.isPending` einen zweiten Start
  (`Ask.tsx:221-233`).
- **Nutzerin scrollt waehrend des Ladens selbst:** der Pending-Effekt
  feuert nur beim Wechsel in Pending und nicht bei jedem Render. Es gibt
  deshalb keinen dauernden Ruecksprung. `behavior: "smooth"`
  (`Ask.tsx:192-194`) kann waehrend der kurzen Browseranimation noch mit
  einer sofortigen Handbewegung konkurrieren; ein wiederholtes
  "unter dem Finger wegziehen" ist aus dem Code aber nicht erkennbar.
- **Fehleranzeige vorher:** Im vorigen Ask-Code gab es keinen gerenderten
  Fehlerzustand; der Nebenfund der Hand stimmt.
- **Folgefehler:** ROT 3 bleibt offen.

Die vier neuen Tests sind reale Mount-Tests, decken aber weder
Folgefehler noch Nutzer-Scroll-Interaktion ab.

### B - GRUEN

Im Vollauswahl-Ziehweg werden Outcome, Inhalt, Auswahl und Quellen-Tor
geprueft. Danach wird `dataTransfer` geholt; fehlt es oder fehlt
`setData`, folgt vor jedem Output-Schreiben `preventDefault`, dann erst
der abgeleitete Fallback und die Warnung
(`taskpane.html:1851-1888`). Ein roher Standard-Drag bleibt nicht offen.

`tests/app/mega38-word-ziehweg.test.tsx:167-196` deckt getrennt ab:

- kein `dataTransfer`;
- vorhandener Behaelter ohne `setData`.

Die Gegenprobe mit funktionsfaehigem Behaelter
(`:198-216`) verhindert einen Dauer-Abbruch-Test. B ist belastbar.

### C - GELB

Fuer die beiden vereinbarten npm-Befehle ist der Exit-1-Abbruch wirksam
und vorgeschaltet. Die fehlende Lockfile-Abdeckung steht in GELB 5.

### D - GRUEN

Der neue Kommentar behauptet nur noch, dass bei nicht aufgeloesten
Quellen keine **vollstaendige Antwortausgabe** das Tor passiert. Er benennt
Teilauswahl und fehlenden Behaelter als separate Grenzen
(`taskpane.html:1642-1651`). Das entspricht dem Code.

## 4. Gegenpruefung E bis J auf Verlust

### E - GRUEN

"Zuletzt erfasst" beschreibt die Live-Wall-Sortierung nach `createdAt`
ohne Statusfilter. Die Umbenennung entfernt die belegte Kollision
"Frisch gesichert" bei offenem Wissen.

### F - ROT in der sichtbaren Restcopy

Die Summenbeschriftung "Quelle(n) herangezogen" ist korrekt. Die noch zu
weiten Texte `ask.sourcesHint` und `ask.steps` stehen in ROT 4.

### G1 - GRUEN

Der neue positive Zweck-Satz steht direkt unter dem Seitenkopf
(`Start.tsx:276-286`) und ist DE/EN/NL hinterlegt.

### G2 - GELB, kein Laufzeitblocker

Der gestrichene Kachelblock war eine zweite Navigation. Seine Ziele sind
weiter ueber Navigation, Wissenskreis und Arbeitsblock vorhanden. Der
gestrichene KPI-Block verliert keine Zahl:

- Gesamtbestand, validiert, offen und offene Luecken stehen nun zusammen
  in `KnowledgeCapitalNumbers`
  (`apps/web/src/components/FunkeCards.tsx:75-91`);
- Kategorien und aktive Autoren bleiben ebenfalls sichtbar.

`apps/web/src/lib/missions.ts` hat ausser seinem eigenen Test keinen
Verwender mehr. Die Suche findet nur:

- den Selbsttest `tests/app/missions.test.ts`;
- einen Kommentar in `Start.tsx`.

Der Befund der Hand stimmt. Loeschen kann bis nach Freitag warten: der
Code ist nicht im erreichbaren Produktpfad und veraendert keine VIP-Aufgabe.
Vorheriges Entfernen waere Hygiene, keine Ship-Bedingung.

### G3 - ROT

Controller und Admin erreichen die Validierungs-Warteschlange weiter mit
einem direkten Zweitlink in `Start.tsx:266-272`, ueber Navigation und ueber
die Arbeitsliste. Der Admin verliert keine erforderliche Zahl oder
Steuerflaeche.

Der Viewer/Experte-Fall ist wegen ROT 1 jedoch falsch. Ausserdem wurden
deren erlaubte Missions-Deep-Links entfernt; die Wege bleiben zwar in der
Navigation, aber die neue Fokuslogik ersetzt sie nicht verlaesslich durch
einen erlaubten Weg.

"Dringendste offene Arbeit" ist fuer die Funktion selbst treffender als
"Bester naechster Einstieg": `primaryWorkItem` sortiert nach
`critical -> today -> later`, stabil in fester Kategorienreihenfolge
(`workCenter.ts:56-95`). Es ist keine personenbezogene Empfehlung. Wegen
der falschen Rollen-Zielmatrix ist die konkrete Anzeige trotzdem nicht
immer handlungsfaehig.

### H - ROT

Admin-only und die Klartext-Tooltips sind richtig. Die drei rohen Links
oeffnen aber den neuen NavGuard-Bypass aus ROT 2.

### I - GELB / eigene Scheibe bestaetigt

Die Groessenordnung der Hand ist eher konservativ als uebertrieben:

- in DE enthalten 60 String-Zeilen `Trust/trust`, davon 24 direkte
  einzeilige Key-Wert-Eintraege;
- in NL sind es 59 String-Zeilen, ebenfalls 24 direkte einzeilige
  Key-Wert-Eintraege;
- hinzu kommen mehrzeilige Hilfe-, Demo- und Erklaertexte.

Damit ist "rund dreissig Anzeige-Schluessel plus Fliesstexte" als
Arbeitsgroesse plausibel. Eine halbseitige Ersetzung waere inkonsistent.
Die vollstaendige Umbenennung gehoert in eine eigene Post-Freitag-Scheibe,
nicht in einen Mittwoch-Hotfix.

### J - GRUEN

Die sichtbaren Korrekturen sind eng:

- Singular/Plural wird gepinnt, nicht neu erfunden;
- Leerfrage-Hinweis erscheint erst nach echtem Fehlversuch;
- Importtitel-Regel hat Positiv- und Negativrichtung;
- redundante Capture-Hinweise sind entfernt.

Die drei bekannten TypeScript-Fehler in
`apps/web/src/lib/captionAiSuggest.test.ts:30-37` sind real: auf der Union
`CaptionSuggestOutcome` wird ohne Narrowing `.messageKey` gelesen
(`captionAiSuggest.ts:166-168`). Root-`tsc` und Docker-Vite-Build sehen
diesen co-located Test nicht. Das ist eine Gate-Luecke, aber kein
ausgelieferter Laufzeitfehler. Sie muss nicht vor Mittwoch blockieren;
nach Freitag sollten die drei Tests genarrowt und der
`apps/web`-Typecheck in CI/Gesamtgate aufgenommen werden.

## 5. Hermetik und Egress

Die neun gegen mega37 veraenderten Bloecke und 26 neuen Bloecke wurden
unabhaengig verglichen. In mega38 geaendert wurden nur Web-/UI-, Smoke-,
Text- und Testflaechen; kein Reasoner-, Modellclient-, Credential- oder
Server-Egress-Modul wurde in dieser Runde geaendert.

Die Egress-Ernte ueber hinzugefuegte Diff-Zeilen ist kalibriert und
plausibel:

- nur Test-/Fixture-URLs und drei
  `appsforoffice.microsoft.com/**`-Abort-Regeln;
- kein `sendBeacon`, `new WebSocket` oder `XMLHttpRequest`;
- kein neuer produktiver Fetch in den mega38-Bloecken.

Die Selbstanzeige ist daher mit dem Diff vereinbar: Der kurze Cloud-Egress
kam aus einem manuell falsch gestarteten Einzeltest, nicht aus einer
Egress-Codeaenderung.

Der Abschlusslauf war laut Handbericht in einer Shell, in der
`KLARWERK_SKIP_KEYCHAIN` von aussen **nicht** gesetzt war. Das ist die
richtige Gegenprobe: `playwright.smoke.config.ts:181-218` setzt
`KLARWERK_SKIP_KEYCHAIN: "1"` und leere Modell-/Suchwege direkt in der
Webserver-Umgebung, also unabhaengig von der Aufrufer-Shell.
`tests-smoke/smoke-umgebung.spec.ts` prueft den resultierenden
Reasoner-Zustand. Die Hermetik des gemeldeten Torlaufs ist damit
strukturell gestuetzt.

Die Assertion-Zahlen der zwei nachgezogenen Word-Waechter blieben beim
Vergleich mega37 -> mega38 gleich:

- `mega36-word-ausgaenge.test.tsx`: 67;
- `word-taskpane-kopieren.spec.ts`: 21.

Die Wortlautnachfuehrung hat dort keine Zusicherung entfernt.

## 6. Die sieben VIP-Testaufgaben

| Nr. | Testaufgabe | Urteil | Begruendung |
|---:|---|---|---|
| 1 | Anmelden und umsehen | **ROT** | Startseite ist klarer, Zahlen und Controller-Warteschlange bleiben. Viewer/Experte koennen aber durch die neue Fokuslogik auf rollenbedingt gesperrte Ziele geschickt werden (ROT 1). |
| 2 | Wissen erfassen und einreichen | **ROT** | Der Erfassungsfluss selbst wurde hier nicht beschaedigt. Fuer Admins erzeugen die drei neuen Topbar-Links jedoch einen NavGuard-Bypass mit moeglichem Verlust ungespeicherter Arbeit (ROT 2). |
| 3 | Eine Frage stellen und ihr vertrauen oder nicht | **ROT** | Lade-/Fehlerankunft ist deutlich besser. Eine fehlgeschlagene Folgefrage kann aber die alte Antwort unter der neuen Fehlermeldung wieder anzeigen; Quellen-Erklaerung und "Argumentationsschritte" ueberzeichnen weiterhin den Nachweis (ROT 3/4). |
| 4 | In der Bibliothek wiederfinden | **GRUEN im mega38-Scope** | Kein benoetigter Bibliotheksweg oder Bestandswert wurde entfernt. Nicht-Gegenstaende wurden nicht neu bewertet. |
| 5 | Ein Word-Dokument hineinbringen | **GRUEN im mega38-Scope** | Keine neue Regression im Importweg gefunden; der echte Datei-/Manifest-Handlauf bleibt Auslieferungsnachweis. |
| 6 | Klara in Word | **GRUEN im Code-Scope, Freigabe ausstehend** | Fehlendes/ungeeignetes `dataTransfer` ist fail-closed, Wartetext neutral. Vor Ship bleiben voller Drei-Engine-Smoke und die reale 14-Schritte-Handpruefung. |
| 7 | Das eigene Urteil | **ROT** | Die effektive Einstufung ist besser, aber alte Antwort unter Folgefehler und die zu weite Quellen-/Schritte-Erklaerung beeintraechtigen genau die eigenstaendige Beurteilung. |

Damit ist die enge Abschlussliste aus sammel36 **noch nicht erledigt**.
Die urspruenglichen A-/B-Kernfehler sind geschlossen; mega38 hat beim
Umbau von Startseite/Topbar und im neuen Ask-Fehlerzustand neue
Pre-Ship-Kanten eingefuehrt.

## 7. Word-Handpruefung

Die auf 14 Punkte erweiterte Handpruefung reicht fuer den fokussierten
Word-Ausgabe-Vertrag:

- die bisherigen zwoelf Schritte bleiben inhaltlich erhalten;
- bens `dataTransfer=null`/fehlendes-`setData` ist als maschineller
  Nachweisverweis unveraendert in Punkt 13 enthalten;
- die Teilauswahl aus dem read-only Fallbackfeld ist unveraendert als
  echter Handsmoke in Punkt 14 enthalten;
- Vollauswahl, Teilauswahl, Copy, Cut, Drag, beide Schaltflaechen,
  Fallback, Idempotenz, beide Grade und DE/EN/NL sind abgedeckt.

Sie ist noch **auszufuehren** in der tatsaechlich auszuliefernden
Word-/Manifest-Version. Sie ersetzt weiterhin nicht den Erstnutzerlauf
auf Start, Fragen und Bibliothek.

## 8. Enger Pre-Ship-Schnitt

Vor Mittwoch sind aus dieser Gegenpruefung genau diese Punkte zu schliessen:

1. Rollenmatrix/Ziele von `primaryWorkItem` an echte Route-Rechte binden
   und rollenweise pinnen.
2. Drei Topbar-Statuslinks auf `GuardedLink` umstellen und Dirty-Admin-Fall
   pinnen.
3. Ask-Ergebnis requestgebunden machen; Erfolg -> Folgefrage -> Fehler
   pinnen.
4. `ask.sourcesHint` und `ask.steps` auf die belegte Aussage reduzieren.
5. `apps/web/package-lock.json` in den Frische-Waechter aufnehmen.

Danach: voller Drei-Engine-Smoke mit dem benannten Ship-Key, 14-Schritte-
Word-Handpruefung und der separate Erstnutzerlauf.

Post-Freitag koennen bleiben:

- echte cited-vs-consulted-Datenmodellierung;
- vollstaendige Trust->Vertrauenswert-Scheibe;
- Entfernen von `missions.ts` samt Selbsttest;
- Reparatur der drei co-located Test-Typfehler plus Erweiterung des
  Typecheck-Gates.

## 9. No-op-Nachweis

Vor der Berichtablage:

- HEAD:
  `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e`;
- getrackter Produkt-Diff-SHA:
  `6e4a1444cadcf5f1c80c3b507295b8845f2e51956cbe2c94a2a2899584e5bcaf`;
- Index-Diff-SHA (leer):
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
- um die Zieldatei bereinigte Statussignatur:
  `c821b284d2843dba3c7d2f917cda0605c7036e883088d6dad50ab2239c29c5a8`.

Ich habe keinen Produktcode und keine bestehende Datei geaendert, keinen
Build und keinen Test ausgefuehrt, keine App und keinen Server gestartet,
nichts zum Index hinzugefuegt, keinen Commit erzeugt, nichts gepusht und
Jira nicht aufgerufen. Die einzige dauerhafte Schreiboperation ist dieser
angeforderte Bericht. HEAD, Produkt-Diff, Index-Diff und bereinigte
Statussignatur werden nach seiner Ablage erneut verglichen.

GESAMTVERDIKT: ROT
SHA-256: b520f17c5b630c9ea29ae75974ded5144dc861616bdeebfd9a66dadf5bfb069d

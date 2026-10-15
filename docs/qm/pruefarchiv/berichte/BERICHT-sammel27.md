# SAMMEL27 - Review Cockpit-Linie / Patch 72

**Datum:** 22.07.2026  
**Pruefer:** ben / Codex  
**Baseline:** `2727b7e84d4a42056f0641174ac693121200ebbb` (Ship 7)  
**Kettenannahme:** Patches 57-71 davor  
**Pruefobjekt:** `_relay/patches72/0001-feat-web-WP-COCKPIT-LINIE-Import-Cockpit-als-gefuehr.patch`  
**Patch-SHA-256:** `3889f41bc9026268adb8e7c3188982307e243c1842bd5b77e08e6a21ee7b5e09`

## Methode

Patch 72 wurde nach der vollstaendigen Folge 57-71 in einem separaten, per `git archive` erzeugten Snapshot mit `git apply --check` geprueft und dort nur fuer die statische Gesamtanalyse materialisiert. Das Arbeits-Repo blieb unberuehrt. Kein Bau und kein Testlauf; die angegebene Evidence `407 Testdateien / 3015 Tests` ist Fremdevidence und wurde nicht nachgerechnet.

Alle Zeilenangaben beziehen sich auf den materialisierten Endstand 57-72.

## Kurzfazit

**GESAMTVERDIKT PATCH 72: ROT / NO-GO AS-IS.**

Patch 72 ist tatsaechlich ein reiner Frontend-Kompositionsslice: keine Route, kein API-Vertrag und kein Servermodul werden geaendert. Explore, Select, Group und Apply rufen weiter dieselben Endpunkte mit denselben Payloads auf; die Review-Queue bleibt funktional vorhanden. Der zentrale neue Stepper bildet den realen Ablauf jedoch nicht korrekt ab:

1. **Schritt 5 wird auf dem normalen Erfolgsweg nie aktiv.** Waehrend `apply` laeuft, bleibt `aria-current` auf Schritt 4; danach springen alle Schritte direkt auf erledigt.
2. **Der monotone Context erzeugt falsche Erledigt-Haken.** Nach einer Bilanz bleibt der Stand `applied` auch dann erhalten, wenn eine neue Eingrenzung `ImportGroups` remountet und ein neuer Gruppen-/Apply-Lauf erforderlich ist.

Damit scheitert der Slice an seinem eigenen Kernversprechen „kein falscher erledigt-Haken / aria-current korrekt“. Die Produkt- und Datenlogik wird dadurch nicht beschaedigt, aber die VIP2-Fuehrung zeigt gerade auf einem normalen Wiederholungsweg einen falschen Zustand. Der Fix ist klein und rein lokal im Stepper-State plus zwei Mounted-Tests.

## Befunde

### F1 - ROT - Schritt 5 ist nie der aktive Schritt

- `apps/web/src/lib/importStepper.ts:30-36` ordnet `grouping` dem aktiven Index 3 zu, also Schritt 4. `applied` setzt den aktiven Index direkt hinter alle fuenf Schritte.
- `apps/web/src/components/ImportGroups.tsx:193-206` meldet nur `grouping`, sobald Gruppendaten vorliegen, und `applied`, sobald die Bilanz vorliegt.
- `runApply` setzt zwar `busy="apply"` in `apps/web/src/components/ImportGroups.tsx:234-285`, meldet dem Stepper aber keinen eigenen Zustand `applying`.
- Ergebnis auf jedem regulaeren Apply: Vor und waehrend des Requests bleibt Schritt 4 `aria-current="step"`; nach der Antwort sind sofort alle fuenf Schritte `done`. Schritt 5 ist zu keinem Zeitpunkt aktiv.
- Der lineare Mounted-Test bestaetigt dieses falsche Modell sogar: `tests/app/import-stepper-mounted.test.tsx:189-205` erwartet vor Apply weiter Schritt 4 und danach direkt keinen aktiven Schritt. Er prueft nicht, dass Schritt 5 waehrend der Uebernahme aktiv ist.

**Impact:** Screenreader und sichtbare Leiste melden waehrend der eigentlichen Uebernahme den falschen Arbeitsschritt. Das ist kein Randfall, sondern der normale Erfolgsweg.

**Fix-Richtung:** Eine eigene Stufe `applying` einfuehren: Schritte 1-4 erledigt, Schritt 5 aktiv. `reach("applying")` unmittelbar vor dem Apply-Lauf; `reach("applied")` erst mit belastbarer Bilanz. Der Mounted-Test braucht ein steuerbares, noch nicht aufgeloestes Apply-Promise und muss in dieser Phase `aria-current` auf Schritt 5 pinnen.

### F2 - ROT - Monotonie haelt nach neuer Eingrenzung einen falschen Komplettstatus fest

- Der Provider reduziert jeden neuen Meilenstein auf `maxStage(prev, next)`: `apps/web/src/components/ImportStepper.tsx:29-35`.
- `maxStage` kann per Definition nie zurueckgehen: `apps/web/src/lib/importStepper.ts:19-42`.
- Nach erfolgreicher Bilanz steht der Context auf `applied`; alle Schritte sind erledigt.
- Eine neue Filter-/Eingrenzungsantwort kann `ImportGroups` ueber dessen Key remounten: `apps/web/src/components/ImportSelect.tsx:354-359`. Der neue Gruppenbaustein hat weder Daten noch Bilanz und verlangt einen neuen Gruppen-/Apply-Lauf.
- Seine spaetere Meldung `previewed` oder `grouping` wird von `maxStage("applied", ...)` verworfen. Die Leiste zeigt weiterhin fuenf Haken, obwohl der neue Lauf noch nicht gruppiert oder uebernommen wurde.
- Dieselbe Kante tritt auf, wenn nach einer bereits vorhandenen Bilanz ein Rest-Retry in `SNAPSHOT_EXPIRED` laeuft: `ImportGroups` setzt Daten und Bilanz zurueck, der Context bleibt trotzdem `applied`.
- `tests/app/import-stepper-logic.test.ts:39-45` pinnt nur die abstrakte Monotonie. `tests/app/import-stepper-mounted.test.tsx` prueft ausschliesslich einen linearen Lauf und keinen neuen Filter/Remount nach `applied`.

**Impact:** Der zentrale neue UX-Indikator behauptet „alles erledigt“, waehrend der Nutzer fuer die geaenderte Auswahl noch gruppieren und uebernehmen muss. Das verletzt die im Auftrag ausdruecklich verlangte Ehrlichkeit der Haken.

**Fix-Richtung:** Fortschritt nicht als globalen Maximalwert, sondern als Zustand der aktuellen Auswahlgeneration modellieren. Bei neuer Vorschau/Kriteriengeneration downstream auf `previewed` zuruecksetzen; innerhalb derselben Generation darf der Fortschritt monoton bleiben. Alternativ Context um `generation/resetTo(stage)` erweitern. Ein Mounted-Test muss nach `applied` die Kriterien aendern und beweisen: Schritt 4 aktiv, Schritt 5 kommend, nicht fuenfmal erledigt.

### F3 - GELB - Verlaufstitel ueberzeichnet den Inhalt der Review-Queue

- `apps/web/src/components/ImportHistory.tsx:19-34` kapselt die bestehenden Children in ein natives, standardmaessig geschlossenes `<details>`; technisch bleiben sie gemountet und nach Aufklappen erreichbar.
- `apps/web/src/pages/Stufe2.tsx:412-567` legt darunter nicht nur historische, bereits uebernommene Beitraege, sondern die komplette Import-Pruefliste mit Status `neu`, `angenommen`, `abgelehnt` und `info-angefragt` sowie deren aktiven Review-Buttons.
- Der Titel lautet dennoch in allen Sprachen „Bereits uebernommene Beitraege (Verlauf)“ (`apps/web/src/i18n.ts:2158`, `:5397`, `:8595`). Der Hinweistext erklaert die Queue zwar genauer, ist aber erst nach dem Aufklappen sichtbar.

**Impact:** Ein Nutzer mit offenen `neu`-Eintraegen kann die aktive Pruefarbeit fuer abgeschlossene Historie halten. Das ist besonders relevant, weil Apply weiterhin nur in die Review-Queue schreibt und keine stillen Auto-KOs erzeugen darf.

**Fix-Richtung:** Neutraler Titel wie „Import-Pruefliste und Verlauf“ oder getrennte offene Queue/History. Mindestens sollte der geschlossene Kopf offene Eintraege ausdruecklich benennen, z. B. „Import-Pruefliste (N offen)“.

## Prueffokus

### 1. Nur Komposition / kein Verhaltensdrift

**Verdikt: GRUEN.**

- Patch 72 aendert nur `apps/web` und Tests; keine Backenddatei, Route oder API-Typdatei wird beruehrt.
- Explore bleibt `endpoints.admin.import.explore()` (`ImportExplore.tsx:265-269`).
- Select sendet weiterhin Prompt, Kriterien, Locale und die verpflichtende Prompt-Eigenklassifikation (`ImportSelect.tsx:91-111`).
- Group und Apply verwenden weiterhin dieselben Kriterien, Snapshot-Token und Batches (`ImportGroups.tsx:208-285`).
- Latest-wins, Snapshot-expired, Rest-Retry, Auswahl und ehrliche Bilanz bleiben im Code erhalten.
- Die einzige gewollte Funktionssichtbarkeit ist das Einklappen der Review-Queue; ihre Mutation-/Invalidierungslogik in `Stufe2.tsx:343-365` und die Buttons in `:515-559` bleiben unveraendert.

### 2. Meilenstein-Context / Remount / Renderstabilitaet

**Verdikt: ROT.**

- **Kein Endlos-Render:** `reach` ist per `useCallback` stabil; `useMemo` stabilisiert den Context-Wert. Gleiche/niedrigere Stufen liefern denselben Stringzustand, sodass React keinen Loop erzeugt (`ImportStepper.tsx:29-35`).
- **Child-Remount ueberlebt:** Der Provider liegt in `Stufe2.tsx:388-391` oberhalb von Explore/Select/Groups; ein `ImportGroups`-Remount verliert den Context nicht.
- **Aber falscher Abschlusszustand:** F1 und F2 zeigen, dass die erzwungene globale Monotonie den aktuellen realen Arbeitsstand falsch abbildet.

### 3. Verlaufs-Sektion / Queue-Erreichbarkeit

**Verdikt: GRUEN funktional, GELB semantisch.**

- Native `<details>/<summary>` ist per Maus und Tastatur bedienbar; Children bleiben gemountet.
- Query, Pipeline, Kandidatenkarten und Accept/Reject/Info-Aktionen werden unveraendert durchgereicht.
- Standard-zu und Zaehler sind korrekt verdrahtet; der Test prueft aber nur ein Platzhalter-Child, nicht eine echte Review-Aktion nach Aufklappen (`tests/app/import-history-mounted.test.tsx:40-64`).
- Die Bezeichnung des Inhalts ist irrefuehrend (F3), ohne die Funktion zu blockieren.

### 4. A11y / i18n / schmale Breiten

**Verdikt: GELB.**

- DE/EN/NL enthalten alle neuen Stepper-, CTA- und Verlaufsschluessel; der Test liest die echten i18n-Ressourcen (`tests/app/import-history-mounted.test.tsx:97-133`).
- `aria-current="step"` wird genau einmal fuer den intern aktiven Schritt gesetzt (`ImportStepper.tsx:50-74`); erledigte Schritte erhalten einen sr-only-Zusatz.
- `flex-wrap`, `min-w-0` und `truncate` verhindern offensichtlichen horizontalen Overflow der Leiste; ein echter Viewport-/Screenshot-Test wurde im Patch nicht mitgeliefert.
- Die Semantik von `aria-current` ist wegen F1 im Apply-Lauf falsch; nach F2 kann es trotz offener neuer Arbeit ganz fehlen.

### 5. Regressionsblick 57-71

**Verdikt: GRUEN statisch.**

- Prompt-Eigenprovenienz und `promptConfidential` bleiben unveraendert im Select-Payload.
- Gruppierungs-/Apply-Vertrag, Snapshot-Pin, latest-wins und Review-Invariante werden nicht umgebaut.
- Patch 72 beruehrt weder aiCheck noch Cleanup, Auth/Token, Reasoner, Word-Add-in, Slides, Captions oder Sanitizer.
- Die sammel26-Blocker F1-F3 werden dadurch weder verschlechtert noch geschlossen; sie bleiben ausserhalb dieses UI-Slices offen.

## Test-Ehrlichkeit

| Test | Verdikt | Aussage |
|---|---|---|
| `import-stepper-logic.test.ts` | GELB | Statusmatrix und Maximalfunktion korrekt gepinnt, aber die problematische globale Monotonie wird als Soll festgeschrieben. |
| `import-stepper-mounted.test.tsx` | GELB | Gute lineare End-to-End-Komposition der echten UI-Bausteine; kein Apply-in-flight, kein Remount/neue Kriterien nach Bilanz. |
| `import-history-mounted.test.tsx` | GELB | Standard-zu, Zaehler, Verdrahtung und i18n belegt; keine echte Queue-Aktion im aufgeschlagenen Zustand. |
| Bestehende Cockpit-Tests | Nicht selbst ausgefuehrt | Gate-Evidence uebernommen; statisch kein API-/Payload-Rueckbau gefunden. |

## Verdikttabelle

| Bereich | Verdikt | Kurzbegruendung |
|---|---|---|
| Patchfolge 57-72 formal | **GRUEN** | Sequenziell sauber anwendbar |
| Reine UI-Komposition | **GRUEN** | Keine Backend-/Route-/API-Vertragsaenderung |
| Explore/Select/Group/Apply | **GRUEN** | Endpunkte, Payloads und Kernlogik unveraendert |
| Stepper normaler Apply-Weg | **ROT** | Schritt 5 wird nie aktiv |
| Remount/erneute Eingrenzung | **ROT** | Fuenf falsche Erledigt-Haken nach neuem Lauf |
| Renderstabilitaet | **GRUEN** | Stabile Callback-/Context-Abhaengigkeiten, kein Loop gefunden |
| Review-Queue Funktion | **GRUEN** | Aufklappbar und funktional erhalten |
| Review-Queue Bezeichnung | **GELB** | Aktive neue Eintraege als bereits uebernommener Verlauf etikettiert |
| i18n DE/EN/NL | **GRUEN** | Neue Schluessel vollstaendig vorhanden |
| A11y | **GELB** | Struktur sauber, `aria-current` bildet Apply/Reset aber falsch ab |
| Responsive | **GRUEN statisch** | Wrap/Min-Breiten vorhanden; keine visuelle Probe |
| Regression 57-71 | **GRUEN statisch** | Kein Rueckbau ausserhalb der gewollten Komposition |
| **Patch 72 gesamt** | **ROT / NO-GO AS-IS** | Kernanzeige des neuen Slices ist auf normalen Wegen unehrlich |

## Ship-Entscheidung

**Ist Patch 72 als UI-Slice fuer Ship 8 tragfaehig? Noch nicht.** Die APIs und Produktlogik sind tragfaehig, aber die neue Cockpit-Linie selbst braucht vor Aufnahme zwei kleine Korrekturen:

1. `applying` als echten aktiven Schritt 5 abbilden;
2. bei neuer Eingrenzungs-/Snapshotgeneration nach `applied` den downstream Fortschritt ehrlich zuruecksetzen.

Empfohlen zusaetzlich: Verlaufstitel auf offene Review-Arbeit plus Historie ausrichten. Danach genuegt ein schmaler Recheck des Stepper-Contexts und der zwei neuen Mounted-Szenarien; die Backendkette muss fuer diesen UI-Fix nicht neu bewertet werden. Die bekannten sammel26-F1-F3 bleiben unabhaengige Ship-8-Blocker.

## No-Code-Nachweis

- Produktcode geaendert: nein.
- Patch im Arbeits-Repo angewandt: nein.
- Bau/Test ausgefuehrt: nein.
- Commit/Push/Jira: nein/nein/nein.
- Geheimnisse oder ENV-Werte gelesen/ausgegeben: nein.
- Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

SHA-256 des Berichtsinhalts oberhalb dieser Zeile: `975caae6c769cb67cef18c4d81d49024b3d7afb1a6fe0ca412a040b5edf94030`

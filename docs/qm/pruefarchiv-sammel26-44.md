# Prüfarchiv · ben-Runden sammel26–44 im Repository

Auftrag `aufnahme:20260922:gesamt-pruefarchiv`, Revision 1. Einziger zugeordneter Originalpunkt:
**R-2042** (Alias `OFFEN:I5`, `OFFEN.md:417`).

- **Stand dieses Dokuments:** Nacharbeit 1 vom 13.10.2026 am Kandidaten `b3aee407`, Basis
  `2a96bab2c` (1.0.0-beta.1.973). Die Zeilennummern der Fundstellen gelten für diesen Stand.
- **Prüfstand:** `tests/pruefarchiv/sammel26-44-verankert.test.ts`.
  - Er führt die 32 Originalberichte als Liste mit Datei und SHA-256.
  - Er verlangt je Bericht genau eine Zeile mit genau diesem Hash.
  - Er verlangt, dass jede genannte Fundstelle ihre Runde weiterhin nennt.
- **Lieferbeleg:** Die Fassung, mit der dieses Dokument ausgeliefert wird, entsteht erst mit der
  Veröffentlichung und steht hier deshalb noch nicht.

## Was I5 sagt und was davon heute gilt

I5 lautet: „Die Verdikte sammel45–54 und die Ship-Kette dieses Tages sind in SCRUM-469 verankert,
mit Inhalts-SHA je Runde und der Fehlerklasse, die sich durch fünf Runden zieht“. Als Grund nennt I5:
`_relay/` steht in `.gitignore` und reist mit keinem Klon mit. Und: „Die älteren Runden sammel26–44
stehen weiterhin aus.“

Am heutigen Stand nachgesehen:

- `_relay/` steht weiterhin in `.gitignore:25`. `tools/zentrale-drift.ts:80-84` beschreibt dieselbe
  Grenze.
- **Die Originalberichte sind vorhanden.** Die Quellenhilfe
  `QUELLEN-HILFE-09a427-ORIGINALBERICHTE.json` vom 13.10.2026 hat sie im Auftragsordner belegt:
  - 32 Berichte unter `_relay/ben/outbox/` auf dem Entwicklungsrechner;
  - je Bericht Titel, Zeilen, Bytes und SHA-256, nachgerechnet und lesbar;
  - BEN hat das bestätigt (Nacharbeit 1).
- **Berichtigung:** Die erste Fassung dieses Dokuments nannte die Berichte „von hier aus nicht
  lesbar“ und führte deshalb keinen Hash. Das war als Aussage über die Berichte falsch. Richtig ist
  nur: Die Bahn, die dieses Dokument schreibt, darf ausschließlich Arbeitsbaum und Auftragsordner
  lesen. `_relay/` liegt außerhalb. Die Hashes unten stammen deshalb aus der Quellenhilfe, nicht aus
  einem eigenen Lesen der Berichte.
- **Zwei Berichtsreihen mit denselben Nummern:**
  - **Reihe A** sind die Gegenprüfungen der mega-Aufträge, `BERICHT-ben-sammelNN-megaMM.md`,
    sammel26–44.
  - **Reihe B** sind die Abnahme- und Recheck-Berichte zu Ship 8, `BERICHT-sammelNN.md`,
    sammel26–38.
  - Die Nummern 26–38 kommen deshalb zweimal vor. Beispiel sammel34: A ist die mega35-Gegenprüfung
    auf Basis `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` (Word-Kopierweg), B ist der Ship-8-Recheck
    auf Basis `2727b7e84d4a42056f0641174ac693121200ebbb` (beides laut BEN, Nacharbeit 1).
  - Jede Zeile unten trägt deshalb Reihe **und** Runde als Kennung (`A-sammel34`, `B-sammel34`).
    Kein Bericht verdrängt einen anderen.

## Spalten

- **Gegenstand:** aus Dateiname und Titel des Berichts (Quellenhilfe).
- **Datei-SHA-256:** Hash über die **ganze** Datei, aus der Quellenhilfe. Er ist **nicht** die
  Projekt-Inhalts-SHA (`n-1`-Formel über alle Zeilen außer der Markerzeile, `OFFEN.md:373`). Die
  Inhalts-SHA kann nur nachrechnen, wer den Bericht liest. Die Spalte heißt deshalb anders.
- **Verdikt / Befund:** nur, wo eine **versionierte** Fundstelle es nennt. „nicht übernommen“
  heißt: Es steht nur im Berichtstext, und den hat diese Bahn nicht gelesen.
- **Fundstellen:** Stellen im Repository, die die Runde nennen. Die Reihe ist über den Gegenstand
  zugeordnet:
  - `sammel37-mega38` gehört zu Reihe A;
  - `WP-SHIP8-CLOSE` gehört zu Reihe B, deren Titel „Recheck … Ship 8“ lauten;
  - der Word-Kopierweg gehört zur mega35-Gegenprüfung.

## Reihe A · Gegenprüfungen der mega-Aufträge (19 Berichte)

| Kennung | Originaldatei | Gegenstand | Verdikt | Befund laut Fundstelle | Folgearbeit | Fundstellen | Datei-SHA-256 | Zeilen | Bytes |
|---|---|---|---|---|---|---|---|---|---|
| A-sammel26 | `BERICHT-ben-sammel26-mega26.md` | mega26 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `9b88c55954342416a2324c01d070baf0622ff3c0c1e0332b830b346742588271` | 208 | 11225 |
| A-sammel27 | `BERICHT-ben-sammel27-mega27.md` | mega27 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `dd0a931ae9f54fffda8f6230f8b76ac7228a7e936ca6a0179eec5ff2bddb0193` | 297 | 12922 |
| A-sammel28 | `BERICHT-ben-sammel28-mega28.md` | mega28 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `caf3c55ddd5ff19440486f241bf263a918e1c40cdf272d09078d0315b4e823ea` | 368 | 17429 |
| A-sammel29 | `BERICHT-ben-sammel29-mega29.md` | mega29 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `ec2b8e4fb32430d93740f1fc662533fcff68829f315ec4debdc48b8be4e8cb20` | 366 | 16014 |
| A-sammel30 | `BERICHT-ben-sammel30-mega31.md` | mega31 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `d4781b9d5b9437152b2e73128061e5796fecdf8ec71a010a8eb9bfc568cdd612` | 279 | 13015 |
| A-sammel31 | `BERICHT-ben-sammel31-mega32.md` | mega32 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `5e7891be6596ab6ffe120742ea8abafca47eb59e901ebf5e5d0e22ce6ddbc754` | 333 | 14866 |
| A-sammel32 | `BERICHT-ben-sammel32-mega33.md` | mega33 | nicht übernommen („schwerster Befund“) | `conflicts.data ?? []` las „noch nicht geladen“ und „Abruf fehlgeschlagen“ als „keine Konflikte“. Eine Antwort konnte dadurch `verified` werden. | mega34 Block A | `tests/ask/mega34-konfliktstand-pflichtsignal.test.tsx:3` | `990d8e9f8df1af049ff4bb94f6e0dafe8b2f09d1efc7653743a893ff65bc0f19` | 318 | 13452 |
| A-sammel33 | `BERICHT-ben-sammel33-mega34.md` | mega34 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `081a0f92d84ce4c8a0582acfe2c163fe181a2eb3e4dd5372e589cd936959784f` | 539 | 23266 |
| A-sammel34 | `BERICHT-ben-sammel34-mega35.md` | mega35, Basis `d3fe69da0e86add68127fb57b0c20cd10ecdbb7e` | nicht übernommen | „Ein echter Cmd+C- und Kontextmenue-Test gehoert zum Word-Smoke.“ | mega36 Block E (Kontextmenü bleibt Handprüfung) | `tests-smoke/word-taskpane-kopieren.spec.ts:5` | `a4596fed2b64e50addbf9b81936244d8ea6bba34147863de2c06287ff4488156` | 266 | 12490 |
| A-sammel35 | `BERICHT-ben-sammel35-mega36.md` | mega36 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `1554f5640553f105e027941b1c5eabe231e64d44e9423fde31eccd429434ee6f` | 328 | 14615 |
| A-sammel36 | `BERICHT-ben-sammel36-mega37.md` | mega37 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `88265d8bb2abe9f135ceb2aa96787648f7e33300620f944f27de2d1db02036c1` | 372 | 16173 |
| A-sammel37 | `BERICHT-ben-sammel37-mega38.md` | mega38 | nicht übernommen | Fünf Befunde: A Arbeitsliste mit eigener Rollentabelle statt derselben Quelle; C nach einem Fehler stand die Antwort der alten Frage; D2 zweite Schrittliste ohne Aussage; E1 `apps/web/package-lock.json` fehlte in der dist-Frische; Topbar-Chips aus mega38 Block H als rohe `Link`s ohne `guard()` | mega39 Blöcke A, C, D2, E1 | `apps/web/src/lib/workCenter.ts:69`, `apps/web/src/pages/Ask.tsx:1013`, `apps/web/src/lib/askSteps.ts:2`, `scripts/dist-frische.ts:94`, `tests/ask/mega39-fehler-ohne-fremde-antwort.test.tsx:6`, `tests/app/mega39-topbar-chips-guarded-mounted.test.tsx:6` | `8b2de56c085a82ed76c9bf7a981aba164016cf3e87712cf233d1cdde0181b79f` | 458 | 20521 |
| A-sammel38 | `BERICHT-ben-sammel38-mega39.md` | mega39 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `6b575828b6551a2692161cce9655fab8cc5ed7560644ee53434eac36f74c3645` | 347 | 16312 |
| A-sammel39 | `BERICHT-ben-sammel39-mega40.md` | mega40 | Blocker genannt | Weiß auf reinem Funke `#E8630A` (3,38:1) war als Grafikgrenze gepinnt, trägt im Produkt aber kleine Texte | mega41 Block A | `apps/web/src/styles/modern.css:59`, `tests/app/mega40-kontrast-modern.test.ts:8` | `76b16b95712ae4bc9173bddb1cf9ed39c882ba154e7a13c60291f483f80e4f96` | 205 | 11095 |
| A-sammel40 | `BERICHT-ben-sammel40-mega41.md` | mega41, Kontrastfix | nicht übernommen | `opacity: 1` auf Fläche und `*` zu grob, `hover:opacity-95` am Filterknopf wirkungslos; Reihenfolge der Badge-Regel von keinem Test gehalten | mega42 Blöcke A und B | `apps/web/src/styles/modern.css:92`, `tests/app/mega40-kontrast-modern.test.ts:1009`, `tests/app/mega40-kontrast-modern.test.ts:1075` | `d5e047b95b55f1a6e81553807bfbc1b190a72f036f495be3bdb75abbc3178985` | 234 | 13660 |
| A-sammel41 | `BERICHT-ben-sammel41-mega42.md` | mega42, zwei Restpunkte | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `8f742efc2475ff3a9e3a18b39e78733a26f52ad2a37e11d8970e3f74c3128e49` | 220 | 11845 |
| A-sammel42 | `BERICHT-ben-sammel42-mega43.md` | mega43, Klara im Werkbank-Design | GESAMTVERDIKT GELB | drei Wächter-Auflagen G1–G3 (Alpha, Inline-Stile, Kontrastpaare aus der Bauform) und Punkt 5 (inaktive Knöpfe) | mega44 | `tests/app/mega43-klara-werkbank-palette.test.ts:3`, `tests/app/mega43-klara-werkbank-palette.test.ts:386` | `12826673db3977cd166267222ded2edb38cfa06337236ca6da7f5fa37dcf47fb` | 282 | 13866 |
| A-sammel43 | `BERICHT-ben-sammel43-mega44.md` | mega44, drei Wächter-Auflagen | nicht übernommen | vier Überbehauptungen in den Kommentaren des Palettensammlers (Kaskade, Alpha-Rundung, Inline-Parser) | mega45 Block G | `tests/app/mega43-klara-werkbank-palette.test.ts:55` | `f513bae978472476c8d1ea301afb0d0a08ba6de574d894515692429bfbe01d52` | 357 | 17039 |
| A-sammel44 | `BERICHT-ben-sammel44-mega45-46.md` | mega45 und mega46 | ROT, Ship-Blocker | Das mobile Filterblatt lag in seinem eigenen inerten Hintergrund und war weder bedienbar noch schließbar. Zweiter Befund, kein Blocker: `mineEmpty` aus der facettierten Endmenge. | mega47 Blöcke B, C1 und D | `tests-smoke/ui-smoke.spec.ts:376`, `tests/app/mega47-modale-flaechen-sammler.test.tsx:6`, `tests/app/mega47-persoenlicher-leerzustand.test.tsx:4` | `4987ef5371b46ff4eb871a3b6c1924d7d71765edb6654e63e1c6607e53e60337` | 294 | 15936 |

## Reihe B · Ship-8-Abnahme und Rechecks (13 Berichte)

| Kennung | Originaldatei | Gegenstand | Verdikt | Befund laut Fundstelle | Folgearbeit | Fundstellen | Datei-SHA-256 | Zeilen | Bytes |
|---|---|---|---|---|---|---|---|---|---|
| B-sammel26 | `BERICHT-sammel26.md` | Konsolidierte Ship-8-Abnahme | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `b3ebb279ea332d3c23f2e40e6f883bb8c746ba623bd263fe566fa4628202a6ea` | 197 | 17912 |
| B-sammel27 | `BERICHT-sammel27.md` | Review Cockpit-Linie / Patch 72 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `9f9f6b5e3e58adfb50a5ec6fe9a55a707d8b7d13cd39d72a6cd83dc909af1e67` | 158 | 12981 |
| B-sammel28 | `BERICHT-sammel28.md` | UX-WOW-1 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `474b112d7f7b5530277e28a515c8b300ec716f218d1279e669c17bfa4be96bce` | 152 | 11241 |
| B-sammel29 | `BERICHT-sammel29.md` | Finaler Recheck Ship 8 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `e73d53334265136bbcdd600b23945cfd4370059b2293740e37e30f524934fe70` | 130 | 14594 |
| B-sammel30 | `BERICHT-sammel30.md` | Finaler Recheck 2 Ship 8 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `6fd88aace14db90e35c734a588b0c326d7e97080e236021c428c6b57d69e1592` | 86 | 9400 |
| B-sammel31 | `BERICHT-sammel31.md` | Finaler Recheck 3 Ship 8 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `85f9266cc3fe09985b5f2b5a41e7521e9feceaf32129ec695c679c675edbdccb` | 108 | 12310 |
| B-sammel32 | `BERICHT-sammel32.md` | Finaler Recheck 4 Ship 8 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `097b2882dc37184bcea3f1b30d8f5e639b8b644c3f9a47edc2dce2c679116dbb` | 140 | 12751 |
| B-sammel33 | `BERICHT-sammel33.md` | Finaler Recheck 5 Ship 8 | ROT-1 genannt | `ko.created` beim parallelen Nachzug nicht genau einmal; Re-Sync-Vollendung; Review-Aktionsbeleg verlierbar | WP-SHIP8-CLOSE-6 | `tests/app/review-claim-recovery.test.ts:643` | `38eeb4a246339b2fb649d077789b5f9812ef2902779fae5923beed50bf6d60ec` | 155 | 13633 |
| B-sammel34 | `BERICHT-sammel34.md` | Finaler Recheck 6 Ship 8, Basis `2727b7e84d4a42056f0641174ac693121200ebbb` | ROT-1, ROT-2 und GELB genannt | ROT-1: `auditPending` nicht vorbeugend im Statuswrite. ROT-2: Der Claim kannte Akteur und Aktion nicht. GELB: `reviewedAction` nicht persistiert. | WP-SHIP8-CLOSE-7 | `tests/app/review-claim-recovery.test.ts:849` | `7f5265b18a75613af5c51ecddd0ad22f84d5b2b4e35e96bb61544e45b8a8278c` | 159 | 14780 |
| B-sammel35 | `BERICHT-sammel35.md` | Finaler Recheck 7 Ship 8 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `952f9d48564ed475d927cdf78a859690e8b660c29171863e895120070d8aefd6` | 145 | 14105 |
| B-sammel36 | `BERICHT-sammel36.md` | Finaler Recheck 8 Ship 8 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `f66e4d0b14e04b20572b9b3bb48825faa1f0a32a434b95fa15d5ff09719d0c8f` | 150 | 14181 |
| B-sammel37 | `BERICHT-sammel37.md` | Finaler Recheck Ship 8 CLOSE-9 | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `346aec4969199e8741693b4b350e5e28170838f75ba0339474243cdad803ee9a` | 132 | 9886 |
| B-sammel38 | `BERICHT-sammel38.md` | Post-Ship-Kurzcheck | nicht übernommen | keine versionierte Spur | nicht übernommen | — | `991e19e350122078d6bb959f58d00a4c2d0dcb39ebd8021cf77763d66dae8f6a` | 22 | 1646 |

**Zählung:** 32 Berichte, 19 in Reihe A und 13 in Reihe B. Jeder hat einen Datei-SHA-256. 10
Berichte haben versionierte Fundstellen: 8 in Reihe A (sammel32, 34, 37, 39, 40, 42, 43, 44) und 2
in Reihe B (sammel33, 34). Die übrigen 22 sind nur über Datei und Hash verankert. (Die Fassung aus
Nacharbeit 1 nannte hier „11“; das war falsch, BEN Nacharbeit 2.)

**Sicherungsstand: 0 von 32 Berichtstexten liegen im Repository.** Diese Zahl ist nicht frei
geschrieben. Der Prüfstand zählt die Dateien in `docs/qm/pruefarchiv/berichte/` und verlangt, dass
diese Zeile genau diese Zahl nennt. Jede dort liegende Datei muss Namen und SHA-256 eines der 32
Berichte tragen. Eine fremde oder veränderte Datei ist rot.

**Wiederkehrende Fehlerklasse (Lesart der Fundstellen, kein Wortlaut von ben):** Mehrere Befunde der
Reihe A haben dieselbe Bauart. Eine zweite Wahrheit läuft neben der ersten: die eigene Rollentabelle
(A-sammel37 A), die zweite Schrittliste (A-sammel37 D2) und die zweite Palette in Klara
(`mega43-klara-werkbank-palette.test.ts:8`). Oder eine Aussage reicht weiter als ihr Beleg: „leer“
heißt nicht „nichts vorhanden“ (A-sammel32), die Kommentar-Überbehauptungen (A-sammel43), Wächter
enger als ihr Anspruch (A-sammel42). Ob ben diese Klasse selbst so benannt hat, steht in keinem
versionierten Text.

## Abgrenzung

- **sammel45–54 und die Ship-Kette:** Diesen Teil hat I5 als erledigt geführt (SCRUM-469). Er ist
  nicht Gegenstand dieses Auftrags und wird nicht neu gebaut. Siehe unten den Widerspruch zu
  sammel45.
- **I20 · Nachtrag nach dem Wiederverbinden** (`OFFEN.md:415`): eigener offener Registerpunkt
  (Ship 9, sammel60, T6, I20, C1).
- **I8 · Scheiben-Zusatz an ben-Auftragsnamen** (`OFFEN.md:402`): eigener offener Punkt zur
  künftigen Benennung. Die doppelten Nummern unten zeigen, warum er nötig ist.
- **Spätere Runden** (sammel55 ff.) stehen mit Inhalts-SHA bereits in `OFFEN.md` (B-Zeilen in
  `OFFEN.md:130-209`) und in `docs/aufnahme/20260922-gesamt-paket2-scope.md`.
- **Die Befunde selbst:** Dieses Dokument archiviert Prüfberichte. Ob die damaligen Befunde heute
  noch geschlossen sind, prüft es nicht. Historische Verdikte sind keine heutige Produktabnahme.

## Quellenwidersprüche

- **sammel45: „je GRÜN“ gegen „ROT“.** `OFFEN.md:215` (B6) führt „ben sammel45–49 je GRÜN“. Dagegen
  steht `tests/app/mega47-modale-flaechen-sammler.test.tsx:15`: „sammel45 (ben, ROT)“. Dieselbe Datei
  nennt in Z. 22 einen Befund aus sammel46 (Register A17). Das betrifft den Teil von I5, der als
  erledigt gilt. Die Berichte ab sammel45 sind nicht Teil der Quellenhilfe.
- **Gleiche Nummern, verschiedene Berichte.** sammel26–38 gibt es in beiden Reihen. Wer im Code
  „sammel33“ oder „sammel34“ liest, weiß ohne Reihe nicht, welcher Bericht gemeint ist. Die erste
  Fassung dieses Archivs hat deshalb beide Gegenstände von sammel34 in eine Zeile gelegt. Das ist
  berichtigt.
- **„Ship 8“ zweimal.** Reihe B heißt im Titel „Ship 8“ (Abnahme, Recheck 1–8, CLOSE-9). In der
  Ship-Kette von `OFFEN.md` ist „Ship 8“ dagegen `bcf1f15` mit mega60 (`OFFEN.md:277`, B15), also
  nach Reihe A sammel44. Welche Zählung für welchen Zeitraum galt, belegt kein versionierter Text.
- **SCRUM-469 als Ablage.** `docs/qm/claude-after-report.md:10983` und `:10997` nennen
  SCRUM-469-Kommentare (13949, 13950, 13956) zu „ben-Batch“-Prüfungen vom 19.07. Diese Prüfungen
  tragen keine `sammel`-Nummer. Ob sie einer der 32 Berichte entsprechen, ist ohne den Berichtstext
  nicht zuzuordnen.

## Offen

- **Versionierte Kopie der Originalberichte.** Gefordert ist, die 32 Berichte dauerhaft im
  Repository zu sichern. Diese Bahn kann das nicht: Ihre Datei- und Shellwerkzeuge sind auf
  Arbeitsbaum und Auftragsordner beschränkt, `_relay/ben/outbox/` liegt außerhalb. Das ist eine
  Grenze der Bahn, nicht der Quelle.
  - In Nacharbeit 2 erneut versucht: Auch ein einzelner direkter Lesebefehl (`shasum` auf
    `BERICHT-sammel38.md`) wurde ohne Freigabemöglichkeit abgelehnt. Ein anderer Zugriffsweg ist
    dieser Bahn nicht zugänglich.
  - Wer die 32 Dateien unverändert nach `docs/qm/pruefarchiv/berichte/` überträgt, wird vom
    Prüfstand gegengeprüft: gleicher Name, gleicher SHA-256. Danach ist hier der Sicherungsstand
    nachzuziehen, sonst wird der Prüfstand rot.
  - Vor dem Übertragen ist auf Geheimnisse zu prüfen. Diese Prüfung steht aus, weil die Bahn die
    Texte nicht lesen kann.
- **Aus dem Berichtstext zu ergänzen**, sobald er gelesen werden kann:
  - Inhalts-SHA nach Projektformel;
  - die Basis (geprüfte Fassung) aller Berichte außer A-sammel34 und B-sammel34;
  - die Gesamtverdikte (außer A-sammel42 GELB und A-sammel44 ROT);
  - die Befunde der 22 Berichte ohne Fundstelle.

  Erfunden wird nichts davon. Der Prüfstand lässt das Nachtragen zu, weil er dafür keine Spalte
  vorschreibt.

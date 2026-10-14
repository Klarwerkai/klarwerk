# Bestandsabgleich: Inhaltliche Prüfung mit Warteschlange und wirksamer Ausfallanzeige

Auftrag `aufnahme:20260922:gesamt-pruefdienst`, Revision 1. Originalkriterien K1–K16 unverändert
aus `AUFTRAG-B1.json`; Originalwortlaut, Herkunft und Altbestand je Punkt aus `QUELLEN.json`
(`original_points`).

**Was dieses Dokument ist:** die Zuordnung der heute vorhandenen Prüfweg-Funktionen zu den
Originalpunkten, mit Fassung und Fundstelle, plus Abgrenzung und Bewertung der verbleibenden
Unterschiede. **Was es nicht ist:** eine Erfüllungsbehauptung für alle 16 Kriterien, eine
Produktfreigabe oder ein Nachbau der verworfenen alten Steuerung (`kw_pruefer.py`,
`kw_ben_lauf.py`, `kw_pruefpaket.py`, Board-/Taktdienst, handgepflegte Listen). Die historischen
Werkzeugnamen bezeichnen nur die Herkunft.

## Fassung der ausgewerteten Quellen

**Heutiger Prüfweg.** Sieben Module der Produktionskoordination, gelesen aus der öffentlichen
Lesekopie in `QUELLEN-FUEHRUNG-HEUTIGER-PRUEFWEG-6E2F-20261014T0014.json` (Stand
2026-10-14T00:53:29Z, Kandidat `6e2f82b0`). Zeilenangaben beziehen sich auf diese Fassung.

| Modul | SHA-256 |
| --- | --- |
| `dienst.py` | `118e99d597b9501ce51a653b103a49cd24bec20a5315f43f7b13bd896f23f48a` |
| `benurteil.py` | `597a3cf693b163831a9f841fc9de230e30b7916dc551415058fbd2ab9622ee38` |
| `befund.py` | `2ce297296ecda48f1ced59dacac294a18440cce961d575ad0b7149e8af20be03` |
| `fortsetzung.py` | `c4cbbd148ac2a8f240c019efe4188b9ecee71a8abbbcd7ba2fab1b177bb99cef` |
| `produkt.py` | `5f43371e423e042a1f63cc5e75a2c9c729504d395315a122a22648910b5bccb7` |
| `laufzeit.py` | `12d5b82ee995c55b63480b2f23cee21cd52ab68124e53e9b2917a59db1aecf36` |
| `auftragsstand.py` | `81ba198f068770705ebf4a60dd4a8b885ae799e3439696c0604301ff756eb09e` |

Die Module liegen außerhalb des Produkt-Gitbaums und außerhalb der `allowed_paths` dieses
Auftrags. Sie werden hier gelesen, nicht geändert.

**Produktbaum.** `tools/urteilslage.ts` und `tools/schon-eingebaut.ts` (die im Repository
vorhandene Leseregel für historische Markdown-Prüfberichte), gehärtet in diesem Auftrag und geprüft
durch `tests/structure/pruefdienst-urteilsregel-haertung.test.ts`,
`tests/structure/job2532-raster-repariert.test.ts` und
`tests/faeulewerkzeug/r1235-einordnung.test.ts`. Laut Bens Hinweis zu Kandidat `5e6cefd8` ist
der Bau erfolgreich; 70 Härtungstests, 12 Bestandstests und Biome für fünf Dateien sind bestanden.

**Jüngere Nutzerentscheidung.** Betriebsregel vom 2026-10-14T00:14Z (in derselben
Quellenführung): 24 Produktionsplätze freigegeben; keine zweite Dienstinstanz, keine
Doppelstarts; „Laufend oder unbekannt bedeutet schützen und beobachten.“

## Zuordnung je Originalpunkt

Legende: **erfüllt (heutiger Weg)** — der Originalzweck ist an der genannten Stelle umgesetzt;
**teilweise** — Restunterschied ist benannt; **offen** — keine Umsetzung belegt.

### K1 · R-1201 — Ausfallanzeige, handgepflegte Liste

- Original: Ampel grün/gelb/rot; rot, wenn Stände warten und seit über einer Stunde kein echtes
  Urteil kam. Rest: Der Melder hängt an einer von Hand gepflegten Liste.
- Heute: `dienst.py` `Dienst._tick` (Z. 250–600) schreibt bei jedem Takt `DIENST.json` vollständig
  neu: je Auftrag Status (`running`, `unknown`, `waiting`, `waiting_resource`, `blocked`,
  `disabled`, `finished`), Grund, Priorität sowie `max_parallel` und `occupied` (Z. 597–600).
  Grundlage sind nicht nur die konfigurierten Aufträge: Alle `jobs/*/PROZESS.json` werden
  eingelesen (Z. 269–288). Ein beschädigter oder unbekannter Prozessbeleg erscheint als `unknown`,
  statt zu verschwinden. Aufträge kommen über den Intake (`intake_nach_tick`, `b1_nach_tick`,
  Z. 646–697), nicht über eine Handliste.
- Bewertung: **teilweise.** Die Blindheit durch eine handgepflegte Liste ist für den
  Prozessstatus beseitigt. In den sieben Modulen gibt es aber kein Signal „Stände warten, und seit
  über einer Stunde kam kein echtes Urteil“, also keine Altersmessung des letzten Benurteils. Ob
  und wo `DIENST.json` angezeigt wird, belegen die Module nicht.

### K2 · R-1202 — Sperrbehandlung, Warten auf den Maschinenprüfer, Pflichtteile

- Offene Werkzeug-Entscheidung von damals: `OSError` in `laeuft_schon()` als verwaiste Sperre
  behandeln.
- Heute: `laufzeit.py` `locked`/`lock_is_held` (Z. 88–109) benutzt `fcntl.flock`. Der Kernel gibt
  die Sperre mit dem Prozessende frei. Eine liegengebliebene Sperrdatei wie die 17-Byte-Datei vom
  27.08. kann daher nichts mehr blockieren. Eine fehlende Datei gilt als frei. Andere `OSError`
  ergeben `None` (unbekannt); der Dienst behandelt das als belegt (`dienst.py` Z. 357, 522).
- Bewertung der Entscheidung: Der heutige Weg entscheidet **gegen** „OSError = verwaist“ und für
  „unbekannt = schützen“. Das deckt sich mit der jüngeren Nutzerregel vom 2026-10-14. Den
  Ausfallgrund der damaligen Sperre (Datei überlebt den Prozess) gibt es mit `flock` nicht mehr.
  **Erfüllt (heutiger Weg).**
- „Ben wartete zeitweise auf den Maschinenprüfer“: Das ist heute beabsichtigt, siehe K7. Ben
  startet erst nach der kandidatengebundenen Prüfung (`produkt.py` `ben`, Z. 968–974).
- „PFLICHTTEIL3 prüft nur einen von sechs Pflichtteilen“: Das Pflichtteil-/Zustellpaket gibt es
  heute nicht mehr. Ben erhält Originalvertrag und Belegpfade (`produkt.py` Z. 1010–1017).
  `benurteil.vertragsbindung` (Z. 95–112) prüft den SHA-256 des unveränderten `AUFTRAG-B1.json`
  gegen die gespeicherte Bewertungsgrundlage. **Teilweise:** Wie vollständig die Belegpfade sind,
  legt `benfortsetzung.belegpfade` fest; dieses Modul gehört nicht zu den sieben ausgewerteten.

### K3 · R-1231 — eine einzige Leseregel; Dimensionszeile, Codeblöcke

- Heute: Ben antwortet strukturiert nach `benurteil_v2` (`benurteil.py` `SCHEMA`, Z. 23–36). Das
  Urteil ist ein Aufzählungsfeld (`erfuellt`, `nacharbeit`, `offen`). Alle Leser benutzen dieselbe
  Prüffunktion `_pruefen` (Z. 115–151): `akzeptiert`, `rueckgabe` und `fortsetzung.fehlender_rest`
  (`fortsetzung.py` Z. 43–59). Eine Textsuche nach Urteilswörtern gibt es nicht, deshalb können
  weder eine Dimensionszeile noch ein Codeblock ein Urteil vortäuschen.
- Produktbaum: Für die historischen Markdown-Berichte gilt die eine Regel in
  `tools/urteilslage.ts`. Die Gesamturteilszeile ist Pflicht, und Codeblöcke in Zitaten und Listen
  zählen nicht. Die Regel wurde in diesem Auftrag in fünf Nacharbeiten gehärtet; Ben hat sie zuletzt
  als korrigiert bestätigt.
- Bewertung: **erfüllt.**

### K4 · R-1248 — Engpass und Lesefehler des Maschinenprüfers

- Engpass, ein Lauf zur Zeit: heute `max_parallel` 1–24 (`dienst.py` `konfiguration`, Z. 40–45),
  laut Nutzerregel 24 Plätze freigegeben. **Erfüllt.**
- Arbeitsordner unter nur einem Namensmuster gesucht: heute fester Pfad
  `W = P / 'arbeitsbereich'` (`produkt.py` Z. 9–10); es wird nicht gesucht. **Erfüllt.**
- Read-only, sobald „PRODUKTWRITES: 0“ im Fließtext steht: siehe K14. **Teilweise:** Belegt
  sind die Fließtext-Härtung im Produktbaum und die Erfassung neuer Dateien einzeln; die
  Auftragsart-Erkennung des heutigen Wegs ist ungeklärt.
- Kein biome: heute `formatieren` und eine `biome check`-Prüfung im Plan. `befund._biome_diagnosen`
  (Z. 298–350) macht daraus konkrete Datei-Befunde. **Erfüllt.**
- Verschlechterung bereits roter Testdateien nicht gezählt. Der damalige Fehler war die Zählung
  auf Dateiebene: Eine schon rote Datei konnte nicht „noch röter“ werden. Heute wird jede
  ausgewählte Suite assertion-genau aus dem nativen Vitest-JSON ausgewertet. Jede rote Assertion
  wird einzeln gezählt und ist ein eigener Befund mit Datei und Fall (`befund.py` Z. 543–680, Zähler
  je Assertion Z. 567–580). Eine zusätzlich rote Assertion in einer bereits roten Datei erscheint
  damit als weiterer Befund. Ob ein Fehler verursacht ist oder zur unveränderten Basis gehört, ordnet
  Ben ein (Z. 786–790; Prompt in `benurteil.prompt`: „Verursachte Fehler prüfen, fremde
  unveränderte Basisfehler getrennt benennen“). R-1248 verlangt die Erfassung, nicht eine
  bestimmte Vergleichsimplementierung.
  **Teilweise belegt:** Der Weg erfasst Verschlechterungen nach seinem Aufbau. Es fehlt ein
  konkreter Fallbeleg, also ein Prüflauf, in dem eine neu rote Assertion in einer bereits roten
  Datei tatsächlich als Befund ausgewiesen wurde. Das ist eine Beleglücke, keine fehlende Funktion.

### K5 · R-1258 — kein Paket, rotes Schein-Urteil, falscher Pfad

- Heute: fester Arbeitsbaum (siehe K4). Bevor Ben startet, wird `git rev-parse HEAD == SHA` bei
  sauberem Arbeitsbaum geprüft (`produkt.py` Z. 975). Fehlt ein Beleg oder ist er mehrdeutig,
  entsteht kein rotes Urteil: `befund.require` wirft `Unklar` („Kein vollständiger, eindeutiger
  Nacharbeitsbeleg“, Z. 18–25), und eine ungültige Benantwort wird von `_pruefen` als
  `ValueError` abgewiesen. Ein Lauf ohne prüfbare Grundlage wird so zu einem Klärungsfall, nicht
  zu einem ROT.
- Die damalige feste Verteilung auf acht Prüferfenster gehört zur verworfenen Steuerung und wird
  nicht nachgebaut. Heute hat jeder Auftrag eine eigene Ben-Sitzung (`ben_resume_session`).
- Bewertung: **erfüllt (heutiger Weg).**

### K6 · R-1326 — Typfehler nach Art; widersprüchliche Berichte

- Heute: `befund.py` `TS_DIAG` (Z. 54) liest Datei, Zeile und TS-Code jedes Compilerbefunds
  (Z. 739–766). TS2307, TS2688 und TS6053 werden als Umgebungs- oder Auflösungsfälle getrennt
  geführt; alle anderen Codes sind konkrete Befunde mit ihrem Code.
- Widersprüchliche Berichte: Prüfbelege sind an Kandidat und SHA-256 gebunden
  (`PRUEFUNG/BELEG-HASHES.json`, `bericht_sha256` Z. 734). Die Benbewertung ist an die Hashes ihrer
  Grundlage gebunden (`vertragsbindung`). Ein geänderter Bericht passt dann nicht mehr zur
  Bewertung.
- Bewertung: **erfüllt (heutiger Weg).** Der damals gebaute, aber nicht eingebaute Stand des
  Altwerkzeugs wird nicht reaktiviert.

### K7 · R-1362 — kein Urteil vor dem maschinellen Teil

- Heute: `produkt.py` `ben` (Z. 968–974) liest `PRUEFUNG/PRUEFUNG.json` und verlangt denselben
  Kandidaten. Nach einem ausgeführten Prüflauf startet Ben nur, wenn `pruefbeleg` keine konkreten
  Befunde enthält. Damit wartet die Prüfung. Ein Nicht-Urteil kann nicht als ROT zählen, weil das
  Schema keinen solchen Wert kennt. „Offen“ bedeutet ausdrücklich eine fehlende externe
  Voraussetzung (`benurteil.prompt`).
- Produktbaum: In historischen Berichten gilt ein `GESAMTURTEIL`, das mit NICHT oder KEIN
  beginnt, nicht als Urteil (`tools/urteilslage.ts` `gesamturteil`).
- Bewertung: **erfüllt.**

### K8 · R-1379 — Liste ohne Urteil wird nur angehängt

- Heute: Eine angehängte Liste gibt es nicht. `DIENST.json` wird bei jedem Takt vollständig aus
  den vorhandenen Prozessbelegen und Aufträgen neu geschrieben (`dienst.py` Z. 597–600).
  Abgeschlossene Aufträge erscheinen als `finished`. Die Länge entspricht dem tatsächlichen
  Bestand.
- Zweiter Mangel „Urteilsdatei ohne Urteil“: Heute entscheidet das strukturierte Schema. Für
  historische Berichte belegt nur die Zeile `GESAMTURTEIL: GRÜN|ROT` ein Urteil
  (`tools/urteilslage.ts`).
- Bewertung: **erfüllt (heutiger Weg).**

### K9 · R-1380 — Reihenfolge der wartenden Stände

- Original: zuerst Herstellbarkeit, dann Produktnähe, dann Tests, statt absteigender
  Auftragsnummer.
- Heute (`dienst.py` `reihenfolge`, Z. 396–415): erstens Priorität (zentraler Intake oder
  aufgenommener Vertrag, `prioritaet` Z. 603–613), zweitens lieferbereit vor fortsetzungsbereit vor
  sonstigen, drittens nie Gestartetes vor dem am längsten Wartenden (`wartefolge`, Z. 111–123).
- Bewertung: **teilweise erfüllt, technische Restanforderung offen.**
  - Anerkannte Teilerfüllung: Die Auftragsnummer spielt keine Rolle, und ein fertiger Stand wird
    bei gleicher Priorität vor neuen Aufträgen eingeordnet. Der Mangel „jeder neue Auftrag schiebt
    einen fertigen Stand nach hinten“ besteht damit nicht mehr.
  - „Herstellbarkeit“ entspricht ungefähr „lieferbereit/bereit“.
  - **Es fehlen die Ordnungsschlüssel „Produktnähe“ und „Tests“.** Die beauftragte Reihenfolge
    Herstellbarkeit → Produktnähe → Tests ist damit nicht vollständig umgesetzt.
  - Die zentrale Priorität, die heute an erster Stelle steht, löst R-1380 **nicht** ab. In den
    ausgewerteten Belegen gibt es keine jüngere Entscheidung, die das tut. Die Sortierung bleibt
    daher eine beauftragte technische Anforderung; eine neue Produktentscheidung ist dafür nicht
    nötig.
  - **Zuständigkeitsgrenze:** Die Sortierung steht in `dienst.py` (`reihenfolge`, Z. 396–415). Die
    Datei liegt außerhalb des Produktarbeitsbaums und der `allowed_paths` dieses Auftrags
    (`AUFTRAG.json`). Aus der Lesekopie in der Quellenführung folgt keine Schreibfreigabe. Die
    Restanforderung lässt sich deshalb in diesem Auftrag nicht umsetzen.

### K10 · R-1414 — Code-Urteil und Prüferurteil eichen

- Heute: Beide Quellen münden in dasselbe Befundformat. Maschinenbefunde haben `art`, `datei`,
  `zeile`, `meldung` und `korrektur` (`befund.py`). Benbefunde werden von `benurteil.rueckgabe`
  (Z. 170–192) in dieselben Felder übersetzt (`art` = `ben`, `ben_pruefcode` oder
  `externe_voraussetzung`). Die Reihenfolge erzwingt das Veto: Ohne befundfreie Maschinenprüfung
  startet Ben nicht (K7), und ohne `erfuellt` von Ben wird nicht geliefert (`produkt.py` Z. 1057).
- Bewertung: **teilweise.** „Dieselbe Sprache“ ist erfüllt. Eine **Eichung** im Sinn einer
  Messung, wie oft beide Quellen am selben Stand übereinstimmen, gibt es in den Modulen nicht.

### K11 · R-1440 — Maschinenurteile nie als Prüferurteil

- Heute: Maschinenergebnisse liegen unter `PRUEFUNG/` (`PRUEFUNG.json`, Suite-Berichte,
  `BELEG-HASHES.json`), das Benurteil liegt unter `BEN/ANTWORT.json` mit eigenem Schema.
  `-CODE.md`-Dateien entstehen nicht mehr; eine Verwechslung ist durch Ordner und Schema
  ausgeschlossen.
- Produktbaum: `tools/urteilslage.ts` `istTeilurteil` erkennt für historische Berichte sowohl
  `-CODE.md` als auch den damals angenommenen Namen `CODE-PRUEFUNG-…`. Historische Dateien werden
  bewusst nicht umbenannt.
- Bewertung: **erfüllt (heutiger Weg).**

### K12 · R-1465 — mehrere Prüfer gleichzeitig, hashgebunden

- Heute: bis zu 24 Aufträge gleichzeitig, jeder mit eigener Ben-Sitzung. Die Bindung läuft über
  den Kandidaten-SHA:
  - Operation-ID aus Plan, Phase und Kandidat (`dienst.stand_und_quittung`, Z. 69–95);
  - `PRUEFUNG.json` und `BEN/STATUS.json` je Kandidat;
  - `vertragsbindung` per SHA-256.
- Je Auftrag gibt es keinen Doppelstart (`produkt.py` Z. 1044).
- Bewertung: **erfüllt (heutiger Weg).**

### K13 · R-1478 — mehrere Stände parallel prüfen (Quellenwiderspruch)

- Widerspruch: Im Altbestand steht `VERWORFEN` („Befund Prüfdurchsatz 26.08., Hebel 3: technisch
  möglich, aber im Code ausdrücklich verworfen“). Der aufgenommene Auftrag nennt denselben Punkt
  als Zielzustand.
- Einordnung: Die Verwerfung betraf den Code des Altwerkzeugs. Die jüngere Nutzerregel vom
  2026-10-14 gibt 24 Produktionsplätze frei, und der heutige Dienst prüft bis zu 24 Stände
  parallel (K12). Nach dem Nichtziel „jüngere Nutzerentscheidungen bleiben wirksam“ ist die
  Verwerfung damit überholt. Je Auftrag läuft weiter nur ein Prüflauf (kein Doppelstart).
- Bewertung: **erfüllt (heutiger Weg).** Der Widerspruch ist durch die jüngere Entscheidung
  aufgelöst, nicht stillschweigend.

### K14 · R-1486 — Auftragsart aus ausdrücklicher Zeile

- **Belegt: Fließtext-Härtung im Produktbaum.** `tools/schon-eingebaut.ts` `erklaertNullWrites`
  liest nur eine ausdrückliche `PRODUKTWRITES`-Zeile. Der Originalsatz „PRODUKTWRITES: 0 ist hier
  ausdruecklich das Versagen“ im Fließtext erklärt nichts; fehlt die Zeile, wird die Rückgabe als
  bauend erhoben. Gegenproben stehen in `tests/structure/pruefdienst-urteilsregel-haertung.test.ts`.
- **Belegt: Erfassung neuer Dateien einzeln (zweiter Messfehler).** Statt `git status` ohne
  `-uall` erhebt `produkt.py` `kandidat` neue Dateien einzeln über
  `git ls-files --others --exclude-standard` (Z. 737).
- **Ungeklärt: Auftragsart-Erkennung des heutigen Wegs.** In den sieben ausgewerteten Modulen gibt
  es kein ausdrückliches Feld für die Auftragsart und keine Erkennung eines ausdrücklich lesenden
  Auftrags. Die Felder `allowed_paths`, `checks`, `browser` und `postgres` in `AUFTRAG.json`
  bestimmen keine Auftragsart. Die Änderungsprüfung in `produkt.py` (Z. 737–742) ist keine
  Auftragsart-Erkennung: Sie lässt `merge_commit` und `build_origin_file` als Alternativen zu einer
  Änderung zu. Ob es die Unterscheidung „lesend/bauend“ im heutigen Weg gibt und welcher Standard
  dort gilt, ist nicht belegt.
- Bewertung: **teilweise.** Anerkannt sind nur die beiden belegten Teile; die Auftragsart-Erkennung
  mit ausdrücklichem Feld und Standardfall bleibt **ungeklärt**.

### K15 · R-2021 — Ben wird nicht ausgelassen, läuft parallel

Drei Teile, getrennt bewertet:

- **Pflichtprüfung, „ben wird nicht ausgelassen“: erfüllt.** Ben ist eine Phase vor der
  Auslieferung. Ohne `erfuellt` wird nicht geliefert (`produkt.py` `ben`, Z. 957–1060, Annahme
  Z. 1057; `ben_vor_lieferabschluss`, Z. 1176).
- **Eingefrorener Stand, andere Fläche: erfüllt.** Ben prüft nur bei `HEAD == SHA` und sauberem
  Baum (Z. 975) und läuft in einer schreibgeschützten Sandbox (`--sandbox read-only`, Z. 1020).
- **Parallelität zur weiterarbeitenden Hand: ungeklärt.**
  - R-2021 verlangt, dass Ben gleichzeitig zur weiterarbeitenden Hand gegenprüft. R-1362 verlangt,
    dass die Prüfung die Maschinenprüfung **desselben geprüften Standes** abwartet. Beides kann
    zugleich gelten; R-1362 hebt R-2021 nicht auf.
  - In den ausgewerteten Quellen ist weder belegt, dass die Hand während Bens Prüfung am Auftrag
    weiterarbeitet, noch gibt es eine Entscheidung, die R-2021 ablöst.
  - Belegt ist nur, dass die Bens verschiedener Aufträge gleichzeitig laufen (K12). Das ist nicht
    die in R-2021 gemeinte Parallelität.
- Bewertung: **teilweise.** Pflichtprüfung und eingefrorener Stand sind erfüllt; die Parallelität
  ist ausdrücklich **ungeklärt**.

### K16 — Lieferbeleg, Abgrenzung, Widersprüche

- Tatsächlich geliefert in diesem Auftrag: die Härtungen in `tools/urteilslage.ts` und
  `tools/schon-eingebaut.ts` samt Gegenproben sowie dieses Dokument. Den Lieferbeleg mit Fassung
  erzeugt erst die Veröffentlichung.
- Historisch abgeschlossen und weiterverwendet (Ben bestätigt): **R-1216** (Prüfseite),
  **R-1238** (Abnahmemodell K-E5), **R-1301** (Zweitinstanz-Prüfung).
- Gesonderter Auftrag: **R-1235** (Fäule-Werkzeug), siehe
  `docs/entscheidungen/r1235-faeule-werkzeug.md`. Es gehört nicht zu diesem Auftrag.
- Quellenwidersprüche: R-1478 (K13) ist oben eingeordnet. Zwischen R-2021 und R-1362 besteht kein
  Widerspruch (K15); offen ist dort nur, ob die Parallelität belegt ist.
  Außerdem: Der Altbestand führt R-1201, R-1202, R-1231, R-1248 und R-1258 als `ERLEDIGT`, nennt
  aber jeweils offene Reste. Maßgeblich sind die Reste, bewertet am heutigen Weg.

## Verbleibende Unterschiede

| Punkt | Rest | Art |
| --- | --- | --- |
| K1 | Kein Alarm „Stände warten, seit über 1 h kein echtes Urteil“; Anzeigeort von `DIENST.json` nicht belegt | technische Lücke in der Koordination |
| K2 | Vollständigkeit der Ben-Belegpfade nur über `benfortsetzung` belegbar | Beleglücke (Modul nicht in der Quellenführung) |
| K4 | Kein Fallbeleg, dass eine neu rote Assertion in einer bereits roten Datei als Befund ausgewiesen wurde | Beleglücke |
| K9 | Ordnungsschlüssel Produktnähe und Tests fehlen in `dienst.py` `reihenfolge`; die zentrale Priorität allein belegt keine Ablösung von R-1380 | technische Lücke in der Koordination |
| K10 | Keine Messung der Übereinstimmung von Maschinen- und Benurteil | technische Lücke in der Koordination |
| K14 | Auftragsart-Erkennung mit ausdrücklichem Feld und Standardfall im heutigen Weg nicht belegt | ungeklärt |
| K15 | Parallelität der Gegenprüfung zur weiterarbeitenden Hand nicht belegt; keine ablösende Entscheidung | ungeklärt |

Die technischen Lücken (K1, K9, K10) betreffen `dienst.py` (K1, K9), `befund.py` und `produkt.py` (K10). Diese Dateien liegen
nicht in den `allowed_paths` dieses Auftrags (`AUFTRAG.json`). Diese Grenze ist konkret belegt.
Ein fehlender Zugang wird damit nicht behauptet.

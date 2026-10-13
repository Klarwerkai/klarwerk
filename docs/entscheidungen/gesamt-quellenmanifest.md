# Normative Quellen anhand Manifest vollständig und bytegenau prüfen

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-quellenmanifest`, Revision 1, Lauf 1 auf Basis
`2a96bab2` (`1.0.0-beta.1.973`), Abgleich am 13.10.2026. Zugeordnet sind R-1247, R-1351, R-1367,
R-1467, R-1468, R-1821, R-1825, R-2002 und R-2015. Die Fassung dieses Laufs steht erst nach der
Veröffentlichung fest. Der echte Lieferbeleg (Deployment, Livefassung) entsteht ebenfalls erst danach.*

Kriterien K1–K10 in der Reihenfolge von `AUFTRAG-B1.json`: K1 = R-1247, K2 = R-1351, K3 = R-1367,
K4 = R-1467, K5 = R-1468, K6 = R-1821, K7 = R-1825, K8 = R-2002, K9 = R-2015, K10 = Ergebnis und
Abgrenzung.

## 1. Was dieser Lauf liefert

| Teil | Ort | Kriterien |
|---|---|---|
| Manifest der normativen Quellen: je Datei Zeilen, Bytes, voller Datei-Hash | `docs/normative-quellen/manifest.json` | K1, K6, K7, K8 |
| Manifest-Wächter: erhebt den normativen Bereich selbst, vergleicht beidseitig, berechnet die Zahl, mit zehn Gegenproben | `tests/normative-quellen/manifest-waechter.test.ts` | K1, K6, K7, K8 |
| Quellenwegkarte zu FREEZE-144 | `docs/freeze144/quellenwegkarte.json` | K5 |
| Wächter der Karte, mit Gleichlauf zur Dateiliste des Freeze-Manifests | `tests/freeze144-quellenwege/quellenwegkarte.test.ts` | K5, K2 |
| Voller Pin von `ALLOWED_DIV_CLASSES` an beiden Kopien (Oberfläche und Server) | `tests/web/blockklassen-erlaubnisliste-gepinnt.test.ts` | K3, K2 |

Produktcode, eingefrorene Dateien und die normativen Quellen selbst sind unverändert.

## 2. Der normative Bereich heute

Die alte Grundmenge (`_relay/kopf/UEBERGABE-*`, `ENTWURF-GRUNDGESETZ.md`,
`ENTWURF-FUNDAMENT-UMSTELLUNG.md`, `manifest-waechter.py`) gehört zur verworfenen alten Steuerung.
Sie liegt nicht im Produktbaum (`_relay/` ist ignoriert) und wurde nicht wiederaufgebaut. Die noch
gültige Anforderung ist auf den heutigen Arbeitsweg bezogen:

- **Einstiege:** `AGENTS.md` und `CLAUDE.md`. Sie beschreiben den von Pedi freigegebenen Ablauf.
- **Verwiesene Regeln:** jede `.md`-Datei, die ein Einstieg in Backticks nennt. Heute sind das
  `CLAUDE.md`, `harness/00-principles.md`, `harness/40-testing-strategy.md` und
  `harness/80-definition-of-done.md`.
- **Regelverzeichnis:** jede Datei unter `harness/`, auch eine neu angelegte.

Gemessen am 13.10.2026: zehn Dateien, alle im Manifest.

Nicht im Bereich sind `PROJECT_CONTEXT/` (laut `CLAUDE.md` „Arbeitsunterlagen“), `OFFEN.md`
(historisches Register), `specs/`, `tests/` und `docs/`.

**Maß.** `zeilen` = `wc -l`, `bytes` = `wc -c`, `gitBlob` = `git hash-object <datei>`. Das ist der
volle Datei-Hash im Sinne von Fundament 2f, kein Inhalts-Hash. Gewählt wurde das git-Format, weil
jeder Wert ohne Zusatzwerkzeug nachrechenbar ist. SHA-1 genügt zum Erkennen von Abweichungen. Gegen
eine absichtlich erzeugte Kollision schützt es nicht. Das liegt ohnehin außerhalb der benannten
Grenze (Abschnitt 3).

**Ändert ein Auftrag eine normative Quelle,** trägt er die drei Werte der Datei im selben Diff ins
Manifest ein. Eine neue Datei unter `harness/` oder ein neuer Verweis aus einem Einstieg braucht eine
neue Zeile. Bis dahin ist der Wächter rot. Seine Meldung nennt Manifestwert und Messwert.

## 3. Antwort auf das ROT-Urteil `sammel100` (K1, K6, K7, K8)

| Punkt aus der Quelle | Heute |
|---|---|
| Prüfliste aus dem Manifest, je Zeile Existenz, Zeilen, Bytes, Prüfsumme (R-1247) | Fall 1 „jede normative Quelle stimmt bytegenau“ |
| Stopp in beide Richtungen, fehlende und unerwartete Zeilen (R-1247) | G3 unklassifizierte Datei, G5 fehlende Datei, G7 Zeile außerhalb des Bereichs |
| Vollständigkeit nicht aus sich selbst feststellbar (B76) | Der Bereich wird aus Einstiegen, Verweisen und `harness/` erhoben, nie aus dem Manifest |
| Höchste Zeile entfernt, Lauf bleibt grün (B76) | G4: die Datei wird unklassifiziert, `geprueft` sinkt nicht mit |
| `--erwartet-gehasht 7` ist wieder eine Liste (B72, B76) | keine übergebene Zahl. `geprueft` = Größe des erhobenen Bereichs, GRÜN nur bei `gehasht = geprueft` |
| „nicht erreichbar“ wird allein wegen dieser Wörter akzeptiert (B76) | es gibt keine Ausnahmezelle |
| Unklassifizierte Dateien rot statt unsichtbar (R-1247, B76) | G3, G6 |
| Hash-Semantik: voller Datei-SHA (B72 Fassung 2f, B76 GRÜN) | `gitBlob` über die unveränderten Dateibytes |
| I53: der Wächter kennt die geltenden Dokumente nicht (R-2002) | G6: neuer Verweis eines Einstiegs ohne Zeile ist rot. G7: Zeile für eine abgelöste Lage ist rot |
| Benannte Grenze (R-1247) | bleibt. Der Wächter prüft Widerspruchsfreiheit, nicht Berechtigung |

**Abweichung von bens Vorschlag in `sammel100`:** Er schlug maschinenlesbare Rollen-Metadaten in den
normativen Quellen vor. Der Bereich wird hier stattdessen aus festen Einstiegen, ihren Verweisen und
einem Regelverzeichnis erhoben. So musste keine normative Quelle für den Wächter geändert werden.
Das Ziel ist dasselbe: eine unabhängig ableitbare Grundmenge mit beidseitigem Vergleich. Die
Festlegung der Einstiege und des Verzeichnisses steht im Wächter und nicht im Manifest. Wer sie
ändert, ändert einen Test.

**Nicht übernommen (alte Steuerung):** die Fundament-Freigabe durch Pedi, bens drei
Freigabebedingungen aus `sammel93`, die Trennung von Rohtext und Auswertung, die Dispatch-Regel mit
vier Objekttypen, die Manifestzeile 10 und der Inline-Mengen-Hash. Sie betreffen Gegenstände der
verworfenen Steuerungsarchitektur. Der historische Recheck B72 ist mit B76 (`sammel100`, ROT)
abgeschlossen. Dieser Lauf wiederholt ihn nicht.

## 4. Die übrigen Anliegen

**K2 · R-1351 Gleichlauf-Wächter.** Teilweise vorhanden. Eingebaut sind Wächter über doppelt
geführte Blöcke: `tests/structure/kd-capture-doppelungen.test.ts` (JOB 2445, 2454, 2467),
`tests/structure/fremddoppelungen-kd-capture.test.ts` (JOB 2476, 2498) mit der gemeinsamen Erhebung
`tests/structure/doppelungs-erhebung.ts`, dazu `tests/app/ext-attach-gate-gleichlauf.test.ts`
(JOB 2433). Die beiden Doppelungswächter sind im Prüflauf zu `be1bfe44` auf unveränderter Basis
rot. Ihre Register sind veraltet (Abschnitt 5). Sie *melden* die Drift also, wie R-1351 es verlangt.
Behoben ist sie nicht. Grün im selben Lauf: `ext-attach-gate-gleichlauf`. Neu in diesem Lauf sind zwei weitere Gleichläufe: die Karte gegen die Dateiliste von
FREEZE-144 (K4, K5 der Kartenprüfung) und die zwei Kopien von `ALLOWED_DIV_CLASSES`. Eine Erhebung
*aller* doppelt gepflegten Stellen im Repository gibt es nicht. JOB 2453 („vierzehn Testdateien
lesen dasselbe Werkzeug“) und JOB 2506 sind im Baum nicht namentlich auffindbar. Der Inhalt von
JOB 2667 (ROT) ist nicht belegt.

**K3 · R-1367 Erlaubnisliste.** Geliefert in diesem Lauf. JOB 2461 (`d037-blockklassen-bedarfsdeckung`)
und JOB 2442 (`d037-blockklassen-reichweite`) melden nur den Wegfall einer gebrauchten Klasse. Eine
Aufnahme blieb dort bewusst grün. Der neue Pin hält den vollen Inhalt beider Kopien fest, in ihrer
Reihenfolge. Jede Aufnahme und jede Streichung ist jetzt rot, bis die gepinnte Liste im selben Diff
angepasst wird.

**K4 · R-1467 Quellenmanifest zu den acht Betriebsbefunden.** Offen, Quelle fehlt. Die acht
Befunde N1–N8 sind weder im Produktbaum noch in `QUELLEN.json` ausgeschrieben. Die Registerzeile
nennt nur den Makroauftrag
`03_AUFTRAEGE/basic_pausiert/MAKROAUFTRAG-BASIC5-JOB-894-D1-N1-N8-QUELLENMANIFEST.md` (JOB 894,
zuletzt D1 BEN ROT, 14.08.). Er liegt außerhalb des erlaubten Arbeitsbereichs und wurde nicht
gelesen. Ein Manifest ohne die Befunde wäre erfunden. Nötig ist die Vorlage der acht Befunde mit
ihren Aussagen.

**K5 · R-1468 Quellenwegkarte und Wächter.** Geliefert in diesem Lauf. Die Karte nennt je
eingefrorener Datei die direkten Quellwege (Import, Re-Export, `import()`, Import-Typ). Jedes Ziel
ist eingeordnet: `eingefroren`, `modul`, `nachbarmodul` oder `paket`. Der Wächter erhebt die Wege aus
dem Syntaxbaum und meldet neue, entfallene und umgeordnete Wege. Er meldet auch, wenn Karte und
Freeze-Dateiliste auseinanderlaufen. **Grenze:** keine transitive Hülle. Änderungen *innerhalb*
nicht eingefrorener Ziele (`service.ts`, `explore.ts`, `knowledge-object` …) meldet die Karte nicht.
Sie macht nur sichtbar, dass dieser Teil des eingefrorenen Stands nicht vom Freeze gedeckt ist. Ob
JOB 880 (D5 BEN ROT, 20.08.) genau diese Form meinte, ist nicht belegt. Die Auftragsdatei lag
außerhalb des Arbeitsbereichs.

**K9 · R-2015 / I39 Erzeuger der Zentrale.** Nicht gebaut, gehört zur alten Steuerung. Die Zentrale
ist `_relay/board/klarwerk-board.html`, ihr Register war `_relay/kopf/offen-seite.py`. Beides ist
Teil der verworfenen Steuerungsarchitektur und liegt nicht im Produktbaum. Ein Erzeuger dafür wäre
ihr Wiederaufbau. Vorhanden und unverändert ist der Drift-Wächter aus JOB 2065:
`tools/zentrale-drift.ts`, aufgerufen in `tools/check`, mit dem Test
`tests/structure/job2065-zentrale-drift.test.ts`. Ohne Lesefläche meldet er „nichts gemessen“. Die
Behebung der sechs Fundstellen W12, A20, B27 und S7 lag bei Pedi und betrifft dieselbe alte
Lesefläche. Dass dort keine Handlungsseite mehr gepflegt wird, ist eine Lesart. Eine
Nutzerentscheidung dazu ist nicht belegt.

## 5. Abgrenzung

- **Freeze-144 selbst** (`tests/library-analytics-freeze144.test.ts`, Hash und Freigabe je Datei)
  ist bestehender Bestand. Er wurde nicht geändert. Die Karte liest seine Dateiliste nur.
- **Rote Bestandswächter auf der unveränderten Basis** (Prüflauf zu Kandidat `be1bfe44`, Nacharbeit
  1). Dieser Lauf hat keine der betroffenen Dateien berührt. Bytezahl und SHA-256 im Kandidaten
  stimmen mit dem Arbeitsbaum der Basis überein.
  - `tests/library-analytics-freeze144.test.ts`, Fälle „der Freeze hält“ und „KALIBRIERUNG“: Vier
    eingefrorene Dateien tragen nicht mehr ihren Sollhash. Betroffen sind `index.ts` (gemessen
    `f8afce97…`), `src/repo.ts`, `src/repo-pg.ts` und `src/repo-pg.integration.test.ts`. Eine neue
    Freigabe je Datei gehört zur offenen Ownerfrage des Freeze. Sie wird hier weder erteilt noch
    erraten.
  - `tests/structure/kd-capture-doppelungen.test.ts` G1/G2 und
    `tests/structure/fremddoppelungen-kd-capture.test.ts` D1/F1: Die Register `PAARE`, `AUSNAHMEN`
    und `FREMDE` stimmen nicht mehr mit `Capture.tsx`, `BibliothekLesen.tsx`, `MehrAbschnitte.tsx`
    und weiteren Seiten überein. Ob eine Seite nachgezogen oder ein Registereintrag mit Grund
    aufgenommen wird, ist eine fachliche Entscheidung an fremden Flächen. Dieser Lauf trifft sie
    nicht und schwächt keinen Sollwert ab.
  - Die Wächter sind deshalb nicht in der Prüfauswahl dieses Auftrags. Sie bleiben im globalen Tor
    unverändert und rot sichtbar.
- **Quellen zu den Kernfragen** (`docs/aufnahme/quellen-kernfragen/`, Auftrag
  `gesamt-quellen-kernfragen`, R-1384) ist ein gesonderter Auftrag. Er nennt Quellenmanifest N1–N8
  und Quellenwegkarte ausdrücklich als getrennt geführt.
- **Klassenwächter für einmal im Baum vorhandene Strukturen** (JOB 2547) ist laut Notiz zu R-1351
  getrennt geführt und nicht Teil dieses Laufs.
- **Erlaubnisliste der Fehlerklassen** (`erlaubterTyp` in `build-app.ts`, `log-positivliste.ts`) ist
  laut Notiz zu R-1367 eine eigene Zeile und nicht Teil dieses Laufs.

## 6. Quellenwidersprüche und fehlende Belege

1. **R-1247, drei Stände:** Altstatus `ERLEDIGT` mit I40 („gebaut und läuft — GRÜN“), das spätere
   Prüfurteil `sammel100` ROT und der heutige Zustand `angedacht` / `nur_altquelle` widersprechen
   sich. Maßgeblich war hier der jüngste Inhalt, das ROT-Urteil mit seinen Punkten.
2. **R-1351 „Einbau nicht belegt“** gegen den Baum: Die Wächter aus JOB 2445, 2454, 2467, 2476 und
   2498 sind eingebaut (Abschnitt 4). Die Registeraussage ist für diese Teile überholt.
3. **R-1367 „GEBAUT, wartet auf Einbau“** gegen den Baum: JOB 2461 ist eingebaut, bewacht aber
   absichtlich nur eine Richtung. Das widerspricht dem Wortlaut „pinnt sie fest“. Behoben durch den
   neuen Pin.
4. **R-1825 (B72) gegen R-1821 (B76):** B72 nennt den Recheck „beauftragt“, B76 hält ihn als
   abgeschlossen fest, mit ROT. Beide Zeilen stammen aus derselben Altquelle, B76 ist der spätere
   Stand.
5. **R-2002 (I53):** „Die Zahl 7 darf nur mit einer bewussten Manifestentscheidung wachsen.“ B76
   verwirft die übergebene Zahl ganz. Umgesetzt ist B76: Die Zahl wird berechnet, und jede neue Datei
   braucht eine bewusste Manifestzeile.
6. **R-2015 (I39):** „Zu bauen: ein Erzeuger“ steht gegen die Begründung in `tools/zentrale-drift.ts`
   (JOB 2065: Wächter statt Erzeuger, weil die Zentrale eine kuratierte Auswahl ist und das Register
   die Sektion „Stand“ nicht führt). Zusätzlich liegt der Gegenstand in der verworfenen Steuerung.
7. **Hinweistext gegen Datensatz:** Die Altbestandszeilen R-1247, R-1351, R-1367, R-1467 und R-1468
   sagen „Auch eine alte Pedi-Auswahl bleibt unten als historische Entscheidung erhalten“. Sie tragen
   aber `pedi_override: null` und keine Entscheidung. Eine Pedi-Auswahl ist nicht vorhanden.
8. **Nicht gelesen** (außerhalb des Arbeitsbereichs): `FUNKTIONSREGISTER.json`, `dev_Klarwerk/OFFEN.md`,
   `manifest-waechter.py`, `AUFTRAG-ben-sammel98-fundament-2f.md`, bens Bericht `sammel100` und die
   Makroaufträge zu JOB 880, 894, 2453 und 2461. Ihre Inhalte sind nur so weit verwendet, wie
   `QUELLEN.json` sie wörtlich zitiert. Die Altbelege tragen keine Zeitangabe (`zeit: null`).

## 7. Stand je Anliegen

| Anliegen | Stand | Beleg |
|---|---|---|
| R-1247 Manifest-Wächter | geliefert in diesem Lauf, mit benannter Grenze | Manifest-Wächter Fall 1, G1–G10 |
| R-1821 / R-1825 ROT-Punkte und Recheckfragen | geliefert, soweit nicht alte Steuerung (Abschnitt 3) | Manifest-Wächter G4, G6, G7, Fall 1 |
| R-2002 I53 | geliefert in heutiger Form | Manifest-Wächter G6, G7 |
| R-1351 Gleichlauf | vorhanden und um zwei Gleichläufe ergänzt. Keine Gesamterhebung. Zwei Bestandswächter melden auf der Basis rot (Abschnitt 5) | `ext-attach-gate-gleichlauf`, Karte K4/K5, Pin |
| R-1367 Erlaubnisliste | geliefert in diesem Lauf | Pin-Test |
| R-1468 Quellenwegkarte | geliefert in diesem Lauf, ohne transitive Hülle | Kartenwächter |
| R-1467 Betriebsbefunde N1–N8 | offen, Quelle fehlt | — |
| R-2015 Erzeuger der Zentrale | nicht gebaut (alte Steuerung). Drift-Wächter vorhanden | `tools/zentrale-drift.ts` |

Ob diese Lieferung die Kriterien erfüllt, steht erst nach Bens Prüfung, der Veröffentlichung und dem
gespeicherten Abschluss fest.

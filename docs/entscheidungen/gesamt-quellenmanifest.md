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
| Quellenwegkarte zu FREEZE-144: Herkunft von Dateiliste und Sollwerten (Plan 327, JOB 880, heute), ergänzend Importwege | `docs/freeze144/quellenwegkarte.json` | K5 |
| Wächter der Karte: Sollwert je Datei gegen den Freeze-Wächter, Gleichlauf der Dateiliste, Importwege | `tests/freeze144-quellenwege/quellenwegkarte.test.ts` | K5, K2 |
| Abgleich des vorhandenen N1–N8-Manifests (Plan 317, JOB 894) und Ablösung der Zentrale | dieses Dokument, Abschnitt 4 | K4, K9 |
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
angepasst wird. **Nacharbeit 2 (Bens Befund):** Die erste Fassung filterte alle Elemente außer
String-Literalen heraus, sodass eine Aufnahme über `...["x"]` oder eine Konstante unsichtbar blieb.
Jetzt wird jedes andere Element als `UNBEKANNT: <Quelltext>` mitgeführt. Auch ein Initialisierer,
der kein `new Set([...])` mit genau einem Array ist, ergibt `UNBEKANNT`. Beides weicht vom Pin ab und
ist rot. Die Gegenproben decken Spread, Konstante, fremden Initialisierer und ein zweites Argument ab.

**K4 · R-1467 Quellenmanifest zu den acht Betriebsbefunden.** Vorhanden (historisch), abgeglichen
in diesem Lauf. Die erste Fassung dieser Datei behauptete, die Quelle fehle. Das war falsch: Ben hat
die Quellen gelesen, und sein Prüfprotokoll (`HISTORIE/nacharbeit-2/BEN/STREAM.jsonl`) enthält sie
wörtlich. Der Inhalt unten stammt aus diesem Protokoll. Die Dateien selbst liegen außerhalb des
Arbeitsbereichs dieses Laufs. Es wurde nichts neu erhoben und keine historische Prüfung neu
beauftragt.

- **Das Manifest gibt es.** Fassung: `Projekt_klarwerk/03_AUFTRAEGE/planung/PLAN-BASIC-W1-N1-N8-READONLY-QUELLENMANIFEST-317.md`,
  BASIC 317 vom 04.08.2026, 148 Zeilen. SHA-256 `164e538a2519f40a2a27f7476d93e12b6677c30b5fd53976c034fcf1698657b2`,
  gemessen von JOB 894. Je Befund N1–N8 führt es Quellpfad, Zeilenanker, zulässigen reinen
  Lesezugriff, erwartete belegbare Aussage und Abbruchgrenze. Damit ist die Anforderung von R-1467
  („welche Quelle jede einzelne Aussage trägt“) im Bestand erfüllt. Ausdrücklich entscheidungsneutral:
  „`N1`–`N8` bleiben fail-closed offen“.
- **Das Ergebnis dazu gibt es.** Fassung: `_relay/kopf/outbox/RUECKGABE-BASIC5-JOB-894-D1-N1-N8-QUELLENMANIFEST.md`,
  Base `79930092`, Abschluss `ENTSCHEIDUNG_NOETIG`. Alle gebundenen Hashes sind byte-identisch, und
  alle zwanzig prüfbaren Zeilenanker in N5 und N7 treffen. Sieben von acht Zeilen haben aufgelöste,
  hash-verifizierte Quellen.
- **Tatsächliche Restpunkte laut JOB 894:**
  1. **N1:** Die Platzhalter `<freeze>` und `<beleg>` aus Plan 288 §C.8 sind an kein Verzeichnis
     gebunden. Ohne sie hat N1 keinen Gegenstand. Plan 317: „Ich setze sie nicht selbst.“ Das ist
     eine offene Entscheidung des damaligen Kopfes. Sie wird hier nicht getroffen.
  2. **N4:** Der Korridor enthält `apps/web/dist/word-addin/taskpane.html`. Der Pfad ist
     gitignoriert und in keinem Clone vorhanden.
- **Heutiger Stand der Produktanker** (Quelleninspektion am Arbeitsbaum, kein Testlauf):
  - **N4:** unverändert. `git ls-files` führt die anderen drei Korridordateien, `apps/web/dist/word-addin/taskpane.html` nicht.
    `apps/web/.gitignore:2` lautet `dist`.
  - **N5:** Alle Symbole aus `services/app/src/security-headers.ts` bestehen noch, aber auf anderen
    Zeilen. `fastifyHelmet` steht auf :1 wie damals. `WORD_ADDIN_CSP_PATHS` steht jetzt auf :26
    (damals :14), `WORD_ADDIN_CSP` auf :56 (:27), `UPGRADE_INSECURE_REQUESTS` auf :72 (:53),
    `isHttpsRequest` auf :84 (:65), `withUpgradeInsecureRequests` auf :89 (:70),
    `isWordAddinCspPath` auf :102 (:83). Die helmet-Registrierung beginnt auf :175 (:88).
  - **N7:** In `web-static.ts` steht `isAssetRequest` jetzt auf :11 (damals :8), `registerWebStatic`
    auf :80 (:20), `app.register(fastifyStatic` auf :109 (:21), der `/word-addin/`-Präfixvergleich
    auf :142 (:54) und `setNotFoundHandler` auf :152 (:64). In `server.ts` stehen Import und Aufruf
    jetzt auf :31 und :109 (damals :14 und :63).
  - **Folge:** Die Zeilenanker von N5 und N7 und die damals gebundenen Datei-Hashes
    (`960cd7f7…`, `65aac5c5…`) sind veraltet. Die Symbole tragen weiter. Der Hash wurde in diesem
    Lauf nicht gemessen; dass die Dateien gewachsen sind, belegen die Zeilennummern.
  - **N2, N3, N6, N8 und N1** zeigen auf `_relay/pruefmittel/klara-snapshot-origin-290.mjs` oder auf
    Plan 288. Beides gehört zur alten Steuerung und liegt nicht im Produktbaum. Ihr heutiger Stand
    ist hier nicht prüfbar.
- **Quellenwidersprüche:** Das Register (R-1467) führt JOB 894 als „zuletzt D1 BEN ROT (14.08.)“
  und Status `SPAETER`. Die Rückgabe selbst schließt mit `ENTSCHEIDUNG_NOETIG` und nennt „Das
  Manifest hat seinen Zweck erfüllt“. Den BEN-Bericht zu D1 hat dieser Lauf nicht gesehen. Worauf
  das ROT zielt, ist deshalb nicht belegt.
- **Rest:** die N1-Wurzelentscheidung, die N4-Korridorentscheidung (gitignorierten Pfad ersetzen
  oder ausnehmen) und das Nachziehen der N5/N7-Anker, falls die acht Prüfungen je ausgeführt werden
  sollen. Keine davon ist ohne Nutzerentscheidung zu treffen. Die acht Prüfungen selbst sind laut
  Plan 317 nicht bestellt.

**K5 · R-1468 Quellenwegkarte und Wächter.** Geliefert in diesem Lauf, in Nacharbeit 2 auf die
Originalquelle bezogen.

- **Originalquelle abgeglichen** (Inhalt aus Bens Prüfprotokoll, siehe K4):
  - Plan `PLAN-PRO-W2-Q5-FREEZE144-QUELLENWEGKARTE-327.md` (PRO 327, 04.08.2026) ist eine Karte von
    Wegen zu Akten, aus denen Dateiliste und historische Sollhashes von Freeze 144 stammen. Sie
    nennt sechs Wege W-1 bis W-6, darunter das Manifest `KW-W2A-FREEZE144-200/MANIFEST.txt`. Gesucht
    waren die zwei in PRO 325 unbenannten Dateien.
  - `RUECKGABE-PRO5-JOB-880-D1-FREEZE144-QUELLENWEGKARTE.md` (Base `79930092`) schließt mit
    `BAUBEREIT`. Beide Namen sind gefunden, die historischen Sollhashes bestätigt, alle sechs
    Dateien waren damals SOLL = IST. Ihr Befund: Im Produktbaum fehlte jeder maschinelle Wächter zu
    Freeze 144.
- **Heute:** Diesen Wächter gibt es (`tests/library-analytics-freeze144.test.ts`). Er ist der
  heutige Träger von Dateiliste, Sollhash und Freigabe je Datei.
- **Teil A der Karte (Herkunft):** `docs/freeze144/quellenwegkarte.json` führt die Kette
  Plan 327 → JOB 880 → heutiger Wächter. Je Datei stehen die Herkunft des Namens und der heute
  gültige Sollhash mit seiner Freigabe. Die Herkunft der Namen ist abgeleitet: PRO 325 nannte vier
  Dateien, also stammen `index.ts` und `types.ts` aus JOB 880.
- **Wächter zu Teil A:** Setzt jemand im Freeze-Wächter einen Sollhash oder eine Freigabe neu, ohne
  die Karte nachzuziehen, meldet der Kartenwächter `SOLLWERT` (Gegenproben S1–S3).
- **Teil B (Importwege):** ist ein ergänzender Teilumfang. Er zeigt, welche Inhalte des
  eingefrorenen Stands aus nicht eingefrorenen Modulen kommen. Grenze: keine transitive Hülle.
- **Unterschied zu JOB 880:** Die damaligen historischen Sollhashes sind heute durch neue,
  ausgewiesene Freigaben abgelöst. Die verbrauchten Freigaben stehen in `WIDERRUFENE_FREIGABEN`.
  Ob die Dateien ihren Sollhash heute tragen, prüft allein der Freeze-Wächter. Er ist auf der Basis
  rot (Abschnitt 5). Die Karte meldet das nicht, sie bildet nur die Herkunft der Sollwerte ab.
- **Nicht geöffnet und offen:** Die Rollenfrage zu W-1 (`AB-5`) und die BASIC/BEN-Wege W-5/W-6 hat
  schon JOB 880 nicht geöffnet. Sie bleiben auch hier offen. Ebenfalls nicht gesehen wurde der
  spätere Stand „D5 BEN ROT (20.08.)“ laut Register.

**K9 · R-2015 / I39 Erzeuger der Zentrale.** Die noch gültige Anforderung lautet: Eine
Handlungsübersicht darf nicht von Hand nachgezogen werden, sondern muss aus dem Register entstehen
(„was von Disziplin abhängt, überlebt keine Nacht“). Abgleich mit dem heutigen Arbeitsweg nach
`CLAUDE.md` (Abschnitt „Ein Ablauf“):

- **Heutige Handlungsübersicht je Auftrag:** Das ist die Datei `auftragsstand.json` im
  Auftragsordner. Sie führt `fortschritt.schritt`, `naechster_schritt`, `blockade`, `kandidat` und
  `lieferung`.
- **Ihre Datenquellen:**
  - Der Auftrag selbst ist `AUFTRAG-B1.json`. Er trägt Status, Kriterien und Abschlussbeleg und
    kommt aus der Auftragsquelle mit `source_id`, `locator` und SHA-256 der Quelle
    (`QUELLEN.json`).
  - Die Prüfergebnisse sind die Quittungen der Phasen aus `PLAN.json`: `claude`, `kandidat`,
    `pruefung`, `ben`, `auslieferung`.
- **Belege für die automatische Übernahme** (Inspektion dieses Auftragsordners, 13.10.2026):
  - `auftragsstand.json` trägt `schema: 1` und `revision: 18`. Jede Änderung ist ein `verlauf`-Eintrag
    mit `operation_id`, etwa `…:pruefung:be1bfe44…:fehler:6` oder `nacharbeit:g2`, und mit Zeitstempel.
  - Jede Prüfung verweist auf ihre Quittung oder ihr Archiv, etwa
    `HISTORIE/nacharbeit-2/ARCHIV.json`.
  - Den nächsten Schritt setzt die Phasensteuerung, nicht ein Mensch. Beispiel: Revision 17 setzt
    `naechster_schritt` nach Bens Nacharbeit auf „Konkreten Fehler in bestehender Claude-Sitzung
    beheben“.
  - Der Fall vom 31.07. war eine beantwortete Entscheidung, die weiter als offen angezeigt wurde. Er
    entsteht so nicht, weil Anzeige und Stand dieselbe Datei sind und kein zweites, gepflegtes
    Abbild existiert.
- **Zuordnung:** Die von Hand gepflegte Zentrale ist durch den maschinell fortgeschriebenen
  Auftragsstand abgelöst. Ein Erzeuger für `_relay/board/klarwerk-board.html` wäre ein Wiederaufbau
  der verworfenen Steuerung und wird nicht gebaut.
- **Grenzen, offen benannt:**
  - Eine Gesamtübersicht über *alle* Aufträge, etwa für Pedi, und ihr Erzeuger
    (`produkt_intake.py`, Koordinationsordner) liegen außerhalb des Arbeitsbereichs dieses Laufs.
    Ob es sie gibt und ob sie generiert ist, ist hier nicht belegt.
  - Eine ausdrückliche Nutzerentscheidung „Zentrale abgelöst“ ist nicht belegt. Belegt ist der von
    Pedi freigegebene vereinfachte Ablauf in `CLAUDE.md`, Commit `f41d9073`, „docs: simplify agent
    instructions for the approved production workflow“.
- **Technischer Rest im Produktbaum:**
  - `tools/zentrale-drift.ts` (JOB 2065) und seine Zeile in `tools/check` messen weiterhin
    `_relay/board/klarwerk-board.html` gegen das historische `OFFEN.md`. In jedem heutigen Clone
    endet der Lauf mit „nichts gemessen“ (Code 2, kein Abbruch des Tors). Der Wächter ist damit
    wirkungslos, aber unschädlich.
  - Ob er entfernt wird, ist eine Entscheidung über einen gelieferten und von BEN geprüften
    Bestand. Dieser Lauf trifft sie nicht und lässt Wächter und Test unverändert.

## 5. Abgrenzung

- **Freeze-144 selbst** (`tests/library-analytics-freeze144.test.ts`, Hash und Freigabe je Datei)
  ist bestehender Bestand. Er wurde nicht geändert. Die Karte liest seine Dateiliste nur.
- **Rote Bestandswächter auf der unveränderten Basis** (Prüflauf zu Kandidat `be1bfe44`, Nacharbeit
  1). Dieser Lauf hat keine der betroffenen Dateien berührt. Die Bytezahlen im Kandidaten
  (`FASSUNG-QUELLE.json`) stimmen mit dem unveränderten Arbeitsbaum der Basis überein, für
  `index.ts` zusätzlich der SHA-256. Ein Commit-Diff konnte in jenem Lauf nicht ausgeführt werden.
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
   Makroaufträge zu JOB 2453 und 2461. Ihre Inhalte sind nur so weit verwendet, wie `QUELLEN.json`
   sie wörtlich zitiert. Die Altbelege tragen keine Zeitangabe (`zeit: null`).
   **Korrektur in Nacharbeit 2:** Die Makroaufträge zu JOB 880 und 894, Plan 317, Plan 327 und die
   Rückgaben zu JOB 880 und 894 sind vorhanden. Ihr Wortlaut ist aus Bens Prüfprotokoll übernommen
   (`HISTORIE/nacharbeit-2/BEN/STREAM.jsonl`). Von den beiden Rückgaben enthält das Protokoll nur
   den Kopf, die ersten 65 Zeilen. Spätere Abschnitte und die BEN-Berichte zu JOB 880 D5 und
   JOB 894 D1 hat dieser Lauf nicht gesehen.
9. **R-1467 Register gegen Rückgabe:** Das Register sagt „zuletzt D1 BEN ROT“ und `SPAETER`, die
   Rückgabe JOB 894 sagt `ENTSCHEIDUNG_NOETIG`, sieben von acht Zeilen tragen (Abschnitt 4).
10. **R-1468 Register gegen Rückgabe:** Das Register sagt „zuletzt D5 BEN ROT (20.08.)“, die
    D1-Rückgabe sagt `BAUBEREIT`. Ihr Hauptbefund, der fehlende Wächter, ist heute durch den
    Freeze-Wächter überholt.

## 7. Stand je Anliegen

| Anliegen | Stand | Beleg |
|---|---|---|
| R-1247 Manifest-Wächter | geliefert in diesem Lauf, mit benannter Grenze | Manifest-Wächter Fall 1, G1–G10 |
| R-1821 / R-1825 ROT-Punkte und Recheckfragen | geliefert, soweit nicht alte Steuerung (Abschnitt 3) | Manifest-Wächter G4, G6, G7, Fall 1 |
| R-2002 I53 | geliefert in heutiger Form | Manifest-Wächter G6, G7 |
| R-1351 Gleichlauf | vorhanden und um zwei Gleichläufe ergänzt. Keine Gesamterhebung. Zwei Bestandswächter melden auf der Basis rot (Abschnitt 5) | `ext-attach-gate-gleichlauf`, Karte K4/K5, Pin |
| R-1367 Erlaubnisliste | geliefert in diesem Lauf, in Nacharbeit 2 gegen Spread und Konstanten gehärtet | Pin-Test mit Gegenproben |
| R-1468 Quellenwegkarte | geliefert: Herkunft der Sollwerte (Plan 327, JOB 880, Freeze-Wächter) mit Abgleich. Importwege ergänzend | Kartenwächter S1–S3, K1–K7 |
| R-1467 Betriebsbefunde N1–N8 | vorhanden (Plan 317, JOB 894), abgeglichen. Rest: N1-Wurzeln, N4-Korridor, veraltete N5/N7-Anker | Abschnitt 4, keine neue Prüfung |
| R-2015 Erzeuger der Zentrale | abgelöst durch den maschinell fortgeschriebenen `auftragsstand.json`. Gesamtübersicht nicht belegt. Drift-Wächter wirkungslos, unverändert | Abschnitt 4 |

Ob diese Lieferung die Kriterien erfüllt, steht erst nach Bens Prüfung, der Veröffentlichung und dem
gespeicherten Abschluss fest.

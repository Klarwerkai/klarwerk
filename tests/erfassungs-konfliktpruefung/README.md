# Dubletten und Widersprüche beim Erfassen — Bestandsaufnahme

Auftrag `aufnahme:20260922:gesamt-erfassungs-konfliktpruefung` (Aufgabenrevision 11), Lauf
`…:3`. Er setzt auf dem Kandidaten `aa9795bc` (Runde 3 von Lauf `…:1`) auf. Eingegrenzt nach Pedis
Entscheidung 722c390c (Option B), Nacharbeit nach Entscheidung b13f8a5d (Option A, 01.10.).

**Was hier steht:** Für jedes zugeordnete Anliegen gilt einer von zwei Fällen. Entweder ist es
geliefert, mit liefernden Commits, Fassung und einem Test, der das Kriterium prüft. Oder es ist
offen, abgelöst oder ausgelagert, dann mit Grund. Die Übersicht unten führt jedes Anliegen in genau
einer Zeile. Andere Abschnitte verweisen nur darauf.

**Wie geprüft:**

- *Fassung* ist der erste `ship: 1.0.0-beta.1.NNN`-Commit, der den liefernden Commit enthält.
  Ermittelt wurde sie mit `git log --ancestry-path <commit>..<ship> --grep '^ship: '` (ältester
  Treffer) und für jeden genannten Commit nachgeprüft: gegen `8ad4a268` und für die Nebenlieferungen
  gegen `720c24d6`. Commits vor dem 02.09.2026 fallen alle auf `.30`, den ersten Ship-Commit.
- *Stand* ist main bei `8ad4a268` (1.0.0-beta.1.640), eingemischt in `dd7dce70`. Danach entstand
  `720c24d6` (1.0.0-beta.1.641). Er ändert gegenüber `dd7dce70` nur `package.json` und
  `apps/web/src/version.ts`. In diesem Stand bleibt der P-M3b-Wortlaut der Fundortzeile erhalten,
  ebenso die neue „Vorschau“ von main.
- *Quellen:* Der Originalwortlaut der Anliegen lag dem Lauf zunächst nicht vor. Für R-1785 ist er
  inzwischen aus der Auftragsquelle (`QUELLEN.json`) abgeglichen. Die Nummern R-/P-/N- kommen im
  Repository nicht vor. Die Zuordnung folgt dem Wortlaut im Auftrag und den internen Namen
  (A27/A28/N1/N5/M3/Q6/KA7, JOB-Nummern). Wo mehrere Nummern dieselbe Lieferung beschreiben, teilen
  sie sich Commits und Tests. Das ist so vermerkt.

## Entscheidungen Pedis

Diese Einträge ersetzen alle früheren „Pedi muss entscheiden“. Der Wortlaut ist der des Auftrags
(Revision 11). Das Entscheidungsprotokoll selbst liegt nicht in diesem Repository.

| ID | Datum | Entscheidung (Wortlaut laut Auftrag) | Wirkung hier |
|---|---|---|---|
| 722c390c | 29./30.09. | Aufteilung (Option B): „Das Ergebnis ist die Bestandsaufnahme tests/erfassungs-konfliktpruefung/README.md … Dazu gehören ausschließlich die in den Runden 1 und 2 bereits gebauten Nebenlieferungen“. Umsetzungen aus Pedis Entscheidungen liegen in eigenen Aufträgen. | Umfang dieses Auftrags |
| 7d7f64df | 29./30.09. | „R-0244 abgelöst, automatische Prüfung nach dem Einreichen bleibt“. Kein Umbau des Prüfzeitpunkts. | R-0244 abgelöst |
| c84793cc | 29./30.09. | „R-0249: Vereinigung beim Deep-Weg → Auftrag …:r0249-deep-vereinigung“ | R-0249 ausgelagert |
| 73b53301 | 29./30.09. | „R-0247: weiche Sperre → Auftrag …:r0247-weiche-dublettensperre“ | R-0247 ausgelagert |
| 00597f05 | 29./30.09. | „R-0264: Nein, fremdesDupliziertMeines=false bleibt“ | R-0264 entschieden, nichts umzusetzen |
| 95a8fe64 | 29./30.09. | „R-0194: Prüfsummen → Auftrag …:r0194-aehnlichkeitspruefsummen“ | R-0194 ausgelagert |
| b13f8a5d | 01.10. | Option A: Nacharbeit am erhaltenen Kandidaten `aa9795bc`. Die vier R-1117-Dateien kommen auf den Stand von main zurück. R-1520, R-1566 und P-M3b bleiben unverändert. | dieser Lauf |
| N1c | 05.09. | Entwürfe sind keine Wissensobjekte und werden nicht geprüft. | R-0240/N1 „auch als Entwurf“ abgelöst |
| CODEX-POC-ENTSCHEIDUNG-1 | 05.09. | M3 „Haben wir das schon?“: Der Treffer nennt „Validiert“ bzw. „noch nicht geprüft“. | Grundlage von P-M3b |

## Lieferung dieses Auftrags (Nebenlieferungen aus Runde 1 und 2, unverändert)

Fassung: **1.0.0-beta.1.641** (`720c24d6`). Das ist der erste Ship-Commit, der `1328f747` und
`26c71ff3` enthält (`git log --ancestry-path <commit>..720c24d6 --grep '^ship: '`). Die Dateien sind
in Lauf `…:3` gegenüber `aa9795bc` nicht verändert.

| Anliegen | Commit | Dateien | Beleg |
|---|---|---|---|
| R-1520 (Kommentar) | `1328f747` (Runde 1) · .641 | `services/app/src/routes/check-text-routes.ts` (Kopf), `services/app/src/build-app.ts` (Registrierung von `/api/check-text`) | Nur Kommentar: „validated-only“ gilt nur für den Add-in-Pfad. Der Session-Pfad prüft seit JOB 3020 auch Ungeprüftes (`includeUnvalidated = !istAddon`). Das beschriebene Verhalten prüft `tests/pruefung-gegen-alles/n1-ungeprueftes-wird-gefunden.test.ts` F1 (Session findet Offenes) und F2/F2b (Add-in nur Validiertes). |
| R-1566 (Kommentar) | `1328f747` (Runde 1) · .641 | `apps/web/src/lib/eigeneKollision.ts`, Feld `DeckungsAuskunft.nenntZahlen` | Nur Kommentar: Er beschreibt den gewählten Satz (`SAETZE_MIT_ZAHLEN`). Beide Zahlen sind nötig, reichen aber nicht. Das beschriebene Verhalten prüft `tests/ko/job3068-deckungssatz.test.ts` (D-5b, D-5e–g, D-17). |
| P-M3b (Wortlaut) | `26c71ff3` (Runde 2) · .641 | `apps/web/src/components/capture/intake/LiveReactionZone.tsx` (Fundortzeile), `apps/web/src/components/trust/StatusPill.tsx` (optionales `label`), `apps/web/src/i18n.ts` (`intake.live.pruefstand.offen/validiert`, de/en/nl) | `tests/erfassungs-konfliktpruefung/pruefstand-wortlaut.test.tsx`: eine Tabelle mit 12 Fällen (2 Flächen × 3 Sprachen × 2 Zustände). Web ist an der Fundortzeile gemountet, Word läuft im ausgelieferten Aufgabenfenster. **Rot am alten `LiveReactionZone.tsx` (`cd54531f`), in Lauf `…:3` wiederholt:** 3 von 12 rot (W · de/en/nl · offen), Exitcode 1. Nachgeführt: `tests/fundort-live-check/fundort-in-der-live-zone.test.tsx` (D, G, H), `tests/live-check-verdrahtung/editor-mounted.test.tsx` (`pruefeAehnlichenFundort`), `tests/app/klara-regressionsinventar.test.ts`, in Lauf `…:3` Runde 3 zusätzlich das Mitfahrer-Verzeichnis `tests/klara-zerlegung/schnitt-pins.test.ts` (Griff `fixture`; A2 war im Server-Gesamtcheck rot). |

Ebenso veraltete Kommentare stehen in `apps/web/public/word-addin/taskpane.html`. Der C5-Block nennt
`isValidatedCandidate` statt `istPoolKandidat`. Der M3-Block sagt, ein handbetitelter Eintrag sei
„NICHT sicher zu finden“, was seit JOB 3128 überholt ist. Die Datei steht unter Inhalts-Pins
(`tests/app/mega69-klara-waechter.test.ts`, `tests/klara-zerlegung/schnittflaechen.test.ts`). Laut
Auftrag werden diese Pins nicht nachgeführt, deshalb ist dort nichts geändert.

**Nicht mehr in diesem Auftrag:** Die R-1117-Zitatprüfung aus den Runden 2 und 3. Dazu gehören
`services/conflicts/src/detect.ts`, `detect.test.ts`, `duplicate-detect.test.ts` und
`tests/erfassungs-konfliktpruefung/zitat-woertlich.test.ts`. Die drei ersten stehen wieder auf dem
Stand von main, die vierte ist entfernt (auf main gibt es sie nicht). Alle vier bleiben im Commit
`aa9795bc` als Grundlage für `…:r1117-zitat-woertlich` erhalten.

## Übersicht — jedes Anliegen genau einmal

Legende: **geliefert** · **teilweise** (geliefert mit benannter Grenze) · **abgelöst** ·
**ausgelagert** · **entschieden** · **offen**.

| Anliegen | Status | Liefernde Commits · Fassung | Test, der es prüft / Grund |
|---|---|---|---|
| R-0194 | ausgelagert | — | Entscheidung 95a8fe64 → `…:r0194-aehnlichkeitspruefsummen`. Ist-Stand: Kandidaten kommen aus Metadaten (Kategorie, Anlage, Tags), Trigramm-Jaccard und Abschnittsvergleich (`DuplicateCompare.tsx`). Ähnlichkeitsprüfsummen (SimHash/MinHash) gibt es nicht. |
| R-0196 | geliefert | `d25e7dfe`, `bc87f455`, `7ec75f03` (WP-SUBMIT-ASYNC), `5150cd5a` (Deckel 20) · .30 | KI-Widerspruchsprüfung beim Einreichen gegen die 20 textnächsten Einträge, Fehlalarm schließbar: `services/conflicts/src/detect-service.test.ts` (Fehlalarm → dismissed), `tests/app/submit-async-check.test.ts`, `tests/conflicts/detection-cap-honesty.test.ts`. Die Zusage „wörtliches Belegzitat“ gehört zu R-1117 (ausgelagert) und wird hier nicht bewertet. |
| R-0197 | geliefert | gemeinsam mit R-0289, R-0547, R-1596, P1, R-1502, R-1785: `7fb6acef` JOB 1500, `9b513a06` JOB 1546 (A28) · .30; `cbc458ec` JOB 3032 · .44; `3d5af224` JOB 3025 · .53; `c56e03e2` JOB 3068 · .82 | Der Autor sieht dauerhaft am eigenen Objekt, dass es kollidiert: `tests/ko/job3025-a27-mounted.test.tsx`, `tests/start/job3025-a27-start-mounted.test.tsx` |
| R-0199 | geliefert | `48de61b4` JOB 3112 · .132 | Doppeltes, ungeprüftes Dokument ohne Stufe wird in der Validierung gezeigt: `tests/validierung-stufe/doppelhinweis-regel.test.ts`, `doppelhinweis-auf-pruefkarte.test.tsx`, `stufenfrage-*.test.tsx`; `tests/app/job2614-bodytext-kette.test.ts` („offen sperrt“) |
| R-0200 | teilweise | Word-Panel: `5904c20e` JOB 3093 · .136 (dazu JOB 3092) | Siehe „R-0200 und R-0718“ unten. Nur innerhalb des Word-Panels erfüllt: beide Panelflächen laufen über `w6DublettenAusCheckText` (`tests/n1-bestand-im-panel/bestand-im-panel-mounted.test.ts`). Web und Word bleiben getrennt (R-0718). |
| R-0240 | teilweise | `ca7c4070` JOB 3045 · .69; `5904c20e` JOB 3093 · .136; `de57697d` JOB 3094 · .154; Web „Vorschau“ `fd8fa02c` · .639 | Fundort und Art am Treffer: `tests/fundort-live-check/fundort-in-der-live-zone.test.tsx` (A–H). „Nichts gefunden“ wird gesagt: im Word-Panel als „Nichts Vergleichbares gefunden (geprüft hh:mm).“ (`bestand-im-panel-mounted.test.ts` F3, F4 nicht bei Fehler). Im Web heißt ein leerer Live-Treffer seit .639 „Vorschau“ und nennt nur den geprüften Umfang („Vorschau ohne Treffer: verglichen wurden N vorausgewählte Einträge. Das ist kein Abgleich mit dem gesamten Wissensbestand.“), keine bestandweite Neuheit mehr (`apps/web/src/components/capture/intake/LiveReactionZone.test.tsx`, `tests/vorschau-reichweite/genau-vierzig.test.ts`, beide seit dem Einmischen von main in `dd7dce70` im Stand). **Abgelöst:** „auch als Entwurf“ durch N1c (05.09.). Entwürfe werden nicht geprüft (`tests/n1-bestand-im-panel/fundort-im-server.test.ts` F3 „ein ENTWURF erscheint NICHT“). Das ältere Wort „zu prüfen“ ist durch P-M3b abgelöst. |
| R-0244 | abgelöst | — | Entscheidung 7d7f64df: Die automatische Prüfung nach dem Einreichen bleibt (`ko-routes.ts`/`capture-routes.ts` → `ai-check-worker.ts`). Kein Umbau des Prüfzeitpunkts. |
| R-0247 | ausgelagert | — | Entscheidung 73b53301 → `…:r0247-weiche-dublettensperre`. Ist-Stand: Vor dem Validieren sperrt nur „Prüfung läuft noch“ (`validationAiGate.ts`, `tests/validation/ai-gate.test.ts`). Eine offene Dublette zeigt der Doppelhinweis an, sie sperrt aber weder im Web noch am Server. |
| R-0249 | ausgelagert | — | Entscheidung c84793cc → `…:r0249-deep-vereinigung`. Ist-Stand der drei Wege steht unten unter „R-0249, Ist-Stand“. |
| R-0264 | entschieden | — | Entscheidung 00597f05: Nein, `fremdesDupliziertMeines=false` bleibt (`services/app/src/duplicate-signal.ts`). Gesichert durch `services/app/src/duplicate-signal.test.ts` N-1…N-5 und `tests/ko/a28-signal-route.test.ts` R-2. |
| R-0289 | geliefert | wie R-0197 | Kein fremder Inhalt wird gezeigt, nur Existenz und Art: `services/app/src/duplicate-signal.test.ts` G-1…G-5, `tests/ko/a28-signal-route.test.ts` |
| R-0547 | geliefert | wie R-0197 | Der Deckungssatz steht dabei: `tests/bibliothek/job3068-deckung-sichtbar.test.tsx`, `tests/eigenes-signal/n5-deckung-am-eigenen-objekt.test.ts` |
| R-1072 | geliefert | `bc87f455`, `5150cd5a` · .30; `1df5dad0` JOB 3469 · .311 | Dubletten gegen die 20 nächsten Einträge, ab 0,85 deterministisch, sonst KI-Urteil. Eigene Seite mit Grad, geteilten Zitaten, Eigenanteilen und Empfehlung, Schwelle einstellbar: `services/conflicts/src/duplicate-detect.test.ts`, `overlap-settings.test.ts`, `overlap-service.test.ts`, `services/app/src/duplicate-routes.test.ts`, `tests/duplicates/*`, `tests/review26-duplikat-prozente/*` |
| R-1096 | geliefert | `bc87f455`, `7ec75f03` · .30; `7c0cdc14` JOB 3887 · .410 | Löschen schließt offene Konflikte, ein Erkennungsfehler kippt das Einreichen nie: `services/conflicts/src/service.test.ts` („gelöschtes KO beendet seine offenen Konflikte“), `tests/app/submit-async-check.test.ts`. Die Zitatzusage gehört zu R-1117 (ausgelagert). |
| R-1097 | geliefert | `5150cd5a` · .30; `c56e03e2` JOB 3068 · .82; `2a795c1e` JOB 3484 · .336 | Ehrlicher Satz, gegen wie viel geprüft wurde: `tests/conflicts/detection-cap-honesty.test.ts`, `tests/conflicts/coverage-terms.test.ts`, `tests/validation/ai-check-coverage-*-mounted.test.tsx`, `tests/capture/ai-check-coverage-card-mounted.test.tsx` |
| R-1117 | ausgelagert | — | Ausgelagert nach `…:r1117-zitat-woertlich`. Dieser Sammelauftrag erklärt R-1117 weder als erfüllt noch als nicht erfüllt. Grundlage für den Folgeauftrag: Commit `aa9795bc` (Tokenvergleich, `zitat-woertlich.test.ts` Z1–Z10) und Bens offener Befund BEN-1 aus Lauf `…:1` Runde 3 (Prime/Doppelprime: „Cut to 5″.“ wird als Beleg für „Cut to 5′.“ akzeptiert). |
| R-1502 | geliefert | wie R-0197 (A27 · `3d5af224` JOB 3025 · .53) | Anzeige am eigenen Objekt für die Expertin: `tests/ko/job3025-a27-mounted.test.tsx` (R-h1). Den Ursprungsbefund A27 führt R-1785. |
| R-1520 | teilweise | Kommentar: `1328f747` · .641 | Kommentar geliefert (siehe Lieferung oben). Offen ist der NICHT-GEPRÜFT-Rest aus früheren Abnahmen: kein echter Browser, kein PostgreSQL, kein Modellanbieter. Laut Auftrag wird dafür kein Prüflauf bestellt. |
| R-1525 | offen | — | NICHT GEPRÜFT aus früheren Abnahmen (kein echter Browser, kein PostgreSQL, kein Modellanbieter). In diesem Lauf nicht wiederholt. Laut Auftrag wird dafür kein Prüflauf bestellt. |
| R-1531 | offen | — | Wie R-1525. |
| R-1532 | offen | — | Wie R-1525. Die Web-Typ-Hinweise gehören zur dort gesperrten Anzeigehälfte und sind nicht angefasst. |
| R-1545 | offen | — | Wie R-1525. |
| R-1566 | geliefert | Kommentar: `1328f747` · .641 | Siehe Lieferung oben. `tests/ko/job3068-deckungssatz.test.ts` |
| R-1585 | teilweise | Q6e `a63fda7b` JOB 3118 · .137 | Geliefert und gemountet belegt (siehe Q6e). Grenzen unten unter „Belegte Grenzen“. |
| R-1596 | geliefert | wie R-0197 | Dauerhaft sichtbar, keine Rolle nötig: `tests/start/job3025-a27-start-mounted.test.tsx`, `tests/bibliothek/job3068-deckung-sichtbar.test.tsx` |
| R-1785 | geliefert | A27, dieselbe Lieferung wie R-1502: `3d5af224` JOB 3025 (Anzeige) · .53; `cbc458ec` JOB 3032 (Deckung am Server) · .44; `c56e03e2` JOB 3068 (Satz immer sichtbar) · .82 | Laut Auftragsquelle (`QUELLEN.json`, „Aufgenommener Rest (R-1785): \| A27 \| BEFUND …“) ist das Pedis Befund aus A10: „die Expertin erfährt nie, dass ihr Wissen mit etwas kollidiert“. Sie erfuhr es nur im Moment des Einreichens, „danach nie wieder“, weil `/konflikte` usw. `controller` verlangen. Vorgeschlagen war: Konflikte und Dubletten an **eigenen** Objekten sind dem Autor sichtbar, als Auskunft, nicht als Handlung. Prüfende Tests: `tests/ko/job3025-a27-mounted.test.tsx` R-h1 (als experte ist der Kollisionshinweis am eigenen Objekt sichtbar, ohne Link `/konflikte`; Gegenfall controller mit Link) und `tests/start/job3025-a27-start-mounted.test.tsx` S-a/S-a2 (Auskunft mit Deckungssatz auf der Startseite, nichts über die Gegenseite) sowie S-h1. Grenze wie bei R-1585: Die Expertenrolle ist nur gemountet belegt, ohne Live-Lauf im Browser. |
| P-M3b | geliefert | Serverteil `b8db80a7` JOB 3128 · .164; Wortlaut `26c71ff3` · .641 | Server: Ein handvergebener Titel verhindert den Fund bei gleichem Inhalt nicht mehr (`tests/m3-bestand-titel/server-bestand-titel.test.ts`). Wortlaut: `tests/erfassungs-konfliktpruefung/pruefstand-wortlaut.test.tsx` (siehe Lieferung oben) |
| LIVE-CHECK-VERDRAHTUNG | teilweise | `d7a27aaa` JOB 3427 · .261; `e8845b1f` JOB 3556 · .277; `3a10855b` JOB 3574 · .287 | Herkunft und Zustimmung am Draht, Ähnlichkeit und Prüfstatus getrennt, die zwölf längsten Wörter aus dem ganzen Text: `tests/live-check-verdrahtung/*` (K1a–g, F1–F3b, H1–H7), `tests/live-check-suchwoerter/*`. Grenze unten. |
| M3c | teilweise | `a8021470` JOB 3216 · .172; Panel `3f5d1eef` JOB 3243 · .184 | „Haben wir das schon?“ findet eine Originalpassage im importierten Volltext: `tests/m3-dokumentweg/quellenfund-*.test.ts` (Bearer und Cookie), `tests/m3-dokumentweg-panel/*`. Fehlender Beleg unten. |
| M3c-R | teilweise | `10691a04` JOB 3270 · .222 | `services/app/src/routes/check-text-routes.test.ts` („M3c-R · Cookie/Bearer-Vertrag“ K1–K6), `services/knowledge-object/src/search-projection-repo-pg.test.ts` („M3c-R · PostgreSQL begrenzt die Vorgabesuche auf 200 VOR jedem Rechtefilter“). Grenze unten. |
| Q6 | geliefert | `7fdb5276` JOB 3084 · .103 | Ohne Verbindung sagt die Kollisionsauskunft nichts über den Bestand, nur über die Datenlage: `tests/kollision-netztrennung/regel-und-netz.test.ts`, `lesenflaeche-mounted.test.tsx` (L-5-experte, L-6), `startflaeche-mounted.test.tsx` |
| Q6b | geliefert | `b2f90233` JOB 3098 · .120 | Die Startseite fragt das Netz, bevor sie „FÜR DICH“ für frisch erklärt: `tests/kollision-netztrennung/start-fuerdich-offline.test.tsx` |
| Q6e | geliefert | `a63fda7b` JOB 3118 · .137 | Die Startkarten FÜR DICH/ZULETZT sagen offline, dass sie den letzten Stand zeigen: `tests/kollision-netztrennung/start-fuerdich-offline.test.tsx` (T-3a KP2, T-3b/c KP3, S-6/S-9) |
| P1 | geliefert | wie R-0197 | Nur das eigene Objekt, kein fremder Inhalt: `tests/ko/job3025-a27-mounted.test.tsx`, `services/app/src/duplicate-signal.test.ts` |
| N1 | geliefert | `ac005c86` JOB 3020 · .39; `bd958311` · .43 | Prüfung auch gegen eingereichte, ungeprüfte Einträge: `tests/pruefung-gegen-alles/n1-ungeprueftes-wird-gefunden.test.ts` (F1, F4, K), `tests/pruefung-gegen-alles/n1-fundort-live-check.test.ts`. „Auch als Entwurf“ ist durch N1c abgelöst (siehe R-0240). |

## R-0200 und R-0718 — getrennte Verträge

Die Verträge bleiben getrennt, ohne pauschale Zusammenlegung (R-0718). Das Word-Panel nutzt
`POST /api/check-text`. Diese Route gibt es nur mit Add-on-Flag. Sie ist deterministisch und geht
nur mit `want:"deep"` in die Tiefe. Der Web-Editor nutzt `POST /api/knowledge/check`. Diese Route
ist immer registriert und liefert `status`/`similar`/`conflicts`. Gemeinsam sind nur die
Herkunftsregel, die KA4-Zustimmung und seit P-M3b das Wort für den Prüfstand. Belegt ist das durch
`check-text-routes.test.ts` und `tests/live-check-verdrahtung/*`.

R-0200 verlangt „denselben, einen entschiedenen Weg“ für Web und Word. Das ist deshalb **nur
innerhalb des Word-Panels erfüllt.** „Ohne Textabfluss“ gilt **nur für Stufe 1 von
`/api/check-text`**. `/api/knowledge/check` gibt nicht vertraulichen Text an das Modell, wenn eines
aktiv ist. `/api/check-text` mit `want:"deep"` tut das ebenfalls.

## R-0249, Ist-Stand (Umsetzung in `…:r0249-deep-vereinigung`)

- *Automatische Prüfung nach dem Einreichen* (`duplicate-detection.ts`, `conflict-detection.ts`):
  Die Bedeutungssuche verengt hier nichts. Der semantische Vorfilter (`72f7c592`, · .30) ist seit
  D-AISTATE V2.2 (`c4a6a5b5`, · .30) für die Erkennung nicht mehr in Gebrauch. Belegt ist das durch
  `services/app/src/duplicate-detection.test.ts` („D-AISTATE V2.2: der Prefilter VERENGT die
  Erkennung NICHT mehr“).
- *`/api/check-text` mit `want:"deep"`* (`check-text-detection.ts`, `selectPool`): Hier ersetzen
  die 20 nächsten Vektortreffer die lexikalische Kandidatenwahl. Die Bedeutung bestimmt also, welche
  Menge geprüft wird. Gegen R-0249 ist das nicht erfüllt. `tests/app/w6-prefilter-zustandsmatrix.test.ts`
  misst nur, welcher Abrufweg läuft.
- *Live-Check im Web* (`knowledge-check.ts`): Hier gibt es keine Bedeutungssuche, nur die
  lexikalische Vorauswahl. R-0249 greift hier nicht.
- `9053dd6d` (JOB 3583, · .296) betrifft die PostgreSQL-Rangfolge der lexikalischen Kandidaten und
  gehört nicht zu R-0249.

## Belegte Grenzen und fehlende Belege

- **R-1585.** Ein echter Offline-Rückweg mit Browser-Zurück/bfcache ist nicht belegt. In
  `apps/web/src` gibt es weder `pageshow` noch `persisted`, nur jsdom-Seitenwechsel und Remount
  (L-9/L-10/S-6/S-7). Ein Live-Lauf in der Expertenrolle fehlt ebenfalls. Belegt ist das nur
  gemountet (L-5-experte, L-6, S-4-experte). Es gab keinen Browser-bfcache-Lauf und keinen
  Expertenlauf.
- **M3c.** `baader-kerntext-pruefung.json` gibt es weder im Baum noch in der Historie. Die
  Zeilenangabe `check-text-detection.ts:116–130` ist veraltet: Dort steht heute Entwurfskommentar,
  der Quellenfund ist an anderer Stelle derselben Datei gebaut.
- **M3c-R.** Der PG-Gegenfall prüft nur die SQL-Form gegen einen nachgebauten Pool, nicht gegen
  echtes PostgreSQL. `check-text-detection.test.ts` („Q6 · OFFEN: Pg-Deckel vor Rechtefilter …“)
  hält eine bekannte Lücke fest: Ein zulässiger Quellenfund auf Rang 201 fällt still weg.
- **LIVE-CHECK-VERDRAHTUNG.** Der Zwölf-Wörter-Schnitt ist behoben (JOB 3574, `TERM_PLAETZE` in
  `knowledge-check.ts`). Die dort benannte Grenze bleibt offen. Die PostgreSQL-Seite ist nicht
  gemessen. Die verlangte Gegenprobe der Meraki-Szene in der Oberfläche fehlt.
- **P-M3b, Lesbarkeit.** Unter einem ähnlichen Treffer im Web können zwei ähnliche Sätze stehen:
  der Prüfstatus des Laufs („Auf Widerspruch noch nicht geprüft.“) und der Prüfstand des Treffers
  („noch nicht geprüft“). Ob das verständlich ist, ist nicht im Browser geprüft. Die Einleitungen
  beider Listen sind nicht angeglichen und nicht Gegenstand der Entscheidung vom 05.09.
- **Doku-Stand.** `OFFEN.md` führt A27 und A28 noch als BEFUND/OFFEN, obwohl beide geliefert sind
  (R-0197 ff.). `PROJECT_CONTEXT/04_AKTUELLER_STAND.md` nennt den asynchronen Hintergrundlauf noch
  als offen, obwohl er seit `7ec75f03` besteht. Beides ist nicht nachgeführt, weil es außerhalb des
  Auftrags liegt.
- **R-1520, R-1525, R-1531, R-1532, R-1545** sind nur genannt, nicht erneut geprüft. Dafür wird kein
  zusätzlicher Prüflauf bestellt.

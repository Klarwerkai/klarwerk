# Bestandsabgleich R-0953 / R-0956 — Rückmeldungen, Leerzustände, Eingabeerhalt

Auftrag `aufnahme:20260922:gesamt-lade-leer-fehler`. Stand: Nacharbeit 7 (Ben: „Rückmeldungen
vor Ort“ und „Klasse C“ waren selbst gesetzte Ausnahmen ohne Nutzerquelle). Beide Ausnahmen sind
**aufgehoben**; dieses Dokument bewertet jede Stelle gegen den unveränderten Originalauftrag.

**Art des Belegs.** Die Zuordnung ist **Quelleninspektion** des Web-Quellbaums (`apps/web/src`).
Ausgeführte Prüfungen stehen in den Prüfberichten unter `HISTORIE/` und im Prüfplan; wo ein Test
eine Stelle belegt, ist er genannt.

## 1. R-0953 — „Erfolge und Fehler erscheinen als kurze, einheitliche Einblendungen“

**Ein Ort für alle Speicheraktionen.** Die Quelle von R-0953 nennt ihn selbst („Die Härtung der
Toasts ist Teil der geplanten globalen Fehlerbrücke“), R-1015 verlangt den „einheitlichen Rückweg
an einer Stelle“. Dieser Ort ist der `MutationCache` des QueryClient (`lib/einblendungen.ts`,
eingehängt in `main.tsx`). **Jede** `useMutation` der Web-Oberfläche — 130 Stellen in 38 Dateien —
läuft durch ihn:

- **Fehler** ⇒ Einblendung mit der Servermeldung (`ApiError`), sonst dem allgemeinen Fehlersatz.
- **Erfolg** ⇒ die einheitliche Erfolgs-Einblendung („Erledigt.“, DE/EN/NL).
- **Hat die Fläche ihre Aktion im selben Durchlauf schon selbst eingeblendet** (genauerer Satz,
  z. B. „Quelle gespeichert“), tritt der zentrale Weg zurück — keine Doppelmeldung.
- Meldungen am Formular (Erfassen, Anmeldung, Duplikate, Konflikte, …) bleiben an ihrem Ort; die
  Einblendung kommt **zusätzlich**. Damit ist keine Speicheraktion mehr von der einheitlichen
  Einblendung ausgenommen.
- Vor der Anmeldung gibt es keine App-Hülle; die Anmelde- und die Zurücksetzen-Maske zeigen die
  Einblendungen deshalb selbst an (`auth/AuthScreens.tsx`, `auth/ResetScreen.tsx`).

Beleg: `tests/einblendungen/zentrale-einblendung.test.tsx` (Z1–Z5: Fehler mit Servermeldung,
allgemeiner Fehlersatz, Erfolg, Vorrang der eigenen Meldung, Rückruf aus `mutate(…, {…})`, ohne
Provider kein Absturz).

Zusätzlich gezielt behoben (vorher still, jetzt mit eigenem, genauerem Satz): Lückenaktionen in
`pages/Risk.tsx` (Gegenprobe `tests/luecke-schliessen/schliessen-mit-bezug-mounted.test.tsx`),
„Noch gültig“ und Lernschritt in `pages/Lifecycle.tsx` (`lifecycle-bestand-zuerst-mounted` F1),
Namenszustimmung und Foto-Widerruf in `components/start/LiveWallValidiert.tsx`, Bereichsprofil und
Ruhestand in `components/BereichsprofilPflege.tsx` (`risiko-horizont-mounted` P2–P5).

## 2. R-0956 — „Jede leere Liste erklärt, warum es KLARWERK gibt, wo man gerade im Wissenskreis steht und was der nächste sinnvolle Schritt ist“

**Methode.** Alle Leersätze des Quellbaums (Schlüssel und Werte mit „leer/empty/none/keine/
Noch kein…/Nichts…“, rund 130 Fundstellen) wurden gegen den Wortlaut geprüft: **ist es eine leere
Liste?**

**Eine Einordnung, drei Bauformen derselben Sprache** (`components/EmptyStateCtas.tsx`):
die Geschichte („Klarwerk sichert Erfahrungswissen, bevor es verloren geht“ — warum es Klarwerk
gibt), die Phase im Wissenskreis (Erfassen · Validieren · Nutzen · Aktuell halten — wo man steht)
und der flächeneigene Satz, der den nächsten Schritt nennt.

- `EmptyStateCtas` — mit rollengefilterten Schritt-Links (Hauptlisten).
- `leerzustandsRahmen` — dieselbe Karte ohne Rollenzweig (Analytics) bzw. ohne zweiten Knopf
  (Bibliothek: der vorhandene Erfassen-Knopf bleibt der nächste Schritt).
- `leerzustandsZeile` — dieselbe Einordnung als eine Zeile für Listen innerhalb einer Fläche.

### 2a. Leere Listen — alle eingeordnet

| Fläche | Leersatz (Schlüssel) | Einordnung |
|---|---|---|
| Meine Aufgaben, Start-Karte „Für dich“ | `task.none` | tasks · start |
| Validierung | `val.empty` | validation |
| Risiko · Cockpit / Bus-Faktor / Lücken | `risk.cockpitEmpty` · `risk.busEmpty` · `risk.gapsEmpty` | risk · risk · gaps |
| Ruhestandshorizont | `risk.horizon.noOwnArea`/`noAreas` · `risk.horizon.noneInHorizon` | horizont |
| Lebenszyklus · Warteschlange / Lernpfad | `lcy.empty` · `lcy.pathEmpty` | lifecycle · lernpfad |
| Dubletten · Brett / Zusammenführen | `dup.empty` · `dublettenvergleich.quellen.keine` · `dublettenvergleich.keinePositionen` | duplicates |
| Konflikte | `con.empty` (dazu die vorhandene Erklärung `con.emptyWhat/How`) | conflicts |
| Audit-Protokoll (Analytics) | `ana.auditEmpty` | audit |
| Bibliothek | `lib.liste.leer` | library (Rahmen ohne zweiten Knopf) |
| Schlagwort-Nachbarschaft | `nb.empty` | neighborhood |
| Teillisten eines Beitrags | `ko.sourcesEmpty` · `ko.attachmentsEmpty` · `ko.couple.empty` · `ko.lineageEventsEmpty` · `ko.evidenceEmpty` · `ko.snapshotsEmpty` · `ko.commentsEmpty` · `kenntnisnahme.uebersicht.leer` · `wb.leer` | objekt |
| Auswahl eines Ziel-/Anhängeartikels | `ko.conflictTargetEmpty` (ohne Suchwort) · `xtr.append.none` (Bestand leer) | library |
| Start · Zuletzt / Live-Wall (auch Beamer) | `start.zuletzt.leer` · `start.livewall.savedEmpty` · `helpedEmpty` · `validatedEmpty` | start |
| Entwürfe (Seite, Mobil, Papierkorb) | `erfassen.entwuerfe.keine` · `mob.draftsEmpty` · `mob.konto.eigeneLeer` · `adm.trash.empty` | entwuerfe |
| Editor · Bilder / Dateien / Anhänge im Text | `editor.noImages` · `editor.noFiles` · `erfassen.anhaenge.keine` | entwuerfe |
| Editor · Gliederung | `studio.d44.keineUeberschriften` | gliederung |
| Verwaltung | `adm.trash.empty` · `adm.auditEmpty` (2×) · `adm.presets.empty` · `adm.backup.none` · `capture.reviewers.none` | verwaltung |
| Auswertungen (Stufe 2) | `out.noValidated` · `mgmt.empty` (2×) · `mgmt.noRecs` · `fachwort.kiLaeufe.leer` · `mrun.report.empty` · `fachwort.belegIndex.leer` · `prov.empty` · `kos.hints.none` · `fachwort.belegFrische.leer` | auswertung |
| Import | `imp.queueEmpty` · `imp.explore.empty` · `imp.sharepoint.leer` | import |
| Wissensnetz / Graph | `wissensnetz.leer` · `wissensnetz.leiste.leer` · `wissensgraph.sicht.leer` · `s2.graphEmpty` | wissensnetz |
| Arbeitsanleitungen | `ga.liste.leer` · `ga.leer` (3×) | anleitung |
| Räume · Ausgangsprüfung | `spaces.seite.leer` · `ausgangspruefung.seite.leer` | spaces · ausgang |
| Meldungen · Seitenhilfe | `topbar.notificationsEmpty` · `menue.seitenhilfe.leer` | meldungen · hilfe |

Gegenproben: der Sammler `tests/leerzustaende/jede-liste-ordnet-ein.test.tsx` (jede Datei dieser
Tabelle trägt Leersatz und Einordnung; jede Fläche liefert in DE/EN/NL Titel, Phase und Satz) und
die gemounteten Fälle `bibliothek-leerbestand` (L3, L3b), `lesekapitel-am-seitenverhalten`
(A2a-LEER, A2a-FILTER), `risiko-busfaktor` (B5, B6), `lifecycle-bestand-zuerst` (LEER),
`ai-check-coverage-surfaces` (Dubletten), `mega68-nachbarschaft`. **Grenze des Sammlers:** er prüft
je Datei, nicht je Zweig; die gemounteten Fälle prüfen den Zweig.

### 2b. Kein „leere Liste“ im Sinne des Wortlauts — mit Grund je Fundstelle

- **Eingegrenzter Bestand** (Filter/Suche): `lib.liste.leerSuche`, `task.noneFiltered`,
  `val.focusEmpty.filtered`, `val.mineEmpty.title`, `capture.draftEmptyFiltered`,
  `imp.select.emptyFiltered`, `imp.select.empty`, `mgmt.prio.emptyFilter`, `ana.auditNoMatch`,
  `mob.searchEmpty`, `cmd.empty`, `help.noResults`, `extpage.noResults`, `klara.noResults`,
  `editor.imageSearch.empty`, `wb.setzen.sucheLeer`, `facet.searchNoHit`, `fe001.auswahl.keineTreffer`,
  `ko.conflictTargetEmpty` mit Suchwort, `xtr.append.none` nach Titelfilter. Der Bestand ist nicht
  leer; R-0963 verlangt hier ausdrücklich den getrennten Satz („kein Treffer“).
- **Feldwert / Auswahloption / Zählaussage, keine Liste:** `lib.facet.none`, `lib.groupBy.none`,
  `dup.side.none`, `con.side.none`, `dublettenvergleich.leer` („(leer)“ als Feldinhalt),
  `ko.snapshotFieldEmpty`, `ko.revision.none`, `einst.konten.leer` (Wert einer Zeile),
  `adm.backup.row.none`, `w2.item.conflictsNone`/`gapsNone`, `ko.importResult.gapsNone`,
  `lmsexport.keineEmpfaenger` (Option im Auswahlfeld), `imp.source.none`, `fe002.meldungenKeine`.
- **Ergebnis eines einzelnen Werkzeuglaufs, keine Liste:** `capture.docEmpty`, `capture.ocrEmpty`,
  `klara.aiEmpty`, `klara.selectionEmpty`, `enrich.empty`, `editor.quality.empty`,
  `editor.previewEmpty`, `studio.preview.empty`.
- **Nie angezeigt (kein Leser im Quellbaum):** `kollision.detail.keine`, `kollision.start.keine`,
  `adm.empty`.

## 3. R-0956 — „Fehler … kosten keine Eingaben“

| Weg | Eingabeerhalt bei Fehler | Beleg |
|---|---|---|
| Risiko · Lückenaktionen (Priorität, Person, Schließobjekt) | Wahl bleibt bis zur Übernahme, „Erneut versuchen“ sendet sie erneut | `schliessen-mit-bezug-mounted` E1, E2, E5 |
| Bereichsprofil, Ruhestand | Eingabe bleibt, erneut senden; Auswahl bleibt auch bei gescheiterter Auffrischung | `risiko-horizont-mounted` P3–P5 |
| Erfassen, Blatt, Mobil (Entwürfe) | Entwurf bleibt; Offline-Warteschlange, Verlassen-Schutz | Testfamilien `tests/entwurf-*`, `tests/review26-mobil-fortsetzen/` |
| Fragen | Frage bleibt (Arbeitsstand) | `tests/fragen-arbeitsstand/` |
| Lebenszyklus · Anlagenänderung | Feld wird nur im Erfolg geleert | Quelleninspektion (`onSuccess`) |
| Kenntnisnahme anfordern | Auswahl/Frist nur im Erfolg geleert | Quelleninspektion (`onSuccess`) |
| Arbeitsanleitung anlegen | Titel bleibt stehen | Quelleninspektion (`GesamtanweisungBereich.tsx`, `catch`) |
| Anmeldung, Zurücksetzen, Passwort ändern | Felder sind lokaler Zustand; der Fehler setzt nur die Meldung | Quelleninspektion |
| Lesezustände (QueryState) | gescheiterte Auffrischung behält den Bestand | `tests/querystate-ehrlich/querystate-zustaende.test.tsx` |

## 4. Abgrenzung

- `package:bibliothek` ist zugleich `gesamt-bibliothek-loeschen` und `gesamt-suche-filter`
  zugeordnet; hier ist nur sein Leerzustand berührt.
- Der Wiederholungs-/Navigationsvertrag bei Absturz-, Validierungs- und Risikofehlern bleibt laut
  Quelle von R-1015 „getrennt zu entscheiden“.

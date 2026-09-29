# Dubletten und Widersprüche beim Erfassen verständlich anzeigen — Bestandsabgleich

Auftrag `aufnahme:20260922:gesamt-erfassungs-konfliktpruefung` (Revision 2, Lauf 1), Basis
`cd54531f` (1.0.0-beta.1.631). Die Auftragsquelle mit den Originalwortlauten lag diesem Lauf nicht
vor. Abgeglichen wurde gegen die Kriterien im Auftrag und gegen Code, Tests und Commit-Verlauf
dieses Repositories. Die Nummern R-/P-/N- kommen im Repository nicht vor; die Zuordnung folgt dem
Wortlaut und den internen Namen (A27/A28/N1/N5/M3/Q6/KA7, JOB-Nummern). „Fassung“ ist der erste
`ship: 1.0.0-beta.1.NNN`-Commit, der den liefernden Commit enthält (`git log --ancestry-path`).
Commits vor dem 02.09.2026 fallen alle auf `.30`, den ersten Ship-Commit.

## In diesem Lauf geändert

Nur Kommentare, kein Verhalten:

| Kriterium | Änderung |
|---|---|
| R-1520 | `services/app/src/routes/check-text-routes.ts` (Kopf) und `services/app/src/build-app.ts` (Registrierung von `/api/check-text`): „validated-only“ gilt nur noch für den Add-in-Pfad. Der Session-Pfad prüft seit JOB 3020 auch Ungeprüftes (`includeUnvalidated = !istAddon`). |
| R-1566 | `apps/web/src/lib/eigeneKollision.ts`, Feld `DeckungsAuskunft.nenntZahlen`: beschreibt jetzt den tatsächlich gewählten Satz (`SAETZE_MIT_ZAHLEN`). Dass beide Zahlen vorliegen, ist nötig, reicht aber nicht aus. So steht es schon im Kommentar der Konstante und in `tests/ko/job3068-deckungssatz.test.ts` D-5b/D-5e–g/D-17. |

Ebenso veraltete Kommentare im Word-Panel, hier **nicht** geändert:
`apps/web/public/word-addin/taskpane.html` nennt beim C5-Block (JOB 1963) noch
`isValidatedCandidate`, den Vorgänger von `istPoolKandidat`, als alleinigen Pool. Beim M3-Block
(JOB 3093) heißt es noch, ein handbetitelter Eintrag sei „NICHT sicher zu finden“; das ist seit
JOB 3128 bei gleichem Inhalt überholt. Die Datei steht unter Inhalts-Pins
(`tests/app/mega69-klara-waechter.test.ts`, `tests/klara-zerlegung/schnittflaechen.test.ts`). Schon
eine reine Kommentaränderung macht beide rot und verlangt die Nachführung der Auslieferungs-Pins.
Das ist ein eigener kleiner Auftrag.

## Bereits geliefert — nicht neu gebaut

| Kriterium | Geliefert mit (Commit · Fassung) | Beleg (Test) |
|---|---|---|
| R-0196, R-1096, R-1117: KI-Widerspruchsprüfung beim Einreichen gegen die 20 textnächsten, Konflikt nur mit wörtlichen Zitaten in beiden Texten, Fehlalarm schließbar, Löschen schließt offene Konflikte, Erkennungsfehler kippt das Einreichen nie | `d25e7dfe`, `bc87f455`, `7ec75f03` (WP-SUBMIT-ASYNC), `5150cd5a` (Deckel 20) · .30; `7c0cdc14` JOB 3887 · .410 | `services/conflicts/src/detect.test.ts` (Halluzinations-Wächter G-2), `detect-service.test.ts` (Fehlalarm → dismissed), `services/conflicts/src/service.test.ts` („gelöschtes KO beendet seine offenen Konflikte“), `tests/app/submit-async-check.test.ts`, `tests/conflicts/detection-cap-honesty.test.ts` |
| R-1072: Dubletten beim Einreichen gegen die 20 nächsten; ab 0,85 deterministischer Eintrag, sonst KI-Urteil; eigene Seite mit Grad, geteilten Zitaten, Eigenanteilen und Empfehlung; Anzeige-Schwelle vom Verwalter einstellbar | `bc87f455`, `5150cd5a` · .30; `1df5dad0` JOB 3469 · .311 | `services/conflicts/src/duplicate-detect.test.ts`, `overlap-settings.test.ts`, `overlap-service.test.ts`, `services/app/src/duplicate-routes.test.ts`, `tests/duplicates/*`, `tests/review26-duplikat-prozente/*` |
| R-1097: ehrlicher Satz, gegen wie viel geprüft wurde | `5150cd5a` · .30; `c56e03e2` JOB 3068 · .82; `2a795c1e` JOB 3484 · .336 | `tests/conflicts/detection-cap-honesty.test.ts`, `coverage-terms.test.ts`, `tests/validation/ai-check-coverage-*-mounted.test.tsx`, `tests/capture/ai-check-coverage-card-mounted.test.tsx` |
| R-0197, R-0289, R-0547, R-1596, P1, R-1502/A27: der Autor sieht dauerhaft am eigenen Objekt, dass es kollidiert. Kein fremder Inhalt wird gezeigt, der Deckungssatz steht dabei, eine Rolle ist nicht nötig. | `7fb6acef` JOB 1500, `9b513a06` JOB 1546 (A28) · .30; `cbc458ec` JOB 3032 (Deckung Server) · .44; `3d5af224` JOB 3025 (A27 Anzeige) · .53; `c56e03e2` JOB 3068 (Satz immer sichtbar) · .82 | `services/app/src/duplicate-signal.test.ts` (G-1…G-5 nur Existenz und Art), `tests/ko/a28-signal-route.test.ts`, `tests/ko/job3025-a27-mounted.test.tsx` (R-h/R-i Expertin, nur eigenes Objekt), `tests/start/job3025-a27-start-mounted.test.tsx`, `tests/eigenes-signal/n5-deckung-am-eigenen-objekt.test.ts`, `tests/bibliothek/job3068-deckung-sichtbar.test.tsx` |
| Q6, Q6b, Q6e: ohne Verbindung ist der letzte Stand als solcher erkennbar, keine Entwarnung (Lesefläche, Startseite, Startkarten FÜR DICH/ZULETZT) | `7fdb5276` JOB 3084 · .103; `b2f90233` JOB 3098 · .120; `a63fda7b` JOB 3118 · .137 | `tests/kollision-netztrennung/regel-und-netz.test.ts` (N-1 = Befund R-1585), `lesenflaeche-mounted.test.tsx` (L-5-experte, L-6), `startflaeche-mounted.test.tsx`, `start-fuerdich-offline.test.tsx` (T-3a KP2, T-3b/c KP3, S-6/S-9, Z…) |
| N1, R-0240: Prüfung auch gegen eingereichte, ungeprüfte Einträge; Fundort und Art (Dublette/Widerspruch) am Treffer; „nichts gefunden“ wird ausdrücklich gesagt | `ac005c86` JOB 3020 · .39; `bd958311` JOB 3031 · .43; `ca7c4070` JOB 3045 · .69; `5904c20e` JOB 3093 · .136; `de57697d` JOB 3094 · .154 | `tests/pruefung-gegen-alles/*`, `tests/n1-bestand-im-panel/*` (F3 „ein ENTWURF erscheint NICHT“), `tests/fundort-live-check/fundort-in-der-live-zone.test.tsx` |
| R-0249: die Bedeutungssuche verengt nur die Kandidaten, die genaue Prüfung bleibt vollständig | `72f7c592` · .30; `9053dd6d` JOB 3583 · .296 | `services/app/src/duplicate-detection.test.ts` („D-AISTATE V2.2: der Prefilter VERENGT die Erkennung NICHT mehr“), `tests/app/w6-prefilter-zustandsmatrix.test.ts` |
| R-0199: Pedis Dokument liegt doppelt, ist ungeprüft und hat keine Stufe; die Validierung zeigt das | `48de61b4` JOB 3112 · .132 | `tests/validierung-stufe/doppelhinweis-regel.test.ts`, `doppelhinweis-auf-pruefkarte.test.tsx`, `stufenfrage-*.test.tsx`, `tests/app/job2614-bodytext-kette.test.ts` („offen sperrt“) |
| LIVE-CHECK-VERDRAHTUNG: Herkunft und Zustimmung am Draht, Ähnlichkeit und Prüfstatus getrennt; Verdacht der zwölf Suchwörter | `d7a27aaa` JOB 3427 · .261; `e8845b1f` JOB 3556 · .277; `3a10855b` JOB 3574 (zwölf längste Wörter aus dem ganzen Text) · .287 | `tests/live-check-verdrahtung/*` (K1a–g, F1–F3b, H1–H7), `tests/live-check-suchwoerter/*` |
| P-M3b Serverteil: handvergebener Titel verhindert den Fund bei gleichem Inhalt nicht mehr | `b8db80a7` JOB 3128 · .164 | `tests/m3-bestand-titel/server-bestand-titel.test.ts`, `services/conflicts/src/duplicate-detect.test.ts` |
| M3c: „Haben wir das schon?“ findet eine Originalpassage im importierten Volltext | `a8021470` JOB 3216 · .172; Panel `3f5d1eef` JOB 3243 · .184 | `tests/m3-dokumentweg/quellenfund-*.test.ts` (Bearer und Cookie), `tests/m3-dokumentweg-panel/*` |
| M3c-R: dauerhafter Cookie-Test und PG-Gegenfall am 200er-Deckel | `10691a04` JOB 3270 · .222 | `services/app/src/routes/check-text-routes.test.ts` („M3c-R · Cookie/Bearer-Vertrag“ K1–K6), `services/knowledge-object/src/search-projection-repo-pg.test.ts` („M3c-R · PostgreSQL begrenzt die Vorgabesuche auf 200 VOR jedem Rechtefilter“) |
| R-0718: zwei getrennte Verträge | bewusst getrennt: `POST /api/check-text` (Word-Panel, nur mit Add-on-Flag, deterministisch, Tiefe nur mit `want:"deep"`) und `POST /api/knowledge/check` (Web-Editor, immer registriert, `status`/`similar`/`conflicts`) | `check-text-routes.test.ts`, `tests/live-check-verdrahtung/*` |

## Offen, widersprüchlich oder nicht belegt

- **R-0244 und R-1072/R-1096 widersprechen sich, ohne Entscheidung.** R-0244 verlangt aufwendige
  Prüfungen erst in der Validierung und nur auf Knopfdruck. Tatsächlich laufen sie automatisch nach
  jedem Einreichen im Hintergrund (`ko-routes.ts`, `capture-routes.ts` → `ai-check-worker.ts`) und
  als Live-Urteil schon beim Tippen (`/knowledge/check`). Schnell bleibt das Erfassen trotzdem, weil
  das Einreichen nicht wartet (WP-SUBMIT-ASYNC). Weder in `specs/decisions`, `docs/entscheidungen`,
  `PROJECT_CONTEXT/09_ENTSCHEIDUNGEN.md` noch `harness/90-correction-log.md` steht eine
  Entscheidung dazu. **Pedi muss entscheiden;** nicht auf Verdacht umgebaut.
- **R-0200 und R-0718 widersprechen sich.** R-0200 will „denselben, einen entschiedenen Weg“ für
  Web und Word. Heute nutzt das Word-Panel `/api/check-text`, der Web-Editor `/api/knowledge/check`;
  gemeinsam sind nur Herkunftsregel und KA4-Zustimmung. R-0718 sperrt die pauschale
  Zusammenlegung ausdrücklich, deshalb bleibt es so. R-0200 gilt damit nur innerhalb des Word-Panels
  als erfüllt: beide Panelflächen laufen über `w6DublettenAusCheckText`, JOB 3092/3093. Außerdem
  stimmt „ohne Textabfluss“ nur für Stufe 1 von `/api/check-text`. `/api/knowledge/check` gibt
  nicht vertraulichen Text an das Modell, wenn eines aktiv ist.
- **R-0240/N1 („auch als Entwurf“) und Pedis Entscheidung N1c vom 05.09. widersprechen sich.**
  Entwürfe sind keine Wissensobjekte und werden nicht geprüft (`check-text-routes.ts`, Kommentar zu
  `pruefstand`; Test F3). Umgesetzt ist die jüngere Entscheidung. Der Fundort kennt deshalb nur
  „Validiert“ und „noch nicht geprüft“ (Word) bzw. „Validiert“ und „Offen“ (Web).
- **P-M3b, Wortlaut der beiden Trefferlisten: nicht angeglichen.** Word sagt „Dazu gibt es schon
  Vergleichbares (geprüft …):“ und „noch nicht geprüft“. Web sagt „Ähnliches existiert schon:“ und
  „Offen“ (`StatusPill`). Das Web-Wort ist eine Absicht von JOB 3045 („kein zweiter
  Statuswortschatz“) und in `tests/fundort-live-check` festgeschrieben. Die Quellen nennen drei
  Wortlaute: R-0240 „zu prüfen“, Pedi „noch nicht geprüft“, Web „Offen“. Deshalb nicht einseitig
  geändert; zuerst muss der Wortlaut entschieden werden.
- **R-0194 teilweise.** Kandidaten entstehen aus Metadaten (Kategorie, Anlage, Tags), aus Text
  (Trigramm-Jaccard) und aus dem Abschnittsvergleich (`DuplicateCompare.tsx`); der Mensch
  entscheidet. **Ähnlichkeitsprüfsummen (SimHash/MinHash) gibt es nicht.**
- **R-0247 teilweise.** Vor dem Validieren sperrt nur „Prüfung läuft noch“
  (`validationAiGate.ts`, `tests/validation/ai-gate.test.ts`). Eine offene Dublette zeigt der
  Doppelhinweis an der Prüfkarte, **sie sperrt aber nicht**, weder im Web noch am Server.
- **R-0264 gesperrt, Entscheidung offen.** Die Richtung „ein fremdes Objekt dupliziert meines“ ist
  bis zur Entscheidung `OF-1546-1` gesperrt (`services/app/src/duplicate-signal.ts`,
  `fremdesDupliziertMeines: false`; Tests N-1…N-5, `a28-signal-route` R-2). Die Entscheidung liegt
  bei Pedi; `ENTSCHEIDUNGEN/JOB-1546.md` ist nicht in diesem Repository.
- **R-1585 Rest.** Q6e ist mit JOB 3118 geliefert. Nicht belegt sind ein echter Offline-Rückweg im
  Browser mit Browser-Zurück/bfcache (kein `pageshow`/`persisted` in `apps/web/src`, nur
  jsdom-Seitenwechsel und Remount L-9/L-10/S-6/S-7) und ein Live-Lauf in der Expertenrolle (belegt
  nur gemountet: L-5-experte, L-6, S-4-experte). Dafür braucht es einen Browserlauf, der nicht auf
  dem Produktions-Mac läuft.
- **M3c, fehlender Beleg.** `baader-kerntext-pruefung.json` gibt es weder im Baum noch in der
  Historie. Die genannten Zeilen `check-text-detection.ts:116–130` sind heute Entwurfskommentar;
  gebaut ist der Quellenfund bei `:369–692`.
- **M3c-R, Grenze.** Der PG-Gegenfall prüft die SQL-Form gegen einen nachgebauten Pool, nicht gegen
  echtes PostgreSQL. Dazu hält `check-text-detection.test.ts` („Q6 · OFFEN: Pg-Deckel vor
  Rechtefilter …“) eine bekannte Lücke fest: Ein zulässiger Quellenfund auf Rang 201 fällt still weg.
- **LIVE-CHECK, zweiter Verdacht.** Der Zwölf-Wörter-Schnitt ist behoben (JOB 3574, heute
  `knowledge-check.ts` bei `TERM_PLAETZE`, nicht mehr `:224–236`). Die dort benannte Grenze bleibt
  offen, ebenso die ungemessene PostgreSQL-Seite. Die in der Quelle verlangte echte Gegenprobe der
  Meraki-Szene in der Oberfläche ist nicht belegt.
- **Doku-Stand.** `OFFEN.md` führt A27 und A28 noch als BEFUND/OFFEN, obwohl beide geliefert sind
  (siehe Tabelle). `PROJECT_CONTEXT/04_AKTUELLER_STAND.md` nennt den asynchronen Hintergrundlauf
  noch als offen, obwohl er seit `7ec75f03` besteht. Hier nicht nachgeführt, weil nicht Zielpfad.
- **R-1520, R-1525, R-1531, R-1532, R-1545 (NICHT GEPRÜFT aus früheren Abnahmen).** Kein echter
  Browser, kein PostgreSQL, kein Modellanbieter; auch in diesem Lauf nicht. Nur die Kommentar-Hinweise
  aus R-1520 und R-1566 sind oben erledigt; die Web-Typ-Hinweise aus R-1532 gehören zur dort
  gesperrten Anzeigehälfte und wurden nicht angefasst.

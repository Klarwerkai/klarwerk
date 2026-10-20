# Bestandsabgleich: Torpunkte ohne Abschlussbeleg in der Auftragsquelle

Auftrag `aufnahme:20260922:gesamt-prueftor-einheitlich`, Nacharbeit 3 (Bens Befund: „ungeklärt“ ersetzt
den Bestandsabgleich nicht). Abgeglichen am Arbeitsbaum auf Basis des Kandidaten `30dbea96`, durch
**Quelleninspektion**; die genannten Tests sind vorhandene Wächter, ihr Lauf ist hier nicht behauptet.

| Punkt | Originalziel (Kurzform) | Heutiger Bestand | Ergebnis / verbleibender Rest |
|---|---|---|---|
| TOR-T1c | Flackern in `tests/app/mega47-modale-flaechen-sammler.test.tsx`; laut Quelle widerlegt: rot war eine handgepflegte Zahl `toBe(460)` | Die feste Zahl ist weg (Untergrenze `toBeGreaterThan(100)`, Kalibrierzeile); eigener Zähler `tests/tor-bereitschaft/t1c-bestand.ts` + `t1c-bestandszaehler.test.ts`. Quelle: JOB 3159 LIVE 1.0.0-beta.1.151 | **geliefert**, kein Rest |
| TOR-T1e | Reste aus 3173: Grenze 24830 ms abgeleitet statt gemessen; drei BEN-Reste | Ursprungsjob 3197 abgebrochen; Nachfolge T1e-NEU (unten) hat die Reste übernommen | **durch T1e-NEU ersetzt**; offen nur, was dort offen ist |
| TOR-T1e-NEU | Abbaugrenze deterministisch aus exportierter Kalibrierreihe; langsames gültiges `close()`; Spaltenzahl gemessen statt gesetzt; toter `beende`-Rahmen | `tests/tor-bereitschaft/chromium-abbau.ts:55-58` exportiert `KALIBRIERREIHE_MS` (6 Werte), `GEMESSEN_MS = max`, `SICHERHEITSFAKTOR = 1.5`; `t1e-ableitung.test.ts` pinnt Höchstwertbezug, Rechenidentität, Reserve; `t1b-hooks.test.ts:373` „langsames, aber gültiges close()“; `rollenraster-schmal-chromium.test.ts:681` S4 (Spaltenlage gemessen); `t1d-vollstaendig.test.tsx:201` (Rahmen entfernt). Quelle: JOB 3448 LIVE 1.0.0-beta.1.251 | **geliefert**. Rest: **Entscheidung** — die Quelle vermerkt „Abnahme durch Pedi offen“. Technisch: die Reihe ist eine Messreihe vom 10.09. auf dem Tor-Rechner; dass sie das Spitzenlastmaximum trifft, ist nicht belegbar (Grenze = 45028,665 ms) |
| TOR-T2d | `smoke:browser` ohne Browserdeckel; Wächter soll am Inhalt statt am Namen erkennen | `package.json:19` `"smoke:browser": "./tools/browserdeckel.sh smoke node scripts/smoke-browser.mjs"`; `tests/smoke-deckel/kein-browser-am-deckel-vorbei.test.ts` W1–W11 leitet browserstartende Skripte aus dem Inhalt ab, eine begründete Installationsausnahme (`smoke:browser:setup`) | **geliefert**. F4 in `tests/tor-inventar/browserdeckel.test.ts:1490` bleibt namensbasiert — laut Originalschnitt ausdrücklich so („F4 bleibt unverändert“); kein Rest |
| TOR-T2f | BEN-Reste 3199 §6: (a) ehrliche PID-Meldung, (b) genau ein „verwaist“, (c) Warnung bei GNADE=0, (d) Fremddatei kippt Exit nicht, (e) F2 unterscheidbar | `tools/browserdeckel.sh:265/306/308` („PID-Datei fehlt/unlesbar/unbrauchbar: <Datei>“); `browserdeckel.test.ts:892` (genau ein verwaist), `:639` F21 (GNADE 0 warnt), `:665` F22 (Fremddatei behält Befehls-Exitcode), `:681` F23, `:219-221` F2a/F2b (tote PID mit bzw. ohne Kennung getrennt), `:620` F20 (fehlende PID-Datei unterscheidbar) | **geliefert** (a–e am Code und Wächter belegt), kein Rest |
| BROWSERDECKEL-F24-RACE | zwei Wartende räumen dieselbe tote PID genau einmal | `tools/browserdeckel.sh:237` / `:356` (ein gemeinsamer `rmdir` im Wartepfad), Wächter `browserdeckel.test.ts:892` und G2 `:1479` (genau ein `rmdir`). Quelle: JOB 3376 LIVE 1.233 | **geliefert**, kein Rest |

## R-1332 / JOB 2357 D1 §5 — „Drei Engines im Tor“ (Nacharbeit 5)

Die Quellhilfe zu R-1332 ordnet „drei Engines“ den Browser-Engines Chromium, Firefox und WebKit zu
(JOB 2357 D1 §5), nicht drei Datenbankprodukten; der Registerwortlaut „Datenbank-Engines“ bleibt als
Quellenwiderspruch stehen. Ein Abschluss von JOB 2357 ist nicht belegt (Bens Urteil zu D1: kein
Substanzurteil, Zustellung unvollständig).

| JOB-2357-Anforderung | Heutiger Bestand / spätere Entscheidung | Ergebnis |
|---|---|---|
| Drei Engines geprüft | Aufnahme 20260922 (A19, in `tools/check` dokumentiert): Firefox und WebKit laufen seit 10.10.2026 mit den Kern-Rauchproben IM PR-Tor; ci.yml installiert alle drei | in anderer Form geliefert (Kernproben je Push/PR) |
| `.github/workflows/smoke-drei.yml`: nur `schedule`/`workflow_dispatch`, ein Job, `--with-deps`, exakt `npm run smoke:ui:gate:drei`, kein `continue-on-error` | Die VOLLE Suite in drei Engines fährt heute nichts automatisch (am 10.10. in 14 Fällen rot, überwiegend fremde Feature-Specs). Keine spätere Entscheidung hebt diesen Lauf auf | **lokal umgesetzt am 20.10.2026**: vorhandener Workflow nach `.github/workflows/smoke-drei.yml` verschoben (Node 24, `./tools/build` vor dem Smoke). Keine zweite Vorlage. Die direkte Nutzerbeauftragung umfasst die Korrektur; eine tatsächliche CI-Ausführung ist damit noch nicht belegt. |
| `tests/smoke/browser-deckung.test.ts`, strukturell, vier Gegenmutationen | neu gebaut: YAML-Struktur und Engine-Kette statt Textsuche; M1–M4 am tatsächlichen Workflow, D1–D4 gegen Namensattrappen und Kettenverlust; eine fehlende Workflowdatei ist ein Fehler statt eines übersprungenen Falls; dieselben Mutationsklassen T1–T5 am heutigen PR-Tor (dort umgekehrte Auslöserregel nach A19) | **geliefert** |

## R-1329 / R-1381 — Gesamtcheck-Reparatur, Architekturstufe (Nacharbeit 7)

Auftrag laut direkter Bestätigung vom 15.10.2026 („alle ja“): `./tools/check` grün im vorhandenen
Prüftor, Start mit der Architekturbehebung aus dem Finanzbedarf-Kandidaten (Nachfolger `bc9174c2`).
Ausgangslage: `HISTORIE/nacharbeit-1/PRUEFUNG/gesamttor.log:6214–6249`, zwölf Verstösse.

Übernommen wurde je Verstoss NUR der Architekturschnitt aus `bc9174c2`, keine der übrigen
Fachänderungen dieses Kandidaten (Dateninventar, SharePoint-Import, Vorführung, TLS-Pflicht u. a.):

| Verstoss | Schnitt (Typbaustein ohne Rückkante, Altort exportiert unverändert weiter) |
|---|---|
| reasoner `model-errors` ↔ `types` | `services/reasoner/src/ki-ersatz-grund.ts` |
| knowledge-object `negativwissen` ↔ `types` (2 Zyklen) | `services/knowledge-object/src/negativwissen-typen.ts` |
| app `http` ↔ `rechtekontext`, `http` ↔ `dienst-schluessel` | `services/app/src/sitzungsnutzer.ts` |
| app `dienst-schluessel` ↔ `addon-principal` | `services/app/src/addon-principal-typen.ts` |
| app `assistenz-profil` ↔ `tastenkuerzel` / `faehigkeiten` / `eigeninitiative` | `assistenz-tastenkuerzel-typen.ts`, `assistenz-faehigkeiten-typen.ts`, `assistenz-eigeninitiative-typen.ts` |
| web `api/types` → `navigation` → `captureFrontDoor` → `api/types` | `apps/web/src/app/rolle.ts` (das im Teildiff fehlende Rollen-Typmodul) |
| module-boundaries `db.migrationssperre.test.ts` → `audit/src/repo-pg`, `db-tx/src/reset-lock` | Import über die öffentliche API; `AUDIT_KETTENSPERRE` in `services/audit/index.ts` exportiert |

Folgeanpassung: `tests/security/rechte-schalter-inventar.test.ts` liest die Union `AddonCapability`
jetzt am neuen Ort (`addon-principal-typen.ts`); die Zusicherung selbst ist unverändert.
Nicht übernommen: die Fachänderung in `services/app/src/db.migrate.test.ts` aus dem Teildiff (kein
Architekturverstoss). Ob der Gesamtcheck danach vollständig durchläuft, zeigt erst der reguläre Lauf.

**Nacharbeit 8 — Lauf am Kandidaten 5d78e965** (`HISTORIE/nacharbeit-7/PRUEFUNG/gesamttor.log:6288–6292`):
`architecture` und `modalgrenze` sind jetzt gemessen und grün; rot wurde die nächste Stufe
`geheimnis-scan` mit drei Funden, alle Testattrappen. Ursachenbezogen behoben:
- `tests/ki-modus-wahrheit/zugang-herkunft.test.ts:45` trägt die vorgesehene Marke in der Zeile.
- Die zwei Funde in `tests/entwurf-verlassen/gegenprobe-bf9fcf1c-quellen.patch` (Zeilen 208035/208040)
  liegen in einem Archiv, das byte-genau an bf9fcf1c gebunden ist; eine Marke bräche die Gegenprobe.
  `tools/geheimnis-scan.ts` kennt dafür `ARCHIV_ATTRAPPEN`: gültig nur für genau Datei, Zeile und
  Zeileninhalt (Gegenproben A1–A3 in `tests/structure/geheimnis-scan.test.ts`).
- Das Rechteinventar (`tests/security/rechte-schalter-inventar.test.ts`) führt die in der Basis
  hinzugekommenen Schalter `vorfuehrung`/`KLARWERK_VORFUEHRUNG_ANONYM` (Vorgabe aus, vor der Anmeldung
  gemeldet) und `KLARWERK_TLS_PFLICHT` (direkt gelesen in `transport-tls.ts`).

Für Punkte mit Abschlussbeleg in der Quelle (T1, T1b, T1d, T2, T2b, T2c, T2e, L5D, Deckelsperre,
Chromium-Abbau, Palettentest, Kalibrierung, E1, W1) gilt dieser Beleg; hier nicht neu gemessen.

## Direkte Nacharbeit 20.10.2026

`npm run check` führte bislang nur Build, Lint, Architektur und Vitest aus. Der Aufruf delegiert
jetzt einschließlich zusätzlicher Argumente an `./tools/check`, denselben Einstieg wie der CI-Job
`check`. Die Einbau-Berichterstattung erkennt beide Schreibweisen, verlangt aber weiterhin den
wirklichen Stufenbericht; Exit 0 allein belegt keinen vollständigen Lauf.

Der Browserbericht behält den ausdrücklich angegebenen JSON-Pfad (`bericht`) eines Prüfeintrags.
Zuvor ging er beim Einlesen verloren und es wurde der Namensstandard gelesen. Relative und absolute
Pfade werden berücksichtigt; ein fehlender ausdrücklicher Bericht bleibt unbekannt.

Der vorhandene Drei-Engine-Workflow steht jetzt unter `.github/workflows/`, der gemeinsame Vertrag
weist diesen zusätzlichen CI-Weg aus. Die strukturellen Gegenfälle prüfen die wirkliche Datei.
Die alten roten Fälle, offenen Quellenentscheidungen und fehlenden PostgreSQL-/Modellnachweise aus
`rotfall-inventar-gesamtcheck.md` werden damit nicht als behoben oder ausgeführt erklärt. Es wurde
kein Deployment und kein neuer Gesamtcheck durch diese Änderung gestartet.

Die gezielten Gegenfälle G5 und G11 fanden auf macOS einen Fehler im Stufenbuch: neben einem
Variablennamen stehende deutsche Anführungszeichen wurden als Teil des Namens gelesen. Explizite
`${name}`-/`${status}`-Grenzen stellen die vorgesehene Fehlermeldung und Exitcode 3 wieder her.


## Gemeinsame direkte Integration am 20.10.2026

Die auftragsbezogenen Prüfwegdateien aus Auftrag 57 sind auf dem lokal geprüften
Stand von 62 → 59 → 67 integriert. Die übrigen Änderungen der älteren 57-Basis
wurden nicht übernommen. Die vorhandenen elf Modell-Ausnahmen wurden unverändert
in die gemeinsame JSON-Liste verlagert; der Workflow-Abgleich nutzt die tatsächlichen
Stufenaufrufe. 91 gezielte Fälle in sechs Dateien, Produktionsbau, abschließende
Wurzel-Typprüfung, Syntax und Format sind bestanden. Der Geheimnis-Scan meldet drei
nachweislich fiktive Testwerte im unveränderten Hauptbestand; keine neuen Funde.
Vier unveränderte Rücknahmepatch-/Replay-Fälle wurden auch auf der Basis vor der
Integration reproduziert; sie sind keine bestandenen Fälle. Die historischen
Gesamtkriterien und Originalabnahmen werden dadurch nicht als erfüllt ausgegeben.
Push-/Main-/Live-Belege werden anschließend in den vier Aufträgen dokumentiert.

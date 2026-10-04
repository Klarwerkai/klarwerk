# Häufig gemeinsam geänderte Sammeldateien fachlich aufteilen — Lieferstand

*Aufnahme 20260922 · gesamt-zentrale-module-aufteilen (Aufgabenrevision 2). Basis `3b79c5d1`,
Programmversion `1.0.0-beta.1.657`. Lieferung dieses Laufs: der echte Drei-Datei-Schnitt des
Word-Aufgabenfensters (R-1611, P11). Alles andere ist hier mit seinem heutigen Stand und Beleg
festgehalten, nicht neu gebaut.*

*Nacharbeit 1 (Kandidat `69ac08a3`, Befunde der Prüfung): Wörterbuch nach Sprache aufgeteilt
(I18N-AUFTEILUNG), Zusammenschaltungsvertrag geschrieben (R-1141, R-1148), HTTP-API-Referenz
geschrieben (R-2076, NFR-MNT-02). Abschnitt „Nacharbeit 1" unten; die Tabelle ist nachgeführt.*

**Prüfstatus dieses Dokuments:** In dieser Lieferung wurde kein Test, kein Build und kein Dienst
gestartet. Jeder Beleg unten ist entweder eine **Quelleninspektion** (Datei und Stelle genannt) oder
ein **Prüfstand, den der Cloud-Lauf ausführt** (Testdatei genannt). Eine Prüfung gilt erst mit dem
Ergebnis dieses Laufs als bestanden.

## Was geliefert ist

`apps/web/public/word-addin/taskpane.html` ist in drei Dateien geschnitten — `taskpane.html`
(Markup, 497 Zeilen), `taskpane.css` (733), `taskpane.js` (12.497). Bytebilanz:
37.414 + 44.584 + 721.743 = 803.741 = 803.665 (vorher) − 38 (vier Tags) + 114 (zwei Verweise).
Beschreibung, Testhilfe und Grenzen: [`docs/word-addin/aufgabenfenster-dateien.md`](../word-addin/aufgabenfenster-dateien.md).

Geänderte Produktdateien: die drei Fensterdateien, `apps/web/src/lib/klaraStand.ts` (stempelt jetzt
auch `taskpane.js`), `biome.json` (zwei `files.ignore`-Einträge wie für `rueckweg.js`).
Neu: `tests/support/panelquelle.ts`, `tests/klara-zerlegung/schnitt-echt.test.ts`.
Umgestellt: alle Prüfstände, die Skript- oder Stilinhalte aus `taskpane.html` lasen
(Mitfahrerverzeichnis `tests/klara-zerlegung/schnitt-pins.test.ts`, Griff `panelquelle`).

## Kriterien

| # | Kriterium | Stand | Beleg |
| --- | --- | --- | --- |
| K1 | R-1141 Zusammenschaltung als lesbarer Vertrag | **geliefert (Nacharbeit 1)** | [`docs/architektur/zusammenschaltung.md`](../architektur/zusammenschaltung.md): die drei Kompositionen (`buildPgServices`, `buildDevPersistServices`, `buildServices`) in `assembleServices`, danach `buildApp`; 27 Module mit ihrer öffentlichen Schnittstelle; 29 Ablagen mit Speicher- und Postgres-Adapter; 9 Einhängestellen ausserhalb `AppRepos` (Stand nach Integration mit `main`); gemeinsame Klammern; Infrastrukturfabriken. Prüfstand `tests/architektur-vertrag/zusammenschaltung.test.ts` (Z1–Z3 gegen den Quelltext von `build-app.ts`/`dev-persist.ts`, Z4 Gegenproben). |
| K2 | R-1148 ein Auslieferungsstück, getrennte Module, gemeinsame DB-Klammern, Infrastruktur über Adapter | **im Bestand vorhanden, jetzt als Inventar belegt (Nacharbeit 1)** | `zusammenschaltung.md` Abschnitt 7 ordnet jeden Teil von R-1148 dem Bestand zu (Abschnitte 3–6, vom Prüfstand K1 gehalten). Offen und dort benannt: die Architekturregel misst nur `services/`; ob jede Route ausschliesslich über Adapter auf Infrastruktur zugreift, ist nicht erhoben (bekannt: `GET /api/admin/sicherungen` liest ein Verzeichnis direkt). |
| K3 | R-1304 Architekturdrift und Modulgrenzen messen | **im Bestand vorhanden** | Quelleninspektion: `.dependency-cruiser.cjs` (`no-circular`, `module-boundaries` = nur über `index.ts`, `no-orphans` als Warnung), gefahren in `tools/check` (Zeile „architecture") und `npm run arch`. Grenze: misst nur `services/`, nicht `apps/web` und nicht `tests/`. Eine eigene Architekturentscheidung als Dokument fehlt; die Regel steht im Kopf der Konfiguration. |
| K4 | R-1337 ein Typname, zwei Definitionen | **offener Beleg, keine fehlende Umsetzung** | Die Quelle nennt weder Typ noch Fundstelle und spricht in der Vergangenheit („war … mussten abgeglichen werden"). Zuordnen lässt sich der Punkt erst mit `aufnahmepunkte-010.json` `$[127]`; diese Datei liegt diesem Auftrag nicht vor. Eine Erhebung doppelter Typnamen wurde nicht ausgeführt. |
| K5 | R-1499 Sammeldateien, die fast jeder Auftrag anfasst | **Aufgabenfenster und Wörterbuch geliefert; Rest offen** | Geliefert: Markup, Stil und Skript des Fensters sind getrennte Dateien; `apps/web/src/i18n.ts` ist von 18.928 auf 71 Zeilen geschrumpft (nach der Integration mit `main` 120, mit dem R-0801-Start), die Wörterbücher stehen je Sprache in `apps/web/src/woerterbuch/` (K10). Offen und gemessen: `services/app/src/build-app.ts` 3.226 Zeilen (jetzt beschrieben, nicht aufgeteilt), `taskpane.js` 12.497 Zeilen (nach der Integration 12.595, s. Nacharbeit 3), `woerterbuch/de.ts` 7.467 Zeilen (nach der Integration 7.601). |
| K6 | R-1514 Rest aus JOB 3014 | **teilweise; der Rest bleibt NICHT GEPRÜFT** | Der Hinweis „nach dem echten Schnitt trägt nur HTML den Fassungskopf" ist jetzt gemessen statt vermutet: `tests/klara-zerlegung/probeschnitt.test.ts` B4 (Kopf nur an HTML, Cachekennung `?v=<Fassung>` an beiden Verweisen, Server liefert unter jeder Kennung die aktuelle Datei). NICHT GEPRÜFT, und ohne Mensch mit Word nicht prüfbar: echtes Word-WebView, Sideload, echtes Office-CDN, visuelles Layout, UI-Smoke. Ein voller `tools/check`-Lauf wurde nicht gestartet. |
| K7 | R-1611 Markup/Stil/Skript trennen, Funktion vorher und nachher belegen | **geliefert** | `tests/klara-zerlegung/schnitt-echt.test.ts` (E2: Git-Blob `95226f65…` des Basisstands; E3/E4 Gegenproben); `probeschnitt.test.ts` A1 (Schnitt = Textoperation), D2/D7 (vorher/nachher gleich, Word- und Nicht-Word-Zustand), D3–D6 (Gegenproben); `tests/app/mega69-klara-waechter.test.ts` (Inhalts-Pin unverändert). |
| K8 | R-2076 modularer, getesteter Code; Coverage-Ziel + API-Doku | **API-Doku geliefert (Nacharbeit 1); Coverage-Ziel vorhanden, nicht durchgesetzt** | [`docs/architektur/http-api-referenz.md`](../architektur/http-api-referenz.md): alle 207 registrierten Endpunkte (Stand nach Integration mit `main`) (ohne `HEAD`-Spiegel) mit Methode, Pfad, Recht, Eingaben, Erfolg und Fehlern; dazu Anmeldung, Rollen, Add-in-Zugang und die allgemeinen Fehlerfälle. Prüfstand `tests/architektur-vertrag/http-api-referenz.test.ts` (A1–A3 gegen den Router der vollständigen App, A4 Gegenproben). Coverage-Ziel weiterverwendet: `vitest.config.ts` `thresholds: { lines: 80, functions: 80 }` (Abschnitt 4 der Referenz). Kein Paketskript fährt `--coverage`, und `@vitest/coverage-v8` ist nicht installiert — Installation ist in diesem Auftrag nicht erlaubt. |
| K9 | P-I18N-TEXTMODULE Textmodule je Funktion | **früher geliefert (JOB 4367), nicht wiederholt** | `docs/i18n-textmodule.md`; `apps/web/src/texte/` (11 Module + `intern/`); `tests/i18n-textmodule/`; Plugin `textmodul-vertrag` in `apps/web/vite.config.ts`. |
| K10 | I18N-AUFTEILUNG Wörterbuch nach Sprache/Bereich aufteilen, Wächter gegen Doppelschlüssel | **geliefert (Nacharbeit 1)** | Aufgeteilt nach Sprache: `apps/web/src/woerterbuch/de.ts`, `en.ts`, `nl.ts`; jeder Block zeilengleich verschoben, kein Schlüssel und kein Wert geändert. Vorher/nachher: `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts` W1 (Byte für Byte gegen die unveränderte Kopie `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt`), W2 Gegenproben, W3 Laufzeit (i18next trägt jeden Schlüssel mit seinem Wert), W5 Form; unverändert dazu `tests/i18n-textmodule/bestand-unveraendert.test.ts` K1.1. Duplikatwächter weiterverwendet: `basisQuellen` (`texte/intern/sammeln.ts`) folgt den Importen nach `woerterbuch/` und den Spreads (W4, `tests/i18n-textmodule/grundbestand.test.ts`). Beschreibung: `docs/i18n-textmodule.md`. Der globale Grössendeckel (JOB 3364) bleibt unverändert. |
| K11 | P11 `taskpane.html` in lesbare Teile zerlegen, ohne Verhalten zu ändern | **Schritt 1 geliefert; weitere Teile offen** | wie K7. `taskpane.js` ist noch ein Block; der Schnittplan (`schnittflaechen.test.ts` C1) nennt die nächsten Stücke; B3 bewacht die Größe (Schranke 12.500 Zeilen, von der Inline-Grenze übernommen). |
| K12 | NFR-MNT-02 (Wortlaut wie R-2076) | wie K8 | wie K8 |
| K13 | Lieferstand, Abgrenzung, Widersprüche, fehlende Belege | dieses Dokument | — |

## Abgrenzung

- **JOB 3014** (Probeschnitt, Messgeräte, Mitfahrerverzeichnis) und **JOB 3667** (`rueckweg.js`)
  sind vorhandene Teilumfänge; ihre Messgeräte sind weiterverwendet und auf den echten Schnitt
  umgestellt, nicht neu gebaut.
- **JOB 4367** (Textmodule) ist abgeschlossen und hier nur als Stand genannt.
- **`services/app/addin-static/`** (das ältere, gebaute Add-in unter `/addin/`) ist eine andere
  Auslieferung und von diesem Schnitt nicht berührt.
- Die CSP ist absichtlich unverändert. Seit dem Schnitt trägt `taskpane.html` kein Inline-Skript mehr
  (gemessen in `tests/app/word-addin-csp.test.ts`); `'unsafe-inline'` in `script-src` bleibt stehen,
  weil dieselbe CSP auch für `anmeldung.html` gilt und eine CSP-Änderung kein Teil eines
  verhaltensgleichen Schnitts ist.

## Widersprüche in den Quellen

1. **Zeilenzahl der Sprachdatei.** R-1499 nennt „über 13.000 Zeilen", P-I18N-TEXTMODULE „18.706
   Zeilen"; heute sind es 18.928. Die Quellen sind zu verschiedenen Zeitpunkten erhoben.
2. **Größe des Aufgabenfensters.** P11 nennt 375 KB; vor dem Schnitt waren es 803.665 Bytes. Die
   Datei ist seit der Erhebung gewachsen.
3. **Deckel für `i18n.ts`.** I18N-AUFTEILUNG verlangt kurzfristig einen Override **nur** für
   `i18n.ts`; umgesetzt ist (JOB 3364) eine globale Anhebung von `files.maxSize` auf 2 MiB, und der
   Wächter verbietet ausdrücklich eine Ausnahme für `i18n.ts`. Der kurzfristige Teil bleibt so,
   wie er ist. Den dauerhaften Teil (Aufteilung nach Sprache oder Bereich) liefert Nacharbeit 1
   nach Sprache. Der frühere Satz in `docs/i18n-textmodule.md`, der Bestand werde nicht umgezogen,
   betraf den Umzug in Textmodule je Funktion; er ist dort ersetzt. Neue Texte kommen weiter in
   Textmodule, nicht in die Sprachdateien.
4. **R-2076 und NFR-MNT-02** tragen denselben Wortlaut; sie sind ein Anliegen.

## Fehlende Belege

- Kein Lauf im echten Word (Mac/Windows/Web), kein Sideload, kein echtes Office-CDN, kein visuelles
  Urteil über das Fenster nach dem Schnitt. Das braucht einen Menschen mit Word und ist nicht ersetzt.
- Kein in dieser Lieferung gestarteter Test- oder Buildlauf; die Belege oben gelten mit dem
  Cloud-Lauf.
- K3: Quelleninspektion, kein Lauf.
- K4 (R-1337): **offener Beleg** — ohne `aufnahmepunkte-010.json` `$[127]` nicht zuzuordnen. Das
  ist keine fehlende Umsetzung, sondern eine fehlende Quelle.
- K8/K12: Das Coverage-Ziel ist festgelegt, aber kein Lauf misst es (Anbieterpaket fehlt,
  Installation nicht erlaubt).
- K10: Der Bezugspunkt der Byte-Gleichheit ist eine Kopie der Datei vor der Aufteilung. Ihr
  Git-Blob konnte in dieser Umgebung nicht berechnet werden; nachprüfbar ist er mit
  `git hash-object` gegen `69ac08a3:apps/web/src/i18n.ts`.

## Nacharbeit 1

| Befund | Änderung | Dateien |
| --- | --- | --- |
| I18N-AUFTEILUNG: dauerhafte Aufteilung fehlte | Wörterbücher je Sprache, `i18n.ts` nur noch Importe und Start; Duplikatwächter folgt den neuen Dateien | `apps/web/src/woerterbuch/{de,en,nl}.ts`, `apps/web/src/i18n.ts`, `apps/web/src/texte/intern/sammeln.ts`, `apps/web/src/texte/intern/pruefung.ts` (Meldungstext), `docs/i18n-textmodule.md` |
| | Belege und Testhilfe | `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`, `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt`, `tests/support/woerterbuchquelle.ts` |
| | Prüfstände, die `i18n.ts` als Text lasen, lesen jetzt den zusammengefügten früheren Text (`woerterbuchQuelleAus`) — Aussage und Erwartung unverändert | 37 Testdateien unter `tests/` (Liste in `CLAUDE/PRUEFPLAN.json`, Suite `woerterbuch-leser-umgestellt`) |
| R-1141: Vertrag fehlte | Zusammenschaltungsvertrag mit R-1148-Inventar | `docs/architektur/zusammenschaltung.md`, `tests/architektur-vertrag/zusammenschaltung.test.ts` |
| R-2076/NFR-MNT-02: API-Doku fehlte | HTTP-API-Referenz, Coverage-Ziel zugeordnet | `docs/architektur/http-api-referenz.md`, `tests/architektur-vertrag/http-api-referenz.test.ts` |

## Nacharbeit 3 — Integration mit `main` a2ff8da8

Zwei Gitkonflikte, beide aus derselben Ursache: `main` hat Dateien weitergebaut, die dieser Auftrag
aufgeteilt hat. Beide Seiten sind erhalten.

| Datei | `main` hat | Auflösung |
| --- | --- | --- |
| `apps/web/public/word-addin/taskpane.html` | R-0169 (Dokumentkennung im Word-Panel) und KI-Aufgabe `enrich`: 99 Zeilen im Inline-Skript, Markup und Stil unverändert | Markup bleibt die geschnittene Seite; die 99 Zeilen stehen Zeile für Zeile in `taskpane.js`. Beleg: `schnitt-echt.test.ts` E2 — die drei Dateien ergeben jetzt Byte für Byte die `taskpane.html` von `main` (Blob `7d5a6234…`, `PANEL_VOR_SCHNITT_BLOB`). |
| `apps/web/src/i18n.ts` | neue Schlüssel in de/en/nl (134/128/128 Zeilen) und R-0801: en und nl werden im Produktionsbau nachgeladen (Plugin `sprachpaketeNachladen`) | Die neuen Schlüssel stehen an derselben Stelle in `woerterbuch/{de,en,nl}.ts`; `i18n.ts` trägt den R-0801-Start (`sprachBereit`, `VORLIEGEND`, `NACHLADEN`). Das Plugin nimmt jetzt die Importe von `woerterbuch/en.ts`/`nl.ts` aus dem Eintritt und baut die Pakete aus den Sprachdateien. Belege: `aufteilung-unveraendert.test.ts` W1 gegen die Datei von `main` (Blob `42ab6f8b…`, Kopie `i18n-vor-aufteilung.txt`); `tests/erstladezeit/sprachpakete-nachladen.test.ts` S1–S6 auf die Aufteilung umgestellt (dieselben Aussagen: Eintritt ohne en/nl, Paket = wörtlicher Block, gleiche Schlüssel, fail-closed), N und Q unverändert; Block DECKEL in `eintritt-ohne-seiten.test.ts` unverändert. |

Mitgeführt: `tests/klara-assistenz/abgleich-belege.test.ts` (neu auf `main`, las Skriptmarken direkt
aus `taskpane.html`) liest über `panelQuelleAus`; `schnitt-pins.test.ts` führt es und
`tests/app/word-addin-dokumentkennung.test.ts` als Mitfahrer.

**Fremde Befunde aus `main`, nicht von diesem Auftrag verursacht und hier NICHT geändert** — sie
treten auf `main` an der ungeschnittenen Datei genauso auf:

- `tests/klara-zerlegung/schnittflaechen.test.ts` B3: R-0169 hat das Skript auf 12.595 Zeilen
  gebracht; die Schranke steht bei 12.500, ihr Anheben ist seit JOB 3667 verboten. Auf `main` misst
  derselbe Fall das Inline-Skript mit derselben Schranke und denselben Zeilen. Abhilfe ist entweder
  ein weiterer Schnitt (Schritt 2 des Schnittplans) oder eine Entscheidung über die Schranke — beides
  eine Steuerungsentscheidung, hier nicht selbst getroffen.
- `tests/app/mega69-klara-waechter.test.ts` INHALTS-PIN: R-0169 hat den Panelinhalt geändert, der Pin
  (`5fbf5f64…`) ist auf `main` nicht nachgeführt. Ein Pin wandert nur nach geprüften
  Auslieferungsfolgen durch den Eigner der Änderung.
- `tests/app/klara-regressionsinventar.test.ts` K2: `tests/klara-assistenz/abgleich-belege.test.ts`
  und `tests/app/word-addin-dokumentkennung.test.ts` sind auf `main` entstanden und nicht ins
  Inventar eingetragen.

## Nacharbeit 4 — Prüflauf am Kandidaten `e0ac4c8f`

| Befund | Ursache | Änderung |
| --- | --- | --- |
| `http-api-referenz.test.ts` A2/A4: 7 Routen fehlen | auf `main` hinzugekommen | in der Referenz nachgetragen |
| `zusammenschaltung.test.ts` Z3: 2 Ablagen, 1 Option fehlen | auf `main` hinzugekommen | im Vertrag nachgetragen |
| `aufteilung-unveraendert.test.ts` W2 | eigener Fehler: Meldung „Vor- oder Nachspann“ enthielt das gesuchte Wort nicht | Meldung ausgeschrieben (`tests/support/woerterbuchquelle.ts`) |
| `klara-regressionsinventar.test.ts` K2/K5 | zwei auf `main` entstandene Prüfstände ohne Inventareintrag | nach Messung nachgeführt, K5 70 → 71 |
| `mega69-klara-waechter.test.ts` Pin, `schnittflaechen.test.ts` B3, `word-addin-ask.test.ts` Teil 3, `riegel-haelt-den-dokumenttext.test.ts` R5d/R5e/R7b/R7f | fremd: auf `main` identisch rot (E2 grün = Fenster byte-gleich mit `main`; Dienste und Testlogik unverändert gegenüber `main` 5f3e3a81) | kein fremder Code geändert, keine Schranke und kein Pin angefasst; aus der Prüfauswahl dieses Auftrags genommen und dort begründet (`CLAUDE/PRUEFPLAN.json`) |

**Beobachtung ohne Änderung:** `GET /api/support` (`services/app/src/routes/support-routes.ts`) ist
registriert, steht aber weder in `TABELLE`, `SCHREIB_TABELLE` noch `NICHT_ABGENOMMEN` der
Rollenabnahme. `tests/beta-rollenabnahme/jede-registrierte-route-ist-abgenommen.test.ts` E2 müsste
das melden. Nicht Teil der drei Befunde, deshalb nicht angefasst.

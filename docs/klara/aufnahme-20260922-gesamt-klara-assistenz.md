# Aufnahme 20260922 · Gesamt-Klara-Assistenz — Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-klara-assistenz`, Aufgabenrevision 2, Lauf 1, Runde 1. Abgeglichen
am 01.10.2026 gegen den Stand **1.0.0-beta.1.639** (Basis `dc40e085`).

Dies ist eine **Bestandsaufnahme**. Sie baut nichts nach und startet keinen Arbeitsauftrag. Erledigte
Teile werden nicht neu gebaut. Was offen ist, steht als offen da.

**Grenzen der Quellen.** Die Auftragsquelle mit Originalwortlaut, Entscheidungen und
Erledigungsbelegen liegt **nicht** in diesem Arbeitsbaum. Keine der Kennungen R-0301 … R-1864 und
`priority:P8:ce42a3733e51` kommt im Repository vor. Die Zuordnung unten stützt sich auf:

- `OFFEN.md` Abschnitt 1a-KA (Zeilen 59–72, Stand 18.–22.08.2026),
- JOB-Vermerke und Commits,
- die Testdateien je Baustein.

BEN-Urteile außerhalb der Commit-Texte (`_relay/…`, `~/klarwerk_steuerung/…`) sind hier nicht
einsehbar. Die Fassungsangaben „ab .N“ nennen die erste `ship:`-Fassung, die den Commit enthält. Die
Zählung `1.0.0-beta.1.N` beginnt mit `.30` am 02.09.2026. „ab .30“ heißt deshalb: schon vorher
gebaut, erstmals in dieser Zählung ausgeliefert.

## Die Bausteine KA1–KA8 (R-0380, R-1608, P8)

Die Richtung hat Pedi am 18.08.2026 beschlossen: KA1–KA8, jeder mit eigenem Abnahmesatz
(`OFFEN.md:59-72`, Commit `9b87037e`). Die Spalte „Beleg heute“ zeigt Testdateien, die in diesem Lauf
erneut gelaufen sind (siehe „Prüfung“ unten).

| Baustein | Abnahmesatz (`OFFEN.md`) | Geliefert (Commit · Fassung) | Fläche heute | Beleg heute | Grenze |
|---|---|---|---|---|---|
| **KA1** Begriffsbild | Das Panel hält zu einem offenen Dokument eine Begriffsliste, ohne Modellaufruf | JOB 1149 D1 · JOB 1493 D2 `b4bf3682` · ab .30 | `apps/web/public/word-addin/taskpane.html` Marke `KW-KA1-TERMS-START` | `tests/knowledge/ka1-begriffsbild-uebergabe.test.ts` | Belegt ist die Übergabe der Begriffe, nicht, wie die Liste in echtem Word wirkt |
| **KA2** Bestandsblick-Vertrag | — (ERLEDIGT laut `OFFEN.md:66`) | JOB 1571 D14 `d7d7efc5` · ab .30 | `window.klaraBestandsblick` in `taskpane.html` | `tests/app/ka2-vertrag-bestandsblick.test.ts` | nicht Teil der offenen Fünf (P8) |
| **KA3** Angebotskarten | Die Karte kommt und geht, ohne dass der Anwender je den Cursor verliert | `0198b529` · JOB 1720 D1 `157a19c6` · ab .30 | Marke `KW-KA3-KARTEN-START`, Tastenruhe `KA3_TASTENRUHE_MS = 30000` | `tests/app/ka3-fokusverhalten.test.tsx` (jsdom, misst `document.activeElement`) | Fokusverhalten nur in jsdom gemessen, nicht im Office-Host |
| **KA4** Einwilligung je Dokument und aktives Fragen | Einwilligung hebt die Zwangsflags nur für Sitzung und Dokument, ein Nein wird nicht erneut erfragt, Vertrauliches bleibt draußen | `45ab1528` · JOB 1810 D8 `dc0d130f` (ab .30) · JOB 3033 D2 `7eb27678` (ab .49) · JOB 3079 D3 `2cfa68d1` (ab .111) · N11b JOB 3244 D3 `1bd9c6f7` (ab .181) | Marke `KW-KA4-DOKUMENT-CONSENT-START`; Frage „… darf ich dieses Dokument senden? Vertraulich Markiertes bleibt hier.“ | `services/app/src/routes/ka4-endzustand.test.ts`, `services/app/src/routes/ask-routes-ka4-einwilligung.test.ts`, `tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts` | Ein Nein gilt nur im Arbeitsspeicher der Panelinstanz (bewusst, siehe Kommentar am Block) |
| **KA5** Fragen an Dokument und Markierung | Dieselbe Frage trägt mit und ohne Markierung nachweislich verschiedene, quellenbelegte Antworten | Serverhälfte JOB 3006 D3 `210060c8` (ab .34) · Panelhälfte JOB 3019 D3 `8ebc2ce0` (ab .72) · Vorarbeit JOB 1993 | Feld `selection` in `taskpane.html` (`prepareAskQuestion`) | `services/app/src/routes/ka5-markierung.test.ts`, `tests/ka5/markierung-kein-egress.test.ts`, `tests/ka5/markierung-fundstelle-bleibt.test.ts`, Panelseite in `tests/app/word-addin-ask.test.ts` | Belegt ist der Weg ohne Egress aus dem Bestand. Der Teil „mit KA4-Einwilligung antwortet die externe KI dokumentbezogen“ hat keinen eigenen KA5-Test. Siehe W3 |
| **KA6** Schreiben auf Zuruf | Ergebnis immer als Vorschlag, Einfügen erst auf Klick, mit Herkunft | Stufe 1 JOB 1491 D1 `2eaa857d` (ab .30) · Panel JOB 3091 D4 `137835d9` (ab .118) | Memo-Vorschlag im Panel | `tests/output/ka6-zuruf.test.ts`, `tests/ka6-memo-panel/memo-panel-mounted.test.ts` (diesmal nicht gelaufen) | nicht Teil der offenen Fünf (P8). Stufe 2 „externer Riegel“ war am 21.08. offen; ein jüngerer Abschlussbeleg ist hier nicht zugeordnet |
| **KA7** Widerspruchs-Hinweis | Die Angebotskarte bewertet Abweichungen ausdrücklich und zeigt nur Serverbefunde | JOB 1963 D2/D4 `9f16f9bc`/`8c2cc36d` · **JOB 3094 D7 `de57697d` (ab .154)** · M4b JOB 3174 D6 `7d56fb48` (ab .180) | Marke `KW-KA7-KONFLIKT-START` | `tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts`, `tests/ka7-konflikt-im-panel/konflikt-strukturiert.test.ts` | Laut R-1608 deckt JOB 3094 **nur die Konfliktanzeige** ab. Daraus folgt keine Abnahme der ganzen Assistentin |
| **KA8** Vorausdenken | Nach dem Einreichen eine Karte, ein Satz, ein Klick | Ableitung JOB 1171 D1 · Route JOB 1494 D1/D2 `972ac917` · ab .30 | **nur Server:** `GET /api/drafts/:id/naechster-schritt` in `services/app/src/routes/capture-routes.ts` | `tests/app/ka8-naechster-schritt-bestandsroute.test.ts`, `tests/capture/job1171-naechster-schritt-auskunft.test.ts` | **Es gibt keine Karte.** Siehe W1 |

### R-1608: echte Word-Belege

Für **KA1, KA3, KA4, KA5 und KA7** gibt es im Repository **keinen Beleg aus echtem Word** (Word für
Mac, Windows oder Web). Alle oben genannten Belege laufen ohne Office-Host:

- Fastify-Routen mit In-Memory-Diensten,
- das ausgelieferte `taskpane.html` in jsdom.

Der einzige Live-Beleg aus einem echten Host ist die Rahmenkette in Word Web
(`docs/operations/word-web-hostabnahme.md`, 1.0.0-beta.1.609, 26.09.2026). Er zeigt, dass Klara
lädt. Ob die Bausteine im Host wirken, zeigt er nicht.

Der geforderte Abgleich gegen echte Word-Belege ist damit **für alle fünf Bausteine offen**. Ein
solcher Beleg braucht einen Office-Host und ist auf dem Prüfserver ohne Microsoft-Zugang nicht
herstellbar. Siehe „Fehlende Prüfmittel“.

## Die übrigen Anliegen

| Anliegen | Zuordnung | Erfüllungsstand am 01.10.2026 |
|---|---|---|
| **R-0301** Hinweise, bevor der Nutzer fragt | KA3 (Karten bei Panel-Öffnen und Tastenruhe), KA7 (Konflikthinweis), KA8 | **Teilweise.** Hinweise auf den Bestand (KA3) und auf Konflikte (KA7) erscheinen ungefragt. Den „Vorschlag, was als nächstes sinnvoll wäre“ (KA8) sieht der Nutzer nicht (W1) |
| **R-0304** die Fläche, über die der Nutzer mit Klara spricht | Word-Panel `apps/web/public/word-addin/taskpane.html`; im Web `apps/web/src/components/KlaraAssistant.tsx` | Beide Flächen gibt es. Gestaltung nach Zielbild: K1 JOB 3056 D10 `613119e0` (ab .86) und Antwortkarte JOB 3004 D5 `5595f2f0` (beide in Chromium gemessen) |
| **R-0311** ob und wie die KI-Fähigkeiten weiterverfolgt werden | Beschluss 11.08. (laut Auftrag), Richtung 18.08. (KA1–KA8), W12 31.07. | **Entschieden: weiterverfolgen.** Technisch umgesetzt sind die Einwilligung je Dokument (KA4) und die zentrale KI-Freigabe (JOB 3502 D3 `927c91b9`, JOB 3666 D1 `a166b4bc`, ab .342). Den Wortlaut des 11.08.-Beschlusses gibt es hier nicht |
| **R-0371** Ausbaureihenfolge | siehe nächster Abschnitt | Kanten und Bildkette geliefert, Betriebsreife teilweise, Produktfamilie nicht begonnen |
| **R-0375** Baustein „nur als Kennung genannt“, vor den Fragen | **KA4.** KA5 (Fragen) trägt den Anker `NACH-KA4` (`OFFEN.md:69`) | Geliefert (siehe KA4). Widerspruch W2: der Inhalt ist in `OFFEN.md:68` sehr wohl ausformuliert |
| **R-0377 / R-0390** nächster Schritt nach dem Einreichen | KA8 | **Nicht erfüllt im Sinne von „eine Karte, ein Satz, ein Klick“.** Die Ableitung und die Route sind da, eine Fläche dazu fehlt (W1) |
| **R-0380** Dachfunktion „mitdenken“ | KA1–KA8 | Bestand kennen (KA1, KA2) ✓ · Fragen beantworten (KA5) ✓ · Angebote machen (KA3, KA7) ✓ · auf Zuruf schreiben (KA6) ✓ · einen Schritt vorausdenken (KA8) nur serverseitig. Alles ohne Beleg aus echtem Word |
| **R-0944** Das System kommt zum Menschen; das Web wird zur Prüferfläche | W12 (`OFFEN.md:78`) | **Richtung entschieden, Endzustand bewusst offen.** Laut W12 wird die Web-App erst nach einem **bestandenen Nachtest** mit festen, objektiven Maßen dauerhaft zur Prüfer- und Verwalterfläche erklärt. Ein Nachtest-Beleg liegt hier nicht vor |
| **R-1039** Klara in der Web-Konsole | `KlaraAssistant.tsx` in `apps/web/src/shell/AppShell.tsx` | **Als Hilfe-Assistentin vorhanden** (seit 05.07.; UX-16 JOB 3144 D1 `ee189360`, ab .150): Seitenkontext, Hilfe-Registry, KI-Antwort mit Herkunft. Die KA-Fähigkeiten (Begriffsbild, Angebotskarten, Konflikt, Zuruf, nächster Schritt) gibt es nur im Word-Panel |
| **R-1782** W12 Klara-first | `OFFEN.md:78` | **ENTSCHIEDEN** (Pedi, 31.07.). Das Abnahmekriterium ist der Nachtest mit denselben sieben Aufgaben ohne Schulung. Laut `OFFEN.md:13/226` war der Protokollbogen des Vortests noch offen. Einen Nachtest-Beleg gibt es hier nicht |
| **R-1864** ENTSCHEIDUNGEN | Verweis auf den Entscheidungsordner der Steuerung | Im Arbeitsbaum nicht vorhanden. Nicht prüfbar |
| **P8** KA1, KA3, KA4, KA5, KA7 je ein Auftrag | — | Alle fünf haben Liefercommits (Tabelle oben). Es bleibt der Abgleich mit echtem Word (R-1608). Siehe W4 |

### R-0371: die Ausbaureihenfolge im Einzelnen

1. **Kanten**
   - *Word-Herkunft und Herkunfts-Chip:* K1.2 „Aus Word“, `423cc348` (job679). Chip auch in der
     Clientkette: JOB 2945 D2, `5f2da19c`. Beides ab .30.
   - *Zustimmungsoberfläche:* KA4 (oben) und die zentrale Freigabe (JOB 3502/3666).
   - **Geliefert.**
2. **Bildkette**
   - M5: JOB 3095 D3 `54cebf39` (ab .113), JOB 3096 D3 `1e1a0e6b` (ab .166).
   - M5c-b: JOB 3229, 3400, 3438.
   - Rückweg in die Bibliothek: JOB 4329 D2 `7e1572bd` (ab .582).
   - **Geliefert** (ohne Beleg aus echtem Word).
3. **Betriebsreife**
   - *Manifest:* `docs/word-addin/klara-manifest.xml`, Version 1.0.0.1.
   - *Anmeldung in Word:* JOB 4076 D4, `7188caaf`, ab .520.
   - *Word-Web-Rahmenkette:* live belegt in .609.
   - *Zentrale Bereitstellung* (M365 Admin Center): **kein Beleg.** Es gibt nur
     Sideload-Anleitungen (`docs/word-addin/SIDELOAD-ANLEITUNG.md`).
   - *Panel-Rauchprobe im Office-Host:* **kein Beleg.**
     `tests-smoke/word-taskpane-kopieren.spec.ts` lädt das Panel im Browser, nicht in Office.
   - *Erststart des Panels:* **kein zuordenbarer Beleg.**
   - **Teilweise.**
4. **Produktfamilie** (PowerPoint, Excel)
   - Das Manifest kennt nur `<Host Name="Document" />`, also Word.
   - JOB 4269 betrifft importierte PowerPoint-*Bilder*, nicht Klara in PowerPoint.
   - **Nicht begonnen**, wie in W12 vorgesehen („noch nicht gebaut, nicht versprochen“).

## Widersprüche und fehlende Belege

- **W1 · KA8 gilt als ERLEDIGT, ohne sichtbare Karte.** `OFFEN.md:72` führt KA8 seit 21.08. als
  ERLEDIGT („Nach dem Einreichen bietet Klara den nächsten sinnvollen Schritt an“). Der Test der
  Erledigung sagt selbst: „ER BEWEIST NICHT, dass eine Karte erscheint“
  (`tests/app/ka8-naechster-schritt-entwurf.test.ts`, Kopf). Im Stand .639 ruft weder
  `taskpane.html` noch `apps/web/src` die Route `/api/drafts/:id/naechster-schritt` auf. R-0377 und
  R-0390 sind damit **für den Nutzer nicht erfüllt.**
- **W1a · Parallelweg für KA8 nicht zurückgenommen.** Die Bestandsroute-Datei
  (`tests/app/ka8-naechster-schritt-bestandsroute.test.ts`, Kopf) sagt: „Die D1-Dateien sind
  deshalb zurückgenommen.“ Trotzdem liegt `services/app/src/routes/naechster-schritt-entwurf.ts`
  weiter im Baum:
  - mit abweichendem Leerfall (`204` statt `200 {}`),
  - nicht in `build-app.ts` registriert,
  - nur von `tests/app/ka8-naechster-schritt-entwurf.test.ts` benutzt,
  - im Altbestand von `tests/capture/aufrufer-waechter.test.ts` gelistet.

  Das liegt außerhalb dieses Auftrags. Es ist hier nur dokumentiert, nicht repariert.
- **W2 · R-0375 „nirgends ausformuliert“.** `OFFEN.md:68` formuliert KA4 vollständig aus: Schalter,
  Wortlaut der aktiven Frage, Merken des Neins, Serverwirkung.
- **W3 · KA5 und die externe KI.** Der Abnahmesatz verlangt die dokumentbezogene Antwort der
  externen KI mit KA4-Einwilligung. Die KA5-Belege messen den Weg **ohne** Egress (JOB 3006: „ohne
  das Haus zu verlassen“). Für die Kombination aus Markierung und erteilter Einwilligung ist im Baum
  kein eigener KA5-Test zugeordnet.
- **W4 · Statusangaben in `OFFEN.md` widersprechen sich.**
  - `OFFEN.md:5` sagt „KA1, KA3 und KA4 sind im Produkt“.
  - Die Tabellenzeilen 65, 67 und 68 führen dieselben Bausteine als OFFEN.
  - KA5 und KA7 stehen dort ebenfalls auf OFFEN, obwohl JOB 3006/3019 und JOB 3094 geliefert sind.
  - `OFFEN.md` ist seit 22.08. für KA nicht fortgeschrieben. Es gilt der Commit-Stand oben.
- **W5 · Gelöschte KA5-Panelprüfung.** `tests/klara-panel/ka5-markierung-reist-mit.test.tsx` (JOB
  3019) wurde mit JOB 3056 D10 (`613119e0`) gelöscht. Der Panelanteil von KA5 ist seither nur noch
  in `tests/app/word-addin-ask.test.ts` gepinnt, über den Spiegel von `prepareAskQuestion`.
- **Fehlende Quellen:** Auftragsquelle, `ENTSCHEIDUNGEN` (R-1864), BEN-Verdikte und der Wortlaut des
  Beschlusses vom 11.08.2026 liegen nicht im Arbeitsbaum.

## Fehlende Prüfmittel

- **Echtes Word** (Mac, Windows, Web) mit gesideloadetem oder zentral bereitgestelltem Manifest:
  nötig für R-1608 und für die Panel-Rauchprobe und den Erststart aus R-0371. Der Prüfserver hat
  keinen Microsoft-Zugang (siehe `docs/operations/word-web-hostabnahme.md`, „Live-Folgeschritt“).
- **Nachtest mit Menschen** (W12): nötig für R-0944 und R-1782.

## Prüfung in diesem Lauf

Erneut ausgeführt am Stand `dc40e085` (ohne Browser, ohne Datenbank):

```
KLARWERK_SKIP_KEYCHAIN=1 KLARWERK_TESTGRUPPE=rest node node_modules/vitest/vitest.mjs run \
  tests/knowledge/ka1-begriffsbild-uebergabe.test.ts tests/app/ka2-vertrag-bestandsblick.test.ts \
  tests/app/ka3-fokusverhalten.test.tsx tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts \
  services/app/src/routes/ka4-endzustand.test.ts services/app/src/routes/ask-routes-ka4-einwilligung.test.ts \
  services/app/src/routes/ka5-markierung.test.ts tests/ka5/markierung-kein-egress.test.ts \
  tests/ka5/markierung-fundstelle-bleibt.test.ts tests/app/word-addin-ask.test.ts \
  tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts tests/ka7-konflikt-im-panel/konflikt-strukturiert.test.ts \
  tests/app/ka8-naechster-schritt-entwurf.test.ts tests/app/ka8-naechster-schritt-bestandsroute.test.ts \
  --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2
```

Ergebnis: Exitcode 0, 14 Testdateien, 193 Fälle grün, keiner übersprungen.

`tests/klara-assistenz/abgleich-belege.test.ts` hält diese Datei am Baum. Er prüft, dass jeder hier
genannte Pfad existiert und dass die Panelmarken stehen. Außerdem prüft er die Befunde W1, W1a und
„Produktfamilie nicht begonnen“. Ändert sich einer davon, wird der Test rot. Dann ist diese Datei
nachzuführen, nicht der Test aufzuweichen.

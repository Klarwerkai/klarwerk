# Word-Host-Gesamtweg · Einzelabgleich der zugeordneten Originalpunkte

Vorgang `aufnahme:20260922:word-echter-arbeitsweg` (Kriterien 12 und 13). Je Originalpunkt der
Auftragsquelle steht hier das Ergebnis am heutigen Bestand oder die konkret verbleibende
Entscheidung. Stand: Arbeitsbaum dieses Auftrags, Oktober 2026.

## Wie dieser Abgleich zu lesen ist

- **Beleg im Bestand** nennt Quelltext oder Prüfstände, die heute im Baum stehen. Diese Prüfstände
  wurden für den Abgleich gelesen, nicht erneut ausgeführt; ausgeführt werden nur die Suiten des
  Prüfplans dieses Auftrags. Ein historischer Vermerk „ERLEDIGT“ oder „live belegt“ zählt nicht als
  heutige Erfüllung, wenn er hier nicht an einen vorhandenen Prüfstand gebunden ist.
- **Keine Zeile behauptet eine Bedienung im echten Word-Host.** Für keinen Punkt liegt ein realer
  Lauf in Word für das Web oder Word für Mac vor. Wo allein dieser fehlt, steht `hostprobe`; die
  Läufe stehen in `docs/operations/word-web-hostabnahme/README.md`,
  `docs/operations/word-mac-hostabnahme/README.md` und `docs/operations/word-host-gesamtweg.md`.
- Die Registerkennungen (R-…) kommen im Quelltext nicht vor; zugeordnet wurde über Inhalt,
  Jobnummer und Panelmarken.

Ergebnisse:

| Ergebnis | Bedeutung |
|---|---|
| `geliefert` | im Bestand umgesetzt und durch einen vorhandenen Prüfstand gedeckt |
| `teilweise` | ein Teil ist geliefert; der Rest ist in der letzten Spalte benannt |
| `hostprobe` | Funktion und automatischer Beleg vorhanden; offen ist allein die Bedienung im echten Host |
| `offen` | die Funktion fehlt im Bestand |
| `ungeprueft` | kein heutiger Beleg gefunden; der Stand ist ungeklärt |
| `ersetzt` | durch eine jüngere Entscheidung oder Lieferung abgelöst |
| `abgegrenzt` | Nichtziel dieses Auftrags |
| `entscheidung` | eine konkrete Entscheidung oder ein fehlender Quellenwortlaut steht aus |

## Abgrenzung zu anderen Aufträgen und Lieferungen

- `aufnahme:20260922:m365-anmeldung`: dessen realer Hostteil wird hier geführt (Entscheidung
  `entscheidung:ca86022d`, Option C). Die Lieferung der Anmeldung selbst (Dialogseite, Übergabe ohne
  Drittanbieter-Cookie, Sitzungsablauf, Kontowechsel) steht in `tests/office-web-anmeldung/` und
  wird hier nicht neu gebaut.
- `arbeit:word-rueckweg-freigabe-nur-admin-20260921`: Direktfreigabe nur `admin`, belegt in
  `tests/word-rueckweg/freigabe-nur-admin.test.ts`; hier nur wiederverwendet.
- `arbeit:d5-ki-aus-ohne-kundendatenzugriff-20260921`: Abschaltung der externen KI, belegt in
  `tests/d5-ki-aus/abschaltung-am-frageweg.test.ts`; hier nur wiederverwendet.
- Nichtziele dieses Auftrags: keine EMF/WMF-Rettung, keine Wiederaufnahme alter PoC-Teile.

## Der Abgleich

| Punkt | Gegenstand | Ergebnis | Beleg im Bestand | Rest / verbleibende Entscheidung |
|---|---|---|---|---|
| R-0001 | Entwurf mit Formatierung aus Word | geliefert | `tests/app/word-addin-draft-html.test.ts`, `tests/capture/docx-extract.test.ts` | Bedienung im Host: W11, MS1 |
| R-0015 | Bildunterschriften aus der Dokumentstruktur | teilweise | `tests/m5-docx-bildunterschriften/zuordnung.test.ts`, `tests/m5c-ui-bildunterschriften/kennzeichnung-am-bild.test.ts` | Einfügen, Speichern und Wiederöffnen im Host offen (Sollvergleich WS/MS) |
| R-0016 | Bildverlust wird gemeldet | geliefert | `tests/app/job2551-bildverlust-satz-mounted.test.ts`, `tests/addin-bildbilanz/bildbilanz-im-panel.test.ts` | — |
| R-0048 | Bildanker im Editor | teilweise | `tests/app/mega88-bildanker-sammler.test.tsx` | Abnahme aller Eingänge offen (laut Quelle) |
| R-0067 | Station 1: Word-Dokument mit Bildern erfassen | hostprobe | `tests/app/job2613-docx-bilder-uebergabe.test.ts`, `tests/app/job2923-station1-beweislauf.test.tsx` | echtes Dokument im Host: WS1–WS4, MS1–MS4 |
| R-0068 | Station 2: Fließtext durchsuchbar | geliefert | `tests/app/job2614-bodytext-kette.test.ts`, `tests/app/job2614-fundstelle-sichtbar.test.tsx` | — |
| R-0078 | Word-Herkunft am Wissensobjekt | geliefert | `tests/app/k1-word-addin-origin-panel.test.ts` | — |
| R-0079 | Panel: Wissen aus dem offenen Dokument übernehmen | teilweise | `tests/design/zielbild-k2-erfassen.test.ts`, `apps/web/public/word-addin/taskpane.js` (`captureDocumentLink`) | Seiten- und Bildzahl am Knopf nicht gegengeprüft |
| R-0232 | Widerspruchshinweis an der Angebotskarte (KA7) | geliefert | `tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts` | Bedienung im Host offen |
| R-0296 | Fragen an Dokument und Markierung (KA5) | teilweise | `tests/ka5/markierung-fundstelle-bleibt.test.ts`, `tests/app/k1-ask-koerper-markierung.test.tsx` | „mit und ohne Markierung nachweislich verschiedene, quellenbelegte Antworten“ am echten Bestand offen |
| R-0312 | Ruhige Antwortkarte in Word | geliefert | `tests/design/zielbild-k1-antwort.test.ts`, `tests/s6-belegte-antwort/herkunft-an-der-antwort.test.tsx` | — |
| R-0324 | Drei Zustände des Fragewegs, ehrlicher Satz | geliefert | `tests/design/zielbild-keinwissen.test.ts`, `tests/design/zielbild-keinwissen-messung.test.ts` | — |
| R-0342 | Widerspruchshinweis beim Schreiben | teilweise | `tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts` | Abgleich startet per Klick, nicht beim Tippen: ob ein selbsttätiger Hinweis gewollt ist, entscheidet Pedi |
| R-0351 | Auslieferungsstand und Versionsnummer im Panel | geliefert | `tests/app/word-addin-taskpane-version-contract.test.ts` | — |
| R-0352 | Knopf „Klara fragen“ funktioniert | geliefert | `tests/app/word-addin-ask.test.ts` | Bedienung im Host: W8 |
| R-0353 | Versionsnummer aus einer Quelle | geliefert | `tests/app/word-addin-taskpane-version-contract.test.ts` | — |
| R-0356 | Antwort mit Zitat an der Cursorposition einfügen | hostprobe | `tests/app/mega35-word-ausgabe-entsteht-beim-ausgeben.test.tsx`, `tests/app/mega36-word-ausgaenge.test.tsx` | Einfügen im echten Dokument: W10, M6 |
| R-0357 | Antwort vor dem Einfügen kürzen und bearbeiten | geliefert | `tests/app/mega35-word-ausgabe-entsteht-beim-ausgeben.test.tsx`, `apps/web/public/word-addin/taskpane.js` (`askAnswerEditHint`) | — |
| R-0358 | Entwurf aus Markierung oder ganzem Dokument | geliefert | `tests/k2b-nebenlauf/zweiter-klick-und-spaeter-abruf.test.ts` (Markierung und „Ganzes Dokument übernehmen“), `tests/design/zielbild-k2-erfassen.test.ts` | Bedienung im Host: W11, M5 |
| R-0360 | Bilder aus Word im Entwurf (Station 1) | hostprobe | `tests/app/job2613-kette-am-stueck.test.tsx`, `tests/app/job2613-word-bilder-budget.test.ts` | Sollvergleich WS4, MS4 |
| R-0362 | Panel sagt die Wahrheit über seinen Zustand | geliefert | `tests/app/job2621-panel-wahrheiten.test.ts` | — |
| R-0363 | Drei Zustände des Fragewegs, Frage-Pille | geliefert | `tests/design/zielbild-k1-antwort.test.ts`, `tests/design/zielbild-keinwissen.test.ts` | — |
| R-0364 | Doppel-Send-Schutz (B36) | geliefert | `tests/k2b-nebenlauf/zweiter-klick-und-spaeter-abruf.test.ts` | — |
| R-0365 | Ehrliche Meldungen bei Import- und Sendeverlusten | geliefert | `tests/addin-bildbilanz/bildbilanz-im-panel.test.ts`, `tests/app/job2613-word-bilder-budget.test.ts` | — |
| R-0366 | Ehrlicher Satz, wenn Word Bilder nicht mitgibt | geliefert | `tests/app/job2551-bildverlust-satz-mounted.test.ts` | — |
| R-0367 | Erklärfeld zu Microsoft 365 im Panel | offen | im ausgelieferten Panel steht kein Microsoft-365-Erklärtext | Wortlaut fehlt in der Quelle; Ort muss zum Zielbild ohne Erklärtext im Sichtfeld passen (`tests/design/zielbild-k1-kein-erklaertext.test.ts`) — Pedi legt Wortlaut und Ort fest |
| R-0369 | Wartezustand und Antwortkarte mit Quellen | geliefert | `tests/design/zielbild-k1-antwort.test.ts`, `tests/app/job2916-d1-station6-belegte-antwort.test.ts` | — |
| R-0370 | Herkunft „aus Word“ bis in die Bibliothek | geliefert | `tests/app/k1-word-addin-origin-panel.test.ts` | — |
| R-0379 | Panel in Word starten (Sideload, Manifest) | hostprobe | `docs/word-addin/klara-manifest.xml`, `docs/word-addin/SIDELOAD-ANLEITUNG.md`, `docs/word-addin/SIDELOAD-CHROME.md` | Bereitstellung im Host: W2, M1 |
| R-0381 | Klara arbeitet in beide Richtungen mit Microsoft 365 | hostprobe | `tests/word-rueckweg/panel-rueckweg-mounted.test.ts`, `tests/app/job2613-kette-am-stueck.test.tsx` | Ergänzung 4 (Beleg) und W13 |
| R-0382 | Frage in Word beantwortet, Sitzung gilt wirklich | hostprobe | `tests/app/word-addin-ask.test.ts`, `tests/office-web-anmeldung/seitenfenster-empfang.test.tsx` | W3–W8, M2–M6 |
| R-0384 | Klara-Panel als Hauptkanal, gleiche Anmeldung | hostprobe | `tests/office-web-anmeldung/uebergabe-ohne-cookie.test.ts`, `tests/n1-bestand-im-panel/bestand-im-panel-mounted.test.ts` | W1–W7, M1–M4 |
| R-0385 | Klaras Gesicht statt Technikerformular | geliefert | `tests/design/zielbild-k1-ruhe.test.ts`, `tests/design/zielbild-k1-einstellungen.test.ts` | menschliche Designabnahme im Host offen |
| R-0386 | Konflikthinweis und KI nur mit Recht | geliefert | `tests/ka7-konflikt-im-panel/konflikt-strukturiert.test.ts`, `tests/app/klara-ai-session-consent.test.ts`, `tests/d5-ki-aus/abschaltung-am-frageweg.test.ts` | — |
| R-0387 | Word-Sofortpaket: sichtbar besser | hostprobe | `tests/design/zielbild-k1-ruhe.test.ts`, `tests/app/w1-klara-vertrauenskopf.test.ts` | „Pedi soll Word öffnen und den Unterschied sehen“: Augenschein offen |
| R-0388 | Markierung schlägt Eingabefeld — sichtbar | geliefert | `tests/app/k1-ask-koerper-markierung.test.tsx` | — |
| R-0389 | Neue Panel-Fassung erreicht Word (Cache) | geliefert | `tests/app/word-addin-taskpane-cache.test.ts` | — |
| R-0391 | Panel erkennt, dass es in Word läuft | hostprobe | `tests/klara-panel/p7-office-erkennung-am-fenster.test.tsx` | echtes Word-WebView: W3, M2 |
| R-0392 | Panel schreibt nicht bei jedem Hinsehen | geliefert | `tests/app/job2688-klara-jedes-hinsehen-ist-ein-schreibvorgang.test.ts` | — |
| R-0393 | Meldungen nennen die Ursache | geliefert | `tests/app/klara-session-consent-ui.test.ts` | — |
| R-0394 | Schlankes Panel im Ruhezustand | geliefert | `tests/design/zielbild-k1-ruhe.test.ts` | — |
| R-0395 | Sichtbarer Grund, warum Klara nicht antwortet | geliefert | `tests/app/job2621-panel-wahrheiten.test.ts` | — |
| R-0396 | Startsequenz und Lebenszyklus | geliefert | `tests/app/w1-klara-lifecycle-taskpane.test.tsx` | — |
| R-0398 | Add-in-Gesicht nach Designvorlage | geliefert | `tests/design/k1-funktionsinventar.test.ts`, `tests/design/zielbild-k1-ruhe.test.ts` | — |
| R-0399 | Drei Manifest-Kopien aufräumen | geliefert | einzige Manifestdatei im Baum: `docs/word-addin/klara-manifest.xml` | — |
| R-0400 | KA5 — Fragen zu Dokument und Markierung | teilweise | `tests/ka5/markierung-kein-egress.test.ts`, `tests/app/k1-ask-koerper-markierung.test.tsx` | verschiedene quellenbelegte Antworten mit/ohne Markierung am echten Bestand offen |
| R-0402 | Ruhiges Fragefeld als einziges Element | geliefert | `tests/design/zielbild-k1-ruhe.test.ts` | — |
| R-0403 | Handlung vor Erklärung (M-A) | geliefert | `tests/design/zielbild-k1-kein-erklaertext.test.ts` | — |
| R-0404 | Word-Zugriff (Ownerentscheidung E-01) | entscheidung | — | Wortlaut der Antwort fehlt in der Quelle; ohne ihn kein Abgleich möglich |
| R-0405 | Auslieferungs-Pin und Vollbeleg | geliefert | `tests/app/mega69-klara-auslieferung.test.ts`, `tests/app/mega69-klara-waechter.test.ts` | — |
| R-0406 | Bild-Alternativtext aus Word übernehmen | ungeprueft | `apps/web/src/lib/docx.ts` nennt keine Übernahme von Word-Beschreibungen | kein Prüfstand belegt die Übernahme in `alt`; zu messen oder zu bauen |
| R-0407 | Bilder aus Kopf- und Fußzeilen | ungeprueft | der Import liest den Dokumentkörper (`apps/web/src/lib/docx.ts`) | kein Prüfstand für Kopf-/Fußzeilenbilder; ob sie fehlen und gemeldet werden, ist ungeklärt |
| R-0408 | Frei platzierte Bilder erkennen | teilweise | Ganzdokumentweg (`getFileAsync` → `POST /api/drafts/from-docx`) und Browser-Dateiimport: eine DOCX mit verankertem, umflossenem Rasterbild (`wp:anchor`) läuft durch `tests/word-host-gesamtweg/verankertes-bild-wege.test.ts` (A1, B1) | Auswahlweg und HTML-Rückfall des Ganzdokumentwegs (`body.getHtml()`): `tests/app/job1135-word-umflossenes-bild.test.ts` belegt nur den bedingten Fall „Word gibt für ein umflossenes Bild kein `img` aus“, den der Test selbst eine unbewiesene Hypothese nennt — die echte Word-Ausgabe bleibt bis zum Hostnachweis offen; eine Rauchprobe im Host fehlt |
| R-0409 | Erfassung später fortsetzen | geliefert | `tests/entwurf-fortsetzen/blatt-entwurf-fortsetzen.test.tsx`, `tests/app/mega69-capture-draft-resume.test.tsx` | — |
| R-0410 | Inhaltsverzeichnis führt nicht ins Leere | geliefert | `apps/web/src/lib/docx.ts` (D-043) | — |
| R-0411 | KA7 — Widerspruchshinweis im Dokument | geliefert | `tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts` | — |
| R-0415 | Kopfzeilen landen nicht als Wissen | geliefert | `apps/web/src/lib/docx.ts` (D-042) | — |
| R-0416 | Zeichengrenze für den Vergleichstext | ersetzt | `apps/web/public/word-addin/taskpane.js` (JOB 2703 D3: keine Kürzung auf 500 im Client) | — |
| R-0418 | PoC-Add-in stillgelegt | geliefert | kein PoC-Add-in mehr im Baum | — |
| R-0419 | PoC-Add-in dreisprachig | abgegrenzt | — | alte PoC-Teile werden nicht reaktiviert; das produktive Panel ist dreisprachig (`tests/i18n/mega35-word-wortliste.test.ts`) |
| R-0420 | PoC-Add-in korrekt beschriftet | abgegrenzt | — | alte PoC-Teile werden nicht reaktiviert |
| R-0421 | PoC-Panel hängt nicht ewig | abgegrenzt | — | alte PoC-Teile werden nicht reaktiviert |
| R-0425 | Erfassungs-Vordertür über Word (Idee) | teilweise | `tests/design/zielbild-k2-erfassen.test.ts` | Erfassen im Panel besteht; ob es Nutzer weniger „verzettelt“, zeigt nur eine Nutzerprobe |
| R-0611 | Zustimmungsstand verständlich | geliefert | `tests/app/klara-session-consent-ui.test.ts` | — |
| R-0825 | Zwischenspeicher-Vertrag für das Word-Fenster | geliefert | `tests/app/word-addin-taskpane-cache.test.ts` | — |
| R-0870 | Welche Fassung des Fensters gilt (Pin) | geliefert | `tests/app/mega69-klara-waechter.test.ts` (Pin am 10.08. neu festgelegt) | — |
| R-1047 | Ausgegrautes Klara-Fenster | ungeprueft | — | kein Prüfstand und kein heutiges Fehlerbild; nur im Host reproduzierbar |
| R-1088 | Rauchprobe am echten Artefakt | teilweise | `services/app/src/routes/addin-static-routes.test.ts`, `tests/smoke/dist-frische.test.ts` | durchgehender Kurztest „Word bis Antwort“ im Host offen |
| R-1127 | Add-in-Identität und gespiegelte Typen | geliefert | `tests/app/job2703-d3-addin-paritaet.test.ts` | — |
| R-1128 | Hashwächter mit Stempelmaskierung | geliefert | `tests/app/mega69-klara-waechter.test.ts` | — |
| R-1129 | Sichere Grenze beim Sende-Haken (B35) | geliefert | `tests/app/mega71-onsend-synchron.test.ts` | — |
| R-1130 | Statische Auslieferungswege | geliefert | `services/app/src/routes/addin-static-routes.test.ts` | — |
| R-1131 | Wächter über Senden und Zurückkommen (B44) | ungeprueft | — | kein Prüfstand mit dieser Zusage gefunden |
| R-1179 | Augenschein-Mappe: acht Handgriffe mit Fotos | hostprobe | — | menschliche Bedienung durch Pedi; nicht automatisierbar |
| R-1412 | Wächter über das ausgelieferte Bedienfeld | geliefert | `tests/app/mega69-klara-waechter.test.ts`, `tests/app/mega69-klara-merkmale.test.ts` | — |
| R-1495 | Prüfsummen-Wache Quelle, Bau, Server | teilweise | `tests/smoke/dist-frische.test.ts`, `tests/app/mega69-klara-waechter.test.ts` | letztes Glied „bis in Pedis Word“ offen (Hostprobe mit `/health.commit`) |
| R-1504 | Antwortkarte wie Zielbild „Main“ (JOB 3004) | ersetzt | `tests/app/klara-regressionsinventar.test.ts` (JOB 3056 K1: Pedis Mockups ersetzen die Zielbilder vom 27.08.) | — |
| R-1506 | KA5 Serverhälfte | geliefert | `services/app/src/routes/ka5-markierung.test.ts` | — |
| R-1508 | Zustandsweg der Office-Erkennung (P7) | hostprobe | `tests/klara-panel/p7-office-erkennung-am-fenster.test.tsx` | echtes office.js und WebView |
| R-1510 | D2 „KeinWissen“ am laufenden Panel messen | geliefert | `tests/design/zielbild-keinwissen-messung.test.ts` | — |
| R-1512 | D3 „PruefungLaeuft“ messen | ersetzt | `tests/design/zielbild-pruefunglaeuft.test.ts` (Ablösungswächter, JOB 3056 K1) | — |
| R-1513 | D4 „SchlankesPanel“ messen | ersetzt | `tests/design/zielbild-k1-ruhe.test.ts` (JOB 3056 K1) | — |
| R-1516 | D3 „PruefungLaeuft“ als ruhige Ladekarte | ersetzt | `tests/design/zielbild-pruefunglaeuft.test.ts` (Laden zeigt der Sendeknopf) | — |
| R-1517 | D4 ruhiges Grundpanel | ersetzt | `tests/design/zielbild-k1-ruhe.test.ts` | — |
| R-1518 | P7 — Sendeknopf sagt, warum er wartet | geliefert | `tests/klara-panel/p7-office-erkennung-am-fenster.test.tsx`, `tests/app/job2621-panel-wahrheiten.test.ts` | Touchbedienung laut Quelle ausdrücklich außerhalb |
| R-1519 | KA5-Panelhälfte — Markierung als eigenes Feld | geliefert | `tests/app/k1-ask-koerper-markierung.test.tsx` | — |
| R-1546 | D2 „KeinWissen“ — ruhige Lückenfläche | geliefert | `tests/design/zielbild-keinwissen.test.ts` | — |
| R-1556 | K1 Klara nach Pages-Maßstab | geliefert | `tests/design/zielbild-k1-ruhe.test.ts`, `tests/design/zielbild-k1-antwort.test.ts`, `tests/design/zielbild-k1-einstellungen.test.ts` | menschliche Designabnahme im WebView offen |
| R-1557 | Markierung als Entwurf erfassen | hostprobe | `tests/design/zielbild-k2-erfassen.test.ts` | echte Markierung bis gespeicherter Entwurf: W11, M5 |
| R-1574 | DESIGN Klara neu (Pages-Maßstab) | teilweise | `tests/design/zielbild-k1-kein-erklaertext.test.ts`, `tests/design/k1-funktionsinventar.test.ts` | menschliche Designabnahme im echten WebView offen |
| R-1575 | DESIGN Erfassen als Markierungskarte | teilweise | `tests/design/zielbild-k2-erfassen.test.ts`, `tests/k2b-erfassen-reste/k2b-menue-und-link.test.ts` | Leertextfarbe ohne gefundenen Prüfstand; echtes Word ungemessen |
| R-1583 | check-text mit gültigem Schlüssel, Markierung, Wiederöffnen | hostprobe | `tests/s6-belegte-antwort/check-text-vor-einreichen.test.ts`, `tests/app/w6-dublettenweg-checktext.test.ts` | ausgelieferter Stand mit echtem Add-on-Schlüssel und Word-Markierung |
| R-1586 | Zielbild „Main“ umsetzen | ersetzt | `tests/design/zielbild-klara-main.test.ts` (Ablösungswächter), `tests/design/zielbild-k1-antwort.test.ts` | — |
| R-1587 | Zielbild „KeinWissen“ | geliefert | `tests/design/zielbild-keinwissen.test.ts` | — |
| R-1588 | Zielbild „PruefungLaeuft“ | ersetzt | `tests/design/zielbild-pruefunglaeuft.test.ts` | — |
| R-1589 | Zielbild „SchlankesPanel“ | ersetzt | `tests/design/zielbild-k1-ruhe.test.ts` | — |
| R-1602 | Station 1 durchgehend: zwei Bilder bis zur Datei | hostprobe | `tests/app/job2923-station1-beweislauf.test.tsx`, `tests/rueckweg-bilder-nutzerweg/rueckweg-bilder-pg-im-browser.integration.test.ts` | Sollvergleich WS1–WS4, MS1–MS4 |
| R-1607 | „Diese Seite läuft ohne Word“ — Erkennung im echten WebView | hostprobe | `tests/klara-panel/p7-office-erkennung-am-fenster.test.tsx` | W3, W7, W10 |
| R-1778 | KA5 offen (historische Zeile) | teilweise | `tests/ka5/markierung-fundstelle-bleibt.test.ts` | wie R-0296 |
| R-1780 | KA7 offen (historische Zeile) | geliefert | `tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts` | — |
| R-1794 | A8 erledigt: Mac-Kurzanleitung | geliefert | historischer Vermerk (Kurzanleitung für ein MacBook) | ersetzt keinen heutigen Mac-Nachweis (M1–M10) |
| R-1815 | Bildanker nach dem Einfügen zuverlässig | teilweise | `tests/app/mega88-bildanker-sammler.test.tsx` | Abnahme aller Eingänge offen |
| R-1886 | Bildanker: historischer Eingang und Handbeschreibung | teilweise | `tests/app/mega88-bildanker-sammler.test.tsx` | historischer Bericht; heutiger Klara-Eingang nicht gesondert gemessen |
| R-1958 | W3: Word übergibt Bilder nicht | teilweise | `tests/app/job2613-docx-bilder-uebergabe.test.ts` (ganze Datei per `getFileAsync`) | ob der Host die Bilder heute übergibt, zeigt nur WS4/MS4 |
| R-1974 | K7: ausgeliefertes Taskpane bleibt im Cache | geliefert | `tests/app/word-addin-taskpane-cache.test.ts` | — |
| R-2187 | Word-Textprüfweg anschließen | hostprobe | `tests/m3-dokumentweg-panel/w6-anschluss-echte-route.test.ts`, `tests/app/w6-dublettenweg-checktext.test.ts` | wie R-1583 |
| R-2198 | Echte Word-Bilder einschließlich Metafile-Rettung | abgegrenzt | Rasterbilder: `tests/app/job2613-docx-bilder-uebergabe.test.ts` | EMF/WMF-Rettung ist Nichtziel; der Verlust wird gemeldet (R-0016) |
| R-2207 | Kompletter Word-Weg nicht durchgehend abgenommen | hostprobe | `docs/operations/word-host-gesamtweg.md` | alle Hostläufe offen |
| R-2208 | Station 6 zeigt weniger als der Server weiß | hostprobe | `tests/s6-belegte-antwort/herkunft-an-der-antwort.test.tsx` | wie R-1583 |
| P-OFFICE-PG-ABNAHME | Rückweg und PG gegen echte Office-Datei | hostprobe | `tests/office-pg-abnahme/echte-worddatei-am-rueckweg.test.ts`, `tests/office-pg-abnahme/rueckweg-pg.integration.test.ts` | echter Office-Web-Host (Ergänzung 4) |
| P-WORD-RUECKWEG | Änderung aktualisiert dasselbe Wissensobjekt | hostprobe | `tests/word-rueckweg/route-accountregel.test.ts`, `tests/word-rueckweg/freigabe-nur-admin.test.ts` | Ergänzung-4-Beleg in Word Web |
| P-KLARA-VERSION | Beide Oberflächen zeigen ihre Fassung | teilweise | `tests/app/word-addin-taskpane-version-contract.test.ts` | Chrome-Erweiterung hier nicht gegengeprüft (Fassung 0.4.1 laut `extensions/klara-browser/manifest.json`) |
| P-M2-R | Quellenzuordnung der englischen Frageantwort | entscheidung | `apps/web/src/pages/Ask.tsx`, `tests/q1-quellen-wahrheit/quellenwahrheit-mounted.test.tsx` | betrifft die Web-Fragefläche, nicht den Word-Host; Stand ungeprüft — zu entscheiden, ob er hier oder bei der Fragefläche bearbeitet wird |
| TEST-A09 | Klara: Word auf dem Mac | hostprobe | `docs/operations/word-mac-hostabnahme/README.md` | M1–M10, MS1–MS4 |
| priority:OFFICE-PG-ABNAHME:41d668e389e8 | Doppelte Fassung von P-OFFICE-PG-ABNAHME | hostprobe | `tests/office-pg-abnahme/rueckweg-pg.integration.test.ts` | wie P-OFFICE-PG-ABNAHME |
| priority:WORD-RUECKWEG:a9c220de6223 | Doppelte Fassung von P-WORD-RUECKWEG | hostprobe | `tests/word-rueckweg/route-accountregel.test.ts` | wie P-WORD-RUECKWEG |
| priority:KLARA-VERSION:d61c0b41a79d | Doppelte Fassung von P-KLARA-VERSION | teilweise | `tests/app/word-addin-taskpane-version-contract.test.ts` | wie P-KLARA-VERSION |
| priority:WORD-VERGLEICH:589c47a85494 | A05: absatzweise Dokumentprüfung in Word | geliefert | `tests/word-vergleich/absatzvergleich-mounted.test.ts` | Bedienung im Host offen |
| priority:WORD-VERGLEICH-Z6:667d56d68e78 | Z6-Markierung bis zur Rücknahme | geliefert | `tests/word-vergleich/zwei-laeufe-und-spaete-antworten.test.ts`, `tests/word-vergleich/merkliste-und-ruecknahme.test.ts` | — |
| priority:M2-R:28b2d6b42b48 | Doppelte Fassung von P-M2-R | entscheidung | `apps/web/src/pages/Ask.tsx` | wie P-M2-R |
| priority:B2:65dd456556e3 | Bild zu markiertem Satz vorschlagen und einfügen | hostprobe | `tests/m5-bild-im-panel/bild-vorschlag-mounted.test.ts` | Einfügen im echten Dokument |
| priority:P2:487dd5615541 | Station 1 durchgehend belegen | hostprobe | `tests/app/job2923-station1-beweislauf.test.tsx` | wie R-1602 |
| priority:P7:f2c19623910d | Office-Erkennung im echten WebView | hostprobe | `tests/klara-panel/p7-office-erkennung-am-fenster.test.tsx` | wie R-1607 |
| package:abnahme | Vollständige Gastwege abnehmen | hostprobe | `docs/operations/word-host-gesamtweg.md` | Abnahme mit Datum, Version und Nachweis; Übergabe entscheidet Pedi |
| package:installation | Klara auf dem Mac einrichten | teilweise | `tests/app/word-addin-taskpane-version-contract.test.ts`, `docs/word-addin/SIDELOAD-ANLEITUNG.md` | Einrichtung Mac und Web je im Host offen (M1, W2); Nutzerprobe der Anleitung offen |
| package:rollen | Freigaberechte im Account | geliefert | `tests/word-rueckweg/freigabe-nur-admin.test.ts` | — |
| package:roundtrip | Bestehendes Wissen in Word ändern und zurückgeben | hostprobe | `tests/word-rueckweg/panel-rueckweg-mounted.test.ts`, `tests/word-host-gesamtweg/beleg-pruefung.test.ts` | Ergänzung-4-Lauf; Vorschlagsweg ohne Admin-Recht im Host gesondert |
| package:vergleich | Vorhandenes Wissen und Widersprüche erkennen | teilweise | `tests/n1-bestand-im-panel/bestand-im-panel-mounted.test.ts`, `tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts`, `tests/klara-browser/panel.test.tsx` | Gegenüberstellung abweichender Routereinstellungen im Browser hier nicht gegengeprüft |
| package:wordimport | Word-Inhalte mit Struktur übernehmen | teilweise | `tests/capture/docx-extract.test.ts`, `tests/k2b-nebenlauf/zweiter-klick-und-spaeter-abruf.test.ts`, `tests/word-host-gesamtweg/wiederoeffnen-sollvergleich.test.ts` | Desktop und Browser je im Host abnehmen (WS/MS) |
| question:K14 | Erweiterung 0.4.1 offline; Roundtrip 3667/4075 | hostprobe | `tests/word-rueckweg/route-bedingter-schreibzugriff.test.ts` | Mac und Web getrennt, Rechte und unveränderte Rückgabe-ID im Host |

## Summe

| Ergebnis | Anzahl |
|---|---|
| `geliefert` | 59 |
| `teilweise` | 21 |
| `hostprobe` | 29 |
| `offen` | 1 |
| `ungeprueft` | 4 |
| `ersetzt` | 9 |
| `abgegrenzt` | 4 |
| `entscheidung` | 3 |

## Quellenwidersprüche und fehlende Belege

- **R-0367 gegen R-1574/R-0403:** ein Erklärfeld zu Microsoft 365 im Panel gegen „kein Erklärtext
  im Sichtfeld“. Auflösbar nur mit Ort (z. B. hinter dem Zahnrad) und Wortlaut — beides fehlt.
- **R-0342 gegen den gelieferten KA7:** „beim Schreiben“ gegen den Abgleich per Klick
  (`docs/klara/aufnahme-20260922-gesamt-klara-assistenz.md`).
- **R-0404:** die Entscheidung E-01 ist nur über ihren Titel belegt.
- **Schwärzung gegen Dokumentadresse:** siehe `docs/operations/word-host-gesamtweg.md`, Abschnitt 1.
- **Doppelte Quellenfassungen:** die `priority:…`-Punkte wiederholen P-OFFICE-PG-ABNAHME,
  P-WORD-RUECKWEG, P-KLARA-VERSION und P-M2-R; sie sind gleich abgeglichen.
- Für keinen Punkt liegt ein realer Lauf in Word für das Web oder Word für Mac vor.

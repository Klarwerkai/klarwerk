# Rotfall-Inventar des Gesamtchecks (R-1329 / R-1381)

Auftrag `aufnahme:20260922:gesamt-prueftor-einheitlich`, Nacharbeit 9. Grundlage ist der erste
Gesamtcheck, der die Stufe `test` erreicht hat: Kandidat `b3ca759e`,
`HISTORIE/nacharbeit-8/PRUEFUNG/gesamttor.log` (SHA-256 `99c9724a…`). Ergebnis dort: Browsergruppe
105 rote Fälle in 34 Dateien, übrige Gruppe 479 rote Fälle in 190 Dateien; die vier UI-Smoke-Stufen
wurden nicht erreicht. Die Teststufe war vorher nie erreicht worden (Abbruch an `architecture`, ab
Nacharbeit 8 an `geheimnis-scan`). Die Rotfälle haben sich also über viele Aufträge angesammelt,
ohne dass ein Tor sie sehen konnte.

**Art dieser Einordnung:** gelesen aus dem Protokoll und, wo genannt, am Quelltext nachgesehen.
Gruppe A (Nacharbeit 9) und B (Nacharbeit 10) sind ursachenbezogen bearbeitet. C–G sind
Arbeitshypothesen zur Reihenfolge, kein Urteil über Produkt oder Test.

## A · Testvertrag hinter dem Produkt — bearbeitet in Nacharbeit 9

Gemeinsame Ursache: eine Prüffläche ersetzt die Transportgrenze (`fetch`-Router, `endpoints`-Proxy,
`vi.mock`) und kennt einen später hinzugekommenen Endpunkt, Haken oder Provider nicht. Der Rückfall
`[]` ist truthy, aber nicht die Antwortform; die Fläche bricht an einem fremden Feld ab, bevor der
eigentliche Gegenstand der Datei gemessen wird. Behoben jeweils an der Prüffläche, mit der
Antwortform des Servers bzw. dem Produktverhalten; kein Produktzugriff abgeschwächt.

| Datei | Fehlender Vertrag |
|---|---|
| `apps/web/src/pages/KnowledgeDetail.owner-chain.test.tsx` | `/api/kos/:id/verstaendnisfragen` → `FragensaetzeAmEintrag` (Bens Befund; C1, C3–C5) |
| `tests/wissensluecken-etikett/flaechen-mounted.test.tsx`, `…/originalfrage-und-haeufigkeit-mounted.test.tsx` | `useReturnedTasks`, `useAuthorTransfers` im Hook-Mock (`MyTasks`) |
| `tests/capture/job512-bildverlust-kette-mounted.test.tsx` | `useImageDescribeWennVorhanden` im Mock (OCR-02) |
| `tests/app-sprachschalter/eintritt-mit-sprache.test.tsx` | nachgeladene Klara-Flächen nach `vi.resetModules()` → zweite `AuthContext`-Instanz |
| `tests/app-sprachschalter/schalter-auf-jeder-seite.test.tsx` | `importAccess.confluence` → `ImportAccessStatus` |
| `tests/h6-d1-nutzerdetail-stand/nutzerdetail-offline.test.tsx`, `…/frischefrist-nachholung.test.tsx` | `audit.list` (ADMIN-04, `useAudit` im Nutzerdetail) |
| `tests/app/h1-konto-punkt-frische-mounted.test.tsx` | `reasoner.status` (R-0606, `ExternStatus` in der Kopfzeile) |
| `tests/seitenhilfe-navkapitel/lesekapitel-am-seitenverhalten.test.tsx` | `validation.pruefdauer` → `PruefdauerAuswertung` (R-1655) |
| `tests/klara-vorschau/erfassungskontext-mounted.test.tsx` (über `tests/fe003-tutorial-fragen/huelle.tsx`) | `/api/me/klara/notizen` → `{ notizen }` |

## B · Sichtbarkeit, Leserechte, Vertraulichkeit — bearbeitet in Nacharbeit 10

Viele Fälle zeigen in dieselbe Richtung: das Sichtbarkeitsprädikat hat seine Form geändert
(`sqlSichtbarkeitFuer` liefert `0`/`1` statt `false`/`true`; im Trim-SQL fehlt
`k.confidentiality_key`; `category-routes.ts:26` reicht ein Objekt `{sql, params, trifftZu}`),
Freigaben enden mit 404 „Wissensobjekt nicht gefunden“ statt 200/403, Exporte bleiben leer, und
Vertraulichkeit kommt als `intern` statt `vertraulich` an.

**Abgleich mit R1 und P04 (Bens Vorgabe).** Beide Lieferungen liegen nicht im Kandidaten
(`git merge-base` mit R1 `9315fa9f` = `e3b86aec`, mit P04 `990f9f57` = `9a8131fd`). Gelesen mit
`git show`: R1 ergänzt in `sichtbarkeit.ts` nur `klasseSichtbarFuer`/`bestandsSichtFuer`, P04 die
KI-Regeln je Schutzstufe. Keine der beiden ändert eine der roten B-Dateien oder enthält eine
Reparatur dafür. Übernommen wurde deshalb nichts; es gibt keine zweite Rechte- oder
KI-Regelimplementierung.

**Ursache.** Die Prüfungen liegen hinter drei bereits entschiedenen und im Produkt umgesetzten
Regeln zurück — kein Produktfehler:

| Regel (Quelle im Code) | Wirkung auf die roten Fälle |
|---|---|
| Entscheidung 15 · Variante B (`sichtbarkeit.ts`, Kopf; `freigaberang`) | Rang statt Rolle: Parameter `[rang, betrachter, spaces]`; ohne gesetztes Niveau Rang 1 für `ko.validate`, nie Rang 2 |
| Entscheidung 16 (`schutzrang`; `KoService.create` setzt keine Stufe) | ein Objekt ohne Stufe ist ungeklärt = vertraulich; Trim liest `data->>'confidentiality'` statt `confidentiality_key` |
| Entscheidung J24 (`requireVisibleDraft`) | unsichtbarer Entwurf 404 statt 403 |
| R-0247, Pedis Entscheidung 73b53301 (`dublettenTor`) | Zustimmung bei offener Dublette braucht `duplicateAcknowledged` |
| R-0179 Nacharbeit 4 (`einstufungAusDatei`) | gültige Stufe aus der Importdatei bleibt |
| R-2197 (`KoService.setQuellrechte`) | quellgeführtes Objekt folgt der Quelle auch nach unten; menschliche Einstufung nicht |

Vorbild der Anpassung war die Lieferung gesamt-leserechte selbst (`library-export-egress.test.ts`:
„intern“ ausdrücklich setzen). Wo ein Fall eine andere Zusage misst (Herabstufungssperre R-0632,
Stufenfrage C1), bekommt das Prüfkonto das Niveau über den Verwaltungsweg `PUT /api/users/:id`,
damit die eigentliche Zusage weiter gemessen wird. Neu hinzugekommen: die Dublettenfrage in D1
und ein Gegenfall „menschliche Einstufung bleibt“ in Lauf 3 B5.

**Nacharbeit 11 (Kandidat `6b9e3ad9`, `HISTORIE/nacharbeit-11/PRUEFUNG/gruppe-b-sichtbarkeit-nach-entscheidung.log`):**
17 der 20 Dateien grün. Rot blieben die zwei vorgelegten Punkte (B10, FAQ) und
`tests/app/job1044-korrektur-wirkungskette.test.tsx` Fälle 2, 3 und 5. Dort griff nach der
Dublettenbestätigung eine weitere entschiedene Regel: P05-AC08 (Peters Entscheidung 11.10.2026,
`services/ask/src/gegenposition-ohne-modell.ts`). Ohne Modell wird nicht still eine von zwei
bestätigten Auskünften gewählt. Bestand („drei bar“) und freigegebene Korrektur („null bar“) stehen
deshalb beide mit Wortlaut in der Antwort; sie ist „ungeprüft“ und trägt den Mindestwert. Die Fälle
messen jetzt genau das. In Fall 5 fehlte die Antwortkarte. Die Datei lässt Hintergrund-Prüfjobs nur
vor der Korrektur auslaufen; die nach `revise` neu angestoßene KI-Prüfung lief während der Messung.
Das Auslaufen steht jetzt auch nach den Bewertungen. Diese Ursache ist aus dem Code erschlossen,
nicht gemessen.

**Nacharbeit 12 (Kandidat `518bffda`, `HISTORIE/nacharbeit-12/PRUEFUNG/job1044-gegenposition-ohne-modell.log`):**
Die Drahtprüfungen nach P05-AC08 waren grün, die Antwortkarte fehlte weiter. Die Hypothese mit den
Hintergrund-Prüfjobs aus Nacharbeit 11 traf nicht zu. Die tatsächliche Ursache ist ein Produktfehler
an der Naht zweier entschiedener Regeln. Die Gegenüberstellung bestand aus Absätzen „Titel: Wortlaut“
ohne Quellenmarke; `absatzBelege` (R-0310) fand darin weder eine Marke noch einen wörtlichen Auszug,
und `selectAnswer` machte aus der Antwort eine Wissenslücke. Auf der Fragenseite stand damit keine
der beiden Auskünfte. Behoben in `services/ask/src/gegenposition-ohne-modell.ts`: Jeder Wortlaut
trägt jetzt die Marke `[n]` seiner Quelle. Gegenprobe: G9 in `tests/ask/p05-gegenposition-ohne-modell.test.ts`.

**Nacharbeit 13 (Kandidat `8556e74b`, `HISTORIE/nacharbeit-13/PRUEFUNG/gegenposition-erreicht-flaeche.log`):**
Die Fälle 2 und 3 sowie G9 sind grün. Offen war die letzte Gegenprobe in Fall 5. Die fachfremde
Frage wurde als Nachfrage gestellt; nach R-0348/R-0278 (`services/ask/src/service.ts`, Themenanker
`faden[0]`) muss sie dann auch den Anker „Ventilwartung“ decken und findet die Kantinenquelle mit
Recht nicht. Das ist korrektes Produktverhalten. Der Test stellt sie jetzt wie im Betrieb über
„Neues Thema“ (`ask-gespraechsfaden-neu`).

**Zur Entscheidung vorgelegt (bleiben rot):**

1. *Lauf 3 B10 gegen confluence-import-rechte N6 F2.* `tests/confluence-quellabgleich/lauf3-nacharbeit.test.ts`
   erwartet `raisedTo: "vertraulich"` und „nichts halb“ (keine Anhebung ohne geschriebene
   Restriktion). Heute hebt der Rechteabgleich (`gleicheQuellrechteFuerAnkerAb`, vor dem Nachzug)
   die Stufe schon an; der Nachzug meldet deshalb `raisedTo: null`, und bei gescheitertem
   Ankerschreiben ist die Stufe trotzdem angehoben. Die Anhebung ist die sichere Richtung; offen
   ist, welcher Schritt sie besitzt und meldet.
2. *FAQ gegen Variante B — in Nacharbeit 14 behoben, keine Entscheidung mehr offen.* Ben (Nacharbeit
   14) hat richtiggestellt: Die Regel ist entschieden (Entscheidung 15, Vertragskorrektur R-0633 in
   `docs/entscheidungen/gesamt-leserechte.md`). Die vier vom Prüfer erfassten Antworten
   (`faq.vertrauen.4`, `faq.vertrauen.5`, `faq.bibliothek.6`, `faq.ki.3` in `apps/web/src/lib/faqContent.ts`),
   der Dokuspiegel und die Lesefassung `apps/web/src/lib/hilfeFaq.ts` (de/en/nl) nennen jetzt
   Stufe, persönliches Freigabeniveau und das Niveau ohne Einstellung. `faq.vertrauen.4` behauptete
   zudem „keine persönliche Sichtbarkeits-Einschränkung“ — falsch seit Variante B, korrigiert. Der
   Prüfer bildet Stufe, Niveaubedingung und Standardniveau ab; er misst mit Konten ohne und mit jedem
   Niveau und hat neue Gegenfälle (alte Rollenregel, Schweigen zu „streng vertraulich“, fehlendes oder
   zu hohes Standardniveau). Nicht angefasst, weil außerhalb des Befunds und durch den i18n-Wächter
   eingefroren: die Kurzhilfe zur Stufe (`texte/fachwort.ts`, `woerterbuch/de.ts`). Sie sagt noch,
   die Stufe schränke „(noch) nicht ein, WER das Objekt sieht“ — das widerspricht ebenfalls Variante B.
3. *Stufenfrage über dem eigenen Rang (Beobachtung).* Die Prüfkarte bietet jeder prüfenden
   Person alle drei Stufen an. Wählt eine Controllerin ohne gesetztes Niveau „streng vertraulich“,
   sieht sie das Objekt danach nicht mehr (404). Ob die Wahl auf den eigenen Rang begrenzt werden
   soll, ist nicht entschieden.
4. *Rahmensätze der Gegenüberstellung gegen R-0310 (kein Rotfall, aber eine Lücke).* P05-AC08
   verlangt den Satz „ohne Modell keine Widerspruchsprüfung“ und die Rückfrage nach dem
   Geltungsfall. R-0310 gibt nur Absätze aus, die eine Quelle belegt. Die beiden Rahmensätze stehen
   im Antworttext des Servers, die Fragenseite blendet sie aber aus. Eine Quellenmarke daran wäre
   ein falscher Beleg. Ob R-0310 Rahmensätze ohne Quellenaussage zulässt oder die Rahmung einen
   eigenen Platz bekommt, ist zu entscheiden. Derselbe Aufbau steht im Modellweg (`rueckfallStand`,
   JOB 3365) und wurde hier nicht geändert.

`tests/spaces/spaces-regel.test.ts` · `tests/k2b-kategorien-weg/kategorien-route.test.ts` ·
`tests/ko/g27-welle1-suchprojektion.test.ts` · `tests/wiki-grossbestand-nutzerweg/deckel-auf-sichtbarer-grundmenge.test.ts` ·
`tests/security/g6-export-formate-vertraulich.test.ts` · `tests/security/g6-export-teilmenge-der-lesemenge.test.ts` ·
`tests/wissen-export/quellen-und-auswahl.test.ts` · `tests/validierung-stufe/stufenfrage-bis-bibliothek.test.tsx` ·
`tests/vertraulichkeit-pflicht/word-uebernahme-bis-wissensobjekt.test.ts` · `tests/office-pg-abnahme/rueckweg-kalibrierung.test.ts` ·
`tests/pruefstatus-anzeige/r0212-konflikt-ueber-schnittstelle.test.ts` · `tests/entwurfs-index/entwurfs-index.test.ts` ·
`tests/quellenaenderungen-bewusst-uebernehmen/dienst-und-tuer.test.ts` · `tests/wiki-gesamtanweisung/f8-plugin-registrierung.test.ts` ·
`tests/json-herkunft-rundlauf/zusammenfuehrung-mit-herkunft.test.ts` · `tests/confluence-quellabgleich/lauf3-nacharbeit.test.ts` ·
`tests/app/job1044-korrektur-wirkungskette.test.tsx` und `tests/wissensnetz-leseweg/namensraum-kette.test.tsx` (409 `DUPLICATE_ACK_REQUIRED`) ·
`tests/klara-quellen-nutzerweg/zwei-quellen-bleiben-zwei.test.ts` (409) · `tests/dok1-export-wahrheit/faq-export-rollenausnahme.test.ts`

## C · KI-Abschaltung, Riegel, Egress — VORRANG, Ursachenanalyse ausstehend

**Nacharbeit 14:** Eine Ursache in C hat sich als B-Ursache gezeigt.
`tests/ka7-konflikt-im-panel/konflikt-strukturiert.test.ts` baut Quellen ohne Stufe. Die Prüfroute
blendet ungeklärte Objekte für den Prüfenden aus (Entscheidung 16), deshalb kam nie ein Urteil
zustande; die Quellen tragen jetzt ausdrücklich „intern“. Nicht dieselbe Ursache hat KA5: die
Fixtures tragen „intern“, der Egress-Filter `dropConfidential` lässt ungeklärte Objekte durch. Dort
und in den übrigen C-Dateien ist die Ursache offen. Die Liste unten stammt aus dem Gesamtcheck am
Kandidaten `b3ca759e` (Nacharbeit 8) und ist seitdem mehrfach durch Integrationen überholt.

- `tests/d5-ki-aus/abschaltung-am-frageweg.test.ts` (rund 70 Fälle): die Fragestrecke liest nach
  `konflikte.all` zusätzlich `ko.findById` und `suchprojektion.find`; die Kalibrierung der
  Haltepunkte kennt diese Lesepunkte nicht. Ob die Abschaltung sie deckt, ist offen.
- `tests/klara-dokumenttext/riegel-haelt-den-dokumenttext.test.ts`, `tests/admin-ki-freigabe/word-dokumenttext-vertraulich.test.ts`,
  `tests/ka5/markierung-kein-egress.test.ts`, `tests/ka5/markierung-fundstelle-bleibt.test.ts`,
  `tests/ka7-konflikt-im-panel/konflikt-strukturiert.test.ts`, `tests/klara-freigabe/v2-einwilligung-ende-zu-ende.test.ts`:
  das Modell bzw. der Judge wird nicht mehr gerufen.
- `tests/app/mega69-klara-merkmale.test.ts`: `mode: "retrieval-only"` fehlt in der Ask-Nutzlast der
  Taskpane — laut Test „die tragendste Zusage dieser Datei“.
- `tests/legal/mega61-ki-satz.test.ts`, `tests/legal/mega62-kostenhinweis-sammler.test.ts`: eine
  Modellfläche ohne KI-Satz bzw. Kostenhinweis.

## D · Register- und Inventarwächter — je Neuerung prüfen, dann nachtragen

Die Wächter verlangen ausdrücklich, neue Routen, Tabellen, Exporte und Fundstellen erst zu
beurteilen und dann einzutragen („nicht den Wächter erweitern“, wo es so steht). Größere Posten:
`tests/architektur-vertrag/http-api-referenz.test.ts` (188 Routen ohne Zeile) ·
`tests/beta-rollenabnahme/*` (64 Türen, 5 Gruppen) · `tests/security/route-guard-audit.test.ts` (23
Routen, davon öffentliche Nicht-GET-Wege `POST /wopi/files/:anhangId` u. a.) ·
`tests/security/mega74-lesewege-sammler.test.ts` · `tests/security/g10-herkunft-zentrum-vertraulich.test.ts` ·
`tests/capture/aufrufer-waechter.test.ts` (47 Exporte) · `tests/betroffenenrechte/dateninventar.test.ts`
(10 Tabellen) · `tests/backup-drill/tabellensatz.test.ts`, `…/restore-drill.test.ts` (`push_abos`) ·
`tests/demo-zugang-gaeste/kein-offener-zugang.test.ts` · `tests/demo-zugang-start/*` (Startvertrag,
`VAPID_*`) · `tests/funktionsschalter/schalter-leser.test.ts` (`vorfuehrung`) ·
`tests/app/klara-regressionsinventar.test.ts` · `tests/klara-zerlegung/schnitt-pins.test.ts` ·
`tests/architektur-vertrag/zusammenschaltung.test.ts` · `tests/db/i10-gleichartige-parameter-sammler.test.ts` ·
`tests/app/mega47-…`, `mega84-…`, `tests/capture/mega85-…` (Sammler) · `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts` ·
`tests/ki-freigaberegeln/ausgehende-ziele.test.ts` · `tests/ki-governance/governance-paket.test.ts` ·
`tests/smoke/mengenpruefung.test.ts`, `tests/gesamt-navigation/smoke-manifest-u3.test.ts` ·
`tests/typrein-schreibwege/typpruefung-traegt.test.ts` · `tests/structure/testverweise-aufloesbar.test.ts` ·
`tests/i18n-textmodule/bestand-unveraendert.test.ts`, `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts` ·
`tests/sprache-begriffe/*` · `tests/q9-*` (neue deutsche Meldungsliterale in `routes/capture-routes.ts`) ·
`tests/structure/kd-capture-doppelungen.test.ts`, `…/fremddoppelungen-kd-capture.test.ts` ·
`tests/library-analytics-freeze144.test.ts` (Hash-Freeze verletzt) und weitere Pins im Protokoll.

## E · Überschreitungen bestehender Grenzen — gegen die Grenzen bearbeiten

Korrektur in Nacharbeit 47: Diese Fälle sind keine pauschal offenen Grenzwertentscheidungen. Die
bestehenden Grenzen gelten. Bearbeitet wird gegen sie, und alle bestellten Funktionen bleiben
erhalten. Einen konkreten, mit Originalquelle belegten Widerspruch gibt es bei keinem der Fälle;
deshalb ist keiner als Entscheidung vorgelegt. Stand je Fall siehe „Nacharbeit 47“.

- `tests/erstladezeit/eintritt-ohne-seiten.test.ts`: Eintrittsbündel gegen den Deckel 1 360 000 B
  aus R-0801. Gemessen sind 2 675 039 B (Nacharbeit 8) und 2 698 517 B (Nacharbeit 26).
- `tests/app/mega43-klara-werkbank-palette.test.ts`: Kontrast 3,83:1 und 2,75:1 unter WCAG AA 4,5:1.
- `tests/design-schriftskala/*`, `tests/legal/mega62-kontrast-pflichtflaechen.test.ts`: 17 frei
  gesetzte Schriftgrößen unter 11 px; neue Textklasse `text-klein` im Kopfband ohne geprüfte Fläche.

## F · Browsergruppe (Chromium, 34 Dateien)

Überwiegend Messungen an der gebauten Fläche (`tests/design/zielbild-*`, `…/h1|h4|k1-funktionsinventar`,
`tests/wiki-orientierung/*`, Schmal- und Tastaturmessungen). Eine sichtbare Gemeinsamkeit: die
KI-Lage-Zeile der Kopfzeile (R-0599, „KI-Lage unbekannt“ bzw. „Keine KI · regelbasiert“) steht in
keinem Kopfband-Inventar. Einzelne Zeitüberschreitungen (`page.waitForFunction`) noch nicht eingeordnet.

## G · Umgebung und Nebenläufigkeit

- `tests/geheimnisse-betrieb/geheimnisse-nur-in-der-betriebsumgebung.test.ts`: ENOENT auf ein
  Probeverzeichnis aus `tests/backup-drill/` — paralleler Lauf räumt es weg.
- `tests/smoke/frontdoor-schmalansicht-lauf.test.ts`: `spawnSync npm ETIMEDOUT`.
- `tests/vorschau-reichweite/alte-flaeche.test.ts`: `git apply` des Rücknahme-Patches scheitert am heutigen Stand.

## Aktueller Gesamtcheck — Kandidat `b30cbd6d` (Nacharbeit 16)

`HISTORIE/nacharbeit-16/PRUEFUNG/gesamtcheck-r1329.log` (SHA-256 `083e853d…`): Exit 1 in der Stufe
`test`. Browsergruppe 108 rote Fälle in 37 Dateien, übrige Gruppe 390 rote Fälle in 159 Dateien; die
vier UI-Smoke-Stufen wurden nicht erreicht. Gegenüber Nacharbeit 8 (105 + 479) ist die übrige Gruppe
kleiner, die Browsergruppe gleich groß. In Nacharbeit 16 nach Ursachen bearbeitet:

| Ursache | Dateien | Art der Behebung |
|---|---|---|
| **D5-Lücke im Produkt:** Referenzprüfung (REF-02) und Rechte-Nachlesen (P05-AC03) lasen nach der letzten Abschaltprüfung weiter Inhalte, die Antwort ging ohne letzte Prüfung hinaus | `services/app/src/routes/ask-routes.ts`, `reasoner-routes.ts`; Gegenprobe `tests/d5-ki-aus/abschaltung-am-frageweg.test.ts` (neue Kalibrierung und neun neue Haltepunkte) | Produkt: Abschaltprüfung vor jedem Lesen in `fundstellenLeser` und im Nachlesen, unmittelbar vor der Auslieferung |
| **R-0310-Lücke im Produkt (Modellweg):** die Gegenüberstellung von `rueckfallStand` (JOB 3365) wurde zur Wissenslücke | `services/reasoner/src/provider-model.ts`; Gegenprobe `tests/ask-c02/konflikt-flaeche-mounted.test.tsx` | Produkt: Quellenmarke je Wortlaut, wie in Nacharbeit 12 für P05-AC08 |
| Fixtures ohne Stufe (Entscheidung 16, wie Gruppe B) | melder, check-text-routes, knowledge-check-routes, ko-routes-stufenauskunft, ko-routes-anzeigestatus, validation-routes, kos-liste-anzeigestatus, w6 ×2, aistate-fix4 | „intern“ ausdrücklich; Niveau über `PUT /api/users/:id`, wo „streng vertraulich“ gemessen wird |
| Auditweg (Nacharbeit 28: Leseransicht ohne Ketteneinsicht) | `services/app/src/addon-principal.test.ts` | Ketteneinsicht wie im Betrieb über `KLARWERK_AUDIT_KETTENEINSICHT` |
| Wächter: zweiter `timingSafeEqual` | `services/app/src/addon-principal.test.ts` | WOPI-Markensignatur namentlich geführt, mit Gegenprobe ohne Add-on-Schlüssel |

**Offen aus diesem Lauf**, nach erster Fehlermeldung gruppiert, Ursache je Datei noch nicht belegt:
- *Register- und Inventarwächter (D):* `db.migrate` (`LAGEBILD_WERTE_SCHEMA` nur eingebettet),
  `build-app` (fünf neue Fehlercodes), `backup-drill` (`push_abos`, `klara_aufgaben`),
  `betroffenenrechte/dateninventar` (zehn Tabellen ohne Datenart), `quellabgleich-ablage`,
  `http-api-referenz` (189 Routen), `zusammenschaltung`, `beta-rollenabnahme/*` (65 Türen),
  `route-guard-audit`, `mega74-lesewege-sammler`, `aufrufer-waechter` (49 Exporte), `mega47`, `mega84`,
  `mega85`, `klara-regressionsinventar`, `h6-rollenfreiheiten` (`ablauf`), `dirty-flow-navigation-guard`
  (`AblaufUebernahme.tsx`), `navguard-history-authority`, `i18n-*`, `q9-*`, `sprache-begriffe`,
  `testverweise`, `library-analytics-freeze144`, `job1042`, `job2666`, `pro375`, `tv1` u. a. Die
  Datenart einer Tabelle (Betroffenenrechte) ist eine fachliche Einordnung je Tabelle, kein Nachtrag.
- *Grenzen (E):* Kontrast `mega43`, Textklasse `text-klein` (`mega40`, `mega62`), Schriftskala,
  Eintrittsbündel `erstladezeit`.
- *Oberfläche (F, Browser):* `design/zielbild-*`, Funktionsinventare, `KI-Lage unbekannt` im Kopfband
  (`h1-vorschau-rueckweg`, `fe002-kopfband`), Hinweisbanner überdeckt Bedienelemente
  (`wiki-orientierung`), Erfassen-Feld „Kernaussage“ nicht gefunden (`entwurf-verlassen`).
- *Einzelfälle mit Produktbezug, noch nicht eingeordnet:* `ka5/*` und `ka5-markierung`, `mega69` (`mode:
  "retrieval-only"`), `ask-check-caveat`/`mega34` („Fachlich bestätigt“ trotz unbekannter Prüfung),
  `capture/*` (zweiter describe-Aufruf), `confluence-quellabgleich/abgleich` und `runde3`,
  `import-genau-einmal`, `wiederanlauf/replay-grenze`, `live-check-*`, `suchguete-drift`.

## Gesamtcheck — Kandidat `9306cf1c` (Nacharbeit 17)

`HISTORIE/nacharbeit-17/PRUEFUNG/gesamtcheck-r1329.log` (SHA-256 `8c558240…`): Exit 1 in `test`.
Browsergruppe 106 rote Fälle in 35 Dateien, übrige Gruppe 266 rote Fälle in 147 Dateien (Nacharbeit
16: 108 + 390). Die neuen D5-Haltepunkte fanden drei weitere Leselücken nach der Abschaltung, alle
behoben:

- `searchProjectionOf` liest Objekt und Projektion mit einem Warten dazwischen. Die Fundstellen der
  Referenzprüfung lesen jetzt über `searchProjectionUnterKiSperre` (Sperre vor beiden Schritten, neu
  mit Fassung) — `services/knowledge-object/src/service.ts`, `services/app/src/routes/ask-routes.ts`.
- Die Suche nach einer fachlich gelösten gleichen Frage (wissenskreislauf-schliessen,
  `geloesterEintragFuer`) las Lückenbestand und Objekt ohne erneute Prüfung — jetzt mit der Sperre
  „ergebnis“ davor (`services/ask/src/service.ts`). Neuer Haltepunkt `luecken.all` samt Gegenprobe.
- Der SQL-Ersatz der PostgreSQL-Haltefälle kennt die Anweisung `SELECT data FROM gaps` (`PgGapRepo.all`)
  dieser Suche; ohne sie endete die Vorfrage mit 500.

## Nacharbeit 18 — Kandidat `40b7537b`, Abgleich mit dem Protokoll von `9306cf1c`

Grundlage ist das Protokoll aus Nacharbeit 17; ein neuer Lauf liegt nicht vor. Statisch nach Ursache
bearbeitet (gezielte Prüfungen stehen im Prüfplan, Ergebnisse noch offen):

| Ursache | Dateien | Art der Behebung |
|---|---|---|
| KI-Lage-Zeile der Kopfzeile (R-0599) fehlte in den Kopfband-Inventaren | `tests/design/zielbild-h1-kein-erklaertext.test.ts`, `tests/design/h1-funktionsinventar.test.ts`, `tests/app/h1-vorschau-rueckweg-mounted.test.tsx` | Die Zeile wird als benannte Ausnahme abgezogen **und** ihr Vorhandensein geprüft; die Wortgrenzen bleiben unverändert |
| H6: die Filterkarte von ADMIN-04 wurde zum Messanker | `tests/design/zielbild-h6-einstellungen.test.ts` | Anker ist die erste Zeile mit Bezeichnung, Wert und Pfeil und deren Karte |
| Kontoziele (Richtlinien, Chat) im Kopfband | `tests/fe002-kopfband/kopfband-fe002.test.tsx` | Ziele nur, wenn `routePathAllows` sie für die Rolle zulässt |
| Fünf neue Fehlercodes ohne Eintrag | `services/app/src/build-app.ts` | `INVALID_LAGEBILD_WERTE`, `LAGEBILD_KONFLIKT`, `VAPID_*` geprüft und eingetragen |
| Migrationsliste: Endanker und eingebettete Stufe | `services/app/src/quellabgleich-ablage.test.ts`, `services/app/src/db.migrate.test.ts` | Mitgliedschaft statt letzter Zeile; `LAGEBILD_WERTE_SCHEMA` als in `MANAGEMENT_PROFILE_SCHEMA` eingebettet gezählt |
| Restore-Drill ohne `push_abos`, Pflichtliste ohne `klara_aufgaben` | `scripts/backup/restore-drill.sh`, `tests/backup-drill/restore-drill.test.ts` | Tabellen nachgetragen |
| Zehn Tabellen ohne Datenart | `services/app/src/dateninventar.ts` | Je Tabelle nach DDL und Code eingeordnet. **Befunde:** `ask_nulltreffer` (Suchbegriff im Wortlaut), `push_abos` (bleibt nach Kontolöschung stehen) und `richtlinien_handlungen` sind personenbezogen, fehlen aber in der Selbstauskunft; Nulltreffer und Push-Abos haben keinen Löschweg mit dem Konto. Als offene Produktlücke festgehalten, nicht behoben |

Weiter offen aus dem Protokoll von `9306cf1c`: die übrigen Wächter aus D (u. a. `http-api-referenz`,
`beta-rollenabnahme`, `route-guard-audit`, `aufrufer-waechter`, Sammler `mega47/84/85`), die Grenzen
aus E, die übrigen Browserfälle aus F (Erklärtextlängen in H2–H5/K1/K2, Fussband, Schmalansicht 390 px,
Hinweisbanner, Zeitüberschreitungen), G und die Einzelfälle mit Produktbezug. Zur Entscheidung
liegen weiter vor: Lauf 3 B10, die Rahmensätze aus R-0310, die Stufenfrage über dem eigenen Rang und
die Grenzwerte aus E. Ein grüner Gesamtcheck mit den vier UI-Smoke-Stufen ist **nicht** belegt.

## Nacharbeit 19 — Kandidat `a3be30dc`, gezielte Prüfung

Die Suiten aus Nacharbeit 18 liefen grün, bis auf einen Fall: `h1-funktionsinventar` K-gehezu, eine
Zeitgrenze bei Strg+K direkt nach Klick-Öffnen und Escape. Im Gesamtcheck aus Nacharbeit 16 war
derselbe Fall grün. Ursache ist ein Wettlauf im Produkt: Der Fenster-Zuhörer der Befehlspalette las die
Modalsperre aus seinem letzten Effekt. Nach dem Schließen blieb sie bis zum nächsten Rendern wahr, und
das Kürzel wurde verworfen. Behoben über `gesperrt()` an der Modalgrenze, gelesen am Stapel im
Augenblick des Ereignisses (`apps/web/src/app/ModalBoundaryContext.tsx`,
`apps/web/src/shell/CommandPalette.tsx`). Gegenprobe ist P3 in
`tests/dialog-bedienung/palette-und-studio-dialog-mounted.test.tsx`. Zeitgrenze und Browserfall sind
unverändert.

## Nacharbeit 20 — Kandidat `3707ad36`, gezielte Prüfung

`h1-funktionsinventar` lief grün (K-gehezu behoben), ebenso die gemounteten Palettenfälle samt P3 und
fünf von sechs Dateien der Modalgrenze. Rot war `tests/app/mega47-modale-flaechen-sammler.test.tsx`
mit sechs Fällen. Er stand schon vor dieser Änderung in der Rotliste (Abschnitt D) und hängt nicht an
ihr: Die Palette bekam keine Klasse und keinen Einbinder, und die Grenze bleibt `GrenzDialog`.
Ursachen sind Zugänge aus anderen Lieferungen:

| Befund | Einordnung |
|---|---|
| Einbinder `BibliothekFlaeche.tsx → <Modal>` | Anlagenmatrix R-0477/R-0082 über das gemeinsame `Modal`, eingetragen |
| Richtung B: `KlaraKuerzelAusfuehrung.tsx`, `KlaraSetup.tsx` (AA-04) | keine Fläche: liest nur die Sperre bzw. lässt Tab aus der Kürzelaufnahme heraus. Mit Grund in `WIRKUNG_OHNE_FLAECHE` und `NUR_B_BEGRUENDET` eingetragen |
| Modulfremde Klassenquellen 23 → 25 | `REASONER_ENTWURF_FLAECHE` (`lib/kiHerkunft.ts`) und `istAktiv` (`SprachSchalter.tsx`), beide ohne Vollfläche, namentlich eingetragen |
| Unaufgelöste Klassenbindungen 322 statt 226 | **offen, siehe Nacharbeit 21.** Die 96 Zugänge sind nicht einzeln gemessen; der Lauf meldete nur die Zahl. Die Meldung gibt jetzt jede Bindung mit Datei und Zeile aus. Der Sollwert bleibt 226, bis jeder Zugang beurteilt ist (auflösbar schreiben oder einzeln begründen) |

## Nacharbeit 21 — Kandidat `908eefbd`, Sammler der Modalflächen

`HISTORIE/nacharbeit-21/PRUEFUNG/modalflaechen-sammler.log`: 112 von 113 Fällen grün. Die fünf
Registerfälle aus Nacharbeit 20 sind damit behoben. Rot ist allein die Zählung der unaufgelösten
Klassenbindungen: Gemessen sind 322 statt des Sollwerts 226, jetzt mit der vollständigen Liste aus
Datei, Zeile und Ausdruck im Protokoll.

**Herkunft:** Der Sollwert 226 stammt aus `6b09800e9` (FE-001, 2026-09-29). Seitdem sind 8 650 Commits
mit 831 geänderten Dateien unter `apps/web/src` hinzugekommen. Dieser Auftrag hat keine der 322
Bindungen eingeführt. Die beiden Treffer in `ModalBoundaryContext.tsx` (`ModalRegion`, `GrenzDialog`
aus R-0909) und `CommandPalette.tsx:373` bestanden schon vorher. Durch die Änderung aus Nacharbeit 19
haben sie sich nur um einige Zeilen verschoben. Schon vor diesem Auftrag meldete der Fall 233 statt
226 (Vermerk R-0909 im Wächter). Eine gemessene Liste der damals 226 Bindungen gibt es nicht, deshalb
lassen sich die 96 Zugänge nicht einzeln einer Lieferung zuordnen.

**Zur Entscheidung vorgelegt, nicht selbst gewählt:** Die Regel des Wächters (JOB 1181/3267) verlangt,
neue Bindungen auflösbar zu schreiben oder einzeln zu begründen, statt den Sollwert anzuheben. Möglich
sind:
1. Die 96 Zugänge einzeln in den liefernden Bereichen auflösen oder begründen. Das sind fremde
   Produktflächen über viele Lieferungen.
2. Einen Basisabgleich ausdrücklich beschließen: den Sollwert durch die gemessene Liste ersetzen (je
   Datei und Ausdruck, ohne Zeilennummer), damit künftig jeder Zugang einzeln sichtbar wird.

Bis dahin bleiben Sollwert und roter Bericht unverändert.

## Nacharbeit 25 — Ursache der Klassenbindungen im Sucher

Bens Korrektur verlangt, die Fundstellen ursachenbezogen aufzulösen statt sie herauszunehmen. Die
322 Fundstellen aus `QUELLEN-HILFE-8346b2330514-KLASSENBINDUNGEN.json` zeigen eine gemeinsame
Ursache: Der überwiegende Teil war nur offen, weil ein Bezeichner in **Bedingungsstellung** als
mögliche Klassenquelle zählte, etwa `open ? "rotate-180" : ""`, `aktiv === r.id ? … : …`,
`gross ? … : …` (6× in `LiveWallValidiert.tsx`) oder `offen && "rotate-180"`. Der Wächter selbst
hielt das an über zwanzig Stellen als „offen bleibt allein die Entscheidung dazwischen“ fest. Eine
Bedingung kann aber nie Teil des Klassennamens werden.

Die Korrektur liegt im Sucher (`zerlege` in `klassenbindungen`): Die Bedingung von `?:`, die linke
Seite von `&&`, beide Seiten eines Vergleichs und der Teil hinter `!` werden weiter nachgeschlagen,
sodass Flächentext und modulfremde Quellen gleich bleiben. Sie zählen aber nicht mehr als offen.
Offen bleiben Zweige, Durchreichen (`className`), berechnete Zugriffe (`TON[zustand]`, Auflage aus
JOB 3267), Aufrufe und `||`/`??`. Dazu kommen zwei Kalibrierfälle mit Negativ-Zwillingen.

Die neue Zahl ist **nicht gemessen**. Der Sollwert 226 bleibt stehen, bis der nächste Lauf Zahl und
Liste ausgibt. Bleibt sie über 226, sind die übrigen Fundstellen echte Unbekannte und werden einzeln
behandelt. Liegt sie darunter, wird der gemessene, strengere Wert eingetragen.

## Nacharbeit 26 — gemessen am Kandidaten `e09f6e4c`

**Sammler:** 114 von 115 Fällen grün, darunter die neuen Kalibrierfälle. Gemessen sind **112** offene
Bindungen statt 322. Zwölf davon waren nur wegen eines Zweigs `undefined` offen, jede am Quelltext
nachgesehen: `KnowledgeNeighborhood.tsx:209`, `Belastbarkeit.tsx:47`, `PruefenKopf.tsx:130`,
`Ask.tsx:2421`, `Conflicts.tsx:308`, `Stufe2.tsx:1938/2430/2584/2587/2662/2665/3502`. `undefined`
trägt keine Klasse; der Sucher übergeht ihn jetzt, mit Kalibrierfall. Der Sollwert steht auf **100**
(112 − 12) und ist im Wächter je Gruppe begründet: Durchreiche, berechneter Name aus einer
Tönungstabelle, Aufruf. Die Zahl ist aus der gemessenen Liste gerechnet; der nächste Lauf bestätigt
sie oder widerlegt sie.

**Gesamtcheck** (`HISTORIE/nacharbeit-26/PRUEFUNG/gesamtcheck-r1329.log`, SHA-256 `3ee8cc83…`):
Exit 1 in der Stufe `test`. Rot sind 68 Browserfälle in 31 Dateien und 233 weitere Fälle in 137
Dateien (Nacharbeit 17: 106 + 266). Build, Lint, Architektur, Modalgrenze und Geheimnis-Scan sind
grün. Die vier UI-Smoke-Stufen wurden nicht erreicht. Die roten Dateien sind noch nicht je Ursache
eingeordnet; das ist der nächste Schritt.

## Nacharbeit 27 — Ursachen aus dem Gesamtcheck von `e09f6e4c` (erste Tranche)

Der Sammler der Modalflächen ist bestätigt: `HISTORIE/nacharbeit-27/…/modalflaechen-sammler-sollwert.log`
zeigt 115 von 115 Fällen grün, Sollwert 100. Aus dem Gesamtcheck von Nacharbeit 26 sind in dieser Runde
bearbeitet (statisch, Ergebnis im nächsten Lauf):

| Ursache | Dateien | Art |
|---|---|---|
| Entscheidung 16: Fixture ohne Stufe ist „ungeklärt" | `tests/wissensgraph-integration/buehne.ts` (`neuesKo` → ausdrücklich „intern"), `tests/wissenskreislauf/vorgang-am-draht.test.ts` | Prüferwartung nachgeführt; die vertraulichen Fälle nennen ihre Stufe weiter selbst |
| Startvertrag ohne zehn gelesene Werte | `services/app/src/start-vertrag.ts`, `env.demo.beispiel` (dazu `VAPID_*`) | Register: je Wert aus der lesenden Stelle eingetragen |
| Befund „ohne Startvertrag" geschlossen | `tests/security/rechte-schalter-inventar.test.ts` | Eintrag wie dort verlangt gestrichen |
| neuer Einstiegspunkt | `tests/demo-zugang-start/vertrag-am-einstiegspunkt.test.ts` | `tools/datenintegritaet.ts` mit Begründung ins Inventar |
| Schalter `vorfuehrung` ohne Leser im Register | `tests/funktionsschalter/schalter-leser.test.ts` | Leser `AuthScreens.tsx` eingetragen |
| Navigationseintrag `ablauf` ohne Stichwort | `apps/web/src/components/einstellungen/rollenFreiheiten.ts` | Produkt: Stichwort „Erfassen" (Unterweg, kein eigenes Recht) |
| Detailkarten ohne Weg aus der Übersicht | `apps/web/src/lib/adminUebersicht.ts` | Produkt: Wege zu `kiReferenz` und `uebersetzungen` (ADMIN-01 K1) |
| Sprachliste nicht mehr als Literal im Profil | `tests/app/units-and-lang-d7.test.ts` | Prüfung auf das eine Sprachregister umgestellt, DE/EN/NL weiter verlangt |
| Detailkarten ohne Sprachfall | `tests/design/h6-detail-zustandsweg.test.ts` | Zusatzorte `detail-ki-referenz` und `detail-assistenz` |
| Nutzlast `PgUserRepo.update` mit Spalte `freigabe` | `tests/auth/job2413-nutzlast-user-update.test.ts` | 14 Parameter, eigener Wert und Zuordnungsprobe für `freigabe` |
| drei Kontovorgänge ohne Namen | `apps/web/src/lib/adminForms.ts`, `woerterbuch/de|en|nl.ts` | Produkt: Aktionen samt Namen in DE/EN/NL |

**Fremd zugeordnet** (unverändert seit Nacharbeit 8 bzw. 17, nicht aus diesem Auftrag):
- `klara-dokumenttext/riegel-haelt-den-dokumenttext` (11 Fälle): Die Anfragen senden
  `mode: "retrieval-only"` und erwarten trotzdem einen Modellaufruf. Das betrifft den Klara-Ausführungsweg
  einer anderen Lieferung und ist seit Nacharbeit 8 unverändert rot.
- `h6-detail-zustandsweg` S-inhalt-en/nl: Das deutsche „Entwürfe" in `detail-datenschutz` kommt aus dem
  servergelieferten Verarbeitungsverzeichnis (Datenart-Namen nur deutsch); seit Nacharbeit 17 rot.
  Die Übersetzungsschlüssel der Oberfläche sind vorhanden.
- `h6-detail-zustandsweg` V: vier neue Abfragequellen (`verantwortungApi.uebersicht`,
  `useValidationOverview`, `useAudit`) brauchen je einen gemessenen 503-Fall in der Matrix. Noch offen.
- `ask-caption-retrieval` Fall 1: Der Nachbarfall mit demselben ungestuften Objekt ist grün; der reine
  Fußnoten-Treffer bleibt aus. Das betrifft die Suche, nicht die Sichtbarkeit.

Alle übrigen roten Dateien aus dem Lauf von Nacharbeit 26 sind weiterhin offen.

## Nacharbeit 28 — Ergebnis der Tranche und die beiden Restbefunde

`HISTORIE/nacharbeit-28/PRUEFUNG/gesamtcheck-tranche1-gegenproben.log`: 18 von 19 Dateien grün, 154 von
155 Fällen. Damit sind belegt behoben: `rechte-am-draht`, `vorgang-am-draht`, der Startvertrag
(`env-beispiel`, `vertrag-vollstaendig`, `vertrag-am-einstiegspunkt`), `schalter-leser`,
`h6-rollenfreiheiten`, `admin-uebersicht`, `units-and-lang-d7`, `job2413` und
`admin-audit-verstaendlich`. Die Sprachfälle `detail-ki-referenz` und `detail-assistenz` (S-inhalt-V)
sind ebenfalls grün. In dieser Runde bearbeitet:

| Befund | Ursache | Behebung |
|---|---|---|
| `netz-verknuepfungszahlen` L3 | Fixture ohne Stufe (Entscheidung 16) | `koMitThema` setzt wie `neuesKo` ausdrücklich „intern" |
| `h6-detail-zustandsweg` S-inhalt-en/nl | **Produktlücke:** Die Datenschutz-Karte zeigte die Datenart-Namen aus `dateninventar.ts` (nur deutsch) | Namen je Kennung in DE/EN/NL (`texte/datenschutz.ts`, `datenschutz.datenart.<id>`), Anzeige in der Oberflächensprache mit dem Servernamen als Rückfall (`components/datenschutz/Verwaltung.tsx`). Gegenprobe in `tests/betroffenenrechte/dateninventar.test.ts`: jede Datenart hat drei Namen, der deutsche zeichengleich zum Server, und kein Name ist ohne Datenart |
| `h6-detail-zustandsweg` V | vier Quellen späterer Lieferungen ohne Matrixfall; dazu **Produktlücke:** Die Prüfaufträge je Person (R-0756) verschwanden bei einem Ausfall still | Produkt: die Fläche trägt die gemeinsame Abfragehülle (`Admin.tsx`, `huelle-pruefauftraege`). Matrix: tragender Fall `/api/validation/overview` und zwei nachrangige Fälle der Nutzerkarte (`/api/verantwortung/uebersicht`, `/api/audit`) samt Pfadzuordnung |

**Nacharbeit 29:** Die Unit-Gegenproben sind grün (2 von 2 Dateien, 22 Fälle: L3 und die
Datenart-Namen). Der Browserlauf von `h6-detail-zustandsweg` kam nicht zustande: Zwei Aufrufe des
einstelligen Helfers `t` mit Werten (Zeilen 417 und 420, meine Änderung) brachen die Typprüfung ab,
ohne `apps/web/dist` scheiterte jeder Fall. Beide Stellen nutzen jetzt `i18n.t` wie Zeile 257.

**Nacharbeit 30:** `h6-detail-zustandsweg` im Browser: 125 von 127 Fällen grün. Belegt sind damit
S-inhalt-en/nl (übersetzte Datenart-Namen), V (Vollzähligkeit), der tragende Fall `/api/validation/overview`
und die beiden nachrangigen Fälle der Nutzerkarte. Rot waren nur Z und R für die Prüfaufträge: Deren
Öffner `OEFFNE_ROH` klickte immer eine Zeile und kannte die Fläche ohne Zeile nicht. Bis dahin war die
einzige Fläche ohne Zeile auch ohne Hülle und kam in Z/R nicht vor. Der Öffner unterscheidet jetzt wie
`OEFFNE_UND_LIES`.

## Nacharbeit 31 — zweite Tranche (Platzhalter, Funktionsinventar, Klara)

Die H6-Matrix ist in Nacharbeit 31 vollständig grün. Aus dem Gesamtcheck von Nacharbeit 26 sind
bearbeitet:

| Datei | Ursache | Art |
|---|---|---|
| `bibliothek-mehr-platzhalter` (P1–P4) | Zwei neue Felder unter „Mehr": Fachgebiet (R-0034/R-0465, Abschnitt `provenienz`) und Anlagenliste (R-0082, vor dem Kopplungsfeld). Dazu steht die Diskussion jetzt vor der Kopplung. Gemessen sind 10 Platzhalter | Sollwerttabelle auf zehn Zeilen in Dokumentreihenfolge. Die Ausnahme „Anlagenkennung statt Platzhalter" gilt nur noch für das Kopplungsfeld selbst, gesucht über Schlüssel und Rang statt über die erste Zeile des Abschnitts |
| `h4-funktionsinventar` F19b | „Output-Eignung" und „IP-Sensitivität" stehen nur noch im Zweig ohne Frische-Auskunft | durch die heutigen Zeilen derselben Aussagen ersetzt: „In erzeugte Dokumente", „Schutzbedarf" |
| `mega69-klara-merkmale` M1 | Seit R-0700 ist der Frage-Körper eine Verzweigung nach Klara-Sitzung; das Muster sah nur `JSON.stringify({` | Muster strenger: JEDER Frage-Körper trägt `mode: "retrieval-only"`. Neuer Kalibrierfall K1b für den zweiten Zweig. Die Zusage selbst gilt unverändert (`taskpane.js:602`) |
| `klara-dokumenttext/riegel-haelt-den-dokumenttext` (11) | R-0278 (aus main): auch mit Einwilligung nur Freigegebenes als Grundlage; der Fixture-Eintrag war ungeprüft, das Modell wurde deshalb nie gerufen | Eintrag freigegeben wie in `ka4-einwilligung-wirkt` F8b. Damit zurückgenommen ist die Einordnung „fremd, retrieval-only" aus Nacharbeit 27 |
| `admin-ki-freigabe/word-dokumenttext-vertraulich` W1/W2 | dieselbe Ursache | dieselbe Nachführung |

V2-Prüfaufbau technisch nachgeführt (Hilfe 93dbcd8943e6): Der ausgeschnittene Panelcode
erhält den echten `askAbsaetzeLesen` samt `stripAskAnswerMarkdown`. Die Kalibrierung prüft
belegte, fremd belegte und unbelegte Absätze; die Anzeige entfernt Fußnotenmarken und erhält
die Quelle separat. Lokale synthetische Prüfung: 10/10 bestanden, Beleg
`HILFE-93dbcd8943e6-V2-NACH-KORREKTUR.json` im Auftragsordner. Kein Gesamtcheckabschluss.

Stand danach siehe „Nacharbeit 34“: ask-caption-retrieval, `ka5/*` und suchguete-drift sind bearbeitet,
`k1-funktionsinventar` wird neu gemessen.

Benannt, nicht geändert: Die Nutzerkarte (ADMIN-04) lädt mit `useAudit` wieder die unbeschränkte
Gesamtliste `/api/audit`, die admin-audit-verstaendlich abgelöst hatte. Das ist eine fremde Lieferung
und eine Leistungsfrage, kein Rotfall dieses Auftrags.

## Nacharbeit 32 — die letzten vier Klara-Dokumenttextfälle

Gemessen am Kandidaten e42dca30: mega69, word-dokumenttext-vertraulich und die Flächen-Suite
(Platzhalter, H4) sind grün. Von klara-dokumenttext sind 31 der 35 Fälle grün. Rot sind R5d, R5e,
R7b und R7f, jeweils weil kein Modellaufruf stattfand. Gemeinsame Ursache ist R-0473 (aus main):
Eine Quelle muss jeden gebundenen Fragebegriff führen, und ohne Fragesatz bleibt die ganze
Eingabe gebunden.

| Fall | Ursache | Art |
|---|---|---|
| R5d, R7b, R7f | Die Markierung selbst ist die Frage. Ihre Begriffe „Entwurf", „Drehmoment", „anziehen" … standen in keiner Quelle, deshalb gab es keine Grundlage. Die Fälle verlangen aber ausdrücklich, dass die Markierung ALS FRAGE den Eintrag findet | Nachführung am Prüfstand: Der Eintrag führt diese Begriffe als Schlagwörter. Die Schlagwörter werden durchsucht, gehen aber nicht in den Prompt; der MARKER kann dort weiter nur aus der Markierung kommen |
| R5e und R5d (Zuruf) | Produktfehler. `ka6Absenden` schickt den Zurufrahmen („Formuliere diesen Text klarer:") im selben Satz wie die Frage. Seit R-0473 werden „formulier", „klarer" … gebunden, und jeder Zuruf endete ohne Grundlage. Der Prüfstand übergab dazu den Schlüssel statt des Wortlauts | `services/reasoner/src/provider.ts`, `sachtoken`: Die neun wörtlich ausgelieferten Rahmen (de/en/nl) werden am Anfang abgetrennt; der Rest läuft durch dieselbe Regel. Der Prüfstand nimmt den deutschen Wortlaut aus dem Fenster. Neu ist R5f: Jeder `ka6Auftrag*`-Wortlaut bindet nichts, ein bloß ähnlicher Satz bindet weiter |

Kein Sollwert ist geändert und keine Gegenprobe gestrichen. Die Bindungsregel bleibt für jede andere
Eingabe gleich: Die Rahmen werden wörtlich verglichen, ohne zweite Kleinschreibung
(`mega54-eine-zerlegung-sammler`).

## Nacharbeit 33 — Sammler „eine Zerlegung“

`mega54-eine-zerlegung-sammler` war schon im Gesamtcheck von Nacharbeit 26 rot. Die Nachmessung am
Kandidaten e73d3904 zeigt dieselbe Ursache, unabhängig von Nacharbeit 32: `woerter` in
`services/ask/src/aussage-fundstellen.ts` (REF-01) ist eine dritte Zerlegung im Antwortweg. Geprüft
statt hingenommen:

- Sie bindet nach der Antwort Aussagen an Fundstellen, rechnet nur und sendet nichts.
- Sie speist weder Vorauswahl noch Ranking.
- Wie `zitatWoerter` muss sie jedes Wort behalten (Zahlen, „nicht“, „QX“), und genau diese Wörter
  wirft `tokenize` weg.

Der Pin nennt sie deshalb namentlich wie in JOB 2659. Neu sichert er zu, dass sie modulprivat
bleibt, also nicht exportiert wird. Eine vierte Zerlegung rötet weiterhin.

## Nacharbeit 34 — V2-Prüfaufbau und die Such-Rotfälle aus Nacharbeit 26

**V2 (`klara-freigabe/v2-einwilligung-ende-zu-ende`), Bens Befund:** Die Ursache war ein Fehler im
Prüfaufbau, kein Produktfehler und keine Zugangsblockade. Der ausgeschnittene `performAsk` ruft im
Erfolgszweig `askAbsaetzeLesen` (`taskpane.js:645`), und die Testumgebung stellte den Helfer nicht
bereit. Die Antwort endete deshalb als `error`; V2-E1u hatte genau das als erwarteten Fehler
festgeschrieben.

Jetzt schneidet der Aufbau den echten Helfer samt seiner einzigen Abhängigkeit
`stripAskAnswerMarkdown` mit aus (`taskpane.js:458–486`), ohne Identitätsattrappe. V2-E1u ist eine
Kalibrierung mit beiden Seiten:

- positiv: Server und Panel antworten, ein tragend belegter Absatz bleibt, ohne Marke und Markdown;
- negativ: ein fremd belegter und ein unbelegter Absatz fallen weg; leere Tragmenge ergibt `[]`;
  ein fehlendes Feld ergibt `undefined`.

Zustimmungs-, Anbieterbeleg-, Ablauf- und Policyfälle (E1–E6) sind unverändert.

**Such-Rotfälle:**

| Fall | Ursache | Art |
|---|---|---|
| `ask-caption-retrieval` (Nur-Fußnote) | R-0473: Die Fußnote sagte „nachziehen“, die Frage „nachgezogen“. Der Begriff war gebunden und fehlte, also kein Kandidat. Der Nachbarfall mit „nachgezogen“ in der Aussage ist grün | Prüfstand: Die Fußnote trägt dieselbe Wortform. Gemessen bleibt der Nur-Fußnoten-Treffer samt Kennzeichnung |
| `ka5/markierung-fundstelle-bleibt` R12 | dieselbe Ursache („nachstellen“ gegen „nachgestellt“; R10 mit „nachgestellt“ ist grün) | dieselbe Nachführung |
| `ka5/markierung-kein-egress` R3 | R-0473 prüft gebundene Begriffe auch an `category`/`tags`. Der Doppelgänger führte das Schlagwort unter dem Eigennamen `schlagwoerter`, den das Produkt nicht kennt; ko-a fiel heraus | Prüfstand: Der Doppelgänger führt das echte Feld `tags`. Die Asymmetrie (auffindbar, nicht relevanzbildend) bleibt |
| `suchguete-drift` G2 (K-T7), C1, C2 | Produkt: „Wann ist die Wartung am Ventil fällig?“ band seit R-0473 „fällig“; die Quelle nennt den Zeitpunkt („erfolgt jährlich“). Der Grundlinienwächter hat einen echten Rückgang gemeldet. C1 und C2 rötete nur der zusätzliche K-T7-Befund | `provider.ts`: „fällig“ ins Fragegerüst, belegt an K-T7 wie „hoch“/„many“. Gegenprobe in `und-verknuepfung-fragedienst`: „fällig“ bindet nicht, „Wartung“ und „Ventil“ bleiben gebunden. Grundlinie und Fälle unverändert |
| `k1-funktionsinventar` (7 Lagen) | Nicht zugeordnet. Die Elemente existieren alle im Fenster. Der Aufbau legt die Objekte offen eingestuft und freigegeben an (Entscheidung 16 und R-0278 scheiden aus). Statisch fand sich kein gemeinsamer Abbruch | Frische Messung am aktuellen Kandidaten, danach Ursachenarbeit am Ergebnis. Die sieben Fälle liegen auf einer Fensterseite hintereinander, ab `frageLaeuft`; ein Folgefehler ist möglich, aber nicht belegt |

Weiter offen aus Nacharbeit 26: die Register- und Wächterfälle (`http-api-referenz`,
`beta-rollenabnahme`, `route-guard-audit`, `mega74`, `aufrufer-waechter`,
`ki-anbieterwahl/routing-zwei-attrappen` F1, `typrein-schreibwege` T4) und die übrigen Einzelfälle des Laufs.

## Nacharbeit 35 — K1: die Antwort-Attrappe am falschen Zugang

Gemessen am Kandidaten 4d92fab8: Die Unit-Suite aus Nacharbeit 34 (V2, caption-retrieval, KA5,
Suchgüte, Fragegerüst) ist ohne Rotfall. K1 zeigt dieselben sieben Lagen wie Nacharbeit 26, also
reproduzierbar.

**Ursache, im Prüfstand:** Seit R-0700 (KW-S4-24) fragt das Fenster mit Klara-Sitzung über
`/api/klara/sessions/{id}/execute`, ohne Sitzung über `/api/ask` (`performAsk`). Auch die
Browserfläche eröffnet ihre Sitzung am echten Server (`klaraS4StartAnfordern` nach der
Office-Frist). Die Attrappe `ASK_URL` (`tests/design/k1-messung.ts`) stand nur auf `/api/ask` und
griff deshalb nie; statt der gestellten Lage kam die echte Antwort. Das erklärt alle sieben Fälle:

- frageLaeuft: Der Kreisel stand nur kurz, `stellen` sah ihn, die Prüfung 100 ms später nicht mehr.
- frageFehler: Der Abbruch wurde nie gestellt, deshalb kein „Erneut versuchen“ und der Timeout.
- langeAntwort, kiKennzeichnung, mehrQuellen, ausschnitt: Die echte kurze Antwort kam, ohne
  Kennzeichnung, mit einer Quelle und ohne Ausschnitt.

Kein Produktfehler: Beide Zugänge sind gewollt. Dieselbe Ursache hat `zielbild-k1-antwort` Z1–Z3
(Nacharbeit 26 rot), das dieselbe Attrappe nutzt.

**Nachführung:** `ASK_URL` trifft beide Zugänge, mit demselben Antwortkörper. Neu ist S2: Das
Muster trifft `/api/ask` und `…/execute`, aber nicht Sitzung anlegen, Zustimmung, KI-Status oder
Objektabruf. Inventarzeilen, Sichtbarkeitsprüfung, Mutation und Zeitgrenzen sind unverändert.

## Nacharbeit 36 — Register- und Wächterfälle, erste Tranche

Gemessen am Kandidaten 07425f3a: `k1-funktionsinventar` mit 63 von 63 grün. Bearbeitet sind jetzt
die Register- und Wächterfälle aus Nacharbeit 26. Allen gemeinsam: Spätere Lieferungen aus main
haben Routen, Exporte, Umwandlungen und Modellwege eingeführt, ohne die Register nachzuziehen.
Ein Eintrag ist je Wächter eine fachliche Prüfung, kein Abschreiben. Deshalb geht die Arbeit hier
Eintrag für Eintrag.

| Wächter | Befund (Nacharbeit 26) | Stand |
|---|---|---|
| `typrein-schreibwege` T4 | 9 neue Doppelumwandlungen in `services` | **bearbeitet.** Acht sind geprüft und mit Begründung eingetragen (Node-Zeitgeber, `fetch`, `https`-Server, `pg`-Client für die lesende Vorschau, Lesefeld, geprüfte Auditnutzlast, gekürzte Lückenkopie). Die neunte, `kommunikationsregeln.ts:957`, umging den Typprüfer an einem **Schreibweg** (Regeländerung der Verwaltung). Sie ist vermieden statt eingetragen: `setzeFeld` weist typrein zu, mit derselben Regel und derselben Absage wie `feldWert`. Gegenprobe: `tests/kommunikationsregeln/regeln-am-server.test.ts` (Änderungsweg, nicht einstellbare Felder, Mail nur sofort) |
| `aufrufer-waechter` A3 | `pruefeValidationDecisionRef` steht als offener Rest, hat aber einen Aufrufer | **bearbeitet.** Aufrufer ist `services/output/src/pruefnachweis.ts:34`; der Eintrag ist mit Begründung gestrichen |
| `aufrufer-waechter` A1 | 49 Exporte ohne Nicht-Test-Aufrufer (u. a. `supportzugang-vertrag.ts` ×14, `klara-vorschau/*`, `assistenz-faehigkeiten.ts`, `schriftskala.ts`) | **offen.** Je Export ist zu entscheiden: verdrahten, `BEWUSST` mit Grund, `OFFENER_REST` mit Beleg und Entscheider, oder entfernen. Das braucht die Kenntnis der jeweiligen Lieferung |
| `ki-anbieterwahl/routing-zwei-attrappen` F1/F2/F4/F6 | 19 Dateien benutzen den Freigabe-Helfer ohne Registereintrag; 7 setzen die Freigabefelder von Hand; mega61 #7 ohne den geführten Aufruf; 3 Modellwege ohne Register | **offen.** Je Datei braucht es Grund und Fallakte (Erwartungsboden und Freigabeaufrufe je Fall); F2 verlangt den Umbau der 7 Testaufbauten auf den Helfer |
| `http-api-referenz` A2/A4 | 189 registrierte Routen ohne Referenzzeile | **offen.** Je Zeile Recht, Eingaben, Erfolg und Fehler aus dem Routencode |
| `beta-rollenabnahme`, `route-guard-audit`, `mega74-lesewege-sammler` | dieselben neuen Routen ohne Abnahmezeile, Schutzart bzw. Lesewegurteil | **offen.** Sicherheitsurteile je Route; dieselbe Routenmenge wie oben |
| `re-import-dubletten/port-aufrufer-waechter`, `ki-freigaberegeln/ausgehende-ziele` | Erhebung bzw. Zielliste weicht ab | **offen**, noch nicht eingegrenzt |

Ob ein offener Eintrag auf diese Lieferung oder auf eine fremde Basislieferung zurückgeht, ist ohne
Versionsverlauf nicht je Eintrag belegbar: `git log` war in dieser Umgebung nicht freigegeben. Die
genannten Routen und Exporte gehören nach ihren Dateien zu anderen Aufträgen (Spaces, Vorlagen,
Chat, Teams, WOPI, Klara-Gespräche, Supportzugang, Referenz-KI, Zweitmeinung). Dieser Auftrag hat
dort keinen Produktcode geschrieben.

## Nacharbeit 37 — Aufrufer-Wächter A1, Export für Export

Gemessen am Kandidaten d61e0ecf: T4 und die Kommunikationsregeln sind grün, im Aufrufer-Wächter
ist A3 grün. A1 meldet die erwarteten 49 Exporte. Jeder ist am Code geprüft; eingetragen ist nur,
was der Code selbst belegt:

- **`OFFENER_REST`, Sperre, 13 Exporte:** `supportzugang-vertrag.ts` ganz.
  - Beleg: „Konzept jetzt, Betreiber nach dem PoC … nirgends an `build-app.ts` angeschlossen“,
    `zugangAktiv: false`, `docs/operations/begrenzter-support.md`.
  - Entscheider: Peter, mit der Benennung des Betreibers.
- **`BEWUSST`, 2 Exporte:** `inventarTabellen`, `assistenzTabellen`. Beide sind Prüfgrundlagen,
  deren einzige Leser die Driftwächter Inventar–Migration und Drill–Umfang sind.
- **`BEWUSST_WEB`, 8 Exporte:**
  - Rücksetzer, die laut eigenem Kommentar nur Tests dienen: `zuruecksetzenGanz`,
    `vergissAngelegteSprachen`, `rechtekontextZuruecksetzen`.
  - Autoritative Listen ihrer Wächter: `ZIELBILD_HERKUNFT`, `PROJEKTIONS_STUFEN`,
    `PROJEKTIONS_DATEIEN`, `FEHLER_ARTEN`.
  - Eine Doppelform für maschinenunabhängige Prüfungen: `kuerzelFormen`.

**Offen, 26 Exporte.** Hier ist zu entscheiden, ob verdrahtet oder entfernt wird; das ist eine
Entscheidung in der jeweiligen fremden Lieferung:

- **Nie montierte Oberflächen:**
  - `AuftraegeJePerson` (R-0756; montiert ist nur `PruefdauerJeWeg`)
  - `Wissensuebergabe` (R-0554/R-2128; montiert ist nur `UebergabeVorschauInhalt`)
- **Dokumentierter, aber nicht gelegter Anschluss:**
  - `TELEFON_LESE_QUERY` („die Lesefläche liest damit …“)
  - `setzeAssistenzProfil` („Anschluss für die kontobezogene Auswahl“ der PoC-Aufträge, deren
    Kennung hier nicht belegt ist)
  - `vergissAusfuehrungen` („für Tests und das Ende der Vorschau“; das Vorschauende ruft ihn nicht)
  - `InMemoryFaehigkeitsAblage` („für Tests und den Speicherbetrieb“)
  - `auswahlVomEditor` (bewusst `null`, Naht ohne Aufrufer)
- **Produktlogik ohne Produktleser:**
  - `lagebild.ts` `reifegrad` und `quote`
  - `LEERER_FILTER`, `hatFiktiveBeispiele`, `nameDerAngelegtenSprache`, `bildStatusSchluessel`,
    `officeBildEingang`
  - `klara-vorschau` `leseAusfuehrungen` und `laeuft`
  - `nimmSkillDateiAuf`, `perplexitySuchAdapter`, `normalisiereText`, `officeEndung`,
    `SpeicherWopiSitzungen`, `paarpflichtAussagenLaden`, `KEINE_VORGABE`, `bestaetigungGilt`,
    `embeddingArt`, `excerptFoundInDocument`

Keiner dieser Exporte liegt in einer Datei, deren Funktion dieser Auftrag gebaut hat. Wer sie als
„bewusst“ einträgt, ohne die Lieferung zu kennen, schreibt genau den stillen Altbestand, gegen den
R-1349 steht.

## Nacharbeit 38 — Aufrufer-Wächter A1: begründet entfernt

Gemessen am Kandidaten 26dc38de: A1 meldet genau die 26 vorhergesagten Exporte, die 23 Einträge
aus Nacharbeit 37 tragen. Nach R-1349 („angeschlossen oder begründet entfernt“) sind jetzt neun
Exporte **entfernt**, jeder mit Beleg, dass seine Aufgabe an anderer Stelle erledigt ist oder er
nie einen Leser hatte:

| Export | Beleg | Folge |
|---|---|---|
| `BildBefundListe.tsx::bildStatusSchluessel` | Zugriff auf `STATUS_SCHLUESSEL`; die Komponente liest die Tabelle direkt (Zeile 179) | nur die Hülle entfällt |
| `klara-vorschau/auftrag.ts::leseAusfuehrungen` | wortgleich mit dem internen `leseListe` | – |
| `klara-vorschau/auftrag.ts::vergissAusfuehrungen` | das Vergessen bei Konto- oder Sitzungsende erledigt der Hook `beimVergessen` (Zeile 248). Fürs Vorschauende gilt die dokumentierte Entscheidung `nachVorschauEnde`: persönliche Arbeit bleibt | – |
| `klara-vorschau/echt.ts::laeuft` | ohne Leser, auch in keinem Test | – |
| `instanzSprachen.ts::nameDerAngelegtenSprache` | `SprachSchalter.tsx:89` führt dieselbe Suche aus | – |
| `useMediaQuery.ts::TELEFON_LESE_QUERY` | die Telefonregel N-0037 ist „ohne eine zweite, breitenabhängige Stelle“ erfüllt (`BibliothekLesen.tsx`, `tests/bibliothek-schmal/telefon-chromium.test.ts` C7) | Grabstein im Kommentar |
| `office-artikel.ts::officeEndung` | Einzeiler-Hülle um `officeFormatFuer`, ohne Leser | Import entfällt mit |
| `gemeinsamer-entwurf.ts::normalisiereText` | Einzeiler-Hülle um `abschnitte`, ohne Leser | – |
| `AuftraegeJePerson.tsx::AuftraegeJePerson` | „die Zahlen je Person stehen in der Auswertung in der EINEN Darstellung `PersonenZeilen` … hier keine zweite Tabelle“ (`Analytics.tsx:484`); der Adminbereich nutzt `auftraegeJePerson` direkt | die zwei reinen Komponentenfälle P2/P3 in `tests/pruefer-zuweisung/vorschlag-und-personen-mounted.test.tsx` entfallen mit (Muster aus R-1349 Nacharbeit 10). Die sichtbaren Orte messen `tests/analytics/kennzahlen-uebersicht-mounted.test.tsx` und `tests/analytics/kapital-pruefaufgaben-mounted.test.tsx`; P1 misst die Ableitung weiter |

**Folge für mega84:** Der Komponenten-Sammler zählt eine Komponente weniger. Sein Pin (637)
weicht schon seit Nacharbeit 26 ab: gemessen wurden dort 810 Komponenten aus späteren
Basislieferungen. Der Pin folgt der nächsten Messung, nicht einer Rechnung.

**Weiter offen, 17 Exporte**, je mit Test, aber ohne Produktleser:
- `Wissensuebergabe`: laut ADMIN-05 durch `UebergabeAblauf` ersetzt. Der Abgleich der
  R-0554-Zusagen Ü1–Ü4 mit dem neuen Einstieg steht aus; ohne ihn würde das Entfernen Abdeckung
  kosten.
- `excerptFoundInDocument` (G-2-Gate, PMO-FEA-0006): der Kommentar in `attach-policy.ts` nennt
  den Anschluss einen eigenen Vorgang.
- `setzeAssistenzProfil`, `InMemoryFaehigkeitsAblage`, `SpeicherWopiSitzungen`,
  `perplexitySuchAdapter`, `nimmSkillDateiAuf`, `paarpflichtAussagenLaden`, `KEINE_VORGABE`,
  `bestaetigungGilt`, `embeddingArt`, `officeBildEingang`, `auswahlVomEditor`, `LEERER_FILTER`,
  `hatFiktiveBeispiele`, `lagebild.ts` `reifegrad`/`quote`.

Für jeden davon ist zu entscheiden, ob verdrahtet wird oder ob er samt Test entfällt.

## Nacharbeit 39 — mega84-Sammler und Aufrufer-Wächter, weitere Tranche

Gemessen am Kandidaten 8b5c3d68: Die neun Entfernungen aus Nacharbeit 38 tragen. A1 meldet die
17 offenen Exporte, mega84 misst 809 Komponenten (810 − `AuftraegeJePerson`).

**mega84 (`tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx`):**
- **STUFE-1-INVARIANZ:** Der Komponenten-Pin folgt der Messung, 637 → 809. Begründet ist das mit den
  wörtlichen Messungen aus Nacharbeit 26 (810) und 39 (809) und der einen benannten Entfernung.
  `anbieter` 1 und `traeger` 2 sind unverändert.
- **FAIL-CLOSED:** Die seit Nacharbeit 26 undisponierte Einbindung in `GemeinsamerEntwurf.tsx` ist
  angesehen und disponiert. Der Editor steht unter einem eigenen `ImageDescribeProvider` mit Stufe
  und Kennung dieses Artikels (fehlt die Stufe: vertraulich). Galerie und Titelübernahme gibt es
  dort nicht, weil die Seite beides nicht führt.

**Aufrufer-Wächter A1, weitere sechs Exporte erledigt:**

| Export | Art | Beleg |
|---|---|---|
| `provider-model.ts::excerptFoundInDocument` | entfernt | Wahrheitswert-Hülle um `findExcerptInDocument`; das Produkt ruft das Gate selbst (`parseExtractResponse`). Die G-2-Tests in `extract.test.ts` und `extract-failure.test.ts` messen jetzt das Gate unmittelbar, mit gleicher Aussage (`null` statt `false`) |
| `qualitaetsaufgaben.ts::LEERER_FILTER` | in den Test verschoben | reines Vergleichsobjekt von `filter-und-zaehler.test.ts`; das Produkt bildet die leere Wahl über `filterAusAdresse` |
| `vorlagen.ts::KEINE_VORGABE` | in den Test verschoben | reines Ausgangsobjekt von `vorlagen-struktur.test.ts` |
| `fragenEinstieg.ts::hatFiktiveBeispiele` | entfernt | die Fläche kennzeichnet je Chip (`Ask.tsx`, `beispielIstFiktiv`); der Test sagt dasselbe mit `some(beispielIstFiktiv)` |
| `lagebild.ts::reifegrad`, `quote` | `OFFENER_REST` | Entscheidung 50 (P13): kein Reifegrad ohne Belege je Arbeitsweg; „die Belege entstehen in der PoC-Messung“ (`docs/entscheidungen/p13-lagebild-wissenskapital.md`) |

**Weiter offen, 11 Exporte.** Hier ist eine Anschluss- oder Abbauentscheidung der jeweiligen
Lieferung nötig:
- **`setzeAssistenzProfil`:** Der Kontoname kommt geliefert über `lib/assistenzProfil.ts`. Dieser
  Rückfallweg wird im Produkt nie gesetzt, die Lieferung `assistenz-produkteinstieg` lässt ihn laut
  Kommentar bewusst angeschlossen. Die Tests nutzen ihn.
- **`Wissensuebergabe`:** Der Abgleich der Zusagen Ü1–Ü4 mit `UebergabeAblauf` steht aus.
- **`embeddingArt`:** AW-12 verlangt die Kennzeichnung, angezeigt wird sie nirgends.
- **Ohne Produktleser:** `officeBildEingang`, `auswahlVomEditor`, `InMemoryFaehigkeitsAblage`,
  `nimmSkillDateiAuf`, `perplexitySuchAdapter`, `SpeicherWopiSitzungen`,
  `paarpflichtAussagenLaden`, `bestaetigungGilt`.

## Nacharbeit 40 — Aufrufer-Wächter A1, sieben weitere Exporte

Gemessen am Kandidaten 13b7c56d: mega84 ist grün (Pin 809, Disposition GemeinsamerEntwurf). A1
meldet die 11 vorhergesagten Exporte. Erledigt sind jetzt sieben:

| Export | Art | Beleg |
|---|---|---|
| `office-wopi-host.ts::SpeicherWopiSitzungen` | `BEWUSST` | Speicherdoppel der isolierten Hostprobe. Das Produkt reicht die `OfficeAblage` herein (`office-routes.ts`, `hostAblage`). Der Kopfkommentar, der eine künftige Postgres-Ablage ankündigte, ist berichtigt |
| `assistenz-faehigkeiten.ts::InMemoryFaehigkeitsAblage` | `BEWUSST` | Das Produkt nutzt in jedem Betrieb `ProfilFaehigkeitsAblage` (`baueFaehigkeiten`); der Kommentar „und den Speicherbetrieb“ ist berichtigt |
| `paarpflicht-aussagen.ts::paarpflichtAussagenLaden` | `BEWUSST` | lädt ohne Sichtbarkeit des Fragenden; der Produktweg lädt bewusst über `sichtbareAussagen`. Ein Produktaufruf wäre eine Umgehung |
| `assistenz-faehigkeiten.ts::perplexitySuchAdapter` | `OFFENER_REST` (Sperre) | O09 in `docs/operations/klara/faehigkeiten-skills-werkzeuge.md`: Anbieterfreigabe, Kosten, Budget und Zugangsweg fehlen; Produktvertrag „Nicht installiert“ |
| `aussage-fundstellen.ts::bestaetigungGilt` | entfernt | die Referenzprüfung hält dieselbe Regel strenger über ihren Cacheschlüssel (K8, `bestaetigung_abgelaufen`, gemessen in `pruefdienst-simulation.test.ts`). Der Testfall prüft jetzt den Paketfingerabdruck unmittelbar, mit gleichen Aussagen |
| `OfficeBildBefunde.tsx::officeBildEingang` | entfernt | Hülle um `officeBildQuelle`, die die Fläche ruft. `office-anhang.test.tsx` misst über einen gleichwertigen lokalen Zuschnitt `officeBildQuelle` |
| `officeEditor.ts::auswahlVomEditor` | **verdrahtet** | laut Kopf „die EINE Stelle, die das entscheidet“. Die Fläche (`OfficeImArtikel.tsx`) zeigte den Hinweis „Klara ohne Auswahl“ fest an. Jetzt fragt sie die Stelle je Editornachricht; der Hinweis steht, solange sie `null` liefert, und das ist heute immer der Fall. Sichtbar bleibt alles gleich; gemessen in `bausteine.test.ts` B6 und `tests-smoke/office-artikel-browser.spec.ts` |

**Weiter offen, 4 Exporte.** Nötig ist jeweils eine Entscheidung der Lieferung:
- `setzeAssistenzProfil`: ein Rückfallweg, den im Produkt niemand setzt; der Kontoname kommt über
  `lib/assistenzProfil.ts`.
- `Wissensuebergabe`: Der Einstieg `UebergabeAblauf` trägt Ü1, Ü2 und Ü4 (K2, K4 in
  `tests/uebergabe-ablauf/einstieg-mounted.test.tsx`). Für Ü3 („ein Wechsel des Nachfolgers
  verwirft die Vorschau“) gibt es dort keinen Fall; ohne ihn würde das Entfernen Abdeckung kosten.
- `nimmSkillDateiAuf`: Das Betriebsdokument sagt „SKILL.md wird nur als Ablage gelesen“, einen
  Produktweg dorthin gibt es nicht. Das ist eine Lücke von BPA-11.
- `embeddingArt`: AW-12 verlangt die Kennzeichnung, angezeigt wird sie nirgends.

## Nacharbeit 41 — Aufrufer-Wächter A1, die letzten vier

Gemessen am Kandidaten 1f5f8553: A1 meldet die vier vorhergesagten Exporte. Erledigt sind zwei:

- **`Wissensuebergabe`: entfernt, nachdem Ü3 am lebenden Weg ergänzt ist.**
  - Der Einstieg `UebergabeAblauf` verwirft die Vorschau bei jeder Planänderung (`planSetzen` →
    `setVorschau(null)`, Zeile 177: „ändert sich der Plan … verfällt sie“).
  - Neu ist der Fall „Ü3“ in `tests/uebergabe-ablauf/einstieg-mounted.test.tsx`: a1 nach der
    Vorschau von Nora auf Ada umgehängt, die Vorschau verfällt, die neue nennt Ada.
  - Ü1 und Ü4 stehen dort schon (K2, K4). Ü2, die Vorschaudarstellung, misst
    `tests/wissen-verantwortung/uebergabe-flaeche-mounted.test.tsx` jetzt an
    `UebergabeVorschauInhalt`, die weiter montiert ist (Konto entfernen). Dazu kommt der Leerfall.
  - `vorschauLeer` verliert sein `export` (nur noch intern).
  - **mega84-Pin 809 → 808, gerechnet:** genau diese eine Komponente. Die nächste Messung gilt.
- **`embeddingArt`: `BEWUSST`.** Die Kennzeichnung trägt jeder Vektor in seiner Version
  (`kundenbetrieb-betriebsmodelle.md` §2.2). Das Produkt vergleicht nur über die exakte Version;
  die Auslegung liest allein die Gegenprobe E4.

**Offen, 2 Exporte.** Beide sind Produktentscheidungen ihrer Lieferung, die ich nicht selbst
treffe:
- **`setzeAssistenzProfil` (assistenz-produkteinstieg):** Der Rückfallweg wird im Produkt nie
  gesetzt, weil der Kontoname geliefert über `lib/assistenzProfil.ts` kommt. Die Lieferung lässt
  ihn laut Kommentar (`KlaraVorschau.tsx`) bewusst angeschlossen, und mehrere Oberflächentests
  setzen ihn. Zu entscheiden ist, ob der Rückfall entfällt (samt Testumbau) oder angeschlossen wird.
- **`nimmSkillDateiAuf` (BPA-11):** Das Betriebsdokument sagt „SKILL.md wird nur als Ablage
  gelesen“, einen Einlesweg gibt es aber nicht. K4 belegt nur die Lesart. Zu entscheiden ist, ob ein
  Einlesweg gebaut wird oder der Baustein samt Testfall entfällt.

## Nacharbeit 42 — Aufrufer-Wächter A1: ein Rest bleibt eine Entscheidung

Gemessen am Kandidaten 4d71b9a3: A1 meldet die zwei vorhergesagten Exporte. Alle übrigen
Einträge, die Entfernungen und mega84 tragen.

- **`setzeAssistenzProfil`: `BEWUSST_WEB`.** Die Entscheidung ist getroffen und dokumentiert, nicht
  offen:
  - assistenz-produkteinstieg: „der Leseeinstieg `profil.ts` bleibt angeschlossen“
    (`KlaraVorschau.tsx`);
  - branchen-poc-arbeitswege: „den Leseeinstieg `profil.ts`, den im Produkt niemand setzt“
    (`LueckenVorgang.tsx`);
  - Rangfolge Kontoname → Leseeinstieg → neutral. Gesetzt wird der Einstieg nur von
    Oberflächentests.
- **`nimmSkillDateiAuf` (BPA-11): weiterhin offen. Entscheiden muss die Lieferung bzw. Peter.**
  - Der Baustein legt die einzige zulässige Lesart eines SKILL.md fest („Beschreibung ja,
    Ausführung nie“, G16/G17; gemessen in K4).
  - Einen Weg, auf dem ein SKILL.md ins Produkt gelangt, gibt es nicht. Das Betriebsdokument sagt
    dennoch im Präsens „wird nur als Ablage gelesen“.
  - Ob BPA-11 einen Einlesweg verlangt, lässt sich ohne den Originalauftrag nicht belegen.
  - Keine der drei Registerformen passt ohne diese Entscheidung:
    - `BEWUSST` behauptete, es gebe bewusst keinen Einlesweg.
    - `OFFENER_REST` verlangt eine belegte Sperre oder einen benannten `aufnahme:`-Auftrag.
    - Entfernen nähme der Lieferung ihre Lesart.
  - Die Entscheidung lautet: Einlesweg bauen (dann darüber), Lücke als gesonderten Auftrag benennen
    (dann `OFFENER_REST`) oder den Baustein samt K4-Teilfall entfernen.

## Nacharbeit 43 — der letzte Aufruferfund wartet auf eine Entscheidung

Gemessen am Kandidaten 028d90c9: A1 meldet genau `nimmSkillDateiAuf`. Der Eintrag für
`setzeAssistenzProfil` trägt.

Keine Änderung in dieser Runde, aus zwei belegten Gründen:
- Der Originalwortlaut von BPA-11 (`produkt:20261011:assistenz-skills-werkzeuge`) liegt nicht im
  Arbeitsbaum. Nur `docs/operations/klara/faehigkeiten-skills-werkzeuge.md` und dieses Inventar
  nennen BPA-11, G16/G17 steht nur im Code. Ob ein Einlesweg für SKILL.md verlangt ist, ist damit
  nicht belegbar. Das ist ein fehlendes Mittel, kein Produktfehler.
- Die drei Wege (Einlesweg bauen, gesonderten Auftrag benennen, Baustein samt K4-Teilfall
  entfernen) sind eine Produktentscheidung. Sie wird hier nicht vorweggenommen.

A1 bleibt bis zu dieser Entscheidung rot.

## Reihenfolge für die folgenden Runden

1. C ursachenbezogen klären (KI-Grenzen gehen vor Inventarpflege; erste Vermutung: auch hier
   ungeklärte Stufen nach Entscheidung 16, dann greift der Riegel vor dem Modell). B ist bis auf
   die drei vorgelegten Punkte bearbeitet.
2. D je Wächter: jede Neuerung prüfen, dann eintragen; wo ein Wächter eine echte Lücke zeigt, den
   Produktcode beheben.
3. E gegen die bestehenden Grenzen bearbeiten (Korrektur Nacharbeit 47: keine pauschale
   Entscheidungsvorlage; nur ein konkret mit Originalquelle belegter Widerspruch wäre vorzulegen).
4. F und G, danach ein neuer Gesamtcheck bis einschließlich UI-Smoke.

## Nacharbeit 45 — konkreter administrativer Leseweg statt unbelegter Registersperre

Der Originalwortlaut von BPA-11 liegt in der additiven Originalquelle
`QUELLEN-HILFE-fca1dfd1ba1a-BPA11-ORIGINALQUELLE.json` vor. AC04/G16 verbieten Ausführung und
Rechteausweitung aus fremdem Skilltext. Sie verbieten nicht, eine ausdrücklich gewählte Datei
administrativ als Beschreibung zu lesen. AC06 macht aus der Beschreibung keine Produktfähigkeit.
Eine fehlende Installationsfreigabe belegt deshalb keine Sperre für jeden lesenden Parseraufruf.

Die vorbereitete Änderung schließt `nimmSkillDateiAuf` über
`tools/skill-ablage-vorschau.ts` an einen wirklichen administrativen Lesevorgang an: expliziter
Dateipfad → tatsächliches Lesen → vorhandener Schutzparser → JSON-Vorschau mit Herkunft und Hash.
Sie erzeugt keine Registryeinträge, Adapterinstallation, Rechte oder Befehlsausführung. Ein
zusätzlicher Uploaddialog wird nicht eingeführt. Die Betriebsanleitung beschreibt den konkreten
Aufruf und die Grenzen statt aus ihrem bisherigen Präsens einen vorhandenen Einleseweg abzuleiten.

Der Aufrufer-Wächter einschließlich Sammler, A1/A3, Gegenfälle und aller Register bleibt
unverändert. Ebenso bleiben die bisherigen K4-/K6-Schutzfälle erhalten. Neue CLI-Gegenproben
bedienen den tatsächlichen Weg mit Dateien und einem Negativfall für nicht ausgeführte Anweisungen.
Dies ist eine noch ungeprüfte technische Vorbereitung, keine grüne Messung oder Abnahme.

Aufgabe an dieselbe ursprüngliche Claude-Sitzung: Die vorbereiteten Änderungen am bestehenden
Kandidaten fachlich und technisch prüfen, nötigenfalls korrigieren und einen passenden Prüfplan
für Aufrufer-Wächter plus echten CLI-Weg liefern. Die alte Erwartung „A1 rot wegen fehlender
Produktentscheidung/Originalquelle“ sachlich aktualisieren. Eine unbelegte OFFENER_REST-Sperre
oder ein Scheinaufruf ist nicht die Lösung. Keine weitere persönliche Entscheidung über diese
gedeckte technische Lesevorschau verlangen. Die übrigen offenen Gesamtcheck-/Prüfplatz-/Workflow-
Kriterien bleiben vollständig erhalten und werden durch diesen Anschluss nicht für erfüllt erklärt.

## Nacharbeit 47 — Grenzen aus E gegen die bestehenden Grenzen, dazu `ausgehende-ziele`

Am Kandidaten `ca6d6f1c` gilt Bens Befund: E war pauschal als Entscheidung geführt. Das ist
korrigiert (Abschnitt E, Reihenfolge Punkt 3). Bearbeitet ist, was sich ohne Baulauf belegen lässt.
Gemessen ist in dieser Runde nichts; die Zahlen unten stammen aus den genannten Protokollen.

| Fall | Stand |
|---|---|
| Schriftskala R-0918 (17 freie Größen unter 11 px) | **bearbeitet.** Alle 17 Stellen nutzen jetzt die benannte Stufe `text-klein` (11 px = `MINDEST_LESEGROESSE_PX`). Das betrifft `BegleitungPruefformular.tsx`, `Help.tsx`, `BibliothekAntwort.tsx` ×4, `KlaraEigeninitiative.tsx` ×2 sowie `KLEINTITEL` und Einzelstellen in `KlaraQualitaet`, `KlaraAusfuehrung`, `KiArbeitsweg` und `KlaraAktionsnachweis`. Die gebundene SVG-Ausnahme `KnowledgeNeighborhood.tsx` ×3 bleibt unberührt. Die Grenze ist nicht verändert |
| mega40 / mega62 Kopfband: `text-klein` „unbekannt“ | **bearbeitet.** `klein`, `zaehler` und `fussnote` sind Größenstufen der Skala (`tailwind.config.ts:79–81`), keine Farben. Sie stehen jetzt bei den Nicht-Farben (mega40 `KEINE_FARBE`) bzw. den Größenwörtern (mega62). Die Farbprüfung selbst ist unverändert |
| mega43 Kontrast 3,83:1 / 2,75:1 | **bearbeitet.** Die gemeldeten Elemente `#ask-einschub h3`, `.einschub-stand` und `#ask-einschub-kein-original` entstehen erst zur Laufzeit (`taskpane.js` `askEinschubOeffnen`) als Kinder von `#ask-einschub` mit `background: var(--surface)` (`taskpane.css:550`). Der Sammler hatte sie mangels Markup gegen jede Fläche angenommen. Sie sind als begründete `REGEL_AUSNAHMEN` eingetragen, nach dem Vorbild `#ask-quellen-detail li`. Neuer Messfall B1c belegt `--ink` und `--muted` auf `--surface` ≥ 4,5:1 und rötet, wenn sich die Fläche ändert |
| mega62 F / mega61: `KlaraEchtGespraech.tsx` ohne Kostenhinweis und Flächensatz | **bearbeitet (Produktfehler).** Klaras Gesprächsfläche ruft `useAiAvailable("answer")` und löst Modellfragen aus, trug aber weder `AiCostHint` noch die KI-Kennzeichnung. Jetzt steht beides vor dem Auslöser: `AiSurfaceNotice` unbedingt (R-0603) und `AiCostHint` bedingt über `deriveAiBillable(status, "answer")`, dieselbe Ableitung wie auf der Fragen-Seite. Bei abgeschalteter KI steht keines von beiden |
| `erstladezeit` DECKEL R-0801 | **offen, konkret eingegrenzt.** Nacharbeit 26: Eintritt 2 698 517 B gegen 1 360 000 B, die Hülle ist 1 Stück, en/nl liegen außerhalb. Statischer Befund: `i18n.ts:69` sammelt ≈155 Textmodule `texte/*.ts` (≈28 600 Zeilen) mit `eager: true` ein, und jedes trägt de, en und nl. Das Plugin `sprachpakete-nachladen` nimmt nur die Wörterbücher `woerterbuch/en|nl` heraus, nicht die en-/nl-Blöcke der Textmodule. Die Byte-Höhe dieses Anteils ist nicht gemessen; das ist eine Vermutung mit Quellbeleg, keine Messung. Reparaturweg: die en-/nl-Blöcke der Textmodule im Produktionsbau wie die Wörterbücher in die Sprachpakete verlegen; der Textmodulvertrag (Tor und Build-Plugin) bleibt vollständig. Nicht umgesetzt, weil Plugin und Laufzeitprüfung `pruefeTextmodule` in `i18n.ts` gemeinsam umgebaut werden müssen und ein Fehler jeden Produktionsbau abbricht. Das muss gegen einen Baulauf gemessen werden. Die Grenze bleibt unverändert, ein Originalwiderspruch zu R-0801 ist nicht belegt |
| `ki-freigaberegeln/ausgehende-ziele` Z1 (13 gegen 11) | **bearbeitet.** Zwei Dateien kamen neu hinzu. `routes/office-routes.ts:106` ruft die WOPI-Discovery des Editors ab; das ist eine echte ausgehende Verbindung und ist als Ziel `office-editor-discovery` eingetragen (Umgebung `KLARWERK_OFFICE_EDITOR_URL`/`…_INTERN_URL`, Bedingungen aus `leseOfficeEditorUmgebung`). `transport-tls.ts` nutzt `node:https` nur für `createServer`, also den eingehenden App-Port (R-2057). Sie steht als gebundene Ausnahme `NUR_EINGEHEND` im Test; Fall Z1b prüft Grund, Bedarf, `createServer` und das Fehlen jedes ausgehenden Aufrufs, mit Gegenprobe |

Weiter offen aus Bens Befund 1, unverändert: F1/F2/F4/F6 (`routing-zwei-attrappen`),
`http-api-referenz` (189 Routen), `beta-rollenabnahme`, `route-guard-audit`, `mega74` und
`re-import-dubletten/port-aufrufer-waechter`. Danach folgt der Gesamtcheck einschließlich UI-Smoke.
Getrennt offen bleiben CI-Anschluss (`.github`-Schreibrecht), PostgreSQL- und Modellzugang.

## Nacharbeit 70 — zwei Gegenproben am Kandidaten `73fc2563`

Gemessen (`HISTORIE/nacharbeit-70/PRUEFUNG`): Gesamtcheck rot in `test` (11 Browser-, 25 übrige
Fälle), Smoke-Folgestufen nicht erreicht. Bearbeitet, ohne eigenen Lauf:

| Fall | Ursache | Änderung |
|---|---|---|
| `wiederanlauf/replay-grenze` R1–R3 | Testobjekte ohne Einstufung haben Schutzrang 1 (`sichtbarkeit.ts`); der Melde-Betrachter (`viewer`, ohne Spaces) sah sie nie — nichts wurde erkannt | Objekte ausdrücklich `intern`; Vorbedingung „A zugestellt, B erkannt“ geprüft; R1–R3 unverändert |
| `vorschau-reichweite/alte-flaeche` | Rücknahmepatch passte nicht mehr auf drei Dateien | Patch auf den heutigen Stand übertragen (alle Hunks von Hand gegen die Zieldateien abgeglichen); Erwartung auf `"vorschau.` geschärft, `wordvorschau.menu` als Positivprobe |

Der Verhaltensvergleich K4-R selbst (`vorschau-reichweite-pg-im-browser.integration.test.ts`)
braucht PostgreSQL und Browser am Prüfplatz — nicht belegt, getrennt offen. Alle übrigen Punkte aus
Nacharbeit 69 unverändert offen.

## Nacharbeit 69 — Rest des Laufs zu `c704f89a` (10 Browser-, 33 übrige Fälle)

Gemessen (`HISTORIE/nacharbeit-69/PRUEFUNG`): Build, Lint, Architektur, Modalgrenze und
Geheimnis-Scan grün, `test` rot, Smoke-Folgestufen des Tors nicht erreicht. Kern-Smokes direkt grün
(Chromium 18; Firefox, WebKit je 14 und 4 übersprungen). In dieser Runde lief nichts.

| Fall | Ursache | Änderung |
|---|---|---|
| `vorfuehrweg` D2 (Ben) | Vorführseite zitierte „Entwurf sichern“; die Fläche heißt „Als Entwurf speichern“ | `vorfuehrweg.html` |
| `schnitt-pins` A2 (Ben) | `aufrufer-waechter` nennt `taskpane.html` ohne Pfad, liest aber `taskpane.js` — kein Griff sah direkte Skriptleser | Neuer Griff `skript` mit Positivdatei/Gegenprobe; 7 Einträge ergänzt, 4 neue Mitfahrer (abgeleitet) |
| `zitierte-beschriftungen` D-3 (Ben) | Kurzzitat „noch nicht freigegeben“ ist zugleich `gemeinsam.status.sonst` | FE-001 zitiert den Bedeutungssatz von „Vorgelegt“ vollständig; Ausnahme und Satzteil darauf ausgerichtet |
| `egress-chokepoint` | Kopfkommentar des Vorlademoduls nannte die Anbieterhosts | Kommentar ohne Hostnamen |
| `confluence-verschachtelt` E6 | Attrappe hängte jeder Antwort einen Inhaltscursor an; die Gruppenliste folgte ihm (7 statt 4) | Nur die Inhaltsliste blättert; Soll 4 unverändert |
| `ka5-markierung` R2 | `referenzpruefung.pruefId` ist eine frische Kennung je Anfrage | `stabil()` nimmt nur sie heraus |
| `verwaltung-schreibwege` W2 (2) | Rollenwahl ist zweistufig (Wirkung, dann „Übernehmen“) | Test bedient beide Schritte; neu: Auswahl allein schreibt nicht; Fehlerfall am Feld mit „unverändert“ |

Offen: KA5-R1 (B trägt ohne Markierung; nach JOB 3053/R-0316 statisch nicht erklärbar), Freeze-144
(vier eingefrorene Hashes durch fremde Arbeit verändert — Freigabe nötig), sowie alle offenen Punkte
aus Nacharbeit 66 unverändert.

## Nacharbeit 66 — Rotfälle des Laufs zu `637e45ec` nach Ursache, Kandidat `f44bfd29`

Grundlage ist der erhaltene Lauf `HISTORIE/nacharbeit-65/PRUEFUNG/gesamtcheck-r1329.log` mit dem
Index `HILFE-896cd8c2f868-ROTFALLINDEX-637e45ec.json`: 34 Browser- und 100 übrige Rotfälle.
**In dieser Runde lief nichts:** kein Test, kein Format- und kein Git-Befehl. Die Werkzeugausführung
war gesperrt, Formatierung ist von Hand nach Biome-Regeln gesetzt. „Gemessen“ heißt unten: im
genannten Lauf gemessen. „Abgeleitet“ heißt: aus Quelltext oder Messung geschlossen, nicht
selbst gemessen.

### Bearbeitet: Prüfaufbau oder Wächter folgt dem heutigen, belegten Produktvertrag

| Fall | Ursache | Änderung |
|---|---|---|
| `import-genau-einmal` B4 (8 Fälle, Bens Befund 1) | Die Erstanlage ist atomar; der Snapshot-Fehler der alten Vorrichtung entsteht nicht mehr | Vorbereitete Fassung übernommen und am Produkt nachgelesen: ein einmal scheiternder Rollback (`repo.delete`) erzeugt die Teilpersistenz (`CREATE_ROLLBACK_FAILED`). Die Adoption geht über `findByImportCandidateId`. Genau eine Kennung, Nachprüfung und Recovery bleiben verlangt |
| `live-check-suchwoerter` (13) | Eigene Regression aus Nacharbeit 63 (Listenanker 389) | Anker `knowledge-check.ts:394` |
| `word-addin` Rückfall-Pin | Eigene Regression aus Nacharbeit 63 | Pin trägt `passage: null, original: null` |
| `pflichtenheft-nachweis` FR-ANA-02 | Eigene Regression aus Nacharbeit 63 (Titel) | Titel in `specs/ERFUELLUNGSSTAND.md` |
| `kopfzaehler-frische` | Eigene Regression aus Nacharbeit 63: Messung startete vor ruhender Leitung | Helfer `ruhig()` wartet, bis jede Zählquellen-Anfrage beantwortet ist |
| `foto-wissen` F5 | R-0604: der deterministische Rückfall trägt keine KI-Marke | Erwartet: keine Marke und `fallbackReason: "no-model"` |
| `security/egress-chokepoint` | Das Vorlademodul `anbieterkante-vorladen.ts` nannte die Anbieteradressen als Literal | Es leitet jeden nicht-lokalen Ruf an den lokalen Ersatz. Nur dieser entscheidet über Ziele (fremde Ziele: 404, mitgeschrieben). Der Wächter ist unverändert |
| `ki-bremse` S7 | REF-03 hat `/api/reasoner/referenzpruefung/funktionscheck` bewusst gebremst; die Route ruft ein Modell | Erwartete Liste ergänzt |
| `inhaltskennung` K3 (15) | Treffer am Wort „Bildinhalt“ (W02-Beschreibung) und am OCR-Befundweg | Gesucht wird nach Kennung und KO-Feld; Kommentarzeilen zählen nicht. Der OCR-Befundweg (6 Dateien) ist benannt, mit Gegenprobe: Kennung und Anker stehen nie in derselben Zeile, und jede benannte Datei liest die Kennung wirklich |
| `ki-governance` Codeliste | Lauftyp `referenz` fehlte in der Tabelle | Zeile „nicht gekennzeichnet“ (wie im Code). Ob die Begründung angezeigt wird, ist nicht gemessen; die Einordnung bleibt offen wie bei `conflict` |
| `json-volltext` S1/2 | `includes` hielt auch `…/candidates/befunde` an; `freigeben` löste nur die letzte gehaltene Anfrage | Genauer Pfad wie in `flaeche.ts`. **Abgeleitet** |
| `klara-assistenz` W3 | KA5-R6f heißt seit R-0700 in der Einzahl | Titel nachgeführt |
| `klara-zerlegung` A2 (7) | Neue Mitfahrer aus Integrationen | 7 Einträge, jeder Griff deckt sich mit dem gedruckten A4-Verzeichnis desselben Laufs |
| `job821` (2) | Ist-Befund-Wächter; R-0142 hat den einen Erzeuger gebaut (`schreibeLaufReferenz`, `candidateItemId: candidateId`) | Neuer Ist-Befund: genau ein Aufrufer, genau dieser Wert. Mangel 2 (eigene Entität) bleibt Ownersache |
| `papierkorb-befund` R6b | „nur Kennungen“ im Confluence-Testsatz der Seite | Geprüft wird die Prüfliste (`#import-review-queue`), mit Vorbedingung |
| `mega52` D3 | Das Produkt legte in `lueckenSystem` die Ausgabesprache nicht fest | **Produkt:** `outputLanguageRule` plus Namensregel (Bereichsnamen unverändert, werden zurückgeprüft) |
| `review26` Drahtform | B-07 entfernt `basis.bestand` an der HTTP-Grenze | Gespeichert: volle Basis; am Draht ohne `bestand`, ausdrücklich geprüft |
| `zitierte-beschriftungen` Z-1 (18) | 17 echte Zitatfehler in EN/NL-Textmodulen, z. B. deutscher Wortlaut im NL-Text | **Produkttexte:** `integrationen` ×2, `klaraauftrag`, `klarakontext` ×2, `klaranotiz`, `klaraqualitaet` ×4, `klarasetup`, `kommunikation` ×2 und `wkz` ×4 berichtigt. `ko.couple.help` (EN, Grundbestand unter Prüfsumme) ist begründet in BEKANNT |
| `zitierte-beschriftungen` D-3 | „nicht eingerichtet“ ist inzwischen Wortlaut dreier Beschriftungen | Die Kurzanleitung nennt den Zustand fett, wie ihre Zustandsliste; der KEIN_KNOPF-Eintrag entfällt |
| `kd-capture-doppelungen` G1/G2 | 3 Paare weggefallen, 1 neues abweichendes Paar | Gelesen: `koerper` (Lauf 5 R3-1) nur bei mehreren Körpern; R-2180 sperrt Stufen in der Erfassung, der Dienst erzwingt sie beim Bearbeiten selbst. Das neue Paar ist eine Zufallsgleichheit zweier Knöpfe und als Ausnahme begründet |
| `fremddoppelungen` F1/D1 | Register aus dem Lauf veraltet; D1 brach an der Kalibrierung (5 Paare) ab | F1: 32 Einträge in gemessener Reihenfolge, neue Gruppe „Optionsliste“ (Bauform, 14 Dateien). D1: Kalibrierung auf genau 5 (strenger). DREIFACH auf 2 **abgeleitet**, nicht gemessen |
| `ux26` K4 de/en/nl | R-0206/R-1746: „Stimmt weiterhin“ für jeden Leser | Zugelassen: Nachladeweg plus dieser Knopf. „Erneut prüfen“ ist namentlich ausgeschlossen |
| `vorfuehrweg` D2 | Die Vorführseite zitierte nur den ersten Satz von `demodaten.ladenAus` | Voller Wortlaut DE/EN in `vorfuehrweg.html` |
| `wiki-gesamtanweisung` F9 | Neue Einordnungszeile des Leerstands („geprüftes Wissen zu Schritten“) | Die Zeile wird für sich geprüft, der übrige Leerstand unverändert streng |
| `confluence/hierarchie` H-1 | Wie E6: weitere Leseanfragen des Adapters | Gezählt werden die Blätteraufrufe. **Abgeleitet** |
| `smoke-manifest-u3` M3 | Versionspin 16, Manifest gelesen 64 | Pin 64, wie bei jeder Zusammenführung bisher |
| Browsergruppe (aus dem Lauf zu 637e45ec) | Je Fall gelesen: Word-Kurzlink, Umbruch, Filterstopps, Importkarten, Palette T5, Deckel, Hilfeband, verschachtelter Deckel, Toast-Ersatz, Reitersprache | Siehe die genannten Dateien im Prüfplan; Produktänderungen an `Profile`, `Admin`, `Zeilenkarte`, `ToastContext`/`einblendungen`, `RichTextEditor`, `AdminKiReferenz` |
| Weitere Wächter (übrige Gruppe) | Exposition GHSA-hwr6, Adresse gegen Pfad, job1042-Matrix, Klara-Inventar, mega70, pro375, Zusammenschaltung, mega85, Entwurfsauswahl, Confluence-Abgleich, i10, Demo-Firmen-CI, Demo-Gäste, Rücknahme-Protokoll, H3/H5/H6 | Je Fall nachgelesen und nachgeführt; Register-Einträge als gemessen/abgeleitet markiert |

### Entscheidung nötig (nicht selbst gewählt)

H4 T1–T3 und H5 T3/T3b/T4 (verlangte Texte gegen JOB 3063/3064), Entscheidung 54 (ask-check-caveat
A4, mega34 A3, mega35 E1, library-guide-collapse, s6 Q4), R-0908 (`fachbegriffe-k1` B-1), Lauf 3 B10
(2 Fälle). Die Quellenwidersprüche bleiben wie in Nacharbeit 63 beschrieben.

### Offen, Ursache nicht eingegrenzt oder Mittel fehlen

| Fall | Stand |
|---|---|
| `geheimnisse-betrieb` G1/G8 | Für `KLARWERK_SERVICE_KEYS` und `KLARWERK_WOPI_SCHLUESSEL` fehlen Handbuchzeilen mit Wechselfrist, Zuständigkeit und letzter Rotation. **Betreiberangaben fehlen**, sie werden nicht erfunden |
| `pruefen-volltext/audit-akteur` K2 | `ask.query` wird vor der Lückenverzweigung mit `actorId` geschrieben (`service.ts:1769`), der Actor-Filter wirkt (B1–B3 grün). Warum 0 Einträge: nicht eingegrenzt |
| `evidence-attachments` e2e, `w10-kette` N4, `wiederanlauf` R1–R3, `standortwissen` F1 | Verhalten des Frage-, Freigabe- und Meldewegs. Vermutung: Einstufungs- bzw. Sichtbarkeitsregeln (Melder sieht nur nicht vertrauliche Objekte ohne Space). Nicht belegt |
| `studio-konkurrenz` K2b/K7 | Ein zusätzlicher Renderdurchgang je Anschlag; Quelle nicht gelesen |
| `verwaltung-schreibwege` W2 (2) | Rollenwahl kommt nicht am Server an; nicht eingegrenzt |
| `vorschau-reichweite` | Das Umkehr-Patch passt nicht mehr auf drei Dateien. Neu erzeugen braucht `git diff` — gesperrt |
| `wiki-gesamtanweisung-fassungsbindung` | Verborgener Baustein: `bausteine` leer, sichtbarer Text fehlt; nicht eingegrenzt |
| `wiki-orientierung` X1 | Die Kalibrierung „Teilbaum ausgetauscht“ trägt nicht mehr (React behält den Knoten); nicht bearbeitet |
| `job2935` L14/L19, K2 Z.52, `vorfuehrdaten` N5, `freeze144` | Wie Nacharbeit 63/65 |

Getrennt offen bleiben CI-Anschluss, PostgreSQL- und Modellzugang sowie ein grüner Gesamtabschluss
einschließlich der Smoke-Folgestufen.

## Nacharbeit 65 — zwei gezielte Rotfälle am Kandidaten `637e45ec`

Gemessen (`HISTORIE/nacharbeit-65/PRUEFUNG`): Gesamtcheck Exit 1 in `test`. Browsergruppe 34 rote
Fälle in 22 Dateien, übrige Gruppe 100 in 60 Dateien. Die UI-Smoke-Stufen des Tors wurden nicht
erreicht. Konkret zugewiesen und bearbeitet, **ohne eigenen Lauf**:

| Fall | Ursache | Änderung |
|---|---|---|
| `zielbild-h2` X „Erneut“ (445 statt ≤ 80) | Die Kulisse hat nichts Fälliges, daher steht der von R-0956 verlangte Leerzustandsrahmen (`leerzustandsRahmen`). Er machte 391 der 445 Zeichen aus; frühere Läufe (Nacharbeit 8/16/17/26) maßen nur die 54 Zeichen der Aufklappzeilen | Produkt: Messanker `data-testid="leer-rahmen"` am Rahmen, Wortlaut und Bauform unverändert. Test: der Rahmen wird benannt abgezogen wie die Sätze der Konfliktarbeit. Neuer Fall X-L prüft sein Dasein auf „Erneut“, dass er nur ohne Warteschlange steht, und seinen Inhalt (Story, Einordnung, ehrlicher Satz). Die Grenze bleibt 80 |
| `wiki-orientierung` Z1 (Mitte von „Drei“ verdeckt) | Nach der Bestätigung des Hinweisbanners erscheint planmäßig die Ersteinrichtung der Assistenz (`AssistenzEinrichtung.tsx`, „eine Fläche nach der anderen“). Ihr Band lag schmal über „Drei“; gemessen war „Später“ obenauf | `hinweisBestaetigen` legt auch sie per echtem Klick auf „Später“ beiseite. Das gilt für die Tab-Sitzung (`merkeEinrichtungSpaeter`); der Knopf muss selbst obenauf sein |

Damit ist Punkt 3 der Vorlage aus Nacharbeit 63 (JOB 3061 H2 gegen R-0956) **kein**
Widerspruch: H2 misst den Erklärtext der Fläche, R-0956 verlangt den Rahmen nur im Leerzustand.
Beides gilt, wenn der verlangte Rahmen wie die übrigen verlangten Sätze benannt abgezogen wird.

Die übrigen roten Fälle dieses Laufs sind nicht als konkrete Codefehler zugewiesen und hier nicht
eingeordnet.

## Nacharbeit 63 — Gesamtcheck am Kandidaten `e033d282`: Ursachen der Rotfälle

Gemessen (`HISTORIE/nacharbeit-63/PRUEFUNG/gesamtcheck-r1329.log`): Exit 1 in `test`.
Browsergruppe 51 rote Fälle, übrige Gruppe 150. Die vier
UI-Smoke-Stufen des Tors wurden nicht erreicht; die direkt gefahrenen Kern-Smokes waren in allen
drei Engines grün (Chromium 18, Firefox/WebKit je 14 und 4 bewusst ausgelassen). Index der 201
Fälle: `HILFE-804074b6c710-ROTFALLINDEX.json`. Bearbeitet **ohne eigenen Lauf**.

**Bens drei eingegrenzte Ursachen:**

| Fall | Ursache | Änderung |
|---|---|---|
| T4 · Doppelumwandlung (21 statt 20) | `technische-daten-routes.ts`: `ort as unknown as QuellOrt` nach `pruefeAbschnitt`, das den Typ nicht verengt | Produkt: Adresse, Abschnitt und Anker werden typgesichert übernommen (sonst 400 `BELEG_FORM`), kein Cast; das Register ist nicht erweitert |
| W4 · Werkzeug-Startvertrag | nur `bodytext-nachziehen` erwartet; `datenintegritaet.ts` lädt die App-Wurzel ebenfalls (Vertrag zuerst, CLI-Riegel) | vorbereitete Fassung geprüft: beide Lader, je Fundstelle gegen die eigene Datei, W1/W2 je Werkzeug, Prozessfälle für `datenintegritaet` (Zeitgrenze ergänzt) |
| PDF-/PPTX-Ablesekalibrierung | `TEXT_AUSBLENDEN` leerte nur Knoten mit der GANZEN Marke; die Ablesung liest den Seitentext. Verteilte Marken blieben, ein frischer Ableser galt als „veraltet“ | `d3-buehne.ts`: jedes Vorkommen im zusammenhängenden Text (auch über Knotengrenzen, beliebiger Leerraum) wird entfernt und vollständig wiederhergestellt; der Eingriff wird mit der Lesart von `flaeche` geprüft — unvollständig heißt UNVOLLSTÄNDIG, nicht „veraltet“. Gegenfälle: verteilte Marke frisch/eingefroren/werfend, blinder Bereich |

**Weitere Ursachen, je mit Beleg im Code:**

| Fälle | Ursache | Änderung |
|---|---|---|
| `live-check-suchwoerter` (8), `live-check-postgres-prefilter` (3) | Fundstellen- und Zeilenverweise verschoben (`service.ts` gewachsen, `ModalBoundaryContext.tsx` 192/220/327) | Verweise am Quelltext neu gemessen (`knowledge-check.ts`, `repo.ts`, Pin) |
| `q9-fremde-flaechen` (4) | drei neue Meldungsstellen in `capture-routes.ts` (R-0169 Dokumentakte, R-0632) ohne Katalogschlüssel; eine davon ist der Fehlercode `DOKUMENT_UNBEKANNT` | je Stelle eine begründete Ausnahme, Pins 5 → 8 |
| `q9-serverfehlertexte` (4) | `SSO_CONFIRMATION_REQUIRED` (R-0582) geworfen, nur deutsch gemessen; R12 spionierte `login`, die Route ruft seit R-0562 `anmelden` | Pins nachgeführt, Spion auf den echten Dienstweg |
| `kopfzaehler-frische` (4) | `GeteilterStandNachlader` (R-1029/R-1674) bestätigt die Zahl alle 20 s — im sichtbaren Tab gibt es keine 35 s ohne Abruf | die Frist wird im VERDECKTEN Tab gemessen, wo der Nachlader pausiert |
| `zielbild-k1` (3), `zielbild-h2` „Konflikte“ (1) | verlangte Kennzeichnungen im Textmesser: KI-Zeile der Sitzung (R-0378), Sätze der Konfliktarbeit (R-0252, R-0215/R-1714) | als benannte Ausnahme abgezogen UND ihr Dasein geprüft; Grenzen 60/80 unverändert |
| Bildbeschreibung „describe zweimal“ (13) | OCR-02: `BildBefundeImRumpf` liest Bilder ohne Klick, Voreinstellung „an“ | die Fälle des Handwegs stellen die Lage auf „aus“ (Setup › Klara); die Automatik prüfen `tests/klara-bildanalyse-ocr/*` |
| `tv1` (3) | `GemeinsamerEntwurf.tsx` bindet den Editor einzeilig ein — der Erheber brach ab; die Seite hat ein Titelfeld, aber keinen Übernahmeweg | Erheber liest einzeilige Einbindungen (Kalibrierung); Produkt: Titelvorschlag wie am Artikeleditor; mega84-Eintrag berichtigt |
| `dirty-flow`, `navguard` (2) | `AblaufUebernahme.tsx` meldet einen Wächter an; ihr Objektlink war roh, obwohl die Seite nach dem Einreichen bearbeitbar bleibt | Produkt: `GuardedLink`; Budget 0/0 mit Grund |
| `paket4` (1) | `Mobile.tsx` trug wieder `conflicts.data ?? []` (BEN-04) | gleichwertig ohne leere Liste (unbekannt ⇒ kein rotes Signal, `displayStatus.ts`) |
| `mega45` (1) | `useConflicts` auf dem Board seit Pedis Entscheidung 03.10.2026 (Konfliktlage je Karte) | genau ein Leser, nur für die Kartenlage gepinnt |
| `entwurf-verlassen` (5) | Titelfeld heißt `capture.wizard.titleLabel` (EDITOR-EINHEITLICH K1), nicht mehr „Kernaussage“ | Beschriftung nachgeführt (auch im PG-Browserfall) |
| `wiki-orientierung` (3) | Hinweisbanner und danach die Einblendung „Erledigt.“ (R-0953) liegen über „Drei“ | gemeinsamer Schritt `hinweisBestaetigen`: Banner per echtem Klick bestätigen, warten bis beide fort sind |
| Quelltext-Pins (14): `mega51` H/G2, `mega61` H, `ask-fragt-zuerst`, `hilfe-bibliothek`, `wp-d7`, `wp-d9c`, `basic-u2`, `word-addin`, `word-addin-csp`, `job2666`, `mega38`, `mega61-rechtsseiten`, `pflichtenheft-nachweis` | umgebaute, aber gleichwirkende Stellen (fiktive Beispiele, Antwortmenü R-0703, `aria-hidden`, Bildvertrag, `useMemo`, Belegstelle R-0326, R-0700, REF-02, tragende Quellen, Glob-Ladeweg, Paketformat) | je auf die heutige Form gepinnt, Zusage unverändert; `mega51` G2 en 88 → 93 (fünf englische „trust value“ der Antwort-Erklärung, E2) |
| `learning-claim-guard` (2) | Regel C traf „über**setzt sie**“ und eine Verneinung („ersetzt sie nicht“) | Wortgrenze und Verneinung; Gegenfall C-6 in beide Richtungen |
| `bibliothek-historie-vermerk` (2), `testverweise` (1) | Fundstellen verschoben; vierter Erzeuger „überarbeitet“ (`uebernimmOfficeFassung`, Literal); drei Verweise auf umbenannte Dateien | neu gemessen bzw. auf die bestehenden Dateien gezogen |

**Zur Entscheidung vorgelegt (bleiben rot, nichts geändert):**

1. *Umfang von Entscheidung 54.* `lib/wissensstatus.ts` sagt, die Einstufung einer Antwort und das Vertrauenswort seien „bewusst nicht umbenannt“. Im Wörterbuch tragen sie aber schon am Bezugspunkt `main` 1147c026 „Fachlich bestätigt“. Die mechanisch umbenannten Fälle treffen damit seitenweit auch den Prüfstand eines validierten Quellobjekts. Betroffen: `ask-check-caveat` A4, `mega34` A3, `mega35` E1, `library-guide-collapse`, `s6` Q4.
2. *R-0908 gegen frühere Wortlaute* (`fachbegriffe-k1` B-1, 24 Funde):
   - R-1020 verlangt „Reasoner-Entwurf, nicht validiert“ im Wortlaut der Quelle (`ReasonerDraft.tsx`, `r0703`).
   - Entscheidung 53 setzt den Untertitel „Knowledge OS“.
   - Die Abnahme der Wissens-Sprints (R-1657, F4) verlangt die Marke „Reasoner“.
   - R-0908 erlaubt „übersetzt oder beim ersten Auftreten erklärt“; der Wächter B duldet keine Ausnahme.
3. *JOB 3061 (H2 ≤ 80 Zeichen) gegen R-0956.* R-0956 verlangt den erklärten Leerzustand („jede leere Liste erklärt …“); die H2-Kulisse misst „Erneut“ leer.
4. *Unverändert offen aus Nacharbeit 13:* Lauf 3 B10 (`confluence-quellabgleich/lauf3-nacharbeit`, wem die Anhebung gehört).

**Ursache belegt, Umsetzung erst mit Messung:** `import-genau-einmal/sperrverlust-nach-anlage` (8). Seit gesamt-auditprotokoll (Lauf 3) ist die Erstanlage atomar: ein scheiternder Snapshot nimmt das Objekt zurück (`rollbackCreatedKo`). Die Fälle setzen die frühere Teilpersistenz voraus („Insert gelingt, Snapshot wirft“), die es heute nur noch bei gescheiterter Rücknahme gibt. Die Zusagen (eine Kennung, Adoption, Recovery) bleiben richtig. Die Vorbedingung muss über eine scheiternde Rücknahme hergestellt werden; deren Abfolge im äußeren Fehlerabschluss ist ohne Lauf nicht verlässlich vorherzusagen.

**In dieser Runde nicht eingeordnet (Ursache offen, keine Pauschaleinstufung):**
- *Design- und Schmalmessungen:* `job2935` (2), `zielbild-h3`/`h4`/`h5-*`/`h6`/`k2` (12), `ux12b` (3), `review26-pruefen-schmal`, `pruefen-quellennachweis`, `ki-palette-fingertipp`, `import-anleitung-modus`, `gast-nutzerweg`, `vorfuehrdaten/netzwerk`, `json-volltext/stand-im-echten-browser`, `ux19` (5), `smoke/frontdoor-schmalansicht` (Umgebung).
- *Register- und Inventarwächter:* `klara-regressionsinventar` (3), `klara-zerlegung`, `db/i10` (2), `zusammenschaltung` (2), `ki-governance`, `integrations-api/ki-bremse`, `job1042`, `mega85`, `inhaltskennung`, `kd-capture`/`fremddoppelungen` (4), `mega70`, `pro375`, `egress-chokepoint`, `geheimnisse-betrieb` (2; Art und Wechselfrist sind Betreiberangaben), `demo-zugang-gaeste` (2), `library-analytics-freeze144` (2; neue Hashes nur gemessen setzbar), `abhaengigkeiten-exposition`, `adresse-ist-kein-pfad`, `mega52`, `sprache-begriffe/zitierte-beschriftungen` (2), `job821` (2), `gesamt-navigation/smoke-manifest-u3`.
- *Fachfälle:* `confluence-quellabgleich/abgleich` (2) und `runde3`, `confluence-verschachtelt`, `services/confluence/hierarchie`, `ka5-markierung` (2), `eigene-ruecknahme` (2), `foto-wissen`, `draft-save-fullstate`, `json-volltext/stand-der-pruefkarte`, `klara-assistenz/abgleich-belege`, `papierkorb-befund`, `pruefen-volltext/audit-akteur`, `review26-teilpruefung`, `standortwissen`, `evidence-attachments`, `w10-kette`, `studio-konkurrenz` (2), `ux26` (3), `verwaltung-schreibwege` (2), `vorfuehrweg`, `vorschau-reichweite` (Rücknahme-Patch), `wiederanlauf/replay-grenze` (3), `wiki-gesamtanweisung` (2), `wiki-orientierung/lesespalte`.

Getrennt offen bleiben CI-Anschluss (`.github`), PostgreSQL- und Modellzugang.

## Nacharbeit 62 — Gesamtcheck ausgewählt

Gemessen am Kandidaten `be4c6204` (`HISTORIE/nacharbeit-62/PRUEFUNG`): `woerterbuch-umzugsnachweis-unit`
11/11 grün. Eingeschlossen sind W1 und die Wertbindung W2c; Build und Format sind grün. Familie D
(W1, rot seit Nacharbeit 8) ist damit für diesen Stand geschlossen.

Ben zu `be4c6204`: Der beauftragte Abschluss ist nicht belegt, denn der Lauf deckte nur drei von
dreizehn Vertragsstufen ab. In dieser Runde ist **kein Code geändert**. Der Prüfplan wählt jetzt den
vollständigen Gesamtcheck `tools/check` samt UI-Smoke-Stufe. Weil das Tor vor der Smoke-Stufe
abbrechen kann, fahren die Kern-Rauchproben zusätzlich direkt je Engine:
- `ui-smoke`
- `smoke-umgebung`
- `mobile-drawer-focus-probe`

Das Ergebnis steht erst mit diesem Lauf fest. Rote Stufen werden danach ursachenbezogen bearbeitet.
Getrennt offen bleiben CI-Anschluss (`.github`), PostgreSQL- und Modellzugang.

## Nacharbeit 61 — W1: Wertänderungen an Sprache, Vorher- und Nachherwert gebunden

Gemessen am Kandidaten `da61b6ce` (`HISTORIE/nacharbeit-61/PRUEFUNG`): die Suite ist 10/10 grün,
W1 eingeschlossen. Ben hat jedoch einen Prüferfehler belegt (`QUELLEN-HILFE-d31b3303af2c`, Fälle
„unbelegt“ und „entfernt“): `geaendert` war eine bloße Schlüsselmenge. Ein registrierter Schlüssel
ließ deshalb jeden neuen Wert durch, ebenso sein Entfernen. Ein Textverlust im Produkt ist nicht
nachgewiesen. Bearbeitet **ohne eigenen Lauf**:

- **Neues Register:** `tests/support/woerterbuch-geaenderte-werte.ts` führt 36 Einträge
  (12 Schlüssel × de/en/nl, R-0962 und P08). Jeder Eintrag nennt Sprache, Schlüssel, den Wert im
  Bezugspunkt und den belegten Nachherwert. Beide Werte sind wörtlich übernommen, gelesen am
  Bezugspunkt und an `woerterbuch/{de,en,nl}.ts`, nicht aus dem geprüften Baum abgeleitet.
- **Geltung eines Eintrags:** `spaetereAenderungen` erkennt ihn nur an, wenn beides zutrifft:
  - im Block seiner Sprache trägt der Bezugspunkt den Vorherwert genau einmal;
  - der Baum trägt den Nachherwert genau einmal.

  Ein anderer Wert, ein entfernter oder doppelter Schlüssel und eine andere Sprache machen ihn
  ungültig. Dann bleiben seine Zeilen unerklärt, der Grund steht in `unbenutzt`, und die
  Rückführung ergibt nicht VORHER.
- **Neue Gegenprobe W2c:**
  - die erlaubte Änderung wird zugeordnet (Kalibrierung);
  - rot bleiben ein unbelegter Wert, das Entfernen, eine doppelte Zeile und ein vertauschter
    Sprachblock;
  - das echte Register hat 36 Einträge, jeder mit unterschiedlichem Vorher- und Nachherwert.

  W2b (f) ist auf die neue Form umgestellt.

Bezugspunkt `i18n-vor-aufteilung.txt` und die Gegenproben W2/W2b sind sonst unverändert.

## Nacharbeit 60 — W1: die 21 gemeldeten Restzeilen

Gemessen am Kandidaten `e11e51c6` (`HISTORIE/nacharbeit-60/PRUEFUNG`, `woerterbuch-umzugsnachweis-unit`).
Ergebnis: 9 von 10 Fällen grün, darunter W2b und alle vier `ergaenzungen-antwort-quellenanzeige`;
Build und Format bestanden. Rot ist W1 mit **21 Zeilen ohne Zuordnung**. Jede Zeile ist in dieser
Runde einzeln bearbeitet, **ohne eigenen Lauf**:

| Zeilen | Ursache | Änderung |
|---|---|---|
| 9 × `ergebnisStufe.entwurf/.empfehlung/.validiert` (de/en/nl) | Registerfehler aus Nacharbeit 59: die Schlüssel standen als `ai.ergebnisStufe.*` im Register | Namen auf die tatsächlichen Schlüssel berichtigt (R-0603/R-0604) |
| 6 × `seitenhilfe.admin.werk.text` (de/en/nl) | Wert vom Firmenreset P08 mitgeändert (Vorschau, Konten bleiben), fehlte in `geaendert` | in `geaendert` unter P08 aufgenommen |
| 3 × Kommentar in de vor `val.filter` | Nachtrag N-0072 (Prüfboard-Bedienung, `texte/pruefboard.ts`) | als benannte Kommentarzeilen eingetragen (`kommentare`) |
| 3 × nl `capture.ocrRunning` | einzeilig → zweizeilig, Wert wörtlich gleich. Einzeilig wäre die Zeile 101 Zeichen breit (gezählt), über `lineWidth` 100. Ein Zurückbauen machte die Formatprüfung rot. Ein Auftrag für den Umbruch ist nicht belegt | neue Registerart `umbrochen`. Sie gilt nur, wenn jeder Eintrag des Schlüssels (Kopf und Fortsetzung, Leerraum zusammengezogen) vorher und nachher wörtlich gleich ist. Sonst bleiben die Zeilen rot und der Eintrag wird gemeldet |

Neue Gegenprobe W2b (h): ein nur umbrochener Eintrag wird zugeordnet und ergibt Byte für Byte
VORHER. Umbrochen und zugleich im Wert geändert bleibt er rot (3 Zeilen) und wird gemeldet.
**Grenze:** `unbenutzt` wurde im Lauf nicht ausgewertet, weil W1 schon an `unerklaert` abbrach.
Ob jeder Registereintrag seine Abweichung findet, zeigt erst der nächste Lauf.

## Nacharbeit 59 — W1: jede spätere Wörterbuchabweichung einzeln zugeordnet

Bens einziger Befund am Kandidaten `312399c7`: `aufteilung-unveraendert` W1 ist seit Nacharbeit 8
rot (Familie D). Dieser Kandidat hat den Fehler nicht verursacht, er gehört aber zur beauftragten
Gesamtreparatur. Die Textmodulprüfungen ersetzen den historischen Vergleich nicht. Bearbeitet
**ohne eigenen Lauf**. Bezugspunkt `i18n-vor-aufteilung.txt` und die Gegenproben W2 sind
unverändert, `i18n.ts` und die Wörterbücher ebenfalls.

| Abweichung seit dem Bezugspunkt | Zuordnung |
|---|---|
| Sechs Codestellen in `i18n.ts`: Import `sprachregister`, Kommentar R-0997, Textmodulprüfung samt `TEXTMODULE_NACHGELADEN`, Zusammenführung über `OBERFLAECHEN_SPRACHEN`, `ladeWeitereSprache` in `nachladen`, `react.bindI18nStore` | `SPAETERE_CODEAENDERUNGEN`: jede Stelle wörtlich jetzt → vorher, mit Beleg (R-0997/FR-I18N-02, R-0801 Nacharbeit 49, R-1034). Fail-closed: steht eine nicht genau einmal da, bricht der Vergleich ab |
| 298 später ergänzte Schlüssel in de/en/nl (u. a. R-0606, R-0582, R-0961, P08, R-0703/R-1643, Antwort-Erklärung, R-0918, R-0920, R-0953, R-0956, FR-MOB-02, R-0104, arbeitswege-objekt, fragen-pruefen-einstieg) | `SPAETERE_REGISTER.ergaenzt`, je Gruppe mit Beleg. Die fünf Schlüssel aus antwort-quellenanzeige bleiben wie bisher in `ERGAENZTE_SCHLUESSEL` |
| Geänderte Werte: R-0962 „Offene Aufgaben“ (`nav.tasks`, `seitenhilfe.aufgaben.title/.body`, `klara.page.tasks`, `help.tasks.title/.body`); P08 Firmenreset (`adm.factory.help/hint/confirm1/warnBody/restartHint`) | `SPAETERE_REGISTER.geaendert`. Den Wertunterschied habe ich am Bezugspunkt gegen `woerterbuch/de.ts` gelesen |

**Prüfweg:** `spaetereAenderungen` (`tests/support/woerterbuchquelle.ts`) vergleicht Bezugspunkt
und Rekonstruktion Zeile für Zeile (`tests/support/zeilenvergleich.ts`, Myers, ohne Fremdpaket).
- **Erklärt** ist eine Zeile nur als Kopf- oder Fortsetzungszeile eines registrierten Schlüssels,
  oder als Kommentar-/Leerzeile, die mit ihm kam.
- **Rot bleiben:**
  - jede andere Abweichung (fremder Schlüssel, geänderter Wert, umformulierter Kommentar, Code);
  - jeder Registereintrag ohne Abweichung oder im Widerspruch zum Bezugspunkt;
  - ein Baum, der mit zurückgesetzten erklärten Abschnitten nicht Byte für Byte VORHER ergibt.
- **Gegenproben W2b** (neu): ein nicht registrierter Schlüssel, ein geänderter Wert, ein
  umformulierter und ein allein ergänzter Kommentar werden gemeldet; ein toter und ein
  widersprüchlicher Eintrag ebenfalls; die Codezurückführung bricht ab, wenn ihre Stelle fehlt.
  Kalibriert mit einem benannten Schlüssel samt Kommentar, der zugeordnet wird.

**Grenze:** Alle Schlüssel und Codestellen habe ich gezählt, die Werte aber nur für die genannten
Schlüssel verglichen. Weitere Wert- oder Kommentaränderungen sind möglich. Dann nennt W1 sie
zeilengenau; jede ist einem Beleg zuzuordnen oder zu korrigieren, nicht pauschal freizugeben.
Weiter offen sind der Gesamtcheck mit UI-Smoke, getrennt davon CI-Anschluss (`.github`),
PostgreSQL- und Modellzugang.

## Nacharbeit 58 — Messung von `ed51bf71` und die neun roten Fälle

Gemessen am Kandidaten `ed51bf71` (`HISTORIE/nacharbeit-58/PRUEFUNG`). **Grün:**
`http-api-referenz` (4/4), `bestand-unveraendert` K1.1 (jeder Text wie erwartet), F1/F2/F6 des
Freigabe-Wächters, die umgestellten Testaufbauten, die Mounted-Tests von Shell, Assistenz und Klara
und 25 von 26 Smokes (darunter `fe003-tutorial-fragen` und `klara-kontext-tutorial`). Die
Eintrittslast fiel von 1 657 175 B auf **1 554 070 B**; es fehlen noch 194 070 B. **Rot** und in
dieser Runde bearbeitet, wieder **ohne eigenen Lauf**:

| Befund | Ursache | Änderung |
|---|---|---|
| `bestand-unveraendert` K1.0 · Prüfsummen | Die Summen in `bestand-vorher.json` gehörten noch zum Stand vor dem Textnachtrag aus Nacharbeit 57 | Die drei vollen Ist-Summen aus dem Lauf (Zeilen „Received“, `waechter-und-referenz-unit.log`) eingetragen; Anzahl 4437 je Sprache unverändert |
| F4 · `openai-budget-parameter` 43 statt 44 | Die Akte führte 44 Erwartungen, die Datei hat 43 (P1 7 · P2 3 · P3 5 · P4 6 · P5 2 · P6 5 · P7 5 · P8 5 · P9 5). Dieser Auftrag hat die Datei nicht geändert; woher die 44 kam, ist nicht belegt | `gesamtboden` 43, Fallböden P1/P6 unverändert; Begründung an der Akte. F4 bricht beim ersten roten Fall ab: ob spätere Akten stimmen, zeigt erst der nächste Lauf |
| A1 · `bildKorrekturenStand.ts` | Zwei Exporte ohne Aufrufer: `bildKorrekturStand` (nie gelesen) und `verwerfeBildKorrekturen` (nur Tests) | `bildKorrekturStand` begründet entfernt (R-1349); `verwerfeBildKorrekturen` angeschlossen: `useBildKorrekturen` leert den Speicher, sobald kein Konto angemeldet ist — derselbe Weg wie beim Assistenzprofil |
| mega47 · Register der markerlosen Einbinder | `BildFundstelleAnsicht` (OCR-E01, mit dem Basisstand) öffnet das gemeinsame `Modal` | als sichtbar zugewachsener Einbinder eingetragen |
| mega84 · STUFE-1-INVARIANZ 812 statt 808 | Vier Komponenten kamen mit dem Basisstand (Grundmenge 979 → 988), dieser Auftrag hat keine gebaut | Pin folgt der Messung 812; Anbieter 1 und Träger 2 unverändert |
| fe003 · Quellenchip 2× | Seit antwort-quellenanzeige (R-0326, `lib/belegstelle.ts`) führt der Chip einer tragenden Quelle an die Belegstelle (`?stelle=…&fassung=1`) | Erwartung wörtlich auf diese Adresse nachgeführt (nicht aus der Bibliothek gerechnet) |
| Smoke Klara 01 · zwei `klara-figur` | Produkt- und Vorschaufigur zugleich im Baum, nach dem Einschalten der Vorschau. Am Code eingegrenzt: seit Nacharbeit 57 bestehen beide Zweige von `KlaraEbene` nur aus gleichartigen `Suspense`-Grenzen, die React über ihre Stelle weiterverwendet | jede Nachladegrenze trägt einen eigenen Schlüssel; die Grenze des anderen Betriebs wird beim Umschalten entfernt. Die Ursache ist eingegrenzt, nicht gemessen |
| DECKEL · 1 554 070 B | 575 275 B deutsche Textmodulblöcke im Eintritt, auch von Flächen, die erst mit ihrer Seite kommen | siehe unten |

**Eintrittslast: die deutschen Fachtexte kommen mit ihrer Fläche** (Führungsquelle
`QUELLEN-HILFE-92a7ba42e275`: „passende Trennung unter Erhalt aller Texte, Startsprache,
Nachladefehler und Textmodulvertrag umsetzen … Deckel 1360000 B erhalten“). Umgesetzt im
vorhandenen Plugin `sprachpakete-nachladen`, nur im Produktionsbau:
- **Auswahl:** Erhoben wird die statische Eintritts-Hülle im Quelltext ab `main.tsx`, über statische
  Importe; `import()` wird nicht verfolgt. Ein Textmodul gibt seinen deutschen Block ab, wenn keine
  Datei dieser Hülle eine Zeichenkette mit seinem Präfix nennt. Module mit Altnamen und direkt
  importierte Module bleiben ganz. Die Erhebung irrt nur zur sicheren Seite: Auch ein Kommentar
  hält ein Modul im Eintritt.
- **Startsprache:** Deutsch bleibt Startsprache. Die Hülle trägt jeden deutschen Text, den sie
  nennt, und zeigt ihn ohne Warten. `i18n.ts` ist unverändert (W1).
- **Warten:** Seiten (`routes.tsx`, über einen gleichnamigen `lazy`, die Seitenzeilen bleiben
  wörtlich) und die nachgeladenen Flächen der Hülle laden Stück und Fachtextpaket gleichzeitig
  (`lib/fachtexte.ts`, `mitFachtexten`).
- **Nachladefehler:** Bleibt das Paket aus, scheitert eine Seite wie ein ausbleibendes Seitenstück
  (dieselbe Fehlergrenze; ein alter Tab bekommt „neue Version“). Eine Fläche der Hülle erscheint
  trotzdem. Ein späterer Aufruf lädt erneut.
- **Textmodulvertrag:** Er ist unverändert. Tor und `textmodul-vertrag` prüfen die Quellen, und
  gepflegte Texte (R-1034) werden nicht überschrieben.

**Gegenproben:**
- `sprachpakete-nachladen` Block F: Erhebung in beide Richtungen kalibriert, Auswahlregel, Paket
  wörtlich gleich den deutschen Blöcken, fail-closed Anker, Warten und Fehlschlag.
- T1 nimmt jetzt `navigation` statt `hilfefaq`, weil `hilfefaq` mit dem nachgeladenen Hilfeknopf
  Fachtext wurde.
- Neuer DECKEL-Fall am gebauten Bündel: Das Paket liegt in genau einem Stück außerhalb der Hülle,
  und **kein Modul, das wirklich in der Hülle liegt, nennt ein ausgewähltes Präfix**.

Wie viele Bytes das spart, ist **nicht gemessen**. Den Deckel entscheidet erst der Lauf. Reicht
der Schnitt nicht, nennt der DECKEL-Fall die verbleibende Zusammensetzung.

Unverändert offen: `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts` W1 ist seit
Nacharbeit 8 rot (Familie D). Diese Runde fasst `i18n.ts` nicht an. Getrennt offen bleiben
CI-Anschluss (`.github`), PostgreSQL- und Modellzugang.

## Nacharbeit 57 — Freigabe-Wächter, API-Referenz, Textnachtrag, Eintrittslast

Bearbeitet am Kandidaten `d5c99473`. **Nichts davon ist gemessen**: In dieser Runde lief kein Test.
Alle Aussagen unten sind statisch am Code geprüft; erst der Prüfplan misst sie.

| Befund (Ben) | Stand |
|---|---|
| F1 · Helfernutzer ohne Register und Fallakte | **bearbeitet**: 20 neue Einträge in `FREIGABE_ERLAUBT`, jeweils mit Grund über 60 Zeichen. 94 Helfernutzer = 94 Registereinträge = 94 Fallakten (von Hand gezählt) |
| F2 · Freigabefelder von Hand gesetzt | **bearbeitet**: `referenzki-pruefdienst/beobachtung.ts` und `referenzki-adminauswahl/route-einstieg.test.ts` setzen die Freigabe jetzt über `mitKiFreigabe`. `firmenfilter-api.test.ts` setzte über `erteileKiFreigabe` vertrauliche Inhalte frei (zweites Argument, `VERTRAULICH_ERLAUBT` bleibt `[]`) und nutzt jetzt eine lokale Modellattrappe (`ModelProvider` als lokaler Anbieter); geprüft wird dasselbe Filterverhalten. Der Wächter sucht die Feldnamen jetzt mit Wortgrenze. Drei Dateien lesen `kiFreigabe` nur aus und stehen mit Grund in `FELDNAMEN_NUR_LESEND`; dort zählt nur ein schreibendes `kiFreigabe`. Die Kalibrierung prüft beide Richtungen: fremd, lesend, schreibend |
| F4 · Fallakten veraltet | **bearbeitet**: Fünf Akten waren nach Fallzuwachs verschoben: `extract` (`#15`→`#16`), `mega61` (jetzt vollzählig, Vorspann `erteileKiFreigabe(r)`), `v2-einwilligung`, `anbieterbindung`, `einwilligung-anbieter-je-aufgabe`. Die 20 neuen Akten sind Fall für Fall aus dem Code gezählt. Jeder `boden` ist eine **Untergrenze** (ausgeführte `expect(`-Stellen ohne `expect.soft`), kein gemessener Wert |
| F6 · Modellweg ohne Eintrag | **bearbeitet**: `reasoner/model-client-denkblock.test.ts` und `reasoner/r1643-argumentationskette.test.ts` stehen als (C) mit Grund in `OHNE_FREIGABE_MIT_GRUND`: Sie bauen den Reasoner, rufen aber keinen Freigabeweg |
| `http-api-referenz` · Routen ohne Zeile | **bearbeitet**: neue Abschnitte 3.12–3.21 und Einzelzeilen. Jede Zeile ist am Routencode gelesen, mit dem Recht an der Registrierung. Ergänzt sind Verantwortung, Vorlagen, Unternehmensprofil/Richtlinien/Kommunikation, Veröffentlichung/Kenntnisnahme/Wissensauskunft/Empfehlungen, Datenschutz/Assistenz/Gedächtnis, Klara-Gespräche/Aufträge/KI-Arbeitsbegleitung/Notizen/Aufgaben/Fähigkeiten, Chat/Paarpflichten/Begriffe, Spaces und Teams, Office und WOPI, technische Daten und Ausgangsprüfung. Dazu kommen Bestandsreset, Werksreset-SSO, `reasoner/ausfuehrung`, `ki-lage`, `PUT auth/me`, `klara/…/execute`, `existenzhinweise`, `bausteine/…/uebernehmen`, `sharepoint/testbibliothek` und `admin/import/knowledge/:koId`. Die veralteten Werksreset-Zeilen (Rumpf, Fehler) sind nachgezogen. Ein statischer Abgleich aller literal registrierten Routen (522 Fundstellen) und der Konstantenpfade (`/mcp`) zeigt keine weitere fehlende Zeile. `/word-addin/taskpane.html` und `/api/admin/wiederanlauf*` registriert nur `server.ts`, nicht die Testbühne. Verwaiste und doppelte Zeilen prüft erst der Lauf (A2) |
| `bestand-unveraendert` · Textnachtrag | **teilweise**: Die 18 belegten Textänderungen stehen einzeln in `werte-vorher.json` (Nacharbeit 57, erster Teil). **Die Prüfsummen in `bestand-vorher.json` sind nicht nachgezogen.** Sie sind SHA-256 über die kanonische Form (`bestand-erzeugen.ts:86`), also nur maschinell berechenbar. Der Rechenbefehl, ein reines Lesen ohne Test, wurde in dieser Sitzung von der Ausführungsumgebung abgewiesen. Anzahl je Sprache (4437) bleibt gleich. K1.0 meldet die Ist-Summen aller drei Sprachen in **einem** Lauf (`expect.soft`, Zeile „Received“); mit ihnen ist der Nachtrag eine reine Übernahme |
| R-0801 · Eintrittslast 1 657 175 B > 1 360 000 B | **verkleinert, ungemessen**: `KlaraAssistant` (Shell) und `TutorialBereich` (Tutorialrahmen) werden jetzt vorab angestoßen und über `lazy` nachgeladen, mit `Suspense fallback={null}`. Damit verlassen auch `klaraRegistry` und `lib/faqContent.ts` die Hülle. Funktionen und Texte bleiben; die Startsprache bleibt im Eintritt. Nach der Zusammensetzung aus Nacharbeit 53 sind das ≈ 68 KB (37 924 + 16 162 + 13 906 B) zuzüglich `klaraRegistry`. Es bleibt eine Lücke von ≈ 229 KB |

**Zur Eintrittslast, ohne Widerspruchsbehauptung.** Die Führungsquelle
(`QUELLEN-HILFE-92a7ba42e275`) verlangt wörtlich: „passende Trennung unter Erhalt aller Texte,
Startsprache, Nachladefehler und Textmodulvertrag umsetzen … Deckel 1360000 B erhalten“. P1 verlangt:
„Bestehende Kontrast-, Schrift- und Bündelgrenzen zunächst unter Erhalt aller bestellten Funktionen
einhalten. Keine bloße Grenzwertanhebung“. Einen verbindlichen Originalwortlaut, der beides
**unvereinbar** macht, belege ich nicht. „Startsprache“ verlangt Deutsch beim Start, nicht jeden
deutschen Fachtext in der Hülle. Der verbleibende Hebel ist deshalb der deutsche Text der
Fachflächen (≈ 994 KB samt Wörterbuch). Er muss mit seinen Seitenstücken kommen, und
dafür muss die zentrale Sammlung (`import.meta.glob` in `i18n.ts`, JOB 4367) je Fläche getrennt
werden. Den Text der Starthülle und den Textmodulvertrag (`modulvertrag.test.ts`) darf das nicht
berühren. Das ist ein Umbau über zahlreiche Module mit Zuordnung Modul → Fläche und einem Wächter
„kein Schlüssel der Starthülle in einem nachgeladenen Modul“. Er ist in dieser Runde **nicht**
begonnen, weil die Wirkung der beiden ersten Schnitte zuerst gemessen werden soll und eine
ungemessene Teilung von 994 KB Text nicht belegbar wäre. Der Deckel ist unverändert.

Weiter offen: Messung aller Punkte oben (Prüfplan), Prüfsummen aus K1.0 übernehmen, Textteilung
der Fachflächen, danach der Gesamtcheck mit UI-Smoke. Getrennt offen bleiben CI-Anschluss
(`.github` liegt außerhalb der erlaubten Pfade), PostgreSQL- und Modellzugang.

## Nacharbeit 56 — Rollenabnahme: die letzte Gruppe

Gemessen am Kandidaten `a674131b`: `rollen-am-draht`, `schreibende-tueren-am-draht`,
`unbekannte-rolle-sperrt`, `zweifaktor` und `firmenreset-sso` sind grün, damit auch alle 62 neuen
Zeilen aus Nacharbeit 55 an allen fünf Akteuren. Rot war nur die inzwischen über main
hinzugekommene Gruppe `technischeDatenRoutes` (vier Schreibwege: Vorschau, Übernahme,
Quellenabgleich, Quellenrechte). Sie hat jetzt vier gemessene Zeilen: ko.create bzw. ko.validate;
ein leerer Rumpf endet in der Eingabeprüfung (`leseEingang`/`pruefeAbschnitt`, 400), es wird nichts
geschrieben.

## Nacharbeit 55 — Deckel weiter offen (Entscheidung fehlt); Rollenabnahme bearbeitet

Der Deckelbefund ist derselbe wie in Nacharbeit 53 und 54 (gleicher Fingerabdruck); eine
Entscheidung zum Zielkonflikt liegt nicht vor. Statt dieselbe Messung ein drittes Mal
einzuplanen, ist der Restumfang aus Bens Befund bearbeitet: die **Rollenabnahme**
(`tests/beta-rollenabnahme/`, in Nacharbeit 26 rot):

| Befund (Nacharbeit 26) | Stand |
|---|---|
| W2: fünf Routengruppen ohne Zeile (vorlagen, freigaberegeln, teams, verantwortung, chat) | **bearbeitet** — jede hat jetzt gemessene Zeilen |
| E2/E8: 65 Türen ohne Platz | **bearbeitet** — 62 gemessene Zeilen in `TABELLE`, Muster nach dem Recht an der Registrierung (Belegstelle je Zeile). Gelesen wird mit erfundener Kennung, geschrieben mit leerer Nutzlast (Eingabeprüfung oder 404, kein Bestand verändert; für `begriffe/ausfuehren` und `deaktivierung` am Code geprüft). `setup` des zweiten Faktors misst mit dem Bühnenpasswort. Drei Türen des zweiten Faktors (`login/second-factor`, `confirm`, `disable`) stehen als `baulich` in der Restliste: Sie kommen nur mit einem einmaligen Zeitcode am Tor vorbei und antworten sonst mit demselben Schlüssel wie das Tor. Gemessen sind sie in `tests/zweifaktor/` |
| E5b: Werksreset-SSO als `baulich` ohne namentliche Freigabe | **bearbeitet** — beide namentlich in `BAULICH_ERLAUBT`, Begründung wie in `tabelle.ts` (nur Desktop-Journalbetrieb, auf der Bühne serverseitig unerreichbar; Einmalcode des Anbieters) |
| R7: `reply.header is not a function` | **bearbeitet** — die Antwort-Attrappe kennt `header` wie Fastify; `requireUser` setzt seit peter-p14 den Rechtekontext-Kopf. Das geprüfte Nein (403, FORBIDDEN) ist unverändert |

Die Zeilen sind hand geschrieben, nicht aus `ROLE_PERMISSIONS` gerechnet. Ob jede Tür wie
erwartet antwortet, entscheidet erst die Messung am Draht (`rollen-am-draht.test.ts`).

Weiter offen: Deckel R-0801 (Entscheidung), F1/F2/F4/F6, http-api-referenz,
`bestand-unveraendert` (Nachtrag mit Prüfsumme), danach der Gesamtcheck mit UI-Smoke.

## Nacharbeit 54 — derselbe Deckelbefund, keine Entscheidung eingegangen

Am Kandidaten `d1ba1425` ist die Messung unverändert: Eintritt 1 657 175 B, Luft −297 175 B,
gleicher Fingerabdruck wie in Nacharbeit 53. Zum dort vorgelegten Zielkonflikt (R-0801 ↔
Startsprache im Eintritt ↔ zentrale Textmodulsammlung aus JOB 4367) liegt keine neue Quelle
und keine Entscheidung vor. Ohne sie wäre jeder weitere Schnitt eine selbst gewählte Lösung des
Konflikts. Die Codekandidaten (≈ 80 KB) erreichen den Deckel nicht. Eine erneute Ausführung
derselben Messung erbringt nichts Neues. Der Fall bleibt rot, bis eine der beiden Optionen
entschieden ist.

## Nacharbeit 53 — R-0801: gemessene Zusammensetzung und ein belegter Zielkonflikt

Gemessen am Kandidaten `cd9e4153` (`HISTORIE/nacharbeit-53/PRUEFUNG`): `rechte-office-unit`
85/85 grün (mega74 samt WOPI-Kette, g10, Route-Guard-Audit, Office O1–O12, Nachbearbeitung).
`eintritt-ohne-seiten` 24/25; rot ist nur der Deckel. Eintritt 1 657 175 B, Deckel 1 360 000 B,
Luft −297 175 B.

**Zusammensetzung der Eintritts-Hülle** (ausgelieferte Bytes je Modul, Quellkarte):

| Gruppe | Bytes |
|---|---|
| Textmodule `texte/` (deutsche Blöcke, `anmeldefehler` vollständig) | 575 275 |
| Wörterbuch `woerterbuch/de.ts` | 418 800 |
| eigener Code `apps/web/src` | 365 998 |
| Fremdpakete (davon `react-dom` 129 658, `i18next` 48 657, Router ≈ 18 000) | 273 588 |
| Rahmen | 12 807 |
| `lib/lesevariante.ts` | 10 707 |

**Rechnung:** Der deutsche Text der Startsprache allein beträgt 994 075 B, das sind 73 % des
Deckels. Mit dem unverzichtbaren Grundgerüst (`react-dom`, `i18next`, Router) und dem Rahmen sind
es ≈ 1 204 000 B. Für den gesamten übrigen Code der Hülle blieben ≈ 156 000 B; heute sind es
≈ 443 000 B (366 KB eigener Code, 77 KB weitere Fremdpakete). Die größten verschiebbaren
Codekandidaten (`lib/faqContent.ts` 37 924 B über `klaraRegistry`, `KlaraAssistant` 16 162 B,
`TutorialBereich` 13 906 B, `lib/docx.ts` 9 554 B) bringen zusammen rund 80 KB. Das sind nicht die
nötigen 297 KB.

**Der Zielkonflikt, mit Quellen:**
- R-0801 (wörtlich im Kopf des Deckelblocks, `eintritt-ohne-seiten.test.ts:1593`): „Ein
  verbindlicher Deckel von etwa 1,36 Megabyte verhindert, dass er unbemerkt weiterwaechst". Er wurde
  als −30 % gegen damals 1,95 MB gewählt; dieser Wert enthielt alle drei Sprachen.
- Die Umsetzung von R-0801 (`:1723`): „Deutsch bleibt im Eintritt: die Startsprache darf nicht erst
  nachgeladen werden."
- JOB 4367 (`apps/web/src/i18n.ts:57–61`): Die Textmodule werden zentral über `import.meta.glob`
  eingesammelt — „Es gibt also kein dynamisches Nachladen".

Unter diesen drei Vorgaben ist der Deckel nicht erreichbar, solange der deutsche Text der
Fachflächen wächst. Ein weiteres Verschieben in ein beim Start abgewartetes Nachbarstück wäre genau
das Unterlaufen, das der Deckelblock ausschließt („die Eintrittsdatei würde kleiner, der Erstabruf
nicht").

**Verbleibende Entscheidung (nicht von mir gewählt):**
1. Deutscher Text der Fachflächen kommt mit den Seitenstücken. Die Textmodule werden dafür von
   ihren Nutzern eingebunden statt zentral eingesammelt. Das ist ein Architekturumbau gegen die
   zentrale Sammlung aus JOB 4367, braucht eine Zuordnung Modul → Fläche samt Wächter (kein
   Schlüssel der Starthülle darf in einem nachgeladenen Modul stehen) und belastet die
   Erstlast-Messung je Seite (d2).
2. Den Deckel ausdrücklich neu entscheiden. Der Test nennt diesen Weg selbst: „verkleinern oder die
   Grenze ausdrücklich neu entscheiden — nicht still heben". Messbasis wäre der heutige Eintritt
   1 657 175 B mit seiner Zusammensetzung.

Bis dahin bleibt der Deckelfall rot. Grenze, Startsprache und Textmodulvertrag sind unverändert.

## Nacharbeit 52 — erste Bündelmessung der Textmodulteilung und die Restbefunde

Gemessen am Kandidaten `82e75089` (`HISTORIE/nacharbeit-52/PRUEFUNG`):

| Fall | Messung / Stand |
|---|---|
| R-0801 Deckel | **gemessen, weiter rot.** Eintritt **1 657 175 B** (Nacharbeit 26: 2 698 517 B, also −1 041 342 B), Deckel 1 360 000 B, Luft −297 175 B. Sprach- und Textmodulpakete liegen je außerhalb der Hülle (Textmodule en 522 699 B, nl 546 558 B). Im Eintritt bleiben 578 075 B Textmodule (deutsche Blöcke und das vollständige `anmeldefehler`). Alle übrigen Fälle der Datei sind grün, auch d/d2/c1–c4. **Nächster Schritt:** Der Deckelfall gibt jetzt die Zusammensetzung der Hülle aus (Gruppen Wörterbuch, Textmodule, Fremdpakete, eigener Code, Rahmen sowie die 30 größten Module, in ausgelieferten Bytes). Der verbleibende Schnitt wird daran gewählt, nicht geraten. Den deutschen Text der Startsprache (Textmodule plus Wörterbuch, zusammen rund 1 MB) nicht nachzuladen, bleibt Bedingung |
| `i18n-textmodule/bestand-unveraendert` K1.1 (6 de-Abweichungen) | **fremder Basisbefund, schon in Nacharbeit 26 rot.** Die Werksreset-Texte (`adm.factory.*`, `seitenhilfe.admin.werk.text`) hat die Bestandsreset-Lieferung absichtlich neu gefasst (`texte/bestandsreset.ts`, `services/app/src/factory-reset.ts`): Konten, Firmenwörterbuch und Prüfprotokoll bleiben. Der Test verlangt dafür einen Nachtrag in `werte-vorher.json` UND die neu berechnete SHA-256 in `bestand-vorher.json` (K1.0). **Fehlendes Mittel:** Die Prüfsumme lässt sich ohne Ausführung nicht bilden, ein Nachtrag ohne sie macht K1.0 rot. Die Textmodulteilung prüft dieser Fall nicht (er läuft im Quelltextmodus); er ist deshalb aus der Auftragsauswahl genommen und bleibt global rot, bis jemand die Neufassung mit Lauf nachträgt |
| `office-artikel-editor/office-routes` O4/O10 | **bearbeitet, schon in Nacharbeit 26 rot.** Ursache: Der Testartikel hatte keine Vertraulichkeitsstufe und war nach Entscheidung 16 für den zweiten Experten unsichtbar (404 an der Sitzung, danach keine gültige Marke). Er ist jetzt `intern` eingestuft wie in `tests/assistenz-dokumentnachbearbeitung/`; der Vertraulichkeitsfall stuft selbst um |
| `g10` 13 Routen ohne Zeilenrecht, `…/befunde` verwaist | **bearbeitet.** Die gemessenen Prädikate sind eingetragen (`darfSehen` bzw. `sichtbarkeitsfilterFuer`; Import-Quellrevision, technische Daten ×2, BPA-13 ×10). Bei `…/candidates/befunde` ist das Zeilenrecht entfernt: `darfKandidatSehen` ist weder Prädikat aus sichtbarkeit.ts noch lokaler Helfer |
| mega74: vier WOPI-Wege | **bearbeitet, verhaltensneutral.** Die Route ruft `wopi` sichtbar auf, und die eingereichte Rechteprüfung ist als benannte Funktion `rechte` herausgezogen (Inhalt unverändert). Damit ist die vorhandene Kette nachprüfbar: Route → `host.bearbeite` → (`bearbeiteSeriell` → `deps.rechte`) → `rechte` → `rechteFuer` → `darfSehen`; Urteil `DIENST_FILTERT`. Hostprotokoll und Antworten bleiben unverändert |

Route-Guard-Audit (25/25), Nachbearbeitung und Wiederanlauf waren in diesem Lauf grün.

## Nacharbeit 51 — Bündelmessung ausgewählt, mega74 und Route-Guard-Audit bearbeitet

Gemessen am Kandidaten `02272bce` (`HISTORIE/nacharbeit-51/PRUEFUNG`):
`integration-torausnahme-unit` 39/39 und `integration-profil-bildkorrekturen-unit` 39/39 grün.
Darin enthalten sind die Gegenfälle E7–E7h zur Enginezuordnung in `tests/tor-vertrag/pruefvertrag.test.ts`.

**R-0801 (Befund 2).** Die in Nacharbeit 49 geplante Bündelmessung ist nie gelaufen: Nacharbeit 50
war eine Integration, und deren Prüfauswahl ersetzte den Plan. Es fehlt also die Ausführung, keine
Implementierung. Der Prüfplan wählt jetzt `tests/erstladezeit/eintritt-ohne-seiten.test.ts`
(Deckel 1 360 000 B unverändert, Lage der Sprach- und Textmodulpakete, gemessener Textmodulanteil
im Eintritt) samt Textmodul-, Sprachpaket-, Sprachschalter- und Anmeldefehler-Gegenproben.
2 698 517 B bleibt die historische Messung von `e09f6e4c`. Ob der Deckel jetzt hält, entscheidet
erst dieser Lauf.

**mega74-lesewege-sammler (Befund 1).**

| Befund (Nacharbeit 26) | Stand |
|---|---|
| `wiederanlauf.ts:268` — Pfad nicht auflösbar | **bearbeitet.** Der Freigabepfad steht als Literal-Konstante `WIEDERANLAUF_FREIGABE_PFAD` derselben Datei; der Weg selbst ist unverändert |
| 26 Routen ohne Urteil | **22 + 2 beurteilt:** Klara-Aufgaben und -Notizen ×10 `EIGENER_BESTAND` (Konto nur aus der Sitzung); `POST /api/gaps/:id/zurueckweisen` `PRAEDIKAT` (Vorgangssicht über `beteiligterAus` → `sichtbarkeitsfilterFuer`); `GET …/candidates/befunde` `KEIN_KO_INHALT` wie die Liste; Office-Artikelseite ×7 `PRAEDIKAT` (`artikelOder404` → `darfSehen`); Vorführung ×2 `KEIN_KO_INHALT` (fester, erfundener Bestand); Wiederanlauf GET und Freigabe `KURATORENTOR users.manage` |
| — die vier `/wopi/files/…`-Wege | **offen, konkret begründet.** Ihre Rechteprüfung liegt im Host (`office-wopi-host.ts`, `deps.rechte` → `rechteFuer` → `darfSehen`, bei jeder Anfrage frisch). Der Sammler verfolgt weder den als Argument übergebenen Handler noch eine beim Hostbau eingereichte Entscheidung. Eine sichtbare Vorprüfung an der Route würde das Hostprotokoll abgewiesener Zugriffe (Vorgang „Datei“, 404) umgehen. Das ist eine Verhaltensänderung und deshalb nicht eingebaut. Nötig ist entweder eine Sammlerform für eingereichte Entscheidungen oder ein Hostumbau, der `darfSehen` selbst ruft |
| `GET /api/klara/answers/:answerId/explanation` — Filterstelle | **bearbeitet.** Die Leser-Eigenschaft heißt seit der Integration mit gesamt-leserechte `darfSehen`, nicht mehr `sichtbar`; Register auf `filter.eigenschaft`/`anwendung` = `darfSehen` nachgeführt (angewendet in `objektSichtbar`) |
| 5 Ausgangsstellen ohne Urteil | **bearbeitet:** Push ×2 und WOPI-Discovery `KEIN_KO_INHALT`; lokale Transkription und interner Embedding-Server `AUFTRAGSVERARBEITER` |

**route-guard-audit (Befund 1).**

| Befund | Stand |
|---|---|
| 23 Routen ohne Matrixzeile, Wiederanlauf ohne Eintrag | **bearbeitet.** Rechte wie an der Registrierung, Zeilenrechte wie gemessen (`g10`); WOPI als `public` mit Begründung (HMAC-Zugangsmarke je Anhang, vor dem Parsen geprüft, sonst 401) |
| `POST /api/ask`, `…/execute`: „action-dispatched“ | **Ursache: Scannerartefakt.** P05/B-10 ergänzte im selben Block `nachpruefung: () => guards.requirePermission("ko.read", …)`; der Scanner zählte zwei Vorkommen desselben Rechts als mehrere Aktionen. Er zählt jetzt verschiedene Rechte; Kalibrierfall: zweimal dasselbe bleibt dieses Recht, zwei verschiedene bleiben `action-dispatched`. `PUT /api/kos/:id` bleibt `action-dispatched` |
| Office-Fassungsschritte „öffentlich-mutierend“ | **Ursache: Bauform.** `vorFassungsschritt` forderte `ko.create` selbst und lag dadurch im Block der Übernahme. Jetzt fordert jede Route `ko.create` selbst und reicht den Nutzer herein, mit demselben Recht in derselben Reihenfolge |
| WOPI-POST öffentlich-mutierend | **bearbeitet.** In `OEFFENTLICH_MUTIEREND_ERLAUBT` mit demselben Grund wie der Übergabecode: Server-zu-Server-Aufruf mit mitgebrachtem Nachweis |

Weiter offen: F1/F2/F4/F6 (`routing-zwei-attrappen`), `http-api-referenz`,
`beta-rollenabnahme`, die vier WOPI-Wege in mega74 und danach der Gesamtcheck einschließlich
UI-Smoke. Getrennt offen bleiben CI-Anschluss, PostgreSQL- und Modellzugang.

## Nacharbeit 50 — Integrationskonflikte mit main `01378570`

- `tests/smoke/tor-ausnahme.test.ts`: Dieser Auftrag hat die Ausnahmeliste nach
  `tests/smoke/tor-ausnahmen.json` verlagert, damit Pin und Torbericht dieselbe Datei lesen. main hat
  inline den Fall OCR-E02 (`klara-ocr-fundstelle-korrektur-browser.spec.ts`) ergänzt. Aufgelöst:
  Die JSON-Datei bleibt die einzige Liste, OCR-E02 steht dort mit seinem vollständigen Titel, und
  seine Begründung aus main steht in der Gründeliste des Tests. Der Pin zählt damit elf Fälle.
- `services/app/src/assistenz-profil.ts`: HEAD importiert die Typen ohne Rückkante aus den
  `-typen`-Dateien (no-circular gilt auch für Typimporte, `tsPreCompilationDeps: true`). main hat
  `BildKorrekturStand` aus `assistenz-bildkorrekturen.ts` ergänzt; diese Datei importiert ihrerseits
  `AssistenzProfilRepo` aus dem Profil. Damit entstünde genau der Zyklus, den die `-typen`-Dateien
  vermeiden. Aufgelöst nach demselben Muster: `BildKorrekturEintrag` und `BildKorrekturStand` stehen
  in `assistenz-bildkorrekturen-typen.ts`, der Dienst reicht sie unverändert weiter, und das Profil
  importiert aus der Typdatei. Die Bildkorrektur-Funktion aus main bleibt vollständig erhalten.

## Nacharbeit 49 — Enginezuordnung, Bündelteilung der Textmodule, Jira-Anker-Weg

Bens Befunde am Kandidaten `9a6c0b0c`, Beleg `QUELLEN-HILFE-92a7ba42e275-ENGINEZUORDNUNG-UND-BUENDEL.json`:

| Befund | Stand |
|---|---|
| `tools/tor-bericht.mjs:257` zählt `smoke:ui:gate:drei --project=chromium-zustand` für alle drei Engines | **bearbeitet.** Die Smoke-Regeln im Vertrag tragen jetzt `engines` (Stufe → Playwright-Projekte); eine Regel auf eine Browserstufe ohne diese Zuordnung bricht den Bericht ab (Code 2). Je Browserstufe gilt: nicht per `--project` ausgewählt → nicht ausgeführt; ohne Exitcode → unbekannt; ohne lesbaren Playwright-Laufbericht `<name>.json` → unbekannt, nie gefahren; im Bericht kein Fall dieser Projekte mit einem Ergebnis außer `skipped` → nicht ausgeführt; sonst gefahren, mit Projekten und Zahl gelaufener und bestandener Fälle. Setup-Projekte zählen nie. Gegenfälle E7–E7h in `tests/tor-vertrag/pruefvertrag.test.ts`, darunter der Lauf aus Nacharbeit 49 (4 von 13 Stufen) |
| R-0801: Textmodule eager mit allen Sprachen im Eintritt | **umgesetzt, Messung steht aus.** Das Plugin `sprachpakete-nachladen` schneidet im Produktionsbau die Blöcke en/nl aus jedem Textmodul aus (leerer Block plus Leerzeilen, keine Zeile verrutscht) und liefert sie in `i18n.textmodule.<sprache>.js`. `NACHLADEN` holt Wörterbuch- und Textmodulpaket gemeinsam; scheitert eines, fällt der Nachlader wie bisher auf Deutsch zurück. Direkt importierte Module (heute `texte/anmeldefehler`, das `auth/maskenfehler.ts` in allen Sprachen liest) bleiben vollständig. Die Startprüfung in `i18n.ts` nimmt über `TEXTMODULE_NACHGELADEN` nur LEERE Blöcke der nachgeladenen Sprachen hin; den vollen Vertrag prüfen weiter Tor und Build-Plugin `textmodul-vertrag` an den Quellen. Gegenproben: Block T in `tests/erstladezeit/sprachpakete-nachladen.test.ts` (Paket = Quellen, Fail-closed, Startprüfung) und im Block DECKEL von `eintritt-ohne-seiten.test.ts` die Lage der Textmodulpakete außerhalb der Hülle sowie der **gemessene** Textmodulanteil im Eintritt. Ob der Deckel von 1 360 000 B damit hält, ist nicht gemessen; die Grenze ist unverändert |
| `re-import-dubletten/port-aufrufer-waechter` W0/W1 (Jira-Übernahme ohne Port) | **bearbeitet.** Die Jira-Übernahme ist ein vierter Anker-Weg mit der am Code belegten SharePoint-Begründung: Der Mapper setzt `externalId` an jedem Item, und die Route gibt es nur bei `jiraImport`, der auch den Upsert-Strang einschaltet. Sie steht jetzt im Register; der harte Pin ist auf fünf Nennungen nachgeführt. W4 macht den Eintrag rot, sobald der Port übergeben wird |

Weiter offen: F1/F2/F4/F6 (`routing-zwei-attrappen`), `http-api-referenz`, `beta-rollenabnahme`,
`route-guard-audit` und `mega74`; danach der Gesamtcheck einschließlich UI-Smoke. Getrennt offen
bleiben CI-Anschluss (`.github`-Schreibrecht), PostgreSQL- und Modellzugang.

## Nacharbeit 48 — vier rote Fälle aus der gezielten Prüfung von `1ca7df4b`

Gemessen in `HISTORIE/nacharbeit-48/PRUEFUNG/`: `ausgehende-ziele-unit` grün. Rot waren vier Fälle,
keiner davon durch die Änderungen aus Nacharbeit 47 verursacht:

| Fall | Ursache und Änderung |
|---|---|
| mega40 „Sammler erreicht jede Fundstelle“ (4 Stellen) | Bisher verdeckt, weil die Datei vorher an `text-klein` abbrach. Zwei Stellen liegen in der Testdatei `legal/kontrast-dom-paarungen.test.tsx`; das ist keine Produktfläche, und der Sammler liest Testdateien jetzt nicht mehr. Zwei sind echte Sammlerlücken: `Qualitaetsaufgaben.tsx` nimmt die Flächenklasse aus der Tabelle `ZUSTAND_PUNKT[…] ?? ""`, `UiKit.tsx` aus der Liste `FARBEN.map((f) => … f.klasse)`. Der Sammler löst beide Bauformen jetzt auf, je Eintrag als eigener Zweig und nur bei der Flächensuche, nicht für Vorfahren und Kinder |
| mega40 „Akzentflächen ohne Text nur mit Ausnahme“ | Neu sichtbare, rein grafische `bg-brand`-Punkte ohne Text, jeweils `aria-hidden`: der Zeigepunkt in `bibliothek/Zeichnung.tsx`, der Zustandspunkt in `Qualitaetsaufgaben` und das Farbmuster in `UiKit`. Sie sind als benannte, begründete `GRAFISCHE_AUSNAHMEN` mit exakter Klassenmenge eingetragen. Die bestehenden Prüfungen (keine Ausnahme über Text, keine unbenutzte Ausnahme) gelten unverändert |
| mega62 F „title trägt den Sofort-Satz“ | Eine fremde Lieferung hat den Chip-`title` in `Ask.tsx` bedingt gemacht (Fiktiv-Hinweis). Der Sofort-Satz steht dort in beiden Zweigen, die wörtliche Suche nach `title={t(KEY)}` fand ihn aber nicht mehr. Der Fall liest den `title` jetzt per AST und verlangt den Satz in **jedem** Zweig; ein neuer Kalibrierfall zeigt, dass ein Zweig ohne den Satz auffällt |
| `klara-eigeninitiative` M4 Zeile 502 (schon in Nacharbeit 26 rot) | Produktfehler: „Meine persönlichen Aufgaben“ (`KlaraAufgaben.tsx`) trug dieselben Kennungen `klara-aufgaben` und `klara-aufgaben-leer` wie die Übersicht der übertragenen Aufgaben (M4). Im Modus „Nur auf Nachfrage“ verschwand die Übersicht, gefunden wurde aber die andere Fläche. Die persönlichen Aufgaben heißen jetzt `klara-persoenliche-aufgaben`(`-leer`); `tests/klara-aufgaben/aufgaben-am-server.test.tsx` ist nachgezogen |

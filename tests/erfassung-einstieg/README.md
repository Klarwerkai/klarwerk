# Aufnahme `gesamt-erfassung-einstieg` — Abgleich, Lieferung, offene Entscheidungen

Auftrag `aufnahme:20260922:gesamt-erfassung-einstieg` (Aufgabenrevision 2, Lauf
`lauf:b3:aufnahme:20260922:gesamt-erfassung-einstieg:1`, Runde 1). Basisstand `b836417d`
(`1.0.0-beta.1.630`). Stand dieser Datei: 29.09.2026.
Auftragsquelle: `klarwerk_steuerung/gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/auftragsquellen/erfassung-einstieg.json`
(42 Aufnahmepunkte; Originalwortlaut in den dort genannten `quellenpakete/aufnahmepunkte-0NN.json`).

Die Quelle führt die Punkte mit Stand „Historische Aussage, heutige Erfüllung nicht erneut
geprüft". Jede Einstufung unten ist deshalb **am Basisstand im Code gemessen** (Datei:Zeile,
Test) — nicht aus der Quelle übernommen. Wo nur ein älterer Joblauf als Beleg dient, steht das
dabei. „Live" heißt: an einer laufenden Instanz gesehen; das hat dieser Lauf **nicht** getan.

## Die tragende jüngere Entscheidung

Seit JOB 3062 (H3, LIVE `1.0.0-beta.1.106` ff.) zeigen `/erfassen`, `/erfassen/neu` und
`/erfassen/vordertuer` **dasselbe Blatt** (`apps/web/src/components/erfassen/Blatt.tsx`;
`pages/CaptureFrontDoor.tsx:19-34`, `pages/Capture.tsx:7394-7413`). Das folgt Pedis Zielbild
R-1578: „eine Fläche mit Titel, Text, Bereich, Vertraulich, Einreichen, Entwurf sichern;
Diktat/Datei als Knöpfe oben; die 33 Hilfe-Tipps und der Arbeitsraum mit Modus-Leiste
verschwinden". Die alte Schrittleiste, die Karte „Weitere Wege" und die Modus-Leiste sind damit
**bewusst entfernt** (`Capture.tsx:501-503`, `:992-996`; gepinnt von
`tests/design/zielbild-h3-erfassen.test.ts` S2 und `tests/design/zielbild-h3-kein-erklaertext.test.ts` H).
Ältere Punkte, die genau diese Elemente verlangen (R-0031, R-0061, R-0066, R-0112, R-0929,
R-0930), widersprechen dieser jüngeren Entscheidung — siehe „Quellenwidersprüche".

## Was dieser Lauf geändert hat

| Datei | Änderung | Punkt |
|---|---|---|
| `apps/web/src/lib/erfassenFehlersatz.ts` (neu) | Eine Zuordnung für den roten Kasten: Formfehler (400 `BAD_REQUEST`, `draftPayload.*`), zu groß (jede 413) und abgelaufene Frist (408 `TIMEOUT` des Clients, `FrontDoorSaveTimeoutError`) bekommen einen übersetzten Satz. Jede andere Servermeldung gewinnt wie bisher (JOB 2690 F5). | R-0080, R-1002, R-0101 |
| `apps/web/src/components/erfassen/Blatt.tsx` | (a) Speichern, Einreichen und Löschen nutzen diese Zuordnung statt der Rohmeldung. (b) „Entwurf sichern" und „Einreichen" tragen ihre Folge als Beschreibung (`aria-describedby` auf verborgene Sätze, dazu `title`) — kein Absatz auf der Fläche, weil das Zielbild H3 den Erklärtext entfernt hat. (c) Nach dem Einreichen bekommt die Erfolgszeile („Eingereicht: …" mit ihren drei Wegen) den Fokus. | R-0084 |
| `apps/web/src/pages/Capture.tsx` | Arbeitsraum: dieselbe Zuordnung im Fehlersatz; die Beispiel-Rückfrage (`BEISPIEL_TOR_TEXT`) kommt jetzt aus dem Textkatalog statt als deutscher Klartext. | R-0080, R-1002, Sprachfälle |
| `apps/web/src/texte/einstieg.ts` (neu) | Die neuen Sätze in DE/EN/NL (Präfix `einstieg.`). | — |
| `apps/web/src/i18n.ts` | Vier Hilfetexte berichtigt (DE/EN/NL): `chelp.saveDraftHelp.body` (sagte „lokal in deinem Browser" und „oben auf der Seite" — Entwürfe liegen am Server, erreichbar unter „Mehr" → Entwürfe; Pedis Kernsatz „Ein Entwurf ist NICHT eingereicht: Niemand sieht ihn" bleibt wörtlich), `chelp.discardHelp.body` (nannte die nicht mehr vorhandene Schritt-Leiste und „endgültig" für den Entwurf; „Eingabe verwerfen" löscht keinen gesicherten Entwurf, `Blatt.tsx` `resetForNewEntry`), `chelp.wizardSteps.body` (beschrieb drei anklickbare Schritte und zitierte „Prüfen & einreichen"), `fd.whatOnSaveBody` (zitierte „Prüfen / Einreichen" — auf dem Blatt heißt der Knopf „Einreichen"). | R-1000 |
| `tests/i18n-textmodule/werte-vorher.json`, `bestand-vorher.json` | Die zwölf gewollten Textänderungen nachgetragen, Prüfsummen neu berechnet (so verlangt es `bestand-unveraendert.test.ts` K1.1). | — |

## Die Tests dieses Ordners

* `fehlersatz-und-hilfe.test.ts` — F1–F4 Zuordnung je Lage und Sprache, samt Gegenprobe
  „fachliche Meldung gewinnt"; H0 Kalibrierung des Zitatmessers, H1/H2 je Sprache: jedes Zitat in
  den berichtigten Hilfetexten ist eine echte Beschriftung des Blattes, keine Schrittleiste, keine
  Browser-Ablage.
* `blatt-einstieg-mounted.test.tsx` — das Blatt unter `CaptureFrontDoor`, echte Fastify-Anwendung
  über `app.inject` (kein Socket, kein Docker, keine DB). E0 Kalibrierung; E1 (DE/EN/NL) ein
  Aufrufer schickt `title: 123` → der **echte Server** antwortet 400 → übersetzter Satz, kein
  `draftPayload`, Eingabe bleibt, kein Entwurf am Server; E2 Rumpf > 5 MiB → echter 413 → „zu
  lang"; E3 (DE/EN/NL) beide Knöpfe tragen ihre aufgelöste Beschreibung, umrandet gegen gefüllt;
  E4 Fokus auf der Erfolgszeile nach dem Einreichen.
* `beispiel-tor-sprachen.test.tsx` — Klickpfad aus `tests/capture/f0007-beispiel-nur-bewusst-ui.test.tsx`
  in DE/EN/NL: Frage und Bestätigung in der Sprache der Sitzung, Bestätigung legt genau ein Objekt an.

**Gegenproben (von Hand, danach zurückgenommen, `cmp` gegen die Sicherung):**
G1 Blatt zeigt wieder die Rohmeldung → E1 (3×) und E2 rot. G2 kein Fokus → E4 rot.
G3 `aria-describedby` am Einreichen-Knopf entfernt → E3 (3×) rot.
G4 Beispielfrage wieder als deutscher Klartext → EN und NL rot, DE grün.

## Abgleich je Aufnahmepunkt

Legende: **erfüllt** = am Basisstand bzw. nach dieser Lieferung im Code und durch den genannten
Test belegt · **teilweise** = Rest benannt · **offen** = nicht geliefert, Entscheidung benannt ·
**überholt** = durch jüngere Entscheidung ersetzt · **Doppel** = gleicher Inhalt wie ein anderer Punkt.

| Punkt | Kurzinhalt (Quelle) | Ergebnis heute | Beleg / verbleibende Entscheidung |
|---|---|---|---|
| R-0003 | Dokument-Canvas als Standardweg; Formular, Diktat, Interview, Datei nachrangig | **erfüllt** (durch H3) | Blatt ist der einzige Einstieg; Diktat als Werkzeugknopf, Interview/Datei/Formular unter „Datei ▾" (`components/erfassen/wege.ts:19`, `Blatt.tsx` Datei-Menü). Tests: `tests/import-einstieg/weg-ins-erfassen.test.tsx`, `tests/erfassen-verwerfen-gesamtfehler/gesamtfehler-modusleiste-mounted.test.tsx`. Die in der Quelle genannten Nebenbefunde (geleerter Fließtext, Fortsetzen) gehören zum gesonderten Auftrag `aufnahme:20260922:erfassen-verwerfen` (R-0075, geliefert dort). |
| R-0029 | Formular- und Datenwahrheit erheben | **teilweise** | Diese Datei ist die Erhebung der Einstiege. Eine vollständige Matrix „sichtbar vs. gespeichert" je Feld über Blatt **und** Arbeitsraum liegt nicht vor. Gemessener Kernbefund: Blatt speichert Titel, Rumpf-HTML, Stufe, Bereich; der Arbeitsraum führt eigene Felder (Kernaussage, Bedingungen, Maßnahmen …) und reicht die Entwurfskennung zurück (`Capture.tsx` `onEntwurfInsBlatt`). |
| R-0030 | Erfassungsoptionen festlegen statt gewachsen | **erfüllt** (durch H3) | Festgelegt in `BLATT_WEGE` (`wege.ts`): Interview, Datei, Formular; Diktat als Werkzeug. Quelle nennt den Altjob selbst „VERWORFEN". |
| R-0031 | Erste Karte „Neues Wissensobjekt erfassen", „Demnächst" ans Ende | **überholt** | Weder die Karte noch „Demnächst" steht auf der Erfassungsfläche (`klara.path.soon` nur in `KlaraPathTeaser` auf Start/Stufe 2). |
| R-0039 | Freitext-Erfassung | **erfüllt** | Blatt: `blatt-titel`, Schreibfläche `role="textbox"`. Tests: `tests/erfassung-einstieg/blatt-einstieg-mounted.test.tsx` E0, `tests/cap-p1-fruehe-eingabe/blatt-fruehe-eingabe.test.tsx`. |
| R-0061 | „Noch offen: …" unter der Schrittleiste | **überholt / offen zur Entscheidung** | Schrittleiste entfernt (H3). Auf dem Blatt ist die einzige Pflicht vor dem Einreichen die Vertraulichkeit; ihr Fehlen wird als Satz erklärt (`conf.requiredHint`, `tests/vertraulichkeit-hinweis/einreichen-ohne-stufe-erklaert-sich.test.tsx`). Entscheidung Pedi: ob eine Fortschrittsanzeige auf das Blatt zurückkehren soll. |
| R-0063 | Datei-Knopf + als Schaltfläche bedienbare Ablagefläche | **erfüllt** | `components/CaptureFileImport.tsx` `capture-file-pick`, `capture-dropzone` (beide `<button>`). Test: `tests/capture/mega34-dateiauswahl-knopf.test.tsx` (7/7 grün in diesem Lauf). Tastatur-Enter nicht eigens getestet (natives `<button>`). |
| R-0064 | Speicher-Check vor dem Einreichen | **teilweise** | Arbeitsraum: Speicher-Check mit Pflicht/optional (`Capture.tsx` Speicher-Check, `lib/captureReadiness.ts`; `tests/capture/capture-readiness.test.ts` grün). Blatt: nur die Stufenpflicht als Satz (s. R-0061). |
| R-0066 | Standardweg-Karte „Dokument-Editor öffnen" dreisprachig | **überholt** | Karte existiert nicht mehr (H3). Der Sprachanteil des Punkts ist für die heutige Fläche aufgenommen: deutscher Rest im Beispiel-Tor behoben (dieser Lauf). Offener Rest: `capture.ocrRunning`/`capture.fAsset` technisch formuliert (s. R-0101). |
| R-0080 | Zahl statt Text → verständliche Abweisung, richtiger Satz im roten Kasten | **erfüllt** (dieser Lauf) | Server: `services/capture/src/draft-payload-schema.ts` → 400 (war schon da; `tests/capture/job2690-entwurf-gestaltpruefung.test.tsx`). Oberfläche: übersetzter Satz `einstieg.fehler.form`. Test: E1 (DE/EN/NL), F1. Rest: der Server liefert weiterhin einen deutschen Techniksatz mit Feldname (für andere Aufrufer, z. B. Klara-Tests pinnen ihn); `body: 42` wird nicht abgewiesen, weil es kein Feld `body` gibt. |
| R-0084 | Entwurf/Einreichen unterscheidbar, Satz daneben, Blick springt auf Erfolg | **erfüllt** mit Abweichung | Form unterscheidet (umrandet/gefüllt, `Blatt.tsx` Knopfleiste). Folge je Knopf als Beschreibung + `title` (E3); Fokus auf Erfolgszeile (E4). **Abweichung:** kein sichtbarer Absatz, weil Zielbild H3 Erklärtext verbietet — Quellenwiderspruch, s. unten. Der Arbeitsraum zeigt den sichtbaren Block weiterhin (`KnopfUnterschied`, `tests/erstnutzer-u1/knopf-unterschied.test.tsx` grün). |
| R-0085 | Fronttür fertig bauen | **erfüllt** (durch H3) | `CaptureFrontDoor.tsx` rendert das Blatt; die Logik steht in `Blatt.tsx`. Eine fachliche Gesamtabnahme der Fronttür nennt die Quelle als nie erfolgt — das bleibt eine Aufgabe der Endabnahme, kein Codebefund. |
| R-0093 | Quellen-Panel beim Erfassen | **teilweise** | Arbeitsraum → „Erweiterte Details" → „Externe Quellen" (`Capture.tsx` ~6344-6583). Auf dem Blatt selbst nicht; dort nur „Mehr" → Status → vermutete Quelle. Entscheidung Pedi: ob das Panel auf das Blatt gehört (Zielbild H3 zeigt es nicht). |
| R-0094 | Strukturiertes Formular (Symptom, Kontext, Diagnose, Maßnahme, Risiko) | **teilweise** | Formular vorhanden (Kernaussage, Aussage, Inhalt, Bedingungen, Maßnahmen). Die fünf genannten Felder gibt es so nicht. Quelle selbst benennt Widerspruch (extract_04 „erledigt" vs. Checkliste leer). Entscheidung Pedi: gilt die Feldliste aus dem Juli-Konzept noch? |
| R-0099 | Fläche gegen das Zielbild bauen, Wert für Wert | **erfüllt** (JOB 3062), hier nicht erneut gemessen | `tests/design/zielbild-h3-erfassen.test.ts` misst gegen `design/klarwerk/Erfassen.dc.html` in Chromium. In diesem Lauf nicht gefahren (Browserregel); läuft im Linux-Tor. |
| R-0101 | Klare Worte, keine technischen Beschriftungen | **teilweise** | Behoben: Formfehler-, Größen- und Fristsätze (dieser Lauf). Offen: „Vordertür-Entwurf geöffnet" (`fd.draftOpen`, wörtlich gepinnt in `tests/capture/f0040-fremder-entwurf-frontdoor.test.tsx:505,530`), „OCR → Text"/„Worker/Sprachdaten" (`capture.ocrRunning`), „Anlage / Asset" (`capture.fAsset`), „Externe Quellen (Stufe 2)", „Live-Prüfung", das Werkzeug „?" ohne sprechenden Namen. Entscheidung: Wortlaut (Pedi) — Textänderungen sind Produktänderungen. |
| R-0112 | „Weitere Wege" scrollt den Arbeitsraum ins Bild | **überholt** | Knopf entfernt (H3). Das Blatt scrollt nur bei `?weg=`-Einsprung; der Menüweg bewusst nicht (`tests/import-mausziel/dateiauswahl-im-bild-chromium.test.ts` N). |
| R-0117 | = R-0063 (historisch erledigt) | **Doppel** | wie R-0063. |
| R-0149 | Quellen-Panel mit serverseitiger Suche, nie automatisch angehängt | **teilweise** | Suche über `endpoints.external.search` (Server-Proxy), Anhängen nur per Klick. Tests: `tests/capture/capture-sources.test.ts`, `tests/capture/job2683-d2-suche-flaeche.test.tsx`. **Fehlender Beleg:** kein Test sagt ausdrücklich „Treffer werden nie automatisch angehängt". |
| R-0915 | Eigener Kopfbereich für die zweite Erfassungsstufe | **Klärung** | `pages/Stufe2.tsx` ist keine Erfassungsstufe (Output, ImportReview, Capital, GraphView). Eine „zweite Erfassungsstufe" gibt es nach H3 nicht; der Arbeitsraum ersetzt das Blatt ohne eigenen Kopf. Entscheidung: was mit „zweite Stufe" gemeint war. |
| R-0922 | Erweiterte Details zugeklappt, ehrlicher Zähler | **erfüllt** (Arbeitsraum) | `Capture.tsx` ~6081-6110, `lib/captureAdvancedFields.ts`; `tests/app/capture-advanced-fields.test.ts` grün. Rest: kein gemounteter Test des Zählers. |
| R-0929 | Geführte Schritt-Rail im Studio, „Start hier" | **überholt** | Keine Schritt-Rail auf dem Blatt; „Start hier" nur in `KnowledgeInputStudio` (`studio.coach.firstRun`). |
| R-0930 | Geführte Schrittleiste mit „Empfohlen" | **überholt / Widerspruch** | s. „Die tragende jüngere Entscheidung". |
| R-0978 | Quittung nach Abschluss, ruhiger Arbeitsraum | **erfüllt** | `blatt-entwurf-gespeichert`, `blatt-lage` (Erfolg mit drei Wegen); jetzt zusätzlich fokussiert (E4). Schmalansicht: `tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts` (Playwright, hier nicht gefahren). |
| R-1000 | Wortlaut der Vordertür; Hilfe zitiert keine nicht vorhandenen Knöpfe | **erfüllt** (dieser Lauf) | Vier Hilfetexte berichtigt; H1/H2 in `fehlersatz-und-hilfe.test.ts`. |
| R-1002 | Zu lang ist nicht kaputt | **erfüllt** (dieser Lauf, für den Rumpf) | 413 → `einstieg.fehler.zuLang` (E2 gegen echten Server, F2). Rest: Für Titel/Aussage gibt es serverseitig keine eigene Längengrenze (`draft-payload-schema.ts:30-35`, Kürzung an der Speichergrenze) — ob eine sichtbare Längengrenze gewollt ist, ist eine Produktentscheidung. |
| R-1560 | Blatt mit Werkzeugmenüs (Kriterien Q3(b), Q3c, CAP-P1) | **erfüllt** in den genannten Teilen | Q3(b) Alias `/erfassen/vordertuer` → Blatt (`CaptureFrontDoor.tsx:19-34`). Q3c Stufenpflicht an `POST /api/kos` (`tests/q3c-stufenpflicht/*`, grün in diesem Lauf). CAP-P1 frühe Eingabe (`tests/cap-p1-fruehe-eingabe`). Die Quelle nennt „breiter Bild-/Word-/Provenienz-, Diktat-/Datei-/Interview-/KI-Gesamtweg bleibt separat" — nicht Teil dieser Lieferung. |
| R-1578 | DESIGN Web-App Erfassen (eine Fläche …) | **erfüllt** (JOB 3062) | s. oben. Bereich-Zeile: Auswahl aus den am Client geladenen Kategorien (`Blatt.tsx` ~645-654); der Kategorien-Serverweg aus K2b gilt für Klara in Word. |
| R-1683 | Erfassungsmodus Freitext | **erfüllt** | wie R-0039. |
| R-1684 | Erfassungsmodus Strukturiertes Formular | **erfüllt** / s. R-0094 | „Datei ▾" → „Formular (Experten)". |
| R-1810 | „BEAUFTRAGT" (OFFEN.md U4, mega90) | **abgegrenzt** | Sammelzeile für den Bedienbarkeitsauftrag mega90. Der Erfassungsanteil (SCRUM-536/537 geleerter Fließtext) ist im gesonderten Auftrag `erfassen-verwerfen` geliefert (`tests/erfassen-verwerfen-gesamtfehler/README.md`). Übrige Blöcke (mobiles Menü, Bibliotheksfilter, Ladezeit) liegen außerhalb der Erfassungsfläche. |
| R-1920 | = R-0063 | **Doppel** | wie R-0063. |
| R-2094 | Vier Erfassungsmodi (MUSS) | **erfüllt** mit Rest | Freitext, Formular, Diktat, Interview (+ Datei) erreichbar. Rest s. SOLL:FR-CAP-01. |
| N-0004 | Entwurfsmenü ohne zugänglichen Namen | **erfüllt** (JOB 3266 D1) | `Blatt.tsx` Menü „mehr": `beschriftung={t("erfassen.werkzeug.mehr")}` (DE „Mehr", EN „More", NL „Meer"); „Entwürfe" erster Eintrag. Test: `tests/d1-meine-entwuerfe/blatt-zugang-und-liste.test.tsx` B1 (grün). Live-Gegenprüfung nach dem Fix fehlt. |
| N-0014 | = N-0004 (Folgebeobachtung 1.107) | **Doppel** | wie N-0004. |
| N-0068 | Expertenformular / „Anhänge verwalten" verlieren den Bearbeitungskontext | **teilweise / offen** | Mit `?draft=` lädt der Arbeitsraum den **gespeicherten** Entwurf (`Capture.tsx` ~3121-3170; `tests/expertenformular-entwurf/experten-draft-mounted.test.tsx` A–I). Ungesicherte Blatt-Änderungen reisen nicht mit, und es gibt keinen Satz, der den Wechsel erklärt. Auch der Weg „Mehr" → Anhänge → „Anhänge verwalten" ist nicht eigens getestet. Entscheidung: Übergabe des Blatt-Inhalts an den Arbeitsraum oder erklärender Hinweis — nicht in diesem Lauf gebaut, weil beide Varianten den Datenweg Blatt↔Arbeitsraum ändern. |
| P-UX-22 | Quellenformular: eigene Belegstelle zuordenbar | **erfüllt** (JOB 3133, LIVE 1.155) | `tests/quellen-anker-im-formular/formular-haengt-belegstelle-an.test.tsx` a–e (grün). |
| P-UX-22b | I2 prüft Anfrage + 403, I3 zählt Anfragen | **erfüllt** (JOB 3178) | `tests/quellen-anker-im-formular/interne-adresse-durch-das-formular.test.tsx` I2 (`rufe.length === 1`, Status 403), I3 (`nachher.length - vorher === 0`) — grün in diesem Lauf. |
| priority:K2b | Klara Erfassen nach Mockup: Bereich-Zeile, „?"-Menü, Dokumentlink, Leertextfarbe `#9AA2B1` | **Teile 1–3 erfüllt, Teil 4 offen mit Sperre** | Teile 1–3 laut Quelle geliefert (`tests/k2b-bereich-zeile`, `tests/k2b-erfassen-reste/k2b-menue-und-link.test.ts`). Teil 4: `#9AA2B1` steht in `apps/web/public/word-addin/taskpane.html:48` als Mockup-Wert `--hint`, der Erfassungssatz `#capture-leer` nutzt bewusst `--muted`. Die Quelle nennt ausdrücklich: Gestaltung, „nicht vor der Vorführung" (Pedi) — **nicht in diesem Lauf entschieden**. Hinweis zur Entscheidung: `#9AA2B1` auf Weiß erreicht rechnerisch nur etwa 2,6 : 1 Kontrast (unter WCAG 4,5 : 1 für Text). |
| priority:UX-22 | = P-UX-22 | **Doppel** | Quelle: `doppelte_quellenfassung`. |
| priority:UX-22b | = P-UX-22b | **Doppel** | Quelle: `doppelte_quellenfassung`. |
| SOLL:FR-CAP-01 | Freitext, Formular, Diktat, KI-Interview → strukturierbarer Input | **teilweise** | Alle vier erreichbar. Sie führen **nicht** zu demselben Datenstand: das Blatt speichert Rumpf-HTML, der Arbeitsraum Formularfelder (R-0029). Der Gesamtweg Diktat/Datei/Interview/KI ist in der Quelle (R-1560) ausdrücklich separat. |

## Quellenwidersprüche

1. **Schrittleiste / „Empfohlen" / „Weitere Wege" (R-0061, R-0112, R-0929, R-0930) gegen Zielbild
   H3 (R-1578, jünger, von Pedi):** H3 hat die Elemente entfernt. Nicht zurückgebaut; Entscheidung
   Pedi, ob eine Orientierungshilfe auf dem Blatt zurückkehren soll.
2. **„Ein Satz daneben" (R-0084) gegen „kein Erklärtext auf der Fläche" (H3):** gelöst als
   Beschreibung am Knopf (Screenreader + `title`), nicht als sichtbarer Absatz. Soll der Satz
   sichtbar stehen, muss das Zielbild geändert werden.
3. **R-0094:** Feldliste Symptom/Kontext/Diagnose/Maßnahme/Risiko gegen das gebaute Formular.
4. **R-0915:** „zweite Erfassungsstufe" hat heute keinen Gegenstand.

## Fehlende Belege / nicht gefahrene Prüfungen

* Keine Live-Sichtung an einer laufenden Instanz (N-0004/N-0014 nach Fix, R-0003, R-0085).
* Chromium-Tests nicht gefahren (Serverregel für diesen Mac): `tests/design/zielbild-h3-*.test.ts`,
  `tests/design/h3-wirkung.test.ts`, `tests/i18n-textmodule/flaechen-chromium.test.ts`,
  `tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts`. Die sichtbaren Änderungen dieses Laufs sind
  dort unkritisch (die beiden Beschreibungssätze sind `hidden` und zählen im Prosamesser nicht), das
  ist aber eine Überlegung, keine Messung.
* R-0149: kein ausdrücklicher Test „nie automatisch anhängen".
* R-0922: kein gemounteter Test des Zählers.

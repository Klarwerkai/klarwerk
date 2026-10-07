# Aufnahme `gesamt-erfassung-einstieg` — Abgleich, Lieferung, offene Entscheidungen

Auftrag `aufnahme:20260922:gesamt-erfassung-einstieg` (Aufgabenrevision 2, Lauf
`lauf:b3:aufnahme:20260922:gesamt-erfassung-einstieg:1`, Runden 1 bis 3; Nacharbeit BEN-4 in Lauf
`…:gesamt-erfassung-einstieg:3`, Runde 1, auf `be402742`). Basisstand `b836417d`
(`1.0.0-beta.1.630`). Stand dieser Datei: 01.10.2026.
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
| **Runde 2** `apps/web/src/components/erfassen/Blatt.tsx` | BEN-1: „Datei ▾ → Formular (Experten)" und „Mehr → Anhänge → Anhänge verwalten" laufen über `formularOeffnen`. Weicht das Blatt vom gesicherten Stand ab (`istSchmutzig`), fragt es: sicherbar → „erst sichern, dann im Formular weiter?" (Ja sichert über `requestSave` und öffnet das Formular erst nach der Serverbestätigung, `nachSichernOeffnenRef`; Nein lässt alles auf dem Blatt); nicht sicherbar → die Rückfrage nennt den Wechsel zum gesicherten bzw. leeren Stand. Unverändertes Blatt: keine Rückfrage. | N-0068 |
| **Runde 2** `apps/web/src/lib/captureFrontDoor.ts` | BEN-2: `deriveFrontDoorTitle` kappt den **getippten** Titel nicht mehr auf 90 Zeichen (nur Leerraum wird zusammengezogen). Der aus dem Text abgeleitete Titel bleibt ein auf 90 Zeichen gekürzter Vorschlag — er stand nie im Feld. Der Server kennt keine Titelgrenze (`services/capture/src/service.ts` `normalizeDraftPayload` kürzt nur Quellen, Prüfer, Interview). | R-1002, Kriterium 1 |
| **Runde 3** `apps/web/src/components/erfassen/Blatt.tsx` | BEN-1 Rest: `onSuccess` öffnet das Formular nicht mehr selbst (kennt nur den abgesendeten Stand), sondern meldet den Wunsch (`formularNachSichern`). Ein Effekt entscheidet nach dem Ende der Speicherung mit dem AKTUELLEN Blatt: nichts nachgetragen → Formular öffnet; während des Sicherns nachgetragen (`istSchmutzig` gegen den abgesendeten Stand — Titel, Text, Stufe, Bereich, offener KI-Vorschlag) → erneute Rückfrage `einstieg.formular.nachtragFrage`; Ja sichert auch den Nachtrag und kommt über denselben Weg zurück, Nein lässt alles auf dem Blatt. | N-0068 |
| **Lauf 3** `apps/web/src/components/erfassen/Blatt.tsx` | BEN-4: Ein offener KI-Vorschlag ist kein durch Sichern behebbarer Nachtrag. `istSchmutzig` ist jetzt `inhaltWeichtAb` (Titel, Text, Stufe, Bereich) ODER offener Vorschlag. `formularOeffnen` zeigt bei offenem Vorschlag genau eine Meldung `einstieg.formular.vorschlagOffen` (`window.alert`: erst übernehmen oder verwerfen) und sichert und wechselt nicht; der Effekt `formularNachSichern` misst den Nachtrag nur noch an `inhaltWeichtAb` und zeigt bei einem inzwischen offenen Vorschlag dieselbe Meldung. Vorher: Sichern → Vorschlag weiter offen → „nachgetragen" → Frage → Sichern … ohne Ende (Bens B4). | N-0068, BEN-4 |
| **Runde 2** `apps/web/src/texte/einstieg.ts` | `einstieg.formular.sichernFrage`, `einstieg.formular.ohneSichernFrage`, seit Runde 3 `einstieg.formular.nachtragFrage`, seit Lauf 3 `einstieg.formular.vorschlagOffen` in DE/EN/NL. | N-0068 |

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
* **Runde 2** `formular-und-titel-mounted.test.tsx` — echter Arbeitsraum hinter dem Blatt. N1 gesichert → Titel geändert → „Datei → Formular": Rückfrage, ein Sichern, Server und Formular tragen den NEUEN Titel (Bens B1). N2 Rückfrage abgelehnt: Blatt bleibt, nichts gesichert. N3 ungesichertes neues Blatt (Bens B2): genau ein Entwurf, Formular zeigt den getippten Titel. N4 Kalibrierung: unverändert gesichert → keine Rückfrage. N5 derselbe Schutz über „Anhänge verwalten". N6/N6b nicht sicherbare Abweichung (nur Stufe gewählt): Rückfrage nennt den Wechsel; abgelehnt bleibt die Stufe stehen. N7 Rückfragen in EN/NL übersetzt. **Runde 3:** N8 Speicheranfrage festgehalten, währenddessen Titel-Nachtrag (Bens Gegenprobe): zweite Rückfrage, auch der Nachtrag wird gesichert, das Formular zeigt ihn. N8b dieselbe Lage, zweite Rückfrage abgelehnt: kein Formular, der Nachtrag steht auf dem Blatt, gesichert ist der zugestimmte Stand. N8c Kalibrierung: festgehalten ohne Nachtrag — solange die Anfrage läuft, kein Formular; danach öffnet es ohne zweite Rückfrage. **Lauf 3:** N9/N9b/N9c derselbe Nachtrag während des Sicherns je einzeln über Text, Vertraulichkeitsstufe und Bereich (Bereich aus einem am Server angelegten Wissensobjekt): zweite Rückfrage, genau zwei Speicherungen, der Server trägt den Nachtrag, das Formular ist offen. B4 (Bens Ablauf): gesichert → „KI → Strukturieren" → Vorschlag stehen lassen → „Datei → Formular": 0 Bestätigungsfragen, genau 1 Meldung, 0 zusätzliche Speicherungen, Formular zu, Vorschlag und Blatt unverändert, Server unverändert. B4b danach verworfen → Formular öffnet ohne Rückfrage und Speicherung. B4c danach übernommen → eine Sichern-Rückfrage, eine Speicherung, Formular zeigt den übernommenen Stand. B4d Vorschlag plus ungesicherte Stufe über „Anhänge verwalten" → dieselbe eine Meldung, nichts gesichert (Tippen in Titel/Text räumt einen Vorschlag schon bestehender Bauart ab, daher die Stufe). T1 (Bens B3): 120 Zeichen getippt → der Server hat 120, Feld und Bestätigungszeile sagen dasselbe.
* **Runde 2** `q3a-zustandsmatrix-mounted.test.tsx` — R-1560, Q3(a) §9 (s. unten): Z0 Kalibrierung, Z1 laden, Z1-en derselbe Ladezustand in EN (CAP-P1 „DE/EN gemeinsam"), Z2 Ladefehler 500, Z3 offline beim Laden, Z4 offline beim Einreichen.
* **Runde 2** `stufenwerte-am-entwurf.test.ts` — R-1560, R0633-Matrix am echten Server: sechs ungültige Stufenwerte → POST 400 ohne Entwurf und PUT 400 ohne Änderung; drei gültige → 201 und gespeichert; fehlendes Feld → 201 ohne erfundene Stufe.
* `beispiel-tor-sprachen.test.tsx` — Klickpfad aus `tests/capture/f0007-beispiel-nur-bewusst-ui.test.tsx`
  in DE/EN/NL: Frage und Bestätigung in der Sprache der Sitzung, Bestätigung legt genau ein Objekt an.

**Gegenproben (von Hand, danach zurückgenommen, `cmp` gegen die Sicherung):**
G1 Blatt zeigt wieder die Rohmeldung → E1 (3×) und E2 rot. G2 kein Fokus → E4 rot.
G3 `aria-describedby` am Einreichen-Knopf entfernt → E3 (3×) rot.
G4 Beispielfrage wieder als deutscher Klartext → EN und NL rot, DE grün.
**Runde 2:** G5 Formular wieder direkt öffnen (Stand vor BEN-1) → N1, N2, N3, N5, N6, N6b rot.
G7 `compactTitle` wieder auf den getippten Titel → T1 rot. G8 Ladefehler setzt „intern" → Z2, Z3
rot. G9 gescheitertes Einreichen verwirft die Wahl → Z4 rot. G10 Stufenprüfung im Entwurfsschema
ausgeschaltet → sechs S1-Fälle rot. **Nicht unterschieden:** G6 „Formular sofort öffnen, parallel
sichern" bleibt grün, weil der Arbeitsraum eine später in `?draft=` erscheinende Kennung nachlädt —
dass das Formular erst NACH der Bestätigung öffnet, ist gebaut, aber nicht eigens gemessen.
**Runde 3:** G11 Runde-2-Verhalten (nach dem Sichern bedingungslos öffnen) → N8, N8b rot. G6 erneut
(„sofort öffnen, parallel sichern") → jetzt N8, N8b, N8c rot — die Reihenfolge ist damit gemessen.
**Lauf 3:** G12 `Blatt.tsx` auf `be402742` zurück (Stand vor BEN-4) → B4, B4b, B4c, B4d rot; B4 zeigt
dabei genau Bens Befund (1 Sichern-Frage + 3 Nachtragsfragen bis zur Ablehnung der vierten). G11
erneut (nach dem Sichern bedingungslos öffnen) → N8, N8b, N9, N9b, N9c rot.

## Abgleich je Aufnahmepunkt

Legende: **erfüllt** = am Basisstand bzw. nach dieser Lieferung im Code und durch den genannten
Test belegt · **teilweise** = Rest benannt · **offen** = nicht geliefert, Entscheidung benannt ·
**überholt** = durch jüngere Entscheidung ersetzt · **Doppel** = gleicher Inhalt wie ein anderer Punkt.

| Punkt | Kurzinhalt (Quelle) | Ergebnis heute | Beleg / verbleibende Entscheidung |
|---|---|---|---|
| R-0003 | Dokument-Canvas als Standardweg; Formular, Diktat, Interview, Datei nachrangig | **erfüllt** (durch H3) | Blatt ist der einzige Einstieg; Diktat als Werkzeugknopf, Interview/Datei/Formular unter „Datei ▾" (`components/erfassen/wege.ts:19`, `Blatt.tsx` Datei-Menü). Tests: `tests/import-einstieg/weg-ins-erfassen.test.tsx`, `tests/erfassen-verwerfen-gesamtfehler/gesamtfehler-modusleiste-mounted.test.tsx`. Die in der Quelle genannten Nebenbefunde: **gelöschte Maßnahmen** — JOB 2695, das Blatt schickt beim Ändern nur seine eigenen Felder (`captureFrontDoor.ts` `nurEigene`), belegt von `tests/capture/job2695-vordertuer-loescht-nicht.test.tsx` F1–F5 (grün in Runde 2); **geleerter Fließtext** und **Fortsetzen** — gesonderter Auftrag `aufnahme:20260922:erfassen-verwerfen` (R-0075) bzw. `tests/entwurf-fortsetzen` (grün). |
| R-0029 | Formular- und Datenwahrheit erheben | **erfüllt als Erhebung** (Runde 2) | Vollständige Matrix „sichtbar vs. gespeichert" für Blatt und Arbeitsraum im Abschnitt **R-0029 — Erhebung** unten, jede Zeile mit Fundstelle. Verbleibende Entscheidung daraus: ob die vom Blatt unsichtbar gesetzten Felder (`statement`, `type`, `category: "Allgemein"`) sichtbar werden sollen. |
| R-0030 | Erfassungsoptionen festlegen statt gewachsen | **erfüllt** (durch H3) | Festgelegt in `BLATT_WEGE` (`wege.ts`): Interview, Datei, Formular; Diktat als Werkzeug. Quelle nennt den Altjob selbst „VERWORFEN". |
| R-0031 | Erste Karte „Neues Wissensobjekt erfassen", „Demnächst" ans Ende | **überholt** | Weder die Karte noch „Demnächst" steht auf der Erfassungsfläche (`klara.path.soon` nur in `KlaraPathTeaser` auf Start/Stufe 2). |
| R-0039 | Freitext-Erfassung | **erfüllt** | Blatt: `blatt-titel`, Schreibfläche `role="textbox"`. Tests: `tests/erfassung-einstieg/blatt-einstieg-mounted.test.tsx` E0, `tests/cap-p1-fruehe-eingabe/blatt-fruehe-eingabe.test.tsx`. |
| R-0061 | „Noch offen: …" unter der Schrittleiste | **überholt / offen zur Entscheidung** | Schrittleiste entfernt (H3). Auf dem Blatt ist die einzige Pflicht vor dem Einreichen die Vertraulichkeit; ihr Fehlen wird als Satz erklärt (`conf.requiredHint`, `tests/vertraulichkeit-hinweis/einreichen-ohne-stufe-erklaert-sich.test.tsx`). Entscheidung Pedi: ob eine Fortschrittsanzeige auf das Blatt zurückkehren soll. |
| R-0063 | Datei-Knopf + als Schaltfläche bedienbare Ablagefläche | **erfüllt** | `components/CaptureFileImport.tsx` `capture-file-pick`, `capture-dropzone` (beide `<button>`). Test: `tests/capture/mega34-dateiauswahl-knopf.test.tsx` (7/7 grün in diesem Lauf). Tastatur-Enter nicht eigens getestet (natives `<button>`). |
| R-0064 | Speicher-Check vor dem Einreichen | **teilweise** | Arbeitsraum: Speicher-Check mit Pflicht/optional (`Capture.tsx` Speicher-Check, `lib/captureReadiness.ts`; `tests/capture/capture-readiness.test.ts` grün). Blatt: nur die Stufenpflicht als Satz (s. R-0061). |
| R-0066 | Standardweg-Karte „Dokument-Editor öffnen" dreisprachig | **überholt** | Karte existiert nicht mehr (H3). Der Sprachanteil des Punkts ist für die heutige Fläche aufgenommen: deutscher Rest im Beispiel-Tor behoben (dieser Lauf). `capture.ocrRunning`/`capture.fAsset` seit `fehlerfaelle` in Anwendersprache (s. R-0101). |
| R-0080 | Zahl statt Text → verständliche Abweisung, richtiger Satz im roten Kasten | **erfüllt** (dieser Lauf) | Server: `services/capture/src/draft-payload-schema.ts` → 400 (war schon da; `tests/capture/job2690-entwurf-gestaltpruefung.test.tsx`). Oberfläche: übersetzter Satz `einstieg.fehler.form`. Test: E1 (DE/EN/NL), F1. Rest: der Server liefert weiterhin einen deutschen Techniksatz mit Feldname (für andere Aufrufer, z. B. Klara-Tests pinnen ihn); `body: 42` wird nicht abgewiesen, weil es kein Feld `body` gibt. |
| R-0084 | Entwurf/Einreichen unterscheidbar, Satz daneben, Blick springt auf Erfolg | **erfüllt** mit Abweichung | Form unterscheidet (umrandet/gefüllt, `Blatt.tsx` Knopfleiste). Folge je Knopf als Beschreibung + `title` (E3); Fokus auf Erfolgszeile (E4, seit `fehlerfaelle` DE/EN/NL). **Abweichung:** kein sichtbarer Absatz, weil Zielbild H3 Erklärtext verbietet. **Entschieden** von Pedi (`entscheidung:1214edcf-b80f-455d-9501-476cb014fc0b`, 01.10.2026): „Ja, die Beschreibung am Knopf reicht, H3 bleibt." Die Beschreibung am Knopf ist damit der Sollzustand. Der Arbeitsraum zeigt den sichtbaren Block weiterhin (`KnopfUnterschied`, `tests/erstnutzer-u1/knopf-unterschied.test.tsx` grün). |
| R-0085 | Fronttür fertig bauen | **erfüllt** (durch H3) | `CaptureFrontDoor.tsx` rendert das Blatt; die Logik steht in `Blatt.tsx`. Eine fachliche Gesamtabnahme der Fronttür nennt die Quelle als nie erfolgt — das bleibt eine Aufgabe der Endabnahme, kein Codebefund. |
| R-0093 | Quellen-Panel beim Erfassen | **teilweise** | Arbeitsraum → „Erweiterte Details" → „Externe Quellen" (`Capture.tsx` ~6344-6583). Auf dem Blatt selbst nicht; dort nur „Mehr" → Status → vermutete Quelle. Entscheidung Pedi: ob das Panel auf das Blatt gehört (Zielbild H3 zeigt es nicht). |
| R-0094 | Strukturiertes Formular (Symptom, Kontext, Diagnose, Maßnahme, Risiko) | **teilweise** | Formular vorhanden (Kernaussage, Aussage, Inhalt, Bedingungen, Maßnahmen). Die fünf genannten Felder gibt es so nicht. Quelle selbst benennt Widerspruch (extract_04 „erledigt" vs. Checkliste leer). Entscheidung Pedi: gilt die Feldliste aus dem Juli-Konzept noch? |
| R-0099 | Fläche gegen das Zielbild bauen, Wert für Wert | **erfüllt** (JOB 3062), hier nicht erneut gemessen | `tests/design/zielbild-h3-erfassen.test.ts` misst gegen `design/klarwerk/Erfassen.dc.html` in Chromium. In diesem Lauf nicht gefahren (Browserregel); läuft im Linux-Tor. |
| R-0101 | Klare Worte, keine technischen Beschriftungen | **teilweise** | Behoben: Formfehler-, Größen- und Fristsätze (dieser Lauf); seit `fehlerfaelle` auch `capture.ocrRunning` („Text wird aus … gelesen … Beim ersten Mal dauert das etwas länger." statt „OCR läuft … (Worker/Sprachdaten …)") und `capture.fAsset` („Anlage / Gerät" statt „Anlage / Asset") in DE/EN/NL, Test `klare-worte-r0101.test.ts`. Weiter offen (nicht Teil von `fehlerfaelle`): „Vordertür-Entwurf geöffnet" (`fd.draftOpen`, wörtlich gepinnt in `tests/capture/f0040-fremder-entwurf-frontdoor.test.tsx:505,530`), die Knopfbeschriftung „OCR → Text" (`capture.ocr`, `capture.ocrRunningShort`), „Externe Quellen (Stufe 2)", „Live-Prüfung", das Werkzeug „?" ohne sprechenden Namen. |
| R-0112 | „Weitere Wege" scrollt den Arbeitsraum ins Bild | **überholt** | Knopf entfernt (H3). Das Blatt scrollt nur bei `?weg=`-Einsprung; der Menüweg bewusst nicht (`tests/import-mausziel/dateiauswahl-im-bild-chromium.test.ts` N). |
| R-0117 | = R-0063 (historisch erledigt) | **Doppel** | wie R-0063. |
| R-0149 | Quellen-Panel mit serverseitiger Suche, nie automatisch angehängt | **teilweise** | Suche über `endpoints.external.search` (Server-Proxy), Anhängen nur per Klick. Tests: `tests/capture/capture-sources.test.ts`, `tests/capture/job2683-d2-suche-flaeche.test.tsx`. **Fehlender Beleg:** kein Test sagt ausdrücklich „Treffer werden nie automatisch angehängt". |
| R-0915 | Eigener Kopfbereich für die zweite Erfassungsstufe | **Klärung** | `pages/Stufe2.tsx` ist keine Erfassungsstufe (Output, ImportReview, Capital, GraphView). Eine „zweite Erfassungsstufe" gibt es nach H3 nicht; der Arbeitsraum ersetzt das Blatt ohne eigenen Kopf. Entscheidung: was mit „zweite Stufe" gemeint war. |
| R-0922 | Erweiterte Details zugeklappt, ehrlicher Zähler | **erfüllt** (Arbeitsraum) | `Capture.tsx` ~6081-6110, `lib/captureAdvancedFields.ts`; `tests/app/capture-advanced-fields.test.ts` grün. Rest: kein gemounteter Test des Zählers. |
| R-0929 | Geführte Schritt-Rail im Studio, „Start hier" | **überholt** | Keine Schritt-Rail auf dem Blatt; „Start hier" nur in `KnowledgeInputStudio` (`studio.coach.firstRun`). |
| R-0930 | Geführte Schrittleiste mit „Empfohlen" | **überholt / Widerspruch** | s. „Die tragende jüngere Entscheidung". |
| R-0978 | Quittung nach Abschluss, ruhiger Arbeitsraum | **erfüllt** | `blatt-entwurf-gespeichert`, `blatt-lage` (Erfolg mit drei Wegen); jetzt zusätzlich fokussiert (E4). Schmalansicht: `tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts` (Playwright, hier nicht gefahren). |
| R-1000 | Wortlaut der Vordertür; Hilfe zitiert keine nicht vorhandenen Knöpfe | **erfüllt** (dieser Lauf) | Vier Hilfetexte berichtigt; H1/H2 in `fehlersatz-und-hilfe.test.ts`. |
| R-1002 | Zu lang ist nicht kaputt | **erfüllt** (Runden 1 und 2) | Rumpf: 413 → `einstieg.fehler.zuLang` (E2 gegen echten Server, F2). Titel: die stille Kürzung auf 90 Zeichen ist entfernt (BEN-2, T1). Weder Titel noch Aussage werden serverseitig gekürzt (Berichtigung gegenüber Runde 1: `normalizeDraftPayload` kürzt nur Quellen, Prüfer und Interview; Arbeitsraum-Felder mit Grenze tragen `maxLength` samt sichtbarer Rückmeldung, `Capture.tsx` „mega6 Block D"). |
| R-1560 | Blatt mit Werkzeugmenüs — Kriterien Q3(b), Q3c, CAP-P1, Q3(a) §9, R0633, /health | **erfüllt in den messbaren Teilen, nicht vollständig abgenommen** | **Q3(b)** Alias `/erfassen/vordertuer` → Blatt (`CaptureFrontDoor.tsx:19-34`). **Q3c** Stufenpflicht an `POST /api/kos` (`tests/q3c-stufenpflicht/*`, `tests/q3c-stufenpflicht-dokumentweg`, grün). **CAP-P1** frühe Eingaben: gemountet DE `tests/cap-p1-fruehe-eingabe` (F1–F7, N1–N8), EN jetzt `q3a-zustandsmatrix-mounted.test.tsx` Z1-en. **Q3(a) §9** Zustandsmatrix: s. Abschnitt unten (Z0–Z4; „Cache"-Zeilen nicht anwendbar, begründet). **R0633-Matrix** `stufenwerte-am-entwurf.test.ts` (11/11). **/health-Commit** öffentlich: nicht prüfbar ohne laufende Instanz — fehlender Beleg. „Breiter H3-Bild-/Word-/Provenienz-, Diktat-/Datei-/Interview-/KI-Gesamtweg bleibt separat" laut Quelle — nicht Teil dieser Lieferung; ebenso ausdrücklich: „nicht als vollständig abgenommen kennzeichnen". |
| R-1578 | DESIGN Web-App Erfassen (eine Fläche …) | **erfüllt** (JOB 3062) | s. oben. Bereich-Zeile: Auswahl aus den am Client geladenen Kategorien (`Blatt.tsx` ~645-654); der Kategorien-Serverweg aus K2b gilt für Klara in Word. |
| R-1683 | Erfassungsmodus Freitext | **erfüllt** | wie R-0039. |
| R-1684 | Erfassungsmodus Strukturiertes Formular | **erfüllt** / s. R-0094 | „Datei ▾" → „Formular (Experten)". |
| R-1810 | „BEAUFTRAGT" (OFFEN.md U4, mega90) | **abgegrenzt** | Sammelzeile für den Bedienbarkeitsauftrag mega90. Der Erfassungsanteil (SCRUM-536/537 geleerter Fließtext) ist im gesonderten Auftrag `erfassen-verwerfen` geliefert (`tests/erfassen-verwerfen-gesamtfehler/README.md`). Übrige Blöcke (mobiles Menü, Bibliotheksfilter, Ladezeit) liegen außerhalb der Erfassungsfläche. |
| R-1920 | = R-0063 | **Doppel** | wie R-0063. |
| R-2094 | Vier Erfassungsmodi (MUSS) | **erfüllt** mit Rest | Freitext, Formular, Diktat, Interview (+ Datei) erreichbar. Rest s. SOLL:FR-CAP-01. |
| N-0004 | Entwurfsmenü ohne zugänglichen Namen | **erfüllt** (JOB 3266 D1) | `Blatt.tsx` Menü „mehr": `beschriftung={t("erfassen.werkzeug.mehr")}` (DE „Mehr", EN „More", NL „Meer"); „Entwürfe" erster Eintrag. Test: `tests/d1-meine-entwuerfe/blatt-zugang-und-liste.test.tsx` B1 (grün). Live-Gegenprüfung nach dem Fix fehlt. |
| N-0014 | = N-0004 (Folgebeobachtung 1.107) | **Doppel** | wie N-0004. |
| N-0068 | Expertenformular / „Anhänge verwalten" verlieren den Bearbeitungskontext | **erfüllt** (Runden 2 und 3, BEN-1) | `Blatt.tsx` `formularOeffnen` + Effekt `formularNachSichern`: bei abweichendem Blatt Rückfrage; auf Ja erst sichern, dann — nach dem Ende der Speicherung und nur, wenn seither nichts nachgetragen wurde — Formular mit genau diesem Stand; ein Nachtrag während des Sicherns löst eine zweite, erklärende Rückfrage aus; auf Nein bleibt alles auf dem Blatt; nicht sicherbar → Rückfrage nennt den Wechsel. Beide Wege (Datei-Menü, „Anhänge verwalten"). Ein offener KI-Vorschlag (BEN-4) wird nicht als Nachtrag behandelt: genau eine Meldung „erst übernehmen oder verwerfen", keine Speicherung. Tests `formular-und-titel-mounted.test.tsx` N1–N9c, B4–B4d. Nicht umgesetzt: eine Übergabe **ohne** Sichern (das Formular liest den Entwurf beim Server) — die Rückfragen machen jeden Wechsel stattdessen ausdrücklich. |
| P-UX-22 | Quellenformular: eigene Belegstelle zuordenbar | **erfüllt** (JOB 3133, LIVE 1.155) | `tests/quellen-anker-im-formular/formular-haengt-belegstelle-an.test.tsx` a–e (grün). |
| P-UX-22b | I2 prüft Anfrage + 403, I3 zählt Anfragen | **erfüllt** (JOB 3178) | `tests/quellen-anker-im-formular/interne-adresse-durch-das-formular.test.tsx` I2 (`rufe.length === 1`, Status 403), I3 (`nachher.length - vorher === 0`) — grün in diesem Lauf. |
| priority:K2b | Klara Erfassen nach Mockup: Bereich-Zeile, „?"-Menü, Dokumentlink, Leertextfarbe `#9AA2B1` | **Teile 1–3 erfüllt, Teil 4 offen mit Sperre** | Teile 1–3 laut Quelle geliefert (`tests/k2b-bereich-zeile`, `tests/k2b-erfassen-reste/k2b-menue-und-link.test.ts`). Teil 4: `#9AA2B1` steht in `apps/web/public/word-addin/taskpane.html:48` als Mockup-Wert `--hint`, der Erfassungssatz `#capture-leer` nutzt bewusst `--muted`. Die Quelle nennt ausdrücklich: Gestaltung, „nicht vor der Vorführung" (Pedi) — **nicht in diesem Lauf entschieden**. Hinweis zur Entscheidung: `#9AA2B1` auf Weiß erreicht rechnerisch nur etwa 2,6 : 1 Kontrast (unter WCAG 4,5 : 1 für Text). **Nachtrag `k2b-konkreter-rest`:** `--hint` liegt heute in `taskpane.css:25` (nicht mehr `taskpane.html:48`); `#capture-leer` in `taskpane.css:403`. Die Bedingung von Entscheidung 2 (DEMO-ERSTER-NUTZERWEG LIVE) ist durch JOB 3801/4337 erfüllt — Teil 4 ist nicht mehr durch sie gesperrt, aber nicht umgesetzt. Rest R1–R5 und offene Kontrastentscheidung E1: `docs/entscheidungen/k2b-erfassen-leertextfarbe.md`; Abgleich `tests/k2b-restabgleich/leertextfarbe-abgleich.test.ts`. |
| priority:UX-22 | = P-UX-22 | **Doppel** | Quelle: `doppelte_quellenfassung`. |
| priority:UX-22b | = P-UX-22b | **Doppel** | Quelle: `doppelte_quellenfassung`. |
| SOLL:FR-CAP-01 | Freitext, Formular, Diktat, KI-Interview → strukturierbarer Input | **teilweise** | Alle vier erreichbar. Sie führen **nicht** zu demselben Datenstand: das Blatt speichert Rumpf-HTML, der Arbeitsraum Formularfelder (R-0029). Der Gesamtweg Diktat/Datei/Interview/KI ist in der Quelle (R-1560) ausdrücklich separat. |

## R-0029 — Erhebung „sichtbar vs. gespeichert"

Gemessen am Code (Runde 2). „Blatt" = `components/erfassen/Blatt.tsx` mit
`lib/captureFrontDoor.ts` `buildFrontDoorPayload`; „Arbeitsraum" = `pages/Capture.tsx`
`saveDraft` (Nutzlast ~2214-2240). Server: `services/capture/src/service.ts`
(`normalizeDraftPayload`, Merge „nicht mitgeschickt ⇒ Altwert bleibt, Leerwert ⇒ gelöscht").

| Feld (`DraftPayload`) | Blatt: sichtbar / bearbeitbar | Blatt: was gespeichert wird | Arbeitsraum (Formular) | Beleg |
|---|---|---|---|---|
| `title` | Titelfeld | getippter Titel **ungekürzt**; leer → aus dem ersten Block abgeleitet (≤ 90 Z.) bzw. „Unbenanntes Wissensobjekt" | Feld „Kernaussage"; leer → erste Zeile des Rohtexts (≤ 80 Z.) | T1; `capture-front-door.test.ts` |
| `bodyHtml` | Schreibfläche (Text, Bilder mit Beschreibung als `figcaption`) | vollständig; bewusst geleert → Löschmarker (`draftBodyPatch`) | „Ausführlicher Inhalt" | `draft-body-clear-cycle-mounted.test.tsx`, `mega69-bildweg-mounted.test.tsx` |
| `statement` | **nicht sichtbar** | aus dem Rumpf abgeleiteter Klartext (`frontDoorStatement`), sonst der Titel; überschreibt beim Sichern eine im Formular geschriebene Aussage | Feld „Aussage" | `captureFrontDoor.ts` `frontDoorStatement` |
| `confidentiality` | Werkzeug „Vertraulichkeit" | nur eine ausdrücklich gewählte Stufe; keine Wahl ⇒ Schlüssel fehlt | Auswahl in „Erweiterte Details" | `draht-traegt-intern.test.ts` F5–F7, S1–S3 |
| `category` | Werkzeug „Bereich" | gewählter Bereich; ohne Wahl bei **Neuanlage und Einreichen** unsichtbar `"Allgemein"`, beim Ändern nicht mitgeschickt | Feld Kategorie | `Blatt.tsx` `mitBereich`, `buildFrontDoorPayload` |
| `type` | **nicht sichtbar** | bei Neuanlage/Einreichen unsichtbar `"best_practice"` | Auswahl Wissensart | `buildFrontDoorPayload` |
| `origin` | nicht sichtbar | `"frontdoor"` nur bei Neuanlage, danach unverändert | nach Weg (`originForSave`) | `job2695` F4/F5 |
| `tags`, `conditions`, `measures` | **nicht sichtbar** | Neuanlage `[]`; beim Ändern **nicht mitgeschickt ⇒ bleiben erhalten** | Felder Tags, Bedingungen, Maßnahmen | `job2695-vordertuer-loescht-nicht.test.tsx` F1–F3 |
| `asset`, `neededValidations`, `reviewerIds`, `pendingSources`, `anchorDocuments`, `sourceForm`, `extQuery`, `interview` | nicht sichtbar | nicht mitgeschickt ⇒ erhalten | in „Erweiterte Details" / Quellen / Interview; Grenzen je Feld mit `maxLength` und sichtbarer Rückmeldung (`DRAFT_LIMITS`); Quellen, Prüfer und Interview kappt der Server mit denselben Werten (`normalizeDraftPayload`) | `capture-sources.test.ts`, `draft-save-interview-sources-mounted.test.tsx` |
| `sourceImageCount` | nicht bearbeitbar | vom Import gesetzt, beim Laden gelesen (`setQuellBildzahl`); das Blatt schreibt es nicht | — | `Blatt.tsx` Ladeeffekt |

**Folgerungen / verbleibende Entscheidung:** (1) Das Blatt setzt drei Felder, die der Mensch dort
nicht sieht (`statement`, `type`, `category: "Allgemein"`). Ob sie sichtbar werden sollen, ist eine
Entscheidung gegen das Zielbild H3 (eine Fläche, kein Formular). (2) Die übrigen unsichtbaren
Felder gehen auf dem Blatt nicht verloren (JOB 2695). (3) Wechsel Blatt → Formular zeigt jetzt
denselben Stand oder erklärt, warum nicht (N-0068).

## R-1560 — Q3(a) §9 Zustandsmatrix der Vertraulichkeitswahl

Soll: `klarwerk_steuerung/archiv/3082/AUFTRAG.md:221-234`. Ist: `q3a-zustandsmatrix-mounted.test.tsx`.

| Zustand (§9) | Ergebnis | Beleg |
|---|---|---|
| laden | keine Stufe behauptet, Einreichen gesperrt, Schreibfläche erst nach dem Laden (DE und EN) | Z1, Z1-en; `cap-p1-fruehe-eingabe` F1, N8 |
| erfolgreich leer | Wahl offen, Einreichen gesperrt | `vertraulichkeit-pflicht/fortgesetzter-entwurf-verlangt-stufe.test.tsx` F1 |
| Fehler (lädt nicht) | Wahl offen, kein „intern" angenommen, Satz + „Erneut versuchen", kein Promote | Z2 (500), Gegenprobe G8 |
| Cache mit laufender Auffrischung | **nicht anwendbar**: Blatt und Arbeitsraum holen den Entwurf per Direktabruf (`Blatt.tsx` Ladeeffekt `endpoints.drafts.get`, `Capture.tsx` Ladeeffekt Expertenweg), nicht aus einem Abfrage-Cache; die gecachte Entwurfsliste (`useDrafts`) setzt keine Stufe | Code |
| Cache mit gescheiterter Auffrischung | **nicht anwendbar**, wie oben | Code |
| offline | beim Laden wie „Fehler" (Z3); beim Einreichen: Fehlersatz, gewählte Stufe unverändert, kein Objekt (Z4, Gegenprobe G9) | Z3, Z4 |

## Quellenwidersprüche

1. **Schrittleiste / „Empfohlen" / „Weitere Wege" (R-0061, R-0112, R-0929, R-0930) gegen Zielbild
   H3 (R-1578, jünger, von Pedi):** H3 hat die Elemente entfernt. Nicht zurückgebaut; Entscheidung
   Pedi, ob eine Orientierungshilfe auf dem Blatt zurückkehren soll.
2. **„Ein Satz daneben" (R-0084) gegen „kein Erklärtext auf der Fläche" (H3):** gelöst als
   Beschreibung am Knopf (Screenreader + `title`), nicht als sichtbarer Absatz. **Entschieden**
   (Pedi, `entscheidung:1214edcf-…`, 01.10.2026): „Ja, die Beschreibung am Knopf reicht, H3 bleibt."
   Kein sichtbarer Satz; E3 belegt den Sollzustand in DE/EN/NL.
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
* R-1560: der öffentliche `/health`-Commit ist ohne laufende Instanz nicht feststellbar.
* N-0068: Nachträge während des Sicherns sind seit Lauf 3 für Titel (N8/N8b), Text (N9), Stufe (N9b)
  und Bereich (N9c) einzeln gemessen. Die Ablehnung der zweiten Rückfrage ist nur für den Titel (N8b)
  gemessen.
* BEN-4: Die Meldung bei offenem KI-Vorschlag ist ein `window.alert` (nur „OK"); ihre Darstellung im
  echten Browser ist nicht gesichtet. Gemessen ist der Strukturvorschlag; der Assistenzvorschlag
  (`assistProposal`) läuft über dasselbe `hasPendingProposal`, ist aber nicht eigens gemessen. Ein
  Formularwechsel bei UNVERÄNDERTEM Blatt, während eine Strukturierung noch läuft, öffnet wie bisher
  sofort (der Vorschlag trifft dann auf dem verdeckten Blatt ein) — nicht Teil von B4, nicht geändert.
* Die Rückfragen in N-0068 nutzen `window.confirm` wie die übrigen Rückfragen des Blatts
  (`fd.confirmDiscard`, `fd.confirmOpenDraft`); ihre Darstellung im echten Browser ist nicht gesichtet.
  **Nachtrag `gesamt-erfassung-einstieg:layout`:** `tests/design/h3-wechsel-rueckfragen.test.ts`
  misst `sichernFrage` und `ohneSichernFrage` jetzt an der gebauten Seite in Chromium (Art `confirm`,
  vollständiger deutscher Text, Wirkung von OK/Abbrechen am Server). Das Pixelbild des nativen
  Dialogs bleibt ungesichtet (kopfloses Chromium zeichnet ihn nicht). **Nacharbeit 2:**
  `nachtragFrage` (festgehaltener echter Speicherrequest, W8a–W8c) und `vorschlagOffen` (lokaler
  Test-ModelClient, W9) stehen jetzt in `tests/design/h3-wirkung.test.ts` ebenfalls in Chromium.

## Nachtrag `gesamt-erfassung-einstieg:layout` — die H3-Browsermessungen laufen auf dem Linux-Prüfweg

`zielbild-h3-erfassen`, `zielbild-h3-kein-erklaertext` und `h3-wirkung` hingen am Mockup
`design/klarwerk/Erfassen.dc.html`, das nur auf dem Produktions-Mac liegt, und übersprangen sich
deshalb genau dort, wo Chromium laufen darf. Jetzt: der Textmesser und die Wirkungsnachweise laufen
ohne Mockup (sie lesen keinen Sollwert daraus); der Wertevergleich misst ohne Mockup gegen den Auszug
`tests/design/h3-zielbild-auszug.ts` (Anker wörtlich aus JOB 3062, Zusatzwerte aus dessen
Fallnamen; der Blattschatten V7 seit Nacharbeit 2 aus Bens Lektüre des Originals, Pfad und SHA256 in
`SCHATTEN_QUELLE`).
Wo das Mockup liegt, prüft Fall A den Auszug gegen das Mockup. Neu dort: Fall N, Schmalansicht
390 px (kein Überlauf, Blatt und beide Knöpfe im Fenster). Die Leertextfarbe (K2b Teil 4,
`#9AA2B1`; auf dem Blatt `placeholder:text-muted-2/60`) bleibt unberührt — Pedis Vorbehalt „nicht
vor der Vorführung".

## Nachtrag `gesamt-erfassung-einstieg:fehlerfaelle` (Teil c, 06.10.2026, Basis `3264ad7d`)

Abgleich statt Neubau. Die Fehlersatz-Zuordnung, die Knopfbeschreibungen und die Titelbehandlung
aus Lauf 1/2 sind unverändert. Geschlossen wurden die Reste:

| Datei | Änderung | Kriterium |
|---|---|---|
| `apps/web/src/woerterbuch/{de,en,nl}.ts` | `capture.ocrRunning`: DE „Text wird aus {{name}} gelesen … Beim ersten Mal dauert das etwas länger.", EN „Reading the text in {{name}} … The first time takes a little longer.", NL „De tekst in {{name}} wordt gelezen … De eerste keer duurt dit iets langer." — `capture.fAsset`: „Anlage / Gerät", „Equipment / machine", „Installatie / apparaat". | R-0101 |
| `tests/i18n-textmodule/werte-vorher.json`, `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt` | dieselben sechs Werte nachgetragen (K1.1 bzw. W1). | — |
| `tests/erfassung-einstieg/klare-worte-r0101.test.ts` (neu) | K0 Kalibrierung (alter Wortlaut ist in allen drei Sprachen ein Befund), K1/K2 je Sprache kein Fachwort (OCR, Worker, Sprachdaten, Asset), Dateiname eingesetzt, K3 drei verschiedene Fassungen, K4 beide Schlüssel stehen weiter in `Capture.tsx`/`BodyExtractPanel.tsx`. | R-0101 |
| `tests/erfassung-einstieg/blatt-einstieg-mounted.test.tsx` | E2 (zu groß, echter 413) und E4 (Fokus auf der Erfolgszeile) jetzt je DE/EN/NL; neu E5 je DE/EN/NL: die Anlage kommt nicht zurück → nach `FRONT_DOOR_SAVE_TIMEOUT_MS` der Fristsatz, Eingabe bleibt, kein Entwurf. | R-1002, R-0080, R-0084 |
| `tests/erfassung-einstieg/fehlersatz-und-hilfe.test.ts` | F3 (Frist) je DE/EN/NL statt nur EN. | R-1002 |

**R-0084:** Pedi hat entschieden (`entscheidung:1214edcf-b80f-455d-9501-476cb014fc0b`): „Ja, die
Beschreibung am Knopf reicht, H3 bleibt." Kein sichtbarer Satz gebaut; E3 belegt `aria-describedby`
und `title` in DE/EN/NL.

**Nacharbeit 1:** `tests/i18n-textmodule/bestand-vorher.json` trägt jetzt die Prüfsummen, die der
Linux-Prüflauf am Kandidaten `b74a7744` für K1.0 gemessen hat (Diff-Zeilen „Received", Bericht
`HISTORIE/nacharbeit-1/PRUEFUNG/textbestand-r0101.log`): `de` `055d63f8…a0ba`, `en` `5dcdd149…cc53`,
`nl` `bdcbb373…c756`. Anzahl (4437) und Basisstand unverändert. K1.1–K1.3 und K4 waren in diesem
Lauf bereits grün; `werte-vorher.json` ist nicht erneut angefasst. Außerhalb
der Erfassungsfläche bleibt „Asset" unverändert stehen, z. B. `ko.couple.placeholder` (EN „Asset
reference, …", Anlagenkopplung im Wissensobjekt). Das gehört nicht zu diesem Auftrag.

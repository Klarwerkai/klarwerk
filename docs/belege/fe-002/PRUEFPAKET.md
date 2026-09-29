# FE-002 · Header Teil 1 — Prüfpaket (Lauf 4, Runde 2)

**Status: FE-002 noch nicht menschlich abgenommen.**
Technische Tests und Bildbelege ersetzen die verlangte Verständlichkeitsprobe mit Pedi bzw. einer
neuen Person nicht (Abnahmekriterium 1 / E7). Die Gestaltung unten ist ein **Umsetzungsvorschlag**;
Pedi hat die Detailgestaltung noch nicht abgenommen.

---

## 0. Kandidat, Lieferung, Live — und wie die Bilder dem Kandidaten zugeordnet sind

| | |
|---|---|
| Auftrag | `arbeit:fe-002-header-orientierung-20260926`, zuletzt Lauf `lauf:b3:arbeit:fe-002-header-orientierung-20260926:4`, **Runde 2** (Bens Befund B1: Tutorial-Knopf bei 1024 px; Zeile „Lauf 4, Runde 2" unten). Runde 1 war die Zusammenführung mit dem Hauptstand .627 (E8). Davor Lauf 3 Runde 3 (Nacharbeit zu Bens Befunden B1/B2 aus Runde 2: 999 px/en weiter gekappt; Runde 2 behob 900 px/nl, Runde 1 war die Zusammenführung mit dem Hauptstand, E8). Frühere Zeilen: Lauf 1 Runden 1–6, Lauf 2 Runden 1–3 |
| Arbeitsbasis | Bilder: `928026d8` (Runde 2, Stand 1.0.0-beta.1.615); Runde 3: `bb889614` (enthält Runde 2 `afcd677f`). Die Oberflächenquellen sind zwischen beiden gleich — die Prüfsummen unten gelten weiter |
| Runde 4 | Integration des Zielbranchs `588f6e7c` (Wiki-Bearbeitungsreservierung, Version .617) — keine Kopfband-Datei berührt; die Oberflächen-Prüfsummen unten sind nach der Zusammenführung nachgerechnet und **unverändert** |
| Runde 5 | Integration des Zielbranchs `94dbf348` (Version .618, pptx-Importtests) — konfliktfrei, keine Kopfband-Datei berührt; Oberflächen-Prüfsummen nachgerechnet und **unverändert** |
| Runde 6 | Tor-Nacharbeit ohne Oberflächenänderung: ein wettlaufanfälliger Bibliothekstest (`tests/bibliothek-quellennachweis/dateiname-bricht-um-chromium.test.ts`, P1, erster Breitenwechsel) öffnet seinen Abschnitt nach dem Breitenwechsel erneut (in Lauf 2 ersetzt, s. nächste Zeile); Oberflächen-Prüfsummen unverändert |
| Lauf 2, Runde 1 | Integration des Hauptstands `dcceb67a` (Version .619, Gliederung mit Zeiger) — einziger Konflikt im Regressionsinventar, gelöst mit Hauptstand-Eintrag zuerst, FE-002-Eintrag danach; keine Kopfband-Datei berührt, Oberflächen-Prüfsummen nachgerechnet und **unverändert**. Der Bibliothekstest aus Runde 6 klickt jetzt erst nach stehender schmaler Anordnung und protokolliert die Öffnungsklicks; die frühere Begründung „grün auf g3/g11" war unzutreffend (gezielte Läufe ohne diese Datei) und ist korrigiert |
| Lauf 2, Runde 2 | Nacharbeit zu Bens Befund: „Seite finden" im schmalen Drawer schloss den Drawer, öffnete aber keine Palette (Ereignis bei noch gesperrter Modalgrenze verworfen). Korrektur in `shell/CommandPalette.tsx` (vorgemerkte Öffnung nach Freigabe der Grenze, nur für Anfragen mit `nachModalgrenze`; der Fokus-Rückweg kommt aus der Anfrage, weil unter Last beim Einlösen noch `BODY` fokussiert sein kann), `shell/ArbeitsbereicheMenue.tsx` (sendet Kennung und Rückweg), `shell/DrawerMenue.tsx` und `shell/MobileNavDrawer.tsx` (reichen den Auslöser „Menü" als Rückweg durch). **Keine Darstellungsänderung** |
| Lauf 2, Runde 3 | Nacharbeit zu Bens Befund (E6): das Bild der mobilen Palette fehlte. Beim Aufnehmen im echten Chromium zeigte sich ein zweiter Wettlauf im Drawer-Weg (der Zuhörer der Palette sah bei offenem Drawer noch „keine Grenze", öffnete sofort und merkte die Drawer-Zeile als Rückweg → nach Escape Fokus auf `BODY`). Korrektur in `shell/CommandPalette.tsx` und `shell/ArbeitsbereicheMenue.tsx`: Anfragen aus dem Drawer werden immer vorgemerkt und nach Freigabe der Grenze eingelöst; das Kopfband-Menü öffnet wie bisher sofort. **Alle Bilder neu aufgenommen** am Arbeitsstand `9b75952a` (Version .622), darunter neu `offen-seite-finden-aus-drawer-390.png` und `fokus-menue-nach-seite-finden-390.png` |
| Lauf 3, Runde 1 (E8) | FE-002-Stand `953663db` (Lauf 2, enthält `fb854431`) auf den Hauptstand `ad623d82` (Version .624, enthält `8bc3b5ba` / .623) übertragen. Einzige Überschneidung war `tests/bibliothek-quellennachweis/dateiname-bricht-um-chromium.test.ts`: **unverändert aus dem Hauptstand** (JOB 4095, wartet auf `TELEFONLAGE_STEHT`); die FE-002-Klickschleife aus `fb85443` ist verworfen. `data-testid="kopfband-menue"` steht weiter nur in der schmalen Anordnung (`shell/Kopfband.tsx`). Regressionsinventar: Hauptstand-Einträge unverändert, FE-002-Eintrag danach. Der Hauptstand änderte `components/Modal.tsx` (Anmeldung an der Grenze nur an `enter`); Palette und Drawer benutzen diese Komponente nicht, die jsdom-Fälle E1.5–E1.7 sind damit grün. Oberflächen-Prüfsummen unten nachgerechnet und **unverändert**; Bilder deshalb nicht neu aufgenommen. Komponentenzähler (mega84): lokal nach der Zusammenführung gemessen weiter 410 (Test grün, macOS); maßgeblich bleibt die Tormeldung des Linux-Tors an diesem Kandidaten |
| Lauf 3, Runde 2 (B1/B2) | **B1** — Bens Kandidatenbilder (Linux): 900 px/nl mit CI zeigte das Zahnrad über der kompakten Suche „Kennis zoeken", 999 px/en den Platzhalter „Search knowledge" abgeschnitten. Ursachen und Korrektur: (1) in Stufe 3 durfte das Suchformular unter seinen Inhalt schrumpfen (`min-width: 0`), die Kurzbeschriftung ragte dann über das Zahnrad — jetzt `flex-shrink: 0` (`index.css`), und `shell/kopfbandStufe.ts` wertet einen über den Kasten ragenden Suchinhalt und sich überdeckende Griffe der Gruppe als „passt nicht"; (2) der Platzhalter wurde auf einer Canvas-Fläche gemessen — ohne eingebettete Schrift (`"IBM Plex Sans", system-ui, sans-serif`) kann die Canvas-Auflösung der Ersatzschrift von der des Dokuments abweichen; gemessen wird jetzt mit einer Probe-Zeile im Dokument, gegen die Inhaltsbreite des Feldes; (3) nach dem Laden einer Schrift wird die Stufe neu bestimmt (`document.fonts`), weil sich dabei kein beobachteter Kasten ändert. Für 999 px/en ist die Ursache (2)/(3) **abgeleitet, nicht auf Linux nachgestellt** — auf macOS passte der Platzhalter dort schon vorher (106,9 von 130,0 px). **B2** — `tests/fe002-kopfband/kopfband-fe002-chromium.test.ts`: jede ruhende Leiste wird gemessen und geprüft, aufgenommen und danach **erneut gemessen**; die zweite Messung muss der ersten gleichen und dieselben Zusagen bestehen (`pruefeUndBelege`). Gemessen wird erst nach `document.fonts.ready`. Die sichtbare Kurzbeschriftung ist ein eigener Kasten im Überdeckungsvergleich (`suche:wort`), ein über den Suchkasten ragender Inhalt ist eigene Zusage (`sucheInhaltUeber`), der Platzhalter wird im Dokument gemessen und Text-/Innenbreite je Breite protokolliert. **Gegenprobe**: die neue Prüfung gegen den unveränderten alten Produktstand (Build aus `06e0a7cd`) meldet rot `mit CI nl 900: überlappende Griffe: expected [ 'zahnrad×suche:wort (6.8 px)' ]`; mit der Korrektur 8/8 grün. `belege.json` trennt jetzt `firmenCi` (Schalter an) und `firmenlogoSichtbar` (900–999 px blendet die Bestandsregel `LOGO_OHNE_PLATZ_QUERY`, JOB 3641, das Logo aus). **Alle Bilder des Chromium-Laufs neu aufgenommen** |
| Lauf 3, Runde 3 (B1/B2) | **Ursache belegt** (Runde 2 hatte sie nur abgeleitet, und falsch): ein `type="search"`-Feld reserviert in Chromium neben dem Text rund 13 px für den Löschknopf, auch wenn es leer ist. Weder Canvas (Lauf 2) noch Probe-Zeile (Runde 2) kennen diesen Platz — Linux meldete „108.0 von 113.0 px" und zeichnete „Search knowledg". Auf macOS nachgestellt: am Stand `9a84ae90` ist der Platzhalter am echten Kopfband (en, mit CI) bei 977–988, 1043–1054, 1123–1134 und 1284 ff. px gekappt (Breiten-Durchlauf 900–1440 px, je 1 px, in EN/NL/DE mit und ohne CI; 174 Funde, bei 982 px Feld 113 px wie auf Linux). **Korrektur** `shell/kopfbandStufe.ts`: gefragt wird das Feld selbst — ein unsichtbarer Zwilling in derselben Breite trägt den Platzhalter als Wert, `scrollWidth > clientWidth` heisst gekappt; das echte Feld wird nicht angefasst. Derselbe Durchlauf am korrigierten Stand: keine ruhende Kappung; einzig im Moment des Wechsels 999 → 1000 px (Firmenlogo wird eingeblendet und lädt) kurz ein gekappter Zwischenzustand, nach spätestens 1,5 s aufgelöst (Stufe 2/3). **Prüfung** `kopfband-fe002-chromium.test.ts`: dieselbe Feld-Messung (`PLATZHALTER_JS`) in C1/C2; neue Breite 982 px in der EN/NL-Reihe (auf macOS die Linux-Lage); neuer Fall **C2b „Messgerät"**: ein Nachbau des Suchformulars mit Feld = Text + 5 px — die Probe-Zeile meldet „passt", die Prüfung „gekappt" (Bild `messgeraet-en-kappung.png`, links oben, bewusst gekappt). **Gegenprobe**: die neue Prüfung am alten Stand `9a84ae90` rot: `mit CI en 982: Benennung der Suche abgeschnitten: expected false to be true`; am korrigierten Stand 9/9 grün. Bei 999 px/en zeigt macOS Feld 130 px — dort war der Fehler lokal nicht zu sehen; die Linux-Aussage liefert das Tor (Protokollzeile „Platzhalter-Text … im Feld … (mit Knopfplatz: ganz/gekappt)") |
| Lauf 3, Runde 4 (Diagnose) | Nur Diagnose, **keine Produkt- oder Teständerung**: der rote Volllauf `pa-1790597147-03157850` am Kandidaten `7ed5ada0` (einziger Fall: `gliederung-mit-tastatur-chromium` C2, Klick auf „Drei“ kam an „EinsZwei“ an). Bericht `C2-DIAGNOSE.md`, Diagnoseskript `scripts/fe002-c2-diagnose.ts` (nicht in `tools/check`). Arbeitshypothese: Prüf-Wettlauf, weil die Kollisionszeile nach dem Griff eingefügt wird (39,1 px Verschiebung); geometrisch ohne Kopfband-Beteiligung, zeitlicher Einfluss offen. Serverausführung nach Bens Bindung offen |
| Lauf 4, Runde 1 (E8) | FE-002-Stand `a5786e9f` (Lauf 3 Runde 4, enthält `fb854431`) auf den Hauptstand `41fad46c` (Version .627, enthält `8bc3b5ba` / .623 und FE-003 „Seitentutorial Fragen“ / .625) übertragen, als Patch `ad623d82..a5786e9f` mit Dreiwegeabgleich. Die geänderten Dateien sind genau die Vereinigung beider Seiten (gegengeprüft, keine FE-002-Datei verloren). Zwei Konflikte: (1) `apps/web/src/index.css` — FE-003-Regeln (`.tutorial-demo`, `.tutorial-fortschritt`, `kw-tutorial-aufleuchten`) und FE-002-Stufenregeln stehen beide, nacheinander, unverändert; (2) Komponentenzähler mega84 — FE-003-Begründung erhalten, FE-002 danach: **423 → 428, gemessen** („gemessen: 428 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 519 Quelldateien", macOS; = 423 + die fünf FE-002-Bauteile). Maßgeblich bleibt die Tormeldung des Linux-Tors an diesem Kandidaten. `tests/bibliothek-quellennachweis/dateiname-bricht-um-chromium.test.ts` unverändert aus dem Hauptstand; Regressionsinventar: Hauptstand-Einträge unverändert, FE-002-Eintrag danach; `data-testid="kopfband-menue"` nur in der schmalen Anordnung. **Keine FE-002-Oberflächenänderung.** Die Git-Objekte von `shell` und `index.css` sind neu (Tabelle unten), weil FE-003 `shell/AppShell.tsx` (Knopf „Tutorial" unter dem Kopfband, Bereich oben in `<main>` — beide nur auf `/fragen`, sonst `null`) und `index.css` (nur `.tutorial-*`) geändert hat. Bilder **nicht neu aufgenommen** (keine Browserläufe auf dem Produktions-Mac); siehe „Zuordnung" unten |
| Lauf 4, Runde 2 (B1) | Bens Befund aus dem Volllauf `pa-1790657849-abed1527`: FE-003-Fall „Tutorial „Fragen“ — Laptop 1024“ rot, „der Knopf steht rechts vom Schriftzug", erwartet ≤ 20, gemessen 32. Ursache: FE-002 setzt das Seitenpolster des Kopfbands bei 900–1279 px auf 16 px (`LAPTOP_QUERY`), die FE-003-Tutorial-Leiste hatte ab 900 px weiter 32 px (`min-[900px]:px-8`). Korrektur in `apps/web/src/tutorial/TutorialRahmen.tsx`: die Leiste folgt derselben Grenze wie das Kopfband (`px-4`, ab 1280 px `min-[1280px]:px-8`); im Build nachgesehen, die Regel steht in `@media (min-width:1280px)`. Unter 900 px unverändert (`px-4`, wie FE-003 gebaut). Die Testgrenze ist **nicht** angefasst. Kopfband und `/start`-Bilder unberührt (die Leiste erscheint nur auf `/fragen`). Die Browsergegenprobe (`tests-smoke/fe003-tutorial-fragen.spec.ts`, `tests/fe003-tutorial-fragen/browser-breiten.integration.test.ts`) lief lokal **nicht** (keine Browserläufe auf dem Produktions-Mac); maßgeblich ist das Linux-Tor am Kandidaten |
| Kandidat | der Commit, den der Starter nach dieser Runde festhält (SHA dort). Aufgenommen wurde am Arbeitsbaum auf `9a84ae90` mit den Änderungen von Lauf 3 Runde 3, vor dem Commit (so steht es in `bilder/belege.json` unter `arbeitsstand`). Seit Lauf 4 enthält der Kandidat zusätzlich die FE-003-Änderungen an `AppShell.tsx`/`index.css`; die Bilder stammen daher aus dem Vorgängerstand (Zuordnung unten) |
| In den Bildern angezeigte Version | `1.0.0-beta.1.624`. Ein späterer Versionsschritt („ship") ändert nur diese Zahl, nicht das Kopfband. Die Prüfumgebungsbilder (`pruefumgebung-*.png`) und `vorher-*.png` stammen aus früheren Läufen (s. Abschnitt 2) |
| Lieferung | **nicht geliefert** |
| Live (klarwerk.ai) | von diesem Lauf nicht verändert und nicht erneut gemessen; das Ticket beschreibt dort den Istbestand von .612 |

**Zuordnung Bild ↔ Kandidat (prüfbar, ohne dem Bild zu glauben).** Die Bilder wurden aus genau
diesen Quellständen gebaut (Git-Objektkennungen, erhoben am 28.09.2026 am Arbeitsbaum von Lauf 3
Runde 3, unmittelbar nach der Aufnahme):

| Pfad | Git-Objekt |
|---|---|
| `apps/web/src/shell` | `d84c8f9f31e7d9f017ed1f0f67d4446b177498b7` |
| `apps/web/src/styles` | `81af41cdd1efcd4b712a1fca871158e73d5302b1` |
| `apps/web/src/index.css` | `6677be8d96a275c977a6ececa7838b90258d37de` |
| `apps/web/src/texte/fe002.ts` | `d2b02896c8dcd108205760dfc7f00888c2c3a52b` |
| `apps/web/src/app/navigationGliederung.ts` | `fedfbfc895718bca9718b3369ebf92500a6a469d` |

**Lauf 4 (Zusammenführung mit .627):** `styles`, `texte/fe002.ts` und `navigationGliederung.ts`
unverändert. Neu sind `apps/web/src/shell` → `dac32bac4123ca836c2efc0d4378d30ae1cd7158` und
`apps/web/src/index.css` → `b6b601d3660feaf5d13186bd1ab2a9ae457420c5`. Der Unterschied zum
Bildstand ist ausschließlich der FE-003-Hauptstand (`git diff a5786e9f <KANDIDAT-SHA> --
apps/web/src/shell apps/web/src/index.css` zeigt nur `AppShell.tsx` und die `.tutorial-*`-Regeln).
Dass die Bilder der ruhenden Leiste auf `/start` deshalb gleich aussehen, ist **abgeleitet, nicht
gemessen**; die Chromium-Prüfung `kopfband-fe002-chromium.test.ts` misst das Kopfband im Linux-Tor
am Kandidaten erneut, und mit dem Befehl unten lassen sich die Bilder dort neu erzeugen.

Nachrechnen am Kandidaten:
`for p in apps/web/src/shell apps/web/src/styles apps/web/src/index.css apps/web/src/texte/fe002.ts apps/web/src/app/navigationGliederung.ts; do echo "$p $(git rev-parse <KANDIDAT-SHA>:$p)"; done`

Oder die Bilder am Kandidaten neu erzeugen (legt auch `belege.json` neu an):
`./tools/build && FE002_ARBEITSSTAND=$(git rev-parse HEAD) FE002_BELEGE=docs/belege/fe-002/bilder npx vitest run tests/fe002-kopfband/kopfband-fe002-chromium.test.ts`

| Aufnahme | |
|---|---|
| Browser | Chromium 149.0.7827.55 (Playwright, headless), macOS 15.7.4 |
| Testumgebung | gebaute Oberfläche `apps/web/dist` auf der Bühne `tests/design/h6-chromium.ts` (echte Fastify-App im Prozess, Adresse `https://klarwerk.test`, Designthema „modern") |
| Rolle | Administrator; niedrigere Rolle (Expertin) siehe Prüfumgebung und Funktionsbelege |
| Testbestand | zwei unbeantwortete Fragen über `POST /api/ask` → zwei **echte** ungelesene Meldungen (offene Wissenslücken) |
| Firmen-CI | über den echten Adminweg `PUT /api/admin/branding` (Profil `advisor`) |
| Je Bild | Breite, Sprache, Firmen-CI, Stufe der rechten Gruppe, Pfad, Bedienweg, Rolle: **`bilder/belege.json`** |

---

## 1. Umsetzungsvorschlag — vier Zwecke, vier sichtbare Wege

| Zweck | vorher (.612, `/start`, Admin, Desktop) | nachher (Vorschlag) |
|---|---|---|
| **Arbeitsbereiche öffnen** | Zahnrad → „Bereiche" (aufklappen) → z. B. „Meine Aufgaben", „Gesamtanweisungen" | eigener Einstieg **„Arbeitsbereiche ▾"** direkt hinter den Hauptpunkten; gruppierte Übersicht (Arbeiten · Qualität · Verwaltung · Persönlich und Hilfe) plus Zeile **„Seite finden … ⌘K"** |
| **Wissen suchen** | Feld mit Platzhalter „Suchen" (Bibliothek nur im `aria-label`) | Feld mit sichtbarem **„Wissen suchen"**; bei Platzmangel **kompakt: Lupe mit sichtbarem, zweizeiligem „Wissen suchen"** (Runde 2) |
| **Seite finden (Schnellzugriff)** | Knopf „Gehe zu … ⌘K", Palette mit technischen Pfaden | Knopf **„Seite finden ⌘K"**; Palette „Seite finden …" ohne Pfade, mit Hinweis auf „Wissen suchen" |
| **Einstellungen** | Zahnrad = Einstellungen, Status, Hilfe **und** Arbeitsseiten | Zahnrad **„Einstellungen und Hilfe"**: Verwaltung/Einstellungen (Admin), Status, **Persönliche Einstellungen** (jede Rolle), Seitenhilfe, Hilfe, Rechtliches, Version |
| **Meldungen** | kleiner Punkt am Profilkreis | eigener Zugang **Glocke „Meldungen"** mit Zahl der ungelesenen; Name sagt „2 ungelesene Meldungen" / „Keine ungelesenen Meldungen" / „Stand der Meldungen wird geprüft" (keine falsche Null) |
| **Konto** | Profilkreis mit Meldungspunkt | Profilkreis nur noch **Konto** |

Hauptnavigation, Rollenfilter, NavGuard, ⌘K/Strg+K, schmaler Menü-Knopf mit Drawer und alle Ziele
bleiben. „Gesamtanweisungen" kommt aus derselben Namensquelle wie überall (`anzeigeNameKey`) — ändert
FE-001 den Namen, folgt das Kopfband.

### Platzmangel: die Zeile misst selbst (Runde 2)

Runde 1 ließ Griffe über feste CSS-Schwellen zurücktreten; auf Bens Linux-Prüfplatz überdeckte
dadurch bei 1024 px/Firmen-CI/Niederländisch die Suche „Arbeitsbereiche" (8,2 px). Seit Runde 2 misst
das Kopfband im Browser (`shell/kopfbandStufe.ts`), ob etwas überläuft, abgeschnitten ist oder der
Platzhalter nicht ganz passt, und stuft zurück:

| Stufe | was zurücktritt | was bleibt |
|---|---|---|
| 0 | nichts | alles |
| 1 | das Wort „Meldungen" | Glocke, Zahl, Name, Zeigehinweis |
| 2 | Knopf „Seite finden ⌘K" (breite Bauform) | Weg unter „Arbeitsbereiche" und über ⌘K/Strg+K |
| 3 | Suchfeld → kompakte Suche | Lupe + **sichtbares „Wissen suchen"**, Klick öffnet die Wissenssuche der Bibliothek |

Reicht auch Stufe 3 nicht, brechen die Punkte links um, statt dass sich etwas überdeckt. Die je Bild
gemessene Stufe steht in `belege.json` (z. B. `kopf-de-1280`: 1, `kopf-ci-de-1000`: 3,
`kopf-ci-nl-1024`: 3).

---

## 2. Bildbelege (`bilder/`, Metadaten in `bilder/belege.json`)

Ruhende Leiste (nur Kopfband), `/start`, Admin, zwei ungelesene Meldungen:

| Dateien | Breiten | Firmen-CI | Sprache |
|---|---|---|---|
| `kopf-de-{1440,1280,1024,1000,940,900,899,760,390}.png` | Desktop, Laptop, Umbruchgrenzen, schmal | aus | DE |
| `kopf-ci-de-{1440,1280,1024,1000,999,940,900,899,760,390}.png` | dieselben + 999 | an | DE |
| `kopf-ci-en-*.png`, `kopf-ci-nl-*.png` | alle zehn Breiten + 982 px (Runde 3) | an | EN / NL |
| `messgeraet-en-kappung.png` | 1280 px, Fall C2b | – | EN — **nachgestelltes** Suchfeld links oben, absichtlich gekappt (Beleg, dass die Prüfung Kappung erkennt); das Kopfband darüber ist das echte |
| `vorher-de-{1280,1024,390}-start.png` | 1280 / 1024 / 390 | aus | DE — **Istbestand am Basisstand c04ec239** (Runde 1, vor FE-002) |

Geöffnete Bereiche (ganzes Fenster, 1280 px sofern nicht anders genannt):

| Datei | Bedienweg |
|---|---|
| `seite-de-1280-start.png` | ruhende Startseite |
| `fokus-arbeitsbereiche-1280.png` | ab Seitenanfang **Tab** bis „Arbeitsbereiche" — sichtbarer Fokusring |
| `offen-arbeitsbereiche-1280.png` | danach **Enter**, **Pfeil ab** |
| `offen-arbeitsbereiche-1024.png` | 1024 px, Klick auf „Arbeitsbereiche" |
| `offen-einstellungen-1280.png` | Fokus auf Zahnrad, **Enter** |
| `offen-meldungen-1280.png` | Fokus auf Glocke, **Enter** — „Meldungen · 2 neu"; Öffnen ist Kenntnisnahme (bestehende Regel Audit-P3) |
| `offen-konto-1280.png` | Fokus auf Konto-Kreis, **Enter** |
| `offen-seite-finden-1280.png` | **Strg+K** — Palette ohne Pfade |
| `offen-meldungen-390.png` | 390 px, Klick auf die Glocke |
| `offen-drawer-390.png` | 390 px, Klick auf „Menü" |
| `offen-seite-finden-aus-drawer-390.png` | 390 px, Klick auf „Menü" → Klick auf „Seite finden" im Drawer — Drawer zu, Palette „Seite finden …" offen, Fokus im Suchfeld, Seitennamen mit Gruppe, keine Pfade (Fall C7) |
| `fokus-menue-nach-seite-finden-390.png` | 390 px, Tastatur: „Menü" (Enter) → „Seite finden" (Enter) → Escape — Palette zu, sichtbarer Fokusring auf „Menü" (Fall C7, Runde 1 von 5) |
| `pruefumgebung-anmeldung-1280.png` | **Prüfumgebung (Abschnitt 4)**: über die echte Anmeldemaske mit dem zur Laufzeit erzeugten Admin-Zugang angemeldet, `http://127.0.0.1:4702/start`, Glocke zeigt 2 |
| `pruefumgebung-frische-kopie-1280.png` | dieselbe Prüfumgebung, gestartet aus einer **frischen Kopie ohne vorinstallierte Abhängigkeiten** mit genau der Startfolge aus Abschnitt 4 (Port 4703), Anmeldung über die Maske, Glocke zeigt 2 |

---

## 3. Funktionsbelege (automatisch)

| Befehl | Ergebnis | deckt |
|---|---|---|
| `npx vitest run tests/fe002-kopfband/kopfband-fe002.test.tsx` | 26/26 | E1–E5 in jsdom (seit Lauf 2 R2 mit E1.5–E1.7: Drawer → „Seite finden" öffnet die Palette nach Freigabe der echten Modalgrenze, Escape gibt den Fokus an „Menü" zurück; gewöhnliche Anfragen bei offener Grenze bleiben abgewiesen; der Rückweg kommt aus der Anfrage, nicht aus dem gerade fokussierten Element), inkl. Vorher/Nachher-Ziele je Rolle (viewer, experte, controller, admin mit/ohne erweiterte Module) |
| `npx vitest run tests/fe002-kopfband/kopfband-fe002-chromium.test.ts` | 9/9 (seit Lauf 3 R3 mit C2b) | echter Browser (seit Lauf 2 R2 mit C7: 390 px, Menü → „Seite finden" → Palette → Treffer anklicken → Zielseite; per Tastatur fünfmal hintereinander Menü → „Seite finden" → sofort Escape → Fokus auf „Menü", jede Runde protokolliert): keine Überlappung, kein Überlauf, alle Zwecke sichtbar, **Suche an jeder breiten Breite sichtbar und ungekürzt benannt** — 10 Breiten ohne CI (DE) und 10 Breiten mit CI in **DE, EN und NL**; Tastatur mit sichtbarem Fokus; Strg+K; Wissen suchen per Tastatur |
| `npx vitest run tests/fe002-kopfband/pruefumgebung.test.ts` | 3/3 | die Prüfumgebung wird auf echtem Port ausgeliefert, beide Zugänge melden sich an (admin, experte), zwei ungelesene Meldungen |

---

## 4. Prüfumgebung für die menschliche Probe (E7)

**Bereitstellung**: auf dem Rechner der prüfenden Person (Pedi / Frontend-Berater), am Kandidaten:

```
git checkout <KANDIDAT-SHA>
npm ci                                  # Wurzel: Server, Werkzeuge
npm ci --prefix apps/web                # Oberfläche: React, i18next, Vite — ohne sie scheitert der Build
./tools/build                           # baut u. a. apps/web/dist
npx tsx scripts/fe002-pruefumgebung.ts  # zusätzlich --firmen-ci für das Firmenlogo
```

Das Skript startet die Kandidatenfassung (echter Server, gebaute Oberfläche) und gibt aus:

```
FE-002 Prüfumgebung steht (Datenbestand nur im Arbeitsspeicher; Strg+C beendet).
Adresse:  http://127.0.0.1:4702/start
Zugang admin    admin@fe002-probe.test      Kennwort: <bei jedem Start zufällig erzeugt>
Zugang experte  expertin@fe002-probe.test   Kennwort: <bei jedem Start zufällig erzeugt>
Ungelesene Meldungen des Administrators: 2
```

- **Kein Geheimnis im Repository**: die Kennwörter entstehen bei jedem Start neu und stehen nur auf
  der Konsole der prüfenden Person.
- **Testbestand**: Administrator und Expertin (niedrigere Rolle); zwei echte ungelesene Meldungen
  (offene Wissenslücken aus dem normalen Frageweg); keine KI nötig (deterministischer Ersatzmodus).
- Für ein anderes Gerät im selben Netz: `--host 0.0.0.0 --port 4702`.
- **Startfolge ohne Vorinstallation geprüft (Runde 3)**: in einer frischen Kopie des Arbeitsstands
  ohne jedes `node_modules` die vier Befehle oben der Reihe nach — `npm ci` Exit 0,
  `npm ci --prefix apps/web` Exit 0, `./tools/build` Exit 0, Skript startet auf Port 4703,
  `curl …/start` → HTTP 200, Anmeldung über die Maske in Chromium 149 → Glocke „2" (Bild
  `pruefumgebung-frische-kopie-1280.png`). Bens Befund aus Runde 2 (ohne den zweiten `npm ci`
  scheitert der Build an fehlendem `react`/`i18next`) ist damit behoben.
- **Tatsächlich bereitgestellt und abgegangen** am 27.09.2026 auf dem Bau-Mac: Aufruf wie oben,
  `curl http://127.0.0.1:4702/start` → HTTP 200, Anmeldung über die Maske in Chromium 149 → Kopfband
  mit Glocke „2" (Bild `pruefumgebung-anmeldung-1280.png`); danach beendet.
- **Grenze, ausdrücklich**: eine dauerhaft im Netz erreichbare Instanz (öffentliche Adresse) stellt
  dieser Lauf nicht bereit — Deployment läuft nur über CI/CD (CLAUDE.md). Die Probe läuft deshalb auf
  dem Rechner der prüfenden Person.

**Ablauf der Probe** (ohne jede Erklärung vorab; nicht helfen; Zeit und ersten Klick notieren):

1. „Öffnen Sie die Seite *Meine Aufgaben*." (Arbeitsbereich öffnen)
2. „Suchen Sie im gespeicherten Wissen nach *Urlaub*." (Wissen suchen)
3. „Wo würden Sie Einstellungen ändern?" (Einstellungen finden)
4. „Gibt es neue Meldungen für Sie, und wie lesen Sie sie?" (Meldungen lesen)

Zuerst als Administrator bei ≥ 1280 px, dann 1024 px, dann schmal (Browserfenster auf ~390 px oder
Telefon im selben Netz); wahlweise als Expertin wiederholen. Hinweis: bei 1024 px kann je nach
Schrift und Sprache die kompakte Suche erscheinen — auch sie ist Teil der Probe. Nach dem Öffnen der
Meldungen gelten sie als gelesen; für eine zweite Person die Umgebung neu starten.

**Protokoll je Aufgabe**: gelöst ja/nein · erster Klick · Umweg · Kommentar der Person.
**Abnahmekriterium**: alle vier Zwecke ohne vorherige Erklärung im Header zugeordnet.
**Ergebnis**: noch nicht durchgeführt — separat zu dokumentieren.

---

## 5. Offen / zur Entscheidung mit Pedi

- „Seite finden ⌘K" steht als eigener Knopf nur, wo Platz ist (DE ohne CI ab 1280 px; mit CI oder
  längeren Sprachen erst breiter). Sonst unter „Arbeitsbereiche" und auf ⌘K — Pedis frühere Vorgabe
  (JOB 3503: „Gehe zu" direkt sichtbar) gilt damit nur bei ausreichender Breite.
- Zahnrad und Glocke tragen meist kein sichtbares Wort (Symbol, Name, Zeigehinweis; die Glocke
  zusätzlich die Zahl, bei Platz das Wort „Meldungen").
- Die kompakte Suche (Stufe 3) ist klein (11 px, zweizeilig); ob sie für neue Personen genügt, klärt
  die Probe.
- Schmal (< 900 px) steht wie bisher kein Suchfeld im Kopfband; die Wissenssuche bleibt über
  „Bibliothek".
- Öffnen der Meldungsliste markiert wie bisher alles Sichtbare als gelesen (Audit-P3, unverändert).

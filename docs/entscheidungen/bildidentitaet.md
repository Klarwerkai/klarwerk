# Bilder, Anker und Bildunterschriften konsistent zuordnen — Bestandsabgleich und Lieferung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-bildidentitaet`, Lauf 3, Runden 1 bis 3 (29.09.2026).
Basis: `1530dfeb` = 1.0.0-beta.1.628. Die Auftragsquelle
(`klarwerk_steuerung/gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/auftragsquellen/bildidentitaet.json`)
verknüpft 46 Aufnahmepunkte. Ihr Originalwortlaut steht unverändert in den dort genannten
`quellenpaketen/aufnahmepunkte-*.json` und wird hier nicht wiederholt.*

**Abgrenzung zu früheren Läufen.** Lauf 1 und Lauf 2 dieses Auftrags (Branches
`lauf/lauf_b3_aufnahme_20260922_gesamt-bildidentitaet_1` und `_2`) sind nicht übernommen worden. Lauf 2
endete an der Nacharbeitsgrenze. Am 27.09. wurde er ausdrücklich zurückgesetzt (`work_reset`, Pedi):
„kein Rückgriff auf ältere Läufe – neu vom Hauptstand“. Dieser Lauf baut deshalb nichts aus diesen
Branches nach und übernimmt keine ihrer Belege. Was dort als geliefert steht, gilt hier als **nicht
geliefert**.

## Was dieser Lauf gebaut hat

### 1. Die Identität kommt vom Bild (R-0009, R-1599/N8, I50 erstens, Kriterien 1–3)

**Gemessen vor dem Bau** (Tests in `tests/bildidentitaet/identitaet-vom-bild.test.ts`, am alten Stand
10 von 14 rot):

- **Server** (`anchorFigures`, `services/structure/src/sanitize.ts`). Jeder Speicherweg läuft hier
  durch: Entwurf, Wissensobjekt, Import. Bisher führte die Kennung der Hülle, danach die des ersten
  Kinds. Folgen:
  - Aus Hülle `a`, Bild `a` und Fußnote `b` wurde überall `a`. Die fremde Beschreibung hing danach
    dauerhaft an Bild `a`, und die Kennungen behaupteten, das sei richtig. Das ist wörtlich der
    Schaden aus R-0009: „der Fehler löscht seine eigene Spur“.
  - In einer Word-Hülle mit zwei Bildern und je eigener Fußnote bekam die Fußnote von Bild `b` die
    Kennung von `a`.
  - Ein **ersetztes** Bild erbte über die stehengebliebene Hülle die Kennung und damit die Beschreibung
    des alten. Ersetzt heißt hier: in einer verankerten Hülle gelöscht und neu eingefügt.
- **Editor** (`ensureImageAnchors`, `apps/web/src/lib/editorFigures.ts`). In einer flachen figure
  übernahm ein Bild ohne Kennung über `gemeinsameKennung` die Kennung der Fußnote daneben. Das ist
  genau die Lage aus I50 erstens, die in getrennten Einheiten seit JOB 916 abgelöst war.
  `captionForImage` fiel außerdem auf die erste direkte Fußnote zurück, **auch wenn deren Kennung
  widersprach**. Der Editor zeigte eine fremde Beschreibung als die des Bildes, Galerie und Bildsuche
  dagegen nicht.

**Jetzt gilt an beiden Stellen dieselbe Regel:**

- Das Bild behält seine Kennung. Ist sie schon vergeben, wird es getrennt und bekommt eine frische.
- Hat das Bild keine Kennung, erbt es nur in einer **nie verankerten** Hülle (ohne `data-image-id` an
  der figure). Das betrifft Altbestand und fremdes Markup, wo die Struktur die einzige Auskunft ist;
  dort gilt der bisherige Vertrag.
- In einer **verankerten** Hülle ist ein Bild ohne Kennung nachträglich hineingekommen. Jede
  verankernde Stelle setzt die Kennung an Hülle *und* Bild: Editor, `anchorFigures`, Word, PPTX,
  Folienbilder und Beispielpakete. Das Bild bekommt eine neue Kennung und erbt nichts.
- Eine Fußnote wird nur angeglichen, wenn sie keine Kennung trägt oder der Kennung eines Bildes
  derselben Hülle folgt. Das gilt auch dann, wenn dieses Bild wegen einer Doppelung umbenannt wurde.
  Jede andere Fußnote **behält ihre Kennung**.
- Im Editor bekommt ein Bild, neben dem nur fremd gekennzeichnete Fußnoten stehen, eine **eigene
  leere Fußnote** direkt hinter sich. Die fremde bleibt sichtbar stehen und trägt die vorhandene
  Kennzeichnung „noch keinem Bild zugeordnet“ (R-1035). Sie lässt sich über den vorhandenen
  Zuordnungsweg (V7, `ordneFussnoteZu`) **bewusst** diesem Bild zuordnen. `zuordnungsgrund` zählt
  dafür die direkten Fußnoten neben der wandernden, damit die Nachbedingung „genau eine Fußnote je
  Bild“ hält.
- `captionForImage` fällt nur noch auf eine direkte Fußnote zurück, deren Kennung dem Bild nicht
  widerspricht. Das ist dieselbe Regel wie in Galerie (`bodyImages.ts`) und Bildsuche.

**Belege** (`tests/bildidentitaet/identitaet-vom-bild.test.ts`):

| Fall | Inhalt |
| --- | --- |
| E1–E4 | Ersetztes Bild: Editor, Server, Speichern und Wiederöffnen. Die alte Beschreibung bleibt mit ihrer Kennung sichtbar und gekennzeichnet. |
| E5 | Gegenprobe Altbestand: eine nie verankerte Hülle paart weiter. |
| W1–W4 | Widersprechende Fußnotenkennung: nicht überschrieben, gekennzeichnet, Galerie ohne fremde Beschreibung, Fixpunkt, Rundlauf. |
| W5 | Zwei Paare in einer Hülle bleiben zwei Paare. |
| W6 | Kopierte Einheit: Die Fußnote geht mit ihrem Bild. |
| Z1–Z3 | Bewusste Zuordnung der fremden Fußnote, Rundlauf über beide Sanitizer, keine Zuordnung bei weiterer Fußnote. |

**Angepasste Bestandstests, jeweils mit Begründung im Test:**

- `services/structure/src/sanitize.test.ts`: „figure-Ankerung führt die Gruppe“ schrieb genau die
  Vererbung eines ersetzten Bildes fest. Ersetzt durch den umgekehrten Fall plus einen W1-Zwilling.
- `tests/capture/editor-figure-caption-globale-suche-mounted.test.tsx` (JOB 2084): Die Vorlage las
  Fußnoten mit **fremden** Kennungen (`kw-cap-*`) über die Nachbarschaft als Beschreibung. Jetzt ist
  sie der wirkliche Doppelfall: Bild und Fußnote tragen `kw-img-dup-1`. Die Kernaussage ist
  unverändert: Die Bitte für den zweiten Eintrag öffnet das zweite Bild.
- `tests/capture/huelle4-nachnormalisierung.test.ts` Probe 1, `tests/bildkennung-getrennt/bericht.test.ts`
  B4 und `tests/app/image-footnote-client.test.ts`: Die Zusage „keine Kennung wird überschrieben“
  bleibt. Neu ist die eigene leere Fußnote des Bildes. Die widersprechende Fußnote gilt nicht mehr
  als seine.
- `tests/capture/job916-stufe2b-abloesung.test.ts` („GRENZE“) bleibt **unverändert grün**. Die
  unverankerte flache Hülle paart weiter. Die dort als „Owner-Entscheidung“ offen gelassene
  Ausdehnung ist nur für den Fall getroffen, der I50 erstens tatsächlich beschreibt: die verankerte
  Hülle.

### 2. Der Körperklick trifft das angeklickte Vorkommen (R-0945, R-0053)

**Gemessen vor dem Bau:** Ein gespeicherter Text mit zwei Bildern unter derselben Kennung wird beim
Laden im Editor getrennt (JOB 3035/3051). Der Editor speichert dabei absichtlich nichts. Die Galerie
liest den zuletzt gemeldeten Körper und suchte mit `findIndex` nur über die Kennung. Der Klick auf das
zweite Bild (jetzt mit frischer Kennung) öffnete nichts, der auf das erste traf nur zufällig.

**Runde 1** ließ den Editor mit dem Klick Quelle und Listenposition melden, die Galerie nahm eine
dort eindeutige Kennung, sonst die Position bei passender Quelle. **Das war zu schwach** (Bens B1):
Editor und Galerie zählen verschiedene Mengen. **Seit Runde 2** entscheidet das Vorkommen der Quelle
(Punkt 3, B1).

**Beleg:** `tests/bildidentitaet/bildklick-doppelte-kennung-mounted.test.tsx`. Aufbau wie im Produkt
(Editor und `DraftBodyGallery` als Geschwister, mit Provider).

- V1 und V3 (dasselbe Bild zweimal, R-0053) sind am alten Stand rot.
- V0 und V2 sind Kalibrierungen.
- A1–A3 prüfen die Auflösung ohne Raten.

Die bestehenden D44-Fälle (`tests/web/d44-bild-klick-grossansicht.test.tsx`) sind grün.

### 3. Runde 2 — Nacharbeit nach Bens Befunden B1–B5

Ben hat die Aussagen aus Runde 1 an vier Stellen mit ausgeführten Gegenproben widerlegt. Runde 1
hatte R-0009/R-0010 und R-0053/R-0945 zu weit als erfüllt geführt und R-0090 als bloße offene Wahl.

**B1 — Körperklick und Galerie-Bitte zählten verschiedene Mengen (R-0053, R-0945).**
Der Editor meldete in Runde 1 seine eigene Listenposition, die Galerie schlug sie in ihrer Liste
nach. Der Editor hüllt aber ein loses Bild beim Laden ein und zählt es mit, die Galerie nicht. Bei
gleicher Quelle bestätigte die Quelle dann ein falsches Vorkommen. Bens Fall G5: ein loses Bild vor
zwei Einheiten mit gleicher Quelle und Kennung; der Klick auf „Erste“ öffnete „Bild 2 von 2 — Zweite“.

- Gemeinsam ist beiden nur „das k-te Bild mit dieser Quelle im Körper“, gezählt über **alle**
  Bilder. Das Verankern fügt kein Bild hinzu und entfernt keines.
- `galerieVorkommen` (`apps/web/src/lib/bodyImages.ts`) liefert diese Zahl je Galerie-Eintrag.
- Der Editor meldet beim Klick Quelle und Vorkommen. Die Galerie
  (`galerieIndexFuerBildklick`) öffnet genau den Eintrag mit beidem, sonst nichts.
- Dieselbe Schwäche hatte die **Gegenrichtung**: die Bitte „Bildbeschreibung bearbeiten“ aus der
  Galerie. Stufe 1 schlug die Galerie-Position bisher in der Editorliste nach. Jetzt liest der
  Editor den Eintrag in der Galerieliste desselben Körpers (`value`), nimmt dessen Vorkommen und
  sucht dieses Bild bei sich.
- Belege: `tests/bildidentitaet/bildklick-doppelte-kennung-mounted.test.tsx` (B1a–B1c: Bens G5,
  gemountet mit Editor und Galerie; A1–A3) und `tests/bildidentitaet/runde2-mounted.test.tsx`
  (Gegenrichtung, Eintrag 0 → „Erste“, Eintrag 1 → „Zweite“).

**B2 — eine lose Fußnote verlor beim Speichern die Kennung ihres Bildes (R-0009, R-0010).**
`anchorFigures` strich jeden losen Anker, dessen Kennung eine figure trug, auch den einer
**Fußnote**.

- Eine lose Fußnote behält ihre Kennung jetzt immer.
- Editor (`ensureImageAnchors`, `captionForImage`), Galerie (`extractBodyImages`) und Bildsuche
  (`bestandsbilderAusRumpf`, `services/app/src/routes/library-routes.ts`) lesen sie als
  Beschreibung dieses Bildes. Dieselbe enge Regel gilt an allen drei Stellen: nur für ein Bild
  **ohne** eigene Fußnote, nur bei genau **einer** losen Fußnote und genau **einem** Bild mit
  dieser Kennung. Sonst wird nicht geraten.
- Der Editor legt dann keine zweite, leere Fußnote an.
- Die lose Fußnote bleibt an ihrer Stelle; sie wird nicht in die figure verschoben.
- Ein loses **Bild** mit schon vergebener Kennung verliert seine Kennung weiter (der Editor
  verankert es beim Öffnen neu), jetzt aber mit Spur „doppelt“ (B4).
- Belege: `tests/bildidentitaet/runde2-gegenproben.test.ts` (B2: Bens G1, Galerie, Editor,
  Rundlauf, Gegenprobe mehrdeutig) und `tests/bildidentitaet/lose-fussnote-bildsuche-route.test.ts`
  (`POST /api/kos` → `GET /api/kos/:id` und `GET /api/library/images`, echter HTTP-Weg).

**B3 — die Entdublettierung sah nur die erste direkte Fußnote.**
Stand dort eine fremde und dahinter die eigene, bekam nur das Bild die frische Kennung; seine
Beschreibung war danach keinem Bild zugeordnet. Jetzt folgt die erste direkte Fußnote, die wirklich
die alte Kennung trägt.

- Beleg: `runde2-gegenproben.test.ts` B3 (Bens G3).

**B4 — R-0090: die Speicherung verschwieg ihre Bereinigung.**
Die offene Wahl aus Runde 1 ist durch den Bau ersetzt:

- Beide Sanitizer (`services/structure/src/sanitize.ts`, Spiegel `apps/web/src/lib/richText.ts`)
  verwerfen eine ungültige Kennung weiter, denn sie sind die Sicherheitsgrenze. An ihre Stelle
  setzen sie genau ein festes Merkmal `data-kw-kennung="ungueltig"`.
- Der Server setzt `data-kw-kennung="doppelt"` an jedes Bild, das er wegen einer schon vergebenen
  Kennung trennt, in einer figure wie lose.
- Das Merkmal hat genau zwei Werte, nur an figure/img/figcaption, steht am Ende des Tags und bleibt
  Fixpunkt; ein Fremdwert passiert nicht.
- Der Editor liest die Spur an der einen Verankerungsstelle (`enhanceFiguresForEditing`, Melder
  `meldeSpuren`) auf jedem Lade- und Einfügeweg. Er meldet „doppelt“ im vorhandenen
  Trennungshinweis (JOB 3051) und „ungültig“ in einem eigenen Hinweis
  (`data-testid="editor-kennung-ungueltig"`, `aria-live="polite"`, wegklickbar, DE/EN/NL in
  `apps/web/src/i18n.ts`). Danach nimmt er die Spur aus seinem Inhalt.
- Das Speichern wird nicht blockiert.
- **Grenze, ausdrücklich:** Die Spur meldet sich bei jedem Öffnen, bis nach dem Öffnen einmal
  gespeichert wurde. Danach ist sie fort. Eine Quittierung über das Speichern hinaus gibt es nicht.
  Eine leere Kennung (`data-image-id=""`) gilt als fehlend, nicht als ungültig. Beim **Einfügen**
  bleibt eine fehlende Kennung ungemeldet: ein Bild aus Word oder dem Browser hat nie eine.
- Belege: `runde2-gegenproben.test.ts` B4 (doppelt über den Server, ungültig in beiden Sanitizern,
  Einfügeweg, loses Doppelbild, Sicherheitsgrenze, keine Spur ohne Reparatur) und
  `runde2-mounted.test.tsx` B4 (sichtbare Hinweise, wegklickbar, Spur nicht mehr im Editorinhalt).

**Gegenproben am Stand von Runde 1** (Produktdateien auf `df9797b8` zurückgesetzt):

| Datei | Ergebnis |
| --- | --- |
| `runde2-gegenproben.test.ts` | alle Fälle zu B2–B4 rot, Kalibrierungen grün |
| Klickfälle B1a–B1c, A1, A3 | rot |
| `runde2-mounted.test.tsx` | 4 von 6 rot |
| `lose-fussnote-bildsuche-route.test.ts` | 2 von 3 rot |

**Angepasster Bestandstest:** `tests/structure/image-footnote.test.ts` („ungültige data-image-id
wird verworfen“). Die Kennung wird weiter verworfen, der Fall prüft jetzt zusätzlich die Spur und
dass der Fremdwert nicht erscheint.

~~**Grenze des Vorkommen-Abgleichs (B1):** Steht die Galerie auf einem älteren Körper als der
Editor, öffnet der Klick im Zweifel nichts statt eines falschen Bildes. Ein `<img>` innerhalb einer
Fußnote zählt der Galerie-Zerleger nicht mit.~~ **Berichtigt in Runde 3:** Diese Aussage war
falsch. Ben hat beide Lagen gemessen (N1, N2), und in beiden öffnete der Klick eine fremde
Beschreibung. Siehe Abschnitt 4.

### 4. Runde 3 — Nacharbeit nach Bens Befunden R2-1 bis R2-3

**R2-1 (N1) und R2-2 (N2) — auch „das k-te Bild mit dieser Quelle“ verrutschte.**

- N1: Zwei Bilder gleicher Quelle mit eindeutigen Kennungen `a`/`b`. Das erste wird gelöscht, und
  vor Ablauf der 300-ms-Verzögerung wird `b` angeklickt. Die Galerie zeigte „Bild 1 von 2 — Erste“,
  also die Beschreibung des gelöschten Bildes.
- N2: Ein Bild innerhalb einer losen Fußnote zählte nur der Editor. Der Klick auf „Erste“ öffnete
  „Zweite“.
- Ursache in beiden Fällen: Jede Zuordnung **zwischen** dem Editorstand und dem verzögerten
  Galeriestand ist angreifbar, ob über die Position (Runde 1) oder über das Vorkommen (Runde 2).
- **Körperklick, jetzt:** Der Editor schickt mit dem Klick seinen aktuellen, sanitisierten Körper
  mit (`D44BildEreignis.koerper`). Die Galerie baut die Großansicht aus genau diesem Stand auf und
  findet das Bild darin über seine Kennung. Die Kennung ist im Editor nach `ensureImageAnchors`
  eindeutig. Kommt sie dort nicht genau einmal als Eintrag vor, öffnet sich nichts. Beim Schließen
  und beim Öffnen über eine Kachel gilt wieder der eigene Galeriestand. Eine Übersetzung zwischen
  zwei Körpern gibt es auf diesem Weg nicht mehr.
- **Folge für die Bestandsabnahme D44 K4** (`tests/web/d44-bild-klick-grossansicht.test.tsx`): Ein
  im gespeicherten Text loses Bild öffnete bisher nichts („eine leere Großansicht wäre schlimmer als
  keine“). Der Editor hat es aber beim Laden verankert. Jetzt öffnet der Klick dieses Bild selbst
  (Position 3 von 3), weder leer noch ein anderes. Das ist die Forderung aus R-0052: gedeckelt,
  aber groß zu sehen. Der Fall ist mit Begründung umgeschrieben.
- **Gegenrichtung (Bitte „Bildbeschreibung bearbeiten“ aus der Galerie):**
  - Die Bitte wird weiter mit Position, Quelle und Kennung gestellt. Der Eintrag an dieser Position
    im Galeriekörper (`value`) muss jetzt die angefragte Kennung tragen.
  - Bilder innerhalb einer Fußnote zählen auf beiden Seiten nicht.
  - Die ratende Stufe „die Quelle ist eindeutig“ ist entfallen.
  - Die Stufe „Kennung genau einmal im Editor“ gilt nur noch, wenn `value` nicht widerspricht: die
    Kennung steht an der angefragten Position oder ist dort gar nicht bekannt. Beim Bauen gemessen:
    Ohne diese Bedingung öffnete nach dem Löschen des zweiten von zwei gleich gekennzeichneten
    Bildern die Bitte für das gelöschte das verbliebene (Fall N1b).
- **Grenze, ausdrücklich:** In der Gegenrichtung kann eine Bitte aus dem veralteten Galeriestand
  (bis 300 ms nach einer Eingabe) auch für ein noch vorhandenes Bild **nichts** öffnen, wenn sich
  seine Position verschoben hat. Aus dem Galeriekörper allein ist diese Lage nicht von N1b zu
  unterscheiden; nach Ablauf der Verzögerung öffnet dieselbe Bitte das Bild. Gemessen in beiden
  Richtungen (Fälle „N1 Grenze“ und „N1“).
- Belege:
  - `tests/bildidentitaet/bildklick-doppelte-kennung-mounted.test.tsx`: N1, N2, B1a–c, Rückkehr
    zum eigenen Stand, A1–A2
  - `tests/bildidentitaet/runde2-mounted.test.tsx`: Gegenrichtung N1, N1 Grenze, N1b, N2

**R2-3 (N3) — der Hinweis zählte markierte Elemente statt Bilder.**

- Tragen Rahmen, Bild und Fußnote derselben Einheit die ungültige Kennung, hieß es „3 Bilder“.
  Jetzt wird je Bild gezählt: Ein markierter Rahmen und eine markierte Fußnote zählen für das erste
  Bild ihrer figure, eine lose Fußnote oder leere Hülle für sich selbst (`bildDerEinheit`,
  `editorFigures.ts`).
- Der Satz benennt das jetzt genau: „Bei n Bild(ern) oder Bildbeschreibung(en) war die Kennung
  ungültig …“ (DE/EN/NL).
- Beleg: `runde2-mounted.test.tsx` N3 (ein Bild → 1) und Kalibrierung (zwei Bilder → 2).

**Gegenproben am Stand von Runde 2** (Commit `99a6e9d4`, Produktdateien zurückgesetzt): N1, N2
und N3 sowie die neuen Auflösungsfälle sind dort rot; die Kalibrierungen sind grün.

**Klick auf ein Bild, das selbst innerhalb einer Fußnote steht:** Er öffnet keine der Beschreibungen
der anderen Bilder (Fall N2b in `bildklick-doppelte-kennung-mounted.test.tsx`).

## Abgleich je Aufnahmepunkt

Legende:

- **erfüllt (dieser Lauf)**: gebaut und in diesem Lauf lokal grün gefahren.
- **erfüllt (Bestand)**: im Quelltext der Basis vorhanden, durch den genannten Test belegt, in diesem
  Lauf lokal grün gefahren.
- **Teil**: Ein benannter Rest bleibt.
- **Entscheidung**: Kein Bau ohne Entscheidung.

Live-Stände wurden nicht neu gemessen.

| Punkt | Ergebnis | Beleg / verbleibende Entscheidung |
| --- | --- | --- |
| R-0009 Kennung schlägt Reihenfolge, nie überschreiben | erfüllt (Runden 1 und 2) | Paarung getrennter Einheiten: Bestand (`tests/capture/mega90-kennung-vor-reihenfolge.test.ts`). **Bis Runde 1 verletzt** im Server-Sanitizer (Hülle führte, Fußnote überschrieben) und im Editor-Rückfall: Punkt 1, W1–W6. **Runde 1 zu weit ausgewiesen:** die lose Fußnote verlor ihre Kennung weiter (Bens B2); seit Runde 2 geschlossen (Punkt 3, B2). |
| R-0010 Bild, Rahmen, Fußnote ein Anker über Speichern/Laden | erfüllt (Bestand + Runden 1 und 2) | `tests/capture/mega88-bildstruktur-invariante.test.ts`. Runde 1: Ein Bild mit nur fremder Fußnote bekommt seine eigene (W3). Runde 2: Getrennt stehende Fußnote und Bild behalten die gemeinsame Kennung über Speichern und Bildsuche (B2). Der alte Rest aus E06 („außerhalb des Moduls nicht lesbar“) ist überholt: `bodyImages.ts` und `library-routes.ts` lesen `data-image-id`. |
| R-0014 Bildgröße in der Schreibfläche | Teil / Entscheidung | Vorhanden: Stufen 25/50/75/100 % (`data-kw-scale`, Werkzeugleiste). Freies Ziehen an Griffen gibt es nicht. **Entscheidung:** Reichen die Stufen? |
| R-0041 / R-2007 / package:bilder fünf Härtungen | erfüllt (Bestand), mit benannten Grenzen | Siehe unten. |
| R-0052 / R-0901 Deckel + Klick öffnet Großansicht | erfüllt (Bestand) | `tests/web/d44-bildhoehe-deckel.test.tsx`, `d44-bild-klick-grossansicht.test.tsx`. Siehe **Quellenwiderspruch R-0901** unten. Runde 3: Auch ein im gespeicherten Text loses (im Editor verankertes) Bild öffnet jetzt seine Großansicht; der Bestandsfall D44 K4 ist mit Begründung umgeschrieben. |
| R-0053 / R-0945 Klick trifft genau dieses Bild | erfüllt (Runde 3), mit benannter Grenze in der Gegenrichtung | **Runden 1 und 2 zu weit ausgewiesen:** Ein loses Bild davor (B1), ein gelöschtes Bild gleicher Quelle vor Ablauf der Galerieverzögerung (N1) und ein Bild in einer Fußnote (N2) führten zu einer fremden Beschreibung. Seit Runde 3 baut der Körperklick die Großansicht aus dem Editorstand (Abschnitt 4). Die Galerie-Bitte ist an die Kennung gebunden und öffnet im Zweifel nichts; bis 300 ms nach einer Eingabe kann sie auch für ein vorhandenes, verschobenes Bild nichts öffnen. |
| R-0055 / R-0931 Gliederungsleiste | erfüllt (Bestand) | `tests/web/d44-gliederung.test.ts`, `d44-sprung-mounted.test.tsx`. Siehe **Quellenwiderspruch R-0931** unten. |
| R-0089 eindeutige Kennung je Bild | erfüllt (Bestand + Runden 1 und 2) | `tests/bildkennung-eindeutig/doppelte-kennung.test.ts`. Server: Eine kopierte Einheit wird getrennt, ihre Fußnote geht mit (W6). Editor: Die eigene Beschreibung folgt auch hinter einer fremden Fußnote (B3). Die Verdachtsspur „Commit 365e580“ ist nicht verfolgt; kein Befund dazu. |
| R-0090 doppelte/ungültige Kennung nur melden | erfüllt mit benannter Grenze (Runde 2) | Siehe unten. Runde 1 hatte das als offene Wahl geführt; Ben hat die Wahl als Nichterfüllung gewertet (B4). |
| R-0096 vier Grenzen nach Ship 12 (I50) | erfüllt bis auf eine Wahl | Siehe unten. |
| R-0098 Server vergibt Kennung aus dem Bildinhalt | Entscheidung (Quellenwiderspruch) | Siehe unten. Nicht gebaut. |
| R-0107 Anker beim Zusammenführen | zurückgezogen | Laut Quelle Dublette; lebt in R-0089 weiter. |
| R-0359 Word-Import: je Bild ein Anker, nicht raten | erfüllt (Bestand) | `docx.ts` (`captionsAmbiguous`); `tests/m5-docx-bildunterschriften/**`, `tests/m5c-ui-bildunterschriften/**`. |
| R-0361 Knopf, Ziehen, Zwischenablage | erfüllt (Bestand), Browserrest | Bildknopf mit Dateiwahl, `onDrop`, `onPaste` (`RichTextEditor.tsx`, `partitionDropMedia` → `insertImageFile`). Gemountet: `tests/capture/mega88-bildweg-anker-mounted.test.tsx`. Browser: `tests-smoke/mega88-bildanker-browser.spec.ts` (Drop, Speichern, Wiederöffnen), in diesem Lauf nicht wiederholt. **Fehlender Beleg:** Einfügen einer Bild*datei* aus der Zwischenablage im echten Browser. |
| R-0898 / R-2146 / SOLL:FR-STR-03 Anhänge frei platzieren | erfüllt (Bestand) für Klick; Entscheidung für Ziehen | Die Bildauswahl fügt einen Anhang per Klick an der Cursorposition ein (`addImage` → `exec("insertHTML")`). Das historische Abnahmekriterium („an Cursorposition einfügen“) ist damit erfüllt. Ziehen gibt es für Dateien, **nicht** aus der Auswahlliste. R-0898 sagt „per Klick **oder** Ziehen“. **Entscheidung:** Wird das Ziehen aus der Liste zusätzlich gebraucht? |
| R-1035 Unterschrift ohne Zuordnung erkennbar | erhalten | `tests/fussnote-ohne-bild/**` grün. Die Kennzeichnung trägt jetzt zusätzlich die fremd gekennzeichnete Fußnote neben einem Bild (vorher still gepaart). Fall J bleibt grün. |
| R-1535 / R-1620 / V8 Eindeutigkeit geprüft, Meldung | erfüllt (Bestand) | JOB 3035/3051: `tests/bildkennung-eindeutig/**`, `tests/bildkennung-getrennt/**` (gemountet). Der sichtbare Warnfall ist nicht im echten Browser belegt. |
| R-1551 Trennung wird gemeldet | erfüllt (Bestand + Runde 2) | Editortrennung: JOB 3051. Servertrennung über API- und Importwege: seit Runde 2 Spur „doppelt“, gemeldet beim Öffnen im selben Hinweis (B4). |
| R-1555 / V7 Fußnote ohne Bild per Klick zuordnen | erfüllt (Bestand + dieser Lauf) | `ordneFussnoteZu`; `tests/fussnote-zuordnen/**`. Neu: auch die fremde Fußnote in der Hülle des Bildes (Z1–Z3). |
| R-1599 / N8 ausgetauschtes Bild erbt nichts | erfüllt (dieser Lauf) | Stufe 2b war entfernt (`job916-stufe2b-abloesung.test.ts`). **Die flache verankerte Hülle erbte weiter**, in Editor und Server. Geschlossen: Punkt 1, E1–E4. Statt eines Herkunftshinweises bleibt die alte Beschreibung sichtbar, gekennzeichnet und zuordenbar. |
| R-1600 / N9 Anker an der Emissionsgrenze | erfüllt (Bestand) | `emit()` → `ensureImageAnchors(puffer)`; Sammlerfall „JOB 2060 D4“. |
| R-1604 / P4 Hauptweg erzeugt den Anker | erfüllt (Bestand) | `enhanceFiguresForEditing` beim Laden; `tests/capture/mega88-bildweg-anker-mounted.test.tsx`. |
| R-1619 / Q5 / Q5b / Q5c Studio, Konkurrenz, Speichern | Teil | Zuordnung und Studio-Übernahme mit Speichern und Wiederöffnen (`tests/bildzuordnung-speicherweg/**`) und Konkurrenzhinweis (`tests/studio-konkurrenz/**`) grün. **Fehlende Belege laut Quelle:** Cursorlage, echte Screenreader-Ausgabe, Word-Gesamtweg. Das sind Browser-, Assistenztechnik- und Word-Abnahmen, in jsdom nicht messbar. |
| R-1799 (OFFEN D44 „ERLEDIGT“) | bestätigt | Beide D44-Teile sind im Code (R-0052, R-0931). |
| R-1823 (huelle2 „ABGESCHLOSSEN, ROT“) | erledigt (Bestand) | Nachfolger huelle3/huelle4 im Code; `tests/capture/huelle3-kennungskonflikt.test.ts`, `huelle4-nachnormalisierung.test.ts`. |
| R-1824 (huelle2 „GELIEFERT, BEI BEN“) | überholt | Historischer Prüfstand, siehe R-1823. |
| R-2005 (OFFEN.md I50 „OFFEN“) | Quellenwiderspruch | `OFFEN.md:379` führt I50 als OFFEN, `PRIORITAETEN.md` N8/N9/V7/V8 als erledigt. Nach diesem Lauf bleibt nur die Wahl zum Leseversprechen offen (R-0096). Die Registerzeile ist hier nicht umgeschrieben. |
| M5c-UI Zähler und Unterscheidung | erfüllt (Bestand) | `Capture.tsx`; `tests/m5c-ui-bildunterschriften/**`. |
| M5c-b Add-in-Weg gleicher Importvertrag | erfüllt (Bestand) | `tests/m5c-b-addin-bildunterschriften/route.test.ts`. |
| M5c-b-R EMF-Waise, 503, Suchableitung, Bildbudget | erfüllt (Bestand), Word offen | `tests/m5c-b-bildbudget/**`, `tests/addin-bildbilanz/**`. **Fehlender Beleg laut Quelle:** echter Word-/Browser-Nachweis. |
| Q5, Q5b, Q5c | siehe R-1619 | Gesonderte, abgeschlossene Aufträge (JOB 3083, 3107, 3123); hier nicht neu gebaut. |
| N8, N9, P4, V7, V8 | siehe R-1599, R-1600, R-1604, R-1555, R-1620 | |

### R-0041 / R-2007 / package:bilder — fünf Härtungen

- **Emissionsgrenze:** Bestand (N9).
- **Schreibwege erfasst:** Sammler, siehe unten.
- **Drop und Speichern zusammen:** Bestand; im Browser `mega88-bildanker-browser.spec.ts`, hier nicht
  wiederholt.
- **Kennungen eindeutig:** Bestand + dieser Lauf (W6, Punkt 2).
- **Beschriftungen folgen dem Sprachwechsel:** `verankereFiguren` hängt an `[t]`;
  `tests/fussnote-ohne-bild/tastaturweg-mounted.test.tsx` und
  `tests/m5c-ui-bildunterschriften/kennzeichnung-im-editor-mounted.test.tsx` wechseln die Sprache.
- **Grenzen laut Quelle:** flache Namenstabelle, `OF-2060-2`, historischer Gesamtumfang nicht neu
  abgenommen.

### R-0090 — doppelte/ungültige Kennung nur melden

| Lage | Stand |
| --- | --- |
| Doppelte Kennung im Editor | gemeldet (JOB 3051), Speichern nicht blockiert |
| Fremde oder widersprechende Fußnotenkennung | seit Runde 1 nicht mehr still überschrieben, sondern gekennzeichnet |
| Doppelte Kennung auf einem Speicherweg, der **nicht** durch den Editor läuft (API, Import) | seit Runde 2: getrennt mit Spur `doppelt`, gemeldet beim nächsten Öffnen |
| **Ungültige** Kennung (kein Token `[\w-]{1,64}`) | seit Runde 2: verworfen mit Spur `ungueltig` (Server und Client), gemeldet beim Öffnen und beim Einfügen |

**Grenze:** Die Meldung erscheint bei jedem Öffnen, bis einmal gespeichert wurde. Eine dauerhafte
Quittierung über das Speichern hinaus gibt es nicht. Eine leere Kennung zählt als fehlend.

### R-0096 — vier Grenzen nach Ship 12 (I50)

1. Stufe 2b ist entfernt; die verankerte flache Hülle ist seit diesem Lauf ebenfalls geschlossen
   (Punkt 1).
2. Die Zusage des Lesewächters ist verengt (siehe unten).
3. Die Trennung, Galerie → Editor (JOB 2084) und jetzt auch Editor → Galerie (Punkt 2).
4. Kennzeichnung und Zuordnung (JOB 3041/3055).

Offen bleibt nur die Wahl unter „Sammler- und Leseversprechen“ unten.

### R-0098 — Server vergibt die Kennung aus dem Bildinhalt

**Quellenwiderspruch:** Die Entscheidung vom 13.08. (inhaltsabgeleitete Kennung, „dasselbe Bild trägt
überall dieselbe Kennung“) steht gegen die jüngeren, ausgelieferten Anforderungen R-0089, R-1620/V8
und R-0053. Diese verlangen für zwei Vorkommen desselben Bildes zwei verschiedene Anker; eine
Inhaltskennung als Anker bräche genau das.

**Entscheidung:**

- (a) Die Inhaltskennung als **zweiter Begriff** neben dem Vorkommensanker, etwa für die
  Dublettenerkennung.
- (b) Die Entscheidung vom 13.08. ausdrücklich zurücknehmen.

Heute vergibt weiter der Browser (`newImageRunToken`) bzw. der Server (`kw-fig-N`) einen
Vorkommensanker.

## Sammler- und Leseversprechen (I50 zweitens, Kriterium 5)

Abgeglichen am heutigen `tests/app/mega88-bildanker-sammler.test.tsx`; unverändert, keine
Vollständigkeit behauptet:

- **Stufe 1 (`leserBefunde`, Disposition `liest-markup`)** sagt nur „keine **bekannte direkte**
  Schreibform“. Die vier Auslagerungsformen aus I50 sind ein eigener Fall, der belegt, dass sie
  **nicht** erkannt werden: Zeichenkettenschlüssel, `Reflect.set`, aliasierter Methodenaufruf und
  importierter Schreibhelfer. Dazu gibt es eine Kalibrierung, dass die direkte Form erkannt wird.
- **Stufe 2 (Schreibwege)** zählt dreizehn gemessene Formen auf. Was sie nicht sieht, steht jeweils
  als eigener Fall:
  - Helfer aus einem Paket (`OF-2060-2`, nicht entschieden)
  - nicht statisch auflösbare dynamische Schlüssel
  - Importketten jenseits von `IMPORTKETTEN_TIEFE`
  - die flache Namenstabelle ohne Gültigkeitsbereiche
- **Beobachtung, kein Widerspruch:** Stufe 2 erkennt `Reflect.set` und Alias-/Importformen, Stufe 1
  nicht. Der Kopf des Sammlers nennt das ausdrücklich („Stufe 1 … bewusst enger“).
- **Offene Wahl** (seit JOB 1185 D1): bei der verengten Zusage bleiben, oder die Erhebung durch eine
  positive Modulgrenze bzw. eine Laufzeitprobe mit schreibgeschütztem DOM-Adapter tragfähig machen.

## Weitere Quellenwidersprüche und fehlende Belege

- **R-0901:** Die Erkenntnis-Sammlung vom 21.08. („Bildhöhenbegrenzung nicht im Produkt“) steht gegen
  JOB 1911 („Deckel drin, Klick noch nicht“). Heute sind Deckel (`index.css`) und Klick im Code und
  gemountet belegt; der Widerspruch ist historisch.
- **R-0931:** `OFFEN.md` (22.08., „im Produkt“) steht gegen die Erntekontrolle 21.08. („D44 HÄLT
  NICHT“). Heute ist die Gliederung im Code und belegt.
- **`job916-stufe2b-abloesung.test.ts`:** Der Test nannte die Ausdehnung von P1 auf flache Hüllen eine
  offene Owner-Entscheidung. Dieser Lauf dehnt sie nur auf die **verankerte** Hülle aus, weil
  Kriterium 2 und I50 erstens genau diese Lage benennen. Die unverankerte Hülle (Altbestand) paart
  weiter. **Entscheidung:** ob auch dort nicht mehr gepaart werden soll. Preis: Altbestand ohne
  Bildkennung verlöre die sichtbare Zuordnung seiner Beschreibungen.
- **Nicht gemessen, ohne neuen Prüflauf:**
  - Tastatur- und Screenreader-Ablauf von Großansicht und Zuordnung im echten Browser
  - Einfügen einer Bilddatei aus der Zwischenablage im echten Browser
  - Word-Gesamtweg

  Die bestehenden Browserfälle (`tests-smoke/mega88-bildanker-browser.spec.ts` u. a.) laufen im
  Linux-Tor. Ihre Vorlagen tragen keine Fußnotenkennungen und laufen damit durch den unveränderten
  Altbestandszweig.

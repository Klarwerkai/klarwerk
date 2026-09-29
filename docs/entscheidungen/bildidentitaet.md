# Bilder, Anker und Bildunterschriften konsistent zuordnen — Bestandsabgleich und Lieferung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-bildidentitaet`, Lauf 3, Runde 1 (29.09.2026).
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

**Jetzt** meldet der Editor mit dem Klick die Quelle (`src`) und die Position in der Liste, die
`extractBodyImages` aus dem Editorinhalt ableitet. Das ist dieselbe Form wie die Bitte von der Galerie
zum Editor (JOB 2084). Die Galerie (`galerieIndexFuerBildklick`, `BodyImageGallery.tsx`) nimmt eine
Kennung, die in ihrer Liste genau einmal vorkommt. Sonst nimmt sie die Position, sofern die Quelle dort
übereinstimmt. Sonst öffnet sie nichts.

**Beleg:** `tests/bildidentitaet/bildklick-doppelte-kennung-mounted.test.tsx`. Aufbau wie im Produkt
(Editor und `DraftBodyGallery` als Geschwister, mit Provider).

- V1 und V3 (dasselbe Bild zweimal, R-0053) sind am alten Stand rot.
- V0 und V2 sind Kalibrierungen.
- A1–A3 prüfen die Auflösung ohne Raten.

Die bestehenden D44-Fälle (`tests/web/d44-bild-klick-grossansicht.test.tsx`) sind grün.

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
| R-0009 Kennung schlägt Reihenfolge, nie überschreiben | erfüllt (dieser Lauf) | Paarung getrennter Einheiten: Bestand (`tests/capture/mega90-kennung-vor-reihenfolge.test.ts`). **Bis heute verletzt** im Server-Sanitizer (Hülle führte, Fußnote überschrieben) und im Editor-Rückfall: Punkt 1, W1–W6. |
| R-0010 Bild, Rahmen, Fußnote ein Anker über Speichern/Laden | erfüllt (Bestand + dieser Lauf) | `tests/capture/mega88-bildstruktur-invariante.test.ts`. Neu: Ein Bild mit nur fremder Fußnote bekommt seine eigene (W3). Der alte Rest aus E06 („außerhalb des Moduls nicht lesbar“) ist überholt: `bodyImages.ts` und `library-routes.ts` lesen `data-image-id`. |
| R-0014 Bildgröße in der Schreibfläche | Teil / Entscheidung | Vorhanden: Stufen 25/50/75/100 % (`data-kw-scale`, Werkzeugleiste). Freies Ziehen an Griffen gibt es nicht. **Entscheidung:** Reichen die Stufen? |
| R-0041 / R-2007 / package:bilder fünf Härtungen | erfüllt (Bestand), mit benannten Grenzen | Siehe unten. |
| R-0052 / R-0901 Deckel + Klick öffnet Großansicht | erfüllt (Bestand) | `tests/web/d44-bildhoehe-deckel.test.tsx`, `d44-bild-klick-grossansicht.test.tsx`. Siehe **Quellenwiderspruch R-0901** unten. |
| R-0053 / R-0945 Klick trifft genau dieses Bild | erfüllt (dieser Lauf) | Punkt 2. |
| R-0055 / R-0931 Gliederungsleiste | erfüllt (Bestand) | `tests/web/d44-gliederung.test.ts`, `d44-sprung-mounted.test.tsx`. Siehe **Quellenwiderspruch R-0931** unten. |
| R-0089 eindeutige Kennung je Bild | erfüllt (Bestand + dieser Lauf) | `tests/bildkennung-eindeutig/doppelte-kennung.test.ts`. Server: Eine kopierte Einheit wird getrennt, ihre Fußnote geht mit (W6). Die Verdachtsspur „Commit 365e580“ ist nicht verfolgt; kein Befund dazu. |
| R-0090 doppelte/ungültige Kennung nur melden | Teil / Entscheidung | Siehe unten. |
| R-0096 vier Grenzen nach Ship 12 (I50) | erfüllt bis auf eine Wahl | Siehe unten. |
| R-0098 Server vergibt Kennung aus dem Bildinhalt | Entscheidung (Quellenwiderspruch) | Siehe unten. Nicht gebaut. |
| R-0107 Anker beim Zusammenführen | zurückgezogen | Laut Quelle Dublette; lebt in R-0089 weiter. |
| R-0359 Word-Import: je Bild ein Anker, nicht raten | erfüllt (Bestand) | `docx.ts` (`captionsAmbiguous`); `tests/m5-docx-bildunterschriften/**`, `tests/m5c-ui-bildunterschriften/**`. |
| R-0361 Knopf, Ziehen, Zwischenablage | erfüllt (Bestand), Browserrest | Bildknopf mit Dateiwahl, `onDrop`, `onPaste` (`RichTextEditor.tsx`, `partitionDropMedia` → `insertImageFile`). Gemountet: `tests/capture/mega88-bildweg-anker-mounted.test.tsx`. Browser: `tests-smoke/mega88-bildanker-browser.spec.ts` (Drop, Speichern, Wiederöffnen), in diesem Lauf nicht wiederholt. **Fehlender Beleg:** Einfügen einer Bild*datei* aus der Zwischenablage im echten Browser. |
| R-0898 / R-2146 / SOLL:FR-STR-03 Anhänge frei platzieren | erfüllt (Bestand) für Klick; Entscheidung für Ziehen | Die Bildauswahl fügt einen Anhang per Klick an der Cursorposition ein (`addImage` → `exec("insertHTML")`). Das historische Abnahmekriterium („an Cursorposition einfügen“) ist damit erfüllt. Ziehen gibt es für Dateien, **nicht** aus der Auswahlliste. R-0898 sagt „per Klick **oder** Ziehen“. **Entscheidung:** Wird das Ziehen aus der Liste zusätzlich gebraucht? |
| R-1035 Unterschrift ohne Zuordnung erkennbar | erhalten | `tests/fussnote-ohne-bild/**` grün. Die Kennzeichnung trägt jetzt zusätzlich die fremd gekennzeichnete Fußnote neben einem Bild (vorher still gepaart). Fall J bleibt grün. |
| R-1535 / R-1620 / V8 Eindeutigkeit geprüft, Meldung | erfüllt (Bestand) | JOB 3035/3051: `tests/bildkennung-eindeutig/**`, `tests/bildkennung-getrennt/**` (gemountet). Der sichtbare Warnfall ist nicht im echten Browser belegt. |
| R-1551 Trennung wird gemeldet | Teil | Editortrennung: gemeldet (JOB 3051). Die **Servertrennung** über API-Speicherwege bleibt still (siehe R-0090). |
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
| Fremde oder widersprechende Fußnotenkennung | seit diesem Lauf nicht mehr still überschrieben, sondern gekennzeichnet |
| Doppelte Kennung auf einem Speicherweg, der **nicht** durch den Editor läuft (API, Import) | wird im Server-Sanitizer getrennt, die Fußnote geht mit — **ohne Meldung** |
| **Ungültige** Kennung (kein Token `[\w-]{1,64}`) | verwerfen beide Sanitizer als Sicherheitsgrenze **still**; das Bild wird neu verankert |

**Konkrete Entscheidung:** Soll der Server-Sanitizer eine dauerhafte Spur schreiben (festes Merkmal am
Knoten, das der Editor beim Öffnen meldet), oder soll die API-Antwort die Trennung und Verwerfung
melden? Eine solche Spur war Gegenstand des zurückgesetzten Laufs 2. Sie ist deshalb nicht erneut
ohne Entscheidung gebaut.

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

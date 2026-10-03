# Themenkarte und begründete Nachbarschaft aus Wissensbelegen — Bestandsaufnahme 03.10.2026

Auftrag `aufnahme:20260922:gesamt-wissensnetz` (Revision 2), Quelle
`gesamtaufnahme-20260922-v1-502e629bf2113ebf`. Basisstand des Arbeitsbaums: `3b79c5d1`
(1.0.0-beta.1.657).

**Art der Belege in dieser Datei.** Die Zuordnung unten beruht auf einer **Quelleninspektion** des
Arbeitsbaums (Code, Testdateien, Git-Historie). In diesem Arbeitsgang wurde **kein Test ausgeführt**.
Die gezielten Prüfläufe stehen im Prüfplan des Auftrags und laufen in der Cloud. Ein in einer
früheren Lieferung genannter Prüflauf wird hier nur zitiert und nicht wiederholt.

Die erste Fassung kannte aus `QUELLEN.json` nur Kennung, Zustand und Titel je Punkt. Seit
Nacharbeit 2 trägt `QUELLEN.json` unter `original_points` die Originalabschnitte aller 48 Punkte
(`requirement`, `criteria_text`, `qualification`, `raw`). Die Einträge zu R-0744, R-0754,
R-1971/R-1972/R-1976/R-1983, N-0011/N-0024, P-WG-LUECKEN und `question:K06` sind daran berichtigt.
Die übrigen Zeilen stammen weiterhin aus der ersten Fassung.

## Lieferung dieses Auftrags

**Kriterium 2 — gleich angezeigte, aber verschieden gespeicherte Schlagwörter.** Bis hierher galt die
in `themenVon` (`services/wissensnetz/src/themenkarte.ts`) ausdrücklich in Kauf genommene Grenze:
`"Dichtungen"` und `" Dichtungen "` sind zwei Themen mit zwei Objektmengen, und der Sprung in die
Bibliothek trifft je seine eigene Menge (`tests/wissensnetz-achse/bibliothekstreffer.test.tsx`,
L4/L5). Auf der Fläche hatten beide aber **dieselbe Beschriftung**. Man konnte nicht ablesen, welche
Menge ein Klick trifft.

- `apps/web/src/pages/Wissensnetz.tsx`: `themenAnzeige` ermittelt für alle Namen der Seite die
  Doppelgänger, also Namen mit gleichem Schriftbild nach NFKC und zusammengezogenem Leerraum. Nur
  bei diesen wird gespeicherter Leerraum als `␣` gezeigt (Rand, doppelt, Tab, geschütztes
  Leerzeichen). Sieht ein Name auch danach noch gleich aus (andere Unicode-Form), bekommt er eine
  Nummer `#1…n`. Seit Nacharbeit 1 wird das über alle endgültigen Anzeigen der Seite geprüft, auch
  wenn die Markierung einen so gespeicherten Namen trifft (`"␣Dichtungen␣"`). Das gilt für Knoten (Beschriftung, `aria-label`, Tooltip),
  Seitenleistentitel, Themenzeilen samt Zusammen-Satz und „Alle Themen“.
- **Die Identität bleibt unverändert.** `data-thema`, die Auswahl, `themenHref` und der
  Suchparameter der Seitenleiste tragen weiter den gespeicherten Wert.
- Ein Hinweissatz (`wissensnetz.schreibweisen.hinweis`, de/en/nl in `apps/web/src/i18n.ts`) erklärt
  die Marke und erscheint nur, wenn markiert wurde.
- Ein Name ohne Doppelgänger bleibt wie bisher. L14 in `tests/wissensnetz-leseweg/leseweg.test.tsx`
  (getrimmte Zeile) gilt weiter.
- Neuer Test: `tests/wissensnetz-achse/gleich-angezeigt.test.tsx` mit den Fällen S1–S8 (S7/S8 aus
  Nacharbeit 1).

**N-0011 / N-0024 — filterbare Volltitelliste am Wissensgraphen (Nacharbeit 2).** Wortlaut N-0024:
„Eine filterbare Liste mit vollständigen Titeln ergänzen; … auf schmalen Fenstern eine gut bedienbare
Listenansicht anbieten.“ N-0011: „eine synchronisierte lesbare Objektliste als weiteren Einstieg
anbieten.“ Diese Liste fehlte bis hierher; die erste Fassung erklärte N-0024 zu Unrecht über N-0011
für geliefert.

- `apps/web/src/pages/Stufe2.tsx`: `GraphObjektliste` steht unter dem Bild in `GraphView`.
  - Sie enthält genau die gezeichneten Knoten (`g.nodes` nach `limitGraph`) mit vollständigem Titel,
    alphabetisch, mit beschriftetem Filterfeld und Trefferzahl.
  - Der Sprung ist derselbe wie am Knoten (`koDetailPath`, nur wenn `isNavigableNode`), per Klick,
    Enter oder Leertaste. Ein Objekt, das der Bestand nicht kennt, steht als Text ohne Link da.
  - Was die Graphantwort nicht trägt, erscheint dort nicht.
- Texte `graph.liste.*` in de/en/nl (`apps/web/src/i18n.ts`).
- Gegenprobe: `tests/wissensnetz-flaeche/graph-listenweg.test.tsx` (V1–V6, jsdom, 28-Knoten-Bestand
  aus `tests/wissensgraph-lesbarkeit/bestand.ts`).
- Browsergegenprobe, Fall GL: `tests/wissensnetz-flaeche/graph-liste-telefon-chromium.test.ts`.
  Nacharbeit 3 hatte sie in `tests/design/zielbild-wissensnetz.test.ts` gelegt. Jene Datei liest
  aber ein Zielbild außerhalb des Repositorys und war auf dem Prüfplatz deshalb rot; seit
  Nacharbeit 4 steht GL mit unverändertem Messweg in einer eigenen Datei.
  - Aufbau: Die gebaute App läuft gegen eine echte Fastify-App mit 28 Objekten aus
    `POST /api/kos`. Stufe 2 wird am echten Schalter eingeschaltet, dann wird `/graph` bei
    390×844 geöffnet.
  - Gemessen werden: kein seitlicher Überlauf, Filterfeld und Titel im Fenster, echte Eingabe mit
    genau der erwarteten Kennung, Öffnen per Mausklick und per Tab+Enter mit Detailroute und
    sichtbarem Titel, und das Zurücksetzen auf die 28 Kennungen.
  - Ausgeführt wird sie in der Cloud; ein Ergebnis liegt dieser Lieferung noch nicht vor.

**R-1983 — kuratierte Sicht „So arbeitet Klarwerk“ (Nacharbeit 5).**

- **Was die Quelle sagt:** R-1983 nennt sie nur beim Namen (SCRUM-545–551: „… kuratierte Sicht ‚So
  arbeitet Klarwerk‘ · Adminseite · Qualitätsblick“). Das Konzept vom 26.07., zitiert in R-0744,
  ordnet den Qualitätsblick „nach der kuratierten Vorführsicht“ ein. Weiteren Wortlaut gibt es nicht.
- **Umgesetzt** an `/graph` als zuklappbarer Abschnitt „So arbeitet Klarwerk“, vor dem
  Qualitätsblick:
  - drei Sätze, wie das Bild entsteht (Punkt = sichtbarer Eintrag; graue Linie = abgeleitete
    Schlagwortnähe, keine Fachaussage; gesetzte Fachbeziehung = von einem Menschen verantwortet);
  - darunter ausschließlich die gesetzten Fachbeziehungen aus derselben `/api/graph`-Antwort, als
    Satz mit beiden Einträgen (verlinkt), Art und Richtung.
- **Ehrliche Zustände:** Liefert der Server die Menge nicht, steht „nicht mitgeliefert“, nicht
  „keine“. Eine leere Menge heißt „keine gesetzt“, mit dem Zusatz, dass das keine Prüfaussage ist.
  Bei Kürzung stehen Liefer- und Gesamtzahl da.
- Die Sicht ist rein lesend, braucht keine neue Abfrage und keinen neuen Server-Weg.
- Gegenprobe: `tests/wissensnetz-flaeche/netz-verwaltung.test.tsx`, S1–S4.
- **Grenze:** Die Lesart „kuratiert = von Menschen gesetzt“ ist eine Auslegung des Namens. Ob die
  Vorführsicht mehr enthalten sollte (z. B. eine geführte Vorführung für einen Pilotpartner), sagt
  die Quelle nicht; das bleibt Owner-Entscheidung.

**Konfliktzahl im Detailfenster (Nacharbeit 5, BEN F5).** Die Zahl wurde aus einem leeren
Ersatzarray gerechnet und stand bei laufender oder gescheiterter Konfliktabfrage als „0“ da. Jetzt
steht sie nur bei vorliegender Antwort; sonst steht dort „werden erhoben …“ bzw. „nicht erhoben“.
Gegenprobe F5a–F5c.

**R-0744 — Verwalterseite rund um die Netzdarstellung mit wählbarem Qualitätsblick (Nacharbeit 3).**
Wortlaut: „Für Verwalter gibt es eine Seite rund um die Netzdarstellung: Kopfkennzahlen,
Filterleiste, Detailfenster und Suche, rein lesend, ohne Bearbeiten im Netz. Dazu kommt ein
ausdrücklich zu wählender Qualitätsblick auf Konflikte, Lücken, veraltetes Wissen und Dubletten –
jede Zahl mit ihrem Nenner und dem Alter des Bestands.“ Umgesetzt an `/graph` (`GraphView`), einer
Stufe-2-Seite; Stufe 2 gibt es nur für Verwalter (`effectiveStufe2`).

- **Kopfkennzahlen:** die vorhandene Zählzeile (Objekte, Verbindungen, gesetzte Fachbeziehungen,
  Kürzung), jetzt als `graph-kopfkennzahlen` ausgewiesen.
- **Suche und Filterleiste:** Titelteil und Status (alle / freigegeben / nicht freigegeben) in der
  Objektliste.
- **Detailfenster je Eintrag, rein lesend:** Titel, Status, nicht gelöste Konflikte, Verbindungen im
  Graphen mit Grund (gemeinsames Schlagwort oder Art der gesetzten Beziehung) und der Öffnen-Link.
  Es gibt kein Eingabe- und kein Bearbeitungselement.
- **Qualitätsblick, ausdrücklich zu wählen:** Der Schalter steht aus, und vor der Wahl wird nichts
  geladen. Gewählt zeigt er vier Quoten mit Nenner (`lib/netzQualitaet.ts`):
  - Konflikte: Objekte mit nicht gelöstem Konflikt, von allen Objekten im Graphen.
  - Lücken: Objekte ohne Schlagwort, von allen sichtbaren Objekten (Sichtmetrik).
  - Veraltet: Objekte mit anstehender Re-Validierung, von allen Objekten im Graphen.
  - Dubletten: Objekte in offener Überschneidung, von allen Objekten im Graphen.
  - Dazu das Alter des Bestands: jüngster Eintrag im Graphen mit Datum und Tagen.
  - Eine laufende Abfrage zeigt „wird erhoben“, eine gescheiterte „nicht erhoben“; nie steht dort
    eine erfundene 0.
- Alle Eingänge kommen aus bestehenden, sichtbarkeitsgefilterten Routen: `/api/graph`,
  `/api/conflicts`, `/api/duplicates`, `/api/lifecycle/pending` und `/api/wissensnetz/luecken`. Es
  gibt keinen neuen Server-Weg. Gezählt wird nur über Kennungen der Graphantwort.
- Gegenproben:
  - `tests/wissensnetz-flaeche/netz-verwaltung.test.tsx` (Q1–Q5, K1, F1, D1, D2; jsdom).
  - Fall GL in `tests/wissensnetz-flaeche/graph-liste-telefon-chromium.test.ts` (Qualitätsblick
    am echten Server).
- **Grenzen:**
  - Ein eigener Pfad `/verwaltung/wissensnetz` ist nicht angelegt. Die Verwalterseite ist die
    Stufe-2-Seite `/graph`, um die Netzdarstellung herum.
  - „Veraltet“ heißt hier „Re-Validierung steht an“ (Lebenszyklus). Das Produkt kennt kein anderes
    Veraltungsmaß.
  - `GET /api/lifecycle/pending` ist laut `ko-routes.ts` der selbstheilende Arbeitsbereichsweg
    (SCRUM-420). Er ist derselbe Weg, den Kapital- und Analyse-Seite schon lesen. Ob er im Hintergrund
    Merker nachschreibt, ändert an „ohne Bearbeiten im Netz“ nichts, ist aber hier benannt.
  - Der in der Quelle genannte Nummern-Widerspruch zu SCRUM-550/551 bleibt ungeklärt.

**Grenzen dieser Lieferung.**

- Unsichtbare Zeichen außerhalb von `\s` (z. B. U+200B) und Verwechslungen über Schriftzeichen
  hinweg (lateinisch/kyrillisch) werden nicht erkannt.
- Die eigentliche Heilung bleibt außerhalb: Schlagwörter beim Schreiben normalisieren
  (`services/knowledge-object/**`). Das ist eine Produktentscheidung und nicht Gegenstand dieses
  Auftrags.
- Die Graph-Ansicht `/graph` (`Stufe2.tsx`) zeigt `via` weiter roh. Sie ist kein Zielpfad dieses
  Auftrags.

## Zuordnung je Quellpunkt

Spalten: Kennung · Zustand in der Quelle · Titel (gekürzt, wo die Quelle kürzt) · Ergebnis/Beleg
oder verbleibende Entscheidung.

| Punkt | Quelle | Titel | Ergebnis / offene Entscheidung |
|---|---|---|---|
| R-0441 | arbeitsauftrag | Kantenregel und serverseitige Begrenzung des Netzes | Geliefert: Kante nur bei gemeinsamem **freigegebenem** Objekt, ≤40 Knoten, ≤3 Kanten je Knoten, Ubiquitätssperre, alles im Server (`themenkarte.ts`; JOB 2600, 3022). Belege: `tests/wissensnetz/themenkarte.test.ts`, `tests/netz-skalierung/*`. |
| R-0445 | arbeitsauftrag | Nachbarschaft am geöffneten Wissensobjekt | Geliefert: `GET /api/kos/:id/neighbors` mit `via`, `total`/`truncated`, `excludedTags` (mega68/71), Fläche `KnowledgeNeighborhood.tsx`. In diesem Lauf nicht neu geprüft. |
| R-0454 | arbeitsauftrag | Themenlandkarte als Bildform des Wissensnetzes (W8) | Geliefert: Themenkarte `/wissensnetz` (JOB 2600 D7/D9, JOB 3052 D9). |
| R-0458 | arbeitsauftrag | Wissensnetz-Dienst: Beziehungen erheben und im Produkt lesen | Geliefert: `services/wissensnetz` (Lesemodell JOB 1496, Lücken JOB 1577/2009), kuratierte Beziehungen JOB 4151/4155. |
| R-0459 | gelieferter_teilstand | Wissensnetz-Seite in der Oberfläche | Teilstand bestätigt (`Wissensnetz.tsx`). Ergänzt in diesem Auftrag: unterscheidbare Doppelgänger (s. oben). |
| R-0475 | arbeitsauftrag | Wissensnetz als Leseweg in Sätzen | Geliefert: JOB 3070/3073 (`leseThemen`, `Themenzeilen`), `tests/wissensnetz-leseweg/*`. |
| R-0481 | entschiedene_grenze | Globaler Wissensgraph über alle Objekte | Grenze eingehalten: kein All-gegen-all-Bild. Die Themenkarte ist gedeckelt; `/graph` deckelt bei `GRAPH_EDGE_LIMIT` und meldet `truncated`. Nichts Neues gebaut. |
| R-0694 | arbeitsauftrag | Wissensnetz-Dienst: Graph, Nachbarschaft, Lücken | Geliefert (s. R-0458, R-0445). Lücken als Sichtmetrik **ohne Urteil** (JOB 3067). |
| R-0728 | arbeitsauftrag | Bestandsaufnahme der Beziehungen im Wissensnetz | Mit dieser Datei erfüllt für den Stand `3b79c5d1`. |
| R-0738 | arbeitsauftrag | Kantenaggregat mit Leserechteprüfung | Geliefert: Sichtbarkeit wird **vor** jedem Zähler angewandt (`policy-naht.ts`, `lesemodell.ts`, `service.ts:graph`, `kuratierteKantenFuer`). Beleg: `tests/wissensnetz/lesemodell-sicht.test.ts`, `tests/wissensgraph-integration/rechte-am-draht.test.ts`. |
| R-0739 | arbeitsauftrag | Lesemodell des Wissensnetzes | Geliefert (JOB 1496, `lesemodell.ts`, `tests/app/f0458-wissensnetz-lesemodell.test.ts`). |
| R-0744 | arbeitsauftrag | Qualitätsblick und Adminseite zum Wissensnetz | **Seit Nacharbeit 3 umgesetzt an `/graph`** (Kopfkennzahlen, Filterleiste, Detailfenster, Suche, rein lesend; wählbarer Qualitätsblick mit Nenner und Bestandsalter). Einzelheiten und Grenzen im Abschnitt „R-0744“ oben; Gegenproben `netz-verwaltung.test.tsx` und `graph-liste-telefon-chromium.test.ts`. Stand der ersten Fassung, zur Nachvollziehbarkeit erhalten: Wortlaut: „Für Verwalter gibt es eine Seite rund um die Netzdarstellung: Kopfkennzahlen, Filterleiste, Detailfenster und Suche, rein lesend, ohne Bearbeiten im Netz. Dazu kommt ein ausdrücklich zu wählender Qualitätsblick auf Konflikte, Lücken, veraltetes Wissen und Dubletten – jede Zahl mit ihrem Nenner und dem Alter des Bestands.“ Die Anforderung ist ausdrücklich; die Frage „ob gewünscht“ der ersten Fassung war falsch und ist gestrichen. Stand im Arbeitsbaum: Eine Verwalterseite zum Netz und ein wählbarer Qualitätsblick mit Nenner und Bestandsalter sind nicht auffindbar. Vorhanden sind nur Bausteine für Anwender: Sichtmetrik (JOB 3067), Kürzungshinweis am Graphen (JOB 4328) und seit Nacharbeit 2 Suche/Liste am Graphen. Die Quelle selbst nennt den Stand „angedacht“, Prüfstatus „nur_altquelle“, JOB 1553/1576 grün, „Einbau oder Wirkung nicht belegt“, für Z5 „keine Umsetzung belegt“, dazu einen ungeklärten Nummern-Widerspruch zu SCRUM-550/551. Die frühere Einordnung „Umsetzung als eigener Bau“ ist durch Nacharbeit 3 ersetzt. |
| R-0754 | arbeitsauftrag | Wissensnetz für jeden Anwender: Warum weiß Klarwerk das? | **Teilstand.** Wortlaut: „Nicht nur Verwalter, sondern jeder Anwender kann sehen, wie eine Aussage mit ihren Quellen, Belegen, Prüfungen und Nachbarn zusammenhängt.“ Für jeden Anwender vorhanden: Nachbarn mit Begründung `via` (mega45/mega68, `KnowledgeNeighborhood.tsx`), gesetzte Beziehungen (`WissensbeziehungenBereich.tsx`, JOB 4153/4155), Themenkarte und Graph. Eine Ansicht, die Quellen, Belege, Prüfungen **und** Nachbarn einer Aussage als **einen** Zusammenhang zeigt, ist nicht belegt. Die Quelle nennt einen offenen Widerspruch: Das Konzept vom 26.07. hält das Wissensnetz adminseitig und je Mandant schaltbar, hier ist ausdrücklich die Anwendersicht gemeint. **Verbleibend:** diese Entscheidung des Owners und, je nach Ergebnis, die zusammenführende Ansicht. |
| R-0767 | arbeitsauftrag | Skalierung des Wissensnetzes | Geliefert: JOB 3022 (Schlagwort-Index statt Paarschleife, 12.000 Objekte) und JOB 4303. Bekannte Grenze laut `service.ts`: quadratisch in der Gruppengröße eines häufigen Schlagworts. |
| R-1135 | entschiedene_grenze | Ausgeschlossene Wissensnetz-Ausbauten (Streichliste) | Eingehalten: keine Graphdatenbank, keine Ontologie, keine automatische Themenbildung, keine Animation, kein Designsystemumbau. |
| R-1505 | arbeitsauftrag | Wissensnetz — was ist gebaut, was nicht: ein Befund mit Tes… | Befund mit dieser Datei. Testzuordnung im Prüfplan des Auftrags. |
| R-1537 | arbeitsauftrag | Das Wissensnetz zeigt seine Zahlen — was gezählt wurde, ste… | Geliefert: JOB 3067 (`Sichtzahlen`, „sichtbar“ im Wort), `tests/wissensnetz-sichtmetrik/flaeche.test.tsx`. |
| R-1552 | gelieferter_teilstand | D6 „Wissensnetz… | Teilstand bestätigt: JOB 3052 D9 (Zielbild-Netz mit Seitenleiste). Chromium-Messung `tests/design/zielbild-wissensnetz.test.ts` wird in diesem Auftrag nicht wiederholt. |
| R-1568 | gelieferter_teilstand | V6 — der Leseweg des Wissensnetzes … | Teilstand bestätigt: JOB 3070/3073. |
| R-1571 | gelieferter_teilstand | Wissensnetz: gemeinsame Themen und Bibliothekssprung | Teilstand bestätigt: eine Themenachse (JOB 3073/3075), der Sprung trifft (L1–L6). Ergänzt: sichtbare Unterscheidung gleich aussehender Themen (dieser Auftrag). |
| R-1591 | arbeitsauftrag | DESIGN Klarwerk: Zielbild „Wissensnetz… | Geliefert: JOB 3052 D9, Werte in `tools/design-vergleich/werte.ts`. Keine neue Designarbeit. |
| R-1612 | gelieferter_teilstand | Wissensnetz: vier unvereinbare Belege in vier Tagen … | Teilstand bestätigt: P12 (JOB 3075), eine Achse in Karte, Liste und `/graph`. |
| R-1618 | gelieferter_teilstand | Das Wissensnetz gibt es auch in Sätzen statt als Zeichnung… | Teilstand bestätigt: JOB 3070. |
| R-1727 | arbeitsauftrag | Knowledge Graph (SVG aus Live-Daten) | Geliefert: `/graph` (`Stufe2.tsx`) aus `GET /api/graph`, gedeckelt, mit kuratierten Kanten (JOB 4155) und Kürzungshinweis (JOB 4328). |
| R-1971 | arbeitsauftrag | ENTSCHEIDUNG (OFFEN:H6, `raw.herkunft`) | Entscheidung Pedi 31.07.: „H1 H2 weiter, im nächsten Code-Lauf.“ Die offene Rückfrage betraf die zwei Schnitte neben der Nachbarschaft: **B Themenlandkarte** und **C Leseweg**. **Erledigt:** Beide sind gebaut, B als Themenkarte `/wissensnetz` (JOB 2600, 3052), C als Leseweg in Sätzen (JOB 3070/3073). Kein Rest. |
| R-1972 | quellenrest | BEAUFTRAGT (OFFEN:H1, `criteria_text`) | Auftrag „Variante A, die Nachbarschaft“ (mega68) mit harten Grenzen: Die Auskunft geht von einem Objekt aus und ist gedeckelt. Ein Schlagwort, das fast alle tragen, erzeugt keine Kante. Ein Nachbar ohne Leserecht existiert nicht. Der Ort ist das Wissensobjekt. An jeder Kante steht das gemeinsame Schlagwort, ein Klick geht weiter. **Geliefert:** `GET /api/kos/:id/neighbors` (gedeckelt, `via`, `excludedTags`, Sichtbarkeit vor dem Zählen) und `KnowledgeNeighborhood.tsx` am Wissensobjekt; jeder Nachbar verlinkt auf `koDetailPath`. **Offene Rückfrage aus derselben Zeile:** Ob Pedis „LLM-Wiki-Grafik“ ein gezeichnetes Netz oder eine durchblätterbare Wissenssicht meint („nicht raten, ihn fragen“). Eine Antwort darauf ist in den Quellen nicht belegt. |
| R-1976 | quellenrest | BEFUND (OFFEN:H5, `criteria_text`) | Befund: `graph()` verglich jedes Paar, Kanten entstanden über jedes geteilte Schlagwort, begrenzt wurde erst im Browser. Bauvorgabe: Die Anwendersicht geht von einem Objekt aus, die Route wird begrenzt, ein Schlagwort, das fast alle tragen, erzeugt keine Kante. **Geliefert:** Schlagwort-Index statt Paarschleife, Ubiquitätssperre, Kantendeckel `GRAPH_EDGE_LIMIT` mit `totalEdges`/`truncated` im Server (JOB 3022, 3075, 4155), Nachbarschaft von einem Objekt aus (R-1972). **Rest am Quelltext:** `GET /api/graph` liefert die **Knotenliste ungedeckelt**; der 60-Knoten-Deckel (`MAX_GRAPH_NODES`, `limitGraph`) wirkt weiter erst im Browser (`Stufe2.tsx`). Das widerspricht der Vorgabe „Begrenzung SERVERSEITIG“ für die Knoten. Dieser Rest ist in diesem Auftrag nicht behoben und nicht als Befund bestellt. |
| R-1983 | quellenrest | OFFEN (OFFEN:H3, `criteria_text`) | Stand 23.08.: Das Lesemodell hat einen Aufrufer im Produkt (JOB 2009 D4). Offen blieben Kanten- und UI-Wirkung (H3b, JOB 2018). Ursprünglich SCRUM-545–551: Beziehungen erheben · Lücken schließen · Graph-Lesemodell · kuratierte Sicht „So arbeitet Klarwerk“ · Adminseite · Qualitätsblick. **Geliefert:** Kanten- und UI-Wirkung über JOB 3067 (Sichtmetrik), JOB 2600/3070 (Karte, Leseweg) und JOB 4151/4155 (kuratierte Beziehungen im Lesepfad), dazu Beziehungen erheben, Lesemodell und Lücken als Sichtmetrik. Adminseite und Qualitätsblick (= R-0744): seit Nacharbeit 3 umgesetzt. Kuratierte Sicht „So arbeitet Klarwerk“: seit Nacharbeit 5 umgesetzt an `/graph` (Abschnitt „R-1983“ oben). Ihr Inhalt ist eine Auslegung, weil die Quelle nur den Namen nennt. Für Letztere ist im Arbeitsbaum keine Umsetzung auffindbar. |
| R-2122 | arbeitsauftrag | Wissensgraph (SOLL) | Abgedeckt durch R-0454/R-1727 im gedeckelten Zuschnitt (R-0481). |
| R-2213 | gelieferter_teilstand | Wissensnetz auf kleiner Fläche und Sonderbeständen | Teilstand bestätigt: Leseweg statt Zeichnung unter 900 px (JOB 3070), Null-/Misch-/Kettenbestände (`tests/app/themenkarte-*-mounted.test.tsx`). |
| N-0011 | arbeitsauftrag | Überlagerte und gekürzte Beschriftungen erschweren die Zielwahl | Wortlaut: Beschriftungen mit Abstand, vollständiger Titel bei Fokus und Hover, „synchronisierte lesbare Objektliste als weiteren Einstieg“. Abstand und voller Titel: UX-07 (JOB 3103, `lib/graphLayout.ts`, `<title>`/`aria-label`). **Objektliste: seit Nacharbeit 2** (`GraphObjektliste`, Gegenprobe `tests/wissensnetz-flaeche/graph-listenweg.test.tsx`). Ein *sichtbarer* Volltitel bei Fokus im Bild ist nur über das SVG-`<title>` (Tooltip) belegt; eine Chromium-Messung dazu wurde hier nicht gefahren. |
| N-0023 | arbeitsauftrag | Tastaturfokus im Wissensgraphen bleibt visuell unsichtbar | Geliefert: Fokusring `themenknoten-fokus` (Themenkarte), UX-07 für `/graph`. Eine echte Bedienung mit Tastatur durch einen Menschen ist nicht belegt (s. Grenzen). |
| N-0024 | arbeitsauftrag | Gekürzte und überlappende Graphentitel erschweren die gezielte Auswahl | Wortlaut: „Eine filterbare Liste mit vollständigen Titeln ergänzen; im Graphen vollständige Titel bei Fokus/Überfahren zeigen, Überlappungen vermeiden und auf schmalen Fenstern eine gut bedienbare Listenansicht anbieten.“ Die erste Fassung erklärte den Punkt über N-0011 für geliefert; das war falsch, die Liste fehlte. **Seit Nacharbeit 2:** filterbare Volltitelliste unter dem Graphen, synchron mit den gezeichneten Knoten, Öffnen per Maus, Enter und Leertaste (V1–V6). Überlappungsfreiheit: JOB 3103. **Seit Nacharbeit 3:** Chromium-Gegenprobe der Liste bei 390×844 (Fall GL, seit Nacharbeit 4 in `tests/wissensnetz-flaeche/graph-liste-telefon-chromium.test.ts`), ausgeführt in der Cloud; ihr Ergebnis liegt dieser Lieferung nicht vor. Der Graph selbst wird schmal weiter skaliert; die Liste ist der Zugang auf schmalen Fenstern. |
| P-WG-PERSISTENZ | arbeitsauftrag | Kuratierte Beziehungen dauerhaft, eigenes Recht, setzen/lesen/ändern/widerrufen … | Geliefert (JOB 4151, K06: „Persistenz steht“). Belege: `tests/wissensgraph-integration/*` (u. a. `widerruf-und-konflikt.test.ts`). Neustart und PG: `neustart-und-restore.integration.test.ts`, in diesem Auftrag nicht wiederholt. |
| P-WG-ANZEIGE | arbeitsauftrag | Dieselbe Beziehung im Eintrag und im Netz sichtbar … | Geliefert: JOB 4155/4328 (`WissensbeziehungenBereich.tsx`, `tests/wissensgraph-anzeige/*`, `tests/wissensgraph-abnahme/*`). |
| P-WG-LUECKEN | arbeitsauftrag | Kuratierte Beziehungen im Netz-Lesepfad, „keine Kante“ ≠ „konfliktfrei“, App-Abnahme G1/G2/G7/G10 im Browser | Laut Originalqualifikation **erledigt 17.09.2026, JOB 4155 LIVE als `1.0.0-beta.1.552`** (BEN-Urteil Runde 3 grün). Einzeln, wie die Quelle sie unterscheidet: Beziehungsbereich ohne Aufklappen in der Lesespalte (DOM-Beleg `tests/wissensgraph-abnahme/eintragsansicht-direkt.test.tsx`); **G1 und G7** im echten Browser gefahren (`tests-smoke/wg-luecken-beziehungen-browser.spec.ts`, Sollmanifest Version 7); **G9** ohne Skip gemessen; **G10** als Regressionslauf 4145/4146 mitgelaufen. **Rest G2** (echter Serverprozess-Neustart) ist laut Quelle kein Browserfall und kein eigener Auftrag, sondern Lieferung 3 in **JOB 4275**. Im Arbeitsbaum steht dazu `tests/beziehungs-restore-nutzerweg/beziehungen-im-browser-nach-restore.integration.test.ts` (PID-Wechsel vor/nach, Commit `265e3276`, „BEN GRUEN“ laut Commit-Text). Ein ausgeführtes Ergebnis dieses PG- und Chromium-Laufs liegt diesem Auftrag **nicht** vor. Die erste Fassung verwies das pauschal an `graph-browser-rechte`; das war falsch und ist ersetzt. Alles hier ist aus Quelle und Repository zitiert, nicht neu geprüft. |
| P-UX-07 | arbeitsauftrag | DESIGN Wissensgraph: Beschriftungen entzerren … 28 Knoten … | Geliefert: JOB 3103 (`tests/wissensgraph-lesbarkeit/*`). |
| priority:WG-PERSISTENZ / WG-ANZEIGE / WG-LUECKEN / UX-07 | doppelte_quellenfassung | — | Doppelte Fassung der jeweiligen P-Punkte. Kein eigener Umfang. |
| priority:D6 | arbeitsauftrag | DESIGN Klarwerk: Zielbild „Wissensnetz… | wie R-1591/R-1552. |
| priority:N6 | arbeitsauftrag | Wissensnetz bei zwölftausend Objekten benutzbar … | wie R-0767 (JOB 3022, `tests/netz-skalierung/graph-zwoelftausend.test.ts`). |
| priority:P12 | arbeitsauftrag | Vier unvereinbare Belege … ehrlicher Befund mit Tests | wie R-1612. |
| priority:V6 | arbeitsauftrag | Das Wissensnetz in Sätzen … | wie R-1618. |
| package:wissensnetz | arbeitsauftrag | Wissensnetz und Themenkarte | Sammelpunkt. Mit dieser Zuordnung abgedeckt. |
| question:K06 | arbeitsauftrag | „4151 Persistenz steht; 4155 R2 begrenzt mehr als 5000 Kanten unvollständig, Graph-Sperre im Browser nicht wirksam gegengeprüft.“ | (1) Persistenz: siehe P-WG-PERSISTENZ. (2) Begrenzung: in JOB 4155 Runde 3 geschlossen. `kuratierteKanten` ist bei `GRAPH_EDGE_LIMIT` gedeckelt und meldet `kuratierteKantenGesamt`/`kuratierteKantenGekuerzt` (`service.ts:kuratierteKantenFuer`, `tests/wissensgraph-abnahme/graph-antwortbegrenzung.test.ts`). (3) Graph-Sperre im Browser: Im Arbeitsbaum gibt es dazu den Prüfweg `tests/wissensbeziehungen-browser-rechte/tastatur-schmal-rechte-im-echten-browser.test.ts` und `…-pg.integration.test.ts`, gebaut in den Läufen `graph-browser-rechte:3` (Commits `37b527f1`…`13e37aea`) und `graph-browser-rechte:6` (Ship `4ae7b2a5`, 1.0.0-beta.1.637). Ein **ausgeführtes, diesem Auftrag zugeordnetes Ergebnis** liegt nicht vor. Die Graph-Sperre bleibt deshalb hier **unbelegt**; behauptet wird nur die Existenz des Prüfwegs. |
| SOLL:FR-LIB-04 | arbeitsauftrag | Wissensgraph der Zusammenhänge. | Abgedeckt durch Themenkarte und Nachbarschaft im begrenzten Zuschnitt (R-0481, R-1135). |

## Abgrenzung

- **Abgeschlossene Teilumfänge, nicht neu gebaut:** JOB 1496/1577/2009 (Dienst), 2600 (Themenkarte),
  3022/4303 (Skalierung), 3052 (Zielbild), 3067 (Sichtmetrik), 3070/3073/3075 (Leseweg, eine Achse),
  3103 (UX-07), 3115 (Themenlink), 4151/4155/4328 (kuratierte Beziehungen, Kürzungshinweis).
- **Gesonderte bestehende Aufträge:** `aufnahme:20260922:gesamt-wissensnetz-export` (Export in offenem
  Format, eigener Strang), `graph-browser-rechte` (Browser- und Rechteabnahme, Graph-Sperre) und
  JOB 4275 (G2-Prozessneustart, laut P-WG-LUECKEN dort Lieferung 3). Alle drei sind hier nicht
  bearbeitet; ihre Ergebnisse werden nicht behauptet.

## Quellenwidersprüche und fehlende Belege

- `question:K06` meldet die Kürzung über 5000 kuratierte Kanten als unvollständig. Im Arbeitsbaum ist
  sie durch JOB 4155 Runde 3 gedeckelt und gemeldet. Die Quelle (22.09.) ist älter als dieser Stand
  oder bezieht sich auf Runde 2.
- `themenkarte.ts:215-227` führt eine **offene Owner-Frage aus JOB 2600 D1**: Zählt „belegt“ auch an
  unfreigegebenen Objekten? Heute zählt es nicht. Die Entscheidung liegt beim Owner und wurde hier
  nicht getroffen.
- R-0744 (Konzept: Wissensnetz adminseitig, je Mandant schaltbar) gegen R-0754 (ausdrücklich
  Anwendersicht für jeden): Diesen Widerspruch nennt die Quelle selbst. Er ist Owner-Sache.
- R-1976 verlangt Begrenzung auf dem Server; die Knotenliste von `GET /api/graph` ist weiter ungedeckelt
  und wird erst im Browser auf 60 Knoten gekürzt (s. R-1976).
- R-1972 enthält die unbeantwortete Rückfrage, ob „LLM-Wiki-Grafik“ ein gezeichnetes Netz oder eine
  durchblätterbare Wissenssicht meint.
- Kriterium 2 nennt „fehlende Fundorte“ und „Familiensprünge“ gemäß den aufgenommenen Fällen. Auch
  nach Abgleich aller 48 `original_points` ist dafür kein konkreter Fall zugeordnet. Im Arbeitsbaum zeigt die Seitenleiste bei leerer Trefferliste
  `wissensnetz.leiste.leer`, bei einem Fehler `wissensnetz.leiste.fehler`, und kein unbekannter Wert
  wird still verworfen (`bibliothekstreffer.test.tsx` L2/L6). Ob damit der aufgenommene Fall
  getroffen ist, ist **ungeklärt**.
- Es gibt keinen Beleg einer echten menschlichen Bedienung (Tastatur, Vorleser, Telefon) und keinen
  Beleg am Produktivbestand. Die vorhandenen Belege sind jsdom- und Chromium-Messungen.

# Themenkarte und begründete Nachbarschaft aus Wissensbelegen — Bestandsaufnahme 03.10.2026

Auftrag `aufnahme:20260922:gesamt-wissensnetz` (Revision 2), Quelle
`gesamtaufnahme-20260922-v1-502e629bf2113ebf`. Basisstand des Arbeitsbaums: `3b79c5d1`
(1.0.0-beta.1.657).

**Art der Belege in dieser Datei.** Die Zuordnung unten beruht auf einer **Quelleninspektion** des
Arbeitsbaums (Code, Testdateien, Git-Historie). In diesem Arbeitsgang wurde **kein Test ausgeführt**.
Die gezielten Prüfläufe stehen im Prüfplan des Auftrags und laufen in der Cloud. Ein in einer
früheren Lieferung genannter Prüflauf wird hier nur zitiert und nicht wiederholt.

Die Quelle (`QUELLEN.json`) führt je Punkt Kennung, Zustand und Titel; den vollständigen
Originalwortlaut tragen die dort referenzierten `aufnahmepunkte-0xx.json`, die diesem Auftrag nicht
beiliegen. Wo ein Titel gekürzt ist, ist das unten vermerkt.

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
  Nummer `#1…n` in seiner Untergruppe. Das gilt für Knoten (Beschriftung, `aria-label`, Tooltip),
  Seitenleistentitel, Themenzeilen samt Zusammen-Satz und „Alle Themen“.
- **Die Identität bleibt unverändert.** `data-thema`, die Auswahl, `themenHref` und der
  Suchparameter der Seitenleiste tragen weiter den gespeicherten Wert.
- Ein Hinweissatz (`wissensnetz.schreibweisen.hinweis`, de/en/nl in `apps/web/src/i18n.ts`) erklärt
  die Marke und erscheint nur, wenn markiert wurde.
- Ein Name ohne Doppelgänger bleibt wie bisher. L14 in `tests/wissensnetz-leseweg/leseweg.test.tsx`
  (getrimmte Zeile) gilt weiter.
- Neuer Test: `tests/wissensnetz-achse/gleich-angezeigt.test.tsx` mit den Fällen S1–S6.

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
| R-0744 | arbeitsauftrag | Qualitätsblick und Adminseite zum Wissensnetz | **Offen.** Eine eigene Adminseite zum Wissensnetz ist im Arbeitsbaum nicht auffindbar. Die Sichtmetrik ist nutzerbezogen. Zu entscheiden: ob eine Adminsicht gewünscht ist und welche Rechte-/Zählgrenze dort gilt (eine Gesamtzahl über Verborgenes wäre eine Existenzauskunft). |
| R-0754 | arbeitsauftrag | Wissensnetz für jeden Anwender: Warum weiß Klarwerk das? | Teilweise: Die Nachbarschaft nennt je Kante das `via`, die Themenkarte die Kodierung in der Legende. Eine eigene „Warum“-Erklärung je Antwort ist nicht belegt. Der Originalwortlaut liegt nicht bei, die Entscheidung über den Umfang bleibt offen. |
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
| R-1971 | arbeitsauftrag | ENTSCHEIDUNG | Der Titel trägt keinen Inhalt, der Originalwortlaut liegt nicht bei. **Nicht zuordenbar**: der Inhalt muss aus `aufnahmepunkte-022.json` `$[111]` nachgereicht werden. |
| R-1972 | quellenrest | BEAUFTRAGT | wie R-1971 (`$[112]`). |
| R-1976 | quellenrest | BEFUND | wie R-1971 (`$[116]`). |
| R-1983 | quellenrest | OFFEN | wie R-1971 (`$[123]`). |
| R-2122 | arbeitsauftrag | Wissensgraph (SOLL) | Abgedeckt durch R-0454/R-1727 im gedeckelten Zuschnitt (R-0481). |
| R-2213 | gelieferter_teilstand | Wissensnetz auf kleiner Fläche und Sonderbeständen | Teilstand bestätigt: Leseweg statt Zeichnung unter 900 px (JOB 3070), Null-/Misch-/Kettenbestände (`tests/app/themenkarte-*-mounted.test.tsx`). |
| N-0011 | arbeitsauftrag | Überlagerte und gekürzte Beschriftungen erschweren die Zielwahl | Geliefert: UX-07 (JOB 3103), kollisionsfreie Beschriftung (`beschriftungen`), voller Name in `aria-label`/Tooltip. |
| N-0023 | arbeitsauftrag | Tastaturfokus im Wissensgraphen bleibt visuell unsichtbar | Geliefert: Fokusring `themenknoten-fokus` (Themenkarte), UX-07 für `/graph`. Eine echte Bedienung mit Tastatur durch einen Menschen ist nicht belegt (s. Grenzen). |
| N-0024 | arbeitsauftrag | Gekürzte und überlappende Graphentitel erschweren die gezielte Auswahl | wie N-0011. |
| P-WG-PERSISTENZ | arbeitsauftrag | Kuratierte Beziehungen dauerhaft, eigenes Recht, setzen/lesen/ändern/widerrufen … | Geliefert (JOB 4151, K06: „Persistenz steht“). Belege: `tests/wissensgraph-integration/*` (u. a. `widerruf-und-konflikt.test.ts`). Neustart und PG: `neustart-und-restore.integration.test.ts`, in diesem Auftrag nicht wiederholt. |
| P-WG-ANZEIGE | arbeitsauftrag | Dieselbe Beziehung im Eintrag und im Netz sichtbar … | Geliefert: JOB 4155/4328 (`WissensbeziehungenBereich.tsx`, `tests/wissensgraph-anzeige/*`, `tests/wissensgraph-abnahme/*`). |
| P-WG-LUECKEN | arbeitsauftrag | Kuratierte Beziehungen im Netz-Lesepfad, „keine Kante“ ≠ „konfliktfrei“, App-Abnahme G1/G2/G7/G10 im Browser | Produkt geliefert (JOB 4155, `luecken.ts`, `Themenzeilen` Satz „verknuepfung“, Auslassungsgründe). Die verlangte **Browserabnahme G1/G2/G7/G10** ist eine Playwright-Abnahme und liegt beim gesonderten Auftrag `graph-browser-rechte`. Hier nicht wiederholt. |
| P-UX-07 | arbeitsauftrag | DESIGN Wissensgraph: Beschriftungen entzerren … 28 Knoten … | Geliefert: JOB 3103 (`tests/wissensgraph-lesbarkeit/*`). |
| priority:WG-PERSISTENZ / WG-ANZEIGE / WG-LUECKEN / UX-07 | doppelte_quellenfassung | — | Doppelte Fassung der jeweiligen P-Punkte. Kein eigener Umfang. |
| priority:D6 | arbeitsauftrag | DESIGN Klarwerk: Zielbild „Wissensnetz… | wie R-1591/R-1552. |
| priority:N6 | arbeitsauftrag | Wissensnetz bei zwölftausend Objekten benutzbar … | wie R-0767 (JOB 3022, `tests/netz-skalierung/graph-zwoelftausend.test.ts`). |
| priority:P12 | arbeitsauftrag | Vier unvereinbare Belege … ehrlicher Befund mit Tests | wie R-1612. |
| priority:V6 | arbeitsauftrag | Das Wissensnetz in Sätzen … | wie R-1618. |
| package:wissensnetz | arbeitsauftrag | Wissensnetz und Themenkarte | Sammelpunkt. Mit dieser Zuordnung abgedeckt. |
| question:K06 | arbeitsauftrag | „4151 Persistenz steht; 4155 R2 begrenzt mehr als 5000 Kanten unvollständig, Graph-Sperre im Browser nicht wirksam gegengeprüft.“ | (1) Persistenz: siehe P-WG-PERSISTENZ. (2) Begrenzung: in JOB 4155 Runde 3 geschlossen. `kuratierteKanten` ist bei `GRAPH_EDGE_LIMIT` gedeckelt und meldet `kuratierteKantenGesamt`/`kuratierteKantenGekuerzt` (`service.ts:kuratierteKantenFuer`, `tests/wissensgraph-abnahme/graph-antwortbegrenzung.test.ts`). (3) Die Graph-Sperre im Browser bleibt **in diesem Auftrag offen** und gehört zum gesonderten Auftrag `graph-browser-rechte` (Commits `37b527f1`…`13e37aea`, `tests/wissensbeziehungen-browser-rechte/*`). Dessen Ergebnis wird hier nicht behauptet. |
| SOLL:FR-LIB-04 | arbeitsauftrag | Wissensgraph der Zusammenhänge. | Abgedeckt durch Themenkarte und Nachbarschaft im begrenzten Zuschnitt (R-0481, R-1135). |

## Abgrenzung

- **Abgeschlossene Teilumfänge, nicht neu gebaut:** JOB 1496/1577/2009 (Dienst), 2600 (Themenkarte),
  3022/4303 (Skalierung), 3052 (Zielbild), 3067 (Sichtmetrik), 3070/3073/3075 (Leseweg, eine Achse),
  3103 (UX-07), 3115 (Themenlink), 4151/4155/4328 (kuratierte Beziehungen, Kürzungshinweis).
- **Gesonderte bestehende Aufträge:** `aufnahme:20260922:gesamt-wissensnetz-export` (Export in offenem
  Format, eigener Strang) und `graph-browser-rechte` (Browser- und Rechteabnahme). Beide sind hier
  nicht bearbeitet.

## Quellenwidersprüche und fehlende Belege

- `question:K06` meldet die Kürzung über 5000 kuratierte Kanten als unvollständig. Im Arbeitsbaum ist
  sie durch JOB 4155 Runde 3 gedeckelt und gemeldet. Die Quelle (22.09.) ist älter als dieser Stand
  oder bezieht sich auf Runde 2.
- `themenkarte.ts:215-227` führt eine **offene Owner-Frage aus JOB 2600 D1**: Zählt „belegt“ auch an
  unfreigegebenen Objekten? Heute zählt es nicht. Die Entscheidung liegt beim Owner und wurde hier
  nicht getroffen.
- R-1971, R-1972, R-1976 und R-1983 sind ohne Originalwortlaut nicht zuordenbar.
- Kriterium 2 nennt „fehlende Fundorte gemäß den aufgenommenen Fällen“. Den Originalfall dazu enthält
  die beiliegende Quelle nicht. Im Arbeitsbaum zeigt die Seitenleiste bei leerer Trefferliste
  `wissensnetz.leiste.leer`, bei einem Fehler `wissensnetz.leiste.fehler`, und kein unbekannter Wert
  wird still verworfen (`bibliothekstreffer.test.tsx` L2/L6). Ob damit der aufgenommene Fall
  getroffen ist, ist **ungeklärt**.
- Es gibt keinen Beleg einer echten menschlichen Bedienung (Tastatur, Vorleser, Telefon) und keinen
  Beleg am Produktivbestand. Die vorhandenen Belege sind jsdom- und Chromium-Messungen.

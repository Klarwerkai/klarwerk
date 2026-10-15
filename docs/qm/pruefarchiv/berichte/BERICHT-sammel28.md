# BERICHT SAMMEL 28 - UX-WOW-1

Erstellt: 2026-07-22 08:56:51 CEST

## Gesamtverdikt

**ROT - Patch 73 ist in der vorliegenden Fassung nicht tragfaehig fuer das Ship-8-Paket.**

U1 (Markdown), U3, U4, U6, U7 und U9 sind strukturell sauber umgesetzt. Der Blocker liegt in U2/U5: Aus dem gesamten per `ko.read` sichtbaren Bestand werden auch vertrauliche validierte KOs fuer Direktfragen verwendet. Deren Titel wird dadurch als Nutzerfrage in den normalen, cloud-faehigen Ask-Pfad gegeben. Der bestehende `dropConfidential`-Filter schuetzt nur den KO-Kontext, nicht den bereits in die Frage kopierten vertraulichen Titel.

Zusaetzlich hat der U8-Guard eine schmale Controlled-Editor-Kante: `lastEmittedRef` wird nach einer spaeteren externen DOM-Aktualisierung nicht verbraucht oder geloescht. Ein legitimer spaeterer externer Wert, der zufaellig dem alten emittierten Wert entspricht, kann deshalb faelschlich ignoriert werden. Das ist kein nachgewiesener Freeze, aber eine reale Ruecksetz-/Wiederherstellungsregression und sollte zusammen mit dem Sicherheitsblocker korrigiert werden.

## Pruefobjekt und Methode

- Arbeits-Repo: `/Users/peterkohnert/Documents/dev_Klarwerk`
- Ausgangs-HEAD: `2727b7e84d4a42056f0641174ac693121200ebbb`
- Inbox-Auftrag: `_relay/ben/inbox/AUFTRAG-sammel28.md`
- Pruefobjekt: `_relay/patches73/0001-fix-web-word-addin-WP-UX-WOW-1-Kopfs-Live-UX-Befunde.patch`
- SHA-256 Patch 73: `53d4223d547984c83aa267f6aa5f35a8a9756ec8adc4d24eb140b0d8de15e371`
- Patchumfang: 30 Dateien, 1.390 Einfuegungen, 56 Loeschungen.
- Kettenpruefung: Auf einer temporaeren Kopie ausserhalb des Repos wurden Patches 57 bis 73 in Reihenfolge jeweils mit `git apply --check` geprueft und anschliessend nur dort angewandt. Ergebnis: **57-73 konfliktfrei anwendbar**.
- Kein Bau und keine Tests ausgefuehrt. Das im Auftrag genannte `tools/check`-Ergebnis wurde als gelieferte Evidence behandelt, nicht erneut gerechnet.

## Befunde

### F1 - ROT - Vertrauliche KO-Titel gelangen ueber U2/U5 in den cloud-faehigen Ask-Pfad

**Befund**

`buildAskExampleChips` filtert ausschliesslich auf `status === "validiert"` und nicht auf `confidentiality`. Damit sind `vertraulich` und `streng_vertraulich` als Chip-Quelle zugelassen:

- `apps/web/src/lib/askExampleChips.ts:27-38`

Die Daten kommen aus `useKos()` ohne Filter. Serverseitig verlangt `GET /api/kos` zwar `ko.read`, gibt danach aber `ko.list(request.query)` ohne Vertraulichkeitsfilter zurueck:

- `apps/web/src/pages/Ask.tsx:88-90`
- `apps/web/src/api/hooks.ts:6-7`
- `services/app/src/routes/ko-routes.ts:102-108`

Der Chip baut aus dem Titel die Frage und sendet sie unmittelbar ueber die normale Ask-Mutation:

- `apps/web/src/pages/Ask.tsx:115-129`
- `apps/web/src/pages/Ask.tsx:302-317`

Die Mutation setzt keinen `retrieval-only`-Modus und keine Vertraulichkeits-Provenienz. Der Session-Zweig ruft daher den normalen Ask-Service auf:

- `services/app/src/routes/ask-routes.ts:120-129`

Der Ask-Service entfernt vertrauliche KOs zwar aus dem Kandidatenkontext, reicht die bereits aus dem vertraulichen Titel gebildete `question` aber an `reasoner.answer` weiter:

- `services/ask/src/service.ts:95-127`

Der normale Reasoner-Pfad hat `confidential=false` als Default; der Modellprovider baut die Frage in den Modell-Prompt ein:

- `services/reasoner/src/service.ts:469-477`
- `services/reasoner/src/service.ts:765-772`
- `services/reasoner/src/provider-model.ts:935-964`

U5 erzeugt dieselbe Kante aus der Bibliothek: Jeder `ready`-Eintrag erhaelt eine Frage aus seinem Titel und `?ask=1` startet sie automatisch. Auch hier fehlt eine Vertraulichkeitspruefung:

- `apps/web/src/pages/Library.tsx:380-398`
- `apps/web/src/lib/libraryMaturity.ts:44-55`
- `apps/web/src/pages/Ask.tsx:131-145`

**Impact**

1. Ein vertraulicher oder streng vertraulicher KO-Titel kann an einen externen Modellprovider gelangen.
2. Der positive Chip-Badge ist fuer solche KOs zugleich unehrlich: Der Titel wird als Frage gesendet, das zugehoerige vertrauliche KO wird danach durch `dropConfidential` aus dem Antwortkontext entfernt und kann die versprochene belegte Antwort nicht liefern.
3. Es ist kein neuer rollenfremder Lesebypass: Der Nutzer muss `ko.read` besitzen und konnte den Titel bereits in der Bibliothek sehen. Neu und sicherheitsrelevant ist der automatische Egress durch den Direkt-Sendeweg.

**Testluecke**

`tests/ask/ask-example-chips.test.ts:9-28` erzeugt KOs ohne gesetzte Vertraulichkeitsstufe. Die Tests pruefen `validiert` gegen `offen`, aber keinen Fall `validiert + vertraulich/streng_vertraulich`. Fuer U5 existiert ebenfalls kein negativer Direkt-Sende-Test fuer vertrauliche KOs.

**Erforderliche Korrektur**

- Chips nur aus validierten **und nicht vertraulichen** KOs bilden, mit derselben zentralen Semantik wie `isConfidential`/`dropConfidential`.
- In der Bibliothek fuer vertrauliche KOs keinen normalen `?ask=1`-Auto-Sende-CTA aus dem Titel erzeugen. Entweder nur zur Detailansicht fuehren oder einen explizit provenance-gebundenen, garantiert nicht externen Retrieval-Pfad definieren.
- Negative Tests fuer beide Stufen: Chip fehlt, Direktfrage wird nicht ausgelost, Modell-/Cloud-Spy bleibt 0.

### F2 - GELB - U8 kann einen spaeteren legitimen externen Wert faelschlich ignorieren

**Befund**

Der neue Editor-Guard merkt sich jede eigene Emission dauerhaft in `lastEmittedRef` und ueberspringt jeden spaeteren Prop-Wert mit derselben Zeichenfolge:

- `apps/web/src/components/RichTextEditor.tsx:151-169`
- `apps/web/src/components/RichTextEditor.tsx:181-188`

Wenn danach ein anderer externer Wert B korrekt ins DOM geschrieben wird, bleibt der Marker A unveraendert. Kommt spaeter als legitime externe Aenderung wieder A - etwa durch Ruecksetzen, Wiederherstellen oder einen Vorschlag mit dem frueheren Inhalt -, beendet Zeile 168 den Effekt und laesst DOM-Inhalt B stehen. Beim naechsten Blur kann B erneut in den Parent zurueckemittiert werden. Der Guard ist damit nicht nur ein Einmal-Acknowledge der eigenen Emission, sondern ein stale Wertfilter.

Der Marker wird nur beim Moduswechsel nach `edit` geloescht (`RichTextEditor.tsx:159-165`), nicht nachdem eine eigene Emission einmal bestaetigt oder nachdem ein fremder Wert ins DOM geschrieben wurde.

**Testluecke**

Der Mounted-Test prueft den geraden Ablauf Eingabe -> Vorschlag -> Blur/Verwerfen und eine kleine Renderzahl:

- `tests/capture/frontdoor-discard-mounted.test.tsx:112-164`

Der eigentliche stale-marker-Fall A (eigene Emission) -> B (externe Aenderung) -> A (externe Rueckkehr) fehlt. Die drei Marker-Aussagen werden danach nur als Quelltext-Strings gepinnt:

- `tests/capture/frontdoor-discard-mounted.test.tsx:166-186`

**Bewertung und Korrektur**

Die Freeze-Diagnose ist plausibel und die beiden unmittelbaren Schutzmassnahmen sind richtig: `scrollIntoView?.()` verhindert die asynchrone TypeError, und No-op-Blur erzeugt keinen unnoetigen Parent-Update. Die ehrlich benannte fehlende 75-s-jsdom-Reproduktion ist als Restunsicherheit vertretbar.

Vor Ship sollte der Emissionsmarker jedoch nach einmaliger Bestaetigung verbraucht oder bei einer fremden DOM-Aktualisierung geloescht/aktualisiert werden. Ein Mounted-Test muss A -> B -> A durchlaufen und sowohl DOM-Inhalt als auch `onChange` pruefen. Die D6-Byte-Identitaet und Fokusmechanik werden im geraden Pfad nicht sichtbar regressiert; die Rueckkehrkante ist offen.

## Verdikttabelle U1-U9

| Punkt | Verdikt | Beleg und Bewertung |
|---|---|---|
| U1 Markdown sicher rendern | **GRUEN** | `answerMarkdown.ts:19-105` parst ein enges DOM-freies Subset. `AnswerMarkdown.tsx:8-76` erzeugt ausschliesslich React-Elemente mit Textkindern; keine URL-, HTML- oder `dangerouslySetInnerHTML`-Senke. Script/HTML bleibt Text. Ask, KlaraAssistant und Mobile nutzen die Komponente. Word zeigt ueber `textContent` und fuegt gestrippten Klartext ein. |
| U2 ehrliche Chips | **ROT** | `askExampleChips.ts:31` ignoriert Vertraulichkeit. Der Badge ist fuer vertrauliche KOs falsch und der Titel kann ueber den normalen Ask-Pfad extern werden (F1). |
| U3 Direktsenden | **GRUEN fuer Closure-Korrektheit, ROT im Zusammenspiel mit U2** | Die Mutation nimmt die Frage als Parameter (`Ask.tsx:115-126`), damit wird nicht die alte `q`-Closure gesendet. Das direkte Senden macht F1 allerdings unmittelbar wirksam. |
| U4 Bibliothek lesbar | **GRUEN** | Titel-Clamp/Tooltip und Trust-0-Ehrlichkeit sind reine Darstellung. Kein neuer HTML-Sink; Trust-Leiste erscheint nur bei positivem Wert. |
| U5 Karten-Frage | **ROT** | Die lokalisierte Frage und `?ask=1` funktionieren, aber `Library.tsx:398` und `libraryMaturity.ts:51-55` erlauben denselben vertraulichen Titel-Egress wie U2. |
| U6 Konflikte-Leerzustand | **GRUEN** | Erklaerung ist statisch/i18n. Admin-Link zeigt auf `/import#beispielpakete`; der Zielanker existiert und der Scroll ist methodengeguardet. Nicht-Admins sehen den Admin-Link nicht. |
| U7 echte Umlaute | **GRUEN** | Geaenderte Nutzertexte enthalten echte Umlaute. Die buildlose Word-Datei bleibt bewusst ASCII. Keine Logik-/Sink-Aenderung. |
| U8 Freeze-Guards | **GELB** | Unmittelbarer Scroll-/No-op-Blur-Fix ist korrekt; 75-s-Restunsicherheit vertretbar. Der stale `lastEmittedRef` verletzt aber eine seltene externe A -> B -> A-Rueckkehr (F2). |
| U9 Stufe-2-Karte | **GRUEN** | `routes.tsx:97-107` prueft zuerst unveraendert die Rollenrangfolge und zeigt erst danach bei ausgeschalteter Stufe 2 die Karte. Nur `role === "admin"` erhaelt den Einschaltknopf (`Stage2Notice.tsx:20-28`). Backend-RBAC und Nav-Sichtbarkeit bleiben unveraendert. |

## Regressionen und Abgrenzung

- Ask-/Klara-/Mobile-Markdown: keine HTML-Interpretation und kein neuer Link-/Bild-Sink gefunden.
- Kopieren/Export in Ask bleibt beim Rohtext; Word bleibt bei Klartext und `textContent`.
- U9 lockert RB-2 nicht: unzureichende Rolle wird weiterhin vor jeder Stufe-2-Erklaerung umgeleitet.
- Keine Backend-, API-Vertrags- oder Persistenzdatei wird von Patch 73 geaendert.
- Die bekannten sammel27-Stepper-Befunde zu Patch 72 sowie sammel26-F1-F3 waren laut Auftrag Nicht-Scope und bleiben unabhaengig offen.
- Die gelieferte gruen-Evidence (413 Testdateien / 3.044 Tests) widerlegt F1/F2 nicht, weil die genannten Negativszenarien nicht abgedeckt sind.

## Ship-Entscheidung

**Patches73: NO-GO fuer Ship 8 in der vorliegenden Fassung.**

Minimaler Weg zu einem schmalen Recheck:

1. Vertrauliche und streng vertrauliche KOs sowohl aus den U2-Chips als auch aus dem U5-Auto-Ask ausschliessen oder auf einen garantiert nicht externen, provenance-gebundenen Pfad umstellen.
2. Den Editor-Emissionsmarker als einmalige Bestaetigung behandeln und A -> B -> A als Mounted-Test pinnen.
3. Danach reichen fokussierte Rechecks fuer U2/U5 und U8; U1/U3/U4/U6/U7/U9 muessen nicht neu gebaut werden, sofern ihre Dateien unberuehrt bleiben.

## No-Code-Nachweis

- Produktcode geaendert: nein.
- Patch im Arbeits-Repo angewandt: nein.
- Bau/Test ausgefuehrt: nein.
- Commit/Push/Jira: nein/nein/nein.
- Geheimnisse oder ENV-Werte gelesen/ausgegeben: nein.
- Geschrieben wurde ausschliesslich dieser angeforderte Bericht in `_relay/ben/outbox/`.

SHA-256 des Berichtsinhalts oberhalb dieser Zeile: `e43931d406649a537eb186ba656854860fe78e4c190e15a0d1d5c917b6936050`

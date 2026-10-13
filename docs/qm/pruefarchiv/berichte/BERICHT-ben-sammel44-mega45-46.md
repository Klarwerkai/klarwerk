# Ben-Gegenpruefung sammel44: mega45 + mega46

Erstellt: 2026-07-28 22:19 CEST
Arbeitsverzeichnis: /Users/peterkohnert/Documents/dev_Klarwerk
Basis: main @ 93c6bd9a0a31eec0f91792e310cf54d2b15b7fc6
Auftrag: _relay/ben/inbox/AUFTRAG-ben-sammel44-mega45-46.md
Auftrags-SHA-256: f84f0054a21953baa8b48dd2252d65a5cea2de65814d08d08c889473d57d8144
Pruefart: streng read-only; kein Build und keine Testausfuehrung

## Kurzurteil

**ROT.** Die Desktop-Fassung der umgebauten Validierungsseite erhaelt die vorhandenen
Pruefaktionen und Rollenregeln. Auf schmalen Bildschirmen steckt jedoch das neu dort
verdrahtete Filterblatt innerhalb genau des DOM-Knotens, den `FacetFilter` beim Oeffnen
auf `inert` setzt. Ein echter Browser macht damit auch das Dialogblatt und dessen
Schliessen-/Filteraktionen nicht interaktiv. Das ist nach der ausdruecklichen Vorgabe
des Auftrags ein Ship-Blocker.

Herkunftsprojektion, Schalterauskunft, Loeschwarnfarben und der konkret beauftragte
Word-Klartext-Rueckfall sind im gelesenen Stand tragfaehig. Dort bleiben benannte
Folgearbeiten, aber kein zweiter Ship-Blocker dieser Scheibe.

## 1. Produktbefunde

### P0 / Ship-Blocker: mobiles Filterblatt liegt selbst im inerten Seitenbaum

**Befund:** In `Validation.tsx` umfasst `pageRef` die komplette Seite, einschliesslich
`FacetFilter` und dessen bei schmaler Darstellung inline gerendertem `dialog`:

- `apps/web/src/pages/Validation.tsx:450-451` — Seiten-Root mit `ref={pageRef}`.
- `apps/web/src/pages/Validation.tsx:504-530` — `FacetFilter` ist Kind dieses Roots und
  erhaelt `backgroundRef={pageRef}`.
- `apps/web/src/components/FacetFilter.tsx:124-137` — beim Oeffnen wird genau dieser
  Root mit `inert` versehen.
- `apps/web/src/components/FacetFilter.tsx:183-238` — Dialog, Backdrop, Schliessen und
  Filter liegen im selben Komponenten-Teilbaum und damit unter dem inerten Root.
- `apps/web/src/shell/useMediaQuery.ts:35` — der Pfad gilt bis 899 px Breite.

`position: fixed` aendert nur die Darstellung, nicht die DOM-Abstammung. `inert` gilt
fuer den gesamten Teilbaum. Im echten Browser kann das Blatt deshalb nach dem Oeffnen
weder korrekt fokussiert noch per Maus/Tastatur bedient oder geschlossen werden. Die
Seite ist dann praktisch festgefahren.

**Auswirkung:** Das ist nicht nur ein Testproblem. Die neue Validierungs-Filterschiene
bringt den bereits in der Bibliothek vorhandenen Fehler nun in den zentralen Weg fuer
das eigene Urteil. Auf kleineren Fenstern/Tablets ist die Filteraktion selbst kaputt;
unter realer Bedienung kann sie anschliessend auch alle darunterliegenden
Pruefaktionen blockieren.

**Warum die vorhandene Evidenz das nicht faengt:**
`tests/library/facet-sheet-keyboard-mounted.test.tsx:227-234` bestaetigt zwar einen
`[inert]`-Knoten und fokussiert danach Elemente im Dialog. jsdom setzt die native
Browserwirkung von `inert` jedoch nicht durch. Der Test prueft nicht die entscheidende
Strukturinvariante `dialog.closest("[inert]") === null` und kann daher trotz des echten
Browserfehlers gruen sein.

**Erforderliche Korrektur vor Ship:** Das Dialogblatt muss ausserhalb des inerten
Teilbaums liegen, z. B. per Portal, oder `backgroundRef` muss nur einen echten
Geschwister-Hintergrund umfassen. Danach mindestens:

1. Struktur-Pin: offenes `dialog` hat keinen `[inert]`-Vorfahren.
2. Gemounteter Narrow-Test an der echten `Validation`-Verdrahtung.
3. Browser-Beleg: Filter oeffnen, Option bedienen, anwenden/schliessen, danach eine
   Review-Aktion ausloesen.

### P2 / Ehrlichkeitskante: persoenlicher Leerzustand kann durch Facetten falsch werden

`mineEmpty` wird aus der bereits facettierten Endmenge `visible.length` berechnet
(`Validation.tsx:440-448`) und hat anschliessend Vorrang vor dem generischen
Filter-Leerzustand (`Validation.tsx:728-746`). Sind der Person Aufgaben zugewiesen,
werden aber durch eine aktive neue Facette ausgeblendet, kann die Seite sinngemaess
"keine persoenliche Arbeit" melden, obwohl nur der Filter zu eng ist.

Das blockiert keine Aktion und ist kein Ship-Blocker, sollte aber zusammen mit dem
mobilen Filterfix korrigiert werden: persoenlichen Leerzustand vor den additiven
Facetten bestimmen oder aktive Facetten als Ursache benennen/zuruecksetzen lassen.

## 2. Validierungsseite: erhaltene Logik und echte Testabdeckung

### Aktionen und Rollen

Der whitespace-bereinigte semantische Diff zeigt fuer die vorhandenen Aktionsanker
jeweils dieselbe Anzahl vor und nach dem Umbau:

- Aufklappen: `KoSummaryDisclosure source={k}` einmal, aktuell Zeile 920.
- direkte positive Bewertung: `rate.mutate` einmal, aktuell Zeile 1071.
- Feedback-Entscheidung: `reviewWithFeedback.mutate` einmal, aktuell Zeile 1282.
- Admin-Abschluss: `adminValidate.mutate` einmal, aktuell Zeile 1133.
- Zuweisen: `assign.mutate` einmal, aktuell Zeile 1161.
- Loeschen: `removeKo.mutate(k.id)` einmal, aktuell Zeile 1208.
- Bearbeiten: Link auf `/wissen/${k.id}?edit=1` einmal, aktuell Zeile 1216.
- Rollenregel fuer Bearbeiten/Loeschen bleibt Admin ODER Controller ODER Autor
  (`Validation.tsx:1178-1180`). Admin-Override bleibt nur Admin (`:1112`).

Die fachliche Reihenfolge ist ebenfalls erhalten: bestehende Board-, Herkunfts- und
Review-Fokusfilter laufen zuerst; `applyFacetSelection` wird erst danach auf
`nachFokus` angewendet (`Validation.tsx:410-442`). Die Facetten passen zum Board:
Pruefstand, Reife, Trust, Vertraulichkeit und Autor werden aus vorhandenen KO-Feldern
bzw. denselben reinen Ableitungen wie die Karten gewonnen
(`apps/web/src/lib/validationFacets.ts:27-63`). Eine Konfliktfacette wurde ehrlich
weggelassen, weil sie eine zweite Abfrage und Fehlerquelle erfordern wuerde.

Abgesehen vom offenen Filterblatt liegen die Kartenaktionen auf schmalen Breiten in
einer vertikalen, nicht abgeschnittenen Anordnung und bleiben im Quellaufbau erreichbar.

### Die acht unveraenderten Tests sind kein Vollbeweis

Die acht im Auftrag genannten Dateien lesen `Validation.tsx` direkt. Sie pruefen
ueberwiegend Quelltextanker oder isolierte Helfer:

- Autor/Datum, Vorschau und A11y-Attribute,
- Karten-Klick und Delete-Cache-Helfer,
- AI-Gate-Quellanker,
- Anwesenheit einzelner Filter-/Aktionsnamen.

Insbesondere `tests/app/mega45-validierung-facetten.test.ts:72-87` beweist nur, dass
bestimmte Bezeichner weiterhin im Quelltext vorkommen. Es klickt keine Review-Aktion.
Ein separater echter Mount-Test
`tests/validation/ai-gate-lock-followstate-mounted.test.tsx:169-225` deckt nur zwei
spezielle pending-Uebergaenge (Feedback-Submit und Admin-Ja) ab. Es gibt keinen
Interaktionstest, der Entscheiden, Aufklappen, Bearbeiten, Loeschen und Zuweisen nach
dem Layoutumbau gemeinsam durchlaeuft, und keinen Narrow-Mount der echten
Validierungsseite.

**Pruefwerkzeug-Fazit:** Die unveraenderten acht Tests sind nuetzliche Pins, aber kein
Beweis fuer Aktionsvollstaendigkeit oder mobile Bedienbarkeit. Genau diese Luecke hat
den P0-Befund durchgelassen.

## 3. Herkunftsprojektion

### Rechte und Leckschutz: GRUEN fuer den ausgeschalteten Unterbau

- Die Route verlangt zuerst serverseitig `ko.read`
  (`services/app/src/routes/provenance-routes.ts:69-73`).
- Die Gegenseite jedes Konflikts wird in der Kompositionswurzel geladen und anhand
  der serverseitigen Rolle sowie ihrer gespeicherten Vertraulichkeit als sichtbar
  oder unsichtbar klassifiziert (`:89-102`). Clientdaten entscheiden das nicht.
- Bei unsichtbarer Gegenseite verwirft die reine Projektion den gesamten Konflikt,
  bevor Knoten, Beschreibung, Begruendung oder Zitat ausgegeben werden
  (`services/provenance/src/project.ts:163-185`). Der belegte Durchstich ueber
  `description`/`detector.quotes` ist damit im Antwortgraphen geschlossen.
- Die Rechteauslassung wird nur in `audit.redactedByRights` gezaehlt und von der
  Route nicht gesendet (`project.ts:182-184`, `provenance-routes.ts:162-165`).
- Erst danach folgt die ausgewiesene Umfangskuerzung auf 60 Knoten
  (`project.ts:269-280`). Verdeckte Knoten beeinflussen somit weder `byScope` noch
  `omittedNodes`.

Die Rechteentscheidung faellt vor dem Projektionsaufruf als serverseitiges Datum
`gegenseite.sichtbar`. Die Projektion erhaelt zwar den vertraulichen Konfliktdatensatz
im Prozessspeicher, darf ihn aber durch die diskriminierte Sichtbarkeitsform und den
Ganzgraph-Sammler nicht ausgeben. Das ist fuer einen serverinternen, reinen
Projektionsschritt tragfaehig; es ist kein Client-Egress.

### Platzhalter `ko.validate`: tragfaehig, aber nicht aktivierungsreif

Die Sichtbarkeit vertraulicher Gegenseiten wird derzeit ersatzweise an
`can(user.role, "ko.validate")` gebunden (`provenance-routes.ts:87`). Das ist keine
echte nutzerbezogene Freigabestufe. Die Entscheidung, diesen Platzhalter im Stand zu
behalten, ist dennoch vertretbar, weil:

- `KLARWERK_PROVENANCE_ENABLED` standardmaessig aus ist,
- die Route bei AUS gar nicht registriert wird (`build-app.ts:1044-1056`),
- keine Anwendersicht existiert,
- der heutige allgemeine Lesepfad ohnehin noch keine feinere KO-Sichtbarkeit kennt.

Klare Grenze: Die Herkunftsroute darf nicht produktiv aktiviert werden, bevor der
Platzhalter durch die beschlossene echte Freigabestufe ersetzt und auch die Sicht des
Wurzel-KO geklaert ist. Fuer den jetzigen Default-AUS-Ship ist das kein Blocker.

## 4. Schalter-Registry und FeatureGate

### Produktzustand

- `SCHALTER_REGISTRY` ist die zentrale Zuordnung der drei Ja/Nein-Schalter
  (`services/app/src/feature-flags.ts:28-35`).
- `schalterAn` ist die gemeinsame fail-closed Auswertungsregel (`:43-53`).
- Build/Registrierung und Fachrouten fragen fuer Herkunft, Confluence und
  Experten-Matching diese Funktion ab (`build-app.ts:366,1032,1049`;
  `library-routes.ts:32-37`).
- `GET /api/features` verlangt eine Anmeldung und gibt ausschliesslich
  `{ features: Record<Fachname, boolean> }` aus
  (`features-routes.ts:39-47`). Keine Variablennamen, Werte, Pfade oder Versionen
  gelangen in den Vertrag.

Damit ist die Auskunft fuer den normalen, beim Start festgelegten Deploy-Zustand
konsistent mit der Routenschaltung. Ein Aendern der Prozessumgebung waehrend einer
laufenden Instanz koennte bei statisch registrierten Routen und dynamischer Auskunft
theoretisch driften; das ist bei regulaeren Deploy-Umgebungen kein realer Betriebsweg.

### Benannte Confluence-Ausnahme: aktuell tragfaehig, Waechter nicht vollstaendig

`services/confluence/src/adapter.ts:64-66` liest den Confluence-Schalter weiterhin
selbst, weil dieses Modul `services/app` nicht importieren darf. Die Semantik ist
aktuell identisch (`1`/`true`). Der Sammler fuehrt genau diese Datei als begruendete
Ausnahme und wird rot, sobald sie gar nicht mehr direkt liest
(`tests/app/mega46-schalter-eine-wahrheit.test.ts:34-42,144-152`).

Das ist als Modulgrenzen-Kompromiss tragfaehig. Der Waechter beweist aber nicht, dass
die ausgenommene zweite Auswertungsfunktion dauerhaft semantisch gleich bleibt. Auch
die Laufzeit-Paritaetsprobe in `mega46-schalter-auskunft` prueft konkret nur die
Herkunftsroute. Das ist eine **Pruefwerkzeug-Auflage**, kein aktueller Produktfehler:
Eine kleine diskriminierende Paritaetsprobe fuer Confluence (`1`, `true`, anderer Wert,
aus) sollte den Kompromiss dauerhaft absichern.

### Ungenutztes `FeatureGate`

`FeatureGate` hat keinen Produktaufrufer. Seine Regel ist klein, fail-closed und
montiert getestet: Laden, Fehler und unbekannter Zustand rendern nichts
(`apps/web/src/components/FeatureGate.tsx:23-34`). Da die erste vorgesehene
Herkunfts-Anwendersicht in mega45 ausdruecklich verboten war, trage ich die bewusste
Entscheidung mit, den Baustein bis zu diesem ersten Aufrufer zu behalten. Das ist eine
eng begrenzte Ausnahme von der Regel gegen ungenutzte Exporte, kein Produktverhalten
und kein Ship-Blocker. Bleibt die Herkunftsansicht laenger geparkt, sollte die Datei
mit dem Aufruferslice erneut bewertet werden.

## 5. Loeschbestaetigungen

- Bibliothek und Validierung verwenden fuer KO-Loeschen jetzt dieselbe volle,
  umbruchfaehige Zeile (`w-full basis-full`, `min-w-0 flex-1`) und denselben
  `Button variant="danger"` (`Library.tsx:990-1012`, `Validation.tsx:1191-1212`).
- KnowledgeDetail war bereits korrekt (`KnowledgeDetail.tsx:1774-1779`).
- Die vom Sammler zusaetzlich gefundene Entwurfsloeschung ist vollstaendig
  korrigiert: Behalten bleibt `ghost`, das bestaetigte Verwerfen ist nun `danger`
  (`CaptureDraftList.tsx:216-229`).

Die Form ist dort bewusst nicht dieselbe volle KO-Zeile, weil es sich um die kompakte
Entwurfsliste handelt; die sicherheitsrelevante Semantik und Warnfarbe sind gleich.
Der Sammler nennt seine Grenzen ehrlich: dynamische i18n-Schluessel und rohe Buttons
werden nicht vollstaendig erfasst. Das ist kein neuer Produktfehler dieser Scheibe,
aber der Satz "alle Loeschbestaetigungen" darf nur innerhalb dieses dokumentierten
Geltungsbereichs verwendet werden.

## 6. Word-Textrueckfall

Der konkret beauftragte stille Fall ist geschlossen:

- Leeres/nicht verwertbares Word-HTML setzt `plainTextFallback: true`
  (`apps/web/src/lib/wordAddin.ts:735-748`).
- Die Taskpane zeigt dann eine Warnung, dass Formatierung und etwaige Bilder fehlen
  (`taskpane.html:1347-1358`).
- Der Text ist in DE/EN/NL vorhanden (`taskpane.html:792,889,979`).
- Modul und buildloser ES5-Spiegel tragen dasselbe Feld.

Die zwei gemeldeten Nachbarfaelle sind richtig als eigener Scope erkannt:

1. Beim Budget-Fallback ist die Bildzahl bekannt, wird wegen `usedHtml === false` aber
   nicht als Zahl angezeigt (`wordAddin.ts:750-760`, `taskpane.html:1354-1355`). Die
   Meldung "Entwurf enthaelt den reinen Text" macht den Gesamtverlust immerhin
   sichtbar; die Anzahl bleibt Ehrlichkeitspolitur.
2. VML-Bilder (`v:imagedata`) werden vom reinen `<img>`-Zaehler nicht erfasst
   (`wordAddin.ts:108-119`). Das kann in Desktop-Word zu einem gruenen Erfolg trotz
   fehlendem Bild fuehren und sollte vor einem bildorientierten Word-Abnahmelauf als
   eigene P1-Scheibe geschlossen werden.

Beides ist vorbestehende/benannte Restschuld und kein Grund, den eng abgegrenzten
`plainTextFallback`-Fix zurueckzuweisen. Der VML-Fall gehoert jedoch in die
Vortest-Risikoliste, nicht nur in spaetere Kosmetik.

## 7. Sieben VIP-Aufgaben

| Aufgabe | Urteil im geprueften Diff |
|---|---|
| Anmelden und umsehen | Unberuehrt; kein neuer Blocker |
| Wissen erfassen und einreichen | Unberuehrt; Entwurfs-Loeschwarnung verbessert |
| Frage stellen und Antwort beurteilen | Unberuehrt |
| In der Bibliothek wiederfinden | Desktop unveraendert nutzbar; der bereits vorhandene mobile `FacetFilter`-Inertfehler betrifft auch diese Flaeche |
| Word-Dokument hineinbringen | Konkret beauftragter Klartext-Rueckfall ehrlich; VML als P1-Abnahmerisiko |
| Klara in Word | Funktionsschnitt unberuehrt |
| Eigenes Urteil in Validierung | Desktop-Aktionen erhalten; unter 900 px blockiert das geoeffnete Filterblatt die Bedienung — Ship-Blocker |

**Auslieferungsentscheidung:** Noch nicht ausliefern. Nach Korrektur des inert-/Portal-
Fehlers und einer echten Narrow-Gegenprobe kann die Scheibe ohne weitere
Produktblocker erneut vorgelegt werden. Die VML-Restschuld sollte zumindest vor dem
Word-Abnahmelauf gezielt getestet und triagiert sein.

## 8. No-op-Nachweis

Ausgangsstand:

- Branch/HEAD: `main` / `93c6bd9a0a31eec0f91792e310cf54d2b15b7fc6`.
- Produktdiff-SHA-256 ohne `_relay/**` und `LOT/**`:
  `efcbc0c8b089b63c38723071ed21c0b9164e95341d90d966c8ebcf357fb3684c`.
- Indexdiff-SHA-256:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
  (leer).
- Status-SHA-256 vor Bericht:
  `1f1fd7ec5c3d57ead3658988db1b6198a0e6da737aeab8dba2ffc8b13bf96103`.

Ich habe ausschliesslich lesende Datei-/Git-/Suchbefehle ausgefuehrt und genau diesen
Bericht angelegt. Kein Produktcode und kein Index wurden veraendert; kein Build, kein
Test, keine Anwendung, kein Commit, kein Push und kein Jira-Zugriff wurden ausgefuehrt.

GESAMTVERDIKT: ROT
SHA-256: adfee50a64aefdbaa3b5a12ff9297bcf6f1b403d7199760e66f76b3b768c9aad

# Prüfstatus-Anzeige · Bestandsabgleich der zugeordneten Kriterien (Stand Nacharbeit zu 9f3abccf)

Auftrag `aufnahme:20260922:gesamt-pruefstatus-anzeige`, Lauf 1. Runde 2 legte den Abgleich an
(Nacharbeit BEN-02), Runde 3 schloss die dort als Restarbeit ausgewiesenen Anforderungen
**innerhalb dieses Auftrags** (Ben R2: BEN-02 bis BEN-06). Die Nacharbeit auf Kandidat
`9f3abccf` behebt Ben R3 **BEN-07** (R-0216 im realen Konfliktübergang) und korrigiert diesen
Abgleich (**BEN-02**). Je Kriterium stehen hier der Stand, die Fundstellen im Produkt und die
Testbelege.

**Ausführungsstand dieser Nacharbeit:** Die Nacharbeit selbst hat keine Tests gestartet (Vorgabe
des Produktionswegs). Die Änderungen dieser Nacharbeit (R-0216/BEN-07) sind daher **noch nicht
ausgeführt belegt**. Der Beleg ist der Adapterlauf der Gruppe `tests/pruefstatus-anzeige` nach der
Integration. Die übrigen Zeilen beziehen sich auf die bereits von Ben am Commit `9f3abccf`
ausgeführten Läufe (Ben R3: 118 gezielte und 153 Nachbarfälle grün, 0 übersprungen).

**Pedis Entscheidungen vom 03.10.2026** (im Auftrag übernommen):
- Die offene Angabe „prüfende Person nicht erfasst“ erfüllt das Prüfangaben-Kriterium. Eine neue
  Speicherung entsteht nicht.
- Die menschliche Bedienprobe führt Pedi oder eine benannte Person nach der Lieferung durch, im
  Folgeauftrag `aufnahme:20260922:gesamt-pruefstatus-anzeige:menschliche-bedienprobe`. Sie
  blockiert keine technische Abnahme.

**Belegt** heißt: Die Testdatei lief lokal grün, ohne übersprungene Fälle (nur jsdom/Node; kein
Browser, kein PostgreSQL). **Gegenprobe** heißt: Die tragende Produktstelle wurde gezielt verändert
und der genannte Test wurde rot (Exit 1). Danach ist die Stelle wiederhergestellt. **Schwere
Belege** (Browser, PostgreSQL) sind benannt, aber nicht ausgeführt.

Neue Tests dieser Runde liegen unter `tests/pruefstatus-anzeige/`, außerdem
`apps/web/src/pages/Validation.bewertungsumfang.test.tsx`.

## A · Ergänzung 3 (Pedi 28.09.2026) – Arbeitsanleitungen

| Kriterium | Stand | Beleg |
|---|---|---|
| Übersicht und Detail zeigen denselben Status derselben Fassung | geliefert | `zustand.ts` → `freigabeanzeige`; `EntscheidungsVorlage.tsx` → `FreigabeStatus`; `tests/fe001-arbeitsanleitungen/pruefstatus-uebersicht-und-detail.test.tsx` (Teil B) |
| „Vorgelegt“ wird von „freigegeben“ unterschieden | geliefert | dieselbe Datei, Teil A und B |
| Geprüfte Fassung, prüfende Person und Zeitpunkt; nichts erfunden | geliefert (Pedi-Entscheidung 03.10.2026) | Bei einer Freigabe stehen Stand und Zeitpunkt da. Die prüfende Person wird **nicht gespeichert**; die Seite sagt „nicht festgehalten“ (`fe001.status.pruefung.*`). Belegt in Teil A/B derselben Testdatei. Keine neue Speicherung, keine neue Freigabepolitik. |
| Nächste Handlung nach Recht und Kontoregel | geliefert (R2, BEN-01) | Teil C derselben Datei, mit Gegenprobe |
| Unvorbereitete Testperson erklärt Status und nächsten Schritt | **nicht Teil dieser technischen Lieferung** | Folgeauftrag `…:menschliche-bedienprobe` (Pedi-Entscheidung). Die Frage steht im FE-001-Prüfpaket, Abschnitt 3. Ein Ergebnis gibt es erst nach der tatsächlichen Probe. |

## B · Ältere Zielzustände

| Kriterium | Stand | Produkt | Belege | Gegenprobe |
|---|---|---|---|---|
| **R-0208** KI-Prüfzustände ohne Freigabe, kein „KI validiert“ | **geliefert (R3)** | `lib/aiCheckStatusCard.ts` → `kiPruefzustand`. Sieben sichtbare Zustände im `AiCheckBadge` (Prüfseite), je mit `data-ki-pruefzustand`. Prüfbrett (`validation-routes.ts`) leitet beim Lesen `laeuft` (Worker: `laeuft(koId)`) und `konfliktGefunden` ab: offener automatischer Konflikt, dieses Objekt als Subjekt, Gegenseite für den Leser sichtbar. Wird nicht gespeichert. | `pruefstatus-anzeige/ki-pruefzustaende.test.tsx`, `ki-pruefauskunft-brett.test.ts`; angeglichen: `tests/validation/ai-check-badge-mounted.test.tsx`, `ai-check-coverage-visible-mounted.test.tsx` (sie verlangten „done → leer“) | ja (2) |
| **R-0212** Widerspruch hält über Schnittstelle und schmal | **geliefert (R3)** | `ko-routes.ts` → `konfliktJeEintrag`: `GET /api/kos` und `/api/kos/:id` erheben den Konflikt (eine Abfrage, Paarregel `sichtbarePaare`; bei Ausfall benannter Grund) | Test 1: `r0212-konflikt-ueber-schnittstelle.test.ts`; Test 2: `r0212-konflikt-schmal.test.tsx`; angeglichen: `ko-routes-anzeigestatus.test.ts` (D), `kos-liste-anzeigestatus.test.ts` (L2), `revalidierung-wird-erhoben.test.ts` (R-3) | ja (2) |
| **R-0216** Offener Widerspruch erscheint „in Prüfung“ | **korrigiert (Nacharbeit BEN-07), Ausführungsbeleg ausstehend** | Runde 3 war **nicht erfüllt**. `koOverview.ts` gab „In Prüfung“ nur bei Kern `validiert`. Der echte Wahrheitswiderspruch setzt den Kern aber auf `offen` zurück (R-0231: validiert/99 → offen/87, Anzeigestatus `konflikt`). Detail, Bibliothek und Antwort zeigten deshalb „Zu prüfen“. Bens rote Gegenprobe: 1 grün, 3 rot. **Jetzt:** Anzeigestatus `konflikt` ergibt unabhängig vom Kern immer „In Prüfung“ (`koOverview.ts` → `libraryMaturity`, `conflictAwareSourceRefs`). | Bens Gegenprobe unverändert übernommen: `r0216-echter-konflikt-gegenprobe.test.ts` (reale Produkt-Routen). Angepasst: `r0216-in-pruefung.test.ts` (der Fall „offen + Konflikt bleibt zu prüfen“ ist ersetzt durch offen/87 → „In Prüfung“ plus Gegenprobe ohne Konflikt) und `r0216-detail.test.tsx` (offen/87-Fall) | Bens Messbericht (rot vor der Korrektur) |
| **R-0223** Ungeprüft in der Antwort plus Filter | **geliefert (R3)** | `components/fragen/QuellenListe.tsx`: Filter „Alle / Nur ungeprüfte“. Gleiche Menge wie der Zähler (`validated === false`); unbekannte Quellen zählen nicht. | `r0223-ungepruefte-quellen-filter.test.tsx` | ja |
| **R-0224** Geprüftes getrennt von ungeprüfter Ablage | geliefert | Bibliothek: Umschalter Alle/Validiert/Offen (`bibliothek/zustand.ts`, `passtZuSegment`); Antworten: Filter aus R-0223 | `tests/design/h4-zustand.test.ts` (S4: vollständig und überschneidungsfrei), R-0223-Test | – |
| **R-0231** Wahrheitswiderspruch: Status offen, Vertrauen maßvoll gesenkt | geliefert | `knowledge-object/src/service.ts` (Strafe 12, nach unten auf 0 begrenzt) | `services/knowledge-object/src/service.test.ts`, `tests/validation/conflict-server-trust-impact-e2e.test.ts` | – |
| **R-0245 / R-1710** Validiertes sichtbar wieder in Prüfung | geliefert | `display-status.ts`, `revalidierungAnstehtFuer`; seit R3 auch an Mobil-Treffern und Antwortquellen (BEN-04) | `tests/anzeigestatus-revalidierung/revalidierung-wird-erhoben.test.ts`, `n4-mobile-treffer.test.tsx` | – |
| **R-0994** Stufenfrage und Doppelhinweis | geliefert | `pages/Validation.tsx`, `lib/validationStufenfrage.ts`, `lib/validationDoppelhinweis.ts` | alle Dateien unter `tests/validierung-stufe/` | – |
| **R-1003 / N4** Sieben abgeleitete Zustände im Lesepfad | **geliefert (R3)** | `deriveStatus` nimmt einen mitgelieferten Serverstatus an (BEN-04); Mobil-Suchtreffer über `anzeigestatusAus` mit Bestand und Anker; Antwortquellen übernehmen den Status der Plakette | `tests/anzeigestatus-web/anzeigestatus-quelle.test.ts` (Q1 angeglichen), `n4-mobile-treffer.test.tsx` | ja (2) |
| **R-1511 / R-1603** Prüfer sieht Stufe und Herkunft | geliefert | `services/validation/src/board-herkunft.ts`, `pages/Validation.tsx` | `tests/pruefseite/stufe-und-herkunft-am-brett.test.tsx` | – |
| **R-1707** pending → review → validated/rejected | geliefert (abgeleitet) | `validation/src/trust.ts`, `display-status.ts` | `services/validation/src/service.test.ts`, `tests/validation/validation-status.test.ts` | – |
| **N-0054 / UX-27** Prüfwert ohne Wahrheitsversprechen, Einordnung am Wert | **geliefert (R2/R3)** | NL „Beoordelingsstand“ (R2); `lib/pruefeinordnung.ts` → „Noch nicht fachlich geprüft“ direkt am Wert in `MehrAbschnitte.tsx`, nur wenn belegt (nicht validiert, Prüfwert 0, kein Entscheidungsverweis, keine Stimmen) | `n0054-ableitung.test.ts`, `n0054-einordnung-am-wert.test.tsx`, `tests/ux27-pruefstand/*` | ja |
| **N-0078** Bewertungsumfang am Knopf, Wortlaut angleichen | **geliefert (R3)** | Prüfseite: Restumfang im Fußband direkt nach den Entscheidungsknöpfen (`lib/bewertungsumfang.ts`); Bibliothek: „Positiv bewerten“ statt „Validieren“, „Rückfrage“ statt „Bedingt“ (DE/EN/NL; `werte-vorher.json` nachgetragen). Das gespeicherte Kommentarpräfix „Validierungsfeedback (Bedingt)“ bleibt, weil SCRUM-332 alte Rückmeldungen daran wiedererkennt. | `apps/web/src/pages/Validation.bewertungsumfang.test.tsx` | ja |

## C · Ältere Reste

| Kriterium | Stand | Feststellung |
|---|---|---|
| **R-1503** (JOB 3003: Prüfbrett liefert Stufe und Herkunft, Fehlen heißt Fehlen; live 1.0.0-beta.1.31, Ben GRÜN) | geliefert; Vermerk betrifft nicht wiederholte Läufe | **Vorhandener Einzelbeleg:** `services/app/src/routes/validation-routes.test.ts` (F1–F6, leicht). **Pflichtfall dieses Auftrags:** keiner zusätzlich. Die Route ist eine Lesesicht ohne Persistenzänderung, und R3 ergänzt nur die Leseauskunft `laeuft`/`konfliktGefunden` (`ki-pruefauskunft-brett.test.ts`). Browserwirkung: siehe R-1527. |
| **R-1509** (JOB 3009: Detailabruf sagt „nicht eingestuft“) | geliefert; Vermerk betrifft PG und UI | **Vorhandener Einzelbeleg:** `services/app/src/routes/ko-routes-stufenauskunft.test.ts` (leicht). **Benannter schwerer Fall:** `services/app/src/build-app.integration.test.ts` (PostgreSQL). Er enthält nur „Register → Login → KO anlegen → Audit“ und belegt die Stufenauskunft daher **nicht**. Einen PG-Pflichtfall für die Stufenauskunft gibt es im Bestand nicht. Das ist ein fehlender Beleg und kein Mangel des Produkts. |
| **R-1527** (JOB 3027: Prüfseite zeigt Stufe und Herkunft, Client) | geliefert; Vermerk betrifft Browser | **Vorhandener Einzelbeleg:** `tests/pruefseite/stufe-und-herkunft-am-brett.test.tsx` (21 Fälle, jsdom). **Fehlender Beleg:** ein Browserlauf gegen einen gestarteten Server. Im Bestand gibt es keinen Browserfall genau für die Stufen-/Herkunftszeile; er wird hier nur benannt, nicht bestellt. |
| **R-1543** (JOB 3043: Anzeigestatus an `GET /api/kos`, zwei Abfragen) | geliefert; Vermerk betrifft PG | **Vorhandene Einzelbelege:** `tests/anzeigestatus-liste/kos-liste-anzeigestatus.test.ts` (L1–L6; Zähler seit R-1524 ergänzt) und `r0212-konflikt-ueber-schnittstelle.test.ts`. **Fehlender Beleg:** ein echter PostgreSQL-Lauf für die Mengenabfragen `ratings.listByKos`/`assignments.listByKos`. Im Bestand gibt es dafür keinen PG-Fall (`tests/anzeigestatus-revalidierung/pending-for-pg.test.ts` nutzt einen Fake-Pool). |
| **K4 / Liefercheck** | nicht ersetzbar durch Einzelfälle, ersetzt aber auch keine | `tools/check` läuft am finalen Commit auf dem regulären Weg. Er ersetzt keinen der oben benannten Einzelbelege. Die fehlenden PG-/Browserbelege bleiben auch nach einem grünen Gesamtcheck fehlend. |
| **R-1524** `AssignmentRepo.all()` liest alle Zuweisungen | **geliefert (R3)** | Neu: `AssignmentRepo.listByKos(ids)` (PG: `WHERE ko_id = ANY($1)`, dieselbe Form wie `ratings.listByKos`). `pruefstandFuer`/`pruefstaendeFuer` lesen gezielt; das Prüfbrett braucht weiter alle offenen und bleibt bei `all()`. Belege: `r1524-zuweisungen-gezielt.test.ts`, angeglichene Zähler in `kos-liste-anzeigestatus.test.ts` und `revalidierung-wird-erhoben.test.ts`, Gegenprobe ja. **Offen:** echter PostgreSQL-Lauf auf dem Prüfserver. |
| **R-1534** Ort von `abfrageMitBestand` | **geliefert (R3)** | `abfrageMitBestand` und `auffrischungGescheitert` stehen jetzt in `lib/abfrageBestand.ts`, fachneutral und unverändert; fünf Importstellen umgestellt. Die Hinweis-Bauform bleibt in `lib/confidentiality.ts`. |
| **R-1554** Kommentar behauptete Garantie des Compilers | geliefert (R2) | `ko-routes.ts`, Kommentar korrigiert |
| **R-1570 / R-1595** Serverstatus, Wiederholen, Listenanker, übrige `deriveStatus`-Verbraucher | **geliefert (R3) bis auf Browserteil** | Aktive Verbraucher: Mobil-Treffer (mit Zustandsanker `mob-treffer-zustand`) und Antwortquellen nehmen den Serverstatus. Alle übrigen Aufrufer nehmen über `deriveStatus` einen mitgelieferten Serverwert an. `FindingCard.tsx` und `ko/KoReadView.tsx` werden im Produkt nicht mehr eingebunden (nur in Tests); sie sind abgegrenzt, nicht entfernt. **Offen:** echte HTTP-Erholung im Browser. |
| **R-1613** Q6d Offline-Auskunft / veralteter leerer Cache; Q1c direkte Wiederholknöpfe | in diesem Auftrag geliefert (Teil Q6d/Q1c) | **Einzelbelege:** `tests/q6d-offline-auskunft/laden-schweigt-mounted.test.tsx`, `liste-sagt-offline-mounted.test.tsx`, `veralteter-leerer-cache-mounted.test.tsx`, `tests/q1c-nachladen/mehr-abschnitte-holen-nach.test.tsx` (alle jsdom). **Fehlender Beleg:** der Live-Gegenfall auf 1.110 im Browser. |
| **R-1613, übrige Themen** | **nicht in diesem Auftrag; Zuordnung laut Quelle** | Laut `QUELLEN.json` (R-1613, Zustand `gelieferter_teilstand`, Folgejobs 3089/3099/3121/3244): **N11** Confluence-Übernahme intern → JOB 3089 (live 1.0.0-beta.1.107, Ben GRÜN, keine Bestandsmigration). **N11b** Modell-Aktionsinhalte/Egress → JOB 3244 (Runde 2 TEILWEISE; Ben/Live/Word offen). **Q6c** Offline-Suche → JOB 3099 (live 1.110). Telefon-Bibliothek → JOB 3121 (UX-14). **Ohne benannten Job oder Auftrag** in den Quellen: Quellrestriktionen/geänderte Quellversion, serverneustartfeste Persistenz (Wiederanlauf), Word-Kontext, Q3b Alias, Q3c direkte KO-API-Pflicht, ungültiger Altentwurf. Die Quelle sagt nur „bleiben getrennt“. Eine wirksame getrennte Beauftragung ist für diese Punkte **nicht belegt**; das ist ein Quellenbefund und keine Lieferung dieses Auftrags. |

## D · Quellenwidersprüche

- R-1511 nennt JOB 3011; geliefert wurde unter JOB 3027 Station 4 (Commit e296c75d).
- R-0216 „in Prüfung“ gegenüber R-1003 „Konflikt“: Beides gilt in getrennten Dimensionen. Das
  Statuswort bleibt „Konflikt“ (einer der sieben Anzeigezustände), die Nutzbarkeit heißt „In
  Prüfung“.
- R-0216 gegenüber R-0231: R-0231 setzt den Kern bei einem echten Wahrheitswiderspruch auf
  `offen` zurück. R-0216 verlangt trotzdem „in Prüfung“. Die Nutzbarkeit darf deshalb nicht am
  Kernstatus hängen. Das war die Ursache von BEN-07.
- Bekannte Grenze (R-0216): Ein Objekt, dessen Konflikt nur die Konfliktliste der Fläche kennt,
  nicht aber der Serverstatus, wird weiterhin nur aus „nutzbar“ auf „In Prüfung“ begrenzt
  (`lib/conflictImpact.ts`, außerhalb der Zielpfade). Die Lesewege `/api/kos` und `/api/kos/:id`
  liefern den Konflikt seit R-0212 selbst, also tritt diese Lage nur bei einer fehlgeschlagenen
  Konflikterhebung auf (dann ausgewiesen `ungeprueft`).
- R-0208 „Prüfung ausstehend“ und „läuft“: Der gespeicherte Vermerk unterscheidet sie nicht. Die
  Unterscheidung stammt aus dem Speicher des Workers und ist nur am Prüfbrett erhoben. Ohne diese
  Auskunft bleibt der bisherige Satz „läuft“.

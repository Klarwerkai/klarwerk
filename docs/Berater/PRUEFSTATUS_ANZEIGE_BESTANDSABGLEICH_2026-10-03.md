# Prüfstatus-Anzeige · Bestandsabgleich der zugeordneten Kriterien (03.10.2026)

Auftrag `aufnahme:20260922:gesamt-pruefstatus-anzeige`, Lauf 1, Runde 2 (Nacharbeit BEN-02).
Basis: Commit `a60b1f97` plus die Änderungen dieser Runde. Für jedes Kriterium stehen hier der
heutige Stand, die Fundstellen im Produkt, die Testbelege und die konkrete Restarbeit.

**„Belegt am Stand“** heißt: Die Testdatei lief in dieser Runde lokal grün, ohne übersprungene
Fälle (nur jsdom/Node; kein Browser, kein PostgreSQL). Lauf:
`KLARWERK_SKIP_KEYCHAIN=1 KLARWERK_TESTGRUPPE=rest node node_modules/vitest/vitest.mjs run <38 Dateien> --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2`
→ 38 Dateien, 390 Tests, Exit 0. **Schwere Belege** (Browser, PostgreSQL) sind nur benannt und
nicht ausgeführt.

Statuswörter: **geliefert** · **teilweise** (mit genauer Lücke) · **offen**.

## A · Ergänzung 3 (Pedi 28.09.2026) – Arbeitsanleitungen

| Kriterium | Stand | Beleg |
|---|---|---|
| Übersicht und Detail zeigen denselben Status derselben Fassung | geliefert | `zustand.ts` → `freigabeanzeige`, `EntscheidungsVorlage.tsx` → `FreigabeStatus`; `tests/fe001-arbeitsanleitungen/pruefstatus-uebersicht-und-detail.test.tsx` (Teil B) |
| „Vorgelegt“ wird von „freigegeben“ unterschieden | geliefert | dieselbe Datei, Teil A und B (K2) |
| Geprüfte Fassung, prüfende Person und Zeitpunkt; nichts erfunden | teilweise | Bei einer Freigabe stehen Stand und Zeitpunkt da. **Wer** freigegeben oder abgelehnt hat und **wann** abgelehnt wurde, speichert der Server nicht; die Seite sagt das. Restarbeit: Entscheidungsvermerk in Dienst, Route und PostgreSQL (`gesamtanweisung-*.ts`, additive Spalten) – mit PG-Serverbeleg |
| Nächste Handlung nach Recht und Kontoregel | geliefert (Runde 2) | BEN-01 behoben: ohne `ko.create` kein Vorlegen-Knopf, Ändern gesperrt mit Grund; Teil C der Testdatei samt Mutationsgegenprobe |
| Unvorbereitete Testperson erklärt Status und nächsten Schritt | offen | nur durch eine menschliche Probe belegbar; die Frage steht im FE-001-Prüfpaket, Abschnitt 3 |

## B · Ältere Zielzustände

| Kriterium | Stand | Produkt | Test (belegt am Stand) | Lieferung | Restarbeit |
|---|---|---|---|---|---|
| **R-0208** KI-Prüfzustände ohne Freigabe, kein „KI validiert“ | teilweise | `components/AiCheckBadge.tsx:68-136`, `lib/aiCheckStatusCard.ts`, Filter `lib/validationFilters.ts:56`; „KI validiert“ steht nirgends | `tests/validation/ai-check-badge-mounted.test.tsx`, `tests/capture/ai-check-status-card.test.ts` | 7ec75f03 (WP-SUBMIT-ASYNC) | Sichtbar sind nur „läuft“ und „fehlgeschlagen“ (Ursache u. a. „kein Modell“). Es fehlen eigene Zustände für „ausstehend“, „geprüft“, „Konflikt gefunden“, „unsicher“ und „KI nicht verfügbar“ |
| **R-0212** Widerspruch auch über die Schnittstelle und schmal | teilweise | Konfliktmeldung → `markTruthConflictReview` (`ko-routes.ts`) | `tests/validation/conflict-server-trust-impact-e2e.test.ts`, `tests/app/w5-konflikt-mobile-mounted.test.tsx` (nur Ask) | a59fd65e | Der Anzeigestatus von `GET /api/kos` hat für `konflikt` keine Quelle und führt ihn als ungeprüft. Es fehlen zwei Tests: Konflikt am Anzeigestatus der API und Konflikt in Bibliothek/Detail bei schmaler Breite |
| **R-0216** Offener Widerspruch heißt „in Prüfung“ (Detail, Bibliothek, Antworten) | teilweise | `lib/conflictImpact.ts:77`, verwendet in `MehrAbschnitte.tsx`, `lib/askView.ts`, `BibliothekLesen.tsx` | `tests/app/conflict-impact.test.ts`, `tests/validation/conflict-trust-integrity-e2e.test.ts` | 24717150 (SCRUM-357) | Die Nutzbarkeit sinkt auf „in Prüfung“; Statuswort und Pille zeigen aber „Konflikt“. Ob „Konflikt“ dem Kriterium genügt oder das Wort „in Prüfung“ verlangt ist, ist eine Produktentscheidung (Widerspruch zu R-1003, das „Konflikt“ als eigenen Zustand führt) |
| **R-0223** „Ungeprüft“ in Klaras Antwort plus Filter | teilweise | `components/fragen/Quellenplaketten.tsx:94-125`, Zähler `ask.contract.sumOpen` | `tests/app/job2703-ask-trefferliste-und-panel.test.tsx` | 67449c1b (JOB 3267) | Die Kennzeichnung ist da. Ein Filter, der die ungeprüften Treffer herauszieht, fehlt (nur ein Zähler) |
| **R-0224** Geprüftes getrennt von ungeprüfter Ablage | teilweise | Bibliothek-Segment alle/validiert/offen (`bibliothek/zustand.ts:35-55`) | `tests/design/h4-zustand.test.ts` | 556281b8 (JOB 3063) | Getrennt wird nur per Filter; in Antworten gibt es keine getrennte Gruppierung |
| **R-0231** Wahrheitswiderspruch: Status zurück auf offen, Vertrauen sinkt maßvoll | geliefert | `services/knowledge-object/src/service.ts:5458-5476`, Strafe 12, nach unten auf 0 begrenzt | `services/knowledge-object/src/service.test.ts`, `tests/validation/conflict-server-trust-impact-e2e.test.ts` | a59fd65e (SCRUM-358) | – |
| **R-0245 / R-1710** Validiertes sichtbar wieder in Prüfung | geliefert | `display-status.ts:31-47`, `revalidierungAnstehtFuer` (`ko-routes.ts`) | `tests/anzeigestatus-revalidierung/revalidierung-wird-erhoben.test.ts`, `tests/anzeigestatus-web/anzeigestatus-in-der-bibliothek.test.tsx`, `tests/validation/return-and-revalidate.test.ts` | b67bbe5c (JOB 3054) | – |
| **R-0994** Stufenfrage (gefragt, nicht erzwungen), Doppelhinweis auf der Prüfkarte | geliefert | `pages/Validation.tsx`, `lib/validationStufenfrage.ts`, `lib/validationDoppelhinweis.ts` | alle 10 Dateien unter `tests/validierung-stufe/` | 48de61b4 (JOB 3112) | Für „E32/Q3d“ (Bibliotheksort) gibt es keine Fundstelle. Die Quelle nennt ihn „geklärt“, prüfbar ist das hier nicht. Eine aktuelle menschliche Abnahme fehlt |
| **R-1003 / N4** Kern offen/validiert, sieben abgeleitete Anzeigezustände | geliefert, Rest offen | Kern `types.ts:17`; Ableitung `display-status.ts`; Web `lib/displayStatus.ts` (`anzeigestatusAus`) | `tests/anzeigestatus-web/anzeigestatus-quelle.test.ts`, `…-auffrischung.test.tsx`, `tests/anzeigestatus-liste/kos-liste-anzeigestatus.test.ts`, `services/app/src/routes/ko-routes-anzeigestatus.test.ts`, `services/knowledge-object/src/display-status.test.ts` | 530d77db, b0741485, 0e9693f2 | Neun direkte `deriveStatus`-Aufrufer ohne Serverstatus; sie zeigen nur offen oder validiert. Sie sind unten unter R-1570 / R-1595 aufgezählt |
| **R-1511 / R-1603** Prüfer sieht Stufe und Herkunft, fehlende Stufe wird benannt | geliefert | `services/validation/src/board-herkunft.ts:122-135`, `pages/Validation.tsx` | `tests/pruefseite/stufe-und-herkunft-am-brett.test.tsx` | e296c75d (JOB 3027 Station 4) | Quellenwiderspruch: die Quelle nennt JOB 3011, geliefert wurde unter JOB 3027 |
| **R-1707** Statuswechsel pending → review → validated/rejected | geliefert (abgeleitet) | `services/validation/src/trust.ts:25-48`, Zuweisungen in `services/validation/src/service.ts`, `display-status.ts` | `services/validation/src/service.test.ts`, `tests/validation/validation-status.test.ts` | – | „In Prüfung“ wird abgeleitet, nicht gespeichert; das ist so gewollt (R-1003) |
| **N-0054 / UX-27** Prüfwert ohne Wahrheitsversprechen, Belegaktualität getrennt | teilweise → in Runde 2 ergänzt | `components/trust/ConfidenceBar.tsx`, `evidence.*`, `ko.evFresh.*` | alle 5 Dateien unter `tests/ux27-pruefstand/` + neu `ux27-drei-sprachen-kein-wahrheitsversprechen.test.ts` | 0c5afdbe (JOB 3394) | **Runde 2 behoben:** NL sagte noch „{{pct}} % zeker“, jetzt „Beoordelingsstand: … %“. Offen: „Noch nicht fachlich geprüft“ steht nicht direkt am Wert (keine Fundstelle) |
| **N-0078** „Positiv bewerten“ bzw. nötiger Umfang am Knopf; Rückfrage/Bedingt angleichen | teilweise | `pages/Validation.tsx` (Knopf „Freigeben“, Rest nur im Tooltip `val.votesHint`), `BibliothekLesen.tsx` („Bedingt“) | – | – | Beschriftung, sichtbarer Restumfang und Angleichung „Rückfrage“/„Bedingt“ fehlen |

## C · Ältere Reste (Prüfvermerke früherer Läufe)

| Kriterium | Stand | Feststellung |
|---|---|---|
| **R-1503, R-1509, R-1527, R-1543** | nur auf dem Server prüfbar | Das sind Vermerke über nicht wiederholte Gesamt-, PostgreSQL- und Browserläufe früherer Lieferungen, keine Produktanforderungen. Passende schwere Belege: `services/app/src/build-app.integration.test.ts` (PG; deckt nur Registrierung/Anlage/Audit ab), `services/conflicts/src/repo-pg.integration.test.ts`, `tests/konflikt-vermerk-postgres/integrationsfaelle-lesen-alle-vier-felder.test.ts`, `tests/bibliothek-schmal/telefon-chromium.test.ts`, `tests/design/h6-detail-zustandsweg.test.ts`. Für Anzeigestatus/Revalidierung gibt es **keinen** echten PG-Test (`pending-for-pg.test.ts` nutzt einen Fake-Pool). Der Liefercheck `tools/check` läuft am finalen Commit auf Linux |
| **R-1524** `AssignmentRepo.all()` liest alle Zuweisungen | unverändert | `services/validation/src/repo-pg.ts:87-90` (`SELECT data FROM assignments` ohne Bedingung), Aufrufe in `service.ts:501/536/575/616/638`. Funktional korrekt; Optimierung (`listByKo`) ist ein eigener Auftrag |
| **R-1534** Ort von `abfrageMitBestand` | unverändert | `apps/web/src/lib/confidentiality.ts:169`; ein Umzug in die `QueryState`-Schicht ist ein eigener Umbau ohne Nutzerwirkung |
| **R-1554** Kommentar behauptet Garantie des Compilers | **in Runde 2 behoben** | Die Stelle ist nach `services/app/src/routes/ko-routes.ts:864-870` gewandert. Der Kommentar sagt jetzt richtig, dass der Alias die Nutzung nur begrenzt und der Laufzeitfall R-4 den Beleg trägt |
| **R-1570 / R-1595** Serverstatus in Liste/Lesefläche, Wiederholen bei gescheiterter Auffrischung | geliefert, Rest offen | `displayStatus.ts:127-138` (Anker), `BibliothekFlaeche.tsx` (Wiederholen); `tests/anzeigestatus-web/anzeigestatus-auffrischung.test.tsx`, `tests/detail-wiederholweg/listenknopf-holt-den-eintrag.test.tsx`. Offen: die neun übrigen `deriveStatus`-Verbraucher `MehrAbschnitte.tsx`, `AnswerSourceDetails.tsx`, `FindingCard.tsx`, `ko/KoReadView.tsx`, `lib/reviewSignals.ts`, `lib/libraryFacets.ts`, `pages/Stufe2.tsx`, `pages/Mobile.tsx` sowie der Rückfall in `displayStatus.ts`. Echte HTTP-Erholung nur im Browser prüfbar |
| **R-1613** Offline-Auskunft (Q6d), veralteter leerer Cache, Direkt-Wiederholen (Q1c) | geliefert | `tests/q6d-offline-auskunft/veralteter-leerer-cache-mounted.test.tsx`, `tests/q1c-nachladen/mehr-abschnitte-holen-nach.test.tsx` (belegt); Commits f3760f23, 37481cef, b32c0ec5. Die übrigen genannten Themen (Quellrestriktionen, N11b/Egress, Wiederanlauf, Word, Q3b/Q3c) gehören laut Quelle zu getrennten Aufträgen |

## D · Restarbeit (nicht in diesem Lauf gebaut)

Priorität 3 und „keine doppelte Umsetzung“: Die folgenden Punkte sind fachlich klar umrissen, aber
jeweils eigene Oberflächen- oder Serverarbeit:

1. Entscheidungsvermerk der Arbeitsanleitungen (Person, Zeitpunkt, Fassung) – Server und PG.
2. R-0208: sieben sichtbare KI-Prüfzustände in `AiCheckBadge`/Prüfkarte.
3. R-0212: API-Test zum Konflikt am Anzeigestatus (setzt eine Konfliktquelle im Lesepfad voraus)
   und ein Schmal-Test für Bibliothek/Detail.
4. R-0223: Filter „nur ungeprüfte Treffer“ in der Antwort.
5. R-1003/R-1570: die neun direkten `deriveStatus`-Verbraucher auf den Serverstatus umstellen.
6. N-0054: „Noch nicht fachlich geprüft“ direkt am Wert; N-0078: Beschriftung und Restumfang am
   Knopf, „Rückfrage“/„Bedingt“ angleichen.
7. Produktentscheidung zu R-0216 gegenüber R-1003: Wort „in Prüfung“ oder eigener Zustand „Konflikt“.

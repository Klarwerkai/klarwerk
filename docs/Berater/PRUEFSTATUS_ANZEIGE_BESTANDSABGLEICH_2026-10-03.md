# Prüfstatus-Anzeige · Bestandsabgleich der zugeordneten Kriterien (Stand Runde 3)

Auftrag `aufnahme:20260922:gesamt-pruefstatus-anzeige`, Lauf 1. Runde 2 legte den Abgleich an
(Nacharbeit BEN-02), Runde 3 schließt die dort als Restarbeit ausgewiesenen Anforderungen
**innerhalb dieses Auftrags** (Ben R2: BEN-02 bis BEN-06). Je Kriterium stehen hier der Stand,
die Fundstellen im Produkt und die Testbelege.

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
| Geprüfte Fassung, prüfende Person und Zeitpunkt; nichts erfunden | geliefert im vorhandenen Datenstand | Bei einer Freigabe stehen Stand und Zeitpunkt da. Die prüfende Person wird **nicht gespeichert**; die Seite sagt das. Nach Ben R2 wird keine neue Pflichtspeicherung allein aus dem Dokument abgeleitet. |
| Nächste Handlung nach Recht und Kontoregel | geliefert (R2, BEN-01) | Teil C derselben Datei, mit Gegenprobe |
| Unvorbereitete Testperson erklärt Status und nächsten Schritt | menschliche Probe offen | Frage steht im FE-001-Prüfpaket, Abschnitt 3; nur durch einen Menschen belegbar |

## B · Ältere Zielzustände

| Kriterium | Stand | Produkt | Belege | Gegenprobe |
|---|---|---|---|---|
| **R-0208** KI-Prüfzustände ohne Freigabe, kein „KI validiert“ | **geliefert (R3)** | `lib/aiCheckStatusCard.ts` → `kiPruefzustand`. Sieben sichtbare Zustände im `AiCheckBadge` (Prüfseite), je mit `data-ki-pruefzustand`. Prüfbrett (`validation-routes.ts`) leitet beim Lesen `laeuft` (Worker: `laeuft(koId)`) und `konfliktGefunden` ab: offener automatischer Konflikt, dieses Objekt als Subjekt, Gegenseite für den Leser sichtbar. Wird nicht gespeichert. | `pruefstatus-anzeige/ki-pruefzustaende.test.tsx`, `ki-pruefauskunft-brett.test.ts`; angeglichen: `tests/validation/ai-check-badge-mounted.test.tsx`, `ai-check-coverage-visible-mounted.test.tsx` (sie verlangten „done → leer“) | ja (2) |
| **R-0212** Widerspruch hält über Schnittstelle und schmal | **geliefert (R3)** | `ko-routes.ts` → `konfliktJeEintrag`: `GET /api/kos` und `/api/kos/:id` erheben den Konflikt (eine Abfrage, Paarregel `sichtbarePaare`; bei Ausfall benannter Grund) | Test 1: `r0212-konflikt-ueber-schnittstelle.test.ts`; Test 2: `r0212-konflikt-schmal.test.tsx`; angeglichen: `ko-routes-anzeigestatus.test.ts` (D), `kos-liste-anzeigestatus.test.ts` (L2), `revalidierung-wird-erhoben.test.ts` (R-3) | ja (2) |
| **R-0216** Offener Widerspruch erscheint „in Prüfung“ | **geliefert (R3)** | `lib/koOverview.ts`: `konflikt` + validiert → Nutzbarkeit „In Prüfung“ (zuvor nur über die Konfliktliste der Fläche) | `r0216-in-pruefung.test.ts` (Bibliothek, Antworten), `r0216-detail.test.tsx` (Detail) | ja |
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
| **R-1503, R-1509, R-1527, R-1543** | Serverbelege | Vermerke über nicht wiederholte Gesamt-, PostgreSQL- und Browserläufe früherer Lieferungen. Zuständig ist der Liefercheck `tools/check` am finalen Commit; die betroffenen schweren Dateien stehen in der Rückgabe dieser Runde. |
| **R-1524** `AssignmentRepo.all()` liest alle Zuweisungen | **geliefert (R3)** | Neu: `AssignmentRepo.listByKos(ids)` (PG: `WHERE ko_id = ANY($1)`, dieselbe Form wie `ratings.listByKos`). `pruefstandFuer`/`pruefstaendeFuer` lesen gezielt; das Prüfbrett braucht weiter alle offenen und bleibt bei `all()`. Belege: `r1524-zuweisungen-gezielt.test.ts`, angeglichene Zähler in `kos-liste-anzeigestatus.test.ts` und `revalidierung-wird-erhoben.test.ts`, Gegenprobe ja. **Offen:** echter PostgreSQL-Lauf auf dem Prüfserver. |
| **R-1534** Ort von `abfrageMitBestand` | **geliefert (R3)** | `abfrageMitBestand` und `auffrischungGescheitert` stehen jetzt in `lib/abfrageBestand.ts`, fachneutral und unverändert; fünf Importstellen umgestellt. Die Hinweis-Bauform bleibt in `lib/confidentiality.ts`. |
| **R-1554** Kommentar behauptete Garantie des Compilers | geliefert (R2) | `ko-routes.ts`, Kommentar korrigiert |
| **R-1570 / R-1595** Serverstatus, Wiederholen, Listenanker, übrige `deriveStatus`-Verbraucher | **geliefert (R3) bis auf Browserteil** | Aktive Verbraucher: Mobil-Treffer (mit Zustandsanker `mob-treffer-zustand`) und Antwortquellen nehmen den Serverstatus. Alle übrigen Aufrufer nehmen über `deriveStatus` einen mitgelieferten Serverwert an. `FindingCard.tsx` und `ko/KoReadView.tsx` werden im Produkt nicht mehr eingebunden (nur in Tests); sie sind abgegrenzt, nicht entfernt. **Offen:** echte HTTP-Erholung im Browser. |
| **R-1613** Offline-Auskunft, leerer Cache, Direkt-Wiederholen | geliefert | `tests/q6d-offline-auskunft/*`, `tests/q1c-nachladen/*`. Die übrigen genannten Themen gehören laut Quelle zu getrennten Aufträgen. |

## D · Quellenwidersprüche

- R-1511 nennt JOB 3011; geliefert wurde unter JOB 3027 Station 4 (Commit e296c75d).
- R-0216 „in Prüfung“ gegenüber R-1003 „Konflikt“: Beides gilt in getrennten Dimensionen. Das
  Statuswort bleibt „Konflikt“ (einer der sieben Anzeigezustände), die Nutzbarkeit heißt „In
  Prüfung“.
- R-0208 „Prüfung ausstehend“ und „läuft“: Der gespeicherte Vermerk unterscheidet sie nicht. Die
  Unterscheidung stammt aus dem Speicher des Workers und ist nur am Prüfbrett erhoben. Ohne diese
  Auskunft bleibt der bisherige Satz „läuft“.

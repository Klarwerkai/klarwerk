# Änderungen ohne veraltete Suchtreffer nachführen

*Aufnahme 20260922 · gesamt-suchindex-aktualitaet, Revision 1. Basis `0526a3dd`
(`1.0.0-beta.1.767`). Die festgehaltene Fassung dieser Lieferung erzeugt der Starter nach dem Lauf;
bis dahin ist sie hier ausdrücklich offen und wird nicht behauptet.*

## Was jetzt gilt

| Vorgang | Wirkung | Wo |
| --- | --- | --- |
| Überarbeitung (Inhalt, Kategorie, Schlagwörter) | Die Suchprojektion der neuen Fassung entsteht im selben Schreibvorgang; der alte Stand ist sofort weder Bibliothekstreffer noch Klara-Kandidat. Beide Flächen laufen durch `KoService.findSearchHits`. Unverändert aus G27, hier neu gemessen. | `KoService.mutateKoTx` → `persistSearchProjection`; `findActive` (beide Adapter) |
| Zusammenführen (aufgegangener Artikel, `mergedInto`) | **Neu:** kein Suchtreffer und kein Klara-Kandidat mehr; der Inhalt ist nur noch über den Führungsartikel zu finden. Der Artikel bleibt lesbar (R-1107). | `search-projection-repo.ts` (`!ko.mergedInto`), `search-projection-repo-pg.ts` (`K_NICHT_AUFGEGANGEN`) |
| Papierkorb | Kein Treffer, kein Kandidat; Wiederherstellen bringt ihn zurück. Unverändert, hier neu gemessen. | `findActive` (`deletedAt`) |
| Heraufstufung der Vertraulichkeit | Suche und Kandidaten lesen die Stufe an der lebenden `kos`-Zeile; wer sie nicht sehen darf, findet das Objekt ab sofort nicht mehr. Unverändert (JOB 4303, A30 C2). | Sichtbarkeitstrim, `sichtbareFuer` |
| Vektorspeicher des Textprüfungs-Vorfilters (`KLARWERK_DUP_PREFILTER`) | **Neu:** jede gespeicherte Objektänderung reiht über `KoService.setAenderungsNachlauf` einen Eintrag in die Reindex-Warteschlange (JOB 1163) ein. Der Eintrag liest das Objekt frisch: neu einbetten — oder den Vektor entfernen, wenn es heraufgestuft, im Papierkorb, aufgegangen oder Demo ist. Unveränderter Kerntext (Fingerabdruck `stand` am Vektor) kostet keinen Embedder-Aufruf. Abgerufene Vektortreffer prüfen den lebenden Stand (`!mergedInto` in `istPoolKandidat`). | `duplicate-detection.ts` (`reindexKoForDuplicatePrefilter`), `build-app.ts`, `check-text-detection.ts` |
| Dauerhafter Vektorspeicher (Nacharbeit 3) | **Neu:** im Postgres-Betrieb liegen die Vektoren samt Fingerabdruck in `ko_embeddings` (`EMBEDDING_SCHEMA`, angelegt von `migrate()`, im Restore-Drill geprüft) und überleben Neustart und Deploy. Beim Start hält `nachfuehrungNachStart` den Bestand gegen den Speicher und reiht jede unterbrochene Änderung ein. Die Endlöschung räumt die Zeile auch bei abgeschaltetem Vorfilter. | `services/embedding/src/store-pg.ts` (`PgEmbeddingStore`), `buildPgServices`, `duplicate-detection.ts` (`nachfuehrungNachStart`) |
| Heraufstufung, Papierkorb, Zusammenführen (Nacharbeit 3) | **Neu:** der Nachlauf trägt den gespeicherten Stand; darf das Objekt keinen Vektor mehr tragen, löscht `build-app.ts` ihn SOFORT, vorbei an jedem Rückstau der Schlange. Eine laufende Einbettung prüft das Objekt vor und nach dem Schreiben erneut; der Einreicheweg schreibt über `gesicherterVektorspeicher` mit derselben Nachprüfung. | `KoService.setAenderungsNachlauf(koId, stand)`, `build-app.ts`, `duplicate-detection.ts` |
| Klara, stehende Antwort | **Neu, der Auffrischen-Vertrag:** jede gestellte Frage holt neu; eine stehende oder wiederaufgenommene Antwort wird nie von selbst neu erzeugt, aber gegen den frisch geladenen Bestand geprüft. **Nacharbeit 3:** der Quellenstand kommt vom Server (`AskResult.quellenStand`, die gelesenen Fassungen); überholt bei fehlender, aufgegangener oder neuerer Quelle — ein älterer Browserbestand macht nicht überholt. Ohne belastbaren Stand (Altbestand) prüft die Fläche den Verlauf der Quelle seit der Antwort und im Zweifel gilt sie als überholt; statt der Antwort steht dann ein Satz mit „Neu fragen", ohne automatische Modellanfrage. | `services/ask/src/service.ts`, `lib/fragenArbeitsstand.ts` (`quellenStandAus`, `beobachtungAus`, `antwortFrische`), `pages/Ask.tsx`, `texte/fragenseite.ts` |

## Die zugeordneten Anliegen

| Anliegen | Stand vorher | Diese Lieferung | Beleg |
| --- | --- | --- | --- |
| **R-0195** alter Stand verschwindet aus Bibliothek und Klara, Neuindizierung nach jeder Überarbeitung | Suchprojektion seit G27 revisionsgebunden (`tests/ko/w7-suchvertrag.test.ts` A1, nur Trefferweg); Vektorspeicher nur beim Einreichen befüllt | Messung beider Flächen und des HTTP-Wegs; Vektor wird nach jeder Änderung nachgeführt | `tests/suchindex-aktualitaet/verdraengt-nicht-ergaenzt.test.ts` Ü1, Ü2, H1; `…/vektor-nachfuehrung.test.ts` R1 |
| **R-0338** Klara zeigt nach Änderungen den neuen Stand, Auffrischen-Vertrag | Wiederaufgenommene Antworten standen ungeprüft da („nicht neu erzeugt") | Vertrag am Code mit serverseitigem Quellenstand, überholte Antwort wird ersetzt durch Satz + „Neu fragen" | `…/klara-auffrischen-regeln.test.ts` F1–F6, `…/klara-auffrischen-mounted.test.tsx` K1–K6, `…/klara-quellenstand-server.test.ts` Q1–Q2 |
| **R-0470** sofort finden, jede Fläche gleich, Warteschlange, dauerhaft, Neustart, Entfernen bei Heraufstufung | Warteschlange gebaut, aber unverdrahtet; Suchprojektion persistent (PostgreSQL) und neustartfest (G27 R1/R2); Vektorspeicher nur im Prozess | Warteschlange verdrahtet, dauerhafter Vektorspeicher, Nachführung nach dem Start, sofortiges Entfernen bei Heraufstufung | `…/vektor-nachfuehrung.test.ts` N1–N4, R1–R4, Q1, S1–S3, W1; `…/vektorspeicher-pg.integration.test.ts` V1–V3; bestehend `services/app/src/search-projection-startup.test.ts`, `services/app/src/reindex-queue.test.ts`, `tests/app/a30-suchraum-grenze.test.ts` C2 |
| **R-0483** Archiviertes/Ersetztes verdrängt, Vektorspeicher und Suchprojektion geprüft | Papierkorb und alte Fassungen ausgeschlossen; aufgegangene Artikel blieben Treffer und Kandidaten (`dublettenvergleich.md`, Widerspruch 4) | Ausschluss aufgegangener Artikel in beiden Adaptern und im Vektorabruf | `…/verdraengt-nicht-ergaenzt.test.ts` E1, E2; `tests/suchraum-deckel/deckel-paritaet-pg.test.ts` P1 (SQL) |
| **P6** fehlender Beitrag (A30): Einreichen → Bibliothek Schritt für Schritt | Quelle meldet „erledigt 02.09.2026", ohne Testlauf | Unverändert wiederverwendet | `tests/app/a30-suchraum-grenze.test.ts` Teil A/B/C |

## Quellenwidersprüche

1. **R-0470 „sofort finden" gegen „über eine Warteschlange statt sofort im Aufruf".** Beides
   zugleich für denselben Index geht nicht: eine Schlange heisst, dass der neue Stand kurz fehlt.
   Aufgelöst nach der Begründung der Ownerentscheidung J08 („die Antwortzeit leidet nicht"): die
   billige Suchprojektion bleibt im Schreibvorgang (sofort, transaktional, persistent), die teure
   Einbettung läuft über die Schlange.
2. **R-0470 Herkunft („im Produkt existiert weder reindexQueue noch reindex") gegen heute.**
   Die Schlange existiert seit JOB 1163 (`reindex-queue.ts`); sie war nur nicht angeschlossen.
3. **R-1107 „ausgeblendet wird nichts" gegen R-0483.** Die Lesefläche des aufgegangenen Artikels
   blendet weiter nichts aus; ausgeschlossen ist nur Suche, Klara und Vektorabruf.

## Grenzen und fehlende Belege

- **Der dauerhafte Vektorspeicher gilt im Postgres-Betrieb.** Ohne Datenbank (Dev, Tests) bleibt
  es der In-Memory-Speicher, ausdrücklich ohne Neustartzusage. Die Nachbarsuche liest die Vektoren
  einer Version und rechnet im Prozess (kein pgvector-Index); der Aufwand wächst mit dem Bestand.
- **Die Schlange selbst lebt im Speicher.** Was beim Absturz in ihr wartete, holt der Abgleich beim
  Start nach (`nachfuehrungNachStart`).
- **Nachgeführt wird, was im Index steht.** Die Nachführung nimmt kein Objekt neu auf: ob eingebettet
  wird, entscheidet weiter der Einreicheweg; Bulk-Import und Antwortwege betten bewusst nicht ein
  (`tests/library/import-json-zero-model-calls.test.ts`). Folge: ein heraufgestuftes und später
  wieder herabgestuftes Objekt bleibt ohne Vektor, bis es neu eingereicht wird — die Textprüfung
  findet es dann nur über den lexikalischen Weg.
- **Der sofortige Entzug gilt im Prozess, der die Änderung schreibt.** Mehrere App-Prozesse an einer
  Datenbank sind nicht Gegenstand; die Prüfung nach dem Schreiben liest das Objekt aus der
  gemeinsamen Datenbank und deckt damit auch den fremden Schreiber ab, eine prozessübergreifende
  Sperre gibt es nicht.
- **Klara ohne belastbaren Stand:** eine Altantwort gilt bei jedem Verlaufseintrag nach ihrem
  Zeitpunkt als überholt — auch, wenn der Eintrag keine inhaltliche Änderung war. Die sichere
  Richtung („Neu fragen") ist gewollt.
- **Bibliothek ohne Suchbegriff** (Bestandsliste), Prüfbrett und Kennzahlen zeigen aufgegangene
  Artikel weiter (Fachkonzept §2.2, nicht Gegenstand von R-0483).
- **Eine Klara-Wissenslücke** wird nicht gegen später hinzugekommenes Wissen geprüft; der Vertrag
  prüft die Quellen einer Antwort.
- **Nicht in diesem Lauf ausgeführt:** Tests, PostgreSQL, Chromium, menschliche Sichtabnahme,
  Livefassung. Die Tests liefert der Prüfweg.

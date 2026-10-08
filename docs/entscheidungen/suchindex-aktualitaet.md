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
| Vektorspeicher des Textprüfungs-Vorfilters (`KLARWERK_DUP_PREFILTER`) | **Neu:** jede gespeicherte Objektänderung reiht über `KoService.setAenderungsNachlauf` einen Eintrag in die Reindex-Warteschlange (JOB 1163) ein. Der Eintrag liest das Objekt frisch: neu einbetten — oder den Vektor entfernen, wenn es heraufgestuft, im Papierkorb, aufgegangen oder Demo ist. Unveränderter Kerntext kostet keinen Embedder-Aufruf. Abgerufene Vektortreffer prüfen den lebenden Stand (`!mergedInto` in `istPoolKandidat`). | `duplicate-detection.ts` (`reindexKoForDuplicatePrefilter`), `build-app.ts`, `check-text-detection.ts` |
| Klara, stehende Antwort | **Neu, der Auffrischen-Vertrag:** jede gestellte Frage holt neu; eine stehende oder wiederaufgenommene Antwort wird nie von selbst neu erzeugt, aber gegen den frisch geladenen Bestand geprüft. Trägt eine ihrer Quellen eine andere Fassung, fehlt sie oder ist sie aufgegangen, steht statt der Antwort ein Satz mit „Neu fragen". Ohne bekannten Quellenstand (Altbestand) bleibt sie wie bisher mit Zeitpunkt stehen. | `lib/fragenArbeitsstand.ts` (`quellenStandAus`, `antwortFrische`), `pages/Ask.tsx`, `texte/fragenseite.ts` |

## Die zugeordneten Anliegen

| Anliegen | Stand vorher | Diese Lieferung | Beleg |
| --- | --- | --- | --- |
| **R-0195** alter Stand verschwindet aus Bibliothek und Klara, Neuindizierung nach jeder Überarbeitung | Suchprojektion seit G27 revisionsgebunden (`tests/ko/w7-suchvertrag.test.ts` A1, nur Trefferweg); Vektorspeicher nur beim Einreichen befüllt | Messung beider Flächen und des HTTP-Wegs; Vektor wird nach jeder Änderung nachgeführt | `tests/suchindex-aktualitaet/verdraengt-nicht-ergaenzt.test.ts` Ü1, Ü2, H1; `…/vektor-nachfuehrung.test.ts` R1 |
| **R-0338** Klara zeigt nach Änderungen den neuen Stand, Auffrischen-Vertrag | Wiederaufgenommene Antworten standen ungeprüft da („nicht neu erzeugt") | Vertrag am Code, überholte Antwort wird ersetzt durch Satz + „Neu fragen" | `…/klara-auffrischen-regeln.test.ts` F1–F4, `…/klara-auffrischen-mounted.test.tsx` K1–K4 |
| **R-0470** sofort finden, jede Fläche gleich, Warteschlange, Neustart, Entfernen bei Heraufstufung | Warteschlange gebaut, aber unverdrahtet; Suchprojektion persistent (PostgreSQL) und neustartfest (G27 R1/R2) | Warteschlange verdrahtet (Vektorseite), Entfernen bei Heraufstufung | `…/vektor-nachfuehrung.test.ts` N1–N3, R2, Q1; bestehend `services/app/src/search-projection-startup.test.ts`, `services/app/src/reindex-queue.test.ts`, `tests/app/a30-suchraum-grenze.test.ts` C2 |
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

- **Der Vektorspeicher überlebt keinen Neustart.** Er ist weiterhin der In-Memory-Speicher hinter
  einem standardmässig abgeschalteten Schalter; nach einem Neustart ist er leer (dann ohne veraltete
  Einträge, die Prüfung fällt auf den lexikalischen Weg zurück). Ein dauerhafter Vektorspeicher
  (pgvector) ist nicht gebaut — der neustartfeste Index für Bibliothek und Klara ist die
  Suchprojektion.
- **Die Schlange lebt im Speicher** (Neustart-Grenze in `reindex-queue.ts` unverändert).
- **Bibliothek ohne Suchbegriff** (Bestandsliste), Prüfbrett und Kennzahlen zeigen aufgegangene
  Artikel weiter (Fachkonzept §2.2, nicht Gegenstand von R-0483).
- **Eine Klara-Wissenslücke** wird nicht gegen später hinzugekommenes Wissen geprüft; der Vertrag
  prüft die Quellen einer Antwort.
- **Nicht in diesem Lauf ausgeführt:** Tests, PostgreSQL, Chromium, menschliche Sichtabnahme,
  Livefassung. Die Tests liefert der Prüfweg.

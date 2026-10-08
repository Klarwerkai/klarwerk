# Dubletten mit Belegen vergleichen und bewusst zusammenführen

*Aufnahme 20260922 · gesamt-dublettenvergleich, Revision 1. Basis `1326f4fd`
(`1.0.0-beta.1.737`). Die festgehaltene Fassung dieser Lieferung erzeugt der Starter nach dem Lauf;
bis dahin ist sie hier ausdrücklich offen und wird nicht behauptet.*

## Was jetzt gilt

| Vorgang | Wirkung | Wo |
| --- | --- | --- |
| Dublettenfläche, Karte je Seite | Quelle (klickbar), Quelldatum und Konfidenz stehen **auf** der Karte, ohne Aufklappen. Ohne Quelle: „keine Quelle · kein Quelldatum", kein Ersatzdatum. | `Duplicates.tsx` (`beleg`), `PruefenPaar.tsx` (`beleg`-Platz), Baustein `ko/SourceEvidence` |
| Satz zur Beweislage | Nur wenn beide Seiten für den Betrachter freigegeben sind (Befund nicht redigiert) und keine oder genau eine Seite belegt ist; sonst schweigt er. Er steht wie an der Konfliktfläche im „Mehr" der Karte. | `Duplicates.tsx` (`beweislage`), Regel `conflictEvidenceBalance` (`lib/conflictView.ts`) |
| „···" → „Zusammenführen …" | Öffnet den Assistenten `/duplikate/:id/zusammenfuehren`. Das Aktionsband behält seine vier Entscheidungen; dort wird weiterhin nichts zusammengeführt. | `Duplicates.tsx`, `app/navigation.ts` (`duplicateMerge`, ab Controller), `routes.tsx` |
| Assistent, vier Schritte | 1 Führungsartikel wählen (Vorschlag mit Begründung: geprüft vor ungeprüft, sonst der umfassendere laut Erkennung, sonst der ältere; umkehrbar) · 2 Eigenanteile übernehmen: Titel und Kernaussage je von einer Seite, Bedingungen und Maßnahmen Position für Position, je Feld „stimmt überein / weicht ab / unsicher — nur eine Seite" · 3 Quellen des anderen Artikels mitnehmen (Vorgabe: alle an; die eigenen bleiben immer) · 4 Vorschau (was entsteht, was bleibt, was nicht übernommen wird) und ausdrückliche Bestätigung, erst dann „Zusammenführen freigeben". Bis dahin wird nichts geschrieben. | `pages/DuplicateMerge.tsx`, Logik DOM-frei in `lib/dublettenZusammenfuehrung.ts`, Texte `texte/dublettenvergleich.ts` |
| `POST /api/duplicates/:id/merge` | Tor `ko.validate`; dahinter: kein Autor einer der beiden Seiten (auch nicht Controller/Admin), Inhalt beider Seiten lesbar (`feldFreigabe`), derselbe Space, unveränderte Fassungen, nur Werte beider Seiten, `bestaetigt: true`. Dann: (1) neue Fassung des Führungsartikels über `KoService.revise` — **ungeprüft** (Status „offen", Vertrauen 0), Beleg `ko.merge-received`; (2) `mergedInto` am anderen Artikel (`KoService.markMergedInto`), Beleg `ko.merged-into` — Text, Quellen, Anhänge, Kommentare und Historie bleiben; (3) Befund `geschlossen (merged)` mit Führungsartikel und Fassung, Beleg `overlap.merge-completed`; weitere offene Befunde des aufgegangenen Artikels schliessen als `superseded`; (4) Nachlauf wie bei jeder neuen Fassung (Revisions-Sweep, KI-Prüfung). | `services/app/src/dubletten-zusammenfuehrung.ts`, `routes/overlap-routes.ts`, `OverlapService.closeAsMerged`, `KoService.markMergedInto` |
| Aufgegangener Artikel | Bleibt dauerhaft lesbar; über seiner Lesefläche steht „am … in „X" aufgegangen" mit Verweis auf den verbleibenden Artikel. Die Dublettenerkennung nimmt ihn weder als Subjekt noch als Kandidaten. | `components/AufgegangenHinweis.tsx` (in `KnowledgeDetail.tsx`), `duplicate-detection.ts` |

**Nacharbeit 2 (Bens Befunde zu R-0201):**

- *Fließtext sichtbar.* Die Wahl der Kernaussage übernimmt am Server auch den Fließtext dieser
  Seite. Der Assistent zeigt deshalb am Kernaussagenfeld den Fließtext beider Seiten, seine Lage
  und den ausdrücklichen Satz zur Kopplung; die Vorschau zeigt den Fließtext, der tatsächlich
  entsteht (auch „leer"), und nennt unter „nicht übernommen", wenn der bisherige Fließtext des
  Führungsartikels ersetzt wird (`lib/dublettenZusammenfuehrung.ts`: `vorschau().fliesstext`,
  `fliesstextLage`; `DuplicateMerge.tsx`).
- *Freigabe an die gesehenen Fassungen gebunden.* Der Assistent hält die beiden Objekte fest,
  mit denen er begonnen hat; Vergleich, Vorschau und Auftrag lesen nur diesen Stand, der Auftrag
  trägt also die gesehenen Fassungen (eine inzwischen geänderte Seite beantwortet der Server mit
  409). Kommt eine neue Fassung an, fällt die Bestätigung, Haken und Freigabe sind gesperrt, und
  ein Hinweis bietet „Neuen Stand übernehmen und neu prüfen" an — das beginnt wieder bei Schritt 1
  (`fassungGeaendert`).
- Belege: `tests/dublettenvergleich/assistent-logik.test.ts` (Nacharbeit-2-Blöcke),
  `tests/dublettenvergleich/flaeche-und-assistent-mounted.test.tsx` (A3, A4).

## Die zugeordneten Anliegen — Stand vorher, diese Lieferung, Beleg

| Anliegen | Stand vor dieser Lieferung | Diese Lieferung | Beleg |
| --- | --- | --- | --- |
| **R-0201** Vergleich nebeneinander, je Bereich übereinstimmend/abweichend/unsicher; Feld für Feld, Vorschau, Freigabe; nichts geht verloren; erster sicherer Schnitt nur Anzeige | Erster Schnitt vorhanden: die Nur-Lese-Vergleichsseite `/duplikate/:id/vergleich` (KW-DUP-02, seit JOB 3061 unter dem Prüfen-Kopf) mit Abschnittsampeln; sie schreibt nichts (`DUPLICATE_COMPARE_SAFETY`). Feldentscheid, Vorschau und Freigabe fehlten. | Unverändert wiederverwendet: die Vergleichsseite. Neu: Feldentscheid, Vorschau, Freigabe im Assistenten; serverseitig nur Werte beider Seiten, Vorfassung und aufgegangener Artikel bleiben. | `tests/dublettenvergleich/assistent-logik.test.ts`, `…/flaeche-und-assistent-mounted.test.tsx` (A1, A2), `…/zusammenfuehren-route.test.ts` (Z1–Z4); bestehend `tests/duplicates/duplicate-compare.test.ts`, `compare-legend.test.ts` |
| **R-0261** Quelle, Quelldatum, Konfidenz je Seite sofort sichtbar; Satz zur Beweislage nur in freigegebenen Fällen | Nicht vorhanden; die Konfliktfläche führte Beleg und Beweislage seit JOB 3061 im „Mehr". | Beleg je Seite auf der Karte; Beweislage nach derselben Regel wie an der Konfliktfläche, nur ohne Redaktion, im „Mehr". | `flaeche-und-assistent-mounted.test.tsx` (B1–B4) |
| **R-0565** Kein Autor führt seine eigene Seite zusammen; Zusammenführen bleibt kuratorisch | Entscheidung JOB 1546 (21.08.): „jeder Paar-Abschluss bleibt kuratorisch"; es gab gar keinen Zusammenführen-Weg. | Regel am Server (403, auch für Controller/Admin als Autor) und erklärt am Assistenten. | `zusammenfuehren-route.test.ts` (K1, K2), `assistent-logik.test.ts` (R-0565), `…-mounted.test.tsx` (K1), Rollenzeile `tests/beta-rollenabnahme/schreibende-tueren.ts` (`/merge`, fünf Akteure, Zielzustand nachgelesen) |
| **R-1107** Vierschrittiger Assistent, neue normal geprüfte Fassung, aufgegangener Artikel lesbar mit Verweis, kein Ein-Klick | Konzept (BERATER_KONZEPT_DUPLIKATE §5.2), kein Code; `merged` nur als Typwert. | Gebaut wie oben. | `zusammenfuehren-route.test.ts` (Z1 inkl. geprüftem Führungsartikel → danach „offen", Vorfassung als Schnappschuss, drei Belege; Z2 ohne Freigabe nichts geschrieben; N1 keine erneute Dublette), `…-mounted.test.tsx` (A1, H1, H2) |
| **R-1122** (Nichtziel) Dubletten nicht als sechste Konfliktart | Eigene Seite seit 04.07. | Unverändert: eigene Seite, eigene Route, Konfliktmodell nicht angefasst. | Quelleninspektion: keine Datei unter `services/conflicts/src/types.ts`/`service.ts` geändert |
| **N-0083** Metriken eindeutig benennen | Geliefert in JOB 3469 (REVIEW26): Pille und Vergleichsseite nennen ihre Metrik, Brückensatz bei verschiedenen Metriken. | Nicht neu gebaut; der Assistent zeigt keine Prozentzahl und führt keine dritte Metrik ein. | bestehend `tests/review26-duplikat-prozente/gleiche-zahl-gleicher-name.test.ts`, `…/flaechen-benennen-die-metrik-mounted.test.tsx` |

## Abgrenzung: bestehende, gesonderte Aufträge und Lieferungen

- **gesamt-dubletten-rueckzug** (`docs/entscheidungen/dubletten-rueckzug.md`): Rückzug der eigenen
  Seite und Wiederherstellen bleiben unverändert. Der Satz dort „Zusammenführen … ist nicht gebaut
  und wird es durch diesen Auftrag auch nicht" gilt für jenen Auftrag; das Zusammenführen ist hier
  gebaut — kuratorisch, wie dort begründet, und ohne dass ein Weg dieses Auftrags die Autorin ihre
  Gegenseite schreiben lässt.
- **JOB 1546 / A28**: das dauerhafte Signal am eigenen Objekt bleibt unverändert; `OF-1546-1`
  (fremdes Objekt dupliziert meines) bleibt gesperrt.
- **JOB 3469** (N-0083) und **JOB 3061** (Prüfen-Kopf, vier Knöpfe) werden wiederverwendet, nicht
  umgebaut; das Aktionsband bietet weiter genau vier Entscheidungen.
- **R-1122**: kein Umbau am Konfliktmodell.

## Quellenwidersprüche

1. **R-0201, Stand des ersten Schnitts.** Die Auftragsplanung führt KW-DUP-02 „im Eingang ohne
   Einbaubeleg", das Relay-Archiv mit Abnahmepaket und Live-Check (Quelle selbst nennt den
   Widerspruch). Heute im Code: die Vergleichsseite existiert und ist nur lesend — wiederverwendet.
2. **R-0261 „ohne Aufklappen" gegen „so wie es die Konfliktfläche bereits kann".** Als die Quelle
   entstand (05.08.), zeigte die Konfliktkarte den Beleg offen; seit JOB 3061 (04.09.) steht er dort
   im „Mehr", und die Fläche darf höchstens 80 Zeichen Erklärtext zeigen. Gebaut: Beleg offen auf
   der Karte (er ist Angabe, `data-text="meta"`), Beweislagensatz im „Mehr" wie an der Konfliktfläche.
3. **R-0565 Status „VERWORFEN" gegen „Zielzustand".** Verworfen ist die Gegenvariante (Autor führt
   zusammen); umgesetzt ist deren Entscheidung „bleibt kuratorisch". Die vertagte Gegenvariante
   (neues Recht plus Einsicht in die Gegenseite) bleibt bei Pedi.
4. **Fachkonzept §2.2 gegen R-1107.** Das Konzept will aufgegangene Artikel zusätzlich aus
   Bibliothek-Standardsicht, Fragen-Retrieval, Prüfbrett und Kennzahlen ausblenden (`isRetired`).
   R-1107 verlangt das nicht; gebaut ist nur der Ausschluss aus der Dublettenerkennung. Der
   aufgegangene Artikel erscheint deshalb weiter in Bibliothek und Fragen — mit Hinweis auf seiner
   Lesefläche. Offen, nicht stillschweigend erledigt.

## Grenzen und fehlende Belege

- **Keine gemeinsame Transaktion über die drei Schreibschritte.** Jeder Schritt ist mit seinem
  Beleg atomar; alles fachlich Prüfbare (Rechte, Fassungen, Stand, Eingaben) wird vorher geprüft.
  Bricht danach die Infrastruktur ab, kann eine neue Fassung am Führungsartikel ohne Verweis am
  anderen Artikel stehen bleiben — verloren geht nichts.
- **Vertrauliche Paare** lassen sich nicht zusammenführen: der Inhalt einer vertraulichen Seite ist
  nur ihrem Autor freigegeben, und der darf nicht zusammenführen. Fail-closed, keine Rechteänderung.
- **Nicht mitgenommen:** Anhänge und Kommentare des aufgegangenen Artikels (sie bleiben dort
  lesbar), Schlagwörter und Kategorie (bleiben die des Führungsartikels). Kein „In Bearbeitung"
  beim Öffnen des Assistenten, keine Konflikt-zuerst-Warnung, keine Benachrichtigung der Autoren
  (Fachkonzept §5.2/§5.3/§6, von den Originalkriterien nicht verlangt).
- **Nicht in diesem Lauf ausgeführt:** PostgreSQL, Chromium, menschliche Sichtabnahme, Livefassung.
  Die Tests liefert der Prüfweg; der Lieferbeleg mit Fassung entsteht erst nach Veröffentlichung.
- **Formatierung** (Biome) wurde in diesem Lauf nicht maschinell geprüft.

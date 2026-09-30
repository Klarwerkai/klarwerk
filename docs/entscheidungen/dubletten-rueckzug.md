# Die eigene Seite eines Dublettenbefunds zurückziehen und wiederherstellen

*Aufnahme 20260922 · gesamt-dubletten-rueckzug. **Lauf 5** (Aufgabenrevision 16, Runde 1 auf Basis
`1.0.0-beta.1.636`, Commit `bf9fcf1c`): übernimmt den Stand von Lauf 4 (letzte Fassung `9356241d`,
Ausgang „Nacharbeitsgrenze“, nie auf `main`) unverändert und behebt Bens verbliebenen Befund
BEN-R4-1 (Abschlussfehler UND gescheiterter Widerruf, s. „Nacharbeit Lauf 5“); Runde 2 behebt
BEN-R5-1 (ungewisse Bestätigung bei gescheitertem Zurücklesen und Widerruf). **Lauf 4** (Aufgabenrevision 14, Runde 1 auf Basis
`1.0.0-beta.1.635`, Commit `5e44e7e6`): übernimmt den Stand von Lauf 3 (letzte Fassung `ffacfd5a`,
nie auf `main`) unverändert und behebt Bens verbliebenen Befund BEN-R3-2 (Teilschreiben im Journal,
s. „Atomar“ und „Nacharbeit Lauf 4“; Runde 2 behebt Bens erneuten BEN-R3-2: ENOSPC vor dem
Zeilenende; Runde 3 behebt BEN-R4-1: Fehler nach vollständiger Zeile). **Lauf 3** (Aufgabenrevision 11, Runde 1 auf Basis
`1.0.0-beta.1.628`, Commit `1530dfeb`, festgehalten als `6323136e`; Runde 2 (`1b11959c`) behebt Bens BEN-R3-1:
Atomarität auch ohne Datenbank; Runde 3 behebt BEN-R3-2/-3: Journal-Abschluss als eine Zeile,
Isolation gegen unabhängige Schreiber). Lauf 1 (letzte Fassung `0a7c82b7`) und Lauf 2 (`988b9392`)
sind nie auf `main` gekommen; Lauf 3 übernimmt deren Stand und nimmt die Wiederöffnung beim
Wiederherstellen heraus — nach **Pedis Entscheidung `entscheidung:43017d60`**: das Wiederherstellen
stellt nur den eigenen Beitrag fehlerfrei wieder her; ein durch Rückzug geschlossener Befund wird
NICHT wieder geöffnet (die Wiederöffnung ist abgegrenzt und wird später gesondert entschieden).
Gilt für den Überschneidungsbefund (`services/conflicts`, `OverlapEntry`), den weichen Löschweg und
das Wiederherstellen im Wissensobjekt-Dienst (`KoService.delete`/`restore`), den Detail-Lesepfad
`GET /api/duplicates/:id` und die Lesefläche der Bibliothek.*

## Die feste Grenze (R-0259, Entscheidung JOB 1546 vom 21.08.)

Die Autorin darf **ihre eigene Seite** zurückziehen. **Zusammenführen** entscheidet über die
Gegenseite, ist im ganzen Bestand kuratorisch und wäre die Rechteänderung, die §3 ausschliesst — es
ist **nicht gebaut** und wird es durch diesen Auftrag auch nicht. Wer es dennoch will, braucht Pedi.
Kein Weg dieses Auftrags schreibt ein Feld der Gegenseite. Die Rechte am Wiederherstellen sind
unverändert (`POST /api/kos/:id/restore` verlangt weiter `users.manage`).

## Was jetzt gilt

| Vorgang | Wirkung | Wo |
| --- | --- | --- |
| Autorin legt ihren Eintrag in den Papierkorb (`DELETE /api/kos/:id`, oder der Knopf am eigenen Dublettenhinweis) | Alle offenen Befunde dieses Eintrags schliessen als `withdrawn_own` mit ihrer Kennung (`resolution.by`), Beleg `overlap.withdrawn-own` je Befund; offene Konflikte wie bisher systemisch. Der Beleg `ko.deleted` nennt die Zahl geschlossener Befunde. Die Gegenseite wird nicht geschrieben. | `KoService.delete` → `imRuecknahmeVorgang` → Haken `setRuecknahmeTxCleanup` (build-app.ts) |
| Jemand anderes (Controller/Admin) löscht | Wie bisher `participant_deleted`, `by: null` | dieselbe Stelle, Prädikat `ko.author === actor` |
| Admin stellt den Eintrag wieder her (`POST /api/kos/:id/restore`) | NUR der eigene Beitrag kommt zurück (`deletedAt`/`deletedBy` entfernt), Beleg `ko.restored`. Der Überschneidungsspeicher wird weder gelesen noch geschrieben: jeder Befund bleibt zeichengleich, wie er war (geschlossen mit Grund, Urheber, Zeit); kein `overlap.withdrawal-reverted`. Konflikte werden ebenfalls nicht wieder geöffnet. Die Gegenseite wird nicht angefasst. | `KoService.restore` → `imRuecknahmeVorgang` (derselbe benannte Weg, ohne Aufräumbeitrag) |
| `GET /api/duplicates/:id` nach dem eigenen Rückzug | Nachweis `{ id, status, resolution: { reason, by, at } }` für jeden, der **beide** Seiten sehen darf (`darfSehen`, die zurückgezogene Seite über den Papierkorb aufgelöst); sonst dasselbe 404 wie für eine unbekannte Kennung. Nach Endlöschung einer Seite nur noch für die Abschliessende (JOB 3450). Nach dem Wiederherstellen liegen die Seiten wieder im Bestand; wer das Paar sehen darf, liest den geschlossenen Befund über den gewöhnlichen, redigierten Lesepfad. | `overlap-routes.ts`, `paarSichtbarMitPapierkorb` (sichtbarkeit.ts), `KoService.papierkorbFakten` |
| Lesefläche, eigener Eintrag mit offener Dublette | In der Kollisionszeile steht „Eigene Seite zurückziehen“. Er öffnet dieselbe Rückfrage wie „Wissensobjekt löschen“ (ein Aufruf `endpoints.ko.remove`), mit einem Satz über Befund und Gegenseite. | `BibliothekLesen.tsx`, Texte `apps/web/src/texte/rueckzug.ts` |

**Atomar:** beim Rückzug laufen Aufräumen, Schreiben des Beitrags und sein Beleg, beim
Wiederherstellen Schreiben des Beitrags und sein Beleg in EINER Klammer. Scheitert ein Schritt, ist
nichts geschehen und der Aufrufer bekommt einen Fehler statt 204/200.

- **Mit Datenbank:** die Klammer ist `withPgTx` (eine Transaktion auf demselben Client).
- **Ohne Datenbank (InMemory, Dev-Journal der Desktop-App)** — seit Runde 2 (Bens BEN-R3-1): die
  Rücknahme-Klammer der Kompositionswurzel (`services/app/src/speicher-vorgang.ts`, verdrahtet in
  `assembleServices` als `KoServiceDeps.ruecknahmeKlammer`). Jede Schreibmethode, die im Körper mit
  dem Kontext des Vorgangs gerufen wird (`koRepo.update`, `overlapRepo`/`conflictsRepo.closeOpenForKo`,
  `auditRepo.append`/`appendOnce`), hinterlegt ihr Vorher-Abbild; wirft der Körper, werden alle
  Schritte in umgekehrter Reihenfolge exakt zurückgestellt (`zuruecksetzen` an den Speicher-Ablagen,
  `verwerfen` des letzten Belegs). Eine andere Schreibmethode mit Vorgangskontext wird abgewiesen
  (fail-closed).
- **Journal (Runde 3, BEN-R3-2):** das Dev-Journal hält die Zeilen des Vorgangs zurück und schreibt
  sie beim Abschluss in EINEM Schreibaufruf als eine Vorgangszeile (`VORGANG_ZEILE` in
  `dev-persist.ts`); `replayJournal` wendet sie nur als Ganzes an. Wirft dieser Schreibaufruf, stellt
  die Klammer den Speicher zurück, und der Vorgang wirkt auch beim Replay nicht — belegt für Rückzug
  und Wiederherstellen in `atomar-ohne-datenbank.test.ts` („BEN-R3-2“), live und nach Replay.
- **Teilschreiben und ungewisser Abschluss (Lauf 4, BEN-R3-2 und BEN-R4-1):** drei Regeln in
  `dev-persist.ts`. Ein gescheiterter Abschluss hat einen UNGEWISSEN Ausgang — der Schreibaufruf kann
  nichts, einen Anfang, alles ausser dem Zeilenende oder die ganze Zeile samt Zeilenende geschrieben
  haben (z. B. EIO beim Schliessen der Datei). Die Klammer hat in jedem Fall zurückgestellt und dem
  Aufrufer den Fehler gemeldet; die Regeln sorgen dafür, dass das Journal dazu passt.
  1. **Bestätigt ist eine Zeile erst mit ihrem Zeilenende** (Runde 2). Was nach dem letzten
     Zeilenende steht, liest `readJournalLines` nie — auch nicht, wenn es gültiges JSON ist.
     `buildDevPersistServices` ergänzt einem solchen Rest kein Zeilenende.
  2. **Neuaufsatz** (Runde 1): nach jedem gescheiterten Schreibaufruf — und beim Start, wenn die
     Datei ohne Zeilenende endet — geht der nächsten Zeile `{"repo":"journal","method":"neuaufsatz","args":[]}`
     voraus (`mitNeuaufsatz`). Er schliesst einen Rest zu einer Zeile ab, die `readJournalLines`
     überspringt; jede andere ungültige Zeile beendet das Einlesen wie bisher.
  3. **Bestätigung** (Lauf 5, ersetzt den tragenden Widerruf aus Lauf 4 Runde 3): der Abschluss
     schreibt zwei Zeilen — die Vorgangszeile mit Kennung (`vorgang`), danach
     `{"repo":"ruecknahmeVorgang","method":"bestaetigung","args":[<Kennung>]}` (`mitBestaetigung`).
     `replayJournal` wendet eine Vorgangszeile nur an, wenn ihre Bestätigung steht und kein
     Widerruf `{"repo":"journal","method":"widerruf","args":[<Kennung>]}` sie aufhebt. Der Abschluss
     wirft genau dann, wenn der Vorgang nach Replay NICHT wirkt (dann stellt die Klammer zurück):
     - **Vorgangszeile scheitert** (gleich, wie viel von ihr steht): keine Bestätigung → wirkt nie.
       Es muss danach nichts mehr geschrieben werden; ein Widerruf wird versucht, ist aber nicht
       tragend. Das ist Bens Fall BEN-R4-1.
     - **Bestätigung scheitert:** der Ausgang wird durch Zurücklesen geklärt (`bestaetigungInDatei`,
       dieselbe Lesung UND dieselbe Wirksamkeitsregel `wirksamIn` wie Replay und Neustart — seit
       Runde 3: Bestätigung steht und kein Widerruf). Wirkt der Vorgang laut Datei, gilt er — der Aufruf
       kehrt OHNE Fehler zurück, der Speicher bleibt. Steht sie nicht (auch halb oder ohne
       Zeilenende), wirkt der Vorgang nie → Fehler. Ist das Zurücklesen nicht möglich, wird
       widerrufen; gelingt das, wirkt der Vorgang nie → Fehler.
     - **Ungewiss** (Runde 2, BEN-R5-1): scheitern Bestätigung, Zurücklesen UND Widerruf, kann der
       Prozess nicht wissen, ob die Bestätigung in der Datei steht — eine vollständig geschriebene
       Zeile mit Fehler danach und eine gar nicht geschriebene melden ihm dasselbe. Der Aufrufer
       bekommt dann `JournalAusgangUngewiss` (Code `JOURNAL_AUSGANG_UNGEWISS`), ausdrücklich KEIN
       „zurückgestellt“. Bis der Ausgang an der Datei geklärt ist, weisen die Ablagen dieses Journals
       jeden Aufruf — lesend wie schreibend — mit demselben Fehler ab; jeder Aufruf versucht die
       Klärung erneut (Zurücklesen, sonst Widerruf). Wirkt der Vorgang laut Datei (`wirksamIn`:
       Bestätigung steht, KEIN Widerruf — auch keiner, der trotz Schreibfehler vollständig
       gespeichert wurde, Runde 3, BEN-R5-2), trägt die Instanz seine Zeilen in ihren Speicher nach;
       wirkt er nicht oder gelingt jetzt der Widerruf, bleibt der zurückgestellte Speicher. Ein
       Neustart liest ohnehin die Datei. Über die Dienste liefert die Instanz so nach der Klärung
       denselben Stand wie Replay und Neustart (belegt für: Widerruf ohne Schreibwirkung, Widerruf
       erfolgreich, Widerruf vollständig gespeichert trotz EIO), davor gar keinen.
       Am Draht (Runde 3, BEN-R5-3): `sendError` bildet den Code auf **HTTP 503** ab (`STATUS_BY_CODE`
       in `http.ts`), mit einem festen Satz ohne Datenträgerursache, Pfad oder Vorgangskennung; die
       Ursache steht nur in `cause`.

  Belegt in `journal-teilschreiben.test.ts` (31 Fälle, echte Datei; ENOSPC nach halber Zeile, nach
  der ganzen Zeile ohne Zeilenende, ohne Schreibwirkung, EIO nach der ganzen Zeile samt Zeilenende):
  Rückzug und Wiederherstellen sind nach dem Fehler live, nach Replay und nach einem Neustart über
  `buildDevPersistServices` wie vorher; die erfolgreiche Wiederholung ist live = nach Replay (kein
  STALE_WRITE); Gegenseite unberührt; Befund nach Wiederherstellen unverändert zu; ungewisse
  Bestätigung ohne Zurücklesen und ohne schreibbaren Widerruf → Zustand „ungewiss“ (Runde 2).

  Lauf 5 belegt dazu in `journal-teilschreiben.test.ts` „BEN-R4-1 (Lauf 5)“ (12 Fälle seit Runde 2, echte
  Datei, je Rückzug und Wiederherstellen): Speicher, Replay, Neustart über
  `buildDevPersistServices` und Aufrufergebnis stimmen überein — geprüft unmittelbar nach dem
  Fehler, VOR jeder weiteren Schreibung.

  **Ungewisser Ausgang (Runde 2, BEN-R5-1):** die in Runde 1 hier dokumentierte Restgrenze ist
  keine Grenze mehr, sondern der Zustand „ungewiss“ oben. Was bleibt, ist grundsätzlich und kein
  Restfehler: solange Datenträger weder lesbar noch beschreibbar sind, kann KEIN Prozess den Ausgang
  kennen (Beleg „Unmöglichkeit“: zwei Dateien, gleiche Rückmeldungen, entgegengesetzter Inhalt). Die
  Lieferung antwortet darauf, indem sie in dieser Lage keinen Stand ausliefert und „ungewiss“ statt
  „gescheitert“ meldet — wie PostgreSQL bei einem Verbindungsabbruch während COMMIT. Die rohen
  InMemory-Ablagen UNTER der Journal-Schicht sind in dieser Lage zurückgestellt; sie sind kein
  Auslieferungsweg. Nicht mit Prozessabbruch geprüft. Für Schreibungen AUSSERHALB eines Rücknahme-Vorgangs gilt dabei der
  Bestand: ihre Änderung ist im Speicher schon geschehen, wenn die Journalzeile abgewiesen wird —
  der Aufrufer bekommt den Fehler, die Änderung fehlt nach dem nächsten Start (unverändertes
  Verhalten jeder gescheiterten Einzelzeile, nicht Teil dieses Auftrags).
- **Isolation (Runde 3, BEN-R3-3):** die Klammer hält für die Dauer des Vorgangs eine Sperre. Unter
  derselben Sperre schreibt der Audit-Dienst ausserhalb eines Vorgangs seine Kettenglieder
  (`AuditServiceDeps.kettenSperre`: `last` und `append` ungeteilt). Jeder andere Aufruf der vier
  Ablagen ohne Vorgangskontext wartet, solange ein Vorgang offen ist. Ein unabhängiger Schreiber sieht
  so keine unbestätigten Zeilen, sein Beleg hängt am bestätigten Stand, und seine Journalzeile folgt
  der Vorgangszeile — belegt mit unabhängigem `AuditService.record` bei gelingendem und bei
  scheiterndem Rückzug (Kette live und nach Replay gültig, Replay = live) und mit einem
  unabhängigen Leser („BEN-R3-3“).
- Ohne Klammer bleibt nur ein `KoService`, den jemand ohne Kompositionswurzel baut (Einzeltests des
  Moduls) oder dessen Ablagen keine Rückstellung können (Test-Doubles); die Produktkompositionen
  (PostgreSQL, InMemory, Dev-Journal) haben sie alle — belegt in `atomar-ohne-datenbank.test.ts`.
- Die Endlöschung (`purgeKo`) ist nicht Teil dieses Auftrags und bleibt ohne Datenbank beim
  bisherigen sequentiellen Weg.

**Ohne Altpfad:** der Nachlauf in `ko-routes.ts`
(`conflicts/overlaps.onKoRemoved` nach `ko.delete`, bedingt durch `endgeloescht`) ist entfernt;
`onKoRemoved` wird in `services/app/src` nur noch in den zwei Transaktionshaken gerufen
(`setPurgeTxCleanup`, `setRuecknahmeTxCleanup`).

## Die in Lauf 1/2 reproduzierten Wiederherstellungsfehler — je ein Test, behoben

Alle Fehler hatten dieselbe Ursache: das Wiederherstellen wollte einen durch Rückzug geschlossenen
Befund wieder öffnen und entschied das aus einem Stand, der bei überlappenden Vorgängen oder
Altbestand falsch war. Mit Entscheidung 43017d60 entfällt die Wiederöffnung; die Hilfsmechanik aus
Lauf 1/2 (`resolution.imPapierkorb`, `markTrashedSide`, `releaseTrashedSide`,
`OverlapService.onKoRestored`, Bestandsfrage im Überschneidungsspeicher) ist nicht übernommen.

| Kennung | Ablauf (Ben) | Früherer Fehler | Beleg (Soll: eigener Beitrag zurück, Befund unverändert zu, Gegenseite unberührt, Nachweis lesbar) |
| --- | --- | --- | --- |
| L1-R1-1 | Gegenseite wird während der Wiederherstellung zurückgezogen | Befund ging über einer Seite im Papierkorb auf; Admin las 404 | `ueberlappende-vorgaenge.test.ts` „L1-R1-1“; Pg: `rueckzug-atomar.integration.test.ts` „L1-R1-1“ |
| L1-R1-2 | zwei Wiederherstellungen überlappen (beide Reihenfolgen) | uneinheitlicher Zustand je Reihenfolge | „L1-R1-2“ (beide Reihenfolgen); Pg „L1-R1-2“ |
| L1-R3-1 | zwei Rückzüge beginnen am offenen Befund | zweite Seite fehlte, Wiederherstellen öffnete | „L1-R3-1“ (genau ein Abschluss); Pg „L1-R3-1“ |
| L1-R3-2 | Altbefund (vor der Lieferung geschlossen) | Wiederherstellen öffnete über fehlender Gegenseite | „L1-R3-2“ (zwei Fälle); Pg „L1-R3-2“ (gleichzeitig) |
| L1-R3-3 | Gegenseite direkt endgelöscht | Wiederherstellen öffnete über gelöschter Seite | „L1-R3-3“; Pg „L1-R3-3“ |
| L2 | Altbefund, dann Rückzug und Wiederherstellen der Gegenseite | Befund ging auf, Admin las 404 | „L2“ (auch mit Endlöschung zwischendurch); Pg „L2“ |
| Atomarität (Pg) | Audit fällt beim Rückzug bzw. Wiederherstellen aus | — | Pg „Audit-Ausfall beim Rückzug/Wiederherstellen“ (nichts geschehen, Wiederholung vollständig) — nur auf dem Prüfweg |
| BEN-R3-1 (Runde 1 dieses Laufs) | Dev-Journal, Ausfall bei `overlap.withdrawn-own`, `ko.deleted`, `ko.restored`, danach `replayJournal` | Teilzustände live und nach Replay (Befund zu bei aktivem Beitrag; Beitrag im Papierkorb ohne Beleg; Beitrag zurück ohne Beleg) | `atomar-ohne-datenbank.test.ts`: je Fall Zustand live UND nach Replay gleich dem Vorher, keine Journalzeile, Belegkette intakt, Wiederholung vollständig; dazu Ausfall beim Schreiben des Beitrags, reines InMemory, fail-closed. Gegenprobe: ohne Klammer werden 5 der 10 Fälle rot. |
| BEN-R3-2 (Runde 2 dieses Laufs) | Fehler beim Anhängen der Journalzeile von `ko.deleted` bzw. `ko.restored` | live alles zurück, nach Replay aber Rückzug bzw. Wiederherstellung wirksam | `atomar-ohne-datenbank.test.ts` „BEN-R3-2“: live und nach Replay gleich dem Vorher, keine Journalzeile. Gegenprobe: zeilenweiser Abschluss → 2 rot. |
| BEN-R3-3 (Runde 2 dieses Laufs) | unabhängiges `AuditService.record` nach `overlap.withdrawn-own`, mit und ohne späteren Ausfall | AggregateError, Kette nach Replay ungültig | `atomar-ohne-datenbank.test.ts` „BEN-R3-3“: Ausgangsfehler statt AggregateError, Kette live und nach Replay gültig, Replay = live; unabhängiger Leser sieht bestätigten Stand. Gegenprobe: ohne Sperre/Wartetor → 3 rot. |
| BEN-R3-2 Rest (Lauf 3 Runde 3 → Lauf 4) | Journal-Abschluss schreibt eine halbe Vorgangszeile, dann ENOSPC; danach erfolgreiche Wiederholung | Wiederholung hing am Rest, fehlte nach Replay (Rückzug: nach Replay aktiv; Wiederherstellen: nach Replay im Papierkorb) | `journal-teilschreiben.test.ts` (Lauf 4): nach dem Fehler live und nach Replay wie vorher, Wiederholung live = nach Replay, Gegenseite unberührt, Befund nach Wiederherstellen unverändert zu. Gegenprobe: ohne Neuaufsatz → 6 von 8 rot. |
| BEN-R3-2 (Lauf 4 Runde 1 → Runde 2) | Journal-Abschluss schreibt die ganze Vorgangszeile ohne Zeilenende, dann ENOSPC; Replay bzw. Neustart | der im Speicher zurückgestellte Vorgang wirkte nach Replay und Neustart (Rückzug: im Papierkorb; Wiederherstellen: aktiv) | `journal-teilschreiben.test.ts` „Lauf 4, Runde 2“: nach dem Fehler live, nach Replay und nach Neustart wie vorher; Datei bleibt ohne Zeilenende; Wiederholung wirkt genau einmal. Gegenprobe: Stand Runde 1 → 3 von 10 rot. |
| BEN-R4-1 (Lauf 4 Runde 2 → Runde 3) | Journal-Abschluss schreibt die ganze Vorgangszeile samt Zeilenende, dann EIO beim Schliessen; Replay, Neustart, Wiederholung | zurückgestellter Vorgang wirkte nach Replay/Neustart; Replay der Wiederholung brach mit STALE_WRITE ab | in Lauf 4 Runde 3 mit Widerruf behoben (Bens Gegenprobe `journal-abschlussfehler.test.ts` grün); seit Lauf 5 getragen von der Bestätigung. |
| BEN-R5-1 (Lauf 5 Runde 1 → Runde 2) | Bestätigung vollständig geschrieben, dann EIO; Zurücklesen und Widerruf scheitern | Speicher zurückgestellt und ausgeliefert, Replay/Neustart wirksam (Rückzug: Papierkorb/Befund zu; Wiederherstellen: aktiv) | `journal-teilschreiben.test.ts` „BEN-R5-1“ (6 Fälle): Fehler `JOURNAL_AUSGANG_UNGEWISS`; lesende und schreibende Aufrufe abgewiesen; Replay und Neustart schon VOR der Klärung = Datei; nach Klärung (Lesen wieder möglich bzw. Widerruf schreibbar) live = Replay = Neustart; Spiegelfall (Bestätigung fehlt) und Unmöglichkeitsbeleg. Gegenprobe: `dev-persist.ts` von Runde 1 → genau die 6 neuen Fälle rot, die übrigen 22 grün. |
| BEN-R5-2 (Lauf 5 Runde 2 → Runde 3) | Bestätigung ganz + EIO, Zurücklesen scheitert, Widerruf VOLLSTÄNDIG gespeichert + EIO; danach Lesen wieder möglich | Klärung sah nur die Bestätigung und trug den Vorgang nach; Replay/Neustart verwarfen ihn wegen des Widerrufs (Rückzug: live Papierkorb, Neustart aktiv; Wiederherstellen umgekehrt) | `journal-teilschreiben.test.ts` „BEN-R5-2“ (3 Fälle): Dienste nach Klärung = Replay = Neustart = vorher, Gegenseite unberührt; Kontrollfall ohne gespeicherten Widerruf trägt nach. Gegenprobe: Klärung nur über die Bestätigung → die 2 Hauptfälle rot. Bens `journal-klaerung-r2.test.ts`: 4 von 4 grün. |
| BEN-R5-3 (Lauf 5 Runde 2 → Runde 3) | echte `DELETE /api/kos/:id`, ungewisser Abschluss | HTTP 400 mit roher Datenträgerursache in der Meldung | `journal-ungewiss-am-draht.test.ts`: 503, Code sichtbar, kein Pfad/keine Ursache/keine Kennung; lesender Aufruf ≥ 500 ohne Leck. Gegenprobe: `http.ts` ohne den Eintrag → 400, rot. Bens `journal-http-r2.test.ts`: grün. |
| BEN-R4-1 Rest (Lauf 4 Runde 3 → Lauf 5) | wie oben, und auch der Widerruf scheitert (ENOSPC ohne Schreibwirkung); Replay und Neustart VOR jedem Nachholen | live zurückgestellt, nach Replay und Neustart wirksam (Rückzug: Papierkorb/Befund zu; Wiederherstellen: aktiv) | `journal-teilschreiben.test.ts` „BEN-R4-1 (Lauf 5)“, Fall „Bens Fall“ je Richtung: Fehler, live = Replay = Neustart = vorher, dann Wiederholung live = Replay = Neustart. Gegenprobe: Replay ohne Bestätigungspflicht → 5 von 23 rot (darunter beide „Bens Fall“); ohne Zurücklesen → 2 rot. Bens eigene Probe `journal-offener-widerruf.test.ts` auf diesem Stand: 2 von 2 grün. |

## Die zugeordneten Anliegen — geliefert, mit Fassung und Beleg

Fassung für alles unten: Lauf 5 (Basis `1.0.0-beta.1.636`, `bf9fcf1c`; Stand von Lauf 4 übernommen);
die festgehaltene Kennung erzeugt der Starter nach dem Lauf.

| Anliegen | Stand vor diesem Lauf | Dieser Lauf |
| --- | --- | --- |
| **R-1540** (JOB 3040): eigene Seite zurückziehen, Befund geht mit, Gegenseite unangetastet | JOB 3040 **abgebrochen** (03.09.), nie im Produkt. Teilumfang: **JOB 3071** (`ce5e1a5d`, `1.0.0-beta.1.85`) — `withdrawn_own` mit Kennung, über den Nachlauf der Route. | Rückzug über den einen Transaktionsweg. Belege: `tests/dubletten-ruecknahme-lesepfad/rueckzug-und-wiederherstellen.test.ts` (R-1540-Block: Grund, Urheber, Beleg, Gegenseite feldgleich und ohne Beleg). |
| **R-1547** (JOB 3047): EIN Aufräumweg, benannt, atomar, ohne Altpfad | JOB 3047 **abgebrochen** (04.09.). Teilumfang: **JOB 3066** (`8efa9e92`, `1.0.0-beta.1.80`) — nur die Endlöschung räumt in ihrer Transaktion auf. | `imRuecknahmeVorgang` + `setRuecknahmeTxCleanup`, Nachlauf entfernt; Wiederherstellen auf demselben Weg. Belege: R-1547-Block in `rueckzug-und-wiederherstellen.test.ts` (ein Körper, ein Kontext; Wiederherstellen ohne Zugriff auf den Überschneidungsspeicher), Pins `tests/aufraeumen-atomar/aufraeumen-faehrt-in-der-transaktion.test.ts`, `nachlauf-nur-nach-weichem-loeschen.test.ts`; echte Transaktionsgrenze `rueckzug-atomar.integration.test.ts` (Postgres, **nur auf dem Prüfweg**). |
| **R-1615**: Knopf am eigenen Eintrag neben dem Dublettenhinweis | nicht vorhanden | Geliefert. Beleg: `knopf-am-eigenen-hinweis-mounted.test.tsx` (jsdom). |
| **Q7** (priority:Q7:890a0e2e4bfa): abgeschlossener Befund nach Rückzug für Berechtigte nachvollziehbar | **JOB 3450** (`c0e8c93b`, `1.0.0-beta.1.248`): nur die Abschliessende liest den Nachweis. Der `withdrawn_own`-Lesepfad aus **JOB 3071/R2** (`services/conflicts/src/overlap-service.ts`, `ruecknahmeFuer`/`onKoRemoved`) ist abgeschlossen und unverändert wiederverwendet. | Erweitert auf alle, die beide Seiten sehen dürfen. Belege: `grabstein-fuer-berechtigte.test.ts`, Nachweis nach Wiederherstellen in `rueckzug-und-wiederherstellen.test.ts` und `ueberlappende-vorgaenge.test.ts`; angepasst `tests/q7-abschlussnachweis/eigene-ruecknahme-http.test.ts`, `tests/eigene-ruecknahme/aussenkante-der-ruecknahme.test.ts`. |
| **Wiederherstellen** (Kriterium dieses Laufs) | Lauf 1/2: mit Wiederöffnung, von Ben mehrfach widerlegt | Nur der eigene Beitrag, atomar, derselbe Weg, keine Wiederöffnung (s. Tabelle oben). |
| **R-1569** (Rest): nicht geprüft | Echte PostgreSQL-Instanz, reale Pool-Sättigung, Mehrprozess-Nebenläufigkeit, Browser, Gesamtsuite, `tools/check` | **In diesem Lauf nicht ausgeführt:** PostgreSQL (Datei liegt vor, Lauf auf dem Prüfweg), reale Pool-Sättigung, Mehrprozess-Nebenläufigkeit, Browser (Chromium) für den Knopf, Gesamtsuite, `tools/check`. Von den drei Hinweisen sind 404-Grenze und Oberfläche (Knopf) gebaut; die **Wiederöffnung bleibt abgegrenzt** (Entscheidung 43017d60). |

**Ersetzen** (R-1615 „zurückziehen oder ersetzen“): ein eigener Knopf dafür ist **nicht** gebaut
und im Zielzustand von R-1615 nicht verlangt. Der vorhandene Weg ist das Überarbeiten des eigenen
Eintrags: eine neue Fassung schliesst seine versionsgebundenen offenen Befunde als `superseded`
(`OverlapService.onKoRevised`, Bestand seit D-AISTATE Paket 4).

## Abgrenzung: gesonderte, bestehende Aufträge

- **Q2 / JOB 3081 und Folgen (Wiederimport gegen den Papierkorb)** — JOB 3081 (`fb9177fd`),
  3087 (`e484bfc7`), 3116 (`3ae8bbce`), 3424 (`8cbb7718`). Betrifft Importkennungen, nicht den
  Überschneidungsbefund; keine Datei des Importwegs ist geändert („kein zweiter Q2/3081-Auftrag“).
- **JOB 3066** (Endlöschung atomar) und **JOB 3071** (`withdrawn_own` benannt) sind abgeschlossen und
  werden wiederverwendet: `setPurgeTxCleanup` und die Ableitung des Grundes in `onKoRemoved` sind
  unverändert.
- **JOB 3450** (Q7-Nachweis für die Abschliessende) bleibt; der Nachweis für weitere Berechtigte ist
  eine Erweiterung daneben.
- **JOB 1546** (Entscheidung gegen das Zusammenführen) bleibt wirksam.
- **Wiederöffnung beim Wiederherstellen** — nach Entscheidung 43017d60 ausdrücklich nicht Teil
  dieses Auftrags; wird später gesondert entschieden.

## Nacharbeit Runde 2 — Bens BEN-R3-1

- **Befund:** ohne Datenbank schrieb `imRuecknahmeVorgang` Aufräumen, Beitrag und Beleg nacheinander;
  ein Ausfall hinterliess Teilzustände, auch nach dem Journal-Replay. Die dokumentierte Einschränkung
  „ohne Atomaritätszusage“ erfüllte das Kriterium nicht.
- **Behoben:** Rücknahme-Klammer ohne Datenbank (s. „Atomar“ oben); neue Rückstellmethoden an den
  Speicher-Ablagen (`InMemoryKoRepo`/`InMemoryOverlapRepo`/`InMemoryConflictRepo.zuruecksetzen`,
  `InMemoryAuditRepo.verwerfen`) — keine Schnittstellenmethoden, in PostgreSQL übernimmt ROLLBACK.
- **Schwacher Test ersetzt:** der Audit-Ausfalltest in `rueckzug-und-wiederherstellen.test.ts` prüfte
  nur `rejects.toThrow` gegen eine nachgestellte Klammer ohne Rollback; er ist entfernt, die
  Zustandsprüfung steht in `atomar-ohne-datenbank.test.ts`.
- **Folgeanpassung:** `tests/app/import-cleanup.test.ts` pinnte genau das alte Fenster („KO im
  Papierkorb, aber Audit warf → trashed“). Mit atomarem Löschen bleibt das KO aktiv und zählt als
  übersprungen; die Kandidaten bleiben für den nächsten Lauf. Erwartung angepasst und begründet.
- **Grenze (in Runde 3 überholt):** die hier zunächst genannte Annahme „der Körper wartet nur auf
  sofort antwortende Ablagen, fremde Belege stehen nie dahinter“ hat Ben widerlegt (BEN-R3-3); ebenso
  das zeilenweise Schreiben beim Abschluss (BEN-R3-2). Beides ist in Runde 3 ersetzt, s. unten.

## Nacharbeit Runde 3 — Bens BEN-R3-2 und BEN-R3-3

- **BEN-R3-2 (Journal-Abschluss):** die Klammer schrieb die zurückgehaltenen Zeilen einzeln; warf ein
  späterer Schreibaufruf, blieben frühere Zeilen im Journal und wirkten beim Replay. Jetzt EIN
  Schreibaufruf mit einer Vorgangszeile, im Replay nur als Ganzes; ein Fehler dabei stellt den
  Speicher zurück. Tests: Fehler beim Abschluss für Rückzug und Wiederherstellen, Zustand live und
  nach Replay gleich dem Vorher, keine neue Journalzeile, Wiederholung schreibt genau eine
  Vorgangszeile. Gegenprobe: mit zeilenweisem Abschluss werden beide Fälle rot.
- **BEN-R3-3 (unabhängige Schreiber):** die Klammer serialisierte nur ihre eigenen Vorgänge; ein
  unabhängiges `AuditService.record` sah unbestätigte Belege, schrieb seine Zeile sofort ins Journal
  und verhinderte beim Rollback das Verwerfen. Jetzt gemeinsame Sperre für Vorgang und
  Kettenglieder (`kettenSperre`, neue optionale Abhängigkeit des Audit-Dienstes, nur ohne Datenbank
  verdrahtet) und ein Wartetor für alle anderen Aufrufe der vier Ablagen ohne Vorgangskontext.
  Tests: unabhängiger Beleg bei gelingendem und scheiterndem Rückzug (kein AggregateError, Kette live
  und nach Replay gültig, Replay = live), unabhängiger Leser sieht den bestätigten Stand. Gegenprobe:
  ohne Sperre und Wartetor werden alle drei Fälle rot.
- **Nebenwirkung, gewollt:** ohne Datenbank laufen nun ALLE `record`/`recordOnce` des Audit-Dienstes
  ungeteilt nacheinander — vorher konnten zwei gleichzeitige Kettenglieder im Speicher dieselbe
  `seq` erhalten (in PostgreSQL verhindert das der Primärschlüssel).
- **Grenzen:** das Wartetor gilt für die vier Ablagen dieses Wegs (Wissensobjekte, Überschneidungen,
  Konflikte, Belege). Ein unabhängiger Lese-dann-Schreib-Vorgang, der VOR einem Rücknahme-Vorgang
  liest und DANACH schreibt, verhält sich wie unter READ COMMITTED: beim Wissensobjekt fängt der
  CAS (`rowVersion`) das ab, bei Überschneidung/Konflikt gilt wie bisher „letzter Schreiber gewinnt“.
  Gibt es mehr als ein Journal an denselben Ablagen (in keiner Produktkomposition der Fall), wäre der
  Abschluss je Journal getrennt.

## Nacharbeit Lauf 4 — Bens BEN-R3-2 (Rest: Teilschreiben)

- **Befund (Lauf 3, Runde 3):** nach einem Journal-Schreibfehler, der schon einen Teil der
  Vorgangszeile geschrieben hatte, hing die anschliessend erfolgreich gemeldete Wiederholung an
  diesem Rest; das Einlesen brach dort ab, die Wiederholung fehlte nach dem Replay. Die Dokumentation
  sagte zu weit „steht keine Zeile im Journal“.
- **Behoben:** Neuaufsatz nach jedem gescheiterten Schreibaufruf (`mitNeuaufsatz`, in
  `journaledRepos`, gilt für alle Zeilen des Journals, nicht nur für Vorgangszeilen), Überspringen
  eines so abgeschlossenen Rests in `readJournalLines`, Versorgung eines Rests am Dateiende beim
  Start (`buildDevPersistServices`). Die Fehlerzusage oben ist auf das Belegte zurückgeschnitten.
- **Tests:** `tests/dubletten-ruecknahme-lesepfad/journal-teilschreiben.test.ts` (8 Fälle, s. Tabelle);
  angepasst `atomar-ohne-datenbank.test.ts` („BEN-R3-2“, Rückzug): nach dem gescheiterten Abschluss
  stehen bei der Wiederholung zwei neue Zeilen im Journal — Neuaufsatz und Vorgangszeile.
- **Unverändert:** Rückzug, Wiederherstellen, Lesepfad, Knopf und Klammer aus Lauf 3; ebenso der
  Bestandsvertrag, dass eine ungültige Zeile OHNE Neuaufsatz das Einlesen beendet.

## Nacharbeit Lauf 4, Runde 2 — Bens BEN-R3-2 (ENOSPC vor dem Zeilenende)

- **Befund:** fehlte nach ENOSPC nur das letzte Zeilenende, las `readJournalLines` die vollständige
  Vorgangszeile als gültig; Replay und Neustart machten den zurückgestellten Rückzug bzw. die
  zurückgestellte Wiederherstellung wirksam, `buildDevPersistServices` trug sogar das Zeilenende nach.
- **Behoben:** eine letzte Zeile ohne Zeilenende ist unbestätigt und wird nie gelesen; beim Start
  bekommt sie kein Zeilenende, sondern das nächste Schreiben setzt mit dem Neuaufsatz neu auf.
- **Tests:** `journal-teilschreiben.test.ts` (jetzt 10 Fälle): neu Rückzug und Wiederherstellen mit
  ENOSPC vor dem Zeilenende (live, Replay, Neustart, Wiederholung genau einmal); der Runde-1-Fall
  „vollständige letzte Zeile ohne Zeilenende bleibt gültig“ ist durch das Gegenteil ersetzt
  („unbestätigt: nie gelesen, auch nicht nach dem nächsten Start“) — er pinnte genau den Fehler.
- **Verhaltensänderung am Bestand:** ein Journal, dessen letzte Zeile nach einem Abbruch zwar
  vollständiges JSON, aber kein Zeilenende hat, verliert diese Zeile. Der Aufruf dazu ist nie
  zurückgekehrt, sein Aufrufer hat nie einen Erfolg gesehen; die bisherigen Journal-Tests
  (`tests/app`, A7, Aussperrschutz, SharePoint-Neustart) bleiben grün.

## Nacharbeit Lauf 4, Runde 3 — Bens BEN-R4-1 (Fehler nach vollständiger Zeile)

- **Befund:** schreibt der Abschluss die ganze Vorgangszeile samt Zeilenende und scheitert danach
  (Ben: EIO mit `syscall=close`, injiziert), stellte die Klammer den Speicher zurück, das Journal
  behielt die gültige Zeile: Replay und Neustart machten den Vorgang wirksam, und die erfolgreich
  gemeldete Wiederholung liess das Replay mit `DevPersistJournalReplayError` (STALE_WRITE)
  abbrechen. Die in Runde 2 dokumentierte Grenze war also keine Randnotiz, sondern ein Fehler.
- **Behoben:** Kennung je Vorgangszeile und sofortiger Widerruf nach jedem gescheiterten Abschluss
  (Regel 3 oben); offener Widerruf sperrt jede weitere Zeile.
- **Tests:** `journal-teilschreiben.test.ts` „BEN-R4-1“ (5 neue Fälle); angepasst
  `atomar-ohne-datenbank.test.ts` „BEN-R3-2“ (nach dem Fehler stehen Neuaufsatz und Widerruf im
  Journal) und in `journal-teilschreiben.test.ts` die zwei Fälle, deren Fehlerzählung der sofortige
  Widerruf verschiebt (zweimal Teilschreiben; ENOSPC vor dem Zeilenende — dort scheitert jetzt auch
  der Widerruf, damit die Datei wirklich ohne Zeilenende endet).
- **Bens Gegenproben:** `journal-abschlussfehler.test.ts` (Runde 3) und `journal-teilschreiben.test.ts`
  (Lauf 3) grün. `journal-ohne-zeilenumbruch.test.ts` (Runde 2) scheitert nur an seiner
  Vorbedingung „Datei endet ohne Zeilenende“: der sofortige Widerruf schliesst die Datei jetzt mit
  einer vollständigen Zeile ab. Ohne diese eine Vorbedingung bestehen alle Zustandsvergleiche
  (nach Fehler, nach Replay, nach Neustart, Wiederholung). Den Fall „Datei endet wirklich ohne
  Zeilenende“ deckt `journal-teilschreiben.test.ts` „Lauf 4, Runde 2“ ab.

## Nacharbeit Lauf 5 — Bens BEN-R4-1 (Abschlussfehler und gescheiterter Widerruf)

- **Befund (Lauf 4, Runde 3, geprüfter Commit `bd2f984d`):** scheiterte der Abschluss nach
  vollständig geschriebener Vorgangszeile UND danach auch der sofortige Widerruf, hielt das Journal
  den Widerruf nur flüchtig offen. Die Klammer stellte den Speicher zurück und meldete den Fehler;
  Replay und Neustart führten die Vorgangszeile aus — in beiden Richtungen.
- **Behoben:** die Wirksamkeit einer Vorgangszeile hängt nicht mehr an einem nachträglichen
  Widerruf, sondern an einer eigenen Bestätigungszeile (Regel 3 oben). Ein Fehler der
  Vorgangszeile braucht damit keinen weiteren Schreibaufruf mehr. Den ungewissen Ausgang der
  Bestätigung klärt das Zurücklesen der Datei; nur wenn auch das scheitert, trägt der Widerruf
  (fail-closed wie bisher). `speicher-vorgang.ts` unverändert bis auf den Kommentar.
- **Tests:** `journal-teilschreiben.test.ts` — der Block „BEN-R4-1 (Lauf 4, Runde 3)“ ist durch
  „BEN-R4-1 (Lauf 5)“ ersetzt (13 Fälle: Bens Fall; Vorgangszeile halb/ohne Zeilenende/gar nicht bei
  scheiterndem Widerruf; Bestätigung ganz + EIO mit erfolgreichem, gescheitertem und fehlendem
  Zurücklesen; Bestätigung halb/ohne Zeilenende; fail-closed; Replay-Regel direkt an einer Datei).
  Der frühere Fall „Widerruf dauerhaft nicht schreibbar → fail-closed“ gilt jetzt für die ungewisse
  Bestätigung (nach einer gescheiterten Vorgangszeile ist nichts mehr zu sperren). In Runde 2
  ersetzt durch den Zustand „ungewiss“ und den Block „BEN-R5-1“ (s. unten).
  `atomar-ohne-datenbank.test.ts` „BEN-R3-2“: die erfolgreiche Wiederholung schreibt eine Zeile mehr
  (Bestätigung).

## Nacharbeit Lauf 5, Runde 2 — Bens BEN-R5-1 (ungewisse Bestätigung)

- **Befund (geprüfter Stand Runde 1):** Bestätigung vollständig geschrieben, dann EIO; Zurücklesen
  und Widerruf scheitern. Der Widerruf blieb nur flüchtig offen, die Klammer stellte zurück und die
  Instanz lieferte den zurückgestellten Stand aus; Replay und Neustart zeigten den entgegengesetzten.
- **Behoben:** Zustand „ungewiss“ in `dev-persist.ts` (`JournalAusgangUngewiss`, Wächter in
  `journaled`, Klärung `aufloesen`). Der flüchtige offene Widerruf aus Lauf 4 entfällt; an seine
  Stelle tritt die Sperre aller Ablagen dieses Journals bis zur Klärung an der Datei.
- **Nebenkorrektur:** der Widerruf nach einer Bestätigung, die das Zurücklesen als NICHT stehend
  erkannt hat, wird nicht mehr geschrieben (unnötig). Der Fall „Bestätigung halb / ohne Zeilenende“
  braucht deshalb keinen scheiternden Widerruf mehr in seiner Fehlerfolge.
- **Bens Gegenprobe `journal-gegenprobe.test.ts` auf diesem Stand:** die zwei Fälle an der
  Vorgangszeile grün; die zwei Fälle an der Bestätigung weiter rot. Sie vergleichen die ROHEN
  InMemory-Ablagen unterhalb der Journal-Schicht (zurückgestellt) mit der Datei (Bestätigung steht).
  Diese Forderung ist in der geprüften Lage nicht erfüllbar: im Spiegelfall (Bestätigung gar nicht
  geschrieben) bekommt der Prozess exakt dieselben Rückmeldungen, die Datei sagt aber das Gegenteil
  — jeder feste Speicherstand widerspricht einer der beiden Dateien (Beleg „Unmöglichkeit“). Über
  die Dienste ist in dieser Lage kein Stand lesbar; nach der Klärung stimmen sie mit Replay und
  Neustart überein. Ob diese Antwort (Sperre + „ungewiss“) der Atomaritätsanforderung genügt, ist
  eine Urteilsfrage für Ben/Pedi; die Alternative wäre eine Entscheidung, welcher Ausgang im
  unklärbaren Fall gelten soll — sie hätte im jeweils anderen Fall denselben Widerspruch.

## Nacharbeit Lauf 5, Runde 3 — Bens BEN-R5-2 und BEN-R5-3

- **BEN-R5-2 (Klärung übersah einen gespeicherten Widerruf):** `bestaetigungInDatei` prüfte nur die
  Bestätigung, das Replay auch den Widerruf. Behoben mit EINER Regel `wirksamIn` (dev-persist.ts),
  die Replay und Klärung beide benutzen. Die Aussage aus Runde 2 „liefert nie einen anderen Stand
  aus als Replay und Neustart“ war für diesen Fall falsch; sie ist oben auf das Belegte beschränkt.
- **BEN-R5-3 (400 mit roher Ursache am Draht):** `JOURNAL_AUSGANG_UNGEWISS` → 503 in
  `STATUS_BY_CODE` (http.ts); die Meldung von `JournalAusgangUngewiss` ist ein fester Satz, Ursache
  und Kennung stehen nur in `cause`/`vorgang`. Bewusst NICHT in `INTERNAL_ONLY_CODES` (generische
  500): der Aufrufer soll „ungewiss“ von „gescheitert“ unterscheiden können und nicht blind
  wiederholen.
- **Bens Runde-1-Probe `journal-gegenprobe.test.ts`** scheitert seit Runde 3 schon an ihrer
  Vorbedingung `rejects.toThrow("BEN EIO")`, weil die Ursache nicht mehr in der Meldung steht (sie
  steht in `cause`). Ihre beiden Fälle an der Vorgangszeile bestehen weiter.

## Quellenwidersprüche und fehlende Belege

1. **Wiederöffnen ja oder nein.** JOB 3040 §5.3 öffnete immer, JOB 3047 §5.7 nur ohne Seite im
   Papierkorb, Lauf 1/2 bauten nach 3047. Die jüngste Quelle — Entscheidung 43017d60 — schliesst
   die Wiederöffnung aus; gebaut danach.
2. **Q7/R-1569 grenzen ab, was Titel und R-1615 verlangen** („UI-Rücknahme/Ersetzen und
   Wiederherstellen bleiben offen“ bzw. „fehlende Oberfläche … ausstehende Wiederöffnung“). Beides
   bezog sich auf die engen Vorgänger (JOB 3450/3071). Titel und R-1615 verlangen Rückzug, Knopf und
   Wiederherstellen; gebaut nach dem Auftrag, die Wiederöffnung bleibt nach 43017d60 aussen vor.
3. **Wer ist „die Autorin“?** JOB 3047 §5.2: `ko.author === actor` — dasselbe Prädikat wie
   Löschberechtigung und `eigeneRuecknahmeVon`. Gebaut danach.
4. **„Lieferumfang JOB 3040/3047“** meint den Auftragsumfang: beide Jobs sind abgebrochen, ein
   Abschlussbeleg aus ihnen existiert nicht.
5. **Wiederherstellen durch die Autorin selbst:** keine Quelle verlangt ausdrücklich, dass die
   Autorin selbst wiederherstellt; die Route bleibt beim Admin (`users.manage`), weil eine
   Rechteänderung ausgeschlossen ist (§3). Eine Oberfläche zum Wiederherstellen gibt es nur im
   bestehenden Papierkorb der Verwaltung.
6. **Fehlende Belege dieses Laufs (Lauf 5 wie Lauf 3/4):** kein PostgreSQL-Ergebnis (keine Dienste auf dem
   Produktions-Mac), kein vollständiger `tools/check`. Beides liefert der Prüfweg; ein
   Testserverabbruch ohne Ergebnis gilt nicht als Erfüllung.

## Verbleibende Grenzen

- Ein Befund über einem vor dieser Lieferung weich gelöschten Eintrag (Altbestand: Papierkorb,
  Befund noch offen) schliesst weiter erst mit der Endlöschung — über deren Vorablesung.
- Nach dem Wiederherstellen trägt das Paar keinen offenen Befund mehr; eine erneute Erkennung
  entsteht erst durch eine neue Prüfung (Überarbeitung oder manueller Lauf), nicht durch das
  Wiederherstellen.
- Der Nachweis nach dem Rückzug hat in der Oberfläche keinen eigenen Leser
  (`endpoints.duplicates.get` wird von keiner Fläche gerufen).

# Papierkorb, Wiederherstellung und Löschgrenzen — Stand und Lieferung

*Aufnahme 20260922 · gesamt-papierkorb (`aufnahme:20260922:gesamt-papierkorb`, Revision 1).
Basis `2ed7226b` (1.0.0-beta.1.906). Die ausgelieferte Fassung dieser Änderung steht erst nach der
Veröffentlichung fest; dieses Dokument nennt deshalb nur Basis und Kandidat, keine Livefassung.*

## Kurzbild

| Anliegen | Stand vor diesem Auftrag | Dieser Auftrag |
| --- | --- | --- |
| R-0002 / R-0806 Papierkorb, Wiederherstellen, bewusste Endlöschung (Wissensobjekt) | Abgenommen am 05.09.2026 auf 1.0.0-beta.1.90 (Befunde `R-0002-20260905T120630682901`, `R-0806-20260905T121902045603`); Ein-Admin-Weg Chromium/PostgreSQL in T011 | wiederverwendet, nicht neu gebaut |
| R-0973 Frist mit automatischer Endlöschung (Wissensobjekt) | `TRASH_RETENTION_DAYS = 30` (JOB 4327), `runTrashSweep` beim Start und alle 6 h (`server.ts`) | unverändert; Frist und Lauf über vorhandene Tests zugeordnet |
| R-0973 Demodaten sofort endgültig | `KoService.delete`: `demoSeed` → `purgeKo(…, "hard")` | unverändert; vorhandener Test zugeordnet |
| P-ENTWURFS-PAPIERKORB Entwürfe im Papierkorb | Seit JOB 3668 (LIVE 1.0.0-beta.1.346): weiches Löschen, Wiederherstellen, Endlöschung; `DELETE FROM drafts` nur noch für Verbrauch und Endlöschung | wiederverwendet |
| B5 (Pedi 17.09.2026) Frist **auch für Entwürfe** | **Lücke:** der Entwurfs-Papierkorb leerte sich nie; die Seitenhilfe sagte „von selbst leert sich der Papierkorb nicht" | **geliefert:** `CaptureService.runDraftTrashSweep`, beim Start und im Papierkorb-Takt; Seitenhilfe und Dateninventar nennen 30 Tage |

## Geliefert in diesem Auftrag

- `services/capture/src/service.ts` — `runDraftTrashSweep`: entfernt Entwürfe, deren `deletedAt`
  mindestens `TRASH_RETENTION_DAYS` zurückliegt. Eine Frist, eine Quelle (die Konstante des
  Wissensobjekts). Gelöscht wird über `repo.purge(id)` ohne `auchLebende` — die Papierkorbbedingung
  steht in der löschenden Anweisung, ein zwischenzeitlich zurückgeholter Entwurf bleibt stehen.
  Unlesbarer Zeitpunkt: bleibt liegen. Fehler an einem Entwurf: gemeldet, Lauf geht weiter.
- `services/app/src/server.ts` — Lauf beim Start und periodisch (`KLARWERK_TRASH_SWEEP_INTERVAL_MS`,
  Standard 6 h), Meldungen in `services/app/src/log-positivliste.ts` gelistet (Feld `entwurfId`).
- `apps/web/src/texte/entwurfspool.ts` — Seitenhilfe „Meine Entwürfe" (de/en/nl) nennt die Frist;
  `tests/app/zusagen-zahlenbindung.test.ts` bindet die Zahl an `TRASH_RETENTION_DAYS`.
- `services/app/src/dateninventar.ts` — Datenart „Entwürfe": Löschweg und Frist (30 Tage) statt
  „Keine Frist im Code".
- Tests: `tests/entwurfs-papierkorb/frist-endloeschung.test.ts` (neu),
  `tests/entwurfs-papierkorb/papierkorb-pg.integration.test.ts` (Fall P9, echtes PostgreSQL).

### Nacharbeit 2 (Bens Befunde)

- **Entwurf: Frist nach Restore und erneutem Löschen.** Der Lauf prüfte die Frist am alten
  Listeneintrag, `purge(id)` nur den Papierkorbstatus. `DraftRepo.purge(id, auchLebende,
  geloeschtAm)` bindet die Löschung jetzt an den gelesenen Löschzeitpunkt — in derselben Anweisung
  (`data->>'deletedAt' = $2`). Belege: `frist-endloeschung.test.ts` F4b/F4c, PostgreSQL P10.
- **Wissensobjekt: Restore gegen Endlöschung.** Jede Endlöschung aus dem Papierkorb (manuell und
  Fristlauf) trägt `KoPapierkorbBedingung` (gelesene `rowVersion`); `PgKoRepo.delete` löscht nur,
  wenn das Objekt noch im Papierkorb liegt und die `rowVersion` stimmt. Das Wiederherstellen
  entscheidet über den vorhandenen CAS in `update` (ein UPDATE legt nie an; der Speicher spiegelt
  das jetzt). Verliert die Endlöschung, rollt `withPgTx` Aufräumbeitrag und Beleg zurück, und der
  Vektor des lebenden Objekts wird über `meldeAenderung` neu abgeleitet. `delete({hard})` und
  Demodaten unverändert sofort endgültig. Belege: `tests/ko/restore-purge-faelle.ts`, ausgeführt
  in `restore-purge-reihenfolge.test.ts` (Speicher) und
  `restore-purge-reihenfolge-pg.integration.test.ts` (echtes PostgreSQL): W1 Restore zuerst,
  W2 Endlöschung zuerst, W3 Fristlauf gegen Restore und erneutes Löschen, W4 Demodaten.
- **Mehrrollenweg, befüllte Verknüpfungen, Rechteentzug.** Zugeordnet:
  `tests/security/g26-matrix-laufzeit.test.ts` R2/R3 (Betrachter: restore/trash-delete abgelehnt,
  Objekt unverändert) und `tests/ko/trash-e2e.test.ts` (Experte 403, Version/Historie). Neu
  `tests/ko/papierkorb-restore-befuellt-rollen.test.ts`: M1 Anhang, Quelle und Beziehung mit
  Kennung, Inhalt, Version Feld für Feld nach dem Restore; Experte löscht, Leser und Autor
  scheitern am Restore, ein zurückgestufter Admin scheitert an Restore und Endlöschung, der Admin
  stellt her. M2 eine vor dem Löschen entzogene Lesesicht (Hochstufung) gilt nach dem Restore für
  Objekt und Anhang weiter.

## Abgrenzung

- **Abgeschlossen, nicht neu gebaut:** R-0002/R-0806 (Abnahme 05.09.2026, nur benannter Umfang),
  JOB 3668 Entwurfs-Papierkorb, JOB 4327 Frist 30 Tage, JOB 3066/1104 Aufräumen in der Transaktion.
- **Gesonderte Aufträge:** Löschumfang/Aufbewahrung je Datenart (`loeschung-aufbewahrung.md`,
  R-0634 ff.), Dubletten-Rückzug (`dubletten-rueckzug.md`), Leserechte/Entwurfslinks
  (`aufnahme:20260922:gesamt-leserechte`), Import-Adoption.
- **Nicht von Pedi bestätigt, nicht umgesetzt:** B5 Punkt 3 „Betreiber-Löschungen protokolliert"
  (nur Empfehlung der Steuerung).

## Quellenwidersprüche

1. **Vier Wochen gegen 30 Tage.** R-0973 (03.07.2026, Titel „28-Tage-Frist") sagt „vier Wochen".
   Pedis jüngere Festlegung B5 vom 17.09.2026 sagt 30 Tage. Die jüngere Entscheidung gilt; 28 Tage
   werden nicht zurückgebaut.
2. **„Gemessen: repo-pg.ts:162 `DELETE FROM drafts WHERE id=$1`"** (P-ENTWURFS-PAPIERKORB) ist
   durch JOB 3668 überholt: `delete` markiert, `DELETE FROM drafts` steht nur noch in `purge`
   (`services/capture/src/repo-pg.ts`, mit Papierkorbbedingung außer beim Verbrauch).
3. **JOB 3668 R1 „keine Frist für Entwürfe"** widerspricht B5; mit diesem Auftrag aufgelöst.

## Offen — fehlende Belege und Befunde

- **Echter Zeitablauf live:** Weder für Wissensobjekte noch für Entwürfe ist eine automatische
  Endlöschung nach realem Fristablauf in der Livefassung beobachtet; belegt ist sie nur mit
  eingespritzter Uhr (Unit) bzw. gesetztem Zeitpunkt (PostgreSQL P9). R-0973-Rest „Audit reason
  trash-expired live" bleibt offen.
- **Kein Prüfprotokoll für Entwurfs-Endlöschungen.** Weder die manuelle Endlöschung (JOB 3668)
  noch der neue Lauf schreiben einen Audit-Eintrag; `capture` kennt den Audit-Dienst nicht. Nur
  Serverlog.
- **Ohne Datenbank (Speicher, Dev-Journal) keine Atomarität der Endlöschung.** Der Weg ohne
  `withTx` prüft die Papierkorbbedingung vor Beleg und Löschung und noch einmal an
  `repo.delete`; zwischen Beleg und Löschung bleibt dort, wie schon dokumentiert, kein
  Atomaritätsversprechen. Die Zusage gilt für PostgreSQL.
- **Rechteentzug, Umfang:** belegt sind Rückstufung des Handelnden und Hochstufung der
  Vertraulichkeit. Das Löschen bleibt bewusst autorgebunden (`ko-routes.ts`, Autor oder
  `ko.validate`) — ein zurückgestufter Autor darf sein eigenes Objekt weiter löschen; das ist
  bestehende Regel, kein wiederbelebtes Recht.
- **Echter Browserweg mit mehreren Rollen** für die neuen Fälle nicht gelaufen; belegt am Draht
  (`app.inject`) bzw. am Dienst.
- **Kommentar `apps/web/src/woerterbuch/de.ts`** an `capture.discardDraftQ` und am eingefrorenen
  Schlüssel `seitenhilfe.entwuerfe.body` sagt noch „keine Frist". Die Datei wird gegen eine
  Referenzkopie verglichen (`tests/i18n-woerterbuch/`); der angezeigte Text (`entwurfspool.*`) ist
  berichtigt.
- **Menschliche Bedienung:** kein Live-Durchgang mit echten Rollen in diesem Auftrag.

# Löschung, Aufbewahrung und Löschsperren — Bestandsaufnahme

*Aufnahme 20260922 · gesamt-loeschung-aufbewahrung. **Lauf 1** (Aufgabenrevision 2, Runde 1 auf
Basis `1.0.0-beta.1.642`, Commit `3a859e7b`). Erfasst den tatsächlichen Stand zu R-0634, R-0637,
R-0638, R-0642, R-0646, R-0654, R-0657, R-0662 und dem Rest R-1564. **Kein Purge-Vertrag, keine
Produktänderung:** nach Bens Vorgabe entscheiden zuerst fünf Ownerfragen (unten) über Aufbewahrung,
Datenschutz, RESTRICT/Cleanup je Träger, Cleanup-Spur und das zusammengesetzte Kennungsformat. Erst
danach darf ein Purge-Vertrag entstehen. Alle Angaben unten sind am Code dieses Stands gelesen;
„heute“ heisst Commit `3a859e7b`.*

## Kurzbild

| Anliegen | Stand bei `3a859e7b` | Urteil |
| --- | --- | --- |
| R-0634 Wissen löschen → Fassungen, Anhänge, Beziehungen weg; eine Transaktion; Nachweis | Transaktion + Beleg `ko.purged` mit Umfang: **ja** (nur mit Datenbank). Fassungen, Anhänge, Beziehungen: **bleiben stehen** | teilweise |
| R-0637 Träger löschen → verhindern statt mitlöschen; Frist, Wirkung, Spur | Kein `ON DELETE RESTRICT`, kein Löschhindernis je Träger; Integrität nur im Anwendungscode | offen, Ownerfrage 3 |
| R-0638 Export, Aufbewahrung, Wiederherstellung | Fachlicher Bibliotheks-Export und echter Wiederherstellungsweg (Sicherung/Restore-Drill) vorhanden; kein personenbezogener Kundenexport, keine Fristenregel | teilweise |
| R-0642 Konto löschen → Verweise auf „ehemaliger Nutzer“ | Nur Konto + Sitzungen werden gelöscht; alle Verweise bleiben | offen, Ownerfrage 2 |
| R-0646 entfernte zitierte Quelle → dauerhafter Vermerk; lose Uploads still weg | Weder Vermerk noch stilles Entfernen loser Uploads | offen |
| R-0654 Fristen je Datenart, selbsttätig | Nur Papierkorb (30 Tage, fest im Code); alles andere ohne Frist | offen, Ownerfrage 1 |
| R-0657 Aufbewahrung/Auskunft/Export/Löschung inkl. Projektionen, Vektoren, Sicherungen; Löschsperre; Folgenabschätzung | Projektion und Vektor folgen der Endlöschung (nach Commit bzw. vorab, fehlertolerant); Sicherungen existieren, Löschung wirkt nicht hinein; keine Löschsperre; keine durchgeführte DSFA | teilweise |
| R-0662 Löschnachweis bei Abschaltung einer Kundeninstanz | Nicht vorhanden | offen |
| R-1564 Rest | Veralteter Kommentar korrigiert; die „NICHT GEPRÜFT“-Liste bleibt ungeprüft | s. unten |

## Je Anliegen

### R-0634 — Endlöschung eines Wissensobjekts

Einziger harter Löschpunkt ist `KoService.purgeKo` (`services/knowledge-object/src/service.ts`,
um Zeile 3965). Ihn rufen der Papierkorb-Sweep (`runTrashSweep`), `purgeTrashed` und
`delete({ hard: true })`.

**Geliefert:**
- Mit Datenbank laufen Aufräumbeitrag (`onPurgeTx`), `DELETE FROM kos` und der Beleg `ko.purged` in
  EINER Transaktion (`withTx`). Scheitert ein Schritt, ist nichts gelöscht und nichts belegt.
  Belege: `tests/ko/trash-tx-pg.integration.test.ts` (echte Rückrollung, Prüfserver),
  `tests/aufraeumen-atomar/aufraeumen-faehrt-in-der-transaktion.test.ts`,
  `tests/aufraeumen-atomar/speicher-schreiben-auf-dem-transaktionsclient.test.ts` (JOB 3066/1104).
- Der Beleg nennt den Umfang: `konflikteGeschlossen`, `ueberschneidungenGeschlossen`
  (`services/app/src/build-app.ts`, `setPurgeTxCleanup`). Beleg:
  `tests/aufraeumen-atomar/loeschbeleg-nennt-umfang.test.ts`.
- Suchprojektionen werden nach dem Commit entfernt (`searchProjections.removeByKo`, Fehler werden
  verschluckt); der Duplikat-Vorfilter (Textvektor, nur im Speicher) wird vor der Transaktion
  bestmöglich bereinigt (`removeKoFromDuplicatePrefilter`).

**Nicht geliefert:**
- Fassungen (`ko_versions`), Belege (`ko_evidence`), Anhang-Dateien (Object-Store `objects`) und
  Beziehungen (`ko_kanten`) bleiben nach der Endlöschung stehen. Keine dieser Tabellen hat einen
  Fremdschlüssel auf `kos`; `ObjectStoreService.delete` hat ausserhalb des Stores keinen Aufrufer.
- Für Kanten ist das Stehenbleiben eine **bewusste Entscheidung** (`kanten-repo-pg.ts`, Kommentar
  „KEIN `ON DELETE CASCADE` und kein Aufräumlauf: Eine kuratierte Beziehung ist eine
  Urheberaussage“); der Lesepfad blendet verwaiste Kanten aus. `tests/ko/kante-purge-atomar.test.ts`
  prüft nur den Transaktionshaken mit einem Testdouble, keinen echten Kanten-Purge.
- Ohne Datenbank (InMemory, Dev-Journal) gibt es keine Atomarität: Beleg zuerst, dann Löschen
  (ausdrücklich so dokumentiert im sequentiellen Rückfall von `purgeKo`).
- Der Beleg zählt Fassungen, Anhänge und Kanten nicht, weil sie nicht entfernt werden.

### R-0637 — Träger löschen: verhindern statt mitlöschen

- Im ganzen Schema (DDL in TS-Dateien, keine `.sql`-Migrationen) gibt es drei Fremdschlüssel: zwei
  `ON DELETE CASCADE` (`gesamtanweisung_bausteine`, `gesamtanweisung_staende` →
  `gesamtanweisungen`, `services/knowledge-object/src/gesamtanweisung-repo-pg.ts:83,96`) und einen
  ohne Klausel (`import_run_item_refs` → `import_runs`, NO ACTION). **Kein `ON DELETE RESTRICT`.**
- Kein Träger (Wissensobjekt, Konto, Upload) hat ein Löschhindernis für abhängige Daten. Das
  Gegenteil gilt: abhängige Daten bleiben verwaist stehen (R-0634, R-0642).
- Frist, Wirkung und Spur je Träger sind nicht festgelegt (s. R-0654).

### R-0638 — Export, Aufbewahrung, Wiederherstellung

- **Export:** fachlich vorhanden (`GET /api/library/export`, JSON/Markdown/MediaWiki/HTML). Ein
  personenbezogener Komplettexport (Art. 15/20) ist laut
  `docs/compliance/gdpr-compliance-runbook.md` §3 und §7 (NFR-PRV-04 / SCRUM-214) **manuell**
  durch Admin/DSB, kein Produktmerkmal.
- **Aufbewahrung:** nur als Tabelle mit offenen Betreiberfristen
  (`docs/compliance/data-protection-requirements.md` §3, `docs/operations/monitoring-logging.md`).
- **Wiederherstellung:** über die Planungsunterlage hinaus geliefert — Sicherung und Restore-Drill
  gegen echte Postgres (JOB 4010 `fade4116`, JOB 4097 `d0bd44d4`: ganzer Tabellenbestand),
  Dauerbetrieb und `BACKUP_KEEP` (JOB 4057 `4bc69a8e`), parallele Sicherungen (JOB 4227
  `65ef0eae`). Wege: `scripts/backup/backup.sh`, `scripts/backup/restore-drill.sh`,
  `docs/operations/restore-drill.md`, `docs/operations/backup-disaster-recovery.md`. Belege:
  `tests/backup-drill/`, `tests/sicherung-dauerbetrieb/`, `tests/backup-parallel/`. Dies ist ein
  **gesonderter, abgeschlossener Teilumfang** (Kundenbetrieb-Backup) und wird hier nicht neu gebaut.

### R-0642 — Konto löschen

- `AuthService.deleteUser` (`services/auth/src/service.ts`, um Zeile 1080): Letzter-Admin-Schutz,
  `DELETE FROM users`, `DELETE FROM sessions WHERE user_id`, Beleg `user.delete`. Sonst nichts.
  Zwei Routen: `DELETE /api/auth/users/:id`, `DELETE /api/users/:id`.
- Die Kennung bleibt unverändert in `kos`/`ko_versions` (Autor), `ratings`, `assignments`, `gaps`,
  `klara_sessions`, Upload-`owner` und im Audit. Kein Umschreiben auf „ehemaliger Nutzer“.
- Die Oberfläche zeigt für unbekannte Kennungen „Unbekannte Person (xxxxxx)“ mit gekürztem
  Kennungspräfix (`apps/web/src/lib/koAuthor.ts`). Das ist pseudonym, nicht anonym.
- Sicherungskopien enthalten das Konto weiterhin (so auch im Zielzustand vorgesehen).

### R-0646 — Entfernte Quelle

- `removeAttachment` und `removeSource` (`services/knowledge-object/src/service.ts`) filtern den
  Eintrag heraus und schreiben `ko.detached` bzw. `ko.source-removed` — ohne Kennung der entfernten
  Quelle, ohne Prüfung, ob sie zitiert ist, ohne Vermerk.
- Indirekte Restspur: der `ko_evidence`-Eintrag bleibt; die Oberfläche meldet dann
  `evidence-without-source/attachment` (`apps/web/src/lib/evidenceConsistency.ts`). Das ist ein
  Konsistenzhinweis, kein gewollter Vermerk.
- Lose, nicht zitierte Uploads verschwinden nicht — es gibt keinen Waisen-Sweep
  (`OBJECT_RETENTION_DAYS = 30` in `services/object-store/src/types.ts` ist eine Schutzfrist,
  noch ohne Verbraucher).
- Abgrenzung: der „Grabstein“ für zurückgezogene Dublettenbefunde (`docs/entscheidungen/dubletten-rueckzug.md`)
  ist ein gesonderter Auftrag und betrifft keine Quellen.

### R-0654 — Fristen je Datenart

| Datenart | Stand |
| --- | --- |
| Papierkorb | Endlöschung nach **30 Tagen**, fest im Code (`TRASH_RETENTION_DAYS`, `service.ts:203`); einstellbar nur das Prüfintervall (`KLARWERK_TRASH_SWEEP_INTERVAL_MS`, Standard 6 h) |
| Modellläufe (`model_runs`) | kein Löschweg; Frist „vom Betreiber festzulegen“ |
| Antworten (`answer_records`, `answer_snapshots`) | kein Löschweg |
| Geschlossene Wissenslücken | nur manuell `DELETE /api/gaps/:id` |
| Abgelaufene Anmeldesitzungen | zwei Löschwege, beide ohne Frist und ohne Zeitplan: **beim Zugriff** löscht `AuthService.authenticate` eine abgelaufene Sitzung, deren Token vorgelegt wird (`services/auth/src/service.ts`, „abgelaufen → beim Zugriff aufraeumen“; Beleg `services/auth/src/service.test.ts` „abgelaufene Sitzung gilt nicht mehr“); **beim PostgreSQL-Serverstart** löscht `migrateAuthTokensAtRest` alle abgelaufenen Sitzungen und Rücksetz-Token (`services/auth/src/repo-pg.ts`). Einen periodischen Aufräumlauf für abgelaufene Sitzungen, die niemand mehr vorlegt, gibt es nicht. |
| Abgelaufene Klara-Sitzungen | `raeumeAbgelaufeneAuf()` (30 Tage) existiert und ist getestet (`tests/app/job2688-klara-jedes-hinsehen-ist-ein-schreibvorgang.test.ts`), aber **nicht verdrahtet** (Kommentar in `klara-session-service.ts`: „ist offen“) |
| Audit | bewusst nur anhängend, nicht löschbar |
| Server-/Proxy-Logs | Betreiber |

Es gibt keine Umgebungsvariable für Aufbewahrungsfristen.

### R-0657 — Löschung in Ableitungen, Sicherungen; Löschsperre; Folgenabschätzung

- Suchprojektion und Duplikat-Vektor folgen nur der Endlöschung eines Wissensobjekts (s. R-0634),
  beide fehlertolerant ausserhalb der Transaktion. Bei Kontolöschung folgt nichts. pgvector gibt es
  nicht (`docs/operations/vector-db-readiness-decision.md`).
- Sicherungen existieren (s. R-0638); `BACKUP_KEEP` rotiert nach Anzahl, ohne gesetzte Variable
  wird nichts geräumt. Gelöschte Daten bleiben in Sicherungen; nach einem Restore werden frühere
  Löschungen nicht erneut angewendet.
- **Löschsperre (Legal Hold):** nicht vorhanden. Die einzige „Löschsperre“ im Code betrifft
  Import-Kandidaten mit offenem Audit (`services/library-analytics`) und ist keine Aufbewahrung.
- **Folgenabschätzung:** nur Schwellwert-Entscheidungshilfe (`gdpr-compliance-runbook.md` §2); eine
  durchgeführte DSFA liegt nicht vor (Betreiber/DSB).

### R-0662 — Löschnachweis bei Abschaltung

Nicht vorhanden. `docs/operations/kundeninstanz-neuinstallation.md` beschreibt nur den Aufbau; zum
Löschen steht dort lediglich, dass `docker compose down -v` das Volume `pgdata` mitlöscht. Kein
Abschaltweg, kein Löschprotokoll, kein Beleg für Sicherungen und Offsite-Kopien.

### R-1564 — Rest

- **Erledigt in diesem Lauf:** die veralteten Kommentare im Dev-Journal-Test
  `tests/aufraeumen-atomar/geschlossen-bleibt-geschlossen-im-dev-journal.test.ts` beschrieben noch
  den Einzelupdate-Weg. Sie nennen jetzt den mengenbasierten Weg `closeOpenForKo` und seinen
  Journaleintrag in `services/app/src/dev-persist.ts` (JOB 3066 `8efa9e92`). Nur Kommentar,
  Testkörper unverändert.
- **Weiter ungeprüft** (aus der Quelle übernommen, keine neue Prüfung bestellt): echter
  PostgreSQL-Lauf, EXPLAIN ANALYZE, Verbindungsabbruch mit ungewissem Commit-Ausgang,
  Mehrprozess-/Nebenläufigkeitsversuch, eigener Browserlauf, vollständiger `tools/check`.
- Die abweichende Testsumme durch zwei in der Sandbox übersprungene Rohsocket-Tests
  (`services/app/src/routes/addin-static-routes.test.ts`) ist bekannt und in
  `tests/app/job2622-sandbox-skips.test.ts` erfasst; kein Handlungsbedarf aus diesem Auftrag.

## Quellenwidersprüche

1. **R-0634 gegen R-0637.** R-0634 verlangt, dass beim Löschen von Wissen Fassungen, Anhänge und
   Beziehungen mit verschwinden. R-0637 verlangt, dass beim Löschen eines Trägers abhängige Daten
   **nicht** mitgelöscht werden, sondern der Vorgang verhindert wird. Ob das Wissensobjekt ein
   solcher Träger ist, entscheidet Ownerfrage 3.
2. **R-0634 gegen die Kantenentscheidung.** Der Code hält Beziehungen als Urheberaussage bewusst
   über die Endlöschung hinaus (`kanten-repo-pg.ts`). R-0634 verlangt ihre Entfernung.
3. **28 gegen 30 Tage.** R-0654 nennt 28 Tage Papierkorb. Seit JOB 4327 (Pedi 17.09.2026) gelten
   30 Tage. Die jüngere Nutzerentscheidung bleibt wirksam.
4. **„Sicherungen fehlen ganz“ (R-0657)** ist durch JOB 4010/4057/4097/4227 überholt; was weiter
   fehlt, ist Löschung **in** Sicherungen und die Löschsperre.
5. **„Nur eine Planungsunterlage“ (R-0638)** ist überholt für die Wiederherstellung (Restore-Drill
   geliefert) und für den fachlichen Export: `GET /api/library/export`
   (`services/app/src/routes/library-routes.ts`) liefert JSON, Markdown, MediaWiki und HTML mit
   Rollenfilter, belegt in `tests/security/library-export-egress.test.ts` und
   `tests/security/g6-export-formate-vertraulich.test.ts`. Weiter zutreffend ist die Aussage nur für
   den **personenbezogenen Komplettexport** (Art. 15/20; heute manuell durch Admin/DSB, NFR-PRV-04)
   und für die **Aufbewahrungsfristen** (nur offene Betreiberfristen in der Doku).
6. **Dokumentation gegen Code:** `docs/compliance/data-protection-requirements.md` §3 sagt
   „Prompts/Antworten werden nicht gespeichert“. Antworten liegen heute in `answer_records` und
   `answer_snapshots` (`services/ask/src/repo-pg.ts`). Diese Aussage ist veraltet; sie wird hier
   benannt und nicht ungeprüft umgeschrieben, weil die Einordnung (Inhalt oder Metadaten) Teil von
   Ownerfrage 1 ist.

## Fünf Ownerfragen (vor jedem Purge-Vertrag)

1. **Aufbewahrung:** Welche Frist gilt je Datenart (Modellläufe, Antworten, geschlossene Lücken,
   abgelaufene Sitzungen, Protokolle, Sicherungen), und ist sie einstellbar (R-0654, R-0657)?
2. **Datenschutz:** Wird bei Kontolöschung auf „ehemaliger Nutzer“ umgeschrieben, und gilt das
   auch für das hash-verkettete Audit (Art. 17 gegen Nachweispflicht) (R-0642)?
3. **RESTRICT oder Cleanup je Träger:** Welche Träger verhindern ihre Löschung bei abhängigen Daten
   (R-0637), welche räumen sie mit ab (R-0634) — und gilt die Kantenentscheidung weiter?
4. **Cleanup-Spur:** Wo bleibt der Nachweis eines Löschvorgangs (Beleg im Audit, eigener
   Löschnachweis, Abschaltbeleg R-0662), und was nennt er (Umfang je Datenart, Sicherungen)?
5. **Zusammengesetztes Kennungsformat:** In welchem Format werden die gelöschten Bestandteile im
   Nachweis gekennzeichnet (Objektkennung mit Fassung/Anhang/Kante)? Die Quelle nennt das Format
   nicht; es ist offen und hier nicht erfunden.

## Abgrenzung

- Gesondert und abgeschlossen: Papierkorb mit Aufräumen in der Transaktion (JOB 3066/1104),
  Dubletten-Rückzug (`docs/entscheidungen/dubletten-rueckzug.md`), Kundenbetrieb-Sicherung und
  Restore-Drill (JOB 4010/4057/4097/4227), Papierkorbfrist 30 Tage (JOB 4327).
- Nicht Teil dieser Aufnahme: Bau eines Purge-Vertrags, Kontoanonymisierung, Löschsperre,
  Fristenmechanik, Abschaltnachweis. Sie folgen erst nach den Ownerentscheidungen.

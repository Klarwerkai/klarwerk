# Wissensrelevante Aktionen vollständig und manipulationsnachweisbar protokollieren

*Aufnahme 20260922 · gesamt-auditprotokoll (NFR-TAI-01, FR-AUD-01/02).*

*Lauf 3 (`lauf:b3:aufnahme:20260922:gesamt-auditprotokoll:3`, Basis `41fad46c`, `1.0.0-beta.1.627`).
Lauf 1 und Lauf 2 wurden nicht in den Hauptstand übernommen (Lauf 2 am 27.09. ausdrücklich
zurückgesetzt). Lauf 3 legt den Lieferstand aus Lauf 2, Runde 1 (Commit `222abf95`: Lauf-1-Lieferung
plus Lauf-2-Befunde zu R-0766 und Re-Validierung) unverändert auf den Hauptstand — geprüft, konfliktfrei
— und behebt Bens zwei Befunde aus Lauf 2 (`beleg:6818bd52`, `beleg:1ea197ac`) sowie Bens Befund
BEN-B1 aus Lauf 3, Runde 1, sowie BEN-R2-B1/-B2 aus Runde 2 **neu** (Abschnitt „Lauf 3" unten). Die Lösungen aus Lauf 2, Runden 2
und 3 (prozessinterne Schreibfolge, Kompensation statt Transaktion) wurden bewusst nicht übernommen.
Die Tabellen darunter sind die übernommene Beschreibung aus Lauf 1/2; ihre Belege liegen in diesem
Lauf erneut im Baum und wurden hier gefahren (s. „Prüfstand").*

## Lauf 3 — gemeinsam festgeschrieben oder gemeinsam verworfen

| Befund | Lieferung | Beleg |
| --- | --- | --- |
| `beleg:6818bd52` (Lauf 2, Commit `758e76c1`): gleichzeitige `GET /api/audit/export` lasen denselben Vorgänger, zwei Einträge mit derselben `seq`, Kette gebrochen (`linkageBreaks=1`) | Vorgänger lesen und anhängen sind EIN Schritt der Ablage: `AuditRepo.appendNext`. Speicher: synchron ohne `await` dazwischen, dazu Spiegel des Primärschlüssels (`AUDIT_SEQ_BELEGT`). PostgreSQL: `pg_advisory_xact_lock(613000001)` → letzter Eintrag → INSERT auf **einem** Client; mit `tx` in der Transaktion des Aufrufers (Sperre bis zu dessen Commit), ohne `tx` in eigener kurzer Transaktion mit `lock_timeout` 15 s. Wirkt datenbankweit, also auch zwischen zwei Instanzen | `tests/audit-gesamt/gemeinsam-oder-gar-nicht.test.ts` (B1: acht parallele Exporte über HTTP; 20 parallele `record`/`recordOnce`; Kalibrierung alter Weg); `tests/audit-gesamt/kette-und-beleg-atomar.integration.test.ts` (PostgreSQL: zwölf Exporte über **zwei App-Instanzen** gegen dieselbe Datenbank; choreografiert: B wartet an `advisory`, danach `seq+1`); `tests/pg-erstaufbau-konkurrenz/erstaufbau-konkurrenz.integration.test.ts` E3 auf das neue Soll umgestellt (vorher 23505 `audit_pkey`) |
| `beleg:1ea197ac` (Lauf 2 Runde 2, Commit `d3c1bc09`): `POST /api/kos` → 500, Objekt trotzdem im Bestand, ohne `ko.created` | Erfassen: `KoService.schreibeErstanlage` — mit `withTx` Insert, Fassung, Suchprojektion, Belegkette und `ko.created` in EINER Transaktion (`KoRepo.insert(ko, tx)`, `EvidenceRepo.append(r, tx)` neu); ohne `withTx` Rücknahmeklammer `rollbackCreatedKo`. Gilt für `create` (mit/ohne Vorgang) und `createWithDocuments`; **löst WP-SHIP8-CLOSE-5 ab**. Ändern: `schreibeMitBeleg` (Write und Beleg in einer Transaktion; ohne sie erst Write, dann Beleg, bei Ausfall Vorzustand zurück) für `mutateKo` (Vertraulichkeit, Eigentum, Kommentar-Erledigung, Vorschlag, Autor-Übergabe), Kommentar, Anhang an/ab, Quelle an/ab, Papierkorb, Wiederherstellen, Wahrheitskonflikt-Rückstufung, Eigentumsrolle; Kategorie/Tags und Dokumentübernahme mit `withTx` ebenfalls in einer Transaktion. `mutateKo` schrieb den Beleg bis dahin VOR dem Speichern — ein gescheiterter Write hinterließ einen Beleg für nichts | Speicher: `gemeinsam-oder-gar-nicht.test.ts` (B2: `ko.created`-Ausfall → 500, kein Objekt; Kommentar/Vertraulichkeit-Ausfall → Objekt unverändert; Speicher-Ausfall → kein Beleg). PostgreSQL: `kette-und-beleg-atomar.integration.test.ts` mit **echtem Ausfall per Datenbank-Trigger** (Erfassen: kein Objekt, keine Fassung, keine Projektion, keine Belegzeile, kein Eintrag; Ändern: Objektzeile bitgleich; umgekehrt: kein Beleg) und dem gemeldeten Auslöser „Anlage gegen offenen Fremdschreiber" → 201, genau ein `ko.created`, jedes Objekt im Bestand mit genau einem |
| BEN-B1 (Lauf 3 Runde 1): Peer- und Admin-Validierung speicherten Status/Vertrauen VOR dem Entscheidungsbeleg; bei dessen Ausfall blieb das Objekt „validiert, Vertrauen 99" ohne Beleg und ohne `validationDecisionRef` | `KoService.setValidationStateMitBeleg`: unter dem KO-Lock Compare-and-Set gegen die bewertete Fassung → Zustand → Beleg des Aufrufers → `validationDecisionRef`; mit `withTx` in EINER Transaktion, ohne sie Vorzustand zurück plus Rücknahme des Aufrufers. `ValidationService.rate`: Bewertung (`RatingRepo.upsert(r, tx)`), Zuweisung erledigt, `ko.rated`, bei Gelb/Rot Rückgabe (`AssignmentRepo.create/update(a, tx)`, `ko.returned-to-*`) — alles im Belegschritt. `adminValidate`: `ko.admin-validated` im Belegschritt; verfehlter Compare-and-Set schreibt weiterhin nichts (JOB 3789). `validators` wird nur nach tatsächlich geschriebener Validierung fortgeschrieben | Speicher: `gemeinsam-oder-gar-nicht.test.ts` (BEN-B1: Grün/`ko.rated`, Rot/`ko.returned-to-*`, Admin/`ko.admin-validated` — je Objekt offen, Vertrauen gleich, keine Bewertung, kein Verweis, keine offene Zuweisung; Gegenprobe ohne Ausfall mit Verweis auf den Beleg). PostgreSQL: dieselben drei Fälle in `kette-und-beleg-atomar.integration.test.ts` (Trigger; Objektzeile, `ratings`, `assignments`, `audit` bitgleich) |

| BEN-R2-B1 (Lauf 3 Runde 2): `rate` bildete die Stimmenlage VOR der Schreibklammer — zwei gleichzeitige Bewertungen sahen die Stimme des anderen nicht (up+up bei Quorum 2 blieb offen/50, down+up bei Quorum 1 wurde validiert/99) | `setValidationStateMitBeleg` nimmt statt eines fertigen Zustands `zustand(ko)` und ruft es UNTER dem KO-Lock; `rate` liest dort Bewertungen und Zuweisung (`lese`). Zwei Instanzen: verliert eine Transaktion den Compare-and-Set an die andere (`STALE_WRITE`), rollt sie ganz zurück und die Klammer rechnet einmal frisch — mit der festgeschriebenen fremden Stimme | Speicher: `gemeinsam-oder-gar-nicht.test.ts` („am Dienst: up + up … / down + up …", an Runde 2 rot: `offen/50` statt `validiert/99`; die zwei HTTP-Varianten sind Nutzerweg, verschränken sich aber nicht genug und waren auch an Runde 2 grün). PostgreSQL: `kette-und-beleg-atomar.integration.test.ts` („BEN-R2-B1 · … gleichzeitig über zwei Instanzen") |
| BEN-R2-B2 (Lauf 3 Runde 2): im Speicherweg blieb nach einem späten Ausfall (`ko.returned-to-*`) der schon angehängte `ko.rated` unkommentiert stehen, und eine neu angelegte Zuweisung blieb als „erledigt" zurück | Zuweisungen: optionaler Löschweg `AssignmentRepo.remove` (Speicher, PostgreSQL); eine im Ausfall neu angelegte Zuweisung wird entfernt. Belege: die drei Speicherweg-Klammern (`setValidationStateMitBeleg`, `schreibeMitBeleg`, `schreibeErstanlage`) merken den Kettenkopf und hängen nach gelungener Rücknahme `ko.change-rolled-back` an (`rolledBackSeqs`, `grund`, bei der Validierung `restoredStatus`/`restoredTrust`) — die Kette bleibt append-only, der tatsächliche Ausgang steht darin. Mit Transaktion gibt es nichts zu berichtigen | `gemeinsam-oder-gar-nicht.test.ts` Rot-Fall: Zuweisungen vollständig wie vorher; neue Einträge genau `ko.rated`, `ko.change-rolled-back` mit dessen `seq` (an Runde 2 rot) |

**Mitgezogene Tests (sie schrieben den ausgeschlossenen Halbzustand als Soll fest):** `tests/app/review-claim-recovery.test.ts`
(CLOSE-5/CLOSE-6), `tests/ko/g27-welle1-atomaritaet-und-ruecknahme.test.ts` („benannte Grenze"),
`tests/demo-erster-nutzerweg/promote-traegt-die-herkunft.test.ts` (H12 → Altbestand über `verschlucken`,
neu H12b) — diese drei in der Fassung aus Lauf 2, Runde 3 (`6b374f64`), geprüft und übernommen;
`tests/app/import-cleanup.test.ts` (Papierkorb ohne `ko.deleted` → jetzt ehrlich „skipped");
`tests/ko/job2704-vier-schritte-eine-transaktion.test.ts` (Zähler beginnen nach der jetzt selbst
transaktionalen Anlage); Pool-Doppel in `tests/app/job2698-*` kennen `connect` und die Sperranweisungen;
Zeilenwegweiser neu gemessen (`vermerk-uebersetzung.test.ts`, `knowledge-check.ts`, `repo.ts`).

**Kalibrierung (lokal, Speicherweg):** Die neun Fälle in `gemeinsam-oder-gar-nicht.test.ts` wurden gegen die
alte Fassung gefahren (Audit-Dienst, Audit-Ablage und KO-Dienst aus `41fad46c` bzw. der Lauf-2-Fassung
von `service.ts` für den Exportweg; für BEN-B1 der Validierungsdienst aus Runde 1): alle rot
(`seq` `[1,2,2,2,…]`, Objekt ohne `ko.created` vorhanden, Beleg ohne gespeicherte Änderung, „validiert"
nach Beleg-Ausfall); an dieser Fassung grün. **Die PostgreSQL-Integrationsfälle konnten hier nicht
laufen** (keine Datenbank- oder Containerstarts auf dem Produktions-Mac); fehlendes Prüfmittel:
`integration-postgres`. Die Kalibrierung dort (rot an `41fad46c`) ist damit ebenfalls offen.

**Prüfstand (lokal, macOS, an dieser Fassung):** `npx tsc --noEmit` (Wurzel, Web) grün;
`depcruise` ohne Verstoß; Biome-Lint der 45 geänderten Dateien grün; `vitest` (mit
`KLARWERK_SKIP_KEYCHAIN=1`) über `tests/app`, `services/app`, `tests/security`, `tests/beta-rollenabnahme`,
`tests/ko`, `tests/audit*`, `tests/validation`, `tests/auth`, `services/{audit,knowledge-object,validation,
lifecycle,conflicts,ask,auth,library-analytics,db-tx}` u. a.: 785 Dateien, 7503 Fälle grün. Nicht gefahren:
alle `*.integration.test.ts` (PostgreSQL) und Browser-Dateien — fehlendes Prüfmittel
`integration-postgres` bzw. Serverweg.

**Grenzen (Lauf 3):**
- Ohne `withTx` (Speicher, Dev-Journal) ist „gemeinsam verworfen" eine Kompensation, keine Transaktion:
  ein Prozessabbruch zwischen Write und Beleg bleibt dort möglich. Append-only-Belegzeilen
  (`ko_evidence`) bleiben im Speicherweg bei einem späteren Beleg-Ausfall stehen (harmloser Spiegel wie
  bisher bei `appendDocumentExtract`).
- Die Kettensperre serialisiert alle Auditschreiber bis zum Commit ihrer Transaktion. Transaktionen,
  die zuerst den Beleg und dann eine Objektzeile schreiben (`answer.helpful` → Vertrauensschritt), und
  solche in umgekehrter Reihenfolge (Revision → Beleg) können sich am **selben** Objekt gegenseitig
  sperren; PostgreSQL erkennt das als Verklemmung und bricht eine der beiden vollständig ab (keine
  Teilwirkung). Vorher scheiterte in derselben Lage eine der beiden an `audit_pkey`.
- Nicht auf die Klammer umgestellt: die Rücknahme-Belege der Speicherweg-Kompensation selbst
  (`ko.create-rollback-failed`, `ko.change-rolled-back`) und Wege außerhalb des Wissensobjekts
  (Nutzerverwaltung, Anmeldung, Konfliktbefunde), die ihre bisherige Reihenfolge behalten.

## Übernommen aus Lauf 1/2 (Lieferstand `222abf95`)

| Lücke (am Basisstand gemessen) | Lieferung | Beleg |
| --- | --- | --- |
| §12.3 „Export": der Bibliotheks-Export schrieb **keinen** Eintrag | `library.export` (wer, Format, `count`, `koIds`, `includeConfidential`) für JSON, Markdown, MediaWiki, HTML — `LibraryService.exportJson` mit `beleg`, Route `GET /api/library/export` | `tests/audit-gesamt/aktionsmatrix-12-3.test.ts` |
| §12.3 „Re-Validierung": „Stimmt noch" erschien nur als `ko.revised`, ununterscheidbar von einer Überarbeitung | eigener Eintrag `ko.revalidated` (`version`, `pendingCleared`); DE/EN/NL-Namen, erscheint auch in der Herkunftskette. **Runde 2:** der Beleg läuft im Audit-Schritt der Revision (`KoService.revise`, Option `zusatzBeleg`) — fällt er aus, rollt die Fassung zurück und der „Stimmt das noch?"-Merker bleibt | `tests/audit-gesamt/aktionsmatrix-12-3.test.ts`, `tests/audit-gesamt/revalidierung-ausfall.test.ts`, `tests/audit-gesamt/revalidierung-atomar.integration.test.ts` (PostgreSQL) |
| R-0766 durchgehende Kette am Objekt (Runden 2 und 3) | `koAuditEvents` (`apps/web/src/lib/koLineage.ts`) nimmt außer `target === ko.id` jeden Beleg auf, der das Objekt in der Nutzlast nennt (`koId`/`koIds`, z. B. `library.export`), und alle Belege zu Konflikten **und Überschneidungen**, an denen es beteiligt ist. `conflict.created`/`conflict.auto-created` sowie `overlap.auto-created`, `overlap.in-progress`, `overlap.superseded` und die Entscheidungen `overlap.kept-separate`/`linked-related`/`dismissed` tragen dafür `koIds`; Alt-Konfliktbelege werden über die bekannten Konflikte des Objekts gefunden (`MehrAbschnitte.tsx`). DE/EN/NL-Namen für `conflict.*` und `overlap.*` | `tests/audit-gesamt/objektkette.test.ts` |
| Re-Validierung: Merker-Beleg (Runde 3; in Lauf 2 abgelöst, s. u.) | `confirmStillValid` löschte den „Stimmt das noch?"-Merker **vor** Revision und Beleg; `pendingCleared` sagt nur, was bereits geschehen ist. Scheitert das Löschen, entsteht weder Fassung noch Beleg; scheitert die Revision, wird der Merker wieder gesetzt | `tests/audit-gesamt/revalidierung-ausfall.test.ts`, `tests/audit-gesamt/revalidierung-atomar.integration.test.ts` (PostgreSQL, Ausfall von `clearPending`) |
| Rücknahme ohne Transaktion (Runde 3) | Im Weg ohne `withTx` bleibt ein vor dem Ausfall angehängter Beleg (z. B. `ko.revised` mit Fassung 2) stehen — unverändert, die Kette ist append-only. Nach **gelungener** Rücksetzung hängt `KoService` `ko.change-rolled-back` an (`version`, `restoredVersion`, `rolledBackSeqs`), sodass der tatsächliche Ausgang im Protokoll steht. Mit Transaktion (Betrieb) verschwinden die Belege mit dem Rollback, ein Rücknahmebeleg entsteht dort nicht | `tests/audit-gesamt/revalidierung-ausfall.test.ts`, `tests/audit-gesamt/revalidierung-atomar.integration.test.ts` |
| R-0613 „ein externer Anker und ein Export fehlen" | `GET /api/audit/export` (Recht `ko.validate`, wie `/api/audit`): alle Einträge, Prüfbericht, Kopf (letzte Nr. + Hash); der Abruf wird als `audit.exported` mit dem Kopf angehängt. Knopf „Kette exportieren" im Prüfprotokoll zeigt den Kopf im Klartext | `tests/audit-gesamt/append-only-http.test.ts`, `tests/audit-gesamt/pruefprotokoll-export.test.tsx` |
| R-2206 „Append-only-Verweigerung über sämtliche schreibenden API-Methoden nicht geprüft" | Messung: POST/PUT/PATCH/DELETE als Admin auf `/api/audit`, `/api/audit/:seq`, `/verify`, `/export` → 404, Kette danach gleich; Speicher- und Pg-Ablage ohne ändernde Methode | `tests/audit-gesamt/append-only-http.test.ts` |
| R-2206 Restmatrix ohne Eskalation, Kategorie, Re-Validierung, Konfliktauflösung, Export | Eine HTTP-Matrix über **alle** §12.3-Aktionen mit der jeweils handelnden Rolle, Kette danach nachgerechnet | `tests/audit-gesamt/aktionsmatrix-12-3.test.ts` |
| package:audit „Hilfetext erklärt Qualitätsbezug, keine Zertifizierungszusage" | Hilfe `adm.sich.qualityNote` (DE/EN/NL) am Prüfprotokoll: ISO 9001 / ISO/IEC 27001 als Rahmen, keine Zertifizierungszusage, keine Leistungsbewertung von Personen (R-0669) | `tests/audit-gesamt/pruefprotokoll-export.test.tsx` |

### Lauf 2, Runde 1 — Bens zwei offene Befunde aus Lauf 1, Runde 3 (übernommen)

| Befund | Lieferung | Beleg |
| --- | --- | --- |
| R-0766: abgeschlossene Alt-Überschneidungen (Belege ohne `koIds`) fehlten in der Objektkette — die Oberfläche kannte nur offene Konflikte | `ConflictService.idsForKo` / `OverlapService.idsForKo` (alle Befunde des Objekts, offen **und** abgeschlossen, aus dem gespeicherten Befund `koA`/`koB`); Leseweg `GET /api/audit/ko/:koId/findings` (Recht `ko.validate` wie `/api/audit`, nur Kennungen); `MehrAbschnitte.tsx` reicht sie an `koAuditEvents`. Kein Beleg wird umgeschrieben | `tests/audit-gesamt/objektkette.test.ts` („Lauf 2 · abgeschlossene Alt-Überschneidung …", am Draht, mit Betrachter-403); Register: `tests/security/routeGuardAudit.ts`, `tests/security/mega74-lesewege-sammler.test.ts`, `tests/beta-rollenabnahme/tabelle.ts`; `append-only-http.test.ts` schließt die neue Adresse ein |
| Re-Validierung: der Merker wurde vor und außerhalb der Revision gelöscht — ein Fehler danach (z. B. verlorene Antwort nach ausgeführtem `DELETE`) ließ ihn ohne Fassung und Beleg verschwinden | Das Löschen läuft jetzt **im Audit-Schritt der Revision** (`KoService.revise`, `zusatzBeleg.vorher`): mit `withTx` auf demselben Transaktionsclient (`LifecycleRepo.clearPending(koId, tx)`) — Merker, Fassung, `ko.revised`, `ko.revalidated` committen gemeinsam oder gar nicht. Ohne `withTx` rollt `KoService` die Fassung zurück und `confirmStillValid` setzt einen vorher gesetzten Merker wieder. `pendingCleared` ist die Antwort des Löschens selbst (`clearPending` gibt zurück, ob ein Merker da war) | `tests/audit-gesamt/revalidierung-ausfall.test.ts` („Fehler NACH ausgeführtem Löschen", „ohne vorherigen Merker …"), `tests/audit-gesamt/revalidierung-atomar.integration.test.ts` („DELETE ausgeführt, danach Fehler", „Beleg-Ausfall nach dem DELETE", je direkt an `lifecycle_pending` gemessen) |

### Die §12.3-Matrix und ihre Aktionscodes

Erfassen `ko.created` · Validieren `ko.rated` (up) / `ko.admin-validated` · Ablehnen `ko.rated`
(down) / `ko.proposal-rejected` · Kommentieren `ko.commented` · Konflikt `conflict.created` ·
Eskalation `conflict.escalated` · Auflösung `conflict.resolved` · Zuweisung `ko.assigned` · Kategorie
`ko.category-changed` · Re-Validierung `ko.revalidated` (neu) · „Hat geholfen" `answer.helpful` ·
Export `library.export` (neu) · Import `library.import` · Login/Logout `auth.login`/`auth.logout` ·
Nutzerverwaltung `user.*` (u. a. `user.role-change` mit Vor-/Nachrolle und Namen) · Autor-Übergabe
`ko.author-transferred`.

## Vorhandene Lieferungen — nicht neu gebaut

| Kriterium | Stand in `1.0.0-beta.1.612` | Fassung / Beleg |
| --- | --- | --- |
| R-2125, R-1743 Audit-Log; FR-AUD-01 wer/was/wann | `AuditService.record` (seq, at, actor, action, target, payload) | `services/audit/src/service.test.ts`; Grundlieferung `bc87f455` (05.07.) |
| R-2126, FR-AUD-02 append-only | Ablage ohne update/delete (`repo.ts`), Einträge eingefroren; HTTP-Messung jetzt ergänzt | `service.test.ts`; dieser Lauf |
| R-0613, R-1077 Hashkette, Prüflauf unterscheidet Bruch und Formatabweichung | `inspectChain` (linkage / serialisation / unresolved / unchecked) | `services/audit/src/inspect-chain.test.ts`; `d3fe69da` (26.07., mega14) |
| R-0835, R-1118 zweite Kettenfassung (V2) mit Test, Integrationstest prüft Hash und Fassungsnummer | `hashEntryV2`, `hash_version`-Spalte, V1-Altbestand bitgenau prüfbar | `services/audit/src/chain-v2.test.ts`, `services/audit/src/repo-pg.integration.test.ts`; `115b6cd8` (17.08.), `be3cd314` (JOB 4321 D3). **In diesem Lauf nicht wiederholt** |
| R-1085, R-1757 Verwalter sieht letzte Aktionen, Gesamtzahl, Prüfknopf | `PruefprotokollDetail` (12 jüngste, Zähler, „Integrität prüfen" mit drei Ergebnissen) | `tests/design/h6-funktionsinventar.test.ts`, `apps/web/src/lib/auditVerifyState.ts` |
| N-0027, N-0080, priority:UX-11 Rollenänderung verständlich, Handelnder zugeordnet | Beschriftete Zeilen Ereignis / ausgeführt von / betroffen / Rolle vorher–nachher, gelöschte Konten benannt, Kennungen im Detail | `tests/audit-rollenwechsel/*`; `1f12397f` (09.09., JOB 3140) |
| R-0766 Kette am Wissensobjekt (Grundlage) | Herkunftskette (`koLineage.ts`, `koAuditEvents`), in Runde 2 erweitert (s. o.) | `f521454d` (25.06.); `tests/ux26-herkunft-belege/*` |
| R-0733 Entscheidungen protokolliert (Server-Protokoll) | pino-Logger mit Erlaubnislisten `ERLAUBTE_FEHLERTYPEN`/`ERLAUBTE_FEHLERCODES` (`services/app/src/build-app.ts`): jede Fehler-/Abweisungsentscheidung des Servers landet mit stabilem Code und Pfad im Protokoll, ohne Namen und Nutzertext | JOB 2661 D1–D3, Commit `4250cd78` (29.08.), JOB 2933 D2 `6d574fce` (01.09.); `tests/security/log-keine-inhalte.test.ts`, `tests/app/job2693-import-warnt-ueber-den-logger.test.ts` — in Runde 2 an dieser Fassung gefahren: 14/14 grün |
| R-0607 Kommentieren | `ko.commented` existiert | `5471af3b` (25.06.) |

## Rest — offen, mit Grund

- **Externer Anker (R-0613):** das Produkt verankert den Kettenkopf nicht selbst. Es liefert ihn
  jetzt als Datei und im Klartext aus; die Ablage außerhalb (Ausdruck, Ticket, zweites System) ist
  Betreiberhandlung. Ohne sie kann, wer die Datenbank beherrscht, die Kette weiterhin unbemerkt neu
  bilden.
- **Kette am Objekt (R-0766) — Grenzen:** Die Kette ist eine Ableitung in der Oberfläche aus
  `GET /api/audit` und `GET /api/audit/ko/:koId/findings` (beide Recht `ko.validate`) — wer das
  Protokoll nicht lesen darf, sieht sie wie bisher nicht. Ein Altbeleg erscheint, wenn sein Ziel ein
  gespeicherter Befund dieses Objekts ist; ist der Befund selbst nicht mehr gespeichert (etwa nach
  einer Endlöschung, die ihn mit aufräumt), bleibt nur der Beleg im Gesamtprotokoll.
- **Re-Validierung — Speicherbetrieb:** Ohne `withTx` (Speicher-/Dev-Journal-Betrieb) gibt es keine
  Transaktion. Ein Fehler wird dort kompensiert (Fassung zurück, Merker wieder gesetzt); ein
  Prozessabbruch mitten im Schritt verliert ohnehin den ganzen Speicherstand. Im Betrieb mit
  PostgreSQL hält die Transaktion alle vier Schritte zusammen.
- **Rücknahmebeleg:** entsteht nur, wenn die Rücksetzung gelungen ist. Scheitert auch die
  Rücksetzung selbst (Speicherbetrieb), bleibt es beim geworfenen Fehler ohne Rücknahmebeleg.
- **Betroffenenrechte und Aufbewahrung (R-0670):** ausdrücklich getrennt zu behandeln; nicht Teil
  dieser Lieferung.

## Quellenwidersprüche

- **R-0835 (die Spur soll Fälschung ausschließen) / FR-AUD-02 „Manipulationsversuch nicht möglich"** gegen
  R-0613 „verhindert wird sie damit nicht" und die Produktregel `tests/app/chain-claims.test.ts`
  (absolute Sicherheitsversprechen über die Kette sind im Produkt verboten). Belegbar ist: über
  die Schnittstelle nicht änder- oder löschbar (gemessen), in der Datenbank änderbar, aber
  rechnerisch auffällig. Die Oberfläche sagt genau das.
- **R-0607 „Nur das Kommentieren fehlt"**: `ko.commented` wird seit `5471af3b` (25.06.) geschrieben;
  die Aussage ist entweder älter oder bezieht sich auf einen anderen Stand. Die Quelle trägt hier
  kein Datum.
- **R-0733 zugeordnet (Runde 2):** Die Quelle ist das Steuerungsregister
  (`klarwerk_steuerung/register/pflege89-basis.json`, Eintrag R-0733 = Alt-F-0733, Herkunft
  `03_AUFTRAEGE/bereit/MAKROAUFTRAG-PRO-JOB-2661-D2-DER-FEHLERTEXT-IST-DER-OFFENE-KANAL.md`,
  28.08.). Gemeint ist nicht das fachliche Audit, sondern das **Server-Protokoll**: vor JOB 2661
  lief der Server ohne Logger, und nur der Fehlertext an den Aufrufer verriet eine Entscheidung.
  Geliefert mit Commit `4250cd78` (29.08.). Der Registereintrag führt „Wirkung oder Sichtung nach
  dem Einbau nicht belegt"; der Beleg oben ist der Testlauf an dieser Fassung, keine Sichtung im
  Betrieb.
- **package:audit** ist laut Auftrag ein Planvorschlag ohne zugeordnete Nutzerquelle; umgesetzt ist
  nur der Hilfetext, keine Zertifizierungsaussage.

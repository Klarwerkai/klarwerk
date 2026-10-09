# Zusammenschaltung der Module — der Vertrag

*R-1141, mit R-1148 als Inventar (Aufnahme 20260922, zentrale-module-aufteilen). Stand: Kandidat
`69ac08a3`. Beschrieben wird die vorhandene Verdrahtung; diese Datei ändert keine.*

**Was diese Datei zusagt.** Sie nennt jedes beteiligte Modul, jede Ablage mit ihren zwei Adaptern,
jede Einhängestelle von `assembleServices` und die gemeinsamen Klammern. Dass sie mit dem Code
übereinstimmt, misst `tests/architektur-vertrag/zusammenschaltung.test.ts`: er liest
`services/app/src/build-app.ts` und verlangt, dass jede Ablage aus `AppRepos`, jede Option von
`assembleServices`, jeder Adapter aus `inMemoryRepos` und `buildPgServices` und jedes Modul mit
eigener `index.ts` hier steht. Kommt etwas dazu, wird der Prüfstand rot, bis es hier eingetragen ist.

## 1 Das Bild in einem Satz

Ein Prozess (`services/app/src/server.ts`) wählt EINE Ablagenart, baut daraus mit `assembleServices`
die Dienste (`AppServices`) und gibt sie an `buildApp`, das daraus die eine HTTP-App macht. Jedes
Fachmodul wird dabei nur über seine öffentliche `services/<modul>/index.ts` angesprochen.

```
server.ts ──► buildPgServices(pool) ─┐
         ├──► buildDevPersistServices(datei) ─┼─► assembleServices(repos, opts) ─► AppServices ─► buildApp(services)
         └──► buildServices() ───────────────┘
```

## 2 Die drei Kompositionen

Alle drei enden in **derselben** Funktion `assembleServices` (`services/app/src/build-app.ts`).
Sie unterscheiden sich nur in den Ablagen, die hineingehen — „die Service-Verdrahtung darüber ist
identisch" (Kommentar an `AppRepos`).

| Komposition | Wo | Wann (`server.ts`) | Ablagen | Transaktion |
| --- | --- | --- | --- | --- |
| `buildPgServices(rohPool)` | `build-app.ts` | `DATABASE_URL` gesetzt (nach `migrate` und `migrateAuthTokensAtRest`) | je Ablage `Pg…Repo` an EINEM `gatedPool(rohPool)` | `withTx: (fn) => withPgTx(pool, fn)` |
| `buildDevPersistServices(datei)` | `services/app/src/dev-persist.ts` | ohne Datenbank und mit `KLARWERK_DEV_PERSIST=1` | `inMemoryRepos()`, journalierend umhüllt; beim Start aus dem Journal wiederhergestellt | Rücknahme-Klammer (`speicherVorgang`) |
| `buildServices()` | `build-app.ts` | sonst (Schnellstart, Tests) | `inMemoryRepos()` | Rücknahme-Klammer (`speicherVorgang`) |

`inMemoryRepos()` ist der benannte Speichersatz, den `buildServices`, die Dev-Persistenz und die
Rollenabnahme (`tests/beta-rollenabnahme/buehne.ts`) gemeinsam benutzen.

Danach baut `buildApp(services, opts)` die App. Es legt selbst nur an, was die Dienste untereinander
verbindet und keine eigene Ablage hat: den Wächter (`makeGuards(services.auth)`), den
Sitzungsdienst der Klara-Zustimmung über `services.klaraSessions`, den Zuweisungsmelder, den
Vorfilter der Dublettenerkennung, den Hintergrundarbeiter der KI-Prüfung, den Sichtbarkeitszugang
`koSichtbarkeit`, den Dienst der Gesamtanweisungen, den Erklärdienst der Antworten, den
Zugangsdienst der Importe und die Anhangquellen. Die Routengruppen registriert es in fester Folge;
welche das sind und was jede annimmt, steht in [`http-api-referenz.md`](http-api-referenz.md).

## 3 Beteiligte Module und ihre öffentliche Schnittstelle

Die Kernregel ist eine Architekturregel und wird geprüft: `.dependency-cruiser.cjs`,
`module-boundaries` — ein Modul greift in ein anderes **nur** über dessen `index.ts`; dazu
`no-circular` (Fehler) und `no-orphans` (Warnung). Gefahren in `tools/check` und mit `npm run arch`,
**nur über `services/`**.

| Modul | Was die Komposition davon nimmt |
| --- | --- |
| `services/app` | die Wurzel selbst: `assembleServices`, `inMemoryRepos`, `buildServices`, `buildPgServices`, `buildApp`, die Routengruppen unter `src/routes/` |
| `services/auth` | `AuthService`, Konten-, Sitzungs- und Rücksetz-Ablagen, `authRoutes`, `createOidcProviderFromEnv` |
| `services/rbac` | `can`, `canChangeRole` — die Rechte je Rolle |
| `services/knowledge-object` | `KoService`, Bestand, Fassungen, Belege, Upload-Grenzen, Suchprojektion, `Schreibstand`, `KantenRepo`/`KantenLeseService`, `GesamtanweisungDienst`/`AnweisungRepo` |
| `services/audit` | `AuditService` und seine Ablage — ein gemeinsames Protokoll für alle Module |
| `services/capture` | `CaptureService`, Entwurfsablage, Gestaltprüfung der Entwürfe |
| `services/ask` | `AskService`, Lücken, Antwortbelege |
| `services/validation` | `ValidationService`, Bewertungen, Zuweisungen, Prüfeinstellungen |
| `services/conflicts` | `ConflictService`, `OverlapService` und ihre Ablagen |
| `services/library-analytics` | `LibraryService`, Kandidaten, Importläufe, externe Quellsätze |
| `services/lifecycle` | `LifecycleService` und Ablage |
| `services/management` | `ManagementService` |
| `services/media` | `MediaAnalysisService`, gekappter Transkribierer |
| `services/model-runs` | `ModelRunService` und Ablage |
| `services/notifications` | Mailer (`createMailerFromEnv`, `ConsoleMailer`), Gelesen-Ablage |
| `services/object-store` | `ObjectStore` und Ablage |
| `services/output` | `OutputService` |
| `services/reasoner` | `Reasoner`, `ModelProvider`, gekappte Cloud- und Lokalclients, Klara-Sitzungen, Vorlagen, KI-Zuordnung |
| `services/external-search` | externer Suchdienst, Stufenregler und Quellensperre |
| `services/embedding` | Vektorspeicher und Einbettungsanbieter für den Dublettenvorfilter |
| `services/i18n` | `I18nService` |
| `services/db-tx` | `gatedPool`, `withPgTx` — die gemeinsame Datenbankklammer |
| `services/wissensnetz` | `policyNahtSchliessen`, Netzmetrik |
| `services/structure` | Kernaussage und Bildtexte aus HTML (Entwurfs- und Bibliotheksrouten) |
| `services/provenance` | Herkunftskette (`provenanceRoutes`) |
| `services/confluence` | Confluence-Quelladapter (`createConfluenceAdapterFromEnv`), Zugangsstand |
| `services/sharepoint` | SharePoint-Quelladapter, Zugangsstand |
| `services/jira` | Jira-Quelladapter (`createJiraAdapterFromEnv`: Vorgänge und Epics eines Projekts, Projektrollen als Leserechte), Zugangsstand |

## 4 Ablagen: ein Port, zwei Adapter

`AppRepos` ist der Satz Ablagen, den alle drei Kompositionen füllen; die Dev-Persistenz umhüllt
genau diesen Satz (`MUTATING_METHODS` in `dev-persist.ts` ist ein vollständiger Datensatz über
`keyof AppRepos`).

| Ablage (`AppRepos`) | Speicher (`inMemoryRepos`) | Postgres (`buildPgServices`) |
| --- | --- | --- |
| `auditRepo` | `InMemoryAuditRepo` | `PgAuditRepo` |
| `koRepo` | `InMemoryKoRepo` | `PgKoRepo` |
| `koVersions` | `InMemoryKoVersionRepo` | `PgKoVersionRepo` |
| `evidence` | `InMemoryEvidenceRepo` | `PgEvidenceRepo` |
| `users` | `InMemoryUserRepo` | `PgUserRepo` |
| `sessions` | `InMemorySessionRepo` | `PgSessionRepo` |
| `resetTokens` | `InMemoryPasswordResetRepo` | `PgPasswordResetRepo` |
| `secondFactors` | `InMemorySecondFactorRepo` | `PgSecondFactorRepo` |
| `drafts` | `InMemoryDraftRepo` | `PgDraftRepo` |
| `gaps` | `InMemoryGapRepo` | `PgGapRepo` |
| `ratings` | `InMemoryRatingRepo` | `PgRatingRepo` |
| `assignments` | `InMemoryAssignmentRepo` | `PgAssignmentRepo` |
| `conflictsRepo` | `InMemoryConflictRepo` | `PgConflictRepo` |
| `overlapRepo` | `InMemoryOverlapRepo` | `PgOverlapRepo` |
| `overlapSettings` | `InMemoryOverlapSettingsRepo` | `PgOverlapSettingsRepo` |
| `managementProfiles` | `InMemoryManagementProfileRepo` | `PgManagementProfileRepo` |
| `lifecycleRepo` | `InMemoryLifecycleRepo` | `PgLifecycleRepo` |
| `objects` | `InMemoryObjectRepo` | `PgObjectRepo` |
| `candidates` | `InMemoryCandidateRepo` | `PgCandidateRepo` |
| `importRuns` | `InMemoryImportRunRepo` | `PgImportRunRepo` |
| `externalSources` | `InMemoryExternalSourceRepo` | `PgExternalSourceRepo` |
| `dokumente` | `InMemoryDokumentaktenRepo` | `PgDokumentaktenRepo` |
| `modelRuns` | `InMemoryModelRunRepo` | `PgModelRunRepo` |
| `notificationSeen` | `InMemoryNotificationSeenRepo` | `PgNotificationSeenRepo` |
| `assistPresets` | `InMemoryAssistPresetRepo` | `PgAssistPresetRepo` |
| `reasonerPolicy` | `InMemoryReasonerPolicyRepo` | `PgReasonerPolicyRepo` |
| `validationSettings` | `InMemoryValidationSettingsRepo` | `PgValidationSettingsRepo` |
| `externalKnowledge` | `InMemoryExternalKnowledgePolicyRepo` | `PgExternalKnowledgePolicyRepo` |
| `uploadLimits` | `InMemoryUploadLimitsRepo` | `PgUploadLimitsRepo` |
| `nulltreffer` | `InMemoryNulltrefferRepo` | `PgNulltrefferRepo` |
| `answerSnapshots` | `InMemoryAnswerSnapshotRepo` | `PgAnswerSnapshotRepo` |

**Einhängestellen ausserhalb von `AppRepos`** — die Optionen von `assembleServices`. Sie stehen
dort und nicht in `AppRepos`, weil die Dev-Persistenz sie nicht journalieren soll oder (noch) nicht
kann: ein neuer Schlüssel in `AppRepos` verlangt einen Eintrag in `MUTATING_METHODS`. Folge, an
`AppServices` ausgeschrieben: im Dev-Journal-Betrieb überleben diese Bestände einen Neustart nicht,
im Postgres-Betrieb schon.

| Option | ohne Injektion (Speicher, Dev-Journal) | Postgres (`buildPgServices`) |
| --- | --- | --- |
| `withTx` | keine — stattdessen die Rücknahme-Klammer (Abschnitt 5) | `withPgTx(pool, fn)` |
| `searchProjections` | Speicherfassung, die sich der `KoService` über dasselbe KO-Repo baut | `PgKoSearchProjectionRepo` |
| `klaraSessions` | Speicherablage | `PgKlaraSessionRepo` |
| `lesevarianten` | Speicherablage | `PgLesevariantenRepo` |
| `kanten` | deduplizierender Speicherbestand | `PgKantenRepo` |
| `anweisungen` | flüchtige Ablage, die mit aktiver Dev-Persistenz Schreibzugriffe ablehnt | `PgAnweisungRepo` |
| `brandingSettings` | Speicherablage | `PgBrandingSettingsRepo` |
| `confluenceImportSchalter` | `InMemoryConfluenceImportSchalterRepo` (Betreiberschalter des Confluence-Imports) | `PgConfluenceImportSchalterRepo` |
| `bearbeitungen` | Speicherfassung mit Prozessuhr | `PgBearbeitungsRepo` |

## 5 Gemeinsame Klammern

1. **Ein Pool für alles (Postgres).** `buildPgServices` umhüllt den rohen Pool EINMAL mit
   `gatedPool` (Resetsperre) und gibt jeder Ablage dieselbe Hülle. Den rohen Pool nehmen nur die
   Migration beim Start und der Bestandsreset — beide im Kommentar über `buildPgServices` benannt.
2. **Eine Transaktion über Module (Postgres).** `withTx` geht an `KoService` und `AskService`:
   Bestandsänderung und Protokolleintrag (beim „Danke" auch der Vertrauenszähler) werden zusammen
   festgeschrieben oder zusammen zurückgerollt. Das Aufräumen der Konflikt- und
   Überschneidungsbefunde beim Löschen läuft in derselben Löschtransaktion (Kommentar „JOB 3066" in
   `buildApp`).
3. **Eine Rücknahme-Klammer ohne Datenbank.** Ohne `withTx` baut `assembleServices` mit
   `speicherVorgang(eingang)` (`services/app/src/speicher-vorgang.ts`) Vorher-Abbilder der
   beteiligten Ablagen und hält Journalzeilen zurück; `AuditService` bekommt dazu die
   `kettenSperre`. Rückzug und Wiederherstellen laufen damit auch im Speicher alles-oder-nichts.
4. **Ein Schreibstand je Bestand.** `inMemoryRepos` gibt `koRepo`, `koVersions` und `evidence`
   denselben `Schreibstand` — das Gegenstück der einen Zeile `ko_schreibstand` in Postgres. Zwei
   Dienstinstanzen über DEMSELBEN Satz verhalten sich wie zwei Prozesse über einer Datenbank.
5. **Ein Datenraum.** Suchprojektion, Klara-Sitzungen, Lesevarianten, Kanten, Anweisungen, Marke
   und Bearbeitungshinweise liegen in derselben Datenbank wie der Bestand — kein zweiter Dienst,
   keine kundenübergreifende Ablage (Kommentare in `buildPgServices`).

## 6 Infrastruktur über Adapter

Ausser den Ablagen erreicht die Komposition Infrastruktur nur über Fabriken, die aus der Umgebung
lesen und ohne Konfiguration ehrlich „nicht vorhanden" liefern:

| Infrastruktur | Adapter | ohne Konfiguration |
| --- | --- | --- |
| Datenbank | `gatedPool`, `withPgTx`, `Pg…Repo` | Speicherablagen |
| Cloud-Modelle (OpenAI, Anthropic) | `createCappedCloudClientFromEnv` — gekappt, Vertrauliches abgewiesen | kein Client, mit Grund |
| Lokales Modell | `createCappedLocalClientFromEnv` | kein Client |
| Einbettungen | `createEmbeddingProviderFromEnv`, `cappedEmbeddingProvider` | Vorfilter aus (`KLARWERK_DUP_PREFILTER`) |
| Transkription | `createCappedTranscriberFromEnv` | keine |
| E-Mail | `createMailerFromEnv`, `ConsoleMailer` | Konsole |
| Externe Suche | `createExternalSearchFromEnv` | `undefined` (Route 501) |
| Folienumwandlung | `createSofficeSlideConverter` | `available()` meldet `false` (Route 503) |
| Anmeldung über OIDC | `createOidcProviderFromEnv` (in `buildApp`) | Routen 501 |
| Confluence, SharePoint | Quelladapter der Module, in den Importrouten | Importrouten nicht registriert bzw. 503 |

## 7 R-1148 gegen den Bestand

| R-1148 verlangt | Im Bestand | Beleg |
| --- | --- | --- |
| ein Auslieferungsstück | ein Prozess, eine App | `server.ts`, `buildApp` |
| getrennte Module | 27 Module unter `services/`, Zugriff nur über `index.ts` | `.dependency-cruiser.cjs` `module-boundaries`; Abschnitt 3 |
| gemeinsame Datenbankklammern | ein gesperrter Pool, eine Transaktion über `withTx`, ohne Datenbank die Rücknahme-Klammer | Abschnitt 5 |
| Infrastruktur über Adapter | jede Ablage hinter einem Port mit Speicher- und Postgres-Adapter; Modelle, Mail, Suche, Umwandlung über Fabriken | Abschnitte 4 und 6 |

**Was nicht gedeckt ist:**

- Die Architekturregel misst nur `services/`. `apps/web` und `tests/` stehen nicht darunter.
- Abschnitt 6 zählt die Fabriken auf, die die Komposition benutzt. Ob jede Route selbst
  ausschliesslich über Adapter auf Infrastruktur zugreift, ist nicht erhoben. Ein bekannter
  direkter Zugriff: `GET /api/admin/sicherungen` liest ein Sicherungsverzeichnis.
- `build-app.ts` ist mit 3.226 Zeilen weiter eine Sammeldatei (R-1499). Dieser Vertrag beschreibt
  sie; aufgeteilt hat er sie nicht.

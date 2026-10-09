# Importkette — vom Rohdokument zum kontrollierten Wissen

*R-0130 (Durchflussvertrag), R-0686 (Naht zwischen Import-Dienst und Anwendung), R-0179 und
FR-EXT-01 (Importkette mit Befunden), Aufnahme 20260922 · import-gesamtvertrag. Basis: Stand
`7be353b2` (1.0.0-beta.1.744). Beschrieben wird die vorhandene Verdrahtung; diese Datei ändert
keine.*

**Was diese Datei zusagt.** Für jede Stufe der Importkette steht hier, was hineingeht, was
herauskommt und an welcher Stelle im Code das geschieht. Dazu die eine benannte Naht, an der die
Quelladapter (der Import-Dienst) an die Anwendung übergeben, und wie diese Übergabe eingefroren ist.
Dass die Beschreibung mit dem Code übereinstimmt, misst
`tests/architektur-vertrag/importkette.test.ts`: jeder Verweis der Form `` `pfad#stelle` `` muss
im genannten Pfad stehen, jede Pipeline-Stufe der Oberfläche braucht ihre Zeile, und die Felder der
Naht müssen deckungsgleich mit `ImportItem` und `SourceAdapter` sein. Ändert sich der Code, wird
der Prüfstand rot, bis diese Datei nachgezogen ist.

## 1 Das Bild in einem Satz

Eine Quelle liefert Rohinhalt; ein Quelladapter macht daraus normalisierte `ImportItem`s; der
Import-Kern reiht sie als Kandidaten in die Prüfliste; ein Mensch nimmt an; erst dann entsteht ein
Wissensobjekt im Status `offen`, das über die Validierung `validiert` wird und nur so in Antworten
und Ausgaben wiederverwendet werden darf.

```
Quelle ─► Quelladapter ─► ImportItem[] ═══ Naht ═══► createImportCandidates ─► Prüfliste
        (confluence, sharepoint,                       (library-analytics)        │ Mensch: accept
         JSON-Datei im Browser)                                                    ▼
                         Wiederverwenden ◄─ validiert ◄─ Validierung ◄─ Wissensobjekt (offen)
```

## 2 Die Stufen (Durchflussvertrag, R-0130)

Die Stufen sind die der Pipeline-Anzeige auf der Import-Seite (`IMPORT_PIPELINE_STEPS`,
`apps/web/src/lib/extConcept.ts`). Jede Zeile nennt Eingang, Ausgang und die Codestelle.

| Stufe | Eingang | Ausgang | Codestelle |
| --- | --- | --- | --- |
| `upload` | Confluence-Bereich, SharePoint-Ordner oder eine JSON-Datei; im Erfassen zusätzlich Word, PDF, Text, Bild | Rohinhalt der Quelle, noch nichts gespeichert | `services/app/src/routes/confluence-import-routes.ts#"/api/admin/import/confluence"`, `services/app/src/routes/sharepoint-import-routes.ts#"/api/admin/import/sharepoint/apply"`, `apps/web/src/lib/importReview.ts#parseImportItems`, `services/app/src/routes/capture-routes.ts#"/api/drafts/from-docx"` |
| `extract` | Rohinhalt einer Quellseite oder Datei | `ImportItem` (Felder in Abschnitt 3) und eine unveränderliche Quellrevision `ExternalSourceRecord` | `services/confluence/src/mapper.ts#mapConfluencePageToImportItem`, `services/sharepoint/src/mapper.ts#mapDriveItemToImportItem`, `services/library-analytics/src/types.ts#ExternalSourceRecord` |
| `structure` | `ImportItem[]` einer Quelle | Landkarte (Autoren, Themen, Zeitraum), eingegrenzte Auswahl, Gruppen | `services/library-analytics/src/explore.ts#ImportExploreSummary`, `services/app/src/routes/confluence-import-routes.ts#"/api/admin/import/confluence/select"`, `services/app/src/routes/confluence-import-routes.ts#"/api/admin/import/confluence/group"` |
| `review` | `ImportItem[]` an der Naht | `ImportCandidate` mit `dublettenbefund` und bereinigter Vertraulichkeit; nach dem menschlichen `accept` ein Wissensobjekt | `services/library-analytics/src/service.ts#createImportCandidates`, `services/library-analytics/src/service.ts#sanitizeImportConfidentiality`, `services/library-analytics/src/types.ts#KandidatDublettenbefund`, `services/library-analytics/src/service.ts#reviewImportCandidate`, `services/app/src/routes/library-routes.ts#"/api/library/import/candidates/:id"` |
| `validate` | Wissensobjekt im Status `offen` | Bewertungen; Widersprüche und Überschneidungen als eigene Befunde | `services/validation/src/service.ts#async rate(`, `services/conflicts/index.ts#ConflictService`, `services/conflicts/index.ts#OverlapService` |
| `release` | genug zustimmende Bewertungen oder Admin-Freigabe | Wissensobjekt im Status `validiert` | `services/validation/src/service.ts#async adminValidate(`, `services/knowledge-object/src/types.ts#KoStatus` |
| `reuse` | validiertes Wissensobjekt | Antworten mit Belegen, Ausgaben (nur aus `validiert`), Re-Sync derselben Quelle in das bestehende Objekt | `services/app/src/routes/ask-routes.ts#"/api/ask"`, `services/output/src/service.ts#"validiert"`, `services/library-analytics/src/types.ts#wiederverwendet` |

**Der Lauf eines Quellimports.** Ein Confluence-Lauf ist ein `ImportRun` mit den neun Zuständen aus
`services/library-analytics/src/types.ts#IMPORT_RUN_STATUSES`. Nur `COMPLETED` ist ein Erfolg;
`PARTIAL` und `FAILED` nie. Die Anwendung schreibt heute `QUEUED`, `FETCHING` und die drei
Abschlusszustände (`services/app/src/routes/confluence-import-routes.ts#status: "FETCHING"`); die
Zwischenzustände `PERSISTING_SOURCE`, `EXTRACTING`, `CREATING_KNOWLEDGE` und `ANALYZING` sind im
Vertrag festgelegt, werden aber von keiner Route gesetzt.

**Der Erfassen-Weg.** Word, PDF, Text und Bild gehen nicht über die Naht, sondern über einen
Entwurf, der mit `services/app/src/routes/capture-routes.ts#"/api/drafts/:id/promote"` zum
Wissensobjekt wird. Ab dort gelten dieselben Stufen `validate`, `release` und `reuse`.

## 3 Die Naht (R-0686)

**Die benannte Stelle.** Quelladapter und Anwendung treffen sich an genau einem Typ und genau einer
Methode:

- `services/library-analytics/src/types.ts#export interface ImportItem` — was übergeben wird;
- `services/library-analytics/src/service.ts#async createImportCandidates(` — wo es angenommen wird.

Alle drei Quellwege enden dort: `services/app/src/routes/confluence-import-routes.ts#createImportCandidates(`,
`services/app/src/routes/sharepoint-import-routes.ts#createImportCandidates(`,
`services/app/src/routes/library-routes.ts#createImportCandidates(`. Die Quelladapter greifen nur
über die öffentliche `services/library-analytics/index.ts` auf den Typ zu
(`.dependency-cruiser.cjs`, `module-boundaries`). Der Import-Kern kennt keine Quelle.

**Was übergeben wird — `ImportItem`.**

| Feld | Pflicht | Bedeutung und Regel |
| --- | --- | --- |
| `title` | ja | Titel des Quellobjekts |
| `statement` | ja | Kernaussage |
| `type` | ja | Wissensart |
| `category` | ja | Kategorie |
| `author` | nein | Autor in der Quelle |
| `tags` | nein | Schlagworte |
| `confidentiality` | nein | Stufe aus einem Quellsignal; ein ungültiger Wert wird an der Naht zu „vertraulich", ein fehlender bleibt leer und wird beim Anlegen „intern" (N11) |
| `externalId` | nein | Kennung im Quellsystem; Schlüssel für Wiederholung und Re-Sync |
| `sourceScope` | nein | Container in der Quelle (Bereich, Ordner) |
| `sourcePath` | nein | Elterntitel, Wurzel zuerst; fehlt, wenn die Quelle keine liefert |
| `sourceVersion` | nein | Version des Quellobjekts (Zahl) |
| `sourceRestrictions` | nein | Leseeinschränkung der Quelle; nur ein Quelladapter darf sie setzen, aus Client-Rümpfen wird sie verworfen |
| `url` | nein | Adresse in der Quelle |
| `provider` | nein | Name des Quellsystems |
| `bodyHtml` | nein | Volltext |
| `updatedAt` | nein | letzte Änderung in der Quelle (nur für die Erkundung) |
| `textCodec` | nein | `decoded`: Textfelder sind kanonisch, nicht erneut dekodieren |

**Wie ein Adapter liefert — `SourceAdapter`.**

| Mitglied | Bedeutung |
| --- | --- |
| `source` | menschlicher Name der Quelle |
| `collect` | liest die Quelle und liefert `ImportItem[]` |

`ConfluenceSourceAdapter` setzt `SourceAdapter` um. Der SharePoint-Adapter liefert ebenfalls
`ImportItem`s, aber über eigene Methoden für Auswahl und Übernahme in Losen, nicht über `collect`.

**Eingefroren.** Die Naht liegt in Dateien unter Freeze-144
(`tests/library-analytics-freeze144.test.ts`). Jede dieser Dateien ist mit Inhaltsabdruck und einer
Freigabe festgehalten, die genau diesen Abdruck nennt; wer sie ändert, muss Abdruck und Freigabe im
selben Änderungssatz nachziehen:

- `services/library-analytics/index.ts`
- `services/library-analytics/src/types.ts`
- `services/library-analytics/src/repo.ts`
- `services/library-analytics/src/repo-pg.ts`
- `services/library-analytics/src/service.test.ts`
- `services/library-analytics/src/repo-pg.integration.test.ts`

Der Wächter prüft die Form der Freigabe, nicht wer sie erteilt hat (Grenze im Kopf des Tests).

## 4 Quellenarten aus FR-EXT-01 und R-0179

| Quelle | Weg im Produkt | Stand |
| --- | --- | --- |
| Schulungsvideo | Transkription im Erfassen (`services/app/src/routes/media-routes.ts#"/api/media/analyze"`); Importkachel `apps/web/src/lib/importSourceGallery.ts#"avtranscript"` | ohne hinterlegten Dienst nicht nutzbar; kein eigener Importeinstieg (Entscheidung zu SCRUM-382) |
| Anleitung, Arbeitsanweisung, Servicebericht | als Seite aus Confluence oder SharePoint über die Naht; als Datei (`apps/web/src/lib/importSourceGallery.ts#"docx"`, `apps/web/src/lib/importSourceGallery.ts#"pdf"`) über den Erfassen-Weg | vorhanden; keine eigene Erkennung der Dokumentart |
| Tabelle | Excel (.xlsx) im Importkasten der Import-Seite: `apps/web/src/lib/xlsxImport.ts#leseXlsxEintraege` liest das erste Arbeitsblatt (Kopfzeile = Feldnamen des JSON-Formats) und gibt die Zeilen an `apps/web/src/lib/importReview.ts#parseImportItems`; danach derselbe Weg wie JSON (`apps/web/src/pages/Stufe2.tsx#leseXlsxDatei`). CSV als Text über `apps/web/src/lib/importSourceGallery.ts#"csv"` im Erfassen | Excel vorhanden (seit Nacharbeit 3, Kachel `apps/web/src/lib/importSourceGallery.ts#xlsx: "active"`); im Erfassen weiterhin kein Excel-Weg |
| Wiki-Seite | `apps/web/src/lib/importSourceGallery.ts#"confluence"` | vorhanden, hinter dem Betreiberschalter |
| PDF | `apps/web/src/lib/importSourceGallery.ts#"pdf"`; Dateien aus `apps/web/src/lib/importSourceGallery.ts#"sharepoint"` | vorhanden |
| Foto | `apps/web/src/lib/importSourceGallery.ts#"ocr"` mit Bildbeschreibung (`services/app/src/routes/reasoner-routes.ts#/api/reasoner/describe`) | vorhanden, braucht ein freigegebenes Modell |

## 5 Die Befundübersicht (R-0179, FR-EXT-01)

Unter den Pipeline-Stufen der Import-Seite (im standardmäßig eingeklappten Review-Verlauf, sobald
die Prüfliste Einträge hat) steht eine Zeile mit den sechs Befundarten
(`apps/web/src/components/ImportFindingsOverview.tsx#IMPORT_FINDING_KINDS`). Je Art stehen die
Treffer und die Kandidaten, die für diese Art nicht bewertet werden konnten, getrennt
(`apps/web/src/lib/extConcept.ts#importFindingsOverview`). Veraltet und schützenswert bewertet der
Server je Kandidat, vor der Übernahme
(`services/app/src/routes/library-routes.ts#"/api/library/import/candidates/befunde"`,
`services/app/src/import-befunde.ts#importKandidatBefunde`):

| Art | Treffer | Nicht bewertet |
| --- | --- | --- |
| Kandidaten | Prüfliste, alle Einträge | — |
| Widersprüche | übernommene Kandidaten, deren Wissensobjekt in einem ungelösten Widerspruch steht (`GET /api/conflicts`) | Kandidaten ohne Wissensobjekt |
| Angaben fehlen | Titel, Aussage oder Kategorie leer — dieselbe Regel wie das Abzeichen am Kandidaten | — |
| Veraltet | Stand der Quelle (`updatedAt`) älter als `services/library-analytics/src/grouping.ts#STALE_AFTER_DAYS` (dieselbe Regel wie der Qualitätshinweis der Gruppierung), oder das übernommene Wissensobjekt muss erneut geprüft werden (`GET /api/lifecycle/pending`) | weder Quellstand noch übernommenes Objekt |
| Dubletten | Dublettenbefund der Prüfliste | „Prüfung nicht möglich" |
| Schützenswert | Einstufung „vertraulich"/„streng vertraulich", Leseschutz der Quelle, Schutzdaten im Text (`services/knowledge-object/src/schutzdaten.ts#erkenneSchutzdaten`), ausdrückliche Kennzeichnung im Text (`services/app/src/import-befunde.ts#SCHUTZKENNZEICHNUNG`) | Kandidat ohne jeden Text; ohne Serverbefund alle nicht eingestuften |

Ist ein Signal nicht abrufbar, steht „nicht ermittelt" da und nie 0. Ausgegeben werden nur Gründe,
nie die gefundenen Werte.

**Beispiel-Importe.** Die Quellen-Galerie verlinkt die Erklärseite mit fiktiven Beispielen
(`apps/web/src/components/ImportSourceGallery.tsx#/demonstration/importwege.html`, JOB 3138/3194).
Sie ist ein Ablaufbeispiel und kein Import.

## 6 Widersprüche und Grenzen

- **Stufenzahl.** FR-EXT-01 nennt sechs Stufen; die Pipeline-Anzeige hat sieben (zusätzlich
  `review`, der menschliche Annahmeschritt). Der geführte Confluence-/JSON-Fluss darüber hat fünf
  eigene Schritte (`apps/web/src/lib/importStepper.ts#IMPORT_STEPS`), der SharePoint-Weg keinen
  Stepper. Das sind verschiedene Sichten, keine konkurrierenden Abläufe.
- **„Anleitung".** Die Aufnahme von FR-EXT-01 nennt sie, `specs/stories/extensions.md` nicht.
- **„Konzept".** `specs/stories/extensions.md` stuft die Pipeline als Konzept-Screen und nicht als
  v1-Umfang ein. Confluence, SharePoint und JSON laufen heute produktiv über die Naht; die Einstufung
  ist überholt, die Datei ist nicht geändert.
- **Kommentar gegen Code.** Der Kommentar an `ImportItem.confidentiality` (eingefroren) sagt, ein
  fehlender Wert werde „konservativ vertraulich". Der Code setzt seit N11 den Übernahme-Standard
  „intern" (`services/library-analytics/src/service.ts#const UEBERNAHME_STANDARD: Confidentiality = "intern"`).
  Es gilt der Code; den Kommentar zu ändern verlangt eine neue Freeze-144-Freigabe.
- **Schützenswertes Firmenwissen.** Die Erkennung (Abschnitt 5) ist regelbasiert: Einstufung,
  Leseschutz, Schutzdaten und eine Wortliste ausdrücklicher Kennzeichnungen (Deutsch und
  Englisch). Unmarkiertes Spezialwissen erkennt sie nicht; ein Nullbefund heißt „keiner dieser
  Gründe". Die Objektsicht `apps/web/src/lib/extConcept.ts#IpSensitivity` bleibt unverändert.
- **Veraltet.** Bewertet wird nur, wo die Quelle einen Stand liefert (Confluence, SharePoint, eine
  JSON- oder Excel-Spalte `updatedAt`) oder das Objekt schon übernommen ist. Die Frist ist die
  vorhandene Importfrist; eine eigene Frist je Wissensart gibt es für Kandidaten nicht.
- **Excel.** Gelesen wird nur das erste Arbeitsblatt, mit den englischen Feldnamen des
  JSON-Formats als Kopfzeile; Formeln zählen mit ihrem gespeicherten Wert.
- **Laufzustände.** Vier der neun Zustände sind festgelegt, werden aber nicht geschrieben
  (Abschnitt 2).
- **Altquellen.** R-0130 und R-0686 verweisen auf Jobs 761 und 786–868, deren Lieferungen „Einbau
  nicht belegt" tragen. Im Repository gibt es davon keinen Stand. Diese Datei ist neu aus dem
  heutigen Code geschrieben und ersetzt jene Lieferungen nicht.

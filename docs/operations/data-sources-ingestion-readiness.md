# Klarwerk — Datenquellen & Aufbereitung: Readiness-Runbook

> Ehrliche Bestandsaufnahme der **real vorhandenen** Datenquellen-/Wissensflächen und der
> Anforderungen für eine **spätere** RAG-/Vector-Ingestion.
> **Keine Ingestion-Pipeline, kein Scraping, kein Massenimport, keine OCR-/Chunking-/Embedding-
> Pipeline gebaut.** Verwandt: `rag-readiness-decision.md`, `vector-db-readiness-decision.md`,
> `backup-disaster-recovery.md`, `docs/compliance/gdpr-compliance-runbook.md`,
> `integration-workflows.md`, `docs/demo/stage-1-demo-path.md`.

---

## 1. Vorhandene Quellenflächen (real, im Produkt)

Klarwerk **sammelt und verwaltet** Werkswissen heute über mehrere echte Flächen — alles in Postgres persistiert, RBAC-geschützt:

| Fläche | Modul / Code | Was real aufgenommen wird |
| --- | --- | --- |
| **Capture (Erfahrungsnotiz → KO)** | `services/capture`, `apps/web` Capture | Freitext-Rohnotiz → vom Reasoner strukturiertes Knowledge Object |
| **Dokument-Volltext (FE)** | `apps/web/src/lib/extract.ts`/`docx.ts`/`pdf.ts`/`files.ts` | `txt, md, csv, json, log, docx, pdf` → **Volltext** in die Capture-Notiz |
| **Bild-OCR (FE, optional)** | `apps/web/src/lib/ocr.ts` | Bild → OCR-Text (Worker/Sprachdaten clientseitig); gescanntes PDF → Hinweis auf Bild-OCR |
| **Anhänge / Object-Store** | `services/object-store` | Original-Bytes + MIME/`kind` (`image`/`document`/`binary`); `pdf`/`text/*`/`word` → `document`; Größenlimit `MAX_OBJECT_BYTES` |
| **Externe Quellen am KO** | `KoSource` (`services/knowledge-object`) | Label, **url**, **excerpt**, **provider**, `kind="external"`, **`peerValidated=false`** (extern nie peer-validiert) |
| **Evidence-Records** | `EvidenceRecord` | `kind: source\|attachment`, `objectId`, `mime`, `url`, `provider`, `createdBy/at` (Belegkette je KO-Version) |
| **Import (Push) / Kandidaten** | `services/library-analytics` (`ImportCandidate`), `/api/library/import(/candidates)` | kuratierte Wissensobjekte als JSON-Items (Review-pflichtig, keine Auto-Freigabe) |
| **Export (Pull)** | `/api/library/export` (`json\|markdown\|mediawiki\|html`) | portables Wissensartefakt (auch logisches Backup) |
| **Externe Suche (Proxy)** | `services/external-search` (`/api/external/search`) | Server-Proxy (Default Wikipedia) — **in Sandbox ohne Netz `400`**; in Prod gegen Provider zu testen |

> **Wichtig:** Diese Flächen **sammeln und verwalten** Wissen — sie sind **keine** RAG-Ingestion (kein Chunking/Embedding). Die Dokument-/OCR-Extraktion läuft **clientseitig** in der Capture-UI; es gibt **keine** serverseitige OCR-/PDF-/DOCX-Pipeline.

### 1a. Welche Wege durch den Anhäng-Vertrag laufen — und welche nicht

Der Admin-Regler **Externes Wissen** (`blocked | search_on_click | search_attach | open`, Vorgabe `search_on_click`) begrenzt, welche Quelle an ein Wissensobjekt gehängt werden darf. Auf den beiden restriktiven Stufen gilt **fail-closed**: eine Quelle mit öffentlicher Web-Adresse wird abgewiesen, eine Quelle **ohne** Adresse nur dann angenommen, wenn sie auf ein Dokument zeigt, das der Server an **diesem** Wissensobjekt selbst als Anhang hält. „Intern" belegt allein die konfigurierte Allowlist `KLARWERK_INTERNAL_SOURCE_ORIGINS`; ohne Konfiguration ist sie leer, und damit ist jede Adresse öffentlich. Die Entscheidung steht als reine Funktion in `services/external-search/src/attach-policy.ts`, durchgesetzt wird sie in `services/app/src/routes/ko-routes.ts` (Aktion `add-source`).

**Dieser Vertrag gilt für den Client-Weg, nicht für jeden Schreibvorgang im Bestand.** Das ist kein Widerspruch, aber es muss ein Betreiber wissen, bevor er die Zusage weiter liest, als sie ist:

| Weg | Läuft durch die Prüfung? | Warum |
| --- | --- | --- |
| `PUT /api/kos/:id` mit `action: "add-source"` (Prüfbereich, manuelles Quellenformular, externe Treffer) | **Ja** — Stufe, Reichweite und Anker werden serverseitig ermittelt | Der ursprüngliche Client-Weg, eine einzelne Quelle anzulegen |
| `PUT /api/kos/:id` mit `action: "append-document"` (Verbund-Operation „Dokumentinhalt übernehmen") | **Ja** — dieselbe Stufenentscheidung je Belegstelle, zusätzlich die stufenblinde interne Belegpflicht | Bindet Anker, Belegstellen und überarbeiteten Inhalt in **einem** Schreibvorgang an ein **bestehendes** Wissensobjekt |
| `POST /api/kos/from-document` → `ko.createWithDocuments` (Erfassen, „Aus Dokument ergänzen") | **Ja** — dieselbe Stufenentscheidung je Belegstelle, zusätzlich die stufenblinde interne Belegpflicht | Erzeugt ein **neues** Wissensobjekt samt Ankern und Belegstellen im **selben** Insert |
| `PUT /api/library/import/candidates/:id` mit `accept` → `acceptToKo` → `ko.create(…sources)` (`services/app/src/routes/library-routes.ts`, `services/library-analytics/src/service.ts`) | **Nein** | Schreibt Quellen als Teil einer **privilegierten internen Komposition** direkt über den Service |
| Import / Confluence-Re-Sync (`services/library-analytics`) | **Nein** | Wie oben — `ko.create` / `ko.revise` unter Betriebsrechten |
| `POST /api/admin/examples/load` → `loadExamplePackage` → `ko.create(…sources)` (`services/app/src/routes/admin-routes.ts`, `services/app/src/example-packages.ts`) | **Nein** | Legt einen Beispielbestand als Ganzes an; die Quellen sind Bestandteil des ausgelieferten Beispiels |
| `POST /api/admin/demo-seed` (intern über `ko.addSource`) und Demo-Seed (`services/app/src/seed-demo.ts`) | **Nein** | Aufsetz-/Demopfad, keine Nutzereingabe |

Der Unterschied ist **Zugänglichkeit, nicht Nachlässigkeit**: die Zeilen ohne Prüfung sind keine vom Client manipulierbaren Umgehungen. Kein HTTP-Endpunkt lässt einen Aufrufer beliebige Quellen an ihnen vorbeischleusen; sie laufen unter Admin-/Betriebsrechten oder beim Aufsetzen einer Instanz. Wer sie erweitert — ein neuer Importer, ein neues Beispielpaket, ein Seed für einen Kunden — **umgeht damit die Stufe** und trägt die Verantwortung für die Herkunft der eingespielten Quellen selbst.

**Korrektur (Stand mega20).** Eine frühere Fassung dieses Abschnitts las sich als Sicherheitsinventur mit **einem** quellenschreibenden Client-Weg. Das war zu eng. Zur Vollständigkeit gehören zwei Unterscheidungen, die die Tabelle oben jetzt trägt:

- **Wo ein Wissensobjekt bereits IM INSERT mit Quellen entsteht** (nicht nachträglich): `POST /api/kos/from-document` → `createWithDocuments` · `PUT /api/library/import/candidates/:id` mit `accept` → `acceptToKo` → `ko.create(…sources)` · `POST /api/admin/examples/load` → `loadExamplePackage` → `ko.create(…sources)`.
- **Wo ein bestehendes Wissensobjekt Quellen BEKOMMEN kann:** `PUT /api/kos/:id` mit `add-source` · `PUT /api/kos/:id` mit `append-document` · `POST /api/admin/demo-seed` intern über `ko.addSource`.

**Ohne Client-Quellen, aber der Vollständigkeit halber in dieser Liste:** `POST /api/kos` und `POST /api/drafts/:id/promote` erzeugen Wissensobjekte, nehmen aber **keine** Quellen aus dem Request an — `POST /api/kos` verwirft ein mitgeschicktes `sources`-Feld ausdrücklich (SCRUM-470), und der Promote-Weg kennt es gar nicht.

Diese Aufzählung ist **erklärend, nicht erzwungen**: ein Test, der sie gegen den Code pinnt, existiert (noch) nicht. Eine zentrale, gepinnte Inventur der quellenschreibenden Wege ist als eigener Vorgang nach VIP-2 vorgesehen; bis dahin muss, wer einen neuen Weg baut, diesen Abschnitt von Hand nachziehen.

**Was der Anker belegt und was nicht:** er belegt, dass eine adresslose Belegstelle an ein im Haus liegendes Dokument gebunden ist. Er belegt **nicht**, dass der Auszug wirklich aus diesem Dokument stammt — dafür bräuchte es eine serverseitige Auszugsprüfung gegen den Dokumententext (eigener Vorgang, heute nicht vorhanden).

---

## 2. Belegte Formate

- **Volltext gelesen (FE):** `txt, md, csv, json, log, docx, pdf`.
- **OCR (FE, optional):** Bilder; gescanntes PDF → Hinweis „Bild-OCR nutzen".
- **Object-Store:** beliebige Bytes; `kind` aus MIME abgeleitet (`image`/`document`/`binary`).
- **Import:** strukturiertes **JSON** (`items[]` mit title/statement/type/category).
- **Export:** `json`, `markdown`, `mediawiki`, `html`.

---

## 3. Metadaten (reichhaltig, real)

**Knowledge Object** (`services/knowledge-object/src/types.ts`): `id, title, statement, bodyHtml?, conditions[], measures[], type` (5 Wissensarten), `category, tags[], confidence, trust, status` (`offen|validiert`), `version, originalAuthor, author, neededValidations, assignments[], asset, createdAt, history[], comments[], attachments[], sources[]`.

**Evidence/Quelle:** `KoSource{label,url,excerpt,kind=external,peerValidated,provider,author,at}`; `EvidenceRecord{koId,koVersion,kind,sourceId?,attachmentId?,objectId?,label,mime?,url?,provider?,createdBy,createdAt}`.

**Anhang:** `KoAttachment{id,name,mime,objectId?/dataUrl?,thumbnail?,size?,author,at}`.

→ Für eine spätere Vektor-Collection (`vector-db-readiness-decision.md` §4) sind die Pflicht-Metadaten (**ko_id, version, status, type, category, source/provider**) damit **bereits vorhanden** und müssten nur abgebildet werden.

---

## 4. Rechte / PII / DSGVO

- **RBAC:** Lesen ab Viewer, Erfassen ab Experte, Validierung ab Controller, Verwaltung Admin; anonym → 401 (`integration-workflows.md`, SCRUM-212).
- **Externe Quellen:** `peerValidated=false` per Definition — externe Inhalte sind nie automatisch geprüft (klare Stufe-2-Markierung).
- **Logging:** **keine** Prompt-/Antworttexte (nur ModelRun-Metadaten, `monitoring-logging.md`).
- **DSGVO:** Verarbeitung/Subprozessoren, Löschung, Aufbewahrung in `gdpr-compliance-runbook.md`. **Offen:** für RAG-Input zusätzlich **Anonymisierung/PII-Filter vor Embedding** (heute nicht vorhanden).

---

## 5. Qualität / Validierung

- Wissen durchläuft den Kreis **Capture → Validate → Use → Maintain**; nur **validierte** KOs gelten als `gesichert` (Ask/Reasoner bevorzugt validiert; sonst ehrliche Lücke).
- Import legt **Kandidaten**/Items an → **kein** Auto-Freigeben; Review-pflichtig.
- → Es existiert ein **strukturierter, validierbarer** Wissensbestand mit Quelle/Trust/Status/Version — aber **klein** (Demo-Seed) und **nicht** als RAG-Korpus aufbereitet.

---

## 6. Gibt es einen bereinigten / chunkbaren Datenbestand? — **Nein**

- **Kein Chunking** (Suche nach `chunk` im Code leer), **keine** normalisierte/bereinigte Textschicht für Embeddings, **keine** Ingestion-Pipeline.
- Daten liegen als **KOs + Evidence + Original-Anhänge (Bytes) + Import-Kandidaten** — nicht als embedding-fertige, segmentierte Passagen mit Chunk-Metadaten.
- `statement`/`bodyHtml` sind die saubersten Textfelder, aber **nicht** chunked/normalisiert.

> **Folge:** Das Kriterium „**aufbereiteter** (bereinigt + chunkbar + RAG-tauglich) Datenbestand" ist **nicht** erfüllt.

---

## 7. Chunking-Konzept für später (nur Konzept, NICHT gebaut)

- **Quelle je Chunk:** KO (`statement`+`bodyHtml`), zusätzlich Anhang-Volltext (aus Object-Store, einmalig extrahiert) und externe Excerpts.
- **Segmentierung:** semantische/absatzweise Chunks mit Overlap; Chunk-Metadaten = `ko_id, ko_version, ko_status, type, category, source/provider, chunk_index, chunk_ref` (vgl. `vector-db-readiness-decision.md` §4).
- **Aktualität:** Re-Chunk/Re-Embed bei KO-Änderung/Revalidierung; Löschung spiegelt KO-Löschung.
- **Validierungs-Leitplanke:** Retrieval bevorzugt **validierte** KOs; Quellenbindung (KO-ID + Belegstelle) bleibt Pflicht.

---

## 8. Anonymisierung / Bereinigung (Voraussetzung, heute nicht vorhanden)

- **PII-Filter/Pseudonymisierung** vor Embedding (Namen/Personenbezug aus Freitext/OCR).
- **Normalisierung** (HTML→Text, Whitespace/Encoding, Deduplizierung, Sprachfeststellung).
- **Quell-Whitelist/Scope** (welche Felder/Anhänge überhaupt in den Index dürfen).
- **Rechte-Check** je Quelle (extern `peerValidated=false`, Lizenz/Urheberrecht externer Inhalte).

---

## 9. RAG-/Vector-Voraussetzungen (Kette)

1. **Positive RAG-Entscheidung** (`rag-readiness-decision.md`) und **Vector-DB-Option** (`vector-db-readiness-decision.md`, pgvector) — Vorbedingungen.
2. **Ausreichend großer, validierter Korpus** (Demo-Seed zu klein).
3. **Bereinigung/Anonymisierung** (§8) + **Chunking** (§7) + Embedding-Modell entschieden.
4. **Eval-Baseline** (`evaluation-quality-assurance.md`) für Vorher/Nachher.
5. **Backup/Retention** des Index an KO-Lifecycle koppeln (`backup-disaster-recovery.md`).

---

## 10. Offene Datenowner-/Produktentscheidungen

- **Welche Quellen** dürfen in einen künftigen RAG-Index (nur validierte KOs? Anhänge? externe Excerpts?) — Scope-Entscheidung Pedi.
- **PII-/Anonymisierungs-Policy** vor Embedding.
- **Urheberrecht/Lizenz** externer Quellen im Index.
- **Massenimport-Quellen** (welche Altbestände, in welchem Format, von wem freigegeben).

---

## 11. Nicht-Ziele

- Keine externen Systeme angezapft, kein Scraping, kein Massenimport.
- Keine OCR-/PDF-/DOCX-Pipeline neu gebaut; keine Chunking-/Embedding-/Vector-Pipeline.
- Kein Produktcode geändert; reine **Readiness-Dokumentation**.

---

## 12. Empfehlung

**PARTIAL.** Klarwerk **sammelt und verwaltet** Wissen bereits real und **metadatenreich** (Capture inkl. Dokument-Volltext/OCR, Anhänge/Object-Store, Quellen/Evidence, Import-Kandidaten, Export) — die „Sammeln"-Hälfte ist belegt. Aber ein **bereinigter, chunkbarer, RAG-tauglicher** Datenbestand existiert **nicht** (kein Chunking, keine Normalisierung/Anonymisierung, kein Ingestion-Lauf), und der Bestand ist heute klein (Demo-Seed). Die „**Aufbereiten** (für RAG)"-Hälfte ist daher **nicht** erfüllt → **Partial**, abhängig von der RAG-/Vector-Entscheidung (SCRUM-204/203).

---

*Read-only Readiness-Runbook. Kein Produktcode geändert; keine Ingestion/Chunking/Embedding/Scraping erzeugt.*

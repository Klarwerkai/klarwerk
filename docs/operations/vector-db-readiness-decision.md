# Klarwerk — Vektor-Datenbank: Readiness-/Entscheidungsnotiz

> Dokumentierte Architektur-/Produktentscheidung. **Keine Vector-DB-Installation, keine Embeddings,
> keine Integration gebaut.** Dieses Item entscheidet die **Option**, nicht den Aufbau.
> Verwandt: `docs/operations/rag-readiness-decision.md` (übergeordnete RAG-Entscheidung),
> `backup-disaster-recovery.md`, `maintenance-update-process.md`, `secrets-management.md`,
> `docs/compliance/gdpr-compliance-runbook.md`.

---

## 1. Aktueller Zustand

- **Es läuft KEINE Vektor-Datenbank.** Im Code, in den Dependencies (`package.json` → nur `pg`/`@types/pg`) und in den Compose-Dateien gibt es **keine** Spur von `pgvector/Qdrant/Chroma/Weaviate/Pinecone/FAISS/hnsw/ivfflat/embedding`.
- **Keine Embedding-Daten, keine Collections, keine Vektor-Schemas.**
- **Postgres ist die zentrale Persistenz:** `postgres:16` (Dev) bzw. `postgres:16-alpine` (Prod); alle Modul-Daten inkl. Object-Store/Anhänge und Audit liegen in Postgres (`services/app/src/db.ts#migrate`, 13 Modul-Schemas — vgl. `backup-disaster-recovery.md`).
- Retrieval erfolgt heute **lexikalisch** (Keyword), quellengebunden an Knowledge Objects (`rag-readiness-decision.md`).

> **Folge:** Das Jira-Kriterium „Vektor-DB **aufgesetzt**" ist **nicht** erfüllt.

---

## 2. Entscheidung / Empfehlung

**Jetzt keine Vector-DB aufsetzen.** Erst wenn die übergeordnete **RAG-Entscheidung** (`rag-readiness-decision.md`) positiv ausfällt (gemessenes Recall-Defizit, ausreichender KO-Bestand, DSGVO-/Eval-/Rollback-Pfad), wird eine Vektor-Schicht gebraucht. **Bevorzugte Option für Klarwerk dann: `pgvector`** (Postgres-Extension) — **kein** separater Dienst.

---

## 3. Vergleich: pgvector vs. Qdrant / Chroma / Weaviate

| Kriterium | **pgvector** (Postgres-Extension) | Qdrant / Chroma / Weaviate (eigener Dienst) |
| --- | --- | --- |
| Infrastruktur | **keine neue DB** — nutzt vorhandenes Postgres | zusätzlicher Service/Container |
| Backup/Restore | **im vorhandenen `pg_dump`/Snapshot** (`backup-disaster-recovery.md`) | **separates** Backup/Restore nötig |
| Secrets/Auth | **vorhandene** DB-Creds/RBAC | eigene Auth/Secrets/Netzwerkgrenzen |
| Transaktionale Konsistenz mit KOs | **ja** (gleiche DB, JOIN/FK zu KO möglich) | nein (zwei Datenquellen synchron halten) |
| DSGVO/Löschung | **eine** Datenbank, einheitliche Löschpfade | zweiter Speicherort = zweite Löschpflicht |
| Skalierung/große Vektor-Workloads | gut bis mittel-groß; ANN via HNSW/IVFFlat | spezialisiert, ggf. stärker bei sehr großen Mengen |
| Betriebskomplexität (Stage-1) | **niedrig** (ein System) | höher (eigener Lifecycle/Monitoring/Backup) |

**Fazit:** Für Klarwerks Stufe (ein modularer Monolith, Postgres-zentriert, schlanker Betrieb) ist **pgvector** die naheliegende erste Wahl — minimale neue Betriebs-/Backup-/Security-Fläche. Ein dedizierter Vector-Dienst wäre erst bei **sehr großen** Vektor-Workloads zu erwägen.

---

## 4. Collection-/Schema-Vorschlag (Konzept, NICHT angelegt)

Eine Tabelle neben den KOs (gleiche Datenhoheit), z. B.:

```sql
-- KONZEPT (nicht ausgeführt): erfordert CREATE EXTENSION vector;
CREATE TABLE IF NOT EXISTS ko_embeddings (
  id            text PRIMARY KEY,
  ko_id         text NOT NULL,          -- FK-Bezug zum Knowledge Object
  ko_version    integer NOT NULL,       -- Version, für Aktualität/Re-Embedding
  ko_status     text NOT NULL,          -- offen|validiert (Retrieval bevorzugt validiert)
  chunk_index   integer NOT NULL,       -- Position des Chunks im KO/Anhang
  chunk_ref     text NOT NULL,          -- Verweis auf Textstelle (kein Volltext-Dup nötig)
  model         text NOT NULL,          -- Embedding-Modell/Provider (Reproduzierbarkeit)
  dim           integer NOT NULL,       -- Vektor-Dimension
  embedding     vector(1536),           -- Beispiel-Dimension; modellabhängig
  created_at    text NOT NULL
);
-- ANN-Index (Beispiel): USING hnsw (embedding vector_cosine_ops);
```

### Pflicht-Metadata je Eintrag
- **ko_id, ko_version, ko_status** (Quellenbindung + Aktualität + Validierungs-Filter),
- **chunk_index / chunk_ref** (Rückverweis auf die Belegstelle),
- **model / dim** (Reproduzierbarkeit, Re-Embedding bei Modellwechsel),
- **created_at** (Lifecycle/Retention).

> Leitplanke: Retrieval **bevorzugt validierte KOs**; die Quellenbindung (KO-ID + Belegstelle) bleibt Pflicht — wie heute.

---

## 5. Indexing-/Embedding-Lifecycle (Konzept)

- **Erzeugen:** bei KO-Erstellung/Änderung Chunks bilden → Embedding → Upsert (`ko_id+chunk_index`).
- **Aktualität:** bei KO-Änderung/Revalidierung/Versionssprung **Re-Embedding**; veraltete Einträge ersetzen.
- **Löschung:** KO gelöscht → zugehörige Embeddings löschen (gleiche DB → einfacher, transaktional).
- **Modellwechsel:** `model`/`dim` ändern → kontrolliertes Re-Embedding; Rollback = alte Tabelle/Spalte behalten.

---

## 6. Backup-/Restore-Auswirkung

- **pgvector:** Daten sind Teil der **bestehenden Postgres** → `pg_dump`/Snapshot deckt sie ab (kein neuer Backup-Pfad). **Hinweis:** beim Restore ggf. `CREATE EXTENSION vector;` voraussetzen und **ANN-Index neu aufbauen** (Index ist reproduzierbar). In `backup-disaster-recovery.md` als Zusatzschritt aufnehmen, sobald aktiviert.
- **Dedizierter Dienst:** zusätzlicher, **separater** Backup-/Restore-/Konsistenz-Pfad (zwei Systeme synchron wiederherstellen) — höheres Risiko.

---

## 7. Security / DSGVO / Retention

- **Embeddings sind abgeleitete personenbezogene/fachliche Daten** (aus KO-/Freitext) → unterliegen denselben Pflichten; **Löschung muss den Index spiegeln** (KO-Löschung → Embedding-Löschung).
- **Embedding-Erzeugung** = ggf. Datenfluss an ein Embedding-Modell/Provider → VVT/DSFA aktualisieren (`gdpr-compliance-runbook.md`), AVV klären; bei extern: keine ungerechtfertigten PII embedden.
- **Zugriff:** Vektor-Tabelle hinter derselben DB-/RBAC-Grenze (`secrets-management.md`); keine Secrets im Client.
- **Retention:** Embeddings an KO-Lifecycle koppeln (keine „verwaisten" Vektoren).

---

## 8. Offene Voraussetzungen (bevor eine Vector-DB überhaupt aufgesetzt wird)

1. **Positive RAG-Entscheidung** (`rag-readiness-decision.md`) — Vektor-DB ohne RAG-Bedarf sinnlos.
2. **Embedding-Modell/Provider** + DSGVO-Pfad entschieden.
3. **Chunking-Strategie** + Dimension/Modell festgelegt.
4. **Eval-Baseline** (`evaluation-quality-assurance.md`) für Vorher/Nachher.
5. **Betriebspfad:** `CREATE EXTENSION vector`, Index-Typ (HNSW/IVFFlat), Re-Embedding-Job, Backup-/Restore-Erweiterung, Monitoring.

---

## 9. Nicht-Ziele

- Keine Vector-DB-Installation, keine Embeddings, keine RAG-Pipeline, keine pgvector/Qdrant/Chroma/Weaviate-Integration in diesem Item.
- Keine neue Sucharchitektur, kein Produktcode, kein Schema angelegt.
- Reine **Readiness-/Entscheidungsdokumentation**.

---

## 10. Empfehlung

**PARTIAL / Blocked-on-product-architecture-decision.** Es existiert **keine** Vector-DB; das Jira-Kriterium „aufgesetzt" ist **nicht** erfüllt, und ein Aufbau ist in diesem Item ausgeschlossen (und ohne positive RAG-Entscheidung auch nicht sinnvoll). **Option entschieden:** wenn überhaupt, dann **pgvector** auf der vorhandenen Postgres (minimale neue Backup-/Security-/Betriebsfläche). Die eigentliche Einrichtung bleibt eine spätere, bewusst zu treffende Architekturentscheidung.

---

*Read-only Readiness-/Entscheidungsnotiz. Kein Produktcode geändert; keine Vector-DB/Embeddings/Extension erzeugt; SQL nur als Konzept.*

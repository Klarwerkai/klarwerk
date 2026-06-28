# Klarwerk — RAG-Pipeline (Embeddings + Retrieval): Readiness-/Entscheidungsnotiz

> Dokumentierte Architektur-/Produktentscheidung. **Keine Vector-DB, keine Embeddings, keine
> RAG-Pipeline, kein LangChain/LlamaIndex/Haystack gebaut.**
> Verwandt: `docs/operations/evaluation-quality-assurance.md`, `fine-tuning-decision.md`,
> `monitoring-logging.md`, `docs/compliance/gdpr-compliance-runbook.md`, `docs/demo/stage-1-demo-path.md`.

---

## 1. Aktueller Zustand — wie Klarwerk Fragen heute beantwortet

Klarwerk beantwortet Fragen **mit Kontext + Quellen aus eigenen Daten**, aber über einen **lexikalischen** Weg, **nicht** über eine RAG-Pipeline:

- **Retrieval = Keyword-Überschneidung** (`services/reasoner/src/provider.ts` → `keywordSelect`/`tokenize`/`overlap`): Fragetokens (>2 Zeichen) werden gegen Titel+Aussage der Knowledge Objects gematcht, nach Überschneidung sortiert. Synchron, modellunabhängig.
- **Quellenbindung real:** Die Antwort wird in echten KOs verankert. `AnswerResult` trägt `sources` (KO-IDs), `steps` mit `sourceId` + **`snippet`** (Belegstelle, FR-ASK-06) und `knowledgeClass` (`gesichert` nur bei validiertem KO).
- **Ehrliche Wissenslücke:** Kein Treffer → **keine erfundene Antwort**, sondern eine Gap (getestet, SCRUM-206).
- **Modell optional:** ohne `ANTHROPIC_API_KEY` deterministischer Fallback; das Modell **formuliert nur**, Quellen/Trust kommen aus den Daten (Anti-Halluzination).

**Evidence (live, In-Memory + Seed):** „Wann muss Ventil X bei Überdruck geschlossen werden?" → `answered=true, gesichert, 1 Quelle`; eine umformulierte Variante traf ebenfalls (Keyword-Toleranz). → Kontext+Quellen-Antworten funktionieren bereits **lexikalisch**.

---

## 2. Was bereits erfüllt ist (fachliches Ziel, teilweise)

- **Fragen mit Kontext + Quellen aus eigenen Daten:** ✓ (KO-Quellenbindung + Keyword-Retrieval).
- **Belastbare Quellen/Zitate:** ✓ (`sources` + `snippet`/Belegstelle + `knowledgeClass`).
- **Validierung/Trust:** ✓ (nur validierte KOs → `gesichert`).
- **Anti-Halluzination/ehrliche Lücke:** ✓ (getestet, gated).

---

## 3. Was das **NICHT** ist (keine RAG-Pipeline)

- **Keine Embeddings**, **keine Vektor-Repräsentation**, **keine semantische Ähnlichkeitssuche**.
- **Keine Vector-DB** (kein pgvector/Qdrant/Chroma/Weaviate/Pinecone/FAISS).
- **Kein Chunking** langer Inhalte, **kein** Dense-/Hybrid-Retrieval, **kein** RAG-Framework (LangChain/LlamaIndex/Haystack).
- Retrieval ist **rein lexikalisch** (Token-Overlap) → **NICHT** als „RAG" zu bezeichnen.

> Daher: Das wörtliche Akzeptanzkriterium „RAG-Pipeline (Embeddings + Retrieval) **gebaut**" ist **nicht** erfüllt.

---

## 4. Welche Probleme RAG lösen würde (die Keyword-/KO-Logik nicht löst)

- **Semantischer Recall:** echte Synonyme/Paraphrasen ohne Token-Überschneidung (z. B. „Sperrorgan" ↔ „Ventil") zuverlässig finden.
- **Skalierung:** große KO-Bestände, in denen Keyword-Overlap zu grob/laut wird.
- **Lange Inhalte/Anhänge:** Chunking + gezieltes Abrufen relevanter Passagen (statt ganzer KO-Texte).
- **Ranking nach Bedeutungsnähe** statt nur Wortzahl-Overlap.

## 5. Risiken von RAG **für Klarwerk** (warum nicht vorschnell)

- **Untergräbt das Validierungsprinzip,** wenn Retrieval **unvalidierten** Text als Kontext einspeist → Klarwerks Stärke ist „nur validiertes, quellengebundenes Wissen". RAG muss die **KO-Quellenbindung + Validierung + ehrliche Lücke** zwingend erhalten.
- **Falsche Autorität:** semantisch „nahe", aber sachlich falsche Passagen wirken überzeugend.
- **Datenschutz/Infra:** Embeddings = Datenfluss an ein Embedding-Modell (DSGVO/AVV), zusätzliche Vector-Infra (Betrieb/Kosten/Backups).
- **Komplexität:** mehr bewegliche Teile (Index-Aktualität bei KO-Änderungen/Revalidierung, Re-Embedding).

## 6. Fehlende Bausteine für eine echte RAG-Pipeline

1. **Embedding-Modell/Provider** (Entscheidung: extern vs. self-hosted; DSGVO-Pfad).
2. **Vector-Store** — naheliegend **pgvector** (nutzt die vorhandene Postgres-Infra, keine neue DB) als erste Option.
3. **Chunking-Strategie** für KO-`bodyHtml`/Anhänge (Größe/Overlap/Metadaten = KO-ID/Version/Status).
4. **Hybrid-Retrieval** (Keyword + Vektor) + Re-Ranking, das **validierte** KOs bevorzugt.
5. **Index-Lifecycle:** Re-Embedding bei KO-Änderung/Revalidierung; Konsistenz mit Status/Version.
6. **Eval-Vorher/Nachher** (s. §8) + Rollback auf das vorhandene Keyword-Retrieval.

---

## 7. Architektur-Skizze für später (nur Konzept, NICHT gebaut)

```
Frage ──► Hybrid-Retrieval
          ├─ lexikalisch (vorhandenes keywordSelect)
          └─ semantisch (Embedding der Frage ─► pgvector-Top-k über KO-Chunks)
                 │
                 ▼
        Re-Ranking (nur VALIDIERTE KOs bevorzugt, Status/Version beachtet)
                 │
                 ▼
        Reasoner.answer(context = abgerufene KO-Chunks)
                 │  (Modell formuliert NUR aus den nummerierten Quellen)
                 ▼
        AnswerResult { answer, sources(KO-IDs), steps(snippet), knowledgeClass }
                 │
                 └─ kein Treffer/zu geringe Ähnlichkeit ─► ehrliche Wissenslücke
```

Leitplanken: **Quellenbindung an KOs bleibt Pflicht**; RAG ersetzt **nicht** Validierung/Trust; ehrliche Lücke bleibt; Modell bleibt austauschbar/optional.

---

## 8. Eval-/Datenschutz-/Retention-Anforderungen (vor RAG-Einführung)

- **Eval-Baseline** (`evaluation-quality-assurance.md`, B1–B4) als Referenz; RAG nur bei **messbarer** Verbesserung von Recall **ohne** Regression bei Halluzination/Quellenbindung.
- **DSGVO:** Embedding-Pipeline = neue Verarbeitung/Subprozessor → VVT/DSFA aktualisieren (`gdpr-compliance-runbook.md`); keine ungerechtfertigten PII in Index.
- **Retention/Konsistenz:** Index-Einträge an KO-Lifecycle koppeln (Löschung/Revalidierung spiegeln); Vector-Store ins Backup aufnehmen (`backup-disaster-recovery.md`).

---

## 9. Empfehlung

**Jetzt NICHT bauen.** Klarwerk erfüllt das fachliche Ziel „Antworten mit Kontext + Quellen aus eigenen Daten" bereits **lexikalisch + quellengebunden** — das ist aber **keine** RAG-Pipeline. RAG ist **erst dann** sinnvoll, wenn (a) der KO-Bestand groß genug ist, dass Keyword-Retrieval messbar zu grob wird, **und** (b) ein konkretes, gemessenes Recall-Defizit besteht, **und** (c) DSGVO-/Eval-/Rollback-Pfad geklärt sind. Reihenfolge bleibt: **Quellenbindung (✓) → RAG (bei Bedarf) → Fine-Tuning (zuletzt)** (konsistent mit `fine-tuning-decision.md`).

---

## 10. Nicht-Ziele

- Keine Vector-DB, keine Embeddings, keine RAG-Pipeline, kein LangChain/LlamaIndex/Haystack in diesem Item.
- Keine neue Sucharchitektur, kein Reasoner-/ModelAdapter-Umbau, kein Produktcode.
- Reine **Readiness-/Entscheidungsdokumentation**.

---

*Read-only Readiness-/Entscheidungsnotiz. Kein Produktcode geändert; keine Embeddings/Vector-DB/RAG erzeugt. „RAG" wird bewusst NICHT für die vorhandene lexikalische Quellenbindung verwendet.*

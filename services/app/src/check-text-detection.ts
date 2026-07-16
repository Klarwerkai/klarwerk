// SCRUM-491 (Slice 4): side-effect-freier Dry-Run-Detection-Kern für transienten Freitext. Muster wie
// duplicate-detection.ts (App-Root verdrahtet knowledge-object ↔ conflicts ↔ optional Prefilter/Modell),
// ABER: KEIN Endpunkt, KEINE Persistenz. Der Kern ist erst ab Slice 5 erreichbar. Er prüft beliebigen
// Text gegen den VALIDIERTEN Bestand und gibt Dry-Run-Ergebnisse zurück — nichts wird angelegt, nichts
// ins Board geschrieben, kein Inhalt auditiert. Der bestehende detect-Pfad (mit createAuto) bleibt
// unberührt; dies ist ein reiner neuer Abzweig.
import {
  type ConflictService,
  type ConflictVerdict,
  type DetectSubject,
  type DryRunConflict,
  type DryRunOverlap,
  type OverlapService,
  type OverlapVerdict,
  coreText,
} from "../../conflicts";
import { type KnowledgeObject, type KoService, isConfidential } from "../../knowledge-object";
import { queryTokens } from "../../reasoner";
import type { SemanticPrefilter } from "./duplicate-detection";

// Transienter Gegenstand: der eingegebene Text, ohne gespeichertes KO. refId ist ein fester Marker,
// damit er sich nie mit einer echten KO-ID überschneidet.
const TRANSIENT_ID = "transient";

// SCRUM-491 MVP (ben-Review + Re-Review): Retrieval-Deckel, den der Orchestrator an die Datenquelle
// stellt. Der Orchestrator lädt NIE den Gesamtbestand (kein ko.list()-all): semantisch nur die
// store.nearest-topK-Treffer per ID (bounded fetch), lexikalisch delegiert er an die gedeckelte
// Source-Query ko.findCandidates({terms, limit: topK}). Ob die QUELLE selbst hart deckelt, hängt am
// verdrahteten Repo:
//  - Instanzen mit DATABASE_URL nutzen PgKoRepo (hartes SQL LIMIT, s. repo-pg.ts), nie InMemory
//    (buildPgServices; DATABASE_URL hat Vorrang, s. server.ts). Die Live-Instanz app.klarwerk.ai
//    setzt DATABASE_URL.
//  - Der KLARWERK_DEV_PERSIST-Journal-Pfad nutzt InMemoryKoRepo und ist Dev-only; dieser Adapter
//    deckelt nur die Ausgabe, nicht den Scan (scort den kleinen Bestand voll). OHNE DATABASE_URL
//    gilt der quell-seitige Bound also NICHT.
//  - Geplante weitere Adapter (pgvector, sqlite-vec/Insel) sind NOCH NICHT implementiert und müssen
//    den Top-K-Quell-Vertrag selbst erfüllen, wenn gebaut.
const RETRIEVAL_TOP_K = 20;

export interface CheckTextInput {
  text: string;
  title?: string;
  locale?: "de" | "en";
}

// Ergebnis-Form: Duplikate (Pflichtpfad) + Konflikte (symmetrisch, optional — leer ohne conflictJudge).
export interface CheckTextResult {
  duplicates: DryRunOverlap[];
  conflicts: DryRunConflict[];
}

export interface CheckTextDeps {
  ko: KoService;
  overlaps: OverlapService;
  // Konflikte klinken identisch per Dry-Run ein; ohne Service/Judge bleibt der Zweig leer.
  conflicts?: ConflictService;
  // Judges OPTIONAL injizierbar: Slice 5/6 verdrahten das echte Modell (reasoner.judgeDuplicate/
  // judgeConflict); ohne judge läuft nur der deterministische Pfad (kein Modell).
  duplicateJudge?: (coreA: string, coreB: string) => Promise<OverlapVerdict | null>;
  conflictJudge?: (coreA: string, coreB: string) => Promise<ConflictVerdict | null>;
  // Nur gesetzt, wenn KLARWERK_DUP_PREFILTER aktiv ist. Ohne → gedeckelter lexikalischer Fallback.
  semanticPrefilter?: SemanticPrefilter | undefined;
  minConfidence?: number;
}

// K0-2: Erkennungs-Gegenstand ist der Kerntext (title+statement+conditions+measures), nicht bodyHtml.
function toDetectSubject(ko: KnowledgeObject): DetectSubject {
  return {
    refId: ko.id,
    title: ko.title,
    statement: ko.statement,
    conditions: ko.conditions,
    measures: ko.measures,
    category: ko.category,
    tags: ko.tags,
    asset: ko.asset,
  };
}

function transientSubject(input: CheckTextInput): DetectSubject {
  return {
    refId: TRANSIENT_ID,
    title: input.title ?? "",
    statement: input.text,
    conditions: [],
    measures: [],
    tags: [],
    asset: null,
  };
}

// Pool = NUR validierte KOs. Der Orchestrator lädt NIE den Gesamtbestand: kein ko.list()-all, sondern
// entweder die semantischen topK-Treffer per ID oder die gedeckelte lexikalische Source-Query. Ob die
// QUELLE selbst hart auf topK deckelt, ist Sache des Repos: aktuell deckelt nur PgKoRepo quell-seitig
// (SQL LIMIT); der In-Memory-Dev-Adapter scort seinen kleinen Bestand voll und schneidet erst danach
// (s. repo.ts).
//  - Fix 1 (kein Textabfluss ohne judge): Der Semantic-Prefilter (embed → nearest) läuft NUR im
//    Modell-Modus (mind. ein judge gesetzt). Ohne judge verlässt KEIN Text den Prozess Richtung
//    Embedder/Provider — der deterministische Modus nutzt ausschließlich die lexikalische Source-Query.
//  - Fix 2 (Cap an der Quelle): Semantic-Pfad → store.nearest topK, dann NUR diese Treffer per ID
//    laden (bounded fetch). Lexikalisch → ko.findCandidates({terms, limit: topK}) mit hartem Limit.
// Der Validierungsfilter (status="validiert", keine Demo-Seeds, Subjekt ausgeschlossen) läuft auf der
// bereits gedeckelten Menge.
async function selectValidatedPool(
  subject: DetectSubject,
  deps: CheckTextDeps,
): Promise<DetectSubject[]> {
  // SCRUM-502: vertrauliche KOs sind KEINE Kandidaten — deckt BEIDE Stufen: Stufe 1 (lexikalischer Pool
  // → kein Titel-/Existenz-Leak in der Antwort) und Stufe 2 (semantischer + lexikalischer Pool → kein
  // coreText an Embedder/Judge; ein nearest-Treffer wird nach ko.get hier ebenfalls verworfen).
  const isValidatedCandidate = (k: KnowledgeObject): boolean =>
    k.status === "validiert" &&
    !k.demoSeed &&
    k.id !== subject.refId &&
    !isConfidential(k.confidentiality);

  const hasJudge = deps.duplicateJudge !== undefined || deps.conflictJudge !== undefined;
  const prefilter = deps.semanticPrefilter;
  if (hasJudge && prefilter) {
    try {
      const { vectors, embeddingVersion } = await prefilter.embedder.embed([coreText(subject)]);
      const query = vectors[0];
      if (query) {
        const hits = await prefilter.store.nearest(
          query,
          embeddingVersion,
          RETRIEVAL_TOP_K,
          subject.refId,
        );
        // Fix 2: bounded fetch — nur die topK Treffer per ID laden, NIE der Gesamtbestand.
        const fetched = await Promise.all(hits.map((h) => deps.ko.get(h.id)));
        const narrowed = fetched
          .filter((k): k is KnowledgeObject => k !== undefined && isValidatedCandidate(k))
          .map(toDetectSubject);
        if (narrowed.length > 0) {
          return narrowed;
        }
      }
    } catch (err) {
      // SCRUM-498 B2: Embed-Backpressure (Cap voll/Timeout) NICHT still zu lexikalischem Fallback
      // degradieren — sonst verschwiegen wir unter Last ein echtes Duplikat (falsch-negativ in einem
      // Sicherheits-Feature). Durchreichen → die HTTP-Schicht macht daraus 503 + Retry-After.
      // Namensbasiert erkannt, gleiche Präzedenz wie in overlap-service.modelBuild.
      if (err instanceof Error && err.name === "ModelCapacityError") {
        throw err;
      }
      // Echte Embedding-/Store-Fehler → lexikalischer, source-gedeckelter Fallback (unten).
    }
  }

  // Lexikalischer Pfad / Fallback: gedeckelte Candidate-Query an der Datenquelle (hartes topK VOR
  // Scoring) — kein ko.list()-all-then-filter. Ohne Inhaltstoken (nur Stoppwörter) kein Kandidat.
  const terms = queryTokens(coreText(subject));
  if (terms.length === 0) {
    return [];
  }
  const candidates = await deps.ko.findCandidates({ terms, limit: RETRIEVAL_TOP_K });
  return candidates.filter(isValidatedCandidate).map(toDetectSubject);
}

// Der Dry-Run: transienter Text → validierter, gebundener Pool → assessAgainstPool (kein Insert, kein
// Board, kein Audit). Ohne Treffer/leeren Pool ein leeres Ergebnis. Wirft nicht für einen leeren Pool.
export async function checkText(
  input: CheckTextInput,
  deps: CheckTextDeps,
): Promise<CheckTextResult> {
  const subject = transientSubject(input);
  const pool = await selectValidatedPool(subject, deps);
  if (pool.length === 0) {
    return { duplicates: [], conflicts: [] };
  }
  const assessOptions =
    deps.minConfidence !== undefined ? { minConfidence: deps.minConfidence } : {};
  const duplicates = await deps.overlaps.assessAgainstPool(
    subject,
    pool,
    deps.duplicateJudge,
    assessOptions,
  );
  const conflicts = deps.conflicts
    ? await deps.conflicts.assessAgainstPool(subject, pool, deps.conflictJudge, assessOptions)
    : [];
  return { duplicates, conflicts };
}

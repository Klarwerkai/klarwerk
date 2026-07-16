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
  lexicalOverlapScore,
} from "../../conflicts";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import type { SemanticPrefilter } from "./duplicate-detection";

// Transienter Gegenstand: der eingegebene Text, ohne gespeichertes KO. refId ist ein fester Marker,
// damit er sich nie mit einer echten KO-ID überschneidet.
const TRANSIENT_ID = "transient";

// Obergrenze des gedeckelten lexikalischen Fallbacks (wenn kein/leerer Vektor-Store) — NIE ein
// „jeder gegen jeden"-Full-Scan. Der Prefilter (store.nearest topK) verengt sonst schon.
const LEXICAL_FALLBACK_CAP = 8;

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

// Pool = NUR validierte KOs, gebunden über den Prefilter (nearest topK) ODER — wenn kein/leerer/
// fehlerhafter Store — den gedeckelten lexikalischen Fallback (top-N nach lexikalischer Deckung).
// NIE ein Full-Scan „jeder gegen jeden".
async function selectValidatedPool(
  subject: DetectSubject,
  deps: CheckTextDeps,
): Promise<DetectSubject[]> {
  const validated = (await deps.ko.list())
    .filter((k) => k.status === "validiert" && !k.demoSeed && k.id !== subject.refId)
    .map(toDetectSubject);
  if (validated.length === 0) {
    return [];
  }
  const prefilter = deps.semanticPrefilter;
  if (prefilter) {
    try {
      const { vectors, embeddingVersion } = await prefilter.embedder.embed([coreText(subject)]);
      const query = vectors[0];
      if (query) {
        const hits = await prefilter.store.nearest(
          query,
          embeddingVersion,
          prefilter.topK,
          subject.refId,
        );
        const ids = new Set(hits.map((h) => h.id));
        const narrowed = validated.filter((c) => ids.has(c.refId));
        if (narrowed.length > 0) {
          return narrowed;
        }
      }
    } catch {
      // Fehler im Embedding/Store → gedeckelter lexikalischer Fallback (nie Full-Scan).
    }
  }
  // Gedeckelter lexikalischer Fallback: die lexikalisch nächsten Top-N validierten KOs.
  return [...validated]
    .sort((x, y) => lexicalOverlapScore(subject, y) - lexicalOverlapScore(subject, x))
    .slice(0, LEXICAL_FALLBACK_CAP);
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

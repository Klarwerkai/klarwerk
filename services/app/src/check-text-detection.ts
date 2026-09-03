// SCRUM-491 (Slice 4): side-effect-freier Dry-Run-Detection-Kern für transienten Freitext. Muster wie
// duplicate-detection.ts (App-Root verdrahtet knowledge-object ↔ conflicts ↔ optional Prefilter/Modell),
// ABER: KEIN Endpunkt, KEINE Persistenz. Der Kern ist erst ab Slice 5 erreichbar. Er prüft beliebigen
// Text gegen den erlaubten Bestand und gibt Dry-Run-Ergebnisse zurück — nichts wird angelegt, nichts
// ins Board geschrieben, kein Inhalt auditiert. Der bestehende detect-Pfad (mit createAuto) bleibt
// unberührt; dies ist ein reiner neuer Abzweig.
//
// JOB 3020 (Pedis Diktat vom 30.07.): WELCHER Bestand das ist, entscheidet der AUFRUFER, nicht mehr
// diese Datei. Bis hierher galt hart „nur validiert" — wer denselben Sachverhalt einreichte, der
// schon als noch nicht validiertes Objekt im Haus lag, bekam „nichts gefunden" und legte die
// Dublette an. Der Verlust entstand in DIESEM Filter, nicht an der Quelle: `findCandidates` ist
// statusneutral (belegt in knowledge-object/src/repo-candidates.test.ts:54-70). Der Schalter heißt
// `includeUnvalidated` und ist standardmäßig AUS — ohne ihn verhält sich `checkText` wie zuvor.
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
import {
  type KnowledgeObject,
  type KoService,
  type KoStatus,
  isConfidential,
} from "../../knowledge-object";
import { queryTokens } from "../../reasoner";
import { DETECTION_CANDIDATE_CAP } from "./detection-cap";
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
//
// AUFTRAG-mega28 A1 (Pedi 26.07.): Dieser Deckel war der ERPROBTE Ausgangspunkt für den Live-Weg —
// und damit ist es derselbe Deckel. Er wohnt jetzt EINMAL in detection-cap.ts (Wert unverändert 20);
// der Name bleibt hier stehen, weil er an dieser Stelle die Retrieval-Grenze benennt. Trocken- und
// Live-Lauf können so nicht mehr auseinanderdriften.
const RETRIEVAL_TOP_K = DETECTION_CANDIDATE_CAP;

export interface CheckTextInput {
  text: string;
  title?: string;
  locale?: "de" | "en";
}

// ================================================================================================
// JOB 3020 — DER FUNDORT REIST MIT DEM TREFFER.
// ================================================================================================
//
// „Man sieht, ob es das schon gibt — und WO es liegt." Ein Treffer ohne Zustand ist unbrauchbar,
// sobald der ungeprüfte Bestand mitzählt: der Mensch muss unterscheiden können, ob er gegen eine
// beschlossene Regel läuft oder gegen den Entwurf eines Kollegen.
//
// DIE ANREICHERUNG WOHNT HIER und nicht in `DryRunOverlap`/`DryRunConflict`: `services/conflicts`
// kennt `knowledge-object` nicht (Modulgrenze) — Zustand und Kategorie sind dort schlicht nicht
// bekannt. Der Pool wird in DIESER Datei aus Wissensobjekten gebaut; hier liegen beide Werte
// bereits vor, ohne eine einzige zusätzliche Abfrage.
//
// `null` IST EINE ECHTE ANTWORT: trägt der Bestand keine Kategorie, steht `null` — kein geratener
// Wert. Dasselbe gilt für den (konstruktiv unmöglichen) Fall eines Treffers ohne Pool-Eintrag:
// dann sagt der Fundort nichts, statt etwas zu behaupten.
export interface CheckTextHitOrigin {
  koStatus: KoStatus | null;
  koCategory: string | null;
}

export type CheckTextDuplicate = DryRunOverlap & CheckTextHitOrigin;
export type CheckTextConflict = DryRunConflict & CheckTextHitOrigin;

// Ergebnis-Form: Duplikate (Pflichtpfad) + Konflikte (symmetrisch, optional — leer ohne conflictJudge).
export interface CheckTextResult {
  duplicates: CheckTextDuplicate[];
  conflicts: CheckTextConflict[];
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
  // JOB 3020: nimmt den NOCH NICHT VALIDIERTEN Bestand in den Pool. Default AUS — wer das Feld
  // nicht setzt, bekommt byteweise das bisherige Verhalten (nur validiert). Der Schalter gehört
  // dem Aufrufer: die Route setzt ihn am AUTHENTIFIZIERTEN Weg (Mensch ja, Add-in nein), nie am
  // Anfragerumpf. Die drei harten Ausschlüsse (Demo-Seed, das Subjekt selbst, Vertraulichkeit)
  // hebt er NICHT auf.
  includeUnvalidated?: boolean;
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

// JOB 3020: der Fundort eines Pool-Eintrags, gemerkt BEVOR `toDetectSubject` das Wissensobjekt auf
// den Erkennungs-Gegenstand verengt (dieser kennt den Status nicht). Kategorie nur, wenn der
// Bestand wirklich eine trägt — eine leere Zeichenkette ist keine Kategorie, sondern ihr Fehlen.
function toHitOrigin(ko: KnowledgeObject): CheckTextHitOrigin {
  const category = typeof ko.category === "string" ? ko.category.trim() : "";
  return { koStatus: ko.status, koCategory: category.length > 0 ? category : null };
}

// Der gebundene Pool samt Fundort je Kandidat — eine Ladung, zwei Auskünfte. Es wird NICHTS
// nachgeladen: `origins` entsteht aus denselben Objekten, aus denen der Pool entsteht.
interface SelectedPool {
  pool: DetectSubject[];
  origins: Map<string, CheckTextHitOrigin>;
}

function toSelectedPool(kos: KnowledgeObject[]): SelectedPool {
  return {
    pool: kos.map(toDetectSubject),
    origins: new Map(kos.map((k) => [k.id, toHitOrigin(k)])),
  };
}

// Pool = der ERLAUBTE Bestand. Der Orchestrator lädt NIE den Gesamtbestand: kein ko.list()-all, sondern
// entweder die semantischen topK-Treffer per ID oder die gedeckelte lexikalische Source-Query. Ob die
// QUELLE selbst hart auf topK deckelt, ist Sache des Repos: aktuell deckelt nur PgKoRepo quell-seitig
// (SQL LIMIT); der In-Memory-Dev-Adapter scort seinen kleinen Bestand voll und schneidet erst danach
// (s. repo.ts).
//  - Fix 1 (kein Textabfluss ohne judge): Der Semantic-Prefilter (embed → nearest) läuft NUR im
//    Modell-Modus (mind. ein judge gesetzt). Ohne judge verlässt KEIN Text den Prozess Richtung
//    Embedder/Provider — der deterministische Modus nutzt ausschließlich die lexikalische Source-Query.
//  - Fix 2 (Cap an der Quelle): Semantic-Pfad → store.nearest topK, dann NUR diese Treffer per ID
//    laden (bounded fetch). Lexikalisch → ko.findCandidates({terms, limit: topK}) mit hartem Limit.
// Die Poolregel (Zustand je nach Schalter, keine Demo-Seeds, Subjekt ausgeschlossen, nichts
// Vertrauliches) läuft auf der bereits gedeckelten Menge.
async function selectPool(subject: DetectSubject, deps: CheckTextDeps): Promise<SelectedPool> {
  // JOB 3020: EINE Poolregel, EIN Schalter. Weich ist nur der Zustand: ohne `includeUnvalidated`
  // zählt wie bisher ausschließlich Validiertes; mit ihm zählt der ungeprüfte Bestand mit.
  //
  // HART BLEIBEN ALLE DREI ÜBRIGEN AUSSCHLÜSSE, und der Schalter erreicht sie nicht:
  //  · `!k.demoSeed`            — Demobestand ist kein Wissen des Hauses.
  //  · `k.id !== subject.refId` — nichts findet sich selbst.
  //  · SCRUM-502: vertrauliche KOs sind KEINE Kandidaten — deckt BEIDE Stufen: Stufe 1
  //    (lexikalischer Pool → kein Titel-/Existenz-Leak in der Antwort) und Stufe 2 (semantischer +
  //    lexikalischer Pool → kein coreText an Embedder/Judge; ein nearest-Treffer wird nach ko.get
  //    hier ebenfalls verworfen). Ein ungeprüftes VERTRAULICHES Objekt bleibt damit auf BEIDEN
  //    Wegen unsichtbar — die neue Reichweite ist eine Reichweite über Zustände, nicht über Rechte.
  const isPoolCandidate = (k: KnowledgeObject): boolean =>
    (deps.includeUnvalidated === true || k.status === "validiert") &&
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
        const narrowed = fetched.filter(
          (k): k is KnowledgeObject => k !== undefined && isPoolCandidate(k),
        );
        if (narrowed.length > 0) {
          return toSelectedPool(narrowed);
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
    return { pool: [], origins: new Map() };
  }
  const candidates = await deps.ko.findCandidates({ terms, limit: RETRIEVAL_TOP_K });
  return toSelectedPool(candidates.filter(isPoolCandidate));
}

// JOB 3020: den Fundort an den Treffer heften. Die Treffer stammen ausschließlich aus dem Pool —
// ein `koId` ohne Eintrag in `origins` kann konstruktiv nicht entstehen. Träte er doch auf, wird
// NICHTS geraten: dann sagt der Fundort schlicht nichts (null), statt einen Zustand zu behaupten.
function withOrigin<T extends { koId: string }>(
  hits: T[],
  origins: ReadonlyMap<string, CheckTextHitOrigin>,
): Array<T & CheckTextHitOrigin> {
  return hits.map((hit) => {
    const origin = origins.get(hit.koId);
    return {
      ...hit,
      koStatus: origin?.koStatus ?? null,
      koCategory: origin?.koCategory ?? null,
    };
  });
}

// Der Dry-Run: transienter Text → erlaubter, gebundener Pool → assessAgainstPool (kein Insert, kein
// Board, kein Audit). Ohne Treffer/leeren Pool ein leeres Ergebnis. Wirft nicht für einen leeren Pool.
export async function checkText(
  input: CheckTextInput,
  deps: CheckTextDeps,
): Promise<CheckTextResult> {
  const subject = transientSubject(input);
  const { pool, origins } = await selectPool(subject, deps);
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
  // Der Fundort kommt aus dem bereits geladenen Pool — keine zweite Abfrage, kein Nachladen.
  return {
    duplicates: withOrigin(duplicates, origins),
    conflicts: withOrigin(conflicts, origins),
  };
}

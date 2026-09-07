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
  type KoSichtbarkeitstrim,
  type KoStatus,
  isConfidential,
  normalizeSearchFragment,
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
//
// JOB 3093 (M3 „Haben wir das schon?"): die VERSION reist mit — dieselbe Regel, dieselbe Quelle
// (das bereits geladene Wissensobjekt), dieselbe null-Bedeutung. Das Panel zeigt sie neben dem
// Prüfstand, damit ein Mensch erkennt, WELCHEN Stand er vor sich hat.
export interface CheckTextHitOrigin {
  koStatus: KoStatus | null;
  koCategory: string | null;
  koVersion: number | null;
}

export type CheckTextDuplicate = DryRunOverlap & CheckTextHitOrigin;
export type CheckTextConflict = DryRunConflict & CheckTextHitOrigin;

// ==================================================================================================
// JOB 3216 · M3c — DER QUELLENFUND: DIE PASSAGE STEHT IM VOLLTEXT, NICHT IM KERNTEXT.
// ==================================================================================================
//
// DER BEFUND, DER DAS ERZWINGT (Codex 51999a48, Vorführungsmessung 07.09.2026). Pedi importiert ein
// ganzes Word-Dokument, fragt später aus Word heraus mit einem Absatz daraus — und bekommt „nichts
// gefunden". Der Grund steht oben in dieser Datei, Zeile für Zeile: K0-2 macht den KERNTEXT zum
// Erkennungs-Gegenstand (Titel, Aussage, Bedingungen, Maßnahmen), und der eingegebene Absatz steht
// im `bodyHtml` des Bestandsobjekts, nicht in seiner 476 Zeichen langen `statement`.
//
// WAS HIER NICHT PASSIERT — und das ist die wichtigere Hälfte: K0-2 bleibt. Das Dublettenurteil,
// der Konfliktbefund und die beiden Judges sehen weiterhin ausschließlich den Kerntext. Ein
// Quellenfund ist AUSDRÜCKLICH KEINE identische Wissensaussage: er sagt „diese Passage steht schon
// irgendwo im Volltext eines Bestandsobjekts", und mehr behauptet er nicht. Deshalb ein eigener
// Treffertyp mit eigenem Namen, statt ein Duplikat mit gelockertem Maß.
//
// WOHER DIE TREFFER KOMMEN — kein zweiter Index, keine zweite Suchlogik. Der Weg ist wörtlich der
// von `GET /api/library/search`: `KoService.findSearchHits` (der eine Sucheinstieg, service.ts
// „der einzige Sucheinstieg bleibt findSearchHits") auf der revisionsgebundenen Suchprojektion,
// danach `KoService.listForSearch` für die body-freien Objekte. KEIN On-the-fly-Scan des `bodyHtml`
// (search-projection.ts:19 sagt, warum das ein Denial-Weg gegen sich selbst wäre), KEINE
// Ähnlichkeitsheuristik, KEIN Modell, KEIN Embedder — also auch kein Textabfluss.
//
// WARUM TROTZDEM EINE NACHPRÜFUNG AM SUCHTEXT. Der gemeinsame Suchvertrag verknüpft seine `terms`
// ODER (search-projection.ts `KoSearchQuery`), und ob ein Adapter „enthält" als zusammenhängende
// Zeichenkette oder als Tokenmenge auslegt, ist seine Sache. Ein Quellenfund darf aber nur
// entstehen, wenn die Passage ZUSAMMENHÄNGEND im Suchtext des Treffers steht — sonst wäre „steht
// schon in X" eine Behauptung über eine Wortwolke. Die Nachprüfung findet deshalb hier statt, am
// Suchtext des jeweiligen Treffers, unabhängig vom Adapter.
//
// UND WARUM `coverage`. Bei langen Eingaben ist der Suchbegriff ein charakteristischer Ausschnitt
// (s. `suchbegriffAus`) — der findet KANDIDATEN. Bestätigt wird danach die VOLLSTÄNDIG gewählte
// normalisierte Passage; deckt der Treffer nur den Ausschnitt, steht `partial` samt gedeckter
// Zeichenzahl da. Ein gemeinsamer Standardsatz belegt damit nie das ganze Dokument.

/** `full` — die ganze gewählte Passage steht zusammenhängend im Suchtext. `partial` — nur der
 *  Ausschnitt, mit dem gesucht wurde. Die Zahlen daneben sagen, wie viel das ist. */
export type SourceHitCoverage = "full" | "partial";

export interface CheckTextSourceHit {
  refId: string;
  koTitle: string;
  /** Der ROHE Bestandswert wie bei JOB 3020; die Route übersetzt ihn in den Prüfstand. */
  koStatus: KoStatus | null;
  koCategory: string | null;
  koVersion: number | null;
  coverage: SourceHitCoverage;
  /** Zeichen der Passage, die am Suchtext des Treffers wirklich belegt sind. */
  gedeckteZeichen: number;
  /** Zeichen der normalisierten Passage insgesamt — der Nenner zu `gedeckteZeichen`. */
  passageZeichen: number;
  /** Ausschnitt aus dem Suchtext, ±120 Zeichen um die Fundstelle. */
  fundstelle: string;
  /** Erste Quellenangabe des Objekts, falls es eine trägt — sonst `null`, nie ein Platzhalter. */
  quelle: { label: string; url: string | null } | null;
  /** Name des ersten Anhangs, falls vorhanden. */
  anhang: string | null;
}

/**
 * WARUM ES DIESES FELD GIBT (Zustandsmodell §7): `sourceHits: []` sah sonst in drei Lagen gleich
 * aus — die Passage war zu kurz für eine Suche, die Suchprojektion ist auf dieser Instanz nicht
 * freigegeben (dann WIRFT `findSearchHits`, s. service.ts), oder es wurde wirklich gesucht und
 * nichts gefunden. Nur in der dritten Lage darf eine Fläche „steht noch nirgends" sagen.
 */
export type QuellenfundGrund = "passage_zu_kurz" | "suche_nicht_verfuegbar";

export interface Quellenfundlage {
  gelaufen: boolean;
  grund: QuellenfundGrund | null;
  /** Wie viele zulässige Kandidaten am Suchtext nachgeprüft wurden (höchstens `SOURCE_HIT_CAP`). */
  geprueft: number;
}

// Ergebnis-Form: Duplikate (Pflichtpfad) + Konflikte (symmetrisch, optional — leer ohne conflictJudge).
// JOB 3216: dazu die Quellenfunde — ZUSÄTZLICH, nie statt eines Urteils.
// Die drei Quellenfund-Felder sind OPTIONAL, und das ist keine Bequemlichkeit, sondern der
// Auftragsvertrag §5.4: „Antwortschema abwärtskompatibel (fehlt = leer)". `checkText` setzt sie
// IMMER; ein anderer oder älterer Erzeuger eines `CheckTextResult` muss es nicht.
//
// RUNDE 2, gemessen statt gemutmaßt: `services/app/src/routes/job1970-konfliktriegel.test.ts:99`
// reicht der Route ein Ergebnis `{duplicates, conflicts, fundorte}` ohne diese Felder herein. Mit
// einem PFLICHT-Feld war das ein `undefined.map` im Handler und damit ein 500 — die Zugabe hätte
// die alte Zusage gekippt. Optional gemacht, sagt der Compiler dem Leser der Route, dass sie fehlen
// KÖNNEN, und die Route liest sie entsprechend (`toResponse`): fehlt = leer, nie geraten.
export interface CheckTextResult {
  duplicates: CheckTextDuplicate[];
  conflicts: CheckTextConflict[];
  sourceHits?: CheckTextSourceHit[];
  /** Es gab mehr ZULÄSSIGE, SICHTBARE Kandidaten, als der Deckel nachprüft. Verborgene Objekte
   *  zählen hier nie mit — sonst wäre die Zahl eine Existenzauskunft über sie. */
  sourceHitsTruncated?: boolean;
  quellenfund?: Quellenfundlage;
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
  // ============================================================================================
  // JOB 3216 — DIE SICHTBARKEITSENTSCHEIDUNG KOMMT VON DER ROUTE, NICHT AUS DIESER DATEI.
  // ============================================================================================
  //
  // Die Quellenfunde durchsuchen den GESPEICHERTEN VOLLTEXT und liefern einen Ausschnitt daraus
  // zurück. Damit gilt für sie dieselbe Grenze wie für `GET /api/library/search`: die Frage „darf
  // dieser Mensch dieses Objekt sehen" wird an EINER Stelle beantwortet (`sichtbarkeit.ts`), und
  // die Route reicht die fertige Entscheidung herein — als Prädikat (`sichtbarkeitsfilterFuer`)
  // UND als Trim für die Datenquelle (`sqlSichtbarkeitFuer`), genau wie library-routes.ts. Zwei
  // Linien, dieselbe Regel: G-SHADOW, eine neue Regel darf Sichtbarkeit nie erweitern.
  //
  // FEHLEN BEIDE, wird NICHTS aufgeweicht: der Add-in-Weg hat keinen angemeldeten Menschen, und
  // für ihn ist der Pool ohnehin enger (nur validiert, kein Demo-Seed, nichts Vertrauliches —
  // `istPoolKandidat` unten). Sie berühren ausschließlich die Quellenfunde; Dubletten- und
  // Konfliktpool bleiben unangetastet.
  quellenSichtbar?: (ko: KnowledgeObject) => boolean;
  quellenTrim?: KoSichtbarkeitstrim;
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
  return {
    koStatus: ko.status,
    koCategory: category.length > 0 ? category : null,
    // JOB 3093: nur eine echte Zahl ist eine Version; alles andere ist „der Bestand sagt nichts".
    koVersion: typeof ko.version === "number" && Number.isFinite(ko.version) ? ko.version : null,
  };
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
// JOB 3020: EINE Poolregel, EIN Schalter. Weich ist nur der Zustand: ohne `includeUnvalidated`
// zählt wie bisher ausschließlich Validiertes; mit ihm zählt der ungeprüfte Bestand mit.
//
// HART BLEIBEN ALLE DREI ÜBRIGEN AUSSCHLÜSSE, und der Schalter erreicht sie nicht:
//  · `!k.demoSeed`            — Demobestand ist kein Wissen des Hauses.
//  · `k.id !== subjectRefId`  — nichts findet sich selbst.
//  · SCRUM-502: vertrauliche KOs sind KEINE Kandidaten — deckt BEIDE Stufen: Stufe 1
//    (lexikalischer Pool → kein Titel-/Existenz-Leak in der Antwort) und Stufe 2 (semantischer +
//    lexikalischer Pool → kein coreText an Embedder/Judge; ein nearest-Treffer wird nach ko.get
//    hier ebenfalls verworfen). Ein ungeprüftes VERTRAULICHES Objekt bleibt damit auf BEIDEN
//    Wegen unsichtbar — die neue Reichweite ist eine Reichweite über Zustände, nicht über Rechte.
//
// JOB 3216: dieselbe Regel gilt für die Quellenfunde — und sie steht deshalb ab hier EINMAL als
// benannte Funktion statt zweimal abgeschrieben. Der Wortlaut ist gegenüber dem geschlossenen
// Ausdruck in `selectPool` unverändert; nur `subject.refId` reist jetzt als Parameter herein.
//
// BENANNTE GRENZE beim Quellenfund: der geprüfte Text ist TRANSIENT (`TRANSIENT_ID`), er ist kein
// gespeichertes Wissensobjekt. `k.id !== subjectRefId` hat dort also kein Ziel und kann keins
// haben — die Regel ist dieselbe, ihr Gegenstand fehlt. Sie wird trotzdem mitgeführt, damit es
// nicht zwei Auslegungen des Pools gibt.
function istPoolKandidat(k: KnowledgeObject, subjectRefId: string, deps: CheckTextDeps): boolean {
  return (
    (deps.includeUnvalidated === true || k.status === "validiert") &&
    !k.demoSeed &&
    k.id !== subjectRefId &&
    !isConfidential(k.confidentiality)
  );
}

async function selectPool(subject: DetectSubject, deps: CheckTextDeps): Promise<SelectedPool> {
  const isPoolCandidate = (k: KnowledgeObject): boolean => istPoolKandidat(k, subject.refId, deps);

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

// ================================================================================================
// JOB 3216 · M3c — DER QUELLENFUND, SCHRITT FÜR SCHRITT.
// ================================================================================================

// Die Grundabfrage am gemeinsamen Suchvertrag. DIESELBE Zahl, mit der die Bibliothek ihre eigene
// Trefferabfrage deckelt (`LIBRARY_SEARCH_HIT_LIMIT = 200`, library-analytics/src/service.ts) —
// ein Suchvertrag, ein Deckel. Er schützt die Datenquelle; er ist NICHT die Zahl, aus der
// `sourceHitsTruncated` entsteht (die kommt aus dem sichtbaren, zulässigen Pool, s. unten).
const SOURCE_HIT_QUERY_CAP = 200;

// Der Aufwandsdeckel dieses Auftrags: so viele zulässige Kandidaten werden am Suchtext
// NACHGEPRÜFT und höchstens so viele Funde ausgeliefert. Jede Nachprüfung lädt genau EIN
// Suchdokument (die persistierte Projektion, kein bodyHtml-Scan) — der Preis je Anfrage ist damit
// nach oben durch diese Zahl begrenzt und nicht durch die Größe des Bestands.
const SOURCE_HIT_CAP = 20;

// Kürzer als das ist keine Passage, sondern ein Wortfetzen: er stünde in halben Bestand und machte
// aus „steht schon in X" eine Zufallsauskunft. Dieselbe Zahl wie die Mindestlänge der Route
// (`MIN_TEXT`, check-text-routes.ts) — eine Eingabe, die dort durchkommt, ist hier lang genug.
const PASSAGE_MIN = 40;

// Obergrenze des Suchbegriffs. Eine ganze Word-Auswahl (bis 8.000 Zeichen) als ein `ILIKE`-Muster
// wäre für jede Datenquelle eine Zumutung und träfe zudem an der kleinsten Abweichung nicht mehr.
const SUCHBEGRIFF_MAX = 200;

// Was links und rechts der Fundstelle mitgeliefert wird, damit ein Mensch sie einordnen kann.
const FUNDSTELLE_RAND = 120;

// Satzgrenze für die Wahl des charakteristischen Ausschnitts. Bewusst nur die drei Satzzeichen,
// die im normalisierten Text einen Satz beenden können — kein Sprachmodell, keine Abkürzungsliste.
const SATZGRENZE = /(?<=[.!?])\s+/;

/** Schneidet auf `max` Zeichen und dabei auf die letzte Wortgrenze — nie mitten ins Wort. */
function kuerzeAufWortgrenze(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const roh = text.slice(0, max);
  const letzte = roh.lastIndexOf(" ");
  return letzte >= PASSAGE_MIN ? roh.slice(0, letzte) : roh;
}

/**
 * DER SUCHBEGRIFF — und die Regel dahinter, ausgeschrieben, weil sie eine Entscheidung ist.
 *
 * Passt die ganze normalisierte Passage unter `SUCHBEGRIFF_MAX`, ist SIE der Suchbegriff; dann
 * sind Kandidatensuche und Bestätigung dasselbe und `coverage` kann nur `full` werden.
 *
 * Ist sie länger, wird EIN charakteristischer Satz gesucht: der LÄNGSTE Satz der Passage, der die
 * Mindestlänge trägt. Nicht der erste — ein Absatz beginnt oft mit einem Standardsatz („Bitte
 * beachten Sie …"), und der stünde in jedem zweiten Dokument. Der längste Satz ist der Satz mit
 * den meisten Eigenheiten. Das ist eine Auswahlregel für den SUCHBEGRIFF, keine Ähnlichkeits-
 * heuristik für den TREFFER: worüber der Treffer entschieden wird, steht in `deckungAm`.
 *
 * Das Ergebnis ist IMMER eine zusammenhängende Teilzeichenkette der Passage — nur so ist die
 * Aussage „der Treffer deckt N von M Zeichen" überhaupt nachrechenbar.
 */
function suchbegriffAus(passage: string): string | null {
  if (passage.length < PASSAGE_MIN) {
    return null;
  }
  if (passage.length <= SUCHBEGRIFF_MAX) {
    return passage;
  }
  let laengster = "";
  for (const satz of passage.split(SATZGRENZE)) {
    if (satz.length >= PASSAGE_MIN && satz.length > laengster.length) {
      laengster = satz;
    }
  }
  return kuerzeAufWortgrenze(
    laengster.length >= PASSAGE_MIN ? laengster : passage,
    SUCHBEGRIFF_MAX,
  );
}

function fundstelleAus(suchtext: string, ab: number, laenge: number): string {
  const von = Math.max(0, ab - FUNDSTELLE_RAND);
  const bis = Math.min(suchtext.length, ab + laenge + FUNDSTELLE_RAND);
  const kern = suchtext.slice(von, bis);
  return `${von > 0 ? "… " : ""}${kern}${bis < suchtext.length ? " …" : ""}`;
}

interface Deckung {
  coverage: SourceHitCoverage;
  gedeckteZeichen: number;
  fundstelle: string;
}

/**
 * DIE NACHPRÜFUNG AM SUCHTEXT — hier entscheidet sich, ob es ein Quellenfund ist.
 *
 * ZUSAMMENHÄNGEND ENTHALTEN, nicht „die Wörter kommen vor". Zuerst die ganze Passage (`full`),
 * sonst der Ausschnitt, mit dem gesucht wurde (`partial`). Trifft keines von beidem, ist der
 * Kandidat KEIN Fund — auch wenn die Datenquelle ihn geliefert hat.
 *
 * Groß-/Kleinschreibung wird ignoriert, so wie in der Suche selbst (`matchEffectiveSearchDocument`
 * vergleicht kleingeschrieben). BENANNTE FEINHEIT: einige Unicode-Kleinschreibungen sind LÄNGER
 * als ihr Original (etwa U+0130). Verschiebt sich dadurch die Länge, wird der Ausschnitt aus dem
 * kleingeschriebenen Text genommen — lieber eine kleingeschriebene Fundstelle als eine, die um
 * ein paar Zeichen daneben liegt und etwas anderes zeigt, als sie behauptet.
 */
function deckungAm(suchtext: string, passage: string, begriff: string): Deckung | null {
  const klein = suchtext.toLowerCase();
  const quelle = klein.length === suchtext.length ? suchtext : klein;
  const voll = klein.indexOf(passage.toLowerCase());
  if (voll >= 0) {
    return {
      coverage: "full",
      gedeckteZeichen: passage.length,
      fundstelle: fundstelleAus(quelle, voll, passage.length),
    };
  }
  const teil = klein.indexOf(begriff.toLowerCase());
  if (teil >= 0) {
    return {
      coverage: "partial",
      gedeckteZeichen: begriff.length,
      fundstelle: fundstelleAus(quelle, teil, begriff.length),
    };
  }
  return null;
}

/** Erste Quellenangabe mit echtem Etikett — sonst `null`. Kein erfundener Platzhalter. */
function quelleVon(ko: KnowledgeObject): { label: string; url: string | null } | null {
  for (const quelle of ko.sources ?? []) {
    const label = typeof quelle.label === "string" ? quelle.label.trim() : "";
    if (label.length > 0) {
      return { label, url: quelle.url ?? null };
    }
  }
  return null;
}

function anhangVon(ko: KnowledgeObject): string | null {
  for (const anhang of ko.attachments ?? []) {
    const name = typeof anhang.name === "string" ? anhang.name.trim() : "";
    if (name.length > 0) {
      return name;
    }
  }
  return null;
}

interface Quellenfundergebnis {
  sourceHits: CheckTextSourceHit[];
  sourceHitsTruncated: boolean;
  quellenfund: Quellenfundlage;
}

const OHNE_QUELLENFUND = (grund: QuellenfundGrund | null): Quellenfundergebnis => ({
  sourceHits: [],
  sourceHitsTruncated: false,
  quellenfund: { gelaufen: grund === null, grund, geprueft: 0 },
});

/**
 * DER QUELLENFUND-LAUF. Vier Schritte, jeder mit einem eigenen Grund:
 *
 *   1 SUCHEN  — `findSearchHits` auf der Suchprojektion, gedeckelt. Der eine Sucheinstieg des
 *               Hauses; die Bibliothek nimmt denselben.
 *   2 LADEN   — `listForSearch` liefert die body-freien Objekte samt Trim (Papierkorb und
 *               Sichtbarkeit an der Datenquelle, wie in library-routes.ts).
 *   3 FILTERN — die Sichtbarkeitsentscheidung der Route (zweite Linie, G-SHADOW) und danach die
 *               check-text-Poolregel. ERST DANACH wird gedeckelt: `sourceHitsTruncated` entsteht
 *               aus dem sichtbaren, zulässigen Pool und zählt nie ein verborgenes Objekt mit.
 *   4 PRÜFEN  — je Kandidat EIN Suchdokument laden und die Passage am Suchtext bestätigen.
 *
 * Die Reihenfolge der Kandidaten ist die des Suchvertrags (`findSearchHits`: validiert ↓,
 * Trust ↓, koId) — wer im Deckel überlebt, ist damit dieselbe Entscheidung wie überall sonst.
 */
// ================================================================================================
// JOB 3216 RUNDE 2 — EINE ZUGABE DARF DIE ANTWORT NIE BESCHÄDIGEN. EIN NETZ, NICHT DREI.
// ================================================================================================
//
// DER BEFUND AUS RUNDE 1, und er war meiner: der Quellenfund lag im normalen Ablauf von `checkText`
// und konnte ihn mit sich reißen. Runde 1 fing nur den EINEN Aufruf ab, von dem ich wusste, dass er
// wirft (`findSearchHits` ohne freigegebene Projektionsfassung). Alles danach —
// `listForSearch`, `effectiveSearchDocumentOf`, das hereingereichte Sichtbarkeitsprädikat — lief
// ungeschützt. Das Tor hat es gemessen: vier Bestandsdateien, 23 Fälle, `expected 500 to be 200`.
//
// DIE REGEL AB HIER, in einem Satz: DAS DUBLETTEN-/KONFLIKTURTEIL IST DIE ZUSAGE DIESER FUNKTION,
// der Quellenfund ist eine Zugabe — und eine Zugabe, die die Zusage kippen kann, ist keine Zugabe,
// sondern ein Risiko. Deshalb steht das Netz an EINER Stelle um den GANZEN Lauf (`quellenfundLauf`)
// statt an drei Stellen um je einen Aufruf: drei Netze sind drei Gelegenheiten, das vierte zu
// vergessen — genau der Fehler, den Runde 1 gemacht hat.
//
// WAS DAS NETZ NICHT TUT: schweigen. Es setzt `gelaufen: false` mit Grund
// `suche_nicht_verfuegbar`; die Antwort sagt also, dass sie nichts weiß, statt „nichts gefunden"
// zu behaupten (Zustandsmodell §7). Was es AUCH NICHT tut: den Fehler verschlucken, der zum
// Kerntexturteil gehört — `selectPool`, `assessAgainstPool` und die Judges liegen ausserhalb.
async function quellenfundLauf(
  input: CheckTextInput,
  subject: DetectSubject,
  deps: CheckTextDeps,
): Promise<Quellenfundergebnis> {
  try {
    return await selectSourceHits(input, subject, deps);
  } catch {
    return OHNE_QUELLENFUND("suche_nicht_verfuegbar");
  }
}

async function selectSourceHits(
  input: CheckTextInput,
  subject: DetectSubject,
  deps: CheckTextDeps,
): Promise<Quellenfundergebnis> {
  // Dieselbe Normalisierung wie die Projektion (Entities, NFKC, unsichtbare Zeichen, Leerraum) —
  // sonst verglichen wir zwei verschiedene Schreibweisen desselben Satzes.
  const passage = normalizeSearchFragment(input.text);
  const begriff = suchbegriffAus(passage);
  if (begriff === null) {
    return OHNE_QUELLENFUND("passage_zu_kurz");
  }
  const treffer = await deps.ko.findSearchHits({
    terms: [begriff],
    limit: SOURCE_HIT_QUERY_CAP,
  });
  if (treffer.length === 0) {
    return OHNE_QUELLENFUND(null);
  }
  const rang = new Map(treffer.map((hit, index) => [hit.koId, index]));
  // DER PREIS DIESER ZEILE, ehrlich benannt: `listForSearch` liest den body-freien Bestand — derselbe
  // Griff, den `LibraryService.search` für jede Bibliothekssuche tut. Er läuft nur, wenn die Suche
  // überhaupt etwas gefunden hat (oben), und er ist der GÜNSTIGSTE Weg, der über die öffentliche
  // Schnittstelle des Wissensobjekt-Dienstes erreichbar ist: `ko.get` je Kandidat lädt `bodyHtml`
  // samt eingebetteten Bilddaten (bis zu 200-mal), und einen body-freien Mehrfach-Nachschlag gibt
  // es am Dienst nicht (`repo.listByIds` ist nicht durchgereicht, und knowledge-object ist nicht
  // Zielpfad dieses Auftrags). Wird der Nachschlag später öffentlich, gehört diese Zeile ersetzt.
  const bestand = await deps.ko.listForSearch({}, deps.quellenTrim);
  const zulaessig = bestand
    .filter((ko) => rang.has(ko.id))
    .filter((ko) => deps.quellenSichtbar === undefined || deps.quellenSichtbar(ko))
    .filter((ko) => istPoolKandidat(ko, subject.refId, deps))
    .sort((a, b) => (rang.get(a.id) ?? 0) - (rang.get(b.id) ?? 0));
  const sourceHitsTruncated = zulaessig.length > SOURCE_HIT_CAP;
  const zuPruefen = zulaessig.slice(0, SOURCE_HIT_CAP);
  const sourceHits: CheckTextSourceHit[] = [];
  for (const ko of zuPruefen) {
    // Der Volltext kommt aus der PERSISTIERTEN Projektion (`effectiveSearchDocumentOf` — read-only,
    // „bewusst KEIN zweiter Suchweg"), nicht aus einem frisch geladenen `bodyHtml`.
    const doc = await deps.ko.effectiveSearchDocumentOf(ko.id);
    if (doc === undefined) {
      // Kein Suchdokument, also kein belegbarer Fund. Ehrlich weglassen statt raten.
      continue;
    }
    const deckung = deckungAm(doc.searchText, passage, begriff);
    if (deckung === null) {
      continue;
    }
    const kategorie = typeof ko.category === "string" ? ko.category.trim() : "";
    sourceHits.push({
      refId: ko.id,
      koTitle: ko.title,
      koStatus: ko.status,
      koCategory: kategorie.length > 0 ? kategorie : null,
      koVersion: typeof ko.version === "number" && Number.isFinite(ko.version) ? ko.version : null,
      coverage: deckung.coverage,
      gedeckteZeichen: deckung.gedeckteZeichen,
      passageZeichen: passage.length,
      fundstelle: deckung.fundstelle,
      quelle: quelleVon(ko),
      anhang: anhangVon(ko),
    });
  }
  return {
    sourceHits,
    sourceHitsTruncated,
    quellenfund: { gelaufen: true, grund: null, geprueft: zuPruefen.length },
  };
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
      koVersion: origin?.koVersion ?? null,
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
  // JOB 3216: der Quellenfund läuft UNABHÄNGIG vom Kerntext-Pool und deshalb VOR der Abkürzung
  // unten. Genau darin liegt der Fall, um den es geht: die Passage steht im Volltext, der Kerntext
  // des Bestandsobjekts trägt sie nicht — der Dublettenpool bleibt leer, der Quellenfund nicht.
  const quellen = await quellenfundLauf(input, subject, deps);
  const { pool, origins } = await selectPool(subject, deps);
  if (pool.length === 0) {
    return { duplicates: [], conflicts: [], ...quellen };
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
    ...quellen,
  };
}

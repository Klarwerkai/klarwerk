// SCRUM-527 (Live-Check): echte Ähnlichkeits-/Widerspruchsprüfung eines ENTWURFSTEXTES gegen den
// Bestand — die Datenquelle der Live-Reaktion in „Wissen erfassen". Hier — und nur hier — treffen sich
// knowledge-object (Kandidaten), conflicts (Scoring/Dry-Run) und der Konflikt-Judge. Modulgrenzen bleiben
// sauber: conflicts bekommt modul-reine Kerntext-Subjekte + einen judge-Callback.
//
// EHRLICHKEIT & KEIN EGRESS OHNE VERTRAG (SCRUM-527 WP3 — voller Provenienz-Vertrag):
//  - similar: rein LEXIKALISCH (Trigramm) gegen den Bestand — deterministisch, KEIN Modell, KEIN
//    Embedding-Egress von Nutzer-Freitext.
//  - conflicts: side-effect-freier Dry-Run (ConflictService.assessAgainstPool) mit dem Reasoner-Judge —
//    NUR echte Verdachte (G-2-Zitatprüfung sitzt in decideFromVerdict), nie erfunden. Der Judge läuft
//    über die bestehende, 502-gecappte Modellkette.
//  - Der Judge wird NUR ausgeführt, wenn die ROUTE ihn übergibt. Die fail-safe Contract-Entscheidung
//    (Freitext sicher NICHT-vertraulich klassifiziert UND Modell verfügbar — sonst vertraulich) liegt in
//    knowledge-check-routes, exakt wie bei /api/check-text. Fehlt der Judge → KEIN Cloud-/Modell-Aufruf
//    mit Freitext: conflicts = [] und Gesamtstatus "pending" (ehrlich „nicht geprüft"). similar bleibt.
import type { ConflictService, ConflictVerdict, DetectSubject } from "../../conflicts";
import { trigramSimilarity } from "../../conflicts";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import { dropConfidential } from "../../knowledge-object";

export interface KnowledgeCheckSimilar {
  id: string;
  title: string;
  score: number; // 0..1, lexikalisch
}
export interface KnowledgeCheckConflict {
  id: string;
  title: string;
  reason: string;
}
export interface KnowledgeCheckResult {
  status: "done" | "pending" | "failed";
  similar: KnowledgeCheckSimilar[];
  conflicts: KnowledgeCheckConflict[];
}

// Der Konflikt-Judge-Callback (modul-rein): zwei Kerntexte → Verdikt. Signatur-kompatibel mit
// Reasoner.judgeConflict; die Route bindet das konkrete Modell (oder null) daran.
export type DraftConflictJudge = (coreA: string, coreB: string) => Promise<ConflictVerdict | null>;

export interface KnowledgeCheckDeps {
  ko: KoService;
  conflicts: ConflictService;
  // SCRUM-527 (WP3): der Judge läuft NUR, wenn er hier übergeben wird. Die fail-safe Entscheidung
  // (nicht-vertraulich klassifiziert + Modell verfügbar) trifft die Route. Fehlt er (vertraulich/unklar/
  // kein Modell) → KEIN Egress von Freitext: conflicts = [] mit status "pending".
  judge?: DraftConflictJudge | null;
}

// Kerntext-Subjekt aus dem Freitext (kein KO-Anker). Nur statement trägt den Text; der Rest ist leer.
function subjectFromText(text: string): DetectSubject {
  return {
    refId: "__intake_draft__",
    title: "",
    statement: text,
    conditions: [],
    measures: [],
    category: "",
    tags: [],
    asset: null,
  };
}

function koToSubject(ko: KnowledgeObject): DetectSubject {
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

// Schwellen: Performance-Deckel (525 P.1) — lexikalischer Vorfilter, begrenzte Kandidaten.
const SIMILAR_MIN_SCORE = 0.18;
const SIMILAR_LIMIT = 5;
const CANDIDATE_LIMIT = 40;

// Reine Wörter für die Kandidaten-Vorauswahl (Keyword-Prefilter des Repos).
function terms(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9äöüß]+/i)
        .filter((w) => w.length > 3),
    ),
  ).slice(0, 12);
}

export async function checkKnowledge(
  text: string,
  deps: KnowledgeCheckDeps,
): Promise<KnowledgeCheckResult> {
  const clean = text.trim();
  if (clean.length < 12) {
    // G-2-EHRLICHKEIT (ben-Check V2): zu kurzer Text wurde NICHT auf Widerspruch geprüft → ehrlich
    // "pending" (die UI zeigt „noch nicht geprüft"), NICHT "done" (das die UI fälschlich als „neu"
    // deutet). Kein Egress-Aspekt — es lief nur kein Judge.
    return { status: "pending", similar: [], conflicts: [] };
  }
  try {
    // 1) Kandidaten lexikalisch vorfiltern (begrenzt) — kein Voll-Pool-Scan. dropConfidential hält
    //    vertrauliche KOs aus dem Ergebnis UND aus dem Modell-Pool (kein Egress ihres Kerntexts). Demo-
    //    KOs bleiben DRIN: im Live-Check sind sie regulärer Bestand (der Check persistiert nichts), sonst
    //    fände die Ähnlichkeitssuche im Demo-/Testbetrieb nichts.
    const candidates = dropConfidential(
      await deps.ko.findCandidates({ terms: terms(clean), limit: CANDIDATE_LIMIT }),
    );

    // 2) similar: deterministische Trigramm-Ähnlichkeit gegen die Kandidaten.
    const subjectCore = `${clean}`;
    const similar: KnowledgeCheckSimilar[] = candidates
      .map((k) => ({
        id: k.id,
        title: k.title,
        score: trigramSimilarity(subjectCore, `${k.title} ${k.statement}`),
      }))
      .filter((s) => s.score >= SIMILAR_MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, SIMILAR_LIMIT);

    // 3) conflicts: NUR wenn die Route einen Judge übergeben hat (Freitext nicht-vertraulich + Modell
    //    verfügbar). Sonst ehrlich „pending" (nicht geprüft), conflicts = [] — KEIN Cloud-/Modell-Egress
    //    von Freitext. Der Dry-Run (assessAgainstPool) persistiert nichts.
    if (!deps.judge) {
      return { status: "pending", similar, conflicts: [] };
    }
    const pool = candidates.map(koToSubject);
    const dry = await deps.conflicts.assessAgainstPool(subjectFromText(clean), pool, deps.judge);
    const conflicts: KnowledgeCheckConflict[] = dry.map((d) => ({
      id: d.koId,
      title: d.koTitle,
      reason: d.rationale ?? "",
    }));
    return { status: "done", similar, conflicts };
  } catch {
    // never block: ehrlicher Fehlerstatus, keine Interna.
    return { status: "failed", similar: [], conflicts: [] };
  }
}

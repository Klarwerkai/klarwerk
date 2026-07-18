// SCRUM-527 (Live-Check): Ähnlichkeitsprüfung eines ENTWURFSTEXTES gegen den Bestand — die Datenquelle
// der Live-Reaktion in „Wissen erfassen".
//
// SOFORT-HOTFIX P0 (ben-Befund 1c, SCRUM-527): der Modell-JUDGE für die Widerspruchsprüfung ist
// DEAKTIVIERT. Grund: der Nutzer-Freitext hier ist UNKLASSIFIZIERT — er hatte keinen Vertraulichkeits-
// Vertrag. `dropConfidential` schützt nur die Bestands-KOs (Modell-Pool), NICHT den Freitext selbst.
// Der Judge (Reasoner.judgeConflict) lief mit confidential=false → der 502-Cloud-Chokepoint ließ den
// Freitext passieren → potenzieller Cloud-Egress vertraulicher Inhalte (DSGVO). Bis der VOLLE fail-safe-
// Provenienz-Vertrag kommt (eigener Slice, wie /api/check-text: fehlend/ungültig = vertraulich → kein
// Cloud/Embedder), liefert dieser Endpoint NUR:
//  - similar: rein LEXIKALISCH (Trigramm) gegen den Bestand — deterministisch, KEIN Modell, KEIN Egress.
//  - conflicts: [] mit Gesamtstatus "pending" — ehrlich „nicht geprüft", KEIN Modell-/Cloud-Aufruf.
import type { ConflictService } from "../../conflicts";
import { trigramSimilarity } from "../../conflicts";
import { type KoService, dropConfidential } from "../../knowledge-object";
import type { Reasoner } from "../../reasoner";

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

export interface KnowledgeCheckDeps {
  ko: KoService;
  conflicts: ConflictService;
  reasoner: Reasoner;
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
    return { status: "done", similar: [], conflicts: [] };
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

    // 3) conflicts: SOFORT-HOTFIX P0 — der Modell-Judge ist deaktiviert (kein Cloud-Egress von
    //    unklassifiziertem Freitext). Es wird KEIN Reasoner-/Modell-Aufruf ausgelöst. conflicts bleibt
    //    ehrlich ungeprüft ([] + status "pending"). similar (oben, lexikalisch) bleibt voll funktional.
    return { status: "pending", similar, conflicts: [] };
  } catch {
    // never block: ehrlicher Fehlerstatus, keine Interna.
    return { status: "failed", similar: [], conflicts: [] };
  }
}

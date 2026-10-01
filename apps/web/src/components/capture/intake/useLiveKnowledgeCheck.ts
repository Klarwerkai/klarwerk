import type { KnowledgeCheckCoverage, KnowledgeCheckResult } from "../../../api/types";
import type { LiveVerdict } from "../../../lib/intakeSimilarity";

// JOB 3556 (LIVE-CHECK-VERDRAHTUNG A): DER ZWEITE HAKEN IST WEG, DIE ABBILDUNG BLEIBT HIER.
// Diese Datei trug bis JOB 3556 zwei Dinge: die reine Abbildung `mapKnowledgeCheck` UND einen
// eigenen `useLiveKnowledgeCheck`, den seit JOB 3427 R2 kein Produktcode mehr rief (das Blatt fährt
// `hooks/useLiveKnowledgeCheck.ts`, der Prüfstatus und Treffer getrennt hält). Zwei Haken auf
// denselben Endpunkt sind zwei Wahrheiten über denselben Befund — der abgelöste ist entfernt, nicht
// danebengelassen.
//
// WARUM `mapKnowledgeCheck` HIER BLEIBT und nicht mitzieht: sie ist die Abbildung Serverbefund →
// ANZEIGE-Verdict und gehört damit zur Darstellung, die in diesem Ordner neben `LiveReactionZone`
// wohnt; ihr eigener Prüfstand liegt daneben (`useLiveKnowledgeCheck.test.ts`). Ein Umzug hätte den
// Aufrufer im Haken nur umgehängt und den Prüfstand mitgeschleppt, ohne etwas zu klären.

// G-2-EHRLICHKEIT (SCRUM-527): reine Abbildung des ehrlichen Endpoint-Ergebnisses auf den Anzeige-Verdict.
// status "pending" (Widerspruch mangels Klassifikation/Modell NICHT geprüft) wird als eigener,
// sichtbarer Zustand gezeigt. status "failed" → „Prüfung nicht verfügbar".
// Reihenfolge: Widerspruch > Ähnlich > (done→empty | pending | failed).
//
// AUFNAHME 20260922 · VORSCHAU-REICHWEITE: „done" ohne Fund hiess hier bis dahin „neu" — als hätte
// der Check den ganzen Bestand angesehen. Er sah höchstens die Vorauswahl. Der Zustand heisst jetzt
// "empty" und trägt den Umfang, den der Server meldet; fehlt die Angabe, ist er ausdrücklich
// unbekannt (`pruefumfangVon`). Eine bestandweite Neuheitsaussage kann aus keiner Antwort entstehen.
//
// JOB 3045: `koStatus`/`koCategory` werden REIN DURCHGEREICHT — kein `?? "offen"`, kein `?? ""`,
// keine Ableitung, keine Umbenennung. Was der Server sagt (auch sein `null`), steht so im Verdict.
export function mapKnowledgeCheck(r: KnowledgeCheckResult): LiveVerdict {
  const c = r.conflicts[0];
  if (c) {
    return {
      status: "conflict",
      match: {
        koId: c.id,
        title: c.title,
        score: 1,
        koStatus: c.koStatus,
        koCategory: c.koCategory,
      },
    };
  }
  const s = r.similar[0];
  if (s) {
    return {
      status: "similar",
      match: {
        koId: s.id,
        title: s.title,
        score: s.score,
        koStatus: s.koStatus,
        koCategory: s.koCategory,
      },
    };
  }
  if (r.status === "done") {
    return { status: "empty", coverage: pruefumfangVon(r) }; // in DIESEM Umfang kein Treffer
  }
  if (r.status === "pending") {
    return { status: "pending" }; // Widerspruch NICHT geprüft — nicht „neu"
  }
  return { status: "unavailable" }; // failed
}

/**
 * Der Prüfumfang einer Antwort, so wie sie ihn belegt. Fehlt das Feld oder ist es unvollständig,
 * gilt er als unbekannt — die Fläche erfindet keine Zahl und keine Vollständigkeit.
 */
export function pruefumfangVon(r: KnowledgeCheckResult): KnowledgeCheckCoverage {
  const c = r.coverage;
  if (
    c?.kind === "candidates" &&
    Number.isInteger(c.checked) &&
    c.checked >= 0 &&
    Number.isInteger(c.limit) &&
    typeof c.limitReached === "boolean"
  ) {
    return { kind: "candidates", checked: c.checked, limit: c.limit, limitReached: c.limitReached };
  }
  return { kind: "unknown" };
}

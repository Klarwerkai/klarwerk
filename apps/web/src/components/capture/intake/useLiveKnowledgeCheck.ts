import type { KnowledgeCheckResult } from "../../../api/types";
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
// KERNREGEL: „neu" NUR bei status "done" UND leerem similar+conflicts — also wenn WIRKLICH geprüft wurde
// und nichts existiert. status "pending" (Widerspruch mangels Klassifikation/Modell NICHT geprüft) wird
// als eigener, sichtbarer Zustand gezeigt — NIE als „neu, du bist die erste Person". status "failed" →
// „Prüfung nicht verfügbar". Reihenfolge: Widerspruch > Ähnlich > (done→neu | pending | failed).
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
    return { status: "new" }; // ehrlich geprüft, nichts gefunden
  }
  if (r.status === "pending") {
    return { status: "pending" }; // Widerspruch NICHT geprüft — nicht „neu"
  }
  return { status: "unavailable" }; // failed
}

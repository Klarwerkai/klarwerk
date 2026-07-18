import { useEffect, useState } from "react";
import { endpoints } from "../../../api/endpoints";
import type { KnowledgeCheckResult } from "../../../api/types";
import { INTAKE_MIN_LENGTH, type LiveVerdict } from "../../../lib/intakeSimilarity";

// G-2-EHRLICHKEIT (SCRUM-527): reine Abbildung des ehrlichen Endpoint-Ergebnisses auf den Anzeige-Verdict.
// KERNREGEL: „neu" NUR bei status "done" UND leerem similar+conflicts — also wenn WIRKLICH geprüft wurde
// und nichts existiert. status "pending" (Widerspruch mangels Klassifikation/Modell NICHT geprüft) wird
// als eigener, sichtbarer Zustand gezeigt — NIE als „neu, du bist die erste Person". status "failed" →
// „Prüfung nicht verfügbar". Reihenfolge: Widerspruch > Ähnlich > (done→neu | pending | failed).
export function mapKnowledgeCheck(r: KnowledgeCheckResult): LiveVerdict {
  const c = r.conflicts[0];
  if (c) {
    return { status: "conflict", match: { koId: c.id, title: c.title, score: 1 } };
  }
  const s = r.similar[0];
  if (s) {
    return { status: "similar", match: { koId: s.id, title: s.title, score: s.score } };
  }
  if (r.status === "done") {
    return { status: "new" }; // ehrlich geprüft, nichts gefunden
  }
  if (r.status === "pending") {
    return { status: "pending" }; // Widerspruch NICHT geprüft — nicht „neu"
  }
  return { status: "unavailable" }; // failed
}

// SCRUM-527 (Live-Check): der Hook ruft debounced POST /api/knowledge/check und bildet das ehrliche
// Ergebnis über mapKnowledgeCheck ab. Ein Netzwerkfehler ist ebenfalls eine nicht-verfügbare Prüfung →
// „unavailable" (ehrlich sichtbar), statt still auf „neu"/„idle" zu fallen. Der Erfassungs-Flow bleibt
// nicht-blockierend: der Zustand ist rein informativ, das Speichern wird nie verhindert.
export function useLiveKnowledgeCheck(text: string, debounceMs = 500): LiveVerdict {
  const [verdict, setVerdict] = useState<LiveVerdict>({ status: "idle" });

  useEffect(() => {
    if (text.trim().length < INTAKE_MIN_LENGTH) {
      setVerdict({ status: "idle" });
      return;
    }
    // Sofort sichtbar/lebendig: die Zone läuft, während geprüft wird.
    setVerdict({ status: "checking" });
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const r = await endpoints.knowledge.check(text.trim());
        if (!cancelled) {
          setVerdict(mapKnowledgeCheck(r));
        }
      } catch {
        // Prüfung nicht erreichbar → ehrlich als „nicht verfügbar" anzeigen (nicht als „neu").
        if (!cancelled) {
          setVerdict({ status: "unavailable" });
        }
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [text, debounceMs]);

  return verdict;
}

import { useEffect, useState } from "react";
import { endpoints } from "../../../api/endpoints";
import { INTAKE_MIN_LENGTH, type LiveVerdict } from "../../../lib/intakeSimilarity";

// SCRUM-527 (Live-Check, jetzt am ECHTEN Endpoint): der Hook ruft debounced POST /api/knowledge/check
// (Ähnlichkeit lexikalisch, Widerspruch als 502-gecappter Modell-Dry-Run) und bildet das ehrliche
// Ergebnis auf den Anzeige-Verdict ab. Reihenfolge der Anzeige: Widerspruch > Ähnlich > Neu. Ein
// Fehler blockt nie (zurück auf „hört zu"). Der frühere client-seitige Heuristik-Pfad (classifyIntake)
// bleibt als reine, getestete Fallback-Logik erhalten, wird hier aber nicht mehr gebraucht.
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
        if (cancelled) {
          return;
        }
        // Widerspruch hat Vorrang (der wichtigste Hinweis), dann Ähnlichkeit, sonst neu.
        if (r.conflicts.length > 0) {
          const c = r.conflicts[0];
          if (c) {
            setVerdict({ status: "conflict", match: { koId: c.id, title: c.title, score: 1 } });
            return;
          }
        }
        if (r.similar.length > 0) {
          const s = r.similar[0];
          if (s) {
            setVerdict({
              status: "similar",
              match: { koId: s.id, title: s.title, score: s.score },
            });
            return;
          }
        }
        // Nichts Ähnliches/Widersprüchliches. (Bei status "pending" wurde der Widerspruch mangels
        // Modell nicht geprüft — für die Anzeige bleibt es „neu": nichts Ähnliches gefunden.)
        setVerdict({ status: "new" });
      } catch {
        // never block: ehrlich zurück auf „hört zu", kein Fehlerschreck in der Live-Zone.
        if (!cancelled) {
          setVerdict({ status: "idle" });
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

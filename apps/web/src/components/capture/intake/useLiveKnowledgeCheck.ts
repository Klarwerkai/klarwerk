import { useEffect, useState } from "react";
import { useKos } from "../../../api/hooks";
import { INTAKE_MIN_LENGTH, type LiveVerdict, classifyIntake } from "../../../lib/intakeSimilarity";

// SCRUM-527 (WP2-Design): der GEKAPSELTE Client-Hook der Live-Reaktion. Stand 0b-Kartierung gibt es
// KEINEN dedizierten Pro-Text-Ähnlichkeits-/Widerspruchs-Endpoint → dieser Hook nutzt als ehrliche
// Quelle den ECHTEN Bestand (useKos → GET /api/kos) und klassifiziert token-basiert (classifyIntake):
// idle · checking · new · similar. Der WIDERSPRUCH-Fall wird NICHT erfunden (kein Fake-Alarm); er ist
// im Verdict-Typ vorgesehen und ANDOCKBEREIT: sobald ein serverseitiger Widerspruchs-/Ähnlichkeits-
// Check existiert (z. B. POST /api/reasoner conflict-check oder ein neuer /api/knowledge/check-Endpoint
// mit pending/done/failed), wird hier nur die Quelle getauscht — die Zone/Verträge bleiben gleich.
//
// Debounced: erst „checking" (ehrlicher Lauf-Zustand), nach Ruhe die Klassifikation. Bewusst als Hook
// isoliert, damit die Anbindung an den echten Endpoint später eine EINZIGE Stelle ist.
export function useLiveKnowledgeCheck(text: string, debounceMs = 500): LiveVerdict {
  const kos = useKos();
  const [verdict, setVerdict] = useState<LiveVerdict>({ status: "idle" });

  useEffect(() => {
    if (text.trim().length < INTAKE_MIN_LENGTH) {
      setVerdict({ status: "idle" });
      return;
    }
    // Sofort sichtbar/lebendig: die Zone läuft, während wir gegen den Bestand prüfen.
    setVerdict({ status: "checking" });
    const handle = setTimeout(() => {
      // Solange der Bestand noch lädt, ehrlich weiter „checking" zeigen (kein voreiliges „neu").
      if (kos.isLoading) {
        return;
      }
      setVerdict(classifyIntake(text, kos.data));
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [text, debounceMs, kos.data, kos.isLoading]);

  return verdict;
}

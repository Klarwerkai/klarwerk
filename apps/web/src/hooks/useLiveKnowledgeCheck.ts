import { useEffect, useState } from "react";
import { endpoints } from "../api/endpoints";
import type { KnowledgeCheckResult } from "../api/types";
import { mapKnowledgeCheck } from "../components/capture/intake/useLiveKnowledgeCheck";
import { INTAKE_MIN_LENGTH, type LiveVerdict } from "../lib/intakeSimilarity";

interface LiveCheckState {
  checkStatus: KnowledgeCheckResult["status"] | "idle" | "checking";
  verdict: LiveVerdict;
}

// JOB 3427: Der Editor braucht ZWEI Auskünfte aus derselben Antwort. Der Prüfstatus darf
// weder hinter einem Treffer verschwinden noch dessen deterministischen Fundort verdrängen.
// Die bestehende Trefferabbildung bleibt zuständig für Titel, Link und nulltreuen Fundort.
export function useLiveKnowledgeCheck(text: string, debounceMs = 500): LiveCheckState {
  const clean = text.trim();
  const [state, setState] = useState<LiveCheckState & { text: string }>({
    text: "",
    checkStatus: "idle",
    verdict: { status: "idle" },
  });

  useEffect(() => {
    if (clean.length < INTAKE_MIN_LENGTH) {
      setState({ text: clean, checkStatus: "idle", verdict: { status: "idle" } });
      return;
    }
    setState({ text: clean, checkStatus: "checking", verdict: { status: "checking" } });
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const result = await endpoints.knowledge.check(clean);
        if (cancelled) return;
        const checkStatus = result.status;
        // Unvollständige Konflikturteile sind keine belegten Widersprüche. Ähnlichkeit ist
        // unabhängig davon belegt und bleibt erhalten; die Transportantwort bleibt unverändert.
        const verdict = mapKnowledgeCheck(
          checkStatus === "done" ? result : { ...result, conflicts: [] },
        );
        setState({ text: clean, checkStatus, verdict });
      } catch {
        if (!cancelled) {
          setState({ text: clean, checkStatus: "failed", verdict: { status: "unavailable" } });
        }
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [clean, debounceMs]);

  // Ein Ergebnis des vorigen Texts gilt schon vor dem nächsten Effekt nicht mehr.
  if (state.text !== clean) {
    const status = clean.length < INTAKE_MIN_LENGTH ? "idle" : "checking";
    return { checkStatus: status, verdict: { status } };
  }
  return state;
}

import type { KnowledgeObject } from "../api/types";

// SCRUM-527 (Iteration 1): die häufigste Kategorie eines KO-Satzes — als „Domäne" des Nutzers/Bestands.
// Der Container reicht die KOs des Nutzers (author === userId) rein; gibt es keine, wird der ganze
// Bestand betrachtet. Kein eindeutiges Signal (leer) → undefined, dann drängt der Leerzustand KEIN Beispiel auf.
export function dominantCategory(kos: readonly KnowledgeObject[] | undefined): string | undefined {
  if (!kos || kos.length === 0) {
    return undefined;
  }
  const counts = new Map<string, number>();
  for (const k of kos) {
    const c = (k.category ?? "").trim();
    if (c) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [c, n] of counts) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

// SCRUM-527 (Iteration 1): den besten, möglichst DOMÄNENNAHEN Beispiel-KO wählen. Reihenfolge:
//   1. validiertes KO MIT Quelle in der bevorzugten Kategorie (Nutzer-Domäne),
//   2. sonst irgendein validiertes KO mit Quelle (Org-Bestand, nicht fachfremd erfunden),
//   3. sonst irgendein validiertes,
//   4. sonst irgendeines.
// Leerer Bestand → null: der Leerzustand zeigt dann NUR Frage + Feld (kein aufgedrängtes/fachfremdes
// Muster-KO). preferCategory kommt vom Aufrufer (dominantCategory der Nutzer-KOs).
export function pickExampleKo(
  kos: readonly KnowledgeObject[] | undefined,
  preferCategory?: string,
): KnowledgeObject | null {
  if (!kos || kos.length === 0) {
    return null;
  }
  const hasSource = (k: KnowledgeObject): boolean => (k.sources?.length ?? 0) > 0;
  if (preferCategory) {
    const inDomain = kos.find(
      (k) => k.category === preferCategory && k.status === "validiert" && hasSource(k),
    );
    if (inDomain) {
      return inDomain;
    }
  }
  const validatedWithSource = kos.find((k) => k.status === "validiert" && hasSource(k));
  if (validatedWithSource) {
    return validatedWithSource;
  }
  const validated = kos.find((k) => k.status === "validiert");
  return validated ?? kos[0] ?? null;
}

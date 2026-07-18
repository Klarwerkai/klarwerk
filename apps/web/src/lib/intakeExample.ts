import type { KnowledgeObject } from "../api/types";

// SCRUM-527 (Design-Batch B): den besten ECHTEN Beispiel-KO aus dem Bestand wählen — der Leerzustand
// zeigt „So etwas — aber deins." statt eines leeren Felds. Bevorzugt ein validiertes KO MIT Quelle
// (vollständiges Vorbild), sonst irgendein validiertes, sonst irgendeines. Kein Treffer → null (der
// Aufrufer zeigt dann einen klar als Beispiel markierten Muster-KO, kein Fake, der wie Bestand aussieht).
export function pickExampleKo(kos: readonly KnowledgeObject[] | undefined): KnowledgeObject | null {
  if (!kos || kos.length === 0) {
    return null;
  }
  const validatedWithSource = kos.find(
    (k) => k.status === "validiert" && (k.sources?.length ?? 0) > 0,
  );
  if (validatedWithSource) {
    return validatedWithSource;
  }
  const validated = kos.find((k) => k.status === "validiert");
  return validated ?? kos[0] ?? null;
}

// Reiner, DOM-freier Helfer für FE-VAL-06: Validierungs-Feedback bei Gelb/Rot.
// Nur Gelb (warn) und Rot (down) erfordern Feedback; Grün (up) nicht.
export type FeedbackVerdict = "warn" | "down";

// Stabiles, neutrales Präfix (nicht lokalisiert), damit der Kommentar im KO-Detail
// unabhängig von der UI-Sprache als Validierungsfeedback erkennbar bleibt.
export function feedbackPrefix(verdict: FeedbackVerdict): string {
  return verdict === "warn" ? "Validierungsfeedback (Bedingt)" : "Validierungsfeedback (Ablehnung)";
}

// Baut den zu speichernden Kommentartext. Wirft bei leerem/whitespace-Text,
// damit Pflichtfeedback nicht versehentlich leer gespeichert wird.
export function buildValidationFeedback(verdict: FeedbackVerdict, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("empty-feedback");
  }
  return `${feedbackPrefix(verdict)}: ${trimmed}`;
}

// UI-Guard: ist der eingegebene Text absendbar?
export function isFeedbackSubmittable(text: string): boolean {
  return text.trim().length > 0;
}

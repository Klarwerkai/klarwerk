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

// SCRUM-332: Validierungsfeedback-Kommentare wieder LESEN — anhand desselben stabilen Präfix, das
// buildValidationFeedback schreibt (sprachunabhängig). Reine, DOM-freie Logik; kein Backend, kein
// neuer Kommentar-Typ. So lässt sich im Rework-Kontext das konkrete Review-Feedback fokussiert zeigen.

export interface ValidationFeedbackComment {
  verdict: FeedbackVerdict;
  body: string; // Feedback-Text ohne Präfix
  author: string;
  at: string;
}

interface CommentLike {
  text?: string | null;
  author?: string | null;
  at?: string | null;
}

// Erkennt ein Validierungsfeedback an seinem Präfix und liefert Verdict + reinen Text; sonst null.
export function parseValidationFeedback(
  text: string | null | undefined,
): { verdict: FeedbackVerdict; body: string } | null {
  const value = text ?? "";
  for (const verdict of ["warn", "down"] as const) {
    const prefix = `${feedbackPrefix(verdict)}: `;
    if (value.startsWith(prefix)) {
      return { verdict, body: value.slice(prefix.length).trim() };
    }
  }
  return null;
}

// Liefert das jüngste Validierungsfeedback aus einer Kommentarliste (per ISO-`at`, bei Gleichstand/
// fehlendem `at` die spätere Array-Position). Robust gegen leere/fehlende/normale/unbekannte Kommentare.
export function latestValidationFeedback(
  comments: readonly CommentLike[] | null | undefined,
): ValidationFeedbackComment | null {
  let best: ValidationFeedbackComment | null = null;
  for (const comment of comments ?? []) {
    const parsed = parseValidationFeedback(comment.text);
    if (!parsed) {
      continue;
    }
    const candidate: ValidationFeedbackComment = {
      verdict: parsed.verdict,
      body: parsed.body,
      author: comment.author ?? "",
      at: comment.at ?? "",
    };
    if (
      best === null ||
      (candidate.at && best.at && candidate.at !== best.at ? candidate.at > best.at : true)
    ) {
      best = candidate;
    }
  }
  return best;
}

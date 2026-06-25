// Reine, DOM-freie Logik für externe Quellen am KO (SCRUM-129 / FE-KO-07).
import type { KoSource } from "../api/types";

export interface SourceFormInput {
  label: string;
  url: string;
  excerpt: string;
}

export const EMPTY_SOURCE_FORM: SourceFormInput = { label: "", url: "", excerpt: "" };

// Label ist Pflicht; URL/Excerpt optional.
export function isSourceFormValid(input: SourceFormInput): boolean {
  return input.label.trim().length > 0;
}

// Payload für die add-source-Aktion (leere Optionalfelder weglassen).
export function toSourcePayload(input: SourceFormInput): {
  label: string;
  url?: string;
  excerpt?: string;
} {
  const payload: { label: string; url?: string; excerpt?: string } = { label: input.label.trim() };
  if (input.url.trim()) {
    payload.url = input.url.trim();
  }
  if (input.excerpt.trim()) {
    payload.excerpt = input.excerpt.trim();
  }
  return payload;
}

// Badge-Schlüssel: externe Quellen sind nie peer-validiert → klare Stufe-2-Markierung.
export function sourceBadgeKey(source: Pick<KoSource, "peerValidated">): string {
  return source.peerValidated ? "ko.sourceValidated" : "ko.sourceUnvalidated";
}

// SCRUM-88 / FR-I18N-01: bildet die UI-Sprache (i18next `language`, z. B. "de-DE", "en-US")
// auf die vom Reasoner unterstützten Sprachen ab. Nur DE/EN; alles andere → "de".
export type ReasonerLocale = "de" | "en";

export function toReasonerLocale(language: string | undefined | null): ReasonerLocale {
  return (language ?? "").toLowerCase().startsWith("en") ? "en" : "de";
}

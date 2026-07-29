// SCRUM-88 / FR-I18N-01: bildet die UI-Sprache (i18next `language`, z. B. "de-DE", "en-US",
// "nl-NL") auf die vom Reasoner unterstützten Sprachen ab.
//
// AUFTRAG-mega52 D1 — NIEDERLÄNDISCH ERREICHT DAS MODELL.
//
// DER BEFUND (Pedi, 28.07.): Englisch UND Niederländisch übersetzten nur die Metadaten, nicht den
// Antwortkörper. Für Niederländisch lag die Ursache HIER: die Zuordnung war `startsWith("en") ? "en"
// : "de"` — alles Nicht-Englische fiel auf Deutsch, obwohl NL eine vollwertige Oberflächensprache
// ist. Das Modell hat die gewählte Sprache also nie erfahren; es konnte sie gar nicht treffen.
//
// Die Reihenfolge ist bewusst „bekannte Sprache zuerst, Deutsch zuletzt": eine vierte
// Oberflächensprache landet weiterhin auf dem sicheren Default und nicht auf einem Prompt, den
// niemand geschrieben hat.
export type ReasonerLocale = "de" | "en" | "nl";

export function toReasonerLocale(language: string | undefined | null): ReasonerLocale {
  const tag = (language ?? "").toLowerCase();
  if (tag.startsWith("en")) {
    return "en";
  }
  if (tag.startsWith("nl")) {
    return "nl";
  }
  return "de";
}

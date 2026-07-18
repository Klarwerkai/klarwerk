// SCRUM-527 (WP2 — SourceLink-Härtung): DEFENSIVE Render-Allowlist für extern klickbare URLs. Spiegelt
// die Persistenz-Allowlist (services/knowledge-object safeSourceUrl): nur ABSOLUTE http/https-URLs
// ergeben einen href, alles andere → null. Zweck: LEGACY-Daten, die schon VOR der Persistenz-Härtung
// mit javascript:/data:/vbscript:/relativ in der DB stehen, dürfen beim Rendern KEINEN aktiven Link
// erzeugen — der Aufrufer zeigt dann den Text statt eines href. Neue Persistenz ist bereits sauber; dies
// ist die zweite Verteidigungslinie am Klick-Pfad.
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    // Nur absolute URLs parsen ohne Basis erfolgreich; der Parser entfernt Tabs/Umbrüche (keine
    // „java\tscript:"-Obfuskation). Relativ/schemalos/„//host" wirft → null.
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return trimmed;
}

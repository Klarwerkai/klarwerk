// SCRUM-527 (WP2 — SourceLink-Härtung): ZENTRALE Allowlist für Quell-URLs an der PERSISTENZGRENZE.
// Nur ABSOLUTE http/https-URLs dürfen in den Bestand. Alles andere wird verworfen (→ null):
//   - aktive Schemata: javascript: / data: / vbscript: / file: … (XSS beim Klicken)
//   - schemalose/relative URLs ("/x", "foo/bar") und protokoll-relative ("//host/x")
//   - kaputte/leere Werte
// Grund: stored/cross-user — ko.create/addSource/revise SCHREIBEN, ko.read KLICKT. Ohne diese Grenze
// könnte Nutzer A eine `javascript:`-URL speichern, die bei Nutzer B im href landet. Der Render-Pfad
// (apps/web safeHttpUrl) prüft zusätzlich defensiv (Altdaten), aber die Persistenzgrenze ist die
// eigentliche Absicherung. Idempotent: ein bereits gültiger Wert bleibt unverändert.
export function safeSourceUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    // OHNE Basis parsen NUR absolute URLs erfolgreich — relativ/schemalos/„//host" wirft → verworfen.
    // Der Parser entfernt außerdem eingebettete Tabs/Zeilenumbrüche, sodass „java\tscript:" als
    // protocol "javascript:" erkannt und ebenfalls verworfen wird (keine Obfuskation).
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return trimmed;
}

// Wendet die Allowlist auf jede Quelle einer Liste an: ungültige URL → null, die Quelle selbst bleibt
// erhalten (Label/Auszug/Provider unverändert). Für create/revise, die fertige KoSource[] übernehmen.
export function sanitizeSources<T extends { url?: string | null }>(sources: readonly T[]): T[] {
  return sources.map((source) => ({ ...source, url: safeSourceUrl(source.url) }));
}

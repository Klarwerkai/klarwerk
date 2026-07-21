// WP-RETEST7 R1 (Pedis DOCX-Befund): EHRLICHE Fehlerursachen statt pauschalem „konnte nicht
// gelesen werden". Die Lese-Pfade (mammoth/pdfjs/fflate/tesseract) laden ihre Engine per
// dynamic import — nach einem Deploy hält ein ALTER Tab noch die alten Chunk-URLs und der
// Import scheitert (typisch: TypeError „Failed to fetch dynamically imported module" bzw. der
// Vite-Preload-Fehler). Das ist KEIN kaputtes Dokument — die ehrliche Meldung ist „App neu
// laden". Alle anderen Fehler bleiben Parse-Fehler, ergänzt um eine kurze Ursache.

// i18n-Schlüssel der Stale-Bundle-Meldung (DE/EN/NL) — EINE Meldung für ALLE Lazy-Import-Stellen.
export const STALE_BUNDLE_KEY = "app.staleBundle";

// Robuste Erkennung eines fehlgeschlagenen dynamic imports über die bekannten Browser-/Vite-
// Formulierungen (Chrome/Firefox/Safari + Vite-Preload + Webpack-ChunkLoadError-Name). Bewusst
// NICHT „jeder TypeError" — ein TypeError aus echter Parse-Logik bleibt ein Parse-Fehler.
export function isStaleChunkError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /dynamically imported module|module script failed|ChunkLoadError|Unable to preload|preloadError|Loading chunk/i.test(
    text,
  );
}

// Kurze, PII-unkritische Ursache für die Parse-Fehlermeldung (der lokale Dateiname wird ohnehin
// gezeigt): erste 120 Zeichen der Fehlermeldung, Whitespace normalisiert.
export function shortErrorDetail(error: unknown, max = 120): string {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return msg.replace(/\s+/g, " ").trim().slice(0, max);
}

// EINE Meldungswahl für alle Lese-Catches: Stale-Bundle → Neu-laden-Meldung; sonst die bestehende
// Parse-Meldung plus kurze Ursache in Klammern (ohne Ursache unverändert).
export function honestParseErrorText(error: unknown, staleText: string, baseText: string): string {
  if (isStaleChunkError(error)) {
    return staleText;
  }
  const detail = shortErrorDetail(error);
  return detail ? `${baseText} (${detail})` : baseText;
}

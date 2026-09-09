// WP-RETEST7 R1 (Pedis DOCX-Befund): EHRLICHE Fehlerursachen statt pauschalem „konnte nicht
// gelesen werden". Die Lese-Pfade (mammoth/pdfjs/fflate/tesseract) laden ihre Engine per
// dynamic import — nach einem Deploy hält ein ALTER Tab noch die alten Chunk-URLs und der
// Import scheitert (typisch: TypeError „Failed to fetch dynamically imported module" bzw. der
// Vite-Preload-Fehler). Das ist KEIN kaputtes Dokument — die ehrliche Meldung ist „App neu
// laden". Alle anderen Fehler bleiben Parse-Fehler, ergänzt um eine kurze Ursache.

// i18n-Schlüssel der Stale-Bundle-Meldung (DE/EN/NL) — EINE Meldung für ALLE Lazy-Import-Stellen.
export const STALE_BUNDLE_KEY = "app.staleBundle";

// WP-SAMMEL21-FIX (bens Fix 5): ENGER VERANKERTE Erkennung eines fehlgeschlagenen dynamic imports
// — Fehlername-WHITELIST statt reiner Substring-Suche über beliebige Fehler:
//  (1) Webpack-ChunkLoadError: eindeutig am NAMEN erkennbar.
//  (2) Browser-TypeError des import()-Pfads: NUR ein TypeError zählt, und nur mit einer der
//      bekannten browser-spezifischen import()-Formulierungen (Chrome: Failed to fetch dynamically
//      imported module; Firefox: error loading dynamically imported module; Safari: Importing a
//      module script failed).
//  (3) Vite-Preload: die eindeutige Vite-Formulierung (Unable to preload CSS/…) bzw. der von Vite
//      geworfene preloadError.
// Ein GENERISCHER Error aus echter Parse-Logik (mammoth/fflate/pdfjs — z. B. ZIP-Struktur kaputt)
// erfüllt KEINES der Kriterien: er trägt weder den Chunk-Namen noch ist er ein TypeError mit
// import()-Formulierung — er bleibt IMMER ein Parse-Fehler mit Ursache, nie „bitte neu laden".
// ------------------------------------------------------------------------------------------------
// JOB 3423 · NAVIGATION-CHUNK-STAND — DIE ANNAHME „name === TypeError" IST JETZT GEMESSEN.
// ------------------------------------------------------------------------------------------------
//
// Pedis Fall vom 09.09.2026 20:4x: alter Tab, Klick auf „Duplikate", und statt der ruhigen Karte
// stand die generische da — „Failed to fetch dynamically imported module:
// https://app.klarwerk.ai/assets/Duplicates-CIbJ3zEu.js". Codex' Auslieferungsbefund (20:47): genau
// dieses Stück antwortet HTTP 404 mit `text/plain`, während `GET /` auf einen anderen Namen zeigt.
//
// DIE FRAGE, DIE DARAN HING: die Bedingung `error.name === "TypeError"` (unten) war eine ANNAHME
// über die Fehlerklasse des Browsers. Sie war nirgends gemessen — jsdom führt keine Modul-Skripte
// aus, und der vorhandene Fall A3 baute sich sein Fehlerobjekt selbst.
//
// GEMESSEN (echtes Chromium, `tests/ladefehler-alter-tab/echter-ladefehler-chromium.test.ts`, vier
// Serverantworten: 404 `text/plain` — Codex' Fall —, 404 `text/html`, 200 `text/html` als
// SPA-Rückfall und abgebrochene Verbindung): ALLE VIER ergeben `name: "TypeError"` mit
// `message: "Failed to fetch dynamically imported module: <adresse>"`. Die Bedingung greift also;
// die Erkennung wurde deshalb NICHT erweitert — eine Erweiterung ohne roten Fall wäre Erfindung.
// Ändert ein Browser-Update den Wortlaut, wird jener Prüfstand rot, statt dass hier still
// danebengegriffen wird.
//
// WAS DIE ERKENNUNG WEITERHIN AUSDRÜCKLICH NICHT EINSCHLIESST: einen gewöhnlichen `Error` mit der
// Import-Formulierung im Text (Gegenprobe `tests/capture/stale-chunk.test.ts:56`) und jeden
// Parse-Fehler der Lesepfade — auch an der Fehlergrenze (Gegenproben A9 in
// `tests/ladefehler-alter-tab/ladefehler-zeigt-neue-version.test.tsx`).
const IMPORT_TYPEERROR_RE =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;
const VITE_PRELOAD_RE = /unable to preload/i;

export function isStaleChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false; // nur echte Fehlerobjekte — ein String/Fremdwert ist nie ein Stale-Signal
  }
  if (error.name === "ChunkLoadError" || error.name === "preloadError") {
    return true;
  }
  if (error.name === "TypeError") {
    return IMPORT_TYPEERROR_RE.test(error.message);
  }
  return VITE_PRELOAD_RE.test(error.message);
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

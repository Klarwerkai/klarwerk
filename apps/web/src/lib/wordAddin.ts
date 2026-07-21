// WP-KLARA-1 (Klara in Word, erster Schritt): DOM-freie Hilfslogik des Word-Add-ins. Das Taskpane
// (apps/web/public/word-addin/taskpane.html) ist bewusst eine selbstenthaltende statische Seite ohne
// Build-Schritt — es trägt eine INLINE-KOPIE dieser zwei Funktionen zwischen den Markern
// KW-WORDADDIN-HELPERS-START/END; ein Äquivalenztest (tests/app/word-addin.test.ts) führt beide
// Fassungen auf denselben Fixtures aus und pinnt identisches Verhalten (kleinste ehrliche Lösung —
// kein Build-Generator für eine einzelne statische Seite).

// Titel des Front-Door-Entwurfs aus der Word-Selektion: erste nicht-leere Zeile, auf 60 Zeichen
// gekappt. Ganz ohne brauchbare Zeile → ehrlicher Standardtitel (kein leerer Draft-Titel).
export const WORD_ADDIN_FALLBACK_TITLE = "Wissens-Entwurf aus Word";
export const WORD_ADDIN_TITLE_MAX = 60;

export function deriveDraftTitleFromSelection(text: string): string {
  const firstLine =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const title = firstLine.slice(0, WORD_ADDIN_TITLE_MAX).trim();
  return title.length > 0 ? title : WORD_ADDIN_FALLBACK_TITLE;
}

// WP-KLARA-1c (Pedis Live-Befund, Word Mac 16.111): Anmelde-RÜCKWEG. Das Panel navigiert NICHT mehr
// zur App (dort blieb es nach dem Login auf der vollen Webseite hängen), sondern öffnet die Anmeldung
// in einem EIGENEN Fenster und POLLT /api/auth/me. Diese pure Funktion entscheidet je Poll-Tick:
// fertig (Session da → angemeldeten Zustand zeigen, OHNE Navigation), Frist abgelaufen (ehrlicher
// Timeout-Hinweis) oder weiter warten.
export const WORD_ADDIN_LOGIN_POLL_INTERVAL_MS = 3000;
export const WORD_ADDIN_LOGIN_POLL_MAX_MS = 300000; // 5 Minuten (harte Frist ab Start)
// WP-IC-PAKET-1c (bens ROT-1b): eigene Frist JE FETCH (AbortController) — ein hängender Request
// blockiert die sequenzielle Schleife höchstens diese Spanne, nie die ganze 5-Minuten-Frist.
export const WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS = 5000;

export type LoginPollDecision = "done" | "timeout" | "poll";

export function loginPollDecision(elapsedMs: number, signedIn: boolean): LoginPollDecision {
  if (signedIn) {
    return "done";
  }
  if (elapsedMs >= WORD_ADDIN_LOGIN_POLL_MAX_MS) {
    return "timeout";
  }
  return "poll";
}

// WP-IC-PAKET-1c (bens ROT-1d): Schritt-Entscheidung NACH Abschluss eines Poll-Versuchs, inklusive
// GENERATION-Guard. Jeder Lauf trägt eine Generation-ID; Abbrechen/Neustart erhöht die aktuelle
// Generation — ein Versuch einer ALTEN Generation endet IMMER still ("stale"), egal was der Fetch
// ergab (kein später Zustands-Überschreiber). Sonst: fertig / harte Frist / nächsten Versuch planen
// (die Planung erfolgt erst NACH Abschluss — genau EIN Poll gleichzeitig, kein Interval).
export type LoginPollStep = "stale" | "done" | "timeout" | "schedule";

export function loginPollStep(
  generation: number,
  currentGeneration: number,
  elapsedMs: number,
  signedIn: boolean,
): LoginPollStep {
  if (generation !== currentGeneration) {
    return "stale";
  }
  const decision = loginPollDecision(elapsedMs, signedIn);
  return decision === "poll" ? "schedule" : decision;
}

// Selektion → sicheres Body-HTML: je nicht-leere Zeile ein <p>, Text vollständig escaped (keine
// Roh-HTML-Übernahme aus Word). Leere Selektion → leerer String (der Aufrufer meldet ehrlich).
export function selectionToBodyHtml(text: string): string {
  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

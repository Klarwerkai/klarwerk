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
